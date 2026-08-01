import { describe, expect, it } from "vitest";

import {
  RADIO_CSP_SOURCES,
  RADIO_HOST_PATTERNS,
  isAllowedRadioUrl,
} from "@repo/config/radio-hosts";
import {
  radioStationCreateInputSchema,
  radioStationUpdateInputSchema,
} from "./radio";

// The stored-SSRF boundary. `now-playing` fetches these URLs server-side and
// reflects part of the response to an unauthenticated caller, so every negative
// case below is a live exploit if it ever flips to `true`.

describe("radio host allow-list", () => {
  it("accepts the seeded station hosts", () => {
    for (const url of [
      "https://backup.qurango.net/radio/mahmoud_khalil_alhussary",
      "https://stream.zeno.fm/ru2hqnplhk7uv",
      "https://radiosunna.radioca.st/stream",
      "https://radio.mp3islam.com/listen/refaat/radio.mp3",
      // the CDN edge *.zeno.fm 302s to — a redirect target, never seeded directly
      "https://n01.surfernetwork.com/edge",
    ]) {
      expect(isAllowedRadioUrl(url), url).toBe(true);
    }
  });

  it("rejects http: even on an allow-listed host", () => {
    expect(isAllowedRadioUrl("http://backup.qurango.net/radio/mix")).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(isAllowedRadioUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedRadioUrl("data:text/plain,hi")).toBe(false);
    expect(isAllowedRadioUrl("gopher://backup.qurango.net/")).toBe(false);
  });

  it("rejects raw IPs, link-local metadata, and loopback", () => {
    for (const url of [
      "https://169.254.169.254/latest/meta-data/iam/security-credentials/",
      "http://169.254.169.254/latest/meta-data/",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://127.0.0.1/",
      "https://localhost/",
      "https://localhost:9200/_cluster/health",
      "https://10.0.0.5/",
      "https://192.168.1.1/",
      "https://172.16.0.1/",
      "https://[::1]/",
      "https://[fd00::1]/",
    ]) {
      expect(isAllowedRadioUrl(url), url).toBe(false);
    }
  });

  it("does not let a look-alike host match a wildcard pattern", () => {
    // prefix trick: ends with "qurango.net" but NOT with ".qurango.net"
    expect(isAllowedRadioUrl("https://evil-qurango.net/x")).toBe(false);
    // suffix trick: the allow-listed name is only a label of the attacker's FQDN
    expect(isAllowedRadioUrl("https://qurango.net.attacker.tld/x")).toBe(false);
    expect(isAllowedRadioUrl("https://backup.qurango.net.attacker.tld/x")).toBe(false);
    // userinfo trick: the real host is attacker.tld
    expect(isAllowedRadioUrl("https://backup.qurango.net@attacker.tld/x")).toBe(false);
    // trailing-dot FQDN — same origin to a resolver, so fail closed
    expect(isAllowedRadioUrl("https://backup.qurango.net./x")).toBe(false);
    // `*.` requires a strict subdomain, exactly as CSP does — apex is not listed
    expect(isAllowedRadioUrl("https://qurango.net/x")).toBe(false);
    // a legitimate subdomain still passes
    expect(isAllowedRadioUrl("https://backup.qurango.net/x")).toBe(true);
  });

  it("rejects an unparseable or non-absolute URL", () => {
    expect(isAllowedRadioUrl("not a url")).toBe(false);
    expect(isAllowedRadioUrl("/radio/mix")).toBe(false);
    expect(isAllowedRadioUrl("")).toBe(false);
  });

  it("derives the CSP sources from the same patterns (no drift)", () => {
    expect(RADIO_CSP_SOURCES).toEqual(RADIO_HOST_PATTERNS.map((p) => `https://${p}`));
    // Byte-for-byte the media-src/connect-src fragment apps/web/lib/csp.ts emits.
    expect(RADIO_CSP_SOURCES.join(" ")).toBe(
      "https://*.qurango.net https://*.radioca.st https://*.zeno.fm https://*.surfernetwork.com https://*.mp3islam.com",
    );
  });
});

describe("radio station schema host restriction", () => {
  const base = {
    ar: { name: "إذاعة" },
    en: { name: "Radio" },
    country: "EG",
  };

  it("accepts a create input on an allow-listed https host", () => {
    const parsed = radioStationCreateInputSchema.safeParse({
      ...base,
      streamUrl: "https://backup.qurango.net/radio/mix",
      nowPlayingUrl: "https://backup.qurango.net/status-json.xsl",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a create input whose streamUrl points at cloud metadata", () => {
    const parsed = radioStationCreateInputSchema.safeParse({
      ...base,
      streamUrl: "http://169.254.169.254/latest/meta-data/",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an off-list nowPlayingUrl on create and on update", () => {
    expect(
      radioStationCreateInputSchema.safeParse({
        ...base,
        streamUrl: "https://backup.qurango.net/radio/mix",
        nowPlayingUrl: "https://attacker.tld/np.json",
      }).success,
    ).toBe(false);
    expect(
      radioStationUpdateInputSchema.safeParse({
        nowPlayingUrl: "https://qurango.net.attacker.tld/np.json",
      }).success,
    ).toBe(false);
  });

  it("still allows clearing nowPlayingUrl with null on update", () => {
    expect(radioStationUpdateInputSchema.safeParse({ nowPlayingUrl: null }).success).toBe(true);
  });
});
