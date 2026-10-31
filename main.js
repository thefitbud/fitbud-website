// FitBud landing: client-count ladder, sticky-nav border and scroll reveal.
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // What a trainer's phone looks like at each client count. Illustrative only.
  var PINGS = [
    { k: "wa", i: "WA", t: "Neha", s: "Sent you a photo of lunch", m: "1:02 pm" },
    { k: "head", i: "!", t: "Reminder (in your head)", s: "Update Arjun's plan for next week", m: "" },
    { k: "wa", i: "WA", t: "Rohan", s: "Bro, forgot to log yesterday", m: "9:12 am" },
    { k: "sheet", i: "S", t: "Client tracker", s: "Week 6 column still empty for 4 clients", m: "" },
    { k: "wa", i: "WA", t: "Priya", s: "What workout today?", m: "7:40 am" },
    { k: "wa", i: "WA", t: "Meera", s: "How many reps for the lunges?", m: "7:52 am" },
    { k: "note", i: "N", t: "Notes", s: "Deepak: swap leg day? Check later", m: "" },
    { k: "wa", i: "WA", t: "Karthik", s: "Did you see my log?", m: "8:15 am" },
    { k: "wa", i: "WA", t: "Tanvi", s: "Can I do this tomorrow instead?", m: "8:31 am" },
    { k: "wa", i: "WA", t: "Varun", s: "What should I eat tonight?", m: "8:47 am" }
  ];
  var STEPS = [
    { n: 2, state: "Manageable.", note: "You remember who's doing what." },
    { n: 4, state: "Getting messy.", note: "You start scrolling back to find things." },
    { n: 7, state: "WhatsApp is becoming the database.", note: "Plans, logs and questions, all in one chat list." },
    { n: 10, state: "Something has to change.", note: "You're coaching less and coordinating more." }
  ];

  var list = document.getElementById("pings");
  var stateEl = document.getElementById("ladder-state");
  var noteEl = document.getElementById("ladder-note");
  var radios = Array.prototype.slice.call(document.querySelectorAll(".seg [role=radio]"));
  var current = -1;
  var timer = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function render(step) {
    if (step === current) return;
    current = step;
    var conf = STEPS[step];
    radios.forEach(function (r, i) {
      r.setAttribute("aria-checked", i === step ? "true" : "false");
      r.tabIndex = i === step ? 0 : -1;
    });
    stateEl.textContent = conf.state;
    noteEl.textContent = conf.note;
    list.textContent = "";
    // Newest first, so the pile visibly grows from the top.
    PINGS.slice(0, conf.n).reverse().forEach(function (p, idx) {
      var li = el("li", "ping");
      if (!reduced) li.style.animationDelay = idx * 60 + "ms";
      li.appendChild(el("span", "ping__icon ping__icon--" + p.k, p.i));
      var txt = el("span", "ping__text");
      txt.appendChild(el("b", "", p.t));
      txt.appendChild(el("span", "", p.s));
      li.appendChild(txt);
      li.appendChild(el("span", "ping__time", p.m));
      list.appendChild(li);
    });
  }

  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

  radios.forEach(function (r, i) {
    r.addEventListener("click", function () { stopAuto(); render(i); });
    r.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      stopAuto();
      var next = (i + d + radios.length) % radios.length;
      render(next);
      radios[next].focus();
    });
  });

  if (reduced) {
    render(3);
  } else {
    // Walk 5 → 10 → 15 → 20+ once, then rest on 20+.
    render(0);
    var s = 0;
    timer = setInterval(function () {
      s += 1;
      render(s);
      if (s >= STEPS.length - 1) stopAuto();
    }, 1800);
  }

  // Sticky nav gets a border once the page scrolls.
  var nav = document.querySelector(".nav");
  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Share link carries the page URL when it is served from a real address.
  var share = document.getElementById("share-wa");
  if (share && /^https?:/.test(location.protocol)) {
    share.href += encodeURIComponent(location.origin + location.pathname);
  }

  // Reveal sections as they enter the viewport.
  var targets = document.querySelectorAll(
    ".section__head, .tool, .punch, .split > *, .why, .chase, .reframe, .quote, .flow li, .browser, .closing__title"
  );
  if (!("IntersectionObserver" in window) || reduced) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  targets.forEach(function (t, i) {
    t.classList.add("reveal");
    t.style.transitionDelay = (i % 6) * 50 + "ms";
    io.observe(t);
  });
})();
