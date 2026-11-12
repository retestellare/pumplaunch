import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Send } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import { resolveProfile, displayName } from '@/lib/profiles';
import { fetchConversation, markThreadRead, sendMessage } from '@/lib/social';
import Avatar from '@/components/Avatar';
import FollowButton from '@/components/social/FollowButton';

function Bubble({ mine, body, at }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
          mine
            ? 'rounded-br-md bg-[#00ff88] text-black'
            : 'rounded-bl-md bg-[#141518] text-white/90'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{body}</p>
        <p className={`mt-1 text-[10px] ${mine ? 'text-black/50' : 'text-white/30'}`}>
          {new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export default function Thread() {
  const { walletAddress } = useParams();
  const { wallet, connect } = useWallet();
  const goBack = useGoBack('/inbox');
  const [messages, setMessages] = useState([]);
  const [profile, setProfile] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    if (!wallet?.address) {
      setLoading(false);
      return;
    }
    const list = await fetchConversation(wallet.address, walletAddress).catch(() => []);
    setMessages(list);
    setLoading(false);
  }, [wallet?.address, walletAddress]);

  useEffect(() => {
    resolveProfile(walletAddress)
      .then(setProfile)
      .catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    load();
  }, [load]);

  // Reading the open conversation is what clears its unread count.
  useEffect(() => {
    if (wallet?.address && messages.length) {
      markThreadRead(wallet.address, walletAddress).catch(() => {});
    }
  }, [wallet?.address, walletAddress, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!wallet?.address) {
      connect();
      return;
    }
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage({ from: wallet.address, to: walletAddress, body: draft });
      setDraft('');
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2.5 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <Link to={`/profile/${walletAddress}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar profile={profile} address={walletAddress} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-white">
                {displayName(profile, walletAddress)}
              </span>
              <span className="block text-[10px] text-white/35">Tap for profile</span>
            </span>
          </Link>
          <FollowButton target={walletAddress} className="!h-8 !px-3 !text-[11px]" />
        </div>
      </header>

      <main className="space-y-2 px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[#00ff88]" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-20 text-center text-sm text-white/35">
            No messages yet — say hi to {displayName(profile, walletAddress)}.
          </p>
        ) : (
          messages.map((m) => (
            <Bubble
              key={m.id}
              mine={m.from_wallet === wallet?.address}
              body={m.body}
              at={m.created_date}
            />
          ))
        )}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={send}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 mx-auto flex max-w-lg items-center gap-2 border-t border-white/5 bg-[#0a0b0d]/95 px-3 py-2.5 backdrop-blur"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={wallet?.address ? 'Write a message' : 'Connect a wallet to reply'}
          maxLength={2000}
          className="h-10 flex-1 rounded-xl bg-[#141518] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#00ff88]/40"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Send"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00ff88] text-black transition duration-200 disabled:opacity-40"
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </form>
    </div>
  );
}