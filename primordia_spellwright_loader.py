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

def seed_multi_offer_campaigns():
    registry = load_registry()
    
    # Portfolio of high-yielding affiliate & monetization targets
    offers = [
        {
            "id": "camp_ai_suite",
            "name": "AI Automation SaaS Suite",
            "target_url": "https://moneyplughub.com/go/ai-suite?ref=primordia",
            "payout_tier": "$45 recurring / sale",
            "keywords": ["ai automation", "workflow builder", "make.com alternative", "node.js backend tools"],
            "status": "active"
        },
        {
            "id": "camp_cloud_infra",
            "name": "High-Performance Cloud Run & Edge Hosting",
            "target_url": "https://moneyplughub.com/go/cloud-host?ref=primordia",
            "payout_tier": "$60 CPA + 20% lifetime",
            "keywords": ["cloud run", "serverless", "deployment", "docker container", "cloudflare worker"],
            "status": "active"
        },
        {
            "id": "camp_db_sync",
            "name": "Enterprise Supabase & PostgreSQL Scaling Kit",
            "target_url": "https://moneyplughub.com/go/db-scale?ref=primordia",
            "payout_tier": "$35 recurring / sale",
            "keywords": ["database", "supabase", "postgres", "sql migration", "row level security"],
            "status": "active"
        },
        {
            "id": "camp_dev_agents",
            "name": "Autonomous Code Agent Pipeline",
            "target_url": "https://moneyplughub.com/go/dev-agents?ref=primordia",
            "payout_tier": "$100 CPA / sale",
            "keywords": ["coding assistant", "ai developer", "python script", "typescript automation"],
            "status": "active"
        }
    ]

    # Merge or replace active campaigns
    registry["active_campaigns"] = offers
    save_registry(registry)
    print(f"?? [Spellwright Loader] Successfully seeded {len(offers)} high-yield multi-offer cash campaigns.")

if __name__ == "__main__":
    seed_multi_offer_campaigns()

