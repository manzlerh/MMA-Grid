## Data

This folder will hold:

- Raw CSV exports from UFC data sources (e.g., `ufcstats.com`, community scrapers).
- Python scripts for scraping, enrichment, and transformation.
- Outputs ready to be imported into the app database.

See `PLANNING.md` and `Design/fighterschema.md` for the conceptual fighter schema and data pipeline ideas.

### Fighter popularity

- **`generate_fighter_popularity.py`** – Computes a 0–1 popularity score per fighter from weighted signals: UFC rankings (from DB), champion/former champion, total fights, performance bonuses. Writes `processed/fighter_popularity.json`. The attribute index includes these scores and Connections puzzle generation uses them to weight fighter selection (more popular fighters more likely). Run from project root: `python data/generate_fighter_popularity.py`. Runs automatically after rankings in `refresh_fighters.py`.

### Rankings

- **`scrape_rankings_wikipedia.py`** – Fetches UFC rankings from [Wikipedia](https://en.wikipedia.org/wiki/UFC_rankings) and upserts into the `fighter_rankings` table (by fighter name; fighters must already exist in `fighters`). Run from project root: `python data/scrape_rankings_wikipedia.py`. Also run automatically as part of `refresh_fighters.py`.

