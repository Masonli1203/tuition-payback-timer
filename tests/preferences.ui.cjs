const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const origin = 'http://127.0.0.1:4182';
const key = 'tuition-payback.preferences.v1';
const configurationKey = 'tuition-payback.v0.1.session';
const config = JSON.stringify({ version: 4, semester: { tuitionCents: 3600000, startDate: '2026-09-02', endDate: '2026-12-10', weeklyCourses: [{ name: '我的课程 · 示例课程', weekday: 3, startTime: '12:20', durationMs: 9000000 }] } });
const { routeApp } = require('./app-page.cjs');
const output = path.resolve('.runtime/preferences-verification');
const languageCodes = ['en-US', 'zh-CN', 'ja-JP', 'zh-TW', 'ko-KR', 'es-ES'];
const additions = [
  { code: 'zh-TW', short: '繁中', heading: '語言與貨幣', amount: '本堂課已回本', settings: '學期與課表', invalid: '請輸入有效金額，最多保留兩位小數。' },
  { code: 'ko-KR', short: '한국어', heading: '언어 및 통화', amount: '이번 수업 회수액', settings: '학기 및 시간표', invalid: '소수점 이하 두 자리까지 올바른 금액을 입력하세요.' },
  { code: 'es-ES', short: 'Español', heading: 'Idioma y moneda', amount: 'Recuperado en esta clase', settings: 'Semestre y cursos', invalid: 'Introduce un importe válido con un máximo de dos decimales.' },
];
let browser;
const errors = [];
async function createPage({ desktop = false, saved = null, configuration = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 480, height: 420 }, locale: 'zh-CN', timezoneId: 'America/New_York' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await routeApp(page, origin);
  await page.addInitScript(({ key, configurationKey, saved, configuration, desktop }) => {
    if (!window.name) {
      if (saved) localStorage.setItem(key, saved);
      if (configuration) localStorage.setItem(configurationKey, configuration);
      window.name = 'initialized';
    }
    if (desktop) window.__TAURI__ = {
      core: { invoke: async (command, args) => {
        if (command === 'load_configuration') return localStorage.getItem(configurationKey);
        if (command === 'load_preferences') return localStorage.getItem(key);
        if (command === 'save_preferences') {
          await new Promise((resolve, reject) => { window.finishPreferenceSave = resolve; window.failPreferenceSave = () => reject(new Error('disk full')); });
          localStorage.setItem(key, args.text);
        }
        if (command === 'configuration_path') return 'verification/configuration.json';
      } },
      window: { getCurrentWindow: () => ({ minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, isMaximized: async () => false, onResized: async () => () => {}, isAlwaysOnTop: async () => false, setAlwaysOnTop: async () => {} }) },
      event: { listen: async () => () => {} },
    };
  }, { key, configurationKey, saved, configuration, desktop });
  await page.goto(origin);
  await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
  return page;
}
async function choose(page, language, currency) {
  await page.locator('#language-choice').selectOption(language);
  await page.locator('#currency-choice').selectOption(currency);
  await page.locator('#preferences-save').click();
  await page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
}
async function noOverflow(page) {
  const result = await page.evaluate(() => {
    const main = document.querySelector('.app-shell');
    const badge = document.getElementById('preferences-open').getBoundingClientRect();
    const course = document.getElementById('course-name').getBoundingClientRect();
    const date = document.getElementById('current-date').getBoundingClientRect();
    const actions = document.querySelector('.window-actions').getBoundingClientRect();
    return { x: main.scrollWidth <= main.clientWidth, y: main.scrollHeight <= main.clientHeight, separated: course.right <= badge.left, header: date.right <= actions.left, dimensions: [innerWidth, innerHeight], overflow: main.scrollWidth - main.clientWidth };
  });
  assert(result.x && result.y && result.separated && result.header, JSON.stringify(result));
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await createPage({ configuration: config });
  assert.deepEqual(errors, []);
  assert(await page.locator('#preferences-dialog').isVisible());
  assert.equal(await page.locator('#language-choice option').count(), 6);
  assert.equal(await page.locator('#currency-choice option').count(), 12);
  await page.locator('#language-choice').selectOption('en-US');
  assert.equal(await page.locator('#preferences-heading').textContent(), 'Language & currency');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'first-use.png') });
  await choose(page, 'en-US', 'USD');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en-US');
  assert.equal(await page.locator('#selected-language').textContent(), 'English');
  assert.equal(await page.locator('#amount-label').textContent(), 'Recovered this class');
  assert.equal(await page.locator('#course-name').textContent(), '我的课程 · 示例课程');
  await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), configurationKey), config);
  await noOverflow(page);
  await page.screenshot({ path: path.join(output, 'english-usd.png') });
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
  assert.equal(await page.locator('#preferences-dialog').isVisible(), false);
  for (const currency of ['USD', 'JPY']) {
    await page.locator('#preferences-open').click();
    await choose(page, 'zh-CN', currency);
    assert.equal(await page.locator('#selected-currency').textContent(), currency);
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, `chinese-${currency}.png`) });
  }
  await page.locator('#preferences-open').click();
  await choose(page, 'ja-JP', 'JPY');
  assert.equal(await page.locator('#amount-label').textContent(), 'この授業の回収額');
  await page.locator('#settings-open').click();
  assert.equal(await page.locator('label[for="value"] span').textContent(), 'JPY');
  assert.equal(await page.locator('#value').inputValue(), '36000.00');
  assert.equal(await page.locator('#settings-heading').textContent(), '学期と時間割');
  await page.locator('#value').fill('0');
  await page.locator('#apply').click();
  assert.match(await page.locator('#feedback').textContent(), /￥/);
  await page.locator('#settings-cancel').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), configurationKey), config);
  await page.locator('#settings-open').click();
  await page.locator('#backup-file').setInputFiles({ name: 'USD-backup.json', mimeType: 'application/json', buffer: Buffer.from(config) });
  await page.locator('#import-preview').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#import-confirm').isDisabled(), true);
  assert.match(await page.locator('#backup-status').textContent(), /USD/);
  assert.match(await page.locator('#import-summary').textContent(), /USD/);
  await page.locator('#settings-cancel').click();
  await page.screenshot({ path: path.join(output, 'japanese-jpy.png') });
  for (const addition of additions) {
    await page.locator('#preferences-open').click();
    await page.locator('#language-choice').selectOption(addition.code);
    assert.equal(await page.locator('#preferences-heading').textContent(), addition.heading);
    await choose(page, addition.code, 'USD');
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
    assert.equal(await page.locator('#preferences-dialog').isVisible(), false);
    assert.equal(await page.locator('html').getAttribute('lang'), addition.code);
    assert.equal(await page.locator('#selected-language').textContent(), addition.short);
    assert.equal(await page.locator('#amount-label').textContent(), addition.amount);
    assert.equal(await page.locator('#course-name').textContent(), '我的课程 · 示例课程');
    await noOverflow(page);
    await page.screenshot({ path: path.join(output, `${addition.code}-main.png`) });
    await page.locator('#settings-open').click();
    assert.equal(await page.locator('#settings-heading').textContent(), addition.settings);
    assert.equal(await page.locator('#value').inputValue(), addition.code === 'es-ES' ? '36000,00' : '36000.00');
    await page.locator('#value').fill('abc');
    await page.locator('#apply').click();
    assert.equal(await page.locator('#feedback').textContent(), addition.invalid);
    await page.locator('#backup-file').setInputFiles({ name: 'USD-backup.json', mimeType: 'application/json', buffer: Buffer.from(config) });
    await page.locator('#import-preview').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#import-confirm').isDisabled(), false);
    assert.match(await page.locator('#import-summary').textContent(), /2026-09-02/);
    if (addition.code === 'zh-TW') assert.match(await page.locator('#import-summary').textContent(), /學期 2026-09-02 至 2026-12-10/);
    await page.locator('#settings-cancel').click();
    assert.equal(await page.evaluate(key => localStorage.getItem(key), configurationKey), config);
  }
  const spanish = await createPage({ configuration: config, saved: '{"version":1,"language":"es-ES","currency":"USD"}' });
  await spanish.locator('#settings-open').click();
  await spanish.locator('#value').fill('1234,56');
  await spanish.locator('#apply').click();
  await spanish.locator('#settings-dialog').waitFor({ state: 'hidden' });
  assert.equal(await spanish.evaluate(key => JSON.parse(localStorage.getItem(key)).semester.tuitionCents, configurationKey), 123456);
  await spanish.reload();
  await spanish.locator('#settings-open').click();
  assert.equal(await spanish.locator('#value').inputValue(), '1234,56');
  await spanish.locator('#settings-cancel').click();
  assert.equal(await spanish.locator('#amount-fraction .flip-separator').textContent(), ',');
  const desktop = await createPage({ desktop: true, configuration: config, saved: '{"version":1,"language":"zh-CN","currency":"USD"}' });
  await desktop.locator('#preferences-open').click();
  await desktop.locator('#language-choice').selectOption('en-US');
  await desktop.locator('#currency-choice').selectOption('JPY');
  await desktop.locator('#preferences-save').click();
  await desktop.waitForFunction(() => !!window.failPreferenceSave);
  assert.equal(await desktop.locator('#preferences-save').isDisabled(), true);
  await desktop.keyboard.press('Escape');
  assert(await desktop.locator('#preferences-dialog').isVisible());
  await desktop.evaluate(() => window.failPreferenceSave());
  await desktop.waitForFunction(() => !document.getElementById('preferences-save').disabled);
  assert.match(await desktop.locator('#preferences-feedback').textContent(), /Could not save/);
  assert.equal(await desktop.locator('#selected-currency').textContent(), 'USD');
  await desktop.locator('#preferences-save').click();
  await desktop.waitForFunction(() => document.getElementById('preferences-save').disabled);
  await desktop.evaluate(() => window.finishPreferenceSave());
  await desktop.locator('#preferences-dialog').waitFor({ state: 'hidden' });
  assert.equal(await desktop.locator('#selected-currency').textContent(), 'JPY');
  for (const language of languageCodes) {
    await desktop.locator('#preferences-open').click();
    await desktop.locator('#language-choice').selectOption(language);
    await desktop.locator('#preferences-save').click();
    await desktop.waitForFunction(() => document.getElementById('preferences-save').disabled);
    await desktop.evaluate(() => window.finishPreferenceSave());
    await desktop.locator('#preferences-dialog').waitFor({ state: 'hidden' });
    for (const [width, height] of [[297, 267], [340, 300], [375, 340], [400, 360], [480, 420], [800, 700]]) {
      await desktop.setViewportSize({ width, height });
      await noOverflow(desktop);
    }
  }
  await desktop.setViewportSize({ width: 356, height: 312 });
  await desktop.emulateMedia({ reducedMotion: 'reduce' });
  await desktop.locator('#preferences-open').click();
  for (const language of languageCodes) {
    await desktop.locator('#language-choice').selectOption(language);
    assert(await desktop.locator('#preferences-dialog').evaluate(element => element.scrollHeight <= element.clientHeight));
  }
  await desktop.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await desktop.screenshot({ path: path.join(output, 'compact-dark-preferences.png') });
  await desktop.locator('#preferences-cancel').click();
  const damaged = await createPage({ saved: '{', configuration: config });
  assert(await damaged.locator('#preferences-dialog').isVisible());
  assert.match(await damaged.locator('#preferences-feedback').textContent(), /原数据保留/);
  await damaged.keyboard.press('Escape');
  assert.equal(await damaged.evaluate(key => localStorage.getItem(key), key), '{');
  const fresh = await createPage();
  await fresh.locator('#preferences-cancel').click();
  assert.equal(await fresh.locator('#preferences-dialog').isVisible(), false);
  assert.equal(await fresh.evaluate(key => localStorage.getItem(key), key), null);
  assert.deepEqual(errors, []);
  console.log('Preferences UI: 6 languages, previews/restarts, localized editor and import, Spanish decimal input, failure/retry, 36 desktop layouts and data preservation passed.');
})().finally(async () => { if (browser) await browser.close(); }).catch(error => { console.error(error); process.exitCode = 1; });
