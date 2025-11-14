import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';

interface ChartData {
  period: string;
  revenue: number;
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
  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Nenhum dado de receita para exibir.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="period" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  tickFormatter={formatCurrency} 
                  axisLine={false} 
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    borderRadius: '0.5rem' 
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Receita']}
                  labelFormatter={(label) => `Período: ${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2} 
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
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