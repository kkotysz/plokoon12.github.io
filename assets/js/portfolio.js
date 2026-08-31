(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var toggle = document.querySelector("[data-nav-toggle]");
  var navigation = document.querySelector("[data-navigation]");

  root.classList.add("js");

  window.requestAnimationFrame(function () {
    body.classList.add("is-ready");
  });

  function setMenu(open) {
    if (!toggle || !navigation) return;
    toggle.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("is-open", open);
    body.classList.toggle("nav-open", open);
  }

  if (toggle && navigation) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });

    navigation.addEventListener("click", function (event) {
      if (event.target.closest("a")) setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setMenu(false);
        toggle.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 1088) setMenu(false);
    });
  }

  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(function (element) { element.classList.add("is-visible"); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

  reveals.forEach(function (element) { observer.observe(element); });
})();
