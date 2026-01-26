// index.js
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const express = require("express");
require("dotenv").config();

// ================= CONFIG =================
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("TOKEN or CLIENT_ID env variable not found!");
  process.exit(1);
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required for reaction roles
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// ================= SERVER CONFIG =================
const guildConfigs = new Map(); // store { channelId } per server

// ================= DUNGEON SCHEDULE =================
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

// ================= DUNGEON IMAGES =================
const dungeonImages = {
  Goblin: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695534078529679/image.png",
  Subway: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696594457563291/image.png",
  Infernal: "https://cdn.discordapp.com/attachments/1460638599082021107/1460697434920587489/image.png",
  Insect: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696683498176737/image.png",
  Igris: "https://cdn.discordapp.com/attachments/1460638599082021107/1460696861399842979/image.png",
  Elves: "https://cdn.discordapp.com/attachments/1460638599082021107/1460695678941663377/image.png",
  "Demon Castle": "https://cdn.discordapp.com/attachments/1410965755742130247/1463577590039183431/image.png",
};

// ================= SELF-ROLE EMOJIS =================
const selfRoleEmojis = {
  "🐶": "Igris Portal Dungeon",
  "🐱": "Elves Portal Dungeon",
  "🦅": "Infernal Portal Dungeon",
  "🦉": "Insect Portal Dungeon",
  "🐺": "Goblin Portal Dungeon",
  "🐹": "Subway Portal Dungeon",
  "👹": "Demon Castle Portal"
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
  return `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
}

function getNextSlot(time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m + 30, 0, 0);
  return formatHM(d);
}

// ================= ENSURE SELF-ROLES =================
async function ensureRoles(guild) {
  for (const roleName of Object.values(selfRoleEmojis)) {
    if (!guild.roles.cache.find(r => r.name === roleName)) {
      await guild.roles.create({ name: roleName, mentionable: true, reason: "Self-role setup" });
    }
  }
}

// ================= POST SELF-ROLE MESSAGE =================
async function postSelfRoleMessage(guild, channel) {
  await ensureRoles(guild);

  const embed = new EmbedBuilder()
    .setTitle("React to assign yourself roles")
    .setDescription(Object.entries(selfRoleEmojis).map(([e,r])=>`${e} → @${r}`).join("\n"))
    .setColor(0x00ff00);

  const message = await channel.send({ embeds: [embed] });

  for (const emoji of Object.keys(selfRoleEmojis)) {
    await message.react(emoji);
  }

  const filter = (reaction, user) => !user.bot && Object.keys(selfRoleEmojis).includes(reaction.emoji.name);
  const collector = message.createReactionCollector({ filter, dispose: true });

  collector.on("collect", async (reaction, user) => {
    try {
      const roleName = selfRoleEmojis[reaction.emoji.name];
      const role = guild.roles.cache.find(r => r.name === roleName);
      const member = await guild.members.fetch(user.id);
      if (role && member) await member.roles.add(role);
    } catch(err){ console.error("Add role error:", err);}
  });

  collector.on("remove", async (reaction, user) => {
    try {
      const roleName = selfRoleEmojis[reaction.emoji.name];
      const role = guild.roles.cache.find(r => r.name === roleName);
      const member = await guild.members.fetch(user.id);
      if (role && member) await member.roles.remove(role);
    } catch(err){ console.error("Remove role error:", err);}
  });
}

// ================= SLASH COMMANDS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName, options, guild, member } = interaction;
  if (!guild) return;

  if (!member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
  }

  if (commandName === "setchannel") {
    const channel = options.getChannel("channel");
    if (!channel || !channel.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
      return interaction.reply({ content: "I cannot send messages in that channel!", ephemeral: true });
    }
    guildConfigs.set(guild.id, { channelId: channel.id });
    return interaction.reply({ content: `Self-role messages will be posted in ${channel}!`, ephemeral: true });
  }

  if (commandName === "selfrole") {
    const config = guildConfigs.get(guild.id);
    if (!config?.channelId) return interaction.reply({ content: "Channel not set! Use /setchannel first.", ephemeral: true });

    const channel = guild.channels.cache.get(config.channelId);
    if (!channel) return interaction.reply({ content: "Configured channel not found!", ephemeral: true });

    await postSelfRoleMessage(guild, channel);
    return interaction.reply({ content: "Self-role message posted!", ephemeral: true });
  }
});

// ================= REGISTER SLASH COMMANDS =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [
    new SlashCommandBuilder()
      .setName("setchannel")
      .setDescription("Set the channel where self-role messages will be posted")
      .addChannelOption(option => option
        .setName("channel")
        .setDescription("Channel to post self-role messages")
        .setRequired(true)),
    new SlashCommandBuilder()
      .setName("selfrole")
      .setDescription("Post the self-role message in the configured channel")
  ].map(cmd => cmd.toJSON());

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
