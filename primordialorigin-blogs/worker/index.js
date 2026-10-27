export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = url.pathname.replace(/^\/|\/$/g, '') || 'index';

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Primordialorigin | Automated Intelligence & Decentralized Architecture</title>
    <meta name="description" content="Exploring the edges of automated systems, digital infrastructure, and Primordialorigin networks.">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 40px; display: flex; justify-content: center; }
        .container { max-width: 700px; width: 100%; background: #111827; padding: 50px; border-radius: 16px; border: 1px solid #1f2937; box-shadow: 0 20px 40px rgba(0,0,0,0.7); }
        h1 { color: #38bdf8; font-size: 28px; margin-bottom: 20px; }
        p { color: #94a3b8; line-height: 1.7; font-size: 16px; margin-bottom: 20px; }
        .badge { display: inline-block; background: #065f46; color: #34d399; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 25px; }
        .footer { margin-top: 40px; border-top: 1px solid #1f2937; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="badge">Primordialorigin Decentralized Node</div>
        <h1>Autonomous Systems & Digital Scale</h1>
        <p>Welcome to the decentralized edge of the Primordialorigin network. This automated intelligence node compiles high-performance architectures, automated tracking funnels, and programmatic web assets on the fly.</p>
        <p>Every node on this network operates autonomously to maximize digital footprint, rapid search engine indexing, and seamless brand dispersion across the web.</p>
        <div class="footer">&copy; ${new Date().getFullYear()} Primordialorigin. All rights reserved.</div>
    </div>
</body>
</html>`;

    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};
