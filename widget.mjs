import { scheduledOccurrences } from './core.mjs';
import { validatePreferences } from './preferences.mjs';

// Export resolved occurrences from the same local-calendar engine used by the app.
// The extension never reinterprets recurrence rules or edits configuration files.
export function widgetSnapshot(configuration, preferences) {
  return {
    version: 1,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...validatePreferences(preferences),
    ...(configuration ? scheduledOccurrences(configuration) : { tuitionCents: 0, semesterDurationMs: 0, sessions: [] }),
  };
}

export function createWidgetSync(invoke, onError = console.warn) {
  let pending;
  let running = false;
  let lastText;
  return async function sync(configuration, preferences) {
    try { pending = JSON.stringify(widgetSnapshot(configuration, preferences)); }
    catch (error) { onError(error); return; }
    if (running) return;
    running = true;
    try {
      while (pending !== undefined) {
        const text = pending;
        pending = undefined;
        if (text === lastText) continue;
        await invoke('sync_widget', { text });
        lastText = text;
      }
    } catch (error) { onError(error); }
    finally { running = false; }
  };
}
