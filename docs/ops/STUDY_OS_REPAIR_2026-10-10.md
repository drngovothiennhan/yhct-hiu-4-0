# Study OS repair — 2026-10-10

## Đã triển khai (code + DB hàm)

- **Bài ôn hằng ngày** (`daily_study_review_candidates_v1`, `_generate_v1`, `_today_v1`): chỉ dùng câu đã được chuyên gia duyệt (`expert_approved`) hoặc câu `source_verified` được parse từ đáp án tô đỏ (`generation_method='parsed'`). Câu do AI soạn không bao giờ vào bài ôn hằng ngày. Mỗi bộ 3–5 câu, không trùng nội dung (`content_hash`). Tiến độ học được ghép theo `content_hash`, nên việc gộp bản sao trùng không làm mất câu của học viên.
- **Trang Study OS**: bỏ thẻ "TRỌNG TÂM" trùng với nút "Bắt đầu phiên học"; đưa "Ôn tập hôm nay" lên ngay dưới phần đầu trang; lưới "Tiếp tục học" còn 2 thẻ.
- **AI Study**: nguồn trích dẫn luôn có tiêu đề (nhánh OpenAI trả về `label`, client giờ chuẩn hóa về `title`).
- **Kiểm tra**: `npm run audit:study-os-repair` (đã gắn vào `prebuild`).

## Bước cần chạy thủ công: sửa dữ liệu ngân hàng câu hỏi

Bước này thay đổi trạng thái câu hỏi trong production, nên cần bạn xác nhận chạy.

1. Mở trình soạn SQL của dự án: https://supabase.com/dashboard/project/gzmpnsrwqjpsbklyflqr/sql/new
2. Mở file `supabase/migrations/20261010131000_study_os_data_repair_v1.sql` trong repo, **copy toàn bộ nội dung** và **dán** vào trình soạn SQL, rồi bấm **Run**. File có thể chạy lại an toàn (idempotent).
3. Kiểm tra kết quả, **copy và chạy** câu lệnh sau:

```sql
select action, count(*) from private.study_os_repair_targets_20261010 group by action order by action;
```

Kết quả mong đợi: `needs_review_awaiting_expert` 300, `reject_duplicate` 44, `reject_unsupported_ai` 94.

Ý nghĩa:
- `reject_duplicate` (44): bản sao trùng nội dung (`content_hash`) của "ĐỀ CƯƠNG ÔN TẬP" (không có đuôi .docx). Giữ lại bản .docx.
- `needs_review_awaiting_expert` (300): bản nháp AI của "Nháp AI 100 câu" Giải phẫu bệnh, Mô phôi, Sinh lý. Nguồn ghi "chờ chuyên gia duyệt" / "không hiển thị cho học viên". Chuyển về hàng đợi duyệt chuyên gia và ẩn khỏi học viên.
- `reject_unsupported_ai` (94): câu AI của ddcb.docx và HOA_HOC_50_CAU, nguồn không sinh được câu hợp lệ nào (0 câu đạt chuẩn).

Bản sao lưu đầy đủ trước khi đổi: `private.study_os_repair_backup_20261010`.

## Hoàn tác (nếu cần)

Copy và chạy trong trình soạn SQL:

```sql
update public.practice_questions q
set review_status=b.review_status, provenance=b.provenance, updated_at=b.updated_at
from private.study_os_repair_backup_20261010 b
where b.id=q.id;
```

## Quyết định còn lại (chưa thay đổi, cần chuyên gia)

- **309 câu AI còn lại** (`ai_generated`, `source_verified`) vẫn hiển thị trong ngân hàng luyện tập của học viên: 200 câu từ "Nháp AI 100 câu" Dược lý và Giải phẫu người (nguồn đang `synced`, ghi là "Nháp AI") và 109 câu từ slide Giải phẫu người. Trong tổng 703 câu AI ban đầu, 394 câu đã được xử lý ở bước trên. Nhóm 309 câu này chưa có bằng chứng chuyên gia duyệt. Cần quyết định: giữ, hay chuyển về duyệt chuyên gia.
- **Ngân hàng học viên không kiểm tra trạng thái tài liệu nguồn** (`practice_quiz_page_v1`, `daily_practice_today_v2`, `practice_quiz_config_v1`). Nguồn ở trạng thái `needs_review` (ví dụ skmt 4, Tâm lý đạo đức, DaoDucYHoc) vẫn hiện cho học viên nếu câu đang `source_verified`. Đây là thay đổi lớn về số câu hiển thị, nên chưa tự sửa.
- **Câu gần trùng**: còn 47 nhóm có nội dung câu hỏi giống nhau sau khi chuẩn hóa nhưng khác `content_hash` (khác đáp án hoặc nguồn). Cần rà soát thủ công.
- **Bảo mật**: các hàm bài ôn hằng ngày được cấp quyền cho role `anon` vì cron dùng publishable key. Việc bảo vệ dựa vào secret trong Vault. Nên chuyển cron sang service role để thu hẹp quyền.

## Kiểm tra sau khi triển khai

- Sáng hôm sau (sau lần cron chạy), kiểm tra số bộ ôn được tạo:

```sql
select quiz_date, status, count(*) from public.daily_study_review_sets_v1 group by 1,2 order by 1 desc limit 3;
```

- Tỷ lệ hoàn thành bài ôn: theo dõi `completed_at` trên `daily_study_review_sets_v1`. Đến 2026-10-10 chưa có bộ nào được nộp (0/120 bộ, 0/427 câu).
