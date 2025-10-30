
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

interface SellerPerformanceData {
  seller_name: string;
  contact_phone: string;
  contact_description: string | null;
  click_count: number;
}

interface SellerPerformanceCardProps {
  campaignId: string;
  startDate: Date;
  endDate: Date;
}

export const SellerPerformanceCard = ({ campaignId, startDate, endDate }: SellerPerformanceCardProps) => {
  const [sellerData, setSellerData] = useState<SellerPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSellerPerformance = async () => {
      try {
        setLoading(true);
        
        const { data: clicksData } = await supabase
          .from('clicks2')
          .select(`
            campaign_link_id,
            created_at,
            campaign_links (
              contact_id,
              seller_contacts2 (
                phone_number,
                description,
                sellers2 (
                  name
                )
              )
            )
          `)
          .eq('campaign_id', campaignId)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        if (clicksData) {
          // Process and aggregate the data
          const performanceMap = new Map<string, SellerPerformanceData>();
          
          clicksData.forEach((click: any) => {
            if (click.campaign_links?.seller_contacts) {
              const contact = click.campaign_links.seller_contacts;
              const seller = contact.sellers;
              const key = `${seller?.name}-${contact.phone_number}`;
              
              if (performanceMap.has(key)) {
                performanceMap.get(key)!.click_count += 1;
              } else {
                performanceMap.set(key, {
                  seller_name: seller?.name || 'Unknown',
                  contact_phone: contact.phone_number,
                  contact_description: contact.description,
                  click_count: 1
                });
              }
            }
          });
          
          // Sort by click count and take top 5
          const sortedData = Array.from(performanceMap.values())
            .sort((a, b) => b.click_count - a.click_count)
            .slice(0, 5);
          
          setSellerData(sortedData);
        }
      } catch (error) {
        console.error('Error fetching seller performance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSellerPerformance();
  }, [campaignId, startDate, endDate]);

  const totalClicks = sellerData.reduce((sum, seller) => sum + seller.click_count, 0);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/20 animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sellerData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground p-6">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum clique registrado no período</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Posição</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center w-20">Cliques</TableHead>
                <TableHead className="text-center w-28">Distribuição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellerData.map((seller, index) => {
                const percentage = totalClicks > 0 ? (seller.click_count / totalClicks) * 100 : 0;
                const maxClicks = Math.max(...sellerData.map(s => s.click_count));
                const barWidth = maxClicks > 0 ? (seller.click_count / maxClicks) * 100 : 0;
                
                return (
                  <TableRow key={`${seller.seller_name}-${seller.contact_phone}`}>
                    <TableCell>
                      <Badge variant={index === 0 ? "default" : "outline"} className="font-bold">
                        #{index + 1}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {seller.seller_name}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {seller.contact_phone}
                        </p>
                        {seller.contact_description && (
                          <p className="text-xs text-muted-foreground/70 truncate">
                            {seller.contact_description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-2">
                        <div className="font-bold text-foreground">
                          {seller.click_count}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        <div className="font-bold text-foreground">
                          {percentage.toFixed(1)}%
                        </div>
                        <Progress value={percentage} className="h-1.5" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
