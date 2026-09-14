export type Confidence = number;

export interface AdapterMeta {
  adapterVersion: string;
  provider: string;
  confidence: Confidence;
}

export interface ObservationResultV1 extends AdapterMeta {
  facePresent: boolean;
  qualityScore: number;
  lightingScore: number;
  poseScore: number;
  regionMetrics: Record<string, number>;
}

export interface ListeningPromptResultV1 {
  promptId: string;
  durationMs: number;
  rms: number;
  zeroCrossingRate: number;
  spectralCentroid: number;
  pauseRatio: number;
}

export interface ListeningResultV1 extends AdapterMeta {
  promptIds: string[];
  samples: ListeningPromptResultV1[];
}

export type InquiryAnswerValue = string | number | boolean | string[];

export interface InquiryAnswerV1 {
  questionId: string;
  domain: string;
  value: InquiryAnswerValue;
  tags: string[];
}

export interface InquiryResultV1 extends AdapterMeta {
  questionSetVersion: string;
  answers: InquiryAnswerV1[];
}

export interface TongueResultV1 extends AdapterMeta {
  tongueColor: string;
  coatingColor: string;
  coatingThickness: string;
  moisture: string;
  fissure: boolean;
  teethMarks: boolean;
  qualityScore: number;
}

export interface FusionReportV1 extends AdapterMeta {
  summary: string;
  signals: string[];
  trendNote: string;
  tcmInterpretation: string;
  recommendations: string[];
  redFlags: string[];
}

export interface ProviderVersionsV1 {
  observation: string;
  listening: string;
  inquiry: string;
  tongue: string;
  fusion: string;
}

export interface FourExamSessionV1 {
  id: string;
  userId: string;
  localDate: string;
  startedAt: string;
  completedAt?: string;
  schemaVersion: '1.0.0';
  observation?: ObservationResultV1;
  listening?: ListeningResultV1;
  inquiry?: InquiryResultV1;
  tongue?: TongueResultV1;
  fusionReport?: FusionReportV1;
  providerVersions: ProviderVersionsV1;
}

export type FourExamStep = 'observation' | 'listening' | 'inquiry' | 'tongue' | 'fusion';
