type PortEnv = Record<string, string | undefined>;

export type ResolveConfiguredPortInput = {
  defaultPort: number;
  env: PortEnv;
  name: string;
};

export function resolveConfiguredPort(
  input: ResolveConfiguredPortInput,
): number {
  const rawValue = input.env[input.name]?.trim();
  if (!rawValue) {
    return input.defaultPort;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`${input.name} must be a valid port number`);
  }

  const port = Number.parseInt(rawValue, 10);
  if (port < 1 || port > 65535) {
    throw new Error(`${input.name} must be a valid port number`);
  }

  return port;
}
