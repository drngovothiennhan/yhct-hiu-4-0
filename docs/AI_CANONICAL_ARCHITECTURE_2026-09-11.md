# HIU YHCT 4.0 — AI Canonical Architecture

Status: **SOURCE OF TRUTH — 2026-09-11**

Mọi agent/ChatGPT/Codex làm việc với repository này phải đọc tài liệu này trước khi thay đổi bất kỳ phần A.I nào. Nếu tài liệu cũ mâu thuẫn với tài liệu này, tài liệu này thắng.

## 1. Quyết định sản phẩm

HIU YHCT 4.0 không dùng mô hình “mỗi màn hình một A.I”. Hệ thống chỉ có ba vai trò A.I ở cấp sản phẩm:

### A. Trợ lý ứng dụng HIU YHCT 4.0 — A.I Mini / XiaoZhi
- Là lớp tương tác nhanh toàn hệ thống.
- Phục vụ hỏi đáp thông thường, điều hướng, giải thích tính năng, thông tin HIU, đời sống/sự kiện/công nghệ/giáo dục, thao tác ứng dụng an toàn và hội thoại giọng nói.
- Mặc định dùng Gemini + nguồn công khai/search khi cần thông tin ngoài hệ thống.
- Không tự biến thành A.I nghiên cứu, không tự chạy OpenAlex/PubMed/ClinicalTrials, không tự lấy Drive/Central RAG.
- Khi phát hiện câu hỏi học thuật/y văn/lâm sàng chuyên sâu: trả route `research` và chuyển người dùng sang Trung tâm nghiên cứu.
- XiaoZhi chỉ là voice shell của Trợ lý ứng dụng, không phải một kiến trúc A.I độc lập.

### B. Trung tâm nghiên cứu — Research A.I
- Là nơi duy nhất xử lý nghiên cứu/y văn/học thuật chuyên sâu.
- Có thể dùng Gemini làm reasoning leader và dùng PubMed/OpenAlex/ClinicalTrials.gov cùng các nguồn học thuật được phép.
- Tùy chọn `Dùng tài liệu nội bộ` mặc định OFF.
- Chỉ khi người dùng chủ động bật `Dùng tài liệu nội bộ` cho lượt nghiên cứu thì mới được nạp Drive/Central RAG vào request đó.
- Nội dung nội bộ không được gửi ra provider ngoài khi chưa có request-scoped consent.
- Phải giữ provenance/citation; không bịa DOI/PMID/tác giả/kết quả.

### C. A.I chuyên dụng theo module
Chỉ tồn tại khi có nghiệp vụ riêng và không tạo một chatbot mới:
- Exam Tutor: phân tích kết quả, gợi ý ôn tập; không lộ đáp án trước khi nộp.
- Quiz Designer/ACC: chuyển tài liệu đã chọn thành câu hỏi có evidence; tất cả câu A.I cần admin review trước khi nhập.
- Các module khác chỉ gọi capability qua service/gateway; không tự tích hợp provider riêng.

## 2. Bố cục UX bắt buộc

### Điều hướng cấp cao
Giữ module học tập/xã hội hiện có làm trung tâm. Không thêm menu top-level mới cho từng provider A.I.

### Điểm vào A.I
1. **A.I Mini**: một floating launcher duy nhất toàn app, có text + voice, kéo được nếu UI hiện tại hỗ trợ.
2. **Trung tâm nghiên cứu**: một module độc lập cho học thuật; bên trong mới có công tắc `Dùng tài liệu nội bộ`.
3. **ACC**: chỉ admin thấy `A.I Operations` để theo dõi readiness, provider, model, degraded mode, privacy gate, contract test; không hiển thị secret.

### Không được phép
- Không tạo thêm “Gemini AI”, “OpenAI AI”, “Drive AI”, “OpenAlex AI” thành nút/module ngang hàng.
- Không để A.I Mini có hàng loạt toggle nguồn làm người dùng phải hiểu kiến trúc backend.
- Không hiển thị provider như một tính năng sản phẩm; provider là chi tiết vận hành.

## 3. Luồng định tuyến chuẩn

