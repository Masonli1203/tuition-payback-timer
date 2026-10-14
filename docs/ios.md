# iOS development preview

This branch adds a Tauri iOS host around the existing offline timer. It is a development preview for simulator and personal-device testing, not an App Store release. It includes a WidgetKit home-screen extension in small and medium sizes.

## Mac setup

Install XcodeGen (`brew install xcodegen`) and full Xcode, accept its license, complete first launch and install an iOS Simulator runtime. Install Node.js, Rust (1.90 or newer), and the Tauri iOS prerequisites: <https://v2.tauri.app/start/prerequisites/#ios>.

In Xcode Settings → Locations, select the full Xcode installation under Command Line Tools. Tauri build subprocesses require this selection. Then run:

```sh
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
source "$HOME/.cargo/env"
npm ci
npm run ios:init
npm run ios:dev
```

Select an iPhone simulator when prompted. The development command embeds the prepared static assets; it does not depend on a network dev server. Restart the command after frontend edits to repackage them. No distribution certificate or App Store submission is needed for simulator development. The CLI generates the Xcode project in `src-tauri/gen/apple`; generated files stay ignored and can be regenerated with `ios:init`. The iOS-specific config is loaded automatically and uses the separate identifier `com.mason.tuition-payback.ios-dev`.

A personal iPhone additionally requires a development signing team configured in Xcode/Tauri and device setup. Do not commit signing secrets. Do not use the Windows verification identifier for iOS.

## Behavior and checks

The iOS app uses the approved cream, green and gold segmented-clock icon. Its
opaque, square master is `ios/Icons/source.png`; `ios/Icons/Contents.json` lists
the iPhone, iPad and 1024px marketing sizes. The preparation step shared by
`ios:init`, `ios:dev` and `ios:build` regenerates those sizes with macOS `sips`
and selects the `AppIcon` asset catalog, so reinitializing the Xcode project
preserves the design. iOS supplies the rounded corners. Desktop icons are separate.

- Existing tuition, calendar, currency, language and recovery calculations are shared with Windows.
- Mobile shows the “Focus on class!” / “Rest well!” reminder, hides window controls and disables dragging; dialogs and the timer respect the safe area and touch targets.
- Configuration and preferences remain in the native app data directory with backups before replacement. There is no cloud synchronization. Uninstalling the app can remove its local data.
- JSON/ICS import uses the web view's file picker; JSON export uses the native dialog. Verify both against the Files app on a real device before relying on backups.
- Returning from the background recalculates from timestamps and settles animations. The app does not need continuous background execution.

```sh
npm test
PLAYWRIGHT_CHANNEL=chrome npm run test:ui
npm run test:mobile
npm run desktop:prepare
cargo test --manifest-path src-tauri/Cargo.toml
```

The mobile browser suite uses a mocked native bridge and checks 320/390/430px layouts, preference saving, demo saving, reload, resume and absence of desktop window calls. It is not a substitute for the following native checks:

1. Launch on an iPhone simulator and confirm first-use preferences.
2. Save a sample timetable; terminate/relaunch and verify it persists.
3. Export JSON, import it and an ICS sample, and verify cancel/error handling.
4. Background/resume across a class boundary and verify totals.
5. Inspect portrait/landscape, keyboard, safe areas and reduced motion.

## Home-screen widget

After installing the app, open it and save a timetable. Long-press the iPhone home screen, choose **Edit → Add Widget**, search for **Tuition Payback**, and choose the small or medium size. Tapping a widget opens the app.

- Small: current/next course, current-class recovered amount and countdown.
- Medium: also shows the semester total (fully ended classes only).
- Before setup: asks you to open the app. After the last lesson: keeps the final class result.
- Language and currency follow the app's saved preferences; course names are unchanged.
- Amount snapshots are scheduled every five minutes during class, plus exact class boundaries. The native countdown/progress can advance between snapshots; the amount is labeled with its snapshot time. iOS controls delivery and can delay updates. There are no per-second coin or amount animations.
- A static, layered gold coin pile fills the bottom band in both sizes, one coin per 10 current-class currency units (up to 600 drawn). It follows amount snapshots and recalculates on class changes; the upper text stays clear.
- Widget background, text and green accent match the app. Both use light mode from 06:00 to 18:00 and dark mode otherwise, in device local time. Widget timelines include these theme boundaries even when no class is active; iOS can delay delivery.
- Changing device time zone requires reopening the app to regenerate local-calendar occurrences. Until then, the widget asks you to sync.

