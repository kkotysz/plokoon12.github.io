#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "pathname"

source = Pathname.new(ARGV.fetch(0)).expand_path
destination = Pathname.new(ARGV.fetch(1)).expand_path
abort("[slowo] Missing source build: #{source}") unless source.directory?
abort("[slowo] Missing source index: #{source.join('index.html')}") unless source.join("index.html").file?

destination.mkpath
FileUtils.cp_r(source.children, destination)

index = destination.join("index.html")
html = index.read
stylesheet = '<link rel="stylesheet" href="/assets/css/slowo-accessibility.css">'

unless html.include?(stylesheet)
  abort("[slowo] Missing </head> in #{index}") unless html.sub!("</head>", "  #{stylesheet}\n</head>")
  index.write(html)
end

puts "[slowo] Prepared #{destination} with the portfolio accessibility layer"
