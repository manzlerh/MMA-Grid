## Data

This folder will hold:

- Raw CSV exports from UFC data sources (e.g., `ufcstats.com`, community scrapers).
- Python scripts for scraping, enrichment, and transformation.
- Outputs ready to be imported into the app database.

See `PLANNING.md` and `Design/fighterschema.md` for the conceptual fighter schema and data pipeline ideas.

### Fighter popularity

- **`generate_fighter_popularity.py`** – Computes a 0–1 popularity score per fighter from weighted signals (highest to lowest weight): **most-followed list** (The Scrap), **Tapology fan-voted favorites**, **Wikipedia pageviews** (optional), UFC ranking + champion/former champion, then total fights and performance bonuses. Writes `processed/fighter_popularity.json`. Run from project root: `python data/generate_fighter_popularity.py`. Runs automatically in `refresh_fighters.py` after the scrapers below.
- **`scrape_most_followed_fighters.py`** – Fetches [The Scrap’s most-followed UFC fighters](https://www.thescrap.co/most-followed-fighters/) (Instagram + X). Writes `processed/most_followed_fighters.json`. Used as the top-weighted popularity signal.
- **`scrape_tapology_fan_favorites.py`** – Scrapes all pages of [Tapology’s fan-voted favorite MMA fighters](https://www.tapology.com/rankings/top-ten-fan-favorite-mma-and-ufc-fighters?ranking=2). Writes `processed/tapology_fan_favorites.json`. Second-highest weight in popularity.
- **Optional: `processed/wikipedia_pageviews.json`** – If present, a JSON object `{ "Fighter Name": pageview_count }` is used as the third signal. You can populate this with a script that calls the [Wikipedia Pageviews API](https://wikimedia.org/api/rest_v1/#/Pageviews%20data) for each fighter’s article.

### Rankings

- **`scrape_rankings_wikipedia.py`** – Fetches UFC rankings from [Wikipedia](https://en.wikipedia.org/wiki/UFC_rankings) and upserts into the `fighter_rankings` table (by fighter name; fighters must already exist in `fighters`). Run from project root: `python data/scrape_rankings_wikipedia.py`. Also run automatically as part of `refresh_fighters.py`.

