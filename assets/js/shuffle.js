// external js: isotope.pkgd.js

var $gridElement = $('.grid');
prepareDateMetadata($gridElement.find('.item'));
var ZOOM_STEP = 0.2;
var DESKTOP_TILE_SIZE = 195;
var MOBILE_LAYOUT_BREAKPOINT = 640;
var GRID_GUTTER = 3;
var $grid = null;

function getViewportWidth() {
  return window.innerWidth || document.documentElement.clientWidth || 0;
}

function isMobileLayout() {
  return getViewportWidth() <= MOBILE_LAYOUT_BREAKPOINT;
}

function getGridContainerWidth() {
  var $gridWrap = $gridElement.closest('.grid-wrap');
  if ($gridWrap.length) {
    var wrapContentWidth = Math.floor($gridWrap.width());
    if (wrapContentWidth > 0) {
      return wrapContentWidth;
    }
  }

  var $galleryContent = $gridElement.closest('.gallery-content');
  if ($galleryContent.length) {
    var galleryWidth = Math.floor($galleryContent.width());
    if (galleryWidth > 0) {
      return galleryWidth;
    }
  }

  if ($gridElement.length) {
    var gridWidth = Math.floor($gridElement.width());
    if (gridWidth > 0) {
      return gridWidth;
    }
  }

  return getViewportWidth();
}

function getResponsiveTileSize() {
  if (getViewportWidth() > MOBILE_LAYOUT_BREAKPOINT) {
    return DESKTOP_TILE_SIZE;
  }

  var containerWidth = getGridContainerWidth();
  var tileSize = Math.floor((containerWidth - GRID_GUTTER) / 2);
  return Math.max(120, Math.min(DESKTOP_TILE_SIZE, tileSize));
}

function applyResponsiveGridSize(shouldRelayout) {
  var tileSize = getResponsiveTileSize();
  document.documentElement.style.setProperty('--gallery-tile-size', tileSize + 'px');

  if (!$grid || !$grid.data('isotope')) {
    return;
  }

  $grid.isotope('option', {
    masonry: {
      columnWidth: tileSize,
      isFitWidth: true,
      gutter: GRID_GUTTER
    }
  });

  if (shouldRelayout) {
    $grid.isotope('layout');
  }
}

var plugin = lightGallery(document.getElementById('lightgallery'), {
  plugins: [lgZoom],
  speed: 300,
  selector: '.item:not(.isotope-hidden):not([style*="display: none"])',
  actualSize: true,
  actualSizeIcons: {
    zoomIn: 'lg-actual-size',
    zoomOut: 'lg-actual-size'
  },
  zoomPluginStrings: {
    zoomIn: 'Zoom in (+)',
    zoomOut: 'Zoom out (-)',
    viewActualSize: '1:1'
  },
  showZoomInOutIcons: true,
  enableZoomAfter: 0,
  scale: ZOOM_STEP
});

var initialTileSize = getResponsiveTileSize();
document.documentElement.style.setProperty('--gallery-tile-size', initialTileSize + 'px');

// init Isotope
$grid = $gridElement.isotope({
  itemSelector: '.item',
  // layoutMode: '',
  // isfitWidth: true,
  masonry: {
    columnWidth: initialTileSize,
    isFitWidth: true,
    gutter: GRID_GUTTER,
    // horizontalOrder: true,
    },
  getSortData: {
    sortdate: function(itemElem) {
      return getItemTimestamp(itemElem);
    },
    randomrank: function(itemElem) {
      return getItemRandomRank(itemElem);
    }
  },
  sortBy: 'randomrank',
  sortAscending: {
    sortdate: false,
    randomrank: true
  }
});

$grid.imagesLoaded().progress( function() {
  $grid.isotope('layout');
});

var currentFilter = '*';
var currentQuery = '';
var $meta = $('#filter-meta');
var $searchInput = $('#gallery-search');
var $scrollTopFab = $('#scroll-top-fab');
var $suggestions = $('#gallery-search-suggestions');
var $countryTags = $('#country-tags');
var $categoryTags = $('#category-tags');
var $sortSelect = $('#gallery-sort');
var $sortControl = $('.sort-control');
var $timelineMonths = $('#timeline-months');
var $galleryContent = $('.gallery-content');
var $timelinePanel = $('.timeline-panel');
var $filterPanel = $('.filter-panel');
var filterPanelCompact = false;
var filterPanelHovered = false;
var filterPanelOffsetTimer = null;
var filterPanelToggleLockUntil = 0;
var FILTER_PANEL_COMPACT_ENTER_Y = 170;
var FILTER_PANEL_COMPACT_EXIT_Y = 16;
var FILTER_PANEL_TOGGLE_LOCK_MS = 320;
var sortValue = String($sortSelect.val() || '').toLowerCase();
var currentSort = (sortValue === 'date-asc' || sortValue === 'date-desc') ? sortValue : 'random';
var activeMonthKey = '';
var monthTargets = {};
var timelineMonthSequence = [];
var monthLabelFormatter = null;
try {
  monthLabelFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });
} catch (error) {
  monthLabelFormatter = null;
}
var ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

var COUNTRY_TAGS = [
  'chile', 'france', 'greece', 'ireland', 'italy', 'korea',
  'malta', 'norway', 'poland', 'spain', 'switzerland', 'uae', 'usa'
];
var COUNTRY_CODES = {
  chile: 'CHI',
  france: 'FRA',
  greece: 'GRE',
  ireland: 'IRL',
  italy: 'ITA',
  korea: 'KOR',
  malta: 'MLT',
  norway: 'NOR',
  poland: 'POL',
  spain: 'SPA',
  switzerland: 'SWI',
  uae: 'UAE',
  usa: 'USA'
};

var CATEGORY_TAGS = [
  'astrophoto', 'nature', 'architecture', 'bw', 'landscape', 'portrait', 'square', 'panorama'
];
var lastGalleryKey = '';
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
  EXIF_POINTER: 0x8769,
  DATETIME_ORIGINAL: 0x9003,
  EXPOSURE_TIME: 0x829A,
  FNUMBER: 0x829D,
  ISO: 0x8827,
  FOCAL_LENGTH: 0x920A,
  PIXEL_X_DIMENSION: 0xA002,
  PIXEL_Y_DIMENSION: 0xA003,
  FOCAL_LENGTH_35: 0xA405,
  LENS_MODEL: 0xA434
};
var exifCache = {};
var exifRequestToken = 0;
var wheelZoomCooldownUntil = 0;
var WHEEL_ZOOM_COOLDOWN_MS = 45;
var WHEEL_ZOOM_STEP_THRESHOLD = 80;
var WHEEL_ZOOM_MAX_STEPS = 8;
var WHEEL_ZOOM_BASE_STEPS = 1;
var ZOOM_BUTTON_IN_STEPS = 1;
var ZOOM_BUTTON_OUT_STEPS = 1;
var fillModeEnabled = false;
var fillModeSyncBound = false;

