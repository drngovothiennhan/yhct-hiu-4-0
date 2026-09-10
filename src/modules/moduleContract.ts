import type {SystemRole} from '../types';

export type ModuleId='feed'|'research'|'profile'|'garden'|'notifications'|'schedule'|'drl'|'exam'|'admin'|'acc';
export type ModuleDefinition={
  id:ModuleId;
  title:string;
  path:string;
  label:string;
  memberOnly:boolean;
  minRole?:SystemRole;
  featureScope:string;
};

export const MODULE_ISOLATION_VERSION='final4-modular-v1';

export const MODULES:Record<ModuleId,ModuleDefinition>={
  feed:{id:'feed',title:'My HIU YHCT',path:'/',label:'Trang chủ',memberOnly:false,featureScope:'student-home-academic-feed'},
  research:{id:'research',title:'Trung tâm nghiên cứu',path:'/research',label:'Trung tâm nghiên cứu',memberOnly:false,featureScope:'research-center'},
  profile:{id:'profile',title:'Tường cá nhân',path:'/profile',label:'Tường cá nhân',memberOnly:true,featureScope:'personal-wall-inbox'},
  garden:{id:'garden',title:'Gia Viên Dược Thảo',path:'/garden',label:'Gia Viên Dược Thảo',memberOnly:true,featureScope:'herb-garden'},
  notifications:{id:'notifications',title:'Thông báo',path:'/notifications',label:'Thông báo',memberOnly:true,featureScope:'notifications'},
  schedule:{id:'schedule',title:'Lịch hoạt động',path:'/schedule',label:'Lịch hoạt động',memberOnly:false,featureScope:'schedule'},
  drl:{id:'drl',title:'Điểm hoạt động',path:'/drl',label:'Điểm hoạt động',memberOnly:false,featureScope:'activity-score'},
  exam:{id:'exam',title:'Luyện thi ĐGNL',path:'/exam',label:'Luyện thi ĐGNL',memberOnly:false,featureScope:'exam-center'},
  admin:{id:'admin',title:'Điều hành',path:'/admin',label:'Điều hành',memberOnly:true,minRole:'mod',featureScope:'member-moderation'},
  acc:{id:'acc',title:'ACC hệ thống',path:'/acc',label:'ACC Hệ thống',memberOnly:true,minRole:'admin',featureScope:'system-operations'}
};

export const MODULE_ORDER:ModuleId[]=['feed','research','profile','garden','notifications','schedule','drl','exam','admin','acc'];
export const PUBLIC_MODULES=new Set<ModuleId>(MODULE_ORDER.filter(id=>!MODULES[id].memberOnly));
export const PATH_TO_MODULE=new Map<string,ModuleId>(MODULE_ORDER.map(id=>[MODULES[id].path,id]));

export function normalizeModulePath(pathname:string){const value=pathname.replace(/\/+$/,'')||'/';return value.startsWith('/')?value:`/${value}`}
export function moduleFromPath(pathname:string):ModuleId{const path=normalizeModulePath(pathname);if(path==='/messages')return'profile';return PATH_TO_MODULE.get(path)||'feed'}
export function modulePath(id:ModuleId){return MODULES[id].path}
