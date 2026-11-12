import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';
import * as StellarSdk from 'npm:@stellar/stellar-sdk@17.1.0';
import {
  HORIZON_URL,
  acquireLock,
  plunchBalance,
  plunchLine,
  plunchPrice,
  readParked,
  releaseLock,
  sendPlunch,
  waitForParked,
} from '../../shared/plunch.ts';

// Each completed invitation is worth 1 XLM of PLUNCH, paid to BOTH wallets: the
// inviter and the member who joined with the link.
const REWARD_XLM = 1;
const LOCK_KEY = 'plunch-referral';
const HISTORY_LIMIT = 30;
const MAX_CREDITS = 100;

const reply = (body, status = 200) => Response.json(body, { status });

// Wallet-signed rewards: this endpoint has no app-user session to scope by, so the
// credits are read and written with the service role and are the only authority
// on who has been paid. Clients read their own state through this endpoint.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = ['status', 'sync', 'claim', 'confirm'].includes(body.action) ? body.action : 'status';
    const address = String(body.wallet_address || '').trim();

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      return reply({ error: 'Connect a valid Stellar wallet to continue.' }, 400);
    }

    const funder = StellarSdk.Keypair.fromSecret(secrets.get('PUMPLAUNCH_FUNDER_SECRET'));
    const server = new StellarSdk.Horizon.Server(HORIZON_URL);
    const rewardsApi = base44.asServiceRole.entities.ReferralReward;
    const referralsApi = base44.asServiceRole.entities.Referral;

    // ── status: the accumulated balance and the history behind it ────────────
    if (action === 'status') {
      const history = await rewardsApi.filter(
        { wallet_address: address },
        { sort: '-created_date', limit: HISTORY_LIMIT }
      );
      const rows = history?.items || [];
      const credited = rows.filter((row) => row.status === 'credited');
      const plunch = Math.floor(credited.reduce((sum, row) => sum + (Number(row.plunch) || 0), 0));
      const invited = await referralsApi.count({ referrer_wallet: address });
      const price = await plunchPrice(server);

      let account = null;
      try {
        account = await server.loadAccount(address);
      } catch {
        account = null;
      }
      const line = account ? plunchLine(account) : null;

      return reply({
        plunch,
        price,
        target_xlm: REWARD_XLM,
        invited: Number(invited) || 0,
        trustline: Boolean(line) && line.is_authorized !== false,
        balance: account ? plunchBalance(account) : 0,
        rewards: rows.map((row) => ({
          id: row.id,
          side: row.side,
          referred_wallet: row.referred_wallet,
          plunch: row.plunch,
          status: row.status,
          created_date: row.created_date,
          tx_hash: row.tx_hash || '',
        })),
      });
    }

    // ── sync: both sides are credited once the invited profile is complete ───
    if (action === 'sync') {
      const invitedPage = await referralsApi.filter(
        { referred_wallet: address },
        { sort: '-created_date', limit: 5 }
      );
      const invitations = invitedPage?.items || [];
      if (!invitations.length) return reply({ invited: false, completed: false, credited: 0 });

      const profilePage = await base44.asServiceRole.entities.Profile.filter(
        { wallet_address: address },
        { limit: 1 }
      );
      const profile = profilePage?.items?.[0];
      const completed = Boolean(
        profile && String(profile.display_name || '').trim() && String(profile.avatar_url || '').trim()
      );
      if (!completed) return reply({ invited: true, completed: false, credited: 0 });

      // One invitation, one credit for each side — however often this runs.
      const already = await rewardsApi.filter({ referred_wallet: address, side: 'invitee' }, { limit: 1 });
      if (already?.items?.length) return reply({ invited: true, completed: true, credited: 0 });

      const price = await plunchPrice(server);
      if (!(price > 0)) {
        return reply({ error: 'The PLUNCH market price cannot be read right now. Try again in a moment.' }, 503);
      }
      const amount = Math.floor(REWARD_XLM / price);
      if (amount < 1) {
        return reply({ error: 'The referral reward cannot be priced right now. Try again in a moment.' }, 503);
      }

      let credited = 0;
      for (const invitation of invitations) {
        if (!invitation.referrer_wallet || invitation.referrer_wallet === address) continue;
        const base = {
          referred_wallet: address,
          plunch: amount,
          xlm_value: REWARD_XLM,
          status: 'credited',
        };
        await rewardsApi.create({ ...base, wallet_address: invitation.referrer_wallet, side: 'inviter' });
        await rewardsApi.create({ ...base, wallet_address: address, side: 'invitee' });
        if (!invitation.verified) await referralsApi.update(invitation.id, { verified: true });
        credited = amount;
        break;
      }
      return reply({ invited: true, completed: true, credited, price });
    }

    // ── confirm: the wallet reports the transaction the parked balance left in ─
    if (action === 'confirm') {
      const txHash = String(body.tx_hash || '').trim();
      if (txHash) {
        await rewardsApi.updateMany(
          { wallet_address: address, status: 'paid', tx_hash: '' },
          { $set: { tx_hash: txHash } }
        );
      }
      return reply({ ok: true });
    }

    // ── claim: everything credited so far leaves in one payout ───────────────
    const holder = crypto.randomUUID();
    const lockId = await acquireLock(base44, LOCK_KEY, holder);
    if (!lockId) {
      return reply({ error: 'A payout is going out right now. Try again in a moment.' }, 429);
    }

    try {
      let account;
      try {
        account = await server.loadAccount(address);
      } catch {
        return reply({ error: 'This wallet has no activity on Stellar mainnet yet.' }, 400);
      }
      const line = plunchLine(account);
      const trustline = Boolean(line) && line.is_authorized !== false;

      // A balance already parked for this wallet IS this payout: it is handed
      // back so the wallet claims it in one approval, and nothing new is parked.
      const parked = await readParked(server, address);
      if (parked) {
        return reply({
          amount: parked.amount,
          trustline_required: !trustline,
          claimable_balance_id: parked.id,
        });
      }

      const creditedPage = await rewardsApi.filter(
        { wallet_address: address, status: 'credited' },
        { sort: 'created_date', limit: MAX_CREDITS }
      );
      const credited = creditedPage?.items || [];
      const total = Math.floor(credited.reduce((sum, row) => sum + (Number(row.plunch) || 0), 0));
      if (total < 1) {
        return reply({ error: 'Nothing to request yet — invite a member first.' }, 400);
      }

      const pool = plunchBalance(await server.loadAccount(funder.publicKey()));
      const amount = Math.min(total, Math.floor(pool));
      if (amount < 1) {
        return reply({ error: 'The PLUNCH reward pool is empty right now. Try again later.' }, 503);
      }

      // Only the credits this payout actually covers are closed, so a short pool
      // leaves the rest waiting instead of losing it.
      const covered = [];
      let running = 0;
      for (const row of credited) {
        const value = Number(row.plunch) || 0;
        if (running + value > amount) break;
        covered.push(row);
        running += value;
      }
      const sending = Math.floor(running);
      if (sending < 1) {
        return reply({ error: 'The PLUNCH reward pool is empty right now. Try again later.' }, 503);
      }

      const payment = await sendPlunch({
        server,
        funder,
        destination: address,
        amount: sending,
        trustline,
        memo: 'PLUNCH referral reward',
      });

      if (!payment.result) {
        const codes = payment.failure?.response?.data?.extras?.result_codes;
        const detail = codes?.operations?.join(', ') || codes?.transaction || payment.failure?.message;
        return reply({ error: `The payout did not go through (${detail}). Nothing was sent.` }, 502);
      }

      // Without the line, the tokens sit in a balance only this wallet can claim.
      // Nothing is closed until that balance is readable, so an unreadable one
      // leaves the credits waiting for the next request, which hands it back.
      let claimableBalanceId = '';
      if (!trustline) {
        const parkedNow = await waitForParked(server, address);
        if (!parkedNow) {
          return reply(
            { error: 'The payout was reserved but is not readable yet. Request again in a moment.' },
            502
          );
        }
        claimableBalanceId = parkedNow.id;
      }

      const ids = covered.map((row) => row.id);
      if (ids.length) {
        await rewardsApi.updateMany(
          { id: { $in: ids } },
          {
            $set: {
              status: 'paid',
              // A parked balance is closed with the transaction that claims it,
              // which the wallet reports once it has signed.
              tx_hash: trustline ? payment.result.hash : '',
              paid_at: new Date().toISOString(),
            },
          }
        );
      }

      if (!trustline) {
        return reply({
          amount: sending,
          tx_hash: payment.result.hash,
          trustline_required: true,
          claimable_balance_id: claimableBalanceId,
        });
      }

      return reply({
        amount: sending,
        tx_hash: payment.result.hash,
        paid_at: new Date().toISOString(),
      });
    } catch (error) {
      return reply({ error: error.message }, 502);
    } finally {
      await releaseLock(base44, LOCK_KEY, lockId, holder);
    }
  } catch (error) {
    return reply({ error: error.message }, 500);
  }
}