import { useState, useEffect } from 'react';
import { Plus, Users, Building2, Crown, Shield, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { CreateTeamDialog } from '@/components/teams/CreateTeamDialog';
import type { UserTeam } from '@/types/database';

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: UserIcon,
};

const roleBadgeColors = {
  owner: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  admin: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  member: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
};

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
};

export const TeamManagement = () => {
  const { user } = useAuth();
  const { availableTeams, refreshTeams } = useTeam();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<UserTeam[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user, availableTeams]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setTeams(availableTeams);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as operações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamCreated = async () => {
    await refreshTeams();
    fetchTeams();
  };

  if (loading) {
    return (
      <main className="p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <PageHeader
            title="Gerenciar Operações"
            description="Gerencie suas operações e membros da equipe"
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Gerenciar Operações"
            description="Gerencie suas operações e membros da equipe"
            className="border-0 pb-0"
          />
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova Operação
          </Button>
        </div>

        {teams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                Você ainda não faz parte de nenhuma operação
              </p>
              <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Criar Primeira Operação
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const RoleIcon = roleIcons[team.role];
              return (
                <Card key={team.team_id} className="hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Building2 className="h-5 w-5 text-primary" />
                          {team.team_name}
                        </CardTitle>
                        <CardDescription className="mt-2 line-clamp-2">
                          {team.description || 'Sem descrição'}
                        </CardDescription>
                      </div>
                      <Badge className={roleBadgeColors[team.role]}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleLabels[team.role]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Slug:</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {team.team_slug}
                        </code>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={team.is_active ? 'default' : 'secondary'}>
                          {team.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>

                      {(team.role === 'owner' || team.role === 'admin') && (
                        <div className="pt-3 border-t">
                          <Button variant="outline" size="sm" className="w-full gap-2">
                            <Users className="h-4 w-4" />
                            Gerenciar Membros
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <CreateTeamDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleTeamCreated}
        />
      </div>
    </main>
  );
};
