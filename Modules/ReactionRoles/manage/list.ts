import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import { getReactionRolesConfig } from '../helpers';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-list')
    .setDescription('List all reaction role panels in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-list',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    await interaction.deferReply({});

    try {
      const config = await getReactionRolesConfig(interaction.guildId!);

      if (config.panels.length === 0) {
        return interaction.editReply('❌ No reaction role panels found in this server.');
      }

      const embeds: EmbedBuilder[] = [];
      let currentEmbed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('📋 Reaction Role Panels')
        .setFooter({ text: `Total: ${config.panels.length} panel(s)` });

      let fieldCount = 0;

      for (const panel of config.panels) {
        const channel = await interaction.guild.channels.fetch(panel.channelId).catch(() => null);
        const channelName = channel ? `#${(channel as any).name || 'unknown'}` : 'Unknown Channel';

        const fieldValue = [
          `**ID:** \`${panel.id}\``,
          `**Type:** ${panel.type}`,
          `**Mode:** ${panel.mode}`,
          `**Channel:** ${channelName}`,
          `**Roles:** ${panel.roles.length}`,
          `**Max Roles:** ${panel.maxRoles === 0 ? 'Unlimited' : panel.maxRoles}`,
          `[Jump to Message](https://discord.com/channels/${panel.guildId}/${panel.channelId}/${panel.messageId})`,
        ].join('\n');

        currentEmbed.addFields({
          name: panel.title,
          value: fieldValue,
          inline: false,
        });

        fieldCount++;

        if (fieldCount === 6) {
          embeds.push(currentEmbed);
          currentEmbed = new EmbedBuilder()
            .setColor('#2F3136')
            .setTitle('📋 Reaction Role Panels (continued)');
          fieldCount = 0;
        }
      }

      if (fieldCount > 0) {
        embeds.push(currentEmbed);
      }

      if (embeds.length === 1) {
        return interaction.editReply({ embeds });
      } else {
        // Send multiple messages
        await interaction.editReply({ embeds: [embeds[0]] });
        for (let i = 1; i < embeds.length; i++) {
          await interaction.followUp({
            embeds: [embeds[i]],
          });
        }
      }
    } catch (error) {
      console.error('Error listing panels:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
