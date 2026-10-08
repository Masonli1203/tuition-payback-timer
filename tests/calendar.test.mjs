import test from 'node:test';
import assert from 'node:assert/strict';
import { readCalendar } from '../calendar.mjs';
process.env.TZ = 'America/New_York';
const event = (extra = '', start = '20261022T093000', end = '20261022T120000') => `BEGIN:VEVENT\nUID:course-1\nSUMMARY:设计工坊\nDTSTART;TZID=America/New_York:${start}\nDTEND;TZID=America/New_York:${end}\n${extra}\nEND:VEVENT`;
const calendar = body => `BEGIN:VCALENDAR\nVERSION:2.0\n${body}\nEND:VCALENDAR`;

test('ICS 每周 UNTIL 保留独立日期和停课，忽略未命中课次的假期标记', () => {
  const parsed = readCalendar(calendar(event('RRULE:FREQ=WEEKLY;UNTIL=20261210T120000;BYDAY=TH\nEXDATE;TZID=America/New_York:20261126T093000,20261127T093000')));
  assert.equal(parsed.semesterDurationMs / 3600000, 17.5);
  assert.equal(parsed.exclusionCount, 1);
  assert.equal(parsed.draft.tuitionCents, null);
  assert.deepEqual(parsed.draft.weeklyCourses[0].excludedDates, ['2026-11-26']);
  assert.equal(parsed.draft.endDate, '2026-12-10');
});
test('COUNT 在排除停课前计算，多个星期拆分后保持确切首末课日', () => {
  const parsed = readCalendar(calendar(event('RRULE:FREQ=WEEKLY;COUNT=5;BYDAY=MO,WE;INTERVAL=1;WKST=SU\nEXDATE;TZID=America/New_York:20261007T093000', '20261005T093000', '20261005T120000')));
  assert.equal(parsed.semesterDurationMs / 3600000, 10);
  assert.equal(parsed.courseCount, 2);
  assert.deepEqual(parsed.draft.weeklyCourses.map(course => [course.startDate, course.endDate]), [['2026-10-05', '2026-10-19'], ['2026-10-07', '2026-10-14']]);
});
test('UTC UNTIL 在夏令时结束后仍正确包含本地边界课次', () => {
  const parsed = readCalendar(calendar(event('RRULE:FREQ=WEEKLY;UNTIL=20261105T143000Z;BYDAY=TH')));
  assert.equal(parsed.semesterDurationMs / 3600000, 7.5);
  assert.equal(parsed.draft.endDate, '2026-11-05');
});
test('单次 UTC 事件转换为设备日期时间，跨午夜课保留真实时长', () => {
  const parsed = readCalendar(calendar('BEGIN:VEVENT\nSUMMARY:Make-up\nDTSTART:20261106T043000Z\nDTEND:20261106T060000Z\nEND:VEVENT'));
  assert.deepEqual(parsed.draft.weeklyCourses[0], {name:'Make-up',weekday:3,startTime:'23:30',durationMs:5400000,startDate:'2026-11-05',endDate:'2026-11-05'});
});
test('折行、文本转义与提醒组件不会污染课程属性', () => {
  const body = event('RRULE:FREQ=WEEKLY;COUNT=1\nBEGIN:VALARM\nSUMMARY:Reminder\nEND:VALARM').replace('SUMMARY:设计工坊', 'SUMMARY:Intro\\, Fab\n rication');
  assert.equal(readCalendar(calendar(body).replaceAll('\n', '\r\n')).draft.weeklyCourses[0].name, 'Intro, Fabrication');
});
test('损坏结构、重复版本事件、无限或不支持的重复规则拒绝整个文件', () => {
  const invalid = [calendar(event()).replace('END:VEVENT', ''), calendar(`${event()}\n${event()}`),
    calendar(event()).replace('VERSION:2.0','VERSION:2.0\nMETHOD:CANCEL'),
    calendar(event('RRULE:FREQ=WEEKLY')), calendar(event('RRULE:FREQ=WEEKLY;COUNT=3;INTERVAL=2')),
    calendar(event('RRULE:FREQ=MONTHLY;COUNT=3')), calendar(event('RECURRENCE-ID:20261022T093000')),
    calendar(event('RDATE:20261029T093000')), calendar(event('RRULE:FREQ=WEEKLY;COUNT=3;UNTIL=20261210T120000'))];
  for (const text of invalid) assert.throws(() => readCalendar(text));
});
test('错时区、全天事件、无效日期和秒级时间拒绝，不能默默改变计费', () => {
  for (const text of [calendar(event()).replaceAll('America/New_York','America/Chicago'),
    calendar(event()).replace('20261022T093000','20261022'),
    calendar(event()).replace('20261022T093000','20260230T093000'),
    calendar(event()).replace('20261022T093000','20261022T093005')]) assert.throws(() => readCalendar(text));
});
