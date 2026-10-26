import json
import random

STATE_FILE = "coevolution_metrics.json"

ENVIRONMENTS = ['Abundant Food', 'Scarce Food', 'Competition']

class ForagerAgent:
    def __init__(self, agent_id, weights=None):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        return ForagerAgent(new_id, weights=new_weights)

class PredatorAgent:
    def __init__(self, agent_id, weights=None):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        return PredatorAgent(new_id, weights=new_weights)

class CoEvolutionSim:
    def __init__(self, num_foragers=15, num_predators=5, generations=20, steps_per_gen=10):
        self.foragers = [ForagerAgent(f"Forager_{i+1:02d}") for i in range(num_foragers)]
        self.predators = [PredatorAgent(f"Predator_{i+1:02d}") for i in range(num_predators)]
        self.generations = generations
        self.steps_per_gen = steps_per_gen
        self.history = []

    def run(self):
        print(f"🐺 [Primordia Co-Evolution Engine] Initializing Arms Race: {len(self.foragers)} Foragers vs {len(self.predators)} Predators...")

        for gen in range(1, self.generations + 1):
            for f in self.foragers: f.energy, f.fitness = 100.0, 0.0
            for p in self.predators: p.energy, p.fitness = 100.0, 0.0

            for step in range(self.steps_per_gen):
                f_choices = {}
                p_choices = {}

                for f in self.foragers:
                    env = f.choose_environment()
                    f_choices.setdefault(env, []).append(f)

                for p in self.predators:
                    env = p.choose_environment()
                    p_choices.setdefault(env, []).append(p)

                for env in ENVIRONMENTS:
                    present_foragers = f_choices.get(env, [])
                    present_predators = p_choices.get(env, [])

                    for f in present_foragers:
                        reward = 12.0 if env == 'Abundant Food' else (8.0 if env == 'Scarce Food' else 10.0)
                        if present_predators:
                            reward -= 15.0  # Risk of predation penalty
                        f.fitness += reward

                    for p in present_predators:
                        if present_foragers:
                            hunt_reward = len(present_foragers) * 8.0
                            p.fitness += hunt_reward
                        else:
                            p.fitness -= 5.0  # Starvation penalty for empty zone

            self.foragers.sort(key=lambda x: x.fitness, reverse=True)
            f_survivors = self.foragers[:int(len(self.foragers) * 0.7)]
            while len(self.foragers) < 15:
                parent = random.choice(f_survivors)
                self.foragers.append(parent.clone(f"F_Gen{gen}_{random.randint(100,999)}", 0.3))

            self.predators.sort(key=lambda x: x.fitness, reverse=True)
            p_survivors = self.predators[:int(len(self.predators) * 0.7)]
            while len(self.predators) < 5:
                parent = random.choice(p_survivors)
                self.predators.append(parent.clone(f"P_Gen{gen}_{random.randint(100,999)}", 0.3))

            avg_f_fit = sum(f.fitness for f in self.foragers) / len(self.foragers)
            avg_p_fit = sum(p.fitness for p in self.predators) / len(self.predators)

            print(f"⚔️ [Gen {gen:02d}] Forager Avg Fit: {avg_f_fit:>6.1f} | Predator Avg Fit: {avg_p_fit:>6.1f}")

            self.history.append({
                'generation': gen,
                'forager_avg_fitness': round(avg_f_fit, 2),
                'predator_avg_fitness': round(avg_p_fit, 2)
            })

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Co-evolution metrics successfully logged to coevolution_metrics.json")

if __name__ == "__main__":
    sim = CoEvolutionSim()
    sim.run()