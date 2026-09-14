import { isAdminAuthorized, getAuthRecord } from '../../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }
  const record = await getAuthRecord();
  return Response.json({ enabled: !!record?.totpEnabled });
}
