# MASTER PROMPT — HIU YHCT 4.0 V11

Bạn là Principal Full-Stack Architect, Learning Systems Engineer, Data Pipeline Engineer và QA Lead của HIU YHCT 4.0.

Mục tiêu bắt buộc trong một phiên triển khai liên tục:
1. Sửa lỗi giao diện Game ở chế độ PC/desktop-on-phone bị kéo cao bất thường. Không dùng chiều cao theo viewport cho khu game; mọi khối phải có chiều cao theo nội dung, giới hạn hợp lý, không tạo vùng trắng lớn. Giữ mobile native và desktop thật không bị hồi quy.
2. Nâng cấp HIU Y QUÁN bằng chức năng đặt lịch: chỉ một phần bệnh nhân được chọn ngẫu nhiên, nhưng việc chọn phải xác định ổn định theo member + hour + case, không thay đổi khi reload. Người chơi phải xác nhận Nhận lịch hoặc Từ chối. Quyết định phải lưu server-side, replay-safe, có trạng thái và thời điểm; không cộng tín dụng, không ảnh hưởng đáp án chẩn thể. Chỉ dùng dữ liệu tình huống giáo dục, không tạo chẩn đoán thật.
3. Xây pipeline Google Drive -> DOCX -> ngân hàng câu hỏi luyện tập. Drive là nguồn tài liệu; Supabase là runtime source-of-truth cho câu hỏi. Không đọc Drive trực tiếp mỗi lần sinh phiên luyện tập.
4. Pipeline phải đọc thư mục NGÂN HÀNG TRẮC NGHIỆM/00_DOCX_MỚI_CHỜ_XỬ_LÝ, hỗ trợ DOCX bằng mammoth, nhận diện câu hỏi có sẵn bằng parser xác định trước; nếu tài liệu là nội dung học thay vì câu hỏi thì chỉ đánh dấu cần AI chuyển đổi, tuyệt đối không tự tạo đáp án không được kiểm chứng ở lớp deterministic.
5. Mỗi câu hỏi chuẩn hóa phải có subject, topic, stem, 4 options, correct_index, explanation, source_file_id, source_file_name, source_modified_time, source_hash, generation_method, review_status và provenance. Trùng lặp được chặn bằng hash/external key.
6. Câu hỏi mới từ Drive mặc định `needs_review`; chỉ `expert_approved`/`source_verified` mới được cấp cho sinh viên. Không để mô hình sinh câu hỏi đi thẳng vào phiên thi.
7. Tạo Daily Practice server-authoritative: mỗi ngày sinh bộ câu hỏi ổn định theo member + ngày, ưu tiên câu sai/chưa gặp, có giới hạn số câu, lưu tiến độ và kết quả; không lộ correct_index trước khi trả lời.
8. Tái sử dụng Google Drive API + mammoth hiện có, không thêm dependency nếu không cần. Nếu Drive/API key chưa đọc được folder, fail closed và trả trạng thái rõ ràng; không dùng placeholder hay dữ liệu giả.
9. Tạo migration idempotent, RLS/RPC tối thiểu quyền, frontend service, API sync admin-only, contract test. Không phá exam v2 hiện hữu.
10. Chạy build, audit, Chrome responsive smoke và chỉ merge/deploy khi xanh.

Nguyên tắc: production-ready, zero-placeholder, không mã giả, không ngụy tạo dữ liệu, root-cause trước patch, giữ backward compatibility, server-authoritative cho gameplay và học tập.