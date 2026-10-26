const fs = require('fs');
const path = require('path');

const POSTS_DIR = 'C:\\Users\\Shane\\moneyplughub\\published_posts';
const DOMAIN = 'https://primordialorigin.com';

// 1. Scan local posts
function getPublishedArticles() {
    if (!fs.existsSync(POSTS_DIR)) {
        console.error('❌ Published posts directory not found.');
        return [];
    }
    return fs.readdirSync(POSTS_DIR)
             .filter(file => file.endsWith('.md'))
             .map(file => ({
                 fileName: file,
                 fullPath: path.join(POSTS_DIR, file),
                 slug: file.replace('.md', '.html')
             }));
}

// 2. Parse front-matter metadata and build social share payload
function buildSyndicationPayload(article) {
    const rawContent = fs.readFileSync(article.fullPath, 'utf8');
    const lines = rawContent.split('\n');
    const title = lines[0].replace(/^#\s*/, '').trim();
    
    // Canonical link pointing back to your sovereign domain
    const canonicalUrl = `${DOMAIN}/${article.slug}`;

    return {
        title: title,
        canonical_url: canonicalUrl,
        social_snippet: `🚀 Fresh Tech Review: ${title}\n\nRead full analysis & dynamic specs on Primordia: ${canonicalUrl}\n\n#DevCommunity #Automation #SaaS #AI`,
        body_markdown: `${rawContent}\n\n---\n*Originally published on [Primordia Origin](${canonicalUrl})*`
    };
}

// 3. Execution & Platform Dispatch Simulation
async function syndicateContent() {
    console.log('📡 [Primordia Syndicator] Scanning workspace for target articles...');
    const articles = getPublishedArticles();

    if (articles.length === 0) {
        console.log('⚠️ No published Markdown articles found to syndicate.');
        return;
    }

    console.log(`✨ Found ${articles.length} articles ready for syndication:\n`);

    for (const article of articles) {
        const payload = buildSyndicationPayload(article);
        
        console.log(`==================================================`);
        console.log(`📄 Target File: ${article.fileName}`);
        console.log(`📌 Title: ${payload.title}`);
        console.log(`🔗 Canonical URL: ${payload.canonical_url}`);
        console.log(`📱 Syndication Snippet:\n"${payload.social_snippet}"`);
        console.log(`==================================================\n`);
    }

    console.log('✅ [Syndication Complete] All content snippets compiled and ready for channel dispatch.');
}

syndicateContent();
