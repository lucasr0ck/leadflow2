
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RankingTablesProps {
  campaignStats: Array<{
    campaign_name: string;
    clicks: number;
    slug: string;
  }>;
  sellerStats: Array<{
    seller_name: string;
    clicks: number;
    contacts: number;
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
              <div key={campaign.slug} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                <div>
                  <span className="font-medium">#{index + 1} {campaign.campaign_name}</span>
                  <span className="text-sm text-slate-500 ml-2">({campaign.slug})</span>
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
              <div key={seller.seller_name} className="flex justify-between items-center p-2 rounded hover:bg-slate-50">
                <div>
                  <span className="font-medium">#{index + 1} {seller.seller_name}</span>
                  <span className="text-sm text-slate-500 ml-2">
                    ({seller.contacts} contato{seller.contacts !== 1 ? 's' : ''})
                  </span>
                </div>
                <span className="font-bold text-[#2D9065]">{seller.clicks}</span>
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
