import { MarathonData } from './types';

export async function fetchMarathonData(): Promise<MarathonData[]> {
  const response = await fetch('marathon_data.json');
  const data: MarathonData[] = await response.json();
  return data;
}

export const getSortedMarathonData = async (): Promise<MarathonData[]> => {
    const data = await fetchMarathonData();
    return data.sort((a, b) => {
        // Sort based on the month of the most recent/upcoming race date (index 0)
        const dateA = new Date(a.history[0].date);
        const dateB = new Date(b.history[0].date);
        return dateA.getMonth() - dateB.getMonth();
    });
};
