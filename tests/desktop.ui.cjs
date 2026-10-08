// Build with npm run desktop:build:verification, then npm run test:desktop.
// Both installer and data directory use an isolated identifier.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const root = path.resolve('.runtime/desktop-verification');
const installDir = path.join(root, 'installed');
const exe = path.join(installDir, 'tuition-payback.exe');
const version = require('../package.json').version;
const installer = path.resolve(`src-tauri/target/release/bundle/nsis/Tuition Locale Verification_${version}_x64-setup.exe`);
const data = path.join(process.env.APPDATA, 'com.mason.tuition-payback.locale-verification');
assert.equal(path.basename(data), 'com.mason.tuition-payback.locale-verification');
const configPath = path.join(data, 'configuration.json');
const prefsPath = path.join(data, 'preferences.json');
const formalConfigPath = path.join(process.env.APPDATA, 'com.mason.tuition-payback', 'configuration.json');
const formalPrefsPath = path.join(process.env.APPDATA, 'com.mason.tuition-payback', 'preferences.json');
const fixture = JSON.stringify({ version: 4, semester: { tuitionCents: 3600000, startDate: '2026-09-02', endDate: '2026-12-10', demo: false, weeklyCourses: [{ name: '示例课程 · 隔离测试', weekday: 1, startTime: '12:20', durationMs: 9000000 }] } });
const quote = value => "'" + value.replaceAll("'", "''") + "'";
let active;
const errors = [];
async function install() {
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$installer = Start-Process -FilePath ${quote(installer)} -ArgumentList ${quote(`/S /D=${installDir}`)} -WindowStyle Hidden -Wait -PassThru; $installer.ExitCode`], { windowsHide: true });
  assert.equal(stdout.trim(), '0', 'isolated NSIS installation');
  await fs.access(exe);
}
async function optionalFile(file) {
  try { return await fs.readFile(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function launch() {
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Start-Process -FilePath ${quote(exe)} -WindowStyle Hidden -PassThru).Id`], { windowsHide: true, env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9236' } });
  const pid = Number(stdout.trim());
  let browser;
  for (let index = 0; index < 80; index++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:9236'); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert(browser, 'native WebView2 must start');
  let page;
  for (let index = 0; index < 80; index++) {
    page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes('tauri.localhost'));
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => !document.getElementById('preferences-open').disabled);
  assert.match(await page.evaluate(() => __TAURI__.core.invoke('configuration_path')), /com\.mason\.tuition-payback\.locale-verification/);
  await page.clock.setFixedTime(new Date('2026-10-06T13:00:00-04:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  return { page, browser, pid };
}
async function close() {
  const app = active;
  await app.page.locator('.window-close').click();
  for (let index = 0; index < 50; index++) {
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `if (Get-Process -Id ${app.pid} -ErrorAction SilentlyContinue) { 'running' }`], { windowsHide: true });
    if (!stdout.trim()) { active = null; return; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('native window did not close');
}
async function choose(language, currency) {
  await active.page.locator('#language-choice').selectOption(language);
  await active.page.locator('#currency-choice').selectOption(currency);
  await active.page.locator('#preferences-save').click();
  await active.page.locator('#preferences-dialog').waitFor({ state: 'hidden' });
}
(async () => {
  const formalBefore = await optionalFile(formalConfigPath);
  const formalPrefsBefore = await optionalFile(formalPrefsPath);
  await fs.mkdir(data, { recursive: true });
  await fs.mkdir(root, { recursive: true });
  await install();
  console.log('Native: isolated installation ready.');
  try { await fs.copyFile(prefsPath, path.join(root, `native-preferences-before-${Date.now()}.json`)); await fs.chmod(prefsPath, 0o666); await fs.unlink(prefsPath); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.writeFile(configPath, fixture);
  active = await launch();
  const page = active.page;
  await page.locator('#preferences-dialog').waitFor({ state: 'visible' });
  await page.locator('#language-choice').selectOption('en-US');
  await page.waitForTimeout(200);
  assert(await page.locator('#preferences-dialog').evaluate(element => element.scrollHeight <= element.clientHeight));
  await page.screenshot({ path: path.join(root, 'native-first-use.png') });
  await choose('en-US', 'USD');
  assert.deepEqual(JSON.parse(await fs.readFile(prefsPath, 'utf8')), { version: 1, language: 'en-US', currency: 'USD' });
  assert.equal(await fs.readFile(configPath, 'utf8'), fixture);
  await page.locator('.window-button').nth(1).click();
  await page.locator('#focus-message').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#focus-message p').textContent(), 'Focus on class!');
  assert(await page.locator('#focus-message p').evaluate(element => element.getBoundingClientRect().width <= element.parentElement.getBoundingClientRect().width));
  await page.clock.setFixedTime(new Date('2026-10-06T14:50:00-04:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  assert.equal(await page.locator('#focus-message p').textContent(), 'Rest well!');
  await page.screenshot({ path: path.join(root, 'native-rest-message.png') });
  await page.clock.setFixedTime(new Date('2026-10-06T12:20:00-04:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  assert.equal(await page.locator('#focus-message p').textContent(), 'Focus on class!');
  await page.locator('.window-button').nth(1).click();
  await page.locator('#focus-message').waitFor({ state: 'hidden' });
  await close();
  active = await launch();
  assert.equal(await active.page.locator('#preferences-dialog').isVisible(), false);
  assert.equal(await active.page.locator('#selected-language').textContent(), 'English');
  await fs.chmod(prefsPath, 0o444);
  await active.page.locator('#preferences-open').click();
  await active.page.locator('#language-choice').selectOption('ja-JP');
  await active.page.locator('#currency-choice').selectOption('JPY');
  await active.page.locator('#preferences-save').click();
  await active.page.waitForFunction(() => !document.getElementById('preferences-save').disabled);
  assert(await active.page.locator('#preferences-dialog').isVisible());
  assert.match(await active.page.locator('#preferences-feedback').textContent(), /保存できません/);
  assert.equal(await active.page.locator('#selected-currency').textContent(), 'USD');
  assert.equal(JSON.parse(await fs.readFile(prefsPath, 'utf8')).currency, 'USD');
  await fs.chmod(prefsPath, 0o666);
  await choose('ja-JP', 'JPY');
  assert.equal(await active.page.locator('#selected-currency').textContent(), 'JPY');
  for (const [language, amount, heading, focus] of [
    ['zh-TW', '本堂課已回本', '學期與課表', '好好上課！'],
    ['ko-KR', '이번 수업 회수액', '학기 및 시간표', '수업에 집중하세요!'],
    ['es-ES', 'Recuperado en esta clase', 'Semestre y cursos', '¡Concéntrate en clase!'],
  ]) {
    await active.page.locator('#preferences-open').click();
    await choose(language, 'USD');
    assert.equal(JSON.parse(await fs.readFile(prefsPath, 'utf8')).language, language);
    assert.equal(await active.page.locator('#amount-label').textContent(), amount);
    await active.page.locator('#settings-open').click();
    assert.equal(await active.page.locator('#settings-heading').textContent(), heading);
    assert.equal(await active.page.locator('#value').inputValue(), language === 'es-ES' ? '36000,00' : '36000.00');
    await active.page.locator('#settings-cancel').click();
    await active.page.locator('.window-button').nth(1).click();
    await active.page.locator('#focus-message').waitFor({ state: 'visible' });
    assert.equal(await active.page.locator('#focus-message p').textContent(), focus);
    assert(await active.page.locator('#focus-message p').evaluate(element => element.getBoundingClientRect().width <= element.parentElement.getBoundingClientRect().width), `${language}: maximized message fits`);
    await active.page.locator('.window-button').nth(1).click();
    await active.page.locator('#focus-message').waitFor({ state: 'hidden' });
    await active.page.screenshot({ path: path.join(root, `native-${language}.png`) });
    await close();
    active = await launch();
    assert.equal(await active.page.locator('#preferences-dialog').isVisible(), false);
    assert.equal(await active.page.locator('html').getAttribute('lang'), language);
    assert.equal(await active.page.locator('#selected-currency').textContent(), 'USD');
    assert.equal(await fs.readFile(configPath, 'utf8'), fixture);
  }
  await active.page.locator('#preferences-open').click();
  await choose('ja-JP', 'JPY');
  assert.equal(await active.page.locator('#amount .currency').textContent(), '￥');
  await active.page.locator('#settings-open').click();
  assert.equal(await active.page.locator('#value').inputValue(), '36000.00');
  assert.equal(await active.page.locator('#settings-heading').textContent(), '学期と時間割');
  await active.page.locator('#settings-cancel').click();
  assert(await active.page.locator('.app-shell').evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight));
  await active.page.screenshot({ path: path.join(root, 'native-japanese-jpy.png') });
  await close();
  active = await launch();
  assert.equal(await active.page.locator('#preferences-dialog').isVisible(), false);
  assert.equal(await active.page.locator('#selected-currency').textContent(), 'JPY');
  assert.equal(await fs.readFile(configPath, 'utf8'), fixture);

  // Native window state and recovery use the same prepared timetable.
  console.log('Native: language persistence and preference write failure/retry passed.');
  await active.page.locator('#window-pin').click();
  assert.equal(await active.page.evaluate(() => __TAURI__.window.getCurrentWindow().isAlwaysOnTop()), true);
  await active.page.locator('#window-pin').click();
  assert.equal(await active.page.evaluate(() => __TAURI__.window.getCurrentWindow().isAlwaysOnTop()), false);
  await active.page.evaluate(() => __TAURI__.window.getCurrentWindow().minimize());
  await active.page.clock.setFixedTime(new Date('2026-10-13T13:00:00-04:00'));
  await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class TuitionWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command); }'; [TuitionWindow]::ShowWindowAsync((Get-Process -Id ${active.pid}).MainWindowHandle, 9)`], { windowsHide: true });
  await active.page.waitForFunction(() => document.getElementById('countdown').textContent === '01:50:00' && document.getElementById('semester-recovered').textContent.includes('13,957.50'), null, { timeout: 3000 });
  console.log('Native: pin and minimized recovery passed.');

  // Actual disk failures must preserve edits, then permit a successful retry.
  await active.page.locator('#preferences-open').click();
  await choose('zh-CN', 'USD');
  await active.page.locator('#settings-open').click();
  await fs.chmod(configPath, 0o444);
  await active.page.locator('#value').fill('40000');
  await active.page.locator('#apply').click();
  await active.page.waitForFunction(() => document.getElementById('feedback').textContent.includes('保存失败'));
  assert.equal(await active.page.locator('#value').inputValue(), '40000');
  assert.equal(await fs.readFile(configPath, 'utf8'), fixture);
  await fs.chmod(configPath, 0o666);
  await active.page.locator('#apply').click();
  await active.page.locator('#settings-dialog').waitFor({ state: 'hidden' });
  const savedConfig = await fs.readFile(configPath);
  assert.equal(JSON.parse(savedConfig).semester.tuitionCents, 4000000);
  const backups = (await fs.readdir(data)).filter(file => file.startsWith('configuration.previous-'));
  assert((await Promise.all(backups.map(file => fs.readFile(path.join(data, file), 'utf8')))).includes(fixture));
  await close();
  console.log('Native: configuration failure/retry and raw-byte backup passed.');

  // Reinstall over the same isolated destination and reopen the exact saved bytes.
  const savedPrefs = await fs.readFile(prefsPath);
  await install();
  console.log('Native: overwrite installation completed.');
  assert.deepEqual(await fs.readFile(configPath), savedConfig);
  assert.deepEqual(await fs.readFile(prefsPath), savedPrefs);
  active = await launch();
  await active.page.locator('#settings-open').click();
  assert.equal(await active.page.locator('#value').inputValue(), '40000.00');
  await active.page.locator('#settings-cancel').click();
  await close();

  for (const text of ['{broken', '{"version":99}']) {
    await fs.writeFile(configPath, text);
    active = await launch();
    assert.match(await active.page.locator('#main-notice').textContent(), /原数据保留/);
    assert.equal(await fs.readFile(configPath, 'utf8'), text);
    await close();
  }
  for (const oldVersion of [1, 2]) {
    const text = JSON.stringify({ version: oldVersion, session: { name: 'Legacy fixture',
      start: Date.parse('2026-10-06T09:00:00-04:00'), end: Date.parse('2026-10-06T10:30:00-04:00'), tuitionCents: 1200000 } });
    await fs.writeFile(configPath, text);
    active = await launch();
    assert.match(await active.page.locator('#main-notice').textContent(), /草稿/);
    assert.equal(await fs.readFile(configPath, 'utf8'), text);
    await active.page.locator('#settings-open').click();
    await active.page.locator('#value').fill('12000');
    await active.page.locator('#semester-start').fill('2026-09-01');
    await active.page.locator('#semester-end').fill('2026-12-10');
    await active.page.locator('#apply').click();
    await active.page.locator('#settings-dialog').waitFor({ state: 'hidden' });
    assert.equal(JSON.parse(await fs.readFile(configPath, 'utf8')).version, 4);
    await close();
  }
  assert.deepEqual(await optionalFile(formalConfigPath), formalBefore);
  assert.deepEqual(await optionalFile(formalPrefsPath), formalPrefsBefore);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(root, 'native-result.json'), JSON.stringify({ version, firstUse: true, restart: true,
    preferenceFailureRetry: true, configurationFailureRetry: true, overwriteInstall: true, legacyMigration: true,
    malformedPreserved: true, pin: true, minimizedRecovery: true, localizedNativeControls: true,
    japaneseJPY: true, addedLanguages: ['zh-TW', 'ko-KR', 'es-ES'], formalDataUnchanged: true }, null, 2));
  console.log('Native desktop: preferences, configuration failure/retry, backups, reinstall, legacy migration, malformed files, pin, minimized recovery, locales, layout and formal data preservation passed.');
})().finally(async () => {
  try { await fs.chmod(prefsPath, 0o666); } catch {}
  try { await fs.chmod(configPath, 0o666); } catch {}
  if (active) await close();
}).catch(async error => {
  console.error(error);
  await fs.writeFile(path.join(root, 'failure.txt'), error.stack ?? String(error));
  process.exitCode = 1;
});
