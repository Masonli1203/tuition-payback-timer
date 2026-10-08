import { parseCourseDuration, parseDate, parseTime, semesterCalendar, calculateSemester, createSemesterTimeline, calculateSession, formatDuration, localDateInput } from './core.mjs';
import { CoinPile } from './coins.mjs';
import { FlipAmount } from './flip-amount.mjs';
import { decodeConfiguration, exportConfiguration, maximumFileBytes } from './configuration.mjs';
import { createPersistence } from './persistence.mjs';
import { readCalendar } from './calendar.mjs';
import { createPreferencePersistence, defaultPreferences, languages, currencies, createMoneyFormatters, parseTuition } from './preferences.mjs';
import { translate, t, setLanguage, localizeDocument } from './i18n.mjs';

const $ = id => document.getElementById(id);
const persistence = createPersistence({ invoke: window.__TAURI__?.core.invoke });
const preferencePersistence = createPreferencePersistence({ invoke: window.__TAURI__?.core.invoke });
const updateStaticText = localizeDocument();
let preferences = { ...defaultPreferences };
let preferencesConfirmed = false;
let preferenceLoadError = '';
try {
  const saved = await preferencePersistence.load();
  if (saved) { preferences = saved; preferencesConfirmed = true; }
} catch (error) { preferenceLoadError = error.message; }
let weekdays, fullWeekdays, digits, money, clock, liveClock, dateLabel, sessionDate, moneyFormats;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const settings = $('settings-dialog');
const coinPile = new CoinPile($('coin-canvas'), reducedMotion);
const flipAmount = new FlipAmount($('amount'), $('amount-whole'), $('amount-fraction'));
flipAmount.update('0', '00', null);
let configuration = null;
let legacyDraft = null;
let timeline = null;
let selectedDay = (new Date().getDay() + 6) % 7;
let draftCourses = [];
let timeoutId = null;
let lastRender = -Infinity;
let busy = false;
let ready = false;
let pendingImport = null;
let importRevision = 0;
$('settings-open').disabled = true;

function setText(id, value) {
  if (!['course-name', 'import-summary'].includes(id)) value = translate(value);
  if ($(id).textContent !== value) $(id).textContent = value;
}

