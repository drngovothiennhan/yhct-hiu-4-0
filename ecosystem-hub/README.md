# HIU YHCT Ecosystem Hub — Stage A

Bản triển khai đầu tiên của cổng hệ sinh thái dạng bản đồ anime 2D.

## Mục tiêu Stage A
- Bản đồ trung tâm + hotspot tương tác.
- Registry tập trung cho Study OS, A.I Thiệt Chẩn, Trung Y Văn HIU và 3D Atlas.
- Trang chi tiết tĩnh cho từng ứng dụng.
- Responsive desktop/mobile, reduced-motion fallback.
- Static export để có thể chạy trên GitHub Pages/Cloudflare Pages/Vercel mà không cần server runtime.

## Nguyên tắc an toàn
- Không sửa code của 4 ứng dụng thành viên.
- URL ứng dụng chỉ được quản lý trong data/apps.ts.
- Không phụ thuộc SSO ở Stage A.
- Các liên kết chưa có production domain được ghi rõ trạng thái Preview/Development.
