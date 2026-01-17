import React, { useState, useMemo, useId } from 'react';
import { HistoryYear } from '../types';
import { TimeMode, Metric, Unit } from '../App';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun } from 'lucide-react';

interface YearlyBubbleChartProps {
  history: HistoryYear[];
  duration: number;
  minTemp: number;
  maxTemp: number;
  timeMode: TimeMode;
  massOffset: number;
  metric: Metric;
  unit: Unit;
  raceName: string;
}

export const YearlyBubbleChart: React.FC<YearlyBubbleChartProps> = ({ 
    history, 
    duration, 
    minTemp, 
    maxTemp, 
    timeMode, 
    massOffset,
    metric, 
    unit,
    raceName
}) => {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const chartUniqueId = useId();

  // Configuration
  const height = 300;
  const width = 400; 
  // Increased bottom padding to fit year label + icon
  const padding = { top: 20, right: 20, bottom: 50, left: 45 };
  
  const tempRange = maxTemp - minTemp;
  const sortedHistory = useMemo(() => [...history].sort((a, b) => a.year - b.year), [history]);

  // --- Helpers ---

  const getY = (val: number) => {
    const normalized = (val - minTemp) / tempRange;
    return padding.top + (1 - normalized) * (height - padding.top - padding.bottom);
  };

  const getDecimalHour = (timeStr: string) => {
    if (!timeStr) return 9;
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const getStartHourForYear = (year: HistoryYear, mode: TimeMode, offsetMins: number) => {
    let timeStr = year.startTimeMass;
    let offsetHours = 0;
    if (mode === 'eliteMen') {
        timeStr = year.startTimeEliteMen || year.startTimeElite || year.startTimeMass;
    } else if (mode === 'eliteWomen') {
        timeStr = year.startTimeEliteWomen || year.startTimeElite || year.startTimeMass;
    } else {
        // Mass start logic
        timeStr = year.startTimeMass;
        offsetHours = offsetMins / 60;
    }
    return getDecimalHour(timeStr) + offsetHours;
  };

  const calculateMetric = (temp: number, dew: number) => {
    let val = metric === 'sum' ? (temp + dew) : temp;
    if (unit === 'C') {
        const offset = metric === 'sum' ? 64 : 32;
        val = (val - offset) * 5 / 9;
    }
    return val;
  };

  const interpolate = (val1: number, val2: number, t1: number, t2: number, t: number) => {
    if (t2 === t1) return val1;
    const fraction = (t - t1) / (t2 - t1);
    return val1 + fraction * (val2 - val1);
  };

  const getRawValuesAtHour = (yearData: HistoryYear, targetHour: number) => {
    const allPoints = yearData.weather.map(p => ({
        ...p,
        t: getDecimalHour(p.datetime)
    })).sort((a, b) => a.t - b.t);

    const indexAfter = allPoints.findIndex(p => p.t >= targetHour);
    
    if (indexAfter === -1) {
        const last = allPoints[allPoints.length - 1];
        return { temp: last ? last.temp : 0, dew: last ? last.dew : 0 };
    } 
    
    if (indexAfter === 0) {
        const first = allPoints[0];
        return { temp: first.temp, dew: first.dew };
    }

    const pAfter = allPoints[indexAfter];
    const pBefore = allPoints[indexAfter - 1];

    return {
        temp: interpolate(pBefore.temp, pAfter.temp, pBefore.t, pAfter.t, targetHour),
        dew: interpolate(pBefore.dew, pAfter.dew, pBefore.t, pAfter.t, targetHour)
    };
  };

  const getBubbleColor = (sumF: number) => {
     // Coloring purely based on Temp + Dew (Sum) in Fahrenheit
     // < 100: Green (Ideal/Good)
     // 100 - 120: Orange (Caution)
     // > 120: Red (Dangerous)
     
     if (sumF < 100) return '#10b981'; // Green
     if (sumF <= 120) return '#f97316'; // Orange
     return '#ef4444'; // Red
  };

  const getYearLabel = (year: number) => {
    if (raceName.includes("London") && [2020, 2021, 2022].includes(year)) {
        return `${year}*`;
    }
    if (raceName.includes("Boston") && year === 2021) {
        return `${year}*`;
    }
    return `${year}`;
  };

  // Logic to determine a representative weather icon for the race duration
  const getWeatherIcon = (yearData: HistoryYear) => {
      const startHour = getStartHourForYear(yearData, timeMode, massOffset);
      const endHour = startHour + duration;
      
      const relevantPoints = yearData.weather.filter(p => {
          const t = getDecimalHour(p.datetime);
          return t >= startHour && t <= endHour;
      });

      const pointsToCheck = relevantPoints.length > 0 ? relevantPoints : yearData.weather;
      const combinedConditions = pointsToCheck.map(p => p.conditions.toLowerCase()).join(' ');

      const commonProps = { size: 16, strokeWidth: 2.5 };

      if (combinedConditions.includes('snow')) return <CloudSnow {...commonProps} className="text-sky-400" />;
      if (combinedConditions.includes('rain')) return <CloudRain {...commonProps} className="text-blue-500" />;
      if (combinedConditions.includes('overcast')) return <Cloud {...commonProps} className="text-slate-500" />;
      if (combinedConditions.includes('partially')) return <CloudSun {...commonProps} className="text-orange-400" />;
      
      return <Sun {...commonProps} className="text-amber-500" />;
  };

  // Generate Data Shapes (Range Bars)
  const yearShapes = useMemo(() => {
    return sortedHistory.map(year => {
        const startHour = getStartHourForYear(year, timeMode, massOffset);
        const endHour = startHour + duration;
        
        // 1. Get interpolated exact start/end values to ensure smoothness
        const startRaw = getRawValuesAtHour(year, startHour);
        const endRaw = getRawValuesAtHour(year, endHour);

        const startPoint = {
            val: calculateMetric(startRaw.temp, startRaw.dew),
            sumF: startRaw.temp + startRaw.dew
        };
        const endPoint = {
             val: calculateMetric(endRaw.temp, endRaw.dew),
             sumF: endRaw.temp + endRaw.dew
        };

        // 2. Get any raw data points that fall strictly INSIDE the time window
        const innerPoints = year.weather
            .filter(p => {
                const t = getDecimalHour(p.datetime);
                return t > startHour && t < endHour;
            })
            .map(p => ({
                val: calculateMetric(p.temp, p.dew),
                sumF: p.temp + p.dew
            }));

        // 3. Combine for Min/Max calculation
        const allPoints = [startPoint, ...innerPoints, endPoint];
        const minVal = Math.min(...allPoints.map(p => p.val));
        const maxVal = Math.max(...allPoints.map(p => p.val));
        
        // 4. Sort points descending by value for gradient (Top -> Bottom)
        const gradientPoints = [...allPoints].sort((a, b) => b.val - a.val);

        return {
            year: year.year,
            minVal: minVal,
            maxVal: maxVal,
            gradientPoints: gradientPoints
        };
    }).filter((s): s is NonNullable<typeof s> => s !== null);
  }, [sortedHistory, timeMode, massOffset, duration, metric, unit]);

  // X Scale
  const years = sortedHistory.map(h => h.year);
  const getX = (year: number) => {
      const index = years.indexOf(year);
      const inset = 15;
      const availableWidth = width - padding.left - padding.right - (inset * 2);
      const step = availableWidth / (years.length > 1 ? years.length - 1 : 1);
      return padding.left + inset + index * step;
  };

  // Ticks
  const tempTicks = useMemo(() => {
      let ticks: number[] = [];
      
      const startDecade = Math.floor(minTemp / 10) * 10;
      const endDecade = Math.ceil(maxTemp / 10) * 10;

      for (let t = startDecade; t <= endDecade; t += 10) {
          ticks.push(t);
      }

      return ticks.filter(t => t >= minTemp && t <= maxTemp).sort((a, b) => a - b);
  }, [minTemp, maxTemp]);

  const thresholdValue = unit === 'F' ? 120 : (120 - 64) * 5 / 9;
  const showThreshold = metric === 'sum' && thresholdValue >= minTemp && thresholdValue <= maxTemp;

  // -- Data Extraction for Tooltip --
  const getTooltipData = () => {
    if (!hoveredYear) return null;
    const yearData = sortedHistory.find(h => h.year === hoveredYear);
    if (!yearData) return null;

    const startHour = getStartHourForYear(yearData, timeMode, massOffset);
    const finishHour = startHour + duration;

    const startRaw = getRawValuesAtHour(yearData, startHour);
    const finishRaw = getRawValuesAtHour(yearData, finishHour);

    // Helper to convert individual values for display
    const convert = (v: number) => unit === 'C' ? (v - 32) * 5 / 9 : v;

    return {
        year: yearData.year,
        date: yearData.date,
        start: { temp: convert(startRaw.temp), dew: convert(startRaw.dew) },
        finish: { temp: convert(finishRaw.temp), dew: convert(finishRaw.dew) }
    };
  };

  const tooltipData = getTooltipData();
  const formatVal = (v: number) => v.toFixed(1);

  // Helper to format duration for tooltip display (e.g. 2:36)
  const formatDurationStr = (hrs: number) => {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      const mStr = m === 60 ? '00' : m.toString().padStart(2, '0');
      const hFinal = m === 60 ? h + 1 : h;
      return `${hFinal}:${mStr}`;
  };

  // Determine alignment of tooltip based on year position to avoid covering the column
  const tooltipAlignment = useMemo(() => {
    if (!hoveredYear) return 'left-2';
    const index = sortedHistory.findIndex(h => h.year === hoveredYear);
    // If column is in the left half, position tooltip on right
    // If column is in the right half, position tooltip on left
    return index < sortedHistory.length / 2 ? 'right-2' : 'left-2';
  }, [hoveredYear, sortedHistory]);

  return (
    <div className="w-full relative select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
         
         {/* Define Gradients */}
         <defs>
            {yearShapes.map(shape => {
                const gradId = `grad-${chartUniqueId}-${shape.year}`;
                const range = shape.maxVal - shape.minVal;
                
                return (
                    <linearGradient key={gradId} id={gradId} x1="0" x2="0" y1="0" y2="1">
                        {shape.gradientPoints.map((p, i) => {
                            // Calculate offset: 0 at maxVal (top), 1 at minVal (bottom)
                            // Avoid division by zero if range is 0 (single point)
                            const offset = range === 0 ? 0 : (shape.maxVal - p.val) / range;
                            return (
                                <stop 
                                    key={i} 
                                    offset={`${offset * 100}%`} 
                                    stopColor={getBubbleColor(p.sumF)} 
                                />
                            );
                        })}
                    </linearGradient>
                );
            })}
         </defs>

         {/* Y Axis Grid */}
         {tempTicks.map(temp => (
            <g key={temp}>
                <line 
                    x1={padding.left} 
                    y1={getY(temp)} 
                    x2={width - padding.right} 
                    y2={getY(temp)} 
                    stroke="#e2e8f0" 
                    strokeDasharray="4 4" 
                    strokeWidth="1"
                />
                <text 
                    x={padding.left - 8} 
                    y={getY(temp)} 
                    fill="#64748b" 
                    fontWeight="600"
                    fontSize="10" 
                    textAnchor="end" 
                    alignmentBaseline="middle"
                >
                    {temp}°
                </text>
            </g>
        ))}

        {/* Threshold Line */}
        {showThreshold && (
            <g>
                <line 
                    x1={padding.left} 
                    y1={getY(thresholdValue)} 
                    x2={width - padding.right} 
                    y2={getY(thresholdValue)} 
                    stroke="black" 
                    strokeWidth="1.5" 
                    strokeDasharray="2 2"
                    opacity="0.3"
                />
                <text 
                    x={width - padding.right} 
                    y={getY(thresholdValue) - 4} 
                    fill="black" 
                    fontSize="10" 
                    textAnchor="end" 
                    opacity="0.6"
                    fontWeight="600"
                >
                    &gt;1% &Delta; pace
                </text>
            </g>
        )}

        {/* X Axis & Labels */}
        {sortedHistory.map(yearData => {
            const x = getX(yearData.year);
            const icon = getWeatherIcon(yearData);
            return (
                <g key={yearData.year}>
                    <text 
                        x={x} 
                        y={height - 30} 
                        fill="#64748b" 
                        fontWeight="600" 
                        fontSize="10" 
                        textAnchor="middle"
                        className="cursor-default"
                    >
                        {getYearLabel(yearData.year)}
                    </text>
                    {/* Render Icon via foreignObject */}
                    <foreignObject x={x - 8} y={height - 24} width={16} height={16}>
                        <div className="w-full h-full flex items-center justify-center">
                            {icon}
                        </div>
                    </foreignObject>
                    <line 
                        x1={x} 
                        y1={padding.top} 
                        x2={x} 
                        y2={height - padding.bottom} 
                        stroke="#f1f5f9" 
                        strokeWidth="15" 
                        opacity="0" 
                    />
                </g>
            );
        })}

        {/* Continuous Range Shapes */}
        {yearShapes.map((shape) => {
            const x = getX(shape.year);
            const yTop = getY(shape.maxVal);
            const yBottom = getY(shape.minVal);
            
            // Ensure even single points have a visible circle height (e.g. 14px)
            let barHeight = yBottom - yTop;
            const barWidth = 14;
            const minBarHeight = barWidth; 
            
            // If the range is tiny, center the pill on the value
            let drawY = yTop;
            if (barHeight < minBarHeight) {
                const center = (yTop + yBottom) / 2;
                drawY = center - minBarHeight / 2;
                barHeight = minBarHeight;
            }

            const isHovered = hoveredYear === shape.year;
            const gradId = `grad-${chartUniqueId}-${shape.year}`;

            return (
                <rect
                    key={shape.year}
                    x={x - barWidth / 2}
                    y={drawY}
                    width={barWidth}
                    height={barHeight}
                    rx={barWidth / 2}
                    fill={`url(#${gradId})`}
                    stroke="white"
                    strokeWidth="1"
                    className={`transition-all duration-200 ${isHovered ? 'opacity-100 drop-shadow-md' : 'opacity-90'}`}
                />
            );
        })}

        {/* Hover Interaction Overlay Columns */}
        {years.map(year => (
             <rect
                key={`overlay-${year}`}
                x={getX(year) - 10}
                y={padding.top}
                width={20}
                height={height - padding.top - padding.bottom}
                fill="transparent"
                onMouseEnter={() => setHoveredYear(year)}
                onMouseLeave={() => setHoveredYear(null)}
                onClick={() => setHoveredYear(year)} 
                className="cursor-pointer"
             />
        ))}

      </svg>
      
      {/* Detailed Tooltip */}
      {tooltipData && (
          <div className={`absolute top-2 ${tooltipAlignment} bg-white/95 backdrop-blur-sm border border-slate-200 shadow-lg rounded-lg p-3 text-xs z-10 pointer-events-none min-w-[140px] animate-in fade-in zoom-in-95 duration-100`}>
              <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 mb-2 flex justify-between items-baseline">
                <span className="text-sm">{getYearLabel(tooltipData.year)}</span>
                <span className="text-slate-400 font-normal text-[10px]">{tooltipData.date}</span>
              </div>
              
              <div className="space-y-2">
                  <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Start</div>
                      <div className="flex justify-between text-slate-700">
                          <span>Temp:</span>
                          <span className="font-mono font-bold text-indigo-600">{formatVal(tooltipData.start.temp)}°</span>
                      </div>
                       <div className="flex justify-between text-slate-500">
                          <span>Dew Point:</span>
                          <span className="font-mono">{formatVal(tooltipData.start.dew)}°</span>
                      </div>
                  </div>
                  
                  <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Finish (+{formatDurationStr(duration)}h)</div>
                      <div className="flex justify-between text-slate-700">
                          <span>Temp:</span>
                          <span className="font-mono font-bold text-indigo-600">{formatVal(tooltipData.finish.temp)}°</span>
                      </div>
                       <div className="flex justify-between text-slate-500">
                          <span>Dew Point:</span>
                          <span className="font-mono">{formatVal(tooltipData.finish.dew)}°</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};