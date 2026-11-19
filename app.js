// FlowTV prototype logic.
// Real: browser speech recognition (Chrome/Edge) turns speech into text.
// Simulated (Wizard of Oz): understanding the request, searching services and
// scenes, and starting playback. resolve() below stands in for the future AI
// agent by matching the request against the sample catalog in catalog.js.

(function () {
  "use strict";

  var CATALOG = window.FLOW_CATALOG;
  var LAST = window.FLOW_LAST_WATCHED;
  var ELSEWHERE = window.FLOW_NOT_IN_ROOM || [];
  var byId = {};
  CATALOG.forEach(function (it) { byId[it.id] = it; });

  var ctx = { current: null, pending: null, confirm: null, alts: [], misses: 0 };
  var busy = false;

  var $ = function (id) { return document.getElementById(id); };
  var tv = $("tv"), input = $("ask-input"), statusEl = $("status");
  var heardEl = $("heard-text"), stepsEl = $("steps"), outEl = $("out");

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STEP_MS = reduced ? 0 : 320;

  // ---------- helpers ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[^a-z0-9' ]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  function has(t, phrase) { return (" " + t + " ").indexOf(" " + norm(phrase) + " ") !== -1; }
  function secs(hms) {
    var p = hms.split(":").map(Number);
    return p[0] * 3600 + p[1] * 60 + p[2];
  }
  function sourceLabel(it) {
    return it.source === "cable" ? "Local cable, Ch. " + it.channel : it.service + ", already signed in";
  }
  function metaLine(it) {
    return [it.year, it.kind, sourceLabel(it)].filter(Boolean).join(" · ");
  }
  function bg(it) {
    return "background: radial-gradient(110% 90% at 80% 10%, " + it.colors[0] + " 0%, " + it.colors[1] + " 75%);";
  }
  function scoreItem(t, it) {
    var s = 0;
    Object.keys(it.keys).forEach(function (k) { if (has(t, k)) s += it.keys[k]; });
    return s;
  }

  // ---------- the simulated "AI" ----------
  var SCENE_CUE = /\b(part|scene|go back to|skip to|skip ahead|jump to|back to|right after|right before|rewind)\b/;
  var RESUME = /\b(what was i watching|keep watching|continue watching|pick up where|where i left off|resume|what i was watching)\b/;
  // "Not that one" and friends: the resident takes back control from a wrong result
  var REJECT = /\b(not that one|not that|not this one|wrong one|wrong movie|wrong show|that's wrong|thats wrong|none of these|none of those|neither|stop)\b|^(no|nope|no thanks)\b/;
  var YES = /^(yes|yeah|yep|yup|sure|ok|okay|please|play it|yes please|that's it|thats it|that one)\b/;
  // Ordinals only count when they clearly mean a position, so "the shark one" is NOT "number one"
  var ORDINALS = [
    /\b(first|1st|number one|number 1)\b|^(one|1)$/,
    /\b(second|2nd|number two|number 2|middle)\b|^(two|2)$/,
    /\b(third|3rd|number three|number 3|last)\b|^(three|3)$/
  ];

  function elsewhere(t) {
    var best = null;
    ELSEWHERE.forEach(function (e) { var s = scoreItem(t, e); if (s > 0 && (!best || s > best.s)) best = { e: e, s: s }; });
    return best;
  }

  function resolve(raw) {
    var t = norm(raw);
    if (!t) return { type: "empty" };

    // Answer to "Did you mean X?"
    if (ctx.confirm) {
      if (YES.test(t)) return { type: ctx.confirm.source === "cable" ? "live" : "play", item: ctx.confirm, match: "confirmed by resident" };
      if (REJECT.test(t)) return { type: "reject", alts: ctx.alts };
    }

    // Answer to "Which one did you mean?": title and description words win over ordinals
    if (ctx.pending) {
      var opts = ctx.pending;
      if (REJECT.test(t)) return { type: "reject", alts: [] };
      var ranked = opts.map(function (it) { return { it: it, s: scoreItem(t, it) }; }).sort(function (a, b) { return b.s - a.s; });
      if (ranked[0].s > 0 && (!ranked[1] || ranked[0].s > ranked[1].s)) {
        return { type: "play", item: ranked[0].it, match: "picked from options by description", others: opts.filter(function (o) { return o !== ranked[0].it; }) };
      }
      for (var i = 0; i < ORDINALS.length && i < opts.length; i++) {
        if (ORDINALS[i].test(t)) return { type: "play", item: opts[i], match: "picked from options by number", others: opts.filter(function (o, j) { return j !== i; }) };
      }
    }

    // "Not that one" while something is playing
    if (ctx.current && REJECT.test(t)) return { type: "reject", alts: ctx.alts };

    if (RESUME.test(t)) return { type: "resume", item: byId[LAST.id], match: "watch history" };

    var scored = CATALOG.map(function (it) { return { it: it, s: scoreItem(t, it) }; });

    // Jump to a moment inside a title
    if (SCENE_CUE.test(t)) {
      var pick = null;
      scored.forEach(function (row) {
        row.it.scenes.forEach(function (sc) {
          var hits = sc.keys.filter(function (k) { return has(t, k); }).length;
          if (!hits) return;
          var rank = hits * 3 + row.s + (row.it.id === ctx.current ? 3 : 0);
          if (!pick || rank > pick.rank) pick = { item: row.it, scene: sc, rank: rank };
        });
      });
      if (pick) return { type: "scene", item: pick.item, scene: pick.scene, match: "scene index" };
    }

    scored = scored.filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    var top = scored[0];
    var other = elsewhere(t);

    // A real title that just isn't on this room's services
    if (other && (!top || other.s > top.s)) {
      return { type: "unavailable", title: other.e.title, kind: other.e.kind, similar: other.e.similar.map(function (id) { return byId[id]; }) };
    }
    if (!top || top.s < 2) return { type: "notfound", sceneMiss: SCENE_CUE.test(t) && ctx.current };

    var close = scored.filter(function (r) { return r.s >= 2 && r.s >= top.s * 0.7; }).slice(0, 3);
    if (close.length > 1) return { type: "clarify", options: close.map(function (r) { return r.it; }) };

    var alts = scored.slice(1, 3).map(function (r) { return r.it; });
    // Weak, single match: ask before playing instead of guessing
    if (top.s < 4) return { type: "confirm", item: top.it, alts: alts };

    return { type: top.it.source === "cable" ? "live" : "play", item: top.it, match: "strong match", others: alts };
  }

  // ---------- what the "AI" reports ----------
  function plan(r, heard) {
    var it = r.item;
    switch (r.type) {
      case "play":
        return {
          steps: [["Turned speech into text"], ["Understood: play a " + it.kind.toLowerCase()], ["Matched “" + it.title + "”" + (it.year ? " (" + it.year + ")" : "") + (r.match && r.match.indexOf("options") > -1 ? ", from her answer" : "")], ["Found it on " + it.service + ", already signed in"], ["Opened it with a deep link"]],
          out: { intent: "play_title", query: heard, title: it.title, year: it.year, source: "streaming", service: it.service, start_at: "0:00:00", action: "deep_link", match: r.match, undo: "say “not that one”" }
        };
      case "live":
        return {
          steps: [["Turned speech into text"], ["Understood: watch live TV"], ["Matched “" + it.title + "”"], ["It's on local cable, channel " + it.channel], ["Switched the TV to the cable box"]],
          out: { intent: "watch_live", query: heard, program: it.title, source: "local_cable", channel: it.channel, action: "switch_input", match: r.match, undo: "say “not that one”" }
        };
      case "scene":
        return {
          steps: [["Turned speech into text"], ["Understood: jump to a moment"], ["Matched “" + it.title + "”" + (it.id === ctx.current ? " (already playing)" : "")], ["Looked up the moment in the scene index: " + r.scene.at], ["Opened it at that timestamp"]],
          out: { intent: "jump_to_scene", query: heard, title: it.title, moment: r.scene.label, start_at: r.scene.at, service: it.service, action: "deep_link_with_timestamp", match: r.match, undo: "say “not that one”" }
        };
      case "resume":
        return {
          steps: [["Turned speech into text"], ["Understood: pick up where they left off"], ["Looked up Room 214's watch history"], ["Last watched: " + it.title + ", " + LAST.episode], ["Opened it at " + LAST.at]],
          out: { intent: "resume", query: heard, title: it.title, episode: LAST.episode, start_at: LAST.at, service: it.service, action: "deep_link_with_timestamp", match: r.match, undo: "say “not that one”" }
        };
      case "clarify":
        return {
          steps: [["Turned speech into text"], ["Understood: play something"], [r.options.length + " titles match about equally", true], ["Asked which one she meant instead of guessing", true]],
          out: { intent: "play_title", query: heard, candidates: r.options.map(function (o) { return o.title; }), action: "ask_follow_up" }
        };
      case "confirm":
        return {
          steps: [["Turned speech into text"], ["Only a weak match: “" + it.title + "”", true], ["Asked her to confirm before playing", true]],
          out: { intent: "play_title", query: heard, best_guess: it.title, match: "weak", action: "ask_to_confirm" }
        };
      case "reject":
        return {
          steps: [["Turned speech into text"], ["Understood: that was the wrong thing", true], ["Stopped playback"], [r.alts && r.alts.length ? "Offered the other close matches" : "Asked her to say it another way", true]],
          out: { intent: "reject_result", query: heard, action: "stop_and_reoffer", offered: (r.alts || []).map(function (o) { return o.title; }) }
        };
      case "unavailable":
        return {
          steps: [["Turned speech into text"], ["Recognized “" + r.title + "”"], ["Not on Room 214's services", true], ["Offered similar things she does have", true]],
          out: { intent: "play_title", query: heard, title: r.title, available: false, action: "explain_and_suggest", suggested: r.similar.map(function (o) { return o.title; }) }
        };
      case "notfound":
        var flag = ctx.misses >= 2;
        var s = [["Turned speech into text"], [r.sceneMiss ? "Couldn't find that moment" : "No show, movie, or channel matched", true], ["Repeated back what it heard and suggested things to try", true]];
        if (flag) s.push(["Would flag Room 214 for staff (demo only, nothing sent)", true]);
        return { steps: s, out: { intent: "unknown", query: heard, action: "suggest_examples", staff_alert: flag ? "simulated, not sent" : "none" } };
      default:
        return { steps: [["Didn't hear anything", true], ["Asked her to try again", true]], out: { intent: "none", query: "", action: "reprompt" } };
    }
  }

  // ---------- TV screens ----------
  var MIC_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

  function showHome(listening, interim) {
    tv.innerHTML =
      '<div class="screen home' + (listening ? " listening" : "") + '">' +
        '<div class="orb">' + MIC_SVG + "</div>" +
        '<div class="mid">' + (listening ? "Listening…" : "Good afternoon, Margaret.<br>What would you like to watch?") + "</div>" +
        (listening ? '<div class="interim" id="interim">' + esc(interim || "") + "</div>"
                   : '<div class="hint">Just ask, like “Put on the Cubs game.”</div>') +
      "</div>";
  }

  function showThinking(heard) {
    tv.innerHTML =
      '<div class="screen thinking">' +
        '<div class="quote"><small>Margaret said</small>' + esc(heard) + "</div>" +
        '<div class="dots" aria-label="Working"><i></i><i></i><i></i></div>' +
      "</div>";
  }

  function bar(at, runtime) {
    var p = Math.max(0.4, Math.min(99, (secs(at) / secs(runtime)) * 100));
    var edge = p < 8 ? " edge" : "";
    return '<div class="bar"><i style="width:' + p.toFixed(1) + '%"></i><b class="' + edge.trim() + '" style="left:' + (edge ? 0 : p.toFixed(1)) + '%">' + at + "</b></div>";
  }

  var NOT_THAT = '<button type="button" class="notthat" data-say="Not that one">Not that one?<small>Say “not that one”</small></button>';

  function optionCards(list, sayNumbers) {
    return '<div class="options">' + list.map(function (o, i) {
      return '<button type="button" class="opt" data-say="' + esc(sayNumbers ? "Number " + (i + 1) : "Put on " + o.title) + '" style="' + bg(o) + '">' +
        '<span class="n">' + (sayNumbers ? "Say “number " + (i + 1) + "”" : "Say “" + esc(o.title) + "”") + '</span><span class="t">' + esc(o.title) + '</span><span class="m">' + esc([o.year, o.kind].filter(Boolean).join(" · ")) + "</span></button>";
    }).join("") + "</div>";
  }

  function showResult(r, heard) {
    var it = r.item, html = "";
    if (r.type === "play" || r.type === "scene" || r.type === "resume") {
      var at = r.type === "scene" ? r.scene.at : r.type === "resume" ? LAST.at : "0:00:00";
      var pills = r.type === "scene"
        ? '<span class="pill">Jumped to ' + at + ", " + esc(r.scene.label) + "</span>"
        : r.type === "resume"
          ? '<span class="pill">Picked up ' + esc(LAST.episode) + " at " + at + "</span>"
          : '<span class="pill">Opened in 0.7 s</span>';
      html =
        '<div class="screen" style="' + bg(it) + '">' + NOT_THAT +
          '<div class="eyebrow">Now playing</div>' +
          '<div class="big">' + esc(it.title) + "</div>" +
          '<div class="meta">' + esc(metaLine(it)) + "</div>" +
          '<div class="spacer"></div>' +
          '<div class="pills">' + pills + "</div>" +
          bar(at, it.runtime) +
        "</div>";
    } else if (r.type === "live") {
      var bug = it.live
        ? '<div class="score"><span>' + it.live.away + " " + it.live.awayScore + '</span><span class="h">' + it.live.home + " " + it.live.homeScore + '</span><span class="inn">' + it.live.status + "</span></div>"
        : "";
      html =
        '<div class="screen" style="' + bg(it) + '">' + bug + NOT_THAT +
          '<div class="spacer"></div>' +
          '<div class="eyebrow">Live on local cable · Channel ' + it.channel + "</div>" +
          '<div class="big">' + esc(it.title) + "</div>" +
          '<div class="pills"><span class="pill live">Live</span><span class="pill">Switched from streaming to cable in 1.1 s</span></div>' +
        "</div>";
    } else if (r.type === "clarify") {
      html =
        '<div class="screen thinking">' +
          '<div class="eyebrow">Quick question</div>' +
          '<div class="mid">Which one did you mean?</div>' +
          optionCards(r.options, true) +
          '<div class="spacer"></div>' +
          '<div class="meta">Say the number, or describe it, like “the shark one.” Say “none of these” to start over.</div>' +
        "</div>";
    } else if (r.type === "confirm") {
      html =
        '<div class="screen thinking">' +
          '<div class="eyebrow">Just checking</div>' +
          '<div class="mid">Did you mean ' + esc(it.title) + "?</div>" +
          optionCards([it], false).replace('data-say="Put on ' + esc(it.title) + '"', 'data-say="Yes"') +
          '<div class="yn"><button type="button" class="ynb yes" data-say="Yes">Yes, play it</button><button type="button" class="ynb" data-say="No">No, something else</button></div>' +
          '<div class="spacer"></div>' +
          '<div class="meta">I wasn’t sure, so I didn’t start it yet. Say “yes” or “no.”</div>' +
        "</div>";
    } else if (r.type === "reject") {
      var has2 = r.alts && r.alts.length;
      html =
        '<div class="screen thinking">' +
          '<div class="eyebrow">Stopped</div>' +
          '<div class="mid">' + (has2 ? "Sorry about that. Did you mean one of these?" : "Sorry about that. Tell me another way, like the title or who’s in it.") + "</div>" +
          (has2 ? optionCards(r.alts, true) : "") +
          '<div class="spacer"></div>' +
          '<div class="meta">' + (has2 ? "Or say the title, or “none of these.”" : "Tap the mic and try again.") + "</div>" +
        "</div>";
    } else if (r.type === "unavailable") {
      html =
        '<div class="screen oops">' +
          '<div class="eyebrow">Not on your services</div>' +
          '<div class="mid">I heard “' + esc(r.title) + '.” It isn’t on Room 214’s services right now.</div>' +
          '<div class="meta">Here are a couple you do have:</div>' +
          optionCards(r.similar, false) +
          '<div class="spacer"></div>' +
          '<div class="pills"><span class="pill warn">In the real product, staff could add it to the room. Demo only: no request is sent.</span></div>' +
        "</div>";
    } else if (r.type === "notfound") {
      var flagged = ctx.misses >= 2;
      html =
        '<div class="screen oops">' +
          '<div class="eyebrow">' + (r.sceneMiss ? "Couldn’t find that moment" : "Not sure what to play") + "</div>" +
          '<div class="mid">' + (r.sceneMiss ? "I couldn’t find that part. Try describing it another way." : "I heard “" + esc(heard) + ",” but that isn’t something I can play.") + "</div>" +
          '<div class="meta">Try one of these:</div>' +
          '<div class="tries"><button type="button" class="try" data-say="Put on The Golden Girls">“Put on The Golden Girls”</button><button type="button" class="try" data-say="The movie with the shark">“The movie with the shark”</button><button type="button" class="try" data-say="Put on the news">“Put on the news”</button></div>' +
          '<div class="spacer"></div>' +
          (flagged ? '<div class="pills"><span class="pill warn">Demo only: no real alert was sent. In the real product, staff would see Room 214 needs a hand.</span></div>' : "") +
        "</div>";
    } else {
      html =
        '<div class="screen oops">' +
          '<div class="eyebrow">I didn’t catch that</div>' +
          '<div class="mid">Try again and say what you want to watch.</div>' +
          '<div class="meta">A title, an actor, or what happens in it all work.</div>' +
        "</div>";
    }
    tv.innerHTML = html;
  }

  // ---------- under the hood panel ----------
  function renderSteps(steps, upto) {
    stepsEl.innerHTML = steps.map(function (s, i) {
      return '<li class="' + (i < upto ? "done" : "") + (s[1] ? " warn" : "") + '"><span>' + esc(s[0]) + "</span></li>";
    }).join("");
  }

  // ---------- main flow ----------
  function ask(raw, opts) {
    if (busy) return;
    opts = opts || {};
    var heard = String(raw || "").trim();
    statusEl.textContent = "";
    var r = resolve(heard);

    if (r.type === "notfound") ctx.misses++;
    else if (r.type !== "empty" && r.type !== "clarify") ctx.misses = 0;

    var p = plan(r, heard);
    heardEl.textContent = heard ? "“" + heard + "”" + (opts.voice ? " (spoken)" : "") : "Nothing";
    outEl.textContent = "Working…";
    renderSteps(p.steps, 0);

    busy = true;
    if (heard) showThinking(heard);
    var i = 0;
    (function next() {
      if (i < p.steps.length) {
        renderSteps(p.steps, ++i);
        return setTimeout(next, STEP_MS);
      }
      busy = false;
      outEl.textContent = JSON.stringify(p.out, null, 2);
      // update conversation state
      ctx.pending = r.type === "clarify" ? r.options : (r.type === "reject" && r.alts && r.alts.length ? r.alts : null);
      ctx.confirm = r.type === "confirm" ? r.item : null;
      if (r.type === "confirm") ctx.alts = r.alts || [];
      if (r.type === "play" || r.type === "live" || r.type === "scene" || r.type === "resume") {
        ctx.current = r.item.id;
        ctx.alts = r.others || [];
      }
      if (r.type === "reject") ctx.current = null;
      showResult(r, heard);
      input.value = "";
    })();
  }

  // ---------- speech (real) ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false, gotFinal = false, lastInterim = "";
  var micBtn = $("mic");

  function stopListening() {
    listening = false;
    micBtn.classList.remove("on");
    micBtn.setAttribute("aria-label", "Tap to talk");
  }

  micBtn.addEventListener("click", function () {
    if (busy) return;
    if (!SR) {
      statusEl.textContent = "Voice input needs Chrome or Edge. Type the request instead.";
      input.focus();
      return;
    }
    if (listening && rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    gotFinal = false; lastInterim = "";
    rec.onresult = function (e) {
      var text = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) gotFinal = true;
      }
      lastInterim = text;
      input.value = text;
      var el = document.getElementById("interim");
      if (el) el.textContent = text;
      if (gotFinal) { rec.stop(); }
    };
    rec.onerror = function (e) {
      stopListening();
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        statusEl.textContent = "The microphone is blocked. Allow it in the address bar, or open the prototype in its own tab. You can also type.";
        showHome(false);
      } else if (e.error === "audio-capture") {
        statusEl.textContent = "No microphone was found. Type the request instead.";
        showHome(false);
      } else if (e.error === "no-speech") {
        ask("", { voice: true });
      }
      rec = null;
    };
    rec.onend = function () {
      var was = listening;
      stopListening();
      if (was && rec) { rec = null; ask(lastInterim, { voice: true }); }
    };
    try {
      rec.start();
      listening = true;
      micBtn.classList.add("on");
      micBtn.setAttribute("aria-label", "Stop listening");
      statusEl.textContent = "";
      showHome(true, "");
    } catch (err) {
      stopListening();
      statusEl.textContent = "Couldn't start the microphone. Type the request instead.";
    }
  });

  // ---------- typing, samples, options ----------
  $("ask-form").addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });

  tv.addEventListener("click", function (e) {
    var b = e.target.closest("[data-say]");
    if (!b || busy) return;
    ask(b.getAttribute("data-say"));
  });

  var SAMPLES = [
    ["Movie", "Put on the movie where the ship sinks with Leonardo DiCaprio"],
    ["Live TV", "Put on the Cubs game"],
    ["Scene", "Go back to right after Sonny gets killed"],
    ["Unclear", "Put on that boat movie"],
    ["Not on her services", "Put on Bonanza"],
    ["Not sure", "Put on the beach movie"],
    ["Not TV", "Turn the heat up"]
  ];
  $("chips").innerHTML = SAMPLES.map(function (s, i) {
    return '<button type="button" class="chip" data-i="' + i + '"><b>' + s[0] + "</b>" + esc(s[1]) + "</button>";
  }).join("");
  $("chips").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b || busy) return;
    var s = SAMPLES[+b.getAttribute("data-i")][1];
    input.value = s;
    ask(s);
  });

  $("reset").addEventListener("click", function () {
    if (busy) return;
    if (rec) { try { rec.abort(); } catch (e) {} rec = null; }
    stopListening();
    ctx = { current: null, pending: null, confirm: null, alts: [], misses: 0 };
    heardEl.textContent = "Nothing yet";
    stepsEl.innerHTML = "";
    outEl.textContent = "{ }";
    statusEl.textContent = "";
    showHome(false);
  });

  showHome(false);
  window.__flowResolve = resolve; // exposed for quick testing in the console
})();
