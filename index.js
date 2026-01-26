require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const express = require("express");

const interactionHandler = require("./interaction");
const { loadConfig } = require("./saveConfig");
const { raids } = require("./ensureRoles");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ===== EXPRESS (RENDER KEEP ALIVE) =====
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ===== DUNGEON STATE =====
let currentIndex = raids.indexOf("Demon Castle");
let lastActiveKey = "";
let lastReminderKey = "";

// ===== MAIN LOOP =====
async function mainLoop() {
  const now = new Date();
  const ph = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const m = ph.getMinutes();
  const s = ph.getSeconds();
  const key = `${m}:${s}`;

  const config = loadConfig();

  for (const gui
