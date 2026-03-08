// external js: isotope.pkgd.js

var plugin = lightGallery(document.getElementById('lightgallery'), {
  plugins: [lgZoom],
  speed: 300,
  selector: '.item:not(.isotope-hidden):not([style*="display: none"])'
});

// init Isotope
var $grid = $('.grid').isotope({
  itemSelector: '.item',
  // layoutMode: '',
  // isfitWidth: true,
  masonry: {
    columnWidth: 195,
    isFitWidth: true,
    gutter: 3,
    // horizontalOrder: true,
    },
  getSortData: {
    sortdate: '[data-sort]',
  },
  sortBy: 'sortdate',
  sortAscending: {
    sortdate: true
  }
});

$grid.imagesLoaded().progress( function() {
  $grid.isotope('layout');
});

var currentFilter = '*';
var currentQuery = '';
var $meta = $('#filter-meta');
var $searchInput = $('#gallery-search');
var $clearButton = $('#clear-filters');
var $suggestions = $('#gallery-search-suggestions');
var $countryTags = $('#country-tags');
var $categoryTags = $('#category-tags');

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

function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
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

function setupExifPanel() {
  var root = document.getElementById('lightgallery');
  if (!root) {
    return;
  }

  root.addEventListener('lgAfterOpen', function(event) {
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgAfterSlide', function(event) {
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgAfterAppendSubHtml', function(event) {
    queueExifUpdate(getLightGalleryIndex(event));
  });
  root.addEventListener('lgBeforeClose', function() {
    exifRequestToken += 1;
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateMeta() {
  var allItems = $grid.find('.item').filter(function() {
    return $(this).css('display') !== 'none';
  });
  var selectedTag = currentFilter === '*' ? '#all' : currentFilter.replace('.', '#');
  var queryInfo = currentQuery ? ' | query "' + currentQuery + '"' : '';
  $meta.text('Active: ' + selectedTag + queryInfo + ' | photos: ' + allItems.length);
}

function getVisibleGalleryKey() {
  return $grid.find('.item').filter(function() {
    return $(this).css('display') !== 'none';
  }).map(function() {
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

function applyFilters(reshuffleAll) {
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

  var options = {
    filter: filterFn
  };

  if (currentFilter !== '*') {
    options.sortBy = 'sortdate';
    options.sortAscending = { sortdate: true };
  }

  $grid.isotope(options);

  if (currentFilter === '*' && reshuffleAll) {
    $grid.isotope('shuffle');
  }
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

function renderButtonGroup($container, tags, tagCounts, labelMap) {
  $container.empty();
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
  renderButtonGroup($countryTags, COUNTRY_TAGS, tagCounts, COUNTRY_CODES);
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

$grid.on('arrangeComplete', function() {
  syncLightGallery();
  updateMeta();
});

$('#filters').on('click', 'button', function() {
  currentFilter = $(this).attr('data-filter');
  $('#filters').find('.is-checked').removeClass('is-checked');
  $(this).addClass('is-checked');
  applyFilters(currentFilter === '*');
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
    $('#filters').find('.is-checked').removeClass('is-checked');
    $('#filters').find('button[data-filter="*"]').addClass('is-checked');
    applyFilters(true);
  }
});

$clearButton.on('click', function() {
  $searchInput.val('');
  currentQuery = '';
  currentFilter = '*';
  $('#filters').find('.is-checked').removeClass('is-checked');
  $('#filters').find('button[data-filter="*"]').addClass('is-checked');
  applyFilters(true);
});

var tagCounts = getAllTags();
buildPresetButtons(tagCounts);
buildSearchSuggestions(tagCounts);
setupExifPanel();
applyFilters(true);
