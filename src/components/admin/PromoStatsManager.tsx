import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Eye, MousePointer, TrendingUp, Loader2 } from 'lucide-react';

interface PromoMetric {
  id: string;
  promo_id: string;
  views: number;
  clicks: number;
  created_at: string;
  updated_at: string;
}

interface PromoStatsManagerProps {
  isRTL: boolean;
}

const PromoStatsManager = ({ isRTL }: PromoStatsManagerProps) => {
  const [metrics, setMetrics] = useState<PromoMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      const { data, error } = await supabase
        .from('promo_metrics')
        .select('*')
        .order('views', { ascending: false });

      if (error) {
        console.error('Error fetching promo metrics:', error);
      } else {
        setMetrics(data || []);
      }
      setIsLoading(false);
    };

    fetchMetrics();
  }, []);

  const calculateCTR = (views: number, clicks: number) => {
    if (views === 0) return '0%';
    return ((clicks / views) * 100).toFixed(1) + '%';
  };

  const totalViews = metrics.reduce((sum, m) => sum + m.views, 0);
  const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className={cn(isRTL && "text-right")}>
                <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'إجمالي المشاهدات' : 'Total Views'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <MousePointer className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className={cn(isRTL && "text-right")}>
                <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'إجمالي النقرات' : 'Total Clicks'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className={cn(isRTL && "text-right")}>
                <p className="text-2xl font-bold">{calculateCTR(totalViews, totalClicks)}</p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'معدل النقر' : 'CTR'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? 'تفاصيل الإعلانات' : 'Promo Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.length === 0 ? (
            <p className={cn("text-center text-muted-foreground py-8", isRTL && "font-cairo")}>
              {isRTL ? 'لا توجد بيانات بعد' : 'No data yet'}
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.map((metric) => (
                <div
                  key={metric.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg bg-muted/50",
                    isRTL && "flex-row-reverse"
                  )}
                >
                  <div className={cn(isRTL && "text-right")}>
                    <p className="font-medium">{metric.promo_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRTL ? 'آخر تحديث: ' : 'Last update: '}
                      {new Date(metric.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={cn("flex items-center gap-4", isRTL && "flex-row-reverse")}>
                    <div className="text-center">
                      <p className="text-lg font-bold text-blue-600">{metric.views}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isRTL ? 'مشاهدة' : 'Views'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">{metric.clicks}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {isRTL ? 'نقرة' : 'Clicks'}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-600">
                        {calculateCTR(metric.views, metric.clicks)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">CTR</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PromoStatsManager;
