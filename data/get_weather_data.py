import urllib.request
import urllib.parse
import json
import secrets
import os

# Base URL for the Visual Crossing API
BASE_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"

# API key for the Visual Crossing API
API_KEY = secrets.VISUAL_CROSSING_API_KEY

MARATHONS_JSON_PATH = "marathons.json"

def get_weather_data(location, date):
    """
    Fetch weather data from Visual Crossing API.
    
    Args:
        location: Location string e.g. "London, UK"
        date: Date in YYYY-MM-DD format e.g. "2019-04-19"
    
    Returns:
        dict: JSON response from the API
    """
    
    # URL encode the location string
    encoded_location = urllib.parse.quote(location)
    
    # Build query parameters
    params = {
        "unitGroup": "us",
        "include": "hours",
        "key": API_KEY,
        "contentType": "json"
    }
    query_string = urllib.parse.urlencode(params)

    # Construct the full URL
    full_url = f"{BASE_URL}{encoded_location}/{date}?{query_string}"
    
    # Make the request
    with urllib.request.urlopen(full_url) as response:
        return json.loads(response.read().decode('utf-8'))


def extract_weather_fields(weather_data):
    """
    Extract only specific fields from the weather API response.
    """
    extracted_data = []
    
    # The API returns data in a "days" array
    assert len(weather_data["days"]) == 1, "Expected 1 day of data"
    day_data = weather_data["days"][0]
    
    for hour in day_data["hours"]:
        extracted_data.append({
            "datetime": hour.get("datetime", ""),
            "temp": hour.get("temp"),
            "dew": hour.get("dew"),
            "windspeed": hour.get("windspeed"),
            "conditions": hour.get("conditions", "")
        })
    return extracted_data


def load_marathons():
    """
    Load marathon data from JSON file.
    
    Args:
        json_path: Path to the marathons JSON file
    
    Returns:
        list: List of marathon dictionaries
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(script_dir, MARATHONS_JSON_PATH)
    
    with open(json_file, 'r') as f:
        return json.load(f)


def fetch_all_marathon_weather(marathons):
    """
    Fetch weather data for all marathon history.
    
    Args:
        marathons: List of marathon dictionaries with name, location, and history
    
    Returns:
        list: List of dictionaries containing marathon info along with weather data
    """    
    results = []
    
    for marathon in marathons:
        marathon_name = marathon["name"]
        location = marathon["location"]
        
        print(f"Processing {marathon_name}...")
        
        for event in marathon["history"]:
            date = event["date"]
            
            print(f"  Fetching weather for {date}...")
            weather_data = get_weather_data(location, date)
            
            # Extract only the specified fields
            extracted_weather = extract_weather_fields(weather_data)
            
            results.append({
                "marathon": marathon_name,
                "location": location,
                "date": date,
                "weather": extracted_weather
            })
            print(f"  ✓ Successfully fetched weather for {date}")
    
    return results


def main():
    """Main function to fetch weather data for all marathons."""
    marathons = load_marathons()
    
    results = fetch_all_marathon_weather(marathons)
    
    print(f"\n✓ Completed fetching weather data for {len(results)} events")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
