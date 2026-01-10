import { URL } from "url";

const BLOCKED_HOSTS = [
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal" // GCP metadata
];

const BLOCKED_PORTS = [22, 23, 25, 53, 135, 139, 445, 993, 995];

export function validateUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("Only HTTP/HTTPS protocols allowed");
    }
    
    if (BLOCKED_HOSTS.includes(url.hostname)) {
      throw new Error("Access to internal hosts not allowed");
    }
    
    const port = parseInt(url.port) || (url.protocol === "https:" ? 443 : 80);
    if (BLOCKED_PORTS.includes(port)) {
      throw new Error("Access to restricted ports not allowed");
    }
    
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}