import { isAdminAuthorized } from '../../../../../lib/adminAuth';
import { kv } from '../../../../../lib/kv';
import { verifyTotpCode } from '../../../../../lib/totp';

export const dynamic = 'force-dynamic';

const AUTH_KEY = 'admin:auth';

export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { code } = body;

  const pending = await kv.get('admin:pendingTotp');
  if (!pending?.secretBase32) {
    return Response.json({ error: 'مفيش إعداد قيد التنفيذ أو انتهت مدته — ابدأ من جديد' }, { status: 400 });
  }

  if (!verifyTotpCode(pending.secretBase32, code)) {
    return Response.json({ error: 'الكود غلط، جرّب تاني' }, { status: 401 });
  }

  const existing = (await kv.get(AUTH_KEY)) || {};
  await kv.set(AUTH_KEY, { ...existing, totpSecret: pending.secretBase32, totpEnabled: true });
  await kv.del('admin:pendingTotp');

  return Response.json({ ok: true });
}
