import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { Trash2 } from 'lucide-react';
import { saveRules } from '@/lib/rewards';
import { shortAddr } from '@/lib/profiles';

const FIELDS = [
  { key: 'referral_xlm', label: 'Per invited member' },
  { key: 'launch_xlm', label: 'Per token or collection launch' },
  { key: 'social_xlm', label: 'Per social callout' },
  { key: 'min_claim_xlm', label: 'Minimum claim' },
];

// The amounts and thresholds are the program's dials — changing them here
// changes what future activity earns, and nothing already credited.
export default function RewardSettingsForm({ rules, wallet, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    referral_xlm: String(rules.referral_xlm ?? ''),
    launch_xlm: String(rules.launch_xlm ?? ''),
    social_xlm: String(rules.social_xlm ?? ''),
    min_claim_xlm: String(rules.min_claim_xlm ?? ''),
    is_active: rules.is_active !== false,
    rules_note: rules.rules_note || '',
    admin_wallets: rules.admin_wallets || [],
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const patch = {
        referral_xlm: parseFloat(form.referral_xlm) || 0,
        launch_xlm: parseFloat(form.launch_xlm) || 0,
        social_xlm: parseFloat(form.social_xlm) || 0,
        min_claim_xlm: parseFloat(form.min_claim_xlm) || 0,
        is_active: form.is_active,
        rules_note: form.rules_note,
        admin_wallets: form.admin_wallets,
      };
      await saveRules(patch);
      toast({ title: 'Reward rules saved' });
      onSaved?.();
    } catch (e) {
      toast({ title: 'Could not save the rules', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = (address) => {
    const admins = form.admin_wallets || [];
    setForm({
      ...form,
      admin_wallets: admins.includes(address) ? admins.filter((a) => a !== address) : [...admins, address],
    });
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold">Program rules</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">
          Rewards are amounts in XLM; the minimum claim is what a member must have earned before
          submitting.
        </p>
      </div>

      <div className="space-y-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex items-center gap-3">
            <span className="flex-1 text-xs text-[#F2F7F4]/70">{field.label}</span>
            <input
              type="number"
              inputMode="decimal"
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              className="w-24 bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-right font-mono text-xs outline-none focus:border-[#00F59B]/40"
            />
            <span className="text-[10px] font-mono text-[#F2F7F4]/40 w-8">XLM</span>
          </label>
        ))}
      </div>

      <label className="flex items-center justify-between gap-3 bg-black/25 rounded-xl px-3 py-3">
        <span className="text-xs text-[#F2F7F4]/70">Credit new activity</span>
        <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
      </label>

      <div>
        <label className="text-xs text-[#F2F7F4]/70">Rules text shown to members</label>
        <textarea
          value={form.rules_note}
          onChange={(e) => setForm({ ...form, rules_note: e.target.value })}
          rows={3}
          className="w-full mt-1.5 bg-black/30 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-[#00F59B]/40 resize-none"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#F2F7F4]/70">Reviewer wallets</span>
          {wallet && !(form.admin_wallets || []).includes(wallet) && (
            <button
              onClick={() => toggleAdmin(wallet)}
              className="text-[10px] font-bold text-[#00F59B]"
            >
              Add my wallet
            </button>
          )}
        </div>
        {(form.admin_wallets || []).length === 0 ? (
          <p className="text-[10px] text-[#F2F7F4]/40">
            No wallet listed — anyone connected can claim the reviewer role.
          </p>
        ) : (
          (form.admin_wallets || []).map((address) => (
            <div key={address} className="flex items-center gap-2 bg-black/25 rounded-xl px-3 py-2">
              <span className="flex-1 min-w-0 font-mono text-[10px] text-[#F2F7F4]/60 truncate">
                {shortAddr(address)} · {address}
              </span>
              <button onClick={() => toggleAdmin(address)} aria-label="Remove reviewer">
                <Trash2 size={14} className="text-[#ff3b5c]" />
              </button>
            </div>
          ))
        )}
      </div>

      <button
        onClick={save}
        disabled={busy}
        className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save rules'}
      </button>
    </div>
  );
}