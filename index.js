// index.js
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();

// ================= CONFIG =================
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID; // your bot's client ID

if (!token || !clientId) {
  console.error("TOKEN or CLIENT_ID env variable not found!");
  process.exit(1);
}

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ================= SERVER CONFIG =================
// Stores per-guild config: { channelId, selfRoleChannelId, reminderMessage, pingSent, lastActiveSlot, lastReminderSlot }
const guildConfigs = new Map();

// ================= FIXED 24H DUNGEON SCHEDULE =================
const dungeonSchedule = {
  "00:00": "Igris", "00:30": "Demon Castle", "01:00": "Elves", "01:30": "Goblin",
  "02:00": "Subway", "02:30": "Infernal", "03:00": "Insect", "03:30": "Igris",
  "04:00": "Demon Castle", "04:30": "Elves", "05:00": "Goblin", "05:30": "Subway",
  "06:00": "Infernal", "06:30": "Insect", "07:00": "Igris", "07:30": "Demon Castle",
  "08:00": "Goblin", "08:30": "Subway", "09:00": "Infernal", "09:30": "Insect",
  "10:00": "Igris", "10:30": "Demon Castle", "11:00": "Elves", "11:30": "Goblin",
  "12:00": "Subway", "12:30": "Infernal", "13:00": "Insect", "13:30": "Igris",
  "14:00": "Demon Castle", "14:30": "Elves", "15:00": "Goblin", "15:30": "Subway",
  "16:00": "Infernal", "16:30": "Insect", "17:00": "Igris", "17:30": "Demon Castle",
  "18:00": "Elves", "18:30": "Goblin", "19:00": "Subway", "19:30": "Infernal",
  "20:00": "Insect", "20:30": "Igris", "21:00": "Demon Castle", "21:30": "Elves",
  "22:00": "Goblin", "22:30": "Subway", "23:00": "Infernal", "23:30": "Insect",
};

// ================= IMAGES =================
const dungeonImages = {
  Goblin: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695534078529679/image.png",
  Subway: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696594457563291/image.png",
  Infernal: "https://cdn.discordapp.com/attachments/1460638599082021107/1460697434920587489/image.png",
  Insect: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696683498176737/image.png",
  Igris: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696861399842979/image.png",
  Elves: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695678941663377/image.png",
  "Demon Castle": "https://cdn.discordapp.com/attachments/1410965755742130247/1463577590039183431/image.png",
};

// ================= TIME HELPERS =================
function getPHTime() {
  const now = new Date();
  return new Date(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 8,
    now.getUTCMinutes(),
    now.getUTCSeconds()
  );
}

function formatHM(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getNextSlot(time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + 30, 0, 0);
  return formatHM(d);
}

// ================= POST REMINDER =================
async function postReminder(guildConfig, channel, dungeon, secondsLeft) {
  guildConfig.pingSent = false;

  const format = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

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
      )
      .setImage(dungeonImages[dungeon])
      .setTimestamp();

    if (!guildConfig.reminderMessage) {
      guildConfig.reminderMessage = await channel.send({ embeds: [embed] });
    } else {
      await guildConfig.reminderMessage.edit({ embeds: [embed] });
    }
  };

  await updateEmbed();

  const timer = setInterval(async () => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(timer);
      return;
    }

    if (secondsLeft === 180 && !guildConfig.pingSent) {
      guildConfig.pingSent = true;
      const role = channel.guild.roles.cache.find(r => r.name === dungeon);
      if (role) await channel.send(`<@&${role.id}>`);
    }

    await updateEmbed();
  }, 1000);
}

// ================= ENSURE DUNGEON ROLES =================
async function ensureDungeonRoles(guild) {
  const existingRoles = guild.roles.cache;
  for (let dungeon of Object.keys(dungeonImages)) {
    if (!existingRoles.find(r => r.name === dungeon)) {
      await guild.roles.create({
        name: dungeon,
        mentionable: true,
        reason: "Dungeon ping role",
      });
    }
  }
}

// ================= MAIN LOOP =================
async function mainLoop() {
  const ph = getPHTime();
  const m = ph.getMinutes();
  const s = ph.getSeconds();
  const slot = `${m}-${s}`;

  for (const [guildId, config] of guildConfigs.entries()) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;

    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel) continue;

    // ===== ACTIVE (:00 / :30) =====
    if (s === 0 && (m === 0 || m === 30)) {
      if (config.lastActiveSlot === slot) continue;
      config.lastActiveSlot = slot;

      const timeKey = formatHM(ph);
      const active = dungeonSchedule[timeKey];
      if (!active) continue;

      const next = dungeonSchedule[getNextSlot(timeKey)];

      await channel.send({
        embeds: [
          new EmbedBuilder()
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
            )
            .setImage(dungeonImages[active])
            .setTimestamp(),
        ],
      });

      config.reminderMessage = null;
      config.pingSent = false;
    }

    // ===== REMINDER (:20 / :50) =====
    if (s === 0 && (m === 20 || m === 50)) {
      if (config.lastReminderSlot === slot) continue;
      config.lastReminderSlot = slot;

      const base = new Date(ph);
      base.setMinutes(m === 20 ? 30 : 60, 0, 0);

      const upcomingTime = formatHM(base);
      const upcoming = dungeonSchedule[upcomingTime];
      if (!upcoming) continue;

      const secondsLeft = (base - ph) / 1000;
      await postReminder(config, channel, upcoming, secondsLeft);
    }
  }
}

// ================= SLASH COMMANDS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName, options, guild } = interaction;
  if (!guild) return;

  if (commandName === "setchannel") {
    const channel = options.getChannel("channel");
    if (!channel || !channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
      return interaction.reply({ content: "I cannot send messages in that channel!", ephemeral: true });
    }

    const config = guildConfigs.get(guild.id) || {};
    config.channelId = channel.id;
    guildConfigs.set(guild.id, config);

    await interaction.reply({ content: `Dungeon reminders will be posted in ${channel}!`, ephemeral: true });
  }

  if (commandName === "selfrole") {
    const config = guildConfigs.get(guild.id) || {};
    const selfRoleChannel = interaction.channel;

    await ensureDungeonRoles(guild);

    let msg = await selfRoleChannel.send({
      content: "React to assign yourself dungeon roles! (Currently only manual assignment)",
    });

    config.selfRoleChannelId = selfRoleChannel.id;
    guildConfigs.set(guild.id, config);

    await interaction.reply({ content: "Self-role message posted!", ephemeral: true });
  }
});

// ================= REGISTER SLASH COMMANDS =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  setInterval(mainLoop, 1000);

  const commands = [
    new SlashCommandBuilder()
      .setName("setchannel")
      .setDescription("Set the channel where dungeon reminders will be posted")
      .addChannelOption(option => option.setName("channel").setDescription("The channel to post reminders in").setRequired(true)),
    new SlashCommandBuilder()
      .setName("selfrole")
      .setDescription("Post a message for self-assigning dungeon roles"),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log("Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// ================= EXPRESS =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
