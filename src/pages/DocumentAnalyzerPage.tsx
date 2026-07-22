// Zone d'analyse documentaire universelle (P4 — v1)
// Accepte un texte collé OU un seul fichier (image/PDF).
// Route les requêtes vers les Edge Functions existantes :
//   - fichier  -> scan-devis-document
//   - texte    -> smart-devis-analyzer (action analyze_image, sans image)
// Aucune duplication du moteur de devis : on affiche uniquement le résultat
// et on permet de transférer les lignes validées vers /pro/smart-devis.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Upload, FileText, Loader2, X, ArrowRight, AlertTriangle,
  CheckCircle2, FileSearch, Trash2,
} from 'lucide-react';

const SMART_DEVIS_PREFILL_KEY = 'smart_devis_prefill_v1';

const DOC_TYPE_LABELS_FR: Record<string, string> = {
  devis: 'Devis',
  facture_client: 'Facture client',
  facture_fournisseur: 'Facture fournisseur',
  dpgf: 'DPGF',
  cctp: 'CCTP',
  bordereau_prix: 'Bordereau de prix',
  plan_architecte: 'Plan d\'architecte',
  plan_technique: 'Plan technique',
  plan_electrique: 'Plan électrique',
  plan_plomberie: 'Plan plomberie',
  plan_facade: 'Plan de façade',
  bon_commande: 'Bon de commande',
  bon_livraison: 'Bon de livraison',
  situation_travaux: 'Situation de travaux',
  metre: 'Métré',
  note_calcul: 'Note de calcul',
  compte_rendu_chantier: 'Compte-rendu de chantier',
  rapport_expertise: 'Rapport d\'expertise',
  photo_chantier: 'Photo de chantier',
  croquis_manuscrit: 'Croquis manuscrit',
  note_manuscrite: 'Note manuscrite',
  document_administratif: 'Document administratif',
  unknown: 'Type non identifié',
};

interface AnalyzedItem {
  designation_fr: string;
  designation_ar?: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  lot?: string | null;
  confidence?: string;
  requiresReview?: boolean;
  reviewReasons?: string[];
}

interface AnalysisResult {
  documentType: string;
  documentCategory?: string;
  confidenceDocumentType?: string;
  documentTypeReason?: string | null;
  subject?: string | null;
  items: AnalyzedItem[];
  warnings?: string[];
  unreadableElements?: string[];
  prestationsFacturables?: string[];
  contraintesTechniques?: string[];
  informationsAdministratives?: string[];
  referencesReglementaires?: string[];
  elementsNonExploitables?: string[];
}

const readFileAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

