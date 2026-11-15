# Đối chiếu 28 tín hiệu AEGIS Observatory

Phạm vi: http://127.0.0.1:4173/, bảng Browser Observatory 2.0, ngày 10/10/2026. Đây là trang kiểm thử của người dùng. Extension 2.2 giữ enabled=true, không thêm ngoại lệ cho hostname; bật toàn bộ 15 lớp trong các phép thử trực tiếp. Không sửa mã website.

| Thẻ | Tín hiệu | Cách xử lý trong 2.2 / giới hạn |
| --- | --- | --- |
| 01–02 | Visibility và focus | Giữ visible/false/true, lọc sự kiện bối cảnh; native vẫn hidden hoặc mất focus. Performance visibility history cũng được lọc |
| 03–04 | Fullscreen và CSS proof | Fullscreen ảo phủ nội dung. Sau Esc giữ API, selector, media và CSS custom property; layout thật đã thu lại. Không che mọi phép kiểm tra hình học/CSS |
| 05 | Nguồn hàm / descriptor | Proxy giữ metadata, không sửa Function.toString. 9 dấu hiệu ở phép kiểm tra này giảm về 0; source Proxy/realm sạch/identity vẫn có thể bị đối chiếu |
| 06 | Marker / symbol đã biết | Không có global runtime v1 và marker fullscreen cố định. Marker ngẫu nhiên và kênh sự kiện vẫn có thể bị tìm/giả mạo |
| 07 | Con trỏ vào/ra | Công tắc Con trỏ chặn cả rời và trở lại biên trang; giữ chuyển động/hover nội bộ phù hợp |
| 08 | Thời gian không tương tác | Hạn chế listener toàn trang. Đồng hồ thật vẫn tăng; không tạo hoạt động giả hoặc ép thời gian về 0 |
| 09 | Độ trễ timer | Còn đọc được. Không bảo đảm scheduler/render chạy bình thường khi tab nền, đóng băng hoặc máy ngủ |
| 10 | Vòng đời | Tùy chọn chặn freeze/resume, che wasDiscarded. Giữ pageshow/pagehide để không phá điều hướng/lưu trạng thái |
| 11 | Đếm bản trang | BroadcastChannel tách theo document; hai bản AEGIS đọc một bản mỗi trang. Storage/server/worker có thể dùng kênh khác |
| 12–14 | Viewport/window/screen | Giữ số liệu API lúc tải; CSS/layout vẫn đổi thật. Dữ liệu ban đầu vẫn đọc được, không phải fingerprint chung cho mọi máy |
| 15 | Nhiều màn hình | isExtended=false; getScreenDetails bị từ chối |
| 16 | Orientation | Giữ giá trị ban đầu khi bật hình học ổn định; API/CSS khác có thể đối chiếu |
| 17 | Kết nối | Giữ onLine/connection thật. Không tạo kết nối, heartbeat hoặc phản hồi máy chủ giả |
| 18 | Clipboard | Hạn chế listener toàn trang và từ chối read/readText. Copy/paste mặc định, handler phần tử và nội dung đã nhập vào website vẫn có thể hoạt động |
| 19 | Keyboard/isTrusted | Listener toàn trang không đếm phím; input nhận phím thật. Handler phần tử và input/change vẫn đọc được. Không thay isTrusted |
| 20 | Selection/context menu | Hạn chế listener toàn trang; Selection.toString rỗng. Range, cấu trúc selection và giá trị form vẫn đọc được |
| 21 | Print | Hạn chế listener beforeprint/afterprint toàn trang; không ngăn in thật |
| 22 | DOM mutations | Lọc thao tác đồng bộ riêng, marker và stylesheet riêng, giữ bản ghi website trước/sau. Kiểm tra trực tiếp DOM/style/geometry vẫn thấy thay đổi |
| 23 | Secure context | Giữ isSecureContext/crossOriginIsolated thật. Không giả ngữ cảnh bảo mật hoặc chính sách quyền |
| 24 | Danh sách màn hình | Chặn yêu cầu mới, không cung cấp cấu hình màn hình giả |
| 25–26 | Capture/camera | Từ chối yêu cầu mới khi bật. Không che pixel của luồng đã tồn tại hoặc phần mềm ngoài trình duyệt |
| 27 | Idle | Detector ảo active/unlocked; không đọc trạng thái OS |
| 28 | Wake Lock | Sentinel ảo giữ trạng thái đến khi trang release; không giữ màn hình sáng thật |

Trong phép thử trực tiếp: native hidden=true/focus=false khi đổi tab, MAIN vẫn visible và có focus. Calculator thật làm native mất focus, trạng thái ảo giữ nguyên. Esc thật giữ API/CSS proof khớp trong khi visual=false. Bộ đếm DOM giữ 0 trong thao tác fullscreen riêng. Ba keydown isTrusted=true được phía đối chứng nhận, textarea nhận ps2, bộ đếm phím toàn trang vẫn 0.

Không suy rộng thành bảo đảm che mọi cơ chế nhận diện. Bốn lớp mới có thể ảnh hưởng đồng bộ, editor hoặc JavaScript bố cục; tắt riêng lớp liên quan khi cần.
