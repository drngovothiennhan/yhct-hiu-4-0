export function normalizeVietnamese(input:string){
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/đ/g,'d')
    .replace(/Đ/g,'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function damerauLevenshtein(a:string,b:string){
  if(a===b)return 0;
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  const curr=new Array<number>(b.length+1);
  const prevPrev=new Array<number>(b.length+1).fill(0);
  for(let i=1;i<=a.length;i++){
    curr[0]=i;
    for(let j=1;j<=b.length;j++){
      const cost=a[i-1]===b[j-1]?0:1;
      curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+cost);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])curr[j]=Math.min(curr[j],prevPrev[j-2]+1);
    }
    for(let j=0;j<=b.length;j++){prevPrev[j]=prev[j];prev[j]=curr[j]}
  }
  return prev[b.length];
}

function nameScore(query:string,name:string){
  const q=normalizeVietnamese(query),n=normalizeVietnamese(name);
  if(!q||!n)return 0;
  if(q===n)return 1;
  if(n.startsWith(q))return .95;
  if(n.includes(q))return .9;
  const qt=q.split(' '),nt=n.split(' ');
  const tokenHits=qt.filter(t=>nt.some(x=>x.startsWith(t)||x.includes(t))).length/qt.length;
  const distance=damerauLevenshtein(q,n);
  const edit=1-distance/Math.max(q.length,n.length,1);
  return Math.max(0,Math.min(1,tokenHits*.68+edit*.32));
}

function maskedStudentScore(query:string,masked:string){
  const q=query.replace(/\D/g,''),m=masked.replace(/\s/g,'');
  if(q.length<2)return 0;
  const prefix=m.slice(0,2).replace(/\D/g,''),suffix=m.slice(-2).replace(/\D/g,'');
  if(q.length>=4&&q.startsWith(prefix)&&q.endsWith(suffix))return .98;
  if(q.startsWith(prefix)||q.endsWith(suffix))return .72;
  return 0;
}

export function rankDrlCandidates<T extends {full_name:string;student_code_masked:string;match_score?:number}>(query:string,rows:T[]){
  const numeric=/^\s*\d[\d\s-]*\s*$/.test(query);
  return rows
    .map(row=>({...row,match_score:numeric?maskedStudentScore(query,row.student_code_masked):nameScore(query,row.full_name)}))
    .filter(row=>Number(row.match_score)>=.18)
    .sort((a,b)=>Number(b.match_score)-Number(a.match_score)||a.full_name.localeCompare(b.full_name,'vi'));
}
