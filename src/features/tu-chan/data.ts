export interface DailyQuestionV1 {
  id: string;
  domain: 'han-nhiet' | 'han' | 'dau-than' | 'nhi-tien' | 'am-thuc' | 'hung-phuc' | 'thinh-giac' | 'ngu' | 'cam-xuc' | 'khac';
  prompt: string;
  type: 'yes-no' | 'scale' | 'single';
  tags: string[];
}

export const INQUIRY_BANK_VERSION = '1.0.0';

export const inquiryBankV1: DailyQuestionV1[] = [
  { id: 'q-hn-01', domain: 'han-nhiet', prompt: 'Hôm nay bạn thấy cơ thể thiên về lạnh hay nóng hơn bình thường?', type: 'single', tags: ['han-nhiet'] },
  { id: 'q-hn-02', domain: 'han-nhiet', prompt: 'Bạn có cảm giác sợ lạnh hoặc nóng bứt rứt rõ hơn hôm qua không?', type: 'yes-no', tags: ['han-nhiet'] },
  { id: 'q-han-01', domain: 'han', prompt: 'Bạn có ra mồ hôi bất thường khi nghỉ ngơi không?', type: 'yes-no', tags: ['han'] },
  { id: 'q-han-02', domain: 'han', prompt: 'Mức độ ra mồ hôi hôm nay thay đổi thế nào so với thường ngày?', type: 'scale', tags: ['han'] },
  { id: 'q-dt-01', domain: 'dau-than', prompt: 'Bạn có đau đầu, nặng đầu hoặc mỏi thân thể hôm nay không?', type: 'yes-no', tags: ['dau-than'] },
  { id: 'q-dt-02', domain: 'dau-than', prompt: 'Mức độ mệt hoặc đau mỏi toàn thân hôm nay là bao nhiêu?', type: 'scale', tags: ['dau-than'] },
  { id: 'q-nt-01', domain: 'nhi-tien', prompt: 'Đại tiện hôm nay có khác thường về số lần hoặc tính chất không?', type: 'yes-no', tags: ['dai-tien'] },
  { id: 'q-nt-02', domain: 'nhi-tien', prompt: 'Tiểu tiện hôm nay có thay đổi rõ về số lần, màu hoặc cảm giác không?', type: 'yes-no', tags: ['tieu-tien'] },
  { id: 'q-at-01', domain: 'am-thuc', prompt: 'Cảm giác thèm ăn của bạn hôm nay có giảm hoặc tăng bất thường không?', type: 'yes-no', tags: ['an-uong'] },
  { id: 'q-at-02', domain: 'am-thuc', prompt: 'Bạn có khát nhiều, khô miệng hoặc thay đổi khẩu vị rõ rệt không?', type: 'yes-no', tags: ['khau-vi'] },
  { id: 'q-hp-01', domain: 'hung-phuc', prompt: 'Bạn có cảm giác tức ngực, đầy bụng hoặc khó chịu vùng ngực-bụng không?', type: 'yes-no', tags: ['hung-phuc'] },
  { id: 'q-hp-02', domain: 'hung-phuc', prompt: 'Mức độ đầy tức ngực-bụng hôm nay là bao nhiêu?', type: 'scale', tags: ['hung-phuc'] },
  { id: 'q-tg-01', domain: 'thinh-giac', prompt: 'Bạn có ù tai, nghe kém hoặc cảm giác âm thanh khác thường hôm nay không?', type: 'yes-no', tags: ['thinh-giac'] },
  { id: 'q-tg-02', domain: 'thinh-giac', prompt: 'Tai của bạn hôm nay có khó chịu hơn thường lệ không?', type: 'scale', tags: ['thinh-giac'] },
  { id: 'q-ngu-01', domain: 'ngu', prompt: 'Đêm qua bạn có khó ngủ, ngủ không sâu hoặc thức giấc nhiều không?', type: 'yes-no', tags: ['ngu'] },
  { id: 'q-ngu-02', domain: 'ngu', prompt: 'Chất lượng giấc ngủ đêm qua bạn tự đánh giá bao nhiêu?', type: 'scale', tags: ['ngu'] },
  { id: 'q-cx-01', domain: 'cam-xuc', prompt: 'Hôm nay bạn có căng thẳng, dễ cáu hoặc lo âu hơn thường ngày không?', type: 'yes-no', tags: ['cam-xuc'] },
  { id: 'q-cx-02', domain: 'cam-xuc', prompt: 'Mức độ căng thẳng cảm nhận hôm nay là bao nhiêu?', type: 'scale', tags: ['cam-xuc'] },
  { id: 'q-k-01', domain: 'khac', prompt: 'Bạn có triệu chứng mới nào xuất hiện từ hôm qua đến nay không?', type: 'yes-no', tags: ['trieu-chung-moi'] },
  { id: 'q-k-02', domain: 'khac', prompt: 'Nhìn chung sức khỏe hôm nay của bạn khác thường rõ rệt không?', type: 'yes-no', tags: ['tong-quat'] },
];

export const listeningPromptBankV1 = [
  { id: 'v-01', text: 'Sáng nay tôi cảm thấy hơi thở đều và giọng nói tự nhiên.' },
  { id: 'v-02', text: 'Tôi đọc chậm, rõ từng tiếng và giữ nhịp thở ổn định.' },
  { id: 'v-03', text: 'Âm thanh phát ra liên tục, không gắng sức và không nói quá nhanh.' },
  { id: 'v-04', text: 'Hôm nay cơ thể tôi đang ở trạng thái bình thường như mọi ngày.' },
  { id: 'v-05', text: 'Tôi giữ đầu thẳng, thả lỏng vai và đọc câu này bằng giọng tự nhiên.' },
  { id: 'v-06', text: 'Buổi sáng yên tĩnh giúp tôi nghe rõ độ vang và độ ổn định của giọng.' },
  { id: 'v-07', text: 'Tôi nói câu này với âm lượng vừa phải, không cố làm giọng trầm hay cao.' },
  { id: 'v-08', text: 'Nhịp nói hôm nay của tôi chậm vừa, đều và dễ nghe.' },
  { id: 'v-09', text: 'Tôi hít vào nhẹ nhàng rồi đọc hết câu mà không gắng sức.' },
  { id: 'v-10', text: 'Giọng nói tự nhiên của tôi được ghi lại để so sánh với chính mình theo thời gian.' },
];
