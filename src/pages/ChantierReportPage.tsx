import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, ClipboardList, Camera, Download, Mail, Trash2, Loader2, Eraser } from 'lucide-react';
import SignaturePad from 'signature_pad';
import jsPDF from 'jspdf';
import { archivePdf } from '@/lib/documentArchive';

const COLORS = {
  navy: '#1B4F8A',
  navyDark: '#0F2A5E',
  gold: '#C9A84C',
  pageBg: '#F2F4F8',
};

type Weather = 'ensoleille' | 'nuageux' | 'pluie' | 'vent';

const WEATHER_OPTIONS: { value: Weather; ar: string; fr: string }[] = [
  { value: 'ensoleille', ar: 'مشمس', fr: 'Ensoleillé' },
  { value: 'nuageux', ar: 'غائم', fr: 'Nuageux' },
  { value: 'pluie', ar: 'مطر', fr: 'Pluie' },
  { value: 'vent', ar: 'رياح', fr: 'Vent' },
];

interface PhotoItem {
  id: string;
  dataUrl: string;
  name: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const downscaleImage = async (dataUrl: string, maxDim = 1280, quality = 0.82): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const ChantierReportPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isRTL } = useLanguage();

  const [reportNumber, setReportNumber] = useState<string>('');
  const [chantierName, setChantierName] = useState('');
  const [chantierAddress, setChantierAddress] = useState('');
  const [reportDate, setReportDate] = useState(todayISO());
  const [clientsList, setClientsList] = useState<Array<{ id: string; name: string; address: string | null }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [chantiersList, setChantiersList] = useState<Array<{ id: string; name: string; site_address: string | null }>>([]);
  const [selectedChantierId, setSelectedChantierId] = useState<string>('');

  const [workerCount, setWorkerCount] = useState('');
  const [workerNames, setWorkerNames] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [materials, setMaterials] = useState('');
  const [observations, setObservations] = useState('');
  const [weather, setWeather] = useState<Weather>('ensoleille');

  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  const [chefName, setChefName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');

  const chefSigRef = useRef<HTMLCanvasElement>(null);
  const clientSigRef = useRef<HTMLCanvasElement>(null);
  const chefPadRef = useRef<SignaturePad | null>(null);
  const clientPadRef = useRef<SignaturePad | null>(null);

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastPdfBase64, setLastPdfBase64] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  // Load clients from Supabase
  useEffect(() => {
    if (!user) return;
    const loadClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, address')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      if (error) {
        console.warn('clients load failed', error);
        return;
      }
      setClientsList((data || []) as any);
    };
    loadClients();
  }, [user]);

  // Load chantiers when client changes
  useEffect(() => {
    if (!user || !selectedClientId) {
      setChantiersList([]);
      setSelectedChantierId('');
      return;
    }
    const loadChantiers = async () => {
      const { data, error } = await supabase
        .from('chantiers')
        .select('id, name, site_address')
        .eq('user_id', user.id)
        .eq('client_id', selectedClientId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('chantiers load failed', error);
        return;
      }
      setChantiersList((data || []) as any);
    };
    loadChantiers();
  }, [user, selectedClientId]);

  // Init signature pads + resize for retina
  useEffect(() => {
    const init = (canvas: HTMLCanvasElement | null): SignaturePad | null => {
      if (!canvas) return null;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      return new SignaturePad(canvas, {
        backgroundColor: 'rgba(255,255,255,0)',
        penColor: '#0F2A5E',
        minWidth: 1,
        maxWidth: 2.2,
      });
    };
    chefPadRef.current = init(chefSigRef.current);
    clientPadRef.current = init(clientSigRef.current);
    return () => {
      chefPadRef.current?.off();
      clientPadRef.current?.off();
    };
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newPhotos: PhotoItem[] = [];
    for (const f of files) {
      try {
        const raw = await fileToDataUrl(f);
        const compressed = await downscaleImage(raw);
        newPhotos.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          dataUrl: compressed,
          name: f.name,
        });
      } catch (err) {
        console.warn('photo error', err);
      }
    }
    setPhotos((prev) => [...prev, ...newPhotos]);
    // Reset input so re-uploading same file works
    e.target.value = '';
  };

  const removePhoto = (id: string) => setPhotos((p) => p.filter((x) => x.id !== id));

  const weatherLabelFR = (w: Weather) =>
    WEATHER_OPTIONS.find((x) => x.value === w)?.fr || w;

  const validate = (): string | null => {
    if (!selectedClientId) return 'اختر العميل أولاً';
    if (!chantierAddress.trim()) return 'عنوان الشانتي مطلوب';
    if (!workDone.trim()) return 'الأعمال المنجزة مطلوبة';
    return null;
  };

  const generatePdf = async (): Promise<{ blob: Blob; base64: string; fileName: string } | null> => {
    const err = validate();
    if (err) {
      toast({ title: 'حقول ناقصة', description: err, variant: 'destructive' });
      return null;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // Header band
    doc.setFillColor(15, 42, 94); // navyDark
    doc.rect(0, 0, pageW, 32, 'F');

    // Logo (optional)
    if (profile?.logo_url) {
      try {
        const resp = await fetch(profile.logo_url);
        const blob = await resp.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        doc.addImage(dataUrl, 'JPEG', margin, 6, 20, 20, undefined, 'FAST');
      } catch (e) {
        console.warn('logo load failed', e);
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(profile?.company_name || 'Entreprise', margin + 24, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (profile?.siret) doc.text(`SIRET : ${profile.siret}`, margin + 24, 20);
    if (profile?.company_address) doc.text(profile.company_address, margin + 24, 25);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(201, 168, 76); // gold
    doc.text('RAPPORT DE CHANTIER', pageW - margin, 14, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`N° ${reportNumber}`, pageW - margin, 20, { align: 'right' });
    doc.text(
      `Date : ${new Date(reportDate).toLocaleDateString('fr-FR')}`,
      pageW - margin,
      25,
      { align: 'right' }
    );

    y = 40;
    doc.setTextColor(33, 33, 33);

    // Chantier identification block
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(margin, y, pageW - margin * 2, 22, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CHANTIER', margin + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nom : ${chantierName}`, margin + 3, y + 11);
    const addrLines = doc.splitTextToSize(`Adresse : ${chantierAddress}`, pageW - margin * 2 - 6);
    doc.text(addrLines, margin + 3, y + 16);
    y += 28;

    const writeSection = (title: string, content: string) => {
      if (!content.trim()) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 42, 94);
      doc.text(title, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(33, 33, 33);
      const lines = doc.splitTextToSize(content, pageW - margin * 2);
      // page break if needed
      if (y + lines.length * 5 > pageH - 30) {
        doc.addPage();
        y = margin;
      }
      doc.text(lines, margin, y);
      y += lines.length * 5 + 4;
    };

    writeSection(
      'Personnel présent',
      `${workerCount ? `Nombre d'ouvriers : ${workerCount}` : ''}${
        workerNames ? `\nNoms : ${workerNames}` : ''
      }${hoursWorked ? `\nHeures travaillées : ${hoursWorked}` : ''}`.trim()
    );
    writeSection('Météo', weatherLabelFR(weather));
    writeSection('Travaux réalisés', workDone);
    writeSection('Matériaux utilisés', materials);
    writeSection('Observations / Problèmes', observations);

    // Photos: 2 per row, new pages as needed
    if (photos.length) {
      if (y > pageH - 80) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 42, 94);
      doc.text('Photos du chantier', margin, y);
      y += 5;
      const imgW = (pageW - margin * 2 - 4) / 2;
      const imgH = imgW * 0.72;
      let col = 0;
      for (const ph of photos) {
        if (y + imgH > pageH - 20) {
          doc.addPage();
          y = margin;
          col = 0;
        }
        const x = margin + col * (imgW + 4);
        try {
          doc.addImage(ph.dataUrl, 'JPEG', x, y, imgW, imgH, undefined, 'FAST');
        } catch (e) {
          console.warn('img add failed', e);
        }
        col++;
        if (col >= 2) {
          col = 0;
          y += imgH + 4;
        }
      }
      if (col !== 0) y += imgH + 4;
    }

    // Signatures
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 42, 94);
    doc.text('Signatures', margin, y);
    y += 5;

    const sigBoxW = (pageW - margin * 2 - 6) / 2;
    const sigBoxH = 32;

    const drawSigBox = (x: number, label: string, name: string, pad: SignaturePad | null) => {
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(x, y, sigBoxW, sigBoxH, 2, 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(33, 33, 33);
      doc.text(label, x + 2, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (name) doc.text(`Nom : ${name}`, x + 2, y + 10);
      doc.text(`Date : ${new Date(reportDate).toLocaleDateString('fr-FR')}`, x + 2, y + 14);
      if (pad && !pad.isEmpty()) {
        try {
          const sigData = pad.toDataURL('image/png');
          doc.addImage(sigData, 'PNG', x + 2, y + 16, sigBoxW - 4, sigBoxH - 18);
        } catch (e) {
          console.warn('sig add failed', e);
        }
      }
    };

    drawSigBox(margin, 'Chef de chantier', chefName, chefPadRef.current);
    drawSigBox(margin + sigBoxW + 6, 'Client', clientName, clientPadRef.current);
    y += sigBoxH + 6;

    // Stamp (optional, top-right of last page)
    if (profile?.stamp_url) {
      try {
        const resp = await fetch(profile.stamp_url);
        const blob = await resp.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(r.error);
          r.readAsDataURL(blob);
        });
        doc.addImage(dataUrl, 'PNG', pageW - margin - 30, y, 30, 30, undefined, 'FAST');
      } catch (e) {
        console.warn('stamp load failed', e);
      }
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `${profile?.company_name || ''} — Rapport de chantier ${reportNumber}`,
        margin,
        pageH - 6
      );
      doc.text(`Page ${i} / ${totalPages}`, pageW - margin, pageH - 6, { align: 'right' });
    }

    const blob = doc.output('blob');
    const base64Full = doc.output('datauristring');
    const base64 = base64Full.split(',')[1] || '';
    const fileName = `Rapport_${reportNumber || 'chantier'}.pdf`;
    return { blob, base64, fileName };
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const result = await generatePdf();
      if (!result) return;
      // Trigger download
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Archive
      await archivePdf({
        blob: result.blob,
        type: 'rapport_chantier' as any,
        numero: reportNumber,
        fileName: result.fileName,
        status: 'final',
      });

      setLastPdfBase64(result.base64);
      setLastFileName(result.fileName);
      toast({ title: 'تم تحميل التقرير', description: reportNumber });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'خطأ', description: e?.message || 'PDF error', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!clientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      toast({ title: 'بريد إلكتروني غير صحيح', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      let pdfBase64 = lastPdfBase64;
      let fileName = lastFileName;
      if (!pdfBase64 || !fileName) {
        const result = await generatePdf();
        if (!result) {
          setSending(false);
          return;
        }
        pdfBase64 = result.base64;
        fileName = result.fileName;
        await archivePdf({
          blob: result.blob,
          type: 'rapport_chantier' as any,
          numero: reportNumber,
          fileName,
          status: 'final',
        });
        setLastPdfBase64(pdfBase64);
        setLastFileName(fileName);
      }

      const { data, error } = await supabase.functions.invoke('send-chantier-report', {
        body: {
          to: clientEmail.trim(),
          subject: `Rapport de chantier ${reportNumber} — ${chantierName}`,
          message: `Vous trouverez ci-joint le rapport du chantier "${chantierName}" du ${new Date(
            reportDate
          ).toLocaleDateString('fr-FR')}.`,
          pdfBase64,
          fileName,
          companyName: profile?.company_name || 'AnafyPro',
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'تم الإرسال', description: clientEmail });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'فشل الإرسال', description: e?.message || 'Email error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const clearSig = (which: 'chef' | 'client') => {
    if (which === 'chef') chefPadRef.current?.clear();
    else clientPadRef.current?.clear();
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen pb-32"
      style={{ backgroundColor: COLORS.pageBg, fontFamily: "'Tajawal', system-ui, sans-serif" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${COLORS.navyDark}, ${COLORS.navy})` }}
      >
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          aria-label="Retour"
        >
          <BackIcon size={20} color="#fff" />
        </button>
        <ClipboardList size={24} style={{ color: COLORS.gold }} />
        <h1 className="text-white text-lg font-bold flex-1">تقرير الشانتي</h1>
        <span className="text-xs px-2 py-1 rounded" style={{ background: COLORS.gold, color: '#0F2A5E', fontWeight: 700 }}>
          {reportNumber || '—'}
        </span>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* En-tête (info société, lecture seule) */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold mb-2" style={{ color: COLORS.navyDark }}>معلومات الشركة</h2>
          <div className="text-sm text-gray-700 space-y-1">
            <div><strong>{profile?.company_name || '—'}</strong></div>
            {profile?.siret && <div>SIRET : {profile.siret}</div>}
            {profile?.company_address && <div>{profile.company_address}</div>}
          </div>
        </section>

        {/* Chantier info */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>معلومات الشانتي</h2>
          {clientsList.length === 0 ? (
            <div>
              <Label className="text-sm">اختر العميل *</Label>
              <button
                type="button"
                onClick={() => navigate('/clients')}
                className="block w-full text-right text-sm mt-2 px-3 py-2 rounded border border-dashed"
                style={{ borderColor: COLORS.gold, color: COLORS.navyDark }}
              >
                أضف عميلاً أولاً ←
              </button>
            </div>
          ) : (
            <div>
              <Label className="text-sm">اختر العميل *</Label>
              <Select
                value={selectedClientId}
                onValueChange={(v) => {
                  setSelectedClientId(v);
                  setSelectedChantierId('');
                  setChantierName('');
                  setChantierAddress('');
                }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-sm">اختر الشانتي *</Label>
            <Select
              value={selectedChantierId}
              onValueChange={(v) => {
                setSelectedChantierId(v);
                const ch = chantiersList.find((x) => x.id === v);
                if (ch) {
                  setChantierName(ch.name);
                  setChantierAddress(ch.site_address || '');
                } else {
                  setChantierName('');
                  setChantierAddress('');
                }
              }}
              disabled={!selectedClientId}
            >
              <SelectTrigger disabled={!selectedClientId}>
                <SelectValue placeholder={!selectedClientId ? 'اختر العميل أولاً' : (chantiersList.length === 0 ? 'لا توجد شانتيات لهذا العميل' : '—')} />
              </SelectTrigger>
              <SelectContent>
                {chantiersList.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">عنوان الشانتي</Label>
            <Input value={chantierAddress} readOnly className="bg-gray-50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">رقم التقرير</Label>
              <Input
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="..."
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-sm">التاريخ</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} dir="ltr" />
            </div>
          </div>
        </section>

        {/* Corps */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>تفاصيل اليوم</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">عدد العمال</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={workerCount}
                onChange={(e) => setWorkerCount(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-sm">ساعات العمل</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">أسماء العمال (اختياري)</Label>
            <Textarea
              rows={2}
              value={workerNames}
              onChange={(e) => setWorkerNames(e.target.value)}
              placeholder="..."
            />
          </div>
          <div>
            <Label className="text-sm">الطقس</Label>
            <Select value={weather} onValueChange={(v: Weather) => setWeather(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEATHER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.ar} — {o.fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">الأعمال المنجزة *</Label>
            <Textarea rows={3} value={workDone} onChange={(e) => setWorkDone(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">المواد المستعملة</Label>
            <Textarea rows={2} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">ملاحظات / مشاكل</Label>
            <Textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>الصور</h2>
          <label
            className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 cursor-pointer"
            style={{ borderColor: COLORS.gold, color: COLORS.navyDark }}
          >
            <Camera size={20} />
            <span className="text-sm font-medium">إضافة صور</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
                  <img src={p.dataUrl} alt={p.name} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(p.id)}
                    className="absolute top-1 right-1 p-1 rounded bg-red-600/90 text-white"
                    aria-label="supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Signatures */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>التوقيعات</h2>

          <div className="space-y-2">
            <Label className="text-sm">رئيس الورشة</Label>
            <Input
              placeholder="الاسم الكامل"
              value={chefName}
              onChange={(e) => setChefName(e.target.value)}
            />
            <div className="rounded-lg border border-gray-300 bg-white" dir="ltr">
              <canvas
                ref={chefSigRef}
                style={{ width: '100%', height: 140, display: 'block', touchAction: 'none' }}
              />
            </div>
            <button
              onClick={() => clearSig('chef')}
              className="flex items-center gap-1 text-xs text-gray-600"
            >
              <Eraser size={14} /> مسح
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">العميل</Label>
            <Input
              placeholder="الاسم الكامل"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
            <div className="rounded-lg border border-gray-300 bg-white" dir="ltr">
              <canvas
                ref={clientSigRef}
                style={{ width: '100%', height: 140, display: 'block', touchAction: 'none' }}
              />
            </div>
            <button
              onClick={() => clearSig('client')}
              className="flex items-center gap-1 text-xs text-gray-600"
            >
              <Eraser size={14} /> مسح
            </button>
          </div>
        </section>

        {/* Email + actions */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>الإرسال للعميل</h2>
          <Input
            type="email"
            placeholder="email@client.com"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            dir="ltr"
            lang="fr"
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleDownload}
              disabled={generating}
              className="w-full text-white font-bold h-12"
              style={{ background: COLORS.navy }}
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تحميل التقرير
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending}
              className="w-full font-bold h-12"
              style={{ background: COLORS.gold, color: '#0F2A5E' }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              إرسال للعميل
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChantierReportPage;
