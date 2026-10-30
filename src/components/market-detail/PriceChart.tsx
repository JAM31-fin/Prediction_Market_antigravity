import React, { useState, useMemo, useEffect } from 'react';
import { Market, PricePoint } from '../../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const OUTCOME_PALETTE = ['#00f0a0', '#ff3b69', '#00d2ff', '#a855f7', '#f59e0b', '#ec4899'];

interface PriceChartProps {
  market: Market;
}

const CustomTooltip = ({ active, payload, market }: any) => {
  if (active && payload && payload.length) {
    const rawPoint = payload[0]?.payload;
    const formattedDate = rawPoint?.timestamp
      ? new Date(rawPoint.timestamp).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '';

    return (
      <div className="glass-terminal rounded-xl p-3.5 shadow-2xl font-mono text-xs elevation-popover min-w-[210px]">
        <div className="text-[11px] text-slate-400 mb-2.5 border-b border-slate-800/80 pb-1.5 font-sans flex items-center justify-between gap-4">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Snapshot
          </span>
          <span className="text-slate-400 font-mono text-[10px] tabular-nums">{formattedDate}</span>
        </div>
        <div className="space-y-2">
          {payload.map((entry: any) => {
            const outcome = market.outcomes.find((o: any) => o.id === entry.dataKey);
            const isMint = outcome?.name?.toLowerCase().includes('yes') || outcome?.name?.toLowerCase().includes('sí');
            const color = entry.stroke || (isMint ? '#00f0a0' : outcome?.color || '#ff3b69');
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-5">
                <div className="flex items-center gap-2 font-sans">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }}
                  />
                  <span className="text-slate-200 font-medium text-xs">{outcome?.name || entry.name}</span>
                </div>
                <div className="font-bold tabular-nums font-mono text-sm" style={{ color }}>
                  {entry.value}% <span className="text-slate-400 font-normal text-[11px]">({entry.value}&cent;)</span>
                </div>
              </div>
            );
          })}
        </div>
        {rawPoint?.volume !== undefined && (
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-sans">
            <span className="uppercase tracking-wider text-slate-400 font-semibold">Volume Accum</span>
            <span className="font-mono tabular-nums text-slate-200 font-bold">
              ${Number(rawPoint.volume).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export const PriceChart: React.FC<PriceChartProps> = ({ market }) => {
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | 'ALL'>('24H');
  const [curveType, setCurveType] = useState<'stepAfter' | 'monotone'>('stepAfter');

  // Live ticking clock to advance time continuously on the chart
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Compute exact continuous time window [start, end]
  const timeWindow = useMemo(() => {
    const end = currentTime;
    let durationMs = 3600 * 1000; // 1H default
    if (timeframe === '24H') durationMs = 24 * 3600 * 1000;
    else if (timeframe === '7D') durationMs = 7 * 24 * 3600 * 1000;
    else if (timeframe === 'ALL') {
      const inception = market.createdAt ? new Date(market.createdAt).getTime() : end - 24 * 3600 * 1000;
      durationMs = Math.max(3600 * 1000, end - inception);
    }
    const start = end - durationMs;
    return { start, end, durationMs };
  }, [currentTime, timeframe, market.createdAt]);

  // Format tick labels based on active timeframe
  const formatTimeTick = (timestamp: number): string => {
    const d = new Date(timestamp);
    if (timeframe === '1H') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (timeframe === '24H') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (timeframe === '7D') {
      return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })}`;
  };

  // Generate 5 evenly spaced, round reference tick marks across the time window
  const xAxisTicks = useMemo(() => {
    const { start, end, durationMs } = timeWindow;
    const count = 5;
    const step = durationMs / (count - 1);
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
      ticks.push(Math.round(start + i * step));
    }
    return ticks;
  }, [timeWindow]);

  // Construct continuous chronological time series with linear timestamps
  const historyData = useMemo(() => {
    const { start, end } = timeWindow;

    const initialPrices: Record<string, number> = {};
    const currentPrices: Record<string, number> = {};
    for (const o of market.outcomes) {
      initialPrices[o.id] = o.initialPrice ?? o.initialProbability ?? o.currentPrice;
      currentPrices[o.id] = o.currentPrice;
    }

    const rawPoints: PricePoint[] = Array.isArray(market.priceHistory) && market.priceHistory.length > 0
      ? [...market.priceHistory]
      : [];

    rawPoints.sort((a, b) => a.timestamp - b.timestamp);

    // Identify prevailing prices entering the current timeframe window
    const priorPoint = rawPoints.filter((p) => p.timestamp < start).pop();
    const startPrices = priorPoint ? priorPoint.prices : (rawPoints[0] ? rawPoints[0].prices : initialPrices);
    const startVolume = priorPoint ? priorPoint.volume : 0;

    // Filter points inside the active window
    const insidePoints = rawPoints.filter((p) => p.timestamp >= start && p.timestamp <= end);

    const series: Array<{ timestamp: number; volume: number; [key: string]: number }> = [];

    // 1. Left boundary projection at window start
    const leftPoint: any = {
      timestamp: start,
      volume: startVolume,
    };
    market.outcomes.forEach((o) => {
      leftPoint[o.id] = Math.round((startPrices[o.id] ?? o.currentPrice) * 100);
    });
    series.push(leftPoint);

    // 2. Chronological trades executed inside the window
    for (const pt of insidePoints) {
      const item: any = {
        timestamp: pt.timestamp,
        volume: pt.volume,
      };
      market.outcomes.forEach((o) => {
        const val = pt.prices[o.id] !== undefined ? pt.prices[o.id] : o.currentPrice;
        item[o.id] = Math.round(val * 100);
      });
      series.push(item);
    }

    // 3. Right boundary projection at present time (Now)
    const rightPoint: any = {
      timestamp: end,
      volume: market.volume,
    };
    market.outcomes.forEach((o) => {
      rightPoint[o.id] = Math.round(currentPrices[o.id] * 100);
    });
    series.push(rightPoint);

    return series;
  }, [timeWindow, market]);

  return (
    <div className="terminal-card rounded-2xl p-5 elevation-card">
      {/* Chart Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              PROBABILITY TRAJECTORY
            </h4>
            {/* Live radar status indicator */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-radar absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE FEED</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-semibold tracking-wider">
              {curveType === 'stepAfter' ? 'STEPPED LMSR' : 'SMOOTH CURVE'}
            </span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-mono tabular-nums mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {market.outcomes.map((o, idx) => {
              const isMint = o.name?.toLowerCase().includes('yes') || o.name?.toLowerCase().includes('sí');
              const dotColor = o.color || (isMint ? '#00f0a0' : OUTCOME_PALETTE[idx % OUTCOME_PALETTE.length]);
              return (
                <span key={o.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}88` }}
                  />
                  <span className="text-slate-300 font-sans text-xs">{o.name}:</span>
                  <span style={{ color: dotColor }} className="tracking-tight" aria-label={`${o.name} probability: ${Math.round(o.currentPrice * 100)} percent`}>
                    {Math.round(o.currentPrice * 100)}%
                  </span>
                  {idx < market.outcomes.length - 1 && <span className="text-slate-700">{'/'}</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Controls: Curve Style & Timeframe with Concentric Radius */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Stepped vs Smooth selector */}
          <div role="group" aria-label="Chart curve interpolation" className="flex items-center glass-terminal rounded-xl p-1 text-xs font-mono">
            <button
              onClick={() => setCurveType('stepAfter')}
              aria-pressed={curveType === 'stepAfter'}
              className={`px-3 py-1.5 min-h-[36px] sm:min-h-[40px] rounded-lg btn-tactile cursor-pointer ${
                curveType === 'stepAfter'
                  ? 'bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Stepped
            </button>
            <button
              onClick={() => setCurveType('monotone')}
              aria-pressed={curveType === 'monotone'}
              className={`px-3 py-1.5 min-h-[36px] sm:min-h-[40px] rounded-lg btn-tactile cursor-pointer ${
                curveType === 'monotone'
                  ? 'bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Smooth
            </button>
          </div>

          {/* Timeframe Selectors */}
          <div role="group" aria-label="Chart timeframe selection" className="flex items-center glass-terminal rounded-xl p-1 text-xs font-mono tabular-nums">
            {(['1H', '24H', '7D', 'ALL'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                aria-pressed={timeframe === tf}
                className={`px-3 py-1.5 min-h-[36px] sm:min-h-[40px] rounded-lg btn-tactile cursor-pointer ${
                  timeframe === tf
                    ? 'bg-slate-800 text-white font-semibold border border-slate-700/60 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Screen-reader descriptive fallback */}
      <div className="sr-only" aria-live="polite">
        {`Price chart showing ${market.question}. Current probability: ${market.outcomes.map(o => `${o.name}: ${Math.round(o.currentPrice * 100)}%`).join(', ')}`}
      </div>

      {/* Recharts Area Canvas with Linear Time Scale & Phosphor Glow */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {market.outcomes.map((o, idx) => {
                const isMint = o.name?.toLowerCase().includes('yes') || o.name?.toLowerCase().includes('sí');
                const strokeColor = o.color || (isMint ? '#00f0a0' : OUTCOME_PALETTE[idx % OUTCOME_PALETTE.length]);
                return (
                  <linearGradient key={`grad-${o.id}`} id={`grad-${o.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity={0.22} />
                    <stop offset="60%" stopColor={strokeColor} stopOpacity={0.05} />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#151e2e" vertical={false} opacity={0.8} />
            <XAxis
              dataKey="timestamp"
              type="number"
              scale="time"
              domain={[timeWindow.start, timeWindow.end]}
              ticks={xAxisTicks}
              tickFormatter={formatTimeTick}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#151e2e' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={{ stroke: '#151e2e' }}
            />
            <Tooltip content={<CustomTooltip market={market} />} />
            {market.outcomes.map((o, idx) => {
              const isMint = o.name?.toLowerCase().includes('yes') || o.name?.toLowerCase().includes('sí');
              const strokeColor = o.color || (isMint ? '#00f0a0' : OUTCOME_PALETTE[idx % OUTCOME_PALETTE.length]);
              return (
                <Area
                  key={o.id}
                  type={curveType}
                  dataKey={o.id}
                  name={o.name}
                  stroke={strokeColor}
                  strokeWidth={2.2}
                  fill={`url(#grad-${o.id})`}
                  fillOpacity={1}
                  activeDot={{
                    r: 4.5,
                    strokeWidth: 2,
                    stroke: '#ffffff',
                    fill: strokeColor,
                    style: { filter: `drop-shadow(0 0 6px ${strokeColor})` },
                  }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 font-mono border-t border-[#151e2e] pt-2.5">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff]" />
          Continuous Pricing Engine: LMSR Discrete Updates
        </span>
        <span>Sum of Probabilities: 100%</span>
      </div>
    </div>
  );
};
