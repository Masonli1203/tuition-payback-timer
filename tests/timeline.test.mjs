import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemesterTimeline, calculateSession, parseLocalDate } from '../core.mjs';

const hour = 3600000;
const fixture = () => ({
  tuitionCents: 60000, startDate: '2026-10-05', endDate: '2026-10-18',
  weeklyCourses: [
    { name: 'Morning', weekday: 0, startTime: '09:00', durationMs: hour, excludedDates: ['2026-10-12'] },
    { name: 'Adjacent', weekday: 0, startTime: '10:00', durationMs: 2 * hour },
    { name: 'Night', weekday: 6, startTime: '23:30', durationMs: hour },
  ],
});
const state = (timeline, time) => {
  const { calendar, session, recovery } = timeline(parseLocalDate(time));
  return { calendar, session, recovery, view: calculateSession(session, parseLocalDate(time)) };
};

test('timeline preserves exact starts, adjacent switches and whole-lesson settlement', () => {
  const timeline = createSemesterTimeline(fixture());
  assert.equal(state(timeline, '2026-10-05T08:59:59').view.state, 'waiting');
  assert.equal(state(timeline, '2026-10-05T09:00').view.state, 'live');
  assert.equal(state(timeline, '2026-10-05T09:59:59').recovery.completedSessions, 0);
  const boundary = state(timeline, '2026-10-05T10:00');
  assert.equal(boundary.session.name, 'Adjacent');
  assert.equal(boundary.view.state, 'live');
  assert.equal(boundary.recovery.completedSessions, 1);
  assert.equal(boundary.recovery.recovered, 600 / 7);
  assert.equal(state(timeline, '2026-10-05T12:00').recovery.recovered, 600 * (3 / 7));
});

test('timeline skips cancellations, catches up after suspension and rewinds without stale totals', () => {
  const timeline = createSemesterTimeline(fixture());
  const cancelled = state(timeline, '2026-10-12T09:30');
  assert.equal(cancelled.session.name, 'Adjacent');
  assert.equal(cancelled.view.state, 'waiting');
  assert.equal(cancelled.recovery.completedSessions, 3);
  const finished = state(timeline, '2026-10-19T00:30');
  assert.equal(finished.recovery.recovered, 600);
  assert.equal(finished.recovery.completedSessions, 5);
  assert.equal(finished.recovery.nextCompletionAt, Infinity);
  const rewind = state(timeline, '2026-10-05T09:30');
  assert.equal(rewind.session.name, 'Morning');
  assert.equal(rewind.recovery.recovered, 0);
  assert.equal(rewind.recovery.nextCompletionAt, parseLocalDate('2026-10-05T10:00'));
});

test('timeline credits the last overnight lesson only at its actual end', () => {
  const timeline = createSemesterTimeline(fixture());
  const beforeEnd = state(timeline, '2026-10-19T00:29:59');
  assert.equal(beforeEnd.calendar.state, 'complete');
  assert.equal(beforeEnd.view.state, 'live');
  assert.equal(beforeEnd.recovery.completedSessions, 4);
  assert.equal(state(timeline, '2026-10-19T00:30').recovery.recovered, 600);
});

test('timeline owns its schedule snapshot; edited input takes effect only in a new timeline', () => {
  const config = fixture();
  const timeline = createSemesterTimeline(config);
  config.tuitionCents = 120000;
  config.weeklyCourses[0].name = 'Edited';
  config.weeklyCourses[0].excludedDates.length = 0;
  config.endDate = '2026-10-25';
  const original = state(timeline, '2026-10-05T09:30');
  assert.equal(original.session.name, 'Morning');
  assert.equal(original.session.tuitionCents, 60000);
  assert.equal(original.calendar.days, 14);
  assert.equal(state(timeline, '2026-10-12T09:30').session.name, 'Adjacent');
  assert.equal(state(createSemesterTimeline(config), '2026-10-12T09:30').session.name, 'Edited');
});

test('timeline validates configuration and invalid times without corrupting future reads', () => {
  assert.throws(() => createSemesterTimeline({ ...fixture(), tuitionCents: 0 }));
  const timeline = createSemesterTimeline(fixture());
  for (const now of [NaN, Infinity, -Infinity, 1e20]) assert.throws(() => timeline(now));
  assert.equal(state(timeline, '2026-10-05T09:30').view.state, 'live');
});

test('timeline retains wall-clock starts and elapsed durations across both DST changes', () => {
  const oldZone = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    for (const [startDate, endDate, startTime, expectedStart] of [
      ['2026-03-08', '2026-03-08', '02:30', '2026-03-08T03:30:00-04:00'],
      ['2026-11-01', '2026-11-01', '01:30', '2026-11-01T01:30:00-04:00'],
    ]) {
      const timeline = createSemesterTimeline({ tuitionCents: 10000, startDate, endDate,
        weeklyCourses: [{ name: 'DST', weekday: 6, startTime, durationMs: 2 * hour }] });
      const start = Date.parse(expectedStart);
      assert.equal(timeline(start).session.start, start);
      assert.equal(timeline(start + 2 * hour - 1).recovery.recovered, 0);
      assert.equal(timeline(start + 2 * hour).recovery.recovered, 100);
    }
  } finally { if (oldZone === undefined) delete process.env.TZ; else process.env.TZ = oldZone; }
});
