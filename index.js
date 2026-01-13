const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const express = require("express");

// ================= CONFIG =================
const token = process.env.TOKEN;
if (!token) {
  console.error("TOKEN env variable not found!");
  process.exit(1);
}

const raidChannelId = "1460638599082021107";

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// ================= RAID ROTATION =================
const raids = ["Insect", "Igris", "Elves", "Goblin", "Subway", "Infernal"];
let currentIndex = raids.indexOf("Elves"); // First active dungeon = Elves

// ================= ROLE IDS =================
const raidRoles = {
  Insect: "1460130634000236769",
  Igris: "1460130485702365387",
  Infernal: "1460130564353953872",
  Goblin: "1460130693895159982",
  Subway: "1460130735175499862",
  Elves: "1460131344205218018",
};

// ================= THUMBNAILS / IMAGES =================
const dungeonImages = {
  Goblin: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695534078529679/image.png",
  Subway: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696594457563291/image.png",
  Elves: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695678941663377/image.png",
  Igris: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696861399842979/image.png",
  Infernal: "https://cdn.discordapp.com/attachments/1460638599082021107/1460697434920587489/image.png",
  Insect: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696683498176737/image.png",
};

// ================= LIVE COUNTDOWN GLOBALS =================
let countdownMessage = null;
let countdownInterval = null;
let rolePingSent = false;

// ================= TIME FORMATTER =================
function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ================= LIVE COUNTDOWN =================
async function startLiveCountdown(channel, dungeonName, imageUrl, totalSeconds, rolePingAt = 180) {
  if (countdownInterval) clearInterval(countdownInterval);
  if (countdownMessage) await countdownMessage.delete().catch(() => {});

  countdownMessage = null;
  countdownInterval = null;
  rolePingSent = false;

  let remaining = totalSeconds;

  const embed = new EmbedBuilder()
    .setColor(0x11162a)
    .setTitle("「 SYSTEM WARNING 」")
    .setDescription(
      [
        "━━━━━━━━━━━━━━━━━━",
        "**🗡️ UPCOMING DUNGEON**",
        `> ${dungeonName}`,
        "",
        "⏳ **Dungeon spawning in**",
        "",
        `**${formatTime(remaining)}**`,
        "",
        "_Prepare yourselves, hunters._",
        "━━━━━━━━━━━━━━━━━━",
      ].join("\n")
    )
    .setImage(imageUrl)
    .setTimestamp();

  countdownMessage = await channel.send({ embeds: [embed] });

  countdownInterval = setInterval(async () => {
    remaining--;

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      return;
    }

    const isDanger = remaining <= 60; // red color when ≤1 min

    // 🔔 Role ping at 3 minutes remaining
    if (remaining === rolePingAt && !rolePingSent) {
      const roleId = raidRoles[dungeonName];
      if (roleId) {
        await channel.send(`🔔 <@&${roleId}> **Dungeon will spawn in ${formatTime(rolePingAt)}!**`);
      }
      rolePingSent = true;
    }

    const updatedEmbed = new EmbedBuilder()
      .setColor(isDanger ? 0xff0000 : 0x11162a)
      .setTitle(isDanger ? "⚠️⚠️ SYSTEM ALERT ⚠️⚠️" : "「 SYSTEM WARNING 」")
      .setDescription(
        [
          "━━━━━━━━━━━━━━━━━━",
          isDanger ? "**⚠️ DUNGEON IMMINENT ⚠️**" : "**🗡️ UPCOMING DUNGEON**",
          `> ${dungeonName}`,
          "",
          isDanger ? "⚠️ **SPAWNING IN** ⚠️" : "⏳ **Dungeon spawning in**",
          "",
          isDanger ? `**\`${formatTime(remaining)}\`**` : `**${formatTime(remaining)}**`,
          "",
          isDanger
            ? "_Stand your ground. Survival is not guaranteed._"
            : "_Prepare yourselves, hunters._",
          "━━━━━━━━━━━━━━━━━━",
        ].join("\n")
      )
      .setImage(imageUrl)
      .setTimestamp();

    await countdownMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
  }, 1000);
}

// ================= CHECK TIME & POST =================
async function checkTimeAndPost() {
  const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // PH time

  const minute = phTime.getMinutes();
  const second = phTime.getSeconds();

  if (second !== 0) return; // run only at start of the second

  const channel = await client.channels.fetch(raidChannelId).catch(() => null);
  if (!channel) return;

  // Calculate next dungeon time (every 30 mins)
  const nextDungeonMinutes = phTime.getMinutes() < 30 ? 30 : 60;
  const nextDungeonTime = new Date(phTime);
  nextDungeonTime.setMinutes(nextDungeonMinutes);
  nextDungeonTime.setSeconds(0);
  nextDungeonTime.setMilliseconds(0);

  const diffMs = nextDungeonTime - phTime;
  const diffSeconds = Math.floor(diffMs / 1000);

  const currentPortal = raids[currentIndex];
  const nextPortal = raids[(currentIndex + 1) % raids.length];

  // Reminder: 10 minutes before active dungeon
  if (diffSeconds <= 10 * 60 && diffSeconds > 10 * 60 - 1) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (countdownMessage) await countdownMessage.delete().catch(() => {});
    countdownInterval = null;
    countdownMessage = null;
    rolePingSent = false;

    startLiveCountdown(channel, nextPortal, dungeonImages[nextPortal], 10 * 60, 3 * 60); // countdown 10min, ping at 3min
  }

  // Active dungeon post
  if (diffSeconds === 0) {
    if (countdownInterval) clearInterval(countdownInterval);
    if (countdownMessage) await countdownMessage.delete().catch(() => {});
    countdownInterval = null;
    countdownMessage = null;
    rolePingSent = false;

    const rolePing = raidRoles[currentPortal] ? `<@&${raidRoles[currentPortal]}>` : "";

    const embed = new EmbedBuilder()
      .setColor(0x05070f)
      .setTitle("「 SYSTEM — DUNGEON STATUS 」")
      .setDescription(
        [
          "━━━━━━━━━━━━━━━━━━",
          "**⚔️ ACTIVE DUNGEON**",
          `> ${currentPortal}`,
          "",
          "**➡️ NEXT DUNGEON**",
          `> ${nextPortal}`,
          "━━━━━━━━━━━━━━━━━━",
          "_Your dungeon has spawned. Hunters,\nbe ready—only the strong survive._",
        ].join("\n")
      )
      .setImage(dungeonImages[currentPortal])
      .setFooter({ text: "ARISE." })
      .setTimestamp();

    await channel.send({ content: rolePing, embeds: [embed] });

    currentIndex = (currentIndex + 1) % raids.length;
  }
}

// ================= READY =================
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  setInterval(checkTimeAndPost, 1000);
});

// ================= EXPRESS (KEEP ALIVE) =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
