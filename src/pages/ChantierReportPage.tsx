import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useTeamRole } from '@/hooks/useTeamRole';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, ClipboardList, Camera, Download, Trash2, Loader2, Eraser, MapPin, X } from 'lucide-react';
import { Image as ImageIcon } from 'lucide-react';
import SignaturePad from 'signature_pad';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { archivePdf } from '@/lib/documentArchive';

const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s || '');

const renderTextToImage = async (
  text: string,
  widthMm: number,
  opts?: { bold?: boolean; color?: string; bg?: string; align?: 'right' | 'left'; direction?: 'rtl' | 'ltr' }
): Promise<{ dataUrl: string; heightMm: number } | null> => {
  if (!text || !text.trim()) return null;
  const pxPerMm = 96 / 25.4;
  const widthPx = Math.max(50, Math.round(widthMm * pxPerMm));
  const div = document.createElement('div');
  div.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    `width:${widthPx}px`,
    `direction:${opts?.direction || 'rtl'}`,
    `text-align:${opts?.align || 'right'}`,
    "font-family:'IBM Plex Sans Arabic','Tajawal','Noto Naskh Arabic',Arial,sans-serif",
    'font-size:14px',
    'line-height:1.55',
    `color:${opts?.color || '#212121'}`,
    `font-weight:${opts?.bold ? '700' : '400'}`,
    `background:${opts?.bg || '#ffffff'}`,
    'white-space:pre-wrap',
    'word-wrap:break-word',
    'padding:2px 0',
  ].join(';');
  div.textContent = text;
  document.body.appendChild(div);
  try {
    if (document.fonts && typeof (document.fonts as any).ready?.then === 'function') {
      try { await (document.fonts as any).ready; } catch {}
    }
    const canvas = await html2canvas(div, {
      scale: 2,
      backgroundColor: opts?.bg || '#ffffff',
      logging: false,
      useCORS: true,
    });
    const dataUrl = canvas.toDataURL('image/png');
    const heightMm = (canvas.height / canvas.width) * widthMm;
    return { dataUrl, heightMm };
  } finally {
    document.body.removeChild(div);
  }
};

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
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isRTL } = useLanguage();
  const { assignments, isTeamMemberOnly } = useTeamRole();
  const queryChantierId = searchParams.get('chantierId');
  const teamAssignment = useMemo(
    () => assignments.find((a) => a.chantier_id === queryChantierId) || assignments[0] || null,
    [assignments, queryChantierId],
  );
  // Mode verrouillé/pré-rempli : dès qu'un chantierId est fourni dans l'URL
  // (lien d'invitation) OU que l'utilisateur est strictement chef d'équipe.
  const isTeamMode = !!queryChantierId || (isTeamMemberOnly && !!teamAssignment);
  const lockedChantierId = queryChantierId || teamAssignment?.chantier_id || null;

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

  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number; address: string | null } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [chefName, setChefName] = useState('');
  const [clientName, setClientName] = useState('');
  const [patronProfile, setPatronProfile] = useState<{
    company_name: string | null;
    siret: string | null;
    company_address: string | null;
    logo_url: string | null;
  } | null>(null);

  const chefSigRef = useRef<HTMLCanvasElement>(null);
  const clientSigRef = useRef<HTMLCanvasElement>(null);
  const chefPadRef = useRef<SignaturePad | null>(null);
  const clientPadRef = useRef<SignaturePad | null>(null);

  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [lastPdfBase64, setLastPdfBase64] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  // Auto-generate report number on mount if empty
  useEffect(() => {
    if (!reportNumber) {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const num = `RC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      setReportNumber(num);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load clients from Supabase (patron mode only)
  useEffect(() => {
    if (!user) return;
    if (isTeamMode) return;
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
  }, [user, isTeamMode]);

  // Mode verrouillé : pré-remplir depuis le chantier ciblé (URL ou assignment)
  // Utilise une RPC SECURITY DEFINER pour récupérer également le client et
  // le profil du patron, auxquels le chef d'équipe n'a pas accès via RLS.
  useEffect(() => {
    if (!user || !isTeamMode || !lockedChantierId) return;
    (async () => {
      const { data, error } = await supabase
        .rpc('get_team_chantier_context', { _chantier_id: lockedChantierId })
        .maybeSingle();
      if (error || !data) {
        console.warn('[ChantierReport] context load failed', error);
        return;
      }
      setChantiersList([{ id: data.chantier_id, name: data.chantier_name, site_address: data.site_address }] as any);
      setSelectedChantierId(data.chantier_id);
      setChantierName(data.chantier_name || '');
      setChantierAddress(data.site_address || data.client_address || '');
      setSelectedClientId(data.client_id || '');
      if (data.client_name) setClientName(data.client_name);
      setPatronProfile({
        company_name: data.patron_company_name,
        siret: data.patron_siret,
        company_address: data.patron_company_address,
        logo_url: data.patron_logo_url,
      });
    })();
  }, [user, isTeamMode, lockedChantierId]);

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

  const captureLocation = async () => {
    setGpsError(null);
    if (!('geolocation' in navigator)) {
      setGpsError(tr('الموقع غير مدعوم', 'Géolocalisation non supportée'));
      return;
    }
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let address: string | null = null;
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data && typeof data.display_name === 'string' && data.display_name.trim()) {
            address = data.display_name.trim();
          }
        }
      } catch (e) {
        console.warn('[ChantierReport] reverse geocode failed', e);
      }
      setGpsPosition({ lat, lng, address });
    } catch (e: any) {
      console.warn('[ChantierReport] geolocation error', e);
      setGpsError(tr('الموقع غير مسموح', 'Localisation non autorisée'));
    } finally {
      setGpsLoading(false);
    }
  };

  const removeLocation = () => {
    setGpsPosition(null);
    setGpsError(null);
  };

  const formatGpsForDisplay = (g: { lat: number; lng: number; address: string | null }): string =>
    g.address || `${g.lat.toFixed(6)}, ${g.lng.toFixed(6)}`;


  const weatherLabelFR = (w: Weather) =>
    WEATHER_OPTIONS.find((x) => x.value === w)?.fr || w;

  const validate = (): string | null => {
    if (!isTeamMode && !selectedClientId) return 'اختر العميل أولاً';
    if (!selectedChantierId) return 'اختر الشانتي أولاً';
    if (!isTeamMode && !chantierAddress.trim()) return 'عنوان الشانتي مطلوب';
    if (!workDone.trim()) return 'الأعمال المنجزة مطلوبة';
    return null;
  };

  const generatePdf = async (
    overrides?: { workDone?: string; materials?: string; observations?: string },
    generatedAt: Date = new Date(),
  ): Promise<{ blob: Blob; base64: string; fileName: string; generatedAt: Date } | null> => {
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

    // En mode chef d'équipe, l'en-tête doit refléter l'entreprise du PATRON,
    // pas celle du chef d'équipe connecté.
    const headerProfile = isTeamMode && patronProfile
      ? patronProfile
      : {
          company_name: profile?.company_name ?? null,
          siret: profile?.siret ?? null,
          company_address: profile?.company_address ?? null,
          logo_url: profile?.logo_url ?? null,
        };

    // Logo (optional)
    if (headerProfile.logo_url) {
      try {
        const resp = await fetch(headerProfile.logo_url);
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
    doc.text(headerProfile.company_name || 'Entreprise', margin + 24, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (headerProfile.siret) doc.text(`SIRET : ${headerProfile.siret}`, margin + 24, 20);
    if (headerProfile.company_address) doc.text(headerProfile.company_address, margin + 24, 25);

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

    // Chantier identification block (Arabic-safe)
    const resolvedClientName =
      (clientName && clientName.trim()) ||
      (clientsList.find((c) => c.id === selectedClientId)?.name ?? '');
    const chantierBlockText =
      (resolvedClientName ? `Client : ${resolvedClientName}\n` : '') +
      `Nom du chantier : ${chantierName}\n` +
      `Adresse : ${chantierAddress}`;
    const chantierImg = await renderTextToImage(chantierBlockText, pageW - margin * 2 - 6, {
      align: 'left',
      direction: 'ltr',
    });
    const blockH = Math.max(22, (chantierImg?.heightMm || 0) + 10);
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(margin, y, pageW - margin * 2, blockH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 42, 94);
    doc.text('CHANTIER', margin + 3, y + 5);
    if (chantierImg) {
      doc.addImage(
        chantierImg.dataUrl,
        'PNG',
        margin + 3,
        y + 7,
        pageW - margin * 2 - 6,
        chantierImg.heightMm
      );
    }
    y += blockH + 6;

    const writeSection = async (title: string, content: string) => {
      if (!content.trim()) return;
      // Title (French, safe with helvetica)
      if (y + 12 > pageH - 30) {
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 42, 94);
      doc.text(title, margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(33, 33, 33);

      if (hasArabic(content)) {
        const img = await renderTextToImage(content, pageW - margin * 2, { align: 'right' });
        if (img) {
          if (y + img.heightMm > pageH - 30) {
            doc.addPage();
            y = margin;
          }
          doc.addImage(img.dataUrl, 'PNG', margin, y, pageW - margin * 2, img.heightMm);
          y += img.heightMm + 4;
        }
      } else {
        const lines = doc.splitTextToSize(content, pageW - margin * 2);
        if (y + lines.length * 5 > pageH - 30) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines, margin, y);
        y += lines.length * 5 + 4;
      }
    };

    // Two-column layout: left = Personnel + Météo, right = Travaux + Matériaux + Observations
    const colGap = 6;
    const colW = (pageW - margin * 2 - colGap) / 2;
    const leftX = margin;
    const rightX = margin + colW + colGap;
    const colStartY = y;

    const writeSectionAt = async (
      title: string,
      content: string,
      x: number,
      width: number,
      startY: number,
    ): Promise<number> => {
      if (!content.trim()) return startY;
      let cy = startY;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 42, 94);
      doc.text(title, x, cy);
      cy += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(33, 33, 33);
      if (hasArabic(content)) {
        const img = await renderTextToImage(content, width, { align: 'right' });
        if (img) {
          doc.addImage(img.dataUrl, 'PNG', x, cy, width, img.heightMm);
          cy += img.heightMm + 4;
        }
      } else {
        const lines = doc.splitTextToSize(content, width);
        doc.text(lines, x, cy);
        cy += lines.length * 5 + 4;
      }
      return cy;
    };

    const workerNamesOneLine = workerNames
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');

    let leftY = colStartY;
    leftY = await writeSectionAt(
      'Personnel présent',
      `${workerCount ? `Nombre d'ouvriers : ${workerCount}` : ''}${
        workerNamesOneLine ? `\nNoms : ${workerNamesOneLine}` : ''
      }${hoursWorked ? `\nHeures travaillées : ${hoursWorked}` : ''}`.trim(),
      leftX,
      colW,
      leftY,
    );
    leftY = await writeSectionAt('Météo', weatherLabelFR(weather), leftX, colW, leftY);

    let rightY = colStartY;
    rightY = await writeSectionAt('Travaux réalisés', overrides?.workDone ?? workDone, rightX, colW, rightY);
    rightY = await writeSectionAt('Matériaux utilisés', overrides?.materials ?? materials, rightX, colW, rightY);
    rightY = await writeSectionAt('Observations / Problèmes', overrides?.observations ?? observations, rightX, colW, rightY);

    y = Math.max(leftY, rightY);

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

    drawSigBox(pageW - margin - sigBoxW, 'Responsable de chantier', chefName, chefPadRef.current);
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

  const translateField = async (text: string): Promise<string> => {
    const t = (text || '').trim();
    if (!t || !hasArabic(t)) return text;
    try {
      const { data, error } = await supabase.functions.invoke('btp-translate', {
        body: { text: t, sourceLang: 'ar', targetLang: 'fr' },
      });
      if (error) throw error;
      const fr = String(data?.translated || '').trim();
      return fr || text;
    } catch (e) {
      console.error('[ChantierReport] translation failed:', e);
      return text;
    }
  };

  const handleDownload = async () => {
    setTranslating(true);
    let overrides: { workDone: string; materials: string; observations: string };
    try {
      const [wd, mt, ob] = await Promise.all([
        translateField(workDone),
        translateField(materials),
        translateField(observations),
      ]);
      overrides = { workDone: wd, materials: mt, observations: ob };
    } finally {
      setTranslating(false);
    }
    setGenerating(true);
    try {
      const result = await generatePdf(overrides);
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
      const archived = await archivePdf({
        blob: result.blob,
        type: 'rapport_chantier' as any,
        numero: reportNumber,
        fileName: result.fileName,
        status: 'final',
      });

      // Save report entry in chantier_reports (with French-translated texts)
      if (user) {
        try {
          const ownerUserId = isTeamMode && teamAssignment ? teamAssignment.patron_user_id : user.id;
          const { error: insertErr } = await (supabase.from('chantier_reports' as any) as any).insert({
            user_id: ownerUserId,
            chantier_id: selectedChantierId || null,
            client_id: selectedClientId || null,
            report_number: reportNumber,
            report_date: reportDate,
            worker_count: workerCount ? parseInt(workerCount, 10) || null : null,
            worker_names: workerNames || null,
            hours_worked: hoursWorked || null,
            weather: weatherLabelFR(weather),
            work_done_fr: overrides.workDone || null,
            materials_fr: overrides.materials || null,
            observations_fr: overrides.observations || null,
            supervisor_name: chefName || null,
            pdf_url: archived?.pdf_url || null,
            submitted_by: user.id,
            submitted_by_name: isTeamMode ? (chefName || user.email || null) : null,
          });
          if (insertErr) console.warn('[chantier_reports] insert failed:', insertErr.message);
        } catch (e) {
          console.warn('[chantier_reports] save error:', e);
        }
      }

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

  const buildShareText = (): string => {
    const lines = [
      `Rapport de chantier — ${chantierName || 'Chantier'}`,
      `Date : ${new Date(reportDate).toLocaleDateString('fr-FR')}`,
      workerCount ? `Ouvriers : ${workerCount}` : '',
      hoursWorked ? `Heures : ${hoursWorked}` : '',
      workDone ? `Travaux réalisés : ${workDone}` : '',
    ].filter(Boolean);
    return lines.join('\n');
  };

  const clearSig = (which: 'chef' | 'client') => {
    if (which === 'chef') chefPadRef.current?.clear();
    else clientPadRef.current?.clear();
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const tr = (ar: string, fr: string) => (isRTL ? ar : fr);

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
        <h1 className="text-white text-lg font-bold flex-1">{tr('تقرير الشانتي', 'Rapport de chantier')}</h1>
        <span className="text-xs px-2 py-1 rounded" style={{ background: COLORS.gold, color: '#0F2A5E', fontWeight: 700 }}>
          {reportNumber || '—'}
        </span>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto">
        {/* En-tête (info société, lecture seule) */}
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-bold mb-2" style={{ color: COLORS.navyDark }}>{tr('معلومات الشركة', "Informations de l'entreprise")}</h2>
          {(() => {
            const shown = isTeamMode && patronProfile ? patronProfile : {
              company_name: profile?.company_name ?? null,
              siret: profile?.siret ?? null,
              company_address: profile?.company_address ?? null,
            };
            return (
              <div className="text-sm text-gray-700 space-y-1">
                <div><strong>{shown.company_name || '—'}</strong></div>
                {shown.siret && <div>SIRET : {shown.siret}</div>}
                {shown.company_address && <div>{shown.company_address}</div>}
              </div>
            );
          })()}
        </section>

        {/* Chantier info */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>{tr('معلومات الشانتي', 'Informations du chantier')}</h2>
          {isTeamMode ? (
            <>
              <div className="text-sm text-gray-700">
                <Label className="text-sm">{tr('العميل', 'Client')}</Label>
                <div className="px-3 py-2 mt-1 rounded bg-gray-50 border font-bold">{clientName || '—'}</div>
              </div>
              <div className="text-sm text-gray-700">
                <Label className="text-sm">{tr('الشانتي', 'Chantier')}</Label>
                <div className="px-3 py-2 mt-1 rounded bg-gray-50 border font-bold">{chantierName || '—'}</div>
              </div>
            </>
          ) : clientsList.length === 0 ? (
            <div>
              <Label className="text-sm">{tr('اختر العميل *', 'Client *')}</Label>
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
              <Label className="text-sm">{tr('اختر العميل *', 'Client *')}</Label>
              <Select
                value={selectedClientId}
                onValueChange={async (v) => {
                  setSelectedClientId(v);
                  setSelectedChantierId('');
                  setChantierName('');
                  // Fallback synchrone : utiliser le nom déjà présent dans la liste
                  const preset = clientsList.find((c) => c.id === v);
                  if (preset?.name) setClientName(preset.name);
                  // Ne pas vider l'adresse : on va la remplacer par celle du client ci-dessous
                  try {
                    const { data: clientFull, error: clientErr } = await supabase
                      .from('clients')
                      .select('*')
                      .eq('id', v)
                      .maybeSingle();
                    console.log('[ChantierReport] client complet:', clientFull, 'error:', clientErr);
                    if (clientFull) {
                      const obj = clientFull as Record<string, unknown>;
                      if (typeof obj.name === 'string' && obj.name.trim()) {
                        setClientName(obj.name.trim());
                      }
                      const priorityKeys = ['address', 'adresse', 'client_address', 'site_address'];
                      let found: string | null = null;
                      for (const k of priorityKeys) {
                        const val = obj[k];
                        if (typeof val === 'string' && val.trim()) { found = val; break; }
                      }
                      if (!found) {
                        for (const k of Object.keys(obj)) {
                          if (/address|adresse/i.test(k)) {
                            const val = obj[k];
                            if (typeof val === 'string' && val.trim()) { found = val; break; }
                          }
                        }
                      }
                      if (found) setChantierAddress(found);
                    }
                  } catch (e) {
                    console.log('[ChantierReport] erreur fetch client:', e);
                  }
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
          {!isTeamMode && (
          <div>
            <Label className="text-sm">{tr('اختر الشانتي *', 'Chantier *')}</Label>
            <Select
              value={selectedChantierId}
              onValueChange={(v) => {
                setSelectedChantierId(v);
                const ch = chantiersList.find((x) => x.id === v);
                if (ch) {
                  setChantierName(ch.name);
                  // Si le chantier a sa propre adresse, l'utiliser. Sinon, conserver
                  // l'adresse du client déjà affichée (ne pas vider le champ).
                  if (ch.site_address && ch.site_address.trim()) {
                    setChantierAddress(ch.site_address);
                  }
                } else {
                  setChantierName('');
                }
              }}
              disabled={!selectedClientId}
            >
              <SelectTrigger disabled={!selectedClientId}>
                <SelectValue placeholder={!selectedClientId ? tr('اختر العميل أولاً', "Sélectionnez d'abord un client") : (chantiersList.length === 0 ? tr('لا توجد شانتيات لهذا العميل', 'Aucun chantier pour ce client') : '—')} />
              </SelectTrigger>
              <SelectContent>
                {chantiersList.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>{ch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
          <div>
            <Label className="text-sm">{tr('عنوان الشانتي', 'Adresse du chantier')}</Label>
            <Input value={chantierAddress} readOnly className="bg-gray-50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">{tr('رقم التقرير', 'Numéro du rapport')}</Label>
              <Input
                value={reportNumber}
                onChange={(e) => setReportNumber(e.target.value)}
                placeholder="..."
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-sm">{tr('التاريخ', 'Date')}</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} dir="ltr" />
            </div>
          </div>
        </section>

        {/* Corps */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>{tr('تفاصيل اليوم', 'Détails de la journée')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">{tr('عدد العمال', "Nombre d'ouvriers")}</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={workerCount}
                onChange={(e) => setWorkerCount(e.target.value)}
                dir="ltr"
              />
            </div>
            <div>
              <Label className="text-sm">{tr('ساعات العمل', 'Heures travaillées')}</Label>
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
            <Label className="text-sm">{tr('أسماء العمال (اختياري)', 'Noms des ouvriers (optionnel)')}</Label>
            <Textarea
              rows={2}
              value={workerNames}
              onChange={(e) => setWorkerNames(e.target.value)}
              placeholder="..."
            />
          </div>
          <div>
            <Label className="text-sm">{tr('الطقس', 'Météo')}</Label>
            <Select value={weather} onValueChange={(v: Weather) => setWeather(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEATHER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {isRTL ? `${o.ar} — ${o.fr}` : o.fr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">{tr('الأعمال المنجزة *', 'Travaux réalisés *')}</Label>
            <Textarea rows={3} value={workDone} onChange={(e) => setWorkDone(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">{tr('المواد المستعملة', 'Matériaux utilisés')}</Label>
            <Textarea rows={2} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </div>
          <div>
            <Label className="text-sm">{tr('ملاحظات / مشاكل', 'Observations')}</Label>
            <Textarea rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />
          </div>
        </section>

        {/* Photos */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>{tr('الصور', 'Photos')}</h2>
          <div className="flex gap-2">
            <label
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 cursor-pointer"
              style={{ borderColor: COLORS.gold, color: COLORS.navyDark }}
            >
              <Camera size={20} />
              <span className="text-sm font-medium">{tr('تصوير', 'Prendre une photo')}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
            <label
              className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-4 cursor-pointer"
              style={{ borderColor: COLORS.gold, color: COLORS.navyDark }}
            >
              <ImageIcon size={20} />
              <span className="text-sm font-medium">{tr('من المعرض', 'Depuis la galerie')}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </label>
          </div>
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
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>{tr('التوقيعات', 'Signatures')}</h2>

          <div className="space-y-2">
            <Label className="text-sm">{tr('مسئول الشانتي', 'Responsable de chantier')}</Label>
            <Input
              placeholder={tr('الاسم الكامل', 'Nom complet')}
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
              <Eraser size={14} /> {tr('مسح', 'Effacer')}
            </button>
          </div>

        </section>

        {/* Actions */}
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold" style={{ color: COLORS.navyDark }}>{tr('الإرسال للعميل', 'Envoyer au client')}</h2>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleDownload}
              disabled={generating || translating}
              className="w-full text-white font-bold h-12"
              style={{ background: COLORS.navy }}
            >
              {(generating || translating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {translating ? tr('جاري الترجمة...', 'Traduction...') : tr('تحميل التقرير', 'Télécharger le rapport')}
            </Button>
            <Button
              onClick={() => {
                const dateStr = new Date(reportDate).toLocaleDateString('fr-FR');
                const msg = `Bonjour, veuillez trouver ci-joint le rapport de chantier du ${dateStr}. Merci de télécharger le PDF depuis Anafy Pro.`;
                window.open(`whatsapp://send?phone=&text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full font-bold h-12"
              style={{ background: '#25D366', color: '#fff' }}
            >
              📱 {tr('إرسال واتساب', 'Envoyer par WhatsApp')}
            </Button>
            <Button
              onClick={() => {
                const text = encodeURIComponent(buildShareText());
                window.open(`sms:?body=${text}`, '_blank');
              }}
              className="w-full font-bold h-12"
              style={{ background: '#007AFF', color: '#fff' }}
            >
              💬 {tr('إرسال SMS', 'Envoyer par SMS')}
            </Button>
            <p className="text-xs text-gray-500 text-center pt-1">
              💡 {tr('تحميل التقرير أولاً ثم مشاركته عبر واتساب', 'Téléchargez d\'abord le rapport puis partagez-le sur WhatsApp')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChantierReportPage;
