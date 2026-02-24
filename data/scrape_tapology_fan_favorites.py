"""
Scrape Tapology's fan-voted "Favorite MMA Fighters" ranking (all pages)
and save to data/processed/tapology_fan_favorites.json.

Output: list of { "rank": int, "name": str } plus a name -> best_rank map for lookup.
Run from project root: python data/scrape_tapology_fan_favorites.py
Requires: requests, beautifulsoup4
"""
import json
import re
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
OUTPUT_PATH = DATA_PROCESSED / "tapology_fan_favorites.json"

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

BASE_URL = "https://www.tapology.com/rankings/top-ten-fan-favorite-mma-and-ufc-fighters"
USER_AGENT = "MMA-Grid-Popularity/1.0 (https://github.com/MMA-Grid; Tapology fan rankings)"
DELAY_SECONDS = 1.5


def normalize_display_name(raw: str) -> str:
    """Remove nickname in quotes and extra spaces for matching to our fighter names."""
    if not raw:
        return ""
    # Remove quoted nicknames e.g. "do Bronxs" or "BJP"
    s = re.sub(r'\s*"[^"]*"\s*', " ", raw)
    return " ".join(s.split()).strip()


def parse_page(html: str) -> list[tuple[int, str]]:
    """Extract (rank, name) from one Tapology ranking page. Returns list of (rank, normalized_name)."""
    soup = BeautifulSoup(html, "html.parser")
    entries = []
    text = soup.get_text(separator="\n")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.isdigit():
            rank = int(line)
            # Next line that looks like "# Fighter Name" (possibly with "Nickname")
            j = i + 1
            while j < len(lines):
                candidate = lines[j]
                if candidate.startswith("#") and len(candidate) > 1:
                    rest = candidate.lstrip("#").strip()
                    # Skip record lines like "# 36-11-0"
                    if rest and not re.match(r"^[\d\-]+", rest) and any(c.isalpha() for c in rest):
                        name = normalize_display_name(rest)
                        if name:
                            entries.append((rank, name))
                        break
                j += 1
            i = j if j > i else i + 1
        else:
            i += 1
    return entries


def fetch_page(session: requests.Session, page: int) -> str | None:
    url = f"{BASE_URL}?ranking=2&page={page}"
    try:
        r = session.get(url, timeout=20)
        if r.status_code != 200:
            return None
        return r.text
    except Exception as e:
        print(f"Page {page} error: {e}", file=sys.stderr)
        return None


def main():
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    all_entries: list[tuple[int, str]] = []
    page = 1
    max_empty = 2
    empty = 0

    while True:
        html = fetch_page(session, page)
        if not html:
            empty += 1
            if empty >= max_empty:
                break
            page += 1
            time.sleep(DELAY_SECONDS)
            continue
        entries = parse_page(html)
        if not entries:
            empty += 1
            if empty >= max_empty:
                break
            page += 1
            time.sleep(DELAY_SECONDS)
            continue
        empty = 0
        for rank, name in entries:
            all_entries.append((rank, name))
        print(f"Page {page}: {len(entries)} fighters (total {len(all_entries)})")
        page += 1
        time.sleep(DELAY_SECONDS)

    # Build list of { rank, name } and name -> best_rank (in case of duplicates across pages)
    by_rank = [{"rank": r, "name": n} for r, n in all_entries]
    name_to_best_rank: dict[str, int] = {}
    for r, n in all_entries:
        if n and (n not in name_to_best_rank or r < name_to_best_rank[n]):
            name_to_best_rank[n] = r

    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    payload = {
        "entries": by_rank,
        "name_to_rank": name_to_best_rank,
        "meta": {"source": BASE_URL, "total_fighters": len(by_rank)},
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUTPUT_PATH}: {len(by_rank)} entries, {len(name_to_best_rank)} unique names.")


if __name__ == "__main__":
    main()
