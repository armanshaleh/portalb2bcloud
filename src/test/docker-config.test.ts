import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync("Dockerfile", "utf8");
const dockerignore = readFileSync(".dockerignore", "utf8").split(/\r?\n/);
const example = readFileSync("env.example", "utf8");

describe("Docker deployment configuration", () => {
  it("accepts only public configuration as build arguments", () => {
    const args = [...dockerfile.matchAll(/^ARG (\w+)/gm)].map((match) => match[1]);
    expect(args).toEqual([
      "VITE_SUPABASE_URL",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_PROJECT_ID",
    ]);
  });

  it("excludes local environment credentials from the build context", () => {
    expect(dockerignore).toContain(".env");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("**/.env.*");
  });

  it("keeps runtime credentials empty in the example", () => {
    const values = Object.fromEntries(
      example.split(/\r?\n/).filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => line.split(/=(.*)/s).slice(0, 2)),
    );
    for (const name of ["SUPABASE_SERVICE_ROLE_KEY", "LOVABLE_CRON_SECRET", "UPTIME_KUMA_WEBHOOK_SECRET"]) {
      expect(values[name]).toBe("");
    }
  });

  it("selects Node output and runs without root privileges", () => {
    expect(dockerfile).toContain("NITRO_PRESET=node-server");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain('CMD ["node", ".output/server/index.mjs"]');
    expect(dockerfile).toContain("/app/.output ./.output");
  });
});