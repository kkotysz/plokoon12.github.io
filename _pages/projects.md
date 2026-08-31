---
layout: portfolio
permalink: /projects/
title: Projects
description: Case studies in distributed telescope infrastructure, environmental measurement systems, scientific data processing and telescope automation.
hero_key: projects
hero_photo: 2019-04-27_21-45-15
hero_caption: VLT instrument platform
hero_position: center 52%
---
<header class="page-intro page-hero">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">Projects</p><h1>Software that reaches<br>beyond the screen.</h1>
    <p class="page-intro__lead">Four case studies connecting web systems, pipelines, scientific data and physical instruments.</p>
  </div>
</header>

<section class="project-index shell section-rule" aria-label="Primary case studies">
  {% assign ordered_projects = site.projects | sort: "order" %}
  {% for project in ordered_projects %}
    <article class="project-index__row reveal">
      <p class="project-index__number">0{{ forloop.index }}</p>
      <div><p class="eyebrow">{{ project.eyebrow }}</p><h2><a href="{{ project.url | relative_url }}">{{ project.title }}</a></h2><p>{{ project.summary }}</p></div>
      <ul class="inline-list" aria-label="{{ project.title }} competencies">{% for skill in project.skills %}<li>{{ skill }}</li>{% endfor %}</ul>
      <a class="project-index__arrow" href="{{ project.url | relative_url }}" aria-label="Read {{ project.title }} case study">↗</a>
    </article>
  {% endfor %}
</section>

<section class="secondary-project shell section-rule reveal">
  <div><p class="section-index">Additional software</p><h2>AstroPlanner</h2></div>
  <div><p>A Python and PySide6 desktop application for planning astronomical observations, combining visibility calculations, external data services, weather analysis and telescope workflows.</p><div class="link-group"><a class="text-link" href="https://github.com/kkotysz/astroplanner" target="_blank" rel="noopener noreferrer">Explore on GitHub <span aria-hidden="true">↗</span></a></div></div>
</section>
