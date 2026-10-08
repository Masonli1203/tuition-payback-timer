import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSemester, calculateSemesterRecovery, findScheduledSession, parseLocalDate } from '../core.mjs';
import { configurationRecord, decodeConfiguration } from '../configuration.mjs';

const semester = { tuitionCents: 3600000, startDate: '2026-09-02', endDate: '2026-12-10', demo: false,
  weeklyCourses: [
    { name: '课程 A', weekday: 2, startTime: '15:20', durationMs: 9000000, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 B', weekday: 2, startTime: '09:30', durationMs: 9000000, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 C', weekday: 2, startTime: '12:20', durationMs: 9000000, startDate: '2026-09-02', endDate: '2026-12-09' },
    { name: '课程 D', weekday: 1, startTime: '12:20', durationMs: 9000000, startDate: '2026-09-08', endDate: '2026-12-08' },
    { name: '设计工坊', weekday: 3, startTime: '09:30', durationMs: 9000000, startDate: '2026-10-22', endDate: '2026-12-10', excludedDates: ['2026-11-26'] },
  ] };
const at = parseLocalDate;
test('五门示例课程排除停课日后为 165 小时，学期末回本全部学费', () => {
  assert.equal(calculateSemester(semester).semesterDurationMs / 3600000, 165);
  assert.equal(calculateSemester(semester).rate, 36000 / (165 * 3600));
  const before = calculateSemesterRecovery(semester, at('2026-11-26T09:00'));
  const after = calculateSemesterRecovery(semester, at('2026-11-26T12:00'));
  assert.deepEqual(before, after);
  assert.equal(calculateSemesterRecovery(semester, at('2026-12-10T12:00')).recovered, 36000);
  assert.equal(calculateSemesterRecovery(semester, at('2026-12-10T12:00')).completedSessions, 66);
});
test('自动选课跳过停课，连续停课不会丢失之前和之后的有效课程', () => {
  const only = { ...semester, weeklyCourses: [{ ...semester.weeklyCourses[4], excludedDates: ['2026-11-19', '2026-11-26', '2026-12-03'] }] };
  assert.equal(findScheduledSession(only, at('2026-11-26T10:00')).start, at('2026-12-10T09:30'));
  const recovery = calculateSemesterRecovery(only, at('2026-11-26T10:00'));
  assert.equal(recovery.completedSessions, 4);
  assert.equal(recovery.nextCompletionAt, at('2026-12-10T12:00'));
  assert.equal(findScheduledSession(only, at('2026-12-11T10:00')).start, at('2026-12-10T09:30'));
});
test('补课未定时保持排除；删除停课日期后可重新计入原课次', () => {
  const resumed = structuredClone(semester);
  delete resumed.weeklyCourses[4].excludedDates;
  assert.equal(calculateSemester(resumed).semesterDurationMs / 3600000, 167.5);
});
test('日期格式、范围、星期和全停课配置经过校验', () => {
  for (const excludedDates of ['bad', [null], ['2026-11-27'], ['2027-01-01'], ['2026-02-30']]) {
    assert.throws(() => calculateSemester({ ...semester, weeklyCourses: [{ ...semester.weeklyCourses[4], excludedDates }] }));
  }
  assert.throws(() => calculateSemester({ ...semester, startDate: '2026-11-26', endDate: '2026-11-26', weeklyCourses: [{ name: '停课', weekday: 3, startTime: '09:00', durationMs: 3600000, excludedDates: ['2026-11-26'] }] }));
});
test('仅停课日重叠可通过校验，未停课日重叠仍被拒绝，包括跨午夜', () => {
  const base = { tuitionCents: 100, startDate: '2026-11-22', endDate: '2026-11-23' };
  const night = { name: '周日', weekday: 6, startTime: '23:00', durationMs: 7200000, excludedDates: ['2026-11-22'] };
  const morning = { name: '周一', weekday: 0, startTime: '00:30', durationMs: 3600000 };
  assert.doesNotThrow(() => calculateSemester({ ...base, weeklyCourses: [night, morning] }));
  assert.throws(() => calculateSemester({ ...base, weeklyCourses: [{ ...night, excludedDates: [] }, morning] }));
});
test('配置版本 4 保留停课；版本 3 只读迁移；旧格式带停课字段被拒绝', () => {
  const record = configurationRecord(semester);
  assert.equal(record.version, 4);
  assert.deepEqual(decodeConfiguration(JSON.stringify(record)).semester, semester);
  assert.throws(() => decodeConfiguration(JSON.stringify({ ...record, version: 3 })), /版本 4/);
  const old = structuredClone(semester); delete old.weeklyCourses[4].excludedDates;
  assert.equal(decodeConfiguration(JSON.stringify({ version: 3, semester: old })).record.version, 4);
});
