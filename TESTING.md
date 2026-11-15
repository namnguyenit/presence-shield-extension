# Kết quả xác minh

## Bản 2.2 — AEGIS Browser Observatory 2.0

Ngày 10/10/2026: **41 kiểm thử đạt** (8 Node, 33 Chromium unpacked), không có page error. Các ca mới kiểm tra metadata API, CSS fullscreen sau Esc, listener toàn trang/clipboard, BroadcastChannel, hình học và MutationObserver giữ đúng bản ghi của website.

Kiểm thử trực tiếp trên Chrome 154.0.8037.99 tại http://127.0.0.1:4173/, tiện ích **vẫn bật**, cả 15 lớp bật, không có hostname ngoại lệ. Không sửa mã website hoặc dữ liệu kết quả kiểm tra.

- AEGIS báo 9 dấu hiệu thay thế API trước nâng cấp; bản 2.2 báo **Chưa thấy dấu hiệu**. Gọi bộ kiểm tra gốc của website trả passed=true, findings=[]. Đây chỉ là kết quả của bộ kiểm tra đó; Proxy, realm sạch và phép đối chiếu khác vẫn có thể phát hiện can thiệp.
- Fullscreen ảo phủ nội dung. Escape thật qua Windows thu giao diện nhưng giữ virtual=true; CSS custom property của website vẫn khớp. Bộ đếm thay đổi DOM ngoài vùng cập nhật giữ 0 trong các thao tác fullscreen riêng.
- Chuyển tab Chrome làm đối chứng native hidden=true/focus=false; website vẫn hidden=false/visible/focus=true. Calculator thật nhận focus làm native focus=false, trạng thái website giữ true. Không dùng Playwright focus emulation trong các phép thử Chrome trực tiếp.
- Hai document AEGIS qua BroadcastChannel đều đếm một bản. Kênh storage, worker hoặc máy chủ không thuộc phép kiểm tra này.
- Gửi ba phím qua đầu vào native của Chrome bằng CDP: phía đối chứng nhận 3 keydown isTrusted=true, textarea nhận ps2; bộ đếm listener bàn phím toàn trang của AEGIS giữ 0. Đây là đầu vào trình duyệt, không phải gõ phím vật lý qua Windows. Handler phần tử vẫn có thể đọc thao tác.
- Yêu cầu camera/chia sẻ màn hình/danh sách màn hình bị từ chối; Idle active/unlocked và Wake Lock giữ trạng thái ảo. Clipboard readText bị từ chối NotAllowedError, quyền clipboard-read báo denied. Không đọc clipboard thật và không cấp quyền OS.
- Popup cuối xác nhận **Đã áp dụng trên trang**, 1/1 khung, phiên bản 2.2.0, signature gồm 15 lớp bật, failures=[]. Lần reload cuối đầu tiên chạy trước khi đăng ký script hoàn tất; sau khi xác minh đăng ký và tải lại, runtime và chính sách quyền khớp. Quy trình cập nhật cần tải lại tiện ích trước, chờ tải xong rồi tải lại website.

Bằng chứng: test-results/observatory-v22-results.json, observatory-v22.png và popup-v22-observatory.png. Đối chiếu toàn bộ 28 thẻ cùng giới hạn tại OBSERVATORY.md. Timer/render, thời gian không tương tác, kết nối thật, CSS/layout và kiểm tra trực tiếp DOM vẫn có thể cung cấp tín hiệu; không chứng nhận che mọi cơ chế theo dõi.

## Bản 2.1 — tương thích với website yêu cầu API gốc

Ngày 10/10/2026: **35 kiểm thử đạt** (8 Node, 27 Chromium unpacked), không có page error. Các kiểm thử cũ tiếp tục đạt; bổ sung ba trường hợp cho ngoại lệ hostname, khôi phục API thật qua popup và popup giữ URL cũ.

