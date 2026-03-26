import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const ErrosDefeitos = () => {
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-primary mb-1 flex items-center gap-2">
            <Settings className="h-6 w-6" /> Erros e Defeitos
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Acompanhamento de problemas e refações.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Em Construção</CardTitle>
        </CardHeader>
        <CardContent>
          Esta página está sendo desenvolvida. Em breve você poderá rastrear erros e defeitos aqui.
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrosDefeitos;
