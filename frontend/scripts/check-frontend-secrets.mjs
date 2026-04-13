const forbiddenPublicNames = [
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_BACKEND_API_KEY",
  "NEXT_PUBLIC_API_SECRET",
  "NEXT_PUBLIC_SECRET_KEY",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_GEMINI_API_KEY",
  "NEXT_PUBLIC_CLAUDE_API_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_DB_URL"
];

const forbiddenValueHints = ["service_role", "sk_live_", "xoxb-"];

function fail(message) {
  console.error(`\n[secret-check] ${message}\n`);
  process.exit(1);
}

for (const name of forbiddenPublicNames) {
  if (process.env[name]) {
    fail(`Forbidden public env detected: ${name}. Move it to a server-only variable.`);
  }
}

for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith("NEXT_PUBLIC_") || typeof value !== "string") {
    continue;
  }

  const lowered = value.toLowerCase();
  if (forbiddenValueHints.some((hint) => lowered.includes(hint))) {
    fail(
      `Potential secret in public env ${name}. Remove sensitive tokens from NEXT_PUBLIC_* variables.`
    );
  }
}

console.log("[secret-check] OK: no forbidden NEXT_PUBLIC secret patterns found.");
