import { useEffect } from 'react';

export default function LandingPage() {
    const queryParams = window.location.search;
    const iframeSrc = `/landing-page/index.html${queryParams}`;

    useEffect(() => {
        // Ensure the page fits perfectly
        document.title = "Direct AI - Sua Gráfica no Piloto Automático";
    }, []);

    return (
        <div className="fixed inset-0 w-full h-full bg-[#020617] z-[9999]">
            <iframe
                src={iframeSrc}
                className="w-full h-full border-none"
                title="Direct AI Landing Page"
            />
        </div>
    );
}
