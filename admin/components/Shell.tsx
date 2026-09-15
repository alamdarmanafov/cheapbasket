'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeftRight, Bell, BookOpen, BrainCircuit, ChevronDown, Clock, Download, DollarSign, FlaskConical, Image as ImageIcon, MessageSquare, MessageSquareWarning, RefreshCw, Tags, Ticket, LayoutDashboard, LogOut, MapPin, Package, Store, Users, Receipt, Link2, Target, ShieldCheck, Handshake } from 'lucide-react';

type NavItem = readonly [string, string, typeof LayoutDashboard];

// Sidebar has grown to two dozen pages — a flat list ran off the bottom of
// the viewport with no way to scroll to it. Grouping into a few collapsible
// sections keeps most of them off-screen by default (only the group holding
// the current page opens automatically) so the whole menu fits.
const TOP: NavItem = ['/', 'Panel', LayoutDashboard];
const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Kataloq',
    items: [
      ['/stores', 'Marketlər', Store],
      ['/products', 'Məhsullar', Package],
      ['/prices', 'Qiymətlər', DollarSign],
      ['/compare', 'Mağaza müqayisəsi', ArrowLeftRight],
      ['/categories', 'Kateqoriyalar', Tags],
      ['/branches', 'Filiallar', MapPin],
    ],
  },
  {
    label: 'İmport və sinxronizasiya',
    items: [
      ['/import', 'Saytdan import', Download],
      ['/catalog-import', 'Kataloq importu', BookOpen],
      ['/sync', 'Avtomatik yeniləmə', RefreshCw],
      ['/pending', 'Növbə', Clock],
      ['/matches', 'Uyğunlaşdırma', Link2],
      ['/core', 'Nüvə siyahısı', Target],
      ['/providers', 'Wolt yoxlaması', FlaskConical],
    ],
  },
  {
    label: 'Keyfiyyət və tərəfdaşlıq',
    items: [
      ['/quality', 'Keyfiyyət', ShieldCheck],
      ['/partners', 'Partnyorlar', Handshake],
      ['/receipts', 'Çeklər', Receipt],
      ['/ai', 'AI aktivliyi', BrainCircuit],
    ],
  },
  {
    label: 'Marketinq',
    items: [
      ['/banners', 'Bannerlər', ImageIcon],
      ['/popups', 'Pop-up bildirişlər', MessageSquareWarning],
      ['/promos', 'Promo kodlar', Ticket],
      ['/notifications', 'Bildirişlər', Bell],
    ],
  },
  {
    label: 'İstifadəçilər',
    items: [
      ['/users', 'İstifadəçilər', Users],
      ['/feedback', 'Rəylər', MessageSquare],
    ],
  },
];

const NAV_STORAGE_KEY = 'admin-nav-open-groups';

function activeGroupLabel(path: string): string | null {
  return GROUPS.find((g) => g.items.some(([href]) => href === path))?.label ?? null;
}

/** Sidebar layout. Access is enforced by middleware (admin cookie), so pages render directly. */
export function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  const path = usePathname();
  const [pendingCount, setPendingCount] = useState(0);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/pending')
      .then((r) => r.json())
      .then((j: { data?: unknown[] }) => setPendingCount(j.data?.length ?? 0))
      .catch(() => {});
  }, [path]);

  // Whichever groups the admin last left open stay open, and the group
  // holding the current page always opens too — so a direct link or a
  // fresh reload never lands on a page hidden behind a collapsed section.
  useEffect(() => {
    let stored: Record<string, boolean> = {};
    try { stored = JSON.parse(localStorage.getItem(NAV_STORAGE_KEY) ?? '{}'); } catch { /* private mode, etc. */ }
    const active = activeGroupLabel(path);
    setOpenGroups(active ? { ...stored, [active]: true } : stored);
  }, [path]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(next)); } catch { /* private mode, etc. */ }
      return next;
    });
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  };
  const [topHref, topLabel, TopIcon] = TOP;
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
          <Link href={topHref} className={path === topHref ? 'active' : ''}>
            <TopIcon size={18} /> {topLabel}
          </Link>
          {GROUPS.map((g) => {
            const isOpen = !!openGroups[g.label];
            return (
              <div key={g.label} className="nav-group">
                <button type="button" className="nav-group-toggle" onClick={() => toggleGroup(g.label)} aria-expanded={isOpen}>
                  <span>{g.label}</span>
                  <ChevronDown size={15} style={{ transform: isOpen ? undefined : 'rotate(-90deg)', transition: 'transform .15s' }} />
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {g.items.map(([href, label, Icon]) => (
                      <Link key={href} href={href} className={path === href ? 'active' : ''}>
                        <Icon size={18} /> {label}
                        {href === '/pending' && pendingCount > 0 && (
                          <span style={{ marginLeft: 'auto', background: '#DC2626', color: '#fff', borderRadius: 9999, padding: '1px 7px', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
