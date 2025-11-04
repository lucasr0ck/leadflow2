
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Users, Megaphone, LogOut, TrendingUp, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Vendedores', href: '/sellers', icon: Users },
  { name: 'Campanhas', href: '/campaigns', icon: Megaphone },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Logs de Auditoria', href: '/audit-logs', icon: FileText },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { state } = useSidebar();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex h-12 items-center px-4">
          <h1 className="text-lg font-semibold text-slate-800">LeadFlow</h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link to={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button
                onClick={signOut}
                variant="ghost"
                className="w-full justify-start"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
