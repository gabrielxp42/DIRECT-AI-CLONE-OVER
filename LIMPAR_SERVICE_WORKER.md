# 🔧 Script para Limpar Service Worker

## Problema
Página fica em branco/loading infinito após mudanças no código.

## Causa
Service Worker antigo está cacheando a versão antiga do app.

## Solução Rápida

### Opção 1: Console do Navegador
1. Abra DevTools (F12)
2. Console
3. Cole e execute:

```javascript
navigator.serviceWorker.getRegistrations().then(function(registrations) {
  for(let registration of registrations) {
    registration.unregister();
  }
  console.log('✅ Service Workers removidos!');
  location.reload();
});
```

---

### Opção 2: Application Tab
1. DevTools (F12)
2. Aba **Application**
3. **Service Workers** (menu lateral)
4. Clicar em **Unregister** em cada SW
5. **Hard Refresh** (Ctrl+Shift+R)

---

### Opção 3: Limpar Tudo
1. DevTools (F12)
2. Aba **Application**
3. **Clear storage** (menu lateral)
4. Marcar **Service Workers**
5. Clicar **Clear site data**
6. Recarregar

---

## Prevenção Automática

O código em `src/main.tsx` agora:
- ✅ Detecta SW em desenvolvimento
- ✅ Remove automaticamente
- ✅ Recarrega a página UMA vez
- ✅ Usa sessionStorage para evitar loop

---

## Se o Problema Persistir

Execute no terminal:
```bash
# Parar o servidor
Ctrl+C

# Limpar cache do Vite
pnpm run build --force

# Reiniciar
pnpm run dev
```

---

## Atalhos Úteis

| Ação | Atalho |
|------|--------|
| Hard Refresh | Ctrl+Shift+R |
| Limpar Cache | Ctrl+Shift+Delete |
| DevTools | F12 |
| Console | Ctrl+Shift+J |

---

**Sempre que a página não carregar:** Execute o script do Console (Opção 1) 🚀
