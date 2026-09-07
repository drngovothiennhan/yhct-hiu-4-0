# YHCT HIU 4.0 — Checkpoint DRL HIU template + unlock production

- Thời điểm chốt: 2026-09-08 06:32 (Asia/Ho_Chi_Minh)
- Repository: `drngovothiennhan/yhct-hiu-4-0`
- Branch nguồn: `main`
- Production SHA: `e1408464e68168972ed79d6f5c22d6cbac5bc7ca`
- Worker/template hotfix SHA: `bfe9e0c2207b05d7d039a0955fe4705f7aa40161`
- Role-contract test SHA: `f5c180b2dd78b43d3ab777e1fecc50e27d71ebfe`
- Supabase migration: `harden_drl_unlock_contract`
- Vercel project: `yhct-hiu-final4-stage`
- Production deployment: `dpl_ELZnc8NwXoVbSqRvVehzMVf3q1q9`
- Production URL: `https://yhct-hiu-final4-stage.vercel.app`
- Production state: `READY`

## Contract đã khóa

1. DRL import chỉ chấp nhận workbook theo mẫu HIU có metadata bắt buộc: `Tên hoạt động`, `Học kỳ`, `Năm học`, `Thời gian tổ chức`, `Địa điểm`.
2. Header bắt buộc: `STT`, `MSSV`, `Họ và tên`, `Khoa`, `Vai trò tham gia`, `Điểm đề xuất ĐRL`.
3. Dòng sai/thiếu bị loại độc lập; dòng hợp lệ còn lại vẫn được ghi nhận.
4. Chống trùng theo `MSSV + hoạt động + học kỳ`.
5. Backend chỉ ghi điểm cho thành viên `approved` có MSSV và họ tên khớp chuẩn hóa; không tự tạo thành viên từ file điểm.
6. Nút `Mở khóa` gọi `drl_admin_lock_semester_v1(..., false)`; backend xóa cả `locked_at`, `locked_by` và `lock_at` để không còn scheduled lock chặn import.
7. Lock/unlock chỉ Admin; publish vẫn Admin-only.
8. Học kỳ đã publish là immutable; không cho tạo thêm trạng thái lock chồng lên publication guard.

## Trạng thái dữ liệu kiểm chứng

- Học kỳ `HK3-2025-2026`: 78 hoạt động / 78 thành viên đã ghi nhận từ file thực tế và hiện đã công bố.
- Import batch thực tế: 680 dòng được đưa vào backend sau lọc client; 78 nhận, 602 loại do không khớp thành viên hiện hữu hoặc họ tên không khớp; 0 trùng backend.
- Việc loại dòng không tạo hồ sơ thành viên mới và không gán điểm cho MSSV không thuộc danh sách thành viên approved.

## Nghiệm thu

- Web CI cho SHA production: SUCCESS.
- GitHub Pages fallback: SUCCESS.
- Cloudflare fallback: SUCCESS.
- Vercel Production workflow: SUCCESS.
- Deployment `dpl_ELZnc8NwXoVbSqRvVehzMVf3q1q9`: READY, production aliases assigned, aliasError = null.
- Production smoke test: HTTP 200.
- Runtime errors trong cửa sổ nghiệm thu 15 phút: không ghi nhận lỗi.
