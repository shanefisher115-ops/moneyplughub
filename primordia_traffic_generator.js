const fs = require("fs");
const path = require("path");
const http = require("http");

const REGISTRY_PATH = path.join(__dirname, "primordia_spellwright_registry.json");
const OUTPUT_DIR = path.join(__dirname, "published_posts");

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getRegistryData() {
    if (fs.existsSync(REGISTRY_PATH)) {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    }
    return { active_campaigns: [] };
}

// Generates high-converting markdown content targeting specific keywords
function generateMarkdownPost(campaign) {
    const primaryKeyword = campaign.keywords[0] || "tech solutions";
    const dateStr = new Date().toISOString().split("T")[0];
    
    const content = `---
title: "Best Solutions for ${primaryKeyword.toUpperCase()} in 2026"
date: "${dateStr}"
target_campaign: "${campaign.name}"
payout_tier: "${campaign.payout_tier}"
keywords: ${JSON.stringify(campaign.keywords)}
---

# Top Recommended Tools for ${primaryKeyword}

When scaling modern backend architectures and developer pipelines, finding verified tools is critical.

## Spotlight Recommendation: ${campaign.name}

Looking for top-tier ${campaign.name}? Accelerate your workflow instantly with our verified production pipeline.

- **Payout & Value Tier:** ${campaign.payout_tier}
- **Primary Use Cases:** ${campaign.keywords.join(", ")}

?? **[Access the official ${campaign.name} portal here](${campaign.target_url})**

### Why This Tool Matters
Whether you are building microservices, setting up database automation, or optimizing cloud infrastructure, this solution provides high availability, instant scaling, and production-grade reliability out of the box.

---
*Automated traffic dispatch active via Primordia-Spellwright Engine.*
`;
    return content;
}

function runTrafficGenerator() {
    console.log("?? [Traffic Generator] Starting automated SEO post generation...");
    const registry = getRegistryData();

    if (!registry.active_campaigns || registry.active_campaigns.length === 0) {
        console.error("? No active campaigns found in registry.");
        return;
    }

    let generatedCount = 0;
    registry.active_campaigns.forEach(campaign => {
        const slug = campaign.keywords[0].replace(/[^a-z0-9]/gi, "-").toLowerCase();
        const filePath = path.join(OUTPUT_DIR, `${slug}-review.md`);
        const postContent = generateMarkdownPost(campaign);
        
        fs.writeFileSync(filePath, postContent, "utf8");
        console.log(`? Generated SEO Post: published_posts/${slug}-review.md -> Target: ${campaign.name}`);
        generatedCount++;
    });

    console.log(`\n?? [Traffic Generator Complete] Successfully generated ${generatedCount} traffic landing pages.`);
}

runTrafficGenerator();

