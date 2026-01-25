const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { ensureRaidRoles, raids } = require("../utils/ensureRoles");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("selfrole")
    .setDescription("Post raid self-role menu"),

  async execute(interaction) {
    const roles = await ensureRaidRoles(interaction.guild);

    const buttons = raids.map(raid =>
      new ButtonBuilder()
        .setCustomId(`raidrole_${roles[raid]}`)
        .setLabel(raid)
        .setStyle(ButtonStyle.Secondary)
    );

    const rows = [];
    while (buttons.length) {
      rows.push(new ActionRowBuilder().addComponents(buttons.splice(0, 5)));
    }

    await interaction.channel.send({
      content: "🎮 **Choose your raid roles:**",
      components: rows,
    });

    await interaction.reply({
      content: "✅ Self-role menu posted!",
      ephemeral: true,
    });
  },
};
