import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Users, CalendarClock, Upload, Settings } from "lucide-react";

const links = [
  { to: "/filiados", label: "Filiados", icon: Users, end: true },
  { to: "/filiados/vencimentos", label: "Vencimentos", icon: CalendarClock },
  { to: "/filiados/importar", label: "Importar", icon: Upload },
  { to: "/filiados/configuracoes", label: "Carteirinha", icon: Settings },
];

/** Abas da área de filiados (carteira digital) */
export function MembersNav() {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label="Filiados">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
