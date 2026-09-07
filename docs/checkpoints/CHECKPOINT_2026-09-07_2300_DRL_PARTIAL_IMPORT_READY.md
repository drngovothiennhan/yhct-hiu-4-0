# YHCT HIU 4.0 — Checkpoint DRL partial-valid import production

- Thời điểm chốt: 2026-09-07 23:00 (Asia/Ho_Chi_Minh)
- Repository: `drngovothiennhan/yhct-hiu-4-0`
- Branch nguồn: `main`
- SHA chức năng đã CI/production: `47f002e8987e30860408f8712367634773158655`
- Feature commit: `e76ac5f6f4efcdc6265dce27253ba77792961d10`
- Vercel project: `yhct-hiu-final4-stage`
- Production deployment: `dpl_7hUDHF7NupHWDJmM37X4pejQaMtw`
- Production URL: `https://yhct-hiu-final4-stage.vercel.app`
- Production state: `READY`
- Backend project ref: `gzmpnsrwqjpsbklyflqr`

## DRL upload contract đã chốt

1. Excel/XLS/CSV được đọc bằng Web Worker, tối đa 10 MB / 5.000 dòng hợp lệ.
2. Parser nhận diện và chuẩn hóa MSSV, Họ tên, Tên hoạt động, Điểm cộng cùng ngữ cảnh học kỳ cần cho bản ghi DRL.
3. File không bắt buộc 100% dòng đúng. Dòng sai/thiếu bị loại độc lập; các dòng hợp lệ còn lại vẫn được phép ghi nhận.
4. Các dòng trùng logic `MSSV + hoạt động + học kỳ` được bỏ qua, không cộng lặp.
5. Backend `drl_admin_import_v1` là điểm ghi dữ liệu; server tiếp tục chịu trách nhiệm từ chối dòng không khớp thành viên/không hợp lệ.
6. Sau upload, UI hiển thị số hồ sơ đã ghi nhận, số dòng bị loại và số dòng trùng; dữ liệu có thể tra cứu theo MSSV.
7. Điểm chưa công bố vẫn ở trạng thái `Đang tổng hợp / Chờ duyệt`; không làm lộ tổng điểm nháp ra công khai.
8. Quyền nhập dữ liệu thuộc `mod` trở lên; quyền công bố/khóa học kỳ vẫn thuộc `admin` theo phân quyền hiện hành.

## Kiểm chứng production

- GitHub Actions `Vercel Production` cho SHA `47f002e8987e30860408f8712367634773158655`: SUCCESS.
- Vercel deployment `dpl_7hUDHF7NupHWDJmM37X4pejQaMtw`: READY, alias production đã gán.
- Production smoke test trả HTTP 200.
- Vercel runtime errors trong 1 giờ kiểm tra: không ghi nhận lỗi.

Checkpoint này chỉ ghi nhận trạng thái đã kiểm chứng; không thay đổi dữ liệu điểm của bất kỳ thành viên nào khi chưa có file upload cụ thể từ người quản trị.