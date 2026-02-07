import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, Scale, Car, Landmark, 
  ChevronRight, FileUser, MessageSquare,
  Home, Settings, User, Sparkles
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const Index = () => {
  const { language, setLanguage, isRTL } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={cn(
      "min-h-screen bg-[#0f172a] text-white select-none overflow-x-hidden",
      isRTL && "font-cairo"
    )}>
      
      {/* HEADER */}
      <header className="bg-[#1e293b] p-4 pt-14 flex justify-between items-center shadow-lg border-b border-white/5 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#facc15] rounded-xl flex items-center justify-center text-[#111827] font-black text-lg border-2 border-[#111827] italic">
            AF
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-white uppercase italic leading-none">Ana Fi France</h1>
            <div className="h-1 w-full bg-[#facc15] rounded-full mt-1 opacity-50"></div>
          </div>
        </div>
        
        {/* Language Toggle */}
        <div className="flex bg-[#0f172a] p-1.5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setLanguage('fr')} 
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'fr' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            FR
          </button>
          <button 
            onClick={() => setLanguage('ar')} 
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-black transition-all",
              language === 'ar' ? 'bg-[#3b82f6] text-white' : 'text-slate-500'
            )}
          >
            عربي
          </button>
        </div>
      </header>

      <main className="p-5 space-y-6 pb-32">
        
        {/* AI BANNER */}
        <button 
          onClick={() => navigate('/assistant')}
          className="w-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden active:scale-95 transition-transform border border-white/10 text-left"
        >
          <div className="relative z-10 space-y-2">
            <div className="flex gap-2 text-2xl">
              <span>🇫🇷</span>
              <span>🇪🇬</span>
            </div>
            <h2 className="text-2xl font-black text-white font-cairo">
              اسأل وأنا أجاوبك
            </h2>
            <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={12} className="animate-pulse" /> Intelligence IA
            </p>
          </div>
          <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
        </button>

        {/* TOOLS GRID */}
        <div className="grid grid-cols-2 gap-4">
          
          {/* CV Button */}
          <button 
            onClick={() => navigate('/pro/cv-generator')}
            className="bg-[#eef2ff] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform border-b-4 border-indigo-200 group"
          >
            <div className="p-3 bg-[#4f46e5] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <FileUser size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#1e1b4b] text-[14px] font-cairo leading-tight">
                سيرتي الذكية<br/>(سي في)
              </h3>
              <p className="text-[10px] font-bold text-[#6366f1] mt-1 uppercase opacity-60 tracking-tighter">
                Mon CV Pro
              </p>
            </div>
          </button>

          {/* Invoices Button */}
          <button 
            onClick={() => navigate('/pro/invoice-creator')}
            className="bg-[#fff7ed] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform border-b-4 border-orange-200 group"
          >
            <div className="p-3 bg-[#f97316] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <FileText size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#431407] text-[15px] font-cairo leading-tight">
                فواتير ودوفي
              </h3>
              <p className="text-[10px] font-bold text-[#ea580c] mt-1 uppercase opacity-60 tracking-tighter">
                Factures
              </p>
            </div>
          </button>

          {/* Bank Button */}
          <button 
            onClick={() => navigate('/coming-soon')}
            className="bg-[#fefce8] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform border-b-4 border-yellow-200 group"
          >
            <div className="p-3 bg-[#eab308] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <Landmark size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#422006] text-[15px] font-cairo leading-tight text-center">
                وفّر فلوسك
              </h3>
              <p className="text-[10px] font-bold text-[#ca8a04] mt-1 uppercase opacity-60 tracking-tighter">
                Banque Pro
              </p>
            </div>
          </button>

          {/* Rights Button */}
          <button 
            onClick={() => navigate('/assistant')}
            className="bg-[#f0fdf4] p-5 rounded-[2.2rem] shadow-lg flex flex-col items-center text-center gap-3 active:scale-95 transition-transform border-b-4 border-emerald-200 group"
          >
            <div className="p-3 bg-[#059669] rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform">
              <Scale size={28} />
            </div>
            <div>
              <h3 className="font-black text-[#064e3b] text-[13px] font-cairo leading-tight">
                شغل وضرائب وصحة
              </h3>
              <p className="text-[10px] font-bold text-[#059669] mt-1 uppercase opacity-60 tracking-tighter">
                Droits
              </p>
            </div>
          </button>
        </div>

        {/* CODE DE LA ROUTE */}
        <button 
          onClick={() => navigate('/coming-soon')}
          className="w-full bg-gradient-to-r from-[#db2777] to-[#9333ea] p-5 rounded-[2.5rem] shadow-xl flex items-center justify-between text-white active:scale-95 transition-transform border border-white/10"
        >
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
            <Car size={26} />
          </div>
          <div className="text-right flex-1 pr-4">
            <h3 className="font-black text-xl font-cairo leading-none mb-1">
              كود دو لاروت
            </h3>
            <p className="text-[10px] font-bold text-pink-100 font-cairo opacity-80">
              دروس وامتحانات بالمصري
            </p>
          </div>
          <div className="bg-white/20 p-2 rounded-full">
            <ChevronRight size={16} />
          </div>
        </button>

      </main>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-2xl border-t border-white/5 p-4 pb-12 flex justify-around items-center z-[110] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <button 
          onClick={() => navigate('/')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-all",
            isActive('/') ? "text-[#facc15]" : "text-slate-500"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full bg-[#facc15] mb-0.5 transition-all",
            isActive('/') ? "scale-100" : "scale-0"
          )} />
          <Home size={24} strokeWidth={isActive('/') ? 3 : 2} />
          <span className="text-[10px] font-black uppercase">
            {isRTL ? 'الرئيسية' : 'Accueil'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/assistant')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-all",
            isActive('/assistant') ? "text-purple-400" : "text-slate-500"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full bg-purple-400 mb-0.5 transition-all",
            isActive('/assistant') ? "scale-100" : "scale-0"
          )} />
          <MessageSquare size={24} />
          <span className="text-[10px] font-black uppercase tracking-tighter">
            {isRTL ? 'استشارات' : 'Conseils'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/pro')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-all",
            location.pathname.startsWith('/pro') ? "text-orange-400" : "text-slate-500"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full bg-orange-400 mb-0.5 transition-all",
            location.pathname.startsWith('/pro') ? "scale-100" : "scale-0"
          )} />
          <Settings size={24} />
          <span className="text-[10px] font-black uppercase">
            {isRTL ? 'أدوات' : 'Outils'}
          </span>
        </button>
        
        <button 
          onClick={() => navigate('/profile')}
          className={cn(
            "flex flex-col items-center gap-1.5 transition-all",
            isActive('/profile') ? "text-[#facc15]" : "text-slate-500"
          )}
        >
          <div className={cn(
            "w-1.5 h-1.5 rounded-full bg-[#facc15] mb-0.5 transition-all",
            isActive('/profile') ? "scale-100" : "scale-0"
          )} />
          <User size={24} />
          <span className="text-[10px] font-black uppercase">
            {isRTL ? 'حسابي' : 'Profil'}
          </span>
        </button>
      </nav>
    </div>
  );
};

export default Index;
