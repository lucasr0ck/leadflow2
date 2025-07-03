
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CampaignPerformanceChartProps {
  data: Array<{
    campaign_name: string;
    clicks: number;
    slug: string;
  }>;
}

export const CampaignPerformanceChart = ({ data }: CampaignPerformanceChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Desempenho por Campanha</CardTitle>
        <CardDescription>Número de cliques por campanha no período selecionado</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="campaign_name" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip />
            <Bar dataKey="clicks" fill="#2D9065" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
