// Shared library for GitLab skill scripts
// Token discovery, API client, validation, flag parsing

let _cachedToken: string | null = null;

export async function getToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;

  // 1. Environment variable (highest priority)
  const envToken = process.env.GITLAB_TOKEN;
  if (envToken) {
    _cachedToken = envToken;
    return envToken;
  }

  // 2. Fallback: glab auth status -t
  try {
    const proc = Bun.spawn(["glab", "auth", "status", "-t"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;
    // Parse "Token: glpat-..." or "Token found: glpat-..."
    const match = stderr.match(/Token(?:\s+found)?:\s+(\S+)/i);
    if (match) {
      _cachedToken = match[1];
      return match[1];
    }
  } catch {
    // glab not installed or failed
  }

  exitError("No GitLab token found. Set GITLAB_TOKEN env var or run: glab auth login");
  return ""; // unreachable
}

export function getBaseUrl(): string {
  const host = process.env.GITLAB_HOST;
  if (!host) return "https://gitlab.com/api/v4";

  let url = host;
  // Add https:// if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  // Add /api/v4 if missing
  if (!url.endsWith("/api/v4")) {
    url = url.replace(/\/+$/, "") + "/api/v4";
  }
  return url;
}

export interface GlabApiOptions {
  body?: Record<string, unknown>;
  query?: Record<string, string | number>;
  rawText?: boolean;
}

export async function glabApi(
  method: string,
  path: string,
  opts?: GlabApiOptions
): Promise<any> {
  const token = await getToken();
  const base = getBaseUrl();

  let url = `${base}/${path}`;
  if (opts?.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      params.set(k, String(v));
    }
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "PRIVATE-TOKEN": token,
  };

  const fetchOpts: RequestInit = { method, headers };

  if (opts?.body) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, fetchOpts);

  // 204 No Content
  if (res.status === 204) return null;

  // Raw text mode (job logs, file content)
  if (opts?.rawText) {
    if (!res.ok) {
      throw new Error(await extractErrorMessage(res));
    }
    return await res.text();
  }

  // JSON response
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res));
  }

  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response from ${method} ${path}`);
  }
}

export async function glabApiPaginated(
  path: string,
  opts?: Omit<GlabApiOptions, "body" | "rawText">
): Promise<any[]> {
  const results: any[] = [];
  let page = 1;
  const perPage = Number(opts?.query?.per_page) || 100;
  while (true) {
    const query = { ...opts?.query, page, per_page: perPage };
    const batch = await glabApi("GET", path, { query });
    if (!Array.isArray(batch) || batch.length === 0) break;
    results.push(...batch);
    if (batch.length < perPage) break;
    page++;
  }
  return results;
}

async function extractErrorMessage(res: Response): Promise<string> {
  const status = res.status;
  const statusMessages: Record<number, string> = {
    401: "Unauthorized (401) - check your GitLab token",
    403: "Forbidden (403)",
    404: "Not found (404)",
    409: "Conflict (409)",
    422: "Unprocessable entity (422)",
  };

  let body: string;
  try {
    body = await res.text();
  } catch {
    return statusMessages[status] || `HTTP ${status} ${res.statusText}`;
  }

  // Try to parse JSON error body
  try {
    const json = JSON.parse(body);

    // {error: "msg"}
    if (typeof json.error === "string") return json.error;

    // {message: "msg"}
    if (typeof json.message === "string") return json.message;

    // {message: ["err1", "err2"]}
    if (Array.isArray(json.message)) return json.message.join(", ");

    // {message: {field: ["err1", "err2"]}}
    if (typeof json.message === "object" && json.message !== null) {
      const parts: string[] = [];
      for (const [field, errors] of Object.entries(json.message)) {
        if (Array.isArray(errors)) {
          parts.push(`${field}: ${errors.join(", ")}`);
        }
      }
      if (parts.length) return parts.join("; ");
    }

    // {error: ["msg"]}
    if (Array.isArray(json.error)) return json.error.join(", ");
  } catch {
    // Not JSON
  }

  // Known status code with custom message
  if (statusMessages[status]) return statusMessages[status];

  // Fallback
  return `HTTP ${status} ${res.statusText}`;
}

export function validateProject(str: string): string {
  if (!/^[^/]+\/[^/]+$/.test(str)) {
    exitError("Invalid project format. Use: org/project");
  }
  return encodeURIComponent(str);
}

export function validateNumericId(str: string, name: string): number {
  const n = Number(str);
  if (!Number.isInteger(n) || n <= 0) {
    exitError(`${name} must be a positive number`);
  }
  return n;
}

interface FlagSpec {
  [key: string]: { type: "string" | "boolean"; required?: boolean };
}

interface ParsedFlags {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseFlags(argv: string[], spec: FlagSpec): ParsedFlags {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      // Handled by caller before parseFlags
      flags["help"] = true;
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const s = spec[name];
      if (!s) exitError(`Unknown option: ${arg}`);

      if (s.type === "boolean") {
        flags[name] = true;
        i++;
      } else {
        if (i + 1 >= argv.length) exitError(`${arg} requires a value`);
        flags[name] = argv[i + 1];
        i += 2;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  // Check required flags
  for (const [name, s] of Object.entries(spec)) {
    if (s.required && flags[name] === undefined) {
      exitError(`--${name} is required`);
    }
  }

  return { positional, flags };
}

export function exitError(msg: string): never {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(1);
}

export function printUsage(usage: string, code: number): never {
  process.stderr.write(usage + "\n");
  process.exit(code);
}
