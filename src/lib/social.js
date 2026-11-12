import { base44 } from '@/api/base44Client';
import { resolveProfiles } from '@/lib/profiles';

// Wallet-to-wallet social graph. Every identity here is a Stellar address, the
// same one the profile, the feed and the reward program use.

const MESSAGES = 'DirectMessage';
const FOLLOWS = 'Follow';
const NOTES = 'SocialNotification';
const TEAMS = 'Team';

// ── Follows ──────────────────────────────────────────────────────────────────
export async function isFollowing(from, to) {
  if (!from || !to || from === to) return false;
  const n = await base44.entities[FOLLOWS].count({ from_wallet: from, to_wallet: to });
  return n > 0;
}

export async function followCounts(wallet) {
  if (!wallet) return { followers: 0, following: 0 };
  const [followers, following] = await Promise.all([
    base44.entities[FOLLOWS].count({ to_wallet: wallet }),
    base44.entities[FOLLOWS].count({ from_wallet: wallet }),
  ]);
  return { followers: followers || 0, following: following || 0 };
}

export async function followersOf(wallet) {
  if (!wallet) return [];
  const list = await base44.entities[FOLLOWS].filter({ to_wallet: wallet }, '-created_date', 100);
  return (list || []).map((f) => f.from_wallet);
}

// A notification is a courtesy, never a reason to fail the action behind it.
export async function notify({ wallet, actor, type, text, href }) {
  if (!wallet || wallet === actor) return null;
  try {
    return await base44.entities[NOTES].create({
      wallet_address: wallet,
      type,
      actor_wallet: actor,
      text,
      href: href || '',
    });
  } catch {
    return null;
  }
}

export async function followUser(from, to) {
  if (!from || !to || from === to) return false;
  const already = await isFollowing(from, to);
  if (!already) {
    await base44.entities[FOLLOWS].create({ from_wallet: from, to_wallet: to });
    await notify({
      wallet: to,
      actor: from,
      type: 'follow',
      text: 'started following you',
      href: `/profile/${from}`,
    });
  }
  return true;
}

export async function unfollowUser(from, to) {
  await base44.entities[FOLLOWS].deleteMany({ from_wallet: from, to_wallet: to });
  return false;
}

// ── Messages ─────────────────────────────────────────────────────────────────
// The first message a stranger sends is a request: it waits in its own tab until
// the receiver answers it. Someone the receiver follows writes straight into the
// inbox.
export async function sendMessage({ from, to, body }) {
  const text = String(body || '').trim();
  if (!from || !to || from === to || !text) return null;

  const [known, prior] = await Promise.all([
    isFollowing(to, from),
    base44.entities[MESSAGES].count({ from_wallet: from, to_wallet: to }),
  ]);

  const message = await base44.entities[MESSAGES].create({
    from_wallet: from,
    to_wallet: to,
    body: text.slice(0, 2000),
    is_request: !known && (prior || 0) === 0,
  });

  await notify({
    wallet: to,
    actor: from,
    type: 'message',
    text: 'sent you a message',
    href: `/messages/${from}`,
  });
  return message;
}

