## UFC Trivia App – Planning Notes

This document is a **living, non-binding plan** for a UFC-themed trivia web app inspired by `futbol-11.com`. It summarizes ideas from the `Design/` markdown files and adds implementation thoughts. Nothing here is a strict contract; it is context to guide future decisions.

---

### 1. What the App Does

- **Daily UFC Grid**
  - A 3×3 grid where each row and column represents a UFC-related attribute (e.g., *Weight Class*, *Nationality*, *Gym*, *Title Status*, *Era*, *Finish Type*).
  - Each cell must be filled with a fighter who satisfies **both** the row and column attributes.
  - Users type a fighter name, get **autocomplete suggestions**, and submit to validate the choice.
  - Like futbol-11’s grid, a fighter can fit multiple cells, but each fighter may only be used once per board.

- **Daily UFC Connections**
  - A 4×4 board of **16 fighters** that secretly belong to **4 groups of 4** based on shared attributes.
  - Group themes are derived from data (and some curated logic), such as:
    - “All fought Conor McGregor”
    - “American Top Team fighters”
    - “Former Lightweight Champions”
    - “Notable wrestlers with KO finishes”
  - Users click four fighters they believe form a group and submit; correct sets are locked in and colored by difficulty.

- **Daily-Game Loop and User Tracking**
  - There is **one official daily grid** and **one daily connections puzzle** per calendar day.
  - The site remembers whether a user has played today, tracks their **streak**, and stores **past scores** without requiring an account.
  - A stats modal (like Wordle / futbol-11) surfaces streak, distribution of scores, and a shareable result string.

These behaviors align with `Design/developmentphases.md`, `Design/gamedesign.md`, and `Design/usertracking.md`.

---

### 2. Tech Stack (from `Design/techstack.md` & `Design/architecture.md`)

- **Frontend**
  - Framework: **React + Vite** (SPA).
  - Styling: **Tailwind CSS** with a UFC-inspired dark palette (black/gray base, red and gold accents).
  - Responsibilities:
    - Render daily grid and connections games.
    - Handle fighter search/autocomplete and selection UX.
    - Local state for in-progress games, animations, error messages.
    - Anonymous user ID management and communication with backend for scores and puzzle fetch.

- **Backend**
  - Runtime: **Node.js** with **Express** (Fastify later is possible but not required).
  - Responsibilities:
    - REST API for daily content:
      - `GET /api/daily-grid`
      - `GET /api/daily-connections`
      - `POST /api/validate-grid`
      - `POST /api/validate-connections`
      - `POST /api/score` (record game results for anonymous users).
    - Puzzle generation (if not fully handled by offline scripts).
    - Optional: simple admin endpoints or CLI tools to seed puzzles.

- **Database & Storage**
  - Primary DB: **PostgreSQL** (e.g., Supabase-managed).
  - Optional cache: **Redis** for frequently-read daily puzzle data.
  - The DB stores fighters, attributes, puzzles, and user stats (see schema section).

- **Data Pipeline**
  - Language: **Python** (scripts in `/data`).
  - Sources and tooling (from `Design/fighterschema.md`):
    - Seed data from community scrapers like `Greco1899/scrape_ufc_stats` (UFCStats CSV dumps).
    - Enrichment via `BeautifulSoup` or the `ufc-api` package (Sherdog data) for gyms, titles, bonuses, and detailed histories.
  - Execution:
    - Manual or scheduled weekly jobs (via `node-cron`, GitHub Actions, or external scheduler).
    - Output cleaned CSVs or direct DB imports that match the app’s fighter schema.

- **Hosting / Infra**
  - Likely:
    - **Vercel** for frontend.
    - **Render/Fly.io/railway** for backend Node service.
    - **Supabase or managed PostgreSQL** for data.
  - Automated deploys via GitHub integration.

This aligns with the architecture diagram in `Design/architecture.md` and the tables in `Design/techstack.md`.

---

### 3. Database Schema (informed by `Design/fighterschema.md` & others)

This section outlines a **conceptual schema** rather than a final contract. Actual migrations can simplify or extend this as needed.

