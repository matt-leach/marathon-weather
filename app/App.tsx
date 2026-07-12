import React, { useState, useMemo, useEffect } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { getSortedMarathonData } from './marathon_data';
import { MarathonColumn } from './components/MarathonColumn';
import { MarathonData } from './types';
import { formatDuration, calculateMetricValue } from './utils';

export type TimeMode = 'eliteMen' | 'eliteWomen' | 'mass';  // Currently only "mass" enabled
export type Metric = 'temp' | 'sum';
export type Unit = 'F' | 'C';
export type ViewMode = 'hourly' | 'yearly';

interface SegmentedProps {
  options: { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}

const Segmented: React.FC<SegmentedProps> = ({ options, value, onChange }) => (
  <div className="inline-flex border border-stone-300 rounded divide-x divide-stone-300 overflow-hidden">
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`px-3 h-8 text-xs font-medium transition-colors whitespace-nowrap ${
          value === opt.value
            ? 'bg-ink text-paper'
            : 'bg-white text-stone-600 hover:text-ink hover:bg-stone-50'
        }`}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

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
            setError("Couldn't load the race data. Try refreshing the page.");
        } finally {
            setLoading(false);
        }
    };
    load();
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!isInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsInfoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isInfoOpen]);

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

  const yearExtent = useMemo(() => {
    const years = data.flatMap(m => m.history.map(h => h.year));
    if (years.length === 0) return '';
    return `${Math.min(...years)}–${Math.max(...years)}`;
  }, [data]);

  if (loading) {
      return (
          <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-ink rounded-full animate-spin" />
              <p className="text-stone-600 font-mono text-xs">loading race data…</p>
          </div>
      );
  }

  if (error) {
      return (
          <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 px-4">
              <p className="font-serif text-2xl text-ink">Something went wrong.</p>
              <p className="text-stone-600 text-sm">{error}</p>
              <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-4 h-9 bg-ink text-paper text-sm font-medium rounded hover:bg-stone-700 transition-colors"
              >
                  Reload
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Header */}
      <header className="border-b border-stone-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-baseline justify-between">
          <span className="font-serif text-xl font-semibold tracking-tight pt-4">
            marathons<span className="text-stone-500">.fyi</span>
          </span>
          <button
            onClick={() => setIsInfoOpen(true)}
            className="pt-4 text-sm text-stone-600 hover:text-ink underline underline-offset-4 decoration-stone-300 hover:decoration-ink transition-colors"
          >
            About
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <div className="max-w-2xl mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
            What's the weather like on race day?
          </h1>
          <p className="mt-3 text-stone-600 text-[15px] leading-relaxed">
            The weather is one of the more important factors in marathon performance, and
            heat and humidity are usually the biggest contributors.
            This site shows how the temperature and humidity change over the course of the race 
            at {data.length} big marathons. 
            <br /> 
            <br /> 
            Set your finish time and see how each year would have treated you.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-10 border-y border-stone-300 py-4 flex flex-col lg:flex-row gap-6 lg:items-end lg:justify-between">

          {/* Finish Time */}
          <div className="w-full lg:max-w-sm">
            <div className="flex justify-between items-baseline mb-3">
              <label className="text-xs text-stone-600" htmlFor="finish-time">
                Your finish time
              </label>
              <span className="font-mono text-lg font-medium tabular-nums">
                {formatDuration(duration)}
              </span>
            </div>
            <input
              id="finish-time"
              type="range"
              min="119" max="420" step="1"
              value={duration * 60}
              onChange={(e) => setDuration(parseInt(e.target.value) / 60)}
              className="slider"
            />
            <div className="flex justify-between mt-2 font-mono text-[10px] text-stone-600">
              <span>2:00</span><span>3:00</span><span>4:00</span><span>5:00</span><span>6:00</span><span>7:00</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <div className="text-xs text-stone-600 mb-1.5">Measure</div>
              <Segmented
                value={metric}
                onChange={(v) => setMetric(v as Metric)}
                options={[
                  { value: 'temp', label: 'Temperature' },
                  { value: 'sum', label: 'Temp + dew point' },
                ]}
              />
            </div>
            <div>
              <div className="text-xs text-stone-600 mb-1.5">Units</div>
              <Segmented
                value={unit}
                onChange={(v) => setUnit(v as Unit)}
                options={[
                  { value: 'F', label: '°F' },
                  { value: 'C', label: '°C' },
                ]}
              />
            </div>
            <div>
              <div className="text-xs text-stone-600 mb-1.5">View</div>
              <Segmented
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  { value: 'yearly', label: 'Bubbles' },
                  { value: 'hourly', label: 'Trendlines' },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-12">
          {data.map((marathon) => (
            <MarathonColumn
              key={marathon.race}
              data={marathon}
              duration={duration}
              tempDomain={tempDomain}
              timeMode={timeMode}
              massOffset={massOffset}
              metric={metric}
              unit={unit}
              viewMode={viewMode}
            />
          ))}
        </div>
      </main>

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setIsInfoOpen(false)}
          />

          <div className="relative bg-paper border border-stone-300 rounded max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-xl">
            <button
              onClick={() => setIsInfoOpen(false)}
              className="absolute top-4 right-5 text-stone-600 hover:text-ink text-xl leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>

            <h2 className="font-serif text-2xl font-semibold tracking-tight">
              About this site
            </h2>

            <div className="mt-4 space-y-4 text-[15px] text-stone-700 leading-relaxed">
              <p>
                This site shows temperature and humidity data for the last 10 years at 
                {' '}{data.length} big marathons - the current Marathon Majors as well as 
                some select others.
              </p>
              <p>
                Heat is a critical factor in marathon performance, and while it is possible
                to train for it, it will likely still impact performance.
              </p>
              <p>
                How much the weather will impact your pace depends on a number of factors,
                here I have used the combined temperature + dew point heuristic from{' '}
                <a href="https://maximumperformancerunning.blogspot.com/2013/07/temperature-dew-point.html" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 decoration-stone-400 hover:decoration-ink">
                  Mark Hadley's blog
                </a>. I have had good results with this heuristic training in the New York summer heat.
              </p>
              <p>
                For another blog about running in the heat and humidity, I like
                {' '}<a href="https://runningwritings.com/2025/04/heat-humidity-marathon-times.html" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 decoration-stone-400 hover:decoration-ink">
                  John Davis' write-up
                </a>.
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-stone-300">
              <h3 className="text-xs text-stone-600 mb-3">How to read the colors</h3>
              <ul className="space-y-2.5 text-sm text-stone-700">
                <li className="flex gap-3 items-baseline">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2f7d4f] shrink-0 translate-y-px" />
                  <span><span className="font-medium text-ink">Ideal</span> - temp + dew point under 100°F - no meaningful slowdown.</span>
                </li>
                <li className="flex gap-3 items-baseline">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d98324] shrink-0 translate-y-px" />
                  <span><span className="font-medium text-ink">Warm</span> - between 100–120°F combined - up to a 1% slowdown.</span>
                </li>
                <li className="flex gap-3 items-baseline">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#b3372c] shrink-0 translate-y-px" />
                  <span><span className="font-medium text-ink">Hot</span> - over 120°F combined - more than 1% off your pace.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-300 py-6 mt-12">
         <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between gap-1 text-xs text-stone-600">
            <span>Weather history from <a href="https://www.visualcrossing.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 decoration-stone-300 hover:decoration-ink hover:text-ink transition-colors">Visual Crossing</a>.</span>
            <span className="font-mono text-stone-600">{yearExtent} · {data.length} races · hourly observations</span>
         </div>
      </footer>

      <Analytics />
    </div>
  );
};

export default App;
