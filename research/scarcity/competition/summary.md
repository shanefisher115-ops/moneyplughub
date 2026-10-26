# Head-to-Head Competitive Exclusion: Scarcity Arena (5 Food Nodes)

**Experiment:** Zero-sum shared arena competition between policy arms.
**World:** 5 Food Nodes, 32 total foragers (16 per arm), 30m radius arena, zero immigration (`respawn_below: 0`).
**Biology:** Identical `LumenSeed` root rules (60 HP, 100 max energy, 0.4/s base drain, 0.1/m move cost).

---

## 1. Trained (Frozen PPO) vs Random Baseline

| Seed | Extinction Time | Winner | Final Pop (Trained vs Random) | Food Eaten at Extinction | Starvations (Trained vs Random) | Mean Alignment |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **11** | 13.9s | **Trained** | 6 vs 0 | 784.9 vs 162.6 (**4.8x**) | 2 vs 6 | +0.52 vs -0.01 |
| **12** | 11.9s | **Trained** | 9 vs 0 | 791.8 vs 106.4 (**7.4x**) | 0 vs 7 | +0.54 vs -0.02 |
| **13** | 14.3s | **Trained** | 3 vs 0 | 772.8 vs 225.1 (**3.4x**) | 0 vs 3 | +0.53 vs +0.01 |
| **Mean** | **13.4s** | **Trained (3/3)** | **6.0 vs 0.0** | **783.2 vs 164.7 (4.8x lead)** | **0.7 vs 5.3** | **+0.53 vs -0.01** |

* **Result:** **100% Competitive Exclusion.** In every seed, the random policy is driven to complete extinction within ~13 seconds. The trained policy captures 83% of all available food in the arena.

---

## 2. Trained (Frozen PPO) vs Greedy Hand-Written Forager

| Seed | Extinction Time | Winner | Final Pop (Trained vs Greedy) | Food Eaten at Extinction | Starvations (Trained vs Greedy) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **11** | 11.8s | **Greedy** | 0 vs 9 | 128.4 vs 744.6 | 12 vs 0 |
| **12** | 24.0s | **Greedy** | 0 vs 2 | 155.3 vs 461.4 | 15 vs 13 |
| **13** | 10.8s | **Greedy** | 0 vs 15 | 72.4 vs 792.6 | 13 vs 0 |
| **Mean** | **15.5s** | **Greedy (3/3)** | **0.0 vs 8.7** | **118.7 vs 666.2** | **13.3 vs 4.3** |

### Key Theoretical Insight:
* **In Isolation:** Trained matches greedy on food intake (+3%) and starves less (7.5 vs 12.5/h) because greedy's myopic pursuit causes self-interference when multiple greedy agents chase the same nodes.
* **In Zero-Sum Head-to-Head Sprint:** Greedy commands maximum saturated velocity ($1.0$) with zero reaction delay directly along the Euclidean nearest-food vector. In the first 10-second dash to 5 sparse nodes, greedy reaches the nearest node milliseconds before the continuous stochastic neural policy ($|\mu| \approx 0.7-0.8$). Under severe scarcity with zero immigration, losing the first node sprint triggers immediate starvation.
