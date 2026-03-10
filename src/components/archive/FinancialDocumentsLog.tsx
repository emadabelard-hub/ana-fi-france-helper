import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Receipt, Loader2, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocRow {
  id: string;
  document_type: string;
  document_number: string;
  client_name: string;
  total_ttc: number;
  status: string;
  created_at: string;
  chantier_id: string | null;
}

interface ChantierOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface Props {
  userId: string;
  isAdmin: boolean;
  isRTL: boolean;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export interface FinancialDocumentsLogRef {
  scrollIntoView: () => void;
}

const FinancialDocumentsLog = forwardRef<FinancialDocumentsLogRef, Props>(({ userId, isAdmin, isRTL }, ref) => {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterChantier, setFilterChantier] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [sortAsc, setSortAsc] = useState(false);

  const sectionRef = useNavigate ? document.getElementById('financial-docs-section') : null;

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      document.getElementById('financial-docs-section')?.scrollIntoView({ behavior: 'smooth' });
    },
  }));

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const docsQuery = supabase
        .from('documents_comptables')
        .select('id, document_type, document_number, client_name, total_ttc, status, created_at, chantier_id')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        docsQuery.eq('user_id', userId);
      }

      const chantiersQuery = supabase
        .from('chantiers')
        .select('id, name');

      if (!isAdmin) {
        chantiersQuery.eq('user_id', userId);
      }

      const clientsQuery = supabase
        .from('clients')
        .select('id, name');

      if (!isAdmin) {
        clientsQuery.eq('user_id', userId);
      }

      const [docsRes, chantiersRes, clientsRes] = await Promise.all([docsQuery, chantiersQuery, clientsQuery]);

      setDocs((docsRes.data || []) as DocRow[]);
      setChantiers((chantiersRes.data || []) as ChantierOption[]);
      setClients((clientsRes.data || []) as ClientOption[]);
      setLoading(false);
    };
    fetchAll();
  }, [userId, isAdmin]);

  // Build chantier lookup
  const chantierMap = useMemo(() => {
    const m: Record<string, string> = {};
    chantiers.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [chantiers]);

  const filtered = useMemo(() => {
    let result = [...docs];

    if (filterChantier !== 'all') {
      result = result.filter(d => d.chantier_id === filterChantier);
    }

    if (filterClient !== 'all') {
      result = result.filter(d => d.client_name === filterClient);
    }

    if (filterPeriod !== 'all') {
      const now = new Date();
      let start: Date;
      switch (filterPeriod) {
        case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case 'year': start = new Date(now.getFullYear(), 0, 1); break;
        default: start = new Date(0);
      }
      result = result.filter(d => new Date(d.created_at) >= start);
    }

    result.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortAsc ? da - db : db - da;
    });

    return result;
  }, [docs, filterChantier, filterClient, filterPeriod, sortAsc]);

  // Unique client names for filter
  const uniqueClients = useMemo(() => {
    const names = new Set(docs.map(d => d.client_name).filter(Boolean));
    return Array.from(names).sort();
  }, [docs]);

  const handleExportDocsCSV = () => {
    if (filtered.length === 0) return;
    const csvRows: CsvDocumentRow[] = filtered.map(d => ({
      date: d.created_at,
      type: d.document_type as 'devis' | 'facture',
      reference: d.document_number,
      clientName: d.client_name || '',
      projectName: d.chantier_id ? (chantierMap[d.chantier_id] || '') : null,
      totalHT: null,
      tvaRate: 0,
      tvaAmount: null,
      totalTTC: d.total_ttc,
    }));
    const csv = generateProfessionalCSV(csvRows);
    downloadCSV(csv, `documents_financiers_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div id="financial-docs-section" className="space-y-3">
      {/* Section Title */}
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <h2 className={cn('text-base font-bold text-foreground', isRTL && 'font-cairo')}>
          {isRTL ? '📋 سجل المستندات المالية' : '📋 Journal des Documents'}
        </h2>
        <Button size="sm" variant="outline" onClick={handleExportDocsCSV} className="gap-1 text-xs">
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      {/* Filters */}
      <div className={cn('flex flex-wrap gap-2', isRTL && 'flex-row-reverse')}>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-28 h-8 text-xs bg-background border-border">
            <SelectValue placeholder={isRTL ? 'الفترة' : 'Période'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'كل الفترات' : 'Toutes'}</SelectItem>
            <SelectItem value="month">{isRTL ? 'هذا الشهر' : 'Ce mois'}</SelectItem>
            <SelectItem value="quarter">{isRTL ? 'هذا الربع' : 'Ce trimestre'}</SelectItem>
            <SelectItem value="year">{isRTL ? 'هذه السنة' : 'Cette année'}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterChantier} onValueChange={setFilterChantier}>
          <SelectTrigger className="w-36 h-8 text-xs bg-background border-border">
            <SelectValue placeholder={isRTL ? 'المشروع' : 'Projet'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'كل المشاريع' : 'Tous les projets'}</SelectItem>
            {chantiers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-36 h-8 text-xs bg-background border-border">
            <SelectValue placeholder={isRTL ? 'الزبون' : 'Client'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRTL ? 'كل الزبائن' : 'Tous les clients'}</SelectItem>
            {uniqueClients.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-xs gap-1 text-muted-foreground"
          onClick={() => setSortAsc(prev => !prev)}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortAsc ? (isRTL ? 'الأقدم أولاً' : 'Plus ancien') : (isRTL ? 'الأحدث أولاً' : 'Plus récent')}
        </Button>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border">
          <CardContent className="py-10 text-center">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className={cn('text-sm text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'لا توجد مستندات مالية' : 'Aucun document financier'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => {
            const isDevis = doc.document_type === 'devis';
            const date = new Date(doc.created_at).toLocaleDateString('fr-FR');
            const projectName = doc.chantier_id ? chantierMap[doc.chantier_id] : null;

            return (
              <Card
                key={doc.id}
                className="border-border hover:border-accent/30 transition-colors cursor-pointer"
                onClick={() => navigate('/pro/documents', { state: { openDocumentId: doc.id } })}
              >
                <CardContent className={cn('p-3', isRTL && 'text-right')}>
                  <div className={cn('flex items-center justify-between gap-2', isRTL && 'flex-row-reverse')}>
                    <div className={cn('flex items-center gap-2 flex-1 min-w-0', isRTL && 'flex-row-reverse')}>
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        isDevis ? 'bg-blue-500/10' : 'bg-emerald-500/10'
                      )}>
                        {isDevis
                          ? <FileText className="h-4 w-4 text-blue-400" />
                          : <Receipt className="h-4 w-4 text-emerald-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('flex items-center gap-2 mb-0.5', isRTL && 'flex-row-reverse')}>
                          <span className={cn('text-sm font-bold text-foreground truncate', isRTL && 'font-cairo')}>
                            {doc.client_name || (isRTL ? 'بدون اسم' : 'Sans nom')}
                          </span>
                          <Badge variant="secondary" className={cn(
                            'text-[10px] shrink-0',
                            isDevis ? 'bg-blue-500/15 text-blue-400' : 'bg-emerald-500/15 text-emerald-400'
                          )}>
                            {isDevis ? (isRTL ? 'دوفي' : 'Devis') : (isRTL ? 'فاتورة' : 'Facture')}
                          </Badge>
                        </div>
                        <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', isRTL && 'flex-row-reverse')}>
                          <span>{date}</span>
                          <span className="opacity-60">•</span>
                          <span className="truncate">{doc.document_number}</span>
                          {projectName && (
                            <>
                              <span className="opacity-60">•</span>
                              <span className="truncate text-accent/70">{projectName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={cn(
                      'text-sm font-black shrink-0',
                      isDevis ? 'text-blue-400' : 'text-emerald-400'
                    )}>
                      {formatCurrency(doc.total_ttc)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
});

FinancialDocumentsLog.displayName = 'FinancialDocumentsLog';

export default FinancialDocumentsLog;
