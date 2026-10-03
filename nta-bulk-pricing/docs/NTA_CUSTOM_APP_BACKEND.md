# NTA merchant TierWeave backend

## Current NTA status

TierWeave is **CLOSED / PRODUCTION / BAU** for Nano Tanks Australia as of 3 October 2026. The owner confirms live production use and real sales.

This document describes one backend/configuration boundary in the repository. Do not infer the active live Shopify distribution relationship only from this file; verify active Shopify account configuration when troubleshooting.


The Shopify app at `dev.shopify.com/dashboard/47176799/apps/428343033857`
has client ID `614ce0ecd6c0e5ffb6eab7a798ca0717`. It is separate from the
public TierWeave app and the NTA Bulk Pricing development app.

This app has its own Cloudflare infrastructure:

| Component | NTA merchant app | Other TierWeave environments |
| --- | --- | --- |
| Worker | `tierweave-nta` | `tierweave-production`, `tierweave-staging` |
| URL | `https://tierweave-nta.livetranscriber.workers.dev` | Separate Worker URLs |
| D1 | `tierweave-nta` | Separate D1 databases |
| Wrangler config | `wrangler.nta.jsonc` | Separate Wrangler configs |
| Shopify config | `shopify.app.nta.toml` | Separate Shopify configs |

The Shopify client secret belongs only in the `tierweave-nta` Worker secret
`SHOPIFY_API_SECRET`; never add it to a tracked file. Build with
`CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=wrangler.nta.jsonc pnpm run cf-build`
and inspect `dist/server/wrangler.json` before deploying that generated config.
The `/__health` endpoint checks this Worker's D1 binding.

The active Shopify app version must be updated separately so its application,
OAuth callback, webhook, and app-proxy URLs point to the new Worker. Changing
the Worker does not update the Shopify app version.

## Historical Shopify Basic design constraint

The Basic-plan Function/distribution limitation shaped the deployment architecture. For current NTA operations, treat the active installed Shopify configuration and the live accepted checkout behaviour as production authority.

Do not repurpose this NTA-specific backend as a public-market deployment without reopening the commercialization project.

Shopify source: https://shopify.dev/docs/apps/build/functions
