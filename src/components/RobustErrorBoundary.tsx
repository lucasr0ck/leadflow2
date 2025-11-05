import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class RobustErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 [ErrorBoundary] Erro capturado:', error, errorInfo);
    
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Log detalhado para debug
    console.group('📊 Error Boundary - Detalhes');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Count:', this.state.errorCount + 1);
    console.groupEnd();

    // Se muitos erros, limpar state
    if (this.state.errorCount > 3) {
      console.warn('⚠️ Múltiplos erros detectados - limpando localStorage');
      this.clearAppState();
    }
  }

  clearAppState = () => {
    try {
      localStorage.removeItem('leadflow_current_team_id');
      sessionStorage.clear();
      console.log('✅ State limpo');
    } catch (e) {
      console.error('Erro ao limpar state:', e);
    }
  };

  handleReload = () => {
    this.clearAppState();
    window.location.reload();
  };

  handleGoHome = () => {
    this.clearAppState();
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <div>
                  <CardTitle className="text-2xl text-red-600">
                    Ops! Algo deu errado
                  </CardTitle>
                  <CardDescription className="mt-2">
                    A aplicação encontrou um erro inesperado
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-slate-100 rounded-lg p-4">
                  <p className="text-sm font-mono text-slate-800 mb-2">
                    {this.state.error.message}
                  </p>
                  {process.env.NODE_ENV === 'development' && (
                    <details className="text-xs text-slate-600">
                      <summary className="cursor-pointer mb-2 font-medium">
                        Stack Trace (Dev Only)
                      </summary>
                      <pre className="bg-white p-2 rounded text-xs overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {this.state.errorCount > 2 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Múltiplos erros detectados.</strong> O estado da aplicação 
                    será limpo ao recarregar.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReload}
                  className="flex-1"
                  size="lg"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recarregar Página
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Ir para Início
                </Button>
              </div>

              <p className="text-xs text-slate-500 text-center">
                Se o problema persistir, tente limpar o cache do navegador ou entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
