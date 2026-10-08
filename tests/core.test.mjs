import test from 'node:test';
import assert from 'node:assert/strict';
import { parseValue, parseCourseDuration, calculateRate, parseDate, parseTime, semesterCalendar, calculateSemester, findScheduledSession, parseLocalDate, validateSession, calculateSession, formatDuration, localDateInput } from '../core.mjs';

const start = new Date(2026, 9, 7, 10).getTime();
const session = { tuitionCents: 4285700, semesterDurationMs: 900000000, start, end: start + 9_000_000 };

test('currency is parsed into exact integer cents, rejecting unsupported values', () => {
  assert.equal(parseValue('428.57'), 42857);
  assert.equal(parseValue('0.01'), 1);
  assert.equal(parseValue(' 12.3 '), 1230);
  assert.equal(parseValue('9999999.99'), 999999999);
  for (const value of ['', '0', '-1', 'Infinity', '1e3', '1.234', 'NaN', '10000000', '1,000', 'abc']) {
    assert.throws(() => parseValue(value), undefined, value);
  }
});

test('waiting, exact start, midpoint, exact end, and long after class', () => {
  const waiting = calculateSession(session, start - 30000);
  assert.equal(waiting.state, 'waiting');
  assert.equal(waiting.recovered, 0);
  assert.equal(waiting.remainingMs, 30000);
  const beginning = calculateSession(session, start);
  assert.equal(beginning.state, 'live');
  assert.equal(beginning.recovered, 0);
  const middle = calculateSession(session, start + 4500000);
  assert.equal(middle.recovered, 214.285);
  assert.equal(middle.progress, 0.5);
  assert.equal(middle.remainingMs, 4500000);
  assert.ok(Math.abs(middle.rate - 428.57 / 9000) < 1e-12);
  for (const now of [session.end, session.end + 86400000]) {
    const view = calculateSession(session, now);
    assert.equal(view.state, 'complete');
    assert.equal(view.recovered, 428.57);
    assert.equal(view.remainingMs, 0);
    assert.equal(view.progress, 1);
  }
});

test('subsecond growth uses wall time and catches up after suspended execution', () => {
  const a = calculateSession(session, start + 125);
  const b = calculateSession(session, start + 250);
  assert.ok(b.recovered > a.recovered);
  assert.ok(Math.abs(b.recovered - a.recovered * 2) < 1e-12);
  assert.equal(calculateSession(session, start + 7200000).progress, 0.8);
});

test('invalid intervals and malformed stored sessions are rejected', () => {
  for (const value of [null, {}, { ...session, end: start }, { ...session, end: start - 1 },
    { ...session, start: NaN }, { ...session, end: Infinity }, { ...session, start: 1e20 },
    { ...session, tuitionCents: 0 }, { ...session, tuitionCents: 0.5 }]) {
    assert.throws(() => validateSession(value));
  }
  assert.throws(() => calculateSession(session, NaN));
});

test('explicit dates support midnight rollover, seconds and local-time round trips', () => {
  const begin = parseLocalDate('2026-10-07T23:30');
  const end = parseLocalDate('2026-10-08T01:00:00');
  assert.equal(end - begin, 90 * 60000);
  const view = calculateSession({ tuitionCents: 9000, semesterDurationMs: end - begin, start: begin, end }, begin + 45 * 60000);
  assert.equal(view.recovered, 45);
  assert.equal(parseLocalDate(localDateInput(start + 15000)), start + 15000);
  for (const value of ['', '2026-02-30T10:00', '2026-13-01T10:00', '2026-10-07T24:01', 'bad']) {
    assert.throws(() => parseLocalDate(value));
  }
});

test('countdown rounds up partial seconds and never shows negative time', () => {
  assert.equal(formatDuration(1), '00:00:01');
  assert.equal(formatDuration(3600001), '01:00:01');
  assert.equal(formatDuration(9000000), '02:30:00');
  assert.equal(formatDuration(-1), '00:00:00');
  assert.equal(formatDuration(0), '00:00:00');
});

test('invalid teaching durations cannot produce a rate', () => {
  for (const duration of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calculateRate(2400000, duration));
});

