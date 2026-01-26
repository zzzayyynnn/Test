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
const guildConfigs = new Map(); // { channelId, selfRoleMessageId, emojis: {emoji: roleId} }

// ================= SELF-ROLE EMOJIS =================
// Using common Discord emojis
const selfRoleEmojis = {
  "🟢": "Green Team",
  "🔵": "Blue Team",
  "🟡": "Yellow Team",
  "🔴": "Red Team",
  "⚪": "White Team",
  "⚫": "Black Team",
  "🟣": "Purple Team"
};

// ================= ENSURE SELF-ROLES =================
async function ensureRoles(guild) {
  for (const roleName of Object.values(selfRoleEmojis)) {
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
      role = await guild.roles.create({
        name: roleName,
        mentionable: true,
        reason: "Reaction role setup"
      });
    }
  }
}

// ================= POST SELF-ROLE MESSAGE =================
async function postSelfRoleMessage(guild, channel) {
  await ensureRoles(guild);

  // Map emojis to role IDs
  const emojiRoleMap = {};
  for (const [emoji, roleName] of Object.entries(selfRoleEmojis)) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) emojiRoleMap[emoji] = role.id;
  }

  const embed = new EmbedBuilder()
    .setTitle("React to assign yourself a role!")
    .setDescription(
      Object.entries(emojiRoleMap)
        .map(([emoji, roleId]) => `${emoji} → <@&${roleId}>`)
        .join("\n")
    )
    .setColor(0x00ff00);

  const message = await channel.send({ embeds: [embed] });

  // React with all emojis
  for (const emoji of Object.keys(emojiRoleMap)) {
    await message.react(emoji).catch(console.error);
  }

  // Save config
  guildConfigs.set(guild.id, {
    ...guildConfigs.get(guild.id),
    channelId: channel.id,
    selfRoleMessageId: message.id,
    emojis: emojiRoleMap
  });
}

// ================= REACTION HANDLERS =================
async function handleReaction(reaction, user, add) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});

  const guild = reaction.message.guild;
  if (!guild) return;

  const config = guildConfigs.get(guild.id);
  if (!config?.selfRoleMessageId || reaction.message.id !== config.selfRoleMessageId) return;

  const roleId = config.emojis[reaction.emoji.name];
  if (!roleId) return;

  const member = await guild.members.fetch(user.id);
  if (add) {
    member.roles.add(roleId).catch(console.error);
  } else {
    member.roles.remove(roleId).catch(console.error);
  }
}

client.on("messageReactionAdd", (reaction, user) => handleReaction(reaction, user, true));
client.on("messageReactionRemove", (reaction, user) => handleReaction(reaction, user, false));

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
    return interaction.reply({ content: `Reaction-role messages will be posted in ${channel}!`, ephemeral: true });
  }

  if (commandName === "reactionrole") {
    const config = guildConfigs.get(guild.id);
    if (!config?.channelId) return interaction.reply({ content: "Channel not set! Use /setchannel first.", ephemeral: true });

    const channel = guild.channels.cache.get(config.channelId);
    if (!channel) return interaction.reply({ content: "Configured channel not found!", ephemeral: true });

    await postSelfRoleMessage(guild, channel);
    return interaction.reply({ content: "Reaction-role message posted!", ephemeral: true });
  }
});

// ================= REGISTER SLASH COMMANDS =================
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [
    new SlashCommandBuilder()
      .setName("setchannel")
      .setDescription("Set the channel where reaction-role messages will be posted")
      .addChannelOption(option => option
        .setName("channel")
        .setDescription("Channel to post reaction-role messages")
        .setRequired(true)),
    new SlashCommandBuilder()
      .setName("reactionrole")
      .setDescription("Post the reaction-role message in the configured channel")
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
