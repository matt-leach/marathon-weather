import React, { useState, useMemo } from 'react';
import { HistoryYear, WeatherPoint } from '../types';
import { TimeMode, Metric, Unit } from '../App';

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
  const padding = { top: 20, right: 20, bottom: 30, left: 30 };
  
  const tempRange = maxTemp - minTemp;

  // Sort history chronologically (Oldest -> Newest) for the gradient mapping
  const sortedHistory = useMemo(() => [...history].sort((a, b) => a.year - b.year), [history]);

  // Helper to map index to color (Light Red -> Dark Red)
  const getYearColor = (index: number, total: number) => {
    if (total <= 1) return '#dc2626';
    
    // Interpolate between Red-300 (#fca5a5) and Red-950 (#450a0a)
    // RGB: 252,165,165 -> 69,10,10
    const start = { r: 252, g: 165, b: 165 };
    const end = { r: 69, g: 10, b: 10 };
    
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

  const getDecimalHour = (timeStr: string) => {
    if (!timeStr) return 9; // Fallback
    const [h, m] = timeStr.split(':').map(Number);
    return h + m / 60;
  };

  const formatDecimalTime = (decimal: number) => {
    let hrs = Math.floor(decimal);
    const mins = Math.round((decimal - hrs) * 60);
    const suffix = hrs >= 12 ? 'pm' : 'am';
    
    if (hrs > 12) hrs -= 12;
    if (hrs === 0) hrs = 12; 
    
    const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${minsStr}${suffix}`;
  };

  const getStartHourForYear = (year: HistoryYear, mode: TimeMode, offsetMins: number) => {
    let timeStr = year.startTimeMass;
    let offsetHours = 0;

    if (mode === 'eliteMen') {
        timeStr = year.startTimeEliteMen || year.startTimeElite || year.startTimeMass;
    } else if (mode === 'eliteWomen') {
        timeStr = year.startTimeEliteWomen || year.startTimeElite || year.startTimeMass;
    } else {
        // Mass start mode
        timeStr = year.startTimeMass;
        offsetHours = offsetMins / 60;
    }

    return getDecimalHour(timeStr) + offsetHours;
  };

  // Determine the display window based on the most recent year (index 0 of passed history)
  const referenceYear = history[0];
  const actualStartHour = getStartHourForYear(referenceYear, timeMode, massOffset);
  
  // NEW: X-axis start time is 30 minutes (0.5 hours) before the actual start
  const viewStartHour = actualStartHour - 0.5;
  // X-axis end time covers the duration of the race plus 30 minutes (0.5 hours) buffer
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

    const getValue = (p: WeatherPoint) => {
        let val = metric === 'sum' ? (p.temp + p.dew) : p.temp;
        // Convert raw Fahrenheit data to Celsius if unit is C
        if (unit === 'C') {
            const offset = metric === 'sum' ? 64 : 32;
            val = (val - offset) * 5 / 9;
        }
        return val;
    };

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
                    stroke="#e2e8f0" 
                    strokeDasharray="4 4" 
                    strokeWidth="1"
                />
                <text 
                    x={padding.left - 5} 
                    y={getY(temp)} 
                    fill="#94a3b8" 
                    fontWeight="400"
                    fontSize="10" 
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
                    stroke="black" 
                    strokeWidth="1.5" 
                    strokeDasharray="2 2"
                    opacity="0.5"
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

        {/* Vertical Grid Lines (Time) */}
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
                        x1={x} y1={padding.top} 
                        x2={x} y2={height - padding.bottom} 
                        stroke="#f1f5f9" 
                        strokeWidth="1"
                    />
                    <text 
                        x={x} 
                        y={height - 10} 
                        fill="#94a3b8" 
                        fontSize="10" 
                        textAnchor="middle"
                    >
                        {displayVal}{suffix}
                    </text>
                </g>
             );
        })}
        
        {/* Selected Start Time Line */}
        <g>
            <line 
                x1={startLineX} 
                y1={padding.top} 
                x2={startLineX} 
                y2={height - padding.bottom} 
                stroke="black" 
                strokeWidth="2" 
                strokeDasharray="4 4"
                opacity="0.6"
            />
            <text
                x={startLineX + 4} 
                y={padding.top - 8}
                textAnchor="start"
                fontSize="11"
                fontWeight="bold"
                fill="black"
            >
                Start ({formatDecimalTime(actualStartHour)})
            </text>
        </g>
        
        {/* Selected Finish Time Line */}
        <g>
            <line 
                x1={finishLineX} 
                y1={padding.top} 
                x2={finishLineX} 
                y2={height - padding.bottom} 
                stroke="black" 
                strokeWidth="2" 
                strokeDasharray="4 4"
                opacity="0.6"
            />
            <text
                x={finishLineX} 
                y={padding.top - 8}
                textAnchor="end"
                fontSize="11"
                fontWeight="bold"
                fill="black"
            >
                Finish ({formatDecimalTime(actualStartHour + duration)})
            </text>
        </g>

        {/* The Squiggles (Data Lines) */}
        {sortedHistory.map((yearData, index) => {
            const isHovered = hoveredYear === yearData.year;
            // Opacity handling: if one is hovered, fade others significantly. Default is slightly transparent to see overlaps.
            const opacity = hoveredYear ? (isHovered ? 1 : 0.1) : 0.8;
            const strokeWidth = isHovered ? 3 : 2;
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
                            className="transition-all duration-200 cursor-pointer hover:drop-shadow-md"
                        />
                    )}
                </g>
            );
        })}
      </svg>
      
      {/* Tooltip for currently hovered year */}
      {hoveredYear && (
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur border border-slate-200 shadow-sm rounded-lg px-2 py-1 text-xs font-bold text-slate-600 pointer-events-none z-10">
              {hoveredYear}
          </div>
      )}
    </div>
  );
};
