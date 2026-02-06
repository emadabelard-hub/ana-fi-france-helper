import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className={cn("flex min-h-[70vh] items-center justify-center", isRTL && "font-cairo")}>
      <div className={cn("text-center space-y-3", isRTL && "text-right")}>
        <h1 className="text-4xl font-bold text-foreground">404</h1>
        <p className="text-muted-foreground">
          {isRTL ? 'الصفحة دي مش موجودة' : 'Cette page est introuvable.'}
        </p>
        <div className={cn("flex justify-center", isRTL && "justify-end")}>
          <Button variant="default" onClick={() => navigate('/')}> 
            {isRTL ? 'الرجوع للرئيسية' : 'Retour à l\'accueil'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

