/**
 * Public document verification page reached via QR code scan.
 * Read-only, no authentication required. Shows ONLY non-sensitive data.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface VerificationData {
  id: string;
  document_number: string;
  document_type: string;
  status: string;
  payment_status: string;
  total_ttc: number;
  created_at: string;
  client_name: string;
  company_name: string | null;
  company_logo_url: string | null;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
};

const getStatusLabel = (status: string, paymentStatus: string) => {
  if (paymentStatus === 'paid') return { fr: 'Payé', ar: 'مدفوع', tone: 'paid' as const };
  if (status === 'cancelled') return { fr: 'Annulé', ar: 'ملغى', tone: 'cancelled' as const };
  if (status === 'converted') return { fr: 'Accepté', ar: 'مقبول', tone: 'accepted' as const };
  return { fr: 'En cours', ar: 'قيد المعالجة', tone: 'pending' as const };
};

const getDocTypeLabel = (type: string) => {
  if (type === 'facture') return { fr: 'Facture', ar: 'فاتورة' };
  return { fr: 'Devis', ar: 'عرض سعر' };
};

const VerifyDocumentPage = () => {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('not_found');
        setLoading(false);
        return;
      }
      try {
        const { data: rows, error: rpcError } = await supabase.rpc('get_document_verification', {
          _document_id: id,
        });
        if (rpcError) throw rpcError;
        if (!rows || (Array.isArray(rows) && rows.length === 0)) {
          setError('not_found');
        } else {
          const row = Array.isArray(rows) ? rows[0] : rows;
          setData(row as VerificationData);
        }
      } catch (e) {
        console.error('[Verify] fetch error:', e);
        setError('error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document introuvable</h1>
          <p className="text-gray-600 mb-1">Ce document n'a pas pu être vérifié.</p>
          <p className="text-gray-600" dir="rtl">لم يتم العثور على هذه الوثيقة</p>
          <p className="mt-6 text-xs text-gray-400">Anafy Pro</p>
        </div>
      </div>
    );
  }

  const status = getStatusLabel(data.status, data.payment_status);
  const docType = getDocTypeLabel(data.document_type);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Document Vérifié</h1>
          <p className="text-xl sm:text-2xl font-bold text-gray-700" dir="rtl">وثيقة موثقة</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Logo + Company */}
          {(data.company_logo_url || data.company_name) && (
            <div className="px-6 py-5 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
              {data.company_logo_url && (
                <img
                  src={data.company_logo_url}
                  alt={data.company_name || 'Logo'}
                  className="h-14 w-14 object-contain rounded-lg bg-white border border-gray-200 p-1"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">Émetteur</p>
                <p className="text-base font-bold text-gray-900 truncate">
                  {data.company_name || '—'}
                </p>
              </div>
            </div>
          )}

          {/* Fields */}
          <div className="px-6 py-5 space-y-4">
            <Field label="Type de document" labelAr="نوع الوثيقة" valueFr={docType.fr} valueAr={docType.ar} />
            <Field label="Numéro" labelAr="رقم" value={data.document_number} mono />
            <Field label="Client" labelAr="العميل" value={data.client_name || '—'} />
            <Field
              label="Date d'émission"
              labelAr="تاريخ الإصدار"
              value={formatDate(data.created_at)}
            />
            <Field label="Montant TTC" labelAr="المبلغ الإجمالي" value={formatCurrency(Number(data.total_ttc))} highlight />

            {/* Status badge */}
            <div className="pt-3">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-2">
                Statut <span className="text-gray-400">·</span> <span dir="rtl">الحالة</span>
              </p>
              <span
                className={
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ' +
                  (status.tone === 'paid'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : status.tone === 'accepted'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : status.tone === 'cancelled'
                    ? 'bg-gray-100 text-gray-600 border border-gray-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200')
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {status.fr} <span className="text-xs opacity-70">·</span>{' '}
                <span dir="rtl">{status.ar}</span>
              </span>
            </div>
          </div>

          {/* Authenticity message */}
          <div className="px-6 py-4 bg-green-50 border-t border-green-100">
            <p className="text-sm text-green-800 text-center leading-relaxed">
              Ce document a été généré et authentifié via <strong>Anafy Pro</strong>
            </p>
            <p className="text-sm text-green-800 text-center leading-relaxed mt-1" dir="rtl">
              هذه الوثيقة أصلية وموثقة عبر <strong>Anafy Pro</strong>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Anafy Pro · Vérification publique
        </p>
      </div>
    </div>
  );
};

// ─── Field component ─────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  labelAr: string;
  value?: string;
  valueFr?: string;
  valueAr?: string;
  mono?: boolean;
  highlight?: boolean;
}

const Field = ({ label, labelAr, value, valueFr, valueAr, mono, highlight }: FieldProps) => (
  <div>
    <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">
      {label} <span className="text-gray-400">·</span> <span dir="rtl">{labelAr}</span>
    </p>
    <p
      className={
        (highlight ? 'text-xl font-bold text-gray-900' : 'text-base font-semibold text-gray-800') +
        (mono ? ' font-mono' : '')
      }
    >
      {value ?? (
        <>
          {valueFr} <span className="text-gray-400 font-normal">·</span>{' '}
          <span dir="rtl">{valueAr}</span>
        </>
      )}
    </p>
  </div>
);

export default VerifyDocumentPage;
