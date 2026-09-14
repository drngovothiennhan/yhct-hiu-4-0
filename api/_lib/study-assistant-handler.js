import {cloudAiEnabled,cloudAiModel,memberAccess} from './member-access.js';
import {createGeminiText,createGeminiJson,createGeminiWebSearch,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';
import {publicEvidencePacket,publicEvidenceSources,retrievePublicMedicalEvidence} from './public-medical-evidence.js';
import {normalizeAiVariation,parseStudyResponse,responseDiversityInstruction,studySuggestionInstruction} from './ai-response-diversity.js';

const TIMEOUT_MS=20000;
const QUIZ_TIMEOUT_MS=50000;
const MAX_QUERY=2200;
const MAX_CONTEXT=6500;
const MIN_QUIZ_COUNT=5;
const MAX_QUIZ_COUNT=20;
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const contextText=(value,max=MAX_CONTEXT)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(-max);
const answerText=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/^\s*#{1,6}\s*/gm,'').replace(/^\s*[*-]\s+/gm,'• ').trim().slice(0,7000);
const researchIntent=value=>/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i.test(clean(value,MAX_QUERY));
const quizCount=value=>Math.max(MIN_QUIZ_COUNT,Math.min(MAX_QUIZ_COUNT,Math.trunc(Number(value)||10)));
const failureClass=error=>{const text=String(error?.message||'');if(error?.name==='AbortError'||/timeout/i.test(text))return'timeout';if(/\b429\b|rate.?limit|quota/i.test(text))return'rate_limit';if(/\b5\d\d\b/.test(text))return'provider_5xx';if(/401/.test(text))return'auth';if(/403/.test(text))return'access';if(/JSON|invalid|empty|too few/i.test(text))return'invalid_response';return'provider_error'};

export function parseQuizJson(raw,requested=3,sourceCount=0){
  let text=String(raw??'').trim();
  text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<=start)throw new Error('Gemini quiz JSON missing');
  let parsed;
  try{parsed=JSON.parse(text.slice(start,end+1))}catch{throw new Error('Gemini quiz JSON invalid')}
  const seen=new Set(),questions=[];
  for(const item of Array.isArray(parsed?.questions)?parsed.questions:[]){
    const stem=clean(item?.stem,700),options=Array.isArray(item?.options)?item.options.map(x=>clean(x,360)):[],correctIndex=item?.correctIndex,explanation=clean(item?.explanation,900);
    const sourceIndexes=Array.isArray(item?.sourceIndexes)?[...new Set(item.sourceIndexes.filter(index=>Number.isInteger(index)&&index>=0&&index<sourceCount))]:[];
    const key=stem.toLocaleLowerCase('vi');
    if(!stem||seen.has(key)||options.length!==4||options.some(option=>!option)||new Set(options.map(option=>option.toLocaleLowerCase('vi'))).size!==4||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation||(sourceCount&&!sourceIndexes.length))continue;
    seen.add(key);questions.push({stem,options,correctIndex,explanation,sourceIndexes});
  }
  if(questions.length<requested)throw new Error('Gemini quiz returned too few valid questions');
  return{title:clean(parsed?.title,180)||'Đề ôn tập do Gemini tạo',questions:questions.slice(0,MAX_QUIZ_COUNT)};
}

const groundedQuizSchema=(count,sourceCount)=>({
  type:'object',
  properties:{
    title:{type:'string'},
    questions:{type:'array',minItems:count,maxItems:count,items:{
      type:'object',
      properties:{
        stem:{type:'string'},
        options:{type:'array',minItems:4,maxItems:4,items:{type:'string'}},
        correctIndex:{type:'integer',minimum:0,maximum:3},
        explanation:{type:'string'},
        sourceIndexes:{type:'array',minItems:1,maxItems:Math.max(1,sourceCount),items:{type:'integer',minimum:0,maximum:Math.max(0,sourceCount-1)}}
      },
      required:['stem','options','correctIndex','explanation','sourceIndexes'],
      additionalProperties:false
    }}
  },
  required:['title','questions'],
  additionalProperties:false
});

