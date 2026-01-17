export interface WeatherPoint {
  datetime: string; // "HH:mm:ss"
  temp: number; // Fahrenheit
  dew: number; // Fahrenheit
  windspeed: number;
  conditions: string;
}

export interface HistoryYear {
  year: number;
  date: string;
  startTimeMass: string;
  startTimeEliteMen?: string;
  startTimeEliteWomen?: string;
  startTimeElite?: string;
  weather: WeatherPoint[];
}

export interface MarathonData {
  race: string;
  location: string;
  history: HistoryYear[];
}