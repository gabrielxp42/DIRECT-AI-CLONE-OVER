import { useNavigate } from "react-router-dom";
import { MoveLeft, Home, Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/utils/version";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1a00] to-[#0f0f00] animate-gradient-xy opacity-80"></div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#FFF200]/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#FFD700]/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,242,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,242,0,0.02)_1px,transparent_1px)] bg-[size:60px_60px] opacity-20"></div>

      <div className="w-full max-w-lg relative z-10 text-center space-y-8 animate-in mt-[-5%]">

        {/* 404 Number with Glow */}
        <div className="relative inline-block animate-bounce-slow">
          <h1 className="text-[120px] md:text-[180px] font-black text-white leading-none tracking-tighter drop-shadow-[0_0_30px_rgba(255,242,0,0.2)]">
            404
          </h1>
          <div className="absolute inset-0 blur-2xl bg-[#FFF200]/10 -z-10 rounded-full scale-110"></div>
        </div>

        {/* Message Card */}
        <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl ring-1 ring-white/5 space-y-6 transform hover:scale-[1.01] transition-transform duration-500">
          <div className="flex justify-center mb-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 ring-1 ring-white/5 shadow-[#FFF200]/5 shadow-xl">
              <Search className="h-10 w-10 text-[#FFF200] animate-pulse" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Caminho Desconhecido</h2>
            <p className="text-zinc-400 text-base md:text-lg max-w-[300px] mx-auto font-medium">
              Parece que essa página se perdeu na produção. Escolha uma rota segura abaixo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            <Button
              onClick={() => navigate("/")}
              className="h-14 rounded-2xl bg-[#FFF200] text-black hover:bg-[#ffe600] font-extrabold text-lg gap-2 shadow-[0_0_20px_-5px_rgba(255,242,0,0.3)] transition-all hover:scale-[1.03] active:scale-[0.97]"
            >
              <Home className="h-5 w-5" />
              INÍCIO
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              className="h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 font-bold text-lg gap-2 transition-all hover:scale-[1.03] active:scale-[0.97]"
            >
              <MoveLeft className="h-5 w-5" />
              VOLTAR
            </Button>
          </div>
        </div>

        {/* Logo and Branding Footer */}
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-500">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white tracking-tighter">Direct AI</span>
            <div className="w-8 h-8 rounded-lg bg-[#FFF200] flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,242,0,0.3)]">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0" />
            </div>
          </div>
          <span className="text-[10px] text-zinc-600 font-bold tracking-[0.3em] uppercase">
            Gestão Inteligente &bull; {APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
