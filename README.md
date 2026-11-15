# Presence Shield 2.2

Extension cho Chrome/Edge 119 trở lên. Che các kênh hoạt động đã hỗ trợ và giả lập fullscreen chỉ trong vùng nội dung của trình duyệt. Không thể bảo đảm ngăn mọi cơ chế phát hiện của mọi website.

## Cập nhật hoặc cài đặt

Nếu đã tải tiện ích từ thư mục này: mở chrome://extensions (Edge: edge://extensions), bấm tải lại Presence Shield, rồi tải lại các tab website. Không chỉ tải lại website khi tiện ích vẫn chạy bản cũ.

Cài mới: bật Developer mode, chọn Load unpacked, chọn D:\Downloads\extension chứa manifest.json. ZIP cũng có thể được giải nén rồi tải bằng cách này. Bản giao có sẵn build, không cần cài Node.

Cấu hình cũ được giữ. Các mục đã có tiếp tục dùng mặc định cũ; bốn mục mới của 2.2 tắt mặc định. Camera/capture và quy tắc mạng tắt mặc định. Nút **Bật toàn bộ lớp mở rộng** bật các lớp trong trang, gồm chặn yêu cầu camera/capture mới; một số website có thể cần tắt riêng lớp không tương thích.

Bản 2.2 thêm bốn công tắc: theo dõi tương tác toàn trang, tách BroadcastChannel, cố định hình học và lọc DOM riêng. Bốn mục này tắt mặc định vì có thể ảnh hưởng editor, đồng bộ giữa tab hoặc bố cục. Khi nghiên cứu trên trang kiểm thử của bạn, dùng Bật toàn bộ lớp mở rộng rồi tải lại trang. Xem đối chiếu 28 tín hiệu trong OBSERVATORY.md.

## Bản 2.2 trên AEGIS Observatory

Giữ tiện ích bật trong phép kiểm thử. Runtime dùng callable Proxy trên hàm gốc để giữ name, length, các thuộc tính và khả năng dùng new của API; Function.prototype.toString không bị thay. Cách này giảm việc lộ mã nguồn wrapper trong phép kiểm tra đơn giản, không làm API trở thành API gốc và không bảo đảm chống nhận diện từ realm sạch hoặc phép so sánh sâu hơn.

Marker CSS được tạo ngẫu nhiên cho mỗi document thay vì dùng thuộc tính Presence Shield cố định. Chúng vẫn tồn tại trong DOM và có thể bị kiểm tra trực tiếp. Fullscreen giữ các CSS custom property tương ứng với trạng thái ảo sau Esc, đồng thời khôi phục bố cục hiển thị; không mô phỏng mọi thuộc tính CSS của fullscreen thật.

Không sửa mã nguồn hoặc dữ liệu của website kiểm thử. Trên AEGIS Observatory, 9 dấu hiệu wrapper chuyển thành Chưa thấy dấu hiệu; đối chiếu API/CSS fullscreen khớp cả sau Esc; bộ đếm DOM không nhận thao tác fullscreen riêng. Đây là kết quả đối với các phép kiểm tra cụ thể, không phải chứng thực extension vô hình. Chi tiết tại TESTING.md và OBSERVATORY.md.

## Website từ chối API bị thay thế

Một website có thể yêu cầu API trình duyệt gốc và từ chối chạy khi chúng bị sửa. Đây là điều kiện tương thích riêng của website. Trạng thái **Đã áp dụng** chỉ xác nhận tiện ích đã cài lớp bảo vệ, không xác nhận website chấp nhận chúng hoặc cho phép vào thi.

Bản 2.1 có nút **Khôi phục API gốc và tải lại** ở gần đầu popup. Nút lưu ngoại lệ cho hostname đang mở, cập nhật chính sách script/mạng/giữ tab rồi tải lại document. Chỉ tắt công tắc mà chưa tải lại không hoàn tác các API đã sửa. Tải lại có thể mất dữ liệu chưa lưu.

