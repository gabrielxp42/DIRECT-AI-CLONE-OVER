import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TutorialGuide } from '@/components/TutorialGuide';
import { useTour } from '@/hooks/useTour';
import { SETTINGS_TOUR } from '@/utils/tours';
import { Sparkles, Wand2, Info } from 'lucide-react';
import { MagicSettingsModal } from '@/components/MagicSettingsModal';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

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

    const {
        isTourOpen,
        currentStep,
        startTour,
        nextStep,
        prevStep,
        closeTour,
        shouldAutoStart
    } = useTour(SETTINGS_TOUR, 'settings');

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
            });
            isInitialized.current = true;
        }
    }, [companyProfile]);

    const handleInputChange = (field: keyof CompanyProfileUpdate, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
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
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={startTour}
                                    className="hidden sm:flex text-[10px] h-7 bg-primary/5 hover:bg-primary/10 border-primary/20"
                                >
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    Ver Tutorial
                                </Button>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsMagicModalOpen(true)}
                                                className="flex text-[10px] h-7 bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold gap-1"
                                            >
                                                <Wand2 className="h-3 w-3" />
                                                Preenchimento Mágico
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[200px] text-xs p-3">
                                            <div className="flex flex-col gap-1">
                                                <p className="font-bold flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
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

                {/* Logo Section */}
                <Card id="company-logo-section" className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader className="pb-4 bg-muted/30">
                        <StepBadge
                            step={1}
                            title="Identidade Visual"
                            explanation="Sua marca aparecerá no topo de todos os PDFs e notas gerados."
                        />
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
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
                                step={2}
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
                                step={3}
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
                                step={4}
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
                                step={5}
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
            </div>

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
    );
}
