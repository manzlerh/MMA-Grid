"""
Scrape UFC rankings from Wikipedia (https://en.wikipedia.org/wiki/UFC_rankings)
and upsert into fighter_rankings table. Fighters can appear in multiple divisions
(e.g. Men's pound-for-pound plus their weight class).

Run from project root: python data/scrape_rankings_wikipedia.py
Requires: DATABASE_URL, psycopg2 (or psycopg2-binary), python-dotenv, beautifulsoup4.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Allow running from project root or from data/
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env"

sys.path.insert(0, str(SCRIPT_DIR))
try:
    import psycopg2
    from dotenv import load_dotenv
    from bs4 import BeautifulSoup
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install psycopg2-binary python-dotenv beautifulsoup4", file=sys.stderr)
    sys.exit(1)

WIKI_API = "https://en.wikipedia.org/w/api.php"
PAGE_TITLE = "UFC rankings"
USER_AGENT = "MMA-Grid-Rankings/1.0 (https://github.com/MMA-Grid; rankings scraper)"

# Division names we care about (Wikipedia section headers)
DIVISION_HEADINGS = [
    "Men's pound-for-pound",
    "Heavyweight",
    "Light Heavyweight",
    "Middleweight",
    "Welterweight",
    "Lightweight",
    "Featherweight",
    "Bantamweight",
    "Flyweight",
    "Women's pound-for-pound",
    "Women's Bantamweight",
    "Women's Flyweight",
    "Women's Strawweight",
]


def _wiki_request(params: dict) -> dict | None:
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Wikipedia request failed: {e}", file=sys.stderr)
        return None


def fetch_rankings_html() -> str | None:
    """Fetch UFC rankings page parsed HTML from Wikipedia API."""
    data = _wiki_request({
        "action": "parse",
        "page": PAGE_TITLE,
        "prop": "text",
        "format": "json",
    })
    if not data:
        return None
    parse = data.get("parse") or {}
    text = parse.get("text") or {}
    return text.get("*")


def _normalize_rank(raw: str) -> str:
    """Normalize rank cell to C, IC, or 1-15. E.g. '14 (T)' -> '14'."""
    raw = (raw or "").strip().upper()
    if raw == "C":
        return "C"
    if raw in ("IC", "I.C."):
        return "IC"
    m = re.match(r"^(\d+)", raw.replace("(T)", "").strip())
    if m:
        return m.group(1)
    return raw


def _normalize_fighter_name(raw: str) -> str:
    """Strip disambiguation like ' (fighter)' from Wikipedia link text."""
    if not raw:
        return ""
    name = raw.strip()
    for suffix in (" (fighter)", " (fighter)"):
        if name.endswith(suffix):
            name = name[: -len(suffix)].strip()
    return name


def _find_fighter_cell(tds: list) -> str | None:
    """From a row's td elements, find the one that looks like a fighter name (link to wiki person)."""
    for td in tds:
        a = td.find("a", href=True)
        if not a:
            continue
        href = (a.get("href") or "")
        if "/wiki/" not in href or "UFC_" in href or "List_of" in href or "Category:" in href:
            continue
        text = (a.get_text() or "").strip()
        if not text or len(text) < 2:
            continue
        # Likely fighter name: title case, not a single letter
        if text and text[0].isupper():
            return _normalize_fighter_name(text)
    return None


def extract_rankings(html_or_text: str) -> list[tuple[str, str, str]]:
    """
    Parse page content (Wikipedia returns HTML or text). Extract (division, rank_position, fighter_name).
    Handles both HTML tables and the API's text format (newline-separated cells).
    """
    # Try HTML first (e.g. from REST /html or if API returns HTML)
    if "<table" in html_or_text or "<td" in html_or_text:
        return _extract_rankings_html(html_or_text)
    return _extract_rankings_text(html_or_text)


def _extract_rank_from_row(tds: list) -> str | None:
    """Get rank from any cell in the row (Wikipedia often uses rowspan so first cell can be empty)."""
    for td in tds:
        raw = (td.get_text() or "").strip()
        rank = _normalize_rank(raw)
        if rank and rank.upper() not in ("RANK", "RESULT"):
            if rank in ("C", "IC") or (rank.isdigit() and 1 <= int(rank) <= 15):
                return rank
    return None


