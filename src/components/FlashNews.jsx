import { useEffect, useState } from 'react';
import { fetchFlashNews } from '@/lib/flashNews';

const FLASH_MS = 6000; // one line at a time, then the next
const REFRESH_MS = 90000;

function ago(at) {
  const mins = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

// A discreet live activity line: one action at a time, quietly swapping in, and
// pointer-events-free so it never stands between a tap and the app.
export default function FlashNews({ tokens }) {
  const [events, setEvents] = useState([]);
  const [index, setIndex] = useState(0);

  const tokenKey = tokens.map((t) => t.id).join(',');

  useEffect(() => {
    let active = true;
    setIndex(0);
    const load = () =>
      fetchFlashNews(tokens)
        .then((next) => {
          if (active) setEvents(next);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tokenKey]);

  useEffect(() => {
    if (events.length < 2) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % events.length), FLASH_MS);
    return () => clearTimeout(timer);
  }, [events, index]);

  const event = events.length > 0 ? events[index % events.length] : null;
  if (!event) return null;

  return (
    <div className="mb-1.5 rounded-[12px] border border-[#00F59B]/20 bg-[#0c1512]/70 backdrop-blur-[6px] px-2.5 py-[6px] flex items-center gap-2 overflow-hidden pointer-events-none select-none">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] shadow-[0_0_8px_#00F59B] animate-pulse shrink-0" />
      <span key={event.id} className="flex items-center gap-1.5 min-w-0 flex-1 animate-[sp-up_.5s_ease-out_both]">
        <span
          aria-hidden
          className="w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] shrink-0"
          style={{ backgroundColor: `${event.tone}1f`, color: event.tone }}
        >
          {event.glyph}
        </span>
        <span className="text-[10px] font-semibold text-[#F2F7F4]/85 truncate">{event.text}</span>
        <span className="text-[10px] text-[#F2F7F4]/30 shrink-0 tabular-nums">· {ago(event.at)}</span>
      </span>
    </div>
  );
}