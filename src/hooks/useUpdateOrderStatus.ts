import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { showSuccess, showError } from "@/utils/toast"; // Importação corrigida

interface UpdateOrderStatusVariables {
  orderId: string;
  newStatus: string;
}

export const useUpdateOrderStatus = () => {
  const { supabase } = useSession();
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateOrderStatusVariables>({
    mutationFn: async ({ orderId, newStatus }) => {
      if (!supabase) throw new Error("Supabase client is not available");

      const { error } = await supabase
        .from("pedidos")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      showSuccess("Status do pedido atualizado com sucesso!"); // Usando showSuccess
      // Invalida as queries de pedidos para que os dados sejam recarregados
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }); // Também invalida o dashboard
    },
    onError: (error) => {
      showError(`Erro ao atualizar status: ${error.message}`); // Usando showError
    },
  });
};