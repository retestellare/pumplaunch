#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, token, Address, Env};

/// One drop per wallet per day, enforced on-chain.
pub const COOLDOWN: u64 = 24 * 60 * 60;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FaucetError {
    /// The wallet already claimed within the last 24 hours.
    Cooldown = 1,
    /// The faucet's PLUNCH balance is below one drop.
    Empty = 2,
}

#[contracttype]
pub enum DataKey {
    Token,
    Amount,
    Last(Address),
}

#[contract]
pub struct PlunchFaucet;

#[contractimpl]
impl PlunchFaucet {
    /// token: the PLUNCH Stellar Asset Contract; amount: one drop, in stroops.
    pub fn __constructor(env: Env, token: Address, amount: i128) {
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Amount, &amount);
    }

    /// The wallet authorises its own claim; the contract pays out of its balance.
    pub fn claim(env: Env, user: Address) -> Result<i128, FaucetError> {
        user.require_auth();

        let now = env.ledger().timestamp();
        let key = DataKey::Last(user.clone());
        let last: u64 = env.storage().persistent().get(&key).unwrap_or(0);
        if last != 0 && now < last + COOLDOWN {
            return Err(FaucetError::Cooldown);
        }

        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let plunch = token::TokenClient::new(&env, &token_addr);
        let faucet = env.current_contract_address();

        if plunch.balance(&faucet) < amount {
            return Err(FaucetError::Empty);
        }

        // The counter is written before paying out, so a replayed call cannot
        // take two drops.
        env.storage().persistent().set(&key, &now);
        env.storage().persistent().extend_ttl(&key, COOLDOWN, COOLDOWN);
        plunch.transfer(&faucet, &user, &amount);

        Ok(amount)
    }

    /// Unix time at which this wallet may claim again.
    pub fn next_claim(env: Env, user: Address) -> u64 {
        let last: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::Last(user))
            .unwrap_or(0);
        if last == 0 {
            env.ledger().timestamp()
        } else {
            last + COOLDOWN
        }
    }

    /// One drop, in stroops.
    pub fn amount(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Amount).unwrap()
    }

    /// How many drops are left in the pool.
    pub fn pool(env: Env) -> i128 {
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let plunch = token::TokenClient::new(&env, &token_addr);
        let balance = plunch.balance(&env.current_contract_address());
        if amount > 0 {
            balance / amount
        } else {
            0
        }
    }
}