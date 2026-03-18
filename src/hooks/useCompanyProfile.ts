import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/contexts/SessionProvider';
import { toast } from 'sonner';
import { getValidToken } from '@/utils/tokenGuard';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

export interface CompanyProfile {
    company_name: string | null;
    company_slogan: string | null;
    company_phone: string | null;
    company_whatsapp: string | null;
    company_email: string | null;
    company_website: string | null;
    company_address_street: string | null;
    company_address_number: string | null;
    company_address_neighborhood: string | null;
    company_address_city: string | null;
    company_address_state: string | null;
    company_address_zip: string | null;
    company_address_complement: string | null;
    company_pix_key: string | null;
    company_pix_key_type: string | null;
    company_logo_url: string | null;
    company_primary_color: string | null;
    sidebar_shortcuts: string[] | null;
    // New fields
    gabi_templates: Record<string, string> | null;
    company_business_hours: string | null;
    wallet_balance: number | null;
    frenet_balance: number | null; // Novo campo separado
    logistics_provider: 'superfrete' | 'frenet' | null;
    frenet_token: string | null;
    superfrete_token: string | null; // Novo campo
    frenet_access_key: string | null;
    frenet_access_password: string | null;
    operator_phone: string | null;
    whatsapp_boss_group_id: string | null;
    organization_id: string | null;
}

export interface CompanyProfileUpdate {
    company_name?: string;
    company_slogan?: string;
    company_phone?: string;
    company_whatsapp?: string;
    company_email?: string;
    company_website?: string;
    company_address_street?: string;
    company_address_number?: string;
    company_address_neighborhood?: string;
    company_address_city?: string;
    company_address_state?: string;
    company_address_zip?: string;
    company_address_complement?: string;
    company_pix_key?: string;
    company_pix_key_type?: string;
    company_logo_url?: string | null;
    company_primary_color?: string;
    sidebar_shortcuts?: string[];
    // New fields
    gabi_templates?: Record<string, string>;
    company_business_hours?: string;
    logistics_provider?: 'superfrete' | 'frenet';
    wallet_balance?: number;
    frenet_balance?: number;
    frenet_token?: string;
    frenet_partner_token?: string;
    superfrete_token?: string;
    frenet_access_key?: string;
    frenet_access_password?: string;
    sync_frenet_balance?: boolean;
    operator_phone?: string | null;
    whatsapp_boss_group_id?: string | null;
}

// Helper to format full address
export const formatFullAddress = (profile: CompanyProfile | null): string => {
    if (!profile) return '';

    const parts = [
        profile.company_address_street,
        profile.company_address_number,
        profile.company_address_complement,
        profile.company_address_neighborhood,
        profile.company_address_city,
        profile.company_address_state,
        profile.company_address_zip,
    ].filter(Boolean);

    return parts.join(', ');
};

// Helper to get company info for PDF
export const getCompanyInfoForPDF = (profile: CompanyProfile | null) => {
    if (!profile) {
        return {
            company_name: 'Minha Empresa',
            phone: '',
            email: '',
            address_full: '',
            pix_key: '',
            logo_url: '',
        };
    }

    return {
        company_name: profile.company_name || 'Minha Empresa',
        phone: profile.company_phone || profile.company_whatsapp || '',
        email: profile.company_email || '',
        address_full: formatFullAddress(profile),
        pix_key: profile.company_pix_key || '',
        logo_url: profile.company_logo_url || '',
    };
};

