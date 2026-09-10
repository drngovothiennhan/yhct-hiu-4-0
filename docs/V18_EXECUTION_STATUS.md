# V18 — kiểm tra và cải tiến tiết kiệm

Baseline: 47d9268fc1f449cefcd5d3b83f37a8cbd03fd8e0. Phạm vi: mã nguồn và cấu hình của repository; không phải kiểm toán mọi dữ liệu/tài khoản production.

## Năm phát hiện và thay đổi
1. UnifiedAiMini dùng từ khóa module để trả hướng dẫn trước khi xét câu hỏi học thuật; đã ưu tiên học thuật, thêm điều hướng bằng lệnh tường minh, giữ câu hỏi nối tiếp đúng ngữ cảnh. Lịch sử được giới hạn để không cắt mất câu hỏi hiện tại ở gateway.
2. Client AI chờ 24 giây trong khi Gemini + OpenAI có thể cần 16 + 20 giây. Deadline 42 giây, truyền tín hiệu hủy, timeout Drive 8,5 giây. Cân bằng tối đa 6 nguồn; URL trả lời thành công chỉ lấy từ citation đã được gateway chấp nhận. Cache metadata y văn công khai 5 phút/40 truy vấn; bỏ truy vấn citation-count không cần cho hội thoại. Không chia sẻ cache Drive/dữ liệu riêng.
3. XiaoZhi chỉ nghe một lượt và không vô hiệu hóa kết quả cũ khi reset; đã thêm chu trình nghe–xử lý–đọc–nghe, nút Hủy/Dừng, dừng khi đóng/ẩn tab/đổi tài khoản, chặn gửi trùng và phản hồi cũ. Orb mặc định đứng yên, vẫn giữ tùy chọn di chuyển. Hủy client không bảo đảm nhà cung cấp ngừng tính phí cho yêu cầu đã nhận.
4. Y Quán polling mỗi phút có thể chạy khi thao tác; lựa chọn gắn với index khiến đáp án còn lại trên ca mới. Đã khóa polling lúc bận/ẩn tab, giữ ca theo case_key, reset đáp án khi đổi mã ca, bảo vệ kết quả tải cũ. Nhân vật đi lại khi rảnh nhưng không tự cướp cảnh người chơi đang xem. Thêm gia sư theo dữ liệu Tứ chẩn của ca.
5. CSS game có nhiều lớp và font phần đọc 9–11 px. Cải thiện ngay lớp cuối đang dùng: phần Tứ chẩn/đáp án 14 px, điều khiển cảnh 44 px, màu dịu, focus bàn phím; không thêm một stylesheet ghi đè mới, không tải ảnh/model trả phí.

## Kiểm chứng và giới hạn
- Biên dịch TypeScript, production build và bộ prebuild hiện hữu; thêm audit:v18 kiểm thử cancellation, timeout, cleanup và lệnh tiếng Việt.
- Các kiểm tra acceptance, platform, research provider, garden water/fertilizer được chạy riêng.
- Trình duyệt cục bộ chưa tải được do kết nối/certificate. Workflow Web CI hiện hữu có Chrome responsive smoke và viewport matrix; workflow deploy chỉ chạy sau Web CI thành công.
- Không tạo dữ liệu người học hoặc thống kê tương tác giả. Không tuyên bố tỷ lệ tiết kiệm tiền/tín dụng khi chưa có usage logs.
- Không bật thêm dịch vụ trả phí, không thay khóa hoặc quyền. Chức năng cloud phụ thuộc cấu hình/quota thật. Không khẳng định mọi provider đang hoạt động chỉ vì có tên trong registry.
- Chưa kiểm chứng nhận giọng tiếng Việt bằng micro thật hoặc độ chính xác câu trả lời y khoa; các kiểm tra có mô phỏng không thay thế kiểm tra thiết bị/tài khoản thực.

Kế hoạch phát triển 5 bước và prompt tái sử dụng: HIU_V18_EFFICIENT_EXECUTION_PROMPT.md.
