# Nghiên cứu các kênh nhận biết hoạt động và hướng bảo vệ

## Bổ sung 2.2 — AEGIS Observatory của người dùng

Mã kiểm thử tại /assets/integrity.js dùng Function.prototype.toString, descriptor và marker cố định; phép CSS proof dùng custom property trên sentinel. Runtime 2.2 dùng callable Proxy trên hàm gốc, giữ metadata và Function.toString native, marker ngẫu nhiên và mirror custom property khi thu giao diện. Đây là giảm dấu vết đối với phép đo cụ thể; identity, source Proxy khác tên gốc, realm sạch và hình học vẫn có thể phân biệt.

[ECMAScript Function.prototype.toString](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-function.prototype.tostring) quy định callable không có source text được biểu diễn với cú pháp NativeFunction. Kết quả dạng [native code] vì vậy không chứng minh hàm là API gốc hoặc không có Proxy.

Đối chiếu đủ 28 thẻ và giới hạn nằm trong OBSERVATORY.md. Phần bên dưới giữ nguyên nghiên cứu trước nâng cấp.

Ngày đối chiếu: 10/10/2026. Phạm vi: extension Chrome/Edge trong D:/Downloads/extension. Đây là bản nghiên cứu gốc trước nâng cấp. Bản 2.0 đã triển khai các lớp khả thi và giao diện trạng thái; xem README.md và TESTING.md để biết hành vi cuối cùng, khác biệt với đề xuất và giới hạn còn tồn tại.

## Kết luận dựa trên phép đo

Trên tab AEGIS http://127.0.0.1:4173/ đã có Presence Shield, MAIN world vẫn đọc được performance.getEntriesByType("visibility-state"). Kết quả gồm 7 bản ghi: 4 visible, 3 hidden. PerformanceObserver.supportedEntryTypes có visibility-state. Các API IdleDetector, navigator.wakeLock và document.pointerLockElement cũng có trên trình duyệt; sự tồn tại của API không chứng minh AEGIS đang dùng chúng.

Bản hiện tại sửa Page Visibility/focus và chặn sự kiện, nhưng không sửa Performance API. Vì vậy nhận định trước rằng che được các API đã kiểm thử vẫn đúng trong phạm vi đó; chưa có cơ sở nói mọi đường nhận biết rời trang đã được che.

## 1. Performance Timeline: VisibilityStateEntry — ưu tiên cao nhất

