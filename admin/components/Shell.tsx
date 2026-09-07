'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { Bell, LayoutDashboard, LogOut, MapPin, Package, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const NAV = [
  ['/', 'Panel', LayoutDashboard],
  ['/products', 'Məhsullar və qiymətlər', Package],
  ['/branches', 'Filiallar', MapPin],
  ['/users', 'İstifadəçilər', Users],
  ['/notifications', 'Bildirişlər', Bell],
] as const;

/** Auth guard + sidebar. Only users listed in the `admins` table get in. */
export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const path = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(!!data));
  }, [session, router]);

  if (session === undefined || (session && isAdmin === null)) return <div className="center muted">Yüklənir…</div>;
  if (!session) return null;
  if (!isAdmin)
    return (
      <div className="center">
        <div className="card" style={{ maxWidth: 420 }}>
          <h2>Giriş icazəsi yoxdur</h2>
          <p className="muted">
            <b>{session.user.email}</b> admin deyil. Supabase → SQL Editor-da bunu işlət:
          </p>
          <pre>{`insert into admins (user_id)\nselect id from auth.users where email = '${session.user.email}';`}</pre>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Çıxış</button>
        </div>
      </div>
    );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.png" alt="" width={32} height={32} style={{ borderRadius: 9 }} />
          <span>
            Cheap Basket
            <small>Admin</small>
          </span>
        </div>
        <nav>
          {NAV.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <small className="muted">{session.user.email}</small>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> Çıxış
          </button>
        </div>
      </aside>
      <main className="content">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
