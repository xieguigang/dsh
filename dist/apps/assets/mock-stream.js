/* ============================================================
   Mock stream engine.
   Consumes the scripted event list from mock/chat-stream.json
   and emits UI callbacks with per-event delays. Supports
   cancellation (the composer "stop" button) and a speed factor.
   ============================================================ */
(function () {
  "use strict";

  window.MockStream = {
    /**
     * @param {Array} events   scripted events from chat-stream.json
     * @param {Object} handlers { onStatus, onGroupStart, onThink, onTool,
     *                            onText, onGroupEnd, onDeliverables, onTodos, onDone }
     * @param {Object} [opts]   { speed = 1 }
     * @returns {{ cancel: Function, done: Promise }}
     */
    run: function (events, handlers, opts) {
      opts = opts || {};
      var speed = opts.speed || 1;
      var cancelled = false;
      var timer = null;
      var resolveDone;
      var donePromise = new Promise(function (res) {
        resolveDone = res;
      });

      function step(i) {
        if (cancelled || i >= events.length) {
          if (!cancelled && handlers.onDone) {
            // done event already emitted by the script if present
          }
          resolveDone({ cancelled: cancelled });
          return;
        }
        var ev = events[i];
        var delay = Math.max(0, (ev.delayMs || 0) / speed);
        timer = setTimeout(function () {
          if (cancelled) {
            resolveDone({ cancelled: true });
            return;
          }
          try {
            switch (ev.type) {
              case "status":
                handlers.onStatus && handlers.onStatus(ev.text, ev);
                break;
              case "group":
                handlers.onGroupStart && handlers.onGroupStart(ev);
                break;
              case "think":
                handlers.onThink && handlers.onThink(ev.text, ev);
                break;
              case "tool":
                handlers.onTool && handlers.onTool(ev, ev);
                break;
              case "text":
                handlers.onText && handlers.onText(ev.text, ev);
                break;
              case "group-end":
                handlers.onGroupEnd && handlers.onGroupEnd(ev);
                break;
              case "deliverables":
                handlers.onDeliverables && handlers.onDeliverables(ev);
                break;
              case "todos":
                handlers.onTodos && handlers.onTodos(ev);
                break;
              case "done":
                handlers.onDone && handlers.onDone(ev);
                break;
              default:
                break;
            }
          } catch (err) {
            console.error("[mock-stream] handler error", err);
          }
          step(i + 1);
        }, delay);
      }

      step(0);

      return {
        cancel: function () {
          if (cancelled) return;
          cancelled = true;
          if (timer) clearTimeout(timer);
          resolveDone({ cancelled: true });
        },
        done: donePromise,
      };
    },
  };
})();
