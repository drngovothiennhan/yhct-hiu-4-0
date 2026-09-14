import { inquiryBankV1, listeningPromptBankV1, INQUIRY_BANK_VERSION } from './data';
import type { DailyQuestionV1 } from './data';
import type { FusionAdapter, InquiryEngine } from './adapters';
import type { FourExamSessionV1, FusionReportV1, InquiryResultV1 } from './types';

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededPick<T>(items: T[], seed: number): T {
  if (!items.length) throw new Error('Cannot pick from an empty list');
  return items[seed % items.length];
}

const domainOrder: DailyQuestionV1['domain'][] = [
  'han-nhiet', 'han', 'dau-than', 'nhi-tien', 'am-thuc',
  'hung-phuc', 'thinh-giac', 'ngu', 'cam-xuc', 'khac',
];

export const inquiryEngineV1: InquiryEngine = {
  id: `inquiry-local-${INQUIRY_BANK_VERSION}`,
  buildDailyQuestionIds({ userSeed, localDate }) {
    return domainOrder.map((domain, index) => {
      const group = inquiryBankV1.filter((q) => q.domain === domain);
      return seededPick(group, hashSeed(`${userSeed}:${localDate}:${domain}:${index}`)).id;
    });
  },
  normalizeAnswers(input) {
    return { ...input, questionSetVersion: INQUIRY_BANK_VERSION };
  },
};

export function buildDailyListeningPromptIds(userSeed: string, localDate: string): string[] {
  const pool = [...listeningPromptBankV1];
  const chosen: string[] = [];
  for (let i = 0; i < 5 && pool.length; i += 1) {
    const seed = hashSeed(`${userSeed}:${localDate}:voice:${i}`);
    const index = seed % pool.length;
    chosen.push(pool[index].id);
    pool.splice(index, 1);
  }
  return chosen;
}

function signalFromInquiry(inquiry?: InquiryResultV1): string[] {
  if (!inquiry) return [];
  const positives = inquiry.answers.filter((answer) => answer.value === true || (typeof answer.value === 'number' && answer.value >= 4));
  return positives.slice(0, 4).map((answer) => `Vấn: tín hiệu đáng theo dõi ở nhóm ${answer.domain}.`);
}

export const localFusionAdapterV1: FusionAdapter = {
  id: 'fusion-local-v1',
  async summarize(input): Promise<FusionReportV1> {
    const signals = [
      ...(input.observation && input.observation.qualityScore < 0.65 ? ['Vọng: chất lượng ghi nhận chưa tối ưu, nên theo dõi lại trong điều kiện ánh sáng ổn định.'] : []),
      ...(input.listening && input.listening.confidence < 0.65 ? ['Văn: dữ liệu giọng nói có độ tin cậy thấp, nên ghi lại ở môi trường yên tĩnh.'] : []),
      ...signalFromInquiry(input.inquiry),
      ...(input.tongue && input.tongue.qualityScore < 0.65 ? ['Thiệt: ảnh lưỡi chưa đạt chất lượng tối ưu.'] : []),
    ];

    return {
      provider: 'local-rule-engine',
      adapterVersion: '1.0.0',
      confidence: Math.max(0.4, 1 - signals.length * 0.08),
      summary: signals.length ? 'Có một số thay đổi hoặc dữ liệu cần theo dõi trong phiên Tứ Chẩn hôm nay.' : 'Phiên Tứ Chẩn hôm nay chưa ghi nhận tín hiệu nổi bật từ dữ liệu V1.',
      signals,
      trendNote: 'V1 ưu tiên lưu dữ liệu có cấu trúc để so sánh với baseline cá nhân ở các phiên tiếp theo.',
      tcmInterpretation: 'Kết quả chỉ mang tính hỗ trợ theo dõi theo nguyên lý Y học cổ truyền, không thay thế chẩn đoán của nhân viên y tế.',
      recommendations: ['Duy trì điều kiện ghi nhận tương tự mỗi ngày để tăng giá trị so sánh.', 'Theo dõi thay đổi qua nhiều ngày thay vì dựa vào một phiên đơn lẻ.'],
      redFlags: [],
    };
  },
};

export function createEmptySession(userId: string, localDate: string): FourExamSessionV1 {
  return {
    id: `${userId}:${localDate}:${Date.now()}`,
    userId,
    localDate,
    startedAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
    providerVersions: {
      observation: 'pending',
      listening: 'pending',
      inquiry: inquiryEngineV1.id,
      tongue: 'pending',
      fusion: localFusionAdapterV1.id,
    },
  };
}
