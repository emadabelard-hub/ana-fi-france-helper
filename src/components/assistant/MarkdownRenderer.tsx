import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  isRTL?: boolean;
  className?: string;
}

/**
 * Lightweight markdown renderer for AI chat responses.
 * Supports: ## headings, ### subheadings, **bold**, * bullets, --- separators, numbered lists.
 */
const MarkdownRenderer = ({ content, isRTL = false, className }: MarkdownRendererProps) => {
  const lines = content.split('\n');

  const renderInline = (text: string): React.ReactNode[] => {
    // Bold: **text**
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold">
          {match[1]}
        </strong>
      );
      lastIndex = regex.lastIndex;
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
