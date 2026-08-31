---
layout: portfolio
permalink: /about/
title: About
description: About Krzysztof Kotysz and a practice connecting software engineering, astronomy, infrastructure and photography.
hero_key: about
hero_photo: 2025-10-20_17-30-11
hero_caption: Institute of Astronomy in Wrocław
hero_position: center 48%
---
<header class="page-intro page-hero">
  {% include subpage-hero-media.html %}
  <div class="page-hero__content shell">
    <p class="section-index">About</p><h1>Engineering shaped<br>by observation.</h1>
    <p class="page-intro__lead">I work where software, scientific data and physical instruments meet.</p>
  </div>
</header>

<section class="about-profile shell section-rule reveal">
  <figure><img src="{{ '/assets/images/bio-photo.jpg' | relative_url }}" alt="Portrait of Krzysztof Kotysz on the California coast at sunset" width="900" height="900"></figure>
  <div class="prose-large">
    <p>My background in observational astronomy taught me to treat software as part of a larger system: cameras, sensors, networks, data quality, operational constraints and the people who need to understand the result.</p>
    <p>Doctoral research is one part of that practice. I have also built web applications, integrated data-processing infrastructure, worked with telescope control systems and delivered field diagnostics during observing campaigns.</p>
    <p>I am most useful on problems that cross boundaries—when a pipeline has to be scientifically credible, operationally reliable and clear enough for others to use.</p>
  </div>
</section>

<section class="about-principles shell section-rule reveal">
  <div><p class="section-index">Approach</p><h2>How I work</h2></div>
  <ol class="numbered-principles">
    <li><span>01</span><div><h3>Start with the full system</h3><p>Understand the data source, hardware and operating environment before optimising an isolated component.</p></div></li>
    <li><span>02</span><div><h3>Make failure diagnosable</h3><p>Observability, documentation and explicit boundaries are features, especially in remote systems.</p></div></li>
    <li><span>03</span><div><h3>Keep scientific judgement visible</h3><p>Automation provides scale; decisions and limitations still need to be clear to the people interpreting results.</p></div></li>
  </ol>
</section>

<section class="about-personal shell section-rule reveal">
  <div><p class="section-index">Outside work</p><h2>Photography</h2></div>
  <div><p>Photography remains part of this site because it is part of how I observe places, light and technical environments—not a detached archive.</p><a class="text-link" href="{{ '/personal/' | relative_url }}">Photography, blog and teaching <span aria-hidden="true">→</span></a></div>
</section>
