import fs from 'node:fs';

const edge=fs.readFileSync('supabase/functions/admin-reset-member-password/index.ts','utf8');
const service=fs.readFileSync('src/services/adminService.ts','utf8');
const ui=fs.readFileSync('src/components/admin/AdminControlCenter.tsx','utf8');

const checks=[
  [edge.includes("actor.role!=='admin'"),'Edge Function must require admin role'],
  [edge.includes('admin.auth.getUser(token)'),'Edge Function must validate the caller JWT'],
  [edge.includes("target.role==='admin'"),'Edge Function must block resetting another admin'],
  [edge.includes('target.data_conflict===true'),'Edge Function must block conflicted identities'],
  [edge.includes('admin.auth.admin.updateUserById'),'Edge Function must use server-side Auth Admin password update'],
  [edge.includes("action:'member.password_reset'"),'Password reset must be audited'],
  [!edge.includes('metadata:{temporaryPassword'),'Audit metadata must not contain the temporary password'],
  [service.includes('/functions/v1/admin-reset-member-password'),'Client service must call the protected Edge Function'],
  [service.includes("Authorization:'Bearer '+session.access_token"),'Client must send the authenticated Admin access token'],
  [ui.includes('Reset mật khẩu'),'ACC must expose the reset action'],
  [ui.includes('temporaryPassword'),'ACC must display the one-time temporary password']
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length){for(const [,message] of failed)console.error('FAIL',message);process.exit(1)}
console.log('Admin password reset contract PASS');