The app resolves the full timetable through `core.mjs` and atomically writes a derived snapshot to the App Group. The Swift extension uses timestamps to select sessions and calculate amounts without needing the app to remain open. Configuration files and backups remain in the original app container. Sync runs after successful saves and on resume; failed sync is reported separately and retried on resume. A failed configuration/preferences load never replaces the widget snapshot.

### Native project and signing

Tracked sources are in `ios/Widget` and `ios/Bridge`. `scripts/prepare-ios-widget.mjs` adds them to Tauri's generated project, embeds the extension, installs the Rust/Swift callback bridge, and adds App Group entitlements to both targets. `ios:init`, `ios:dev`, and `ios:build` run this preparation automatically. After a manual `tauri ios init`, run `npm run ios:widget:prepare`.

Both targets must use the same signing team and App Group. Development identifiers:

- App: `com.mason.tuition-payback.ios-dev`
- Extension: `com.mason.tuition-payback.ios-dev.widget`
- Group: `group.com.mason.tuition-payback.ios-dev`

For physical iPhone testing, set `APPLE_DEVELOPMENT_TEAM` to your team ID before preparation/build (or set `bundle.iOS.developmentTeam` in the iOS config), and ensure its provisioning profiles include that App Group. You can instead set the team on both targets in Xcode and build there; rerunning preparation regenerates the project, so preserve lasting signing choices in the environment/config. Personal-device signing and home-screen placement still need device verification. Do not substitute the Windows production identifier.

### Isolated widget verification

```sh
npm run test:widget:native
npm run ios:build:widget-verification
```

The latter builds a simulator app with identifier `com.mason.tuition-payback.ios-widget-verification`, plus its separate `.widget` extension and App Group. Use sample data only in that app. Its unsigned simulator output may need local ad-hoc signatures to expose the App Group:

```sh
codesign --force --sign - --entitlements src-tauri/gen/apple/WidgetSources/Widget.entitlements \
  "src-tauri/gen/apple/build/arm64-sim/Tuition Payback Timer.app/PlugIns/TuitionPaybackWidget.appex"
codesign --force --sign - --entitlements src-tauri/gen/apple/tuition-payback_iOS/tuition-payback_iOS.entitlements \
  "src-tauri/gen/apple/build/arm64-sim/Tuition Payback Timer.app"
```

Normal `ios:dev` / `ios:build` regenerate development identifiers before building. Never distribute the verification app.

## Verification recorded for this branch

On an Apple Silicon Mac with Xcode 27.0 and an iPhone 18 Pro / iOS 27.0 simulator:

- 72 JavaScript tests, four existing browser UI suites (Chrome), mobile smoke at three widths, and five Rust storage tests passed.
- `cargo check --target aarch64-apple-ios-sim --locked` passed.
- Native simulator build and installation succeeded. First-use preferences, saving the live sample timetable, animated timer, JSON export to Files and importing/restoring that exported JSON were exercised in the simulator.
- Physical iPhone signing/install, native ICS file selection, class-boundary suspension, landscape and accessibility settings still need device verification. Browser tests cover the shared ICS and timestamp recovery logic.

### Widget verification (2026-10-14)

- 75 JavaScript tests, five Rust storage tests, all four browser suites, and mobile smoke at 320/390/430px passed.
- The actual Swift model passed 84 comparisons against the JS engine across both DST transitions, overnight sessions, class boundaries and semester completion.
- iOS 16 simulator Swift type-checks and the full simulator build including the embedded extension passed.
- The isolated simulator app launched and wrote its App Group snapshot through the JS → Rust → Swift bridge. Sample timetable and preference synchronization were checked from the generated snapshot.
- Visual home-screen placement, small/medium clipping, tapping to open, actual WidgetKit scheduling and physical-device signing remain manual checks; the available UI automation could not access Simulator.

### Physical iPhone installation (2026-10-14)

The development app and embedded WidgetKit extension were signed with matching App Group entitlements, installed as an update on an iPhone 17 Pro Max, and launched successfully using `devicectl`. Installation did not uninstall the existing app or replace its saved configuration with sample data. Actual home-screen placement and widget appearance remain user acceptance checks.

