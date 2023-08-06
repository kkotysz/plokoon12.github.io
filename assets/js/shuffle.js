// external js: isotope.pkgd.js

plugin = lightGallery(document.getElementById('lightgallery'), {
  plugins: [lgZoom],
  speed: 300,
  // mode: 'lg-fade',
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
  }
});

$grid.imagesLoaded().progress( function() {
  $grid.isotope('layout');
});

// filter functions
var filterFns = {
  // show if number is greater than 50
  numberGreaterThan50: function() {
    var number = $(this).find('.number').text();
    return parseInt( number, 10 ) > 50;
  },
  // show if name ends with -ium
  ium: function() {
    var name = $(this).find('.name').text();
    return name.match( /ium$/ );
  }
};

// bind filter button click
$('#filters').on( 'click', 'button', function() {
  var btn = $( this ).text();
  var filterValue = $( this ).attr('data-filter');
  // use filterFn if matches value
  filterValue = filterFns[ filterValue ] || filterValue;
  $grid.isotope({ filter: filterValue });
  
  if (btn == '#all') {
    $grid.isotope('shuffle');
  } else {
    var sortByValue = $(this).attr('data-sort-by');
    $grid.isotope({ sortBy: sortByValue });
  }

  plugin.destroy();
  plugin = lightGallery(document.getElementById('lightgallery'), {
    plugins: [lgZoom],
    speed: 300,
    selector: filterValue.replace('*','')
  }); 
});

// bind sort button click
$('#sorts').on( 'click', 'button', function() {
  var sortByValue = $(this).attr('data-sort-by');
  $grid.isotope({ sortBy: sortByValue });
});

// change is-checked class on buttons
$('.button-group').each( function( i, buttonGroup ) {
  var $buttonGroup = $( buttonGroup );
  $buttonGroup.on( 'click', 'button', function() {
    $buttonGroup.find('.is-checked').removeClass('is-checked');
    $( this ).addClass('is-checked');
  });

});
  
$grid.isotope('shuffle')
