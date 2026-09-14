'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight, Bell, BookOpen, BrainCircuit, Clock, Download, DollarSign, FlaskConical, Image as ImageIcon, MessageSquare, MessageSquareWarning, RefreshCw, Tags, Ticket, LayoutDashboard, LogOut, MapPin, Package, Store, Users, Receipt, Link2, Target, ShieldCheck, Handshake } from 'lucide-react';

const NAV = [
  ['/', 'Panel', LayoutDashboard],
  ['/stores', 'Marketlər', Store],
  ['/products', 'Məhsullar', Package],
  ['/prices', 'Qiymətlər', DollarSign],
  ['/compare', 'Mağaza müqayisəsi', ArrowLeftRight],
  ['/categories', 'Kateqoriyalar', Tags],
  ['/import', 'Saytdan import', Download],
  ['/catalog-import', 'Kataloq importu', BookOpen],
  ['/sync', 'Avtomatik yeniləmə', RefreshCw],
  ['/pending', 'Növbə', Clock],
  ['/matches', 'Uyğunlaşdırma', Link2],
  ['/core', 'Nüvə siyahısı', Target],
  ['/quality', 'Keyfiyyət', ShieldCheck],
  ['/partners', 'Partnyorlar', Handshake],
  ['/receipts', 'Çeklər', Receipt],
  ['/ai', 'AI aktivliyi', BrainCircuit],
  ['/providers', 'Wolt yoxlaması', FlaskConical],
  ['/branches', 'Filiallar', MapPin],
  ['/banners', 'Bannerlər', ImageIcon],
  ['/popups', 'Pop-up bildirişlər', MessageSquareWarning],
  ['/users', 'İstifadəçilər', Users],
  ['/promos', 'Promo kodlar', Ticket],
  ['/notifications', 'Bildirişlər', Bell],
  ['/feedback', 'Rəylər', MessageSquare],
] as const;

/** Sidebar layout. Access is enforced by middleware (admin cookie), so pages render directly. */
export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const path = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch('/api/pending')
      .then((r) => r.json())
      .then((j: { data?: unknown[] }) => setPendingCount(j.data?.length ?? 0))
      .catch(() => {});
  }, [path]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.png" alt="" width={32} height={32} style={{ borderRadius: 9 }} />
          <span>
            Cheap Market AI
            <small>Admin</small>
          </span>
        </div>
        <nav>
          {NAV.map(([href, label, Icon]) => (
            <Link key={href} href={href} className={path === href ? 'active' : ''}>
              <Icon size={18} /> {label}
              {href === '/pending' && pendingCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#DC2626', color: '#fff', borderRadius: 9999, padding: '1px 7px', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="btn ghost" onClick={logout}>
            <LogOut size={16} /> Çıxış
          </button>
          {/* Which build is answering: settles "is the fix live?" without a guess. */}
          <div className="muted" style={{ fontSize: 10, marginTop: 6, fontFamily: 'monospace' }} title="Deploy olunmuş commit">
            {(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)}
            {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ? ` · ${process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF}` : ''}
          </div>
        </div>
      </aside>
      <main className="content">
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