function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function canUseHoverState() {
  if (!window.matchMedia) {
    return false;
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function pad2(value) {
  return value < 10 ? ('0' + value) : String(value);
}

function parseDateFromFilename(value) {
  var match = String(value || '').match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
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
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day || parsed.getHours() !== hour ||
      parsed.getMinutes() !== minute || parsed.getSeconds() !== second) {
    return null;
  }
  return parsed;
}

function monthKeyFromDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1);
}

function prepareDateMetadata($items) {
  $items.each(function() {
    var source = this.getAttribute('data-sort') || '';
    var parsedDate = parseDateFromFilename(source);
    this.setAttribute('data-random-rank', String(Math.random()));
    if (!parsedDate) {
      this.setAttribute('data-date-ts', '0');
      this.setAttribute('data-month-key', '');
      return;
    }
    this.setAttribute('data-date-ts', String(parsedDate.getTime()));
    this.setAttribute('data-month-key', monthKeyFromDate(parsedDate));
  });
}

function getItemTimestamp(itemElement) {
  var value = Number(itemElement.getAttribute('data-date-ts'));
  return isFiniteNumber(value) ? value : 0;
}

function getItemMonthKey(itemElement) {
  return String(itemElement.getAttribute('data-month-key') || '');
}

function getItemRandomRank(itemElement) {
  var value = Number(itemElement.getAttribute('data-random-rank'));
  return isFiniteNumber(value) ? value : 0;
}

