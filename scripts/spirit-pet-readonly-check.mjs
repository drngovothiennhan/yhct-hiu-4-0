import fs from 'node:fs';

const service = fs.readFileSync('src/services/spiritPetService.ts', 'utf8');
const card = fs.readFileSync('src/components/home/SpiritPetCard.tsx', 'utf8');
const home = fs.readFileSync('src/components/home/StudyHubV2.tsx', 'utf8');
const fail = [];
const need = (body, token, label) => { if (!body.includes(token)) fail.push(`${label}: missing ${token}`); };
const forbid = (body, token, label) => { if (body.includes(token)) fail.push(`${label}: forbidden ${token}`); };

// Linh thú trong Study OS chỉ đọc hồ sơ dùng chung.
need(service, ".from('spirit_pet_profiles')", 'pet service reads shared profile table');
need(service, ".eq('member_id',memberId)", 'pet read is scoped to the signed-in member');
forbid(service, '.insert(', 'pet service must not write');
forbid(service, '.upsert(', 'pet service must not write');
forbid(service, '.update(', 'pet service must not write');
forbid(service, 'localStorage', 'pet species must not be cached in localStorage');
forbid(service, 'rpc(', 'pet service must not call initialize/set RPCs');
forbid(card, 'localStorage', 'pet card must not persist species locally');
forbid(card, 'Math.random', 'pet species must not be randomised client-side');

// Không kéo các module AI vào linh thú.
for (const token of ['gemini', 'openai', 'askXiaoZhiMini', 'studyAiService', 'academicAiService', 'fetch(\'/api/ai']) {
  forbid(service + card, token, 'pet must not depend on AI modules');
}

// Được mount đúng một lần trên trang chủ học.
need(home, '<SpiritPetCard memberId={memberId}', 'Study home mounts the pet card');
if ((home.match(/<SpiritPetCard\b/g) || []).length !== 1) fail.push('Study home must mount the pet card exactly once');

if (fail.length) {
  console.error('SPIRIT PET READ-ONLY CHECK FAILED');
  fail.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}
console.log('spirit-pet-readonly-ok: Study OS reads shared HIU TMC species one-way; no client writes, no AI coupling, one home mount.');
