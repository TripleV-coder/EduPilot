import DOMPurify from "isomorphic-dompurify";

/**
 * Configuration options for HTML sanitization
 */
interface SanitizeOptions {
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
  allowLinks?: boolean;
  allowImages?: boolean;
  strict?: boolean;
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHTML(
  dirty: string,
  options: SanitizeOptions = {}
): string {
  const {
    allowedTags,
    allowedAttributes,
    allowLinks = false,
    allowImages = false,
    strict = false,
  } = options;

  // Strict mode: strip all HTML tags
  if (strict) {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });
  }

  // Default safe tags for rich text
  const defaultAllowedTags = [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
  ];

  // Add links if allowed
  if (allowLinks) {
    defaultAllowedTags.push("a");
  }

  // Add images if allowed
  if (allowImages) {
    defaultAllowedTags.push("img");
  }

  const config: any = {
    ALLOWED_TAGS: allowedTags || defaultAllowedTags,
    ALLOWED_ATTR: allowedAttributes || {
      a: ["href", "title", "target"],
      img: ["src", "alt", "title"],
      code: ["class"],
    },
    // Remove scripts, iframes, etc.
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    // Keep safe URLs only
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  };

  const result = DOMPurify.sanitize(dirty, config);
  return typeof result === 'string' ? result : String(result);
}

/**
 * Sanitize user input for plain text fields
 * Removes all HTML and special characters that could be dangerous
 */
export function sanitizePlainText(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }).trim();
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace unsafe chars
    .replace(/_{2,}/g, "_") // Remove multiple underscores
    .replace(/^[._-]+|[._-]+$/g, "") // Remove leading/trailing special chars
    .substring(0, 255); // Limit length
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sanitize phone numbers (keep only digits and +)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

/**
 * Sanitize URLs
 */
export function sanitizeURL(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize JSON input
 */
export function sanitizeJSON(input: any): any {
  if (typeof input === "string") {
    return sanitizePlainText(input);
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeJSON);
  }

  if (typeof input === "object" && input !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeJSON(value);
    }
    return sanitized;
  }

  return input;
}

/**
 * Escape SQL identifiers (table names, column names)
 * For use with raw queries only - prefer using Prisma's query builder
 */
export function escapeSQLIdentifier(identifier: string): string {
  // Remove anything that's not alphanumeric or underscore
  return identifier.replace(/[^a-zA-Z0-9_]/g, "");
}

/**
 * Sanitize rich text content (for lesson content, homework descriptions, etc.)
 */
export function sanitizeRichText(content: string): string {
  return sanitizeHTML(content, {
    allowLinks: true,
    allowImages: true,
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "img",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
      table: ["border", "cellpadding", "cellspacing"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
  });
}

/**
 * Middleware function to sanitize request body
 */
export function sanitizeRequestBody(body: any): any {
  if (!body) return body;

  const sanitized: any = {};

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      // Detect if it might be rich text (contains HTML tags)
      if (/<[^>]+>/g.test(value)) {
        // Rich text fields that should allow HTML
        const richTextFields = [
          "content",
          "description",
          "notes",
          "message",
          "html",
          "body",
        ];
        if (richTextFields.some((field) => key.toLowerCase().includes(field))) {
          sanitized[key] = sanitizeRichText(value);
        } else {
          // Strip HTML from other fields
          sanitized[key] = sanitizePlainText(value);
        }
      } else {
        // Plain text - just trim
        sanitized[key] = value.trim();
      }
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "object" ? sanitizeRequestBody(item) : item
      );
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

const sanitizer = {
  sanitizeHTML,
  sanitizePlainText,
  sanitizeFileName,
  sanitizeEmail,
  sanitizePhone,
  sanitizeURL,
  sanitizeJSON,
  escapeSQLIdentifier,
  sanitizeRichText,
  sanitizeRequestBody,
};

export default sanitizer;
