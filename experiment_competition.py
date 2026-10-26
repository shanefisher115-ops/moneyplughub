import json
import random
from datetime import datetime

STATE_FILE = "multi_agent_metrics.json"

ENVIRONMENT_VECTORS = {
    'Abundant Food': {'base_reward': 15.0, 'capacity': 3, 'risk_factor': 0.1, 'energy_cost': 0.5},
    'Scarce Food':   {'base_reward': 8.0, 'capacity': 10, 'risk_factor': 0.4, 'energy_cost': 1.2},
    'Competition':   {'base_reward': 12.0, 'capacity': 2, 'risk_factor': 0.7, 'energy_cost': 1.8},
    'Predators':     {'base_reward': 2.0, 'capacity': 10, 'risk_factor': 0.9, 'energy_cost': 2.0}
}

class CompetitiveAgent:
    def __init__(self, agent_id):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0
        self.policy_weights = {k: random.uniform(0.8, 1.2) for k in ENVIRONMENT_VECTORS.keys()}

    def choose_environment(self):
        states = list(self.policy_weights.keys())
        weights = [max(0.1, self.policy_weights[s]) for s in states]
        total = sum(weights)
        probs = [w / total for w in weights]
        return random.choices(states, weights=probs, k=1)[0]

    def update_policy(self, env_name, reward):
        self.policy_weights[env_name] += 0.15 * reward

class EcosystemSimulation:
    def __init__(self, num_agents=10, epochs=40):
        self.agents = [CompetitiveAgent(f"Agent_{i+1:02d}") for i in range(num_agents)]
        self.epochs = epochs
        self.history = []

    def run(self):
        print(f"🌍 [Primordia Ecosystem] Initializing Multi-Agent Simulation with {len(self.agents)} organisms across {self.epochs} epochs...")
        
        for epoch in range(1, self.epochs + 1):
            choices = {}
            for agent in self.agents:
                env = agent.choose_environment()
                if env not in choices:
                    choices[env] = []
                choices[env].append(agent)

            epoch_summary = {'epoch': epoch, 'state_distribution': {}, 'agent_telemetry': []}

            for env_name, congregants in choices.items():
                env_config = ENVIRONMENT_VECTORS[env_name]
                capacity = env_config['capacity']
                
                epoch_summary['state_distribution'][env_name] = len(congregants)

                for agent in congregants:
                    # Congestion penalty when population exceeds carrying capacity
                    congestion_penalty = max(0, len(congregants) - capacity) * 1.5
                    reward = (env_config['base_reward'] - congestion_penalty) - (env_config['energy_cost'] * env_config['risk_factor'])
                    
                    agent.energy = max(0.0, agent.energy - env_config['energy_cost'] + (6.0 if env_name == 'Abundant Food' else 1.0))
                    agent.fitness += reward
                    agent.update_policy(env_name, reward)

                    epoch_summary['agent_telemetry'].append({
                        'agent_id': agent.agent_id,
                        'choice': env_name,
                        'reward': round(reward, 2),
                        'fitness': round(agent.fitness, 2),
                        'energy': round(agent.energy, 2)
                    })

            self.history.append(epoch_summary)

            if epoch % 10 == 0 or epoch == 1:
                print(f"📊 [Epoch {epoch:02d}] Distribution -> {epoch_summary['state_distribution']}")

        with open(STATE_FILE, 'w') as f:
            json.dump(self.history, f, indent=2)
        print("✨ Multi-agent competition metrics successfully saved to multi_agent_metrics.json")

if __name__ == "__main__":
    sim = EcosystemSimulation(num_agents=10, epochs=40)
    sim.run()