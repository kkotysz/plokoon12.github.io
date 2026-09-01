(function () {
  "use strict";

  var scene = document.querySelector("[data-hero-timelapse]");
  var video = scene && scene.querySelector("[data-hero-video]");

  if (!scene || !video) return;

  var mobileQuery = window.matchMedia("(max-width: 52rem)");
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = Boolean(connection && connection.saveData);
  var framesPerSecond = 12;
  var sceneStart = 0;
  var scrollDistance = 1;
  var duration = 0;
  var targetTime = 0;
  var loadStarted = false;
  var updateRequested = false;
  var failed = false;

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function shouldRemainStatic() {
    return saveData || reducedMotionQuery.matches || failed;
  }

  function measureScene() {
    sceneStart = scene.getBoundingClientRect().top + window.pageYOffset;
    scrollDistance = Math.max(1, scene.offsetHeight - window.innerHeight);
    requestUpdate();
  }

  function revealVideoFrame() {
    var reveal = function () {
      scene.classList.add("is-video-ready");
    };

    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(reveal);
    } else {
      window.requestAnimationFrame(reveal);
    }
  }

  function seekToTarget() {
    if (!duration || video.readyState < 1 || video.seeking) return;

    if (Math.abs(video.currentTime - targetTime) <= (1 / framesPerSecond) / 2) {
      revealVideoFrame();
      return;
    }

    try {
      video.currentTime = targetTime;
    } catch (error) {
      // The poster remains visible until the browser is ready to seek.
    }
  }

  function updateScene() {
    updateRequested = false;

    var progress = clamp((window.pageYOffset - sceneStart) / scrollDistance, 0, 1);
    scene.style.setProperty("--hero-progress", progress.toFixed(4));

    if (progress > 0 && !loadStarted) loadVideo();

    if (duration) {
      var frameCount = Math.max(1, Math.round(duration * framesPerSecond));
      var targetFrame = Math.round(progress * (frameCount - 1));
      targetTime = targetFrame / framesPerSecond;
      seekToTarget();
    }
  }

  function requestUpdate() {
    if (updateRequested) return;
    updateRequested = true;
    window.requestAnimationFrame(updateScene);
  }

  function loadVideo() {
    if (loadStarted || shouldRemainStatic()) return;

    loadStarted = true;
    video.preload = "auto";
    video.src = mobileQuery.matches ? video.dataset.srcMobile : video.dataset.srcDesktop;
    video.load();
  }

  function scheduleIdleLoad() {
    var loadWhenIdle = function () {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(loadVideo, { timeout: 1800 });
      } else {
        window.setTimeout(loadVideo, 350);
      }
    };

    if (document.readyState === "complete") {
      loadWhenIdle();
    } else {
      window.addEventListener("load", loadWhenIdle, { once: true });
    }
  }

  function enableTimelapse() {
    if (shouldRemainStatic()) {
      scene.classList.add("is-timelapse-static");
      return;
    }

    scene.classList.remove("is-timelapse-static");
    scene.classList.add("is-timelapse-enabled");
    measureScene();
    scheduleIdleLoad();
  }

  function disableTimelapse() {
    scene.classList.remove("is-timelapse-enabled", "is-video-ready");
    scene.classList.add("is-timelapse-static");
    scene.style.setProperty("--hero-progress", "0");
    duration = 0;
    targetTime = 0;

    if (loadStarted) {
      video.pause();
      video.preload = "none";
      video.removeAttribute("src");
      video.load();
      loadStarted = false;
    }
  }

  video.addEventListener("loadedmetadata", function () {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    requestUpdate();
  });

  video.addEventListener("loadeddata", function () {
    seekToTarget();
    if (targetTime === 0) revealVideoFrame();
  });

  video.addEventListener("seeked", function () {
    if (Math.abs(video.currentTime - targetTime) > (1 / framesPerSecond) / 2) {
      seekToTarget();
      return;
    }
    revealVideoFrame();
  });

  video.addEventListener("error", function () {
    if (!video.getAttribute("src")) return;
    failed = true;
    disableTimelapse();
  });

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", measureScene, { passive: true });
  window.addEventListener("pageshow", measureScene);

  ["wheel", "touchstart"].forEach(function (eventName) {
    window.addEventListener(eventName, loadVideo, { once: true, passive: true });
  });

  reducedMotionQuery.addEventListener("change", function () {
    if (reducedMotionQuery.matches) {
      disableTimelapse();
    } else if (!failed && !saveData) {
      enableTimelapse();
    }
  });

  enableTimelapse();
})();
