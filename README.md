This repo allows you to visualize the weather at some selected large marathons over the last 10 years.

It is split up into data collection (data/) and frontend (app/).

To update the data, you need to do the following:

1. update `data/marathons.json` to include the new marathon or a new date

2. Run `cd data && uv run get_weather_data.py` (requires a visual crossing api key in `secrets.py`).

3. Copy `data/weather.json` to `app/public/marathon_data.json`


To run the web app:
- Prerequisites: node.js
- Install dependencies: `npm install`
- Run the app: `npm run dev`
