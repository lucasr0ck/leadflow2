import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'log' | 'error' | 'warn';
}

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true); // ✅ Abrir por padrão
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const { user, loading: authLoading } = useAuth();
  const { currentTeam, availableTeams, loading: teamLoading } = useTeam();

  // Adicionar log ao state
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'log') => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    }) + '.' + now.getMilliseconds().toString().padStart(3, '0');
    
    setLogs(prev => [...prev.slice(-49), { 
      timestamp, 
      message,
      type
    }]);
  }, []);

  // Capturar logs do console
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      // Só capturar logs relevantes
      if (message.includes('[TeamContext]') || 
          message.includes('[AuthContext]') || 
          message.includes('[Dashboard]') ||
          message.includes('[Campaigns]') ||
          message.includes('🟢') ||
          message.includes('🔵') ||
          message.includes('✅')) {
        addLog(message, 'log');
      }
    };

    console.error = (...args) => {
      originalError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog('❌ ' + message, 'error');
    };

    console.warn = (...args) => {
      originalWarn(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      addLog('⚠️ ' + message, 'warn');
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, [addLog]);

  // Atalho de teclado Ctrl+Shift+D
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        console.log('🔍 [DebugPanel] Toggled:', !isOpen);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  const getLocalStorageKeys = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('leadflow_') || key?.startsWith('sb-')) {
        keys.push({ key, value: localStorage.getItem(key)?.substring(0, 100) });
      }
    }
    return keys;
  };

  const clearLogs = () => {
    setLogs([]);
    console.log('🔍 [DebugPanel] Logs cleared');
  };

  return (
    <>
      {/* Botão flutuante - SEMPRE VISÍVEL */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-4 right-4 z-[9999] bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl transition-all border-4 border-white"
        title="Toggle Debug Panel (Ctrl+Shift+D)"
        style={{ 
          width: '64px', 
          height: '64px',
          fontSize: '28px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
      >
        {isOpen ? '✖️' : '🔍'}
      </button>

      {/* Panel */}
      {isOpen && (
        <Card className="fixed top-4 right-4 z-[9998] w-[600px] max-h-[90vh] overflow-y-auto border-blue-600 border-4 shadow-2xl bg-white">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4 border-b-2 pb-2">
              <h3 className="text-xl font-bold flex items-center gap-2">
                🔍 Debug Panel - LeadFlow
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xl"
              >
                ✖️
              </Button>
            </div>

            {/* Auth Status */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h4 className="font-bold mb-2 text-lg">🔐 Auth Status</h4>
              <div className="text-sm space-y-1 font-mono">
                <p><strong>Loading:</strong> {authLoading ? '⏳ TRUE' : '✅ FALSE'}</p>
                <p><strong>User:</strong> {user ? `✅ ${user.email}` : '❌ NOT LOGGED IN'}</p>
                {user && <p className="text-xs text-gray-600">User ID: {user.id}</p>}
              </div>
            </div>

            {/* Team Status */}
            <div className="mb-4 p-3 bg-green-50 rounded-lg border-2 border-green-200">
              <h4 className="font-bold mb-2 text-lg">👥 Team Status</h4>
              <div className="text-sm space-y-1 font-mono">
                <p><strong>Loading:</strong> {teamLoading ? '⏳ TRUE' : '✅ FALSE'}</p>
                <p><strong>Current Team:</strong> {currentTeam ? `✅ ${currentTeam.team_name}` : '❌ NONE'}</p>
                {currentTeam && (
                  <>
                    <p className="text-xs text-gray-600">ID: {currentTeam.team_id}</p>
                  </>
                )}
                <p><strong>Available Teams:</strong> {availableTeams.length} teams</p>
              </div>
            </div>

            {/* Available Teams */}
            {availableTeams.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border-2 border-yellow-200">
                <h4 className="font-bold mb-2 text-lg">📋 Available Teams ({availableTeams.length})</h4>
                <div className="text-sm space-y-2">
                  {availableTeams.map(team => (
                    <div 
                      key={team.team_id}
                      className={`p-2 rounded-lg border-2 ${team.team_id === currentTeam?.team_id ? 'bg-blue-100 border-blue-500 font-bold' : 'bg-white border-gray-200'}`}
                    >
                      <p className="font-medium">{team.team_name}</p>
                      <p className="text-xs text-gray-500">ID: {team.team_id.substring(0, 8)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LocalStorage */}
            <div className="mb-4 p-3 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h4 className="font-bold mb-2 text-lg">💾 LocalStorage</h4>
              <div className="text-xs space-y-1 font-mono">
                {getLocalStorageKeys().length === 0 ? (
                  <p className="text-gray-500">Empty</p>
                ) : (
                  getLocalStorageKeys().map(item => (
                    <div key={item.key} className="text-gray-700 bg-white p-1 rounded">
                      <strong>{item.key}:</strong> {item.value}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* State Change Log */}
            <div className="mb-4 p-3 bg-gray-900 rounded-lg border-2 border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-lg text-green-400">📝 Console Logs (last 50)</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearLogs}
                  className="text-xs"
                >
                  Clear Logs
                </Button>
              </div>
              <div className="text-xs space-y-1 font-mono max-h-[300px] overflow-y-auto bg-black text-green-400 p-2 rounded">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No logs yet... Waiting for console output...</p>
                ) : (
                  logs.slice().reverse().map((log, i) => (
                    <div 
                      key={i} 
                      className={`border-b border-gray-800 pb-1 mb-1 ${
                        log.type === 'error' ? 'text-red-400' : 
                        log.type === 'warn' ? 'text-yellow-400' : 
                        'text-green-400'
                      }`}
                    >
                      <span className="text-gray-600">[{log.timestamp}]</span> 
                      <span className="ml-2">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t-2 pt-4">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                size="default"
                className="flex-1 font-bold"
              >
                🔄 Reload Page (F5)
              </Button>
              <Button
                onClick={() => {
                  if (confirm('Tem certeza? Isso vai limpar TODOS os dados locais e recarregar a página.')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                variant="destructive"
                size="default"
                className="flex-1 font-bold"
              >
                🗑️ Clear Storage & Reload
              </Button>
            </div>
            
            <p className="text-xs text-gray-500 mt-2 text-center">
              Atalho: Ctrl+Shift+D para toggle | Panel sempre visível em modo debug
            </p>
          </div>
        </Card>
      )}
    </>
  );
};
