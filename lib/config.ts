/**
 * Server-side only configuration.
 * Values are read from environment variables — never hardcode credentials.
 * This file must only be imported inside API routes or server components.
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Add it to .env.local (copy from .env.example).`
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalEnvNumber(key: string, fallback: number): number {
  return Number(process.env[key] ?? fallback);
}

// ---------------------------------------------------------------------------
// Backwards-compatible alias (used by existing huawei.ts)
// ---------------------------------------------------------------------------
export const routerConfig = {
  huawei: {
    get ip(): string { return optionalEnv('ROUTER_HUAWEI_IP', 'http://100.10.10.1'); },
    get username(): string { return requireEnv('ROUTER_HUAWEI_USERNAME'); },
    get password(): string { return requireEnv('ROUTER_HUAWEI_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('ROUTER_HUAWEI_TIMEOUT', 8000); },
  },
} as const;

// ---------------------------------------------------------------------------
// Unified multi-device config
// ---------------------------------------------------------------------------
export const devicesConfig = {
  /** Huawei HG8245W5 main modem */
  huawei: {
    get ip(): string { return optionalEnv('ROUTER_HUAWEI_IP', 'http://100.10.10.1'); },
    get username(): string { return requireEnv('ROUTER_HUAWEI_USERNAME'); },
    get password(): string { return requireEnv('ROUTER_HUAWEI_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('ROUTER_HUAWEI_TIMEOUT', 8000); },
  },
  /** Tenda N301 router */
  tendaN301: {
    get ip(): string { return optionalEnv('TENDA_N301_IP', 'http://192.168.1.3'); },
    get username(): string { return optionalEnv('TENDA_N301_USERNAME', 'admin'); },
    get password(): string { return requireEnv('TENDA_N301_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('TENDA_N301_TIMEOUT', 8000); },
  },
  /** Tenda F3 router */
  tendaF3: {
    get ip(): string { return optionalEnv('TENDA_F3_IP', 'http://192.168.1.4'); },
    get username(): string { return optionalEnv('TENDA_F3_USERNAME', 'admin'); },
    get password(): string { return requireEnv('TENDA_F3_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('TENDA_F3_TIMEOUT', 8000); },
  },
  /** IP Camera */
  camera: {
    get ip(): string { return optionalEnv('CAMERA_IP', 'http://192.168.1.20'); },
    get username(): string { return optionalEnv('CAMERA_USERNAME', 'admin'); },
    get password(): string { return requireEnv('CAMERA_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('CAMERA_TIMEOUT', 8000); },
  },
  /** D-Link X1852E router (optional) */
  dlinkX1852e: {
    get ip(): string { return optionalEnv('DLINK_X1852E_IP', 'http://192.168.1.5'); },
    get username(): string { return optionalEnv('DLINK_X1852E_USERNAME', 'admin'); },
    get password(): string { return requireEnv('DLINK_X1852E_PASSWORD'); },
    get timeout(): number { return optionalEnvNumber('DLINK_X1852E_TIMEOUT', 8000); },
  },
} as const;
