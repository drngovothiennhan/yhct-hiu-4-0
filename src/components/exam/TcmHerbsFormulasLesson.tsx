import {useMemo,useState} from 'react';
import {BookOpen,CheckCircle2,CircleHelp,Layers3,RotateCcw,Sparkles} from 'lucide-react';
import './tcm-herbs-formulas-lesson.css';

type LessonMode='lesson'|'flashcards'|'quiz';
type Herb={name:string;zh:string;pinyin:string;actions:string;example:string};
type Formula={name:string;zh:string;pinyin:string;components:string;actions:string};
type QuizItem={question:string;options:string[];answer:number;explain:string};

const HERBS:Herb[]=[
  {name:'Nhân Sâm',zh:'人参',pinyin:'Rénshēn',actions:'Đại bổ nguyên khí, tăng cường sức khỏe, tăng cường miễn dịch.',example:'Nhân sâm có tác dụng bổ khí, tăng cường sức khỏe, phù hợp với người bị suy nhược, mệt mỏi.'},
  {name:'Đương Quy',zh:'当归',pinyin:'Dāngguī',actions:'Bổ huyết, điều kinh, dưỡng huyết.',example:'Đương quy thường được sử dụng để bổ huyết điều kinh, đặc biệt thích hợp cho phụ nữ.'},
  {name:'Xuyên Khung',zh:'川芎',pinyin:'Chuānxiōng',actions:'Hoạt huyết, hành khí, giảm đau đầu.',example:'Xuyên khung có tác dụng hoạt huyết, hành khí, thường được sử dụng trong điều trị đau đầu.'},
  {name:'Hoàng Kỳ',zh:'黄芪',pinyin:'Huángqí',actions:'Bổ khí, tăng cường sức đề kháng, lợi tiểu.',example:'Hoàng kỳ có thể tăng cường hệ miễn dịch, thích hợp cho những người có thể trạng yếu.'},
  {name:'Bạch Thược',zh:'白芍',pinyin:'Báisháo',actions:'Dưỡng huyết, bổ can, giảm đau.',example:'Bạch thược thường được sử dụng để điều hòa can tỳ, giảm đau.'},
  {name:'Bạch Chỉ',zh:'白芷',pinyin:'Báizhǐ',actions:'Giải biểu, khu phong, chỉ thống.',example:'Bạch chỉ có tác dụng giải biểu, thường dùng trong cảm mạo gây đau đầu.'},
  {name:'Hoàng Liên',zh:'黄连',pinyin:'Huánglián',actions:'Thanh nhiệt, giải độc, chỉ tả.',example:'Hoàng liên có thể thanh nhiệt giải độc, thích hợp cho các bệnh do nhiệt độc gây ra.'},
  {name:'Hoàng Cầm',zh:'黄芩',pinyin:'Huángqín',actions:'Thanh nhiệt, táo thấp, chỉ ho.',example:'Hoàng cầm thường được sử dụng để điều trị ho do phế nhiệt và tiêu chảy do thấp nhiệt.'},
  {name:'Hà Thủ Ô',zh:'何首乌',pinyin:'Héshǒuwū',actions:'Bổ Can thận, bổ huyết, làm đen tóc.',example:'Hà thủ ô giúp bổ thận dưỡng huyết, làm chậm quá trình lão hóa.'},
  {name:'Đỗ Trọng',zh:'杜仲',pinyin:'Dùzhòng',actions:'Bổ can thận, cường gân cốt, an thai.',example:'Đỗ trọng có tác dụng mạnh gân cốt, thường được sử dụng cho các trường hợp đau lưng, đầu gối yếu.'},
  {name:'Xạ Can',zh:'射干',pinyin:'Shègān',actions:'Thanh nhiệt, giải độc, tiêu đàm.',example:'Xạ can có tác dụng thanh nhiệt giải độc, phù hợp với các trường hợp viêm họng sưng đau.'},
  {name:'Câu Kỷ Tử',zh:'枸杞子',pinyin:'Gǒuqǐzǐ',actions:'Bổ Can thận, dưỡng huyết, minh mục.',example:'Câu kỷ tử thường được sử dụng để bổ Can thận, dưỡng huyết, sáng mắt.'},
  {name:'Kê Huyết Đằng',zh:'鸡血藤',pinyin:'Jīxuèténg',actions:'Bổ huyết, hoạt huyết, thư cân.',example:'Kê huyết đằng giúp hoạt huyết, thư cân, thường được dùng cho người thiếu máu, thể trạng yếu.'},
  {name:'Ngưu Tất',zh:'牛膝',pinyin:'Niúxī',actions:'Hoạt huyết, lợi niệu, thư cân.',example:'Ngưu tất có tác dụng lợi tiểu, hoạt huyết, thường được dùng cho đau khớp.'}
];

