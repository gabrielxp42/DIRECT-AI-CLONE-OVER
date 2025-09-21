import { useEffect } from 'react';

/**
 * Hook para controlar dinamicamente a capacidade de zoom do usuário na meta tag viewport.
 * Define 'user-scalable=no' e 'maximum-scale=1.0' para desativar o zoom,
 * ou remove essas restrições para ativá-lo.
 *
 * @param enableZoom Se true, o zoom será permitido. Se false, o zoom será desativado.
 */
export const useViewportZoom = (enableZoom: boolean) => {
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      console.warn('Meta tag viewport não encontrada. Não é possível controlar o zoom.');
      return;
    }

    const originalContent = viewportMeta.getAttribute('content') || '';
    let newContent = originalContent;

    if (enableZoom) {
      // Remove as restrições de zoom para permitir o zoom
      newContent = newContent.replace(/,\s*maximum-scale=\d+(\.\d+)?/, '');
      newContent = newContent.replace(/,\s*user-scalable=(no|yes)/, '');
      // Garante que user-scalable seja 'yes' se não houver restrições
      if (!newContent.includes('user-scalable')) {
        newContent += ', user-scalable=yes';
      }
      // Garante que maximum-scale seja alto o suficiente para permitir zoom
      if (!newContent.includes('maximum-scale')) {
        newContent += ', maximum-scale=10.0';
      }
    } else {
      // Adiciona as restrições de zoom para desativar o zoom
      if (!newContent.includes('maximum-scale')) {
        newContent += ', maximum-scale=1.0';
      } else {
        newContent = newContent.replace(/maximum-scale=\d+(\.\d+)?/, 'maximum-scale=1.0');
      }
      if (!newContent.includes('user-scalable')) {
        newContent += ', user-scalable=no';
      } else {
        newContent = newContent.replace(/user-scalable=(no|yes)/, 'user-scalable=no');
      }
    }

    // Aplica o novo conteúdo
    viewportMeta.setAttribute('content', newContent);

    // Função de limpeza para restaurar o estado original ao desmontar o componente
    return () => {
      viewportMeta.setAttribute('content', originalContent);
    };
  }, [enableZoom]); // Re-executa se enableZoom mudar
};