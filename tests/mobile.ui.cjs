const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { routeApp } = require('./app-page.cjs');
(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await routeApp(page, 'http://127.0.0.1:4185');
      await page.addInitScript(() => {
        window.__TAURI__ = { core: { invoke: async (command, args) => {
          if (command === 'runtime_platform') return 'ios';
          if (command === 'load_preferences') return localStorage.getItem('prefs');
          if (command === 'save_preferences') return localStorage.setItem('prefs', args.text);
          if (command === 'load_configuration') return localStorage.getItem('configuration');
          if (command === 'save_configuration') return localStorage.setItem('configuration', args.text);
          throw new Error(`Unexpected native call: ${command}`);
        } }, window: { getCurrentWindow() { throw new Error('Desktop API called on iOS'); } } };
      });
      await page.goto('http://127.0.0.1:4185');
      await page.locator('#preferences-save').click();
      await page.waitForFunction(() => document.documentElement.dataset.mobile === 'true');
      assert.equal(await page.locator('.window-button:visible').count(), 0);
      await page.locator('#settings-open').click();
      await page.locator('#demo').click();
      await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
      assert(await page.locator('#demo-tag').isVisible());
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      const size = await page.locator('.window-shell').boundingBox();
      assert.equal(size.width, width);
      assert.equal(size.height, 844);
      await page.locator('#preferences-open').click();
      assert.equal(await page.locator('#language-choice').inputValue(), 'en-US');
      await page.locator('#preferences-cancel').click();
      await page.reload();
      assert.equal(await page.locator('#preferences-dialog').isVisible(), false);
      await page.locator('#settings-open').click();
      assert(await page.evaluate(() => {
        const dialog = document.querySelector('#settings-dialog');
        return dialog.scrollWidth <= dialog.clientWidth + 1;
      }));
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Mobile smoke passed at 320, 390 and 430px: no desktop calls, preferences, demo, resume, layout.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
