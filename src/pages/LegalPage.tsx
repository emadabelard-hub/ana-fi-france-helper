import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const LegalPage = () => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const defaultTab = location.hash === '#terms' ? 'terms' : 'privacy';

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className={cn("text-lg font-bold", isRTL && "font-[IBMPlexSansArabic]")}>
          {isRTL ? 'الشروط والخصوصية' : 'Mentions légales'}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full grid grid-cols-2 mb-6">
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="h-4 w-4" />
              {isRTL ? 'الخصوصية' : 'Confidentialité'}
            </TabsTrigger>
            <TabsTrigger value="terms" className="gap-2">
              <FileText className="h-4 w-4" />
              {isRTL ? 'شروط الاستخدام' : "Conditions d'utilisation"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="privacy">
            <PrivacyContent isRTL={isRTL} />
          </TabsContent>
          <TabsContent value="terms">
            <TermsContent isRTL={isRTL} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const Section = ({ title, children, isRTL }: { title: string; children: React.ReactNode; isRTL: boolean }) => (
  <div className="mb-6">
    <h2 className={cn(
      "text-base font-bold text-foreground mb-2",
      isRTL && "text-right font-[IBMPlexSansArabic]"
    )}>
      {title}
    </h2>
    <div className={cn(
      "text-sm text-muted-foreground leading-relaxed space-y-2",
      isRTL && "text-right font-[IBMPlexSansArabic]"
    )} dir={isRTL ? 'rtl' : 'ltr'}>
      {children}
    </div>
  </div>
);

const PrivacyContent = ({ isRTL }: { isRTL: boolean }) => {
  if (isRTL) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-right font-[IBMPlexSansArabic]" dir="rtl">
          آخر تحديث: فبراير 2026
        </p>
        <Section title="1. البيانات اللي بنجمعها" isRTL={isRTL}>
          <p>بنجمع بس البيانات اللي حضرتك بتدخلها بنفسك:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li>الإيميل وكلمة المرور (لو فتحت حساب)</li>
            <li>الاسم والعنوان ورقم التليفون (اختياري)</li>
            <li>بيانات الشركة (SIRET، العنوان، اللوجو)</li>
            <li>الفواتير والمستندات اللي بتعملها</li>
          </ul>
        </Section>
        <Section title="2. إزاي بنستخدم البيانات" isRTL={isRTL}>
          <p>بنستخدم بياناتك بس عشان:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li>نشغلك الخدمات (فواتير، مساعد ذكي، CV)</li>
            <li>نحفظلك المسودات والإعدادات</li>
            <li>نحسن التطبيق ونصلح المشاكل</li>
          </ul>
          <p className="font-semibold text-foreground">مش بنبيع بياناتك لأي حد. أبدًا.</p>
        </Section>
        <Section title="3. حماية البيانات" isRTL={isRTL}>
          <p>كل بياناتك محمية بـ:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li>تشفير SSL في كل الاتصالات</li>
            <li>عزل كامل لبيانات كل مستخدم (RLS)</li>
            <li>تخزين آمن على سيرفرات أوروبية</li>
          </ul>
        </Section>
        <Section title="4. حقوقك (RGPD)" isRTL={isRTL}>
          <p>عندك الحق في:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li>تشوف كل بياناتك</li>
            <li>تعدل أو تصحح بياناتك</li>
            <li>تمسح حسابك وكل بياناتك نهائيًا</li>
            <li>تطلب نسخة من بياناتك</li>
          </ul>
          <p>ممكن تمسح حسابك من صفحة "حسابي" في أي وقت.</p>
        </Section>
        <Section title="5. الكوكيز" isRTL={isRTL}>
          <p>بنستخدم بس كوكيز ضرورية عشان الجلسة تشتغل. مفيش كوكيز تتبع أو إعلانات.</p>
        </Section>
        <Section title="6. تواصل معانا" isRTL={isRTL}>
          <p>لو عندك أي سؤال عن الخصوصية، ابعتلنا من خلال زرار "اقتراحات" في الصفحة الرئيسية.</p>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Dernière mise à jour : Mai 2026</p>
      <Section title="1. Responsable du traitement" isRTL={isRTL}>
        <p>Anafy Pro est responsable du traitement des données personnelles collectées via l'application.</p>
        <p>Contact : via la page « Support » de l'application ou le bouton « Suggestions » sur la page d'accueil.</p>
      </Section>
      <Section title="2. Données collectées et finalités" isRTL={isRTL}>
        <p>Nous collectons uniquement les données que vous saisissez, pour les finalités suivantes :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Email et mot de passe → création et sécurisation de votre compte</li>
          <li>Nom, adresse, téléphone (optionnel) → personnalisation des documents</li>
          <li>Informations d'entreprise (SIRET, adresse, logo) → édition de devis/factures conformes</li>
          <li>Factures, devis et notes de frais → archivage comptable et envoi à votre comptable</li>
          <li>Logs techniques (page visitée, durée) → amélioration et sécurité du service</li>
        </ul>
        <p className="font-semibold text-foreground">Nous ne vendons jamais vos données. Jamais.</p>
      </Section>
      <Section title="3. Base légale" isRTL={isRTL}>
        <p>Le traitement repose sur l'exécution du contrat de service (création de compte) et votre consentement explicite pour les données optionnelles.</p>
      </Section>
      <Section title="4. Durée de conservation" isRTL={isRTL}>
        <ul className="list-disc ml-6 space-y-1">
          <li>Données de compte : conservées tant que votre compte est actif</li>
          <li>Documents comptables (devis, factures) : 10 ans (obligation légale française)</li>
          <li>Logs d'activité : 12 mois maximum, purge automatique mensuelle</li>
          <li>Après suppression du compte : effacement définitif sous 30 jours</li>
        </ul>
      </Section>
      <Section title="5. Protection des données" isRTL={isRTL}>
        <p>Vos données sont protégées par :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Chiffrement SSL/TLS sur toutes les communications</li>
          <li>Isolation complète des données par utilisateur (Row Level Security)</li>
          <li>Accès limité aux administrateurs identifiés</li>
        </ul>
      </Section>
      <Section title="6. Vos droits (RGPD)" isRTL={isRTL}>
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li><strong>Accès</strong> : consulter toutes vos données depuis la page « Compte »</li>
          <li><strong>Rectification</strong> : modifier vos informations à tout moment</li>
          <li><strong>Effacement</strong> : supprimer votre compte et toutes vos données depuis la page « Compte »</li>
          <li><strong>Portabilité</strong> : exporter vos données au format JSON via le bouton « Exporter mes données »</li>
          <li><strong>Opposition et limitation</strong> : nous contacter via le support</li>
          <li><strong>Réclamation</strong> : auprès de la CNIL (www.cnil.fr)</li>
        </ul>
      </Section>
      <Section title="7. Cookies" isRTL={isRTL}>
        <p>Nous utilisons uniquement des cookies essentiels (session d'authentification, préférences de langue). Aucun cookie de suivi publicitaire ou analytique tiers.</p>
      </Section>
      <Section title="8. Hébergement" isRTL={isRTL}>
        <p>Les données sont hébergées au sein de l'Union Européenne par notre prestataire technique (Supabase / Lovable Cloud), conforme au RGPD.</p>
      </Section>
      <Section title="9. Contact" isRTL={isRTL}>
        <p>Pour toute question relative à la confidentialité ou pour exercer vos droits, contactez-nous via la page « Support » de l'application.</p>
      </Section>
    </div>
  );
};

const TermsContent = ({ isRTL }: { isRTL: boolean }) => {
  if (isRTL) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-right font-[IBMPlexSansArabic]" dir="rtl">
          آخر تحديث: فبراير 2026
        </p>
        <Section title="1. قبول الشروط" isRTL={isRTL}>
          <p>باستخدامك لتطبيق Anafy Pro، حضرتك بتوافق على الشروط دي. لو مش موافق، متستخدمش التطبيق.</p>
        </Section>
        <Section title="2. وصف الخدمة" isRTL={isRTL}>
          <p>Anafy Pro بيقدم أدوات رقمية للمقيمين في فرنسا:</p>
          <ul className="list-disc mr-6 space-y-1">
            <li>مساعد ذكي للاستشارات الإدارية</li>
            <li>إنشاء فواتير وعروض أسعار (Devis & Factures)</li>
            <li>إنشاء سيرة ذاتية (CV)</li>
            <li>دروس لغة فرنسية</li>
          </ul>
        </Section>
        <Section title="3. الحسابات" isRTL={isRTL}>
          <ul className="list-disc mr-6 space-y-1">
            <li>ممكن تستخدم التطبيق كضيف أو بحساب</li>
            <li>حضرتك مسؤول عن حماية بيانات حسابك</li>
            <li>ممكن نوقف أي حساب بيخالف الشروط</li>
          </ul>
        </Section>
        <Section title="4. المحتوى والمسؤولية" isRTL={isRTL}>
          <ul className="list-disc mr-6 space-y-1">
            <li>المعلومات القانونية من المساعد الذكي للإرشاد فقط ومش بديل عن محامي</li>
            <li>الفواتير والمستندات مسؤوليتك أنت تتأكد من صحتها</li>
            <li>مش مسؤولين عن أي خسارة ناتجة عن استخدام التطبيق</li>
          </ul>
        </Section>
        <Section title="5. الأسعار والمدفوعات" isRTL={isRTL}>
          <ul className="list-disc mr-6 space-y-1">
            <li>بعض الخدمات ليها رسوم محددة (موضحة قبل الشراء)</li>
            <li>المدفوعات في الوضع التجريبي مش حقيقية</li>
            <li>مفيش استرداد بعد استخدام الخدمة</li>
          </ul>
        </Section>
        <Section title="6. الملكية الفكرية" isRTL={isRTL}>
          <p>كل حقوق التطبيق والتصميم والكود محفوظة لـ Anafy Pro. المستندات اللي بتعملها ملكك أنت.</p>
        </Section>
        <Section title="7. تعديل الشروط" isRTL={isRTL}>
          <p>ممكن نعدل الشروط دي في أي وقت. استمرارك في استخدام التطبيق بيعني موافقتك على التعديلات.</p>
        </Section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Dernière mise à jour : Février 2026</p>
      <Section title="1. Acceptation des conditions" isRTL={isRTL}>
        <p>En utilisant Anafy Pro, vous acceptez ces conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser l'application.</p>
      </Section>
      <Section title="2. Description du service" isRTL={isRTL}>
        <p>Anafy Pro propose des outils numériques pour les résidents en France :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Assistant IA pour les consultations administratives</li>
          <li>Création de factures et devis</li>
          <li>Génération de CV professionnels</li>
          <li>Cours de langue française</li>
        </ul>
      </Section>
      <Section title="3. Comptes utilisateurs" isRTL={isRTL}>
        <ul className="list-disc ml-6 space-y-1">
          <li>Vous pouvez utiliser l'application en mode invité ou avec un compte</li>
          <li>Vous êtes responsable de la sécurité de votre compte</li>
          <li>Nous pouvons suspendre tout compte en infraction</li>
        </ul>
      </Section>
      <Section title="4. Contenu et responsabilité" isRTL={isRTL}>
        <ul className="list-disc ml-6 space-y-1">
          <li>Les informations juridiques de l'assistant IA sont à titre indicatif et ne remplacent pas un avocat</li>
          <li>Vous êtes responsable de vérifier l'exactitude de vos factures et documents</li>
          <li>Nous ne sommes pas responsables des pertes liées à l'utilisation de l'application</li>
        </ul>
      </Section>
      <Section title="5. Tarification et paiements" isRTL={isRTL}>
        <ul className="list-disc ml-6 space-y-1">
          <li>Certains services ont des frais affichés avant l'achat</li>
          <li>Les paiements en mode démo ne sont pas réels</li>
          <li>Aucun remboursement après utilisation du service</li>
        </ul>
      </Section>
      <Section title="6. Propriété intellectuelle" isRTL={isRTL}>
        <p>Tous les droits sur l'application, le design et le code sont réservés à Anafy Pro. Les documents que vous créez vous appartiennent.</p>
      </Section>
      <Section title="7. Modification des conditions" isRTL={isRTL}>
        <p>Nous pouvons modifier ces conditions à tout moment. Votre utilisation continue de l'application vaut acceptation des modifications.</p>
      </Section>
    </div>
  );
};

export default LegalPage;
