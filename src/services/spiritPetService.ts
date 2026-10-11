import {supabase} from './authService';

// Linh thú: đọc một chiều từ hồ sơ dùng chung trên máy chủ (HIU TMC).
// Chỉ đọc. Không lưu cục bộ, không khởi tạo hồ sơ, không nhận điểm từ trình duyệt.

export const SPIRIT_PET_SPECIES=['thanh_long','chu_tuoc','kim_su','ky_lan','ho_ly','khong_tuoc'] as const;
export type SpiritPetSpecies=typeof SPIRIT_PET_SPECIES[number];

const ASSET_BASE='https://hiutmc.com/spirit-pets/visual-v2/';
const ASSET_KEY:Record<SpiritPetSpecies,string>={
  thanh_long:'dragon',chu_tuoc:'phoenix',kim_su:'sphinx',ky_lan:'qilin',ho_ly:'fox',khong_tuoc:'peacock'
};
export const SPIRIT_PET_NAMES:Record<SpiritPetSpecies,string>={
  thanh_long:'Thanh Long',chu_tuoc:'Chu Tước',kim_su:'Kim Sư',ky_lan:'Kỳ Lân',ho_ly:'Hồ Ly',khong_tuoc:'Khổng Tước'
};

export function isSpiritPetSpecies(value:unknown):value is SpiritPetSpecies{
  return typeof value==='string'&&(SPIRIT_PET_SPECIES as readonly string[]).includes(value);
}

// Ảnh giai đoạn 1 của loài (bản xem trước). Không phản ánh cấp thật.
// Biểu tượng nhỏ cho nút mở linh thú (cùng bộ tài nguyên với HIU TMC).
export function spiritPetIconUrl(species:SpiritPetSpecies,stage:1|2|3|4=1):string{
  return `${ASSET_BASE}${ASSET_KEY[species]}-stage-${stage}-icon.webp`;
}

export function spiritPetImageUrl(species:SpiritPetSpecies,stage:1|2|3|4=1):string{
  return `${ASSET_BASE}${ASSET_KEY[species]}-stage-${stage}-full.webp`;
}

export async function readSpiritPetSpecies(memberId:string):Promise<SpiritPetSpecies|null>{
  const {data,error}=await supabase
    .from('spirit_pet_profiles')
    .select('species')
    .eq('member_id',memberId)
    .maybeSingle();
  if(error) throw error;
  const species=data?.species;
  return isSpiritPetSpecies(species)?species:null;
}

// Tiến độ và chăm sóc: chỉ gọi 3 RPC do máy chủ kiểm soát (HIU TMC). Máy chủ tính cấp, XP và giới hạn.
export const SPIRIT_PET_CARE_ACTIONS=['feed','groom','play'] as const;
export type SpiritPetCareAction=typeof SPIRIT_PET_CARE_ACTIONS[number];

export type SpiritPetProgress={
  species:SpiritPetSpecies;
  level:1|2|3|4;
  xp:number;
  affection:number;
  remainingToday?:number;
};

function toProgress(value:unknown):SpiritPetProgress|null{
  if(!value||typeof value!=='object') return null;
  const v=value as Record<string,unknown>;
  if(!isSpiritPetSpecies(v.species)) return null;
  const level=Number(v.level);
  if(![1,2,3,4].includes(level)) return null;
  const remaining=v.remaining_today;
  return {
    species:v.species,
    level:level as 1|2|3|4,
    xp:Number(v.xp)||0,
    affection:Number(v.affection)||0,
    remainingToday:typeof remaining==='number'?remaining:undefined,
  };
}

export async function readSpiritPetProgress():Promise<SpiritPetProgress|null>{
  const {data,error}=await supabase.rpc('spirit_pet_profile_get');
  if(error) throw error;
  return toProgress(data);
}

// Đồng bộ XP từ điểm học đã ghi trên máy chủ. Không có hồ sơ (P0002) thì coi như chưa có linh thú.
export async function syncSpiritPetProgress():Promise<SpiritPetProgress|null>{
  const {data,error}=await supabase.rpc('spirit_pet_sync_xp');
  if(error){
    if(error.code==='P0002') return null;
    throw error;
  }
  return toProgress(data);
}

export type SpiritPetCareResult=
  |{ok:true;progress:SpiritPetProgress}
  |{ok:false;reason:'limit'|'unknown'|'missing'|'error'};

export async function careSpiritPet(action:SpiritPetCareAction):Promise<SpiritPetCareResult>{
  if(!(SPIRIT_PET_CARE_ACTIONS as readonly string[]).includes(action)) return {ok:false,reason:'unknown'};
  const {data,error}=await supabase.rpc('spirit_pet_care',{p_action:action});
  if(error){
    if(error.code==='P0001') return {ok:false,reason:'limit'};
    if(error.code==='22023') return {ok:false,reason:'unknown'};
    if(error.code==='P0002') return {ok:false,reason:'missing'};
    return {ok:false,reason:'error'};
  }
  const progress=toProgress(data);
  return progress?{ok:true,progress}:{ok:false,reason:'error'};
}
