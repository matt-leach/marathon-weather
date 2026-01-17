This repo allows you to visualize the weather at some selected large marathons over the last 10 years.

It is split up into data collection (data/) and frontend (app/).

To update the data, you need to:
- update data/marathons.json to include the new marathon or new date
- run get_weather_data.py (requires a visual crossing api key in secrets.py)
- copy data/weather.json to app/marathon_data.
