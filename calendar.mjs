import { parseLocalDate, localDateInput, calculateSemester } from './core.mjs';
import { maximumFileBytes } from './configuration.mjs';

const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const dateLabel = time => localDateInput(time).slice(0, 10);
const weekdayOf = time => (new Date(time).getDay() + 6) % 7;

function property(line) {
  // A colon inside a quoted parameter is not the value separator.
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    if (line[i] === ':' && !quoted) { colon = i; break; }
  }
  if (colon < 1) throw new Error('ICS 属性格式损坏。');
  const [name, ...parameters] = line.slice(0, colon).split(';');
  const params = {};
  for (const parameter of parameters) {
    const equals = parameter.indexOf('=');
    if (equals < 1) throw new Error('ICS 参数格式损坏。');
    const key = parameter.slice(0, equals).toUpperCase();
    if (key in params) throw new Error('ICS 参数重复。');
    params[key] = parameter.slice(equals + 1).replace(/^"(.*)"$/, '$1');
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function eventsIn(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > maximumFileBytes) throw new Error('ICS 文件最多支持 1 MB。');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n').filter(Boolean);
  const stack = [];
  const events = [];
  let event;
  let calendarCount = 0;
  for (const line of lines) {
    const item = property(line);
    if (item.name === 'BEGIN') {
      const component = item.value.toUpperCase();
      if (component === 'VCALENDAR') {
        if (stack.length || ++calendarCount !== 1) throw new Error('请选择单个完整的 ICS 日历文件。');
      } else if (!stack.length) throw new Error('ICS 缺少 VCALENDAR。');
      if (component === 'VEVENT') {
        if (stack.at(-1) !== 'VCALENDAR') throw new Error('ICS 课程事件层级无效。');
        event = [];
        events.push(event);
        if (events.length > 500) throw new Error('最多支持 500 个日历事件。');
      }
      stack.push(component);
    } else if (item.name === 'END') {
      if (stack.pop() !== item.value.toUpperCase()) throw new Error('ICS 文件结构损坏或不完整。');
    } else if (!stack.length) throw new Error('ICS 日历之外包含无效内容。');
    else if (stack.at(-1) === 'VEVENT') event.push(item);
    else if (stack.at(-1) === 'VCALENDAR' && item.name === 'VERSION' && item.value !== '2.0') throw new Error('仅支持 ICS 2.0 日历。');
    else if (stack.at(-1) === 'VCALENDAR' && item.name === 'METHOD' && item.value === 'CANCEL') throw new Error('该文件是取消通知，不是完整课表。');
  }
  if (stack.length || calendarCount !== 1 || !events.length) throw new Error('ICS 文件不完整或没有课程事件。');
  return events;
}