### Widget coin background verification (2026-10-14)

- Small and medium widgets now draw static layered gold stacks along the bottom, using the unrounded current-class amount and a 600-coin drawing limit.
- 75 JavaScript tests, five Rust storage tests, 84 Swift/JS parity cases (including coin counts), and explicit coin threshold/cap checks passed.
- An isolated `ios-widget-verification.render` simulator harness rendered the actual SwiftUI content with sample values at 0, 1, 10, 60 and 600 coins in both sizes and appearances. Small/light and medium/dark dense piles were visually inspected; course and amount remain clear. This renders content outside the WidgetKit host, so native timer/progress scheduling and home-screen placement still require device observation.
- The signed development IPA with its widget extension was installed over the existing iPhone app and launched successfully. No uninstall or sample-data replacement was performed on the phone.

### App palette and mobile reminder fix (2026-10-14)

- The mobile branch now reveals the existing translated focus/rest message without requiring desktop maximization. Responsive text fits the space between the amount and countdown.
- Widget colors use the app's sRGB tokens, including the dark `#10181e` background and green accent. Local 06:00/18:00 timeline entries keep the scheduled appearance aligned even outside class hours.
- 75 JavaScript tests, five Rust storage tests, all four browser suites, and mobile regression at 320/390/430px passed. Mobile regression now covers visible live/rest messages, resume, reload and their layout bounds. Native Swift checks passed 84 JS parity cases plus theme transitions in three time zones, including DST dates.
- Sample mobile screenshots and isolated small/medium SwiftUI renders were inspected. The latter do not verify WidgetKit-hosted timer/progress rendering. The signed app and extension were installed as an update on the connected iPhone; existing configuration was preserved.

### Reminder installation follow-up (2026-10-14)

- A fresh physical-device check still found the reminder hidden despite the mobile branch in `desktop.mjs`. The timer now reveals mobile reminders during its own initialization, independently of desktop controls.
- Mobile regression covers both Chinese messages, wrapping in a narrow text area, and startup without the desktop module. Three mobile widths and desktop reminder regression passed; the full browser suite, 75 JavaScript tests and five Rust storage tests also passed during this investigation.
- The signed debug build was installed over the connected iPhone app and launched. A device screenshot confirmed “好好上课！” is visible. Rest-state switching was verified with isolated browser sample data, not by modifying the phone's timetable.
- Release-mode compilation failed on unresolved Tauri iOS plugin symbols; the debug device build and installation succeeded.

### Large mobile reminders (2026-10-14)

- Mobile reminders now measure the available space and choose the largest fitting font, with wrapping. Chinese and Japanese preserve phrase boundaries; other languages wrap at word boundaries. Resizing, font loading and message changes trigger a new fit.
- Six languages in both live/rest states passed fit and maximum-size checks at 320/390/430px. The existing browser suites and 75 JavaScript tests passed.
- The signed debug app was updated on the iPhone. A fresh device screenshot confirmed the large Chinese reminder on two lines, “好好” / “上课！”, within the amount/countdown boundaries.

### Landscape reminder alignment (2026-10-14)

- Landscape places the amount on the left, the reminder on the right, and progress/countdown below. Reminder fitting compares word/phrase line breaks, centers body text independently of hanging exclamation marks (including Spanish “¡”), and keeps punctuation inside the available area.
- All six languages passed live/rest geometry checks at 568×320, 844×390 and 932×430, plus rotation back to portrait: centered lines, largest fitting font, visible controls and no overlap with the amount/countdown.
- The signed debug update was installed on the iPhone. Native landscape capture confirmed Chinese alignment and separation from amount/countdown; device orientation was restored to portrait after inspection.

### Portrait alignment review (2026-10-14)

- Portrait now has the same explicit alignment assertions as landscape, at 320×568, 390×844 and 430×932. All six languages and both reminder states passed horizontal/vertical centering, punctuation-without-text-advance, maximum-size and non-overlap checks, including rotation recovery.
- Twelve sample screenshots at 390×844 were visually reviewed. Exclamation marks, including Spanish opening punctuation, stay outside the centered body text. Short portrait screens may choose a single line to make the best use of limited height.
- No application behavior change was needed in this review; the installed build already uses the shared alignment and fitting logic.
