/**
 * Formats a message string by converting basic markdown-like syntax to HTML.
 * Optimized for Gabi AI with premium styling.
 */
export const formatMessage = (content: string): string => {
    if (!content) return "";

    let formatted = content
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-black">$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em class="italic opacity-90">$1</em>')
        // Highlighting values like R$ (Green)
        .replace(/(R\$ [\d,.]+)/g, '<span class="text-green-400 font-bold">$1</span>')
        // Highlighting Metros/ML (Yellow)
        .replace(/(\d+[,.]?\d*\s?(ML|m\b))/gi, '<span class="text-primary font-bold">$1</span>')
        // Lists/Bullet points - Transform into clean rows with spacing
        .replace(/^\s*[-•]\s+(.*?)$/gm, '<div class="flex gap-2 items-start py-1 ml-1"><span class="text-primary font-black">•</span><span class="flex-1">$1</span></div>')
        // Special Containers for Examples and Tips
        .replace(/\[CARD\]([\s\S]*?)\[\/CARD\]/g, '<div class="bg-zinc-800/40 border border-white/5 rounded-lg p-2.5 my-1 text-[13px] shadow-sm">$1</div>')
        .replace(/\[TIP\]([\s\S]*?)\[\/TIP\]/g, '<div class="bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg p-2 my-1 text-[11px] font-bold flex flex-col items-center text-center gap-0.5">$1</div>')
        // Double newlines for paragraph spacing
        .replace(/\n\n/g, '<div class="h-2"></div>')
        // Single newlines
        .replace(/\n/g, "<br />");

    return formatted;
};
