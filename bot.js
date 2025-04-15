require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Custom emojis (must be uploaded in your server)
const EMOJI_MAP = {
  rumtankard: '<:rumtankard:1361481716610498773>',
  rumbottle: '<:rumbottle:1361481745672962270>',
  rumbarrel: '<:rumbarrel:1361481765939707934>',
  chest: '<:chest:1361481792409964574>',
  nigel: '<:Nigel:1361481810495934474>'
};

// Slot symbols and probabilities
const symbols = [
  { name: 'rumtankard', chance: 0.38, gold: 4, xp: 2 },
  { name: 'rumbottle', chance: 0.27, gold: 7, xp: 3 },
  { name: 'rumbarrel', chance: 0.20, gold: 12, xp: 5 },
  { name: 'chest', chance: 0.12, gold: 18, xp: 7 },
  { name: 'nigel', chance: 0.03, gold: 35, xp: 10, isWild: true }
];

function spinReel() {
  const r = Math.random();
  let sum = 0;
  for (let s of symbols) {
    sum += s.chance;
    if (r <= sum) return s;
  }
  return symbols[symbols.length - 1];
}

function getSymbol(name) {
  return symbols.find(s => s.name === name);
}

const winningLines = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 4, 8], // diagonal
  [2, 4, 6]  // reverse diagonal
];

// Line checker with Nigel substitutions
function checkWinningLines(grid) {
  let gold = 0;
  let xp = 0;

  for (const line of winningLines) {
    const lineSymbols = line.map(i => grid[i]);
    const names = lineSymbols.map(s => s.name);
    const nonNigels = names.filter(n => n !== 'nigel');

    if (names.every(n => n === 'nigel')) {
      const base = getSymbol('nigel');
      gold += base.gold;
      xp += base.xp;
    }
    else if (nonNigels.length > 0 && nonNigels.every(n => n === nonNigels[0])) {
      const base = getSymbol(nonNigels[0]);
      gold += base.gold;
      xp += base.xp;
    }
  }

  return { gold, xp };
}

// Bot ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Handle /spin command
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'spin') {
    const userId = interaction.user.id;
    const userName = interaction.user.username;

    const reels = Array.from({ length: 9 }, spinReel);
    const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
    const gridDisplay =
      `${emojiGrid.slice(0, 3).join(' ')}\n` +
      `${emojiGrid.slice(3, 6).join(' ')}\n` +
      `${emojiGrid.slice(6, 9).join(' ')}`;

    const { gold: totalGold, xp: totalXP } = checkWinningLines(reels);

    const gameLink = `https://doubloon-destiny-nigels-fortune-v01.netlify.app`;

    await interaction.reply({
      content: `🎰 **@${userName} spun the reels!**\n${gridDisplay}\nYou won **${totalGold} Gold** and **${totalXP} XP**!\n\n🎮 [Continue your journey](${gameLink})`,
      flags: 64
    });
    
  }
});

// Register slash command
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const commands = [
  new SlashCommandBuilder().setName('spin').setDescription('Spin the Pirate Ape slot machine!')
];

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash command registered!');
  } catch (error) {
    console.error('Slash command registration failed:', error);
  }
})();

client.login(process.env.DISCORD_TOKEN);
