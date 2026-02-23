import { Router, Request, Response } from 'express';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
const logger = createModuleLogger('Forms');
import {
  getFormById,
  submitFormResponse,
  validateAnswers,
  checkUserFormSubmissions,
  checkFormResponseCount,
  getFormConfig,
} from '../helpers';
import { generateFormHTML } from './formPage';
import { emitFormSubmitted } from '../events';
import { Client } from 'discord.js';

const router = Router();

// Initialize with Discord client - will be passed in
let discordClient: Client;

export function initializeFormRoutes(client: Client): void {
  discordClient = client;
}

// GET /forms/:guildId/:formId - Serve form page
router.get('/:guildId/:formId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const formId = req.params.formId as string;

    // Get form from database
    const form = await getFormById(formId);

    if (!form || form.guildId !== guildId) {
      return res.status(404).json({ message: 'Form not found' });
    }

    if (!form.isActive) {
      return res.status(403).json({ message: 'This form is currently closed' });
    }

    // Get guild info from Discord
    let guildInfo = {
      name: 'Unknown Server',
      iconUrl: undefined as string | undefined,
      color: '#5865F2',
    };

    try {
      const guild = await discordClient.guilds.fetch(guildId);
      guildInfo = {
        name: guild.name,
        iconUrl: guild.iconURL({ size: 256 }) || undefined,
        color: '#5865F2',
      };
    } catch (error) {
      logger.warn(`[Forms] Could not fetch guild info for ${guildId}:`, error);
    }

    // Generate HTML
    const html = generateFormHTML(form, guildInfo);

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('[Forms] GET form page error:', error);
    res.status(500).json({ message: 'An error occurred while loading the form' });
  }
});

// POST /forms/:guildId/:formId - Submit form response
router.post('/:guildId/:formId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params.guildId as string;
    const formId = req.params.formId as string;
    const answers = req.body;

    // Validate guild and form
    const form = await getFormById(formId);

    if (!form || form.guildId !== guildId) {
      return res.status(404).json({ message: 'Form not found' });
    }

    if (!form.isActive) {
      return res.status(403).json({ message: 'This form is currently closed' });
    }

    // Check max responses
    if (form.maxResponses) {
      const currentCount = await checkFormResponseCount(formId);
      if (currentCount >= form.maxResponses) {
        return res.status(403).json({ message: 'This form has reached its maximum number of responses' });
      }
    }

    // Get user ID from headers or session (assuming you set this in middleware)
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      return res.status(401).json({ message: 'User identification required' });
    }

    // Check one-per-user constraint
    if (form.onePerUser) {
      const existingResponses = await checkUserFormSubmissions(formId, userId);
      if (existingResponses > 0) {
        return res.status(403).json({
          message: 'You have already submitted a response to this form',
        });
      }
    }

    // Validate answers
    const validation = validateAnswers(answers, form.questions);
    if (!validation.valid) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    // Store response
    const response = await submitFormResponse(formId, userId, answers);

    // Send to review channel
    try {
      const channel = await discordClient.channels.fetch(form.responseChannelId);
      if (channel && channel.isTextBased()) {
        const userTag = (await discordClient.users.fetch(userId).catch(() => null))?.tag || `User ${userId}`;

        const embed = {
          title: `New Form Response: ${form.name}`,
          color: 0x5865f2,
          fields: [
            {
              name: 'User',
              value: userTag,
              inline: true,
            },
            {
              name: 'User ID',
              value: userId,
              inline: true,
            },
            {
              name: 'Response ID',
              value: response.id,
              inline: false,
            },
            {
              name: 'Submitted',
              value: `<t:${Math.floor(response.submittedAt.getTime() / 1000)}:f>`,
              inline: false,
            },
            {
              name: 'Answers',
              value: `\`\`\`json\n${JSON.stringify(response.answers, null, 2).substring(0, 1024)}\n\`\`\``,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        };

        await (channel as any).send({ embeds: [embed as any] });
      }
    } catch (error) {
      logger.error(`[Forms] Failed to send response to channel ${form.responseChannelId}:`, error);
    }

    // DM user confirmation if enabled
    if (form.dmConfirm) {
      try {
        const user = await discordClient.users.fetch(userId);
        const dmEmbed = {
          title: `✅ Form Submitted: ${form.name}`,
          color: 0x00ff00,
          description: 'Your response has been received and is being reviewed.',
          fields: [
            {
              name: 'Response ID',
              value: response.id,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        };

        await user.send({ embeds: [dmEmbed as any] });
      } catch (error) {
        logger.warn(`[Forms] Failed to send DM confirmation to user ${userId}:`, error);
      }
    }

    // Emit event
    await emitFormSubmitted(formId, userId, guildId, response);

    res.status(200).json({
      message: 'Response submitted successfully',
      responseId: response.id,
    });
  } catch (error) {
    logger.error('[Forms] POST form submission error:', error);
    res.status(500).json({ message: 'An error occurred while submitting the form' });
  }
});

export default router;
