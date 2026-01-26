const fs = require("fs");
const path = require("path");

// Path sa guild config JSON
const CONFIG_FILE = path.join(__dirname, "../data/guildConfig.json");

// Load config, kung wala file, return empty object
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

// Save config sa JSON
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig };
