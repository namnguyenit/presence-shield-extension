import { FEATURE_KEYS, featureSignature } from "./settings.js";
import { VERSION } from "./protocol.js";

export function applicationStatus(settings, frames = [], url = "", readError = "") {
  let host, allowed = false;
  try { const target = new URL(url); allowed = ["http:", "https:"].includes(target.protocol); host = target.hostname; } catch {}
  const top = frames.find(frame => frame.frameId === 0)?.result;
  const installed = frames.filter(frame => frame.result?.installed);
  const expected = FEATURE_KEYS.filter(key => settings[key]);
  const base = { frames: frames.length, installedFrames: installed.length, expected, limits: ["Timer/render có thể bị chậm hoặc ngừng.", "Website vẫn có thể kiểm tra can thiệp hoặc dùng API từ khung chưa được bảo vệ.", "Không che hình ảnh đã được cấp quyền chia sẻ hoặc phần mềm giám sát ngoài trình duyệt."] };
  const result = (state, title, description) => ({ ...base, state, title, description });
  if (!allowed) return result("restricted", "Trang không được hỗ trợ", "Chỉ áp dụng cho website HTTP/HTTPS mà trình duyệt cho phép can thiệp.");
  const excluded = settings.excludedHosts.includes(host);
  if (excluded) {
    if (readError || !top) return result("unknown", "Chưa xác minh API gốc", "Ngoại lệ đã lưu, nhưng chưa đọc được trạng thái trang chính. Kiểm tra lại hoặc tải lại trang.");
    if (top.installed) return result("reload", "Cần tải lại để dùng API gốc", "Ngoại lệ đã lưu, nhưng trang chính vẫn chứa lớp bảo vệ cũ.");
    return result("disabled", "Trang chính dùng API gốc", installed.length ? "Tiện ích đã tắt cho tên miền trang chính. Khung khác nguồn vẫn có lớp bảo vệ theo cấu hình riêng; có thể cần thêm ngoại lệ cho các tên miền đó." : "Không có lớp bảo vệ của tiện ích trong các khung đọc được. Fullscreen và quyền thiết bị dùng hành vi bình thường của trình duyệt.");
  }
  if (!settings.enabled || !expected.length) {
    if (installed.length) return result("reload", "Cần tải lại để tắt bảo vệ", "Cấu hình mới đã lưu, nhưng trang hiện tại vẫn chứa lớp bảo vệ cũ.");
    return result("disabled", "Bảo vệ đang tắt", "Trang hiện tại không có các lớp bảo vệ đã chọn.");
  }
  if (readError) return result("unknown", "Chưa xác minh được", "Không đọc được trạng thái trang. " + readError);
  if (!top?.installed) return result("missing", "Chưa áp dụng trên trang", "Tải lại trang để cài các lớp bảo vệ từ lúc trang bắt đầu chạy.");
  if (installed.some(frame => frame.result.version !== VERSION || frame.result.signature !== featureSignature(settings))) {
    return result("reload", "Cần tải lại để cập nhật", "Trang đang dùng phiên bản hoặc cấu hình cũ. Các thay đổi chưa được áp dụng đầy đủ.");
  }
  const failures = installed.flatMap(frame => frame.result.failures || []);
  const missing = installed.some(frame => expected.some(key => !frame.result.features?.[key]));
  if (installed.length !== frames.length || failures.length || missing) return result("partial", "Đã áp dụng một phần", "Có khung chưa được bảo vệ hoặc thao tác cài API không thành công. Xem chi tiết để xác định phần còn thiếu.");
  return result("applied", "Đã áp dụng trên trang", "Các lớp đang bật đã được cài vào trang chính và các khung đọc được. Đây không phải bảo đảm che mọi cơ chế theo dõi.");
}
