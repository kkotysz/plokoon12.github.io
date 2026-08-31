#!/usr/bin/env ruby
# frozen_string_literal: true

require "nokogiri"
require "json"
require "pathname"
require "uri"

root = Pathname.new(ARGV.fetch(0, "_site")).expand_path
abort("[site-check] Missing build directory: #{root}") unless root.directory?

errors = []
html_files = root.glob("**/*.html")

def local_reference?(value)
  return false if value.nil? || value.empty?
  return false if value.start_with?("//", "#")

  scheme = value[/\A([a-z][a-z0-9+.-]*):/i, 1]
  scheme.nil?
end

def candidates_for(root, html_file, raw_value)
  path_value = raw_value.split("#", 2).first.split("?", 2).first
  return [] if path_value.nil? || path_value.empty?

  decoded = URI::DEFAULT_PARSER.unescape(path_value)
  base = decoded.start_with?("/") ? root : html_file.dirname
  relative = decoded.sub(%r{\A/}, "")
  resolved = base.join(relative).cleanpath

  candidates = [resolved]
  candidates << resolved.join("index.html") if decoded.end_with?("/") || resolved.directory?
  if File.extname(decoded).empty? && !decoded.end_with?("/")
    candidates << Pathname.new("#{resolved}.html")
    candidates << resolved.join("index.html")
  end
  candidates.uniq
rescue URI::InvalidURIError
  []
end

html_files.each do |html_file|
  relative_html = html_file.relative_path_from(root)
  document = Nokogiri::HTML5(html_file.read, max_errors: 100)
  document.errors.each do |error|
    errors << "#{relative_html}: invalid HTML (#{error.message.strip})"
  end
  portfolio_page = document.at_css('link[href*="/assets/css/portfolio.css"]')

  if portfolio_page
    errors << "#{relative_html}: missing html[lang]" unless document.at_css("html[lang]")
    errors << "#{relative_html}: missing viewport meta" unless document.at_css('meta[name="viewport"]')
    errors << "#{relative_html}: expected exactly one main element" unless document.css("main").length == 1
    errors << "#{relative_html}: expected exactly one h1" unless document.css("h1").length == 1
    errors << "#{relative_html}: expected exactly one canonical link" unless document.css('link[rel="canonical"]').length == 1
    errors << "#{relative_html}: missing meta description" unless document.at_css('meta[name="description"][content]')
    errors << "#{relative_html}: missing Open Graph image" unless document.at_css('meta[property="og:image"][content]')
    errors << "#{relative_html}: missing skip link" unless document.at_css('a.skip-link[href="#main-content"]')

    document.css("img").each do |image|
      errors << "#{relative_html}: image missing alt attribute (#{image['src']})" unless image.key?("alt")
    end

    document.css("a, button").each do |control|
      next if control["aria-hidden"] == "true"

      text = control.text.strip
      image_text = control.css("img[alt]").map { |image| image["alt"].to_s.strip }.join
      label = control["aria-label"].to_s.strip
      errors << "#{relative_html}: #{control.name} has no accessible name" if text.empty? && image_text.empty? && label.empty?
    end

    document.css('a[target="_blank"]').each do |link|
      rel = link["rel"].to_s.split
      errors << "#{relative_html}: external link missing noopener" unless rel.include?("noopener")
    end

    previous_heading_level = nil
    document.css("h1, h2, h3, h4, h5, h6").each do |heading|
      level = heading.name.delete_prefix("h").to_i
      if previous_heading_level && level > previous_heading_level + 1
        errors << "#{relative_html}: heading level jumps from h#{previous_heading_level} to h#{level}"
      end
      previous_heading_level = level
    end

    document.css('script[type="application/ld+json"]').each do |script|
      JSON.parse(script.text)
    rescue JSON::ParserError => error
      errors << "#{relative_html}: invalid JSON-LD (#{error.message})"
    end
  end

  ids = document.css("[id]").map { |node| node["id"] }.reject(&:empty?)
  ids.tally.each do |id, count|
    errors << "#{relative_html}: duplicate id ##{id}" if count > 1
  end

  document.css("[href], [src]").each do |node|
    attribute = node.key?("href") ? "href" : "src"
    value = node[attribute]&.strip
    next unless local_reference?(value)

    candidates = candidates_for(root, html_file, value)
    next if candidates.empty? || candidates.any?(&:exist?)

    errors << "#{relative_html}: missing internal target #{value.inspect}"
  end
end

if errors.any?
  warn "[site-check] #{errors.length} error(s):"
  errors.first(200).each { |error| warn "  - #{error}" }
  warn "  - ... #{errors.length - 200} additional error(s)" if errors.length > 200
  exit 1
end

puts "[site-check] OK: #{html_files.length} HTML files, internal targets and portfolio structure verified"
