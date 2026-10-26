import json
import os
import random

STATE_FILE = "hyper_arena_metrics.json"

class HyperAgent:
    def __init__(self, agent_id, role, potency=None):
        self.agent_id = agent_id
        self.role = role  # 'Architect', 'Sentinel', 'Mutator'
        self.fitness = 0.0
        self.potency = potency if potency is not None else random.uniform(4.0, 8.0)

    def clone(self, new_id, mutation_pressure):
        # Accelerated directional mutation scaling
        delta = random.gauss(0.4, mutation_pressure)
        new_potency = max(1.0, min(50.0, self.potency + delta))
        return HyperAgent(new_id, self.role, potency=new_potency)

class HyperArenaMesh:
    def __init__(self, generations=60, population_size=45):
        self.generations = generations
        
        # Load previous high-water mark if available to maintain baseline momentum
        base_potency = 8.0
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, 'r') as f:
                    history = json.load(f)
                    if history:
                        last_entry = history[-1]
                        base_potency = max(8.0, last_entry.get('apex_index', 8.0) * 0.7)
            except Exception:
                pass

        self.architects = [HyperAgent(f"ARC_{i+1:02d}", "Architect", potency=random.uniform(base_potency*0.8, base_potency)) for i in range(population_size // 3)]
        self.sentinels = [HyperAgent(f"SEN_{i+1:02d}", "Sentinel", potency=random.uniform(base_potency, base_potency*1.2)) for i in range(population_size // 3)]
        self.mutators = [HyperAgent(f"MUT_{i+1:02d}", "Mutator", potency=random.uniform(base_potency*0.9, base_potency*1.1)) for i in range(population_size // 3)]
        self.history = []

    def run(self):
        print(f"🌌 [Primordia Hyper-Mesh] Initializing Accelerated Triad Matrix ({self.generations} Generations)...")

        for gen in range(1, self.generations + 1):
            for a in self.architects: a.fitness = 0.0
            for s in self.sentinels: s.fitness = 0.0
            for m in self.mutators: m.fitness = 0.0

            # Triad Co-Evolutionary Pressure Matrix
            for _ in range(20):
                arc = random.choice(self.architects)
                sen = random.choice(self.sentinels)
                mut = random.choice(self.mutators)

                synergy = (arc.potency * 1.3) + (mut.potency * 0.9)
                if synergy > sen.potency:
                    arc.fitness += 18.0
                    mut.fitness += 12.0
                    sen.fitness -= 6.0
                else:
                    sen.fitness += 20.0
                    arc.fitness -= 4.0
                    mut.fitness -= 4.0

            # Rank and Cull (Elitism preserved)
            for group in [self.architects, self.sentinels, self.mutators]:
                group.sort(key=lambda x: x.fitness, reverse=True)
                survivors = group[:int(len(group) * 0.6)]
                
                new_group = list(survivors)
                while len(new_group) < len(group):
                    parent = random.choice(survivors)
                    new_group.append(parent.clone(f"{parent.role[:3]}_Gen{gen}_{random.randint(1000,9999)}", 0.3))
                group[:] = new_group

            # Compute Apex Metrics
            avg_arc = sum(a.potency for a in self.architects) / len(self.architects)
            avg_sen = sum(s.potency for s in self.sentinels) / len(self.sentinels)
            avg_mut = sum(m.potency for m in self.mutators) / len(self.mutators)
            apex_index = round(max(avg_arc, avg_sen, avg_mut), 2)

            if gen % 15 == 0 or gen == self.generations:
                print(f"✨ [Gen {gen:03d}] Apex Index: {apex_index} | Architect: {avg_arc:.2f} | Sentinel: {avg_sen:.2f} | Mutator: {avg_mut:.2f}")

            self.history.append({
                'generation': gen,
                'apex_index': apex_index,
                'architect_potency': round(avg_arc, 2),
                'sentinel_potency': round(avg_sen, 2),
                'mutator_potency': round(avg_mut, 2)
            })

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("⚡ Accelerated hyper-mesh telemetry locked to hyper_arena_metrics.json")

if __name__ == "__main__":
    mesh = HyperArenaMesh()
    mesh.run()