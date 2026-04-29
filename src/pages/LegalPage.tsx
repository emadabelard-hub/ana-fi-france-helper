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
      <p className="text-sm text-muted-foreground">Dernière mise à jour : Février 2026</p>
      <Section title="1. Données collectées" isRTL={isRTL}>
        <p>Nous collectons uniquement les données que vous saisissez :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Email et mot de passe (si vous créez un compte)</li>
          <li>Nom, adresse et téléphone (optionnel)</li>
          <li>Informations d'entreprise (SIRET, adresse, logo)</li>
          <li>Factures et documents que vous créez</li>
        </ul>
      </Section>
      <Section title="2. Utilisation des données" isRTL={isRTL}>
        <p>Vos données sont utilisées uniquement pour :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Fournir les services (factures, assistant IA, CV)</li>
          <li>Sauvegarder vos brouillons et paramètres</li>
          <li>Améliorer l'application et corriger les bugs</li>
        </ul>
        <p className="font-semibold text-foreground">Nous ne vendons jamais vos données. Jamais.</p>
      </Section>
      <Section title="3. Protection des données" isRTL={isRTL}>
        <p>Vos données sont protégées par :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Chiffrement SSL sur toutes les communications</li>
          <li>Isolation complète des données par utilisateur (RLS)</li>
          <li>Hébergement sécurisé sur des serveurs européens</li>
        </ul>
      </Section>
      <Section title="4. Vos droits (RGPD)" isRTL={isRTL}>
        <p>Vous avez le droit de :</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Accéder à toutes vos données</li>
          <li>Modifier ou rectifier vos informations</li>
          <li>Supprimer votre compte et toutes vos données définitivement</li>
          <li>Demander une copie de vos données</li>
        </ul>
        <p>Vous pouvez supprimer votre compte depuis la page "Compte" à tout moment.</p>
      </Section>
      <Section title="5. Cookies" isRTL={isRTL}>
        <p>Nous utilisons uniquement des cookies essentiels pour le fonctionnement de la session. Aucun cookie de suivi ou publicitaire.</p>
      </Section>
      <Section title="6. Contact" isRTL={isRTL}>
        <p>Pour toute question relative à la confidentialité, contactez-nous via le bouton "Suggestions" sur la page d'accueil.</p>
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
          <p>كل حقوق التطبيق والتصميم والكود محفوظة لـ Ana Fi France. المستندات اللي بتعملها ملكك أنت.</p>
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
        <p>En utilisant Ana Fi France, vous acceptez ces conditions. Si vous n'êtes pas d'accord, veuillez ne pas utiliser l'application.</p>
      </Section>
      <Section title="2. Description du service" isRTL={isRTL}>
        <p>Ana Fi France propose des outils numériques pour les résidents en France :</p>
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
        <p>Tous les droits sur l'application, le design et le code sont réservés à Ana Fi France. Les documents que vous créez vous appartiennent.</p>
      </Section>
      <Section title="7. Modification des conditions" isRTL={isRTL}>
        <p>Nous pouvons modifier ces conditions à tout moment. Votre utilisation continue de l'application vaut acceptation des modifications.</p>
      </Section>
    </div>
  );
};

export default LegalPage;
