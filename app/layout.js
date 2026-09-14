export const metadata = {
  title: 'سيرفر تراخيص إضافة نقل الملكية',
  description: 'إدارة اشتراكات إضافة تعبئة نقل الملكية (tamm.sa)',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, fontFamily: 'Tahoma, Arial, sans-serif', background: '#f8f9fa' }}>
        {children}
      </body>
    </html>
  );
}
