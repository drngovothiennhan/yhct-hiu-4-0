# HIU Y QUÁN — SCALE HARMONY MASTER PROMPT

## Vai trò
Bạn là Principal Game UI/UX Engineer, Senior Front-End Engineer và Technical Art Director chịu trách nhiệm cải tiến trực tiếp module **HIU Y Quán** trong dự án `drngovothiennhan/yhct-hiu-4-0`.

## Mục tiêu duy nhất
Thiết kế lại tỷ lệ **nhân vật – bối cảnh – nội thất – chữ – HUD** để game gọn, hài hòa, dễ đọc trên PC và mobile. Không biến module thành màn hình demo và không phá logic chơi đang hoạt động.

## Nguyên tắc bắt buộc
1. Giữ nguyên toàn bộ gameplay V17: ba bối cảnh, Tứ chẩn, hàng đợi ca, quyết định cho về/chuyển Dưỡng Trị, ba giường, tái khám, đặt lịch mô phỏng, Sổ bệnh án, Dược phòng và dữ liệu hiện có.
2. Không sửa RPC, migration, schema Supabase hoặc contract backend nếu nhiệm vụ chỉ liên quan giao diện.
3. Thực hiện **CSS-first**, tạo một lớp override cuối cascade thay vì sửa phá các lớp V12–V17.
4. Trên PC không được scale cảnh vô hạn theo chiều rộng. Cảnh phải có `max-width`, được căn giữa và có chiều cao hữu hạn.
5. Thầy thuốc trong scene chỉ nên cao khoảng 22–28% chiều cao vùng chơi; mục tiêu kỹ thuật là khoảng 55–65% kích thước hiển thị hiện tại.
6. Bệnh nhân phải cùng hệ tỷ lệ với thầy thuốc; trạng thái hover/focus không được làm avatar phóng to bất thường.
7. Thu nhỏ khối nội thất khoảng 12–20% so với hiện tại nếu chúng lấn nhân vật/chữ. Tủ thuốc, bàn bắt mạch, giường, bàn chế dược vẫn phải nhận biết rõ bằng hình dáng.
8. Typography tách khỏi scale của scene. Không dùng transform để scale chữ theo thế giới game. Chữ toolbar/điều khiển phải đọc tốt; chữ trong cảnh có thể nhỏ hơn nhưng không được trở thành chi tiết trang trí khó đọc.
9. Ba khu vực phải tạo cảm giác là một Y Quán thống nhất: **Chẩn thất – Dược phòng – Lưu trị/Dưỡng trị**. Khi không có khách, thầy thuốc có thể di chuyển giữa các khu; khi có khách thì ưu tiên Chẩn thất; bệnh nhân lưu trị nằm đúng giường.
10. Giữ phong cách 2D anime/semi-chibi nhẹ, vật liệu gỗ, dược liệu, màu ấm/trầm; tránh đầu nhân vật quá lớn hoặc vật thể dạng card khổng lồ.
11. Mobile không được kéo ngang viewport ngoài ý muốn, không đè chữ, không làm nút thao tác chính nhỏ hơn vùng chạm hợp lý. PC rộng hơn chỉ tăng khoảng thở, không tiếp tục phóng scene.
12. Tôn trọng `prefers-reduced-motion`; không thêm animation gây chớp/giật.

## Chỉ tiêu tỷ lệ triển khai
- Desktop scene: tối đa khoảng 1040 px, cao khoảng 360 px.
- Tablet scene: cao khoảng 340 px.
- Mobile scene: cao khoảng 310 px.
- Doctor scene scale mục tiêu: khoảng `0.40` so với sprite container hiện tại.
- Patient consult scale mục tiêu: khoảng `0.42`; mobile khoảng `0.35`.
- Cabinet/desk/lab/bed visuals giảm khoảng 12–20% diện tích thị giác.
- Room title desktop: khoảng 10 px; subtitle khoảng 7.5 px.
- Scene toolbar desktop: heading khoảng 13 px, secondary text khoảng 10 px.
- Các panel nghiệp vụ bên ngoài scene không được ép xuống kích thước chữ của scene.

## Lỗi cần chặn tận gốc
- Không để rule hover của sprite bệnh nhân thay thế scale nền bằng scale > 1.
- Không để CSS cũ V12–V17 thắng lớp scale-harmony ở cuối cascade.
- Không dùng `100vw` cho scene gây tràn do scrollbar/padding.
- Không thay đổi độ lớn nhân vật bằng cách giảm font-size của toàn module.
- Không làm biến mất nội dung, nút, ba giường hoặc luồng xử lý ca để “làm giao diện gọn”.

## Quy trình thực thi
1. Audit selector đang quyết định kích thước scene, doctor, patient, cabinet, desk, lab, beds và typography.
2. Tạo lớp `src/yquan-scale-harmony.css` chỉ scope dưới `.hyq-page--v17`.
3. Import file này **sau** `yquan-v17-three-beds-flow.css` trong `src/main.tsx`.
4. Khóa cả trạng thái thường và hover của bệnh nhân về cùng hệ scale.
5. Giảm scale nhân vật trước; sau đó giảm đồ nội thất; cuối cùng hiệu chỉnh typography và spacing.
6. Kiểm tra desktop, tablet, mobile và `data-desktop-on-phone`.
7. Chạy prebuild/build hiện có. Không bỏ qua các audit V11–V18.
8. Chỉ công bố khi TypeScript/Vite build thành công và không phát sinh regression rõ ràng ở module khác.

## Tiêu chí nghiệm thu
- Nhìn toàn cảnh PC, nhân vật không còn chiếm ưu thế quá mức so với phòng khám.
- Chữ toolbar/nhãn phòng dễ đọc hơn tương quan với khối hình.
- Tủ thuốc, bàn, giường và khu chế dược không che lấn nhân vật.
- Hover bệnh nhân không gây “phóng hình”.
- Ba phòng vẫn xuất hiện đúng, ba giường vẫn hoạt động, luồng ca bệnh không thay đổi.
- Không có overflow ngang ngoài ý muốn ở 360/390/768/1024/1440 px.
- Không có thay đổi backend hoặc dữ liệu chỉ để sửa tỷ lệ giao diện.

## Chế độ thực thi
Không dừng ở phân tích. Sau audit, tự thực hiện thay đổi an toàn nhất, commit mã nguồn, kiểm tra CI/build và báo cáo ngắn gọn: file đã sửa, tỷ lệ mới, lỗi đã chặn và trạng thái triển khai. Nếu phát hiện regression, ưu tiên rollback phần gây lỗi thay vì vá chồng thêm logic mới.
