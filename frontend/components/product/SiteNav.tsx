'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/offerings', label: 'Offerings' },
  { href: '/invest', label: 'Invest' },
  { href: '/invest#link', label: 'Wallets' },
  { href: '/invest#activity', label: 'Activity' },
  { href: '/demo', label: 'Demo' },
  { href: '/issuer', label: 'Issue' },
  { href: '/how', label: 'How it works' },
];

export function SiteNav() {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenPath(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <aside className={open ? 'app-sidebar is-open' : 'app-sidebar'}>
        <Link href="/" className="brand">RWAComply</Link>
        <p className="sidebar-promise">One human. Multiple wallets. One shared purchase limit.</p>
        <nav id="site-navigation" aria-label="Product" className="nav-links">
          {LINKS.map((link) => {
            const path = link.href.split('#')[0];
            const current = !link.href.includes('#') && (
              path === '/'
                ? pathname === '/'
                : pathname === path || pathname.startsWith(`${path}/`)
            );
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className="nav-link"
                onClick={() => setOpenPath(null)}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <header className="app-topbar">
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <p className="topbar-title">Shared purchase limit</p>
        <div className="wallet-slot">
          <ConnectButton accountStatus="address" chainStatus="none" showBalance={false} />
        </div>
      </header>
    </>
  );
}
