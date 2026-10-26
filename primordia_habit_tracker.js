const fs = require('fs');
const path = require('path');
const PrimordiaDigitalTwinEngine = require('./primordia_twin_engine');

const HABIT_LOG_FILE = path.join(__dirname, 'primordia_habits.json');

class PrimordiaHabitTracker {
    constructor() {
        this.twin = new PrimordiaDigitalTwinEngine();
        this.initializeLog();
    }

    initializeLog() {
        if (!fs.existsSync(HABIT_LOG_FILE)) {
            const initialData = {
                total_interactions: 0,
                action_frequencies: {},
                peak_hours: {},
                last_interaction: null
            };
            fs.writeFileSync(HABIT_LOG_FILE, JSON.stringify(initialData, null, 2));
        }
    }

    // Record a user interaction or command pattern
    logInteraction(action, context = {}) {
        try {
            const rawData = fs.readFileSync(HABIT_LOG_FILE, 'utf8');
            let habitData = JSON.parse(rawData);

            const now = new Date();
            const hourKey = `${now.getHours()}:00`;

            // Update stats
            habitData.total_interactions += 1;
            habitData.action_frequencies[action] = (habitData.action_frequencies[action] || 0) + 1;
            habitData.peak_hours[hourKey] = (habitData.peak_hours[hourKey] || 0) + 1;
            habitData.last_interaction = now.toISOString();

            fs.writeFileSync(HABIT_LOG_FILE, JSON.stringify(habitData, null, 2));

            // Autonomous Habit Adaptation: Automatically adjust twin state based on learned patterns
            this.adaptTwinState(habitData, action);

            console.log(`🧠 [Habit Tracker] Learned pattern logged -> Action: [${action}] at ${hourKey}`);
        } catch (error) {
            console.error("❌ Error logging habit interaction:", error);
        }
    }

    // Adapt digital twin parameters based on learned habits
    adaptTwinState(habitData, recentAction) {
        // Example: If a specific action is performed frequently, boost the apex telemetry index
        const frequency = habitData.action_frequencies[recentAction] || 1;
        const adaptiveApex = Math.min(100.0, 50.0 + (frequency * 2.5));

        this.twin.updateState({
            apex_index: adaptiveApex,
            last_learned_habit: recentAction,
            adaptation_status: "OPTIMIZED_TO_USER_RHYTHM"
        });
    }
}

module.exports = PrimordiaHabitTracker;
