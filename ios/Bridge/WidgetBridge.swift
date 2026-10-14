import Foundation
import WidgetKit

@_cdecl("tuition_widget_write")
public func tuitionWidgetWrite(_ pointer: UnsafePointer<CChar>) -> Int32 {
    do {
        guard let appGroup = WidgetSnapshot.appGroup, let directory = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup) else { return 1 }
        let data = Data(String(cString: pointer).utf8)
        let snapshot = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        guard snapshot.isValid else { return 2 }
        let url = directory.appendingPathComponent("widget-snapshot.json")
        if (try? Data(contentsOf: url)) == data { return 0 }
        try data.write(to: url, options: .atomic)
        WidgetCenter.shared.reloadTimelines(ofKind: "TuitionPaybackWidget")
        return 0
    } catch { return 3 }
}

@_silgen_name("tuition_widget_register")
private func registerWidgetWriter(_ writer: @convention(c) (UnsafePointer<CChar>) -> Int32)

@_cdecl("tuition_widget_install")
public func installWidgetWriter() {
    registerWidgetWriter(tuitionWidgetWrite)
}
