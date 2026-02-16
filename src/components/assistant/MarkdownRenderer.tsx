import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  isRTL?: boolean;
  className?: string;
  onSmartLinkClick?: (linkType: 'cv' | 'pro' | 'solutions') => void;
}

/**
 * Lightweight markdown renderer for AI chat responses.
 * Supports: ## headings, ### subheadings, **bold**, * bullets, --- separators, numbered lists, smart links.
 */
const MarkdownRenderer = ({ content, isRTL = false, className, onSmartLinkClick }: MarkdownRendererProps) => {
  // First, extract smart links and replace with placeholders
  const smartLinks: { type: 'cv' | 'pro' | 'solutions'; text: string }[] = [];
  let processedContent = content.replace(
    /\[(CV_LINK|PRO_LINK|SOLUTIONS_LINK)\](.*?)\[\/\1\]/gs,
    (_match, type: string, text: string) => {
      const linkType = type === 'CV_LINK' ? 'cv' : type === 'PRO_LINK' ? 'pro' : 'solutions';
      const idx = smartLinks.length;
      smartLinks.push({ type: linkType as 'cv' | 'pro' | 'solutions', text: text.trim() });
      return `__SMART_LINK_${idx}__`;
    }
  );

  const lines = processedContent.split('\n');

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Handle smart link placeholders and bold
    const combinedRegex = /__SMART_LINK_(\d+)__|\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      if (match[1] !== undefined) {
        // Smart link
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
      } else if (match[2]) {
        // Bold
        parts.push(
          <strong key={match.index} className="font-bold">
            {match[2]}
          </strong>
        );
      }
      lastIndex = combinedRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [text];
  };

  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → spacer
    if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Horizontal rule: --- or ***
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(
        <hr key={i} className="border-border my-3" />
      );
      i++;
      continue;
    }

    // ## Heading
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-[15px] font-bold mt-3 mb-1.5 text-foreground">
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // ### Subheading
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-[14px] font-bold mt-2 mb-1 text-foreground/90">
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Bullet: * item or - item
    if (/^[*\-]\s+/.test(trimmed)) {
      const bulletItems: React.ReactNode[] = [];
      while (i < lines.length) {
        const bLine = lines[i].trim();
        if (/^[*\-]\s+/.test(bLine)) {
          bulletItems.push(
            <li key={i} className="mb-1.5">
              {renderInline(bLine.replace(/^[*\-]\s+/, ''))}
            </li>
          );
          i++;
        } else if (bLine === '') {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(
        <ul key={`ul-${i}`} className={cn("my-2 space-y-0.5", isRTL ? "pr-4 list-disc list-inside" : "pl-4 list-disc list-inside")}>
          {bulletItems}
        </ul>
      );
      continue;
    }

    // Numbered list: 1. item
    if (/^\d+[\.\)]\s+/.test(trimmed)) {
      const numItems: React.ReactNode[] = [];
      while (i < lines.length) {
        const nLine = lines[i].trim();
        if (/^\d+[\.\)]\s+/.test(nLine)) {
          numItems.push(
            <li key={i} className="mb-1.5">
              {renderInline(nLine.replace(/^\d+[\.\)]\s+/, ''))}
            </li>
          );
          i++;
        } else if (nLine === '') {
          i++;
          break;
        } else {
          break;
        }
      }
      elements.push(
        <ol key={`ol-${i}`} className={cn("my-2 space-y-0.5", isRTL ? "pr-4 list-decimal list-inside" : "pl-4 list-decimal list-inside")}>
          {numItems}
        </ol>
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="mb-2 last:mb-0">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return (
    <div
      className={cn(
        "text-[13.5px] leading-relaxed",
        isRTL ? "font-cairo text-right" : "text-left",
        className
      )}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {elements}
    </div>
  );
};

export default MarkdownRenderer;
