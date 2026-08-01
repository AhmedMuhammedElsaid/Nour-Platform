import sanitizeHtml from "sanitize-html";

/*
 * Real, parser-based HTML sanitizer for tafsir prose (seeded from quran.com).
 * Used at the service boundary (quran.service.ts getTafsir) so every consumer
 * of the tafsir payload — the web /api/v1 route, and the mobile app hitting
 * that same endpoint with NO CSP at all — gets sanitized HTML, not just the
 * web page that happens to sit behind a CSP. See docs/adr/0016-html-sanitizer.md.
 *
 * Allowlist only: tags/attributes not listed here are stripped (contents of
 * block-ish tags are kept as text where sanitize-html's default disallowed-tag
 * behavior applies; script/style/iframe/etc. content is dropped entirely by
 * sanitize-html's own handling of non-text tags).
 */
// ⚠️ h1/h2/div are NOT optional. The seeded Ibn Kathir edition uses them
// heavily (a 2000-row sample holds h2 ×1415, div ×3410); omitting them does
// not just lose styling — `discard` mode concatenates their text with no
// separator, so every section heading runs into the body as one unbroken
// string. They carry no attributes after `allowedAttributes: {}`, so they are
// inert. Check a real `en` row before trimming this list; the `ar` edition uses
// only span/br and will not show the damage.
const ALLOWED_TAGS = [
  "p",
  "br",
  "span",
  "div",
  "h1",
  "h2",
  "b",
  "i",
  "em",
  "strong",
  "sup",
  "sub",
  "ul",
  "ol",
  "li",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
];

// Tags whose ENTIRE content (not just the tag) must go — text nodes inside
// them are never legitimate tafsir prose, and for script/style/iframe/object
// the "content" can itself be an attack payload we don't want echoed as text.
const NON_TEXT_TAGS = ["script", "style", "textarea", "option", "iframe", "form", "object", "embed", "svg"];

export function sanitizeTafsirHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {}, // no attributes on any tag — no href/src/style/on*/etc.
    allowedSchemes: [],
    disallowedTagsMode: "discard", // drop disallowed tags, keep their inner text (except NON_TEXT_TAGS)
    nonTextTags: NON_TEXT_TAGS,
    enforceHtmlBoundary: true,
    parser: { decodeEntities: true },
  });
}
