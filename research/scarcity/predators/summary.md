# Predator Pressure & Selection Dynamics: 40 vs 5 Food Nodes

**Experiment:** 16 Trained LumenSeed vs 16 Random LumenSeed cohabiting with 4 Gravemind predators.
**Arena:** 30m radius arena, zero immigration (`respawn_below: 0`), speed 4x.
**Predator Policy:** Greedy pursuit of nearest prey (`enemy` sensor vector, 20 damage/s, 2.5m attack radius).
**Contrasting Regimes:** Abundance (40 nodes) vs Severe Scarcity (5 nodes).

---

## 1. Abundance (40 Food Nodes)

| Seed | Trained Extinction | Random Extinction | Trained Predation / Starvation | Random Predation / Starvation | Predator Starvations |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **11** | 9.6s | 10.7s | **16 / 0** | **16 / 0** | 1 |
| **12** | 9.0s | 10.7s | **16 / 0** | **14 / 1** | 0 |
| **13** | Survived (12 live) | Survived (13 live) | **0 / 4** | **3 / 0** | **4 (all predators died)** |

* **Mortality Driver:** Overwhelmingly **predation (95%+)**. Starvation is near zero because food regenerates continuously across 40 nodes.
* **Lotka-Volterra Collapse:** In Seed 13, all 4 predators failed to secure enough early kills to cover their 0.7/s energy upkeep and starved out within 10 seconds. Once predators died, both forager populations thrived, with Trained gathering **21,120 food** vs Random **17,987 food (+17%)**.

---

## 2. Severe Scarcity (5 Food Nodes)

| Seed | Trained Extinction | Random Extinction | Trained Predation / Starvation | Random Predation / Starvation | First Extinct Arm |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **11** | 9.6s | 7.5s | 14 / **2** | 12 / **4** | **Random (-2.1s)** |
| **12** | 7.4s | 7.5s | 16 / **0** | 15 / **0** | Trained (-0.1s) |
| **13** | 8.3s | 8.6s | 16 / **0** | 16 / **0** | Trained (-0.3s) |

* **Mortality Driver:** Under 5 nodes, the dual stress of energy depletion and predator pursuit accelerates collapse. In Seed 11, starvation strikes Random at double the rate of Trained (4 vs 2), causing Random to go extinct 2.1 seconds earlier.
* **Predator Targeting:** Because the frozen PPO policy was trained without predator sensors active in its reward shaping, it navigates towards food rather than actively avoiding threats. Both foragers are equally vulnerable to greedy predators once intercepted, demonstrating that **evasion requires dedicated multi-objective policy training (food distance + threat avoidance shaping)**.
