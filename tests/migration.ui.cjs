const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const key = 'tuition-payback.v0.1.session';
const origin = 'http://127.0.0.1:4176';
const original = { version: 3, semester: { tuitionCents: 2400000, startDate: '2026-09-03', endDate: '2026-12-10', demo: false,
  weeklyCourses: [
    { name: '经济学', weekday: 0, startTime: '09:00', durationMs: 5400000 },
    { name: '设计工坊', weekday: 3, startTime: '09:30', durationMs: 9000000, startDate: '2026-10-22', endDate: '2026-12-10' },
  ] } };
const { routeApp } = require('./app-page.cjs');
let browser;
const errors = [];

async function pageFor(text, desktop = false) {
  const context = await browser.newContext({ viewport: { width: 480, height: 420 }, timezoneId: 'America/New_York', acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await routeApp(page, origin);
  await page.addInitScript(({ text, key, desktop }) => {
    localStorage.setItem('tuition-payback.preferences.v1', JSON.stringify({ version: 1, language: 'zh-CN', currency: 'USD' }));
    if (!window.name) { if (text !== null) localStorage.setItem(key, text); window.name = 'initialized'; }
    if (desktop) {
      window.testDisk = text;
      window.testWrites = [];
      window.__TAURI__ = {
        core: { invoke: async (command, args) => {
          if (command === 'load_preferences') return JSON.stringify({ version: 1, language: 'zh-CN', currency: 'USD' });
          if (command === 'load_configuration') return window.testDisk;
          if (command === 'configuration_path') return 'test/configuration.json';
          if (command === 'save_configuration') {
            window.testWrites.push(args.text);
            await new Promise((resolve, reject) => { window.completeSave = resolve; window.failSave = () => reject(new Error('disk full')); });
            window.testDisk = args.text;
          }
        } },
        window: { getCurrentWindow: () => ({ minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, isMaximized: async () => false, onResized: async () => () => {}, isAlwaysOnTop: async () => false, setAlwaysOnTop: async () => {} }) },
        event: { listen: async () => () => {} },
      };
    }
  }, { text, key, desktop });
  await page.goto(origin);
  await page.waitForFunction(() => !document.getElementById('settings-open').disabled);
  return { page, context };
}

async function choose(page, record) {
  await page.locator('#backup-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof record === 'string' ? record : JSON.stringify(record)) });
}

(async () => {
  await fs.mkdir('.runtime', { recursive: true });
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const raw = JSON.stringify(original, null, 2);
  const { page, context } = await pageFor(raw);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw, 'startup must not rewrite');
  await page.locator('#settings-open').click();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#backup-export').click();
  const download = await downloadEvent;
  const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  assert.deepEqual(exported.semester, original.semester);
  assert.equal(exported.source.origin, origin);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw);
  const next = structuredClone(original);
  next.semester.tuitionCents = 3600000;
  await choose(page, next);
  await page.locator('#import-preview').waitFor({ state: 'visible' });
  assert.match(await page.locator('#import-summary').textContent(), /2 门课程.*41 小时/);
  assert.match(await page.locator('#import-summary').textContent(), /36,000/);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw, 'preview must not write');
  await page.screenshot({ path: '.runtime/migration-confirm.png' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#import-cancel').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key), key), raw);
  await choose(page, next);
  await page.locator('#import-confirm').click();
  await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)), { ...next, version: 4 });
  await page.reload();
  await page.locator('#settings-open').click();
  assert.equal(await page.locator('#value').inputValue(), '36000.00');
  await page.locator('#weekday-3').click();
  await page.locator('input[id$="-excludedDateText"]').fill('2026-11-26');
  assert.match(await page.locator('#hours-summary').textContent(), /38 小时 30 分钟/);
  await page.locator('#apply').click();
  await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
  await page.reload();
  await page.locator('#settings-open').click();
  await page.locator('#weekday-3').click();
  assert.equal(await page.locator('input[id$="-excludedDateText"]').inputValue(), '2026-11-26');
  for (const bad of ['{', '{"version":99}', '{"version":3,"semester":{}}']) {
    const before = await page.evaluate(key => localStorage.getItem(key), key);
    await choose(page, bad);
    await page.waitForFunction(() => document.getElementById('backup-status').textContent.startsWith('未导入：'));
    assert.equal(await page.locator('#import-preview').isVisible(), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), before);
  }
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota exceeded'); }; });
  await page.locator('#value').fill('45000');
  await page.locator('#apply').click();
  await page.waitForFunction(() => document.getElementById('feedback').textContent.includes('保存失败'));
  assert.equal(await page.locator('#settings-dialog').isVisible(), true);
  assert.equal(await page.locator('#value').inputValue(), '45000');
  assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).semester.tuitionCents, 3600000);
  await context.close();

  for (const version of [1, 2]) {
    const legacy = JSON.stringify({ version, session: { name: '旧课程', start: new Date('2026-10-08T09:00:00-04:00').getTime(), end: new Date('2026-10-08T10:30:00-04:00').getTime(), tuitionCents: 1200000 } });
    const { page, context } = await pageFor(legacy);
    assert.match(await page.locator('#main-notice').textContent(), /草稿/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), legacy);
    await page.locator('#settings-open').click();
    assert.equal(await page.locator('#value').inputValue(), version === 1 ? '' : '12000.00');
    await choose(page, legacy);
    await page.locator('#import-confirm').click();
    await page.waitForFunction(() => document.getElementById('feedback').textContent.includes('尚未保存'));
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), legacy);
    await page.locator('#value').fill('12000');
    await page.locator('#semester-start').fill('2026-09-03');
    await page.locator('#semester-end').fill('2026-12-10');
    await page.locator('#apply').click();
    await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
    assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), key)).version, 4);
    await context.close();
  }
  for (const bad of ['{', '{"version":99}']) {
    const { page, context } = await pageFor(bad);
    assert.match(await page.locator('#main-notice').textContent(), /原数据保留/);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), key), bad);
    await context.close();
  }

  const desktop = await pageFor(raw, true);
  await desktop.page.locator('#settings-open').click();
  await desktop.page.locator('#value').fill('48000');
  await desktop.page.locator('#apply').click();
  await desktop.page.waitForFunction(() => typeof window.completeSave === 'function');
  assert.equal(await desktop.page.locator('#settings-dialog').isVisible(), true);
  assert.equal(await desktop.page.locator('#value').isDisabled(), true);
  await desktop.page.keyboard.press('Escape');
  assert.equal(await desktop.page.locator('#settings-dialog').isVisible(), true);
  assert.equal(await desktop.page.evaluate(() => JSON.parse(window.testDisk).semester.tuitionCents), 2400000);
  await desktop.page.evaluate(() => window.failSave());
  await desktop.page.waitForFunction(() => document.getElementById('feedback').textContent.includes('保存失败'));
  assert.equal(await desktop.page.locator('#value').inputValue(), '48000');
  assert.equal(await desktop.page.locator('#value').isDisabled(), false);
  await desktop.page.locator('#apply').click();
  await desktop.page.waitForFunction(() => window.testWrites.length === 2);
  await desktop.page.evaluate(() => window.completeSave());
  await desktop.page.locator('#settings-dialog').waitFor({ state: 'hidden' });
  assert.equal(await desktop.page.evaluate(() => JSON.parse(window.testDisk).semester.tuitionCents), 4800000);
  assert.equal(await desktop.page.evaluate(key => localStorage.getItem(key), key), raw, 'desktop must not change browser storage');
  await desktop.context.close();
  const ics = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Fabrication\nDTSTART;TZID=America/New_York:20261022T093000\nDTEND;TZID=America/New_York:20261022T120000\nRRULE:FREQ=WEEKLY;UNTIL=20261210T120000;BYDAY=TH\nEXDATE;TZID=America/New_York:20261126T093000\nEND:VEVENT\nEND:VCALENDAR';
  const calendarPage = await pageFor(raw);
  await calendarPage.page.locator('#settings-open').click();
  await calendarPage.page.locator('#value').fill('36000');
  await calendarPage.page.locator('#backup-file').setInputFiles({name:'classes.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)});
  await calendarPage.page.locator('#import-preview').waitFor({state:'visible'});
  assert.match(await calendarPage.page.locator('#import-summary').textContent(), /17.5 小时/);
  assert.match(await calendarPage.page.locator('#import-summary').textContent(), /2026-11-26/);
  assert.match(await calendarPage.page.locator('#import-summary').textContent(), /36,000/);
  await calendarPage.page.locator('#import-cancel').click();
  assert.equal(await calendarPage.page.evaluate(key=>localStorage.getItem(key),key), raw);
  await calendarPage.page.locator('#backup-file').setInputFiles({name:'classes.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)});
  await calendarPage.page.locator('#import-preview').waitFor({state:'visible'});
  await calendarPage.page.locator('#import-confirm').click();
  assert.equal(await calendarPage.page.evaluate(key=>localStorage.getItem(key),key), raw, 'ICS confirmation only loads the editor');
  assert.match(await calendarPage.page.locator('#feedback').textContent(), /尚未保存/);
  assert.equal(await calendarPage.page.locator('#value').inputValue(),'36000');
  await calendarPage.page.locator('#apply').click();
  await calendarPage.page.locator('#settings-dialog').waitFor({state:'hidden'});
  await calendarPage.page.reload();
  await calendarPage.page.waitForFunction(()=>!document.getElementById('settings-open').disabled);
  await calendarPage.page.locator('#settings-open').click();
  assert.equal(await calendarPage.page.locator('#value').inputValue(),'36000.00');
  assert.match(await calendarPage.page.locator('#hours-summary').textContent(), /17 小时 30 分钟/);
  await calendarPage.context.close();
  const emptyCalendar = await pageFor(null);
  await emptyCalendar.page.locator('#settings-open').click();
  await emptyCalendar.page.locator('#backup-file').setInputFiles({name:'classes.ics',mimeType:'text/calendar',buffer:Buffer.from(ics)});
  await emptyCalendar.page.locator('#import-preview').waitFor({state:'visible'});
  assert.match(await emptyCalendar.page.locator('#import-summary').textContent(), /补填有效学费/);
  await emptyCalendar.page.locator('#import-confirm').click();
  await emptyCalendar.page.locator('#apply').click();
  assert.match(await emptyCalendar.page.locator('#feedback').textContent(), /有效金额/);
  assert.equal(await emptyCalendar.page.evaluate(key=>localStorage.getItem(key),key), null);
  await emptyCalendar.page.locator('#backup-file').setInputFiles({name:'bad.ics',mimeType:'text/calendar',buffer:Buffer.from(ics.replace('FREQ=WEEKLY','FREQ=MONTHLY'))});
  await emptyCalendar.page.waitForFunction(()=>document.getElementById('backup-status').textContent.includes('未导入'));
  assert.equal(await emptyCalendar.page.locator('#import-preview').isHidden(),true);
  await emptyCalendar.context.close();
  assert.deepEqual(errors, []);
  console.log('UI verification passed: JSON migration, save wait/failure/retry, ICS preview/cancel/load/save/reopen, missing tuition and unsupported recurrence, 480×420.');
})().finally(async () => { await browser?.close(); }).catch(error => { console.error(error); process.exitCode = 1; });
