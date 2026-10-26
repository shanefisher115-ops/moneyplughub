import json
import os
from datetime import datetime

STATE_FILE = "twin_state.json"

ENVIRONMENT_VECTORS = {
    'Abundant Food': {'reward_multiplier': 1.5, 'risk_factor': 0.1, 'energy_cost': 0.5},
    'Scarce Food':   {'reward_multiplier': 0.8, 'risk_factor': 0.4, 'energy_cost': 1.2},
    'Competition':   {'reward_multiplier': 1.0, 'risk_factor': 0.7, 'energy_cost': 1.8},
    'Predators':     {'reward_multiplier': 0.2, 'risk_factor': 0.9, 'energy_cost': 2.0}
}

class DigitalTwinAgent:
    def __init__(self, agent_id):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0

    def step(self, env_name):
        env = ENVIRONMENT_VECTORS[env_name]
        reward = (10.0 * env['reward_multiplier']) - (env['energy_cost'] * 2.0)
        self.energy = max(0.0, self.energy - env['energy_cost'] + (5.0 if env_name == 'Abundant Food' else 0.0))
        self.fitness += max(0.0, reward)
        
        telemetry = {
            'timestamp': datetime.utcnow().isoformat(),
            'agent_id': self.agent_id,
            'environment': env_name,
            'energy': round(self.energy, 2),
            'fitness': round(self.fitness, 2),
            'risk_level': env['risk_factor']
        }
        
        self.save_telemetry(telemetry)
        return telemetry

    def save_telemetry(self, data):
        history = []
        if os.path.exists(STATE_FILE):
            with open(STATE_FILE, 'r') as f:
                try:
                    history = json.load(f)
                except json.JSONDecodeError:
                    history = []
        history.append(data)
        with open(STATE_FILE, 'w') as f:
            json.dump(history, f, indent=2)

if __name__ == "__main__":
    twin = DigitalTwinAgent(agent_id='PPO_FORAGING_SUCCESS_f4c285d5')
    for state in ['Abundant Food', 'Scarce Food', 'Competition', 'Predators']:
        t = twin.step(state)
        print(f"🌌 [Persistent Twin] Recorded -> Energy: {t['energy']} | Fitness: {t['fitness']}")