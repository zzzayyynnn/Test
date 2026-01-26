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

/* ===================== ENV CHECK ===================== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ Missing ENV variables (TOKEN / CLIENT_ID / GUILD_ID)");
  process.exit(1);
}

/* ===================== CLIENT ===================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ===================== DATA ===================== */
let SELFROLE_CHANNEL_ID = null;
let SELFROLE_MESSAGE_ID = null;

const reactionRoles = {
  "🐶": "Igris Portal Dungeon",
  "🐱": "Elves Portal Dungeon",
  "🦅": "Infernal Portal Dungeon",
  "🦉": "Insect Portal Dungeon",
  "🐺": "Goblin Portal Dungeon",
  "🐹": "Subway Portal Dungeon",
  "👹": "Demon Castle Portal"
};

/* ===================== SLASH COMMANDS ===================== */
const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set channel for self-role embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt
        .setName("channel")
        .setDescription("Channel for self role")
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
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Slash command register failed:", err);
  }
})();

/* ===================== READY ===================== */
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ===================== INTERACTIONS ===================== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;

  /* ---------- /setchannel ---------- */
  if (interaction.commandName === "setchannel") {
    const channel = interaction.options.getChannel("channel");
    SELFROLE_CHANNEL_ID = channel.id;

    return interaction.reply({
      content: `✅ Self-role channel set to ${channel}`,
      ephemeral: true
    });
  }

  /* ---------- /selfrole ---------- */
  if (interaction.commandName === "selfrole") {
    if (!SELFROLE_CHANNEL_ID) {
      return interaction.reply({
        content: "❌ Please set channel first using /setchannel",
        ephemeral: true
      });
    }

    const channel = await guild.channels.fetch(SELFROLE_CHANNEL_ID);

    // CREATE ROLES
    const roleMap = {};
    for (const roleName of Object.values(reactionRoles)) {
      let role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        role = await guild.roles.create({
          name: roleName,
          reason: "Reaction Role Auto Create"
        });
      }
      roleMap[roleName] = role;
    }

    // EMBED
    const description = Object.entries(reactionRoles)
      .map(([emoji, roleName]) => `${emoji} → ${roleMap[roleName]}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🌀 Portal Dungeon Roles")
      .setDescription(description)
      .setColor("Purple")
      .setFooter({ text: "React to get your dungeon role" });

    const message = await channel.send({ embeds: [embed] });
    SELFROLE_MESSAGE_ID = message.id;

    for (const emoji of Object.keys(reactionRoles)) {
      await message.react(emoji);
    }

    return interaction.reply({
      content: "✅ Self-role embed sent successfully!",
      ephemeral: true
    });
  }
});

/* ===================== REACTION ADD ===================== */
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  if (reaction.message.id !== SELFROLE_MESSAGE_ID) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);

  if (role) await member.roles.add(role);
});

/* ===================== REACTION REMOVE ===================== */
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  if (reaction.message.id !== SELFROLE_MESSAGE_ID) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);

  if (role) await member.roles.remove(role);
});

/* ===================== LOGIN ===================== */
client.login(TOKEN);
