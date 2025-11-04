
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, MousePointer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AnalyticsSummaryCardsProps {
  totalClicks: number;
  campaignCount: number;
  sellerCount: number;
  dailyAverage: number;
  growthPercentage?: number;
}

export const AnalyticsSummaryCards = ({ 
  totalClicks, 
  campaignCount, 
  sellerCount, 
  dailyAverage,
  growthPercentage = 0
}: AnalyticsSummaryCardsProps) => {
  
  const getGrowthIcon = () => {
    if (growthPercentage > 0) return <TrendingUp className="h-3 w-3" />;
    if (growthPercentage < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getGrowthColor = () => {
    if (growthPercentage > 0) return 'text-green-600 bg-green-50';
    if (growthPercentage < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatGrowth = () => {
    const abs = Math.abs(growthPercentage);
    return `${growthPercentage > 0 ? '+' : ''}${abs.toFixed(1)}%`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="border-l-4 border-l-[#2D9065] shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total de Cliques</CardTitle>
          <div className="h-10 w-10 rounded-full bg-[#2D9065]/10 flex items-center justify-center">
            <MousePointer className="h-5 w-5 text-[#2D9065]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#2D9065] mb-1">{totalClicks.toLocaleString('pt-BR')}</div>
          {growthPercentage !== 0 && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className={`text-xs font-medium ${getGrowthColor()}`}>
                {getGrowthIcon()}
                <span className="ml-1">{formatGrowth()}</span>
              </Badge>
              <span className="text-xs text-muted-foreground">vs período anterior</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Campanhas Ativas</CardTitle>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-500">{campaignCount}</div>
          <p className="text-xs text-muted-foreground mt-1">com dados no período</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Vendedores</CardTitle>
          <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-500">{sellerCount}</div>
          <p className="text-xs text-muted-foreground mt-1">receberam leads</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Média Diária</CardTitle>
          <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-500">{dailyAverage.toLocaleString('pt-BR')}</div>
          <p className="text-xs text-muted-foreground mt-1">cliques por dia</p>
        </CardContent>
      </Card>
    </div>
  );
};