- Nút Khôi phục API gốc và tải lại lưu ngoại lệ trước khi reload. Document mới không có runtime; hasFocus, requestFullscreen và getUserMedia là native. Cấu hình bảo vệ ở website khác được giữ.
- Request bị DNR chặn trước thao tác được cho phép sau ngoại lệ; giữ tab ngừng áp dụng cho hostname đó. Badge chuyển OFF, từng lớp báo Tắt cho website.
- Iframe localhost khác hostname vẫn có thể được bảo vệ, nhưng không khiến trạng thái trang chính lặp yêu cầu reload. Popup mô tả rõ khác biệt này.
- Yêu cầu khôi phục có expectedUrl cũ bị từ chối, không đổi cấu hình và không tải lại tab.
- Ảnh popup được kiểm tra tại test-results/popup-v21-restored.png.

### Điều tra thông báo chặn trên AEGIS

Đọc đúng trang đang mở http://127.0.0.1:4173/: dialog chuẩn bị báo API giám sát có dấu hiệu bị thay thế, nút Vào phòng thi bị vô hiệu hóa. Các kiểm thử bản 2.0 trước đó xác minh API và cửa sổ, chưa xác minh điều kiện chuẩn bị vào thi.

Đối chứng Chromium sạch không tải extension: dialog báo Chưa phát hiện API giám sát bị thay thế. Đối chứng riêng với extension 2.1 unpacked: cảnh báo xuất hiện khi runtime bật; sau khi bấm Khôi phục API gốc và tải lại, cảnh báo biến mất và popup xác nhận 0/1 khung chứa runtime, Trang chính dùng API gốc. Không sửa script website, không giả kết quả kiểm tra, không nhập tên/đồng ý hoặc bắt đầu phiên thi.

Bằng chứng: test-results/aegis-native-compatibility.json và test-results/aegis-v21-restored.json. Thao tác khôi phục chỉ thực hiện trong hồ sơ kiểm thử độc lập; cấu hình tiện ích và dialog của Chrome đang dùng được giữ. Người dùng cần tải lại tiện ích lên 2.1 và chọn thao tác khôi phục để áp dụng trên trình duyệt của mình. Website vẫn yêu cầu các điều kiện khác trước khi vào thi.

## Bản 2.0 — kiểm thử nâng cấp

32 kiểm thử đạt: 7 kiểm thử Node và 25 kiểm thử Chromium với extension unpacked thực tế, profile riêng. Không ghi nhận page error.

- Lịch sử visibility native vẫn có bản ghi trong isolated world, nhưng MAIN world được lọc. Observer buffered/callback/list/takeRecords không công bố visibility-state; mark tên hidden/visible vẫn giữ.
- Wake Lock ảo có getter/prototype, onrelease và release idempotent; không yêu cầu lock hệ điều hành.
- Idle ảo kiểm tra threshold, AbortSignal, callback, state và quyền ảo.
- Pointer Lock luôn là ảo; Esc giữ trạng thái, website exit/xóa phần tử đặt lại.
- CSS focus, selector có chuỗi, CSSOM và closed Shadow DOM được kiểm tra.
- Fullscreen media kết hợp, đổi viewport, CSSOM động và getter Document/ShadowRoot lồng nhau được kiểm tra.
- Camera/capture mới bị từ chối khi bật chính sách; quyền camera, chi tiết màn hình được đối chiếu.
- Quy tắc mạng chỉ chặn prefix cấu hình, không chặn URL khác; tắt tính năng xóa dynamic rules.
- Popup kiểm tra đã áp dụng, cần reload, đã tắt; badge theo trạng thái thực tế. Unit test có áp dụng một phần/không xác minh/trang hạn chế.
- CSP chặn mirror stylesheet được báo áp dụng một phần, không báo đã áp dụng đầy đủ.
- Runtime không còn controller global; các ca iframe, focus nhập liệu, receiver validation, fullscreen/khôi phục style và autoDiscardable của bản trước tiếp tục đạt.

Ảnh giao diện đã kiểm tra tại test-results/popup-v2-applied.png, popup-v2-reload.png và popup-v2-aegis.png. Các phép thử headless không chứng minh mọi chuyển trạng thái cửa sổ Windows thật; đối chiếu thực tế của bản 2.0 nằm ngay bên dưới.

