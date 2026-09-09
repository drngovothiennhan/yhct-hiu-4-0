# AI Platform Module v1

## Mục tiêu

YHCT HIU 4.0 dùng một lớp điều phối A.I chung thay vì để từng màn hình tự quản provider, timeout và trạng thái degraded. Các Copilot chuyên biệt vẫn giữ nghiệp vụ riêng nhưng gọi cùng gateway, cùng registry và cùng chính sách an toàn.

## Kiến trúc

```text
src/modules/ai/
├─ core/
│  └─ gateway.ts
├─ providers/
│  └─ registry.ts
├─ ops/
│  └─ health.ts
└─ index.ts
```

Các Copilot chính:
- Unified A.I Mini: trợ lý chung, Drive RAG, Central RAG, OpenAlex, dịch, hành động tài khoản có xác nhận.
- Research A.I Mini: y văn, Drive/OpenAlex, đề tài, dịch và thuyết minh nghiên cứu.
- Exam A.I Tutor: hướng dẫn suy luận và phân tích lỗ hổng ôn tập, không tiết lộ đáp án trước khi chọn.

## Quy tắc runtime

1. Cloud là một provider, không phải điểm lỗi duy nhất của sản phẩm.
2. Nếu cloud lỗi hoặc timeout, UI phải chuyển sang fallback đúng ngữ cảnh thay vì hiển thị prompt kỹ thuật/generic provider error cho người học.
3. Research/Exam không cấp function tools nếu không cần để giảm độ trễ và bề mặt lỗi.
4. Gateway không ghi prompt hoặc secret vào telemetry. Chỉ ghi failure class, mode, role, latency và số nguồn/tool.
5. Provider secret luôn server-side; BYOK chỉ lưu trong browser session theo thiết kế hiện tại.
6. Health/Operations chỉ hiển thị readiness và capability, không hiển thị secret.

## Provider đang áp dụng

OpenAI Cloud Runtime, Browser Local A.I, Gemini BYOK (tùy chọn), Central YHCT RAG, Drive RAG, OpenAlex, PubMed và ClinicalTrials.gov.

## 5 adapter 0đ được đăng ký ở trạng thái candidate

- Semantic Scholar: tìm bài, metadata/citation graph và recommendations.
- Europe PMC: tìm y văn khoa học sự sống, PubMed/preprint và liên kết full text khi có.
- Crossref REST: DOI, metadata, references và chuẩn hóa định danh.
- OpenCitations: citation/reference graph mở.
- Unpaywall: tìm bản toàn văn Open Access hợp pháp theo DOI/tựa bài.

`0đ` ở đây là không bắt buộc mua license/cài đặt trả phí để bắt đầu dùng public/free access. Internet/data mạng vẫn do người dùng hoặc hạ tầng chi trả theo nhà cung cấp; mỗi dịch vụ có rate limit, điều khoản và khả năng thay đổi riêng. Không coi public API là tài nguyên vô hạn.

## A.I Operations

Admin Control Center có A.I Operations để xem:
- provider đang active/candidate;
- cloud readiness và model;
- Central RAG readiness;
- Structured Outputs, function calling, RBAC, read-only tools;
- evidence sources;
- danh sách adapter 0đ có thể tích hợp tiếp.

Panel không đọc hoặc render API key/token.
