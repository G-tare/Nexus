import { Client } from 'discord.js';
import path from 'path';
import fs from 'fs';
import { BotModule } from '../../../Shared/src/types/command';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('ModuleLoader');

const MODULES_DIR = path.resolve(__dirname, '../../../Modules');

/**
 * Dynamically load all modules from the Modules directory.
 *
 * Each module directory must contain an `index.ts` file that exports
 * a default BotModule object.
 *
 * Directory structure:
 *   Modules/
 *     Moderation/
 *       index.ts        ← Module definition (exports BotModule)
 *       ban/
 *         ban.ts         ← Individual command file
 *         unban.ts
 *         tempban.ts
 *       mute/
 *         mute.ts
 *         unmute.ts
 *       ...
 */
export async function loadModules(client: Client): Promise<void> {
  logger.info(`Loading modules from: ${MODULES_DIR}`);

  if (!fs.existsSync(MODULES_DIR)) {
    logger.warn('Modules directory not found');
    return;
  }

  const moduleDirs = fs.readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalCommands = 0;
  let totalModules = 0;

  for (const dirName of moduleDirs) {
    const modulePath = path.join(MODULES_DIR, dirName);
    const indexPath = path.join(modulePath, 'index.ts');

    // Check if module has an index file
    if (!fs.existsSync(indexPath)) {
      logger.debug(`Skipping ${dirName} (no index.ts)`);
      continue;
    }

    try {
      // Import the module using require() so tsx/cjs hook can transpile .ts files
      // (await import() bypasses the -r tsx/cjs require hook and fails)
      const moduleExport = require(indexPath);
      const botModule: BotModule = moduleExport.default || moduleExport;

      if (!botModule.name || !botModule.commands) {
        logger.warn(`Invalid module: ${dirName} (missing name or commands)`);
        continue;
      }

      // Register all commands
      for (const command of botModule.commands) {
        if (client.commands.has(command.data.name)) {
          logger.warn(`Duplicate command name: ${command.data.name} (from ${dirName})`);
          continue;
        }
        client.commands.set(command.data.name, command);
        totalCommands++;
      }

      // Register context menu commands
      if (botModule.contextMenuCommands) {
        for (const ctxCmd of botModule.contextMenuCommands) {
          client.contextMenuCommands.set(ctxCmd.data.name, ctxCmd);
          totalCommands++;
        }
      }

      // Register the module
      client.modules.set(botModule.name, botModule);
      totalModules++;

      // Call onLoad if defined
      if (botModule.onLoad) {
        await botModule.onLoad();
      }

      logger.info(`Loaded module: ${botModule.displayName} (${botModule.commands.length} commands)`);
    } catch (err: any) {
      logger.error(`Failed to load module: ${dirName}`, { error: err.message, stack: err.stack });
    }
  }

  logger.info(`Module loading complete: ${totalModules} modules, ${totalCommands} commands`);
}
