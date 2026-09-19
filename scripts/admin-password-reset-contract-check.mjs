import fs from 'node:fs';

const edge=fs.readFileSync('supabase/functions/admin-reset-member-password/index.ts','utf8');
const memberLogin=fs.readFileSync('supabase/functions/member-login/index.ts','utf8');
const memberChange=fs.readFileSync('supabase/functions/member-change-password/index.ts','utf8');
const service=fs.readFileSync('src/services/adminService.ts','utf8');
const ui=fs.readFileSync('src/components/admin/AdminControlCenter.tsx','utf8');
const app=fs.readFileSync('src/App.tsx','utf8');

const checks=[
  [edge.includes("actor.role!=='admin'"),'Edge Function must require admin role'],
  [edge.includes('admin.auth.getUser(token)'),'Edge Function must validate the caller JWT'],
  [edge.includes("target.role==='admin'"),'Edge Function must block resetting another admin'],
  [edge.includes('target.data_conflict===true'),'Edge Function must block conflicted identities'],
  [edge.includes('password:studentCode'),'Admin reset must restore the default password to MSSV'],
  [edge.includes('must_change_password:true'),'Admin reset must require a password change'],
  [edge.includes("action:'member.password_reset_default'"),'Default-password reset must be audited'],
  [!edge.includes('recoveryUrl'),'Admin reset must not expose a recovery URL'],
  [!edge.includes('temporaryPassword'),'Admin reset must not return a temporary password'],
  [service.includes('/functions/v1/admin-reset-member-password'),'Client service must call the protected Edge Function'],
  [service.includes("Authorization:'Bearer '+session.access_token"),'Client must send the authenticated Admin access token'],
  [service.includes('body.resetToDefault!==true'),'Client must verify reset-to-default response'],
  [ui.includes('mật khẩu mặc định = MSSV'),'ACC must explain the default MSSV reset'],
  [ui.includes('bắt buộc đổi mật khẩu'),'ACC must explain the forced change after reset'],
  [app.includes('forcePasswordChange'),'App must maintain a forced-password-change gate'],
  [app.includes('completeForcedPasswordChange'),'App must provide the mandatory change flow'],
  [app.includes('changeMemberPassword(forceCurrentPassword,next)'),'Forced change must use the protected backend password flow'],
  [app.includes("userData.user?.app_metadata?.must_change_password"),'App must read the authoritative Auth flag'],
  [memberLogin.includes('!legacy.last_sign_in_at'),'Automatic MSSV repair must only target never-activated Auth users'],
  [memberLogin.includes("password===studentCode"),'Automatic repair must require the default MSSV credential attempt'],
  [memberLogin.includes("member-bulk-import-mssv-repair"),'Bulk-import credential repair must be explicitly marked'],
  [memberChange.includes('must_change_password:false'),'Successful password change must clear the mandatory flag']
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length){for(const [,message] of failed)console.error('FAIL',message);process.exit(1)}
console.log('Admin default-password reset and first-login enforcement contract PASS');
