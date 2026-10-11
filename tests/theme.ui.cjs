const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { routeApp } = require('./app-page.cjs');

async function expectTheme(page, theme, label) {
  const actual = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    background: getComputedStyle(document.querySelector('.window-shell')).backgroundColor,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    themeColor: document.querySelector('meta[name="theme-color"]').content,
  }));
  assert.deepEqual(actual, {
    theme,
    background: theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(16, 24, 30)',
    colorScheme: theme,
    themeColor: theme === 'light' ? '#ffffff' : '#10181e',
  }, label);
}

// Use the page's local calendar, including when called in native WebView2.
async function localTime(page, hour, minute = 0, second = 0, millisecond = 0) {
  return new Date(await page.evaluate(args => new Date(2026, 9, 11, ...args).getTime(), [hour, minute, second, millisecond]));
}

async function verifyThemeBoundaries(page) {
  const start = await localTime(page, 17, 59, 30, 123);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
  await expectTheme(page, 'light', '17:59 on startup');
  await page.clock.runFor(29876);
  await expectTheme(page, 'light', '17:59:59.999');
  await page.clock.runFor(1);
  await expectTheme(page, 'dark', '18:00 must switch without reload or focus');

  await page.clock.setSystemTime(await localTime(page, 5, 59, 30, 123));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expectTheme(page, 'dark', '05:59 after clock rollback');
  await page.clock.runFor(29876);
  await expectTheme(page, 'dark', '05:59:59.999');
  await page.clock.runFor(1);
  await expectTheme(page, 'light', '06:00 must switch without reload or focus');

  for (const [hour, theme] of [[6, 'light'], [18, 'dark']]) {
    await page.clock.setSystemTime(await localTime(page, hour));
    await page.reload();
    await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
    await expectTheme(page, theme, `${hour}:00 on startup`);
  }

  // Simulate suspended timers, then exercise every existing recovery event.
  for (const [hour, event, theme] of [[6, 'focus', 'light'], [18, 'pageshow', 'dark'], [6, 'visibilitychange', 'light']]) {
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.setSystemTime(await localTime(page, hour));
    await page.evaluate(event => {
      delete document.hidden;
      (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
    }, event);
    await expectTheme(page, theme, `resume at ${hour}:00 via ${event}`);
  }
  await page.clock.fastForward(12 * 60 * 60 * 1000);
  await expectTheme(page, 'dark', 'automatic evening switch after resuming');
}

exports.verifyThemeBoundaries = verifyThemeBoundaries;

if (require.main === module) {
  let browser;
  (async () => {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    for (const timezoneId of ['America/New_York', 'Asia/Shanghai', 'Asia/Kathmandu']) {
      const page = await browser.newPage({ timezoneId, viewport: { width: 480, height: 420 } });
      page.on('pageerror', error => errors.push(error.message));
      await routeApp(page, 'http://127.0.0.1:4185');
      await page.goto('http://127.0.0.1:4185');
      await verifyThemeBoundaries(page);
      await page.close();
      console.log(`Theme: exact 06:00/18:00 boundaries, startup, clock rollback and recovery passed (${timezoneId}).`);
    }
    assert.deepEqual(errors, []);
  })().finally(async () => { if (browser) await browser.close(); }).catch(error => { console.error(error); process.exitCode = 1; });
}
