---
layout: portfolio
permalink: /contact/
title: Contact
description: Contact Krzysztof Kotysz in Wrocław, Poland.
hero_key: contact
hero_photo: 2019-03-28_23-14-05
hero_caption: Wrocław skyline at night
hero_position: center 46%
---
{% assign primary_cv = site.data.cv | where: "status", "available" | first %}
<header class="page-intro page-hero">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">Contact</p><h1>Direct contact.<br>No form in the way.</h1>
    <p class="page-intro__lead">Based in Wrocław, Poland. The best first step is an email.</p>
  </div>
</header>

<section class="contact-panel shell section-rule reveal">
  <a class="contact-panel__email" href="mailto:k.kotysz@gmail.com">k.kotysz@gmail.com</a>
  <dl>
    <div><dt>Location</dt><dd>Wrocław, Poland</dd></div>
    <div><dt>GitHub</dt><dd><a href="https://github.com/kkotysz" target="_blank" rel="noopener noreferrer">github.com/kkotysz</a></dd></div>
    <div><dt>ORCID</dt><dd><a href="https://orcid.org/0000-0003-4960-7463" target="_blank" rel="noopener noreferrer">0000-0003-4960-7463</a></dd></div>
    <div><dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/in/krzysztof-kotysz-574031163/" target="_blank" rel="noopener noreferrer">Krzysztof Kotysz</a></dd></div>
    <div><dt>CV</dt><dd><a href="{{ primary_cv.file | relative_url }}" download>Download PDF</a></dd></div>
  </dl>
</section>