test('the semester determines the rate, independent of the current lesson duration', () => {
  const base = { tuitionCents: 2400000, semesterDurationMs: (400 * 3600000), start };
  const short = { ...base, end: start + (1 * 3600000) };
  const long = { ...base, end: start + (2.5 * 3600000) };
  assert.equal(calculateSession(short, start + 1800000).recovered, 30);
  assert.equal(calculateSession(long, start + 1800000).recovered, 30);
  assert.equal(calculateSession(short, start).rate, calculateSession(long, start).rate);
  assert.equal(calculateSession(long, long.end).recovered, 150);
  assert.equal(calculateSession(long, long.end + 86400000).recovered, 150);
  assert.throws(() => validateSession({ ...long, semesterDurationMs: (1 * 3600000) }));
  assert.throws(() => validateSession({ valueCents: 42857, start, end: long.end }));
});

const semester = {
  tuitionCents: 2400000,
  startDate: '2026-09-02',
  endDate: '2026-12-10',
  weeklyCourses: [
    { name: '经济学', weekday: 0, startTime: '09:00', durationMs: (1 * 3600000) },
    { name: '统计学', weekday: 2, startTime: '10:00', durationMs: (1.5 * 3600000) },
    { name: '金融学', weekday: 3, startTime: '14:00', durationMs: (2 * 3600000) },
  ],
};

test('semester weeks count inclusive dates from the first day with clear outside states', () => {
  const summary = semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-10-07T12:00'));
  assert.equal(summary.days, 100);
  assert.equal(summary.weeks, 15);
  assert.equal(summary.currentWeek, 6);
  assert.equal(semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-09-08T23:59')).currentWeek, 1);
  assert.equal(semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-09-09T00:00')).currentWeek, 2);
  assert.equal(semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-12-10T23:59')).currentWeek, 15);
  assert.equal(semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-09-01T12:00')).state, 'waiting');
  assert.equal(semesterCalendar('2026-09-02', '2026-12-10', parseLocalDate('2026-12-11T00:00')).currentWeek, null);
  assert.throws(() => semesterCalendar('2026-12-10', '2026-09-02'));
  assert.throws(() => parseDate('2026-02-30'));
  assert.throws(() => parseTime('24:00'));
  assert.throws(() => parseTime('09:60'));
});

test('teaching hours count the actual weekdays in partial first and final weeks', () => {
  const summary = calculateSemester(semester, start);
  // 14 Mondays, 15 Wednesdays, and 15 Thursdays, rather than 15 full weeks.
  assert.equal(summary.semesterDurationMs, (66.5 * 3600000));
  assert.equal(summary.rate, 24000 / (66.5 * 3600));
  const oneDay = { ...semester, startDate: '2026-09-02', endDate: '2026-09-02' };
  assert.equal(calculateSemester(oneDay, start).semesterDurationMs, (1.5 * 3600000));
  assert.throws(() => calculateSemester({ ...oneDay, weeklyCourses: [semester.weeklyCourses[0]] }));
  assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [] }));
});

test('automatic course selection chooses the live course, then the next, then the last', () => {
  const live = findScheduledSession(semester, parseLocalDate('2026-10-07T10:45'));
  assert.equal(live.name, '统计学');
  assert.equal(calculateSession(live, parseLocalDate('2026-10-07T10:45')).progress, 0.5);
  assert.equal(findScheduledSession(semester, parseLocalDate('2026-10-07T11:30')).name, '金融学');
  assert.equal(findScheduledSession(semester, parseLocalDate('2026-09-01T12:00')).start, parseLocalDate('2026-09-02T10:00'));
  const last = findScheduledSession(semester, parseLocalDate('2026-12-11T12:00'));
  assert.equal(last.name, '金融学');
  assert.equal(last.start, parseLocalDate('2026-12-10T14:00'));
  assert.equal(calculateSession(last, parseLocalDate('2026-12-11T12:00')).state, 'complete');
});

test('overlapping lessons are rejected but adjacent lessons can switch at the boundary', () => {
  const first = { name: '第一节', weekday: 0, startTime: '09:00', durationMs: (1 * 3600000) };
  const second = { name: '第二节', weekday: 0, startTime: '09:30', durationMs: (1 * 3600000) };
  assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [first, second] }));
  const adjacent = { ...semester, weeklyCourses: [first, { ...second, startTime: '10:00' }] };
  assert.equal(findScheduledSession(adjacent, parseLocalDate('2026-10-05T10:00')).name, '第二节');
  assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [
    { ...first, weekday: 6, startTime: '23:00', durationMs: (2 * 3600000) },
    { ...second, startTime: '00:30' },
  ] }));
});

