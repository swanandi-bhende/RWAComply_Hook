export function Logo({ height = 32 }: { height?: number }) {
  return (
    // The file is the supplied RWAComply mark. Next image optimization is unnecessary for this static asset.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/rwacomply-logo.png" alt="RWAComply" height={height} style={{ width: 'auto', height }} />
  );
}
