module.exports = (client) => {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "setup") {
      const channel = interaction.options.getChannel("channel");
      const { loadConfig, saveConfig } = require("./saveConfig");

      const config = loadConfig();
      config[interaction.guildId] = { raidChannelId: channel.id };
      saveConfig(config);

      await interaction.reply({
        content: `✅ Raid channel set to ${channel}`,
        ephemeral: true,
      });
    }
  });
};
