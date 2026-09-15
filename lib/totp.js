// مصادقة ثنائية عن طريق أي تطبيق Authenticator (Google Authenticator,
// Microsoft Authenticator, Authy...) — مش مربوطة بحساب Gmail بشكل مباشر
// (مفيش API لجوجل هنا)، لكنها بتشتغل مع تطبيق "Google Authenticator" نفسه
// أو أي تطبيق تاني بيدعم بروتوكول TOTP القياسي (RFC 6238) — وهو ده أصلاً
// اللي بيستخدمه أي موقع تاني بيقولك "فعّل المصادقة الثنائية عن طريق تطبيق
// المصادقة".
import * as OTPAuth from 'otpauth';

const ISSUER = 'لوحة اشتراكات نقل الملكية';

export function generateSecretBase32() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(secretBase32) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: 'Admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function verifyTotpCode(secretBase32, code) {
  const totp = buildTotp(secretBase32);
  // window: 1 بيسمح بفرق دقيقة واحدة قبل/بعد (لو ساعة الموبايل مش مظبوطة
  // بالظبط)، من غير ما يفتح الباب لأي كود قديم أوي.
  const delta = totp.validate({ token: String(code || '').trim(), window: 1 });
  return delta !== null;
}
