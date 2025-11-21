import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from 'lucide-react';
import { useDashboardData } from '@/hooks/useDashboardData';

export const DailySummaryCard = () => {
    const { data: stats, isLoading } = useDashboardData();

    if (isLoading) {
        return (
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/20 animate-pulse" />
                        <span className="bg-muted/50 h-5 w-32 rounded animate-pulse" />
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="h-4 bg-muted/50 rounded w-3/4 animate-pulse" />
                        <div className="h-4 bg-muted/50 rounded w-1/2 animate-pulse" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const salesGrowth = stats?.salesGrowth || 0;
    const isPositiveGrowth = salesGrowth >= 0;

    return (
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-primary/20">
                        <DollarSign className="h-4 w-4 text-primary" />
                    </div>
                    Resumo Rápido
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            Pedidos
                        </p>
                        <p className="text-xl font-bold">{stats?.pendingOrdersCount || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Pendentes</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Vendas
                        </p>
                        <p className="text-xl font-bold">{formatCurrency(stats?.totalSales || 0)}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Clientes
                        </p>
                        <p className="text-xl font-bold">{stats?.newCustomers || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Novos</p>
                    </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Crescimento mensal</span>
                    <div className={`flex items-center gap-1 text-sm font-semibold ${isPositiveGrowth ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositiveGrowth ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        {salesGrowth >= 0 ? '+' : ''}{salesGrowth.toFixed(1)}%
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
