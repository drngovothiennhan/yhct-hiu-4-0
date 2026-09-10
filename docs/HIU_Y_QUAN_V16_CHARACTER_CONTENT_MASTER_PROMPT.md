# MASTER PROMPT — HIU Y QUÁN V16 CHARACTER + CONTENT HARDENING

## Vai trò
Bạn là Principal Game Engineer, Character Technical Artist, Frontend Performance Engineer, Supabase/Postgres Architect và QA/DevSecOps Lead của HIU YHCT 4.0.

## Mục tiêu
Nâng cấp HIU Y Quán theo hướng game học thuật nhẹ, rõ, thân thiện với sinh viên: thay toàn bộ tạo hình nhân vật bằng bộ chibi đã được ChatGPT tạo theo mẫu đã duyệt; sửa tận gốc lỗi tràn chữ và kéo dài Sổ bệnh án; đưa catalog 70 cây thuốc theo Quyết định 4664/QĐ-BYT vào Dược phòng theo cơ chế tải ngẫu nhiên; mở rộng catalog mô phỏng lên đúng 50 thể bệnh/biện chứng có thể học bằng Vọng–Văn–Vấn–Thiết, dựa trên hướng dẫn chuyên môn Bộ Y tế hiện hành.

## Bất biến production
1. Additive-first, zero-regression. Không phá V11–V15, không xóa dữ liệu, không đổi ý nghĩa tín dụng Gia Viên, lịch hẹn, Dưỡng Trị, tái khám, Sổ bệnh án hay XP/mastery.
2. Không thêm Vercel Function; giữ <=12/12.
3. Không dùng CDN cho sprite nhân vật. Asset ở local `/assets`, WebP nhẹ, tổng ngân sách dưới 250 KB.
4. Animation chỉ dùng transform/opacity; không chạy canvas/game loop liên tục; hỗ trợ prefers-reduced-motion.
5. Nội dung YHCT là mô phỏng giáo dục; không đưa liều dùng/phác đồ/kê đơn cá nhân vào màn chơi.
6. Dữ liệu nguồn chính thống có provenance nội bộ nhưng không hiển thị chú thích nguồn trong game.
7. Khi V16 lỗi, lõi V15/V14 phải tiếp tục hoạt động.

## Nhân vật
- Dùng một spritesheet WebP nội bộ chứa đúng 8 tạo hình: bác sĩ nam, bác sĩ nữ; bệnh nhi nam, nam trưởng thành, nam cao tuổi; bệnh nhi nữ, nữ trưởng thành, nữ cao tuổi.
- Thay phần vẽ CSS/DOM cũ bằng sprite bằng CSS để không phải viết lại state machine.
- Giữ logic di chuyển bác sĩ qua Phòng Chẩn Mạch, Phòng Dưỡng Trị, Phòng Chế Dược.
- Bệnh nhân chọn sprite theo giới tính + tuổi: <18 dùng bệnh nhi, 18–59 trưởng thành, >=60 cao tuổi. `patient_variant` cũ được giữ tương thích dữ liệu nhưng không tạo thêm hình giả.
- Toàn bộ nhãn người chơi đổi từ “thầy thuốc” sang “bác sĩ” khi phù hợp, nhưng không sửa trích dẫn/nguồn lịch sử.

## Layout và typography
- Sổ bệnh án phải content-sized; không được kế thừa chiều cao từ scene/grid cha.
- Desktop: danh sách và chi tiết có vùng cuộn nội bộ bounded; không sinh khoảng trắng hàng nghìn px.
- Desktop-on-phone: khóa chiều cao workspace hợp lý và không dùng viewport-height.
- Mọi grid/flex child có `min-width:0`; nội dung dài dùng `overflow-wrap:anywhere`; button/tab/card cho phép wrap 2 dòng; tiêu đề clamp hợp lý; không cắt chữ tiếng Việt.
- Không dùng `100vh` hoặc `100dvh` trong V16.

## 70 cây thuốc Bộ Y tế
- Tái sử dụng duy nhất `private.herb_garden_species` với `source_code='QD4664-2014'`; production phải xác nhận đúng 70 bản ghi.
- Không nhân bản catalog 70 cây sang bảng khác.
- Dược phòng mỗi lần chỉ tải tối đa 12 thẻ từ pool 70 để DOM nhẹ; thứ tự được xáo trộn server-side theo thành viên/ngày/lần tải.
- RPC giữ shape tương thích `hiu_y_quan_herbs_v14()` để UI V14 không cần pipeline mới; những trường không có trong QĐ 4664 không được bịa.
- Không trả `dosage`, `caution` hoặc `source_ref` ra game.

## 50 thể bệnh / biện chứng
- `private.hiu_y_quan_syndrome_catalog` phải có đúng 50 entry hoạt động sau migration.
- Giữ 20 entry cũ để không làm hỏng hồ sơ lịch sử; bổ sung 30 entry được biên soạn từ các thể lâm sàng trong hướng dẫn Bộ Y tế, ưu tiên Quyết định 3991/QĐ-BYT ngày 29/12/2025, Tập II; có thể tham chiếu Tập I/Tập III khi cần.
- Mỗi entry có label, Vọng, Văn, Vấn, Thiết, explanation ngắn; không có điều trị/liều dùng.
- Thêm metadata provenance nội bộ (`source_code`, `source_ref`) trong schema private nhưng không đưa ra RPC public.
- Cơ chế tạo ca mới phải chọn động theo `count(*)` catalog, không hardcode `%20`.

## Vòng đời thông báo/hồ sơ
- Ca đã xuất viện/archived không còn trên màn hình hoạt động.
- Kết quả/thông báo transient tự ẩn sau thời gian ngắn; dữ liệu cần tra cứu vẫn tồn tại trong Sổ bệnh án server-side.
- Không xóa lịch sử bệnh án khi ẩn UI.

## QA bắt buộc
- Thêm contract V16 kiểm tra: 8 sprite slots, asset local, không CDN, sprite budget; Sổ bệnh án bounded; typography guards; 70 QD4664 reuse; 50 syndrome count/insertion; dynamic catalog selection; no treatment/dose exposure; <=12 Functions.
- V11–V15 contracts vẫn PASS.
- TypeScript/Vite build, npm audit, Chrome smoke, responsive matrix, desktop-on-phone PASS.
- Trên Supabase production: QD4664 count=70, syndrome count=50, RPC herb trả 12 random cards, không lộ source/dose; anonymous bị chặn.
- Production deployment READY, `/api/health` 200 và không có 5xx mới.

## Chế độ thực thi
Không dừng ở kế hoạch. Tự triển khai, gặp blocker thì xây phương án tương thích ngược/cục bộ thay vì sửa phá phần ổn định; QA trước merge; chỉ công bố hoàn tất khi production đã chạy V16.