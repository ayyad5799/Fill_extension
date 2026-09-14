import { kv, deviceKey, computeStatus, daysLeft } from '../../../lib/kv';

export const dynamic = 'force-dynamic';

// بتتنادى من الإضافة بشكل دوري (كل ساعة تقريبًا + أول ما التبويب يفتح) —
// دي أهم نقطة في النظام كله: لو الرد مش "active"، الإضافة بتوقف نفسها.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const deviceId = (searchParams.get('deviceId') || '').trim();

  if (!deviceId) {
    return Response.json({ status: 'invalid' }, { status: 400 });
  }

  const key = deviceKey(deviceId);
  const record = await kv.get(key);
  const now = Date.now();

  if (!record) {
    return Response.json({ status: 'unregistered' });
  }

  const status = computeStatus(record);
  // لو الاشتراك خلص فعليًا (انتهت مدته) بس لسه متسجل "active" في التخزين،
  // حدّث الحالة المحفوظة لـ "expired" عشان لوحة التحكم تعرض الوضع الصح.
  if (status === 'expired' && record.status === 'active') {
    await kv.set(key, { ...record, status: 'expired', lastSeenAt: now });
  } else {
    await kv.set(key, { ...record, lastSeenAt: now });
  }

  return Response.json({ status, expiresAt: record.expiresAt || null, daysLeft: daysLeft(record) });
}
