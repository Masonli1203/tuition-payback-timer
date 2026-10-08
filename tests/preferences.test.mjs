import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreferencePersistence, decodePreferences, preferenceKey, createMoneyFormatters, currencies, languages, parseTuition } from '../preferences.mjs';
import { setLanguage, t, translate, messages, messageColumns } from '../i18n.mjs';
import { exportConfiguration, decodeConfiguration } from '../configuration.mjs';

test('preferences persist independently; failed writes preserve preferences and timetable', async () => {
  const store = new Map([['tuition-payback.v0.1.session', 'original timetable']]);
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  const persistence = createPreferencePersistence({ localStorage: storage });
  assert.equal(await persistence.load(), null);
  await persistence.save({ language: 'en-US', currency: 'JPY' });
  assert.deepEqual(await persistence.load(), { language: 'en-US', currency: 'JPY' });
  const before = store.get(preferenceKey);
  storage.setItem = () => { throw new Error('disk full'); };
  await assert.rejects(persistence.save({ language: 'ja-JP', currency: 'USD' }), /disk full/);
  assert.equal(store.get(preferenceKey), before);
  assert.equal(store.get('tuition-payback.v0.1.session'), 'original timetable');
});

test('desktop preference writes await native success without a browser fallback', async () => {
  let resolveSave;
  const calls = [];
  const persistence = createPreferencePersistence({ invoke: async (command, args) => {
    calls.push([command, args]);
    if (command === 'load_preferences') return '{"version":1,"language":"zh-CN","currency":"USD"}';
    return new Promise(resolve => { resolveSave = resolve; });
  }, localStorage: { setItem: () => assert.fail('desktop must not use browser storage') } });
  assert.equal((await persistence.load()).currency, 'USD');
  let complete = false;
  const pending = persistence.save({ language: 'ja-JP', currency: 'JPY' }).then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(complete, false);
  assert.equal(calls[1][0], 'save_preferences');
  resolveSave(); await pending;
  assert.equal(complete, true);
});

test('malformed and unknown preferences are rejected', () => {
  for (const text of ['{', '{}', '{"version":2,"language":"zh-CN","currency":"USD"}', '{"version":1,"language":"fr","currency":"USD"}', '{"version":1,"language":"zh-CN","currency":"BAD"}']) assert.throws(() => decodePreferences(text));
});

test('JSON backups retain currency metadata and old backups retain their USD unit', () => {
  const semester = { tuitionCents: 123456, startDate: '2026-09-01', endDate: '2026-12-01', weeklyCourses: [{ name: 'Test', weekday: 0, startTime: '09:00', durationMs: 3600000 }] };
  assert.equal(decodeConfiguration(exportConfiguration(semester, { currency: 'JPY' })).currency, 'JPY');
  assert.equal(decodeConfiguration(exportConfiguration(semester, {})).currency, 'USD');
  assert.throws(() => decodeConfiguration(exportConfiguration(semester, { currency: 'BAD' })), /货币单位/);
});

test('all language and currency combinations retain hundredths without converting amounts', () => {
  for (const { code: language } of languages) for (const currency of currencies) {
    const format = createMoneyFormatters({ language, currency });
    const parts = format.money.formatToParts(1234.56);
    assert.equal(parts.find(part => part.type === 'fraction').value, '56');
    assert.equal(parts.filter(part => ['integer'].includes(part.type)).map(part => part.value).join(''), '1234');
    assert(format.symbol);
    assert.match(format.rate(0.00000001), /1/);
  }
});

test('displayed rates retain four decimal places or four significant digits for tiny amounts', () => {
  const { rate } = createMoneyFormatters({ language: 'en-US', currency: 'USD' });
  assert.equal(rate(428.57 / 9000), '$0.0476');
  assert.equal(rate(0.01 / 9000), '$0.000001111');
});

test('translated dynamic messages retain course names and locale-specific errors', () => {
  setLanguage('en-US');
  assert.equal(t('移除{0}', '我的课程'), 'Remove 我的课程');
  assert.equal(translate('第 6 周 / 共 15 周'), 'Week 6 / 15');
  assert.equal(translate('未导入：ICS 重复规则格式无效。 当前设置未改变。'), 'Import failed: Invalid ICS recurrence rule. Current settings are unchanged.');
  setLanguage('ja-JP');
  assert.equal(translate('进行中'), '授業中');
  assert.equal(t('学费 {0}', '￥1,234.56'), '学費 ￥1,234.56');
  setLanguage('zh-CN');
  assert.equal(translate('进行中'), '进行中');
  assert.equal(new Set(messages.map(row => row[0])).size, messages.length);
});

test('every supported language has a complete catalog with intact placeholders', () => {
  const tokens = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  for (const { code } of languages) {
    assert(Number.isInteger(messageColumns[code]));
    for (const row of messages) {
      const translation = row[messageColumns[code]];
      assert(translation?.trim(), `${code}: ${row[0]}`);
      assert.deepEqual(tokens(translation), tokens(row[0]), `${code}: ${row[0]}`);
      assert.equal(translate(row[0], code), translation, `${code}: exact template ${row[0]}`);
    }
  }
});

test('dynamic messages and saved preferences retain every supported language', () => {
  for (const { code } of languages) {
    assert.equal(decodePreferences(JSON.stringify({ version: 1, language: code, currency: 'JPY' })).language, code);
  }
  assert.equal(translate('语言与货币', 'zh-TW'), '語言與貨幣');
  assert.equal(translate('第 6 周 / 共 15 周', 'ko-KR'), '6주차 / 총 15주');
  assert.equal(translate('第 6 周 / 共 15 周', 'es-ES'), 'Semana 6 / 15');
  setLanguage('ko-KR');
  assert.equal(t('移除{0}', '我的课程'), '我的课程 삭제');
  setLanguage('es-ES');
  assert.equal(t('移除{0}', '我的课程'), 'Eliminar 我的课程');
  setLanguage('zh-CN');
});

test('Spanish decimal commas retain exact cents and ambiguous grouping is rejected', () => {
  assert.equal(parseTuition('36000,14', 'es-ES'), 3600014);
  assert.equal(parseTuition('36000.14', 'es-ES'), 3600014);
  for (const text of ['36.000,14', '36,000.14', '1,234', '1,2,3']) assert.throws(() => parseTuition(text, 'es-ES'));
  assert.throws(() => parseTuition('36000,14', 'zh-TW'));
});
