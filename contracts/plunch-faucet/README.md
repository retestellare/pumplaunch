# PLUNCH faucet contract

Holds the daily-drop pool itself and pays one wallet every 24 hours. The wallet
signs its own claim, so the app needs no server and no payout key.

## Deploy once (Stellar CLI)

```sh
# 1. Build
cd contracts/plunch-faucet
stellar contract build

# 2. Upload + deploy against PLUNCH on mainnet.
#    <TOKEN> is the PLUNCH asset contract (SAC) address, <AMOUNT> one drop in
#    stroops (90,000 PLUNCH with 7 decimals = 900000000000).
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/plunch_faucet.wasm \
  --source <FAUCET_SECRET_KEY> \
  --network mainnet \
  -- \
  --token <TOKEN> --amount 900000000000
```

The command prints the contract address (`C…`). Paste it into
`FAUCET_CONTRACT_ID` in `src/lib/plunchFaucet.js`.

## Fund the pool

The contract must hold PLUNCH. Send it from the faucet wallet to the contract
address (the issuer must not require asset authorisation):

```sh
stellar contract invoke --id <TOKEN> --source <FAUCET_SECRET_KEY> --network mainnet \
  -- transfer --from <FAUCET_PUBLIC_KEY> --to <CONTRACT_ID> --amount 900000000000
```

## Then

Users connect a wallet that holds a PLUNCH trustline and tap **Request 90,000
PLUNCH**. The contract keeps the 24-hour counter per wallet and refuses a second
claim early. Refill the pool whenever `pool()` runs low.