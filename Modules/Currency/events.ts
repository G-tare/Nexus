import { Events, Message, Client } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getRedis } from '../../Shared/src/database/connection';
import { getCurrencyConfig, addCurrency, removeCurrency, CurrencyType } from './helpers';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Currency');

export const currencyEvents: ModuleEvent[] = [
	{ event: Events.MessageCreate,
		once: false,
		handler: async (message: Message) => {
			try {
				// Ignore bots
				if (message.author.bot) return;

				// Only process guild messages
				if (!message.guildId) return;

				const redis = getRedis();
				const cooldownKey = `msgcooldown:${message.guildId!}:${message.author.id}`;

				// Check if user is on cooldown
				const onCooldown = await redis.exists(cooldownKey);
				if (onCooldown) return;

				// Get currency config for this guild
				const config = await getCurrencyConfig(message.guildId!);
				if (!config || !config.messageEarn || config.messageEarn.amount <= 0) {
					return;
				}

				// Add currency
				await addCurrency(
					message.guildId!,
					message.author.id,
					'coins',
					config.messageEarn.amount,
					'message'
				);

				// Set cooldown
				const cooldownSeconds = (config as any).messageCooldown || 60;
				await redis.setex(cooldownKey, cooldownSeconds, '1');
			} catch (error) {
				logger.error('Error processing message earn event:', error);
			}
		}
	}
];

export function setupCurrencyListeners() {
	// Level up bonus
	eventBus.on('levelUp', async (data: any) => {
		try {
			const { userId, guildId } = data;
			const config = await getCurrencyConfig(guildId);

			if (!config || !config.levelUpBonus) return;

			if (config.levelUpBonus.coins > 0) {
				await addCurrency(guildId, userId, 'coins', config.levelUpBonus.coins, 'level_up');
			}

			if (config.levelUpBonus.gems > 0) {
				await addCurrency(guildId, userId, 'gems', config.levelUpBonus.gems, 'level_up');
			}

			logger.info(`Granted level up bonus to ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error('Error processing levelUp event:', error);
		}
	});

	// Birthday bonus
	eventBus.on('birthdayTriggered', async (data: any) => {
		try {
			const { userId, guildId } = data;
			const config = await getCurrencyConfig(guildId);

			if (!config || !config.birthdayBonus) return;

			if (config.birthdayBonus.coins > 0) {
				await addCurrency(guildId, userId, 'coins', config.birthdayBonus.coins, 'birthday');
			}

			if (config.birthdayBonus.gems > 0) {
				await addCurrency(guildId, userId, 'gems', config.birthdayBonus.gems, 'birthday');
			}

			logger.info(`Granted birthday bonus to ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error('Error processing birthdayTriggered event:', error);
		}
	});

	// Game win reward
	eventBus.on('gameWon', async (data: any) => {
		try {
			const { userId, guildId, reward } = data;

			if (!reward || reward <= 0) return;

			await addCurrency(guildId, userId, 'coins', reward, 'game_win');

			logger.info(`Granted game win reward (${reward} coins) to ${userId} in guild ${guildId}`);
		} catch (error) {
			logger.error('Error processing gameWon event:', error);
		}
	});

	// Moderation fine
	eventBus.on('modAction', async (data: any) => {
		try {
			// Moderation fines are not yet implemented in currency config
			return;
		} catch (error) {
			logger.error('Error processing modAction event:', error);
		}
	});
}
