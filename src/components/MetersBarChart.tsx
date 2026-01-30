import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { TipoProducao } from '@/types/producao';

interface ChartData {
  period: string;
  meters: number;
  [key: string]: string | number | undefined; // Permite chaves dinâmicas para tipos de produção
}

interface MetersBarChartProps {
  data: ChartData[];
  title: string;
  description: string;
  tiposProducao?: TipoProducao[];
}

const tailwindColorMap: Record<string, string> = {
  'orange': '#f97316',
  'blue': '#3b82f6',
  'green': '#22c55e',
  'purple': '#a855f7',
  'red': '#ef4444',
  'pink': '#ec4899',
  'yellow': '#eab308',
  'teal': '#14b8a6',
  'indigo': '#6366f1',
  'gray': '#9ca3af',
};

const getHexColor = (colorStr?: string, index: number = 0) => {
  if (!colorStr) return `hsl(${(index * 137.5) % 360}, 70%, 50%)`;

  // Extrair o nome da cor do tailwind (ex: text-blue-500 -> blue)
  const match = colorStr.match(/text-([a-z]+)-/);
  const colorName = match ? match[1] : null;

  if (colorName && tailwindColorMap[colorName]) {
    return tailwindColorMap[colorName];
  }

  return `hsl(${(index * 137.5) % 360}, 70%, 50%)`;
};

const formatMeters = (value: number) => `${value.toFixed(1)}m`;

export const MetersBarChart: React.FC<MetersBarChartProps> = ({ data, title, description, tiposProducao }) => {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-medium justify-end max-w-[200px]">
            {/* Legenda Dinâmica baseada nos dados presentes */}
            {(() => {
              const types = new Set<string>();
              data.forEach(item => {
                Object.keys(item).forEach(key => {
                  if (key !== 'period' && key !== 'meters' && typeof item[key] === 'number' && (item[key] as number) > 0) {
                    types.add(key);
                  }
                });
              });

              return Array.from(types).map((type, index) => {
                const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === type.toLowerCase());
                const color = getHexColor(tipoInfo?.color, index);

                return (
                  <div key={type} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="uppercase">{type}</span>
                  </div>
                );
              });
            })()}
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
                  formatter={(value: number) => [`${value.toFixed(2)}m`, '']}
                />
                {(() => {
                  const types = new Set<string>();
                  data.forEach(item => {
                    Object.keys(item).forEach(key => {
                      if (key !== 'period' && key !== 'meters' && typeof item[key] === 'number') {
                        types.add(key);
                      }
                    });
                  });

                  return Array.from(types).map((type, index, arr) => {
                    const tipoInfo = tiposProducao?.find(t => t.nome.toLowerCase() === type.toLowerCase());
                    const color = getHexColor(tipoInfo?.color, index);
                    const isLast = index === arr.length - 1;

                    return (
                      <Bar
                        key={type}
                        dataKey={type}
                        name={type.toUpperCase()}
                        stackId="a"
                        fill={color}
                        radius={isLast ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        barSize={30}
                      />
                    );
                  });
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};