export interface InputContext {
  actionId: string;
  elementType?: string;
  placeholder?: string;
  label?: string;
  name?: string;
}

const EMAIL_PATTERNS = ["test@example.com", "user@domain.org", "admin@site.net"];
const NAME_PATTERNS = ["John Doe", "Jane Smith", "Test User"];
const PHONE_PATTERNS = ["555-0123", "123-456-7890", "+1-555-0199"];
const PASSWORD_PATTERNS = ["TestPass123!", "SecureP@ss1", "Demo123$"];

export function generateIntelligentInput(context: InputContext): string {
  const { actionId, elementType, placeholder, label, name } = context;
  
  const combined = `${actionId} ${elementType} ${placeholder} ${label} ${name}`.toLowerCase();
  
  if (combined.includes("email") || combined.includes("mail")) {
    return EMAIL_PATTERNS[Math.floor(Math.random() * EMAIL_PATTERNS.length)];
  }
  
  if (combined.includes("password") || combined.includes("pass")) {
    return PASSWORD_PATTERNS[Math.floor(Math.random() * PASSWORD_PATTERNS.length)];
  }
  
  if (combined.includes("phone") || combined.includes("tel")) {
    return PHONE_PATTERNS[Math.floor(Math.random() * PHONE_PATTERNS.length)];
  }
  
  if (combined.includes("name") || combined.includes("user")) {
    return NAME_PATTERNS[Math.floor(Math.random() * NAME_PATTERNS.length)];
  }
  
  if (combined.includes("search") || combined.includes("query")) {
    return "test search query";
  }
  
  if (combined.includes("number") || combined.includes("age") || combined.includes("count")) {
    return String(Math.floor(Math.random() * 100) + 1);
  }
  
  // Default intelligent fallback
  return placeholder || "test input";
}