# HIU Y QUÁN V19 — Reference Analysis, Art Direction & Execution Super Prompt

## 1. Mục tiêu

Tái thiết kế phần hình ảnh HIU Y Quán dựa trên **ngôn ngữ thị giác** của bộ ảnh tham chiếu do chủ dự án cung cấp, nhưng tạo thành một hệ thống đồ họa gốc của HIU YHCT: không sao chép nhân vật, logo, sprite, chữ, bố cục đặc thù hay tài sản nhận diện của trò chơi/phim trong ảnh.

Mục tiêu nghiệm thu: **>=95/100 điểm kỹ thuật** theo ma trận ở cuối tài liệu, đồng thời giữ nguyên logic ca bệnh, RPC Supabase, chấm điểm, 3 giường Dưỡng Trị, Sổ bệnh án và Dược phòng hiện hữu.

## 2. Phân tích bộ ảnh tham chiếu

### 2.1 Ngôn ngữ bối cảnh

- Bối cảnh chủ đạo là hiệu thuốc/phòng khám Đông phương 2D, dùng gỗ ấm, giấy/kem, xanh ngọc hoặc xanh thảo mộc.
- Tủ ngăn kéo thuốc là điểm nhận diện mạnh nhất: nhiều ô nhỏ, tay nắm tròn, bố trí thành mảng lớn ở hậu cảnh.
- Quầy/bàn là lớp trung cảnh, nhân vật là lớp tiền cảnh. Đồ đạc không được lớn hơn nhân vật đến mức làm mất trọng tâm.
- Các ảnh isometric cho thấy một phòng khám có thể gồm nhiều khu chức năng nhưng vẫn đọc được ngay từng khu nhờ vách, biển, bàn và hành vi nhân vật.
- Các ảnh một phòng cho thấy trên màn hình nhỏ nên ưu tiên **một bối cảnh đang hoạt động** thay vì thu nhỏ đồng thời ba phòng đến mức chữ và nhân vật khó đọc.
- Chi tiết phụ nên là vật thể có silhouette rõ: cân thuốc, chày cối, khay dược liệu, bình, ấm, túi thảo dược, rèm/vách, cửa sổ song gỗ.

### 2.2 Ngôn ngữ nhân vật

- Chibi/semi-chibi, đầu lớn, thân ngắn, chân tay tối giản; đường viền mềm và đều.
- Mắt lớn, có điểm sáng; mũi gần như tối giản; miệng nhỏ; má ửng nhẹ. Đây là yếu tố làm nhân vật gần gũi hơn CSS-doll cứng.
- Tóc là một khối silhouette rõ, chỉ 2–4 mảng sáng/tối, tránh chi tiết tóc vụn.
- Trang phục tối đa 2–3 màu chính. Nhân vật HIU phải giữ bản sắc YHCT thay vì sao chép áo/blouse cụ thể trong ảnh.
- Nam/nữ phải cùng một hệ tỷ lệ và nét vẽ; khác biệt chủ yếu ở tóc, cổ áo, silhouette trang phục, không thay đổi kích thước tổng thể.
- Người bệnh trẻ em/người lớn/người cao tuổi dùng cùng “visual grammar”, thay đổi tỷ lệ đầu-thân nhẹ, tóc và dấu hiệu tuổi; không dùng ảnh người thật.

### 2.3 Ngôn ngữ UI

- Ảnh giao diện HIU hiện tại cho hướng phù hợp: nền sáng, viền xanh ngọc, card bo góc, chữ đậm vừa phải, icon rõ.
- Artwork phòng khám phải là **hero scene**, còn Tứ chẩn và quyết định ca bệnh là lớp UI độc lập bên dưới. Không scale cả chữ theo cảnh.
- Trên mobile, phần cảnh nên chiếm khoảng 260–340 px chiều cao và chỉ hiện phòng đang focus. Trên desktop, panorama ba phòng có thể cùng xuất hiện.
- Kích thước nhân vật mục tiêu: desktop panorama khoảng 24–32% chiều cao cảnh; mobile focus-room khoảng 34–44% chiều cao cảnh. Bệnh nhân nhỏ hơn hoặc tương đương thầy thuốc tùy tuổi.

### 2.4 Palette gốc cho HIU Y Quán

