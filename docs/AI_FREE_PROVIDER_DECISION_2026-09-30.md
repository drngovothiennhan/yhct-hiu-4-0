# Quyết định: provider miễn phí dự phòng (30/09/2026)

**Kết luận: chưa thêm provider thứ ba vào Study OS.** Lý do dựa trên hạn mức miễn phí thực tế và luật kiến trúc AI của dự án.

## Số liệu đã kiểm (tài liệu chính thức)

- **Cloudflare Workers AI**: miễn phí 10.000 Neurons/ngày; vượt mức thì các lệnh tiếp theo báo lỗi, và gói Workers Free không thể trả tiền thêm để dùng tiếp. Nguồn: https://developers.cloudflare.com/workers-ai/platform/pricing/
- **OpenRouter (model `:free`)**: 20 lượt/phút; 50 lượt/ngày nếu chưa mua tín dụng, 1.000 lượt/ngày nếu đã mua từ 10 USD. Nguồn: https://openrouter.ai/docs/api_reference/limits
- **Groq**: chưa xác minh được (không truy cập được trang chính thức trong phiên này). Không đưa vào so sánh.

## Vì sao chưa thêm

1. Với vài trăm thành viên dùng đồng thời, hạn mức miễn phí ở trên chỉ đỡ được một phần rất nhỏ khi Gemini hết quota. Nó không giải quyết được vấn đề dung lượng.
2. Gửi câu hỏi học viên sang thêm một bên thứ ba làm tăng bề mặt quyền riêng tư và phải cập nhật chính sách.
3. `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md` yêu cầu mọi provider mới phải có nhu cầu cụ thể và không tạo thêm gateway/provider "vô mục đích".

## Cách giảm rủi ro hết quota hiện tại

- Bật thanh toán cho Gemini (model `flash-lite` đang là mặc định) và để **tín dụng thu 9.900đ** trả cho phần đó.
- Đo chi phí thật bằng log `ai_usage` (không chứa nội dung câu hỏi) và `scripts/ai-usage-summary.mjs` trước khi chốt bảng giá.
- Khi có số liệu, nếu vẫn cần dự phòng: ưu tiên một provider **trả tiền theo lượt** cho chat thường (không cho nội dung nội bộ), có hợp đồng test, thay vì gói miễn phí.

Điều kiện xem lại: tỷ lệ phản hồi hạ cấp do `rate_limit`/`quota` trong `X-AI-Failure-Class` vượt khoảng 2% số lượt trong một tuần.
