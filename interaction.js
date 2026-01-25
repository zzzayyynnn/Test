module.exports = (client) => {
  client.on("interactionCreate", async interaction => {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        await interaction.reply({ content: "❌ Error executing command", ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (!interaction.customId.startsWith("raidrole_")) return;
      const roleId = interaction.customId.split("_")[1];
      const member = interaction.member;

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId);
        await interaction.reply({ content: "❌ Role removed", ephemeral: true });
      } else {
        await member.roles.add(roleId);
        await interaction.reply({ content: "✅ Role added", ephemeral: true });
      }
    }
  });
};
