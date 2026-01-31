import { useState, useEffect } from 'react';

const DEFAULT_PAYMENT_METHODS = [
    { id: 'money', label: 'Dinheiro', icon: 'Banknote', color: 'emerald' },
    { id: 'pix', label: 'PIX', icon: 'Smartphone', color: 'cyan' },
    { id: 'card_machine', label: 'Maquininha', icon: 'CreditCard', color: 'violet' },
    { id: 'boleto', label: 'Boleto', icon: 'Barcode', color: 'orange' },
    { id: 'transfer', label: 'Transferência', icon: 'Building2', color: 'blue' }
];

export interface PaymentMethodConfig {
    id: string;
    label: string;
    icon: string;
    color: string;
    enabled: boolean;
}

const STORAGE_KEY = 'company_payment_methods';

export const usePaymentMethods = () => {
    const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure new defaults appear if storage is old, 
                // but respect user's enabled/disabled state
                const merged = DEFAULT_PAYMENT_METHODS.map(def => {
                    const found = parsed.find((p: any) => p.id === def.id);
                    return found ? { ...def, enabled: found.enabled } : { ...def, enabled: true }; // Default enabled: true
                });
                setMethods(merged);
            } catch (e) {
                console.error('Falha ao carregar metodos de pagamento', e);
                setMethods(DEFAULT_PAYMENT_METHODS.map(m => ({ ...m, enabled: true })));
            }
        } else {
            // First time load
            setMethods(DEFAULT_PAYMENT_METHODS.map(m => ({ ...m, enabled: true })));
        }
    }, []);

    const toggleMethod = (id: string) => {
        setMethods(prev => {
            const updated = prev.map(m =>
                m.id === id ? { ...m, enabled: !m.enabled } : m
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const activeMethods = methods.filter(m => m.enabled);

    return {
        methods,
        activeMethods,
        toggleMethod
    };
};
