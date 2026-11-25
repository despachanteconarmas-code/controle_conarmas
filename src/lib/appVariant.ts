// O painel de filiação roda em dois lugares, com as mesmas telas:
//   - sistema de OS (controle.armascon.com.br/filiados)
//   - app da carteira (carteira.armascon.com.br/filiados)
// O build da carteira define VITE_APP_VARIANT=carteira (vite.carteira.config.ts).
export const IS_CARTEIRA = import.meta.env.VITE_APP_VARIANT === "carteira";

/** Página inicial da equipe depois do login */
export const STAFF_HOME = IS_CARTEIRA ? "/filiados" : "/";

export const OS_URL = "https://controle.armascon.com.br";
export const CARTEIRA_URL = "https://carteira.armascon.com.br";
