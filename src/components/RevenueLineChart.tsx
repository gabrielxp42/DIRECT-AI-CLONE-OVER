import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartData {
  period: string;
  revenue: number;
  profit?: number;
  meters?: number;
}

interface RevenueLineChartProps {
  data: ChartData[];
  title: string;
  description: string;
}

const formatValue = (value: number, type: 'revenue' | 'profit' | 'meters') => {
  if (type === 'meters') return `${value.toFixed(1)} ML`;

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const RevenueLineChart: React.FC<RevenueLineChartProps> = ({ data, title, description }) => {
  const [view, setView] = React.useState<'revenue' | 'profit' | 'meters'>('revenue');

  const getTitle = () => {
    if (view === 'revenue') return title;
    if (view === 'profit') return 'Tendência de Lucro';
    return 'Produção (Metros Lineares)';
  };

  const getStrokeColor = () => {
    if (view === 'revenue') return 'hsl(var(--primary))';
    if (view === 'profit') return '#10b981';
    return '#3b82f6'; // Blue for meters
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{getTitle()}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex bg-muted p-1 rounded-md gap-0.5">
            <button
              onClick={() => setView('revenue')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all font-bold",
                view === 'revenue' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              RECEITA
            </button>
            <button
              onClick={() => setView('profit')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all font-bold",
                view === 'profit' ? "bg-background shadow-sm text-emerald-600" : "text-muted-foreground hover:text-foreground"
              )}
            >
              LUCRO
            </button>
            <button
              onClick={() => setView('meters')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all font-bold text-blue-600",
                view === 'meters' ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground grayscale opacity-60"
              )}
            >
              METROS
            </button>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum dado para exibir.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(val) => formatValue(val, view)}
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [
                    formatValue(value, view),
                    view === 'revenue' ? 'Receita' : view === 'profit' ? 'Lucro' : 'Metragem'
                  ]}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey={view}
                  stroke={getStrokeColor()}
                  strokeWidth={2}
                  dot={{ fill: getStrokeColor(), r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
