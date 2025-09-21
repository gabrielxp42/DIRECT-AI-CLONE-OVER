import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Produto } from "@/types/produto";

interface LowStockAlertProps {
  produtos: Produto[];
  threshold?: number;
}

export const LowStockAlert = ({ produtos, threshold = 10 }: LowStockAlertProps) => {
  const lowStockProducts = produtos.filter(produto => 
    (produto.estoque || 0) <= threshold && (produto.estoque || 0) > 0
  );

  const outOfStockProducts = produtos.filter(produto => 
    (produto.estoque || 0) === 0
  );

  if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-6">
      {outOfStockProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Produtos em Falta</AlertTitle>
          <AlertDescription>
            {outOfStockProducts.length} produto(s) estão sem estoque: {' '}
            {outOfStockProducts.map(p => p.nome).join(', ')}
          </AlertDescription>
        </Alert>
      )}
      
      {lowStockProducts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Estoque Baixo</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} produto(s) com estoque baixo (≤{threshold}): {' '}
            {lowStockProducts.map(p => `${p.nome} (${p.estoque})`).join(', ')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};