# HIU Y QUÁN V20 — MASTER UNIFICATION / UNITY-STYLE GAMEPLAY AUDIT PROMPT

## Vai trò
Bạn đồng thời là Principal Game Programmer, Gameplay Systems Architect, Unity-style Technical Game Reviewer, 2D Character Technical Artist, Animation Engineer, Narrative Game Designer, React/TypeScript Senior Engineer, Supabase Database Engineer và QA Lead.

## Mục tiêu
Không tạo thêm một phiên bản giao diện song song. Hợp nhất HIU Y Quán về **một runtime production duy nhất: V20**. Các RPC/tables cũ chỉ được giữ làm compatibility layer khi cần bảo toàn dữ liệu; tuyệt đối không để nhãn V15/V17/V18/V19 xuất hiện như một phiên bản game đang chạy.

## Quy tắc bất biến
1. Không xóa dữ liệu người chơi, điểm, tín dụng, lịch sử chẩn thể, bệnh án, mastery hoặc progression.
2. Không thay đổi quy tắc chấm điểm hiện có nếu không có yêu cầu riêng.
3. Game là mô phỏng giáo dục YHCT, không được trình bày như hệ thống chẩn đoán/kê đơn thực tế.
4. Chỉ có 3 giường Dưỡng Trị. Một giường chỉ có một bệnh nhân hoạt động.
5. Đủ 3/3 giường chỉ khóa thao tác **chuyển thêm bệnh nhân vào Dưỡng Trị**. Không được khóa tiếp nhận, Tứ chẩn hoặc chẩn thể các ca khác.
6. Khi bệnh nhân nằm giường: đầu phải hướng đúng về đầu giường/gối, thân nằm trong chiều dài nệm, tỷ lệ nhân vật phải phù hợp kích thước giường.
7. Sau chẩn thể, hoạt cảnh bác sĩ phải có chuỗi Chế Dược: đi đến tủ thuốc → lấy vị → cân → nghiền/trộn → sắc → đóng gói → quay lại hoặc chuyển tiếp theo cốt truyện.
8. Refresh/reload phải khôi phục đúng module HIU Y Quán và trạng thái ca đang chơi; không được rơi về Gia Viên Dược Thảo.

## Audit theo tư duy Unity
### Gameplay state machine
Kiểm tra DoctorState, PatientState, CaseState, BedState và scene transition. Mọi transition phải deterministic, không teleport vô lý, không có hai actor chiếm cùng interaction point.

### Scene / Map
Duy trì đúng ba scene: Phòng Chẩn Mạch, Phòng Chế Dược, Phòng Dưỡng Trị. Waypoint graph phải nối được cửa, bàn khám, tủ thuốc, cân, cối, nồi sắc, bàn đóng gói và ba giường. Camera/focus chuyển scene theo story state nhưng người chơi vẫn được phép xem thủ công.

### Character / Animation
Doctor và patient là actor có position, direction, state, animation clip. Kiểm tra idle, walk, greet, observe, listen, question, pulse, write, think, take herb, weigh, grind, cook, package, check bed, talk, lie, recover, leave. Animation chỉ chạy khi hợp ngữ cảnh.

### Effects
Hiệu ứng chỉ hỗ trợ thông tin: hơi thuốc khi sắc, highlight giường đến giờ tái khám, phản hồi trạng thái khi chẩn đúng/sai. Không dùng hiệu ứng gây rối hoặc thay thế feedback chức năng.

### Persistence
Route UI, story snapshot và server case state phải khớp nhau sau reload. URL cần mang định danh HIU Y Quán; story snapshot phải có version và case key.

## Nội dung YHCT
Mở rộng thêm các thể bệnh cơ bản theo dạng educational pattern: mã, tên, Vọng, Văn, Vấn, Thiết, giải thích và provenance trung thực. Không gắn nguồn chính thức nếu chưa kiểm chứng nguồn đó. Nội dung mới phải idempotent khi migrate.

## Ba hướng mở rộng cốt truyện an toàn
1. **Ca tái khám có thay đổi biểu hiện**: chỉ thêm narration/visual state, không thay quy tắc chấm điểm gốc.
2. **Nhiệm vụ Chế Dược theo ca**: dùng dược liệu như mini-learning objective, không tạo liều dùng/kê đơn thật.
3. **Uy tín Y Quán / sổ tay học tập**: progression phụ dựa trên hoạt động đã có, không can thiệp tín dụng hoặc logic chẩn thể.

## Acceptance gates bắt buộc
- Runtime chỉ có một entry V20.
- Không còn bootstrap DOM-overlay bắt buộc để thay scene cũ.
- Không import chuỗi CSS V11→V19 gây cascade conflict; chỉ giữ stylesheet thật sự cần cho V20 và compatibility feature đang dùng.
- Refresh ở `?game=hiu-y-quan` vẫn ở HIU Y Quán.
- 0/3, 1/3, 2/3 giường: nút chuyển Dưỡng Trị hoạt động; 3/3: nút chuyển bị khóa nhưng queue và chẩn thể vẫn thao tác được.
- Bệnh nhân nằm đúng chiều: đầu về phía gối/đầu giường.
- Doctor thực hiện đầy đủ chuỗi Chế Dược bằng waypoint + animation.
- Build TypeScript, smoke test responsive, runtime playthrough và contract check đều PASS trước khi merge production.
