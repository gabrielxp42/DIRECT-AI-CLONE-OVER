import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";
import { toast } from "react-hot-toast"; // Para notificações

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
      toast.success("Status do pedido atualizado com sucesso!");
      // Invalida as queries de pedidos para que os dados sejam recarregados
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }); // Também invalida o dashboard
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
};