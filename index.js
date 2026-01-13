const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");
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
let currentIndex = raids.indexOf("Infernal"); // First active dungeon = Infernal

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

// ================= PREVENT DOUBLE POST =================
let lastPostedQuarter = null;

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

// ================= LIVE COUNTDOWN FUNCTION =================
async function startLiveCountdown(channel, dungeonName, imageUrl, totalSeconds) {
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

    const isDanger = remaining <= 10;

    // 🔔 Role ping at 5 seconds
    if (remaining === 5 && !rolePingSent) {
      const roleId = raidRoles[dungeonName];
      if (roleId) {
        await channel.send(`🔔 <@&${roleId}> **5 SECONDS REMAINING**`);
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
          `**${formatTime(remaining)}**`,
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

// ================= MAIN LOOP =================
async function checkTimeAndPost() {
  const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000); // PH time

  const minute = phTime.getMinutes();
  const second = phTime.getSeconds();

  if (second !== 0) return;
  if (![0, 15, 30, 45].includes(minute)) return;

  const currentQuarter =
    phTime.getFullYear() +
    String(phTime.getMonth() + 1).padStart(2, "0") +
    String(phTime.getDate()).padStart(2, "0") +
    String(phTime.getHours()).padStart(2, "0") +
    String(minute).padStart(2, "0");

  if (lastPostedQuarter === currentQuarter) return;
  lastPostedQuarter = currentQuarter;

  const channel = await client.channels.fetch(raidChannelId).catch(() => null);
  if (!channel) return;

  const currentPortal = raids[currentIndex];
  const nextPortal = raids[(currentIndex + 1) % raids.length];

  if (minute === 0 || minute === 30) {
    // Active dungeon
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

    // increment after posting active dungeon
    currentIndex = (currentIndex + 1) % raids.length;

  } else {
    // Reminder for upcoming dungeon with live countdown
    await startLiveCountdown(channel, nextPortal, dungeonImages[nextPortal], 15 * 60); // 15 min countdown
  }
}

// ================= READY & REGISTER COMMAND =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register /testdungeon command AFTER bot is ready
  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: [
          new SlashCommandBuilder()
            .setName("testdungeon")
            .setDescription("Test a dungeon countdown for 10 seconds")
            .addStringOption((option) =>
              option
                .setName("dungeon")
                .setDescription("Which dungeon to test")
                .setRequired(true)
                .addChoices(
                  { name: "Insect", value: "Insect" },
                  { name: "Igris", value: "Igris" },
                  { name: "Elves", value: "Elves" },
                  { name: "Goblin", value: "Goblin" },
                  { name: "Subway", value: "Subway" },
                  { name: "Infernal", value: "Infernal" }
                )
            )
            .toJSON(),
        ],
      }
    );
    console.log("/testdungeon command registered!");
  } catch (err) {
    console.error("Failed to register command:", err);
  }

  // Start the dungeon check loop
  setInterval(checkTimeAndPost, 1000);
});

// ================= COMMAND HANDLER =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "testdungeon") {
    const dungeonName = interaction.options.getString("dungeon");
    const imageUrl = dungeonImages[dungeonName];

    if (!imageUrl) {
      await interaction.reply({ content: "Invalid dungeon.", ephemeral: true });
      return;
    }

    await interaction.reply({
      content: `🔔 Testing ${dungeonName} dungeon countdown (10 seconds)!`,
      ephemeral: false,
    });

    const channel = interaction.channel;
    if (channel) {
      startLiveCountdown(channel, dungeonName, imageUrl, 10);
    }
  }
});

// ================= EXPRESS (KEEP ALIVE) =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
