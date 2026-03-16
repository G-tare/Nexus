import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const ACTIVITIES: Record<string, string> = {
  youtube: '880218394199220334',
  poker: '755827207812677713',
  chess: '832012774040141894',
  checkers: '832013003968348200',
  fishing: '814288819477020702',
  lettertile: '879863881349087252',
  wordsnack: '879863976006127627',
  sketchheads: '902271654783242291',
  spellcast: '852407645925941288',
  awkword: '879863894351802431',
  puttparty: '763133495793635328',
  blazing8s: '832025144389533716',
  landio: '903769130804957184',
  bobble: '879863942487554058',
  askaway: '976052223358406785',
  knowwhatimeme: '902271654783242291',
};

export default {
  data: new SlashCommandBuilder()
    .setName('discord-activity')
    .setDescription('Start a Discord Activity in voice channel')
    .addStringOption((option) =>
      option
        .setName('game')
        .setDescription('Which activity to start')
        .setRequired(true)
        .addChoices(
          { name: 'YouTube Together', value: 'youtube' },
          { name: 'Poker Night', value: 'poker' },
          { name: 'Chess', value: 'chess' },
          { name: 'Checkers', value: 'checkers' },
          { name: 'Fishing', value: 'fishing' },
          { name: 'Letter Tile', value: 'lettertile' },
          { name: 'Word Snack', value: 'wordsnack' },
          { name: 'Sketchheads', value: 'sketchheads' },
          { name: 'Spellcast', value: 'spellcast' },
          { name: 'Awkword', value: 'awkword' },
          { name: 'Putt Party', value: 'puttparty' },
          { name: 'Blazing 8s', value: 'blazing8s' },
          { name: 'Land.io', value: 'landio' },
          { name: 'Bobble', value: 'bobble' },
          { name: 'Ask Away', value: 'askaway' },
          { name: 'Know What I Meme', value: 'knowwhatimeme' }
        )
    ),

  module: 'fun',
  permissionPath: 'fun.games.activity',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'activity');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before using this again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const game = interaction.options.getString('game', true);
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: 'You must be in a voice channel to start an activity!',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const applicationId = ACTIVITIES[game];

      const invite = await voiceChannel.createInvite({
        targetApplication: applicationId,
        targetType: 2,
        maxAge: 3600,
        maxUses: 0,
      });

      const container = moduleContainer('fun');
      addText(container, `### ${game.toUpperCase()} Activity`);
      addText(container, `[Click here to join the activity](${invite.url})`);
      addFields(container, [{ name: 'Voice Channel', value: voiceChannel.name }]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Activity error:', error);
      await interaction.reply({
        content: 'Failed to create activity invite. Make sure I have permission to manage invites.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'activity', 3);
  },
} as BotCommand;
