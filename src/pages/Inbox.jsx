import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Pencil } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import {
  acceptRequest,
  fetchActivity,
  fetchThreads,
  markActivityRead,
} from '@/lib/social';
import ThreadRow from '@/components/inbox/ThreadRow';
import ActivityRow from '@/components/inbox/ActivityRow';
import ComposeSheet from '@/components/inbox/ComposeSheet';

const TABS = [
  { key: 'messages', label: 'Messages' },
  { key: 'activity', label: 'Activity' },
  { key: 'requests', label: 'Requests' },
];

const EMPTY = { conversations: [], requests: [], unread: 0 };

export default function Inbox() {
  const { wallet, connect, connecting } = useWallet();
  const goBack = useGoBack('/social');
  const [tab, setTab] = useState('messages');
  const [threads, setThreads] = useState(EMPTY);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (!wallet?.address) {
      setThreads(EMPTY);
      setActivity([]);
      setLoading(false);
      return;
    }
    const [t, notes] = await Promise.all([
      fetchThreads(wallet.address).catch(() => EMPTY),
      fetchActivity(wallet.address).catch(() => []),
    ]);
    setThreads(t);
    setActivity(notes);
    setLoading(false);
  }, [wallet?.address]);

  useEffect(() => {
    load();
  }, [load]);

  // Opening the activity tab clears its unread count.
  useEffect(() => {
    if (tab === 'activity' && wallet?.address) {
      markActivityRead(wallet.address).catch(() => {});
    }
  }, [tab, wallet?.address]);

  const accept = async (address) => {
    await acceptRequest(wallet.address, address).catch(() => {});
    load();
  };

  const list =
    tab === 'messages' ? threads.conversations : tab === 'requests' ? threads.requests : [];

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">Inbox</h1>
          <button
            onClick={() => (wallet?.address ? setComposing(true) : connect())}
            aria-label="New message"
            className="text-white/70 transition duration-200 hover:text-[#00ff88]"
          >
            <Pencil size={19} />
          </button>
        </div>

        {/* Underline tabs, with the unread dot sitting beside the word. */}
        <div className="flex px-4">
          {TABS.map((t) => {
            const on = tab === t.key;
            const count =
              t.key === 'messages'
                ? threads.unread
                : t.key === 'requests'
                ? threads.requests.length
                : 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 pb-2.5 pr-4 text-[13px] transition duration-200 ${
                  on ? 'font-bold text-white' : 'text-white/40'
                }`}
              >
                {t.label}
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" />}
                {on && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 py-2">
        {!wallet?.address ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-white/45">Connect a wallet to read and send messages.</p>
            <button
              onClick={connect}
              disabled={connecting}
              className="mt-4 h-10 rounded-xl bg-[#00ff88] px-5 text-sm font-bold text-black disabled:opacity-60"
            >
              {connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[#00ff88]" />
          </div>
        ) : tab === 'activity' ? (
          activity.length === 0 ? (
            <p className="py-16 text-center text-sm text-white/35">Nothing here yet.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {activity.map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-white/35">
            {tab === 'requests' ? 'No pending requests.' : 'No messages yet.'}
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {list.map((thread) => (
              <ThreadRow
                key={thread.address}
                thread={thread}
                onAccept={tab === 'requests' ? accept : undefined}
              />
            ))}
          </div>
        )}
      </main>

      <ComposeSheet open={composing} onOpenChange={setComposing} />
    </div>
  );
}