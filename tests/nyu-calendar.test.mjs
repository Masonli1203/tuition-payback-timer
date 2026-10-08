import test from 'node:test';
import assert from 'node:assert/strict';
import { readNyuCalendar } from '../scripts/convert-nyu-calendar.mjs';
import { calculateSemester } from '../core.mjs';

const text = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:20261022T093000\r\nDTEND;TZID=America/New_York:20261022T120000\r\nRRULE:FREQ=WEEKLY;UNTIL=20261210T120000;BYDAY=TH\r\nEXDATE;TZID=America/New_York:20261126T093000\r\nEXDATE;TZID=America/New_York:20261127T093000\r\nSUMMARY:Design Work\r\n shop\r\nEND:VEVENT\r\nEND:VCALENDAR';
test('NYU 每周日历保留课程日期、时长并只排除实际出现的 EXDATE', () => {
  const semester = readNyuCalendar(text, '36000');
  assert.equal(semester.tuitionCents, 3600000);
  assert.equal(semester.weeklyCourses[0].name, 'Design Workshop');
  assert.equal(semester.weeklyCourses[0].startDate, '2026-10-22');
  assert.equal(semester.weeklyCourses[0].endDate, '2026-12-10');
  assert.deepEqual(semester.weeklyCourses[0].excludedDates, ['2026-11-26']);
  assert.equal(calculateSemester(semester).semesterDurationMs / 3600000, 17.5);
});
test('不支持的日历规则和时区明确拒绝，不能静默丢失课次', () => {
  for (const invalid of [text.replace('FREQ=WEEKLY', 'FREQ=DAILY'), text.replace('BYDAY=TH', 'BYDAY=TH;INTERVAL=2'), text.replaceAll('America/New_York', 'America/Chicago'), text.replace('20261022T093000', '20261022T093005')]) assert.throws(() => readNyuCalendar(invalid, '36000'));
});
