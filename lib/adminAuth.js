// نظام حماية لوحة التحكم:
// 1) اسم مستخدم وكلمة سر مؤقتين جاهزين من غير أي إعداد خالص:
//      اسم المستخدم: admin
//      كلمة السر:   1234
//    تقدر تدخل بيهم على طول من غير ما تلمس أي كود ولا تضيف أي متغيّر بيئة
//    في Vercel. لو حابب قيم مؤقتة مختلفة بدالهم، تقدر تظبط متغيرات بيئة
//    اسمها ADMIN_USERNAME و ADMIN_SECRET وهياخدوا الأولوية على القيم
//    المدمجة دي.
// 2) أول ما تغيّرهم من جوه اللوحة (⚙️ إعدادات الحساب)، بيتخزنوا (كلمة السر
//    مشفّرة scrypt، مش نص صريح) في قاعدة البيانات، وبيبقوا هما المعتمدين
//    بدل القيم المؤقتة تمامًا.
// 3) مصادقة ثنائية اختيارية (TOTP) — تقدر تفعّلها من اللوحة وتربطها بأي
//    تطبيق Authenticator (Google Authenticator, Authy...). لو مفعّلة، لازم
//    كود من التطبيق كمان عند تسجيل الدخول.
// 4) جلسة (session) — بعد ما تسجل دخول صح، بتاخد "توكن" عشوائي صالح لمدة
//    12 ساعة، وهو ده اللي بيتبعت مع كل طلب بعد كده — مش كلمة السر نفسها.
import crypto from 'node:crypto';
import { kv } from './kv';

const AUTH_KEY = 'admin:auth';
const SESSION_PREFIX = 'admin:session:';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 ساعة

// ⚠️ قيم مؤقتة بس — سهّلنا بيها أول دخول من غير أي إعداد. غيّرها فورًا من
// "⚙️ إعدادات الحساب" جوه اللوحة أول ما تدخل، لأنها موجودة في الكود نفسه
// فأي حد يشوف الكود يقدر يعرفها.
const HARDCODED_TEMP_USERNAME = 'admin';
const HARDCODED_TEMP_PASSWORD = '1234';

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function getAuthRecord() {
  return (await kv.get(AUTH_KEY)) || null;
}

// بترجع "أيوه لسه شغال بحساب مؤقت" طول ما محدش غيّره من اللوحة — بنستخدمها
// عشان نوري تحذير مستمر لحد ما يتغيّر.
export async function isUsingTemporaryCredentials() {
  const record = await getAuthRecord();
  return !record?.passwordHash;
}

function getEffectiveUsername(record) {
  if (record?.username) return record.username;
  return process.env.ADMIN_USERNAME || HARDCODED_TEMP_USERNAME;
}

// بيتأكد من اسم المستخدم وكلمة السر مع بعض. لو فيه حساب متخزن في قاعدة
// البيانات (يعني اتغيّر قبل كده من اللوحة)، بيقارن عليه. لو لسه معندهوش،
// بيرجع لمتغيرات البيئة (ADMIN_USERNAME/ADMIN_SECRET) وإلا للقيم المؤقتة
// المدمجة في الكود (admin / 1234).
export async function verifyAdminCredentials(username, password) {
  if (!username || !password) return false;
  const record = await getAuthRecord();
  const expectedUsername = getEffectiveUsername(record);

  if (!timingSafeEqualStrings(username, expectedUsername)) return false;

  if (record?.passwordHash && record?.salt) {
    const hash = hashPassword(password, record.salt);
    return timingSafeEqualStrings(hash, record.passwordHash);
  }

  const fallbackPassword = process.env.ADMIN_SECRET || HARDCODED_TEMP_PASSWORD;
  return timingSafeEqualStrings(password, fallbackPassword);
}

// بيستخدمها فورمة "تغيير كلمة السر" في اللوحة عشان تتأكد من كلمة السر
// الحالية بس (من غير ما تطلب اسم المستخدم كمان، لأن الجلسة نفسها دليل كفاية
// إنه هو صاحب الحساب).
export async function verifyCurrentPassword(password) {
  if (!password) return false;
  const record = await getAuthRecord();
  if (record?.passwordHash && record?.salt) {
    const hash = hashPassword(password, record.salt);
    return timingSafeEqualStrings(hash, record.passwordHash);
  }
  const fallbackPassword = process.env.ADMIN_SECRET || HARDCODED_TEMP_PASSWORD;
  return timingSafeEqualStrings(password, fallbackPassword);
}

export async function setAdminCredentials({ username, password }) {
  const existing = (await getAuthRecord()) || {};
  const updated = { ...existing };
  if (username) updated.username = username;
  if (password) {
    const salt = crypto.randomBytes(16).toString('hex');
    updated.passwordHash = hashPassword(password, salt);
    updated.salt = salt;
  }
  await kv.set(AUTH_KEY, updated);
}

export async function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  await kv.set(`${SESSION_PREFIX}${token}`, { createdAt: Date.now() }, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function isSessionValid(token) {
  if (!token) return false;
  const session = await kv.get(`${SESSION_PREFIX}${token}`);
  return !!session;
}

// دي الدالة اللي كل الـ routes التانية بتستخدمها للتحقق من الطلب.
export async function isAdminAuthorized(req) {
  const token = req.headers.get('x-admin-key') || '';
  return isSessionValid(token);
}
