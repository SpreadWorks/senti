export const PRESET_ALIASES = new Map([
  ["node", "js-webapp"],
  ["php", "php-webapp"],
]);

export function resolvePresetTestName(name) {
  return PRESET_ALIASES.get(name) || name;
}

export function getPresetAliasNames() {
  return [...PRESET_ALIASES.keys()];
}
