const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { loadConfig, saveConfig } = require("../utils/saveConfig");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Set raid channel for this server")
    .addChannelOption(opt =>
      opt
        .setName("channel")
        .setDescription("Channel where raid posts will appear")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");
    const config = loadConfig();
    config[interaction.guildId] = { raidChannelId: channel.id };
    saveConfig(config);

    await interaction.reply({ content: `✅ Raid channel set to ${channel}`, ephemeral: true });
  },
};
