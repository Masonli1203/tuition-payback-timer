import SwiftUI
import WidgetKit

struct PaybackEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct PaybackProvider: TimelineProvider {
    func placeholder(in context: Context) -> PaybackEntry { sample() }
    func getSnapshot(in context: Context, completion: @escaping (PaybackEntry) -> Void) {
        completion(context.isPreview ? sample() : PaybackEntry(date: Date(), snapshot: .read() ?? .empty))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PaybackEntry>) -> Void) {
        let snapshot = WidgetSnapshot.read() ?? .empty
        let now = Date()
        let horizon = now.addingTimeInterval(6 * 3600)
        var dates: Set<Date> = [now, horizon]
        dates.formUnion(WidgetTheme.transitions(after: now, through: horizon))
        // Five-minute amount snapshots, exact start/end transitions, and native
        // time-based countdowns. WidgetKit decides when timelines are delivered.
        for session in snapshot.sessions where session.endDate > now && session.startDate < horizon {
            for boundary in [session.startDate, session.endDate] where boundary > now && boundary <= horizon {
                dates.insert(boundary)
            }
            var tick = max(now, session.startDate).addingTimeInterval(300)
            while tick < min(horizon, session.endDate) {
                dates.insert(tick)
                tick = tick.addingTimeInterval(300)
            }
        }
        completion(Timeline(entries: dates.sorted().map { PaybackEntry(date: $0, snapshot: snapshot) },
                            policy: .after(horizon)))
    }
    private func sample() -> PaybackEntry {
        let now = Date()
        return PaybackEntry(date: now, snapshot: WidgetSnapshot(version: 1,
            timeZone: TimeZone.current.identifier, language: "en-US", currency: "USD",
            tuitionCents: 2400000, semesterDurationMs: 120 * 3600000,
            sessions: [WidgetSession(name: "Economics", start: now.addingTimeInterval(-1800).timeIntervalSince1970 * 1000,
                                     end: now.addingTimeInterval(3600).timeIntervalSince1970 * 1000)]))
    }
}

struct PaybackView: View {
    let entry: PaybackEntry
    @Environment(\.widgetFamily) private var family
    private var snapshot: WidgetSnapshot { entry.snapshot }
    private var state: WidgetState { snapshot.state(at: entry.date) }
    private var palette: WidgetPalette { WidgetPalette(isLight: WidgetTheme.isLight(at: entry.date)) }
    private var accent: Color { palette.accent }

    var body: some View {
        content
            .foregroundStyle(palette.text)
            .environment(\.locale, Locale(identifier: snapshot.language))
            .modifier(WidgetBackground(coinCount: snapshot.timeZone == TimeZone.current.identifier ? state.coinCount : 0,
                                       background: palette.background))
            .environment(\.colorScheme, WidgetTheme.isLight(at: entry.date) ? .light : .dark)
    }
    private var content: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: "graduationcap.fill").foregroundStyle(accent)
                Text(snapshot.label(state.mode)).font(.caption).fontWeight(.semibold)
                Spacer(minLength: 0)
            }
            if snapshot.timeZone != TimeZone.current.identifier {
                Text(snapshot.label("zone")).font(.callout)
            } else if let session = state.session {
                HStack(alignment: .top, spacing: 16) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(session.name).font(.headline).lineLimit(1)
                        Text(snapshot.money(state.amount))
                            .font(.system(size: family == .systemSmall ? 26 : 32, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.5).lineLimit(1).foregroundStyle(accent)
                        if state.mode == "live" {
                            Text(timerInterval: entry.date...session.endDate, countsDown: true)
                                .font(.caption.monospacedDigit())
                            ProgressView(timerInterval: session.startDate...session.endDate, countsDown: false)
                                .labelsHidden().tint(accent)
                        } else if state.mode == "next" {
                            Text(timerInterval: entry.date...session.startDate, countsDown: true)
                                .font(.caption.monospacedDigit())
                        }
                    }
                    if family == .systemMedium {
                        Spacer(minLength: 0)
                        VStack(alignment: .leading, spacing: 7) {
                            Text(snapshot.label("total")).font(.caption).foregroundStyle(palette.muted)
                            Text(snapshot.money(state.total)).font(.title3.bold()).minimumScaleFactor(0.5).lineLimit(1)
                            Text(session.startDate, style: .date).font(.caption2).foregroundStyle(palette.muted)
                        }.frame(maxWidth: 130, alignment: .leading)
                    }
                }
                Spacer(minLength: 0)
                HStack(spacing: 3) {
                    Text(snapshot.label("updated"))
                    Text(entry.date, style: .time)
                }.font(.system(size: 9)).foregroundStyle(palette.muted)
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(palette.background.opacity(0.92), in: Capsule())
            } else {
                Text(snapshot.label("open")).font(.callout).foregroundStyle(palette.muted)
                Spacer(minLength: 0)
            }
        }
    }
}

