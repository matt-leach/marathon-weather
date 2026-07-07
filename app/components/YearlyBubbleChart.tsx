import React, { useState, useMemo, useId } from 'react';
import { HistoryYear } from '../types';
import { TimeMode, Metric, Unit } from '../App';
import { Sun, Cloud, CloudRain, CloudSnow, CloudSun } from 'lucide-react';
import {
  getDecimalHour,
  getStartHourForYear,
  calculateMetricValue,
  getRawValuesAtHour,
  formatDuration,
} from '../utils';

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

const FONT = '"IBM Plex Mono", ui-monospace, monospace';

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
  // Bottom padding fits year label + icon
  const padding = { top: 16, right: 12, bottom: 50, left: 30 };
  
  const tempRange = maxTemp - minTemp;
  const sortedHistory = useMemo(() => [...history].sort((a, b) => a.year - b.year), [history]);

  // --- Helpers ---

  const getY = (val: number) => {
    const normalized = (val - minTemp) / tempRange;
    return padding.top + (1 - normalized) * (height - padding.top - padding.bottom);
  };

  const calculateMetric = (temp: number, dew: number) =>
    calculateMetricValue(temp, dew, metric, unit);

  const getBubbleColor = (sumF: number) => {
     // Coloring purely based on Temp + Dew (Sum) in Fahrenheit
     // < 100: ideal / 100-120: warm / > 120: hot
     if (sumF < 100) return '#2f7d4f';
     if (sumF <= 120) return '#d98324';
     return '#b3372c';
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

  const getYearAxisLabel = (year: number) => {
    const full = getYearLabel(year);
    if (year === sortedHistory[0]?.year) return full;
    return full.slice(2);
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

      const commonProps = { size: 14, strokeWidth: 2 };

      if (combinedConditions.includes('snow')) return <CloudSnow {...commonProps} className="text-sky-600" />;
      if (combinedConditions.includes('rain')) return <CloudRain {...commonProps} className="text-blue-600" />;
      if (combinedConditions.includes('overcast')) return <Cloud {...commonProps} className="text-stone-500" />;
      if (combinedConditions.includes('partially')) return <CloudSun {...commonProps} className="text-stone-500" />;
      
      return <Sun {...commonProps} className="text-amber-600" />;
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

  // Determine alignment of tooltip based on year position to avoid covering the column
  const tooltipAlignment = useMemo(() => {
    if (!hoveredYear) return 'left-0';
    const index = sortedHistory.findIndex(h => h.year === hoveredYear);
    // If column is in the left half, position tooltip on right, and vice versa
    return index < sortedHistory.length / 2 ? 'right-0' : 'left-0';
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
                    stroke="#e7e2da" 
                    strokeWidth="1"
                />
                <text 
                    x={padding.left - 6} 
                    y={getY(temp)} 
                    fill="#57534e" 
                    fontFamily={FONT}
                    fontSize="9" 
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
                    stroke="#1c1917" 
                    strokeWidth="1" 
                    strokeDasharray="2 3"
                    opacity="0.5"
                />
                <text 
                    x={width - padding.right} 
                    y={getY(thresholdValue) - 4} 
                    fill="#57534e" 
                    fontFamily={FONT}
                    fontSize="9" 
                    textAnchor="end" 
                >
                    &gt;1% slower
                </text>
            </g>
        )}

        {/* X Axis & Labels */}
        {sortedHistory.map(yearData => {
            const x = getX(yearData.year);
            const icon = getWeatherIcon(yearData);
            const isHovered = hoveredYear === yearData.year;
            return (
                <g key={yearData.year}>
                    <text 
                        x={x} 
                        y={height - 28} 
                        fill={isHovered ? '#1c1917' : '#57534e'} 
                        fontFamily={FONT}
                        fontSize="9" 
                        textAnchor="middle"
                        className="cursor-default"
                    >
                        {getYearAxisLabel(yearData.year)}
                    </text>
                    {/* Render Icon via foreignObject */}
                    <foreignObject x={x - 8} y={height - 22} width={16} height={16}>
                        <div className="w-full h-full flex items-center justify-center">
                            {icon}
                        </div>
                    </foreignObject>
                </g>
            );
        })}

        {/* Baseline */}
        <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#d6d3d1"
            strokeWidth="1"
        />

        {/* Continuous Range Shapes */}
        {yearShapes.map((shape) => {
            const x = getX(shape.year);
            const yTop = getY(shape.maxVal);
            const yBottom = getY(shape.minVal);
            
            // Ensure even single points have a visible circle height
            let barHeight = yBottom - yTop;
            const barWidth = 12;
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
                    className={`transition-opacity duration-150 ${hoveredYear && !isHovered ? 'opacity-35' : 'opacity-100'}`}
                />
            );
        })}

        {/* Hover Interaction Overlay Columns */}
        {years.map(year => (
             <rect
                key={`overlay-${year}`}
                x={getX(year) - 12}
                y={padding.top}
                width={24}
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
          <div className={`absolute top-0 ${tooltipAlignment} bg-paper border border-stone-300 rounded p-3 z-10 pointer-events-none min-w-[150px] shadow-sm`}>
              <div className="flex justify-between items-baseline gap-3 border-b border-stone-200 pb-1.5 mb-2">
                <span className="font-serif font-semibold text-sm">{getYearLabel(tooltipData.year)}</span>
                <span className="font-mono text-[10px] text-stone-600">{tooltipData.date}</span>
              </div>
              
              <div className="space-y-2 font-mono text-[11px]">
                  <div>
                      <div className="text-[9px] text-stone-600 mb-0.5">START</div>
                      <div className="flex justify-between gap-4 text-ink">
                          <span className="text-stone-600">temp</span>
                          <span className="tabular-nums">{formatVal(tooltipData.start.temp)}°</span>
                      </div>
                       <div className="flex justify-between gap-4">
                          <span className="text-stone-600">dew pt</span>
                          <span className="tabular-nums text-stone-600">{formatVal(tooltipData.start.dew)}°</span>
                      </div>
                  </div>
                  
                  <div>
                      <div className="text-[9px] text-stone-600 mb-0.5">FINISH +{formatDuration(duration)}</div>
                      <div className="flex justify-between gap-4 text-ink">
                          <span className="text-stone-600">temp</span>
                          <span className="tabular-nums">{formatVal(tooltipData.finish.temp)}°</span>
                      </div>
                       <div className="flex justify-between gap-4">
                          <span className="text-stone-600">dew pt</span>
                          <span className="tabular-nums text-stone-600">{formatVal(tooltipData.finish.dew)}°</span>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
