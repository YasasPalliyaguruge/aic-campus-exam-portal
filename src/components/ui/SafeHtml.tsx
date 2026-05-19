import React, { useMemo } from 'react';
import { sanitizeRichHtml } from '../../utils/htmlSanitizer';

interface SafeHtmlProps {
  html: string | null | undefined;
  className?: string;
  as?: 'div' | 'span';
}

export const SafeHtml = ({ html, className, as: Tag = 'div' }: SafeHtmlProps) => {
  const safeHtml = useMemo(() => sanitizeRichHtml(html), [html]);
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
};
