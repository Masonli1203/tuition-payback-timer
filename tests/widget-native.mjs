// Runs the actual Swift model against JS-generated expected values, including DST.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { widgetSnapshot } from '../widget.mjs';
import { createSemesterTimeline, calculateSession } from '../core.mjs';
process.env.TZ = 'America/New_York';
const cases = [];
for (const [startDate, endDate] of [['2026-03-01', '2026-03-22'], ['2026-10-25', '2026-11-15']]) {
  const semester = { tuitionCents: 1234567, startDate, endDate, weeklyCourses: [
    { name: 'DST sample', weekday: 6, startTime: '01:30', durationMs: 7200000 },
    { name: 'Overnight sample', weekday: 0, startTime: '23:30', durationMs: 7200000 },
  ] };
  const snapshot = widgetSnapshot(semester, { language: 'en-US', currency: 'USD' });
  const timeline = createSemesterTimeline(semester);
  for (const session of snapshot.sessions) {
    for (const now of [session.start - 1, session.start, session.start + 31000, session.end - 1, session.end, session.end + 1]) {
      const core = timeline(now);
      const view = calculateSession(core.session, now);
      cases.push({ snapshot, now, start: core.session.start,
        mode: view.state === 'live' ? 'live' : view.state === 'waiting' ? 'next' : 'complete',
        amount: view.state === 'live' ? Math.floor(view.recovered * 100) / 100 : view.recovered,
        total: core.recovery.recovered, coins: Math.min(600, Math.floor(view.recovered / 10)) });
    }
  }
}
const directory = mkdtempSync(join(tmpdir(), 'tuition-widget-tests-'));
try {
  writeFileSync(join(directory, 'cases.json'), JSON.stringify(cases));
  writeFileSync(join(directory, 'main.swift'), `
import Foundation
struct TestCase: Decodable {
 let snapshot: WidgetSnapshot; let now: Double; let start: Double
 let mode: String; let amount: Double; let total: Double; let coins: Int
}
let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
let cases = try JSONDecoder().decode([TestCase].self, from: data)
for item in cases {
 precondition(item.snapshot.isValid)
 let state = item.snapshot.state(at: Date(timeIntervalSince1970: item.now / 1000))
 precondition(state.session?.start == item.start, "Session mismatch")
 precondition(state.mode == item.mode, "State mismatch")
 precondition(state.coinCount == item.coins, "Coin count mismatch")
 precondition(abs(state.amount - item.amount) < 0.00000001, "Amount mismatch")
 precondition(abs(state.total - item.total) < 0.00000001, "Total mismatch")
}
for (amount, expected) in [(9.999, 0), (10.0, 1), (19.999, 1), (20.0, 2), (1000000.0, 600)] {
 let snapshot = WidgetSnapshot(version: 1, timeZone: TimeZone.current.identifier,
  language: "en-US", currency: "USD", tuitionCents: amount * 200,
  semesterDurationMs: 1000, sessions: [WidgetSession(name: "Sample", start: 0, end: 1000)])
 precondition(snapshot.state(at: Date(timeIntervalSince1970: 0.5)).coinCount == expected, "Coin threshold mismatch")
}
// Theme matches local time even across DST and when the timetable is empty.
for zone in ["America/New_York", "Asia/Shanghai", "Asia/Kathmandu"] {
 var calendar = Calendar(identifier: .gregorian)
 calendar.timeZone = TimeZone(identifier: zone)!
 for (month, day) in [(3, 8), (10, 14), (11, 1)] {
  for (hour, minute, second, light) in [(5, 59, 59, false), (6, 0, 0, true), (17, 59, 59, true), (18, 0, 0, false)] {
   let date = calendar.date(from: DateComponents(year: 2026, month: month, day: day, hour: hour, minute: minute, second: second))!
   precondition(WidgetTheme.isLight(at: date, calendar: calendar) == light, "Theme boundary mismatch")
  }
  for hour in [0, 5, 6, 12, 17, 18, 23] {
   let now = calendar.date(from: DateComponents(year: 2026, month: month, day: day, hour: hour))!
   let horizon = now.addingTimeInterval(6 * 3600)
   let boundaries = WidgetTheme.transitions(after: now, through: horizon, calendar: calendar)
   // Check that every color change inside the timeline receives an entry.
   var previous = WidgetTheme.isLight(at: now, calendar: calendar)
   for minute in 1...360 {
    let tick = now.addingTimeInterval(Double(minute) * 60)
    let light = WidgetTheme.isLight(at: tick, calendar: calendar)
    if light != previous { precondition(boundaries.contains(tick), "Missing theme timeline entry") }
    previous = light
   }
   precondition(boundaries.allSatisfy { $0 > now && $0 <= horizon })
  }
 }
}
precondition(WidgetSnapshot.empty.state(at: Date()).mode == "empty")
print("Swift widget model passed \\(cases.count) JS parity cases, including DST, overnight boundaries, coin thresholds and local-clock theme checks.")
`);
  for (const [command, args] of [
    ['xcrun', ['swiftc', '-module-cache-path', join(directory, 'modules'), 'ios/Widget/WidgetModel.swift', join(directory, 'main.swift'), '-o', join(directory, 'check')]],
    [join(directory, 'check'), [join(directory, 'cases.json')]],
  ]) {
    const result = spawnSync(command, args, { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Native widget check failed: ${command}`);
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
