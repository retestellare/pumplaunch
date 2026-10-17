import { useEffect, useState } from 'react';
import { fetchTokenMetadata } from '@/lib/stellar';

// Anything an image can actually load — issuers sometimes publish a bare host
// or a stray word instead of a URL.
export function isUsableImage(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return /^(https?:)?\/\//i.test(v) || v.startsWith('/');
}

export const logoKey = (code, issuer) => `${String(code || '').toUpperCase()}:${issuer || ''}`;

// The artwork LOBSTR, Scopuly and the other Stellar wallets show is published by
// the issuer in its stellar.toml. One lookup per asset per session, however many
// rows are asking for it.
const cache = new Map();

export function loadAssetLogo(code, issuer) {
  if (!code || !issuer) return Promise.resolve(null);
  const key = logoKey(code, issuer);
  if (!cache.has(key)) {
    cache.set(
      key,
      fetchTokenMetadata(code, issuer)
        .then((meta) => (isUsableImage(meta?.logo) ? meta.logo : null))
        .catch(() => null)
    );
  }
  return cache.get(key);
}

// Fills in the logos a list does not already carry: tokens keep their own
// uploaded artwork, everything else is read from its issuer's toml.
export function useAssetLogos(items) {
  const [logos, setLogos] = useState({});
  const wanted = (items || [])
    .map((i) => [i.asset_code || i.code || i.symbol, i.issuer, i.image_url])
    .filter(([code, issuer, image]) => code && issuer && !isUsableImage(image));
  const signature = wanted.map(([code, issuer]) => logoKey(code, issuer)).join(',');

  useEffect(() => {
    let live = true;
    wanted.forEach(async ([code, issuer]) => {
      const logo = await loadAssetLogo(code, issuer);
      if (!live || !logo) return;
      const key = logoKey(code, issuer);
      setLogos((prev) => (prev[key] ? prev : { ...prev, [key]: logo }));
    });
    return () => {
      live = false;
    };
  }, [signature]);

  return logos;
}

// What a row should display: its own artwork when usable, otherwise the logo its
// issuer publishes, otherwise nothing (the row falls back to its own mark).
export function tokenWithLogo(item, logos) {
  if (isUsableImage(item?.image_url)) return item;
  const logo = logos?.[logoKey(item?.asset_code || item?.code || item?.symbol, item?.issuer)];
  return { ...item, image_url: logo || null };
}