function formatMonthLabel(monthKey) {
  var match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return monthKey;
  }
  var year = Number(match[1]);
  var monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }

  if (isMobileLayout()) {
    return ROMAN_MONTHS[monthIndex] + ' ' + pad2(year % 100);
  }

  var parsedDate = new Date(year, monthIndex, 1);
  if (monthLabelFormatter) {
    return monthLabelFormatter.format(parsedDate);
  }
  return match[2] + '/' + match[1];
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
  return chars.join('').trim();
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
      var num = view.getUint32(offset, littleEndian);
      var den = view.getUint32(offset + 4, littleEndian);
      return {
        numerator: num,
        denominator: den,
        value: den ? (num / den) : null
      };
    }
    if (type === 9) {
      return view.getInt32(offset, littleEndian);
    }
    if (type === 10) {
      var signedNum = view.getInt32(offset, littleEndian);
      var signedDen = view.getInt32(offset + 4, littleEndian);
      return {
        numerator: signedNum,
        denominator: signedDen,
        value: signedDen ? (signedNum / signedDen) : null
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

function valueAsNumber(value) {
  var normalized = firstValue(value);
  if (isFiniteNumber(normalized)) {
    return normalized;
  }
  if (normalized && typeof normalized === 'object' && isFiniteNumber(normalized.value)) {
    return normalized.value;
  }
  var parsed = Number(normalized);
  return isFinite(parsed) ? parsed : null;
}

function valueAsString(value) {
  var normalized = firstValue(value);
  if (typeof normalized === 'string') {
    return normalized.trim();
  }
  if (isFiniteNumber(normalized)) {
    return String(normalized);
  }
  return '';
}

function formatExifDate(value) {
  if (!value) {
    return '';
  }
  var match = String(value).match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return value;
  }
  return match[1] + '-' + match[2] + '-' + match[3] + ' ' + match[4] + ':' + match[5];
}

function formatExposure(value) {
  var normalized = firstValue(value);
  if (!normalized) {
    return '';
  }

  if (normalized && typeof normalized === 'object' && isFiniteNumber(normalized.numerator) && isFiniteNumber(normalized.denominator) && normalized.denominator !== 0) {
    if (normalized.numerator >= normalized.denominator) {
      var seconds = normalized.numerator / normalized.denominator;
      return seconds.toFixed(seconds >= 10 ? 0 : 1) + ' s';
    }
    if (normalized.numerator === 1) {
      return '1/' + normalized.denominator + ' s';
    }
    return normalized.numerator + '/' + normalized.denominator + ' s';
  }

  var numberValue = valueAsNumber(normalized);
  if (!numberValue || !isFiniteNumber(numberValue)) {
    return '';
  }
  if (numberValue >= 1) {
    return numberValue.toFixed(numberValue >= 10 ? 0 : 1) + ' s';
  }
  return '1/' + Math.round(1 / numberValue) + ' s';
}

function formatAperture(value) {
  var aperture = valueAsNumber(value);
  if (!aperture || !isFiniteNumber(aperture)) {
    return '';
  }
  return 'f/' + aperture.toFixed(1).replace(/\.0$/, '');
}

function formatFocalLength(value, eq35) {
  var focal = valueAsNumber(value);
  if (!focal || !isFiniteNumber(focal)) {
    return '';
  }
  var label = focal.toFixed(1).replace(/\.0$/, '') + ' mm';
  var eq = valueAsNumber(eq35);
  if (eq && isFiniteNumber(eq)) {
    label += ' (' + Math.round(eq) + ' mm eq.)';
  }
  return label;
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
    if (marker === 0xE1 && segmentStart + 6 <= view.byteLength &&
      view.getUint8(segmentStart) === 0x45 && view.getUint8(segmentStart + 1) === 0x78 &&
      view.getUint8(segmentStart + 2) === 0x69 && view.getUint8(segmentStart + 3) === 0x66) {
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
      var exifPtr = valueAsNumber(ifd0[EXIF_TAGS.EXIF_POINTER]);
      var exif = {};
      if (isFiniteNumber(exifPtr)) {
        exif = readIfdEntries(view, tiffStart + exifPtr, tiffStart, littleEndian) || {};
      }
      return { ifd0: ifd0, exif: exif };
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function buildExifSummary(parsedExif) {
  if (!parsedExif) {
    return null;
  }

  var ifd0 = parsedExif.ifd0 || {};
  var exif = parsedExif.exif || {};
  var rows = [];

  var make = valueAsString(ifd0[EXIF_TAGS.MAKE]);
  var model = valueAsString(ifd0[EXIF_TAGS.MODEL]);
  var camera = (make + ' ' + model).trim();
  if (camera) {
    rows.push({ label: 'Camera', value: camera });
  }

  var lens = valueAsString(exif[EXIF_TAGS.LENS_MODEL]);
  if (lens) {
    rows.push({ label: 'Lens', value: lens });
  }

  var date = formatExifDate(valueAsString(exif[EXIF_TAGS.DATETIME_ORIGINAL]) || valueAsString(ifd0[EXIF_TAGS.DATETIME]));
  if (date) {
    rows.push({ label: 'Date', value: date });
  }

  var shutter = formatExposure(exif[EXIF_TAGS.EXPOSURE_TIME]);
  if (shutter) {
    rows.push({ label: 'Shutter', value: shutter });
  }

  var aperture = formatAperture(exif[EXIF_TAGS.FNUMBER]);
  if (aperture) {
    rows.push({ label: 'Aperture', value: aperture });
  }

  var iso = valueAsNumber(exif[EXIF_TAGS.ISO]);
  if (iso && isFiniteNumber(iso)) {
    rows.push({ label: 'ISO', value: String(Math.round(iso)) });
  }

  var focal = formatFocalLength(exif[EXIF_TAGS.FOCAL_LENGTH], exif[EXIF_TAGS.FOCAL_LENGTH_35]);
  if (focal) {
    rows.push({ label: 'Focal', value: focal });
  }

  var width = valueAsNumber(exif[EXIF_TAGS.PIXEL_X_DIMENSION]);
  var height = valueAsNumber(exif[EXIF_TAGS.PIXEL_Y_DIMENSION]);
  if (!width || !height) {
    width = valueAsNumber(ifd0[EXIF_TAGS.IMAGE_WIDTH]);
    height = valueAsNumber(ifd0[EXIF_TAGS.IMAGE_HEIGHT]);
  }
  if (width && height && isFiniteNumber(width) && isFiniteNumber(height)) {
    rows.push({ label: 'Size', value: Math.round(width) + ' x ' + Math.round(height) + ' px' });
  }

  if (!rows.length) {
    return null;
  }
  return { rows: rows };
}

function resolveSourceUrl(source) {
  try {
    return new URL(source, window.location.href).href;
  } catch (error) {
    return source;
  }
}

function loadExifForSource(source) {
  var resolvedSource = resolveSourceUrl(source);
  if (!resolvedSource) {
    return Promise.resolve(null);
  }

  if (exifCache[resolvedSource]) {
    return exifCache[resolvedSource];
  }

  exifCache[resolvedSource] = fetch(resolvedSource, { cache: 'force-cache' })
    .then(function(response) {
      if (!response.ok) {
        throw new Error('Image download failed');
      }
      return response.arrayBuffer();
    })
    .then(function(arrayBuffer) {
      return buildExifSummary(parseExifFromJpeg(arrayBuffer));
    })
    .catch(function() {
      return { error: 'EXIF could not be loaded in browser' };
    });

  return exifCache[resolvedSource];
}

function getCurrentSubHtml() {
  var $current = $('.lg-current .lg-sub-html');
  if ($current.length) {
    return $current.first();
  }
  var $fallback = $('.lg-sub-html');
  if ($fallback.length) {
    return $fallback.last();
  }
  return $();
}

function ensureExifPanel() {
  var $subHtml = getCurrentSubHtml();
  if (!$subHtml.length) {
    return $();
  }

  var $panel = $subHtml.children('.lg-exif-panel');
  if (!$panel.length) {
    $panel = $('<div>', {
      'class': 'lg-exif-panel is-loading',
      text: 'EXIF loading...'
    });
    $subHtml.append($panel);
  }
  return $panel;
}

function getGalleryItemSource(index) {
  var currentImage = document.querySelector('.lg-current .lg-image');
  if (currentImage) {
    var activeSource = currentImage.currentSrc || currentImage.src;
    if (activeSource) {
      return activeSource;
    }
  }

  if (!plugin || !plugin.galleryItems || !plugin.galleryItems.length) {
    return '';
  }

  var safeIndex = isFiniteNumber(index) ? index : plugin.index;
  if (!isFiniteNumber(safeIndex) || safeIndex < 0) {
    safeIndex = 0;
  }
  if (safeIndex >= plugin.galleryItems.length) {
    safeIndex = plugin.galleryItems.length - 1;
  }

  var item = plugin.galleryItems[safeIndex] || {};
  return item.src || item.href || '';
}

function renderExifSummary(summary) {
  var $panel = ensureExifPanel();
  if (!$panel.length) {
    return;
  }

  if (!summary || !summary.rows || !summary.rows.length) {
    if (summary && summary.error) {
      $panel.removeClass('is-loading').addClass('is-empty').text(summary.error);
      return;
    }
    $panel.removeClass('is-loading').addClass('is-empty').text('No EXIF data');
    return;
  }

  $panel.removeClass('is-loading is-empty').empty();
  for (var i = 0; i < summary.rows.length; i++) {
    var row = summary.rows[i];
    var $row = $('<div>', { 'class': 'lg-exif-row' });
    $row.append($('<span>', { 'class': 'lg-exif-key', text: row.label }));
    $row.append($('<span>', { 'class': 'lg-exif-value', text: row.value }));
    $panel.append($row);
  }
}

function updateExifPanelForIndex(index) {
  var source = getGalleryItemSource(index);
  var $panel = ensureExifPanel();
  if (!$panel.length) {
    return;
  }

  if (!source) {
    $panel.removeClass('is-loading').addClass('is-empty').text('No EXIF data');
    return;
  }

  $panel.removeClass('is-empty').addClass('is-loading').text('EXIF loading...');
  var requestToken = ++exifRequestToken;

  loadExifForSource(source).then(function(summary) {
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
  setTimeout(function() {
    updateExifPanelForIndex(index);
  }, 0);
}

function getLightGalleryIndex(event) {
  if (event && event.detail && isFiniteNumber(event.detail.index)) {
    return event.detail.index;
  }
  if (plugin && isFiniteNumber(plugin.index)) {
    return plugin.index;
  }
  return 0;
}

function isLightboxOpen() {
  return !!(document.body && document.body.classList.contains('lg-on'));
}

function canHandleWheelZoom(event) {
  if (!event || !event.target || typeof event.target.closest !== 'function') {
    return false;
  }
  return !!event.target.closest('.lg-current .lg-image, .lg-current .lg-object');
}

function getToolbarButton(action) {
  if (!plugin || typeof plugin.getElementById !== 'function') {
    return $();
  }

  var key = '';
  if (action === 'in') {
    key = 'lg-zoom-in';
  } else if (action === 'out') {
    key = 'lg-zoom-out';
  } else if (action === 'actual') {
    key = 'lg-actual-size';
  }
  if (!key) {
    return $();
  }

  var buttonApi = plugin.getElementById(key);
  if (!buttonApi || typeof buttonApi.get !== 'function') {
    return $();
  }
  var buttonEl = buttonApi.get();
  return buttonEl ? $(buttonEl) : $();
}

function applyZoomSteps(action, times) {
  var $button = getToolbarButton(action);
  if (!$button.length) {
    return;
  }

  var buttonEl = $button.get(0);
  if (!buttonEl || typeof buttonEl.click !== 'function') {
    return;
  }

  var repeats = Math.max(1, Math.min(WHEEL_ZOOM_MAX_STEPS, Number(times) || 1));
  for (var i = 0; i < repeats; i++) {
    buttonEl.click();
  }
}

function getGalleryElement(idName) {
  if (!plugin || typeof plugin.getElementById !== 'function') {
    return null;
  }
  var elementApi = plugin.getElementById(idName);
  if (!elementApi || typeof elementApi.get !== 'function') {
    return null;
  }
  return elementApi.get();
}

function requestGalleryFullscreen() {
  var containerEl = getGalleryElement('lg-container');
  if (!containerEl) {
    return;
  }
  var requestFullscreen = containerEl.requestFullscreen ||
    containerEl.webkitRequestFullscreen ||
    containerEl.msRequestFullscreen;
  if (!requestFullscreen) {
    return;
  }
  try {
    var result = requestFullscreen.call(containerEl);
    if (result && typeof result.catch === 'function') {
      result.catch(function() {});
    }
  } catch (error) {}
}

function exitGalleryFullscreen() {
  var fullscreenElement = document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;
  if (!fullscreenElement) {
    return;
  }

  var containerEl = getGalleryElement('lg-container');
  if (containerEl && fullscreenElement !== containerEl && !containerEl.contains(fullscreenElement)) {
    return;
  }

  var exitFullscreen = document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;
  if (!exitFullscreen) {
    return;
  }
  try {
    var result = exitFullscreen.call(document);
    if (result && typeof result.catch === 'function') {
      result.catch(function() {});
    }
  } catch (error) {}
}

function refreshFillButtonState() {
  var $fillButton = $('.lg-toolbar').find('.lg-custom-fill').first();
  if (!$fillButton.length) {
    return;
  }

  var label = fillModeEnabled ? 'Fit' : 'Fill';
  var ariaLabel = fillModeEnabled ? 'Exit fill mode' : 'Fill screen';
  $fillButton
    .text(label)
    .attr('title', ariaLabel)
    .attr('aria-label', ariaLabel)
    .attr('aria-pressed', fillModeEnabled ? 'true' : 'false')
    .toggleClass('is-active', fillModeEnabled);
}

function setFillMode(nextState) {
  var enabled = !!nextState;
  fillModeEnabled = enabled;

  var outerEl = getGalleryElement('lg-outer');
  if (outerEl) {
    $(outerEl).toggleClass('lg-photo-fill-mode', enabled);
  }

  if (enabled) {
    requestGalleryFullscreen();
  } else {
    exitGalleryFullscreen();
  }
  refreshFillButtonState();
}

function setupFillModeSync() {
  if (fillModeSyncBound) {
    return;
  }
  fillModeSyncBound = true;

  var syncFillState = function() {
    var fullscreenElement = document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;
    if (!fullscreenElement && fillModeEnabled) {
      setFillMode(false);
    }
  };

  document.addEventListener('fullscreenchange', syncFillState);
  document.addEventListener('webkitfullscreenchange', syncFillState);
  document.addEventListener('MSFullscreenChange', syncFillState);
}

function ensureCustomZoomButtons() {
  if (!plugin || typeof plugin.getElementById !== 'function') {
    return;
  }

  var toolbarApi = plugin.getElementById('lg-toolbar');
  if (!toolbarApi || typeof toolbarApi.get !== 'function') {
    return;
  }

  var toolbarEl = toolbarApi.get();
  if (!toolbarEl) {
    return;
  }

  var $toolbar = $(toolbarEl);
  var $actualSize = getToolbarButton('actual');

  if (!$toolbar.find('.lg-custom-zoom-in').length) {
    var zoomInButton = document.createElement('button');
    zoomInButton.type = 'button';
    zoomInButton.id = 'lg-custom-zoom-in-' + String(plugin.lgId || 'x');
    zoomInButton.className = 'lg-icon lg-custom-zoom-in lg-zoom-label';
    zoomInButton.textContent = '+';
    zoomInButton.setAttribute('title', 'Zoom in (+)');
    zoomInButton.setAttribute('aria-label', 'Zoom in (+)');
    if ($actualSize.length) {
      $actualSize.before(zoomInButton);
    } else {
      $toolbar.append(zoomInButton);
    }
  }

  if (!$toolbar.find('.lg-custom-zoom-out').length) {
    var zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.id = 'lg-custom-zoom-out-' + String(plugin.lgId || 'x');
    zoomOutButton.className = 'lg-icon lg-custom-zoom-out lg-zoom-label';
    zoomOutButton.textContent = '-';
    zoomOutButton.setAttribute('title', 'Zoom out (-)');
    zoomOutButton.setAttribute('aria-label', 'Zoom out (-)');
    if ($actualSize.length) {
      $actualSize.before(zoomOutButton);
    } else {
      $toolbar.append(zoomOutButton);
    }
  }

  if (!$toolbar.find('.lg-custom-fill').length) {
    var fillButton = document.createElement('button');
    fillButton.type = 'button';
    fillButton.id = 'lg-custom-fill-' + String(plugin.lgId || 'x');
    fillButton.className = 'lg-icon lg-custom-fill lg-zoom-label';
    fillButton.textContent = 'Fill';
    fillButton.setAttribute('title', 'Fill screen');
    fillButton.setAttribute('aria-label', 'Fill screen');
    fillButton.setAttribute('aria-pressed', 'false');
    if ($actualSize.length) {
      $actualSize.after(fillButton);
    } else {
      $toolbar.append(fillButton);
    }
  }
}

function setupCustomZoomButtonHandlers() {
  $(document).off('click.zoomboostcustom', '[id^="lg-custom-zoom-in-"]');
  $(document).off('click.zoomboostcustom', '[id^="lg-custom-zoom-out-"]');
  $(document).off('click.zoomboostcustom', '[id^="lg-custom-fill-"]');

  $(document).on('click.zoomboostcustom', '[id^="lg-custom-zoom-in-"]', function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    applyZoomSteps('in', ZOOM_BUTTON_IN_STEPS);
    setTimeout(refreshZoomButtonLabels, 0);
  });

  $(document).on('click.zoomboostcustom', '[id^="lg-custom-zoom-out-"]', function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    applyZoomSteps('out', ZOOM_BUTTON_OUT_STEPS);
    setTimeout(refreshZoomButtonLabels, 0);
  });

  $(document).on('click.zoomboostcustom', '[id^="lg-custom-fill-"]', function(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setFillMode(!fillModeEnabled);
    setTimeout(refreshZoomButtonLabels, 0);
  });
}

function handleLightboxWheelZoom(event) {
  if (!isLightboxOpen() || !canHandleWheelZoom(event)) {
    return;
  }

  var deltaY = Number(event.deltaY);
  if (!isFiniteNumber(deltaY) || deltaY === 0) {
    return;
  }

  event.preventDefault();
  var now = Date.now();
  if (now < wheelZoomCooldownUntil) {
    return;
  }

  var stepCount = WHEEL_ZOOM_BASE_STEPS + Math.floor(Math.abs(deltaY) / WHEEL_ZOOM_STEP_THRESHOLD);
  stepCount = Math.max(1, Math.min(WHEEL_ZOOM_MAX_STEPS, stepCount));
  applyZoomSteps(deltaY < 0 ? 'in' : 'out', stepCount);
  wheelZoomCooldownUntil = now + WHEEL_ZOOM_COOLDOWN_MS;
}

function refreshZoomButtonLabels() {
  var $zoomIn = $('.lg-toolbar').find('.lg-custom-zoom-in').first();
  if (!$zoomIn.length) {
    $zoomIn = getToolbarButton('in');
  }
  if ($zoomIn.length) {
    $zoomIn
      .text('+')
      .attr('title', 'Zoom in (+)')
      .attr('aria-label', 'Zoom in (+)')
      .addClass('lg-zoom-label');
  }

  var $zoomOut = $('.lg-toolbar').find('.lg-custom-zoom-out').first();
  if (!$zoomOut.length) {
    $zoomOut = getToolbarButton('out');
  }
  if ($zoomOut.length) {
    $zoomOut
      .text('-')
      .attr('title', 'Zoom out (-)')
      .attr('aria-label', 'Zoom out (-)')
      .addClass('lg-zoom-label');
  }

  var $actualSize = getToolbarButton('actual');
  if ($actualSize.length) {
    $actualSize
      .removeClass('lg-zoom-in lg-zoom-out')
      .addClass('lg-actual-size')
      .text('1:1')
      .attr('title', '1:1')
      .attr('aria-label', '1:1')
      .addClass('lg-zoom-label lg-zoom-label--actual');
  }
  refreshFillButtonState();
}

function setupWheelZoom() {
  document.addEventListener('wheel', handleLightboxWheelZoom, { passive: false });
}

function setupExifPanel() {
  var root = document.getElementById('lightgallery');
  if (!root) {
    return;
  }
  setupFillModeSync();

  root.addEventListener('lgAfterOpen', function(event) {
    ensureCustomZoomButtons();
    setupCustomZoomButtonHandlers();
    refreshZoomButtonLabels();
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgAfterSlide', function(event) {
    ensureCustomZoomButtons();
    setupCustomZoomButtonHandlers();
    refreshZoomButtonLabels();
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgAfterAppendSubHtml', function(event) {
    ensureCustomZoomButtons();
    setupCustomZoomButtonHandlers();
    refreshZoomButtonLabels();
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgBeforeClose', function() {
    setFillMode(false);
    exifRequestToken += 1;
  });
  $(document).off('click.zoomactual', '[id^="lg-actual-size-"]');
  $(document).on('click.zoomactual', '[id^="lg-actual-size-"]', function() {
    setTimeout(refreshZoomButtonLabels, 0);
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getVisibleItems() {
  return $grid.find('.item').filter(function() {
    return $(this).css('display') !== 'none';
  });
}

function isDateSortActive() {
  return currentSort === 'date-asc' || currentSort === 'date-desc';
}

function getSortLabel() {
  if (currentSort === 'date-asc') {
    return 'date oldest first';
  }
  if (currentSort === 'date-desc') {
    return 'date newest first';
  }
  return 'random';
}

function resetSortToRandom() {
  currentSort = 'random';
  if ($sortSelect.length) {
    $sortSelect.val('random');
  }
}

function reseedRandomRanks() {
  var $items = $grid.find('.item');
  $items.each(function() {
    this.setAttribute('data-random-rank', String(Math.random()));
  });
  $grid.isotope('updateSortData', $items);
}

function relayoutGridAfterSortUiToggle() {
  if (!$grid || !$grid.data('isotope')) {
    return;
  }

  var relayout = function() {
    applyResponsiveGridSize(false);
    $grid.isotope('layout');
    updateTimelineScrollCues();
  };

  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(function() {
      relayout();
      // A second pass catches width changes after CSS grid columns settle.
      setTimeout(relayout, 80);
    });
    return;
  }

  setTimeout(relayout, 16);
  setTimeout(relayout, 96);
}

function updateSortUI() {
  updateTimelineTopOffset();
  var showTimeline = isDateSortActive();
  $sortControl.toggleClass('is-timeline-active', showTimeline);
  $galleryContent.toggleClass('is-sort-active', showTimeline);
  $timelinePanel.toggleClass('is-hidden', !showTimeline);

  if (!showTimeline) {
    clearMonthPreview();
    activeMonthKey = '';
    monthTargets = {};
    timelineMonthSequence = [];
    $timelineMonths.empty().removeClass('is-empty');
    $timelinePanel.removeClass('is-scrollable can-scroll-left can-scroll-right');
  }

  updateTimelineScrollCues();
  relayoutGridAfterSortUiToggle();
}

function updateTimelineTopOffset() {
  if (!$timelinePanel.length) {
    return;
  }

  if (!$filterPanel.length) {
    return;
  }

  var panelHeight = $filterPanel.outerHeight();
  var panelTop = parseFloat($filterPanel.css('top'));
  if (!isFiniteNumber(panelHeight)) {
    panelHeight = 0;
  }
  if (!isFiniteNumber(panelTop)) {
    panelTop = 0;
  }

  var offset = Math.max(0, panelTop + panelHeight + 8);
  document.documentElement.style.setProperty('--timeline-top-offset', Math.round(offset) + 'px');
}

function updateScrollTopFabVisibility() {
  if (!$scrollTopFab.length) {
    return;
  }
  $scrollTopFab.toggleClass('is-visible', filterPanelCompact);
}

function updateFilterPanelCompactState(force) {
  if (!$filterPanel.length) {
    updateScrollTopFabVisibility();
    return;
  }

  if (!force && Date.now() < filterPanelToggleLockUntil) {
    return;
  }

  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var shouldCompact;
  var hoverActive = filterPanelHovered && canUseHoverState();
  if (hoverActive) {
    shouldCompact = false;
  } else if (filterPanelCompact) {
    shouldCompact = scrollY > FILTER_PANEL_COMPACT_EXIT_Y;
  } else {
    shouldCompact = scrollY > FILTER_PANEL_COMPACT_ENTER_Y;
  }

  if (!force && shouldCompact === filterPanelCompact) {
    return;
  }

  var changed = shouldCompact !== filterPanelCompact;
  filterPanelCompact = shouldCompact;
  $filterPanel.toggleClass('is-compact', shouldCompact);
  updateTimelineTopOffset();
  updateScrollTopFabVisibility();

  if (changed) {
    filterPanelToggleLockUntil = Date.now() + FILTER_PANEL_TOGGLE_LOCK_MS;
    if (filterPanelOffsetTimer) {
      clearTimeout(filterPanelOffsetTimer);
    }
    filterPanelOffsetTimer = setTimeout(function() {
      updateTimelineTopOffset();
      filterPanelOffsetTimer = null;
    }, 240);
  }
}

function updateMeta() {
  var allItems = getVisibleItems();
  var selectedTag = currentFilter === '*' ? '#all' : currentFilter.replace('.', '#');
  var queryInfo = currentQuery ? ' | query "' + currentQuery + '"' : '';
  $meta.text('Active: ' + selectedTag + queryInfo + ' | sort: ' + getSortLabel() + ' | photos: ' + allItems.length);
}

function getVisibleGalleryKey() {
  return getVisibleItems().map(function() {
    return this.getAttribute('href') || '';
  }).get().join('|');
}

function syncLightGallery() {
  var key = getVisibleGalleryKey();
  if (key === lastGalleryKey) {
    return;
  }
  lastGalleryKey = key;
  plugin.refresh();
}

function getVisibleItemInfos() {
  var visibleInfos = [];
  getVisibleItems().each(function() {
    var monthKey = getItemMonthKey(this);
    if (!monthKey) {
      return;
    }
    visibleInfos.push({
      element: this,
      monthKey: monthKey,
      timestamp: getItemTimestamp(this)
    });
  });

  visibleInfos.sort(function(a, b) {
    return currentSort === 'date-asc' ? (a.timestamp - b.timestamp) : (b.timestamp - a.timestamp);
  });
  return visibleInfos;
}

function updateTimeline() {
  if (!$timelineMonths.length) {
    return;
  }
  if (!isDateSortActive()) {
    updateTimelineEdgePeek();
    updateTimelineScrollCues();
    return;
  }

  var visibleInfos = getVisibleItemInfos();
  var monthCounts = {};
  var monthOrder = [];
  var monthElements = {};
  monthTargets = {};

  for (var i = 0; i < visibleInfos.length; i++) {
    var info = visibleInfos[i];
    if (!monthCounts[info.monthKey]) {
      monthCounts[info.monthKey] = 0;
      monthOrder.push(info.monthKey);
      monthElements[info.monthKey] = [];
    }
    monthCounts[info.monthKey] += 1;
    monthElements[info.monthKey].push(info.element);
  }

  for (var k = 0; k < monthOrder.length; k++) {
    var monthKeyForTarget = monthOrder[k];
    var elements = monthElements[monthKeyForTarget] || [];
    if (!elements.length) {
      continue;
    }
    monthTargets[monthKeyForTarget] = elements[Math.floor(elements.length / 2)];
  }
  timelineMonthSequence = monthOrder.slice();

  $timelineMonths.empty();
  if (!monthOrder.length) {
    activeMonthKey = '';
    timelineMonthSequence = [];
    $timelineMonths.addClass('is-empty').text('No dated photos in current view');
    updateTimelineEdgePeek();
    updateTimelineScrollCues();
    return;
  }

  $timelineMonths.removeClass('is-empty');
  if (!monthTargets[activeMonthKey]) {
    activeMonthKey = monthOrder[0];
  }

  for (var j = 0; j < monthOrder.length; j++) {
    var monthKey = monthOrder[j];
    var $button = $('<button>', {
      type: 'button',
      'class': 'timeline-month' + (monthKey === activeMonthKey ? ' is-active' : ''),
      'data-month': monthKey
    });
    $button.append($('<span>', { 'class': 'timeline-label', text: formatMonthLabel(monthKey) }));
    $button.append($('<span>', { 'class': 'timeline-count', text: String(monthCounts[monthKey]) }));
    $timelineMonths.append($button);
  }

  updateTimelineEdgePeek();
  syncActiveMonthWithViewport(true);
  updateTimelineScrollCues();
}

function updateTimelineEdgePeek() {
  if (!$timelineMonths.length) {
    return;
  }

  var container = $timelineMonths.get(0);
  if (!container) {
    return;
  }

  var firstButton = container.querySelector('.timeline-month:first-child');
  var lastButton = container.querySelector('.timeline-month:last-child');
  var firstPeek = firstButton ? Math.round(firstButton.getBoundingClientRect().width / 2) : 0;
  var lastPeek = lastButton ? Math.round(lastButton.getBoundingClientRect().width / 2) : 0;

  container.style.setProperty('--timeline-first-peek', firstPeek + 'px');
  container.style.setProperty('--timeline-last-peek', lastPeek + 'px');
}

function updateTimelineScrollCues() {
  if (!$timelinePanel.length || !$timelineMonths.length || !isDateSortActive() || $timelinePanel.hasClass('is-hidden')) {
    $timelinePanel.removeClass('is-scrollable can-scroll-left can-scroll-right');
    return;
  }

  var container = $timelineMonths.get(0);
  if (!container) {
    $timelinePanel.removeClass('is-scrollable can-scroll-left can-scroll-right');
    return;
  }

  var maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  var scrollLeft = Math.max(0, container.scrollLeft);
  var isScrollable = maxScrollLeft > 2;
  var canScrollLeft = isScrollable && scrollLeft > 1;
  var canScrollRight = isScrollable && scrollLeft < (maxScrollLeft - 1);

  $timelinePanel.toggleClass('is-scrollable', isScrollable);
  $timelinePanel.toggleClass('can-scroll-left', canScrollLeft);
  $timelinePanel.toggleClass('can-scroll-right', canScrollRight);
}

function scrollToMonth(monthKey) {
  var target = monthTargets[monthKey];
  if (!target) {
    return;
  }

  var centerY = getViewportCenterReferenceY();
  var rect = target.getBoundingClientRect();
  var targetCenterDocY = window.pageYOffset + rect.top + (rect.height / 2);
  var top = targetCenterDocY - centerY;
  window.scrollTo({
    top: Math.max(0, top),
    behavior: 'smooth'
  });
}

function ensureTimelineButtonVisible($button, smooth) {
  if (!$button || !$button.length || !$timelineMonths.length) {
    return;
  }

  var container = $timelineMonths.get(0);
  var button = $button.get(0);
  if (!container || !button) {
    return;
  }

  var containerRect = container.getBoundingClientRect();
  var buttonRect = button.getBoundingClientRect();
  var maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  var buttonCenter = (buttonRect.left - containerRect.left) + container.scrollLeft + (buttonRect.width / 2);
  var nextLeft = buttonCenter - (container.clientWidth / 2);
  nextLeft = Math.max(0, Math.min(maxScrollLeft, Math.round(nextLeft)));

  if (nextLeft === container.scrollLeft) {
    return;
  }

  if (typeof container.scrollTo === 'function') {
    container.scrollTo({
      left: nextLeft,
      behavior: smooth ? 'smooth' : 'auto'
    });
    return;
  }

  container.scrollLeft = nextLeft;
}

function isTimelineButtonCentered(monthKey) {
  if (!monthKey || !$timelineMonths.length) {
    return true;
  }

  var container = $timelineMonths.get(0);
  if (!container) {
    return true;
  }

  var $button = $timelineMonths.find('.timeline-month').filter(function() {
    return String($(this).attr('data-month') || '') === monthKey;
  });
  if (!$button.length) {
    return true;
  }

  var containerRect = container.getBoundingClientRect();
  var buttonRect = $button.get(0).getBoundingClientRect();
  var containerCenter = container.clientWidth / 2;
  var buttonCenter = (buttonRect.left - containerRect.left) + (buttonRect.width / 2);
  return Math.abs(containerCenter - buttonCenter) <= 3;
}

function setTimelineActiveMonth(monthKey, options) {
  if (!monthKey || !$timelineMonths.length) {
    return;
  }

  var config = {};
  if (typeof options === 'boolean') {
    config.smoothTimelineScroll = options;
    config.ensureVisible = true;
  } else {
    config = options || {};
  }

  activeMonthKey = monthKey;
  var $buttons = $timelineMonths.find('.timeline-month');
  $buttons.removeClass('is-active');
  var $activeButton = $buttons.filter(function() {
    return String($(this).attr('data-month') || '') === monthKey;
  });
  $activeButton.addClass('is-active');

  if (config.ensureVisible !== false) {
    ensureTimelineButtonVisible($activeButton, !!config.smoothTimelineScroll);
  }

  updateTimelineScrollCues();
}

function getTimelineReferenceY() {
  var rawOffset = getComputedStyle(document.documentElement).getPropertyValue('--timeline-top-offset');
  var parsedOffset = parseFloat(rawOffset);
  if (!isFiniteNumber(parsedOffset)) {
    parsedOffset = 92;
  }
  return Math.max(36, parsedOffset + 6);
}

function getViewportCenterReferenceY() {
  var topBound = getTimelineReferenceY();
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (!isFiniteNumber(viewportHeight) || viewportHeight <= topBound) {
    return topBound;
  }
  return topBound + ((viewportHeight - topBound) / 2);
}

function isNearPageTop() {
  return (window.pageYOffset || document.documentElement.scrollTop || 0) <= 24;
}

function isNearPageBottom() {
  var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  var docEl = document.documentElement;
  var body = document.body;
  var docHeight = Math.max(
    docEl ? docEl.scrollHeight : 0,
    body ? body.scrollHeight : 0
  );
  return scrollY + viewportHeight >= docHeight - 24;
}

function getMonthKeyInViewport() {
  if (!isDateSortActive()) {
    return '';
  }
  if (timelineMonthSequence.length) {
    if (isNearPageTop()) {
      return timelineMonthSequence[0];
    }
    if (isNearPageBottom()) {
      return timelineMonthSequence[timelineMonthSequence.length - 1];
    }
  }

  var referenceY = getViewportCenterReferenceY();
  var closestMonth = '';
  var closestDistance = Infinity;

  getVisibleItems().each(function() {
    var monthKey = getItemMonthKey(this);
    if (!monthKey) {
      return;
    }

    var rect = this.getBoundingClientRect();
    var distance = 0;
    if (rect.top <= referenceY && rect.bottom >= referenceY) {
      distance = 0;
    } else if (rect.bottom < referenceY) {
      distance = referenceY - rect.bottom;
    } else {
      distance = rect.top - referenceY;
    }

    if (distance < closestDistance) {
      closestDistance = distance;
      closestMonth = monthKey;
    }
  });

  return closestMonth;
}

function syncActiveMonthWithViewport(force) {
  if (!$timelineMonths.length || !isDateSortActive() || $timelineMonths.hasClass('is-empty')) {
    return;
  }

  var visibleMonth = getMonthKeyInViewport();
  if (!visibleMonth) {
    return;
  }
  if (!force && visibleMonth === activeMonthKey && isTimelineButtonCentered(visibleMonth)) {
    return;
  }

  var shouldSmoothTimelineScroll = !force && !isMobileLayout();
  setTimelineActiveMonth(visibleMonth, {
    smoothTimelineScroll: shouldSmoothTimelineScroll,
    ensureVisible: true
  });
}

function clearMonthPreview() {
  $gridElement.removeClass('month-hover-active');
  $grid.find('.item.is-month-hover-target').removeClass('is-month-hover-target');
}

function previewMonth(monthKey) {
  clearMonthPreview();
  if (!monthKey) {
    return;
  }

  var $targets = getVisibleItems().filter(function() {
    return getItemMonthKey(this) === monthKey;
  });

  if (!$targets.length) {
    return;
  }

  $gridElement.addClass('month-hover-active');
  $targets.addClass('is-month-hover-target');
}

function applyFilters(reshuffleRandom) {
  clearMonthPreview();
  var queryText = currentQuery.charAt(0) === '#' ? currentQuery.slice(1) : currentQuery;
  var queryRegex = queryText ? new RegExp(escapeRegex(queryText), 'i') : null;
  var filterFn = function() {
    var $item = $(this);
    var matchesTag = currentFilter === '*' ? true : $item.is(currentFilter);
    if (!matchesTag) {
      return false;
    }
    if (!queryRegex) {
      return true;
    }
    var searchText = String($item.attr('data-search') || '');
    return queryRegex.test(searchText);
  };

  var options = { filter: filterFn };
  if (isDateSortActive()) {
    options.sortBy = 'sortdate';
    options.sortAscending = { sortdate: currentSort === 'date-asc' };
  } else {
    if (reshuffleRandom) {
      reseedRandomRanks();
    }
    options.sortBy = 'randomrank';
    options.sortAscending = { randomrank: true };
  }

  $grid.isotope(options);
}

function getAllTags() {
  var tagCounts = {};
  $grid.find('.item').each(function() {
    var tags = String($(this).attr('data-tags') || '').split(/\s+/);
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i].trim().toLowerCase();
      if (!tag) {
        continue;
      }
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  });
  return tagCounts;
}

function renderButtonGroup($container, tags, tagCounts, labelMap, options) {
  var config = options || {};
  $container.empty();
  if (config.includeAll) {
    var $allButton = $('<button>', {
      'class': 'button' + (currentFilter === '*' ? ' is-checked' : ''),
      'data-filter': '*',
      text: '#all',
      title: '#all'
    });
    $container.append($allButton);
  }

  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    if (!tagCounts[tag]) {
      continue;
    }
    var label = labelMap && labelMap[tag] ? labelMap[tag] : ('#' + tag);
    var $btn = $('<button>', {
      'class': 'button',
      'data-filter': '.' + tag,
      text: label,
      title: '#' + tag
    });
    $container.append($btn);
  }
}

function buildPresetButtons(tagCounts) {
  renderButtonGroup($countryTags, COUNTRY_TAGS, tagCounts, COUNTRY_CODES, { includeAll: true });
  renderButtonGroup($categoryTags, CATEGORY_TAGS, tagCounts);
}

function buildSearchSuggestions(tagCounts) {
  var tags = Object.keys(tagCounts).sort();
  $suggestions.empty();
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    var option = document.createElement('option');
    option.value = '#' + tag;
    $suggestions.append(option);
  }
}

function tryApplyHashtagFromQuery() {
  if (!currentQuery || currentQuery.charAt(0) !== '#') {
    return;
  }
  var rawTag = currentQuery.slice(1).trim();
  if (!rawTag) {
    return;
  }
  var desiredFilter = '.' + rawTag.toLowerCase();
  var $matchingButton = $('#filters').find('button[data-filter="' + desiredFilter + '"]');
  if ($matchingButton.length) {
    currentFilter = desiredFilter;
    $('#filters').find('.is-checked').removeClass('is-checked');
    $matchingButton.addClass('is-checked');
  } else {
    currentFilter = '*';
    $('#filters').find('.is-checked').removeClass('is-checked');
    $('#filters').find('button[data-filter="*"]').addClass('is-checked');
  }
}

function debounce(fn, delay) {
  var timeoutId;
  return function() {
    var args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function() {
      fn.apply(null, args);
    }, delay);
  };
}

var debouncedTimelineOffsetUpdate = debounce(function() {
  updateFilterPanelCompactState(true);
  applyResponsiveGridSize(false);
  $grid.isotope('layout');
  updateTimelineEdgePeek();
  if (isDateSortActive()) {
    updateTimeline();
  } else {
    updateTimelineScrollCues();
  }
  syncActiveMonthWithViewport(true);
  updateTimelineScrollCues();
}, 120);
$(window).on('resize', debouncedTimelineOffsetUpdate);
$(window).on('load', function() {
  applyResponsiveGridSize(true);
  updateFilterPanelCompactState(true);
  updateTimelineEdgePeek();
  syncActiveMonthWithViewport(true);
  updateTimelineScrollCues();
});
if ($filterPanel.length) {
  $filterPanel.on('mouseenter', function() {
    if (!canUseHoverState()) {
      return;
    }
    filterPanelHovered = true;
    updateFilterPanelCompactState(true);
  });
  $filterPanel.on('mouseleave', function() {
    if (!canUseHoverState()) {
      return;
    }
    filterPanelHovered = false;
    updateFilterPanelCompactState(true);
  });
  $filterPanel.on('touchstart pointerdown', function() {
    // Touch interactions should never keep the panel pinned open.
    if (canUseHoverState()) {
      return;
    }
    filterPanelHovered = false;
  });
}
var filterPanelScrollScheduled = false;
$(window).on('scroll', function() {
  if (filterPanelScrollScheduled) {
    return;
  }

  filterPanelScrollScheduled = true;
  var runUpdate = function() {
    filterPanelScrollScheduled = false;
    updateFilterPanelCompactState(false);
    syncActiveMonthWithViewport(false);
  };

  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(runUpdate);
  } else {
    setTimeout(runUpdate, 16);
  }
});

