require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const db = require('./db');

db.initDatabase();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const EMOJI_MAP = {
  rumtankard: '<:rumtankard:1361481716610498773>',
  rumbottle: '<:rumbottle:1361481745672962270>',
  rumbarrel: '<:rumbarrel:1361481765939707934>',
  chest: '<:chest:1361481792409964574>',
  nigel: '<:Nigel:1361481810495934474>'
};

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
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]
];

function checkWinningLines(grid) {
  let gold = 0;
  let xp = 1; // static 1 XP base per spin

  for (const line of winningLines) {
    const lineSymbols = line.map(i => grid[i]);
    const names = lineSymbols.map(s => s.name);
    const nonNigels = names.filter(n => n !== 'nigel');

    if (names.every(n => n === 'nigel')) {
      const base = getSymbol('nigel');
      gold += base.gold;
      xp += base.xp;
    } else if (nonNigels.length > 0 && nonNigels.every(n => n === nonNigels[0])) {
      const base = getSymbol(nonNigels[0]);
      gold += base.gold;
      xp += base.xp;
    }
  }

  return { gold, xp };
}

module.exports = {
  initDatabase: db.initDatabase,
  getUserProfile: db.getUserProfile,
  addGold: db.addGold,
  addXP: db.addXP,
  getXPProgressBar: db.getXPProgressBar,
  getTitle: db.getTitle,
  getGoldBoost: db.getGoldBoost,
  getLeaderboard: db.getLeaderboard,
  checkWinningLines
};


