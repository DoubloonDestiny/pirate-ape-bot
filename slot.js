const symbols = [
  { name: 'toxictankard', chance: 0.30, gold: 0.5, xp: 1 },
  { name: 'rumtankard', chance: 0.25, gold: 1, xp: 2 },
  { name: 'rumbottle', chance: 0.20, gold: 1.5, xp: 3 },
  { name: 'rumbarrel', chance: 0.15, gold: 2, xp: 4 },
  { name: 'chest', chance: 0.05, gold: 5, xp: 7 },
  { name: 'nigel', chance: 0.02, gold: 10, xp: 9, isWild: true }
];


const EMOJI_MAP = {
  toxictankard: '<:toxictankard:1366284249816367174>>',
  rumtankard: '<:rumtankard:1361481716610498773>',
  rumbottle: '<:rumbottle:1361481745672962270>',
  rumbarrel: '<:rumbarrel:1361481765939707934>',
  chest: '<:chest:1361481792409964574>',
  nigel: '<:Nigel:1361481810495934474>'
};


const winningLines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 4, 8], [2, 4, 6]
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

function checkWinningLines(grid, multiplier = 1) {
  let gold = 0;
  let xp = 1; // static 1 XP per spin

  for (const line of winningLines) {
    const lineSymbols = line.map(i => grid[i]);
    const names = lineSymbols.map(s => s.name);
    const nonNigels = names.filter(n => n !== 'nigel');

    if (names.every(n => n === 'nigel')) {
      const base = getSymbol('nigel');
      gold += base.gold * multiplier;
      xp += base.xp;
    } else if (nonNigels.length > 0 && nonNigels.every(n => n === nonNigels[0])) {
      const base = getSymbol(nonNigels[0]);
      gold += base.gold * multiplier;
      xp += base.xp;
    }
  }

  return { gold, xp };
}

module.exports = {
  symbols,
  EMOJI_MAP,
  spinReel,
  getSymbol,
  checkWinningLines
};