$grid.on('arrangeComplete', function() {
  syncLightGallery();
  updateMeta();
  updateTimeline();
  syncActiveMonthWithViewport(true);
  updateTimelineScrollCues();
});

$('#filters').on('click', 'button', function() {
  var nextFilter = $(this).attr('data-filter');
  currentFilter = nextFilter;
  $('#filters').find('.is-checked').removeClass('is-checked');
  $(this).addClass('is-checked');
  if (nextFilter === '*') {
    applyFilters(false);
    return;
  }
  applyFilters(false);
});

$sortSelect.on('change', function() {
  var nextSort = String($(this).val() || '').toLowerCase();
  if (nextSort !== 'date-asc' && nextSort !== 'date-desc') {
    nextSort = 'random';
  }
  currentSort = nextSort;
  activeMonthKey = '';
  updateSortUI();
  applyFilters(nextSort === 'random');
});

var debouncedApplyFilters = debounce(applyFilters, 120);

$('#gallery-search').on('input', function() {
  currentQuery = $(this).val().trim().toLowerCase();
  tryApplyHashtagFromQuery();
  debouncedApplyFilters(false);
});

$searchInput.on('keydown', function(event) {
  if (event.key === 'Escape') {
    $(this).val('');
    currentQuery = '';
    currentFilter = '*';
    resetSortToRandom();
    updateSortUI();
    $('#filters').find('.is-checked').removeClass('is-checked');
    $('#filters').find('button[data-filter="*"]').addClass('is-checked');
    applyFilters(true);
  }
});

