import { defaultPreferences } from './preferences.mjs';

// Chinese source messages are stable catalog keys. {0}, {1}, ... preserve
// course names, paths, counts, dates and details supplied by the calculator.
export const messages = [
  ["备份中的货币单位无效。","Invalid currency in the backup.","バックアップの通貨が無効です。","備份中的貨幣單位無效。","백업의 통화 단위가 올바르지 않습니다.","La moneda de la copia no es válida."],
  ["备份货币为 {0}，当前为 {1}。请取消导入，点击主页面的语言与货币按钮修改后再导入；金额不会自动换算。","Backup currency is {0}; current currency is {1}. Cancel the import, change the currency using the main-page button, then import again. Amounts are not converted.","バックアップの通貨は {0}、現在は {1} です。読み込みをキャンセルし、メイン画面の言語と通貨ボタンで通貨を変更してから再度読み込んでください。金額は換算されません。","備份貨幣為 {0}，目前為 {1}。請取消匯入，在主畫面的語言與貨幣按鈕修改後再匯入；金額不會自動換算。","백업 통화는 {0}, 현재 통화는 {1}입니다. 가져오기를 취소하고 메인 화면에서 통화를 변경한 뒤 다시 가져오세요. 금액은 환산되지 않습니다.","La copia usa {0} y la moneda actual es {1}. Cancela la importación, cambia la moneda desde la pantalla principal y vuelve a importar. No se convierten los importes."],
  ["ICS 属性格式损坏。","Invalid ICS property format.","ICS 属性の形式が無効です。","ICS 屬性格式損壞。","ICS 속성 형식이 올바르지 않습니다.","El formato de la propiedad ICS no es válido."],
  ["ICS 参数格式损坏。","Invalid ICS parameter format.","ICS パラメーターの形式が無効です。","ICS 參數格式損壞。","ICS 매개변수 형식이 올바르지 않습니다.","El formato del parámetro ICS no es válido."],
  ["ICS 参数重复。","Duplicate ICS parameter.","ICS パラメーターが重複しています。","ICS 參數重複。","ICS 매개변수가 중복됩니다.","Hay un parámetro ICS duplicado."],
  ["ICS 文件最多支持 1 MB。","ICS files must be at most 1 MB.","ICS ファイルの上限は1 MBです。","ICS 檔案上限為 1 MB。","ICS 파일은 최대 1 MB까지 지원합니다.","El archivo ICS no puede superar 1 MB."],
  ["请选择单个完整的 ICS 日历文件。","Choose one complete ICS calendar file.","完全な ICS カレンダーファイルを1つ選択してください。","請選擇單一完整的 ICS 行事曆檔案。","완전한 ICS 캘린더 파일 하나를 선택하세요.","Selecciona un único calendario ICS completo."],
  ["ICS 缺少 VCALENDAR。","ICS is missing VCALENDAR.","ICS に VCALENDAR がありません。","ICS 缺少 VCALENDAR。","ICS에 VCALENDAR가 없습니다.","Falta VCALENDAR en el archivo ICS."],
  ["ICS 课程事件层级无效。","Invalid ICS event nesting.","ICS イベントの階層が無効です。","ICS 課程事件層級無效。","ICS 수업 이벤트의 계층이 올바르지 않습니다.","La estructura de eventos ICS no es válida."],
  ["最多支持 500 个日历事件。","At most 500 calendar events are supported.","カレンダーイベントは500件まで対応しています。","最多支援 500 個行事曆事件。","캘린더 이벤트는 최대 500개까지 지원합니다.","Se admiten hasta 500 eventos de calendario."],
  ["ICS 文件结构损坏或不完整。","ICS structure is invalid or incomplete.","ICS の構造が無効または不完全です。","ICS 檔案結構損壞或不完整。","ICS 파일 구조가 잘못되었거나 불완전합니다.","La estructura del archivo ICS no es válida o está incompleta."],
  ["ICS 日历之外包含无效内容。","Invalid content outside the ICS calendar.","ICS カレンダーの外に無効な内容があります。","ICS 行事曆之外包含無效內容。","ICS 캘린더 밖에 잘못된 내용이 있습니다.","Hay contenido no válido fuera del calendario ICS."],
  ["仅支持 ICS 2.0 日历。","Only ICS 2.0 calendars are supported.","ICS 2.0 カレンダーのみ対応しています。","僅支援 ICS 2.0 行事曆。","ICS 2.0 캘린더만 지원합니다.","Solo se admiten calendarios ICS 2.0."],
  ["该文件是取消通知，不是完整课表。","This file is a cancellation notice, not a complete timetable.","このファイルはキャンセル通知で、完全な時間割ではありません。","此檔案是取消通知，並非完整課表。","이 파일은 취소 알림이며 완전한 시간표가 아닙니다.","Este archivo es un aviso de cancelación, no un horario completo."],
  ["ICS 文件不完整或没有课程事件。","ICS is incomplete or contains no classes.","ICS が不完全か、授業イベントがありません。","ICS 檔案不完整或沒有課程事件。","ICS 파일이 불완전하거나 수업 이벤트가 없습니다.","El archivo ICS está incompleto o no contiene clases."],
  ["仅支持有明确开始和结束时间的课程，不支持全天事件。","Classes need explicit start and end times. All-day events are unsupported.","授業には開始時刻と終了時刻が必要です。終日イベントは未対応です。","僅支援有明確開始與結束時間的課程，不支援全天事件。","수업에는 명확한 시작과 종료 시간이 필요합니다. 종일 이벤트는 지원하지 않습니다.","Las clases necesitan horas de inicio y fin. No se admiten eventos de todo el día."],
  ["课程日期含不支持的参数。","Course dates contain unsupported parameters.","授業の日付に未対応のパラメーターがあります。","課程日期含有不支援的參數。","수업 날짜에 지원하지 않는 매개변수가 있습니다.","Las fechas de la clase contienen parámetros no admitidos."],
  ["日历时区 {0} 与设备时区 {1} 不一致，请使用相同课程时区后导入。","Calendar time zone {0} differs from device time zone {1}. Use matching time zones before importing.","カレンダーのタイムゾーン {0} と端末の {1} が異なります。一致させてから読み込んでください。","行事曆時區 {0} 與裝置時區 {1} 不一致，請使用相同課程時區後再匯入。","캘린더 시간대 {0}와 기기 시간대 {1}가 다릅니다. 시간대를 맞춘 뒤 가져오세요.","La zona horaria {0} del calendario difiere de la del dispositivo, {1}. Usa la misma zona antes de importar."],
  ["ICS 日期或时间无效。","Invalid ICS date or time.","ICS の日付または時刻が無効です。","ICS 日期或時間無效。","ICS 날짜 또는 시간이 올바르지 않습니다.","La fecha o la hora ICS no es válida."],
  ["ICS {0} 重复，不能确定课程配置。","Duplicate ICS {0}; cannot determine course settings.","ICS {0} が重複しており、授業設定を確定できません。","ICS {0} 重複，無法確定課程設定。","ICS {0}가 중복되어 수업 설정을 확인할 수 없습니다.","ICS {0} está duplicado; no se puede determinar la configuración de la clase."],
  ["日历含额外课次、单独改期或取消事件，当前无法完整导入；原配置未改变。","Extra occurrences, individual rescheduling or cancellations cannot be fully imported. Current data is unchanged.","追加授業、個別の日程変更、キャンセルは完全に読み込めません。現在の設定は未変更です。","行事曆含額外課次、個別改期或取消事件，目前無法完整匯入；原設定未變更。","추가 수업, 개별 일정 변경 또는 취소는 완전히 가져올 수 없습니다. 기존 설정은 유지됩니다.","No se pueden importar por completo clases adicionales, cambios individuales o cancelaciones. Los datos actuales se conservan."],
  ["日历含重复或多个版本的课程事件，请重新导出完整课表。","Duplicate or multiple versions of events. Export a complete timetable again.","重複または複数バージョンのイベントがあります。完全な時間割を出力し直してください。","行事曆含重複或多個版本的課程事件，請重新匯出完整課表。","수업 이벤트가 중복되거나 여러 버전이 있습니다. 전체 시간표를 다시 내보내세요.","Hay eventos duplicados o con varias versiones. Vuelve a exportar el horario completo."],
  ["课程缺少名称，或名称超过 80 个字符。","Missing course name or name exceeds 80 characters.","授業名がないか、80文字を超えています。","課程缺少名稱，或名稱超過 80 個字元。","수업 이름이 없거나 80자를 초과합니다.","Falta el nombre de la clase o supera los 80 caracteres."],
  ["课程须包含明确的 DTEND 结束时间。","Courses require an explicit DTEND end time.","授業には DTEND の終了時刻が必要です。","課程須包含明確的 DTEND 結束時間。","수업에는 명확한 DTEND 종료 시간이 필요합니다.","Las clases necesitan una hora de fin DTEND explícita."],
  ["课程时间须精确到整分钟。","Class times must be in whole minutes.","授業時刻は分単位にしてください。","課程時間須精確到整分鐘。","수업 시간은 분 단위여야 합니다.","Las horas de las clases deben expresarse en minutos completos."],
  ["单节课程时长须为 1 分钟至 24 小时。","Class duration must be 1 minute to 24 hours.","1回の授業時間は1分～24時間にしてください。","單堂課程時長須為 1 分鐘至 24 小時。","수업 시간은 1분 이상 24시간 이하여야 합니다.","Cada clase debe durar entre 1 minuto y 24 horas."],
  ["每周课程须使用本地时间或与设备一致的 TZID，避免夏令时导致课表偏移。","Weekly courses require local times or a TZID matching the device to avoid daylight-saving shifts.","夏時間によるずれを防ぐため、毎週の授業は現地時刻または端末と一致する TZID を使用してください。","每週課程須使用本地時間或與裝置一致的 TZID，避免日光節約時間造成課表偏移。","주간 수업은 현지 시간 또는 기기와 동일한 TZID를 사용해야 서머타임에 따른 시간표 오류를 방지할 수 있습니다.","Las clases semanales deben usar la hora local o un TZID igual al del dispositivo para evitar desfases por el horario de verano."],
  ["ICS 重复规则格式无效。","Invalid ICS recurrence rule.","ICS の繰り返し規則が無効です。","ICS 重複規則格式無效。","ICS 반복 규칙 형식이 올바르지 않습니다.","La regla de repetición ICS no es válida."],
  ["目前支持每周重复课程，须有 UNTIL 结束时间或 COUNT 次数；不支持隔周、月度或无限重复。","Weekly recurrence needs UNTIL or COUNT. Biweekly, monthly and unbounded recurrence are unsupported.","毎週の繰り返しには UNTIL または COUNT が必要です。隔週、毎月、無期限の繰り返しは未対応です。","目前支援每週重複課程，須有 UNTIL 結束時間或 COUNT 次數；不支援隔週、每月或無限重複。","매주 반복 수업에는 UNTIL 종료 시점 또는 COUNT 횟수가 필요합니다. 격주, 매월 또는 무기한 반복은 지원하지 않습니다.","La repetición semanal requiere UNTIL o COUNT. No se admiten repeticiones quincenales, mensuales ni sin límite."],
  ["每周课程的 BYDAY 星期规则无效。","Invalid BYDAY weekday rule.","BYDAY の曜日規則が無効です。","每週課程的 BYDAY 星期規則無效。","주간 수업의 BYDAY 요일 규칙이 올바르지 않습니다.","La regla de días BYDAY no es válida."],
  ["课程首日与重复星期不一致。","First class date does not match the recurring weekday.","初回授業日と繰り返しの曜日が一致しません。","課程首日與重複星期不一致。","첫 수업 날짜가 반복 요일과 일치하지 않습니다.","La fecha de la primera clase no coincide con el día de repetición."],
  ["课程重复次数须为 1 至 2000。","Recurrence count must be between 1 and 2000.","繰り返し回数は1～2000にしてください。","課程重複次數須為 1 至 2000。","수업 반복 횟수는 1~2000회여야 합니다.","El número de repeticiones debe estar entre 1 y 2000."],
  ["课程重复结束时间早于首次上课。","Recurrence ends before the first class.","繰り返しの終了日が初回授業日より前です。","課程重複結束時間早於首次上課。","반복 종료 시점이 첫 수업보다 빠릅니다.","La repetición termina antes de la primera clase."],
  ["课程日期跨度或课次数过大。","Course date span or occurrence count is too large.","授業期間または授業回数が上限を超えています。","課程日期跨度或課次數過大。","수업 기간 또는 횟수가 한도를 초과합니다.","El periodo o el número de clases supera el límite."],
  ["最多支持 500 个课表条目。","At most 500 timetable entries are supported.","時間割の項目は500件まで対応しています。","最多支援 500 個課表項目。","시간표 항목은 최대 500개까지 지원합니다.","Se admiten hasta 500 entradas de horario."],
  ["{0}，{1}节课","{0}, {1} classes","{0}、授業 {1} 回","{0}，{1} 堂課","{0}, 수업 {1}회","{0}, {1} clases"],
  ["金额须在 {0} 至 {1} 之间。","Amount must be between {0} and {1}.","金額は {0}～{1} の範囲にしてください。","金額須在 {0} 至 {1} 之間。","금액은 {0}~{1} 사이여야 합니다.","El importe debe estar entre {0} y {1}."],
  ["{0} · {1} {2} · {3} 分钟","{0} · {1} {2} · {3} min","{0} · {1} {2} · {3} 分","{0} · {1} {2} · {3} 分鐘","{0} · {1} {2} · {3}분","{0} · {1} {2} · {3} min"],
  ["{0} 至 {1}","{0} to {1}","{0}～{1}","{0} 至 {1}","{0} ~ {1}","{0} a {1}"],
  ["停课：{0}","Excluded: {0}","休講：{0}","停課：{0}","휴강: {0}","Sin clase: {0}"],
  ["{0} 个日历事件 · {1} 个课表条目 · 总课时 {2} 小时","{0} calendar events · {1} timetable entries · {2} total hours","イベント {0} 件・時間割 {1} 件・合計 {2} 時間","{0} 個行事曆事件 · {1} 個課表項目 · 總課時 {2} 小時","캘린더 이벤트 {0}개 · 시간표 항목 {1}개 · 총 {2}시간","{0} eventos · {1} entradas de horario · {2} horas en total"],
  ["扣除 {0} 次停课","{0} excluded classes","休講 {0} 回を除外","扣除 {0} 次停課","휴강 {0}회 제외","{0} clases excluidas"],
  ["课表日期范围 {0} 至 {1}（按首末课日）","Timetable dates {0} to {1} (first and last class)","時間割の期間 {0}～{1}（最初と最後の授業日）","課表日期範圍 {0} 至 {1}（依首末上課日）","시간표 기간 {0} ~ {1} (첫 수업일과 마지막 수업일)","Periodo del horario: {0} a {1} (primera y última clase)"],
  ["时区 {0}","Time zone {0}","タイムゾーン {0}","時區 {0}","시간대 {0}","Zona horaria {0}"],
  ["沿用当前学费 {0}","Using current tuition {0}","現在の学費 {0} を使用","沿用目前學費 {0}","현재 등록금 {0} 사용","Se usa la matrícula actual: {0}"],
  ["ICS 不含学费，请载入后补填有效学费。","ICS contains no tuition. Enter a valid amount after loading.","ICS に学費は含まれません。読み込み後に有効な学費を入力してください。","ICS 不含學費，請載入後補填有效學費。","ICS에는 등록금이 없습니다. 불러온 뒤 올바른 금액을 입력하세요.","El archivo ICS no incluye la matrícula. Introduce un importe válido después de cargarlo."],
  ["确认后仅替换编辑区的课表，核对并点击保存后才生效；原文件与已保存配置保留。","Confirmation loads the timetable into the editor. Review and save to apply. Original files and saved data are preserved.","確認後は編集欄の時間割のみ置き換えます。確認して保存すると適用されます。元のファイルと保存済み設定は保持されます。","確認後僅替換編輯區的課表，核對並儲存後才生效；原檔案與已儲存設定均保留。","확인하면 편집기에 시간표를 불러옵니다. 검토 후 저장해야 적용됩니다. 원본 파일과 저장된 설정은 유지됩니다.","La confirmación carga el horario en el editor. Revísalo y guarda para aplicarlo. Se conservan los archivos y datos originales."],
  ["旧版 {0} 草稿 · {1} 门课程。缺少完整学期信息，总课时无法计算。确认后仅载入编辑草稿，补充日期和学费并保存后才写入。","Legacy v{0} draft · {1} courses. Semester details are missing; total hours cannot be calculated. Confirmation loads a draft. Complete dates and tuition, then save.","旧版 {0} の下書き・授業 {1} 件。学期情報が不足しているため合計時間を計算できません。確認後は下書きを読み込みます。期間と学費を補完して保存してください。","舊版 {0} 草稿 · {1} 門課程。缺少完整學期資訊，無法計算總課時。確認後僅載入編輯草稿，補齊日期與學費並儲存後才寫入。","이전 버전 {0} 초안 · 과목 {1}개. 학기 정보가 부족하여 총 수업 시간을 계산할 수 없습니다. 확인하면 초안을 불러옵니다. 날짜와 등록금을 입력한 뒤 저장하세요.","Borrador de la versión {0} · {1} cursos. Faltan datos del semestre y no se pueden calcular las horas. La confirmación carga el borrador. Completa las fechas y la matrícula, y guarda."],
  ["{0} 门课程 · 学期总课时 {1} 小时","{0} courses · {1} semester hours","授業 {0} 件・学期の合計 {1} 時間","{0} 門課程 · 學期總課時 {1} 小時","과목 {0}개 · 학기 총 {1}시간","{0} cursos · {1} horas en el semestre"],
  ["学费 {0}","Tuition {0}","学費 {0}","學費 {0}","등록금 {0}","Matrícula {0}"],
  ["学期 {0} 至 {1}","Semester {0} to {1}","学期 {0}～{1}","學期 {0} 至 {1}","학기 {0} ~ {1}","Semestre: {0} a {1}"],
  ["每秒价值 {0}","Value per second {0}","1秒あたりの価値 {0}","每秒價值 {0}","초당 가치 {0}","Valor por segundo: {0}"],
  ["确认将替换当前配置，桌面会保留覆盖前备份。","Confirmation replaces current data. Desktop keeps a backup of replaced data.","確認すると現在の設定を置き換えます。デスクトップ版では上書き前のバックアップを保持します。","確認將替換目前設定，桌面版會保留覆寫前的備份。","확인하면 현재 설정이 교체됩니다. 데스크톱 앱은 기존 설정의 백업을 보관합니다.","La confirmación sustituye los datos actuales. La app de escritorio conserva una copia de los datos anteriores."],
  ["确认后写入配置。","Confirmation saves the configuration.","確認後に設定を保存します。","確認後寫入設定。","확인하면 설정을 저장합니다.","La confirmación guarda la configuración."],
  ["原浏览器数据和导入文件均保留。","Original browser data and imported files are preserved.","元のブラウザーデータと読み込みファイルは保持されます。","原瀏覽器資料與匯入檔案均保留。","원래 브라우저 데이터와 가져온 파일은 유지됩니다.","Se conservan los datos originales del navegador y los archivos importados."],
  ["学费回本计时器 · Tuition Payback","Tuition Payback Timer","学費回収タイマー","學費回本計時器 · Tuition Payback","등록금 회수 타이머","Temporizador de recuperación de matrícula"],
  ["语言与货币","Language & currency","言語と通貨","語言與貨幣","언어 및 통화","Idioma y moneda"],
  ["语言 / Language","Language","言語 / Language","語言 / Language","언어 / Language","Idioma / Language"],
  ["货币","Currency","通貨","貨幣","통화","Moneda"],
  ["选择你习惯的语言和学费计价货币，以后也可以修改。","Choose your language and tuition currency. You can change them later.","言語と学費の通貨を選んでください。後から変更できます。","選擇慣用語言與學費計價貨幣，之後也可以修改。","사용할 언어와 등록금 통화를 선택하세요. 나중에 변경할 수 있습니다.","Elige tu idioma y la moneda de la matrícula. Puedes cambiarlos más adelante."],
  ["请选择学费实际使用的货币。切换仅更改计价单位，不进行汇率换算。","Choose the currency your tuition is paid in. Changing the unit does not convert the amount.","学費の通貨を選んでください。通貨を変更しても為替換算は行いません。","請選擇學費實際使用的貨幣。切換僅變更計價單位，不進行匯率換算。","등록금에 실제로 사용하는 통화를 선택하세요. 통화를 바꿔도 금액은 환산되지 않습니다.","Elige la moneda de tu matrícula. Cambiar la unidad no convierte el importe."],
  ["稍后设置","Set up later","後で設定","稍後設定","나중에 설정","Más tarde"],
  ["开始使用","Get started","開始する","開始使用","시작하기","Empezar"],
  ["保存设置","Save preferences","設定を保存","儲存設定","설정 저장","Guardar ajustes"],
  ["语言或货币设置无效，请重新选择。","Choose a supported language and currency.","対応する言語と通貨を選んでください。","語言或貨幣設定無效，請重新選擇。","지원하는 언어와 통화를 선택하세요.","Elige un idioma y una moneda disponibles."],
  ["语言与货币设置版本不受支持，原文件保留。","Unsupported preference version. The original file is preserved.","未対応の設定バージョンです。元のファイルは保持されています。","語言與貨幣設定版本不受支援，原檔案保留。","지원하지 않는 설정 버전입니다. 원본 파일은 유지됩니다.","La versión de los ajustes no es compatible. Se conserva el archivo original."],
  ["偏好设置保存失败，请重试。{0}","Could not save preferences. Please retry. {0}","設定を保存できませんでした。再試行してください。{0}","偏好設定儲存失敗，請重試。{0}","설정을 저장하지 못했습니다. 다시 시도하세요. {0}","No se pudieron guardar los ajustes. Inténtalo de nuevo. {0}"],
  ["偏好设置读取失败，原数据保留。{0}","Could not read preferences. Your data is preserved. {0}","設定を読み込めませんでした。元のデータは保持されています。{0}","偏好設定讀取失敗，原資料保留。{0}","설정을 읽지 못했습니다. 기존 데이터는 유지됩니다. {0}","No se pudieron leer los ajustes. Se conservan tus datos. {0}"],
  ["窗口操作","Window controls","ウィンドウ操作","視窗操作","창 조작","Controles de ventana"],
  ["窗口置顶","Keep window on top","最前面に表示","視窗置頂","창을 항상 위에 표시","Mantener ventana encima"],
  ["置顶窗口","Keep on top","最前面に表示","置頂視窗","항상 위에 표시","Mantener encima"],
  ["取消置顶","Unpin window","最前面表示を解除","取消置頂","항상 위에 표시 해제","Dejar de mantener encima"],
  ["置顶操作失败：{0}","Could not pin window: {0}","最前面表示に失敗しました：{0}","置頂操作失敗：{0}","창 고정에 실패했습니다: {0}","No se pudo fijar la ventana: {0}"],
  ["窗口操作失败：{0}","Window action failed: {0}","ウィンドウ操作に失敗しました：{0}","視窗操作失敗：{0}","창 조작에 실패했습니다: {0}","Falló la acción de la ventana: {0}"],
  ["课程设置","Course settings","授業設定","課程設定","수업 설정","Ajustes de cursos"],
  ["最小化","Minimize","最小化","最小化","최소화","Minimizar"],
  ["最大化","Maximize","最大化","最大化","최대화","Maximizar"],
  ["还原窗口","Restore window","元のサイズに戻す","還原視窗","창 크기 복원","Restaurar ventana"],
  ["关闭窗口","Close window","ウィンドウを閉じる","關閉視窗","창 닫기","Cerrar ventana"],
  ["（仅界面展示）"," (preview only)","（表示のみ）","（僅介面展示）"," (미리보기 전용)"," (solo vista previa)"],
  ["本节课计时器","Class timer","授業タイマー","本堂課計時器","수업 타이머","Temporizador de clase"],
  ["尚未设置课程","No courses yet","授業が未設定です","尚未設定課程","아직 수업이 없습니다","Aún no hay cursos"],
  ["尚未设置","Not configured","未設定","尚未設定","설정되지 않음","Sin configurar"],
  ["示例","Demo","サンプル","範例","예시","Ejemplo"],
  ["未开始","Not started","開始前","未開始","시작 전","Sin empezar"],
  ["进行中","In progress","授業中","進行中","진행 중","En curso"],
  ["已结束","Finished","終了","已結束","종료됨","Finalizada"],
  ["本节课已回本","Recovered this class","この授業の回収額","本堂課已回本","이번 수업 회수액","Recuperado en esta clase"],
  ["本学期已回本：","Semester recovered: ","今学期の回収額：","本學期已回本：","이번 학기 회수액: ","Recuperado este semestre: "],
  ["好好上课！","Focus on class!","授業に集中！","好好上課！","수업에 집중하세요!","¡Concéntrate en clase!"],
  ["好好休息！","Rest well!","ゆっくり休もう！","好好休息！","푹 쉬세요!","¡Descansa bien!"],
  ["距离下课","Until class ends","授業終了まで","距離下課","수업 종료까지","Hasta el final"],
  ["距离开课","Until class starts","授業開始まで","距離上課","수업 시작까지","Hasta el inicio"],
  ["课程完成进度","Class progress","授業の進捗","課程完成進度","수업 진행률","Progreso de la clase"],
  ["开始 {0}","Start {0}","開始 {0}","開始 {0}","시작 {0}","Inicio {0}"],
  ["下课 {0}","End {0}","終了 {0}","下課 {0}","종료 {0}","Fin {0}"],
  ["开始","Start","開始","開始","시작","Inicio"],
  ["下课","End","終了","下課","종료","Fin"],
  ["点击右上角齿轮，设置学期和课表。","Use the gear to set up your semester and courses.","右上の歯車から学期と時間割を設定してください。","點擊右上角齒輪，設定學期與課表。","오른쪽 위 톱니바퀴에서 학기와 시간표를 설정하세요.","Usa el engranaje para configurar el semestre y los cursos."],
  ["第 {0} 周 / 共 {1} 周","Week {0} / {1}","第 {0} 週 / 全 {1} 週","第 {0} 週 / 共 {1} 週","{0}주차 / 총 {1}주","Semana {0} / {1}"],
  ["学期未开始 / 共 {0} 周","Semester starts soon / {0} weeks","学期開始前 / 全 {0} 週","學期未開始 / 共 {0} 週","학기 시작 전 / 총 {0}주","Semestre sin empezar / {0} semanas"],
  ["学期已结束 / 共 {0} 周","Semester ended / {0} weeks","学期終了 / 全 {0} 週","學期已結束 / 共 {0} 週","학기 종료 / 총 {0}주","Semestre terminado / {0} semanas"],
  ["学期未开始","Semester starts soon","学期開始前","學期未開始","학기 시작 전","Semestre sin empezar"],
  ["学期已结束","Semester ended","学期終了","學期已結束","학기 종료","Semestre terminado"],
  ["按课表已结束的 {0} 节课累计，下课后计入","Total from {0} completed classes; added when each class ends","終了した {0} 回分の合計。授業終了後に加算されます","依課表已結束的 {0} 堂課累計，下課後計入","완료된 수업 {0}회 합계, 각 수업 종료 후 반영","Total de {0} clases completadas; se añade al finalizar cada clase"],
  ["本节课金币已收齐 · 下节课重新累计","Class coins complete · resets next class","この授業のコイン獲得完了・次の授業でリセット","本堂課金幣已收齊 · 下堂課重新累計","이번 수업 코인 획득 완료 · 다음 수업에서 초기화","Monedas de esta clase completas · se reinicia en la siguiente"],
  ["再回本 {0}，落下下一枚","Recover {0} for the next coin","あと {0} で次のコイン","再回本 {0}，落下下一枚","{0} 더 회수하면 다음 코인 획득","Recupera {0} para la siguiente moneda"],
  ["第一枚金币正在路上","The first coin is on its way","最初のコインを獲得しましょう","第一枚金幣正在路上","첫 코인이 곧 도착합니다","La primera moneda está en camino"],
  ["本节课金币 {0} 枚，每 {1} 一枚","{0} class coins, one per {1}","この授業のコイン {0} 枚、{1} ごとに1枚","本堂課金幣 {0} 枚，每 {1} 一枚","이번 수업 코인 {0}개, {1}마다 1개","{0} monedas en esta clase, una por cada {1}"],
  ["本节课已回本 {0}","Recovered this class: {0}","この授業の回収額：{0}","本堂課已回本 {0}","이번 수업 회수액: {0}","Recuperado en esta clase: {0}"],
  ["已完成 {0}%，{1}","{0}% complete, {1}","{0}% 完了、{1}","已完成 {0}%，{1}","{0}% 완료, {1}","{0}% completado, {1}"],
  ["已下课","Class ended","授業終了","已下課","수업 종료","Clase terminada"],
  ["学期与课表","Semester & courses","学期と時間割","學期與課表","학기 및 시간표","Semestre y cursos"],
  ["关闭设置","Close settings","設定を閉じる","關閉設定","설정 닫기","Cerrar ajustes"],
  ["配置备份与恢复","Backup & restore","バックアップと復元","設定備份與還原","설정 백업 및 복원","Copia y restauración"],
  ["正在读取已保存配置…","Loading saved configuration…","保存済み設定を読み込み中…","正在讀取已儲存設定…","저장된 설정을 불러오는 중…","Cargando datos guardados…"],
  ["可恢复完整 JSON 备份，或导入 ICS 课表。ICS 不含学费，导入后需核对学费并保存。","Restore a JSON backup or import an ICS timetable. ICS has no tuition amount; check tuition and save after importing.","JSON バックアップの復元または ICS 時間割の読み込みができます。ICS に学費は含まれません。学費を確認して保存してください。","可還原完整 JSON 備份，或匯入 ICS 課表。ICS 不含學費，匯入後須核對學費並儲存。","JSON 백업을 복원하거나 ICS 시간표를 가져올 수 있습니다. ICS에는 등록금이 없으므로 가져온 뒤 등록금을 확인하고 저장하세요.","Restaura una copia JSON o importa un horario ICS. ICS no incluye la matrícula; comprueba el importe y guarda después de importar."],
  ["导出已保存配置","Export saved data","保存済み設定を出力","匯出已儲存設定","저장된 설정 내보내기","Exportar datos guardados"],
  ["导入 JSON / ICS","Import JSON / ICS","JSON / ICS を読み込む","匯入 JSON / ICS","JSON / ICS 가져오기","Importar JSON / ICS"],
  ["选择 JSON 备份或 ICS 课表","Choose a JSON backup or ICS timetable","JSON バックアップか ICS 時間割を選択","選擇 JSON 備份或 ICS 課表","JSON 백업 또는 ICS 시간표 선택","Elegir una copia JSON o un horario ICS"],
  ["恢复前核对","Review before restoring","復元前の確認","還原前核對","복원 전 확인","Revisar antes de restaurar"],
  ["课表导入前核对","Review timetable import","時間割読み込み前の確認","課表匯入前核對","시간표 가져오기 전 확인","Revisar el horario"],
  ["取消恢复","Cancel import","読み込みをキャンセル","取消還原","가져오기 취소","Cancelar importación"],
  ["确认恢复配置","Restore configuration","設定を復元","確認還原設定","설정 복원","Restaurar datos"],
  ["确认载入课表","Load timetable into editor","時間割を編集欄に読み込む","確認載入課表","편집기에 시간표 불러오기","Cargar horario en el editor"],
  ["确认载入草稿","Load draft into editor","下書きを編集欄に読み込む","確認載入草稿","편집기에 초안 불러오기","Cargar borrador en el editor"],
  ["学期总学费","Semester tuition","学期の学費合計","學期總學費","학기 등록금 총액","Matrícula del semestre"],
  ["例如：24000","e.g. 24000","例：24000","例如：24000","예: 24000","p. ej., 24000"],
  ["学期开始日期","Semester start date","学期開始日","學期開始日期","학기 시작일","Inicio del semestre"],
  ["学期结束日期","Semester end date","学期終了日","學期結束日期","학기 종료일","Fin del semestre"],
  ["学期首日为第 1 周，每 7 天一周；起止日期均计入。","Week 1 starts on the first day; each week is 7 days. Both dates are included.","初日が第1週の開始日です。1週は7日で、開始日と終了日を含みます。","學期首日為第 1 週，每 7 天一週；起訖日期均計入。","학기 첫날부터 1주차이며 한 주는 7일입니다. 시작일과 종료일을 모두 포함합니다.","La semana 1 empieza el primer día; cada semana tiene 7 días. Se incluyen ambas fechas."],
  ["每周课表","Weekly timetable","週間時間割","每週課表","주간 시간표","Horario semanal"],
  ["选择星期","Choose a weekday","曜日を選択","選擇星期","요일 선택","Elegir día de la semana"],
  ["这一天还没有课。","No classes on this day.","この曜日の授業はありません。","這一天還沒有課。","이 요일에는 수업이 없습니다.","No hay clases este día."],
  ["添加课程","Add a course","授業を追加","新增課程","수업 추가","Añadir curso"],
  ["课表每周重复，按日期范围内实际课次计算；填写停课日期后，该节不计时、不计入总课时。","Courses repeat weekly. Actual classes within the dates are counted; excluded dates are omitted from the timer and total hours.","授業は毎週繰り返します。期間内の実際の授業回数で計算し、休講日は計時と合計時間から除外します。","課表每週重複，依日期範圍內實際課次計算；填寫停課日期後，該堂課不計時，也不計入總課時。","수업은 매주 반복되며 기간 내 실제 수업 횟수로 계산합니다. 휴강일은 타이머와 총 수업 시간에서 제외됩니다.","Las clases se repiten cada semana. Se cuentan las clases reales dentro del periodo; los días excluidos no se suman al temporizador ni a las horas totales."],
  ["每秒价值","Value per second","1秒あたりの価値","每秒價值","초당 가치","Valor por segundo"],
  ["取消","Cancel","キャンセル","取消","취소","Cancelar"],
  ["保存学期与课表","Save semester & courses","学期と時間割を保存","儲存學期與課表","학기 및 시간표 저장","Guardar semestre y cursos"],
  ["载入实时示例","Load a live demo","リアルタイムのサンプルを読み込む","載入即時範例","실시간 예시 불러오기","Cargar un ejemplo en vivo"],
  ["当前第 {0} 周","Currently week {0}","現在第 {0} 週","目前第 {0} 週","현재 {0}주차","Semana actual: {0}"],
  ["共 {0} 天，{1} 周；{2}","{0} days, {1} weeks; {2}","{0} 日間、{1} 週間；{2}","共 {0} 天，{1} 週；{2}","총 {0}일, {1}주; {2}","{0} días, {1} semanas; {2}"],
  ["学期总上课时长：{0} 小时 {1} 分钟","Total class time: {0} h {1} min","授業時間の合計：{0} 時間 {1} 分","學期總上課時長：{0} 小時 {1} 分鐘","총 수업 시간: {0}시간 {1}분","Tiempo total de clase: {0} h {1} min"],
  ["{0} / 秒","{0} / second","{0} / 秒","{0} / 秒","{0} / 초","{0} / segundo"],
  ["例如：经济学","e.g. Economics","例：経済学","例如：經濟學","예: 경제학","p. ej., Economía"],
  ["例如：2026-11-26，多日用逗号分隔","e.g. 2026-11-26; separate dates with commas","例：2026-11-26、複数の日付はカンマで区切る","例如：2026-11-26，多日以逗號分隔","예: 2026-11-26, 여러 날짜는 쉼표로 구분","p. ej., 2026-11-26; separa las fechas con comas"],
  ["移除{0}","Remove {0}","{0} を削除","移除{0}","{0} 삭제","Eliminar {0}"],
  ["这节课程","this course","この授業","這堂課程","이 수업","este curso"],
  ["移除课程","Remove course","授業を削除","移除課程","수업 삭제","Eliminar curso"],
  ["课程名称","Course name","授業名","課程名稱","수업 이름","Nombre del curso"],
  ["课程时长","Class duration","授業時間","課程時長","수업 시간","Duración de la clase"],
  ["小时","hours","時間","小時","시간","horas"],
  ["分钟","minutes","分","分鐘","분","minutos"],
  ["上课时间","Start time","開始時刻","上課時間","시작 시간","Hora de inicio"],
  ["课程开始日期","Course start date","授業開始日","課程開始日期","수업 시작일","Fecha inicial del curso"],
  ["课程结束日期","Course end date","授業終了日","課程結束日期","수업 종료일","Fecha final del curso"],
  ["日期留空沿用学期起止日期；仅在课程日期范围内每周重复。","Leave dates blank to use the semester dates. Repeats weekly within the course dates.","日付が空欄の場合は学期の期間を使用します。授業の期間内で毎週繰り返します。","日期留空則沿用學期起訖日期；僅在課程日期範圍內每週重複。","날짜를 비워 두면 학기 기간을 사용합니다. 수업 기간 내에서 매주 반복됩니다.","Deja las fechas en blanco para usar las del semestre. Se repite semanalmente dentro del periodo del curso."],
  [" 原时长含秒，已四舍五入到整分钟，保存后生效。"," Duration was rounded to whole minutes; takes effect on save."," 元の秒数を含む時間を分単位に丸めました。保存後に適用されます。"," 原時長含秒，已四捨五入至整分鐘，儲存後生效。"," 기존 시간은 분 단위로 반올림되었으며 저장 후 적용됩니다."," La duración se ha redondeado a minutos completos; se aplica al guardar."],
  ["停课日期（可选）","Excluded dates (optional)","休講日（任意）","停課日期（選填）","휴강일 (선택)","Días sin clase (opcional)"],
  ["正在保存…","Saving…","保存中…","正在儲存…","저장 중…","Guardando…"],
  ["正在保存，请等待成功后再关闭窗口…","Saving. Please wait before closing the window…","保存中です。完了してからウィンドウを閉じてください…","正在儲存，請等待成功後再關閉視窗…","저장 중입니다. 완료된 뒤 창을 닫아 주세요…","Guardando. Espera a que termine antes de cerrar la ventana…"],
  ["配置正在保存，请等待成功后再关闭。","Saving data. Wait until saving finishes before closing.","設定を保存中です。完了してから閉じてください。","設定正在儲存，請等待成功後再關閉。","설정을 저장 중입니다. 완료된 뒤 닫아 주세요.","Guardando datos. Espera a que termine antes de cerrar."],
  ["保存失败，编辑内容已保留。请检查磁盘空间或写入权限后重试。{0}","Save failed. Your edits are retained. Check disk space or write permissions and retry. {0}","保存できませんでした。編集内容は保持されています。空き容量や書き込み権限を確認して再試行してください。{0}","儲存失敗，編輯內容已保留。請檢查磁碟空間或寫入權限後重試。{0}","저장에 실패했습니다. 편집 내용은 유지됩니다. 디스크 공간이나 쓰기 권한을 확인한 뒤 다시 시도하세요. {0}","No se pudo guardar. Se conservan tus cambios. Comprueba el espacio en disco o los permisos de escritura e inténtalo de nuevo. {0}"],
  ["已保存学期与课表，按课表自动切换课程。","Semester and courses saved. Classes switch automatically.","学期と時間割を保存しました。授業は自動で切り替わります。","已儲存學期與課表，依課表自動切換課程。","학기와 시간표를 저장했습니다. 수업은 자동으로 전환됩니다.","Semestre y cursos guardados. Las clases cambian automáticamente."],
  ["已载入实时课表示例。","Live timetable demo loaded.","リアルタイムの時間割サンプルを読み込みました。","已載入即時課表範例。","실시간 시간표 예시를 불러왔습니다.","Se ha cargado el horario de ejemplo en vivo."],
  ["没有已保存的完整配置。请先补充并保存学期和课表。","No complete saved configuration. Set up and save your semester and courses first.","保存済みの設定がありません。学期と時間割を設定して保存してください。","沒有已儲存的完整設定。請先補齊並儲存學期與課表。","저장된 전체 설정이 없습니다. 먼저 학기와 시간표를 입력하고 저장하세요.","No hay datos completos guardados. Configura y guarda primero el semestre y los cursos."],
  ["备份文件已保存；原配置保留。","Backup saved; original data preserved.","バックアップを保存しました。元の設定は保持されています。","備份檔案已儲存；原設定保留。","백업 파일을 저장했습니다. 기존 설정은 유지됩니다.","Copia guardada; se conservan los datos originales."],
  ["已发起完整配置下载，请在浏览器下载列表确认。原浏览器数据保留。","Backup download started. Check your browser downloads. Original browser data is preserved.","バックアップのダウンロードを開始しました。ブラウザーのダウンロード一覧を確認してください。元のデータは保持されています。","已開始下載完整設定，請至瀏覽器下載清單確認。原瀏覽器資料保留。","전체 설정 다운로드를 시작했습니다. 브라우저 다운로드 목록에서 확인하세요. 기존 브라우저 데이터는 유지됩니다.","Se ha iniciado la descarga de la copia. Comprueba las descargas del navegador. Se conservan los datos originales."],
  ["已取消导出。","Export cancelled.","出力をキャンセルしました。","已取消匯出。","내보내기를 취소했습니다.","Exportación cancelada."],
  ["导出失败：{0}","Export failed: {0}","出力に失敗しました：{0}","匯出失敗：{0}","내보내기 실패: {0}","Error al exportar: {0}"],
  ["未导入：{0} 当前设置未改变。","Import failed: {0} Current settings are unchanged.","読み込みできませんでした：{0} 現在の設定は変更されていません。","未匯入：{0} 目前設定未變更。","가져오기 실패: {0} 현재 설정은 유지됩니다.","Error al importar: {0} Los ajustes actuales no han cambiado."],
  ["ICS 课表已载入编辑区，尚未保存。请核对学费、课程日期和停课信息，点击保存后生效。","ICS timetable loaded into the editor, not yet saved. Check tuition, dates and exclusions, then save.","ICS 時間割を編集欄に読み込みました。未保存です。学費、授業日、休講日を確認して保存してください。","ICS 課表已載入編輯區，尚未儲存。請核對學費、課程日期與停課資訊，儲存後才生效。","ICS 시간표를 편집기에 불러왔으며 아직 저장하지 않았습니다. 등록금, 수업 날짜와 휴강일을 확인한 뒤 저장하세요.","Horario ICS cargado en el editor, aún sin guardar. Comprueba la matrícula, las fechas y los días sin clase, y guarda."],
  ["旧版草稿已载入，尚未保存；请补充学期信息后保存。","Legacy draft loaded, not yet saved. Complete semester details and save.","旧版の下書きを読み込みました。学期情報を補完して保存してください。","舊版草稿已載入，尚未儲存；請補齊學期資訊後儲存。","이전 버전의 초안을 불러왔으며 아직 저장하지 않았습니다. 학기 정보를 완성한 뒤 저장하세요.","Borrador antiguo cargado, aún sin guardar. Completa los datos del semestre y guarda."],
  ["已确认恢复并保存完整配置。","Configuration restored and saved.","設定を復元して保存しました。","已確認還原並儲存完整設定。","전체 설정을 복원하고 저장했습니다.","Datos restaurados y guardados."],
  ["本地时间 · {0}","Local time · {0}","現地時間 · {0}","本地時間 · {0}","현지 시간 · {0}","Hora local · {0}"],
  ["已恢复学期与课表。","Semester and courses restored.","学期と時間割を復元しました。","已還原學期與課表。","학기와 시간표를 복원했습니다.","Semestre y cursos restaurados."],
  ["请点击齿轮补充学期学费、起止日期和每周课表；原课程已保留为未保存草稿。","Use the gear to complete tuition, semester dates and courses. Original courses are retained as an unsaved draft.","歯車から学費、学期の期間、週間時間割を補完してください。元の授業は未保存の下書きとして保持されています。","請點擊齒輪補齊學期學費、起訖日期與每週課表；原課程已保留為未儲存草稿。","톱니바퀴에서 등록금, 학기 기간과 주간 시간표를 완성하세요. 기존 수업은 저장되지 않은 초안으로 유지됩니다.","Usa el engranaje para completar la matrícula, las fechas y el horario. Los cursos originales se conservan como borrador sin guardar."],
  ["未能读取上次设置：{0} 原数据保留，可在设置中恢复备份。","Could not load saved settings: {0} Original data is preserved. Restore a backup in settings.","前回の設定を読み込めませんでした：{0} 元のデータは保持されています。設定からバックアップを復元できます。","無法讀取上次設定：{0} 原資料保留，可在設定中還原備份。","저장된 설정을 불러오지 못했습니다: {0} 기존 데이터는 유지됩니다. 설정에서 백업을 복원할 수 있습니다.","No se pudieron cargar los ajustes guardados: {0} Se conservan los datos originales. Puedes restaurar una copia en los ajustes."],
  ["桌面配置保存在应用数据目录，保存成功后才生效。","Desktop data is stored in the app data folder. Changes take effect after saving succeeds.","設定はアプリデータフォルダーに保存され、保存成功後に適用されます。","桌面設定儲存於應用程式資料目錄，儲存成功後才生效。","데스크톱 설정은 앱 데이터 폴더에 저장되며 저장에 성공한 뒤 적용됩니다.","Los datos de escritorio se guardan en la carpeta de la app. Los cambios se aplican al guardar correctamente."],
  ["浏览器配置来源：{0}。请在原先录入课表的浏览器与地址导出。","Browser data source: {0}. Export from the browser and address where you entered your courses.","ブラウザーデータの保存元：{0}。時間割を入力したブラウザーとアドレスから出力してください。","瀏覽器設定來源：{0}。請在原先輸入課表的瀏覽器與網址匯出。","브라우저 데이터 위치: {0}. 시간표를 입력한 브라우저와 주소에서 내보내세요.","Origen de los datos del navegador: {0}. Exporta desde el navegador y la dirección donde introdujiste los cursos."],
  ["配置保存位置：{0}。每次覆盖保留备份，保存成功后才生效。","Data location: {0}. Replaced data is backed up; changes apply only after a successful save.","保存先：{0}。上書き前にバックアップし、保存成功後に適用されます。","設定儲存位置：{0}。每次覆寫均保留備份，儲存成功後才生效。","저장 위치: {0}. 덮어쓰기 전에 백업을 보관하며 저장에 성공한 뒤 적용됩니다.","Ubicación de los datos: {0}. Se conserva una copia antes de sustituirlos; los cambios se aplican al guardar correctamente."],
  ["学期结束日期不能早于开始日期。","Semester end date cannot be before the start date.","学期終了日は開始日以降にしてください。","學期結束日期不得早於開始日期。","학기 종료일은 시작일보다 빠를 수 없습니다.","El semestre no puede terminar antes de su inicio."],
  ["请填写课程名称，最多 80 个字符。","Enter a course name, up to 80 characters.","授業名は80文字以内で入力してください。","請填寫課程名稱，最多 80 個字元。","수업 이름을 80자 이내로 입력하세요.","Introduce un nombre de curso de hasta 80 caracteres."],
  ["课程开始日期须在学期范围内。","Course start date must be within the semester.","授業開始日は学期の期間内にしてください。","課程開始日期須在學期範圍內。","수업 시작일은 학기 기간 내여야 합니다.","La fecha inicial del curso debe estar dentro del semestre."],
  ["课程结束日期须在学期范围内。","Course end date must be within the semester.","授業終了日は学期の期間内にしてください。","課程結束日期須在學期範圍內。","수업 종료일은 학기 기간 내여야 합니다.","La fecha final del curso debe estar dentro del semestre."],
  ["课程结束日期不能早于开始日期。","Course end date cannot be before its start date.","授業終了日は開始日以降にしてください。","課程結束日期不得早於開始日期。","수업 종료일은 시작일보다 빠를 수 없습니다.","El curso no puede terminar antes de su inicio."],
  ["停课日期须是课程日期范围内的上课日。","Excluded dates must be scheduled class days within the course dates.","休講日は授業期間内の授業日にしてください。","停課日期須為課程日期範圍內的上課日。","휴강일은 수업 기간 내의 예정된 수업일이어야 합니다.","Los días excluidos deben ser días de clase dentro del periodo del curso."],
  ["请输入有效金额，最多保留两位小数。","Enter a valid amount with up to two decimal places.","小数点以下2桁までの有効な金額を入力してください。","請輸入有效金額，最多保留兩位小數。","소수점 이하 두 자리까지 올바른 금액을 입력하세요.","Introduce un importe válido con un máximo de dos decimales."],
  ["金额须在 $0.01 至 $9,999,999.99 之间。","Amount must be between 0.01 and 9,999,999.99 in your chosen currency.","金額は選択した通貨で 0.01～9,999,999.99 の範囲にしてください。","金額須在所選貨幣的 0.01 至 9,999,999.99 之間。","금액은 선택한 통화로 0.01~9,999,999.99 사이여야 합니다.","El importe debe estar entre 0,01 y 9.999.999,99 en la moneda elegida."],
  ["小时须填写非负整数。","Hours must be a non-negative integer.","時間は0以上の整数を入力してください。","小時須填寫非負整數。","시간은 0 이상의 정수여야 합니다.","Las horas deben ser un número entero no negativo."],
  ["分钟须填写 0 至 59 的整数。","Minutes must be an integer from 0 to 59.","分は0～59の整数を入力してください。","分鐘須填寫 0 至 59 的整數。","분은 0~59 사이의 정수여야 합니다.","Los minutos deben ser un número entero entre 0 y 59."],
  ["单节课时长不能超过 24 小时。","A class cannot exceed 24 hours.","1回の授業は24時間以内にしてください。","單堂課時長不得超過 24 小時。","한 수업은 24시간을 초과할 수 없습니다.","Una clase no puede durar más de 24 horas."],
  ["课程时长须至少为 1 分钟。","A class must last at least one minute.","授業時間は1分以上にしてください。","課程時長須至少為 1 分鐘。","수업은 최소 1분 이상이어야 합니다.","Una clase debe durar al menos un minuto."],
  ["请选择完整的日期。","Choose a complete date.","日付を選択してください。","請選擇完整日期。","전체 날짜를 선택하세요.","Elige una fecha completa."],
  ["该日期或本地时间不存在，请重新选择。","That date or local time does not exist. Choose another.","その日付または現地時刻は存在しません。選び直してください。","該日期或本地時間不存在，請重新選擇。","해당 날짜 또는 현지 시간이 존재하지 않습니다. 다시 선택하세요.","Esa fecha u hora local no existe. Elige otra."],
  ["请选择有效的上课时间。","Choose a valid class start time.","有効な授業開始時刻を選択してください。","請選擇有效的上課時間。","올바른 수업 시작 시간을 선택하세요.","Elige una hora de inicio válida."],
  ["请在每周课表中至少添加一节课。","Add at least one class to the weekly timetable.","週間時間割に1つ以上の授業を追加してください。","請在每週課表中至少新增一堂課。","주간 시간표에 최소 한 수업을 추가하세요.","Añade al menos una clase al horario semanal."],
  ["学期日期范围内没有这些课程，请检查日期和星期。","No classes fall within the semester. Check dates and weekdays.","学期の期間内に授業がありません。日付と曜日を確認してください。","學期日期範圍內沒有這些課程，請檢查日期與星期。","학기 기간 내에 해당 수업이 없습니다. 날짜와 요일을 확인하세요.","No hay clases dentro del semestre. Comprueba las fechas y los días de la semana."],
  ["“{0}”和“{1}”的上课时间重叠，请检查课表。","“{0}” and “{1}” overlap. Check your timetable.","「{0}」と「{1}」の授業時間が重複しています。時間割を確認してください。","「{0}」與「{1}」的上課時間重疊，請檢查課表。","「{0}」와 「{1}」의 수업 시간이 겹칩니다. 시간표를 확인하세요.","Las clases «{0}» y «{1}» se solapan. Comprueba el horario."],
  ["“{0}”的结束日期不能早于开始日期。","“{0}” ends before it starts.","「{0}」の終了日は開始日以降にしてください。","「{0}」的結束日期不得早於開始日期。","「{0}」의 종료일은 시작일보다 빠를 수 없습니다.","«{0}» termina antes de empezar."],
  ["“{0}”的起止日期须在学期范围内。","“{0}” dates must fall within the semester.","「{0}」の日付は学期の期間内にしてください。","「{0}」的起訖日期須在學期範圍內。","「{0}」의 기간은 학기 기간 내여야 합니다.","Las fechas de «{0}» deben estar dentro del semestre."],
  ["“{0}”的停课日期格式无效。","Invalid excluded dates for “{0}”.","「{0}」の休講日の形式が無効です。","「{0}」的停課日期格式無效。","「{0}」의 휴강일 형식이 올바르지 않습니다.","Los días sin clase de «{0}» no son válidos."],
  ["“{0}”的停课日期须是课程范围内的上课日。","Excluded dates for “{0}” must be scheduled class days within its dates.","「{0}」の休講日は授業期間内の授業日にしてください。","「{0}」的停課日期須為課程範圍內的上課日。","「{0}」의 휴강일은 수업 기간 내의 예정된 수업일이어야 합니다.","Los días sin clase de «{0}» deben ser días programados dentro de su periodo."],
  ["停课日期须使用 YYYY-MM-DD 格式。","Excluded dates must use YYYY-MM-DD.","休講日は YYYY-MM-DD 形式で入力してください。","停課日期須使用 YYYY-MM-DD 格式。","휴강일은 YYYY-MM-DD 형식을 사용하세요.","Los días sin clase deben usar el formato YYYY-MM-DD."],
  ["学期配置格式无效。","Invalid semester configuration.","学期設定の形式が無効です。","學期設定格式無效。","학기 설정 형식이 올바르지 않습니다.","La configuración del semestre no es válida."],
  ["课程配置格式无效。","Invalid course configuration.","授業設定の形式が無効です。","課程設定格式無效。","수업 설정 형식이 올바르지 않습니다.","La configuración del curso no es válida."],
  ["停课日期格式无效。","Invalid excluded-date format.","休講日の形式が無効です。","停課日期格式無效。","휴강일 형식이 올바르지 않습니다.","El formato de los días sin clase no es válido."],
  ["配置文件过大，最多支持 1 MB。","Configuration exceeds the 1 MB limit.","設定ファイルの上限は1 MBです。","設定檔案過大，上限為 1 MB。","설정 파일이 1 MB 한도를 초과합니다.","El archivo de configuración supera el límite de 1 MB."],
  ["配置文件损坏，无法解析 JSON。请重新选择导出的备份。","Invalid JSON file. Choose an exported backup.","JSON ファイルが無効です。出力したバックアップを選択してください。","設定檔案損壞，無法解析 JSON。請重新選擇匯出的備份。","JSON 파일을 읽을 수 없습니다. 내보낸 백업 파일을 다시 선택하세요.","El archivo JSON no es válido. Selecciona una copia exportada."],
  ["配置文件格式无效。","Invalid configuration file format.","設定ファイルの形式が無効です。","設定檔案格式無效。","설정 파일 형식이 올바르지 않습니다.","El formato del archivo de configuración no es válido."],
  ["含停课日期的配置须使用版本 4，原文件未修改。","Excluded dates require configuration version 4. Original file unchanged.","休講日を含む設定にはバージョン4が必要です。元のファイルは未変更です。","含停課日期的設定須使用版本 4，原檔案未修改。","휴강일을 포함하는 설정은 버전 4가 필요합니다. 원본 파일은 변경되지 않았습니다.","Los días sin clase requieren la versión 4. El archivo original no se ha modificado."],
  ["旧版课程草稿无效。原文件未修改。","Invalid legacy course draft. Original file unchanged.","旧版の授業下書きが無効です。元のファイルは未変更です。","舊版課程草稿無效。原檔案未修改。","이전 버전의 수업 초안이 올바르지 않습니다. 원본 파일은 변경되지 않았습니다.","El borrador antiguo no es válido. El archivo original no se ha modificado."],
  ["旧版课程时长无效。","Invalid legacy class duration.","旧版の授業時間が無効です。","舊版課程時長無效。","이전 버전의 수업 시간이 올바르지 않습니다.","La duración de la clase antigua no es válida."],
  ["不支持配置版本 {0}。请使用兼容版本，原文件未修改。","Unsupported configuration version {0}. Use a compatible version. Original file unchanged.","設定バージョン {0} は未対応です。対応するバージョンを使用してください。元のファイルは未変更です。","不支援設定版本 {0}。請使用相容版本，原檔案未修改。","설정 버전 {0}는 지원하지 않습니다. 호환되는 버전을 사용하세요. 원본 파일은 변경되지 않았습니다.","La versión {0} no es compatible. Usa una versión compatible. El archivo original no se ha modificado."],
  ["学期总学费或总上课时长无效，请重新输入。","Invalid tuition or total class time. Enter them again.","学費または授業時間の合計が無効です。入力し直してください。","學期總學費或總上課時長無效，請重新輸入。","등록금 또는 총 수업 시간이 올바르지 않습니다. 다시 입력하세요.","La matrícula o el tiempo total de clase no son válidos. Introdúcelos de nuevo."],
  ["学期数据无效。","Invalid semester data.","学期データが無効です。","學期資料無效。","학기 데이터가 올바르지 않습니다.","Los datos del semestre no son válidos."],
  ["每周课表数据无效。","Invalid weekly timetable data.","週間時間割データが無効です。","每週課表資料無效。","주간 시간표 데이터가 올바르지 않습니다.","Los datos del horario semanal no son válidos."],
  ["请填写有效的课程名称与时长，每节课须在 0.01 至 24 小时之间。","Enter valid course names and durations between 0.01 and 24 hours.","有効な授業名と、0.01～24時間の授業時間を入力してください。","請填寫有效課程名稱與時長，每堂課須在 0.01 至 24 小時之間。","올바른 수업 이름과 시간을 입력하세요. 수업 시간은 0.01~24시간 사이여야 합니다.","Introduce nombres y duraciones válidos; cada clase debe durar entre 0,01 y 24 horas."],
];

