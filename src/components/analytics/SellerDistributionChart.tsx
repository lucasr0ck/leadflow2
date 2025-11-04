
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface SellerDistributionChartProps {
  data: Array<{
    seller_id?: string;
    seller_name: string;
    clicks: number;
    contacts: number;
    efficiency_score?: number;
    weight?: number;
  }>;
}

const COLORS = ['#2D9065', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#EC4899'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-sm mb-2">{data.seller_name}</p>
        <p className="text-sm"><span className="font-medium">Cliques:</span> {data.clicks.toLocaleString('pt-BR')}</p>
        <p className="text-sm"><span className="font-medium">Contatos:</span> {data.contacts}</p>
        {data.weight && (
          <>
            <p className="text-sm"><span className="font-medium">Peso:</span> {data.weight}</p>
            {data.efficiency_score && (
              <p className="text-sm">
                <span className="font-medium">Eficiência:</span> {data.efficiency_score.toFixed(2)} cliques/peso
              </p>
            )}
          </>
        )}
      </div>
    );
  }
  return null;
};

export const SellerDistributionChart = ({ data }: SellerDistributionChartProps) => {
  // Get top performer by efficiency
  const topPerformer = data.length > 0 
    ? data.reduce((max, seller) => 
        (seller.efficiency_score || 0) > (max.efficiency_score || 0) ? seller : max
      )
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Distribuição por Vendedor</CardTitle>
            <CardDescription>Percentual de cliques e eficiência por vendedor</CardDescription>
          </div>
          {topPerformer && topPerformer.efficiency_score && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              <TrendingUp className="h-3 w-3 mr-1" />
              Melhor: {topPerformer.seller_name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum vendedor com dados no período selecionado
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="clicks"
                  animationDuration={800}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Legend with efficiency scores */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.slice(0, 8).map((seller, index) => (
                <div key={seller.seller_id || seller.seller_name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="truncate font-medium">{seller.seller_name}</span>
                  {seller.efficiency_score && (
                    <span className="text-muted-foreground ml-auto">
                      {seller.efficiency_score.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
