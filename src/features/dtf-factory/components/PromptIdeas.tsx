

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X, Plus, Trash2, Edit3, Check, Copy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { electronBridge } from '@dtf/lib/electronBridge';

// Templates padrão profissionais
const DEFAULT_TEMPLATES = [
    {
        id: 'monster_destruction',
        name: '🔥 Monster Destruction',
        category: 'Action',
        template: 'Crie uma ilustração digital de um [CRIATURA] destruindo [OBJETO] com o logo "[MARCA]" em tipografia [ESTILO], black solid background',
        fields: ['CRIATURA', 'OBJETO', 'MARCA', 'ESTILO'],
        example: 'demônio destruindo uma cidade, "CHAOS REIGN", brutal'
    },
    {
        id: 'religioso',
        name: '✝️ Religioso/Espiritual',
        category: 'Spiritual',
        template: 'Ilustração digital de [FIGURA] com [ELEMENTO] e o texto "[VERSICULO]" em tipografia [ESTILO], black solid background',
        fields: ['FIGURA', 'ELEMENTO', 'VERSICULO', 'ESTILO'],
        example: 'Jesus com coroa de espinhos, João 3:16, gótica elegante'
    },
    {
        id: 'patch_bordado',
        name: '🧵 Patch Bordado 3D',
        category: 'Badge',
        template: 'Logo em estilo patch bordado com relevo 3D, costura realista, escrito "[TEXTO]" com borda [COR], formato [FORMA], black solid background',
        fields: ['TEXTO', 'COR', 'FORMA'],
        example: '"IRON BROTHERS MC", amarela e vermelha, circular motoclube'
    },
    {
        id: 'caveira_marca',
        name: '💀 Caveira + Marca',
        category: 'Skull',
        template: 'Caveira [ESTILO_CAVEIRA] detalhada com [ELEMENTOS] e o texto "[MARCA]" integrado, tipografia [TIPO], black solid background',
        fields: ['ESTILO_CAVEIRA', 'ELEMENTOS', 'MARCA', 'TIPO'],
        example: 'realista, rosas e serpentes, "MEMENTO MORI", blackletter'
    },
    {
        id: 'animal_feroz',
        name: '🦁 Animal Feroz',
        category: 'Animal',
        template: '[ANIMAL] feroz em pose [POSE] com o logo "[MARCA]" [POSICAO], tipografia [ESTILO], detalhes em [COR], black solid background',
        fields: ['ANIMAL', 'POSE', 'MARCA', 'POSICAO', 'ESTILO', 'COR'],
        example: 'Leão rugindo frontal, "SAVAGE KINGS" acima, brutal, dourado'
    },
    {
        id: 'arma_ornamentos',
        name: '⚔️ Arma + Ornamentos',
        category: 'Weapon',
        template: '[ARMA] detalhada com ornamentos [ORNAMENTO] e texto "[FRASE]" em banner, tipografia [ESTILO], black solid background',
        fields: ['ARMA', 'ORNAMENTO', 'FRASE', 'ESTILO'],
        example: 'Espada medieval, góticos, "BROTHERHOOD", blackletter'
    },
    {
        id: 'mascote',
        name: '🐻 Mascote da Marca',
        category: 'Mascot',
        template: 'Mascote [DESCRICAO] representando "[MARCA]", segurando [OBJETO], estilo [ARTE], tipografia bold integrada, black solid background',
        fields: ['DESCRICAO', 'MARCA', 'OBJETO', 'ARTE'],
        example: 'urso agressivo, "BEAR FORCE", correntes, cartoon brutal'
    },
    {
        id: 'mandala',
        name: '🔮 Mandala Sagrada',
        category: 'Geometric',
        template: 'Mandala [ESTILO] com [ELEMENTO_CENTRAL] central e texto "[MARCA]" integrado, detalhes em [COR], black solid background',
        fields: ['ESTILO', 'ELEMENTO_CENTRAL', 'MARCA', 'COR'],
        example: 'geométrica, olho de Horus, "THIRD EYE", roxo e dourado'
    },
    {
        id: 'vintage_badge',
        name: '🏅 Vintage Badge',
        category: 'Badge',
        template: 'Badge vintage [FORMATO] com "[MARCA]" e subtexto "[SLOGAN]", elementos [DECORATIVOS], estilo anos [DECADA], black solid background',
        fields: ['FORMATO', 'MARCA', 'SLOGAN', 'DECORATIVOS', 'DECADA'],
        example: 'circular, "MOTORS CLUB", "Est. 1985", engrenagens, 70'
    },
    {
        id: 'guerreiro',
        name: '⚔️ Guerreiro Simétrico',
        category: 'Warrior',
        template: '[GUERREIRO] em pose simétrica frontal com [ARMAS], logo "[MARCA]" [POSICAO], tipografia [ESTILO], detalhes [COR], black solid background',
        fields: ['GUERREIRO', 'ARMAS', 'MARCA', 'POSICAO', 'ESTILO', 'COR'],
        example: 'Samurai, katanas cruzadas, "BUSHIDO" superior, japonesa, vermelho'
    }
];

interface PromptIdea {
    id: string;
    name: string;
    category: string;
    template: string;
    fields: string[];
    example: string;
    isCustom?: boolean;
}

interface PromptIdeasProps {
    onSelectPrompt: (prompt: string) => void;
}