function dateTime(item, value = item?.value) {
  if (!item || item.params.VALUE && item.params.VALUE !== 'DATE-TIME' || !/^\d{8}T\d{6}Z?$/.test(value ?? '')) throw new Error('仅支持有明确开始和结束时间的课程，不支持全天事件。');
  const zone = item.params.TZID;
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (Object.keys(item.params).some(key => !['TZID', 'VALUE'].includes(key))) throw new Error('课程日期含不支持的参数。');
  if (zone && (zone !== localZone || value.endsWith('Z'))) throw new Error(`日历时区 ${zone} 与设备时区 ${localZone} 不一致，请使用相同课程时区后导入。`);
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
  if (!value.endsWith('Z')) return parseLocalDate(date);
  const time = Date.parse(`${date}Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 19) !== date) throw new Error('ICS 日期或时间无效。');
  return time;
}

export function readCalendar(text) {
  const events = eventsIn(text);
  const weeklyCourses = [];
  const uids = new Set();
  let exclusionCount = 0;
  for (const properties of events) {
    const all = name => properties.filter(item => item.name === name);
    const one = name => {
      const values = all(name);
      if (values.length > 1) throw new Error(`ICS ${name} 重复，不能确定课程配置。`);
      return values[0];
    };
    if (one('RDATE') || one('EXRULE') || one('RECURRENCE-ID') || one('STATUS')?.value === 'CANCELLED') throw new Error('日历含额外课次、单独改期或取消事件，当前无法完整导入；原配置未改变。');
    const uid = one('UID')?.value;
    if (uid && uids.has(uid)) throw new Error('日历含重复或多个版本的课程事件，请重新导出完整课表。');
    if (uid) uids.add(uid);
    const name = one('SUMMARY')?.value.replace(/\\([nN,;\\])/g, (_, escaped) => /n/i.test(escaped) ? ' ' : escaped).trim();
    if (!name || name.length > 80) throw new Error('课程缺少名称，或名称超过 80 个字符。');
    const startItem = one('DTSTART');
    const endItem = one('DTEND');
    if (one('DURATION')) throw new Error('课程须包含明确的 DTEND 结束时间。');
    const start = dateTime(startItem);
    const end = dateTime(endItem);
    if (new Date(start).getSeconds() || new Date(end).getSeconds()) throw new Error('课程时间须精确到整分钟。');
    const durationMs = end - start;
    if (durationMs < 60000 || durationMs > 86400000 || durationMs % 60000) throw new Error('单节课程时长须为 1 分钟至 24 小时。');
    const ruleItem = one('RRULE');
    let days = [weekdayOf(start)];
    let until = start;
    let count;
    if (ruleItem) {
      if (startItem.value.endsWith('Z')) throw new Error('每周课程须使用本地时间或与设备一致的 TZID，避免夏令时导致课表偏移。');
      const rule = {};
      for (const part of ruleItem.value.split(';')) {
        const [key, value, extra] = part.split('=');
        if (!key || !value || extra || key in rule) throw new Error('ICS 重复规则格式无效。');
        rule[key] = value;
      }
      if (rule.FREQ !== 'WEEKLY' || rule.INTERVAL && rule.INTERVAL !== '1' ||
          Object.keys(rule).some(key => !['FREQ', 'BYDAY', 'UNTIL', 'COUNT', 'INTERVAL', 'WKST'].includes(key)) ||
          rule.WKST && !weekdays.includes(rule.WKST) || !!rule.UNTIL === !!rule.COUNT) throw new Error('目前支持每周重复课程，须有 UNTIL 结束时间或 COUNT 次数；不支持隔周、月度或无限重复。');
      const codes = rule.BYDAY?.split(',') ?? [weekdays[weekdayOf(start)]];
      if (codes.some(code => !weekdays.includes(code)) || new Set(codes).size !== codes.length) throw new Error('每周课程的 BYDAY 星期规则无效。');
      days = codes.map(code => weekdays.indexOf(code));
      if (!days.includes(weekdayOf(start))) throw new Error('课程首日与重复星期不一致。');
      if (rule.COUNT) {
        if (!/^[1-9]\d*$/.test(rule.COUNT) || Number(rule.COUNT) > 2000) throw new Error('课程重复次数须为 1 至 2000。');
        count = Number(rule.COUNT);
        until = Infinity;
      } else {
        until = dateTime({params: rule.UNTIL.endsWith('Z') ? {} : startItem.params, value: rule.UNTIL});
        if (until < start) throw new Error('课程重复结束时间早于首次上课。');
      }
    }
    const occurrences = [];
    const cursor = new Date(start);
    for (let scanned = 0; cursor.getTime() <= until && (!count || occurrences.length < count); scanned++) {
      if (scanned >= 14000 || occurrences.length >= 2000) throw new Error('课程日期跨度或课次数过大。');
      if (days.includes(weekdayOf(cursor.getTime()))) occurrences.push(cursor.getTime());
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(new Date(start).getHours(), new Date(start).getMinutes(), 0, 0);
      if (!ruleItem) break;
    }
    const excluded = new Set(all('EXDATE').flatMap(item => item.value.split(',').map(value => dateTime(item, value))));
    for (const weekday of days) {
      const times = occurrences.filter(time => weekdayOf(time) === weekday);
      if (!times.length) continue;
      const excludedDates = times.filter(time => excluded.has(time)).map(dateLabel);
      exclusionCount += excludedDates.length;
      weeklyCourses.push({name, weekday, startTime: localDateInput(start).slice(11, 16), durationMs,
        startDate: dateLabel(times[0]), endDate: dateLabel(times.at(-1)),
        ...(excludedDates.length ? {excludedDates} : {})});
      if (weeklyCourses.length > 500) throw new Error('最多支持 500 个课表条目。');
    }
  }
  const draft = {tuitionCents: null, startDate: weeklyCourses.map(course => course.startDate).sort()[0],
    endDate: weeklyCourses.map(course => course.endDate).sort().at(-1), weeklyCourses, demo: false};
  const summary = calculateSemester({...draft, tuitionCents: 100});
  return {kind: 'calendar', draft, eventCount: events.length, courseCount: weeklyCourses.length,
    semesterDurationMs: summary.semesterDurationMs, exclusionCount,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone};
}
