# 🎨 Guia para Gerar Ícones PWA

## Opção 1: Ferramenta Online (Mais Fácil) ⭐

### PWA Asset Generator Online
1. Acesse: https://www.pwabuilder.com/imageGenerator
2. Faça upload do `public/logo.png`
3. Clique em "Generate"
4. Baixe o ZIP com todos os ícones
5. Extraia os arquivos na pasta `public/`

### Favicon.io
1. Acesse: https://favicon.io/favicon-converter/
2. Faça upload do `public/logo.png`
3. Baixe o pacote gerado
4. Extraia na pasta `public/`

## Opção 2: Ferramenta CLI (Avançado)

### Usando PWA Asset Generator
```bash
# Instalar globalmente
npm install -g @vite-pwa/assets-generator

# Gerar ícones
pwa-assets-generator --preset minimal public/logo.png public
```

## Opção 3: Photoshop/GIMP (Manual)

### Tamanhos Necessários:

#### Ícones Padrão:
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

#### Apple Touch Icons:
- 57x57
- 60x60
- 72x72
- 76x76
- 114x114
- 120x120
- 144x144
- 152x152
- 180x180

#### Favicon:
- 16x16
- 32x32
- 48x48

### Passos:
1. Abra `public/logo.png` no editor
2. Para cada tamanho:
   - Redimensione mantendo proporção
   - Adicione padding de 5-10% se necessário
   - Exporte como PNG
   - Nomeie como `icon-{tamanho}.png` (ex: `icon-192.png`)

## Opção 4: Usar o Logo Atual (Temporário)

Por enquanto, o manifest já está configurado para usar `logo.png` em todos os tamanhos. Isso funciona, mas não é ideal para qualidade.

### Quando tiver tempo:
- Gere os ícones otimizados
- Atualize o `vite.config.ts` para apontar para os novos arquivos

## 📝 Atualizar vite.config.ts

Depois de gerar os ícones, atualize o manifest:

```typescript
icons: [
  {
    src: 'icon-72.png',
    sizes: '72x72',
    type: 'image/png',
  },
  {
    src: 'icon-96.png',
    sizes: '96x96',
    type: 'image/png',
  },
  // ... etc
]
```

## ✅ Por Enquanto

O app já está funcional com o logo atual. Os ícones otimizados são uma melhoria de qualidade, não um requisito crítico.

**Prioridade**: Baixa
**Impacto**: Visual (qualidade dos ícones)
