# DMC Dashboard — Design Workframe v2.0
> Deathcore Merch Store · Gestão de Pedidos · Redesign Visual

---

## 🎯 Direção Conceitual

**Tema:** *Forge UI* — Interface forjada em metal. Não é dark mode genérico; é como o painel de controle de uma fábrica underground de merch pesado. Texturas de aço escovado, acentos em âmbar quente (como solda elétrica), tipografia condensada de impacto.

**Referências visuais:**
- Painel industrial de usina + estética zine underground metal
- Menos SaaS, mais "backstage de tour"
- Contraste agressivo entre zonas de informação densa e espaço negativo cortante

---

## 🎨 Sistema de Cores

```css
:root {
  /* Fundos — camadas de profundidade */
  --bg-void:        #0A0A0B;   /* fundo absoluto, quase preto */
  --bg-surface:     #111114;   /* superfície de cards/sidebar */
  --bg-elevated:    #18181E;   /* linhas hover, painéis expandidos */
  --bg-border:      #2A2A35;   /* bordas sutis */

  /* Acentos — "Solda Elétrica" */
  --accent-amber:   #F5A623;   /* CTA principal, totais, highlights */
  --accent-amber-dim:#8A5C10;  /* estados secundários */
  --accent-ember:   #E8441A;   /* alertas, status FALTANDO */

  /* Status badges */
  --status-recebido-bg:   #0D2B1A;
  --status-recebido-text: #2ECC71;
  --status-faltando-bg:   #2B1010;
  --status-faltando-text: #E8441A;
  --status-pago-bg:       #0D1F2B;
  --status-pago-text:     #3B9EE8;

  /* Tipografia */
  --text-primary:   #F0EDE8;   /* off-white quente */
  --text-secondary: #8B8A96;   /* labels, metadata */
  --text-muted:     #4A4A58;   /* placeholders */

  /* Gradientes especiais */
  --gradient-amber: linear-gradient(135deg, #F5A623 0%, #E8441A 100%);
  --gradient-surface: linear-gradient(180deg, #18181E 0%, #111114 100%);
}
```

---

## 🔤 Tipografia

| Uso | Família | Peso | Observação |
|---|---|---|---|
| Títulos / Logo | `Barlow Condensed` | 700–900 | Impacto, caráter industrial |
| Corpo / Dados | `IBM Plex Mono` | 400–500 | Leitura densa de dados, feel técnico |
| Labels / Status | `Barlow` | 600 | Maiúsculas com tracking +0.08em |
| Valores monetários | `IBM Plex Mono` | 600 | Monoespaçado para alinhamento perfeito |

**Import:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;900&family=Barlow:wght@400;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## 📐 Layout Geral

```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR (220px fixo)  │  HEADER STRIP (48px)                   │
│                        ├────────────────────────────────────────│
│  [Logo DMC]            │  TOOLBAR: filtros / busca / ações bulk │
│                        ├────────────────────────────────────────│
│  • Pedidos ◀ active    │                                        │
│  • Arquivados          │  TABELA DE PEDIDOS                     │
│  • Clientes            │  (linhas expansíveis)                  │
│  • Estoque             │                                        │
│  • Erros e Defeitos    ├────────────────────────────────────────│
│  • Trocas e Dev.       │  PAINEL EXPANDIDO (quando selecionado) │
│                        │  ┌──────────────┐  ┌─────────────────┐│
│  ────────────────────  │  │ DADOS CLIENTE│  │  ITENS DO PEDIDO││
│  STATUS badge          │  │ + ENVIO      │  │  + SUBTOTAIS    ││
│  "Operação ativa"      │  └──────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Proporções:**
- Sidebar: `220px` width, `100vh` height, sticky
- Content area: `calc(100vw - 220px)`, overflow-y scroll
- Painel expandido: aparece *inline* abaixo da linha — não em modal

---

## 🧩 Componentes Detalhados

### 1. Sidebar

```
Estado atual (problema): Fundo escuro genérico, itens sem hierarquia visual clara

Redesign:
- Fundo: var(--bg-surface) com grain texture sutil (SVG noise filter)
- Logo "DMC": Barlow Condensed 900, uppercase, 22px
  - "DM" em var(--accent-amber), "C" em var(--text-primary)
  - Subtítulo "DASHBOARD" em 9px, letter-spacing 0.2em, var(--text-muted)
- Avatar: borda 2px sólida var(--accent-amber), shape hexagonal (clip-path)
- Nav items:
  - Ícone (20px) + label uppercase 11px Barlow 600
  - Active state: barra vertical esquerda 3px var(--accent-amber) + bg var(--bg-elevated)
  - Hover: bg var(--bg-elevated), transição 150ms ease
