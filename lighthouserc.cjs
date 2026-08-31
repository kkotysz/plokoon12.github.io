module.exports = {
  ci: {
    collect: {
      staticDistDir: "./_site",
      url: [
        "http://localhost/",
        "http://localhost/projects/bhtom/",
        "http://localhost/experience/",
        "http://localhost/personal/"
      ],
      numberOfRuns: 3,
      settings: {
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"]
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 0.95 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }]
      }
    },
    upload: {
      target: "filesystem",
      outputDir: "./tmp/lighthouse"
    }
  }
};