let language = defaultPreferences.language;
export const messageColumns = { 'zh-CN': 0, 'en-US': 1, 'ja-JP': 2, 'zh-TW': 3, 'ko-KR': 4, 'es-ES': 5 };
export function setLanguage(value) { language = value; }
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patterns = messages.filter(([source]) => /\{\d+\}/.test(source)).map(row => ({
  row, pattern: new RegExp('^' + row[0].split(/\{\d+\}/).map(escape).join('([\\s\\S]*?)') + '$'),
})).sort((a, b) => b.row[0].replace(/\{\d+\}/g, '').length - a.row[0].replace(/\{\d+\}/g, '').length);
const catalogBySource = new Map(messages.map(row => [row[0], row]));
const literals = messages.filter(([source]) => !/\{\d+\}/.test(source)).sort((a, b) => b[0].length - a[0].length);

export function translate(value, targetLanguage = language) {
  const text = String(value);
  if (targetLanguage === 'zh-CN') return text;
  const column = messageColumns[targetLanguage] ?? messageColumns['en-US'];
  const exact = catalogBySource.get(text);
  if (exact) return exact[column];
  for (const { row, pattern } of patterns) {
    const match = pattern.exec(text);
    if (match) return row[column].replace(/\{(\d+)\}/g, (_, index) => translate(match[Number(index) + 1], targetLanguage));
  }
  // Composite messages include validated calculator errors and native details.
  return literals.reduce((result, row) => result.replaceAll(row[0], row[column]), text);
}

export function t(source, ...values) {
  return translate(source).replace(/\{(\d+)\}/g, (_, index) => values[index]);
}

export function localizeDocument(root = document) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('script, style') && /[\u3400-\u9fff]/.test(node.textContent)) nodes.push([node, node.textContent]);
  }
  const attributes = [];
  for (const element of root.querySelectorAll('[aria-label], [title], [placeholder]')) {
    for (const name of ['aria-label', 'title', 'placeholder']) {
      const source = element.getAttribute(name);
      if (source && /[\u3400-\u9fff]/.test(source)) attributes.push([element, name, source]);
    }
  }
  return () => {
    document.documentElement.lang = language;
    for (const [node, source] of nodes) node.textContent = translate(source);
    for (const [element, name, source] of attributes) element.setAttribute(name, translate(source));
  };
}
