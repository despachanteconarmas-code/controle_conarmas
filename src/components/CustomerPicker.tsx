import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCPF, formatPhone } from "@/lib/formatters";
import { Customer } from "@/types/database";
import { Search, UserCheck } from "lucide-react";

interface CustomerPickerProps {
  onSelect: (customer: Customer) => void;
  disabled?: boolean;
}

/**
 * Busca um cliente já cadastrado por nome ou CPF e devolve o registro
 * completo, para preencher o formulário da OS sem redigitação.
 */
export function CustomerPicker({ onSelect, disabled }: CustomerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const digitsOnly = debouncedSearch.replace(/\D/g, "");

  const { data: customers = [], isFetching } = useQuery({
    queryKey: ["customers-search", debouncedSearch],
    enabled: open && debouncedSearch.trim().length >= 2,
    queryFn: async () => {
      // Se o usuário digitou números, busca por CPF; senão, por nome
      const filter = digitsOnly.length >= 2
        ? `cpf.ilike.%${digitsOnly}%`
        : `full_name.ilike.%${debouncedSearch.trim()}%`;

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(filter)
        .order("full_name")
        .limit(10);

      if (error) throw error;
      return (data ?? []) as unknown as Customer[];
    },
  });

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
          disabled={disabled}
        >
          <Search className="mr-2 h-4 w-4" />
          Buscar cliente já cadastrado
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome ou o CPF..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {debouncedSearch.trim().length < 2 ? (
              <CommandEmpty>Digite ao menos 2 caracteres.</CommandEmpty>
            ) : isFetching ? (
              <CommandEmpty>Buscando...</CommandEmpty>
            ) : customers.length === 0 ? (
              <CommandEmpty>
                Nenhum cliente encontrado. Preencha os dados abaixo para
                cadastrá-lo.
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {customers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={customer.id}
                    onSelect={() => handleSelect(customer)}
                  >
                    <UserCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{customer.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatCPF(customer.cpf)}
                        {customer.phone ? ` · ${formatPhone(customer.phone)}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
