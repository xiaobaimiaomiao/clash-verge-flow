export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    if (!hostname || /^[\d.]+$/.test(hostname) || hostname === "localhost") {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

export function extractBaseDomain(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;

  const ccTLDs = new Set(["co", "com", "org", "net", "ac", "gov", "edu"]);
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];

  if (parts.length >= 3 && ccTLDs.has(sld) && tld.length <= 3) {
    return parts.slice(-3).join(".");
  }

  return parts.slice(-2).join(".");
}
