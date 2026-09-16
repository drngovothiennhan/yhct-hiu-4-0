# HIU YHCT 4.0 — Kiểm tra nội bộ trước phát hành

Ngày kiểm tra: 15/09/2026. Phạm vi: UI; AI/trợ lý; logic hệ thống; luyện thi toàn bộ; chuẩn bị thư viện Drive.
Repository: drngovothiennhan/yhct-hiu-4-0.
Base đã xác minh qua GitHub và git fetch: 674802026ff6886eb9a76cc18ab5aca766dc0a0d.
Nhánh nội bộ: audit/internal-release-20260915. Thay đổi chưa commit/push/deploy.
Không sử dụng deployment A.I Thiệt Chẩn trong ảnh làm căn cứ cho dự án này.

## Kết luận

Đã hoàn tất bản sửa nội bộ và kiểm tra build. CHƯA đủ bằng chứng để công nhận production-ready.
Bản đang chạy được kiểm tra qua trình duyệt ở trạng thái khách; chưa có phiên thành viên cho kiểm thử Gemini thật.
Trình duyệt kiểm tra từ xa không mở được localhost (ERR_BLOCKED_BY_CLIENT). Vì vậy chưa nghiệm thu trực quan bản sửa; không coi kiểm thử cấu trúc CSS là kiểm thử giao diện thực tế.

## Phát hiện và thay đổi

1. UI trợ lý: bảng trợ lý trên bản đang chạy có y=-582.39 px, cao 610 px; tổ tiên header có backdrop-filter saturate(1.05) blur(14px). Trợ lý fixed bị neo vào header và cắt khỏi màn hình. Đã chuyển mount ra ngoài header/main, giữ cùng app shell và các selector mobile. Thêm kiểm tra cấu trúc chống đưa trở lại header. Lần bấm “Thực hiện” khi bảng lệch đưa sang Research không được kết luận là lỗi intent router; kiểm thử hàm aiNavigationTarget xác nhận “Hãy mở luyện thi” vào /exam và câu hỏi kiến thức không bị coi là lệnh.
2. AI Study: dùng ref chặn gửi trùng ngay trong cùng lượt sự kiện; hủy request và bỏ phản hồi muộn khi unmount. Tự gửi câu hỏi từ trợ lý qua microtask có kiểm tra hiệu lực để tương thích React StrictMode. Thêm nhãn truy cập cho ô nhập.
3. Luyện toàn bộ: ngân hàng HIU có 5,10,20,30,50 và Toàn bộ. Ôn nhanh vẫn có 5/10/20 và nút Toàn bộ chuyển sang ngân hàng, giữ thư mục. Toàn bộ dùng từng đợt tối đa 25 câu, cùng seed, chấm phía server rồi chuyển đợt. Tổng kết đúng/số đã chấm xuyên các đợt. Không tải mọi câu cùng lúc. Không mở chế độ sinh đề Gemini vô hạn.
4. Phục hồi: lỗi tải đợt mới giữ kết quả và vị trí đợt cũ, cho thử lại; chặn gửi/chấm trùng. Nếu tổng ngân hàng thay đổi hoặc phát hiện câu lặp giữa các trang, yêu cầu tạo lượt mới. Đây không phải snapshot giao dịch của toàn ngân hàng: nếu dữ liệu bị thay đổi giữa các đợt mà tổng không đổi và không gây trùng, chưa bảo đảm phát hiện mọi thay đổi.
5. Ôn ngắt quãng: bổ sung Toàn bộ và sửa giới hạn phiên. Trước đây slice(0,count) rồi luôn lấy phần tử đầu khiến bộ lọc trượt tiếp sau mỗi lần trả lời, nên 5/10/20 không giới hạn tổng số thẻ thực sự ôn. Nay theo dõi số thẻ đã ôn trong lượt và dừng đúng giới hạn.
6. Thư viện: tạo góc riêng trên trang Thư viện/Research, đọc danh mục đã phát hành từ RPC sẵn có, tìm theo tên, ngày cập nhật, trạng thái trống/lỗi/thử lại. Chỉ giữ tài liệu published + members, loại metadata nguồn. Yêu cầu danh mục có timeout 15 giây và hủy khi rời trang. Chưa tạo endpoint tải, chưa liên kết folder Drive mới, chưa thay đổi quyền chia sẻ. Giao diện nói rõ “Chưa mở tải”, không tạo nút tải giả.

## Bằng chứng mới

- npm run build: PASS, exit 0; gồm toàn bộ prebuild audits, TypeScript và Vite. Các kiểm tra cũ khóa cứng danh sách số câu được cập nhật đúng yêu cầu Toàn bộ.
- node scripts/internal-release-behavior-check.mjs: PASS. Harness cô lập dịch vụ, chạy handler thật của component; dữ liệu 53 câu là fixture kiểm thử, không phải thống kê ngân hàng thật. Qua 25/25/3; giữ seed/thư mục; gửi/chấm hai lần chỉ chạy một; lỗi mạng không mất kết quả; retry cùng offset; hủy AI và loại câu trả lời muộn; loại tài liệu draft/private/khóa sai và bỏ sourceId.
- node scripts/v18-request-behavior-check.mjs: PASS; hủy/timeout, điều hướng tiếng Việt và tách câu hỏi khỏi lệnh.
- node scripts/learning-hub-contract-check.mjs: PASS.
- node scripts/mobile-assistant-safe-zone-check.mjs: PASS cấu trúc mã nguồn, không thay thế mobile E2E.
- node scripts/ai-golden-medical-eval.mjs --validate-only: PASS cấu trúc bộ 36 ca, 12 lĩnh vực, 11 ca trọng yếu và scorer. CHƯA chạy đánh giá mô hình thực tế; không suy ra tỷ lệ trả lời đúng.
- node scripts/performance-chunk-boundary-check.mjs --dist: PASS. CSS khởi đầu 195540 byte raw / 33325 byte gzip; tài liệu, Research, Game giữ lazy loading. Đây là số đo bundle, không phải thời gian tải/đáp ứng của người dùng.
- git diff --check: PASS.

