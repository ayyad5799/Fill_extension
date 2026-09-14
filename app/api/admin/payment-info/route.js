import { kv } from '../../../../lib/kv';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

const PAYMENT_INFO_KEY = 'admin:paymentInfo';

export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const info = {
    bankName: (body.bankName || '').slice(0, 100),
    accountName: (body.accountName || '').slice(0, 100),
    iban: (body.iban || '').replace(/\s+/g, '').toUpperCase().slice(0, 40),
    notes: (body.notes || '').slice(0, 300),
  };

  await kv.set(PAYMENT_INFO_KEY, info);
  return Response.json({ ok: true, info });
}