```text
USER INPUT
   |
   v
INTENT ROUTER
   |
   +-- normal/app/public/HIU/voice --> APP ASSISTANT --> Gemini/public search --> answer
   |
   +-- research/medical-literature/deep-academic --> ROUTE TO RESEARCH CENTER
                                                     |
                                                     +-- internal OFF --> public academic sources + Gemini
                                                     +-- internal ON  --> Drive/Central RAG + public academic sources + Gemini
   |
   +-- module action --> module capability service --> confirmation/RBAC --> execute
```

Router phải deterministic-first bằng intent rules/contracts hiện có. Không thêm một LLM router mới nếu regex/rule hiện tại đủ đáp ứng.

## 4. Provider strategy

- Gemini: provider mặc định cho Trợ lý ứng dụng và reasoning leader của Research khi configured.
- Public search: phục vụ câu hỏi ngoài hệ thống và thông tin mới.
- OpenAI: chỉ dùng khi capability cụ thể đã được code và có lý do kỹ thuật rõ ràng; không song song Gemini vô mục đích.
- Drive/Central RAG: nguồn nội bộ, chỉ Research và các workflow admin được phép; opt-in theo request.
- OpenAlex/PubMed/ClinicalTrials: evidence sources cho Research, không phải chatbot riêng.
- Provider secret luôn server-side.

## 5. Một gateway, không nhiều gateway

Mọi capability A.I mới phải đi qua cùng policy layer cho:
- auth/RBAC;
- privacy consent;
- timeout/retry;
- provider selection;
- provenance;
- degraded mode;
- telemetry không chứa prompt/secret/private content;
- error normalization.

Nếu code hiện tại có nhiều đường gọi provider trực tiếp, ưu tiên hợp nhất dần vào gateway hiện hữu; không tạo gateway thứ hai.

## 6. Quy tắc phát triển để chấm dứt “AI sprawl”

Trước khi thêm A.I, agent phải trả lời 4 câu trong code review:
1. Capability này thuộc App Assistant, Research hay module-specific?
2. Có thể dùng gateway/capability hiện có không?
3. Nó có tạo thêm UI/provider toggle không cần thiết không?
4. Contract test nào ngăn regression?

Nếu không trả lời được đủ 4 câu: không triển khai.

## 7. Definition of Done cho A.I

Một thay đổi A.I chỉ hoàn tất khi:
- role boundary đúng;
- UI không thêm điểm vào dư thừa;
- privacy gate đúng;
- citation/provenance đúng khi có source;
- provider failure có degraded path rõ ràng;
- `npm run audit:ai` PASS;
- `npm run audit:ai-roles` PASS;
- `npm run audit:rag` PASS nếu đụng nguồn nội bộ;
- `npm run build` PASS;
- production deploy READY/success và smoke test không có runtime error.

Không được tiếp tục “tích hợp thêm A.I” sau khi các tiêu chí trên đã PASS nếu không có một use case người dùng cụ thể.

## 8. Roadmap thực thi

### Phase 0 — Freeze architecture
- Tài liệu này là source of truth.
- Đánh dấu prompt cũ mâu thuẫn là deprecated.
- Không thêm provider/capability trong phase này.

### Phase 1 — UX simplification
- Chỉ giữ một A.I Mini launcher toàn app.
- Trong Research giữ một khu vực A.I học thuật rõ ràng.
- Chỉ Research có `Dùng tài liệu nội bộ`.
- ACC gom toàn bộ trạng thái kỹ thuật A.I.

### Phase 2 — Runtime consolidation
- Audit tất cả direct provider calls.
- Di chuyển policy chung về gateway hiện hữu.
- Giữ endpoint public/app assistant và research tách role nhưng dùng cùng policy primitives.

### Phase 3 — Quality lock
- Mở rộng contract tests cho intent routing, internal-context consent, provenance, quiz admin review và degraded mode.
- Loại bỏ dead code/toggle/provider adapter không còn được route tới.

### Phase 4 — Product polish
- Tối ưu empty/loading/error/voice states.
- Đo latency, route accuracy, failure rate và số lần người dùng phải đổi module thủ công.
- Chỉ sau khi dữ liệu cho thấy thiếu capability mới xem xét bổ sung A.I.

## 9. MASTER EXECUTION PROMPT

