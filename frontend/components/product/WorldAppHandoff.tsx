'use client';

import { useEffect, useState } from 'react';
import { worldHandoff } from '@/lib/world/handoff';

export function WorldAppHandoff({
  connectorURI,
  expiresAt,
  onCancel,
}: {
  connectorURI: string;
  expiresAt: number;
  onCancel: () => void;
}) {
  const [coarse, setCoarse] = useState(false);
  const [image, setImage] = useState('');
  const plan = worldHandoff({ connectorURI, expiresAt, coarsePointer: coarse });

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const apply = () => setCoarse(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const next = worldHandoff({ connectorURI, expiresAt, coarsePointer: coarse });
    if (next.mode !== 'qr') return;
    let cancelled = false;
    void import('qrcode').then((QR) => QR.toDataURL(next.connectorURI, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 280,
    })).then((url) => {
      if (!cancelled) setImage(url);
    }).catch(() => {
      if (!cancelled) setImage('');
    });
    return () => {
      cancelled = true;
    };
  }, [connectorURI, expiresAt, coarse]);

  useEffect(() => {
    const next = worldHandoff({ connectorURI, expiresAt, coarsePointer: coarse });
    if (next.mode !== 'qr' || !next.autoOpen) return;
    window.open(next.connectorURI, '_blank', 'noopener,noreferrer');
  }, [connectorURI, expiresAt, coarse]);

  if (plan.mode === 'invalid') {
    return <p className="notice" data-tone="error" role="alert">The World App link was not valid. Start verification again.</p>;
  }
  if (plan.mode === 'native') {
    return <p className="notice" data-tone="pending" role="status">Approve the proof in World App. This page waits for that approval.</p>;
  }
  const expires = new Date(plan.expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="stack">
      <p>Scan this QR code with World App, or open the link on the phone that has World App. Approving it there does not finish verification until RWAComply checks the proof.</p>
      {image
        ? (
          // The source is a data URL generated in the browser from the IDKit connector.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} width={280} height={280} alt="World App verification QR code" />
        )
        : <p className="notice" data-tone="pending" role="status">Preparing the QR code.</p>}
      <p><a className="btn btn-primary" href={plan.connectorURI} target="_blank" rel="noopener noreferrer">Open World App</a></p>
      <p className="quiet">This request expires at {expires}. If it expires, start again.</p>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel verification</button>
    </div>
  );
}
