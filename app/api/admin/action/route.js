import { kv, deviceKey, ALL_DEVICES_SET, THIRTY_DAYS_MS } from '../../../../lib/kv';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { deviceId, action, label, days } = body;

  if (!deviceId || !action) {
    return Response.json({ error: 'deviceId و action مطلوبين' }, { status: 400 });
  }

  const key = deviceKey(deviceId);
  const record = await kv.get(key);
  if (!record) {
    return Response.json({ error: 'الجهاز ده مش موجود' }, { status: 404 });
  }

  const now = Date.now();
  const durationMs = Number(days) > 0 ? Number(days) * 24 * 60 * 60 * 1000 : THIRTY_DAYS_MS;
  let updated = { ...record };

  switch (action) {
    case 'approve':
      // تفعيل جديد: المدة بتتحسب من دلوقتي (مش من تاريخ التسجيل).
      updated.status = 'active';
      updated.activatedAt = now;
      updated.expiresAt = now + durationMs;
      break;

    case 'extend': {
      // تجديد: لو لسه له وقت متبقي، بنضيف المدة فوق الوقت المتبقي بدل ما
      // نبدأ من الصفر (يعني العميل مايضيعش أيام دفعها). لو خلص خالص، بنبدأ
      // من دلوقتي.
      const base = updated.expiresAt && updated.expiresAt > now ? updated.expiresAt : now;
      updated.status = 'active';
      updated.expiresAt = base + durationMs;
      if (!updated.activatedAt) updated.activatedAt = now;
      break;
    }

    case 'reject':
      updated.status = 'rejected';
      updated.expiresAt = null;
      break;

    case 'revoke':
      // إيقاف فوري (مثلاً العميل مدفعش أو طلبت توقفه) — بيوقف الإضافة على
      // طول من غير ما يستنى انتهاء الـ 30 يوم.
      updated.status = 'inactive';
      updated.expiresAt = null;
      break;

    case 'rename':
      updated.label = typeof label === 'string' ? label.slice(0, 100) : updated.label;
      await kv.set(key, updated);
      return Response.json({ ok: true, device: updated });

    case 'delete':
      await kv.del(key);
      await kv.srem(ALL_DEVICES_SET, deviceId);
      return Response.json({ ok: true, deleted: true });

    default:
      return Response.json({ error: 'action غير معروف' }, { status: 400 });
  }

  await kv.set(key, updated);
  return Response.json({ ok: true, device: updated });
}
