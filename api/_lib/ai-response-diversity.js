const VARIATION_STYLES=[
  'Đi thẳng vào kết luận cốt lõi, sau đó giải thích cơ chế hoặc quan hệ chính và chốt điểm dễ nhầm.',
  'Giải thích theo hướng đối chiếu: nêu điểm giống/khác hoặc ranh giới khái niệm trước rồi mới hệ thống hóa.',
  'Mở bằng một ví dụ học tập ngắn phù hợp ngữ cảnh, sau đó rút ra nguyên tắc và liên hệ lại câu hỏi.',
  'Tổ chức theo chuỗi nguyên nhân → cơ chế/quan hệ → hệ quả → cách ghi nhớ, chỉ dùng các mắt xích có căn cứ.',
  'Dùng lối gợi nhớ chủ động: trả lời trực tiếp rồi đặt một câu tự kiểm tra ngắn hoặc chỉ ra cách tự kiểm chứng kiến thức.',
  'Tập trung vào lỗi thường gặp: trả lời chuẩn trước, sau đó nêu điều sinh viên hay nhầm và cách phân biệt.'
];
const NEXT_START='[[NEXT_ACTIONS]]';
const NEXT_END='[[/NEXT_ACTIONS]]';
let fallbackCursor=Math.abs(Date.now())%VARIATION_STYLES.length;
const clean=(value,max=120)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

export function normalizeAiVariation(value){
  const parsed=Number(value);
  if(Number.isFinite(parsed))return((Math.trunc(parsed)%VARIATION_STYLES.length)+VARIATION_STYLES.length)%VARIATION_STYLES.length;
  fallbackCursor=(fallbackCursor+1)%VARIATION_STYLES.length;
  return fallbackCursor;
}

export function responseDiversityInstruction(mode=0){
  const index=normalizeAiVariation(mode);
  return[
    'QUY TẮC ĐA DẠNG PHẢN HỒI TOÀN HỆ THỐNG: nếu người dùng hỏi lại cùng hoặc gần cùng một câu, không lặp nguyên văn câu trả lời hay câu gợi ý trước đó.',
    'Giữ nguyên sự thật, đáp án đúng, số liệu, nguồn, mức độ chắc chắn và nguyên tắc an toàn; tuyệt đối không tạo khác biệt bằng cách thay đổi nội dung chuyên môn hoặc bịa thêm dữ kiện.',
    'Chỉ tạo sự linh hoạt bằng cách đổi cấu trúc trình bày, thứ tự giải thích, ví dụ học tập, góc tiếp cận, cách ghi nhớ hoặc câu hỏi gợi mở khi phù hợp.',
    'Nếu câu hỏi chỉ có một kết luận chính xác, kết luận về nội dung phải nhất quán nhưng cách diễn đạt và phần giải thích nên tự nhiên khác lượt trước.',
    `Biến thể trình bày cho lượt này: ${VARIATION_STYLES[index]}`,
    'Không nhắc đến biến thể, mã lượt hay quy tắc đa dạng trong câu trả lời cho người dùng.'
  ].join(' ');
}

export function studySuggestionInstruction(mode=0){
  const index=normalizeAiVariation(mode);
  return[
    'Sau phần trả lời, tạo đúng 4 gợi ý học tiếp thật ngắn, bám sát câu hỏi hiện tại và mạch hội thoại liên quan.',
    'Mỗi gợi ý là một hành động người học có thể gửi ngay cho trợ lý, tối đa 46 ký tự, không trùng ý nhau và không lặp lại nhãn/gợi ý đã có trong CONVERSATION_CONTEXT.',
    'Không tự đoán môn học, kỳ thi hoặc mục tiêu chưa được người dùng nêu.',
    `Ưu tiên góc gợi ý khác lượt trước theo biến thể ${index}.`,
    `Đặt 4 dòng gợi ý giữa hai dòng đánh dấu ${NEXT_START} và ${NEXT_END}. Không dùng đánh số hoặc markdown trong khối này.`
  ].join(' ');
}

const FALLBACK_ACTIONS=[
  ['Chốt ý cốt lõi theo cách khác','Kiểm tra 3 câu ngắn','Nêu điểm dễ nhầm tiếp theo','Cho một ví dụ dễ nhớ'],
  ['So sánh với khái niệm gần nhất','Tự hỏi lại để kiểm tra hiểu','Giải thích bằng chuỗi nguyên nhân','Tóm tắt thành sơ đồ nhớ'],
  ['Đổi góc giải thích ngắn gọn','Tạo một tình huống học tập','Chỉ ra ranh giới khái niệm','Hỏi tôi một câu kiểm tra'],
  ['Hệ thống hóa theo từng bước','Tìm điểm tôi có thể nhầm','Liên hệ với phần vừa học','Tạo 3 câu bẫy thường gặp'],
  ['Rút thành 5 ý phải nhớ','Giải thích lại bằng ví dụ','Kiểm tra bằng câu đúng sai','Mở rộng một mức sâu hơn'],
  ['Chốt lại bằng bảng so sánh','Nêu lỗi sinh viên hay mắc','Tạo câu hỏi nhớ chủ động','Giải thích phần khó nhất lại']
];

export function fallbackStudySuggestions(mode=0){
  const index=normalizeAiVariation(mode);
  return FALLBACK_ACTIONS[index].slice();
}

export function parseStudyResponse(raw,mode=0){
  const text=String(raw??'').trim(),start=text.indexOf(NEXT_START),end=text.indexOf(NEXT_END);
  if(start<0||end<=start)return{answer:text,suggestions:fallbackStudySuggestions(mode)};
  const block=text.slice(start+NEXT_START.length,end);
  const suggestions=[...new Set(block.split(/\n+/).map(line=>clean(line.replace(/^[-•\d.)\s]+/,''),46)).filter(line=>line.length>=4))].slice(0,4);
  const answer=`${text.slice(0,start)} ${text.slice(end+NEXT_END.length)}`.replace(/\s+$/,'').trim();
  return{answer:answer||text.replace(block,''),suggestions:suggestions.length>=3?suggestions:fallbackStudySuggestions(mode)};
}
