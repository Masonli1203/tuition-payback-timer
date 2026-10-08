import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSemesterRecovery, parseLocalDate, findScheduledSession, calculateSession } from '../core.mjs';

const hour = 3600000;
const semester = {
  tuitionCents: 60000, startDate: '2026-10-05', endDate: '2026-10-18',
  weeklyCourses: [
    { name: '周一', weekday: 0, startTime: '09:00', durationMs: hour },
    { name: '周三', weekday: 2, startTime: '10:00', durationMs: 2 * hour },
  ],
};
const at = text => calculateSemesterRecovery(semester, parseLocalDate(text));

test('semester recovery adds a whole lesson only at its exact end', () => {
  const end = parseLocalDate('2026-10-05T10:00');
  for (const now of [parseLocalDate('2026-10-04T09:00'), end - hour, end - 1]) {
    assert.deepEqual(calculateSemesterRecovery(semester, now), { recovered: 0, completedSessions: 0, nextCompletionAt: end });
  }
  assert.deepEqual(calculateSemesterRecovery(semester, end), {
    recovered: 100, completedSessions: 1, nextCompletionAt: parseLocalDate('2026-10-07T12:00'),
  });
});

test('completed lessons accumulate by duration while the current lesson is excluded', () => {
  assert.equal(at('2026-10-07T11:59:59').recovered, 100);
  assert.equal(at('2026-10-07T12:00').recovered, 300);
  assert.equal(at('2026-10-12T10:00').recovered, 400);
  const now = parseLocalDate('2026-10-07T12:00');
  assert.equal(calculateSession(findScheduledSession(semester, now), now).state, 'waiting');
  assert.equal(calculateSemesterRecovery(semester, now).completedSessions, 2);
});

test('restores missed completions without duplicates and recalculates for clock or configuration changes', () => {
  const now = parseLocalDate('2026-10-14T12:00');
  const result = { recovered: 600, completedSessions: 4, nextCompletionAt: Infinity };
  assert.deepEqual(calculateSemesterRecovery(semester, now), result);
  assert.deepEqual(calculateSemesterRecovery(JSON.parse(JSON.stringify(semester)), now), result);
  assert.deepEqual(at('2027-01-01T00:00'), result);
  assert.equal(at('2026-10-12T09:30').recovered, 300);
  assert.equal(calculateSemesterRecovery({ ...semester, tuitionCents: 120000 }, now).recovered, 1200);
});

test('respects late-start, early-ending and zero-occurrence courses', () => {
  const limited = { ...semester, weeklyCourses: [
    { name: '前半段', weekday: 2, startTime: '10:00', durationMs: hour, endDate: '2026-10-07' },
    { name: '后半段', weekday: 2, startTime: '10:00', durationMs: 2 * hour, startDate: '2026-10-14' },
    { name: '无课次', weekday: 4, startTime: '10:00', durationMs: hour, endDate: '2026-10-05' },
  ] };
  assert.deepEqual(calculateSemesterRecovery(limited, parseLocalDate('2026-10-07T11:00')), {
    recovered: 200, completedSessions: 1, nextCompletionAt: parseLocalDate('2026-10-14T12:00'),
  });
  assert.equal(calculateSemesterRecovery(limited, parseLocalDate('2026-10-14T12:00')).recovered, 600);
});

test('an overnight lesson on the last semester day is credited after midnight, at its real end', () => {
  const overnight = { tuitionCents: 10000, startDate: '2026-10-04', endDate: '2026-10-04', weeklyCourses: [
    { name: '夜课', weekday: 6, startTime: '23:00', durationMs: 2 * hour },
  ] };
  assert.equal(calculateSemesterRecovery(overnight, parseLocalDate('2026-10-05T00:59:59')).recovered, 0);
  assert.equal(calculateSemesterRecovery(overnight, parseLocalDate('2026-10-05T01:00')).recovered, 100);
});

test('completion uses elapsed duration through the daylight-saving transition', () => {
  const previousZone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const autumn = { tuitionCents: 30000, startDate: '2026-10-25', endDate: '2026-11-01', weeklyCourses: [
      { name: '凌晨课程', weekday: 6, startTime: '01:30', durationMs: 2 * hour },
    ] };
    assert.equal(calculateSemesterRecovery(autumn, parseLocalDate('2026-11-01T02:29:59')).recovered, 150);
    assert.equal(calculateSemesterRecovery(autumn, parseLocalDate('2026-11-01T02:30')).recovered, 300);
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test('selection and settlement agree on weekly local starts across both daylight-saving transitions', () => {
  const previousZone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    for (const fixture of [
      { startDate: '2026-03-01', endDate: '2026-03-08', startTime: '02:30',
        start: '2026-03-08T07:30:00Z', end: '2026-03-08T09:30:00Z' },
      { startDate: '2026-10-25', endDate: '2026-11-01', startTime: '01:30',
        start: '2026-11-01T05:30:00Z', end: '2026-11-01T07:30:00Z' },
    ]) {
      const schedule = { tuitionCents: 30000, startDate: fixture.startDate, endDate: fixture.endDate,
        weeklyCourses: [{ name: '凌晨课程', weekday: 6, startTime: fixture.startTime, durationMs: 2 * hour }] };
      const start = Date.parse(fixture.start);
      const end = Date.parse(fixture.end);
      const selected = findScheduledSession(schedule, start);
      assert.equal(selected.start, start);
      assert.equal(selected.end, end);
      assert.equal(calculateSession(selected, start).state, 'live');
      assert.deepEqual(calculateSemesterRecovery(schedule, end - 1), {
        recovered: 150, completedSessions: 1, nextCompletionAt: end,
      });
      assert.deepEqual(calculateSemesterRecovery(schedule, end), {
        recovered: 300, completedSessions: 2, nextCompletionAt: Infinity,
      });
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});

test('fractional cents are summed before display rounding and invalid inputs are rejected', () => {
  const tiny = { tuitionCents: 1, startDate: '2026-10-05', endDate: '2026-10-19', weeklyCourses: [semester.weeklyCourses[0]] };
  assert.ok(Math.abs(calculateSemesterRecovery(tiny, parseLocalDate('2026-10-05T10:00')).recovered - .01 / 3) < 1e-12);
  assert.equal(calculateSemesterRecovery(tiny, parseLocalDate('2026-10-19T10:00')).recovered, .01);
  assert.throws(() => calculateSemesterRecovery(semester, NaN));
  assert.throws(() => calculateSemesterRecovery({ ...semester, tuitionCents: 0 }));
});
