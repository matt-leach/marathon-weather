import React from 'react';
import { MarathonData } from '../types';
import { TemperatureChart } from './TemperatureChart';
import { YearlyBubbleChart } from './YearlyBubbleChart';
import { MapPin } from 'lucide-react';
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
    return '🏳️';
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
  const month = new Date(data.history[0].date).toLocaleString('default', { month: 'short' }).toUpperCase();

  // Dynamic font size for long race names like "California International Marathon"
  const titleClass = data.race.length > 25 
    ? "text-lg" 
    : (data.race.length > 15 ? "text-xl" : "text-2xl");

  // Calculate year range for hourly legend
  const years = data.history.map(h => h.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const renderFootnote = () => {
    if (viewMode !== 'yearly') return null;

    if (data.race.includes('London')) {
        return (
             <div className="mt-2 px-2 text-[10px] text-slate-400 italic text-center leading-tight">
                *London Marathons in 2020, 2021, 2022 were held in October due to the Covid-19 pandemic
             </div>
        );
    }
    if (data.race.includes('Boston')) {
        return (
             <div className="mt-2 px-2 text-[10px] text-slate-400 italic text-center leading-tight">
                *The 2021 Boston Marathon was held in October due to the Covid-19 pandemic
             </div>
        );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Header Card */}
      <div className="text-center space-y-1 mb-2">
        <h2 className={`${titleClass} font-bold text-slate-900 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis px-1`}>
            {data.race}
        </h2>
        <div className="flex justify-center items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <MapPin className="w-3 h-3" /> {data.location.split(',')[0]}
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-sm shadow-sm rounded-sm" role="img" aria-label="country flag">
                    {getCountryFlag(data.location)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50 tracking-wider">
                    {month}
                </span>
            </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 bg-white rounded-xl border border-slate-50 pt-2 relative">
         <div className="px-4 mb-2 flex justify-between items-end">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {metric === 'temp' ? 'Temperature' : 'Temperature + Dew Point'}
            </h3>
         </div>
         
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
         {renderFootnote()}
      </div>
      
      {/* Legend/Footer */}
      <div className="flex justify-center items-center gap-3 mt-4 h-4">
        {viewMode === 'hourly' ? (
          <>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{minYear}</span>
            {/* Gradient bar mimicking the Red-300 to Red-950 transition */}
            <div className="h-1.5 w-32 rounded-full bg-gradient-to-r from-[rgb(252,165,165)] to-[rgb(69,10,10)]"></div>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{maxYear}</span>
          </>
        ) : (
          <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-green-500"></span> Ideal
             </div>
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-orange-500"></span> ~0-1% &#916;pace 
             </div>
             <div className="flex items-center gap-1">
               <span className="w-2 h-2 rounded-full bg-red-500"></span> &gt;1% &#916;pace
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