Sau thao tác, popup xác minh trang chính không còn runtime tiện ích và báo **Trang chính dùng API gốc**. Fullscreen, focus, visibility và yêu cầu quyền thiết bị hoạt động bình thường; website có thể ghi nhận các trạng thái đó. Nếu có iframe khác hostname còn được bảo vệ, popup nêu rõ thay vì yêu cầu tải lại vô hạn. Ngoại lệ hostname áp dụng trên các cổng của hostname đó; ví dụ ngoại lệ 127.0.0.1 áp dụng cả các website localhost dùng địa chỉ này.

Không sửa mã kiểm tra của website. Các điều kiện về tên, đồng ý, fullscreen và giám sát khác vẫn do website quyết định. Phép thử tương thích ở bản 2.1 xác nhận cảnh báo biến mất sau khi thực sự dùng API gốc; đó là kết quả lịch sử, không phải chứng nhận các API ảo của bản mới là native.

## Trạng thái trong popup và biểu tượng

Popup kiểm tra phiên bản/cấu hình của document đang mở, trang chính, các khung đọc được và lỗi khi cài API.

| Trạng thái | Ý nghĩa |
| --- | --- |
| Đã áp dụng trên trang — OK | Các lớp đang bật đã cài vào trang chính và các khung đọc được |
| Đã áp dụng một phần — ! | Có khung thiếu bảo vệ, API/CSS bị chặn, hoặc chính sách giữ tab chưa được xác nhận |
| Cần tải lại để cập nhật — ↻ | Trang vẫn dùng phiên bản hoặc cấu hình cũ |
| Chưa áp dụng — ? | Cần tải lại trang để chạy script từ đầu |
| Bảo vệ đang tắt — OFF | Cấu hình toàn bộ đã tắt, không còn lớp trong khung đọc được |
| Trang chính dùng API gốc — OFF | Ngoại lệ tên miền đã áp dụng; khung khác nguồn được báo riêng nếu còn bảo vệ |
| Chưa xác minh được — ? | Không đọc được trang hoặc document đổi trong lúc kiểm tra |
| Trang không được hỗ trợ | Trang nội bộ, extension hoặc trang mà trình duyệt hạn chế can thiệp |

Khi tắt cấu hình mà document vẫn chứa lớp cũ, popup báo **Cần tải lại để tắt bảo vệ** hoặc **Cần tải lại để dùng API gốc**. Gỡ đăng ký script không tự hoàn tác các API đã sửa trong trang đang mở.

**Đã áp dụng là trạng thái cài đặt được quan sát, không phải chứng nhận chống phát hiện hoặc chống giả mạo từ website.** Khung không đọc được, realm chưa được bảo vệ và tín hiệu gián tiếp vẫn có thể tồn tại.

## Các lớp bảo vệ

