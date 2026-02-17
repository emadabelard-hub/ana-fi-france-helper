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

  // Helper to process smart link placeholders in any text
  const renderSmartLinks = (text: string): React.ReactNode => {
    const smartLinkRegex = /__SMART_LINK_(\d+)__/g;
    if (!smartLinkRegex.test(text)) return text;
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
  };

  // Recursively process children to find and replace smart link placeholders
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === 'string') return renderSmartLinks(child);
      return child;
    });
  };

  // Custom components for react-markdown
  const components: Record<string, React.FC<any>> = {
    h2: ({ children }) => (
      <h2 className="text-xl font-extrabold mt-8 mb-4 text-foreground">{processChildren(children)}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-extrabold mt-8 mb-4 text-foreground">{processChildren(children)}</h3>
    ),
    p: ({ children }) => (
      <p className="mb-6 leading-relaxed text-foreground last:mb-0">{processChildren(children)}</p>
    ),
    ul: ({ children }) => (
      <ul className={cn("list-disc mb-6 space-y-4", isRTL ? "pr-6" : "ml-6")}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn("list-decimal mb-6 space-y-4", isRTL ? "pr-6" : "ml-6")}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={cn("leading-relaxed text-foreground", isRTL ? "pr-2" : "pl-2")}>{processChildren(children)}</li>
    ),
    hr: () => (
      <hr className="border-border my-8" />
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">{processChildren(children)}</strong>
    ),
  };

  return (
    <div
      className={cn(
        "text-[15px]",
        "leading-[1.9]",
        isRTL ? "font-cairo text-right" : "text-left",
        "[&>*+*]:mt-5",
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
