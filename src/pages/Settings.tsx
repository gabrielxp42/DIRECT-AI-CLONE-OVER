import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanyProfile, CompanyProfileUpdate } from '@/hooks/useCompanyProfile';
import {
    Building2,
    Phone,
    Mail,
    MapPin,
    CreditCard,
    Upload,
    Trash2,
    Save,
    Loader2,
    ImageIcon,
    Globe,
    Sparkles,
    Wand2,
    Info,
    Palette,
    Lock,
    Trophy,
    Target,
    CheckCircle2,
    Banknote,
    Smartphone,
    Barcode,
    Wallet,
    CheckSquare,
    Square,
    Calculator,
    Zap,
    ChevronDown
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import { cn } from '@/lib/utils';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

import { TutorialGuide } from '@/components/TutorialGuide';
import { useTour } from '@/hooks/useTour';
import { SETTINGS_TOUR } from '@/utils/tours';
import { MagicSettingsModal } from '@/components/MagicSettingsModal';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { hexToHSL, getContrastColor } from '@/utils/colors';
import { WhatsAppConnection } from '@/components/WhatsAppConnection';
import { DemoDataGenerator } from '@/components/DemoDataGenerator';
import { GabiSuccessModal } from '@/components/GabiSuccessModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

const PIX_KEY_TYPES = [
    { value: 'cpf', label: 'CPF' },
    { value: 'cnpj', label: 'CNPJ' },
    { value: 'email', label: 'E-mail' },
    { value: 'phone', label: 'Telefone' },
    { value: 'random', label: 'Chave Aleatória' },
];

const ESTADOS_BR = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const MagicMessageRotator = () => {
    const messages = [
        "✨ Exporte dados em 1 click com IA",
        "🚀 Preencha tudo automaticamente!",
        "💡 IA: Economize seu tempo",
        "📸 Teste com foto de cartão!",
        "🪄 A mágica acontece aqui"
    ];
    const [index, setIndex] = useState(0);
    const [magicCode, setMagicCode] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isLoadingMagic, setIsLoadingMagic] = useState(false);

    const handleMagicCode = async () => {
        if (magicCode === 'DTFAGUDOS') {
            setIsLoadingMagic(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'pro_max',
                        is_whatsapp_plus_gifted: true,
                        is_whatsapp_plus_active: true
                    })
                    .eq('id', user.id);

                if (error) throw error;

                setShowSuccessModal(true);
                setMagicCode('');
            } catch (error) {
                console.error('Error applying magic code:', error);
                toast({
                    title: "Erro ao ativar código",
                    description: "Tente novamente mais tarde.",
                    variant: "destructive"
                });
            } finally {
                setIsLoadingMagic(false);
            }
        }
    };

    return (
        <div className="relative h-5 overflow-hidden flex items-center justify-center min-w-[170px]">
            <AnimatePresence mode="wait">
                <motion.span
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="font-medium text-[10px] md:text-[11px] whitespace-nowrap absolute top-0.5"
                >
                    {messages[index]}
                </motion.span>
            </AnimatePresence>
        </div>
    );
};



