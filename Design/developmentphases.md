6. Development Phases
Phase 1 — Data & Backend Foundation (Week 1–2)

Download and clean ufcstats CSVs
Write Python enrichment script (gym, titles, bonuses)
Design PostgreSQL schema: fighters, attributes, daily_puzzles, user_scores
Set up Supabase project, import data
Build Express API with endpoints: GET /fighters/search, GET /daily/grid, GET /daily/connections, POST /score

Phase 2 — Core Game UI (Week 3–4)

Build React app scaffold with Vite
Implement the Grid game component: board rendering, fighter search/autocomplete, validation logic, score calculation
Implement the Connections game component: 4x4 grid, selection, group reveal animation, mistake counter
Wire up to API

Phase 3 — Daily Puzzle System (Week 5)

Build a simple admin script/page to generate daily puzzles (pick 9 fighters for grid, 16 for connections)
Seed the daily_puzzles table weeks in advance
Implement date-based puzzle fetching on the backend

Phase 4 — User Tracking & Stats (Week 6)

Anonymous UUID generation on frontend
Track: today's completion, streak, score history
Build a simple stats modal showing the user's streak, past scores, win rate
Share result button (generates text like the Wordle green squares)

Phase 5 — Polish & Launch (Week 7–8)

Mobile responsiveness
Dark theme + UFC-inspired color palette (red/black/gold)
Fighter headshots (use UFC.com or scrape Wikipedia images)
SEO basics, OG share images
Deploy to production