function applyPreferences() {
  setLanguage(preferences.language);
  updateStaticText();
  moneyFormats = createMoneyFormatters(preferences);
  coinPile.symbol = moneyFormats.symbol;
  coinPile.reset();
  ({ money, digits } = moneyFormats);
  const locale = preferences.language;
  clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  liveClock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  dateLabel = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' });
  sessionDate = new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' });
  const monday = new Date(2026, 0, 5);
  const weekday = width => Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: width }).format(new Date(monday.getTime() + index * 86400000)));
  fullWeekdays = weekday('long');
  weekdays = locale.startsWith('zh-') ? ['一', '二', '三', '四', '五', '六', '日'] : weekday('short');
  $('selected-language').textContent = languages.find(language => language.code === locale).short;
  $('selected-currency').textContent = preferences.currency;
  $('preferences-open').title = `${translate('语言与货币')} · ${preferences.currency}`;
  $('preferences-open').setAttribute('aria-label', `${translate('语言与货币')}: ${$('selected-language').textContent} · ${preferences.currency}`);
  document.querySelector('#amount .currency').textContent = moneyFormats.symbol;
  document.querySelector('label[for="value"]').firstChild.textContent = translate('学期总学费') + ' ';
  document.querySelector('label[for="value"] span').textContent = preferences.currency;
  document.querySelector('.value-input > span').textContent = moneyFormats.symbol;
  document.querySelector('.value-input').style.setProperty('--currency-width', `${moneyFormats.symbol.length + 1}ch`);
  setText('timezone', `本地时间 · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  setText('storage-description', persistence.desktop ? '桌面配置保存在应用数据目录，保存成功后才生效。' : `浏览器配置来源：${location.origin}。请在原先录入课表的浏览器与地址导出。`);
  setText('semester-recovered', money.format(0));
  $('amount').setAttribute('aria-label', t('本节课已回本 {0}', money.format(0)));
  window.dispatchEvent(new Event('preferences-changed'));
}

const preferenceDialog = $('preferences-dialog');
let savingPreferences = false;
let preferenceReturnFocus;
for (const language of languages) $('language-choice').add(new Option(language.name, language.code));
function updatePreferenceDialog() {
  const locale = $('language-choice').value;
  for (const [id, source] of [
    ['preferences-heading', '语言与货币'],
    ['preferences-intro', '选择你习惯的语言和学费计价货币，以后也可以修改。'],
    ['currency-hint', '请选择学费实际使用的货币。切换仅更改计价单位，不进行汇率换算。'],
    ['preferences-save', preferencesConfirmed ? '保存设置' : '开始使用'],
    ['preferences-cancel', preferencesConfirmed ? '取消' : '稍后设置'],
  ]) $(id).textContent = translate(source, locale);
  document.querySelector('label[for="language-choice"]').textContent = translate('语言 / Language', locale);
  document.querySelector('label[for="currency-choice"]').textContent = translate('货币', locale);
  const selectedCurrency = $('currency-choice').value || preferences.currency;
  const names = new Intl.DisplayNames(locale, { type: 'currency' });
  $('currency-choice').replaceChildren(...currencies.map(code => new Option(`${code} · ${names.of(code)}`, code)));
  $('currency-choice').value = selectedCurrency;
  preferenceDialog.lang = locale;
}
function openPreferences() {
  if (!ready || busy || savingPreferences) return;
  preferenceReturnFocus = document.activeElement;
  $('language-choice').value = preferences.language;
  $('currency-choice').value = preferences.currency;
  updatePreferenceDialog();
  $('preferences-feedback').textContent = preferenceLoadError ? translate(`偏好设置读取失败，原数据保留。${preferenceLoadError}`, $('language-choice').value) : '';
  preferenceDialog.showModal();
}
$('preferences-open').addEventListener('click', openPreferences);
$('language-choice').addEventListener('change', () => { updatePreferenceDialog(); $('preferences-feedback').textContent = ''; });
$('preferences-cancel').addEventListener('click', () => { if (!savingPreferences) preferenceDialog.close(); });
preferenceDialog.addEventListener('cancel', event => { if (savingPreferences) event.preventDefault(); });
preferenceDialog.addEventListener('close', () => (preferenceReturnFocus?.closest('button') || $('preferences-open')).focus());
$('preferences-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (savingPreferences || busy) return;
  savingPreferences = true;
  for (const id of ['language-choice', 'currency-choice', 'preferences-save', 'preferences-cancel']) $(id).disabled = true;
  $('preferences-form').setAttribute('aria-busy', 'true');
  $('preferences-save').textContent = translate('正在保存…', $('language-choice').value);
  $('preferences-feedback').textContent = '';
  try {
    const saved = await preferencePersistence.save({ language: $('language-choice').value, currency: $('currency-choice').value });
    preferences = saved;
    preferencesConfirmed = true;
    preferenceLoadError = '';
    applyPreferences();
    renderDay();
    updatePreview();
    resume();
    preferenceDialog.close();
  } catch (error) {
    $('preferences-feedback').textContent = translate(`偏好设置保存失败，请重试。${error.message ?? error}`, $('language-choice').value);
    $('preferences-feedback').dataset.state = 'error';
  } finally {
    savingPreferences = false;
    for (const id of ['language-choice', 'currency-choice', 'preferences-save', 'preferences-cancel']) $(id).disabled = false;
    $('preferences-form').setAttribute('aria-busy', 'false');
    updatePreferenceDialog();
  }
});

function showNotice(message) {
  setText('main-notice', message);
  $('main-notice').hidden = !message;
}

function clearErrors() {
  for (const input of settings.querySelectorAll('[aria-invalid]')) input.removeAttribute('aria-invalid');
  for (const error of settings.querySelectorAll('.field-error')) { error.hidden = true; error.textContent = ''; }
}

function showError(error) {
  if (error.message === '金额须在 $0.01 至 $9,999,999.99 之间。') error.message = t('金额须在 {0} 至 {1} 之间。', money.format(0.01), money.format(9999999.99));
  if (error.courseId) {
    selectedDay = draftCourses.find(course => course.id === error.courseId).weekday;
    renderDay();
  }
  if (error.field && $(error.field)) {
    $(error.field).setAttribute('aria-invalid', 'true');
    setText(`${error.field}-error`, error.message);
    $(`${error.field}-error`).hidden = false;
    $(error.field).focus();
  }
  setText('feedback', error.message);
  $('feedback').dataset.state = 'error';
}

function readField(id, parse) {
  try { return parse($(id).value); }
  catch (error) { error.field = id; throw error; }
}

function readConfiguration() {
  const tuitionCents = readField('value', value => parseTuition(value, preferences.language));
  readField('semester-start', parseDate);
  readField('semester-end', parseDate);
  const startDate = $('semester-start').value;
  const endDate = $('semester-end').value;
  if (endDate < startDate) {
    const error = new Error('学期结束日期不能早于开始日期。');
    error.field = 'semester-end';
    throw error;
  }
  const weeklyCourses = draftCourses.map(course => {
    const name = course.name.trim();
    let field = `row-${course.id}-name`;
    try {
      if (!name || name.length > 80) throw new Error('请填写课程名称，最多 80 个字符。');
      field = `row-${course.id}-startTime`;
      parseTime(course.startTime);
      field = `row-${course.id}-hours`;
      let durationMs;
      try { durationMs = parseCourseDuration(course.hours, course.minutes); }
      catch (error) { field = `row-${course.id}-${error.part}`; throw error; }
      field = `row-${course.id}-startDate`;
      if (course.startDate) parseDate(course.startDate);
      const courseStart = course.startDate || startDate;
      if (courseStart < startDate || courseStart > endDate) throw new Error('课程开始日期须在学期范围内。');
      field = `row-${course.id}-endDate`;
      if (course.endDate) parseDate(course.endDate);
      const courseEnd = course.endDate || endDate;
      if (courseEnd < startDate || courseEnd > endDate) throw new Error('课程结束日期须在学期范围内。');
      if (courseEnd < courseStart) throw new Error('课程结束日期不能早于开始日期。');
      field = `row-${course.id}-excludedDateText`;
      const excludedDates = [...new Set((course.excludedDateText || '').trim().split(/[\s,，;；]+/).filter(Boolean))];
      for (const date of excludedDates) {
        const timestamp = parseDate(date);
        if (date < courseStart || date > courseEnd || (new Date(timestamp).getDay() + 6) % 7 !== course.weekday) throw new Error('停课日期须是课程日期范围内的上课日。');
      }
      return { weekday: course.weekday, name, startTime: course.startTime, durationMs,
        ...(course.startDate ? { startDate: course.startDate } : {}),
        ...(course.endDate ? { endDate: course.endDate } : {}),
        ...(excludedDates.length ? { excludedDates } : {}) };
    } catch (error) { error.courseId = course.id; error.field = field; throw error; }
  });
  return { tuitionCents, startDate, endDate, weeklyCourses, demo: false };
}

function updatePreview() {
  try {
    const calendar = semesterCalendar($('semester-start').value, $('semester-end').value);
    const state = calendar.currentWeek ? `当前第 ${calendar.currentWeek} 周` : calendar.state === 'waiting' ? '学期未开始' : '学期已结束';
    setText('calendar-summary', `共 ${calendar.days} 天，${calendar.weeks} 周；${state}`);
    $('calendar-summary').hidden = false;
  } catch { $('calendar-summary').hidden = true; }
  try {
    const summary = calculateSemester(readConfiguration());
    const totalMinutes = Math.round(summary.semesterDurationMs / 60000);
    setText('hours-summary', `学期总上课时长：${Math.floor(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分钟`);
    setText('rate', t('{0} / 秒', moneyFormats.rate(summary.rate)));
    $('hours-summary').hidden = $('rate-summary').hidden = false;
  } catch { $('hours-summary').hidden = $('rate-summary').hidden = true; }
}

function rowField(course, key, text, type) {
  const field = document.createElement('div');
  field.className = 'field';
  const input = document.createElement('input');
  input.id = `row-${course.id}-${key}`;
  input.type = type;
  input.value = course[key];
  input.required = type !== 'date' && key !== 'hours' && key !== 'minutes' && key !== 'excludedDateText';
  input.dataset.courseId = course.id;
  input.dataset.field = key;
  input.setAttribute('aria-describedby', `${input.id}-error`);
  if (key === 'name') { input.maxLength = 80; input.placeholder = translate('例如：经济学'); }
  if (key === 'hours' || key === 'minutes') { input.inputMode = 'numeric'; input.placeholder = '0'; }
  if (key === 'excludedDateText') input.placeholder = translate('例如：2026-11-26，多日用逗号分隔');
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.textContent = translate(text);
  const error = document.createElement('p');
  error.id = `${input.id}-error`;
  error.className = 'field-error';
  error.hidden = true;
  field.append(label, input, error);
  return field;
}

function renderDay() {
  const tabs = $('weekday-tabs');
  tabs.replaceChildren();
  weekdays.forEach((day, index) => {
    const count = draftCourses.filter(course => course.weekday === index).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'weekday-tab';
    button.id = `weekday-${index}`;
    button.dataset.weekday = index;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-label', t('{0}，{1}节课', fullWeekdays[index], count));
    button.setAttribute('aria-controls', 'day-panel');
    button.setAttribute('aria-selected', String(index === selectedDay));
    button.tabIndex = index === selectedDay ? 0 : -1;
    button.textContent = day;
    const badge = document.createElement('span');
    badge.className = 'day-count';
    badge.textContent = String(count);
    button.append(badge);
    tabs.append(button);
  });
  $('day-panel').setAttribute('aria-labelledby', `weekday-${selectedDay}`);
  setText('day-heading', fullWeekdays[selectedDay]);
  const rows = $('course-rows');
  rows.replaceChildren();
  const courses = draftCourses.filter(course => course.weekday === selectedDay);
  $('day-empty').hidden = !!courses.length;
  for (const course of courses) {
    const row = document.createElement('div');
    row.className = 'course-row';
    const nameField = rowField(course, 'name', '课程名称', 'text');
    const heading = document.createElement('div');
    heading.className = 'course-row-heading';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon-button';
    remove.dataset.remove = course.id;
    remove.setAttribute('aria-label', t('移除{0}', course.name || translate('这节课程')));
    remove.title = translate('移除课程');
    remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    heading.append(nameField.firstChild, remove);
    nameField.prepend(heading);
    const details = document.createElement('div');
    details.className = 'course-details course-timing';
    const duration = document.createElement('fieldset');
    duration.className = 'course-duration';
    const legend = document.createElement('legend');
    legend.textContent = translate('课程时长');
    const durationInputs = document.createElement('div');
    durationInputs.className = 'duration-inputs';
    durationInputs.append(rowField(course, 'hours', '小时', 'text'), rowField(course, 'minutes', '分钟', 'text'));
    duration.append(legend, durationInputs);
    details.append(rowField(course, 'startTime', '上课时间', 'time'), duration);
    const dates = document.createElement('div');
    dates.className = 'course-details course-dates';
    dates.append(rowField(course, 'startDate', '课程开始日期', 'date'), rowField(course, 'endDate', '课程结束日期', 'date'));
    const hint = document.createElement('p');
    hint.className = 'setting-hint course-dates-hint';
    hint.textContent = translate('日期留空沿用学期起止日期；仅在课程日期范围内每周重复。');
    if (course.durationRounded) hint.textContent += translate(' 原时长含秒，已四舍五入到整分钟，保存后生效。');
    const exclusions = rowField(course, 'excludedDateText', '停课日期（可选）', 'text');
    exclusions.classList.add('course-exclusions');
    row.append(nameField, details, dates, hint, exclusions);
    rows.append(row);
  }
}

function openSettings(source = configuration || legacyDraft) {
  if (!ready || busy) return;
  cancelImport();
  $('value').value = source?.tuitionCents == null ? '' : (source.tuitionCents / 100).toFixed(2).replace('.', moneyFormats.decimal);
  $('semester-start').value = source?.startDate || '';
  $('semester-end').value = source?.endDate || '';
  draftCourses = (source?.weeklyCourses || []).map(course => {
    const totalMinutes = Math.round(course.durationMs / 60000);
    return { ...course, id: crypto.randomUUID(), hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60), durationRounded: course.durationMs % 60000 !== 0, startDate: course.startDate || '', endDate: course.endDate || '', excludedDateText: (course.excludedDates || []).join(', ') };
  });
  selectedDay = (new Date().getDay() + 6) % 7;
  renderDay();
  clearErrors();
  setText('feedback', '');
  pendingImport = null;
  $('import-preview').hidden = true;
  $('backup-status').textContent = '';
  updatePreview();
  if (!settings.open) settings.showModal();
}

function renderSessionLabels(session, now) {
  setText('course-name', session ? session.name : '尚未设置课程');
  $('course-name').title = session ? session.name : '';
  $('empty-hint').hidden = !!session;
  $('demo-tag').hidden = !configuration.demo;
  if (session) {
    const today = new Date(now).toDateString();
    const showDate = new Date(session.start).toDateString() !== today || new Date(session.end).toDateString() !== today;
    const label = timestamp => showDate ? `${sessionDate.format(timestamp)} ${clock.format(timestamp)}` : clock.format(timestamp);
    setText('start-label', `开始 ${label(session.start)}`);
    setText('end-label', `下课 ${label(session.end)}`);
  }
}

function render(now = Date.now(), animateAmount = false) {
  setText('current-date', dateLabel.format(now));
  setText('current-time', liveClock.format(now));
  if (!configuration) {
    setText('focus-message-text', '好好休息！');
    return;
  }
  const { calendar, session, recovery } = timeline(now);
  const context = calendar.currentWeek ? `第 ${calendar.currentWeek} 周 / 共 ${calendar.weeks} 周` : `${calendar.state === 'waiting' ? '学期未开始' : '学期已结束'} / 共 ${calendar.weeks} 周`;
  setText('semester-context', context);
  $('semester-context').hidden = false;
  renderSessionLabels(session, now);
  setText('semester-recovered', money.format(recovery.recovered));
  $('semester-recovery').title = translate(`按课表已结束的 ${recovery.completedSessions} 节课累计，下课后计入`);
  $('semester-recovery').hidden = false;
  const view = session ? calculateSession(session, now) : null;
  setText('focus-message-text', view?.state === 'live' ? '好好上课！' : '好好休息！');
  if (!session) return;
  const sessionKey = `${session.start}:${session.end}`;
  $('coin-vault').hidden = false;
  const coins = coinPile.update(view.recovered, sessionKey, view.state === 'live');
  setText('coin-summary', t('本节课金币 {0} 枚，每 {1} 一枚', digits.format(coins.count), money.format(10)));
  $('coin-empty').hidden = coins.count > 0;
  setText('coin-next', view.state === 'complete' ? '本节课金币已收齐 · 下节课重新累计' : t('再回本 {0}，落下下一枚', money.format(coins.remaining)));
  const scale = 100;
  const units = view.state === 'complete' ? Math.round(view.recovered * scale) : Math.floor(view.recovered * scale);
  const whole = Math.floor(units / scale);
  const fraction = String(units % scale).padStart(2, '0');
  flipAmount.update(digits.format(whole), fraction, sessionKey, animateAmount && !reducedMotion.matches, moneyFormats.decimal);
  const amountLabel = t('本节课已回本 {0}', money.format(units / scale));
  if ($('amount').getAttribute('aria-label') !== amountLabel) $('amount').setAttribute('aria-label', amountLabel);
  setText('status-text', { waiting: '未开始', live: '进行中', complete: '已结束' }[view.state]);
  $('status').dataset.state = view.state;
  setText('amount-label', '本节课已回本');
  const timeLabel = view.state === 'waiting' ? '距离开课' : '距离下课';
  const countdown = formatDuration(view.remainingMs);
  setText('time-label', timeLabel);
  setText('countdown', countdown);
  const percentage = String(Math.floor(view.progress * 100));
  setText('progress-label', `${percentage}%`);
  if ($('progress').getAttribute('aria-valuenow') !== percentage) $('progress').setAttribute('aria-valuenow', percentage);
  const progressLabel = translate(`已完成 ${percentage}%，${view.state === 'complete' ? '已下课' : `${timeLabel} ${countdown}`}`);
  if ($('progress').getAttribute('aria-valuetext') !== progressLabel) $('progress').setAttribute('aria-valuetext', progressLabel);
  $('progress-fill').style.transform = `scaleX(${view.progress})`;
}

function stopLoop() {
  clearTimeout(timeoutId);
  timeoutId = null;
}

function tick() {
  if (document.hidden) return;
  const now = Date.now();
  render(now, now > lastRender && now - lastRender <= 1500);
  lastRender = now;
  // Align the next page turn with the clock's next whole second. Amounts
  // still come from real timestamps, so delayed ticks never lose money.
  timeoutId = setTimeout(tick, Math.max(16, 1000 - Date.now() % 1000));
}

function resume() {
  stopLoop();
  coinPile.settle();
  flipAmount.settle();
  coinPile.skipNextDrop = true;
  timeline = configuration ? createSemesterTimeline(configuration) : null;
  lastRender = -Infinity;
  tick();
}

function activate(next, message) {
  calculateSemester(next);
  configuration = next;
  coinPile.reset();
  legacyDraft = null;
  showNotice('');
  setText('announcement', message);
  resume();
}

function setBusy(value) {
  busy = value;
  $('editor-fields').disabled = value;
  for (const id of ['settings-close', 'settings-cancel', 'demo', 'backup-export', 'backup-import', 'import-confirm', 'import-cancel']) $(id).disabled = value;
  $('session-form').setAttribute('aria-busy', String(value));
  $('apply').textContent = translate(value ? '正在保存…' : '保存学期与课表');
}

async function saveConfiguration(next, message) {
  if (busy) return;
  setBusy(true);
  setText('feedback', '正在保存，请等待成功后再关闭窗口…');
  $('feedback').dataset.state = 'saving';
  try {
    const saved = await persistence.save(next);
    activate(saved, message);
    pendingImport = null;
    $('import-preview').hidden = true;
    settings.close();
  } catch (error) {
    showError(new Error(`保存失败，编辑内容已保留。请检查磁盘空间或写入权限后重试。${error.message ? `（${error.message}）` : ''}`));
  } finally { setBusy(false); }
}

function cancelImport() {
  importRevision++;
  pendingImport = null;
  $('import-preview').hidden = true;
  $('import-confirm').disabled = true;
}

$('settings-open').addEventListener('click', () => openSettings());
$('settings-close').addEventListener('click', () => { if (!busy) settings.close(); });
$('settings-cancel').addEventListener('click', () => { if (!busy) settings.close(); });
settings.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
settings.addEventListener('close', () => $('settings-open').focus());
$('weekday-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-weekday]');
  if (!button) return;
  selectedDay = Number(button.dataset.weekday);
  renderDay();
  $(`weekday-${selectedDay}`).focus();
});
$('weekday-tabs').addEventListener('keydown', event => {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  selectedDay = event.key === 'Home' ? 0 : event.key === 'End' ? 6 : (selectedDay + (event.key === 'ArrowRight' ? 1 : 6)) % 7;
  renderDay();
  $(`weekday-${selectedDay}`).focus();
});
$('add-course').addEventListener('click', () => {
  const course = { id: crypto.randomUUID(), weekday: selectedDay, name: '', startTime: '09:00', hours: '1', minutes: '30', startDate: '', endDate: '' };
  draftCourses.push(course);
  renderDay();
  updatePreview();
  $(`row-${course.id}-name`).focus();
});
$('course-rows').addEventListener('click', event => {
  const button = event.target.closest('[data-remove]');
  if (!button) return;
  draftCourses = draftCourses.filter(course => course.id !== button.dataset.remove);
  renderDay();
  updatePreview();
  $('add-course').focus();
});
$('session-form').addEventListener('input', event => {
  if (event.target.dataset.courseId) {
    const course = draftCourses.find(row => row.id === event.target.dataset.courseId);
    course[event.target.dataset.field] = event.target.value;
    if (event.target.dataset.field === 'hours' || event.target.dataset.field === 'minutes') course.durationRounded = false;
  }
  clearErrors();
  setText('feedback', '');
  cancelImport();
  updatePreview();
});
$('session-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearErrors();
  try {
    const next = readConfiguration();
    await saveConfiguration(next, '已保存学期与课表，按课表自动切换课程。');
  } catch (error) { showError(error); }
});
$('demo').addEventListener('click', async () => {
  const now = new Date();
  const lessonStart = new Date(now.getTime() - 12 * 60000);
  lessonStart.setSeconds(0, 0);
  const start = new Date(now); start.setDate(start.getDate() - 35);
  const end = new Date(now); end.setDate(end.getDate() + 63);
  await saveConfiguration({ tuitionCents: 2400000, startDate: localDateInput(start.getTime()).slice(0, 10), endDate: localDateInput(end.getTime()).slice(0, 10), weeklyCourses: [{ name: '经济学', weekday: (lessonStart.getDay() + 6) % 7, startTime: localDateInput(lessonStart.getTime()).slice(11, 16), durationMs: 150 * 60000 }], demo: true }, '已载入实时课表示例。');
});

$('backup-export').addEventListener('click', async () => {
  if (busy) return;
  try {
    if (!configuration) throw new Error('没有已保存的完整配置。请先补充并保存学期和课表。');
    const text = exportConfiguration(configuration, { origin: persistence.desktop ? 'desktop' : location.origin, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, currency: preferences.currency });
    const filename = `tuition-payback-${localDateInput(Date.now()).replace(/[:T]/g, '-').slice(0, 19)}.json`;
    const exported = await persistence.exportFile(text, filename);
    setText('backup-status', exported ? (persistence.desktop ? '备份文件已保存；原配置保留。' : '已发起完整配置下载，请在浏览器下载列表确认。原浏览器数据保留。') : '已取消导出。');
  } catch (error) { setText('backup-status', `导出失败：${error.message}`); }
});
$('backup-import').addEventListener('click', () => { if (!busy) $('backup-file').click(); });
$('backup-file').addEventListener('change', async () => {
  const file = $('backup-file').files[0];
  $('backup-file').value = '';
  cancelImport();
  if (!file || busy) return;
  const revision = importRevision;
  try {
    if (file.size > maximumFileBytes) throw new Error('配置文件过大，最多支持 1 MB。');
    const text = await file.text();
    if (revision !== importRevision || !settings.open || busy) return;
    const isCalendar = /\.ics$/i.test(file.name) || /^\s*BEGIN:VCALENDAR/i.test(text);
    pendingImport = isCalendar ? readCalendar(text) : decodeConfiguration(text);
    const imported = pendingImport;
    $('import-heading').textContent = translate(isCalendar ? '课表导入前核对' : '恢复前核对');
    if (isCalendar) {
      imported.tuitionText = $('value').value;
      try { imported.draft.tuitionCents = parseTuition(imported.tuitionText, preferences.language); } catch { /* A calendar can be reviewed before tuition is supplied. */ }
      const courses = imported.draft.weeklyCourses.map(course => t('{0} · {1} {2} · {3} 分钟', course.name, fullWeekdays[course.weekday], course.startTime, course.durationMs / 60000) + '\n' + t('{0} 至 {1}', course.startDate, course.endDate) + (course.excludedDates?.length ? ' · ' + t('停课：{0}', course.excludedDates.join(', ')) : '')).join('\n');
      setText('import-summary', [
        t('{0} 个日历事件 · {1} 个课表条目 · 总课时 {2} 小时', imported.eventCount, imported.courseCount, Number((imported.semesterDurationMs / 3600000).toFixed(6))),
        t('扣除 {0} 次停课', imported.exclusionCount), courses,
        t('课表日期范围 {0} 至 {1}（按首末课日）', imported.draft.startDate, imported.draft.endDate),
        t('时区 {0}', imported.timeZone),
        imported.draft.tuitionCents ? t('沿用当前学费 {0}', money.format(imported.draft.tuitionCents / 100)) : translate('ICS 不含学费，请载入后补填有效学费。'),
        translate('确认后仅替换编辑区的课表，核对并点击保存后才生效；原文件与已保存配置保留。'),
      ].join('\n'));
      $('import-confirm').textContent = translate('确认载入课表');
      $('import-confirm').disabled = false;
      $('import-preview').hidden = false;
      $('import-confirm').focus();
      return;
    }
    const excludedSummary = imported.kind === 'configuration'
      ? imported.semester.weeklyCourses.filter(course => course.excludedDates?.length).map(course => t('停课：{0}', `${course.name} · ${course.excludedDates.join(', ')}`)).join('\n') : '';
    const importedCurrency = imported.currency ?? 'USD';
    const importedFormats = createMoneyFormatters({ language: preferences.language, currency: importedCurrency });
    const summary = imported.kind === 'legacy'
      ? t('旧版 {0} 草稿 · {1} 门课程。缺少完整学期信息，总课时无法计算。确认后仅载入编辑草稿，补充日期和学费并保存后才写入。', imported.version, imported.courseCount)
      : [t('{0} 门课程 · 学期总课时 {1} 小时', imported.courseCount, Number((imported.semesterDurationMs / 3600000).toFixed(6))),
        t('学费 {0}', `${importedFormats.money.format(imported.semester.tuitionCents / 100)} ${importedCurrency}`),
        t('学期 {0} 至 {1}', imported.semester.startDate, imported.semester.endDate),
        t('每秒价值 {0}', importedFormats.rate(imported.rate)), excludedSummary,
        translate(configuration ? '确认将替换当前配置，桌面会保留覆盖前备份。' : '确认后写入配置。'), translate('原浏览器数据和导入文件均保留。')].filter(Boolean).join('\n');
    setText('import-summary', summary);
    $('import-confirm').textContent = translate(imported.kind === 'legacy' ? '确认载入草稿' : '确认恢复配置');
    $('import-confirm').disabled = importedCurrency !== preferences.currency;
    if ($('import-confirm').disabled) setText('backup-status', t('备份货币为 {0}，当前为 {1}。请取消导入，点击主页面的语言与货币按钮修改后再导入；金额不会自动换算。', importedCurrency, preferences.currency));
    $('import-preview').hidden = false;
    $('import-confirm').focus();
  } catch (error) { if (revision === importRevision) setText('backup-status', `未导入：${error.message} 当前设置未改变。`); }
});
$('import-cancel').addEventListener('click', cancelImport);
$('import-confirm').addEventListener('click', async () => {
  if (!pendingImport || busy) return;
  if (pendingImport.kind === 'configuration') {
    await saveConfiguration(pendingImport.semester, '已确认恢复并保存完整配置。');
  } else if (pendingImport.kind === 'calendar') {
    const {draft, tuitionText} = pendingImport;
    cancelImport();
    legacyDraft = draft;
    openSettings(draft);
    $('value').value = tuitionText;
    updatePreview();
    setText('feedback', 'ICS 课表已载入编辑区，尚未保存。请核对学费、课程日期和停课信息，点击保存后生效。');
  } else {
    const draft = pendingImport.draft;
    cancelImport();
    legacyDraft = draft;
    openSettings(draft);
    setText('feedback', '旧版草稿已载入，尚未保存；请补充学期信息后保存。');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopLoop(); coinPile.settle(); flipAmount.settle(); }
  else resume();
});
window.addEventListener('pageshow', resume);
window.addEventListener('focus', resume);
reducedMotion.addEventListener('change', resume);
applyPreferences();
try {
  const saved = await persistence.load();
  if (saved?.kind === 'configuration') {
    activate(saved.semester, '已恢复学期与课表。');
  } else if (saved?.kind === 'legacy') {
    legacyDraft = saved.draft;
    showNotice('请点击齿轮补充学期学费、起止日期和每周课表；原课程已保留为未保存草稿。');
  }
} catch (error) { showNotice(`未能读取上次设置：${error?.message ?? String(error)} 原数据保留，可在设置中恢复备份。`); }
ready = true;
$('settings-open').disabled = false;
$('preferences-open').disabled = false;
setText('storage-description', persistence.desktop ? '桌面配置保存在应用数据目录，保存成功后才生效。' : `浏览器配置来源：${location.origin}。请在原先录入课表的浏览器与地址导出。`);
resume();
if (!preferencesConfirmed) openPreferences();
