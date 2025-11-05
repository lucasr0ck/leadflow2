
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Users, Megaphone, LogOut, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Vendedores', href: '/sellers', icon: Users },
  { name: 'Campanhas', href: '/campaigns', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
];

export const Sidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-slate-200">
      <div className="flex h-16 items-center px-6 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800">LeadFlow</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                ${
                  isActive
                    ? 'bg-[#2D9065] text-white'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }
              `}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <Button
          onClick={async (e) => {
            console.log('🟢🟢🟢 [Sidebar] BOTÃO SAIR CLICADO');
            console.log('🟢 [Sidebar] Event:', e);
            console.log('🟢 [Sidebar] signOut function:', typeof signOut);
            
            try {
              console.log('🟢 [Sidebar] Chamando signOut()...');
              await signOut();
              console.log('🟢✅ [Sidebar] signOut() completado');
            } catch (error) {
              console.error('🟢❌ [Sidebar] ERRO ao executar signOut:', error);
            }
          }}
          variant="ghost"
          className="w-full justify-start text-slate-600 hover:text-slate-800"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>
  );
};
