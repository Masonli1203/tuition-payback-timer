import test from 'node:test';
import assert from 'node:assert/strict';
import { configurationRecord, decodeConfiguration, exportConfiguration, storageKey } from '../configuration.mjs';
import { createPersistence } from '../persistence.mjs';
import { findScheduledSession, calculateSession } from '../core.mjs';

const semester = {
  tuitionCents: 2400000, startDate: '2026-09-03', endDate: '2026-12-10', demo: false,
  weeklyCourses: [
    { name: '经济学', weekday: 0, startTime: '09:00', durationMs: 90 * 60000 },
    { name: '设计工坊', weekday: 3, startTime: '09:30', durationMs: 150 * 60000, startDate: '2026-10-22', endDate: '2026-12-10' },
  ],
};

test('完整导出保留学费、学期和课程独立日期，恢复后同一时刻计算一致', () => {
  const text = exportConfiguration(semester, { origin: 'http://127.0.0.1:4173', timeZone: 'America/New_York' });
  const restored = decodeConfiguration(text);
  assert.deepEqual(restored.semester, semester);
  assert.equal(restored.courseCount, 2);
  assert.equal(restored.semesterDurationMs, (14 * 1.5 + 8 * 2.5) * 3600000);
  const now = new Date(2026, 9, 22, 10).getTime();
  assert.deepEqual(findScheduledSession(restored.semester, now), findScheduledSession(semester, now));
  assert.deepEqual(calculateSession(findScheduledSession(restored.semester, now), now), calculateSession(findScheduledSession(semester, now), now));
});

test('损坏 JSON、空文件、未知版本和非法完整配置均被拒绝', () => {
  for (const text of ['', '{', 'null', '[]', '{"version":99}', '{"version":"3"}', '{"version":3}', '{"version":3,"semester":{}}']) assert.throws(() => decodeConfiguration(text));
  for (const change of [ { tuitionCents: -1 }, { startDate: 'wrong' }, { weeklyCourses: [] }, { weeklyCourses: [{ ...semester.weeklyCourses[0], startDate: '2027-01-01' }] }, { weeklyCourses: [{ ...semester.weeklyCourses[0], endDate: {} }] } ]) {
    assert.throws(() => configurationRecord({ ...semester, ...change }));
  }
  assert.throws(() => decodeConfiguration(' '.repeat(1024 * 1024 + 1)), /过大/);
  assert.deepEqual(decodeConfiguration('\uFEFF' + JSON.stringify(configurationRecord(semester))).semester, semester);
});

test('版本 1 和 2 仅产生待补全草稿，不冒充完整学期', () => {
  const session = { name: '旧课程', start: new Date(2026, 9, 8, 9).getTime(), end: new Date(2026, 9, 8, 10, 30).getTime(), tuitionCents: 123400 };
  for (const version of [1, 2]) {
    const loaded = decodeConfiguration(JSON.stringify({ version, session }));
    assert.equal(loaded.kind, 'legacy');
    assert.equal(loaded.courseCount, 1);
    assert.equal(loaded.draft.tuitionCents, version === 1 ? null : 123400);
    assert.equal(loaded.draft.weeklyCourses[0].durationMs, 90 * 60000);
    assert.throws(() => configurationRecord(loaded.draft));
  }
  assert.throws(() => decodeConfiguration('{"version":2,"session":{"start":1,"end":2}}'));
});

test('读取配置绝不写回，旧版、损坏和未知版本原数据均保留', async () => {
  for (const text of [JSON.stringify(configurationRecord(semester)), '{', '{"version":99}', '{"version":1,"session":{"start":100000000,"end":103600000}}']) {
    let writes = 0;
    const store = createPersistence({ localStorage: { getItem: key => { assert.equal(key, storageKey); return text; }, setItem: () => writes++ } });
    await store.load().catch(() => {});
    assert.equal(writes, 0);
  }
});

test('桌面保存明确等待写入成功，失败不返回新配置，也不回退浏览器存储', async () => {
  let complete;
  let settled = false;
  const store = createPersistence({ invoke: (command, args) => {
    assert.equal(command, 'save_configuration');
    assert.deepEqual(JSON.parse(args.text), configurationRecord(semester));
    return new Promise(resolve => { complete = resolve; });
  }, localStorage: { setItem: () => assert.fail('desktop must not fall back') } });
  const pending = store.save(semester).then(result => { settled = true; return result; });
  await Promise.resolve();
  assert.equal(settled, false);
  complete();
  assert.deepEqual(await pending, semester);
  const failed = createPersistence({ invoke: async () => { throw new Error('disk full'); } });
  await assert.rejects(failed.save(semester), /disk full/);
});

test('浏览器保存失败向调用方报告，旧数据不受影响', async () => {
  const original = JSON.stringify(configurationRecord(semester));
  const store = createPersistence({ localStorage: { getItem: () => original, setItem: () => { throw new Error('quota exceeded'); } } });
  await assert.rejects(store.save({ ...semester, tuitionCents: 500 }), /quota exceeded/);
  assert.deepEqual((await store.load()).semester, semester);
});
