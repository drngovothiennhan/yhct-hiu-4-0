# MASTER PROMPT — HIU YHCT 4.0 · GAME + XIAOZHI + GARDEN V8

## ROLE
Bạn là Principal Social Platform Architect, Senior Web Game Engineer, Lead React/TypeScript Engineer, Supabase/Postgres Architect, AI Agent Engineer và QA/DevSecOps Lead cho dự án **HIU YHCT 4.0**.

Đây là dự án production. Không viết demo, pseudocode, TODO, placeholder hoặc dữ liệu giả. Không xóa tính năng đang hoạt động. Mọi thay đổi phải có khả năng rollback, kiểm thử trên nhánh riêng trước khi nhập `main`, giữ nguyên RLS và quyền thành viên.

## NGUYÊN TẮC THỰC THI
1. Làm trực tiếp trên repo chính `drngovothiennhan/yhct-hiu-4-0`.
2. Đọc code hiện tại trước khi sửa. Tái sử dụng RPC, ví tín dụng, auth, theme và module contract đang có.
3. Không sao chép asset, code, nhân vật hoặc bố cục độc quyền từ ZingMe/Khu Vườn Trên Mây. Chỉ tham khảo cảm giác tương tác: thế giới 2D vui, rõ khối, có chiều sâu, kéo/khám phá không gian. Toàn bộ đồ họa phải nguyên bản.
4. XiaoZhi được tích hợp theo hướng **software-equivalent**: giọng nói, hội thoại, tool routing, web search, nguồn, trạng thái online/offline, không kéo firmware/hardware ESP32 vào frontend web nếu không cần.
5. Không đưa A.I học thuật vào A.I Mini. A.I học thuật chỉ tồn tại ở **Trung tâm nghiên cứu**.
6. Nội dung game YHCT là mô phỏng giáo dục, không kê đơn, không thay thế chẩn đoán thực tế.
7. Trước merge `main`: chạy CI, TypeScript build, responsive smoke, kiểm tra Supabase security/performance advisor, kiểm tra Vercel preview.

## PHẦN A — GIA VIÊN DƯỢC THẢO V8
- Giữ toàn bộ nghiệp vụ Gia Viên V7 hiện có: 9 ô, gieo, tưới, bón, thu hoạch, inventory, seed reward, wallet.
- Thiết kế lại presentation thành thế giới 2D dạng block rõ ràng: đất có cạnh/độ dày, cây có bóng, ao, lối đi, khu cảnh quan, vùng mở rộng.
- Canvas lớn hơn viewport. Desktop giữ/kéo chuột để pan; mobile vuốt để khám phá. Không phá thao tác trên button/cell.
- Responsive tốt, không tràn layout chính. Cho phép mở rộng cảnh quan sau này mà không thay contract V7.
- Không dùng iframe.

## PHẦN B — GAME `HIU - Y - QUÁN`
### Onboarding
- Chỉ thành viên đã đăng nhập.
- Lần đầu yêu cầu nhập tên nhân vật, chọn Nam/Nữ, bấm Kích hoạt.
- Avatar thầy thuốc anime/cartoon 2D nguyên bản mặc trang phục YHCT, thay đổi theo giới tính.

### Phòng khám
- Bối cảnh 2D: tủ thuốc nhiều ngăn, bàn bắt mạch, gối mạch, vật dụng YHCT, khu bác sĩ, khu bệnh nhân, bong bóng hội thoại.
- Mỗi giờ sinh **1 hoặc 2 bệnh nhân** ổn định theo tài khoản + hour-slot; không cần cron để tránh chi phí.
- Tuổi/giới tính bệnh nhân thay đổi có kiểm soát.
- Ban đầu có đúng **20 thể bệnh YHCT cơ bản** trong catalog server.
- Mỗi ca hiển thị bốn nhóm: **Vọng, Văn, Vấn, Thiết**.
- Mỗi ca đưa 4 lựa chọn thể bệnh. Đáp án đúng không được gửi lộ từ client.
- Submit được chấm phía Supabase RPC. Mỗi ca chỉ được ghi nhận một lần.
- Đúng: +1 tín dụng vào chính `herb_garden_wallets`; sai: 0. Chống replay/double-award bằng unique constraint/server transaction.
- Hiện giải thích ngắn sau khi trả lời. Không kê phương thuốc ở phiên bản này.
- Có HUD: tín dụng, số ca, tỷ lệ đúng, countdown ca giờ kế tiếp.

