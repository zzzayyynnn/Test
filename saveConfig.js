const fs = require("fs");

const FILE = "./guildConfig.json";

function loadConfig() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

function saveConfig(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

module.exports = { loadConfig, saveConfig };