$scrollTopFab.on('click', function() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
});

$timelineMonths.on('click', '.timeline-month', function() {
  var monthKey = String($(this).attr('data-month') || '');
  if (!monthKey || !monthTargets[monthKey]) {
    return;
  }
  setTimelineActiveMonth(monthKey, {
    smoothTimelineScroll: false,
    ensureVisible: false
  });
  clearMonthPreview();
  scrollToMonth(monthKey);
});

$timelineMonths.on('mouseenter focusin', '.timeline-month', function() {
  if (!canUseHoverState()) {
    return;
  }
  var monthKey = String($(this).attr('data-month') || '');
  previewMonth(monthKey);
});

$timelineMonths.on('mouseleave focusout', '.timeline-month', function() {
  if (!canUseHoverState()) {
    return;
  }
  clearMonthPreview();
});

$timelineMonths.on('mouseleave', function() {
  if (!canUseHoverState()) {
    return;
  }
  clearMonthPreview();
});

var debouncedTimelineCueUpdate = debounce(updateTimelineScrollCues, 40);
$timelineMonths.on('scroll', debouncedTimelineCueUpdate);

var tagCounts = getAllTags();
buildPresetButtons(tagCounts);
buildSearchSuggestions(tagCounts);
setupWheelZoom();
setupExifPanel();
updateSortUI();
updateFilterPanelCompactState(true);
applyFilters(true);