## Điểm sơ bộ và 5 đề xuất cho từng nhóm

Điểm dưới đây là nhận định kỹ thuật từ mã nguồn và kiểm tra khách, KHÔNG phải điểm nghiệm thu toàn hệ thống hay độ chính xác y khoa. Dự kiến chỉ đạt khi hoàn tất các đề xuất và kiểm thử chấp nhận. Chưa chấm chất lượng hội thoại Gemini thật vì thiếu kết quả thực nghiệm.

| Nhóm | Hiện tại, sơ bộ /10 | Dự kiến /10 | 5 đề xuất trong phạm vi |
|---|---:|---:|---|
| UI | 6.0 | 8.5 | 1. Sửa bảng trợ lý vượt màn hình. 2. Kiểm tra chạm/kéo và bàn phím trên điện thoại thật. 3. Giữ nút quan trọng ngoài vùng thanh điều hướng. 4. Chuẩn hóa nhãn, focus và kích thước nút. 5. Kiểm tra màn hình hẹp/ngang và nội dung dài. |
| AI và trợ lý, kiến trúc | 7.0 | 8.5 | 1. Giữ Gemini hỏi đáp, trợ lý tác vụ. 2. Kiểm thử hội thoại nhiều lượt và đổi chủ đề. 3. Hỏi lại khi thiếu dữ kiện. 4. Chặn gửi trùng, hủy và bỏ phản hồi muộn. 5. Kiểm chứng nguồn, câu hỏi ngoài phạm vi và lỗi quota bằng phiên thật. |
| Logic và xung đột | 6.5 | 8.5 | 1. Kiểm tra toàn tuyến điều hướng. 2. Tách overlay khỏi header gây xung đột. 3. Khóa thao tác đồng thời. 4. Bảo toàn trạng thái khi mạng lỗi/ngân hàng thay đổi. 5. Chạy hồi quy khách/thành viên/admin trước phát hành. |
| Luyện thi | 6.5 | 9.0 | 1. Thêm Toàn bộ. 2. Tải theo đợt nhỏ. 3. Giữ thư mục và thứ tự giữa các đợt. 4. Tổng kết tích lũy và thử lại khi lỗi. 5. Giới hạn đúng số thẻ ôn ngắt quãng. |
| Thư viện | 3.0 | 8.5 | 1. Tạo góc tài liệu riêng. 2. Danh mục chỉ gồm tài liệu đã phát hành. 3. Tìm tên và ngày cập nhật. 4. Liên kết Drive cùng quyền tải từng tài liệu. 5. Kiểm thử tải thật, file bị thu hồi và phiên hết hạn. |

UI có lỗi cắt bảng nghiêm trọng nên không đạt phát hành. AI có tách vai trò, giới hạn ngữ cảnh và deadline trong mã nhưng thiếu runtime evidence. Logic có nhiều audit song còn lỗi vòng đời/phiên ôn. Luyện thi thiếu toàn bộ và giới hạn ôn ngắt quãng sai trước sửa. Thư viện trước sửa chủ yếu là nghiên cứu và nhập cục bộ, chưa có luồng tải thành viên. Đây là cơ sở của các điểm sơ bộ, không giả định các mục chưa kiểm tra đã đạt.

## Quy trình tiếp tục và điều kiện phát hành

1. Giữ checkpoint nhánh nội bộ; rà soát diff và đồng bộ main mới trước tích hợp để tránh ghi đè phiên khác.
2. Dùng một preview candidate đúng source revision, kiểm tra desktop và điện thoại: mở/đóng/kéo trợ lý, bàn phím, học/thư viện/AI và quay lại.
3. Dùng tài khoản kiểm thử thành viên: hội thoại 10 lượt có đổi chủ đề, câu ngoài phạm vi, hủy/gửi trùng/quota; chạy golden runtime. Đặt ngưỡng đánh giá trước khi chạy, không tự nâng điểm để đủ phát hành.
4. Luyện ngân hàng thật qua 5/10/20/toàn bộ, retry mạng, giữ thư mục, tổng điểm; kiểm tra ôn ngắt quãng dừng đúng số thẻ. Luyện toàn bộ hiện không lưu phiên xuyên lần tải lại trang; cần cân nhắc lưu tiếp tục trước khi mở ngân hàng rất lớn.
5. Hoàn tất cấu hình Drive và cơ chế tải kiểm tra quyền phía server theo resourceKey; giữ locator/credential ở server; chạy tải thành viên, từ chối khách và tài liệu thu hồi. Không công khai folder chỉ để làm nút tải hoạt động.
6. Chỉ phát hành khi không còn lỗi chặn, preview đạt và kiểm thử người dùng đăng nhập thành công; ghi exact SHA, build, deployment và phương án quay về revision trước.

Điểm dừng: bản sửa local đã build PASS. Không có deployment mới, không promote production, không thay đổi database hoặc quyền Drive trong phiên này.
