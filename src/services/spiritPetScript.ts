// Linh thú trò chuyện theo kịch bản cố định. Không gọi AI, không gọi mạng.
// Chỉ đọc số liệu học tập đã có trên trình duyệt; không tạo điểm chính thức.

export type PetLearningTab='quick'|'adaptive'|'bank';
export type PetAction={type:'learning';tab:PetLearningTab}|{type:'none'};

export type PetContext={
  todayQuestions:number;
  dueCount:number;
  weakFolder?:string|null;
};

export type PetReply={reply:string;action:PetAction;suggestions:string[]};

const SUGGESTIONS=['Tiến độ hôm nay','Thẻ đến hạn','Mở quiz','Bạn làm được gì?'];

export function normalizePetText(text:string):string{
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g,'')
    .replace(/đ/g,'d')
    .replace(/Đ/g,'d')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();
}

const has=(t:string,words:string[])=>words.some(w=>t.includes(w));

export function answerPetScript(input:string,ctx:PetContext):PetReply{
  const t=normalizePetText(input);
  if(!t) return {reply:'Bạn muốn hỏi gì? Tôi có thể cho bạn biết tiến độ hôm nay, thẻ cần ôn, hoặc mở quiz.',action:{type:'none'},suggestions:SUGGESTIONS};

  if(has(t,['lam duoc gi','giup gi','ban la ai','help','menu','huong dan'])){
    return {
      reply:'Tôi là linh thú của bạn. Tôi có thể: cho bạn biết tiến độ luyện tập hôm nay, nhắc thẻ đến hạn cần ôn, và mở quiz hoặc ôn ngắt quãng.',
      action:{type:'none'},
      suggestions:SUGGESTIONS,
    };
  }

  if(has(t,['tien do','hom nay','da luyen','luyen bao nhieu','cau hoi'])){
    const n=Math.max(0,Math.floor(ctx.todayQuestions||0));
    return {
      reply:n>0
        ? `Hôm nay bạn đã luyện ${n} câu. Đây là số liệu trên thiết bị này, không phải điểm chính thức.`
        : 'Hôm nay bạn chưa luyện câu nào. Mở quiz để bắt đầu.',
      action:{type:'learning',tab:'bank'},
      suggestions:['Mở quiz','Thẻ đến hạn'],
    };
  }

  if(has(t,['the den han','can on','on tap','on ngat quang','ngat quang','flashcard'])){
    const due=Math.max(0,Math.floor(ctx.dueCount||0));
    const weak=ctx.weakFolder?` Nên củng cố: ${ctx.weakFolder}.`:'';
    return {
      reply:due>0?`Bạn có ${due} thẻ đến hạn.${weak}`:`Hiện không có thẻ đến hạn.${weak}`.trim(),
      action:{type:'learning',tab:'adaptive'},
      suggestions:['Mở quiz','Tiến độ hôm nay'],
    };
  }

  if(has(t,['quiz','luyen','mo bank','ngan hang','cau hoi'])){
    return {reply:'Mở ngân hàng câu hỏi để luyện theo thư mục hoặc chủ đề.',action:{type:'learning',tab:'bank'},suggestions:SUGGESTIONS};
  }

  if(has(t,['diem','ket qua','bang xep hang','xep hang'])){
    return {
      reply:'Điểm chính thức do máy chủ tính và hiển thị ở phần học tương ứng. Tôi chỉ hiển thị tiến độ trên thiết bị.',
      action:{type:'learning',tab:'quick'},
      suggestions:['Tiến độ hôm nay','Mở quiz'],
    };
  }

  return {
    reply:'Tôi chưa hiểu câu đó. Bạn có thể hỏi về tiến độ hôm nay, thẻ cần ôn, hoặc mở quiz.',
    action:{type:'none'},
    suggestions:SUGGESTIONS,
  };
}
