import { ExternalLink } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { MASCOT_IMAGE } from '@/lib/brandAssets';

const shortAddress = (address) => (address ? `${address.slice(0, 6)}…${address.slice(-5)}` : '');

// The faucet's own listing: what one claim pays and how often.
export default function PlunchFaucetCard({ walletAddress }) {
  return (
    <div className="rounded-[16px] border border-[#16211E] bg-[#101816] p-4">
      <div className="flex items-start gap-3">
        <Image
          src={MASCOT_IMAGE}
          alt="PLUNCH"
          className="w-11 h-11 rounded-[12px] border border-[#1E2A26] bg-[#0C1512] shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display text-[17px] leading-none text-[#F2F7F4]">PLUNCH</p>
            <span className="rounded-full border border-[#00F59B]/35 bg-[#00F59B]/[.14] px-2 py-[2px] text-[9px] font-black uppercase tracking-[.12em] text-[#00F59B]">
              Active
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-[#F2F7F4]/55">
            The community faucet — free PLUNCH for every Stellar wallet, every 24 hours.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[12px] border border-[#16211E] bg-[#0C1512] px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/40">Per claim</p>
          <p className="mt-0.5 font-mono text-[13px] leading-tight text-[#00F59B]">90,000 PLUNCH</p>
        </div>
        <div className="rounded-[12px] border border-[#16211E] bg-[#0C1512] px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/40">Cooldown</p>
          <p className="mt-0.5 font-mono text-[13px] leading-tight text-[#F2F7F4]">24 hours</p>
        </div>
      </div>

      {walletAddress && (
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#F2F7F4]/40">
          <span>Wallet:</span>
          <span className="font-mono text-[#F2F7F4]/70">{shortAddress(walletAddress)}</span>
          <a
            href={`https://stellar.expert/explorer/public/account/${walletAddress}`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 font-bold text-[#00F59B]/80 transition duration-200 hover:text-[#00F59B]"
          >
            Explorer <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}