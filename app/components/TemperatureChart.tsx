import React, { useState, useMemo } from 'react';
import { HistoryYear, WeatherPoint } from '../types';
import { TimeMode, Metric, Unit } from '../App';
import {
  getDecimalHour,
  getStartHourForYear,
  calculateMetricValue,
  formatDecimalTime,
} from '../utils';

interface TemperatureChartProps {
  history: HistoryYear[];
  duration: number;
  minTemp: number;
  maxTemp: number;
  timeMode: TimeMode;
  massOffset: number;
  metric: Metric;
  unit: Unit;
}

const FONT = '"IBM Plex Mono", ui-monospace, monospace';

export const TemperatureChart: React.FC<TemperatureChartProps> = ({ 
    history, 
    duration, 
    minTemp, 
    maxTemp, 
    timeMode, 
    massOffset,
    metric, 
    unit 
}) => {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);

  // Configuration
  const height = 300;
  const width = 400; 
  const padding = { top: 24, right: 12, bottom: 30, left: 30 };
  
  const tempRange = maxTemp - minTemp;

  // Sort history chronologically (Oldest -> Newest) for the gradient mapping
  const sortedHistory = useMemo(() => [...history].sort((a, b) => a.year - b.year), [history]);

  // Helper to map index to color (light clay -> near-black rust)
  const getYearColor = (index: number, total: number) => {
    if (total <= 1) return '#9a3b1e';
    
    const start = { r: 229, g: 184, b: 163 }; // #e5b8a3
    const end = { r: 67, g: 20, b: 11 };      // #43140b
    
    const t = index / (total - 1);
    
    const r = Math.round(start.r + t * (end.r - start.r));
    const g = Math.round(start.g + t * (end.g - start.g));
    const b = Math.round(start.b + t * (end.b - start.b));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getY = (val: number) => {
    const normalized = (val - minTemp) / tempRange;
    return padding.top + (1 - normalized) * (height - padding.top - padding.bottom);
  };

  // Determine the display window based on the most recent year (index 0 of passed history)
  const referenceYear = history[0];
  const actualStartHour = getStartHourForYear(referenceYear, timeMode, massOffset);
  
  // X-axis window: 30 minutes before the start through 30 minutes after the finish
  const viewStartHour = actualStartHour - 0.5;
  const viewEndHour = actualStartHour + duration + 0.5;
  const timeRange = viewEndHour - viewStartHour;

  const getX = (val: number) => {
    const normalized = (val - viewStartHour) / timeRange;
    return padding.left + normalized * (width - padding.left - padding.right);
  };

  const generatePath = (points: WeatherPoint[]) => {
    // 1. Prepare all points with decimal time
    const allPoints = points.map(p => ({
        ...p,
        t: getDecimalHour(p.datetime)
    })).sort((a, b) => a.t - b.t);

    const getValue = (p: WeatherPoint) => calculateMetricValue(p.temp, p.dew, metric, unit);

    // Function to interpolate value at a specific time t
    const interpolateAt = (targetT: number) => {
        // Find the bounding points
        const indexAfter = allPoints.findIndex(p => p.t >= targetT);
        
        if (indexAfter === -1) {
            // Target is after all data points, extrapolate from last two or clamp to last
            const last = allPoints[allPoints.length - 1];
            return last ? getValue(last) : 0; 
        }
        
        if (indexAfter === 0) {
             // Target is before or at the first data point
             return getValue(allPoints[0]);
        }

        const pAfter = allPoints[indexAfter];
        const pBefore = allPoints[indexAfter - 1];

        // Linear interpolation
        const range = pAfter.t - pBefore.t;
        if (range === 0) return getValue(pAfter);
        
        const fraction = (targetT - pBefore.t) / range;
        const valBefore = getValue(pBefore);
        const valAfter = getValue(pAfter);
        
        return valBefore + fraction * (valAfter - valBefore);
    };

    const renderPoints: {x: number, y: number}[] = [];

    // Start Point (Chart Left Edge) - Interpolated
    renderPoints.push({
        x: getX(viewStartHour),
        y: getY(interpolateAt(viewStartHour))
    });

    // Intermediate Points (Original Data Points within view)
    allPoints.forEach(p => {
        if (p.t > viewStartHour && p.t < viewEndHour) {
            renderPoints.push({
                x: getX(p.t),
                y: getY(getValue(p))
            });
        }
    });

    // End Point (Chart Right Edge) - Interpolated
    renderPoints.push({
        x: getX(viewEndHour),
        y: getY(interpolateAt(viewEndHour))
    });

    if (renderPoints.length < 2) return "";

    let d = `M ${renderPoints[0].x} ${renderPoints[0].y}`;
    
    for (let i = 0; i < renderPoints.length - 1; i++) {
        const p0 = renderPoints[i];
        const p1 = renderPoints[i + 1];
        
        // Smooth curve
        const cp1x = p0.x + (p1.x - p0.x) * 0.5;
        const cp1y = p0.y;
        const cp2x = p1.x - (p1.x - p0.x) * 0.5;
        const cp2y = p1.y;
        
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    return d;
  };

  const timeTicks = [];
  for (let h = Math.ceil(viewStartHour); h <= Math.floor(viewEndHour); h++) {
    timeTicks.push(h);
  }

  // Ticks
  const tempTicks = useMemo(() => {
      let ticks: number[] = [];
      const startDecade = Math.floor(minTemp / 10) * 10;
      const endDecade = Math.ceil(maxTemp / 10) * 10;

      for (let t = startDecade; t <= endDecade; t += 10) {
          ticks.push(t);
      }

      // Filter to roughly within range (allow a small margin so axis doesn't look empty at edges)
      return ticks.filter(t => t >= minTemp && t <= maxTemp).sort((a, b) => a - b);
  }, [minTemp, maxTemp]);

  const startLineX = getX(actualStartHour);
  const finishLineX = getX(actualStartHour + duration);

  // Calculate Threshold value (120F for Sum) in current unit
  const thresholdValue = unit === 'F' ? 120 : (120 - 64) * 5 / 9;
  const showThreshold = metric === 'sum' && thresholdValue >= minTemp && thresholdValue <= maxTemp;

  return (
    <div className="w-full relative select-none">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Horizontal Grid Lines */}
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

        {/* Threshold Line (only for Sum metric) */}
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

        {/* Time axis labels */}
        {timeTicks.map(hour => {
             const x = getX(hour);
             
             // Handle 24h wrap if needed
             let displayVal = hour;
             let suffix = 'am';
             if (displayVal >= 12) {
                 suffix = 'pm';
                 if (displayVal > 12) displayVal -= 12;
             }
             if (displayVal === 0) displayVal = 12;

             return (
                <g key={hour}>
                    <line 
                        x1={x} y1={height - padding.bottom} 
                        x2={x} y2={height - padding.bottom + 4} 
                        stroke="#a8a29e" 
                        strokeWidth="1"
                    />
                    <text 
                        x={x} 
                        y={height - 10} 
                        fill="#57534e" 
                        fontFamily={FONT}
                        fontSize="9" 
                        textAnchor="middle"
                    >
                        {displayVal}{suffix}
                    </text>
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
        
        {/* Start / Finish markers */}
        {[
          { x: startLineX, label: `start ${formatDecimalTime(actualStartHour)}`, anchor: 'start' as const, dx: 4 },
          { x: finishLineX, label: `finish ${formatDecimalTime(actualStartHour + duration)}`, anchor: 'end' as const, dx: 0 },
        ].map(marker => (
          <g key={marker.label}>
            <line 
                x1={marker.x} 
                y1={padding.top - 2} 
                x2={marker.x} 
                y2={height - padding.bottom} 
                stroke="#1c1917" 
                strokeWidth="1" 
                strokeDasharray="1 3"
                opacity="0.7"
            />
            <text
                x={marker.x + marker.dx} 
                y={padding.top - 8}
                textAnchor={marker.anchor}
                fontFamily={FONT}
                fontSize="9"
                fill="#57534e"
            >
                {marker.label}
            </text>
          </g>
        ))}

        {/* Data lines */}
        {sortedHistory.map((yearData, index) => {
            const isHovered = hoveredYear === yearData.year;
            // Opacity handling: if one is hovered, fade others significantly. Default is slightly transparent to see overlaps.
            const opacity = hoveredYear ? (isHovered ? 1 : 0.12) : 0.85;
            const strokeWidth = isHovered ? 2.5 : 1.5;
            const color = getYearColor(index, sortedHistory.length);
            
            const path = generatePath(yearData.weather);

            return (
                <g key={yearData.year} onMouseEnter={() => setHoveredYear(yearData.year)} onMouseLeave={() => setHoveredYear(null)}>
                    {path && (
                        <path
                            d={path}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            opacity={opacity}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-all duration-200 cursor-pointer"
                        />
                    )}
                </g>
            );
        })}
      </svg>
      
      {/* Tooltip for currently hovered year */}
      {hoveredYear && (
          <div className="absolute top-0 right-0 bg-paper border border-stone-300 rounded px-2 py-0.5 font-mono text-xs text-ink pointer-events-none z-10">
              {hoveredYear}
          </div>
      )}
    </div>
  );
};
