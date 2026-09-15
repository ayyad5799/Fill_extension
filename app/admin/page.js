'use client';

import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  active: { text: 'مفعّل', color: '#0f5132', bg: '#d1e7dd' },
  pending: { text: 'قيد المراجعة', color: '#664d03', bg: '#fff3cd' },
  expired: { text: 'منتهي', color: '#842029', bg: '#f8d7da' },
  rejected: { text: 'مرفوض', color: '#842029', bg: '#f8d7da' },
  inactive: { text: 'موقوف', color: '#842029', bg: '#f8d7da' },
};

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function btnStyle(color) {
  return {
    padding: '6px 12px',
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 'bold',
    cursor: 'pointer',
  };
}

function inputStyle() {
  return { width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 5, boxSizing: 'border-box', marginBottom: 10, fontSize: 13 };
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState(''); // ده توكن الجلسة، مش كلمة السر نفسها
  const [authorized, setAuthorized] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dayInputs, setDayInputs] = useState({});
  const [previewImage, setPreviewImage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [showPaymentSettings, setShowPaymentSettings] = useState(false);
  const [usingTempPassword, setUsingTempPassword] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem('adminSessionToken') : null;
    if (saved) {
      setAdminKey(saved);
      setAuthorized(true);
      setUsingTempPassword(sessionStorage.getItem('adminUsingTempPassword') === '1');
    }
  }, []);

  useEffect(() => {
    if (authorized) loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  // خروج تلقائي لو فيه دقيقة كاملة من غير أي حركة (ماوس/كيبورد/سكرول) —
  // حماية إضافية لو سبت اللوحة مفتوحة وماشي من غير ما تقفلها بنفسك.
  useEffect(() => {
    if (!authorized) return;
    const IDLE_MS = 60 * 1000;
    let idleTimer = setTimeout(logout, IDLE_MS);
    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(logout, IDLE_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    return () => {
      clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized]);

  async function loadDevices() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/devices', { headers: { 'x-admin-key': adminKey } });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      const list = data.devices || [];
      // طلبات الاشتراك الجديدة (قيد المراجعة + مرفق إيصال) تطلع فوق الأول
      // عشان متفوتش عليك.
      list.sort((a, b) => {
        const aNew = a.computedStatus === 'pending' && a.receiptImage ? 1 : 0;
        const bNew = b.computedStatus === 'pending' && b.receiptImage ? 1 : 0;
        if (aNew !== bNew) return bNew - aNew;
        return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
      });
      setDevices(list);
    } catch (err) {
      setError('تعذر تحميل قائمة الأجهزة.');
    }
    setLoading(false);
  }

  function logout() {
    setAuthorized(false);
    setAdminKey('');
    sessionStorage.removeItem('adminSessionToken');
    sessionStorage.removeItem('adminUsingTempPassword');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, totpCode: needsTotp ? totpCode : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'حصل خطأ');
        return;
      }
      if (data.needsTotp) {
        setNeedsTotp(true);
        setLoginError('كلمة السر صح — دلوقتي اكتب الكود من تطبيق المصادقة.');
        return;
      }
      sessionStorage.setItem('adminSessionToken', data.token);
      sessionStorage.setItem('adminUsingTempPassword', data.usingTemporaryPassword ? '1' : '0');
      setAdminKey(data.token);
      setUsingTempPassword(!!data.usingTemporaryPassword);
      setAuthorized(true);
      setUsername('');
      setPassword('');
      setTotpCode('');
      setNeedsTotp(false);
    } catch (err) {
      setLoginError('تعذر الاتصال بالسيرفر.');
    }
  }

  async function doAction(deviceId, action, extra = {}) {
    setError('');
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ deviceId, action, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'حصل خطأ.');
        return;
      }
      await loadDevices();
    } catch (err) {
      setError('تعذر تنفيذ الإجراء.');
    }
  }

  // ===== شاشة الدخول =====
  if (!authorized) {
    return (
      <div style={{ maxWidth: 360, margin: '80px auto', padding: 24, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8 }}>
        <h2 style={{ fontSize: 16, marginBottom: 14, color: '#0d6efd' }}>🔒 لوحة تحكم الاشتراكات</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle()}
            autoFocus
            autoComplete="username"
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showLoginPassword ? 'text' : 'password'}
              placeholder="كلمة السر"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle(), paddingLeft: 40 }}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((s) => !s)}
              style={{ position: 'absolute', left: 6, top: 8, width: 'auto', padding: '2px 8px', margin: 0, background: 'transparent', color: '#666', fontSize: 15 }}
              tabIndex={-1}
            >
              {showLoginPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {needsTotp && (
            <input
              type="text"
              inputMode="numeric"
              placeholder="كود المصادقة الثنائية (6 أرقام)"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              style={inputStyle()}
            />
          )}
          <button type="submit" style={{ ...btnStyle('#0d6efd'), width: '100%', padding: 10 }}>
            دخول
          </button>
        </form>
        {loginError && <p style={{ color: needsTotp ? '#0f5132' : '#dc3545', fontSize: 12, marginTop: 10 }}>{loginError}</p>}
      </div>
    );
  }

  // ===== لوحة التحكم =====
  return (
    <div style={{ maxWidth: 1000, margin: '30px auto', padding: '0 16px 60px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, color: '#0d6efd', margin: 0 }}>لوحة تحكم اشتراكات الإضافة</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSettings((s) => !s)} style={btnStyle('#6f42c1')}>
            ⚙️ إعدادات الحساب
          </button>
          <button onClick={() => setShowPaymentSettings((s) => !s)} style={btnStyle('#20c997')}>
            💳 وسيلة الدفع
          </button>
          <button onClick={loadDevices} style={btnStyle('#6c757d')}>🔄 تحديث</button>
          <button onClick={logout} style={btnStyle('#dc3545')}>🚪 خروج</button>
        </div>
      </div>

      {usingTempPassword && (
        <div style={{ background: '#fff3cd', color: '#664d03', border: '1px solid #ffe69c', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>
          ⚠️ لسه شغال بحساب مؤقت (admin / 1234). غيّره حالًا من "⚙️ إعدادات الحساب" تحت.
        </div>
      )}

      {showSettings && <AccountSettings adminKey={adminKey} />}
      {showPaymentSettings && <PaymentSettings adminKey={adminKey} />}

      {error && <p style={{ color: '#dc3545', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      {loading && <p style={{ fontSize: 13, color: '#666' }}>بيحمّل...</p>}

      <input
        type="text"
        placeholder="🔍 ابحث بالاسم، معرّف الجهاز، أو الحالة..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={{ ...inputStyle(), marginBottom: 14 }}
      />

      {(() => {
        const q = searchQuery.trim().toLowerCase();
        const filteredDevices = !q ? devices : devices.filter((d) => {
          const statusText = (STATUS_LABELS[d.computedStatus]?.text || d.computedStatus || '').toLowerCase();
          return (
            (d.label || '').toLowerCase().includes(q) ||
            (d.deviceId || '').toLowerCase().includes(q) ||
            (d.meta || '').toLowerCase().includes(q) ||
            statusText.includes(q)
          );
        });

        if (!loading && filteredDevices.length === 0) {
          return (
            <p style={{ fontSize: 13, color: '#666' }}>
              {devices.length === 0 ? 'مفيش أجهزة مسجّلة لسه.' : 'مفيش نتائج تطابق البحث.'}
            </p>
          );
        }

        return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredDevices.map((d) => {
          const st = STATUS_LABELS[d.computedStatus] || { text: d.computedStatus, color: '#333', bg: '#eee' };
          const dayVal = dayInputs[d.deviceId] ?? 30;
          const isNewRequest = d.computedStatus === 'pending' && !!d.receiptImage;
          return (
            <div
              key={d.deviceId}
              style={{
                background: '#fff',
                border: isNewRequest ? '2px solid #198754' : '1px solid #e0e0e0',
                borderRadius: 8,
                padding: 14,
              }}
            >
              {isNewRequest && (
                <div style={{ fontSize: 11, fontWeight: 'bold', color: '#198754', marginBottom: 6 }}>
                  🔔 طلب اشتراك جديد — في انتظار المراجعة
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div>
                  <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 'bold' }}>
                    {st.text}
                  </span>
                  {d.daysLeft != null && d.computedStatus === 'active' && (
                    <span style={{ fontSize: 12, color: '#666', marginRight: 8 }}>({d.daysLeft} يوم متبقي)</span>
                  )}
                  {d.receiptImage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewImage(d.receiptImage)}
                        style={{ ...btnStyle('#0d6efd'), width: 'auto', padding: '2px 10px', fontSize: 12, marginRight: 8, display: 'inline-block' }}
                      >
                        🖼️ عرض الإيصال
                      </button>
                      <a
                        href={d.receiptImage}
                        download={`receipt-${d.deviceId}.jpg`}
                        style={{ fontSize: 12, marginRight: 4, color: '#198754', fontWeight: 'bold' }}
                      >
                        ⬇️ تحميل
                      </a>
                    </>
                  )}
                </div>
                <div style={{ textAlign: 'left' }}>
                  {renamingId === d.deviceId ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        placeholder="اسم المشترك"
                        style={{ padding: 4, fontSize: 12, border: '1px solid #ccc', borderRadius: 4, width: 130 }}
                        autoFocus
                      />
                      <button
                        onClick={async () => { await doAction(d.deviceId, 'rename', { label: renameValue }); setRenamingId(null); }}
                        style={{ ...btnStyle('#198754'), width: 'auto', padding: '2px 8px', fontSize: 11 }}
                      >
                        ✅
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        style={{ ...btnStyle('#6c757d'), width: 'auto', padding: '2px 8px', fontSize: 11 }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: d.label ? '#333' : '#aaa' }}>
                        {d.label || 'بدون اسم'}
                      </span>
                      <button
                        onClick={() => { setRenamingId(d.deviceId); setRenameValue(d.label || ''); }}
                        style={{ width: 'auto', padding: '1px 6px', fontSize: 11, background: 'transparent', color: '#0d6efd', border: 'none', margin: 0 }}
                        title="إعادة تسمية"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#999', fontFamily: 'monospace', marginTop: 2 }} title={d.deviceId}>
                    {d.deviceId.slice(0, 8)}…{d.deviceId.slice(-4)}
                  </div>
                </div>
              </div>

              {d.meta && <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>🖥️ {d.meta}</div>}

              <div style={{ fontSize: 12, color: '#555', marginBottom: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <div>📅 سُجّل: {fmtDate(d.createdAt)}</div>
                <div>👁️ آخر ظهور: {fmtDate(d.lastSeenAt)}</div>
                <div>✅ آخر تفعيل: {fmtDate(d.activatedAt)}</div>
                <div>⏰ ينتهي: {fmtDate(d.expiresAt)}</div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  value={dayVal}
                  onChange={(e) => setDayInputs((prev) => ({ ...prev, [d.deviceId]: e.target.value }))}
                  style={{ width: 60, padding: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 12 }}
                  title="عدد الأيام"
                />
                <button onClick={() => doAction(d.deviceId, 'approve', { days: Number(dayVal) })} style={btnStyle('#198754')}>✅ تفعيل</button>
                <button onClick={() => doAction(d.deviceId, 'extend', { days: Number(dayVal) })} style={btnStyle('#0d6efd')}>➕ تجديد</button>
                <button onClick={() => doAction(d.deviceId, 'revoke')} style={btnStyle('#fd7e14')}>⏸️ إيقاف</button>
                <button onClick={() => doAction(d.deviceId, 'reject')} style={btnStyle('#dc3545')}>🚫 رفض</button>
                <button
                  onClick={() => { if (confirm('متأكد إنك عايز تمسح الجهاز ده نهائيًا؟')) doAction(d.deviceId, 'delete'); }}
                  style={btnStyle('#6c757d')}
                >
                  🗑️ حذف
                </button>
              </div>
            </div>
          );
        })}
      </div>
        );
      })()}

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20, cursor: 'zoom-out',
          }}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, justifyContent: 'center' }}>
              <a href={previewImage} download="receipt.jpg" style={{ ...btnStyle('#198754'), width: 'auto', padding: '6px 16px', textDecoration: 'none' }}>
                ⬇️ تحميل الصورة
              </a>
              <button onClick={() => setPreviewImage(null)} style={{ ...btnStyle('#6c757d'), width: 'auto', padding: '6px 16px' }}>
                ✕ إغلاق
              </button>
            </div>
            <img src={previewImage} alt="إيصال الدفع" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSettings({ adminKey }) {
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [totpEnabled, setTotpEnabled] = useState(null); // null = مش معروف لسه
  const [pendingSecret, setPendingSecret] = useState(null); // {secret, otpauthUri}
  const [enableCode, setEnableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [totpMsg, setTotpMsg] = useState('');
  const [totpError, setTotpError] = useState('');

  useEffect(() => {
    fetch('/api/admin/totp/status', { headers: { 'x-admin-key': adminKey } })
      .then((res) => res.json())
      .then((data) => setTotpEnabled(!!data.enabled))
      .catch(() => setTotpEnabled(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleChangeCredentials(e) {
    e.preventDefault();
    setPwMsg('');
    setPwError('');
    if (newPassword && newPassword !== confirmPassword) {
      setPwError('كلمة السر الجديدة والتأكيد مش متطابقين');
      return;
    }
    if (!newUsername && !newPassword) {
      setPwError('اكتب اسم مستخدم جديد أو كلمة سر جديدة (أو الاثنين مع بعض)');
      return;
    }
    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ currentPassword, newUsername: newUsername || undefined, newPassword: newPassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || 'حصل خطأ');
        return;
      }
      setPwMsg('✅ اتغيّرت بيانات الدخول بنجاح. استخدمها من دخولك الجاي.');
      setNewUsername('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError('تعذر الاتصال بالسيرفر.');
    }
  }

  async function startTotpSetup() {
    setTotpError('');
    setTotpMsg('');
    try {
      const res = await fetch('/api/admin/totp/setup', { method: 'POST', headers: { 'x-admin-key': adminKey } });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'حصل خطأ');
        return;
      }
      setPendingSecret(data);
    } catch (err) {
      setTotpError('تعذر الاتصال بالسيرفر.');
    }
  }

  async function confirmEnableTotp(e) {
    e.preventDefault();
    setTotpError('');
    try {
      const res = await fetch('/api/admin/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ code: enableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'حصل خطأ');
        return;
      }
      setTotpMsg('✅ اتفعّلت المصادقة الثنائية.');
      setPendingSecret(null);
      setEnableCode('');
      setTotpEnabled(true);
    } catch (err) {
      setTotpError('تعذر الاتصال بالسيرفر.');
    }
  }

  async function handleDisableTotp(e) {
    e.preventDefault();
    setTotpError('');
    try {
      const res = await fetch('/api/admin/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || 'حصل خطأ');
        return;
      }
      setTotpMsg('تم إيقاف المصادقة الثنائية.');
      setDisablePassword('');
      setTotpEnabled(false);
    } catch (err) {
      setTotpError('تعذر الاتصال بالسيرفر.');
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, marginTop: 0, color: '#333' }}>🔑 تغيير اسم المستخدم / كلمة السر</h3>
      <form onSubmit={handleChangeCredentials} style={{ maxWidth: 340 }}>
        <input type="text" placeholder="اسم مستخدم جديد (سيبها فاضية لو مش عايز تغيّره)" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={inputStyle()} autoComplete="username" />
        <input type={showPasswords ? 'text' : 'password'} placeholder="كلمة السر الحالية" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle()} autoComplete="current-password" />
        <input type={showPasswords ? 'text' : 'password'} placeholder="كلمة السر الجديدة (سيبها فاضية لو مش عايز تغيّرها)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle()} autoComplete="new-password" />
        <input type={showPasswords ? 'text' : 'password'} placeholder="تأكيد كلمة السر الجديدة" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={inputStyle()} autoComplete="new-password" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', marginBottom: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
          👁️ إظهار كلمات السر
        </label>
        <button type="submit" style={btnStyle('#0d6efd')}>حفظ التغييرات</button>
      </form>
      {pwMsg && <p style={{ color: '#198754', fontSize: 12, marginTop: 8 }}>{pwMsg}</p>}
      {pwError && <p style={{ color: '#dc3545', fontSize: 12, marginTop: 8 }}>{pwError}</p>}

      <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

      <h3 style={{ fontSize: 15, color: '#333' }}>📱 المصادقة الثنائية (Authenticator)</h3>
      <p style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>
        بتشتغل مع أي تطبيق مصادقة على موبايلك زي <b>Google Authenticator</b> أو
        Microsoft Authenticator أو Authy — مش مرتبطة بحساب Gmail مباشرة (مفيش
        دخول بحساب جوجل هنا)، لكن هتفتح تطبيق Google Authenticator نفسه وتضيف
        الحساب ده فيه يدويًا.
      </p>

      {totpEnabled === false || totpEnabled === null ? (
        !pendingSecret ? (
          <button onClick={startTotpSetup} style={btnStyle('#198754')}>🔐 تفعيل المصادقة الثنائية</button>
        ) : (
          <form onSubmit={confirmEnableTotp} style={{ maxWidth: 420, marginTop: 10 }}>
            <ol style={{ fontSize: 12, color: '#555', lineHeight: 1.8, paddingRight: 18 }}>
              <li>افتح تطبيق Google Authenticator (أو أي تطبيق مصادقة) على موبايلك.</li>
              <li>دوس + ثم اختار "إدخال مفتاح الإعداد" / "Enter a setup key".</li>
              <li>اكتب أي اسم (مثلاً "لوحة الاشتراكات")، والصق الكود ده كـ "مفتاح":</li>
            </ol>
            <div style={{ background: '#f1f3f5', padding: 10, borderRadius: 5, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', marginBottom: 10, userSelect: 'all' }}>
              {pendingSecret.secret}
            </div>
            <p style={{ fontSize: 12, color: '#666' }}>بعد ما تضيفه، اكتب الكود المكوّن من 6 أرقام اللي هيظهر في التطبيق:</p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={enableCode}
              onChange={(e) => setEnableCode(e.target.value)}
              style={{ ...inputStyle(), maxWidth: 160 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={btnStyle('#198754')}>✅ تأكيد وتفعيل</button>
              <button type="button" onClick={() => setPendingSecret(null)} style={btnStyle('#6c757d')}>إلغاء</button>
            </div>
          </form>
        )
      ) : (
        <form onSubmit={handleDisableTotp} style={{ maxWidth: 340, marginTop: 10 }}>
          <p style={{ fontSize: 12, color: '#0f5132', fontWeight: 'bold' }}>✅ المصادقة الثنائية مفعّلة حاليًا.</p>
          <input type="password" placeholder="كلمة السر (لتأكيد الإيقاف)" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} style={inputStyle()} />
          <button type="submit" style={btnStyle('#dc3545')}>⛔ إيقاف المصادقة الثنائية</button>
        </form>
      )}
      {totpMsg && <p style={{ color: '#198754', fontSize: 12, marginTop: 8 }}>{totpMsg}</p>}
      {totpError && <p style={{ color: '#dc3545', fontSize: 12, marginTop: 8 }}>{totpError}</p>}
    </div>
  );
}

function PaymentSettings({ adminKey }) {
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [iban, setIban] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/payment-info')
      .then((res) => res.json())
      .then((data) => {
        setBankName(data.bankName || '');
        setAccountName(data.accountName || '');
        setIban(data.iban || '');
        setNotes(data.notes || '');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const res = await fetch('/api/admin/payment-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ bankName, accountName, iban, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'حصل خطأ');
        return;
      }
      setMsg('✅ اتحفظت وسيلة الدفع — هتظهر دلوقتي لأي عميل لسه مدفعش داخل الإضافة.');
    } catch (err) {
      setError('تعذر الاتصال بالسيرفر.');
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ fontSize: 15, marginTop: 0, color: '#333' }}>💳 وسيلة الدفع (بتظهر للعميل جوه الإضافة)</h3>
      <p style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>
        أي حد لسه اشتراكه مش مفعّل (قيد المراجعة / منتهي / موقوف) هيشوف
        البيانات دي جوه الـ popup بتاع الإضافة، عشان يعرف يحوّل الاشتراك
        فين قبل ما يرفع إيصال الدفع.
      </p>
      {loaded && (
        <form onSubmit={handleSave} style={{ maxWidth: 380 }}>
          <input type="text" placeholder="اسم البنك (مثلاً: البنك الأهلي)" value={bankName} onChange={(e) => setBankName(e.target.value)} style={inputStyle()} />
          <input type="text" placeholder="اسم صاحب الحساب" value={accountName} onChange={(e) => setAccountName(e.target.value)} style={inputStyle()} />
          <input type="text" placeholder="رقم الآيبان (IBAN)" value={iban} onChange={(e) => setIban(e.target.value)} style={{ ...inputStyle(), fontFamily: 'monospace' }} />
          <textarea placeholder="ملاحظات إضافية (اختياري، مثلاً رقم واتساب للتواصل بعد التحويل)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle(), resize: 'vertical' }} />
          <button type="submit" style={btnStyle('#20c997')}>💾 حفظ وسيلة الدفع</button>
        </form>
      )}
      {msg && <p style={{ color: '#198754', fontSize: 12, marginTop: 8 }}>{msg}</p>}
      {error && <p style={{ color: '#dc3545', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  );
}
