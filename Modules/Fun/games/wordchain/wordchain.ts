import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const COMMON_WORDS = new Set([
  'able', 'about', 'above', 'accept', 'account', 'ache', 'acid', 'acre', 'age', 'agree', 'aide', 'aim',
  'air', 'aisle', 'all', 'allow', 'almost', 'alone', 'along', 'alter', 'among', 'amount', 'amuse',
  'anchor', 'ancient', 'angle', 'angry', 'animal', 'ankle', 'annoy', 'answer', 'antenna', 'apple',
  'apply', 'approve', 'april', 'arc', 'arcade', 'arch', 'arctic', 'area', 'argue', 'arise', 'arm',
  'army', 'around', 'arrange', 'arrest', 'arrow', 'art', 'article', 'artist', 'ash', 'ask', 'asleep',
  'aspect', 'asset', 'assist', 'assume', 'asthma', 'ate', 'atom', 'attack', 'attend', 'attitude',
  'attract', 'auction', 'audit', 'august', 'aunt', 'auto', 'autumn', 'avenue', 'average', 'avid',
  'avoid', 'awake', 'award', 'aware', 'away', 'awe', 'awful', 'awkward', 'axe', 'baby', 'back',
  'bad', 'badge', 'bail', 'bait', 'bake', 'balance', 'balcony', 'bald', 'ball', 'band', 'bandage',
  'bang', 'bank', 'banner', 'bare', 'barely', 'barge', 'bark', 'barn', 'base', 'basic', 'basket',
  'bath', 'battle', 'bay', 'beach', 'bead', 'beak', 'beam', 'bean', 'bear', 'beard', 'beast', 'beat',
  'beauty', 'became', 'because', 'become', 'bed', 'bee', 'beef', 'been', 'beer', 'beetle', 'before',
  'began', 'begin', 'behalf', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'bend',
  'beneath', 'benefit', 'berry', 'beside', 'best', 'bet', 'better', 'between', 'beyond', 'bias',
  'bible', 'bicycle', 'bid', 'big', 'bike', 'bind', 'biology', 'bird', 'birth', 'bit', 'bite',
  'black', 'blade', 'blame', 'blank', 'blanket', 'blast', 'bleak', 'bleat', 'blend', 'bless',
  'blind', 'blood', 'blossom', 'blue', 'board', 'boat', 'body', 'boil', 'bold', 'bolt', 'bomb',
  'bone', 'bonus', 'book', 'boom', 'boost', 'border', 'bore', 'born', 'borrow', 'boss', 'bottle',
  'bottom', 'bounce', 'bound', 'bow', 'bowl', 'box', 'boy', 'branch', 'brand', 'brass', 'brave',
  'bread', 'break', 'breed', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brink',
  'brisk', 'broad', 'broke', 'broken', 'bronze', 'brook', 'broom', 'brother', 'brown', 'brush',
  'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk', 'bull', 'bump', 'bunch', 'bundle',
  'bunny', 'burden', 'burger', 'burn', 'burst', 'bus', 'business', 'busy', 'but', 'butter', 'button',
  'buy', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call', 'calm', 'came',
  'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'canoe', 'canvas', 'canyon', 'capable',
  'capacity', 'capital', 'captain', 'car', 'caravan', 'carbon', 'card', 'care', 'career', 'careful',
  'cargo', 'carol', 'carpet', 'carriage', 'carry', 'cart', 'case', 'cash', 'casino', 'castle',
  'casual', 'cat', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave',
  'cease', 'cedar', 'cell', 'cement', 'census', 'century', 'ceramic', 'certain', 'chain', 'chair',
  'chalk', 'challenge', 'chamber', 'champ', 'chance', 'change', 'channel', 'chaos', 'chapter',
  'charge', 'charm', 'chart', 'chase', 'chat', 'cheap', 'cheat', 'check', 'cheek', 'cheer', 'cheese',
  'chef', 'chemical', 'cherry', 'chest', 'chicken', 'chief', 'child', 'chill', 'chimney', 'chin',
  'china', 'choice', 'choose', 'chop', 'chord', 'chrome', 'chronic', 'chunk', 'chunk', 'churn',
  'cigar', 'cinnamon', 'circle', 'circuit', 'circular', 'circulation', 'circumstance', 'cite',
  'city', 'civil', 'claim', 'clamp', 'clan', 'clap', 'clarify', 'claw', 'clay', 'clean', 'clear',
  'cleat', 'cleft', 'clerk', 'clever', 'click', 'client', 'cliff', 'climate', 'climb', 'cling',
  'clinic', 'clip', 'cloak', 'clock', 'clog', 'clone', 'close', 'cloth', 'cloud', 'clown', 'club',
  'cluck', 'clue', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coat', 'cobweb', 'cock', 'code',
  'coffee', 'coil', 'coin', 'coke', 'cold', 'collar', 'collect', 'colon', 'colonel', 'colony',
  'color', 'column', 'combine', 'come', 'comet', 'comfort', 'comic', 'comma', 'command', 'comment',
  'commercial', 'commission', 'commit', 'committee', 'commodity', 'common', 'compact', 'company',
  'compare', 'compass', 'compete', 'complain', 'complete', 'complex', 'comply', 'compose', 'compost',
  'compound', 'comprehensive', 'compress', 'compromise', 'compute', 'computer', 'comrade', 'conceal',
  'concede', 'conceive', 'concentrate', 'concern', 'concert', 'concise', 'conclude', 'concrete',
  'condemn', 'condition', 'conduct', 'cone', 'confess', 'confide', 'confirm', 'conflict', 'conform',
  'confuse', 'congress', 'connect', 'conquer', 'conquest', 'conscience', 'conscious', 'consensus',
  'consent', 'consequence', 'conservative', 'consider', 'consist', 'console', 'consonant', 'conspiracy',
  'constant', 'constitute', 'construct', 'consult', 'consume', 'contact', 'contain', 'contemplate',
  'contemporary', 'contend', 'content', 'context', 'continent', 'continue', 'contract', 'contrast',
  'contribute', 'control', 'controversial', 'controversy', 'convene', 'convenience', 'convenient',
  'convention', 'conversation', 'convert', 'convey', 'convict', 'convince', 'convoke', 'convoy',
  'cook', 'cool', 'coop', 'cooperate', 'coordinate', 'cope', 'copper', 'copy', 'coral', 'cord',
  'core', 'cork', 'corner', 'cornerstone', 'cornet', 'cornmeal', 'corporal', 'corporate', 'corps',
  'corpse', 'corpus', 'corral', 'correct', 'correspond', 'corridor', 'corroborate', 'corrode',
  'corrupt', 'corsage', 'corset', 'cortex', 'cosmetic', 'cosmic', 'cosmopolitan', 'cosmos', 'cost',
  'costume', 'cottage', 'cotton', 'couch', 'cougar', 'cough', 'could', 'council', 'counsel', 'count',
  'counter', 'country', 'county', 'couple', 'coupon', 'courage', 'course', 'court', 'courtship',
  'cousin', 'cove', 'covenant', 'cover', 'covert', 'covet', 'cow', 'coward', 'cower', 'coyote',
  'cozy', 'crab', 'crack', 'cradle', 'craft', 'cram', 'cramp', 'crane', 'crank', 'crash', 'crass',
  'crate', 'crater', 'crave', 'crawl', 'crazy', 'creak', 'cream', 'crease', 'create', 'creature',
  'credence', 'credentials', 'credibility', 'credit', 'creditor', 'credo', 'credulous', 'creek',
  'creep', 'creepy', 'cremation', 'creole', 'creosote', 'crepe', 'crept', 'crescendo', 'crescent',
  'cress', 'crest', 'crestfallen', 'cretaceous', 'cretin', 'crevasse', 'crevice', 'crew', 'crewel',
  'crewman', 'crib', 'cribbage', 'crick', 'cricket', 'crier', 'crime', 'criminal', 'crimson',
  'cringe', 'crinkle', 'crinoline', 'cripple', 'crisis', 'crisp', 'criteria', 'criterion', 'critic',
  'critical', 'criticism', 'criticize', 'critique', 'critter', 'croak', 'crock', 'crockery', 'crocodile',
  'crocus', 'croft', 'crone', 'crony', 'crook', 'crooked', 'croon', 'crop', 'croquet', 'cross',
  'crotch', 'crotchety', 'crouch', 'croup', 'crow', 'crowd', 'crowded', 'crown', 'crucial', 'crucible',
  'crucifixion', 'crucify', 'crude', 'cruel', 'cruelty', 'cruise', 'cruiser', 'crumb', 'crumble',
  'crumbly', 'crummy', 'crumpet', 'crumple', 'crunch', 'crusade', 'crush', 'crust', 'crustacean',
  'crutch', 'crux', 'cry', 'crypt', 'cryptic', 'crystal', 'cube', 'cubic', 'cubicle', 'cuckoo',
  'cucumber', 'cud', 'cuddle', 'cudgel', 'cue', 'cuff', 'cuirass', 'cuisine', 'culde', 'culinary',
  'cull', 'culminate', 'culpability', 'culpable', 'culprit', 'cult', 'cultivate', 'cultivation',
  'cultivator', 'cultural', 'culture', 'cultured', 'culvert', 'cumbersome', 'cumin', 'cumulative',
  'cumulus', 'cunning', 'cup', 'cupboard', 'cupidity', 'cupola', 'cur', 'curable', 'curacao',
  'curate', 'curator', 'curb', 'curd', 'curdle', 'cure', 'curfew', 'curia', 'curious', 'curl',
  'curlew', 'curlicue', 'curly', 'curmudgeon', 'currant', 'currency', 'current', 'currently',
  'curricula', 'curriculum', 'curried', 'curry', 'curse', 'cursive', 'cursory', 'curt', 'curtail',
  'curtain', 'curtly', 'curtness', 'curtsy', 'curvaceous', 'curvature', 'curve', 'curvet', 'cushion',
  'cushy', 'cusp', 'cuspidor', 'cuss', 'cussword', 'custard', 'custodial', 'custodian', 'custody',
  'custom', 'customarily', 'customary', 'customer', 'customs', 'cut', 'cutaneous', 'cutaway', 'cutback',
  'cute', 'cuticle', 'cutlass', 'cutlery', 'cutlet', 'cutoff', 'cutout', 'cutthroat', 'cutting',
  'cuttlebone', 'cuttlefish', 'cycle', 'cyclic', 'cyclist', 'cyclone', 'cyclops', 'cyder', 'cylinder',
  'cylindrical', 'cymbal', 'cynic', 'cynical', 'cynicism', 'cynosure', 'cypher', 'cypress', 'cyst',
  'cytology', 'czar', 'czarina', 'czech', 'dab', 'dabble', 'dace', 'dachshund', 'dad', 'daddy',
  'daffodil', 'daft', 'dagger', 'dahlia', 'daily', 'daintily', 'daintiness', 'dainty', 'dairy',
  'dairymaid', 'dairyman', 'dais', 'daisy', 'dale', 'dalliance', 'dally', 'dalmation', 'dalton',
  'dam', 'damage', 'damask', 'dame', 'damnable', 'damnably', 'damnation', 'damned', 'damning',
  'damnable', 'dammit', 'damp', 'dampen', 'damper', 'dampish', 'dampness', 'damsel', 'damson',
  'dance', 'dancer', 'dandelion', 'dandle', 'dandruff', 'dandy', 'dandyish', 'dane', 'danger',
  'dangerous', 'dangerously', 'dangle', 'dank', 'dankness', 'dapper', 'dapple', 'dappled', 'dare',
  'daredevil', 'darer', 'daring', 'daringly', 'dark', 'darken', 'darkish', 'darkly', 'darkness',
  'darkroom', 'darky', 'darling', 'darn', 'darned', 'darnel', 'darnest', 'darning', 'dart', 'dartboard',
  'darted', 'darter', 'darting', 'dash', 'dashboard', 'dashed', 'dasher', 'dashing', 'dashingly',
  'dastard', 'dastardly', 'data', 'database', 'date', 'dated', 'dateless', 'dateline', 'dater',
  'datework', 'dating', 'dative', 'datum', 'daub', 'daubed', 'daughter', 'daughterly', 'daunt',
  'daunted', 'daunting', 'dauntless', 'dauphin', 'davenport', 'davit', 'dawdle', 'dawdler', 'dawn',
  'dawned', 'dawning', 'daytime', 'daze', 'dazed', 'dazzle', 'dazzled', 'dazzling', 'deacon',
  'deaconess', 'deaconry', 'deactivate', 'dead', 'deaden', 'deadened', 'deadening', 'deadfall',
  'deadhead', 'deadlier', 'deadliest', 'deadline', 'deadlock', 'deadlocked', 'deadly', 'deadpan',
  'deadwood', 'deaf', 'deafen', 'deafened', 'deafening', 'deafly', 'deafness', 'deal', 'dealer',
  'dealership', 'dealing', 'dealt', 'deambulatory', 'dean', 'deanery', 'dear', 'dearer', 'dearest',
  'dearie', 'dearly', 'dearness', 'dearth', 'death', 'deathbed', 'deathblow', 'deathless', 'deathlike',
  'deathly', 'deathwatch', 'debacle', 'debar', 'debarred', 'debarring', 'debark', 'debarked', 'debarking',
  'debase', 'debased', 'debasement', 'debaser', 'debasing', 'debatable', 'debate', 'debated', 'debater',
  'debating', 'debauch', 'debauched', 'debauchee', 'debauchery', 'debauching', 'debenture', 'debilitate',
  'debilitated', 'debilitating', 'debilitation', 'debility', 'debit', 'debited', 'debiting', 'debonair',
  'debonaire', 'deborah', 'debouch', 'debouched', 'debouching', 'deboucher', 'debrided', 'debris',
  'debriding', 'debridement', 'debs', 'debt', 'debtor', 'debug', 'debugged', 'debugger', 'debugging',
  'debunk', 'debunked', 'debunking', 'debut', 'debutante', 'debutants', 'decade', 'decadence',
  'decadent', 'decadently', 'decaf', 'decaffeinated', 'decagon', 'decagonal', 'decahedron', 'decal',
  'decalcify', 'decalcomania', 'decaliter', 'decalogue', 'decamp', 'decamped', 'decamping', 'decameter',
  'decane', 'decant', 'decanted', 'decanter', 'decanting', 'decapitate', 'decapitated', 'decapitating',
  'decapitation', 'decapod', 'decapods', 'decarburize', 'decarburized', 'decarburizing', 'decarbonization',
  'decarbonize', 'decarbonized', 'decarbonizing', 'decarboxy', 'decarbonase', 'decarboxy', 'decarbonize',
  'decathlon', 'decatur', 'decade', 'decadence', 'decadent', 'decaffinate', 'decaffinated',
]);

