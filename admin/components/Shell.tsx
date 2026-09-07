'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Download, Image as ImageIcon, MessageSquare, RefreshCw, Tags, Ticket, LayoutDashboard, LogOut, MapPin, Package, Store, Users } from 'lucide-react';

const NAV = [
  ['/', 'Panel', LayoutDashboard],
  ['/stores', 'Marketlər', Store],
  ['/products', 'Məhsullar və qiymətlər', Package],
  ['/categories', 'Kateqoriyalar', Tags],
  ['/import', 'Saytdan import', Download],
  ['/sync', 'Avtomatik yeniləmə', RefreshCw],
  ['/branches', 'Filiallar', MapPin],
  ['/banners', 'Bannerlər', ImageIcon],
  ['/users', 'İstifadəçilər', Users],
  ['/promos', 'Promo kodlar', Ticket],
  ['/notifications', 'Bildirişlər', Bell],
  ['/feedback', 'Rəylər', MessageSquare],
] as const;

/** Sidebar layout. Access is enforced by middleware (admin cookie), so pages render directly. */
export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const path = usePathname();
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
            Cheap Market
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
          <button className="btn ghost" onClick={logout}>
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
