# Runbook bật AI Credits (quà ra mắt 01/10/2026)

Làm theo thứ tự. Mỗi bước có cách kiểm tra và cách lùi. Không bước nào xóa dữ liệu.

## 0. Điều kiện trước

- PR `claude/ai-credit-ledger` đã qua CI (kể cả `npm run build`) và được merge theo quy trình của dự án.
- Đã quyết định các con số: số tín dụng quà tặng, bảng giá `cost` / `free_daily` (xem `docs/AI_CREDITS_V1.md`).

## 1. Áp migration (Supabase SQL editor hoặc pipeline migration)

Chạy file `supabase/migrations/202609301700_ai_credit_ledger_v1.sql`. File chạy lại được nhiều lần (idempotent). Kiểm tra:

```sql
select enforce from private.ai_credit_settings_v1;                       -- phải là false
select capability, cost, free_daily from private.ai_credit_policy_v1 order by 1;
select campaign, amount, enabled from private.ai_credit_campaign_v1;    -- enabled = false
```

Lùi: không cần, bảng và hàm mới không ảnh hưởng gì khi công tắc còn tắt.

## 2. Chỉnh số liệu theo quyết định của chủ sản phẩm

```sql
update private.ai_credit_campaign_v1
   set amount = 50,                 -- số tín dụng quà tặng
       credit_valid_days = 180      -- hạn dùng (ngày)
 where campaign = 'launch-2026-10-01';

update private.ai_credit_policy_v1 set cost = 1, free_daily = 20 where capability = 'assistant_fast';
-- lặp lại cho các capability khác nếu muốn đổi
```

## 3. Bật chiến dịch quà tặng (chưa bật thu phí)

```sql
update private.ai_credit_campaign_v1 set enabled = true where campaign = 'launch-2026-10-01';
```

Trên Vercel đặt biến môi trường `ENABLE_AI_CREDITS=true` rồi deploy lại. Khi đó thành viên mở Trung tâm AI sẽ tự nhận quà. Số dư chỉ hiển thị sau bước 4, vì giao diện ẩn cho tới khi `enforce = true`.

Kiểm tra:

```sql
select count(*) as da_nhan, sum(initial) as tong_tin_dung
from private.ai_credit_lot_v1 where source = 'campaign' and ref = 'launch-2026-10-01';
```

## 4. Bật trừ tín dụng (chỉ khi đã sẵn sàng)

```sql
update private.ai_credit_settings_v1 set enforce = true where id;
```

Từ lúc này: mỗi lượt AI dùng hết lượt miễn phí trong ngày sẽ trừ tín dụng; hết tín dụng thì trả mã `402`. Admin không bị tính.

Theo dõi vài ngày đầu:

```sql
select capability, kind, count(*), sum(delta)
from private.ai_credit_ledger_v1
where created_at > now() - interval '1 day'
group by 1, 2 order by 1, 2;
```

## 5. Lùi nhanh (an toàn, không mất dữ liệu)

Tắt trừ tín dụng ngay, không cần deploy:

```sql
update private.ai_credit_settings_v1 set enforce = false where id;
```

Tắt hoàn toàn: xóa biến `ENABLE_AI_CREDITS` trên Vercel rồi deploy lại. Sổ cái và số dư được giữ nguyên để bật lại sau.

## Lưu ý

- Tín dụng là điểm sử dụng, không rút thành tiền, không chuyển nhượng.
- Tặng thủ công cho một người (hỗ trợ, cuộc thi) trong SQL editor (chạy bằng quyền chủ dự án; hàm `ai_credit_admin_grant_v1` chỉ dùng được khi gọi từ tài khoản admin đã đăng nhập, không dùng được trong SQL editor):

```sql
with lot as (
  insert into private.ai_credit_lot_v1(user_id, source, ref, initial, remaining, expires_at)
  values ('<uuid người dùng>', 'grant', 'ly-do-duy-nhat', 20, 20, now() + interval '90 days')
  on conflict do nothing
  returning user_id, initial
)
insert into private.ai_credit_ledger_v1(user_id, kind, delta, ref)
select user_id, 'grant', initial, 'grant:ly-do-duy-nhat' from lot;
```
- XP linh thú là hệ thống riêng, không nằm trong runbook này.
- Mua tín dụng bằng tiền (VietQR/Google Play Billing) chưa có; sẽ làm ở PR riêng.
