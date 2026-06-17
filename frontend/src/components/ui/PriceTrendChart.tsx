'use client';
import React, { useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';

const DAYS_OPTIONS = [7, 14, 30] as const;
type DaysOption = typeof DAYS_OPTIONS[number];

interface PriceTrendChartProps {
    cropId: string;
    currency: string;
}

function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label, currency }: any) {
    if (!active || !payload?.length) return null;
    const avg = payload.find((p: any) => p.dataKey === 'avg_price');
    const min = payload.find((p: any) => p.dataKey === 'min_price');
    const max = payload.find((p: any) => p.dataKey === 'max_price');
    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-[11px]">
            <p className="font-black text-gray-700 mb-1">{formatDate(label)}</p>
            {avg && <p className="text-[#2d5a3d] font-bold">Avg: {currency} {Intl.NumberFormat('en-US').format(avg.value)}</p>}
            {min && <p className="text-gray-400 font-medium">Min: {currency} {Intl.NumberFormat('en-US').format(min.value)}</p>}
            {max && <p className="text-gray-400 font-medium">Max: {currency} {Intl.NumberFormat('en-US').format(max.value)}</p>}
        </div>
    );
}

export default function PriceTrendChart({ cropId, currency }: PriceTrendChartProps) {
    const [days, setDays] = useState<DaysOption>(7);
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        api.get(`/listings/prices/${cropId}/history?days=${days}&currency=${currency}`)
            .then(res => setData(res.data))
            .catch(() => setData([]))
            .finally(() => setIsLoading(false));
    }, [cropId, days, currency]);

    return (
        <div className="bg-white rounded-3xl shadow-sm p-5 mb-2">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-800">Price Trend</h3>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                    {DAYS_OPTIONS.map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`text-[10px] font-black px-2.5 py-1 rounded-md transition-all ${
                                days === d
                                    ? 'bg-white text-[#2d5a3d] shadow-sm'
                                    : 'text-gray-400'
                            }`}
                        >
                            {d}D
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="h-36 bg-gray-100 rounded-2xl animate-pulse" />
            ) : data.length < 2 ? (
                <div className="h-36 flex items-center justify-center">
                    <p className="text-xs text-gray-400 font-medium">Not enough data for this period.</p>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={144}>
                    <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2d5a3d" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#2d5a3d" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey="recorded_at"
                            tickFormatter={formatDate}
                            tick={{ fontSize: 9, fill: '#9ca3af', fontWeight: 700 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Area
                            type="monotone"
                            dataKey="min_price"
                            stroke="transparent"
                            fill="#2d5a3d"
                            fillOpacity={0.06}
                            dot={false}
                            activeDot={false}
                            legendType="none"
                        />
                        <Area
                            type="monotone"
                            dataKey="max_price"
                            stroke="transparent"
                            fill="#2d5a3d"
                            fillOpacity={0.06}
                            dot={false}
                            activeDot={false}
                            legendType="none"
                        />
                        <Area
                            type="monotone"
                            dataKey="avg_price"
                            stroke="#2d5a3d"
                            strokeWidth={2}
                            fill="url(#avgGradient)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#2d5a3d', strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
