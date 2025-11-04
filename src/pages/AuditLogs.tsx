import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { AuditLog } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACTION_TYPE_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  seller: 'Vendedor',
  campaign: 'Campanha',
  contact: 'Contato',
  team: 'Time',
  user: 'Usuário',
};

const ACTION_TYPE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  login: 'default',
  logout: 'secondary',
  create: 'default',
  update: 'outline',
  delete: 'destructive',
};

export const AuditLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntity, setFilterEntity] = useState<string>('all');

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user, filterAction, filterEntity]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply filters
      if (filterAction !== 'all') {
        query = query.eq('action_type', filterAction);
      }

      if (filterEntity !== 'all') {
        query = query.eq('entity_type', filterEntity);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os logs de auditoria.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value: any) => {
    if (!value) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const formatUserAgent = (userAgent: string | null) => {
    if (!userAgent) return '-';
    
    // Extract browser and OS info
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/);
    const osMatch = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/);
    
    const browser = browserMatch ? browserMatch[0] : 'Desconhecido';
    const os = osMatch ? osMatch[1] : 'Desconhecido';
    
    return `${browser} (${os})`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Logs de Auditoria"
          description="Visualize todas as ações realizadas no sistema"
        />
        <div className="flex justify-center items-center h-64">
          <p className="text-muted-foreground">Carregando logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logs de Auditoria"
        description="Visualize todas as ações realizadas no sistema"
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Tipo de Ação</label>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Entidade</label>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                <SelectItem value="seller">Vendedor</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
                <SelectItem value="contact">Contato</SelectItem>
                <SelectItem value="team">Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Ações ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log de auditoria encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                    <TableHead>User Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACTION_TYPE_COLORS[log.action_type] || 'default'}>
                          {ACTION_TYPE_LABELS[log.action_type] || log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.entity_type ? (
                          <Badge variant="outline">
                            {ENTITY_TYPE_LABELS[log.entity_type] || log.entity_type}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="max-w-md">
                        {log.metadata && (
                          <div className="text-sm space-y-1">
                            {Object.entries(log.metadata as Record<string, any>).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="font-medium">{key}:</span> {formatValue(value)}
                              </div>
                            ))}
                          </div>
                        )}
                        {log.old_value && log.new_value && (
                          <div className="text-xs space-y-1 mt-2">
                            <div className="text-red-600">
                              <span className="font-medium">Anterior:</span> {formatValue(log.old_value)}
                            </div>
                            <div className="text-green-600">
                              <span className="font-medium">Novo:</span> {formatValue(log.new_value)}
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs">
                        {formatUserAgent(log.user_agent)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
