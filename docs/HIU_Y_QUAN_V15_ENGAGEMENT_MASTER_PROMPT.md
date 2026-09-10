# MASTER PROMPT — HIU Y QUÁN V15 ENGAGEMENT LOOP

## Vai trò
Bạn là Principal Game Systems Engineer, Full-Stack Architect, Database Engineer, UI/UX Lead và QA/DevSecOps Engineer của HIU YHCT 4.0.

## Mục tiêu
Nâng cấp HIU Y Quán từ vòng chơi khám–dưỡng trị thành vòng tương tác hằng ngày hấp dẫn sinh viên YHCT bằng 5 hệ thống: (1) Thử thách Tủ thuốc 60 giây, (2) Ca trực mỗi ngày, (3) Phòng khám đông khách tự chọn, (4) Hội chẩn HIU cộng đồng, (5) Bộ sưu tập/mastery Danh y–Dược liệu.

## Nguyên tắc bất biến — ZERO REGRESSION
1. Additive-first. Không xóa dữ liệu, không đổi ý nghĩa dữ liệu cũ, không phá API/RPC V11–V14.
2. Không sửa logic chấm `hiu_y_quan_submit_v1`, lịch hẹn V2, Dưỡng Trị V14 hoặc tín dụng Gia Viên hiện hữu.
3. Không thêm Vercel Serverless Function. Ngân sách phải giữ <=12/12; ưu tiên Supabase RPC và component client hiện hữu.
4. Mọi trạng thái có điểm, chuỗi ngày, kết quả thử thách, hội chẩn và mở khóa phải được xác thực ở server; client chỉ hiển thị và gửi lựa chọn.
5. Khi V15 lỗi hoặc chưa có migration, HIU Y Quán V14 vẫn phải chơi được. Mọi UI V15 phải có error boundary/fallback cục bộ, không được làm crash game cốt lõi.
6. Mốc ngày dùng `Asia/Ho_Chi_Minh`; thao tác nhận thưởng phải idempotent và chống nhận lặp.
7. Không dùng bệnh án thật, dữ liệu nhận dạng người bệnh hoặc ngôn ngữ “cấp cứu/triage” trong chế độ đông khách. Tất cả ca là mô phỏng giáo dục.
8. Không đưa liều dùng/kê đơn/phác đồ cá nhân vào gameplay. Nội dung dược liệu dùng catalog đã kiểm chứng của V14; game không hiển thị chú thích nguồn theo yêu cầu sản phẩm.
9. Nếu gặp điểm nghẽn, ưu tiên xây bảng/RPC/component/fallback mới hoặc mở rộng constraint theo hướng tương thích ngược; không “sửa tắt” vào phần ổn định.
10. Mọi thay đổi phải qua build, contract checks, Chrome smoke, responsive matrix, kiểm tra quyền RPC và production smoke trước khi coi là hoàn tất.

## Hệ thống 1 — Tủ thuốc 60 giây
- Một thử thách chính thức/ngày/thành viên, thời lượng 60 giây server-authoritative.
- 8 câu từ 12 vị thuốc V14, hỏi luân phiên Tính vị / Quy kinh / Công năng.
- 4 lựa chọn/câu, đáp án không được gửi dưới dạng trường `correct` trước khi trả lời.
- Server chấm từng câu; combo tăng khi đúng và reset khi sai.
- Kết thúc khi hết 60 giây hoặc hoàn thành 8 câu.
- Điểm đúng cập nhật mastery dược liệu; không phát tín dụng Gia Viên.

## Hệ thống 2 — Ca trực mỗi ngày
Ba nhiệm vụ ổn định theo ngày Việt Nam:
- Chẩn đúng >=2 ca HIU Y Quán trong ngày.
- Hoàn tất/cho về >=1 ca trong ngày.
- Hoàn thành thử thách Tủ thuốc với >=3 câu đúng.

Khi đủ 3 nhiệm vụ, cho phép nhận 25 XP một lần. Chuỗi ngày chỉ tăng khi nhận thưởng; bỏ lỡ ngày thì chuỗi bắt đầu lại. Không cộng tiền/tín dụng.

