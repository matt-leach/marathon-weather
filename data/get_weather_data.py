import urllib.request
import urllib.parse
import json
import secrets

# Base URL for the Visual Crossing API
BASE_URL = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"

# API key for the Visual Crossing API
API_KEY = secrets.VISUAL_CROSSING_API_KEY

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


def main():
    """Main function to fetch and display weather data."""
    try:
        weather_data = get_weather_data("London, UK", "2019-04-19")
        print("Weather data retrieved successfully!")
        print(json.dumps(weather_data, indent=2))
    except Exception as e:
        print(f"Error fetching weather data: {e}")


if __name__ == "__main__":
    main()