export default function Settings() {
    const {
        companyProfile,
        isLoading,
        updateProfileAsync,
        isUpdating,
        uploadLogo,
        removeLogo
    } = useCompanyProfile();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [formData, setFormData] = useState<CompanyProfileUpdate>({});
    const [hasChanges, setHasChanges] = useState(false);
    const isInitialized = useRef(false);
    const [isLocalUpdating, setIsLocalUpdating] = useState(false);
    const [isMagicModalOpen, setIsMagicModalOpen] = useState(false);
    const { session } = useSession();
    const { methods: paymentMethods, toggleMethod: togglePaymentMethod } = usePaymentMethods();

    const [magicCode, setMagicCode] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isLoadingMagic, setIsLoadingMagic] = useState(false);

    const handleMagicCode = async () => {
        if (magicCode === 'DTFAGUDOS') {
            setIsLoadingMagic(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        subscription_tier: 'pro_max',
                        is_whatsapp_plus_gifted: true,
                        is_whatsapp_plus_active: true
                    })
                    .eq('id', user.id);

                if (error) throw error;

                setShowSuccessModal(true);
                setMagicCode('');
            } catch (error) {
                console.error('Error applying magic code:', error);
                toast({
                    title: "Erro ao ativar código",
                    description: "Tente novamente mais tarde.",
                    variant: "destructive"
                });
            } finally {
                setIsLoadingMagic(false);
            }
        }
    };


    const isBrandingUnlocked = !!(
        companyProfile?.company_logo_url ||
        (companyProfile?.company_primary_color && companyProfile.company_primary_color !== '#FFF200') ||
        (typeof localStorage !== 'undefined' && localStorage.getItem('branding_feature_unlocked') === 'true') ||
        session?.user?.email?.includes('dtagudos') ||
        session?.user?.email?.includes('gabriel')
    );

    const {
        isTourOpen,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        closeTour,
        shouldAutoStart
    } = useTour(SETTINGS_TOUR, 'settings');

    const location = useLocation();

    // Handle deep linking/scrolling when hash is present
    useEffect(() => {
        if (location.hash && !isLoading) {
            const id = location.hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                // Pequeno delay para garantir que o layout renderizou
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        }
    }, [location.hash, isLoading]);

    useEffect(() => {
        if (shouldAutoStart && !isLoading) {
            const timer = setTimeout(startTour, 1000);
            return () => clearTimeout(timer);
        }
    }, [shouldAutoStart, isLoading, startTour]);


    // Initialize form data when profile loads
    useEffect(() => {
        if (companyProfile && !isInitialized.current) {
            setFormData({
                company_name: companyProfile.company_name || '',
                company_slogan: companyProfile.company_slogan || '',
                company_phone: companyProfile.company_phone || '',
                company_whatsapp: companyProfile.company_whatsapp || '',
                company_email: companyProfile.company_email || '',
                company_website: companyProfile.company_website || '',
                company_address_street: companyProfile.company_address_street || '',
                company_address_number: companyProfile.company_address_number || '',
                company_address_neighborhood: companyProfile.company_address_neighborhood || '',
                company_address_city: companyProfile.company_address_city || '',
                company_address_state: companyProfile.company_address_state || '',
                company_address_zip: companyProfile.company_address_zip || '',
                company_address_complement: companyProfile.company_address_complement || '',
                company_pix_key: companyProfile.company_pix_key || '',
                company_pix_key_type: companyProfile.company_pix_key_type || '',
                company_primary_color: companyProfile.company_primary_color || '#FFF200',
            });
            isInitialized.current = true;
        }
    }, [companyProfile]);

    const handleInputChange = (field: keyof CompanyProfileUpdate, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);

        // Real-time visual feedback for color
        if (field === 'company_primary_color') {
            const root = document.documentElement;
            const hsl = hexToHSL(value);
            const foregroundHsl = getContrastColor(value);

            root.style.setProperty('--primary', hsl);
            root.style.setProperty('--primary-foreground', foregroundHsl);
            root.style.setProperty('--primary-custom', value);
        }
    };

    const handleSave = async () => {
        if (!hasChanges || isUpdating || isLocalUpdating) return;

        setIsLocalUpdating(true);
        try {
            await updateProfileAsync(formData);
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving:', error);
        } finally {
            setIsLocalUpdating(false);
        }
    };

    const handleImportSettings = (importedData: CompanyProfileUpdate) => {
        setFormData(prev => ({
            ...prev,
            ...importedData
        }));
        setHasChanges(true);
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            await uploadLogo(file);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemoveLogo = async () => {
        if (confirm('Tem certeza que deseja remover a logo?')) {
            await removeLogo();
        }
    };

    const StepBadge = ({ step, title, explanation }: { step: number; title: string; explanation: string }) => (
        <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {step}
                </span>
                <h3 className="font-bold text-lg md:text-xl tracking-tight">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground italic pl-8">
                <Sparkles className="inline-block w-3 h-3 mr-1 text-primary" />
                Por que isso é importante? {explanation}
            </p>
        </div>
    );

    console.log('⚙️ [Settings] Rendering Settings page. Loading state:', {
        isLoading,
        profileLoaded: !!companyProfile,
        hasChanges,
        isLocalUpdating,
        isUpdating
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <div className="text-center">
                    <p className="text-muted-foreground text-sm">Carregando configurações...</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">Se demorar muito, tente recarregar a página.</p>
                </div>
                {!companyProfile && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.location.reload()}
                        className="text-xs"
                    >
                        Tentar Recarregar
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8 overflow-x-hidden">
            <div className="container max-w-4xl py-6 md:py-8 px-4 md:px-6 space-y-6 md:space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
                            <p className="text-sm md:text-base text-muted-foreground mt-1">
                                Personalize as informações da sua empresa
                            </p>
                        </div>
                        {!isTourOpen && (
                            <div className="flex items-center gap-2 relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={startTour}
                                    className="hidden sm:flex text-[10px] h-7 bg-primary/5 hover:bg-primary/10 border-primary/20"
                                >
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    Ver Tutorial
                                </Button>
                                {/* Premium Magic Engagement Tooltip */}
                                <div className="absolute -top-12 right-0 pointer-events-none hidden md:block z-20">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: 0.5, duration: 0.5 }}
                                        className="relative bg-primary/10 dark:bg-primary/20 backdrop-blur-md border border-primary/20 dark:border-primary/10 text-primary px-3 py-1.5 rounded-full shadow-[0_8px_16px_-6px_var(--primary-custom)]/20 flex items-center gap-2"
                                    >
                                        <div className="absolute -bottom-1 right-6 w-2.5 h-2.5 bg-primary/10 dark:bg-primary/20 border-r border-b border-primary/20 dark:border-primary/10 backdrop-blur-md rotate-45 transform origin-center"></div>
                                        <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                                        <MagicMessageRotator />
                                    </motion.div>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsMagicModalOpen(true)}
                                                className="flex text-[10px] h-7 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary font-bold gap-1 relative z-10"
                                            >
                                                <Wand2 className="h-3 w-3" />
                                                Preenchimento Mágico
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[200px] text-xs p-3">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-bold flex items-center gap-1 text-primary">
                                                    <Sparkles className="h-3 w-3" /> Facilidade para você!
                                                </p>
                                                <p>Carregue as informações da sua empresa através de uma <b>foto de um cartão de visita</b>, print de site ou simples texto.</p>
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isUpdating}
                        className="hidden md:flex gap-2"
                    >
                        {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar Alterações
                    </Button>

                </div>

                {/* Color Section - New White Label Feature */}
                <Card id="theme-color-section" className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <StepBadge
                                step={1}
                                title="Cores da Marca"
                                explanation="Escolha a cor que representa sua gráfica. Todo o sistema se adaptará a ela instantaneamente."
                            />
                            {isBrandingUnlocked ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                                <Palette className="w-5 h-5 text-primary animate-pulse" />
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 relative">
                        {!isBrandingUnlocked && (
                            <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                                <div className="max-w-xs space-y-4 animate-in fade-in zoom-in duration-500">
                                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-sm uppercase italic">Recurso Bloqueado</h4>
                                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                                            Venda mais para liberar! A personalização visual é um prêmio para usuários elite.
                                            <br />
                                            <span className="text-primary font-bold">Meta: 100 Clientes</span>
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-[10px] border-primary/20 bg-primary/5 font-bold uppercase"
                                        onClick={() => window.location.href = '/'}
                                    >
                                        Ver meu progresso
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className={cn("flex flex-col sm:flex-row items-center gap-6", !isBrandingUnlocked && "opacity-20 grayscale pointer-events-none")}>
                            <div
                                className="w-16 h-16 rounded-xl border shadow-inner transition-colors duration-300"
                                style={{ backgroundColor: formData.company_primary_color || '#FFF200' }}
                            />
                            <div className="flex-1 space-y-3 w-full">
                                <Label htmlFor="primary_color" className="text-xs uppercase tracking-wider text-muted-foreground block">Cor Primária (Hex)</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="primary_color"
                                            value={formData.company_primary_color || '#FFF200'}
                                            onChange={(e) => handleInputChange('company_primary_color', e.target.value)}
                                            placeholder="#FFF200"
                                            className="h-11 md:h-10 pl-10"
                                        />
                                        <div
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border shadow-sm"
                                            style={{ backgroundColor: formData.company_primary_color || '#FFF200' }}
                                        />
                                    </div>
                                    <Input
                                        type="color"
                                        value={formData.company_primary_color || '#FFF200'}
                                        onChange={(e) => handleInputChange('company_primary_color', e.target.value)}
                                        className="w-12 h-11 md:h-10 p-1 cursor-pointer bg-background"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {['#FFF200', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b', '#000000'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => handleInputChange('company_primary_color', color)}
                                            className={cn(
                                                "w-6 h-6 rounded-full border border-border/50 transition-transform hover:scale-110",
                                                (formData.company_primary_color === color) && "ring-2 ring-primary ring-offset-2"
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Logo Section */}
                <Card id="company-logo-section" className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                            <StepBadge
                                step={2}
                                title="Identidade Visual"
                                explanation="Sua marca aparecerá no topo de todos os PDFs e notas gerados."
                            />
                            {!isBrandingUnlocked && <Lock className="w-4 h-4 text-muted-foreground" />}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 relative">
                        {!isBrandingUnlocked && (
                            <div className="absolute inset-0 z-10 bg-background/20 backdrop-blur-[1px] pointer-events-none" />
                        )}
                        <div className={cn("flex flex-col sm:flex-row items-center gap-6", !isBrandingUnlocked && "opacity-20 grayscale pointer-events-none")}>
                            {/* Logo Preview */}
                            <div className={cn(
                                "relative w-28 h-28 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden",
                                "bg-muted/30 transition-all duration-300",
                                !companyProfile?.company_logo_url && "hover:border-primary/50 group"
                            )}>
                                {companyProfile?.company_logo_url ? (
                                    <img
                                        src={companyProfile.company_logo_url}
                                        alt="Logo"
                                        className="w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <Building2 className="w-10 h-10 text-muted-foreground/50" />
                                )}
                            </div>

                            {/* Upload Controls */}
                            <div className="flex flex-col gap-3 w-full sm:w-auto">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />

                                <Button
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="gap-2 w-full sm:w-auto"
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Upload className="w-4 h-4" />
                                    )}
                                    {companyProfile?.company_logo_url ? 'Trocar Logo' : 'Fazer Upload'}
                                </Button>

                                {companyProfile?.company_logo_url && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveLogo}
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 w-full sm:w-auto"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remover Logo
                                    </Button>
                                )}

                                <p className="text-[11px] text-muted-foreground text-center sm:text-left">
                                    PNG, JPG ou SVG. Máximo 2MB.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-6">
                    {/* Company Info */}
                    <Card id="company-info-section" className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/30">
                            <StepBadge
                                step={3}
                                title="Dados da Empresa"
                                explanation="O nome e slogan oficial que seus clientes verão primeiro."
                            />
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_name" className="text-xs uppercase tracking-wider text-muted-foreground">Nome da Empresa *</Label>
                                    <Input
                                        id="company_name"
                                        value={formData.company_name || companyProfile?.company_name || ''}
                                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                                        placeholder="Ex: Minha Gráfica DTF"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_slogan" className="text-xs uppercase tracking-wider text-muted-foreground">Slogan / Frase Curta</Label>
                                    <Input
                                        id="company_slogan"
                                        value={formData.company_slogan || companyProfile?.company_slogan || ''}
                                        onChange={(e) => handleInputChange('company_slogan', e.target.value)}
                                        placeholder="Ex: Qualidade que você vê"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Info */}
                    <Card id="contact-info-section" className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/30">
                            <StepBadge
                                step={4}
                                title="Como te Encontrar"
                                explanation="Telefone e e-mail essenciais para o cliente tirar dúvidas ou aprovar serviços."
                            />
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_phone" className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                                    <Input
                                        id="company_phone"
                                        value={formData.company_phone || companyProfile?.company_phone || ''}
                                        onChange={(e) => handleInputChange('company_phone', e.target.value)}
                                        placeholder="(00) 0000-0000"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_whatsapp" className="text-xs uppercase tracking-wider text-muted-foreground">WhatsApp</Label>
                                    <Input
                                        id="company_whatsapp"
                                        value={formData.company_whatsapp || companyProfile?.company_whatsapp || ''}
                                        onChange={(e) => handleInputChange('company_whatsapp', e.target.value)}
                                        placeholder="+55 00 00000-0000"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_email" className="text-xs uppercase tracking-wider text-muted-foreground">E-mail Comercial</Label>
                                    <Input
                                        id="company_email"
                                        type="email"
                                        value={formData.company_email || companyProfile?.company_email || ''}
                                        onChange={(e) => handleInputChange('company_email', e.target.value)}
                                        placeholder="contato@empresa.com"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_website" className="text-xs uppercase tracking-wider text-muted-foreground">Website / Instagram</Label>
                                    <Input
                                        id="company_website"
                                        value={formData.company_website || companyProfile?.company_website || ''}
                                        onChange={(e) => handleInputChange('company_website', e.target.value)}
                                        placeholder="www.empresa.com"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Address */}
                    <Card id="address-info-section" className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/30">
                            <StepBadge
                                step={5}
                                title="Onde você está"
                                explanation="Seu endereço físico é necessário para entregas e coletas de materiais."
                            />
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="company_address_street" className="text-xs uppercase tracking-wider text-muted-foreground">Rua / Logradouro</Label>
                                    <Input
                                        id="company_address_street"
                                        value={formData.company_address_street || companyProfile?.company_address_street || ''}
                                        onChange={(e) => handleInputChange('company_address_street', e.target.value)}
                                        placeholder="Ex: Av. Brasil"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_address_number" className="text-xs uppercase tracking-wider text-muted-foreground">Número</Label>
                                    <Input
                                        id="company_address_number"
                                        value={formData.company_address_number || companyProfile?.company_address_number || ''}
                                        onChange={(e) => handleInputChange('company_address_number', e.target.value)}
                                        placeholder="123"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_address_complement" className="text-xs uppercase tracking-wider text-muted-foreground">Complemento</Label>
                                    <Input
                                        id="company_address_complement"
                                        value={formData.company_address_complement || companyProfile?.company_address_complement || ''}
                                        onChange={(e) => handleInputChange('company_address_complement', e.target.value)}
                                        placeholder="Ex: Sala 102"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_address_neighborhood" className="text-xs uppercase tracking-wider text-muted-foreground">Bairro</Label>
                                    <Input
                                        id="company_address_neighborhood"
                                        value={formData.company_address_neighborhood || companyProfile?.company_address_neighborhood || ''}
                                        onChange={(e) => handleInputChange('company_address_neighborhood', e.target.value)}
                                        placeholder="Ex: Centro"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1 space-y-2">
                                    <Label htmlFor="company_address_city" className="text-xs uppercase tracking-wider text-muted-foreground">Cidade</Label>
                                    <Input
                                        id="company_address_city"
                                        value={formData.company_address_city || companyProfile?.company_address_city || ''}
                                        onChange={(e) => handleInputChange('company_address_city', e.target.value)}
                                        placeholder="Ex: Rio de Janeiro"
                                        className="h-11 md:h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_address_state" className="text-xs uppercase tracking-wider text-muted-foreground">Estado</Label>
                                    <Select
                                        value={formData.company_address_state || companyProfile?.company_address_state || ''}
                                        onValueChange={(value) => handleInputChange('company_address_state', value)}
                                    >
                                        <SelectTrigger id="company_address_state" className="h-11 md:h-10">
                                            <SelectValue placeholder="UF" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ESTADOS_BR.map(estado => (
                                                <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_address_zip" className="text-xs uppercase tracking-wider text-muted-foreground">CEP</Label>
                                    <Input
                                        id="company_address_zip"
                                        value={formData.company_address_zip || companyProfile?.company_address_zip || ''}
                                        onChange={(e) => handleInputChange('company_address_zip', e.target.value)}
                                        placeholder="00000-000"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Info (PIX) */}
                    <Card id="payment-info-section" className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/30">
                            <StepBadge
                                step={6}
                                title="Recebimento PIX"
                                explanation="Facilite o pagamento! Sua chave aparecerá direto na nota para o cliente."
                            />
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_pix_key_type" className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Chave</Label>
                                    <Select
                                        value={formData.company_pix_key_type || companyProfile?.company_pix_key_type || ''}
                                        onValueChange={(value) => handleInputChange('company_pix_key_type', value)}
                                    >
                                        <SelectTrigger id="company_pix_key_type" className="h-11 md:h-10">
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PIX_KEY_TYPES.map(type => (
                                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="company_pix_key" className="text-xs uppercase tracking-wider text-muted-foreground">Chave PIX</Label>
                                    <Input
                                        id="company_pix_key"
                                        value={formData.company_pix_key || companyProfile?.company_pix_key || ''}
                                        onChange={(e) => handleInputChange('company_pix_key', e.target.value)}
                                        placeholder="Sua chave para pagamentos"
                                        className="h-11 md:h-10"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Methods Configuration */}
                    <Card id="payment-methods-section" className="border-border/50 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-muted/30">
                            <StepBadge
                                step={7}
                                title="Formas de Pagamento"
                                explanation="Defina quais opções de pagamento aparecerão como atalho na hora de alterar o status do pedido."
                            />
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {paymentMethods.map((method) => {
                                    const iconMap: Record<string, any> = { Banknote, Smartphone, CreditCard, Barcode, Building2 };
                                    const Icon = iconMap[method.icon] || Banknote;
                                    const colorMap: Record<string, string> = {
                                        emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                                        cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 text-cyan-700 dark:text-cyan-300',
                                        violet: 'from-violet-500/20 to-violet-600/10 border-violet-500/40 text-violet-700 dark:text-violet-300',
                                        orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/40 text-orange-700 dark:text-orange-300',
                                        blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-700 dark:text-blue-300',
                                    };
                                    // Base styles for active state
                                    const activeStyle = colorMap[method.color] || colorMap.emerald;
                                    // Inactive style (grayscale)
                                    const inactiveStyle = "bg-muted border-dashed border-border text-muted-foreground opacity-70 grayscale";

                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => togglePaymentMethod(method.id)}
                                            className={cn(
                                                "relative flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-300",
                                                method.enabled
                                                    ? `bg-gradient-to-br ${activeStyle} shadow-lg hover:scale-[1.02]`
                                                    : `${inactiveStyle} hover:opacity-100 hover:border-primary/30`
                                            )}
                                        >
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                                method.enabled ? "bg-background/30 backdrop-blur-sm" : "bg-muted-foreground/10"
                                            )}>
                                                <Icon className={cn("w-5 h-5", method.enabled ? "opacity-100" : "opacity-50")} />
                                            </div>
                                            <span className="text-sm font-bold">{method.label}</span>

                                            {/* Checkbox indicator */}
                                            <div className="absolute top-2 right-2">
                                                {method.enabled ? (
                                                    <CheckSquare className="w-4 h-4 text-primary" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-muted-foreground/50" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* WhatsApp Connection Section */}
                    <div id="whatsapp-settings-section">
                        <WhatsAppConnection />
                    </div>
                </div>

                {/* Bottom Save Button (Desktop/Flow) */}
                <div className="flex justify-end pt-4">
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isUpdating}
                        className="w-full md:w-auto gap-2 h-11 px-8 shadow-sm"
                        size="lg"
                    >
                        {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Salvar Alterações
                    </Button>
                </div>

                {/* Magic Unlock Section (Premium Card) */}
                <div className="mt-8 pt-6 border-t border-dashed border-slate-700/50">
                    <div
                        onClick={() => setIsMagicModalOpen(true)}
                        className="relative group overflow-hidden rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 transition-all hover:bg-slate-900/60 hover:border-slate-600 cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />

                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#ffd93d]/10 flex items-center justify-center ring-1 ring-[#ffd93d]/20 group-hover:ring-[#ffd93d]/50 transition-all">
                                <Zap className="w-6 h-6 text-[#ffd93d]" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <h3 className="text-sm font-bold text-slate-200">Possui um Código de Resgate?</h3>
                                <p className="text-xs text-slate-400">Ative recursos exclusivos para sua conta.</p>
                            </div>
                            <Button variant="ghost" size="icon" className="text-slate-500 group-hover:text-slate-200">
                                <ChevronDown className="w-4 h-4 -rotate-90" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Redeem Code Modal */}
                <Dialog open={isMagicModalOpen} onOpenChange={setIsMagicModalOpen}>
                    <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800">
                        <DialogHeader>
                            <DialogTitle className="text-center text-xl font-black uppercase tracking-widest text-slate-200">
                                <span className="text-[#ffd93d]">Resgatar</span> Código
                            </DialogTitle>
                            <DialogDescription className="text-center text-slate-400">
                                Digite o código mágico para desbloquear o poder total.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-6 flex justify-center">
                            <Input
                                type="text"
                                placeholder="DIGITE AQUI"
                                className="text-center text-2xl font-black uppercase tracking-[0.2em] h-16 w-full max-w-[280px] bg-slate-900/50 border-2 border-slate-800 focus:border-[#ffd93d] focus:ring-[#ffd93d]/20 transition-all rounded-xl"
                                value={magicCode}
                                onChange={(e) => setMagicCode(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleMagicCode();
                                        setIsMagicModalOpen(false);
                                    }
                                }}
                                autoFocus
                            />
                        </div>

                        <DialogFooter className="sm:justify-center">
                            <Button
                                size="lg"
                                className="w-full max-w-[280px] bg-gradient-to-r from-[#ffd93d] to-[#ff9f43] text-slate-950 font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                                onClick={() => {
                                    handleMagicCode();
                                    setIsMagicModalOpen(false);
                                }}
                                disabled={isLoadingMagic || !magicCode}
                            >
                                {isLoadingMagic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-current" />}
                                Resgatar Agora
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <GabiSuccessModal
                    isOpen={showSuccessModal}
                    onClose={() => setShowSuccessModal(false)}
                />

                {/* Premium Sticky Bottom Bar (Mobile) */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-50">
                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || isUpdating}
                        className={cn(
                            "w-full h-12 gap-2 text-base font-semibold transition-all duration-300 shadow-lg shadow-primary/20",
                            hasChanges && "animate-pulse-subtle"
                        )}
                        size="lg"
                    >
                        {isUpdating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Save className="w-5 h-5" />
                        )}
                        Salvar Configurações
                    </Button>
                </div>
                {/* Demo Tools Zone */}
                <div className="pt-8 mt-8 border-t border-dashed opacity-50 hover:opacity-100 transition-opacity">
                    <p className="text-xs text-muted-foreground mb-4 font-mono uppercase tracking-widest">Área de Demonstração</p>
                    <DemoDataGenerator />
                </div>

                <MagicSettingsModal
                    isOpen={isMagicModalOpen}
                    onOpenChange={setIsMagicModalOpen}
                    onImportSettings={handleImportSettings}
                />
                <TutorialGuide
                    steps={SETTINGS_TOUR}
                    isOpen={isTourOpen}
                    currentStep={currentStep}
                    onNext={nextStep}
                    onPrev={prevStep}
                    onClose={closeTour}
                />
            </div>

        </div>
    );
}
