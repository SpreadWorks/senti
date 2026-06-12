function officialPluginRoot(envName) {
  return process.env[envName] || null;
}

export function officialPresetPluginRoot() {
  return officialPluginRoot("SENTI_OFFICIAL_PRESETS_REPO");
}
