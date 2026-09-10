/** Explicit navigation only: mentioning a module inside a question is not a command. */
export function aiNavigationTarget(raw:string):{path:string;label:string}|null{
 const text=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim().replace(/[.!?]+$/,'');
 const match=text.match(/^(?:hay |vui long )?(?:mo|vao|di den) (.+)$/);if(!match)return null;
 const routes:Record<string,{path:string;label:string}>={
  'game':{path:'/garden',label:'Game YHCT'},'gia vien':{path:'/garden',label:'Gia Viên'},
  'hiu y quan':{path:'/garden',label:'khu Game HIU Y Quán'},'gia vien duoc thao':{path:'/garden',label:'Gia Viên Dược Thảo'},
  'luyen thi':{path:'/exam',label:'Luyện thi'},'trung tam nghien cuu':{path:'/research',label:'Trung tâm nghiên cứu'},
  'lich clb':{path:'/schedule',label:'Lịch CLB'},'ca nhan':{path:'/profile',label:'Cá nhân'},
  'thong bao':{path:'/notifications',label:'Thông báo'},'bang tin':{path:'/',label:'Bảng tin'}
 };return routes[match[1].replace(/\s*[-–]\s*/g,' ').replace(/\s+/g,' ')]||null;
}
