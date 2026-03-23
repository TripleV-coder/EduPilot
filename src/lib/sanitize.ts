/**
 * Input sanitization utilities
 *
 * Strategy:
 *  - sanitizePlainText: strip ALL HTML tags (server-safe, no DOM needed)
 *  - sanitizeRichText: whitelist-based approach — only allow safe tags,
 *    strip everything else including event handlers and dangerous attributes.
 *  - sanitizeRequestBody: recursively sanitize all string values in an object.
 */

/** Safe tags whitelist for rich text sanitization */
const ALLOWED_TAGS = new Set([
  "p", "br", "b", "i", "u", "strong", "em", "s", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "code", "pre",
  "a", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
]);

/** Safe attributes whitelist (per tag) */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  span: new Set(["class"]),
  div: new Set(["class"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

/**
 * Sanitize plain text: strip ALL HTML tags and trim.
 * Safe for server-side use — no DOM dependency.
 */
export function sanitizePlainText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Sanitize rich text: whitelist-based HTML sanitization.
 *
 * - Removes ALL tags not in the whitelist
 * - Removes ALL attributes not in the per-tag whitelist
 * - Removes ALL event handler attributes (on*)
 * - Removes javascript: and data: URLs from href attributes
 * - Strips <script>, <style>, <iframe>, <object>, <embed>, <form> entirely (content included)
 */
export function sanitizeRichText(input: string): string {
  // Step 1: Remove dangerous tags and their content entirely
  let result = input
    .replace(/<script\b[^]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^]*?<\/style\s*>/gi, "")
    .replace(/<iframe\b[^]*?<\/iframe\s*>/gi, "")
    .replace(/<object\b[^]*?<\/object\s*>/gi, "")
    .replace(/<embed\b[^]*?<\/embed\s*>/gi, "")
    .replace(/<form\b[^]*?<\/form\s*>/gi, "")
    .replace(/<link\b[^>]*\/?>/gi, "")
    .replace(/<meta\b[^>]*\/?>/gi, "")
    .replace(/<base\b[^>]*\/?>/gi, "");

  // Step 2: Process remaining tags — keep whitelisted, strip others
  result = result.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    const isClosing = match.startsWith("</");

    // Not in whitelist → strip the tag (keep inner content)
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    // Closing tag — return as-is
    if (isClosing) {
      return `</${tag}>`;
    }

    // Opening/self-closing tag — filter attributes
    const allowedAttrs = ALLOWED_ATTRS[tag];
    if (!attrs || !attrs.trim()) {
      return `<${tag}>`;
    }

    // Parse and filter attributes
    const safeAttrs: string[] = [];
    const attrRegex = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

      // Block ALL event handlers
      if (attrName.startsWith("on")) continue;

      // Block style attribute (can contain expressions)
      if (attrName === "style") continue;

      // Only allow whitelisted attributes for this tag
      if (!allowedAttrs || !allowedAttrs.has(attrName)) continue;

      // Block dangerous URLs in href
      if (attrName === "href") {
        const normalizedValue = attrValue.trim().toLowerCase().replace(/\s+/g, "");
        if (
          normalizedValue.startsWith("javascript:") ||
          normalizedValue.startsWith("data:") ||
          normalizedValue.startsWith("vbscript:")
        ) {
          continue;
        }
      }

      safeAttrs.push(`${attrName}="${attrValue.replace(/"/g, "&quot;")}"`);
    }

    // Force rel="noopener noreferrer" on links with target
    if (tag === "a" && safeAttrs.some(a => a.startsWith("target="))) {
      if (!safeAttrs.some(a => a.startsWith("rel="))) {
        safeAttrs.push('rel="noopener noreferrer"');
      }
    }

    const attrString = safeAttrs.length > 0 ? " " + safeAttrs.join(" ") : "";
    return `<${tag}${attrString}>`;
  });

  return result.trim();
}

/**
 * Sanitize a request body (deep clean all string values)
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(body: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePlainText(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizePlainText(item)
          : typeof item === "object" && item !== null
            ? sanitizeRequestBody(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeRequestBody(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