## Hệ thống 3 — Phòng khám đông khách
- Chế độ tự chọn, không phải triage.
- Khi kích hoạt trong giờ hiện tại, thêm tối đa một ca mô phỏng thứ ba (`ordinal=3`) nếu chưa có; thao tác idempotent.
- Mở rộng constraint ordinal từ 1–2 lên 1–3 là thay đổi tương thích ngược; V14 vẫn tự sinh 1–2 ca như cũ.
- Ca bổ sung dùng cùng bảng `hiu_y_quan_cases`, cùng RPC chẩn thể và cùng vòng Dưỡng Trị V14; không tạo pipeline song song.
- Không thay đổi thưởng chẩn đúng hiện hữu.

## Hệ thống 4 — Hội chẩn HIU
- Mỗi ngày có đúng một ca mô phỏng dùng chung, xác định deterministic từ catalog thể bệnh hiện hữu.
- Trước khi người dùng bỏ phiếu: chỉ trả Tứ chẩn + 4 phương án; không trả đáp án, giải thích hoặc phân bố cộng đồng.
- Mỗi thành viên bỏ phiếu một lần/ngày.
- Sau bỏ phiếu: mới trả đáp án chuẩn, giải thích, lựa chọn của người dùng và phân bố phiếu cộng đồng.
- Một lần bỏ phiếu hợp lệ/ngày có thể cộng XP nhỏ, nhưng phải idempotent và không liên quan tín dụng Gia Viên.

## Hệ thống 5 — Bộ sưu tập & mastery
- Mastery tách biệt với ví Gia Viên.
- Dược liệu: tăng qua câu đúng trong Thử thách 60 giây.
- Thể bệnh: đồng bộ an toàn từ các lần chẩn đúng hiện hữu và Hội chẩn HIU.
- Cấp thẻ theo ngưỡng điểm, tối đa mức 4; cung cấp danh hiệu/cosmetic trong V15 trước, không ghi trực tiếp vào inventory Gia Viên.
- Collection phải có thể đọc lại sau đăng nhập và không phụ thuộc localStorage.

## Kiến trúc triển khai
- Bảng mới: engagement profile, herb challenge session, mastery, daily reward, consult vote.
- RLS bật; không cấp quyền đọc/ghi trực tiếp cho `anon`/`authenticated`; chỉ thao tác qua RPC SECURITY DEFINER có `set search_path=''` và kiểm tra `private.current_member_id()` + `private.is_approved()`.
- RPC V15 đề xuất:
  - `hiu_y_quan_engagement_v15()`
  - `hiu_y_quan_herb_challenge_start_v15()`
  - `hiu_y_quan_herb_challenge_answer_v15(uuid,integer)`
  - `hiu_y_quan_daily_claim_v15()`
  - `hiu_y_quan_busy_shift_v15()`
  - `hiu_y_quan_consult_today_v15()`
  - `hiu_y_quan_consult_vote_v15(text)`
  - `hiu_y_quan_collection_v15()`
- Frontend V15 đặt trong component riêng `HiuYQuanEngagementV15.tsx`; lỗi V15 không được lan sang `HiuYQuanGame`.
- Tích hợp qua wrapper `HerbGardenGame.tsx`. Khi bật ca đông khách, remount riêng HIU Y Quán bằng key/callback để nạp ca mới mà không sửa logic game V14.
- CSS V15 độc lập, mobile-first, không dùng `100vh/100dvh`, không kéo dãn PC.

## Definition of Done
- 5 hệ thống trên chạy thật với dữ liệu server, không placeholder.
- Không có API route Vercel mới; budget 12/12 được giữ.
- V11–V14 contract vẫn PASS.
- V15 contract kiểm tra schema, ACL, timer 60 giây, idempotency, hidden answer, daily missions, consult gating, busy-shift max 3 và integration isolation.
- TypeScript/Vite build PASS; Chrome + responsive QA PASS.
- Supabase migration production áp dụng thành công; anon không gọi RPC V15, authenticated được gọi đúng các RPC dành cho thành viên.
- Deploy production READY, `/api/health` 200, không có 5xx mới.

## Chế độ thực thi
Không dừng ở kế hoạch. Tự triển khai, tự phát hiện blocker, dùng phương án xây mới/tương thích ngược để vượt blocker mà không làm hỏng dự án, chạy QA, merge và deploy khi tất cả gate đều PASS.