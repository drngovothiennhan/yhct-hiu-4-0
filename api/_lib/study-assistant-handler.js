import {memberAccess} from './member-access.js';
import {createGeminiText,createGeminiWebSearch,geminiAiConfigured,geminiAiModel} from './gemini-provider.js';

const TIMEOUT_MS=20000;
const QUIZ_TIMEOUT_MS=35000;
const MAX_QUERY=2200;
const MAX_CONTEXT=6500;
const MIN_QUIZ_COUNT=5;
const MAX_QUIZ_COUNT=20;
const clean=(value,max=2000)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const contextText=(value,max=MAX_CONTEXT)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(-max);
const answerText=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/^\s*#{1,6}\s*/gm,'').replace(/^\s*[*-]\s+/gm,'• ').trim().slice(0,7000);
const researchIntent=value=>/\b(pubmed|openalex|doi|pmid|systematic|meta[- ]?analysis|clinical trials?|rct|cohort|case[- ]?control|guideline|evidence)\b|nghiên\s*cứu|y\s*văn|bài\s*báo\s*khoa\s*học|tổng\s*quan\s*hệ\s*thống|thử\s*nghiệm\s*lâm\s*sàng|bằng\s*chứng|trích\s*dẫn|tài\s*liệu\s*tham\s*khảo|đề\s*cương\s*nghiên\s*cứu/i.test(clean(value,MAX_QUERY));
const quizCount=value=>Math.max(MIN_QUIZ_COUNT,Math.min(MAX_QUIZ_COUNT,Math.trunc(Number(value)||10)));

function parseQuizJson(raw){
  let text=String(raw??'').trim();
  text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<=start)throw new Error('Gemini quiz JSON missing');
  let parsed;
  try{parsed=JSON.parse(text.slice(start,end+1))}catch{throw new Error('Gemini quiz JSON invalid')}
  const seen=new Set(),questions=[];
  for(const item of Array.isArray(parsed?.questions)?parsed.questions:[]){
    const stem=clean(item?.stem,700),options=Array.isArray(item?.options)?item.options.map(x=>clean(x,360)).filter(Boolean).slice(0,4):[],correctIndex=Number(item?.correctIndex),explanation=clean(item?.explanation,900);
    const key=stem.toLocaleLowerCase('vi');
    if(!stem||seen.has(key)||options.length!==4||!Number.isInteger(correctIndex)||correctIndex<0||correctIndex>3||!explanation)continue;
    seen.add(key);questions.push({stem,options,correctIndex,explanation});
  }
  if(questions.length<3)throw new Error('Gemini quiz returned too few valid questions');
  return{title:clean(parsed?.title,180)||'Đề ôn tập do Gemini tạo',questions:questions.slice(0,MAX_QUIZ_COUNT)};
}

