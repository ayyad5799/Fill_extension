import { kv, deviceKey, ALL_DEVICES_SET, computeStatus, daysLeft } from '../../../lib/kv';

export const dynamic = 'force-dynamic';

// بتتنادى مرة واحدة من الإضافة أول ما تتثبت على جهاز جديد. لو الجهاز جديد،
// بيتسجل بحالة "pending" (قيد المراجعة) لحد ما تراجعه وتوافق عليه إنت من
// لوحة التحكم بعد ما تتأكد إن العميل دفع. لو الجهاز مسجّل بالفعل، بيرجّع
// حالته الحالية من غير ما يغيّر فيها حاجة.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const deviceId = (body.deviceId || '').trim();
  const meta = typeof body.meta === 'string' ? body.meta.slice(0, 300) : '';

  if (!deviceId || deviceId.length < 8 || deviceId.length > 128) {
    return Response.json({ error: 'deviceId غير صالح' }, { status: 400 });
  }

  const key = deviceKey(deviceId);
  const now = Date.now();
  const existing = await kv.get(key);

  if (existing) {
    await kv.set(key, { ...existing, lastSeenAt: now, meta: meta || existing.meta || '' });
    return Response.json({ status: computeStatus(existing), expiresAt: existing.expiresAt || null, daysLeft: daysLeft(existing) });
  }

  const record = {
    deviceId,
    label: '',
    meta,
    status: 'pending',
    createdAt: now,
    lastSeenAt: now,
    activatedAt: null,
    expiresAt: null,
  };
  await kv.set(key, record);
  await kv.sadd(ALL_DEVICES_SET, deviceId);

  return Response.json({ status: 'pending', expiresAt: null, daysLeft: null });
}
