// Guide copy for each launch service. One entry per service, so the guide on
// screen always describes the service the form is currently set to.

const SHARED_START = {
  title: 'Before you start',
  items: [
    'This is a real Stellar mainnet launch — transactions are irreversible and use real XLM.',
    'Fund your wallet with enough XLM first (see the cost breakdown on the confirm screen).',
    'Keep your wallet app open; each transaction you submit asks you to approve it.',
  ],
};

const SHARED_SYMBOL = {
  title: 'Symbol rules',
  items: [
    '4–12 characters, letters and numbers only (no spaces or symbols).',
    'Pick a unique symbol — if your wallet already holds a token with that symbol, we reuse it instead of creating a new one.',
    'You cannot change the symbol after launch.',
  ],
};

const SHARED_MISTAKES = {
  title: 'Common mistakes to avoid',
  items: [
    'Launching the same symbol twice — resume the interrupted launch instead.',
    'Closing the page mid-launch; your progress is saved, just hit Resume.',
    'Confirming without reading the cost breakdown on the review screen.',
  ],
};

const CURVE = {
  id: 'curve',
  label: 'Bonding Curve',
  summary: '100% of the supply sits on the DEX as rungs of sell offers; price climbs one rung per buy.',
  sections: [
    SHARED_START,
    {
      title: 'How a bonding curve launch works',
      items: [
        'Every token is offered for sale on the Stellar DEX as a stack of sell offers — the rungs of the curve.',
        'The first buyer pays the lowest rung; each following buy fills the next one up, so price rises with demand.',
        'Sellers do the reverse: tokens sent back walk the price down the rungs.',
        'Slow climbs gently, Fast rises sharply after early buys — later buyers pay much more.',
      ],
    },
    {
      title: 'Initial liquidity (optional)',
      items: [
        'Adding 10+ XLM seeds a liquidity pool next to the curve, which gives the token a smoother price.',
        'Minimum 10 XLM, 50+ recommended. Too little liquidity means violent swings on the first trades.',
      ],
    },
    SHARED_SYMBOL,
    {
      title: 'Your wallet approvals',
      items: [
        '1 — Issuer account and your trustline are created: one approval from your wallet.',
        '2 — The tokens are issued by the new issuer key, which this app signs automatically: no prompt.',
        '3 — Each rung of the curve is placed in one transaction: one approval.',
        '4 — If you added initial liquidity, seeding the pool is a further approval.',
        'Resuming a launch skips the stages already confirmed on-chain, so you are never asked to pay twice.',
      ],
    },
    {
      title: 'Costs to expect',
      items: [
        '~2 XLM issuer reserve — non-refundable (it funds the locked issuer account).',
        'Network fees (~0.00001 XLM per operation) plus refundable reserves for offers and trustlines.',
        'The confirm screen shows the exact estimated total before you sign anything.',
      ],
    },
    SHARED_MISTAKES,
  ],
  warning: 'If a step fails, do not start over — use Resume so you never pay the 2 XLM issuer reserve twice.',
};

const AUTO_POOL = {
  id: 'auto_pool',
  label: 'Auto-Pool',
  summary: 'Supply comes from your deposit, and every XLM from buyers goes straight into the liquidity pool.',
  sections: [
    SHARED_START,
    {
      title: 'How Auto-Pool works',
      items: [
        'You choose the liquidity; the total supply is derived from it, and every token goes into the pool.',
        'Nothing is sold from a curve: price comes from the pool ratio, so buys push it up and sells push it down.',
        'Buyers release tokens from the pool as they purchase, which keeps liquidity growing as the token trades.',
      ],
    },
    {
      title: 'Choosing the pair',
      items: [
        'XLM — the pool is quoted in XLM. Simplest, and enough for most launches.',
        'USDC — the pool is quoted in USDC; you deposit USDC and need a USDC trustline.',
        'Split — you deposit XLM only: half seeds the XLM pool and the other half is swapped to USDC at the live rate to seed the USDC pool.',
        'Both pools open at the same price, so the two markets cannot be arbitraged against each other.',
      ],
    },
    SHARED_SYMBOL,
    {
      title: 'Your wallet approvals',
      items: [
        '1 — Issuer account and your trustline are created: one approval from your wallet.',
        '2 — The tokens are issued by the new issuer key, signed automatically: no prompt.',
        '3 — A Split launch converts the USDC leg on the DEX: one approval (skipped when your USDC leg already landed).',
        '4 — Each pool is seeded with a trustline plus the deposit in one transaction: one approval per pool.',
        'Resuming skips pools that are already live, so nothing is seeded twice.',
      ],
    },
    {
      title: 'Costs to expect',
      items: [
        '~2 XLM issuer reserve — non-refundable.',
        'Your initial liquidity, plus 0.5 XLM reserve per pool share trustline and network fees.',
        'A USDC pool adds the USDC trustline (0.5 XLM, refundable) if your wallet does not have one yet.',
      ],
    },
    SHARED_MISTAKES,
  ],
  warning: 'Price follows the pool ratio: a small deposit means the first trades move the price a lot. 50+ XLM of liquidity is recommended.',
};

