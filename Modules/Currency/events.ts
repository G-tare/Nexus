import { Events, Message, Client } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getDb } from '../../Shared/src/database/connection';
import { cache } from '../../Shared/src/cache/cacheManager';
import { getCurrencyConfig, addCurrency, removeCurrency, CurrencyType } from './helpers';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { sql } from 'drizzle-orm';

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

				const cooldownKey = `msgcooldown:${message.guildId!}:${message.author.id}`;

				// Check if user is on cooldown
				if (cache.has(cooldownKey)) return;

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
				cache.set(cooldownKey, '1', cooldownSeconds);
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

	// Daily job reset - runs every 5 minutes to check for missed shifts
	setInterval(async () => {
		try {
			const db = getDb();
			const guilds = await db.execute(sql`
				SELECT DISTINCT guild_id FROM user_jobs WHERE is_active = true
			` as any);

			for (const { guild_id } of guilds?.rows || []) {
				const activeJobs = await db.execute(sql`
					SELECT user_id, shifts_completed, shifts_today, last_shift
					FROM user_jobs
					WHERE guild_id = ${guild_id} AND is_active = true
				` as any);

				const now = new Date();
				for (const job of activeJobs?.rows || []) {
					const lastShift = job.last_shift ? new Date(job.last_shift as any) : null;
					const lastShiftDate = lastShift ? new Date(lastShift.getFullYear(), lastShift.getMonth(), lastShift.getDate()) : null;
					const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

					// If last shift was yesterday or earlier, reset shifts_today
					if (!lastShiftDate || lastShiftDate < todayDate) {
						await db.execute(sql`
							UPDATE user_jobs
							SET shifts_today = 0
							WHERE guild_id = ${guild_id} AND user_id = ${job.user_id}
						`);
					}
				}
			}
		} catch (error) {
			logger.error('Error in daily job reset:', error);
		}
	}, 5 * 60 * 1000); // 5 minutes
}