export async function fetchConversation(wallet, other) {
  if (!wallet || !other) return [];
  // Read both directions separately, then interleave: one query per side is the
  // cheapest thing the server can answer.
  const [mine, theirs] = await Promise.all([
    base44.entities[MESSAGES].filter({ from_wallet: wallet, to_wallet: other }, '-created_date', 100),
    base44.entities[MESSAGES].filter({ from_wallet: other, to_wallet: wallet }, '-created_date', 100),
  ]);
  return [...(mine || []), ...(theirs || [])].sort(
    (a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime()
  );
}

export async function markThreadRead(wallet, other) {
  await base44.entities[MESSAGES].updateMany(
    { from_wallet: other, to_wallet: wallet, read: false },
    { $set: { read: true } }
  );
}

export async function acceptRequest(wallet, other) {
  await base44.entities[MESSAGES].updateMany(
    { from_wallet: other, to_wallet: wallet, is_request: true },
    { $set: { is_request: false, read: true } }
  );
}

// One row per person, newest message first, split into the two inbox tabs.
export async function fetchThreads(wallet) {
  const empty = { conversations: [], requests: [], unread: 0 };
  if (!wallet) return empty;

  const [sent, received] = await Promise.all([
    base44.entities[MESSAGES].filter({ from_wallet: wallet }, '-created_date', 100),
    base44.entities[MESSAGES].filter({ to_wallet: wallet }, '-created_date', 100),
  ]);
  const list = [...(sent || []), ...(received || [])].sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  );

  const byPerson = new Map();
  for (const m of list) {
    const other = m.from_wallet === wallet ? m.to_wallet : m.from_wallet;
    let thread = byPerson.get(other);
    if (!thread) {
      // The list arrives newest first, so the first row seen is the preview.
      thread = { address: other, last: m, unread: 0, incomingRequest: false, replied: false };
      byPerson.set(other, thread);
    }
    if (m.to_wallet === wallet && !m.read) thread.unread += 1;
    if (m.from_wallet === wallet) thread.replied = true;
    else if (m.is_request) thread.incomingRequest = true;
  }

  const threads = [...byPerson.values()].map((t) => ({
    ...t,
    isRequest: t.incomingRequest && !t.replied,
  }));

  const profiles = await resolveProfiles(threads.map((t) => t.address)).catch(() => ({}));
  const decorated = threads
    .map((t) => ({ ...t, profile: profiles[t.address] || null }))
    .sort(
      (a, b) =>
        new Date(b.last.created_date).getTime() - new Date(a.last.created_date).getTime()
    );

  return {
    conversations: decorated.filter((t) => !t.isRequest),
    requests: decorated.filter((t) => t.isRequest),
    unread: decorated.reduce((sum, t) => sum + t.unread, 0),
  };
}

export async function unreadMessages(wallet) {
  if (!wallet) return 0;
  const n = await base44.entities[MESSAGES].count({ to_wallet: wallet, read: false });
  return n || 0;
}

// ── Activity ─────────────────────────────────────────────────────────────────
export async function fetchActivity(wallet) {
  if (!wallet) return [];
  const list = await base44.entities[NOTES].filter({ wallet_address: wallet }, '-created_date', 50);
  const rows = list || [];
  const profiles = await resolveProfiles(rows.map((r) => r.actor_wallet)).catch(() => ({}));
  return rows.map((r) => ({ ...r, profile: profiles[r.actor_wallet] || null }));
}

export async function markActivityRead(wallet) {
  if (!wallet) return;
  await base44.entities[NOTES].updateMany(
    { wallet_address: wallet, read: false },
    { $set: { read: true } }
  );
}

export async function unreadActivity(wallet) {
  if (!wallet) return 0;
  const n = await base44.entities[NOTES].count({ wallet_address: wallet, read: false });
  return n || 0;
}

// ── Teams ────────────────────────────────────────────────────────────────────
export async function fetchTeams() {
  const list = await base44.entities[TEAMS].list('-created_date', 50);
  const teams = list || [];
  const profiles = await resolveProfiles(teams.flatMap((t) => t.members || [])).catch(() => ({}));
  return teams.map((t) => ({
    ...t,
    members: t.members || [],
    memberProfiles: (t.members || []).slice(0, 4).map((m) => profiles[m] || { wallet_address: m }),
  }));
}

export async function createTeam({ name, description, wallet }) {
  if (!wallet || !name?.trim()) return null;
  return base44.entities[TEAMS].create({
    name: name.trim().slice(0, 40),
    description: String(description || '').trim().slice(0, 240),
    creator_wallet: wallet,
    members: [wallet],
  });
}

export async function joinTeam(team, wallet) {
  await base44.entities[TEAMS].updateMany({ id: team.id }, { $addToSet: { members: wallet } });
  await notify({
    wallet: team.creator_wallet,
    actor: wallet,
    type: 'team',
    text: `joined your team ${team.name}`,
    href: '/teams',
  });
}

export async function leaveTeam(team, wallet) {
  await base44.entities[TEAMS].updateMany({ id: team.id }, { $pull: { members: wallet } });
}