export const useCompanyProfile = () => {
    const { supabase, session } = useSession();
    const queryClient = useQueryClient();
    const userId = session?.user?.id;

    // Fetch company profile (from profiles table) using direct REST for stability
    const { data: companyProfile, isLoading, error, refetch } = useQuery({
        queryKey: ['companyProfile', userId],
        queryFn: async () => {
            try {
                if (!userId) return null;

                const token = await getValidToken();
                if (!token) return null;

                const url = `${SUPABASE_URL}/rest/v1/profiles_v2?uid=eq.${userId}&select=company_name,company_slogan,company_phone,company_whatsapp,company_email,company_website,company_address_street,company_address_number,company_address_neighborhood,company_address_city,company_address_state,company_address_zip,company_address_complement,company_pix_key,company_pix_key_type,company_logo_url,sidebar_shortcuts,company_primary_color,gabi_templates,company_business_hours,wallet_balance,frenet_balance,logistics_provider,frenet_token,superfrete_token,frenet_access_key,frenet_access_password,operator_phone,whatsapp_boss_group_id,organization_id`;

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Error fetching company profile:', response.status, errorText);
                    return null;
                }

                const data = await response.json();
                return (data && data.length > 0) ? data[0] as CompanyProfile : null;
            } catch (err) {
                console.error('[useCompanyProfile] Fetch Error:', err);
                return null;
            }
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    });

    if (error) {
        console.error('❌ [useCompanyProfile] Query Error:', error);
    }

    // Update company profile using direct REST PATCH for stability
    const updateProfileMutation = useMutation({
        mutationFn: async (updates: CompanyProfileUpdate) => {
            if (!userId) throw new Error('User not authenticated');

            const token = await getValidToken();
            if (!token) throw new Error('Sessão expirada. Por favor, recarregue a página.');

            const url = `${SUPABASE_URL}/rest/v1/profiles_v2?uid=eq.${userId}`;
            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao atualizar perfil: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // If the UPDATE returned an empty array, it means no row matched the ID.
            // This happens if the profile row doesn't exist yet. We must create it.
            if (!data || data.length === 0) {
                console.warn('[useCompanyProfile] Update returned no data. Attemping INSERT (upsert)...');

                const insertUrl = `${SUPABASE_URL}/rest/v1/profiles`;
                const insertBody = {
                    id: userId,
                    ...updates
                };

                const insertResponse = await fetch(insertUrl, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(insertBody)
                });

                if (!insertResponse.ok) {
                    const insertError = await insertResponse.text();
                    throw new Error(`Erro ao criar perfil: ${insertResponse.status} - ${insertError}`);
                }

                const insertData = await insertResponse.json();
                return insertData[0];
            }

            return data[0];
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['companyProfile', userId] });
            toast.success('Perfil da empresa atualizado!');
        },
        onError: (error: any) => {
            console.error('Error updating company profile:', error);
            toast.error('Erro ao atualizar perfil: ' + error.message);
        },
    });

    // Upload logo
    const uploadLogo = async (file: File): Promise<string | null> => {
        if (!userId) {
            toast.error('Usuário não autenticado');
            return null;
        }

        try {
            // Validate file
            if (!file.type.startsWith('image/')) {
                toast.error('Por favor, selecione uma imagem válida');
                return null;
            }

            if (file.size > 2 * 1024 * 1024) {
                toast.error('A imagem deve ter no máximo 2MB');
                return null;
            }

            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/logo-${Date.now()}.${fileExt}`;

            // Delete old logo if exists
            if (companyProfile?.company_logo_url) {
                const oldPath = companyProfile.company_logo_url.split('/').slice(-2).join('/');
                await supabase.storage.from('company-logos').remove([oldPath]);
            }

            // Upload new logo
            const { data, error } = await supabase.storage
                .from('company-logos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true,
                });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('company-logos')
                .getPublicUrl(data.path);

            // Update profile with new logo URL
            await updateProfileMutation.mutateAsync({ company_logo_url: publicUrl });

            toast.success('Logo atualizada com sucesso!');
            return publicUrl;
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            toast.error('Erro ao fazer upload da logo: ' + error.message);
            return null;
        }
    };

    // Remove logo
    const removeLogo = async () => {
        if (!userId || !companyProfile?.company_logo_url) return;

        try {
            const oldPath = companyProfile.company_logo_url.split('/').slice(-2).join('/');
            await supabase.storage.from('company-logos').remove([oldPath]);
            await updateProfileMutation.mutateAsync({ company_logo_url: null });
            toast.success('Logo removida com sucesso!');
        } catch (error: any) {
            console.error('Error removing logo:', error);
            toast.error('Erro ao remover logo: ' + error.message);
        }
    };

    return {
        companyProfile,
        isLoading,
        error,
        refetch,
        updateProfile: updateProfileMutation.mutate,
        updateProfileAsync: updateProfileMutation.mutateAsync,
        isUpdating: updateProfileMutation.isPending,
        syncFrenetBalance: async () => {
            if (!userId) return;
            try {
                const { data, error } = await supabase.functions.invoke('frenet-proxy', {
                    body: { action: 'balance' }
                });
                if (error) throw error;
                queryClient.invalidateQueries({ queryKey: ['companyProfile', userId] });
                return data;
            } catch (err) {
                console.error('Error syncing Frenet balance:', err);
                throw err;
            }
        },
        uploadLogo,
        removeLogo,
        getCompanyInfoForPDF: () => getCompanyInfoForPDF(companyProfile),
    };
};
