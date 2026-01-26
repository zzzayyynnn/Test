const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
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

const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

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

let reactionMessageId = null;

client.once("ready", async () => {
  console.log(`${client.user.tag} is online`);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_ID);

  // CREATE ROLES IF NOT EXIST
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

  // EMBED CONTENT (MENTIONED ROLES)
  const description = Object.entries(reactionRoles)
    .map(([emoji, roleName]) => {
      return `${emoji} → ${roleMap[roleName]}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🌀 Portal Dungeon Roles")
    .setDescription(description)
    .setColor("Purple")
    .setFooter({ text: "React to get your dungeon role" });

  const message = await channel.send({ embeds: [embed] });
  reactionMessageId = message.id;

  // ADD REACTIONS
  for (const emoji of Object.keys(reactionRoles)) {
    await message.react(emoji);
  }
});

// ADD ROLE
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  if (reaction.message.id !== reactionMessageId) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const role = guild.roles.cache.find(r => r.name === roleName);

  if (role) await member.roles.add(role);
});

// REMOVE ROLE
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  if (reaction.message.id !== reactionMessageId) return;

  const roleName = reactionRoles[reaction.emoji.name];
  if (!roleName) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const role = guild.roles.cache.find(r => r.name === roleName);

  if (role) await member.roles.remove(role);
});

client.login(process.env.TOKEN);
