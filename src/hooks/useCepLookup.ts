import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
}

/**
 * Consulta o CEP na ViaCEP e devolve o endereço.
 *
 * Devolve os campos em vez de escrever direto no formulário porque as
 * telas que usam isto têm nomes de campo diferentes (a OS e o cadastro
 * de cliente), e quem chama decide o que sobrescrever.
 */
export function useCepLookup() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Retorna null quando não há o que preencher: CEP ainda incompleto,
   * inexistente ou consulta fora do ar. Nesses casos o endereço continua
   * editável à mão, então não trava o cadastro.
   */
  const lookup = async (rawZip: string): Promise<CepAddress | null> => {
    const zip = rawZip.replace(/\D/g, "");
    // Ainda digitando: silêncio, senão reclama a cada tecla
    if (zip.length !== 8) return null;

    setIsLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado.",
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "CEP encontrado",
        description: "Endereço preenchido automaticamente.",
      });

      return {
        street: data.logradouro ?? "",
        neighborhood: data.bairro ?? "",
        city: data.localidade ?? "",
      };
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível consultar agora. Preencha o endereço à mão.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { lookup, isLoading };
}