### 20 thể bệnh khởi đầu
Phong hàn phạm Phế; Phong nhiệt phạm Phế; Đàm thấp trở Phế; Phế khí hư; Tỳ khí hư; Tỳ dương hư; Vị nhiệt; Vị âm hư; Can khí uất; Can hỏa thượng viêm; Can huyết hư; Can Thận âm hư; Thận dương hư; Thận âm hư; Tâm huyết hư; Tâm âm hư; Tâm Tỳ lưỡng hư; Khí trệ huyết ứ; Hàn ngưng huyết ứ; Thấp nhiệt hạ tiêu.

## PHẦN C — A.I MINI XIAOZHI
### Phạm vi
A.I Mini là **trợ lý hệ thống + đời sống số + thông tin công khai**, không phải A.I học thuật.

Cho phép:
- hỏi điểm rèn luyện/điểm hoạt động của tài khoản;
- hỏi lịch CLB/sự kiện;
- hỏi cách dùng các module HIU YHCT 4.0;
- hỏi trạng thái/chức năng Gia Viên và HIU-Y-Quán;
- hỏi tin tức/thông tin bên ngoài bằng web search có nguồn;
- nhận giọng nói và đọc câu trả lời.

Không cho phép A.I Mini trả lời:
- nghiên cứu y khoa, y văn, PubMed/OpenAlex;
- chẩn đoán/điều trị/kê đơn;
- dược lý, phương tễ, huyệt vị và nội dung chuyên môn sâu.
Các intent này phải trả lời ngắn rồi điều hướng sang `/research`.

### Voice / XiaoZhi experience
- `voiceOn=true` mặc định; lưu lựa chọn localStorage.
- TTS `vi-VN`, ưu tiên voice nữ nếu hệ điều hành có voice phù hợp.
- STT qua Web Speech API khi trình duyệt hỗ trợ; có fallback nhập text.
- Desktop: popup draggable; lưu vị trí. Không kéo khi user đang thao tác input/button.
- Mobile: cố định góc trái dưới, popup compact phía trên bottom navigation; bỏ transform desktop bằng CSS media query.
- Khi voice tắt: trả lời văn bản bình thường.

### Web search
- Server endpoint bảo vệ bằng member auth.
- API key chỉ ở server.
- Khi cần dữ liệu mới, dùng Responses API web-search tool; trả answer + source links.
- Không bịa nguồn, không tự suy đoán dữ liệu cá nhân.
- Có local fallback nếu cloud/web search lỗi.

## PHẦN D — DATABASE & SECURITY
- Tạo `hiu_y_quan_profiles`, `hiu_y_quan_cases`, `hiu_y_quan_attempts`.
- Catalog 20 thể bệnh nằm ở schema private hoặc không lộ đáp án cho client.
- RLS bật cho bảng public; revoke direct table access nếu chỉ dùng RPC.
- RPC dùng `security definer set search_path=''`, kiểm `private.current_member_id()` + `private.is_approved()`.
- Tín dụng chỉ cộng server-side vào `herb_garden_wallets`.
- Unique `(member_id, case_id)` chống cộng lại.

## PHẦN E — ACCEPTANCE GATES
Chỉ merge khi đạt toàn bộ:
- `npm run build` pass.
- Existing acceptance scripts pass, đặc biệt garden water/fertilizer contract.
- Không import học thuật còn sót trong `UnifiedAiMini`.
- Game onboarding hoạt động; reload vẫn giữ profile.
- Giờ hiện tại có 1–2 ca; submit đúng +1 wallet; submit lại không cộng thêm.
- Desktop garden pan được nhưng button vẫn click được.
- Mobile 360–430px không overflow; AI Mini cố định trái dưới, không che bottom nav.
- TTS toggle hoạt động; STT fallback hợp lệ.
- Web-search source link có `https://`, mở tab mới.
- Supabase security advisor không phát sinh lỗi nghiêm trọng mới.
- Vercel preview load được `/`, `/garden`, `/research`; console không có lỗi runtime quan trọng.

## OUTPUT / EXECUTION MODE
Không dừng ở phân tích. Thực hiện thay đổi code, migration, test, sửa lỗi, tạo PR, kiểm tra preview và chỉ merge khi acceptance gates đạt. Báo cáo cuối ngắn gọn: commit/PR, migration, CI, URL preview/production và các giới hạn còn lại nếu có.
