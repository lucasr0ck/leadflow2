
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface DailyClicksChartProps {
  data: Array<{
    date: string;
    clicks: number;
  }>;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-sm">{payload[0].payload.date}</p>
        <p className="text-[#2D9065] font-bold text-lg">{payload[0].value.toLocaleString('pt-BR')} cliques</p>
      </div>
    );
  }
  return null;
};

export const DailyClicksChart = ({ data }: DailyClicksChartProps) => {
  const totalClicks = data.reduce((sum, day) => sum + day.clicks, 0);
  const avgClicks = data.length > 0 ? (totalClicks / data.length).toFixed(1) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Diária</CardTitle>
        <CardDescription>
          Distribuição de cliques ao longo do período • Média: {avgClicks} cliques/dia
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D9065" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2D9065" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="clicks" 
                stroke="#2D9065" 
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorClicks)"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
