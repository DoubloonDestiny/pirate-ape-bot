require('dotenv').config(); 
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./db');
const slot = require('./slot');

db.initDatabase();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const EMOJI_MAP = {
  toxictankard: '<:toxictankard:1366284249816367174>',
  rumtankard: '<:rumtankard:1361481716610498773>',
  rumbottle: '<:rumbottle:1361481745672962270>',
  rumbarrel: '<:rumbarrel:1361481765939707934>',
  chest: '<:chest:1361481792409964574>',
  nigel: '<:Nigel:1361481810495934474>'
};

const lastBets = {};
const pendingBonusSpins = {}; // Tracks bonus spins per user

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !(interaction.isButton() && ['repeat_spin', 'repeat_bet', 'start_bonus_spins'].includes(interaction.customId))) return;
  const userId = interaction.user.id;

  if (interaction.commandName === 'spin' || (interaction.isButton() && interaction.customId === 'repeat_spin')) {
    const userName = interaction.user.username;
    const cost = 1000;
    db.getUserProfile(userId, (err, profile) => {
      if (err || profile.gold < cost) {
        return interaction.reply({ content: `❌ You need at least ${cost} Gold to spin!`, ephemeral: true });
      }
      db.addGold(userId, -cost);
      const reels = Array.from({ length: 9 }, slot.spinReel);
      const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
      const gridDisplay = `${emojiGrid.slice(0, 3).join(' ')}\n${emojiGrid.slice(3, 6).join(' ')}\n${emojiGrid.slice(6, 9).join(' ')}`;
      const { gold, xp } = slot.checkWinningLines(reels, cost);
      const boost = db.getGoldBoost(profile.level);
      const boostedGold = Math.round(gold * (1 + boost / 100));

      const nigelCount = reels.filter(s => s.name === 'nigel').length;
      if (nigelCount >= 1) {
        pendingBonusSpins[userId] = { count: 3, betAmount: cost };
      }

      db.addGold(userId, boostedGold);
      db.addXP(userId, xp);
      db.getUserProfile(userId, (err, updatedProfile) => {
        const progress = db.getXPProgressBar(updatedProfile.xp, updatedProfile.level);
        const title = db.getTitle(updatedProfile.level);
        const newBoost = db.getGoldBoost(updatedProfile.level);
        const gameLink = `https://doubloon-destiny-nigels-fortune-v01.netlify.app`;

        let bonusNotice = '';
        let bonusComponents = [];

        if (pendingBonusSpins[userId]) {
          bonusNotice = `\n\ud83c\udf89 Nigel appeared! You have **${pendingBonusSpins[userId].count} Bonus Spins** ready!`;
          bonusComponents.push(
            new ButtonBuilder()
              .setCustomId('start_bonus_spins')
              .setLabel('\ud83c\udff1 Start Bonus Spins')
              .setStyle(ButtonStyle.Success)
          );
        }

        const components = [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('repeat_spin')
              .setLabel('\ud83d\udd04 Spin Again')
              .setStyle(ButtonStyle.Primary),
            ...bonusComponents
          )
        ];

        const responseContent = `\ud83c\udfb0 **@${userName} spun the reels!**\n${gridDisplay}\n\ud83c\udfc5 Title: ${title}\n\ud83d\udd22 Level: ${updatedProfile.level}\n\ud83d\udcb0 Gold Boost: +${newBoost.toFixed(2)}%\n\ud83d\udcca XP: ${progress}\nYou spent **${cost.toLocaleString()} Gold**, won **${boostedGold.toLocaleString()} Gold** and **${xp} XP**.\n\ud83d\udcb0 New Balance: **${updatedProfile.gold.toLocaleString()} Gold**\n\n\ud83c\udfae [Continue your journey](${gameLink})${bonusNotice}`;

        interaction.reply({ content: responseContent, components: components, ephemeral: true });
      });
    });
    return;
  }

  if (interaction.commandName === 'bet' || (interaction.isButton() && interaction.customId === 'repeat_bet')) {
    let amount, quantity;
    if (interaction.commandName === 'bet') {
      amount = interaction.options.getInteger('amount');
      quantity = interaction.options.getInteger('quantity') || 1;
      lastBets[userId] = { amount, quantity };
    } else {
      if (!lastBets[userId]) {
        return interaction.reply({ content: '\u274C No previous bet found!', ephemeral: true });
      }
      ({ amount, quantity } = lastBets[userId]);
    }

    if (quantity > 5) {
      return interaction.reply({ content: `\u274C You can only bet up to 5 spins at a time!`, ephemeral: true });
    }
    if (amount > 100000) {
      return interaction.reply({ content: `\u274C Maximum bet per spin is 100,000 Gold!`, ephemeral: true });
    }
    const totalCost = amount * quantity;
    db.getUserProfile(userId, (err, profile) => {
      if (err || profile.gold < totalCost) {
        return interaction.reply({ content: `\u274C You need at least ${totalCost.toLocaleString()} Gold to bet ${amount.toLocaleString()} for ${quantity} spin(s)!`, ephemeral: true });
      }
      db.addGold(userId, -totalCost);
      let totalGold = 0;
      let totalXP = 0;
      let allDisplays = [];
      for (let i = 0; i < quantity; i++) {
        const reels = Array.from({ length: 9 }, slot.spinReel);
        const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
        const gridDisplay = `${emojiGrid.slice(0, 3).join(' ')}\n${emojiGrid.slice(3, 6).join(' ')}\n${emojiGrid.slice(6, 9).join(' ')}`;
        const { gold, xp } = slot.checkWinningLines(reels, amount);
        const boost = db.getGoldBoost(profile.level);
        const boostedGold = Math.round(gold * (1 + boost / 100));

        const nigelCount = reels.filter(s => s.name === 'nigel').length;
        if (nigelCount >= 1) {
          if (pendingBonusSpins[userId]) {
            pendingBonusSpins[userId].count += 3;
          } else {
            pendingBonusSpins[userId] = { count: 3, betAmount: amount };
          }
        }

        totalGold += boostedGold;
        totalXP += xp;
        allDisplays.push(`\ud83c\udfb0 Spin ${i + 1}:\n${gridDisplay}`);
      }
      db.addGold(userId, totalGold);
      db.addXP(userId, totalXP);
      db.getUserProfile(userId, (err, updatedProfile) => {
        const progress = db.getXPProgressBar(updatedProfile.xp, updatedProfile.level);
        const title = db.getTitle(updatedProfile.level);
        const boost = db.getGoldBoost(updatedProfile.level);

        let bonusNotice = '';
        let bonusComponents = [];

        if (pendingBonusSpins[userId]) {
          bonusNotice = `\n\ud83c\udf89 Nigel appeared! You have **${pendingBonusSpins[userId].count} Bonus Spins** ready!`;
          bonusComponents.push(
            new ButtonBuilder()
              .setCustomId('start_bonus_spins')
              .setLabel('\ud83c\udff1 Start Bonus Spins')
              .setStyle(ButtonStyle.Success)
          );
        }

        const components = [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('repeat_bet')
              .setLabel('\ud83d\udd04 Spin Again')
              .setStyle(ButtonStyle.Primary),
            ...bonusComponents
          )
        ];

        interaction.reply({
          content: `${allDisplays.join('\n\n')}\n\n\ud83c\udfc5 Title: ${title}\n\ud83d\udd22 Level: ${updatedProfile.level}\n\ud83d\udcb0 Gold Boost: +${boost.toFixed(2)}%\n\ud83d\udcca XP: ${progress}\nYou spent **${totalCost.toLocaleString()} Gold**, won a total of **${totalGold.toLocaleString()} Gold** and **${totalXP} XP**.\n\ud83d\udcb0 New Balance: **${updatedProfile.gold.toLocaleString()} Gold**${bonusNotice}`,
          components: components,
          ephemeral: true
        });
      });
    });
    return;
  }

 // Start Bonus Spins
 if (interaction.isButton() && interaction.customId === 'start_bonus_spins') {
  const bonusData = pendingBonusSpins[userId];
  if (!bonusData) {
    return interaction.reply({ content: '❌ You have no bonus spins!', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true }); // 🛡️ Safely defer the reply early

  let totalGold = 0;
  let totalXP = 0;
  let spinCount = 0;
  let messageBatch = [];
  let firstReply = true;

  db.getUserProfile(userId, async (err, profile) => {
    const boost = db.getGoldBoost(profile.level);

    while (bonusData.count > 0) {
      bonusData.count--;
      spinCount++;

      const reels = Array.from({ length: 9 }, slot.spinReel);
      const emojiGrid = reels.map(s => EMOJI_MAP[s.name]);
      const gridDisplay = `${emojiGrid.slice(0, 3).join(' ')}\n${emojiGrid.slice(3, 6).join(' ')}\n${emojiGrid.slice(6, 9).join(' ')}`;
      const { gold, xp } = slot.checkWinningLines(reels, bonusData.betAmount);
      const boostedGold = Math.round(gold * (1 + boost / 100));

      const nigelCount = reels.filter(s => s.name === 'nigel').length;
      if (nigelCount >= 1) {
        bonusData.count += 3;
        if (bonusData.count > 100) bonusData.count = 100;
        messageBatch.push(`🎰 Bonus Spin ${spinCount}:\n${gridDisplay}\n🐦 Nigel appeared! +3 more bonus spins!`);
      } else {
        messageBatch.push(`🎰 Bonus Spin ${spinCount}:\n${gridDisplay}`);
      }

      totalGold += boostedGold;
      totalXP += xp;

      if (messageBatch.length >= 4 || bonusData.count === 0) {
        const messageContent = messageBatch.join('\n\n');
        if (firstReply) {
          await interaction.editReply({ content: messageContent });
          firstReply = false;
        } else {
          await interaction.followUp({ content: messageContent, ephemeral: true });
        }
        messageBatch = [];
      }
    }

    db.addGold(userId, totalGold);
    db.addXP(userId, totalXP);
    db.getUserProfile(userId, (err, updatedProfile) => {
      const progress = db.getXPProgressBar(updatedProfile.xp, updatedProfile.level);
      const title = db.getTitle(updatedProfile.level);
      const newBoost = db.getGoldBoost(updatedProfile.level);

      delete pendingBonusSpins[userId];

      interaction.followUp({
        content: `🏅 Title: ${title}\n🔢 Level: ${updatedProfile.level}\n💰 Gold Boost: +${newBoost.toFixed(2)}%\n📊 XP: ${progress}\nYou won a total of **${totalGold.toLocaleString()} Gold** and **${totalXP} XP** from your bonus spins!\n💰 New Balance: **${updatedProfile.gold.toLocaleString()} Gold**`,
        ephemeral: true
      });
    });
  });
  return;
}


// Profile Command
if (interaction.commandName === 'profile') {
  db.getUserProfile(userId, (err, profile) => {
    if (err) return interaction.reply({ content: 'Error loading profile.', ephemeral: true });
    const title = db.getTitle(profile.level);
    const xpBar = db.getXPProgressBar(profile.xp, profile.level);
    const boost = db.getGoldBoost(profile.level);

    const avatarUrl = interaction.user.displayAvatarURL({ dynamic: true, size: 512 });

    const embed = {
      color: 0x0099ff,
      author: {
        name: `${interaction.user.username}'s Pirate Profile`,
        icon_url: avatarUrl
      },
      fields: [
        { name: '🏅 Title', value: title, inline: true },
        { name: '🔢 Level', value: `${profile.level}`, inline: true },
        { name: '💰 Gold Boost', value: `+${boost.toFixed(2)}%`, inline: true },
        { name: '📊 XP', value: xpBar, inline: false }
      ],
      image: {
        url: avatarUrl // ✅ Full-size image added here
      }
    };
    

    interaction.reply({ embeds: [embed], ephemeral: true });
  });
}


  // Balance Command
  if (interaction.commandName === 'balance') {
    db.getUserProfile(userId, (err, profile) => {
      if (err) return interaction.reply({ content: 'Error retrieving balance.', ephemeral: true });
      interaction.reply({
        content: `💰 You currently have **${profile.gold.toLocaleString()} Gold**.\n🔢 Level: ${profile.level} | XP: ${profile.xp}`,
        ephemeral: true
      });
    });
  }

  // Leaderboard Command
  if (interaction.commandName === 'leaderboard') {
    db.getLeaderboard((err, rows) => {
      if (err) return interaction.reply({ content: 'Error loading leaderboard.', ephemeral: true });
      const formatted = rows.map((r, i) => `#${i + 1} <@${r.user_id}> — ${r.gold.toLocaleString()} Gold`).join('\n');
      interaction.reply({ content: `🏆 **Top Gold Holders**\n${formatted}`, ephemeral: true });
    });
  }

  // Admin Commands
  if (interaction.commandName === 'admin') {
    if (interaction.user.id !== process.env.ADMIN_ID) return interaction.reply({ content: 'No permission!', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    db.getUserProfile(target.id, (err) => {
      if (err) return interaction.reply({ content: 'Error loading target profile.', ephemeral: true });
      if (sub === 'addgold') {
        db.addGold(target.id, amount);
        return interaction.reply({ content: `✅ Added ${amount.toLocaleString()} gold to ${target.username}`, ephemeral: true });
      }
      if (sub === 'removegold') {
        db.addGold(target.id, -amount);
        return interaction.reply({ content: `✅ Removed ${amount.toLocaleString()} gold from ${target.username}`, ephemeral: true });
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
