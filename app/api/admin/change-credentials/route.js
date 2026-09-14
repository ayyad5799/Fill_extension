import { isAdminAuthorized, verifyCurrentPassword, setAdminCredentials } from '../../../../lib/adminAuth';

export const dynamic = 'force-dynamic';

// بتغيّر اسم المستخدم و/أو كلمة السر مع بعض من جوه اللوحة نفسها. تقدر
// تسيب newUsername فاضي لو عايز تغيّر كلمة السر بس، أو newPassword فاضي لو
// عايز تغيّر اسم المستخدم بس.
export async function POST(req) {
  if (!(await isAdminAuthorized(req))) {
    return Response.json({ error: 'غير مصرّح' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { currentPassword, newUsername, newPassword } = body;

  if (!currentPassword) {
    return Response.json({ error: 'كلمة السر الحالية مطلوبة' }, { status: 400 });
  }
  if (!newUsername && !newPassword) {
    return Response.json({ error: 'محتاج تغيّر اسم المستخدم أو كلمة السر على الأقل' }, { status: 400 });
  }
  if (newUsername && newUsername.trim().length < 3) {
    return Response.json({ error: 'اسم المستخدم لازم يكون 3 حروف على الأقل' }, { status: 400 });
  }
  if (newPassword && newPassword.length < 4) {
    return Response.json({ error: 'كلمة السر لازم تكون 4 حروف/أرقام على الأقل' }, { status: 400 });
  }

  const ok = await verifyCurrentPassword(currentPassword);
  if (!ok) {
    return Response.json({ error: 'كلمة السر الحالية غلط' }, { status: 401 });
  }

  await setAdminCredentials({
    username: newUsername ? newUsername.trim() : undefined,
    password: newPassword || undefined,
  });

  return Response.json({ ok: true });
}
