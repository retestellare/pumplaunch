import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { REFERRAL_CHECKS } from '@/lib/referralEligibility';

// Shown to a member who arrived through someone else's invite link: their
// inviter's reward is credited only once all of them are done, which is what
// keeps throwaway wallets out of the program.
export default function ReferralQualification({ state, verified }) {
  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">{verified ? 'Invite complete' : 'Finish your invite'}</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">
          {verified
            ? 'All done — your inviter has been credited.'
            : 'You joined through an invite link. Your inviter is paid the reward once these are done.'}
        </p>
      </div>

      <div className="space-y-2">
        {REFERRAL_CHECKS.map((check) => {
          const done = !!state?.[check.key];
          const row = (
            <div className="flex items-center gap-2.5 bg-black/25 rounded-xl px-3 py-2.5">
              {done ? (
                <CheckCircle2 size={15} className="text-[#00F59B] shrink-0" />
              ) : (
                <Circle size={15} className="text-white/25 shrink-0" />
              )}
              <span className={`flex-1 text-xs ${done ? 'text-[#00F59B]' : 'text-[#F2F7F4]/70'}`}>
                {check.label}
              </span>
              {!done && <span className="text-[10px] font-bold text-[#00F59B] shrink-0">Start</span>}
            </div>
          );
          return done ? (
            <div key={check.key}>{row}</div>
          ) : (
            <Link key={check.key} to={check.path} className="block active:opacity-80">
              {row}
            </Link>
          );
        })}
      </div>
    </div>
  );
}