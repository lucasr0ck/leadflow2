import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * DEBUG PANEL - Remove em produção
 * Exibe informações em tempo real sobre o state da aplicação
 */
export const DebugPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { currentTeam, availableTeams, loading: teamLoading } = useTeam();
  const [show, setShow] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Capturar mudanças de state
  useEffect(() => {
    const log = `[${new Date().toLocaleTimeString()}] Auth: ${authLoading ? 'LOADING' : user ? 'LOGGED IN' : 'NOT LOGGED'} | Team: ${teamLoading ? 'LOADING' : currentTeam ? currentTeam.team_name : 'NONE'} | Available: ${availableTeams.length}`;
    setLogs(prev => [...prev.slice(-19), log]);
  }, [user, authLoading, currentTeam, teamLoading, availableTeams]);

  // Toggle com Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShow(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-50 flex items-center justify-center"
        title="Debug Panel (Ctrl+Shift+D)"
      >
        🔍
      </button>
    );
  }

  const savedTeamId = localStorage.getItem('leadflow_current_team_id');
  
  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[600px] overflow-auto shadow-2xl z-50 border-2 border-blue-500">
      <CardHeader className="bg-blue-50 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            🔍 Debug Panel
            <span className="text-xs text-slate-500">(Ctrl+Shift+D)</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShow(false)}
            className="h-6 w-6 p-0"
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs pt-4">
        {/* Auth Status */}
        <div className="space-y-1">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            {authLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : user ? (
              <CheckCircle className="w-3 h-3 text-green-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-red-600" />
            )}
            Auth Status
          </h4>
          <div className="bg-slate-50 p-2 rounded font-mono text-[10px]">
            <div>Loading: {authLoading ? 'YES' : 'NO'}</div>
            <div>User: {user?.email || 'NULL'}</div>
          </div>
        </div>

        {/* Team Status */}
        <div className="space-y-1">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            {teamLoading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : currentTeam ? (
              <CheckCircle className="w-3 h-3 text-green-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-orange-600" />
            )}
            Team Status
          </h4>
          <div className="bg-slate-50 p-2 rounded font-mono text-[10px]">
            <div>Loading: {teamLoading ? 'YES' : 'NO'}</div>
            <div>Current: {currentTeam?.team_name || 'NULL'}</div>
            <div>Current ID: {currentTeam?.team_id || 'NULL'}</div>
            <div>Available: {availableTeams.length}</div>
            <div>Saved ID: {savedTeamId || 'NULL'}</div>
          </div>
        </div>

        {/* Available Teams */}
        {availableTeams.length > 0 && (
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-700">Available Teams</h4>
            <div className="bg-slate-50 p-2 rounded font-mono text-[10px] space-y-1">
              {availableTeams.map(team => (
                <div
                  key={team.team_id}
                  className={`p-1 rounded ${
                    team.team_id === currentTeam?.team_id
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-white'
                  }`}
                >
                  {team.team_name} {team.team_id === currentTeam?.team_id && '← CURRENT'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* localStorage */}
        <div className="space-y-1">
          <h4 className="font-semibold text-slate-700">LocalStorage</h4>
          <div className="bg-slate-50 p-2 rounded font-mono text-[10px]">
            {Object.keys(localStorage)
              .filter(key => key.startsWith('leadflow'))
              .map(key => (
                <div key={key}>
                  {key}: {localStorage.getItem(key)?.substring(0, 20)}...
                </div>
              ))}
          </div>
        </div>

        {/* State Change Log */}
        <div className="space-y-1">
          <h4 className="font-semibold text-slate-700">State Change Log</h4>
          <div className="bg-slate-900 text-green-400 p-2 rounded font-mono text-[9px] max-h-48 overflow-auto">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="w-full text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reload Page
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="w-full text-xs"
          >
            Clear Storage & Reload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
