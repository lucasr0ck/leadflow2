import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RotationEntry {
  sellerId: string;
  sellerName: string;
  repetitions: number;
}

interface SellerRotationChartProps {
  rotation: RotationEntry[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const SellerRotationChart = ({ rotation }: SellerRotationChartProps) => {
  if (rotation.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-sm">Distribuição de Leads</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">Nenhum vendedor adicionado</p>
        </CardContent>
      </Card>
    );
  }

  const totalSlots = rotation.reduce((sum, entry) => sum + entry.repetitions, 0);
  
  const chartData = rotation.map((entry) => ({
    name: entry.sellerName,
    value: entry.repetitions,
    percentage: Math.round((entry.repetitions / totalSlots) * 100),
  }));

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-sm">Distribuição de Leads</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `${value} slots (${Math.round((value / totalSlots) * 100)}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2 mt-4">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center text-xs">
              <div 
                className="w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="flex-1">{entry.name}</span>
              <span className="text-muted-foreground">
                {entry.value} slots ({entry.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};