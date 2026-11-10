# 🚀 PumpLaunch

PumpLaunch is a decentralized, non-custodial token launchpad built on the **Stellar network** and powered by **Soroban Smart Contracts**. It provides a secure, transparent, and automated environment for creators to launch tokens while protecting retail investors from rug-pulls through algorithmically enforced liquidity mechanisms.

Live Website: [pumplaunch.app](https://pumplaunch.app)

---

## ✨ Current Features (Live MVP)

Our platform currently features a bulletproof token launch workflow designed for immediate trust:

*   **100% Liquidity Seeding:** All launched tokens are entirely seeded to the DEX bonding curve to ensure fair distribution from block zero.
*   **100% Auto-Pool Integration:** 100% of XLM collected from token purchases automatically flows directly into the Stellar Liquidity Pool to back and strengthen token liquidity.
*   **Locked Liquidity:** Deposited funds are hard-locked into an un-withdrawable pool. Users can rest assured that the pool creator cannot drain the liquidity.
*   **Customizable Price Curves (Bonding Curves):**
    *   *Slow Curve:* Steady, gradual price growth designed for long-term sustainability (6 rungs, 1.6x step).
    *   *Fast Curve:* Rapid price climb scaling quickly after early purchases (16 rungs, 2.8x step).

---

## 🗺️ Roadmap & Upcoming Milestones

We are actively developing the next evolutionary phase of PumpLaunch to achieve ultimate ecosystem trust:

### 🕒 Milestone 1: Soroban-Enforced Timelocked Vesting (In Progress)
We are currently integrating time-decay unlock functions using Soroban smart contracts. 
*   **The Goal:** Allow token creators to lock team/advisor allocations directly on-chain.
*   **The Mechanism:** Mathematical vesting schedules that release tokens incrementally (e.g., monthly) over fixed periods. 
*   **The Result:** Complete mathematical elimination of team-dump risks, offering institutional-grade confidence to retail investors.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend:** Vite, React, TypeScript, TailwindCSS.
*   **Backend & Automation:** Powered by Base44 environment infrastructure.
*   **Blockchain Integration:** Stellar SDK, Soroban Smart Contracts, Stellar Liquidity Pools.

---

## 🚀 Run Locally

Three commands from the project root:

```bash
base44 login  # one-time per machine
base44 link   # one-time per clone
base44 dev    # local backend + frontend together
``