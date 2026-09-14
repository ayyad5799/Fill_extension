import { kv, deviceKey } from '../../../lib/kv';

export const dynamic = 'force-dynamic';

// أقصى حجم للصورة بعد تحويلها لـ base64 (السكريبت في الإضافة بيضغط
// الصورة قبل الإرسال، لكن ده سقف أمان إضافي عشان محدش يبعت ملف ضخم يعطّل
// قاعدة البيانات).
const MAX_DATA_URL_LENGTH = 1_800_000; // ~1.3MB تقريبًا بعد فك ترميز base64

// بتتنادى من الإضافة (زرار "رفع إيصال الدفع" في الـ popup) — بتحفظ صورة
// الإيصال مربوطة بنفس معرّف الجهاز، فتظهر في لوحة التحكم جنب نفس الجهاز
// اللي رفعها بالظبط.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const deviceId = (body.deviceId || '').trim();
  const imageDataUrl = body.imageDataUrl || '';

  if (!deviceId) {
    return Response.json({ error: 'deviceId مطلوب' }, { status: 400 });
  }
  if (!imageDataUrl.startsWith('data:image/')) {
    return Response.json({ error: 'صيغة الصورة غير صالحة' }, { status: 400 });
  }
  if (imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return Response.json({ error: 'حجم الصورة كبير جدًا — جرّب صورة أصغر أو بجودة أقل' }, { status: 413 });
  }

  const key = deviceKey(deviceId);
  const record = await kv.get(key);
  if (!record) {
    return Response.json({ error: 'الجهاز ده غير مسجّل — افتح صفحة نقل الملكية مرة الأول عشان يتسجل' }, { status: 404 });
  }

  const updated = {
    ...record,
    receiptImage: imageDataUrl,
    receiptUploadedAt: Date.now(),
  };
  await kv.set(key, updated);

  return Response.json({ ok: true });
}
