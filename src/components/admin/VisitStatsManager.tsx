import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';

interface SectionStat {
  section: string;
  count: number;
}

interface VisitStatsManagerProps {
  isRTL: boolean;
}

const sectionLabels: Record<string, { fr: string; ar: string }> = {
  home: { fr: 'Accueil', ar: 'الرئيسية' },
  chat: { fr: 'Chat IA', ar: 'محادثة ذكية' },
  cv: { fr: 'Générateur CV', ar: 'إنشاء سيرة' },
  legal: { fr: 'Consultation Légale', ar: 'استشارة قانونية' },
  school: { fr: 'École de Langue', ar: 'مدرسة اللغة' },
  tools: { fr: 'Outils Pro', ar: 'أدوات احترافية' },
  invoice: { fr: 'Facture', ar: 'فاتورة' },
  quote: { fr: 'Devis → Facture', ar: 'عرض → فاتورة' },
  peinture: { fr: 'Calcul Peinture', ar: 'حساب الدهان' },
  profile: { fr: 'Profil', ar: 'الحساب' },
  news: { fr: 'Actualités', ar: 'أخبار' },
};

const VisitStatsManager = ({ isRTL }: VisitStatsManagerProps) => {
  const [stats, setStats] = useState<SectionStat[]>([]);
  const [totalVisits, setTotalVisits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      // Get all visit logs and aggregate client-side (simple approach)
      const { data, error } = await supabase
        .from('visit_logs')
        .select('section')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) {
        console.error('Error fetching visit stats:', error);
        setIsLoading(false);
        return;
      }

      const counts: Record<string, number> = {};
      (data || []).forEach(row => {
        counts[row.section] = (counts[row.section] || 0) + 1;
      });

      const sorted = Object.entries(counts)
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count);

      setStats(sorted);
      setTotalVisits(data?.length || 0);
      setIsLoading(false);
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
            <div className="p-3 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <MapPin className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className={cn(isRTL && "text-right")}>
              <p className="text-3xl font-bold">{totalVisits.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                {isRTL ? 'إجمالي الزيارات' : 'Total des visites'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className={cn("text-lg", isRTL && "text-right font-cairo")}>
            {isRTL ? 'زيارات حسب القسم' : 'Visites par section'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.length === 0 ? (
            <p className={cn("text-center text-muted-foreground py-8", isRTL && "font-cairo")}>
              {isRTL ? 'لا توجد بيانات بعد' : 'Aucune donnée de visite'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(isRTL && "text-right")}>{isRTL ? 'القسم' : 'Section'}</TableHead>
                  <TableHead className="text-right">{isRTL ? 'الزيارات' : 'Visites'}</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((stat) => {
                  const label = sectionLabels[stat.section];
                  return (
                    <TableRow key={stat.section}>
                      <TableCell className={cn("font-medium", isRTL && "text-right")}>
                        {label ? (isRTL ? label.ar : label.fr) : stat.section}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{stat.count}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {totalVisits > 0 ? ((stat.count / totalVisits) * 100).toFixed(1) + '%' : '0%'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VisitStatsManager;