const confidenceTone = (c?: string) => {
  switch (c) {
    case 'high': return 'bg-green-100 text-green-800 border-green-200';
    case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'low': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
const confidenceLabel = (c?: string) => {
  switch (c) {
    case 'high': return 'Fiable';
    case 'medium': return 'À confirmer';
    case 'low': return 'Faible';
    default: return 'Inconnu';
  }
};

const DocumentAnalyzerPage = () => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const canAnalyze = !analyzing && (text.trim().length > 0 || !!file);
  const hasInput = text.trim().length > 0 || !!file;

  const handleFile = useCallback(async (f: File | null) => {
    if (!f) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(f.type)) {
      toast({ variant: 'destructive', title: 'Format non supporté', description: 'Image (JPG/PNG/WEBP) ou PDF uniquement.' });
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Fichier trop volumineux', description: '20 Mo maximum.' });
      return;
    }
    setFile(f);
    setResult(null);
    setSelected(new Set());
    if (f.type.startsWith('image/')) {
      try {
        const url = await readFileAsDataUrl(f);
        setFilePreview(url);
      } catch { setFilePreview(null); }
    } else {
      setFilePreview(null);
    }
  }, [toast]);

  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyze = async () => {
    if (!canAnalyze) return;
    setAnalyzing(true);
    setResult(null);
    setSelected(new Set());
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Session expirée, reconnectez-vous.');

      let data: any;

      if (file) {
        // Route fichier -> scan-devis-document
        let base64: string;
        let mimeType = file.type;
        if (file.type.startsWith('image/')) {
          const dataUrl = await readFileAsDataUrl(file);
          const compressed = await compressImage(dataUrl);
          base64 = compressed.replace(/^data:[^;]+;base64,/, '');
          mimeType = 'image/jpeg';
        } else {
          const dataUrl = await readFileAsDataUrl(file);
          base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
        }
        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/scan-devis-document`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ fileData: base64, mimeType, fileName: file.name }),
        });
        const raw = await resp.text();
        try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
        if (!resp.ok) {
          const msg = (data && (data.error || data.message)) || `Erreur ${resp.status}`;
          throw new Error(String(msg));
        }
      } else {
        // Route texte -> smart-devis-analyzer
        const { data: resp, error } = await supabase.functions.invoke('smart-devis-analyzer', {
          body: { action: 'analyze_image', userMessage: text.trim() },
        });
        if (error) throw error;
        data = resp;
      }

      const items: AnalyzedItem[] = Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.suggestedItems) ? data.suggestedItems : [];

      const normalized: AnalysisResult = {
        documentType: String(data?.documentType || 'unknown'),
        documentCategory: data?.documentCategory,
        confidenceDocumentType: data?.confidenceDocumentType,
        documentTypeReason: data?.documentTypeReason ?? null,
        subject: data?.subject ?? data?.devis_subject_fr ?? null,
        items,
        warnings: Array.isArray(data?.warnings) ? data.warnings : [],
        unreadableElements: Array.isArray(data?.unreadableElements) ? data.unreadableElements : [],
        prestationsFacturables: Array.isArray(data?.prestationsFacturables) ? data.prestationsFacturables : [],
        contraintesTechniques: Array.isArray(data?.contraintesTechniques) ? data.contraintesTechniques : [],
        informationsAdministratives: Array.isArray(data?.informationsAdministratives) ? data.informationsAdministratives : [],
        referencesReglementaires: Array.isArray(data?.referencesReglementaires) ? data.referencesReglementaires : [],
        elementsNonExploitables: Array.isArray(data?.elementsNonExploitables) ? data.elementsNonExploitables : [],
      };

      setResult(normalized);
      // Par défaut : cocher les lignes fiables (pas à revérifier)
      const defaultSelected = new Set<number>();
      normalized.items.forEach((it, idx) => {
        if (!it.requiresReview && it.designation_fr) defaultSelected.add(idx);
      });
      setSelected(defaultSelected);

      if (normalized.items.length === 0) {
        toast({ variant: 'destructive', title: 'Aucune ligne extraite', description: 'Aucun poste facturable identifié.' });
      }
    } catch (e: any) {
      console.error('[DocumentAnalyzer] error:', e);
      toast({
        variant: 'destructive',
        title: 'Erreur d\'analyse',
        description: e?.message || 'Analyse impossible pour le moment.',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItem = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selected.size === result.items.length) setSelected(new Set());
    else setSelected(new Set(result.items.map((_, i) => i)));
  };

  const transferToSmartDevis = () => {
    if (!result) return;
    const chosen = result.items.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      toast({ variant: 'destructive', title: 'Aucune ligne sélectionnée' });
      return;
    }
    try {
      sessionStorage.setItem(SMART_DEVIS_PREFILL_KEY, JSON.stringify({
        items: chosen,
        subject: result.subject || '',
        sourceDocumentType: result.documentType,
        at: Date.now(),
      }));
    } catch (e) {
      console.error('[DocumentAnalyzer] sessionStorage failed:', e);
    }
    toast({ title: 'Lignes transférées', description: `${chosen.length} ligne(s) envoyée(s) au Devis intelligent.` });
    navigate('/pro/smart-devis');
  };

  const reset = () => {
    setText('');
    clearFile();
    setResult(null);
    setSelected(new Set());
  };

  const docTypeLabel = useMemo(() => {
    if (!result) return null;
    return DOC_TYPE_LABELS_FR[result.documentType] || result.documentType;
  }, [result]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-32" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSearch className="h-6 w-6 text-primary" />
          Analyse documentaire universelle
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Collez un texte ou importez un document. L'IA identifie le type et extrait les lignes exploitables.
        </p>
      </header>

      {/* Zone de saisie */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Texte à analyser</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Collez ici un extrait de CCTP, un e-mail, une description de chantier…"
              className="min-h-[140px] max-h-[280px] overflow-y-auto"
              dir="ltr"
              disabled={analyzing}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase">ou</span>
            <div className="h-px bg-border flex-1" />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Fichier (image ou PDF, 1 seul)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              disabled={analyzing}
            />
            {!file ? (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={analyzing}
              >
                <Upload className="h-5 w-5 mr-2" />
                Choisir un fichier
              </Button>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                {filePreview ? (
                  <img src={filePreview} alt={file.name} className="h-14 w-14 object-cover rounded" />
                ) : (
                  <div className="h-14 w-14 rounded bg-primary/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0" dir="ltr">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} Ko · {file.type}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile} disabled={analyzing}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 h-12"
              onClick={analyze}
              disabled={!canAnalyze}
            >
              {analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyse en cours…</>
              ) : (
                <><FileSearch className="h-4 w-4 mr-2" /> Analyser</>
              )}
            </Button>
            {hasInput && !analyzing && (
              <Button variant="outline" onClick={reset} title="Réinitialiser">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Résultat */}
      {result && (
        <div className="space-y-4">
          {/* Type détecté */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-sm text-muted-foreground">Type détecté :</span>
                <Badge variant="secondary" className="text-sm">{docTypeLabel}</Badge>
                <Badge className={cn('border', confidenceTone(result.confidenceDocumentType))} variant="outline">
                  {confidenceLabel(result.confidenceDocumentType)}
                </Badge>
                {result.documentCategory && result.documentCategory !== 'unknown' && (
                  <Badge variant="outline" className="text-xs">Catégorie : {result.documentCategory}</Badge>
                )}
              </div>
              {result.documentTypeReason && (
                <p className="text-xs text-muted-foreground italic">{result.documentTypeReason}</p>
              )}
              {result.subject && (
                <p className="text-sm mt-2"><span className="font-medium">Objet :</span> {result.subject}</p>
              )}
            </CardContent>
          </Card>

          {/* Avertissements */}
          {(result.warnings?.length || result.unreadableElements?.length) ? (
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    {result.warnings?.map((w, i) => (<p key={`w-${i}`}>{w}</p>))}
                    {result.unreadableElements?.map((w, i) => (
                      <p key={`u-${i}`} className="text-muted-foreground">Illisible : {w}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Lignes extraites */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Lignes extraites ({result.items.length})</h2>
                {result.items.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selected.size === result.items.length ? 'Tout décocher' : 'Tout sélectionner'}
                  </Button>
                )}
              </div>

              {result.items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Aucune ligne facturable identifiée.</p>
              ) : (
                <ul className="space-y-2">
                  {result.items.map((it, idx) => {
                    const checked = selected.has(idx);
                    return (
                      <li
                        key={idx}
                        className={cn(
                          'flex gap-3 p-3 rounded-md border',
                          checked ? 'border-primary/40 bg-primary/5' : 'border-border',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleItem(idx)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{it.designation_fr || '(sans désignation)'}</span>
                            <Badge className={cn('text-xs border', confidenceTone(it.confidence))} variant="outline">
                              {confidenceLabel(it.confidence)}
                            </Badge>
                            {it.requiresReview && (
                              <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                                À vérifier
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1" dir="ltr">
                            <span>Qté : {it.quantity ?? '—'}</span>
                            <span>Unité : {it.unit ?? '—'}</span>
                            <span>PU : {it.unitPrice != null ? `${it.unitPrice} €` : '—'}</span>
                            {it.lot && <span>Lot : {it.lot}</span>}
                          </div>
                          {it.reviewReasons && it.reviewReasons.length > 0 && (
                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                              {it.reviewReasons.join(' · ')}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {result.items.length > 0 && (
                <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row gap-2">
                  <div className="text-sm text-muted-foreground flex items-center gap-1 flex-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {selected.size} / {result.items.length} sélectionnée(s)
                  </div>
                  <Button onClick={transferToSmartDevis} disabled={selected.size === 0}>
                    Envoyer au Devis intelligent
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DocumentAnalyzerPage;
