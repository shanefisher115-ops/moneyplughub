import json
import os
from datetime import datetime

REGISTRY_PATH = "primordia_spellwright_registry.json"

def load_registry():
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r") as f:
            return json.load(f)
    return {"active_campaigns": [], "last_sync": None}

def save_registry(data):
    data["last_sync"] = datetime.utcnow().isoformat()
    with open(REGISTRY_PATH, "w") as f:
        json.dump(data, f, indent=2)

def register_cash_flow_target(campaign_name, target_url, payout_tier, keywords):
    registry = load_registry()
    campaign = {
        "id": f"camp_{int(datetime.utcnow().timestamp())}",
        "name": campaign_name,
        "target_url": target_url,
        "payout_tier": payout_tier,
        "keywords": keywords,
        "status": "active"
    }
    registry["active_campaigns"].append(campaign)
    save_registry(registry)
    print(f"?? [Spellwright Loader] Injected high-yield cash target: {campaign_name}")

if __name__ == "__main__":
    register_cash_flow_target(
        campaign_name="AI Automation SaaS Suite",
        target_url="https://moneyplughub.com/go/ai-suite?ref=primordia",
        payout_tier="$45 recurring / sale",
        keywords=["ai automation", "workflow builder", "make.com alternative", "node.js backend tools"]
    )

