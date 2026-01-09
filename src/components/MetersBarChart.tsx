import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartData {
  period: string;
  meters: number;
  dtf?: number;
  vinil?: number;
}

interface MetersBarChartProps {
  data: ChartData[];
  title: string;
  description: string;
}

const formatMeters = (value: number) => `${value.toFixed(1)}m`;

export const MetersBarChart: React.FC<MetersBarChartProps> = ({ data, title, description }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-3 text-[10px] font-medium">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>DTF</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <span>VINIL</span>
            </div>
          </div>
        </div>

        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm italic">
            Nenhum dado de metragem para exibir.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="period"
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                  dy={10}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={formatMeters}
                  axisLine={false}
                  tickLine={false}
                  fontSize={10}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted)/0.1)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    fontSize: '12px'
                  }}
                  itemStyle={{ padding: '0px' }}
                />
                <Bar dataKey="dtf" name="DTF" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={30} />
                <Bar dataKey="vinil" name="Vinil" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};