- Status badge bottom:
  - Dot pulsante verde (#2ECC71) com animação pulse keyframe
  - Texto "OPERAÇÃO ATIVA" em 10px monospace
```

---

### 2. Linha de Pedido (Table Row)

```
Colunas redesenhadas:
┌──┬──┬────────────────┬───────────┬───────────────────┬──────────┬────────┬──────────┐
│☐ │# │ CLIENTE        │  STATUS   │ PRODUTO PREVIEW   │ PAG.     │ TOTAL  │ DATA     │
└──┴──┴────────────────┴───────────┴───────────────────┴──────────┴────────┴──────────┘

Detalhes por coluna:

[#] Número do pedido:
  - IBM Plex Mono 600, 13px
  - Cor: var(--text-muted) por padrão → var(--accent-amber) no hover da linha
  - Prefixo "#" menor (10px)

[CLIENTE] Avatar + nome + email:
  - Avatar: círculo 32px, iniciais Barlow Condensed 700
    → Cores geradas por hash do nome (não aleatório, sempre consistente)
  - Nome: Barlow 600 14px var(--text-primary)
  - Email: IBM Plex Mono 400 11px var(--text-muted)

[STATUS PEDIDO] Badge pill:
  - RECEBIDO: fundo var(--status-recebido-bg), texto var(--status-recebido-text)
    borda 1px sólida com 40% opacity da cor do texto
  - FALTANDO: fundo var(--status-faltando-bg), texto var(--status-faltando-text)
    + ícone ⚠ antes do texto
  - Todos uppercase, Barlow 700 11px, padding 4px 10px, border-radius 3px

[PRODUTO PREVIEW] Thumbnails:
  - Máximo 2 thumbs empilhados (32x32px, border-radius 4px)
  - Se mais itens: chip "+N" em var(--accent-amber-dim)
  - Hover nos thumbs: scale(1.1) + z-index elevado (tooltip com nome)

[PAG. STATUS] Badge separado:
  - "$ RECEBIDO" → fundo var(--status-pago-bg), ícone $ em var(--status-pago-text)
  - Barlow 600 10px

[TOTAL] Valor:
  - IBM Plex Mono 600 14px var(--text-primary)
  - "R$" prefixo em var(--text-muted) 11px
  - Alinhamento direita estrito (colunas numéricas sempre monospace)

[DATA]:
  - "24 mar" bold + hora embaixo em var(--text-muted) 11px
  - IBM Plex Mono

ROW STATES:
  - Default: bg transparente
  - Hover: bg var(--bg-elevated), transição 100ms, cursor pointer
  - Selecionado/Expandido: bg var(--bg-elevated), borda esquerda 3px var(--accent-amber)
  - Checkbox: custom styled — borda 1.5px var(--bg-border), check em var(--accent-amber)
```

---

### 3. Painel Expandido (Detalhes do Pedido)

```
Layout: 2 colunas fluidas (40% / 60%)
Fundo: var(--bg-elevated) com borda-top 1px var(--accent-amber) 30% opacity

┌─────────────────────────────┬────────────────────────────────────────┐
│  DADOS DO CLIENTE + ENVIO   │  ITENS DO PEDIDO                       │
│                             │                                        │
│  Seção DADOS:               │  Header: "ITENS DO PEDIDO" + [+ ADD]  │
│  Label 10px uppercase muted │                                        │
│  Valor 13px IBM Plex Mono   │  Tabela de itens:                      │
│                             │  [thumb][nome+variação][anotada][qtd]  │
│  Linha separadora:          │  [preço][total][delete]                │
│  1px var(--bg-border)       │                                        │
│                             │  Checkbox "Anotada":                   │
│  Seção ENVIO:               │  → custom checkbox amber               │
│  [Método dropdown]          │                                        │
│  [Custo] [Rastreio link]    │  Subtotais:                            │
│                             │  Subtotal, Desconto(-), Frete          │
│                             │  ──────────────────────────            │
│                             │  TOTAL: grande, amber, condensed       │
└─────────────────────────────┴────────────────────────────────────────┘

Detalhes de componentes internos:

Labels de seção (DADOS DO CLIENTE, ENVIO, ITENS DO PEDIDO):
  - 9px Barlow 700 uppercase, letter-spacing 0.15em
  - Cor: var(--text-muted)
  - Ícone SVG 14px antes do texto

Campo de dado (label + valor):
  - Label: 10px var(--text-muted) uppercase monospace
  - Valor: 13px var(--text-primary) IBM Plex Mono
  - Layout: flex space-between, border-bottom 1px var(--bg-border) 50% opacity

Total final:
  - Label "Total:" Barlow Condensed 700 20px var(--text-secondary)
  - Valor: Barlow Condensed 900 26px var(--accent-amber)
  - Fundo: gradiente sutil var(--accent-amber) 5% opacity

Botão [+ Adicionar]:
  - Fundo: var(--accent-amber), cor texto: #0A0A0B (escuro)
  - Barlow 700 12px uppercase
  - Border-radius: 3px (não pill — mais industrial)
  - Hover: brightness(1.15) + shadow 0 0 12px var(--accent-amber) 40%
```

---

### 4. Toolbar / Header Strip

```
Altura: 48px
Fundo: var(--bg-surface) + border-bottom 1px var(--bg-border)

Esquerda:
  - Breadcrumb: "PEDIDOS" Barlow Condensed 700 18px
  - Contador: "( 8 ativos )" em var(--accent-amber) 13px monospace

Centro:
  - Search input estilizado:
    → Borda: 1px var(--bg-border), fundo var(--bg-void)
    → Ícone lupa em var(--text-muted)
    → Placeholder: "buscar pedido, cliente..." IBM Plex Mono 12px
    → Focus: borda var(--accent-amber) + glow sutil

Direita:
  - Filtro de status (pills clicáveis): TODOS / RECEBIDO / FALTANDO / EM PRODUÇÃO
  - Botão [NOVO PEDIDO]: var(--gradient-amber), Barlow 700 12px
```

---

### 5. Tabela — Cabeçalho

```
- Fundo: var(--bg-void) + border-bottom 1px var(--bg-border)
- Texto: 10px Barlow 700 uppercase, letter-spacing 0.12em, var(--text-muted)
- Colunas ordenáveis: ícone ↕ em var(--text-muted), ↑↓ ativo em var(--accent-amber)
- Altura: 36px
- Sticky top dentro do scroll da tabela
```

---

## ✨ Detalhes de Polimento

### Micro-interações
```css
/* Row hover */
.pedido-row {
  transition: background 100ms ease, border-left-color 100ms ease;
}

/* Badge pulse para FALTANDO */
@keyframes pulse-warning {
  0%, 100% { box-shadow: 0 0 0 0 rgba(232, 68, 26, 0.4); }
  50%       { box-shadow: 0 0 0 6px rgba(232, 68, 26, 0); }
}
.badge-faltando { animation: pulse-warning 2s ease infinite; }

/* Botão CTA glow */
.btn-primary:hover {
  box-shadow: 0 0 16px rgba(245, 166, 35, 0.5);
  transition: box-shadow 200ms ease;
}

/* Painel expand: slide down */
.painel-detalhes {
  animation: slideDown 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Textura de fundo na Sidebar
```css
/* SVG grain filter — aplicar como pseudo-elemento */
.sidebar::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,..."); /* SVG turbulence noise */
  opacity: 0.03;
  pointer-events: none;
}
```

### Scrollbar customizada
```css
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg-void); }
::-webkit-scrollbar-thumb {
  background: var(--bg-border);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover { background: var(--accent-amber-dim); }
```

---

## 📱 Comportamento Responsivo

| Breakpoint | Mudança |
|---|---|
| < 1280px | Sidebar colapsa para 56px (só ícones) |
| < 1024px | Painel expandido vira drawer lateral (400px) |
| < 768px | Tabela vira cards empilhados por pedido |

---

## 🔴 Problemas do Design Atual → Soluções

| Problema Identificado | Solução Proposta |
|---|---|
| Status badges sem distinção visual suficiente | Badges com borda colorida + ícone + pulse animation no FALTANDO |
| Valores monetários desalinhados (172,39 vs 380) | IBM Plex Mono em todas as colunas numéricas garante alinhamento |
| "Total Gasto: R$0,00" parece bug (dado vazio) | Campo só renderiza se tiver valor; senão mostra "—" em muted |
| Painel expandido sem separação visual clara | Border-top amber + fundo ligeiramente elevado |
| Sidebar sem hierarquia entre itens do menu | Active state com barra lateral + fundo elevado |
| Thumbnail de produto muito pequeno | 40x40px com hover zoom e tooltip com nome |
| Header sem contexto de quantidade de pedidos | Contador dinâmico no breadcrumb |
| Botão "+ Adicionar" perdido no canto | Reposicionado como botão primário amber com glow |

---

## 🛠 Stack de Implementação Recomendado

```
Frontend:     React + TypeScript (Vite)
Styling:      CSS Modules ou Tailwind com tema custom
Ícones:       Lucide React (consistência com o existente)
Animações:    CSS keyframes nativo (sem lib externa necessária)
Fontes:       Google Fonts (Barlow Condensed + IBM Plex Mono)
```

---

*DMC Dashboard Design Workframe v2.0 — Overpixel / Deathcore Merch Store*
