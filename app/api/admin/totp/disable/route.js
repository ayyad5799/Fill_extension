import { isAdminAuthorized, verifyCurrentPassword } from '../../../../../lib/adminAuth';
import { kv } from '../../../../../lib/kv';

export const dynamic = 'force-dynamic';

const AUTH_KEY = 'admin:auth';

export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { password } = body;

  const ok = await verifyCurrentPassword(password || '');
  if (!ok) {
    return Response.json({ error: 'كلمة السر غلط' }, { status: 401 });
  }

  const existing = (await kv.get(AUTH_KEY)) || {};
  await kv.set(AUTH_KEY, { ...existing, totpEnabled: false, totpSecret: null });

  return Response.json({ ok: true });
}
