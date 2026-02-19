┌─────────────────────────────────────────────────────┐
│                    Frontend                          │
│         React + Vite (SPA)  ←→  Tailwind CSS        │
│   Game UI | Daily Puzzle | Stats Dashboard           │
└────────────────────┬────────────────────────────────┘
                     │ REST API calls
┌────────────────────▼────────────────────────────────┐
│                   Backend                            │
│          Node.js + Express (or Fastify)              │
│   /api/daily-grid  /api/daily-connections            │
│   /api/validate    /api/leaderboard                  │
└────────┬───────────────────────────┬────────────────┘
         │                           │
┌────────▼──────┐          ┌─────────▼──────────┐
│  PostgreSQL   │          │   Redis (optional)  │
│  (fighters,   │          │   (daily puzzle     │
│   puzzles,    │          │    caching)         │
│   scores)     │          └────────────────────┘
└───────────────┘
         │
┌────────▼──────────────────┐
│   Data Scripts (Python)   │
│   Scraper + Enricher      │
│   Runs weekly via cron    │
└───────────────────────────┘