import json
import random

STATE_FILE = "skill_driven_metrics.json"

ENVIRONMENTS = ['Abundant Food', 'Scarce Food', 'Competition']

class ForagerAgent:
    def __init__(self, agent_id, weights=None, evasion=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}
        self.evasion_skill = evasion if evasion is not None else random.uniform(0.1, 0.3)

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        # Aggressive skill mutation pressure
        new_evasion = max(0.05, min(2.5, self.evasion_skill + random.gauss(0, mutation_rate * 1.5)))
        child = ForagerAgent(new_id, weights=new_weights, evasion=new_evasion)
        return child

class PredatorAgent:
    def __init__(self, agent_id, weights=None, ambush=None):
        self.agent_id = agent_id
        self.fitness = 0.0
        self.weights = weights.copy() if weights else {e: random.uniform(0.5, 1.5) for e in ENVIRONMENTS}
        self.ambush_skill = ambush if ambush is not None else random.uniform(0.1, 0.3)

    def choose_environment(self):
        scores = [max(0.1, self.weights[e]) for e in ENVIRONMENTS]
        total = sum(scores)
        probs = [s / total for s in scores]
        return random.choices(ENVIRONMENTS, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_rate):
        new_weights = {e: max(0.1, v + (random.gauss(0, mutation_rate) if random.random() < 0.5 else 0.0)) for e, v in self.weights.items()}
        # Aggressive skill mutation pressure
        new_ambush = max(0.05, min(2.5, self.ambush_skill + random.gauss(0, mutation_rate * 1.5)))
        child = PredatorAgent(new_id, weights=new_weights, ambush=new_ambush)
        return child

class SkillDrivenSim:
    def __init__(self, num_foragers=20, num_predators=6, generations=25, steps_per_gen=10):
        self.foragers = [ForagerAgent(f"Forager_{i+1:02d}") for i in range(num_foragers)]
        self.predators = [PredatorAgent(f"Predator_{i+1:02d}") for i in range(num_predators)]
        self.generations = generations
        self.steps_per_gen = steps_per_gen
        self.history = []

    def run(self):
        print(f"🧬 [Primordia Skill-Driven Engine] Initializing Skill-Core Arms Race across {self.generations} Generations...")

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

                    # Base resource collection
                    for f in present_foragers:
                        f.fitness += 10.0

                    # Direct Skill Combat Resolution
                    if present_foragers and present_predators:
                        for p in present_predators:
                            successful_hunts = 0
                            for f in present_foragers:
                                # Skill contest: Ambush vs Evasion
                                if p.ambush_skill > f.evasion_skill:
                                    successful_hunts += 1
                                    f.fitness -= 15.0  # Heavy penalty for failed evasion
                                else:
                                    f.fitness += 10.0  # Reward for successful evasion
                            
                            p.fitness += (successful_hunts * 20.0)  # High reward for successful ambush
                            if successful_hunts == 0:
                                p.fitness -= 10.0  # Penalty if all foragers evaded successfully
                    elif present_predators:
                        for p in present_predators:
                            p.fitness -= 8.0  # Starvation penalty for empty hunting grounds

            # Selection & Reproduction with high mutation pressure
            self.foragers.sort(key=lambda x: x.fitness, reverse=True)
            f_survivors = self.foragers[:int(len(self.foragers) * 0.7)]
            while len(self.foragers) < 20:
                parent = random.choice(f_survivors)
                self.foragers.append(parent.clone(f"F_Gen{gen}_{random.randint(100,999)}", 0.4))

            self.predators.sort(key=lambda x: x.fitness, reverse=True)
            p_survivors = self.predators[:int(len(self.predators) * 0.7)]
            while len(self.predators) < 6:
                parent = random.choice(p_survivors)
                self.predators.append(parent.clone(f"P_Gen{gen}_{random.randint(100,999)}", 0.4))

            avg_f_fit = sum(f.fitness for f in self.foragers) / len(self.foragers)
            avg_p_fit = sum(p.fitness for p in self.predators) / len(self.predators)
            avg_evasion = sum(f.evasion_skill for f in self.foragers) / len(self.foragers)
            avg_ambush = sum(p.ambush_skill for p in self.predators) / len(self.predators)

            print(f"⚔️ [Gen {gen:02d}] Forager Evasion: {avg_evasion:.2f} (Fit: {avg_f_fit:.1f}) | Predator Ambush: {avg_ambush:.2f} (Fit: {avg_p_fit:.1f})")

            self.history.append({
                'generation': gen,
                'forager_avg_evasion': round(avg_evasion, 2),
                'predator_avg_ambush': round(avg_ambush, 2),
                'forager_avg_fitness': round(avg_f_fit, 2),
                'predator_avg_fitness': round(avg_p_fit, 2)
            })

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Skill-driven metrics successfully logged to skill_driven_metrics.json")

if __name__ == "__main__":
    sim = SkillDrivenSim()
    sim.run()