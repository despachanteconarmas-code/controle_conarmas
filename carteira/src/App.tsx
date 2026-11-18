import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth, useCarteira } from "./data";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import CardPage from "./pages/CardPage";
import BookPage from "./pages/BookPage";
import FirearmsPage from "./pages/FirearmsPage";
import MembershipPage from "./pages/MembershipPage";
import ProfilePage from "./pages/ProfilePage";
import VerifyPage from "./pages/VerifyPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 60_000 } },
});

const titles: Record<string, string> = {
  "/": "Carteira",
  "/livro": "Modo Livro",
  "/armas": "Armas e GTs",
  "/filiacao": "Filiação",
  "/perfil": "Perfil",
};

function Splash({ text = "Carregando..." }: { text?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4">
      <img src="/brasao.jpg" alt="" className="h-20 w-20 animate-pulse" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function MemberArea() {
  const { session, loading, signOut } = useAuth();
  const { data, isLoading, offlineSince, refresh } = useCarteira();
  const { pathname } = useLocation();

  if (loading) return <Splash />;
  if (!session) return <Login />;
  if (isLoading || data === undefined) return <Splash />;

  if (data === null) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
        <img src="/brasao.jpg" alt="" className="h-20 w-20" />
        <p className="font-semibold">Esta conta não está ligada a um filiado.</p>
        <p className="max-w-xs text-sm text-muted-foreground">Entre com o CPF de um filiado do Clube de Tiro Conarmas.</p>
        <Button variant="outline" onClick={signOut}>Sair</Button>
      </div>
    );
  }

  const reload = () => void refresh();
  const page = (() => {
    switch (pathname) {
      case "/": return <CardPage data={data} />;
      case "/livro": return <BookPage data={data} />;
      case "/armas": return <FirearmsPage data={data} refresh={reload} />;
      case "/filiacao": return <MembershipPage data={data} />;
      case "/perfil": return <ProfilePage data={data} refresh={reload} />;
      default: return <Navigate to="/" replace />;
    }
  })();

  return (
    <Layout title={titles[pathname] ?? "Carteira"} offlineSince={offlineSince}>
      {page}
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/v/:token" element={<VerifyPage />} />
              <Route path="*" element={<MemberArea />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
