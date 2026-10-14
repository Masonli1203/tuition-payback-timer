const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { routeApp } = require('./app-page.cjs');
const portraitHeight = width => width === 320 ? 568 : width === 390 ? 844 : 932;
async function expectLargeReminder(page) {
  await page.evaluate(() => new Promise(resolve => {
    const observer = new ResizeObserver(() => { observer.disconnect(); resolve(); });
    observer.observe(document.querySelector('#focus-message'));
  }));
  await page.clock.runFor(50);
  const result = await page.locator('#focus-message-text').evaluate(text => {
    const container = text.parentElement;
    const style = getComputedStyle(container);
    const height = container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const size = parseFloat(getComputedStyle(text).fontSize);
    const fitsNow = () => {
      const bounds = text.getBoundingClientRect();
      return text.scrollWidth <= container.clientWidth && bounds.height <= height &&
        [...text.querySelectorAll('.reminder-mark')].every(mark => {
          const rect = mark.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right;
        });
    };
    const fits = fitsNow();
    const original = text.style.fontSize;
    text.style.fontSize = `${size + 2}px`;
    const largerOverflows = !fitsNow();
    text.style.fontSize = original;
    return { fits, largerOverflows, size, height, textHeight: text.getBoundingClientRect().height, width: container.clientWidth, scrollWidth: text.scrollWidth, language: document.documentElement.lang };
  });
  assert(result.fits, JSON.stringify(result));
  assert(result.largerOverflows, `Reminder should fill available space: ${JSON.stringify(result)}`);
  if (page.viewportSize().height > page.viewportSize().width) assert(result.size > Math.max(24, page.viewportSize().width * 0.075), `Reminder should exceed its previous size: ${JSON.stringify(result)}`);
  await expectReminderGeometry(page);
}
async function expectReminderGeometry(page) {
  const geometry = await page.evaluate(() => {
    const text = document.querySelector('#focus-message-text');
    const area = text.parentElement.getBoundingClientRect();
    const lines = [];
    for (const word of text.querySelectorAll('.reminder-letters')) {
      const rect = word.getBoundingClientRect();
      let line = lines.find(line => Math.abs(line.top - rect.top) < 2);
      if (!line) lines.push(line = { top: rect.top, left: rect.left, right: rect.right });
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
    }
    const bounds = text.getBoundingClientRect();
    const marks = [...text.querySelectorAll('.reminder-mark')];
    const before = [...text.querySelectorAll('.reminder-letters')].map(word => word.getBoundingClientRect().x);
    marks.forEach(mark => { mark.style.display = 'none'; });
    const after = [...text.querySelectorAll('.reminder-letters')].map(word => word.getBoundingClientRect().x);
    marks.forEach(mark => { mark.style.display = ''; });
    const obstacles = ['.value-block', '.lesson-progress', '.locale-badge'].map(selector => document.querySelector(selector).getBoundingClientRect());
    return {
      centered: lines.every(line => Math.abs((line.left + line.right) / 2 - (area.left + area.right) / 2) < 1),
      punctuationHasNoAdvance: before.every((x, index) => x === after[index]),
      verticalCenter: Math.abs((bounds.top + bounds.bottom) / 2 - (area.top + area.bottom) / 2) < 1,
      overlaps: obstacles.some(rect => bounds.left < rect.right && bounds.right > rect.left && bounds.top < rect.bottom && bounds.bottom > rect.top),
      visible: [...obstacles, area].every(rect => rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth),
    };
  });
  assert.deepEqual(geometry, { centered: true, punctuationHasNoAdvance: true, verticalCenter: true, overlaps: false, visible: true });
}
async function expectLandscape(page, height) {
  await page.setViewportSize({ width: height === 320 ? 568 : height === 390 ? 844 : 932, height });
  await expectLargeReminder(page);
  await page.setViewportSize({ width: height, height: portraitHeight(height) });
  await expectLargeReminder(page);
}
async function capturePortrait(page, language, state) {
  if (process.env.REMINDER_SCREENSHOTS && page.viewportSize().width === 390) {
    await page.screenshot({ path: path.join(process.env.REMINDER_SCREENSHOTS, `${language}-${state}.png`) });
  }
}
(async () => {
  if (process.env.REMINDER_SCREENSHOTS) await fs.mkdir(process.env.REMINDER_SCREENSHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  try {
    for (const width of [320, 390, 430]) {
      const page = await browser.newPage({ viewport: { width, height: portraitHeight(width) }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await routeApp(page, 'http://127.0.0.1:4185');
      // Mobile reminders belong to the timer, even if desktop controls never initialize.
      if (width === 320) await page.route('**/desktop.mjs', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
      await page.clock.install({ time: new Date('2026-10-14T10:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-14T10:00:00Z'));
      await page.addInitScript(() => {
        window.__TAURI__ = { core: { invoke: async (command, args) => {
          if (command === 'sync_widget') { window.widgetSnapshot = JSON.parse(args.text); return; }
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
      assert(await page.locator('#focus-message').isVisible());
      assert.equal(await page.locator('#focus-message-text').textContent(), 'Rest well!');
      await page.locator('#settings-open').click();
      await page.locator('#demo').click();
      await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
      assert(await page.locator('#demo-tag').isVisible());
      await page.waitForFunction(() => window.widgetSnapshot?.sessions.length > 0);
      assert.equal(await page.evaluate(() => window.widgetSnapshot.currency), 'USD');
      assert(await page.locator('#focus-message').isVisible());
      assert.equal(await page.locator('#focus-message-text').textContent(), 'Focus on class!');
      await expectLargeReminder(page);
      const focus = await page.locator('#focus-message-text').boundingBox();
      const amount = await page.locator('.value-block').boundingBox();
      const progress = await page.locator('.lesson-progress').boundingBox();
      assert(focus.height >= 24 && focus.width <= width - 40);
      assert(focus.y >= amount.y + amount.height && focus.y + focus.height <= progress.y);
      await page.locator('#preferences-open').click();
      await page.locator('#language-choice').selectOption('zh-CN');
      await page.locator('#preferences-save').click();
      await page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#focus-message-text').textContent(), '好好上课！');
      assert.equal(await page.locator('#focus-message-text').evaluate(element => getComputedStyle(element).whiteSpace), 'normal');
      await expectLargeReminder(page);
      assert.deepEqual(await page.locator('#focus-message-text .reminder-letters').allTextContents(), ['好好', '上课']);
      if (portraitHeight(width) > 600) assert(await page.locator('#focus-message-text').evaluate(element => element.firstElementChild.getBoundingClientRect().top < element.lastElementChild.getBoundingClientRect().top));
      await page.clock.setSystemTime(new Date('2026-10-14T13:00:00Z'));
      await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      assert.equal(await page.locator('#focus-message-text').textContent(), '好好休息！');
      for (const language of ['zh-CN', 'en-US', 'ja-JP', 'zh-TW', 'ko-KR', 'es-ES']) {
        await page.locator('#preferences-open').click();
        await page.locator('#language-choice').selectOption(language);
        await page.locator('#preferences-save').click();
        await page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
        await expectLargeReminder(page);
        await capturePortrait(page, language, 'rest');
        await expectLandscape(page, width);
        await page.clock.setSystemTime(new Date('2026-10-14T10:10:00Z'));
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        await expectLargeReminder(page);
        await capturePortrait(page, language, 'live');
        await expectLandscape(page, width);
        await page.clock.setSystemTime(new Date('2026-10-14T13:00:00Z'));
        await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      }
      await page.locator('#preferences-open').click();
      await page.locator('#language-choice').selectOption('en-US');
      await page.locator('#preferences-save').click();
      await page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('#focus-message-text').textContent(), 'Rest well!');
      const size = await page.locator('.window-shell').boundingBox();
      assert.equal(size.width, width);
      assert.equal(size.height, portraitHeight(width));
      await page.locator('#preferences-open').click();
      assert.equal(await page.locator('#language-choice').inputValue(), 'en-US');
      await page.locator('#preferences-cancel').click();
      await page.reload();
      assert.equal(await page.locator('#preferences-dialog').isVisible(), false);
      assert(await page.locator('#focus-message').isVisible());
      assert.equal(await page.locator('#focus-message-text').textContent(), 'Rest well!');
      await page.locator('#settings-open').click();
      assert(await page.evaluate(() => {
        const dialog = document.querySelector('#settings-dialog');
        return dialog.scrollWidth <= dialog.clientWidth + 1;
      }));
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Mobile smoke passed: 320×568/390×844/430×932 portrait and matching landscape, six languages in live/rest states, centered body text, zero-advance hanging punctuation, maximal fitting size, rotation recovery and no amount/countdown overlap.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