def _extract_rankings_html(html: str) -> list[tuple[str, str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for heading in soup.find_all(["h2", "h3"]):
        div_name = (heading.get_text() or "").strip()
        if div_name not in DIVISION_HEADINGS:
            continue
        table = heading.find_next("table", class_="wikitable")
        if not table:
            continue
        rank_counter = 1  # fallback when rank cell is empty (rowspan)
        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 2:
                continue
            rank = _extract_rank_from_row(tds) or str(rank_counter)
            if rank.isdigit():
                rank_counter = int(rank) + 1
            fighter = _find_fighter_cell(tds)
            if fighter:
                results.append((div_name, rank, fighter))
    return results


# Rank pattern: C, IC, or digit(s) optionally followed by (T)
_RANK_RE = re.compile(r"^(C|IC|\d+)\s*(?:\(T\))?\s*$", re.IGNORECASE)

# Country/ISO tokens that may appear between rank and fighter in text (skip them)
_SKIP_COUNTRY_TOKENS = frozenset((
    "Russia", "England", "Georgia (country)", "United Arab Emirates", "Australia", "Brazil",
    "United States", "Myanmar", "South Africa", "Armenia", "France", "Czech Republic", "New Zealand",
    "Poland", "Moldova", "Croatia", "Dominican Republic", "Bahrain", "Switzerland", "Uzbekistan",
    "Austria", "China", "Nigeria", "Republic of Ireland", "Ecuador", "Mexico", "Morocco", "Argentina",
    "Azerbaijan", "Kyrgyzstan", "Portugal", "Japan", "Iraq", "Kazakhstan", "Canada", "Panama",
    "Scotland", "Netherlands", "Uganda",
))


def _extract_rankings_text(text: str) -> list[tuple[str, str, str]]:
    """
    Parse Wikipedia API text format: sections like "Men's pound-for-pound [ edit]"
    then blocks " \n 1\n \n \n \n Fighter Name \n \n Record\n".
    """
    results = []
    current_division = None
    # Split into tokens (strip, non-empty segments)
    lines = [s.strip() for s in text.split("\n")]
    i = 0
    while i < len(lines):
        line = lines[i]
        # Section heading (e.g. "Men's pound-for-pound [ edit]")
        for div in DIVISION_HEADINGS:
            if line.startswith(div) or line == div:
                current_division = div
                break
        if current_division:
            # Rank token: "1", "C", "IC", "14 (T)"
            if _RANK_RE.match(line):
                rank = _normalize_rank(line)
                # Next non-empty that looks like a fighter name (skip ISO country, headers, record).
                j = i + 1
                while j < len(lines):
                    candidate = lines[j]
                    if not candidate:
                        j += 1
                        continue
                    if candidate in ("Rank", "ISO", "Fighter", "Record", "M", "Win streak", "Weight class", "Status", "Next fight", "Event", "Opponent", "Ref.", "Result", "Last fight", "TBD"):
                        j += 1
                        continue
                    if re.match(r"^\d+[–\-]\d+", candidate):  # record like "28–1"
                        j += 1
                        continue
                    if candidate in _SKIP_COUNTRY_TOKENS:
                        j += 1
                        continue
                    name = _normalize_fighter_name(candidate)
                    if len(name) >= 3 and name[0].isupper() and not name.isdigit():
                        if not name.startswith("See also") and "weight" not in name.lower():
                            results.append((current_division, rank, name))
                            break
                    j += 1
        i += 1
    return results


def get_conn():
    load_dotenv(ENV_PATH)
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL not set in .env")
    return psycopg2.connect(url)


def ensure_rankings_table(conn) -> None:
    """Create fighter_rankings table if it does not exist (for DBs created before schema had it)."""
    sql = """
    CREATE TABLE IF NOT EXISTS fighter_rankings (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fighter_id     UUID NOT NULL REFERENCES fighters (id) ON DELETE CASCADE,
        division       TEXT NOT NULL,
        rank_position  TEXT NOT NULL,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (fighter_id, division)
    );
    CREATE INDEX IF NOT EXISTS idx_fighter_rankings_fighter_id ON fighter_rankings (fighter_id);
    CREATE INDEX IF NOT EXISTS idx_fighter_rankings_division ON fighter_rankings (division);
    """
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()


def build_name_to_id(conn) -> dict[str, str]:
    """Return map of fighter name -> uuid string."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM fighters")
        return {row[1]: str(row[0]) for row in cur.fetchall()}


def upsert_rankings(conn, rows: list[tuple[str, str, str]], name_to_id: dict[str, str]) -> tuple[int, int]:
    """
    Upsert (division, rank_position, fighter_name) into fighter_rankings.
    Returns (inserted_or_updated, skipped_not_found).
    """
    sql = """
    INSERT INTO fighter_rankings (fighter_id, division, rank_position, updated_at)
    VALUES (%s, %s, %s, now())
    ON CONFLICT (fighter_id, division)
    DO UPDATE SET rank_position = EXCLUDED.rank_position, updated_at = EXCLUDED.updated_at
    """
    done = 0
    skipped = 0
    with conn.cursor() as cur:
        for division, rank_pos, fighter_name in rows:
            fighter_id = name_to_id.get(fighter_name)
            if not fighter_id:
                skipped += 1
                continue
            cur.execute(sql, (fighter_id, division, rank_pos))
            done += 1
    conn.commit()
    return done, skipped


def main() -> None:
    print("Fetching UFC rankings from Wikipedia...")
    html = fetch_rankings_html()
    if not html:
        sys.exit(1)

    rows = extract_rankings(html)
    print(f"Extracted {len(rows)} ranking entries.")

    load_dotenv(ENV_PATH)
    conn = get_conn()
    try:
        ensure_rankings_table(conn)
        name_to_id = build_name_to_id(conn)
        done, skipped = upsert_rankings(conn, rows, name_to_id)
        print(f"Upserted {done} fighter_rankings rows; skipped {skipped} (fighter name not in DB).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
