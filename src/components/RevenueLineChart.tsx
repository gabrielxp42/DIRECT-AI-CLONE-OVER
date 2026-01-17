import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartData {
  period: string;
  revenue: number;
  profit?: number;
}

interface RevenueLineChartProps {
  data: ChartData[];
  title: string;
  description: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
export const RevenueLineChart: React.FC<RevenueLineChartProps> = ({ data, title, description }) => {
  const [view, setView] = React.useState<'revenue' | 'profit'>('revenue');

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{view === 'revenue' ? title : 'Tendência de Lucro'}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex bg-muted p-1 rounded-md">
            <button
              onClick={() => setView('revenue')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all",
                view === 'revenue' ? "bg-background shadow-sm font-bold" : "text-muted-foreground"
              )}
            >
              RECEITA
            </button>
            <button
              onClick={() => setView('profit')}
              className={cn(
                "px-2 py-1 text-[10px] rounded-sm transition-all",
                view === 'profit' ? "bg-background shadow-sm font-bold text-green-600" : "text-muted-foreground"
              )}
            >
              LUCRO
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
                  tickFormatter={formatCurrency}
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
                  formatter={(value: number) => [formatCurrency(value), view === 'revenue' ? 'Receita' : 'Lucro']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey={view}
                  stroke={view === 'revenue' ? 'hsl(var(--primary))' : '#10b981'}
                  strokeWidth={2}
                  dot={{ fill: view === 'revenue' ? 'hsl(var(--primary))' : '#10b981', r: 4 }}
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