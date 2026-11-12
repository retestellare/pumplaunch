import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Loader2, Plus } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import { createTeam, fetchTeams, joinTeam, leaveTeam } from '@/lib/social';
import TeamCard from '@/components/team/TeamCard';
import CreateTeamForm from '@/components/team/CreateTeamForm';

export default function Teams() {
  const { wallet, connect, connecting } = useWallet();
  const goBack = useGoBack('/social');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const list = await fetchTeams().catch(() => []);
    setTeams(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async ({ name, description }) => {
    if (!wallet?.address) {
      connect();
      throw new Error('Connect a wallet to create a team.');
    }
    await createTeam({ name, description, wallet: wallet.address });
    setCreating(false);
    await load();
  };

  const join = async (team) => {
    setBusyId(team.id);
    try {
      await joinTeam(team, wallet.address);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const leave = async (team) => {
    setBusyId(team.id);
    try {
      await leaveTeam(team, wallet.address);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-3 px-4">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 text-lg font-bold tracking-tight">Teams</h1>
          <button
            onClick={() => (wallet?.address ? setCreating(true) : connect())}
            aria-label="Create a team"
            className="text-white/70 transition duration-200 hover:text-[#00ff88]"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="space-y-3 p-4">
        {!wallet?.address && (
          <div className="rounded-2xl border border-white/5 bg-[#141518] p-4 text-center">
            <p className="text-sm text-white/45">Connect a wallet to create or join a team.</p>
            <button
              onClick={connect}
              disabled={connecting}
              className="mt-3 h-9 rounded-xl bg-[#00ff88] px-4 text-xs font-bold text-black disabled:opacity-60"
            >
              {connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          </div>
        )}

        {creating && (
          <CreateTeamForm onCreate={create} onCancel={() => setCreating(false)} />
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-[#00ff88]" />
          </div>
        ) : teams.length === 0 ? (
          <p className="py-16 text-center text-sm text-white/35">
            No teams yet. Start the first one.
          </p>
        ) : (
          teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              wallet={wallet?.address}
              busy={busyId === team.id}
              onJoin={join}
              onLeave={leave}
            />
          ))
        )}
      </main>
    </div>
  );
}