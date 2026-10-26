const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "published_posts");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function parseFrontmatter(content) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(frontmatterRegex);
    const data = {};
    let body = content;

    if (match) {
        body = content.replace(frontmatterRegex, "").trim();
        const lines = match[1].split("\n");
        lines.forEach(line => {
            const [key, ...valueParts] = line.split(":");
            if (key && valueParts.length) {
                data[key.trim()] = valueParts.join(":").trim().replace(/^["\x27]|["\x27]$/g, "");
            }
        });
    }
    return { data, body };
}

function generateHtml(title, bodyContent, ctaUrl, ctaText) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} | MoneyPlugHub Tech Portal</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0d1117; color: #c9d1d9; line-height: 1.6; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 40px auto; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 32px; }
        h1 { color: #58a6ff; font-size: 2rem; border-bottom: 1px solid #30363d; padding-bottom: 10px; }
        h2 { color: #79c0ff; margin-top: 24px; }
        a { color: #58a6ff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .btn-cta { display: inline-block; background: #238636; color: #ffffff; font-weight: bold; padding: 12px 24px; border-radius: 6px; margin: 20px 0; text-decoration: none; text-align: center; }
        .btn-cta:hover { background: #2ea043; text-decoration: none; }
        .footer { margin-top: 40px; font-size: 0.85rem; color: #8b949e; border-top: 1px solid #30363d; padding-top: 16px; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div>${bodyContent.replace(/\n/g, "<br>")}</div>
        ${ctaUrl ? `<a href="${ctaUrl}" class="btn-cta" target="_blank">${ctaText || "Access Official Portal ?"}</a>` : ""}
        <div class="footer">
            <p>Powered by PrimordiaOS Traffic Engine &copy; 2026 MoneyPlugHub</p>
        </div>
    </div>
</body>
</html>`;
}

function buildPortal() {
    console.log("?? [Portal Builder] Converting Markdown posts to HTML web pages...");
    if (!fs.existsSync(POSTS_DIR)) {
        console.error("? published_posts directory not found.");
        return;
    }
    const files = fs.readdirSync(POSTS_DIR);
    let count = 0;

    files.forEach(file => {
        if (file.endsWith(".md")) {
            const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
            const { data, body } = parseFrontmatter(raw);
            const title = data.title || file.replace(".md", "");
            const html = generateHtml(title, body, data.target_url, `Get Started with ${data.target_campaign || "Solution"}`);
            
            const htmlFileName = file.replace(".md", ".html");
            fs.writeFileSync(path.join(PUBLIC_DIR, htmlFileName), html, "utf8");
            console.log(`? Generated Page: public/${htmlFileName}`);
            count++;
        }
    });

    console.log(`?? [Portal Built] Successfully compiled ${count} static pages into /public.`);
}

buildPortal();

