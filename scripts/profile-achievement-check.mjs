import fs from 'node:fs';

const read=path=>fs.readFileSync(path,'utf8');
const profile=read('src/components/profile/ProfileCenter.tsx');
const achievements=read('src/components/profile/ProfileAchievements.tsx');
const service=read('src/services/profileAchievementService.ts');
const journey=read('src/services/studentJourneyService.ts');
const game=read('src/components/game/HiuYQuanEngagementV20.tsx');

const serverTitles=['Học đồ HIU','Tân thủ Biện chứng','Cao thủ Tứ chẩn','Danh y mô phỏng'];
const clientXpThreshold=/\bxp\s*(?:>=|<=|>|<)\s*\d+/i;
const checks=[
  ['Profile mounts achievements as an isolated child',profile.includes("import ProfileAchievements from './ProfileAchievements'")&&profile.includes('<ProfileAchievements member={member}/>')],
  ['learning metrics read the existing member-scoped Student Journey',achievements.includes('readStudentJourney(member.id)')&&achievements.includes('subscribeStudentJourney(member.id,setJourney)')],
  ['Profile uses the real Student Journey field names',achievements.includes('journey.moduleVisits')&&journey.includes('moduleVisits:Partial<Record<ModuleId,number>>')&&!achievements.includes('visitedModules')],
  ['device-local learning metrics are labeled honestly',achievements.includes('Tiến độ học trên thiết bị này')&&achievements.includes('Lưu trên thiết bị này')],
  ['last exam score uses the existing 0-100 normalized source',journey.includes('Math.min(100')&&journey.includes('lastExamScore:safeScore')&&achievements.includes('journey.lastExamScore')],
  ['game profile reads only the server-authoritative engagement RPC',service.includes("supabase.rpc('hiu_y_quan_engagement_v15'")&&game.includes("safeCall<Engagement>('hiu_y_quan_engagement_v15')")],
  ['Profile does not derive or hardcode any HIU Y Quan title',!serverTitles.some(title=>achievements.includes(title)||service.includes(title))&&!clientXpThreshold.test(service)],
  ['game title is validated from RPC payload before rendering',service.includes("typeof raw.title==='string'?raw.title.trim():''")&&service.includes('if(xp===null||level===null||level<1||streakDays===null||masteryUnlocked===null||!title)')&&achievements.includes('{game.title}')],
  ['game synchronization fails soft without breaking the profile',achievements.includes('catch{setGame(null);setGameUnavailable(true)}')&&achievements.includes('Hồ sơ và tiến độ học vẫn hoạt động bình thường')],
  ['profile achievement surface is read-only toward game progression',!service.match(/claim|answer|vote|busy_shift|update|insert|delete/i)&&!achievements.match(/claimDaily|answerChallenge|voteConsult|activateBusy/)],
  ['responsive achievement layout is isolated from legacy profile CSS module',achievements.includes("import './profile-achievements.css'")&&fs.existsSync('src/components/profile/profile-achievements.css')],
];

let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
if(failed){console.error(`Profile achievement contract failed: ${failed} check(s)`);process.exit(1)}
console.log('Profile learning achievement + server-authoritative game title contract passed.');
