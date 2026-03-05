"use strict";

(function () {
  var DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
  var DEFAULT_BRANCHES = ["main", "master"];

  function getSafePath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  function getNotebookNumber(displayName) {
    var match = displayName.match(/^(\d+(\.\d+)?)/);
    return match ? match[0] : "?";
  }

  function getNotebookSortValue(path) {
    var displayName = path.replace(/\.ipynb$/, "");
    var match = displayName.match(/^(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : Number.POSITIVE_INFINITY;
  }

  function readCache(cacheKey) {
    try {
      var raw = localStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || typeof parsed.expiresAt !== "number") {
        return null;
      }

      if (Date.now() >= parsed.expiresAt) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return parsed.data || null;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(cacheKey, data, cacheTtlMs) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        expiresAt: Date.now() + cacheTtlMs,
        data: data
      }));
    } catch (_error) {
      // Ignore cache write errors (private mode / quota exceeded).
    }
  }

  async function fetchRepoTreeFromJsdelivr(owner, repo, branches) {
    for (var index = 0; index < branches.length; index += 1) {
      var branch = branches[index];
      var apiUrl = "https://data.jsdelivr.com/v1/package/gh/" + owner + "/" + repo + "@" + branch + "/flat";
      var response = await fetch(apiUrl);

      if (response.ok) {
        var data = await response.json();
        if (!data || !Array.isArray(data.files)) {
          throw new Error("Niepoprawna odpowiedź jsDelivr API (brak listy plików).");
        }

        var tree = data.files
          .map(function (item) {
            if (!item || !item.name) {
              return "";
            }
            return item.name.replace(/^\/+/, "");
          })
          .filter(Boolean)
          .map(function (path) {
            return { path: path };
          });

        return { tree: tree, branch: branch };
      }

      if (response.status === 404) {
        continue;
      }

      var details = await response.text().catch(function () {
        return "";
      });
      throw new Error("jsDelivr API " + response.status + ": " + (details || response.statusText));
    }

    throw new Error("Nie znaleziono gałęzi " + branches.join("/") + " w repozytorium.");
  }

  function buildGithubUrl(owner, repo, branch, path) {
    return "https://github.com/" + owner + "/" + repo + "/blob/" + encodeURIComponent(branch) + "/" + getSafePath(path);
  }

  async function getRepoTreeCached(owner, repo, branches, cacheTtlMs) {
    var cacheKey = "repo-tree:" + owner + "/" + repo + ":" + branches.join(",");
    var treeData = readCache(cacheKey);
    if (treeData) {
      return treeData;
    }

    treeData = await fetchRepoTreeFromJsdelivr(owner, repo, branches);
    writeCache(cacheKey, treeData, cacheTtlMs);
    return treeData;
  }

  function renderNotebookLink(container, notebook, sourceText) {
    var displayName = notebook.path.replace(/\.ipynb$/, "");
    var notebookId = getNotebookNumber(displayName);

    var link = document.createElement("a");
    link.className = "notebook-link";
    link.href = notebook.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML =
      '<span class="notebook-title"><i class="fa-solid fa-file-code"></i> ' + displayName + "</span>" +
      '<span class="notebook-subtitle">Notebook ' + notebookId + "</span>" +
      '<span class="notebook-subtitle notebook-subtitle--mode"><i class="fa-brands fa-github"></i> ' + sourceText + "</span>";

    container.appendChild(link);
  }

  function filterNotebooks(tree, onlyRoot, startsWithNumber) {
    return tree.filter(function (item) {
      if (!item || !item.path || !item.path.endsWith(".ipynb")) {
        return false;
      }

      if (onlyRoot && item.path.indexOf("/") !== -1) {
        return false;
      }

      if (startsWithNumber) {
        var fileName = item.path.split("/").pop() || "";
        return /^[0-9]/.test(fileName);
      }

      return true;
    });
  }

  function sortNotebooks(notebooks) {
    notebooks.sort(function (a, b) {
      var aNum = getNotebookSortValue(a.path);
      var bNum = getNotebookSortValue(b.path);

      if (aNum !== bNum) {
        return aNum - bNum;
      }

      return a.path.localeCompare(b.path, "pl");
    });
  }

  window.initCourseNotebooks = async function initCourseNotebooks(config) {
    if (!config || !config.owner || !config.repo) {
      throw new Error("Brak konfiguracji owner/repo dla listy notebooków.");
    }

    var container = document.getElementById(config.containerId || "notebooks-container");
    var counter = document.getElementById(config.counterId || "notebook-count");
    if (!container || !counter) {
      return;
    }

    var branches = Array.isArray(config.branches) && config.branches.length ? config.branches : DEFAULT_BRANCHES;
    var cacheTtlMs = typeof config.cacheTtlMs === "number" ? config.cacheTtlMs : DEFAULT_CACHE_TTL_MS;
    var onlyRoot = config.onlyRoot !== false;
    var startsWithNumber = config.startsWithNumber !== false;
    var sourceText = config.sourceText || "Otwórz w GitHub";
    try {
      var treeData = await getRepoTreeCached(config.owner, config.repo, branches, cacheTtlMs);

      var notebooks = filterNotebooks(treeData.tree, onlyRoot, startsWithNumber);
      sortNotebooks(notebooks);
      container.innerHTML = "";

      if (notebooks.length === 0) {
        counter.textContent = config.emptyCounterText || "Brak notebooków";
        container.innerHTML = '<div class="state-note">' + (config.emptyMessage || "Nie znaleziono notebooków do wyświetlenia.") + "</div>";
        return;
      }

      counter.textContent = "Liczba notebooków: " + notebooks.length;
      notebooks.forEach(function (notebook) {
        notebook.url = buildGithubUrl(config.owner, config.repo, treeData.branch, notebook.path);
        renderNotebookLink(container, notebook, sourceText);
      });
    } catch (error) {
      console.error("Błąd pobierania listy notebooków:", error);
      counter.textContent = "Błąd ładowania";
      container.innerHTML = '<div class="state-note error">Nie udało się pobrać listy notebooków (' + error.message + '). Spróbuj ponownie za chwilę.</div>';
    }
  };
})();
