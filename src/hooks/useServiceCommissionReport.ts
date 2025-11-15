import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/contexts/SessionProvider";

export interface CommissionServiceItem {
  service_name: string;
  total_quantity: number;
  total_revenue: number;
  order_count: number;
}

export interface CommissionReport {
  items: CommissionServiceItem[];
  totalCommissionRevenue: number;
  totalServicesCount: number;
}

const fetchCommissionReport = async (
  supabase: any, 
  startDate: string, 
  endDate: string,
  excludedNames: string[]
): Promise<CommissionReport> => {
  // Alterado para chamar a nova função RPC
  const { data, error } = await supabase.rpc('get_commission_report_v2', {
    p_start_date: startDate,
    p_end_date: endDate,
    excluded_service_names: excludedNames
  });

  if (error) throw error;

  const totalCommissionRevenue = data.reduce((sum: number, item: CommissionServiceItem) => sum + item.total_revenue, 0);
  const totalServicesCount = data.reduce((sum: number, item: CommissionServiceItem) => sum + item.total_quantity, 0);

  return {
    items: data as CommissionServiceItem[],
    totalCommissionRevenue,
    totalServicesCount,
  };
};

export const useServiceCommissionReport = (startDate: Date | null, endDate: Date | null, excludedNames: string[] = ['Sedex']) => {
  const { supabase } = useSession();

  const startISO = startDate?.toISOString() || '';
  const endISO = endDate?.toISOString() || '';

  return useQuery<CommissionReport>({
    queryKey: ["service-commission-report", startISO, endISO, excludedNames],
    queryFn: () => fetchCommissionReport(supabase, startISO, endISO, excludedNames),
    enabled: !!supabase && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
};