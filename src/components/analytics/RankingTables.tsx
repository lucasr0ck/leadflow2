
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RankingTablesProps {
  campaignStats: Array<{
    campaign_id?: string;
    campaign_name: string;
    clicks: number;
    campaign_slug?: string;
    slug?: string;
  }>;
  sellerStats: Array<{
    seller_id?: string;
    seller_name: string;
    clicks: number;
    contacts: number;
    efficiency_score?: number;
    weight?: number;
  }>;
}

export const RankingTables = ({ campaignStats, sellerStats }: RankingTablesProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Ranking de campanhas */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {campaignStats.map((campaign, index) => (
              <div key={campaign.campaign_id || campaign.slug} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                <div>
                  <span className="font-medium">#{index + 1} {campaign.campaign_name}</span>
                  <span className="text-sm text-slate-500 ml-2">({campaign.campaign_slug || campaign.slug})</span>
                </div>
                <span className="font-bold text-[#2D9065]">{campaign.clicks}</span>
              </div>
            ))}
            {campaignStats.length === 0 && (
              <p className="text-slate-500 text-center py-4">Nenhum dado encontrado para o período</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking de vendedores */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sellerStats.map((seller, index) => (
              <div key={seller.seller_id || seller.seller_name} className="flex justify-between items-center p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{index + 1}</span>
                    <span className="font-semibold">{seller.seller_name}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{seller.contacts} contato{seller.contacts !== 1 ? 's' : ''}</span>
                    {seller.weight && <span>• Peso: {seller.weight}</span>}
                    {seller.efficiency_score !== undefined && (
                      <span className="text-[#2D9065] font-medium">
                        • Eficiência: {seller.efficiency_score.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#2D9065] text-lg">{seller.clicks}</div>
                  <div className="text-xs text-slate-500">cliques</div>
                </div>
              </div>
            ))}
            {sellerStats.length === 0 && (
              <p className="text-slate-500 text-center py-4">Nenhum dado encontrado para o período</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
