/* ============================================================
   Mock API layer.
   Intercepts window.fetch and XMLHttpRequest and serves the
   JSON files under mock/ so the replica UI can be exercised
   end-to-end without a backend.

   Routes
     GET  mock/bootstrap.json                 -> mock/bootstrap.json
     GET  mock/session-<id>.json              -> mock/session-<id>.json
     GET  mock/chat-stream.json               -> mock/chat-stream.json
     GET  mock/workspace-files.json           -> mock/workspace-files.json
     GET  mock/file-content.json?path=<enc>   -> { ok, file } filtered from mock/file-content.json
     POST api/sessions/<id>/messages          -> scripted stream events
   ============================================================ */
(function () {
  "use strict";

  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var requestLog = [];

  function log(entry) {
    requestLog.push(Object.assign({ at: new Date().toISOString() }, entry));
    if (window.__MOCK_DEBUG__) console.log("[mock-api]", entry.method, entry.url);
  }

  function loadJson(file) {
    return realFetch(file, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("mock file not found: " + file + " (" + r.status + ")");
      return r.json();
    });
  }

  function jsonResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  function resolve(url, method) {
    // strip origin, then match by path suffix so the app can live in a subfolder
    var path = String(url).replace(/^[a-zA-Z]+:\/\/[^/]+/, "").replace(/^\//, "");
    var m;
    if (method === "GET" && (m = path.match(/(?:^|\/)mock\/bootstrap\.json$/))) {
      return { kind: "json", file: "mock/bootstrap.json" };
    }
    if (method === "GET" && (m = path.match(/(?:^|\/)mock\/session-([\w-]+)\.json$/))) {
      return { kind: "json", file: "mock/session-" + m[1] + ".json", sessionId: m[1] };
    }
    if (method === "GET" && (m = path.match(/(?:^|\/)mock\/chat-stream\.json$/))) {
      return { kind: "json", file: "mock/chat-stream.json" };
    }
    if (method === "GET" && (m = path.match(/(?:^|\/)mock\/workspace-files\.json$/))) {
      return { kind: "json", file: "mock/workspace-files.json" };
    }
    if (method === "GET" && (m = path.match(/(?:^|\/)mock\/file-content\.json\?(.*)$/))) {
      var params = {};
      m[1].split("&").forEach(function (pair) {
        var kv = pair.split("=");
        if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
      });
      return { kind: "file-content", filePath: params.path || "" };
    }
    if (method === "POST" && (m = path.match(/(?:^|\/)api\/sessions\/([\w-]+)\/messages$/))) {
      return { kind: "post-message", sessionId: m[1] };
    }
    return null;
  }

  /* ---------------- fetch ---------------- */
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : input && input.url;
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    var route = resolve(url, method);
    if (!route) {
      return realFetch ? realFetch(input, init) : Promise.reject(new Error("fetch unavailable"));
    }
    log({ transport: "fetch", method: method, url: url, route: route.kind });
    if (route.kind === "file-content") {
      return loadJson("mock/file-content.json").then(function (data) {
        var file = data.files && data.files[route.filePath];
        if (!file) return jsonResponse({ ok: false, error: "no mock content for " + route.filePath }, 404);
        return jsonResponse({ ok: true, path: route.filePath, file: file });
      });
    }
    if (route.kind === "json") {
      return loadJson(route.file).then(function (data) {
        return jsonResponse(data);
      });
    }
    // POST message -> scripted stream
    return loadJson("mock/chat-stream.json").then(function (script) {
      return jsonResponse({ ok: true, sessionId: route.sessionId, events: script.events });
    });
  };

  /* ---------------- XMLHttpRequest ---------------- */
  var realOpen = XMLHttpRequest.prototype.open;
  var realSend = XMLHttpRequest.prototype.send;
  var realSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__mock = { method: String(method).toUpperCase(), url: url, headers: {} };
    return realOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) {
    if (this.__mock) this.__mock.headers[k] = v;
    return realSetHeader.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var self = this;
    var info = this.__mock;
    if (!info) return realSend.apply(this, arguments);
    var route = resolve(info.url, info.method);
    if (!route) return realSend.apply(this, arguments);
    log({ transport: "xhr", method: info.method, url: info.url, route: route.kind, body: body });

    var deliver = function (status, payload) {
      var text = typeof payload === "string" ? payload : JSON.stringify(payload);
      try {
        Object.defineProperty(self, "readyState", { configurable: true, get: function () { return 4; } });
        Object.defineProperty(self, "status", { configurable: true, get: function () { return status; } });
        Object.defineProperty(self, "statusText", { configurable: true, get: function () { return status === 200 ? "OK" : "ERROR"; } });
        Object.defineProperty(self, "responseText", { configurable: true, get: function () { return text; } });
        Object.defineProperty(self, "response", { configurable: true, get: function () { return text; } });
      } catch (e) {
        /* some engines disallow redefining; fall through to events anyway */
      }
      self.dispatchEvent(new ProgressEvent("progress", { lengthComputable: true, loaded: text.length, total: text.length }));
      if (typeof self.onreadystatechange === "function") self.onreadystatechange(new Event("readystatechange"));
      self.dispatchEvent(new Event("readystatechange"));
      self.dispatchEvent(new ProgressEvent("load", { lengthComputable: true, loaded: text.length, total: text.length }));
      self.dispatchEvent(new Event("loadend"));
    };

    var fail = function (message) {
      if (typeof self.onerror === "function") self.onerror(new Event("error"));
      self.dispatchEvent(new Event("error"));
    };

    var file = route.kind === "post-message" ? "mock/chat-stream.json"
      : route.kind === "file-content" ? "mock/file-content.json"
      : route.file;
    // small artificial latency so loading states are observable
    setTimeout(function () {
      loadJson(file).then(function (data) {
        if (route.kind === "post-message") {
          deliver(200, { ok: true, sessionId: route.sessionId, events: data.events });
        } else if (route.kind === "file-content") {
          var entry = data.files && data.files[route.filePath];
          if (!entry) {
            fail("no mock content for " + route.filePath);
            return;
          }
          deliver(200, { ok: true, path: route.filePath, file: entry });
        } else {
          deliver(200, data);
        }
      }, function (err) {
        fail(err && err.message);
      });
    }, 120);
    return undefined;
  };

  window.MockApi = {
    log: function () {
      return requestLog.slice();
    },
    clearLog: function () {
      requestLog.length = 0;
    },
  };
})();
