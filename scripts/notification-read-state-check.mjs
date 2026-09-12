import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const app=read('src/App.tsx');
const center=read('src/components/notifications/NotificationsCenter.tsx');
const service=read('src/services/notificationService.ts');
const migration=read('supabase/migrations/202609120150_notification_read_state_rpc_v1.sql');

const checks=[
  ['recent list remains bounded to five',service.includes('VISIBLE_NOTIFICATION_LIMIT=5')&&service.includes('.limit(VISIBLE_NOTIFICATION_LIMIT)')],
  ['unread count is exact across all rows, not derived from visible list',service.includes("{count:'exact',head:true}")&&service.includes(".is('read_at',null)")&&!center.includes('items.filter(')],
  ['notification client never updates the table directly',!service.includes(".from('notifications').update")&&!center.includes(".from('notifications').update")],
  ['single-item read uses scoped RPC',service.includes("supabase.rpc('notifications_mark_read_v1'")&&migration.includes('where id=p_notification_id')&&migration.includes('and member_id=mid')],
  ['mark-all read uses current member scope only',service.includes("supabase.rpc('notifications_mark_all_read_v1'")&&migration.includes('where member_id=mid')&&migration.includes('and read_at is null')],
  ['RPCs authenticate approved member and expose execute only to authenticated',migration.match(/private\.current_member_id\(\)/g)?.length===2&&migration.match(/private\.is_approved\(\)/g)?.length===2&&migration.includes('revoke all on function public.notifications_mark_read_v1(uuid) from public,anon,authenticated')&&migration.includes('grant execute on function public.notifications_mark_read_v1(uuid) to authenticated')&&migration.includes('grant execute on function public.notifications_mark_all_read_v1() to authenticated')],
  ['App shell owns canonical unread state',app.includes('[notificationUnread,setNotificationUnread]')&&app.includes('fetchUnreadNotificationCount')&&app.includes('refreshNotificationUnread')],
  ['desktop and mobile notification navigation use canonical badge',app.match(/notification-nav-count/g)?.length===2&&app.match(/aria-label=\{notificationAria\}/g)?.length===2],
  ['notification center receives canonical count instead of recounting visible rows',app.includes('unreadCount={notificationUnread}')&&center.includes('unreadCount:number|null')&&center.includes('onUnreadRefresh:()=>Promise<number|null>')],
  ['read mutations reconcile exact count after server success',center.includes('await markNotificationRead(id)')&&center.includes('await markAllNotificationsRead()')&&(center.match(/await onUnreadRefresh\(\)/g)||[]).length>=2],
  ['unknown count is not misreported as zero',center.includes("unreadCount===null")&&center.includes('Đang đồng bộ số thông báo chưa đọc')],
  ['shell refreshes unread count while active',app.includes('setInterval(()=>void refreshNotificationUnread(),60000)')&&app.includes("document.visibilityState==='visible'")],
];

let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
if(failed){console.error(`Notification read-state contract failed: ${failed} check(s)`);process.exit(1)}
console.log('Notification read-state contract passed.');
