import {supabase} from './authService';

export const VISIBLE_NOTIFICATION_LIMIT=5;

export type NotificationRow={
  id:string;
  kind:string;
  title:string;
  body:string;
  post_id?:string|null;
  read_at?:string|null;
  created_at:string;
};

export async function fetchRecentNotifications(memberId:string){
  const {data,error}=await supabase
    .from('notifications')
    .select('id,kind,title,body,post_id,read_at,created_at')
    .eq('member_id',memberId)
    .order('created_at',{ascending:false})
    .limit(VISIBLE_NOTIFICATION_LIMIT);
  if(error)throw error;
  return (data||[]) as NotificationRow[];
}

export async function fetchUnreadNotificationCount(memberId:string){
  const {count,error}=await supabase
    .from('notifications')
    .select('id',{count:'exact',head:true})
    .eq('member_id',memberId)
    .is('read_at',null);
  if(error)throw error;
  if(typeof count!=='number')throw new Error('Không thể xác định số thông báo chưa đọc');
  return count;
}

export async function markNotificationRead(notificationId:string){
  const {data,error}=await supabase.rpc('notifications_mark_read_v1',{p_notification_id:notificationId});
  if(error)throw error;
  return data===true;
}

export async function markAllNotificationsRead(){
  const {data,error}=await supabase.rpc('notifications_mark_all_read_v1');
  if(error)throw error;
  const touched=Number(data);
  if(!Number.isFinite(touched)||touched<0)throw new Error('Phản hồi cập nhật thông báo không hợp lệ');
  return touched;
}
