import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionProvider';
import { toast } from '@/components/ui/use-toast';

export const useRealtimeSync = () => {
    const queryClient = useQueryClient();
    const { session } = useSession();
    const userId = session?.user?.id;

    useEffect(() => {
        if (!userId) return;

        console.log('[Realtime] Iniciando sincronização para o usuário:', userId);

        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'pedidos',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    console.log('[Realtime] Alteração em Pedidos detectada:', payload);

                    // Invalida cache para forçar recarregamento
                    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
                    queryClient.invalidateQueries({ queryKey: ['pedidos'] });
                    queryClient.invalidateQueries({ queryKey: ['all-pedidos-unpaginated'] });

                    // Feedback sutil (opcional)
                    if (payload.eventType === 'INSERT') {
                        toast({
                            title: "Novo Pedido!",
                            description: "Os dados do dashboard foram atualizados.",
                            duration: 3000,
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'clientes',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    console.log('[Realtime] Alteração em Clientes detectada');
                    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
                    queryClient.invalidateQueries({ queryKey: ['clientes'] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'user_achievements',
                    filter: `user_id=eq.${userId}`
                },
                () => {
                    console.log('[Realtime] Nova conquista detectada!');
                    queryClient.invalidateQueries({ queryKey: ['user_achievements'] });
                    // O SmartGoalCard vai reagir a essa mudança automaticamente
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ai_agent_training'
                },
                (payload) => {
                    console.log('[Realtime] Alteração em AI Agent Training detectada:', payload.eventType);
                    queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
                    queryClient.invalidateQueries({ queryKey: ['ai-training'] });
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Status da conexão:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, userId]);
};
