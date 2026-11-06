'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/invest', label: 'Investor dashboard' },
  { href: '/invest#verify', label: 'Verify identity' },
  { href: '/invest#link', label: 'Link wallet' },
  { href: '/invest#allocation', label: 'Allocation' },
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
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand">RWAComply</Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="site-navigation"
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? 'Close' : 'Menu'}
        </button>
        <nav id="site-navigation" aria-label="Product" className={open ? 'nav-links is-open' : 'nav-links'}>
          {LINKS.map((link) => {
            const current = link.href === '/'
              ? pathname === '/'
              : link.href === '/invest'
                ? pathname === '/invest'
                : link.href === '/how'
                  ? pathname === '/how'
                  : false;
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
        <div className="wallet-slot">
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </div>
    </header>
  );
}