const FORMULAS:Formula[]=[
  {name:'Tứ Quân Tử Thang',zh:'四君子汤',pinyin:'Sì Jūn Zǐ Tāng',components:'Nhân Sâm, Bạch Truật, Phục Linh, Cam Thảo.',actions:'Bổ khí kiện tỳ, thích hợp cho người bị tỳ vị hư nhược, ăn uống kém, mệt mỏi, khí huyết suy yếu.'},
  {name:'Tứ Vật Thang',zh:'四物汤',pinyin:'Sì Wù Tāng',components:'Đương Quy, Xuyên Khung, Thục Địa, Bạch Thược.',actions:'Bổ huyết, hoạt huyết, điều kinh. Thường dùng cho phụ nữ có kinh nguyệt không đều, đau bụng kinh.'},
  {name:'Bát Trân Thang',zh:'八珍汤',pinyin:'Bā Zhēn Tāng',components:'Tứ Quân Tử Thang kết hợp với Tứ Vật Thang.',actions:'Bổ khí huyết, thích hợp cho người bị thiếu máu, suy nhược cơ thể.'},
  {name:'Thập Toàn Đại Bổ Hoàn',zh:'十全大补丸',pinyin:'Shí Quán Dà Bǔ Wán',components:'Bát Trân Thang kết hợp với Hoàng Kỳ và Nhục Quế.',actions:'Bổ khí huyết, tăng cường sức khỏe, cải thiện tình trạng suy nhược.'},
  {name:'Lục Vị Địa Hoàng Hoàn',zh:'六味地黄丸',pinyin:'Liù Wèi Dì Huáng Wán',components:'Thục Địa, Sơn Thù, Hoài Sơn, Trạch Tả, Phục Linh, Mẫu Đơn Bì.',actions:'Bổ thận âm, thích hợp cho các bệnh về thận âm hư, đau lưng, mỏi gối, ù tai.'},
  {name:'Bát Vị Quế Phụ Hoàn',zh:'桂附八味丸',pinyin:'Guì Fù Bā Wèi Wán',components:'Lục Vị Địa Hoàng Hoàn kết hợp với Quế Nhục, Phụ Tử.',actions:'Bổ thận dương, thích hợp cho người bị thận dương hư, lạnh lưng, lạnh gối, tiểu đêm nhiều.'},
  {name:'Quy Tỳ Thang',zh:'归脾汤',pinyin:'Guī Pí Tāng',components:'Đương Quy, Hoàng Kỳ chích, Long Nhãn, Viễn Chí sao, Bạch Truật sao, Phục Thần, Nhân sâm, Toan táo nhân sao, Mộc hương, Cam thảo chích, Sinh khương, Đại táo.',actions:'Bổ tỳ ích khí, dưỡng huyết an thần, thích hợp cho người bị tỳ khí hư, mất ngủ, hay quên.'},
  {name:'Bổ Trung Ích Khí Hoàn',zh:'补中益气丸',pinyin:'Bǔ Zhōng Yì Qì Wán',components:'Hoàng Kỳ, Nhân Sâm, Bạch Truật, Cam Thảo, Đương Quy, Trần Bì, Thăng ma, Sài hồ.',actions:'Bổ khí thăng dương, ích trung tiêu, thường dùng trong các trường hợp tỳ vị khí hư, mệt mỏi, chán ăn.'}
];

