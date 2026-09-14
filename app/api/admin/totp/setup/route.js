import { isAdminAuthorized } from '../../../../../lib/adminAuth';
import { kv } from '../../../../../lib/kv';
import { generateSecretBase32, buildTotp } from '../../../../../lib/totp';

export const dynamic = 'force-dynamic';

// السر ده "قيد الانتظار" لحد ما يتأكد بكود صحيح من /totp/enable — مش
// مفعّل فعليًا لحد ما يحصل التأكيد ده، وعمره 10 دقايق بس لو اتنسي.
export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const secretBase32 = generateSecretBase32();
  await kv.set('admin:pendingTotp', { secretBase32 }, { ex: 600 });

  const totp = buildTotp(secretBase32);
  return Response.json({ secret: secretBase32, otpauthUri: totp.toString() });
}
