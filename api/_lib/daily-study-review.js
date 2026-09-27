import {createGeminiJson,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';
const SUPABASE_URL=(process.env.VITE_SUPABASE_URL||'https://gzmpnsrwqjpsbklyflqr.supabase.co').trim().replace(/\/$/,'');
const SUPABASE_PUBLISHABLE_KEY=(process.env.VITE_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_Y4hMhXROZ-aVgWoaQ5fFKQ_ZAcXuIzG').trim();

const MAX_PER_USER=5;
const QUESTION_SCHEMA={
  type:'object',
  properties:{questions:{type:'array',minItems:3,maxItems:MAX_PER_USER,items:{
    type:'object',
    properties:{sourceQuestionId:{type:'string'},stem:{type:'string'},evidenceQuote:{type:'string'}},
    required:['sourceQuestionId','stem','evidenceQuote'],additionalProperties:false
  }}},required:['questions'],additionalProperties:false
};

const clean=(value,max=1500)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const normalize=value=>clean(value,2000).toLocaleLowerCase('vi').normalize('NFC');
const tokens=value=>normalize(value).match(/[\p{L}\p{N}]{3,}/gu)||[];

export function validateDailyReviewQuestions(raw,sourceQuestions){
  return validateDailyReviewQuestionsDetailed(raw,sourceQuestions).accepted;
}

export function validateDailyReviewQuestionsDetailed(raw,sourceQuestions){
  const sources=new Map(sourceQuestions.map(source=>[String(source.id),source]));
  const candidates=new Map(),rejections={};
  let fallbackCount=0;
  const reject=reason=>{rejections[reason]=(rejections[reason]||0)+1};
  for(const item of Array.isArray(raw)?raw:[]){
    const sourceId=String(item?.sourceQuestionId||'');
    if(!sources.has(sourceId)){reject('unknown_source_id');continue}
    if(candidates.has(sourceId)){reject('duplicate_source_id');continue}
    candidates.set(sourceId,item);
  }
  const accepted=[];
  for(const source of sourceQuestions){
    const sourceId=String(source.id),item=candidates.get(sourceId);
    const sourceOptions=Array.isArray(source.options)?source.options.map(value=>clean(value,500)):[];
    const canonicalAnswer=sourceOptions[Number(source.correctIndex)];
    const canonicalExplanation=clean(source.explanation,1000);
    const sourceText=[source.stem,...sourceOptions,source.explanation].map(value=>clean(value,3000)).join(' ');
    const generatedStem=clean(item?.stem,700),stemTokens=[...new Set(tokens(generatedStem))];
    const overlap=stemTokens.length?stemTokens.filter(token=>tokens(sourceText).includes(token)).length/stemTokens.length:0;
    const evidence=clean(item?.evidenceQuote,600);
    const evidenceExists=evidence.length>=8&&normalize(sourceText).includes(normalize(evidence));
    const generatedGrounded=Boolean(item&&generatedStem.length>=12&&overlap>=0.65&&evidenceExists);
    const stem=generatedGrounded?generatedStem:clean(source.stem,700);
    const sourceEvidence=clean(canonicalExplanation.length>=8?canonicalExplanation:source.stem,600);
    const finalEvidence=generatedGrounded?evidence:sourceEvidence;
    if(!generatedGrounded){
      fallbackCount++;
      if(item&&generatedStem.length<12)reject('short_stem');
      else if(item&&overlap<0.65)reject('low_source_overlap');
      else if(item&&!evidenceExists)reject('evidence_not_in_source');
    }
    if(stem.length<12||sourceOptions.length!==4||!canonicalAnswer||canonicalExplanation.length<1||finalEvidence.length<8||!normalize(sourceText).includes(normalize(finalEvidence))){
      reject('invalid_canonical_source');
      continue;
    }
    accepted.push({
      sourceQuestionId:source.id,questionType:'multiple_choice',stem,options:sourceOptions,
      correctAnswer:canonicalAnswer,explanation:canonicalExplanation,evidenceQuote:finalEvidence
    });
  }
  return{accepted:accepted.slice(0,MAX_PER_USER),candidateCount:Array.isArray(raw)?raw.length:0,rejections,fallbackCount};
}
export async function generateDailyReview(sourceQuestions,signal){
  if(!geminiAiConfigured())throw new Error('Gemini is not configured');
  const selected=sourceQuestions.slice(0,MAX_PER_USER);
  if(selected.length<3)throw new Error('Fewer than three approved source questions');
  const context=selected.map(item=>({
    sourceQuestionId:String(item.id),
    sourceDocument:String(item.sourceFileName||''),
    subject:String(item.subject||''),topic:String(item.topic||''),
    stem:String(item.stem||''),options:Array.isArray(item.options)?item.options:[],
    correctAnswer:Array.isArray(item.options)?item.options[Number(item.correctIndex)]:'',
    explanation:String(item.explanation||'')
  }));
  const systemInstruction=[
    'Bạn tạo câu hỏi ôn tập ngắn từ ngân hàng câu hỏi đã được duyệt trong Study OS.',
    'Chỉ dùng những dữ kiện trong SOURCE. Không dùng kiến thức nền, suy luận y khoa, web, tài liệu ngoài hoặc trí nhớ của mô hình.',
    'Mỗi câu phải là cách hỏi lại cùng một kiến thức của sourceQuestionId tương ứng.',
    'Chỉ trả sourceQuestionId, stem và evidenceQuote. Không tạo lựa chọn, đáp án hoặc giải thích; hệ thống sẽ lấy nguyên văn các trường này từ câu nguồn đã duyệt.',
    'evidenceQuote phải là một đoạn liên tục, nguyên văn trong nội dung của đúng câu nguồn và hỗ trợ trực tiếp cho stem.',
    'Không tạo hoặc thay đổi đáp án, lựa chọn, chi tiết bệnh học hay lời khuyên điều trị. Bỏ câu nếu nguồn không đủ căn cứ.',
    'Trả JSON đúng schema, không có markdown.'
  ].join(' ');
  const prompt=`Tạo một stem ôn tập ngắn cho từng nguồn. Giữ nguyên sourceQuestionId và chỉ dùng dữ kiện trong nguồn tương ứng.\nSOURCE=${JSON.stringify(context)}`;
  const output=await createGeminiJson({systemInstruction,prompt,schema:QUESTION_SCHEMA,maxOutputTokens:2600,signal,mode:'default'});
  let parsed;
  try{parsed=JSON.parse(output.text)}catch{throw new Error('Gemini returned invalid JSON for daily review')}
  const validation=validateDailyReviewQuestionsDetailed(parsed?.questions,selected),validated=validation.accepted;
  if(validated.length<3){const error=new Error('Fewer than three questions passed source validation');error.safeDetails={candidateCount:validation.candidateCount,acceptedCount:validated.length,rejections:validation.rejections};throw error}
  return{questions:validated,provider:'gemini',model:geminiAiModel(),sourceFallbackCount:validation.fallbackCount};
}

export function chooseDailySourceCount(seed=Math.random()){
  const bounded=Math.max(0,Math.min(0.999999,Number(seed)||0));
  return 3+Math.floor(bounded*3);
}

const todayInVietnam=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function dailyReviewRpc(name,args){
  if(!/^[a-z0-9_]+$/i.test(name))throw new Error('Invalid daily review operation');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',signal:controller.signal,headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),cache:'no-store'});
    if(!response.ok)throw new Error(`Daily review database operation returned ${response.status}`);
    return await response.json();
  }finally{clearTimeout(timer)}
}

async function mapConcurrent(items,limit,run){
  let next=0;const results=[];
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){const index=next++;try{results[index]=await run(items[index])}catch(error){results[index]={ok:false,reason:dailyReviewFailureCategory(error),details:error?.safeDetails&&typeof error.safeDetails==='object'?error.safeDetails:null}}}
  }));
  return results;
}

