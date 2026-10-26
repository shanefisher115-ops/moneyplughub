import json
import random

STATE_FILE = "coevolution_balanced_metrics.json"

ENVIRONMENTS = ['Abundant Food', 'Scarce Food', 'Competition']

class ForagerAgent:
    def __init__(self, agent_id, weights=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        # Foragers can evolve evasion preference (higher = better at dodging predators)
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}
        self.evasion_skill = random.uniform(0.1, 0.5)

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        new_evasion = max(0.05, min(0.95, self.evasion_skill + random.gauss(0, mutation_rate * 0.5)))
        child = ForagerAgent(new_id, weights=new_weights)
        child.evasion_skill = new_evasion
        return child

class PredatorAgent:
    def __init__(self, agent_id, weights=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}
        self.ambush_skill = random.uniform(0.1, 0.5)

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        new_ambush = max(0.05, min(0.95, self.ambush_skill + random.gauss(0, mutation_rate * 0.5)))
        child = PredatorAgent(new_id, weights=new_weights)
        child.ambush_skill = new_ambush
        return child

class BalancedCoEvolutionSim:
    def __init__(self, num_foragers=20, num_predators=6, generations=20, steps_per_gen=10):
        self.foragers = [ForagerAgent(f"Forager_{i+1:02d}") for i in range(num_foragers)]
        self.predators = [PredatorAgent(f"Predator_{i+1:02d}") for i in range(num_predators)]
        self.generations = generations
        self.steps_per_gen = steps_per_gen
        self.history = []

    def run(self):
        print(f"⚖️ [Primordia Balanced Arms Race] Initializing {len(self.foragers)} Foragers vs {len(self.predators)} Predators with Evasion Mechanics...")

        for gen in range(1, self.generations + 1):
            for f in self.foragers: f.fitness = 0.0
            for p in self.predators: p.fitness = 0.0

            for step in range(self.steps_per_gen):
                f_choices, p_choices = {}, {}

                for f in self.foragers:
                    f_choices.setdefault(f.choose_environment(), []).append(f)
                for p in self.predators:
                    p_choices.setdefault(p.choose_environment(), []).append(p)

                for env in ENVIRONMENTS:
                    present_foragers = f_choices.get(env, [])
                    present_predators = p_choices.get(env, [])

                    # Base resource gain for foragers
                    for f in present_foragers:
                        f.fitness += 10.0

                    # Predator-prey encounters with evasion check
                    if present_foragers and present_predators:
                        for p in present_predators:
                            successful_hunts = 0
                            for f in present_foragers:
                                # Evasion contest: Predator ambush vs Forager evasion
                                if p.ambush_skill > f.evasion_skill:
                                    successful_hunts += 1
                                    f.fitness -= 4.0  # Reduced penalty so foragers don't instantly crash
                                else:
                                    f.fitness += 2.0  # Successful escape bonus
                            p.fitness += (successful_hunts * 5.0)
                    elif present_predators:
                        # Starvation penalty if zone has no prey
                        for p in present_predators:
                            p.fitness -= 3.0

            # Selection & Reproduction
            self.foragers.sort(key=lambda x: x.fitness, reverse=True)
            f_survivors = self.foragers[:int(len(self.foragers) * 0.7)]
            while len(self.foragers) < 20:
                parent = random.choice(f_survivors)
                self.foragers.append(parent.clone(f"F_Gen{gen}_{random.randint(100,999)}", 0.25))

            self.predators.sort(key=lambda x: x.fitness, reverse=True)
            p_survivors = self.predators[:int(len(self.predators) * 0.7)]
            while len(self.predators) < 6:
                parent = random.choice(p_survivors)
                self.predators.append(parent.clone(f"P_Gen{gen}_{random.randint(100,999)}", 0.25))

            avg_f_fit = sum(f.fitness for f in self.foragers) / len(self.foragers)
            avg_p_fit = sum(p.fitness for p in self.predators) / len(self.predators)
            avg_evasion = sum(f.evasion_skill for f in self.foragers) / len(self.foragers)
            avg_ambush = sum(p.ambush_skill for p in self.predators) / len(self.predators)

            print(f"⚔️ [Gen {gen:02d}] Forager Fit: {avg_f_fit:>5.1f} (Evasion: {avg_evasion:.2f}) | Predator Fit: {avg_p_fit:>5.1f} (Ambush: {avg_ambush:.2f})")

            self.history.append({
                'generation': gen,
                'forager_avg_fitness': round(avg_f_fit, 2),
                'predator_avg_fitness': round(avg_p_fit, 2),
                'forager_avg_evasion': round(avg_evasion, 2),
                'predator_avg_ambush': round(avg_ambush, 2)
            })

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Balanced co-evolution metrics successfully logged to coevolution_balanced_metrics.json")

if __name__ == "__main__":
    sim = BalancedCoEvolutionSim()
    sim.run()