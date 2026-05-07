export type ConfigResolutionInput<T> = {
  globalDefault: T;
  agentDefault?: T;
  gameDefault?: T;
  agentGameOverride?: T;
};

export function resolveConfigValue<T>(input: ConfigResolutionInput<T>): T {
  if (input.agentGameOverride !== undefined) {
    return input.agentGameOverride;
  }

  if (input.gameDefault !== undefined) {
    return input.gameDefault;
  }

  if (input.agentDefault !== undefined) {
    return input.agentDefault;
  }

  return input.globalDefault;
}
