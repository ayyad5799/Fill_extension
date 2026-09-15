export default function Home() {
  return (
    <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px', textAlign: 'center', color: '#333' }}>
      <h1 style={{ fontSize: 20, color: '#0d6efd' }}>سيرفر تراخيص إضافة نقل الملكية</h1>
      <p style={{ fontSize: 14, lineHeight: 1.8 }}>
        السيرفر ده بيدير اشتراكات إضافة "تعبئة نقل الملكية" (tamm.sa). مش صفحة
        للعملاء — دخول لوحة التحكم من الرابط ده:
      </p>
      <p>
        <a href="/admin" style={{ color: '#0d6efd', fontWeight: 'bold' }}>/admin</a>
      </p>
    </div>
  );
}