function dailyReviewFailureCategory(error){
  const message=String(error?.message||'');
  const databaseStatus=message.match(/database operation returned (\d{3})/i);
  if(databaseStatus)return`database_http_${databaseStatus[1]}`;
  const providerStatus=Number(error?.status||error?.statusCode);
  if(Number.isInteger(providerStatus)&&providerStatus>=400&&providerStatus<=599)return`provider_http_${providerStatus}`;
  if(/passed source validation|source validation/i.test(message))return'grounding_validation';
  if(/abort|timeout|timed out/i.test(message)||error?.name==='AbortError')return'timeout';
  if(/gemini|provider|model/i.test(message))return'provider_error';
  return'daily_review_error';
}

export async function handleDailyStudyReviewCron(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const secret=String(req.headers?.['x-yhct-daily-review-key']||'').trim();
  if(secret.length<32||secret.length>256)return res.status(401).json({error:'Unauthorized'});
  if(!geminiAiConfigured())return res.status(503).json({error:'Grounded quiz generation is not configured'});
  try{
    const valid=await dailyReviewRpc('daily_study_review_secret_valid_v1',{p_secret:secret});
    if(valid!==true)return res.status(401).json({error:'Unauthorized'});
    const date=todayInVietnam();
    const candidates=await dailyReviewRpc('daily_study_review_candidates_v1',{p_secret:secret,p_quiz_date:date,p_limit:200});
    const eligible=(Array.isArray(candidates)?candidates:[]).filter(row=>row?.memberId&&Array.isArray(row.sources)&&row.sources.length>=3);
    const results=await mapConcurrent(eligible,8,async row=>{
      const count=Math.min(row.sources.length,chooseDailySourceCount());
      const sources=row.sources.slice(0,count).map(source=>({
        id:String(source.id),sourceFileId:String(source.sourceFileId),sourceFileName:String(source.sourceFileName||''),
        subject:String(source.subject||''),topic:String(source.topic||''),stem:String(source.stem||''),
        options:Array.isArray(source.options)?source.options.map(String):[],correctIndex:Number(source.correctIndex),explanation:String(source.explanation||'')
      }));
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
      try{
        const generated=await generateDailyReview(sources,controller.signal);
        const saved=await dailyReviewRpc('daily_study_review_generate_v1',{p_secret:secret,p_member_id:String(row.memberId),p_quiz_date:date,p_questions:generated.questions});
        return{ok:true,created:Boolean(saved?.created),sourceFallbackCount:generated.sourceFallbackCount};
      }finally{clearTimeout(timer)}
    });
    const skipped=results.filter(item=>!item?.ok);
    const skippedReasons=skipped.reduce((counts,item)=>{const reason=item.reason||'daily_review_error';counts[reason]=(counts[reason]||0)+1;return counts;},{});
    const validationRejects=skipped.reduce((counts,item)=>{for(const[reason,count]of Object.entries(item.details?.rejections||{}))counts[reason]=(counts[reason]||0)+Number(count||0);return counts;},{});
    const response={ok:true,date,eligibleUsers:eligible.length,createdUsers:results.filter(item=>item?.ok&&item.created).length,skippedUsers:skipped.length,skippedReasons,validationRejects,sourceFallbackQuestions:results.reduce((sum,item)=>sum+Number(item?.sourceFallbackCount||0),0),provider:'gemini'};
    console.info(JSON.stringify({event:'daily_study_review_cron',...response}));
    return res.status(200).json(response);
  }catch(error){
    const reason=String(error?.message||'daily review generation failed').replace(/[\r\n\t]/g,' ').slice(0,180);
    console.error(JSON.stringify({event:'daily_study_review_cron_failed',reason}));
    return res.status(500).json({ok:false,error:'Daily quiz generation failed'});
  }
}
