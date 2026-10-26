import json
import random

STATE_FILE = "adaptive_mutation_metrics.json"

NORMAL_VECTORS = {
    'Abundant Food': {'base_reward': 15.0, 'capacity': 4, 'risk_factor': 0.1, 'energy_cost': 0.5},
    'Scarce Food':   {'base_reward': 8.0, 'capacity': 10, 'risk_factor': 0.4, 'energy_cost': 1.2},
    'Competition':   {'base_reward': 12.0, 'capacity': 3, 'risk_factor': 0.7, 'energy_cost': 1.8},
    'Predators':     {'base_reward': 2.0, 'capacity': 10, 'risk_factor': 0.9, 'energy_cost': 2.0}
}

CATASTROPHE_VECTORS = {
    'Abundant Food': {'base_reward': 1.0, 'capacity': 0, 'risk_factor': 0.9, 'energy_cost': 2.5},
    'Scarce Food':   {'base_reward': 6.0, 'capacity': 12, 'risk_factor': 0.5, 'energy_cost': 1.4},
    'Competition':   {'base_reward': 10.0, 'capacity': 2, 'risk_factor': 0.8, 'energy_cost': 2.0},
    'Predators':     {'base_reward': 0.5, 'capacity': 5, 'risk_factor': 0.95, 'energy_cost': 2.5}
}

class AdaptiveAgent:
    def __init__(self, agent_id, policy_weights=None):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0
        if policy_weights:
            self.policy_weights = policy_weights.copy()
        else:
            self.policy_weights = {k: random.uniform(0.5, 1.5) for k in NORMAL_VECTORS.keys()}

    def choose_environment(self):
        states = list(self.policy_weights.keys())
        weights = [max(0.1, self.policy_weights[s]) for s in states]
        total = sum(weights)
        probs = [w / total for w in weights]
        return random.choices(states, weights=probs, k=1)[0]

    def clone(self, new_id, mutation_intensity):
        mutated_weights = {}
        for k, v in self.policy_weights.items():
            # Mutation probability and magnitude scale dynamically with systemic stress
            mutation = random.gauss(0, mutation_intensity) if random.random() < 0.6 else 0.0
            mutated_weights[k] = max(0.1, v + mutation)
        return AdaptiveAgent(new_id, policy_weights=mutated_weights)

class AdaptiveEvolutionSim:
    def __init__(self, population_size=12, generations=25, steps_per_gen=10):
        self.pop_size = population_size
        self.generations = generations
        self.steps_per_gen = steps_per_gen
        self.population = [AdaptiveAgent(f"Gen0_Agent_{i+1:02d}") for i in range(population_size)]
        self.history = []

    def run(self):
        print(f"🧬 [Primordia Adaptive Mutation Engine] Initializing {self.generations} Generations (Catastrophe at Gen 10)...")

        agent_counter = self.pop_size
        previous_avg_fitness = 100.0

        for gen in range(1, self.generations + 1):
            active_vectors = CATASTROPHE_VECTORS if gen >= 10 else NORMAL_VECTORS
            
            # Dynamic Mutation Pressure: Scale intensity up if average fitness drops or catastrophe hits
            if gen >= 10:
                mutation_intensity = 0.6  # High volatility during catastrophe
                status_label = "🚨 [CATASTROPHE + HIGH MUTATION]"
            elif gen > 1 and previous_avg_fitness < 75.0:
                mutation_intensity = 0.4  # Moderate boost if stagnation detected
                status_label = "⚡ [STAGNATION + BOOSTED MUTATION]"
            else:
                mutation_intensity = 0.15 # Fine-tuning during stable phases
                status_label = "🟢 [STABLE + LOW MUTATION]"

            for agent in self.population:
                agent.energy = 100.0
                agent.fitness = 0.0

            for step in range(self.steps_per_gen):
                choices = {}
                for agent in self.population:
                    env = agent.choose_environment()
                    choices.setdefault(env, []).append(agent)

                for env_name, congregants in choices.items():
                    config = active_vectors[env_name]
                    congestion = max(0, len(congregants) - config['capacity']) * 1.5
                    reward = (config['base_reward'] - congestion) - (config['energy_cost'] * config['risk_factor'])

                    for agent in congregants:
                        agent.energy = max(0.0, agent.energy - config['energy_cost'] + (4.0 if gen < 10 and env_name == 'Abundant Food' else 0.5))
                        agent.fitness += reward

            self.population.sort(key=lambda x: x.fitness, reverse=True)
            best_agent = self.population[0]
            avg_fitness = sum(a.fitness for a in self.population) / len(self.population)

            print(f"{status_label} [Gen {gen:02d}] MutInt: {mutation_intensity:.2f} | Top Fit: {best_agent.fitness:>5.1f} | Avg Fit: {avg_fitness:>5.1f}")

            self.history.append({
                'generation': gen,
                'mutation_intensity': mutation_intensity,
                'best_fitness': round(best_agent.fitness, 2),
                'avg_fitness': round(avg_fitness, 2),
                'best_weights': best_agent.policy_weights.copy()
            })

            previous_avg_fitness = avg_fitness

            # Selection & Pruning
            cull_index = int(self.pop_size * 0.7)
            survivors = self.population[:cull_index]

            new_population = list(survivors)
            while len(new_population) < self.pop_size:
                parent = random.choice(survivors)
                agent_counter += 1
                child = parent.clone(f"Gen{gen}_Agent_{agent_counter:02d}", mutation_intensity)
                new_population.append(child)

            self.population = new_population

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Adaptive mutation metrics successfully logged to adaptive_mutation_metrics.json")

if __name__ == "__main__":
    sim = AdaptiveEvolutionSim()
    sim.run()