export default function PromptIdeas({ onSelectPrompt }: PromptIdeasProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [ideas, setIdeas] = useState<PromptIdea[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [fieldValues, setFieldValues] = useState<Record<string, Record<string, string>>>({});
    const [isCreating, setIsCreating] = useState(false);
    const [newIdea, setNewIdea] = useState({ name: '', template: '' });

    useEffect(() => {
        loadIdeas();
    }, []);

    const loadIdeas = async () => {
        // Carregar ideias customizadas do localStorage
        const savedCustom = localStorage.getItem('customPromptIdeas');
        const customIdeas = savedCustom ? JSON.parse(savedCustom) : [];
        setIdeas([...DEFAULT_TEMPLATES, ...customIdeas]);
    };

    const saveCustomIdeas = (customIdeas: PromptIdea[]) => {
        localStorage.setItem('customPromptIdeas', JSON.stringify(customIdeas));
    };

    const handleUseTemplate = (idea: PromptIdea) => {
        const values = fieldValues[idea.id] || {};
        let finalPrompt = idea.template;

        // Substituir campos pelos valores
        idea.fields.forEach(field => {
            const value = values[field] || `[${field}]`;
            finalPrompt = finalPrompt.replace(`[${field}]`, value);
        });

        onSelectPrompt(finalPrompt);
        setIsOpen(false);
    };

    const handleFieldChange = (ideaId: string, field: string, value: string) => {
        setFieldValues(prev => ({
            ...prev,
            [ideaId]: {
                ...prev[ideaId],
                [field]: value
            }
        }));
    };

    const handleAddCustom = () => {
        if (!newIdea.name.trim() || !newIdea.template.trim()) return;

        // Extrair campos do template [CAMPO]
        const fields = newIdea.template.match(/\[([A-Z_]+)\]/g)?.map(f => f.slice(1, -1)) || [];

        const customIdea: PromptIdea = {
            id: `custom_${Date.now()}`,
            name: `✨ ${newIdea.name}`,
            category: 'Custom',
            template: newIdea.template,
            fields,
            example: '',
            isCustom: true
        };

        const customIdeas = ideas.filter(i => i.isCustom);
        customIdeas.push(customIdea);
        saveCustomIdeas(customIdeas);

        setIdeas([...DEFAULT_TEMPLATES, ...customIdeas]);
        setNewIdea({ name: '', template: '' });
        setIsCreating(false);
    };

    const handleDeleteCustom = (id: string) => {
        const customIdeas = ideas.filter(i => i.isCustom && i.id !== id);
        saveCustomIdeas(customIdeas);
        setIdeas([...DEFAULT_TEMPLATES, ...customIdeas]);
    };

    return (
        <div className="relative">
            {/* Botão de abrir Ideias */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-300 hover:border-purple-400/50 transition-all"
                title="Templates Profissionais"
            >
                <Lightbulb size={14} />
                <span className="text-xs font-medium">Ideias</span>
            </motion.button>

            {/* Modal de Ideias */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed inset-x-4 top-16 bottom-16 z-50 bg-zinc-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    <h2 className="font-bold text-white">Templates Profissionais</h2>
                                    <span className="text-xs text-white/40">({ideas.length} ideias)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsCreating(!isCreating)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors"
                                    >
                                        <Plus size={12} />
                                        Criar
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Criar novo */}
                            <AnimatePresence>
                                {isCreating && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="border-b border-white/10 overflow-hidden flex-shrink-0"
                                    >
                                        <div className="p-4 space-y-3">
                                            <input
                                                type="text"
                                                placeholder="Nome do template..."
                                                value={newIdea.name}
                                                onChange={e => setNewIdea({ ...newIdea, name: e.target.value })}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                                            />
                                            <textarea
                                                placeholder="Template com [CAMPOS] em maiúsculo..."
                                                value={newIdea.template}
                                                onChange={e => setNewIdea({ ...newIdea, template: e.target.value })}
                                                rows={2}
                                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
                                            />
                                            <button
                                                onClick={handleAddCustom}
                                                className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-400 transition-colors"
                                            >
                                                Salvar Template
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Lista de ideias */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {ideas.map((idea) => (
                                    <motion.div
                                        key={idea.id}
                                        layout
                                        className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
                                    >
                                        {/* Header do card */}
                                        <button
                                            onClick={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
                                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-white">{idea.name}</span>
                                                {idea.isCustom && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">Custom</span>
                                                )}
                                            </div>
                                            {expandedId === idea.id ? (
                                                <ChevronUp size={16} className="text-white/40" />
                                            ) : (
                                                <ChevronDown size={16} className="text-white/40" />
                                            )}
                                        </button>

                                        {/* Conteúdo expandido */}
                                        <AnimatePresence>
                                            {expandedId === idea.id && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="px-4 pb-4 space-y-3">
                                                        {/* Template */}
                                                        <p className="text-xs text-white/50 bg-black/30 p-2 rounded-lg">
                                                            {idea.template}
                                                        </p>

                                                        {/* Campos */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {idea.fields.map(field => (
                                                                <input
                                                                    key={field}
                                                                    type="text"
                                                                    placeholder={field}
                                                                    value={fieldValues[idea.id]?.[field] || ''}
                                                                    onChange={e => handleFieldChange(idea.id, field, e.target.value)}
                                                                    className="px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50"
                                                                />
                                                            ))}
                                                        </div>

                                                        {/* Exemplo */}
                                                        {idea.example && (
                                                            <p className="text-[10px] text-white/30 italic">
                                                                Ex: {idea.example}
                                                            </p>
                                                        )}

                                                        {/* Ações */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleUseTemplate(idea)}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-cyan-500 text-white text-xs font-medium rounded-lg hover:bg-cyan-400 transition-colors"
                                                            >
                                                                <Check size={12} />
                                                                Usar Template
                                                            </button>
                                                            {idea.isCustom && (
                                                                <button
                                                                    onClick={() => handleDeleteCustom(idea.id)}
                                                                    className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
