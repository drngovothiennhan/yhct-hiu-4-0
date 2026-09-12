export type StudyOsIntent='ask'|'learn'|'quiz'|'research';
export type StudyOsDestination='assistant'|'exam'|'research';
export type StudyOsPlan={intent:StudyOsIntent;destination:StudyOsDestination;query:string;reason:'research-rule'|'quiz-rule'|'learn-rule'|'default'};

const normalize=(value:string)=>value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/đ/g,'d')
  .replace(/Đ/g,'D')
  .replace(/\s+/g,' ')
  .trim()
  .toLowerCase();

const RESEARCH=/(?:\bpubmed\b|\bopenalex\b|\bdoi\b|\bpmid\b|\brct\b|clinical trial|systematic review|meta[- ]?analysis|nghien cuu|y van|bai bao khoa hoc|bang chung|trich dan|tai lieu tham khao|de cuong nghien cuu|tong quan he thong|thu nghiem lam sang)/i;
const QUIZ=/(?:\bquiz\b|trac nghiem|luyen thi|lam de|lam bai|on sai|cau hoi|flashcard|\bon\b.{0,24}\bcau\b|\b\d{1,3}\s*cau\b)/i;
const LEARN=/(?:hoc|on tap|giai thich|tom tat|he thong hoa|so sanh|phan biet|ghi nho|de hieu|kien thuc)/i;

/**
 * Product-level deterministic router. Provider selection remains behind the
 * canonical AI gateway; this function only decides which existing product
 * capability should receive the request.
 */
export function routeStudyOsRequest(raw:string):StudyOsPlan{
  const query=raw.replace(/\s+/g,' ').trim().slice(0,4000);
  const text=normalize(query);
  if(RESEARCH.test(text))return{intent:'research',destination:'research',query,reason:'research-rule'};
  if(QUIZ.test(text))return{intent:'quiz',destination:'exam',query,reason:'quiz-rule'};
  if(LEARN.test(text))return{intent:'learn',destination:'assistant',query,reason:'learn-rule'};
  return{intent:'ask',destination:'assistant',query,reason:'default'};
}
