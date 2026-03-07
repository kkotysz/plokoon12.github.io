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
    sortid: '.sortid parseInt',
  },
  sortBy: 'sortid',
  sortAscending: {
    sortid: true
  }
});

$grid.imagesLoaded().progress( function() {
  $grid.isotope('layout');
});

var currentFilter = '*';
var currentQuery = '';
var $meta = $('#filter-meta');
var $searchInput = $('#gallery-search');
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
  switzerland: 'SUI',
  uae: 'UAE',
  usa: 'USA'
};

var CATEGORY_TAGS = [
  'astrophoto', 'nature', 'architecture', 'bw', 'landscape', 'portrait', 'square', 'panorama'
];
var lastGalleryKey = '';

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function updateMeta() {
  var allItems = $grid.find('.item').filter(function() {
    return $(this).css('display') !== 'none';
  });
  var selectedTag = currentFilter === '*' ? '#all' : currentFilter.replace('.', '#');
  var queryInfo = currentQuery ? ' | query: "' + currentQuery + '"' : '';
  $meta.text('Tag: ' + selectedTag + queryInfo + ' | photos: ' + allItems.length);
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
    options.sortBy = 'sortid';
    options.sortAscending = { sortid: true };
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

var tagCounts = getAllTags();
buildPresetButtons(tagCounts);
buildSearchSuggestions(tagCounts);
applyFilters(true);
