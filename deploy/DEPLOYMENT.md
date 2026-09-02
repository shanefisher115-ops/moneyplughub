# ?? MoneyPlugHub Public Production Deployment Guide

MoneyPlugHub can be deployed to any public cloud platform, edge CDN, or self-hosted server in under 2 minutes.

---

## ?? Option 1: Cloudflare Tunnel (Active & Instant)

MoneyPlugHub has an automated Cloudflare Tunnel daemon configured on Windows / Linux:

```bash
# 1. Start backend & client
npm run dev

# 2. Launch Cloudflare Tunnel
cloudflared tunnel run --token "<YOUR_CLOUDFLARE_TUNNEL_TOKEN>" --url http://localhost:3001
```

* **Public URL**: Automatically routed through your custom domain (e.g. `https://moneyplughub.com` or `https://*.trycloudflare.com`).
* **Zero Port Forwarding**: Encrypted WireGuard tunnels straight to Cloudflare's global edge network.

---

## ? Option 2: Vercel (Frontend & Serverless API)

1. Create `vercel.json` in the project root:
```json
{
  "version": 2,
  "builds": [
    { "src": "dist/client/**", "use": "@vercel/static" },
    { "src": "src/backend/server.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/src/backend/server.ts" },
    { "src": "/go/(.*)", "dest": "/src/backend/server.ts" },
    { "src": "/(.*)", "dest": "/dist/client/$1" }
  ]
}
```
2. Run `vercel deploy --prod`

---

## ??? Option 3: Netlify / Cloudflare Pages

1. **Build Command**: `npm run build`
2. **Publish Directory**: `dist/client`
3. **Environment Variables**:
   * `NODE_ENV=production`
   * `ELEVENLABS_API_KEY=...`
   * `JWT_SECRET=...`

---

## ?? Option 4: Docker & Container Deployment

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/server/server.js"]
```

Build and run:
```bash
docker build -t moneyplughub:latest .
docker run -d -p 3001:3001 --name moneyplughub --restart always moneyplughub:latest
```

---

## ?? Live Production Endpoints & Routes
* **Healthcheck**: `GET /api/health`
* **PeerSignal Telemetry**: `POST /api/peersignal/emit`
* **PeerPush Live Broadcasts**: `GET /api/peersignal/push-events`
* **AGK Viral Loops & Cascades**: `GET /api/agk/metrics`
* **Executive Growth Analytics**: `GET /api/admin/metrics-summary`
* **Top-Level Referral Redirects**: `GET /go/:slug`
