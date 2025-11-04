
import { useState } from 'react';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { AnalyticsSummaryCards } from '@/components/analytics/AnalyticsSummaryCards';
import { DailyClicksChart } from '@/components/analytics/DailyClicksChart';
import { CampaignPerformanceChart } from '@/components/analytics/CampaignPerformanceChart';
import { SellerDistributionChart } from '@/components/analytics/SellerDistributionChart';
import { RankingTables } from '@/components/analytics/RankingTables';
import { useAnalytics } from '@/hooks/useAnalytics';
import { subDays } from 'date-fns';
import { PageHeader } from '@/components/layout/PageHeader';

export const Analytics = () => {
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date(),
  });

  const { analytics, loading, error } = useAnalytics(dateRange);

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({
      start: startDate,
      end: endDate,
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Análise completa do desempenho das suas campanhas"
        actions={
          <DateRangeFilter
            onDateRangeChange={handleDateRangeChange}
          />
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          <h3 className="font-semibold">Erro ao carregar dados</h3>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gradient-to-br from-muted/30 to-muted/10 animate-pulse rounded-lg border" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gradient-to-br from-muted/30 to-muted/10 animate-pulse rounded-lg border" />
            <div className="h-80 bg-gradient-to-br from-muted/30 to-muted/10 animate-pulse rounded-lg border" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gradient-to-br from-muted/30 to-muted/10 animate-pulse rounded-lg border" />
            <div className="h-80 bg-gradient-to-br from-muted/30 to-muted/10 animate-pulse rounded-lg border" />
          </div>
        </div>
      ) : (
        <>
          <AnalyticsSummaryCards 
            totalClicks={analytics.totalClicks}
            campaignCount={analytics.campaignStats.length}
            sellerCount={analytics.sellerStats.length}
            dailyAverage={Math.round(analytics.totalClicks / Math.max(analytics.dailyClicks.length, 1))}
            growthPercentage={analytics.growthPercentage}
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyClicksChart data={analytics.dailyClicks} />
            <CampaignPerformanceChart data={analytics.campaignStats} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SellerDistributionChart data={analytics.sellerStats} />
            <RankingTables 
              campaignStats={analytics.campaignStats}
              sellerStats={analytics.sellerStats}
            />
          </div>
        </>
      )}
    </div>
  );
};