const QUIZ:QuizItem[]=[
  {question:'Theo tài liệu, Nhân Sâm có công dụng nổi bật nào?',options:['Thanh nhiệt táo thấp','Đại bổ nguyên khí','Hoạt huyết thư cân','Giải biểu khu phong'],answer:1,explain:'Nhân Sâm: đại bổ nguyên khí, tăng cường sức khỏe, tăng cường miễn dịch.'},
  {question:'Dược liệu nào được mô tả “bổ huyết, điều kinh, dưỡng huyết”?',options:['Đương Quy','Hoàng Cầm','Đỗ Trọng','Ngưu Tất'],answer:0,explain:'Đương Quy được tài liệu mô tả với công dụng bổ huyết, điều kinh, dưỡng huyết.'},
  {question:'Xuyên Khung được nêu với nhóm công dụng nào?',options:['Bổ can thận, an thai','Hoạt huyết, hành khí, giảm đau đầu','Thanh nhiệt, chỉ tả','Dưỡng huyết, minh mục'],answer:1,explain:'Xuyên Khung: hoạt huyết, hành khí, giảm đau đầu.'},
  {question:'Hoàng Kỳ theo tài liệu có công dụng nào?',options:['Bổ khí, tăng sức đề kháng, lợi tiểu','Thanh nhiệt, giải độc, tiêu đàm','Bổ huyết, thư cân','Bổ thận âm'],answer:0,explain:'Hoàng Kỳ: bổ khí, tăng cường sức đề kháng, lợi tiểu.'},
  {question:'Bạch Chỉ thuộc mô tả nào?',options:['Giải biểu, khu phong, chỉ thống','Bổ huyết, điều kinh','Thanh nhiệt, táo thấp, chỉ ho','Bổ can thận, cường gân cốt'],answer:0,explain:'Bạch Chỉ: giải biểu, khu phong, chỉ thống.'},
  {question:'Hoàng Liên được tài liệu xếp công dụng chính là gì?',options:['Bổ khí','Thanh nhiệt, giải độc, chỉ tả','Dưỡng huyết','Lợi niệu, thư cân'],answer:1,explain:'Hoàng Liên: thanh nhiệt, giải độc, chỉ tả.'},
  {question:'Hoàng Cầm thường được nêu cho ho do đâu?',options:['Phế nhiệt','Khí hư','Huyết hư','Thận dương hư'],answer:0,explain:'Ví dụ trong tài liệu: Hoàng cầm dùng cho ho do phế nhiệt và tiêu chảy do thấp nhiệt.'},
  {question:'Dược liệu nào có mô tả “bổ Can thận, dưỡng huyết, minh mục”?',options:['Xạ Can','Câu Kỷ Tử','Kê Huyết Đằng','Bạch Chỉ'],answer:1,explain:'Câu Kỷ Tử: bổ Can thận, dưỡng huyết, minh mục.'},
  {question:'Đỗ Trọng được nêu với công dụng nào?',options:['Bổ can thận, cường gân cốt, an thai','Bổ thận âm, minh mục','Thanh nhiệt, giải độc, chỉ tả','Hoạt huyết, hành khí'],answer:0,explain:'Đỗ Trọng: bổ can thận, cường gân cốt, an thai.'},
  {question:'Ngưu Tất được mô tả với nhóm tác dụng nào?',options:['Hoạt huyết, lợi niệu, thư cân','Bổ khí, kiện tỳ','Bổ huyết, điều kinh','Giải biểu, khu phong'],answer:0,explain:'Ngưu Tất: hoạt huyết, lợi niệu, thư cân.'},
  {question:'Tứ Quân Tử Thang gồm nhóm nào?',options:['Nhân Sâm, Bạch Truật, Phục Linh, Cam Thảo','Đương Quy, Xuyên Khung, Thục Địa, Bạch Thược','Thục Địa, Sơn Thù, Hoài Sơn, Trạch Tả','Hoàng Kỳ, Nhân Sâm, Trần Bì, Sài hồ'],answer:0,explain:'Bốn vị được nêu là Nhân Sâm, Bạch Truật, Phục Linh, Cam Thảo.'},
  {question:'Tứ Vật Thang gồm thành phần nào?',options:['Nhân Sâm, Bạch Truật, Phục Linh, Cam Thảo','Đương Quy, Xuyên Khung, Thục Địa, Bạch Thược','Hoàng Kỳ, Nhục Quế, Phụ Tử, Cam Thảo','Sơn Thù, Hoài Sơn, Trạch Tả, Phục Linh'],answer:1,explain:'Tứ Vật Thang: Đương Quy, Xuyên Khung, Thục Địa, Bạch Thược.'},
  {question:'Bát Trân Thang trong tài liệu được cấu tạo như thế nào?',options:['Lục Vị + Quế Nhục + Phụ Tử','Tứ Quân Tử + Tứ Vật','Tứ Vật + Hoàng Kỳ','Quy Tỳ + Nhục Quế'],answer:1,explain:'Bát Trân Thang = Tứ Quân Tử Thang kết hợp Tứ Vật Thang.'},
  {question:'Thập Toàn Đại Bổ Hoàn được mô tả là Bát Trân Thang cộng thêm gì?',options:['Hoàng Kỳ và Nhục Quế','Quế Nhục và Phụ Tử','Trần Bì và Sài hồ','Sơn Thù và Trạch Tả'],answer:0,explain:'Thập Toàn Đại Bổ Hoàn = Bát Trân Thang + Hoàng Kỳ + Nhục Quế.'},
  {question:'Lục Vị Địa Hoàng Hoàn được nêu với công dụng chính nào?',options:['Bổ thận âm','Bổ thận dương','Bổ khí kiện tỳ','Thanh nhiệt giải độc'],answer:0,explain:'Tài liệu nêu Lục Vị Địa Hoàng Hoàn có công dụng bổ thận âm.'},
  {question:'Bát Vị Quế Phụ Hoàn được tạo từ Lục Vị Địa Hoàng Hoàn cộng thêm gì?',options:['Hoàng Kỳ, Nhục Quế','Quế Nhục, Phụ Tử','Đương Quy, Xuyên Khung','Nhân Sâm, Cam Thảo'],answer:1,explain:'Bát Vị Quế Phụ Hoàn = Lục Vị Địa Hoàng Hoàn + Quế Nhục + Phụ Tử.'},
  {question:'“Sao” trong phần bào chế được mô tả như thế nào?',options:['Nấu dược liệu trong nước','Rang trên lửa nhỏ để làm khô và tăng tính ấm','Ngâm trong nước hoặc dung dịch khác','Chỉ phơi dưới nắng'],answer:1,explain:'Tài liệu mô tả sao là rang dược liệu trên lửa nhỏ để làm khô và tăng tính ấm.'},
  {question:'“Tẩm” được tài liệu mô tả là gì?',options:['Ngâm dược liệu trong nước hoặc dung dịch khác','Rang khô trên lửa nhỏ','Sắc 30–45 phút','Nghiền thành bột'],answer:0,explain:'Tẩm là ngâm dược liệu trong nước hoặc dung dịch khác để loại tạp chất hoặc tăng tính chất của thuốc.'},
  {question:'Theo phần “Phương pháp sắc thuốc”, thời gian sắc thuốc thường được nêu là bao lâu?',options:['5–10 phút','15–20 phút','30–45 phút','90–120 phút'],answer:2,explain:'Tài liệu nêu thuốc thường được sắc 30–45 phút, đầu tiên lửa to cho sôi rồi hạ nhỏ lửa.'},
  {question:'Lưu ý an toàn nào được tài liệu nhấn mạnh?',options:['Mọi dược liệu đều dùng được cùng thuốc Tây','Phụ nữ có thai, trẻ em, người già không cần tư vấn','Một số dược liệu có thể tương tác với thuốc Tây','Có thể tự tăng liều nếu triệu chứng nặng'],answer:2,explain:'Tài liệu nhấn mạnh một số dược liệu có thể tương tác với thuốc Tây và cần đặc biệt chú ý.'}
];

