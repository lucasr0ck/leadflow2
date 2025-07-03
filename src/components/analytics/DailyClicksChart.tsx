
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyClicksChartProps {
  data: Array<{
    date: string;
    clicks: number;
  }>;
}

export const DailyClicksChart = ({ data }: DailyClicksChartProps) => {
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Diária</CardTitle>
        <CardDescription>Número de cliques por dia no período selecionado</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="clicks" fill="#2D9065" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
