require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const express = require("express");
const fs = require("fs");
const { loadConfig } = require("./utils/saveConfig");
const { raids } = require("./utils/ensureRoles");
const interactionHandler = require("./handlers/interaction");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
  ],
});

// ========== LOAD COMMANDS ==========
client.commands = new Map();
const commandFiles = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));
for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
}

// ========== INTERACTION HANDLER ==========
interactionHandler(client);

// ========== EXPRESS KEEP-ALIVE ==========
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ========== DUNGEON ROTATION STATE ==========
let currentIndex = raids.indexOf("Demon Castle");
let lastActiveSlot = null;
let lastReminderSlot = null;
let reminderMessage = null;
let pingSent = false;

// ========== POST REMINDER FUNCTION ==========
async function postReminder(channel, dungeon, secondsLeft, raidRoles) {
  pingSent = false;

  const format = s =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const updateEmbed = async () => {
    const red = secondsLeft <= 180;
    const embed = new EmbedBuilder()
      .setColor(red ? 0xff0000 : 0x11162a)
      .setTitle("「 SYSTEM WARNING 」")
      .setDescription(
        [
          "━━━━━━━━━━━━━━━━━━",
          "**🗡️ UPCOMING DUNGEON**",
          `> ${dungeon}`,
          "",
          `⏱️ Starts in: ${format(secondsLeft)}`,
          red ? "🔴 **RED ALERT!**" : "",
          "━━━━━━━━━━━━━━━━━━",
        ].join("\n")
      );

    if (!reminderMessage) reminderMessage = await channel.send({ embeds: [embed] });
    else await reminderMessage.edit({ embeds: [embed] });
  };

  await updateEmbed();

  const timer = setInterval(async () => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(timer);
      return;
    }
    if (secondsLeft === 180 && !pingSent && raidRoles[dungeon]) {
      pingSent = true;
      await channel.send(`<@&${raidRoles[dungeon]}>`);
    }
    await updateEmbed();
  }, 1000);
}

// ========== MAIN LOOP ==========
async function mainLoop() {
  const now = new Date();
  const ph = new Date(now.getTime() + 8 * 60 * 60 * 1000); // PH timezone
  const m = ph.getMinutes();
  const s = ph.getSeconds();
  const slot = `${m}-${s}`;

  const config = loadConfig();

  for (const guildId of Object.keys(config)) {
    const raidChannelId = config[guildId].raidChannelId;
    const channel = await client.channels.fetch(raidChannelId).catch(() => null);
    if (!channel) continue;

    // ===== ACTIVE POST (:00 / :30) =====
    if (s === 0 && (m === 0 || m === 30)) {
      if (lastActiveSlot === slot) continue;
      lastActiveSlot = slot;

      const active = raids[currentIndex];
      const next = raids[(currentIndex + 1) % raids.length];

      const embed = new EmbedBuilder()
        .setColor(0x05070f)
        .setTitle("「 SYSTEM — DUNGEON STATUS 」")
        .setDescription(
          [
            "━━━━━━━━━━━━━━━━━━",
            "**⚔️ ACTIVE DUNGEON**",
            `> ${active}`,
            "",
            "**➡️ NEXT DUNGEON**",
            `> ${next}`,
            "━━━━━━━━━━━━━━━━━━",
          ].join("\n")
        );

      await channel.send({ embeds: [embed] });

      currentIndex = (currentIndex + 1) % raids.length;
      reminderMessage = null;
      pingSent = false;
    }

    // ===== UPCOMING REMINDER (:20 / :50) =====
    if (s === 0 && (m === 20 || m === 50)) {
      if (lastReminderSlot === slot) continue;
      lastReminderSlot = slot;

      const upcoming = raids[currentIndex % raids.length];
      const targetMinute = m === 20 ? 30 : 0;
      const secondsLeft = (targetMinute - m + (targetMinute <= m ? 60 : 0)) * 60;

      // raidRoles optional (can integrate ensureRoles later)
      await postReminder(channel, upcoming, secondsLeft, {});
    }
  }
}

// ========== READY ==========
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`First ACTIVE => ${raids[currentIndex]}`);
  setInterval(mainLoop, 1000);
});

// ========== LOGIN ==========
client.login(process.env.TOKEN);
