# iOS development preview

This branch adds a Tauri iOS host around the existing offline timer. It is a development preview for simulator and personal-device testing, not an App Store release or a WidgetKit extension.

## Mac setup

Install full Xcode, accept its license, complete first launch and install an iOS Simulator runtime. Install Node.js, Rust (1.90 or newer), and the Tauri iOS prerequisites: <https://v2.tauri.app/start/prerequisites/#ios>.

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

- Existing tuition, calendar, currency, language and recovery calculations are shared with Windows.
- Mobile hides window controls and disables dragging; dialogs and the timer respect the safe area and touch targets.
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

## Later: home-screen widget

A widget requires a separate WidgetKit extension and a deliberate shared-data design (for example an App Group). It cannot simply embed this HTML/canvas screen. Keep timetable data/calculation semantics stable so a future native widget can show the current/next class and progress. Widget update scheduling and animation differ from the foreground app; do not promise per-second coin animations in the widget.

## Verification recorded for this branch

On an Apple Silicon Mac with Xcode 27.0 and an iPhone 18 Pro / iOS 27.0 simulator:

- 72 JavaScript tests, four existing browser UI suites (Chrome), mobile smoke at three widths, and five Rust storage tests passed.
- `cargo check --target aarch64-apple-ios-sim --locked` passed.
- Native simulator build and installation succeeded. First-use preferences, saving the live sample timetable, animated timer, JSON export to Files and importing/restoring that exported JSON were exercised in the simulator.
- Physical iPhone signing/install, native ICS file selection, class-boundary suspension, landscape and accessibility settings still need device verification. Browser tests cover the shared ICS and timestamp recovery logic.
