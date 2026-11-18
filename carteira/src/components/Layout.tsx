import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/formatters";
import { BookOpen, CalendarCheck, Crosshair, IdCard, UserRound, WifiOff } from "lucide-react";

const tabs = [
  { to: "/", label: "Carteira", icon: IdCard, end: true },
  { to: "/livro", label: "Livro", icon: BookOpen },
  { to: "/armas", label: "Armas", icon: Crosshair },
  { to: "/filiacao", label: "Filiação", icon: CalendarCheck },
  { to: "/perfil", label: "Perfil", icon: UserRound },
];

interface LayoutProps {
  title: string;
  offlineSince?: string | null;
  children: ReactNode;
}

export function Layout({ title, offlineSince, children }: LayoutProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <img src="/brasao.jpg" alt="" className="h-8 w-8 rounded-full" />
          <h1 className="text-lg font-semibold">{title}</h1>
        </div>
        {offlineSince && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-xs text-amber-300" role="status">
            <WifiOff className="h-3.5 w-3.5" />
            Sem internet. Mostrando os dados salvos em {formatDateTime(offlineSince)}.
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur" aria-label="Menu">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors",
                  isActive ? "text-gold" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