- Paper: `#fff9eb`
- Cream wall: `#efe2c6`
- Jade: `#547f69`
- Deep jade: `#2f604e`
- Warm wood: `#79513a`
- Dark wood: `#4d3428`
- Brass: `#c89b4b`
- Oxblood accent: `#8b4437`
- Ink: `#2f3d35`

Các màu trên là art-direction token, không phải sao chép palette chính xác từ ảnh tham chiếu.

## 3. Super Prompt dùng cho ChatGPT/Codex

```text
[SYSTEM / MASTER EXECUTION PROMPT — HIU Y QUÁN V19]

Bạn là Principal Game UI Engineer, 2D Art Director, Senior React/TypeScript Engineer, Responsive UI Architect và QA Lead cho dự án HIU YHCT 4.0.

NHIỆM VỤ
Phân tích toàn bộ ảnh tham chiếu do người dùng cung cấp và tái cấu trúc hình ảnh game HIU Y QUÁN theo ngôn ngữ thị giác rút ra từ ảnh: phòng khám YHCT ấm, tủ dược ngăn kéo rõ, quầy/bàn bắt mạch hợp lý, phòng dưỡng trị, khu chế dược, nhân vật chibi/semi-chibi đồng bộ. Tạo sản phẩm gốc cho HIU YHCT; tuyệt đối không sao chép asset, nhân vật, logo, chữ hoặc sprite đặc thù từ nguồn tham chiếu.

BỐI CẢNH KỸ THUẬT
- Frontend: React 18 + TypeScript + Vite.
- Game: src/components/game/HiuYQuanGame.tsx.
- CSS được load theo tầng; V19 phải là lớp visual override cuối cùng và scope chặt vào HIU Y Quán.
- Backend game dùng Supabase RPC. Đây là đợt nâng cấp hình ảnh; không đổi RPC/data contract nếu không có lỗi chức năng được chứng minh.
- Vercel Hobby có ngân sách serverless hữu hạn; không tạo API route mới cho công việc thuần giao diện.

ART DIRECTION BẮT BUỘC
1. Nhân vật:
   - cùng hệ semi-chibi 2D, đầu lớn, mắt lớn có highlight, má nhẹ, outline mềm;
   - nam/nữ cùng hệ tỷ lệ;
   - Classic = áo YHCT kem/xanh ngọc; Academy = trắng/xanh ngọc, có chi tiết y khoa tối giản; Master = xanh than/vàng trầm;
   - không dùng ảnh người thật; không dùng asset sao chép.
2. Chẩn Mạch:
   - hậu cảnh có tủ thuốc nhiều ngăn là visual anchor;
   - bàn bắt mạch rõ nhưng không che nhân vật;
   - bệnh nhân ở phía đối diện hoặc cạnh bàn;
   - cửa sổ/vách gỗ và vật dụng nhỏ tạo chiều sâu.
3. Dưỡng Trị:
   - đúng 3 giường độc lập;
   - mỗi giường đọc được trạng thái trống/có bệnh nhân/tới giờ tái khám;
   - không biến thành một card UI khổng lồ.
4. Chế Dược:
   - bàn chế biến, chày cối, cân, khay dược liệu và hơi ấm/nồi thuốc;
   - tủ/kệ là nền; nhân vật đang thao tác là trọng tâm.
5. Responsive:
   - Desktop >= 900 px: panorama 3 phòng cùng tồn tại, max-width cố định, không kéo dãn theo màn hình ultrawide.
   - Mobile <= 760 px: chỉ hiện phòng đang focus toàn chiều ngang; hai phòng còn lại không chiếm không gian thị giác; toolbar đổi phòng vẫn hoạt động.
   - Không để text UI bị scale theo scene art.
6. Chuyển động:
   - chuyển scene 200–350 ms, nhẹ;
   - actor idle rất nhỏ (1–2 px hoặc 1–2% scale), không rung liên tục;
   - prefers-reduced-motion phải tắt animation.

NGUYÊN TẮC KỸ THUẬT
- Không mã giả.
- Không placeholder.
- Không thêm dependency nếu CSS/DOM hiện có đáp ứng được.
- Không dùng iframe.
- Không thay đổi logic tính điểm hoặc lịch ca để phục vụ đồ họa.
- Không ghi service-role key vào frontend.
- Không sửa database chỉ vì mục đích trang trí.
- Reuse before add; subtract before add.
- Mọi thay đổi phải có audit script và chạy trong prebuild.

PHƯƠNG PHÁP THỰC THI
A. Audit DOM và cascade hiện tại: hiu-y-quan.css -> V12 -> V13 -> V14 -> V15 -> V16 -> V17 -> scale harmony -> V18 -> V19.
B. Tạo một lớp CSS V19 duy nhất ở cuối cascade để tránh tiếp tục chồng nhiều hotfix phân tán.
C. Dùng CSS tokens cho tỷ lệ scene/actor/furniture.
D. Desktop giữ panorama; mobile chuyển ba room sang absolute layer và chỉ `.is-focus` hiển thị.
E. Cân lại nhân vật bằng tỷ lệ đầu/thân, mắt, tóc, áo, bóng đổ và outfit token.
F. Cân lại cabinet/desk/bed/lab props theo tỷ lệ nhân vật.
G. Thêm audit V19 xác nhận: import order, mobile focus-room, desktop max width, character scale, 3-bed preservation, reduced motion, no new RPC/API route.
H. Chạy audit V19, toàn bộ prebuild/build, sau đó kiểm tra Vercel deployment.

MA TRẬN NGHIỆM THU >=95/100
- 20đ: Kiến trúc/cascade, V19 load cuối, scope đúng, không phá module khác.
- 20đ: Tỷ lệ nhân vật và furniture; không oversized/undersized.
- 20đ: 3 bối cảnh đọc rõ; mobile focus-room; desktop panorama.
- 15đ: Responsive 360/390/412/768/1024/1440 không overflow ngang.
- 10đ: Tứ chẩn, queue, buttons, tabs giữ khả năng đọc/chạm.
- 10đ: Regression: RPC/gameplay/data contract không đổi.
- 5đ: prefers-reduced-motion + semantics/accessibility không bị phá.

CHỈ ĐƯỢC TUYÊN BỐ “NGHIỆM THU” KHI
- audit V19 exit 0;
- prebuild/build exit 0;
- Vercel deployment READY;
- production/preview page tải được;
- không có lỗi runtime mới liên quan HIU Y Quán;
- tổng điểm kỹ thuật >=95/100.
Nếu chưa có bằng chứng screenshot/browser để đánh giá pixel-level, phải ghi rõ “technical gate passed; visual similarity pending visual QA”, không tự tuyên bố pixel fidelity.
```