| Lớp | Hành vi |
| --- | --- |
| Hiển thị/focus | hidden=false, visibilityState=visible, hasFocus()=true; chặn thông báo của document/window, giữ sự kiện focus ô nhập liệu |
| Lịch sử visibility | Lọc visibility-state khỏi Performance và PerformanceObserver, buffered, takeRecords, các danh sách callback; giữ mark/resource/paint và đồng hồ thật |
| CSS focus | Giữ phần tử focus gần nhất qua các selector và stylesheet đọc được; cập nhật khi người dùng đổi ô nhập liệu |
| Wake Lock ảo | Sentinel ảo giữ released=false cho đến khi trang gọi release(); không giữ màn hình sáng thật |
| Idle Detection ảo | Trang đọc active/unlocked; hỗ trợ threshold, abort, onchange; quyền granted là trạng thái ảo của lớp JS, không cấp quyền hệ điều hành |
| Pointer Lock ảo | Giữ pointerLockElement khi mất focus/Esc; trang gọi exit hoặc xóa phần tử thì đặt lại; không khóa chuột hoặc tạo chuyển động giả |
| Thông tin màn hình | Che isExtended và từ chối getScreenDetails; không sửa toàn bộ kích thước màn hình/window |
| Lifecycle | Tùy chọn che freeze/resume và wasDiscarded; không ngăn đóng băng thật |
| Con trỏ rời trang | Tùy chọn chặn mouse/pointer leave/out khi relatedTarget=null |
| Camera/capture | Tùy chọn từ chối yêu cầu getUserMedia/getDisplayMedia mới; không giả luồng video và không xóa pixel đã được chia sẻ |
| Giữ tab | autoDiscardable=false cho tab phù hợp; lưu và khôi phục giá trị trước khi tắt |
| Quy tắc mạng | DNR chặn các URL/prefix người dùng cấu hình; không sửa JSON hoặc tạo heartbeat giả |
| Quan sát tương tác toàn trang | Tùy chọn làm yên bộ nghe document/window cho phím, pointer/mouse, touch, clipboard, selection, context menu, in; giữ listener trên phần tử, click và input. Từ chối clipboard.read/readText; Selection.toString rỗng, Range và giá trị form vẫn thật |
| Tách BroadcastChannel | Tùy chọn thêm namespace mỗi document; giữ liên lạc trong document và tên công khai, không đồng bộ qua document/iframe khác |
| Hình học ổn định | Tùy chọn giữ giá trị window/screen/VisualViewport/orientation lúc tải trang, chặn các thông báo resize/scroll liên quan. Không đổi CSS layout, getBoundingClientRect, clientWidth, ResizeObserver hoặc media query về kích thước |
| DOM riêng | Tùy chọn lọc marker, stylesheet riêng và các thao tác DOM fullscreen đồng bộ được runtime đánh dấu; giữ bản ghi website trước/sau, takeRecords, oldValue và receiver callback. Không che khi kiểm tra DOM trực tiếp |

Có thể tắt từng lớp và loại trừ hostname trong popup. Ngoại lệ script áp dụng đúng hostname; iframe khác nguồn được kiểm tra theo hostname riêng.

API không có trong trình duyệt được ghi **Không có API này** thay vì giả rằng đã chặn một kênh đang tồn tại.

### Fullscreen giả lập

requestFullscreen() phóng phần tử phủ viewport nội dung; thanh tab và địa chỉ vẫn hiện. Document/ShadowRoot fullscreenElement, các alias sẵn có, selector fullscreen và matchMedia được xử lý.

Esc, nút Thu fullscreen hoặc Alt+Shift+F khôi phục giao diện, giữ trạng thái fullscreen ảo. Website gọi exitFullscreen(), nút Đặt lại hoặc xóa phần tử sẽ kết thúc trạng thái ảo.

Sau khi thu giao diện, mirror chỉ giữ CSS custom property để hỗ trợ đối chiếu ngữ nghĩa; các declaration thông thường được bỏ để không tái áp dụng bố cục fullscreen. Các phép so sánh màu sắc/hình học hoặc cascade phức tạp vẫn có thể phát hiện khác biệt.

Có cầu nối phóng iframe khác nguồn trực tiếp; kiểm tra source của message. Getter trong Shadow DOM lồng nhau được retarget theo từng root. Hỗ trợ media query kết hợp and/not/danh sách, listener khi đổi viewport, stylesheet đọc được, CSSOM insertRule/replace và style trong shadow root được theo dõi.

Sự kiện giả có isTrusted=false. Không mô phỏng hoàn toàn top layer, backdrop, mọi user activation/quyền, native video controls hoặc mọi thứ tự ưu tiên CSS. F11 vẫn là fullscreen trình duyệt thật. CSS media và hình học có thể bị website đối chiếu, đặc biệt sau khi thu giao diện mà giữ trạng thái ảo.

### Quy tắc mạng

Nhập tối đa 50 URL HTTP/HTTPS, một URL mỗi dòng. URL không có dấu * được khớp chính xác; * ở cuối chặn cả tiền tố. Không nhận wildcard trong hostname, thông tin đăng nhập hay fragment.

Ví dụ: https://tracker.example/events*

Không có danh sách domain tự chặn mặc định. Chặn API thiết yếu có thể làm website ngừng hoạt động hoặc máy chủ ghi nhận gián đoạn. Bật/tắt quy tắc mạng có hiệu lực khi lưu; các API trong trang vẫn cần reload khi đổi cấu hình.

