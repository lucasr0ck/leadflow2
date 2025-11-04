
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CampaignPerformanceChartProps {
  data: Array<{
    campaign_id?: string;
    campaign_name: string;
    clicks: number;
    campaign_slug?: string;
    slug?: string;
  }>;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-sm">{payload[0].payload.campaign_name}</p>
        <p className="text-[#2D9065] font-bold text-lg">{payload[0].value.toLocaleString('pt-BR')} cliques</p>
      </div>
    );
  }
  return null;
};

export const CampaignPerformanceChart = ({ data }: CampaignPerformanceChartProps) => {
  // Take top 10 campaigns for better visualization
  const topData = data.slice(0, 10);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho por Campanha</CardTitle>
        <CardDescription>
          Top {topData.length} campanhas com mais cliques no período
          {data.length > 10 && ` (${data.length} campanhas no total)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhuma campanha com dados no período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topData} margin={{ bottom: 60, left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="campaign_name" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="clicks" 
                fill="#2D9065" 
                radius={[8, 8, 0, 0]}
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
