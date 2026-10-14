import test from 'node:test';
import assert from 'node:assert/strict';
import { widgetSnapshot, createWidgetSync } from '../widget.mjs';
import { createSemesterTimeline, calculateSession } from '../core.mjs';

const preferences = { language: 'zh-CN', currency: 'CNY' };
const semester = { tuitionCents: 2400000, startDate: '2026-10-05', endDate: '2026-11-09', weeklyCourses: [
  { name: 'Overnight', weekday: 0, startTime: '23:30', durationMs: 7200000, excludedDates: ['2026-10-12'] },
  { name: 'Short course', weekday: 2, startTime: '10:00', durationMs: 3600000, startDate: '2026-10-14', endDate: '2026-10-28' },
] };
test('widget resolved sessions match core across class boundaries, exclusions and overnight lessons', () => {
  const snapshot = widgetSnapshot(semester, preferences);
  assert.equal(snapshot.sessions.length, 8);
  assert.equal(snapshot.language, 'zh-CN');
  assert.equal(snapshot.currency, 'CNY');
  const timeline = createSemesterTimeline(semester);
  for (const session of snapshot.sessions) {
    for (const now of [session.start - 1, session.start, session.start + 5000, session.end - 1, session.end, session.end + 1]) {
      const active = snapshot.sessions.find(s => s.start <= now && now < s.end);
      const next = snapshot.sessions.find(s => s.start > now);
      const previous = snapshot.sessions.filter(s => s.end <= now).sort((a, b) => b.end - a.end)[0];
      const selected = active ?? next ?? previous;
      const core = timeline(now);
      assert.equal(selected.start, core.session.start);
      const completed = snapshot.sessions.filter(s => s.end <= now).reduce((sum, s) => sum + s.end - s.start, 0);
      assert.equal(snapshot.tuitionCents / 100 * (completed / snapshot.semesterDurationMs), core.recovery.recovered);
      const amount = snapshot.tuitionCents / 100 * (Math.min(selected.end - selected.start, Math.max(0, now - selected.start)) / snapshot.semesterDurationMs);
      assert.equal(amount, calculateSession(core.session, now).recovered);
    }
  }
});
test('empty setup emits an explicit empty widget snapshot', () => {
  assert.deepEqual(widgetSnapshot(null, preferences).sessions, []);
});
test('widget writes are serialized, coalesced and retried after failure', async () => {
  let release;
  const writes = [];
  const errors = [];
  const sync = createWidgetSync(async (_, { text }) => {
    writes.push(JSON.parse(text));
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
    if (writes.length === 2) throw new Error('App Group unavailable');
  }, error => errors.push(error));
  const first = sync(null, preferences);
  await sync(semester, preferences);
  await sync(semester, { ...preferences, currency: 'USD' });
  assert.equal(writes.length, 1);
  release();
  await first;
  assert.equal(writes.length, 2);
  assert.equal(writes[1].currency, 'USD');
  assert.equal(errors.length, 1);
  await sync(semester, { ...preferences, currency: 'USD' });
  assert.equal(writes.length, 3);
  await sync(semester, { ...preferences, currency: 'USD' });
  assert.equal(writes.length, 3);
});
