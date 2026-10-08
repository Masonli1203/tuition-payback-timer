# User guide

English | [简体中文](usage.md)

## Set up your semester and courses

First launch preselects English and USD regardless of your system language. Confirm the language and the currency your tuition is actually charged in. You can change them later using the language / currency button beside the course name. Canceling saves nothing, so the prompt appears again next time. Upgrading preserves saved choices. Changing currency does not convert the tuition amount.

Open the gear button, enter total semester tuition and the start and end dates, then add courses by weekday. Each course needs a name, start time, and duration in whole hours and minutes. Minutes range from 0 to 59; a class must last between 1 minute and 24 hours and may cross midnight.

Each course can have its own start and end dates; leave them blank to use the semester dates. Enter excluded dates as `YYYY-MM-DD`, separated by commas. Each exclusion must be a scheduled class day within that course's date range. Overlap checks use actual sessions, so different courses at the same weekly time can coexist when their date ranges do not overlap.

The editor previews total class hours, semester days, weeks, and value per second. Both semester boundary dates are included. The first day starts week 1, with a new week every seven days. Dates come from your entries or the first and last imported class dates; the app does not verify your school's official semester calendar.

Click **Save semester & courses** and wait for success to activate the new timetable. Canceling, closing settings, or pressing Esc discards unsaved edits. Spanish accepts decimal commas such as `1234,56`; do not use thousands separators.

## Timer and window

During class, the app automatically shows the active session. Between classes, it shows the next class and a countdown, with the current-class amount reset to zero. After the final class ends, its result remains visible. The semester total includes only fully ended sessions, including those before you first opened the app.

The desktop window starts at 480 × 420 with a minimum of 400 × 360. Drag the blank top area or date / clock area to move it, and double-click the top area to toggle maximization. Top-right controls are pin, settings, minimize, maximize, and close. Pinning lasts for the current window only and resets after reopening.

When maximized, the app shows **Focus on class!** during class and **Rest well!** before class, between classes, on excluded dates, or after the semester. This message is hidden in the small window.

Coins use the current class's unrounded amount: one per 10 selected currency units, with at most 600 drawn. Switching classes recalculates the pile. Resuming the app immediately shows the current amount and pile. With reduced motion enabled, digits and coins update directly. Once animations settle, no continuous animation-frame loop runs.

Light mode runs from 07:00 inclusive until 19:00; dark mode runs otherwise. This follows the device's local clock, not sunrise, sunset, or location.

## Export and restore JSON

In settings, choose **Export saved data** to save a full JSON backup. It includes tuition, semester dates, course date ranges, exclusions, and currency information. To move from a browser to the desktop app, export from the original browser and address, then import on desktop.

Choose **Import JSON / ICS**, select a JSON file, review the course count, total hours, tuition, and dates, then confirm restoration. Canceling or importing a damaged file does not overwrite the existing configuration. If the backup's currency differs from the current currency, change the app's currency first and import again. Older backups without currency information are treated as USD.

The current timetable format is version 4. Version 3 migrates in memory and is written only after you save. Versions 1 and 2 load as drafts that need completion. Unknown versions and damaged files are preserved. If an older decimal duration includes seconds, the editor reports rounding to whole minutes; this takes effect only when saved.

Desktop saves `configuration.json` and `preferences.json` separately. A save writes a temporary file, flushes it to disk, backs up the previous file's original bytes, then replaces the file atomically. Backup names follow `configuration.previous-TIMESTAMP.json` or `preferences.previous-TIMESTAMP.json`. A failed save keeps edits available for retry, and closing is blocked while a save is in progress.

The directly runnable EXE and installed app share `%APPDATA%\com.mason.tuition-payback\`. Data is not stored alongside the EXE. The web version uses the current browser's localStorage; another browser, hostname, or port has separate data.

## ICS support

Review the preview after selecting an ICS file. **Load timetable into editor** replaces only the editor's courses and retains tuition already entered. Check or add tuition, then use the normal save button to write the configuration. ICS files contain no tuition; use JSON for a complete transfer.

Supported:

- Single events with explicit `DTSTART` and `DTEND`.
- `FREQ=WEEKLY` with an `UNTIL` or `COUNT` end condition, `INTERVAL` omitted or equal to 1, and multiple `BYDAY` values.
- `EXDATE` exclusions, folded lines, and escaped text.
- Local floating times or an IANA `TZID` matching the device's time zone.
- Single UTC events converted to the device's local time.

Unsupported rules reject the entire file. These include biweekly, monthly, or endless recurrence; `RDATE`; individual rescheduling or cancellation overrides; all-day events; second-level times; duplicate event revisions; weekly UTC recurrence; and differing course time zones. Overlapping sessions must also be resolved first.

Each file is limited to 1 MB, 500 events, and 500 timetable entries. Import never changes the source file. If a canceled class has a makeup session, adjust the timetable once its date is confirmed; the app does not guess makeup dates.

## Command-line converter

```sh
node scripts/convert-nyu-calendar.mjs INPUT.ics TUITION OUTPUT.json
```

This helper supports a specific NYU weekly calendar format with the `America/New_York` time zone, a single `BYDAY`, and explicit `UNTIL`. The app's general importer is separate. The helper runs offline, and the output path must be a new file. Import the generated JSON into the app to review and edit it; JSON without currency metadata is treated as USD.
