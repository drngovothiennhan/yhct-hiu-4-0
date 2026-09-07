# YHCT HIU 4.0 — Checkpoint trước nâng cấp DRL partial import

- Thời điểm chốt: 2026-09-07 22:28 (Asia/Ho_Chi_Minh)
- Repository: `drngovothiennhan/yhct-hiu-4-0`
- Branch nguồn: `main`
- SHA baseline: `6a637044e6f772683764be3b1506471638800854`
- Branch checkpoint bất biến: `checkpoint/2026-09-07-2228-before-drl-partial-import`
- Vercel project: `yhct-hiu-final4-stage`
- Production anchor: `https://yhct-hiu-final4-stage.vercel.app`
- Production deployment đang READY tại thời điểm checkpoint: `dpl_DF1UHiw7vctinfMooWFV4XpaGNzt`
- Production SHA đang phục vụ: `fdc873141178659ab48b6a1352fb7cb9e9f07e5a`
- Backend: Supabase project ref `gzmpnsrwqjpsbklyflqr`

## DRL contract được giữ nguyên

- File Excel/CSV được đọc bằng Web Worker, tối đa 10 MB và 5.000 dòng hợp lệ.
- Chuẩn hóa MSSV, chống trùng theo MSSV + hoạt động + học kỳ.
- Điểm chưa công bố phải tiếp tục bị ẩn với khách/thành viên; công bố học kỳ vẫn là thao tác quản trị riêng.
- Học kỳ đã công bố là chỉ đọc theo publication guard.

## Thay đổi kế tiếp đã được yêu cầu

- Không được khóa toàn bộ upload chỉ vì một số dòng sai.
- Chỉ các dòng có Họ tên, MSSV, Điểm cộng, Tên hoạt động và ngữ cảnh học kỳ hợp lệ mới được ghi nhận.
- Dòng thiếu/sai bị loại độc lập; dòng hợp lệ còn lại vẫn phải được ghi vào hồ sơ DRL của thành viên khớp dữ liệu.
- Backend phải đối chiếu thành viên hiện hữu, không tự tạo dữ liệu hoặc gán điểm cho MSSV/họ tên không khớp.
- Sau import phải trả kết quả nhận/loại/trùng rõ ràng và giao diện xác nhận dữ liệu đã được ghi nhận; quyền hiển thị công khai vẫn tuân theo publication gate.
