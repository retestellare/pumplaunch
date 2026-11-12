import { Check, LogIn, Users } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { displayName } from '@/lib/profiles';

// A crew that launches and trades together: who is in it, and whether you are.
export default function TeamCard({ team, wallet, onJoin, onLeave, busy }) {
  const members = team.members || [];
  const joined = wallet ? members.includes(wallet) : false;
  const owner = wallet && team.creator_wallet === wallet;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#141518] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#00ff88]/25 bg-[#00ff88]/10">
          <Users size={18} className="text-[#00ff88]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{team.name}</p>
          <p className="mt-0.5 text-[11px] text-white/35">
            {members.length} {members.length === 1 ? 'member' : 'members'}
            {owner ? ' · you lead this team' : ''}
          </p>
        </div>
        {owner ? (
          <span className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[.07em] text-white/45">
            Owner
          </span>
        ) : (
          <button
            onClick={() => (joined ? onLeave(team) : onJoin(team))}
            disabled={busy || !wallet}
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-[11px] font-bold transition duration-200 disabled:opacity-50 ${
              joined
                ? 'border border-white/15 bg-white/5 text-white/70'
                : 'bg-[#00ff88] text-black'
            }`}
          >
            {joined ? <Check size={12} /> : <LogIn size={12} />}
            {joined ? 'Joined' : 'Join'}
          </button>
        )}
      </div>

      {team.description && (
        <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-white/50">
          {team.description}
        </p>
      )}

      {members.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {(team.memberProfiles || []).map((p) => (
              <span key={p.wallet_address} className="rounded-full ring-2 ring-[#141518]">
                <Avatar profile={p} address={p.wallet_address} size={24} />
              </span>
            ))}
          </div>
          <span className="truncate text-[11px] text-white/35">
            {displayName(team.memberProfiles?.[0], members[0])}
            {members.length > 1 ? ` +${members.length - 1} more` : ''}
          </span>
        </div>
      )}
    </div>
  );
}