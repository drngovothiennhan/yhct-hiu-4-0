# AI Credits v1 — sổ tín dụng và hạn mức AI

Trạng thái: **đã dựng, mặc định TẮT**. Không có hành vi nào của app thay đổi cho tới khi chủ sản phẩm bật cả hai công tắc bên dưới.

## Nguyên tắc

- Tín dụng là **điểm sử dụng dịch vụ**. Không rút thành tiền, không chuyển nhượng cho người khác.
- Quà tặng có **hạn dùng** (lô tín dụng). Lô hết hạn sớm nhất được trừ trước.
- Mọi thay đổi số dư đều ghi vào sổ cái chỉ-thêm (`private.ai_credit_ledger_v1`). Server quyết định, app không tự cộng được.
- Nằm trong **gateway AI hiện có** (`api/ai/assistant.js`), không tạo gateway thứ hai và không thêm hàm serverless (giới hạn 12 hàm của Vercel).
- Không tính tiền cho câu trả lời bị hạ cấp (`X-AI-Degraded: 1`) hoặc lỗi server: hệ thống hoàn lại tự động.

## Hai công tắc (cần bật CẢ HAI)

1. Cơ sở dữ liệu: `update private.ai_credit_settings_v1 set enforce = true where id;`
2. Máy chủ (Vercel env): `ENABLE_AI_CREDITS=true`

Tùy chọn: `AI_CREDITS_FAIL_CLOSED=true` để chặn AI khi dịch vụ tín dụng lỗi. Mặc định là cho qua (fail-open) và ghi log, để học viên không bị gián đoạn.

## Bảng giá tham chiếu (chưa phải quyết định)

Bảng `private.ai_credit_policy_v1` có sẵn giá trị đề xuất. Capability không có trong bảng thì **miễn phí**.

| capability | cost | free_daily |
| --- | --- | --- |
| assistant_fast | 1 | 20 |
| assistant_research | 5 | 3 |
| study_quiz | 2 | 10 |
| study_chat | 1 | 20 |
| xiaozhi_mini | 1 | 20 |
| exam_gap | 2 | 5 |
| docx_summary | 3 | 3 |

Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh). Admin không bị tính.

## Quà tặng ngày ra mắt

Chiến dịch `launch-2026-10-01` đã được tạo sẵn với `enabled = false` (50 tín dụng, hiệu lực 180 ngày, cửa sổ 01/10 – 01/11/2026 giờ Việt Nam). Mỗi thành viên nhận **một lần** khi app gọi `POST /api/ai/assistant` với `{"mode":"credits","op":"claim","campaign":"launch-2026-10-01"}`.

Để bật: `update private.ai_credit_campaign_v1 set enabled = true, amount = <số> where campaign = 'launch-2026-10-01';`

Xem số dư: `GET /api/ai/assistant?action=credits`.

## Việc còn lại trước khi bật thật

- Giao diện: xử lý mã lỗi `402 insufficient_credits` (hiện chỉ hiển thị lỗi chung) và hiển thị số dư/nút nhận quà.
- Cộng XP là hệ thống riêng của linh thú, chưa nằm trong PR này.
- Mua tín dụng (VietQR/Google Play Billing) là bước sau: webhook thanh toán sẽ ghi lô `purchase` bằng khóa dịch vụ phía server.
- Áp dụng migration lên Supabase là bước của chủ sản phẩm.

## Kiểm tra

`npm run audit:ai-credits` kiểm tra hợp đồng tĩnh và chạy thử logic với Supabase giả. Logic SQL đã được chạy trên PostgreSQL 16 cục bộ (46 khẳng định: hạn mức miễn phí, trừ lô theo hạn, idempotent, hoàn tiền, quyền truy cập, tăng cường bảo mật bảng `private`).

## Đo chi phí thật trước khi chốt giá

Mỗi lượt Gemini ghi một dòng log `ai_usage` (chỉ số token, không chứa câu hỏi hay câu trả lời). Tổng hợp từ log Vercel:

`vercel logs <deployment> --since 1d | node scripts/ai-usage-summary.mjs --input-per-m <giá> --output-per-m <giá>`

Giá (USD/1 triệu token) lấy từ trang giá hiện hành của Google, script không đặt sẵn giá. Kết quả có "USD/1000 lượt" theo từng model và chế độ, dùng để chỉnh cột `cost` và `free_daily` ở bảng trên.

Quyết định về provider miễn phí dự phòng: xem `docs/AI_FREE_PROVIDER_DECISION_2026-09-30.md`.