// Keep these sRGB tokens aligned with styles.css, including the green accent.
struct WidgetPalette {
    let isLight: Bool
    private func color(_ hex: UInt32) -> Color {
        Color(.sRGB, red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255, opacity: 1)
    }
    var background: Color { color(isLight ? 0xffffff : 0x10181e) }
    var text: Color { color(isLight ? 0x182127 : 0xedf3f5) }
    var muted: Color { color(isLight ? 0x5b6770 : 0xa4b3bd) }
    var accent: Color { color(isLight ? 0x27634e : 0xb6e2d3) }
}

// Static, deterministic stacks: a new snapshot adds coins without shuffling earlier ones.
// The bottom band is capped so even a very large tuition cannot cover the text.
struct WidgetCoinPile: View {
    let count: Int
    var body: some View {
        Canvas { context, size in
            guard count > 0 else { return }
            let columns = max(3, Int(size.width / 38))
            let diameter = min(36.0, (size.width - 16) / Double(columns))
            let rows = max(1, (min(count, 600) + columns - 1) / columns)
            let step = min(4.2, 26 / Double(max(1, rows - 1)))
            for index in 0..<min(count, 600) {
                let row = index / columns
                // Fill the floor from the center out, then build upward.
                let slot = index % columns
                let column = slot % 2 == 0 ? columns / 2 + slot / 2 : columns / 2 - (slot + 1) / 2
                let jitter = Double((index * 17) % 7 - 3) * 0.45
                let x = (size.width - Double(columns) * diameter) / 2 + Double(column) * diameter + jitter
                let y = size.height - 11 - Double(row) * step - Double(column % 3) * 1.2
                let face = CGRect(x: x, y: y, width: diameter, height: diameter * 0.36)
                let edge = face.offsetBy(dx: 0, dy: 3)
                context.fill(Path(ellipseIn: edge), with: .linearGradient(
                    Gradient(colors: [Color(red: 0.65, green: 0.32, blue: 0.04), Color(red: 0.91, green: 0.57, blue: 0.12)]),
                    startPoint: edge.origin, endPoint: CGPoint(x: edge.maxX, y: edge.maxY)))
                context.fill(Path(ellipseIn: face), with: .linearGradient(
                    Gradient(colors: [Color(red: 1, green: 0.91, blue: 0.48), Color(red: 0.96, green: 0.68, blue: 0.17), Color(red: 0.82, green: 0.44, blue: 0.06)]),
                    startPoint: face.origin, endPoint: CGPoint(x: face.maxX, y: face.maxY)))
                context.stroke(Path(ellipseIn: face.insetBy(dx: 3, dy: 1.8)),
                    with: .color(Color(red: 0.69, green: 0.39, blue: 0.08).opacity(0.65)), lineWidth: 0.65)
                context.stroke(Path(ellipseIn: face), with: .color(.yellow.opacity(0.65)), lineWidth: 0.5)
            }
        }
        .frame(height: 46).clipped().accessibilityHidden(true)
    }
}

struct WidgetBackground: ViewModifier {
    let coinCount: Int
    let background: Color
    private var backdrop: some View {
        ZStack(alignment: .bottom) {
            background
            WidgetCoinPile(count: coinCount)
        }
    }
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { backdrop }
        } else {
            content.padding().background { backdrop }
        }
    }
}

@main
struct TuitionPaybackWidget: Widget {
    let kind = "TuitionPaybackWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PaybackProvider()) { entry in
            PaybackView(entry: entry)
        }
        .configurationDisplayName("Tuition Payback")
        .description("Your current class, countdown and tuition recovered.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
