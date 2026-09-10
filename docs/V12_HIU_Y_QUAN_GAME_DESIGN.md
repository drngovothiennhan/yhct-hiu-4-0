# V12 — HIU Y QUÁN: MASTER EXECUTION PROMPT

Vai trò: Principal Game Engineer, 2D Environment Designer, Frontend Architect và QA Lead cho HIU YHCT 4.0.

Mục tiêu: tái thiết kế HIU Y Quán thành game mô phỏng YHCT 2D có nhịp kể chuyện rõ ràng, sửa triệt để lỗi giao diện PC/desktop-on-phone bị kéo dãn, giữ nguyên dữ liệu Supabase, RPC chẩn thể, lịch hẹn và tín dụng Gia Viên đang chạy.

## Luật chơi bắt buộc
1. Mỗi giờ hệ thống cấp 1–2 bệnh nhân từ dữ liệu server hiện có. Người chơi đọc Tứ chẩn, chọn thể bệnh; mỗi ca chỉ chấm một lần và chỉ ca đúng mới nhận tín dụng theo RPC hiện hành.
2. Không tự sinh toa thuốc, liều dùng hay chỉ dẫn điều trị cá nhân. Hoạt cảnh trị bệnh/chế biến thuốc là mô phỏng giáo dục, không thay đổi kết quả lâm sàng thực tế.
3. Lịch hẹn là lịch mô phỏng trong game, giữ cơ chế V11; không cộng tiền/tín dụng ngoài luật chẩn thể.
4. Trạng thái cảnh phải theo cốt truyện: có khách chưa xử lý → phòng bắt mạch; vừa hoàn tất ca → phòng giường theo dõi; không còn khách chờ → khu chế biến dược liệu. Khi rảnh, thầy thuốc tuần tra tự động giữa ba khu.

## Ba bối cảnh 2D bắt buộc
- Phòng Chẩn Mạch: tủ thuốc, bàn bắt mạch, trà cụ, bệnh nhân ngồi khám.
- Phòng Dưỡng Trị: giường nằm độc lập, bình phong, đèn/chuông, bệnh nhân nằm theo dõi sau ca; tuyệt đối không minh họa thủ thuật nguy hiểm hoặc hướng dẫn điều trị.
- Phòng Chế Dược: bàn chế biến, cối chày, cân dược liệu, khay phơi/ấm sắc mô phỏng; chỉ là hoạt cảnh học tập.

## Hoạt ảnh và state machine
- `waiting`: thầy thuốc ở Chẩn Mạch, bệnh nhân vào bàn khám.
- `treated`: sau khi chấm ca, chuyển sang Dưỡng Trị trong một nhịp ngắn; bệnh nhân nằm nghỉ, thầy thuốc kiểm tra.
- `idle`: khi không còn ca chưa xử lý, thầy thuốc di chuyển qua Chẩn Mạch → Chế Dược → Dưỡng Trị theo vòng lặp chậm, có reduced-motion fallback.
- Chuyển bệnh nhân khác phải đưa cảnh về đúng trạng thái ca đó; không để hoạt ảnh che nút thao tác.

## Bố cục production
- Desktop: game stage panorama 3 phòng nằm ngang, chiều cao cố định theo aspect-ratio, max-width hợp lý, không dùng 100vh/1fr gây kéo dãn; nội dung dưới stage auto-height.
- Mobile: stage dùng bố cục 3 khu thu gọn có camera/scene selector; không ép canvas 1280 ngoài chế độ desktop-on-phone đã có.
- Desktop-on-phone: toàn bộ `.hyq-page`, `.hyq-clinic-view`, `.hyq-world`, `.hyq-workspace` phải content-sized; không được xuất hiện khoảng trắng hàng nghìn px.
- Giữ đủ các view Hồ sơ ca, Dược phòng, Thành tích, lịch hẹn và onboarding.

## Kiểm định bắt buộc
- Không thêm Serverless Function mới; giữ giới hạn Vercel Hobby <=12.
- Thêm contract gate V12 kiểm tra 3 scene, state machine, reduced-motion, content-sized layout, không `100vh` trong game và không phá V11 RPC.
- Chạy acceptance, security/npm audit, TypeScript/Vite build, Chrome smoke, adaptive mobile + desktop-on-phone + Windows viewport QA.
- Chỉ merge và deploy production khi tất cả gate xanh; smoke test production và kiểm tra runtime 5xx.
