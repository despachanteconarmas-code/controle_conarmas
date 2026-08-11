-- Fix remaining function search paths for security
CREATE OR REPLACE FUNCTION update_warranty_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If repair_date is being set and wasn't set before, calculate warranty_until
  IF NEW.repair_date IS NOT NULL AND (OLD.repair_date IS NULL OR NEW.repair_date != OLD.repair_date) THEN
    NEW.warranty_until := NEW.repair_date + INTERVAL '30 days';
  END IF;
  
  -- Auto-update repair_date when status changes to PRONTA
  IF NEW.status = 'PRONTA' AND OLD.status != 'PRONTA' AND NEW.repair_date IS NULL THEN
    NEW.repair_date := now();
    NEW.warranty_until := now() + INTERVAL '30 days';
  END IF;
  
  -- Auto-update delivery_date when status changes to ENTREGUE
  IF NEW.status = 'ENTREGUE' AND OLD.status != 'ENTREGUE' AND NEW.delivery_date IS NULL THEN
    NEW.delivery_date := now();
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix the existing process_followups function to avoid the Data field error
CREATE OR REPLACE FUNCTION public.process_followups()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SET "TimeZone" TO 'America/Sao_Paulo'
AS $function$
declare
  r              "FollowUP"%rowtype;           -- linha atual da tabela
  ts_ultima_msg  timestamptz;                  -- timestamp última msg
  endpoint constant text := 'https://webhook.sizeimobi.shop/webhook/followup';
begin
  for r in
      select *
        from "FollowUP"
       where "followUp1" = 'OK'
          or "followUp2" = 'OK'
          or "followUp3" = 'OK'
  loop
    /* Data + Horario -> timestamp no fuso correto */
    ts_ultima_msg :=
      to_timestamp(r.data || ' ' || r.horario,
                   'DD-MM-YYYY HH24:MI:SS')
      at time zone 'America/Sao_Paulo';

    /* -------------------- FOLLOW-UP #1 – 30 Minutos -------------------- */
    if r."followUp1" = 'OK'
       and now() >= ts_ultima_msg + interval '30 minutes' then
      perform net.http_post(
        url     := endpoint,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body    := jsonb_build_object(
                    'nomeCliente', r."clientName",
                    'telefone',    r."telefone",
                    'FollowUP',    '30 Minutos'));
      update "FollowUP" set "followUp1" = 'OFF' where id = r.id;
    end if;

    /* -------------------- FOLLOW-UP #2 – 1 Hora ------------------- */
    if r."followUp2" = 'OK'
       and now() >= ts_ultima_msg + interval '1 hour' then
      perform net.http_post(
        url     := endpoint,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body    := jsonb_build_object(
                    'nomeCliente', r."clientName",
                    'telefone',    r."telefone",
                    'FollowUP',    '1 Hora'));
      update "FollowUP" set "followUp2" = 'OFF' where id = r.id;
    end if;

    /* -------------------- FOLLOW-UP #3 – 2 Horas ------------------- */
    if r."followUp3" = 'OK'
       and now() >= ts_ultima_msg + interval '2 hours' then
      perform net.http_post(
        url     := endpoint,
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body    := jsonb_build_object(
                    'nomeCliente', r."clientName",
                    'telefone',    r."telefone",
                    'FollowUP',    '2 Horas'));
      update "FollowUP" set "followUp3" = 'OFF' where id = r.id;
    end if;
  end loop;
end;
$function$;