client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const userId = interaction.user.id;

  if (interaction.commandName === 'spin') {
    const userName = interaction.user.username;
    const cost = 10;
    db.getUserProfile(userId, (err, profile) => {
      if (err || profile.gold < cost) {
        return interaction.reply({ content: `❌ You need at least ${cost} Gold to spin!`, ephemeral: true });
      }
      db.addGold(userId, -cost);
      const reels = Array.from({ length: 9 }, spinReel);
      const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
      const gridDisplay = `${emojiGrid.slice(0, 3).join(' ')}\n${emojiGrid.slice(3, 6).join(' ')}\n${emojiGrid.slice(6, 9).join(' ')}`;
      const { gold, xp } = checkWinningLines(reels, cost);
      db.addGold(userId, gold);
      db.addXP(userId, xp);
      db.getUserProfile(userId, (err, updatedProfile) => {
        const progress = db.getXPProgressBar(updatedProfile.xp, updatedProfile.level);
        const title = db.getTitle(updatedProfile.level);
        const boost = db.getGoldBoost(updatedProfile.level);
        const gameLink = `https://doubloon-destiny-nigels-fortune-v01.netlify.app`;
        interaction.reply({
          content: `🎰 **@${userName} spun the reels!**\n${gridDisplay}\n🏅 Title: ${title}\n🔢 Level: ${updatedProfile.level}\n📊 XP: ${progress}\n💰 Gold Boost: +${boost.toFixed(2)}%\nYou won **${gold} Gold** and **${xp} XP**\n\n🎮 [Continue your journey](${gameLink})`,
          flags: 64
        });
      });
    });
  }

  if (interaction.commandName === 'bet') {
    const amount = interaction.options.getInteger('amount');
    const quantity = interaction.options.getInteger('quantity') || 1;
    if (quantity > 5) {
      return interaction.reply({ content: `❌ You can only bet up to 5 spins at a time!`, ephemeral: true });
    }
    const totalCost = amount * quantity;
    db.getUserProfile(userId, (err, profile) => {
      if (err || profile.gold < totalCost) {
        return interaction.reply({ content: `❌ You need at least ${totalCost} Gold to bet ${amount} for ${quantity} spin(s)!`, ephemeral: true });
      }
      db.addGold(userId, -totalCost);
      let totalGold = 0;
      let totalXP = 0;
      let allDisplays = [];
      for (let i = 0; i < quantity; i++) {
        const reels = Array.from({ length: 9 }, spinReel);
        const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
        const gridDisplay = `${emojiGrid.slice(0, 3).join(' ')}\n${emojiGrid.slice(3, 6).join(' ')}\n${emojiGrid.slice(6, 9).join(' ')}`;
        const { gold, xp } = checkWinningLines(reels, amount);
        totalGold += gold;
        totalXP += xp;
        allDisplays.push(`🎰 Spin ${i + 1}:\n${gridDisplay}`);
      }
      db.addGold(userId, totalGold);
      db.addXP(userId, totalXP);
      db.getUserProfile(userId, (err, updatedProfile) => {
        const progress = db.getXPProgressBar(updatedProfile.xp, updatedProfile.level);
        const title = db.getTitle(updatedProfile.level);
        const boost = db.getGoldBoost(updatedProfile.level);
        interaction.reply({
          content: `${allDisplays.join('\n\n')}\n\n🏅 Title: ${title}\n🔢 Level: ${updatedProfile.level}\n📊 XP: ${progress}\n💰 Gold Boost: +${boost.toFixed(2)}%\nYou won a total of **${totalGold} Gold** and **${totalXP} XP**!`,
          ephemeral: true
        });
      });
    });
  }

  if (interaction.commandName === 'profile') {
    db.getUserProfile(userId, (err, profile) => {
      if (err) return interaction.reply({ content: 'Error loading profile.', ephemeral: true });
      const title = db.getTitle(profile.level);
      const xpBar = db.getXPProgressBar(profile.xp, profile.level);
      const boost = db.getGoldBoost(profile.level);
      interaction.reply({
        content: `🏴‍☠️ **Your Pirate Profile**\n🏅 Title: ${title}\n🔢 Level: ${profile.level}\n📊 XP: ${xpBar}\n💰 Gold Boost: +${boost.toFixed(2)}%`,
        ephemeral: true
      });
    });
  }

  if (interaction.commandName === 'balance') {
    db.getUserProfile(userId, (err, profile) => {
      if (err) return interaction.reply({ content: 'Error retrieving balance.', ephemeral: true });
      interaction.reply({
        content: `💰 You currently have **${profile.gold} Gold**.\n🔢 Level: ${profile.level} | XP: ${profile.xp}`,
        ephemeral: true
      });
    });
  }

  if (interaction.commandName === 'leaderboard') {
    db.getLeaderboard((err, rows) => {
      if (err) return interaction.reply({ content: 'Error loading leaderboard.', ephemeral: true });
      const formatted = rows.map((r, i) => `#${i + 1} <@${r.user_id}> — ${r.gold} Gold`).join('\n');
      interaction.reply({ content: `🏆 **Top Gold Holders**\n${formatted}`, ephemeral: true });
    });
  }

  if (interaction.commandName === 'admin') {
    if (interaction.user.id !== process.env.ADMIN_ID) return interaction.reply({ content: 'No permission!', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    db.getUserProfile(target.id, (err) => {
      if (err) return interaction.reply({ content: 'Error loading target profile.', ephemeral: true });
      if (sub === 'addgold') {
        db.addGold(target.id, amount);
        return interaction.reply({ content: `✅ Added ${amount} gold to ${target.username}`, ephemeral: true });
      }
      if (sub === 'removegold') {
        db.addGold(target.id, -amount);
        return interaction.reply({ content: `✅ Removed ${amount} gold from ${target.username}`, ephemeral: true });
      }
      if (sub === 'addxp') {
        db.addXP(target.id, amount);
        return interaction.reply({ content: `✅ Added ${amount} XP to ${target.username}`, ephemeral: true });
      }
    });
  }
});

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const commands = [
  new SlashCommandBuilder().setName('spin').setDescription('Spin the Pirate Ape slot machine!'),
  new SlashCommandBuilder().setName('bet').setDescription('Place a gold bet for spin(s)')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Gold to bet per spin').setRequired(true))
    .addIntegerOption(opt => opt.setName('quantity').setDescription('Number of spins (max 5)').setRequired(false)),
  new SlashCommandBuilder().setName('profile').setDescription('Check your pirate level and title'),
  new SlashCommandBuilder().setName('balance').setDescription('Check your gold balance'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View top gold holders'),
  new SlashCommandBuilder().setName('admin').setDescription('Admin tools')
    .addSubcommand(cmd =>
      cmd.setName('addgold').setDescription('Add gold to a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Gold amount').setRequired(true))
    )
    .addSubcommand(cmd =>
      cmd.setName('removegold').setDescription('Remove gold from a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Gold amount').setRequired(true))
    )
    .addSubcommand(cmd =>
      cmd.setName('addxp').setDescription('Add XP to a user')
        .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('XP amount').setRequired(true))
    )
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
