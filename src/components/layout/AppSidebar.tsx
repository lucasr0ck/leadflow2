
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Users, Megaphone, LogOut, TrendingUp, FileText, Building2, Settings, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const settingsNavigation = [
  { name: 'Gerenciar Operações', href: '/settings/teams', icon: Building2 },
];

export const AppSidebar = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { state } = useSidebar();
  const { currentTeam, availableTeams, switchTeam, loading: teamLoading } = useTeam();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <div className="flex flex-col gap-3 px-4 py-3">
          <h1 className="text-lg font-semibold text-slate-800">LeadFlow</h1>
          
          {/* Seletor de Operação */}
          {!teamLoading && availableTeams.length > 0 && (
            <div className="space-y-1" key={currentTeam?.team_id || 'no-team'}>
              <span className="text-xs text-slate-500 font-medium">Operação Ativa</span>
              <Select
                value={currentTeam?.team_id || ''}
                onValueChange={(value) => {
                  console.log('Switching to team:', value);
                  switchTeam(value);
                }}
                disabled={availableTeams.length === 1}
              >
                <SelectTrigger className="h-9 w-full">
                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                    <Building2 className="w-4 h-4 shrink-0 text-slate-600" />
                    <SelectValue placeholder="Selecione uma operação">
                      {currentTeam?.team_name || 'Selecione uma operação'}
                    </SelectValue>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableTeams.map((team) => (
                    <SelectItem key={team.team_id} value={team.team_id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{team.team_name}</span>
                        {team.description && (
                          <span className="text-xs text-slate-500">{team.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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

        <SidebarGroup>
          <SidebarGroupLabel>Configurações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavigation.map((item) => (
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
            <Button
              onClick={async () => {
                console.log('Logout clicked');
                await signOut();
              }}
              variant="ghost"
              className="w-full justify-start"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
