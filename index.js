const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let SELFROLE_CHANNEL_ID = null;
let reactionMessageId = null;

/**
 * EMOJI → ROLE NAME
 */
const reactionRoles = {
  "🐶": "Igris Portal Dungeon",
  "🐱": "Elves Portal Dungeon",
  "🦅": "Infernal Portal Dungeon",
  "🦉": "Insect Portal Dungeon",
  "🐺": "Goblin Portal Dungeon",
  "🐹": "Subway Portal Dungeon",
  "👹": "Demon Castle Portal"
};

/* ---------------- SLASH COMMANDS ---------------- */
const commands = [
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("Set channel for self role embed")
    .addChannelOption(opt =>
      opt.setName("channel")
        .setDescription("Channel for self role")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("selfrole")
    .setDescription("Send the self role embed")
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands.map(cmd => cmd.toJSON()) }
  );
  console.log("Slash commands registered");
})();

/* ---------------- READY ---------------- */
client.once("ready", () => {
  console.log(`${client.user.tag} is online`);
});

/* ---------------- INTERACTION ---------------- */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;

  if (interaction.commandName === "setchannel") {
    const channel = interaction.options.getChannel("channel");
    SELFROLE_CHANNEL_ID = channel.id;

    return interaction.reply({
      content: `✅ Self-role channel set to ${channel}`,
      ephemeral: true
    });
  }

  if (interaction.commandName === "selfrole") {
    if (!SELFROLE_CHANNEL_ID)
      return interaction.reply({
        content: "❌ Please set a channel first using /setchannel",
        ephemeral: true
      });

    const channel = await guild.channels.fetch(SELFROLE_CHANNEL_ID);

    // CREATE ROLES
    const roleMap = {};
    for (const roleName of Object.values(reactionRoles)) {
      let role = guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        role = await guild.roles.create({
          name: roleName,
          reason: "Self Role Auto Create"
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
    reactionMessageId = message.id;

    for (const emoji of Object.keys(reactionRoles)) {
      await message.react(emoji);
    }

    return interaction.reply({
      content: "✅ Self-role embed sent!",
      ephemeral: true
    });
  }
});

/* ---------------- REACTION ADD ---------------- */
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.id !== reactionMessageId) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);
  if (role) await member.roles.add(role);
});

/* ---------------- REACTION REMOVE ---------------- */
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.id !== reactionMessageId) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const member = await reaction.message.guild.members.fetch(user.id);
  const role = reaction.message.guild.roles.cache.find(r => r.name === roleName);
  if (role) await member.roles.remove(role);
});

client.login(TOKEN);
