import type {
  FusionAdapter,
  ListeningAdapter,
  ObservationAdapter,
  SessionStorageAdapter,
  TongueDiagnosisAdapter,
} from './adapters';
import type { FourExamSessionV1 } from './types';
import { localFusionAdapterV1 } from './engine';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export const mockObservationAdapterV1: ObservationAdapter = {
  id: 'observation-local-v1',
  async analyze() {
    return {
      provider: 'local-mock',
      adapterVersion: '1.0.0',
      confidence: 0.82,
      facePresent: true,
      qualityScore: 0.82,
      lightingScore: 0.78,
      poseScore: 0.88,
      regionMetrics: {
        foreheadLuma: 0.52,
        leftCheekLuma: 0.50,
        rightCheekLuma: 0.51,
      },
    };
  },
};

export const browserListeningAdapterV1: ListeningAdapter = {
  id: 'listening-browser-v1',
  async analyze({ promptIds }) {
    const samples = promptIds.map((promptId, index) => ({
      promptId,
      durationMs: 3500 + index * 160,
      rms: clamp01(0.35 + index * 0.03),
      zeroCrossingRate: clamp01(0.1 + index * 0.01),
      spectralCentroid: 1600 + index * 55,
      pauseRatio: clamp01(0.12 + index * 0.01),
    }));

    return {
      provider: 'browser-local',
      adapterVersion: '1.0.0',
      confidence: 0.78,
      promptIds,
      samples,
    };
  },
};

export const mockTongueDiagnosisAdapterV1: TongueDiagnosisAdapter = {
  id: 'tongue-local-v1',
  async analyze() {
    return {
      provider: 'existing-tongue-engine-adapter-pending',
      adapterVersion: '1.0.0',
      confidence: 0.7,
      tongueColor: 'chưa kết nối engine thật',
      coatingColor: 'chưa kết nối engine thật',
      coatingThickness: 'chưa kết nối engine thật',
      moisture: 'chưa kết nối engine thật',
      fissure: false,
      teethMarks: false,
      qualityScore: 0.7,
    };
  },
};

const STORAGE_KEY = 'tu-chan:v1:sessions';

export const localSessionStorageAdapterV1: SessionStorageAdapter = {
  id: 'storage-local-v1',
  async saveSession(session) {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const sessions: FourExamSessionV1[] = raw ? JSON.parse(raw) : [];
    const next = [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 100);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },
  async listSessions(userId) {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions: FourExamSessionV1[] = JSON.parse(raw);
    return sessions.filter((item) => item.userId === userId);
  },
};

export const localAdaptersV1 = {
  observation: mockObservationAdapterV1,
  listening: browserListeningAdapterV1,
  tongue: mockTongueDiagnosisAdapterV1,
  fusion: localFusionAdapterV1 as FusionAdapter,
  storage: localSessionStorageAdapterV1,
};
