import type { AcademicPost,Member } from '../types';
export const initialMembers:Member[]=[{id:'m1',studentCode:'YHCT00001',fullName:'Nguyễn Minh Chủ nhiệm',email:'admin@hiu.vn',phone:'0900000001',role:'admin',title:'Chủ nhiệm CLB',status:'approved',reputation:96,totalPoints:420},{id:'m2',studentCode:'YHCT00002',fullName:'Trần An Nhiên',email:'annhien@hiu.vn',phone:'0900000002',role:'super_mod',title:'Phó Chủ nhiệm Thường trực',status:'approved',reputation:88,totalPoints:315},{id:'m3',studentCode:'YHCT00003',fullName:'Lê Minh Khang',email:'khang@hiu.vn',phone:'0900000003',role:'member',title:'Hội viên',status:'approved',reputation:71,totalPoints:126}];
// Production runtime must never display synthetic academic content when the authoritative feed is unavailable.
// Keep demo members for isolated development fixtures, but start the production feed empty and hydrate only from Supabase/server sync.
export const initialPosts:AcademicPost[]=[];
