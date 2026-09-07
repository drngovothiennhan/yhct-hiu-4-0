export type SystemRole = 'guest'|'member'|'mod'|'super_mod'|'leader'|'admin';
export type MemberStatus = 'approved'|'pending'|'suspended';
export type AppointmentTitle = 'Chủ nhiệm CLB'|'Phó Chủ nhiệm Thường trực'|'Phó Chủ nhiệm'|'Trưởng Ban Chuyên môn'|'Trưởng Ban Học thuật'|'Trưởng Ban Dược liệu'|'Cố vấn Học thuật'|'Hội viên';
export type ExamMode = 'practice'|'mock';
export type ExamDomain = 'Lý luận cơ bản YHCT'|'Nội - Ngoại - Phụ - Nhi YHCT'|'Châm cứu - Dưỡng sinh - Xoa bóp bấm huyệt'|'Dược lý Cổ truyền & Phương tễ học'|'Y đức - Pháp luật - An toàn người bệnh';
export type ScheduleKind = 'herb_garden'|'clinic'|'club';
export type ScheduleVisibility = 'public'|'members'|'assignees';
export type ScheduleStatus = 'scheduled'|'completed'|'cancelled';
export interface Branding { owner:string; faculty:string; platformName:string; subtitle:string; logoUrl:string; defaultAdminTitle:AppointmentTitle; }
export interface Member { id:string; studentCode?:string; fullName:string; email?:string; phone?:string; role:SystemRole; title:AppointmentTitle; status:MemberStatus; reputation:number; totalPoints:number; avatarUrl?:string; departmentSlug?:string; elementRank?:string; loginEnabled?:boolean; dataConflict?:boolean; }
export interface Appointment { id:string; memberId:string; title:AppointmentTitle; role:SystemRole; appointedBy:string; appointedAt:string; note?:string; active:boolean; }
export interface ScoreTransaction { id:string; memberId:string; points:number; reason:string; createdAt:string; actorId:string; reversible:boolean; reversedAt?:string; }
export interface FourExams { vong:string; van:string; vanHoi:string; thiet:string; }
export interface AcademicPost { id:string; author:Member; title:string; chiefComplaint:string; fourExams:FourExams; eightPrinciples:string[]; syndrome:string; treatmentPrinciple:string; formula?:string; acupoints?:string[]; citations:string[]; tags:string[]; createdAt:string; modVerified:boolean; likes:number; agrees:number; comments:number; bookmarked?:boolean; followingAuthor?:boolean; }
export interface ExamQuestion { id:string; domain:ExamDomain; topic:string; stem:string; options:string[]; correctIndex:number; explanation:string; classicalCitation:string; modernReference?:string; difficulty:'basic'|'intermediate'|'advanced'; }
export interface ExamAnswer { questionId:string; selectedIndex:number|null; correct:boolean; topic:string; domain:ExamDomain; }
export interface ExamResult { id:string; mode:ExamMode; score100:number; passed:boolean; startedAt:string; submittedAt:string; answers:ExamAnswer[]; weakTopics:string[]; aiAdvice?:string; }
export interface VersionManifest { version:string; build:string; minimumNativeVersion:string; contentBundleUrl:string; sha256:string; playStoreUrl:string; releaseNotes:string; }
export interface ActivitySchedule { id:string; kind:ScheduleKind; title:string; startsAt:string; endsAt:string; location:string; visibility:ScheduleVisibility; status:ScheduleStatus; notes:string; createdBy?:string; createdAt?:string; updatedAt?:string; assigneeIds:string[]; pendingSync?:boolean; }
export interface ScheduleDraft { id?:string; kind:ScheduleKind; title:string; startsAt:string; endsAt:string; location:string; visibility:ScheduleVisibility; notes:string; assigneeIds:string[]; }
export const ROLE_LEVEL:Record<SystemRole,number>={guest:0,member:1,mod:2,super_mod:3,leader:4,admin:5};
export const roleAtLeast=(role:SystemRole|undefined,min:SystemRole)=>ROLE_LEVEL[role||'guest']>=ROLE_LEVEL[min];
export const roleLabel:Record<SystemRole,string>={guest:'Khách',member:'Hội viên',mod:'Ban quản lý',super_mod:'Phó Chủ nhiệm',leader:'Ban Chủ nhiệm',admin:'Chủ nhiệm CLB'};
export const BRANDING:Branding={owner:'Trường Đại Học Quốc Tế Hồng Bàng',faculty:'Khoa Y',platformName:'YHCT HIU 4.0',subtitle:'Mạng xã hội Học thuật & Luyện thi Y học Cổ truyền',logoUrl:'/yhct-system-mark.svg',defaultAdminTitle:'Chủ nhiệm CLB'};
