const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'hr', 'i', 'li', 'ol', 'p',
  'pre', 's', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u',
  'ul',
]);

const REMOVE_WITH_CONTENTS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button',
  'textarea', 'select', 'option', 'link', 'meta', 'svg', 'math', 'template',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'href', 'target', 'rel', 'colspan', 'rowspan', 'style',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'background-color', 'border', 'border-collapse', 'border-left', 'border-top',
  'color', 'font-style', 'font-weight', 'margin', 'margin-bottom', 'margin-left',
  'margin-right', 'margin-top', 'min-width', 'padding', 'padding-left',
  'text-align', 'text-decoration', 'width',
]);

const UNSAFE_STYLE_PATTERN = /(expression|javascript:|vbscript:|data:|url\s*\(|@import)/i;

export const isSafeRichTextUrl = (value: string) => {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const sanitizeStyle = (style: string) => {
  return style
    .split(';')
    .map(rule => rule.trim())
    .filter(Boolean)
    .map(rule => {
      const separatorIndex = rule.indexOf(':');
      if (separatorIndex === -1) return '';
      const property = rule.slice(0, separatorIndex).trim().toLowerCase();
      const value = rule.slice(separatorIndex + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(property) || UNSAFE_STYLE_PATTERN.test(value)) return '';
      return `${property}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
};

const sanitizeElement = (element: Element) => {
  const tagName = element.tagName.toLowerCase();

  if (REMOVE_WITH_CONTENTS.has(tagName)) {
    element.remove();
    return;
  }

  Array.from(element.children).forEach(sanitizeElement);

  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  Array.from(element.attributes).forEach(attribute => {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith('on') || !ALLOWED_ATTRIBUTES.has(name)) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (name === 'href' && (!value || !isSafeRichTextUrl(value))) {
      element.removeAttribute(attribute.name);
      return;
    }

    if (name === 'style') {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) {
        element.setAttribute('style', safeStyle);
      } else {
        element.removeAttribute('style');
      }
    }
  });

  if (tagName === 'a') {
    element.setAttribute('target', '_blank');
    element.setAttribute('rel', 'noopener noreferrer');
  }
};

export const sanitizeRichHtml = (html: string | null | undefined) => {
  if (!html) return '';
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(html)
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html), 'text/html');
  Array.from(doc.body.children).forEach(sanitizeElement);
  return doc.body.innerHTML;
};

export const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