function extractOpenAiText(payload){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
  const parts=[];
  for(const item of Array.isArray(payload?.output)?payload.output:[])for(const block of Array.isArray(item?.content)?item.content:[])if(typeof block?.text==='string')parts.push(block.text);
  return parts.join('').trim();
}

const QUIZ_SYSTEM=[
  'Bạn là bộ tạo câu hỏi ôn tập y khoa cho sinh viên Y học cổ truyền HIU.',
  'Mỗi câu phải có đúng 4 lựa chọn, chỉ một đáp án đúng, giải thích ngắn gọn và không dùng dữ kiện bịa.',
  'Chỉ dùng gói bằng chứng công khai được hệ thống truy xuất và cung cấp. Mỗi câu phải có sourceIndexes trỏ tới nguồn thực sự hỗ trợ đáp án.',
  'Ưu tiên nguồn học thuật/y khoa công khai đáng tin cậy. Phân biệt kiến thức YHCT cổ điển với bằng chứng y sinh hiện đại; không biến lý luận YHCT thành kết luận điều trị đã được chứng minh.',
  'Không tạo câu hỏi chẩn đoán/kê đơn cá nhân hóa. Không sao chép nguyên văn dài từ nguồn.',
  'Trả JSON đúng schema, không thêm markdown.'
].join(' ');

async function runOpenAiEvidenceQuiz(topic,count,evidence,sources,signal,variationMode){
  const key=process.env.OPENAI_API_KEY,model=cloudAiModel();
  if(!cloudAiEnabled()||!key||!model)throw new Error('OpenAI fallback configuration missing');
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal,
    headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model,store:false,max_output_tokens:4600,
      instructions:`${QUIZ_SYSTEM} ${responseDiversityInstruction(variationMode)}`,
      input:`CHỦ ĐỀ: ${topic}\nSỐ CÂU: ${count}\nNGUỒN CÔNG KHAI: ${JSON.stringify(sources)}\nGÓI BẰNG CHỨNG:\n${evidence}`,
      text:{format:{type:'json_schema',name:'yhct_study_quiz_evidence_v2',strict:true,schema:groundedQuizSchema(count,sources.length)}}
    })
  });
  if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(`OpenAI ${response.status}: ${clean(detail?.error?.message||'provider error',180)}`)}
  const payload=await response.json(),quiz=parseQuizJson(extractOpenAiText(payload),count,sources.length);
  return{...quiz,provider:'openai-public-evidence',model};
}

