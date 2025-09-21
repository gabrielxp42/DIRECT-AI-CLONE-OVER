import React from 'react';
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const renderPageNumbers = () => {
    const pageNumbers = [];
    const maxPageButtons = 5; // Número máximo de botões de página visíveis

    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

    if (endPage - startPage + 1 < maxPageButtons) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }

    if (startPage > 1) {
      pageNumbers.push(
        <Button key={1} variant="ghost" size="icon" onClick={() => onPageChange(1)}>
          1
        </Button>
      );
      if (startPage > 2) {
        pageNumbers.push(
          <span key="dots-start" className="px-2 text-muted-foreground">...</span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "ghost"}
          size="icon"
          onClick={() => onPageChange(i)}
          className={cn(i === currentPage && "pointer-events-none")}
        >
          {i}
        </Button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(
          <span key="dots-end" className="px-2 text-muted-foreground">...</span>
        );
      }
      pageNumbers.push(
        <Button key={totalPages} variant="ghost" size="icon" onClick={() => onPageChange(totalPages)}>
          {totalPages}
        </Button>
      );
    }

    return pageNumbers;
  };

  if (totalPages <= 1) {
    return null; // Não renderiza a paginação se houver apenas uma página
  }

  return (
    <div className={cn("flex items-center justify-center gap-2 py-4", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {renderPageNumbers()}

      <Button
        variant="outline"
        size="icon"
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};