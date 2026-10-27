const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, 'primordia_spellwright_registry.json');
const OUTPUT_DIR = path.join(__dirname, 'public', 'articles');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function loadRegistry() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        console.error("❌ Registry not found!");
        process.exit(1);
    }
    let rawData = fs.readFileSync(REGISTRY_PATH, 'utf8');
    // Strip UTF-8 Byte Order Mark (BOM) if present
    if (rawData.charCodeAt(0) === 0xFEFF) {
        rawData = rawData.slice(1);
    }
    return JSON.parse(rawData);
}

const templates = [
    {
        slug: "top-5-ai-workflow-automation-tools-2026",
        title: "Top 5 AI Workflow Automation Tools to Scale Your Tech Stack in 2026",
        category: "Enterprise Automation",
        focus_id: "make-automation-saas",
        intro: "As micro-SaaS and autonomous systems scale, manual webhook routing and basic scripts no longer cut it. To build a self-sustaining revenue pipeline, developers and founders need visual, high-throughput orchestration platforms. Here are the top 5 tools dominating automated engineering in 2026.",
        tools: [
            {
                name: "Make.com (Integromat)",
                badge: "Editor's Choice & Best Payout",
                description: "The gold standard for visual API orchestration. Make.com lets you build deep, multi-branch logic scenarios without bottlenecks.",
                whyItWins: "Unmatched scenario execution speed, advanced error handlers, and a lucrative 35% recurring commission tier.",
                ctaText: "Automate Your Pipeline with Make.com"
            },
            {
                name: "Zapier Enterprise",
                badge: "Best for Mass Integrations",
                description: "Connects to over 5,000+ business applications instantly with minimal setup.",
                whyItWins: "Plug-and-play simplicity, though less granular for complex custom JSON transforms than Make.",
                ctaText: "Explore Zapier Integrations"
            },
            {
                name: "n8n (Self-Hosted)",
                badge: "Sovereign Choice",
                description: "Fair-code workflow automation software that runs locally or on your own private cloud instance.",
                whyItWins: "Full data privacy and zero per-execution limits when self-hosted on sovereign infrastructure.",
                ctaText: "Deploy n8n Locally"
            },
            {
                name: "Cloudflare Workers & Queues",
                badge: "Infrastructure Layer",
                description: "Edge computing logic combined with persistent message queues for serverless automation.",
                whyItWins: "Zero cold starts and global distribution across edge nodes.",
                ctaText: "Scale with Cloudflare"
            },
            {
                name: "Supabase Realtime Triggers",
                badge: "Database Telemetry",
                description: "Trigger automations instantly based on PostgreSQL database events and row changes.",
                whyItWins: "Native real-time tracking for click auditing and event logging.",
                ctaText: "Build on Supabase"
            }
        ]
    }
];

function generateArticles() {
    const registry = loadRegistry();
    
    templates.forEach(tpl => {
        const campaign = registry.active_campaigns.find(c => c.id === tpl.focus_id) || { target_url: "#" };
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tpl.title} | Primordial Origin</title>
    <style>
        body { background: #0b0f19; color: #e2e8f0; font-family: system-ui, sans-serif; line-height: 1.6; padding: 2rem; max-width: 800px; margin: auto; }
        h1 { color: #38bdf8; font-size: 2.2rem; margin-bottom: 0.5rem; }
        .meta { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; border-bottom: 1px solid #1e293b; padding-bottom: 1rem; }
        .intro { font-size: 1.1rem; margin-bottom: 2rem; }
        .card { background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .badge { background: #0369a1; color: #e0f2fe; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: bold; }
        h3 { margin-top: 0; color: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
        .cta-btn { display: inline-block; background: #2563eb; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: bold; margin-top: 1rem; transition: background 0.2s; }
        .cta-btn:hover { background: #1d4ed8; }
    </style>
</head>
<body>
    <h1>${tpl.title}</h1>
    <div class="meta">Category: ${tpl.category} | Published by Primordia Engine</div>
    <div class="intro">${tpl.intro}</div>
    <hr style="border:0; border-top:1px solid #1e293b; margin: 2rem 0;">`;

        tpl.tools.forEach((tool, index) => {
            let link = (index === 0) ? campaign.target_url : "#";
            html += `
    <div class="card">
        <h3><span>#${index + 1}. ${tool.name}</span> <span class="badge">${tool.badge}</span></h3>
        <p>${tool.description}</p>
        <p><strong>Why It Wins:</strong> ${tool.whyItWins}</p>
        <a href="${link}" class="cta-btn" target="_blank">${tool.ctaText}</a>
    </div>`;
        });

        html += `
</body>
</html>`;

        const outputPath = path.join(OUTPUT_DIR, `${tpl.slug}.html`);
        fs.writeFileSync(outputPath, html, 'utf8');
        console.log(`✅ Generated article: ${outputPath}`);
    });
}

generateArticles();