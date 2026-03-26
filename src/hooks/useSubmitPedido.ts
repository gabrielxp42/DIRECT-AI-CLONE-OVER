import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { getValidToken } from '@/utils/tokenGuard';
import { useSession } from '@/contexts/SessionProvider';
import { showSuccess, showError } from '@/utils/toast';
import { isInventoryConsumingStatus, restoreInsumosFromPedido, deductInsumosFromPedido } from './useDataFetch';
import { Pedido } from '@/types/pedido';

interface SubmitPedidoParams {
  data: any;
  pedidoId?: string;
  defaultLojaStatus?: string;
  origem?: 'loja' | 'dtf';
}

export const useSubmitPedido = (editingPedido: Pedido | null, onSuccessCallback?: () => void) => {
  const { session, organizationId } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ data, pedidoId, defaultLojaStatus, origem }: SubmitPedidoParams) => {
      const validToken = await getValidToken();
      if (!validToken || !session) throw new Error("Sessão expirada. Por favor, recarregue a página.");

      const { items, servicos, created_at, ...pedidoData } = data;

      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${validToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      };

      if (pedidoId) {
        // --- Edição ---
        const oldStatus = editingPedido?.status || 'pendente';
        const newStatus = oldStatus; 

        const wasConsuming = isInventoryConsumingStatus(oldStatus);
        const isNowConsuming = isInventoryConsumingStatus(newStatus);

        if (wasConsuming && editingPedido) {
          await restoreInsumosFromPedido(editingPedido);
        }

        const updateData = {
          ...pedidoData,
          created_at,
          status: newStatus,
          pago_at: editingPedido?.pago_at
        };

        const updateUrl = `${SUPABASE_URL}/rest/v1/pedidos?id=eq.${pedidoId}`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updateData)
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Erro ao atualizar pedido: ${updateResponse.status} ${updateResponse.statusText} - ${errorText}`);
        }

        if (items && items.length > 0) {
          const deleteItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items?pedido_id=eq.${pedidoId}`;
          await fetch(deleteItemsUrl, { method: 'DELETE', headers });

          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: pedidoId }));
          const insertItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items`;
          const itemsResponse = await fetch(insertItemsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemsToInsert)
          });

          if (!itemsResponse.ok) {
            const errorText = await itemsResponse.text();
            throw new Error(`Erro ao inserir novos itens: ${itemsResponse.statusText}`);
          }

          if (isNowConsuming && editingPedido) {
            await deductInsumosFromPedido({
              ...editingPedido,
              status: newStatus,
              pedido_items: items
            } as Pedido);
          }
        }

        const deleteServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos?pedido_id=eq.${pedidoId}`;
        await fetch(deleteServicosUrl, { method: 'DELETE', headers });

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: pedidoId }));
          const insertServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos`;
          const servicosResponse = await fetch(insertServicosUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(servicosToInsert)
          });
          if (!servicosResponse.ok) {
            const errorText = await servicosResponse.text();
            throw new Error(`Erro ao inserir serviços: ${servicosResponse.status} ${servicosResponse.statusText} - ${errorText}`);
          }
        }

        // Se tiver dados de frete, atualizar o cliente
        if (updateData.tipo_entrega === 'frete' && updateData.shipping_details) {
          const sd = updateData.shipping_details;
          const updateClienteUrl = `${SUPABASE_URL}/rest/v1/clientes?id=eq.${updateData.cliente_id}`;
          await fetch(updateClienteUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              cep: sd.cep || updateData.shipping_cep,
              endereco: sd.address,
              numero: sd.number,
              complemento: sd.complement,
              bairro: sd.neighborhood,
              cidade: sd.city,
              estado: sd.state,
              nome: sd.name,
              cpf: sd.cpf
            })
          });
        }

        return { type: 'update' };
      } else {
        // --- Criação ---
        const isPago = data.status === 'pago';
        const newPedidoData: any = {
          ...pedidoData,
          user_id: session.user.id,
          organization_id: organizationId,
          status: 'pendente',
          created_at: created_at,
          pago_at: isPago ? new Date().toISOString() : null,
          loja_status: defaultLojaStatus || null,
          origem: origem || 'dtf'
        };

        const createUrl = `${SUPABASE_URL}/rest/v1/pedidos`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify([newPedidoData])
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Erro ao criar pedido: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
        }

        const newPedidoArray = await createResponse.json();
        const newPedido = Array.isArray(newPedidoArray) ? newPedidoArray[0] : newPedidoArray;

        if (items && items.length > 0) {
          const itemsToInsert = items.map((item: any) => ({ ...item, pedido_id: newPedido.id }));
          const insertItemsUrl = `${SUPABASE_URL}/rest/v1/pedido_items`;
          const itemsResponse = await fetch(insertItemsUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(itemsToInsert)
          });
          if (!itemsResponse.ok) {
            const errorText = await itemsResponse.text();
            throw new Error(`Erro ao inserir itens: ${itemsResponse.status} ${itemsResponse.statusText}.`);
          }
        }

        if (servicos && servicos.length > 0) {
          const servicosToInsert = servicos.map((servico: any) => ({ ...servico, pedido_id: newPedido.id }));
          const insertServicosUrl = `${SUPABASE_URL}/rest/v1/pedido_servicos`;
          const servicosResponse = await fetch(insertServicosUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(servicosToInsert)
          });
          if (!servicosResponse.ok) {
            const errorText = await servicosResponse.text();
            throw new Error(`Erro ao inserir serviços: ${servicosResponse.status} ${servicosResponse.statusText} - ${errorText}`);
          }
        }

        // Se tiver dados de frete, atualizar o cliente
        if (newPedido.tipo_entrega === 'frete' && newPedido.shipping_details) {
          const sd = newPedido.shipping_details;
          const updateClienteUrl = `${SUPABASE_URL}/rest/v1/clientes?id=eq.${newPedido.cliente_id}`;
          await fetch(updateClienteUrl, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              cep: sd.cep || newPedido.shipping_cep,
              endereco: sd.address,
              numero: sd.number,
              complemento: sd.complement,
              bairro: sd.neighborhood,
              cidade: sd.city,
              estado: sd.state,
              nome: sd.name,
              cpf: sd.cpf
            })
          });
        }

        return { type: 'create' };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      showSuccess(`Pedido ${result.type === 'create' ? 'criado' : 'atualizado'} com sucesso!`);
      if (onSuccessCallback) onSuccessCallback();
    },
    onError: (error: any) => {
      showError(`Erro ao salvar pedido: ${error.message}`);
    }
  });
};
