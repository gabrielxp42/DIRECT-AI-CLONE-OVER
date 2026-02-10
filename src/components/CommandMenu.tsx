import * as React from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Plus,
  User,
  FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClientes, usePedidos } from "@/hooks/useDataFetch";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useSession } from "@/contexts/SessionProvider";

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const { session } = useSession();

  // Fetch de dados para busca rápida
  const { data: clientes } = useClientes();
  const { data: pedidos } = usePedidos();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  if (!session) return null;

  return (
    <>
      {/* Texto flutuante removido conforme solicitado */}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Digite um comando ou busque..." autoComplete="off" />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          <CommandGroup heading="Navegação">
            <CommandItem onSelect={() => runCommand(() => navigate("/"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Dashboard</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/pedidos"))}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              <span>Pedidos</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/clientes"))}>
              <User className="mr-2 h-4 w-4" />
              <span>Clientes</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/produtos"))}>
              <Package className="mr-2 h-4 w-4" />
              <span>Produtos</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/reports"))}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Relatórios</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Ações Rápidas">
            <CommandItem onSelect={() => runCommand(() => navigate("/pedidos", { state: { openForm: true } }))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Novo Pedido</span>
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => navigate("/clientes", { state: { openForm: true } }))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Novo Cliente</span>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {clientes && clientes.length > 0 && (
            <CommandGroup heading="Clientes">
              {clientes.slice(0, 5).map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  onSelect={() => runCommand(() => navigate("/clientes", { state: { filterClientId: cliente.id, filterClientName: cliente.nome } }))}
                  value={`cliente ${cliente.nome}`}
                >
                  <User className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{cliente.nome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {pedidos && pedidos.length > 0 && (
            <CommandGroup heading="Pedidos Recentes">
              {pedidos.slice(0, 5).map((pedido) => (
                <CommandItem
                  key={pedido.id}
                  onSelect={() => runCommand(() => navigate("/pedidos", { state: { filterStatus: pedido.status } }))}
                  value={`pedido ${pedido.order_number} ${pedido.clientes?.nome}`}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>Pedido #{pedido.order_number} - {pedido.clientes?.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{pedido.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

        </CommandList>
      </CommandDialog>
    </>
  );
}
