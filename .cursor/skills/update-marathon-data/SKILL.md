---
name: update-marathon-data
description: >-
  Keep marathon weather data current as time passes. Compares the editions in
  data/marathons.json against real-world races that have actually happened,
  adds any missing/updated editions with verified dates, runs the Visual
  Crossing fetch pipeline, and syncs data to the frontend. Use when updating
  marathon weather data, backfilling past races, refreshing after race day, or
  when the user asks to add missing marathon data.
---

# Update Marathon Data

`data/marathons.json` is the source of truth for which races and editions exist. This skill reconciles it with races that have actually taken place, then fetches weather for the new editions.

Data flow: `marathons.json` (edit here) → `get_weather_data.py` → `weather.json` → copy to `app/public/marathon_data.json` (served to the app).

## Workflow

**1. Find current coverage.** Read `data/marathons.json`. For each marathon, note the newest `date` in `history` (sorted newest-first).

**2. Find missing editions.** For each marathon, any annual edition that should have run between the latest recorded one and today is a candidate. Confirm via web search / official sources: whether it took place, the **actual date** (YYYY-MM-DD), start times, and any cancellation/postponement. Only add editions strictly before today — never future ones. If everything is up to date, tell the user and stop.

**3. Add editions to `data/marathons.json`.** Only edit when an edition is missing or has wrong metadata. Keep `history` sorted newest-first. Verify against official sources first. Entry shape:

```json
{
  "year": 2025,
  "date": "2025-04-21",
  "startTimeMass": "10:00",
  "startTimeEliteMen": "09:37",
  "startTimeEliteWomen": "09:47"
}
```

Start times are `HH:MM`. For cancelled/postponed years, set `date` and all start times to `null` and add a `"note"`.

Double-check each edition's start times against official race sources — they shift year to year and getting them wrong throws off the weather lookup.

**4. Fetch weather.** Needs a Visual Crossing API key in `data/secrets.py` (gitignored: `VISUAL_CROSSING_API_KEY = "..."`); if missing, ask the user. Then run:

```bash
cd data && uv run get_weather_data.py
```

The script reads `marathons.json`, skips cancelled events (`date: null`), reuses existing weather (one API call per new date), and writes `data/weather.json`. Report which editions were fetched.

**5. Sync to frontend.**

```bash
cp data/weather.json app/public/marathon_data.json
```

No code changes needed for data-only updates.

**6. Verify.** Confirm the added editions have a `weather` block in both `data/weather.json` and `app/public/marathon_data.json`. Optionally spot-check with `cd app && npm run dev`.

## Key files

| File | Role |
|------|------|
| `data/marathons.json` | Race catalog: dates, start times, timezones (edit to add editions) |
| `data/get_weather_data.py` | Visual Crossing fetch pipeline |
| `data/weather.json` | Generated weather dataset |
| `data/secrets.py` | API key (gitignored, must exist locally) |
| `app/public/marathon_data.json` | Data served to the visualization |
