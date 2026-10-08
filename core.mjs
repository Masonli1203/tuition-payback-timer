export function parseValue(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('请输入有效金额，最多保留两位小数。');
  }
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 999999999) {
    throw new Error('金额须在 $0.01 至 $9,999,999.99 之间。');
  }
  return cents;
}

export function calculateRate(tuitionCents, semesterDurationMs) {
  if (!Number.isSafeInteger(tuitionCents) || tuitionCents < 1 || tuitionCents > 999999999 ||
      !Number.isSafeInteger(semesterDurationMs) || semesterDurationMs < 36000) {
    throw new Error('学期总学费或总上课时长无效，请重新输入。');
  }
  return tuitionCents / 100 / (semesterDurationMs / 1000);
}

export function parseCourseDuration(hours, minutes) {
  const hourText = String(hours).trim() || '0';
  const minuteText = String(minutes).trim() || '0';
  if (!/^\d+$/.test(hourText)) {
    throw Object.assign(new Error('小时须填写非负整数。'), { part: 'hours' });
  }
  if (!/^\d+$/.test(minuteText) || Number(minuteText) > 59) {
    throw Object.assign(new Error('分钟须填写 0 至 59 的整数。'), { part: 'minutes' });
  }
  const totalMinutes = Number(hourText) * 60 + Number(minuteText);
  if (!Number.isSafeInteger(totalMinutes) || totalMinutes > 1440) {
    throw Object.assign(new Error('单节课时长不能超过 24 小时。'), { part: 'hours' });
  }
  if (totalMinutes < 1) {
    throw Object.assign(new Error('课程时长须至少为 1 分钟。'), { part: 'minutes' });
  }
  return totalMinutes * 60000;
}

export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('请输入完整的日期和时间。');
  const [year, month, day, hour, minute, second] = match.slice(1).map(part => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hour, minute, Number(second));
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 ||
      date.getDate() !== day || date.getHours() !== hour ||
      date.getMinutes() !== minute || date.getSeconds() !== Number(second)) {
    throw new Error('该日期或本地时间不存在，请重新选择。');
  }
  return date.getTime();
}

export function validateSession(session) {
  if (!session ||
      !Number.isFinite(session.start) || !Number.isFinite(session.end) ||
      !Number.isFinite(new Date(session.start).getTime()) ||
      !Number.isFinite(new Date(session.end).getTime())) {
    throw new Error('课程数据无效，请重新输入。');
  }
  calculateRate(session.tuitionCents, session.semesterDurationMs);
  if (session.end <= session.start) throw new Error('结束时间必须晚于开始时间。跨午夜时请选择次日日期。');
  if (session.end - session.start > session.semesterDurationMs) {
    throw new Error('本节课时长不能超过学期总上课时长，请检查结束时间或总小时数。');
  }
  return session;
}

export function calculateSession(session, now) {
  validateSession(session);
  if (!Number.isFinite(now)) throw new Error('当前时间无效。');
  const duration = session.end - session.start;
  const elapsed = Math.min(duration, Math.max(0, now - session.start));
  const state = now < session.start ? 'waiting' : now < session.end ? 'live' : 'complete';
  return {
    state,
    progress: elapsed / duration,
    recovered: session.tuitionCents / 100 * (elapsed / session.semesterDurationMs),
    rate: calculateRate(session.tuitionCents, session.semesterDurationMs),
    remainingMs: state === 'waiting' ? session.start - now : Math.max(0, session.end - now),
    durationMs: duration,
  };
}

export function formatDuration(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return [hours, minutes, seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
}

export function localDateInput(timestamp) {
  const date = new Date(timestamp);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw new Error('请选择完整的日期。');
  return parseLocalDate(`${value}T00:00`);
}

export function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('请选择有效的上课时间。');
  return Number(match[1]) * 60 + Number(match[2]);
}

