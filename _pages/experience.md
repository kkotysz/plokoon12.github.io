---
layout: portfolio
permalink: /experience/
title: Experience
description: Professional experience of Krzysztof Kotysz across distributed observatories, scientific software and telescope instrumentation.
hero_key: experience
hero_photo: 2024-08-26_04-47-05
hero_caption: Star trails above the ELT
hero_position: center 54%
---
{% assign published_experience = site.data.experience | where: "published", true %}
{% assign primary_cv = site.data.cv | where: "status", "available" | first %}

<header class="page-intro page-hero">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">Experience</p>
    <h1>Software shaped<br>by real instruments.</h1>
    <p class="page-intro__lead">More than eight years working across software, infrastructure, scientific data and observatory operations.</p>
  </div>
</header>

<section class="experience-list shell section-rule" aria-label="Professional experience">
  {% for item in published_experience %}
    <article class="experience-item reveal">
      <p class="experience-item__period">{% if item.display_period %}{{ item.display_period }}{% else %}{{ item.display_start }}<span aria-hidden="true"> - </span>{{ item.display_end }}{% endif %}</p>
      <div class="experience-item__identity">
        <h2>{{ item.role }}</h2>
        <p>{{ item.organization }}</p>
        <p>{{ item.location }}</p>
        {% if item.engagement_note %}<p class="experience-item__engagement">{{ item.engagement_note }}</p>{% endif %}
        <nav class="experience-item__projects" aria-label="Related projects for {{ item.role }}">
          {% for project_slug in item.projects %}
            {% assign linked_project = site.projects | where: "slug", project_slug | first %}
            <a href="{{ linked_project.url | relative_url }}">{{ linked_project.title }} <span aria-hidden="true">↗</span></a>
          {% endfor %}
        </nav>
      </div>
      <div class="experience-item__detail">
        <p class="experience-item__summary">{{ item.summary }}</p>
        <ul>
          {% for highlight in item.highlights %}<li>{{ highlight }}</li>{% endfor %}
        </ul>
      </div>
    </article>
  {% endfor %}
</section>

<section class="content-gate shell section-rule reveal" aria-labelledby="experience-cv-title">
  <p class="content-gate__status">Full record</p>
  <div>
    <h2 id="experience-cv-title">The concise version<br>is ready to download.</h2>
    <p>The two-page CV brings the roles, selected projects, teaching, education and open-source work into one document.</p>
    <a class="button button--primary" href="{{ primary_cv.file | relative_url }}" download>Download CV · PDF</a>
  </div>
</section>
