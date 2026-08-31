---
layout: portfolio
permalink: /personal/
title: Personal
description: Photography, writing and teaching by Krzysztof Kotysz.
og_image: /assets/images/portfolio/atacama-1920.jpg
hero_key: personal
hero_photo: 2019-04-14_04-42-58
hero_caption: Shooting for the stars
hero_position: center 48%
---
<header class="page-intro page-hero">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">Personal</p><h1>The work is technical.<br>The perspective is personal.</h1>
    <p class="page-intro__lead">Photography, notes and teaching remain visible because they are part of how I observe, explain and share.</p>
  </div>
</header>

<section class="personal-feature section-rule reveal">
  <a class="personal-feature__media" href="{{ '/gallery/?theme=classic' | relative_url }}">
    <picture>
      <source srcset="{{ '/assets/images/portfolio/atacama-960.avif' | relative_url }} 960w, {{ '/assets/images/portfolio/atacama-1920.avif' | relative_url }} 1920w" sizes="100vw" type="image/avif">
      <source srcset="{{ '/assets/images/portfolio/atacama-960.webp' | relative_url }} 960w, {{ '/assets/images/portfolio/atacama-1920.webp' | relative_url }} 1920w" sizes="100vw" type="image/webp">
      <img src="{{ '/assets/images/portfolio/atacama-1920.jpg' | relative_url }}" alt="Sunset over the Atacama Desert" width="1920" height="1282">
    </picture>
  </a>
  <div class="personal-feature__copy shell"><p class="section-index">Photography</p><h2>Night skies, observatories and the landscapes around them.</h2><p>The gallery contains 486 photographs with searchable tags, locations, themes and dedicated photo pages.</p><a class="button button--primary" href="{{ '/gallery/?theme=classic' | relative_url }}">Open photography</a></div>
</section>

<section class="personal-links shell section-rule">
  <article class="reveal"><p class="section-index">Writing</p><h2>Blog</h2><p>A small archive of astronomy, technology and photographic notes.</p><a class="text-link" href="{{ '/posts/' | relative_url }}">Read posts <span aria-hidden="true">→</span></a></article>
  <article class="reveal"><p class="section-index">Teaching</p><h2>Course materials</h2><p>Notebooks, references and materials prepared for university teaching.</p><a class="text-link" href="{{ '/teaching/' | relative_url }}">Open teaching <span aria-hidden="true">→</span></a></article>
</section>
