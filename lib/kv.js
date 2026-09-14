// ملحوظة: @vercel/kv بقى deprecated (مش هيتشال فجأة بس مش هيتطوّر تاني)،
// فبنستخدم مكتبة @upstash/redis نفسها مباشرة (هي نفس المحرك اللي كان
// @vercel/kv بيستخدمه من ورا الكواليس). الفرق الوحيد اللي بيهمك: بدل ما
// تدور على "KV" في تبويب Storage، هتدور على "Redis" في Vercel Marketplace —
// موضح بالتفصيل في README.md.
import { Redis } from '@upstash/redis';

let client = null;

function getClient() {
  if (client) return client;
  // بندعم أسماء متغيرات البيئة القديمة والجديدة عشان يشتغل مهما كان اسم
  // التكامل (integration) اللي هتضيفه من الـ Marketplace.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'قاعدة بيانات Redis مش متربطة بالمشروع لسه. روح Vercel → Storage → Marketplace Database Providers → ضيف Redis (Upstash)، واربطها بالمشروع، وبعدين اعمل Redeploy.'
    );
  }
  client = new Redis({ url, token });
  return client;
}

// غلاف بسيط بنفس أسماء الأوامر اللي باقي الكود بيستخدمها، عشان مفيش داعي
// نغيّر أي حاجة في الـ routes نفسها.
export const kv = {
  get: (key) => getClient().get(key),
  set: (key, value) => getClient().set(key, value),
  del: (key) => getClient().del(key),
  sadd: (key, member) => getClient().sadd(key, member),
  srem: (key, member) => getClient().srem(key, member),
  smembers: (key) => getClient().smembers(key),
};

// كل الأجهزة المسجّلة بنحتفظ بمعرّفاتها في Set واحد اسمه "devices:all" عشان
// نقدر نجيب قايمة كل الأجهزة للوحة التحكم (Redis مفيهوش أمر "هات كل
// المفاتيح اللي شكلها كذا" رخيص، فبنعمل فهرس بسيط بنفسنا).
export const ALL_DEVICES_SET = 'devices:all';

export function deviceKey(deviceId) {
  return `device:${deviceId}`;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function computeStatus(record) {
  if (!record) return 'unregistered';
  if (record.status === 'active' && record.expiresAt && Date.now() > record.expiresAt) {
    return 'expired';
  }
  return record.status;
}

export function daysLeft(record) {
  if (!record?.expiresAt) return null;
  return Math.max(0, Math.ceil((record.expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

export { THIRTY_DAYS_MS };
