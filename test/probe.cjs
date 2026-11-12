require(process.argv[2] + '/js/core.js');
const text = '一，单项选择题（单选/A型题）\n1.问题()\nA\nB\nC\nD\nE\n二，多项选择题（多选/X型题）\n1.问题()\nA\nB\nC\nD\nE';
try { const r=global.MJZ.core.parseImport(text); console.log(JSON.stringify({count:r.cards.length,types:r.cards.map(c=>c.type||null),optionCounts:r.cards.map(c=>c.options?.length||0)})); } catch(e) { console.log(e.message); process.exitCode=1; }
