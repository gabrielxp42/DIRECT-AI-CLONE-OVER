import React, { useState, useEffect, forwardRef } from 'react';
import { Input } from "@/components/ui/input";

interface CurrencyInputProps extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'onChange' | 'value'> {
  value: number; // O valor numérico real (ex: 700.00)
  onChange: (value: number) => void;
}

// Formata um número (ex: 700.00) para uma string de exibição (ex: "700,00")
const formatNumberToDisplay = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0,00';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true, // Garante separadores de milhares
  }).format(num);
};

// Formata dígitos brutos (ex: "70000") para uma string de exibição (ex: "700,00")
const formatRawDigitsToDisplay = (rawDigits: string): string => {
  if (!rawDigits) return '';
  // Remove zeros à esquerda, exceto se for apenas "0"
  const cleaned = rawDigits.replace(/^0+(?=\d)/, '');
  const num = parseInt(cleaned, 10);
  if (isNaN(num)) return '0,00';
  return formatNumberToDisplay(num / 100);
};

import { cn } from "@/lib/utils";

// ... imports

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    // Estado interno para o valor exibido no campo de input
    const [displayValue, setDisplayValue] = useState<string>(() => formatNumberToDisplay(value));

    useEffect(() => {
      // Atualiza displayValue se a prop 'value' externa mudar
      // Isso garante que o input reflita o valor real do formulário
      // IMPORTANTE: Só atualiza se o usuário não estiver digitando ativamente
      const currentNumericValueInDisplay = parseFloat(displayValue.replace(/\./g, '').replace(',', '.')) || 0;
      // Usa uma tolerância pequena para evitar loops de atualização por arredondamento
      const tolerance = 0.001;
      if (Math.abs(currentNumericValueInDisplay - value) > tolerance) {
        setDisplayValue(formatNumberToDisplay(value));
      }
    }, [value, displayValue]); // Inclui displayValue para evitar stale closures

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value; // Ex: "7", "70", "700", "70000"
      const cleanedDigits = rawInput.replace(/[^\d]/g, ''); // "7", "70", "700", "70000"

      // Atualiza o valor numérico real do formulário
      const newNumericValue = parseInt(cleanedDigits, 10) / 100 || 0;
      onChange(newNumericValue);

      // Atualiza o estado de exibição interna com o valor formatado enquanto o usuário digita
      setDisplayValue(formatRawDigitsToDisplay(cleanedDigits));
    };

    const handleBlur = () => {
      // Ao perder o foco, garante que o valor exibido esteja perfeitamente formatado
      setDisplayValue(formatNumberToDisplay(value));
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">R$</span>
        <Input
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn("pl-9", className)}
          {...props}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';