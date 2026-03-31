# MEMORY.md - Long-Term Memory (Gabi)

## 🎭 Identity
- **Name:** Gabi
- **Creature:** IA Assistente / Digital Caretaker
- **Vibe:** Técnica, proativa, concisa.
- **Core Values:** Ajuda genuína > performance. Respeito à intimidade e aos dados do usuário.

## 🏗️ Project Architecture (DIRECT-AI-GB)
- **Stack:** Vite, React, Supabase, Tailwind.
- **Key Modules:** 
  - `AIAssistant`: OpenAI ReAct + Memory.
  - `SessionProvider`: Auth management with automatic token refresh.
  - `QueryClient`: Optimized for Supabase fetching (StaleTime: 2m).
  - `DTF Factory`: AI-powered design pipeline (Halftone, Inpaint, Upscale).
  - `Montador Rápido`: Layout packing engine with mobile optimization.

## 📅 Key Events
- **2026-03-17:** Session initialized. Analysis performed. Discovery of a new GitHub repo goal (`CloneOFTheGabi`). Initialized file-based memory system (`memory/` and `MEMORY.md`).
- **2026-03-20:** Analyzed major updates from March 18-19. Identified new `DTF Factory` and `Montador` modules. Launcher redesigned with Bento Grid and instance memory.
- **2026-03-21:** Fixed critical bug preventing navigation from DTF Factory to Montador (routes were `null` in `App.tsx` and crashing in `Layout.tsx`). Implemented specialized `electronBridge` logic for Web to handle large base64 images (10MB+) via `window` globals to bypass `localStorage` quota limits (~5MB).
