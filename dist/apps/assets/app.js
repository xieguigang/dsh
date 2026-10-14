/* ============================================================
   DeepSeek Harness UI replica — application logic.
   Plain JS, state-driven rendering. Data comes from mock/*.json
   through the interception layer in mock-api.js.
   ============================================================ */
(function () {
  "use strict";

  /* ==================== state ==================== */
  var state = {
    boot: null,
    view: "session", // 'session' | 'plugins'
    sidebarCollapsed: false,
    rightbarOpen: false,
    rightbarWidth: 300,
    search: "",
    expanded: {},
    activeWorkspaceId: null,
    activeSessionId: null,
    sessions: {}, // id -> session json (cache)
    composerText: "",
    rightbar: { tabs: [], active: null },
    fileTree: null,
    fileExpanded: {},
    fileCache: {},
    todosCollapsed: false,
    trajDuration: false,
    trajSearch: "",
    trajToolSel: null,
    trajDetailsTab: "summary",
    accessMode: "workspace-write",
    model: "deepseek-v41-flash",
    effort: "high",
    mode: "standard",
    settingsTab: "general",
    chatTab: "chat",
    settingsOpen: false,
    streaming: null, // MockStream handle
    streamingMsg: null,
    pluginToggles: {},
    collapsedGroups: {},
  };

  /* ==================== dom helpers ==================== */
  function h(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ic(name, size) {
    return window.icon(name, size);
  }
  function nowTime() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }
  function nowDate() {
    var d = new Date();
    return d.getMonth() + 1 + "/" + d.getDate();
  }
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ==================== toast ==================== */
  var toastTimer = null;
  function toast(msg) {
    var layer = $("#toast-layer");
    layer.innerHTML = "";
    var el = h('<div class="toast">' + esc(msg) + "</div>");
    layer.appendChild(el);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 2200);
  }

  /* ==================== menu system ==================== */
  var menuCleanup = null;
  function closeMenu() {
    if (menuCleanup) {
      menuCleanup();
      menuCleanup = null;
    }
  }
  /**
   * config: {
   *   items: [...],           // menu entries
   *   width: 240,             // min width
   *   align: 'right'|'left',  // horizontal anchor (default right)
   *   anchor: HTMLElement,
   *   at: {x, y}              // fixed position (overrides anchor)
   * }
   * item: { kind:'item'|'cell'|'section'|'heading', icon, label, desc, value,
   *         checked, kbd, submenu, onSelect }
   */
  function openMenu(anchor, config) {
    // capture the anchor rect BEFORE closing (the anchor may live inside the
    // menu surface that closeMenu removes, e.g. submenu parent cells)
    var savedRect = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    closeMenu();
    var surface = h('<div class="menu-surface" role="menu"></div>');
    if (config.width) surface.style.minWidth = config.width + "px";
    if (config.panel) {
      // rich read-only panel (usage details etc.) instead of menu items
      surface.classList.add("panel-mode");
      surface.innerHTML = config.panel;
      $("#overlay-layer").appendChild(surface);
      positionSurface(surface, anchor, savedRect, config);
      bindMenuDismiss(surface, anchor);
      return surface;
    }

    config.items.forEach(function (item) {
      var node;
      if (item.kind === "heading") {
        node = h('<div class="menu-group-heading">' + esc(item.label) + "</div>");
      } else if (item.kind === "section") {
        node = h('<div class="menu-section-title">' + esc(item.label) + "</div>");
      } else if (item.kind === "cell") {
        node = h(
          '<button type="button" class="menu-cell" role="menuitem">' +
            '<span class="cell-label">' + esc(item.label) + "</span>" +
            '<span class="cell-value">' + esc(item.value || "") + "</span>" +
            '<span class="cell-chevron">' + ic("chevronRight14", { w: 14, h: 14 }) + "</span>" +
            "</button>"
        );
        node.addEventListener("click", function (e) {
          e.stopPropagation();
          if (item.submenu) {
            openMenu(node, {
              items: item.submenu,
              anchor: node,
              align: "left",
              offsetX: "cell",
            });
          }
        });
      } else {
        var descHtml = item.desc ? '<span class="mi-desc">' + esc(item.desc) + "</span>" : "";
        node = h(
          '<button type="button" class="menu-item' + (item.desc ? " with-desc" : "") + '" role="menuitem">' +
            (item.icon ? '<span class="mi-icon">' + ic(item.icon, { w: 16, h: 16 }) + "</span>" : "") +
            '<span class="mi-label">' + esc(item.label) + descHtml + "</span>" +
            (item.kbd && item.kbd.length
              ? '<span class="mi-kbd kbd-hint">' +
                item.kbd
                  .map(function (k, i) {
                    return (i ? '<span class="kbd-sep">+</span>' : "") + '<kbd class="kbd">' + esc(k) + "</kbd>";
                  })
                  .join("") +
                "</span>"
              : "") +
            (item.checked ? '<span class="mi-check">' + ic("check", { w: 16, h: 16 }) + "</span>" : "") +
            "</button>"
        );
        node.addEventListener("click", function (e) {
          e.stopPropagation();
          if (item.onSelect) item.onSelect(item);
          if (!item.keepOpen) closeMenu();
        });
      }
      surface.appendChild(node);
    });

    $("#overlay-layer").appendChild(surface);

    positionSurface(surface, anchor, savedRect, config);

    bindMenuDismiss(surface, anchor);
    return surface;
  }

  function bindMenuDismiss(surface, anchor) {
    function onDown(e) {
      if (!surface.contains(e.target) && !(anchor && anchor.contains(e.target))) closeMenu();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
      }
    }
    setTimeout(function () {
      document.addEventListener("mousedown", onDown, true);
    }, 0);
    document.addEventListener("keydown", onKey, true);
    menuCleanup = function () {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      if (surface.parentNode) surface.parentNode.removeChild(surface);
    };
  }

  function positionSurface(surface, anchor, savedRect, config) {
    var rect = savedRect;
    var top, left;
    if (config.at) {
      top = config.at.y;
      left = config.at.x;
    } else if (rect) {
      var sr = surface.getBoundingClientRect();
      top = rect.bottom + 6;
      if (top + sr.height > window.innerHeight - 8) top = Math.max(8, rect.top - sr.height - 6);
      var align = config.align || "right";
      if (config.offsetX === "cell") {
        left = rect.right + 4;
        if (left + sr.width > window.innerWidth - 8) left = rect.left - sr.width - 4;
      } else if (align === "right") {
        left = rect.right - sr.width;
      } else {
        left = rect.left;
      }
      left = Math.max(8, Math.min(left, window.innerWidth - sr.width - 8));
    } else {
      top = 80;
      left = 80;
    }
    surface.style.top = top + "px";
    surface.style.left = left + "px";
  }

  /* ==================== data access ==================== */
  /* --- usage / stats detail panels (turn usage, session stats,
         token usage, context usage) --- */
  function statsPanelHtml(kind, data) {
    function dl(rows) {
      return (
        '<dl class="stats-details">' +
        rows
          .map(function (r) {
            return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>";
          })
          .join("") +
        "</dl>"
      );
    }
    if (kind === "turn-usage") {
      return (
        '<div class="stats-panel">' +
        '<div class="stats-title"><span class="stats-title-label">' +
        ic("usage", { w: 13, h: 13 }) +
        "<span>Turn usage</span></span>" +
        '<span class="stats-title-value">' +
        esc(data.label) +
        "</span></div>" +
        '<div class="stats-rule"></div>' +
        dl([
          ["Provider/model", data.route],
          ["Cache hit", data.cacheHit],
          ["Uncached input", data.uncachedInput],
          ["Cached input", data.cachedInput],
          ["Cache write", data.cacheWrite],
          ["Output", data.output],
        ]) +
        "</div>"
      );
    }
    if (kind === "session-stats") {
      return (
        '<div class="stats-panel">' +
        '<div class="stats-title"><span class="stats-title-label">' +
        ic("gauge", { w: 13, h: 13 }) +
        "<span>Session statistics</span></span></div>" +
        '<div class="stats-rule"></div>' +
        dl([
          ["LLM time", data.llmTime],
          ["Tool time", data.toolTime],
          ["Avg TTFT", data.avgTTFT],
          ["TPS", data.tps],
        ]) +
        "</div>"
      );
    }
    if (kind === "token-usage") {
      return (
        '<div class="stats-panel">' +
        '<div class="stats-title"><span class="stats-title-label">' +
        ic("database", { w: 13, h: 13 }) +
        "<span>Token usage</span></span>" +
        '<span class="stats-title-value">' +
        esc(data.total) +
        "</span></div>" +
        '<div class="stats-rule"></div>' +
        dl([
          ["Cache hit", data.cacheHit],
          ["Uncached input", data.uncachedInput],
          ["Cached input", data.cachedInput],
          ["Output", data.output],
        ]) +
        "</div>"
      );
    }
    // context usage
    var rows = (data.rows || [])
      .map(function (r) {
        return (
          '<div class="ctx-row"><dt><span class="ctx-swatch ctx-' +
          esc(r.color) +
          '"></span><span class="ctx-label">' +
          esc(r.label) +
          "</span></dt><dd>" +
          esc(r.value) +
          "</dd></div>"
        );
      })
      .join("");
    return (
      '<div class="stats-panel ctx-panel">' +
      '<div class="ctx-header"><span class="ctx-percent">' +
      esc(data.percent) +
      '</span><span class="ctx-headline">of context used</span><span class="ctx-figures">' +
      esc(data.figures) +
      "</span></div>" +
      '<div class="ctx-bar">' +
      (data.rows || [])
        .map(function (r) {
          return '<div class="ctx-segment ctx-' + esc(r.color) + '" style="flex:0 0 ' + Math.max(r.share * 100, 0.8) + '%"></div>';
        })
        .join("") +
      "</div>" +
      '<dl class="ctx-rows">' +
      rows +
      "</dl>" +
      "</div>"
    );
  }

  function openStatsPanel(anchor, kind, data) {
    openMenu(anchor, {
      align: "right",
      width: 300,
      panel: statsPanelHtml(kind, data),
    });
  }

  function apiGet(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("GET " + url + " -> " + r.status);
      return r.json();
    });
  }
  function loadSession(id) {
    if (state.sessions[id]) return Promise.resolve(state.sessions[id]);
    return apiGet("mock/session-" + id + ".json").then(function (data) {
      state.sessions[id] = data;
      return data;
    });
  }
  function findWorkspace(id) {
    return state.boot.workspaces.filter(function (w) {
      return w.id === id;
    })[0];
  }
  function activeWorkspace() {
    return findWorkspace(state.activeWorkspaceId) || state.boot.workspaces[0];
  }
  function activeSessionMeta() {
    var ws = activeWorkspace();
    return (ws.sessions || []).filter(function (s) {
      return s.id === state.activeSessionId;
    })[0];
  }
  function modelName(id) {
    var name = id;
    state.boot.models.groups.forEach(function (g) {
      g.options.forEach(function (o) {
        if (o.id === id) name = o.name;
      });
    });
    return name;
  }
  function effortName(id) {
    var o = state.boot.efforts.filter(function (e) {
      return e.id === id;
    })[0];
    return o ? o.name : id;
  }
  function modeName(id) {
    var o = state.boot.modes.filter(function (m) {
      return m.id === id;
    })[0];
    return o ? o.name : id;
  }
  function accessName(id) {
    var o = state.boot.accessModes.filter(function (m) {
      return m.id === id;
    })[0];
    return o ? o.name : id;
  }

  /* ==================== theme ==================== */
  function applyAppearance(pref) {
    var dark = pref === "dark";
    if (pref === "system" && window.matchMedia) {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    document.body.toggleAttribute("data-ds-dark-theme", dark);
  }

  /* ==================== sidebar ==================== */
  function renderSidebar() {
    var root = $("#root");
    var existing = $(".sidebar", root);
    var boot = state.boot;
    var wsHtml = boot.workspaces
      .map(function (ws) {
        var expanded = state.expanded[ws.id];
        var matches =
          !state.search ||
          ws.name.toLowerCase().indexOf(state.search.toLowerCase()) >= 0 ||
          (ws.sessions || []).some(function (s) {
            return s.title.toLowerCase().indexOf(state.search.toLowerCase()) >= 0;
          });
        if (!matches) return "";
        var rows = "";
        if (expanded || state.search) {
          (ws.sessions || []).forEach(function (s) {
            if (
              state.search &&
              s.title.toLowerCase().indexOf(state.search.toLowerCase()) < 0 &&
              ws.name.toLowerCase().indexOf(state.search.toLowerCase()) < 0
            )
              return;
            var selected = s.id === state.activeSessionId && state.view === "session";
            rows +=
              '<div class="tree-row session-row' +
              (selected ? " selected" : "") +
              '" data-session="' +
              esc(s.id) +
              '" data-ws="' +
              esc(ws.id) +
              '" role="treeitem" aria-selected="' +
              (selected ? "true" : "false") +
              '">' +
              '<span class="row-slot">' +
              (s.pinned ? ic("pin", { w: 13, h: 13 }) : "") +
              "</span>" +
              '<span class="row-title">' +
              esc(s.title) +
              "</span>" +
              '<span class="row-time">' +
              esc(s.time || "") +
              "</span>" +
              '<span class="row-actions"><button type="button" class="icon-button row-more" aria-label="Session actions for ' +
              esc(s.title) +
              '" data-session="' +
              esc(s.id) +
              '" data-ws="' +
              esc(ws.id) +
              '">' +
              ic("dots", { w: 16, h: 16 }) +
              "</button></span>" +
              "</div>";
          });
        }
        var wsSelected = state.activeWorkspaceId === ws.id && state.view === "session";
        return (
          '<div class="group-section">' +
          '<div class="tree-row project-row' +
          (wsSelected ? " selected" : "") +
          '" data-ws-toggle="' +
          esc(ws.id) +
          '" role="treeitem" aria-expanded="' +
          (expanded ? "true" : "false") +
          '">' +
          '<span class="row-slot">' +
          ic(expanded ? "folder" : "folderClosed", { w: 16, h: 16 }) +
          "</span>" +
          '<span class="row-title">' +
          esc(ws.name) +
          "</span>" +
          '<span class="row-actions"><button type="button" class="icon-button row-more" aria-label="Workspace actions for ' +
          esc(ws.name) +
          '" data-ws="' +
          esc(ws.id) +
          '">' +
          ic("dots", { w: 16, h: 16 }) +
          "</button></span>" +
          '<span class="chevron' +
          (expanded ? " open" : "") +
          '">' +
          ic("chevronRightClosed", { w: 14, h: 14 }) +
          "</span>" +
          "</div>" +
          (rows ? '<div class="session-children">' + rows + "</div>" : "") +
          "</div>"
        );
      })
      .join("");

    var sidebar = h(
      '<aside class="sidebar' +
        (state.sidebarCollapsed ? " collapsed" : "") +
        '">' +
        '<div class="logo-row">' +
        '<button type="button" class="brand" aria-label="DeepSeek Harness">' +
        '<span class="brand-mark">' +
        ic("fish", { w: 24, h: 17.66 }) +
        "</span>" +
        '<span class="brand-name">' +
        ic("wordmark", { w: 78, h: 12 }) +
        "</span>" +
        '<span class="brand-suffix">HARNESS</span>' +
        "</button>" +
        '<button type="button" class="icon-button sidebar-toggle" aria-label="Collapse sidebar">' +
        ic("collapseSidebar", { w: 16, h: 16 }) +
        "</button>" +
        "</div>" +
        '<button type="button" class="new-session">' +
        '<span class="panel-glyph">' +
        ic("plusCircle", { w: 14, h: 14 }) +
        "</span>" +
        '<span class="new-session-label">New Session</span>' +
        '<span class="kbd-hint"><kbd class="kbd">Ctrl</kbd><span class="kbd-sep">+</span><kbd class="kbd">Alt</kbd><span class="kbd-sep">+</span><kbd class="kbd">N</kbd></span>' +
        "</button>" +
        '<nav class="panel-list">' +
        '<button type="button" class="panel-row' +
        (state.view === "plugins" ? " panel-active" : "") +
        '" aria-label="Plugins">' +
        '<span class="panel-glyph">' +
        ic("plugins", { w: 16, h: 16 }) +
        "</span>" +
        "<span>Plugins</span>" +
        "</button>" +
        "</nav>" +
        '<div class="region-area">' +
        '<div class="section-header">' +
        '<span class="section-label">Workspaces</span>' +
        '<div class="search-slot">' +
        '<button type="button" class="icon-button search-toggle" aria-label="Search sessions">' +
        ic("search", { w: 14, h: 14 }) +
        "</button>" +
        '<input class="search-input" type="text" placeholder="Filter…" value="' +
        esc(state.search) +
        '" />' +
        "</div>" +
        '<div class="header-actions">' +
        '<button type="button" class="icon-button view-options" aria-label="View options">' +
        ic("filter", { w: 16, h: 16 }) +
        "</button>" +
        '<button type="button" class="icon-button add-workspace" aria-label="Add workspace">' +
        ic("addWorkspace", { w: 16, h: 16 }) +
        "</button>" +
        "</div>" +
        "</div>" +
        '<div class="list-area">' +
        wsHtml +
        "</div>" +
        "</div>" +
        '<div class="foot-area">' +
        '<button type="button" class="settings-trigger">' +
        '<span class="panel-glyph">' +
        ic("settings", { w: 16, h: 16 }) +
        "</span>" +
        "<span>Settings</span>" +
        "</button>" +
        "</div>" +
        "</aside>"
    );

    if (existing) {
      var host = existing.parentNode;
      host.replaceChild(sidebar, existing);
    } else {
      var frame = $(".app-frame", root);
      if (frame) frame.insertBefore(sidebar, frame.firstChild);
      else root.insertBefore(sidebar, root.firstChild);
    }
    bindSidebar(sidebar);
    if (state.searchFocus) {
      var input = $(".search-input", sidebar);
      if (input) {
        input.focus();
        state.searchFocus = false;
      }
    }
  }

  function bindSidebar(sidebar) {
    $(".sidebar-toggle", sidebar).addEventListener("click", function () {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      renderAll();
    });
    $(".new-session", sidebar).addEventListener("click", function () {
      createSession();
    });
    $(".panel-row", sidebar).addEventListener("click", function () {
      state.view = state.view === "plugins" ? "session" : "plugins";
      renderAll();
    });
    $(".search-toggle", sidebar).addEventListener("click", function () {
      var input = $(".search-input", sidebar);
      input.style.display = input.style.display === "none" ? "block" : "none";
      if (input.style.display !== "none") input.focus();
    });
    var search = $(".search-input", sidebar);
    var debounce = null;
    search.addEventListener("input", function () {
      state.searchFocus = true;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(function () {
        state.search = search.value;
        renderSidebar();
      }, 120);
    });
    $(".view-options", sidebar).addEventListener("click", function (e) {
      openMenu(e.currentTarget, {
        align: "left",
        items: [
          { kind: "heading", label: "Sort by" },
          { label: "Recent activity", checked: true, onSelect: function () { toast("Sorted by recent activity"); } },
          { label: "Name", onSelect: function () { toast("Sorted by name"); } },
          { kind: "section", label: "Show" },
          { label: "Archived sessions", onSelect: function () { toast("No archived sessions"); } },
        ],
      });
    });
    $(".add-workspace", sidebar).addEventListener("click", function () {
      var id = "ws-" + Date.now();
      state.boot.workspaces.push({ id: id, name: "New workspace", path: "", expanded: true, sessions: [] });
      state.activeWorkspaceId = id;
      renderAll();
      toast("Workspace created");
    });
    $(".settings-trigger", sidebar).addEventListener("click", function () {
      openSettings();
    });

    $all("[data-ws-toggle]", sidebar).forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".row-more")) return;
        var id = row.getAttribute("data-ws-toggle");
        state.expanded[id] = !state.expanded[id];
        state.activeWorkspaceId = id;
        renderSidebar();
        renderCenter();
      });
    });
    $all(".session-row", sidebar).forEach(function (row) {
      row.addEventListener("click", function (e) {
        if (e.target.closest(".row-more")) return;
        selectSession(row.getAttribute("data-ws"), row.getAttribute("data-session"));
      });
    });
    $all(".row-more", sidebar).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var sid = btn.getAttribute("data-session");
        var wid = btn.getAttribute("data-ws");
        if (sid) {
          openSessionMenu(btn, wid, sid);
        } else {
          openWorkspaceMenu(btn, wid);
        }
      });
    });
  }

  function openSessionMenu(anchor, wsId, sessionId) {
    var ws = findWorkspace(wsId);
    var meta = (ws.sessions || []).filter(function (s) {
      return s.id === sessionId;
    })[0];
    openMenu(anchor, {
      align: "right",
      items: state.boot.sessionRowActions.map(function (a) {
        return {
          icon: a.icon,
          label: a.name,
          kbd: a.kbd,
          onSelect: function () {
            if (a.id === "pin") {
              meta.pinned = !meta.pinned;
              toast(meta.pinned ? "Session pinned" : "Session unpinned");
              renderSidebar();
            } else if (a.id === "rename") {
              inlineRename(ws, meta);
            } else if (a.id === "fork") {
              var newId = "s-" + Date.now();
              ws.sessions.unshift({
                id: newId,
                title: meta.title + " (fork)",
                time: "now",
                pinned: false,
              });
              state.sessions[newId] = JSON.parse(JSON.stringify(state.sessions[sessionId] || { id: newId, title: meta.title, messages: [] }));
              state.sessions[newId].id = newId;
              selectSession(wsId, newId);
              toast("Session forked");
            } else if (a.id === "archive") {
              ws.sessions = ws.sessions.filter(function (s) {
                return s.id !== sessionId;
              });
              delete state.sessions[sessionId];
              if (state.activeSessionId === sessionId) {
                state.activeSessionId = null;
                state.session = null;
              }
              renderAll();
              toast("Session archived");
            }
          },
        };
      }),
    });
  }

  function openWorkspaceMenu(anchor, wsId) {
    openMenu(anchor, {
      align: "right",
      items: [
        {
          icon: "rename",
          label: "Rename",
          onSelect: function () {
            var ws = findWorkspace(wsId);
            var name = window.prompt("Rename workspace", ws.name);
            if (name) {
              ws.name = name;
              renderAll();
            }
          },
        },
        {
          icon: "archive",
          label: "Delete workspace",
          onSelect: function () {
            state.boot.workspaces = state.boot.workspaces.filter(function (w) {
              return w.id !== wsId;
            });
            if (state.activeWorkspaceId === wsId) {
              state.activeWorkspaceId = state.boot.workspaces[0] ? state.boot.workspaces[0].id : null;
              state.activeSessionId = null;
              state.session = null;
            }
            renderAll();
            toast("Workspace deleted");
          },
        },
      ],
    });
  }

  function inlineRename(ws, meta) {
    renderSidebar();
    setTimeout(function () {
      var row = $('.session-row[data-session="' + meta.id + '"]');
      if (!row) return;
      var title = $(".row-title", row);
      var input = h(
        '<input type="text" style="flex:1;min-width:0;height:24px;border:none;outline:none;background:var(--bg-chip);border-radius:6px;padding:0 6px;font-size:14px;color:var(--text-primary)" value="' +
          esc(meta.title) +
          '" />'
      );
      title.replaceWith(input);
      input.focus();
      input.select();
      function commit() {
        meta.title = input.value.trim() || meta.title;
        renderAll();
      }
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") renderAll();
        e.stopPropagation();
      });
      input.addEventListener("blur", commit);
    }, 30);
  }

  function createSession() {
    var ws = activeWorkspace();
    var id = "s-" + Date.now();
    ws.sessions = ws.sessions || [];
    ws.sessions.unshift({ id: id, title: "New Session", time: "now", pinned: false });
    state.sessions[id] = { id: id, title: "New Session", messages: [], trajectory: [] };
    state.expanded[ws.id] = true;
    selectSession(ws.id, id);
  }

  function selectSession(wsId, sessionId) {
    state.activeWorkspaceId = wsId;
    state.activeSessionId = sessionId;
    state.view = "session";
    state.chatTab = "chat";
    cancelStreaming();
    loadSession(sessionId).then(function (data) {
      state.session = data;
      renderAll();
    });
  }

  /* ==================== center: header ==================== */
  function renderCenter() {
    var root = $("#root");
    var frame = $(".app-frame", root);
    if (!frame) return;
    var existing = $(".center-col", frame);
    var col = h('<main class="center-col"></main>');

    var meta = activeSessionMeta();
    var inChat = state.view === "session" && state.session && state.session.messages && state.session.messages.length > 0;

    // header
    var header;
    if (state.view === "plugins") {
      header = h(
        '<header class="center-header">' +
          '<div class="header-top">' +
          '<div class="crumbs"></div>' +
          '<button type="button" class="ghost-button rightbar-toggle" aria-label="Open right sidebar" style="margin-left:auto">' +
          ic("panelRight", { w: 16, h: 16 }) +
          "</button>" +
          "</div>" +
          "</header>"
      );
    } else if (inChat && meta) {
      header = h(
        '<header class="center-header">' +
          '<div class="header-top">' +
          '<div class="crumbs" aria-label="Session hierarchy">' +
          '<span class="crumb-current">' +
          esc(meta.title) +
          "</span>" +
          '<span class="mode-label" title="' +
          esc(currentModeDesc()) +
          '">' +
          ic("modeSmall", { w: 13, h: 13 }) +
          esc(modeName(state.mode)) +
          "</span>" +
          "</div>" +
          '<div class="header-utilities">' +
          '<span class="split-button">' +
          '<button type="button" class="ghost-button open-explorer" aria-label="Open in File Explorer">' +
          '<span class="app-icon">DS</span>Open in File Explorer</button>' +
          '<button type="button" class="ghost-button split-chevron more-open" aria-label="More ways to open">' +
          ic("chevronDown10", { w: 10, h: 10 }) +
          "</button>" +
          "</span>" +
          '<button type="button" class="ghost-button more-actions" aria-label="More actions">' +
          ic("dots", { w: 16, h: 16 }) +
          "</button>" +
          "</div>" +
          '<button type="button" class="ghost-button rightbar-toggle" aria-label="Open right sidebar">' +
          ic("panelRight", { w: 16, h: 16 }) +
          "</button>" +
          "</div>" +
          '<div class="tabs">' +
          '<button type="button" class="tab' +
          (state.chatTab === "chat" ? " active" : "") +
          '" data-tab="chat">Chat</button>' +
          '<button type="button" class="tab' +
          (state.chatTab === "trajectory" ? " active" : "") +
          '" data-tab="trajectory">Trajectory</button>' +
          "</div>" +
          "</header>"
      );
    } else {
      header = h(
        '<header class="center-header">' +
          '<div class="header-top">' +
          '<div class="crumbs"></div>' +
          '<button type="button" class="ghost-button rightbar-toggle" aria-label="Open right sidebar" style="margin-left:auto">' +
          ic("panelRight", { w: 16, h: 16 }) +
          "</button>" +
          "</div>" +
          "</header>"
      );
    }
    col.appendChild(header);

    var body = h('<div class="center-body"></div>');
    col.appendChild(body);

    // composer seat (persistent node)
    var seat = h('<div class="composer-seat"></div>');
    var dock = h('<div class="dock" style="display:' + (inChat ? "flex" : "none") + '"></div>');

    if (state.view === "plugins") {
      body.appendChild(renderPluginsPage());
    } else if (inChat) {
      var scroll = h('<div class="chat-scroll"></div>');
      var column = h(
        '<div class="chat-column ' +
          (state.chatTab === "trajectory" ? "traj-mode" : "chat-mode") +
          '"></div>'
      );
      scroll.appendChild(column);
      body.appendChild(scroll);
      renderChatColumn(column, meta);
      col.appendChild(seat);
      col.appendChild(dock);
    } else {
      var hero = renderHero();
      hero.appendChild(seat);
      body.appendChild(hero);
    }

    if (existing) frame.replaceChild(col, existing);
    else frame.appendChild(col);
    bindCenter(col, meta, inChat);
    mountComposer(seat, dock, inChat);
    refreshTodosCard();
    if (inChat) updateDock(dock);
  }

  function currentModeDesc() {
    var m = state.boot.modes.filter(function (x) {
      return x.id === state.mode;
    })[0];
    return m ? m.desc : "";
  }

  /* ==================== hero ==================== */
  function renderHero() {
    var ws = activeWorkspace();
    return h(
      '<div class="hero-wrap">' +
        '<div class="hero-title">' +
        '<span class="hero-fish">' +
        ic("fishHero", { w: 34, h: 25 }) +
        "</span>" +
        "<span>" +
        esc(state.boot.hero.title) +
        "</span>" +
        '<span class="preview-badge">' +
        esc(state.boot.hero.badge) +
        "</span>" +
        "</div>" +
        '<div class="hero-chips">' +
        '<button type="button" class="chip workspace-chip" aria-label="Choose workspace">' +
        ic("folderChip", { w: 16, h: 16 }) +
        "<span>" +
        esc(ws ? ws.name : "No workspace") +
        "</span>" +
        '<span class="chip-chevron">' +
        ic("chevronDown12", { w: 12, h: 12 }) +
        "</span>" +
        "</button>" +
        '<button type="button" class="chip mode-chip" aria-label="Choose mode">' +
        ic("mode", { w: 16, h: 16 }) +
        "<span>" +
        esc(modeName(state.mode)) +
        "</span>" +
        '<span class="chip-chevron">' +
        ic("chevronDown14", { w: 14, h: 14 }) +
        "</span>" +
        "</button>" +
        "</div>" +
        "</div>"
    );
  }

  /* ==================== composer ==================== */
  var composerInput = null;
  var composerSeatNode = null;
  var dockNode = null;
  var composerInChat = false;

  function mountComposer(seat, dock, inChat) {
    composerSeatNode = seat;
    dockNode = dock;
    composerInChat = inChat;
    if (!composerInput) {
      composerInput = h(
        '<div class="composer-input" contenteditable="true" role="textbox" aria-multiline="true"></div>'
      );
      composerInput.addEventListener("input", function () {
        if (!composerInput.textContent) composerInput.innerHTML = "";
        state.composerText = composerInput.textContent;
      });
      composerInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
        e.stopPropagation();
      });
    }
    composerInput.setAttribute(
      "data-placeholder",
      inChat ? state.boot.hero.chatPlaceholder : state.boot.hero.placeholder
    );
    if (state.composerText) composerInput.textContent = state.composerText;

    var card = h(
      '<div class="composer">' +
        '<div class="composer-card">' +
        '<div class="composer-scroll"></div>' +
        '<div class="composer-row">' +
        '<div class="composer-tools">' +
        '<button type="button" class="add-btn" aria-label="Add files or run commands" aria-expanded="false">' +
        ic("plus", { w: 14, h: 14 }) +
        "</button>" +
        '<button type="button" class="trigger access-trigger" aria-label="Access mode">' +
        '<span class="trigger-icon">' +
        ic(accessIconName(state.accessMode), { w: 16, h: 16 }) +
        "</span>" +
        '<span class="trigger-label">' +
        esc(accessName(state.accessMode)) +
        "</span>" +
        '<span class="trigger-chevron">' +
        ic("chevronDownTiny", { w: 14, h: 14 }) +
        "</span>" +
        "</button>" +
        "</div>" +
        '<div class="composer-trailing">' +
        '<button type="button" class="trigger model-trigger" aria-label="Select model">' +
        ic("bolt", { w: 16, h: 16 }) +
        '<span class="trigger-label">' +
        esc(modelName(state.model)) +
        "</span>" +
        '<span class="trigger-effort">' +
        esc(effortName(state.effort)) +
        "</span>" +
        '<span class="trigger-chevron">' +
        ic("chevronDownModel", { w: 14, h: 14 }) +
        "</span>" +
        "</button>" +
        '<button type="button" class="send-btn" aria-label="Send message">' +
        ic(state.streaming ? "stop" : "send", { w: 16, h: 16 }) +
        "</button>" +
        "</div>" +
        "</div>" +
        "</div>" +
        "</div>"
    );
    $(".composer-scroll", card).appendChild(composerInput);
    seat.appendChild(card);

    $(".add-btn", card).addEventListener("click", function (e) {
      openMenu(e.currentTarget, {
        align: "left",
        items: [{ kind: "section", label: "Add" }].concat(
          state.boot.addMenu.map(function (a) {
            return {
              icon: a.icon,
              label: a.name,
              desc: a.desc,
              onSelect: function () {
                toast(a.name + " — mock action");
              },
            };
          }),
          [{ kind: "section", label: "Commands" }]
        ),
      });
    });
    $(".access-trigger", card).addEventListener("click", function (e) {
      openAccessMenu(e.currentTarget);
    });
    $(".model-trigger", card).addEventListener("click", function (e) {
      openModelMenu(e.currentTarget);
    });
    $(".send-btn", card).addEventListener("click", function () {
      sendMessage();
    });
  }

  function accessIconName(id) {
    var m = state.boot.accessModes.filter(function (x) {
      return x.id === id;
    })[0];
    return m ? m.icon : "shieldWrite";
  }

  function refreshComposer() {
    if (!composerSeatNode) return;
    var seat = composerSeatNode;
    seat.innerHTML = "";
    mountComposer(seat, dockNode, composerInChat);
  }

  /* ==================== menus: model / access / mode ==================== */
  function openModelMenu(anchor) {
    var submenu = [];
    state.boot.models.groups.forEach(function (g) {
      submenu.push({ kind: "heading", label: g.label });
      g.options.forEach(function (o) {
        submenu.push({
          label: o.name,
          checked: o.id === state.model,
          onSelect: function () {
            state.model = o.id;
            refreshComposer();
            toast("Model: " + o.name);
          },
        });
      });
    });
    openMenu(anchor, {
      align: "right",
      width: 250,
      items: [
        {
          kind: "cell",
          label: "Model",
          value: modelName(state.model),
          submenu: submenu,
        },
        {
          kind: "cell",
          label: "Effort",
          value: effortName(state.effort),
          submenu: state.boot.efforts.map(function (e) {
            return {
              label: e.name,
              checked: e.id === state.effort,
              onSelect: function () {
                state.effort = e.id;
                refreshComposer();
                toast("Effort: " + e.name);
              },
            };
          }),
        },
      ],
    });
  }

  function openAccessMenu(anchor) {
    openMenu(anchor, {
      align: "left",
      items: state.boot.accessModes.map(function (m) {
        return {
          icon: m.icon,
          label: m.name,
          checked: m.id === state.accessMode,
          onSelect: function () {
            state.accessMode = m.id;
            state.settings.permission = m.id;
            refreshComposer();
            toast("Access mode: " + m.name);
          },
        };
      }),
    });
  }

  function openModeMenu(anchor) {
    openMenu(anchor, {
      align: "left",
      width: 380,
      items: state.boot.modes.map(function (m) {
        return {
          label: m.name,
          desc: m.desc,
          checked: m.id === state.mode,
          onSelect: function () {
            state.mode = m.id;
            renderAll();
            toast("Mode: " + m.name);
          },
        };
      }),
    });
  }

  function openWorkspaceMenuChip(anchor) {
    openMenu(anchor, {
      align: "left",
      width: 260,
      items: state.boot.workspaces.map(function (w) {
        return {
          icon: "folderChip",
          label: w.name,
          checked: w.id === state.activeWorkspaceId,
          onSelect: function () {
            state.activeWorkspaceId = w.id;
            var first = (w.sessions || [])[0];
            if (first) {
              selectSession(w.id, first.id);
            } else {
              state.activeSessionId = null;
              state.session = null;
              renderAll();
            }
          },
        };
      }),
    });
  }

  /* ==================== chat rendering ==================== */
  function renderChatColumn(column, meta) {
    column.innerHTML = "";
    column.classList.toggle("traj-mode", state.chatTab === "trajectory");
    column.classList.toggle("chat-mode", state.chatTab !== "trajectory");
    var session = state.session;
    if (!session) return;
    if (state.chatTab === "trajectory") {
      column.appendChild(renderTrajectory(session));
      return;
    }
    state.trajToolSel = null;
    session.messages.forEach(function (msg) {
      column.appendChild(renderMessage(msg));
    });
  }

  /* to-dos card lives in the composer seat (above the input card), not in the
     scrolling conversation column — it mirrors the original floating card */
  function refreshTodosCard() {
    if (!composerSeatNode) return;
    var existing = $(".todos-card", composerSeatNode);
    if (existing) existing.remove();
    var todos = (state.session && state.session.todos) || [];
    var show = composerInChat && state.chatTab !== "trajectory" && todos.length > 0;
    if (!show) return;
    composerSeatNode.insertBefore(renderTodosCard(todos), composerSeatNode.firstChild);
  }

  /* --- floating to-dos card --- */
  var TODO_STATES = {
    done: { label: "Completed", cls: "done" },
    active: { label: "In progress", cls: "active" },
    in_progress: { label: "In progress", cls: "active" },
    pending: { label: "Pending", cls: "pending" },
  };

  function renderTodosCard(todos) {
    var collapsed = !!state.todosCollapsed;
    var done = todos.filter(function (t) {
      return t.state === "done";
    }).length;
    var active = todos.filter(function (t) {
      return t.state === "active" || t.state === "in_progress";
    }).length;
    var counting = active ? done + " done · " + active + " running" : done + "/" + todos.length;
    var card = h(
      '<div class="todos-card' +
        (collapsed ? " collapsed" : "") +
        '">' +
        '<button type="button" class="todos-header" aria-expanded="' +
        (!collapsed) +
        '">' +
        '<span class="todos-lead">' +
        ic("todo", { w: 14, h: 14 }) +
        "</span>" +
        '<span class="todos-title">To-dos</span>' +
        '<span class="todos-progress">' +
        (done === todos.length ? done + " completed" : counting) +
        "</span>" +
        '<span class="todos-chevron">' +
        ic("chevronDown14", { w: 14, h: 14 }) +
        "</span>" +
        "</button>" +
        '<ul class="todos-list"' +
        (collapsed ? ' style="display:none"' : "") +
        "></ul>" +
        "</div>"
    );
    var list = $(".todos-list", card);
    todos.forEach(function (t) {
      var meta = TODO_STATES[t.state] || TODO_STATES.pending;
      var item = h(
        '<li class="todos-item todos-' +
          meta.cls +
          '">' +
          '<span class="todos-glyph" aria-label="' +
          meta.label +
          '" title="' +
          meta.label +
          '">' +
          '<span class="todos-dot ' +
          meta.cls +
          '">' +
          (meta.cls === "done" ? ic("check16", { w: 8, h: 8 }) : "") +
          "</span>" +
          "</span>" +
          '<span class="todos-content">' +
          esc(t.text) +
          "</span>" +
          "</li>"
      );
      list.appendChild(item);
    });
    var header = $(".todos-header", card);
    header.addEventListener("click", function () {
      state.todosCollapsed = !state.todosCollapsed;
      card.classList.toggle("collapsed", state.todosCollapsed);
      header.setAttribute("aria-expanded", String(!state.todosCollapsed));
      list.style.display = state.todosCollapsed ? "none" : "";
    });
    return card;
  }

  /* --- deliverable file cards (result files presented to the user) --- */
  function renderDeliverables(deliv) {
    if (!deliv || !deliv.files || !deliv.files.length) return h("<div></div>");
    var root = h('<div class="deliv-root"><div class="deliv-presented"></div></div>');
    var presented = $(".deliv-presented", root);
    deliv.files.forEach(function (f) {
      var parts = String(f.name).split(".");
      var ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
      var isMd = ext === "md";
      var card = h(
        '<div class="deliv-file">' +
          '<span class="deliv-icon">' +
          ic(isMd ? "filePreview" : "codeFile", { w: 20, h: 20 }) +
          "</span>" +
          '<div class="deliv-main">' +
          '<div class="deliv-name">' +
          esc(f.name) +
          "</div>" +
          '<div class="deliv-desc">' +
          esc(f.desc || "") +
          "</div>" +
          "</div>" +
          '<div class="deliv-actions">' +
          '<button type="button" class="icon-button deliv-loc" aria-label="Show file location" title="Show file location (default)">' +
          ic("fileLocation", { w: 15, h: 15 }) +
          "</button>" +
          '<button type="button" class="icon-button deliv-more" aria-label="More ways to open" title="More ways to open">' +
          ic("chevronDownTiny", { w: 12, h: 12 }) +
          "</button>" +
          "</div>" +
          '<button type="button" class="deliv-preview" aria-label="Preview in sidebar"></button>' +
          "</div>"
      );
      var preview = $(".deliv-preview", card);
      preview.addEventListener("click", function () {
        openFileTab(f.path);
      });
      $(".deliv-loc", card).addEventListener("click", function () {
        toast("Show file location — mock only");
      });
      $(".deliv-more", card).addEventListener("click", function (e) {
        openMenu(e.currentTarget, {
          align: "start",
          items: [
            { icon: "fileLocation", label: "Show file location (default)", onSelect: function () { toast("Show file location — mock only"); } },
          ],
        });
      });
      presented.appendChild(card);
    });
    if (deliv.note) {
      root.appendChild(h('<div class="deliv-note">' + esc(deliv.note) + "</div>"));
    }
    return root;
  }

  function renderMessage(msg) {
    if (msg.role === "user") {
      return h(
        '<div class="msg-user">' +
          '<div class="bubble">' +
          esc(msg.text) +
          "</div>" +
          '<div class="msg-actions">' +
          "<span>" +
          esc(msg.time || nowTime()) +
          "</span>" +
          '<button type="button" class="icon-button copy-msg" aria-label="Copy">' +
          ic("copy", { w: 14, h: 14 }) +
          "</button>" +
          "</div>" +
          "</div>"
      );
    }
    var wrap = h('<div class="assistant-wrap"></div>');
    if (msg.duration && !msg.streaming) {
      wrap.appendChild(
        h(
          '<div class="duration-pill">' +
            '<span class="pill-chevron">' +
            ic("chevronPill", { w: 14, h: 14 }) +
            "</span>" +
            "<span>Completed " +
            esc(msg.duration) +
            "</span>" +
            "</div>"
        )
      );
    }
    (msg.blocks || []).forEach(function (block) {
      if (block.type === "text") {
        wrap.appendChild(renderTextBlock(block.text, msg.streaming));
      } else if (block.type === "group") {
        wrap.appendChild(renderGroup(block, msg.streaming));
      }
    });
    if (msg.deliverables && !msg.streaming) {
      wrap.appendChild(renderDeliverables(msg.deliverables));
    }
    if (msg.streaming) {
      wrap.appendChild(
        h(
          '<div class="streaming-indicator"><span class="spin">' +
            ic("deepDive", { w: 14, h: 14 }) +
            "</span><span>" +
            esc(state.streamStatus || "Deep diving") +
            "</span></div>"
        )
      );
    } else {
      var actionsRow = h(
        '<div class="msg-actions assistant-actions">' +
          '<button type="button" class="icon-button copy-assistant" aria-label="Copy">' +
          ic("copy14", { w: 14, h: 14 }) +
          "</button>" +
          '<button type="button" class="icon-button thumb-up" aria-label="Good response">' +
          ic("thumbUp", { w: 16, h: 16 }) +
          "</button>" +
          '<button type="button" class="icon-button thumb-down" aria-label="Bad response">' +
          ic("thumbDown", { w: 16, h: 16 }) +
          "</button>" +
          '<button type="button" class="icon-button share-assistant" aria-label="Share">' +
          ic("link", { w: 16, h: 16 }) +
          "</button>" +
          (msg.usage
            ? '<button type="button" class="usage-trigger" aria-haspopup="dialog">' +
              ic("usage", { w: 14, h: 14 }) +
              '<span class="usage-label">用量 ' +
              esc(msg.usage.label) +
              "</span></button>"
            : "") +
          (msg.endInfo ? '<span class="end-info">' + esc(msg.endInfo) + "</span>" : "") +
          "</div>"
      );
      wrap.appendChild(actionsRow);
      var usageBtn = $(".usage-trigger", actionsRow);
      if (usageBtn) {
        usageBtn.addEventListener("click", function () {
          openStatsPanel(usageBtn, "turn-usage", msg.usage);
        });
      }
      $all(".share-assistant", actionsRow).forEach(function (btn) {
        btn.addEventListener("click", function () {
          toast("Share — mock only");
        });
      });
      var copyBtn = $(".copy-assistant", actionsRow);
      if (copyBtn) {
        copyBtn.addEventListener("click", function () {
          copyText((msg.blocks || []).map(function (b) { return b.text || ""; }).join("\n"));
          toast("Copied to clipboard");
        });
      }
      $all(".thumb-up, .thumb-down", wrap).forEach(function (btn) {
        btn.addEventListener("click", function () {
          toast("Feedback recorded — mock only");
        });
      });
    }
    // bind copy buttons
    $all(".copy-msg", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = btn.closest(".msg-user").querySelector(".bubble").textContent;
        copyText(text);
        toast("Copied to clipboard");
      });
    });
    return wrap;
  }

  function renderTextBlock(text, streaming) {
    var node = h('<div class="assistant-block"></div>');
    node.innerHTML = miniMarkdown(text) + (streaming ? '<span class="type-caret"></span>' : "");
    return node;
  }

  function renderGroup(block, streaming) {
    var gid = block.gid || "g" + Math.random().toString(36).slice(2);
    block.gid = gid;
    var collapsed = !!state.collapsedGroups[gid];
    var node = h(
      '<div class="activity-group" data-gid="' +
        gid +
        '">' +
        '<button type="button" class="activity-title' +
        (collapsed ? " collapsed" : "") +
        '">' +
        '<span class="act-icon">' +
        ic(block.icon || "sparkle", { w: 16, h: 16 }) +
        "</span>" +
        "<span>" +
        esc(block.label) +
        "</span>" +
        '<span class="act-chevron">' +
        ic("chevronUp14", { w: 14, h: 14 }) +
        "</span>" +
        "</button>" +
        '<div class="activity-body" style="' +
        (collapsed ? "display:none" : "") +
        '"></div>' +
        "</div>"
    );
    var body = $(".activity-body", node);
    (block.children || []).forEach(function (child) {
      if (child.type === "think") {
        body.appendChild(
          h(
            '<div class="think-row"><span class="tool-icon">' +
              ic("sparkle2", { w: 14, h: 14 }) +
              "</span><span>" +
              esc(child.text) +
              "</span></div>"
          )
        );
      } else if (child.type === "tool") {
        body.appendChild(renderToolCall(child));
      }
    });
    $(".activity-title", node).addEventListener("click", function () {
      state.collapsedGroups[gid] = !state.collapsedGroups[gid];
      node.querySelector(".activity-title").classList.toggle("collapsed");
      body.style.display = state.collapsedGroups[gid] ? "none" : "";
    });
    return node;
  }

  function renderToolCall(child) {
    var status = child.status || "success";
    var statusLabel = status === "success" ? "ok" : status === "failed" ? "fail" : "run";
    var iconName = /pwsh|shell|terminal/i.test(child.name)
      ? "terminal"
      : /read/i.test(child.name)
      ? "readFile"
      : /glob|search/i.test(child.name)
      ? "searchFiles"
      : /edit/i.test(child.name)
      ? "editTool"
      : "code";
    var node = h(
      '<div class="tool-call" data-tool="' +
        esc(child.name) +
        '">' +
        '<span class="tool-icon">' +
        ic(iconName, { w: 14, h: 14 }) +
        "</span>" +
        '<span class="tool-name">' +
        esc(child.name) +
        "</span>" +
        '<span class="tool-args">' +
        esc(child.args || "") +
        "</span>" +
        '<span class="tool-status ' +
        statusLabel +
        '">' +
        (status === "success" ? "done" : status === "failed" ? "failed" : "running") +
        "</span>" +
        "</div>"
    );
    // path-like args open the file in a right-bar tab
    var args = String(child.args || "");
    var pathMatch = args.match(/[\w.]+\/[\w./\\-]+\.[A-Za-z0-9]{2,5}|[A-Za-z]:\\[\w\\.-]+/);
    if (pathMatch) {
      var argsEl = $(".tool-args", node);
      argsEl.classList.add("tool-args-link");
      argsEl.title = pathMatch[0];
      argsEl.addEventListener("click", function () {
        var p = pathMatch[0].replace(/\\/g, "/");
        openFileTab(p);
      });
    }
    return node;
  }

  /* ==================== trajectory: gantt + timeline + tool details ==================== */

  function trajPayloadSummary(ev) {
    try {
      var json = JSON.stringify(ev.payload);
      return json.length > 120 ? json.slice(0, 120) : json;
    } catch (e) {
      return "";
    }
  }

  function trajResultSummary(ev) {
    var text = String(ev.result || "");
    var first = text.split("\n")[0];
    return first.length > 60 ? first.slice(0, 60) : first;
  }

  function toolKindTag(ev) {
    return h(
      '<span class="kind-tag tool-amber">TOOL</span>'
    );
  }

  function renderJsonTree(value, depth, isTop) {
    var wrap = document.createElement("div");
    wrap.className = "json-tree" + (isTop ? " json-top" : "");
    if (value === null || typeof value !== "object") {
      var cls =
        typeof value === "string" ? "json-string" : typeof value === "number" ? "json-number" : "json-atom";
      var text = typeof value === "string" ? '"' + value + '"' : String(value);
      var truncated = text.length > 2000 ? text.slice(0, 2000) + "…" : text;
      wrap.innerHTML = '<span class="' + cls + '">' + esc(truncated) + "</span>";
      return wrap;
    }
    var isArray = Array.isArray(value);
    var entries = isArray
      ? value.map(function (v, i) {
          return [i, v];
        })
      : Object.keys(value).map(function (k) {
          return [k, value[k]];
        });
    var openBracket = h(
      '<div class="json-row json-bracket"><span class="json-punct">' + (isArray ? "[" : "{") + "</span></div>"
    );
    wrap.appendChild(openBracket);
    var container = h('<div class="json-children"></div>');
    wrap.appendChild(container);
    entries.forEach(function (pair) {
      var key = pair[0];
      var val = pair[1];
      var scalar = val === null || typeof val !== "object";
      var row = h('<div class="json-row"></div>');
      if (!isArray) {
        row.appendChild(h('<span class="json-key">"' + esc(String(key)) + '"</span>'));
        row.appendChild(h('<span class="json-punct">: </span>'));
      }
      if (scalar) {
        var cls =
          typeof val === "string" ? "json-string" : typeof val === "number" ? "json-number" : "json-atom";
        var text = typeof val === "string" ? '"' + val + '"' : String(val);
        var truncated = text.length > 600 ? text.slice(0, 600) + "…" : text;
        row.appendChild(h('<span class="' + cls + '">' + esc(truncated) + "</span>"));
        container.appendChild(row);
      } else {
        var collapsed = depth >= 1;
        var toggle = h(
          '<button type="button" class="json-toggle">' +
            (collapsed ? ic("chevronRight14", { w: 12, h: 12 }) : ic("chevronDown14", { w: 12, h: 12 })) +
            "</button>"
        );
        row.appendChild(toggle);
        row.appendChild(h('<span class="json-key-dim">' + (isArray ? String(key) : '"' + esc(String(key)) + '"') + "</span>"));
        container.appendChild(row);
        var childWrap = renderJsonTree(val, depth + 1, false);
        childWrap.style.display = collapsed ? "none" : "";
        container.appendChild(childWrap);
        toggle.addEventListener("click", function () {
          collapsed = !collapsed;
          childWrap.style.display = collapsed ? "none" : "";
          toggle.innerHTML = collapsed ? ic("chevronRight14", { w: 12, h: 12 }) : ic("chevronDown14", { w: 12, h: 12 });
        });
      }
    });
    var closeBracket = h(
      '<div class="json-row json-bracket"><span class="json-punct">' + (isArray ? "]" : "}") + "</span></div>"
    );
    wrap.appendChild(closeBracket);
    return wrap;
  }

  function trajToolDetails(ev) {
    var tab = state.trajDetailsTab || "summary";
    var aside = h('<aside class="tool-details"></aside>');
    var statusLabel = ev.status === "failed" ? "Failed" : "Completed";
    var header = h(
      '<div class="td-header">' +
        '<span class="kind-tag tool-amber">TOOL</span>' +
        '<span class="td-location">Turn ' +
        (ev.turn || 1) +
        " · Step " +
        (ev.step || "—") +
        "</span>" +
        '<button type="button" class="td-close" aria-label="Close details">×</button>' +
        "</div>"
    );
    aside.appendChild(header);
    var tabs = ["summary", "payload", "result", "schema", "timing"];
    var tabLabels = { summary: "Summary", payload: "Payload", result: "Result", schema: "Schema", timing: "Timing" };
    var tabRow = h('<div class="td-tabs"></div>');
    tabs.forEach(function (t) {
      var btn = h(
        '<button type="button" class="td-tab' +
          (tab === t ? " td-tab-active" : "") +
          '">' +
          tabLabels[t] +
          "</button>"
      );
      btn.addEventListener("click", function () {
        state.trajDetailsTab = t;
        renderChatLive();
      });
      tabRow.appendChild(btn);
    });
    aside.appendChild(tabRow);

    var body = h('<div class="td-body"></div>');
    if (tab === "summary") {
      body.appendChild(
        h(
          '<dl class="td-overview">' +
            '<div><dt>Hierarchy</dt><dd><button type="button" class="td-nav-link">Assistant Message</button></dd></div>' +
            "<div><dt>Status</dt><dd>" +
            esc(statusLabel) +
            "</dd></div>" +
            "</dl>"
        )
      );
      var sec = function (title, inner) {
        var s = h(
          '<section class="td-section">' +
            '<h3 class="td-heading"><button type="button" class="td-sec-title">' +
            "<span>" +
            title +
            "</span>" +
            "</button></h3>" +
            "</section>"
        );
        s.appendChild(inner);
        return s;
      };
      body.appendChild(
        sec(
          "Payload",
          (function () {
            var pv = h('<div class="td-preview"></div>');
            pv.appendChild(renderJsonTree(ev.payload || {}, 0, true));
            return pv;
          })()
        )
      );
      body.appendChild(
        sec(
          "Result",
          (function () {
            var pv = h('<div class="td-preview"></div>');
            var pre = h('<pre class="td-result-text"></pre>');
            pre.textContent = ev.result || "";
            pv.appendChild(pre);
            return pv;
          })()
        )
      );
      if (ev.schema) {
        body.appendChild(
          sec(
            "Schema",
            (function () {
              var pv = h('<div class="td-preview td-schema"></div>');
              pv.appendChild(
                h(
                  '<div class="td-schema-intro"><div class="td-schema-name">' +
                    esc(ev.schema.name || "") +
                    '</div><div class="td-schema-desc">' +
                    esc(ev.schema.description || "") +
                    "</div></div>"
                )
              );
              pv.appendChild(h('<div class="td-schema-params-title">Parameters</div>'));
              pv.appendChild(renderJsonTree(ev.schema.parameters || {}, 0, true));
              return pv;
            })()
          )
        );
      }
      if (ev.timing) {
        body.appendChild(
          sec(
            "Timing",
            (function () {
              var pv = h('<div class="td-preview"></div>');
              pv.appendChild(
                h(
                  '<dl class="stats-details td-timing">' +
                    "<dt>Started</dt><dd>" +
                    esc(ev.timing.started) +
                    "</dd>" +
                    "<dt>Duration</dt><dd>" +
                    esc(ev.timing.duration) +
                    "</dd>" +
                    "<dt>Timing source</dt><dd>" +
                    esc(ev.timing.source) +
                    "</dd>" +
                    "</dl>"
                )
              );
              return pv;
            })()
          )
        );
      }
    } else if (tab === "payload") {
      var pv = h('<div class="td-preview"></div>');
      pv.appendChild(renderJsonTree(ev.payload || {}, 0, true));
      body.appendChild(pv);
    } else if (tab === "result") {
      var pr = h('<div class="td-preview"></div>');
      var pre = h('<pre class="td-result-text"></pre>');
      pre.textContent = ev.result || "";
      pr.appendChild(pre);
      body.appendChild(pr);
    } else if (tab === "schema") {
      var ps = h('<div class="td-preview td-schema"></div>');
      if (ev.schema) {
        ps.appendChild(
          h(
            '<div class="td-schema-intro"><div class="td-schema-name">' +
              esc(ev.schema.name || "") +
              '</div><div class="td-schema-desc">' +
              esc(ev.schema.description || "") +
              "</div></div>"
          )
        );
        ps.appendChild(h('<div class="td-schema-params-title">Parameters</div>'));
        ps.appendChild(renderJsonTree(ev.schema.parameters || {}, 0, true));
      } else {
        ps.appendChild(h('<div class="td-empty">No schema recorded for this tool call.</div>'));
      }
      body.appendChild(ps);
    } else if (tab === "timing") {
      var pt = h('<div class="td-preview"></div>');
      var timing = ev.timing || { started: "—", duration: "—", source: "Session timestamps" };
      pt.appendChild(
        h(
          '<dl class="stats-details td-timing">' +
            "<dt>Started</dt><dd>" +
            esc(timing.started) +
            "</dd>" +
            "<dt>Duration</dt><dd>" +
            esc(timing.duration) +
            "</dd>" +
            "<dt>Timing source</dt><dd>" +
            esc(timing.source) +
            "</dd>" +
            "</dl>"
        )
      );
      body.appendChild(pt);
    }
    aside.appendChild(body);
    $(".td-close", aside).addEventListener("click", function () {
      state.trajToolSel = null;
      renderChatLive();
    });
    var nav = $(".td-nav-link", aside);
    if (nav) {
      nav.addEventListener("click", function () {
        toast("Assistant Message — mock only");
      });
    }
    return aside;
  }

  function renderTrajectory(session) {
    var timeline = session.timeline || [];
    var wrap = h('<div class="traj-root"></div>');

    // ---- toolbar ----
    var toolbar = h(
      '<div class="traj-toolbar" role="toolbar" aria-label="Trajectory toolbar">' +
        '<div class="traj-actions">' +
        '<button type="button" class="traj-toggle' +
        (state.trajDuration ? " active" : "") +
        '" aria-pressed="' +
        state.trajDuration +
        '" title="Use actual duration">' +
        ic("clock", { w: 12, h: 12 }) +
        "<span>Duration</span></button>" +
        '<button type="button" class="traj-switch" role="switch" aria-checked="false"' +
        (state.trajDuration ? "" : " hidden") +
        '><span>Actual time</span><span class="traj-track"><span class="traj-thumb"></span></span></button>' +
        '<button type="button" class="traj-action" aria-label="Collapse turns" title="Collapse turns"><span class="traj-action-icon">⊟</span><span>Turns</span></button>' +
        '<button type="button" class="traj-action" aria-label="Collapse calls" title="Collapse calls"><span class="traj-action-icon">⊟</span><span>Calls</span></button>' +
        "</div>" +
        '<div class="traj-search">' +
        ic("search", { w: 11, h: 11 }) +
        '<input type="text" class="traj-search-input" aria-label="Search trajectory" placeholder="Search" value="' +
        esc(state.trajSearch || "") +
        '">' +
        "</div>" +
        "</div>"
    );
    wrap.appendChild(toolbar);

    // ---- gantt chart ----
    var gantt = h(
      '<section class="traj-gantt">' +
        '<div class="traj-plot">' +
        '<div class="traj-lane-labels"><span>Input</span><span>Model</span><span>Tools</span></div>' +
        '<div class="traj-track">' +
        '<button type="button" class="traj-earlier" title="Load earlier history">…</button>' +
        '<div class="traj-bounds"></div>' +
        '<div class="traj-lanes"></div>' +
        "</div>" +
        "</div>" +
        "</section>"
    );
    var lanesEl = $(".traj-lanes", gantt);
    var boundsEl = $(".traj-bounds", gantt);
    var seenTurns = {};
    timeline.forEach(function (ev, idx) {
      if (ev.kind === "tool") {
        var span = h(
          '<span class="traj-span" data-lane="2" title="' +
            esc(ev.name) +
            '"></span>'
        );
        span.style.left = (ev.start || 0) + "%";
        span.style.width = Math.max((ev.end || 0) - (ev.start || 0), 0.8) + "%";
        lanesEl.appendChild(span);
      } else {
        var span2 = h('<span class="traj-span" data-lane="1"></span>');
        span2.style.left = (ev.start || 0) + "%";
        span2.style.width = Math.max((ev.end || 0) - (ev.start || 0), 0.8) + "%";
        lanesEl.appendChild(span2);
        if (ev.turn && !seenTurns[ev.turn]) {
          seenTurns[ev.turn] = true;
          var boundary = h('<span class="traj-boundary" data-turn="' + ev.turn + '"></span>');
          boundary.style.left = (ev.start || 0) + "%";
          boundsEl.appendChild(boundary);
        }
      }
    });
    $(".traj-earlier", gantt).addEventListener("click", function () {
      toast("Load earlier history — mock only");
    });
    wrap.appendChild(gantt);

    // ---- timeline table ----
    var query = (state.trajSearch || "").toLowerCase();
    var ledger = h('<div class="traj-ledger"></div>');
    var tablePane = h('<div class="traj-table-pane"></div>');
    var table = h(
      '<table class="traj-table"><colgroup><col class="traj-col-event"><col class="traj-col-content"></colgroup><tbody></tbody></table>'
    );
    var tbody = $("tbody", table);
    var loadRow = h(
      '<tr class="traj-load-row"><td colspan="2"><button type="button" class="traj-load-btn">Load earlier history</button></td></tr>'
    );
    tbody.appendChild(loadRow);
    timeline.forEach(function (ev, idx) {
      var row = document.createElement("tr");
      if (ev.kind === "tool") {
        row.setAttribute("aria-label", "TOOL, " + ev.name + " " + trajPayloadSummary(ev));
        var eventTd = h(
          '<td class="traj-event"><div class="traj-event-inner"><span class="kind-tag tool-amber">TOOL</span></div></td>'
        );
        var contentTd = h(
          '<td class="traj-content"><span class="traj-result-preview" title="' +
            esc(trajPayloadSummary(ev)) +
            '"><span class="traj-tool-request"><span class="traj-tool-name">' +
            esc(ev.name) +
            '</span><span class="traj-tool-payload">' +
            esc(trajPayloadSummary(ev)) +
            '</span></span><span class="traj-inline-result"><span class="traj-arrow">→</span><span class="traj-inline-text">' +
            esc(trajResultSummary(ev)) +
            "</span></span></td>"
        );
        row.appendChild(eventTd);
        row.appendChild(contentTd);
        row.addEventListener("click", function () {
          state.trajToolSel = ev;
          renderChatLive();
        });
      } else {
        row.setAttribute(
          "aria-label",
          "Request " + (ev.request || idx) + ", ASSISTANT, " + (ev.text || "").slice(0, 40)
        );
        var evTd = h(
          '<td class="traj-event"><button type="button" class="traj-request-btn" aria-label="Request #' +
            (ev.request || idx) +
            '">#' +
            (ev.request || idx) +
            '</button><div class="traj-event-inner"><span class="kind-tag assistant-violet">ASSISTANT</span></div></td>'
        );
        var cTd = h(
          '<td class="traj-content"><span class="traj-content-text"' +
            ' title="' +
            esc(ev.text || "") +
            '">' +
            (ev.toolCallOnly ? '<span class="traj-tool-only">(tool call only)</span>' : esc(ev.text || "")) +
            "</span></td>"
        );
        row.appendChild(evTd);
        row.appendChild(cTd);
      }
      if (query && !(row.getAttribute("aria-label") || "").toLowerCase().includes(query)) return;
      tbody.appendChild(row);
    });
    $(".traj-load-btn", loadRow).addEventListener("click", function () {
      toast("Load earlier history — mock only");
    });
    tablePane.appendChild(table);
    ledger.appendChild(tablePane);
    if (state.trajToolSel) {
      ledger.appendChild(trajToolDetails(state.trajToolSel));
    }
    wrap.appendChild(ledger);

    // bindings
    $(".traj-toggle", toolbar).addEventListener("click", function () {
      state.trajDuration = !state.trajDuration;
      renderChatLive();
    });
    $all(".traj-action", toolbar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        toast(btn.getAttribute("aria-label") + " — mock only");
      });
    });
    var searchInput = $(".traj-search-input", toolbar);
    var debounce = null;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        state.trajSearch = searchInput.value;
        renderChatLive();
        var again = $(".traj-search-input");
        if (again) {
          again.focus();
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }, 120);
    });

    // scroll to previously selected tool row
    if (state.trajToolSel) {
      var pane = tablePane;
      requestAnimationFrame(function () {
        var rows = $all("tr", pane);
        for (var i = 0; i < rows.length; i++) {
          var label = rows[i].getAttribute("aria-label") || "";
          if (label.startsWith("TOOL") && label.includes(trajPayloadSummary(state.trajToolSel).slice(0, 20))) {
            rows[i].scrollIntoView({ block: "center" });
            rows[i].classList.add("selected");
            break;
          }
        }
      });
    }
    return wrap;
  }

  /* ==================== mini markdown ==================== */
  function mdInline(text) {
    // inline code
    text = text.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    // bold
    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    // links [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return text;
  }

  /* document-grade markdown (file preview): headings / hr / blockquote / tables */
  function docMarkdown(src) {
    var text = esc(src || "");
    text = text.replace(/```([\w]*)\n([\s\S]*?)```/g, function (m, lang, code) {
      return "<pre><code>" + code.replace(/\n$/, "") + "</code></pre>";
    });
    var lines = text.split("\n");
    var html = "";
    var inUl = false,
      inOl = false,
      inQuote = false;
    var closeLists = function () {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (inOl) { html += "</ol>"; inOl = false; }
    };
    var closeQuote = function () {
      if (inQuote) { html += "</blockquote>"; inQuote = false; }
    };
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      var quote = line.match(/^&gt;\s?(.*)$/);
      var table = line.match(/^\s*\|(.+)\|\s*$/);
      var nextTable = lines[i + 1] && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]);
      if (h) {
        closeLists();
        closeQuote();
        var level = Math.min(h[1].length + 1, 4);
        html += "<h" + level + ">" + mdInline(h[2]) + "</h" + level + ">";
      } else if (/^\s*---+\s*$/.test(line)) {
        closeLists();
        closeQuote();
        html += "<hr>";
      } else if (quote) {
        closeLists();
        if (!inQuote) { html += "<blockquote>"; inQuote = true; }
        html += "<p>" + mdInline(quote[1]) + "</p>";
      } else if (table && nextTable) {
        closeLists();
        closeQuote();
        var headers = table[1].split("|").map(function (s) { return s.trim(); });
        html += '<table><thead><tr>' + headers.map(function (c) { return "<th>" + mdInline(c) + "</th>"; }).join("") + "</tr></thead>";
        i += 1; // skip separator
        while (i + 1 < lines.length && /^\s*\|(.+)\|\s*$/.test(lines[i + 1])) {
          i += 1;
          var cells = lines[i].match(/^\s*\|(.+)\|\s*$/)[1].split("|").map(function (s) { return s.trim(); });
          html += "<tr>" + cells.map(function (c) { return "<td>" + mdInline(c) + "</td>"; }).join("") + "</tr>";
        }
        html += "</tbody></table>";
      } else {
        var ul = line.match(/^\s*[-*]\s+(.*)$/);
        var ol = line.match(/^\s*\d+\.\s+(.*)$/);
        if (ul) {
          closeQuote();
          if (inOl) { html += "</ol>"; inOl = false; }
          if (!inUl) { html += "<ul>"; inUl = true; }
          html += "<li>" + mdInline(ul[1]) + "</li>";
        } else if (ol) {
          closeQuote();
          if (inUl) { html += "</ul>"; inUl = false; }
          if (!inOl) { html += "<ol>"; inOl = true; }
          html += "<li>" + mdInline(ol[1]) + "</li>";
        } else {
          closeLists();
          closeQuote();
          if (line.trim() === "") {
            // paragraph break
          } else {
            html += "<p>" + mdInline(line) + "</p>";
          }
        }
      }
    }
    closeLists();
    closeQuote();
    return html;
  }

  function miniMarkdown(src) {
    var text = esc(src || "");
    // code blocks
    text = text.replace(/```([\w]*)\n([\s\S]*?)```/g, function (m, lang, code) {
      return "<pre><code>" + code.replace(/\n$/, "") + "</code></pre>";
    });
    text = mdInline(text);
    // lists
    var lines = text.split("\n");
    var html = "";
    var inUl = false,
      inOl = false;
    lines.forEach(function (line) {
      var ul = line.match(/^\s*[-*]\s+(.*)$/);
      var ol = line.match(/^\s*\d+\.\s+(.*)$/);
      if (ul) {
        if (!inUl) {
          html += "<ul>";
          inUl = true;
        }
        html += "<li>" + ul[1] + "</li>";
      } else if (ol) {
        if (inUl) {
          html += "</ul>";
          inUl = false;
        }
        if (!inOl) {
          html += "<ol>";
          inOl = true;
        }
        html += "<li>" + ol[1] + "</li>";
      } else {
        if (inUl) {
          html += "</ul>";
          inUl = false;
        }
        if (inOl) {
          html += "</ol>";
          inOl = false;
        }
        if (line.trim() === "") {
          html += "";
        } else {
          html += "<p>" + line + "</p>";
        }
      }
    });
    if (inUl) html += "</ul>";
    if (inOl) html += "</ol>";
    return html;
  }

  /* ==================== send / stream ==================== */
  function sendMessage() {
    if (state.streaming) {
      cancelStreaming();
      return;
    }
    var text = (composerInput ? composerInput.textContent : "").trim();
    if (!text) {
      toast("Type a message first");
      return;
    }
    var session = state.session;
    if (!session) {
      // fresh session without messages: make sure it exists
      var ws = activeWorkspace();
      var id = "s-" + Date.now();
      ws.sessions = ws.sessions || [];
      ws.sessions.unshift({ id: id, title: text.slice(0, 24), time: "now", pinned: false });
      state.sessions[id] = { id: id, title: text.slice(0, 24), messages: [], trajectory: [] };
      selectSession(ws.id, id);
      session = state.sessions[id];
    }
    session.messages.push({ role: "user", text: text, time: nowTime() });
    composerInput.textContent = "";
    state.composerText = "";

    // first message names the session, like the original
    var meta0 = activeSessionMeta();
    if (meta0 && (!meta0.title || meta0.title === "New Session")) {
      meta0.title = text.length > 24 ? text.slice(0, 24) + "…" : text;
      session.title = meta0.title;
      renderSidebar();
    }

    var assistant = {
      role: "assistant",
      streaming: true,
      duration: null,
      blocks: [],
    };
    session.messages.push(assistant);
    state.streamingMsg = assistant;
    state.streamStatus = "Deep diving";
    state.chatTab = "chat";
    refreshComposer();
    renderCenter();

    fetch("api/sessions/" + session.id + "/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        var events = (res && res.events) || [];
        var currentGroup = null;
        var handle = window.MockStream.run(events, {
          onStatus: function (t) {
            state.streamStatus = t || "Deep diving";
            updateStreamingIndicator();
          },
          onGroupStart: function (ev) {
            currentGroup = { type: "group", gid: "sg" + Math.random().toString(36).slice(2), label: ev.label, icon: ev.icon, children: [] };
            assistant.blocks.push(currentGroup);
            renderChatLive();
          },
          onThink: function (t) {
            if (!currentGroup) {
              currentGroup = { type: "group", gid: "sg" + Math.random().toString(36).slice(2), label: "Thinking", icon: "sparkle", children: [] };
              assistant.blocks.push(currentGroup);
            }
            currentGroup.children.push({ type: "think", text: t });
            renderChatLive();
          },
          onTool: function (ev) {
            if (!currentGroup) {
              currentGroup = { type: "group", gid: "sg" + Math.random().toString(36).slice(2), label: "Tool calls", icon: "terminal", children: [] };
              assistant.blocks.push(currentGroup);
            }
            var tool = { type: "tool", name: ev.name, args: ev.args, status: "running" };
            currentGroup.children.push(tool);
            renderChatLive();
            setTimeout(function () {
              tool.status = ev.status || "success";
              renderChatLive();
            }, 650);
          },
          onText: function (t) {
            currentGroup = null;
            var last = assistant.blocks[assistant.blocks.length - 1];
            if (last && last.type === "text") {
              last.text += t;
            } else {
              assistant.blocks.push({ type: "text", text: t });
            }
            renderChatLive();
          },
          onDeliverables: function (ev) {
            currentGroup = null;
            assistant.deliverables = { files: ev.files || [], note: ev.note || "" };
            renderChatLive();
          },
          onTodos: function (ev) {
            currentGroup = null;
            session.todos = ev.items || [];
            refreshTodosCard();
            renderChatLive();
          },
          onDone: function (ev) {
            assistant.duration = ev.duration || "8s";
            if (ev.usage) {
              assistant.usage = ev.usage;
              assistant.endInfo = nowDate() + " " + nowTime();
            }
            if (ev.stats) {
              session.stats = ev.stats;
            }
            finishStreaming();
          },
        });
        state.streaming = handle;
      })
      .catch(function (err) {
        console.error(err);
        finishStreaming();
        toast("Mock request failed");
      });
  }

  function cancelStreaming() {
    if (state.streaming) {
      state.streaming.cancel();
      state.streaming = null;
    }
    if (state.streamingMsg) {
      state.streamingMsg.streaming = false;
      state.streamingMsg.duration = state.streamingMsg.duration || "stopped";
      state.streamingMsg = null;
    }
    refreshComposer();
    renderCenter();
  }

  function finishStreaming() {
    if (state.streamingMsg) {
      state.streamingMsg.streaming = false;
      state.streamingMsg = null;
    }
    state.streaming = null;
    refreshComposer();
    renderCenter();
  }

  function renderChatLive() {
    var column = $(".chat-column");
    if (!column) return;
    var meta = activeSessionMeta();
    renderChatColumn(column, meta);
    refreshTodosCard();
    column.parentNode.scrollTop = column.parentNode.scrollHeight;
  }

  function updateStreamingIndicator() {
    var ind = $(".streaming-indicator span:last-child");
    if (ind) ind.textContent = state.streamStatus || "Deep diving";
  }

  function updateDock(dock) {
    var session = state.session;
    var st = (session && session.stats) || { turns: 0, steps: 0, tokPerSec: 0, tokens: "0", cacheHit: "0%", context: 1 };
    dock.innerHTML =
      '<button type="button" class="pill action" aria-haspopup="dialog">' +
      ic("gauge", { w: 14, h: 14 }) +
      "<span>" +
      st.turns +
      " turns " +
      st.steps +
      ' steps<span class="pill-sep">·</span>' +
      st.tokPerSec +
      " tok/s</span></button>" +
      '<button type="button" class="pill action" aria-haspopup="dialog">' +
      ic("usage", { w: 14, h: 14 }) +
      "<span>" +
      esc(st.tokens) +
      " tok · Cache hit " +
      esc(st.cacheHit) +
      "</span></button>" +
      '<span class="pill">' +
      '<span class="context-track"><div style="width:' +
      (st.context || 1) +
      '%"></div></span>' +
      (st.context || 1) +
      "%</span>";
    var pills = $all(".pill", dock);
    if (pills[0]) {
      pills[0].addEventListener("click", function () {
        openStatsPanel(pills[0], "session-stats", st);
      });
    }
    if (pills[1]) {
      pills[1].addEventListener("click", function () {
        openStatsPanel(pills[1], "token-usage", st.tokenUsage || st);
      });
    }
    if (pills[2]) {
      pills[2].addEventListener("click", function () {
        openStatsPanel(pills[2], "context", st.contextUsage || { percent: (st.context || 1) + "%", figures: "~1M", rows: [] });
      });
    }
  }

  /* ==================== plugins page ==================== */
  function renderPluginsPage() {
    var enabled = state.boot.plugins.filter(function (p) {
      return state.pluginToggles[p.id];
    }).length;
    var page = h(
      '<section class="plugins-page">' +
        '<div class="plugins-head">' +
        "<div>" +
        '<div class="plugins-title">Plugins</div>' +
        '<div class="plugins-sub">Install, enable, and configure plugins</div>' +
        "</div>" +
        '<div class="plugins-toolbar">' +
        '<button type="button" class="icon-button refresh-plugins" aria-label="Refresh">' +
        ic("refresh", { w: 16, h: 16 }) +
        "</button>" +
        '<button type="button" class="solid-button add-plugin">' +
        ic("addPlugin", { w: 13, h: 13 }) +
        "<span>+ Add plugin</span>" +
        "</button>" +
        "</div>" +
        "</div>" +
        '<div class="plugins-group">' +
        '<div class="plugins-group-head">Official <span class="plugins-group-count">' +
        state.boot.plugins.length +
        "</span></div>" +
        '<div class="plugin-list"></div>' +
        "</div>" +
        "</section>"
    );
    var list = $(".plugin-list", page);
    state.boot.plugins.forEach(function (p) {
      var on = !!state.pluginToggles[p.id];
      var card = h(
        '<div class="plugin-card" data-plugin="' +
          esc(p.id) +
          '">' +
          '<span class="pc-icon">' +
          ic(p.icon, { w: 36, h: 36 }) +
          "</span>" +
          '<div class="pc-main">' +
          '<div class="pc-title">' +
          esc(p.name) +
          (p.experimental ? '<span class="exp-badge">Experimental</span>' : "") +
          "</div>" +
          '<div class="pc-desc">' +
          esc(p.desc) +
          "</div>" +
          "</div>" +
          '<button type="button" class="switch' +
          (on ? " on" : "") +
          '" role="switch" aria-checked="' +
          (on ? "true" : "false") +
          '" aria-label="Enable ' +
          esc(p.name) +
          '"><span class="knob"></span></button>' +
          "</div>"
      );
      $(".switch", card).addEventListener("click", function (e) {
        e.stopPropagation();
        state.pluginToggles[p.id] = !state.pluginToggles[p.id];
        toast(p.name + (state.pluginToggles[p.id] ? " enabled" : " disabled"));
        renderCenter();
      });
      list.appendChild(card);
    });
    $(".refresh-plugins", page).addEventListener("click", function () {
      toast("Plugin list refreshed");
    });
    $(".add-plugin", page).addEventListener("click", function () {
      toast("Add plugin — mock only");
    });
    return page;
  }

  /* ==================== settings ==================== */
  function openSettings() {
    state.settingsOpen = true;
    renderSettings();
  }
  function closeSettings() {
    state.settingsOpen = false;
    var m = $(".modal-mask");
    if (m) m.remove();
  }

  function renderSettings() {
    closeSettings();
    var mask = h('<div class="modal-mask"></div>');
    var panel = h('<div class="dialog-panel settings-panel" role="dialog" aria-label="Settings"></div>');

    var nav = h('<nav class="settings-nav"></nav>');
    nav.appendChild(h('<div class="settings-nav-title">Settings</div>'));
    var navItems = [
      { id: "general", label: "General", icon: "navGeneral" },
      { id: "models", label: "Models", icon: "navModels" },
      { id: "plugins", label: "Built-in plugins", icon: "navPlugins" },
      { id: "presets", label: "Agent presets", icon: "navPresets" },
    ];
    navItems.forEach(function (n) {
      var cell = h(
        '<button type="button" class="settings-nav-cell' +
          (state.settingsTab === n.id ? " active" : "") +
          '" data-tab="' +
          n.id +
          '">' +
          '<span class="nav-icon">' +
          ic(n.icon, { w: 16, h: 16 }) +
          "</span>" +
          "<span>" +
          esc(n.label) +
          "</span>" +
          "</button>"
      );
      cell.addEventListener("click", function () {
        state.settingsTab = n.id;
        renderSettings();
      });
      nav.appendChild(cell);
    });
    panel.appendChild(nav);

    var content = h('<div class="settings-content"></div>');
    panel.appendChild(content);
    mask.appendChild(panel);
    mask.addEventListener("mousedown", function (e) {
      if (e.target === mask) closeSettings();
    });
    $("#overlay-layer").appendChild(mask);
    renderSettingsContent(content);
  }

  function renderSettingsContent(content) {
    var s = state.settings;
    content.innerHTML = "";
    var header = h(
      '<div class="settings-header">' +
        '<div class="settings-page-title">' +
        esc(state.settingsTab === "general" ? "General" : state.settingsTab === "models" ? "Models" : state.settingsTab === "plugins" ? "Built-in plugins" : "Agent presets") +
        "</div>" +
        '<div class="settings-actions">' +
        '<button type="button" class="outline-button open-config">Open configuration file</button>' +
        '<button type="button" class="settings-close" aria-label="Close">' +
        ic("close", { w: 14, h: 14 }) +
        "</button>" +
        "</div>" +
        "</div>"
    );
    content.appendChild(header);
    $(".settings-close", header).addEventListener("click", closeSettings);
    $(".open-config", header).addEventListener("click", function () {
      toast("Opening configuration file — mock only");
    });

    if (state.settingsTab === "general") {
      content.appendChild(
        h(
          '<div class="settings-section">' +
            row(
              "Permission",
              "Choose the default permission mode for new sessions",
              '<button type="button" class="select-button perm-select">' +
                "<span>" +
                esc(accessName(s.permission)) +
                "</span>" +
                ic("chevronDown14", { w: 14, h: 14 }) +
                "</button>"
            ) +
            row(
              "Language",
              "",
              '<button type="button" class="select-button lang-select">' +
                "<span>" +
                esc(langName(s.language)) +
                "</span>" +
                ic("chevronDown14", { w: 14, h: 14 }) +
                "</button>"
            ) +
            '<div class="settings-section-title" style="margin-top:18px">Appearance</div>' +
            '<div class="appearance-cubes">' +
            cube("light", "Light", "sun") +
            cube("dark", "Dark", "moon") +
            cube("system", "System", "monitor") +
            "</div>" +
            row(
              "Font size",
              "Only affects conversation content",
              '<span style="display:flex;align-items:center;gap:4px">' +
                '<button type="button" class="icon-button font-down" aria-label="Decrease font size">' +
                ic("fontDown", { w: 9, h: 16 }) +
                "</button>" +
                '<span style="min-width:44px;text-align:center;font-size:13px">' +
                s.fontSize +
                ' px</span>' +
                '<button type="button" class="icon-button font-up" aria-label="Increase font size">' +
                ic("fontUp", { w: 9, h: 16 }) +
                "</button>" +
                "</span>"
            ) +
            row(
              "Work details",
              "Choose how much detail to show for tool calls",
              '<button type="button" class="select-button work-select">' +
                "<span>" +
                esc(workName(s.workDetails)) +
                "</span>" +
                ic("chevronDown14", { w: 14, h: 14 }) +
                "</button>"
            ) +
            '<div class="settings-row"><div class="settings-row-text"><div class="settings-row-label">Show coding view</div><div class="settings-row-desc">Shows trajectory, code diffs, and Agent presets</div></div><div class="settings-row-control"><button type="button" class="switch' +
            (s.showCodingView ? " on" : "") +
            '" role="switch" aria-checked="' +
            (s.showCodingView ? "true" : "false") +
            '"><span class="knob"></span></button></div></div>' +
            '<div class="settings-row"><div class="settings-row-text"><div class="settings-row-label">Keyboard shortcuts</div><div class="settings-row-desc">Review and customize shortcuts</div></div><div class="settings-row-control"><button type="button" class="outline-button edit-shortcuts">Edit shortcuts</button></div></div>' +
            "</div>"
        )
      );
      function row(label, desc, controlHtml) {
        return (
          '<div class="settings-row"><div class="settings-row-text"><div class="settings-row-label">' +
          label +
          "</div>" +
          (desc ? '<div class="settings-row-desc">' + desc + "</div>" : "") +
          '</div><div class="settings-row-control">' +
          controlHtml +
          "</div></div>"
        );
      }
      function cube(id, label, iconName) {
        return (
          '<button type="button" class="cube' +
          (s.appearance === id ? " active" : "") +
          '" data-appearance="' +
          id +
          '"><span class="cube-icon">' +
          ic(iconName, { w: 20, h: 20 }) +
          "</span><span>" +
          label +
          "</span></button>"
        );
      }

      $(".perm-select", content).addEventListener("click", function (e) {
        openMenu(e.currentTarget, {
          align: "right",
          items: state.boot.accessModes.map(function (m) {
            return {
              label: m.name,
              checked: m.id === s.permission,
              onSelect: function () {
                s.permission = m.id;
                state.accessMode = m.id;
                applySettings();
              },
            };
          }),
        });
      });
      $(".lang-select", content).addEventListener("click", function (e) {
        openMenu(e.currentTarget, {
          align: "right",
          items: state.boot.languages.map(function (l) {
            return {
              label: l.name,
              checked: l.id === s.language,
              onSelect: function () {
                s.language = l.id;
                applySettings();
              },
            };
          }),
        });
      });
      $(".work-select", content).addEventListener("click", function (e) {
        openMenu(e.currentTarget, {
          align: "right",
          items: state.boot.workDetailsOptions.map(function (w) {
            return {
              label: w.name,
              checked: w.id === s.workDetails,
              onSelect: function () {
                s.workDetails = w.id;
                applySettings();
              },
            };
          }),
        });
      });
      $all("[data-appearance]", content).forEach(function (c) {
        c.addEventListener("click", function () {
          s.appearance = c.getAttribute("data-appearance");
          applySettings();
        });
      });
      $(".font-down", content).addEventListener("click", function () {
        s.fontSize = Math.max(10, s.fontSize - 1);
        applySettings();
      });
      $(".font-up", content).addEventListener("click", function () {
        s.fontSize = Math.min(20, s.fontSize + 1);
        applySettings();
      });
      $(".switch", content).addEventListener("click", function () {
        s.showCodingView = !s.showCodingView;
        applySettings();
      });
      $(".edit-shortcuts", content).addEventListener("click", function () {
        toast("Shortcut editor — mock only");
      });
    } else if (state.settingsTab === "models") {
      content.appendChild(
        h(
          '<div class="settings-section">' +
            '<div class="settings-row-desc" style="margin:4px 0 2px">Enter your API keys to use models from the following providers.</div>' +
            '<div class="model-provider-row">' +
            '<span class="provider-dot"></span>' +
            '<div style="flex:1"><div class="provider-name">DeepSeek</div><div class="provider-sub">API key configured</div></div>' +
            '<button type="button" class="outline-button edit-provider">Edit</button>' +
            "</div>" +
            '<button type="button" class="add-provider">' +
            ic("plus", { w: 14, h: 14 }) +
            "<span>+ Add model provider</span>" +
            "</button>" +
            "</div>"
        )
      );
      $(".edit-provider", content).addEventListener("click", function () {
        toast("Provider editor — mock only");
      });
      $(".add-provider", content).addEventListener("click", function () {
        toast("Add provider — mock only");
      });
    } else if (state.settingsTab === "plugins") {
      var wrap = h('<div class="settings-section"><div class="plugin-list"></div></div>');
      state.boot.plugins.forEach(function (p) {
        var on = !!state.pluginToggles[p.id];
        var card = h(
          '<div class="plugin-card" style="box-shadow:0 0 0 1px var(--border)">' +
            '<span class="pc-icon">' +
            ic(p.icon, { w: 32, h: 32 }) +
            "</span>" +
            '<div class="pc-main"><div class="pc-title">' +
            esc(p.name) +
            (p.experimental ? '<span class="exp-badge">Experimental</span>' : "") +
            '</div><div class="pc-desc">' +
            esc(p.desc) +
            "</div></div>" +
            '<button type="button" class="switch' +
            (on ? " on" : "") +
            '" role="switch" aria-checked="' +
            (on ? "true" : "false") +
            '"><span class="knob"></span></button>' +
            "</div>"
        );
        $(".switch", card).addEventListener("click", function () {
          state.pluginToggles[p.id] = !state.pluginToggles[p.id];
          renderSettings();
          if (state.view === "plugins") renderCenter();
        });
        $(".plugin-list", wrap).appendChild(card);
      });
      content.appendChild(wrap);
    } else {
      content.appendChild(
        h(
          '<div class="settings-section">' +
            '<div class="settings-row-desc" style="margin:4px 0 12px">Presets capture a mode, model, and permission set you can reuse across sessions.</div>' +
            '<button type="button" class="add-provider">' +
            ic("plus", { w: 14, h: 14 }) +
            "<span>+ New agent preset</span>" +
            "</button>" +
            "</div>"
        )
      );
      $(".add-provider", content).addEventListener("click", function () {
        toast("New preset — mock only");
      });
    }
  }

  function applySettings() {
    applyAppearance(state.settings.appearance);
    renderSettings();
    refreshComposer();
    renderCenter();
    renderSidebar();
  }

  function langName(id) {
    var l = state.boot.languages.filter(function (x) {
      return x.id === id;
    })[0];
    return l ? l.name : id;
  }
  function workName(id) {
    var w = state.boot.workDetailsOptions.filter(function (x) {
      return x.id === id;
    })[0];
    return w ? w.name : id;
  }

  /* ==================== right sidebar ==================== */
  /* ==================== right bar: multi-tab file viewer ==================== */

  function fileTabTitle(path) {
    var parts = String(path).split("/");
    return parts[parts.length - 1];
  }

  function openFileTab(path) {
    var rb = state.rightbar;
    var id = path === "files" ? "files" : path;
    var found = null;
    rb.tabs.forEach(function (t) {
      if (t.id === id) found = t;
    });
    if (!found) {
      var tab = { id: id, kind: path === "files" ? "files" : "file", path: path };
      rb.tabs.push(tab);
      found = tab;
    }
    rb.active = id;
    if (!state.rightbarOpen) {
      state.rightbarOpen = true;
      renderCenter();
    }
    renderRightbar();
  }

  function closeFileTab(id) {
    var rb = state.rightbar;
    var idx = -1;
    rb.tabs.forEach(function (t, i) {
      if (t.id === id) idx = i;
    });
    if (idx === -1) return;
    rb.tabs.splice(idx, 1);
    if (rb.active === id) {
      var next = rb.tabs[Math.min(idx, rb.tabs.length - 1)];
      rb.active = next ? next.id : null;
    }
    renderRightbar();
  }

  function ensureFileTree(cb) {
    if (state.fileTree) {
      cb(state.fileTree);
      return;
    }
    apiGet("mock/workspace-files.json").then(function (data) {
      state.fileTree = data.root;
      cb(data.root);
    }, function () {
      toast("Failed to load workspace files");
    });
  }

  function fileIconFor(name, type) {
    var lower = String(name).toLowerCase();
    if (type === "folder") return "folder";
    if (/\.(vb|vbproj|cs|js|ts|json|xml|config)$/.test(lower)) return "codeFile";
    return "file";
  }

  function fileNode(node, depth, container) {
    var path = node.path;
    var expanded = !!state.fileExpanded[path];
    var row = document.createElement("div");
    row.className = "ftree-row";
    row.setAttribute("role", "treeitem");
    if (node.type === "folder") {
      row.setAttribute("aria-expanded", expanded ? "true" : "false");
    }
    var pad = 8 + depth * 14;
    var inner =
      '<span class="ftree-chevron" style="width:14px;height:14px;visibility:' +
      (node.type === "folder" ? "visible" : "hidden") +
      '">' +
      (expanded ? ic("chevronDown14", { w: 14, h: 14 }) : ic("chevronRight14", { w: 14, h: 14 })) +
      "</span>" +
      '<span class="ftree-icon">' +
      ic(node.type === "folder" ? (expanded ? "folderOpen" : "folder") : fileIconFor(node.name, node.type), { w: 16, h: 16 }) +
      "</span>" +
      '<span class="ftree-name">' +
      esc(node.name) +
      "</span>";
    row.innerHTML = inner;
    row.style.paddingLeft = pad + "px";
    container.appendChild(row);
    if (node.type === "folder") {
      row.addEventListener("click", function () {
        state.fileExpanded[path] = !expanded;
        renderRightbar();
      });
      if (expanded && node.children && node.children.length) {
        var kids = h('<div class="ftree-children" role="group"></div>');
        container.appendChild(kids);
        node.children.forEach(function (child) {
          fileNode(
            Object.assign({}, child, { path: node.path + "/" + child.name }),
            depth + 1,
            kids
          );
        });
      }
    } else {
      row.addEventListener("click", function () {
        openFileTab(path);
      });
    }
  }

  function renderFilesTab(container) {
    ensureFileTree(function (root) {
      container.appendChild(
        h(
          '<div class="fpreview-head">' +
            '<span class="fpreview-path">' +
            esc(root.name) +
            "</span>" +
            '<button type="button" class="icon-button fp-tool" aria-label="Reload" title="Reload">' +
            ic("refresh", { w: 15, h: 15 }) +
            "</button>" +
            "</div>"
        )
      );
      var body = h('<div class="ftree-body" role="tree" aria-label="Workspace files"></div>');
      var list = h('<div class="ftree-level" role="group"></div>');
      (root.children || []).forEach(function (child) {
        var withPath = Object.assign({}, child, {
          path: root.name + "/" + child.name,
        });
        fileNode(withPath, 0, list);
      });
      body.appendChild(list);
      container.appendChild(body);
      var reload = $(".fp-tool", container);
      if (reload) {
        reload.addEventListener("click", function () {
          state.fileTree = null;
          renderRightbar();
        });
      }
    });
  }

  /* --- lightweight syntax highlighter (vb / xml / md fences) --- */
  function highlightCode(code, lang) {
    var lines = String(code).replace(/\r\n/g, "\n").split("\n");
    var KEYWORDS =
      /\b(Public|Private|Friend|Module|Class|Sub|Function|End|Dim|As|New|If|Then|ElseIf|Else|For|Each|Next|While|Do|Loop|Return|Call|Imports|Implements|Inherits|Const|Enum|Structure|Try|Catch|Finally|Throw|Select|Case|AndAlso|OrElse|Not|And|Or|True|False|Nothing|Me|MyBase|ByVal|ByRef|Optional|Property|Get|Set|Interface|Namespace|Partial|Shared|Static|Using|With|Exit|Continue|DirectCast|CType|IsNot|Is|TypeOf|Project|PropertyGroup|ItemGroup|Reference|Include|HintPath)\b/g;
    var out = [];
    lines.forEach(function (line, i) {
      var safe = esc(line);
      if (lang === "xml") {
        safe = safe
          .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>')
          .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="tok-tag">$2</span>')
          .replace(/("[^"]*")/g, '<span class="tok-string">$1</span>');
      } else if (lang === "vb") {
        if (/^\s*'/.test(line)) {
          safe = '<span class="tok-comment">' + safe + "</span>";
        } else {
          safe = safe
            .replace(/("[^"]*")/g, '<span class="tok-string">$1</span>')
            .replace(KEYWORDS, '<span class="tok-keyword">$1</span>')
            .replace(/('[^<]*)/g, '<span class="tok-comment">$1</span>')
            .replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="tok-number">$1</span>');
        }
      } else {
        safe = safe
          .replace(/(#+ |```|\*\*[^*]+\*\*|`[^`]+`)/g, '<span class="tok-keyword">$1</span>')
          .replace(/(&gt;.*$)/g, '<span class="tok-comment">$1</span>');
      }
      out.push(
        '<div class="code-line"><span class="code-ln">' +
          (i + 1) +
          "</span>" +
          '<span class="code-text">' +
          (safe || "&nbsp;") +
          "</span></div>"
      );
    });
    return out.join("");
  }

  function renderFilePreview(container, path) {
    var loading = h('<div class="fpreview-loading">Loading…</div>');
    container.appendChild(loading);
    apiGet("mock/file-content.json?path=" + encodeURIComponent(path)).then(
      function (data) {
        state.fileCache[path] = data.file;
        renderFilePreviewBody(container, path, data.file);
      },
      function () {
        if (state.fileCache[path]) {
          renderFilePreviewBody(container, path, state.fileCache[path]);
        } else {
          loading.textContent = "No mock content for this file";
        }
      }
    );
  }

  function renderFilePreviewBody(container, path, file) {
    container.innerHTML = "";
    var dir = path.slice(0, path.lastIndexOf("/"));
    var name = fileTabTitle(path);
    var isMd = file.lang === "md";
    container.appendChild(
      h(
        '<div class="fpreview-head">' +
          '<span class="fpreview-path"><span class="fp-dir">' +
          esc(dir) +
          '/</span><span class="fp-name">' +
          esc(name) +
          "</span></span>" +
          '<button type="button" class="icon-button fp-tool" aria-label="Open with Code" title="Open with Code">' +
          ic("code", { w: 15, h: 15 }) +
          "</button>" +
          '<button type="button" class="icon-button fp-tool" aria-label="Line wrap" title="Line wrap">' +
          ic("wrap", { w: 15, h: 15 }) +
          "</button>" +
          '<button type="button" class="icon-button fp-tool" aria-label="Read again" title="Read again">' +
          ic("readAgain", { w: 15, h: 15 }) +
          "</button>" +
          '<button type="button" class="icon-button fp-tool" aria-label="Show file location" title="Show file location (default)">' +
          ic("fileLocation", { w: 15, h: 15 }) +
          "</button>" +
          '<button type="button" class="icon-button fp-tool" aria-label="More ways to open" title="More ways to open">' +
          ic("chevronDownTiny", { w: 12, h: 12 }) +
          "</button>" +
          '<button type="button" class="icon-button fp-tool" aria-label="Reload file" title="Read again">' +
          ic("refresh", { w: 15, h: 15 }) +
          "</button>" +
          "</div>"
      )
    );
    var body = h('<div class="fpreview-body"></div>');
    if (isMd) {
      var md = h('<div class="md-preview"></div>');
      md.innerHTML = docMarkdown(file.content);
      body.appendChild(md);
      body.classList.add("md-scroll");
    } else {
      var code = h('<div class="code-view" data-lang="' + esc(file.lang || "") + '"></div>');
      code.innerHTML = highlightCode(file.content, file.lang);
      body.appendChild(code);
    }
    container.appendChild(body);
    var tools = $all(".fp-tool", container);
    tools.forEach(function (btn) {
      btn.addEventListener("click", function () {
        toast(btn.getAttribute("aria-label") + " — mock only");
      });
    });
  }

  /* --- right bar width: user-resizable via the splitter --- */
  var RB_MIN = 240;
  var RB_DEFAULT = 300;
  var RB_MIN_CENTER = 360; // keep this much room for the chat column

  function rightbarMaxWidth() {
    var frame = $(".app-frame");
    if (!frame) return 800;
    var sidebar = $(".sidebar", frame);
    var reserved = (sidebar ? sidebar.getBoundingClientRect().width : 0) + RB_MIN_CENTER;
    return Math.max(RB_MIN, Math.round(frame.getBoundingClientRect().width - reserved));
  }

  function clampRightbarWidth(px) {
    return Math.max(RB_MIN, Math.min(Math.round(px), rightbarMaxWidth()));
  }

  function applyRightbarWidth(bar, px) {
    state.rightbarWidth = clampRightbarWidth(px);
    bar.style.width = state.rightbarWidth + "px";
    var handle = $(".rb-resize", bar);
    if (handle) {
      handle.setAttribute("aria-valuenow", state.rightbarWidth);
      handle.setAttribute("aria-valuemax", rightbarMaxWidth());
    }
    return state.rightbarWidth;
  }

  function bindRightbarResize(bar) {
    var handle = $(".rb-resize", bar);
    if (!handle) return;
    var dragging = false;
    var frame = $(".app-frame");

    function widthFromPointer(clientX) {
      var rect = frame.getBoundingClientRect();
      return clampRightbarWidth(rect.right - clientX);
    }

    handle.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      handle.classList.add("dragging");
      document.body.classList.add("rb-resizing");
      if (handle.setPointerCapture) {
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (err) {
          /* synthetic pointer or pointer already gone — drag still works */
        }
      }
      e.preventDefault();
    });

    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      applyRightbarWidth(bar, widthFromPointer(e.clientX));
    });

    function stopDrag(e) {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("dragging");
      document.body.classList.remove("rb-resizing");
      if (handle.releasePointerCapture && e && e.pointerId !== undefined) {
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (err) {
          /* pointer already released */
        }
      }
    }
    // pointer capture keeps delivering events to the handle even when the
    // pointer leaves it, so no global listeners (and no leaks) are needed
    handle.addEventListener("pointerup", stopDrag);
    handle.addEventListener("pointercancel", stopDrag);

    // double-click resets to the default width
    handle.addEventListener("dblclick", function () {
      applyRightbarWidth(bar, RB_DEFAULT);
      toast("Right panel width reset — " + RB_DEFAULT + "px");
    });

    // keyboard: arrow keys resize by 16px, Home resets
    handle.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft") {
        applyRightbarWidth(bar, state.rightbarWidth + step);
      } else if (e.key === "ArrowRight") {
        applyRightbarWidth(bar, state.rightbarWidth - step);
      } else if (e.key === "Home") {
        applyRightbarWidth(bar, RB_DEFAULT);
      } else {
        return;
      }
      e.preventDefault();
    });
  }

  function renderRightbar() {
    var frame = $(".app-frame");
    var existing = $(".rightbar", frame);
    if (existing) existing.remove();
    // a re-render drops the old handle; make sure no drag state leaks
    document.body.classList.remove("rb-resizing");
    if (!state.rightbarOpen) {
      return;
    }
    var rb = state.rightbar;
    var bar = h(
      '<aside class="rightbar" aria-label="Session panel">' +
        '<div class="rb-resize" role="separator" aria-orientation="vertical" tabindex="0" ' +
        'aria-label="Resize right panel" title="Drag to resize · double-click to reset"></div>' +
        '<div class="rb-strip"></div>' +
        '<div class="rb-body"></div>' +
        "</aside>"
    );
    var strip = $(".rb-strip", bar);
    var body = $(".rb-body", bar);

    // tab strip
    rb.tabs.forEach(function (tab) {
      var isFiles = tab.kind === "files";
      var el = h(
        '<button type="button" class="rb-tab' +
          (rb.active === tab.id ? " rb-tab-active" : "") +
          '" title="' +
          esc(isFiles ? "Files" : tab.path) +
          '">' +
          '<span class="rb-tab-icon">' +
          ic(isFiles ? "workspaceFiles" : "codeFile", { w: 14, h: 14 }) +
          "</span>" +
          "<span>" +
          esc(isFiles ? "Files" : fileTabTitle(tab.path)) +
          "</span>" +
          '<span class="rb-tab-close" title="Close">' +
          ic("close", { w: 10, h: 10 }) +
          "</span>" +
          "</button>"
      );
      el.addEventListener("click", function (e) {
        if (e.target.closest(".rb-tab-close")) {
          closeFileTab(tab.id);
        } else {
          rb.active = tab.id;
          renderRightbar();
        }
      });
      strip.appendChild(el);
    });

    var actions = h(
      '<div class="rb-strip-actions">' +
        '<button type="button" class="icon-button" aria-label="New tab" title="New tab">' +
        ic("newTab", { w: 15, h: 15 }) +
        "</button>" +
        '<button type="button" class="icon-button" aria-label="Split view" title="Split">' +
        ic("split", { w: 15, h: 15 }) +
        "</button>" +
        '<button type="button" class="icon-button" aria-label="Fullscreen" title="Fullscreen">' +
        ic("fullscreen", { w: 15, h: 15 }) +
        "</button>" +
        '<button type="button" class="icon-button rb-collapse" aria-label="Collapse sidebar" title="Collapse sidebar (Ctrl + Shift + B)">' +
        ic("collapseRight", { w: 15, h: 15 }) +
        "</button>" +
        "</div>"
    );
    strip.appendChild(actions);
    $(".rb-collapse", actions).addEventListener("click", function () {
      state.rightbarOpen = false;
      renderRightbar();
      renderCenter();
    });
    $all(".icon-button", actions).forEach(function (btn) {
      if (btn.classList.contains("rb-collapse")) return;
      btn.addEventListener("click", function () {
        toast(btn.getAttribute("aria-label") + " — mock only");
      });
    });

    // body
    var active = null;
    rb.tabs.forEach(function (tab) {
      if (tab.id === rb.active) active = tab;
    });
    if (!active) {
      body.appendChild(
        h(
          '<div class="start-hero">' +
            ic("compassBig", { w: 56, h: 56 }) +
            "<span>Pick a tool to get started</span>" +
            "</div>"
        )
      );
      state.boot.quickActions.forEach(function (q) {
        var card = h(
          '<div class="quick-card" role="button" tabindex="0">' +
            '<span class="qc-icon">' +
            ic(q.icon, { w: 26, h: 26 }) +
            "</span>" +
            '<div class="qc-text"><div class="qc-title">' +
            esc(q.title) +
            "</div>" +
            '<div class="qc-desc">' +
            esc(q.desc) +
            "</div></div>" +
            '<span class="qc-kbd kbd-hint">' +
            q.kbd
              .map(function (k, i) {
                return (i ? '<span class="kbd-sep">+</span>' : "") + '<kbd class="kbd">' + esc(k) + "</kbd>";
              })
              .join("") +
            "</span>" +
            "</div>"
        );
        function go() {
          if (q.id === "workspace-files" || /workspace files/i.test(q.title)) {
            openFileTab("files");
          } else {
            toast(q.title + " — mock only");
          }
        }
        card.addEventListener("click", go);
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter") go();
        });
        body.appendChild(card);
      });
    } else if (active.kind === "files") {
      renderFilesTab(body);
    } else {
      renderFilePreview(body, active.path);
    }
    frame.appendChild(bar);
    applyRightbarWidth(bar, state.rightbarWidth || RB_DEFAULT);
    bindRightbarResize(bar);
  }

  /* ==================== bindings ==================== */
  function bindCenter(col, meta, inChat) {
    var rightToggle = $(".rightbar-toggle", col);
    if (rightToggle) {
      rightToggle.addEventListener("click", function () {
        state.rightbarOpen = !state.rightbarOpen;
        renderRightbar();
        renderCenter();
      });
    }
    var wsChip = $(".workspace-chip", col);
    if (wsChip) {
      wsChip.addEventListener("click", function () {
        openWorkspaceMenuChip(wsChip);
      });
    }
    var modeChip = $(".mode-chip", col);
    if (modeChip) {
      modeChip.addEventListener("click", function () {
        openModeMenu(modeChip);
      });
    }
    if (inChat && meta) {
      var tabsHost = $(".tabs", col);
      $all(".tab", tabsHost).forEach(function (t) {
        t.addEventListener("click", function () {
          state.chatTab = t.getAttribute("data-tab");
          renderCenter();
        });
      });
      var more = $(".more-actions", col);
      if (more) {
        more.addEventListener("click", function () {
          openMenu(more, {
            align: "right",
            items: state.boot.moreActions.map(function (a) {
              return {
                icon: a.icon,
                label: a.name,
                onSelect: function () {
                  toast(a.name + " — mock only");
                },
              };
            }),
          });
        });
      }
      var explorer = $(".open-explorer", col);
      if (explorer) {
        explorer.addEventListener("click", function () {
          toast("Opening in File Explorer — mock only");
        });
      }
      var moreOpen = $(".more-open", col);
      if (moreOpen) {
        moreOpen.addEventListener("click", function () {
          openMenu(moreOpen, {
            align: "right",
            items: [
              { icon: "terminal", label: "Open in Terminal", onSelect: function () { toast("Open in Terminal — mock only"); } },
              { icon: "newTab", label: "Open in Editor", onSelect: function () { toast("Open in Editor — mock only"); } },
              { icon: "split", label: "Open in Split View", onSelect: function () { toast("Split view — mock only"); } },
            ],
          });
        });
      }
    }
  }

  /* ==================== misc ==================== */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {});
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function bindGlobal() {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (state.settingsOpen) closeSettings();
      }
      if (e.ctrlKey && e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        createSession();
      }
      if (e.ctrlKey && e.shiftKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        state.rightbarOpen = !state.rightbarOpen;
        renderRightbar();
        renderCenter();
      }
    });

    // keep the right panel within bounds when the window shrinks
    var resizeRaf = null;
    window.addEventListener("resize", function () {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(function () {
        var bar = $(".rightbar");
        if (!bar) return;
        applyRightbarWidth(bar, state.rightbarWidth);
      });
    });
  }

  /* ==================== render all ==================== */
  function renderAll() {
    renderSidebar();
    renderCenter();
    renderRightbar();
  }

  /* ==================== boot ==================== */
  function boot() {
    apiGet("mock/bootstrap.json")
      .then(function (data) {
        state.boot = data;
        state.settings = Object.assign({}, data.settings);
        state.accessMode = data.defaults.accessMode;
        state.model = data.defaults.model;
        state.effort = data.defaults.effort;
        state.mode = data.defaults.mode;
        state.activeWorkspaceId = data.defaults.workspaceId;
        state.activeSessionId = data.defaults.sessionId;
        data.workspaces.forEach(function (w) {
          state.expanded[w.id] = !!w.expanded;
        });
        data.plugins.forEach(function (p) {
          state.pluginToggles[p.id] = false;
        });
        applyAppearance(state.settings.appearance);

        var root = $("#root");
        root.innerHTML = "";
        root.appendChild(h('<div class="app-frame"></div>'));
        renderSidebar();
        renderRightbar();
        bindGlobal();

        loadSession(state.activeSessionId)
          .then(function (session) {
            state.session = session;
            renderCenter();
          })
          .catch(function (err) {
            console.error(err);
            state.session = null;
            renderCenter();
          });
      })
      .catch(function (err) {
        console.error(err);
        $("#root").innerHTML =
          '<div style="padding:40px;font-size:14px">Failed to load mock/bootstrap.json — serve this folder over HTTP (e.g. <code>python -m http.server</code>).</div>';
      });
  }

  boot();
})();
