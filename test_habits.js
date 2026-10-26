const PrimordiaHabitTracker = require('./primordia_habit_tracker');
const tracker = new PrimordiaHabitTracker();

// Simulate regular user interaction patterns
tracker.logInteraction("SPAWN_AGENT_NODE", { tier: "VISIONARY" });
tracker.logInteraction("SYNC_TELEMETRY", { source: "LOCAL_TERMINAL" });
