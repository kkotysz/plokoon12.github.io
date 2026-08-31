---
layout: portfolio
permalink: /cv/
title: CV
description: Download the English Software and Infrastructure CV of Krzysztof Kotysz.
hero_key: cv
hero_photo: 2024-08-23_01-50-58
hero_caption: Zodiacal light above JK15
hero_position: center 58%
---
{% assign cv = site.data.cv | first %}
<header class="page-intro page-hero cv-intro">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">Curriculum vitae</p><h1>Software &<br>Infrastructure CV.</h1>
    <p class="page-intro__lead">A concise, two-page record of software engineering, Linux infrastructure, scientific systems and telescope automation.</p>
    <div class="cv-intro__actions link-group">
      <a class="button button--primary" href="{{ cv.file | relative_url }}" download>Download CV · PDF</a>
      <a class="button button--quiet" href="{{ cv.file | relative_url }}" target="_blank" rel="noopener noreferrer">Open in browser <span aria-hidden="true">↗</span></a>
    </div>
  </div>
</header>

<section class="cv-feature shell section-rule reveal" aria-labelledby="cv-document-title">
  <p class="section-index">01 / Document</p>
  <div class="cv-feature__copy">
    <h2 id="cv-document-title">{{ cv.title }}</h2>
    <p>{{ cv.description }}</p>
    <ul class="editorial-list">{% for highlight in cv.highlights %}<li>{{ highlight }}</li>{% endfor %}</ul>
  </div>
  <dl class="cv-feature__meta">
    <div><dt>Format</dt><dd>{{ cv.format }}</dd></div>
    <div><dt>Length</dt><dd>{{ cv.pages }}</dd></div>
    <div><dt>Language</dt><dd>{{ cv.language }}</dd></div>
    <div><dt>Updated</dt><dd>{{ cv.updated }}</dd></div>
  </dl>
</section>

<section class="page-contact shell section-rule reveal">
  <div><p class="section-index">02 / Evidence</p><h2>Continue with the projects.</h2></div>
  <div><p>The case studies provide the system context and technical decisions behind the two-page summary.</p><a class="text-link" href="{{ '/projects/' | relative_url }}">View projects <span aria-hidden="true">→</span></a></div>
</section>