export async function createGroundedQuiz({query,count,started,res,variationMode=0}){
  const requested=quizCount(count),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),QUIZ_TIMEOUT_MS);
  let geminiFailure='',sources=[];
  try{
    const evidenceRows=await retrievePublicMedicalEvidence(query,{signal:controller.signal,limit:6});
    if(controller.signal.aborted){const aborted=new Error('aborted');aborted.name='AbortError';throw aborted}
    sources=publicEvidenceSources(evidenceRows);
    const evidence=publicEvidencePacket(evidenceRows);
    if(!sources.length||!evidence)throw new Error('Public medical evidence unavailable');

    const instructions=[
      'Bạn là Gemini Study, giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học của HIU YHCT 4.0.',
      'Nhiệm vụ hiện tại là tạo một đề trắc nghiệm học tập bằng tiếng Việt từ GÓI BẰNG CHỨNG CÔNG KHAI mà hệ thống đã truy xuất độc lập.',
      'Không cần và không được giả vờ đã tự tìm Google Search trong bước này; chỉ dùng nội dung nguồn được cung cấp.',
      'Với nội dung YHCT phải dùng thuật ngữ chuyên môn chính xác, phân biệt lý luận YHCT với diễn giải y sinh hiện đại, không tự bịa công năng, chủ trị, quy kinh, phương thuốc hay quan hệ học thuyết.',
      'Mỗi câu có đúng 4 lựa chọn, chỉ 1 đáp án đúng, không dùng lựa chọn kiểu tất cả đều đúng hoặc cả A và B.',
      'Câu hỏi phải bám sát chủ đề người dùng chọn, phù hợp mục tiêu ôn tập sinh viên và tránh chẩn đoán hay kê đơn cá nhân hóa.',
      'Không bịa nguồn, không bịa dữ kiện. Mỗi câu phải có sourceIndexes chứa chỉ số nguồn thực sự hỗ trợ đáp án.',
      'Nếu bằng chứng không đủ để tạo đủ số câu an toàn thì không tự bổ sung kiến thức ngoài nguồn.',
      responseDiversityInstruction(variationMode),
      'Khi tạo lại cùng một chủ đề, thay đổi góc hỏi và cách xây dựng nhiễu trong giới hạn bằng chứng; không thay đổi đáp án đúng chỉ để tạo cảm giác mới.',
      'Chỉ trả về JSON thuần, không markdown. correctIndex là số nguyên 0-3. explanation giải thích ngắn vì sao đáp án đúng.'
    ].join(' ');
    const prompt=`CHỦ ĐỀ: ${query}\nSỐ CÂU MỤC TIÊU: ${requested}\nNGUỒN (chỉ số bắt đầu 0): ${JSON.stringify(sources)}\nGÓI BẰNG CHỨNG CÔNG KHAI:\n${evidence}`;
    const schema=groundedQuizSchema(requested,sources.length);

    if(geminiAiConfigured('default')){
      try{
        const generated=await createGeminiJson({systemInstruction:instructions,prompt,schema,maxOutputTokens:5000,signal:controller.signal,mode:'default'});
        const quiz=parseQuizJson(generated.text,requested,sources.length),latencyMs=Date.now()-started;
        res.setHeader('Server-Timing',`study-quiz;dur=${latencyMs}`);
        res.setHeader('X-AI-Provider','gemini-public-evidence');
        res.setHeader('X-AI-Model',generated.model||geminiAiModel());
        res.setHeader('X-AI-Evidence-Count',String(sources.length));
        res.setHeader('X-AI-Degraded','0');
        return res.status(200).json({aiGenerated:true,topic:query,title:quiz.title,questions:quiz.questions.slice(0,requested),sources,provider:'gemini-public-evidence',degraded:false,generatedAt:new Date().toISOString(),latencyMs});
      }catch(error){
        if(controller.signal.aborted)throw error;
        geminiFailure=failureClass(error);
        console.warn(JSON.stringify({event:'study_quiz',ok:false,provider:'gemini-generation',count:requested,latencyMs:Date.now()-started,failureClass:geminiFailure,evidenceCount:sources.length,failover:'openai-evidence'}));
      }
    }else geminiFailure='configuration';

    const fallback=await runOpenAiEvidenceQuiz(query,requested,evidence,sources,controller.signal,variationMode),latencyMs=Date.now()-started;
    res.setHeader('Server-Timing',`study-quiz;dur=${latencyMs}`);
    res.setHeader('X-AI-Provider',fallback.provider);
    res.setHeader('X-AI-Model',fallback.model);
    res.setHeader('X-AI-Evidence-Count',String(sources.length));
    res.setHeader('X-AI-Degraded','0');
    res.setHeader('X-AI-Failover','gemini');
    return res.status(200).json({aiGenerated:true,topic:query,title:fallback.title,questions:fallback.questions,sources,provider:fallback.provider,degraded:false,generatedAt:new Date().toISOString(),latencyMs,failoverFrom:geminiFailure});
  }catch(error){
    const latencyMs=Date.now()-started,finalFailure=failureClass(error),hasEvidence=sources.length>0;
    console.warn(JSON.stringify({event:'study_quiz',ok:false,provider:'all',count:requested,latencyMs,failureClass:finalFailure,geminiFailure,evidenceCount:sources.length}));
    res.setHeader('X-AI-Degraded','1');
    if(hasEvidence)res.setHeader('X-AI-Evidence-Count',String(sources.length));
    const timedOut=error?.name==='AbortError';
    const modelBusy=hasEvidence&&(finalFailure==='rate_limit'||geminiFailure==='rate_limit');
    return res.status(timedOut?504:503).json({
      error:timedOut?'A.I tạo đề quá thời gian phản hồi. Vui lòng thử lại.':modelBusy?'Đã truy xuất được nguồn công khai nhưng dịch vụ tạo đề A.I đang quá tải. Vui lòng thử lại sau ít phút.':'A.I tạo đề tạm thời chưa truy xuất được đủ nguồn công khai. Hãy thử chủ đề cụ thể hơn hoặc chọn Đề HIU đã duyệt.',
      code:timedOut?'QUIZ_TIMEOUT':modelBusy?'QUIZ_MODEL_BUSY':'QUIZ_PROVIDER_ERROR',
      ...(hasEvidence?{sources}:{}),
      latencyMs
    });
  }finally{clearTimeout(timer)}
}

