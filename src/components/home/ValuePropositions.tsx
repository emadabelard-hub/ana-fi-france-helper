import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const valueProps = [
  {
    icon: '🔒',
    title: 'أمان وخصوصية 100%',
    text: 'ورقك هو حياتك. محدش بيشوفه غيرك. التحليل بيتم بالذكاء الاصطناعي ومفيش أي إنسان بيطلع عليه.',
  },
  {
    icon: '👑',
    title: 'خليك برنس نفسك',
    text: 'مش محتاج تطلب مساعدة من حد ولا تقول "لو سمحت". افهم ورقك بنفسك وخلص مصلحتك بدراعك.',
  },
  {
    icon: '🌙',
    title: 'محدش هيحكم عليك',
    text: 'اسأل أي سؤال مهما كان بسيط، في أي وقت (حتى 3 الفجر). مفيش كسوف، وإحنا موجودين 24 ساعة.',
  },
  {
    icon: '🇪🇬',
    title: 'بنتكلم لغتك',
    text: 'مش بس ترجمة جوجل. إحنا بنشرحلك المطلوب منك بالمصري وببساطة، عشان تفهم وتنجز.',
  },
];

const ValuePropositions = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % valueProps.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + valueProps.length) % valueProps.length);
  };

  const currentProp = valueProps[currentIndex];

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground text-right font-cairo">
        ليه تستخدم التطبيق ده؟
      </h2>

      <div className="relative">
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20 overflow-hidden">
          <CardContent className="p-6 text-right font-cairo">
            <div className="flex flex-col items-center gap-4">
              {/* Icon */}
              <div className="text-5xl animate-pulse">
                {currentProp.icon}
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-foreground">
                {currentProp.title}
              </h3>

              {/* Text */}
              <p className="text-muted-foreground text-center leading-relaxed">
                {currentProp.text}
              </p>

              {/* Dots indicator */}
              <div className="flex gap-2 mt-2">
                {valueProps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      idx === currentIndex
                        ? "bg-primary w-6"
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    )}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-sm"
          onClick={prevSlide}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-background/80 hover:bg-background shadow-sm"
          onClick={nextSlide}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
};

export default ValuePropositions;
