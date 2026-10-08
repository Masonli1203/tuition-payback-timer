import { translate } from './i18n.mjs';
const tauri = window.__TAURI__;
const shell = document.querySelector('.window-shell');
const app = document.querySelector('.app-shell');
const header = document.querySelector('.page-header');
function isDragTarget(event) {
  return !event.target.closest('button, input, a, .window-actions') &&
    event.clientY <= header.getBoundingClientRect().bottom;
}
if (tauri) {
  document.documentElement.dataset.desktop = 'true';
  const current = tauri.window.getCurrentWindow();
  const pin = document.getElementById('window-pin');
  pin.hidden = false;
  pin.disabled = true;
  async function updatePin() {
    const pinned = await current.isAlwaysOnTop();
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = translate(pinned ? '取消置顶' : '置顶窗口');
  }
  pin.addEventListener('click', async () => {
    if (pin.disabled) return;
    pin.disabled = true;
    try {
      await current.setAlwaysOnTop(!(await current.isAlwaysOnTop()));
      await updatePin();
    } catch (error) {
      const notice = document.getElementById('main-notice');
      notice.hidden = false;
      notice.textContent = translate(`置顶操作失败：${error.message ?? error}`);
    } finally { pin.disabled = false; }
  });
  try { await updatePin(); }
  finally { pin.disabled = false; }
  const maximizeButton = document.querySelectorAll('.window-button')[1];
  async function updateMaximized() {
    const maximized = await current.isMaximized();
    document.getElementById('focus-message').hidden = !maximized;
    maximizeButton.setAttribute('aria-label', translate(maximized ? '还原窗口' : '最大化'));
    maximizeButton.title = maximizeButton.getAttribute('aria-label');
  }
  await current.onResized(() => updateMaximized());
  await updateMaximized();
  window.addEventListener('preferences-changed', () => {
    updatePin();
    updateMaximized();
    document.querySelectorAll('.window-button').forEach(button => { button.title = button.getAttribute('aria-label'); });
  });
  const operations = ['minimize', 'toggleMaximize', 'close'];
  document.querySelectorAll('.window-button').forEach((button, index) => {
    button.removeAttribute('aria-disabled');
    button.title = button.getAttribute('aria-label');
    button.addEventListener('click', async () => {
      try { await current[operations[index]](); }
      catch (error) {
        const notice = document.getElementById('main-notice');
        notice.hidden = false;
        notice.textContent = translate(`窗口操作失败：${error.message ?? error}`);
      }
    });
  });
  app.addEventListener('mousedown', async event => {
    if (event.button !== 0 || !isDragTarget(event)) return;
    event.preventDefault();
    try {
      if (event.detail === 2) await current.toggleMaximize();
      else await current.startDragging();
    } catch (error) {
      const notice = document.getElementById('main-notice');
      notice.hidden = false;
      notice.textContent = translate(`窗口操作失败：${error.message ?? error}`);
    }
  });
  await tauri.event.listen('save-in-progress', () => {
    const feedback = document.getElementById(document.getElementById('preferences-dialog').open ? 'preferences-feedback' : 'feedback');
    feedback.textContent = translate('配置正在保存，请等待成功后再关闭。');
  });
  window.addEventListener('load', async () => {
    try {
      const path = await tauri.core.invoke('configuration_path');
      document.getElementById('storage-description').textContent = translate(`配置保存位置：${path}。每次覆盖保留备份，保存成功后才生效。`);
    } catch { /* Saving and loading report their own actionable errors. */ }
  }, { once: true });
} else {
  let drag;
  let offset = { x: 0, y: 0 };
  app.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !isDragTarget(event)) return;
    const bounds = shell.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, bounds, offset };
    app.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  app.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) < 3) return;
    offset = {
      x: drag.offset.x + Math.max(-drag.bounds.left, Math.min(innerWidth - drag.bounds.right, dx)),
      y: drag.offset.y + Math.max(-drag.bounds.top, Math.min(innerHeight - drag.bounds.bottom, dy)),
    };
    shell.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    app.addEventListener(eventName, () => { drag = undefined; });
  }
  window.addEventListener('resize', () => {
    drag = undefined;
    offset = { x: 0, y: 0 };
    shell.style.transform = '';
  });
}