export default {
  data: new SlashCommandBuilder()
    .setName('wordchain')
    .setDescription('Play Word Chain (multiplayer, 2-8 players)'),

  module: 'fun',
  permissionPath: 'fun.games.wordchain',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'wordchain');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const gameContainer = moduleContainer('fun');
    addText(gameContainer, '### Word Chain Game');
    addText(gameContainer, 'Starting a new game! React with ✋ to join (max 8 players, need at least 2).\nJoin window: 30 seconds');

    const msg = await interaction.reply({ ...v2Payload([gameContainer]), fetchReply: true });
    await msg.react('✋');

    try {
      const reactions = await msg.awaitReactions({
        filter: (reaction) => reaction.emoji.name === '✋',
        time: 30000,
      });

      const players = Array.from(reactions.first()?.users.cache.values() || [])
        .filter(user => !user.bot)
        .slice(0, 8);

      if (players.length < 2) {
        const failContainer = moduleContainer('fun');
        addText(failContainer, '### Game Cancelled');
        addText(failContainer, 'Need at least 2 players to start!');
        await interaction.editReply(v2Payload([failContainer]));
        await setCooldown(interaction.guildId!, interaction.user.id, 'wordchain', 3);
        return;
      }

      let activePlayers = new Map(players.map((p) => [p.id, true]));
      let currentWord = 'APPLE';
      let currentPlayerIndex = 0;

      const gameStartContainer = moduleContainer('fun');
      addText(gameStartContainer, '### Word Chain Game - Started!');
      addText(gameStartContainer, `Players: ${players.map((p) => p.username).join(', ')}\n\nCurrent Word: **${currentWord}**\nCurrent Player: ${players[currentPlayerIndex].username}\n\nWord must start with: **${currentWord[currentWord.length - 1]}**`);

      await interaction.editReply(v2Payload([gameStartContainer]));

      while (activePlayers.size > 1) {
        const currentPlayer = players[currentPlayerIndex];

        try {
          const filter = (m: any) => m.author.id === currentPlayer.id;
          const collected = await (interaction.channel as TextChannel).awaitMessages({
            filter,
            max: 1,
            time: 15000,
          });

          if (collected.size === 0) {
            activePlayers.delete(currentPlayer.id);
            const eliminatedContainer = moduleContainer('fun');
            addText(eliminatedContainer, `${currentPlayer.username} took too long! Eliminated.`);
            await interaction.followUp(v2Payload([eliminatedContainer]));
          } else {
            const userMsg = collected.first();
            const word = userMsg!.content.toUpperCase().trim();

            if (!word || word === currentWord || !/^[A-Z]+$/.test(word) || !COMMON_WORDS.has(word.toLowerCase())) {
              activePlayers.delete(currentPlayer.id);
              const invalidContainer = moduleContainer('fun');
              addText(invalidContainer, `${currentPlayer.username}: Invalid word! Eliminated.`);
              await interaction.followUp(v2Payload([invalidContainer]));
            } else if (word[0] !== currentWord[currentWord.length - 1]) {
              activePlayers.delete(currentPlayer.id);
              const wrongStartContainer = moduleContainer('fun');
              addText(wrongStartContainer, `${currentPlayer.username}: Word must start with **${currentWord[currentWord.length - 1]}**! Eliminated.`);
              await interaction.followUp(v2Payload([wrongStartContainer]));
            } else {
              currentWord = word;
              const validContainer = moduleContainer('fun');
              addText(validContainer, `${currentPlayer.username} said: **${word}**`);
              await interaction.followUp(v2Payload([validContainer]));
            }
          }
        } catch (error) {
          activePlayers.delete(currentPlayer.id);
          const timeoutContainer = moduleContainer('fun');
          addText(timeoutContainer, `${currentPlayer.username} took too long! Eliminated.`);
          await interaction.followUp(v2Payload([timeoutContainer]));
        }

        do {
          currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
        } while (!activePlayers.has(players[currentPlayerIndex].id) && activePlayers.size > 0);
      }

      const winner = Array.from(activePlayers.keys()).find((id) => players.some((p) => p.id === id));
      const winnerUser = players.find((p) => p.id === winner);

      const winContainer = moduleContainer('fun');
      addText(winContainer, '### Game Over!');
      addText(winContainer, `**${winnerUser?.username}** wins!`);
      await interaction.followUp(v2Payload([winContainer]));
    } catch (error) {
      console.error('Word Chain error:', error);
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'wordchain', 3);
  },
} as BotCommand;
