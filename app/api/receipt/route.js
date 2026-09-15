import { kv, deviceKey, ALL_DEVICES_SET } from '../../../lib/kv';

export const dynamic = 'force-dynamic';

// أقصى حجم للصورة بعد تحويلها لـ base64 (السكريبت في الإضافة بيضغط
// الصورة قبل الإرسال، لكن ده سقف أمان إضافي عشان محدش يبعت ملف ضخم يعطّل
// قاعدة البيانات).
const MAX_DATA_URL_LENGTH = 1_800_000; // ~1.3MB تقريبًا بعد فك ترميز base64

// بتتنادى من الإضافة (زرار "تأكيد الاشتراك" في الـ popup) — بتحفظ صورة
// الإيصال مربوطة بنفس معرّف الجهاز، فتظهر في لوحة التحكم جنب نفس الجهاز
// اللي رفعها بالظبط. لو الجهاز ده مش موجود في قاعدة البيانات لأي سبب
// (مثلاً لو قاعدة البيانات اتغيّرت أو السجل القديم ضاع)، بنسجّله دلوقتي
// تلقائيًا بدل ما نرفض الطلب — الأولوية إن العميل يقدر يبعت طلب الاشتراك
// من غير عوائق.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const deviceId = (body.deviceId || '').trim();
  const imageDataUrl = body.imageDataUrl || '';

  if (!deviceId || deviceId.length < 8) {
    return Response.json({ error: 'deviceId غير صالح' }, { status: 400 });
  }
  if (!imageDataUrl.startsWith('data:image/')) {
    return Response.json({ error: 'صيغة الصورة غير صالحة' }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return Response.json({ error: 'حجم الصورة كبير جدًا — جرّب صورة أصغر أو بجودة أقل' }, { status: 413 });
  }

  const key = deviceKey(deviceId);
  const now = Date.now();
  let record = await kv.get(key);

  if (!record) {
    // مسجّلش قبل كده — سجّله دلوقتي بحالة "قيد المراجعة" عادي.
    record = {
      deviceId,
      label: '',
      meta: '',
      status: 'pending',
      createdAt: now,
      lastSeenAt: now,
      activatedAt: null,
      expiresAt: null,
    };
    await kv.sadd(ALL_DEVICES_SET, deviceId);
  }

  const updated = {
    ...record,
    lastSeenAt: now,
    receiptImage: imageDataUrl,
    receiptUploadedAt: now,
  };
  await kv.set(key, updated);

  return Response.json({ ok: true });
}
