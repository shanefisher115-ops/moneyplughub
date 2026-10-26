import json
import random

STATE_FILE = "pure_arena_metrics.json"

class PureForager:
    def __init__(self, agent_id, evasion=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        self.evasion_skill = evasion if evasion is not None else random.uniform(0.3, 0.6)

    def clone(self, new_id, mutation_rate):
        # Accelerated positive mutation bias to climb intelligence thresholds rapidly
        new_evasion = max(0.05, min(15.0, self.evasion_skill + random.gauss(0.12, mutation_rate)))
        return PureForager(new_id, evasion=new_evasion)

class PurePredator:
    def __init__(self, agent_id, ambush=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        self.ambush_skill = ambush if ambush is not None else random.uniform(0.3, 0.6)

    def clone(self, new_id, mutation_rate):
        new_ambush = max(0.05, min(15.0, self.ambush_skill + random.gauss(0.12, mutation_rate)))
        return PurePredator(new_id, ambush=new_ambush)

class PureArenaSim:
    def __init__(self, num_foragers=20, num_predators=6, generations=50, steps_per_gen=10):
        self.foragers = [PureForager(f"F_{i+1:02d}") for i in range(num_foragers)]
        self.predators = [PurePredator(f"P_{i+1:02d}") for i in range(num_predators)]
        self.generations = generations
        self.steps_per_gen = steps_per_gen
        self.history = []

    def run(self):
        print(f"⚔️ [Primordia Pure Arena] Initializing High-Velocity Arena ({self.generations} Gens)...")

        for gen in range(1, self.generations + 1):
            for f in self.foragers: f.fitness = 0.0
            for p in self.predators: p.fitness = 0.0

            for step in range(self.steps_per_gen):
                for p in self.predators:
                    hunt_targets = random.sample(self.foragers, min(5, len(self.foragers)))
                    for f in hunt_targets:
                        if p.ambush_skill > f.evasion_skill:
                            p.fitness += 12.0
                            f.fitness -= 10.0
                        else:
                            p.fitness -= 4.0
                            f.fitness += 10.0

            # Selection & Reproduction
            self.foragers.sort(key=lambda x: x.fitness, reverse=True)
            self.predators.sort(key=lambda x: x.fitness, reverse=True)

            f_survivors = self.foragers[:int(len(self.foragers) * 0.7)]
            p_survivors = self.predators[:int(len(self.predators) * 0.7)]

            new_foragers = list(f_survivors)
            while len(new_foragers) < len(self.foragers):
                parent = random.choice(f_survivors)
                new_foragers.append(parent.clone(f"F_Gen{gen}_{random.randint(100,999)}", 0.25))
            self.foragers = new_foragers

            new_predators = list(p_survivors)
            while len(new_predators) < len(self.predators):
                parent = random.choice(p_survivors)
                new_predators.append(parent.clone(f"P_Gen{gen}_{random.randint(100,999)}", 0.25))
            self.predators = new_predators

            avg_f_fit = sum(f.fitness for f in self.foragers) / len(self.foragers)
            avg_p_fit = sum(p.fitness for p in self.predators) / len(self.predators)
            avg_evasion = sum(f.evasion_skill for f in self.foragers) / len(self.foragers)
            avg_ambush = sum(p.ambush_skill for p in self.predators) / len(self.predators)

            if gen % 5 == 0 or gen == self.generations:
                print(f"🏟️ [Gen {gen:02d}] Forager Evasion: {avg_evasion:.2f} (Fit: {avg_f_fit:.1f}) | Predator Ambush: {avg_ambush:.2f} (Fit: {avg_p_fit:.1f})")

            self.history.append({
                'generation': gen,
                'forager_avg_evasion': round(avg_evasion, 2),
                'predator_avg_ambush': round(avg_ambush, 2),
                'forager_avg_fitness': round(avg_f_fit, 2),
                'predator_avg_fitness': round(avg_p_fit, 2)
            })

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Accelerated arena metrics successfully logged to pure_arena_metrics.json")

if __name__ == "__main__":
    sim = PureArenaSim()
    sim.run()