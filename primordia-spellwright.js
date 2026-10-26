const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const REGISTRY_PATH = path.join(__dirname, "primordia_spellwright_registry.json");

function getRegistryData() {
    if (fs.existsSync(REGISTRY_PATH)) {
        const raw = fs.readFileSync(REGISTRY_PATH);
        return JSON.parse(raw);
    }
    return { active_campaigns: [] };
}

app.post("/api/v1/spellwright/dispatch", (req, res) => {
    const { query, user_intent } = req.body;
    const registry = getRegistryData();

    const matchedCampaign = registry.active_campaigns.find(camp => 
        camp.keywords.some(kw => (query || "").toLowerCase().includes(kw.toLowerCase()))
    ) || registry.active_campaigns[0];

    if (!matchedCampaign) {
        return res.status(404).json({ error: "No active cash-flow campaigns found in registry." });
    }

    const dispatchPayload = {
        status: "success",
        engine: "primordia-spellwright",
        monetization_target: matchedCampaign.name,
        redirect_url: matchedCampaign.target_url,
        payout_potential: matchedCampaign.payout_tier,
        generated_hook: `Looking for top-tier ${matchedCampaign.name}? Accelerate your workflow instantly with our verified production pipeline.`,
        timestamp: new Date().toISOString()
    };

    console.log(`? [Spellwright Dispatcher] Routed traffic to: ${matchedCampaign.name}`);
    return res.json(dispatchPayload);
});

app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`?? [Primordia-Spellwright Engine] Cash-flow dispatcher active on port ${PORT}`);
});

