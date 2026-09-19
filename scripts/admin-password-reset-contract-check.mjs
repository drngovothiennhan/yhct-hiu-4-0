import fs from 'node:fs';

const edge=fs.readFileSync('supabase/functions/admin-reset-member-password/index.ts','utf8');
const service=fs.readFileSync('src/services/adminService.ts','utf8');
const ui=fs.readFileSync('src/components/admin/AdminControlCenter.tsx','utf8');
const auth=fs.readFileSync('src/services/authService.ts','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');

const checks=[
  [edge.includes("actor.role!=='admin'"),'Edge Function must require admin role'],
  [edge.includes('admin.auth.getUser(token)'),'Edge Function must validate the caller JWT'],
  [edge.includes("target.role==='admin'"),'Edge Function must block resetting another admin'],
  [edge.includes('target.data_conflict===true'),'Edge Function must block conflicted identities'],
  [edge.includes("generateLink({type:'recovery'"),'Edge Function must issue a recovery link instead of exposing a password'],
  [edge.includes("action:'member.password_recovery_link'"),'Recovery-link generation must be audited'],
  [!edge.includes('temporaryPassword'),'Edge Function must not return a temporary password'],
  [!edge.includes('metadata:{recoveryUrl'),'Audit metadata must not contain the recovery URL'],
  [service.includes('/functions/v1/admin-reset-member-password'),'Client service must call the protected Edge Function'],
  [service.includes("Authorization:'Bearer '+session.access_token"),'Client must send the authenticated Admin access token'],
  [ui.includes('Reset mật khẩu'),'ACC must expose the reset action'],
  [ui.includes('recoveryUrl'),'ACC must display the one-time recovery link'],
  [auth.includes('detectSessionInUrl:true'),'Supabase client must accept the recovery session returned by the reset link'],
  [app.includes("event==='PASSWORD_RECOVERY'"),'App must detect password recovery sessions'],
  [app.includes('supabase.auth.updateUser({password:recoveryPassword})'),'User must set the new password inside the authenticated recovery session']
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length){for(const [,message] of failed)console.error('FAIL',message);process.exit(1)}
console.log('Admin password recovery contract PASS');