- **Core Fighter Entities**

  - `fighters`
    - `id` (PK)
    - `ufcstats_id` (nullable external ID)
    - `name`
    - `nickname`
    - `primary_weight_class` (enum)
    - `other_weight_classes` (array/JSON)
    - `nationality`
    - `gym` (string or FK to `gyms`)
    - `stance`
    - `reach_cm` (nullable)
    - `height_cm` (nullable)
    - `ufc_active_start_year`
    - `ufc_active_end_year` (nullable, `NULL` = still active)
    - `finish_profile` (JSON: KO%, sub%, decision%)
    - `bonus_awards` (JSON/array: FOTN, POTN, etc.)
    - `title_status` (enum: `never_champion`, `former_champion`, `current_champion`, `interim_champion`, etc.)

  - `gyms` (optional, if we normalize)
    - `id` (PK)
    - `name`
    - `city`
    - `country`

  - `fights` (may not be heavily used in v1 games but is useful for richer categories)
    - `id` (PK)
    - `event_name`
    - `event_date`
    - `fighter_a_id` (FK → `fighters.id`)
    - `fighter_b_id` (FK → `fighters.id`)
    - `winner_id` (FK → `fighters.id`)
    - `method` (KO/TKO, SUB, DEC, etc.)
    - `round`
    - `time`
    - `weight_class`
    - `title_fight` (boolean)

  - `fighter_titles` (optional detail table)
    - `id` (PK)
    - `fighter_id` (FK → `fighters.id`)
    - `division`
    - `title_type` (undisputed, interim)
    - `won_date`
    - `lost_date` (nullable)

- **Daily Puzzle Entities**

  - `daily_puzzles`
    - `id` (PK)
    - `puzzle_date` (unique, usually today)
    - `grid_puzzle_id` (FK → `grid_puzzles.id`, nullable if no grid that day)
    - `connections_puzzle_id` (FK → `connections_puzzles.id`, nullable)
    - `created_at`

  - `grid_puzzles`
    - `id` (PK)
    - `rows` (JSON array of 3 row descriptors, each referencing an attribute type/value)
    - `columns` (JSON array of 3 column descriptors)
    - `allowed_fighters` (optional JSON mapping from cell coordinates to allowed fighter IDs; can also derive on the fly by querying attributes)
    - `rarity_scores` (optional JSON storing rarity weighting per fighter/cell).

  - `connections_puzzles`
    - `id` (PK)
    - `fighters` (JSON array of 16 fighter IDs in board order)
    - `groups` (JSON array of 4 objects):
      - `label` (e.g., “Former Lightweight Champions”)
      - `fighter_ids` (array of 4 IDs)
      - `difficulty` (enum: `easy`, `medium`, `hard`, `legendary`)

- **User Tracking (No Accounts)**

  From `Design/usertracking.md`:

  - On first visit, the frontend creates an **anonymous UUID** and stores it in `localStorage`.
  - Backend treats this UUID as the user key.

  Proposed tables:

  - `users_anonymous`
    - `id` (PK, server-side UUID)
    - `client_uuid` (string from localStorage, indexed)
    - `created_at`

  - `user_daily_results`
    - `id` (PK)
    - `user_id` (FK → `users_anonymous.id`)
    - `puzzle_date`
    - `game_type` (enum: `grid`, `connections`)
    - `completed` (boolean)
    - `mistakes` (int)
    - `score` (int – e.g., rarity-weighted or attempts-based)
    - `created_at`

  - Optional: `user_streaks` view or materialized table for efficient streak queries.

These tables should support the queries sketched in `Design/developmentphases.md` (e.g., endpoints for `/daily/grid`, `/daily/connections`, `/score`).

---

### 4. Game Rules

#### 4.1 UFC Grid (from `Design/gamedesign.md`)

- **Board**
  - Fixed **3×3** board for the initial version.
  - Each **row** and **column** is an attribute such as:
    - Weight Class (e.g., Lightweight, Heavyweight)
    - Nationality / Country
    - Gym / Team (e.g., American Top Team)
    - Era (e.g., 2000s, 2010s, 2020s)
    - Title Status (champion, former champion, never champion)
    - Finish Type profile (striker, grappler, decision machine)
  - Daily configuration can mix and match these attribute dimensions.

- **Gameplay**
  - Users tap/click a cell, start typing a fighter’s name, and choose one from an **autocomplete dropdown**.
  - Backend validates that the fighter meets both the row and column attributes, using the `fighters` and relational tables.
  - If a fighter qualifies for multiple cells, they still may only be used once in the final solution.

- **Scoring**
  - Fewer wrong guesses → higher score.
  - Rarity bonus if the chosen fighter is an **uncommon fit** for the cell:
    - Example approach: compute rarity via `1 / (number of valid fighters for this cell)`.
  - Final score could combine:
    - Correct cells filled.
    - Attempts used.
    - Sum of rarity bonuses.

- **Limits & Fail States (v1 idea)**
  - Optionally introduce a maximum guesses count or timer, but this can be added after the core logic is in place.

