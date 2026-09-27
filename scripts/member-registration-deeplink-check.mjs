import fs from 'node:fs';

const source = fs.readFileSync('src/components/auth/SelfRegistrationPortal.tsx', 'utf8');
const required = [
  "get('auth')==='register'",
  "supabase.auth.onAuthStateChange",
  "event==='INITIAL_SESSION'",
  "supabase.auth.getSession()",
  "if(!authResolved||hidden)return null;",
  "setOpen(true)",
  "url.searchParams.delete('auth')",
  "registerMemberSelf({studentCode,fullName:form.fullName,className:form.className,faculty:form.faculty,email:form.email,password:form.password})",
];
const missing = required.filter((marker) => !source.includes(marker));
if (missing.length) {
  console.error('Member registration deep-link check failed:');
  for (const marker of missing) console.error(`- missing ${marker}`);
  process.exit(1);
}
console.log('member-registration-deeplink-ok: auth is resolved before rendering; guest deep link opens the existing registration form.');
