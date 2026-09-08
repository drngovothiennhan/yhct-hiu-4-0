import {memberRpc,roleAtLeast} from './member-access.js';

const MAX_TOOL_OUTPUT_CHARS=12000;
const MAX_MEMBER_HISTORY=40;
const MAX_RESEARCH_ITEMS=8;

const EMPTY_SCHEMA={type:'object',properties:{},required:[],additionalProperties:false};

const TOOL_REGISTRY={
  get_my_drl_history:{
    minRole:'member',
    rpc:'drl_member_history_v1',
    description:'Đọc lịch sử điểm rèn luyện đã công bố của chính thành viên đang đăng nhập. Chỉ dùng khi người dùng hỏi về điểm/hoạt động rèn luyện của bản thân.',
    parameters:EMPTY_SCHEMA,
    rpcArgs:()=>({}),
    normalize:data=>Array.isArray(data)?data.slice(0,MAX_MEMBER_HISTORY):[]
  },
  list_research_opportunities:{
    minRole:'member',
    rpc:'research_opportunities_feed_v1',
    description:'Liệt kê cơ hội nghiên cứu đang mở trong hệ thống cho thành viên. Không đăng ký hoặc thay đổi dữ liệu.',
    parameters:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:MAX_RESEARCH_ITEMS}},required:['limit'],additionalProperties:false},
    rpcArgs:args=>({p_limit:Math.min(MAX_RESEARCH_ITEMS,Math.max(1,Number(args.limit)||6))}),
    normalize:data=>Array.isArray(data)?data.slice(0,MAX_RESEARCH_ITEMS):[]
  },
  list_drl_semesters:{
    minRole:'mod',
    rpc:'drl_semester_list_v1',
    description:'Đọc danh sách học kỳ điểm rèn luyện và trạng thái khóa/công bố. Chỉ dành cho moderator trở lên; không sửa dữ liệu.',
    parameters:EMPTY_SCHEMA,
    rpcArgs:()=>({}),
    normalize:data=>Array.isArray(data)?data.slice(0,24):[]
  }
};

const cleanName=value=>String(value||'').replace(/[^a-z0-9_]/gi,'').slice(0,80);
const parseArgs=raw=>{try{const value=JSON.parse(String(raw||'{}'));return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return{}}};
const boundedJson=value=>{const raw=JSON.stringify(value);if(raw.length<=MAX_TOOL_OUTPUT_CHARS)return raw;return JSON.stringify({ok:true,truncated:true,data:Array.isArray(value?.data)?value.data.slice(0,12):[]})};

export const AI_TOOL_NAMES=Object.freeze(Object.keys(TOOL_REGISTRY));

export function aiToolsForRole(role){
  return Object.entries(TOOL_REGISTRY).filter(([,tool])=>roleAtLeast(role,tool.minRole)).map(([name,tool])=>({type:'function',name,description:tool.description,parameters:tool.parameters,strict:true}));
}

export async function executeAiTool(req,role,call){
  const name=cleanName(call?.name),tool=TOOL_REGISTRY[name];
  if(!tool||!roleAtLeast(role,tool.minRole))throw new Error('AI tool is not allowed for this role');
  const args=parseArgs(call?.arguments),data=await memberRpc(req,tool.rpc,tool.rpcArgs(args));
  const normalized=tool.normalize(data),result={ok:true,tool:name,data:normalized};
  console.info(JSON.stringify({event:'ai_tool',ok:true,tool:name,role,rowCount:Array.isArray(normalized)?normalized.length:0}));
  return boundedJson(result);
}