Chuẩn HTML định nghĩa bản ghi visible/hidden cùng thời điểm thay đổi. Một trang có thể đọc lịch sử này dù đã bỏ lỡ visibilitychange. [HTML Standard](https://html.spec.whatwg.org/multipage/interaction.html#the-visibilitystateentry-interface)

Đề xuất: lớp riêng cho loại visibility-state, tích hợp với tùy chọn presence. Phải xử lý đồng bộ Performance.getEntries/getEntriesByType/getEntriesByName, PerformanceObserver callback, buffered, takeRecords và các cách lấy danh sách trong PerformanceObserverEntryList. Phương án riêng tư là chỉ cho thấy một trạng thái visible ban đầu và không công bố các chuyển trạng thái native.

Giữ nguyên mark, measure, resource, navigation, paint và đồng hồ. Phân loại bằng entryType, không lọc chỉ bằng tên hidden/visible vì mark hợp lệ có thể dùng tên đó. Không thể xóa những bản ghi hoặc native API mà trang đã lưu trước khi extension chạy. Một realm không được bảo vệ vẫn có thể đọc đường native.

Kiểm thử cần có observer đăng ký sớm/muộn, buffered true, observer quan sát hỗn hợp resource/visibility-state, takeRecords, JSON và thao tác chuyển tab/minimize thật.

## 2. Screen Wake Lock — kênh gián tiếp chưa xử lý

Wake lock chỉ được cấp cho document visible; khi document hidden, trình duyệt thả lock và phát release. Yêu cầu mới khi hidden có thể bị từ chối. [W3C Screen Wake Lock](https://www.w3.org/TR/screen-wake-lock/)

Suy luận: release hoặc lỗi request có thể mâu thuẫn với hidden=false giả lập. Đây là tín hiệu không đặc hiệu vì pin, chính sách và người dùng cũng có thể làm lock bị thả.

Đề xuất nghiên cứu: lớp sentinel ảo tùy chọn, tách trạng thái website nhìn thấy khỏi việc giữ màn hình sáng thật. Cần xử lý request, released, release(), sự kiện, abort/điều hướng và nhiều lock. Không tự khôi phục lock thật bằng vòng lặp và không giả rằng hệ điều hành vẫn giữ màn hình sáng. Tương thích/brand check của wrapper phải được kiểm chứng trước khi bật mặc định.

## 3. Pointer Lock — không đồng nghĩa với con trỏ rời trang

Chuẩn quy định đổi tab/cửa sổ hoặc mất focus sẽ thoát pointer lock; đọc pointerLockElement và pointerlockchange có thể cho thấy việc đó. Pointer lock thật chỉ có thể vào khi cửa sổ có focus. [W3C Pointer Lock](https://www.w3.org/TR/pointerlock/)

Bộ lọc pointerout/mouseout hiện tại không xử lý pointer lock.

Đề xuất: chính sách theo từng website. Chặn yêu cầu hoặc nghiên cứu trạng thái ảo là hai lựa chọn, nhưng việc từ chối API có thể làm website không cho tiếp tục. Giả trạng thái lock không giữ được con trỏ thật hoặc dữ liệu chuyển động. Không bật rộng vì dễ phá game, trình xem 3D và khả năng thoát bằng Esc.

## 4. Idle Detection — theo dõi trạng thái người dùng/màn hình

IdleDetector có userState active/idle và screenState locked/unlocked, cần quyền idle-detection và thao tác người dùng để xin quyền. Nó không trực tiếp chứng minh người dùng đang nhìn đúng tab. [Chrome Idle Detection](https://developer.chrome.com/docs/capabilities/web-apis/idle-detection)

Đề xuất riêng tư: từ chối quyền native của website trước; có thể bổ sung chính sách từ chối API theo hostname. Website thấy quyền bị từ chối, không phải được chứng minh luôn active. Trạng thái active/unlocked ảo chỉ là lớp JS có thể bị đối chiếu.

Tài liệu chrome.contentSettings đã kiểm tra không liệt kê idleDetection; không thiết kế dựa trên một thuộc tính extension API chưa được xác nhận. [Chrome contentSettings](https://developer.chrome.com/docs/extensions/reference/api/contentSettings)

## 5. CSS focus và các đường đọc focus khác

CSS :focus/:focus-within có ngữ nghĩa focus riêng. Trang có thể đọc selector hoặc hiệu ứng CSS, chứ không nhất thiết gọi hasFocus(). Document cũng có thể giữ phần tử tập trung nội bộ trong khi mất system focus; vì vậy activeElement đơn lẻ không phải bằng chứng chắc chắn của rời trang. [W3C Selectors](https://www.w3.org/TR/selectors/#focus-pseudo), [HTML focus](https://html.spec.whatwg.org/multipage/interaction.html#focus)

Đề xuất: xây probe trên ô nhập liệu/nút, iframe và Shadow DOM; đo matches, querySelector, computed style cùng activeElement trước/sau chuyển ứng dụng. Chỉ bổ sung lớp tương thích nếu tái hiện được kênh lộ. Sửa selector JS không đổi toàn bộ CSS engine. Không cố ép document.focus() hoặc tự chuyển focus, vì sẽ kéo người dùng về trình duyệt và có thể làm hỏng nhập liệu.

## 6. Fullscreen: các dấu hiệu đối chiếu

Fullscreen gốc có top layer, CSS :fullscreen/::backdrop và quy trình user activation. Bản giả lập có khác biệt về hình học, media query, quyền và sự kiện. DOM quy định sự kiện tạo bằng JS có isTrusted=false. [Fullscreen Standard](https://fullscreen.spec.whatwg.org/), [DOM Standard](https://dom.spec.whatwg.org/#dom-event-istrusted)

Đề xuất: tiếp tục kiểm tra tính nhất quán giữa fullscreenElement, selector, CSSOM, computed style, matchMedia và viewport. Bổ sung hỗ trợ stylesheet/CSSOM động và Shadow DOM theo ca tái hiện. Không giả kích thước màn hình/toàn bộ window một cách rộng vì ảnh hưởng bố cục và fingerprinting.

Không thể làm một sự kiện dispatchEvent thành sự kiện native trusted bằng cách sửa một getter JS thông thường. Chỉ che Function.toString cũng không khiến việc can thiệp trở nên không thể phát hiện.

## 7. IntersectionObserver — cần phân biệt với che cửa sổ Windows

IntersectionObserver theo dõi vị trí/khả năng nhìn thấy phần tử trong trang. trackVisibility còn xét opacity, transform, filter và việc bị nội dung trang khác che. Đặc tả này không phải API liệt kê ứng dụng Windows đè lên Chrome. [W3C IntersectionObserver, thuật toán visibility](https://w3c.github.io/IntersectionObserver/#calculate-visibility-algo)

Đề xuất: đo sự khác nhau giữa DOM overlay và ứng dụng khác che cửa sổ trước khi quyết định sửa. Không đặt intersectionRatio=1 hoặc isVisible=true cho mọi phần tử vì có thể phá lazy loading, infinite scroll, video và kiểm tra bố cục. Ưu tiên probe; chưa đủ bằng chứng để sửa toàn cục.

## 8. Timer, render, freeze và native occlusion — giới hạn lớn

Chrome có thể giảm tốc timer và ngừng requestAnimationFrame của trang nền. Chromium có cơ chế native window occlusion trên Windows, ảnh hưởng render/scheduling. Các ngưỡng cụ thể thay đổi theo phiên bản; bài Chrome 88 chỉ là mô tả một chính sách tại thời điểm đó. [Chrome timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88/), [Chromium Windows occlusion](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/windows_native_window_occlusion_tracking.md)

Suy luận: trang hoặc máy chủ có thể đối chiếu khoảng trống timer/heartbeat với thông tin focus giả. Khoảng trống cũng có thể do CPU bận hoặc mạng, không xác định được chính xác ứng dụng nào ở phía trước.

Freeze đình chỉ các task; discard không cho mã trang tiếp tục chạy. Chặn freeze/resume không ngăn đóng băng thật. wasDiscarded cũng có thể cho biết tab đã bị loại bỏ. [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

Đề xuất: giữ preventDiscard hiện có, bổ sung chẩn đoán khoảng trống scheduling và thử nhiều trạng thái native. Không sửa Date/performance.now hoặc tạo heartbeat giả: máy chủ có đồng hồ riêng, và thay đồng hồ có thể phá timeout/animation. Worker hay extension service worker không bảo đảm tạo nhịp foreground giống hệt trong mọi trạng thái. Muốn kiểm soát scheduler cần lớp trình duyệt riêng, vượt khỏi content script của extension hiện tại.

## 9. Chia sẻ màn hình, camera và nhiều màn hình

Nếu người dùng cấp chia sẻ màn hình, trang có thể nhận pixel và các trạng thái track như muted/ended; việc native document.hidden được sửa không che luồng hình ảnh. Kết quả khác nhau tùy nguồn capture là tab, cửa sổ hay màn hình. [W3C Screen Capture](https://www.w3.org/TR/screen-capture/)

Window Management có thể cung cấp chi tiết màn hình khi được cấp quyền; screen.isExtended là một dấu hiệu khác cần đo theo quyền/phiên bản. Nhiều màn hình không tự chứng minh chuyển tab. [Chrome Window Management](https://developer.chrome.com/docs/capabilities/web-apis/window-management)

Đề xuất: bảng quyền theo hostname, thông báo rõ khi có camera/capture; dùng quyền trình duyệt để giới hạn tiếp cận. Không xem việc đổi getter là cách che pixel đã chia sẻ. Website yêu cầu quyền có thể từ chối cho tiếp tục nếu quyền bị chặn.

## 10. Telemetry và phát hiện chính extension

Chrome DNR có thể chặn request bằng quy tắc. Đề xuất chỉ chặn endpoint tracking đã xác định theo website hoặc tracker bên thứ ba. Chặn request không làm máy chủ tin người dùng vẫn hoạt động; có thể xuất hiện lỗi hoặc gián đoạn phiên. DNR không phải bộ chỉnh sửa tùy ý nội dung JSON của mọi request. [Chrome declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)

Qua kiểm tra mã hiện tại, global Symbol.for("PresenceShield.runtime.v1") công khai trạng thái/counters; marker DOM và message fullscreen cũng mang tên extension. Trang chủ động có thể nhận diện chúng. API sửa trong MAIN world có thể bị đối chiếu bằng descriptor, native function từ realm khác hoặc CSS. Extension isolation là phân tách ngữ cảnh JS, không bảo đảm mọi sửa đổi DOM/API đều vô hình. [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Đề xuất: giảm dữ liệu chẩn đoán công khai, giữ quyết định/quyền trong extension, audit cầu nối từng frame. allFrames/document_start cần được kiểm thử với frame đồng bộ, sandbox, about:blank/blob và nhiều nguồn; không chỉ kiểm tra trang cha. Tránh xuất native getter. Xóa tên dễ nhận diện chỉ giảm dấu hiệu trực tiếp, không bảo đảm chống phát hiện.

## Thứ tự phát triển đề xuất

1. Vá VisibilityStateEntry trước, vì đã có bằng chứng lộ ngay trên tab đang mở.
2. Mở rộng trang probe và bộ kiểm thử sang PerformanceObserver, CSS focus, wake lock, pointer lock và các đường fullscreen đối chiếu.
3. Giảm chẩn đoán công khai và audit iframe/realm/cầu nối.
4. Wake Lock, Pointer Lock, Idle Detection: tùy chọn theo hostname, mặc định dựa trên kết quả tương thích thực tế.
5. Quyền capture/camera và quy tắc tracker là lớp riêng tư riêng; không gọi chúng là bằng chứng luôn có focus.
6. Đánh dấu timer/render/server/capture là giới hạn còn tồn tại sau các bản vá JS.

Tiêu chí nghiệm thu: thao tác Windows thật; so sánh native isolated world và MAIN world; mỗi kênh mới phải có ca thử riêng. Với AEGIS, cần một phiên thi mẫu đang hoạt động để đối chiếu nhật ký máy chủ; việc quan sát màn hình kết quả đã nộp chưa chứng minh phần đó.
