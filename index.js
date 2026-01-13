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

// ================= THUMBNAILS / IMAGES =================
const dungeonImages = {
  Goblin: "https://cdn.discordapp.com/attachments/1460638599082021107/1460649062020677662/5555d8b30006ff3c2f25f4ab05a748d2.png",
  Subway: "https://cdn.discordapp.com/attachments/1460638599082021107/1460649474601910332/image.png",
  Elves: "https://cdn.discordapp.com/attachments/1460638599082021107/1460649155746599205/image.png",
  Igris: "https://cdn.discordapp.com/attachments/1460638599082021107/1460649284214194497/image.png",
  Infernal: "https://cdn.discordapp.com/attachments/1460638599082021107/1460650252016156973/image.png",
  Insect: "https://cdn.discordapp.com/attachments/1460638599082021107/1460649853548761251/image.png",
};

// ================= SLASH COMMAND =================
const commands = [
  new SlashCommandBuilder()
    .setName("testportal")
    .setDescription("Simulate the dungeon rotation and embed"),
].map((cmd) => cmd.toJSON());

// ================= PREVENT DOUBLE POST =================
let lastPostedQuarter = null;

// ================= READY =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Register slash commands
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id), {
    body: commands,
  });
  console.log("/testportal registered");

  // Automatic rotation posts
  setInterval(checkTimeAndPost, 1000);
});

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
          "_Your dungeon has spawned. Hunters,\nbe ready—only the strong survive._",
        ].join("\n")
      )
      .setImage(dungeonImages[currentPortal]) // use big image instead of thumbnail
      .setFooter({ text: "ARISE." })
      .setTimestamp();

    await channel.send({ content: rolePing, embeds: [embed] });
    currentIndex = (currentIndex + 1) % raids.length;
  } else {
    // Reminder for upcoming dungeon
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
          "_Prepare yourselves, hunters!_",
          "━━━━━━━━━━━━━━━━━━",
        ].join("\n")
      )
      .setImage(dungeonImages[upcomingPortal])
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
        "_Your dungeon has spawned. Hunters,\nbe ready—only the strong survive._",
      ].join("\n")
    )
    .setImage(dungeonImages[currentPortal]) // big image
    .setFooter({ text: "ARISE." })
    .setTimestamp();

  await interaction.reply({ content: rolePing, embeds: [embed] });
});

// ================= EXPRESS (KEEP ALIVE) =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
