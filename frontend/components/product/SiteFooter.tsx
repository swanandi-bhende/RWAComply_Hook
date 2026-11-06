import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <Link href="/getting-started" className="link">Getting started</Link>
        {' · '}
        <a className="link" href="https://github.com/swanandi-bhende/RWAComply_Hook/blob/v2/first-time-setup.md#part-b-running-the-repository">Developer setup</a>
        {' · '}
        Design: 8B
      </p>
    </footer>
  );
}
