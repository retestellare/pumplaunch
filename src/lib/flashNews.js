import { base44 } from '@/api/base44Client';
import { fetchNewHolders } from '@/lib/leaderboard';

// How far back an action still counts as news.
const NEWS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 12;

const shortAddr = (addr) => (addr ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : 'Someone');

// The platform's live activity, newest first — a launch, a callout, or a buy.
// Nothing new is fetched: launches come from the token list the app already has,
// buys from the holders sweep (shared with the ticker), callouts from posts.
export async function fetchFlashNews(tokens = []) {
  const cutoff = Date.now() - NEWS_WINDOW_MS;
  const events = [];

  for (const token of tokens) {
    const at = new Date(token.created_date).getTime();
    if (!token.symbol || isNaN(at) || at < cutoff) continue;
    events.push({
      id: `launch-${token.id}`,
      glyph: '🚀',
      tone: '#00F59B',
      text: `$${token.symbol} just launched`,
      at,
    });
  }

  const [posts, buys] = await Promise.all([
    base44.entities.Post.list('-created_date', 12).catch(() => []),
    fetchNewHolders(tokens).catch(() => []),
  ]);

  for (const post of posts || []) {
    const at = new Date(post.created_date).getTime();
    if (isNaN(at) || at < cutoff) continue;
    events.push({
      id: `post-${post.id}`,
      glyph: '📣',
      tone: '#4D9EFF',
      text: post.token_symbol
        ? `${shortAddr(post.author)} called $${post.token_symbol}`
        : `${shortAddr(post.author)} shared a callout`,
      at,
    });
  }

  for (const [i, buy] of (buys || []).entries()) {
    const at = new Date(buy.time).getTime();
    if (isNaN(at)) continue;
    events.push({
      id: `buy-${buy.address}-${i}`,
      glyph: '🟢',
      tone: '#00F59B',
      text: `${shortAddr(buy.address)} bought ${buy.amount.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })} $${buy.tokenSymbol}`,
      at,
    });
  }

  return events.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, MAX_EVENTS);
}