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
import { getProfileConfig } from '../helpers';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('profile-config')
    .setDescription('Configure profile module settings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View current settings')
    )
    .addSubcommand((sub) =>
      sub
        .setName('max-items')
        .setDescription('Set max items per list')
        .addIntegerOption((opt) =>
          opt
            .setName('number')
            .setDescription('Max items (1-25)')
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('require-create')
        .setDescription('Require /profile create before editing')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('Enforce creation first').setRequired(true)
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

  module: 'profile',
  permissionPath: 'profile.config',

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
      const config = await getProfileConfig(interaction.guildId!);

      const container = moduleContainer('profile');
      addFields(container, [
        { name: 'Enabled', value: config.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Max Items Per List', value: config.maxListItems.toString(), inline: true },
        { name: 'Require Create First', value: config.requireCreate ? 'Yes' : 'No', inline: true },
        { name: 'Default Embed Color', value: config.embedColor, inline: true },
      ]);

      await interaction.reply(v2Payload([container]));
      return;
    }

    const db = await getDb();

    if (subcommand === 'max-items') {
      const number = interaction.options.getInteger('number', true);

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'profile'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'profile',
          enabled: true,
          config: { maxListItems: number, requireCreate: true, embedColor: '#9B59B6' },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, maxListItems: number },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'profile')
            )
          );
      }

      await interaction.reply({
        content: `✅ Max items per list set to ${number}`,
      });
      return;
    }

    if (subcommand === 'require-create') {
      const enabled = interaction.options.getBoolean('enabled', true);

      const existing = await db
        .select()
        .from(guildModuleConfigs)
        .where(
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'profile'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'profile',
          enabled: true,
          config: { maxListItems: 10, requireCreate: enabled, embedColor: '#9B59B6' },
          updatedAt: new Date(),
        });
      } else {
        const config = (existing[0].config as Record<string, unknown>) || {};
        await db
          .update(guildModuleConfigs)
          .set({
            config: { ...config, requireCreate: enabled },
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(guildModuleConfigs.guildId, interaction.guildId!),
              eq(guildModuleConfigs.module, 'profile')
            )
          );
      }

      await interaction.reply({
        content: `✅ Require create first: ${enabled ? 'Enabled' : 'Disabled'}`,
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
          and(eq(guildModuleConfigs.guildId, interaction.guildId!), eq(guildModuleConfigs.module, 'profile'))
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(guildModuleConfigs).values({
          guildId: interaction.guildId!,
          module: 'profile',
          enabled: true,
          config: { maxListItems: 10, requireCreate: true, embedColor: hex },
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
              eq(guildModuleConfigs.module, 'profile')
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
