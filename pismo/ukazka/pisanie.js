/* ARLing Draw: malý pomocník bez závislostí.
   1) Nadpis s triedou .napis rozdelí na písmená a nechá ich napísať po sebe (os DRAW 0 až 1000).
      Kerning zachová: pred rozdelením odmeria polohy písmen a rozdiely doplní ako margin v em.
   2) Po dopísaní (data-dychanie="1") pridá triedu .dychaj (pomalé dýchanie hrúbky).
   3) Posuvníky s data-os nastavujú vlastnosti --draw a --wght na prvkoch z data-ciel.
   Pri prefers-reduced-motion nič nerozdeľuje: text je hneď celý (rieši aj CSS). */
(function () {
  "use strict";

  var pohyb = !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var nadpisy = Array.prototype.slice.call(document.querySelectorAll(".napis"));

  // Kým sa nenačíta písmo, celé slovo z CSS nech čaká (inak by sa napísalo dvakrát).
  if (pohyb) {
    nadpisy.forEach(function (el) { el.classList.add("caka"); });
  }

  function polohyZnakov(uzol) {
    var r = document.createRange();
    var x = [];
    for (var i = 0; i < uzol.length; i++) {
      r.setStart(uzol, i);
      r.setEnd(uzol, i + 1);
      x.push(r.getBoundingClientRect().left);
    }
    return x;
  }

  function rozdel(el) {
    var text = el.textContent;
    var uzol = el.firstChild;
    if (!uzol || uzol.nodeType !== 3) { return null; }
    var cielove = polohyZnakov(uzol);          // s kerningom

    el.setAttribute("aria-label", text);
    el.textContent = "";
    el.classList.remove("caka");
    el.classList.add("po-pismenach");            // vypne kerning, aby sa medzi spanmi nič nerátalo dvakrát

    var trvanie = parseInt(el.getAttribute("data-trvanie") || "520", 10);
    var rozostup = parseInt(el.getAttribute("data-rozostup") || "130", 10);
    // Strop celého nápisu (Andrej 27. 9.: „trošku dlho sa kreslí“): dlhý text píše rýchlejšie, nie dlhšie.
    var strop = parseInt(el.getAttribute("data-strop") || "1300", 10);
    if (text.length > 1) {
      rozostup = Math.min(rozostup, Math.max(35, Math.floor((strop - 120 - trvanie) / (text.length - 1))));
    }
    el.style.setProperty("--trvanie", trvanie + "ms");
    el.style.setProperty("--rozostup", rozostup + "ms");

    var spany = [];
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement("span");
      s.className = "pismeno";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", String(i));
      s.textContent = text.charAt(i);
      el.appendChild(s);
      spany.push(s);
    }

    // Kerning: rozdiel medzi vzdialenosťou susedov s kerningom a bez neho, v em (škáluje s veľkosťou).
    var bez = spany.map(function (s) { return s.getBoundingClientRect().left; });
    var velkost = parseFloat(getComputedStyle(el).fontSize) || 16;
    for (var j = 1; j < spany.length; j++) {
      var rozdiel = (cielove[j] - cielove[j - 1]) - (bez[j] - bez[j - 1]);
      if (Math.abs(rozdiel) > 0.05) {
        spany[j].style.marginLeft = (rozdiel / velkost).toFixed(4) + "em";
      }
    }
    return spany;
  }

  function spusti(el, spany) {
    el.classList.remove("dychaj");
    spany.forEach(function (s) {
      s.style.animation = "none";
    });
    void el.offsetWidth;                           // reštart animácií
    spany.forEach(function (s) {
      s.style.animation = "";
    });
    var posledny = spany[spany.length - 1];
    if (posledny && el.getAttribute("data-dychanie") === "1") {
      posledny.addEventListener("animationend", function koniec(e) {
        if (e.animationName !== "pis") { return; }
        posledny.removeEventListener("animationend", koniec);
        el.classList.add("dychaj");
      });
    }
  }

  function pripravNadpisy() {
    nadpisy.forEach(function (el) {
      var spany = rozdel(el);
      if (!spany) { el.classList.remove("caka"); return; }
      spusti(el, spany);
      el._spany = spany;
    });
  }

  if (pohyb) {
    var pismo = document.fonts && document.fonts.load
      ? document.fonts.load('1em "ARLing Draw"', "ARLing")
      : Promise.resolve();
    var poistka = new Promise(function (hotovo) { setTimeout(hotovo, 3000); });
    Promise.race([pismo, poistka]).then(pripravNadpisy, pripravNadpisy);
  }

  // Tlačidlo „Napísať znova“.
  Array.prototype.forEach.call(document.querySelectorAll("[data-znova]"), function (tl) {
    if (!pohyb) { tl.hidden = true; return; }
    tl.addEventListener("click", function () {
      var el = document.querySelector(tl.getAttribute("data-znova"));
      if (el && el._spany) { spusti(el, el._spany); }
    });
  });

  // Riadky celej sady: každý znak do vlastného spanu s poradím --i (CSS ich píše po sebe dookola).
  // Kerning v týchto riadkoch netreba, sú to vzorky znakov, nie slová.
  if (pohyb) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sada]"), function (riadok) {
      var text = riadok.textContent;
      riadok.setAttribute("aria-label", text);
      riadok.textContent = "";
      var n = 0;
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var s = document.createElement("span");
        s.setAttribute("aria-hidden", "true");
        s.textContent = ch;
        if (ch !== " ") {
          s.className = "znak";
          s.style.setProperty("--i", String(n));
          n++;
        }
        riadok.appendChild(s);
      }
    });
  }

  // Posuvníky osí.
  Array.prototype.forEach.call(document.querySelectorAll("input[data-os]"), function (vstup) {
    var os = vstup.getAttribute("data-os");
    var ciele = document.querySelectorAll(vstup.getAttribute("data-ciel"));
    var vystup = document.getElementById(vstup.id + "-hodnota");
    function nastav() {
      Array.prototype.forEach.call(ciele, function (c) { c.style.setProperty(os, vstup.value); });
      if (vystup) { vystup.textContent = vstup.value; }
    }
    vstup.addEventListener("input", nastav);
    nastav();
  });
})();