#### 4.2 UFC Connections (from `Design/gamedesign.md`)

- **Board**
  - 16 fighters displayed in a 4×4 grid.
  - Fighters belong to **4 hidden categories** of 4 fighters each.
  - Categories vary in **difficulty**, mapped to colors (loosely inspired by NYT Connections and futbol-11):
    - Easy → yellow
    - Medium → green/blue
    - Hard → purple, etc. (exact palette can be tuned in the UI).

- **Gameplay**
  - User selects **exactly four fighters** and presses a “Submit” / “Guess Group” button.
  - The backend (or precomputed `connections_puzzles.groups`) checks if those four fighters match any remaining group.
  - On a correct guess:
    - The group is locked in place.
    - Fighters may slide together or be visually highlighted.
    - The category label and color are revealed.
  - On an incorrect guess:
    - The user’s mistake counter increases.
    - The board may give subtle feedback (shake animation, message).

- **Rules & Constraints**
  - Players have **up to 5 wrong guesses** before the game is over (as in the design doc).
  - The game ends either when:
    - All 4 groups are correctly identified, or
    - The mistake limit is reached.

- **Scoring**
  - Base score for completion.
  - Penalties for wrong guesses.
  - Optional bonus for solving without using hints (if hints are added later).

---

### 5. Data & Puzzle Generation Strategy

Drawing from `Design/fighterschema.md` and `Design/developmentphases.md`:

- **Phase 1 Focus**
  - Download community-maintained UFCStats CSVs (e.g., from `Greco1899/scrape_ufc_stats`).
  - Use Python scripts in `/data` to:
    - Normalize names and IDs.
    - Enrich fighters with gyms, titles, bonuses, and eras.
    - Compute derived attributes such as `finish_profile`, `title_status`, `primary_weight_class`.
  - Load enriched data into PostgreSQL.

- **Puzzle Generation Approaches**
  - **Offline scripts (preferred for v1)**:
    - Python script selects 9 cell attribute pairs and derives valid fighters for each cell.
    - Another script picks 16 fighters and defines 4 clusters for connections (based on titles, gyms, opponents, etc.).
    - Scripts write directly into `grid_puzzles` / `connections_puzzles` and populate `daily_puzzles` for a date range.
  - **On-demand generation (future option)**:
    - Backend endpoint that, given a date, generates a puzzle algorithmically if none exists.

---

### 6. User Tracking & Stats (from `Design/usertracking.md` & `Design/developmentphases.md`)

- **Anonymous Identity**
  - On first visit, frontend creates and stores a UUID in `localStorage`.
  - This UUID is sent with each API request (header or body).
  - Backend maps this to a row in `users_anonymous`.

- **What We Track**
  - Whether the user has completed today’s grid and/or connections puzzle.
  - Current streak (consecutive days with at least one completed daily game).
  - Scores per puzzle and game type.
  - Optionally: number of guesses, most common wrong fighters, etc.

- **Stats UI**
  - Modal or dedicated screen showing:
    - Longest and current streak.
    - Win rate.
    - Score distribution (histogram).
  - “Share result” button that copies an emoji/text summary (inspired by Wordle and futbol-11).

---

### 7. Development Phases (summary from `Design/developmentphases.md`)

This is a **rough timeline**, not a hard schedule:

1. **Phase 1 – Data & Backend Foundation**
   - Build the Python data pipeline and schema.
   - Stand up PostgreSQL and an initial Express API (`GET /fighters/search`, `GET /daily/grid`, `GET /daily/connections`, `POST /score`).
2. **Phase 2 – Core Game UI**
   - Scaffold the React/Vite frontend.
   - Implement the grid and connections game components and wire them to the API.
3. **Phase 3 – Daily Puzzle System**
   - Implement scripts or admin surfaces to generate/seed daily puzzles.
4. **Phase 4 – User Tracking & Stats**
   - Add anonymous UUID tracking, streak logic, and stats UI.
5. **Phase 5 – Polish & Launch**
   - Mobile responsiveness, styling polish, fighter images, SEO, deploys.

These phases can be iterated on and reordered as needed; they simply provide a guideline for prioritization.

---

### 8. Open Questions & Future Ideas

- How aggressive should puzzle difficulty be for casual vs. hardcore UFC fans?
- Should we support **timed modes** or alternate game formats beyond the daily?
- How much of the puzzle generation logic should be automated vs. curated?
- Do we eventually allow lightweight accounts (email linking) on top of anonymous IDs?

This planning document should evolve as we make implementation choices and learn from early prototypes.

