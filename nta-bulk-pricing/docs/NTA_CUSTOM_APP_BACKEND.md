# NTA merchant TierWeave backend

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

## Shopify Basic limitation

Nano Tanks Australia is on Shopify Basic. Shopify permits custom apps with
Shopify Functions only on Plus. This merchant app can use the separate backend
for its admin and storefront app proxy, but its Discount Function cannot be
used for reliable checkout pricing on the live Basic store. The public TierWeave
app, once approved for Shopify App Store distribution, is the path for Function
discounts on Basic. Do not replace Koala or publish the six migration rules
through this merchant app.

Shopify source: https://shopify.dev/docs/apps/build/functions
