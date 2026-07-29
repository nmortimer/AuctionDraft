# Free Agent Auction — Draft Room

Static frontend (`index.html`) + two serverless functions (`/api/state`, `/api/action`)
backed by Redis. No build step.

## Deploy (first time)

1. Push this folder to a GitHub repo (new repo, or a folder in an existing one).
2. In Vercel: **New Project** → import that repo. Framework preset: "Other" (no build
   command needed) — it'll deploy as-is.
3. In the project → **Storage** tab → **Create Database** → pick **Redis** (this
   provisions an Upstash Redis instance through Vercel's Marketplace and connects
   it to the project automatically).
4. Redeploy (Vercel usually does this automatically once the storage is connected —
   if not, trigger a redeploy from the Deployments tab so the new env vars are picked up).
5. Open the deployment URL — that's the link to send to your league.

## How it works

- `index.html` polls `GET /api/state` once a second and calls `POST /api/action`
  for every user action (nominate, bid, pass, sell, etc).
- All the draft state lives in one Redis key. `GET /api/state` also auto-resolves
  any turn whose timer has expired *before* returning — so if everyone stepped
  away from their screens, the next person who loads the page catches the draft
  back up automatically. No single person has to be the one keeping it moving.
- Each person's browser remembers which team they are via `localStorage`, so
  refreshing the page doesn't lose your identity.

## Rules encoded

- Bid clock resets on every new bid (soft close).
- If a team doesn't nominate before the nomination clock runs out, they're
  auto-skipped and can never nominate again — but can still bid on others' picks.
- Bids are never blocked by budget — a team can go over, it just shows in red.
- Optional roster limit is informational only (shown on each team card), doesn't
  block bids either, matching the "let them go over, just tell them" approach.

## If something looks off after deploying

Check **Settings → Environment Variables** in Vercel — the Redis integration
should have injected either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. The code checks for both
names, so either is fine.
