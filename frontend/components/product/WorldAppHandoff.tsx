'use client';

import { useEffect, useState } from 'react';
import {
  IDKIT_DEFAULT_BRIDGE,
  IDKIT_PACKAGE_VERSION,
  inspectConnector,
  worldHandoff,
  type ConnectorEnvironment,
} from '@/lib/world/handoff';

export function WorldAppHandoff({
  connectorURI,
  expiresAt,
  environment,
  phase,
  onCancel,
}: {
  connectorURI: string;
  expiresAt: number;
  environment: ConnectorEnvironment;
  phase: 'waiting_for_connection' | 'awaiting_confirmation';
  onCancel: () => void;
}) {
  const [coarse, setCoarse] = useState(false);
  const [image, setImage] = useState('');
  const inspection = inspectConnector(connectorURI, environment);
  const plan = inspection.ok ? worldHandoff({ connectorURI, expiresAt, coarsePointer: coarse }) : { mode: 'invalid' as const };

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const apply = () => setCoarse(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!inspection.ok) return;
    let cancelled = false;
    void import('qrcode').then((QR) => QR.toDataURL(connectorURI, {
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
  }, [connectorURI, inspection.ok]);

  useEffect(() => {
    if (!inspection.ok || !coarse) return;
    window.open(connectorURI, '_blank', 'noopener,noreferrer');
  }, [connectorURI, inspection.ok, coarse]);

  if (plan.mode === 'invalid') {
    return <p className="notice" data-tone="error" role="alert">{inspection.error || 'The World App link was not valid. Start verification again.'}</p>;
  }
  if (plan.mode === 'native') {
    return <p className="notice" data-tone="pending" role="status">Approve the proof in World App. This page waits for that approval.</p>;
  }
  const expires = new Date(plan.expiresAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const phaseText = phase === 'awaiting_confirmation'
    ? 'World App retrieved this request. Approval is still required.'
    : 'Waiting for World App to retrieve this request.';
  return (
    <div className="stack">
      <p>Scan this QR code with {environment === 'sandbox' ? 'the Sandbox World App' : 'World App'}. The code is the IDKit request link. Opening the app without that request does not verify you.</p>
      {image
        ? (
          // The source is a data URL generated in the browser from the IDKit connector.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} width={280} height={280} alt="World App verification QR code" />
        )
        : <p className="notice" data-tone="pending" role="status">Preparing the QR code.</p>}
      <p><a className="btn btn-primary" href={plan.connectorURI} target="_blank" rel="noopener noreferrer">Open World App</a></p>
      <p className="quiet">This request expires at {expires}. If it expires, start again.</p>
      <dl className="quiet">
        <div>IDKit {IDKIT_PACKAGE_VERSION}. Configured environment {environment}. Connector {inspection.host}{inspection.path}.</div>
        <div>Request created. App ID present. RP ID present. Request id {inspection.parameters.i ? 'present' : 'missing'}.</div>
        <div>Bridge {inspection.bridgeHost || new URL(IDKIT_DEFAULT_BRIDGE).host}.</div>
        <div>{phaseText}</div>
      </dl>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel verification</button>
    </div>
  );
}
