const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");
require("dotenv").config();

/* ================= ENV ================= */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing TOKEN or CLIENT_ID");
  process.exit(1);
}

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ================= DATA ================= */
// guildId => { channelId, messageId }
const guildConfig = new Map();

/* EMOJI → ROLE NAME */
const reactionRoles = {
  "🐶": "Igris Portal Dungeon",
  "🐱": "Elves Portal Dungeon",
  "🦅": "Infernal Portal Dungeon",
  "🦉": "Insect Portal Dungeon",
  "🐺": "Goblin Portal Dungeon",
  "🐹": "Subway Portal Dungeon",
  "👹": "Demon Castle Portal"
};

/* ================= SLASH COMMANDS (GLOBAL) ================= */
const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set channel for self-role")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt
        .setName("channel")
        .setDescription("Channel for self-role embed")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("selfrole")
    .setDescription("Send the self-role embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(CLIENT_ID), // 🌍 PUBLIC / GLOBAL
      { body: commands.map(c => c.toJSON()) }
    );
    console.log("✅ Global slash commands registered");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
})();

/* ================= READY ================= */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ================= INTERACTIONS ================= */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guildId = interaction.guild.id;

  /* ---- /setchannel ---- */
  if (interaction.commandName === "setchannel") {
    const channel = interaction.options.getChannel("channel");

    guildConfig.set(guildId, {
      channelId: channel.id,
      messageId: null
    });

    return interaction.reply({
      content: `✅ Self-role channel set to ${channel}`,
      ephemeral: true
    });
  }

  /* ---- /selfrole ---- */
  if (interaction.commandName === "selfrole") {
    const config = guildConfig.get(guildId);
    if (!config?.channelId) {
      return interaction.reply({
        content: "❌ Use /setchannel first",
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.fetch(config.channelId);

    /* CREATE ROLES */
    const roleMap = {};
    for (const roleName of Object.values(reactionRoles)) {
      let role = interaction.guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        role = await interaction.guild.roles.create({
          name: roleName,
          reason: "Self-role auto create"
        });
      }
      roleMap[roleName] = role;
    }

    /* EMBED */
    const description = Object.entries(reactionRoles)
      .map(([emoji, roleName]) => `${emoji} → ${roleMap[roleName]}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🌀 Portal Dungeon Roles")
      .setDescription(description)
      .setColor("Purple")
      .setFooter({ text: "React to get your dungeon role" });

    const message = await channel.send({ embeds: [embed] });

    config.messageId = message.id;
    guildConfig.set(guildId, config);

    for (const emoji of Object.keys(reactionRoles)) {
      await message.react(emoji);
    }

    return interaction.reply({
      content: "✅ Self-role embed sent!",
      ephemeral: true
    });
  }
});

/* ================= REACTIONS ================= */
async function handleReaction(reaction, user, add) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const guildId = reaction.message.guild.id;
  const config = guildConfig.get(guildId);
  if (!config || reaction.message.id !== config.messageId) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);
  if (!role) return;

  add ? member.roles.add(role) : member.roles.remove(role);
}

client.on("messageReactionAdd", (r, u) => handleReaction(r, u, true));
client.on("messageReactionRemove", (r, u) => handleReaction(r, u, false));

/* ================= LOGIN ================= */
client.login(TOKEN);
