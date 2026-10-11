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
