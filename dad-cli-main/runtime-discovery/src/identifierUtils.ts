/**
 * Normalizes element identifiers by removing state-dependent text 
 * that causes infinite loops during exploration.
 */
export function normalizeIdentifier(tag: string, label: string): string {
    if (!label) return `${tag}_unknown`;

    let normalized = label;

    // 1. Remove "currently ... mode" (common in theme toggles like Playwright/Docusaurus)
    normalized = normalized.replace(/\(currently [^)]+\)/gi, "");
    normalized = normalized.replace(/currently [a-z]+ mode/gi, "");

    // 2. Remove "selected" or "(selected)"
    normalized = normalized.replace(/\(selected\)/gi, "");
    normalized = normalized.replace(/\bselected\b/gi, "");

    // 3. Remove numeric counts (e.g., "Cart (0)", "Notifications 5")
    normalized = normalized.replace(/\(\d+\)/g, ""); // Match (3)
    normalized = normalized.replace(/\s\d+$/g, "");   // Match " 5" at end

    // 4. Cleanup special characters and spaces
    normalized = normalized
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, ""); // Trim leading/trailing underscores

    // 5. Final ID construction
    const finalTag = tag === "a" ? "link" : tag.toLowerCase();

    return `${finalTag}_${normalized || "element"}`;
}
