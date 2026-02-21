/**
 * Formats a message string by converting basic markdown-like syntax to HTML.
 * Optimized for GABI AI (CEO Virtual) with premium, executive styling.
 */
export const formatMessage = (content: string): string => {
    if (!content) return "";

    let formatted = content
        // 1. Headers - Executive "Direct AI" Style
        .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-black text-white mt-6 mb-3 tracking-tighter uppercase border-l-4 border-primary pl-3 bg-white/5 py-2">$1</h1>')
        .replace(/^## (.*?)$/gm, '<h2 class="text-lg font-black text-slate-200 mt-4 mb-2 tracking-tight flex items-center gap-2"><span class="w-2 h-4 bg-primary/50 rounded-full"></span>$1</h2>')
        .replace(/^### (.*?)$/gm, '<h3 class="text-xs font-bold text-slate-400 mt-3 mb-1 uppercase tracking-[0.2em]">$1</h3>')

        // 2. Bold & Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-black drop-shadow-sm">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="italic opacity-80 text-slate-300">$1</em>')

        // 3. Financial & Operational Highlights (Premium Colors)
        // Values like R$ 1.000,00 -> Emerald
        .replace(/(R\$ [\d,.]+)/g, '<span class="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded">$1</span>')
        // ML/m -> Gold
        .replace(/(\d+[,.]?\d*\s?(ML|m\b))/gi, '<span class="text-[#f1c40f] font-bold">$1</span>')
        // Status highlighting
        .replace(/\b(Pendente-Pagamento|Falta Pagar)\b/gi, '<span class="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-red-500/30">$1</span>')
        .replace(/\b(Pendente|Processando)\b/gi, '<span class="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-amber-500/30">$1</span>')
        .replace(/\b(Pago|Entregue)\b/gi, '<span class="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase border border-emerald-500/30">$1</span>')

        // 4. Tables Markdown - Handled line by line
        .split('\n').map(line => {
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                const cells = line.split('|').filter(c => c.trim() !== '' || line.startsWith('|') && line.endsWith('|'));
                if (line.includes('---')) return '';

                const isHeader = line.toLowerCase().includes('cliente') || line.toLowerCase().includes('total') || line.toLowerCase().includes('status');
                const rowClass = isHeader
                    ? "bg-white/10 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300"
                    : "border-b border-white/5 text-[12px] text-slate-400 hover:bg-white/5 transition-colors group";
                const cellClass = "px-3 py-2 text-left";

                return `<tr class="${rowClass}">${cells.map(c => `<td class="${cellClass}">${c.trim()}</td>`).join('')}</tr>`;
            }
            return line;
        }).join('\n')
        // Wrap tables in responsive container with glassmorphism
        .replace(/(<tr[\s\S]*?<\/tr>)/g, '<div class="overflow-x-auto my-4 rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm shadow-xl"><table class="w-full border-collapse">$1</table></div>')
        .replace(/<\/table><\/div>\n<div class="overflow-x-auto my-4 rounded-xl border border-white\/10 bg-black\/20 backdrop-blur-sm shadow-xl"><table class="w-full border-collapse">/g, '')

        // 5. Lists & Horizontal Rules
        .replace(/^---$/gm, '<hr class="border-white/10 my-6 shadow-sm" />')
        .replace(/^\s*[-•]\s+(.*?)$/gm, '<div class="flex gap-3 items-start py-1.5 ml-2 group"><span class="text-primary font-black text-xl leading-none transition-transform group-hover:scale-125 select-none">•</span><span class="flex-1 text-slate-100 font-medium group-hover:text-white transition-colors">$1</span></div>')

        // 6. Premium Containers (GABI special tags)
        // [CARD] -> Glassmorphism effect
        .replace(/\[CARD\]([\s\S]*?)\[\/CARD\]/g, '<div class="relative overflow-hidden bg-gradient-to-br from-white/10 to-transparent border border-white/20 rounded-2xl p-4 my-4 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-md animate-in zoom-in-95 duration-500"><div class="absolute top-0 right-0 p-2 opacity-10 font-black text-4xl select-none">DATA</div>$1</div>')

        // [TIP] -> Insight style (Executive coaching)
        .replace(/\[TIP\]([\s\S]*?)\[\/TIP\]/g, '<div class="bg-primary/20 backdrop-blur-sm border-l-4 border-primary text-slate-50 rounded-r-2xl p-4 my-5 text-[13px] font-bold leading-relaxed flex flex-col gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.4)] border border-white/5 animate-in slide-in-from-right-4 transition-all hover:bg-primary/30 group"><div class="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] opacity-90"><span class="bg-primary text-black font-black px-1.5 py-0.5 rounded shadow-sm">INSIGHT DA GABI</span></div><div class="insight-content grow text-slate-100/90 whitespace-pre-wrap">$1</div></div>')

        // 7. Spacing & Line Breaks
        .replace(/\n\n/g, '<div class="h-4"></div>')
        .replace(/\n/g, "<br />");

    return formatted;
};
