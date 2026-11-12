/*!
 * OptionKiller · core.js
 * 纯逻辑层：分词/遮挡、点击揭秘范围、题库解析、间隔重复调度、高亮区间运算。
 * 不依赖 DOM，可在 Node 中直接测试（见 src/test/run.mjs）。
 */
(function (global) {
  'use strict';

  var DAY = 86400000;
  var MIN = 60000;

  var RE_PUNCT = /[\p{P}]/u;
  var RE_SPACE = /\s/u;
  var RE_WORD = /[A-Za-z0-9'’\-]/;

  /* ---------------- 字符与回忆遮挡 ---------------- */

  function classifyChar(ch) {
    if (RE_SPACE.test(ch)) return 'space';
    if (RE_PUNCT.test(ch)) return 'punct';
    return 'char';
  }

  function tokenize(text) {
    var chars = Array.from(String(text == null ? '' : text));
    var out = new Array(chars.length);
    for (var i = 0; i < chars.length; i++) {
      out[i] = { i: i, ch: chars[i], type: classifyChar(chars[i]) };
    }
    return out;
  }

  function hiddenCount(text) {
    var tokens = tokenize(text), n = 0;
    for (var i = 0; i < tokens.length; i++) if (tokens[i].type === 'char') n++;
    return n;
  }

  /**
   * 点一次要揭开的字块。
   * 中文等：点击位置 + 前后各一个字（共最多 3 字），作为线索。
   * 英文/数字：按整个连续词揭示，避免逐个字母敲。
   */
  /**
   * 点击某字时要点亮的字位。
   * radius 为向左右各扩展的字数（默认 1）；遇到标点/空白立即停止，绝不跨标点提示。
   * 英文与数字仍按整词揭开，避免只亮出一个字母。
   */
  function revealCluster(text, index, radius) {
    var tokens = tokenize(text);
    var set = new Set();
    if (index < 0 || index >= tokens.length) return set;
    var t = tokens[index];
    if (!t || t.type !== 'char') return set;

    if (RE_WORD.test(t.ch)) {
      var start = index, end = index;
      while (start > 0 && tokens[start - 1].type === 'char' && RE_WORD.test(tokens[start - 1].ch) && index - start < 24) start--;
      while (end < tokens.length - 1 && tokens[end + 1].type === 'char' && RE_WORD.test(tokens[end + 1].ch) && end - index < 24) end++;
      for (var k = start; k <= end; k++) if (tokens[k].type === 'char') set.add(k);
      return set;
    }

    var r = Math.max(0, Math.min(3, Math.round(radius == null ? 1 : Number(radius) || 0)));
    set.add(index);
    var step;
    for (step = 1; step <= r; step++) {
      var left = tokens[index - step];
      if (!left || left.type !== 'char') break;
      set.add(index - step);
    }
    for (step = 1; step <= r; step++) {
      var right = tokens[index + step];
      if (!right || right.type !== 'char') break;
      set.add(index + step);
    }
    return set;
  }

  /** 从某个位置之后（含回退）寻找下一个仍隐藏的字。 */
  function nextHiddenIndex(text, from) {
    var tokens = tokenize(text);
    for (var i = from + 1; i < tokens.length; i++) if (tokens[i].type === 'char') return i;
    for (var j = from - 1; j >= 0; j--) if (tokens[j].type === 'char') return j;
    return -1;
  }

  /* ---------------- 高亮区间（[start, end) 码点下标） ---------------- */

  function normalizeRange(a, b) {
    var start = Math.min(a, b), end = Math.max(a, b) + 1;
    return { start: Math.max(0, start), end: Math.max(0, end) };
  }

  function subtractHighlight(list, start, end) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h.end <= start || h.start >= end) { out.push(h); continue; }
      if (h.start < start) out.push({ start: h.start, end: start, color: h.color, style: h.style });
      if (h.end > end) out.push({ start: end, end: h.end, color: h.color, style: h.style });
    }
    return out;
  }

  /** 覆盖式写入：新标记会切掉与之重叠的旧标记。 */
  function addHighlight(list, start, end, color, style) {
    if (end <= start) return list.slice();
    var trimmed = subtractHighlight(list, start, end);
    trimmed.push({ start: start, end: end, color: color, style: style || 'marker' });
    trimmed.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return trimmed;
  }

  function removeHighlight(list, start, end) {
    return subtractHighlight(list, start, end);
  }

  function highlightAt(list, index) {
    var found = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].start <= index && index < list[i].end) found = list[i];
    }
    return found;
  }

  /* ---------------- 题库解析 ---------------- */

  function dedupe(cards) {
    var seen = new Set();
    return cards.filter(function (c) {
      var key = c.type + '\u0001' + c.term + '\u0001' + c.def;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
  }

  function validateQuestion(q) {
    if (!q || typeof q.term !== 'string' || !q.term.trim()) throw new Error('题干不能为空');
    if (q.term.length > 20000) throw new Error('题干过长');
    if (!['single', 'multi'].includes(q.type)) throw new Error('题型必须为 single 或 multi');
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) throw new Error('每题需要 2–5 个选项（A–E）');
    var labels = q.options.map(function (o, i) {
      if (!o || o.label !== 'ABCDE'[i] || typeof o.text !== 'string') throw new Error('选项须按 A–E 连续排列');
      return o.label;
    });
    if (!Array.isArray(q.answers) || q.answers.some(function (x) { return !labels.includes(x); })) throw new Error('答案必须来自本题选项');
    q.answers = Array.from(new Set(q.answers)).sort();
    if (q.type === 'single' && q.answers.length > 1) throw new Error('单选题只能有一个答案');
    if (q.type === 'multi' && q.answers.length === 1) throw new Error('多选题至少需要两个答案，或留空待补充');
    q.explanation = typeof q.explanation === 'string' ? q.explanation.trim() : '';
    q.section = typeof q.section === 'string' ? q.section : '';
    q.source = typeof q.source === 'string' ? q.source : '自主导入题库';
    q.topic = typeof q.topic === 'string' ? q.topic : '';
    q.difficulty = Math.max(1, Math.min(5, Number(q.difficulty) || 3));
    // def is the canonical lossless representation used by existing sync/share deduplication.
    q.def = q.options.map(function(o) { return o.label + '. ' + o.text; }).join('\n') +
      '\n答案：' + q.answers.join('') + (q.explanation ? '\n解析：' + q.explanation : '') +
      '\n题型：' + q.type + '\n章节：' + q.section + '\n难度：' + q.difficulty + '\n来源：' + q.source + '\n考点：' + q.topic;
    return q;
  }

  function parseText(raw) {
    var text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFKC');
    var type = 'single', section = '', cards = [], current = null, last = '', explanation = false;
    function finish() {
      if (!current) return;
      try { cards.push(validateQuestion(current)); }
      catch(e) { throw new Error('第 ' + current.number + ' 题：' + e.message); }
      current = null;
    }
    var lines = text.split('\n'), answerKey = null;
    for (var k = lines.length - 1; k >= 0; k--) {
      var header = lines[k].trim().match(/^(?:参考答案|正确答案|答案汇总|答案总表|答案)(?:\s*[:：])?\s*(.*)$/);
      if (!header) continue;
      var tail = [header[1]].concat(lines.slice(k + 1)).join('\n').trim();
      if (!/^\d+\s*[.、:：)）]\s*[A-E]/i.test(tail)) continue;
      answerKey = []; var pairs = /(\d+)\s*[.、:：)）]\s*([A-E](?:\s*[,，、;；]?\s*[A-E])*)/gi, m, rest = tail;
      while ((m = pairs.exec(tail))) answerKey.push({number:String(Number(m[1])), answers:m[2].toUpperCase().match(/[A-E]/g)});
      rest = rest.replace(pairs, '').replace(/[\s,，、;；]+/g, '');
      if (rest) throw new Error('答案汇总格式不正确，请按“题号.答案”填写');
      lines = lines.slice(0, k); break;
    }
    lines.forEach(function(rawLine) {
      var line = rawLine.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '');
      if (!line) return;
      if (/^(?:[一二三四五六七八九十]+\s*[,，、.．]\s*)?(?:单项选择题|多项选择题|单选题?|多选题?|A型题?|X型题?)(?=$|[\s(（:：,，、.．/\-])/i.test(line)) {
        finish(); type = /多项|多选|X型/i.test(line) ? 'multi' : 'single'; section = line; return;
      }
      var question = line.match(/^(?:\((\d+)\)|(\d+)\s*[.、)．])\s*(.+)$/);
      if (question) {
        finish();
        var stem = question[3];
        var inline = stem.match(/[（(]\s*([A-E](?:\s*[,，、;；]?\s*[A-E])*)\s*[）)]/i);
        var answers = inline ? inline[1].toUpperCase().match(/[A-E]/g) : [];
        if (inline) stem = stem.replace(inline[0], '()');
        current = { number: question[1] || question[2], term: stem, type: type, section: section,
          options: [], answers: answers, explanation: '' };
        last = ''; explanation = false; return;
      }
      if (!current) return;
      var answer = line.match(/^(?:正确答案|参考答案|答案)\s*[:：]\s*(.*)$/);
      if (answer) {
        var value = answer[1].trim().toUpperCase();
        if (!/^[A-E\s,，、;；]*$/.test(value)) throw new Error('第 ' + current.number + ' 题：答案请只填写 A–E');
        current.answers = value.match(/[A-E]/g) || []; explanation = false; last = ''; return;
      }
      var meta = line.match(/^(解析|解释|题型|章节|难度|来源|考点)\s*[:：]\s*(.*)$/);
      if (meta) {
        var key = {解析:'explanation',解释:'explanation',题型:'type',章节:'section',难度:'difficulty',来源:'source',考点:'topic'}[meta[1]];
        current[key] = meta[2]; explanation = key === 'explanation'; last = ''; return;
      }
      if (explanation) { current.explanation += '\n' + line; return; }
      var re = /(?:^|\s+)([A-E])(?:[.、．:：)）]\s*|\s+|$)/g, matches = Array.from(line.matchAll(re));
      if (matches.length) {
        matches.forEach(function(m,i) {
          var end = i + 1 < matches.length ? matches[i+1].index : line.length;
          current.options.push({label:m[1], text:line.slice(m.index + m[0].length,end).trim()});
          last = m[1];
        });
      } else if (last) {
        current.options[current.options.length-1].text += '\n' + line;
      } else if (!/每题|不得分|第一组|第.+组/.test(line)) { current.term += '\n' + line; }
    });
    finish();
    var keyOccurrences = {}, keyCounts = {}, cardsByNumber = {};
    if (answerKey) cards.forEach(function(card) { var number=String(Number(card.number)); (cardsByNumber[number] || (cardsByNumber[number]=[])).push(card); });
    if (answerKey) answerKey.forEach(function(entry) { keyCounts[entry.number]=(keyCounts[entry.number] || 0)+1; });
    if (answerKey) answerKey.forEach(function(entry) {
      var matches = cardsByNumber[entry.number] || [], count = keyCounts[entry.number];
      if (!matches.length || (matches.length > 1 && matches.length !== count)) throw new Error('答案汇总中第 ' + entry.number + ' 题的题号不存在或不唯一，请先检查题号');
      var offset = keyOccurrences[entry.number] || 0;
      keyOccurrences[entry.number] = offset + 1;
      var card = matches.length === 1 ? matches[0] : matches[offset], answers = Array.from(new Set(entry.answers)).sort();
      if (card.answers.length && card.answers.join('') !== answers.join('')) throw new Error('第 ' + entry.number + ' 题的答案与答案汇总冲突');
      card.answers = answers;
      try { validateQuestion(card); } catch(e) { throw new Error('答案汇总第 ' + entry.number + ' 题：' + e.message); }
    });
    return {cards:dedupe(cards), skipped:[]};
  }

  function parseJSON(raw) {
    var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    var items = Array.isArray(data) ? data : data && data.cards;
    if (!Array.isArray(items)) throw new Error('JSON 需要数组或 {name,cards:[...]}');
    return {name:data.name || '', cards:dedupe(items.map(function(item) {
      return validateQuestion(Object.assign({}, item, {
        term:item.term || item.question || '', type:item.type || 'single', answers:item.answers || []
      }));
    })), skipped:[]};
  }

  function parseImport(raw, nameHint) {
    var text = String(raw || '').trim();
    if (!text) throw new Error('内容为空');
    if (text.length > 8000000) throw new Error('题库内容超过 8MB');
    var result = /^[\[{]/.test(text) ? parseJSON(text) : parseText(text);
    if (!result.cards.length) throw new Error('没有识别到选择题，请使用「1.题干」和 A–E 选项');
    return {name:nameHint || result.name || '导入题库', cards:result.cards, skipped:result.skipped};
  }

  function questionText(cards) {
    var previous = null;
    return cards.map(function(c,i) {
      var heading = c.type !== previous ? (c.type === 'multi' ? '二，多项选择题（多选/X型题）\n' : '一，单项选择题（单选/A型题）\n') : '';
      previous = c.type;
      return heading + (i+1) + '.' + c.term + '\n' + c.def;
    }).join('\n\n');
  }

  function customEndpoints(raw) {
    var url;
    try { url = new URL(String(raw || '').trim()); } catch (e) { throw new Error('请输入完整的自定义模型地址'); }
    if (url.username || url.password || url.search || url.hash) throw new Error('模型地址不能包含账号、密码、查询参数或片段');
    var loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('自定义地址需使用 HTTPS，本机回环地址可使用 HTTP');
    var path = url.pathname.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
    var base = url.origin + path;
    return {chat:base + '/chat/completions', models:base + '/models'};
  }

  function optionState(card, label, selected, revealed, memorize) {
    if (!revealed || !card.answers.length) return '';
    if (card.answers.includes(label)) return card.type === 'multi' && !memorize && !selected ? 'incorrect' : 'correct';
    return selected ? 'incorrect' : '';
  }

  function grade(card, selected) {
    if (!card.answers.length) return null;
    var mine = Array.from(new Set(selected)).sort();
    return mine.length === card.answers.length && mine.every(function(x,i) { return x === card.answers[i]; });
  }

  function swipeDirection(dx, dy) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return 0;
    return dx < 0 ? 1 : -1;
  }

  function clampFraction(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
  }

  function normalizeScratchBoxes(items, legacyText) {
    var source = Array.isArray(items) ? items : typeof legacyText === 'string' && legacyText ? [{text:legacyText,x:0.08,y:0.2}] : [];
    var ids = new Set();
    return source.filter(function(item) { return item && typeof item === 'object'; }).map(function(item) {
      var id = typeof item.id === 'string' && item.id && !ids.has(item.id) ? item.id : uid();
      ids.add(id);
      return {id:id,text:typeof item.text === 'string' ? item.text : '',x:clampFraction(item.x),y:clampFraction(item.y)};
    });
  }

  /* ---------------- 间隔重复 ---------------- */

  function dayStart(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // 从 ts 当天 0:00 起算，加 n 天后的 0:00；用于「每晚 0:00 刷新」的日级排期
  function addDays(ts, n) {
    var d = new Date(ts == null ? Date.now() : ts);
    d.setDate(d.getDate() + n);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function newSrs(now) {
    return {
      state: 'new',
      due: now || Date.now(),
      interval: 0,
      ease: 2.3,
      reps: 0,
      lapses: 0,
      last: null,
      lastAt: 0
    };
  }

  /**
   * 三级评级调度：
   *  熟悉   → 进入 review，间隔按 ease 增长（1 天起步，上限 365 天）
   *  不熟悉 → learning，20 分钟后再出现，间隔减半，ease 略降
   *  不认识 → learning，10 分钟后再出现，间隔清零，ease 明显下降
   */
  function rate(srs, rating, now) {
    var s = Object.assign({}, newSrs(now), srs || {});
    now = now || Date.now();
    s.reps = (s.reps || 0) + 1;
    s.last = rating;
    s.lastAt = now;

    if (rating === 'known') {
      s.ease = Math.min(2.9, (s.ease || 2.3) + 0.06);
      if (s.state === 'review' && s.interval >= 1) {
        s.interval = Math.min(365, Math.max(s.interval + 1, Math.round(s.interval * s.ease)));
      } else {
        s.interval = 1;
      }
      s.state = 'review';
      s.due = addDays(now, s.interval);
    } else if (rating === 'fuzzy') {
      s.ease = Math.max(1.3, (s.ease || 2.3) - 0.12);
      s.interval = s.state === 'review' ? Math.max(0.5, s.interval * 0.5) : 0.3;
      s.state = 'learning';
      s.due = now + 20 * MIN;
    } else if (rating === 'unknown') {
      s.ease = Math.max(1.3, (s.ease || 2.3) - 0.25);
      s.interval = 0;
      s.state = 'learning';
      s.lapses = (s.lapses || 0) + 1;
      s.due = now + 10 * MIN;
    } else {
      throw new Error('未知评级：' + rating);
    }
    return s;
  }

  function isNewCard(card) { return !card.srs || card.srs.state === 'new'; }
  function isDue(card, now) {
    return !!card.srs && card.srs.state !== 'new' && card.srs.due <= (now || Date.now());
  }
  function dueCount(cards, now) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) if (isDue(cards[i], now)) n++;
    return n;
  }
  function newCount(cards) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) if (isNewCard(cards[i])) n++;
    return n;
  }

  /* ---------------- 云端合并 ---------------- */

  // 登录后本机与云端都有数据时不弹窗选择：云端为底，把本机新增并入，再整体推回云端。
  // 题库按 id 或同名归并，词条按 id 或「名词 + 解释」归并；并到同一条时收藏、划线取并集，
  // 复习进度取更靠后的一份，释义用本机（当前设备）的。
  function cardKeyOf(card) { return card.deckId + '\u0001' + card.term + '\u0001' + card.def; }

  function laterSrs(a, b) {
    if (!a) return b;
    if (!b) return a;
    var la = Number(a.lastAt) || 0, lb = Number(b.lastAt) || 0;
    if (la !== lb) return lb > la ? b : a;
    return (Number(b.reps) || 0) > (Number(a.reps) || 0) ? b : a;
  }

  function cardTouched(card) {
    if (!card) return false;
    if (card.fav === true) return true;
    if (Array.isArray(card.highlights) && card.highlights.length) return true;
    return !!(card.srs && card.srs.state && card.srs.state !== 'new');
  }

  function mergeState(local, remote) {
    local = local && typeof local === 'object' ? local : {};
    remote = remote && typeof remote === 'object' ? remote : {};
    var remoteDecks = Array.isArray(remote.decks) ? remote.decks : [];
    var remoteCards = Array.isArray(remote.cards) ? remote.cards : [];
    var localDecks = Array.isArray(local.decks) ? local.decks : [];
    var localCards = Array.isArray(local.cards) ? local.cards : [];

    var decks = [];
    var deckById = new Map();
    var deckByName = new Map();

    function addDeck(deck) {
      var copy = Object.assign({}, deck);
      decks.push(copy);
      deckById.set(copy.id, copy);
      if (typeof copy.name === 'string' && !deckByName.has(copy.name)) deckByName.set(copy.name, copy);
      return copy;
    }

    remoteDecks.forEach(function (deck) {
      if (deck && typeof deck.id === 'string' && deck.id) addDeck(deck);
    });

    var deckRemap = new Map();
    localDecks.forEach(function (deck) {
      if (!deck || typeof deck.id !== 'string' || !deck.id) return;
      var hit = deckById.get(deck.id) ||
        (typeof deck.name === 'string' ? deckByName.get(deck.name) : null);
      if (hit) { deckRemap.set(deck.id, hit.id); return; }
      // 换设备登录时，别把本机没动过的示例题库并进云端
      if (deck.sample === true && remoteCards.length) {
        var used = localCards.some(function (card) {
          return card && card.deckId === deck.id && cardTouched(card);
        });
        if (!used) return;
      }
      deckRemap.set(deck.id, addDeck(deck).id);
    });

    var cards = [];
    var cardById = new Map();
    var cardByKey = new Map();

    function addCard(card) {
      var copy = Object.assign({}, card, {
        fav: card.fav === true,
        highlights: Array.isArray(card.highlights) ? card.highlights.slice() : []
      });
      cards.push(copy);
      cardById.set(copy.id, copy);
      cardByKey.set(cardKeyOf(copy), copy);
      return copy;
    }

    function combine(target, mine) {
      if (typeof mine.term === 'string' && mine.term) target.term = mine.term;
      if (typeof mine.def === 'string' && mine.def) target.def = mine.def;
      target.fav = target.fav === true || mine.fav === true;
      var seen = new Set(target.highlights.map(function (h) {
        return [h.start, h.end, h.color, h.style].join(':');
      }));
      (Array.isArray(mine.highlights) ? mine.highlights : []).forEach(function (h) {
        if (!h || typeof h !== 'object') return;
        var key = [h.start, h.end, h.color, h.style].join(':');
        if (seen.has(key)) return;
        seen.add(key);
        target.highlights.push(h);
      });
      if (mine.options) ['type','options','answers','explanation','section','source','topic','difficulty'].forEach(function(k) { target[k] = mine[k]; });
      if ((mine.lastAttempt && mine.lastAttempt.at || 0) > (target.lastAttempt && target.lastAttempt.at || 0)) {
        target.lastAttempt = mine.lastAttempt; target.wrong = mine.wrong; target.attempts = mine.attempts; target.correctCount = mine.correctCount;
      }
      if ((mine.noteUpdatedAt || 0) > (target.noteUpdatedAt || 0)) { target.note = mine.note; target.noteUpdatedAt = mine.noteUpdatedAt; }
      if ((mine.scratchUpdatedAt || 0) > (target.scratchUpdatedAt || 0)) {
        target.scratchBoxes = normalizeScratchBoxes(mine.scratchBoxes, mine.scratch); target.scratch = mine.scratch; target.scratchUpdatedAt = mine.scratchUpdatedAt;
      }
      if ((mine.masteredUpdatedAt || 0) > (target.masteredUpdatedAt || 0)) { target.mastered = mine.mastered === true; target.masteredUpdatedAt = mine.masteredUpdatedAt; }
      if ((mine.aiUpdatedAt || 0) > (target.aiUpdatedAt || 0)) { target.aiExplanation=mine.aiExplanation; target.aiMnemonic=mine.aiMnemonic; target.aiSourceDef=mine.aiSourceDef; target.aiAttempted=mine.aiAttempted; target.aiModel=mine.aiModel; target.aiUpdatedAt=mine.aiUpdatedAt; }
      target.srs = laterSrs(target.srs, mine.srs);
    }

    remoteCards.forEach(function (card) {
      if (card && typeof card.id === 'string' && card.id) addCard(card);
    });

    localCards.forEach(function (card) {
      if (!card || typeof card.id !== 'string' || !card.id) return;
      var deckId = deckRemap.get(card.deckId);
      if (!deckId && deckById.has(card.deckId)) deckId = card.deckId;
      if (!deckId) return;
      var mine = Object.assign({}, card, { deckId: deckId });
      var hit = cardById.get(mine.id) || cardByKey.get(cardKeyOf(mine));
      if (!hit) { addCard(mine); return; }
      combine(hit, mine);
    });

    function hasDeck(id) { return decks.some(function (d) { return d.id === id; }); }
    var activeDeckId = deckRemap.get(local.activeDeckId) || local.activeDeckId;
    if (activeDeckId !== '__favorites__' && !hasDeck(activeDeckId)) {
      activeDeckId = hasDeck(remote.activeDeckId) ? remote.activeDeckId : (decks[0] && decks[0].id);
    }

    return {
      version: Math.max(Number(local.version) || 0, Number(remote.version) || 0, 3),
      createdAt: Number(local.createdAt) || Number(remote.createdAt) || Date.now(),
      activeDeckId: activeDeckId,
      decks: decks,
      cards: cards,
      stats: local.stats || remote.stats,
      settings: local.settings || remote.settings
    };
  }

  /* ---------------- 时间/杂项 ---------------- */

  function dateKey(d) {
    d = d ? new Date(d) : new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function formatDue(ts, now) {
    now = now || Date.now();
    var diff = ts - now;
    if (diff <= 0) return '现在';
    if (diff < MIN) return '马上';
    if (diff < 60 * MIN) return Math.max(1, Math.round(diff / MIN)) + ' 分钟后';
    if (diff < DAY) return Math.round(diff / 3600000) + ' 小时后';
    if (diff < 2 * DAY) return '明天';
    return Math.round(diff / DAY) + ' 天后';
  }

  function formatDuration(ms) {
    var sec = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m <= 0) return s + ' 秒';
    return m + ' 分 ' + String(s).padStart(2, '0') + ' 秒';
  }

  function uid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') return global.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  global.MJZ = global.MJZ || {};
  global.MJZ.core = {
    DAY: DAY,
    MIN: MIN,
    classifyChar: classifyChar,
    tokenize: tokenize,
    hiddenCount: hiddenCount,
    revealCluster: revealCluster,
    nextHiddenIndex: nextHiddenIndex,
    normalizeRange: normalizeRange,
    addHighlight: addHighlight,
    removeHighlight: removeHighlight,
    subtractHighlight: subtractHighlight,
    highlightAt: highlightAt,
    swipeDirection: swipeDirection,
    clampFraction: clampFraction,
    normalizeScratchBoxes: normalizeScratchBoxes,
    validateQuestion: validateQuestion,
    questionText: questionText,
    grade: grade,
    optionState: optionState,
    customEndpoints: customEndpoints,
    parseText: parseText,
    parseJSON: parseJSON,
    parseImport: parseImport,
    dedupe: dedupe,
    newSrs: newSrs,
    rate: rate,
    isNewCard: isNewCard,
    isDue: isDue,
    dueCount: dueCount,
    newCount: newCount,
    dayStart: dayStart,
    addDays: addDays,
    dateKey: dateKey,
    formatDue: formatDue,
    formatDuration: formatDuration,
    mergeState: mergeState,
    uid: uid
  };
})(typeof window !== 'undefined' ? window : globalThis);
