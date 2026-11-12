/*!
 * OptionKiller · app.js
 * 界面与交互：评级、逐字回忆、全文高亮、题库导入、排期。
 */
(function () {
  'use strict';

  var C = window.MJZ.core;
  var store = window.MJZ.store.create();
  var S = store.state;

  var APP_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || '1.0';

  var AI_KEY = 'optionkiller.ai.session';
  function aiConfig() { try { return JSON.parse(sessionStorage.getItem(AI_KEY) || 'null'); } catch(e) { return null; } }
  var RATING_LABEL = { known: '回答正确', fuzzy: '待补答案', unknown: '回答错误' };
  var view = {type:'all', category:'all', mastered:'all', mode:'practice', order:'sequence'};
  var RATING_ORDER = ['unknown', 'fuzzy', 'known'];

  /* ---------------- 元素 ---------------- */

  var els = {
    body: document.body,
    deckName: document.getElementById('deckName'),
    deckBtn: document.getElementById('deckBtn'),
    settingsBtn: document.getElementById('settingsBtn'),
    brandHome: document.getElementById('brandHome'),
    brandName: document.getElementById('brandName'),
    studyScreen: document.getElementById('studyScreen'),
    doneScreen: document.getElementById('doneScreen'),
    card: document.getElementById('card'),
    cardCounter: document.getElementById('cardCounter'),
    tocBtn: document.getElementById('tocBtn'),
    favBtn: document.getElementById('favBtn'),
    prevBtn: document.getElementById('prevBtn'),
    cardStatus: document.getElementById('cardStatus'),
    term: document.getElementById('term'),
    answer: document.getElementById('answer'),
    answerTools: document.getElementById('answerTools'),
    ratingBar: document.getElementById('ratingBar'),
    nextRow: document.getElementById('nextRow'),
    sessionFoot: document.getElementById('sessionFoot'),
    toast: document.getElementById('toast'),
    modal: document.getElementById('modal'),
    modalKicker: document.getElementById('modalKicker'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalFoot: document.getElementById('modalFoot'),
    modalActions: document.getElementById('modalActions'),
  };

  /* ---------------- 运行时状态 ---------------- */

  var app = {
    queue: [],
    index: 0,
    current: null,
    phase: 'empty', // prompt | revealed | recall | done
    rating: null,
    revealed: new Set(),
    tokens: [],
    tokenEls: new Map(),
    charEls: new Map(),
    totalUnique: 0,
    ratedIds: new Set(),
    sessionStart: 0,
    counts: { known: 0, fuzzy: 0, unknown: 0 },
    ratingById: {},
    marking: false,
    erasing: false,
    selection: null,
    painted: null,
    dragging: false,
    doneKind: 'rest',
    lastFocused: null,
    toastTimer: null,
    modalOpen: false
  };

  /* ---------------- 工具 ---------------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val == null || val === false) return;
        if (key === 'class') el.className = val;
        else if (key === 'text') el.textContent = val;
        else if (key === 'html') el.innerHTML = val;
        else if (key === 'dataset') Object.keys(val).forEach(function (k) { el.dataset[k] = val[k]; });
        else if (key.slice(0, 2) === 'on') el.addEventListener(key.slice(2), val);
        else if (key === 'disabled' || key === 'hidden' || key === 'checked' || key === 'selected') el[key] = !!val;
        else el.setAttribute(key, val);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child == null || child === false) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c != null && c !== false) el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))); });
      } else {
        el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
      }
    }
    return el;
  }

  function icon(paths, size) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = paths;
    if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
    return svg;
  }

  var ICONS = {
    eyeOff: '<path d="M3 3l14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8.2 4.5A8.9 8.9 0 0 1 10 4.3c4.2 0 7 3.5 7.7 5.7-.3.9-1 2.2-2.2 3.3M5.4 6.2C3.9 7.3 3 8.6 2.6 10c.7 2.2 3.5 5.7 7.7 5.7 1 0 1.9-.2 2.7-.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    pen: '<path d="M12.9 3.6a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4l-8.1 8.1-3.8 1 1-3.8 7.4-8.8Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="m11.6 5.1 3.3 3.3" stroke="currentColor" stroke-width="1.5"/>',
    arrow: '<path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    upload: '<path d="M10 13V3.6M6.4 7.2 10 3.6l3.6 3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.6 12.4v3.2c0 .5.4.9.9.9h11c.5 0 .9-.4.9-.9v-3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    plus: '<path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    trash: '<path d="M4 6h12M8 6V4.4c0-.4.3-.7.7-.7h2.6c.4 0 .7.3.7.7V6M6 6l.7 10c0 .5.4.9.9.9h4.8c.5 0 .9-.4.9-.9L14 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    rename: '<path d="M4 13.8 13.3 4.5a1.4 1.4 0 0 1 2 0l.2.2a1.4 1.4 0 0 1 0 2L6.2 16H4v-2.2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
    eraser: '<path d="m7 13 6.3-6.3a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L12.5 13H7Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 13h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
    underline: '<path d="M6 3.5v5.8a4 4 0 0 0 8 0V3.5M4 16.5h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    spark: '<path d="M10 3.2 11.3 7 15 8.3 11.3 9.6 10 13.4 8.7 9.6 5 8.3 8.7 7 10 3.2Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>'
  };

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    requestAnimationFrame(function () { els.toast.classList.add('show'); });
    if (app.toastTimer) clearTimeout(app.toastTimer);
    app.toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      setTimeout(function () { els.toast.hidden = true; }, 220);
    }, 2200);
  }

  function fmtClock(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function deckCards() {
    var deck = store.activeDeck();
    return deck ? store.deckCards(deck.id) : [];
  }

  function midnightText(ts, now) {
    var days = Math.round((C.dayStart(ts) - C.dayStart(now)) / 86400000);
    if (days <= 0) return '今天 0:00';
    if (days === 1) return '今晚 0:00';
    return days + ' 天后 0:00';
  }

  function nextDueText() {
    var now = Date.now();
    var min = Infinity;
    deckCards().forEach(function (c) {
      if (c.srs && c.srs.state !== 'new' && c.srs.due > now) min = Math.min(min, c.srs.due);
    });
    if (min === Infinity) return '暂无安排';
    if (C.dayStart(min) === min) return midnightText(min, now);
    var base = C.formatDue(min, now);
    return base === '明天' ? '明天 ' + fmtClock(min) : base;
  }

  function nextDueStamp() {
    var now = Date.now();
    var min = Infinity;
    deckCards().forEach(function (c) {
      if (c.srs && c.srs.state !== 'new' && c.srs.due > now) min = Math.min(min, c.srs.due);
    });
    return min;
  }

  /* ---------------- 会话 ---------------- */

  function buildQueue(includeAll) {
    var now = Date.now();
    var cards = filteredCards();
    var deck = store.activeDeck();
    if (deck && deck.virtual) includeAll = true;
    if (includeAll === true) {
      var all = cards.slice().sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      return { due: [], fresh: [], all: all };
    }
    var due = cards.filter(function (c) { return C.isDue(c, now); }).sort(function (a, b) { return a.srs.due - b.srs.due; });
    // 稳定排序：同一批导入的新卡保持原顺序
    var fresh = cards.filter(function (c) { return C.isNewCard(c); }).sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    var allowance = store.newAllowance();
    if (allowance !== Infinity) fresh = fresh.slice(0, allowance);
    return { due: due, fresh: fresh, all: due.concat(fresh) };
  }

  function startSession(includeAll) {
    closeDraft();
    var deck = store.activeDeck();
    if (deck && view.deckId !== deck.id) {view.type='all';view.category='all';view.mastered='all';view.deckId=deck.id;}
    if (!deck) { app.phase = 'done'; app.doneKind = 'empty'; render(); return; }

    var built = buildQueue(includeAll === true);
    var queue = built.all;
    if (view.order === 'random') queue = queue.map(function(c) { return {c:c, r:Math.random()}; }).sort(function(a,b) {return a.r-b.r;}).map(function(x) { return x.c; });
    if (!queue.length) {
      var cardCount = store.deckCards(deck.id).length;
      app.phase = 'done';
      app.doneKind = cardCount === 0 ? 'empty' : 'rest';
      app.current = null;
      app.queue = [];
      app.totalUnique = 0;
      render();
      return;
    }

    app.queue = queue.slice();
    app.index = 0;
    app.totalUnique = queue.length;
    app.ratedIds = new Set();
    app.sessionStart = Date.now();
    app.counts = { known: 0, fuzzy: 0, unknown: 0 };
    app.ratingById = {};
    app.marking = false;
    app.erasing = false;
    app.selection = null;
    app.painted = null;
    presentPrompt(app.queue[0]);
    render();
  }

  function rateCard() {
    if (app.phase !== 'prompt' || !app.current) return;
    var card = app.current;
    if (!app.selected.length) { toast('请先选择答案'); return; }
    var result = C.grade(card, app.selected);
    var rating = result === null ? 'fuzzy' : result ? 'known' : 'unknown';
    var wasNew = C.isNewCard(card);
    card.lastAttempt = { selected:app.selected.slice(), correct:result, at:Date.now() };
    card.attempts = (card.attempts || 0) + 1;
    card.correctCount = (card.correctCount || 0) + (result === true ? 1 : 0);
    card.wrong = result === false;
    delete card.draft;
    card.srs = C.rate(card.srs, rating, Date.now());
    store.recordRating(rating, wasNew);
    app.ratedIds.add(card.id);
    if (app.ratingById[card.id]) app.counts[app.ratingById[card.id]] -= 1;
    app.ratingById[card.id] = rating;
    app.counts[rating] += 1;
    app.rating = rating;
    app.phase = 'revealed';
    store.saveNow();
    render();
    requestAnalysis(card);
  }

  function nextUnratedIndex() {
    var i;
    for (i = app.index + 1; i < app.queue.length; i++) {
      if (!app.ratedIds.has(app.queue[i].id)) return i;
    }
    for (i = 0; i < app.index; i++) {
      if (!app.ratedIds.has(app.queue[i].id)) return i;
    }
    return -1;
  }

  function presentPrompt(card) {
    closeDraft();
    app.current = card;
    app.phase = view.mode === 'memorize' ? 'revealed' : 'prompt';
    app.selected = card.draft && Array.isArray(card.draft.selected) ? card.draft.selected.filter(function(x) { return card.options.some(function(o) {return o.label === x;}); }) : [];
    app.rating = null;
    if (view.mode !== 'memorize' && card.lastAttempt && app.ratedIds.has(card.id)) { app.phase='revealed'; app.selected=card.lastAttempt.selected.slice(); app.rating=app.ratingById[card.id] || null; }
    app.revealed = new Set();
    app.tokens = [];
    app.tokenEls = new Map();
    app.charEls = new Map();
    app.marking = false;
    app.erasing = false;
    app.selection = null;
    app.painted = null;
  }

  function nextCard() {
    if (!app.current) return;
    if (app.index >= app.queue.length-1) { finishSession(); return; }
    app.index++;
    presentPrompt(app.queue[app.index]); render();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function prevCard() {
    if (app.phase === 'done' || app.index <= 0) return;
    app.index -= 1;
    presentPrompt(app.queue[app.index]);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function jumpTo(cardId) {
    var card = null;
    for (var i = 0; i < app.queue.length; i++) {
      if (app.queue[i].id === cardId) { card = app.queue[i]; break; }
    }
    var idx = card ? app.queue.indexOf(card) : -1;
    if (!card) {
      var deckCardsNow = deckCards();
      for (var j = 0; j < deckCardsNow.length; j++) {
        if (deckCardsNow[j].id === cardId) { card = deckCardsNow[j]; break; }
      }
      if (!card) return;
      idx = app.index + 1;
      app.queue.splice(idx, 0, card);
      app.totalUnique = app.queue.length;
    }
    closeModal();
    app.index = idx;
    presentPrompt(card);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restartAll() {
    startSession(true);
  }

  function finishSession() {
    closeDraft();
    app.phase = 'done';
    app.doneKind = 'summary';
    app.current = null;
    render();
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    var deck = store.activeDeck();
    els.deckName.textContent = deck ? deck.name : '未选择题库';
    document.getElementById('memorizeBtn').classList.toggle('active',view.mode==='memorize');
    var slayed = !!(app.current && app.current.mastered);
    document.getElementById('masterBtn').classList.toggle('active',slayed);
    document.getElementById('masterBtn').setAttribute('aria-pressed',String(slayed));
    document.getElementById('masterLabel').textContent = slayed ? '已斩' : '斩题';
    document.getElementById('bottomPrev').disabled = !app.current || app.index<=0;
    ['noteBtn','draftBtn','masterBtn','memorizeBtn','bottomNext'].forEach(function(id){document.getElementById(id).disabled=!app.current;});

    if (app.phase === 'done') {
      els.studyScreen.hidden = true;
      els.doneScreen.hidden = false;
      renderDone();
      return;
    }

    els.studyScreen.hidden = false;
    els.doneScreen.hidden = true;
    renderStudy();
  }

  function renderStudy() {
    var card = app.current;
    if (!card) return;

    var total = app.totalUnique || 1;
    els.cardCounter.textContent = '第 ' + (app.index + 1) + ' / ' + total + ' 题';
    if (els.prevBtn) els.prevBtn.disabled = app.index <= 0;
    els.cardStatus.textContent = card.type === 'multi' ? '多选题－X型题' : '单选题－A型题';
    els.term.textContent = card.term;
    if (els.favBtn) {
      els.favBtn.classList.toggle('on', !!card.fav);
      els.favBtn.setAttribute('aria-pressed', String(!!card.fav));
      els.favBtn.setAttribute('aria-label', (card.fav ? '取消收藏 ' : '收藏 ') + card.term);
    }

    els.ratingBar.hidden = true;
    els.sessionFoot.hidden = true;
    renderAnswer();
    renderNextRow();
  }

  function renderAnswer() {
    els.answer.replaceChildren();
    els.answer.className = 'answer choices';
    els.answerTools.hidden = true;
    if (!app.current) return;
    var card = app.current, revealed = app.phase !== 'prompt', memorize = view.mode === 'memorize';
    var aiValid = !card.aiSourceDef || card.aiSourceDef === card.def;
    var group = h('div', {class:'option-list', role:card.type === 'multi' ? 'group' : 'radiogroup', 'aria-label':'题目选项'});
    card.options.forEach(function(o) {
      var selected = app.selected.includes(o.label), state = C.optionState(card, o.label, selected, revealed, memorize);
      var correct = state === 'correct', wrong = state === 'incorrect';
      var input = h('input', {type:card.type === 'multi' ? 'checkbox' : 'radio', name:'question-options', value:o.label, checked:selected, disabled:revealed, 'aria-label':o.label + '. ' + (o.text || '空选项') + (wrong && !selected ? '，漏选' : '')});
      input.addEventListener('change', function() {
        if (card.type === 'single') app.selected = [o.label];
        else if (input.checked) app.selected.push(o.label);
        else app.selected = app.selected.filter(function(x) {return x !== o.label;});
        card.draft = {selected:app.selected.slice()}; store.save();
        renderAnswer(); renderNextRow();
        var focus = els.answer.querySelector('input[value="' + o.label + '"]'); if(focus) focus.focus();
      });
      group.appendChild(h('label', {class:'option-row' + (selected ? ' selected' : '') + (correct ? ' correct' : '') + (wrong ? ' incorrect' : '')}, input,
        h('span', {class:'option-indicator', 'aria-hidden':'true', text:correct ? '✓' : wrong ? '×' : ''}),
        h('span', {class:'option-label', text:o.label + '. ' + (o.text || '（空选项）')})));
    });
    els.answer.appendChild(group);
    if (!revealed) {
      if (card.type === 'multi') els.answer.appendChild(h('p', {class:'choice-tip', text:'多选题 · 请选择所有正确选项，少选、多选、错选均不得分'}));
      return;
    }
    var result = C.grade(card, app.selected);
    var box = h('div', {class:'answer-analysis'});
    box.appendChild(h('p', {class:'answer-line', text:card.answers.length
      ? '答案：正确答案 ' + card.answers.join('、') + (memorize ? '' : '，我的答案 ' + app.selected.join('、'))
      : '答案：尚未提供正确答案，本题不计入正确率'}));
    if (!memorize) box.appendChild(h('p', {class:'result-message ' + (result === true ? 'success' : result === false ? 'error' : ''), text:result === true ? '回答正确' : result === false ? '回答错误 · 已加入错题本' : '待补答案 · 可在编辑题库中补充'}));
    box.appendChild(h('p', {class:'question-meta', text:'难度：' + '★'.repeat(card.difficulty) + '☆'.repeat(5-card.difficulty)}));
    var attempts = card.attempts || 0;
    box.appendChild(h('p', {class:'question-meta', text:'统计：本人作答 ' + attempts + ' 次，答对 ' + (card.correctCount || 0) + ' 次' }));
    box.appendChild(h('p', {class:'question-meta', text:'来源：' + card.source}));
    els.answer.appendChild(box);
    var analysis = h('div', {class:'analysis-panel'});
    analysis.appendChild(h('h2', {text:'题目解析'}));
    analysis.appendChild(h('p', {text:card.explanation || (aiValid && card.aiExplanation) || (app.aiLoading === card.id ? '正在生成 AI 解析…' : app.aiError && app.aiError.id === card.id ? app.aiError.message : '这道题暂未提供解析，可在题库编辑中添加。')}));
    if (!card.explanation && aiValid && card.aiExplanation) analysis.appendChild(h('p',{class:'import-help',text:'AI 生成，仅供参考，请核对原始资料。'}));
    analysis.appendChild(h('h2',{text:'简记'}));
    analysis.appendChild(h('p',{text:(aiValid && card.aiMnemonic) || (app.aiLoading === card.id ? '正在生成简记…' : app.aiError && app.aiError.id === card.id ? app.aiError.message : '开启自动解析并提交答案后生成。')}));
    if (aiValid && card.aiMnemonic) analysis.appendChild(h('p',{class:'import-help',text:'AI 生成的记忆提示，请结合题目与可靠资料核对。'}));
    if (aiValid && ((card.aiAttempted && (!card.aiMnemonic || !(card.explanation || card.aiExplanation))) || (app.aiError && app.aiError.id === card.id)) && aiConfig() && aiConfig().enabled) analysis.appendChild(h('button',{type:'button',class:'ghost-btn',text:'重试生成解析或简记',onclick:function(){requestAnalysis(card,true);}}));
    if (card.topic) { analysis.appendChild(h('h2', {text:'本题考点'})); analysis.appendChild(h('p', {text:card.topic})); }
    if (card.note) { analysis.appendChild(h('h2', {text:'我的笔记'})); analysis.appendChild(h('p', {text:card.note})); }
    els.answer.appendChild(analysis);
  }

  function customFetch(url, config, body) {
    var controller = new AbortController();
    var timer = setTimeout(function(){controller.abort();},30000);
    var opts = {method:body ? 'POST' : 'GET',headers:{},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal};
    if (config.key) opts.headers.authorization='Bearer ' + config.key;
    if (body) {opts.headers['content-type']='application/json';opts.body=JSON.stringify(body);}
    return fetch(url,opts).then(function(res){
      if (!res.ok) throw new Error('自定义服务返回错误（' + res.status + '），请检查地址、Key 和模型');
      return res.json();
    }).catch(function(e){if(e.name==='AbortError')throw new Error('自定义服务连接超时');if(e instanceof TypeError)throw new Error('连接失败，请检查地址、网络及服务端 CORS 设置');throw e;})
      .finally(function(){clearTimeout(timer);});
  }

  function customAnalysis(config, card, needExplanation) {
    return Promise.resolve().then(function(){
      var urls=C.customEndpoints(config.endpoint);
      var choices=card.options.map(function(o){return o.label + '. ' + o.text;}).join('\n');
      var prompt='用中文答题。' + (needExplanation ? '解析≤100字，说明判断依据；' : '不写解析；') + '简记≤30字，用准确口诀或联想；无答案不猜，存疑说明。只输出JSON：{"e":"解析","m":"简记"}。\n题:' + card.term + '\n选项:\n' + choices + '\n答案:' + (card.answers.join('') || '未知');
      return customFetch(urls.chat,config,{model:config.model,messages:[{role:'user',content:prompt}],max_tokens:384});
    }).then(function(data){
      var text=data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if(typeof text !== 'string' || !text.trim())throw new Error('自定义服务未返回解析内容');
      var raw=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''), parsed;
      try{parsed=JSON.parse(raw);}catch(e){parsed=null;}
      var explanation=parsed && typeof parsed.e==='string' ? parsed.e.trim().slice(0,400) : needExplanation ? raw.slice(0,400) : '';
      var mnemonic=parsed && typeof parsed.m==='string' ? parsed.m.trim().slice(0,120) : !needExplanation ? raw.slice(0,120) : '';
      if(!explanation && !mnemonic)throw new Error('自定义服务未返回解析或简记');
      return {text:explanation,mnemonic:mnemonic};
    });
  }

  function performAnalysis(config, card, needExplanation) {
    if (config.provider === 'custom') return customAnalysis(config,card,needExplanation);
    return fetch((window.OK_API_BASE || '')+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:config.provider,key:config.key,model:config.model,question:card.term,options:card.options,answers:card.answers,needExplanation:needExplanation})})
      .then(function(res){return res.json().then(function(data){if(!res.ok)throw new Error(data.error || 'AI 解析失败');return data;});});
  }

  function requestAnalysis(card, force) {
    var config=aiConfig(), aiValid=!card.aiSourceDef || card.aiSourceDef===card.def;
    if (!config || !config.enabled || (!config.key && config.provider !== 'custom') || !config.model || (!force && aiValid && (card.aiAttempted || ((card.explanation || card.aiExplanation) && card.aiMnemonic))) || app.aiLoading === card.id) return;
    var sourceDef=card.def;
    app.aiLoading=card.id;app.aiError=null;render();
    performAnalysis(config,card,!(card.explanation || (aiValid && card.aiExplanation)))
      .then(function(data){if(store.findCard(card.id)!==card || card.def!==sourceDef)return;if(!card.explanation && (!aiValid || !card.aiExplanation) && data.text)card.aiExplanation=data.text;if(!aiValid)card.aiMnemonic='';if(data.mnemonic)card.aiMnemonic=data.mnemonic;card.aiSourceDef=sourceDef;card.aiAttempted=true;card.aiModel=config.provider + ' / ' + config.model;card.aiUpdatedAt=Math.max(Date.now(),(card.aiUpdatedAt||0)+1);store.save();})
      .catch(function(e){app.aiError={id:card.id,message:e.message || 'AI 解析失败，请检查设置'};})
      .finally(function(){if(app.aiLoading===card.id)app.aiLoading=null;if(app.current && app.current.id===card.id && app.phase==='revealed')render();});
  }

  function renderPrompt() {
    var block = h('div', { class: 'prompt-block' });
    block.appendChild(h('span', { class: 'prompt-icon' }, icon(ICONS.eyeOff)));
    block.appendChild(h('p', { class: 'prompt-title', text: '先别急着看释义' }));
    block.appendChild(h('p', {
      class: 'prompt-sub',
      text: '在心里把这段选择题讲一遍，再选择记忆程度。选「不熟悉」会进入逐字点亮模式。'
    }));
    els.answer.appendChild(block);
  }

  function renderRevealed() {
    var card = app.current;
    els.answer.innerHTML = '';
    els.answerTools.innerHTML = '';
    var built = buildFullText(card.def, card.highlights);
    app.charEls = built.els;
    var textEl = h('div', { class: 'full-text', id: 'fullText' });
    textEl.appendChild(built.frag);
    els.answer.appendChild(textEl);
    if (app.marking || app.erasing) els.answer.classList.add('marking');

    els.answerTools.hidden = false;
    var left = h('div', { class: 'tool-left' });
    left.appendChild(h('button', {
      class: 'tool-chip' + (app.marking ? ' active' : ''),
      id: 'markToggle',
      type: 'button',
      'aria-pressed': app.marking ? 'true' : 'false'
    }, icon(ICONS.pen, 14), '划线标记'));
    left.appendChild(h('button', {
      class: 'tool-chip' + (app.erasing ? ' active' : ''),
      id: 'eraseToggle',
      type: 'button',
      'aria-pressed': app.erasing ? 'true' : 'false'
    }, icon(ICONS.eraser, 14), '擦除'));
    left.appendChild(h('button', {
      class: 'tool-chip',
      id: 'clearMarks',
      type: 'button'
    }, icon(ICONS.trash, 14), '清空标记'));

    var right = h('div', {
      class: 'tool-hint',
      text: app.erasing ? '在标记上滑动即可擦除，再点「擦除」结束'
        : app.marking ? '拖动文字直接划线，再点「划线标记」结束'
        : '标记会保存在本机'
    });
    els.answerTools.appendChild(left);
    els.answerTools.appendChild(right);
  }

  function buildFullText(text, highlights) {
    var chars = Array.from(text);
    var frag = document.createDocumentFragment();
    var els = new Map();
    var sel = app.selection ? C.normalizeRange(app.selection.a, app.selection.b) : null;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (/\s/.test(ch)) {
        frag.appendChild(document.createTextNode(ch));
        continue;
      }
      var span = document.createElement('span');
      span.className = 'c';
      span.dataset.i = String(i);
      span.textContent = ch;
      var mark = C.highlightAt(highlights || [], i);
      if (mark) {
        span.classList.add('hl-' + mark.color);
        span.classList.add('hl-style-' + (mark.style || 'marker'));
      }
      if (sel && i >= sel.start && i < sel.end) span.classList.add('sel');
      frag.appendChild(span);
      els.set(i, span);
    }
    return { frag: frag, els: els };
  }

  function renderRecall() {
    var card = app.current;
    var tokens = C.tokenize(card.def);
    app.tokens = tokens;
    app.tokenEls = new Map();

    var frag = document.createDocumentFragment();
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === 'space') {
        frag.appendChild(document.createTextNode(t.ch));
        continue;
      }
      var span = document.createElement('span');
      span.textContent = t.ch;
      span.dataset.i = String(t.i);
      if (t.type === 'punct') {
        span.className = 'punct';
      } else {
        span.className = 'ph' + (app.revealed.has(t.i) ? ' on' : '');
        if (!app.revealed.has(t.i)) span.setAttribute('aria-hidden', 'true');
        app.tokenEls.set(t.i, span);
      }
      frag.appendChild(span);
    }

    var wrap = h('div', { class: 'recall-wrap' });
    var textEl = h('div', {
      class: 'recall-text',
      id: 'recallText',
      'aria-label': '逐字回忆区：点击空白字块点亮文字，或用「全部显现」一次看全'
    });
    textEl.appendChild(frag);
    wrap.appendChild(textEl);

    var hiddenTotal = C.hiddenCount(card.def);
    var count = h('b', { id: 'recallCount', text: String(app.revealed.size) });
    var hint = h('div', { class: 'recall-hint' });
    var hintText = h('span');
    hintText.appendChild(h('i', { class: 'hint-dot' }));
    hintText.appendChild(document.createTextNode('已点亮 '));
    hintText.appendChild(count);
    hintText.appendChild(document.createTextNode(' / ' + hiddenTotal + ' 字 · 点击字块找回文字'));
    hint.appendChild(hintText);
    hint.appendChild(h('button', {
      class: 'link-btn',
      id: 'revealAll',
      type: 'button',
      text: '全部显现'
    }));
    wrap.appendChild(hint);

    els.answer.appendChild(wrap);
    updateRecallHint();
  }

  function updateRecallHint() {
    var card = app.current;
    if (!card) return;
    var total = C.hiddenCount(card.def);
    var countEl = document.getElementById('recallCount');
    if (countEl) countEl.textContent = String(app.revealed.size);
    var hintText = document.querySelector('.recall-hint span');
    if (hintText) {
      var complete = app.revealed.size >= total;
      hintText.lastChild.textContent = complete
        ? ' · 已全部点亮，点「全部隐藏」可收起'
        : ' · 点击字块找回文字';
    }
    var btn = document.getElementById('revealAll');
    if (btn) {
      btn.hidden = false;
      btn.textContent = app.revealed.size >= total ? '全部隐藏' : '全部显现';
    }
  }

  function renderNextRow() {
    els.nextRow.replaceChildren(); els.nextRow.hidden = false;
    if (app.phase === 'prompt') {
      els.nextRow.appendChild(h('button', {class:'next-btn', id:'submitAnswer', type:'button', disabled:!app.selected.length, onclick:rateCard}, '提交答案'));
    } else {
      els.nextRow.appendChild(h('span', {class:'choice-tip', text:view.mode === 'memorize' ? '背题模式 · 不记录作答' : (RATING_LABEL[app.rating] || '答案解析')}));
      els.nextRow.appendChild(h('button', {class:'next-btn', id:'nextBtn', type:'button'}, app.index < app.queue.length-1 ? '下一题' : '完成本轮', icon(ICONS.arrow,17)));
    }
  }

  function renderDone() {
    els.doneScreen.innerHTML = '';
    var deck = store.activeDeck();
    var cards = deckCards();
    var wrap = h('div', { class: 'done-card' });
    wrap.appendChild(h('div', { class: 'done-seal', text: 'O.' }));

    if (app.doneKind === 'empty') {
      var favEmpty = store.activeDeck() && store.activeDeck().virtual;
      wrap.appendChild(h('h2', { text: favEmpty ? '还没有收藏的题目' : '先导入一份题库' }));
      wrap.appendChild(h('p', {
        class: 'done-sub',
        text: favEmpty
          ? '在题干右上角点亮星标，收藏的题目会汇总到「总收藏题库」，随时回来集中背诵。'
          : '支持粘贴选择题或导入 TXT、JSON、PDF、Word 与截图。单选和多选会按题型标题自动区分。'
      }));
      var emptyActions = h('div', { class: 'done-actions' });
      if (favEmpty) {
        emptyActions.appendChild(h('button', { class: 'primary-btn', type: 'button', onclick: openDecks }, '去题库管理'));
      } else {
        emptyActions.appendChild(h('button', { class: 'primary-btn', type: 'button', onclick: function () { openImport(); } }, '导入题库'));
        emptyActions.appendChild(h('button', { class: 'ghost-btn', type: 'button', onclick: openDecks }, '题库管理'));
      }
      wrap.appendChild(emptyActions);
      els.doneScreen.appendChild(wrap);
      return;
    }

    if (app.doneKind === 'rest') {
      var allowance = store.newAllowance();
      var freshCount = C.newCount(cards);
      var limitReached = freshCount > 0 && allowance === 0;
      var nextTs = nextDueStamp();

      wrap.appendChild(h('h2', { text: limitReached ? '今天的任务完成了' : '当前没有待复习的卡片' }));
      var sub = limitReached
        ? '今天的新题目已达每日目标（' + S.settings.dailyNew + ' 条）。可以先去设置调整目标，或明天再来。'
        : (nextTs !== Infinity
          ? (C.dayStart(nextTs) === nextTs
            ? '下一批将在' + midnightText(nextTs, Date.now()) + ' 刷新。'
            : '下一张将在 ' + C.formatDue(nextTs, Date.now()) + '（' + fmtClock(nextTs) + '）到期。')
          : '这个题库还没有排期，导入新题目或重置进度即可开始。');
      wrap.appendChild(h('p', { class: 'done-sub', text: sub }));

      var meta = h('div', { class: 'done-meta' });
      meta.appendChild(h('span', { text: '题库：' + (deck ? deck.name : '—') }));
      meta.appendChild(h('span', { text: '共 ' + cards.length + ' 条' }));
      meta.appendChild(h('span', { text: '待复习 ' + C.dueCount(cards, Date.now()) + ' · 新卡 ' + C.newCount(cards) }));
      wrap.appendChild(meta);

      var actions = h('div', { class: 'done-actions' });
      var built = buildQueue();
      if (built.all.length) {
        actions.appendChild(h('button', { class: 'primary-btn', type: 'button', onclick: startSession }, '继续学习'));
      }
      actions.appendChild(h('button', {
        class: 'ghost-btn',
        type: 'button',
        onclick: function () {
          var name = deck ? deck.name : '当前题库';
          askConfirm('Progress', '重置进度', '把「' + name + '」的全部题目重新作为新卡开始？排期会清空，划线标记保留。', '重置', function () {
            var n = deck ? store.resetDeckProgress(deck.id) : 0;
            toast('已重置 ' + n + ' 条题目的进度');
            startSession();
          });
        }
      }, '重置'));
      actions.appendChild(h('button', { class: 'ghost-btn', type: 'button', onclick: openDecks }, '题库管理'));
      actions.appendChild(h('button', { class: 'ghost-btn', type: 'button', onclick: openSettings }, '设置'));
      wrap.appendChild(actions);
      els.doneScreen.appendChild(wrap);
      return;
    }

    // 本轮总结
    var elapsed = Date.now() - (app.sessionStart || Date.now());
    wrap.appendChild(h('h2', { text: '本轮完成' }));
    wrap.appendChild(h('p', {
      class: 'done-sub',
      text: '本轮练习结束。错误题目会进入错题筛选；待补答案的题目不计入正确率。'
    }));

    var stats = h('div', { class: 'done-stats' });
    [
      ['known', '正确'],
      ['fuzzy', '待补答案'],
      ['unknown', '错误']
    ].forEach(function (pair) {
      stats.appendChild(h('div', { class: 'done-stat ' + pair[0] },
        h('b', { text: String(app.counts[pair[0]]) }),
        h('span', { text: pair[1] })
      ));
    });
    wrap.appendChild(stats);

    var meta = h('div', { class: 'done-meta' });
    meta.appendChild(h('span', { text: '本轮 ' + app.totalUnique + ' 张' }));
    meta.appendChild(h('span', { text: '用时 ' + C.formatDuration(elapsed) }));
    meta.appendChild(h('span', { text: '下次复习 ' + nextDueText() }));
    wrap.appendChild(meta);

    var actions = h('div', { class: 'done-actions' });
    var built2 = buildQueue();
    if (built2.all.length) {
      actions.appendChild(h('button', { class: 'primary-btn', type: 'button', onclick: startSession }, '再来一轮'));
    }
    actions.appendChild(h('button', {
      class: built2.all.length ? 'ghost-btn' : 'primary-btn',
      type: 'button',
      onclick: restartAll
    }, '重置本轮'));
    actions.appendChild(h('button', { class: 'ghost-btn', type: 'button', onclick: openDecks }, '题库管理'));
    wrap.appendChild(actions);
    els.doneScreen.appendChild(wrap);
  }

  /* ---------------- 逐字回忆交互 ---------------- */

  function revealAt(index) {
    var card = app.current;
    if (!card) return;
    var fresh = [];
    var set = C.revealCluster(card.def, index, S.settings.revealRadius);
    set.forEach(function (i) {
      if (!app.revealed.has(i)) {
        app.revealed.add(i);
        fresh.push(i);
      }
    });
    paintRevealed(fresh);
  }

  function paintRevealed(fresh) {
    fresh.forEach(function (i) {
      var el = app.tokenEls.get(i);
      if (!el) return;
      el.classList.add('on', 'flash');
      el.removeAttribute('aria-hidden');
      el.addEventListener('animationend', function handler() {
        el.classList.remove('flash');
        el.removeEventListener('animationend', handler);
      });
    });
    updateRecallHint();
    if (fresh.length && navigator.vibrate) {
      try { navigator.vibrate(8); } catch (e) { /* ignore */ }
    }
  }

  function revealAll() {
    var fresh = [];
    app.tokenEls.forEach(function (el, i) {
      if (!app.revealed.has(i)) {
        app.revealed.add(i);
        fresh.push(i);
      }
    });
    if (!fresh.length) return;
    // 一次全开时不做逐字闪动，避免整段乱跳
    fresh.forEach(function (i) {
      var el = app.tokenEls.get(i);
      if (!el) return;
      el.classList.add('on');
      el.removeAttribute('aria-hidden');
    });
    updateRecallHint();
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* ignore */ } }
  }

  function toggleRevealAll() {
    var card = app.current;
    if (!card) return;
    var total = C.hiddenCount(card.def);
    if (app.revealed.size >= total) {
      app.revealed = new Set();
      app.tokenEls.forEach(function (el) {
        el.classList.remove('on');
        el.setAttribute('aria-hidden', 'true');
      });
      updateRecallHint();
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
      return;
    }
    revealAll();
  }

  /* ---------------- 高亮标记 ---------------- */

  function indexFromPoint(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return -1;
    var charEl = el.closest ? el.closest('.c') : null;
    if (charEl && els.answer.contains(charEl)) return Number(charEl.dataset.i);
    return -1;
  }

  function selectionRange() {
    if (!app.selection) return null;
    return C.normalizeRange(app.selection.a, app.selection.b);
  }

  function paintSelection(next) {
    var prev = app.painted;
    if (prev && next && prev.start === next.start && prev.end === next.end) return;
    if (prev) {
      for (var i = prev.start; i < prev.end; i++) {
        var old = app.charEls.get(i);
        if (old && (!next || i < next.start || i >= next.end)) old.classList.remove('sel');
      }
    }
    if (next) {
      for (var j = next.start; j < next.end; j++) {
        var el = app.charEls.get(j);
        if (el) el.classList.add('sel');
      }
    }
    app.painted = next;
  }

  function clearSelection() {
    paintSelection(null);
    app.selection = null;
    app.dragging = false;
  }

  function applyMark() {
    var range = selectionRange();
    var card = app.current;
    if (!range || !card) return;
    card.highlights = C.addHighlight(
      card.highlights || [],
      range.start,
      range.end,
      S.settings.highlightColor || 'yellow',
      S.settings.highlightStyle || 'marker'
    );
    store.save();
    clearSelection();
    renderRevealed();
    if (app.marking) els.answer.classList.add('marking');
  }

  function eraseMark() {
    var range = selectionRange();
    var card = app.current;
    if (!range || !card) return;
    var before = (card.highlights || []).length;
    card.highlights = C.removeHighlight(card.highlights || [], range.start, range.end);
    clearSelection();
    if (card.highlights.length === before) return;
    store.save();
    renderRevealed();
    if (app.erasing) els.answer.classList.add('marking');
    toast('已擦除这里的标记');
  }

  function clearMarks() {
    var card = app.current;
    if (!card) return;
    if (!(card.highlights || []).length) { toast('这张卡还没有标记'); return; }
    askConfirm('Mark', '清空标记', '清空这张卡的全部高亮与下划线？', '清空', function () {
      card.highlights = [];
      store.saveNow();
      renderRevealed();
      toast('已清空本卡标记');
    });
  }

  /* ---------------- 弹层 ---------------- */

  function openModal(opts) {
    app.lastFocused = document.activeElement;
    app.modalOpen = true;
    els.modalKicker.textContent = opts.kicker || 'OptionKiller';
    els.modalTitle.textContent = opts.title || '';
    els.modalBody.innerHTML = '';
    if (opts.body) els.modalBody.appendChild(opts.body);
    els.modalFoot.innerHTML = '';
    if (opts.foot) els.modalFoot.appendChild(opts.foot);
    if (els.modalActions) {
      var extra = els.modalActions.querySelectorAll('[data-modal-action]');
      for (var i = 0; i < extra.length; i++) extra[i].remove();
      if (opts.action) {
        opts.action.setAttribute('data-modal-action', '1');
        els.modalActions.insertBefore(opts.action, els.modalActions.firstChild);
      }
    }
    els.modal.classList.toggle('is-tall', opts.tall === true);
    els.modal.hidden = false;
    els.body.style.overflow = 'hidden';
    var focusable = els.modal.querySelector('button, input, textarea, select, [tabindex]');
    if (focusable && opts.autofocus !== false) setTimeout(function () { focusable.focus(); }, 30);
  }

  function closeModal() {
    if (!app.modalOpen) return;
    app.modalOpen = false;
    els.modal.hidden = true;
    els.modal.classList.remove('is-tall');
    els.body.style.overflow = '';
    if (app.lastFocused && app.lastFocused.focus) {
      try { app.lastFocused.focus(); } catch (e) { /* ignore */ }
    }
  }

  function modalFoot(primaryText, onPrimary, opts) {
    opts = opts || {};
    var foot = document.createDocumentFragment();
    if (opts.left) foot.appendChild(opts.left);
    else foot.appendChild(h('span', { class: 'foot-left' }));
    foot.appendChild(h('button', {
      class: 'ghost-btn',
      type: 'button',
      onclick: closeModal
    }, '取消'));
    if (primaryText) {
      foot.appendChild(h('button', {
        class: 'primary-btn',
        type: 'button',
        disabled: !!opts.disabled,
        onclick: onPrimary
      }, primaryText));
    }
    return foot;
  }

  /**
   * 应用内确认框。WebView 的原生 confirm 行为不可靠（Android WebView 默认可能直接返回 false），
   * 所以所有破坏性操作都走同一条弹层路径。
   */
  function askConfirm(kicker, title, message, yesText, onYes, onCancel) {
    var body = h('p', { class: 'confirm-text', text: message });
    var foot = document.createDocumentFragment();
    foot.appendChild(h('span', { class: 'foot-left' }));
    foot.appendChild(h('button', {
      class: 'ghost-btn',
      type: 'button',
      onclick: function () {
        closeModal();
        if (onCancel) onCancel();
      }
    }, '取消'));
    foot.appendChild(h('button', {
      class: 'primary-btn danger',
      type: 'button',
      onclick: function () {
        closeModal();
        onYes();
      }
    }, yesText));
    openModal({ kicker: kicker, title: title, body: body, foot: foot });
  }

  /* ---------------- 题库管理 ---------------- */

  function deckRow(deck, renaming) {
    var cards = store.deckCards(deck.id);
    var active = S.activeDeckId === deck.id;
    var row = h('div', {
      class: 'deck-row' + (active ? ' active' : '') + (deck.virtual ? ' is-virtual' : '')
    });

    var radio = h('button', {
      class: 'deck-radio',
      type: 'button',
      'aria-label': '切换到 ' + deck.name,
      onclick: function () {
        if (S.activeDeckId === deck.id) return;
        store.setActiveDeck(deck.id);
        closeModal();
        startSession();
        toast('已切换到「' + deck.name + '」');
      }
    });
    row.appendChild(radio);

    var info = h('div', { class: 'deck-info' });
    var nameLine = h('span', { class: 'deck-name-line' });
    nameLine.appendChild(h('span', { class: 'deck-name', text: deck.name }));
    if (deck.virtual) nameLine.appendChild(h('span', { class: 'deck-pin', text: '置顶' }));
    info.appendChild(nameLine);
    var now = Date.now();
    var meta = deck.virtual
      ? '全部收藏 · ' + cards.length + ' 条'
      : cards.length + ' 条 · 待复习 ' + C.dueCount(cards, now) + ' · 新卡 ' + C.newCount(cards);
    if (active) meta += ' · 当前';
    info.appendChild(h('span', { class: 'deck-meta', text: meta }));
    row.appendChild(info);

    var actions = h('div', { class: 'deck-actions' });
    if (deck.virtual) {
      row.appendChild(actions);
      return row;
    }
    actions.appendChild(h('button', {
      class: 'mini-btn',
      type: 'button',
      title: '编辑题库',
      'aria-label': '编辑题库',
      onclick: function () { openDeckEditor(deck.id); }
    }, icon(ICONS.rename)));
    actions.appendChild(h('button', {
      class: 'mini-btn',
      type: 'button',
      title: '删除题库',
      'aria-label': '删除题库',
      onclick: function () {
        askConfirm('Libraries', '删除题库', '删除「' + deck.name + '」？该题库的 ' + cards.length + ' 条题目和标记会一并删除。', '删除', function () {
          store.deleteDeck(deck.id);
          openDecks();
          startSession();
          toast('已删除题库');
        }, function () { openDecks(); });
      }
    }, icon(ICONS.trash)));
    row.appendChild(actions);
    return row;
  }

  /** 编辑视图的文本格式：1.题干:解释，空行分条；解释内部的换行原样保留。 */
  function deckToText(cards) { return C.questionText(cards); }

  var measureCtx = null;

  function measurePad(prefix) {
    try {
      if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
      measureCtx.font = '14px ui-monospace, "SF Mono", Menlo, "PingFang SC", monospace';
      var unit = measureCtx.measureText(' ').width;
      var width = measureCtx.measureText(prefix).width;
      if (!unit) return 0;
      return Math.max(0, Math.floor(width / unit));
    } catch (e) {
      return prefix.length;
    }
  }

  function openDeckEditor(deckId) {
    var deck = store.deckById(deckId);
    if (!deck) return;
    var cards = store.deckCards(deckId);
    var body = h('div');

    var nameField = h('div', { class: 'field' });
    nameField.appendChild(h('label', { for: 'deckEditName', text: '题库名称' }));
    var nameInput = h('input', {
      class: 'text-input',
      id: 'deckEditName',
      type: 'text',
      maxlength: '60',
      value: deck.name
    });
    nameField.appendChild(nameInput);
    body.appendChild(nameField);

    var textField = h('div', { class: 'field' });
    textField.appendChild(h('label', { for: 'deckEditText', text: '题目内容' }));
    var textarea = h('textarea', {
      class: 'text-input deck-editor-text',
      id: 'deckEditText',
      spellcheck: 'false',
      placeholder: '一，单项选择题（单选/A型题）\n1.问题()\nA.选项\nB.选项\n答案：A'
    });
    textarea.value = deckToText(cards);
    textField.appendChild(textarea);
    textField.appendChild(h('p', {
      class: 'import-help',
      text: '按导入格式编辑题干、A–E 选项、答案与解析。未修改的题目保留进度；修改内容的题目重新练习，笔记与收藏保留。'
    }));
    body.appendChild(textField);

    function save() {
      var name = nameInput.value.trim();
      if (!name) { nameInput.focus(); toast('题库名不能为空'); return; }
      if (!textarea.value.trim()) {
        store.renameDeck(deckId, name);
        store.replaceDeckCards(deckId, []);
        store.saveNow();
        closeModal(); openDecks(); startSession();
        toast('已保存题库');
        return;
      }
      var parsed;
      try {
        parsed = C.parseText(textarea.value);
      } catch (e) {
        toast('解析失败：' + e.message);
        return;
      }
      if (!parsed.cards.length) {
        toast('没有解析到选择题，请检查题干编号与选项');
        textarea.focus();
        return;
      }
      store.renameDeck(deckId, name);
      store.replaceDeckCards(deckId, parsed.cards);
      store.saveNow();
      closeModal(); openDecks(); startSession();
      toast('已保存 ' + parsed.cards.length + ' 条题目');
    }

    openModal({
      kicker: 'Libraries',
      title: '编辑题库',
      body: body,
      foot: modalFoot('保存', save),
      autofocus: false
    });
    setTimeout(function () { nameInput.focus(); nameInput.select(); }, 30);
  }

  var STAR_PATH = 'M12 3.4l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z';

  function favButton(card, onChange) {
    var btn = h('button', {
      class: 'fav-btn' + (card.fav ? ' on' : ''),
      type: 'button',
      'aria-label': (card.fav ? '取消收藏 ' : '收藏 ') + card.term,
      'aria-pressed': String(!!card.fav)
    });
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      card.fav = !card.fav;
      btn.classList.toggle('on', !!card.fav);
      btn.setAttribute('aria-pressed', String(!!card.fav));
      btn.setAttribute('aria-label', (card.fav ? '取消收藏 ' : '收藏 ') + card.term);
      store.save();
      if (onChange) onChange();
    });
    return btn;
  }

  function filteredCards() {
    return deckCards().filter(function(c) {
      return (view.type === 'all' || c.type === view.type) &&
        (view.mastered === 'all' || !!c.mastered === (view.mastered === 'yes')) &&
        (view.category === 'all' || view.category === 'wrong' && c.wrong || view.category === 'fav' && c.fav ||
        view.category === 'new' && !c.lastAttempt || view.category === 'done' && c.lastAttempt || view.category === 'draft' && (c.draft || (Array.isArray(c.scratchBoxes) ? c.scratchBoxes.some(function(b) {return b.text;}) : c.scratch)));
    });
  }

  function openToc() {
    var body = h('div', {class:'answer-card-page'});
    body.appendChild(h('div', {class:'answer-card-banner'}, h('b', {text:'答题卡'}), h('span', {text:'按题型与进度，找到下一道题'})));
    var filter = h('div', {class:'question-filters'}), grid = h('div', {class:'question-grid'}), summary = h('p', {class:'grid-summary'});
    function draw() {
      filter.replaceChildren();
      [['斩题','mastered',[['all','全部'],['yes','已斩'],['no','未斩']]],
       ['题型','type',[['all','全部'],['single','A型题'],['multi','X型题']]],
       ['分类','category',[['all','全部'],['wrong','做错的'],['fav','收藏的'],['new','未做的'],['done','已做的'],['draft','有草稿']]],
       ['模式','mode',[['practice','练习模式'],['memorize','背题模式']]],
       ['乱序','order',[['sequence','关闭乱序'],['random','题号随机乱序']]]].forEach(function(row) {
        var line = h('div', {class:'filter-row'},h('span',{class:'filter-label',text:row[0]}));
        row[2].forEach(function(opt) {line.appendChild(h('button', {type:'button', class:'filter-chip' + (view[row[1]] === opt[0] ? ' active' : ''), 'aria-pressed':String(view[row[1]] === opt[0]), text:opt[1], onclick:function() {view[row[1]]=opt[0];draw();}}));});
        filter.appendChild(line);
      });
      var cards = filteredCards(); grid.replaceChildren();
      var all = deckCards();
      cards.forEach(function(c) {
        var number = all.indexOf(c)+1;
        grid.appendChild(h('button', {type:'button', class:'question-dot' + (c.lastAttempt ? c.lastAttempt.correct === true ? ' right' : c.lastAttempt.correct === false ? ' wrong' : ' pending' : '') + (app.current && app.current.id === c.id ? ' current' : ''),
          text:String(number), 'aria-label':'第 ' + number + ' 题 ' + (c.lastAttempt ? c.lastAttempt.correct === true ? '正确' : c.lastAttempt.correct === false ? '错误' : '待补答案' : '未做'),
          onclick:function() {
            app.queue = cards.slice(); app.totalUnique=cards.length; app.index=cards.indexOf(c); closeModal(); presentPrompt(c); render(); window.scrollTo({top:0});
          }}));
      });
      if (!cards.length) grid.appendChild(h('p', {class:'empty-filter',text:'没有符合条件的题目，试试其他筛选。'}));
      var graded = cards.filter(function(c) {return c.lastAttempt && c.lastAttempt.correct !== null;});
      var correct = graded.filter(function(c) {return c.lastAttempt.correct;}).length;
      summary.textContent = '当前共 ' + cards.length + ' 题，已判分 ' + graded.length + ' 题，正确 ' + correct + ' 题，错误 ' + (graded.length-correct) + ' 题。正确率 ' + (graded.length ? (correct/graded.length*100).toFixed(1)+'%' : '—');
    }
    body.appendChild(filter); body.appendChild(h('div',{class:'grid-legend',text:'绿色：正确　红色：错误　浅蓝：未做　灰色：待补答案'})); body.appendChild(grid); body.appendChild(summary); draw();
    openModal({kicker:'Answer sheet', title:(store.activeDeck() || {}).name || '答题卡', body:body,
      foot:modalFoot('开始练习',function(){closeModal();startSession(true);},{left:h('button',{type:'button',class:'ghost-btn',text:'重做本库',onclick:function(){askConfirm('Progress','重做本库','清除本库作答统计、草稿与排期，保留笔记和收藏？','重做',function(){store.resetDeckProgress(S.activeDeckId);closeModal();startSession(true);},openToc);}})})});
  }

  function openNote() {
    var card=app.current; if(!card) return;
    var input=h('textarea',{class:'text-input deck-editor-text','aria-label':'我的笔记',placeholder:'记录解题思路、易错点…'}); input.value=card.note || '';
    openModal({kicker:'Notes',title:'我的笔记',body:input,foot:modalFoot('保存笔记',function(){card.note=input.value;card.noteUpdatedAt=Date.now();store.saveNow();closeModal();render();toast('笔记已保存');})});
  }

  function saveScratch(immediate) {
    if (!app.scratchCard) return;
    app.scratchCard.scratchUpdatedAt = Math.max(Date.now(), (app.scratchCard.scratchUpdatedAt || 0) + 1);
    if (immediate) store.saveNow(); else store.save();
  }

  function positionScratch(node, box) {
    var canvas = document.getElementById('scratchCanvas');
    node.style.left = (box.x * Math.max(0, canvas.clientWidth - node.offsetWidth)) + 'px';
    node.style.top = (box.y * Math.max(0, canvas.clientHeight - node.offsetHeight)) + 'px';
  }

  function renderScratch() {
    var canvas = document.getElementById('scratchCanvas');
    canvas.replaceChildren();
    if (!app.scratchCard) return;
    app.scratchCard.scratchBoxes.forEach(function(box,index) {
      var note = h('div',{class:'scratch-note',dataset:{scratchId:box.id}});
      var handle = h('button',{type:'button',class:'scratch-handle','aria-label':'拖动草稿 ' + (index+1) + '，也可用方向键移动',text:'⠿ 草稿 ' + (index+1)});
      var remove = h('button',{type:'button',class:'scratch-remove','aria-label':'删除草稿 ' + (index+1),text:'×',onclick:function() {
        function discard() {
          if (!app.scratchCard) return;
          app.scratchCard.scratchBoxes = app.scratchCard.scratchBoxes.filter(function(b) {return b.id !== box.id;});
          saveScratch(true); renderScratch();
        }
        if (box.text.trim()) askConfirm('Scratchpad','删除草稿','删除这张草稿中的文字？其余文本框保留。','删除',discard);
        else discard();
      }});
      var input = h('textarea',{class:'scratch-text','aria-label':'草稿文本 ' + (index+1),placeholder:'在题目上方直接输入草稿…',spellcheck:'false'});
      input.value = box.text;
      input.addEventListener('input',function() {box.text=input.value;saveScratch(false);});
      input.addEventListener('keydown',function(e) {if(e.key !== 'Escape')e.stopPropagation();});
      var drag = null;
      handle.addEventListener('pointerdown',function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        drag={pointer:e.pointerId,x:e.clientX,y:e.clientY,left:note.offsetLeft,top:note.offsetTop};
        handle.setPointerCapture(e.pointerId);
        note.classList.add('dragging');
      });
      function move(left,top) {
        box.x=C.clampFraction(left/Math.max(1,canvas.clientWidth-note.offsetWidth));
        box.y=C.clampFraction(top/Math.max(1,canvas.clientHeight-note.offsetHeight));
        positionScratch(note,box);
      }
      handle.addEventListener('pointermove',function(e) {
        if(!drag || drag.pointer !== e.pointerId) return;
        move(drag.left+e.clientX-drag.x,drag.top+e.clientY-drag.y);
      });
      function endDrag(e) {
        if(!drag || drag.pointer !== e.pointerId) return;
        drag=null;note.classList.remove('dragging');saveScratch(true);
        if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);
      }
      handle.addEventListener('pointerup',endDrag);
      handle.addEventListener('pointercancel',endDrag);
      handle.addEventListener('keydown',function(e) {
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
        e.preventDefault();e.stopPropagation();var step=e.shiftKey?1:10;
        move(note.offsetLeft+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),note.offsetTop+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));saveScratch(true);
      });
      note.appendChild(h('div',{class:'scratch-note-head'},handle,remove));
      note.appendChild(input);canvas.appendChild(note);positionScratch(note,box);
    });
  }

  function addScratch() {
    if (!app.scratchCard) return;
    var n=app.scratchCard.scratchBoxes.length;
    app.scratchCard.scratchBoxes.push({id:C.uid(),text:'',x:0.08+(n%6)*0.1,y:0.18+(n%6)*0.1});
    saveScratch(true);renderScratch();
    var inputs=document.querySelectorAll('.scratch-text');
    if(inputs.length)inputs[inputs.length-1].focus();
  }

  function closeDraft() {
    if (!app.scratchCard) return;
    store.saveNow();app.scratchCard=null;
    document.getElementById('scratchLayer').hidden=true;
    document.getElementById('scratchCanvas').replaceChildren();
    document.getElementById('draftBtn').classList.remove('active');
    document.getElementById('draftBtn').setAttribute('aria-pressed','false');
    if(app.scratchFocus && app.scratchFocus.isConnected)app.scratchFocus.focus();
    app.scratchFocus=null;
  }

  function openDraft() {
    if (!app.current) return;
    if (app.scratchCard) {closeDraft();return;}
    closeModal();app.scratchCard=app.current;app.scratchFocus=document.activeElement;
    app.scratchCard.scratchBoxes=C.normalizeScratchBoxes(app.scratchCard.scratchBoxes,app.scratchCard.scratch);
    document.getElementById('scratchLayer').hidden=false;
    document.getElementById('draftBtn').classList.add('active');
    document.getElementById('draftBtn').setAttribute('aria-pressed','true');
    if(!app.scratchCard.scratchBoxes.length)addScratch();else renderScratch();
  }

  function openStats() {
    var cards=deckCards(), graded=cards.filter(function(c){return c.lastAttempt && c.lastAttempt.correct !== null;}), correct=graded.filter(function(c){return c.lastAttempt.correct;}).length;
    var body=h('div',{class:'stats-panel'});
    [['题目总数',cards.length],['已作答',cards.filter(function(c){return c.lastAttempt;}).length],['正确题数',correct],['错题数量',cards.filter(function(c){return c.wrong;}).length],['待补答案',cards.filter(function(c){return !c.answers.length;}).length],['正确率',graded.length?(correct/graded.length*100).toFixed(1)+'%':'—']].forEach(function(x){body.appendChild(h('div',{class:'stat-tile'},h('b',{text:String(x[1])}),h('span',{text:x[0]})));});
    openModal({kicker:'Statistics',title:'学习统计',body:body,foot:modalFoot('完成',closeModal)});
  }

  function openDecks() {
    var body = h('div');
    var list = h('div', { class: 'deck-list' });
    list.appendChild(deckRow({ id: store.FAV_DECK_ID, name: store.FAV_DECK_NAME, virtual: true }));
    S.decks.forEach(function (deck) {
      list.appendChild(deckRow(deck));
    });
    body.appendChild(list);

    var toolbar = h('div', { class: 'deck-toolbar' });
    toolbar.appendChild(h('button', {
      class: 'ghost-btn',
      type: 'button',
      onclick: function () {
        var deck = store.createDeck('新题库');
        startSession();
        openDeckEditor(deck.id);
      }
    }, icon(ICONS.plus, 15), '新建题库'));
    toolbar.appendChild(h('button', {
      class: 'primary-btn',
      type: 'button',
      onclick: function () { openImport(); }
    }, icon(ICONS.upload, 15), '导入题库'));
    body.appendChild(toolbar);

    body.appendChild(h('p', {
      class: 'import-help',
      text: '不登录时题目与进度只保存在本机；登录后会同步到你的云端空间，换设备可继续。'
    }));

    openModal({
      kicker: 'Libraries',
      title: '题库',
      body: body,
      foot: modalFoot(null, null, { left: h('span', { class: 'foot-left', text: '共 ' + (S.decks.length + 1) + ' 个题库' }) })
    });
  }

  /* ---------------- 导入 ---------------- */

  function openImport(presetDeckId, onCancel) {
    var parsed = null;
    var body = h('div');
    var footInfo = h('span', { class: 'foot-left', text: '支持 txt / json / pdf / docx / 图片' });

    var targetField = h('div', { class: 'field' });
    targetField.appendChild(h('label', { for: 'importDeckSelect', text: '导入到' }));
    var select = h('select', { class: 'text-input', id: 'importDeckSelect' });
    S.decks.forEach(function (deck) {
      select.appendChild(h('option', {
        value: deck.id,
        text: deck.name,
        selected: deck.id === (presetDeckId || S.activeDeckId)
      }));
    });
    select.appendChild(h('option', { value: '__new__', text: '＋ 新建题库' }));
    targetField.appendChild(select);
    body.appendChild(targetField);

    var nameField = h('div', { class: 'field', hidden: true });
    nameField.appendChild(h('label', { for: 'importDeckName', text: '新题库名称' }));
    var nameInput = h('input', {
      class: 'text-input',
      id: 'importDeckName',
      type: 'text',
      maxlength: '60',
      placeholder: '例如：内科学 · 第一章',
      value: ''
    });
    nameField.appendChild(nameInput);
    body.appendChild(nameField);

    select.addEventListener('change', function () { nameField.hidden = select.value !== '__new__'; });

    var drop = h('div', { class: 'drop-zone', tabindex: '0', role: 'button' });
    drop.appendChild(icon(ICONS.upload));
    drop.appendChild(h('span', null, h('b', { text: '选择题库文件' }), ' 或拖到这里'));
    drop.appendChild(h('span', { text: 'txt / json / md / pdf / docx / 截图' }));
    var fileInput = h('input', {
      type: 'file',
      accept: '.txt,.json,.jsonl,.md,.pdf,.docx,.doc,image/*,text/plain,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      hidden: true
    });
    body.appendChild(drop);
    body.appendChild(fileInput);

    var textarea = h('textarea', {
      id: 'importText',
      class: 'import-textarea',
      placeholder: '一，单项选择题（单选/A型题）\n1.问题()\nA.选项一\nB.选项二\nC.选项三\nD.选项四\nE.选项五\n答案：B\n解析：填写解析（可选）\n\n二，多项选择题（多选/X型题）\n1.问题()\nA.选项一\nB.选项二\nC.选项三\nD.选项四\nE.选项五\n答案：AC',
      'aria-label': '粘贴题库内容'
    });
    body.appendChild(textarea);
    body.appendChild(h('p', {
      class: 'import-help',
      text: '支持单选/A型题与多选/X型题。题干以 1. 开头，A–E 选项可分行或同一行。答案可写在括号内或题后，也可在文末写「参考答案」并按题号列出「1.A 2.AC」。解析可选；无答案的题目可练习，但不判分。PDF/Word/截图提取后请先核对。'
    }));

    var preview = h('div', { class: 'import-preview', text: '等待内容…' });
    body.appendChild(preview);
    var checkEnabled = h('input', {type:'checkbox', id:'importAiCheck'});
    var checkLabel = h('label', {for:'importAiCheck', class:'import-help'}, checkEnabled, ' AI 核对（默认关闭）');
    body.appendChild(checkLabel);
    var checkStatus = h('p', {class:'import-help', id:'importAiStatus', text:'开启后会将原始文本及解析结果发送给所选 AI 服务，可能产生费用；图片仅发送提取出的文字，结果请人工核对。'});
    body.appendChild(checkStatus);
    var checkRevision = 0, checkPassed = false;
    function checkImport() {
      var revision=++checkRevision; checkPassed=false;
      if (!checkEnabled.checked || !parsed || !parsed.cards.length) { updateImportButton(); return; }
      var config=aiConfig(), raw=textarea.value, formatted=C.questionText(parsed.cards);
      if (!config || !config.model || (!config.key && config.provider !== 'custom')) {checkStatus.textContent='请先在设置的自动解析中配置服务商、模型和 API Key。';updateImportButton();return;}
      if (raw.length>12000 || formatted.length>24000) {checkStatus.textContent='内容较长，请分批核对，或关闭 AI 核对后导入。';updateImportButton();return;}
      checkStatus.textContent='AI 正在核对，请稍候…';updateImportButton();
      var prompt='核对原文与解析结果是否存在遗漏、错分题干选项、答案或题型。只列差异及题号，最多200字；没有发现差异则说明未发现明显差异。不猜答案，不补原文没有的内容。\n原文:\n'+raw+'\n解析结果:\n'+formatted;
      var work=config.provider==='custom' ? Promise.resolve().then(function(){return customFetch(C.customEndpoints(config.endpoint).chat,config,{model:config.model,messages:[{role:'user',content:prompt}],max_tokens:384});}).then(function(data){var content=data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;if(typeof content!=='string' || !content.trim())throw new Error('AI 未返回核对结果');return {text:content};}) : fetch((window.OK_API_BASE || '')+'/api/analysis',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode:'import-check',provider:config.provider,key:config.key,model:config.model,question:raw,parsedText:formatted})}).then(function(res){return res.json().then(function(data){if(!res.ok)throw new Error(data.error || '核对失败');return data;});});
      work.then(function(data){if(revision!==checkRevision || !checkEnabled.checked)return; if(typeof data.text!=='string' || !data.text.trim())throw new Error('AI 未返回核对结果');checkPassed=true;checkStatus.textContent='AI 核对：'+data.text.trim().slice(0,1200)+'（AI 结果仅供参考，请对照原始资料）';updateImportButton();}).catch(function(e){if(revision!==checkRevision || !checkEnabled.checked)return;checkStatus.textContent=(e.message || 'AI 核对失败')+'；可重新勾选核对或关闭核对后导入。';updateImportButton();});
    }
    checkEnabled.addEventListener('change',function(){if(checkEnabled.checked)checkImport();else{checkRevision++;checkPassed=false;checkStatus.textContent='AI 核对已关闭；不会发送内容。';updateImportButton();}});

    function parseNow() {
      var text = textarea.value;
      if (!text.trim()) {
        parsed = null;
        preview.className = 'import-preview';
        preview.textContent = '等待内容…';
        footInfo.textContent = '支持 txt / json / pdf / docx / 图片';
        updateImportButton();
        return;
      }
      try {
        var nameHint = nameInput.value.trim();
        var result = C.parseImport(text, nameHint);
        parsed = result;
        preview.className = 'import-preview ok';
        preview.textContent = '可导入 ' + result.cards.length + ' 题（单选 ' + result.cards.filter(function(c){return c.type==="single";}).length + '，多选 ' + result.cards.filter(function(c){return c.type==="multi";}).length + '，待补答案 ' + result.cards.filter(function(c){return !c.answers.length;}).length + '）';
        var list = h('ul', { class: 'preview-items' });
        result.cards.slice(0, 3).forEach(function (c) {
          list.appendChild(h('li', { text: c.term + ' — ' + c.def.replace(/\n/g, ' ').slice(0, 42) }));
        });
        if (result.cards.length > 3) list.appendChild(h('li', { text: '… 还有 ' + (result.cards.length - 3) + ' 条' }));
        preview.appendChild(list);
        footInfo.textContent = '将导入 ' + result.cards.length + ' 条';
      } catch (err) {
        parsed = null;
        preview.className = 'import-preview err';
        preview.textContent = err.message || '解析失败';
        footInfo.textContent = '暂无可导入内容';
      }
      if (checkEnabled.checked && parsed) checkImport(); else updateImportButton();
    }

    var importBtn = h('button', {
      class: 'primary-btn',
      type: 'button',
      disabled: true,
      onclick: function () {
        if (!parsed) return;
        var deckId = select.value;
        var deckName = '';
        if (deckId === '__new__') {
          deckName = nameInput.value.trim() || parsed.name || '导入题库';
          deckName = deckName.replace(/\.[^.]+$/, '');
          deckId = store.createDeck(deckName).id;
        }
        var added = store.addCards(deckId, parsed.cards);
        view.type='all';view.category='all';view.mastered='all';
        store.setActiveDeck(deckId);
        closeModal();
        startSession();
        var deck = store.deckById(deckId);
        toast('已导入 ' + added.length + ' 条到「' + (deck ? deck.name : '题库') + '」');
      }
    }, '导入');

    function updateImportButton() {
      importBtn.disabled = !parsed || !parsed.cards.length || (checkEnabled.checked && !checkPassed);
      importBtn.textContent = parsed ? '导入 ' + parsed.cards.length + ' 条' : '导入';
    }

    var foot = document.createDocumentFragment();
    foot.appendChild(footInfo);
    foot.appendChild(h('button', {
      class: 'ghost-btn',
      type: 'button',
      onclick: function () {
        closeModal();
        if (onCancel) onCancel();
      }
    }, '取消'));
    foot.appendChild(importBtn);

    var debounce = null;
    textarea.addEventListener('input', function () {
      checkRevision++; checkPassed=false; if (checkEnabled.checked) {checkStatus.textContent='内容已更改，等待重新核对…'; updateImportButton();}
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(parseNow, 160);
    });

    function loadFile(file) {
      if (!file) return;
      checkRevision++; checkPassed=false;
      var kind = MJZ.extract.kindOf(file);
      var limits = { text: 8, pdf: 30, docx: 20, doc: 8, image: 12 };
      if (file.size > (limits[kind] || 8) * 1024 * 1024) {
        toast('文件过大（该类型上限 ' + (limits[kind] || 8) + 'MB）');
        return;
      }
      var labels = { pdf: '正在读取 PDF…', docx: '正在读取 Word…', image: '正在识别图片文字…', text: '正在读取文件…' };
      preview.className = 'import-preview';
      preview.textContent = labels[kind] || '正在读取…';
      footInfo.textContent = '识别中，请稍候';
      importBtn.disabled = true;
      MJZ.extract.extract(file, function (a, b) {
        if (kind === 'image') {
          var pct = Math.round((Number(a) || 0) * 100);
          if (b === 'recognizing text') preview.textContent = '正在识别图片文字… ' + pct + '%';
          else if (b === 'loading language traineddata') preview.textContent = '正在下载中文识别包…';
          else if (b === 'initializing api' || b === 'loading tesseract core') preview.textContent = '正在初始化识别引擎…';
          else if (pct) preview.textContent = '正在识别图片文字… ' + pct + '%';
        } else if (kind === 'pdf') {
          preview.textContent = '正在读取 PDF… ' + a + ' / ' + b + ' 页';
        }
      }).then(function (text) {
        textarea.value = text;
        if (!nameInput.value) nameInput.value = file.name.replace(/\.[^.]+$/, '');
        if (select.value !== '__new__' && !store.deckById(select.value)) select.value = '__new__';
        parseNow();
      }).catch(function (err) {
        parsed = null;
        preview.className = 'import-preview err';
        preview.textContent = err && err.message ? err.message : '识别失败，请换一个文件试试';
        footInfo.textContent = '识别失败';
        importBtn.disabled = true;
      });
    }

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener('change', function () {
      loadFile(fileInput.files && fileInput.files[0]);
    });
    drop.addEventListener('dragover', function (e) {
      e.preventDefault();
      drop.classList.add('dragover');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('dragover'); });
    drop.addEventListener('drop', function (e) {
      e.preventDefault();
      drop.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });

    openModal({
      kicker: 'Import',
      title: '导入题库',
      body: body,
      foot: foot
    });
    setTimeout(function () { textarea.focus(); }, 40);
  }

  /* ---------------- 设置 ---------------- */

  function openSettings() {
    var body = h('div');

    var g1 = h('div', { class: 'setting-group' });
    var row1 = h('div', { class: 'setting-row' });
    var label1 = h('div');
    label1.appendChild(h('div', { class: 'setting-label', text: '每日目标' }));
    label1.appendChild(h('div', { class: 'setting-desc', text: '0 表示不限；每天计划新学多少条新题目，到期复习不受限。' }));
    row1.appendChild(label1);

    var stepper = h('div', { class: 'stepper' });
    var minus = h('button', { type: 'button', 'aria-label': '减少', text: '−' });
    var input = h('input', { type: 'number', min: '0', max: '200', value: String(S.settings.dailyNew), 'aria-label': '每日目标' });
    var plus = h('button', { type: 'button', 'aria-label': '增加', text: '＋' });
    function applyDaily(v) {
      v = Math.max(0, Math.min(200, Math.round(Number(v) || 0)));
      S.settings.dailyNew = v;
      input.value = String(v);
      store.save();
    }
    minus.addEventListener('click', function () { applyDaily(Number(input.value) - 5); });
    plus.addEventListener('click', function () { applyDaily(Number(input.value) + 5); });
    input.addEventListener('change', function () { applyDaily(input.value); });
    stepper.appendChild(minus); stepper.appendChild(input); stepper.appendChild(plus);
    row1.appendChild(stepper);
    g1.appendChild(row1);
    body.appendChild(g1);

    var g2 = h('div', { class: 'setting-group' });
    var row2 = h('div', { class: 'setting-row' });
    var label2 = h('div');
    label2.appendChild(h('div', { class: 'setting-label', text: '正文字号' }));
    label2.appendChild(h('div', { class: 'setting-desc', text: '长时间背诵时选一个眼睛舒服的大小。' }));
    row2.appendChild(label2);
    var seg = h('div', { class: 'segmented' });
    [['s', '小'], ['m', '标准'], ['l', '大']].forEach(function (opt) {
      seg.appendChild(h('button', {
        type: 'button',
        class: S.settings.fontScale === opt[0] ? 'active' : '',
        text: opt[1],
        onclick: function (e) {
          S.settings.fontScale = opt[0];
          applyFontScale();
          store.save();
          Array.prototype.forEach.call(seg.children, function (b) { b.classList.remove('active'); });
          e.currentTarget.classList.add('active');
        }
      }));
    });
    row2.appendChild(seg);
    g2.appendChild(row2);
    body.appendChild(g2);

    var ai = h('div',{class:'setting-group'});
    ai.appendChild(h('div',{class:'setting-label',text:'自动解析'}));
    ai.appendChild(h('p',{class:'setting-desc',text:'开启后，提交答案会把题干、选项和标准答案发送给所选服务商，一次生成简明解析和简记，可能产生费用。已有解析会保留，AI 结果仅供参考。API Key 仅保存在当前标签页会话，不同步到云端。'}));
    var currentAI=aiConfig() || {}, enabled=h('input',{type:'checkbox',id:'aiEnabled',checked:!!currentAI.enabled});
    ai.appendChild(h('label',{class:'ai-toggle',for:'aiEnabled'},enabled,' 启用自动解析'));
    var provider=h('select',{class:'text-input',id:'aiProvider','aria-label':'AI 服务商'});
    [['openai','ChatGPT / OpenAI'],['deepseek','DeepSeek'],['gemini','Gemini'],['doubao','豆包 / 火山方舟'],['custom','自定义（OpenAI 兼容）']].forEach(function(x){provider.appendChild(h('option',{value:x[0],text:x[1]}));});
    provider.value=currentAI.provider || 'openai';
    var model=h('input',{class:'text-input',id:'aiModel','aria-label':'AI 模型名称',placeholder:'模型名称，例如 gpt-4o-mini',value:currentAI.model || ''});
    var key=h('input',{class:'text-input',id:'aiApiKey',type:'password',autocomplete:'off','aria-label':'AI API Key',placeholder:'输入 API Key（自定义服务可留空）',value:currentAI.key || ''});
    ai.appendChild(h('label',{class:'field',for:'aiProvider',text:'服务商'},provider));
    var addresses={openai:'https://api.openai.com/v1/chat/completions',deepseek:'https://api.deepseek.com/chat/completions',gemini:'https://generativelanguage.googleapis.com/v1beta/models/{模型名称}:generateContent',doubao:'https://ark.cn-beijing.volces.com/api/v3/chat/completions'};
    var endpoint=h('input',{class:'text-input',id:'aiEndpoint',type:'text','aria-label':'模型地址',placeholder:'https://服务地址/v1',value:provider.value==='custom' ? (currentAI.endpoint || '') : addresses[provider.value]});
    endpoint.readOnly=provider.value!=='custom';
    ai.appendChild(h('label',{class:'field',for:'aiEndpoint',text:'模型地址'},endpoint));
    ai.appendChild(h('label',{class:'field',for:'aiApiKey',text:'API Key'},key));
    ai.appendChild(h('label',{class:'field',for:'aiModel',text:'模型名称（可手动输入）'},model));
    var options=h('select',{class:'text-input',id:'aiModelChoices','aria-label':'选择已获取的模型',hidden:true});
    var status=h('p',{class:'setting-desc',id:'aiConnectionStatus',role:'status'});
    var getModels=h('button',{class:'ghost-btn',type:'button',text:'获取模型',onclick:function(){
      var chosen=provider.value, secret=key.value.trim(), address=endpoint.value.trim(), work;
      if(!secret && chosen!=='custom'){status.textContent='请先填写 API Key';key.focus();return;}
      try {
        if(chosen==='custom')work=customFetch(C.customEndpoints(address).models,{key:secret}).then(function(data){return {models:(Array.isArray(data.data)?data.data:[]).map(function(x){return x.id;}).filter(function(x){return typeof x==='string';})};});
        else work=fetch((window.OK_API_BASE || '')+'/api/analysis/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:chosen,key:secret})}).then(function(res){return res.json().then(function(data){if(!res.ok)throw new Error(data.error || '获取模型失败');return data;});});
      } catch(e) {status.textContent=e.message;return;}
      getModels.disabled=true;status.textContent='正在获取模型列表…';
      work
        .then(function(data){
          if(provider.value!==chosen || key.value.trim()!==secret || (chosen==='custom' && endpoint.value.trim()!==address))return;
          options.replaceChildren(h('option',{value:'',text:'请选择模型'}));
          data.models.forEach(function(name){options.appendChild(h('option',{value:name,text:name}));});
          options.hidden=!data.models.length;
          status.textContent=data.models.length ? '已获取 '+data.models.length+' 个模型，请选择；也可手动填写。' : '服务商未返回可用模型，可手动填写。';
        }).catch(function(e){if(provider.value===chosen && key.value.trim()===secret && (chosen!=='custom' || endpoint.value.trim()===address))status.textContent=e.message || '获取模型失败';})
        .finally(function(){getModels.disabled=false;});
    }});
    var testConnection=h('button',{class:'ghost-btn',type:'button',text:'测试连通性',onclick:function(){
      var chosen=provider.value, secret=key.value.trim(), selected=model.value.trim(), address=endpoint.value.trim();
      if((!secret && chosen!=='custom') || !selected){status.textContent='请填写模型名称和所需的 API Key';return;}
      if(chosen==='custom') {try{C.customEndpoints(address);}catch(e){status.textContent=e.message;return;}}
      testConnection.disabled=true;status.textContent='正在测试模型连接…';
      performAnalysis({provider:chosen,key:secret,model:selected,endpoint:address},{term:'连通性测试：1+1等于多少？',options:[{label:'A',text:'2'},{label:'B',text:'3'}],answers:['A']},true)
        .then(function(){if(provider.value===chosen && key.value.trim()===secret && model.value.trim()===selected && (chosen!=='custom' || endpoint.value.trim()===address))status.textContent='连接成功：服务商和所选模型均已响应。';})
        .catch(function(e){if(provider.value===chosen && key.value.trim()===secret && model.value.trim()===selected && (chosen!=='custom' || endpoint.value.trim()===address))status.textContent=e.message || '连接失败';})
        .finally(function(){testConnection.disabled=false;});
    }});
    options.addEventListener('change',function(){if(options.value)model.value=options.value;});
    provider.addEventListener('change',function(){endpoint.readOnly=provider.value!=='custom';endpoint.value=provider.value==='custom'?'':addresses[provider.value];key.value='';model.value='';options.hidden=true;status.textContent='切换服务商后请填写对应的 API Key。';});
    endpoint.addEventListener('input',function(){options.hidden=true;status.textContent='';});
    key.addEventListener('input',function(){options.hidden=true;status.textContent='';});
    ai.appendChild(h('div',{class:'ai-actions'},getModels,testConnection));
    ai.appendChild(options);ai.appendChild(status);
    ai.appendChild(h('p',{class:'setting-desc',text:'获取模型和测试连接会向所选服务商发送 API Key；连接测试可能产生费用。自定义地址由浏览器直接访问，服务需允许跨域（CORS）；支持 HTTPS 或本机回环 HTTP。'}));
    ai.appendChild(h('button',{class:'ghost-btn',type:'button',text:'保存自动解析设置',onclick:function(){
      var validModel=provider.value==='custom' ? /^[A-Za-z0-9._:/-]{1,160}$/.test(model.value.trim()) : /^[A-Za-z0-9._:-]{1,120}$/.test(model.value.trim());
      if(enabled.checked && ((!key.value.trim() && provider.value!=='custom') || !validModel)) {toast('请填写 API Key 和有效的模型名称');return;}
      if(enabled.checked && provider.value==='custom') {try{C.customEndpoints(endpoint.value);}catch(e){toast(e.message);return;}}
      try {sessionStorage.setItem(AI_KEY,JSON.stringify({enabled:enabled.checked,provider:provider.value,model:model.value.trim(),key:key.value.trim(),endpoint:provider.value==='custom' ? endpoint.value.trim() : ''}));toast('自动解析设置已保存到当前会话');}
      catch(e){toast('保存失败，请检查浏览器存储设置');}
    }}));
    body.appendChild(ai);

    var g3 = h('div', { class: 'setting-group' });
    var row3 = h('div', { class: 'setting-row' });
    var label3 = h('div');
    label3.appendChild(h('div', { class: 'setting-label', text: '重置本库进度' }));
    label3.appendChild(h('div', { class: 'setting-desc', text: '清除本题库的答题记录、错题状态和复习排期；收藏、笔记、草稿与斩题状态保留。' }));
    row3.appendChild(label3);
    row3.appendChild(h('button', {
      class: 'danger-btn',
      type: 'button',
      onclick: function () {
        var deck = store.activeDeck();
        if (!deck) return;
        askConfirm('Settings', '重置进度', '重置「' + deck.name + '」的答题记录、错题状态和复习排期？收藏、笔记、草稿与斩题状态会保留。', '重置', function () {
          var n = store.resetDeckProgress(deck.id);
          startSession();
          toast('已重置 ' + n + ' 道题的进度');
        }, openSettings);
      }
    }, '重置'));
    g3.appendChild(row3);
    body.appendChild(g3);

    var g4 = h('div', { class: 'setting-group' });
    g4.appendChild(h('div', { class: 'setting-label', text: '关于' }));
    g4.appendChild(h('p', { class: 'about-author', text: '作者：Anyu' }));
    g4.appendChild(h('p', {
      class: 'about-note',
      text: 'OptionKiller v' + APP_VERSION + ' · 选择题练习工具，支持单选、多选、收藏与错题复习。'
    }));
    g4.appendChild(h('p', {
      class: 'about-note',
      text: '题库、进度和笔记默认保存在本机；登录后可同步到自己的云端，也能建群共享题库。'
    }));
    body.appendChild(g4);

    openModal({
      kicker: 'Settings',
      title: '设置',
      body: body,
      foot: modalFoot('完成', closeModal)
    });
  }

  function applyFontScale() {
    els.body.classList.remove('font-s', 'font-l');
    if (S.settings.fontScale === 's') els.body.classList.add('font-s');
    if (S.settings.fontScale === 'l') els.body.classList.add('font-l');
  }

  /* ---------------- 事件绑定 ---------------- */

  els.ratingBar.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-rating]');
    if (!btn) return;
    rateCard(btn.dataset.rating);
  });

  els.nextRow.addEventListener('click', function (e) {
    if (e.target.closest('#nextBtn')) nextCard();
  });

  els.answer.addEventListener('click', function (e) {
    if (app.phase !== 'recall') return;
    if (e.target.closest('#revealAll')) { toggleRevealAll(); return; }
    var ph = e.target.closest('.ph');
    if (!ph) return;
    var i = Number(ph.dataset.i);
    if (app.revealed.has(i)) {
      var next = C.nextHiddenIndex(app.current.def, i);
      if (next >= 0) revealAt(next);
    } else {
      revealAt(i);
    }
  });

  els.answerTools.addEventListener('click', function (e) {
    if (e.target.closest('#markToggle')) {
      app.marking = !app.marking;
      if (app.marking) app.erasing = false;
      else store.saveNow();
      clearSelection();
      renderRevealed();
      toast(app.marking ? '拖动文字直接划线' : '划线已保存');
      return;
    }
    if (e.target.closest('#eraseToggle')) {
      app.erasing = !app.erasing;
      if (app.erasing) app.marking = false;
      clearSelection();
      renderRevealed();
      toast(app.erasing ? '在标记上滑动即可擦除' : '已退出擦除');
      return;
    }
    if (e.target.closest('#clearMarks')) {
      clearMarks();
    }
  });

  // 高亮选择的拖拽
  els.answer.addEventListener('pointerdown', function (e) {
    if (app.phase !== 'revealed' || (!app.marking && !app.erasing)) return;
    var charEl = e.target.closest('.c');
    if (!charEl) return;
    e.preventDefault();
    app.selection = { a: Number(charEl.dataset.i), b: Number(charEl.dataset.i) };
    app.dragging = true;
    app.painted = null;
    paintSelection(selectionRange());
    try { els.answer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  els.answer.addEventListener('pointermove', function (e) {
    if (!app.dragging) return;
    var idx = indexFromPoint(e.clientX, e.clientY);
    if (idx < 0) return;
    app.selection.b = idx;
    paintSelection(selectionRange());
  });

  function endSelection(e) {
    if (!app.dragging) return;
    app.dragging = false;
    try { els.answer.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    var range = selectionRange();
    if (!range || range.end <= range.start) { clearSelection(); return; }
    // 松手即生效：划线直接上色，擦除直接清除，不再弹调色盘
    if (app.erasing) eraseMark();
    else applyMark();
  }

  els.answer.addEventListener('pointerup', endSelection);
  els.answer.addEventListener('pointercancel', function (e) {
    app.dragging = false;
    try { els.answer.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  var swipeStart = null;
  els.studyScreen.addEventListener('touchstart', function (e) {
    swipeStart = null;
    if (e.touches.length !== 1 || app.modalOpen || app.scratchCard || app.marking || app.erasing ||
        (e.target.closest && e.target.closest('button,input,textarea,select,[contenteditable]'))) return;
    var touch = e.touches[0];
    swipeStart = {id:touch.identifier, x:touch.clientX, y:touch.clientY};
  }, {passive:true});
  els.studyScreen.addEventListener('touchend', function (e) {
    var start = swipeStart; swipeStart = null;
    if (!start || e.touches.length || app.modalOpen || app.scratchCard || app.marking || app.erasing) return;
    var touch = Array.prototype.find.call(e.changedTouches, function (t) {return t.identifier === start.id;});
    if (!touch) return;
    var direction = C.swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (direction === 1 && app.index < app.queue.length - 1) nextCard();
    else if (direction === -1 && app.index > 0) prevCard();
  }, {passive:true});
  els.studyScreen.addEventListener('touchcancel', function () {swipeStart = null;}, {passive:true});

  els.deckBtn.addEventListener('click', function () { openDecks(); });
  els.settingsBtn.addEventListener('click', openSettings);
  if (els.favBtn) els.favBtn.addEventListener('click', function () {
    var card = app.current;
    if (!card) return;
    card.fav = !card.fav;
    els.favBtn.classList.toggle('on', !!card.fav);
    els.favBtn.setAttribute('aria-pressed', String(!!card.fav));
    els.favBtn.setAttribute('aria-label', (card.fav ? '取消收藏 ' : '收藏 ') + card.term);
    store.save();
  });
  if (els.tocBtn) els.tocBtn.addEventListener('click', openToc);
  if (els.prevBtn) els.prevBtn.addEventListener('click', prevCard);
  // 品牌名始终一行；先让题库选择与图标间距收缩，仍放不下才等比缩小字号
  function fitBrandName() {
    var name = els.brandName;
    if (!name) return;
    var appbar = name.closest ? name.closest('.appbar') : null;
    name.style.fontSize = '';
    var base = parseFloat(getComputedStyle(name).fontSize) || 20;
    var size = base;
    var guard = 0;
    while (appbar && appbar.scrollWidth > appbar.clientWidth + 1 && size > 11 && guard < 40) {
      size = Math.max(11, size - 0.5);
      name.style.fontSize = size + 'px';
      guard += 1;
      void appbar.scrollWidth;
    }
  }

  els.brandHome.addEventListener('click', function () {
    if (app.phase === 'done' && app.doneKind === 'summary') return;
    if (app.phase === 'prompt' || app.phase === 'revealed' || app.phase === 'recall') {
      // 回到本轮第一张之前不现实，这里只把页面滚回顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  els.modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (app.scratchCard && !app.modalOpen) {closeDraft();return;}
      if (app.marking || app.erasing) {
        app.marking = false; app.erasing = false; clearSelection(); renderRevealed(); return;
      }
      if (app.modalOpen) { closeModal(); return; }
    }
    if (app.modalOpen) {
      if (e.key === 'Tab') {
        var items=Array.from(els.modal.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]')).filter(function(x){return x.getClientRects().length;});
        var first=items[0],last=items[items.length-1];
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
      return;
    }
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;

    if (e.key === 'ArrowLeft' && (app.phase === 'prompt' || app.phase === 'revealed' || app.phase === 'recall')) {
      e.preventDefault();
      prevCard();
      return;
    }

    if (app.phase === 'prompt') {
      var label = /^[a-e]$/i.test(e.key) ? e.key.toUpperCase() : /^[1-5]$/.test(e.key) ? 'ABCDE'[Number(e.key)-1] : '';
      if (label) { var input=els.answer.querySelector('input[value="'+label+'"]'); if(input) {e.preventDefault();input.click();} }
      if (e.key === 'Enter') { e.preventDefault(); rateCard(); }
      return;
    }
    if (app.phase === 'revealed' || app.phase === 'recall') {
      if (e.key === ' ' || e.key === 'Enter') {
        if (tag === 'BUTTON') return;
        e.preventDefault();
        nextCard();
      }
    }
  });

  // Android 返回键：先关弹层/调色盘，返回 true 表示已消费
  window.nkBack = function () {
    if (app.scratchCard && !app.modalOpen) {closeDraft();return true;}
    if (app.marking || app.erasing) {
      app.marking = false; app.erasing = false; clearSelection(); renderRevealed(); return true;
    }
    if (app.modalOpen) { closeModal(); return true; }
    return false;
  };

  // 点击遮罩关闭
  document.addEventListener('click', function (e) {
    if (app.modalOpen && e.target.classList && e.target.classList.contains('modal-backdrop')) {
      closeModal();
    }
  });

  /* ---------------- 启动 ---------------- */

  // 每晚 0:00 自动换日：重置每日目标额度，并把到期的卡重新排进本轮
  var lastDay = C.dateKey();
  function refreshIfNewDay() {
    var today = C.dateKey();
    if (today === lastDay) return;
    lastDay = today;
    store.ensureToday();
    var deck = store.activeDeck();
    if (app.phase === 'done' && app.doneKind === 'rest' && !(deck && deck.virtual)) startSession();
    else render();
  }
  function armMidnightRefresh() {
    var delay = Math.max(1000, C.addDays(Date.now(), 1) - Date.now() + 1000);
    setTimeout(function () {
      refreshIfNewDay();
      armMidnightRefresh();
    }, delay);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refreshIfNewDay();
  });

  function measureAppbar() {
    var bar = document.querySelector('.appbar');
    if (!bar) return;
    var h = Math.round(bar.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--appbar-h', h + 'px');
  }

  function boot() {
    measureAppbar();
    window.addEventListener('resize', measureAppbar);
    window.addEventListener('orientationchange', function () { setTimeout(measureAppbar, 120); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAppbar);
    fitBrandName();
    var brandFitFrame = null;
    window.addEventListener('resize', function () {
      if (brandFitFrame) cancelAnimationFrame(brandFitFrame);
      brandFitFrame = requestAnimationFrame(fitBrandName);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitBrandName);
    applyFontScale();
    store.ensureToday();
    lastDay = C.dateKey();
    document.getElementById('statsBtn').addEventListener('click',openStats);
    document.getElementById('draftBtn').addEventListener('click',openDraft);
    document.getElementById('addScratchBtn').addEventListener('click',addScratch);
    document.getElementById('closeScratchBtn').addEventListener('click',closeDraft);
    window.addEventListener('resize',function() {if(app.scratchCard) document.querySelectorAll('.scratch-note').forEach(function(node,i) {positionScratch(node,app.scratchCard.scratchBoxes[i]);});});
    document.getElementById('noteBtn').addEventListener('click',openNote);
    document.getElementById('sheetBtn').addEventListener('click',openToc);
    document.getElementById('bottomPrev').addEventListener('click',prevCard);
    document.getElementById('bottomNext').addEventListener('click',nextCard);
    document.getElementById('masterBtn').addEventListener('click',function(){if(app.current){app.current.mastered=!app.current.mastered;app.current.masteredUpdatedAt=Math.max(Date.now(),(app.current.masteredUpdatedAt||0)+1);store.saveNow();toast(app.current.mastered?'本题已斩':'已取消斩题');render();}});
    document.getElementById('memorizeBtn').addEventListener('click',function(){view.mode=view.mode==='memorize'?'practice':'memorize';if(app.current)presentPrompt(app.current);render();});
    startSession();
    armMidnightRefresh();
  }

  // 供 account.js 复用界面与状态
  window.MJZ.app = {
    get state() { return S; },
    get store() { return store; },
    replaceState: function (raw) {
      S = store.replaceState(raw);
      applyFontScale();
      startSession();
      return S;
    },
    // 群组分享的题库并入同名题库，避免每次导入都多出一个重名题库
    importDeck: function (name, cards) {
      var items = (cards || []).filter(function (c) {
        try { C.validateQuestion(c); return true; } catch(e) { return false; }
      });
      if (!items.length) return { deck: null, added: 0 };
      var wanted = (name || '群组题库').slice(0, 60);
      var deck = store.state.decks.filter(function (d) {
        return !d.virtual && d.name === wanted;
      })[0];
      if (!deck) deck = store.createDeck(wanted);
      var added = store.addCards(deck.id, items);
      return { deck: deck, added: added.length };
    },
    openModal: openModal,
    closeModal: closeModal,
    modalFoot: modalFoot,
    askConfirm: askConfirm,
    toast: toast,
    h: h
  };

  boot();
})();
