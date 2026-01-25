const fs = require("fs");
const path = require("path");
const CONFIG_FILE = path.join(__dirname, "../data/guildConfig.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  return JSON.parse(fs.readFileSync(CONFIG_FILE));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

module.exports = { loadConfig, saveConfig };
