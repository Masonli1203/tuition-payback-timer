// Ask the native host, rather than mistaking every Tauri runtime for desktop.
export const nativePlatform = window.__TAURI__
  ? await window.__TAURI__.core.invoke('runtime_platform')
  : (/iPhone|iPad|iPod|Android/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'mobile-web' : 'web');
export const isMobile = ['ios', 'android', 'mobile-web'].includes(nativePlatform);
if (isMobile) document.documentElement.dataset.mobile = 'true';
