import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Activity, AlertCircle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthStatus {
  health: Record<string, boolean>;
  stats: {
    errors_24h: number;
    ai_calls_24h: number;
    users_today: number;
    last_invoice: { document_number: string; created_at: string } | null;
  };
}

interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  occurrences: number;
  resolved: boolean;
  created_at: string;
}

const SystemDiagnosticManager = ({ isRTL }: { isRTL: boolean }) => {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-diagnostic', {
        body: {},
        method: 'GET',
      } as never);
      // fallback: direct fetch with mode=status
      if (error || !data) {
        const url = `https://htgqgtwbbrzbadusvtxg.supabase.co/functions/v1/admin-diagnostic?mode=status`;
        const r = await fetch(url, { method: 'GET' });
        const j = await r.json();
        setStatus(j);
      } else {
        setStatus(data as HealthStatus);
      }
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Diagnostic fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    const { data } = await supabase
      .from('admin_diagnostic_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setAlerts((data as AlertRow[]) ?? []);
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    const interval = setInterval(() => {
      fetchStatus();
      fetchAlerts();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchAlerts]);

  const markResolved = async (id: string) => {
    await supabase
      .from('admin_diagnostic_alerts')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', id);
    fetchAlerts();
  };

  const StatusDot = ({ ok }: { ok: boolean }) => (
    ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-red-500" />
  );

  const indicators = status ? [
    { label: 'Edge: ai-assistant', ok: status.health.ai_assistant },
    { label: 'Edge: translate-milestone-label', ok: status.health.translate_milestone_label },
    { label: 'Edge: send-to-accountant', ok: status.health.send_to_accountant },
    { label: 'Edge: send-chantier-report', ok: status.health.send_chantier_report },
    { label: 'Supabase', ok: status.health.supabase },
    { label: 'Resend (emails)', ok: status.health.resend },
  ] : [];

  return (
    <div className={cn('space-y-6', isRTL && 'text-right')}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Diagnostic système
          </CardTitle>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                MAJ: {lastUpdate.toLocaleTimeString('fr-FR')}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {indicators.map((ind) => (
              <div key={ind.label} className="flex items-center justify-between p-3 rounded-md border bg-card">
                <span className="text-sm font-medium">{ind.label}</span>
                <StatusDot ok={ind.ok} />
              </div>
            ))}
          </div>

          {status && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-md border bg-card">
                <div className="text-xs text-muted-foreground">Erreurs 500 (24h)</div>
                <div className="text-2xl font-bold">{status.stats.errors_24h}</div>
              </div>
              <div className="p-3 rounded-md border bg-card">
                <div className="text-xs text-muted-foreground">Appels IA (24h)</div>
                <div className="text-2xl font-bold">{status.stats.ai_calls_24h}</div>
              </div>
              <div className="p-3 rounded-md border bg-card">
                <div className="text-xs text-muted-foreground">Utilisateurs (aujourd'hui)</div>
                <div className="text-2xl font-bold">{status.stats.users_today}</div>
              </div>
              <div className="p-3 rounded-md border bg-card">
                <div className="text-xs text-muted-foreground">Dernière facture</div>
                <div className="text-sm font-semibold">
                  {status.stats.last_invoice
                    ? `${status.stats.last_invoice.document_number}`
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {status.stats.last_invoice
                    ? new Date(status.stats.last_invoice.created_at).toLocaleString('fr-FR')
                    : ''}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Historique alertes (30 dernières)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune alerte enregistrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Gravité</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Occ.</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleString('fr-FR')}</TableCell>
                    <TableCell className="text-xs font-mono">{a.alert_type}</TableCell>
                    <TableCell>
                      <Badge variant={a.severity === 'critical' ? 'destructive' : 'secondary'}>
                        {a.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{a.message}</TableCell>
                    <TableCell>{a.occurrences}</TableCell>
                    <TableCell>
                      {a.resolved ? (
                        <Badge variant="outline" className="text-emerald-600">Résolu</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600">En cours</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!a.resolved && (
                        <Button size="sm" variant="ghost" onClick={() => markResolved(a.id)}>
                          Résoudre
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemDiagnosticManager;
