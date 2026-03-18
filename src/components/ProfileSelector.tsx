import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  ShieldCheck, 
  Palette, 
  Printer, 
  Headset, 
  Lock, 
  Plus, 
  ChevronRight,
  ArrowLeft,
  Settings2,
  Sparkle
} from 'lucide-react';
import { useSession } from '@/contexts/SessionProvider';
import type { SubProfile, UserRole } from '@/contexts/SessionProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export const ProfileSelector: React.FC = () => {
  const { profile, activeSubProfile, switchSubProfile } = useSession();
  const [subProfiles, setSubProfiles] = useState<SubProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selection/PIN States
  const [selectingProfile, setSelectingProfile] = useState<SubProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<'switch' | 'permissions'>('switch');
  
  // Management States
  const [isManagedMode, setIsManagedMode] = useState(false);
  const [editingSub, setEditingSub] = useState<SubProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSetupPinModal, setShowSetupPinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSettingUp, setIsSettingUp] = useState(false);
  
  // States for Create/Edit
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('atendente');

  // Permissions Management
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [tempPermissions, setTempPermissions] = useState<Record<UserRole, Record<string, boolean>> | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const PERMISSION_LABELS: Record<string, { label: string, description: string }> = {
    'view_dashboard': { label: 'Início', description: 'Acesso à página inicial' },
    'view_financial_dashboard': { label: 'Faturamento Início', description: 'Ver lucro/vendas no Dashboard' },
    'view_pedidos': { label: 'Pedidos', description: 'Visualizar lista de pedidos' },
    'delete_orders': { label: 'Excluir Pedidos', description: 'Permissão para deletar registros' },
    'view_clientes': { label: 'Clientes', description: 'Gestão de base de clientes' },
    'view_produtos': { label: 'Produtos', description: 'Catálogo de itens e preços' },
    'view_insumos': { label: 'Insumos', description: 'Estoque e matéria-prima' },
    'view_reports': { label: 'Relatórios', description: 'Acesso à página de relatórios' },
    'view_financial_reports': { label: 'Relat. Financeiro', description: 'Ver faturamento e comissões' },
    'view_kanban': { label: 'Produção / Kanban', description: 'Acesso ao fluxo de produção' },
    'edit_kanban': { label: 'Mover Produção', description: 'Mudar status no Kanban' },
    'view_logistica': { label: 'Logística', description: 'Controle de fretes e entregas' },
    'view_gabi': { label: 'Cérebro da Gabi', description: 'Configurações de IA e templates' },
    'view_vetorizar': { label: 'Vetoriza AI', description: 'Acesso à ferramenta de vetorização' },
    'view_financial_goals': { label: 'Metas Financeiras 📊', description: 'Ver metas de lucro no Dashboard' },
    'manage_settings': { label: 'Admin / Ajustes', description: 'Configurações globais do sistema' }
  };

  useEffect(() => {
    const fetchSubProfiles = async () => {
      if (!profile) return;
      
      const { data, error } = await supabase
        .from('sub_profiles')
        .select('*')
        .eq('parent_profile_id', profile.uid)
        .eq('is_active', true);

      if (error) {
        toast.error('Erro ao carregar perfis');
      } else {
        setSubProfiles(data as SubProfile[]);
      }
      setLoading(false);
    };

    fetchSubProfiles();
  }, [profile]);

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'chefe': return <ShieldCheck className="w-8 h-8 text-primary" />;
      case 'designer': return <Palette className="w-8 h-8 text-blue-400" />;
      case 'operador': return <Printer className="w-8 h-8 text-emerald-400" />;
      case 'atendente': return <Headset className="w-8 h-8 text-amber-400" />;
      default: return <Users className="w-8 h-8" />;
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'chefe': return 'Acesso total a faturamento, lucro e relatórios estratégicos.';
      case 'designer': return 'Criação e preparação de arquivos. Notifica a produção ao finalizar.';
      case 'operador': return 'Gestão de máquinas e estoque. Recebe avisos de arquivos prontos.';
      case 'atendente': return 'Atendimento ao cliente, criação de pedidos e vendas.';
      default: return '';
    }
  };

  const handlePinSubmit = () => {
    if (pinPurpose === 'permissions') {
      const chefeProfile = subProfiles.find(s => s.role === 'chefe');
      if (chefeProfile && pinInput === chefeProfile.pin) {
        setShowPinModal(false);
        setPinInput('');
        openPermissionsDirectly();
      } else {
        toast.error('PIN do Chefe incorreto');
        setPinInput('');
      }
      return;
    }

    if (selectingProfile && pinInput === selectingProfile.pin) {
      switchSubProfile(selectingProfile);
      setShowPinModal(false);
      setPinInput('');
      toast.success(`Entrando como ${selectingProfile.name}`);
    } else {
      toast.error('PIN incorreto');
      setPinInput('');
    }
  };

  const handleSetupPinSubmit = async () => {
    if (!selectingProfile) return;
    if (newPin.length < 4) {
      toast.error('O PIN deve ter pelo menos 4 dígitos');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('Os PINs não coincidem');
      return;
    }

    setIsSettingUp(true);
    try {
      const { error } = await supabase
        .from('sub_profiles')
        .update({ pin: newPin })
        .eq('id', selectingProfile.id);

      if (error) throw error;

      toast.success('PIN configurado com sucesso!');
      switchSubProfile({ ...selectingProfile, pin: newPin });
      setShowSetupPinModal(false);
      setNewPin('');
      setConfirmPin('');
    } catch (error) {
      toast.error('Erro ao salvar PIN');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!profile) return;
    if (!editName) {
      toast.error('O nome é obrigatório');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sub_profiles')
        .insert({
          parent_profile_id: profile.id,
          name: editName,
          role: editRole,
          whatsapp_number: editPhone,
          pin: editPin || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Novo perfil criado!');
      setSubProfiles(prev => [...prev, data as SubProfile]);
      setShowCreateModal(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao criar perfil');
    }
  };

  const resetForm = () => {
    setEditName('');
    setEditPhone('');
    setEditPin('');
    setEditRole('atendente');
    setEditingSub(null);
  };

  const handleOpenEdit = (sub: SubProfile) => {
    setEditingSub(sub);
    setEditName(sub.name);
    setEditPhone(sub.whatsapp_number || '');
    setEditPin(sub.pin || '');
    setEditRole(sub.role);
    setShowEditModal(true);
  };

  const handleSelect = (sub: SubProfile) => {
    if (isManagedMode) {
      handleOpenEdit(sub);
      return;
    }

    if (sub.pin) {
      setSelectingProfile(sub);
      setPinPurpose('switch');
      setShowPinModal(true);
      return;
    }

    // Se for o CHEFE e não tiver PIN, exigir configuração
    if (sub.role === 'chefe' && !sub.pin) {
      setSelectingProfile(sub);
      setShowSetupPinModal(true);
      return;
    }

    switchSubProfile(sub);
    toast.success(`Entrando como ${sub.name}`);
  };

  const handleSaveEdit = async () => {
    if (!editingSub || !profile) return;
    
    try {
      const { error } = await supabase
        .from('sub_profiles')
        .update({
          name: editName,
          whatsapp_number: editPhone,
          pin: editPin || null,
          role: editRole
        })
        .eq('id', editingSub.id);

      if (error) throw error;

      // Se o perfil editado for o CHEFE, sincronizar o WhatsApp com as notificações globais
      if (editRole === 'chefe') {
        await supabase
          .from('profiles_v2')
          .update({ 
            whatsapp_boss_group_id: editPhone,
            whatsapp_boss_notifications_enabled: true 
          })
          .eq('uid', profile.uid);
        toast.info('WhatsApp do Chefe sincronizado com Gabi Executiva!');
      }

      toast.success('Perfil atualizado!');
      setSubProfiles(prev => prev.map(s => s.id === editingSub.id ? { ...s, name: editName, whatsapp_number: editPhone, pin: editPin, role: editRole } : s));
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    }
  };

  const openPermissionsDirectly = () => {
    if (!profile?.role_permissions) {
      // Fallback para permissões padrão se não existirem
      setTempPermissions({
        chefe: {},
        designer: { view_dashboard: true, view_pedidos: true, view_kanban: true, edit_kanban: true, view_vetorizar: true },
        operador: { view_dashboard: true, view_kanban: true, edit_kanban: true, view_insumos: true },
        atendente: { view_dashboard: true, view_pedidos: true, view_clientes: true, view_logistica: true }
      });
    } else {
      setTempPermissions(profile.role_permissions as Record<UserRole, Record<string, boolean>>);
    }
    setShowPermissionsModal(true);
  };

  const handleOpenPermissions = () => {
    const chefeProfile = subProfiles.find(s => s.role === 'chefe');
    
    if (chefeProfile?.pin) {
      setPinPurpose('permissions');
      setShowPinModal(true);
      return;
    }
    
    openPermissionsDirectly();
  };

  const togglePermission = (role: UserRole, permission: string) => {
    if (!tempPermissions) return;
    setTempPermissions(prev => ({
      ...prev!,
      [role]: {
        ...(prev![role] || {}),
        [permission]: !prev![role]?.[permission]
      }
    }));
  };

  const handleSavePermissions = async () => {
    if (!profile || !tempPermissions) return;
    setSavingPermissions(true);
    try {
      const { error } = await supabase
        .from('profiles_v2')
        .update({ role_permissions: tempPermissions })
        .eq('uid', profile.uid);

      if (error) throw error;
      toast.success('Permissões de cargo atualizadas!');
      setShowPermissionsModal(false);
    } catch (error) {
      toast.error('Erro ao salvar permissões');
    } finally {
      setSavingPermissions(false);
    }
  };

  useEffect(() => {
    // Bloquear scroll do body quando o seletor está ativo
    // Só bloqueamos se não estiver carregando e se o seletor for realmente aparecer
    if (!loading && profile?.is_multi_profile_enabled && !activeSubProfile) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [loading, profile?.is_multi_profile_enabled, activeSubProfile]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-primary font-black text-2xl tracking-tighter italic uppercase"
        >
          Direct AI
        </motion.div>
      </div>
    );
  }

  if (!profile?.is_multi_profile_enabled || activeSubProfile) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col overflow-hidden">
      {/* Intense Background Liquid Blobs (Ref: iOS Style) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-600/5 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      {/* Scrollable Layer */}
      <div className="flex-1 overflow-y-auto scrollbar-none relative z-10">
        <div className="min-h-full w-full flex flex-col items-center justify-start md:justify-center p-8 md:p-12 py-20">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-6xl text-center space-y-16 will-change-transform"
          >
            <div className="space-y-3">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-4"
              >
                <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary/80">
                  {isManagedMode ? 'Modo de Gerenciamento' : 'Segurança de Acesso'}
                </span>
              </motion.div>
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.9]">
                {isManagedMode ? 'Gerenciar' : 'Quem está usando o'} <br />
                <span className="text-primary drop-shadow-[0_0_20px_rgba(255,165,0,0.3)]">
                  {isManagedMode ? 'Perfis' : 'Direct AI?'}
                </span>
              </h1>
              <p className="text-zinc-500 font-semibold tracking-wide uppercase text-xs">
                {isManagedMode ? 'Clique em um perfil para editar os detalhes' : 'Selecione seu perfil para continuar o fluxo'}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12 max-w-5xl mx-auto">
              <AnimatePresence mode="popLayout">
                {subProfiles.map((sub, idx) => (
                  <motion.button
                    key={sub.id}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.4, 
                      delay: idx * 0.05,
                      type: "spring",
                      stiffness: 150,
                      damping: 20
                    }}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSelect(sub)}
                    className="group relative flex flex-col items-center gap-6 will-change-transform"
                  >
                    {/* Squircle Glass Card (Ref: iOS Control Center) */}
                    <div className="relative aspect-square w-36 md:w-44 rounded-[3.2rem] overflow-hidden transition-all duration-300 shadow-[0_20px_40px_rgba(0,0,0,0.4)] bg-white/[0.04] backdrop-blur-[20px] border border-white/[0.08] flex items-center justify-center group-focus:ring-4 group-focus:ring-primary/40">
                      
                      {/* Inner Border Highlight (Liquid Edge) */}
                      <div className="absolute inset-0 rounded-[3.2rem] border border-white/10 opacity-100 ring-1 ring-inset ring-white/5" />

                      {/* Liquid Gradient Background - Optimized Glow */}
                      <div className={cn(
                        "absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-xl",
                        sub.role === 'chefe' ? "bg-gradient-to-br from-amber-500 via-primary to-orange-600" :
                        sub.role === 'designer' ? "bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-500" :
                        sub.role === 'operador' ? "bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500" :
                        "bg-gradient-to-br from-pink-400 via-rose-400 to-amber-500"
                      )} />

                      {/* Surface Gloss */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/[0.02] pointer-events-none" />
                      
                      {sub.avatar_url ? (
                        <img src={sub.avatar_url} alt={sub.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
                      ) : (
                        <div className="flex flex-col items-center gap-3 relative z-10 scale-110 group-hover:scale-115 transition-all duration-300">
                          <div className="p-4 rounded-3xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-inner group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                            {getRoleIcon(sub.role)}
                          </div>
                        </div>
                      )}

                      {/* Managed Overlays */}
                      {isManagedMode && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-30 transition-all duration-300">
                          <div className="w-12 h-12 rounded-full bg-white/20 border border-white/40 flex items-center justify-center text-white shadow-2xl backdrop-blur-md">
                            <Settings2 size={24} className="animate-pulse" />
                          </div>
                        </div>
                      )}

                      {/* Liquid Sweep Effect (Only if not managed) */}
                      {!isManagedMode && (
                        <div className="absolute inset-[-100%] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out pointer-events-none" />
                      )}

                      {sub.pin && !isManagedMode && (
                        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl z-20">
                          <Lock size={14} className="text-white/80" />
                        </div>
                      )}
                      
                      {/* Subtle Role Badge */}
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 duration-300 pointer-events-none">
                        <span className="text-[9px] font-black uppercase text-white tracking-[0.2em] bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                          {sub.role}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-center">
                      <span className="block text-2xl font-black text-zinc-400 group-hover:text-white transition-all group-hover:tracking-tight duration-300">
                        {sub.name}
                      </span>
                      <p className="text-[11px] text-zinc-600 group-hover:text-zinc-400 transition-colors leading-relaxed max-w-[180px] mx-auto font-medium opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        {getRoleDescription(sub.role)}
                      </p>
                    </div>
                  </motion.button>
                ))}

                {!isManagedMode && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: subProfiles.length * 0.05 }}
                    whileHover={{ scale: 1.05, y: -8 }}
                    whileTap={{ scale: 0.95 }}
                    className="group flex flex-col items-center gap-6 will-change-transform"
                  >
                    <div className="aspect-square w-36 md:w-44 rounded-[3.2rem] border-2 border-dashed border-white/10 flex items-center justify-center group-hover:bg-white/[0.05] group-hover:border-primary/50 transition-all duration-300 backdrop-blur-[20px] bg-white/[0.02]">
                      <Plus size={40} className="text-zinc-600 group-hover:text-primary transition-all duration-300 group-hover:rotate-90" />
                    </div>
                    <span className="text-2xl font-black text-zinc-600 group-hover:text-white transition-colors">Novo Perfil</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-10 flex flex-col items-center gap-6">
              <div className="relative flex flex-col md:flex-row items-center gap-4">
                {/* Floating Hint Popup */}
                {!isManagedMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ 
                      opacity: 1,
                      y: [0, -10, 0],
                      scale: 1
                    }}
                    transition={{ 
                      opacity: { duration: 0.5 },
                      y: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2.5 rounded-2xl bg-primary text-black font-black text-[10px] uppercase tracking-tighter shadow-[0_10px_30px_rgba(255,165,0,0.4)] z-50 pointer-events-none after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-transparent after:border-t-primary"
                  >
                    configure o que cada usuário pode fazer e ver no sistema
                  </motion.div>
                )}

                <Button 
                  variant="ghost" 
                  onClick={() => setIsManagedMode(!isManagedMode)}
                  className={cn(
                    "rounded-full px-12 h-16 border transition-all duration-300 group flex items-center gap-3 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative overflow-hidden will-change-transform",
                    isManagedMode 
                      ? "bg-white text-black border-white hover:bg-zinc-200" 
                      : "text-zinc-400 hover:text-white border-white/5 bg-white/[0.03] backdrop-blur-2xl hover:bg-primary/20 hover:text-primary hover:border-primary/40"
                  )}
                >
                  <Settings2 className={cn("w-5 h-5 transition-colors", isManagedMode ? "text-black" : "text-zinc-500 group-hover:text-primary")} />
                  <span className="font-extrabold tracking-tight text-lg uppercase italic">
                    {isManagedMode ? 'Concluir Edição' : 'Gerenciar Perfis'}
                  </span>
                </Button>

                {isManagedMode && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Button 
                      onClick={handleOpenPermissions}
                      className="rounded-full px-8 h-16 bg-zinc-900/80 text-white border border-white/10 backdrop-blur-3xl hover:bg-emerald-500 hover:text-white transition-all duration-500 shadow-2xl flex items-center gap-3 uppercase font-black italic tracking-tighter"
                    >
                      <ShieldCheck className="w-5 h-5" />
                      🔒 Ajustar Permissões
                    </Button>
                  </motion.div>
                )}
              </div>

              <div className="flex items-center gap-2 text-zinc-700 font-bold uppercase tracking-[0.5em] text-[8px] opacity-50">
                <Sparkle size={10} className="animate-spin-slow" />
                Liquid Glass v2.6
                <Sparkle size={10} className="animate-spin-slow" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal de Gestão de Permissões */}
      <AnimatePresence>
        {showPermissionsModal && tempPermissions && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 overflow-y-auto pt-20 pb-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPermissionsModal(false)} className="fixed inset-0 bg-black/80 backdrop-blur-2xl" />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 30 }} 
              className="relative w-full max-w-4xl bg-zinc-900 border border-white/10 rounded-[3.5rem] p-8 md:p-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] z-10 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative space-y-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Gestão de Acessos</h3>
                    <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.3em]">Configure o que cada cargo pode acessar</p>
                  </div>
                  <Button variant="ghost" onClick={() => setShowPermissionsModal(false)} className="rounded-full w-12 h-12 bg-white/5 border border-white/10 text-white">✕</Button>
                </div>

                <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {(['atendente', 'designer', 'operador'] as UserRole[]).map((role) => (
                    <div key={role} className="space-y-6 bg-white/[0.02] border border-white/[0.05] rounded-[2.5rem] p-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-zinc-800 border border-white/10">
                          {getRoleIcon(role)}
                        </div>
                        <div>
                          <h4 className="text-xl font-black text-white uppercase italic tracking-tight">{role}</h4>
                          <p className="text-xs text-zinc-500 font-medium">Permissões exclusivas para este cargo</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(PERMISSION_LABELS).map(([key, info]) => (
                          <div 
                            key={key} 
                            onClick={() => togglePermission(role, key)}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-3xl border transition-all cursor-pointer group",
                              tempPermissions[role]?.[key] 
                                ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20" 
                                : "bg-black/20 border-white/5 hover:border-white/10"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className={cn("text-xs font-black uppercase tracking-tight", tempPermissions[role]?.[key] ? "text-emerald-400" : "text-zinc-400")}>
                                {info.label}
                              </span>
                              <span className="text-[10px] text-zinc-600 font-medium">{info.description}</span>
                            </div>
                            <div className={cn(
                              "w-10 h-6 rounded-full relative transition-colors duration-300",
                              tempPermissions[role]?.[key] ? "bg-emerald-500" : "bg-zinc-800"
                            )}>
                              <div className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-lg",
                                tempPermissions[role]?.[key] ? "left-5" : "left-1"
                              )} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-4">
                  <Button variant="ghost" onClick={() => setShowPermissionsModal(false)} className="flex-1 h-16 rounded-3xl text-zinc-500 font-bold uppercase tracking-widest hover:bg-white/5 transition-all">Descartar</Button>
                  <Button 
                    disabled={savingPermissions}
                    onClick={handleSavePermissions}
                    className="flex-1 h-16 rounded-3xl bg-white text-black font-black uppercase italic tracking-tighter text-lg shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    {savingPermissions ? 'Salvando...' : 'Aplicar Acessos'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Modal - Estilo Glassmorphism */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPinModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl will-change-transform"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                  <Lock size={32} />
                </div>
                
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-white">Insira seu PIN</h3>
                  <p className="text-zinc-500 text-sm">
                    {pinPurpose === 'permissions' 
                      ? 'Ajuste de acessos é restrito ao Chefe' 
                      : `O perfil ${selectingProfile?.name} é protegido`}
                  </p>
                </div>

                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-black/20 border border-white/5 rounded-2xl p-4 text-center text-3xl tracking-[1em] focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder:text-zinc-800"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                />

                <div className="w-full flex gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowPinModal(false)}
                    className="flex-1 rounded-2xl h-12 text-zinc-500"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handlePinSubmit}
                    className="flex-1 rounded-2xl h-12 bg-primary text-black font-bold"
                  >
                    Confirmar
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden will-change-transform">
              <div className="space-y-8 relative z-10">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Editar Perfil</h3>
                  <p className="text-zinc-500 font-medium">Personalize os dados do perfil</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">Nome Social</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">WhatsApp</label>
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="5511..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">PIN (Opcional)</label>
                    <input type="password" value={editPin} onChange={(e) => setEditPin(e.target.value)} placeholder="••••" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" onClick={() => setShowEditModal(false)} className="flex-1 rounded-2xl h-14 text-zinc-400 font-bold hover:bg-white/5">Voltar</Button>
                  <Button onClick={handleSaveEdit} className="flex-1 rounded-2xl h-14 bg-white text-black font-black uppercase italic shadow-xl">Salvar</Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Profile Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-zinc-900/40 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden will-change-transform">
              <div className="space-y-8 relative z-10">
                <div className="text-center space-y-2">
                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Novo Perfil</h3>
                  <p className="text-zinc-500 font-medium">Crie um novo acesso para sua equipe</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">Nome Social</label>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Ex: Gabriel" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">Cargo</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['chefe', 'designer', 'operador', 'atendente'].map((r) => (
                        <button key={r} onClick={() => setEditRole(r as UserRole)} className={cn("p-2 rounded-xl border text-[10px] uppercase font-bold", editRole === r ? "bg-primary text-black border-primary" : "bg-white/5 text-zinc-500 border-white/10")}>{r}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="flex-1 rounded-2xl h-14 text-zinc-400 font-bold hover:bg-white/5">Voltar</Button>
                  <Button onClick={handleCreateProfile} className="flex-1 rounded-2xl h-14 bg-white text-black font-black uppercase italic shadow-xl">Criar</Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* PIN Setup Modal - Para o Chefe no primeiro acesso */}
      <AnimatePresence>
        {showSetupPinModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden"
            >
              <div className="space-y-8 relative z-10">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mx-auto mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase">Configurar PIN</h3>
                  <p className="text-zinc-500 font-medium">Como este é seu primeiro acesso como Chefe, defina seu PIN de segurança.</p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">Novo PIN (4+ dígitos)</label>
                    <input 
                      type="password" 
                      value={newPin} 
                      onChange={(e) => setNewPin(e.target.value)} 
                      placeholder="••••" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-2xl tracking-[0.5em] text-white font-bold outline-none focus:ring-2 focus:ring-primary/50" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-zinc-500 ml-4">Confirmar PIN</label>
                    <input 
                      type="password" 
                      value={confirmPin} 
                      onChange={(e) => setConfirmPin(e.target.value)} 
                      placeholder="••••" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center text-2xl tracking-[0.5em] text-white font-bold outline-none focus:ring-2 focus:ring-primary/50" 
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setShowSetupPinModal(false);
                      setNewPin('');
                      setConfirmPin('');
                    }} 
                    className="flex-1 rounded-2xl h-14 text-zinc-400 font-bold hover:bg-white/5"
                  >
                    Voltar
                  </Button>
                  <Button 
                    disabled={isSettingUp}
                    onClick={handleSetupPinSubmit} 
                    className="flex-1 rounded-2xl h-14 bg-primary text-black font-black uppercase italic shadow-xl"
                  >
                    {isSettingUp ? 'Salvando...' : 'Confirmar'}
                  </Button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
