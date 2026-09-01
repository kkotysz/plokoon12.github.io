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
      {% include technology-preview.html items=project.stack_preview label=project.title %}
      <a class="project-index__arrow" href="{{ project.url | relative_url }}" aria-label="Read {{ project.title }} case study">↗</a>
    </article>
  {% endfor %}
</section>

{% for project in site.data.additional_projects %}
  <section class="secondary-project shell section-rule reveal">
    <div><p class="section-index">{{ project.eyebrow }}</p><h2>{{ project.title }}</h2>{% include technology-preview.html items=project.stack_preview label=project.title %}</div>
    <div>
      <p>{{ project.summary }}</p>
      {% include technology-stack.html groups=project.stack_groups scope=project.id %}
      <div class="link-group">{% for link in project.links %}<a class="text-link" href="{{ link.url }}"{% if link.external %} target="_blank" rel="noopener noreferrer"{% endif %}>{{ link.label }} <span aria-hidden="true">↗</span></a>{% endfor %}</div>
    </div>
  </section>
{% endfor %}
