import fs from 'node:fs';

const source = fs.readFileSync('supabase/functions/member-login/index.ts', 'utf8');
const required = [
  // Lỗi hạ tầng Auth (CAPTCHA, rate limit, 5xx) không được báo thành "sai mật khẩu" và không được tính vào bộ đếm khóa.
  "const isAuthUnavailable=",
  "errCode(e)==='captcha_failed'",
  "code:'auth_unavailable'},503)",
  "const isEmailNotConfirmed=",
  "code:'email_not_confirmed'},403)",
  // Chỉ tự tạo tài khoản lần đầu khi lỗi thật sự là sai thông tin đăng nhập.
  "authResult.error&&mayBootstrap&&isBadCredentials(authResult.error)",
  // Origin của ứng dụng Android (Capacitor) phải còn trong CORS.
  "'capacitor://localhost'",
];
const missing = required.filter((marker) => !source.includes(marker));
const unavailableIdx = source.indexOf("if(authResult.error&&isAuthUnavailable(authResult.error))");
const failureIdx = source.indexOf("if(authResult.error||!authResult.data.session||!authResult.data.user){await recordFailure()");
if (unavailableIdx < 0 || failureIdx < 0 || unavailableIdx > failureIdx) missing.push('isAuthUnavailable branch must run before recordFailure()');
if (missing.length) {
  console.error('member-login contract check failed:');
  for (const marker of missing) console.error(`- missing ${marker}`);
  process.exit(1);
}
console.log('member-login-contract-ok: auth outages are not reported as wrong password or counted toward lockout; Capacitor origins kept.');