const LOCKED = {
  id: 'locked',
  label: 'Locked Liquidity',
  summary: 'Your deposit is locked in a pool nobody can withdraw; the supply split is 50% or 100%.',
  sections: [
    SHARED_START,
    {
      title: 'What a locked launch is',
      items: [
        'You deposit one asset (XLM or USDC) and it is paired with tokens at a fixed ratio the moment the pool opens.',
        'The liquidity is held by a dedicated vault account that loses its only signer as it deposits — so nobody, including you, can ever withdraw the pool shares.',
        'The launch price is fixed by that ratio in both 50% and 100% mode: 1 XLM = 1,000,000 tokens (USDC launches follow the live XLM/USDC rate).',
      ],
    },
    {
      title: '50% vs 100% supply',
      items: [
        '50% locked — the lock receives one token for every unit of your deposit and you receive the same amount, so half the supply is locked and half is yours.',
        '100% locked — the supply is exactly what the lock absorbs and you receive none: every token can only be bought from the pool.',
        'Neither mode changes the opening price; they only change who starts with tokens.',
        'In 50% mode your own tokens can be sold back into the pool, which is how you take profit.',
      ],
    },
    {
      title: 'Your deposit and the ratio',
      items: [
        'The deposit leaves your wallet permanently — it is the liquidity, not a loan.',
        'There is no minimum while the model is being tested, but a thin deposit means the first trades swing the price hard.',
        'A USDC deposit needs USDC in your wallet; a USDC trustline is added for the vault as part of the launch.',
        'The preview in the form shows the fixed ratio, your share, the locked amount, the total supply and the launch price before you sign anything.',
      ],
    },
    {
      title: 'The secure pool and the permanent lock',
      items: [
        'Step 1 — a fresh vault account is created and funded from your wallet.',
        'Step 2 — the vault opens trustlines for the token, the pool shares, and USDC when it is the quote asset.',
        'Step 3 — you transfer the matched tokens (and the USDC deposit, when quoted in USDC) into the vault.',
        'Step 4 — the vault deposits everything into the Stellar constant-product pool and sets its master weight to zero in the same transaction.',
        'From that ledger close the vault can never sign again: the pool shares can never be redeemed and the liquidity can never be withdrawn.',
      ],
    },
    {
      title: 'Every wallet approval, in order',
      items: [
        '1 — Issuer account and your trustline: one wallet approval.',
        '2 — Tokens issued by the new issuer key, signed by the app: no prompt.',
        '3 — Vault creation, funded with ~3 XLM reserve plus the deposit when it is in XLM: one wallet approval.',
        '4 — Vault trustlines, signed by the vault key: no prompt.',
        '5 — Moving the tokens and any USDC into the vault: one wallet approval.',
        '6 — Pool deposit plus the signer lock, signed by the vault key: no prompt.',
        'So a fresh XLM launch typically asks for 3 approvals. Fewer appear when work was already done — a resumed launch skips finished stages, and reusing a symbol you already hold skips the issuer stages entirely.',
      ],
    },
    {
      title: 'What it costs',
      items: [
        '~2 XLM issuer reserve — non-refundable.',
        '~3 XLM vault reserve — non-refundable; it stays with the locked vault forever.',
        'Network fees for the extra vault and lock transactions.',
        'The deposit itself, which is locked rather than spent — but is unreachable once the lock closes.',
        'The confirm screen lists all of it before you sign.',
      ],
    },
    {
      title: 'After the lock',
      items: [
        'Nobody can add to or remove the pool liquidity; trading is the only way tokens move.',
        'In 50% mode you can sell your half into the pool like any holder — the pool pays you from its reserves.',
        'Buyers push the price up, sellers push it down, always by the pool ratio.',
        'The token page shows the locked amount, the ratio and a link to the vault account so anyone can verify the lock on-chain.',
      ],
    },
    SHARED_SYMBOL,
    SHARED_MISTAKES,
  ],
  warning: 'A locked launch cannot be undone: the deposit and the pool shares are unreachable from the moment the lock closes. Confirm only what you are happy to leave there forever.',
};

