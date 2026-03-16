import { BotModule } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';

// Animal commands
import cat from './animals/cat';
import dog from './animals/dog';
import fox from './animals/fox';
import bird from './animals/bird';
import panda from './animals/panda';
import redpanda from './animals/redpanda';

// Meme commands
import drake from './memes/drake';
import meme from './memes/meme';
import wasted from './memes/wasted';
import wanted from './memes/wanted';
import triggered from './memes/triggered';

// Effect commands
import blur from './effects/blur';
import greyscale from './effects/greyscale';
import invert from './effects/invert';
import pixelate from './effects/pixelate';
import mirror from './effects/mirror';

// User commands
import avatar from './user/avatar';
import banner from './user/banner';
import servericon from './user/servericon';

// Staff commands
import imagesConfig from './staff/config';

// Events
import { imagesEvents } from './events';

const logger = createModuleLogger('Images');

export const imagesModule: BotModule = {
  name: 'images',
  displayName: 'Images',
  description: 'Image generation, animal pics, meme templates, and avatar effects',
  category: 'fun',

  commands: [
    // Animals (6)
    cat,
    dog,
    fox,
    bird,
    panda,
    redpanda,
    // Memes (5)
    drake,
    meme,
    wasted,
    wanted,
    triggered,
    // Effects (5)
    blur,
    greyscale,
    invert,
    pixelate,
    mirror,
    // User (3)
    avatar,
    banner,
    servericon,
    // Staff (1)
    imagesConfig,
  ],

  events: imagesEvents,

  async onLoad() {
    logger.info('Images module loaded with 20 commands');
  },

  defaultConfig: {
    enabled: true,
    embedColor: '#3498DB',
    cooldown: 5,
    nsfwAllowed: false,
  },
};

export default imagesModule;
