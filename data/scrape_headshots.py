"""
Scrape fighter headshot image URLs from UFC.com (and Tapology as fallback)
and add image_url to each fighter in data/processed/fighters_final.json.

Run from project root: python data/scrape_headshots.py [--limit N]
Requires: requests, beautifulsoup4
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
FIGHTERS_PATH = DATA_PROCESSED / "fighters_final.json"
ERROR_LOG_PATH = SCRIPT_DIR / "headshot_errors.log"

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError as e:
    print(f"Missing dependency: {e}. Install with: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

USER_AGENT = "MMA-Grid-Headshots/1.0 (https://github.com/MMA-Grid; headshot scraper)"
DELAY_SECONDS = 2
UFC_BASE = "https://www.ufc.com/athlete"
TAPOLOGY_BASE = "https://www.tapology.com/fightcenter/fighters"


def slug_from_name(name: str) -> str:
    """Build URL slug: lowercase, spaces to hyphens, strip special chars (ASCII-only)."""
    if not name or not isinstance(name, str):
        return ""
    # Normalize unicode to decomposed form and drop combining chars -> ASCII where possible
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = n.encode("ascii", "ignore").decode("ascii")
    n = re.sub(r"[^a-z0-9\s-]", "", n.lower())
    n = re.sub(r"[-\s]+", "-", n).strip("-")
    return n


def _normalize_src(src: str) -> str | None:
    if not src or not src.strip():
        return None
    src = src.strip()
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return "https://www.ufc.com" + src
    return src if src.startswith("http") else None


def _url_matches_fighter(url: str, fighter_slug: str) -> bool:
    """True if the URL path/filename identifies this fighter. UFC uses LASTNAME_FIRSTNAME
    in image filenames (e.g. POIRIER_DUSTIN, HOLLOWAY_MAX), not the page slug (dustin-poirier).
    """
    if not fighter_slug:
        return False
    url_lower = url.lower()
    if fighter_slug.lower() in url_lower:
        return True
    parts = fighter_slug.split("-")
    if len(parts) >= 2:
        ufc_style = (parts[-1] + "_" + parts[0]).lower()
        if ufc_style in url_lower:
            return True
    elif parts:
        if parts[0] in url_lower:
            return True
    return False


def extract_ufc_headshot(html: str, page_url: str, fighter_slug: str) -> str | None:
    """Parse UFC athlete page HTML and return the main headshot image src, or None.
    For event_results_athlete_headshot images (Last Fight section): if the first URL
    doesn't contain the fighter's slug, use the second (page athlete is blue corner).
    """
    soup = BeautifulSoup(html, "html.parser")
    event_headshots = []  # event_results_athlete_headshot, in document order
    profile_candidates = []  # athlete_bio, hero, cloudfront, etc.

    for tag in soup.find_all("img", src=True):
        src = tag.get("src")
        if not src:
            continue
        full = _normalize_src(src)
        if not full:
            continue
        if "event_results_athlete_headshot" in full:
            event_headshots.append(full)
            continue
        if "athlete_bio" in full or "ufc.com/images" in full or "cloudfront" in full:
            profile_candidates.append(full)
        classes = " ".join(tag.get("class", []) if tag.get("class") else [])
        if "hero" in classes or "athlete" in classes:
            profile_candidates.append(full)

    # Last Fight section: first headshot = red corner (often opponent), second = page athlete.
    if len(event_headshots) >= 2:
        if _url_matches_fighter(event_headshots[0], fighter_slug):
            return event_headshots[0]
        return event_headshots[1]
    if len(event_headshots) == 1 and _url_matches_fighter(event_headshots[0], fighter_slug):
        return event_headshots[0]

    if profile_candidates:
        return profile_candidates[0]

    hero_div = soup.find("div", class_=lambda c: c and "hero-profile" in " ".join(c))
    if hero_div:
        img = hero_div.find("img", src=True)
        if img:
            u = _normalize_src(img["src"])
            if u:
                return u

    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return _normalize_src(og["content"])

    return None


def extract_tapology_headshot(html: str) -> str | None:
    """Parse Tapology fighter page and return profile image src, or None."""
    soup = BeautifulSoup(html, "html.parser")
    # Common patterns: img in profile header or with fighter/avatar class
    for tag in soup.find_all("img", class_=True):
        classes = " ".join(tag.get("class", []))
        if "fighter" in classes or "avatar" in classes or "profile" in classes or "headshot" in classes:
            src = tag.get("src")
            if src and src.startswith("http"):
                return src
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return og["content"]
    return None


def fetch_headshot(fighter: dict, session: requests.Session, log_errors: list) -> str | None:
    """Try UFC then Tapology; return image URL or None."""
    name = fighter.get("name") or ""
    slug = slug_from_name(name)
    if not slug:
        log_errors.append(f"{name!r}: empty slug")
        return None

    # UFC
    ufc_url = f"{UFC_BASE}/{slug}"
    try:
        r = session.get(ufc_url, timeout=15)
        if r.status_code == 404:
            # Fallback: Tapology
            tap_url = f"{TAPOLOGY_BASE}/{slug}"
            try:
                r2 = session.get(tap_url, timeout=15)
                if r2.status_code == 200:
                    url = extract_tapology_headshot(r2.text)
                    if url:
                        return url
                log_errors.append(f"{name!r}: Tapology no image (status={r2.status_code})")
            except Exception as e:
                log_errors.append(f"{name!r}: Tapology error {e}")
            return None
        if r.status_code != 200:
            log_errors.append(f"{name!r}: UFC status {r.status_code}")
            return None
        url = extract_ufc_headshot(r.text, ufc_url, slug)
        if url:
            return url
        log_errors.append(f"{name!r}: UFC page OK but no headshot found")
    except Exception as e:
        log_errors.append(f"{name!r}: UFC error {e}")

    return None


def main():
    parser = argparse.ArgumentParser(description="Scrape fighter headshot URLs into fighters_final.json")
    parser.add_argument(
        "--limit", "-n",
        type=int,
        default=None,
        metavar="N",
        help="Process only the first N fighters (for testing)",
    )
    args = parser.parse_args()

    if not FIGHTERS_PATH.exists():
        print(f"Not found: {FIGHTERS_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(FIGHTERS_PATH, encoding="utf-8") as f:
        fighters = json.load(f)
    if not isinstance(fighters, list):
        fighters = [fighters]

    to_process = fighters
    if args.limit is not None:
        if args.limit < 1:
            print("--limit must be >= 1", file=sys.stderr)
            sys.exit(1)
        to_process = fighters[: args.limit]
        print(f"Limiting to first {len(to_process)} fighters")

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    errors = []
    total = len(to_process)
    for i, fighter in enumerate(to_process):
        if (i + 1) % 25 == 0:
            print(f"Progress: {i + 1}/{total}")

        url = fetch_headshot(fighter, session, errors)
        fighter["image_url"] = url if url else None

        if i < total - 1:
            time.sleep(DELAY_SECONDS)

    with open(FIGHTERS_PATH, "w", encoding="utf-8") as f:
        json.dump(fighters, f, indent=2, ensure_ascii=False)

    if errors:
        with open(ERROR_LOG_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(errors))
        print(f"Logged {len(errors)} failures to {ERROR_LOG_PATH}")

    print(f"Done. Updated {total} fighters. Re-run import_to_db.py to push image_url to the database.")


if __name__ == "__main__":
    main()
