import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ChartData {
  period: string;
  meters: number;
}

interface MetersBarChartProps {
  data: ChartData[];
  title: string;
  description: string;
}

const formatMeters = (value: number) => `${value.toFixed(2)} ML`;

export const MetersBarChart: React.FC<MetersBarChartProps> = ({ data, title, description }) => {
  const maxMeters = Math.max(...data.map(d => d.meters));

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum dado de metragem para exibir.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  tickFormatter={formatMeters} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '0.5rem' 
                  }}
                  formatter={(value: number) => [formatMeters(value), 'Metros Lineares']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Bar dataKey="meters" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill="hsl(var(--primary))" // Usando a variável CSS para a cor primária
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};