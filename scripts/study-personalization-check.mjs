import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildStudySummaryText} from '../src/services/studyPersonalizationSummary.ts';

const attempt=(overrides={})=>({
  subject:'Bệnh học YHCT',topic:'Hàn nhiệt',correct_count:2,wrong_count:3,attempts:5,
  last_seen_at:'2026-09-18T09:00:00.000Z',accuracy_pct:40,source_file_id:'drive-real-id',
  source_title:'Tài liệu Hàn nhiệt',days_since_seen:9,...overrides
});
const base={hasData:true,state:'personalized',generatedFor:'2026-09-27',lessonProgress:null,recommendation:null,reviewSummary:{weakestTopic:attempt(),staleTopic:attempt(),lastQuizAt:'2026-09-18T09:00:00.000Z'}};

assert.equal(buildStudySummaryText({...base,state:'empty',reviewSummary:null}),null,'no quiz data must produce a truthful empty state');
const sameTopic=buildStudySummaryText(base);
assert.equal(sameTopic.length,2,'one topic that is both weak and stale should make a compact two-sentence summary');
assert.match(sameTopic[0],/Hàn nhiệt/);
assert.match(sameTopic[0],/40%/);
assert.match(sameTopic[0],/5 lượt/);
assert.match(sameTopic[1],/Tài liệu Hàn nhiệt/);

const separate=buildStudySummaryText({...base,reviewSummary:{
  weakestTopic:attempt({topic:'Dược liệu',accuracy_pct:25,wrong_count:6,attempts:8,last_seen_at:'2026-09-26T09:00:00.000Z',days_since_seen:1}),
  staleTopic:attempt({topic:'Phương tễ',days_since_seen:14}),lastQuizAt:'2026-09-26T09:00:00.000Z'
}});
assert.equal(separate.length,3,'distinct stale and weak topics must be explained in at most three sentences');
assert.match(separate[0],/Phương tễ/);
assert.match(separate[1],/Dược liệu/);
assert.match(separate[1],/25%/);

const migration=fs.readFileSync('supabase/migrations/20260927055633_study_os_personalization_v1.sql','utf8');
for(const marker of [
  'alter table public.study_lesson_progress_v1 enable row level security',
  'private.current_member_id()',
  'private.is_approved()',
  'revoke all on public.study_lesson_progress_v1 from public, anon, authenticated',
  'grant execute on function public.study_os_personalization_summary_v1() to authenticated',
  'public.daily_practice_question_stats',
  'public.daily_study_review_questions_v1',
  "interval '7 days'",
  "'tcm-herbs-formulas-v1'"
])assert.ok(migration.includes(marker),`migration must enforce/preserve ${marker}`);
assert.ok(!migration.includes('random()'),'personalized recommendations must be deterministic');

console.log('Study OS personalization contract PASS: summaries use supplied quiz accuracy and recency; empty data stays empty; RPC is member-scoped and deterministic.');
