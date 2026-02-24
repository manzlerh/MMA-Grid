## Data

This folder will hold:

- Raw CSV exports from UFC data sources (e.g., `ufcstats.com`, community scrapers).
- Python scripts for scraping, enrichment, and transformation.
- Outputs ready to be imported into the app database.

See `PLANNING.md` and `Design/fighterschema.md` for the conceptual fighter schema and data pipeline ideas.

### Rankings

- **`scrape_rankings_wikipedia.py`** – Fetches UFC rankings from [Wikipedia](https://en.wikipedia.org/wiki/UFC_rankings) and upserts into the `fighter_rankings` table (by fighter name; fighters must already exist in `fighters`). Run from project root: `python data/scrape_rankings_wikipedia.py`. Also run automatically as part of `refresh_fighters.py`.

