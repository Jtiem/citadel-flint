/**
 * vue.global.prod.js — src/preview-vendor/vue.global.prod.js
 *
 * Vue 3 UMD production runtime for srcdoc iframe preview.
 * This file is imported with `?raw` in LivePreview.tsx and inlined into the
 * <script> tag of every Vue srcdoc document, satisfying Commandment 4 (Local-First Only).
 *
 * HOW TO POPULATE THIS FILE
 * ─────────────────────────
 * Run:
 *   npm install vue
 *   cp node_modules/vue/dist/vue.global.prod.js src/preview-vendor/vue.global.prod.js
 *
 * The file is the official Vue 3 UMD production build that exposes the `Vue`
 * global object. Pin the vue package version to match @vue/compiler-sfc to
 * avoid template compilation mismatches (ref: contract risk #3).
 *
 * Current placeholder — install `vue` to enable Vue preview.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Vue = {}));
})(this, (function (exports) {
  'use strict';

  // ── Placeholder Vue 3 stub ───────────────────────────────────────────────────
  // This minimal stub allows the srcdoc to load without a JS error when the
  // full vue.global.prod.js has not yet been vendored.
  // Component compilation will fail gracefully with a descriptive error message.

  function notReady(name) {
    return function () {
      console.error('[Flint] Vue runtime not vendored. Run: cp node_modules/vue/dist/vue.global.prod.js src/preview-vendor/vue.global.prod.js');
      throw new Error('Vue runtime stub — install vue and vendor the UMD build. Missing: ' + name);
    };
  }

  var stub = notReady;

  exports.createApp = function createApp(component) {
    return {
      mount: function (selector) {
        var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (el) {
          el.innerHTML = '<pre style="color:#f87171;padding:1rem;font-size:12px">Vue runtime not vendored.\nRun: cp node_modules/vue/dist/vue.global.prod.js src/preview-vendor/vue.global.prod.js</pre>';
        }
      },
      use: function () { return this; },
      provide: function () { return this; },
      component: function () { return this; },
    };
  };

  exports.ref = stub('ref');
  exports.reactive = stub('reactive');
  exports.computed = stub('computed');
  exports.watch = stub('watch');
  exports.watchEffect = stub('watchEffect');
  exports.onMounted = stub('onMounted');
  exports.onUnmounted = stub('onUnmounted');
  exports.onBeforeMount = stub('onBeforeMount');
  exports.onBeforeUnmount = stub('onBeforeUnmount');
  exports.onUpdated = stub('onUpdated');
  exports.onBeforeUpdate = stub('onBeforeUpdate');
  exports.defineComponent = function (opts) { return opts; };
  exports.defineProps = stub('defineProps');
  exports.defineEmits = stub('defineEmits');
  exports.defineExpose = stub('defineExpose');
  exports.withDefaults = stub('withDefaults');
  exports.toRefs = stub('toRefs');
  exports.toRef = stub('toRef');
  exports.isRef = stub('isRef');
  exports.unref = function (v) { return v && v.__v_isRef ? v.value : v; };
  exports.nextTick = function (fn) { return Promise.resolve().then(fn); };
  exports.provide = stub('provide');
  exports.inject = stub('inject');
  exports.h = stub('h');
  exports.resolveComponent = stub('resolveComponent');
  exports.createVNode = stub('createVNode');
  exports.createTextVNode = stub('createTextVNode');
  exports.createElementVNode = stub('createElementVNode');
  exports.createElementBlock = stub('createElementBlock');
  exports.openBlock = stub('openBlock');
  exports.Fragment = Symbol('Fragment');
  exports.renderList = stub('renderList');
  exports.withDirectives = stub('withDirectives');
  exports.vModelText = {};
  exports.vModelSelect = {};
  exports.vModelCheckbox = {};
  exports.mergeProps = stub('mergeProps');
  exports.normalizeClass = function (c) { return Array.isArray(c) ? c.filter(Boolean).join(' ') : c || ''; };
  exports.normalizeStyle = function (s) { return s || ''; };
  exports.cloneVNode = stub('cloneVNode');
  exports.isVNode = stub('isVNode');
  exports.Transition = {};
  exports.TransitionGroup = {};
  exports.KeepAlive = {};
  exports.Teleport = {};
  exports.Suspense = {};

  Object.defineProperty(exports, '__esModule', { value: true });
}));