const NFT = {
  id: 'nft',
  label: 'NFT Collection',
  summary: 'One asset per collection, one unit per edition, sold through a single DEX offer.',
  sections: [
    {
      title: 'What a collection is on Stellar',
      items: [
        'A collection is one Stellar asset, and every edition is one unit of it. The name, artwork and details live in a metadata document saved with it.',
        '1/1 Unique = a single one-of-one piece. Limited Supply = a fixed number of editions, minted until they run out.',
        'The edition size is sealed by the network at launch — the issuer key is locked in the same transaction that hands the supply to you, so the supply can never be increased later.',
      ],
    },
    {
      title: 'Editions & supply',
      items: [
        'Symbol: 3–8 letters and numbers. Supply: 1 for a 1/1, or 2 to 1,000,000 for a limited drop.',
        'Each mint claims the next edition. The moment the last one is taken, the collection flips to Sold Out on its own.',
        'The progress shown on the collection card is read from the network, not from a local counter.',
      ],
    },
    {
      title: 'Artwork & metadata',
      items: [
        'Upload the artwork (image, up to 10MB). It gets a permanent public URL so wallets and marketplaces can load it.',
        'The metadata document — name, symbol, description, image, edition size, plus traits for price and royalty — is built from this form and stored with the collection.',
        'Marketplaces read those fields, so a clear name and description help your drop display correctly.',
      ],
    },
    {
      title: 'Price and the primary sale',
      items: [
        'A mint price above 0 is required. The price becomes a single sell offer for the whole supply on the Stellar DEX.',
        'Minting is a real purchase: the buyer’s wallet sends the price and receives the edition in one signed transaction, and the DEX pays you directly. Nothing is held by the app.',
        'Stellar prices to 7 decimals, so the offer holds the price you enter at that precision.',
      ],
    },
    {
      title: 'Royalty',
      items: [
        'The royalty % is written into the metadata and honored by marketplaces that support royalties.',
        'Stellar has no on-chain royalty enforcement, so treat it as a marketplace setting rather than a guarantee.',
      ],
    },
    {
      title: 'Your wallet approvals',
      items: [
        '1 — Issuer account and your trustline are created: one wallet approval.',
        '2 — Editions are issued and the issuer locked, signed by the app: no prompt.',
        '3 — The sale offer for the whole supply is placed: one approval.',
        'A mint is a single approval from the buyer’s wallet, which pays the DEX offer directly.',
      ],
    },
    {
      title: 'Costs to expect',
      items: [
        '~2 XLM issuer reserve (non-refundable), plus refundable reserves for the trustlines and the sale offer.',
        'Network fees are ~0.00001 XLM per operation. Launching and minting in USDC adds the USDC trustline.',
        'A first-time minter pays a small extra 0.5 XLM reserve for the collection trustline.',
        'The review screen lists every account, trustline and offer with the exact estimated total before you sign anything.',
      ],
    },
    {
      title: 'Common mistakes to avoid',
      items: [
        'Launching without a mint price — the primary sale needs a real price to sell editions.',
        'Choosing a supply far larger than your audience: unsold editions simply stay in your wallet.',
        'Uploading artwork that is not final — the art and metadata are fixed at launch.',
        'Skipping the review screen, which is your last look at what goes on-chain.',
      ],
    },
  ],
  warning: 'This is a real Stellar mainnet launch with real XLM — once editions are live they cannot be edited or recalled.',
};

const SERVICES = { curve: CURVE, auto_pool: AUTO_POOL, locked: LOCKED, nft: NFT };

export function guideFor(id) {
  return SERVICES[id] || CURVE;
}

export function guideList(ids) {
  return ids.map(guideFor);
}