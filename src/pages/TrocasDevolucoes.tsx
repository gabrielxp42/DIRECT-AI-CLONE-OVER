import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

const TrocasDevolucoes = () => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-primary mb-1 flex items-center gap-2">
            <RefreshCw className="h-6 w-6" /> Trocas e Devoluções
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gerenciamento de trocas de produtos e devoluções de clientes.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
        </CardHeader>
        <CardContent>
          Esta página está sendo desenvolvida. Em breve você poderá gerenciar as trocas e devoluções.
        </CardContent>
      </Card>
    </div>
  );
};

export default TrocasDevolucoes;
