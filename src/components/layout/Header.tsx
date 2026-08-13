import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { 
  LogOut, 
  Moon, 
  Sun, 
  Monitor,
  Plus,
  Users
} from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

// Logo da empresa (hardcoded)
const LOGO_URL = "https://utwujmzfwpyixczstdjw.supabase.co/storage/v1/object/sign/logo/CAPA%20REDES%20SOCIAIS.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV81NmRkNTQxYi00NDkyLTRjYTUtOTg2ZC01ZDc3NjI5ODU5MTciLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL0NBUEEgUkVERVMgU09DSUFJUy5wbmciLCJpYXQiOjE3NTkzNDkwNDcsImV4cCI6MTkxNzAyOTA0N30.HuUX3EU4YERLcy-vzGdmkckhMY6gXJU17v0UC3ffz0Y";

export function Header() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'light':
        return <Sun className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <header className="border-b bg-card shadow-card">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo e título */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src={LOGO_URL} 
              alt="Conarmas" 
              className="h-10 w-auto object-contain"
              loading="eager"
              decoding="async"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Conarmas Controle de OS
              </h1>
              <p className="text-sm text-muted-foreground">
                Sistema de Ordem de Serviço
              </p>
            </div>
          </Link>

          {/* Ações rápidas */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/clientes')}
              className="hidden sm:flex"
            >
              <Users className="h-4 w-4 mr-2" />
              Clientes
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/clientes')}
              className="sm:hidden"
              size="icon"
              aria-label="Clientes"
            >
              <Users className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => navigate('/nova-os')}
              className="hidden sm:flex"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova OS
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/nova-os')}
              className="sm:hidden"
              size="icon"
              aria-label="Nova OS"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Menu do usuário */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">
                    {user?.email}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    Usuário do sistema
                  </p>
                </div>
                <DropdownMenuSeparator />
                
                {/* Tema */}
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Tema Claro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Tema Escuro</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>Sistema</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}