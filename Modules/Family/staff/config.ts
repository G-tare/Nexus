import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getDb } from '../../../Shared/src/database/connection';
import { guildModuleConfigs } from '../../../Shared/src/database/models/schema';
import { eq, and } from 'drizzle-orm';
import { getFamilyConfig } from '../helpers';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('family-config')
    .setDescription('Configure family module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-children')
        .setDescription('Set max children per user')
        .addIntegerOption((opt) =>
          opt
            .setName('number')
            .setDescription('Max children (1-20)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('proposal-expiry')
        .setDescription('Set marriage proposal expiry time')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Expiry time in seconds (default: 86400 = 24h)')
            .setMinValue(600)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('color')
        .setDescription('Set default embed color')
        .addStringOption((opt) =>
          opt
            .setName('hex')
            .setDescription('Hex color (#RRGGBB)')
            .setMaxLength(7)
            .setRequired(true)
        )
    ),

  module: 'family',
  permissionPath: 'family.config',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'view') {
      const config = await getFamilyConfig(interaction.guildId!);

      const container = moduleContainer('family');
      addFields(container, [
        { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Max Children', value: config.maxChildren.toString(), inline: true },
        { name: 'Proposal Expiry', value: `${config.proposalExpiry}s`, inline: true },
        { name: 'Allow Self-Adopt', value: config.allowSelfAdopt ? 'Yes' : 'No', inline: true },
        { name: 'Default Embed Color', value: config.embedColor, inline: true },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    const db = await getDb();

    if (subcommand === 'max-children') {
      const number = interaction.options.getInteger('number', true);

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'family'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'family',
          enabled: true,
          config: {
            maxChildren: number,
            proposalExpiry: 86400,
            adoptionExpiry: 86400,
            allowSelfAdopt: false,
            embedColor: '#E91E63',
          },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, maxChildren: number },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'family')
            )
          );
      }

      await interaction.reply({
        content: `✅ Max children set to ${number}`,
      });
      return;
    }

    if (subcommand === 'proposal-expiry') {
      const seconds = interaction.options.getInteger('seconds', true);

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'family'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'family',
          enabled: true,
          config: {
            maxChildren: 10,
            proposalExpiry: seconds,
            adoptionExpiry: 86400,
            allowSelfAdopt: false,
            embedColor: '#E91E63',
          },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, proposalExpiry: seconds, adoptionExpiry: seconds },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'family')
            )
          );
      }

      const hours = Math.round(seconds / 3600);
      await interaction.reply({
        content: `✅ Proposal expiry set to ${hours}h (${seconds}s)`,
      });
      return;
    }

    if (subcommand === 'color') {
      const hex = interaction.options.getString('hex', true);

      const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexRegex.test(hex)) {
        await interaction.reply({
          content: '❌ Invalid hex color. Please use format #RRGGBB',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'family'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'family',
          enabled: true,
          config: {
            maxChildren: 10,
            proposalExpiry: 86400,
            adoptionExpiry: 86400,
            allowSelfAdopt: false,
            embedColor: hex,
          },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, embedColor: hex },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'family')
            )
          );
      }

      await interaction.reply({
        content: `✅ Default embed color set to ${hex}`,
      });
    }
  },
};

export default command;
