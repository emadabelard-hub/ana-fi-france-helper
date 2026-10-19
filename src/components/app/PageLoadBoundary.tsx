import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("Page load failed:", error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function PageLoadBoundary({ children }: { children: ReactNode }) {
  const { isRTL } = useLanguage();
  return <Boundary fallback={
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-foreground" dir={isRTL ? "rtl" : "ltr"}>
      <p className="text-base">{isRTL ? "تعذّر تحميل الصفحة. يُرجى إعادة المحاولة." : "La page n’a pas pu se charger. Réessayez."}</p>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="h-4 w-4" />
        {isRTL ? "إعادة المحاولة" : "Réessayer"}
      </Button>
    </div>
  }>{children}</Boundary>;
}