import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const fail=[];
const need=(body,tokens,label)=>{for(const token of tokens)if(!body.includes(token))fail.push(`${label} missing ${token}`)};
const mini=read('src/components/ai/UnifiedAiMini.tsx');
const research=read('src/components/research/ResearchAiMini.tsx');
const quiz=read('api/_lib/quiz-workspace.js');
const acc=read('src/components/admin/QuizImportCenter.tsx');
const xz=read('src/services/xiaozhiMiniService.ts');
need(mini,['Trợ lý ứng dụng','herb_garden_wallet_v1',"from('notifications')",'academicIntent','openResearch(text)','askXiaoZhiMini'],'AI Mini application assistant');
if(mini.includes('askAcademicUnified'))fail.push('AI Mini must not execute academic AI directly');
if(mini.includes('searchOpenAlex')||mini.includes('searchDriveRag')||mini.includes('searchKnowledge'))fail.push('AI Mini must not own research retrieval');
need(xz,['hiu.vn','fanpage chính thức','appAssistantQuery'],'official HIU source policy');
need(research,['Gemini Research · Leader','RESEARCH_LEADER=GEMINI','threadContext(messages)','result.suggestedQueries','searchOpenAlex(text,6)','searchDriveRag',"searchKnowledge(text,'all',5)"],'Gemini Research leader');
need(quiz,['createGeminiJson','geminiAiConfigured','gemini-quiz-designer-v1','Chỉ được dùng thông tin nằm trong SOURCE','reviewStatus:\'expert_approved\'','adminConfirmed:true'],'Gemini quiz designer');
need(acc,['Tài liệu → Ngân hàng trắc nghiệm','conversionMode','Gemini thiết kế trắc nghiệm từ tài liệu','Tải tài liệu trực tiếp tại ACC','Đồng bộ & chuyển đổi'],'ACC Drive-to-quiz UX');
if(fail.length){console.error('AI ROLE CONTRACT FAILED');fail.forEach(x=>console.error(`- ${x}`));process.exit(1)}
console.log('AI role contract PASS: App Assistant / Gemini Research Leader / ACC Gemini Quiz boundaries are enforced.');
