---
title: Scientific Data Processing
short_title: Space telescope data and spectroscopy
order: 3
featured: true
eyebrow: Time-series and observational data
summary: A connected body of work spanning space-telescope photometry, time-series analysis, Fourier methods and spectroscopic preparation.
problem: Large observational datasets only become useful after consistent extraction, quality control, candidate selection and domain-specific analysis.
responsibility: I processed and analysed space-telescope data, including light curves from NASA's TESS mission, reduced the candidate set and prepared observational material for scientific interpretation.
system_flow:
  - Space telescope data and spectra
  - Extraction and quality control
  - Time-series and Fourier analysis
  - Candidate selection
  - Scientific interpretation
contributions:
  - Processed and analysed the full stellar light-curve dataset.
  - Reduced the dataset to a scientifically focused candidate set.
  - Applied Fourier analysis to identify and characterise variability.
  - Prepared spectroscopic material for analysis.
  - Built and maintain lcView, a Python workbench integrating native C and Fortran engines for light-curve analysis.
stack_preview:
  - python
  - numpy
  - qt-pyside
  - fortran
stack_groups:
  - label: Application
    items:
      - technology: python
        role: Analysis workflows and application architecture
      - technology: qt-pyside
        role: Interactive lcView desktop workbench
      - technology: pyqtgraph
        role: Responsive scientific plotting
  - label: Scientific computing
    items:
      - technology: numpy
        role: Numerical arrays and transformations
      - technology: scipy
        role: Scientific algorithms and model fitting
      - technology: pandas
        role: Tabular data preparation
      - technology: astropy
        role: Astronomical data structures and calculations
      - technology: matplotlib
        role: Publication and diagnostic visualisation
  - label: Native code and quality
    items:
      - technology: c
        role: Native numerical backend
      - technology: fortran
        role: Integrated legacy analysis engines
      - technology: pytest
        role: Numerical, parsing and UI tests
      - technology: github-actions
        role: Automated cross-platform CI checks
proofs:
  - data-light-curves
  - data-candidates
  - data-spectra
tradeoffs:
  - Automated screening provides scale, while final candidate selection still requires scientific judgement.
  - Combining datasets with different cadence and baselines requires careful separation of comparable and complementary evidence.
links:
  - label: Explore lcView on GitHub
    url: https://github.com/kkotysz/lcView
    external: true
  - label: About the TESS mission
    url: https://science.nasa.gov/mission/tess/
    external: true
  - label: View ORCID record
    url: https://orcid.org/0000-0003-4960-7463
    external: true
skills:
  - Data
  - Software
diagram: /assets/images/portfolio/data-flow.svg
diagram_alt: Scientific data flow from space telescope observations and spectra through quality control and Fourier analysis to selected objects.
og_image: /assets/images/portfolio/og-data.jpg
hero_key: scientific-data
hero_photo: 2019-04-14_08-50-14
hero_caption: Milky Way over the Atacama Desert
hero_position: center 48%
confidentiality_note:
---
