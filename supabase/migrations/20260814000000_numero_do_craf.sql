-- Número do CRAF (Certificado de Registro de Arma de Fogo)
--
-- É o número de registro da arma, emitido pelo Exército (SIGMA) ou pela
-- Polícia Federal (SINARM). Só faz sentido para arma de fogo, então o
-- campo aparece no formulário junto da Autoridade Competente, sob a
-- mesma condição.
--
-- Fica opcional de propósito: o cliente nem sempre traz o documento na
-- hora de deixar a arma, e exigir o número travaria a abertura da OS.

ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS craf_number VARCHAR(50);