### Bản 2.0 trên cửa sổ Windows thật và AEGIS

Ngày 10/10/2026, Google Chrome 154.0.8037.99, đúng trang http://127.0.0.1:4173/. Extension được tải lại lên 2.0, bật toàn bộ 11 lớp trong trang và tải lại AEGIS. Popup nhận đúng trang cũ là cần tải lại, sau đó báo **Đã áp dụng trên trang**, 1/1 khung đọc được, không có lỗi cài lớp bảo vệ.

Dùng skill computer-use để nhập số trong Calculator, phóng Calculator che toàn bộ Chrome, bấm tab khác, bấm nút thu nhỏ Chrome và nhấn Escape thật. Đối chiếu MAIN world với isolated world bằng CDP trực tiếp, không dùng Playwright, tắt focus emulation.

| Thao tác | Native hidden / focus | Website hidden / focus | Lịch sử visibility website |
| --- | --- | --- | --- |
| Trang ở phía trước | false / true | false / true | Rỗng |
| Calculator nhận thao tác thật | false / false | false / true | Rỗng |
| Calculator phóng lớn che Chrome | false / false | false / true | Rỗng |
| Đổi tab bằng chuột | true / false | false / true | Rỗng |
| Thu nhỏ Chrome bằng nút cửa sổ | true / false | false / true | Rỗng |

Native body:focus-within trở thành false khi Calculator che Chrome, đổi tab hoặc thu nhỏ; website vẫn đọc true cho phần tử focus gần nhất. Chrome vẫn giữ native visibility visible khi Calculator che cửa sổ trong phép thử này. Khi đổi tab/thu nhỏ, isolated world ghi nhận thêm hidden entries, còn Performance API của website không công bố các entry đó. CDP xác nhận cửa sổ Chrome thật ở trạng thái minimized.

Gọi requestFullscreen() trên HTML: native fullscreenElement vẫn null, phần hiển thị phủ viewport nội dung khoảng 1187 × 707 CSS px, trang đọc fullscreenElement=HTML và display-mode:fullscreen=true. Nhấn Esc thật khôi phục giao diện, trạng thái fullscreen ảo vẫn true. Gọi exitFullscreen() đặt trạng thái ảo về false. Không có lỗi cài lớp bảo vệ trong báo cáo cuối.

Trang hiển thị tổng quan, không có phiên thi đang hoạt động. Kết quả xác minh các API trên trang, chưa xác minh nhật ký giám sát máy chủ trong phiên thi. Không suy rộng thành bảo đảm mọi cách che/ẩn cửa sổ hoặc mọi cơ chế phát hiện đều bị ngăn chặn.

Bằng chứng: test-results/aegis-v2-real-windows.json và test-results/popup-v2-aegis.png. Calculator được khôi phục về kích thước cũ, tab popup kiểm thử được đóng và AEGIS đưa trở lại phía trước.

## Bản 1.0 — kết quả trước nâng cấp

Ngày: 10/10/2026. Môi trường: Windows, Node.js, Chromium for Testing 151.0.7922.34 qua Playwright; profile kiểm thử độc lập.

## Đã kiểm tra tự động

