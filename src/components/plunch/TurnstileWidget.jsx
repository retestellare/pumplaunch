import { useEffect, useRef } from 'react';

// Cloudflare Turnstile: the site key is public, the matching secret lives only in
// the backend function that spends the token.
const SITE_KEY = '0x4AAAAAAF7_nrPDyTcUbjm-';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error('The captcha could not load.'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// Renders one challenge and reports the token once it is solved. Remount the
// widget (new key) to get a fresh token: a solved token is single-use.
export default function TurnstileWidget({ onToken }) {
  const holder = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let alive = true;
    loadTurnstile()
      .then((turnstile) => {
        if (!alive || !holder.current || widgetId.current !== null) return;
        widgetId.current = turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          theme: 'dark',
          size: 'flexible',
          callback: (token) => onToken(token || ''),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken(''),
        });
      })
      .catch(() => onToken(''));

    return () => {
      alive = false;
      const turnstile = window.turnstile;
      if (turnstile && widgetId.current !== null) {
        try {
          turnstile.remove(widgetId.current);
        } catch {
          /* the widget is already gone */
        }
      }
      widgetId.current = null;
    };
  }, [onToken]);

  return <div ref={holder} className="min-h-[65px]" />;
}