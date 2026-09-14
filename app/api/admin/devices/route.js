import { kv, deviceKey, ALL_DEVICES_SET, computeStatus, daysLeft } from '../../../../lib/kv';
import { isAdminAuthorized } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const ids = await kv.smembers(ALL_DEVICES_SET);
  const records = await Promise.all(ids.map((id) => kv.get(deviceKey(id))));

  const devices = records
    .filter(Boolean)
    .map((r) => ({ ...r, computedStatus: computeStatus(r), daysLeft: daysLeft(r) }))
    .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

  return Response.json({ devices });
}
