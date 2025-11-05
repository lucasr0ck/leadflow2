import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const DiagnosticPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { loading: teamLoading, currentTeam, availableTeams } = useTeam();

  const isReady = !authLoading && !teamLoading && !!user && !!currentTeam;

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-96 overflow-auto z-50 bg-white shadow-lg border-2 border-orange-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">🔍 Diagnóstico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        <div>
          <strong>Auth:</strong>
          <div className="ml-2 space-y-1">
            <div>Loading: <Badge variant={authLoading ? "destructive" : "default"}>{authLoading ? "SIM" : "NÃO"}</Badge></div>
            <div>User: <Badge variant={user ? "default" : "destructive"}>{user ? user.email : "NÃO"}</Badge></div>
          </div>
        </div>
        <div>
          <strong>Team:</strong>
          <div className="ml-2 space-y-1">
            <div>Loading: <Badge variant={teamLoading ? "destructive" : "default"}>{teamLoading ? "SIM" : "NÃO"}</Badge></div>
            <div>Current Team: <Badge variant={currentTeam ? "default" : "destructive"}>{currentTeam?.team_name || "NÃO"}</Badge></div>
            <div>Available: <Badge>{availableTeams.length}</Badge></div>
          </div>
        </div>
        <div className="pt-2 border-t">
          <strong>Status:</strong>
          <div className="mt-1">
            {authLoading && <Badge variant="destructive">Aguardando Auth...</Badge>}
            {!authLoading && !user && <Badge variant="destructive">Não autenticado</Badge>}
            {!authLoading && user && teamLoading && <Badge variant="destructive">Aguardando Team...</Badge>}
            {isReady && <Badge variant="default">Pronto ✅</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

