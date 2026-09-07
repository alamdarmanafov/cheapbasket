'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) setError(j.error ?? 'Xəta');
    else router.replace('/');
  };

  return (
    <div className="center">
      <div className="card login">
        <div style={{ textAlign: 'center' }}>
          <img src="/icon.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
        </div>
        <h1>Cheap Basket Admin</h1>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>İdarəetmə paneli</p>
        <form onSubmit={submit}>
          <input type="email" placeholder="Admin e-poçtu" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          <input type="password" placeholder="Şifrə" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <div className="alert err">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Yoxlanılır…' : 'Daxil ol'}</button>
        </form>
        <p className="note">Giriş məlumatları Vercel-də <code>ADMIN_EMAIL</code> / <code>ADMIN_PASSWORD</code> dəyişənləridir.</p>
      </div>
    </div>
  );
}
