import Foundation

// Match the foreground app's local-clock theme, including while no class is active.
enum WidgetTheme {
    static func isLight(at date: Date, calendar: Calendar = .current) -> Bool {
        (6..<18).contains(calendar.component(.hour, from: date))
    }
    static func transitions(after date: Date, through horizon: Date, calendar: Calendar = .current) -> [Date] {
        [6, 18].compactMap { hour in
            guard let boundary = calendar.nextDate(after: date,
                matching: DateComponents(hour: hour, minute: 0, second: 0), matchingPolicy: .nextTime),
                  boundary <= horizon else { return nil }
            return boundary
        }.sorted()
    }
}

struct WidgetSession: Codable {
    let name: String
    let start: Double
    let end: Double
    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
}

struct WidgetSnapshot: Codable {
    let version: Int
    let timeZone: String
    let language: String
    let currency: String
    let tuitionCents: Double
    let semesterDurationMs: Double
    let sessions: [WidgetSession]

    var isValid: Bool {
        version == 1 && tuitionCents.isFinite && tuitionCents >= 0 &&
        semesterDurationMs.isFinite && semesterDurationMs >= 0 && sessions.count <= 50000 &&
        (sessions.isEmpty || semesterDurationMs > 0) &&
        sessions.allSatisfy { $0.start.isFinite && $0.end.isFinite && $0.end > $0.start }
    }
    static let empty = WidgetSnapshot(version: 1, timeZone: TimeZone.current.identifier,
        language: "en-US", currency: "USD", tuitionCents: 0, semesterDurationMs: 0, sessions: [])
    static var appGroup: String? { Bundle.main.object(forInfoDictionaryKey: "WidgetAppGroup") as? String }
    static func read() -> WidgetSnapshot? {
        guard let appGroup, let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier:
            appGroup),
              let data = try? Data(contentsOf: directory.appendingPathComponent("widget-snapshot.json")),
              let value = try? JSONDecoder().decode(Self.self, from: data), value.isValid else { return nil }
        return value
    }
    func state(at date: Date) -> WidgetState {
        let now = date.timeIntervalSince1970 * 1000
        let active = sessions.first { $0.start <= now && now < $0.end }
        let next = sessions.first { $0.start > now }
        let previous = sessions.filter { $0.end <= now }.max { $0.end < $1.end }
        let session = active ?? next ?? previous
        let mode = active != nil ? "live" : next != nil ? "next" : session != nil ? "complete" : "empty"
        let elapsed = session.map { min($0.end - $0.start, max(0, now - $0.start)) } ?? 0
        let completed = sessions.filter { $0.end <= now }.reduce(0.0) { $0 + $1.end - $1.start }
        let amount = semesterDurationMs > 0 ? tuitionCents / 100 * (elapsed / semesterDurationMs) : 0
        return WidgetState(session: session, mode: mode,
            amount: mode == "live" ? floor(amount * 100) / 100 : amount,
            coinCount: Int(min(600, max(0, floor(amount / 10)))),
            total: semesterDurationMs > 0 ? tuitionCents / 100 * (completed / semesterDurationMs) : 0)
    }
    func money(_ amount: Double) -> String {
        let format = NumberFormatter()
        format.locale = Locale(identifier: language)
        format.numberStyle = .currency
        format.currencyCode = currency
        format.minimumFractionDigits = 2
        format.maximumFractionDigits = 2
        return format.string(from: NSNumber(value: amount)) ?? "—"
    }
    func label(_ key: String) -> String {
        let strings: [String: [String]] = [
            "live": ["In class", "正在上课", "授業中", "正在上課", "수업 중", "En clase"],
            "next": ["Next class", "下一节课", "次の授業", "下一節課", "다음 수업", "Próxima clase"],
            "complete": ["Semester complete", "学期已结束", "学期終了", "學期已結束", "학기 종료", "Semestre terminado"],
            "empty": ["Set up your timetable", "先设置课表", "時間割を設定", "先設定課表", "시간표 설정", "Configura tu horario"],
            "open": ["Open the app to get started", "打开应用设置学费与课程", "アプリで設定してください", "打開應用設定學費與課程", "앱에서 시작하세요", "Abre la app para empezar"],
            "total": ["Semester recovered", "学期累计回本", "学期の回収額", "學期累計回本", "학기 누적 회수", "Recuperado este semestre"],
            "updated": ["Updated", "更新于", "更新", "更新於", "업데이트", "Actualizado"],
            "zone": ["Time zone changed. Open app to sync.", "时区已改变，请打开应用同步。", "アプリで時間帯を同期", "時區已改變，請打開應用同步。", "앱에서 시간대를 동기화하세요", "Abre la app para sincronizar la zona horaria."]
        ]
        let index = ["en-US", "zh-CN", "ja-JP", "zh-TW", "ko-KR", "es-ES"].firstIndex(of: language) ?? 0
        return strings[key]?[index] ?? key
    }
}

struct WidgetState {
    let session: WidgetSession?
    let mode: String
    let amount: Double
    let coinCount: Int
    let total: Double
}