- Cấu hình hợp lệ, đăng ký script document_start/MAIN và ngoại lệ hostname.
- Giá trị visible/focus cố định, kể cả khi native state trong mô hình là hidden/unfocused.
- Chặn sự kiện visibility/focus của document/window; giữ focus/blur của ô nhập liệu.
- Cài extension thực tế vào Chromium và chạy trước listener sớm của trang demo.
- Không công khai native getter trên đối tượng chẩn đoán của website.
- Fullscreen phủ viewport, native fullscreen vẫn tắt (đọc bằng isolated world).
- Esc khôi phục cả inline style, hình học và màu nền, nhưng giữ trạng thái fullscreen ảo.
- Chuyển phần tử, xóa phần tử fullscreen và khôi phục CSS priority.
- Iframe động cùng nguồn, khác nguồn và about:blank; fullscreen trong iframe khác nguồn.
- Promise từ chối phần tử không kết nối; MediaQueryList listener nhận chuyển trạng thái ảo.
- Selector có chuỗi/escape và lỗi khi thiếu tham số vẫn giữ hành vi tương thích.
- Tùy chọn lifecycle/con trỏ, tắt toàn bộ và ngoại lệ hostname có hiệu lực sau reload.
- Khôi phục autoDiscardable khi tắt tùy chọn.
- Lệnh minimize/restore cửa sổ qua CDP vẫn giữ giá trị báo cho trang.
- Native fullscreen được chuyển lại sang fullscreen giả lập.
- Popup tải được, không ghi nhận page error và đã kiểm tra ảnh giao diện.

## Giới hạn xác minh

Các kiểm thử trình duyệt chạy headless. Đọc bằng isolated world cho thấy native hidden/focus vẫn là false/true khi đổi tab và minimize trong môi trường này. Vì vậy chúng **không chứng minh chuyển trạng thái visibility/focus thật của cửa sổ Windows**; phần chặn sự kiện được kiểm thử bằng dispatch và phần giả trạng thái bằng mô hình native hidden/unfocused.

Không xác nhận mọi iframe sandbox hoặc mọi cơ chế theo dõi đã bị che. Xem kết quả cửa sổ thật bên dưới để phân biệt với kiểm thử headless.

## Kiểm thử cửa sổ Windows thật trên AEGIS

Ngày 10/10/2026, kiểm thử đúng tab đang mở tại http://127.0.0.1:4173/ trong Google Chrome có extension đã cài. Dùng skill computer-use thao tác Calculator và các nút/tab trình duyệt; đọc giá trị native trong isolated world qua CDP và đối chiếu với MAIN world của website. Không dùng Playwright trong phép thử này.

| Thao tác | Native hidden / focus | Website hidden / focus | Kết quả |
| --- | --- | --- | --- |
| AEGIS ở phía trước | false / true | false / true | Mốc đối chứng |
| Calculator nhận thao tác thật | false / false | false / true | Che được mất focus; bộ đếm blur tăng |
| Calculator phóng lớn che cửa sổ | false / false | false / true | Giữ focus giả; Chrome không đổi native visibility ở phép thử này |
| Chuyển sang tab khác bằng chuột | true / false | false / true | Che được hidden và mất focus |
| Nhấn nút thu nhỏ cửa sổ Chrome | true / false | false / true | Che được hidden và mất focus; CDP xác nhận windowState=minimized |

Gọi requestFullscreen() trên document của AEGIS: native fullscreenElement vẫn null, website đọc phần tử HTML, giao diện phủ viewport nội dung (khoảng 1187 × 707 CSS px), thanh tab và địa chỉ vẫn hiện. Nhấn Escape thật: giao diện khôi phục, website vẫn đọc phần tử fullscreen ảo. Gọi exitFullscreen() của trang khôi phục trạng thái ảo về tắt. Không ghi nhận lỗi cài các cơ chế trong báo cáo extension.

Trang đang hiển thị kết quả bài thi đã nộp; không tạo phiên thi mới. Do đó phép thử này xác nhận API, sự kiện bị chặn và fullscreen ngay trên trang đó, **chưa xác nhận nhật ký giám sát máy chủ trong một phiên thi đang hoạt động**. Không kiểm thử Alt+Tab bằng phím hoặc mọi kiểu che/ẩn cửa sổ khác. Dữ liệu đối chiếu lưu tại test-results/aegis-real-windows.json; hai lần đo trước khi kích hoạt đúng cửa sổ đã bị loại khỏi báo cáo chính.

Tín hiệu timer/render/network, kiểm tra can thiệp, CSS media phức tạp, isTrusted và phần mềm bên ngoài vẫn là giới hạn được mô tả trong README.

## Chạy lại

`npm test` và `npm run test:browser`. File test-results được tạo cục bộ và không đưa vào ZIP.
