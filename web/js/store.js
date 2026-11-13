/*!
 * OptionKiller · store.js
 * 状态持久化：网页用 localStorage；原生壳通过 OptionKillerNative / WKWebView 注入与消息回写。
 */
(function (global) {
  'use strict';

  var C = global.MJZ.core;
  var KEY = 'optionkiller.state.v1';
  var LEGACY_KEY = 'optionkiller.legacy.v1';
  var FAV_DECK_ID = '__favorites__';
  var FAV_DECK_NAME = '总收藏题库';
  var SAVE_DELAY = 250;

  var nativeStore = {
    read: function () {
      try {
        if (global.OptionKillerNative && typeof global.OptionKillerNative.loadState === 'function') {
          var s = global.OptionKillerNative.loadState();
          if (s) return s;
        }
      } catch (e) { /* 原生桥不可用则继续回退 */ }
      try {
        if (typeof global.__OPTIONKILLER_STATE__ === 'string' && global.__OPTIONKILLER_STATE__) {
          return global.__OPTIONKILLER_STATE__;
        }
      } catch (e2) { /* ignore */ }
      try {
        var cur = global.localStorage.getItem(KEY);
        if (cur) return cur;
        // 兼容更名前的旧数据，首次读取后由下一次保存写入新 key
        return global.localStorage.getItem(LEGACY_KEY);
      } catch (e3) {
        return null;
      }
    },
    write: function (json) {
      try { global.localStorage.setItem(KEY, json); } catch (e) { /* file:// 下可能禁写 */ }
      try {
        if (global.OptionKillerNative && typeof global.OptionKillerNative.saveState === 'function') {
          global.OptionKillerNative.saveState(json);
        }
      } catch (e2) { /* ignore */ }
      try {
        var w = global.webkit;
        if (w && w.messageHandlers && w.messageHandlers.optionkillerState) {
          w.messageHandlers.optionkillerState.postMessage(json);
        }
      } catch (e3) { /* ignore */ }
    }
  };

  function sampleCards() {
    return C.parseText('一，单项选择题（单选/A型题）\n1.以下哪个是 JavaScript 的数组方法？()\nA. map\nB. SELECT\nC. mkdir\nD. println\nE. chmod\n答案：A\n解析：map 为数组中的每个元素执行指定函数，并返回一个新数组。\n考点：数组与集合\n二，多项选择题（多选/X型题）\n2.以下哪些属于常见的 Web 浏览器？()\nA. Safari\nB. Chrome\nC. Firefox\nD. SQLite\nE. Gradle\n答案：ABC\n解析：Safari、Chrome、Firefox 是浏览器；SQLite 是数据库，Gradle 是构建工具。\n考点：Web 基础').cards;
  }

  function freshState() {
    var now = Date.now();
    var deckId = C.uid();
    var cards = sampleCards().map(function (item) {
      return Object.assign({}, item, {
        id: C.uid(),
        deckId: deckId,
        term: item.term,
        def: item.def,
        createdAt: now,
        srs: C.newSrs(now),
        highlights: []
      });
    });
    return {
      version: 3,
      createdAt: now,
      activeDeckId: deckId,
      decks: [{ id: deckId, name: '示例题库 · 选择题入门', createdAt: now, sample: true }],
      cards: cards,
      stats: freshStats(now),
      settings: { dailyNew: 0, fontScale: 'm', revealRadius: 1, highlightStyle: 'marker', highlightColor: 'yellow' }
    };
  }

  function freshStats(now) {
    return {
      day: C.dateKey(now || Date.now()),
      newStudied: 0,
      reviews: 0,
      ratings: { known: 0, fuzzy: 0, unknown: 0 }
    };
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function normalize(state) {
    if (!isPlainObject(state) || !Array.isArray(state.decks) || !Array.isArray(state.cards)) return null;
    var deckIds = new Set();
    state.decks = state.decks.filter(function (d) {
      if (!isPlainObject(d) || typeof d.id !== 'string' || !d.id || deckIds.has(d.id)) return false;
      deckIds.add(d.id);
      d.name = typeof d.name === 'string' && d.name.trim() ? d.name.trim() : '未命名题库';
      d.createdAt = Number(d.createdAt) || Date.now();
      return true;
    });
    if (!state.decks.length) return null;

    state.cards = state.cards.filter(function (c) {
      if (!isPlainObject(c) || typeof c.id !== 'string' || !c.id) return false;
      if (typeof c.term !== 'string' || !c.term.trim() || typeof c.def !== 'string' || !c.def.trim()) return false;
      if (!deckIds.has(c.deckId)) return false;
      try { C.validateQuestion(c); } catch(e) { throw new Error('题库数据异常：' + e.message); }
      c.term = c.term.trim();
      c.def = c.def.replace(/\r\n?/g, '\n').trim();
      c.createdAt = Number(c.createdAt) || Date.now();
      c.srs = Object.assign(C.newSrs(c.createdAt), isPlainObject(c.srs) ? c.srs : {});
      c.fav = c.fav === true;
      c.highlights = Array.isArray(c.highlights)
        ? c.highlights.filter(function (h) {
            return isPlainObject(h) && Number.isFinite(h.start) && Number.isFinite(h.end) &&
              h.end > h.start && h.start >= 0 && typeof h.color === 'string';
          }).map(function (h) {
            var style = h.style;
            if (style !== 'marker' && style !== 'line' && style !== 'wavy') {
              style = h.color === 'underline' ? 'line' : 'marker';
            }
            var color = h.color === 'underline' ? 'yellow' : h.color;
            if (color !== 'yellow' && color !== 'green' && color !== 'pink') color = 'yellow';
            return { start: h.start, end: h.end, color: color, style: style };
          })
        : [];
      return true;
    });

    var validCardIds = new Set(state.cards.map(function (c) { return c.id; }));
    if (state.activeDeckId !== FAV_DECK_ID && !deckIds.has(state.activeDeckId)) {
      state.activeDeckId = state.decks[0].id;
    }
    void validCardIds;

    var today = C.dateKey();
    if (!isPlainObject(state.stats) || state.stats.day !== today) state.stats = freshStats();
    state.stats.newStudied = Number(state.stats.newStudied) || 0;
    state.stats.reviews = Number(state.stats.reviews) || 0;
    state.stats.ratings = Object.assign({ known: 0, fuzzy: 0, unknown: 0 }, state.stats.ratings || {});

    var settings = isPlainObject(state.settings) ? state.settings : {};
    state.settings = {
      dailyNew: Math.max(0, Math.min(200, settings.dailyNew == null ? 0 : (Number(settings.dailyNew) || 0))),
      fontScale: ['s', 'm', 'l'].indexOf(settings.fontScale) >= 0 ? settings.fontScale : 'm',
      revealRadius: [0, 1, 2, 3].indexOf(Number(settings.revealRadius)) >= 0 ? Number(settings.revealRadius) : 1,
      highlightStyle: ['marker', 'line', 'wavy'].indexOf(settings.highlightStyle) >= 0 ? settings.highlightStyle : 'marker',
      highlightColor: ['yellow', 'green', 'pink'].indexOf(settings.highlightColor) >= 0 ? settings.highlightColor : 'yellow'
    };
    var version = Number(state.version) || 1;
    if (version < 2) state.settings.dailyNew = 0;
    if (version < 3) {
      // 旧版按「24 小时后」排期，升级后统一落到当天 0:00，改为每晚刷新
      state.cards.forEach(function (c) {
        if (c.srs && c.srs.state === 'review' && c.srs.due) c.srs.due = C.dayStart(c.srs.due);
      });
    }
    state.version = 3;
    return state;
  }

  function load() {
    var raw = nativeStore.read();
    if (raw) {
      try {
        var parsed = normalize(JSON.parse(raw));
        if (parsed) {
          ensureToday(parsed);
          return parsed;
        }
        throw new Error('本地数据格式不正确');
      } catch (e) {
        throw new Error('本地数据读取失败，原始数据已保留。请先导出浏览器存储备份。' + e.message);
      }
    }
    return freshState();
  }

  function ensureToday(state) {
    var today = C.dateKey();
    if (state.stats.day !== today) {
      state.stats = freshStats();
      return true;
    }
    return false;
  }

  function createStore() {
    var state = load();
    var timer = null;
    var dirty = false;

    function saveNow() {
      if (timer) { clearTimeout(timer); timer = null; }
      dirty = false;
      try {
        nativeStore.write(JSON.stringify(state));
        if (global.dispatchEvent && global.Event) global.dispatchEvent(new global.Event('optionkiller:saved'));
      } catch (e) {
        console.warn('[OptionKiller] 保存失败', e);
      }
    }

    function save() {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(saveNow, SAVE_DELAY);
    }

    function deckCards(deckId) {
      if (deckId === FAV_DECK_ID) return state.cards.filter(function (c) { return c.fav; });
      return state.cards.filter(function (c) { return c.deckId === deckId; });
    }

    function deckById(id) {
      if (id === FAV_DECK_ID) return { id: FAV_DECK_ID, name: FAV_DECK_NAME, virtual: true };
      for (var i = 0; i < state.decks.length; i++) if (state.decks[i].id === id) return state.decks[i];
      return null;
    }

    function activeDeck() {
      return deckById(state.activeDeckId) || state.decks[0] || null;
    }

    function setActiveDeck(id) {
      if (!deckById(id)) return false;
      state.activeDeckId = id;
      save();
      return true;
    }

    function createDeck(name) {
      var now = Date.now();
      var deck = { id: C.uid(), name: (name || '新题库').trim() || '新题库', createdAt: now };
      state.decks.push(deck);
      state.activeDeckId = deck.id;
      save();
      return deck;
    }

    function renameDeck(id, name) {
      var deck = deckById(id);
      name = (name || '').trim();
      if (!deck || !name) return false;
      deck.name = name.slice(0, 60);
      save();
      return true;
    }

    function deleteDeck(id) {
      var idx = state.decks.findIndex(function (d) { return d.id === id; });
      if (idx < 0) return false;
      state.decks.splice(idx, 1);
      state.cards = state.cards.filter(function (c) { return c.deckId !== id; });
      if (!state.decks.length) {
        var deck = { id: C.uid(), name: '新题库', createdAt: Date.now() };
        state.decks.push(deck);
      }
      if (state.activeDeckId === id) state.activeDeckId = state.decks[0].id;
      save();
      return true;
    }

    function addCards(deckId, items) {
      var now = Date.now();
      var added = [];
      var existing = new Set(deckCards(deckId).map(function (c) { return c.term + '\u0001' + c.def; }));
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var key = item.term + '\u0001' + item.def;
        if (existing.has(key)) continue;
        existing.add(key);
        var card = Object.assign({}, C.validateQuestion(Object.assign({}, item)), {
          id: C.uid(),
          deckId: deckId,
          term: item.term.trim(),
          def: item.def.replace(/\r\n?/g, '\n').trim(),
          createdAt: now,
          srs: C.newSrs(now),
          highlights: []
        });
        state.cards.push(card);
        added.push(card);
      }
      if (added.length) save();
      return added;
    }

    /** 整库重写：按名词保留原有卡片（进度、标记不丢），解释就地更新。 */
    function replaceDeckCards(deckId, items) {
      var existing = deckCards(deckId);
      var byTerm = new Map();
      existing.forEach(function (c) {
        if (!byTerm.has(c.term)) byTerm.set(c.term, c);
      });
      var used = new Set();
      var rebuilt = [];
      var now = Date.now();
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var hit = byTerm.get(item.term);
        if (hit && !used.has(hit.id)) {
          used.add(hit.id);
          var changed = hit.def !== item.def;
          Object.assign(hit, C.validateQuestion(Object.assign({}, item)));
          if (changed) { hit.srs = C.newSrs(now); delete hit.lastAttempt; hit.wrong = false; hit.attempts = 0; hit.correctCount = 0; hit.highlights = []; }
          rebuilt.push(hit);
        } else {
          rebuilt.push(Object.assign({}, C.validateQuestion(Object.assign({}, item)), {
            id: C.uid(),
            deckId: deckId,
            term: item.term,
            def: item.def,
            createdAt: now,
            srs: C.newSrs(now),
            highlights: []
          }));
        }
      }
      state.cards = state.cards.filter(function (c) { return c.deckId !== deckId; }).concat(rebuilt);
      save();
      return rebuilt.length;
    }

    function replaceState(raw) {
      var next = normalize(raw);
      if (!next) throw new Error('云端数据格式不正确');
      ensureToday(next);
      state = next;
      saveNow();
      return state;
    }

    function resetDeckProgress(deckId) {
      var now = Date.now();
      var count = 0;
      for (var i = 0; i < state.cards.length; i++) {
        if (deckId === FAV_DECK_ID ? state.cards[i].fav : state.cards[i].deckId === deckId) {
          state.cards[i].progressUpdatedAt=now;
          state.cards[i].srs = C.newSrs(now);
          delete state.cards[i].lastAttempt; delete state.cards[i].draft; state.cards[i].wrong=false; state.cards[i].attempts=0; state.cards[i].correctCount=0;
          count++;
        }
      }
      if (count) save();
      return count;
    }

    function recordRating(rating, isNew) {
      ensureToday(state);
      var s = state.stats;
      s.reviews++;
      if (isNew) s.newStudied++;
      s.ratings[rating] = (s.ratings[rating] || 0) + 1;
      save();
    }

    function newAllowance() {
      var limit = state.settings.dailyNew;
      if (limit === 0) return Infinity;
      return Math.max(0, limit - state.stats.newStudied);
    }

    function findCard(id) {
      for (var i = 0; i < state.cards.length; i++) if (state.cards[i].id === id) return state.cards[i];
      return null;
    }

    // 退回到后台/关闭页面时立即落盘
    global.addEventListener('pagehide', saveNow);
    global.addEventListener('visibilitychange', function () {
      if (global.document.visibilityState === 'hidden') saveNow();
    });

    return {
      state: state,
      getState: function () { return state; },
      save: save,
      replaceState: replaceState,
      saveNow: saveNow,
      deckCards: deckCards,
      deckById: deckById,
      activeDeck: activeDeck,
      setActiveDeck: setActiveDeck,
      createDeck: createDeck,
      renameDeck: renameDeck,
      deleteDeck: deleteDeck,
      addCards: addCards,
      replaceDeckCards: replaceDeckCards,
      resetDeckProgress: resetDeckProgress,
      recordRating: recordRating,
      newAllowance: newAllowance,
      findCard: findCard,
      ensureToday: function () {
        var changed = ensureToday(state);
        if (changed) save();
        return changed;
      },
      isDirty: function () { return dirty; },
      FAV_DECK_ID: FAV_DECK_ID,
      FAV_DECK_NAME: FAV_DECK_NAME
    };
  }

  global.MJZ = global.MJZ || {};
  global.MJZ.store = {
    create: createStore,
    freshState: freshState,
    KEY: KEY,
    LEGACY_KEY: LEGACY_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