function calendarDay(timestamp) {
  const date = new Date(timestamp);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

function weekday(timestamp) {
  return (new Date(timestamp).getDay() + 6) % 7;
}

function occurrenceStart(start, dayOffset, minutes) {
  // Advance local calendar days before setting the clock, so weekly lessons
  // retain their local start time across daylight-saving changes.
  const date = new Date(start);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.getTime();
}

function courseSchedule(semester, course) {
  const startDate = course.startDate || semester.startDate;
  const endDate = course.endDate || semester.endDate;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) throw new Error(`“${course.name}”的结束日期不能早于开始日期。`);
  if (start < parseDate(semester.startDate) || end > parseDate(semester.endDate)) {
    throw new Error(`“${course.name}”的起止日期须在学期范围内。`);
  }
  const days = calendarDay(end) - calendarDay(start) + 1;
  const firstOffset = (course.weekday - weekday(start) + 7) % 7;
  const count = firstOffset < days ? Math.floor((days - firstOffset - 1) / 7) + 1 : 0;
  const firstDay = calendarDay(start) + firstOffset;
  const excludedIndices = new Set();
  if (course.excludedDates !== undefined) {
    if (!Array.isArray(course.excludedDates) || course.excludedDates.length > 1000) throw new Error(`“${course.name}”的停课日期格式无效。`);
    for (const date of course.excludedDates) {
      if (typeof date !== 'string') throw new Error('停课日期须使用 YYYY-MM-DD 格式。');
      const day = calendarDay(parseDate(date));
      const index = (day - firstDay) / 7;
      if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error(`“${course.name}”的停课日期须是课程范围内的上课日。`);
      excludedIndices.add(index);
    }
  }
  return { start, firstOffset, count, firstDay, lastDay: firstDay + (count - 1) * 7, excludedIndices, activeCount: count - excludedIndices.size };
}

export function semesterCalendar(startDate, endDate, now = Date.now()) {
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime())) throw new Error('当前时间无效。');
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const startDay = calendarDay(start);
  const endDay = calendarDay(end);
  const days = endDay - startDay + 1;
  if (days < 1) throw new Error('学期结束日期不能早于开始日期。');
  const today = calendarDay(now);
  const state = today < startDay ? 'waiting' : today > endDay ? 'complete' : 'live';
  return { days, weeks: Math.ceil(days / 7), currentWeek: state === 'live' ? Math.floor((today - startDay) / 7) + 1 : null, state };
}

function prepareSemester(semester, now = Date.now()) {
  if (!semester) throw new Error('学期数据无效。');
  const calendar = semesterCalendar(semester.startDate, semester.endDate, now);
  const courses = semester.weeklyCourses;
  if (!Array.isArray(courses)) throw new Error('每周课表数据无效。');
  if (!courses.length) throw new Error('请在每周课表中至少添加一节课。');
  let scheduledDuration = 0;
  const schedules = [];
  for (const course of courses) {
    if (!course || !Number.isInteger(course.weekday) || course.weekday < 0 || course.weekday > 6 ||
        typeof course.name !== 'string' || !course.name.trim() || course.name.length > 80 ||
        !Number.isSafeInteger(course.durationMs) || course.durationMs < 36000 || course.durationMs > 86400000) {
      throw new Error('请填写有效的课程名称与时长，每节课须在 0.01 至 24 小时之间。');
    }
    const minutes = parseTime(course.startTime);
    const schedule = { ...courseSchedule(semester, course), minutes,
      name: course.name, durationMs: course.durationMs,
      weekStart: course.weekday * 86400000 + minutes * 60000 };
    schedules.push(schedule);
    scheduledDuration += schedule.activeCount * course.durationMs;
  }
  // Avoid ambiguous automatic selection of simultaneous lessons, including Sunday rollover.
  const weekMs = 7 * 86400000;
  for (let i = 0; i < courses.length; i++) {
    if (!schedules[i].activeCount) continue;
    const aStart = schedules[i].weekStart;
    for (let j = i + 1; j < courses.length; j++) {
      if (!schedules[j].activeCount) continue;
      const bStart = schedules[j].weekStart;
      for (const shift of [-weekMs, 0, weekMs]) {
        if (aStart < bStart + shift + courses[j].durationMs && bStart + shift < aStart + courses[i].durationMs) {
          // Conflict only when both weekly entries actually occur on these dates.
          const dayOffset = courses[j].weekday - courses[i].weekday + shift / 86400000;
          const firstPossible = Math.max(schedules[i].firstDay, schedules[j].firstDay - dayOffset);
          const lastPossible = Math.min(schedules[i].lastDay, schedules[j].lastDay - dayOffset);
          const firstOccurrence = schedules[i].firstDay + Math.ceil((firstPossible - schedules[i].firstDay) / 7) * 7;
          for (let day = firstOccurrence; day <= lastPossible; day += 7) {
            if (!schedules[i].excludedIndices.has((day - schedules[i].firstDay) / 7) &&
                !schedules[j].excludedIndices.has((day + dayOffset - schedules[j].firstDay) / 7)) {
              throw new Error(`“${courses[i].name}”和“${courses[j].name}”的上课时间重叠，请检查课表。`);
            }
          }
        }
      }
    }
  }
  const semesterDurationMs = scheduledDuration;
  if (!semesterDurationMs) throw new Error('学期日期范围内没有这些课程，请检查日期和星期。');
  const rate = calculateRate(semester.tuitionCents, semesterDurationMs);
  return { schedules, tuitionCents: semester.tuitionCents,
    summary: { ...calendar, semesterDurationMs, rate } };
}

