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
// Note: We need Guilds + GuildMessageReactions for self-role
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers // Required to assign roles
  ],
});

// ================= SERVER CONFIG =================
const guildConfigs = new Map();

// ================= SELF-ROLE EMOJI MAP =================
const selfRoleEmojis = {
  "🐶": "Igris Portal Dungeon",
  "🐱": "Elves Portal Dungeon",
  "🦅": "Infernal Portal Dungeon",
  "🦉": "Insect Portal Dungeon",
  "🐺": "Goblin Portal Dungeon",
  "🐹": "Subway Portal Dungeon",
  "👹": "Demon Castle Portal"
};

// ================= ENSURE DUNGEON ROLES =================
async function ensureDungeonRoles(guild) {
  for (const roleName of Object.values(selfRoleEmojis)) {
    if (!guild.roles.cache.find(r => r.name === roleName)) {
      await guild.roles.create({
        name: roleName,
        mentionable: true,
        reason: "Self-role setup",
      });
    }
  }
}

// ================= POST SELF-ROLE MESSAGE =================
async function postSelfRoleMessage(guild, channel) {
  await ensureDungeonRoles(guild);

  const embed = new EmbedBuilder()
    .setTitle("React to assign yourself roles")
    .setDescription(Object.entries(selfRoleEmojis)
      .map(([emoji, role]) => `${emoji} → @${role}`)
      .join("\n"))
    .setColor(0x00ff00);

  const message = await channel.send({ embeds: [embed] });

  // Add all reactions
  for (const emoji of Object.keys(selfRoleEmojis)) {
    await message.react(emoji);
  }

  // Set up collector to give/remove roles
  const filter = (reaction, user) => !user.bot && Object.keys(selfRoleEmojis).includes(reaction.emoji.name);
  const collector = message.createReactionCollector({ filter, dispose: true });

  collector.on("collect", async (reaction, user) => {
    try {
      const roleName = selfRoleEmojis[reaction.emoji.name];
      const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);
      const member = await reaction.message.guild.members.fetch(user.id);
      if (role && member) await member.roles.add(role);
    } catch (err) {
      console.error("Error adding role:", err);
    }
  });

  collector.on("remove", async (reaction, user) => {
    try {
      const roleName = selfRoleEmojis[reaction.emoji.name];
      const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);
      const member = await reaction.message.guild.members.fetch(user.id);
      if (role && member) await member.roles.remove(role);
    } catch (err) {
      console.error("Error removing role:", err);
    }
  });
}

// ================= SLASH COMMANDS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName, options, guild } = interaction;
  if (!guild) return;

  if (commandName === "selfrole") {
    const selfRoleChannel = interaction.channel;
    await postSelfRoleMessage(guild, selfRoleChannel);
    await interaction.reply({ content: "Self-role message posted!", ephemeral: true });
  }
});

// ================= REGISTER SLASH COMMANDS =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [
    new SlashCommandBuilder()
      .setName("selfrole")
      .setDescription("Post a message for self-assigning dungeon roles")
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