test('calendar weeks and wall-clock lesson starts survive the daylight-saving change', () => {
  const oldZone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const autumn = { ...semester, startDate: '2026-10-25', endDate: '2026-11-07', weeklyCourses: [
      { name: '周日课程', weekday: 6, startTime: '09:00', durationMs: (1 * 3600000) },
    ] };
    const afterChange = parseLocalDate('2026-11-01T09:30');
    const summary = calculateSemester(autumn, afterChange);
    assert.equal(summary.days, 14);
    assert.equal(summary.weeks, 2);
    assert.equal(summary.currentWeek, 2);
    assert.equal(summary.semesterDurationMs, (2 * 3600000));
    assert.equal(findScheduledSession(autumn, afterChange).start, parseLocalDate('2026-11-01T09:00'));
  } finally {
    if (oldZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldZone;
  }
});

test('overnight lessons remain active across the Sunday-to-Monday boundary', () => {
  const overnight = { ...semester, weeklyCourses: [
    { name: '夜间课程', weekday: 6, startTime: '23:00', durationMs: (2 * 3600000) },
  ] };
  const now = parseLocalDate('2026-10-05T00:30');
  const lesson = findScheduledSession(overnight, now);
  assert.equal(lesson.start, parseLocalDate('2026-10-04T23:00'));
  assert.equal(calculateSession(lesson, now).state, 'live');
  assert.equal(calculateSession(lesson, now).progress, 0.75);
});

test('malformed saved timetable data cannot produce a rate or an automatic lesson', () => {
  const course = semester.weeklyCourses[0];
  for (const bad of [null, { ...course, weekday: -1 }, { ...course, weekday: 7 },
    { ...course, weekday: 1.5 }, { ...course, name: '' }, { ...course, name: ' '.repeat(3) },
    { ...course, durationMs: 0 }, { ...course, durationMs: NaN },
    { ...course, durationMs: (25 * 3600000) }, { ...course, startTime: '25:00' }]) {
    assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [bad] }, start));
  }
  assert.throws(() => calculateSemester({ ...semester, tuitionCents: 0 }, start));
  assert.throws(() => calculateSemester({ ...semester, weeklyCourses: {} }, start));
  assert.throws(() => semesterCalendar(semester.startDate, semester.endDate, 1e20));
});

test('separate hours and minutes preserve exact lesson durations', () => {
  assert.equal(parseCourseDuration('2', '50'), 170 * 60000);
  assert.equal(parseCourseDuration('0', '50'), 50 * 60000);
  assert.equal(parseCourseDuration('', '50'), 50 * 60000);
  assert.equal(parseCourseDuration('2', ''), 120 * 60000);
  assert.equal(parseCourseDuration('24', '0'), 1440 * 60000);
  for (const [hours, minutes] of [['2.83', '0'], ['-1', '30'], ['1', '60'], ['1', '-1'], ['1', '1.5'], ['', ''], ['0', '0'], ['24', '1'], ['Infinity', '0'], ['99999999999999999', '0']]) {
    assert.throws(() => parseCourseDuration(hours, minutes));
  }
  const exact = { ...semester, weeklyCourses: [{ name: '长课', weekday: 2, startTime: '09:30', durationMs: parseCourseDuration('2', '50') }] };
  assert.equal(calculateSemester(exact, start).semesterDurationMs, 15 * 170 * 60000);
  assert.equal(calculateSemester(exact, start).semesterDurationMs / 3600000, 42.5);
});

test('a week-eight course counts only its eight actual Thursday occurrences', () => {
  const fabrication = { ...semester, weeklyCourses: [{ name: '设计工坊', weekday: 3, startTime: '09:30', durationMs: parseCourseDuration('2', '30'), startDate: '2026-10-22', endDate: '2026-12-10' }] };
  assert.equal(semesterCalendar(semester.startDate, semester.endDate, parseLocalDate('2026-10-22T09:30')).currentWeek, 8);
  assert.equal(calculateSemester(fabrication, start).semesterDurationMs, (20 * 3600000));
  const next = findScheduledSession(fabrication, parseLocalDate('2026-10-15T10:00'));
  assert.equal(next.start, parseLocalDate('2026-10-22T09:30'));
  assert.equal(calculateSession(next, parseLocalDate('2026-10-15T10:00')).state, 'waiting');
  const first = findScheduledSession(fabrication, parseLocalDate('2026-10-22T10:45'));
  assert.equal(first.start, parseLocalDate('2026-10-22T09:30'));
  assert.equal(calculateSession(first, parseLocalDate('2026-10-22T10:45')).progress, 0.5);
  const last = findScheduledSession(fabrication, parseLocalDate('2026-12-17T10:00'));
  assert.equal(last.start, parseLocalDate('2026-12-10T09:30'));
  assert.equal(calculateSession(last, parseLocalDate('2026-12-17T10:00')).state, 'complete');
});

