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

  // Walkthrough: tabs on wide screens; on narrow screens every panel shows in a swipeable row.
  var walk = document.querySelector("[data-walk]");
  if (walk) {
    var tabs = Array.prototype.slice.call(walk.querySelectorAll("[role=tab]"));
    var panels = Array.prototype.slice.call(walk.querySelectorAll("[role=tabpanel]"));
    var select = function (idx, focus) {
      tabs.forEach(function (t, i) {
        var on = i === idx;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[idx].focus();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(i, false); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        select((i + d + tabs.length) % tabs.length, true);
      });
    });
    select(0, false);
  }

  // Mobile sticky CTA: shows once the hero CTA is out of view, hides at the signup form.
  var sticky = document.getElementById("stickycta");
  var heroCta = document.querySelector(".hero .cta-row");
  var signupSection = document.getElementById("early-access");
  if (sticky && heroCta && signupSection && "IntersectionObserver" in window) {
    var heroVisible = true, signupVisible = false;
    var sync = function () {
      var on = !heroVisible && !signupVisible;
      sticky.classList.toggle("is-on", on);
      sticky.setAttribute("aria-hidden", on ? "false" : "true");
      sticky.querySelector("a").tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(function (es) { heroVisible = es[0].isIntersecting || es[0].boundingClientRect.top > 0; sync(); }).observe(heroCta);
    new IntersectionObserver(function (es) { signupVisible = es[0].isIntersecting; sync(); }).observe(signupSection);
  }

  // Early-access form. Posts to the Google Apps Script web app in data-endpoint,
  // which appends a row to the sign-up sheet (see sheets/README.md).
  var form = document.getElementById("signup");
  if (form) {
    var msg = document.getElementById("signup-msg");
    var btn = form.querySelector("button[type=submit]");
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var say = function (text, kind) {
      msg.textContent = text;
      msg.classList.toggle("is-error", kind === "error");
      msg.classList.toggle("is-ok", kind === "ok");
    };
    var fieldError = function (id, text) {
      document.getElementById(id).textContent = text || "";
    };
    var contactKind = function (v) {
      if (EMAIL.test(v)) return "email";
      var digits = v.replace(/[\s()+-]/g, "");
      return /^\d{10,13}$/.test(digits) ? "phone" : "";
    };

    var validate = function () {
      var f = form.elements, first = null;
      var mark = function (el, errId, text) {
        fieldError(errId, text);
        if (el.setAttribute) el.setAttribute("aria-invalid", text ? "true" : "false");
        if (text && !first) first = el;
      };
      var name = f.name.value.trim();
      mark(f.name, "f-name-err", name ? "" : "Please add your name.");
      var contact = f.contact.value.trim();
      mark(f.contact, "f-contact-err", !contact ? "Please add an email or WhatsApp number."
        : contactKind(contact) ? "" : "That doesn't look like an email or a phone number.");
      var mode = form.querySelector("input[name=mode]:checked");
      mark(form.querySelector("input[name=mode]"), "f-mode-err", mode ? "" : "Please pick how you coach.");
      var clients = form.querySelector("input[name=clients]:checked");
      mark(form.querySelector("input[name=clients]"), "f-clients-err", clients ? "" : "Please pick a client count.");
      return first;
    };

    // Clear a field's error as soon as it is edited.
    var ERR = { name: "f-name-err", contact: "f-contact-err", mode: "f-mode-err", clients: "f-clients-err" };
    var clearOnEdit = function (e) {
      if (!ERR[e.target.name]) return;
      fieldError(ERR[e.target.name], "");
      e.target.setAttribute("aria-invalid", "false");
      if (e.target.type === "radio") form.querySelector("input[name=" + e.target.name + "]").setAttribute("aria-invalid", "false");
    };
    form.addEventListener("input", clearOnEdit);
    form.addEventListener("change", clearOnEdit);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      say("");
      var bad = validate();
      if (bad) { bad.focus(); return; }

      var endpoint = form.getAttribute("data-endpoint");
      if (!endpoint) { say("Sign-ups aren't connected yet. Please check back soon.", "error"); return; }

      var contact = form.elements.contact.value.trim();
      var body = new URLSearchParams({
        name: form.elements.name.value.trim(),
        contact: contact,
        contactType: contactKind(contact),
        mode: form.querySelector("input[name=mode]:checked").value,
        clients: form.querySelector("input[name=clients]:checked").value,
        website: form.elements.website.value,
        page: location.href.split("#")[0],
        referrer: document.referrer || ""
      });

      btn.disabled = true;
      btn.textContent = "Sending…";
      // URL-encoded body keeps this a "simple" request, which Apps Script accepts without CORS preflight.
      fetch(endpoint, { method: "POST", body: body })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (!res || !res.ok) throw new Error((res && res.error) || "failed");
          form.reset();
          say("You're on the list. We'll be in touch as we open FitBud to more trainers.", "ok");
        })
        .catch(function () { say("That didn't go through. Please check your connection and try again.", "error"); })
        .then(function () { btn.disabled = false; btn.textContent = "Join the early-access list"; });
    });
  }

  // Reveal sections as they enter the viewport.
  var targets = document.querySelectorAll(
    ".section__head, .tools, .punch, .ownapp, .helps, .split > *, .why, .answers, .quote, .walk, .note, .closing__grid > *"
  );
  if (!("IntersectionObserver" in window) || reduced) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  targets.forEach(function (t, i) {
    t.classList.add("reveal");
    t.style.transitionDelay = (i % 4) * 50 + "ms";
    io.observe(t);
  });
})();
