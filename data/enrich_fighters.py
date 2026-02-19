"""
Enrich fighters.json with Wikipedia data: nationality, gym/team, born_year.

Nationality: from page categories (e.g. Category:American male mixed martial artists),
with fallback to first-sentence parsing. Gym and born_year from infobox.

Reads:  data/processed/fighters.json
Writes: data/processed/fighters_enriched.json

Uses the Wikipedia API (api.wikipedia.org). No API key required.
1-second delay between requests to avoid rate limiting.
"""

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


BASE_DIR = Path(__file__).resolve().parent
PROCESSED_DIR = BASE_DIR / "processed"
FIGHTERS_JSON = PROCESSED_DIR / "fighters.json"
OUTPUT_JSON = PROCESSED_DIR / "fighters_enriched.json"

WIKI_API = "https://en.wikipedia.org/w/api.php"
REQUEST_DELAY_SEC = 1.0
USER_AGENT = "MMA-Grid-Enricher/1.0 (https://github.com/MMA-Grid; enrichment script)"


def _wiki_request(params: Dict[str, str]) -> Optional[Dict[str, Any]]:
    """GET Wikipedia API; return JSON or None."""
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def search_wikipedia(search_term: str) -> Optional[int]:
    """Search Wikipedia; return pageid of first result, or None."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": search_term,
        "srlimit": "5",
        "format": "json",
    }
    data = _wiki_request(params)
    if not data:
        return None
    results = data.get("query", {}).get("search", [])
    if not results:
        return None
    # Prefer exact or close title match (person page, not "List of..." or event)
    for hit in results:
        title = hit.get("title", "")
        if title.startswith("List of") or title.startswith("UFC Fight Night") or title.startswith("UFC "):
            continue
        return hit.get("pageid")
    return results[0].get("pageid")


# Category title pattern: "Category:American male mixed martial artists".
# Require "male" or "female" to avoid matching weight-class categories (Bantamweight, Flyweight, etc.).
NATIONALITY_CATEGORY_RE = re.compile(
    r"Category:([\w\s]+?)\s+(?:male|female)\s+mixed martial artists\s*$",
    re.IGNORECASE,
)


def get_lead_wikitext_and_categories(pageid: int) -> Tuple[Optional[str], List[str]]:
    """Fetch lead section wikitext and page categories in one API call. Returns (wikitext, category_titles)."""
    params = {
        "action": "query",
        "prop": "revisions|categories",
        "pageids": str(pageid),
        "rvprop": "content",
        "rvslots": "main",
        "rvsection": "0",
        "cllimit": "500",
        "format": "json",
    }
    data = _wiki_request(params)
    if not data:
        return None, []
    pages = data.get("query", {}).get("pages", {})
    page = pages.get(str(pageid), {})
    wikitext = None
    revs = page.get("revisions", [])
    if revs:
        slot = revs[0].get("slots", {}).get("main", {})
        wikitext = slot.get("*")
    categories = [c.get("title", "") for c in page.get("categories", []) if c.get("title")]
    return wikitext, categories


def extract_nationality_from_categories(category_titles: List[str]) -> Optional[str]:
    """Extract nationality from categories like 'Category:American male mixed martial artists'.
    Returns a single string; if multiple nationalities, joins with ', '."""
    nationalities: List[str] = []
    for title in category_titles:
        m = NATIONALITY_CATEGORY_RE.search(title)
        if m:
            nat = m.group(1).strip()
            if nat and nat not in nationalities:
                nationalities.append(nat)
    if not nationalities:
        return None
    return ", ".join(nationalities)


def extract_nationality_from_first_sentence(wikitext: str) -> Optional[str]:
    """Fallback: parse first sentence after infobox, e.g. '... is a Georgian and Spanish professional ...'."""
    if not wikitext:
        return None
    # Remove infobox block so we get the lead paragraph
    after_infobox = re.sub(
        r"\{\{Infobox\s+(?:mixed martial artist|martial artist|person|sportsperson)\s*\n.*?\n\}\}\s*",
        "",
        wikitext,
        count=1,
        flags=re.DOTALL | re.IGNORECASE,
    )
    # First sentence often: '''Name''' (born ...) is a/an Country professional ... or ... is a X and Y professional ...
    # Strip wiki markup roughly: '''...''', [[...]], {{...}}, [2] refs
    text = after_infobox
    text = re.sub(r"'''?", "", text)
    text = re.sub(r"\[\[\s*[^\]|]+\|([^\]]+)\]\]", r"\1", text)  # [[x|y]] -> y
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)  # [[x]] -> x
    text = re.sub(r"\{\{[^}]+\}\}", "", text)
    text = re.sub(r"\[\d+\]", "", text)
    # Match "is a/an X professional" or "is a X and Y professional" (nationality before "professional")
    m = re.search(
        r"\bis\s+an?\s+([A-Za-z\s]+?)(?:\s+and\s+([A-Za-z\s]+?))?\s+professional\s",
        text,
    )
    if not m:
        return None
    nats = [m.group(1).strip(), m.group(2).strip()] if m.group(2) else [m.group(1).strip()]
    nats = [n for n in nats if n and len(n) < 30]
    if not nats:
        return None
    return ", ".join(nats)


def strip_wikilinks(text: str) -> str:
    """Convert [[X]], [[X|Y]] to Y or X."""
    text = (text or "").strip()
    # [[Display|Link]] or [[Link]]
    out = []
    i = 0
    while i < len(text):
        if text[i : i + 2] == "[[":
            end = text.find("]]", i + 2)
            if end == -1:
                out.append(text[i])
                i += 1
                continue
            inner = text[i + 2 : end]
            if "|" in inner:
                out.append(inner.split("|", 1)[1].strip())
            else:
                out.append(inner.strip())
            i = end + 2
            continue
        out.append(text[i])
        i += 1
    return "".join(out).strip()


def extract_infobox_fields(wikitext: str) -> Dict[str, Any]:
    """Parse infobox in wikitext for team/gym and birth_date (year). Nationality comes from categories/first sentence."""
    result = {"gym": None, "born_year": None}
    if not wikitext:
        return result

    # Find infobox block (may be Infobox martial artist, Infobox person, etc.)
    infobox_match = re.search(
        r"\{\{Infobox\s+(?:mixed martial artist|martial artist|person|sportsperson)\s*\n(.*?)\n\}\}",
        wikitext,
        re.DOTALL | re.IGNORECASE,
    )
    block = infobox_match.group(1) if infobox_match else wikitext

    # | key = value (value is one line; stop at next \n| or \n}}
    def get_field(*keys: str) -> Optional[str]:
        for key in keys:
            pattern = rf"\|\s*{re.escape(key)}\s*=\s*(.+?)(?=\n\s*\||\n\s*\}}|\n\n|\Z)"
            m = re.search(pattern, block, re.DOTALL | re.IGNORECASE)
            if m:
                raw = m.group(1).strip()
                first_line = raw.split("\n")[0].strip()
                if first_line and not first_line.startswith("|"):
                    return first_line
        return None

    # Gym / team
    raw_team = get_field("team", "gym", "training", "camp", "current_team", "club", "fighting_out_of")
    if raw_team:
        raw_team = strip_wikilinks(raw_team).strip()
        # Strip trailing <ref...> tags
        raw_team = re.sub(r"<ref[^>]*>.*?</ref>|<ref[^/]*/>", "", raw_team, flags=re.DOTALL | re.IGNORECASE).strip()
        if raw_team and len(raw_team) < 80 and raw_team not in ("", "–", "—", "N/A") and not raw_team.startswith("|"):
            result["gym"] = raw_team

    # Birth date -> year
    raw_birth = get_field("birth_date", "born", "birth_date_and_age")
    if raw_birth:
        # {{Birth date and age|1993|07|01}} or {{birth date|1985|7|1}}
        year_match = re.search(r"\{\{(?:[Bb]irth date and age|[Bb]irth date)\|(\d{4})", raw_birth)
        if year_match:
            try:
                result["born_year"] = int(year_match.group(1))
            except ValueError:
                pass
        else:
            # Plain year or "July 1, 1993"
            four_digit = re.search(r"\b(19|20)\d{2}\b", raw_birth)
            if four_digit:
                try:
                    result["born_year"] = int(four_digit.group(0))
                except ValueError:
                    pass

    return result


def enrich_fighter(fighter: Dict[str, Any]) -> Dict[str, Any]:
    """Add nationality, gym, born_year from Wikipedia to a fighter object."""
    out = dict(fighter)
    out.setdefault("nationality", None)
    out.setdefault("gym", None)
    out.setdefault("born_year", None)

    name = (fighter.get("name") or "").strip()
    if not name:
        return out

    search_term = f"{name} MMA fighter"
    time.sleep(REQUEST_DELAY_SEC)
    pageid = search_wikipedia(search_term)
    if not pageid:
        return out

    time.sleep(REQUEST_DELAY_SEC)
    wikitext, category_titles = get_lead_wikitext_and_categories(pageid)
    if not wikitext:
        return out

    # Nationality: first from categories (e.g. Category:American male mixed martial artists), then first-sentence fallback
    nationality = extract_nationality_from_categories(category_titles)
    if nationality is None:
        nationality = extract_nationality_from_first_sentence(wikitext)
    if nationality is not None:
        out["nationality"] = nationality

    fields = extract_infobox_fields(wikitext)
    if fields.get("gym") is not None:
        out["gym"] = fields["gym"]
    if fields.get("born_year") is not None:
        out["born_year"] = fields["born_year"]

    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich fighters.json with Wikipedia data.")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N fighters (for testing).")
    args = parser.parse_args()

    if not FIGHTERS_JSON.exists():
        raise SystemExit(f"Input file not found: {FIGHTERS_JSON}")

    with open(FIGHTERS_JSON, encoding="utf-8") as f:
        fighters = json.load(f)

    if not isinstance(fighters, list):
        raise SystemExit("Expected fighters.json to be a JSON array.")

    if args.limit is not None:
        fighters = fighters[: args.limit]
        print(f"Limiting to first {len(fighters)} fighters.")

    enriched: List[Dict[str, Any]] = []
    total = len(fighters)
    for i, fighter in enumerate(fighters):
        enriched.append(enrich_fighter(fighter))
        if (i + 1) % 50 == 0:
            print(f"Enriched {i + 1}/{total}...")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(enriched)} fighters to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
