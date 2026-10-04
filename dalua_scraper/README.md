# DALUA Wholesale catalogue scraper

Scrapes DALUA Wholesale product pages discovered from WordPress/WooCommerce sitemaps.

## Captured fields

- Product title
- Description
- Regular cost ex GST (only populated when tax treatment is confirmed)
- Regular cost + GST/displayed cost
- Markdown cost ex GST (only populated when tax treatment is confirmed)
- Markdown cost + GST/displayed markdown cost
- Markdown percentage
- Stock/availability
- Product page URL
- Primary image URL
- Additional image URLs
- UTC checked timestamp
- Scrape status

## Important GST rule

The scraper does **not** assume DALUA prices exclude GST. By default the displayed price is preserved in the `*_plus_gst`/displayed-price column and ex-GST is left blank. Run with `--prices-ex-gst` only after DALUA's pricing convention has been explicitly verified; then GST-inclusive values are calculated at 10%.

## Run

```bash
pip install -r dalua_scraper/requirements.txt
python dalua_scraper/scrape_dalua.py
```

After DALUA displayed prices are confirmed to be ex GST:

```bash
python dalua_scraper/scrape_dalua.py --prices-ex-gst
```

Outputs are written to `dalua_scraper/output/` as CSV, JSON and a validation summary.

The GitHub Actions workflow also uploads these files as a run artifact and validates that the catalogue is non-empty, has no scrape errors, has unique product URLs, titles on every row, and images on at least 90% of products.
