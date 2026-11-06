import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <Link href="/getting-started" className="link">Getting started</Link>
      </p>
    </footer>
  );
}
