// "Official Redis for Vercel" بيديك رابط اتصال Redis عادي (متغيّر بيئة
// اسمه KV_REDIS_URL بعد الربط بالـ prefix "KV") — ده بروتوكول TCP عادي
// (redis://...)، مختلف عن REST API بتاعة Upstash. فبنستخدم مكتبة "redis"
// الرسمية (node-redis) بدل @upstash/redis.
//
// على السيرفرليس (Vercel)، بنكاش الاتصال على مستوى الملف (module-level)
// عشان الطلبات المتتالية اللي بتيجي لنفس الـ instance الدافئة تعيد استخدام
// نفس الاتصال بدل ما تفتح اتصال جديد كل مرة.
import { createClient } from 'redis';

let clientPromise = null;

function getRedisUrl() {
  // بندعم كذا اسم محتمل للمتغيّر حسب الـ prefix اللي اخترته وقت الربط
  // (KV_REDIS_URL لو اخترت "KV"، أو REDIS_URL لو الاسم الافتراضي بدون
  // prefix، أو غيرها).
  return (
    process.env.KV_REDIS_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL ||
    null
  );
}

async function getClient() {
  if (clientPromise) return clientPromise;
  const url = getRedisUrl();
  if (!url) {
    throw new Error(
      'قاعدة بيانات Redis مش متربطة بالمشروع لسه أو رابط الاتصال مش موجود في متغيرات البيئة. راجع خطوة "ضيف قاعدة بيانات Redis" في README.'
    );
  }
  const client = createClient({ url });
  client.on('error', (err) => console.error('Redis Client Error:', err));
  clientPromise = client.connect().then(() => client);
  return clientPromise;
}

// غلاف بسيط بنفس أسماء الأوامر اللي باقي الكود بيستخدمها. بما إن Redis
// الحقيقي بيخزن نصوص بس (مش objects زي @upstash/redis كانت بتعمل تلقائيًا)،
// بنعمل JSON.stringify/parse يدوي هنا في مكان واحد بس.
export const kv = {
  async get(key) {
    const client = await getClient();
    const raw = await client.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  },
  async set(key, value, opts) {
    const client = await getClient();
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (opts?.ex) {
      await client.set(key, raw, { EX: opts.ex });
    } else {
      await client.set(key, raw);
    }
    return true;
  },
  async del(key) {
    const client = await getClient();
    await client.del(key);
  },
  async sadd(key, member) {
    const client = await getClient();
    await client.sAdd(key, member);
  },
  async srem(key, member) {
    const client = await getClient();
    await client.sRem(key, member);
  },
  async smembers(key) {
    const client = await getClient();
    return await client.sMembers(key);
  },
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
