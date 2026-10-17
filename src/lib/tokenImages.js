import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Anything an image can actually load — issuers sometimes publish a bare host or
// a stray word instead of one.
export function isUsableImage(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^(https?:)?\/\//i.test(v) || v.startsWith('/');
}

export const logoKey = (code, issuer) => `${String(code || '').toUpperCase()}:${issuer || ''}`;

// The artwork an asset publishes lives in its issuer's stellar.toml, on a domain
// the browser cannot always reach, so the lookup runs on the server. Everything
// a screen asks for is gathered into one call, and the answer is kept for the
// session, however many icons are showing it.
const cache = new Map();
let queued = new Map();
let flushTimer = null;

function schedule() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    const batch = [...queued.values()];
    queued = new Map();
    flushTimer = null;
    let logos = {};
    try {
      const res = await base44.functions.invoke('assetLogo', {
        assets: batch.map(({ code, issuer, homeDomain }) => ({ code, issuer, homeDomain })),
      });
      logos = res?.data?.logos || {};
    } catch {
      /* the icon keeps its own mark */
    }
    batch.forEach(({ key, waiters }) => {
      const found = logos[key] || null;
      cache.set(key, found);
      waiters.forEach((resolve) => resolve(found));
    });
  }, 20);
}

export function loadAssetMeta(code, issuer, homeDomain) {
  if (!code || !issuer) return Promise.resolve(null);
  const key = logoKey(code, issuer);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  return new Promise((resolve) => {
    const entry = queued.get(key) || { key, code, issuer, homeDomain, waiters: [] };
    entry.waiters.push(resolve);
    queued.set(key, entry);
    schedule();
  });
}

/**
 * The artwork an icon should show: the one the row already carries, otherwise
 * the logo the asset's issuer publishes in its stellar.toml.
 */
export function useResolvedImage(token) {
  const own = token?.image_url;
  const code = token?.asset_code || token?.code || token?.symbol;
  const issuer = token?.issuer;
  const homeDomain = token?.home_domain;
  const [resolved, setResolved] = useState(null);

  useEffect(() => {
    setResolved(null);
    if (isUsableImage(own) || !code || !issuer) return undefined;
    let live = true;
    loadAssetMeta(code, issuer, homeDomain).then((meta) => {
      if (live && isUsableImage(meta?.logo)) setResolved(meta.logo);
    });
    return () => {
      live = false;
    };
  }, [own, code, issuer, homeDomain]);

  return isUsableImage(own) ? own : resolved;
}