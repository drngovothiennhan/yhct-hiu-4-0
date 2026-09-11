# AI Platform Module v1 — Historical Design

> This document is retained for history. Current AI role boundaries and provider routing are defined only in `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`.

## Mục tiêu

YHCT HIU 4.0 dùng một lớp điều phối A.I chung thay vì để từng màn hình tự quản provider, timeout và trạng thái degraded. Các capability chuyên biệt vẫn giữ nghiệp vụ riêng nhưng gọi cùng policy/gateway hiện hữu.

## Kiến trúc lịch sử

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

## Vai trò hiện hành
- A.I Mini/XiaoZhi: Trợ lý ứng dụng, không phải Research AI và không tự bật Drive/Central/OpenAlex/PubMed.
- Research A.I: nằm trong Trung tâm nghiên cứu; chỉ nơi này xử lý y văn/học thuật chuyên sâu và tùy chọn tài liệu nội bộ.
- Exam Tutor/Quiz Designer: capability theo module, không tạo chatbot/provider UI mới.

## Quy tắc runtime còn hiệu lực

1. Cloud là một provider, không phải điểm lỗi duy nhất của sản phẩm.
2. Nếu cloud lỗi hoặc timeout, UI phải chuyển sang fallback đúng ngữ cảnh thay vì hiển thị prompt kỹ thuật/generic provider error cho người học.
3. Research/Exam không cấp function tools nếu không cần để giảm độ trễ và bề mặt lỗi.
4. Gateway không ghi prompt hoặc secret vào telemetry. Chỉ ghi failure class, mode, role, latency và số nguồn/tool.
5. Provider secret luôn server-side.
6. Health/Operations chỉ hiển thị readiness và capability, không hiển thị secret.

## Provider

Provider và nguồn là implementation details; không được biến thành các module/nút A.I ngang hàng trên UI. Xem canonical architecture để biết routing hiện hành.

## A.I Operations

Admin Control Center có A.I Operations để xem readiness, capability, model/provider state, privacy/degraded status và contract health. Panel không đọc hoặc render API key/token.
