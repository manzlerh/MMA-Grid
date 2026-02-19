Primary Source: ufcstats.com + a custom scraper
The GitHub repo Greco1899/scrape_ufc_stats is your best starting point — it scrapes all UFC events, fight stats, and fighter details from ufcstats.com into clean CSVs (ufc_fighter_details.csv, ufc_fight_results.csv, etc.). It's even deployed on GCP and runs daily, keeping CSVs up to date in the repo itself, so you can just download them without running any code. GitHub
What you get from ufcstats.com:

Fighter name, nickname, nationality, height, weight, reach, stance
Weight class(es) fought in
Win/loss record, finish method breakdown (KO, Sub, Decision)
Complete fight history (opponents, events, rounds, method)

What you'll need to enrich manually or from other sources:

Team/gym affiliation (Jackson-Wink, American Top Team, etc.)
Country of origin / nationality (sometimes available)
Championship history (title wins, reigns)
Fight of the Night / Performance bonuses

For enrichment, the Python ufc package (FritzCapuyan/ufc-api) can pull structured data per fighter including nationality, association/gym, and detailed fight history from Sherdog GitHub, which complements ufcstats well.
Your data pipeline approach:

Download the pre-scraped CSVs from Greco1899's repo as your initial seed
Write a Python enrichment script (using BeautifulSoup + the ufc-api) to add gym affiliation, bonuses, and title history
Import the cleaned data into your app's database
Set up a weekly cron job to re-scrape and update the DB with new fighters/fights

Key attributes to store per fighter (these power the games):

name, nickname
nationality / country
weight_class (should include if they've fought at multiple, indicate primary/current weightclass vs. others)
gym / team 
titles (current/former/never, which belt exactly e.g. interim lightweight, undisputed heavyweight)
finish_method_primary (striker, grappler, etc.)
ufc_active_years (year of their debut to year of retirement / active)
win_streak_peak, total_fights
bonus_awards (FOTN, POTN, KOTN, SOTN)
fight_history[] — array of fights (fights should have own schema including event, fighters, result, etc.)