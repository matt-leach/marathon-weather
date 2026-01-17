import React, { useState, useMemo, useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { getSortedMarathonData } from './marathon_data';
import { MarathonColumn } from './components/MarathonColumn';
import { Timer, BarChart3, TrendingUp, Loader2, Info, X } from 'lucide-react';
import { MarathonData } from './types';
import { formatDuration, calculateMetricValue } from './utils';

export type TimeMode = 'eliteMen' | 'eliteWomen' | 'mass';  // Currently only "mass" enabled
export type Metric = 'temp' | 'sum';
export type Unit = 'F' | 'C';
export type ViewMode = 'hourly' | 'yearly';

const App: React.FC = () => {
  const [data, setData] = useState<MarathonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  // Default to 3h marathon
  const [duration, setDuration] = useState(3.0);
  // Defaulting to Mass start, 0 offset (Wave 1)
  const [timeMode] = useState<TimeMode>('mass');
  const [massOffset] = useState(0); 
  
  const [metric, setMetric] = useState<Metric>('temp');
  const [unit, setUnit] = useState<Unit>('F');
  const [viewMode, setViewMode] = useState<ViewMode>('yearly');

  // Fetch data on mount
  useEffect(() => {
    const load = async () => {
        try {
            const sortedData = await getSortedMarathonData();
            setData(sortedData);
        } catch (e) {
            console.error("Failed to fetch marathon data", e);
            setError("Failed to load race data. Please try refreshing the page.");
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);
  
  // Calculate global extent to ensure all charts share the same scale
  const tempDomain = useMemo(() => {
    if (data.length === 0) return (unit === 'F' ? [-5, 35] : [-20, 5]) as [number, number];

    const getValue = (w: { temp: number; dew: number }) =>
        calculateMetricValue(w.temp, w.dew, metric, unit);
    
    const allValues = data.flatMap(m => m.history.flatMap(h => h.weather.map(getValue)));
    
    if (allValues.length === 0) return (unit === 'F' ? [-5, 35] : [-20, 5]) as [number, number];
    
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    
    // Use floor/ceil to get integer bounds, then apply +/- buffer
    const buffer = unit === 'F' ? (metric === 'sum' ? 10 : 5) : (metric === 'sum' ? 5 : 3);
    const minDomain = Math.floor(min) - buffer;
    const maxDomain = Math.ceil(max) + buffer;
    
    return [minDomain, maxDomain] as [number, number];
  }, [metric, unit, data]);

  
  if (loading) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-slate-400 font-medium text-sm animate-pulse">Loading race data...</p>
          </div>
      );
  }

  if (error) {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
              <div className="text-red-500 text-5xl">!</div>
              <p className="text-slate-600 font-medium text-sm">{error}</p>
              <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                  Refresh
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 bg-opacity-90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              MarathonWeather<span className="font-light text-slate-400">.viz</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsInfoOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-all"
            aria-label="App Information"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl tracking-tight">
            Race Day Conditions
          </h2>
          <p className="mt-2 text-slate-500 text-sm max-w-lg mx-auto">
             Analyze historical weather trends based on your projected marathon time.
          </p>
        </div>

        {/* Compact Controls Panel */}
        <div className="max-w-4xl mx-auto mb-10 bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5">
           
           <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
              
              {/* Finish Time */}
              <div className="w-full md:flex-1 space-y-2">
                 <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-semibold text-xs uppercase tracking-wider">
                       <Timer className="w-3.5 h-3.5" /> Projected Finish Time
                    </div>
                    <div className="font-mono text-2xl font-bold text-indigo-600 tracking-tighter">
                       {formatDuration(duration)}
                    </div>
                 </div>
                 <div className="relative h-5 flex items-center">
                    <input 
                      type="range" 
                      min="120" max="420" step="1" 
                      value={duration * 60} 
                      onChange={(e) => setDuration(parseInt(e.target.value) / 60)}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 border border-slate-200"
                    />
                 </div>
                 <div className="flex justify-between text-[9px] text-slate-400 font-medium uppercase tracking-wider px-0.5">
                       <span>2h</span><span>3h</span><span>4h</span><span>5h</span><span>6h</span><span>7h</span>
                 </div>
              </div>

              {/* Toggles Group - Full width on mobile */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                 
                 <div className="flex w-full sm:w-auto gap-3">
                    {/* Metric */}
                    <div className="flex flex-1 sm:flex-none bg-slate-100 p-1 rounded-lg h-8 shadow-inner">
                        <button onClick={() => setMetric('temp')} className={`flex-1 sm:flex-none px-3 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${metric === 'temp' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                           Temp
                        </button>
                        <button onClick={() => setMetric('sum')} className={`flex-1 sm:flex-none px-3 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${metric === 'sum' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                           Temp + Dew
                        </button>
                    </div>
                    
                    {/* Unit */}
                    <div className="flex bg-slate-100 p-1 rounded-lg h-8 shadow-inner">
                        <button onClick={() => setUnit('F')} className={`w-8 rounded-md text-[10px] font-bold transition-all ${unit === 'F' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                           °F
                        </button>
                        <button onClick={() => setUnit('C')} className={`w-8 rounded-md text-[10px] font-bold transition-all ${unit === 'C' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                           °C
                        </button>
                    </div>
                 </div>

                 <div className="w-px h-8 bg-slate-100 mx-1 hidden md:block"></div>

                 {/* View Mode */}
                 <div className="flex w-full sm:w-auto bg-slate-100 p-1 rounded-lg h-8 shadow-inner">
                    <button onClick={() => setViewMode('yearly')} className={`flex-1 sm:flex-none px-3 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 ${viewMode === 'yearly' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                       <BarChart3 className="w-3 h-3" /> By Year
                    </button>
                    <button onClick={() => setViewMode('hourly')} className={`flex-1 sm:flex-none px-3 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-1 ${viewMode === 'hourly' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}>
                       <TrendingUp className="w-3 h-3" /> Hourly Trends
                    </button>
                 </div>

              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-6">
          {data.map((marathon) => (
            <div key={marathon.race} className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
              <MarathonColumn 
                data={marathon} 
                duration={duration} 
                tempDomain={tempDomain}
                timeMode={timeMode}
                massOffset={massOffset}
                metric={metric}
                unit={unit}
                viewMode={viewMode}
              />
            </div>
          ))}
        </div>
      </main>

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsInfoOpen(false)}
          />
          
          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsInfoOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Info className="w-6 h-6 text-indigo-600" /> About MarathonWeather.viz
                </h3>
                <p className="mt-4 text-slate-600 leading-relaxed text-lg">
                  This tool allows you to see historical weather data for some of the world's most popular marathons, and how
                  the heat might affect the times run.
                </p>
              </div>

              {/* Large Explanation Section - Now non-italic and moved up */}
              <div className="bg-slate-50 rounded-xl p-6 text-lg md:text-xl text-slate-600 leading-relaxed border border-slate-100 shadow-inner">
                There are many different models you can use for running in the heat, I particularly like <a href="https://runningwritings.com/2025/04/heat-humidity-marathon-times.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline decoration-2 underline-offset-4 hover:text-indigo-800 transition-all hover:bg-indigo-50 px-1 rounded">John Davis' blog</a> for a detailed look.
                Here the pace impact estimates are based on a combined "Temperature + Dew Point" metric,
                using data from <a href="https://maximumperformancerunning.blogspot.com/2013/07/temperature-dew-point.html" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline decoration-2 underline-offset-4 hover:text-indigo-800 transition-all hover:bg-indigo-50 px-1 rounded">Mark Hadley's blog</a>.
              </div>

              {/* Pace Adjustment Legend - Now at the bottom */}
              <div className="pt-4 border-t border-slate-100">
                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-4">Pace Adjustment Legend</h4>
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-slate-600">
                  <li className="flex flex-col gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="font-bold text-emerald-900">Green (Ideal)</span>
                    </div>
                    <span className="text-emerald-700/80">Optimal conditions for peak performance (Sum &lt; 100°F).</span>
                  </li>
                  <li className="flex flex-col gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                      <span className="font-bold text-orange-900">Orange (Caution)</span>
                    </div>
                    <span className="text-orange-700/80">Mildly warm; expect a slight impact (~0-1% pace slowdown).</span>
                  </li>
                  <li className="flex flex-col gap-2 p-3 bg-red-50 rounded-xl border border-red-100 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <span className="font-bold text-red-900">Red (Significant)</span>
                    </div>
                    <span className="text-red-700/80">Significant heat stress (&gt;1% pace impact predicted).</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={() => setIsInfoOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-indigo-200"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 mt-auto">
         <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>
              Weather data from <a href="https://www.visualcrossing.com/" target="_blank" rel="noreferrer" className="hover:text-indigo-500 underline decoration-slate-300 hover:decoration-indigo-500 transition-all">Visual Crossing</a>.
            </p>
         </div>
      </footer>

      <Analytics />
    </div>
  );
};

export default App;