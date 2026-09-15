import { verifyAdminCredentials, createSession, getAuthRecord, isUsingTemporaryCredentials } from '../../../../lib/adminAuth';
import { verifyTotpCode } from '../../../../lib/totp';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { username, password, totpCode } = body;

  const credsOk = await verifyAdminCredentials(username || '', password || '');
  if (!credsOk) {
    return Response.json({ error: 'اسم المستخدم أو كلمة السر غلط' }, { status: 401 });
  }

  const record = await getAuthRecord();
  if (record?.totpEnabled) {
    if (!totpCode) {
      // البيانات صح، بس لازم كود المصادقة الثنائية كمان.
      return Response.json({ needsTotp: true });
    }
    const codeOk = verifyTotpCode(record.totpSecret, totpCode);
    if (!codeOk) {
      return Response.json({ error: 'كود المصادقة الثنائية غلط' }, { status: 401 });
    }
  }

  const token = await createSession();
  const usingTemporaryPassword = await isUsingTemporaryCredentials();
  return Response.json({ token, usingTemporaryPassword });
}
