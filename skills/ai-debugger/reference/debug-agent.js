// debug-agent.js — Standalone runtime instrumentation toolkit
// Inject into any web page via browser automation to track state, intercept functions,
// poll expressions, and correlate events on a unified timeline.
// Zero dependencies. IIFE-wrapped. Idempotent.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__debugAgent && window.__debugAgent.isInjected) return;

  // ─── Utilities ──────────────────────────────────────────────────────

  function isoNow() {
    return new Date().toISOString();
  }

  var deepCloneWarned = false;
  function deepClone(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object' && typeof value !== 'function') return value;
    try {
      if (typeof structuredClone === 'function') return structuredClone(value);
    } catch (_) { /* fall through */ }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) { /* fall through */ }
    if (!deepCloneWarned) {
      console.warn('[DebugAgent] deepClone: returning original reference for non-serializable value');
      deepCloneWarned = true;
    }
    return value;
  }

  function sanitizeObject(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
    var cloned = deepClone(obj);
    // If deepClone returned the original reference, shallow-clone preserving type
    if (cloned === obj) {
      cloned = Array.isArray(obj) ? obj.slice() : Object.assign({}, obj);
    }
    if (!Array.isArray(cloned)) {
      delete cloned.__proto__;
      delete cloned.constructor;
      delete cloned.prototype;
    }
    return cloned;
  }

  function resolvePath(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') return null;
    var parts = pathStr.split('.');
    var parent = window;
    for (var i = 0; i < parts.length - 1; i++) {
      parent = parent[parts[i]];
      if (parent == null) return null;
    }
    var prop = parts[parts.length - 1];
    return { parent: parent, prop: prop, value: parent[prop] };
  }

  function serializeEntry(entry) {
    return {
      key: entry.key,
      currentValue: entry.currentValue,
      updateCount: entry.updateCount,
      firstWatched: new Date(entry.firstWatched).toISOString(),
      lastUpdated: new Date(entry.lastUpdated).toISOString(),
      metadata: entry.metadata,
      history: entry.history.map(function (h) {
        return { value: h.value, timestamp: new Date(h.timestamp).toISOString(), context: h.context };
      })
    };
  }

  // ─── Internal Stores ────────────────────────────────────────────────

  var watches = new Map();
  var interceptions = new Map();
  var polls = new Map();
  var timeline = [];

  function emit(type, key, data) {
    timeline.push({ type: type, key: key, timestamp: isoNow(), data: data });
  }

  // ─── 1. State Tracking ──────────────────────────────────────────────

  function watch(key, value, opts) {
    opts = opts || {};
    var now = Date.now();
    var cloned = deepClone(value);
    var historyEntry = { value: cloned, timestamp: now, context: opts.context };
    var existing = watches.get(key);

    if (existing) {
      var history = [historyEntry].concat(existing.history);
      if (opts.maxHistory && history.length > opts.maxHistory) {
        history = history.slice(0, opts.maxHistory);
      }
      existing.currentValue = cloned;
      existing.history = history;
      existing.lastUpdated = now;
      existing.updateCount += 1;
      if (opts.metadata) existing.metadata = sanitizeObject(opts.metadata);
    } else {
      watches.set(key, {
        key: key,
        currentValue: cloned,
        history: [historyEntry],
        firstWatched: now,
        lastUpdated: now,
        updateCount: 0,
        metadata: sanitizeObject(opts.metadata)
      });
    }

    emit('watch', key, { value: cloned, context: opts.context });
  }

  function unwatch(key) {
    return watches.delete(key);
  }

  function get(key) {
    var entry = watches.get(key);
    return entry ? serializeEntry(entry) : undefined;
  }

  function getAll() {
    var result = [];
    watches.forEach(function (entry) { result.push(serializeEntry(entry)); });
    return result;
  }

  function getKeys() {
    return Array.from(watches.keys());
  }

  function clear() {
    watches.clear();
    emit('watch', '*', { action: 'clear' });
  }

  // ─── 2. Function Interception ───────────────────────────────────────

  function intercept(path, opts) {
    opts = opts || {};
    if (interceptions.has(path)) return interceptions.get(path).key;

    var resolved = resolvePath(path);
    if (!resolved || typeof resolved.value !== 'function') {
      console.warn('[DebugAgent] Cannot intercept "' + path + '": not a function');
      return null;
    }

    var key = opts.key || 'intercept:' + path;
    var recordArgs = opts.recordArgs !== false;
    var recordReturn = opts.recordReturn !== false;
    var errorsOnly = opts.errorsOnly === true;
    var maxCalls = opts.maxCalls == null ? 500 : Math.trunc(Number(opts.maxCalls));
    if (!Number.isFinite(maxCalls) || maxCalls < 1) maxCalls = 500;
    var originalFn = resolved.value;
    var calls = [];
    var callIndex = 0;
    var state = { active: true };

    var wrapper = function () {
      var self = this;
      var args = Array.prototype.slice.call(arguments);
      var start = performance.now();
      var record = {
        callIndex: callIndex++,
        timestamp: isoNow(),
        args: recordArgs ? deepClone(args) : undefined,
        returnValue: undefined,
        duration: 0,
        error: null,
        async: false
      };

      try {
        var result = originalFn.apply(self, args);

        if (result && typeof result.then === 'function') {
          record.async = true;
          return result.then(function (v) {
            record.returnValue = recordReturn ? deepClone(v) : undefined;
            return v;
          }).catch(function (e) {
            record.error = e && e.message ? e.message : String(e);
            throw e;
          }).finally(function () {
            record.duration = Math.round((performance.now() - start) * 100) / 100;
            if (state.active && (!errorsOnly || record.error)) {
              calls.push(record);
              if (calls.length > maxCalls) calls.splice(0, calls.length - maxCalls);
              emit('intercept', key, record);
            }
          });
        }

        record.returnValue = recordReturn ? deepClone(result) : undefined;
        record.duration = Math.round((performance.now() - start) * 100) / 100;
        if (state.active && (!errorsOnly || record.error)) {
          calls.push(record);
          if (calls.length > maxCalls) calls.splice(0, calls.length - maxCalls);
          emit('intercept', key, record);
        }
        return result;
      } catch (e) {
        record.error = e && e.message ? e.message : String(e);
        record.duration = Math.round((performance.now() - start) * 100) / 100;
        if (state.active) {
          calls.push(record);
          if (calls.length > maxCalls) calls.splice(0, calls.length - maxCalls);
          emit('intercept', key, record);
        }
        throw e;
      }
    };

    // Preserve function properties (name, length, etc.)
    try { Object.defineProperty(wrapper, 'name', { value: originalFn.name }); } catch (_) {}

    resolved.parent[resolved.prop] = wrapper;
    interceptions.set(path, {
      path: path,
      key: key,
      originalFn: originalFn,
      parent: resolved.parent,
      prop: resolved.prop,
      calls: calls,
      state: state
    });

    emit('intercept', key, { action: 'started', path: path });
    return key;
  }

  function restore(path) {
    var record = interceptions.get(path);
    if (!record) return false;
    record.state.active = false;
    record.parent[record.prop] = record.originalFn;
    interceptions.delete(path);
    emit('intercept', record.key, { action: 'restored', path: path });
    return true;
  }

  function getInterceptions() {
    var result = [];
    interceptions.forEach(function (rec) {
      result.push({
        path: rec.path,
        key: rec.key,
        callCount: rec.calls.length,
        calls: rec.calls
      });
    });
    return result;
  }

  // ─── 3. Expression Polling ──────────────────────────────────────────

  function poll(key, exprString, opts) {
    opts = opts || {};
    if (polls.has(key)) {
      console.warn('[DebugAgent] Poll key "' + key + '" already active');
      return;
    }

    var intervalMs = opts.intervalMs || 1000;
    var onlyChanges = opts.onlyChanges !== false;
    var maxChanges = opts.maxChanges == null ? 500 : Math.trunc(Number(opts.maxChanges));
    if (!Number.isFinite(maxChanges) || maxChanges < 1) maxChanges = 500;
    var evaluator;

    try {
      evaluator = new Function('return (' + exprString + ')');
    } catch (e) {
      console.warn('[DebugAgent] Invalid poll expression: ' + e.message);
      return;
    }

    var lastValueJson = undefined;
    var changes = [];

    function tick() {
      try {
        var value = evaluator();
        var json = JSON.stringify(value);
        var changed = json !== lastValueJson;
        var previousValue = lastValueJson !== undefined ? JSON.parse(lastValueJson) : undefined;

        if (!onlyChanges || changed) {
          var record = {
            timestamp: isoNow(),
            value: deepClone(value),
            previousValue: previousValue,
            changed: changed
          };
          changes.push(record);
          if (changes.length > maxChanges) changes.splice(0, changes.length - maxChanges);
          emit('poll', key, record);
        }

        lastValueJson = json;
      } catch (e) {
        var errRecord = {
          timestamp: isoNow(),
          error: e.message,
          changed: false
        };
        changes.push(errRecord);
        if (changes.length > maxChanges) changes.splice(0, changes.length - maxChanges);
        emit('poll', key, errRecord);
      }
    }

    // Capture initial value immediately
    tick();
    var intervalId = setInterval(tick, intervalMs);

    polls.set(key, {
      key: key,
      expression: exprString,
      intervalId: intervalId,
      intervalMs: intervalMs,
      onlyChanges: onlyChanges,
      changes: changes
    });

    emit('poll', key, { action: 'started', expression: exprString, intervalMs: intervalMs });
  }

  function stopPoll(key) {
    var rec = polls.get(key);
    if (!rec) return false;
    clearInterval(rec.intervalId);
    polls.delete(key);
    emit('poll', key, { action: 'stopped' });
    return true;
  }

  function getPolls() {
    var result = [];
    polls.forEach(function (rec) {
      result.push({
        key: rec.key,
        expression: rec.expression,
        intervalMs: rec.intervalMs,
        onlyChanges: rec.onlyChanges,
        changeCount: rec.changes.length,
        lastValue: rec.changes.length > 0 ? rec.changes[rec.changes.length - 1].value : undefined,
        changes: rec.changes
      });
    });
    return result;
  }

  // ─── 4. Timeline & Markers ──────────────────────────────────────────

  function mark(label, data) {
    emit('mark', label, sanitizeObject(data) || {});
  }

  function getTimeline(opts) {
    opts = opts || {};
    var result = timeline;

    if (opts.types) {
      var types = opts.types;
      result = result.filter(function (e) { return types.indexOf(e.type) !== -1; });
    }

    if (opts.keys) {
      var keys = opts.keys;
      result = result.filter(function (e) { return keys.indexOf(e.key) !== -1; });
    }

    if (opts.since) {
      var since = opts.since;
      result = result.filter(function (e) { return e.timestamp >= since; });
    }

    if (opts.last) {
      result = result.slice(-opts.last);
    }

    return result;
  }

  // ─── 5. Snapshot ────────────────────────────────────────────────────

  function getSnapshot() {
    return {
      url: window.location.href,
      timestamp: isoNow(),
      version: '1.0.0',
      stats: {
        watchedKeys: watches.size,
        activeInterceptions: interceptions.size,
        activePolls: polls.size,
        timelineEntries: timeline.length
      },
      watches: getAll(),
      interceptions: getInterceptions(),
      polls: getPolls(),
      timeline: timeline
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────

  window.__debugAgent = {
    // State Tracking
    watch: watch,
    unwatch: unwatch,
    get: get,
    getAll: getAll,
    getKeys: getKeys,
    clear: clear,

    // Function Interception
    intercept: intercept,
    restore: restore,
    getInterceptions: getInterceptions,

    // Expression Polling
    poll: poll,
    stopPoll: stopPoll,
    getPolls: getPolls,

    // Timeline
    mark: mark,
    getTimeline: getTimeline,

    // Snapshot & Metadata
    getSnapshot: getSnapshot,
    isInjected: true,
    version: '1.0.0'
  };

  console.log(
    '[DebugAgent] Injected v1.0.0 — window.__debugAgent ready\n' +
    'APIs: watch, intercept, poll, mark, getTimeline, getSnapshot'
  );
})();
