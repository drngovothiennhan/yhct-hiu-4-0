import type {
  FusionReportV1,
  FourExamSessionV1,
  InquiryResultV1,
  ListeningResultV1,
  ObservationResultV1,
  TongueResultV1,
} from './types';

export interface ObservationAdapter {
  readonly id: string;
  analyze(input: { capturedAt: string }): Promise<ObservationResultV1>;
}

export interface ListeningAdapter {
  readonly id: string;
  analyze(input: { promptIds: string[]; capturedAt: string }): Promise<ListeningResultV1>;
}

export interface TongueDiagnosisAdapter {
  readonly id: string;
  analyze(input: { imageDataUrl?: string; capturedAt: string }): Promise<TongueResultV1>;
}

export interface FusionAdapter {
  readonly id: string;
  summarize(input: Pick<FourExamSessionV1, 'observation' | 'listening' | 'inquiry' | 'tongue'>): Promise<FusionReportV1>;
}

export interface SessionStorageAdapter {
  readonly id: string;
  saveSession(session: FourExamSessionV1): Promise<void>;
  listSessions(userId: string): Promise<FourExamSessionV1[]>;
}

export interface InquiryEngine {
  readonly id: string;
  buildDailyQuestionIds(input: { userSeed: string; localDate: string }): string[];
  normalizeAnswers(input: InquiryResultV1): InquiryResultV1;
}
