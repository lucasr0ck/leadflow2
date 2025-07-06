
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
          .from('clicks')
          .select(`
            campaign_link_id,
            created_at,
            campaign_links (
              contact_id,
              seller_contacts (
                phone_number,
                description,
                sellers (
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
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-100 animate-pulse rounded" />
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
      <CardContent>
        {sellerData.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum clique registrado no período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sellerData.map((seller, index) => (
              <div key={`${seller.seller_name}-${seller.contact_phone}`} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <p className="font-medium text-sm text-slate-800 truncate">
                      {seller.seller_name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 truncate font-mono">
                    {seller.contact_phone}
                  </p>
                  {seller.contact_description && (
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {seller.contact_description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="font-bold">
                    {seller.click_count}
                  </Badge>
                  <p className="text-xs text-slate-500 mt-1">cliques</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
