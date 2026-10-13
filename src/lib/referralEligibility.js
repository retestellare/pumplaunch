// Who counts as a real invited member. An invitation earns its reward only once
// the invited wallet proves it takes part — a profile with a name and a photo, a
// token launched from that wallet, and a callout posted in the social feed. Each
// check is one count or read against data the app already stores, so nothing has
// to be trusted from the client.
import { base44 } from '@/api/base44Client';

export const REFERRAL_CHECKS = [
  { key: 'profile', label: 'Profile with a name and photo', path: '/portfolio' },
  { key: 'launch', label: 'A token launched from your wallet', path: '/launch' },
  { key: 'post', label: 'A callout posted in the social feed', path: '/social' },
];

export const REFERRAL_REQUIREMENT =
  'An invitation counts once the invited member sets up a profile with a name and photo, launches a token and posts a callout in the social feed.';

export async function referralEligibility(address) {
  const state = { profile: false, launch: false, post: false, eligible: false };
  if (!address) return state;

  const [profiles, tokens, posts] = await Promise.all([
    base44.entities.Profile.filter({ wallet_address: address }, '-created_date', 1),
    base44.entities.Token.count({ creator: address }),
    base44.entities.Post.count({ author: address }),
  ]);

  const profile = profiles && profiles[0];
  state.profile = !!(profile && profile.display_name && profile.avatar_url);
  state.launch = (tokens || 0) > 0;
  state.post = (posts || 0) > 0;
  state.eligible = state.profile && state.launch && state.post;
  return state;
}