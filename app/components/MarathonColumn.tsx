import React from 'react';
import { MarathonData } from '../types';
import { TemperatureChart } from './TemperatureChart';
import { YearlyBubbleChart } from './YearlyBubbleChart';
import { TimeMode, Metric, Unit, ViewMode } from '../App';

interface MarathonColumnProps {
  data: MarathonData;
  duration: number;
  tempDomain: [number, number];
  timeMode: TimeMode;
  massOffset: number;
  metric: Metric;
  unit: Unit;
  viewMode: ViewMode;
}

const getCountryFlag = (location: string) => {
    if (location.includes('USA')) return '🇺🇸';
    if (location.includes('Japan')) return '🇯🇵';
    if (location.includes('UK')) return '🇬🇧';
    if (location.includes('Germany')) return '🇩🇪';
    if (location.includes('Australia')) return '🇦🇺';
    if (location.includes('Spain')) return '🇪🇸';
    if (location.includes('Netherlands')) return '🇳🇱';
    return '';
};

export const MarathonColumn: React.FC<MarathonColumnProps> = ({
    data,
    duration,
    tempDomain,
    timeMode,
    massOffset,
    metric,
    unit,
    viewMode
}) => {
  // Get the month from the most recent/upcoming race date
  const month = new Date(data.history[0].date).toLocaleString('default', { month: 'long' });
  const flag = getCountryFlag(data.location);

  // Calculate year range for hourly legend
  const years = data.history.map(h => h.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const footnote = (() => {
    if (viewMode !== 'yearly') return null;
    if (data.race.includes('London')) {
        return '* Held in October (2020–22) due to the pandemic.';
    }
    if (data.race.includes('Boston')) {
        return '* The 2021 race was held in October due to the pandemic.';
    }
    return null;
  })();

  return (
    <section className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="border-t-2 border-ink pt-3 mb-1">
        <h2 className="font-serif text-xl font-semibold tracking-tight leading-snug">
            {data.race}
        </h2>
        <div className="mt-0.5 text-xs text-stone-600">
            {data.location.split(',')[0]}{flag ? ` ${flag}` : ''} · {month}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative">
         {viewMode === 'hourly' ? (
             <TemperatureChart
                history={data.history}
                duration={duration}
                minTemp={tempDomain[0]}
                maxTemp={tempDomain[1]}
                timeMode={timeMode}
                massOffset={massOffset}
                metric={metric}
                unit={unit}
             />
         ) : (
             <YearlyBubbleChart
                history={data.history}
                duration={duration}
                minTemp={tempDomain[0]}
                maxTemp={tempDomain[1]}
                timeMode={timeMode}
                massOffset={massOffset}
                metric={metric}
                unit={unit}
                raceName={data.race}
             />
         )}
      </div>

      {/* Legend / footnote */}
      <div className="mt-2 min-h-[1rem]">
        {viewMode === 'hourly' ? (
          <div className="flex items-center justify-center gap-2 font-mono text-[10px] text-stone-600">
            <span>{minYear}</span>
            <div className="h-1 w-24 rounded-full bg-gradient-to-r from-[#e5b8a3] to-[#43140b]"></div>
            <span>{maxYear}</span>
            <span className="ml-1">hover a line for the year</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[10px] text-stone-600">
             <span className="flex items-center gap-1.5">
               <span className="w-2 h-2 rounded-full bg-[#2f7d4f]"></span> ideal
             </span>
             <span className="flex items-center gap-1.5">
               <span className="w-2 h-2 rounded-full bg-[#d98324]"></span> up to 1% slower
             </span>
             <span className="flex items-center gap-1.5">
               <span className="w-2 h-2 rounded-full bg-[#b3372c]"></span> over 1% slower
             </span>
          </div>
        )}
        {footnote && (
          <div className="mt-1.5 text-[10px] text-stone-600 leading-tight text-center">
            {footnote}
          </div>
        )}
      </div>
    </section>
  );
};
