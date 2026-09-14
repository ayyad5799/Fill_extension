import { kv } from '../../../lib/kv';

export const dynamic = 'force-dynamic';

const PAYMENT_INFO_KEY = 'admin:paymentInfo';

// مقصود إنها عامة (من غير أي كلمة سر) — الغرض منها إنها تتعرض للعميل نفسه
// جوه الإضافة عشان يعرف يحوّل فين، مش بيانات حساسة زي كلمة السر.
export async function GET() {
  const info = (await kv.get(PAYMENT_INFO_KEY)) || {};
  return Response.json({
    bankName: info.bankName || '',
    accountName: info.accountName || '',
    iban: info.iban || '',
    notes: info.notes || '',
  });
}