const SECTION_SUMMARY=[
  ['1','Dược liệu phổ biến','14 vị: tên Hán, pinyin, công dụng và ví dụ sử dụng theo tài liệu.'],
  ['2','Phân loại dược liệu','Theo tính chất, theo công năng và theo tác dụng đối với cơ thể.'],
  ['3','Bào chế','Sao, tẩm, chích và sắc.'],
  ['4','Phương tễ','8 phương thuốc phổ biến và thành phần – công dụng.'],
  ['5','Cách dùng & lưu ý','Sắc thuốc, thời gian uống, liều lượng, điều chỉnh, bảo quản và thận trọng.']
] as const;

export default function TcmHerbsFormulasLesson(){
  const [mode,setMode]=useState<LessonMode>('lesson');
  const [flashIndex,setFlashIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [answers,setAnswers]=useState<Record<number,number>>({});
  const [submitted,setSubmitted]=useState(false);
  const flashcards=useMemo(()=>[
    ...HERBS.map(item=>({front:item.zh+' · '+item.name,sub:item.pinyin,back:item.actions+' '+item.example})),
    ...FORMULAS.map(item=>({front:item.zh+' · '+item.name,sub:item.pinyin,back:'Thành phần: '+item.components+' Công dụng: '+item.actions}))
  ],[]);
  const score=QUIZ.reduce((sum,item,index)=>sum+(answers[index]===item.answer?1:0),0);
  const resetQuiz=()=>{setAnswers({});setSubmitted(false)};
  const nextCard=(step:number)=>{setFlashIndex(index=>(index+step+flashcards.length)%flashcards.length);setRevealed(false)};

  return <section className="tcm-lesson" aria-label="Bài học Dược liệu và Phương tễ">
    <header className="tcm-lesson__hero">
      <div><span><Sparkles/> BÀI HỌC TỪ TÀI LIỆU MÔN HỌC</span><h2>Dược liệu &amp; Phương tễ trong Y học cổ truyền</h2><p>Học theo nội dung tài liệu của ThS.BS Nhan Hồng Tâm · ưu tiên nhớ tên Hán – pinyin – công dụng – phối phương.</p></div>
      <BookOpen aria-hidden="true"/>
    </header>

    <div className="tcm-lesson__source-note"><CheckCircle2/><span><b>Nguồn bài học:</b> file “DƯỢC LIỆU VÀ PHƯƠNG TỄ TRONG Y HỌC CỔ TRUYỀN”. Nội dung bên dưới bám theo tài liệu đã cung cấp, dùng cho học tập và không thay thế chỉ định điều trị.</span></div>

    <nav className="tcm-lesson__modes" aria-label="Chế độ học">
      <button className={mode==='lesson'?'active':''} onClick={()=>setMode('lesson')}><BookOpen/> Bài học</button>
      <button className={mode==='flashcards'?'active':''} onClick={()=>setMode('flashcards')}><Layers3/> Flashcard <small>{flashcards.length}</small></button>
      <button className={mode==='quiz'?'active':''} onClick={()=>setMode('quiz')}><CircleHelp/> Tự kiểm tra <small>{QUIZ.length}</small></button>
    </nav>

    {mode==='lesson'&&<div className="tcm-lesson__content">
      <div className="tcm-lesson__outline">{SECTION_SUMMARY.map(item=><article key={item[0]}><i>{item[0]}</i><div><b>{item[1]}</b><small>{item[2]}</small></div></article>)}</div>

      <article className="tcm-lesson__chapter">
        <div className="tcm-lesson__chapter-head"><span>01</span><div><h3>Dược liệu phổ biến</h3><p>14 vị xuất hiện trong tài liệu.</p></div></div>
        <div className="tcm-lesson__grid">{HERBS.map((herb,index)=><details className="tcm-lesson__card" key={herb.name} open={index<2}><summary><span className="tcm-lesson__han">{herb.zh}</span><span><b>{herb.name}</b><small>{herb.pinyin}</small></span></summary><div><p><strong>Công dụng:</strong> {herb.actions}</p><p><strong>Ví dụ theo tài liệu:</strong> {herb.example}</p></div></details>)}</div>
      </article>

      <article className="tcm-lesson__chapter">
        <div className="tcm-lesson__chapter-head"><span>02</span><div><h3>Phân loại dược liệu</h3><p>Ba cách phân loại được trình bày trong tài liệu.</p></div></div>
        <div className="tcm-lesson__three">
          <section><b>Theo tính chất</b><p>Hàn (lạnh), nhiệt (nóng), ôn (ấm), lương (mát).</p><small>Ví dụ: dược liệu tính hàn dùng để thanh nhiệt giải độc như Hoàng liên; dược liệu tính ôn dùng để bổ khí dưỡng huyết như Nhân sâm.</small></section>
          <section><b>Theo công năng</b><p>Bổ khí, dưỡng huyết, thanh nhiệt, giải độc.</p><small>Ví dụ: bổ khí gồm Hoàng kỳ, Nhân sâm; thanh nhiệt gồm Kim ngân hoa, Liên kiều.</small></section>
          <section><b>Theo tác dụng đối với cơ thể</b><p>Bổ dưỡng, giải độc, tiêu thực.</p><small>Ví dụ: bổ ích có Đương quy, Thục địa hoàng; tiêu thực có Sơn tra.</small></section>
        </div>
      </article>

      <article className="tcm-lesson__chapter">
        <div className="tcm-lesson__chapter-head"><span>03</span><div><h3>Cách bào chế dược liệu</h3><p>Bốn phương pháp được nêu trong tài liệu.</p></div></div>
        <div className="tcm-lesson__process">
          <section><b>炒 Chǎo · Sao</b><p>Làm khô và tăng tính ấm của dược liệu bằng cách rang trên lửa nhỏ.</p><small>Ví dụ tài liệu: Hoàng kỳ có thể sao trước khi dùng để tăng cường hiệu quả bổ khí.</small></section>
          <section><b>浸 Jìn · Tẩm</b><p>Ngâm dược liệu trong nước hoặc dung dịch khác để loại bỏ tạp chất hoặc tăng tính chất của thuốc.</p><small>Ví dụ tài liệu: Hà thủ ô cần ngâm trong rượu trước khi sử dụng.</small></section>
          <section><b>炙 Zhì · Chích</b><p>Tài liệu mô tả là gia nhiệt/nướng dược liệu để tăng tính ấm hoặc làm giảm độc tính.</p><small>Ví dụ tài liệu: Phụ tử cần được nướng qua trước khi sử dụng để giảm độc tính.</small></section>
          <section><b>煎 Jiān · Sắc</b><p>Nấu dược liệu trong nước để chiết xuất các thành phần hoạt chất có tác dụng điều trị.</p><small>Nhiều thuốc Đông y cần sắc trước khi dùng theo nội dung tài liệu.</small></section>
        </div>
      </article>

      <article className="tcm-lesson__chapter">
        <div className="tcm-lesson__chapter-head"><span>04</span><div><h3>Phương tễ phổ biến</h3><p>8 phương thuốc, tập trung học thành phần và công dụng.</p></div></div>
        <div className="tcm-lesson__formula-list">{FORMULAS.map((formula,index)=><details key={formula.name} className="tcm-lesson__formula" open={index<2}><summary><span><em>{formula.zh}</em><b>{formula.name}</b><small>{formula.pinyin}</small></span></summary><div><p><strong>Thành phần:</strong> {formula.components}</p><p><strong>Công dụng:</strong> {formula.actions}</p></div></details>)}</div>
      </article>

      <article className="tcm-lesson__chapter">
        <div className="tcm-lesson__chapter-head"><span>05</span><div><h3>Cách dùng, điều chỉnh và lưu ý</h3><p>Tóm tắt đúng các mốc và cảnh báo có trong tài liệu.</p></div></div>
        <div className="tcm-lesson__notes">
          <section><b>Sắc thuốc</b><p>Cần chú ý lửa và thời gian. Một phần tài liệu nêu lửa nhỏ khoảng 30 phút; phần phương pháp sắc thuốc nêu 30–45 phút, đun lửa to cho sôi rồi hạ nhỏ lửa.</p></section>
          <section><b>Thời gian uống</b><p>Tài liệu có hai mốc: trước hoặc sau bữa ăn 30 phút; ở phần sau nêu trước bữa ăn 30 phút hoặc sau bữa ăn 1 giờ. Bài học giữ nguyên cả hai để người học nhận biết và đối chiếu với giảng viên.</p></section>
          <section><b>Liều lượng &amp; điều chỉnh</b><p>Liều cần điều chỉnh theo tình trạng bệnh và thể trạng. Ví dụ trong tài liệu: chứng nhiệt có thể giảm thuốc tính ôn; người thể hư lấy bổ khí, bổ huyết làm chính.</p></section>
          <section><b>Nước và bảo quản</b><p>Dùng nước sạch; tài liệu gợi ý nước suối hoặc nước tinh khiết. Thuốc sắc nên dùng trong ngày, nếu chưa dùng hết có thể bảo quản tủ lạnh.</p></section>
          <section><b>Cách uống</b><p>Dùng nước ấm, tránh uống cùng nước lạnh hoặc nước trà theo tài liệu.</p></section>
          <section className="tcm-lesson__warning"><b>Thận trọng</b><p>Một số dược liệu có thể tương tác với thuốc Tây. Phụ nữ có thai, trẻ em và người già cần đặc biệt thận trọng và nên dùng dưới hướng dẫn của bác sĩ. Tài liệu cũng khuyên tránh thức ăn cay nóng, nhiều dầu mỡ trong thời gian dùng thuốc.</p></section>
        </div>
      </article>
    </div>}

    {mode==='flashcards'&&<div className="tcm-flash">
      <div className="tcm-flash__progress"><span>Thẻ {flashIndex+1}/{flashcards.length}</span><strong>{Math.round(((flashIndex+1)/flashcards.length)*100)}%</strong></div>
      <button className={'tcm-flash__card '+(revealed?'revealed':'')} onClick={()=>setRevealed(value=>!value)} aria-label="Lật flashcard">
        <div><span>{revealed?'ĐÁP ÁN':'NHẬN DIỆN'}</span><h3>{flashcards[flashIndex].front}</h3><p>{flashcards[flashIndex].sub}</p>{revealed?<strong>{flashcards[flashIndex].back}</strong>:<small>Chạm để xem công dụng / thành phần</small>}</div>
      </button>
      <div className="tcm-flash__controls"><button onClick={()=>nextCard(-1)}>← Thẻ trước</button><button onClick={()=>setRevealed(value=>!value)}>{revealed?'Ẩn đáp án':'Xem đáp án'}</button><button onClick={()=>nextCard(1)}>Thẻ sau →</button></div>
    </div>}

    {mode==='quiz'&&<div className="tcm-quiz">
      <div className="tcm-quiz__head"><div><b>Tự kiểm tra 20 câu</b><small>Chọn một đáp án cho mỗi câu. Câu hỏi chỉ dùng nội dung trong tài liệu.</small></div>{submitted&&<div className="tcm-quiz__score"><strong>{score}/{QUIZ.length}</strong><span>{Math.round(score/QUIZ.length*100)}%</span></div>}</div>
      <div className="tcm-quiz__list">{QUIZ.map((item,index)=><article key={item.question} className={submitted?(answers[index]===item.answer?'correct':'incorrect'):''}><p><b>Câu {index+1}.</b> {item.question}</p><div>{item.options.map((option,optionIndex)=><label key={option}><input type="radio" name={'tcm-q-'+index} checked={answers[index]===optionIndex} disabled={submitted} onChange={()=>setAnswers(current=>({...current,[index]:optionIndex}))}/><span>{String.fromCharCode(65+optionIndex)}. {option}</span></label>)}</div>{submitted&&<small><strong>Đáp án: {String.fromCharCode(65+item.answer)}.</strong> {item.explain}</small>}</article>)}</div>
      <div className="tcm-quiz__actions">{!submitted?<button disabled={Object.keys(answers).length<QUIZ.length} onClick={()=>setSubmitted(true)}><CheckCircle2/> Chấm điểm</button>:<button onClick={resetQuiz}><RotateCcw/> Làm lại</button>}<span>{Object.keys(answers).length}/{QUIZ.length} câu đã trả lời</span></div>
    </div>}
  </section>;
}
