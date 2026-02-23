"""
Scrape UFC performance bonuses from ufcstats.com event pages (Option 1).
Uses requests + BeautifulSoup. Saves to data/raw/ufc_bonuses.csv.
Run from project root: python data/scrape_bonuses_ufcstats.py [--limit N]
"""
import argparse
import csv
import re
import time
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SCRIPT_DIR = Path(__file__).resolve().parent
RAW_DIR = SCRIPT_DIR / "raw"
OUTPUT_CSV = RAW_DIR / "ufc_bonuses.csv"
ERROR_LOG = SCRIPT_DIR / "bonus_scrape_errors.log"
EVENTS_LIST_URL = "http://www.ufcstats.com/statistics/events/completed?page=all"
DELAY_SEC = 1.5
PROGRESS_EVERY = 50

# Bonus icon filename -> bonus_type (img src often contains these)
BONUS_IMG_MAP = {
    "perf.png": "PERF",
    "fight.png": "FIGHT",
    "sub.png": "SUB",
    "ko.png": "KO",
}
# Title/alt text fallbacks (case-insensitive)
BONUS_TITLE_PATTERNS = [
    (r"performance\s+of\s+the\s+night", "PERF"),
    (r"fight\s+of\s+the\s+night", "FIGHT"),
    (r"submission\s+of\s+the\s+night", "SUB"),
    (r"ko\s+of\s+the\s+night", "KO"),
]

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0"


