(function($) {
  "use strict";

  if (!$ || !document.getElementById("lightgallery")) {
    return;
  }

  var GRID_GUTTER = 10;
  var MOBILE_BREAKPOINT = 760;
  var SMALL_MOBILE_BREAKPOINT = 520;
  var ISOTOPE_TRANSITION_MS = "240ms";
  var PROGRESSIVE_INITIAL_LIMIT = 180;
  var PROGRESSIVE_LOAD_STEP = 120;
  var MAX_MAP_MARKERS = 450;

  var STORAGE = {
    exifVisible: "gallery:exif-visible:v1"
  };

  var EXIF_TYPE_SIZES = {
    1: 1,
    2: 1,
    3: 2,
    4: 4,
    5: 8,
    7: 1,
    9: 4,
    10: 8
  };

  var EXIF_TAGS = {
    IMAGE_WIDTH: 0x0100,
    IMAGE_HEIGHT: 0x0101,
    MAKE: 0x010F,
    MODEL: 0x0110,
    DATETIME: 0x0132,
    GPS_POINTER: 0x8825,
    EXIF_POINTER: 0x8769,
    DATETIME_ORIGINAL: 0x9003,
    EXPOSURE_TIME: 0x829A,
    FNUMBER: 0x829D,
    ISO: 0x8827,
    FOCAL_LENGTH: 0x920A,
    PIXEL_X_DIMENSION: 0xA002,
    PIXEL_Y_DIMENSION: 0xA003,
    FOCAL_LENGTH_35: 0xA405,
    LENS_MODEL: 0xA434,
    GPS_LAT_REF: 0x0001,
    GPS_LAT: 0x0002,
    GPS_LON_REF: 0x0003,
    GPS_LON: 0x0004
  };

  var COUNTRY_TAGS = [
    "chile", "france", "greece", "ireland", "italy", "korea",
    "malta", "norway", "poland", "spain", "switzerland", "uae", "usa"
  ];

  var COUNTRY_LABELS = {
    chile: "CHL",
    france: "FRA",
    greece: "GRC",
    ireland: "IRL",
    italy: "ITA",
    korea: "KOR",
    malta: "MLT",
    norway: "NOR",
    poland: "POL",
    spain: "ESP",
    switzerland: "CHE",
    uae: "UAE",
    usa: "USA"
  };

  var TAG_LABELS = {
    astrophoto: "Astro",
    nature: "Nature",
    architecture: "Architecture",
    bw: "B&W",
    landscape: "Landscape",
    portrait: "Portrait",
    square: "Square",
    panorama: "Panorama"
  };

  var ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  var state = {
    query: "",
    country: "*",
    includeTags: [],
    excludeTags: [],
    tagMode: "all",
    tagFiltersExpanded: false,
    collectionsExpanded: false,
    collection: "",
    mapMode: false,
    photo: "",
    sort: "random",
    theme: "classic",
    exifVisible: true
  };

  var FEATURES = {
    mapMode: false,
    collections: false,
    progressiveLoad: false
  };

  var galleryPlugin = null;
  var lastVisibleSignature = "";
  var resizeTimeout = null;
  var iso = null;
  var exifCache = {};
  var exifRequestToken = 0;
  var gpsCache = {};
  var timelineEntries = [];
  var activeTimelineKey = "";
  var timelinePreviewKey = "";
  var timelineLabelFormatter = null;
  var timelineScrollRaf = null;
  var deckHidden = false;
  var lastScrollY = 0;
  var deckToggleLockUntil = 0;
  var DECK_TOGGLE_LOCK_MS = 260;
  var hasEnabledIsotopeTransitions = false;
  var secretThemeCombo = {
    lastKey: "",
    lastAt: 0
  };
  var mapRenderToken = 0;
  var mapLayer = null;
  var mapInstance = null;
  var collectionDefs = [];
  var collectionIndex = {};
  var allTagFilterTags = [];
  var totalPhotoCount = 0;
  var progressiveLimit = PROGRESSIVE_INITIAL_LIMIT;
  var progressiveLoadPending = false;
  var copyLinkResetTimer = 0;
  var pendingPhotoOpenId = "";

  var $body = $(document.body);
  var $controlDeck = $(".control-deck");
  var $grid = $("#lightgallery");
  var $stage = $(".gallery-stage");
  var $search = $("#gallery-search");
  var $clearSearch = $("#clear-search");
  var $sortSelect = $("#gallery-sort");
  var $themeSelect = $("#gallery-theme");
  var $galleryCounts = $("#gallery-counts");
  var $countryTags = $("#country-tags");
  var $advancedTagsWrap = $("#advanced-tags-wrap");
  var $tagFilterPanel = $("#tag-filter-panel");
  var $includeTags = $("#include-tags");
  var $excludeTags = $("#exclude-tags");
  var $toggleTagFilters = $("#toggle-tag-filters");
  var $tagModeToggle = $("#tag-mode-toggle");
  var $clearTagFilters = $("#clear-tag-filters");
  var $collectionsWrap = $("#collections-wrap");
  var $collectionsPanel = $("#collections-panel");
  var $collectionTags = $("#collection-tags");
  var $toggleCollections = $("#toggle-collections");
  var $clearCollection = $("#clear-collection");
  var $toggleMap = $("#toggle-map");
  var $copyViewLink = $("#copy-view-link");
  var $mapSection = $("#gallery-map-section");
  var $mapSummary = $("#gallery-map-summary");
  var $timelineWrap = $("#date-timeline-wrap");
  var $timeline = $("#date-timeline");
  var $deckMainRow = $controlDeck.find(".deck-row--main").first();
  var $surpriseMe = $("#surprise-me");
  var $shuffleVisible = $("#shuffle-visible");
  var $resetAll = $("#reset-all");
  var $scrollProgress = $("#scroll-progress");
  var $shortcutDialog = $("#shortcut-dialog");
  var $showShortcuts = $("#show-shortcuts");
  var $closeShortcuts = $("#close-shortcuts");
  var $deckCollapseSentinel = $();

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isReloadNavigation() {
    if (window.performance && typeof window.performance.getEntriesByType === "function") {
      var entries = window.performance.getEntriesByType("navigation");
      if (entries && entries.length && entries[0] && entries[0].type) {
        return entries[0].type === "reload";
      }
    }

    if (window.performance && window.performance.navigation) {
      return window.performance.navigation.type === 1;
    }

    return false;
  }

  function enforceTopOnReload() {
    if (!isReloadNavigation()) {
      return;
    }
    if (window.location.hash) {
      return;
    }

    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch (error) {}

    var snapToTop = function() {
      window.scrollTo(0, 0);
    };

    snapToTop();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(snapToTop);
    }
    window.setTimeout(snapToTop, 60);
    window.addEventListener("load", snapToTop, { once: true });
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && isFinite(value);
  }

  function parseDateFromFilename(value) {
    var match = String(value || "").match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (!match) {
      return null;
    }

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var hour = Number(match[4]);
    var minute = Number(match[5]);
    var second = Number(match[6]);

    var parsed = new Date(year, month - 1, day, hour, minute, second);
    if (!isFiniteNumber(parsed.getTime())) {
      return null;
    }
    return parsed;
  }

  function normalizeSort(value) {
    var valid = ["random", "date-desc", "date-asc"];
    return valid.indexOf(value) >= 0 ? value : "random";
  }

  function normalizeTheme(value) {
    var valid = ["aurora", "classic", "midnight", "ember", "jade", "paperink", "mintpop", "noir", "rainbow"];
    return valid.indexOf(value) >= 0 ? value : "classic";
  }

  function isKnownCountry(value) {
    return COUNTRY_TAGS.indexOf(value) >= 0;
  }

  function toBoolFlag(value) {
    var normalized = String(value || "").toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
  }

  function readFeatureFlag(attrName, fallbackValue) {
    var raw = $body.attr(attrName);
    if (raw === undefined || raw === null || raw === "") {
      return !!fallbackValue;
    }
    return toBoolFlag(raw);
  }

  function normalizeTagToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/[^a-z0-9\-]/g, "");
  }

  function normalizeTagMode(value) {
    return String(value || "").toLowerCase() === "any" ? "any" : "all";
  }

  function parseTagList(value) {
    if (!value) {
      return [];
    }
    var raw = String(value)
      .split(/[\s,]+/)
      .map(normalizeTagToken)
      .filter(Boolean);
    var unique = [];
    for (var i = 0; i < raw.length; i++) {
      if (unique.indexOf(raw[i]) < 0) {
        unique.push(raw[i]);
      }
    }
    return unique;
  }

  function parsePhotoId(value) {
    return String(value || "").trim();
  }

  function stripPhotoExtension(value) {
    return String(value || "").replace(/\.[^.]+$/, "");
  }

  function photoIdsMatch(a, b) {
    var left = parsePhotoId(a);
    var right = parsePhotoId(b);
    if (!left || !right) {
      return false;
    }
    if (left === right) {
      return true;
    }
    return stripPhotoExtension(left) === stripPhotoExtension(right);
  }

  function readStorageJson(key, fallbackValue) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) {
        return fallbackValue;
      }
      return JSON.parse(raw);
    } catch (error) {
      return fallbackValue;
    }
  }

  function writeStorageJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function applyStateFromUrl() {
    var params = new URLSearchParams(window.location.search || "");
    var queryValue = params.get("q");
    var countryValue = String(params.get("country") || "").toLowerCase();
    var includeTagsValue = params.get("tags");
    var excludeTagsValue = params.get("exclude");
    var tagModeValue = params.get("tagmode");
    var collectionValue = String(params.get("collection") || "").trim();
    var mapValue = params.get("map");
    var photoValue = params.get("photo");
    var sortValue = String(params.get("sort") || "").toLowerCase();
    var themeValue = String(params.get("theme") || "").toLowerCase();
    var exifValue = params.get("exif");

    if (queryValue !== null) {
      state.query = String(queryValue).trim().toLowerCase();
    }
    if (isKnownCountry(countryValue)) {
      state.country = countryValue;
    }
    if (includeTagsValue !== null) {
      state.includeTags = parseTagList(includeTagsValue);
    }
    if (excludeTagsValue !== null) {
      state.excludeTags = parseTagList(excludeTagsValue);
    }
    if (tagModeValue !== null) {
      state.tagMode = normalizeTagMode(tagModeValue);
    }
    if (collectionValue) {
      state.collection = collectionValue.toLowerCase();
    }
    if (mapValue !== null && FEATURES.mapMode) {
      state.mapMode = toBoolFlag(mapValue);
    }
    if (photoValue !== null) {
      state.photo = parsePhotoId(photoValue);
    }
    if (sortValue) {
      state.sort = normalizeSort(sortValue);
    }
    if (themeValue) {
      state.theme = normalizeTheme(themeValue);
    }

    if (exifValue !== null) {
      var normalized = String(exifValue || "").toLowerCase();
      state.exifVisible = !(normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off" || normalized === "hide");
    }

    if (state.excludeTags.length && state.includeTags.length) {
      state.excludeTags = state.excludeTags.filter(function(tag) {
        return state.includeTags.indexOf(tag) < 0;
      });
    }
  }

  function updateUrlFromState(options) {
    var config = options || {};
    var params = new URLSearchParams();
    var photoId = config.photoId !== undefined ? parsePhotoId(config.photoId) : state.photo;
    var keepPhotoParam = config.keepPhoto !== false;

    if (state.query) {
      params.set("q", state.query);
    }
    if (state.country !== "*") {
      params.set("country", state.country);
    }
    if (state.includeTags.length) {
      params.set("tags", state.includeTags.join(","));
    }
    if (state.excludeTags.length) {
      params.set("exclude", state.excludeTags.join(","));
    }
    if (state.tagMode === "any") {
      params.set("tagmode", "any");
    }
    if (state.collection) {
      params.set("collection", state.collection);
    }
    if (state.mapMode) {
      params.set("map", "1");
    }
    if (state.sort !== "random") {
      params.set("sort", state.sort);
    }
    if (state.theme !== "classic") {
      params.set("theme", state.theme);
    }
    if (!state.exifVisible) {
      params.set("exif", "0");
    }
    if (keepPhotoParam && photoId) {
      params.set("photo", photoId);
    }

    var basePath = window.location.pathname;
    var nextQuery = params.toString();
    var nextUrl = basePath + (nextQuery ? ("?" + nextQuery) : "") + window.location.hash;
    var currentUrl = window.location.pathname + window.location.search + window.location.hash;

    if (nextUrl === currentUrl) {
      return;
    }

    try {
      window.history.replaceState({}, "", nextUrl);
    } catch (error) {}
  }

  function getTileSize() {
    var stageWidth = Math.floor($stage.innerWidth() || window.innerWidth || 0);
    var usableWidth = Math.max(180, stageWidth - 18);

    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      return clamp(Math.floor((usableWidth - GRID_GUTTER) / 2), 110, 240);
    }

    var target = 228;
    var columns = Math.max(3, Math.round(usableWidth / target));
    return clamp(Math.floor((usableWidth - ((columns - 1) * GRID_GUTTER)) / columns), 170, 280);
  }

  function applyTileSize() {
    var tileSize = getTileSize();
    document.documentElement.style.setProperty("--tile-size", tileSize + "px");
  }

  function prepareItems() {
    var index = 0;
    $grid.find(".item").each(function() {
      var source = this.getAttribute("data-sort") || "";
      var parsed = parseDateFromFilename(source);
      this.setAttribute("data-random-rank", String(Math.random()));
      this.setAttribute("data-date-ts", parsed ? String(parsed.getTime()) : "0");
      this.setAttribute("data-month-key", parsed ? getMonthKeyFromDate(parsed) : "");
      this.setAttribute("data-year", parsed ? String(parsed.getFullYear()) : "");
      this.setAttribute("data-grid-index", String(index));
      this.setAttribute("data-progressive-index", String(index));
      index += 1;
    });
    totalPhotoCount = Number($grid.attr("data-total-items")) || index;
    progressiveLimit = clamp(progressiveLimit, 1, Math.max(1, totalPhotoCount));
    reseedProgressiveOrder();
  }

  function reseedRandomRanks() {
    $grid.find(".item").each(function() {
      this.setAttribute("data-random-rank", String(Math.random()));
    });
    reseedProgressiveOrder();

    if (iso) {
      $grid.isotope("updateSortData", $grid.find(".item"));
    }
  }

  function reseedProgressiveOrder() {
    var nodes = $grid.find(".item").toArray();
    nodes.sort(function(a, b) {
      var aRank = Number(a.getAttribute("data-random-rank") || 0);
      var bRank = Number(b.getAttribute("data-random-rank") || 0);
      return aRank - bRank;
    });

    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("data-progressive-index", String(i));
    }
  }

  function getAllTagCounts() {
    var counts = {};

    $grid.find(".item").each(function() {
      var tags = String(this.getAttribute("data-tags") || "").split(/\s+/);
      for (var i = 0; i < tags.length; i++) {
        var tag = tags[i].trim().toLowerCase();
        if (!tag) {
          continue;
        }
        counts[tag] = (counts[tag] || 0) + 1;
      }
    });

    return counts;
  }

  function isProgressiveFilterActive() {
    if (!FEATURES.progressiveLoad) {
      return false;
    }
    if (state.mapMode) {
      return false;
    }
    if (state.sort !== "random") {
      return false;
    }
    if (state.query) {
      return false;
    }
    if (state.country !== "*") {
      return false;
    }
    if (state.collection) {
      return false;
    }
    if (state.includeTags.length || state.excludeTags.length) {
      return false;
    }
    return true;
  }

  function canLoadMorePhotos() {
    if (!FEATURES.progressiveLoad || !isProgressiveFilterActive()) {
      return false;
    }
    return progressiveLimit < totalPhotoCount;
  }

  function loadMorePhotos() {
    if (!canLoadMorePhotos()) {
      return false;
    }

    var nextLimit = Math.min(totalPhotoCount, progressiveLimit + PROGRESSIVE_LOAD_STEP);
    if (nextLimit <= progressiveLimit) {
      return false;
    }

    progressiveLoadPending = true;
    progressiveLimit = nextLimit;
    applyFilters({ reshuffleRandom: false });
    return true;
  }

  function maybeAutoLoadMoreOnScroll() {
    if (progressiveLoadPending || !canLoadMorePhotos()) {
      return;
    }

    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop || 0;
    var viewportHeight = window.innerHeight || doc.clientHeight || 0;
    var documentHeight = Math.max(document.body.scrollHeight || 0, doc.scrollHeight || 0);
    var distanceToBottom = documentHeight - (scrollTop + viewportHeight);

    if (distanceToBottom <= 320) {
      loadMorePhotos();
    }
  }

  function getOrderedFilterTags(counts) {
    var tags = Object.keys(counts || {}).filter(function(tag) {
      return !!tag;
    });

    tags.sort(function(a, b) {
      var byCount = Number(counts[b] || 0) - Number(counts[a] || 0);
      if (byCount !== 0) {
        return byCount;
      }
      return a.localeCompare(b);
    });

    return tags;
  }

  function prettyTagLabel(tag) {
    if (COUNTRY_LABELS[tag]) {
      return COUNTRY_LABELS[tag];
    }
    if (TAG_LABELS[tag]) {
      return TAG_LABELS[tag];
    }
    return "#" + tag;
  }

  function normalizeTagState() {
    var include = state.includeTags.filter(function(tag) {
      return allTagFilterTags.indexOf(tag) >= 0;
    });
    var exclude = state.excludeTags.filter(function(tag) {
      return allTagFilterTags.indexOf(tag) >= 0 && include.indexOf(tag) < 0;
    });
    state.includeTags = include;
    state.excludeTags = exclude;
    state.tagMode = normalizeTagMode(state.tagMode);
  }

  function renderAdvancedTagFilters(counts) {
    if (!$advancedTagsWrap.length || !$includeTags.length || !$excludeTags.length) {
      return;
    }

    allTagFilterTags = getOrderedFilterTags(counts);
    normalizeTagState();

    $includeTags.empty();
    $excludeTags.empty();

    for (var i = 0; i < allTagFilterTags.length; i++) {
      var tag = allTagFilterTags[i];
      var count = Number(counts[tag] || 0);
      var label = prettyTagLabel(tag) + " (" + count + ")";

      $includeTags.append(
        $("<button>", {
          "class": "chip chip--filter chip--include",
          type: "button",
          "data-tag": tag,
          text: label,
          "aria-pressed": "false"
        })
      );

      $excludeTags.append(
        $("<button>", {
          "class": "chip chip--filter chip--exclude",
          type: "button",
          "data-tag": tag,
          text: label,
          "aria-pressed": "false"
        })
      );
    }
  }

  function updateTagFilterUi() {
    if ($tagModeToggle.length) {
      var isAny = state.tagMode === "any";
      $tagModeToggle.text(isAny ? "Match: ANY" : "Match: ALL");
      $tagModeToggle.attr("aria-pressed", isAny ? "true" : "false");
    }

    $includeTags.find(".chip").each(function() {
      var tag = String(this.getAttribute("data-tag") || "");
      var isActive = state.includeTags.indexOf(tag) >= 0;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    $excludeTags.find(".chip").each(function() {
      var tag = String(this.getAttribute("data-tag") || "");
      var isActive = state.excludeTags.indexOf(tag) >= 0;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setTagFiltersExpanded(expanded) {
    var isExpanded = !!expanded;
    state.tagFiltersExpanded = isExpanded;

    if ($tagFilterPanel.length) {
      $tagFilterPanel.prop("hidden", !isExpanded);
    }

    if ($toggleTagFilters.length) {
      $toggleTagFilters.text(isExpanded ? "-" : "+");
      $toggleTagFilters.attr("aria-expanded", isExpanded ? "true" : "false");
      $toggleTagFilters.attr("aria-label", isExpanded ? "Collapse tag filters" : "Expand tag filters");
    }

    if (isExpanded && window.innerWidth <= MOBILE_BREAKPOINT) {
      setDeckHidden(false);
    }
  }

  function setCollectionsExpanded(expanded) {
    var isExpanded = !!expanded;
    state.collectionsExpanded = isExpanded;

    if ($collectionsPanel.length) {
      $collectionsPanel.prop("hidden", !isExpanded);
    }

    if ($toggleCollections.length) {
      $toggleCollections.text(isExpanded ? "-" : "+");
      $toggleCollections.attr("aria-expanded", isExpanded ? "true" : "false");
      $toggleCollections.attr("aria-label", isExpanded ? "Collapse collections" : "Expand collections");
    }

    if (isExpanded && window.innerWidth <= MOBILE_BREAKPOINT) {
      setDeckHidden(false);
    }
  }

  function hasExpandedFilterPanels() {
    return !!(state.tagFiltersExpanded || state.collectionsExpanded);
  }

  function toggleTagSelection(group, tag) {
    var clean = normalizeTagToken(tag);
    if (!clean) {
      return;
    }

    if (group === "include") {
      if (state.includeTags.indexOf(clean) >= 0) {
        state.includeTags = state.includeTags.filter(function(value) {
          return value !== clean;
        });
      } else {
        state.includeTags.push(clean);
      }
      state.excludeTags = state.excludeTags.filter(function(value) {
        return value !== clean;
      });
      return;
    }

    if (group === "exclude") {
      if (state.excludeTags.indexOf(clean) >= 0) {
        state.excludeTags = state.excludeTags.filter(function(value) {
          return value !== clean;
        });
      } else {
        state.excludeTags.push(clean);
      }
      state.includeTags = state.includeTags.filter(function(value) {
        return value !== clean;
      });
    }
  }

  function clearTagFilters() {
    state.includeTags = [];
    state.excludeTags = [];
    state.tagMode = "all";
  }

  function buildCollections(tagCounts) {
    var counts = tagCounts || {};
    collectionDefs = [];
    collectionIndex = {};

    var yearCounts = {};
    $grid.find(".item").each(function() {
      var year = String(this.getAttribute("data-year") || "");
      if (!year) {
        return;
      }
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });

    var baseDefs = [
      { id: "astro", label: "Astro Nights", include: ["astrophoto"], exclude: [] },
      { id: "mono", label: "Monochrome", include: ["bw"], exclude: [] },
      { id: "city", label: "City Geometry", include: ["architecture"], exclude: [] },
      { id: "nature", label: "Nature Escapes", include: ["nature"], exclude: [] },
      { id: "pano", label: "Panoramas", include: ["panorama"], exclude: [] },
      { id: "stars", label: "Night Sky", include: ["night"], exclude: [] }
    ];

    for (var i = 0; i < baseDefs.length; i++) {
      var def = baseDefs[i];
      var canAdd = true;
      if (Array.isArray(def.include) && def.include.length) {
        for (var k = 0; k < def.include.length; k++) {
          if (!counts[def.include[k]]) {
            canAdd = false;
            break;
          }
        }
      }
      if (!canAdd) {
        continue;
      }
      collectionDefs.push(def);
      collectionIndex[def.id] = def;
    }

    var yearList = Object.keys(yearCounts).sort(function(a, b) {
      return Number(b) - Number(a);
    });
    for (var j = 0; j < yearList.length; j++) {
      var year = yearList[j];
      if (yearCounts[year] < 6) {
        continue;
      }
      var yearDef = {
        id: "year-" + year,
        label: "Year " + year + " (" + yearCounts[year] + ")",
        year: String(year),
        include: [],
        exclude: []
      };
      collectionDefs.push(yearDef);
      collectionIndex[yearDef.id] = yearDef;
    }
  }

  function renderCollections() {
    if (!$collectionsWrap.length || !$collectionTags.length) {
      return;
    }
    if (!FEATURES.collections) {
      setCollectionsExpanded(false);
      $collectionsWrap.prop("hidden", true);
      return;
    }

    if (!collectionDefs.length) {
      setCollectionsExpanded(false);
      $collectionsWrap.prop("hidden", true);
      return;
    }

    $collectionTags.empty();
    $collectionTags.append(
      $("<button>", {
        "class": "chip",
        type: "button",
        "data-collection-id": "",
        text: "All photos",
        "aria-pressed": "true"
      })
    );

    for (var i = 0; i < collectionDefs.length; i++) {
      var def = collectionDefs[i];
      $collectionTags.append(
        $("<button>", {
          "class": "chip chip--collection",
          type: "button",
          "data-collection-id": def.id,
          text: def.label,
          "aria-pressed": "false"
        })
      );
    }

    $collectionsWrap.prop("hidden", false);
    setCollectionsExpanded(state.collectionsExpanded);
  }

  function updateCollectionsUi() {
    $collectionTags.find(".chip").each(function() {
      var id = String(this.getAttribute("data-collection-id") || "");
      var isActive = !id ? !state.collection : state.collection === id;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function renderCountryChips($container, tags, labels, counts) {
    $container.empty();
    $container.append(
      $("<button>", {
        "class": "chip",
        type: "button",
        "data-group": "country",
        "data-tag": "*",
        text: "All countries",
        "aria-pressed": "true"
      })
    );

    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      if (!counts[tag]) {
        continue;
      }

      var label = labels[tag] || (tag.charAt(0).toUpperCase() + tag.slice(1));
      var countryCode = String(label || "").trim().toUpperCase();
      var countryCount = Number(counts[tag] || 0);
      var countryAria = countryCode + " (" + countryCount + ")";

      $container.append(
        $("<button>", {
          "class": "chip chip--country chip--flag-" + tag,
          type: "button",
          "data-group": "country",
          "data-tag": tag,
          text: countryCode,
          title: countryAria,
          "aria-label": countryAria,
          "aria-pressed": "false"
        })
      );
    }
  }

  function updateChipUi() {
    $countryTags.find(".chip").each(function() {
      var tag = String(this.getAttribute("data-tag") || "*");
      var isActive = tag === state.country;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    updateTagFilterUi();
    updateCollectionsUi();
  }

  function getCustomSelectOptionLabel($select, value) {
    if (!$select || !$select.length) {
      return "";
    }

    var normalizedValue = String(value || "");
    var label = "";
    $select.find("option").each(function() {
      if (String(this.value || "") === normalizedValue) {
        label = String($(this).text() || "").trim();
      }
    });

    if (!label) {
      label = String($select.find("option:selected").text() || "").trim();
    }
    return label;
  }

  function getCustomSelectWrapper($select) {
    if (!$select || !$select.length) {
      return $();
    }
    return $select.closest(".select-wrap").children(".custom-select").first();
  }

  function setCustomSelectOpen($custom, open) {
    if (!$custom || !$custom.length) {
      return;
    }

    var isOpen = !!open;
    $custom.toggleClass("is-open", isOpen);
    $custom.children(".custom-select-trigger").attr("aria-expanded", isOpen ? "true" : "false");
  }

  function closeAllCustomSelects(exceptElement) {
    var closedAny = false;
    $(".custom-select.is-open").each(function() {
      if (exceptElement && this === exceptElement) {
        return;
      }
      setCustomSelectOpen($(this), false);
      closedAny = true;
    });
    return closedAny;
  }

  function syncCustomSelectFromNative($select) {
    var $custom = getCustomSelectWrapper($select);
    if (!$custom.length) {
      return;
    }

    var currentValue = String($select.val() || "");
    var currentLabel = getCustomSelectOptionLabel($select, currentValue);

    $custom.attr("data-value", currentValue);
    $custom.find(".custom-select-value").text(currentLabel || currentValue);
    $custom.find(".custom-select-option").each(function() {
      var isActive = String(this.getAttribute("data-value") || "") === currentValue;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function initCustomSelect($select) {
    if (!$select || !$select.length) {
      return;
    }

    var $wrap = $select.closest(".select-wrap");
    if (!$wrap.length) {
      return;
    }

    $select.off(".customSelect");
    $wrap.children(".custom-select").remove();

    var selectId = String($select.attr("id") || "");
    var menuId = (selectId ? (selectId + "-menu") : ("custom-select-menu-" + Math.random().toString(36).slice(2)));
    var selectedLabel = getCustomSelectOptionLabel($select, $select.val());

    $wrap.addClass("has-custom-select");
    $select.addClass("is-native-hidden");
    $select.attr("tabindex", "-1");
    $select.attr("aria-hidden", "true");

    var $custom = $("<div>", {
      "class": "custom-select",
      "data-select-id": selectId
    });

    var $trigger = $("<button>", {
      "class": "custom-select-trigger",
      type: "button",
      "aria-haspopup": "listbox",
      "aria-expanded": "false",
      "aria-controls": menuId
    });

    $trigger.append($("<span>", {
      "class": "custom-select-value",
      text: selectedLabel
    }));
    $trigger.append($("<i>", {
      "class": "fa-solid fa-chevron-down custom-select-caret",
      "aria-hidden": "true"
    }));

    var $menu = $("<div>", {
      "class": "custom-select-menu",
      id: menuId,
      role: "listbox"
    });

    $select.find("option").each(function() {
      var isSecretOption = this.hasAttribute("data-secret-option");
      if (isSecretOption) {
        return;
      }
      var optionValue = String(this.value || "");
      var optionLabel = String($(this).text() || "").trim();
      var isSelected = this.selected;
      $menu.append($("<button>", {
        "class": "custom-select-option" + (isSelected ? " is-active" : ""),
        type: "button",
        role: "option",
        "data-value": optionValue,
        "aria-selected": isSelected ? "true" : "false",
        text: optionLabel
      }));
    });

    $custom.append($trigger, $menu);
    $wrap.append($custom);

    $select.on("change.customSelect", function() {
      syncCustomSelectFromNative($select);
    });

    $trigger.on("click", function(event) {
      event.preventDefault();
      event.stopPropagation();
      var willOpen = !$custom.hasClass("is-open");
      closeAllCustomSelects($custom.get(0));
      setCustomSelectOpen($custom, willOpen);

      if (willOpen) {
        var $active = $menu.children(".custom-select-option.is-active").first();
        if ($active.length) {
          $active.trigger("focus");
        }
      }
    });

    $menu.on("click", ".custom-select-option", function(event) {
      event.preventDefault();
      event.stopPropagation();

      var nextValue = String(this.getAttribute("data-value") || "");
      var prevValue = String($select.val() || "");
      $select.val(nextValue);
      syncCustomSelectFromNative($select);
      setCustomSelectOpen($custom, false);
      $trigger.trigger("focus");

      if (nextValue !== prevValue) {
        $select.trigger("change");
      }
    });

    $custom.on("keydown", ".custom-select-trigger, .custom-select-option", function(event) {
      var key = String(event.key || "");
      var $options = $menu.children(".custom-select-option");
      if (!$options.length) {
        return;
      }

      if (key === "Escape") {
        event.preventDefault();
        setCustomSelectOpen($custom, false);
        $trigger.trigger("focus");
        return;
      }

      if (key === "Enter" || key === " ") {
        if ($(event.currentTarget).hasClass("custom-select-trigger")) {
          event.preventDefault();
          var shouldOpen = !$custom.hasClass("is-open");
          closeAllCustomSelects($custom.get(0));
          setCustomSelectOpen($custom, shouldOpen);
          if (shouldOpen) {
            $options.filter(".is-active").first().trigger("focus");
          }
          return;
        }
      }

      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        if (!$custom.hasClass("is-open")) {
          closeAllCustomSelects($custom.get(0));
          setCustomSelectOpen($custom, true);
          $options.filter(".is-active").first().trigger("focus");
          return;
        }

        var activeElement = document.activeElement;
        var currentIndex = $options.index(activeElement);
        if (currentIndex < 0) {
          currentIndex = $options.index($options.filter(".is-active").first());
        }
        if (currentIndex < 0) {
          currentIndex = 0;
        }

        var delta = key === "ArrowDown" ? 1 : -1;
        var nextIndex = clamp(currentIndex + delta, 0, $options.length - 1);
        $options.eq(nextIndex).trigger("focus");
        return;
      }

      if (key === "Home" || key === "End") {
        if (!$custom.hasClass("is-open")) {
          return;
        }
        event.preventDefault();
        var edgeIndex = key === "Home" ? 0 : ($options.length - 1);
        $options.eq(edgeIndex).trigger("focus");
      }
    });

    syncCustomSelectFromNative($select);
  }

  function initCustomSelects() {
    initCustomSelect($sortSelect);
    initCustomSelect($themeSelect);
  }

  function getSortOptions() {
    if (state.sort === "date-asc") {
      return {
        sortBy: "date",
        sortAscending: {
          date: true
        }
      };
    }

    if (state.sort === "date-desc") {
      return {
        sortBy: "date",
        sortAscending: {
          date: false
        }
      };
    }

    return {
      sortBy: "random",
      sortAscending: {
        random: true
      }
    };
  }

  function isDateSort() {
    return state.sort === "date-asc" || state.sort === "date-desc";
  }

  function syncSortModeUi() {
    $body.attr("data-sort-mode", isDateSort() ? "date" : "random");
  }

  function getArrangedVisibleElements() {
    if (iso && Array.isArray(iso.filteredItems) && iso.filteredItems.length) {
      var sorted = [];
      for (var i = 0; i < iso.filteredItems.length; i++) {
        var element = iso.filteredItems[i] && iso.filteredItems[i].element;
        if (!element || element.classList.contains("isotope-hidden") || element.style.display === "none") {
          continue;
        }
        sorted.push(element);
      }
      return sorted;
    }

    return getVisibleItems().toArray();
  }

  function getMonthKeyFromDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    return year + "-" + month;
  }

  function getItemMonthKey(item) {
    return String(item && item.getAttribute("data-month-key") || "");
  }

  function getMonthLabel(date) {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      var romanMonth = ROMAN_MONTHS[date.getMonth()] || String(date.getMonth() + 1);
      var shortYear = String(date.getFullYear()).slice(-2);
      return romanMonth + " " + shortYear;
    }

    if (!timelineLabelFormatter && typeof Intl !== "undefined" && Intl.DateTimeFormat) {
      var locale = document.documentElement.lang || navigator.language || "en-US";
      try {
        timelineLabelFormatter = new Intl.DateTimeFormat(locale, {
          month: "short",
          year: "numeric"
        });
      } catch (error) {
        timelineLabelFormatter = null;
      }
    }

    if (timelineLabelFormatter) {
      return timelineLabelFormatter.format(date);
    }

    var fallbackMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return fallbackMonths[date.getMonth()] + " " + date.getFullYear();
  }

  function getTimelineStickyOffset() {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      var timelineHeight = 0;
      if ($timelineWrap.length && !$timelineWrap.prop("hidden")) {
        timelineHeight = Math.round($timelineWrap.outerHeight() || 0);
      }
      if (timelineHeight > 0) {
        return Math.max(74, timelineHeight + 10);
      }
      return 92;
    }

    var deckHeight = Math.round($controlDeck.outerHeight() || 0);
    var extraOffset = 20;
    if (deckHeight > 0) {
      return Math.max(92, deckHeight + extraOffset);
    }
    return 92;
  }

  function getTimelineScrollMarker() {
    return getTimelineStickyOffset();
  }

  function centerTimelineChip(chipElement, behavior) {
    if (!chipElement || !$timeline.length) {
      return;
    }

    var timelineEl = $timeline.get(0);
    if (!timelineEl) {
      return;
    }

    var targetLeft = Math.round(
      chipElement.offsetLeft + (chipElement.offsetWidth / 2) - (timelineEl.clientWidth / 2)
    );
    var maxScrollLeft = Math.max(0, timelineEl.scrollWidth - timelineEl.clientWidth);
    targetLeft = clamp(targetLeft, 0, maxScrollLeft);

    if (Math.abs(timelineEl.scrollLeft - targetLeft) < 2) {
      return;
    }

    if (typeof timelineEl.scrollTo === "function") {
      timelineEl.scrollTo({
        left: targetLeft,
        behavior: behavior || "smooth"
      });
      return;
    }

    timelineEl.scrollLeft = targetLeft;
  }

  function setTimelineActive(monthKey, options) {
    if (!monthKey || !$timeline.length) {
      return;
    }

    var config = options || {};
    if (!config.force && monthKey === activeTimelineKey) {
      return;
    }

    activeTimelineKey = monthKey;

    $timeline.find(".timeline-chip").each(function() {
      var chipKey = String(this.getAttribute("data-month-key") || "");
      var isActive = chipKey === monthKey;
      this.classList.toggle("is-active", isActive);
      this.setAttribute("aria-pressed", isActive ? "true" : "false");

      if (isActive && config.scrollIntoView !== false) {
        centerTimelineChip(this, config.scrollBehavior || "smooth");
      }
    });
  }

  function syncTimelineActiveFromScroll() {
    timelineScrollRaf = null;

    if (!$timelineWrap.length || $timelineWrap.prop("hidden") || !timelineEntries.length) {
      return;
    }

    var marker = getTimelineScrollMarker();
    var bestAbove = null;
    var bestBelow = null;

    for (var i = 0; i < timelineEntries.length; i++) {
      var entry = timelineEntries[i];
      if (!entry.item || !entry.item.isConnected) {
        continue;
      }

      var top = entry.item.getBoundingClientRect().top;
      if (top <= marker) {
        if (!bestAbove || top > bestAbove.top) {
          bestAbove = { key: entry.key, top: top };
        }
      } else if (!bestBelow || top < bestBelow.top) {
        bestBelow = { key: entry.key, top: top };
      }
    }

    var nextKey = bestAbove ? bestAbove.key : (bestBelow ? bestBelow.key : "");
    if (nextKey) {
      setTimelineActive(nextKey, { scrollIntoView: true });
    }
  }

  function queueTimelineActiveSync() {
    if (timelineScrollRaf !== null) {
      return;
    }

    var run = function() {
      syncTimelineActiveFromScroll();
    };

    if (typeof window.requestAnimationFrame === "function") {
      timelineScrollRaf = window.requestAnimationFrame(run);
      return;
    }

    timelineScrollRaf = window.setTimeout(run, 0);
  }

  function scrollToTimelineMonth(monthKey) {
    if (!monthKey || !timelineEntries.length) {
      return;
    }

    var target = null;
    for (var i = 0; i < timelineEntries.length; i++) {
      if (timelineEntries[i].key === monthKey) {
        target = timelineEntries[i];
        break;
      }
    }

    if (!target || !target.item) {
      return;
    }

    var offset = getTimelineStickyOffset();
    var top = (window.pageYOffset || document.documentElement.scrollTop || 0) + target.item.getBoundingClientRect().top;

    window.scrollTo({
      top: Math.max(0, Math.round(top - offset)),
      behavior: "smooth"
    });

    setTimelineActive(monthKey, { force: true, scrollIntoView: true });
  }

  function renderTimeline() {
    if (!$timelineWrap.length || !$timeline.length) {
      return;
    }

    timelineEntries = [];
    activeTimelineKey = "";
    $timeline.empty();

    if (!isDateSort()) {
      clearTimelinePreview();
      $timelineWrap.prop("hidden", true);
      setDeckHidden(deckHidden);
      return;
    }

    var elements = getArrangedVisibleElements();
    if (!elements.length) {
      clearTimelinePreview();
      $timelineWrap.prop("hidden", true);
      setDeckHidden(deckHidden);
      return;
    }

    var monthSeen = {};
    for (var i = 0; i < elements.length; i++) {
      var ts = Number(elements[i].getAttribute("data-date-ts"));
      if (!isFiniteNumber(ts) || ts <= 0) {
        continue;
      }

      var date = new Date(ts);
      if (!isFiniteNumber(date.getTime())) {
        continue;
      }

      var key = getMonthKeyFromDate(date);
      if (monthSeen[key]) {
        continue;
      }
      monthSeen[key] = true;

      timelineEntries.push({
        key: key,
        label: getMonthLabel(date),
        item: elements[i]
      });
    }

    if (!timelineEntries.length) {
      clearTimelinePreview();
      $timelineWrap.prop("hidden", true);
      setDeckHidden(deckHidden);
      return;
    }

    for (var j = 0; j < timelineEntries.length; j++) {
      var entry = timelineEntries[j];
      $timeline.append($("<button>", {
        "class": "timeline-chip",
        type: "button",
        "data-month-key": entry.key,
        text: entry.label,
        "aria-pressed": "false"
      }));
    }

    $timelineWrap.prop("hidden", false);
    clearTimelinePreview();
    setDeckHidden(deckHidden);
    queueTimelineActiveSync();
  }

  function setDeckHidden(hidden) {
    var hadCondensedClass = $controlDeck.hasClass("is-condensed");
    var isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    var willChange = hadCondensedClass !== !!hidden;
    var beforeHeight = 0;

    if (!$controlDeck.length) {
      return;
    }

    if (willChange) {
      beforeHeight = $controlDeck.outerHeight(true) || 0;
    }

    deckHidden = !!hidden;
    $controlDeck.toggleClass("is-condensed", deckHidden);
    if (!deckHidden) {
      $controlDeck.removeClass("is-condensed-expanded");
    }

    if ($deckCollapseSentinel.length) {
      if (isMobile && deckHidden && willChange) {
        var afterHeight = $controlDeck.outerHeight(true) || 0;
        var spacerHeight = Math.max(0, Math.round(beforeHeight - afterHeight));
        $deckCollapseSentinel.css("height", spacerHeight + "px");
      } else if (!isMobile) {
        $deckCollapseSentinel.css("height", "0px");
      } else if (!deckHidden) {
        $deckCollapseSentinel.css("height", "0px");
      }
    }

    var hasCondensedClass = $controlDeck.hasClass("is-condensed");
    if (hadCondensedClass !== hasCondensedClass && window.innerWidth > MOBILE_BREAKPOINT) {
      deckToggleLockUntil = Date.now() + DECK_TOGGLE_LOCK_MS;
    }
  }

  function setDeckCondensedExpanded(expanded) {
    if (!$controlDeck.length || !deckHidden) {
      $controlDeck.removeClass("is-condensed-expanded");
      return;
    }

    $controlDeck.toggleClass("is-condensed-expanded", !!expanded);
  }

  function ensureDeckCollapseSentinel() {
    if (!$controlDeck.length) {
      return;
    }

    $deckCollapseSentinel = $("#deck-collapse-sentinel");
    if ($deckCollapseSentinel.length) {
      return;
    }

    $deckCollapseSentinel = $("<div>", {
      id: "deck-collapse-sentinel",
      "class": "deck-collapse-sentinel",
      "aria-hidden": "true"
    });
    $controlDeck.after($deckCollapseSentinel);
  }

  function isDeckOutOfView() {
    if ($deckCollapseSentinel.length) {
      var sentinelRect = $deckCollapseSentinel.get(0).getBoundingClientRect();
      return sentinelRect.bottom <= 0;
    }

    if (!$controlDeck.length) {
      return false;
    }

    var rect = $controlDeck.get(0).getBoundingClientRect();
    return rect.bottom <= 0;
  }

  function updateDeckVisibilityOnScroll() {
    if (!$controlDeck.length) {
      return;
    }

    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var delta = scrollTop - lastScrollY;
    var isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    var nearTop = scrollTop < (isMobile ? 20 : 90);
    var now = Date.now();
    var hideDelta = 8;

    if (!isMobile && now < deckToggleLockUntil) {
      lastScrollY = scrollTop;
      return;
    }

    if (isMobile) {
      var deckOutOfView = isDeckOutOfView();

      if (nearTop) {
        setDeckHidden(false);
        lastScrollY = scrollTop;
        return;
      }

      if (hasExpandedFilterPanels() && !deckOutOfView) {
        setDeckHidden(false);
        lastScrollY = scrollTop;
        return;
      }

      if (deckHidden && !deckOutOfView) {
        setDeckHidden(false);
        lastScrollY = scrollTop;
        return;
      }

      if (!deckHidden && deckOutOfView) {
        setDeckHidden(true);
        setDeckCondensedExpanded(false);
        lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        return;
      }

      if (delta < -hideDelta) {
        setDeckCondensedExpanded(true);
      } else if (delta > hideDelta) {
        setDeckCondensedExpanded(false);
      }

      lastScrollY = scrollTop;
      return;
    }

    if (nearTop) {
      setDeckHidden(false);
      lastScrollY = scrollTop;
      return;
    }

    if (!deckHidden && isDeckOutOfView()) {
      setDeckHidden(true);
    }

    lastScrollY = scrollTop;
  }

  function getItemTags(item) {
    return String(item.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
  }

  function itemMatches(item, options) {
    var config = options || {};
    var tags = getItemTags(item);
    var query = state.query;
    var i = 0;

    if (state.country !== "*" && tags.indexOf(state.country) < 0) {
      return false;
    }

    if (state.includeTags.length) {
      if (state.tagMode === "any") {
        var anyMatch = false;
        for (i = 0; i < state.includeTags.length; i++) {
          if (tags.indexOf(state.includeTags[i]) >= 0) {
            anyMatch = true;
            break;
          }
        }
        if (!anyMatch) {
          return false;
        }
      } else {
        for (i = 0; i < state.includeTags.length; i++) {
          if (tags.indexOf(state.includeTags[i]) < 0) {
            return false;
          }
        }
      }
    }

    if (state.excludeTags.length) {
      for (i = 0; i < state.excludeTags.length; i++) {
        if (tags.indexOf(state.excludeTags[i]) >= 0) {
          return false;
        }
      }
    }

    if (state.collection) {
      var def = collectionIndex[state.collection];
      if (def) {
        if (def.year && String(item.getAttribute("data-year") || "") !== String(def.year)) {
          return false;
        }

        if (Array.isArray(def.include) && def.include.length) {
          for (i = 0; i < def.include.length; i++) {
            if (tags.indexOf(def.include[i]) < 0) {
              return false;
            }
          }
        }

        if (Array.isArray(def.exclude) && def.exclude.length) {
          for (i = 0; i < def.exclude.length; i++) {
            if (tags.indexOf(def.exclude[i]) >= 0) {
              return false;
            }
          }
        }
      }
    }

    if (query) {
      var plainQuery = query.charAt(0) === "#" ? query.slice(1) : query;
      if (plainQuery) {
        var searchText = String(item.getAttribute("data-search") || "");
        if (searchText.indexOf(plainQuery) < 0) {
          return false;
        }
      }
    }

    if (!config.ignoreProgressive && isProgressiveFilterActive()) {
      var progressiveIndex = Number(item.getAttribute("data-progressive-index") || 0);
      if (progressiveIndex >= progressiveLimit) {
        return false;
      }
    }

    return true;
  }

  function getVisibleItems() {
    return $grid.find(".item").filter(function() {
      return !this.classList.contains("isotope-hidden") && this.style.display !== "none";
    });
  }

  function getMatchedItemCountIgnoringProgressive() {
    var matched = 0;
    $grid.find(".item").each(function() {
      if (itemMatches(this, { ignoreProgressive: true })) {
        matched += 1;
      }
    });
    return matched;
  }

  function clearTimelinePreview() {
    if (!$grid.length) {
      return;
    }
    timelinePreviewKey = "";
    $grid.removeClass("timeline-hover-active");
    $grid.find(".item.is-timeline-hover-target").removeClass("is-timeline-hover-target");
  }

  function hideTimelineSection() {
    timelineEntries = [];
    activeTimelineKey = "";
    clearTimelinePreview();
    if ($timeline.length) {
      $timeline.empty();
    }
    if ($timelineWrap.length) {
      $timelineWrap.prop("hidden", true);
    }
    setDeckHidden(deckHidden);
  }

  function previewTimelineMonth(monthKey) {
    var key = String(monthKey || "");
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      clearTimelinePreview();
      return;
    }

    if (!key || !isDateSort()) {
      clearTimelinePreview();
      return;
    }

    if (timelinePreviewKey === key && $grid.hasClass("timeline-hover-active")) {
      return;
    }

    clearTimelinePreview();

    var $targets = getVisibleItems().filter(function() {
      return getItemMonthKey(this) === key;
    });

    if (!$targets.length) {
      return;
    }

    timelinePreviewKey = key;
    $grid.addClass("timeline-hover-active");
    $targets.addClass("is-timeline-hover-target");
  }

  function updateGalleryCounts() {
    if (!$galleryCounts.length) {
      return;
    }

    var total = totalPhotoCount || $grid.find(".item").length;
    var visible = getMatchedItemCountIgnoringProgressive();
    $galleryCounts.text("Visible " + visible + " / " + total + " photos");
  }

  function getVisibleSignature() {
    return getVisibleItems().map(function() {
      return this.getAttribute("data-id") || this.getAttribute("href") || "";
    }).get().join("|");
  }

  function syncLightGallery() {
    if (!galleryPlugin) {
      return;
    }

    var signature = getVisibleSignature();
    if (signature === lastVisibleSignature) {
      return;
    }

    lastVisibleSignature = signature;
    galleryPlugin.refresh();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getItemByPhotoId(photoId) {
    var clean = parsePhotoId(photoId);
    if (!clean) {
      return null;
    }
    var found = null;
    $grid.find(".item").each(function() {
      var itemId = String(this.getAttribute("data-id") || "");
      if (photoIdsMatch(itemId, clean)) {
        found = this;
        return false;
      }
    });
    return found;
  }

  function openPhotoInLightboxById(photoId) {
    var targetId = parsePhotoId(photoId);
    if (!targetId) {
      return false;
    }

    var visibleItems = getVisibleItems().toArray();
    if (!visibleItems.length) {
      return false;
    }

    var targetIndex = -1;
    for (var i = 0; i < visibleItems.length; i++) {
      if (photoIdsMatch(visibleItems[i].getAttribute("data-id"), targetId)) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex < 0) {
      return false;
    }

    syncLightGallery();

    if (galleryPlugin && typeof galleryPlugin.openGallery === "function") {
      galleryPlugin.openGallery(targetIndex);
      return true;
    }

    var $link = $(visibleItems[targetIndex]).find(".tile-link").first();
    if ($link.length && $link.get(0)) {
      $link.get(0).click();
      return true;
    }

    return false;
  }

  function ensurePhotoVisibleForOpen(photoId) {
    var item = getItemByPhotoId(photoId);
    if (!item) {
      return false;
    }
    if (FEATURES.progressiveLoad && isProgressiveFilterActive()) {
      var progressiveIndex = Number(item.getAttribute("data-progressive-index") || 0);
      if (progressiveIndex >= progressiveLimit) {
        progressiveLimit = Math.min(totalPhotoCount, progressiveIndex + 1);
      }
    }
    return true;
  }

  function updatePhotoStateFromLightbox(index) {
    if (!galleryPlugin || !Array.isArray(galleryPlugin.galleryItems) || !galleryPlugin.galleryItems.length) {
      state.photo = "";
      return;
    }

    var safeIndex = clamp(Number(index) || 0, 0, galleryPlugin.galleryItems.length - 1);
    var galleryItem = galleryPlugin.galleryItems[safeIndex] || {};
    var source = String(galleryItem.src || galleryItem.href || "").split("#")[0].split("?")[0];
    var filename = source.split("/").pop() || "";
    state.photo = filename;
    updateUrlFromState({ photoId: filename, keepPhoto: true });
  }

  function setCopyViewButtonLabel(label) {
    if (!$copyViewLink.length) {
      return;
    }
    var $text = $copyViewLink.find("span").first();
    if (!$text.length) {
      return;
    }
    $text.text(label);
  }

  function copyCurrentViewLink() {
    var link = window.location.href;
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      window.prompt("Copy this gallery link:", link);
      return;
    }

    navigator.clipboard.writeText(link).then(function() {
      setCopyViewButtonLabel("Copied");
      if (copyLinkResetTimer) {
        window.clearTimeout(copyLinkResetTimer);
      }
      copyLinkResetTimer = window.setTimeout(function() {
        setCopyViewButtonLabel("Copy view");
      }, 1400);
    }).catch(function() {
      window.prompt("Copy this gallery link:", link);
    });
  }

  function parseGpsCoordinate(value) {
    if (typeof value === "string") {
      var trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      var parsed = Number(trimmed);
      if (isFiniteNumber(parsed)) {
        return parsed;
      }
    }
    if (isFiniteNumber(value)) {
      return Number(value);
    }
    if (Array.isArray(value) && value.length) {
      var first = Number(value[0]);
      if (isFiniteNumber(first)) {
        return first;
      }
    }
    return null;
  }

  function getGeoFromDataAttributes(item) {
    if (!item) {
      return null;
    }
    var lat = parseGpsCoordinate(item.getAttribute("data-lat"));
    var lon = parseGpsCoordinate(item.getAttribute("data-lon"));
    if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
      return null;
    }
    return { lat: lat, lon: lon };
  }

  function loadGeoFromExif(source) {
    var src = String(source || "").trim();
    if (!src) {
      return Promise.resolve(null);
    }
    if (Object.prototype.hasOwnProperty.call(gpsCache, src)) {
      return Promise.resolve(gpsCache[src]);
    }

    function fallbackFromBinary() {
      return fetch(src, { cache: "force-cache" })
        .then(function(response) {
          if (!response.ok) {
            throw new Error("Image download failed");
          }
          return response.arrayBuffer();
        })
        .then(function(arrayBuffer) {
          var parsedExif = parseExifFromJpeg(arrayBuffer);
          var exif = toFallbackExifObject(parsedExif) || {};
          var lat = parseGpsCoordinate(exif.GPSLatitude);
          var lon = parseGpsCoordinate(exif.GPSLongitude);
          if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
            gpsCache[src] = null;
            return null;
          }
          var normalized = { lat: Number(lat), lon: Number(lon) };
          gpsCache[src] = normalized;
          return normalized;
        })
        .catch(function() {
          gpsCache[src] = null;
          return null;
        });
    }

    if (!window.exifr || (typeof window.exifr.gps !== "function" && typeof window.exifr.parse !== "function")) {
      return fallbackFromBinary();
    }

    var readerPromise = typeof window.exifr.gps === "function"
      ? window.exifr.gps(src)
      : window.exifr.parse(src, { gps: true });

    return Promise.resolve(readerPromise).then(function(gps) {
      var lat = parseGpsCoordinate(gps && (gps.latitude || gps.lat || gps.GPSLatitude));
      var lon = parseGpsCoordinate(gps && (gps.longitude || gps.lon || gps.GPSLongitude));
      if (isFiniteNumber(lat) && isFiniteNumber(lon)) {
        var normalized = { lat: Number(lat), lon: Number(lon) };
        gpsCache[src] = normalized;
        return normalized;
      }
      return fallbackFromBinary();
    }).catch(function() {
      return fallbackFromBinary();
    });
  }

  function resolveItemGeo(item) {
    var direct = getGeoFromDataAttributes(item);
    if (direct) {
      return Promise.resolve(direct);
    }

    var link = item ? item.querySelector(".tile-link") : null;
    var src = link ? (link.getAttribute("href") || "") : "";
    return loadGeoFromExif(src);
  }

  function ensureMapInstance() {
    if (!FEATURES.mapMode || !$mapSection.length || !$mapSummary.length) {
      return null;
    }
    if (!window.L) {
      return null;
    }
    if (mapInstance) {
      return mapInstance;
    }

    var container = document.getElementById("gallery-map");
    if (!container) {
      return null;
    }

    mapInstance = window.L.map(container, {
      zoomControl: true,
      scrollWheelZoom: true
    });

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapInstance);

    mapLayer = window.L.layerGroup().addTo(mapInstance);
    return mapInstance;
  }

  function renderMapForVisibleItems() {
    if (!FEATURES.mapMode || !state.mapMode) {
      return;
    }

    var map = ensureMapInstance();
    if (!map || !mapLayer) {
      if ($mapSummary.length) {
        $mapSummary.text("Map unavailable in this browser.");
      }
      return;
    }

    var items = getVisibleItems().toArray();
    if (!items.length) {
      mapLayer.clearLayers();
      $mapSummary.text("No visible photos to map.");
      return;
    }

    var sample = items.slice(0, MAX_MAP_MARKERS);
    var token = ++mapRenderToken;
    $mapSummary.text("Loading map markers...");

    var promises = sample.map(function(item) {
      return resolveItemGeo(item).then(function(geo) {
        return { item: item, geo: geo };
      });
    });

    Promise.all(promises).then(function(rows) {
      if (token !== mapRenderToken) {
        return;
      }

      mapLayer.clearLayers();

      var bounds = [];
      var mapped = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !row.geo || !isFiniteNumber(row.geo.lat) || !isFiniteNumber(row.geo.lon)) {
          continue;
        }

        mapped += 1;
        var latLng = [row.geo.lat, row.geo.lon];
        bounds.push(latLng);

        var photoId = String(row.item.getAttribute("data-id") || "");
        var desc = String(row.item.getAttribute("data-desc") || "Untitled");
        var permalink = String(row.item.getAttribute("data-permalink") || "/gallery/");
        var popupHtml = "<strong>" + escapeHtml(desc) + "</strong><br><a href='" + escapeHtml(permalink) + "'>Photo page</a>";

        var marker = window.L.marker(latLng, { title: desc });
        marker.bindPopup(popupHtml);
        marker.on("click", (function(id) {
          return function() {
            openPhotoInLightboxById(id);
          };
        })(photoId));
        marker.addTo(mapLayer);
      }

      if (bounds.length) {
        map.fitBounds(bounds, {
          padding: [28, 28],
          maxZoom: 13
        });
      } else {
        map.setView([20, 0], 2);
      }

      var sampleSuffix = items.length > sample.length ? " (limited preview)" : "";
      $mapSummary.text("Mapped " + mapped + " / " + sample.length + " visible photos" + sampleSuffix + ".");

      window.setTimeout(function() {
        if (mapInstance) {
          mapInstance.invalidateSize();
        }
      }, 40);
    });
  }

  function setMapMode(enabled, options) {
    var config = options || {};
    if (!FEATURES.mapMode) {
      state.mapMode = false;
      return;
    }

    state.mapMode = !!enabled;
    $body.toggleClass("is-map-mode", state.mapMode);
    $toggleMap.toggleClass("is-active", state.mapMode).attr("aria-pressed", state.mapMode ? "true" : "false");
    $mapSection.prop("hidden", !state.mapMode);

    if (state.mapMode) {
      renderMapForVisibleItems();
    }
    if (config.updateUrl !== false) {
      updateUrlFromState();
    }
  }

  function applyFilters(options) {
    var config = options || {};
    if (state.collection && !collectionIndex[state.collection]) {
      state.collection = "";
    }

    if (state.photo) {
      ensurePhotoVisibleForOpen(state.photo);
    }

    syncSortModeUi();
    clearTimelinePreview();

    if (!isDateSort()) {
      hideTimelineSection();
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setDeckHidden(false);
      }
    }

    if (state.sort === "random" && config.reshuffleRandom) {
      reseedRandomRanks();
    }

    var sortOptions = getSortOptions();

    $grid.isotope({
      filter: function() {
        return itemMatches(this);
      },
      sortBy: sortOptions.sortBy,
      sortAscending: sortOptions.sortAscending
    });

    updateUrlFromState();
  }

  function enableIsotopeTransitions() {
    if (hasEnabledIsotopeTransitions || !iso) {
      return;
    }

    hasEnabledIsotopeTransitions = true;
    $grid.isotope("option", {
      transitionDuration: ISOTOPE_TRANSITION_MS
    });
  }

  function initIsotope() {
    applyTileSize();
    hasEnabledIsotopeTransitions = false;

    iso = $grid.isotope({
      itemSelector: ".item",
      transitionDuration: 0,
      masonry: {
        columnWidth: getTileSize(),
        fitWidth: true,
        gutter: GRID_GUTTER
      },
      getSortData: {
        date: function(itemElem) {
          var value = Number(itemElem.getAttribute("data-date-ts"));
          return isFiniteNumber(value) ? value : 0;
        },
        random: function(itemElem) {
          var value = Number(itemElem.getAttribute("data-random-rank"));
          return isFiniteNumber(value) ? value : 0;
        }
      },
      sortBy: "random",
      sortAscending: {
        random: true
      }
    }).data("isotope");

    $grid.on("arrangeComplete", function() {
      progressiveLoadPending = false;
      syncLightGallery();
      renderTimeline();
      updateGalleryCounts();
      maybeAutoLoadMoreOnScroll();
      if (state.mapMode) {
        renderMapForVisibleItems();
      }
      if (pendingPhotoOpenId) {
        if (openPhotoInLightboxById(pendingPhotoOpenId)) {
          pendingPhotoOpenId = "";
        }
      }
      enableIsotopeTransitions();
    });
  }

  function initLightbox() {
    var root = document.getElementById("lightgallery");
    if (!root || typeof lightGallery !== "function") {
      return;
    }

    galleryPlugin = lightGallery(root, {
      selector: ".item:not(.isotope-hidden):not([style*='display: none']) .tile-link",
      plugins: [lgZoom, lgThumbnail],
      speed: 380,
      download: false,
      hideBarsDelay: 2200,
      actualSize: false,
      showZoomInOutIcons: true,
      mobileSettings: {
        showCloseIcon: true,
        download: false
      }
    });

    root.addEventListener("lgAfterOpen", function(event) {
      ensureLightboxFullscreenButton();
      syncFullscreenButtonState();
      var index = getLightboxIndex(event);
      queueExifUpdate(index);
      updatePhotoStateFromLightbox(index);
    });

    root.addEventListener("lgAfterSlide", function(event) {
      ensureLightboxFullscreenButton();
      syncFullscreenButtonState();
      var index = getLightboxIndex(event);
      queueExifUpdate(index);
      updatePhotoStateFromLightbox(index);
    });

    root.addEventListener("lgBeforeClose", function() {
      exifRequestToken += 1;
      var fsElement = getFullscreenElement();
      var lightboxRoot = getLightboxRootElement();
      if (fsElement && lightboxRoot && (fsElement === lightboxRoot || lightboxRoot.contains(fsElement))) {
        var exitResult = exitFullscreen();
        if (exitResult && typeof exitResult.catch === "function") {
          exitResult.catch(function() {});
        }
      }
    });

    root.addEventListener("lgAfterClose", function() {
      state.photo = "";
      updateUrlFromState({ keepPhoto: false });
    });
  }

  function isLightboxOpen() {
    if ($body.hasClass("lg-on")) {
      return true;
    }

    return !!document.querySelector(".lg-outer.lg-visible, .lg-outer.lg-show, .lg-container .lg-current");
  }

  function getLightboxIndex(event) {
    if (event && event.detail && isFiniteNumber(event.detail.index)) {
      return event.detail.index;
    }
    if (galleryPlugin && isFiniteNumber(galleryPlugin.index)) {
      return galleryPlugin.index;
    }
    return 0;
  }

  function getLightboxSource(index) {
    if (!galleryPlugin || !Array.isArray(galleryPlugin.galleryItems) || !galleryPlugin.galleryItems.length) {
      return "";
    }

    var safeIndex = clamp(Number(index) || 0, 0, galleryPlugin.galleryItems.length - 1);
    var item = galleryPlugin.galleryItems[safeIndex] || {};
    return item.src || item.href || "";
  }

  function getCurrentSubHtml() {
    var $active = $(".lg-current .lg-sub-html");
    if ($active.length) {
      return $active.first();
    }

    var $visible = $(".lg-sub-html").filter(function() {
      return this.offsetParent !== null;
    });
    if ($visible.length) {
      return $visible.first();
    }

    var $fallback = $(".lg-sub-html");
    return $fallback.length ? $fallback.last() : $();
  }

  function ensureExifPreview($panel) {
    if (!$panel || !$panel.length) {
      return $();
    }

    var $preview = $panel.children(".lg-exif-preview").first();
    if (!$preview.length) {
      $preview = $("<div>", { "class": "lg-exif-preview" });
      $preview.append($("<p>", { "class": "lg-exif-preview-title" }));
      $preview.append($("<p>", { "class": "lg-exif-preview-tags" }));

      var $toggle = $panel.children(".lg-exif-toggle").first();
      if ($toggle.length) {
        $toggle.before($preview);
      } else {
        $panel.prepend($preview);
      }
    } else {
      if (!$preview.children(".lg-exif-preview-title").length) {
        $preview.prepend($("<p>", { "class": "lg-exif-preview-title" }));
      }
      if (!$preview.children(".lg-exif-preview-tags").length) {
        $preview.append($("<p>", { "class": "lg-exif-preview-tags" }));
      }
    }

    return $preview;
  }

  function syncCollapsedExifPreview($panel) {
    var $preview = ensureExifPreview($panel);
    if (!$preview.length) {
      return;
    }

    var $subHtml = $panel.parent(".lg-sub-html");
    var titleText = "";
    var tagsText = "";
    if ($subHtml.length) {
      titleText = String($subHtml.children(".lg-title").first().text() || "").trim();
      tagsText = String($subHtml.children(".lg-tags").first().text() || "").trim();
      $subHtml.toggleClass("lg-exif-collapsed", !state.exifVisible);
    }

    var $title = $preview.children(".lg-exif-preview-title").first();
    var $tags = $preview.children(".lg-exif-preview-tags").first();

    $title.text(titleText);
    $tags.text(tagsText);
    $title.toggleClass("is-empty", !titleText);
    $tags.toggleClass("is-empty", !tagsText);

    $preview.toggleClass("is-empty", !titleText && !tagsText);
  }

  function ensureExifPanel() {
    var $subHtml = getCurrentSubHtml();
    if (!$subHtml.length) {
      return $();
    }

    var $panel = $subHtml.children(".lg-exif-panel");
    if (!$panel.length) {
      $panel = $("<div>", { "class": "lg-exif-panel" });
      $panel.append(
        $("<button>", {
          "class": "lg-exif-toggle",
          type: "button",
          "aria-pressed": state.exifVisible ? "false" : "true",
          "aria-label": state.exifVisible ? "Hide EXIF" : "Show EXIF",
          html: "<i class='fa-solid fa-chevron-up' aria-hidden='true'></i>"
        })
      );
      $panel.append(
        $("<div>", {
          "class": "lg-exif-body is-loading",
          text: "EXIF loading..."
        })
      );
      $subHtml.append($panel);
    } else if (!$panel.children(".lg-exif-toggle").length || !$panel.children(".lg-exif-body").length) {
      $panel.empty();
      $panel.append(
        $("<button>", {
          "class": "lg-exif-toggle",
          type: "button",
          "aria-pressed": state.exifVisible ? "false" : "true",
          "aria-label": state.exifVisible ? "Hide EXIF" : "Show EXIF",
          html: "<i class='fa-solid fa-chevron-up' aria-hidden='true'></i>"
        })
      );
      $panel.append($("<div>", { "class": "lg-exif-body" }));
    }

    ensureExifPreview($panel);
    syncInlineExifToggleUi($panel);
    return $panel;
  }

  function getExifBody($panel) {
    return $panel.children(".lg-exif-body").first();
  }

  function syncInlineExifToggleUi($panel) {
    if (!$panel || !$panel.length) {
      return;
    }

    var isCollapsed = !state.exifVisible;
    $panel.toggleClass("is-collapsed", isCollapsed);

    var $toggle = $panel.children(".lg-exif-toggle").first();
    if (!$toggle.length) {
      return;
    }

    $toggle.attr("aria-pressed", isCollapsed ? "true" : "false");
    $toggle.attr("aria-label", isCollapsed ? "Show EXIF" : "Hide EXIF");
    $toggle.attr("title", isCollapsed ? "Show EXIF" : "Hide EXIF");
    syncCollapsedExifPreview($panel);
  }

  function formatExifDate(value) {
    if (!value) {
      return "";
    }

    if (value instanceof Date && isFiniteNumber(value.getTime())) {
      var year = value.getFullYear();
      var month = String(value.getMonth() + 1).padStart(2, "0");
      var day = String(value.getDate()).padStart(2, "0");
      var hour = String(value.getHours()).padStart(2, "0");
      var minute = String(value.getMinutes()).padStart(2, "0");
      return year + "-" + month + "-" + day + " " + hour + ":" + minute;
    }

    var asText = String(value);
    var match = asText.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2})/);
    if (!match) {
      return asText;
    }

    return match[1] + "-" + match[2] + "-" + match[3] + " " + match[4] + ":" + match[5];
  }

  function formatExposure(value) {
    var exposure = Number(value);
    if (!isFiniteNumber(exposure) || exposure <= 0) {
      return "";
    }

    if (exposure >= 1) {
      return exposure.toFixed(exposure >= 10 ? 0 : 1) + " s";
    }

    return "1/" + Math.round(1 / exposure) + " s";
  }

  function formatAperture(value) {
    var aperture = Number(value);
    if (!isFiniteNumber(aperture) || aperture <= 0) {
      return "";
    }
    return "f/" + aperture.toFixed(1).replace(/\.0$/, "");
  }

  function formatFocalLength(value, value35) {
    var focal = Number(value);
    if (!isFiniteNumber(focal) || focal <= 0) {
      return "";
    }

    var text = focal.toFixed(1).replace(/\.0$/, "") + " mm";
    var eq = Number(value35);
    if (isFiniteNumber(eq) && eq > 0) {
      text += " (" + Math.round(eq) + " mm eq.)";
    }
    return text;
  }

  function firstExifValue(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function exifValueAsNumber(value) {
    var normalized = firstExifValue(value);
    if (isFiniteNumber(normalized)) {
      return normalized;
    }
    if (normalized && typeof normalized === "object" && isFiniteNumber(normalized.value)) {
      return normalized.value;
    }
    var parsed = Number(normalized);
    return isFinite(parsed) ? parsed : null;
  }

  function exifValueAsString(value) {
    var normalized = firstExifValue(value);
    if (typeof normalized === "string") {
      return normalized.trim();
    }
    if (isFiniteNumber(normalized)) {
      return String(normalized);
    }
    return "";
  }

  function readAsciiString(view, offset, length) {
    var chars = [];
    var maxOffset = Math.min(view.byteLength, offset + length);
    for (var i = offset; i < maxOffset; i++) {
      var code = view.getUint8(i);
      if (code === 0) {
        break;
      }
      chars.push(String.fromCharCode(code));
    }
    return chars.join("").trim();
  }

  function readIfdValue(view, entryOffset, type, count, littleEndian, tiffStart) {
    var typeSize = EXIF_TYPE_SIZES[type];
    if (!typeSize || !count) {
      return null;
    }

    var valueOffset = entryOffset + 8;
    var totalSize = typeSize * count;
    var dataOffset;

    if (totalSize <= 4) {
      dataOffset = valueOffset;
    } else {
      if (valueOffset + 4 > view.byteLength) {
        return null;
      }
      dataOffset = tiffStart + view.getUint32(valueOffset, littleEndian);
    }

    if (dataOffset < 0 || dataOffset + totalSize > view.byteLength) {
      return null;
    }

    if (type === 2) {
      return readAsciiString(view, dataOffset, count);
    }

    function readSingleValue(index) {
      var offset = dataOffset + (index * typeSize);
      if (offset + typeSize > view.byteLength) {
        return null;
      }

      if (type === 1 || type === 7) {
        return view.getUint8(offset);
      }
      if (type === 3) {
        return view.getUint16(offset, littleEndian);
      }
      if (type === 4) {
        return view.getUint32(offset, littleEndian);
      }
      if (type === 5) {
        var numerator = view.getUint32(offset, littleEndian);
        var denominator = view.getUint32(offset + 4, littleEndian);
        return {
          numerator: numerator,
          denominator: denominator,
          value: denominator ? (numerator / denominator) : null
        };
      }
      if (type === 9) {
        return view.getInt32(offset, littleEndian);
      }
      if (type === 10) {
        var signedNumerator = view.getInt32(offset, littleEndian);
        var signedDenominator = view.getInt32(offset + 4, littleEndian);
        return {
          numerator: signedNumerator,
          denominator: signedDenominator,
          value: signedDenominator ? (signedNumerator / signedDenominator) : null
        };
      }

      return null;
    }

    if (count === 1) {
      return readSingleValue(0);
    }

    var values = [];
    for (var i = 0; i < count; i++) {
      values.push(readSingleValue(i));
    }
    return values;
  }

  function readIfdEntries(view, ifdOffset, tiffStart, littleEndian) {
    if (!isFiniteNumber(ifdOffset) || ifdOffset < 0 || ifdOffset + 2 > view.byteLength) {
      return null;
    }

    var entries = {};
    var count = view.getUint16(ifdOffset, littleEndian);

    for (var i = 0; i < count; i++) {
      var entryOffset = ifdOffset + 2 + (i * 12);
      if (entryOffset + 12 > view.byteLength) {
        break;
      }

      var tag = view.getUint16(entryOffset, littleEndian);
      var type = view.getUint16(entryOffset + 2, littleEndian);
      var valueCount = view.getUint32(entryOffset + 4, littleEndian);
      entries[tag] = readIfdValue(view, entryOffset, type, valueCount, littleEndian, tiffStart);
    }

    return entries;
  }

  function parseExifFromJpeg(arrayBuffer) {
    var view = new DataView(arrayBuffer);
    if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
      return null;
    }

    var offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xFF) {
        offset += 1;
        continue;
      }

      var marker = view.getUint8(offset + 1);
      if (marker === 0xD9 || marker === 0xDA) {
        break;
      }

      var segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2) {
        break;
      }

      var segmentStart = offset + 4;
      var isExifSegment = marker === 0xE1 &&
        segmentStart + 6 <= view.byteLength &&
        view.getUint8(segmentStart) === 0x45 &&
        view.getUint8(segmentStart + 1) === 0x78 &&
        view.getUint8(segmentStart + 2) === 0x69 &&
        view.getUint8(segmentStart + 3) === 0x66;

      if (isExifSegment) {
        var tiffStart = segmentStart + 6;
        if (tiffStart + 8 > view.byteLength) {
          return null;
        }

        var byteOrder = view.getUint16(tiffStart, false);
        var littleEndian;
        if (byteOrder === 0x4949) {
          littleEndian = true;
        } else if (byteOrder === 0x4D4D) {
          littleEndian = false;
        } else {
          return null;
        }

        if (view.getUint16(tiffStart + 2, littleEndian) !== 42) {
          return null;
        }

        var ifd0Offset = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
        var ifd0 = readIfdEntries(view, ifd0Offset, tiffStart, littleEndian) || {};
        var exifPointer = exifValueAsNumber(ifd0[EXIF_TAGS.EXIF_POINTER]);
        var exifIfd = {};
        if (isFiniteNumber(exifPointer)) {
          exifIfd = readIfdEntries(view, tiffStart + exifPointer, tiffStart, littleEndian) || {};
        }
        var gpsPointer = exifValueAsNumber(ifd0[EXIF_TAGS.GPS_POINTER]);
        var gpsIfd = {};
        if (isFiniteNumber(gpsPointer)) {
          gpsIfd = readIfdEntries(view, tiffStart + gpsPointer, tiffStart, littleEndian) || {};
        }

        return {
          ifd0: ifd0,
          exif: exifIfd,
          gps: gpsIfd
        };
      }

      offset += 2 + segmentLength;
    }

    return null;
  }

  function toFallbackExifObject(parsedExif) {
    if (!parsedExif) {
      return null;
    }

    var ifd0 = parsedExif.ifd0 || {};
    var exif = parsedExif.exif || {};
    var gps = parsedExif.gps || {};
    var pixelX = exifValueAsNumber(exif[EXIF_TAGS.PIXEL_X_DIMENSION]);
    var pixelY = exifValueAsNumber(exif[EXIF_TAGS.PIXEL_Y_DIMENSION]);
    var imageWidth = exifValueAsNumber(ifd0[EXIF_TAGS.IMAGE_WIDTH]);
    var imageHeight = exifValueAsNumber(ifd0[EXIF_TAGS.IMAGE_HEIGHT]);

    function parseGpsRationals(raw) {
      if (!Array.isArray(raw) || raw.length < 3) {
        return null;
      }

      function toNumber(part) {
        if (part && typeof part === "object" && isFiniteNumber(part.value)) {
          return Number(part.value);
        }
        var numeric = Number(part);
        return isFiniteNumber(numeric) ? numeric : null;
      }

      var d = toNumber(raw[0]);
      var m = toNumber(raw[1]);
      var s = toNumber(raw[2]);
      if (!isFiniteNumber(d) || !isFiniteNumber(m) || !isFiniteNumber(s)) {
        return null;
      }
      return d + (m / 60) + (s / 3600);
    }

    function applyGpsRef(value, ref) {
      if (!isFiniteNumber(value)) {
        return null;
      }
      var normalizedRef = String(ref || "").trim().toUpperCase();
      if (normalizedRef === "S" || normalizedRef === "W") {
        return -Math.abs(value);
      }
      return Math.abs(value);
    }

    var gpsLat = applyGpsRef(parseGpsRationals(gps[EXIF_TAGS.GPS_LAT]), exifValueAsString(gps[EXIF_TAGS.GPS_LAT_REF]));
    var gpsLon = applyGpsRef(parseGpsRationals(gps[EXIF_TAGS.GPS_LON]), exifValueAsString(gps[EXIF_TAGS.GPS_LON_REF]));

    return {
      Make: exifValueAsString(ifd0[EXIF_TAGS.MAKE]),
      Model: exifValueAsString(ifd0[EXIF_TAGS.MODEL]),
      ModifyDate: exifValueAsString(ifd0[EXIF_TAGS.DATETIME]),
      DateTimeOriginal: exifValueAsString(exif[EXIF_TAGS.DATETIME_ORIGINAL]),
      ExposureTime: exifValueAsNumber(exif[EXIF_TAGS.EXPOSURE_TIME]),
      FNumber: exifValueAsNumber(exif[EXIF_TAGS.FNUMBER]),
      ISO: exifValueAsNumber(exif[EXIF_TAGS.ISO]),
      FocalLength: exifValueAsNumber(exif[EXIF_TAGS.FOCAL_LENGTH]),
      FocalLengthIn35mmFormat: exifValueAsNumber(exif[EXIF_TAGS.FOCAL_LENGTH_35]),
      LensModel: exifValueAsString(exif[EXIF_TAGS.LENS_MODEL]),
      ImageWidth: imageWidth,
      ImageHeight: imageHeight,
      PixelXDimension: pixelX,
      PixelYDimension: pixelY,
      ExifImageWidth: pixelX || imageWidth,
      ExifImageHeight: pixelY || imageHeight,
      GPSLatitude: gpsLat,
      GPSLongitude: gpsLon
    };
  }

  function buildExifSummaryRows(exif) {
    if (!exif || typeof exif !== "object") {
      return [];
    }

    var rows = [];
    var camera = [exif.Make, exif.Model].filter(Boolean).join(" ").trim();
    if (camera) {
      rows.push({ label: "Camera", value: camera });
    }

    if (exif.LensModel) {
      rows.push({ label: "Lens", value: String(exif.LensModel) });
    }

    var dateValue = formatExifDate(exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate);
    if (dateValue) {
      rows.push({ label: "Date", value: dateValue });
    }

    var exposureValue = formatExposure(exif.ExposureTime);
    if (exposureValue) {
      rows.push({ label: "Shutter", value: exposureValue });
    }

    var apertureValue = formatAperture(exif.FNumber);
    if (apertureValue) {
      rows.push({ label: "Aperture", value: apertureValue });
    }

    var isoValue = Number(exif.ISO);
    if (isFiniteNumber(isoValue) && isoValue > 0) {
      rows.push({ label: "ISO", value: String(Math.round(isoValue)) });
    }

    var focalValue = formatFocalLength(exif.FocalLength, exif.FocalLengthIn35mmFormat);
    if (focalValue) {
      rows.push({ label: "Focal", value: focalValue });
    }

    var width = Number(exif.ExifImageWidth || exif.ImageWidth || exif.PixelXDimension);
    var height = Number(exif.ExifImageHeight || exif.ImageHeight || exif.PixelYDimension);
    if (isFiniteNumber(width) && width > 0 && isFiniteNumber(height) && height > 0) {
      rows.push({ label: "Size", value: Math.round(width) + " x " + Math.round(height) + " px" });
    }

    return rows;
  }

  function loadExifSummaryFromBinary(resolvedSource) {
    return fetch(resolvedSource, { cache: "force-cache" })
      .then(function(response) {
        if (!response.ok) {
          throw new Error("Image download failed");
        }
        return response.arrayBuffer();
      })
      .then(function(arrayBuffer) {
        var parsedExif = parseExifFromJpeg(arrayBuffer);
        var exif = toFallbackExifObject(parsedExif);
        var rows = buildExifSummaryRows(exif);
        if (!rows.length) {
          return { error: "No EXIF data" };
        }
        return { rows: rows };
      })
      .catch(function() {
        return { error: "EXIF unavailable for this image" };
      });
  }

  function loadExifSummary(source) {
    if (!source) {
      return Promise.resolve({ error: "No EXIF data" });
    }

    var resolvedSource = source;
    try {
      resolvedSource = new URL(source, window.location.href).href;
    } catch (error) {}

    if (exifCache[resolvedSource]) {
      return exifCache[resolvedSource];
    }

    var exifrAvailable = !!(window.exifr && typeof window.exifr.parse === "function");
    if (exifrAvailable) {
      exifCache[resolvedSource] = window.exifr.parse(resolvedSource, {
        pick: [
          "Make",
          "Model",
          "LensModel",
          "DateTimeOriginal",
          "CreateDate",
          "ModifyDate",
          "ExposureTime",
          "FNumber",
          "ISO",
          "FocalLength",
          "FocalLengthIn35mmFormat",
          "ExifImageWidth",
          "ExifImageHeight",
          "ImageWidth",
          "ImageHeight",
          "PixelXDimension",
          "PixelYDimension"
        ]
      }).then(function(exif) {
        var rows = buildExifSummaryRows(exif);
        if (rows.length) {
          return { rows: rows };
        }
        return loadExifSummaryFromBinary(resolvedSource);
      }).catch(function() {
        return loadExifSummaryFromBinary(resolvedSource);
      });

      return exifCache[resolvedSource];
    }

    exifCache[resolvedSource] = loadExifSummaryFromBinary(resolvedSource);
    return exifCache[resolvedSource];
  }

  function renderExifSummary(summary) {
    var $panel = ensureExifPanel();
    if (!$panel.length) {
      return;
    }

    var $body = getExifBody($panel);
    syncInlineExifToggleUi($panel);

    if (!state.exifVisible) {
      $body.removeClass("is-loading is-empty").empty();
      return;
    }

    if (!summary || !summary.rows || !summary.rows.length) {
      var message = summary && summary.error ? summary.error : "No EXIF data";
      $body.removeClass("is-loading").addClass("is-empty").text(message);
      return;
    }

    $body.removeClass("is-loading is-empty").empty();
    for (var i = 0; i < summary.rows.length; i++) {
      var row = summary.rows[i];
      var $row = $("<div>", { "class": "lg-exif-row" });
      $row.append($("<span>", { "class": "lg-exif-key", text: row.label }));
      $row.append($("<span>", { "class": "lg-exif-value", text: row.value }));
      $body.append($row);
    }
  }

  function updateExifPanelForIndex(index) {
    var $panel = ensureExifPanel();
    if (!$panel.length) {
      return;
    }

    var $body = getExifBody($panel);
    syncInlineExifToggleUi($panel);

    if (!state.exifVisible) {
      $body.removeClass("is-loading is-empty").empty();
      return;
    }

    var source = getLightboxSource(index);
    if (!source) {
      renderExifSummary({ error: "No EXIF data" });
      return;
    }

    $body.removeClass("is-empty").addClass("is-loading").text("EXIF loading...");
    var requestToken = ++exifRequestToken;

    loadExifSummary(source).then(function(summary) {
      if (requestToken !== exifRequestToken) {
        return;
      }
      renderExifSummary(summary);
    });
  }

  function queueExifUpdate(index) {
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function() {
        updateExifPanelForIndex(index);
      });
      return;
    }

    window.setTimeout(function() {
      updateExifPanelForIndex(index);
    }, 0);
  }

  function getFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  function getLightboxRootElement() {
    return document.querySelector(".lg-outer.lg-visible") || document.querySelector(".lg-outer");
  }

  function requestFullscreen(element) {
    if (!element) {
      return null;
    }
    if (typeof element.requestFullscreen === "function") {
      return element.requestFullscreen();
    }
    if (typeof element.webkitRequestFullscreen === "function") {
      element.webkitRequestFullscreen();
      return null;
    }
    if (typeof element.msRequestFullscreen === "function") {
      element.msRequestFullscreen();
      return null;
    }
    return null;
  }

  function exitFullscreen() {
    if (typeof document.exitFullscreen === "function") {
      return document.exitFullscreen();
    }
    if (typeof document.webkitExitFullscreen === "function") {
      document.webkitExitFullscreen();
      return null;
    }
    if (typeof document.msExitFullscreen === "function") {
      document.msExitFullscreen();
      return null;
    }
    return null;
  }

  function ensureLightboxFullscreenButton() {
    var root = getLightboxRootElement();
    if (!root) {
      return null;
    }

    var toolbar = root.querySelector(".lg-toolbar");
    if (!toolbar) {
      return null;
    }

    var button = toolbar.querySelector(".lg-fullscreen-toggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "lg-icon lg-fullscreen-toggle";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Enter fullscreen");
      button.setAttribute("title", "Enter fullscreen");
      button.innerHTML = "<i class='fa-solid fa-expand' aria-hidden='true'></i>";
      toolbar.appendChild(button);
    }

    return button;
  }

  function setFullscreenButtonState(isActive) {
    var button = ensureLightboxFullscreenButton();
    if (!button) {
      return;
    }

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", isActive ? "Exit fullscreen" : "Enter fullscreen");
    button.setAttribute("title", isActive ? "Exit fullscreen" : "Enter fullscreen");

    var icon = button.querySelector("i");
    if (!icon) {
      return;
    }

    icon.classList.remove("fa-expand", "fa-compress");
    icon.classList.add(isActive ? "fa-compress" : "fa-expand");
  }

  function syncFullscreenButtonState() {
    setFullscreenButtonState(!!getFullscreenElement());
  }

  function toggleFullscreen() {
    var result;
    if (getFullscreenElement()) {
      result = exitFullscreen();
    } else {
      var target = getLightboxRootElement() || document.documentElement;
      result = requestFullscreen(target);
    }

    if (result && typeof result.catch === "function") {
      result.catch(function() {});
    }
  }

  function setTheme(themeName, options) {
    var config = options || {};
    state.theme = normalizeTheme(themeName);
    $body.attr("data-theme", state.theme);
    $themeSelect.val(state.theme);
    syncCustomSelectFromNative($themeSelect);

    if (config.updateUrl !== false) {
      updateUrlFromState();
    }
  }

  function setExifVisibility(visible, options) {
    var config = options || {};
    state.exifVisible = !!visible;
    $body.toggleClass("exif-hidden", !state.exifVisible);

    if (config.persist !== false) {
      writeStorageJson(STORAGE.exifVisible, state.exifVisible);
    }
    if (config.updateUrl !== false) {
      updateUrlFromState();
    }

    $(".lg-exif-panel").each(function() {
      var $panel = $(this);
      syncInlineExifToggleUi($panel);
      var $body = getExifBody($panel);
      if (!state.exifVisible) {
        $body.removeClass("is-loading is-empty").empty();
      }
    });

    var lightboxContextPresent = isLightboxOpen() || !!document.querySelector(".lg-sub-html");
    if (state.exifVisible && lightboxContextPresent) {
      queueExifUpdate(getLightboxIndex());
    }
  }

  function toggleExifVisibility() {
    setExifVisibility(!state.exifVisible);
  }

  function focusSearch() {
    $search.trigger("focus");
    var input = $search.get(0);
    if (input && typeof input.setSelectionRange === "function") {
      var length = input.value.length;
      input.setSelectionRange(length, length);
    }
  }

  function clearSearch() {
    state.query = "";
    $search.val("");
  }

  function closeShortcuts() {
    var dialog = $shortcutDialog.get(0);
    if (!dialog) {
      return;
    }

    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }

    $shortcutDialog.removeAttr("open");
  }

  function openShortcuts() {
    var dialog = $shortcutDialog.get(0);
    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === "function") {
      if (dialog.open) {
        return;
      }
      dialog.showModal();
      return;
    }

    $shortcutDialog.attr("open", "open");
  }

  function surpriseMe() {
    var visibleLinks = getVisibleItems().find(".tile-link").toArray();
    if (!visibleLinks.length) {
      return;
    }

    syncLightGallery();

    var randomIndex = Math.floor(Math.random() * visibleLinks.length);
    if (galleryPlugin && typeof galleryPlugin.openGallery === "function") {
      galleryPlugin.openGallery(randomIndex);
      return;
    }

    visibleLinks[randomIndex].click();
  }

  function updateScrollProgress() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    var viewport = window.innerHeight || document.documentElement.clientHeight || 0;
    var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    var travel = Math.max(1, docHeight - viewport);
    var progress = clamp((scrollTop / travel) * 100, 0, 100);

    $scrollProgress.css("--scroll-progress", progress.toFixed(2));
    $scrollProgress.toggleClass("is-visible", scrollTop > 180);
  }

  function resetControls() {
    state.query = "";
    state.country = "*";
    clearTagFilters();
    state.tagFiltersExpanded = false;
    state.collectionsExpanded = false;
    state.collection = "";
    state.photo = "";
    progressiveLimit = clamp(PROGRESSIVE_INITIAL_LIMIT, 1, Math.max(1, totalPhotoCount));
    progressiveLoadPending = false;
    state.sort = "random";

    $search.val("");
    $sortSelect.val("random");
    syncCustomSelectFromNative($sortSelect);

    setTheme("classic", { persist: true, updateUrl: false });
    setExifVisibility(true, { persist: true, updateUrl: false });
    setMapMode(false, { updateUrl: false });
    setCopyViewButtonLabel("Copy view");

    setTagFiltersExpanded(state.tagFiltersExpanded);
    setCollectionsExpanded(state.collectionsExpanded);
    updateChipUi();
    applyFilters({ reshuffleRandom: true });
    updateUrlFromState({ keepPhoto: false });
  }

  function bindEvents() {
    $(window).on("resize", function() {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(function() {
        applyTileSize();
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
          clearTimelinePreview();
        }
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
          var keepSemiExpanded = $controlDeck.hasClass("is-condensed-expanded");
          var currentScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
          if (currentScrollTop < 20 || (hasExpandedFilterPanels() && !isDeckOutOfView())) {
            setDeckHidden(false);
          } else if (isDeckOutOfView()) {
            setDeckHidden(true);
            setDeckCondensedExpanded(keepSemiExpanded);
          } else {
            setDeckHidden(false);
          }
        } else {
          setDeckHidden(false);
        }
        if (!iso) {
          queueTimelineActiveSync();
          return;
        }
        $grid.isotope("option", {
          masonry: {
            columnWidth: getTileSize(),
            fitWidth: true,
            gutter: GRID_GUTTER
          }
        });
        $grid.isotope("layout");
        renderTimeline();
        queueTimelineActiveSync();
        if (state.mapMode && mapInstance) {
          mapInstance.invalidateSize();
          renderMapForVisibleItems();
        }
      }, 120);
    });

    $(window).on("scroll", function() {
      updateScrollProgress();
      updateDeckVisibilityOnScroll();
      queueTimelineActiveSync();
      maybeAutoLoadMoreOnScroll();
    });

    document.addEventListener("fullscreenchange", syncFullscreenButtonState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenButtonState);
    document.addEventListener("msfullscreenchange", syncFullscreenButtonState);

    document.addEventListener("pointermove", function(event) {
      var width = Math.max(1, window.innerWidth || 1);
      var height = Math.max(1, window.innerHeight || 1);
      document.documentElement.style.setProperty("--pointer-x", ((event.clientX / width) * 100).toFixed(2) + "%");
      document.documentElement.style.setProperty("--pointer-y", ((event.clientY / height) * 100).toFixed(2) + "%");
    }, { passive: true });

    $search.on("input", function() {
      state.query = String($(this).val() || "").trim().toLowerCase();
      applyFilters({ reshuffleRandom: false });
    });

    $clearSearch.on("click", function() {
      clearSearch();
      applyFilters({ reshuffleRandom: false });
      focusSearch();
    });

    $sortSelect.on("change", function() {
      state.sort = normalizeSort(String($(this).val() || "random").toLowerCase());
      applyFilters({ reshuffleRandom: state.sort === "random" });
    });

    $themeSelect.on("change", function() {
      setTheme(String($(this).val() || "classic"));
    });

    $countryTags.on("click", ".chip", function() {
      var tag = String(this.getAttribute("data-tag") || "*");
      state.country = state.country === tag ? "*" : tag;
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $toggleTagFilters.on("click", function() {
      setTagFiltersExpanded(!state.tagFiltersExpanded);
    });

    $toggleCollections.on("click", function() {
      setCollectionsExpanded(!state.collectionsExpanded);
    });

    $includeTags.on("click", ".chip", function() {
      var tag = String(this.getAttribute("data-tag") || "");
      toggleTagSelection("include", tag);
      state.collection = "";
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $excludeTags.on("click", ".chip", function() {
      var tag = String(this.getAttribute("data-tag") || "");
      toggleTagSelection("exclude", tag);
      state.collection = "";
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $tagModeToggle.on("click", function() {
      state.tagMode = state.tagMode === "all" ? "any" : "all";
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $clearTagFilters.on("click", function() {
      clearTagFilters();
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $collectionTags.on("click", ".chip", function() {
      var id = String(this.getAttribute("data-collection-id") || "");
      state.collection = state.collection === id ? "" : id;
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $clearCollection.on("click", function() {
      state.collection = "";
      updateChipUi();
      applyFilters({ reshuffleRandom: false });
    });

    $timeline.on("click", ".timeline-chip", function() {
      var monthKey = String(this.getAttribute("data-month-key") || "");
      scrollToTimelineMonth(monthKey);
    });

    $timeline.on("mouseenter focusin", ".timeline-chip", function() {
      var monthKey = String(this.getAttribute("data-month-key") || "");
      previewTimelineMonth(monthKey);
    });

    $timeline.on("mouseleave", function() {
      clearTimelinePreview();
    });

    $timeline.on("focusout", ".timeline-chip", function() {
      window.setTimeout(function() {
        if (!$timeline.length) {
          return;
        }
        var active = document.activeElement;
        if (active && $timeline.get(0).contains(active)) {
          return;
        }
        clearTimelinePreview();
      }, 0);
    });

    if ($deckMainRow.length) {
      $deckMainRow.on("mouseenter", function() {
        setDeckCondensedExpanded(true);
      });

      $deckMainRow.on("focusin", function() {
        setDeckCondensedExpanded(true);
      });
    }

    $controlDeck.on("mouseleave", function() {
      setDeckCondensedExpanded(false);
    });

    $controlDeck.on("focusout", function() {
      window.setTimeout(function() {
        if (!$controlDeck.length) {
          return;
        }
        var active = document.activeElement;
        if (active && $controlDeck.get(0).contains(active)) {
          return;
        }
        setDeckCondensedExpanded(false);
      }, 0);
    });

    $(document).on("click", ".lg-exif-toggle", function(event) {
      event.preventDefault();
      event.stopPropagation();
      toggleExifVisibility();
    });

    $(document).on("click", ".lg-fullscreen-toggle", function(event) {
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen();
    });

    $surpriseMe.on("click", surpriseMe);

    $shuffleVisible.on("click", function() {
      state.sort = "random";
      $sortSelect.val("random");
      syncCustomSelectFromNative($sortSelect);
      applyFilters({ reshuffleRandom: true });
    });

    $resetAll.on("click", function() {
      resetControls();
    });

    $copyViewLink.on("click", function() {
      copyCurrentViewLink();
    });

    $showShortcuts.on("click", function() {
      openShortcuts();
    });

    $closeShortcuts.on("click", function() {
      closeShortcuts();
    });

    $shortcutDialog.on("click", function(event) {
      if (event.target === this) {
        closeShortcuts();
      }
    });

    $scrollProgress.on("click", function() {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

    document.addEventListener("keydown", function(event) {
      var key = String(event.key || "");
      var target = event.target;
      var insideCustomSelect = !!(target && typeof target.closest === "function" && target.closest(".custom-select"));
      var isTypingField = target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );

      if (key === "Escape" && closeAllCustomSelects()) {
        event.preventDefault();
        return;
      }

      if (key === "/" && !event.shiftKey && !isTypingField && !insideCustomSelect) {
        event.preventDefault();
        focusSearch();
        return;
      }

      if ((key === "?" || (key === "/" && event.shiftKey)) && !isTypingField && !insideCustomSelect) {
        event.preventDefault();
        openShortcuts();
        return;
      }

      if (key === "Escape") {
        if ($shortcutDialog.length && $shortcutDialog.get(0).open) {
          closeShortcuts();
          return;
        }

        if (getFullscreenElement()) {
          return;
        }

        if ($search.val()) {
          clearSearch();
          applyFilters({ reshuffleRandom: false });
        }
        return;
      }

      if (isTypingField || insideCustomSelect) {
        return;
      }

      var noModifierKeys = !event.metaKey && !event.ctrlKey && !event.altKey;
      var keyLower = key.toLowerCase();

      if (noModifierKeys && (keyLower === "n" || keyLower === "p")) {
        var now = Date.now();
        var comboWithinWindow = (now - secretThemeCombo.lastAt) <= 1100;
        var oppositeKey = keyLower === "n" ? "p" : "n";
        if (comboWithinWindow && secretThemeCombo.lastKey === oppositeKey) {
          event.preventDefault();
          setTheme("rainbow");
          secretThemeCombo.lastKey = "";
          secretThemeCombo.lastAt = 0;
          return;
        }
        secretThemeCombo.lastKey = keyLower;
        secretThemeCombo.lastAt = now;
      }

      if (keyLower === "r" && !event.shiftKey && noModifierKeys) {
        state.sort = "random";
        $sortSelect.val("random");
        syncCustomSelectFromNative($sortSelect);
        applyFilters({ reshuffleRandom: true });
      }

      if (keyLower === "f") {
        if (isLightboxOpen()) {
          toggleFullscreen();
        }
      }

      if (keyLower === "c" && noModifierKeys) {
        copyCurrentViewLink();
      }

      if (keyLower === "x") {
        toggleExifVisibility();
      }
    });

    $(document).on("click", function(event) {
      if ($(event.target).closest(".custom-select").length) {
        return;
      }
      closeAllCustomSelects();
    });
  }

  function bootstrap() {
    enforceTopOnReload();

    FEATURES.mapMode = readFeatureFlag("data-feature-map", false);
    FEATURES.collections = readFeatureFlag("data-feature-collections", true);
    FEATURES.progressiveLoad = readFeatureFlag("data-feature-progressive-load", true);

    if (!FEATURES.mapMode) {
      state.mapMode = false;
      if ($toggleMap.length) {
        $toggleMap.prop("hidden", true);
      }
      if ($mapSection.length) {
        $mapSection.prop("hidden", true);
      }
    }

    if (!FEATURES.collections && $collectionsWrap.length) {
      state.collectionsExpanded = false;
      state.collection = "";
      $collectionsWrap.prop("hidden", true);
    }

    ensureDeckCollapseSentinel();

    prepareItems();
    progressiveLimit = clamp(PROGRESSIVE_INITIAL_LIMIT, 1, Math.max(1, totalPhotoCount));

    state.theme = "classic";
    var storedExifVisible = readStorageJson(STORAGE.exifVisible, true);
    state.exifVisible = storedExifVisible !== false;

    applyStateFromUrl();

    $search.val(state.query);
    $sortSelect.val(state.sort);
    $themeSelect.val(state.theme);
    initCustomSelects();

    var tagCounts = getAllTagCounts();
    renderCountryChips($countryTags, COUNTRY_TAGS, COUNTRY_LABELS, tagCounts);
    renderAdvancedTagFilters(tagCounts);
    buildCollections(tagCounts);
    renderCollections();
    normalizeTagState();

    if (state.country !== "*" && !$countryTags.find('.chip[data-tag="' + state.country + '"]').length) {
      state.country = "*";
    }
    if (state.collection && !collectionIndex[state.collection]) {
      state.collection = "";
    }

    initIsotope();
    initLightbox();

    setTheme(state.theme, { persist: false, updateUrl: false });
    setExifVisibility(state.exifVisible, { persist: false, updateUrl: false });
    setMapMode(state.mapMode, { updateUrl: false });
    syncFullscreenButtonState();
    setTagFiltersExpanded(state.tagFiltersExpanded);
    setCollectionsExpanded(state.collectionsExpanded);
    updateChipUi();
    lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    bindEvents();

    if (state.photo) {
      pendingPhotoOpenId = state.photo;
    }

    applyFilters({ reshuffleRandom: true });
    updateScrollProgress();
    updateDeckVisibilityOnScroll();
    renderTimeline();
    updateGalleryCounts();
    syncLightGallery();
    queueTimelineActiveSync();
    updateUrlFromState();
  }

  bootstrap();
})(window.jQuery);
