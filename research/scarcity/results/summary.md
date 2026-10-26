# Scarcity sweep: is learned foraging worth more when food is scarce?

Policy: the single-species benchmark checkpoint (f4c285d5, trained at 40 nodes), frozen. Arms run side by side on identical headless worlds, seeds 11, 12, 13. Food per agent-second and starvation per agent-hour are means across seeds.

| Food nodes | Trained food/s | Random food/s | Greedy food/s | Trained vs random | Trained starved/h | Random starved/h | Greedy starved/h | Trained alignment |
|---|---|---|---|---|---|---|---|---|
| 40 | 1.572 | 1.440 | 1.682 | +9% | 0.0 | 7.1 | 0.0 | +0.16 |
| 20 | 1.615 | 1.329 | 1.734 | +22% | 0.0 | 18.4 | 0.0 | +0.15 |
| 10 | 1.692 | 1.139 | 1.748 | +48% | 0.3 | 30.2 | 1.8 | +0.31 |
| 5 | 1.472 | 0.858 | 1.430 | +72% | 7.5 | 43.6 | 12.5 | +0.55 |
