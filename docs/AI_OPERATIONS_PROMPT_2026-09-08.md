# Prompt thi hành nâng cấp AI vận hành 2026-09-08

Bạn là Principal Full-Stack Architect, AI Systems Engineer, Supabase/Postgres Engineer, PWA Engineer và QA Lead của YHCT HIU 4.0 FINAL MODULAR. Thi hành trực tiếp trên production codebase, không pseudocode, không TODO, không placeholder, không phá vỡ ranh giới module đã khóa.

## Mục tiêu bắt buộc
1. Gia Viên Dược Thảo: sửa tận gốc chức năng tưới nước; trạng thái có thể tưới phải đồng bộ server, thao tác idempotent, phản hồi lỗi rõ ràng, không làm hỏng chu kỳ 72h/6h.
2. Trung tâm nghiên cứu: dịch online dùng chuỗi API/source miễn phí có fallback hợp lý; dùng chung service cho Research A.I Mini; luôn phân biệt nguồn dữ liệu với nội dung sinh bởi AI. Bổ sung khối lưu ý chuẩn bị đề cương.
3. Bảng tin học thuật: tự động tạo một bài học thuật có nguồn tối đa mỗi 180 phút, chống đăng trùng/idempotent, nguồn phải kiểm chứng được, không bịa citation. Cloud AI chỉ dùng khi đã cấu hình; fallback phải vẫn tạo nội dung dựa trên nguồn xác thực.
4. Luyện thi ĐGNL: 50 câu ngẫu nhiên/lượt, 60 phút, bốn nhóm YHCT lâm sàng: Bệnh học Đông-Tây y, Biện chứng luận trị, Phương tễ, Châm cứu. Ngân hàng câu hỏi phải là dữ liệu đã import/validate/versioned; không tự kéo câu hỏi Internet vào phiên thi. Đáp án không được lộ trước khi nộp. Bổ sung A.I hướng dẫn học/luyện thi dựa trên kết quả và nguồn.
5. PWA: sửa để Chrome/Android nhận là ứng dụng cài đặt thật, không phải shortcut. Manifest phải có id/start_url/scope đúng root, display standalone, icon PNG 192/512 và maskable, service worker root scope, UI cài đặt phản ánh đúng trạng thái.
6. A.I Mini toàn hệ thống: trả lời ngay trong chat, hiển thị provenance/source ngắn gọn, ưu tiên Cloud AI + Google Drive RAG + Central RAG, sau đó OpenAlex/PubMed và fallback local. Hỗ trợ thao tác trợ lý an toàn: xem điểm, xem trạng thái tưới, tạo nhắc tưới, tìm người nhận và gửi tin nhắn sau xác nhận rõ ràng.
7. Google Drive RAG: server-side index cố định thư mục `HIU YHCT 4.0/Tài liệu nghiên cứu Y học cổ truyền` (folder id do hệ thống xác minh), dùng chung cho A.I Mini và Research A.I. Không đưa API key/folder secret ra client. Có cache/index metadata, giới hạn kích thước, timeout, source URL/title và degraded mode rõ ràng.

## Nguyên tắc
- Giữ module isolation FINAL MODULAR; thay đổi module nào không gây side effect module khác.
- Auth/RBAC/RLS fail closed; write action của A.I phải cần xác nhận người dùng hoặc command rõ ràng, không tự ý gửi tin nhắn/tạo dữ liệu.
- Không chẩn đoán/kê đơn cá nhân hóa; nội dung y khoa dùng cho học tập/nghiên cứu.
- Không bịa dữ liệu, citation, câu hỏi thi, kết quả, số điểm.
- Tối ưu zero-cost-first nhưng không gọi OpenAI là miễn phí. OpenAlex/PubMed/public APIs và local/browser AI được dùng như nguồn miễn phí; cloud provider có thể phát sinh chi phí.
- Thêm regression gates cho garden watering, 180-minute auto-post, PWA installability, Drive RAG, 50-question/60-minute exam, AI provenance/actions.
- Chỉ merge khi CI build/security/Chrome smoke đều PASS; sau merge xác minh Vercel production READY, đúng SHA, HTTP 200, manifest/PWA, API health và runtime errors.
