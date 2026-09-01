---
title: ALPS
order: 2
featured: true
eyebrow: Environmental measurement network
summary: A live network view combining station availability, all-sky imagery, SQM readings and environmental measurements.
problem: Measurements from distributed observing stations need to be understandable both as live operational status and as evidence of changing night-sky conditions.
responsibility: I independently delivered the current public website. The broader ALPS measurement system, station hardware and scientific programme are a team effort.
system_flow:
  - Station sensors and all-sky camera
  - Data transmission
  - Service layer
  - Time-series measurement storage
  - Public map, status and data views
contributions:
  - Designed and implemented the current public ALPS website.
  - Brought station status, the network map and SQM measurements into one interface.
  - Connected public views to time-series measurements stored in InfluxDB.
  - Presented environmental context alongside images and night-sky brightness data.
  - Contributed within the team developing the wider measurement system.
stack_preview:
  - django
  - influxdb
  - docker
  - leaflet
stack_groups:
  - label: Backend and data
    items:
      - technology: python
        role: Application and data-service logic
      - technology: django
        role: Public web application backend
      - technology: influxdb
        role: Time-series measurement storage
  - label: Frontend and geospatial interface
    items:
      - technology: javascript
        role: Interactive status, measurement and navigation behaviour
      - technology: leaflet
        role: Station map and geospatial presentation
      - technology: bootstrap-mdb
        role: Responsive interface foundations
  - label: Deployment
    items:
      - technology: docker
        role: Reproducible service deployment
      - technology: nginx
        role: Public web delivery and reverse proxy
proofs:
  - alps-live-network
  - alps-sqm
tradeoffs:
  - Operational status and scientific context have different audiences and must remain legible in the same interface.
  - The site distinguishes individual delivery from shared ownership of the wider ALPS system.
links:
  - label: Open ALPS
    url: https://www.alps.uwr.edu.pl
    external: true
skills:
  - Software
  - Systems
  - Delivery
diagram: /assets/images/portfolio/alps-flow.svg
diagram_alt: Conceptual ALPS flow from station sensors and camera through transmission and storage to public map and status views.
og_image: /assets/images/portfolio/og-alps.jpg
hero_key: alps
hero_photo: 2024-03-09_03-46-45
hero_caption: Star trails over Białków Palace
hero_position: center 56%
confidentiality_note:
---
