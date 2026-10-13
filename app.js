// FlowTV prototype logic.
// Real: browser speech recognition (Chrome/Edge) turns speech into text.
// Simulated (Wizard of Oz): understanding the request, searching services and
// scenes, and starting playback. resolve() below stands in for the future AI
// agent by matching the request against the sample catalog in catalog.js.

(function () {
  "use strict";

  var CATALOG = window.FLOW_CATALOG;
  var LAST = window.FLOW_LAST_WATCHED;
  var byId = {};
  CATALOG.forEach(function (it) { byId[it.id] = it; });

  var ctx = { current: null, pending: null, misses: 0 };
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
  var SCENE_CUE = /\b(part|scene|go back|skip to|skip ahead|jump to|back to|right after|right before|rewind)\b/;
  var RESUME = /\b(what was i watching|keep watching|continue watching|pick up where|where i left off|resume|what i was watching)\b/;
  var ORDINALS = [
    /\b(first|1st|one|top|1)\b/,
    /\b(second|2nd|two|middle|2)\b/,
    /\b(third|3rd|three|last|3)\b/
  ];

  function resolve(raw) {
    var t = norm(raw);
    if (!t) return { type: "empty" };

    // Follow-up to a clarifying question
    if (ctx.pending) {
      var opts = ctx.pending;
      for (var i = 0; i < ORDINALS.length && i < opts.length; i++) {
        if (ORDINALS[i].test(t)) return { type: "play", item: opts[i], via: "clarify" };
      }
      var best = null, bestS = 0;
      opts.forEach(function (it) { var s = scoreItem(t, it); if (s > bestS) { bestS = s; best = it; } });
      if (best) return { type: "play", item: best, via: "clarify" };
    }

    if (RESUME.test(t)) return { type: "resume", item: byId[LAST.id] };

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
      if (pick) return { type: "scene", item: pick.item, scene: pick.scene, conf: Math.min(0.97, 0.6 + pick.rank / 30) };
    }

    scored = scored.filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; });
    var top = scored[0];
    if (!top || top.s < 2) return { type: "notfound", sceneMiss: SCENE_CUE.test(t) && ctx.current };

    var close = scored.filter(function (r) { return r.s >= 2 && r.s >= top.s * 0.7; }).slice(0, 3);
    if (close.length > 1) return { type: "clarify", options: close.map(function (r) { return r.it; }) };

    var second = scored[1] ? scored[1].s : 0;
    var conf = Math.max(0.6, Math.min(0.98, top.s / (top.s + second + 1.5)));
    return { type: top.it.source === "cable" ? "live" : "play", item: top.it, conf: conf };
  }

  // ---------- what the "AI" reports ----------
  function plan(r, heard) {
    var it = r.item;
    switch (r.type) {
      case "play":
        return {
          steps: [["Turned speech into text"], ["Understood: play a " + it.kind.toLowerCase()], ["Matched “" + it.title + "”" + (it.year ? " (" + it.year + ")" : "")], ["Found it on " + it.service + ", already signed in"], ["Opened it with a deep link"]],
          out: { intent: "play_title", query: heard, title: it.title, year: it.year, source: "streaming", service: it.service, signed_in: true, start_at: "0:00:00", action: "deep_link", confidence: +(r.conf || 0.95).toFixed(2) }
        };
      case "live":
        return {
          steps: [["Turned speech into text"], ["Understood: watch live TV"], ["Matched “" + it.title + "”"], ["It's on local cable, channel " + it.channel], ["Switched the TV to the cable box"]],
          out: { intent: "watch_live", query: heard, program: it.title, source: "local_cable", channel: it.channel, action: "switch_input", confidence: +r.conf.toFixed(2) }
        };
      case "scene":
        return {
          steps: [["Turned speech into text"], ["Understood: jump to a moment"], ["Matched “" + it.title + "”" + (it.id === ctx.current ? " (already playing)" : "")], ["Searched captions and scenes: " + r.scene.at], ["Opened it at that timestamp"]],
          out: { intent: "jump_to_scene", query: heard, title: it.title, moment: r.scene.label, start_at: r.scene.at, matched_on: ["captions", "scene descriptions"], service: it.service, action: "deep_link_with_timestamp", confidence: +r.conf.toFixed(2) }
        };
      case "resume":
        return {
          steps: [["Turned speech into text"], ["Understood: pick up where they left off"], ["Looked up Room 214's watch history"], ["Last watched: " + it.title + ", " + LAST.episode], ["Opened it at " + LAST.at]],
          out: { intent: "resume", query: heard, title: it.title, episode: LAST.episode, start_at: LAST.at, service: it.service, action: "deep_link_with_timestamp", confidence: 0.96 }
        };
      case "clarify":
        return {
          steps: [["Turned speech into text"], ["Understood: play something"], [r.options.length + " titles match about equally", true], ["Asked which one they meant", true]],
          out: { intent: "play_title", query: heard, candidates: r.options.map(function (o) { return o.title; }), action: "ask_follow_up" }
        };
      case "notfound":
        var flag = ctx.misses >= 2;
        var s = [["Turned speech into text"], [r.sceneMiss ? "Couldn't find that moment" : "No show, movie, or channel matched", true], ["Suggested things to try", true]];
        if (flag) s.push(["Flagged Room 214 on the staff dashboard", true]);
        return { steps: s, out: { intent: "unknown", query: heard, action: "suggest_examples", notify_staff: flag } };
      default:
        return { steps: [["Didn't hear anything", true], ["Asked them to try again", true]], out: { intent: "none", query: "", action: "reprompt" } };
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

  function showResult(r) {
    var it = r.item, html = "";
    if (r.type === "play" || r.type === "scene" || r.type === "resume") {
      var at = r.type === "scene" ? r.scene.at : r.type === "resume" ? LAST.at : "0:00:00";
      var pills = r.type === "scene"
        ? '<span class="pill">Jumped to ' + at + ", " + esc(r.scene.label) + "</span>"
        : r.type === "resume"
          ? '<span class="pill">Picked up ' + esc(LAST.episode) + " at " + at + "</span>"
          : '<span class="pill">Opened in 0.7 s</span>';
      html =
        '<div class="screen" style="' + bg(it) + '">' +
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
        '<div class="screen" style="' + bg(it) + '">' + bug +
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
          '<div class="options">' + r.options.map(function (o, i) {
            return '<button type="button" class="opt" data-pick="' + i + '" style="' + bg(o) + '">' +
              '<span class="n">Say “number ' + (i + 1) + '”</span><span class="t">' + esc(o.title) + '</span><span class="m">' + esc([o.year, o.kind].filter(Boolean).join(" · ")) + "</span></button>";
          }).join("") + "</div>" +
          '<div class="spacer"></div>' +
          '<div class="meta">Or say the title.</div>' +
        "</div>";
    } else if (r.type === "notfound") {
      var flagged = ctx.misses >= 2;
      html =
        '<div class="screen oops">' +
          '<div class="eyebrow">' + (r.sceneMiss ? "Couldn't find that moment" : "Not sure what to play") + "</div>" +
          '<div class="mid">' + (r.sceneMiss ? "I couldn't find that part. Try describing it another way." : "I can play movies, shows, and live TV. Try saying:") + "</div>" +
          "<ul><li>Put on The Golden Girls</li><li>The movie with the shark</li><li>Put on the news</li></ul>" +
          '<div class="spacer"></div>' +
          (flagged ? '<div class="pills"><span class="pill warn">I’ve let the staff know you might need a hand</span></div>' : "") +
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
      ctx.pending = r.type === "clarify" ? r.options : null;
      if (r.item && r.type !== "clarify") ctx.current = r.item.id;
      showResult(r);
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
    var b = e.target.closest("[data-pick]");
    if (!b || busy) return;
    ask("Number " + (+b.getAttribute("data-pick") + 1));
  });

  var SAMPLES = [
    ["Movie", "Put on the movie where the ship sinks with Leonardo DiCaprio"],
    ["Live TV", "Put on the Cubs game"],
    ["Scene", "Go back to right after Sonny gets killed"],
    ["Unclear", "Put on that boat movie"],
    ["Resume", "What was I watching yesterday?"],
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
    ctx = { current: null, pending: null, misses: 0 };
    heardEl.textContent = "Nothing yet";
    stepsEl.innerHTML = "";
    outEl.textContent = "{ }";
    statusEl.textContent = "";
    showHome(false);
  });

  showHome(false);
  window.__flowResolve = resolve; // exposed for quick testing in the console
})();
