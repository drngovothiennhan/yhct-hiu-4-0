# DEPRECATED FOR AI ARCHITECTURE

> A.I instructions in this file are historical and MUST NOT override `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`. In particular, A.I Mini is now the application assistant; deep academic/research flows belong to Trung tâm nghiên cứu.

# FINAL 4.0 · Module Isolation Execution Prompt

## Vai trò
Bạn là Principal Full-Stack Architect, Release Engineer và QA Auditor của YHCT HIU 4.0. Đây là hệ thống FINAL đã đủ tính năng. Mục tiêu không phải thêm kiến trúc tùy ý mà là khóa ranh giới module để mọi cập nhật sau này có blast radius nhỏ nhất, không làm hỏng module khác.

## Cấu trúc module FINAL bắt buộc
1. Bảng tin học thuật
2. Trung tâm nghiên cứu
3. Tường cá nhân — Inbox không còn là module cấp cao; Inbox là icon có badge chưa đọc và dialog riêng bên trong Tường cá nhân
4. Gia Viên Dược Thảo
5. Thông báo
6. Lịch hoạt động
7. Điểm hoạt động
8. Luyện thi ĐGNL
9. Điều hành — chỉ Admin/Super Mod/Mod theo RBAC; tuyệt đối không chứa tính năng thay đổi theme
10. ACC hệ thống — chỉ Admin; giữ đầy đủ tính năng. Toàn bộ điều khiển theme nằm tại đây, hiển thị dạng khối gọn, giữ nguyên số lượng theme hiện có

## Nguyên tắc cô lập
- Mỗi module phải là lazy-loaded feature boundary và có error boundary riêng.
- Build phải sinh chunk độc lập theo module; Inbox được phép là sub-chunk của Tường cá nhân.
- Không module nào được gọi trực tiếp UI nội bộ của module khác. Shared infrastructure chỉ gồm auth/RBAC, Supabase transport, theme global, telemetry và design tokens.
- Theme là cross-cutting concern duy nhất về giao diện: Admin thay đổi ở ACC, toàn hệ thống chỉ nhận state theme đồng bộ.
- Route cũ `/messages` phải tương thích ngược bằng cách chuyển vào `/profile?inbox=1`.
- Mỗi thay đổi kiến trúc phải có acceptance gate để ngăn tái xuất hiện Inbox top-level hoặc theme selector trong Điều hành.

## PWA
- Tạo mục Cài đặt dùng được trên desktop/mobile.
- Bắt sự kiện `beforeinstallprompt`, lưu deferred install prompt và gọi prompt thật khi người dùng chọn “Cài ứng dụng”.
- Theo dõi `appinstalled` và `display-mode: standalone`.
- Manifest phải có `id`, `start_url`, `scope`, `display: standalone`, icon, shortcuts và không ưu tiên native app.
- Service Worker phải tiếp tục offline-first và được bump cache version khi release.
- Không giả lập bằng việc chỉ tạo bookmark/lối tắt URL.

## OpenAlex + A.I
- Historical section only. For current AI role boundaries, follow `docs/AI_CANONICAL_ARCHITECTURE_2026-09-11.md`.

## Release gate
Trước khi merge production bắt buộc chạy: source acceptance, RBAC audit, module-isolation audit, simulation, account layout audit, AI audit, Central RAG audit, TypeScript, Vite build và Google Chrome smoke mobile + desktop. Chỉ merge khi toàn bộ PASS; sau đó chờ Vercel READY + production alias bind và chạy lại Chrome production smoke.
