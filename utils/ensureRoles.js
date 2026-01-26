const raids = [
  "Subway",
  "Infernal",
  "Insect",
  "Igris",
  "Demon Castle",
  "Elves",
  "Goblin",
];

async function ensureRaidRoles(guild) {
  const roles = {};
  for (const raid of raids) {
    let role = guild.roles.cache.find(r => r.name === raid);
    if (!role) {
      role = await guild.roles.create({
        name: raid,
        color: "DarkRed",
        reason: "Raid self-role",
      });
    }
    roles[raid] = role.id;
  }
  return roles;
}

module.exports = { ensureRaidRoles, raids };
