import { Pedido } from "@/types/pedido";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PedidoPreviewProps {
  pedido: Pedido | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const PedidoPreview = ({ pedido }: PedidoPreviewProps) => {
  if (!pedido) {
    return <div className="p-8 text-center">Selecione um pedido para visualizar.</div>;
  }

  const subtotal = pedido.subtotal_produtos + pedido.subtotal_servicos;
  const totalDescontos = pedido.desconto_valor + (subtotal * (pedido.desconto_percentual / 100));

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl mx-auto my-8 print:shadow-none print:my-0">
      <header className="flex justify-between items-start pb-6 border-b-2 border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Detalhes do Pedido</h1>
          <p className="text-gray-500">Pedido #{pedido.id.substring(0, 8)}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold text-gray-700">Sua Logo Aqui</h2>
          <p className="text-gray-500 text-sm">Seu Endereço, 123</p>
          <p className="text-gray-500 text-sm">seuemail@exemplo.com</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 my-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Cliente:</h3>
          <p className="text-gray-800 font-medium">{pedido.clientes.nome}</p>
          {pedido.clientes.telefone && <p className="text-gray-500">{pedido.clientes.telefone}</p>}
          {pedido.clientes.email && <p className="text-gray-500">{pedido.clientes.email}</p>}
        </div>
        <div className="text-right">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Data do Pedido:</h3>
          <p className="text-gray-800">{format(new Date(pedido.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}</p>
          <h3 className="text-lg font-semibold text-gray-600 mt-4 mb-2">Status:</h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            pedido.status === 'concluido' ? 'bg-green-100 text-green-800' :
            pedido.status === 'em_producao' ? 'bg-yellow-100 text-yellow-800' :
            pedido.status === 'cancelado' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {pedido.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </span>
        </div>
      </section>

      <section className="my-8">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4">Itens do Pedido</h3>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-3 font-semibold text-gray-600">Produto / Serviço</th>
              <th className="p-3 font-semibold text-gray-600 text-center">Qtd.</th>
              <th className="p-3 font-semibold text-gray-600 text-right">Preço Unit.</th>
              <th className="p-3 font-semibold text-gray-600 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {pedido.pedido_items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{item.produto_nome}</p>
                  {item.observacao && (
                    <p className="text-sm text-gray-500 pl-2 italic">- {item.observacao}</p>
                  )}
                </td>
                <td className="p-3 text-center">{item.quantidade}</td>
                <td className="p-3 text-right">{formatCurrency(item.preco_unitario)}</td>
                <td className="p-3 text-right">{formatCurrency(item.quantidade * item.preco_unitario)}</td>
              </tr>
            ))}
            {pedido.servicos.map((servico) => (
              <tr key={servico.id} className="border-b">
                <td className="p-3">
                  <p className="font-medium text-gray-800">{servico.nome}</p>
                  <p className="text-sm text-gray-500 pl-2 italic">(Serviço)</p>
                </td>
                <td className="p-3 text-center">{servico.quantidade}</td>
                <td className="p-3 text-right">{formatCurrency(servico.valor_unitario)}</td>
                <td className="p-3 text-right">{formatCurrency(servico.quantidade * servico.valor_unitario)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end my-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="text-gray-800">{formatCurrency(subtotal)}</span>
          </div>
          {totalDescontos > 0 && (
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Descontos:</span>
              <span className="text-red-600">-{formatCurrency(totalDescontos)}</span>
            </div>
          )}
          <div className="flex justify-between py-3 mt-2 bg-gray-100 px-4 rounded-lg">
            <span className="text-xl font-bold text-gray-800">Total:</span>
            <span className="text-xl font-bold text-gray-800">{formatCurrency(pedido.valor_total)}</span>
          </div>
        </div>
      </section>

      {pedido.observacoes && (
        <footer className="pt-6 border-t mt-8">
          <h3 className="text-lg font-semibold text-gray-600 mb-2">Observações Gerais:</h3>
          <p className="text-gray-500 whitespace-pre-wrap">{pedido.observacoes}</p>
        </footer>
      )}
    </div>
  );
};