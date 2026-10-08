// Only these public files are served locally and embedded in the desktop app.
// Tests use the same list so missing or stale packaged modules are detectable.
export const appAssets = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ...['app', 'core', 'coins', 'flip-amount', 'configuration', 'persistence',
    'calendar', 'desktop', 'preferences', 'i18n'].map(name => [`${name}.mjs`, 'text/javascript; charset=utf-8']),
]);
