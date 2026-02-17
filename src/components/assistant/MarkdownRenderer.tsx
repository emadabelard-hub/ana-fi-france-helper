import React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  isRTL?: boolean;
  className?: string;
  onSmartLinkClick?: (linkType: 'cv' | 'pro' | 'solutions') => void;
}

/**
 * Premium markdown renderer for AI chat responses.
 * Uses react-markdown for robust rendering of bold, bullets, headings, separators, etc.
 */
const MarkdownRenderer = ({ content, isRTL = false, className, onSmartLinkClick }: MarkdownRendererProps) => {
  // Extract smart links and replace with placeholders
  const smartLinks: { type: 'cv' | 'pro' | 'solutions'; text: string }[] = [];
  const processedContent = content.replace(
    /\[(CV_LINK|PRO_LINK|SOLUTIONS_LINK)\](.*?)\[\/\1\]/gs,
    (_match, type: string, text: string) => {
      const linkType = type === 'CV_LINK' ? 'cv' : type === 'PRO_LINK' ? 'pro' : 'solutions';
      const idx = smartLinks.length;
      smartLinks.push({ type: linkType as 'cv' | 'pro' | 'solutions', text: text.trim() });
      return `__SMART_LINK_${idx}__`;
    }
  );

  // Custom components for react-markdown
  const components: Record<string, React.FC<any>> = {
    h2: ({ children }) => (
      <h2 className="text-[15px] font-black mt-5 mb-2.5 text-foreground">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-[14px] font-bold mt-4 mb-2 text-foreground/90">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-3 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className={cn("my-3 space-y-1.5", isRTL ? "pr-4 list-disc list-inside" : "pl-4 list-disc list-inside")}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn("my-3 space-y-1.5", isRTL ? "pr-4 list-decimal list-inside" : "pl-4 list-decimal list-inside")}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="mb-1.5">{children}</li>
    ),
    hr: () => (
      <hr className="border-border my-5" />
    ),
    strong: ({ children }) => (
      <strong className="font-bold">{children}</strong>
    ),
    // Handle smart link placeholders in text nodes
    text: ({ children }) => {
      if (typeof children !== 'string') return <>{children}</>;
      const text = children as string;
      const smartLinkRegex = /__SMART_LINK_(\d+)__/g;
      if (!smartLinkRegex.test(text)) return <>{text}</>;

      smartLinkRegex.lastIndex = 0;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match;
      while ((match = smartLinkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
        const linkData = smartLinks[parseInt(match[1])];
        if (linkData) {
          parts.push(
            <button
              key={`link-${match.index}`}
              onClick={() => onSmartLinkClick?.(linkData.type)}
              className="text-primary font-bold underline underline-offset-2 hover:opacity-80 transition-opacity inline"
            >
              {linkData.text}
            </button>
          );
        }
        lastIndex = smartLinkRegex.lastIndex;
      }
      if (lastIndex < text.length) parts.push(text.slice(lastIndex));
      return <>{parts}</>;
    },
  };

  return (
    <div
      className={cn(
        "text-[13.5px]",
        "leading-[1.7]",
        isRTL ? "font-cairo text-right" : "text-left",
        // Aerated spacing between all block elements
        "[&>*+*]:mt-3",
        className
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <ReactMarkdown components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
