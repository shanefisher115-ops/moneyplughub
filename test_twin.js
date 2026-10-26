const PrimordiaDigitalTwinEngine = require('./primordia_twin_engine');
const twin = new PrimordiaDigitalTwinEngine();

twin.updateState({
    apex_index: 92.4,
    sigil: "SIGIL-GOTHIC-VALLEY",
    system_status: "SYNCHRONIZED"
});

twin.enqueueTask("SPAWN_AGENT_NODE", {
    status: "ACTIVE",
    coordinates: { x: 100, y: 200, z: 50 },
    tier: "ARCHTYPE_VISIONARY"
});
