
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface SellerDistributionChartProps {
  data: Array<{
    seller_name: string;
    clicks: number;
    contacts: number;
  }>;
}

const COLORS = ['#2D9065', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'];

export const SellerDistributionChart = ({ data }: SellerDistributionChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição por Vendedor</CardTitle>
        <CardDescription>Percentual de cliques por vendedor</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ seller_name, percent }) => `${seller_name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="clicks"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