test('the supplied five-course timetable totals 167.5 hours with the late-start class', () => {
  const durationMs = parseCourseDuration('2', '30');
  const supplied = { ...semester, weeklyCourses: [
    { name: '课程 A', weekday: 2, startTime: '15:20', durationMs, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 B', weekday: 2, startTime: '09:30', durationMs, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 C', weekday: 2, startTime: '12:20', durationMs, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 D', weekday: 1, startTime: '12:20', durationMs, startDate: '2026-09-08', endDate: '2026-12-08' },
    { name: '设计工坊', weekday: 3, startTime: '09:30', durationMs, startDate: '2026-10-22', endDate: '2026-12-10' },
  ] };
  const summary = calculateSemester(supplied, start);
  assert.equal(summary.semesterDurationMs / 3600000, 167.5);
  assert.equal(summary.rate, 24000 / (167.5 * 3600));
  const next = findScheduledSession(supplied, parseLocalDate('2026-10-07T17:50'));
  assert.equal(next.name, '课程 D');
  assert.equal(next.start, parseLocalDate('2026-10-13T12:20'));
});

test('early-ending courses stop recurring and blank dates retain existing behavior', () => {
  const early = { ...semester, weeklyCourses: [{ ...semester.weeklyCourses[1], endDate: '2026-10-14' }] };
  assert.equal(calculateSemester(early, start).semesterDurationMs, (10.5 * 3600000));
  assert.equal(findScheduledSession(early, parseLocalDate('2026-10-21T10:00')).start, parseLocalDate('2026-10-14T10:00'));
  const blanks = { ...semester, weeklyCourses: semester.weeklyCourses.map(course => ({ ...course, startDate: '', endDate: '' })) };
  assert.deepEqual(calculateSemester(blanks, start), calculateSemester(semester, start));
});

test('invalid or out-of-semester course dates cannot be saved', () => {
  const course = semester.weeklyCourses[0];
  for (const range of [
    { startDate: '2026-09-01' }, { endDate: '2026-12-11' },
    { startDate: '2026-10-22', endDate: '2026-10-21' },
    { startDate: '2026-02-30' }, { endDate: 'bad' },
  ]) assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [{ ...course, ...range }] }, start));
});

test('identical weekly slots are allowed in distinct course date ranges', () => {
  const first = { name: '前半学期', weekday: 2, startTime: '09:30', durationMs: (2.5 * 3600000), endDate: '2026-10-21' };
  const second = { ...first, name: '后半学期', startDate: '2026-10-22', endDate: '2026-12-10' };
  const split = { ...semester, weeklyCourses: [first, second] };
  assert.equal(calculateSemester(split, start).semesterDurationMs, (37.5 * 3600000));
  assert.equal(findScheduledSession(split, parseLocalDate('2026-10-21T10:00')).name, '前半学期');
  assert.equal(findScheduledSession(split, parseLocalDate('2026-10-28T10:00')).name, '后半学期');
  assert.throws(() => calculateSemester({ ...split, weeklyCourses: [first, { ...second, startDate: '2026-10-21' }] }, start));
});

test('overnight conflicts account for dates on both sides of midnight', () => {
  const sunday = { name: '周日夜课', weekday: 6, startTime: '23:00', durationMs: (2 * 3600000), endDate: '2026-10-04' };
  const monday = { name: '周一夜课', weekday: 0, startTime: '00:30', durationMs: (1 * 3600000), startDate: '2026-10-05' };
  assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [sunday, monday] }, start));
  assert.doesNotThrow(() => calculateSemester({ ...semester, weeklyCourses: [sunday, { ...monday, startDate: '2026-10-12' }] }, start));
});
