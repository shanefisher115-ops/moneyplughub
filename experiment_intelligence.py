import json
import random
from datetime import datetime

STATE_FILE = "intelligence_metrics.json"

ENVIRONMENT_VECTORS = {
    'Abundant Food': {'reward_multiplier': 1.5, 'risk_factor': 0.1, 'energy_cost': 0.5},
    'Scarce Food':   {'reward_multiplier': 0.8, 'risk_factor': 0.4, 'energy_cost': 1.2},
    'Competition':   {'reward_multiplier': 1.0, 'risk_factor': 0.7, 'energy_cost': 1.8},
    'Predators':     {'reward_multiplier': 0.2, 'risk_factor': 0.9, 'energy_cost': 2.0}
}

class AdaptiveAgent:
    def __init__(self, agent_id):
        self.agent_id = agent_id
        self.energy = 100.0
        self.fitness = 0.0
        # Policy weights for environmental selection (higher = prefers state)
        self.policy_weights = {k: 1.0 for k in ENVIRONMENT_VECTORS.keys()}

    def choose_environment(self):
        # Softmax-style selection based on learned policy weights
        states = list(self.policy_weights.keys())
        weights = [max(0.1, self.policy_weights[s]) for s in states]
        total = sum(weights)
        probs = [w / total for w in weights]
        return random.choices(states, weights=probs, k=1)[0]

    def update_policy(self, env_name, reward):
        # Reinforcement learning update: reinforce choices that yield positive rewards
        self.policy_weights[env_name] += 0.1 * reward

    def step(self):
        env_name = self.choose_environment()
        env = ENVIRONMENT_VECTORS[env_name]
        
        # Reward calculation
        reward = (10.0 * env['reward_multiplier']) - (env['energy_cost'] * env['risk_factor'] * 2.0)
        
        self.energy = max(0.0, self.energy - env['energy_cost'] + (8.0 if env_name == 'Abundant Food' else 1.0))
        self.fitness += reward
        
        # Adapt
        self.update_policy(env_name, reward)
        
        return env_name, round(reward, 2), round(self.fitness, 2)

if __name__ == "__main__":
    agent = AdaptiveAgent(agent_id='PPO_FORAGING_SUCCESS_f4c285d5')
    print("🧠 [Primordia Intelligence Engine] Initializing 50-Epoch Adaptive Evolution...")
    
    epoch_logs = []
    for epoch in range(1, 51):
        env, reward, cumulative_fitness = agent.step()
        if epoch % 10 == 0 or epoch == 1:
            print(f"📊 [Epoch {epoch:02d}] Chosen: {env:<15} | Reward: {reward:>6} | Total Fitness: {cumulative_fitness:>7} | Weights: { {k: round(v,2) for k,v in agent.policy_weights.items()} }")
        epoch_logs.append({
            'epoch': epoch,
            'environment': env,
            'reward': reward,
            'cumulative_fitness': cumulative_fitness,
            'weights': agent.policy_weights.copy()
        })
        
    with open(STATE_FILE, 'w') as f:
        json.dump(epoch_logs, f, indent=2)
    print("✨ Intelligence metrics successfully logged to intelligence_metrics.json")