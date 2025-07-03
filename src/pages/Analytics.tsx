
import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { AnalyticsSummaryCards } from '@/components/analytics/AnalyticsSummaryCards';
import { CampaignPerformanceChart } from '@/components/analytics/CampaignPerformanceChart';
import { SellerDistributionChart } from '@/components/analytics/SellerDistributionChart';
import { DailyClicksChart } from '@/components/analytics/DailyClicksChart';
import { RankingTables } from '@/components/analytics/RankingTables';
import { useAnalytics } from '@/hooks/useAnalytics';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const Analytics = () => {
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date())
  });

  const { analytics, loading } = useAnalytics(dateRange);

  const handleDateRangeChange = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
  };

  const dailyAverage = analytics.dailyClicks.length > 0 
    ? Math.round(analytics.totalClicks / analytics.dailyClicks.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-600">Carregando analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Analytics</h1>
          <p className="text-slate-600">Acompanhe o desempenho das suas campanhas</p>
        </div>
      </div>

      <DateRangeFilter onDateRangeChange={handleDateRangeChange} />

      <AnalyticsSummaryCards
        totalClicks={analytics.totalClicks}
        campaignCount={analytics.campaignStats.length}
        sellerCount={analytics.sellerStats.length}
        dailyAverage={dailyAverage}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CampaignPerformanceChart data={analytics.campaignStats} />
        <SellerDistributionChart data={analytics.sellerStats} />
      </div>

      <DailyClicksChart data={analytics.dailyClicks} />

      <RankingTables 
        campaignStats={analytics.campaignStats}
        sellerStats={analytics.sellerStats}
      />
    </div>
  );
};
