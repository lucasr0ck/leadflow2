// ============================================================================
// DEBUG UTILITY - Adicionar ao console do navegador
// ============================================================================
// Cole este código no Console do navegador (F12) para debug em tempo real

// Monitorar re-renders
window.debugLeadFlow = {
  logs: [],
  
  // Ativar modo verbose
  enableVerbose: () => {
    localStorage.setItem('LEADFLOW_DEBUG', 'true');
    console.log('✅ Debug mode ATIVADO - Recarregue a página');
  },
  
  // Desativar modo verbose
  disableVerbose: () => {
    localStorage.removeItem('LEADFLOW_DEBUG');
    console.log('✅ Debug mode DESATIVADO');
  },
  
  // Ver logs recentes
  showLogs: (filter) => {
    const logs = window.debugLeadFlow.logs;
    if (filter) {
      return logs.filter(l => l.includes(filter));
    }
    return logs;
  },
  
  // Limpar logs
  clearLogs: () => {
    window.debugLeadFlow.logs = [];
    console.log('✅ Logs limpos');
  },
  
  // Monitorar state do TeamContext
  inspectTeamContext: () => {
    const team = window.localStorage.getItem('leadflow_current_team_id');
    console.log('Current Team ID:', team);
    console.log('LocalStorage keys:', Object.keys(window.localStorage));
  },
  
  // Forçar reload do TeamContext
  resetTeamContext: () => {
    window.localStorage.removeItem('leadflow_current_team_id');
    window.location.reload();
  }
};

// Interceptar console.log para capturar
const originalLog = console.log;
console.log = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].startsWith('[')) {
    window.debugLeadFlow.logs.push(args.join(' '));
    if (window.debugLeadFlow.logs.length > 100) {
      window.debugLeadFlow.logs.shift(); // Manter apenas últimos 100
    }
  }
  originalLog.apply(console, args);
};

console.log('🔍 LeadFlow Debug Utility carregado!');
console.log('Use window.debugLeadFlow.enableVerbose() para ativar logs detalhados');
console.log('Use window.debugLeadFlow.showLogs() para ver logs recentes');
console.log('Use window.debugLeadFlow.inspectTeamContext() para verificar team state');
