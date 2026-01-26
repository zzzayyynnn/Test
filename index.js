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
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// ================= SERVER CONFIG =================
const guildConfigs = new Map(); // store { channelId, selfRoleMessageId } per server

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

// ================= ENSURE SELF-ROLES =================
async function ensureRoles(guild) {
  for (const roleName of Object.values(selfRoleEmojis)) {
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        mentionable: true,
        reason: "Self-role setup"
      });
    }
  }
}

// ================= POST SELF-ROLE MESSAGE =================
async function postSelfRoleMessage(guild, channel) {
  await ensureRoles(guild);

  const embed = new EmbedBuilder()
    .setTitle("React to assign yourself roles")
    .setDescription(
      Object.entries(selfRoleEmojis)
        .map(([emoji, roleName]) => {
          const role = guild.roles.cache.find(r => r.name === roleName);
          return role ? `${emoji} → ${role}` : `${emoji} → ${roleName}`;
        })
        .join("\n")
    )
    .setColor(0x00ff00);

  const message = await channel.send({ embeds: [embed] });

  // React with all emojis
  for (const emoji of Object.keys(selfRoleEmojis)) {
    await message.react(emoji).catch(console.error);
  }

  // Save the self-role message ID for future reaction handling
  guildConfigs.set(guild.id, { ...guildConfigs.get(guild.id), selfRoleMessageId: message.id });
}

// ================= GLOBAL REACTION HANDLERS =================
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});

  const guild = reaction.message.guild;
  if (!guild) return;

  const config = guildConfigs.get(guild.id);
  if (!config?.selfRoleMessageId || reaction.message.id !== config.selfRoleMessageId) return;

  const roleName = selfRoleEmojis[reaction.emoji.name];
  if (!roleName) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  const member = await guild.members.fetch(user.id);
  member.roles.add(role).catch(console.error);
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});

  const guild = reaction.message.guild;
  if (!guild) return;

  const config = guildConfigs.get(guild.id);
  if (!config?.selfRoleMessageId || reaction.message.id !== config.selfRoleMessageId) return;

  const roleName = selfRoleEmojis[reaction.emoji.name];
  if (!roleName) return;

  const role = guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  const member = await guild.members.fetch(user.id);
  member.roles.remove(role).catch(console.error);
});

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
    guildConfigs.set(guild.id, { ...guildConfigs.get(guild.id), channelId: channel.id });
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

// ================= EXPRESS SERVER =================
const app = express();
app.get("/", (_, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000);

// ================= LOGIN =================
client.login(token);
