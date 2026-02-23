import { ModuleEvent } from '../../Shared/src/types/command';
import { Events, MessageReaction, User, ButtonInteraction, StringSelectMenuInteraction, Message } from 'discord.js';
import { eventBus } from '../../Shared/src/events/eventBus';
import {
  getPanelByMessage,
  getReactionRolesConfig,
  handleRoleToggle,
  logRoleAction,
  saveReactionRolesConfig,
  getPanelById,
} from './helpers';

export const reactionRolesEvents: ModuleEvent[] = [
  { event: Events.MessageReactionAdd,
    once: false,
    handler: async (reaction: MessageReaction, user: User) => {
      if (user.bot) return;

      try {
        const panel = await getPanelByMessage(reaction.message.id);
        if (!panel) return;

        const member = await reaction.message.guild?.members.fetch(user.id);
        if (!member) return;

        // Find role by emoji
        const roleItem = panel.roles.find(r => r.emoji === reaction.emoji.toString());
        if (!roleItem) {
          await reaction.users.remove(user.id);
          return;
        }

        const error = await handleRoleToggle(member, panel, roleItem.roleId, true);
        if (error) {
          await reaction.users.remove(user.id);
          if (panel.dmConfirmation) {
            try {
              await user.send(`❌ Reaction role error: ${error}`);
            } catch {
              // DM failed
            }
          }
        } else {
          const config = await getReactionRolesConfig(panel.guildId);
          await logRoleAction(reaction.message.guild!, config, user.id, roleItem.roleId, 'Added', panel.id);

          if (panel.dmConfirmation) {
            try {
              await user.send(`✅ You received the role <@&${roleItem.roleId}>`);
            } catch {
              // DM failed
            }
          }
        }
      } catch (error) {
        console.error('Error in reactionAddHandler:', error);
      }
    },
  },
  { event: Events.MessageReactionRemove,
    once: false,
    handler: async (reaction: MessageReaction, user: User) => {
      if (user.bot) return;

      try {
        const panel = await getPanelByMessage(reaction.message.id);
        if (!panel) return;

        // Only allow removal in normal mode
        if (panel.mode !== 'normal') {
          return;
        }

        const member = await reaction.message.guild?.members.fetch(user.id);
        if (!member) return;

        const roleItem = panel.roles.find(r => r.emoji === reaction.emoji.toString());
        if (!roleItem) return;

        const error = await handleRoleToggle(member, panel, roleItem.roleId, false);
        if (!error) {
          const config = await getReactionRolesConfig(panel.guildId);
          await logRoleAction(reaction.message.guild!, config, user.id, roleItem.roleId, 'Removed', panel.id);

          if (panel.dmConfirmation) {
            try {
              await user.send(`✅ The role <@&${roleItem.roleId}> was removed`);
            } catch {
              // DM failed
            }
          }
        }
      } catch (error) {
        console.error('Error in reactionRemoveHandler:', error);
      }
    },
  },
  { event: Events.InteractionCreate,
    once: false,
    handler: async (interaction: any) => {
      if (interaction.isButton() && interaction.customId.startsWith('rr_')) {
        try {
          const customIdParts = interaction.customId.split('_');
          const panelId = customIdParts[1];
          const roleId = customIdParts[2];

          const config = await getReactionRolesConfig(interaction.guildId!);
          const panel = getPanelById(config, panelId);

          if (!panel) {
            return interaction.reply({
              content: '❌ Panel not found.',
              ephemeral: true,
            });
          }

          const error = await handleRoleToggle(interaction.member, panel, roleId, true);

          if (error) {
            return interaction.reply({
              content: `❌ ${error}`,
              ephemeral: true,
            });
          }

          await logRoleAction(interaction.guild!, config, interaction.user.id, roleId, 'Added', panelId);

          if (panel.dmConfirmation) {
            try {
              await interaction.user.send(`✅ You received the role <@&${roleId}>`);
            } catch {
              // DM failed
            }
          }

          interaction.reply({
            content: `✅ Updated your role!`,
            ephemeral: true,
          });
        } catch (error) {
          console.error('Error in buttonHandler:', error);
          interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true,
          });
        }
      }

      if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rr_select_')) {
        try {
          const panelId = interaction.customId.replace('rr_select_', '');

          const config = await getReactionRolesConfig(interaction.guildId!);
          const panel = getPanelById(config, panelId);

          if (!panel) {
            return interaction.reply({
              content: '❌ Panel not found.',
              ephemeral: true,
            });
          }

          const selectedRoleIds = interaction.values;

          if (panel.mode === 'unique') {
            // Remove all panel roles first, then add the selected one
            for (const role of panel.roles) {
              if (interaction.member!.roles.cache.has(role.roleId)) {
                await interaction.member!.roles.remove(role.roleId);
              }
            }
            const selectedId = selectedRoleIds[0];
            const error = await handleRoleToggle(interaction.member, panel, selectedId, true);

            if (error) {
              return interaction.reply({
                content: `❌ ${error}`,
                ephemeral: true,
              });
            }

            await logRoleAction(interaction.guild!, config, interaction.user.id, selectedId, 'Added', panelId);
          } else if (panel.mode === 'verify') {
            // One-time assignment - check if they already have any role
            const hasAnyRole = panel.roles.some(r => interaction.member!.roles.cache.has(r.roleId));
            if (hasAnyRole) {
              return interaction.reply({
                content: '❌ You already have a role from this panel.',
                ephemeral: true,
              });
            }

            const selectedId = selectedRoleIds[0];
            const error = await handleRoleToggle(interaction.member, panel, selectedId, true);

            if (error) {
              return interaction.reply({
                content: `❌ ${error}`,
                ephemeral: true,
              });
            }

            await logRoleAction(interaction.guild!, config, interaction.user.id, selectedId, 'Added', panelId);
          } else if (panel.mode === 'drop') {
            // Remove only
            for (const roleId of selectedRoleIds) {
              const error = await handleRoleToggle(interaction.member, panel, roleId, false);
              if (!error) {
                await logRoleAction(interaction.guild!, config, interaction.user.id, roleId, 'Removed', panelId);
              }
            }
          } else {
            // Normal mode - toggle roles
            for (const roleId of selectedRoleIds) {
              const hasRole = interaction.member!.roles.cache.has(roleId);
              const error = await handleRoleToggle(interaction.member, panel, roleId, !hasRole);
              if (!error) {
                const action = hasRole ? 'Removed' : 'Added';
                await logRoleAction(interaction.guild!, config, interaction.user.id, roleId, action, panelId);
              }
            }
          }

          if (panel.dmConfirmation) {
            try {
              const roleNames = selectedRoleIds.map((id: any) => `<@&${id}>`).join(', ');
              await interaction.user.send(`✅ Updated your roles: ${roleNames}`);
            } catch {
              // DM failed
            }
          }

          interaction.reply({
            content: `✅ Updated your roles!`,
            ephemeral: true,
          });
        } catch (error) {
          console.error('Error in selectMenuHandler:', error);
          interaction.reply({
            content: '❌ An error occurred.',
            ephemeral: true,
          });
        }
      }
    },
  },
  { event: Events.MessageDelete,
    once: false,
    handler: async (message: Message) => {
      if (!message.guildId) return;

      try {
        const config = await getReactionRolesConfig(message.guildId!);
        const panelIndex = config.panels.findIndex(p => p.messageId === message.id);

        if (panelIndex !== -1) {
          config.panels.splice(panelIndex, 1);
          await saveReactionRolesConfig(message.guildId!, config);
        }
      } catch (error) {
        console.error('Error in messageDeleteHandler:', error);
      }
    },
  },
];