Ngoại lệ mạng dùng excludedInitiatorDomains của DNR, có thể bao gồm tên miền con; ngoại lệ script vẫn đúng hostname. Request có initiator khác nguồn tuân theo initiator của chính request đó.

## Giới hạn còn tồn tại

- Timer, requestAnimationFrame, render, freeze/discard thật và heartbeat máy chủ có thể lộ gián đoạn. Không đổi Date/performance.now và không gửi hoạt động giả.
- IntersectionObserver giữ ngữ nghĩa native về viewport/nội dung trang. Không ép mọi phần tử thành nhìn thấy vì dễ phá lazy loading, scroll và video. API này không liệt kê ứng dụng Windows.
- Không che pixel capture đã cấp quyền, camera/ứng dụng giám sát bên ngoài hoặc thiết bị được quản lý.
- API sửa trong MAIN world, descriptor, CSS, native function từ realm sạch và isTrusted vẫn có thể bị kiểm tra.
- Runtime nằm trong closure; không còn global controller PresenceShield.runtime.v1. Kênh chẩn đoán theo sự kiện và marker DOM vẫn có thể bị website biết hoặc giả mạo. Kênh này không cấp quyền extension cho trang.
- Iframe đồng bộ/sandbox, quyền origin và thời điểm tạo realm có thể để lộ API trước khi script chạy. allFrames không bảo đảm che mọi realm.
- CSS khác nguồn không đọc được, stylesheet CSP chặn, cascade phức tạp hoặc shadow root không theo dõi được có thể chỉ được bảo vệ một phần. CSP chặn mirror được báo thành lỗi trong trạng thái.
- Các trạng thái ảo có thể làm website không tương thích với lock/quyền thật. Tắt lớp liên quan hoặc loại trừ website khi cần.
- Bộ nghe trên phần tử, input/change/click, giá trị form, Range, polling DOM, storage events, WebSocket/server, Service Worker/Worker và SharedWorker vẫn có thể trao đổi thông tin. Tách BroadcastChannel chỉ xử lý chính API đó.
- Giữ dữ liệu hình học ban đầu không xóa fingerprint ban đầu. CSS, media query, DOM, ResizeObserver và các API đọc từ realm khác vẫn có thể đối chiếu với layout thật.
- Quan sát tương tác toàn trang có thể làm hỏng editor dùng sự kiện document/window hoặc nút Paste dùng Clipboard API. In trang và nhập liệu mặc định vẫn là hành vi trình duyệt; không giả phím, click hoặc isTrusted.
- pagehide/pageshow/beforeunload/unload không bị chặn để giữ việc lưu dữ liệu và điều hướng.

## Kiểm thử và phát triển

npm test: kiểm tra cấu hình, trạng thái popup và giữ hành vi input/receiver.
npm run test:browser: kiểm tra extension cài thực tế trong Chromium với profile riêng; chi tiết tại TESTING.md.

npm run demo mở máy chủ http://127.0.0.1:8765/demo/. Demo đọc lịch sử visibility, observer, focus/CSS, fullscreen, pointer lock, wasDiscarded và độ trễ timer/rAF. Có nút thử Wake Lock/Idle/Pointer Lock. Bản demo mở bằng URL extension chỉ hiển thị hướng dẫn vì không được inject.

Sau khi sửa src/, chạy npm run build. Build tạo một runtime riêng và các script cấu hình nhỏ, tránh số tổ hợp bundle tăng theo cấp số nhân. Config tạm được xóa khi runtime khởi tạo; không công khai native getter.

npm run pack tạo Presence-Shield.zip gồm source, build, popup, demo, tests và tài liệu. Không chứa profile hay test-results.

## Quyền

storage lưu cấu hình cục bộ; scripting/host permissions cài lớp bảo vệ ở document_start/MAIN và đọc trạng thái; tabs đọc tab và điều chỉnh autoDiscardable; declarativeNetRequestWithHostAccess áp dụng quy tắc mạng người dùng cấu hình.

Không tải mã từ xa, không telemetry và không gửi dữ liệu hoạt động ra ngoài. Tài liệu nền tảng và hướng nghiên cứu trong RESEARCH.md.
