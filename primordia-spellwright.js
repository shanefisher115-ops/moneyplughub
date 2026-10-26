require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const REGISTRY_PATH = path.join(__dirname, "primordia_spellwright_registry.json");

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

function getRegistryData() {
    if (fs.existsSync(REGISTRY_PATH)) {
        const raw = fs.readFileSync(REGISTRY_PATH);
        return JSON.parse(raw);
    }
    return { active_campaigns: [] };
}

async function logClickToSupabase(clickData) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from("spellwright_clicks").insert([clickData]);
        if (error) {
            console.error("?? [Supabase Log Error]:", error.message);
        } else {
            console.log("?? [Supabase] Click successfully logged to database.");
        }
    } catch (err) {
        console.error("?? [Supabase Log Exception]:", err.message);
    }
}

app.post("/api/v1/spellwright/dispatch", async (req, res) => {
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

    // Log event asynchronously without blocking client response
    logClickToSupabase({
        query: query || null,
        user_intent: user_intent || null,
        monetization_target: matchedCampaign.name,
        redirect_url: matchedCampaign.target_url,
        payout_potential: matchedCampaign.payout_tier,
        user_agent: req.headers["user-agent"] || null,
        ip_address: req.ip || req.headers["x-forwarded-for"] || null
    });

    console.log(`? [Spellwright Dispatcher] Routed traffic to: ${matchedCampaign.name}`);
    return res.json(dispatchPayload);
});

app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

app.listen(PORT, () => {
    console.log(`?? [Primordia-Spellwright Engine] Cash-flow dispatcher active on port ${PORT}`);
});

