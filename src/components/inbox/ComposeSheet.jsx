import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import Avatar from '@/components/Avatar';
import { displayName, shortAddr } from '@/lib/profiles';

const ADDRESS_RE = /^G[A-Z2-7]{55}$/;

// Start a conversation: pick a name from the platform, or paste any wallet.
export default function ComposeSheet({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    base44.entities.Profile
      .list('-created_date', 100)
      .then((list) => setPeople(list || []))
      .catch(() => setPeople([]));
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = q
    ? people.filter(
        (p) =>
          (p.display_name || '').toLowerCase().includes(q) ||
          (p.wallet_address || '').toLowerCase().includes(q)
      )
    : people.slice(0, 12);
  const direct = ADDRESS_RE.test(query.trim());

  const go = (address) => {
    onOpenChange(false);
    navigate(`/messages/${address}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] gap-0 rounded-t-2xl border-white/10 bg-[#0f1013] p-0 text-white"
      >
        <div className="border-b border-white/5 px-4 pb-3 pt-4">
          <SheetTitle className="text-base font-bold text-white">New message</SheetTitle>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#141518] px-3">
            <Search size={15} className="text-white/30" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name or wallet"
              className="h-10 w-full bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {direct && (
            <button
              onClick={() => go(query.trim())}
              className="flex w-full items-center gap-3 rounded-xl bg-[#00ff88]/10 px-3 py-2.5 text-left"
            >
              <MessageCircle size={18} className="text-[#00ff88]" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">Message this wallet</span>
                <span className="block truncate font-mono text-[11px] text-white/40">
                  {shortAddr(query.trim())}
                </span>
              </span>
            </button>
          )}
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => go(p.wallet_address)}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition duration-200 hover:bg-white/5"
            >
              <Avatar profile={p} address={p.wallet_address} size={38} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-white">
                  {displayName(p, p.wallet_address)}
                </span>
                <span className="block truncate font-mono text-[11px] text-white/35">
                  {shortAddr(p.wallet_address)}
                </span>
              </span>
            </button>
          ))}
          {!direct && matches.length === 0 && (
            <p className="py-10 text-center text-sm text-white/35">No profile matches that search.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}