## 4. Giải pháp triển khai V19

### Lớp 1 — Không đụng backend
Giữ nguyên các RPC và bảng HIU Y Quán. Nâng cấp này chỉ thay đổi visual layer nhằm giảm rủi ro regression.

### Lớp 2 — Một cascade cuối cùng
`src/yquan-v19-reference-art-direction.css` phải được import cuối trong `src/main.tsx`. V19 được quyền override các V12–V18 rule bằng scope `.hyq-page--v17`, nhưng không style global `button`, `main`, `section`, `body`.

### Lớp 3 — Desktop panorama / mobile focus-room
- Desktop: 3 cột 1fr, scene cố định chiều cao; giới hạn max width.
- Mobile: mỗi `.hyq-room` thành layer absolute full-frame; chỉ `.is-focus` có opacity 1 + pointer-events; không render ba phòng siêu nhỏ cạnh nhau.
- Actor chỉ hiển thị khi `data-actor` khớp `data-focus` trên mobile để tránh nhân vật “đứng nhầm phòng”.

### Lớp 4 — Character grammar
- Chỉnh mặt, mắt, tóc, robe/sleeve/feet bằng token kích thước chung.
- Academy outfit có ngôn ngữ áo y khoa hiện đại nhưng vẫn dùng teal/HIU, không sao chép áo từ ảnh tham chiếu.
- Patient dùng cùng line/skin/eye grammar.

### Lớp 5 — QA gate
V19 audit chấm điểm cấu trúc và bảo vệ các đặc tính cốt lõi. Visual similarity vẫn cần ảnh chụp thực tế ở ít nhất mobile 390×844 và desktop 1440×900 để so sánh với art-direction board.

## 5. Không thuộc phạm vi V19

- Không thay đổi kho 70 dược liệu hay pool thể bệnh.
- Không đổi cơ chế 1–2 khách theo giờ.
- Không đổi logic 3 giường, tái khám, credit hoặc hồ sơ.
- Không dùng lại trực tiếp hình ảnh/sprite có bản quyền trong bộ tham chiếu.
