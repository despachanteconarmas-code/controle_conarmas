-- Remove espaços sobrando no início e no fim dos campos de texto
--
-- Nomes digitados com espaço na frente ficavam fora de ordem na lista de
-- clientes: " JOÃO DE DEUS CASSIANO" aparecia antes de "ALBERTO", porque
-- espaço ordena antes de letra. Os dados vieram assim das OS antigas e o
-- backfill de clientes os copiou.
--
-- A partir daqui o formulário também aplica trim antes de gravar.

UPDATE public.customers
SET
  full_name            = btrim(full_name),
  address_street       = btrim(address_street),
  address_number       = btrim(address_number),
  address_neighborhood = btrim(address_neighborhood),
  address_city         = btrim(address_city),
  address_complement   = btrim(address_complement)
WHERE
  full_name            <> btrim(full_name)
  OR address_street       IS DISTINCT FROM btrim(address_street)
  OR address_number       IS DISTINCT FROM btrim(address_number)
  OR address_neighborhood IS DISTINCT FROM btrim(address_neighborhood)
  OR address_city         IS DISTINCT FROM btrim(address_city)
  OR address_complement   IS DISTINCT FROM btrim(address_complement);

UPDATE public.service_orders
SET
  customer_full_name   = btrim(customer_full_name),
  address_street       = btrim(address_street),
  address_number       = btrim(address_number),
  address_neighborhood = btrim(address_neighborhood),
  address_city         = btrim(address_city),
  address_complement   = btrim(address_complement),
  serial_number        = btrim(serial_number)
WHERE
  customer_full_name   <> btrim(customer_full_name)
  OR serial_number        <> btrim(serial_number)
  OR address_street       IS DISTINCT FROM btrim(address_street)
  OR address_number       IS DISTINCT FROM btrim(address_number)
  OR address_neighborhood IS DISTINCT FROM btrim(address_neighborhood)
  OR address_city         IS DISTINCT FROM btrim(address_city)
  OR address_complement   IS DISTINCT FROM btrim(address_complement);
