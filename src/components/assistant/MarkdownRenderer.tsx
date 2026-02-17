import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  // Pre-process: fix malformed markdown that AI sometimes produces
  // 1. Ensure single * at line start become proper list items (need space after *)
  // 2. Clean up stray ** that aren't proper bold (e.g. isolated ** on a line)
  const cleanedContent = content
    // Fix lines that start with "* " but lack a blank line before them
    .replace(/([^\n])\n(\* )/g, '$1\n\n$2')
    // Fix lines starting with "- " missing blank line
    .replace(/([^\n])\n(- )/g, '$1\n\n$2')
    // Fix numbered lists missing blank line
    .replace(/([^\n])\n(\d+\. )/g, '$1\n\n$2')
    // Ensure blank lines before headings
    .replace(/([^\n])\n(#{1,4}\s)/g, '$1\n\n$2')
    // Ensure blank lines after headings
    .replace(/(#{1,4}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2')
    // Convert bare "* text" at line start (no space) into proper "* text"
    .replace(/^(\*{1})([^\s*])/gm, '* $2')
    // Remove isolated ** on their own line (stray bold markers)
    .replace(/^\*{2,}\s*$/gm, '')
    // Force double newlines between consecutive paragraphs (non-empty lines)
    .replace(/([^\n])\n([^\n\s*#\-\d])/g, '$1\n\n$2');

  // Extract smart links and replace with placeholders
  const smartLinks: { type: 'cv' | 'pro' | 'solutions'; text: string }[] = [];
  const processedContent = cleanedContent.replace(
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
    em: ({ children }) => (
      <em className="italic text-foreground">{processChildren(children)}</em>
    ),
    code: ({ children }) => (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