```text
[SYSTEM / MASTER EXECUTION PROMPT — HIU YHCT 4.0 AI ARCHITECTURE LOCK]

Bạn là Principal AI Product Architect, Senior Full-Stack Engineer, Release Engineer và QA Lead của repository `drngovothiennhan/yhct-hiu-4-0`.

MỤC TIÊU
Chấm dứt việc tích hợp A.I chắp vá. Không thêm A.I vì có thể; chỉ giữ capability phục vụ use case rõ ràng. Tái cấu trúc theo kiến trúc chuẩn trong `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md` và xem đây là source of truth cao nhất cho mọi thay đổi A.I.

BẮT BUỘC TRƯỚC KHI SỬA
1. Đọc branch `main`, commit mới nhất, CI/Vercel status, `package.json`, các AI contract test và tài liệu canonical.
2. Không dựng lại app, không phá module đang ổn định, không đổi dữ liệu/game/feed/theme nếu không liên quan.
3. Nếu tài liệu cũ mâu thuẫn canonical thì canonical thắng; đánh dấu tài liệu cũ deprecated thay vì tiếp tục thực thi nó.

KIẾN TRÚC BẮT BUỘC
A. A.I Mini/XiaoZhi = Trợ lý ứng dụng:
- một launcher toàn hệ thống;
- text + voice;
- Gemini/public search mặc định cho câu hỏi thông thường;
- không tự dùng Drive/Central RAG/OpenAlex/PubMed cho nghiên cứu;
- gặp research intent thì route sang Trung tâm nghiên cứu.

B. Trung tâm nghiên cứu = Research A.I:
- xử lý y văn/học thuật chuyên sâu;
- Gemini reasoning + PubMed/OpenAlex/ClinicalTrials khi phù hợp;
- `Dùng tài liệu nội bộ` mặc định OFF;
- chỉ khi người dùng bật cho request hiện tại mới dùng Drive/Central RAG;
- bảo toàn provenance/citation và privacy consent.

C. Module-specific AI:
- Exam Tutor, Quiz Designer/ACC và capability nghiệp vụ chỉ tồn tại như service/capability;
- không tạo chatbot/provider UI mới.

UX
- Không thêm top-level AI module theo provider.
- Không thêm Gemini/OpenAI/OpenAlex/Drive thành các nút ngang hàng.
- Provider là chi tiết backend; người dùng chỉ thấy Trợ lý ứng dụng, Trung tâm nghiên cứu và capability nằm đúng ngữ cảnh.
- ACC chứa A.I Operations dành cho admin, không lộ secret.

CÁCH THỰC THI
Phase 1: audit UI + route + provider calls; lập danh sách keep/merge/remove.
Phase 2: đơn giản UX về đúng 3 vai trò.
Phase 3: hợp nhất policy vào gateway hiện hữu; không tạo gateway mới.
Phase 4: sửa contract tests cho role routing, internal-context consent, provenance, degraded mode, ACC quiz review.
Phase 5: chạy audit/build/smoke; chỉ merge khi PASS.

QUY TẮC KHÔNG LOAY HOAY
- Mỗi thay đổi phải gắn với một acceptance criterion cụ thể.
- Không mở thêm nhánh thử nghiệm nếu code hiện tại đã có hướng hợp lệ.
- Không đổi provider chỉ vì provider khác tồn tại.
- Không làm UI trước rồi mới tìm use case.
- Không tiếp tục refactor sau khi Definition of Done đã đạt.
- Khi gặp lỗi build/test/runtime, tự truy nguyên nhân, sửa và chạy tiếp; không dừng ở mô tả.

RELEASE GATE
Chạy tối thiểu:
`npm run audit:ai`
`npm run audit:ai-roles`
`npm run audit:rag` nếu đụng internal source
`npm run build`
Sau đó xác minh Vercel production success/READY và smoke test các luồng:
1. câu hỏi thường -> A.I Mini trả lời;
2. câu hỏi nghiên cứu -> route Research;
3. Research internal OFF -> không gửi internal context;
4. Research internal ON -> có consent và provenance;
5. Gemini lỗi -> degraded path rõ ràng;
6. quiz từ tài liệu -> admin review bắt buộc.

OUTPUT
Không viết báo cáo dài. Mỗi checkpoint chỉ nêu:
- Done
- Đang sửa
- Blocker thật sự nếu có
- Test/deploy status

Bắt đầu từ trạng thái repository hiện tại và thực thi liên tục đến khi toàn bộ gate PASS.
```
