
import { useState } from 'react';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { AnalyticsSummaryCards } from '@/components/analytics/AnalyticsSummaryCards';
import { DailyClicksChart } from '@/components/analytics/DailyClicksChart';
import { CampaignPerformanceChart } from '@/components/analytics/CampaignPerformanceChart';
import { SellerDistributionChart } from '@/components/analytics/SellerDistributionChart';
import { RankingTables } from '@/components/analytics/RankingTables';
import { useAnalytics } from '@/hooks/useAnalytics';
import { subDays } from 'date-fns';

export const Analytics = () => {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: analyticsData, isLoading } = useAnalytics(dateRange);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">Analytics</h1>
          <p className="text-sm lg:text-base text-slate-600 mt-1">
            Análise completa do desempenho das suas campanhas
          </p>
        </div>
        <DateRangeFilter
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
            <div className="h-64 bg-slate-100 animate-pulse rounded-lg" />
          </div>
        </div>
      ) : (
        <>
          <AnalyticsSummaryCards data={analyticsData?.summary} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyClicksChart data={analyticsData?.dailyClicks || []} />
            <CampaignPerformanceChart data={analyticsData?.campaignPerformance || []} />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SellerDistributionChart data={analyticsData?.sellerDistribution || []} />
            <RankingTables data={analyticsData?.rankings} />
          </div>
        </>
      )}
    </div>
  );
};
