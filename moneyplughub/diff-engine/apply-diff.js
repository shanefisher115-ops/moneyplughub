import { execSync } from "child_process";

export function applyDiff(diffFile, targetEnv = "dev", projectRef = null) {
  console.log(`?? Applying migration to environment: [${targetEnv.toUpperCase()}]...`);
  try {
    if (targetEnv === "dev" || targetEnv === "local") {
      execSync("npx supabase db push", { stdio: "inherit" });
    } else {
      const ref = projectRef || process.env[`SUPABASE_${targetEnv.toUpperCase()}_PROJECT_REF`];
      if (!ref) {
        throw new Error(`Project reference not found for environment: ${targetEnv}`);
      }
      execSync(`npx supabase db push --project-ref ${ref}`, { stdio: "inherit" });
    }
    console.log(`? Migration successfully applied to ${targetEnv}`);
    return true;
  } catch (error) {
    console.error(`? Failed to apply migration to ${targetEnv}:`, error.message);
    throw error;
  }
}
