"""
Scrape The Scrap's "Most-Followed UFC Fighters" list (Instagram + X totals)
and save to data/processed/most_followed_fighters.json.

Source: https://www.thescrap.co/most-followed-fighters/
Used as the highest-weight signal in fighter popularity. Run from project root.
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
OUTPUT_PATH = DATA_PROCESSED / "most_followed_fighters.json"

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

URL = "https://www.thescrap.co/most-followed-fighters/"
USER_AGENT = "MMA-Grid-Popularity/1.0 (https://github.com/MMA-Grid; most-followed list)"

# Fallback list from The Scrap article (top 20 as of 2025) if scraping fails
FALLBACK_NAMES = [
    "Conor McGregor",
    "Khabib Nurmagomedov",
    "Ronda Rousey",
    "Jon Jones",
    "Anderson Silva",
    "Islam Makhachev",
    "Ilia Topuria",
    "Khamzat Chimaev",
    "Israel Adesanya",
    "Nate Diaz",
    "Charles Oliveira",
    "Francis Ngannou",
    "Georges St. Pierre",
    "Alex Pereira",
    "Dustin Poirier",
    "Max Holloway",
    "Daniel Cormier",
    "Sean O'Malley",
    "Kamaru Usman",
    "Paddy Pimblett",
]


def parse_page(html: str) -> list[dict]:
    """
    Extract fighter names (and optional follower counts) from The Scrap article.
    Article uses headings like "1. Conor McGregor — 57M+ Total Followers" and a breakdown list.
    """
    soup = BeautifulSoup(html, "html.parser")
    entries = []
    # Look for headings that match "N. Name — XM+ Total" or "N. Name"
    for tag in soup.find_all(["h2", "h3", "h4", "strong"]):
        text = (tag.get_text() or "").strip()
        if not text:
            continue
        # Pattern: "1. Conor McGregor — 57M+ Total" or "1. Conor McGregor"
        m = re.match(r"^\d+\.\s+(.+?)(?:\s*[—–-]\s*.+)?$", text)
        if m:
            name = m.group(1).strip()
            if name and len(name) > 2 and any(c.isalpha() for c in name):
                # Avoid duplicates and non-fighter lines
                if name not in [e["name"] for e in entries] and "followers" not in name.lower():
                    entries.append({"name": name, "position": len(entries) + 1})
    # Also try list items in the breakdown (e.g. "**Conor McGregor**" or "1. **Conor McGregor**")
    if len(entries) < 10:
        for li in soup.find_all("li"):
            t = (li.get_text() or "").strip()
            m = re.match(r"^(?:\d+\.\s*)?\*?\*?([A-Za-z].+?)\*?\*?\s*$", t)
            if m:
                name = m.group(1).strip()
                if 3 <= len(name) <= 50 and name not in [e["name"] for e in entries]:
                    entries.append({"name": name, "position": len(entries) + 1})
    return entries


def main():
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    entries = []
    try:
        r = session.get(URL, timeout=15)
        if r.status_code == 200:
            entries = parse_page(r.text)
        time.sleep(1)
    except Exception as e:
        print(f"Fetch error: {e}", file=sys.stderr)

    if len(entries) < 5:
        print("Scraped list too short; using fallback names.", file=sys.stderr)
        entries = [{"name": n, "position": i + 1} for i, n in enumerate(FALLBACK_NAMES)]

    names = [e["name"] for e in entries]
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)
    payload = {
        "names": names,
        "entries": entries,
        "meta": {"source": URL, "count": len(names)},
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUTPUT_PATH}: {len(names)} fighters.")


if __name__ == "__main__":
    main()
