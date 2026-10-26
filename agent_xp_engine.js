const fs = require('fs');
const path = require('path');

const XP_FILE = path.join(__dirname, 'primordia_agent_xp.json');

class AgentXPEngine {
    constructor() {
        this.ensureStore();
    }

    ensureStore() {
        if (!fs.existsSync(XP_FILE)) {
            fs.writeFileSync(XP_FILE, JSON.stringify({ agents: {} }, null, 2));
        }
    }

    readStore() {
        try {
            return JSON.parse(fs.readFileSync(XP_FILE, 'utf8'));
        } catch (e) {
            return { agents: {} };
        }
    }

    writeStore(data) {
        fs.writeFileSync(XP_FILE, JSON.stringify(data, null, 2));
    }

    awardXP(sigil, taskAction) {
        if (!sigil) return null;

        const store = this.readStore();
        if (!store.agents[sigil]) {
            store.agents[sigil] = { xp: 0, level: 1, tasksCompleted: 0, unlockedTier: 'Basic' };
        }

        let xpGain = 50;
        if (taskAction === 'WRITE_FILE') xpGain = 75;
        if (taskAction === 'DEPLOY_MICROSERVICE') xpGain = 200;

        const agent = store.agents[sigil];
        agent.xp += xpGain;
        agent.tasksCompleted += 1;
        agent.level = Math.floor(agent.xp / 250) + 1;

        if (agent.level >= 5) agent.unlockedTier = 'Master Harmonizer';
        else if (agent.level >= 3) agent.unlockedTier = 'Autonomous Worker';
        else agent.unlockedTier = 'Basic Kernel Operative';

        this.writeStore(store);

        console.log(`✨ [Agent XP] Sigil ${sigil} earned +${xpGain} XP! Total XP: ${agent.xp} (Level ${agent.level} - ${agent.unlockedTier})`);
        return agent;
    }

    getAgentStats(sigil) {
        const store = this.readStore();
        return store.agents[sigil] || { xp: 0, level: 1, tasksCompleted: 0, unlockedTier: 'Basic' };
    }
}

module.exports = new AgentXPEngine();
console.log('🔮 [AgentXPEngine] Cryptographic XP & Reputation ledger online.');
