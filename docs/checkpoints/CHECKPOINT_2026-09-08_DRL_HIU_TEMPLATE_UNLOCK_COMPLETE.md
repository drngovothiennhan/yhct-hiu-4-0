# YHCT HIU 4.0 — Checkpoint hoàn tất DRL HIU template / unlock

- Thời điểm chốt: 2026-09-08 06:38 (Asia/Ho_Chi_Minh)
- Repository: `drngovothiennhan/yhct-hiu-4-0`
- Branch nguồn: `main`
- SHA production đã nghiệm thu: `60afbd3b9c4cc3ae7e771bc670b5e47dc34fb73d`
- Vercel project: `yhct-hiu-final4-stage`
- Production deployment: `dpl_FLehBFJUBrg7XGCpz4sUcyZGjQqL`
- Production URL: `https://yhct-hiu-final4-stage.vercel.app`
- Production state: `READY`
- Supabase project: `gzmpnsrwqjpsbklyflqr`

## Contract DRL đã khóa

1. Chỉ nhận workbook đúng mẫu HIU: metadata `Tên hoạt động`, `Học kỳ`, `Năm học`, `Thời gian tổ chức`, `Địa điểm`; bảng bắt buộc có `STT`, `MSSV`, `Họ và tên`, `Khoa`, `Vai trò tham gia`, `Điểm đề xuất ĐRL`.
2. Dòng sai/thiếu bị loại độc lập; dòng hợp lệ còn lại vẫn được ghi nhận.
3. Chống trùng theo `MSSV + hoạt động + học kỳ`.
4. Backend chỉ ghi cho `club_members.status='approved'`; MSSV không có thành viên approved bị loại, không tự tạo hồ sơ điểm.
5. MSSV là khóa đối chiếu chính. Biến thể tên Việt Nam chỉ được chấp nhận khi bộ token của tên ngắn nằm trong tên dài và tên gọi cuối cùng trùng; mọi trường hợp alias đều được audit.
6. Học kỳ `is_locked=true` chặn import; Admin có nút `Mở khóa học kỳ`. RPC mở khóa xóa cả `locked_at` và lịch `lock_at` rồi UI đọc lại server để xác nhận.
7. Học kỳ đã công bố chặn import/chỉnh điểm; phải gỡ công bố trước. Quyền công bố/khóa vẫn Admin-only.
8. UI kiểm tra trạng thái học kỳ ngay trước khi gọi import để không còn tình trạng gửi toàn bộ file rồi nhận `0 accepted` do học kỳ bị khóa/công bố.
9. Sau import, UI báo số nhận / loại / trùng và phân nhóm nguyên nhân server trả về.

## File MINIGAME ONLINE: HIỂU ĐÚNG VỀ VIÊM GAN

- Batch: `a666fe86-7f87-45d1-8929-dfbadb46a001`
- Sau reconciliation: `680` dòng logic được gửi backend; `81` hồ sơ thành viên approved được ghi nhận; `599` bị loại do MSSV không tồn tại trong tập thành viên approved; `0` duplicate backend.
- Ba biến thể tên hợp lệ đã được đối chiếu lại theo MSSV và ghi nhận: `2513120049`, `2213120005`, `2313120028`.
- Học kỳ `HK3-2025-2026` hiện có `81` activity rows; trạng thái công bố ban đầu được bảo toàn sau reconciliation.

## Nghiệm thu

- Web CI cho UI hotfix `dce8a8845919748e3080aff61c59591f20352588`: PASS toàn bộ acceptance, npm audit, TypeScript/Vite build và artifact verification.
- Vercel Production cho HEAD `60afbd3b9c4cc3ae7e771bc670b5e47dc34fb73d`: SUCCESS.
- Deployment `dpl_FLehBFJUBrg7XGCpz4sUcyZGjQqL`: READY, production alias không lỗi.
- Production smoke test: HTTP 200.
- Runtime error/fatal trong 30 phút nghiệm thu: 0.
- Supabase migrations `harden_drl_unlock_contract`, `harden_drl_import_name_compatibility`, `reconcile_hiu_minigame_name_aliases`: applied production thành công.