export async function handleStudyAssistant(req,res){
  const started=Date.now();
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Vary','Authorization');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const access=await memberAccess(req,'member');
  if(!access.ok)return res.status(access.status).json({error:access.error});

  const query=clean(req.body?.query,MAX_QUERY),conversationContext=contextText(req.body?.conversationContext,MAX_CONTEXT),pageContext=clean(req.body?.pageContext,600),task=clean(req.body?.task,40).toLowerCase(),variationMode=normalizeAiVariation(req.body?.variationMode);
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  if(task==='quiz')return createGroundedQuiz({query,count:req.body?.count,started,res,variationMode});
  if(researchIntent(query))return res.status(200).json({answer:'Câu hỏi này cần chế độ Research A.I để kiểm chứng nguồn học thuật sâu hơn.',sources:[],suggestions:[],provider:'router',degraded:false,route:'research',latencyMs:Date.now()-started});
  if(!geminiAiConfigured('default'))return res.status(503).json({error:'Gemini Study chưa được cấu hình trên máy chủ.'});

  const instructions=[
    'Bạn là Gemini Study — giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học của HIU YHCT 4.0.',
    'Hãy giảng như một giảng viên đại học: chính xác thuật ngữ, có hệ thống, dễ học, giúp sinh viên hiểu bản chất và phân biệt điểm dễ nhầm thay vì chỉ liệt kê.',
    'THỨ TỰ ƯU TIÊN NGỮ CẢNH BẮT BUỘC: (1) CÂU HỎI HIỆN TẠI; (2) chủ đề, đối tượng và yêu cầu người dùng nêu rõ trong các lượt gần nhất của CONVERSATION_CONTEXT; (3) PAGE_CONTEXT; (4) kiến thức nền. Không để mục tiêu cũ lấn át câu hỏi mới.',
    'Nếu câu hiện tại là câu nối tiếp như “phần này”, “tiếp tục”, “giải thích lại”, “10 phút”, “tự kiểm tra”, phải nối với chủ đề gần nhất thực sự do người dùng nêu. Nếu có từ hai cách hiểu khác nhau có thể làm thay đổi câu trả lời, hỏi đúng một câu làm rõ ngắn thay vì tự đoán.',
    'Tuyệt đối không tự bịa rằng người dùng sắp thi, đang ôn thi, yếu ở phần nào, đang học môn nào, đã đọc tài liệu nào hoặc có mục tiêu nào nếu thông tin đó không có trong câu hỏi/ngữ cảnh.',
    'CONVERSATION_CONTEXT chỉ dùng để hiểu đại từ, chủ đề và mạch hội thoại; không coi câu trả lời trước của AI là bằng chứng sự thật. Nếu câu trả lời trước có dấu hiệu sai, hãy sửa rõ ràng thay vì tiếp tục lỗi.',
    'PAGE_CONTEXT chỉ là ngữ cảnh học tập thứ cấp như route, study_focus, study_goal, study_year, daily_minutes và last_module; không coi chúng là bằng chứng học thuật. Không suy đoán dữ liệu cá nhân hoặc dữ liệu Drive từ đó.',
    'Với kiến thức YHCT, ưu tiên trình bày theo mức đại học: khái niệm/học thuyết → quan hệ hoặc cơ chế theo lý luận YHCT → hệ thống hóa/ứng dụng học tập → điểm dễ nhầm. Dùng thuật ngữ Hán-Việt chính xác khi cần và phân biệt rõ lý luận YHCT với giải thích y sinh hiện đại.',
    'Với Dược liệu và Phương tễ, không tự bịa hoặc đổi tên vị thuốc/phương; không khẳng định tính vị, quy kinh, công năng, chủ trị, phối ngũ nếu không đủ chắc chắn. Khi cần bằng chứng chuyên sâu thì đề nghị Research.',
    'Nếu người dùng yêu cầu một kế hoạch X phút, tổng thời lượng các phần phải đúng X phút và nội dung phải bám đúng chủ đề họ vừa nêu.',
    'Nếu câu hỏi là kiến thức học tập, ưu tiên: trả lời trực tiếp → giải thích cốt lõi → mẹo nhớ/điểm dễ nhầm khi hữu ích. Nếu yêu cầu so sánh, dùng tiêu chí rõ ràng. Nếu yêu cầu quiz, tạo câu hỏi có đáp án và giải thích ngắn.',
    'Không tự truy xuất Drive hay tài liệu nội bộ. Nội dung ôn tập tạo ra chỉ là tài liệu tạm thời, không sửa đáp án chính thức của ngân hàng quiz.',
    'Không chẩn đoán, kê đơn hay thay thế bác sĩ. Với nội dung lâm sàng cá nhân hóa, chuyển sang giải thích học thuật an toàn.',
    'Khi dùng Google Search, chỉ nêu nguồn thực sự tìm thấy; không bịa URL. Nếu nguồn mâu thuẫn hoặc chưa chắc chắn, nói rõ giới hạn.',
    responseDiversityInstruction(variationMode),
    studySuggestionInstruction(variationMode),
    'Trả lời bằng tiếng Việt tự nhiên. Không dùng ký hiệu markdown như **, *, # trong phần trả lời; nếu cần liệt kê dùng dấu •. Tránh văn phong máy móc và tránh lặp lại câu hỏi.'
  ].join(' ');
  const prompt=`CÂU HỎI HIỆN TẠI: ${query}\nƯU TIÊN CAO NHẤT: trả lời đúng yêu cầu hiện tại trước mọi ngữ cảnh cũ.\n\nCONVERSATION_CONTEXT: ${conversationContext||'không có'}\nGhi chú: đây là mạch hội thoại gần nhất, chỉ dùng khi liên quan đến câu hỏi hiện tại. Nếu người dùng hỏi lại cùng ý, không sao chép nguyên văn phần trả lời hoặc gợi ý đã xuất hiện ở đây.\n\nPAGE_CONTEXT: ${pageContext||'không rõ'}\nGhi chú: đây là ngữ cảnh trang/việc học thứ cấp, không phải bằng chứng học thuật.\n\nHãy trả lời trực tiếp câu hỏi hiện tại. Chỉ nối với mạch trước khi thực sự liên quan; không tự thêm mục tiêu, kỳ thi hoặc chủ đề mà người dùng chưa nói.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    try{
      const output=await createGeminiWebSearch({systemInstruction:instructions,prompt,signal:controller.signal,mode:'default'});
      const parsed=parseStudyResponse(output.text,variationMode),latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini-web');
      res.setHeader('X-AI-Model',output.model||geminiAiModel());
      res.setHeader('X-AI-Variation',String(variationMode));
      return res.status(200).json({answer:answerText(parsed.answer),sources:Array.isArray(output.citations)?output.citations.slice(0,6):[],suggestions:parsed.suggestions,provider:'gemini-web',degraded:false,route:null,latencyMs});
    }catch(primaryError){
      if(controller.signal.aborted)throw primaryError;
      const fallback=await createGeminiText({systemInstruction:instructions,prompt,maxOutputTokens:1800,signal:controller.signal,mode:'default'});
      const parsed=parseStudyResponse(fallback.text,variationMode),latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini');
      res.setHeader('X-AI-Model',fallback.model||geminiAiModel());
      res.setHeader('X-AI-Variation',String(variationMode));
      return res.status(200).json({answer:answerText(parsed.answer),sources:[],suggestions:parsed.suggestions,provider:'gemini',degraded:true,route:null,latencyMs});
    }
  }catch(error){
    const latencyMs=Date.now()-started;
    console.warn(JSON.stringify({event:'gemini_study',ok:false,latencyMs,error:clean(error?.message||'provider error',180)}));
    return res.status(error?.name==='AbortError'?504:502).json({error:error?.name==='AbortError'?'Gemini Study quá thời gian phản hồi.':'Gemini Study tạm thời chưa phản hồi. Vui lòng thử lại.'});
  }finally{clearTimeout(timer)}
}
