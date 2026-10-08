const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = 'http://127.0.0.1:4184';
const { routeApp } = require('./app-page.cjs');
const fixture = JSON.stringify({ version: 4, semester: {
  tuitionCents: 100000, startDate: '2026-10-01', endDate: '2026-10-31',
  weeklyCourses: [
    { name: 'Morning', weekday: 1, startTime: '09:00', durationMs: 3600000, excludedDates: ['2026-10-13'] },
    { name: 'Afternoon', weekday: 1, startTime: '13:00', durationMs: 3600000 },
    { name: 'Adjacent', weekday: 1, startTime: '14:00', durationMs: 3600000 },
  ],
} });
let browser;
const errors = [];
async function open(configuration) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, timezoneId: 'America/New_York' });
  page.on('pageerror', error => errors.push(error.message));
  await routeApp(page, origin);
  await page.addInitScript(configuration => {
    let maximized = true, resize = () => {};
    let preferences = JSON.stringify({ version: 1, language: 'zh-CN', currency: 'USD' });
    window.__TAURI__ = {
      core: { invoke: async (command, args) => {
        if (command === 'load_configuration') return configuration;
        if (command === 'load_preferences') return preferences;
        if (command === 'save_preferences') preferences = args.text;
        if (command === 'configuration_path') return 'isolated/configuration.json';
        if (command === 'save_configuration') throw new Error('This test must not write course data');
      } },
      window: { getCurrentWindow: () => ({
        isMaximized: async () => maximized, onResized: async callback => { resize = callback; },
        toggleMaximize: async () => { maximized = !maximized; await resize(); },
        isAlwaysOnTop: async () => false,
      }) },
      event: { listen: async () => () => {} },
    };
  }, configuration);
  await page.clock.install({ time: new Date('2026-10-06T08:59:59-04:00') });
  await page.clock.pauseAt(new Date('2026-10-06T08:59:59-04:00'));
  await page.goto(origin);
  await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
  return page;
}
async function expectMessage(page, text) {
  assert.equal(await page.locator('#focus-message-text').textContent(), text);
  assert(await page.locator('#focus-message').isVisible());
}
async function jump(page, time) {
  await page.clock.setSystemTime(new Date(time));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}
(async () => {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await open(fixture);
  await expectMessage(page, '好好休息！');
  await page.clock.runFor(1000);
  await expectMessage(page, '好好上课！');
  await jump(page, '2026-10-06T09:59:59-04:00');
  await page.clock.runFor(1000);
  await expectMessage(page, '好好休息！');
  await jump(page, '2026-10-06T13:59:59-04:00');
  await page.clock.runFor(1000);
  await expectMessage(page, '好好上课！');
  assert.equal(await page.locator('#course-name').textContent(), 'Adjacent');
  await jump(page, '2026-10-13T09:30:00-04:00');
  await expectMessage(page, '好好休息！');
  await jump(page, '2026-11-01T09:30:00-05:00');
  await expectMessage(page, '好好休息！');
  for (const [language, rest, live] of [
    ['zh-CN', '好好休息！', '好好上课！'], ['en-US', 'Rest well!', 'Focus on class!'],
    ['ja-JP', 'ゆっくり休もう！', '授業に集中！'], ['zh-TW', '好好休息！', '好好上課！'],
    ['ko-KR', '푹 쉬세요!', '수업에 집중하세요!'], ['es-ES', '¡Descansa bien!', '¡Concéntrate en clase!'],
  ]) {
    await page.locator('#preferences-open').click();
    await page.locator('#language-choice').selectOption(language);
    await page.locator('#preferences-save').click();
    await page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
    await expectMessage(page, rest);
    await jump(page, '2026-10-06T09:30:00-04:00');
    await expectMessage(page, live);
    await page.locator('.window-button').nth(1).click();
    assert.equal(await page.locator('#focus-message').isVisible(), false);
    await jump(page, '2026-10-06T11:00:00-04:00');
    await page.locator('.window-button').nth(1).click();
    await expectMessage(page, rest);
    assert(await page.locator('#focus-message-text').evaluate(element => element.getBoundingClientRect().width <= element.parentElement.getBoundingClientRect().width));
  }
  const empty = await open(null);
  await expectMessage(empty, '好好休息！');

  const midnight = await open(JSON.stringify({ version: 4, semester: {
    tuitionCents: 100000, startDate: '2026-10-01', endDate: '2026-10-31',
    weeklyCourses: [{ name: 'After midnight', weekday: 2, startTime: '00:30', durationMs: 3600000 }],
  } }));
  await jump(midnight, '2026-10-06T23:59:59-04:00');
  assert.match(await midnight.locator('#start-label').textContent(), /00:30/);
  assert.notEqual(await midnight.locator('#start-label').textContent(), '开始 00:30');
  await midnight.clock.runFor(1000);
  assert.equal(await midnight.locator('#start-label').textContent(), '开始 00:30');
  assert.equal(await midnight.locator('#end-label').textContent(), '下课 01:30');
  assert.deepEqual(errors, []);
  console.log('Focus message: exact start/end, breaks, adjacent lessons, excluded date, semester end, clock recovery, six languages, maximize/restore, unconfigured state and midnight labels passed.');
})().finally(async () => { if (browser) await browser.close(); }).catch(error => { console.error(error); process.exitCode = 1; });
