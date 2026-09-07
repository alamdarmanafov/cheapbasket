'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && router.replace('/'));
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else router.replace('/');
  };

  return (
    <div className="center">
      <div className="card login">
        <div style={{ textAlign: 'center' }}>
          <img src="/icon.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
        </div>
        <h1>Cheap Basket Admin</h1>
        <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Yalnız admin hesabları</p>
        <form onSubmit={submit}>
          <input type="email" placeholder="E-poçt" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input type="password" placeholder="Şifrə" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          {error && <div className="alert err">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Yoxlanılır…' : 'Daxil ol'}</button>
        </form>
        <p className="note">Hesab tətbiqdəki e-poçt qeydiyyatı ilə yaradılır; sonra Supabase-də `admins` cədvəlinə əlavə olunur.</p>
      </div>
    </div>
  );
}
