---
title: BHTOM
order: 1
featured: true
eyebrow: Distributed observing infrastructure
summary: A web platform coordinating time-domain observations and automated photometric processing across a global telescope network.
problem: Time-domain astronomy needs observations from many independent instruments to be coordinated, processed and made useful on short timescales.
responsibility: I worked across the software and infrastructure boundary, including containerisation and pipeline integration, as part of international collaboration within BHTOM.
system_flow:
  - Telescope network
  - Portal and data intake
  - Workflow orchestration
  - CCD reduction and calibration
  - Standardised photometry
contributions:
  - Containerised services and processing components for reproducible operation.
  - Integrated processing stages into a coordinated data pipeline.
  - Worked on automated CCD image reduction within the wider BHTOM system.
  - Collaborated internationally within BHTOM on system and pipeline integration.
technologies:
  - Python
  - Docker
  - Linux
  - Workflow orchestration
  - Web applications
  - CCD processing
proofs:
  - bhtom-network
  - bhtom-pipeline
tradeoffs:
  - Reproducibility and operability mattered more than exposing internal implementation detail.
  - Independent instruments produce heterogeneous inputs, so the public case study focuses on boundaries and data flow rather than private deployment specifics.
links:
  - label: Open public BHTOM
    url: https://bh-tom2.astrouw.edu.pl/about/
    external: true
skills:
  - Software
  - Infrastructure
  - Delivery
diagram: /assets/images/portfolio/bhtom-flow.svg
diagram_alt: Conceptual BHTOM flow from a telescope network through orchestration and CCD reduction to standardised photometry.
og_image: /assets/images/portfolio/og-bhtom.jpg
hero_key: bhtom
hero_photo: 2024-09-28_15-01-36
hero_caption: Skinakas Observatory
hero_position: center 52%
confidentiality_note: This case study intentionally omits private source code, hostnames, credentials and confidential deployment details.
---