export function calculateSemester(semester, now = Date.now()) {
  return prepareSemester(semester, now).summary;
}

function recoverSemester({ schedules, tuitionCents, summary: { semesterDurationMs } }, now) {
  let completedDurationMs = 0;
  let completedSessions = 0;
  let nextCompletionAt = Infinity;
  for (const { start, firstOffset, count, excludedIndices, minutes, durationMs } of schedules) {
    const endAt = index => occurrenceStart(start, firstOffset + index * 7, minutes) + durationMs;
    // Find the first unfinished occurrence without scanning every week.
    // Build each start in local calendar time, matching automatic selection.
    let low = 0;
    let high = count;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (endAt(middle) <= now) low = middle + 1;
      else high = middle;
    }
    const completed = low - [...excludedIndices].filter(index => index < low).length;
    completedSessions += completed;
    completedDurationMs += completed * durationMs;
    while (excludedIndices.has(low)) low++;
    if (low < count) nextCompletionAt = Math.min(nextCompletionAt, endAt(low));
  }
  return {
    // Round only for display, so per-lesson fractions of a cent do not drift.
    recovered: tuitionCents / 100 * (completedDurationMs / semesterDurationMs),
    completedSessions,
    nextCompletionAt,
  };
}

export function calculateSemesterRecovery(semester, now = Date.now()) {
  return recoverSemester(prepareSemester(semester, now), now);
}

function selectScheduledSession({ schedules, tuitionCents, summary }, now) {
  let live = null;
  let next = null;
  let previous = null;
  for (const { start, firstOffset, count, excludedIndices, activeCount, minutes, name, durationMs } of schedules) {
    if (!activeCount) continue;
    const todayOffset = calendarDay(now) - calendarDay(start);
    const nearest = Math.floor((todayOffset - firstOffset) / 7);
    const seek = (index, direction) => {
      index = Math.min(count - 1, Math.max(0, index));
      while (excludedIndices.has(index)) index += direction;
      return index >= 0 && index < count ? index : null;
    };
    const candidates = new Set([seek(nearest - 1, -1), seek(nearest, -1), seek(nearest, 1), seek(nearest + 1, 1)]);
    for (const index of candidates) {
      if (index === null) continue;
      const startAt = occurrenceStart(start, firstOffset + index * 7, minutes);
      const lesson = {
        name,
        tuitionCents,
        semesterDurationMs: summary.semesterDurationMs,
        start: startAt,
        end: startAt + durationMs,
      };
      if (now >= lesson.start && now < lesson.end) {
        if (!live || lesson.start < live.start) live = lesson;
      } else if (now < lesson.start) {
        if (!next || lesson.start < next.start) next = lesson;
      } else if (!previous || lesson.end > previous.end) previous = lesson;
    }
  }
  return live || next || previous;
}

export function findScheduledSession(semester, now) {
  return selectScheduledSession(prepareSemester(semester, now), now);
}

// A timeline owns an immutable schedule snapshot and its time-dependent caches.
// Recreate it when configuration or device time zone changes (including resume).
export function createSemesterTimeline(semester) {
  const prepared = prepareSemester(semester);
  const { startDate, endDate } = semester;
  let session = null;
  let recovery = null;
  let refreshAt = -Infinity;
  let lastNow = Infinity;
  return (now = Date.now()) => {
    const calendar = semesterCalendar(startDate, endDate, now);
    if (now < lastNow || now >= refreshAt) {
      session = Object.freeze(selectScheduledSession(prepared, now));
      refreshAt = session && now < session.end ? session.end : Infinity;
    }
    if (!recovery || now < lastNow || now >= recovery.nextCompletionAt) {
      recovery = Object.freeze(recoverSemester(prepared, now));
    }
    lastNow = now;
    return { calendar, session, recovery };
  };
}