def log_error(msg: str) -> None:
    with open(ERROR_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def get_event_urls(session: requests.Session) -> list[str]:
    """Fetch completed events page and extract all event-details URLs."""
    urls = []
    try:
        r = session.get(EVENTS_LIST_URL, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if "event-details" in href and href not in urls:
                full = href if href.startswith("http") else "http://www.ufcstats.com" + (href if href.startswith("/") else "/" + href)
                urls.append(full)
    except Exception as e:
        log_error(f"Events list: {e}")
    return urls


def parse_bonus_types_from_row(row_soup) -> list[str]:
    """Find bonus types in a table row: only from img src (perf.png etc.) or img title/alt.
    Do NOT match on class names — table/row classes like b-fight-details contain 'fight' and
    would incorrectly add FIGHT to every row."""
    found = []
    for img in row_soup.find_all("img", src=True):
        src = (img.get("src") or "").lower()
        for key, bonus in BONUS_IMG_MAP.items():
            if key in src and bonus not in found:
                found.append(bonus)
        title = (img.get("title") or img.get("alt") or "").lower()
        for pattern, bonus in BONUS_TITLE_PATTERNS:
            if re.search(pattern, title) and bonus not in found:
                found.append(bonus)
    return found


def extract_fighter_links(row_soup) -> list[str]:
    """Get fighter names from links to fighter-details in this row."""
    names = []
    for a in row_soup.find_all("a", href=True):
        if "fighter-details" not in a.get("href", ""):
            continue
        text = (a.get_text() or "").strip()
        if text and text != "win" and text != "loss":
            names.append(text)
    return names[:2]  # at most two fighters per row


def get_winner_from_row(row_soup) -> int | None:
    """Return 0 if first fighter won, 1 if second, None if unclear. W/L column often has 'win' in first cell."""
    first_cell = row_soup.find("td")
    if not first_cell:
        return None
    text = (first_cell.get_text() or "").strip().lower()
    if "win" in text:
        return 0
    if "loss" in text:
        return 1
    return 0  # assume first is winner if no W/L


def scrape_event_page(session: requests.Session, url: str) -> list[dict]:
    """
    Scrape one event page. Return list of bonus records: {fighter_name, bonus_type, event_name, event_date}.
    Handles both: one row per fight (two fighter links in row) and two rows per fight (winner row, loser row).
    """
    records = []
    event_name = ""
    event_date = ""
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # Event title and date from page header
        for h2 in soup.find_all("h2"):
            cl = h2.get("class") or []
            if "b-content" in " ".join(cl):
                event_name = (h2.get_text() or "").strip()
                break
        for tag in soup.find_all(["span", "p"]):
            cl = tag.get("class") or []
            if "date" in " ".join(cl).lower():
                t = (tag.get_text() or "").strip()
                if t and re.match(r"[\w]+\s+\d{1,2},?\s+\d{4}", t):
                    event_date = t
                    break
        if not event_date and event_name:
            # Sometimes date is in same block as title
            for p in soup.find_all("p", class_=lambda c: c and "b-content" in " ".join(c)):
                t = (p.get_text() or "").strip()
                m = re.search(r"(\w+\s+\d{1,2},?\s+\d{4})", t)
                if m:
                    event_date = m.group(1)
                    break

        # Find fight table (ufcstats uses b-fight-details__table or similar)
        table = soup.find("table", class_=lambda c: c and "b-fight-details" in " ".join(c))
        if not table:
            table = soup.find("table")
        if not table:
            return records

        rows = [tr for tr in table.find_all("tr") if not tr.find_all("th")]
        i = 0
        while i < len(rows):
            tr = rows[i]
            fighters = extract_fighter_links(tr)
            bonus_types = parse_bonus_types_from_row(tr)

            # Two rows per fight: this row has one fighter, next row has the other
            if len(fighters) == 1 and i + 1 < len(rows):
                next_fighters = extract_fighter_links(rows[i + 1])
                next_bonus = parse_bonus_types_from_row(rows[i + 1])
                if len(next_fighters) == 1:
                    winner_idx = 0 if get_winner_from_row(tr) == 0 else 1
                    f1, f2 = fighters[0], next_fighters[0]
                    winner_name = f1 if winner_idx == 0 else f2
                    loser_name = f2 if winner_idx == 0 else f1
                    all_bonus = list(dict.fromkeys(bonus_types + next_bonus))
                    for bt in all_bonus:
                        if bt == "FIGHT":
                            records.append({"fighter_name": winner_name, "bonus_type": "FIGHT", "event_name": event_name, "event_date": event_date})
                            records.append({"fighter_name": loser_name, "bonus_type": "FIGHT", "event_name": event_name, "event_date": event_date})
                        else:
                            records.append({"fighter_name": winner_name, "bonus_type": bt, "event_name": event_name, "event_date": event_date})
                    i += 2
                    continue
            # One row per fight: two fighter links in same row
            if len(fighters) >= 2 and bonus_types:
                winner_idx = get_winner_from_row(tr) if get_winner_from_row(tr) is not None else 0
                winner_name = fighters[winner_idx]
                loser_name = fighters[1 - winner_idx]
                for bt in bonus_types:
                    if bt == "FIGHT":
                        records.append({"fighter_name": winner_name, "bonus_type": "FIGHT", "event_name": event_name, "event_date": event_date})
                        records.append({"fighter_name": loser_name, "bonus_type": "FIGHT", "event_name": event_name, "event_date": event_date})
                    else:
                        records.append({"fighter_name": winner_name, "bonus_type": bt, "event_name": event_name, "event_date": event_date})
            i += 1
    except Exception as e:
        log_error(f"Event {url}: {e}")
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape UFC bonuses from ufcstats.com event pages.")
    parser.add_argument("--limit", type=int, default=None, help="Limit to first N events (for testing).")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    if ERROR_LOG.exists():
        ERROR_LOG.unlink()  # fresh log each run

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    print("Step 1 — Fetching event list...")
    event_urls = get_event_urls(session)
    if args.limit:
        event_urls = event_urls[: args.limit]
        print(f"Limited to first {args.limit} events.")
    print(f"Found {len(event_urls)} event URLs.")

    all_records = []
    total = len(event_urls)
    for i, url in enumerate(event_urls):
        try:
            recs = scrape_event_page(session, url)
            all_records.extend(recs)
            if (i + 1) % PROGRESS_EVERY == 0:
                print(f"Scraped {i + 1}/{total} events, {len(all_records)} bonuses found so far.")
        except Exception as e:
            log_error(f"Event {url}: {e}")
        time.sleep(DELAY_SEC)

    print(f"Step 2 — Done. Total bonuses: {len(all_records)}.")

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["fighter_name", "bonus_type", "event_name", "event_date"])
        w.writeheader()
        w.writerows(all_records)
    print(f"Saved {OUTPUT_CSV}.")

    if ERROR_LOG.exists() and ERROR_LOG.stat().st_size > 0:
        print(f"Errors logged to {ERROR_LOG}.")


if __name__ == "__main__":
    main()