async function createGroundedQuiz({query,count,started,res}){
  if(!geminiAiConfigured('default'))return res.status(503).json({error:'Gemini Study chưa được cấu hình trên máy chủ.'});
  const requested=quizCount(count);
  const instructions=[
    'Bạn là Gemini Study, giảng viên kiêm cố vấn học tập Y học cổ truyền bậc đại học của HIU YHCT 4.0.',
    'Nhiệm vụ hiện tại là dùng Google Search để tham khảo nguồn công khai đáng tin cậy rồi tạo một đề trắc nghiệm học tập bằng tiếng Việt ở mức độ phù hợp sinh viên đại học.',
    'Ưu tiên nguồn chính thống, trường đại học, tổ chức y tế, giáo trình mở hoặc tài liệu chuyên môn đáng tin cậy; tránh diễn đàn và nội dung quảng cáo khi có nguồn tốt hơn.',
    'Với nội dung YHCT phải dùng thuật ngữ chuyên môn chính xác, phân biệt lý luận YHCT với diễn giải y sinh hiện đại, không tự bịa công năng, chủ trị, quy kinh, phương thuốc hay quan hệ học thuyết.',
    'Mỗi câu có đúng 4 lựa chọn, chỉ 1 đáp án đúng, không dùng lựa chọn kiểu tất cả đều đúng hoặc cả A và B.',
    'Câu hỏi phải bám sát chủ đề người dùng chọn, phù hợp mục tiêu ôn tập sinh viên và tránh chẩn đoán hay kê đơn cá nhân hóa.',
    'Không bịa nguồn, không bịa dữ kiện. Nếu thông tin trên web mâu thuẫn, ưu tiên kiến thức ổn định và tránh đưa chi tiết chưa chắc chắn thành đáp án tuyệt đối.',
    'Chỉ trả về JSON thuần, không markdown, theo đúng cấu trúc: {"title":"...","questions":[{"stem":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"..."}]}.',
    'correctIndex là số nguyên 0-3. explanation giải thích ngắn vì sao đáp án đúng.'
  ].join(' ');
  const prompt=`CHỦ ĐỀ: ${query}\nSỐ CÂU MỤC TIÊU: ${requested}\nHãy tìm thông tin trên web trước, sau đó tạo tối đa ${requested} câu trắc nghiệm chất lượng cao đúng cấu trúc JSON.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),QUIZ_TIMEOUT_MS);
  try{
    const output=await createGeminiWebSearch({systemInstruction:instructions,prompt,signal:controller.signal,mode:'default'});
    const sources=Array.isArray(output.citations)?output.citations.filter(item=>item?.url?.startsWith('https://')).slice(0,6):[];
    if(!sources.length)throw new Error('Gemini quiz has no grounded web source');
    const quiz=parseQuizJson(output.text),latencyMs=Date.now()-started;
    res.setHeader('Server-Timing',`study-quiz;dur=${latencyMs}`);
    res.setHeader('X-AI-Provider','gemini-web');
    res.setHeader('X-AI-Model',output.model||geminiAiModel());
    return res.status(200).json({
      aiGenerated:true,
      topic:query,
      title:quiz.title,
      questions:quiz.questions.slice(0,requested),
      sources,
      provider:'gemini-web',
      degraded:false,
      generatedAt:new Date().toISOString(),
      latencyMs
    });
  }catch(error){
    const latencyMs=Date.now()-started;
    console.warn(JSON.stringify({event:'gemini_study_quiz',ok:false,latencyMs,error:clean(error?.message||'provider error',180)}));
    return res.status(error?.name==='AbortError'?504:502).json({error:error?.name==='AbortError'?'Gemini mất quá nhiều thời gian để tạo đề. Vui lòng thử lại với chủ đề ngắn hơn.':'Gemini chưa thể tạo đề có nguồn web xác minh. Vui lòng thử lại.'});
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

  const query=clean(req.body?.query,MAX_QUERY),conversationContext=contextText(req.body?.conversationContext,MAX_CONTEXT),pageContext=clean(req.body?.pageContext,600),task=clean(req.body?.task,40).toLowerCase();
  if(query.length<2)return res.status(400).json({error:'Query is required'});
  if(task==='quiz')return createGroundedQuiz({query,count:req.body?.count,started,res});
  if(researchIntent(query))return res.status(200).json({answer:'Câu hỏi này cần chế độ Research A.I để kiểm chứng nguồn học thuật sâu hơn.',sources:[],provider:'router',degraded:false,route:'research',latencyMs:Date.now()-started});
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
    'Trả lời bằng tiếng Việt tự nhiên. Không dùng ký hiệu markdown như **, *, # trong câu trả lời; nếu cần liệt kê dùng dấu •. Tránh văn phong máy móc và tránh lặp lại câu hỏi.'
  ].join(' ');
  const prompt=`CÂU HỎI HIỆN TẠI (ưu tiên cao nhất): ${query}\n\nMẠCH HỘI THOẠI GẦN NHẤT:\n${conversationContext||'không có'}\n\nNGỮ CẢNH TRANG/VIỆC HỌC (ưu tiên thấp hơn): ${pageContext||'không rõ'}\n\nHãy trả lời trực tiếp câu hỏi hiện tại. Chỉ nối với mạch trước khi thực sự liên quan; không tự thêm mục tiêu, kỳ thi hoặc chủ đề mà người dùng chưa nói.`;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    try{
      const output=await createGeminiWebSearch({systemInstruction:instructions,prompt,signal:controller.signal,mode:'default'});
      const latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini-web');
      res.setHeader('X-AI-Model',output.model||geminiAiModel());
      return res.status(200).json({answer:answerText(output.text),sources:Array.isArray(output.citations)?output.citations.slice(0,6):[],provider:'gemini-web',degraded:false,route:null,latencyMs});
    }catch(primaryError){
      if(controller.signal.aborted)throw primaryError;
      const fallback=await createGeminiText({systemInstruction:instructions,prompt,maxOutputTokens:1800,signal:controller.signal,mode:'default'});
      const latencyMs=Date.now()-started;
      res.setHeader('Server-Timing',`study-ai;dur=${latencyMs}`);
      res.setHeader('X-AI-Provider','gemini');
      res.setHeader('X-AI-Model',fallback.model||geminiAiModel());
      return res.status(200).json({answer:answerText(fallback.text),sources:[],provider:'gemini',degraded:true,route:null,latencyMs});
    }
  }catch(error){
    const latencyMs=Date.now()-started;
    console.warn(JSON.stringify({event:'gemini_study',ok:false,latencyMs,error:clean(error?.message||'provider error',180)}));
    return res.status(error?.name==='AbortError'?504:502).json({error:error?.name==='AbortError'?'Gemini Study quá thời gian phản hồi.':'Gemini Study tạm thời chưa phản hồi. Vui lòng thử lại.'});
  }finally{clearTimeout(timer)}
}
