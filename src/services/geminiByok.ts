import {askServerAi} from './aiRuntimeService';

export type GeminiStatus={configured:boolean;maskedKey:string;model:string|null;quota:{minute:number;day:number;minuteLimit:number;dayLimit:number}};
export class GeminiFallbackError extends Error{reason:'not_configured'|'quota'|'rate_limited'|'network'|'provider';constructor(reason:GeminiFallbackError['reason'],message:string){super(message);this.name='GeminiFallbackError';this.reason=reason}}

const SERVER_MANAGED_MODEL='server-managed';
const serverOnlyMessage='Gemini của HIU YHCT 4.0 được cấu hình server-side bằng Vercel Environment Variables. Không lưu API key trong trình duyệt.';

export function maskGeminiKey(){return''}
export function saveGeminiKey(_key:string){throw new GeminiFallbackError('not_configured',serverOnlyMessage)}
export function clearGeminiKey(_legacyScope?:string){return}
export async function discoverGeminiModel(){return SERVER_MANAGED_MODEL}

export async function askGemini(prompt:string,systemContext='Bạn là trợ lý học thuật Y học cổ truyền. Chỉ hỗ trợ học tập, không chẩn đoán hay kê đơn. Khi dữ liệu không chắc chắn phải nói rõ giới hạn.'){
  const text=prompt.trim();if(!text)throw new Error('Nội dung trống.');
  try{
    const result=await askServerAi(`${systemContext}\n\n${text}`,'fast',[]);
    return{model:SERVER_MANAGED_MODEL,text:result.answer};
  }catch(error){
    if(error instanceof GeminiFallbackError)throw error;
    throw new GeminiFallbackError('provider',(error as Error)?.message||'Gemini server-side chưa khả dụng.');
  }
}

export function getGeminiStatus():GeminiStatus{
  return{configured:true,maskedKey:'',model:SERVER_MANAGED_MODEL,quota:{minute:0,day:0,minuteLimit:0,dayLimit:0}};
}
