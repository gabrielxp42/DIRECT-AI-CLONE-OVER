import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface InlineEditProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string | number;
  onSave: (value: string) => Promise<void> | void;
  textClassName?: string;
  formatDisplay?: (val: string | number) => React.ReactNode;
}

export function InlineEdit({ value, onSave, textClassName, formatDisplay, className, ...props }: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(value || ''));
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentValue(String(value || ''));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (currentValue !== String(value)) {
      setIsSaving(true);
      try {
        await onSave(currentValue);
      } catch (err) {
        // Revert on error
        setCurrentValue(String(value));
      } finally {
        setIsSaving(false);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setCurrentValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative inline-block w-full">
        <Input
          ref={inputRef}
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={cn("h-7 py-1 px-2 text-sm bg-black/50 border-white/20", className)}
          {...props}
        />
        {isSaving && <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-2 text-white/50" />}
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsEditing(true)}
      className={cn(
        "cursor-pointer hover:bg-white/10 px-1 -mx-1 rounded transition-colors border border-transparent hover:border-white/20 border-dashed min-h-[20px] flex items-center",
        !value && "text-white/30 italic",
        textClassName
      )}
    >
      {isSaving ? (
        <Loader2 className="h-3 w-3 animate-spin text-white/50" />
      ) : (
        formatDisplay ? formatDisplay(value) : (value || 'Clique para editar')
      )}
    </div>
  );
}
