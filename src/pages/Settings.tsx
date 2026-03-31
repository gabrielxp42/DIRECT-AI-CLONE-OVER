import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    ChevronDown,
    Users,
    Zap
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
import { SubProfileManager } from '@/components/SubProfileManager';
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

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [messages.length]);

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
    const { session, hasPermission } = useSession();
    const navigate = useNavigate();
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
                    .from('profiles_v2')
                    .update({
                        subscription_tier: 'pro_max',
                        is_whatsapp_plus_gifted: true,
                        is_whatsapp_plus_active: true
                    })
                    .eq('uid', user.id);

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

    const isBrandingUnlocked = true;

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

    useEffect(() => {
        if (location.hash && !isLoading) {
            const id = location.hash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
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

        if (field === 'company_primary_color') {
            const root = document.documentElement;
            const hsl = hexToHSL(value);
            const foregroundHsl = getContrastColor(value);

            root.style.setProperty('--primary', hsl);
            root.style.setProperty('--primary-foreground', foregroundHsl);
            root.style.setProperty('--primary-custom', value);
            localStorage.setItem('cached_primary_color', value);
        }
    };

    const handleSave = async () => {
        if (!hasChanges || isUpdating || isLocalUpdating) return;
        setIsLocalUpdating(true);
        try {
            await updateProfileAsync(formData);
            setHasChanges(false);
            toast({
                title: "Configurações salvas!",
                description: "As informações da sua empresa foram atualizadas.",
            });
        } catch (error) {
            console.error('Error saving:', error);
            toast({
                title: "Erro ao salvar",
                description: "Não foi possível salvar as alterações.",
                variant: "destructive"
            });
        } finally {
            setIsLocalUpdating(false);
        }
    };

    const handleImportSettings = (importedData: CompanyProfileUpdate) => {
        setFormData(prev => ({ ...prev, ...importedData }));
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
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">{step}</span>
                <h3 className="font-bold text-lg md:text-xl tracking-tight">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground italic pl-8">
                <Sparkles className="inline-block w-3 h-3 mr-1 text-primary" />
                Dica: {explanation}
            </p>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <div className="text-center">
                    <p className="text-muted-foreground text-sm">Carregando configurações...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-24 md:pb-8 overflow-x-hidden">
            <div className="container max-w-4xl py-6 md:py-8 px-4 md:px-6 space-y-6 md:space-y-8 pb-32">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações</h1>
                            <p className="text-sm md:text-base text-muted-foreground mt-1">Identidade e dados da sua gráfica</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {!isTourOpen && (
                            <Button variant="outline" size="sm" onClick={startTour} className="hidden sm:flex text-[10px] h-7 bg-primary/5 hover:bg-primary/10 border-primary/20">
                                <Sparkles className="mr-1 h-3 w-3" /> Ver Tutorial
                            </Button>
                        )}
                        
                        <div className="relative group">
                            <Button 
                                onClick={handleSave} 
                                disabled={!hasChanges || isUpdating} 
                                className={cn(
                                    "gap-2 px-6 transition-all duration-300",
                                    hasChanges && "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                                )}
                            >
                                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Salvar Alterações
                            </Button>
                            {hasChanges && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-amber-500 text-white text-[10px] px-2 py-1 rounded-md font-bold shadow-lg"
                                >
                                    Você tem alterações não salvas!
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1. Estilo Visual e Cores */}
                <Card id="theme-color-section" className="border-border/50 shadow-sm overflow-hidden scroll-mt-20">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge step={1} title="Estilo Visual e Cores" explanation="Personalize a aparência do seu workplace." />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div 
                                className="w-20 h-20 rounded-2xl border-2 border-white/10 shadow-xl transition-all duration-500" 
                                style={{ 
                                    backgroundColor: formData.company_primary_color || '#FFF200',
                                    boxShadow: !document.documentElement.classList.contains('ui-basic') ? `0 0 20px ${formData.company_primary_color}44` : 'none'
                                }} 
                            />
                            <div className="flex-1 space-y-4 w-full">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cor de Identidade (Hex)</Label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Input 
                                                value={formData.company_primary_color || '#FFF200'} 
                                                onChange={(e) => handleInputChange('company_primary_color', e.target.value)} 
                                                className="h-10 border-primary/20 pl-4 font-mono"
                                            />
                                        </div>
                                        <Input 
                                            type="color" 
                                            value={formData.company_primary_color || '#FFF200'} 
                                            onChange={(e) => handleInputChange('company_primary_color', e.target.value)} 
                                            className="w-12 h-10 p-1 cursor-pointer" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-border/20">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">Ambiente do Workplace</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                document.documentElement.classList.remove('ui-basic');
                                                localStorage.setItem('cached_ui_style', 'neon');
                                                toast({ title: "Estilo Neon ✨", description: "Visual futurista ativado." });
                                            }}
                                            className={cn(
                                                "flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all group",
                                                !document.documentElement.classList.contains('ui-basic') 
                                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                                                    : "border-border/40 hover:border-border/80"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 font-bold text-sm">
                                                <Zap className={cn("w-4 h-4", !document.documentElement.classList.contains('ui-basic') ? "text-primary" : "text-muted-foreground")} />
                                                Neon Style
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-tight">Visual com brilhos e efeitos de luz vibrantes.</p>
                                        </button>
                                        
                                        <button
                                            onClick={() => {
                                                document.documentElement.classList.add('ui-basic');
                                                localStorage.setItem('cached_ui_style', 'basic');
                                                toast({ title: "Estilo Sofisticado 💎", description: "Visual limpo e focado ativado." });
                                            }}
                                            className={cn(
                                                "flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all group",
                                                document.documentElement.classList.contains('ui-basic') 
                                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                                                    : "border-border/40 hover:border-border/80"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 font-bold text-sm">
                                                <Sparkles className={cn("w-4 h-4", document.documentElement.classList.contains('ui-basic') ? "text-primary" : "text-muted-foreground")} />
                                                Sofisticado
                                            </div>
                                            <p className="text-[10px] text-muted-foreground leading-tight">Visual limpo, moderno e focado no conteúdo.</p>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Dados Principais */}
                <Card id="company-info-section" className="border-border/50 shadow-sm overflow-hidden scroll-mt-20">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge step={2} title="Dados Principais" explanation="Como a sua gráfica será identificada no sistema." />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="company_name">Nome da Empresa</Label>
                                <Input 
                                    id="company_name"
                                    placeholder="Ex: Gráfica Exemplo"
                                    value={formData.company_name || ''} 
                                    onChange={(e) => handleInputChange('company_name', e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="company_slogan">Slogan ou Frase Curta</Label>
                                <Input 
                                    id="company_slogan"
                                    placeholder="Ex: Qualidade em cada detalhe"
                                    value={formData.company_slogan || ''} 
                                    onChange={(e) => handleInputChange('company_slogan', e.target.value)} 
                                />
                            </div>
                        </div>

                        <div className="pt-4">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 block">Contatos Oficiais</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company_phone" className="flex items-center gap-2"><Phone className="w-3 h-3 text-primary" /> Telefone Fixo</Label>
                                    <Input 
                                        id="company_phone"
                                        placeholder="(00) 0000-0000"
                                        value={formData.company_phone || ''} 
                                        onChange={(e) => handleInputChange('company_phone', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="company_whatsapp" className="flex items-center gap-2"><Smartphone className="w-3 h-3 text-green-500" /> WhatsApp</Label>
                                    <Input 
                                        id="company_whatsapp"
                                        placeholder="(00) 90000-0000"
                                        value={formData.company_whatsapp || ''} 
                                        onChange={(e) => handleInputChange('company_whatsapp', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="company_email" className="flex items-center gap-2"><Mail className="w-3 h-3 text-primary" /> E-mail de Atendimento</Label>
                                    <Input 
                                        id="company_email"
                                        type="email"
                                        placeholder="contato@grafica.com"
                                        value={formData.company_email || ''} 
                                        onChange={(e) => handleInputChange('company_email', e.target.value)} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="company_website" className="flex items-center gap-2"><Globe className="w-3 h-3 text-primary" /> Site Oficial</Label>
                                    <Input 
                                        id="company_website"
                                        placeholder="www.suagrafica.com.br"
                                        value={formData.company_website || ''} 
                                        onChange={(e) => handleInputChange('company_website', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Localização */}
                <Card id="location-section" className="border-border/50 shadow-sm overflow-hidden scroll-mt-20">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge step={3} title="Endereço da Empresa" explanation="Esses dados aparecerão no rodapé das suas faturas." />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="street">Rua / Logradouro</Label>
                                <Input 
                                    id="street"
                                    value={formData.company_address_street || ''} 
                                    onChange={(e) => handleInputChange('company_address_street', e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="number">Número</Label>
                                <Input 
                                    id="number"
                                    value={formData.company_address_number || ''} 
                                    onChange={(e) => handleInputChange('company_address_number', e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="neighborhood">Bairro</Label>
                                <Input 
                                    id="neighborhood"
                                    value={formData.company_address_neighborhood || ''} 
                                    onChange={(e) => handleInputChange('company_address_neighborhood', e.target.value)} 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="city">Cidade</Label>
                                <Input 
                                    id="city"
                                    value={formData.company_address_city || ''} 
                                    onChange={(e) => handleInputChange('company_address_city', e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="state">Estado (UF)</Label>
                                <Select 
                                    value={formData.company_address_state || ''}
                                    onValueChange={(val) => handleInputChange('company_address_state', val)}
                                >
                                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                                    <SelectContent>
                                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="zip">CEP</Label>
                                <Input 
                                    id="zip"
                                    placeholder="00000-000"
                                    value={formData.company_address_zip || ''} 
                                    onChange={(e) => handleInputChange('company_address_zip', e.target.value)} 
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Logotipo */}
                <Card id="company-logo-section" className="border-border/50 shadow-sm overflow-hidden scroll-mt-20">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge step={4} title="Identidade Visual (Logo)" explanation="Sua logo aparecerá em todos os cabeçalhos de faturas e recibos." />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <div className={cn(
                                "relative w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden",
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
                                {isUploading && (
                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 w-full sm:w-auto">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <Button 
                                    onClick={() => fileInputRef.current?.click()} 
                                    disabled={isUploading}
                                    className="gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    {companyProfile?.company_logo_url ? 'Trocar Logotipo' : 'Carregar Logotipo'}
                                </Button>
                                {companyProfile?.company_logo_url && (
                                    <Button 
                                        variant="outline" 
                                        onClick={handleRemoveLogo} 
                                        className="text-destructive hover:bg-destructive/10 border-destructive/20 gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" /> Remover
                                    </Button>
                                )}
                                <p className="text-[10px] text-muted-foreground text-center sm:text-left">Formatos aceitos: PNG, JPG ou SVG. Recomendado: 512x512px.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Dados de Pagamento (PIX) */}
                <Card id="billing-section" className="border-border/50 shadow-sm overflow-hidden scroll-mt-20">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge step={5} title="Informações de Pagamento (PIX)" explanation="Estes dados serão usados para gerar o QR Code PIX nos seus orçamentos." />
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="pix_key_type">Tipo de Chave</Label>
                                <Select 
                                    value={formData.company_pix_key_type || ''}
                                    onValueChange={(val) => handleInputChange('company_pix_key_type', val)}
                                >
                                    <SelectTrigger id="pix_key_type"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                                    <SelectContent>
                                        {PIX_KEY_TYPES.map(type => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pix_key">Sua Chave PIX</Label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                                        <Smartphone className="w-4 h-4" />
                                    </div>
                                    <Input 
                                        id="pix_key"
                                        placeholder="Digite aqui sua chave PIX"
                                        className="pl-10"
                                        value={formData.company_pix_key || ''} 
                                        onChange={(e) => handleInputChange('company_pix_key', e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 flex items-start gap-3">
                            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                <b>Importante:</b> Certifique-se de que a chave PIX está correta. Ela será exibida para seus clientes em todos os links de pagamento e PDFs gerados pela plataforma.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Team & Connections (Separated or Integrated) */}
                <div id="team-section" className="pt-4">
                    <SubProfileManager />
                </div>

                <div id="whatsapp-settings-section" className="pt-4">
                    <WhatsAppConnection />
                </div>

                {/* Bottom Tools Zone */}
                <div className="pt-8 mt-8 border-t border-dashed opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-xs text-muted-foreground mb-4 font-mono uppercase tracking-widest text-center">Configurações Avançadas de Sistema</p>
                    <DemoDataGenerator />
                </div>

                {/* Modals & Guides */}
                <MagicSettingsModal isOpen={isMagicModalOpen} onOpenChange={setIsMagicModalOpen} onImportSettings={handleImportSettings} />
                <TutorialGuide steps={SETTINGS_TOUR} isOpen={isTourOpen} currentStep={currentStep} onNext={nextStep} onPrev={prevStep} onClose={closeTour} />
                <GabiSuccessModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} />
            </div>
        </div>
    );
}
