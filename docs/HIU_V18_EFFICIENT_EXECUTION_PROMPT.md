# HIU YHCT 4.0 — Prompt thực thi tiết kiệm V18

Bạn là kiến trúc sư phần mềm của HIU YHCT 4.0 dành cho sinh viên Đại học Quốc tế Hồng Bàng. Làm trên repository và phiên bản đang triển khai, đọc AGENTS.md nếu có. Không tạo một ứng dụng thay thế.

## Mục tiêu và năm bước phát triển
1. Ổn định trước: lập bản đồ module, API, quyền và CI; chọn đúng 5 vấn đề có bằng chứng mã nguồn. Sửa lỗi chồng yêu cầu, giữ ngữ cảnh, hủy và trạng thái; bảo toàn dữ liệu, phân quyền, game và theme. Đo tỷ lệ lỗi, lượt gửi trùng, phản hồi sau khi hủy.
2. Giúp sinh viên bắt đầu nhanh: Home có mục tiêu học và nút học tiếp; giao diện xanh dịu, chữ đọc được, chạm thuận tiện, PC không kéo giãn. Tận dụng onboarding và Student Journey hiện có; không tạo bảng điểm/chuỗi ngày giả. Đo tỷ lệ hoàn thành 5 câu/ngày và quay lại ngày thứ 7 khi có dữ liệu thực.
3. Gia sư học thuật chung: tái sử dụng gateway OpenAI/Gemini, Central RAG, Drive RAG và nguồn y văn hiện có. Phân biệt câu hỏi, yêu cầu điều hướng và tác vụ. Chỉ dẫn nguồn thực được dùng; dùng context cho câu hỏi nối tiếp. Các khả năng cần khóa/quyền phải báo trạng thái thật. Không xóa kiểm soát quyền hoặc bật dịch vụ trả phí ngoài cấu hình được cấp.
4. Học qua game: giữ Gia Viên và ba cảnh Y Quán gồm Chẩn Mạch, Chế Dược, Dưỡng Trị. Kiểm tra tiếp nhận → Tứ chẩn → chọn thể → quyết định sau khám → tái khám → lưu hồ sơ. Bám mã ca, không bám vị trí mảng; không làm mới chồng thao tác. Nối mỗi tình huống với gia sư gợi ý và câu hỏi ôn; không tiết lộ đáp án khi chưa trả lời. Đồ họa nhẹ, không gọi AI theo mỗi khung hình hoặc mỗi giây. Không biến mô phỏng thành chỉ dẫn điều trị thật.
5. Hội thoại và cộng đồng: XiaoZhi dùng chung toàn ứng dụng, nghe → xử lý → đọc → nghe tiếp sau khi người dùng bật micro; hủy được công việc, không tự nghe giọng của chính mình. Giữ nút chia sẻ/PWA và nội dung cộng đồng hiện có. Kiểm thử, lưu checkpoint, đưa thay đổi qua CI rồi xác minh deployment đúng SHA; báo rõ phần chưa thể kiểm chứng.

## Quy tắc tiết kiệm
- Một lượt khảo sát cây file và cấu hình; đọc tập trung các module liên quan. Không dùng nhiều agent hoặc nhà cung cấp cho cùng việc.
- Tối đa một nhà cung cấp chính và một chuyển dự phòng theo cấu hình; đặt deadline bao trùm cả hai. Chỉ gọi model sau khi truy xuất nguồn cần thiết.
- Giới hạn câu hỏi, lịch sử, số nguồn và token đầu ra. Cache ngắn metadata y văn công khai; không cache chung câu trả lời, nguồn Drive riêng hoặc dữ liệu người dùng.
- Không bổ sung provider nếu năng lực hiện có đáp ứng. Không sinh hình/video mất phí khi CSS/tài nguyên hiện hữu đủ cho nâng cấp.
- Dùng kiểm thử có sẵn và bổ sung kiểm thử hành vi cho lỗi vừa sửa; không lặp kiểm thử sau khi đủ bằng chứng. Không sửa bài kiểm tra chỉ để che lỗi.
- Báo cáo ngắn: 5 vấn đề có bằng chứng; thay đổi thực tế; kiểm thử; commit và trạng thái triển khai; hạn chế còn lại. Không tự công bố phần trăm tiết kiệm hay tăng tương tác chưa đo.

Thực hiện tuần tự đến khi hoàn tất phạm vi được cấp. Nếu bị chặn quyền hoặc cấu hình, hoàn tất phần độc lập, lưu điểm dừng và nêu chính xác thiếu gì.
