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
  - Integrated the complete processing pipeline with Prefect during engineering collaboration within BHTOM.
  - Worked on automated CCD image reduction within the wider BHTOM system.
  - Collaborated internationally within BHTOM on system and pipeline integration.
stack_preview:
  - django
  - docker
  - prefect
  - postgresql
stack_groups:
  - label: Application and API
    items:
      - technology: python
        role: Service and processing code
      - technology: django
        role: Portal backend and application framework
      - technology: django-rest-framework
        role: Programmatic access and service interfaces
      - technology: tom-toolkit
        role: Astronomical target and observation management foundation
  - label: Data and workflows
    items:
      - technology: postgresql
        role: Relational application data
      - technology: mongodb
        role: Supporting platform data services
      - technology: prefect
        role: Processing workflow orchestration
      - technology: apache-kafka
        role: Distributed event and data transport
  - label: Deployment and observability
    items:
      - technology: docker
        role: Reproducible service and pipeline deployment
      - technology: linux
        role: Operating environment for distributed services
      - technology: nginx
        role: Reverse proxy and static delivery
      - technology: gunicorn
        role: Python application serving
      - technology: prometheus
        role: Operational metrics
      - technology: graylog
        role: Centralised log management
      - technology: elasticsearch
        role: Search and log storage
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
  - label: View public BHTOM2 source
    url: https://github.com/BHTOM-Team/bhtom2
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
