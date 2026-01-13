const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
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
let currentIndex = raids.indexOf("Igris");
if (currentIndex === -1) currentIndex = 0;

// ================= ROLE IDS =================
const raidRoles = {
  Insect: "1460130634000236769",
  Igris: "1460130485702365387",
  Infernal: "1460130564353953872",
  Goblin: "1460130693895159982",
  Subway: "1460130735175499862",
  Elves: "1460131344205218018",
};

// ================= THUMBNAILS =================
const dungeonThumbnails = {
  Insect: "https://i.imgur.com/6XKQZ5y.png",
  Igris: "https://i.imgur.com/1XKQZ5y.png",
  Elves: "https://i.imgur.com/2XKQZ5y.png",
  Goblin: "https://i.imgur.com/3XKQZ5y.png",
  Subway: "https://i.imgur.com/4XKQZ5y.png",
  Infernal: "https://i.imgur.com/5XKQZ5y.png",
};

// ================= SLASH COMMAND =================
const commands = [
  new SlashCommandBuilder()
    .setName("testportal")
    .setDescription("Test the cinematic dungeon system embed"),
].map((cmd) => cmd.toJSON());

// ================= PREVENT DOUBLE POST =================
let lastPostedQuarter = null;

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands,
  });

  console.log("/testportal registered");
  setInterval(checkTimeAndPost, 1000);
});

// ================= MAIN LOOP =================
async function checkTimeAndPost() {
  const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);

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
    const rolePing = raidRoles[currentPortal]
      ? `<@&${raidRoles[currentPortal]}>`
      : "";

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
          "_Authority of the Shadow Monarch detected._",
        ].join("\n")
      )
      .setThumbnail(dungeonThumbnails[currentPortal])
      .setFooter({ text: "ARISE." })
      .setTimestamp();

    await channel.send({ content: rolePing, embeds: [embed] });
    currentIndex = (currentIndex + 1) % raids.length;
  } else {
    const upcomingPortal = raids[currentIndex];

    const reminderEmbed = new EmbedBuilder()
      .setColor(0x11162a)
      .setTitle("「 SYSTEM WARNING 」")
      .setDescription(
        [
          "━━━━━━━━━━━━━━━━━━",
          "**🗡️ UPCOMING DUNGEON**",
          `> ${upcomingPortal}`,
          "",
          "_The shadows are gathering._",
          "━━━━━━━━━━━━━━━━━━",
        ].join("\n")
      )
      .setTimestamp();

    await channel.send({ embeds: [reminderEmbed] });
  }
}

// ================= SLASH COMMAND HANDLER =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "testportal") return;

  const currentPortal = raids[currentIndex];
  const nextPortal = raids[(currentIndex + 1) % raids.length];

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
      ].join("\n")
    )
    .setThumbnail(dungeonThumbnails[currentPortal])
    .setFooter({ text: "ARISE." })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
});

// ================= EXPRESS (KEEP ALIVE) =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
