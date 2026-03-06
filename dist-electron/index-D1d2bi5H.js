import { bF as Sa } from "./main-CEfjB-ow.js";
import Ca from "child_process";
import st, { createWriteStream as ac } from "fs";
import qi from "https";
import we from "stream";
import Bi from "os";
import kn from "events";
import lc from "process";
import at from "util";
import * as cc from "path";
import Hi from "path";
import mt from "crypto";
import uc from "querystring";
import on from "buffer";
import * as ir from "fs/promises";
import { writeFile as fc } from "fs/promises";
import { Readable as dc } from "node:stream";
import { finished as hc } from "node:stream/promises";
import Aa from "http";
import pc from "net";
import mc from "tls";
import gc from "url";
import yc from "zlib";
var wt = { exports: {} }, Jn = {}, $n, rr;
function _c() {
  if (rr) return $n;
  rr = 1;
  function t(e, n) {
    typeof n == "boolean" && (n = { forever: n }), this._originalTimeouts = JSON.parse(JSON.stringify(e)), this._timeouts = e, this._options = n || {}, this._maxRetryTime = n && n.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._timer = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
  }
  return $n = t, t.prototype.reset = function() {
    this._attempts = 1, this._timeouts = this._originalTimeouts.slice(0);
  }, t.prototype.stop = function() {
    this._timeout && clearTimeout(this._timeout), this._timer && clearTimeout(this._timer), this._timeouts = [], this._cachedTimeouts = null;
  }, t.prototype.retry = function(e) {
    if (this._timeout && clearTimeout(this._timeout), !e)
      return !1;
    var n = (/* @__PURE__ */ new Date()).getTime();
    if (e && n - this._operationStart >= this._maxRetryTime)
      return this._errors.push(e), this._errors.unshift(new Error("RetryOperation timeout occurred")), !1;
    this._errors.push(e);
    var i = this._timeouts.shift();
    if (i === void 0)
      if (this._cachedTimeouts)
        this._errors.splice(0, this._errors.length - 1), i = this._cachedTimeouts.slice(-1);
      else
        return !1;
    var r = this;
    return this._timer = setTimeout(function() {
      r._attempts++, r._operationTimeoutCb && (r._timeout = setTimeout(function() {
        r._operationTimeoutCb(r._attempts);
      }, r._operationTimeout), r._options.unref && r._timeout.unref()), r._fn(r._attempts);
    }, i), this._options.unref && this._timer.unref(), !0;
  }, t.prototype.attempt = function(e, n) {
    this._fn = e, n && (n.timeout && (this._operationTimeout = n.timeout), n.cb && (this._operationTimeoutCb = n.cb));
    var i = this;
    this._operationTimeoutCb && (this._timeout = setTimeout(function() {
      i._operationTimeoutCb();
    }, i._operationTimeout)), this._operationStart = (/* @__PURE__ */ new Date()).getTime(), this._fn(this._attempts);
  }, t.prototype.try = function(e) {
    console.log("Using RetryOperation.try() is deprecated"), this.attempt(e);
  }, t.prototype.start = function(e) {
    console.log("Using RetryOperation.start() is deprecated"), this.attempt(e);
  }, t.prototype.start = t.prototype.try, t.prototype.errors = function() {
    return this._errors;
  }, t.prototype.attempts = function() {
    return this._attempts;
  }, t.prototype.mainError = function() {
    if (this._errors.length === 0)
      return null;
    for (var e = {}, n = null, i = 0, r = 0; r < this._errors.length; r++) {
      var o = this._errors[r], a = o.message, l = (e[a] || 0) + 1;
      e[a] = l, l >= i && (n = o, i = l);
    }
    return n;
  }, $n;
}
var or;
function vc() {
  return or || (or = 1, (function(t) {
    var e = _c();
    t.operation = function(n) {
      var i = t.timeouts(n);
      return new e(i, {
        forever: n && (n.forever || n.retries === 1 / 0),
        unref: n && n.unref,
        maxRetryTime: n && n.maxRetryTime
      });
    }, t.timeouts = function(n) {
      if (n instanceof Array)
        return [].concat(n);
      var i = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: 1 / 0,
        randomize: !1
      };
      for (var r in n)
        i[r] = n[r];
      if (i.minTimeout > i.maxTimeout)
        throw new Error("minTimeout is greater than maxTimeout");
      for (var o = [], a = 0; a < i.retries; a++)
        o.push(this.createTimeout(a, i));
      return n && n.forever && !o.length && o.push(this.createTimeout(a, i)), o.sort(function(l, f) {
        return l - f;
      }), o;
    }, t.createTimeout = function(n, i) {
      var r = i.randomize ? Math.random() + 1 : 1, o = Math.round(r * Math.max(i.minTimeout, 1) * Math.pow(i.factor, n));
      return o = Math.min(o, i.maxTimeout), o;
    }, t.wrap = function(n, i, r) {
      if (i instanceof Array && (r = i, i = null), !r) {
        r = [];
        for (var o in n)
          typeof n[o] == "function" && r.push(o);
      }
      for (var a = 0; a < r.length; a++) {
        var l = r[a], f = n[l];
        n[l] = (function(d) {
          var p = t.operation(i), h = Array.prototype.slice.call(arguments, 1), m = h.pop();
          h.push(function(g) {
            p.retry(g) || (g && (arguments[0] = p.mainError()), m.apply(this, arguments));
          }), p.attempt(function() {
            d.apply(n, h);
          });
        }).bind(n, f), n[l].options = i;
      }
    };
  })(Jn)), Jn;
}
var Wn, sr;
function Ec() {
  return sr || (sr = 1, Wn = vc()), Wn;
}
var ar;
function Tc() {
  if (ar) return wt.exports;
  ar = 1;
  const t = Ec(), e = [
    "Failed to fetch",
    // Chrome
    "NetworkError when attempting to fetch resource.",
    // Firefox
    "The Internet connection appears to be offline.",
    // Safari
    "Network request failed"
    // `cross-fetch`
  ];
  class n extends Error {
    constructor(l) {
      super(), l instanceof Error ? (this.originalError = l, { message: l } = l) : (this.originalError = new Error(l), this.originalError.stack = this.stack), this.name = "AbortError", this.message = l;
    }
  }
  const i = (a, l, f) => {
    const c = f.retries - (l - 1);
    return a.attemptNumber = l, a.retriesLeft = c, a;
  }, r = (a) => e.includes(a), o = (a, l) => new Promise((f, c) => {
    l = {
      onFailedAttempt: () => {
      },
      retries: 10,
      ...l
    };
    const d = t.operation(l);
    d.attempt(async (p) => {
      try {
        f(await a(p));
      } catch (h) {
        if (!(h instanceof Error)) {
          c(new TypeError(`Non-error was thrown: "${h}". You should only throw errors.`));
          return;
        }
        if (h instanceof n)
          d.stop(), c(h.originalError);
        else if (h instanceof TypeError && !r(h.message))
          d.stop(), c(h);
        else {
          i(h, p, l);
          try {
            await l.onFailedAttempt(h);
          } catch (m) {
            c(m);
            return;
          }
          d.retry(h) || c(d.mainError());
        }
      }
    });
  });
  return wt.exports = o, wt.exports.default = o, wt.exports.AbortError = n, wt.exports;
}
var wa = Tc();
const Sc = /* @__PURE__ */ Sa(wa);
var Ye = {}, Kn = {}, ze = {}, Xe = {}, Yn, lr;
function Ia() {
  if (lr) return Yn;
  lr = 1;
  var t = Object.prototype.hasOwnProperty, e = Object.prototype.toString, n = Object.defineProperty, i = Object.getOwnPropertyDescriptor, r = function(c) {
    return typeof Array.isArray == "function" ? Array.isArray(c) : e.call(c) === "[object Array]";
  }, o = function(c) {
    if (!c || e.call(c) !== "[object Object]")
      return !1;
    var d = t.call(c, "constructor"), p = c.constructor && c.constructor.prototype && t.call(c.constructor.prototype, "isPrototypeOf");
    if (c.constructor && !d && !p)
      return !1;
    var h;
    for (h in c)
      ;
    return typeof h > "u" || t.call(c, h);
  }, a = function(c, d) {
    n && d.name === "__proto__" ? n(c, d.name, {
      enumerable: !0,
      configurable: !0,
      value: d.newValue,
      writable: !0
    }) : c[d.name] = d.newValue;
  }, l = function(c, d) {
    if (d === "__proto__")
      if (t.call(c, d)) {
        if (i)
          return i(c, d).value;
      } else return;
    return c[d];
  };
  return Yn = function f() {
    var c, d, p, h, m, g, v = arguments[0], E = 1, T = arguments.length, C = !1;
    for (typeof v == "boolean" && (C = v, v = arguments[1] || {}, E = 2), (v == null || typeof v != "object" && typeof v != "function") && (v = {}); E < T; ++E)
      if (c = arguments[E], c != null)
        for (d in c)
          p = l(v, d), h = l(c, d), v !== h && (C && h && (o(h) || (m = r(h))) ? (m ? (m = !1, g = p && r(p) ? p : []) : g = p && o(p) ? p : {}, a(v, { name: d, newValue: f(C, g, h) })) : typeof h < "u" && a(v, { name: d, newValue: h }));
    return v;
  }, Yn;
}
var It = {};
const Cc = "gaxios", Ac = "7.1.3", wc = "A simple common HTTP client specifically for Google APIs and services.", Ic = "build/cjs/src/index.js", Rc = "build/cjs/src/index.d.ts", Pc = ["build/"], Nc = { ".": { import: { types: "./build/esm/src/index.d.ts", default: "./build/esm/src/index.js" }, require: { types: "./build/cjs/src/index.d.ts", default: "./build/cjs/src/index.js" } } }, kc = { lint: "gts check --no-inline-config", test: "c8 mocha build/esm/test", "presystem-test": "npm run compile", "system-test": "mocha build/esm/system-test --timeout 80000", compile: "tsc -b ./tsconfig.json ./tsconfig.cjs.json && node utils/enable-esm.mjs", fix: "gts fix", prepare: "npm run compile", pretest: "npm run compile", webpack: "webpack", "prebrowser-test": "npm run compile", "browser-test": "node build/browser-test/browser-test-runner.js", docs: "jsdoc -c .jsdoc.js", "docs-test": "linkinator docs", "predocs-test": "npm run docs", "samples-test": "cd samples/ && npm link ../ && npm test && cd ../", prelint: "cd samples; npm link ../; npm install", clean: "gts clean" }, Mc = { type: "git", directory: "packages/gaxios", url: "https://github.com/googleapis/google-cloud-node-core.git" }, xc = ["google"], Dc = { node: ">=18" }, Uc = "Google, LLC", bc = "Apache-2.0", Lc = { "@babel/plugin-proposal-private-methods": "^7.18.6", "@types/cors": "^2.8.6", "@types/express": "^5.0.0", "@types/extend": "^3.0.1", "@types/mocha": "^10.0.10", "@types/multiparty": "4.2.1", "@types/mv": "^2.1.0", "@types/ncp": "^2.0.1", "@types/node": "^22.0.0", "@types/sinon": "^17.0.0", "@types/tmp": "0.2.6", assert: "^2.0.0", browserify: "^17.0.0", c8: "^10.0.0", cors: "^2.8.5", express: "^5.0.0", gts: "^6.0.0", "is-docker": "^3.0.0", jsdoc: "^4.0.0", "jsdoc-fresh": "^5.0.0", "jsdoc-region-tag": "^4.0.0", karma: "^6.0.0", "karma-chrome-launcher": "^3.0.0", "karma-coverage": "^2.0.0", "karma-firefox-launcher": "^2.0.0", "karma-mocha": "^2.0.0", "karma-remap-coverage": "^0.1.5", "karma-sourcemap-loader": "^0.4.0", "karma-webpack": "^5.0.1", linkinator: "^6.1.2", mocha: "^11.1.0", multiparty: "^4.2.1", mv: "^2.1.1", ncp: "^2.0.0", nock: "^14.0.0-beta.13", "null-loader": "^4.0.0", "pack-n-play": "^4.0.0", puppeteer: "^24.0.0", sinon: "^21.0.0", "stream-browserify": "^3.0.0", tmp: "0.2.5", "ts-loader": "^9.5.2", typescript: "^5.8.3", webpack: "^5.35.0", "webpack-cli": "^6.0.1" }, Oc = { extend: "^3.0.2", "https-proxy-agent": "^7.0.1", "node-fetch": "^3.3.2", rimraf: "^5.0.1" }, Fc = "https://github.com/googleapis/google-cloud-node-core/tree/main/packages/gaxios", Gc = {
  name: Cc,
  version: Ac,
  description: wc,
  main: Ic,
  types: Rc,
  files: Pc,
  exports: Nc,
  scripts: kc,
  repository: Mc,
  keywords: xc,
  engines: Dc,
  author: Uc,
  license: bc,
  devDependencies: Lc,
  dependencies: Oc,
  homepage: Fc
};
var zn, cr;
function qc() {
  return cr || (cr = 1, zn = { pkg: Gc }), zn;
}
var ur;
function Ra() {
  return ur || (ur = 1, (function(t) {
    var e = It && It.__importDefault || function(f) {
      return f && f.__esModule ? f : { default: f };
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.GaxiosError = t.GAXIOS_ERROR_SYMBOL = void 0, t.defaultErrorRedactor = l;
    const n = e(Ia()), r = e(qc()).default.pkg;
    t.GAXIOS_ERROR_SYMBOL = /* @__PURE__ */ Symbol.for(`${r.name}-gaxios-error`);
    class o extends Error {
      config;
      response;
      /**
       * An error code.
       * Can be a system error code, DOMException error name, or any error's 'code' property where it is a `string`.
       *
       * It is only a `number` when the cause is sourced from an API-level error (AIP-193).
       *
       * @see {@link https://nodejs.org/api/errors.html#errorcode error.code}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMException#error_names DOMException#error_names}
       * @see {@link https://google.aip.dev/193#http11json-representation AIP-193}
       *
       * @example
       * 'ECONNRESET'
       *
       * @example
       * 'TimeoutError'
       *
       * @example
       * 500
       */
      code;
      /**
       * An HTTP Status code.
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Response/status Response#status}
       *
       * @example
       * 500
       */
      status;
      /**
       * @deprecated use {@link GaxiosError.cause} instead.
       *
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause Error#cause}
       *
       * @privateRemarks
       *
       * We will want to remove this property later as the modern `cause` property is better suited
       * for displaying and relaying nested errors. Keeping this here makes the resulting
       * error log larger than it needs to be.
       *
       */
      error;
      /**
       * Support `instanceof` operator for `GaxiosError` across builds/duplicated files.
       *
       * @see {@link GAXIOS_ERROR_SYMBOL}
       * @see {@link GaxiosError[Symbol.hasInstance]}
       * @see {@link https://github.com/microsoft/TypeScript/issues/13965#issuecomment-278570200}
       * @see {@link https://stackoverflow.com/questions/46618852/require-and-instanceof}
       * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/@@hasInstance#reverting_to_default_instanceof_behavior}
       */
      [t.GAXIOS_ERROR_SYMBOL] = r.version;
      /**
       * Support `instanceof` operator for `GaxiosError` across builds/duplicated files.
       *
       * @see {@link GAXIOS_ERROR_SYMBOL}
       * @see {@link GaxiosError[GAXIOS_ERROR_SYMBOL]}
       */
      static [Symbol.hasInstance](c) {
        return c && typeof c == "object" && t.GAXIOS_ERROR_SYMBOL in c && c[t.GAXIOS_ERROR_SYMBOL] === r.version ? !0 : Function.prototype[Symbol.hasInstance].call(o, c);
      }
      constructor(c, d, p, h) {
        if (super(c, { cause: h }), this.config = d, this.response = p, this.error = h instanceof Error ? h : void 0, this.config = (0, n.default)(!0, {}, d), this.response && (this.response.config = (0, n.default)(!0, {}, this.response.config)), this.response) {
          try {
            this.response.data = a(
              this.config.responseType,
              // workaround for `node-fetch`'s `.data` deprecation...
              this.response?.bodyUsed ? this.response?.data : void 0
            );
          } catch {
          }
          this.status = this.response.status;
        }
        h instanceof DOMException ? this.code = h.name : h && typeof h == "object" && "code" in h && (typeof h.code == "string" || typeof h.code == "number") && (this.code = h.code);
      }
      /**
       * An AIP-193 conforming error extractor.
       *
       * @see {@link https://google.aip.dev/193#http11json-representation AIP-193}
       *
       * @internal
       * @expiremental
       *
       * @param res the response object
       * @returns the extracted error information
       */
      static extractAPIErrorFromResponse(c, d = "The request failed") {
        let p = d;
        if (typeof c.data == "string" && (p = c.data), c.data && typeof c.data == "object" && "error" in c.data && c.data.error && !c.ok) {
          if (typeof c.data.error == "string")
            return {
              message: c.data.error,
              code: c.status,
              status: c.statusText
            };
          if (typeof c.data.error == "object") {
            p = "message" in c.data.error && typeof c.data.error.message == "string" ? c.data.error.message : p;
            const h = "status" in c.data.error && typeof c.data.error.status == "string" ? c.data.error.status : c.statusText, m = "code" in c.data.error && typeof c.data.error.code == "number" ? c.data.error.code : c.status;
            if ("errors" in c.data.error && Array.isArray(c.data.error.errors)) {
              const g = [];
              for (const v of c.data.error.errors)
                typeof v == "object" && "message" in v && typeof v.message == "string" && g.push(v.message);
              return Object.assign({
                message: g.join(`
`) || p,
                code: m,
                status: h
              }, c.data.error);
            }
            return Object.assign({
              message: p,
              code: m,
              status: h
            }, c.data.error);
          }
        }
        return {
          message: p,
          code: c.status,
          status: c.statusText
        };
      }
    }
    t.GaxiosError = o;
    function a(f, c) {
      switch (f) {
        case "stream":
          return c;
        case "json":
          return JSON.parse(JSON.stringify(c));
        case "arraybuffer":
          return JSON.parse(Buffer.from(c).toString("utf8"));
        case "blob":
          return JSON.parse(c.text());
        default:
          return c;
      }
    }
    function l(f) {
      const c = "<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.";
      function d(m) {
        m && m.forEach((g, v) => {
          (/^authentication$/i.test(v) || /^authorization$/i.test(v) || /secret/i.test(v)) && m.set(v, c);
        });
      }
      function p(m, g) {
        if (typeof m == "object" && m !== null && typeof m[g] == "string") {
          const v = m[g];
          (/grant_type=/i.test(v) || /assertion=/i.test(v) || /secret/i.test(v)) && (m[g] = c);
        }
      }
      function h(m) {
        !m || typeof m != "object" || (m instanceof FormData || m instanceof URLSearchParams || // support `node-fetch` FormData/URLSearchParams
        "forEach" in m && "set" in m ? m.forEach((g, v) => {
          (["grant_type", "assertion"].includes(v) || /secret/.test(v)) && m.set(v, c);
        }) : ("grant_type" in m && (m.grant_type = c), "assertion" in m && (m.assertion = c), "client_secret" in m && (m.client_secret = c)));
      }
      return f.config && (d(f.config.headers), p(f.config, "data"), h(f.config.data), p(f.config, "body"), h(f.config.body), f.config.url.searchParams.has("token") && f.config.url.searchParams.set("token", c), f.config.url.searchParams.has("client_secret") && f.config.url.searchParams.set("client_secret", c)), f.response && (l({ config: f.response.config }), d(f.response.headers), f.response.bodyUsed && (p(f.response, "data"), h(f.response.data))), f;
    }
  })(It)), It;
}
var fn = {}, fr;
function Bc() {
  if (fr) return fn;
  fr = 1, Object.defineProperty(fn, "__esModule", { value: !0 }), fn.getRetryConfig = t;
  async function t(r) {
    let o = n(r);
    if (!r || !r.config || !o && !r.config.retry)
      return { shouldRetry: !1 };
    o = o || {}, o.currentRetryAttempt = o.currentRetryAttempt || 0, o.retry = o.retry === void 0 || o.retry === null ? 3 : o.retry, o.httpMethodsToRetry = o.httpMethodsToRetry || [
      "GET",
      "HEAD",
      "PUT",
      "OPTIONS",
      "DELETE"
    ], o.noResponseRetries = o.noResponseRetries === void 0 || o.noResponseRetries === null ? 2 : o.noResponseRetries, o.retryDelayMultiplier = o.retryDelayMultiplier ? o.retryDelayMultiplier : 2, o.timeOfFirstRequest = o.timeOfFirstRequest ? o.timeOfFirstRequest : Date.now(), o.totalTimeout = o.totalTimeout ? o.totalTimeout : Number.MAX_SAFE_INTEGER, o.maxRetryDelay = o.maxRetryDelay ? o.maxRetryDelay : Number.MAX_SAFE_INTEGER;
    const a = [
      // https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
      // 1xx - Retry (Informational, request still processing)
      // 2xx - Do not retry (Success)
      // 3xx - Do not retry (Redirect)
      // 4xx - Do not retry (Client errors)
      // 408 - Retry ("Request Timeout")
      // 429 - Retry ("Too Many Requests")
      // 5xx - Retry (Server errors)
      [100, 199],
      [408, 408],
      [429, 429],
      [500, 599]
    ];
    if (o.statusCodesToRetry = o.statusCodesToRetry || a, r.config.retryConfig = o, !await (o.shouldRetry || e)(r))
      return { shouldRetry: !1, config: r.config };
    const f = i(o);
    r.config.retryConfig.currentRetryAttempt += 1;
    const c = o.retryBackoff ? o.retryBackoff(r, f) : new Promise((d) => {
      setTimeout(d, f);
    });
    return o.onRetryAttempt && await o.onRetryAttempt(r), await c, { shouldRetry: !0, config: r.config };
  }
  function e(r) {
    const o = n(r);
    if (r.config.signal?.aborted && r.code !== "TimeoutError" || r.code === "AbortError" || !o || o.retry === 0 || !r.response && (o.currentRetryAttempt || 0) >= o.noResponseRetries || !o.httpMethodsToRetry || !o.httpMethodsToRetry.includes(r.config.method?.toUpperCase() || "GET"))
      return !1;
    if (r.response && r.response.status) {
      let a = !1;
      for (const [l, f] of o.statusCodesToRetry) {
        const c = r.response.status;
        if (c >= l && c <= f) {
          a = !0;
          break;
        }
      }
      if (!a)
        return !1;
    }
    return o.currentRetryAttempt = o.currentRetryAttempt || 0, !(o.currentRetryAttempt >= o.retry);
  }
  function n(r) {
    if (r && r.config && r.config.retryConfig)
      return r.config.retryConfig;
  }
  function i(r) {
    const a = (r.currentRetryAttempt ? 0 : r.retryDelay ?? 100) + (Math.pow(r.retryDelayMultiplier, r.currentRetryAttempt) - 1) / 2 * 1e3, l = r.totalTimeout - (Date.now() - r.timeOfFirstRequest);
    return Math.min(a, l, r.maxRetryDelay);
  }
  return fn;
}
var Rt = {}, dr;
function Pa() {
  if (dr) return Rt;
  dr = 1, Object.defineProperty(Rt, "__esModule", { value: !0 }), Rt.GaxiosInterceptorManager = void 0;
  class t extends Set {
  }
  return Rt.GaxiosInterceptorManager = t, Rt;
}
var hr;
function Hc() {
  if (hr) return Xe;
  hr = 1;
  var t = Xe && Xe.__importDefault || function(p) {
    return p && p.__esModule ? p : { default: p };
  }, e;
  Object.defineProperty(Xe, "__esModule", { value: !0 }), Xe.Gaxios = void 0;
  const n = t(Ia()), i = qi, r = Ra(), o = Bc(), a = we, l = Pa(), f = async () => globalThis.crypto?.randomUUID() || (await import("crypto")).randomUUID(), c = 204;
  class d {
    agentCache = /* @__PURE__ */ new Map();
    /**
     * Default HTTP options that will be used for every HTTP request.
     */
    defaults;
    /**
     * Interceptors
     */
    interceptors;
    /**
     * The Gaxios class is responsible for making HTTP requests.
     * @param defaults The default set of options to be used for this instance.
     */
    constructor(h) {
      this.defaults = h || {}, this.interceptors = {
        request: new l.GaxiosInterceptorManager(),
        response: new l.GaxiosInterceptorManager()
      };
    }
    /**
     * A {@link fetch `fetch`} compliant API for {@link Gaxios}.
     *
     * @remarks
     *
     * This is useful as a drop-in replacement for `fetch` API usage.
     *
     * @example
     *
     * ```ts
     * const gaxios = new Gaxios();
     * const myFetch: typeof fetch = (...args) => gaxios.fetch(...args);
     * await myFetch('https://example.com');
     * ```
     *
     * @param args `fetch` API or `Gaxios#request` parameters
     * @returns the {@link Response} with Gaxios-added properties
     */
    fetch(...h) {
      const m = h[0], g = h[1];
      let v;
      const E = new Headers();
      return typeof m == "string" ? v = new URL(m) : m instanceof URL ? v = m : m && m.url && (v = new URL(m.url)), m && typeof m == "object" && "headers" in m && e.mergeHeaders(E, m.headers), g && e.mergeHeaders(E, new Headers(g.headers)), typeof m == "object" && !(m instanceof URL) ? this.request({ ...g, ...m, headers: E, url: v }) : this.request({ ...g, headers: E, url: v });
    }
    /**
     * Perform an HTTP request with the given options.
     * @param opts Set of HTTP options that will be used for this HTTP request.
     */
    async request(h = {}) {
      let m = await this.#i(h);
      return m = await this.#t(m), this.#n(this._request(m));
    }
    async _defaultAdapter(h) {
      const m = h.fetchImplementation || this.defaults.fetchImplementation || await e.#l(), g = { ...h };
      delete g.data;
      const v = await m(h.url, g), E = await this.getResponseData(h, v);
      return Object.getOwnPropertyDescriptor(v, "data")?.configurable || Object.defineProperties(v, {
        data: {
          configurable: !0,
          writable: !0,
          enumerable: !0,
          value: E
        }
      }), Object.assign(v, { config: h, data: E });
    }
    /**
     * Internal, retryable version of the `request` method.
     * @param opts Set of HTTP options that will be used for this HTTP request.
     */
    async _request(h) {
      try {
        let m;
        if (h.adapter ? m = await h.adapter(h, this._defaultAdapter.bind(this)) : m = await this._defaultAdapter(h), !h.validateStatus(m.status)) {
          if (h.responseType === "stream") {
            const v = [];
            for await (const E of m.data)
              v.push(E);
            m.data = v.toString();
          }
          const g = r.GaxiosError.extractAPIErrorFromResponse(m, `Request failed with status code ${m.status}`);
          throw new r.GaxiosError(g?.message, h, m, g);
        }
        return m;
      } catch (m) {
        let g;
        m instanceof r.GaxiosError ? g = m : m instanceof Error ? g = new r.GaxiosError(m.message, h, void 0, m) : g = new r.GaxiosError("Unexpected Gaxios Error", h, void 0, m);
        const { shouldRetry: v, config: E } = await (0, o.getRetryConfig)(g);
        if (v && E)
          return g.config.retryConfig.currentRetryAttempt = E.retryConfig.currentRetryAttempt, h.retryConfig = g.config?.retryConfig, this.#r(h), this._request(h);
        throw h.errorRedactor && h.errorRedactor(g), g;
      }
    }
    async getResponseData(h, m) {
      if (m.status === c)
        return "";
      if (h.maxContentLength && m.headers.has("content-length") && h.maxContentLength < Number.parseInt(m.headers?.get("content-length") || ""))
        throw new r.GaxiosError("Response's `Content-Length` is over the limit.", h, Object.assign(m, { config: h }));
      switch (h.responseType) {
        case "stream":
          return m.body;
        case "json": {
          const g = await m.text();
          try {
            return JSON.parse(g);
          } catch {
            return g;
          }
        }
        case "arraybuffer":
          return m.arrayBuffer();
        case "blob":
          return m.blob();
        case "text":
          return m.text();
        default:
          return this.getResponseDataFromContentType(m);
      }
    }
    #e(h, m = []) {
      const g = new URL(h), v = [...m], E = (process.env.NO_PROXY ?? process.env.no_proxy)?.split(",") || [];
      for (const T of E)
        v.push(T.trim());
      for (const T of v)
        if (T instanceof RegExp) {
          if (T.test(g.toString()))
            return !1;
        } else if (T instanceof URL) {
          if (T.origin === g.origin)
            return !1;
        } else if (T.startsWith("*.") || T.startsWith(".")) {
          const C = T.replace(/^\*\./, ".");
          if (g.hostname.endsWith(C))
            return !1;
        } else if (T === g.origin || T === g.hostname || T === g.href)
          return !1;
      return !0;
    }
    /**
     * Applies the request interceptors. The request interceptors are applied after the
     * call to prepareRequest is completed.
     *
     * @param {GaxiosOptionsPrepared} options The current set of options.
     *
     * @returns {Promise<GaxiosOptionsPrepared>} Promise that resolves to the set of options or response after interceptors are applied.
     */
    async #t(h) {
      let m = Promise.resolve(h);
      for (const g of this.interceptors.request.values())
        g && (m = m.then(g.resolved, g.rejected));
      return m;
    }
    /**
     * Applies the response interceptors. The response interceptors are applied after the
     * call to request is made.
     *
     * @param {GaxiosOptionsPrepared} options The current set of options.
     *
     * @returns {Promise<GaxiosOptionsPrepared>} Promise that resolves to the set of options or response after interceptors are applied.
     */
    async #n(h) {
      let m = Promise.resolve(h);
      for (const g of this.interceptors.response.values())
        g && (m = m.then(g.resolved, g.rejected));
      return m;
    }
    /**
     * Validates the options, merges them with defaults, and prepare request.
     *
     * @param options The original options passed from the client.
     * @returns Prepared options, ready to make a request
     */
    async #i(h) {
      const m = new Headers(this.defaults.headers);
      e.mergeHeaders(m, h.headers);
      const g = (0, n.default)(!0, {}, this.defaults, h);
      if (!g.url)
        throw new Error("URL is required.");
      if (g.baseURL && (g.url = new URL(g.url, g.baseURL)), g.url = new URL(g.url), g.params)
        if (g.paramsSerializer) {
          let T = g.paramsSerializer(g.params);
          T.startsWith("?") && (T = T.slice(1));
          const C = g.url.toString().includes("?") ? "&" : "?";
          g.url = g.url + C + T;
        } else {
          const T = g.url instanceof URL ? g.url : new URL(g.url);
          for (const [C, w] of new URLSearchParams(g.params))
            T.searchParams.append(C, w);
          g.url = T;
        }
      typeof h.maxContentLength == "number" && (g.size = h.maxContentLength), typeof h.maxRedirects == "number" && (g.follow = h.maxRedirects);
      const v = typeof g.data == "string" || g.data instanceof ArrayBuffer || g.data instanceof Blob || // Node 18 does not have a global `File` object
      globalThis.File && g.data instanceof File || g.data instanceof FormData || g.data instanceof a.Readable || g.data instanceof ReadableStream || g.data instanceof String || g.data instanceof URLSearchParams || ArrayBuffer.isView(g.data) || // `Buffer` (Node.js), `DataView`, `TypedArray`
      /**
       * @deprecated `node-fetch` or another third-party's request types
       */
      ["Blob", "File", "FormData"].includes(g.data?.constructor?.name || "");
      if (g.multipart?.length) {
        const T = await f();
        m.set("content-type", `multipart/related; boundary=${T}`), g.body = a.Readable.from(this.getMultipartRequest(g.multipart, T));
      } else v ? g.body = g.data : typeof g.data == "object" ? m.get("Content-Type") === "application/x-www-form-urlencoded" ? g.body = g.paramsSerializer ? g.paramsSerializer(g.data) : new URLSearchParams(g.data) : (m.has("content-type") || m.set("content-type", "application/json"), g.body = JSON.stringify(g.data)) : g.data && (g.body = g.data);
      g.validateStatus = g.validateStatus || this.validateStatus, g.responseType = g.responseType || "unknown", !m.has("accept") && g.responseType === "json" && m.set("accept", "application/json");
      const E = g.proxy || process.env?.HTTPS_PROXY || process.env?.https_proxy || process.env?.HTTP_PROXY || process.env?.http_proxy;
      if (!g.agent) if (E && this.#e(g.url, g.noProxy)) {
        const T = await e.#a();
        this.agentCache.has(E) ? g.agent = this.agentCache.get(E) : (g.agent = new T(E, {
          cert: g.cert,
          key: g.key
        }), this.agentCache.set(E, g.agent));
      } else g.cert && g.key && (this.agentCache.has(g.key) ? g.agent = this.agentCache.get(g.key) : (g.agent = new i.Agent({
        cert: g.cert,
        key: g.key
      }), this.agentCache.set(g.key, g.agent)));
      return typeof g.errorRedactor != "function" && g.errorRedactor !== !1 && (g.errorRedactor = r.defaultErrorRedactor), g.body && !("duplex" in g) && (g.duplex = "half"), this.#r(g), Object.assign(g, {
        headers: m,
        url: g.url instanceof URL ? g.url : new URL(g.url)
      });
    }
    #r(h) {
      if (h.timeout) {
        const m = AbortSignal.timeout(h.timeout);
        h.signal && !h.signal.aborted ? h.signal = AbortSignal.any([h.signal, m]) : h.signal = m;
      }
    }
    /**
     * By default, throw for any non-2xx status code
     * @param status status code from the HTTP response
     */
    validateStatus(h) {
      return h >= 200 && h < 300;
    }
    /**
     * Attempts to parse a response by looking at the Content-Type header.
     * @param {Response} response the HTTP response.
     * @returns a promise that resolves to the response data.
     */
    async getResponseDataFromContentType(h) {
      let m = h.headers.get("Content-Type");
      if (m === null)
        return h.text();
      if (m = m.toLowerCase(), m.includes("application/json")) {
        let g = await h.text();
        try {
          g = JSON.parse(g);
        } catch {
        }
        return g;
      } else return m.match(/^text\//) ? h.text() : h.blob();
    }
    /**
     * Creates an async generator that yields the pieces of a multipart/related request body.
     * This implementation follows the spec: https://www.ietf.org/rfc/rfc2387.txt. However, recursive
     * multipart/related requests are not currently supported.
     *
     * @param {GaxiosMultipartOptions[]} multipartOptions the pieces to turn into a multipart/related body.
     * @param {string} boundary the boundary string to be placed between each part.
     */
    async *getMultipartRequest(h, m) {
      const g = `--${m}--`;
      for (const v of h) {
        const E = v.headers.get("Content-Type") || "application/octet-stream";
        yield `--${m}\r
Content-Type: ${E}\r
\r
`, typeof v.content == "string" ? yield v.content : yield* v.content, yield `\r
`;
      }
      yield g;
    }
    /**
     * A cache for the lazily-loaded proxy agent.
     *
     * Should use {@link Gaxios[#getProxyAgent]} to retrieve.
     */
    // using `import` to dynamically import the types here
    static #o;
    /**
     * A cache for the lazily-loaded fetch library.
     *
     * Should use {@link Gaxios[#getFetch]} to retrieve.
     */
    //
    static #s;
    /**
     * Imports, caches, and returns a proxy agent - if not already imported
     *
     * @returns A proxy agent
     */
    static async #a() {
      return this.#o ||= (await import("./index-DNBb5jcw.js").then((h) => h.i)).HttpsProxyAgent, this.#o;
    }
    static async #l() {
      const h = typeof window < "u" && !!window;
      return this.#s ||= h ? window.fetch : (await import("./index-C88IjecF.js")).default, this.#s;
    }
    /**
     * Merges headers.
     * If the base headers do not exist a new `Headers` object will be returned.
     *
     * @remarks
     *
     * Using this utility can be helpful when the headers are not known to exist:
     * - if they exist as `Headers`, that instance will be used
     *   - it improves performance and allows users to use their existing references to their `Headers`
     * - if they exist in another form (`HeadersInit`), they will be used to create a new `Headers` object
     * - if the base headers do not exist a new `Headers` object will be created
     *
     * @param base headers to append/overwrite to
     * @param append headers to append/overwrite with
     * @returns the base headers instance with merged `Headers`
     */
    static mergeHeaders(h, ...m) {
      h = h instanceof Headers ? h : new Headers(h);
      for (const g of m)
        (g instanceof Headers ? g : new Headers(g)).forEach((E, T) => {
          T === "set-cookie" ? h.append(T, E) : h.set(T, E);
        });
      return h;
    }
  }
  return Xe.Gaxios = d, e = d, Xe;
}
var pr;
function ve() {
  return pr || (pr = 1, (function(t) {
    var e = ze && ze.__createBinding || (Object.create ? (function(a, l, f, c) {
      c === void 0 && (c = f);
      var d = Object.getOwnPropertyDescriptor(l, f);
      (!d || ("get" in d ? !l.__esModule : d.writable || d.configurable)) && (d = { enumerable: !0, get: function() {
        return l[f];
      } }), Object.defineProperty(a, c, d);
    }) : (function(a, l, f, c) {
      c === void 0 && (c = f), a[c] = l[f];
    })), n = ze && ze.__exportStar || function(a, l) {
      for (var f in a) f !== "default" && !Object.prototype.hasOwnProperty.call(l, f) && e(l, a, f);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.instance = t.Gaxios = t.GaxiosError = void 0, t.request = o;
    const i = Hc();
    Object.defineProperty(t, "Gaxios", { enumerable: !0, get: function() {
      return i.Gaxios;
    } });
    var r = Ra();
    Object.defineProperty(t, "GaxiosError", { enumerable: !0, get: function() {
      return r.GaxiosError;
    } }), n(Pa(), t), t.instance = new i.Gaxios();
    async function o(a) {
      return t.instance.request(a);
    }
  })(ze)), ze;
}
var ke = {}, Pt = { exports: {} }, Xn = { exports: {} }, Tn = { exports: {} }, Vc = Tn.exports, mr;
function Na() {
  return mr || (mr = 1, (function(t) {
    (function(e) {
      var n, i = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i, r = Math.ceil, o = Math.floor, a = "[BigNumber Error] ", l = a + "Number primitive has more than 15 significant digits: ", f = 1e14, c = 14, d = 9007199254740991, p = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13], h = 1e7, m = 1e9;
      function g(y) {
        var S, R, P, N = K.prototype = { constructor: K, toString: null, valueOf: null }, G = new K(1), V = 20, q = 4, J = -7, W = 21, $ = -1e7, X = 1e7, Z = !1, le = 1, pe = 0, ce = {
          prefix: "",
          groupSize: 3,
          secondaryGroupSize: 0,
          groupSeparator: ",",
          decimalSeparator: ".",
          fractionGroupSize: 0,
          fractionGroupSeparator: " ",
          // non-breaking space
          suffix: ""
        }, Ce = "0123456789abcdefghijklmnopqrstuvwxyz", Et = !0;
        function K(I, M) {
          var x, B, L, F, H, A, k, U, b = this;
          if (!(b instanceof K)) return new K(I, M);
          if (M == null) {
            if (I && I._isBigNumber === !0) {
              b.s = I.s, !I.c || I.e > X ? b.c = b.e = null : I.e < $ ? b.c = [b.e = 0] : (b.e = I.e, b.c = I.c.slice());
              return;
            }
            if ((A = typeof I == "number") && I * 0 == 0) {
              if (b.s = 1 / I < 0 ? (I = -I, -1) : 1, I === ~~I) {
                for (F = 0, H = I; H >= 10; H /= 10, F++) ;
                F > X ? b.c = b.e = null : (b.e = F, b.c = [I]);
                return;
              }
              U = String(I);
            } else {
              if (!i.test(U = String(I))) return P(b, U, A);
              b.s = U.charCodeAt(0) == 45 ? (U = U.slice(1), -1) : 1;
            }
            (F = U.indexOf(".")) > -1 && (U = U.replace(".", "")), (H = U.search(/e/i)) > 0 ? (F < 0 && (F = H), F += +U.slice(H + 1), U = U.substring(0, H)) : F < 0 && (F = U.length);
          } else {
            if (C(M, 2, Ce.length, "Base"), M == 10 && Et)
              return b = new K(I), Se(b, V + b.e + 1, q);
            if (U = String(I), A = typeof I == "number") {
              if (I * 0 != 0) return P(b, U, A, M);
              if (b.s = 1 / I < 0 ? (U = U.slice(1), -1) : 1, K.DEBUG && U.replace(/^0\.0*|\./, "").length > 15)
                throw Error(l + I);
            } else
              b.s = U.charCodeAt(0) === 45 ? (U = U.slice(1), -1) : 1;
            for (x = Ce.slice(0, M), F = H = 0, k = U.length; H < k; H++)
              if (x.indexOf(B = U.charAt(H)) < 0) {
                if (B == ".") {
                  if (H > F) {
                    F = k;
                    continue;
                  }
                } else if (!L && (U == U.toUpperCase() && (U = U.toLowerCase()) || U == U.toLowerCase() && (U = U.toUpperCase()))) {
                  L = !0, H = -1, F = 0;
                  continue;
                }
                return P(b, String(I), A, M);
              }
            A = !1, U = R(U, M, 10, b.s), (F = U.indexOf(".")) > -1 ? U = U.replace(".", "") : F = U.length;
          }
          for (H = 0; U.charCodeAt(H) === 48; H++) ;
          for (k = U.length; U.charCodeAt(--k) === 48; ) ;
          if (U = U.slice(H, ++k)) {
            if (k -= H, A && K.DEBUG && k > 15 && (I > d || I !== o(I)))
              throw Error(l + b.s * I);
            if ((F = F - H - 1) > X)
              b.c = b.e = null;
            else if (F < $)
              b.c = [b.e = 0];
            else {
              if (b.e = F, b.c = [], H = (F + 1) % c, F < 0 && (H += c), H < k) {
                for (H && b.c.push(+U.slice(0, H)), k -= c; H < k; )
                  b.c.push(+U.slice(H, H += c));
                H = c - (U = U.slice(H)).length;
              } else
                H -= k;
              for (; H--; U += "0") ;
              b.c.push(+U);
            }
          } else
            b.c = [b.e = 0];
        }
        K.clone = g, K.ROUND_UP = 0, K.ROUND_DOWN = 1, K.ROUND_CEIL = 2, K.ROUND_FLOOR = 3, K.ROUND_HALF_UP = 4, K.ROUND_HALF_DOWN = 5, K.ROUND_HALF_EVEN = 6, K.ROUND_HALF_CEIL = 7, K.ROUND_HALF_FLOOR = 8, K.EUCLID = 9, K.config = K.set = function(I) {
          var M, x;
          if (I != null)
            if (typeof I == "object") {
              if (I.hasOwnProperty(M = "DECIMAL_PLACES") && (x = I[M], C(x, 0, m, M), V = x), I.hasOwnProperty(M = "ROUNDING_MODE") && (x = I[M], C(x, 0, 8, M), q = x), I.hasOwnProperty(M = "EXPONENTIAL_AT") && (x = I[M], x && x.pop ? (C(x[0], -m, 0, M), C(x[1], 0, m, M), J = x[0], W = x[1]) : (C(x, -m, m, M), J = -(W = x < 0 ? -x : x))), I.hasOwnProperty(M = "RANGE"))
                if (x = I[M], x && x.pop)
                  C(x[0], -m, -1, M), C(x[1], 1, m, M), $ = x[0], X = x[1];
                else if (C(x, -m, m, M), x)
                  $ = -(X = x < 0 ? -x : x);
                else
                  throw Error(a + M + " cannot be zero: " + x);
              if (I.hasOwnProperty(M = "CRYPTO"))
                if (x = I[M], x === !!x)
                  if (x)
                    if (typeof crypto < "u" && crypto && (crypto.getRandomValues || crypto.randomBytes))
                      Z = x;
                    else
                      throw Z = !x, Error(a + "crypto unavailable");
                  else
                    Z = x;
                else
                  throw Error(a + M + " not true or false: " + x);
              if (I.hasOwnProperty(M = "MODULO_MODE") && (x = I[M], C(x, 0, 9, M), le = x), I.hasOwnProperty(M = "POW_PRECISION") && (x = I[M], C(x, 0, m, M), pe = x), I.hasOwnProperty(M = "FORMAT"))
                if (x = I[M], typeof x == "object") ce = x;
                else throw Error(a + M + " not an object: " + x);
              if (I.hasOwnProperty(M = "ALPHABET"))
                if (x = I[M], typeof x == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(x))
                  Et = x.slice(0, 10) == "0123456789", Ce = x;
                else
                  throw Error(a + M + " invalid: " + x);
            } else
              throw Error(a + "Object expected: " + I);
          return {
            DECIMAL_PLACES: V,
            ROUNDING_MODE: q,
            EXPONENTIAL_AT: [J, W],
            RANGE: [$, X],
            CRYPTO: Z,
            MODULO_MODE: le,
            POW_PRECISION: pe,
            FORMAT: ce,
            ALPHABET: Ce
          };
        }, K.isBigNumber = function(I) {
          if (!I || I._isBigNumber !== !0) return !1;
          if (!K.DEBUG) return !0;
          var M, x, B = I.c, L = I.e, F = I.s;
          e: if ({}.toString.call(B) == "[object Array]") {
            if ((F === 1 || F === -1) && L >= -m && L <= m && L === o(L)) {
              if (B[0] === 0) {
                if (L === 0 && B.length === 1) return !0;
                break e;
              }
              if (M = (L + 1) % c, M < 1 && (M += c), String(B[0]).length == M) {
                for (M = 0; M < B.length; M++)
                  if (x = B[M], x < 0 || x >= f || x !== o(x)) break e;
                if (x !== 0) return !0;
              }
            }
          } else if (B === null && L === null && (F === null || F === 1 || F === -1))
            return !0;
          throw Error(a + "Invalid BigNumber: " + I);
        }, K.maximum = K.max = function() {
          return St(arguments, -1);
        }, K.minimum = K.min = function() {
          return St(arguments, 1);
        }, K.random = (function() {
          var I = 9007199254740992, M = Math.random() * I & 2097151 ? function() {
            return o(Math.random() * I);
          } : function() {
            return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
          };
          return function(x) {
            var B, L, F, H, A, k = 0, U = [], b = new K(G);
            if (x == null ? x = V : C(x, 0, m), H = r(x / c), Z)
              if (crypto.getRandomValues) {
                for (B = crypto.getRandomValues(new Uint32Array(H *= 2)); k < H; )
                  A = B[k] * 131072 + (B[k + 1] >>> 11), A >= 9e15 ? (L = crypto.getRandomValues(new Uint32Array(2)), B[k] = L[0], B[k + 1] = L[1]) : (U.push(A % 1e14), k += 2);
                k = H / 2;
              } else if (crypto.randomBytes) {
                for (B = crypto.randomBytes(H *= 7); k < H; )
                  A = (B[k] & 31) * 281474976710656 + B[k + 1] * 1099511627776 + B[k + 2] * 4294967296 + B[k + 3] * 16777216 + (B[k + 4] << 16) + (B[k + 5] << 8) + B[k + 6], A >= 9e15 ? crypto.randomBytes(7).copy(B, k) : (U.push(A % 1e14), k += 7);
                k = H / 7;
              } else
                throw Z = !1, Error(a + "crypto unavailable");
            if (!Z)
              for (; k < H; )
                A = M(), A < 9e15 && (U[k++] = A % 1e14);
            for (H = U[--k], x %= c, H && x && (A = p[c - x], U[k] = o(H / A) * A); U[k] === 0; U.pop(), k--) ;
            if (k < 0)
              U = [F = 0];
            else {
              for (F = -1; U[0] === 0; U.splice(0, 1), F -= c) ;
              for (k = 1, A = U[0]; A >= 10; A /= 10, k++) ;
              k < c && (F -= c - k);
            }
            return b.e = F, b.c = U, b;
          };
        })(), K.sum = function() {
          for (var I = 1, M = arguments, x = new K(M[0]); I < M.length; ) x = x.plus(M[I++]);
          return x;
        }, R = /* @__PURE__ */ (function() {
          var I = "0123456789";
          function M(x, B, L, F) {
            for (var H, A = [0], k, U = 0, b = x.length; U < b; ) {
              for (k = A.length; k--; A[k] *= B) ;
              for (A[0] += F.indexOf(x.charAt(U++)), H = 0; H < A.length; H++)
                A[H] > L - 1 && (A[H + 1] == null && (A[H + 1] = 0), A[H + 1] += A[H] / L | 0, A[H] %= L);
            }
            return A.reverse();
          }
          return function(x, B, L, F, H) {
            var A, k, U, b, O, Y, Q, ee, se = x.indexOf("."), ue = V, te = q;
            for (se >= 0 && (b = pe, pe = 0, x = x.replace(".", ""), ee = new K(B), Y = ee.pow(x.length - se), pe = b, ee.c = M(
              _(E(Y.c), Y.e, "0"),
              10,
              L,
              I
            ), ee.e = ee.c.length), Q = M(x, B, L, H ? (A = Ce, I) : (A = I, Ce)), U = b = Q.length; Q[--b] == 0; Q.pop()) ;
            if (!Q[0]) return A.charAt(0);
            if (se < 0 ? --U : (Y.c = Q, Y.e = U, Y.s = F, Y = S(Y, ee, ue, te, L), Q = Y.c, O = Y.r, U = Y.e), k = U + ue + 1, se = Q[k], b = L / 2, O = O || k < 0 || Q[k + 1] != null, O = te < 4 ? (se != null || O) && (te == 0 || te == (Y.s < 0 ? 3 : 2)) : se > b || se == b && (te == 4 || O || te == 6 && Q[k - 1] & 1 || te == (Y.s < 0 ? 8 : 7)), k < 1 || !Q[0])
              x = O ? _(A.charAt(1), -ue, A.charAt(0)) : A.charAt(0);
            else {
              if (Q.length = k, O)
                for (--L; ++Q[--k] > L; )
                  Q[k] = 0, k || (++U, Q = [1].concat(Q));
              for (b = Q.length; !Q[--b]; ) ;
              for (se = 0, x = ""; se <= b; x += A.charAt(Q[se++])) ;
              x = _(x, U, A.charAt(0));
            }
            return x;
          };
        })(), S = /* @__PURE__ */ (function() {
          function I(B, L, F) {
            var H, A, k, U, b = 0, O = B.length, Y = L % h, Q = L / h | 0;
            for (B = B.slice(); O--; )
              k = B[O] % h, U = B[O] / h | 0, H = Q * k + U * Y, A = Y * k + H % h * h + b, b = (A / F | 0) + (H / h | 0) + Q * U, B[O] = A % F;
            return b && (B = [b].concat(B)), B;
          }
          function M(B, L, F, H) {
            var A, k;
            if (F != H)
              k = F > H ? 1 : -1;
            else
              for (A = k = 0; A < F; A++)
                if (B[A] != L[A]) {
                  k = B[A] > L[A] ? 1 : -1;
                  break;
                }
            return k;
          }
          function x(B, L, F, H) {
            for (var A = 0; F--; )
              B[F] -= A, A = B[F] < L[F] ? 1 : 0, B[F] = A * H + B[F] - L[F];
            for (; !B[0] && B.length > 1; B.splice(0, 1)) ;
          }
          return function(B, L, F, H, A) {
            var k, U, b, O, Y, Q, ee, se, ue, te, re, fe, be, de, ne, ae, Ie, me = B.s == L.s ? 1 : -1, ge = B.c, oe = L.c;
            if (!ge || !ge[0] || !oe || !oe[0])
              return new K(
                // Return NaN if either NaN, or both Infinity or 0.
                !B.s || !L.s || (ge ? oe && ge[0] == oe[0] : !oe) ? NaN : (
                  // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
                  ge && ge[0] == 0 || !oe ? me * 0 : me / 0
                )
              );
            for (se = new K(me), ue = se.c = [], U = B.e - L.e, me = F + U + 1, A || (A = f, U = v(B.e / c) - v(L.e / c), me = me / c | 0), b = 0; oe[b] == (ge[b] || 0); b++) ;
            if (oe[b] > (ge[b] || 0) && U--, me < 0)
              ue.push(1), O = !0;
            else {
              for (de = ge.length, ae = oe.length, b = 0, me += 2, Y = o(A / (oe[0] + 1)), Y > 1 && (oe = I(oe, Y, A), ge = I(ge, Y, A), ae = oe.length, de = ge.length), be = ae, te = ge.slice(0, ae), re = te.length; re < ae; te[re++] = 0) ;
              Ie = oe.slice(), Ie = [0].concat(Ie), ne = oe[0], oe[1] >= A / 2 && ne++;
              do {
                if (Y = 0, k = M(oe, te, ae, re), k < 0) {
                  if (fe = te[0], ae != re && (fe = fe * A + (te[1] || 0)), Y = o(fe / ne), Y > 1)
                    for (Y >= A && (Y = A - 1), Q = I(oe, Y, A), ee = Q.length, re = te.length; M(Q, te, ee, re) == 1; )
                      Y--, x(Q, ae < ee ? Ie : oe, ee, A), ee = Q.length, k = 1;
                  else
                    Y == 0 && (k = Y = 1), Q = oe.slice(), ee = Q.length;
                  if (ee < re && (Q = [0].concat(Q)), x(te, Q, re, A), re = te.length, k == -1)
                    for (; M(oe, te, ae, re) < 1; )
                      Y++, x(te, ae < re ? Ie : oe, re, A), re = te.length;
                } else k === 0 && (Y++, te = [0]);
                ue[b++] = Y, te[0] ? te[re++] = ge[be] || 0 : (te = [ge[be]], re = 1);
              } while ((be++ < de || te[0] != null) && me--);
              O = te[0] != null, ue[0] || ue.splice(0, 1);
            }
            if (A == f) {
              for (b = 1, me = ue[0]; me >= 10; me /= 10, b++) ;
              Se(se, F + (se.e = b + U * c - 1) + 1, H, O);
            } else
              se.e = U, se.r = +O;
            return se;
          };
        })();
        function Tt(I, M, x, B) {
          var L, F, H, A, k;
          if (x == null ? x = q : C(x, 0, 8), !I.c) return I.toString();
          if (L = I.c[0], H = I.e, M == null)
            k = E(I.c), k = B == 1 || B == 2 && (H <= J || H >= W) ? D(k, H) : _(k, H, "0");
          else if (I = Se(new K(I), M, x), F = I.e, k = E(I.c), A = k.length, B == 1 || B == 2 && (M <= F || F <= J)) {
            for (; A < M; k += "0", A++) ;
            k = D(k, F);
          } else if (M -= H + (B === 2 && F > H), k = _(k, F, "0"), F + 1 > A) {
            if (--M > 0) for (k += "."; M--; k += "0") ;
          } else if (M += F - A, M > 0)
            for (F + 1 == A && (k += "."); M--; k += "0") ;
          return I.s < 0 && L ? "-" + k : k;
        }
        function St(I, M) {
          for (var x, B, L = 1, F = new K(I[0]); L < I.length; L++)
            B = new K(I[L]), (!B.s || (x = T(F, B)) === M || x === 0 && F.s === M) && (F = B);
          return F;
        }
        function Ct(I, M, x) {
          for (var B = 1, L = M.length; !M[--L]; M.pop()) ;
          for (L = M[0]; L >= 10; L /= 10, B++) ;
          return (x = B + x * c - 1) > X ? I.c = I.e = null : x < $ ? I.c = [I.e = 0] : (I.e = x, I.c = M), I;
        }
        P = /* @__PURE__ */ (function() {
          var I = /^(-?)0([xbo])(?=\w[\w.]*$)/i, M = /^([^.]+)\.$/, x = /^\.([^.]+)$/, B = /^-?(Infinity|NaN)$/, L = /^\s*\+(?=[\w.])|^\s+|\s+$/g;
          return function(F, H, A, k) {
            var U, b = A ? H : H.replace(L, "");
            if (B.test(b))
              F.s = isNaN(b) ? null : b < 0 ? -1 : 1;
            else {
              if (!A && (b = b.replace(I, function(O, Y, Q) {
                return U = (Q = Q.toLowerCase()) == "x" ? 16 : Q == "b" ? 2 : 8, !k || k == U ? Y : O;
              }), k && (U = k, b = b.replace(M, "$1").replace(x, "0.$1")), H != b))
                return new K(b, U);
              if (K.DEBUG)
                throw Error(a + "Not a" + (k ? " base " + k : "") + " number: " + H);
              F.s = null;
            }
            F.c = F.e = null;
          };
        })();
        function Se(I, M, x, B) {
          var L, F, H, A, k, U, b, O = I.c, Y = p;
          if (O) {
            e: {
              for (L = 1, A = O[0]; A >= 10; A /= 10, L++) ;
              if (F = M - L, F < 0)
                F += c, H = M, k = O[U = 0], b = o(k / Y[L - H - 1] % 10);
              else if (U = r((F + 1) / c), U >= O.length)
                if (B) {
                  for (; O.length <= U; O.push(0)) ;
                  k = b = 0, L = 1, F %= c, H = F - c + 1;
                } else
                  break e;
              else {
                for (k = A = O[U], L = 1; A >= 10; A /= 10, L++) ;
                F %= c, H = F - c + L, b = H < 0 ? 0 : o(k / Y[L - H - 1] % 10);
              }
              if (B = B || M < 0 || // Are there any non-zero digits after the rounding digit?
              // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
              // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
              O[U + 1] != null || (H < 0 ? k : k % Y[L - H - 1]), B = x < 4 ? (b || B) && (x == 0 || x == (I.s < 0 ? 3 : 2)) : b > 5 || b == 5 && (x == 4 || B || x == 6 && // Check whether the digit to the left of the rounding digit is odd.
              (F > 0 ? H > 0 ? k / Y[L - H] : 0 : O[U - 1]) % 10 & 1 || x == (I.s < 0 ? 8 : 7)), M < 1 || !O[0])
                return O.length = 0, B ? (M -= I.e + 1, O[0] = Y[(c - M % c) % c], I.e = -M || 0) : O[0] = I.e = 0, I;
              if (F == 0 ? (O.length = U, A = 1, U--) : (O.length = U + 1, A = Y[c - F], O[U] = H > 0 ? o(k / Y[L - H] % Y[H]) * A : 0), B)
                for (; ; )
                  if (U == 0) {
                    for (F = 1, H = O[0]; H >= 10; H /= 10, F++) ;
                    for (H = O[0] += A, A = 1; H >= 10; H /= 10, A++) ;
                    F != A && (I.e++, O[0] == f && (O[0] = 1));
                    break;
                  } else {
                    if (O[U] += A, O[U] != f) break;
                    O[U--] = 0, A = 1;
                  }
              for (F = O.length; O[--F] === 0; O.pop()) ;
            }
            I.e > X ? I.c = I.e = null : I.e < $ && (I.c = [I.e = 0]);
          }
          return I;
        }
        function Ne(I) {
          var M, x = I.e;
          return x === null ? I.toString() : (M = E(I.c), M = x <= J || x >= W ? D(M, x) : _(M, x, "0"), I.s < 0 ? "-" + M : M);
        }
        return N.absoluteValue = N.abs = function() {
          var I = new K(this);
          return I.s < 0 && (I.s = 1), I;
        }, N.comparedTo = function(I, M) {
          return T(this, new K(I, M));
        }, N.decimalPlaces = N.dp = function(I, M) {
          var x, B, L, F = this;
          if (I != null)
            return C(I, 0, m), M == null ? M = q : C(M, 0, 8), Se(new K(F), I + F.e + 1, M);
          if (!(x = F.c)) return null;
          if (B = ((L = x.length - 1) - v(this.e / c)) * c, L = x[L]) for (; L % 10 == 0; L /= 10, B--) ;
          return B < 0 && (B = 0), B;
        }, N.dividedBy = N.div = function(I, M) {
          return S(this, new K(I, M), V, q);
        }, N.dividedToIntegerBy = N.idiv = function(I, M) {
          return S(this, new K(I, M), 0, 1);
        }, N.exponentiatedBy = N.pow = function(I, M) {
          var x, B, L, F, H, A, k, U, b, O = this;
          if (I = new K(I), I.c && !I.isInteger())
            throw Error(a + "Exponent not an integer: " + Ne(I));
          if (M != null && (M = new K(M)), A = I.e > 14, !O.c || !O.c[0] || O.c[0] == 1 && !O.e && O.c.length == 1 || !I.c || !I.c[0])
            return b = new K(Math.pow(+Ne(O), A ? I.s * (2 - w(I)) : +Ne(I))), M ? b.mod(M) : b;
          if (k = I.s < 0, M) {
            if (M.c ? !M.c[0] : !M.s) return new K(NaN);
            B = !k && O.isInteger() && M.isInteger(), B && (O = O.mod(M));
          } else {
            if (I.e > 9 && (O.e > 0 || O.e < -1 || (O.e == 0 ? O.c[0] > 1 || A && O.c[1] >= 24e7 : O.c[0] < 8e13 || A && O.c[0] <= 9999975e7)))
              return F = O.s < 0 && w(I) ? -0 : 0, O.e > -1 && (F = 1 / F), new K(k ? 1 / F : F);
            pe && (F = r(pe / c + 2));
          }
          for (A ? (x = new K(0.5), k && (I.s = 1), U = w(I)) : (L = Math.abs(+Ne(I)), U = L % 2), b = new K(G); ; ) {
            if (U) {
              if (b = b.times(O), !b.c) break;
              F ? b.c.length > F && (b.c.length = F) : B && (b = b.mod(M));
            }
            if (L) {
              if (L = o(L / 2), L === 0) break;
              U = L % 2;
            } else if (I = I.times(x), Se(I, I.e + 1, 1), I.e > 14)
              U = w(I);
            else {
              if (L = +Ne(I), L === 0) break;
              U = L % 2;
            }
            O = O.times(O), F ? O.c && O.c.length > F && (O.c.length = F) : B && (O = O.mod(M));
          }
          return B ? b : (k && (b = G.div(b)), M ? b.mod(M) : F ? Se(b, pe, q, H) : b);
        }, N.integerValue = function(I) {
          var M = new K(this);
          return I == null ? I = q : C(I, 0, 8), Se(M, M.e + 1, I);
        }, N.isEqualTo = N.eq = function(I, M) {
          return T(this, new K(I, M)) === 0;
        }, N.isFinite = function() {
          return !!this.c;
        }, N.isGreaterThan = N.gt = function(I, M) {
          return T(this, new K(I, M)) > 0;
        }, N.isGreaterThanOrEqualTo = N.gte = function(I, M) {
          return (M = T(this, new K(I, M))) === 1 || M === 0;
        }, N.isInteger = function() {
          return !!this.c && v(this.e / c) > this.c.length - 2;
        }, N.isLessThan = N.lt = function(I, M) {
          return T(this, new K(I, M)) < 0;
        }, N.isLessThanOrEqualTo = N.lte = function(I, M) {
          return (M = T(this, new K(I, M))) === -1 || M === 0;
        }, N.isNaN = function() {
          return !this.s;
        }, N.isNegative = function() {
          return this.s < 0;
        }, N.isPositive = function() {
          return this.s > 0;
        }, N.isZero = function() {
          return !!this.c && this.c[0] == 0;
        }, N.minus = function(I, M) {
          var x, B, L, F, H = this, A = H.s;
          if (I = new K(I, M), M = I.s, !A || !M) return new K(NaN);
          if (A != M)
            return I.s = -M, H.plus(I);
          var k = H.e / c, U = I.e / c, b = H.c, O = I.c;
          if (!k || !U) {
            if (!b || !O) return b ? (I.s = -M, I) : new K(O ? H : NaN);
            if (!b[0] || !O[0])
              return O[0] ? (I.s = -M, I) : new K(b[0] ? H : (
                // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
                q == 3 ? -0 : 0
              ));
          }
          if (k = v(k), U = v(U), b = b.slice(), A = k - U) {
            for ((F = A < 0) ? (A = -A, L = b) : (U = k, L = O), L.reverse(), M = A; M--; L.push(0)) ;
            L.reverse();
          } else
            for (B = (F = (A = b.length) < (M = O.length)) ? A : M, A = M = 0; M < B; M++)
              if (b[M] != O[M]) {
                F = b[M] < O[M];
                break;
              }
          if (F && (L = b, b = O, O = L, I.s = -I.s), M = (B = O.length) - (x = b.length), M > 0) for (; M--; b[x++] = 0) ;
          for (M = f - 1; B > A; ) {
            if (b[--B] < O[B]) {
              for (x = B; x && !b[--x]; b[x] = M) ;
              --b[x], b[B] += f;
            }
            b[B] -= O[B];
          }
          for (; b[0] == 0; b.splice(0, 1), --U) ;
          return b[0] ? Ct(I, b, U) : (I.s = q == 3 ? -1 : 1, I.c = [I.e = 0], I);
        }, N.modulo = N.mod = function(I, M) {
          var x, B, L = this;
          return I = new K(I, M), !L.c || !I.s || I.c && !I.c[0] ? new K(NaN) : !I.c || L.c && !L.c[0] ? new K(L) : (le == 9 ? (B = I.s, I.s = 1, x = S(L, I, 0, 3), I.s = B, x.s *= B) : x = S(L, I, 0, le), I = L.minus(x.times(I)), !I.c[0] && le == 1 && (I.s = L.s), I);
        }, N.multipliedBy = N.times = function(I, M) {
          var x, B, L, F, H, A, k, U, b, O, Y, Q, ee, se, ue, te = this, re = te.c, fe = (I = new K(I, M)).c;
          if (!re || !fe || !re[0] || !fe[0])
            return !te.s || !I.s || re && !re[0] && !fe || fe && !fe[0] && !re ? I.c = I.e = I.s = null : (I.s *= te.s, !re || !fe ? I.c = I.e = null : (I.c = [0], I.e = 0)), I;
          for (B = v(te.e / c) + v(I.e / c), I.s *= te.s, k = re.length, O = fe.length, k < O && (ee = re, re = fe, fe = ee, L = k, k = O, O = L), L = k + O, ee = []; L--; ee.push(0)) ;
          for (se = f, ue = h, L = O; --L >= 0; ) {
            for (x = 0, Y = fe[L] % ue, Q = fe[L] / ue | 0, H = k, F = L + H; F > L; )
              U = re[--H] % ue, b = re[H] / ue | 0, A = Q * U + b * Y, U = Y * U + A % ue * ue + ee[F] + x, x = (U / se | 0) + (A / ue | 0) + Q * b, ee[F--] = U % se;
            ee[F] = x;
          }
          return x ? ++B : ee.splice(0, 1), Ct(I, ee, B);
        }, N.negated = function() {
          var I = new K(this);
          return I.s = -I.s || null, I;
        }, N.plus = function(I, M) {
          var x, B = this, L = B.s;
          if (I = new K(I, M), M = I.s, !L || !M) return new K(NaN);
          if (L != M)
            return I.s = -M, B.minus(I);
          var F = B.e / c, H = I.e / c, A = B.c, k = I.c;
          if (!F || !H) {
            if (!A || !k) return new K(L / 0);
            if (!A[0] || !k[0]) return k[0] ? I : new K(A[0] ? B : L * 0);
          }
          if (F = v(F), H = v(H), A = A.slice(), L = F - H) {
            for (L > 0 ? (H = F, x = k) : (L = -L, x = A), x.reverse(); L--; x.push(0)) ;
            x.reverse();
          }
          for (L = A.length, M = k.length, L - M < 0 && (x = k, k = A, A = x, M = L), L = 0; M; )
            L = (A[--M] = A[M] + k[M] + L) / f | 0, A[M] = f === A[M] ? 0 : A[M] % f;
          return L && (A = [L].concat(A), ++H), Ct(I, A, H);
        }, N.precision = N.sd = function(I, M) {
          var x, B, L, F = this;
          if (I != null && I !== !!I)
            return C(I, 1, m), M == null ? M = q : C(M, 0, 8), Se(new K(F), I, M);
          if (!(x = F.c)) return null;
          if (L = x.length - 1, B = L * c + 1, L = x[L]) {
            for (; L % 10 == 0; L /= 10, B--) ;
            for (L = x[0]; L >= 10; L /= 10, B++) ;
          }
          return I && F.e + 1 > B && (B = F.e + 1), B;
        }, N.shiftedBy = function(I) {
          return C(I, -d, d), this.times("1e" + I);
        }, N.squareRoot = N.sqrt = function() {
          var I, M, x, B, L, F = this, H = F.c, A = F.s, k = F.e, U = V + 4, b = new K("0.5");
          if (A !== 1 || !H || !H[0])
            return new K(!A || A < 0 && (!H || H[0]) ? NaN : H ? F : 1 / 0);
          if (A = Math.sqrt(+Ne(F)), A == 0 || A == 1 / 0 ? (M = E(H), (M.length + k) % 2 == 0 && (M += "0"), A = Math.sqrt(+M), k = v((k + 1) / 2) - (k < 0 || k % 2), A == 1 / 0 ? M = "5e" + k : (M = A.toExponential(), M = M.slice(0, M.indexOf("e") + 1) + k), x = new K(M)) : x = new K(A + ""), x.c[0]) {
            for (k = x.e, A = k + U, A < 3 && (A = 0); ; )
              if (L = x, x = b.times(L.plus(S(F, L, U, 1))), E(L.c).slice(0, A) === (M = E(x.c)).slice(0, A))
                if (x.e < k && --A, M = M.slice(A - 3, A + 1), M == "9999" || !B && M == "4999") {
                  if (!B && (Se(L, L.e + V + 2, 0), L.times(L).eq(F))) {
                    x = L;
                    break;
                  }
                  U += 4, A += 4, B = 1;
                } else {
                  (!+M || !+M.slice(1) && M.charAt(0) == "5") && (Se(x, x.e + V + 2, 1), I = !x.times(x).eq(F));
                  break;
                }
          }
          return Se(x, x.e + V + 1, q, I);
        }, N.toExponential = function(I, M) {
          return I != null && (C(I, 0, m), I++), Tt(this, I, M, 1);
        }, N.toFixed = function(I, M) {
          return I != null && (C(I, 0, m), I = I + this.e + 1), Tt(this, I, M);
        }, N.toFormat = function(I, M, x) {
          var B, L = this;
          if (x == null)
            I != null && M && typeof M == "object" ? (x = M, M = null) : I && typeof I == "object" ? (x = I, I = M = null) : x = ce;
          else if (typeof x != "object")
            throw Error(a + "Argument not an object: " + x);
          if (B = L.toFixed(I, M), L.c) {
            var F, H = B.split("."), A = +x.groupSize, k = +x.secondaryGroupSize, U = x.groupSeparator || "", b = H[0], O = H[1], Y = L.s < 0, Q = Y ? b.slice(1) : b, ee = Q.length;
            if (k && (F = A, A = k, k = F, ee -= F), A > 0 && ee > 0) {
              for (F = ee % A || A, b = Q.substr(0, F); F < ee; F += A) b += U + Q.substr(F, A);
              k > 0 && (b += U + Q.slice(F)), Y && (b = "-" + b);
            }
            B = O ? b + (x.decimalSeparator || "") + ((k = +x.fractionGroupSize) ? O.replace(
              new RegExp("\\d{" + k + "}\\B", "g"),
              "$&" + (x.fractionGroupSeparator || "")
            ) : O) : b;
          }
          return (x.prefix || "") + B + (x.suffix || "");
        }, N.toFraction = function(I) {
          var M, x, B, L, F, H, A, k, U, b, O, Y, Q = this, ee = Q.c;
          if (I != null && (A = new K(I), !A.isInteger() && (A.c || A.s !== 1) || A.lt(G)))
            throw Error(a + "Argument " + (A.isInteger() ? "out of range: " : "not an integer: ") + Ne(A));
          if (!ee) return new K(Q);
          for (M = new K(G), U = x = new K(G), B = k = new K(G), Y = E(ee), F = M.e = Y.length - Q.e - 1, M.c[0] = p[(H = F % c) < 0 ? c + H : H], I = !I || A.comparedTo(M) > 0 ? F > 0 ? M : U : A, H = X, X = 1 / 0, A = new K(Y), k.c[0] = 0; b = S(A, M, 0, 1), L = x.plus(b.times(B)), L.comparedTo(I) != 1; )
            x = B, B = L, U = k.plus(b.times(L = U)), k = L, M = A.minus(b.times(L = M)), A = L;
          return L = S(I.minus(x), B, 0, 1), k = k.plus(L.times(U)), x = x.plus(L.times(B)), k.s = U.s = Q.s, F = F * 2, O = S(U, B, F, q).minus(Q).abs().comparedTo(
            S(k, x, F, q).minus(Q).abs()
          ) < 1 ? [U, B] : [k, x], X = H, O;
        }, N.toNumber = function() {
          return +Ne(this);
        }, N.toPrecision = function(I, M) {
          return I != null && C(I, 1, m), Tt(this, I, M, 2);
        }, N.toString = function(I) {
          var M, x = this, B = x.s, L = x.e;
          return L === null ? B ? (M = "Infinity", B < 0 && (M = "-" + M)) : M = "NaN" : (I == null ? M = L <= J || L >= W ? D(E(x.c), L) : _(E(x.c), L, "0") : I === 10 && Et ? (x = Se(new K(x), V + L + 1, q), M = _(E(x.c), x.e, "0")) : (C(I, 2, Ce.length, "Base"), M = R(_(E(x.c), L, "0"), 10, I, B, !0)), B < 0 && x.c[0] && (M = "-" + M)), M;
        }, N.valueOf = N.toJSON = function() {
          return Ne(this);
        }, N._isBigNumber = !0, y != null && K.set(y), K;
      }
      function v(y) {
        var S = y | 0;
        return y > 0 || y === S ? S : S - 1;
      }
      function E(y) {
        for (var S, R, P = 1, N = y.length, G = y[0] + ""; P < N; ) {
          for (S = y[P++] + "", R = c - S.length; R--; S = "0" + S) ;
          G += S;
        }
        for (N = G.length; G.charCodeAt(--N) === 48; ) ;
        return G.slice(0, N + 1 || 1);
      }
      function T(y, S) {
        var R, P, N = y.c, G = S.c, V = y.s, q = S.s, J = y.e, W = S.e;
        if (!V || !q) return null;
        if (R = N && !N[0], P = G && !G[0], R || P) return R ? P ? 0 : -q : V;
        if (V != q) return V;
        if (R = V < 0, P = J == W, !N || !G) return P ? 0 : !N ^ R ? 1 : -1;
        if (!P) return J > W ^ R ? 1 : -1;
        for (q = (J = N.length) < (W = G.length) ? J : W, V = 0; V < q; V++) if (N[V] != G[V]) return N[V] > G[V] ^ R ? 1 : -1;
        return J == W ? 0 : J > W ^ R ? 1 : -1;
      }
      function C(y, S, R, P) {
        if (y < S || y > R || y !== o(y))
          throw Error(a + (P || "Argument") + (typeof y == "number" ? y < S || y > R ? " out of range: " : " not an integer: " : " not a primitive number: ") + String(y));
      }
      function w(y) {
        var S = y.c.length - 1;
        return v(y.e / c) == S && y.c[S] % 2 != 0;
      }
      function D(y, S) {
        return (y.length > 1 ? y.charAt(0) + "." + y.slice(1) : y) + (S < 0 ? "e" : "e+") + S;
      }
      function _(y, S, R) {
        var P, N;
        if (S < 0) {
          for (N = R + "."; ++S; N += R) ;
          y = N + y;
        } else if (P = y.length, ++S > P) {
          for (N = R, S -= P; --S; N += R) ;
          y += N;
        } else S < P && (y = y.slice(0, S) + "." + y.slice(S));
        return y;
      }
      n = g(), n.default = n.BigNumber = n, t.exports ? t.exports = n : (e || (e = typeof self < "u" && self ? self : window), e.BigNumber = n);
    })(Vc);
  })(Tn)), Tn.exports;
}
var gr;
function Jc() {
  return gr || (gr = 1, (function(t) {
    var e = Na(), n = t.exports;
    (function() {
      var i = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, r, o, a = {
        // table of character substitutions
        "\b": "\\b",
        "	": "\\t",
        "\n": "\\n",
        "\f": "\\f",
        "\r": "\\r",
        '"': '\\"',
        "\\": "\\\\"
      }, l;
      function f(d) {
        return i.lastIndex = 0, i.test(d) ? '"' + d.replace(i, function(p) {
          var h = a[p];
          return typeof h == "string" ? h : "\\u" + ("0000" + p.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + d + '"';
      }
      function c(d, p) {
        var h, m, g, v, E = r, T, C = p[d], w = C != null && (C instanceof e || e.isBigNumber(C));
        switch (C && typeof C == "object" && typeof C.toJSON == "function" && (C = C.toJSON(d)), typeof l == "function" && (C = l.call(p, d, C)), typeof C) {
          case "string":
            return w ? C : f(C);
          case "number":
            return isFinite(C) ? String(C) : "null";
          case "boolean":
          case "null":
          case "bigint":
            return String(C);
          // If the type is 'object', we might be dealing with an object or an array or
          // null.
          case "object":
            if (!C)
              return "null";
            if (r += o, T = [], Object.prototype.toString.apply(C) === "[object Array]") {
              for (v = C.length, h = 0; h < v; h += 1)
                T[h] = c(h, C) || "null";
              return g = T.length === 0 ? "[]" : r ? `[
` + r + T.join(`,
` + r) + `
` + E + "]" : "[" + T.join(",") + "]", r = E, g;
            }
            if (l && typeof l == "object")
              for (v = l.length, h = 0; h < v; h += 1)
                typeof l[h] == "string" && (m = l[h], g = c(m, C), g && T.push(f(m) + (r ? ": " : ":") + g));
            else
              Object.keys(C).forEach(function(D) {
                var _ = c(D, C);
                _ && T.push(f(D) + (r ? ": " : ":") + _);
              });
            return g = T.length === 0 ? "{}" : r ? `{
` + r + T.join(`,
` + r) + `
` + E + "}" : "{" + T.join(",") + "}", r = E, g;
        }
      }
      typeof n.stringify != "function" && (n.stringify = function(d, p, h) {
        var m;
        if (r = "", o = "", typeof h == "number")
          for (m = 0; m < h; m += 1)
            o += " ";
        else typeof h == "string" && (o = h);
        if (l = p, p && typeof p != "function" && (typeof p != "object" || typeof p.length != "number"))
          throw new Error("JSON.stringify");
        return c("", { "": d });
      });
    })();
  })(Xn)), Xn.exports;
}
var Qn, yr;
function $c() {
  if (yr) return Qn;
  yr = 1;
  var t = null;
  const e = /(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])/, n = /(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)/;
  var i = function(r) {
    var o = {
      strict: !1,
      // not being strict means do not generate syntax errors for "duplicate key"
      storeAsString: !1,
      // toggles whether the values should be stored as BigNumber (default) or a string
      alwaysParseAsBig: !1,
      // toggles whether all numbers should be Big
      useNativeBigInt: !1,
      // toggles whether to use native BigInt instead of bignumber.js
      protoAction: "error",
      constructorAction: "error"
    };
    if (r != null) {
      if (r.strict === !0 && (o.strict = !0), r.storeAsString === !0 && (o.storeAsString = !0), o.alwaysParseAsBig = r.alwaysParseAsBig === !0 ? r.alwaysParseAsBig : !1, o.useNativeBigInt = r.useNativeBigInt === !0 ? r.useNativeBigInt : !1, typeof r.constructorAction < "u")
        if (r.constructorAction === "error" || r.constructorAction === "ignore" || r.constructorAction === "preserve")
          o.constructorAction = r.constructorAction;
        else
          throw new Error(
            `Incorrect value for constructorAction option, must be "error", "ignore" or undefined but passed ${r.constructorAction}`
          );
      if (typeof r.protoAction < "u")
        if (r.protoAction === "error" || r.protoAction === "ignore" || r.protoAction === "preserve")
          o.protoAction = r.protoAction;
        else
          throw new Error(
            `Incorrect value for protoAction option, must be "error", "ignore" or undefined but passed ${r.protoAction}`
          );
    }
    var a, l, f = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: `
`,
      r: "\r",
      t: "	"
    }, c, d = function(w) {
      throw {
        name: "SyntaxError",
        message: w,
        at: a,
        text: c
      };
    }, p = function(w) {
      return w && w !== l && d("Expected '" + w + "' instead of '" + l + "'"), l = c.charAt(a), a += 1, l;
    }, h = function() {
      var w, D = "";
      for (l === "-" && (D = "-", p("-")); l >= "0" && l <= "9"; )
        D += l, p();
      if (l === ".")
        for (D += "."; p() && l >= "0" && l <= "9"; )
          D += l;
      if (l === "e" || l === "E")
        for (D += l, p(), (l === "-" || l === "+") && (D += l, p()); l >= "0" && l <= "9"; )
          D += l, p();
      if (w = +D, !isFinite(w))
        d("Bad number");
      else
        return t == null && (t = Na()), D.length > 15 ? o.storeAsString ? D : o.useNativeBigInt ? BigInt(D) : new t(D) : o.alwaysParseAsBig ? o.useNativeBigInt ? BigInt(w) : new t(w) : w;
    }, m = function() {
      var w, D, _ = "", y;
      if (l === '"')
        for (var S = a; p(); ) {
          if (l === '"')
            return a - 1 > S && (_ += c.substring(S, a - 1)), p(), _;
          if (l === "\\") {
            if (a - 1 > S && (_ += c.substring(S, a - 1)), p(), l === "u") {
              for (y = 0, D = 0; D < 4 && (w = parseInt(p(), 16), !!isFinite(w)); D += 1)
                y = y * 16 + w;
              _ += String.fromCharCode(y);
            } else if (typeof f[l] == "string")
              _ += f[l];
            else
              break;
            S = a;
          }
        }
      d("Bad string");
    }, g = function() {
      for (; l && l <= " "; )
        p();
    }, v = function() {
      switch (l) {
        case "t":
          return p("t"), p("r"), p("u"), p("e"), !0;
        case "f":
          return p("f"), p("a"), p("l"), p("s"), p("e"), !1;
        case "n":
          return p("n"), p("u"), p("l"), p("l"), null;
      }
      d("Unexpected '" + l + "'");
    }, E, T = function() {
      var w = [];
      if (l === "[") {
        if (p("["), g(), l === "]")
          return p("]"), w;
        for (; l; ) {
          if (w.push(E()), g(), l === "]")
            return p("]"), w;
          p(","), g();
        }
      }
      d("Bad array");
    }, C = function() {
      var w, D = /* @__PURE__ */ Object.create(null);
      if (l === "{") {
        if (p("{"), g(), l === "}")
          return p("}"), D;
        for (; l; ) {
          if (w = m(), g(), p(":"), o.strict === !0 && Object.hasOwnProperty.call(D, w) && d('Duplicate key "' + w + '"'), e.test(w) === !0 ? o.protoAction === "error" ? d("Object contains forbidden prototype property") : o.protoAction === "ignore" ? E() : D[w] = E() : n.test(w) === !0 ? o.constructorAction === "error" ? d("Object contains forbidden constructor property") : o.constructorAction === "ignore" ? E() : D[w] = E() : D[w] = E(), g(), l === "}")
            return p("}"), D;
          p(","), g();
        }
      }
      d("Bad object");
    };
    return E = function() {
      switch (g(), l) {
        case "{":
          return C();
        case "[":
          return T();
        case '"':
          return m();
        case "-":
          return h();
        default:
          return l >= "0" && l <= "9" ? h() : v();
      }
    }, function(w, D) {
      var _;
      return c = w + "", a = 0, l = " ", _ = E(), g(), l && d("Syntax error"), typeof D == "function" ? (function y(S, R) {
        var P, N = S[R];
        return N && typeof N == "object" && Object.keys(N).forEach(function(G) {
          P = y(N, G), P !== void 0 ? N[G] = P : delete N[G];
        }), D.call(S, R, N);
      })({ "": _ }, "") : _;
    };
  };
  return Qn = i, Qn;
}
var _r;
function Wc() {
  if (_r) return Pt.exports;
  _r = 1;
  var t = Jc().stringify, e = $c();
  return Pt.exports = function(n) {
    return {
      parse: e(n),
      stringify: t
    };
  }, Pt.exports.parse = e(), Pt.exports.stringify = t, Pt.exports;
}
var Zn = {}, vr;
function Er() {
  return vr || (vr = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.GCE_LINUX_BIOS_PATHS = void 0, t.isGoogleCloudServerless = r, t.isGoogleComputeEngineLinux = o, t.isGoogleComputeEngineMACAddress = a, t.isGoogleComputeEngine = l, t.detectGCPResidency = f;
    const e = st, n = Bi;
    t.GCE_LINUX_BIOS_PATHS = {
      BIOS_DATE: "/sys/class/dmi/id/bios_date",
      BIOS_VENDOR: "/sys/class/dmi/id/bios_vendor"
    };
    const i = /^42:01/;
    function r() {
      return !!(process.env.CLOUD_RUN_JOB || process.env.FUNCTION_NAME || process.env.K_SERVICE);
    }
    function o() {
      if ((0, n.platform)() !== "linux")
        return !1;
      try {
        (0, e.statSync)(t.GCE_LINUX_BIOS_PATHS.BIOS_DATE);
        const c = (0, e.readFileSync)(t.GCE_LINUX_BIOS_PATHS.BIOS_VENDOR, "utf8");
        return /Google/.test(c);
      } catch {
        return !1;
      }
    }
    function a() {
      const c = (0, n.networkInterfaces)();
      for (const d of Object.values(c))
        if (d) {
          for (const { mac: p } of d)
            if (i.test(p))
              return !0;
        }
      return !1;
    }
    function l() {
      return o() || a();
    }
    function f() {
      return r() || l();
    }
  })(Zn)), Zn;
}
var Qe = {}, Fe = {}, Nt = {}, Tr;
function Kc() {
  if (Tr) return Nt;
  Tr = 1, Object.defineProperty(Nt, "__esModule", { value: !0 }), Nt.Colours = void 0;
  class t {
    /**
     * @param stream The stream (e.g. process.stderr)
     * @returns true if the stream should have colourization enabled
     */
    static isEnabled(n) {
      return n && // May happen in browsers.
      n.isTTY && (typeof n.getColorDepth == "function" ? n.getColorDepth() > 2 : !0);
    }
    static refresh() {
      t.enabled = t.isEnabled(process == null ? void 0 : process.stderr), this.enabled ? (t.reset = "\x1B[0m", t.bright = "\x1B[1m", t.dim = "\x1B[2m", t.red = "\x1B[31m", t.green = "\x1B[32m", t.yellow = "\x1B[33m", t.blue = "\x1B[34m", t.magenta = "\x1B[35m", t.cyan = "\x1B[36m", t.white = "\x1B[37m", t.grey = "\x1B[90m") : (t.reset = "", t.bright = "", t.dim = "", t.red = "", t.green = "", t.yellow = "", t.blue = "", t.magenta = "", t.cyan = "", t.white = "", t.grey = "");
    }
  }
  return Nt.Colours = t, t.enabled = !1, t.reset = "", t.bright = "", t.dim = "", t.red = "", t.green = "", t.yellow = "", t.blue = "", t.magenta = "", t.cyan = "", t.white = "", t.grey = "", t.refresh(), Nt;
}
var Sr;
function Yc() {
  return Sr || (Sr = 1, (function(t) {
    var e = Fe && Fe.__createBinding || (Object.create ? (function(_, y, S, R) {
      R === void 0 && (R = S);
      var P = Object.getOwnPropertyDescriptor(y, S);
      (!P || ("get" in P ? !y.__esModule : P.writable || P.configurable)) && (P = { enumerable: !0, get: function() {
        return y[S];
      } }), Object.defineProperty(_, R, P);
    }) : (function(_, y, S, R) {
      R === void 0 && (R = S), _[R] = y[S];
    })), n = Fe && Fe.__setModuleDefault || (Object.create ? (function(_, y) {
      Object.defineProperty(_, "default", { enumerable: !0, value: y });
    }) : function(_, y) {
      _.default = y;
    }), i = Fe && Fe.__importStar || /* @__PURE__ */ (function() {
      var _ = function(y) {
        return _ = Object.getOwnPropertyNames || function(S) {
          var R = [];
          for (var P in S) Object.prototype.hasOwnProperty.call(S, P) && (R[R.length] = P);
          return R;
        }, _(y);
      };
      return function(y) {
        if (y && y.__esModule) return y;
        var S = {};
        if (y != null)
          for (var R = _(y), P = 0; P < R.length; P++) R[P] !== "default" && e(S, y, R[P]);
        return n(S, y), S;
      };
    })();
    Object.defineProperty(t, "__esModule", { value: !0 }), t.env = t.DebugLogBackendBase = t.placeholder = t.AdhocDebugLogger = t.LogSeverity = void 0, t.getNodeBackend = h, t.getDebugBackend = g, t.getStructuredBackend = E, t.setBackend = w, t.log = D;
    const r = kn, o = i(lc), a = i(at), l = Kc();
    var f;
    (function(_) {
      _.DEFAULT = "DEFAULT", _.DEBUG = "DEBUG", _.INFO = "INFO", _.WARNING = "WARNING", _.ERROR = "ERROR";
    })(f || (t.LogSeverity = f = {}));
    class c extends r.EventEmitter {
      /**
       * @param upstream The backend will pass a function that will be
       *   called whenever our logger function is invoked.
       */
      constructor(y, S) {
        super(), this.namespace = y, this.upstream = S, this.func = Object.assign(this.invoke.bind(this), {
          // Also add an instance pointer back to us.
          instance: this,
          // And pull over the EventEmitter functionality.
          on: (R, P) => this.on(R, P)
        }), this.func.debug = (...R) => this.invokeSeverity(f.DEBUG, ...R), this.func.info = (...R) => this.invokeSeverity(f.INFO, ...R), this.func.warn = (...R) => this.invokeSeverity(f.WARNING, ...R), this.func.error = (...R) => this.invokeSeverity(f.ERROR, ...R), this.func.sublog = (R) => D(R, this.func);
      }
      invoke(y, ...S) {
        if (this.upstream)
          try {
            this.upstream(y, ...S);
          } catch {
          }
        try {
          this.emit("log", y, S);
        } catch {
        }
      }
      invokeSeverity(y, ...S) {
        this.invoke({ severity: y }, ...S);
      }
    }
    t.AdhocDebugLogger = c, t.placeholder = new c("", () => {
    }).func;
    class d {
      constructor() {
        var y;
        this.cached = /* @__PURE__ */ new Map(), this.filters = [], this.filtersSet = !1;
        let S = (y = o.env[t.env.nodeEnables]) !== null && y !== void 0 ? y : "*";
        S === "all" && (S = "*"), this.filters = S.split(",");
      }
      log(y, S, ...R) {
        try {
          this.filtersSet || (this.setFilters(), this.filtersSet = !0);
          let P = this.cached.get(y);
          P || (P = this.makeLogger(y), this.cached.set(y, P)), P(S, ...R);
        } catch (P) {
          console.error(P);
        }
      }
    }
    t.DebugLogBackendBase = d;
    class p extends d {
      constructor() {
        super(...arguments), this.enabledRegexp = /.*/g;
      }
      isEnabled(y) {
        return this.enabledRegexp.test(y);
      }
      makeLogger(y) {
        return this.enabledRegexp.test(y) ? (S, ...R) => {
          var P;
          const N = `${l.Colours.green}${y}${l.Colours.reset}`, G = `${l.Colours.yellow}${o.pid}${l.Colours.reset}`;
          let V;
          switch (S.severity) {
            case f.ERROR:
              V = `${l.Colours.red}${S.severity}${l.Colours.reset}`;
              break;
            case f.INFO:
              V = `${l.Colours.magenta}${S.severity}${l.Colours.reset}`;
              break;
            case f.WARNING:
              V = `${l.Colours.yellow}${S.severity}${l.Colours.reset}`;
              break;
            default:
              V = (P = S.severity) !== null && P !== void 0 ? P : f.DEFAULT;
              break;
          }
          const q = a.formatWithOptions({ colors: l.Colours.enabled }, ...R), J = Object.assign({}, S);
          delete J.severity;
          const W = Object.getOwnPropertyNames(J).length ? JSON.stringify(J) : "", $ = W ? `${l.Colours.grey}${W}${l.Colours.reset}` : "";
          console.error("%s [%s|%s] %s%s", G, N, V, q, W ? ` ${$}` : "");
        } : () => {
        };
      }
      // Regexp patterns below are from here:
      // https://github.com/nodejs/node/blob/c0aebed4b3395bd65d54b18d1fd00f071002ac20/lib/internal/util/debuglog.js#L36
      setFilters() {
        const S = this.filters.join(",").replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*").replace(/,/g, "$|^");
        this.enabledRegexp = new RegExp(`^${S}$`, "i");
      }
    }
    function h() {
      return new p();
    }
    class m extends d {
      constructor(y) {
        super(), this.debugPkg = y;
      }
      makeLogger(y) {
        const S = this.debugPkg(y);
        return (R, ...P) => {
          S(P[0], ...P.slice(1));
        };
      }
      setFilters() {
        var y;
        const S = (y = o.env.NODE_DEBUG) !== null && y !== void 0 ? y : "";
        o.env.NODE_DEBUG = `${S}${S ? "," : ""}${this.filters.join(",")}`;
      }
    }
    function g(_) {
      return new m(_);
    }
    class v extends d {
      constructor(y) {
        var S;
        super(), this.upstream = (S = y) !== null && S !== void 0 ? S : void 0;
      }
      makeLogger(y) {
        var S;
        const R = (S = this.upstream) === null || S === void 0 ? void 0 : S.makeLogger(y);
        return (P, ...N) => {
          var G;
          const V = (G = P.severity) !== null && G !== void 0 ? G : f.INFO, q = Object.assign({
            severity: V,
            message: a.format(...N)
          }, P), J = JSON.stringify(q);
          R ? R(P, J) : console.log("%s", J);
        };
      }
      setFilters() {
        var y;
        (y = this.upstream) === null || y === void 0 || y.setFilters();
      }
    }
    function E(_) {
      return new v(_);
    }
    t.env = {
      /**
       * Filter wildcards specific to the Node syntax, and similar to the built-in
       * utils.debuglog() environment variable. If missing, disables logging.
       */
      nodeEnables: "GOOGLE_SDK_NODE_LOGGING"
    };
    const T = /* @__PURE__ */ new Map();
    let C;
    function w(_) {
      C = _, T.clear();
    }
    function D(_, y) {
      if (!C && !o.env[t.env.nodeEnables] || !_)
        return t.placeholder;
      y && (_ = `${y.instance.namespace}:${_}`);
      const S = T.get(_);
      if (S)
        return S.func;
      if (C === null)
        return t.placeholder;
      C === void 0 && (C = h());
      const R = (() => {
        let P;
        return new c(_, (G, ...V) => {
          if (P !== C) {
            if (C === null)
              return;
            C === void 0 && (C = h()), P = C;
          }
          C?.log(_, G, ...V);
        });
      })();
      return T.set(_, R), R.func;
    }
  })(Fe)), Fe;
}
var Cr;
function ka() {
  return Cr || (Cr = 1, (function(t) {
    var e = Qe && Qe.__createBinding || (Object.create ? (function(i, r, o, a) {
      a === void 0 && (a = o);
      var l = Object.getOwnPropertyDescriptor(r, o);
      (!l || ("get" in l ? !r.__esModule : l.writable || l.configurable)) && (l = { enumerable: !0, get: function() {
        return r[o];
      } }), Object.defineProperty(i, a, l);
    }) : (function(i, r, o, a) {
      a === void 0 && (a = o), i[a] = r[o];
    })), n = Qe && Qe.__exportStar || function(i, r) {
      for (var o in i) o !== "default" && !Object.prototype.hasOwnProperty.call(r, o) && e(r, i, o);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), n(Yc(), t);
  })(Qe)), Qe;
}
var Ar;
function Mn() {
  return Ar || (Ar = 1, (function(t) {
    var e = ke && ke.__createBinding || (Object.create ? (function(P, N, G, V) {
      V === void 0 && (V = G);
      var q = Object.getOwnPropertyDescriptor(N, G);
      (!q || ("get" in q ? !N.__esModule : q.writable || q.configurable)) && (q = { enumerable: !0, get: function() {
        return N[G];
      } }), Object.defineProperty(P, V, q);
    }) : (function(P, N, G, V) {
      V === void 0 && (V = G), P[V] = N[G];
    })), n = ke && ke.__setModuleDefault || (Object.create ? (function(P, N) {
      Object.defineProperty(P, "default", { enumerable: !0, value: N });
    }) : function(P, N) {
      P.default = N;
    }), i = ke && ke.__importStar || /* @__PURE__ */ (function() {
      var P = function(N) {
        return P = Object.getOwnPropertyNames || function(G) {
          var V = [];
          for (var q in G) Object.prototype.hasOwnProperty.call(G, q) && (V[V.length] = q);
          return V;
        }, P(N);
      };
      return function(N) {
        if (N && N.__esModule) return N;
        var G = {};
        if (N != null)
          for (var V = P(N), q = 0; q < V.length; q++) V[q] !== "default" && e(G, N, V[q]);
        return n(G, N), G;
      };
    })(), r = ke && ke.__exportStar || function(P, N) {
      for (var G in P) G !== "default" && !Object.prototype.hasOwnProperty.call(N, G) && e(N, P, G);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.gcpResidencyCache = t.METADATA_SERVER_DETECTION = t.HEADERS = t.HEADER_VALUE = t.HEADER_NAME = t.SECONDARY_HOST_ADDRESS = t.HOST_ADDRESS = t.BASE_PATH = void 0, t.instance = g, t.project = v, t.universe = E, t.bulk = T, t.isAvailable = D, t.resetIsAvailableCache = _, t.getGCPResidency = y, t.setGCPResidency = S, t.requestTimeout = R;
    const o = ve(), a = Wc(), l = Er(), f = i(ka());
    t.BASE_PATH = "/computeMetadata/v1", t.HOST_ADDRESS = "http://169.254.169.254", t.SECONDARY_HOST_ADDRESS = "http://metadata.google.internal.", t.HEADER_NAME = "Metadata-Flavor", t.HEADER_VALUE = "Google", t.HEADERS = Object.freeze({ [t.HEADER_NAME]: t.HEADER_VALUE });
    const c = f.log("gcp-metadata");
    t.METADATA_SERVER_DETECTION = Object.freeze({
      "assume-present": "don't try to ping the metadata server, but assume it's present",
      none: "don't try to ping the metadata server, but don't try to use it either",
      "bios-only": "treat the result of a BIOS probe as canonical (don't fall back to pinging)",
      "ping-only": "skip the BIOS probe, and go straight to pinging"
    });
    function d(P) {
      return P || (P = process.env.GCE_METADATA_IP || process.env.GCE_METADATA_HOST || t.HOST_ADDRESS), /^https?:\/\//.test(P) || (P = `http://${P}`), new URL(t.BASE_PATH, P).href;
    }
    function p(P) {
      Object.keys(P).forEach((N) => {
        switch (N) {
          case "params":
          case "property":
          case "headers":
            break;
          case "qs":
            throw new Error("'qs' is not a valid configuration option. Please use 'params' instead.");
          default:
            throw new Error(`'${N}' is not a valid configuration option.`);
        }
      });
    }
    async function h(P, N = {}, G = 3, V = !1) {
      const q = new Headers(t.HEADERS);
      let J = "", W = {};
      if (typeof P == "object") {
        const pe = P;
        new Headers(pe.headers).forEach((ce, Ce) => q.set(Ce, ce)), J = pe.metadataKey, W = pe.params || W, G = pe.noResponseRetries || G, V = pe.fastFail || V;
      } else
        J = P;
      typeof N == "string" ? J += `/${N}` : (p(N), N.property && (J += `/${N.property}`), new Headers(N.headers).forEach((pe, ce) => q.set(ce, pe)), W = N.params || W);
      const $ = V ? m : o.request, X = {
        url: `${d()}/${J}`,
        headers: q,
        retryConfig: { noResponseRetries: G },
        params: W,
        responseType: "text",
        timeout: R()
      };
      c.info("instance request %j", X);
      const Z = await $(X);
      c.info("instance metadata is %s", Z.data);
      const le = Z.headers.get(t.HEADER_NAME);
      if (le !== t.HEADER_VALUE)
        throw new RangeError(`Invalid response from metadata service: incorrect ${t.HEADER_NAME} header. Expected '${t.HEADER_VALUE}', got ${le ? `'${le}'` : "no header"}`);
      if (typeof Z.data == "string")
        try {
          return a.parse(Z.data);
        } catch {
        }
      return Z.data;
    }
    async function m(P) {
      const N = {
        ...P,
        url: P.url?.toString().replace(d(), d(t.SECONDARY_HOST_ADDRESS))
      }, G = (0, o.request)(P), V = (0, o.request)(N);
      return Promise.any([G, V]);
    }
    function g(P) {
      return h("instance", P);
    }
    function v(P) {
      return h("project", P);
    }
    function E(P) {
      return h("universe", P);
    }
    async function T(P) {
      const N = {};
      return await Promise.all(P.map((G) => (async () => {
        const V = await h(G), q = G.metadataKey;
        N[q] = V;
      })())), N;
    }
    function C() {
      return process.env.DETECT_GCP_RETRIES ? Number(process.env.DETECT_GCP_RETRIES) : 0;
    }
    let w;
    async function D() {
      if (process.env.METADATA_SERVER_DETECTION) {
        const P = process.env.METADATA_SERVER_DETECTION.trim().toLocaleLowerCase();
        if (!(P in t.METADATA_SERVER_DETECTION))
          throw new RangeError(`Unknown \`METADATA_SERVER_DETECTION\` env variable. Got \`${P}\`, but it should be \`${Object.keys(t.METADATA_SERVER_DETECTION).join("`, `")}\`, or unset`);
        switch (P) {
          case "assume-present":
            return !0;
          case "none":
            return !1;
          case "bios-only":
            return y();
        }
      }
      try {
        return w === void 0 && (w = h(
          "instance",
          void 0,
          C(),
          // If the default HOST_ADDRESS has been overridden, we should not
          // make an effort to try SECONDARY_HOST_ADDRESS (as we are likely in
          // a non-GCP environment):
          !(process.env.GCE_METADATA_IP || process.env.GCE_METADATA_HOST)
        )), await w, !0;
      } catch (P) {
        const N = P;
        if (process.env.DEBUG_AUTH && console.info(N), N.type === "request-timeout" || N.response && N.response.status === 404)
          return !1;
        if (!(N.response && N.response.status === 404) && // A warning is emitted if we see an unexpected err.code, or err.code
        // is not populated:
        (!N.code || ![
          "EHOSTDOWN",
          "EHOSTUNREACH",
          "ENETUNREACH",
          "ENOENT",
          "ENOTFOUND",
          "ECONNREFUSED"
        ].includes(N.code.toString()))) {
          let G = "UNKNOWN";
          N.code && (G = N.code.toString()), process.emitWarning(`received unexpected error = ${N.message} code = ${G}`, "MetadataLookupWarning");
        }
        return !1;
      }
    }
    function _() {
      w = void 0;
    }
    t.gcpResidencyCache = null;
    function y() {
      return t.gcpResidencyCache === null && S(), t.gcpResidencyCache;
    }
    function S(P = null) {
      t.gcpResidencyCache = P !== null ? P : (0, l.detectGCPResidency)();
    }
    function R() {
      return y() ? 0 : 3e3;
    }
    r(Er(), t);
  })(ke)), ke;
}
var Ze = {}, kt = {}, Mt = {}, wr;
function zc() {
  if (wr) return Mt;
  wr = 1, Mt.byteLength = l, Mt.toByteArray = c, Mt.fromByteArray = h;
  for (var t = [], e = [], n = typeof Uint8Array < "u" ? Uint8Array : Array, i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", r = 0, o = i.length; r < o; ++r)
    t[r] = i[r], e[i.charCodeAt(r)] = r;
  e[45] = 62, e[95] = 63;
  function a(m) {
    var g = m.length;
    if (g % 4 > 0)
      throw new Error("Invalid string. Length must be a multiple of 4");
    var v = m.indexOf("=");
    v === -1 && (v = g);
    var E = v === g ? 0 : 4 - v % 4;
    return [v, E];
  }
  function l(m) {
    var g = a(m), v = g[0], E = g[1];
    return (v + E) * 3 / 4 - E;
  }
  function f(m, g, v) {
    return (g + v) * 3 / 4 - v;
  }
  function c(m) {
    var g, v = a(m), E = v[0], T = v[1], C = new n(f(m, E, T)), w = 0, D = T > 0 ? E - 4 : E, _;
    for (_ = 0; _ < D; _ += 4)
      g = e[m.charCodeAt(_)] << 18 | e[m.charCodeAt(_ + 1)] << 12 | e[m.charCodeAt(_ + 2)] << 6 | e[m.charCodeAt(_ + 3)], C[w++] = g >> 16 & 255, C[w++] = g >> 8 & 255, C[w++] = g & 255;
    return T === 2 && (g = e[m.charCodeAt(_)] << 2 | e[m.charCodeAt(_ + 1)] >> 4, C[w++] = g & 255), T === 1 && (g = e[m.charCodeAt(_)] << 10 | e[m.charCodeAt(_ + 1)] << 4 | e[m.charCodeAt(_ + 2)] >> 2, C[w++] = g >> 8 & 255, C[w++] = g & 255), C;
  }
  function d(m) {
    return t[m >> 18 & 63] + t[m >> 12 & 63] + t[m >> 6 & 63] + t[m & 63];
  }
  function p(m, g, v) {
    for (var E, T = [], C = g; C < v; C += 3)
      E = (m[C] << 16 & 16711680) + (m[C + 1] << 8 & 65280) + (m[C + 2] & 255), T.push(d(E));
    return T.join("");
  }
  function h(m) {
    for (var g, v = m.length, E = v % 3, T = [], C = 16383, w = 0, D = v - E; w < D; w += C)
      T.push(p(m, w, w + C > D ? D : w + C));
    return E === 1 ? (g = m[v - 1], T.push(
      t[g >> 2] + t[g << 4 & 63] + "=="
    )) : E === 2 && (g = (m[v - 2] << 8) + m[v - 1], T.push(
      t[g >> 10] + t[g >> 4 & 63] + t[g << 2 & 63] + "="
    )), T.join("");
  }
  return Mt;
}
var dn = {}, Ir;
function Ma() {
  if (Ir) return dn;
  Ir = 1, Object.defineProperty(dn, "__esModule", { value: !0 }), dn.fromArrayBufferToHex = t;
  function t(e) {
    return Array.from(new Uint8Array(e)).map((i) => i.toString(16).padStart(2, "0")).join("");
  }
  return dn;
}
var Rr;
function Xc() {
  if (Rr) return kt;
  Rr = 1, Object.defineProperty(kt, "__esModule", { value: !0 }), kt.BrowserCrypto = void 0;
  const t = zc(), e = Ma();
  class n {
    constructor() {
      if (typeof window > "u" || window.crypto === void 0 || window.crypto.subtle === void 0)
        throw new Error("SubtleCrypto not found. Make sure it's an https:// website.");
    }
    async sha256DigestBase64(r) {
      const o = new TextEncoder().encode(r), a = await window.crypto.subtle.digest("SHA-256", o);
      return t.fromByteArray(new Uint8Array(a));
    }
    randomBytesBase64(r) {
      const o = new Uint8Array(r);
      return window.crypto.getRandomValues(o), t.fromByteArray(o);
    }
    static padBase64(r) {
      for (; r.length % 4 !== 0; )
        r += "=";
      return r;
    }
    async verify(r, o, a) {
      const l = {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      }, f = new TextEncoder().encode(o), c = t.toByteArray(n.padBase64(a)), d = await window.crypto.subtle.importKey("jwk", r, l, !0, ["verify"]);
      return await window.crypto.subtle.verify(l, d, Buffer.from(c), f);
    }
    async sign(r, o) {
      const a = {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      }, l = new TextEncoder().encode(o), f = await window.crypto.subtle.importKey("jwk", r, a, !0, ["sign"]), c = await window.crypto.subtle.sign(a, f, l);
      return t.fromByteArray(new Uint8Array(c));
    }
    decodeBase64StringUtf8(r) {
      const o = t.toByteArray(n.padBase64(r));
      return new TextDecoder().decode(o);
    }
    encodeBase64StringUtf8(r) {
      const o = new TextEncoder().encode(r);
      return t.fromByteArray(o);
    }
    /**
     * Computes the SHA-256 hash of the provided string.
     * @param str The plain text string to hash.
     * @return A promise that resolves with the SHA-256 hash of the provided
     *   string in hexadecimal encoding.
     */
    async sha256DigestHex(r) {
      const o = new TextEncoder().encode(r), a = await window.crypto.subtle.digest("SHA-256", o);
      return (0, e.fromArrayBufferToHex)(a);
    }
    /**
     * Computes the HMAC hash of a message using the provided crypto key and the
     * SHA-256 algorithm.
     * @param key The secret crypto key in utf-8 or ArrayBuffer format.
     * @param msg The plain text message.
     * @return A promise that resolves with the HMAC-SHA256 hash in ArrayBuffer
     *   format.
     */
    async signWithHmacSha256(r, o) {
      const a = typeof r == "string" ? r : String.fromCharCode(...new Uint16Array(r)), l = new TextEncoder(), f = await window.crypto.subtle.importKey("raw", l.encode(a), {
        name: "HMAC",
        hash: {
          name: "SHA-256"
        }
      }, !1, ["sign"]);
      return window.crypto.subtle.sign("HMAC", f, l.encode(o));
    }
  }
  return kt.BrowserCrypto = n, kt;
}
var xt = {}, Pr;
function Qc() {
  if (Pr) return xt;
  Pr = 1, Object.defineProperty(xt, "__esModule", { value: !0 }), xt.NodeCrypto = void 0;
  const t = mt;
  class e {
    async sha256DigestBase64(o) {
      return t.createHash("sha256").update(o).digest("base64");
    }
    randomBytesBase64(o) {
      return t.randomBytes(o).toString("base64");
    }
    async verify(o, a, l) {
      const f = t.createVerify("RSA-SHA256");
      return f.update(a), f.end(), f.verify(o, l, "base64");
    }
    async sign(o, a) {
      const l = t.createSign("RSA-SHA256");
      return l.update(a), l.end(), l.sign(o, "base64");
    }
    decodeBase64StringUtf8(o) {
      return Buffer.from(o, "base64").toString("utf-8");
    }
    encodeBase64StringUtf8(o) {
      return Buffer.from(o, "utf-8").toString("base64");
    }
    /**
     * Computes the SHA-256 hash of the provided string.
     * @param str The plain text string to hash.
     * @return A promise that resolves with the SHA-256 hash of the provided
     *   string in hexadecimal encoding.
     */
    async sha256DigestHex(o) {
      return t.createHash("sha256").update(o).digest("hex");
    }
    /**
     * Computes the HMAC hash of a message using the provided crypto key and the
     * SHA-256 algorithm.
     * @param key The secret crypto key in utf-8 or ArrayBuffer format.
     * @param msg The plain text message.
     * @return A promise that resolves with the HMAC-SHA256 hash in ArrayBuffer
     *   format.
     */
    async signWithHmacSha256(o, a) {
      const l = typeof o == "string" ? o : i(o);
      return n(t.createHmac("sha256", l).update(a).digest());
    }
  }
  xt.NodeCrypto = e;
  function n(r) {
    const o = new ArrayBuffer(r.length), a = new Uint8Array(o);
    for (let l = 0; l < r.length; ++l)
      a[l] = r[l];
    return o;
  }
  function i(r) {
    return Buffer.from(r);
  }
  return xt;
}
var Nr;
function xn() {
  return Nr || (Nr = 1, (function(t) {
    var e = Ze && Ze.__createBinding || (Object.create ? (function(l, f, c, d) {
      d === void 0 && (d = c);
      var p = Object.getOwnPropertyDescriptor(f, c);
      (!p || ("get" in p ? !f.__esModule : p.writable || p.configurable)) && (p = { enumerable: !0, get: function() {
        return f[c];
      } }), Object.defineProperty(l, d, p);
    }) : (function(l, f, c, d) {
      d === void 0 && (d = c), l[d] = f[c];
    })), n = Ze && Ze.__exportStar || function(l, f) {
      for (var c in l) c !== "default" && !Object.prototype.hasOwnProperty.call(f, c) && e(f, l, c);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.createCrypto = o, t.hasBrowserCrypto = a;
    const i = Xc(), r = Qc();
    n(Ma(), t);
    function o() {
      return a() ? new i.BrowserCrypto() : new r.NodeCrypto();
    }
    function a() {
      return typeof window < "u" && typeof window.crypto < "u" && typeof window.crypto.subtle < "u";
    }
  })(Ze)), Ze;
}
var Dt = {}, Me = {}, hn = { exports: {} };
var kr;
function ln() {
  return kr || (kr = 1, (function(t, e) {
    var n = on, i = n.Buffer;
    function r(a, l) {
      for (var f in a)
        l[f] = a[f];
    }
    i.from && i.alloc && i.allocUnsafe && i.allocUnsafeSlow ? t.exports = n : (r(n, e), e.Buffer = o);
    function o(a, l, f) {
      return i(a, l, f);
    }
    o.prototype = Object.create(i.prototype), r(i, o), o.from = function(a, l, f) {
      if (typeof a == "number")
        throw new TypeError("Argument must not be a number");
      return i(a, l, f);
    }, o.alloc = function(a, l, f) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      var c = i(a);
      return l !== void 0 ? typeof f == "string" ? c.fill(l, f) : c.fill(l) : c.fill(0), c;
    }, o.allocUnsafe = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return i(a);
    }, o.allocUnsafeSlow = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return n.SlowBuffer(a);
    };
  })(hn, hn.exports)), hn.exports;
}
var jn, Mr;
function Zc() {
  if (Mr) return jn;
  Mr = 1;
  function t(i) {
    var r = (i / 8 | 0) + (i % 8 === 0 ? 0 : 1);
    return r;
  }
  var e = {
    ES256: t(256),
    ES384: t(384),
    ES512: t(521)
  };
  function n(i) {
    var r = e[i];
    if (r)
      return r;
    throw new Error('Unknown algorithm "' + i + '"');
  }
  return jn = n, jn;
}
var ei, xr;
function xa() {
  if (xr) return ei;
  xr = 1;
  var t = ln().Buffer, e = Zc(), n = 128, i = 0, r = 32, o = 16, a = 2, l = o | r | i << 6, f = a | i << 6;
  function c(g) {
    return g.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function d(g) {
    if (t.isBuffer(g))
      return g;
    if (typeof g == "string")
      return t.from(g, "base64");
    throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
  }
  function p(g, v) {
    g = d(g);
    var E = e(v), T = E + 1, C = g.length, w = 0;
    if (g[w++] !== l)
      throw new Error('Could not find expected "seq"');
    var D = g[w++];
    if (D === (n | 1) && (D = g[w++]), C - w < D)
      throw new Error('"seq" specified length of "' + D + '", only "' + (C - w) + '" remaining');
    if (g[w++] !== f)
      throw new Error('Could not find expected "int" for "r"');
    var _ = g[w++];
    if (C - w - 2 < _)
      throw new Error('"r" specified length of "' + _ + '", only "' + (C - w - 2) + '" available');
    if (T < _)
      throw new Error('"r" specified length of "' + _ + '", max of "' + T + '" is acceptable');
    var y = w;
    if (w += _, g[w++] !== f)
      throw new Error('Could not find expected "int" for "s"');
    var S = g[w++];
    if (C - w !== S)
      throw new Error('"s" specified length of "' + S + '", expected "' + (C - w) + '"');
    if (T < S)
      throw new Error('"s" specified length of "' + S + '", max of "' + T + '" is acceptable');
    var R = w;
    if (w += S, w !== C)
      throw new Error('Expected to consume entire buffer, but "' + (C - w) + '" bytes remain');
    var P = E - _, N = E - S, G = t.allocUnsafe(P + _ + N + S);
    for (w = 0; w < P; ++w)
      G[w] = 0;
    g.copy(G, w, y + Math.max(-P, 0), y + _), w = E;
    for (var V = w; w < V + N; ++w)
      G[w] = 0;
    return g.copy(G, w, R + Math.max(-N, 0), R + S), G = G.toString("base64"), G = c(G), G;
  }
  function h(g, v, E) {
    for (var T = 0; v + T < E && g[v + T] === 0; )
      ++T;
    var C = g[v + T] >= n;
    return C && --T, T;
  }
  function m(g, v) {
    g = d(g);
    var E = e(v), T = g.length;
    if (T !== E * 2)
      throw new TypeError('"' + v + '" signatures must be "' + E * 2 + '" bytes, saw "' + T + '"');
    var C = h(g, 0, E), w = h(g, E, g.length), D = E - C, _ = E - w, y = 2 + D + 1 + 1 + _, S = y < n, R = t.allocUnsafe((S ? 2 : 3) + y), P = 0;
    return R[P++] = l, S ? R[P++] = y : (R[P++] = n | 1, R[P++] = y & 255), R[P++] = f, R[P++] = D, C < 0 ? (R[P++] = 0, P += g.copy(R, P, 0, E)) : P += g.copy(R, P, C, E), R[P++] = f, R[P++] = _, w < 0 ? (R[P++] = 0, g.copy(R, P, E)) : g.copy(R, P, E + w), R;
  }
  return ei = {
    derToJose: p,
    joseToDer: m
  }, ei;
}
var Le = {}, Dr;
function Oe() {
  if (Dr) return Le;
  Dr = 1, Object.defineProperty(Le, "__esModule", { value: !0 }), Le.LRUCache = void 0, Le.snakeToCamel = o, Le.originalOrCamelOptions = a, Le.removeUndefinedValuesInObject = f, Le.isValidFile = c, Le.getWellKnownCertificateConfigFileLocation = d;
  const t = st, e = Bi, n = Hi, i = "certificate_config.json", r = "gcloud";
  function o(h) {
    return h.replace(/([_][^_])/g, (m) => m.slice(1).toUpperCase());
  }
  function a(h) {
    function m(g) {
      const v = h || {};
      return v[g] ?? v[o(g)];
    }
    return { get: m };
  }
  class l {
    capacity;
    /**
     * Maps are in order. Thus, the older item is the first item.
     *
     * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map}
     */
    #e = /* @__PURE__ */ new Map();
    maxAge;
    constructor(m) {
      this.capacity = m.capacity, this.maxAge = m.maxAge;
    }
    /**
     * Moves the key to the end of the cache.
     *
     * @param key the key to move
     * @param value the value of the key
     */
    #t(m, g) {
      this.#e.delete(m), this.#e.set(m, {
        value: g,
        lastAccessed: Date.now()
      });
    }
    /**
     * Add an item to the cache.
     *
     * @param key the key to upsert
     * @param value the value of the key
     */
    set(m, g) {
      this.#t(m, g), this.#n();
    }
    /**
     * Get an item from the cache.
     *
     * @param key the key to retrieve
     */
    get(m) {
      const g = this.#e.get(m);
      if (g)
        return this.#t(m, g.value), this.#n(), g.value;
    }
    /**
     * Maintain the cache based on capacity and TTL.
     */
    #n() {
      const m = this.maxAge ? Date.now() - this.maxAge : 0;
      let g = this.#e.entries().next();
      for (; !g.done && (this.#e.size > this.capacity || // too many
      g.value[1].lastAccessed < m); )
        this.#e.delete(g.value[0]), g = this.#e.entries().next();
    }
  }
  Le.LRUCache = l;
  function f(h) {
    return Object.entries(h).forEach(([m, g]) => {
      (g === void 0 || g === "undefined") && delete h[m];
    }), h;
  }
  async function c(h) {
    try {
      return (await t.promises.lstat(h)).isFile();
    } catch {
      return !1;
    }
  }
  function d() {
    const h = process.env.CLOUDSDK_CONFIG || (p() ? n.join(process.env.APPDATA || "", r) : n.join(process.env.HOME || "", ".config", r));
    return n.join(h, i);
  }
  function p() {
    return e.platform().startsWith("win");
  }
  return Le;
}
var ti = {}, Ge = {};
const jc = "google-auth-library", eu = "10.6.1", tu = "Google Inc.", nu = "Google APIs Authentication Client Library for Node.js", iu = { node: ">=18" }, ru = "./build/src/index.js", ou = "./build/src/index.d.ts", su = { type: "git", directory: "packages/google-auth-library-nodejs", url: "https://github.com/googleapis/google-cloud-node-core.git" }, au = ["google", "api", "google apis", "client", "client library"], lu = { "base64-js": "^1.3.0", "ecdsa-sig-formatter": "^1.0.11", gaxios: "7.1.3", "gcp-metadata": "8.1.2", "google-logging-utils": "1.1.3", jws: "^4.0.0" }, cu = { "@types/base64-js": "^1.2.5", "@types/jws": "^3.1.0", "@types/mocha": "^10.0.10", "@types/mv": "^2.1.0", "@types/ncp": "^2.0.8", "@types/node": "^24.0.0", "@types/sinon": "^21.0.0", "assert-rejects": "^1.0.0", c8: "^10.1.3", codecov: "^3.8.3", gts: "^6.0.2", "is-docker": "^3.0.0", jsdoc: "^4.0.4", "jsdoc-fresh": "^5.0.0", "jsdoc-region-tag": "^4.0.0", karma: "^6.0.0", "karma-chrome-launcher": "^3.0.0", "karma-coverage": "^2.0.0", "karma-firefox-launcher": "^2.0.0", "karma-mocha": "^2.0.0", "karma-sourcemap-loader": "^0.4.0", "karma-webpack": "^5.0.1", keypair: "^1.0.4", mocha: "^11.1.0", mv: "^2.1.1", ncp: "^2.0.0", nock: "^14.0.5", "null-loader": "^4.0.1", puppeteer: "^24.0.0", sinon: "^21.0.0", "ts-loader": "^9.5.2", typescript: "5.8.3", webpack: "^5.97.1", "webpack-cli": "^6.0.1" }, uu = ["build/src", "!build/src/**/*.map"], fu = { test: "c8 mocha build/test", clean: "gts clean", prepare: "npm run compile", lint: "gts check --no-inline-config", compile: "tsc -p .", fix: "gts fix", pretest: "npm run compile -- --sourceMap", docs: "jsdoc -c .jsdoc.js", "samples-setup": "cd samples/ && npm link ../ && npm run setup && cd ../", "samples-test": "cd samples/ && npm link ../ && npm test && cd ../", "system-test": "mocha build/system-test --timeout 60000", "presystem-test": "npm run compile -- --sourceMap", webpack: "webpack", "browser-test": "karma start", "docs-test": "echo 'disabled until linkinator is fixed'", "predocs-test": "npm run docs", prelint: "cd samples; npm link ../; npm install" }, du = "Apache-2.0", hu = "https://github.com/googleapis/google-cloud-node-core/tree/main/packages/google-auth-library-nodejs", pu = {
  name: jc,
  version: eu,
  author: tu,
  description: nu,
  engines: iu,
  main: ru,
  types: ou,
  repository: su,
  keywords: au,
  dependencies: lu,
  devDependencies: cu,
  files: uu,
  scripts: fu,
  license: du,
  homepage: hu
};
var Ur;
function Da() {
  if (Ur) return Ge;
  Ur = 1, Object.defineProperty(Ge, "__esModule", { value: !0 }), Ge.USER_AGENT = Ge.PRODUCT_NAME = Ge.pkg = void 0;
  const t = pu;
  Ge.pkg = t;
  const e = "google-api-nodejs-client";
  Ge.PRODUCT_NAME = e;
  const n = `${e}/${t.version}`;
  return Ge.USER_AGENT = n, Ge;
}
var br;
function Pe() {
  return br || (br = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.AuthClient = t.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = t.DEFAULT_UNIVERSE = void 0;
    const e = kn, n = ve(), i = Oe(), r = ka(), o = Da();
    t.DEFAULT_UNIVERSE = "googleapis.com", t.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = 300 * 1e3;
    class a extends e.EventEmitter {
      apiKey;
      projectId;
      /**
       * The quota project ID. The quota project can be used by client libraries for the billing purpose.
       * See {@link https://cloud.google.com/docs/quota Working with quotas}
       */
      quotaProjectId;
      /**
       * The {@link Gaxios `Gaxios`} instance used for making requests.
       */
      transporter;
      credentials = {};
      eagerRefreshThresholdMillis = t.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS;
      forceRefreshOnFailure = !1;
      universeDomain = t.DEFAULT_UNIVERSE;
      /**
       * Symbols that can be added to GaxiosOptions to specify the method name that is
       * making an RPC call, for logging purposes, as well as a string ID that can be
       * used to correlate calls and responses.
       */
      static RequestMethodNameSymbol = /* @__PURE__ */ Symbol("request method name");
      static RequestLogIdSymbol = /* @__PURE__ */ Symbol("request log id");
      constructor(f = {}) {
        super();
        const c = (0, i.originalOrCamelOptions)(f);
        this.apiKey = f.apiKey, this.projectId = c.get("project_id") ?? null, this.quotaProjectId = c.get("quota_project_id"), this.credentials = c.get("credentials") ?? {}, this.universeDomain = c.get("universe_domain") ?? t.DEFAULT_UNIVERSE, this.transporter = f.transporter ?? new n.Gaxios(f.transporterOptions), c.get("useAuthRequestParameters") !== !1 && (this.transporter.interceptors.request.add(a.DEFAULT_REQUEST_INTERCEPTOR), this.transporter.interceptors.response.add(a.DEFAULT_RESPONSE_INTERCEPTOR)), f.eagerRefreshThresholdMillis && (this.eagerRefreshThresholdMillis = f.eagerRefreshThresholdMillis), this.forceRefreshOnFailure = f.forceRefreshOnFailure ?? !1;
      }
      /**
       * A {@link fetch `fetch`} compliant API for {@link AuthClient}.
       *
       * @see {@link AuthClient.request} for the classic method.
       *
       * @remarks
       *
       * This is useful as a drop-in replacement for `fetch` API usage.
       *
       * @example
       *
       * ```ts
       * const authClient = new AuthClient();
       * const fetchWithAuthClient: typeof fetch = (...args) => authClient.fetch(...args);
       * await fetchWithAuthClient('https://example.com');
       * ```
       *
       * @param args `fetch` API or {@link Gaxios.fetch `Gaxios#fetch`} parameters
       * @returns the {@link GaxiosResponse} with Gaxios-added properties
       */
      fetch(...f) {
        const c = f[0], d = f[1];
        let p;
        const h = new Headers();
        return typeof c == "string" ? p = new URL(c) : c instanceof URL ? p = c : c && c.url && (p = new URL(c.url)), c && typeof c == "object" && "headers" in c && n.Gaxios.mergeHeaders(h, c.headers), d && n.Gaxios.mergeHeaders(h, new Headers(d.headers)), typeof c == "object" && !(c instanceof URL) ? this.request({ ...d, ...c, headers: h, url: p }) : this.request({ ...d, headers: h, url: p });
      }
      /**
       * Sets the auth credentials.
       */
      setCredentials(f) {
        this.credentials = f;
      }
      /**
       * Append additional headers, e.g., x-goog-user-project, shared across the
       * classes inheriting AuthClient. This method should be used by any method
       * that overrides getRequestMetadataAsync(), which is a shared helper for
       * setting request information in both gRPC and HTTP API calls.
       *
       * @param headers object to append additional headers to.
       */
      addSharedMetadataHeaders(f) {
        return !f.has("x-goog-user-project") && // don't override a value the user sets.
        this.quotaProjectId && f.set("x-goog-user-project", this.quotaProjectId), f;
      }
      /**
       * Adds the `x-goog-user-project` and `authorization` headers to the target Headers
       * object, if they exist on the source.
       *
       * @param target the headers to target
       * @param source the headers to source from
       * @returns the target headers
       */
      addUserProjectAndAuthHeaders(f, c) {
        const d = c.get("x-goog-user-project"), p = c.get("authorization");
        return d && f.set("x-goog-user-project", d), p && f.set("authorization", p), f;
      }
      static log = (0, r.log)("auth");
      static DEFAULT_REQUEST_INTERCEPTOR = {
        resolved: async (f) => {
          if (!f.headers.has("x-goog-api-client")) {
            const d = process.version.replace(/^v/, "");
            f.headers.set("x-goog-api-client", `gl-node/${d}`);
          }
          const c = f.headers.get("User-Agent");
          c ? c.includes(`${o.PRODUCT_NAME}/`) || f.headers.set("User-Agent", `${c} ${o.USER_AGENT}`) : f.headers.set("User-Agent", o.USER_AGENT);
          try {
            const d = f, p = d[a.RequestMethodNameSymbol], h = `${Math.floor(Math.random() * 1e3)}`;
            d[a.RequestLogIdSymbol] = h;
            const m = {
              url: f.url,
              headers: f.headers
            };
            p ? a.log.info("%s [%s] request %j", p, h, m) : a.log.info("[%s] request %j", h, m);
          } catch {
          }
          return f;
        }
      };
      static DEFAULT_RESPONSE_INTERCEPTOR = {
        resolved: async (f) => {
          try {
            const c = f.config, d = c[a.RequestMethodNameSymbol], p = c[a.RequestLogIdSymbol];
            d ? a.log.info("%s [%s] response %j", d, p, f.data) : a.log.info("[%s] response %j", p, f.data);
          } catch {
          }
          return f;
        },
        rejected: async (f) => {
          try {
            const c = f.config, d = c[a.RequestMethodNameSymbol], p = c[a.RequestLogIdSymbol];
            d ? a.log.info("%s [%s] error %j", d, p, f.response?.data) : a.log.error("[%s] error %j", p, f.response?.data);
          } catch {
          }
          throw f;
        }
      };
      /**
       * Sets the method name that is making a Gaxios request, so that logging may tag
       * log lines with the operation.
       * @param config A Gaxios request config
       * @param methodName The method name making the call
       */
      static setMethodName(f, c) {
        try {
          const d = f;
          d[a.RequestMethodNameSymbol] = c;
        } catch {
        }
      }
      /**
       * Retry config for Auth-related requests.
       *
       * @remarks
       *
       * This is not a part of the default {@link AuthClient.transporter transporter/gaxios}
       * config as some downstream APIs would prefer if customers explicitly enable retries,
       * such as GCS.
       */
      static get RETRY_CONFIG() {
        return {
          retry: !0,
          retryConfig: {
            httpMethodsToRetry: ["GET", "PUT", "POST", "HEAD", "OPTIONS", "DELETE"]
          }
        };
      }
    }
    t.AuthClient = a;
  })(ti)), ti;
}
var Ut = {}, Lr;
function Ua() {
  if (Lr) return Ut;
  Lr = 1, Object.defineProperty(Ut, "__esModule", { value: !0 }), Ut.LoginTicket = void 0;
  class t {
    envelope;
    payload;
    /**
     * Create a simple class to extract user ID from an ID Token
     *
     * @param {string} env Envelope of the jwt
     * @param {TokenPayload} pay Payload of the jwt
     * @constructor
     */
    constructor(n, i) {
      this.envelope = n, this.payload = i;
    }
    getEnvelope() {
      return this.envelope;
    }
    getPayload() {
      return this.payload;
    }
    /**
     * Create a simple class to extract user ID from an ID Token
     *
     * @return The user ID
     */
    getUserId() {
      const n = this.getPayload();
      return n && n.sub ? n.sub : null;
    }
    /**
     * Returns attributes from the login ticket.  This can contain
     * various information about the user session.
     *
     * @return The envelope and payload
     */
    getAttributes() {
      return { envelope: this.getEnvelope(), payload: this.getPayload() };
    }
  }
  return Ut.LoginTicket = t, Ut;
}
var Or;
function gt() {
  if (Or) return Me;
  Or = 1, Object.defineProperty(Me, "__esModule", { value: !0 }), Me.OAuth2Client = Me.ClientAuthentication = Me.CertificateFormat = Me.CodeChallengeMethod = void 0;
  const t = ve(), e = uc, n = we, i = xa(), r = Oe(), o = xn(), a = Pe(), l = Ua();
  var f;
  (function(h) {
    h.Plain = "plain", h.S256 = "S256";
  })(f || (Me.CodeChallengeMethod = f = {}));
  var c;
  (function(h) {
    h.PEM = "PEM", h.JWK = "JWK";
  })(c || (Me.CertificateFormat = c = {}));
  var d;
  (function(h) {
    h.ClientSecretPost = "ClientSecretPost", h.ClientSecretBasic = "ClientSecretBasic", h.None = "None";
  })(d || (Me.ClientAuthentication = d = {}));
  class p extends a.AuthClient {
    redirectUri;
    certificateCache = {};
    certificateExpiry = null;
    certificateCacheFormat = c.PEM;
    refreshTokenPromises = /* @__PURE__ */ new Map();
    endpoints;
    issuers;
    clientAuthentication;
    // TODO: refactor tests to make this private
    _clientId;
    // TODO: refactor tests to make this private
    _clientSecret;
    refreshHandler;
    /**
     * An OAuth2 Client for Google APIs.
     *
     * @param options The OAuth2 Client Options. Passing an `clientId` directly is **@DEPRECATED**.
     * @param clientSecret **@DEPRECATED**. Provide a {@link OAuth2ClientOptions `OAuth2ClientOptions`} object in the first parameter instead.
     * @param redirectUri **@DEPRECATED**. Provide a {@link OAuth2ClientOptions `OAuth2ClientOptions`} object in the first parameter instead.
     */
    constructor(m = {}, g, v) {
      super(typeof m == "object" ? m : {}), typeof m != "object" && (m = {
        clientId: m,
        clientSecret: g,
        redirectUri: v
      }), this._clientId = m.clientId || m.client_id, this._clientSecret = m.clientSecret || m.client_secret, this.redirectUri = m.redirectUri || m.redirect_uris?.[0], this.endpoints = {
        tokenInfoUrl: "https://oauth2.googleapis.com/tokeninfo",
        oauth2AuthBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        oauth2TokenUrl: "https://oauth2.googleapis.com/token",
        oauth2RevokeUrl: "https://oauth2.googleapis.com/revoke",
        oauth2FederatedSignonPemCertsUrl: "https://www.googleapis.com/oauth2/v1/certs",
        oauth2FederatedSignonJwkCertsUrl: "https://www.googleapis.com/oauth2/v3/certs",
        oauth2IapPublicKeyUrl: "https://www.gstatic.com/iap/verify/public_key",
        ...m.endpoints
      }, this.clientAuthentication = m.clientAuthentication || d.ClientSecretPost, this.issuers = m.issuers || [
        "accounts.google.com",
        "https://accounts.google.com",
        this.universeDomain
      ];
    }
    /**
     * @deprecated use instance's {@link OAuth2Client.endpoints}
     */
    static GOOGLE_TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
    /**
     * Clock skew - five minutes in seconds
     */
    static CLOCK_SKEW_SECS_ = 300;
    /**
     * The default max Token Lifetime is one day in seconds
     */
    static DEFAULT_MAX_TOKEN_LIFETIME_SECS_ = 86400;
    /**
     * Generates URL for consent page landing.
     * @param opts Options.
     * @return URL to consent page.
     */
    generateAuthUrl(m = {}) {
      if (m.code_challenge_method && !m.code_challenge)
        throw new Error("If a code_challenge_method is provided, code_challenge must be included.");
      return m.response_type = m.response_type || "code", m.client_id = m.client_id || this._clientId, m.redirect_uri = m.redirect_uri || this.redirectUri, Array.isArray(m.scope) && (m.scope = m.scope.join(" ")), this.endpoints.oauth2AuthBaseUrl.toString() + "?" + e.stringify(m);
    }
    generateCodeVerifier() {
      throw new Error("generateCodeVerifier is removed, please use generateCodeVerifierAsync instead.");
    }
    /**
     * Convenience method to automatically generate a code_verifier, and its
     * resulting SHA256. If used, this must be paired with a S256
     * code_challenge_method.
     *
     * For a full example see:
     * https://github.com/googleapis/google-auth-library-nodejs/blob/main/samples/oauth2-codeVerifier.js
     */
    async generateCodeVerifierAsync() {
      const m = (0, o.createCrypto)(), v = m.randomBytesBase64(96).replace(/\+/g, "~").replace(/=/g, "_").replace(/\//g, "-"), T = (await m.sha256DigestBase64(v)).split("=")[0].replace(/\+/g, "-").replace(/\//g, "_");
      return { codeVerifier: v, codeChallenge: T };
    }
    getToken(m, g) {
      const v = typeof m == "string" ? { code: m } : m;
      if (g)
        this.getTokenAsync(v).then((E) => g(null, E.tokens, E.res), (E) => g(E, null, E.response));
      else
        return this.getTokenAsync(v);
    }
    async getTokenAsync(m) {
      const g = this.endpoints.oauth2TokenUrl.toString(), v = new Headers(), E = {
        client_id: m.client_id || this._clientId,
        code_verifier: m.codeVerifier,
        code: m.code,
        grant_type: "authorization_code",
        redirect_uri: m.redirect_uri || this.redirectUri
      };
      if (this.clientAuthentication === d.ClientSecretBasic) {
        const D = Buffer.from(`${this._clientId}:${this._clientSecret}`);
        v.set("authorization", `Basic ${D.toString("base64")}`);
      }
      this.clientAuthentication === d.ClientSecretPost && (E.client_secret = this._clientSecret);
      const T = {
        ...p.RETRY_CONFIG,
        method: "POST",
        url: g,
        data: new URLSearchParams((0, r.removeUndefinedValuesInObject)(E)),
        headers: v
      };
      a.AuthClient.setMethodName(T, "getTokenAsync");
      const C = await this.transporter.request(T), w = C.data;
      return C.data && C.data.expires_in && (w.expiry_date = (/* @__PURE__ */ new Date()).getTime() + C.data.expires_in * 1e3, delete w.expires_in), this.emit("tokens", w), { tokens: w, res: C };
    }
    /**
     * Refreshes the access token.
     * @param refresh_token Existing refresh token.
     * @private
     */
    async refreshToken(m) {
      if (!m)
        return this.refreshTokenNoCache(m);
      if (this.refreshTokenPromises.has(m))
        return this.refreshTokenPromises.get(m);
      const g = this.refreshTokenNoCache(m).then((v) => (this.refreshTokenPromises.delete(m), v), (v) => {
        throw this.refreshTokenPromises.delete(m), v;
      });
      return this.refreshTokenPromises.set(m, g), g;
    }
    async refreshTokenNoCache(m) {
      if (!m)
        throw new Error("No refresh token is set.");
      const g = this.endpoints.oauth2TokenUrl.toString(), v = {
        refresh_token: m,
        client_id: this._clientId,
        client_secret: this._clientSecret,
        grant_type: "refresh_token"
      };
      let E;
      try {
        const C = {
          ...p.RETRY_CONFIG,
          method: "POST",
          url: g,
          data: new URLSearchParams((0, r.removeUndefinedValuesInObject)(v))
        };
        a.AuthClient.setMethodName(C, "refreshTokenNoCache"), E = await this.transporter.request(C);
      } catch (C) {
        throw C instanceof t.GaxiosError && C.message === "invalid_grant" && C.response?.data && /ReAuth/i.test(C.response.data.error_description) && (C.message = JSON.stringify(C.response.data)), C;
      }
      const T = E.data;
      return E.data && E.data.expires_in && (T.expiry_date = (/* @__PURE__ */ new Date()).getTime() + E.data.expires_in * 1e3, delete T.expires_in), this.emit("tokens", T), { tokens: T, res: E };
    }
    refreshAccessToken(m) {
      if (m)
        this.refreshAccessTokenAsync().then((g) => m(null, g.credentials, g.res), m);
      else
        return this.refreshAccessTokenAsync();
    }
    async refreshAccessTokenAsync() {
      const m = await this.refreshToken(this.credentials.refresh_token), g = m.tokens;
      return g.refresh_token = this.credentials.refresh_token, this.credentials = g, { credentials: this.credentials, res: m.res };
    }
    getAccessToken(m) {
      if (m)
        this.getAccessTokenAsync().then((g) => m(null, g.token, g.res), m);
      else
        return this.getAccessTokenAsync();
    }
    async getAccessTokenAsync() {
      if (!this.credentials.access_token || this.isTokenExpiring()) {
        if (!this.credentials.refresh_token)
          if (this.refreshHandler) {
            const v = await this.processAndValidateRefreshHandler();
            if (v?.access_token)
              return this.setCredentials(v), { token: this.credentials.access_token };
          } else
            throw new Error("No refresh token or refresh handler callback is set.");
        const g = await this.refreshAccessTokenAsync();
        if (!g.credentials || g.credentials && !g.credentials.access_token)
          throw new Error("Could not refresh access token.");
        return { token: g.credentials.access_token, res: g.res };
      } else
        return { token: this.credentials.access_token };
    }
    /**
     * The main authentication interface.  It takes an optional url which when
     * present is the endpoint being accessed, and returns a Promise which
     * resolves with authorization header fields.
     *
     * In OAuth2Client, the result has the form:
     * { authorization: 'Bearer <access_token_value>' }
     */
    async getRequestHeaders(m) {
      return (await this.getRequestMetadataAsync(m)).headers;
    }
    async getRequestMetadataAsync(m) {
      const g = this.credentials;
      if (!g.access_token && !g.refresh_token && !this.apiKey && !this.refreshHandler)
        throw new Error("No access, refresh token, API key or refresh handler callback is set.");
      if (g.access_token && !this.isTokenExpiring()) {
        g.token_type = g.token_type || "Bearer";
        const w = new Headers({
          authorization: g.token_type + " " + g.access_token
        });
        return { headers: this.addSharedMetadataHeaders(w) };
      }
      if (this.refreshHandler) {
        const w = await this.processAndValidateRefreshHandler();
        if (w?.access_token) {
          this.setCredentials(w);
          const D = new Headers({
            authorization: "Bearer " + this.credentials.access_token
          });
          return { headers: this.addSharedMetadataHeaders(D) };
        }
      }
      if (this.apiKey)
        return { headers: new Headers({ "X-Goog-Api-Key": this.apiKey }) };
      let v = null, E = null;
      try {
        v = await this.refreshToken(g.refresh_token), E = v.tokens;
      } catch (w) {
        const D = w;
        throw D.response && (D.response.status === 403 || D.response.status === 404) && (D.message = `Could not refresh access token: ${D.message}`), D;
      }
      const T = this.credentials;
      T.token_type = T.token_type || "Bearer", E.refresh_token = T.refresh_token, this.credentials = E;
      const C = new Headers({
        authorization: T.token_type + " " + E.access_token
      });
      return { headers: this.addSharedMetadataHeaders(C), res: v.res };
    }
    /**
     * Generates an URL to revoke the given token.
     * @param token The existing token to be revoked.
     *
     * @deprecated use instance method {@link OAuth2Client.getRevokeTokenURL}
     */
    static getRevokeTokenUrl(m) {
      return new p().getRevokeTokenURL(m).toString();
    }
    /**
     * Generates a URL to revoke the given token.
     *
     * @param token The existing token to be revoked.
     */
    getRevokeTokenURL(m) {
      const g = new URL(this.endpoints.oauth2RevokeUrl);
      return g.searchParams.append("token", m), g;
    }
    revokeToken(m, g) {
      const v = {
        ...p.RETRY_CONFIG,
        url: this.getRevokeTokenURL(m).toString(),
        method: "POST"
      };
      if (a.AuthClient.setMethodName(v, "revokeToken"), g)
        this.transporter.request(v).then((E) => g(null, E), g);
      else
        return this.transporter.request(v);
    }
    revokeCredentials(m) {
      if (m)
        this.revokeCredentialsAsync().then((g) => m(null, g), m);
      else
        return this.revokeCredentialsAsync();
    }
    async revokeCredentialsAsync() {
      const m = this.credentials.access_token;
      if (this.credentials = {}, m)
        return this.revokeToken(m);
      throw new Error("No access token to revoke.");
    }
    request(m, g) {
      if (g)
        this.requestAsync(m).then((v) => g(null, v), (v) => g(v, v.response));
      else
        return this.requestAsync(m);
    }
    async requestAsync(m, g = !1) {
      try {
        const v = await this.getRequestMetadataAsync();
        return m.headers = t.Gaxios.mergeHeaders(m.headers), this.addUserProjectAndAuthHeaders(m.headers, v.headers), this.apiKey && m.headers.set("X-Goog-Api-Key", this.apiKey), await this.transporter.request(m);
      } catch (v) {
        const E = v.response;
        if (E) {
          const T = E.status, C = this.credentials && this.credentials.access_token && this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure), w = this.credentials && this.credentials.access_token && !this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure) && this.refreshHandler, D = E.config.data instanceof n.Readable, _ = T === 401 || T === 403;
          if (!g && _ && !D && C)
            return await this.refreshAccessTokenAsync(), this.requestAsync(m, !0);
          if (!g && _ && !D && w) {
            const y = await this.processAndValidateRefreshHandler();
            return y?.access_token && this.setCredentials(y), this.requestAsync(m, !0);
          }
        }
        throw v;
      }
    }
    verifyIdToken(m, g) {
      if (g && typeof g != "function")
        throw new Error("This method accepts an options object as the first parameter, which includes the idToken, audience, and maxExpiry.");
      if (g)
        this.verifyIdTokenAsync(m).then((v) => g(null, v), g);
      else
        return this.verifyIdTokenAsync(m);
    }
    async verifyIdTokenAsync(m) {
      if (!m.idToken)
        throw new Error("The verifyIdToken method requires an ID Token");
      const g = await this.getFederatedSignonCertsAsync();
      return await this.verifySignedJwtWithCertsAsync(m.idToken, g.certs, m.audience, this.issuers, m.maxExpiry);
    }
    /**
     * Obtains information about the provisioned access token.  Especially useful
     * if you want to check the scopes that were provisioned to a given token.
     *
     * @param accessToken Required.  The Access Token for which you want to get
     * user info.
     */
    async getTokenInfo(m) {
      const { data: g } = await this.transporter.request({
        ...p.RETRY_CONFIG,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          authorization: `Bearer ${m}`
        },
        url: this.endpoints.tokenInfoUrl.toString()
      }), v = Object.assign({
        expiry_date: (/* @__PURE__ */ new Date()).getTime() + g.expires_in * 1e3,
        scopes: g.scope.split(" ")
      }, g);
      return delete v.expires_in, delete v.scope, v;
    }
    getFederatedSignonCerts(m) {
      if (m)
        this.getFederatedSignonCertsAsync().then((g) => m(null, g.certs, g.res), m);
      else
        return this.getFederatedSignonCertsAsync();
    }
    async getFederatedSignonCertsAsync() {
      const m = (/* @__PURE__ */ new Date()).getTime(), g = (0, o.hasBrowserCrypto)() ? c.JWK : c.PEM;
      if (this.certificateExpiry && m < this.certificateExpiry.getTime() && this.certificateCacheFormat === g)
        return { certs: this.certificateCache, format: g };
      let v, E;
      switch (g) {
        case c.PEM:
          E = this.endpoints.oauth2FederatedSignonPemCertsUrl.toString();
          break;
        case c.JWK:
          E = this.endpoints.oauth2FederatedSignonJwkCertsUrl.toString();
          break;
        default:
          throw new Error(`Unsupported certificate format ${g}`);
      }
      try {
        const _ = {
          ...p.RETRY_CONFIG,
          url: E
        };
        a.AuthClient.setMethodName(_, "getFederatedSignonCertsAsync"), v = await this.transporter.request(_);
      } catch (_) {
        throw _ instanceof Error && (_.message = `Failed to retrieve verification certificates: ${_.message}`), _;
      }
      const T = v?.headers.get("cache-control");
      let C = -1;
      if (T) {
        const _ = /max-age=(?<maxAge>[0-9]+)/.exec(T)?.groups?.maxAge;
        _ && (C = Number(_) * 1e3);
      }
      let w = {};
      switch (g) {
        case c.PEM:
          w = v.data;
          break;
        case c.JWK:
          for (const _ of v.data.keys)
            w[_.kid] = _;
          break;
        default:
          throw new Error(`Unsupported certificate format ${g}`);
      }
      const D = /* @__PURE__ */ new Date();
      return this.certificateExpiry = C === -1 ? null : new Date(D.getTime() + C), this.certificateCache = w, this.certificateCacheFormat = g, { certs: w, format: g, res: v };
    }
    getIapPublicKeys(m) {
      if (m)
        this.getIapPublicKeysAsync().then((g) => m(null, g.pubkeys, g.res), m);
      else
        return this.getIapPublicKeysAsync();
    }
    async getIapPublicKeysAsync() {
      let m;
      const g = this.endpoints.oauth2IapPublicKeyUrl.toString();
      try {
        const v = {
          ...p.RETRY_CONFIG,
          url: g
        };
        a.AuthClient.setMethodName(v, "getIapPublicKeysAsync"), m = await this.transporter.request(v);
      } catch (v) {
        throw v instanceof Error && (v.message = `Failed to retrieve verification certificates: ${v.message}`), v;
      }
      return { pubkeys: m.data, res: m };
    }
    verifySignedJwtWithCerts() {
      throw new Error("verifySignedJwtWithCerts is removed, please use verifySignedJwtWithCertsAsync instead.");
    }
    /**
     * Verify the id token is signed with the correct certificate
     * and is from the correct audience.
     * @param jwt The jwt to verify (The ID Token in this case).
     * @param certs The array of certs to test the jwt against.
     * @param requiredAudience The audience to test the jwt against.
     * @param issuers The allowed issuers of the jwt (Optional).
     * @param maxExpiry The max expiry the certificate can be (Optional).
     * @return Returns a promise resolving to LoginTicket on verification.
     */
    async verifySignedJwtWithCertsAsync(m, g, v, E, T) {
      const C = (0, o.createCrypto)();
      T || (T = p.DEFAULT_MAX_TOKEN_LIFETIME_SECS_);
      const w = m.split(".");
      if (w.length !== 3)
        throw new Error("Wrong number of segments in token: " + m);
      const D = w[0] + "." + w[1];
      let _ = w[2], y, S;
      try {
        y = JSON.parse(C.decodeBase64StringUtf8(w[0]));
      } catch (W) {
        throw W instanceof Error && (W.message = `Can't parse token envelope: ${w[0]}': ${W.message}`), W;
      }
      if (!y)
        throw new Error("Can't parse token envelope: " + w[0]);
      try {
        S = JSON.parse(C.decodeBase64StringUtf8(w[1]));
      } catch (W) {
        throw W instanceof Error && (W.message = `Can't parse token payload '${w[0]}`), W;
      }
      if (!S)
        throw new Error("Can't parse token payload: " + w[1]);
      if (!Object.prototype.hasOwnProperty.call(g, y.kid))
        throw new Error("No pem found for envelope: " + JSON.stringify(y));
      const R = g[y.kid];
      if (y.alg === "ES256" && (_ = i.joseToDer(_, "ES256").toString("base64")), !await C.verify(R, D, _))
        throw new Error("Invalid token signature: " + m);
      if (!S.iat)
        throw new Error("No issue time in token: " + JSON.stringify(S));
      if (!S.exp)
        throw new Error("No expiration time in token: " + JSON.stringify(S));
      const N = Number(S.iat);
      if (isNaN(N))
        throw new Error("iat field using invalid format");
      const G = Number(S.exp);
      if (isNaN(G))
        throw new Error("exp field using invalid format");
      const V = (/* @__PURE__ */ new Date()).getTime() / 1e3;
      if (G >= V + T)
        throw new Error("Expiration time too far in future: " + JSON.stringify(S));
      const q = N - p.CLOCK_SKEW_SECS_, J = G + p.CLOCK_SKEW_SECS_;
      if (V < q)
        throw new Error("Token used too early, " + V + " < " + q + ": " + JSON.stringify(S));
      if (V > J)
        throw new Error("Token used too late, " + V + " > " + J + ": " + JSON.stringify(S));
      if (E && E.indexOf(S.iss) < 0)
        throw new Error("Invalid issuer, expected one of [" + E + "], but got " + S.iss);
      if (typeof v < "u" && v !== null) {
        const W = S.aud;
        let $ = !1;
        if (v.constructor === Array ? $ = v.indexOf(W) > -1 : $ = W === v, !$)
          throw new Error("Wrong recipient, payload audience != requiredAudience");
      }
      return new l.LoginTicket(y, S);
    }
    /**
     * Returns a promise that resolves with AccessTokenResponse type if
     * refreshHandler is defined.
     * If not, nothing is returned.
     */
    async processAndValidateRefreshHandler() {
      if (this.refreshHandler) {
        const m = await this.refreshHandler();
        if (!m.access_token)
          throw new Error("No access token is returned by the refreshHandler callback.");
        return m;
      }
    }
    /**
     * Returns true if a token is expired or will expire within
     * eagerRefreshThresholdMillismilliseconds.
     * If there is no expiry time, assumes the token is not expired or expiring.
     */
    isTokenExpiring() {
      const m = this.credentials.expiry_date;
      return m ? m <= (/* @__PURE__ */ new Date()).getTime() + this.eagerRefreshThresholdMillis : !1;
    }
  }
  return Me.OAuth2Client = p, Me;
}
var Fr;
function ba() {
  if (Fr) return Dt;
  Fr = 1, Object.defineProperty(Dt, "__esModule", { value: !0 }), Dt.Compute = void 0;
  const t = ve(), e = Mn(), n = gt();
  class i extends n.OAuth2Client {
    serviceAccountEmail;
    scopes;
    /**
     * Google Compute Engine service account credentials.
     *
     * Retrieve access token from the metadata server.
     * See: https://cloud.google.com/compute/docs/access/authenticate-workloads#applications
     */
    constructor(o = {}) {
      super(o), this.credentials = { expiry_date: 1, refresh_token: "compute-placeholder" }, this.serviceAccountEmail = o.serviceAccountEmail || "default", this.scopes = Array.isArray(o.scopes) ? o.scopes : o.scopes ? [o.scopes] : [];
    }
    /**
     * Refreshes the access token.
     * @param refreshToken Unused parameter
     */
    async refreshTokenNoCache() {
      const o = `service-accounts/${this.serviceAccountEmail}/token`;
      let a;
      try {
        const f = {
          property: o
        };
        this.scopes.length > 0 && (f.params = {
          scopes: this.scopes.join(",")
        }), a = await e.instance(f);
      } catch (f) {
        throw f instanceof t.GaxiosError && (f.message = `Could not refresh access token: ${f.message}`, this.wrapError(f)), f;
      }
      const l = a;
      return a && a.expires_in && (l.expiry_date = (/* @__PURE__ */ new Date()).getTime() + a.expires_in * 1e3, delete l.expires_in), this.emit("tokens", l), { tokens: l, res: null };
    }
    /**
     * Fetches an ID token.
     * @param targetAudience the audience for the fetched ID token.
     */
    async fetchIdToken(o) {
      const a = `service-accounts/${this.serviceAccountEmail}/identity?format=full&audience=${o}`;
      let l;
      try {
        const f = {
          property: a
        };
        l = await e.instance(f);
      } catch (f) {
        throw f instanceof Error && (f.message = `Could not fetch ID token: ${f.message}`), f;
      }
      return l;
    }
    wrapError(o) {
      const a = o.response;
      a && a.status && (o.status = a.status, a.status === 403 ? o.message = "A Forbidden error was returned while attempting to retrieve an access token for the Compute Engine built-in service account. This may be because the Compute Engine instance does not have the correct permission scopes specified: " + o.message : a.status === 404 && (o.message = "A Not Found error was returned while attempting to retrieve an accesstoken for the Compute Engine built-in service account. This may be because the Compute Engine instance does not have any permission scopes specified: " + o.message));
    }
  }
  return Dt.Compute = i, Dt;
}
var bt = {}, Gr;
function La() {
  if (Gr) return bt;
  Gr = 1, Object.defineProperty(bt, "__esModule", { value: !0 }), bt.IdTokenClient = void 0;
  const t = gt();
  class e extends t.OAuth2Client {
    targetAudience;
    idTokenProvider;
    /**
     * Google ID Token client
     *
     * Retrieve ID token from the metadata server.
     * See: https://cloud.google.com/docs/authentication/get-id-token#metadata-server
     */
    constructor(i) {
      super(i), this.targetAudience = i.targetAudience, this.idTokenProvider = i.idTokenProvider;
    }
    async getRequestMetadataAsync() {
      if (!this.credentials.id_token || !this.credentials.expiry_date || this.isTokenExpiring()) {
        const r = await this.idTokenProvider.fetchIdToken(this.targetAudience);
        this.credentials = {
          id_token: r,
          expiry_date: this.getIdTokenExpiryDate(r)
        };
      }
      return { headers: new Headers({
        authorization: "Bearer " + this.credentials.id_token
      }) };
    }
    getIdTokenExpiryDate(i) {
      const r = i.split(".")[1];
      if (r)
        return JSON.parse(Buffer.from(r, "base64").toString("ascii")).exp * 1e3;
    }
  }
  return bt.IdTokenClient = e, bt;
}
var je = {}, qr;
function Oa() {
  if (qr) return je;
  qr = 1, Object.defineProperty(je, "__esModule", { value: !0 }), je.GCPEnv = void 0, je.clear = i, je.getEnv = r;
  const t = Mn();
  var e;
  (function(h) {
    h.APP_ENGINE = "APP_ENGINE", h.KUBERNETES_ENGINE = "KUBERNETES_ENGINE", h.CLOUD_FUNCTIONS = "CLOUD_FUNCTIONS", h.COMPUTE_ENGINE = "COMPUTE_ENGINE", h.CLOUD_RUN = "CLOUD_RUN", h.CLOUD_RUN_JOBS = "CLOUD_RUN_JOBS", h.NONE = "NONE";
  })(e || (je.GCPEnv = e = {}));
  let n;
  function i() {
    n = void 0;
  }
  async function r() {
    return n || (n = o(), n);
  }
  async function o() {
    let h = e.NONE;
    return a() ? h = e.APP_ENGINE : l() ? h = e.CLOUD_FUNCTIONS : await p() ? await d() ? h = e.KUBERNETES_ENGINE : f() ? h = e.CLOUD_RUN : c() ? h = e.CLOUD_RUN_JOBS : h = e.COMPUTE_ENGINE : h = e.NONE, h;
  }
  function a() {
    return !!(process.env.GAE_SERVICE || process.env.GAE_MODULE_NAME);
  }
  function l() {
    return !!(process.env.FUNCTION_NAME || process.env.FUNCTION_TARGET);
  }
  function f() {
    return !!process.env.K_CONFIGURATION;
  }
  function c() {
    return !!process.env.CLOUD_RUN_JOB;
  }
  async function d() {
    try {
      return await t.instance("attributes/cluster-name"), !0;
    } catch {
      return !1;
    }
  }
  async function p() {
    return t.isAvailable();
  }
  return je;
}
var Lt = {}, Ot = {}, Ft = {}, pn = {}, Gt = {}, qe = {}, ni, Br;
function Fa() {
  if (Br) return ni;
  Br = 1;
  var t = ln().Buffer, e = we, n = at;
  function i(r) {
    if (this.buffer = null, this.writable = !0, this.readable = !0, !r)
      return this.buffer = t.alloc(0), this;
    if (typeof r.pipe == "function")
      return this.buffer = t.alloc(0), r.pipe(this), this;
    if (r.length || typeof r == "object")
      return this.buffer = r, this.writable = !1, process.nextTick((function() {
        this.emit("end", r), this.readable = !1, this.emit("close");
      }).bind(this)), this;
    throw new TypeError("Unexpected data type (" + typeof r + ")");
  }
  return n.inherits(i, e), i.prototype.write = function(o) {
    this.buffer = t.concat([this.buffer, t.from(o)]), this.emit("data", o);
  }, i.prototype.end = function(o) {
    o && this.write(o), this.emit("end", o), this.emit("close"), this.writable = !1, this.readable = !1;
  }, ni = i, ni;
}
var ii, Hr;
function mu() {
  if (Hr) return ii;
  Hr = 1;
  var t = on.Buffer, e = on.SlowBuffer;
  ii = n;
  function n(o, a) {
    if (!t.isBuffer(o) || !t.isBuffer(a) || o.length !== a.length)
      return !1;
    for (var l = 0, f = 0; f < o.length; f++)
      l |= o[f] ^ a[f];
    return l === 0;
  }
  n.install = function() {
    t.prototype.equal = e.prototype.equal = function(a) {
      return n(this, a);
    };
  };
  var i = t.prototype.equal, r = e.prototype.equal;
  return n.restore = function() {
    t.prototype.equal = i, e.prototype.equal = r;
  }, ii;
}
var ri, Vr;
function Ga() {
  if (Vr) return ri;
  Vr = 1;
  var t = ln().Buffer, e = mt, n = xa(), i = at, r = `"%s" is not a valid algorithm.
  Supported algorithms are:
  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".`, o = "secret must be a string or buffer", a = "key must be a string or a buffer", l = "key must be a string, a buffer or an object", f = typeof e.createPublicKey == "function";
  f && (a += " or a KeyObject", o += "or a KeyObject");
  function c(q) {
    if (!t.isBuffer(q) && typeof q != "string" && (!f || typeof q != "object" || typeof q.type != "string" || typeof q.asymmetricKeyType != "string" || typeof q.export != "function"))
      throw g(a);
  }
  function d(q) {
    if (!t.isBuffer(q) && typeof q != "string" && typeof q != "object")
      throw g(l);
  }
  function p(q) {
    if (!t.isBuffer(q)) {
      if (typeof q == "string")
        return q;
      if (!f || typeof q != "object" || q.type !== "secret" || typeof q.export != "function")
        throw g(o);
    }
  }
  function h(q) {
    return q.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function m(q) {
    q = q.toString();
    var J = 4 - q.length % 4;
    if (J !== 4)
      for (var W = 0; W < J; ++W)
        q += "=";
    return q.replace(/\-/g, "+").replace(/_/g, "/");
  }
  function g(q) {
    var J = [].slice.call(arguments, 1), W = i.format.bind(i, q).apply(null, J);
    return new TypeError(W);
  }
  function v(q) {
    return t.isBuffer(q) || typeof q == "string";
  }
  function E(q) {
    return v(q) || (q = JSON.stringify(q)), q;
  }
  function T(q) {
    return function(W, $) {
      p($), W = E(W);
      var X = e.createHmac("sha" + q, $), Z = (X.update(W), X.digest("base64"));
      return h(Z);
    };
  }
  var C, w = "timingSafeEqual" in e ? function(J, W) {
    return J.byteLength !== W.byteLength ? !1 : e.timingSafeEqual(J, W);
  } : function(J, W) {
    return C || (C = mu()), C(J, W);
  };
  function D(q) {
    return function(W, $, X) {
      var Z = T(q)(W, X);
      return w(t.from($), t.from(Z));
    };
  }
  function _(q) {
    return function(W, $) {
      d($), W = E(W);
      var X = e.createSign("RSA-SHA" + q), Z = (X.update(W), X.sign($, "base64"));
      return h(Z);
    };
  }
  function y(q) {
    return function(W, $, X) {
      c(X), W = E(W), $ = m($);
      var Z = e.createVerify("RSA-SHA" + q);
      return Z.update(W), Z.verify(X, $, "base64");
    };
  }
  function S(q) {
    return function(W, $) {
      d($), W = E(W);
      var X = e.createSign("RSA-SHA" + q), Z = (X.update(W), X.sign({
        key: $,
        padding: e.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: e.constants.RSA_PSS_SALTLEN_DIGEST
      }, "base64"));
      return h(Z);
    };
  }
  function R(q) {
    return function(W, $, X) {
      c(X), W = E(W), $ = m($);
      var Z = e.createVerify("RSA-SHA" + q);
      return Z.update(W), Z.verify({
        key: X,
        padding: e.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: e.constants.RSA_PSS_SALTLEN_DIGEST
      }, $, "base64");
    };
  }
  function P(q) {
    var J = _(q);
    return function() {
      var $ = J.apply(null, arguments);
      return $ = n.derToJose($, "ES" + q), $;
    };
  }
  function N(q) {
    var J = y(q);
    return function($, X, Z) {
      X = n.joseToDer(X, "ES" + q).toString("base64");
      var le = J($, X, Z);
      return le;
    };
  }
  function G() {
    return function() {
      return "";
    };
  }
  function V() {
    return function(J, W) {
      return W === "";
    };
  }
  return ri = function(J) {
    var W = {
      hs: T,
      rs: _,
      ps: S,
      es: P,
      none: G
    }, $ = {
      hs: D,
      rs: y,
      ps: R,
      es: N,
      none: V
    }, X = J.match(/^(RS|PS|ES|HS)(256|384|512)$|^(none)$/);
    if (!X)
      throw g(r, J);
    var Z = (X[1] || X[3]).toLowerCase(), le = X[2];
    return {
      sign: W[Z](le),
      verify: $[Z](le)
    };
  }, ri;
}
var oi, Jr;
function qa() {
  if (Jr) return oi;
  Jr = 1;
  var t = on.Buffer;
  return oi = function(n) {
    return typeof n == "string" ? n : typeof n == "number" || t.isBuffer(n) ? n.toString() : JSON.stringify(n);
  }, oi;
}
var si, $r;
function gu() {
  if ($r) return si;
  $r = 1;
  var t = ln().Buffer, e = Fa(), n = Ga(), i = we, r = qa(), o = at;
  function a(d, p) {
    return t.from(d, p).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function l(d, p, h) {
    h = h || "utf8";
    var m = a(r(d), "binary"), g = a(r(p), h);
    return o.format("%s.%s", m, g);
  }
  function f(d) {
    var p = d.header, h = d.payload, m = d.secret || d.privateKey, g = d.encoding, v = n(p.alg), E = l(p, h, g), T = v.sign(E, m);
    return o.format("%s.%s", E, T);
  }
  function c(d) {
    var p = d.secret;
    if (p = p ?? d.privateKey, p = p ?? d.key, /^hs/i.test(d.header.alg) === !0 && p == null)
      throw new TypeError("secret must be a string or buffer or a KeyObject");
    var h = new e(p);
    this.readable = !0, this.header = d.header, this.encoding = d.encoding, this.secret = this.privateKey = this.key = h, this.payload = new e(d.payload), this.secret.once("close", (function() {
      !this.payload.writable && this.readable && this.sign();
    }).bind(this)), this.payload.once("close", (function() {
      !this.secret.writable && this.readable && this.sign();
    }).bind(this));
  }
  return o.inherits(c, i), c.prototype.sign = function() {
    try {
      var p = f({
        header: this.header,
        payload: this.payload.buffer,
        secret: this.secret.buffer,
        encoding: this.encoding
      });
      return this.emit("done", p), this.emit("data", p), this.emit("end"), this.readable = !1, p;
    } catch (h) {
      this.readable = !1, this.emit("error", h), this.emit("close");
    }
  }, c.sign = f, si = c, si;
}
var ai, Wr;
function yu() {
  if (Wr) return ai;
  Wr = 1;
  var t = ln().Buffer, e = Fa(), n = Ga(), i = we, r = qa(), o = at, a = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
  function l(T) {
    return Object.prototype.toString.call(T) === "[object Object]";
  }
  function f(T) {
    if (l(T))
      return T;
    try {
      return JSON.parse(T);
    } catch {
      return;
    }
  }
  function c(T) {
    var C = T.split(".", 1)[0];
    return f(t.from(C, "base64").toString("binary"));
  }
  function d(T) {
    return T.split(".", 2).join(".");
  }
  function p(T) {
    return T.split(".")[2];
  }
  function h(T, C) {
    C = C || "utf8";
    var w = T.split(".")[1];
    return t.from(w, "base64").toString(C);
  }
  function m(T) {
    return a.test(T) && !!c(T);
  }
  function g(T, C, w) {
    if (!C) {
      var D = new Error("Missing algorithm parameter for jws.verify");
      throw D.code = "MISSING_ALGORITHM", D;
    }
    T = r(T);
    var _ = p(T), y = d(T), S = n(C);
    return S.verify(y, _, w);
  }
  function v(T, C) {
    if (C = C || {}, T = r(T), !m(T))
      return null;
    var w = c(T);
    if (!w)
      return null;
    var D = h(T);
    return (w.typ === "JWT" || C.json) && (D = JSON.parse(D, C.encoding)), {
      header: w,
      payload: D,
      signature: p(T)
    };
  }
  function E(T) {
    T = T || {};
    var C = T.secret;
    if (C = C ?? T.publicKey, C = C ?? T.key, /^hs/i.test(T.algorithm) === !0 && C == null)
      throw new TypeError("secret must be a string or buffer or a KeyObject");
    var w = new e(C);
    this.readable = !0, this.algorithm = T.algorithm, this.encoding = T.encoding, this.secret = this.publicKey = this.key = w, this.signature = new e(T.signature), this.secret.once("close", (function() {
      !this.signature.writable && this.readable && this.verify();
    }).bind(this)), this.signature.once("close", (function() {
      !this.secret.writable && this.readable && this.verify();
    }).bind(this));
  }
  return o.inherits(E, i), E.prototype.verify = function() {
    try {
      var C = g(this.signature.buffer, this.algorithm, this.key.buffer), w = v(this.signature.buffer, this.encoding);
      return this.emit("done", C, w), this.emit("data", C), this.emit("end"), this.readable = !1, C;
    } catch (D) {
      this.readable = !1, this.emit("error", D), this.emit("close");
    }
  }, E.decode = v, E.isValid = m, E.verify = g, ai = E, ai;
}
var Kr;
function Ba() {
  if (Kr) return qe;
  Kr = 1;
  var t = gu(), e = yu(), n = [
    "HS256",
    "HS384",
    "HS512",
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512"
  ];
  return qe.ALGORITHMS = n, qe.sign = t.sign, qe.verify = e.verify, qe.decode = e.decode, qe.isValid = e.isValid, qe.createSign = function(r) {
    return new t(r);
  }, qe.createVerify = function(r) {
    return new e(r);
  }, qe;
}
var Yr;
function _u() {
  if (Yr) return Gt;
  Yr = 1, Object.defineProperty(Gt, "__esModule", { value: !0 }), Gt.buildPayloadForJwsSign = i, Gt.getJwsSign = r;
  const t = Ba(), e = "RS256", n = "https://oauth2.googleapis.com/token";
  function i(o) {
    const a = Math.floor((/* @__PURE__ */ new Date()).getTime() / 1e3);
    return {
      iss: o.iss,
      scope: o.scope,
      aud: n,
      exp: a + 3600,
      iat: a,
      sub: o.sub,
      ...o.additionalClaims
    };
  }
  function r(o) {
    const a = i(o);
    return (0, t.sign)({
      header: { alg: e },
      payload: a,
      secret: o.key
    });
  }
  return Gt;
}
var zr;
function vu() {
  if (zr) return pn;
  zr = 1, Object.defineProperty(pn, "__esModule", { value: !0 }), pn.getToken = r;
  const t = _u(), e = "https://oauth2.googleapis.com/token", n = "urn:ietf:params:oauth:grant-type:jwt-bearer", i = (o) => ({
    method: "POST",
    url: e,
    data: new URLSearchParams({
      grant_type: n,
      // Grant type for JWT
      assertion: (0, t.getJwsSign)(o)
    }),
    responseType: "json",
    retryConfig: {
      httpMethodsToRetry: ["POST"]
    }
  });
  async function r(o) {
    if (!o.transporter)
      throw new Error("No transporter set.");
    try {
      const a = i(o);
      return (await o.transporter.request(a)).data;
    } catch (a) {
      const l = a, f = l.response?.data;
      throw f?.error && (l.message = `${f.error}: ${f.error_description}`), l;
    }
  }
  return pn;
}
var mn = {}, qt = {}, Xr;
function Eu() {
  if (Xr) return qt;
  Xr = 1, Object.defineProperty(qt, "__esModule", { value: !0 }), qt.ErrorWithCode = void 0;
  class t extends Error {
    code;
    constructor(n, i) {
      super(n), this.code = i;
    }
  }
  return qt.ErrorWithCode = t, qt;
}
var Qr;
function Ha() {
  if (Qr) return mn;
  Qr = 1, Object.defineProperty(mn, "__esModule", { value: !0 }), mn.getCredentials = d;
  const t = Hi, e = st, n = at, i = Eu(), r = e.readFile ? (0, n.promisify)(e.readFile) : async () => {
    throw new i.ErrorWithCode("use key rather than keyFile.", "MISSING_CREDENTIALS");
  };
  var o;
  (function(p) {
    p.JSON = ".json", p.DER = ".der", p.CRT = ".crt", p.PEM = ".pem", p.P12 = ".p12", p.PFX = ".pfx";
  })(o || (o = {}));
  class a {
    keyFilePath;
    constructor(h) {
      this.keyFilePath = h;
    }
    /**
     * Reads a JSON key file and extracts the private key and client email.
     * @returns A promise that resolves with the credentials.
     */
    async getCredentials() {
      const h = await r(this.keyFilePath, "utf8");
      let m;
      try {
        m = JSON.parse(h);
      } catch (E) {
        const T = E;
        throw new Error(`Invalid JSON key file: ${T.message}`);
      }
      const g = m.private_key, v = m.client_email;
      if (!g || !v)
        throw new i.ErrorWithCode("private_key and client_email are required.", "MISSING_CREDENTIALS");
      return { privateKey: g, clientEmail: v };
    }
  }
  class l {
    keyFilePath;
    constructor(h) {
      this.keyFilePath = h;
    }
    /**
     * Reads a PEM-like key file.
     * @returns A promise that resolves with the private key.
     */
    async getCredentials() {
      return { privateKey: await r(this.keyFilePath, "utf8") };
    }
  }
  class f {
    /**
     * Throws an error as P12/PFX certificates are not supported.
     * @returns A promise that rejects with an error.
     */
    async getCredentials() {
      throw new i.ErrorWithCode("*.p12 certificates are not supported after v6.1.2. Consider utilizing *.json format or converting *.p12 to *.pem using the OpenSSL CLI.", "UNKNOWN_CERTIFICATE_TYPE");
    }
  }
  class c {
    /**
     * Creates a credential provider based on the key file extension.
     * @param keyFilePath The path to the key file.
     * @returns An instance of a class that implements ICredentialsProvider.
     */
    static create(h) {
      switch (t.extname(h)) {
        case o.JSON:
          return new a(h);
        case o.DER:
        case o.CRT:
        case o.PEM:
          return new l(h);
        case o.P12:
        case o.PFX:
          return new f();
        default:
          throw new i.ErrorWithCode("Unknown certificate type. Type is determined based on file extension. Current supported extensions are *.json, and *.pem.", "UNKNOWN_CERTIFICATE_TYPE");
      }
    }
  }
  async function d(p) {
    return c.create(p).getCredentials();
  }
  return mn;
}
var Zr;
function Tu() {
  if (Zr) return Ft;
  Zr = 1, Object.defineProperty(Ft, "__esModule", { value: !0 }), Ft.TokenHandler = void 0;
  const t = vu(), e = Ha();
  class n {
    /** The cached access token. */
    token;
    /** The expiration time of the cached access token. */
    tokenExpiresAt;
    /** A promise for an in-flight token request. */
    inFlightRequest;
    tokenOptions;
    /**
     * Creates an instance of TokenHandler.
     * @param tokenOptions The options for fetching tokens.
     * @param transporter The transporter to use for making requests.
     */
    constructor(r) {
      this.tokenOptions = r;
    }
    /**
     * Processes the credentials, loading them from a key file if necessary.
     * This method is called before any token request.
     */
    async processCredentials() {
      if (!this.tokenOptions.key && !this.tokenOptions.keyFile)
        throw new Error("No key or keyFile set.");
      if (!this.tokenOptions.key && this.tokenOptions.keyFile) {
        const r = await (0, e.getCredentials)(this.tokenOptions.keyFile);
        this.tokenOptions.key = r.privateKey, this.tokenOptions.email = r.clientEmail;
      }
    }
    /**
     * Checks if the cached token is expired or close to expiring.
     * @returns True if the token is expiring, false otherwise.
     */
    isTokenExpiring() {
      if (!this.token || !this.tokenExpiresAt)
        return !0;
      const r = (/* @__PURE__ */ new Date()).getTime(), o = this.tokenOptions.eagerRefreshThresholdMillis ?? 0;
      return this.tokenExpiresAt <= r + o;
    }
    /**
     * Returns whether the token has completely expired.
     *
     * @returns true if the token has expired, false otherwise.
     */
    hasExpired() {
      return (/* @__PURE__ */ new Date()).getTime(), this.token && this.tokenExpiresAt ? (/* @__PURE__ */ new Date()).getTime() >= this.tokenExpiresAt : !0;
    }
    /**
     * Fetches an access token, using a cached one if available and not expired.
     * @param forceRefresh If true, forces a new token to be fetched.
     * @returns A promise that resolves with the token data.
     */
    async getToken(r) {
      if (await this.processCredentials(), this.inFlightRequest && !r)
        return this.inFlightRequest;
      if (this.token && !this.isTokenExpiring() && !r)
        return this.token;
      try {
        this.inFlightRequest = (0, t.getToken)(this.tokenOptions);
        const o = await this.inFlightRequest;
        return this.token = o, this.tokenExpiresAt = (/* @__PURE__ */ new Date()).getTime() + (o.expires_in ?? 0) * 1e3, o;
      } finally {
        this.inFlightRequest = void 0;
      }
    }
  }
  return Ft.TokenHandler = n, Ft;
}
var gn = {}, jr;
function Su() {
  if (jr) return gn;
  jr = 1, Object.defineProperty(gn, "__esModule", { value: !0 }), gn.revokeToken = n;
  const t = "https://oauth2.googleapis.com/revoke?token=", e = !0;
  async function n(i, r) {
    const o = t + i;
    return await r.request({
      url: o,
      retry: e
    });
  }
  return gn;
}
var eo;
function Va() {
  if (eo) return Ot;
  eo = 1, Object.defineProperty(Ot, "__esModule", { value: !0 }), Ot.GoogleToken = void 0;
  const t = ve(), e = Tu(), n = Su();
  class i {
    /** The configuration options for this token instance. */
    tokenOptions;
    /** The handler for token fetching and caching logic. */
    tokenHandler;
    /**
     * Create a GoogleToken.
     *
     * @param options  Configuration object.
     */
    constructor(o) {
      this.tokenOptions = o || {}, this.tokenOptions.transporter = this.tokenOptions.transporter || {
        request: (a) => (0, t.request)(a)
      }, this.tokenOptions.iss || (this.tokenOptions.iss = this.tokenOptions.email), typeof this.tokenOptions.scope == "object" && (this.tokenOptions.scope = this.tokenOptions.scope.join(" ")), this.tokenHandler = new e.TokenHandler(this.tokenOptions);
    }
    get expiresAt() {
      return this.tokenHandler.tokenExpiresAt;
    }
    /**
     * The most recent access token obtained by this client.
     */
    get accessToken() {
      return this.tokenHandler.token?.access_token;
    }
    /**
     * The most recent ID token obtained by this client.
     */
    get idToken() {
      return this.tokenHandler.token?.id_token;
    }
    /**
     * The token type of the most recent access token.
     */
    get tokenType() {
      return this.tokenHandler.token?.token_type;
    }
    /**
     * The refresh token for the current credentials.
     */
    get refreshToken() {
      return this.tokenHandler.token?.refresh_token;
    }
    /**
     * A boolean indicating if the current token has expired.
     */
    hasExpired() {
      return this.tokenHandler.hasExpired();
    }
    /**
     * A boolean indicating if the current token is expiring soon,
     * based on the `eagerRefreshThresholdMillis` option.
     */
    isTokenExpiring() {
      return this.tokenHandler.isTokenExpiring();
    }
    getToken(o, a = { forceRefresh: !1 }) {
      let l;
      typeof o == "function" ? l = o : typeof o == "object" && (a = o);
      const f = this.tokenHandler.getToken(a.forceRefresh ?? !1);
      return l && f.then((c) => l(null, c), l), f;
    }
    revokeToken(o) {
      if (!this.accessToken)
        return Promise.reject(new Error("No token to revoke."));
      const a = (0, n.revokeToken)(this.accessToken, this.tokenOptions.transporter);
      o && a.then(() => o(), o), this.tokenHandler = new e.TokenHandler(this.tokenOptions);
    }
    /**
     * Returns the configuration options for this token instance.
     */
    get googleTokenOptions() {
      return this.tokenOptions;
    }
  }
  return Ot.GoogleToken = i, Ot;
}
var Bt = {}, to;
function Ja() {
  if (to) return Bt;
  to = 1, Object.defineProperty(Bt, "__esModule", { value: !0 }), Bt.JWTAccess = void 0;
  const t = Ba(), e = Oe(), n = {
    alg: "RS256",
    typ: "JWT"
  };
  class i {
    email;
    key;
    keyId;
    projectId;
    eagerRefreshThresholdMillis;
    cache = new e.LRUCache({
      capacity: 500,
      maxAge: 3600 * 1e3
    });
    /**
     * JWTAccess service account credentials.
     *
     * Create a new access token by using the credential to create a new JWT token
     * that's recognized as the access token.
     *
     * @param email the service account email address.
     * @param key the private key that will be used to sign the token.
     * @param keyId the ID of the private key used to sign the token.
     */
    constructor(o, a, l, f) {
      this.email = o, this.key = a, this.keyId = l, this.eagerRefreshThresholdMillis = f ?? 300 * 1e3;
    }
    /**
     * Ensures that we're caching a key appropriately, giving precedence to scopes vs. url
     *
     * @param url The URI being authorized.
     * @param scopes The scope or scopes being authorized
     * @returns A string that returns the cached key.
     */
    getCachedKey(o, a) {
      let l = o;
      if (a && Array.isArray(a) && a.length ? l = o ? `${o}_${a.join("_")}` : `${a.join("_")}` : typeof a == "string" && (l = o ? `${o}_${a}` : a), !l)
        throw Error("Scopes or url must be provided");
      return l;
    }
    /**
     * Get a non-expired access token, after refreshing if necessary.
     *
     * @param url The URI being authorized.
     * @param additionalClaims An object with a set of additional claims to
     * include in the payload.
     * @returns An object that includes the authorization header.
     */
    getRequestHeaders(o, a, l) {
      const f = this.getCachedKey(o, l), c = this.cache.get(f), d = Date.now();
      if (c && c.expiration - d > this.eagerRefreshThresholdMillis)
        return new Headers(c.headers);
      const p = Math.floor(Date.now() / 1e3), h = i.getExpirationTime(p);
      let m;
      if (Array.isArray(l) && (l = l.join(" ")), l ? m = {
        iss: this.email,
        sub: this.email,
        scope: l,
        exp: h,
        iat: p
      } : m = {
        iss: this.email,
        sub: this.email,
        aud: o,
        exp: h,
        iat: p
      }, a) {
        for (const C in m)
          if (a[C])
            throw new Error(`The '${C}' property is not allowed when passing additionalClaims. This claim is included in the JWT by default.`);
      }
      const g = this.keyId ? { ...n, kid: this.keyId } : n, v = Object.assign(m, a), E = t.sign({ header: g, payload: v, secret: this.key }), T = new Headers({ authorization: `Bearer ${E}` });
      return this.cache.set(f, {
        expiration: h * 1e3,
        headers: T
      }), T;
    }
    /**
     * Returns an expiration time for the JWT token.
     *
     * @param iat The issued at time for the JWT.
     * @returns An expiration time for the JWT.
     */
    static getExpirationTime(o) {
      return o + 3600;
    }
    /**
     * Create a JWTAccess credentials instance using the given input options.
     * @param json The input object.
     */
    fromJSON(o) {
      if (!o)
        throw new Error("Must pass in a JSON object containing the service account auth settings.");
      if (!o.client_email)
        throw new Error("The incoming JSON object does not contain a client_email field");
      if (!o.private_key)
        throw new Error("The incoming JSON object does not contain a private_key field");
      this.email = o.client_email, this.key = o.private_key, this.keyId = o.private_key_id, this.projectId = o.project_id;
    }
    fromStream(o, a) {
      if (a)
        this.fromStreamAsync(o).then(() => a(), a);
      else
        return this.fromStreamAsync(o);
    }
    fromStreamAsync(o) {
      return new Promise((a, l) => {
        o || l(new Error("Must pass in a stream containing the service account auth settings."));
        let f = "";
        o.setEncoding("utf8").on("data", (c) => f += c).on("error", l).on("end", () => {
          try {
            const c = JSON.parse(f);
            this.fromJSON(c), a();
          } catch (c) {
            l(c);
          }
        });
      });
    }
  }
  return Bt.JWTAccess = i, Bt;
}
var no;
function $a() {
  if (no) return Lt;
  no = 1, Object.defineProperty(Lt, "__esModule", { value: !0 }), Lt.JWT = void 0;
  const t = Va(), e = Ha(), n = Ja(), i = gt(), r = Pe();
  class o extends i.OAuth2Client {
    email;
    keyFile;
    key;
    keyId;
    defaultScopes;
    scopes;
    scope;
    subject;
    gtoken;
    additionalClaims;
    useJWTAccessWithScope;
    defaultServicePath;
    access;
    /**
     * JWT service account credentials.
     *
     * Retrieve access token using gtoken.
     *
     * @param options the
     */
    constructor(l = {}) {
      super(l), this.email = l.email, this.keyFile = l.keyFile, this.key = l.key, this.keyId = l.keyId, this.scopes = l.scopes, this.subject = l.subject, this.additionalClaims = l.additionalClaims, this.credentials = { refresh_token: "jwt-placeholder", expiry_date: 1 };
    }
    /**
     * Creates a copy of the credential with the specified scopes.
     * @param scopes List of requested scopes or a single scope.
     * @return The cloned instance.
     */
    createScoped(l) {
      const f = new o(this);
      return f.scopes = l, f;
    }
    /**
     * Obtains the metadata to be sent with the request.
     *
     * @param url the URI being authorized.
     */
    async getRequestMetadataAsync(l) {
      l = this.defaultServicePath ? `https://${this.defaultServicePath}/` : l;
      const f = !this.hasUserScopes() && l || this.useJWTAccessWithScope && this.hasAnyScopes() || this.universeDomain !== r.DEFAULT_UNIVERSE;
      if (this.subject && this.universeDomain !== r.DEFAULT_UNIVERSE)
        throw new RangeError(`Service Account user is configured for the credential. Domain-wide delegation is not supported in universes other than ${r.DEFAULT_UNIVERSE}`);
      if (!this.apiKey && f)
        if (this.additionalClaims && this.additionalClaims.target_audience) {
          const { tokens: c } = await this.refreshToken();
          return {
            headers: this.addSharedMetadataHeaders(new Headers({
              authorization: `Bearer ${c.id_token}`
            }))
          };
        } else {
          this.access || (this.access = new n.JWTAccess(this.email, this.key, this.keyId, this.eagerRefreshThresholdMillis));
          let c;
          this.hasUserScopes() ? c = this.scopes : l || (c = this.defaultScopes);
          const d = this.useJWTAccessWithScope || this.universeDomain !== r.DEFAULT_UNIVERSE, p = await this.access.getRequestHeaders(
            l ?? void 0,
            this.additionalClaims,
            // Scopes take precedent over audience for signing,
            // so we only provide them if `useJWTAccessWithScope` is on or
            // if we are in a non-default universe
            d ? c : void 0
          );
          return { headers: this.addSharedMetadataHeaders(p) };
        }
      else return this.hasAnyScopes() || this.apiKey ? super.getRequestMetadataAsync(l) : { headers: new Headers() };
    }
    /**
     * Fetches an ID token.
     * @param targetAudience the audience for the fetched ID token.
     */
    async fetchIdToken(l) {
      const f = new t.GoogleToken({
        iss: this.email,
        sub: this.subject,
        scope: this.scopes || this.defaultScopes,
        keyFile: this.keyFile,
        key: this.key,
        additionalClaims: { target_audience: l },
        transporter: this.transporter
      });
      if (await f.getToken({
        forceRefresh: !0
      }), !f.idToken)
        throw new Error("Unknown error: Failed to fetch ID token");
      return f.idToken;
    }
    /**
     * Determine if there are currently scopes available.
     */
    hasUserScopes() {
      return this.scopes ? this.scopes.length > 0 : !1;
    }
    /**
     * Are there any default or user scopes defined.
     */
    hasAnyScopes() {
      return !!(this.scopes && this.scopes.length > 0 || this.defaultScopes && this.defaultScopes.length > 0);
    }
    authorize(l) {
      if (l)
        this.authorizeAsync().then((f) => l(null, f), l);
      else
        return this.authorizeAsync();
    }
    async authorizeAsync() {
      const l = await this.refreshToken();
      if (!l)
        throw new Error("No result returned");
      return this.credentials = l.tokens, this.credentials.refresh_token = "jwt-placeholder", this.key = this.gtoken.googleTokenOptions?.key, this.email = this.gtoken.googleTokenOptions?.iss, l.tokens;
    }
    /**
     * Refreshes the access token.
     * @param refreshToken ignored
     * @private
     */
    async refreshTokenNoCache() {
      const l = this.createGToken(), c = {
        access_token: (await l.getToken({
          forceRefresh: this.isTokenExpiring()
        })).access_token,
        token_type: "Bearer",
        expiry_date: l.expiresAt,
        id_token: l.idToken
      };
      return this.emit("tokens", c), { res: null, tokens: c };
    }
    /**
     * Create a gToken if it doesn't already exist.
     */
    createGToken() {
      return this.gtoken || (this.gtoken = new t.GoogleToken({
        iss: this.email,
        sub: this.subject,
        scope: this.scopes || this.defaultScopes,
        keyFile: this.keyFile,
        key: this.key,
        additionalClaims: this.additionalClaims,
        transporter: this.transporter
      })), this.gtoken;
    }
    /**
     * Create a JWT credentials instance using the given input options.
     * @param json The input object.
     *
     * @remarks
     *
     * **Important**: If you accept a credential configuration (credential JSON/File/Stream) from an external source for authentication to Google Cloud, you must validate it before providing it to any Google API or library. Providing an unvalidated credential configuration to Google APIs can compromise the security of your systems and data. For more information, refer to {@link https://cloud.google.com/docs/authentication/external/externally-sourced-credentials Validate credential configurations from external sources}.
     */
    fromJSON(l) {
      if (!l)
        throw new Error("Must pass in a JSON object containing the service account auth settings.");
      if (!l.client_email)
        throw new Error("The incoming JSON object does not contain a client_email field");
      if (!l.private_key)
        throw new Error("The incoming JSON object does not contain a private_key field");
      this.email = l.client_email, this.key = l.private_key, this.keyId = l.private_key_id, this.projectId = l.project_id, this.quotaProjectId = l.quota_project_id, this.universeDomain = l.universe_domain || this.universeDomain;
    }
    fromStream(l, f) {
      if (f)
        this.fromStreamAsync(l).then(() => f(), f);
      else
        return this.fromStreamAsync(l);
    }
    fromStreamAsync(l) {
      return new Promise((f, c) => {
        if (!l)
          throw new Error("Must pass in a stream containing the service account auth settings.");
        let d = "";
        l.setEncoding("utf8").on("error", c).on("data", (p) => d += p).on("end", () => {
          try {
            const p = JSON.parse(d);
            this.fromJSON(p), f();
          } catch (p) {
            c(p);
          }
        });
      });
    }
    /**
     * Creates a JWT credentials instance using an API Key for authentication.
     * @param apiKey The API Key in string form.
     */
    fromAPIKey(l) {
      if (typeof l != "string")
        throw new Error("Must provide an API Key string.");
      this.apiKey = l;
    }
    /**
     * Using the key or keyFile on the JWT client, obtain an object that contains
     * the key and the client email.
     */
    async getCredentials() {
      if (this.key)
        return { private_key: this.key, client_email: this.email };
      if (this.keyFile) {
        this.createGToken();
        const l = await (0, e.getCredentials)(this.keyFile);
        return { private_key: l.privateKey, client_email: l.clientEmail };
      }
      throw new Error("A key or a keyFile must be provided to getCredentials.");
    }
  }
  return Lt.JWT = o, Lt;
}
var et = {}, io;
function Wa() {
  if (io) return et;
  io = 1, Object.defineProperty(et, "__esModule", { value: !0 }), et.UserRefreshClient = et.USER_REFRESH_ACCOUNT_TYPE = void 0;
  const t = gt(), e = Pe();
  et.USER_REFRESH_ACCOUNT_TYPE = "authorized_user";
  class n extends t.OAuth2Client {
    // TODO: refactor tests to make this private
    // In a future gts release, the _propertyName rule will be lifted.
    // This is also a hard one because `this.refreshToken` is a function.
    _refreshToken;
    /**
     * The User Refresh Token client.
     *
     * @param optionsOrClientId The User Refresh Token client options. Passing an `clientId` directly is **@DEPRECATED**.
     * @param clientSecret **@DEPRECATED**. Provide a {@link UserRefreshClientOptions `UserRefreshClientOptions`} object in the first parameter instead.
     * @param refreshToken **@DEPRECATED**. Provide a {@link UserRefreshClientOptions `UserRefreshClientOptions`} object in the first parameter instead.
     * @param eagerRefreshThresholdMillis **@DEPRECATED**. Provide a {@link UserRefreshClientOptions `UserRefreshClientOptions`} object in the first parameter instead.
     * @param forceRefreshOnFailure **@DEPRECATED**. Provide a {@link UserRefreshClientOptions `UserRefreshClientOptions`} object in the first parameter instead.
     */
    constructor(r, o, a, l, f) {
      const c = r && typeof r == "object" ? r : {
        clientId: r,
        clientSecret: o,
        refreshToken: a,
        eagerRefreshThresholdMillis: l,
        forceRefreshOnFailure: f
      };
      super(c), this._refreshToken = c.refreshToken, this.credentials.refresh_token = c.refreshToken;
    }
    /**
     * Refreshes the access token.
     * @param refreshToken An ignored refreshToken..
     * @param callback Optional callback.
     */
    async refreshTokenNoCache() {
      return super.refreshTokenNoCache(this._refreshToken);
    }
    async fetchIdToken(r) {
      const o = {
        ...n.RETRY_CONFIG,
        url: this.endpoints.oauth2TokenUrl,
        method: "POST",
        data: new URLSearchParams({
          client_id: this._clientId,
          client_secret: this._clientSecret,
          grant_type: "refresh_token",
          refresh_token: this._refreshToken,
          target_audience: r
        }),
        responseType: "json"
      };
      return e.AuthClient.setMethodName(o, "fetchIdToken"), (await this.transporter.request(o)).data.id_token;
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */
    fromJSON(r) {
      if (!r)
        throw new Error("Must pass in a JSON object containing the user refresh token");
      if (r.type !== "authorized_user")
        throw new Error('The incoming JSON object does not have the "authorized_user" type');
      if (!r.client_id)
        throw new Error("The incoming JSON object does not contain a client_id field");
      if (!r.client_secret)
        throw new Error("The incoming JSON object does not contain a client_secret field");
      if (!r.refresh_token)
        throw new Error("The incoming JSON object does not contain a refresh_token field");
      this._clientId = r.client_id, this._clientSecret = r.client_secret, this._refreshToken = r.refresh_token, this.credentials.refresh_token = r.refresh_token, this.quotaProjectId = r.quota_project_id, this.universeDomain = r.universe_domain || this.universeDomain;
    }
    fromStream(r, o) {
      if (o)
        this.fromStreamAsync(r).then(() => o(), o);
      else
        return this.fromStreamAsync(r);
    }
    async fromStreamAsync(r) {
      return new Promise((o, a) => {
        if (!r)
          return a(new Error("Must pass in a stream containing the user refresh token."));
        let l = "";
        r.setEncoding("utf8").on("error", a).on("data", (f) => l += f).on("end", () => {
          try {
            const f = JSON.parse(l);
            return this.fromJSON(f), o();
          } catch (f) {
            return a(f);
          }
        });
      });
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */
    static fromJSON(r) {
      const o = new n();
      return o.fromJSON(r), o;
    }
  }
  return et.UserRefreshClient = n, et;
}
var tt = {}, ro;
function Ka() {
  if (ro) return tt;
  ro = 1, Object.defineProperty(tt, "__esModule", { value: !0 }), tt.Impersonated = tt.IMPERSONATED_ACCOUNT_TYPE = void 0;
  const t = gt(), e = ve(), n = Oe();
  tt.IMPERSONATED_ACCOUNT_TYPE = "impersonated_service_account";
  class i extends t.OAuth2Client {
    sourceClient;
    targetPrincipal;
    targetScopes;
    delegates;
    lifetime;
    endpoint;
    /**
     * Impersonated service account credentials.
     *
     * Create a new access token by impersonating another service account.
     *
     * Impersonated Credentials allowing credentials issued to a user or
     * service account to impersonate another. The source project using
     * Impersonated Credentials must enable the "IAMCredentials" API.
     * Also, the target service account must grant the orginating principal
     * the "Service Account Token Creator" IAM role.
     *
     * **IMPORTANT**: This method does not validate the credential configuration.
     * A security risk occurs when a credential configuration configured with
     * malicious URLs is used. When the credential configuration is accepted from
     * an untrusted source, you should validate it before using it with this
     * method. For more details, see
     * https://cloud.google.com/docs/authentication/external/externally-sourced-credentials.
     *
     * @param {object} options - The configuration object.
     * @param {object} [options.sourceClient] the source credential used as to
     * acquire the impersonated credentials.
     * @param {string} [options.targetPrincipal] the service account to
     * impersonate.
     * @param {string[]} [options.delegates] the chained list of delegates
     * required to grant the final access_token. If set, the sequence of
     * identities must have "Service Account Token Creator" capability granted to
     * the preceding identity. For example, if set to [serviceAccountB,
     * serviceAccountC], the sourceCredential must have the Token Creator role on
     * serviceAccountB. serviceAccountB must have the Token Creator on
     * serviceAccountC. Finally, C must have Token Creator on target_principal.
     * If left unset, sourceCredential must have that role on targetPrincipal.
     * @param {string[]} [options.targetScopes] scopes to request during the
     * authorization grant.
     * @param {number} [options.lifetime] number of seconds the delegated
     * credential should be valid for up to 3600 seconds by default, or 43,200
     * seconds by extending the token's lifetime, see:
     * https://cloud.google.com/iam/docs/creating-short-lived-service-account-credentials#sa-credentials-oauth
     * @param {string} [options.endpoint] api endpoint override.
     */
    constructor(o = {}) {
      if (super(o), this.credentials = {
        expiry_date: 1,
        refresh_token: "impersonated-placeholder"
      }, this.sourceClient = o.sourceClient ?? new t.OAuth2Client(), this.targetPrincipal = o.targetPrincipal ?? "", this.delegates = o.delegates ?? [], this.targetScopes = o.targetScopes ?? [], this.lifetime = o.lifetime ?? 3600, !!!(0, n.originalOrCamelOptions)(o).get("universe_domain"))
        this.universeDomain = this.sourceClient.universeDomain;
      else if (this.sourceClient.universeDomain !== this.universeDomain)
        throw new RangeError(`Universe domain ${this.sourceClient.universeDomain} in source credentials does not match ${this.universeDomain} universe domain set for impersonated credentials.`);
      this.endpoint = o.endpoint ?? `https://iamcredentials.${this.universeDomain}`;
    }
    /**
     * Signs some bytes.
     *
     * {@link https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/signBlob Reference Documentation}
     * @param blobToSign String to sign.
     *
     * @returns A {@link SignBlobResponse} denoting the keyID and signedBlob in base64 string
     */
    async sign(o) {
      await this.sourceClient.getAccessToken();
      const a = `projects/-/serviceAccounts/${this.targetPrincipal}`, l = `${this.endpoint}/v1/${a}:signBlob`, f = {
        delegates: this.delegates,
        payload: Buffer.from(o).toString("base64")
      };
      return (await this.sourceClient.request({
        ...i.RETRY_CONFIG,
        url: l,
        data: f,
        method: "POST"
      })).data;
    }
    /** The service account email to be impersonated. */
    getTargetPrincipal() {
      return this.targetPrincipal;
    }
    /**
     * Refreshes the access token.
     */
    async refreshToken() {
      try {
        await this.sourceClient.getAccessToken();
        const o = "projects/-/serviceAccounts/" + this.targetPrincipal, a = `${this.endpoint}/v1/${o}:generateAccessToken`, l = {
          delegates: this.delegates,
          scope: this.targetScopes,
          lifetime: this.lifetime + "s"
        }, f = await this.sourceClient.request({
          ...i.RETRY_CONFIG,
          url: a,
          data: l,
          method: "POST"
        }), c = f.data;
        return this.credentials.access_token = c.accessToken, this.credentials.expiry_date = Date.parse(c.expireTime), {
          tokens: this.credentials,
          res: f
        };
      } catch (o) {
        if (!(o instanceof Error))
          throw o;
        let a = 0, l = "";
        throw o instanceof e.GaxiosError && (a = o?.response?.data?.error?.status, l = o?.response?.data?.error?.message), a && l ? (o.message = `${a}: unable to impersonate: ${l}`, o) : (o.message = `unable to impersonate: ${o}`, o);
      }
    }
    /**
     * Generates an OpenID Connect ID token for a service account.
     *
     * {@link https://cloud.google.com/iam/docs/reference/credentials/rest/v1/projects.serviceAccounts/generateIdToken Reference Documentation}
     *
     * @param targetAudience the audience for the fetched ID token.
     * @param options the for the request
     * @return an OpenID Connect ID token
     */
    async fetchIdToken(o, a) {
      await this.sourceClient.getAccessToken();
      const l = `projects/-/serviceAccounts/${this.targetPrincipal}`, f = `${this.endpoint}/v1/${l}:generateIdToken`, c = {
        delegates: this.delegates,
        audience: o,
        includeEmail: a?.includeEmail ?? !0,
        useEmailAzp: a?.includeEmail ?? !0
      };
      return (await this.sourceClient.request({
        ...i.RETRY_CONFIG,
        url: f,
        data: c,
        method: "POST"
      })).data.token;
    }
  }
  return tt.Impersonated = i, tt;
}
var Ht = {}, li = {}, Vt = {}, ut = {}, oo;
function Ya() {
  if (oo) return ut;
  oo = 1, Object.defineProperty(ut, "__esModule", { value: !0 }), ut.OAuthClientAuthHandler = void 0, ut.getErrorFromOAuthErrorResponse = r;
  const t = ve(), e = xn(), n = ["PUT", "POST", "PATCH"];
  class i {
    #e = (0, e.createCrypto)();
    #t;
    transporter;
    /**
     * Instantiates an OAuth client authentication handler.
     * @param options The OAuth Client Auth Handler instance options. Passing an `ClientAuthentication` directly is **@DEPRECATED**.
     */
    constructor(a) {
      a && "clientId" in a ? (this.#t = a, this.transporter = new t.Gaxios()) : (this.#t = a?.clientAuthentication, this.transporter = a?.transporter || new t.Gaxios());
    }
    /**
     * Applies client authentication on the OAuth request's headers or POST
     * body but does not process the request.
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     * @param bearerToken The optional bearer token to use for authentication.
     *   When this is used, no client authentication credentials are needed.
     */
    applyClientAuthenticationOptions(a, l) {
      a.headers = t.Gaxios.mergeHeaders(a.headers), this.injectAuthenticatedHeaders(a, l), l || this.injectAuthenticatedRequestBody(a);
    }
    /**
     * Applies client authentication on the request's header if either
     * basic authentication or bearer token authentication is selected.
     *
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     * @param bearerToken The optional bearer token to use for authentication.
     *   When this is used, no client authentication credentials are needed.
     */
    injectAuthenticatedHeaders(a, l) {
      if (l)
        a.headers = t.Gaxios.mergeHeaders(a.headers, {
          authorization: `Bearer ${l}`
        });
      else if (this.#t?.confidentialClientType === "basic") {
        a.headers = t.Gaxios.mergeHeaders(a.headers);
        const f = this.#t.clientId, c = this.#t.clientSecret || "", d = this.#e.encodeBase64StringUtf8(`${f}:${c}`);
        t.Gaxios.mergeHeaders(a.headers, {
          authorization: `Basic ${d}`
        });
      }
    }
    /**
     * Applies client authentication on the request's body if request-body
     * client authentication is selected.
     *
     * @param opts The GaxiosOptions whose headers or data are to be modified
     *   depending on the client authentication mechanism to be used.
     */
    injectAuthenticatedRequestBody(a) {
      if (this.#t?.confidentialClientType === "request-body") {
        const l = (a.method || "GET").toUpperCase();
        if (!n.includes(l))
          throw new Error(`${l} HTTP method does not support ${this.#t.confidentialClientType} client authentication`);
        const c = new Headers(a.headers).get("content-type");
        if (c?.startsWith("application/x-www-form-urlencoded") || a.data instanceof URLSearchParams) {
          const d = new URLSearchParams(a.data ?? "");
          d.append("client_id", this.#t.clientId), d.append("client_secret", this.#t.clientSecret || ""), a.data = d;
        } else if (c?.startsWith("application/json"))
          a.data = a.data || {}, Object.assign(a.data, {
            client_id: this.#t.clientId,
            client_secret: this.#t.clientSecret || ""
          });
        else
          throw new Error(`${c} content-types are not supported with ${this.#t.confidentialClientType} client authentication`);
      }
    }
    /**
     * Retry config for Auth-related requests.
     *
     * @remarks
     *
     * This is not a part of the default {@link AuthClient.transporter transporter/gaxios}
     * config as some downstream APIs would prefer if customers explicitly enable retries,
     * such as GCS.
     */
    static get RETRY_CONFIG() {
      return {
        retry: !0,
        retryConfig: {
          httpMethodsToRetry: ["GET", "PUT", "POST", "HEAD", "OPTIONS", "DELETE"]
        }
      };
    }
  }
  ut.OAuthClientAuthHandler = i;
  function r(o, a) {
    const l = o.error, f = o.error_description, c = o.error_uri;
    let d = `Error code ${l}`;
    typeof f < "u" && (d += `: ${f}`), typeof c < "u" && (d += ` - ${c}`);
    const p = new Error(d);
    if (a) {
      const h = Object.keys(a);
      a.stack && h.push("stack"), h.forEach((m) => {
        m !== "message" && Object.defineProperty(p, m, {
          value: a[m],
          writable: !1,
          enumerable: !0
        });
      });
    }
    return p;
  }
  return ut;
}
var so;
function Vi() {
  if (so) return Vt;
  so = 1, Object.defineProperty(Vt, "__esModule", { value: !0 }), Vt.StsCredentials = void 0;
  const t = ve(), e = Pe(), n = Ya(), i = Oe();
  class r extends n.OAuthClientAuthHandler {
    #e;
    /**
     * Initializes an STS credentials instance.
     *
     * @param options The STS credentials instance options. Passing an `tokenExchangeEndpoint` directly is **@DEPRECATED**.
     * @param clientAuthentication **@DEPRECATED**. Provide a {@link StsCredentialsConstructionOptions `StsCredentialsConstructionOptions`} object in the first parameter instead.
     */
    constructor(a = {
      tokenExchangeEndpoint: ""
    }, l) {
      (typeof a != "object" || a instanceof URL) && (a = {
        tokenExchangeEndpoint: a,
        clientAuthentication: l
      }), super(a), this.#e = a.tokenExchangeEndpoint;
    }
    /**
     * Exchanges the provided token for another type of token based on the
     * rfc8693 spec.
     * @param stsCredentialsOptions The token exchange options used to populate
     *   the token exchange request.
     * @param additionalHeaders Optional additional headers to pass along the
     *   request.
     * @param options Optional additional GCP-specific non-spec defined options
     *   to send with the request.
     *   Example: `&options=${encodeUriComponent(JSON.stringified(options))}`
     * @return A promise that resolves with the token exchange response containing
     *   the requested token and its expiration time.
     */
    async exchangeToken(a, l, f) {
      const c = {
        grant_type: a.grantType,
        resource: a.resource,
        audience: a.audience,
        scope: a.scope?.join(" "),
        requested_token_type: a.requestedTokenType,
        subject_token: a.subjectToken,
        subject_token_type: a.subjectTokenType,
        actor_token: a.actingParty?.actorToken,
        actor_token_type: a.actingParty?.actorTokenType,
        // Non-standard GCP-specific options.
        options: f && JSON.stringify(f)
      }, d = {
        ...r.RETRY_CONFIG,
        url: this.#e.toString(),
        method: "POST",
        headers: l,
        data: new URLSearchParams((0, i.removeUndefinedValuesInObject)(c)),
        responseType: "json"
      };
      e.AuthClient.setMethodName(d, "exchangeToken"), this.applyClientAuthenticationOptions(d);
      try {
        const p = await this.transporter.request(d), h = p.data;
        return h.res = p, h;
      } catch (p) {
        throw p instanceof t.GaxiosError && p.response ? (0, n.getErrorFromOAuthErrorResponse)(
          p.response.data,
          // Preserve other fields from the original error.
          p
        ) : p;
      }
    }
  }
  return Vt.StsCredentials = r, Vt;
}
var ao;
function lt() {
  return ao || (ao = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.BaseExternalAccountClient = t.CLOUD_RESOURCE_MANAGER = t.EXTERNAL_ACCOUNT_TYPE = t.EXPIRATION_TIME_OFFSET = void 0;
    const e = ve(), n = we, i = Pe(), r = Vi(), o = Oe(), a = Da(), l = "urn:ietf:params:oauth:grant-type:token-exchange", f = "urn:ietf:params:oauth:token-type:access_token", c = "https://www.googleapis.com/auth/cloud-platform", d = 3600;
    t.EXPIRATION_TIME_OFFSET = 300 * 1e3, t.EXTERNAL_ACCOUNT_TYPE = "external_account", t.CLOUD_RESOURCE_MANAGER = "https://cloudresourcemanager.googleapis.com/v1/projects/";
    const p = "//iam\\.googleapis\\.com/locations/[^/]+/workforcePools/[^/]+/providers/.+", h = "https://sts.{universeDomain}/v1/token";
    class m extends i.AuthClient {
      /**
       * OAuth scopes for the GCP access token to use. When not provided,
       * the default https://www.googleapis.com/auth/cloud-platform is
       * used.
       */
      scopes;
      projectNumber;
      audience;
      subjectTokenType;
      stsCredential;
      clientAuth;
      credentialSourceType;
      cachedAccessToken;
      serviceAccountImpersonationUrl;
      serviceAccountImpersonationLifetime;
      workforcePoolUserProject;
      configLifetimeRequested;
      tokenUrl;
      /**
       * @example
       * ```ts
       * new URL('https://cloudresourcemanager.googleapis.com/v1/projects/');
       * ```
       */
      cloudResourceManagerURL;
      supplierContext;
      /**
       * A pending access token request. Used for concurrent calls.
       */
      #e = null;
      /**
       * Instantiate a BaseExternalAccountClient instance using the provided JSON
       * object loaded from an external account credentials file.
       * @param options The external account options object typically loaded
       *   from the external account JSON credential file. The camelCased options
       *   are aliases for the snake_cased options.
       */
      constructor(v) {
        super(v);
        const E = (0, o.originalOrCamelOptions)(v), T = E.get("type");
        if (T && T !== t.EXTERNAL_ACCOUNT_TYPE)
          throw new Error(`Expected "${t.EXTERNAL_ACCOUNT_TYPE}" type but received "${v.type}"`);
        const C = E.get("client_id"), w = E.get("client_secret");
        this.tokenUrl = E.get("token_url") ?? h.replace("{universeDomain}", this.universeDomain);
        const D = E.get("subject_token_type"), _ = E.get("workforce_pool_user_project"), y = E.get("service_account_impersonation_url"), S = E.get("service_account_impersonation"), R = (0, o.originalOrCamelOptions)(S).get("token_lifetime_seconds");
        this.cloudResourceManagerURL = new URL(E.get("cloud_resource_manager_url") || `https://cloudresourcemanager.${this.universeDomain}/v1/projects/`), C && (this.clientAuth = {
          confidentialClientType: "basic",
          clientId: C,
          clientSecret: w
        }), this.stsCredential = new r.StsCredentials({
          tokenExchangeEndpoint: this.tokenUrl,
          clientAuthentication: this.clientAuth
        }), this.scopes = E.get("scopes") || [c], this.cachedAccessToken = null, this.audience = E.get("audience"), this.subjectTokenType = D, this.workforcePoolUserProject = _;
        const P = new RegExp(p);
        if (this.workforcePoolUserProject && !this.audience.match(P))
          throw new Error("workforcePoolUserProject should not be set for non-workforce pool credentials.");
        this.serviceAccountImpersonationUrl = y, this.serviceAccountImpersonationLifetime = R, this.serviceAccountImpersonationLifetime ? this.configLifetimeRequested = !0 : (this.configLifetimeRequested = !1, this.serviceAccountImpersonationLifetime = d), this.projectNumber = this.getProjectNumber(this.audience), this.supplierContext = {
          audience: this.audience,
          subjectTokenType: this.subjectTokenType,
          transporter: this.transporter
        };
      }
      /** The service account email to be impersonated, if available. */
      getServiceAccountEmail() {
        if (this.serviceAccountImpersonationUrl) {
          if (this.serviceAccountImpersonationUrl.length > 256)
            throw new RangeError(`URL is too long: ${this.serviceAccountImpersonationUrl}`);
          return /serviceAccounts\/(?<email>[^:]+):generateAccessToken$/.exec(this.serviceAccountImpersonationUrl)?.groups?.email || null;
        }
        return null;
      }
      /**
       * Provides a mechanism to inject GCP access tokens directly.
       * When the provided credential expires, a new credential, using the
       * external account options, is retrieved.
       * @param credentials The Credentials object to set on the current client.
       */
      setCredentials(v) {
        super.setCredentials(v), this.cachedAccessToken = v;
      }
      /**
       * @return A promise that resolves with the current GCP access token
       *   response. If the current credential is expired, a new one is retrieved.
       */
      async getAccessToken() {
        return (!this.cachedAccessToken || this.isExpired(this.cachedAccessToken)) && await this.refreshAccessTokenAsync(), {
          token: this.cachedAccessToken.access_token,
          res: this.cachedAccessToken.res
        };
      }
      /**
       * The main authentication interface. It takes an optional url which when
       * present is the endpoint being accessed, and returns a Promise which
       * resolves with authorization header fields.
       *
       * The result has the form:
       * { authorization: 'Bearer <access_token_value>' }
       */
      async getRequestHeaders() {
        const v = await this.getAccessToken(), E = new Headers({
          authorization: `Bearer ${v.token}`
        });
        return this.addSharedMetadataHeaders(E);
      }
      request(v, E) {
        if (E)
          this.requestAsync(v).then((T) => E(null, T), (T) => E(T, T.response));
        else
          return this.requestAsync(v);
      }
      /**
       * @return A promise that resolves with the project ID corresponding to the
       *   current workload identity pool or current workforce pool if
       *   determinable. For workforce pool credential, it returns the project ID
       *   corresponding to the workforcePoolUserProject.
       *   This is introduced to match the current pattern of using the Auth
       *   library:
       *   const projectId = await auth.getProjectId();
       *   const url = `https://dns.googleapis.com/dns/v1/projects/${projectId}`;
       *   const res = await client.request({ url });
       *   The resource may not have permission
       *   (resourcemanager.projects.get) to call this API or the required
       *   scopes may not be selected:
       *   https://cloud.google.com/resource-manager/reference/rest/v1/projects/get#authorization-scopes
       */
      async getProjectId() {
        const v = this.projectNumber || this.workforcePoolUserProject;
        if (this.projectId)
          return this.projectId;
        if (v) {
          const E = await this.getRequestHeaders(), T = {
            ...m.RETRY_CONFIG,
            headers: E,
            url: `${this.cloudResourceManagerURL.toString()}${v}`,
            responseType: "json"
          };
          i.AuthClient.setMethodName(T, "getProjectId");
          const C = await this.transporter.request(T);
          return this.projectId = C.data.projectId, this.projectId;
        }
        return null;
      }
      /**
       * Authenticates the provided HTTP request, processes it and resolves with the
       * returned response.
       * @param opts The HTTP request options.
       * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure.
       * @return A promise that resolves with the successful response.
       */
      async requestAsync(v, E = !1) {
        let T;
        try {
          const C = await this.getRequestHeaders();
          v.headers = e.Gaxios.mergeHeaders(v.headers), this.addUserProjectAndAuthHeaders(v.headers, C), T = await this.transporter.request(v);
        } catch (C) {
          const w = C.response;
          if (w) {
            const D = w.status, _ = w.config.data instanceof n.Readable;
            if (!E && (D === 401 || D === 403) && !_ && this.forceRefreshOnFailure)
              return await this.refreshAccessTokenAsync(), await this.requestAsync(v, !0);
          }
          throw C;
        }
        return T;
      }
      /**
       * Forces token refresh, even if unexpired tokens are currently cached.
       * External credentials are exchanged for GCP access tokens via the token
       * exchange endpoint and other settings provided in the client options
       * object.
       * If the service_account_impersonation_url is provided, an additional
       * step to exchange the external account GCP access token for a service
       * account impersonated token is performed.
       * @return A promise that resolves with the fresh GCP access tokens.
       */
      async refreshAccessTokenAsync() {
        this.#e = this.#e || this.#t();
        try {
          return await this.#e;
        } finally {
          this.#e = null;
        }
      }
      async #t() {
        const v = await this.retrieveSubjectToken(), E = {
          grantType: l,
          audience: this.audience,
          requestedTokenType: f,
          subjectToken: v,
          subjectTokenType: this.subjectTokenType,
          // generateAccessToken requires the provided access token to have
          // scopes:
          // https://www.googleapis.com/auth/iam or
          // https://www.googleapis.com/auth/cloud-platform
          // The new service account access token scopes will match the user
          // provided ones.
          scope: this.serviceAccountImpersonationUrl ? [c] : this.getScopesArray()
        }, T = !this.clientAuth && this.workforcePoolUserProject ? { userProject: this.workforcePoolUserProject } : void 0, C = new Headers({
          "x-goog-api-client": this.getMetricsHeaderValue()
        }), w = await this.stsCredential.exchangeToken(E, C, T);
        return this.serviceAccountImpersonationUrl ? this.cachedAccessToken = await this.getImpersonatedAccessToken(w.access_token) : w.expires_in ? this.cachedAccessToken = {
          access_token: w.access_token,
          expiry_date: (/* @__PURE__ */ new Date()).getTime() + w.expires_in * 1e3,
          res: w.res
        } : this.cachedAccessToken = {
          access_token: w.access_token,
          res: w.res
        }, this.credentials = {}, Object.assign(this.credentials, this.cachedAccessToken), delete this.credentials.res, this.emit("tokens", {
          refresh_token: null,
          expiry_date: this.cachedAccessToken.expiry_date,
          access_token: this.cachedAccessToken.access_token,
          token_type: "Bearer",
          id_token: null
        }), this.cachedAccessToken;
      }
      /**
       * Returns the workload identity pool project number if it is determinable
       * from the audience resource name.
       * @param audience The STS audience used to determine the project number.
       * @return The project number associated with the workload identity pool, if
       *   this can be determined from the STS audience field. Otherwise, null is
       *   returned.
       */
      getProjectNumber(v) {
        const E = v.match(/\/projects\/([^/]+)/);
        return E ? E[1] : null;
      }
      /**
       * Exchanges an external account GCP access token for a service
       * account impersonated access token using iamcredentials
       * GenerateAccessToken API.
       * @param token The access token to exchange for a service account access
       *   token.
       * @return A promise that resolves with the service account impersonated
       *   credentials response.
       */
      async getImpersonatedAccessToken(v) {
        const E = {
          ...m.RETRY_CONFIG,
          url: this.serviceAccountImpersonationUrl,
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${v}`
          },
          data: {
            scope: this.getScopesArray(),
            lifetime: this.serviceAccountImpersonationLifetime + "s"
          },
          responseType: "json"
        };
        i.AuthClient.setMethodName(E, "getImpersonatedAccessToken");
        const T = await this.transporter.request(E), C = T.data;
        return {
          access_token: C.accessToken,
          // Convert from ISO format to timestamp.
          expiry_date: new Date(C.expireTime).getTime(),
          res: T
        };
      }
      /**
       * Returns whether the provided credentials are expired or not.
       * If there is no expiry time, assumes the token is not expired or expiring.
       * @param accessToken The credentials to check for expiration.
       * @return Whether the credentials are expired or not.
       */
      isExpired(v) {
        const E = (/* @__PURE__ */ new Date()).getTime();
        return v.expiry_date ? E >= v.expiry_date - this.eagerRefreshThresholdMillis : !1;
      }
      /**
       * @return The list of scopes for the requested GCP access token.
       */
      getScopesArray() {
        return typeof this.scopes == "string" ? [this.scopes] : this.scopes || [c];
      }
      getMetricsHeaderValue() {
        const v = process.version.replace(/^v/, ""), E = this.serviceAccountImpersonationUrl !== void 0, T = this.credentialSourceType ? this.credentialSourceType : "unknown";
        return `gl-node/${v} auth/${a.pkg.version} google-byoid-sdk source/${T} sa-impersonation/${E} config-lifetime/${this.configLifetimeRequested}`;
      }
      getTokenUrl() {
        return this.tokenUrl;
      }
    }
    t.BaseExternalAccountClient = m;
  })(li)), li;
}
var Jt = {}, $t = {}, lo;
function Cu() {
  if (lo) return $t;
  lo = 1, Object.defineProperty($t, "__esModule", { value: !0 }), $t.FileSubjectTokenSupplier = void 0;
  const t = at, e = st, n = (0, t.promisify)(e.readFile ?? (() => {
  })), i = (0, t.promisify)(e.realpath ?? (() => {
  })), r = (0, t.promisify)(e.lstat ?? (() => {
  }));
  class o {
    filePath;
    formatType;
    subjectTokenFieldName;
    /**
     * Instantiates a new file based subject token supplier.
     * @param opts The file subject token supplier options to build the supplier
     *   with.
     */
    constructor(l) {
      this.filePath = l.filePath, this.formatType = l.formatType, this.subjectTokenFieldName = l.subjectTokenFieldName;
    }
    /**
     * Returns the subject token stored at the file specified in the constructor.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link IdentityPoolClient}, contains the requested audience and subject
     *   token type for the external account identity. Not used.
     */
    async getSubjectToken() {
      let l = this.filePath;
      try {
        if (l = await i(l), !(await r(l)).isFile())
          throw new Error();
      } catch (d) {
        throw d instanceof Error && (d.message = `The file at ${l} does not exist, or it is not a file. ${d.message}`), d;
      }
      let f;
      const c = await n(l, { encoding: "utf8" });
      if (this.formatType === "text" ? f = c : this.formatType === "json" && this.subjectTokenFieldName && (f = JSON.parse(c)[this.subjectTokenFieldName]), !f)
        throw new Error("Unable to parse the subject_token from the credential_source file");
      return f;
    }
  }
  return $t.FileSubjectTokenSupplier = o, $t;
}
var Wt = {}, co;
function Au() {
  if (co) return Wt;
  co = 1, Object.defineProperty(Wt, "__esModule", { value: !0 }), Wt.UrlSubjectTokenSupplier = void 0;
  const t = Pe();
  class e {
    url;
    headers;
    formatType;
    subjectTokenFieldName;
    additionalGaxiosOptions;
    /**
     * Instantiates a URL subject token supplier.
     * @param opts The URL subject token supplier options to build the supplier with.
     */
    constructor(i) {
      this.url = i.url, this.formatType = i.formatType, this.subjectTokenFieldName = i.subjectTokenFieldName, this.headers = i.headers, this.additionalGaxiosOptions = i.additionalGaxiosOptions;
    }
    /**
     * Sends a GET request to the URL provided in the constructor and resolves
     * with the returned external subject token.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link IdentityPoolClient}, contains the requested audience and subject
     *   token type for the external account identity. Not used.
     */
    async getSubjectToken(i) {
      const r = {
        ...this.additionalGaxiosOptions,
        url: this.url,
        method: "GET",
        headers: this.headers,
        responseType: this.formatType
      };
      t.AuthClient.setMethodName(r, "getSubjectToken");
      let o;
      if (this.formatType === "text" ? o = (await i.transporter.request(r)).data : this.formatType === "json" && this.subjectTokenFieldName && (o = (await i.transporter.request(r)).data[this.subjectTokenFieldName]), !o)
        throw new Error("Unable to parse the subject_token from the credential_source URL");
      return o;
    }
  }
  return Wt.UrlSubjectTokenSupplier = e, Wt;
}
var ci = {}, uo;
function wu() {
  return uo || (uo = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.CertificateSubjectTokenSupplier = t.InvalidConfigurationError = t.CertificateSourceUnavailableError = t.CERTIFICATE_CONFIGURATION_ENV_VARIABLE = void 0;
    const e = Oe(), n = st, i = mt, r = qi;
    t.CERTIFICATE_CONFIGURATION_ENV_VARIABLE = "GOOGLE_API_CERTIFICATE_CONFIG";
    class o extends Error {
      constructor(c) {
        super(c), this.name = "CertificateSourceUnavailableError";
      }
    }
    t.CertificateSourceUnavailableError = o;
    class a extends Error {
      constructor(c) {
        super(c), this.name = "InvalidConfigurationError";
      }
    }
    t.InvalidConfigurationError = a;
    class l {
      certificateConfigPath;
      trustChainPath;
      cert;
      key;
      /**
       * Initializes a new instance of the CertificateSubjectTokenSupplier.
       * @param opts The configuration options for the supplier.
       */
      constructor(c) {
        if (!c.useDefaultCertificateConfig && !c.certificateConfigLocation)
          throw new a("Either `useDefaultCertificateConfig` must be true or a `certificateConfigLocation` must be provided.");
        if (c.useDefaultCertificateConfig && c.certificateConfigLocation)
          throw new a("Both `useDefaultCertificateConfig` and `certificateConfigLocation` cannot be provided.");
        this.trustChainPath = c.trustChainPath, this.certificateConfigPath = c.certificateConfigLocation ?? "";
      }
      /**
       * Creates an HTTPS agent configured with the client certificate and private key for mTLS.
       * @returns An mTLS-configured https.Agent.
       */
      async createMtlsHttpsAgent() {
        if (!this.key || !this.cert)
          throw new a("Cannot create mTLS Agent with missing certificate or key");
        return new r.Agent({ key: this.key, cert: this.cert });
      }
      /**
       * Constructs the subject token, which is the base64-encoded certificate chain.
       * @returns A promise that resolves with the subject token.
       */
      async getSubjectToken() {
        this.certificateConfigPath = await this.#e();
        const { certPath: c, keyPath: d } = await this.#t();
        return { cert: this.cert, key: this.key } = await this.#n(c, d), await this.#i(this.cert);
      }
      /**
       * Resolves the absolute path to the certificate configuration file
       * by checking the "certificate_config_location" provided in the ADC file,
       * or the "GOOGLE_API_CERTIFICATE_CONFIG" environment variable
       * or in the default gcloud path.
       * @param overridePath An optional path to check first.
       * @returns The resolved file path.
       */
      async #e() {
        const c = this.certificateConfigPath;
        if (c) {
          if (await (0, e.isValidFile)(c))
            return c;
          throw new o(`Provided certificate config path is invalid: ${c}`);
        }
        const d = process.env[t.CERTIFICATE_CONFIGURATION_ENV_VARIABLE];
        if (d) {
          if (await (0, e.isValidFile)(d))
            return d;
          throw new o(`Path from environment variable "${t.CERTIFICATE_CONFIGURATION_ENV_VARIABLE}" is invalid: ${d}`);
        }
        const p = (0, e.getWellKnownCertificateConfigFileLocation)();
        if (await (0, e.isValidFile)(p))
          return p;
        throw new o(`Could not find certificate configuration file. Searched override path, the "${t.CERTIFICATE_CONFIGURATION_ENV_VARIABLE}" env var, and the gcloud path (${p}).`);
      }
      /**
       * Reads and parses the certificate config JSON file to extract the certificate and key paths.
       * @returns An object containing the certificate and key paths.
       */
      async #t() {
        const c = this.certificateConfigPath;
        let d;
        try {
          d = await n.promises.readFile(c, "utf8");
        } catch {
          throw new o(`Failed to read certificate config file at: ${c}`);
        }
        try {
          const p = JSON.parse(d), h = p?.cert_configs?.workload?.cert_path, m = p?.cert_configs?.workload?.key_path;
          if (!h || !m)
            throw new a(`Certificate config file (${c}) is missing required "cert_path" or "key_path" in the workload config.`);
          return { certPath: h, keyPath: m };
        } catch (p) {
          throw p instanceof a ? p : new a(`Failed to parse certificate config from ${c}: ${p.message}`);
        }
      }
      /**
       * Reads and parses the cert and key files get their content and check valid format.
       * @returns An object containing the cert content and key content in buffer format.
       */
      async #n(c, d) {
        let p, h;
        try {
          p = await n.promises.readFile(c), new i.X509Certificate(p);
        } catch (m) {
          const g = m instanceof Error ? m.message : String(m);
          throw new o(`Failed to read certificate file at ${c}: ${g}`);
        }
        try {
          h = await n.promises.readFile(d), (0, i.createPrivateKey)(h);
        } catch (m) {
          const g = m instanceof Error ? m.message : String(m);
          throw new o(`Failed to read private key file at ${d}: ${g}`);
        }
        return { cert: p, key: h };
      }
      /**
       * Reads the leaf certificate and trust chain, combines them,
       * and returns a JSON array of base64-encoded certificates.
       * @returns A stringified JSON array of the certificate chain.
       */
      async #i(c) {
        const d = new i.X509Certificate(c);
        if (!this.trustChainPath)
          return JSON.stringify([d.raw.toString("base64")]);
        try {
          const m = ((await n.promises.readFile(this.trustChainPath, "utf8")).match(/-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/g) ?? []).map((E, T) => {
            try {
              return new i.X509Certificate(E);
            } catch (C) {
              const w = C instanceof Error ? C.message : String(C);
              throw new a(`Failed to parse certificate at index ${T} in trust chain file ${this.trustChainPath}: ${w}`);
            }
          }), g = m.findIndex((E) => d.raw.equals(E.raw));
          let v;
          if (g === -1)
            v = [d, ...m];
          else if (g === 0)
            v = m;
          else
            throw new a(`Leaf certificate exists in the trust chain but is not the first entry (found at index ${g}).`);
          return JSON.stringify(v.map((E) => E.raw.toString("base64")));
        } catch (p) {
          if (p instanceof a)
            throw p;
          const h = p instanceof Error ? p.message : String(p);
          throw new o(`Failed to process certificate chain from ${this.trustChainPath}: ${h}`);
        }
      }
    }
    t.CertificateSubjectTokenSupplier = l;
  })(ci)), ci;
}
var fo;
function za() {
  if (fo) return Jt;
  fo = 1, Object.defineProperty(Jt, "__esModule", { value: !0 }), Jt.IdentityPoolClient = void 0;
  const t = lt(), e = Oe(), n = Cu(), i = Au(), r = wu(), o = Vi(), a = ve();
  class l extends t.BaseExternalAccountClient {
    subjectTokenSupplier;
    /**
     * Instantiate an IdentityPoolClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * An error is thrown if the credential is not a valid file-sourced or
     * url-sourced credential or a workforce pool user project is provided
     * with a non workforce audience.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file. The camelCased options
     *   are aliases for the snake_cased options.
     */
    constructor(c) {
      super(c);
      const d = (0, e.originalOrCamelOptions)(c), p = d.get("credential_source"), h = d.get("subject_token_supplier");
      if (!p && !h)
        throw new Error("A credential source or subject token supplier must be specified.");
      if (p && h)
        throw new Error("Only one of credential source or subject token supplier can be specified.");
      if (h)
        this.subjectTokenSupplier = h, this.credentialSourceType = "programmatic";
      else {
        const m = (0, e.originalOrCamelOptions)(p), g = (0, e.originalOrCamelOptions)(m.get("format")), v = g.get("type") || "text", E = g.get("subject_token_field_name");
        if (v !== "json" && v !== "text")
          throw new Error(`Invalid credential_source format "${v}"`);
        if (v === "json" && !E)
          throw new Error("Missing subject_token_field_name for JSON credential_source format");
        const T = m.get("file"), C = m.get("url"), w = m.get("certificate"), D = m.get("headers");
        if (T && C || C && w || T && w)
          throw new Error('No valid Identity Pool "credential_source" provided, must be either file, url, or certificate.');
        if (T)
          this.credentialSourceType = "file", this.subjectTokenSupplier = new n.FileSubjectTokenSupplier({
            filePath: T,
            formatType: v,
            subjectTokenFieldName: E
          });
        else if (C)
          this.credentialSourceType = "url", this.subjectTokenSupplier = new i.UrlSubjectTokenSupplier({
            url: C,
            formatType: v,
            subjectTokenFieldName: E,
            headers: D,
            additionalGaxiosOptions: l.RETRY_CONFIG
          });
        else if (w) {
          this.credentialSourceType = "certificate";
          const _ = new r.CertificateSubjectTokenSupplier({
            useDefaultCertificateConfig: w.use_default_certificate_config,
            certificateConfigLocation: w.certificate_config_location,
            trustChainPath: w.trust_chain_path
          });
          this.subjectTokenSupplier = _;
        } else
          throw new Error('No valid Identity Pool "credential_source" provided, must be either file, url, or certificate.');
      }
    }
    /**
     * Triggered when a external subject token is needed to be exchanged for a GCP
     * access token via GCP STS endpoint. Gets a subject token by calling
     * the configured {@link SubjectTokenSupplier}
     * @return A promise that resolves with the external subject token.
     */
    async retrieveSubjectToken() {
      const c = await this.subjectTokenSupplier.getSubjectToken(this.supplierContext);
      if (this.subjectTokenSupplier instanceof r.CertificateSubjectTokenSupplier) {
        const d = await this.subjectTokenSupplier.createMtlsHttpsAgent();
        this.stsCredential = new o.StsCredentials({
          tokenExchangeEndpoint: this.getTokenUrl(),
          clientAuthentication: this.clientAuth,
          transporter: new a.Gaxios({ agent: d })
        }), this.transporter = new a.Gaxios({
          ...this.transporter.defaults || {},
          agent: d
        });
      }
      return c;
    }
  }
  return Jt.IdentityPoolClient = l, Jt;
}
var Kt = {}, Yt = {}, ho;
function Xa() {
  if (ho) return Yt;
  ho = 1, Object.defineProperty(Yt, "__esModule", { value: !0 }), Yt.AwsRequestSigner = void 0;
  const t = ve(), e = xn(), n = "AWS4-HMAC-SHA256", i = "aws4_request";
  class r {
    getCredentials;
    region;
    crypto;
    /**
     * Instantiates an AWS API request signer used to send authenticated signed
     * requests to AWS APIs based on the AWS Signature Version 4 signing process.
     * This also provides a mechanism to generate the signed request without
     * sending it.
     * @param getCredentials A mechanism to retrieve AWS security credentials
     *   when needed.
     * @param region The AWS region to use.
     */
    constructor(c, d) {
      this.getCredentials = c, this.region = d, this.crypto = (0, e.createCrypto)();
    }
    /**
     * Generates the signed request for the provided HTTP request for calling
     * an AWS API. This follows the steps described at:
     * https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
     * @param amzOptions The AWS request options that need to be signed.
     * @return A promise that resolves with the GaxiosOptions containing the
     *   signed HTTP request parameters.
     */
    async getRequestOptions(c) {
      if (!c.url)
        throw new RangeError('"url" is required in "amzOptions"');
      const d = typeof c.data == "object" ? JSON.stringify(c.data) : c.data, p = c.url, h = c.method || "GET", m = c.body || d, g = c.headers, v = await this.getCredentials(), E = new URL(p);
      if (typeof m != "string" && m !== void 0)
        throw new TypeError(`'requestPayload' is expected to be a string if provided. Got: ${m}`);
      const T = await l({
        crypto: this.crypto,
        host: E.host,
        canonicalUri: E.pathname,
        canonicalQuerystring: E.search.slice(1),
        method: h,
        region: this.region,
        securityCredentials: v,
        requestPayload: m,
        additionalAmzHeaders: g
      }), C = t.Gaxios.mergeHeaders(
        // Add x-amz-date if available.
        T.amzDate ? { "x-amz-date": T.amzDate } : {},
        {
          authorization: T.authorizationHeader,
          host: E.host
        },
        g || {}
      );
      v.token && t.Gaxios.mergeHeaders(C, {
        "x-amz-security-token": v.token
      });
      const w = {
        url: p,
        method: h,
        headers: C
      };
      return m !== void 0 && (w.body = m), w;
    }
  }
  Yt.AwsRequestSigner = r;
  async function o(f, c, d) {
    return await f.signWithHmacSha256(c, d);
  }
  async function a(f, c, d, p, h) {
    const m = await o(f, `AWS4${c}`, d), g = await o(f, m, p), v = await o(f, g, h);
    return await o(f, v, "aws4_request");
  }
  async function l(f) {
    const c = t.Gaxios.mergeHeaders(f.additionalAmzHeaders), d = f.requestPayload || "", p = f.host.split(".")[0], h = /* @__PURE__ */ new Date(), m = h.toISOString().replace(/[-:]/g, "").replace(/\.[0-9]+/, ""), g = h.toISOString().replace(/[-]/g, "").replace(/T.*/, "");
    f.securityCredentials.token && c.set("x-amz-security-token", f.securityCredentials.token);
    const v = t.Gaxios.mergeHeaders(
      {
        host: f.host
      },
      // Previously the date was not fixed with x-amz- and could be provided manually.
      // https://github.com/boto/botocore/blob/879f8440a4e9ace5d3cf145ce8b3d5e5ffb892ef/tests/unit/auth/aws4_testsuite/get-header-value-trim.req
      c.has("date") ? {} : { "x-amz-date": m },
      c
    );
    let E = "";
    const T = [
      ...v.keys()
    ].sort();
    T.forEach((N) => {
      E += `${N}:${v.get(N)}
`;
    });
    const C = T.join(";"), w = await f.crypto.sha256DigestHex(d), D = `${f.method.toUpperCase()}
${f.canonicalUri}
${f.canonicalQuerystring}
${E}
${C}
${w}`, _ = `${g}/${f.region}/${p}/${i}`, y = `${n}
${m}
${_}
` + await f.crypto.sha256DigestHex(D), S = await a(f.crypto, f.securityCredentials.secretAccessKey, g, f.region, p), R = await o(f.crypto, S, y), P = `${n} Credential=${f.securityCredentials.accessKeyId}/${_}, SignedHeaders=${C}, Signature=${(0, e.fromArrayBufferToHex)(R)}`;
    return {
      // Do not return x-amz-date if date is available.
      amzDate: c.has("date") ? void 0 : m,
      authorizationHeader: P,
      canonicalQuerystring: f.canonicalQuerystring
    };
  }
  return Yt;
}
var zt = {}, po;
function Iu() {
  if (po) return zt;
  po = 1, Object.defineProperty(zt, "__esModule", { value: !0 }), zt.DefaultAwsSecurityCredentialsSupplier = void 0;
  const t = Pe();
  class e {
    regionUrl;
    securityCredentialsUrl;
    imdsV2SessionTokenUrl;
    additionalGaxiosOptions;
    /**
     * Instantiates a new DefaultAwsSecurityCredentialsSupplier using information
     * from the credential_source stored in the ADC file.
     * @param opts The default aws security credentials supplier options object to
     *   build the supplier with.
     */
    constructor(i) {
      this.regionUrl = i.regionUrl, this.securityCredentialsUrl = i.securityCredentialsUrl, this.imdsV2SessionTokenUrl = i.imdsV2SessionTokenUrl, this.additionalGaxiosOptions = i.additionalGaxiosOptions;
    }
    /**
     * Returns the active AWS region. This first checks to see if the region
     * is available as an environment variable. If it is not, then the supplier
     * will call the region URL.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link AwsClient}, contains the requested audience and subject token type
     *   for the external account identity.
     * @return A promise that resolves with the AWS region string.
     */
    async getAwsRegion(i) {
      if (this.#i)
        return this.#i;
      const r = new Headers();
      if (!this.#i && this.imdsV2SessionTokenUrl && r.set("x-aws-ec2-metadata-token", await this.#e(i.transporter)), !this.regionUrl)
        throw new RangeError('Unable to determine AWS region due to missing "options.credential_source.region_url"');
      const o = {
        ...this.additionalGaxiosOptions,
        url: this.regionUrl,
        method: "GET",
        responseType: "text",
        headers: r
      };
      t.AuthClient.setMethodName(o, "getAwsRegion");
      const a = await i.transporter.request(o);
      return a.data.substr(0, a.data.length - 1);
    }
    /**
     * Returns AWS security credentials. This first checks to see if the credentials
     * is available as environment variables. If it is not, then the supplier
     * will call the security credentials URL.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link AwsClient}, contains the requested audience and subject token type
     *   for the external account identity.
     * @return A promise that resolves with the AWS security credentials.
     */
    async getAwsSecurityCredentials(i) {
      if (this.#r)
        return this.#r;
      const r = new Headers();
      this.imdsV2SessionTokenUrl && r.set("x-aws-ec2-metadata-token", await this.#e(i.transporter));
      const o = await this.#t(r, i.transporter), a = await this.#n(o, r, i.transporter);
      return {
        accessKeyId: a.AccessKeyId,
        secretAccessKey: a.SecretAccessKey,
        token: a.Token
      };
    }
    /**
     * @param transporter The transporter to use for requests.
     * @return A promise that resolves with the IMDSv2 Session Token.
     */
    async #e(i) {
      const r = {
        ...this.additionalGaxiosOptions,
        url: this.imdsV2SessionTokenUrl,
        method: "PUT",
        responseType: "text",
        headers: { "x-aws-ec2-metadata-token-ttl-seconds": "300" }
      };
      return t.AuthClient.setMethodName(r, "#getImdsV2SessionToken"), (await i.request(r)).data;
    }
    /**
     * @param headers The headers to be used in the metadata request.
     * @param transporter The transporter to use for requests.
     * @return A promise that resolves with the assigned role to the current
     *   AWS VM. This is needed for calling the security-credentials endpoint.
     */
    async #t(i, r) {
      if (!this.securityCredentialsUrl)
        throw new Error('Unable to determine AWS role name due to missing "options.credential_source.url"');
      const o = {
        ...this.additionalGaxiosOptions,
        url: this.securityCredentialsUrl,
        method: "GET",
        responseType: "text",
        headers: i
      };
      return t.AuthClient.setMethodName(o, "#getAwsRoleName"), (await r.request(o)).data;
    }
    /**
     * Retrieves the temporary AWS credentials by calling the security-credentials
     * endpoint as specified in the `credential_source` object.
     * @param roleName The role attached to the current VM.
     * @param headers The headers to be used in the metadata request.
     * @param transporter The transporter to use for requests.
     * @return A promise that resolves with the temporary AWS credentials
     *   needed for creating the GetCallerIdentity signed request.
     */
    async #n(i, r, o) {
      const a = {
        ...this.additionalGaxiosOptions,
        url: `${this.securityCredentialsUrl}/${i}`,
        headers: r,
        responseType: "json"
      };
      return t.AuthClient.setMethodName(a, "#retrieveAwsSecurityCredentials"), (await o.request(a)).data;
    }
    get #i() {
      return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null;
    }
    get #r() {
      return process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        token: process.env.AWS_SESSION_TOKEN
      } : null;
    }
  }
  return zt.DefaultAwsSecurityCredentialsSupplier = e, zt;
}
var mo;
function Qa() {
  if (mo) return Kt;
  mo = 1, Object.defineProperty(Kt, "__esModule", { value: !0 }), Kt.AwsClient = void 0;
  const t = Xa(), e = lt(), n = Iu(), i = Oe(), r = ve();
  class o extends e.BaseExternalAccountClient {
    environmentId;
    awsSecurityCredentialsSupplier;
    regionalCredVerificationUrl;
    awsRequestSigner;
    region;
    static #e = "https://sts.{region}.amazonaws.com?Action=GetCallerIdentity&Version=2011-06-15";
    /**
     * @deprecated AWS client no validates the EC2 metadata address.
     **/
    static AWS_EC2_METADATA_IPV4_ADDRESS = "169.254.169.254";
    /**
     * @deprecated AWS client no validates the EC2 metadata address.
     **/
    static AWS_EC2_METADATA_IPV6_ADDRESS = "fd00:ec2::254";
    /**
     * Instantiates an AwsClient instance using the provided JSON
     * object loaded from an external account credentials file.
     * An error is thrown if the credential is not a valid AWS credential.
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file.
     */
    constructor(l) {
      super(l);
      const f = (0, i.originalOrCamelOptions)(l), c = f.get("credential_source"), d = f.get("aws_security_credentials_supplier");
      if (!c && !d)
        throw new Error("A credential source or AWS security credentials supplier must be specified.");
      if (c && d)
        throw new Error("Only one of credential source or AWS security credentials supplier can be specified.");
      if (d)
        this.awsSecurityCredentialsSupplier = d, this.regionalCredVerificationUrl = o.#e, this.credentialSourceType = "programmatic";
      else {
        const p = (0, i.originalOrCamelOptions)(c);
        this.environmentId = p.get("environment_id");
        const h = p.get("region_url"), m = p.get("url"), g = p.get("imdsv2_session_token_url");
        this.awsSecurityCredentialsSupplier = new n.DefaultAwsSecurityCredentialsSupplier({
          regionUrl: h,
          securityCredentialsUrl: m,
          imdsV2SessionTokenUrl: g
        }), this.regionalCredVerificationUrl = p.get("regional_cred_verification_url"), this.credentialSourceType = "aws", this.validateEnvironmentId();
      }
      this.awsRequestSigner = null, this.region = "";
    }
    validateEnvironmentId() {
      const l = this.environmentId?.match(/^(aws)(\d+)$/);
      if (!l || !this.regionalCredVerificationUrl)
        throw new Error('No valid AWS "credential_source" provided');
      if (parseInt(l[2], 10) !== 1)
        throw new Error(`aws version "${l[2]}" is not supported in the current build.`);
    }
    /**
     * Triggered when an external subject token is needed to be exchanged for a
     * GCP access token via GCP STS endpoint. This will call the
     * {@link AwsSecurityCredentialsSupplier} to retrieve an AWS region and AWS
     * Security Credentials, then use them to create a signed AWS STS request that
     * can be exchanged for a GCP access token.
     * @return A promise that resolves with the external subject token.
     */
    async retrieveSubjectToken() {
      this.awsRequestSigner || (this.region = await this.awsSecurityCredentialsSupplier.getAwsRegion(this.supplierContext), this.awsRequestSigner = new t.AwsRequestSigner(async () => this.awsSecurityCredentialsSupplier.getAwsSecurityCredentials(this.supplierContext), this.region));
      const l = await this.awsRequestSigner.getRequestOptions({
        ...o.RETRY_CONFIG,
        url: this.regionalCredVerificationUrl.replace("{region}", this.region),
        method: "POST"
      }), f = [];
      return r.Gaxios.mergeHeaders({
        // The full, canonical resource name of the workload identity pool
        // provider, with or without the HTTPS prefix.
        // Including this header as part of the signature is recommended to
        // ensure data integrity.
        "x-goog-cloud-target-resource": this.audience
      }, l.headers).forEach((d, p) => f.push({ key: p, value: d })), encodeURIComponent(JSON.stringify({
        url: l.url,
        method: l.method,
        headers: f
      }));
    }
  }
  return Kt.AwsClient = o, Kt;
}
var ui = {}, he = {}, go;
function Za() {
  if (go) return he;
  go = 1, Object.defineProperty(he, "__esModule", { value: !0 }), he.InvalidSubjectTokenError = he.InvalidMessageFieldError = he.InvalidCodeFieldError = he.InvalidTokenTypeFieldError = he.InvalidExpirationTimeFieldError = he.InvalidSuccessFieldError = he.InvalidVersionFieldError = he.ExecutableResponseError = he.ExecutableResponse = void 0;
  const t = "urn:ietf:params:oauth:token-type:saml2", e = "urn:ietf:params:oauth:token-type:id_token", n = "urn:ietf:params:oauth:token-type:jwt";
  class i {
    /**
     * The version of the Executable response. Only version 1 is currently supported.
     */
    version;
    /**
     * Whether the executable ran successfully.
     */
    success;
    /**
     * The epoch time for expiration of the token in seconds.
     */
    expirationTime;
    /**
     * The type of subject token in the response, currently supported values are:
     * urn:ietf:params:oauth:token-type:saml2
     * urn:ietf:params:oauth:token-type:id_token
     * urn:ietf:params:oauth:token-type:jwt
     */
    tokenType;
    /**
     * The error code from the executable.
     */
    errorCode;
    /**
     * The error message from the executable.
     */
    errorMessage;
    /**
     * The subject token from the executable, format depends on tokenType.
     */
    subjectToken;
    /**
     * Instantiates an ExecutableResponse instance using the provided JSON object
     * from the output of the executable.
     * @param responseJson Response from a 3rd party executable, loaded from a
     * run of the executable or a cached output file.
     */
    constructor(m) {
      if (!m.version)
        throw new o("Executable response must contain a 'version' field.");
      if (m.success === void 0)
        throw new a("Executable response must contain a 'success' field.");
      if (this.version = m.version, this.success = m.success, this.success) {
        if (this.expirationTime = m.expiration_time, this.tokenType = m.token_type, this.tokenType !== t && this.tokenType !== e && this.tokenType !== n)
          throw new f(`Executable response must contain a 'token_type' field when successful and it must be one of ${e}, ${n}, or ${t}.`);
        if (this.tokenType === t) {
          if (!m.saml_response)
            throw new p(`Executable response must contain a 'saml_response' field when token_type=${t}.`);
          this.subjectToken = m.saml_response;
        } else {
          if (!m.id_token)
            throw new p(`Executable response must contain a 'id_token' field when token_type=${e} or ${n}.`);
          this.subjectToken = m.id_token;
        }
      } else {
        if (!m.code)
          throw new c("Executable response must contain a 'code' field when unsuccessful.");
        if (!m.message)
          throw new d("Executable response must contain a 'message' field when unsuccessful.");
        this.errorCode = m.code, this.errorMessage = m.message;
      }
    }
    /**
     * @return A boolean representing if the response has a valid token. Returns
     * true when the response was successful and the token is not expired.
     */
    isValid() {
      return !this.isExpired() && this.success;
    }
    /**
     * @return A boolean representing if the response is expired. Returns true if the
     * provided timeout has passed.
     */
    isExpired() {
      return this.expirationTime !== void 0 && this.expirationTime < Math.round(Date.now() / 1e3);
    }
  }
  he.ExecutableResponse = i;
  class r extends Error {
    constructor(m) {
      super(m), Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  he.ExecutableResponseError = r;
  class o extends r {
  }
  he.InvalidVersionFieldError = o;
  class a extends r {
  }
  he.InvalidSuccessFieldError = a;
  class l extends r {
  }
  he.InvalidExpirationTimeFieldError = l;
  class f extends r {
  }
  he.InvalidTokenTypeFieldError = f;
  class c extends r {
  }
  he.InvalidCodeFieldError = c;
  class d extends r {
  }
  he.InvalidMessageFieldError = d;
  class p extends r {
  }
  return he.InvalidSubjectTokenError = p, he;
}
var nt = {}, yo;
function _o() {
  if (yo) return nt;
  yo = 1, Object.defineProperty(nt, "__esModule", { value: !0 }), nt.PluggableAuthHandler = nt.ExecutableError = void 0;
  const t = Za(), e = Ca, n = st;
  class i extends Error {
    /**
     * The exit code returned by the executable.
     */
    code;
    constructor(a, l) {
      super(`The executable failed with exit code: ${l} and error message: ${a}.`), this.code = l, Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  nt.ExecutableError = i;
  class r {
    commandComponents;
    timeoutMillis;
    outputFile;
    /**
     * Instantiates a PluggableAuthHandler instance using the provided
     * PluggableAuthHandlerOptions object.
     */
    constructor(a) {
      if (!a.command)
        throw new Error("No command provided.");
      if (this.commandComponents = r.parseCommand(a.command), this.timeoutMillis = a.timeoutMillis, !this.timeoutMillis)
        throw new Error("No timeoutMillis provided.");
      this.outputFile = a.outputFile;
    }
    /**
     * Calls user provided executable to get a 3rd party subject token and
     * returns the response.
     * @param envMap a Map of additional Environment Variables required for
     *   the executable.
     * @return A promise that resolves with the executable response.
     */
    retrieveResponseFromExecutable(a) {
      return new Promise((l, f) => {
        const c = e.spawn(this.commandComponents[0], this.commandComponents.slice(1), {
          env: { ...process.env, ...Object.fromEntries(a) }
        });
        let d = "";
        c.stdout.on("data", (h) => {
          d += h;
        }), c.stderr.on("data", (h) => {
          d += h;
        });
        const p = setTimeout(() => (c.removeAllListeners(), c.kill(), f(new Error("The executable failed to finish within the timeout specified."))), this.timeoutMillis);
        c.on("close", (h) => {
          if (clearTimeout(p), h === 0)
            try {
              const m = JSON.parse(d), g = new t.ExecutableResponse(m);
              return l(g);
            } catch (m) {
              return m instanceof t.ExecutableResponseError ? f(m) : f(new t.ExecutableResponseError(`The executable returned an invalid response: ${d}`));
            }
          else
            return f(new i(d, h.toString()));
        });
      });
    }
    /**
     * Checks user provided output file for response from previous run of
     * executable and return the response if it exists, is formatted correctly, and is not expired.
     */
    async retrieveCachedResponse() {
      if (!this.outputFile || this.outputFile.length === 0)
        return;
      let a;
      try {
        a = await n.promises.realpath(this.outputFile);
      } catch {
        return;
      }
      if (!(await n.promises.lstat(a)).isFile())
        return;
      const l = await n.promises.readFile(a, {
        encoding: "utf8"
      });
      if (l !== "")
        try {
          const f = JSON.parse(l);
          return new t.ExecutableResponse(f).isValid() ? new t.ExecutableResponse(f) : void 0;
        } catch (f) {
          throw f instanceof t.ExecutableResponseError ? f : new t.ExecutableResponseError(`The output file contained an invalid response: ${l}`);
        }
    }
    /**
     * Parses given command string into component array, splitting on spaces unless
     * spaces are between quotation marks.
     */
    static parseCommand(a) {
      const l = a.match(/(?:[^\s"]+|"[^"]*")+/g);
      if (!l)
        throw new Error(`Provided command: "${a}" could not be parsed.`);
      for (let f = 0; f < l.length; f++)
        l[f][0] === '"' && l[f].slice(-1) === '"' && (l[f] = l[f].slice(1, -1));
      return l;
    }
  }
  return nt.PluggableAuthHandler = r, nt;
}
var vo;
function ja() {
  return vo || (vo = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.PluggableAuthClient = t.ExecutableError = void 0;
    const e = lt(), n = Za(), i = _o();
    var r = _o();
    Object.defineProperty(t, "ExecutableError", { enumerable: !0, get: function() {
      return r.ExecutableError;
    } });
    const o = 30 * 1e3, a = 5 * 1e3, l = 120 * 1e3, f = "GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES", c = 1;
    class d extends e.BaseExternalAccountClient {
      /**
       * The command used to retrieve the third party token.
       */
      command;
      /**
       * The timeout in milliseconds for running executable,
       * set to default if none provided.
       */
      timeoutMillis;
      /**
       * The path to file to check for cached executable response.
       */
      outputFile;
      /**
       * Executable and output file handler.
       */
      handler;
      /**
       * Instantiates a PluggableAuthClient instance using the provided JSON
       * object loaded from an external account credentials file.
       * An error is thrown if the credential is not a valid pluggable auth credential.
       * @param options The external account options object typically loaded from
       *   the external account JSON credential file.
       */
      constructor(h) {
        if (super(h), !h.credential_source.executable)
          throw new Error('No valid Pluggable Auth "credential_source" provided.');
        if (this.command = h.credential_source.executable.command, !this.command)
          throw new Error('No valid Pluggable Auth "credential_source" provided.');
        if (h.credential_source.executable.timeout_millis === void 0)
          this.timeoutMillis = o;
        else if (this.timeoutMillis = h.credential_source.executable.timeout_millis, this.timeoutMillis < a || this.timeoutMillis > l)
          throw new Error(`Timeout must be between ${a} and ${l} milliseconds.`);
        this.outputFile = h.credential_source.executable.output_file, this.handler = new i.PluggableAuthHandler({
          command: this.command,
          timeoutMillis: this.timeoutMillis,
          outputFile: this.outputFile
        }), this.credentialSourceType = "executable";
      }
      /**
       * Triggered when an external subject token is needed to be exchanged for a
       * GCP access token via GCP STS endpoint.
       * This uses the `options.credential_source` object to figure out how
       * to retrieve the token using the current environment. In this case,
       * this calls a user provided executable which returns the subject token.
       * The logic is summarized as:
       * 1. Validated that the executable is allowed to run. The
       *    GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment must be set to
       *    1 for security reasons.
       * 2. If an output file is specified by the user, check the file location
       *    for a response. If the file exists and contains a valid response,
       *    return the subject token from the file.
       * 3. Call the provided executable and return response.
       * @return A promise that resolves with the external subject token.
       */
      async retrieveSubjectToken() {
        if (process.env[f] !== "1")
          throw new Error("Pluggable Auth executables need to be explicitly allowed to run by setting the GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment Variable to 1.");
        let h;
        if (this.outputFile && (h = await this.handler.retrieveCachedResponse()), !h) {
          const m = /* @__PURE__ */ new Map();
          m.set("GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE", this.audience), m.set("GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE", this.subjectTokenType), m.set("GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE", "0"), this.outputFile && m.set("GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE", this.outputFile);
          const g = this.getServiceAccountEmail();
          g && m.set("GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL", g), h = await this.handler.retrieveResponseFromExecutable(m);
        }
        if (h.version > c)
          throw new Error(`Version of executable is not currently supported, maximum supported version is ${c}.`);
        if (!h.success)
          throw new i.ExecutableError(h.errorMessage, h.errorCode);
        if (this.outputFile && !h.expirationTime)
          throw new n.InvalidExpirationTimeFieldError("The executable response must contain the `expiration_time` field for successful responses when an output_file has been specified in the configuration.");
        if (h.isExpired())
          throw new Error("Executable response is expired.");
        return h.subjectToken;
      }
    }
    t.PluggableAuthClient = d;
  })(ui)), ui;
}
var Eo;
function el() {
  if (Eo) return Ht;
  Eo = 1, Object.defineProperty(Ht, "__esModule", { value: !0 }), Ht.ExternalAccountClient = void 0;
  const t = lt(), e = za(), n = Qa(), i = ja();
  class r {
    constructor() {
      throw new Error("ExternalAccountClients should be initialized via: ExternalAccountClient.fromJSON(), directly via explicit constructors, eg. new AwsClient(options), new IdentityPoolClient(options), newPluggableAuthClientOptions, or via new GoogleAuth(options).getClient()");
    }
    /**
     * This static method will instantiate the
     * corresponding type of external account credential depending on the
     * underlying credential source.
     *
     * **IMPORTANT**: This method does not validate the credential configuration.
     * A security risk occurs when a credential configuration configured with
     * malicious URLs is used. When the credential configuration is accepted from
     * an untrusted source, you should validate it before using it with this
     * method. For more details, see
     * https://cloud.google.com/docs/authentication/external/externally-sourced-credentials.
     *
     * @param options The external account options object typically loaded
     *   from the external account JSON credential file.
     * @return A BaseExternalAccountClient instance or null if the options
     *   provided do not correspond to an external account credential.
     */
    static fromJSON(a) {
      return a && a.type === t.EXTERNAL_ACCOUNT_TYPE ? a.credential_source?.environment_id ? new n.AwsClient(a) : a.credential_source?.executable ? new i.PluggableAuthClient(a) : new e.IdentityPoolClient(a) : null;
    }
  }
  return Ht.ExternalAccountClient = r, Ht;
}
var it = {}, To;
function tl() {
  if (To) return it;
  To = 1, Object.defineProperty(it, "__esModule", { value: !0 }), it.ExternalAccountAuthorizedUserClient = it.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = void 0;
  const t = Pe(), e = Ya(), n = ve(), i = we, r = lt();
  it.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = "external_account_authorized_user";
  const o = "https://sts.{universeDomain}/v1/oauthtoken";
  class a extends e.OAuthClientAuthHandler {
    #e;
    /**
     * Initializes an ExternalAccountAuthorizedUserHandler instance.
     * @param url The URL of the token refresh endpoint.
     * @param transporter The transporter to use for the refresh request.
     * @param clientAuthentication The client authentication credentials to use
     *   for the refresh request.
     */
    constructor(c) {
      super(c), this.#e = c.tokenRefreshEndpoint;
    }
    /**
     * Requests a new access token from the token_url endpoint using the provided
     *   refresh token.
     * @param refreshToken The refresh token to use to generate a new access token.
     * @param additionalHeaders Optional additional headers to pass along the
     *   request.
     * @return A promise that resolves with the token refresh response containing
     *   the requested access token and its expiration time.
     */
    async refreshToken(c, d) {
      const p = {
        ...a.RETRY_CONFIG,
        url: this.#e,
        method: "POST",
        headers: d,
        data: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: c
        }),
        responseType: "json"
      };
      t.AuthClient.setMethodName(p, "refreshToken"), this.applyClientAuthenticationOptions(p);
      try {
        const h = await this.transporter.request(p), m = h.data;
        return m.res = h, m;
      } catch (h) {
        throw h instanceof n.GaxiosError && h.response ? (0, e.getErrorFromOAuthErrorResponse)(
          h.response.data,
          // Preserve other fields from the original error.
          h
        ) : h;
      }
    }
  }
  class l extends t.AuthClient {
    cachedAccessToken;
    externalAccountAuthorizedUserHandler;
    refreshToken;
    /**
     * Instantiates an ExternalAccountAuthorizedUserClient instances using the
     * provided JSON object loaded from a credentials files.
     * An error is throws if the credential is not valid.
     * @param options The external account authorized user option object typically
     *   from the external accoutn authorized user JSON credential file.
     */
    constructor(c) {
      super(c), c.universe_domain && (this.universeDomain = c.universe_domain), this.refreshToken = c.refresh_token;
      const d = {
        confidentialClientType: "basic",
        clientId: c.client_id,
        clientSecret: c.client_secret
      };
      this.externalAccountAuthorizedUserHandler = new a({
        tokenRefreshEndpoint: c.token_url ?? o.replace("{universeDomain}", this.universeDomain),
        transporter: this.transporter,
        clientAuthentication: d
      }), this.cachedAccessToken = null, this.quotaProjectId = c.quota_project_id, typeof c?.eagerRefreshThresholdMillis != "number" ? this.eagerRefreshThresholdMillis = r.EXPIRATION_TIME_OFFSET : this.eagerRefreshThresholdMillis = c.eagerRefreshThresholdMillis, this.forceRefreshOnFailure = !!c?.forceRefreshOnFailure;
    }
    async getAccessToken() {
      return (!this.cachedAccessToken || this.isExpired(this.cachedAccessToken)) && await this.refreshAccessTokenAsync(), {
        token: this.cachedAccessToken.access_token,
        res: this.cachedAccessToken.res
      };
    }
    async getRequestHeaders() {
      const c = await this.getAccessToken(), d = new Headers({
        authorization: `Bearer ${c.token}`
      });
      return this.addSharedMetadataHeaders(d);
    }
    request(c, d) {
      if (d)
        this.requestAsync(c).then((p) => d(null, p), (p) => d(p, p.response));
      else
        return this.requestAsync(c);
    }
    /**
     * Authenticates the provided HTTP request, processes it and resolves with the
     * returned response.
     * @param opts The HTTP request options.
     * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure.
     * @return A promise that resolves with the successful response.
     */
    async requestAsync(c, d = !1) {
      let p;
      try {
        const h = await this.getRequestHeaders();
        c.headers = n.Gaxios.mergeHeaders(c.headers), this.addUserProjectAndAuthHeaders(c.headers, h), p = await this.transporter.request(c);
      } catch (h) {
        const m = h.response;
        if (m) {
          const g = m.status, v = m.config.data instanceof i.Readable;
          if (!d && (g === 401 || g === 403) && !v && this.forceRefreshOnFailure)
            return await this.refreshAccessTokenAsync(), await this.requestAsync(c, !0);
        }
        throw h;
      }
      return p;
    }
    /**
     * Forces token refresh, even if unexpired tokens are currently cached.
     * @return A promise that resolves with the refreshed credential.
     */
    async refreshAccessTokenAsync() {
      const c = await this.externalAccountAuthorizedUserHandler.refreshToken(this.refreshToken);
      return this.cachedAccessToken = {
        access_token: c.access_token,
        expiry_date: (/* @__PURE__ */ new Date()).getTime() + c.expires_in * 1e3,
        res: c.res
      }, c.refresh_token !== void 0 && (this.refreshToken = c.refresh_token), this.cachedAccessToken;
    }
    /**
     * Returns whether the provided credentials are expired or not.
     * If there is no expiry time, assumes the token is not expired or expiring.
     * @param credentials The credentials to check for expiration.
     * @return Whether the credentials are expired or not.
     */
    isExpired(c) {
      const d = (/* @__PURE__ */ new Date()).getTime();
      return c.expiry_date ? d >= c.expiry_date - this.eagerRefreshThresholdMillis : !1;
    }
  }
  return it.ExternalAccountAuthorizedUserClient = l, it;
}
var So;
function Ru() {
  return So || (So = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.GoogleAuth = t.GoogleAuthExceptionMessages = void 0;
    const e = Ca, n = st, i = ve(), r = Mn(), o = Bi, a = Hi, l = xn(), f = ba(), c = La(), d = Oa(), p = $a(), h = Wa(), m = Ka(), g = el(), v = lt(), E = Pe(), T = tl(), C = Oe();
    t.GoogleAuthExceptionMessages = {
      API_KEY_WITH_CREDENTIALS: "API Keys and Credentials are mutually exclusive authentication methods and cannot be used together.",
      NO_PROJECT_ID_FOUND: `Unable to detect a Project Id in the current environment. 
To learn more about authentication and Google APIs, visit: 
https://cloud.google.com/docs/authentication/getting-started`,
      NO_CREDENTIALS_FOUND: `Unable to find credentials in current environment. 
To learn more about authentication and Google APIs, visit: 
https://cloud.google.com/docs/authentication/getting-started`,
      NO_ADC_FOUND: "Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.",
      NO_UNIVERSE_DOMAIN_FOUND: `Unable to detect a Universe Domain in the current environment.
To learn more about Universe Domain retrieval, visit: 
https://cloud.google.com/compute/docs/metadata/predefined-metadata-keys`
    };
    class w {
      /**
       * Caches a value indicating whether the auth layer is running on Google
       * Compute Engine.
       * @private
       */
      checkIsGCE = void 0;
      useJWTAccessWithScope;
      defaultServicePath;
      // Note:  this properly is only public to satisfy unit tests.
      // https://github.com/Microsoft/TypeScript/issues/5228
      get isGCE() {
        return this.checkIsGCE;
      }
      _findProjectIdPromise;
      _cachedProjectId;
      // To save the contents of the JSON credential file
      jsonContent = null;
      apiKey;
      cachedCredential = null;
      /**
       * A pending {@link AuthClient}. Used for concurrent {@link GoogleAuth.getClient} calls.
       */
      #e = null;
      /**
       * Scopes populated by the client library by default. We differentiate between
       * these and user defined scopes when deciding whether to use a self-signed JWT.
       */
      defaultScopes;
      keyFilename;
      scopes;
      clientOptions = {};
      /**
       * Configuration is resolved in the following order of precedence:
       * - {@link GoogleAuthOptions.credentials `credentials`}
       * - {@link GoogleAuthOptions.keyFilename `keyFilename`}
       * - {@link GoogleAuthOptions.keyFile `keyFile`}
       *
       * {@link GoogleAuthOptions.clientOptions `clientOptions`} are passed to the
       * {@link AuthClient `AuthClient`s}.
       *
       * @param opts
       */
      constructor(_ = {}) {
        if (this._cachedProjectId = _.projectId || null, this.cachedCredential = _.authClient || null, this.keyFilename = _.keyFilename || _.keyFile, this.scopes = _.scopes, this.clientOptions = _.clientOptions || {}, this.jsonContent = _.credentials || null, this.apiKey = _.apiKey || this.clientOptions.apiKey || null, this.apiKey && (this.jsonContent || this.clientOptions.credentials))
          throw new RangeError(t.GoogleAuthExceptionMessages.API_KEY_WITH_CREDENTIALS);
        _.universeDomain && (this.clientOptions.universeDomain = _.universeDomain);
      }
      // GAPIC client libraries should always use self-signed JWTs. The following
      // variables are set on the JWT client in order to indicate the type of library,
      // and sign the JWT with the correct audience and scopes (if not supplied).
      setGapicJWTValues(_) {
        _.defaultServicePath = this.defaultServicePath, _.useJWTAccessWithScope = this.useJWTAccessWithScope, _.defaultScopes = this.defaultScopes;
      }
      getProjectId(_) {
        if (_)
          this.getProjectIdAsync().then((y) => _(null, y), _);
        else
          return this.getProjectIdAsync();
      }
      /**
       * A temporary method for internal `getProjectId` usages where `null` is
       * acceptable. In a future major release, `getProjectId` should return `null`
       * (as the `Promise<string | null>` base signature describes) and this private
       * method should be removed.
       *
       * @returns Promise that resolves with project id (or `null`)
       */
      async getProjectIdOptional() {
        try {
          return await this.getProjectId();
        } catch (_) {
          if (_ instanceof Error && _.message === t.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND)
            return null;
          throw _;
        }
      }
      /**
       * A private method for finding and caching a projectId.
       *
       * Supports environments in order of precedence:
       * - GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT environment variable
       * - GOOGLE_APPLICATION_CREDENTIALS JSON file
       * - Cloud SDK: `gcloud config config-helper --format json`
       * - GCE project ID from metadata server
       *
       * @returns projectId
       */
      async findAndCacheProjectId() {
        let _ = null;
        if (_ ||= await this.getProductionProjectId(), _ ||= await this.getFileProjectId(), _ ||= await this.getDefaultServiceProjectId(), _ ||= await this.getGCEProjectId(), _ ||= await this.getExternalAccountClientProjectId(), _)
          return this._cachedProjectId = _, _;
        throw new Error(t.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND);
      }
      async getProjectIdAsync() {
        return this._cachedProjectId ? this._cachedProjectId : (this._findProjectIdPromise || (this._findProjectIdPromise = this.findAndCacheProjectId()), this._findProjectIdPromise);
      }
      /**
       * Retrieves a universe domain from the metadata server via
       * {@link gcpMetadata.universe}.
       *
       * @returns a universe domain
       */
      async getUniverseDomainFromMetadataServer() {
        let _;
        try {
          _ = await r.universe("universe-domain"), _ ||= E.DEFAULT_UNIVERSE;
        } catch (y) {
          if (y && y?.response?.status === 404)
            _ = E.DEFAULT_UNIVERSE;
          else
            throw y;
        }
        return _;
      }
      /**
       * Retrieves, caches, and returns the universe domain in the following order
       * of precedence:
       * - The universe domain in {@link GoogleAuth.clientOptions}
       * - An existing or ADC {@link AuthClient}'s universe domain
       * - {@link gcpMetadata.universe}, if {@link Compute} client
       *
       * @returns The universe domain
       */
      async getUniverseDomain() {
        let _ = (0, C.originalOrCamelOptions)(this.clientOptions).get("universe_domain");
        try {
          _ ??= (await this.getClient()).universeDomain;
        } catch {
          _ ??= E.DEFAULT_UNIVERSE;
        }
        return _;
      }
      /**
       * @returns Any scopes (user-specified or default scopes specified by the
       *   client library) that need to be set on the current Auth client.
       */
      getAnyScopes() {
        return this.scopes || this.defaultScopes;
      }
      getApplicationDefault(_ = {}, y) {
        let S;
        if (typeof _ == "function" ? y = _ : S = _, y)
          this.getApplicationDefaultAsync(S).then((R) => y(null, R.credential, R.projectId), y);
        else
          return this.getApplicationDefaultAsync(S);
      }
      async getApplicationDefaultAsync(_ = {}) {
        if (this.cachedCredential)
          return await this.#t(this.cachedCredential, null);
        let y;
        if (y = await this._tryGetApplicationCredentialsFromEnvironmentVariable(_), y)
          return y instanceof p.JWT ? y.scopes = this.scopes : y instanceof v.BaseExternalAccountClient && (y.scopes = this.getAnyScopes()), await this.#t(y);
        if (y = await this._tryGetApplicationCredentialsFromWellKnownFile(_), y)
          return y instanceof p.JWT ? y.scopes = this.scopes : y instanceof v.BaseExternalAccountClient && (y.scopes = this.getAnyScopes()), await this.#t(y);
        if (await this._checkIsGCE())
          return _.scopes = this.getAnyScopes(), await this.#t(new f.Compute(_));
        throw new Error(t.GoogleAuthExceptionMessages.NO_ADC_FOUND);
      }
      async #t(_, y = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || null) {
        const S = await this.getProjectIdOptional();
        return y && (_.quotaProjectId = y), this.cachedCredential = _, { credential: _, projectId: S };
      }
      /**
       * Determines whether the auth layer is running on Google Compute Engine.
       * Checks for GCP Residency, then fallback to checking if metadata server
       * is available.
       *
       * @returns A promise that resolves with the boolean.
       * @api private
       */
      async _checkIsGCE() {
        return this.checkIsGCE === void 0 && (this.checkIsGCE = r.getGCPResidency() || await r.isAvailable()), this.checkIsGCE;
      }
      /**
       * Attempts to load default credentials from the environment variable path..
       * @returns Promise that resolves with the OAuth2Client or null.
       * @api private
       */
      async _tryGetApplicationCredentialsFromEnvironmentVariable(_) {
        const y = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.google_application_credentials;
        if (!y || y.length === 0)
          return null;
        try {
          return this._getApplicationCredentialsFromFilePath(y, _);
        } catch (S) {
          throw S instanceof Error && (S.message = `Unable to read the credential file specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable: ${S.message}`), S;
        }
      }
      /**
       * Attempts to load default credentials from a well-known file location
       * @return Promise that resolves with the OAuth2Client or null.
       * @api private
       */
      async _tryGetApplicationCredentialsFromWellKnownFile(_) {
        let y = null;
        if (this._isWindows())
          y = process.env.APPDATA;
        else {
          const R = process.env.HOME;
          R && (y = a.join(R, ".config"));
        }
        return y && (y = a.join(y, "gcloud", "application_default_credentials.json"), n.existsSync(y) || (y = null)), y ? await this._getApplicationCredentialsFromFilePath(y, _) : null;
      }
      /**
       * Attempts to load default credentials from a file at the given path..
       * @param filePath The path to the file to read.
       * @returns Promise that resolves with the OAuth2Client
       * @api private
       */
      async _getApplicationCredentialsFromFilePath(_, y = {}) {
        if (!_ || _.length === 0)
          throw new Error("The file path is invalid.");
        try {
          if (_ = n.realpathSync(_), !n.lstatSync(_).isFile())
            throw new Error();
        } catch (R) {
          throw R instanceof Error && (R.message = `The file at ${_} does not exist, or it is not a file. ${R.message}`), R;
        }
        const S = n.createReadStream(_);
        return this.fromStream(S, y);
      }
      /**
       * Create a credentials instance using a given impersonated input options.
       * @param json The impersonated input object.
       * @returns JWT or UserRefresh Client with data
       */
      fromImpersonatedJSON(_) {
        if (!_)
          throw new Error("Must pass in a JSON object containing an  impersonated refresh token");
        if (_.type !== m.IMPERSONATED_ACCOUNT_TYPE)
          throw new Error(`The incoming JSON object does not have the "${m.IMPERSONATED_ACCOUNT_TYPE}" type`);
        if (!_.source_credentials)
          throw new Error("The incoming JSON object does not contain a source_credentials field");
        if (!_.service_account_impersonation_url)
          throw new Error("The incoming JSON object does not contain a service_account_impersonation_url field");
        const y = this.fromJSON(_.source_credentials);
        if (_.service_account_impersonation_url?.length > 256)
          throw new RangeError(`Target principal is too long: ${_.service_account_impersonation_url}`);
        const S = /(?<target>[^/]+):(generateAccessToken|generateIdToken)$/.exec(_.service_account_impersonation_url)?.groups?.target;
        if (!S)
          throw new RangeError(`Cannot extract target principal from ${_.service_account_impersonation_url}`);
        const R = (this.scopes || _.scopes || this.defaultScopes) ?? [];
        return new m.Impersonated({
          ..._,
          sourceClient: y,
          targetPrincipal: S,
          targetScopes: Array.isArray(R) ? R : [R]
        });
      }
      /**
       * Create a credentials instance using the given input options.
       * This client is not cached.
       *
       * **Important**: If you accept a credential configuration (credential JSON/File/Stream) from an external source for authentication to Google Cloud, you must validate it before providing it to any Google API or library. Providing an unvalidated credential configuration to Google APIs can compromise the security of your systems and data. For more information, refer to {@link https://cloud.google.com/docs/authentication/external/externally-sourced-credentials Validate credential configurations from external sources}.
       *
       * @deprecated This method is being deprecated because of a potential security risk.
       *
       * This method does not validate the credential configuration. The security
       * risk occurs when a credential configuration is accepted from a source that
       * is not under your control and used without validation on your side.
       *
       * If you know that you will be loading credential configurations of a
       * specific type, it is recommended to use a credential-type-specific
       * constructor. This will ensure that an unexpected credential type with
       * potential for malicious intent is not loaded unintentionally. You might
       * still have to do validation for certain credential types. Please follow
       * the recommendation for that method. For example, if you want to load only
       * service accounts, you can use the `JWT` constructor:
       * ```
       * const {JWT} = require('google-auth-library');
       * const keys = require('/path/to/key.json');
       * const client = new JWT({
       *   email: keys.client_email,
       *   key: keys.private_key,
       *   scopes: ['https://www.googleapis.com/auth/cloud-platform'],
       * });
       * ```
       *
       * If you are loading your credential configuration from an untrusted source and have
       * not mitigated the risks (e.g. by validating the configuration yourself), make
       * these changes as soon as possible to prevent security risks to your environment.
       *
       * Regardless of the method used, it is always your responsibility to validate
       * configurations received from external sources.
       *
       * For more details, see https://cloud.google.com/docs/authentication/external/externally-sourced-credentials.
       *
       * @param json The input object.
       * @param options The JWT or UserRefresh options for the client
       * @returns JWT or UserRefresh Client with data
       */
      fromJSON(_, y = {}) {
        let S;
        const R = (0, C.originalOrCamelOptions)(y).get("universe_domain");
        return _.type === h.USER_REFRESH_ACCOUNT_TYPE ? (S = new h.UserRefreshClient(y), S.fromJSON(_)) : _.type === m.IMPERSONATED_ACCOUNT_TYPE ? S = this.fromImpersonatedJSON(_) : _.type === v.EXTERNAL_ACCOUNT_TYPE ? (S = g.ExternalAccountClient.fromJSON({
          ..._,
          ...y
        }), S.scopes = this.getAnyScopes()) : _.type === T.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE ? S = new T.ExternalAccountAuthorizedUserClient({
          ..._,
          ...y
        }) : (y.scopes = this.scopes, S = new p.JWT(y), this.setGapicJWTValues(S), S.fromJSON(_)), R && (S.universeDomain = R), S;
      }
      /**
       * Return a JWT or UserRefreshClient from JavaScript object, caching both the
       * object used to instantiate and the client.
       * @param json The input object.
       * @param options The JWT or UserRefresh options for the client
       * @returns JWT or UserRefresh Client with data
       */
      _cacheClientFromJSON(_, y) {
        const S = this.fromJSON(_, y);
        return this.jsonContent = _, this.cachedCredential = S, S;
      }
      fromStream(_, y = {}, S) {
        let R = {};
        if (typeof y == "function" ? S = y : R = y, S)
          this.fromStreamAsync(_, R).then((P) => S(null, P), S);
        else
          return this.fromStreamAsync(_, R);
      }
      fromStreamAsync(_, y) {
        return new Promise((S, R) => {
          if (!_)
            throw new Error("Must pass in a stream containing the Google auth settings.");
          const P = [];
          _.setEncoding("utf8").on("error", R).on("data", (N) => P.push(N)).on("end", () => {
            try {
              try {
                const N = JSON.parse(P.join("")), G = this._cacheClientFromJSON(N, y);
                return S(G);
              } catch (N) {
                if (!this.keyFilename)
                  throw N;
                const G = new p.JWT({
                  ...this.clientOptions,
                  keyFile: this.keyFilename
                });
                return this.cachedCredential = G, this.setGapicJWTValues(G), S(G);
              }
            } catch (N) {
              return R(N);
            }
          });
        });
      }
      /**
       * Create a credentials instance using the given API key string.
       * The created client is not cached. In order to create and cache it use the {@link GoogleAuth.getClient `getClient`} method after first providing an {@link GoogleAuth.apiKey `apiKey`}.
       *
       * @param apiKey The API key string
       * @param options An optional options object.
       * @returns A JWT loaded from the key
       */
      fromAPIKey(_, y = {}) {
        return new p.JWT({ ...y, apiKey: _ });
      }
      /**
       * Determines whether the current operating system is Windows.
       * @api private
       */
      _isWindows() {
        const _ = o.platform();
        return !!(_ && _.length >= 3 && _.substring(0, 3).toLowerCase() === "win");
      }
      /**
       * Run the Google Cloud SDK command that prints the default project ID
       */
      async getDefaultServiceProjectId() {
        return new Promise((_) => {
          (0, e.exec)("gcloud config config-helper --format json", (y, S) => {
            if (!y && S)
              try {
                const R = JSON.parse(S).configuration.properties.core.project;
                _(R);
                return;
              } catch {
              }
            _(null);
          });
        });
      }
      /**
       * Loads the project id from environment variables.
       * @api private
       */
      getProductionProjectId() {
        return process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || process.env.gcloud_project || process.env.google_cloud_project;
      }
      /**
       * Loads the project id from the GOOGLE_APPLICATION_CREDENTIALS json file.
       * @api private
       */
      async getFileProjectId() {
        if (this.cachedCredential)
          return this.cachedCredential.projectId;
        if (this.keyFilename) {
          const y = await this.getClient();
          if (y && y.projectId)
            return y.projectId;
        }
        const _ = await this._tryGetApplicationCredentialsFromEnvironmentVariable();
        return _ ? _.projectId : null;
      }
      /**
       * Gets the project ID from external account client if available.
       */
      async getExternalAccountClientProjectId() {
        return !this.jsonContent || this.jsonContent.type !== v.EXTERNAL_ACCOUNT_TYPE ? null : await (await this.getClient()).getProjectId();
      }
      /**
       * Gets the Compute Engine project ID if it can be inferred.
       */
      async getGCEProjectId() {
        try {
          return await r.project("project-id");
        } catch {
          return null;
        }
      }
      getCredentials(_) {
        if (_)
          this.getCredentialsAsync().then((y) => _(null, y), _);
        else
          return this.getCredentialsAsync();
      }
      async getCredentialsAsync() {
        const _ = await this.getClient();
        if (_ instanceof m.Impersonated)
          return { client_email: _.getTargetPrincipal() };
        if (_ instanceof v.BaseExternalAccountClient) {
          const y = _.getServiceAccountEmail();
          if (y)
            return {
              client_email: y,
              universe_domain: _.universeDomain
            };
        }
        if (this.jsonContent)
          return {
            client_email: this.jsonContent.client_email,
            private_key: this.jsonContent.private_key,
            universe_domain: this.jsonContent.universe_domain
          };
        if (await this._checkIsGCE()) {
          const [y, S] = await Promise.all([
            r.instance("service-accounts/default/email"),
            this.getUniverseDomain()
          ]);
          return { client_email: y, universe_domain: S };
        }
        throw new Error(t.GoogleAuthExceptionMessages.NO_CREDENTIALS_FOUND);
      }
      /**
       * Automatically obtain an {@link AuthClient `AuthClient`} based on the
       * provided configuration. If no options were passed, use Application
       * Default Credentials.
       */
      async getClient() {
        if (this.cachedCredential)
          return this.cachedCredential;
        this.#e = this.#e || this.#n();
        try {
          return await this.#e;
        } finally {
          this.#e = null;
        }
      }
      async #n() {
        if (this.jsonContent)
          return this._cacheClientFromJSON(this.jsonContent, this.clientOptions);
        if (this.keyFilename) {
          const _ = a.resolve(this.keyFilename), y = n.createReadStream(_);
          return await this.fromStreamAsync(y, this.clientOptions);
        } else if (this.apiKey) {
          const _ = await this.fromAPIKey(this.apiKey, this.clientOptions);
          _.scopes = this.scopes;
          const { credential: y } = await this.#t(_);
          return y;
        } else {
          const { credential: _ } = await this.getApplicationDefaultAsync(this.clientOptions);
          return _;
        }
      }
      /**
       * Creates a client which will fetch an ID token for authorization.
       * @param targetAudience the audience for the fetched ID token.
       * @returns IdTokenClient for making HTTP calls authenticated with ID tokens.
       */
      async getIdTokenClient(_) {
        const y = await this.getClient();
        if (!("fetchIdToken" in y))
          throw new Error("Cannot fetch ID token in this environment, use GCE or set the GOOGLE_APPLICATION_CREDENTIALS environment variable to a service account credentials JSON file.");
        return new c.IdTokenClient({ targetAudience: _, idTokenProvider: y });
      }
      /**
       * Automatically obtain application default credentials, and return
       * an access token for making requests.
       */
      async getAccessToken() {
        return (await (await this.getClient()).getAccessToken()).token;
      }
      /**
       * Obtain the HTTP headers that will provide authorization for a given
       * request.
       */
      async getRequestHeaders(_) {
        return (await this.getClient()).getRequestHeaders(_);
      }
      /**
       * Obtain credentials for a request, then attach the appropriate headers to
       * the request options.
       * @param opts Axios or Request options on which to attach the headers
       */
      async authorizeRequest(_ = {}) {
        const y = _.url, R = await (await this.getClient()).getRequestHeaders(y);
        return _.headers = i.Gaxios.mergeHeaders(_.headers, R), _;
      }
      /**
       * A {@link fetch `fetch`} compliant API for {@link GoogleAuth}.
       *
       * @see {@link GoogleAuth.request} for the classic method.
       *
       * @remarks
       *
       * This is useful as a drop-in replacement for `fetch` API usage.
       *
       * @example
       *
       * ```ts
       * const auth = new GoogleAuth();
       * const fetchWithAuth: typeof fetch = (...args) => auth.fetch(...args);
       * await fetchWithAuth('https://example.com');
       * ```
       *
       * @param args `fetch` API or {@link Gaxios.fetch `Gaxios#fetch`} parameters
       * @returns the {@link GaxiosResponse} with Gaxios-added properties
       */
      async fetch(..._) {
        return (await this.getClient()).fetch(..._);
      }
      /**
       * Automatically obtain application default credentials, and make an
       * HTTP request using the given options.
       *
       * @see {@link GoogleAuth.fetch} for the modern method.
       *
       * @param opts Axios request options for the HTTP request.
       */
      async request(_) {
        return (await this.getClient()).request(_);
      }
      /**
       * Determine the compute environment in which the code is running.
       */
      getEnv() {
        return (0, d.getEnv)();
      }
      /**
       * Sign the given data with the current private key, or go out
       * to the IAM API to sign it.
       * @param data The data to be signed.
       * @param endpoint A custom endpoint to use.
       *
       * @example
       * ```
       * sign('data', 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/');
       * ```
       */
      async sign(_, y) {
        const S = await this.getClient(), R = await this.getUniverseDomain();
        if (y = y || `https://iamcredentials.${R}/v1/projects/-/serviceAccounts/`, S instanceof m.Impersonated)
          return (await S.sign(_)).signedBlob;
        const P = (0, l.createCrypto)();
        if (S instanceof p.JWT && S.key)
          return await P.sign(S.key, _);
        const N = await this.getCredentials();
        if (!N.client_email)
          throw new Error("Cannot sign data without `client_email`.");
        return this.signBlob(P, N.client_email, _, y);
      }
      async signBlob(_, y, S, R) {
        const P = new URL(R + `${y}:signBlob`);
        return (await this.request({
          method: "POST",
          url: P.href,
          data: {
            payload: _.encodeBase64StringUtf8(S)
          },
          retry: !0,
          retryConfig: {
            httpMethodsToRetry: ["POST"]
          }
        })).data.signedBlob;
      }
    }
    t.GoogleAuth = w;
  })(Kn)), Kn;
}
var Xt = {}, Co;
function Pu() {
  if (Co) return Xt;
  Co = 1, Object.defineProperty(Xt, "__esModule", { value: !0 }), Xt.IAMAuth = void 0;
  class t {
    selector;
    token;
    /**
     * IAM credentials.
     *
     * @param selector the iam authority selector
     * @param token the token
     * @constructor
     */
    constructor(n, i) {
      this.selector = n, this.token = i, this.selector = n, this.token = i;
    }
    /**
     * Acquire the HTTP headers required to make an authenticated request.
     */
    getRequestHeaders() {
      return {
        "x-goog-iam-authority-selector": this.selector,
        "x-goog-iam-authorization-token": this.token
      };
    }
  }
  return Xt.IAMAuth = t, Xt;
}
var fi = {}, Ao;
function Nu() {
  return Ao || (Ao = 1, (function(t) {
    Object.defineProperty(t, "__esModule", { value: !0 }), t.DownscopedClient = t.EXPIRATION_TIME_OFFSET = t.MAX_ACCESS_BOUNDARY_RULES_COUNT = void 0;
    const e = ve(), n = we, i = Pe(), r = Vi(), o = "urn:ietf:params:oauth:grant-type:token-exchange", a = "urn:ietf:params:oauth:token-type:access_token", l = "urn:ietf:params:oauth:token-type:access_token";
    t.MAX_ACCESS_BOUNDARY_RULES_COUNT = 10, t.EXPIRATION_TIME_OFFSET = 300 * 1e3;
    class f extends i.AuthClient {
      authClient;
      credentialAccessBoundary;
      cachedDownscopedAccessToken;
      stsCredential;
      /**
       * Instantiates a downscoped client object using the provided source
       * AuthClient and credential access boundary rules.
       * To downscope permissions of a source AuthClient, a Credential Access
       * Boundary that specifies which resources the new credential can access, as
       * well as an upper bound on the permissions that are available on each
       * resource, has to be defined. A downscoped client can then be instantiated
       * using the source AuthClient and the Credential Access Boundary.
       * @param options the {@link DownscopedClientOptions `DownscopedClientOptions`} to use. Passing an `AuthClient` directly is **@DEPRECATED**.
       * @param credentialAccessBoundary **@DEPRECATED**. Provide a {@link DownscopedClientOptions `DownscopedClientOptions`} object in the first parameter instead.
       */
      constructor(d, p = {
        accessBoundary: {
          accessBoundaryRules: []
        }
      }) {
        if (super(d instanceof i.AuthClient ? {} : d), d instanceof i.AuthClient ? (this.authClient = d, this.credentialAccessBoundary = p) : (this.authClient = d.authClient, this.credentialAccessBoundary = d.credentialAccessBoundary), this.credentialAccessBoundary.accessBoundary.accessBoundaryRules.length === 0)
          throw new Error("At least one access boundary rule needs to be defined.");
        if (this.credentialAccessBoundary.accessBoundary.accessBoundaryRules.length > t.MAX_ACCESS_BOUNDARY_RULES_COUNT)
          throw new Error(`The provided access boundary has more than ${t.MAX_ACCESS_BOUNDARY_RULES_COUNT} access boundary rules.`);
        for (const h of this.credentialAccessBoundary.accessBoundary.accessBoundaryRules)
          if (h.availablePermissions.length === 0)
            throw new Error("At least one permission should be defined in access boundary rules.");
        this.stsCredential = new r.StsCredentials({
          tokenExchangeEndpoint: `https://sts.${this.universeDomain}/v1/token`
        }), this.cachedDownscopedAccessToken = null;
      }
      /**
       * Provides a mechanism to inject Downscoped access tokens directly.
       * The expiry_date field is required to facilitate determination of the token
       * expiration which would make it easier for the token consumer to handle.
       * @param credentials The Credentials object to set on the current client.
       */
      setCredentials(d) {
        if (!d.expiry_date)
          throw new Error("The access token expiry_date field is missing in the provided credentials.");
        super.setCredentials(d), this.cachedDownscopedAccessToken = d;
      }
      async getAccessToken() {
        return (!this.cachedDownscopedAccessToken || this.isExpired(this.cachedDownscopedAccessToken)) && await this.refreshAccessTokenAsync(), {
          token: this.cachedDownscopedAccessToken.access_token,
          expirationTime: this.cachedDownscopedAccessToken.expiry_date,
          res: this.cachedDownscopedAccessToken.res
        };
      }
      /**
       * The main authentication interface. It takes an optional url which when
       * present is the endpoint being accessed, and returns a Promise which
       * resolves with authorization header fields.
       *
       * The result has the form:
       * { authorization: 'Bearer <access_token_value>' }
       */
      async getRequestHeaders() {
        const d = await this.getAccessToken(), p = new Headers({
          authorization: `Bearer ${d.token}`
        });
        return this.addSharedMetadataHeaders(p);
      }
      request(d, p) {
        if (p)
          this.requestAsync(d).then((h) => p(null, h), (h) => p(h, h.response));
        else
          return this.requestAsync(d);
      }
      /**
       * Authenticates the provided HTTP request, processes it and resolves with the
       * returned response.
       * @param opts The HTTP request options.
       * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure
       * @return A promise that resolves with the successful response.
       */
      async requestAsync(d, p = !1) {
        let h;
        try {
          const m = await this.getRequestHeaders();
          d.headers = e.Gaxios.mergeHeaders(d.headers), this.addUserProjectAndAuthHeaders(d.headers, m), h = await this.transporter.request(d);
        } catch (m) {
          const g = m.response;
          if (g) {
            const v = g.status, E = g.config.data instanceof n.Readable;
            if (!p && (v === 401 || v === 403) && !E && this.forceRefreshOnFailure)
              return await this.refreshAccessTokenAsync(), await this.requestAsync(d, !0);
          }
          throw m;
        }
        return h;
      }
      /**
       * Forces token refresh, even if unexpired tokens are currently cached.
       * GCP access tokens are retrieved from authclient object/source credential.
       * Then GCP access tokens are exchanged for downscoped access tokens via the
       * token exchange endpoint.
       * @return A promise that resolves with the fresh downscoped access token.
       */
      async refreshAccessTokenAsync() {
        const d = (await this.authClient.getAccessToken()).token, p = {
          grantType: o,
          requestedTokenType: a,
          subjectToken: d,
          subjectTokenType: l
        }, h = await this.stsCredential.exchangeToken(p, void 0, this.credentialAccessBoundary), m = this.authClient.credentials?.expiry_date || null, g = h.expires_in ? (/* @__PURE__ */ new Date()).getTime() + h.expires_in * 1e3 : m;
        return this.cachedDownscopedAccessToken = {
          access_token: h.access_token,
          expiry_date: g,
          res: h.res
        }, this.credentials = {}, Object.assign(this.credentials, this.cachedDownscopedAccessToken), delete this.credentials.res, this.emit("tokens", {
          refresh_token: null,
          expiry_date: this.cachedDownscopedAccessToken.expiry_date,
          access_token: this.cachedDownscopedAccessToken.access_token,
          token_type: "Bearer",
          id_token: null
        }), this.cachedDownscopedAccessToken;
      }
      /**
       * Returns whether the provided credentials are expired or not.
       * If there is no expiry time, assumes the token is not expired or expiring.
       * @param downscopedAccessToken The credentials to check for expiration.
       * @return Whether the credentials are expired or not.
       */
      isExpired(d) {
        const p = (/* @__PURE__ */ new Date()).getTime();
        return d.expiry_date ? p >= d.expiry_date - this.eagerRefreshThresholdMillis : !1;
      }
    }
    t.DownscopedClient = f;
  })(fi)), fi;
}
var Qt = {}, wo;
function ku() {
  if (wo) return Qt;
  wo = 1, Object.defineProperty(Qt, "__esModule", { value: !0 }), Qt.PassThroughClient = void 0;
  const t = Pe();
  class e extends t.AuthClient {
    /**
     * Creates a request without any authentication headers or checks.
     *
     * @remarks
     *
     * In testing environments it may be useful to change the provided
     * {@link AuthClient.transporter} for any desired request overrides/handling.
     *
     * @param opts
     * @returns The response of the request.
     */
    async request(i) {
      return this.transporter.request(i);
    }
    /**
     * A required method of the base class.
     * Always will return an empty object.
     *
     * @returns {}
     */
    async getAccessToken() {
      return {};
    }
    /**
     * A required method of the base class.
     * Always will return an empty object.
     *
     * @returns {}
     */
    async getRequestHeaders() {
      return new Headers();
    }
  }
  return Qt.PassThroughClient = e, Qt;
}
var Io;
function Mu() {
  return Io || (Io = 1, (function(t) {
    var e = Ye && Ye.__createBinding || (Object.create ? (function(P, N, G, V) {
      V === void 0 && (V = G);
      var q = Object.getOwnPropertyDescriptor(N, G);
      (!q || ("get" in q ? !N.__esModule : q.writable || q.configurable)) && (q = { enumerable: !0, get: function() {
        return N[G];
      } }), Object.defineProperty(P, V, q);
    }) : (function(P, N, G, V) {
      V === void 0 && (V = G), P[V] = N[G];
    })), n = Ye && Ye.__exportStar || function(P, N) {
      for (var G in P) G !== "default" && !Object.prototype.hasOwnProperty.call(N, G) && e(N, P, G);
    };
    Object.defineProperty(t, "__esModule", { value: !0 }), t.GoogleAuth = t.auth = t.PassThroughClient = t.ExternalAccountAuthorizedUserClient = t.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = t.ExecutableError = t.PluggableAuthClient = t.DownscopedClient = t.BaseExternalAccountClient = t.ExternalAccountClient = t.IdentityPoolClient = t.AwsRequestSigner = t.AwsClient = t.UserRefreshClient = t.LoginTicket = t.ClientAuthentication = t.OAuth2Client = t.CodeChallengeMethod = t.Impersonated = t.JWT = t.JWTAccess = t.IdTokenClient = t.IAMAuth = t.GCPEnv = t.Compute = t.DEFAULT_UNIVERSE = t.AuthClient = t.gaxios = t.gcpMetadata = void 0;
    const i = Ru();
    Object.defineProperty(t, "GoogleAuth", { enumerable: !0, get: function() {
      return i.GoogleAuth;
    } }), t.gcpMetadata = Mn(), t.gaxios = ve();
    var r = Pe();
    Object.defineProperty(t, "AuthClient", { enumerable: !0, get: function() {
      return r.AuthClient;
    } }), Object.defineProperty(t, "DEFAULT_UNIVERSE", { enumerable: !0, get: function() {
      return r.DEFAULT_UNIVERSE;
    } });
    var o = ba();
    Object.defineProperty(t, "Compute", { enumerable: !0, get: function() {
      return o.Compute;
    } });
    var a = Oa();
    Object.defineProperty(t, "GCPEnv", { enumerable: !0, get: function() {
      return a.GCPEnv;
    } });
    var l = Pu();
    Object.defineProperty(t, "IAMAuth", { enumerable: !0, get: function() {
      return l.IAMAuth;
    } });
    var f = La();
    Object.defineProperty(t, "IdTokenClient", { enumerable: !0, get: function() {
      return f.IdTokenClient;
    } });
    var c = Ja();
    Object.defineProperty(t, "JWTAccess", { enumerable: !0, get: function() {
      return c.JWTAccess;
    } });
    var d = $a();
    Object.defineProperty(t, "JWT", { enumerable: !0, get: function() {
      return d.JWT;
    } });
    var p = Ka();
    Object.defineProperty(t, "Impersonated", { enumerable: !0, get: function() {
      return p.Impersonated;
    } });
    var h = gt();
    Object.defineProperty(t, "CodeChallengeMethod", { enumerable: !0, get: function() {
      return h.CodeChallengeMethod;
    } }), Object.defineProperty(t, "OAuth2Client", { enumerable: !0, get: function() {
      return h.OAuth2Client;
    } }), Object.defineProperty(t, "ClientAuthentication", { enumerable: !0, get: function() {
      return h.ClientAuthentication;
    } });
    var m = Ua();
    Object.defineProperty(t, "LoginTicket", { enumerable: !0, get: function() {
      return m.LoginTicket;
    } });
    var g = Wa();
    Object.defineProperty(t, "UserRefreshClient", { enumerable: !0, get: function() {
      return g.UserRefreshClient;
    } });
    var v = Qa();
    Object.defineProperty(t, "AwsClient", { enumerable: !0, get: function() {
      return v.AwsClient;
    } });
    var E = Xa();
    Object.defineProperty(t, "AwsRequestSigner", { enumerable: !0, get: function() {
      return E.AwsRequestSigner;
    } });
    var T = za();
    Object.defineProperty(t, "IdentityPoolClient", { enumerable: !0, get: function() {
      return T.IdentityPoolClient;
    } });
    var C = el();
    Object.defineProperty(t, "ExternalAccountClient", { enumerable: !0, get: function() {
      return C.ExternalAccountClient;
    } });
    var w = lt();
    Object.defineProperty(t, "BaseExternalAccountClient", { enumerable: !0, get: function() {
      return w.BaseExternalAccountClient;
    } });
    var D = Nu();
    Object.defineProperty(t, "DownscopedClient", { enumerable: !0, get: function() {
      return D.DownscopedClient;
    } });
    var _ = ja();
    Object.defineProperty(t, "PluggableAuthClient", { enumerable: !0, get: function() {
      return _.PluggableAuthClient;
    } }), Object.defineProperty(t, "ExecutableError", { enumerable: !0, get: function() {
      return _.ExecutableError;
    } });
    var y = tl();
    Object.defineProperty(t, "EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE", { enumerable: !0, get: function() {
      return y.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE;
    } }), Object.defineProperty(t, "ExternalAccountAuthorizedUserClient", { enumerable: !0, get: function() {
      return y.ExternalAccountAuthorizedUserClient;
    } });
    var S = ku();
    Object.defineProperty(t, "PassThroughClient", { enumerable: !0, get: function() {
      return S.PassThroughClient;
    } }), n(Va(), t);
    const R = new i.GoogleAuth();
    t.auth = R;
  })(Ye)), Ye;
}
var xu = Mu(), Zt = { exports: {} }, di, Ro;
function We() {
  if (Ro) return di;
  Ro = 1;
  const t = ["nodebuffer", "arraybuffer", "fragments"], e = typeof Blob < "u";
  return e && t.push("blob"), di = {
    BINARY_TYPES: t,
    CLOSE_TIMEOUT: 3e4,
    EMPTY_BUFFER: Buffer.alloc(0),
    GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
    hasBlob: e,
    kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
    kListener: /* @__PURE__ */ Symbol("kListener"),
    kStatusCode: /* @__PURE__ */ Symbol("status-code"),
    kWebSocket: /* @__PURE__ */ Symbol("websocket"),
    NOOP: () => {
    }
  }, di;
}
var Po;
function Dn() {
  if (Po) return Zt.exports;
  Po = 1;
  const { EMPTY_BUFFER: t } = We(), e = Buffer[Symbol.species];
  function n(l, f) {
    if (l.length === 0) return t;
    if (l.length === 1) return l[0];
    const c = Buffer.allocUnsafe(f);
    let d = 0;
    for (let p = 0; p < l.length; p++) {
      const h = l[p];
      c.set(h, d), d += h.length;
    }
    return d < f ? new e(c.buffer, c.byteOffset, d) : c;
  }
  function i(l, f, c, d, p) {
    for (let h = 0; h < p; h++)
      c[d + h] = l[h] ^ f[h & 3];
  }
  function r(l, f) {
    for (let c = 0; c < l.length; c++)
      l[c] ^= f[c & 3];
  }
  function o(l) {
    return l.length === l.buffer.byteLength ? l.buffer : l.buffer.slice(l.byteOffset, l.byteOffset + l.length);
  }
  function a(l) {
    if (a.readOnly = !0, Buffer.isBuffer(l)) return l;
    let f;
    return l instanceof ArrayBuffer ? f = new e(l) : ArrayBuffer.isView(l) ? f = new e(l.buffer, l.byteOffset, l.byteLength) : (f = Buffer.from(l), a.readOnly = !1), f;
  }
  if (Zt.exports = {
    concat: n,
    mask: i,
    toArrayBuffer: o,
    toBuffer: a,
    unmask: r
  }, !process.env.WS_NO_BUFFER_UTIL)
    try {
      const l = require("bufferutil");
      Zt.exports.mask = function(f, c, d, p, h) {
        h < 48 ? i(f, c, d, p, h) : l.mask(f, c, d, p, h);
      }, Zt.exports.unmask = function(f, c) {
        f.length < 32 ? r(f, c) : l.unmask(f, c);
      };
    } catch {
    }
  return Zt.exports;
}
var hi, No;
function Du() {
  if (No) return hi;
  No = 1;
  const t = /* @__PURE__ */ Symbol("kDone"), e = /* @__PURE__ */ Symbol("kRun");
  class n {
    /**
     * Creates a new `Limiter`.
     *
     * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
     *     to run concurrently
     */
    constructor(r) {
      this[t] = () => {
        this.pending--, this[e]();
      }, this.concurrency = r || 1 / 0, this.jobs = [], this.pending = 0;
    }
    /**
     * Adds a job to the queue.
     *
     * @param {Function} job The job to run
     * @public
     */
    add(r) {
      this.jobs.push(r), this[e]();
    }
    /**
     * Removes a job from the queue and runs it if possible.
     *
     * @private
     */
    [e]() {
      if (this.pending !== this.concurrency && this.jobs.length) {
        const r = this.jobs.shift();
        this.pending++, r(this[t]);
      }
    }
  }
  return hi = n, hi;
}
var pi, ko;
function Un() {
  if (ko) return pi;
  ko = 1;
  const t = yc, e = Dn(), n = Du(), { kStatusCode: i } = We(), r = Buffer[Symbol.species], o = Buffer.from([0, 0, 255, 255]), a = /* @__PURE__ */ Symbol("permessage-deflate"), l = /* @__PURE__ */ Symbol("total-length"), f = /* @__PURE__ */ Symbol("callback"), c = /* @__PURE__ */ Symbol("buffers"), d = /* @__PURE__ */ Symbol("error");
  let p;
  class h {
    /**
     * Creates a PerMessageDeflate instance.
     *
     * @param {Object} [options] Configuration options
     * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
     *     for, or request, a custom client window size
     * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
     *     acknowledge disabling of client context takeover
     * @param {Number} [options.concurrencyLimit=10] The number of concurrent
     *     calls to zlib
     * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
     *     use of a custom server window size
     * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
     *     disabling of server context takeover
     * @param {Number} [options.threshold=1024] Size (in bytes) below which
     *     messages should not be compressed if context takeover is disabled
     * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
     *     deflate
     * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
     *     inflate
     * @param {Boolean} [isServer=false] Create the instance in either server or
     *     client mode
     * @param {Number} [maxPayload=0] The maximum allowed message length
     */
    constructor(T, C, w) {
      if (this._maxPayload = w | 0, this._options = T || {}, this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024, this._isServer = !!C, this._deflate = null, this._inflate = null, this.params = null, !p) {
        const D = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
        p = new n(D);
      }
    }
    /**
     * @type {String}
     */
    static get extensionName() {
      return "permessage-deflate";
    }
    /**
     * Create an extension negotiation offer.
     *
     * @return {Object} Extension parameters
     * @public
     */
    offer() {
      const T = {};
      return this._options.serverNoContextTakeover && (T.server_no_context_takeover = !0), this._options.clientNoContextTakeover && (T.client_no_context_takeover = !0), this._options.serverMaxWindowBits && (T.server_max_window_bits = this._options.serverMaxWindowBits), this._options.clientMaxWindowBits ? T.client_max_window_bits = this._options.clientMaxWindowBits : this._options.clientMaxWindowBits == null && (T.client_max_window_bits = !0), T;
    }
    /**
     * Accept an extension negotiation offer/response.
     *
     * @param {Array} configurations The extension negotiation offers/reponse
     * @return {Object} Accepted configuration
     * @public
     */
    accept(T) {
      return T = this.normalizeParams(T), this.params = this._isServer ? this.acceptAsServer(T) : this.acceptAsClient(T), this.params;
    }
    /**
     * Releases all resources used by the extension.
     *
     * @public
     */
    cleanup() {
      if (this._inflate && (this._inflate.close(), this._inflate = null), this._deflate) {
        const T = this._deflate[f];
        this._deflate.close(), this._deflate = null, T && T(
          new Error(
            "The deflate stream was closed while data was being processed"
          )
        );
      }
    }
    /**
     *  Accept an extension negotiation offer.
     *
     * @param {Array} offers The extension negotiation offers
     * @return {Object} Accepted configuration
     * @private
     */
    acceptAsServer(T) {
      const C = this._options, w = T.find((D) => !(C.serverNoContextTakeover === !1 && D.server_no_context_takeover || D.server_max_window_bits && (C.serverMaxWindowBits === !1 || typeof C.serverMaxWindowBits == "number" && C.serverMaxWindowBits > D.server_max_window_bits) || typeof C.clientMaxWindowBits == "number" && !D.client_max_window_bits));
      if (!w)
        throw new Error("None of the extension offers can be accepted");
      return C.serverNoContextTakeover && (w.server_no_context_takeover = !0), C.clientNoContextTakeover && (w.client_no_context_takeover = !0), typeof C.serverMaxWindowBits == "number" && (w.server_max_window_bits = C.serverMaxWindowBits), typeof C.clientMaxWindowBits == "number" ? w.client_max_window_bits = C.clientMaxWindowBits : (w.client_max_window_bits === !0 || C.clientMaxWindowBits === !1) && delete w.client_max_window_bits, w;
    }
    /**
     * Accept the extension negotiation response.
     *
     * @param {Array} response The extension negotiation response
     * @return {Object} Accepted configuration
     * @private
     */
    acceptAsClient(T) {
      const C = T[0];
      if (this._options.clientNoContextTakeover === !1 && C.client_no_context_takeover)
        throw new Error('Unexpected parameter "client_no_context_takeover"');
      if (!C.client_max_window_bits)
        typeof this._options.clientMaxWindowBits == "number" && (C.client_max_window_bits = this._options.clientMaxWindowBits);
      else if (this._options.clientMaxWindowBits === !1 || typeof this._options.clientMaxWindowBits == "number" && C.client_max_window_bits > this._options.clientMaxWindowBits)
        throw new Error(
          'Unexpected or invalid parameter "client_max_window_bits"'
        );
      return C;
    }
    /**
     * Normalize parameters.
     *
     * @param {Array} configurations The extension negotiation offers/reponse
     * @return {Array} The offers/response with normalized parameters
     * @private
     */
    normalizeParams(T) {
      return T.forEach((C) => {
        Object.keys(C).forEach((w) => {
          let D = C[w];
          if (D.length > 1)
            throw new Error(`Parameter "${w}" must have only a single value`);
          if (D = D[0], w === "client_max_window_bits") {
            if (D !== !0) {
              const _ = +D;
              if (!Number.isInteger(_) || _ < 8 || _ > 15)
                throw new TypeError(
                  `Invalid value for parameter "${w}": ${D}`
                );
              D = _;
            } else if (!this._isServer)
              throw new TypeError(
                `Invalid value for parameter "${w}": ${D}`
              );
          } else if (w === "server_max_window_bits") {
            const _ = +D;
            if (!Number.isInteger(_) || _ < 8 || _ > 15)
              throw new TypeError(
                `Invalid value for parameter "${w}": ${D}`
              );
            D = _;
          } else if (w === "client_no_context_takeover" || w === "server_no_context_takeover") {
            if (D !== !0)
              throw new TypeError(
                `Invalid value for parameter "${w}": ${D}`
              );
          } else
            throw new Error(`Unknown parameter "${w}"`);
          C[w] = D;
        });
      }), T;
    }
    /**
     * Decompress data. Concurrency limited.
     *
     * @param {Buffer} data Compressed data
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @public
     */
    decompress(T, C, w) {
      p.add((D) => {
        this._decompress(T, C, (_, y) => {
          D(), w(_, y);
        });
      });
    }
    /**
     * Compress data. Concurrency limited.
     *
     * @param {(Buffer|String)} data Data to compress
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @public
     */
    compress(T, C, w) {
      p.add((D) => {
        this._compress(T, C, (_, y) => {
          D(), w(_, y);
        });
      });
    }
    /**
     * Decompress data.
     *
     * @param {Buffer} data Compressed data
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @private
     */
    _decompress(T, C, w) {
      const D = this._isServer ? "client" : "server";
      if (!this._inflate) {
        const _ = `${D}_max_window_bits`, y = typeof this.params[_] != "number" ? t.Z_DEFAULT_WINDOWBITS : this.params[_];
        this._inflate = t.createInflateRaw({
          ...this._options.zlibInflateOptions,
          windowBits: y
        }), this._inflate[a] = this, this._inflate[l] = 0, this._inflate[c] = [], this._inflate.on("error", v), this._inflate.on("data", g);
      }
      this._inflate[f] = w, this._inflate.write(T), C && this._inflate.write(o), this._inflate.flush(() => {
        const _ = this._inflate[d];
        if (_) {
          this._inflate.close(), this._inflate = null, w(_);
          return;
        }
        const y = e.concat(
          this._inflate[c],
          this._inflate[l]
        );
        this._inflate._readableState.endEmitted ? (this._inflate.close(), this._inflate = null) : (this._inflate[l] = 0, this._inflate[c] = [], C && this.params[`${D}_no_context_takeover`] && this._inflate.reset()), w(null, y);
      });
    }
    /**
     * Compress data.
     *
     * @param {(Buffer|String)} data Data to compress
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @private
     */
    _compress(T, C, w) {
      const D = this._isServer ? "server" : "client";
      if (!this._deflate) {
        const _ = `${D}_max_window_bits`, y = typeof this.params[_] != "number" ? t.Z_DEFAULT_WINDOWBITS : this.params[_];
        this._deflate = t.createDeflateRaw({
          ...this._options.zlibDeflateOptions,
          windowBits: y
        }), this._deflate[l] = 0, this._deflate[c] = [], this._deflate.on("data", m);
      }
      this._deflate[f] = w, this._deflate.write(T), this._deflate.flush(t.Z_SYNC_FLUSH, () => {
        if (!this._deflate)
          return;
        let _ = e.concat(
          this._deflate[c],
          this._deflate[l]
        );
        C && (_ = new r(_.buffer, _.byteOffset, _.length - 4)), this._deflate[f] = null, this._deflate[l] = 0, this._deflate[c] = [], C && this.params[`${D}_no_context_takeover`] && this._deflate.reset(), w(null, _);
      });
    }
  }
  pi = h;
  function m(E) {
    this[c].push(E), this[l] += E.length;
  }
  function g(E) {
    if (this[l] += E.length, this[a]._maxPayload < 1 || this[l] <= this[a]._maxPayload) {
      this[c].push(E);
      return;
    }
    this[d] = new RangeError("Max payload size exceeded"), this[d].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH", this[d][i] = 1009, this.removeListener("data", g), this.reset();
  }
  function v(E) {
    if (this[a]._inflate = null, this[d]) {
      this[f](this[d]);
      return;
    }
    E[i] = 1007, this[f](E);
  }
  return pi;
}
var jt = { exports: {} }, Mo;
function cn() {
  if (Mo) return jt.exports;
  Mo = 1;
  const { isUtf8: t } = on, { hasBlob: e } = We(), n = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 0 - 15
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // 16 - 31
    0,
    1,
    0,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    0,
    // 32 - 47
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    // 48 - 63
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    // 64 - 79
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    0,
    1,
    1,
    // 80 - 95
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    // 96 - 111
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    1,
    0,
    1,
    0
    // 112 - 127
  ];
  function i(a) {
    return a >= 1e3 && a <= 1014 && a !== 1004 && a !== 1005 && a !== 1006 || a >= 3e3 && a <= 4999;
  }
  function r(a) {
    const l = a.length;
    let f = 0;
    for (; f < l; )
      if ((a[f] & 128) === 0)
        f++;
      else if ((a[f] & 224) === 192) {
        if (f + 1 === l || (a[f + 1] & 192) !== 128 || (a[f] & 254) === 192)
          return !1;
        f += 2;
      } else if ((a[f] & 240) === 224) {
        if (f + 2 >= l || (a[f + 1] & 192) !== 128 || (a[f + 2] & 192) !== 128 || a[f] === 224 && (a[f + 1] & 224) === 128 || // Overlong
        a[f] === 237 && (a[f + 1] & 224) === 160)
          return !1;
        f += 3;
      } else if ((a[f] & 248) === 240) {
        if (f + 3 >= l || (a[f + 1] & 192) !== 128 || (a[f + 2] & 192) !== 128 || (a[f + 3] & 192) !== 128 || a[f] === 240 && (a[f + 1] & 240) === 128 || // Overlong
        a[f] === 244 && a[f + 1] > 143 || a[f] > 244)
          return !1;
        f += 4;
      } else
        return !1;
    return !0;
  }
  function o(a) {
    return e && typeof a == "object" && typeof a.arrayBuffer == "function" && typeof a.type == "string" && typeof a.stream == "function" && (a[Symbol.toStringTag] === "Blob" || a[Symbol.toStringTag] === "File");
  }
  if (jt.exports = {
    isBlob: o,
    isValidStatusCode: i,
    isValidUTF8: r,
    tokenChars: n
  }, t)
    jt.exports.isValidUTF8 = function(a) {
      return a.length < 24 ? r(a) : t(a);
    };
  else if (!process.env.WS_NO_UTF_8_VALIDATE)
    try {
      const a = require("utf-8-validate");
      jt.exports.isValidUTF8 = function(l) {
        return l.length < 32 ? r(l) : a(l);
      };
    } catch {
    }
  return jt.exports;
}
var mi, xo;
function nl() {
  if (xo) return mi;
  xo = 1;
  const { Writable: t } = we, e = Un(), {
    BINARY_TYPES: n,
    EMPTY_BUFFER: i,
    kStatusCode: r,
    kWebSocket: o
  } = We(), { concat: a, toArrayBuffer: l, unmask: f } = Dn(), { isValidStatusCode: c, isValidUTF8: d } = cn(), p = Buffer[Symbol.species], h = 0, m = 1, g = 2, v = 3, E = 4, T = 5, C = 6;
  class w extends t {
    /**
     * Creates a Receiver instance.
     *
     * @param {Object} [options] Options object
     * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
     *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
     *     multiple times in the same tick
     * @param {String} [options.binaryType=nodebuffer] The type for binary data
     * @param {Object} [options.extensions] An object containing the negotiated
     *     extensions
     * @param {Boolean} [options.isServer=false] Specifies whether to operate in
     *     client or server mode
     * @param {Number} [options.maxPayload=0] The maximum allowed message length
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     */
    constructor(_ = {}) {
      super(), this._allowSynchronousEvents = _.allowSynchronousEvents !== void 0 ? _.allowSynchronousEvents : !0, this._binaryType = _.binaryType || n[0], this._extensions = _.extensions || {}, this._isServer = !!_.isServer, this._maxPayload = _.maxPayload | 0, this._skipUTF8Validation = !!_.skipUTF8Validation, this[o] = void 0, this._bufferedBytes = 0, this._buffers = [], this._compressed = !1, this._payloadLength = 0, this._mask = void 0, this._fragmented = 0, this._masked = !1, this._fin = !1, this._opcode = 0, this._totalPayloadLength = 0, this._messageLength = 0, this._fragments = [], this._errored = !1, this._loop = !1, this._state = h;
    }
    /**
     * Implements `Writable.prototype._write()`.
     *
     * @param {Buffer} chunk The chunk of data to write
     * @param {String} encoding The character encoding of `chunk`
     * @param {Function} cb Callback
     * @private
     */
    _write(_, y, S) {
      if (this._opcode === 8 && this._state == h) return S();
      this._bufferedBytes += _.length, this._buffers.push(_), this.startLoop(S);
    }
    /**
     * Consumes `n` bytes from the buffered data.
     *
     * @param {Number} n The number of bytes to consume
     * @return {Buffer} The consumed bytes
     * @private
     */
    consume(_) {
      if (this._bufferedBytes -= _, _ === this._buffers[0].length) return this._buffers.shift();
      if (_ < this._buffers[0].length) {
        const S = this._buffers[0];
        return this._buffers[0] = new p(
          S.buffer,
          S.byteOffset + _,
          S.length - _
        ), new p(S.buffer, S.byteOffset, _);
      }
      const y = Buffer.allocUnsafe(_);
      do {
        const S = this._buffers[0], R = y.length - _;
        _ >= S.length ? y.set(this._buffers.shift(), R) : (y.set(new Uint8Array(S.buffer, S.byteOffset, _), R), this._buffers[0] = new p(
          S.buffer,
          S.byteOffset + _,
          S.length - _
        )), _ -= S.length;
      } while (_ > 0);
      return y;
    }
    /**
     * Starts the parsing loop.
     *
     * @param {Function} cb Callback
     * @private
     */
    startLoop(_) {
      this._loop = !0;
      do
        switch (this._state) {
          case h:
            this.getInfo(_);
            break;
          case m:
            this.getPayloadLength16(_);
            break;
          case g:
            this.getPayloadLength64(_);
            break;
          case v:
            this.getMask();
            break;
          case E:
            this.getData(_);
            break;
          case T:
          case C:
            this._loop = !1;
            return;
        }
      while (this._loop);
      this._errored || _();
    }
    /**
     * Reads the first two bytes of a frame.
     *
     * @param {Function} cb Callback
     * @private
     */
    getInfo(_) {
      if (this._bufferedBytes < 2) {
        this._loop = !1;
        return;
      }
      const y = this.consume(2);
      if ((y[0] & 48) !== 0) {
        const R = this.createError(
          RangeError,
          "RSV2 and RSV3 must be clear",
          !0,
          1002,
          "WS_ERR_UNEXPECTED_RSV_2_3"
        );
        _(R);
        return;
      }
      const S = (y[0] & 64) === 64;
      if (S && !this._extensions[e.extensionName]) {
        const R = this.createError(
          RangeError,
          "RSV1 must be clear",
          !0,
          1002,
          "WS_ERR_UNEXPECTED_RSV_1"
        );
        _(R);
        return;
      }
      if (this._fin = (y[0] & 128) === 128, this._opcode = y[0] & 15, this._payloadLength = y[1] & 127, this._opcode === 0) {
        if (S) {
          const R = this.createError(
            RangeError,
            "RSV1 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          _(R);
          return;
        }
        if (!this._fragmented) {
          const R = this.createError(
            RangeError,
            "invalid opcode 0",
            !0,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          _(R);
          return;
        }
        this._opcode = this._fragmented;
      } else if (this._opcode === 1 || this._opcode === 2) {
        if (this._fragmented) {
          const R = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            !0,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          _(R);
          return;
        }
        this._compressed = S;
      } else if (this._opcode > 7 && this._opcode < 11) {
        if (!this._fin) {
          const R = this.createError(
            RangeError,
            "FIN must be set",
            !0,
            1002,
            "WS_ERR_EXPECTED_FIN"
          );
          _(R);
          return;
        }
        if (S) {
          const R = this.createError(
            RangeError,
            "RSV1 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          _(R);
          return;
        }
        if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
          const R = this.createError(
            RangeError,
            `invalid payload length ${this._payloadLength}`,
            !0,
            1002,
            "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
          );
          _(R);
          return;
        }
      } else {
        const R = this.createError(
          RangeError,
          `invalid opcode ${this._opcode}`,
          !0,
          1002,
          "WS_ERR_INVALID_OPCODE"
        );
        _(R);
        return;
      }
      if (!this._fin && !this._fragmented && (this._fragmented = this._opcode), this._masked = (y[1] & 128) === 128, this._isServer) {
        if (!this._masked) {
          const R = this.createError(
            RangeError,
            "MASK must be set",
            !0,
            1002,
            "WS_ERR_EXPECTED_MASK"
          );
          _(R);
          return;
        }
      } else if (this._masked) {
        const R = this.createError(
          RangeError,
          "MASK must be clear",
          !0,
          1002,
          "WS_ERR_UNEXPECTED_MASK"
        );
        _(R);
        return;
      }
      this._payloadLength === 126 ? this._state = m : this._payloadLength === 127 ? this._state = g : this.haveLength(_);
    }
    /**
     * Gets extended payload length (7+16).
     *
     * @param {Function} cb Callback
     * @private
     */
    getPayloadLength16(_) {
      if (this._bufferedBytes < 2) {
        this._loop = !1;
        return;
      }
      this._payloadLength = this.consume(2).readUInt16BE(0), this.haveLength(_);
    }
    /**
     * Gets extended payload length (7+64).
     *
     * @param {Function} cb Callback
     * @private
     */
    getPayloadLength64(_) {
      if (this._bufferedBytes < 8) {
        this._loop = !1;
        return;
      }
      const y = this.consume(8), S = y.readUInt32BE(0);
      if (S > Math.pow(2, 21) - 1) {
        const R = this.createError(
          RangeError,
          "Unsupported WebSocket frame: payload length > 2^53 - 1",
          !1,
          1009,
          "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
        );
        _(R);
        return;
      }
      this._payloadLength = S * Math.pow(2, 32) + y.readUInt32BE(4), this.haveLength(_);
    }
    /**
     * Payload length has been read.
     *
     * @param {Function} cb Callback
     * @private
     */
    haveLength(_) {
      if (this._payloadLength && this._opcode < 8 && (this._totalPayloadLength += this._payloadLength, this._totalPayloadLength > this._maxPayload && this._maxPayload > 0)) {
        const y = this.createError(
          RangeError,
          "Max payload size exceeded",
          !1,
          1009,
          "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
        );
        _(y);
        return;
      }
      this._masked ? this._state = v : this._state = E;
    }
    /**
     * Reads mask bytes.
     *
     * @private
     */
    getMask() {
      if (this._bufferedBytes < 4) {
        this._loop = !1;
        return;
      }
      this._mask = this.consume(4), this._state = E;
    }
    /**
     * Reads data bytes.
     *
     * @param {Function} cb Callback
     * @private
     */
    getData(_) {
      let y = i;
      if (this._payloadLength) {
        if (this._bufferedBytes < this._payloadLength) {
          this._loop = !1;
          return;
        }
        y = this.consume(this._payloadLength), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0 && f(y, this._mask);
      }
      if (this._opcode > 7) {
        this.controlMessage(y, _);
        return;
      }
      if (this._compressed) {
        this._state = T, this.decompress(y, _);
        return;
      }
      y.length && (this._messageLength = this._totalPayloadLength, this._fragments.push(y)), this.dataMessage(_);
    }
    /**
     * Decompresses data.
     *
     * @param {Buffer} data Compressed data
     * @param {Function} cb Callback
     * @private
     */
    decompress(_, y) {
      this._extensions[e.extensionName].decompress(_, this._fin, (R, P) => {
        if (R) return y(R);
        if (P.length) {
          if (this._messageLength += P.length, this._messageLength > this._maxPayload && this._maxPayload > 0) {
            const N = this.createError(
              RangeError,
              "Max payload size exceeded",
              !1,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            y(N);
            return;
          }
          this._fragments.push(P);
        }
        this.dataMessage(y), this._state === h && this.startLoop(y);
      });
    }
    /**
     * Handles a data message.
     *
     * @param {Function} cb Callback
     * @private
     */
    dataMessage(_) {
      if (!this._fin) {
        this._state = h;
        return;
      }
      const y = this._messageLength, S = this._fragments;
      if (this._totalPayloadLength = 0, this._messageLength = 0, this._fragmented = 0, this._fragments = [], this._opcode === 2) {
        let R;
        this._binaryType === "nodebuffer" ? R = a(S, y) : this._binaryType === "arraybuffer" ? R = l(a(S, y)) : this._binaryType === "blob" ? R = new Blob(S) : R = S, this._allowSynchronousEvents ? (this.emit("message", R, !0), this._state = h) : (this._state = C, setImmediate(() => {
          this.emit("message", R, !0), this._state = h, this.startLoop(_);
        }));
      } else {
        const R = a(S, y);
        if (!this._skipUTF8Validation && !d(R)) {
          const P = this.createError(
            Error,
            "invalid UTF-8 sequence",
            !0,
            1007,
            "WS_ERR_INVALID_UTF8"
          );
          _(P);
          return;
        }
        this._state === T || this._allowSynchronousEvents ? (this.emit("message", R, !1), this._state = h) : (this._state = C, setImmediate(() => {
          this.emit("message", R, !1), this._state = h, this.startLoop(_);
        }));
      }
    }
    /**
     * Handles a control message.
     *
     * @param {Buffer} data Data to handle
     * @return {(Error|RangeError|undefined)} A possible error
     * @private
     */
    controlMessage(_, y) {
      if (this._opcode === 8) {
        if (_.length === 0)
          this._loop = !1, this.emit("conclude", 1005, i), this.end();
        else {
          const S = _.readUInt16BE(0);
          if (!c(S)) {
            const P = this.createError(
              RangeError,
              `invalid status code ${S}`,
              !0,
              1002,
              "WS_ERR_INVALID_CLOSE_CODE"
            );
            y(P);
            return;
          }
          const R = new p(
            _.buffer,
            _.byteOffset + 2,
            _.length - 2
          );
          if (!this._skipUTF8Validation && !d(R)) {
            const P = this.createError(
              Error,
              "invalid UTF-8 sequence",
              !0,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            y(P);
            return;
          }
          this._loop = !1, this.emit("conclude", S, R), this.end();
        }
        this._state = h;
        return;
      }
      this._allowSynchronousEvents ? (this.emit(this._opcode === 9 ? "ping" : "pong", _), this._state = h) : (this._state = C, setImmediate(() => {
        this.emit(this._opcode === 9 ? "ping" : "pong", _), this._state = h, this.startLoop(y);
      }));
    }
    /**
     * Builds an error object.
     *
     * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
     * @param {String} message The error message
     * @param {Boolean} prefix Specifies whether or not to add a default prefix to
     *     `message`
     * @param {Number} statusCode The status code
     * @param {String} errorCode The exposed error code
     * @return {(Error|RangeError)} The error
     * @private
     */
    createError(_, y, S, R, P) {
      this._loop = !1, this._errored = !0;
      const N = new _(
        S ? `Invalid WebSocket frame: ${y}` : y
      );
      return Error.captureStackTrace(N, this.createError), N.code = P, N[r] = R, N;
    }
  }
  return mi = w, mi;
}
var gi, Do;
function il() {
  if (Do) return gi;
  Do = 1;
  const { Duplex: t } = we, { randomFillSync: e } = mt, n = Un(), { EMPTY_BUFFER: i, kWebSocket: r, NOOP: o } = We(), { isBlob: a, isValidStatusCode: l } = cn(), { mask: f, toBuffer: c } = Dn(), d = /* @__PURE__ */ Symbol("kByteLength"), p = Buffer.alloc(4), h = 8 * 1024;
  let m, g = h;
  const v = 0, E = 1, T = 2;
  class C {
    /**
     * Creates a Sender instance.
     *
     * @param {Duplex} socket The connection socket
     * @param {Object} [extensions] An object containing the negotiated extensions
     * @param {Function} [generateMask] The function used to generate the masking
     *     key
     */
    constructor(y, S, R) {
      this._extensions = S || {}, R && (this._generateMask = R, this._maskBuffer = Buffer.alloc(4)), this._socket = y, this._firstFragment = !0, this._compress = !1, this._bufferedBytes = 0, this._queue = [], this._state = v, this.onerror = o, this[r] = void 0;
    }
    /**
     * Frames a piece of data according to the HyBi WebSocket protocol.
     *
     * @param {(Buffer|String)} data The data to frame
     * @param {Object} options Options object
     * @param {Boolean} [options.fin=false] Specifies whether or not to set the
     *     FIN bit
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
     *     key
     * @param {Number} options.opcode The opcode
     * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
     *     modified
     * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
     *     RSV1 bit
     * @return {(Buffer|String)[]} The framed data
     * @public
     */
    static frame(y, S) {
      let R, P = !1, N = 2, G = !1;
      S.mask && (R = S.maskBuffer || p, S.generateMask ? S.generateMask(R) : (g === h && (m === void 0 && (m = Buffer.alloc(h)), e(m, 0, h), g = 0), R[0] = m[g++], R[1] = m[g++], R[2] = m[g++], R[3] = m[g++]), G = (R[0] | R[1] | R[2] | R[3]) === 0, N = 6);
      let V;
      typeof y == "string" ? (!S.mask || G) && S[d] !== void 0 ? V = S[d] : (y = Buffer.from(y), V = y.length) : (V = y.length, P = S.mask && S.readOnly && !G);
      let q = V;
      V >= 65536 ? (N += 8, q = 127) : V > 125 && (N += 2, q = 126);
      const J = Buffer.allocUnsafe(P ? V + N : N);
      return J[0] = S.fin ? S.opcode | 128 : S.opcode, S.rsv1 && (J[0] |= 64), J[1] = q, q === 126 ? J.writeUInt16BE(V, 2) : q === 127 && (J[2] = J[3] = 0, J.writeUIntBE(V, 4, 6)), S.mask ? (J[1] |= 128, J[N - 4] = R[0], J[N - 3] = R[1], J[N - 2] = R[2], J[N - 1] = R[3], G ? [J, y] : P ? (f(y, R, J, N, V), [J]) : (f(y, R, y, 0, V), [J, y])) : [J, y];
    }
    /**
     * Sends a close message to the other peer.
     *
     * @param {Number} [code] The status code component of the body
     * @param {(String|Buffer)} [data] The message component of the body
     * @param {Boolean} [mask=false] Specifies whether or not to mask the message
     * @param {Function} [cb] Callback
     * @public
     */
    close(y, S, R, P) {
      let N;
      if (y === void 0)
        N = i;
      else {
        if (typeof y != "number" || !l(y))
          throw new TypeError("First argument must be a valid error code number");
        if (S === void 0 || !S.length)
          N = Buffer.allocUnsafe(2), N.writeUInt16BE(y, 0);
        else {
          const V = Buffer.byteLength(S);
          if (V > 123)
            throw new RangeError("The message must not be greater than 123 bytes");
          N = Buffer.allocUnsafe(2 + V), N.writeUInt16BE(y, 0), typeof S == "string" ? N.write(S, 2) : N.set(S, 2);
        }
      }
      const G = {
        [d]: N.length,
        fin: !0,
        generateMask: this._generateMask,
        mask: R,
        maskBuffer: this._maskBuffer,
        opcode: 8,
        readOnly: !1,
        rsv1: !1
      };
      this._state !== v ? this.enqueue([this.dispatch, N, !1, G, P]) : this.sendFrame(C.frame(N, G), P);
    }
    /**
     * Sends a ping message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback
     * @public
     */
    ping(y, S, R) {
      let P, N;
      if (typeof y == "string" ? (P = Buffer.byteLength(y), N = !1) : a(y) ? (P = y.size, N = !1) : (y = c(y), P = y.length, N = c.readOnly), P > 125)
        throw new RangeError("The data size must not be greater than 125 bytes");
      const G = {
        [d]: P,
        fin: !0,
        generateMask: this._generateMask,
        mask: S,
        maskBuffer: this._maskBuffer,
        opcode: 9,
        readOnly: N,
        rsv1: !1
      };
      a(y) ? this._state !== v ? this.enqueue([this.getBlobData, y, !1, G, R]) : this.getBlobData(y, !1, G, R) : this._state !== v ? this.enqueue([this.dispatch, y, !1, G, R]) : this.sendFrame(C.frame(y, G), R);
    }
    /**
     * Sends a pong message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback
     * @public
     */
    pong(y, S, R) {
      let P, N;
      if (typeof y == "string" ? (P = Buffer.byteLength(y), N = !1) : a(y) ? (P = y.size, N = !1) : (y = c(y), P = y.length, N = c.readOnly), P > 125)
        throw new RangeError("The data size must not be greater than 125 bytes");
      const G = {
        [d]: P,
        fin: !0,
        generateMask: this._generateMask,
        mask: S,
        maskBuffer: this._maskBuffer,
        opcode: 10,
        readOnly: N,
        rsv1: !1
      };
      a(y) ? this._state !== v ? this.enqueue([this.getBlobData, y, !1, G, R]) : this.getBlobData(y, !1, G, R) : this._state !== v ? this.enqueue([this.dispatch, y, !1, G, R]) : this.sendFrame(C.frame(y, G), R);
    }
    /**
     * Sends a data message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Object} options Options object
     * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
     *     or text
     * @param {Boolean} [options.compress=false] Specifies whether or not to
     *     compress `data`
     * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
     *     last one
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Function} [cb] Callback
     * @public
     */
    send(y, S, R) {
      const P = this._extensions[n.extensionName];
      let N = S.binary ? 2 : 1, G = S.compress, V, q;
      typeof y == "string" ? (V = Buffer.byteLength(y), q = !1) : a(y) ? (V = y.size, q = !1) : (y = c(y), V = y.length, q = c.readOnly), this._firstFragment ? (this._firstFragment = !1, G && P && P.params[P._isServer ? "server_no_context_takeover" : "client_no_context_takeover"] && (G = V >= P._threshold), this._compress = G) : (G = !1, N = 0), S.fin && (this._firstFragment = !0);
      const J = {
        [d]: V,
        fin: S.fin,
        generateMask: this._generateMask,
        mask: S.mask,
        maskBuffer: this._maskBuffer,
        opcode: N,
        readOnly: q,
        rsv1: G
      };
      a(y) ? this._state !== v ? this.enqueue([this.getBlobData, y, this._compress, J, R]) : this.getBlobData(y, this._compress, J, R) : this._state !== v ? this.enqueue([this.dispatch, y, this._compress, J, R]) : this.dispatch(y, this._compress, J, R);
    }
    /**
     * Gets the contents of a blob as binary data.
     *
     * @param {Blob} blob The blob
     * @param {Boolean} [compress=false] Specifies whether or not to compress
     *     the data
     * @param {Object} options Options object
     * @param {Boolean} [options.fin=false] Specifies whether or not to set the
     *     FIN bit
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
     *     key
     * @param {Number} options.opcode The opcode
     * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
     *     modified
     * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
     *     RSV1 bit
     * @param {Function} [cb] Callback
     * @private
     */
    getBlobData(y, S, R, P) {
      this._bufferedBytes += R[d], this._state = T, y.arrayBuffer().then((N) => {
        if (this._socket.destroyed) {
          const V = new Error(
            "The socket was closed while the blob was being read"
          );
          process.nextTick(w, this, V, P);
          return;
        }
        this._bufferedBytes -= R[d];
        const G = c(N);
        S ? this.dispatch(G, S, R, P) : (this._state = v, this.sendFrame(C.frame(G, R), P), this.dequeue());
      }).catch((N) => {
        process.nextTick(D, this, N, P);
      });
    }
    /**
     * Dispatches a message.
     *
     * @param {(Buffer|String)} data The message to send
     * @param {Boolean} [compress=false] Specifies whether or not to compress
     *     `data`
     * @param {Object} options Options object
     * @param {Boolean} [options.fin=false] Specifies whether or not to set the
     *     FIN bit
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
     *     key
     * @param {Number} options.opcode The opcode
     * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
     *     modified
     * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
     *     RSV1 bit
     * @param {Function} [cb] Callback
     * @private
     */
    dispatch(y, S, R, P) {
      if (!S) {
        this.sendFrame(C.frame(y, R), P);
        return;
      }
      const N = this._extensions[n.extensionName];
      this._bufferedBytes += R[d], this._state = E, N.compress(y, R.fin, (G, V) => {
        if (this._socket.destroyed) {
          const q = new Error(
            "The socket was closed while data was being compressed"
          );
          w(this, q, P);
          return;
        }
        this._bufferedBytes -= R[d], this._state = v, R.readOnly = !1, this.sendFrame(C.frame(V, R), P), this.dequeue();
      });
    }
    /**
     * Executes queued send operations.
     *
     * @private
     */
    dequeue() {
      for (; this._state === v && this._queue.length; ) {
        const y = this._queue.shift();
        this._bufferedBytes -= y[3][d], Reflect.apply(y[0], this, y.slice(1));
      }
    }
    /**
     * Enqueues a send operation.
     *
     * @param {Array} params Send operation parameters.
     * @private
     */
    enqueue(y) {
      this._bufferedBytes += y[3][d], this._queue.push(y);
    }
    /**
     * Sends a frame.
     *
     * @param {(Buffer | String)[]} list The frame to send
     * @param {Function} [cb] Callback
     * @private
     */
    sendFrame(y, S) {
      y.length === 2 ? (this._socket.cork(), this._socket.write(y[0]), this._socket.write(y[1], S), this._socket.uncork()) : this._socket.write(y[0], S);
    }
  }
  gi = C;
  function w(_, y, S) {
    typeof S == "function" && S(y);
    for (let R = 0; R < _._queue.length; R++) {
      const P = _._queue[R], N = P[P.length - 1];
      typeof N == "function" && N(y);
    }
  }
  function D(_, y, S) {
    w(_, y, S), _.onerror(y);
  }
  return gi;
}
var yi, Uo;
function Uu() {
  if (Uo) return yi;
  Uo = 1;
  const { kForOnEventAttribute: t, kListener: e } = We(), n = /* @__PURE__ */ Symbol("kCode"), i = /* @__PURE__ */ Symbol("kData"), r = /* @__PURE__ */ Symbol("kError"), o = /* @__PURE__ */ Symbol("kMessage"), a = /* @__PURE__ */ Symbol("kReason"), l = /* @__PURE__ */ Symbol("kTarget"), f = /* @__PURE__ */ Symbol("kType"), c = /* @__PURE__ */ Symbol("kWasClean");
  class d {
    /**
     * Create a new `Event`.
     *
     * @param {String} type The name of the event
     * @throws {TypeError} If the `type` argument is not specified
     */
    constructor(T) {
      this[l] = null, this[f] = T;
    }
    /**
     * @type {*}
     */
    get target() {
      return this[l];
    }
    /**
     * @type {String}
     */
    get type() {
      return this[f];
    }
  }
  Object.defineProperty(d.prototype, "target", { enumerable: !0 }), Object.defineProperty(d.prototype, "type", { enumerable: !0 });
  class p extends d {
    /**
     * Create a new `CloseEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {Number} [options.code=0] The status code explaining why the
     *     connection was closed
     * @param {String} [options.reason=''] A human-readable string explaining why
     *     the connection was closed
     * @param {Boolean} [options.wasClean=false] Indicates whether or not the
     *     connection was cleanly closed
     */
    constructor(T, C = {}) {
      super(T), this[n] = C.code === void 0 ? 0 : C.code, this[a] = C.reason === void 0 ? "" : C.reason, this[c] = C.wasClean === void 0 ? !1 : C.wasClean;
    }
    /**
     * @type {Number}
     */
    get code() {
      return this[n];
    }
    /**
     * @type {String}
     */
    get reason() {
      return this[a];
    }
    /**
     * @type {Boolean}
     */
    get wasClean() {
      return this[c];
    }
  }
  Object.defineProperty(p.prototype, "code", { enumerable: !0 }), Object.defineProperty(p.prototype, "reason", { enumerable: !0 }), Object.defineProperty(p.prototype, "wasClean", { enumerable: !0 });
  class h extends d {
    /**
     * Create a new `ErrorEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {*} [options.error=null] The error that generated this event
     * @param {String} [options.message=''] The error message
     */
    constructor(T, C = {}) {
      super(T), this[r] = C.error === void 0 ? null : C.error, this[o] = C.message === void 0 ? "" : C.message;
    }
    /**
     * @type {*}
     */
    get error() {
      return this[r];
    }
    /**
     * @type {String}
     */
    get message() {
      return this[o];
    }
  }
  Object.defineProperty(h.prototype, "error", { enumerable: !0 }), Object.defineProperty(h.prototype, "message", { enumerable: !0 });
  class m extends d {
    /**
     * Create a new `MessageEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {*} [options.data=null] The message content
     */
    constructor(T, C = {}) {
      super(T), this[i] = C.data === void 0 ? null : C.data;
    }
    /**
     * @type {*}
     */
    get data() {
      return this[i];
    }
  }
  Object.defineProperty(m.prototype, "data", { enumerable: !0 }), yi = {
    CloseEvent: p,
    ErrorEvent: h,
    Event: d,
    EventTarget: {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(E, T, C = {}) {
        for (const D of this.listeners(E))
          if (!C[t] && D[e] === T && !D[t])
            return;
        let w;
        if (E === "message")
          w = function(_, y) {
            const S = new m("message", {
              data: y ? _ : _.toString()
            });
            S[l] = this, v(T, this, S);
          };
        else if (E === "close")
          w = function(_, y) {
            const S = new p("close", {
              code: _,
              reason: y.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            S[l] = this, v(T, this, S);
          };
        else if (E === "error")
          w = function(_) {
            const y = new h("error", {
              error: _,
              message: _.message
            });
            y[l] = this, v(T, this, y);
          };
        else if (E === "open")
          w = function() {
            const _ = new d("open");
            _[l] = this, v(T, this, _);
          };
        else
          return;
        w[t] = !!C[t], w[e] = T, C.once ? this.once(E, w) : this.on(E, w);
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(E, T) {
        for (const C of this.listeners(E))
          if (C[e] === T && !C[t]) {
            this.removeListener(E, C);
            break;
          }
      }
    },
    MessageEvent: m
  };
  function v(E, T, C) {
    typeof E == "object" && E.handleEvent ? E.handleEvent.call(E, C) : E.call(T, C);
  }
  return yi;
}
var _i, bo;
function rl() {
  if (bo) return _i;
  bo = 1;
  const { tokenChars: t } = cn();
  function e(r, o, a) {
    r[o] === void 0 ? r[o] = [a] : r[o].push(a);
  }
  function n(r) {
    const o = /* @__PURE__ */ Object.create(null);
    let a = /* @__PURE__ */ Object.create(null), l = !1, f = !1, c = !1, d, p, h = -1, m = -1, g = -1, v = 0;
    for (; v < r.length; v++)
      if (m = r.charCodeAt(v), d === void 0)
        if (g === -1 && t[m] === 1)
          h === -1 && (h = v);
        else if (v !== 0 && (m === 32 || m === 9))
          g === -1 && h !== -1 && (g = v);
        else if (m === 59 || m === 44) {
          if (h === -1)
            throw new SyntaxError(`Unexpected character at index ${v}`);
          g === -1 && (g = v);
          const T = r.slice(h, g);
          m === 44 ? (e(o, T, a), a = /* @__PURE__ */ Object.create(null)) : d = T, h = g = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (p === void 0)
        if (g === -1 && t[m] === 1)
          h === -1 && (h = v);
        else if (m === 32 || m === 9)
          g === -1 && h !== -1 && (g = v);
        else if (m === 59 || m === 44) {
          if (h === -1)
            throw new SyntaxError(`Unexpected character at index ${v}`);
          g === -1 && (g = v), e(a, r.slice(h, g), !0), m === 44 && (e(o, d, a), a = /* @__PURE__ */ Object.create(null), d = void 0), h = g = -1;
        } else if (m === 61 && h !== -1 && g === -1)
          p = r.slice(h, v), h = g = -1;
        else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (f) {
        if (t[m] !== 1)
          throw new SyntaxError(`Unexpected character at index ${v}`);
        h === -1 ? h = v : l || (l = !0), f = !1;
      } else if (c)
        if (t[m] === 1)
          h === -1 && (h = v);
        else if (m === 34 && h !== -1)
          c = !1, g = v;
        else if (m === 92)
          f = !0;
        else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (m === 34 && r.charCodeAt(v - 1) === 61)
        c = !0;
      else if (g === -1 && t[m] === 1)
        h === -1 && (h = v);
      else if (h !== -1 && (m === 32 || m === 9))
        g === -1 && (g = v);
      else if (m === 59 || m === 44) {
        if (h === -1)
          throw new SyntaxError(`Unexpected character at index ${v}`);
        g === -1 && (g = v);
        let T = r.slice(h, g);
        l && (T = T.replace(/\\/g, ""), l = !1), e(a, p, T), m === 44 && (e(o, d, a), a = /* @__PURE__ */ Object.create(null), d = void 0), p = void 0, h = g = -1;
      } else
        throw new SyntaxError(`Unexpected character at index ${v}`);
    if (h === -1 || c || m === 32 || m === 9)
      throw new SyntaxError("Unexpected end of input");
    g === -1 && (g = v);
    const E = r.slice(h, g);
    return d === void 0 ? e(o, E, a) : (p === void 0 ? e(a, E, !0) : l ? e(a, p, E.replace(/\\/g, "")) : e(a, p, E), e(o, d, a)), o;
  }
  function i(r) {
    return Object.keys(r).map((o) => {
      let a = r[o];
      return Array.isArray(a) || (a = [a]), a.map((l) => [o].concat(
        Object.keys(l).map((f) => {
          let c = l[f];
          return Array.isArray(c) || (c = [c]), c.map((d) => d === !0 ? f : `${f}=${d}`).join("; ");
        })
      ).join("; ")).join(", ");
    }).join(", ");
  }
  return _i = { format: i, parse: n }, _i;
}
var vi, Lo;
function Ji() {
  if (Lo) return vi;
  Lo = 1;
  const t = kn, e = qi, n = Aa, i = pc, r = mc, { randomBytes: o, createHash: a } = mt, { Duplex: l, Readable: f } = we, { URL: c } = gc, d = Un(), p = nl(), h = il(), { isBlob: m } = cn(), {
    BINARY_TYPES: g,
    CLOSE_TIMEOUT: v,
    EMPTY_BUFFER: E,
    GUID: T,
    kForOnEventAttribute: C,
    kListener: w,
    kStatusCode: D,
    kWebSocket: _,
    NOOP: y
  } = We(), {
    EventTarget: { addEventListener: S, removeEventListener: R }
  } = Uu(), { format: P, parse: N } = rl(), { toBuffer: G } = Dn(), V = /* @__PURE__ */ Symbol("kAborted"), q = [8, 13], J = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"], W = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
  class $ extends t {
    /**
     * Create a new `WebSocket`.
     *
     * @param {(String|URL)} address The URL to which to connect
     * @param {(String|String[])} [protocols] The subprotocols
     * @param {Object} [options] Connection options
     */
    constructor(k, U, b) {
      super(), this._binaryType = g[0], this._closeCode = 1006, this._closeFrameReceived = !1, this._closeFrameSent = !1, this._closeMessage = E, this._closeTimer = null, this._errorEmitted = !1, this._extensions = {}, this._paused = !1, this._protocol = "", this._readyState = $.CONNECTING, this._receiver = null, this._sender = null, this._socket = null, k !== null ? (this._bufferedAmount = 0, this._isServer = !1, this._redirects = 0, U === void 0 ? U = [] : Array.isArray(U) || (typeof U == "object" && U !== null ? (b = U, U = []) : U = [U]), X(this, k, U, b)) : (this._autoPong = b.autoPong, this._closeTimeout = b.closeTimeout, this._isServer = !0);
    }
    /**
     * For historical reasons, the custom "nodebuffer" type is used by the default
     * instead of "blob".
     *
     * @type {String}
     */
    get binaryType() {
      return this._binaryType;
    }
    set binaryType(k) {
      g.includes(k) && (this._binaryType = k, this._receiver && (this._receiver._binaryType = k));
    }
    /**
     * @type {Number}
     */
    get bufferedAmount() {
      return this._socket ? this._socket._writableState.length + this._sender._bufferedBytes : this._bufferedAmount;
    }
    /**
     * @type {String}
     */
    get extensions() {
      return Object.keys(this._extensions).join();
    }
    /**
     * @type {Boolean}
     */
    get isPaused() {
      return this._paused;
    }
    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onclose() {
      return null;
    }
    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onerror() {
      return null;
    }
    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onopen() {
      return null;
    }
    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onmessage() {
      return null;
    }
    /**
     * @type {String}
     */
    get protocol() {
      return this._protocol;
    }
    /**
     * @type {Number}
     */
    get readyState() {
      return this._readyState;
    }
    /**
     * @type {String}
     */
    get url() {
      return this._url;
    }
    /**
     * Set up the socket and the internal resources.
     *
     * @param {Duplex} socket The network socket between the server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Object} options Options object
     * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
     *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
     *     multiple times in the same tick
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Number} [options.maxPayload=0] The maximum allowed message size
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     * @private
     */
    setSocket(k, U, b) {
      const O = new p({
        allowSynchronousEvents: b.allowSynchronousEvents,
        binaryType: this.binaryType,
        extensions: this._extensions,
        isServer: this._isServer,
        maxPayload: b.maxPayload,
        skipUTF8Validation: b.skipUTF8Validation
      }), Y = new h(k, this._extensions, b.generateMask);
      this._receiver = O, this._sender = Y, this._socket = k, O[_] = this, Y[_] = this, k[_] = this, O.on("conclude", Et), O.on("drain", K), O.on("error", Tt), O.on("message", Ct), O.on("ping", Se), O.on("pong", Ne), Y.onerror = M, k.setTimeout && k.setTimeout(0), k.setNoDelay && k.setNoDelay(), U.length > 0 && k.unshift(U), k.on("close", B), k.on("data", L), k.on("end", F), k.on("error", H), this._readyState = $.OPEN, this.emit("open");
    }
    /**
     * Emit the `'close'` event.
     *
     * @private
     */
    emitClose() {
      if (!this._socket) {
        this._readyState = $.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
        return;
      }
      this._extensions[d.extensionName] && this._extensions[d.extensionName].cleanup(), this._receiver.removeAllListeners(), this._readyState = $.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
    }
    /**
     * Start a closing handshake.
     *
     *          +----------+   +-----------+   +----------+
     *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
     *    |     +----------+   +-----------+   +----------+     |
     *          +----------+   +-----------+         |
     * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
     *          +----------+   +-----------+   |
     *    |           |                        |   +---+        |
     *                +------------------------+-->|fin| - - - -
     *    |         +---+                      |   +---+
     *     - - - - -|fin|<---------------------+
     *              +---+
     *
     * @param {Number} [code] Status code explaining why the connection is closing
     * @param {(String|Buffer)} [data] The reason why the connection is
     *     closing
     * @public
     */
    close(k, U) {
      if (this.readyState !== $.CLOSED) {
        if (this.readyState === $.CONNECTING) {
          ce(this, this._req, "WebSocket was closed before the connection was established");
          return;
        }
        if (this.readyState === $.CLOSING) {
          this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end();
          return;
        }
        this._readyState = $.CLOSING, this._sender.close(k, U, !this._isServer, (b) => {
          b || (this._closeFrameSent = !0, (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end());
        }), x(this);
      }
    }
    /**
     * Pause the socket.
     *
     * @public
     */
    pause() {
      this.readyState === $.CONNECTING || this.readyState === $.CLOSED || (this._paused = !0, this._socket.pause());
    }
    /**
     * Send a ping.
     *
     * @param {*} [data] The data to send
     * @param {Boolean} [mask] Indicates whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when the ping is sent
     * @public
     */
    ping(k, U, b) {
      if (this.readyState === $.CONNECTING)
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      if (typeof k == "function" ? (b = k, k = U = void 0) : typeof U == "function" && (b = U, U = void 0), typeof k == "number" && (k = k.toString()), this.readyState !== $.OPEN) {
        Ce(this, k, b);
        return;
      }
      U === void 0 && (U = !this._isServer), this._sender.ping(k || E, U, b);
    }
    /**
     * Send a pong.
     *
     * @param {*} [data] The data to send
     * @param {Boolean} [mask] Indicates whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when the pong is sent
     * @public
     */
    pong(k, U, b) {
      if (this.readyState === $.CONNECTING)
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      if (typeof k == "function" ? (b = k, k = U = void 0) : typeof U == "function" && (b = U, U = void 0), typeof k == "number" && (k = k.toString()), this.readyState !== $.OPEN) {
        Ce(this, k, b);
        return;
      }
      U === void 0 && (U = !this._isServer), this._sender.pong(k || E, U, b);
    }
    /**
     * Resume the socket.
     *
     * @public
     */
    resume() {
      this.readyState === $.CONNECTING || this.readyState === $.CLOSED || (this._paused = !1, this._receiver._writableState.needDrain || this._socket.resume());
    }
    /**
     * Send a data message.
     *
     * @param {*} data The message to send
     * @param {Object} [options] Options object
     * @param {Boolean} [options.binary] Specifies whether `data` is binary or
     *     text
     * @param {Boolean} [options.compress] Specifies whether or not to compress
     *     `data`
     * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
     *     last one
     * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when data is written out
     * @public
     */
    send(k, U, b) {
      if (this.readyState === $.CONNECTING)
        throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
      if (typeof U == "function" && (b = U, U = {}), typeof k == "number" && (k = k.toString()), this.readyState !== $.OPEN) {
        Ce(this, k, b);
        return;
      }
      const O = {
        binary: typeof k != "string",
        mask: !this._isServer,
        compress: !0,
        fin: !0,
        ...U
      };
      this._extensions[d.extensionName] || (O.compress = !1), this._sender.send(k || E, O, b);
    }
    /**
     * Forcibly close the connection.
     *
     * @public
     */
    terminate() {
      if (this.readyState !== $.CLOSED) {
        if (this.readyState === $.CONNECTING) {
          ce(this, this._req, "WebSocket was closed before the connection was established");
          return;
        }
        this._socket && (this._readyState = $.CLOSING, this._socket.destroy());
      }
    }
  }
  Object.defineProperty($, "CONNECTING", {
    enumerable: !0,
    value: J.indexOf("CONNECTING")
  }), Object.defineProperty($.prototype, "CONNECTING", {
    enumerable: !0,
    value: J.indexOf("CONNECTING")
  }), Object.defineProperty($, "OPEN", {
    enumerable: !0,
    value: J.indexOf("OPEN")
  }), Object.defineProperty($.prototype, "OPEN", {
    enumerable: !0,
    value: J.indexOf("OPEN")
  }), Object.defineProperty($, "CLOSING", {
    enumerable: !0,
    value: J.indexOf("CLOSING")
  }), Object.defineProperty($.prototype, "CLOSING", {
    enumerable: !0,
    value: J.indexOf("CLOSING")
  }), Object.defineProperty($, "CLOSED", {
    enumerable: !0,
    value: J.indexOf("CLOSED")
  }), Object.defineProperty($.prototype, "CLOSED", {
    enumerable: !0,
    value: J.indexOf("CLOSED")
  }), [
    "binaryType",
    "bufferedAmount",
    "extensions",
    "isPaused",
    "protocol",
    "readyState",
    "url"
  ].forEach((A) => {
    Object.defineProperty($.prototype, A, { enumerable: !0 });
  }), ["open", "error", "close", "message"].forEach((A) => {
    Object.defineProperty($.prototype, `on${A}`, {
      enumerable: !0,
      get() {
        for (const k of this.listeners(A))
          if (k[C]) return k[w];
        return null;
      },
      set(k) {
        for (const U of this.listeners(A))
          if (U[C]) {
            this.removeListener(A, U);
            break;
          }
        typeof k == "function" && this.addEventListener(A, k, {
          [C]: !0
        });
      }
    });
  }), $.prototype.addEventListener = S, $.prototype.removeEventListener = R, vi = $;
  function X(A, k, U, b) {
    const O = {
      allowSynchronousEvents: !0,
      autoPong: !0,
      closeTimeout: v,
      protocolVersion: q[1],
      maxPayload: 104857600,
      skipUTF8Validation: !1,
      perMessageDeflate: !0,
      followRedirects: !1,
      maxRedirects: 10,
      ...b,
      socketPath: void 0,
      hostname: void 0,
      protocol: void 0,
      timeout: void 0,
      method: "GET",
      host: void 0,
      path: void 0,
      port: void 0
    };
    if (A._autoPong = O.autoPong, A._closeTimeout = O.closeTimeout, !q.includes(O.protocolVersion))
      throw new RangeError(
        `Unsupported protocol version: ${O.protocolVersion} (supported versions: ${q.join(", ")})`
      );
    let Y;
    if (k instanceof c)
      Y = k;
    else
      try {
        Y = new c(k);
      } catch {
        throw new SyntaxError(`Invalid URL: ${k}`);
      }
    Y.protocol === "http:" ? Y.protocol = "ws:" : Y.protocol === "https:" && (Y.protocol = "wss:"), A._url = Y.href;
    const Q = Y.protocol === "wss:", ee = Y.protocol === "ws+unix:";
    let se;
    if (Y.protocol !== "ws:" && !Q && !ee ? se = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"` : ee && !Y.pathname ? se = "The URL's pathname is empty" : Y.hash && (se = "The URL contains a fragment identifier"), se) {
      const ne = new SyntaxError(se);
      if (A._redirects === 0)
        throw ne;
      Z(A, ne);
      return;
    }
    const ue = Q ? 443 : 80, te = o(16).toString("base64"), re = Q ? e.request : n.request, fe = /* @__PURE__ */ new Set();
    let be;
    if (O.createConnection = O.createConnection || (Q ? pe : le), O.defaultPort = O.defaultPort || ue, O.port = Y.port || ue, O.host = Y.hostname.startsWith("[") ? Y.hostname.slice(1, -1) : Y.hostname, O.headers = {
      ...O.headers,
      "Sec-WebSocket-Version": O.protocolVersion,
      "Sec-WebSocket-Key": te,
      Connection: "Upgrade",
      Upgrade: "websocket"
    }, O.path = Y.pathname + Y.search, O.timeout = O.handshakeTimeout, O.perMessageDeflate && (be = new d(
      O.perMessageDeflate !== !0 ? O.perMessageDeflate : {},
      !1,
      O.maxPayload
    ), O.headers["Sec-WebSocket-Extensions"] = P({
      [d.extensionName]: be.offer()
    })), U.length) {
      for (const ne of U) {
        if (typeof ne != "string" || !W.test(ne) || fe.has(ne))
          throw new SyntaxError(
            "An invalid or duplicated subprotocol was specified"
          );
        fe.add(ne);
      }
      O.headers["Sec-WebSocket-Protocol"] = U.join(",");
    }
    if (O.origin && (O.protocolVersion < 13 ? O.headers["Sec-WebSocket-Origin"] = O.origin : O.headers.Origin = O.origin), (Y.username || Y.password) && (O.auth = `${Y.username}:${Y.password}`), ee) {
      const ne = O.path.split(":");
      O.socketPath = ne[0], O.path = ne[1];
    }
    let de;
    if (O.followRedirects) {
      if (A._redirects === 0) {
        A._originalIpc = ee, A._originalSecure = Q, A._originalHostOrSocketPath = ee ? O.socketPath : Y.host;
        const ne = b && b.headers;
        if (b = { ...b, headers: {} }, ne)
          for (const [ae, Ie] of Object.entries(ne))
            b.headers[ae.toLowerCase()] = Ie;
      } else if (A.listenerCount("redirect") === 0) {
        const ne = ee ? A._originalIpc ? O.socketPath === A._originalHostOrSocketPath : !1 : A._originalIpc ? !1 : Y.host === A._originalHostOrSocketPath;
        (!ne || A._originalSecure && !Q) && (delete O.headers.authorization, delete O.headers.cookie, ne || delete O.headers.host, O.auth = void 0);
      }
      O.auth && !b.headers.authorization && (b.headers.authorization = "Basic " + Buffer.from(O.auth).toString("base64")), de = A._req = re(O), A._redirects && A.emit("redirect", A.url, de);
    } else
      de = A._req = re(O);
    O.timeout && de.on("timeout", () => {
      ce(A, de, "Opening handshake has timed out");
    }), de.on("error", (ne) => {
      de === null || de[V] || (de = A._req = null, Z(A, ne));
    }), de.on("response", (ne) => {
      const ae = ne.headers.location, Ie = ne.statusCode;
      if (ae && O.followRedirects && Ie >= 300 && Ie < 400) {
        if (++A._redirects > O.maxRedirects) {
          ce(A, de, "Maximum redirects exceeded");
          return;
        }
        de.abort();
        let me;
        try {
          me = new c(ae, k);
        } catch {
          const oe = new SyntaxError(`Invalid URL: ${ae}`);
          Z(A, oe);
          return;
        }
        X(A, me, U, b);
      } else A.emit("unexpected-response", de, ne) || ce(
        A,
        de,
        `Unexpected server response: ${ne.statusCode}`
      );
    }), de.on("upgrade", (ne, ae, Ie) => {
      if (A.emit("upgrade", ne), A.readyState !== $.CONNECTING) return;
      de = A._req = null;
      const me = ne.headers.upgrade;
      if (me === void 0 || me.toLowerCase() !== "websocket") {
        ce(A, ae, "Invalid Upgrade header");
        return;
      }
      const ge = a("sha1").update(te + T).digest("base64");
      if (ne.headers["sec-websocket-accept"] !== ge) {
        ce(A, ae, "Invalid Sec-WebSocket-Accept header");
        return;
      }
      const oe = ne.headers["sec-websocket-protocol"];
      let At;
      if (oe !== void 0 ? fe.size ? fe.has(oe) || (At = "Server sent an invalid subprotocol") : At = "Server sent a subprotocol but none was requested" : fe.size && (At = "Server sent no subprotocol"), At) {
        ce(A, ae, At);
        return;
      }
      oe && (A._protocol = oe);
      const tr = ne.headers["sec-websocket-extensions"];
      if (tr !== void 0) {
        if (!be) {
          ce(A, ae, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
          return;
        }
        let Hn;
        try {
          Hn = N(tr);
        } catch {
          ce(A, ae, "Invalid Sec-WebSocket-Extensions header");
          return;
        }
        const nr = Object.keys(Hn);
        if (nr.length !== 1 || nr[0] !== d.extensionName) {
          ce(A, ae, "Server indicated an extension that was not requested");
          return;
        }
        try {
          be.accept(Hn[d.extensionName]);
        } catch {
          ce(A, ae, "Invalid Sec-WebSocket-Extensions header");
          return;
        }
        A._extensions[d.extensionName] = be;
      }
      A.setSocket(ae, Ie, {
        allowSynchronousEvents: O.allowSynchronousEvents,
        generateMask: O.generateMask,
        maxPayload: O.maxPayload,
        skipUTF8Validation: O.skipUTF8Validation
      });
    }), O.finishRequest ? O.finishRequest(de, A) : de.end();
  }
  function Z(A, k) {
    A._readyState = $.CLOSING, A._errorEmitted = !0, A.emit("error", k), A.emitClose();
  }
  function le(A) {
    return A.path = A.socketPath, i.connect(A);
  }
  function pe(A) {
    return A.path = void 0, !A.servername && A.servername !== "" && (A.servername = i.isIP(A.host) ? "" : A.host), r.connect(A);
  }
  function ce(A, k, U) {
    A._readyState = $.CLOSING;
    const b = new Error(U);
    Error.captureStackTrace(b, ce), k.setHeader ? (k[V] = !0, k.abort(), k.socket && !k.socket.destroyed && k.socket.destroy(), process.nextTick(Z, A, b)) : (k.destroy(b), k.once("error", A.emit.bind(A, "error")), k.once("close", A.emitClose.bind(A)));
  }
  function Ce(A, k, U) {
    if (k) {
      const b = m(k) ? k.size : G(k).length;
      A._socket ? A._sender._bufferedBytes += b : A._bufferedAmount += b;
    }
    if (U) {
      const b = new Error(
        `WebSocket is not open: readyState ${A.readyState} (${J[A.readyState]})`
      );
      process.nextTick(U, b);
    }
  }
  function Et(A, k) {
    const U = this[_];
    U._closeFrameReceived = !0, U._closeMessage = k, U._closeCode = A, U._socket[_] !== void 0 && (U._socket.removeListener("data", L), process.nextTick(I, U._socket), A === 1005 ? U.close() : U.close(A, k));
  }
  function K() {
    const A = this[_];
    A.isPaused || A._socket.resume();
  }
  function Tt(A) {
    const k = this[_];
    k._socket[_] !== void 0 && (k._socket.removeListener("data", L), process.nextTick(I, k._socket), k.close(A[D])), k._errorEmitted || (k._errorEmitted = !0, k.emit("error", A));
  }
  function St() {
    this[_].emitClose();
  }
  function Ct(A, k) {
    this[_].emit("message", A, k);
  }
  function Se(A) {
    const k = this[_];
    k._autoPong && k.pong(A, !this._isServer, y), k.emit("ping", A);
  }
  function Ne(A) {
    this[_].emit("pong", A);
  }
  function I(A) {
    A.resume();
  }
  function M(A) {
    const k = this[_];
    k.readyState !== $.CLOSED && (k.readyState === $.OPEN && (k._readyState = $.CLOSING, x(k)), this._socket.end(), k._errorEmitted || (k._errorEmitted = !0, k.emit("error", A)));
  }
  function x(A) {
    A._closeTimer = setTimeout(
      A._socket.destroy.bind(A._socket),
      A._closeTimeout
    );
  }
  function B() {
    const A = this[_];
    if (this.removeListener("close", B), this.removeListener("data", L), this.removeListener("end", F), A._readyState = $.CLOSING, !this._readableState.endEmitted && !A._closeFrameReceived && !A._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
      const k = this.read(this._readableState.length);
      A._receiver.write(k);
    }
    A._receiver.end(), this[_] = void 0, clearTimeout(A._closeTimer), A._receiver._writableState.finished || A._receiver._writableState.errorEmitted ? A.emitClose() : (A._receiver.on("error", St), A._receiver.on("finish", St));
  }
  function L(A) {
    this[_]._receiver.write(A) || this.pause();
  }
  function F() {
    const A = this[_];
    A._readyState = $.CLOSING, A._receiver.end(), this.end();
  }
  function H() {
    const A = this[_];
    this.removeListener("error", H), this.on("error", y), A && (A._readyState = $.CLOSING, this.destroy());
  }
  return vi;
}
var Ei, Oo;
function bu() {
  if (Oo) return Ei;
  Oo = 1, Ji();
  const { Duplex: t } = we;
  function e(o) {
    o.emit("close");
  }
  function n() {
    !this.destroyed && this._writableState.finished && this.destroy();
  }
  function i(o) {
    this.removeListener("error", i), this.destroy(), this.listenerCount("error") === 0 && this.emit("error", o);
  }
  function r(o, a) {
    let l = !0;
    const f = new t({
      ...a,
      autoDestroy: !1,
      emitClose: !1,
      objectMode: !1,
      writableObjectMode: !1
    });
    return o.on("message", function(d, p) {
      const h = !p && f._readableState.objectMode ? d.toString() : d;
      f.push(h) || o.pause();
    }), o.once("error", function(d) {
      f.destroyed || (l = !1, f.destroy(d));
    }), o.once("close", function() {
      f.destroyed || f.push(null);
    }), f._destroy = function(c, d) {
      if (o.readyState === o.CLOSED) {
        d(c), process.nextTick(e, f);
        return;
      }
      let p = !1;
      o.once("error", function(m) {
        p = !0, d(m);
      }), o.once("close", function() {
        p || d(c), process.nextTick(e, f);
      }), l && o.terminate();
    }, f._final = function(c) {
      if (o.readyState === o.CONNECTING) {
        o.once("open", function() {
          f._final(c);
        });
        return;
      }
      o._socket !== null && (o._socket._writableState.finished ? (c(), f._readableState.endEmitted && f.destroy()) : (o._socket.once("finish", function() {
        c();
      }), o.close()));
    }, f._read = function() {
      o.isPaused && o.resume();
    }, f._write = function(c, d, p) {
      if (o.readyState === o.CONNECTING) {
        o.once("open", function() {
          f._write(c, d, p);
        });
        return;
      }
      o.send(c, p);
    }, f.on("end", n), f.on("error", i), f;
  }
  return Ei = r, Ei;
}
bu();
nl();
il();
var Lu = Ji();
const Ou = /* @__PURE__ */ Sa(Lu);
var Ti, Fo;
function Fu() {
  if (Fo) return Ti;
  Fo = 1;
  const { tokenChars: t } = cn();
  function e(n) {
    const i = /* @__PURE__ */ new Set();
    let r = -1, o = -1, a = 0;
    for (a; a < n.length; a++) {
      const f = n.charCodeAt(a);
      if (o === -1 && t[f] === 1)
        r === -1 && (r = a);
      else if (a !== 0 && (f === 32 || f === 9))
        o === -1 && r !== -1 && (o = a);
      else if (f === 44) {
        if (r === -1)
          throw new SyntaxError(`Unexpected character at index ${a}`);
        o === -1 && (o = a);
        const c = n.slice(r, o);
        if (i.has(c))
          throw new SyntaxError(`The "${c}" subprotocol is duplicated`);
        i.add(c), r = o = -1;
      } else
        throw new SyntaxError(`Unexpected character at index ${a}`);
    }
    if (r === -1 || o !== -1)
      throw new SyntaxError("Unexpected end of input");
    const l = n.slice(r, a);
    if (i.has(l))
      throw new SyntaxError(`The "${l}" subprotocol is duplicated`);
    return i.add(l), i;
  }
  return Ti = { parse: e }, Ti;
}
var Si, Go;
function Gu() {
  if (Go) return Si;
  Go = 1;
  const t = kn, e = Aa, { Duplex: n } = we, { createHash: i } = mt, r = rl(), o = Un(), a = Fu(), l = Ji(), { CLOSE_TIMEOUT: f, GUID: c, kWebSocket: d } = We(), p = /^[+/0-9A-Za-z]{22}==$/, h = 0, m = 1, g = 2;
  class v extends t {
    /**
     * Create a `WebSocketServer` instance.
     *
     * @param {Object} options Configuration options
     * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
     *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
     *     multiple times in the same tick
     * @param {Boolean} [options.autoPong=true] Specifies whether or not to
     *     automatically send a pong in response to a ping
     * @param {Number} [options.backlog=511] The maximum length of the queue of
     *     pending connections
     * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
     *     track clients
     * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
     *     wait for the closing handshake to finish after `websocket.close()` is
     *     called
     * @param {Function} [options.handleProtocols] A hook to handle protocols
     * @param {String} [options.host] The hostname where to bind the server
     * @param {Number} [options.maxPayload=104857600] The maximum allowed message
     *     size
     * @param {Boolean} [options.noServer=false] Enable no server mode
     * @param {String} [options.path] Accept only connections matching this path
     * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
     *     permessage-deflate
     * @param {Number} [options.port] The port where to bind the server
     * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
     *     server to use
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     * @param {Function} [options.verifyClient] A hook to reject connections
     * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
     *     class to use. It must be the `WebSocket` class or class that extends it
     * @param {Function} [callback] A listener for the `listening` event
     */
    constructor(y, S) {
      if (super(), y = {
        allowSynchronousEvents: !0,
        autoPong: !0,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: !1,
        perMessageDeflate: !1,
        handleProtocols: null,
        clientTracking: !0,
        closeTimeout: f,
        verifyClient: null,
        noServer: !1,
        backlog: null,
        // use default (511 as implemented in net.js)
        server: null,
        host: null,
        path: null,
        port: null,
        WebSocket: l,
        ...y
      }, y.port == null && !y.server && !y.noServer || y.port != null && (y.server || y.noServer) || y.server && y.noServer)
        throw new TypeError(
          'One and only one of the "port", "server", or "noServer" options must be specified'
        );
      if (y.port != null ? (this._server = e.createServer((R, P) => {
        const N = e.STATUS_CODES[426];
        P.writeHead(426, {
          "Content-Length": N.length,
          "Content-Type": "text/plain"
        }), P.end(N);
      }), this._server.listen(
        y.port,
        y.host,
        y.backlog,
        S
      )) : y.server && (this._server = y.server), this._server) {
        const R = this.emit.bind(this, "connection");
        this._removeListeners = E(this._server, {
          listening: this.emit.bind(this, "listening"),
          error: this.emit.bind(this, "error"),
          upgrade: (P, N, G) => {
            this.handleUpgrade(P, N, G, R);
          }
        });
      }
      y.perMessageDeflate === !0 && (y.perMessageDeflate = {}), y.clientTracking && (this.clients = /* @__PURE__ */ new Set(), this._shouldEmitClose = !1), this.options = y, this._state = h;
    }
    /**
     * Returns the bound address, the address family name, and port of the server
     * as reported by the operating system if listening on an IP socket.
     * If the server is listening on a pipe or UNIX domain socket, the name is
     * returned as a string.
     *
     * @return {(Object|String|null)} The address of the server
     * @public
     */
    address() {
      if (this.options.noServer)
        throw new Error('The server is operating in "noServer" mode');
      return this._server ? this._server.address() : null;
    }
    /**
     * Stop the server from accepting new connections and emit the `'close'` event
     * when all existing connections are closed.
     *
     * @param {Function} [cb] A one-time listener for the `'close'` event
     * @public
     */
    close(y) {
      if (this._state === g) {
        y && this.once("close", () => {
          y(new Error("The server is not running"));
        }), process.nextTick(T, this);
        return;
      }
      if (y && this.once("close", y), this._state !== m)
        if (this._state = m, this.options.noServer || this.options.server)
          this._server && (this._removeListeners(), this._removeListeners = this._server = null), this.clients ? this.clients.size ? this._shouldEmitClose = !0 : process.nextTick(T, this) : process.nextTick(T, this);
        else {
          const S = this._server;
          this._removeListeners(), this._removeListeners = this._server = null, S.close(() => {
            T(this);
          });
        }
    }
    /**
     * See if a given request should be handled by this server instance.
     *
     * @param {http.IncomingMessage} req Request object to inspect
     * @return {Boolean} `true` if the request is valid, else `false`
     * @public
     */
    shouldHandle(y) {
      if (this.options.path) {
        const S = y.url.indexOf("?");
        if ((S !== -1 ? y.url.slice(0, S) : y.url) !== this.options.path) return !1;
      }
      return !0;
    }
    /**
     * Handle a HTTP Upgrade request.
     *
     * @param {http.IncomingMessage} req The request object
     * @param {Duplex} socket The network socket between the server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Function} cb Callback
     * @public
     */
    handleUpgrade(y, S, R, P) {
      S.on("error", C);
      const N = y.headers["sec-websocket-key"], G = y.headers.upgrade, V = +y.headers["sec-websocket-version"];
      if (y.method !== "GET") {
        D(this, y, S, 405, "Invalid HTTP method");
        return;
      }
      if (G === void 0 || G.toLowerCase() !== "websocket") {
        D(this, y, S, 400, "Invalid Upgrade header");
        return;
      }
      if (N === void 0 || !p.test(N)) {
        D(this, y, S, 400, "Missing or invalid Sec-WebSocket-Key header");
        return;
      }
      if (V !== 13 && V !== 8) {
        D(this, y, S, 400, "Missing or invalid Sec-WebSocket-Version header", {
          "Sec-WebSocket-Version": "13, 8"
        });
        return;
      }
      if (!this.shouldHandle(y)) {
        w(S, 400);
        return;
      }
      const q = y.headers["sec-websocket-protocol"];
      let J = /* @__PURE__ */ new Set();
      if (q !== void 0)
        try {
          J = a.parse(q);
        } catch {
          D(this, y, S, 400, "Invalid Sec-WebSocket-Protocol header");
          return;
        }
      const W = y.headers["sec-websocket-extensions"], $ = {};
      if (this.options.perMessageDeflate && W !== void 0) {
        const X = new o(
          this.options.perMessageDeflate,
          !0,
          this.options.maxPayload
        );
        try {
          const Z = r.parse(W);
          Z[o.extensionName] && (X.accept(Z[o.extensionName]), $[o.extensionName] = X);
        } catch {
          D(this, y, S, 400, "Invalid or unacceptable Sec-WebSocket-Extensions header");
          return;
        }
      }
      if (this.options.verifyClient) {
        const X = {
          origin: y.headers[`${V === 8 ? "sec-websocket-origin" : "origin"}`],
          secure: !!(y.socket.authorized || y.socket.encrypted),
          req: y
        };
        if (this.options.verifyClient.length === 2) {
          this.options.verifyClient(X, (Z, le, pe, ce) => {
            if (!Z)
              return w(S, le || 401, pe, ce);
            this.completeUpgrade(
              $,
              N,
              J,
              y,
              S,
              R,
              P
            );
          });
          return;
        }
        if (!this.options.verifyClient(X)) return w(S, 401);
      }
      this.completeUpgrade($, N, J, y, S, R, P);
    }
    /**
     * Upgrade the connection to WebSocket.
     *
     * @param {Object} extensions The accepted extensions
     * @param {String} key The value of the `Sec-WebSocket-Key` header
     * @param {Set} protocols The subprotocols
     * @param {http.IncomingMessage} req The request object
     * @param {Duplex} socket The network socket between the server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Function} cb Callback
     * @throws {Error} If called more than once with the same socket
     * @private
     */
    completeUpgrade(y, S, R, P, N, G, V) {
      if (!N.readable || !N.writable) return N.destroy();
      if (N[d])
        throw new Error(
          "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
        );
      if (this._state > h) return w(N, 503);
      const J = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${i("sha1").update(S + c).digest("base64")}`
      ], W = new this.options.WebSocket(null, void 0, this.options);
      if (R.size) {
        const $ = this.options.handleProtocols ? this.options.handleProtocols(R, P) : R.values().next().value;
        $ && (J.push(`Sec-WebSocket-Protocol: ${$}`), W._protocol = $);
      }
      if (y[o.extensionName]) {
        const $ = y[o.extensionName].params, X = r.format({
          [o.extensionName]: [$]
        });
        J.push(`Sec-WebSocket-Extensions: ${X}`), W._extensions = y;
      }
      this.emit("headers", J, P), N.write(J.concat(`\r
`).join(`\r
`)), N.removeListener("error", C), W.setSocket(N, G, {
        allowSynchronousEvents: this.options.allowSynchronousEvents,
        maxPayload: this.options.maxPayload,
        skipUTF8Validation: this.options.skipUTF8Validation
      }), this.clients && (this.clients.add(W), W.on("close", () => {
        this.clients.delete(W), this._shouldEmitClose && !this.clients.size && process.nextTick(T, this);
      })), V(W, P);
    }
  }
  Si = v;
  function E(_, y) {
    for (const S of Object.keys(y)) _.on(S, y[S]);
    return function() {
      for (const R of Object.keys(y))
        _.removeListener(R, y[R]);
    };
  }
  function T(_) {
    _._state = g, _.emit("close");
  }
  function C() {
    this.destroy();
  }
  function w(_, y, S, R) {
    S = S || e.STATUS_CODES[y], R = {
      Connection: "close",
      "Content-Type": "text/html",
      "Content-Length": Buffer.byteLength(S),
      ...R
    }, _.once("finish", _.destroy), _.end(
      `HTTP/1.1 ${y} ${e.STATUS_CODES[y]}\r
` + Object.keys(R).map((P) => `${P}: ${R[P]}`).join(`\r
`) + `\r
\r
` + S
    );
  }
  function D(_, y, S, R, P, N) {
    if (_.listenerCount("wsClientError")) {
      const G = new Error(P);
      Error.captureStackTrace(G, D), _.emit("wsClientError", G, S, y);
    } else
      w(S, R, P, N);
  }
  return Si;
}
Gu();
let ol, sl;
function S_(t) {
  ol = t.geminiUrl, sl = t.vertexUrl;
}
function qu() {
  return {
    geminiUrl: ol,
    vertexUrl: sl
  };
}
function Bu(t, e, n, i) {
  var r, o;
  if (!t?.baseUrl) {
    const a = qu();
    return e ? (r = a.vertexUrl) !== null && r !== void 0 ? r : n : (o = a.geminiUrl) !== null && o !== void 0 ? o : i;
  }
  return t.baseUrl;
}
class He {
}
function z(t, e) {
  const n = /\{([^}]+)\}/g;
  return t.replace(n, (i, r) => {
    if (Object.prototype.hasOwnProperty.call(e, r)) {
      const o = e[r];
      return o != null ? String(o) : "";
    } else
      throw new Error(`Key '${r}' not found in valueMap.`);
  });
}
function u(t, e, n) {
  for (let o = 0; o < e.length - 1; o++) {
    const a = e[o];
    if (a.endsWith("[]")) {
      const l = a.slice(0, -2);
      if (!(l in t))
        if (Array.isArray(n))
          t[l] = Array.from({ length: n.length }, () => ({}));
        else
          throw new Error(`Value must be a list given an array path ${a}`);
      if (Array.isArray(t[l])) {
        const f = t[l];
        if (Array.isArray(n))
          for (let c = 0; c < f.length; c++) {
            const d = f[c];
            u(d, e.slice(o + 1), n[c]);
          }
        else
          for (const c of f)
            u(c, e.slice(o + 1), n);
      }
      return;
    } else if (a.endsWith("[0]")) {
      const l = a.slice(0, -3);
      l in t || (t[l] = [{}]);
      const f = t[l];
      u(f[0], e.slice(o + 1), n);
      return;
    }
    (!t[a] || typeof t[a] != "object") && (t[a] = {}), t = t[a];
  }
  const i = e[e.length - 1], r = t[i];
  if (r !== void 0) {
    if (!n || typeof n == "object" && Object.keys(n).length === 0 || n === r)
      return;
    if (typeof r == "object" && typeof n == "object" && r !== null && n !== null)
      Object.assign(r, n);
    else
      throw new Error(`Cannot set value for an existing key. Key: ${i}`);
  } else
    i === "_self" && typeof n == "object" && n !== null && !Array.isArray(n) ? Object.assign(t, n) : t[i] = n;
}
function s(t, e, n = void 0) {
  try {
    if (e.length === 1 && e[0] === "_self")
      return t;
    for (let i = 0; i < e.length; i++) {
      if (typeof t != "object" || t === null)
        return n;
      const r = e[i];
      if (r.endsWith("[]")) {
        const o = r.slice(0, -2);
        if (o in t) {
          const a = t[o];
          return Array.isArray(a) ? a.map((l) => s(l, e.slice(i + 1), n)) : n;
        } else
          return n;
      } else
        t = t[r];
    }
    return t;
  } catch (i) {
    if (i instanceof TypeError)
      return n;
    throw i;
  }
}
function Hu(t, e) {
  for (const [n, i] of Object.entries(e)) {
    const r = n.split("."), o = i.split("."), a = /* @__PURE__ */ new Set();
    let l = -1;
    for (let f = 0; f < r.length; f++)
      if (r[f] === "*") {
        l = f;
        break;
      }
    if (l !== -1 && o.length > l)
      for (let f = l; f < o.length; f++) {
        const c = o[f];
        c !== "*" && !c.endsWith("[]") && !c.endsWith("[0]") && a.add(c);
      }
    Ii(t, r, o, 0, a);
  }
}
function Ii(t, e, n, i, r) {
  if (i >= e.length || typeof t != "object" || t === null)
    return;
  const o = e[i];
  if (o.endsWith("[]")) {
    const a = o.slice(0, -2), l = t;
    if (a in l && Array.isArray(l[a]))
      for (const f of l[a])
        Ii(f, e, n, i + 1, r);
  } else if (o === "*") {
    if (typeof t == "object" && t !== null && !Array.isArray(t)) {
      const a = t, l = Object.keys(a).filter((c) => !c.startsWith("_") && !r.has(c)), f = {};
      for (const c of l)
        f[c] = a[c];
      for (const [c, d] of Object.entries(f)) {
        const p = [];
        for (const h of n.slice(i))
          h === "*" ? p.push(c) : p.push(h);
        u(a, p, d);
      }
      for (const c of l)
        delete a[c];
    }
  } else {
    const a = t;
    o in a && Ii(a[o], e, n, i + 1, r);
  }
}
function $i(t) {
  if (typeof t != "string")
    throw new Error("fromImageBytes must be a string");
  return t;
}
function Vu(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  n != null && u(e, ["operationName"], n);
  const i = s(t, ["resourceName"]);
  return i != null && u(e, ["_url", "resourceName"], i), e;
}
function Ju(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, [
    "response",
    "generateVideoResponse"
  ]);
  return a != null && u(e, ["response"], Wu(a)), e;
}
function $u(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, ["response"]);
  return a != null && u(e, ["response"], Ku(a)), e;
}
function Wu(t) {
  const e = {}, n = s(t, [
    "generatedSamples"
  ]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((a) => Yu(a))), u(e, ["generatedVideos"], o);
  }
  const i = s(t, [
    "raiMediaFilteredCount"
  ]);
  i != null && u(e, ["raiMediaFilteredCount"], i);
  const r = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && u(e, ["raiMediaFilteredReasons"], r), e;
}
function Ku(t) {
  const e = {}, n = s(t, ["videos"]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((a) => zu(a))), u(e, ["generatedVideos"], o);
  }
  const i = s(t, [
    "raiMediaFilteredCount"
  ]);
  i != null && u(e, ["raiMediaFilteredCount"], i);
  const r = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return r != null && u(e, ["raiMediaFilteredReasons"], r), e;
}
function Yu(t) {
  const e = {}, n = s(t, ["video"]);
  return n != null && u(e, ["video"], tf(n)), e;
}
function zu(t) {
  const e = {}, n = s(t, ["_self"]);
  return n != null && u(e, ["video"], nf(n)), e;
}
function Xu(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && u(e, ["_url", "operationName"], n), e;
}
function Qu(t) {
  const e = {}, n = s(t, [
    "operationName"
  ]);
  return n != null && u(e, ["_url", "operationName"], n), e;
}
function Zu(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, ["response"]);
  return a != null && u(e, ["response"], ju(a)), e;
}
function ju(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["parent"]);
  i != null && u(e, ["parent"], i);
  const r = s(t, ["documentName"]);
  return r != null && u(e, ["documentName"], r), e;
}
function Wi(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, ["response"]);
  return a != null && u(e, ["response"], ef(a)), e;
}
function ef(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["parent"]);
  i != null && u(e, ["parent"], i);
  const r = s(t, ["documentName"]);
  return r != null && u(e, ["documentName"], r), e;
}
function tf(t) {
  const e = {}, n = s(t, ["uri"]);
  n != null && u(e, ["uri"], n);
  const i = s(t, ["encodedVideo"]);
  i != null && u(e, ["videoBytes"], $i(i));
  const r = s(t, ["encoding"]);
  return r != null && u(e, ["mimeType"], r), e;
}
function nf(t) {
  const e = {}, n = s(t, ["gcsUri"]);
  n != null && u(e, ["uri"], n);
  const i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && u(e, ["videoBytes"], $i(i));
  const r = s(t, ["mimeType"]);
  return r != null && u(e, ["mimeType"], r), e;
}
var qo;
(function(t) {
  t.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", t.OUTCOME_OK = "OUTCOME_OK", t.OUTCOME_FAILED = "OUTCOME_FAILED", t.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(qo || (qo = {}));
var Bo;
(function(t) {
  t.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", t.PYTHON = "PYTHON";
})(Bo || (Bo = {}));
var Ho;
(function(t) {
  t.SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED", t.SILENT = "SILENT", t.WHEN_IDLE = "WHEN_IDLE", t.INTERRUPT = "INTERRUPT";
})(Ho || (Ho = {}));
var Je;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.STRING = "STRING", t.NUMBER = "NUMBER", t.INTEGER = "INTEGER", t.BOOLEAN = "BOOLEAN", t.ARRAY = "ARRAY", t.OBJECT = "OBJECT", t.NULL = "NULL";
})(Je || (Je = {}));
var Vo;
(function(t) {
  t.PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE", t.BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE", t.BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE", t.BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH";
})(Vo || (Vo = {}));
var Jo;
(function(t) {
  t.AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED", t.NO_AUTH = "NO_AUTH", t.API_KEY_AUTH = "API_KEY_AUTH", t.HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH", t.GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH", t.OAUTH = "OAUTH", t.OIDC_AUTH = "OIDC_AUTH";
})(Jo || (Jo = {}));
var $o;
(function(t) {
  t.HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED", t.HTTP_IN_QUERY = "HTTP_IN_QUERY", t.HTTP_IN_HEADER = "HTTP_IN_HEADER", t.HTTP_IN_PATH = "HTTP_IN_PATH", t.HTTP_IN_BODY = "HTTP_IN_BODY", t.HTTP_IN_COOKIE = "HTTP_IN_COOKIE";
})($o || ($o = {}));
var Wo;
(function(t) {
  t.API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED", t.SIMPLE_SEARCH = "SIMPLE_SEARCH", t.ELASTIC_SEARCH = "ELASTIC_SEARCH";
})(Wo || (Wo = {}));
var Ko;
(function(t) {
  t.UNSPECIFIED = "UNSPECIFIED", t.BLOCKING = "BLOCKING", t.NON_BLOCKING = "NON_BLOCKING";
})(Ko || (Ko = {}));
var Yo;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.MODE_DYNAMIC = "MODE_DYNAMIC";
})(Yo || (Yo = {}));
var zo;
(function(t) {
  t.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", t.AUTO = "AUTO", t.ANY = "ANY", t.NONE = "NONE", t.VALIDATED = "VALIDATED";
})(zo || (zo = {}));
var Xo;
(function(t) {
  t.THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH", t.MINIMAL = "MINIMAL";
})(Xo || (Xo = {}));
var Qo;
(function(t) {
  t.DONT_ALLOW = "DONT_ALLOW", t.ALLOW_ADULT = "ALLOW_ADULT", t.ALLOW_ALL = "ALLOW_ALL";
})(Qo || (Qo = {}));
var Zo;
(function(t) {
  t.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", t.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", t.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", t.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", t.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY", t.HARM_CATEGORY_IMAGE_HATE = "HARM_CATEGORY_IMAGE_HATE", t.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT = "HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT", t.HARM_CATEGORY_IMAGE_HARASSMENT = "HARM_CATEGORY_IMAGE_HARASSMENT", t.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT = "HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT", t.HARM_CATEGORY_JAILBREAK = "HARM_CATEGORY_JAILBREAK";
})(Zo || (Zo = {}));
var jo;
(function(t) {
  t.HARM_BLOCK_METHOD_UNSPECIFIED = "HARM_BLOCK_METHOD_UNSPECIFIED", t.SEVERITY = "SEVERITY", t.PROBABILITY = "PROBABILITY";
})(jo || (jo = {}));
var es;
(function(t) {
  t.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE", t.OFF = "OFF";
})(es || (es = {}));
var ts;
(function(t) {
  t.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", t.STOP = "STOP", t.MAX_TOKENS = "MAX_TOKENS", t.SAFETY = "SAFETY", t.RECITATION = "RECITATION", t.LANGUAGE = "LANGUAGE", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.SPII = "SPII", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", t.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", t.NO_IMAGE = "NO_IMAGE", t.IMAGE_RECITATION = "IMAGE_RECITATION", t.IMAGE_OTHER = "IMAGE_OTHER";
})(ts || (ts = {}));
var ns;
(function(t) {
  t.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", t.NEGLIGIBLE = "NEGLIGIBLE", t.LOW = "LOW", t.MEDIUM = "MEDIUM", t.HIGH = "HIGH";
})(ns || (ns = {}));
var is;
(function(t) {
  t.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", t.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", t.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", t.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", t.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(is || (is = {}));
var rs;
(function(t) {
  t.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", t.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", t.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", t.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", t.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(rs || (rs = {}));
var os;
(function(t) {
  t.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", t.SAFETY = "SAFETY", t.OTHER = "OTHER", t.BLOCKLIST = "BLOCKLIST", t.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", t.IMAGE_SAFETY = "IMAGE_SAFETY", t.MODEL_ARMOR = "MODEL_ARMOR", t.JAILBREAK = "JAILBREAK";
})(os || (os = {}));
var ss;
(function(t) {
  t.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", t.ON_DEMAND = "ON_DEMAND", t.ON_DEMAND_PRIORITY = "ON_DEMAND_PRIORITY", t.ON_DEMAND_FLEX = "ON_DEMAND_FLEX", t.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(ss || (ss = {}));
var An;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.AUDIO = "AUDIO";
})(An || (An = {}));
var as;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH";
})(as || (as = {}));
var ls;
(function(t) {
  t.TUNING_MODE_UNSPECIFIED = "TUNING_MODE_UNSPECIFIED", t.TUNING_MODE_FULL = "TUNING_MODE_FULL", t.TUNING_MODE_PEFT_ADAPTER = "TUNING_MODE_PEFT_ADAPTER";
})(ls || (ls = {}));
var cs;
(function(t) {
  t.ADAPTER_SIZE_UNSPECIFIED = "ADAPTER_SIZE_UNSPECIFIED", t.ADAPTER_SIZE_ONE = "ADAPTER_SIZE_ONE", t.ADAPTER_SIZE_TWO = "ADAPTER_SIZE_TWO", t.ADAPTER_SIZE_FOUR = "ADAPTER_SIZE_FOUR", t.ADAPTER_SIZE_EIGHT = "ADAPTER_SIZE_EIGHT", t.ADAPTER_SIZE_SIXTEEN = "ADAPTER_SIZE_SIXTEEN", t.ADAPTER_SIZE_THIRTY_TWO = "ADAPTER_SIZE_THIRTY_TWO";
})(cs || (cs = {}));
var Ri;
(function(t) {
  t.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", t.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", t.JOB_STATE_PENDING = "JOB_STATE_PENDING", t.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", t.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", t.JOB_STATE_FAILED = "JOB_STATE_FAILED", t.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", t.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", t.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", t.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", t.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", t.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(Ri || (Ri = {}));
var us;
(function(t) {
  t.TUNING_JOB_STATE_UNSPECIFIED = "TUNING_JOB_STATE_UNSPECIFIED", t.TUNING_JOB_STATE_WAITING_FOR_QUOTA = "TUNING_JOB_STATE_WAITING_FOR_QUOTA", t.TUNING_JOB_STATE_PROCESSING_DATASET = "TUNING_JOB_STATE_PROCESSING_DATASET", t.TUNING_JOB_STATE_WAITING_FOR_CAPACITY = "TUNING_JOB_STATE_WAITING_FOR_CAPACITY", t.TUNING_JOB_STATE_TUNING = "TUNING_JOB_STATE_TUNING", t.TUNING_JOB_STATE_POST_PROCESSING = "TUNING_JOB_STATE_POST_PROCESSING";
})(us || (us = {}));
var fs;
(function(t) {
  t.AGGREGATION_METRIC_UNSPECIFIED = "AGGREGATION_METRIC_UNSPECIFIED", t.AVERAGE = "AVERAGE", t.MODE = "MODE", t.STANDARD_DEVIATION = "STANDARD_DEVIATION", t.VARIANCE = "VARIANCE", t.MINIMUM = "MINIMUM", t.MAXIMUM = "MAXIMUM", t.MEDIAN = "MEDIAN", t.PERCENTILE_P90 = "PERCENTILE_P90", t.PERCENTILE_P95 = "PERCENTILE_P95", t.PERCENTILE_P99 = "PERCENTILE_P99";
})(fs || (fs = {}));
var ds;
(function(t) {
  t.PAIRWISE_CHOICE_UNSPECIFIED = "PAIRWISE_CHOICE_UNSPECIFIED", t.BASELINE = "BASELINE", t.CANDIDATE = "CANDIDATE", t.TIE = "TIE";
})(ds || (ds = {}));
var hs;
(function(t) {
  t.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", t.TUNING_TASK_I2V = "TUNING_TASK_I2V", t.TUNING_TASK_T2V = "TUNING_TASK_T2V", t.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(hs || (hs = {}));
var ps;
(function(t) {
  t.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", t.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", t.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", t.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", t.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(ps || (ps = {}));
var Pi;
(function(t) {
  t.COLLECTION = "COLLECTION";
})(Pi || (Pi = {}));
var ms;
(function(t) {
  t.FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED", t.PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY", t.BALANCED = "BALANCED", t.PRIORITIZE_COST = "PRIORITIZE_COST";
})(ms || (ms = {}));
var gs;
(function(t) {
  t.ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED", t.ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER";
})(gs || (gs = {}));
var ys;
(function(t) {
  t.PROMINENT_PEOPLE_UNSPECIFIED = "PROMINENT_PEOPLE_UNSPECIFIED", t.ALLOW_PROMINENT_PEOPLE = "ALLOW_PROMINENT_PEOPLE", t.BLOCK_PROMINENT_PEOPLE = "BLOCK_PROMINENT_PEOPLE";
})(ys || (ys = {}));
var wn;
(function(t) {
  t.PREDICT = "PREDICT", t.EMBED_CONTENT = "EMBED_CONTENT";
})(wn || (wn = {}));
var _s;
(function(t) {
  t.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", t.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", t.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", t.BLOCK_NONE = "BLOCK_NONE";
})(_s || (_s = {}));
var vs;
(function(t) {
  t.auto = "auto", t.en = "en", t.ja = "ja", t.ko = "ko", t.hi = "hi", t.zh = "zh", t.pt = "pt", t.es = "es";
})(vs || (vs = {}));
var Es;
(function(t) {
  t.MASK_MODE_DEFAULT = "MASK_MODE_DEFAULT", t.MASK_MODE_USER_PROVIDED = "MASK_MODE_USER_PROVIDED", t.MASK_MODE_BACKGROUND = "MASK_MODE_BACKGROUND", t.MASK_MODE_FOREGROUND = "MASK_MODE_FOREGROUND", t.MASK_MODE_SEMANTIC = "MASK_MODE_SEMANTIC";
})(Es || (Es = {}));
var Ts;
(function(t) {
  t.CONTROL_TYPE_DEFAULT = "CONTROL_TYPE_DEFAULT", t.CONTROL_TYPE_CANNY = "CONTROL_TYPE_CANNY", t.CONTROL_TYPE_SCRIBBLE = "CONTROL_TYPE_SCRIBBLE", t.CONTROL_TYPE_FACE_MESH = "CONTROL_TYPE_FACE_MESH";
})(Ts || (Ts = {}));
var Ss;
(function(t) {
  t.SUBJECT_TYPE_DEFAULT = "SUBJECT_TYPE_DEFAULT", t.SUBJECT_TYPE_PERSON = "SUBJECT_TYPE_PERSON", t.SUBJECT_TYPE_ANIMAL = "SUBJECT_TYPE_ANIMAL", t.SUBJECT_TYPE_PRODUCT = "SUBJECT_TYPE_PRODUCT";
})(Ss || (Ss = {}));
var Cs;
(function(t) {
  t.EDIT_MODE_DEFAULT = "EDIT_MODE_DEFAULT", t.EDIT_MODE_INPAINT_REMOVAL = "EDIT_MODE_INPAINT_REMOVAL", t.EDIT_MODE_INPAINT_INSERTION = "EDIT_MODE_INPAINT_INSERTION", t.EDIT_MODE_OUTPAINT = "EDIT_MODE_OUTPAINT", t.EDIT_MODE_CONTROLLED_EDITING = "EDIT_MODE_CONTROLLED_EDITING", t.EDIT_MODE_STYLE = "EDIT_MODE_STYLE", t.EDIT_MODE_BGSWAP = "EDIT_MODE_BGSWAP", t.EDIT_MODE_PRODUCT_IMAGE = "EDIT_MODE_PRODUCT_IMAGE";
})(Cs || (Cs = {}));
var As;
(function(t) {
  t.FOREGROUND = "FOREGROUND", t.BACKGROUND = "BACKGROUND", t.PROMPT = "PROMPT", t.SEMANTIC = "SEMANTIC", t.INTERACTIVE = "INTERACTIVE";
})(As || (As = {}));
var ws;
(function(t) {
  t.ASSET = "ASSET", t.STYLE = "STYLE";
})(ws || (ws = {}));
var Is;
(function(t) {
  t.INSERT = "INSERT", t.REMOVE = "REMOVE", t.REMOVE_STATIC = "REMOVE_STATIC", t.OUTPAINT = "OUTPAINT";
})(Is || (Is = {}));
var Rs;
(function(t) {
  t.OPTIMIZED = "OPTIMIZED", t.LOSSLESS = "LOSSLESS";
})(Rs || (Rs = {}));
var Ps;
(function(t) {
  t.SUPERVISED_FINE_TUNING = "SUPERVISED_FINE_TUNING", t.PREFERENCE_TUNING = "PREFERENCE_TUNING", t.DISTILLATION = "DISTILLATION";
})(Ps || (Ps = {}));
var Ns;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.STATE_PENDING = "STATE_PENDING", t.STATE_ACTIVE = "STATE_ACTIVE", t.STATE_FAILED = "STATE_FAILED";
})(Ns || (Ns = {}));
var ks;
(function(t) {
  t.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", t.PROCESSING = "PROCESSING", t.ACTIVE = "ACTIVE", t.FAILED = "FAILED";
})(ks || (ks = {}));
var Ms;
(function(t) {
  t.SOURCE_UNSPECIFIED = "SOURCE_UNSPECIFIED", t.UPLOADED = "UPLOADED", t.GENERATED = "GENERATED", t.REGISTERED = "REGISTERED";
})(Ms || (Ms = {}));
var xs;
(function(t) {
  t.TURN_COMPLETE_REASON_UNSPECIFIED = "TURN_COMPLETE_REASON_UNSPECIFIED", t.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", t.RESPONSE_REJECTED = "RESPONSE_REJECTED", t.NEED_MORE_INPUT = "NEED_MORE_INPUT";
})(xs || (xs = {}));
var Ds;
(function(t) {
  t.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", t.TEXT = "TEXT", t.IMAGE = "IMAGE", t.VIDEO = "VIDEO", t.AUDIO = "AUDIO", t.DOCUMENT = "DOCUMENT";
})(Ds || (Ds = {}));
var Us;
(function(t) {
  t.VAD_SIGNAL_TYPE_UNSPECIFIED = "VAD_SIGNAL_TYPE_UNSPECIFIED", t.VAD_SIGNAL_TYPE_SOS = "VAD_SIGNAL_TYPE_SOS", t.VAD_SIGNAL_TYPE_EOS = "VAD_SIGNAL_TYPE_EOS";
})(Us || (Us = {}));
var bs;
(function(t) {
  t.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", t.ACTIVITY_START = "ACTIVITY_START", t.ACTIVITY_END = "ACTIVITY_END";
})(bs || (bs = {}));
var Ls;
(function(t) {
  t.START_SENSITIVITY_UNSPECIFIED = "START_SENSITIVITY_UNSPECIFIED", t.START_SENSITIVITY_HIGH = "START_SENSITIVITY_HIGH", t.START_SENSITIVITY_LOW = "START_SENSITIVITY_LOW";
})(Ls || (Ls = {}));
var Os;
(function(t) {
  t.END_SENSITIVITY_UNSPECIFIED = "END_SENSITIVITY_UNSPECIFIED", t.END_SENSITIVITY_HIGH = "END_SENSITIVITY_HIGH", t.END_SENSITIVITY_LOW = "END_SENSITIVITY_LOW";
})(Os || (Os = {}));
var Fs;
(function(t) {
  t.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", t.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", t.NO_INTERRUPTION = "NO_INTERRUPTION";
})(Fs || (Fs = {}));
var Gs;
(function(t) {
  t.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", t.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", t.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(Gs || (Gs = {}));
var qs;
(function(t) {
  t.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", t.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", t.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", t.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", t.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", t.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", t.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", t.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", t.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", t.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", t.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", t.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", t.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(qs || (qs = {}));
var Bs;
(function(t) {
  t.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", t.QUALITY = "QUALITY", t.DIVERSITY = "DIVERSITY", t.VOCALIZATION = "VOCALIZATION";
})(Bs || (Bs = {}));
var ft;
(function(t) {
  t.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", t.PLAY = "PLAY", t.PAUSE = "PAUSE", t.STOP = "STOP", t.RESET_CONTEXT = "RESET_CONTEXT";
})(ft || (ft = {}));
class C_ {
}
class A_ {
}
class w_ {
}
function I_(t, e) {
  return {
    inlineData: {
      data: t,
      mimeType: e
    }
  };
}
function R_(t, e) {
  return {
    fileData: {
      fileUri: t,
      mimeType: e
    }
  };
}
class P_ {
}
function N_(t, e, n) {
  return Object.assign({ fileData: {
    fileUri: t,
    mimeType: e
  } }, n && { mediaResolution: { level: n } });
}
function Hs(t) {
  return {
    text: t
  };
}
function k_(t, e) {
  return {
    functionCall: {
      name: t,
      args: e
    }
  };
}
function M_(t, e, n, i = []) {
  return {
    functionResponse: Object.assign({ id: t, name: e, response: n }, i.length > 0 && { parts: i })
  };
}
function x_(t, e, n) {
  return Object.assign({ inlineData: {
    data: t,
    mimeType: e
  } }, n && { mediaResolution: { level: n } });
}
function D_(t, e) {
  return {
    codeExecutionResult: {
      outcome: t,
      output: e
    }
  };
}
function U_(t, e) {
  return {
    executableCode: {
      code: t,
      language: e
    }
  };
}
function Vs(t) {
  return typeof t == "object" && t !== null ? "fileData" in t || "text" in t || "functionCall" in t || "functionResponse" in t || "inlineData" in t || "videoMetadata" in t || "codeExecutionResult" in t || "executableCode" in t : !1;
}
function al(t) {
  const e = [];
  if (typeof t == "string")
    e.push(Hs(t));
  else if (Vs(t))
    e.push(t);
  else if (Array.isArray(t)) {
    if (t.length === 0)
      throw new Error("partOrString cannot be an empty array");
    for (const n of t)
      if (typeof n == "string")
        e.push(Hs(n));
      else if (Vs(n))
        e.push(n);
      else
        throw new Error("element in PartUnion must be a Part object or string");
  } else
    throw new Error("partOrString must be a Part object, string, or array");
  return e;
}
function b_(t) {
  return {
    role: "user",
    parts: al(t)
  };
}
function L_(t) {
  return {
    role: "model",
    parts: al(t)
  };
}
class sn {
  constructor(e) {
    const n = {};
    for (const i of e.headers.entries())
      n[i[0]] = i[1];
    this.headers = n, this.responseInternal = e;
  }
  json() {
    return this.responseInternal.json();
  }
}
class O_ {
}
class F_ {
}
class en {
  /**
   * Returns the concatenation of all text parts from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the text from the first
   * one will be returned.
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   * If there are thought parts in the response, the concatenation of all text
   * parts excluding the thought parts will be returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'Why is the sky blue?',
   * });
   *
   * console.debug(response.text);
   * ```
   */
  get text() {
    var e, n, i, r, o, a, l, f;
    if (((r = (i = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || i === void 0 ? void 0 : i.parts) === null || r === void 0 ? void 0 : r.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning text from the first one.");
    let c = "", d = !1;
    const p = [];
    for (const h of (f = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) !== null && f !== void 0 ? f : []) {
      for (const [m, g] of Object.entries(h))
        m !== "text" && m !== "thought" && m !== "thoughtSignature" && (g !== null || g !== void 0) && p.push(m);
      if (typeof h.text == "string") {
        if (typeof h.thought == "boolean" && h.thought)
          continue;
        d = !0, c += h.text;
      }
    }
    return p.length > 0 && console.warn(`there are non-text parts ${p} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), d ? c : void 0;
  }
  /**
   * Returns the concatenation of all inline data parts from the first candidate
   * in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the inline data from the
   * first one will be returned. If there are non-inline data parts in the
   * response, the concatenation of all inline data parts will be returned, and
   * a warning will be logged.
   */
  get data() {
    var e, n, i, r, o, a, l, f;
    if (((r = (i = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || i === void 0 ? void 0 : i.parts) === null || r === void 0 ? void 0 : r.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning data from the first one.");
    let c = "";
    const d = [];
    for (const p of (f = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) !== null && f !== void 0 ? f : []) {
      for (const [h, m] of Object.entries(p))
        h !== "inlineData" && (m !== null || m !== void 0) && d.push(h);
      p.inlineData && typeof p.inlineData.data == "string" && (c += atob(p.inlineData.data));
    }
    return d.length > 0 && console.warn(`there are non-data parts ${d} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), c.length > 0 ? btoa(c) : void 0;
  }
  /**
   * Returns the function calls from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the function calls from
   * the first one will be returned.
   * If there are no function calls in the response, undefined will be returned.
   *
   * @example
   * ```ts
   * const controlLightFunctionDeclaration: FunctionDeclaration = {
   *   name: 'controlLight',
   *   parameters: {
   *   type: Type.OBJECT,
   *   description: 'Set the brightness and color temperature of a room light.',
   *   properties: {
   *     brightness: {
   *       type: Type.NUMBER,
   *       description:
   *         'Light level from 0 to 100. Zero is off and 100 is full brightness.',
   *     },
   *     colorTemperature: {
   *       type: Type.STRING,
   *       description:
   *         'Color temperature of the light fixture which can be `daylight`, `cool` or `warm`.',
   *     },
   *   },
   *   required: ['brightness', 'colorTemperature'],
   *  };
   *  const response = await ai.models.generateContent({
   *     model: 'gemini-2.0-flash',
   *     contents: 'Dim the lights so the room feels cozy and warm.',
   *     config: {
   *       tools: [{functionDeclarations: [controlLightFunctionDeclaration]}],
   *       toolConfig: {
   *         functionCallingConfig: {
   *           mode: FunctionCallingConfigMode.ANY,
   *           allowedFunctionNames: ['controlLight'],
   *         },
   *       },
   *     },
   *   });
   *  console.debug(JSON.stringify(response.functionCalls));
   * ```
   */
  get functionCalls() {
    var e, n, i, r, o, a, l, f;
    if (((r = (i = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || i === void 0 ? void 0 : i.parts) === null || r === void 0 ? void 0 : r.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning function calls from the first one.");
    const c = (f = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || f === void 0 ? void 0 : f.filter((d) => d.functionCall).map((d) => d.functionCall).filter((d) => d !== void 0);
    if (c?.length !== 0)
      return c;
  }
  /**
   * Returns the first executable code from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the executable code from
   * the first one will be returned.
   * If there are no executable code in the response, undefined will be
   * returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.'
   *   config: {
   *     tools: [{codeExecution: {}}],
   *   },
   * });
   *
   * console.debug(response.executableCode);
   * ```
   */
  get executableCode() {
    var e, n, i, r, o, a, l, f, c;
    if (((r = (i = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || i === void 0 ? void 0 : i.parts) === null || r === void 0 ? void 0 : r.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning executable code from the first one.");
    const d = (f = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || f === void 0 ? void 0 : f.filter((p) => p.executableCode).map((p) => p.executableCode).filter((p) => p !== void 0);
    if (d?.length !== 0)
      return (c = d?.[0]) === null || c === void 0 ? void 0 : c.code;
  }
  /**
   * Returns the first code execution result from the first candidate in the response.
   *
   * @remarks
   * If there are multiple candidates in the response, the code execution result from
   * the first one will be returned.
   * If there are no code execution result in the response, undefined will be returned.
   *
   * @example
   * ```ts
   * const response = await ai.models.generateContent({
   *   model: 'gemini-2.0-flash',
   *   contents:
   *     'What is the sum of the first 50 prime numbers? Generate and run code for the calculation, and make sure you get all 50.'
   *   config: {
   *     tools: [{codeExecution: {}}],
   *   },
   * });
   *
   * console.debug(response.codeExecutionResult);
   * ```
   */
  get codeExecutionResult() {
    var e, n, i, r, o, a, l, f, c;
    if (((r = (i = (n = (e = this.candidates) === null || e === void 0 ? void 0 : e[0]) === null || n === void 0 ? void 0 : n.content) === null || i === void 0 ? void 0 : i.parts) === null || r === void 0 ? void 0 : r.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning code execution result from the first one.");
    const d = (f = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || f === void 0 ? void 0 : f.filter((p) => p.codeExecutionResult).map((p) => p.codeExecutionResult).filter((p) => p !== void 0);
    if (d?.length !== 0)
      return (c = d?.[0]) === null || c === void 0 ? void 0 : c.output;
  }
}
class Js {
}
class $s {
}
class rf {
}
class of {
}
class sf {
}
class af {
}
class Ws {
}
class Ks {
}
class Ys {
}
class lf {
}
class G_ {
}
class In {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const i = new In();
    let r;
    const o = e;
    return n ? r = $u(o) : r = Ju(o), Object.assign(i, r), i;
  }
}
class q_ {
}
class zs {
}
class Xs {
}
class Qs {
}
class Zs {
}
class cf {
}
class uf {
}
class ff {
}
class B_ {
}
class Ki {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const i = new Ki(), o = Zu(e);
    return Object.assign(i, o), i;
  }
}
class df {
}
class hf {
}
class pf {
}
class mf {
}
class H_ {
}
class V_ {
}
class J_ {
}
class js {
}
class $_ {
}
class W_ {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_RAW",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId
    };
  }
}
class K_ {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_MASK",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId,
      maskImageConfig: this.config
    };
  }
}
class Y_ {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_CONTROL",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId,
      controlImageConfig: this.config
    };
  }
}
class z_ {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_STYLE",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId,
      styleImageConfig: this.config
    };
  }
}
class X_ {
  /* Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_SUBJECT",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId,
      subjectImageConfig: this.config
    };
  }
}
class Q_ {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_CONTENT",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId
    };
  }
}
class gf {
  /**
   * Returns the concatenation of all text parts from the server content if present.
   *
   * @remarks
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   */
  get text() {
    var e, n, i;
    let r = "", o = !1;
    const a = [];
    for (const l of (i = (n = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && i !== void 0 ? i : []) {
      for (const [f, c] of Object.entries(l))
        f !== "text" && f !== "thought" && c !== null && a.push(f);
      if (typeof l.text == "string") {
        if (typeof l.thought == "boolean" && l.thought)
          continue;
        o = !0, r += l.text;
      }
    }
    return a.length > 0 && console.warn(`there are non-text parts ${a} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), o ? r : void 0;
  }
  /**
   * Returns the concatenation of all inline data parts from the server content if present.
   *
   * @remarks
   * If there are non-inline data parts in the
   * response, the concatenation of all inline data parts will be returned, and
   * a warning will be logged.
   */
  get data() {
    var e, n, i;
    let r = "";
    const o = [];
    for (const a of (i = (n = (e = this.serverContent) === null || e === void 0 ? void 0 : e.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && i !== void 0 ? i : []) {
      for (const [l, f] of Object.entries(a))
        l !== "inlineData" && f !== null && o.push(l);
      a.inlineData && typeof a.inlineData.data == "string" && (r += atob(a.inlineData.data));
    }
    return o.length > 0 && console.warn(`there are non-data parts ${o} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), r.length > 0 ? btoa(r) : void 0;
  }
}
class Z_ {
}
class j_ {
  constructor() {
    this.functionResponses = [];
  }
}
class yf {
  /**
   * Returns the first audio chunk from the server content, if present.
   *
   * @remarks
   * If there are no audio chunks in the response, undefined will be returned.
   */
  get audioChunk() {
    if (this.serverContent && this.serverContent.audioChunks && this.serverContent.audioChunks.length > 0)
      return this.serverContent.audioChunks[0];
  }
}
class ev {
}
class bn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: e, _isVertexAI: n }) {
    const i = new bn(), o = Wi(e);
    return Object.assign(i, o), i;
  }
}
function ie(t, e) {
  if (!e || typeof e != "string")
    throw new Error("model is required and must be a string");
  if (e.includes("..") || e.includes("?") || e.includes("&"))
    throw new Error("invalid model parameter");
  if (t.isVertexAI()) {
    if (e.startsWith("publishers/") || e.startsWith("projects/") || e.startsWith("models/"))
      return e;
    if (e.indexOf("/") >= 0) {
      const n = e.split("/", 2);
      return `publishers/${n[0]}/models/${n[1]}`;
    } else
      return `publishers/google/models/${e}`;
  } else
    return e.startsWith("models/") || e.startsWith("tunedModels/") ? e : `models/${e}`;
}
function ll(t, e) {
  const n = ie(t, e);
  return n ? n.startsWith("publishers/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}` : n.startsWith("models/") && t.isVertexAI() ? `projects/${t.getProject()}/locations/${t.getLocation()}/publishers/google/${n}` : n : "";
}
function cl(t) {
  return Array.isArray(t) ? t.map((e) => Rn(e)) : [Rn(t)];
}
function Rn(t) {
  if (typeof t == "object" && t !== null)
    return t;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof t}`);
}
function ul(t) {
  const e = Rn(t);
  if (e.mimeType && e.mimeType.startsWith("image/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function fl(t) {
  const e = Rn(t);
  if (e.mimeType && e.mimeType.startsWith("audio/"))
    return e;
  throw new Error(`Unsupported mime type: ${e.mimeType}`);
}
function ea(t) {
  if (t == null)
    throw new Error("PartUnion is required");
  if (typeof t == "object")
    return t;
  if (typeof t == "string")
    return { text: t };
  throw new Error(`Unsupported part type: ${typeof t}`);
}
function dl(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(t) ? t.map((e) => ea(e)) : [ea(t)];
}
function Ni(t) {
  return t != null && typeof t == "object" && "parts" in t && Array.isArray(t.parts);
}
function ta(t) {
  return t != null && typeof t == "object" && "functionCall" in t;
}
function na(t) {
  return t != null && typeof t == "object" && "functionResponse" in t;
}
function ye(t) {
  if (t == null)
    throw new Error("ContentUnion is required");
  return Ni(t) ? t : {
    role: "user",
    parts: dl(t)
  };
}
function Yi(t, e) {
  if (!e)
    return [];
  if (t.isVertexAI() && Array.isArray(e))
    return e.flatMap((n) => {
      const i = ye(n);
      return i.parts && i.parts.length > 0 && i.parts[0].text !== void 0 ? [i.parts[0].text] : [];
    });
  if (t.isVertexAI()) {
    const n = ye(e);
    return n.parts && n.parts.length > 0 && n.parts[0].text !== void 0 ? [n.parts[0].text] : [];
  }
  return Array.isArray(e) ? e.map((n) => ye(n)) : [ye(e)];
}
function Ae(t) {
  if (t == null || Array.isArray(t) && t.length === 0)
    throw new Error("contents are required");
  if (!Array.isArray(t)) {
    if (ta(t) || na(t))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [ye(t)];
  }
  const e = [], n = [], i = Ni(t[0]);
  for (const r of t) {
    const o = Ni(r);
    if (o != i)
      throw new Error("Mixing Content and Parts is not supported, please group the parts into a the appropriate Content objects and specify the roles for them");
    if (o)
      e.push(r);
    else {
      if (ta(r) || na(r))
        throw new Error("To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them");
      n.push(r);
    }
  }
  return i || e.push({ role: "user", parts: dl(n) }), e;
}
function _f(t, e) {
  t.includes("null") && (e.nullable = !0);
  const n = t.filter((i) => i !== "null");
  if (n.length === 1)
    e.type = Object.values(Je).includes(n[0].toUpperCase()) ? n[0].toUpperCase() : Je.TYPE_UNSPECIFIED;
  else {
    e.anyOf = [];
    for (const i of n)
      e.anyOf.push({
        type: Object.values(Je).includes(i.toUpperCase()) ? i.toUpperCase() : Je.TYPE_UNSPECIFIED
      });
  }
}
function ht(t) {
  const e = {}, n = ["items"], i = ["anyOf"], r = ["properties"];
  if (t.type && t.anyOf)
    throw new Error("type and anyOf cannot be both populated.");
  const o = t.anyOf;
  o != null && o.length == 2 && (o[0].type === "null" ? (e.nullable = !0, t = o[1]) : o[1].type === "null" && (e.nullable = !0, t = o[0])), t.type instanceof Array && _f(t.type, e);
  for (const [a, l] of Object.entries(t))
    if (l != null)
      if (a == "type") {
        if (l === "null")
          throw new Error("type: null can not be the only possible type for the field.");
        if (l instanceof Array)
          continue;
        e.type = Object.values(Je).includes(l.toUpperCase()) ? l.toUpperCase() : Je.TYPE_UNSPECIFIED;
      } else if (n.includes(a))
        e[a] = ht(l);
      else if (i.includes(a)) {
        const f = [];
        for (const c of l) {
          if (c.type == "null") {
            e.nullable = !0;
            continue;
          }
          f.push(ht(c));
        }
        e[a] = f;
      } else if (r.includes(a)) {
        const f = {};
        for (const [c, d] of Object.entries(l))
          f[c] = ht(d);
        e[a] = f;
      } else {
        if (a === "additionalProperties")
          continue;
        e[a] = l;
      }
  return e;
}
function zi(t) {
  return ht(t);
}
function Xi(t) {
  if (typeof t == "object")
    return t;
  if (typeof t == "string")
    return {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: t
        }
      }
    };
  throw new Error(`Unsupported speechConfig type: ${typeof t}`);
}
function Qi(t) {
  if ("multiSpeakerVoiceConfig" in t)
    throw new Error("multiSpeakerVoiceConfig is not supported in the live API.");
  return t;
}
function yt(t) {
  if (t.functionDeclarations)
    for (const e of t.functionDeclarations)
      e.parameters && (Object.keys(e.parameters).includes("$schema") ? e.parametersJsonSchema || (e.parametersJsonSchema = e.parameters, delete e.parameters) : e.parameters = ht(e.parameters)), e.response && (Object.keys(e.response).includes("$schema") ? e.responseJsonSchema || (e.responseJsonSchema = e.response, delete e.response) : e.response = ht(e.response));
  return t;
}
function _t(t) {
  if (t == null)
    throw new Error("tools is required");
  if (!Array.isArray(t))
    throw new Error("tools is required and must be an array of Tools");
  const e = [];
  for (const n of t)
    e.push(n);
  return e;
}
function vf(t, e, n, i = 1) {
  const r = !e.startsWith(`${n}/`) && e.split("/").length === i;
  return t.isVertexAI() ? e.startsWith("projects/") ? e : e.startsWith("locations/") ? `projects/${t.getProject()}/${e}` : e.startsWith(`${n}/`) ? `projects/${t.getProject()}/locations/${t.getLocation()}/${e}` : r ? `projects/${t.getProject()}/locations/${t.getLocation()}/${n}/${e}` : e : r ? `${n}/${e}` : e;
}
function Ve(t, e) {
  if (typeof e != "string")
    throw new Error("name must be a string");
  return vf(t, e, "cachedContents");
}
function hl(t) {
  switch (t) {
    case "STATE_UNSPECIFIED":
      return "JOB_STATE_UNSPECIFIED";
    case "CREATING":
      return "JOB_STATE_RUNNING";
    case "ACTIVE":
      return "JOB_STATE_SUCCEEDED";
    case "FAILED":
      return "JOB_STATE_FAILED";
    default:
      return t;
  }
}
function Ke(t) {
  return $i(t);
}
function Ef(t) {
  return t != null && typeof t == "object" && "name" in t;
}
function pl(t) {
  return t != null && typeof t == "object" && "video" in t;
}
function ml(t) {
  return t != null && typeof t == "object" && "uri" in t;
}
function Zi(t) {
  var e;
  let n;
  if (Ef(t) && (n = t.name), !(ml(t) && (n = t.uri, n === void 0)) && !(pl(t) && (n = (e = t.video) === null || e === void 0 ? void 0 : e.uri, n === void 0))) {
    if (typeof t == "string" && (n = t), n === void 0)
      throw new Error("Could not extract file name from the provided input.");
    if (n.startsWith("https://")) {
      const r = n.split("files/")[1].match(/[a-z0-9]+/);
      if (r === null)
        throw new Error(`Could not extract file name from URI ${n}`);
      n = r[0];
    } else n.startsWith("files/") && (n = n.split("files/")[1]);
    return n;
  }
}
function gl(t, e) {
  let n;
  return t.isVertexAI() ? n = e ? "publishers/google/models" : "models" : n = e ? "models" : "tunedModels", n;
}
function yl(t) {
  for (const e of ["models", "tunedModels", "publisherModels"])
    if (Tf(t, e))
      return t[e];
  return [];
}
function Tf(t, e) {
  return t !== null && typeof t == "object" && e in t;
}
function Sf(t, e = {}) {
  const n = t, i = {
    name: n.name,
    description: n.description,
    parametersJsonSchema: n.inputSchema
  };
  return n.outputSchema && (i.responseJsonSchema = n.outputSchema), e.behavior && (i.behavior = e.behavior), {
    functionDeclarations: [
      i
    ]
  };
}
function Cf(t, e = {}) {
  const n = [], i = /* @__PURE__ */ new Set();
  for (const r of t) {
    const o = r.name;
    if (i.has(o))
      throw new Error(`Duplicate function name ${o} found in MCP tools. Please ensure function names are unique.`);
    i.add(o);
    const a = Sf(r, e);
    a.functionDeclarations && n.push(...a.functionDeclarations);
  }
  return { functionDeclarations: n };
}
function _l(t, e) {
  let n;
  if (typeof e == "string")
    if (t.isVertexAI())
      if (e.startsWith("gs://"))
        n = { format: "jsonl", gcsUri: [e] };
      else if (e.startsWith("bq://"))
        n = { format: "bigquery", bigqueryUri: e };
      else
        throw new Error(`Unsupported string source for Vertex AI: ${e}`);
    else if (e.startsWith("files/"))
      n = { fileName: e };
    else
      throw new Error(`Unsupported string source for Gemini API: ${e}`);
  else if (Array.isArray(e)) {
    if (t.isVertexAI())
      throw new Error("InlinedRequest[] is not supported in Vertex AI.");
    n = { inlinedRequests: e };
  } else
    n = e;
  const i = [n.gcsUri, n.bigqueryUri].filter(Boolean).length, r = [
    n.inlinedRequests,
    n.fileName
  ].filter(Boolean).length;
  if (t.isVertexAI()) {
    if (r > 0 || i !== 1)
      throw new Error("Exactly one of `gcsUri` or `bigqueryUri` must be set for Vertex AI.");
  } else if (i > 0 || r !== 1)
    throw new Error("Exactly one of `inlinedRequests`, `fileName`, must be set for Gemini API.");
  return n;
}
function Af(t) {
  if (typeof t != "string")
    return t;
  const e = t;
  if (e.startsWith("gs://"))
    return {
      format: "jsonl",
      gcsUri: e
    };
  if (e.startsWith("bq://"))
    return {
      format: "bigquery",
      bigqueryUri: e
    };
  throw new Error(`Unsupported destination: ${e}`);
}
function vl(t) {
  if (typeof t != "object" || t === null)
    return {};
  const e = t, n = e.inlinedResponses;
  if (typeof n != "object" || n === null)
    return t;
  const r = n.inlinedResponses;
  if (!Array.isArray(r) || r.length === 0)
    return t;
  let o = !1;
  for (const a of r) {
    if (typeof a != "object" || a === null)
      continue;
    const f = a.response;
    if (typeof f != "object" || f === null)
      continue;
    if (f.embedding !== void 0) {
      o = !0;
      break;
    }
  }
  return o && (e.inlinedEmbedContentResponses = e.inlinedResponses, delete e.inlinedResponses), t;
}
function vt(t, e) {
  const n = e;
  if (!t.isVertexAI()) {
    if (/batches\/[^/]+$/.test(n))
      return n.split("/").pop();
    throw new Error(`Invalid batch job name: ${n}.`);
  }
  if (/^projects\/[^/]+\/locations\/[^/]+\/batchPredictionJobs\/[^/]+$/.test(n))
    return n.split("/").pop();
  if (/^\d+$/.test(n))
    return n;
  throw new Error(`Invalid batch job name: ${n}.`);
}
function El(t) {
  const e = t;
  return e === "BATCH_STATE_UNSPECIFIED" ? "JOB_STATE_UNSPECIFIED" : e === "BATCH_STATE_PENDING" ? "JOB_STATE_PENDING" : e === "BATCH_STATE_RUNNING" ? "JOB_STATE_RUNNING" : e === "BATCH_STATE_SUCCEEDED" ? "JOB_STATE_SUCCEEDED" : e === "BATCH_STATE_FAILED" ? "JOB_STATE_FAILED" : e === "BATCH_STATE_CANCELLED" ? "JOB_STATE_CANCELLED" : e === "BATCH_STATE_EXPIRED" ? "JOB_STATE_EXPIRED" : e;
}
function wf(t) {
  return t.includes("gemini") && t !== "gemini-embedding-001" || t.includes("maas");
}
function If(t) {
  const e = {}, n = s(t, ["apiKey"]);
  if (n != null && u(e, ["apiKey"], n), s(t, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(t, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(t, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(t, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return e;
}
function Rf(t) {
  const e = {}, n = s(t, ["responsesFile"]);
  n != null && u(e, ["fileName"], n);
  const i = s(t, [
    "inlinedResponses",
    "inlinedResponses"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => ad(a))), u(e, ["inlinedResponses"], o);
  }
  const r = s(t, [
    "inlinedEmbedContentResponses",
    "inlinedResponses"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["inlinedEmbedContentResponses"], o);
  }
  return e;
}
function Pf(t) {
  const e = {}, n = s(t, ["predictionsFormat"]);
  n != null && u(e, ["format"], n);
  const i = s(t, [
    "gcsDestination",
    "outputUriPrefix"
  ]);
  i != null && u(e, ["gcsUri"], i);
  const r = s(t, [
    "bigqueryDestination",
    "outputUri"
  ]);
  return r != null && u(e, ["bigqueryUri"], r), e;
}
function Nf(t) {
  const e = {}, n = s(t, ["format"]);
  n != null && u(e, ["predictionsFormat"], n);
  const i = s(t, ["gcsUri"]);
  i != null && u(e, ["gcsDestination", "outputUriPrefix"], i);
  const r = s(t, ["bigqueryUri"]);
  if (r != null && u(e, ["bigqueryDestination", "outputUri"], r), s(t, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedResponses"]) !== void 0)
    throw new Error("inlinedResponses parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedEmbedContentResponses"]) !== void 0)
    throw new Error("inlinedEmbedContentResponses parameter is not supported in Vertex AI.");
  return e;
}
function Sn(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, [
    "metadata",
    "displayName"
  ]);
  i != null && u(e, ["displayName"], i);
  const r = s(t, ["metadata", "state"]);
  r != null && u(e, ["state"], El(r));
  const o = s(t, [
    "metadata",
    "createTime"
  ]);
  o != null && u(e, ["createTime"], o);
  const a = s(t, [
    "metadata",
    "endTime"
  ]);
  a != null && u(e, ["endTime"], a);
  const l = s(t, [
    "metadata",
    "updateTime"
  ]);
  l != null && u(e, ["updateTime"], l);
  const f = s(t, ["metadata", "model"]);
  f != null && u(e, ["model"], f);
  const c = s(t, ["metadata", "output"]);
  return c != null && u(e, ["dest"], Rf(vl(c))), e;
}
function ki(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["displayName"]);
  i != null && u(e, ["displayName"], i);
  const r = s(t, ["state"]);
  r != null && u(e, ["state"], El(r));
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, ["createTime"]);
  a != null && u(e, ["createTime"], a);
  const l = s(t, ["startTime"]);
  l != null && u(e, ["startTime"], l);
  const f = s(t, ["endTime"]);
  f != null && u(e, ["endTime"], f);
  const c = s(t, ["updateTime"]);
  c != null && u(e, ["updateTime"], c);
  const d = s(t, ["model"]);
  d != null && u(e, ["model"], d);
  const p = s(t, ["inputConfig"]);
  p != null && u(e, ["src"], kf(p));
  const h = s(t, ["outputConfig"]);
  h != null && u(e, ["dest"], Pf(vl(h)));
  const m = s(t, [
    "completionStats"
  ]);
  return m != null && u(e, ["completionStats"], m), e;
}
function kf(t) {
  const e = {}, n = s(t, ["instancesFormat"]);
  n != null && u(e, ["format"], n);
  const i = s(t, ["gcsSource", "uris"]);
  i != null && u(e, ["gcsUri"], i);
  const r = s(t, [
    "bigquerySource",
    "inputUri"
  ]);
  return r != null && u(e, ["bigqueryUri"], r), e;
}
function Mf(t, e) {
  const n = {};
  if (s(e, ["format"]) !== void 0)
    throw new Error("format parameter is not supported in Gemini API.");
  if (s(e, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(e, ["bigqueryUri"]) !== void 0)
    throw new Error("bigqueryUri parameter is not supported in Gemini API.");
  const i = s(e, ["fileName"]);
  i != null && u(n, ["fileName"], i);
  const r = s(e, [
    "inlinedRequests"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => sd(t, a))), u(n, ["requests", "requests"], o);
  }
  return n;
}
function xf(t) {
  const e = {}, n = s(t, ["format"]);
  n != null && u(e, ["instancesFormat"], n);
  const i = s(t, ["gcsUri"]);
  i != null && u(e, ["gcsSource", "uris"], i);
  const r = s(t, ["bigqueryUri"]);
  if (r != null && u(e, ["bigquerySource", "inputUri"], r), s(t, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(t, ["inlinedRequests"]) !== void 0)
    throw new Error("inlinedRequests parameter is not supported in Vertex AI.");
  return e;
}
function Df(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && u(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function Uf(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function bf(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function Lf(t) {
  const e = {}, n = s(t, ["content"]);
  n != null && u(e, ["content"], n);
  const i = s(t, [
    "citationMetadata"
  ]);
  i != null && u(e, ["citationMetadata"], Of(i));
  const r = s(t, ["tokenCount"]);
  r != null && u(e, ["tokenCount"], r);
  const o = s(t, ["finishReason"]);
  o != null && u(e, ["finishReason"], o);
  const a = s(t, [
    "groundingMetadata"
  ]);
  a != null && u(e, ["groundingMetadata"], a);
  const l = s(t, ["avgLogprobs"]);
  l != null && u(e, ["avgLogprobs"], l);
  const f = s(t, ["index"]);
  f != null && u(e, ["index"], f);
  const c = s(t, [
    "logprobsResult"
  ]);
  c != null && u(e, ["logprobsResult"], c);
  const d = s(t, [
    "safetyRatings"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((m) => m)), u(e, ["safetyRatings"], h);
  }
  const p = s(t, [
    "urlContextMetadata"
  ]);
  return p != null && u(e, ["urlContextMetadata"], p), e;
}
function Of(t) {
  const e = {}, n = s(t, ["citationSources"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => r)), u(e, ["citations"], i);
  }
  return e;
}
function Tl(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((o) => pd(o))), u(e, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && u(e, ["role"], i), e;
}
function Ff(t, e) {
  const n = {}, i = s(t, ["displayName"]);
  if (e !== void 0 && i != null && u(e, ["batch", "displayName"], i), s(t, ["dest"]) !== void 0)
    throw new Error("dest parameter is not supported in Gemini API.");
  return n;
}
function Gf(t, e) {
  const n = {}, i = s(t, ["displayName"]);
  e !== void 0 && i != null && u(e, ["displayName"], i);
  const r = s(t, ["dest"]);
  return e !== void 0 && r != null && u(e, ["outputConfig"], Nf(Af(r))), n;
}
function ia(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["_url", "model"], ie(t, i));
  const r = s(e, ["src"]);
  r != null && u(n, ["batch", "inputConfig"], Mf(t, _l(t, r)));
  const o = s(e, ["config"]);
  return o != null && Ff(o, n), n;
}
function qf(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["model"], ie(t, i));
  const r = s(e, ["src"]);
  r != null && u(n, ["inputConfig"], xf(_l(t, r)));
  const o = s(e, ["config"]);
  return o != null && Gf(o, n), n;
}
function Bf(t, e) {
  const n = {}, i = s(t, ["displayName"]);
  return e !== void 0 && i != null && u(e, ["batch", "displayName"], i), n;
}
function Hf(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["_url", "model"], ie(t, i));
  const r = s(e, ["src"]);
  r != null && u(n, ["batch", "inputConfig"], zf(t, r));
  const o = s(e, ["config"]);
  return o != null && Bf(o, n), n;
}
function Vf(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function Jf(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function $f(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["name"]);
  i != null && u(e, ["name"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  return o != null && u(e, ["error"], o), e;
}
function Wf(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["name"]);
  i != null && u(e, ["name"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  return o != null && u(e, ["error"], o), e;
}
function Kf(t, e) {
  const n = {}, i = s(e, ["contents"]);
  if (i != null) {
    let o = Yi(t, i);
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["requests[]", "request", "content"], o);
  }
  const r = s(e, ["config"]);
  return r != null && (u(n, ["_self"], Yf(r, n)), Hu(n, { "requests[].*": "requests[].request.*" })), n;
}
function Yf(t, e) {
  const n = {}, i = s(t, ["taskType"]);
  e !== void 0 && i != null && u(e, ["requests[]", "taskType"], i);
  const r = s(t, ["title"]);
  e !== void 0 && r != null && u(e, ["requests[]", "title"], r);
  const o = s(t, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && o != null && u(e, ["requests[]", "outputDimensionality"], o), s(t, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(t, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return n;
}
function zf(t, e) {
  const n = {}, i = s(e, ["fileName"]);
  i != null && u(n, ["file_name"], i);
  const r = s(e, [
    "inlinedRequests"
  ]);
  return r != null && u(n, ["requests"], Kf(t, r)), n;
}
function Xf(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && u(e, ["fileUri"], n);
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function Qf(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && u(e, ["id"], n);
  const i = s(t, ["args"]);
  i != null && u(e, ["args"], i);
  const r = s(t, ["name"]);
  if (r != null && u(e, ["name"], r), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Zf(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && u(e, ["allowedFunctionNames"], n);
  const i = s(t, ["mode"]);
  if (i != null && u(e, ["mode"], i), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function jf(t, e, n) {
  const i = {}, r = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && r != null && u(n, ["systemInstruction"], Tl(ye(r)));
  const o = s(e, ["temperature"]);
  o != null && u(i, ["temperature"], o);
  const a = s(e, ["topP"]);
  a != null && u(i, ["topP"], a);
  const l = s(e, ["topK"]);
  l != null && u(i, ["topK"], l);
  const f = s(e, [
    "candidateCount"
  ]);
  f != null && u(i, ["candidateCount"], f);
  const c = s(e, [
    "maxOutputTokens"
  ]);
  c != null && u(i, ["maxOutputTokens"], c);
  const d = s(e, [
    "stopSequences"
  ]);
  d != null && u(i, ["stopSequences"], d);
  const p = s(e, [
    "responseLogprobs"
  ]);
  p != null && u(i, ["responseLogprobs"], p);
  const h = s(e, ["logprobs"]);
  h != null && u(i, ["logprobs"], h);
  const m = s(e, [
    "presencePenalty"
  ]);
  m != null && u(i, ["presencePenalty"], m);
  const g = s(e, [
    "frequencyPenalty"
  ]);
  g != null && u(i, ["frequencyPenalty"], g);
  const v = s(e, ["seed"]);
  v != null && u(i, ["seed"], v);
  const E = s(e, [
    "responseMimeType"
  ]);
  E != null && u(i, ["responseMimeType"], E);
  const T = s(e, [
    "responseSchema"
  ]);
  T != null && u(i, ["responseSchema"], zi(T));
  const C = s(e, [
    "responseJsonSchema"
  ]);
  if (C != null && u(i, ["responseJsonSchema"], C), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const w = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && w != null) {
    let q = w;
    Array.isArray(q) && (q = q.map((J) => md(J))), u(n, ["safetySettings"], q);
  }
  const D = s(e, ["tools"]);
  if (n !== void 0 && D != null) {
    let q = _t(D);
    Array.isArray(q) && (q = q.map((J) => yd(yt(J)))), u(n, ["tools"], q);
  }
  const _ = s(e, ["toolConfig"]);
  if (n !== void 0 && _ != null && u(n, ["toolConfig"], gd(_)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const y = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && y != null && u(n, ["cachedContent"], Ve(t, y));
  const S = s(e, [
    "responseModalities"
  ]);
  S != null && u(i, ["responseModalities"], S);
  const R = s(e, [
    "mediaResolution"
  ]);
  R != null && u(i, ["mediaResolution"], R);
  const P = s(e, ["speechConfig"]);
  if (P != null && u(i, ["speechConfig"], Xi(P)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const N = s(e, [
    "thinkingConfig"
  ]);
  N != null && u(i, ["thinkingConfig"], N);
  const G = s(e, ["imageConfig"]);
  G != null && u(i, ["imageConfig"], od(G));
  const V = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (V != null && u(i, ["enableEnhancedCivicAnswers"], V), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function ed(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["candidates"]);
  if (i != null) {
    let f = i;
    Array.isArray(f) && (f = f.map((c) => Lf(c))), u(e, ["candidates"], f);
  }
  const r = s(t, ["modelVersion"]);
  r != null && u(e, ["modelVersion"], r);
  const o = s(t, [
    "promptFeedback"
  ]);
  o != null && u(e, ["promptFeedback"], o);
  const a = s(t, ["responseId"]);
  a != null && u(e, ["responseId"], a);
  const l = s(t, [
    "usageMetadata"
  ]);
  return l != null && u(e, ["usageMetadata"], l), e;
}
function td(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function nd(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], vt(t, i)), n;
}
function id(t) {
  const e = {}, n = s(t, ["authConfig"]);
  n != null && u(e, ["authConfig"], If(n));
  const i = s(t, ["enableWidget"]);
  return i != null && u(e, ["enableWidget"], i), e;
}
function rd(t) {
  const e = {}, n = s(t, ["searchTypes"]);
  if (n != null && u(e, ["searchTypes"], n), s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const i = s(t, [
    "timeRangeFilter"
  ]);
  return i != null && u(e, ["timeRangeFilter"], i), e;
}
function od(t) {
  const e = {}, n = s(t, ["aspectRatio"]);
  n != null && u(e, ["aspectRatio"], n);
  const i = s(t, ["imageSize"]);
  if (i != null && u(e, ["imageSize"], i), s(t, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(t, ["prominentPeople"]) !== void 0)
    throw new Error("prominentPeople parameter is not supported in Gemini API.");
  if (s(t, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(t, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  if (s(t, ["imageOutputOptions"]) !== void 0)
    throw new Error("imageOutputOptions parameter is not supported in Gemini API.");
  return e;
}
function sd(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["request", "model"], ie(t, i));
  const r = s(e, ["contents"]);
  if (r != null) {
    let l = Ae(r);
    Array.isArray(l) && (l = l.map((f) => Tl(f))), u(n, ["request", "contents"], l);
  }
  const o = s(e, ["metadata"]);
  o != null && u(n, ["metadata"], o);
  const a = s(e, ["config"]);
  return a != null && u(n, ["request", "generationConfig"], jf(t, a, s(n, ["request"], {}))), n;
}
function ad(t) {
  const e = {}, n = s(t, ["response"]);
  n != null && u(e, ["response"], ed(n));
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["error"]);
  return r != null && u(e, ["error"], r), e;
}
function ld(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  if (e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), s(t, ["filter"]) !== void 0)
    throw new Error("filter parameter is not supported in Gemini API.");
  return n;
}
function cd(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  e !== void 0 && r != null && u(e, ["_query", "pageToken"], r);
  const o = s(t, ["filter"]);
  return e !== void 0 && o != null && u(e, ["_query", "filter"], o), n;
}
function ud(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && ld(n, e), e;
}
function fd(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && cd(n, e), e;
}
function dd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, ["operations"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => Sn(a))), u(e, ["batchJobs"], o);
  }
  return e;
}
function hd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, [
    "batchPredictionJobs"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => ki(a))), u(e, ["batchJobs"], o);
  }
  return e;
}
function pd(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && u(e, ["mediaResolution"], n);
  const i = s(t, [
    "codeExecutionResult"
  ]);
  i != null && u(e, ["codeExecutionResult"], i);
  const r = s(t, [
    "executableCode"
  ]);
  r != null && u(e, ["executableCode"], r);
  const o = s(t, ["fileData"]);
  o != null && u(e, ["fileData"], Xf(o));
  const a = s(t, ["functionCall"]);
  a != null && u(e, ["functionCall"], Qf(a));
  const l = s(t, [
    "functionResponse"
  ]);
  l != null && u(e, ["functionResponse"], l);
  const f = s(t, ["inlineData"]);
  f != null && u(e, ["inlineData"], Df(f));
  const c = s(t, ["text"]);
  c != null && u(e, ["text"], c);
  const d = s(t, ["thought"]);
  d != null && u(e, ["thought"], d);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && u(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && u(e, ["videoMetadata"], h), e;
}
function md(t) {
  const e = {}, n = s(t, ["category"]);
  if (n != null && u(e, ["category"], n), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(t, ["threshold"]);
  return i != null && u(e, ["threshold"], i), e;
}
function gd(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && u(e, ["retrievalConfig"], n);
  const i = s(t, [
    "functionCallingConfig"
  ]);
  return i != null && u(e, ["functionCallingConfig"], Zf(i)), e;
}
function yd(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && u(e, ["computerUse"], n);
  const i = s(t, ["fileSearch"]);
  i != null && u(e, ["fileSearch"], i);
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], rd(r));
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], id(o));
  const a = s(t, [
    "codeExecution"
  ]);
  if (a != null && u(e, ["codeExecution"], a), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(t, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["functionDeclarations"], p);
  }
  const f = s(t, [
    "googleSearchRetrieval"
  ]);
  if (f != null && u(e, ["googleSearchRetrieval"], f), s(t, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(t, ["urlContext"]);
  c != null && u(e, ["urlContext"], c);
  const d = s(t, ["mcpServers"]);
  if (d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["mcpServers"], p);
  }
  return e;
}
var Be;
(function(t) {
  t.PAGED_ITEM_BATCH_JOBS = "batchJobs", t.PAGED_ITEM_MODELS = "models", t.PAGED_ITEM_TUNING_JOBS = "tuningJobs", t.PAGED_ITEM_FILES = "files", t.PAGED_ITEM_CACHED_CONTENTS = "cachedContents", t.PAGED_ITEM_FILE_SEARCH_STORES = "fileSearchStores", t.PAGED_ITEM_DOCUMENTS = "documents";
})(Be || (Be = {}));
class ct {
  constructor(e, n, i, r) {
    this.pageInternal = [], this.paramsInternal = {}, this.requestInternal = n, this.init(e, i, r);
  }
  init(e, n, i) {
    var r, o;
    this.nameInternal = e, this.pageInternal = n[this.nameInternal] || [], this.sdkHttpResponseInternal = n?.sdkHttpResponse, this.idxInternal = 0;
    let a = { config: {} };
    !i || Object.keys(i).length === 0 ? a = { config: {} } : typeof i == "object" ? a = Object.assign({}, i) : a = i, a.config && (a.config.pageToken = n.nextPageToken), this.paramsInternal = a, this.pageInternalSize = (o = (r = a.config) === null || r === void 0 ? void 0 : r.pageSize) !== null && o !== void 0 ? o : this.pageInternal.length;
  }
  initNextPage(e) {
    this.init(this.nameInternal, e, this.paramsInternal);
  }
  /**
   * Returns the current page, which is a list of items.
   *
   * @remarks
   * The first page is retrieved when the pager is created. The returned list of
   * items could be a subset of the entire list.
   */
  get page() {
    return this.pageInternal;
  }
  /**
   * Returns the type of paged item (for example, ``batch_jobs``).
   */
  get name() {
    return this.nameInternal;
  }
  /**
   * Returns the length of the page fetched each time by this pager.
   *
   * @remarks
   * The number of items in the page is less than or equal to the page length.
   */
  get pageSize() {
    return this.pageInternalSize;
  }
  /**
   * Returns the headers of the API response.
   */
  get sdkHttpResponse() {
    return this.sdkHttpResponseInternal;
  }
  /**
   * Returns the parameters when making the API request for the next page.
   *
   * @remarks
   * Parameters contain a set of optional configs that can be
   * used to customize the API request. For example, the `pageToken` parameter
   * contains the token to request the next page.
   */
  get params() {
    return this.paramsInternal;
  }
  /**
   * Returns the total number of items in the current page.
   */
  get pageLength() {
    return this.pageInternal.length;
  }
  /**
   * Returns the item at the given index.
   */
  getItem(e) {
    return this.pageInternal[e];
  }
  /**
   * Returns an async iterator that support iterating through all items
   * retrieved from the API.
   *
   * @remarks
   * The iterator will automatically fetch the next page if there are more items
   * to fetch from the API.
   *
   * @example
   *
   * ```ts
   * const pager = await ai.files.list({config: {pageSize: 10}});
   * for await (const file of pager) {
   *   console.log(file.name);
   * }
   * ```
   */
  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        if (this.idxInternal >= this.pageLength)
          if (this.hasNextPage())
            await this.nextPage();
          else
            return { value: void 0, done: !0 };
        const e = this.getItem(this.idxInternal);
        return this.idxInternal += 1, { value: e, done: !1 };
      },
      return: async () => ({ value: void 0, done: !0 })
    };
  }
  /**
   * Fetches the next page of items. This makes a new API request.
   *
   * @throws {Error} If there are no more pages to fetch.
   *
   * @example
   *
   * ```ts
   * const pager = await ai.files.list({config: {pageSize: 10}});
   * let page = pager.page;
   * while (true) {
   *   for (const file of page) {
   *     console.log(file.name);
   *   }
   *   if (!pager.hasNextPage()) {
   *     break;
   *   }
   *   page = await pager.nextPage();
   * }
   * ```
   */
  async nextPage() {
    if (!this.hasNextPage())
      throw new Error("No more pages to fetch.");
    const e = await this.requestInternal(this.params);
    return this.initNextPage(e), this.page;
  }
  /**
   * Returns true if there are more pages to fetch from the API.
   */
  hasNextPage() {
    var e;
    return ((e = this.params.config) === null || e === void 0 ? void 0 : e.pageToken) !== void 0;
  }
}
class _d extends He {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new ct(Be.PAGED_ITEM_BATCH_JOBS, (i) => this.listInternal(i), await this.listInternal(n), n), this.create = async (n) => (this.apiClient.isVertexAI() && (n.config = this.formatDestination(n.src, n.config)), this.createInternal(n)), this.createEmbeddings = async (n) => {
      if (console.warn("batches.createEmbeddings() is experimental and may change without notice."), this.apiClient.isVertexAI())
        throw new Error("Vertex AI does not support batches.createEmbeddings.");
      return this.createEmbeddingsInternal(n);
    };
  }
  // Helper function to handle inlined generate content requests
  createInlinedGenerateContentRequest(e) {
    const n = ia(
      this.apiClient,
      // Use instance apiClient
      e
    ), i = n._url, r = z("{model}:batchGenerateContent", i), l = n.batch.inputConfig.requests, f = l.requests, c = [];
    for (const d of f) {
      const p = Object.assign({}, d);
      if (p.systemInstruction) {
        const h = p.systemInstruction;
        delete p.systemInstruction;
        const m = p.request;
        m.systemInstruction = h, p.request = m;
      }
      c.push(p);
    }
    return l.requests = c, delete n.config, delete n._url, delete n._query, { path: r, body: n };
  }
  // Helper function to get the first GCS URI
  getGcsUri(e) {
    if (typeof e == "string")
      return e.startsWith("gs://") ? e : void 0;
    if (!Array.isArray(e) && e.gcsUri && e.gcsUri.length > 0)
      return e.gcsUri[0];
  }
  // Helper function to get the BigQuery URI
  getBigqueryUri(e) {
    if (typeof e == "string")
      return e.startsWith("bq://") ? e : void 0;
    if (!Array.isArray(e))
      return e.bigqueryUri;
  }
  // Function to format the destination configuration for Vertex AI
  formatDestination(e, n) {
    const i = n ? Object.assign({}, n) : {}, r = Date.now().toString();
    if (i.displayName || (i.displayName = `genaiBatchJob_${r}`), i.dest === void 0) {
      const o = this.getGcsUri(e), a = this.getBigqueryUri(e);
      if (o)
        o.endsWith(".jsonl") ? i.dest = `${o.slice(0, -6)}/dest` : i.dest = `${o}_dest_${r}`;
      else if (a)
        i.dest = `${a}_dest_${r}`;
      else
        throw new Error("Unsupported source for Vertex AI: No GCS or BigQuery URI found.");
    }
    return i;
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = qf(this.apiClient, e);
      return l = z("batchPredictionJobs", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => ki(d));
    } else {
      const c = ia(this.apiClient, e);
      return l = z("{model}:batchGenerateContent", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => Sn(d));
    }
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createEmbeddingsInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Hf(this.apiClient, e);
      return o = z("{model}:asyncBatchEmbedContent", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => Sn(f));
    }
  }
  /**
   * Gets batch job configurations.
   *
   * @param params - The parameters for the get request.
   * @return The batch job.
   *
   * @example
   * ```ts
   * await ai.batches.get({name: '...'}); // The server-generated resource name.
   * ```
   */
  async get(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = nd(this.apiClient, e);
      return l = z("batchPredictionJobs/{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => ki(d));
    } else {
      const c = td(this.apiClient, e);
      return l = z("batches/{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => Sn(d));
    }
  }
  /**
   * Cancels a batch job.
   *
   * @param params - The parameters for the cancel request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.batches.cancel({name: '...'}); // The server-generated resource name.
   * ```
   */
  async cancel(e) {
    var n, i, r, o;
    let a = "", l = {};
    if (this.apiClient.isVertexAI()) {
      const f = bf(this.apiClient, e);
      a = z("batchPredictionJobs/{name}:cancel", f._url), l = f._query, delete f._url, delete f._query, await this.apiClient.request({
        path: a,
        queryParams: l,
        body: JSON.stringify(f),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      });
    } else {
      const f = Uf(this.apiClient, e);
      a = z("batches/{name}:cancel", f._url), l = f._query, delete f._url, delete f._query, await this.apiClient.request({
        path: a,
        queryParams: l,
        body: JSON.stringify(f),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = fd(e);
      return l = z("batchPredictionJobs", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = hd(d), h = new js();
        return Object.assign(h, p), h;
      });
    } else {
      const c = ud(e);
      return l = z("batches", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = dd(d), h = new js();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Deletes a batch job.
   *
   * @param params - The parameters for the delete request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.batches.delete({name: '...'}); // The server-generated resource name.
   * ```
   */
  async delete(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Jf(this.apiClient, e);
      return l = z("batchPredictionJobs/{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => Wf(d));
    } else {
      const c = Vf(this.apiClient, e);
      return l = z("batches/{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => $f(d));
    }
  }
}
function vd(t) {
  const e = {}, n = s(t, ["apiKey"]);
  if (n != null && u(e, ["apiKey"], n), s(t, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(t, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(t, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(t, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return e;
}
function Ed(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && u(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function ra(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((o) => Vd(o))), u(e, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && u(e, ["role"], i), e;
}
function Td(t, e) {
  const n = {}, i = s(t, ["ttl"]);
  e !== void 0 && i != null && u(e, ["ttl"], i);
  const r = s(t, ["expireTime"]);
  e !== void 0 && r != null && u(e, ["expireTime"], r);
  const o = s(t, ["displayName"]);
  e !== void 0 && o != null && u(e, ["displayName"], o);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let d = Ae(a);
    Array.isArray(d) && (d = d.map((p) => ra(p))), u(e, ["contents"], d);
  }
  const l = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && l != null && u(e, ["systemInstruction"], ra(ye(l)));
  const f = s(t, ["tools"]);
  if (e !== void 0 && f != null) {
    let d = f;
    Array.isArray(d) && (d = d.map((p) => $d(p))), u(e, ["tools"], d);
  }
  const c = s(t, ["toolConfig"]);
  if (e !== void 0 && c != null && u(e, ["toolConfig"], Jd(c)), s(t, ["kmsKeyName"]) !== void 0)
    throw new Error("kmsKeyName parameter is not supported in Gemini API.");
  return n;
}
function Sd(t, e) {
  const n = {}, i = s(t, ["ttl"]);
  e !== void 0 && i != null && u(e, ["ttl"], i);
  const r = s(t, ["expireTime"]);
  e !== void 0 && r != null && u(e, ["expireTime"], r);
  const o = s(t, ["displayName"]);
  e !== void 0 && o != null && u(e, ["displayName"], o);
  const a = s(t, ["contents"]);
  if (e !== void 0 && a != null) {
    let p = Ae(a);
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["contents"], p);
  }
  const l = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && l != null && u(e, ["systemInstruction"], ye(l));
  const f = s(t, ["tools"]);
  if (e !== void 0 && f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => Wd(h))), u(e, ["tools"], p);
  }
  const c = s(t, ["toolConfig"]);
  e !== void 0 && c != null && u(e, ["toolConfig"], c);
  const d = s(t, ["kmsKeyName"]);
  return e !== void 0 && d != null && u(e, ["encryption_spec", "kmsKeyName"], d), n;
}
function Cd(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["model"], ll(t, i));
  const r = s(e, ["config"]);
  return r != null && Td(r, n), n;
}
function Ad(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["model"], ll(t, i));
  const r = s(e, ["config"]);
  return r != null && Sd(r, n), n;
}
function wd(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], Ve(t, i)), n;
}
function Id(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], Ve(t, i)), n;
}
function Rd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && u(e, ["sdkHttpResponse"], n), e;
}
function Pd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && u(e, ["sdkHttpResponse"], n), e;
}
function Nd(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && u(e, ["fileUri"], n);
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function kd(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && u(e, ["id"], n);
  const i = s(t, ["args"]);
  i != null && u(e, ["args"], i);
  const r = s(t, ["name"]);
  if (r != null && u(e, ["name"], r), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Md(t) {
  const e = {}, n = s(t, [
    "allowedFunctionNames"
  ]);
  n != null && u(e, ["allowedFunctionNames"], n);
  const i = s(t, ["mode"]);
  if (i != null && u(e, ["mode"], i), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return e;
}
function xd(t) {
  const e = {}, n = s(t, ["description"]);
  n != null && u(e, ["description"], n);
  const i = s(t, ["name"]);
  i != null && u(e, ["name"], i);
  const r = s(t, ["parameters"]);
  r != null && u(e, ["parameters"], r);
  const o = s(t, [
    "parametersJsonSchema"
  ]);
  o != null && u(e, ["parametersJsonSchema"], o);
  const a = s(t, ["response"]);
  a != null && u(e, ["response"], a);
  const l = s(t, [
    "responseJsonSchema"
  ]);
  if (l != null && u(e, ["responseJsonSchema"], l), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function Dd(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], Ve(t, i)), n;
}
function Ud(t, e) {
  const n = {}, i = s(e, ["name"]);
  return i != null && u(n, ["_url", "name"], Ve(t, i)), n;
}
function bd(t) {
  const e = {}, n = s(t, ["authConfig"]);
  n != null && u(e, ["authConfig"], vd(n));
  const i = s(t, ["enableWidget"]);
  return i != null && u(e, ["enableWidget"], i), e;
}
function Ld(t) {
  const e = {}, n = s(t, ["searchTypes"]);
  if (n != null && u(e, ["searchTypes"], n), s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const i = s(t, [
    "timeRangeFilter"
  ]);
  return i != null && u(e, ["timeRangeFilter"], i), e;
}
function Od(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  return e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), n;
}
function Fd(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  return e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), n;
}
function Gd(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Od(n, e), e;
}
function qd(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Fd(n, e), e;
}
function Bd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, [
    "cachedContents"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["cachedContents"], o);
  }
  return e;
}
function Hd(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, [
    "cachedContents"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["cachedContents"], o);
  }
  return e;
}
function Vd(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && u(e, ["mediaResolution"], n);
  const i = s(t, [
    "codeExecutionResult"
  ]);
  i != null && u(e, ["codeExecutionResult"], i);
  const r = s(t, [
    "executableCode"
  ]);
  r != null && u(e, ["executableCode"], r);
  const o = s(t, ["fileData"]);
  o != null && u(e, ["fileData"], Nd(o));
  const a = s(t, ["functionCall"]);
  a != null && u(e, ["functionCall"], kd(a));
  const l = s(t, [
    "functionResponse"
  ]);
  l != null && u(e, ["functionResponse"], l);
  const f = s(t, ["inlineData"]);
  f != null && u(e, ["inlineData"], Ed(f));
  const c = s(t, ["text"]);
  c != null && u(e, ["text"], c);
  const d = s(t, ["thought"]);
  d != null && u(e, ["thought"], d);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && u(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && u(e, ["videoMetadata"], h), e;
}
function Jd(t) {
  const e = {}, n = s(t, [
    "retrievalConfig"
  ]);
  n != null && u(e, ["retrievalConfig"], n);
  const i = s(t, [
    "functionCallingConfig"
  ]);
  return i != null && u(e, ["functionCallingConfig"], Md(i)), e;
}
function $d(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && u(e, ["computerUse"], n);
  const i = s(t, ["fileSearch"]);
  i != null && u(e, ["fileSearch"], i);
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], Ld(r));
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], bd(o));
  const a = s(t, [
    "codeExecution"
  ]);
  if (a != null && u(e, ["codeExecution"], a), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(t, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["functionDeclarations"], p);
  }
  const f = s(t, [
    "googleSearchRetrieval"
  ]);
  if (f != null && u(e, ["googleSearchRetrieval"], f), s(t, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(t, ["urlContext"]);
  c != null && u(e, ["urlContext"], c);
  const d = s(t, ["mcpServers"]);
  if (d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["mcpServers"], p);
  }
  return e;
}
function Wd(t) {
  const e = {}, n = s(t, ["retrieval"]);
  n != null && u(e, ["retrieval"], n);
  const i = s(t, ["computerUse"]);
  if (i != null && u(e, ["computerUse"], i), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], r);
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], o);
  const a = s(t, [
    "codeExecution"
  ]);
  a != null && u(e, ["codeExecution"], a);
  const l = s(t, [
    "enterpriseWebSearch"
  ]);
  l != null && u(e, ["enterpriseWebSearch"], l);
  const f = s(t, [
    "functionDeclarations"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((m) => xd(m))), u(e, ["functionDeclarations"], h);
  }
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && u(e, ["googleSearchRetrieval"], c);
  const d = s(t, [
    "parallelAiSearch"
  ]);
  d != null && u(e, ["parallelAiSearch"], d);
  const p = s(t, ["urlContext"]);
  if (p != null && u(e, ["urlContext"], p), s(t, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return e;
}
function Kd(t, e) {
  const n = {}, i = s(t, ["ttl"]);
  e !== void 0 && i != null && u(e, ["ttl"], i);
  const r = s(t, ["expireTime"]);
  return e !== void 0 && r != null && u(e, ["expireTime"], r), n;
}
function Yd(t, e) {
  const n = {}, i = s(t, ["ttl"]);
  e !== void 0 && i != null && u(e, ["ttl"], i);
  const r = s(t, ["expireTime"]);
  return e !== void 0 && r != null && u(e, ["expireTime"], r), n;
}
function zd(t, e) {
  const n = {}, i = s(e, ["name"]);
  i != null && u(n, ["_url", "name"], Ve(t, i));
  const r = s(e, ["config"]);
  return r != null && Kd(r, n), n;
}
function Xd(t, e) {
  const n = {}, i = s(e, ["name"]);
  i != null && u(n, ["_url", "name"], Ve(t, i));
  const r = s(e, ["config"]);
  return r != null && Yd(r, n), n;
}
class Qd extends He {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new ct(Be.PAGED_ITEM_CACHED_CONTENTS, (i) => this.listInternal(i), await this.listInternal(n), n);
  }
  /**
   * Creates a cached contents resource.
   *
   * @remarks
   * Context caching is only supported for specific models. See [Gemini
   * Developer API reference](https://ai.google.dev/gemini-api/docs/caching?lang=node/context-cac)
   * and [Vertex AI reference](https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview#supported_models)
   * for more information.
   *
   * @param params - The parameters for the create request.
   * @return The created cached content.
   *
   * @example
   * ```ts
   * const contents = ...; // Initialize the content to cache.
   * const response = await ai.caches.create({
   *   model: 'gemini-2.0-flash-001',
   *   config: {
   *    'contents': contents,
   *    'displayName': 'test cache',
   *    'systemInstruction': 'What is the sum of the two pdfs?',
   *    'ttl': '86400s',
   *  }
   * });
   * ```
   */
  async create(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ad(this.apiClient, e);
      return l = z("cachedContents", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    } else {
      const c = Cd(this.apiClient, e);
      return l = z("cachedContents", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    }
  }
  /**
   * Gets cached content configurations.
   *
   * @param params - The parameters for the get request.
   * @return The cached content.
   *
   * @example
   * ```ts
   * await ai.caches.get({name: '...'}); // The server-generated resource name.
   * ```
   */
  async get(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ud(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    } else {
      const c = Dd(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    }
  }
  /**
   * Deletes cached content.
   *
   * @param params - The parameters for the delete request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.caches.delete({name: '...'}); // The server-generated resource name.
   * ```
   */
  async delete(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Id(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Pd(d), h = new Qs();
        return Object.assign(h, p), h;
      });
    } else {
      const c = wd(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Rd(d), h = new Qs();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Updates cached content configurations.
   *
   * @param params - The parameters for the update request.
   * @return The updated cached content.
   *
   * @example
   * ```ts
   * const response = await ai.caches.update({
   *   name: '...',  // The server-generated resource name.
   *   config: {'ttl': '7600s'}
   * });
   * ```
   */
  async update(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Xd(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    } else {
      const c = zd(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => d);
    }
  }
  async listInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = qd(e);
      return l = z("cachedContents", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Hd(d), h = new Zs();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Gd(e);
      return l = z("cachedContents", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Bd(d), h = new Zs();
        return Object.assign(h, p), h;
      });
    }
  }
}
function Pn(t, e) {
  var n = {};
  for (var i in t) Object.prototype.hasOwnProperty.call(t, i) && e.indexOf(i) < 0 && (n[i] = t[i]);
  if (t != null && typeof Object.getOwnPropertySymbols == "function")
    for (var r = 0, i = Object.getOwnPropertySymbols(t); r < i.length; r++)
      e.indexOf(i[r]) < 0 && Object.prototype.propertyIsEnumerable.call(t, i[r]) && (n[i[r]] = t[i[r]]);
  return n;
}
function oa(t) {
  var e = typeof Symbol == "function" && Symbol.iterator, n = e && t[e], i = 0;
  if (n) return n.call(t);
  if (t && typeof t.length == "number") return {
    next: function() {
      return t && i >= t.length && (t = void 0), { value: t && t[i++], done: !t };
    }
  };
  throw new TypeError(e ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function j(t) {
  return this instanceof j ? (this.v = t, this) : new j(t);
}
function xe(t, e, n) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var i = n.apply(t, e || []), r, o = [];
  return r = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), l("next"), l("throw"), l("return", a), r[Symbol.asyncIterator] = function() {
    return this;
  }, r;
  function a(m) {
    return function(g) {
      return Promise.resolve(g).then(m, p);
    };
  }
  function l(m, g) {
    i[m] && (r[m] = function(v) {
      return new Promise(function(E, T) {
        o.push([m, v, E, T]) > 1 || f(m, v);
      });
    }, g && (r[m] = g(r[m])));
  }
  function f(m, g) {
    try {
      c(i[m](g));
    } catch (v) {
      h(o[0][3], v);
    }
  }
  function c(m) {
    m.value instanceof j ? Promise.resolve(m.value.v).then(d, p) : h(o[0][2], m);
  }
  function d(m) {
    f("next", m);
  }
  function p(m) {
    f("throw", m);
  }
  function h(m, g) {
    m(g), o.shift(), o.length && f(o[0][0], o[0][1]);
  }
}
function De(t) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var e = t[Symbol.asyncIterator], n;
  return e ? e.call(t) : (t = typeof oa == "function" ? oa(t) : t[Symbol.iterator](), n = {}, i("next"), i("throw"), i("return"), n[Symbol.asyncIterator] = function() {
    return this;
  }, n);
  function i(o) {
    n[o] = t[o] && function(a) {
      return new Promise(function(l, f) {
        a = t[o](a), r(l, f, a.done, a.value);
      });
    };
  }
  function r(o, a, l, f) {
    Promise.resolve(f).then(function(c) {
      o({ value: c, done: l });
    }, a);
  }
}
function Zd(t) {
  var e;
  if (t.candidates == null || t.candidates.length === 0)
    return !1;
  const n = (e = t.candidates[0]) === null || e === void 0 ? void 0 : e.content;
  return n === void 0 ? !1 : Sl(n);
}
function Sl(t) {
  if (t.parts === void 0 || t.parts.length === 0)
    return !1;
  for (const e of t.parts)
    if (e === void 0 || Object.keys(e).length === 0)
      return !1;
  return !0;
}
function jd(t) {
  if (t.length !== 0) {
    for (const e of t)
      if (e.role !== "user" && e.role !== "model")
        throw new Error(`Role must be user or model, but got ${e.role}.`);
  }
}
function sa(t) {
  if (t === void 0 || t.length === 0)
    return [];
  const e = [], n = t.length;
  let i = 0;
  for (; i < n; )
    if (t[i].role === "user")
      e.push(t[i]), i++;
    else {
      const r = [];
      let o = !0;
      for (; i < n && t[i].role === "model"; )
        r.push(t[i]), o && !Sl(t[i]) && (o = !1), i++;
      o ? e.push(...r) : e.pop();
    }
  return e;
}
class eh {
  constructor(e, n) {
    this.modelsModule = e, this.apiClient = n;
  }
  /**
   * Creates a new chat session.
   *
   * @remarks
   * The config in the params will be used for all requests within the chat
   * session unless overridden by a per-request `config` in
   * @see {@link types.SendMessageParameters#config}.
   *
   * @param params - Parameters for creating a chat session.
   * @returns A new chat session.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({
   *   model: 'gemini-2.0-flash'
   *   config: {
   *     temperature: 0.5,
   *     maxOutputTokens: 1024,
   *   }
   * });
   * ```
   */
  create(e) {
    return new th(
      this.apiClient,
      this.modelsModule,
      e.model,
      e.config,
      // Deep copy the history to avoid mutating the history outside of the
      // chat session.
      structuredClone(e.history)
    );
  }
}
class th {
  constructor(e, n, i, r = {}, o = []) {
    this.apiClient = e, this.modelsModule = n, this.model = i, this.config = r, this.history = o, this.sendPromise = Promise.resolve(), jd(o);
  }
  /**
   * Sends a message to the model and returns the response.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessageStream} for streaming method.
   * @param params - parameters for sending messages within a chat session.
   * @returns The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessage({
   *   message: 'Why is the sky blue?'
   * });
   * console.log(response.text);
   * ```
   */
  async sendMessage(e) {
    var n;
    await this.sendPromise;
    const i = ye(e.message), r = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(!0).concat(i),
      config: (n = e.config) !== null && n !== void 0 ? n : this.config
    });
    return this.sendPromise = (async () => {
      var o, a, l;
      const f = await r, c = (a = (o = f.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content, d = f.automaticFunctionCallingHistory, p = this.getHistory(!0).length;
      let h = [];
      d != null && (h = (l = d.slice(p)) !== null && l !== void 0 ? l : []);
      const m = c ? [c] : [];
      this.recordHistory(i, m, h);
    })(), await this.sendPromise.catch(() => {
      this.sendPromise = Promise.resolve();
    }), r;
  }
  /**
   * Sends a message to the model and returns the response in chunks.
   *
   * @remarks
   * This method will wait for the previous message to be processed before
   * sending the next message.
   *
   * @see {@link Chat#sendMessage} for non-streaming method.
   * @param params - parameters for sending the message.
   * @return The model's response.
   *
   * @example
   * ```ts
   * const chat = ai.chats.create({model: 'gemini-2.0-flash'});
   * const response = await chat.sendMessageStream({
   *   message: 'Why is the sky blue?'
   * });
   * for await (const chunk of response) {
   *   console.log(chunk.text);
   * }
   * ```
   */
  async sendMessageStream(e) {
    var n;
    await this.sendPromise;
    const i = ye(e.message), r = this.modelsModule.generateContentStream({
      model: this.model,
      contents: this.getHistory(!0).concat(i),
      config: (n = e.config) !== null && n !== void 0 ? n : this.config
    });
    this.sendPromise = r.then(() => {
    }).catch(() => {
    });
    const o = await r;
    return this.processStreamResponse(o, i);
  }
  /**
   * Returns the chat history.
   *
   * @remarks
   * The history is a list of contents alternating between user and model.
   *
   * There are two types of history:
   * - The `curated history` contains only the valid turns between user and
   * model, which will be included in the subsequent requests sent to the model.
   * - The `comprehensive history` contains all turns, including invalid or
   *   empty model outputs, providing a complete record of the history.
   *
   * The history is updated after receiving the response from the model,
   * for streaming response, it means receiving the last chunk of the response.
   *
   * The `comprehensive history` is returned by default. To get the `curated
   * history`, set the `curated` parameter to `true`.
   *
   * @param curated - whether to return the curated history or the comprehensive
   *     history.
   * @return History contents alternating between user and model for the entire
   *     chat session.
   */
  getHistory(e = !1) {
    const n = e ? sa(this.history) : this.history;
    return structuredClone(n);
  }
  processStreamResponse(e, n) {
    return xe(this, arguments, function* () {
      var r, o, a, l, f, c;
      const d = [];
      try {
        for (var p = !0, h = De(e), m; m = yield j(h.next()), r = m.done, !r; p = !0) {
          l = m.value, p = !1;
          const g = l;
          if (Zd(g)) {
            const v = (c = (f = g.candidates) === null || f === void 0 ? void 0 : f[0]) === null || c === void 0 ? void 0 : c.content;
            v !== void 0 && d.push(v);
          }
          yield yield j(g);
        }
      } catch (g) {
        o = { error: g };
      } finally {
        try {
          !p && !r && (a = h.return) && (yield j(a.call(h)));
        } finally {
          if (o) throw o.error;
        }
      }
      this.recordHistory(n, d);
    });
  }
  recordHistory(e, n, i) {
    let r = [];
    n.length > 0 && n.every((o) => o.role !== void 0) ? r = n : r.push({
      role: "model",
      parts: []
    }), i && i.length > 0 ? this.history.push(...sa(i)) : this.history.push(e), this.history.push(...r);
  }
}
class Ln extends Error {
  constructor(e) {
    super(e.message), this.name = "ApiError", this.status = e.status, Object.setPrototypeOf(this, Ln.prototype);
  }
}
function nh(t) {
  const e = {}, n = s(t, ["file"]);
  return n != null && u(e, ["file"], n), e;
}
function ih(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && u(e, ["sdkHttpResponse"], n), e;
}
function rh(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && u(e, ["_url", "file"], Zi(n)), e;
}
function oh(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && u(e, ["sdkHttpResponse"], n), e;
}
function sh(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && u(e, ["_url", "file"], Zi(n)), e;
}
function ah(t) {
  const e = {}, n = s(t, ["uris"]);
  return n != null && u(e, ["uris"], n), e;
}
function lh(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  return e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), n;
}
function ch(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && lh(n, e), e;
}
function uh(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, ["files"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["files"], o);
  }
  return e;
}
function fh(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["files"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((o) => o)), u(e, ["files"], r);
  }
  return e;
}
class dh extends He {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new ct(Be.PAGED_ITEM_FILES, (i) => this.listInternal(i), await this.listInternal(n), n);
  }
  /**
   * Uploads a file asynchronously to the Gemini API.
   * This method is not available in Vertex AI.
   * Supported upload sources:
   * - Node.js: File path (string) or Blob object.
   * - Browser: Blob object (e.g., File).
   *
   * @remarks
   * The `mimeType` can be specified in the `config` parameter. If omitted:
   *  - For file path (string) inputs, the `mimeType` will be inferred from the
   *     file extension.
   *  - For Blob object inputs, the `mimeType` will be set to the Blob's `type`
   *     property.
   * Somex eamples for file extension to mimeType mapping:
   * .txt -> text/plain
   * .json -> application/json
   * .jpg  -> image/jpeg
   * .png -> image/png
   * .mp3 -> audio/mpeg
   * .mp4 -> video/mp4
   *
   * This section can contain multiple paragraphs and code examples.
   *
   * @param params - Optional parameters specified in the
   *        `types.UploadFileParameters` interface.
   *         @see {@link types.UploadFileParameters#config} for the optional
   *         config in the parameters.
   * @return A promise that resolves to a `types.File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   * the `mimeType` can be provided in the `params.config` parameter.
   * @throws An error occurs if a suitable upload location cannot be established.
   *
   * @example
   * The following code uploads a file to Gemini API.
   *
   * ```ts
   * const file = await ai.files.upload({file: 'file.txt', config: {
   *   mimeType: 'text/plain',
   * }});
   * console.log(file.name);
   * ```
   */
  async upload(e) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files. You can share files through a GCS bucket.");
    return this.apiClient.uploadFile(e.file, e.config).then((n) => n);
  }
  /**
   * Downloads a remotely stored file asynchronously to a location specified in
   * the `params` object. This method only works on Node environment, to
   * download files in the browser, use a browser compliant method like an <a>
   * tag.
   *
   * @param params - The parameters for the download request.
   *
   * @example
   * The following code downloads an example file named "files/mehozpxf877d" as
   * "file.txt".
   *
   * ```ts
   * await ai.files.download({file: file.name, downloadPath: 'file.txt'});
   * ```
   */
  async download(e) {
    await this.apiClient.downloadFile(e);
  }
  /**
   * Registers Google Cloud Storage files for use with the API.
   * This method is only available in Node.js environments.
   */
  async registerFiles(e) {
    throw new Error("registerFiles is only supported in Node.js environments.");
  }
  async _registerFiles(e) {
    return this.registerFilesInternal(e);
  }
  async listInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = ch(e);
      return o = z("files", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => {
        const c = uh(f), d = new df();
        return Object.assign(d, c), d;
      });
    }
  }
  async createInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = nh(e);
      return o = z("upload/v1beta/files", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = ih(f), d = new hf();
        return Object.assign(d, c), d;
      });
    }
  }
  /**
   * Retrieves the file information from the service.
   *
   * @param params - The parameters for the get request
   * @return The Promise that resolves to the types.File object requested.
   *
   * @example
   * ```ts
   * const config: GetFileParameters = {
   *   name: fileName,
   * };
   * file = await ai.files.get(config);
   * console.log(file.name);
   * ```
   */
  async get(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = sh(e);
      return o = z("files/{file}", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => f);
    }
  }
  /**
   * Deletes a remotely stored file.
   *
   * @param params - The parameters for the delete request.
   * @return The DeleteFileResponse, the response for the delete method.
   *
   * @example
   * The following code deletes an example file named "files/mehozpxf877d".
   *
   * ```ts
   * await ai.files.delete({name: file.name});
   * ```
   */
  async delete(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = rh(e);
      return o = z("files/{file}", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => {
        const c = oh(f), d = new pf();
        return Object.assign(d, c), d;
      });
    }
  }
  async registerFilesInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = ah(e);
      return o = z("files:register", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = fh(f), d = new mf();
        return Object.assign(d, c), d;
      });
    }
  }
}
function hh(t) {
  const e = {}, n = s(t, ["apiKey"]);
  if (n != null && u(e, ["apiKey"], n), s(t, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(t, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(t, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(t, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return e;
}
function Cn(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && u(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function ph(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((o) => kh(o))), u(e, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && u(e, ["role"], i), e;
}
function mh(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && u(e, ["fileUri"], n);
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function gh(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && u(e, ["id"], n);
  const i = s(t, ["args"]);
  i != null && u(e, ["args"], i);
  const r = s(t, ["name"]);
  if (r != null && u(e, ["name"], r), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function yh(t) {
  const e = {}, n = s(t, ["description"]);
  n != null && u(e, ["description"], n);
  const i = s(t, ["name"]);
  i != null && u(e, ["name"], i);
  const r = s(t, ["parameters"]);
  r != null && u(e, ["parameters"], r);
  const o = s(t, [
    "parametersJsonSchema"
  ]);
  o != null && u(e, ["parametersJsonSchema"], o);
  const a = s(t, ["response"]);
  a != null && u(e, ["response"], a);
  const l = s(t, [
    "responseJsonSchema"
  ]);
  if (l != null && u(e, ["responseJsonSchema"], l), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return e;
}
function _h(t) {
  const e = {}, n = s(t, [
    "modelSelectionConfig"
  ]);
  n != null && u(e, ["modelConfig"], n);
  const i = s(t, [
    "responseJsonSchema"
  ]);
  i != null && u(e, ["responseJsonSchema"], i);
  const r = s(t, [
    "audioTimestamp"
  ]);
  r != null && u(e, ["audioTimestamp"], r);
  const o = s(t, [
    "candidateCount"
  ]);
  o != null && u(e, ["candidateCount"], o);
  const a = s(t, [
    "enableAffectiveDialog"
  ]);
  a != null && u(e, ["enableAffectiveDialog"], a);
  const l = s(t, [
    "frequencyPenalty"
  ]);
  l != null && u(e, ["frequencyPenalty"], l);
  const f = s(t, ["logprobs"]);
  f != null && u(e, ["logprobs"], f);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  c != null && u(e, ["maxOutputTokens"], c);
  const d = s(t, [
    "mediaResolution"
  ]);
  d != null && u(e, ["mediaResolution"], d);
  const p = s(t, [
    "presencePenalty"
  ]);
  p != null && u(e, ["presencePenalty"], p);
  const h = s(t, [
    "responseLogprobs"
  ]);
  h != null && u(e, ["responseLogprobs"], h);
  const m = s(t, [
    "responseMimeType"
  ]);
  m != null && u(e, ["responseMimeType"], m);
  const g = s(t, [
    "responseModalities"
  ]);
  g != null && u(e, ["responseModalities"], g);
  const v = s(t, [
    "responseSchema"
  ]);
  v != null && u(e, ["responseSchema"], v);
  const E = s(t, [
    "routingConfig"
  ]);
  E != null && u(e, ["routingConfig"], E);
  const T = s(t, ["seed"]);
  T != null && u(e, ["seed"], T);
  const C = s(t, ["speechConfig"]);
  C != null && u(e, ["speechConfig"], C);
  const w = s(t, [
    "stopSequences"
  ]);
  w != null && u(e, ["stopSequences"], w);
  const D = s(t, ["temperature"]);
  D != null && u(e, ["temperature"], D);
  const _ = s(t, [
    "thinkingConfig"
  ]);
  _ != null && u(e, ["thinkingConfig"], _);
  const y = s(t, ["topK"]);
  y != null && u(e, ["topK"], y);
  const S = s(t, ["topP"]);
  if (S != null && u(e, ["topP"], S), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return e;
}
function vh(t) {
  const e = {}, n = s(t, ["authConfig"]);
  n != null && u(e, ["authConfig"], hh(n));
  const i = s(t, ["enableWidget"]);
  return i != null && u(e, ["enableWidget"], i), e;
}
function Eh(t) {
  const e = {}, n = s(t, ["searchTypes"]);
  if (n != null && u(e, ["searchTypes"], n), s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const i = s(t, [
    "timeRangeFilter"
  ]);
  return i != null && u(e, ["timeRangeFilter"], i), e;
}
function Th(t, e) {
  const n = {}, i = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && i != null && u(e, ["setup", "generationConfig"], i);
  const r = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && r != null && u(e, ["setup", "generationConfig", "responseModalities"], r);
  const o = s(t, ["temperature"]);
  e !== void 0 && o != null && u(e, ["setup", "generationConfig", "temperature"], o);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && u(e, ["setup", "generationConfig", "topP"], a);
  const l = s(t, ["topK"]);
  e !== void 0 && l != null && u(e, ["setup", "generationConfig", "topK"], l);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && f != null && u(e, ["setup", "generationConfig", "maxOutputTokens"], f);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && u(e, ["setup", "generationConfig", "mediaResolution"], c);
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && u(e, ["setup", "generationConfig", "seed"], d);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && u(e, ["setup", "generationConfig", "speechConfig"], Qi(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && u(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && u(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && u(e, ["setup", "systemInstruction"], ph(ye(g)));
  const v = s(t, ["tools"]);
  if (e !== void 0 && v != null) {
    let y = _t(v);
    Array.isArray(y) && (y = y.map((S) => xh(yt(S)))), u(e, ["setup", "tools"], y);
  }
  const E = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && E != null && u(e, ["setup", "sessionResumption"], Mh(E));
  const T = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && T != null && u(e, ["setup", "inputAudioTranscription"], T);
  const C = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && C != null && u(e, ["setup", "outputAudioTranscription"], C);
  const w = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && w != null && u(e, ["setup", "realtimeInputConfig"], w);
  const D = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && D != null && u(e, ["setup", "contextWindowCompression"], D);
  const _ = s(t, ["proactivity"]);
  if (e !== void 0 && _ != null && u(e, ["setup", "proactivity"], _), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function Sh(t, e) {
  const n = {}, i = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && i != null && u(e, ["setup", "generationConfig"], _h(i));
  const r = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && r != null && u(e, ["setup", "generationConfig", "responseModalities"], r);
  const o = s(t, ["temperature"]);
  e !== void 0 && o != null && u(e, ["setup", "generationConfig", "temperature"], o);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && u(e, ["setup", "generationConfig", "topP"], a);
  const l = s(t, ["topK"]);
  e !== void 0 && l != null && u(e, ["setup", "generationConfig", "topK"], l);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && f != null && u(e, ["setup", "generationConfig", "maxOutputTokens"], f);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && u(e, ["setup", "generationConfig", "mediaResolution"], c);
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && u(e, ["setup", "generationConfig", "seed"], d);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && u(e, ["setup", "generationConfig", "speechConfig"], Qi(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && u(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && u(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && u(e, ["setup", "systemInstruction"], ye(g));
  const v = s(t, ["tools"]);
  if (e !== void 0 && v != null) {
    let S = _t(v);
    Array.isArray(S) && (S = S.map((R) => Dh(yt(R)))), u(e, ["setup", "tools"], S);
  }
  const E = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && E != null && u(e, ["setup", "sessionResumption"], E);
  const T = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && T != null && u(e, ["setup", "inputAudioTranscription"], T);
  const C = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && C != null && u(e, ["setup", "outputAudioTranscription"], C);
  const w = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && w != null && u(e, ["setup", "realtimeInputConfig"], w);
  const D = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && D != null && u(e, ["setup", "contextWindowCompression"], D);
  const _ = s(t, ["proactivity"]);
  e !== void 0 && _ != null && u(e, ["setup", "proactivity"], _);
  const y = s(t, [
    "explicitVadSignal"
  ]);
  return e !== void 0 && y != null && u(e, ["setup", "explicitVadSignal"], y), n;
}
function Ch(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["setup", "model"], ie(t, i));
  const r = s(e, ["config"]);
  return r != null && u(n, ["config"], Th(r, n)), n;
}
function Ah(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["setup", "model"], ie(t, i));
  const r = s(e, ["config"]);
  return r != null && u(n, ["config"], Sh(r, n)), n;
}
function wh(t) {
  const e = {}, n = s(t, [
    "musicGenerationConfig"
  ]);
  return n != null && u(e, ["musicGenerationConfig"], n), e;
}
function Ih(t) {
  const e = {}, n = s(t, [
    "weightedPrompts"
  ]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((r) => r)), u(e, ["weightedPrompts"], i);
  }
  return e;
}
function Rh(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let c = cl(n);
    Array.isArray(c) && (c = c.map((d) => Cn(d))), u(e, ["mediaChunks"], c);
  }
  const i = s(t, ["audio"]);
  i != null && u(e, ["audio"], Cn(fl(i)));
  const r = s(t, [
    "audioStreamEnd"
  ]);
  r != null && u(e, ["audioStreamEnd"], r);
  const o = s(t, ["video"]);
  o != null && u(e, ["video"], Cn(ul(o)));
  const a = s(t, ["text"]);
  a != null && u(e, ["text"], a);
  const l = s(t, [
    "activityStart"
  ]);
  l != null && u(e, ["activityStart"], l);
  const f = s(t, ["activityEnd"]);
  return f != null && u(e, ["activityEnd"], f), e;
}
function Ph(t) {
  const e = {}, n = s(t, ["media"]);
  if (n != null) {
    let c = cl(n);
    Array.isArray(c) && (c = c.map((d) => d)), u(e, ["mediaChunks"], c);
  }
  const i = s(t, ["audio"]);
  i != null && u(e, ["audio"], fl(i));
  const r = s(t, [
    "audioStreamEnd"
  ]);
  r != null && u(e, ["audioStreamEnd"], r);
  const o = s(t, ["video"]);
  o != null && u(e, ["video"], ul(o));
  const a = s(t, ["text"]);
  a != null && u(e, ["text"], a);
  const l = s(t, [
    "activityStart"
  ]);
  l != null && u(e, ["activityStart"], l);
  const f = s(t, ["activityEnd"]);
  return f != null && u(e, ["activityEnd"], f), e;
}
function Nh(t) {
  const e = {}, n = s(t, [
    "setupComplete"
  ]);
  n != null && u(e, ["setupComplete"], n);
  const i = s(t, [
    "serverContent"
  ]);
  i != null && u(e, ["serverContent"], i);
  const r = s(t, ["toolCall"]);
  r != null && u(e, ["toolCall"], r);
  const o = s(t, [
    "toolCallCancellation"
  ]);
  o != null && u(e, ["toolCallCancellation"], o);
  const a = s(t, [
    "usageMetadata"
  ]);
  a != null && u(e, ["usageMetadata"], Uh(a));
  const l = s(t, ["goAway"]);
  l != null && u(e, ["goAway"], l);
  const f = s(t, [
    "sessionResumptionUpdate"
  ]);
  f != null && u(e, ["sessionResumptionUpdate"], f);
  const c = s(t, [
    "voiceActivityDetectionSignal"
  ]);
  c != null && u(e, ["voiceActivityDetectionSignal"], c);
  const d = s(t, [
    "voiceActivity"
  ]);
  return d != null && u(e, ["voiceActivity"], bh(d)), e;
}
function kh(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && u(e, ["mediaResolution"], n);
  const i = s(t, [
    "codeExecutionResult"
  ]);
  i != null && u(e, ["codeExecutionResult"], i);
  const r = s(t, [
    "executableCode"
  ]);
  r != null && u(e, ["executableCode"], r);
  const o = s(t, ["fileData"]);
  o != null && u(e, ["fileData"], mh(o));
  const a = s(t, ["functionCall"]);
  a != null && u(e, ["functionCall"], gh(a));
  const l = s(t, [
    "functionResponse"
  ]);
  l != null && u(e, ["functionResponse"], l);
  const f = s(t, ["inlineData"]);
  f != null && u(e, ["inlineData"], Cn(f));
  const c = s(t, ["text"]);
  c != null && u(e, ["text"], c);
  const d = s(t, ["thought"]);
  d != null && u(e, ["thought"], d);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && u(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && u(e, ["videoMetadata"], h), e;
}
function Mh(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && u(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function xh(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && u(e, ["computerUse"], n);
  const i = s(t, ["fileSearch"]);
  i != null && u(e, ["fileSearch"], i);
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], Eh(r));
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], vh(o));
  const a = s(t, [
    "codeExecution"
  ]);
  if (a != null && u(e, ["codeExecution"], a), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(t, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["functionDeclarations"], p);
  }
  const f = s(t, [
    "googleSearchRetrieval"
  ]);
  if (f != null && u(e, ["googleSearchRetrieval"], f), s(t, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(t, ["urlContext"]);
  c != null && u(e, ["urlContext"], c);
  const d = s(t, ["mcpServers"]);
  if (d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["mcpServers"], p);
  }
  return e;
}
function Dh(t) {
  const e = {}, n = s(t, ["retrieval"]);
  n != null && u(e, ["retrieval"], n);
  const i = s(t, ["computerUse"]);
  if (i != null && u(e, ["computerUse"], i), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], r);
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], o);
  const a = s(t, [
    "codeExecution"
  ]);
  a != null && u(e, ["codeExecution"], a);
  const l = s(t, [
    "enterpriseWebSearch"
  ]);
  l != null && u(e, ["enterpriseWebSearch"], l);
  const f = s(t, [
    "functionDeclarations"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((m) => yh(m))), u(e, ["functionDeclarations"], h);
  }
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  c != null && u(e, ["googleSearchRetrieval"], c);
  const d = s(t, [
    "parallelAiSearch"
  ]);
  d != null && u(e, ["parallelAiSearch"], d);
  const p = s(t, ["urlContext"]);
  if (p != null && u(e, ["urlContext"], p), s(t, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return e;
}
function Uh(t) {
  const e = {}, n = s(t, [
    "promptTokenCount"
  ]);
  n != null && u(e, ["promptTokenCount"], n);
  const i = s(t, [
    "cachedContentTokenCount"
  ]);
  i != null && u(e, ["cachedContentTokenCount"], i);
  const r = s(t, [
    "candidatesTokenCount"
  ]);
  r != null && u(e, ["responseTokenCount"], r);
  const o = s(t, [
    "toolUsePromptTokenCount"
  ]);
  o != null && u(e, ["toolUsePromptTokenCount"], o);
  const a = s(t, [
    "thoughtsTokenCount"
  ]);
  a != null && u(e, ["thoughtsTokenCount"], a);
  const l = s(t, [
    "totalTokenCount"
  ]);
  l != null && u(e, ["totalTokenCount"], l);
  const f = s(t, [
    "promptTokensDetails"
  ]);
  if (f != null) {
    let m = f;
    Array.isArray(m) && (m = m.map((g) => g)), u(e, ["promptTokensDetails"], m);
  }
  const c = s(t, [
    "cacheTokensDetails"
  ]);
  if (c != null) {
    let m = c;
    Array.isArray(m) && (m = m.map((g) => g)), u(e, ["cacheTokensDetails"], m);
  }
  const d = s(t, [
    "candidatesTokensDetails"
  ]);
  if (d != null) {
    let m = d;
    Array.isArray(m) && (m = m.map((g) => g)), u(e, ["responseTokensDetails"], m);
  }
  const p = s(t, [
    "toolUsePromptTokensDetails"
  ]);
  if (p != null) {
    let m = p;
    Array.isArray(m) && (m = m.map((g) => g)), u(e, ["toolUsePromptTokensDetails"], m);
  }
  const h = s(t, ["trafficType"]);
  return h != null && u(e, ["trafficType"], h), e;
}
function bh(t) {
  const e = {}, n = s(t, ["type"]);
  return n != null && u(e, ["voiceActivityType"], n), e;
}
function Lh(t, e) {
  const n = {}, i = s(t, ["apiKey"]);
  if (i != null && u(n, ["apiKey"], i), s(t, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(t, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(t, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(t, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return n;
}
function Oh(t, e) {
  const n = {}, i = s(t, ["data"]);
  if (i != null && u(n, ["data"], i), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(t, ["mimeType"]);
  return r != null && u(n, ["mimeType"], r), n;
}
function Fh(t, e) {
  const n = {}, i = s(t, ["content"]);
  i != null && u(n, ["content"], i);
  const r = s(t, [
    "citationMetadata"
  ]);
  r != null && u(n, ["citationMetadata"], Gh(r));
  const o = s(t, ["tokenCount"]);
  o != null && u(n, ["tokenCount"], o);
  const a = s(t, ["finishReason"]);
  a != null && u(n, ["finishReason"], a);
  const l = s(t, [
    "groundingMetadata"
  ]);
  l != null && u(n, ["groundingMetadata"], l);
  const f = s(t, ["avgLogprobs"]);
  f != null && u(n, ["avgLogprobs"], f);
  const c = s(t, ["index"]);
  c != null && u(n, ["index"], c);
  const d = s(t, [
    "logprobsResult"
  ]);
  d != null && u(n, ["logprobsResult"], d);
  const p = s(t, [
    "safetyRatings"
  ]);
  if (p != null) {
    let m = p;
    Array.isArray(m) && (m = m.map((g) => g)), u(n, ["safetyRatings"], m);
  }
  const h = s(t, [
    "urlContextMetadata"
  ]);
  return h != null && u(n, ["urlContextMetadata"], h), n;
}
function Gh(t, e) {
  const n = {}, i = s(t, ["citationSources"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((o) => o)), u(n, ["citations"], r);
  }
  return n;
}
function qh(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let a = Ae(o);
    Array.isArray(a) && (a = a.map((l) => l)), u(i, ["contents"], a);
  }
  return i;
}
function Bh(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["tokensInfo"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["tokensInfo"], o);
  }
  return n;
}
function Hh(t, e) {
  const n = {}, i = s(t, ["values"]);
  i != null && u(n, ["values"], i);
  const r = s(t, ["statistics"]);
  return r != null && u(n, ["statistics"], Vh(r)), n;
}
function Vh(t, e) {
  const n = {}, i = s(t, ["truncated"]);
  i != null && u(n, ["truncated"], i);
  const r = s(t, ["token_count"]);
  return r != null && u(n, ["tokenCount"], r), n;
}
function un(t, e) {
  const n = {}, i = s(t, ["parts"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => Zp(a))), u(n, ["parts"], o);
  }
  const r = s(t, ["role"]);
  return r != null && u(n, ["role"], r), n;
}
function Jh(t, e) {
  const n = {}, i = s(t, ["controlType"]);
  i != null && u(n, ["controlType"], i);
  const r = s(t, [
    "enableControlImageComputation"
  ]);
  return r != null && u(n, ["computeControl"], r), n;
}
function $h(t, e) {
  const n = {};
  if (s(t, ["systemInstruction"]) !== void 0)
    throw new Error("systemInstruction parameter is not supported in Gemini API.");
  if (s(t, ["tools"]) !== void 0)
    throw new Error("tools parameter is not supported in Gemini API.");
  if (s(t, ["generationConfig"]) !== void 0)
    throw new Error("generationConfig parameter is not supported in Gemini API.");
  return n;
}
function Wh(t, e, n) {
  const i = {}, r = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && r != null && u(e, ["systemInstruction"], ye(r));
  const o = s(t, ["tools"]);
  if (e !== void 0 && o != null) {
    let l = o;
    Array.isArray(l) && (l = l.map((f) => Il(f))), u(e, ["tools"], l);
  }
  const a = s(t, [
    "generationConfig"
  ]);
  return e !== void 0 && a != null && u(e, ["generationConfig"], Op(a)), i;
}
function Kh(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((f) => un(f))), u(i, ["contents"], l);
  }
  const a = s(e, ["config"]);
  return a != null && $h(a), i;
}
function Yh(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((f) => f)), u(i, ["contents"], l);
  }
  const a = s(e, ["config"]);
  return a != null && Wh(a, i), i;
}
function zh(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["totalTokens"]);
  r != null && u(n, ["totalTokens"], r);
  const o = s(t, [
    "cachedContentTokenCount"
  ]);
  return o != null && u(n, ["cachedContentTokenCount"], o), n;
}
function Xh(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["totalTokens"]);
  return r != null && u(n, ["totalTokens"], r), n;
}
function Qh(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  return r != null && u(i, ["_url", "name"], ie(t, r)), i;
}
function Zh(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  return r != null && u(i, ["_url", "name"], ie(t, r)), i;
}
function jh(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  return i != null && u(n, ["sdkHttpResponse"], i), n;
}
function ep(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  return i != null && u(n, ["sdkHttpResponse"], i), n;
}
function tp(t, e, n) {
  const i = {}, r = s(t, ["outputGcsUri"]);
  e !== void 0 && r != null && u(e, ["parameters", "storageUri"], r);
  const o = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && o != null && u(e, ["parameters", "negativePrompt"], o);
  const a = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && u(e, ["parameters", "sampleCount"], a);
  const l = s(t, ["aspectRatio"]);
  e !== void 0 && l != null && u(e, ["parameters", "aspectRatio"], l);
  const f = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "guidanceScale"], f);
  const c = s(t, ["seed"]);
  e !== void 0 && c != null && u(e, ["parameters", "seed"], c);
  const d = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && d != null && u(e, ["parameters", "safetySetting"], d);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && u(e, ["parameters", "personGeneration"], p);
  const h = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && h != null && u(e, ["parameters", "includeSafetyAttributes"], h);
  const m = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && m != null && u(e, ["parameters", "includeRaiReason"], m);
  const g = s(t, ["language"]);
  e !== void 0 && g != null && u(e, ["parameters", "language"], g);
  const v = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && v != null && u(e, ["parameters", "outputOptions", "mimeType"], v);
  const E = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && E != null && u(e, ["parameters", "outputOptions", "compressionQuality"], E);
  const T = s(t, ["addWatermark"]);
  e !== void 0 && T != null && u(e, ["parameters", "addWatermark"], T);
  const C = s(t, ["labels"]);
  e !== void 0 && C != null && u(e, ["labels"], C);
  const w = s(t, ["editMode"]);
  e !== void 0 && w != null && u(e, ["parameters", "editMode"], w);
  const D = s(t, ["baseSteps"]);
  return e !== void 0 && D != null && u(e, ["parameters", "editConfig", "baseSteps"], D), i;
}
function np(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["prompt"]);
  o != null && u(i, ["instances[0]", "prompt"], o);
  const a = s(e, [
    "referenceImages"
  ]);
  if (a != null) {
    let f = a;
    Array.isArray(f) && (f = f.map((c) => rm(c))), u(i, ["instances[0]", "referenceImages"], f);
  }
  const l = s(e, ["config"]);
  return l != null && tp(l, i), i;
}
function ip(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "predictions"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => On(a))), u(n, ["generatedImages"], o);
  }
  return n;
}
function rp(t, e, n) {
  const i = {}, r = s(t, ["taskType"]);
  e !== void 0 && r != null && u(e, ["requests[]", "taskType"], r);
  const o = s(t, ["title"]);
  e !== void 0 && o != null && u(e, ["requests[]", "title"], o);
  const a = s(t, [
    "outputDimensionality"
  ]);
  if (e !== void 0 && a != null && u(e, ["requests[]", "outputDimensionality"], a), s(t, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(t, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return i;
}
function op(t, e, n) {
  const i = {};
  let r = s(n, [
    "embeddingApiType"
  ]);
  if (r === void 0 && (r = "PREDICT"), r === "PREDICT") {
    const c = s(t, ["taskType"]);
    e !== void 0 && c != null && u(e, ["instances[]", "task_type"], c);
  } else if (r === "EMBED_CONTENT") {
    const c = s(t, ["taskType"]);
    e !== void 0 && c != null && u(e, ["taskType"], c);
  }
  let o = s(n, [
    "embeddingApiType"
  ]);
  if (o === void 0 && (o = "PREDICT"), o === "PREDICT") {
    const c = s(t, ["title"]);
    e !== void 0 && c != null && u(e, ["instances[]", "title"], c);
  } else if (o === "EMBED_CONTENT") {
    const c = s(t, ["title"]);
    e !== void 0 && c != null && u(e, ["title"], c);
  }
  let a = s(n, [
    "embeddingApiType"
  ]);
  if (a === void 0 && (a = "PREDICT"), a === "PREDICT") {
    const c = s(t, [
      "outputDimensionality"
    ]);
    e !== void 0 && c != null && u(e, ["parameters", "outputDimensionality"], c);
  } else if (a === "EMBED_CONTENT") {
    const c = s(t, [
      "outputDimensionality"
    ]);
    e !== void 0 && c != null && u(e, ["outputDimensionality"], c);
  }
  let l = s(n, [
    "embeddingApiType"
  ]);
  if (l === void 0 && (l = "PREDICT"), l === "PREDICT") {
    const c = s(t, ["mimeType"]);
    e !== void 0 && c != null && u(e, ["instances[]", "mimeType"], c);
  }
  let f = s(n, [
    "embeddingApiType"
  ]);
  if (f === void 0 && (f = "PREDICT"), f === "PREDICT") {
    const c = s(t, [
      "autoTruncate"
    ]);
    e !== void 0 && c != null && u(e, ["parameters", "autoTruncate"], c);
  } else if (f === "EMBED_CONTENT") {
    const c = s(t, [
      "autoTruncate"
    ]);
    e !== void 0 && c != null && u(e, ["autoTruncate"], c);
  }
  return i;
}
function sp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let c = Yi(t, o);
    Array.isArray(c) && (c = c.map((d) => d)), u(i, ["requests[]", "content"], c);
  }
  const a = s(e, ["content"]);
  a != null && un(ye(a));
  const l = s(e, ["config"]);
  l != null && rp(l, i);
  const f = s(e, ["model"]);
  return f !== void 0 && u(i, ["requests[]", "model"], ie(t, f)), i;
}
function ap(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  let o = s(n, [
    "embeddingApiType"
  ]);
  if (o === void 0 && (o = "PREDICT"), o === "PREDICT") {
    const f = s(e, ["contents"]);
    if (f != null) {
      let c = Yi(t, f);
      Array.isArray(c) && (c = c.map((d) => d)), u(i, ["instances[]", "content"], c);
    }
  }
  let a = s(n, [
    "embeddingApiType"
  ]);
  if (a === void 0 && (a = "PREDICT"), a === "EMBED_CONTENT") {
    const f = s(e, ["content"]);
    f != null && u(i, ["content"], ye(f));
  }
  const l = s(e, ["config"]);
  return l != null && op(l, i, n), i;
}
function lp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["embeddings"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => l)), u(n, ["embeddings"], a);
  }
  const o = s(t, ["metadata"]);
  return o != null && u(n, ["metadata"], o), n;
}
function cp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "predictions[]",
    "embeddings"
  ]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => Hh(l))), u(n, ["embeddings"], a);
  }
  const o = s(t, ["metadata"]);
  if (o != null && u(n, ["metadata"], o), e && s(e, ["embeddingApiType"]) === "EMBED_CONTENT") {
    const a = s(t, ["embedding"]), l = s(t, ["usageMetadata"]), f = s(t, ["truncated"]);
    if (a) {
      const c = {};
      l && l.promptTokenCount && (c.tokenCount = l.promptTokenCount), f && (c.truncated = f), a.statistics = c, u(n, ["embeddings"], [a]);
    }
  }
  return n;
}
function up(t, e) {
  const n = {}, i = s(t, ["endpoint"]);
  i != null && u(n, ["name"], i);
  const r = s(t, [
    "deployedModelId"
  ]);
  return r != null && u(n, ["deployedModelId"], r), n;
}
function fp(t, e) {
  const n = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["fileUri"]);
  i != null && u(n, ["fileUri"], i);
  const r = s(t, ["mimeType"]);
  return r != null && u(n, ["mimeType"], r), n;
}
function dp(t, e) {
  const n = {}, i = s(t, ["id"]);
  i != null && u(n, ["id"], i);
  const r = s(t, ["args"]);
  r != null && u(n, ["args"], r);
  const o = s(t, ["name"]);
  if (o != null && u(n, ["name"], o), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return n;
}
function hp(t, e) {
  const n = {}, i = s(t, [
    "allowedFunctionNames"
  ]);
  i != null && u(n, ["allowedFunctionNames"], i);
  const r = s(t, ["mode"]);
  if (r != null && u(n, ["mode"], r), s(t, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return n;
}
function pp(t, e) {
  const n = {}, i = s(t, ["description"]);
  i != null && u(n, ["description"], i);
  const r = s(t, ["name"]);
  r != null && u(n, ["name"], r);
  const o = s(t, ["parameters"]);
  o != null && u(n, ["parameters"], o);
  const a = s(t, [
    "parametersJsonSchema"
  ]);
  a != null && u(n, ["parametersJsonSchema"], a);
  const l = s(t, ["response"]);
  l != null && u(n, ["response"], l);
  const f = s(t, [
    "responseJsonSchema"
  ]);
  if (f != null && u(n, ["responseJsonSchema"], f), s(t, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return n;
}
function mp(t, e, n, i) {
  const r = {}, o = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && o != null && u(n, ["systemInstruction"], un(ye(o)));
  const a = s(e, ["temperature"]);
  a != null && u(r, ["temperature"], a);
  const l = s(e, ["topP"]);
  l != null && u(r, ["topP"], l);
  const f = s(e, ["topK"]);
  f != null && u(r, ["topK"], f);
  const c = s(e, [
    "candidateCount"
  ]);
  c != null && u(r, ["candidateCount"], c);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  d != null && u(r, ["maxOutputTokens"], d);
  const p = s(e, [
    "stopSequences"
  ]);
  p != null && u(r, ["stopSequences"], p);
  const h = s(e, [
    "responseLogprobs"
  ]);
  h != null && u(r, ["responseLogprobs"], h);
  const m = s(e, ["logprobs"]);
  m != null && u(r, ["logprobs"], m);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && u(r, ["presencePenalty"], g);
  const v = s(e, [
    "frequencyPenalty"
  ]);
  v != null && u(r, ["frequencyPenalty"], v);
  const E = s(e, ["seed"]);
  E != null && u(r, ["seed"], E);
  const T = s(e, [
    "responseMimeType"
  ]);
  T != null && u(r, ["responseMimeType"], T);
  const C = s(e, [
    "responseSchema"
  ]);
  C != null && u(r, ["responseSchema"], zi(C));
  const w = s(e, [
    "responseJsonSchema"
  ]);
  if (w != null && u(r, ["responseJsonSchema"], w), s(e, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(e, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const D = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && D != null) {
    let J = D;
    Array.isArray(J) && (J = J.map((W) => om(W))), u(n, ["safetySettings"], J);
  }
  const _ = s(e, ["tools"]);
  if (n !== void 0 && _ != null) {
    let J = _t(_);
    Array.isArray(J) && (J = J.map((W) => dm(yt(W)))), u(n, ["tools"], J);
  }
  const y = s(e, ["toolConfig"]);
  if (n !== void 0 && y != null && u(n, ["toolConfig"], fm(y)), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const S = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && S != null && u(n, ["cachedContent"], Ve(t, S));
  const R = s(e, [
    "responseModalities"
  ]);
  R != null && u(r, ["responseModalities"], R);
  const P = s(e, [
    "mediaResolution"
  ]);
  P != null && u(r, ["mediaResolution"], P);
  const N = s(e, ["speechConfig"]);
  if (N != null && u(r, ["speechConfig"], Xi(N)), s(e, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const G = s(e, [
    "thinkingConfig"
  ]);
  G != null && u(r, ["thinkingConfig"], G);
  const V = s(e, ["imageConfig"]);
  V != null && u(r, ["imageConfig"], Hp(V));
  const q = s(e, [
    "enableEnhancedCivicAnswers"
  ]);
  if (q != null && u(r, ["enableEnhancedCivicAnswers"], q), s(e, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return r;
}
function gp(t, e, n, i) {
  const r = {}, o = s(e, [
    "systemInstruction"
  ]);
  n !== void 0 && o != null && u(n, ["systemInstruction"], ye(o));
  const a = s(e, ["temperature"]);
  a != null && u(r, ["temperature"], a);
  const l = s(e, ["topP"]);
  l != null && u(r, ["topP"], l);
  const f = s(e, ["topK"]);
  f != null && u(r, ["topK"], f);
  const c = s(e, [
    "candidateCount"
  ]);
  c != null && u(r, ["candidateCount"], c);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  d != null && u(r, ["maxOutputTokens"], d);
  const p = s(e, [
    "stopSequences"
  ]);
  p != null && u(r, ["stopSequences"], p);
  const h = s(e, [
    "responseLogprobs"
  ]);
  h != null && u(r, ["responseLogprobs"], h);
  const m = s(e, ["logprobs"]);
  m != null && u(r, ["logprobs"], m);
  const g = s(e, [
    "presencePenalty"
  ]);
  g != null && u(r, ["presencePenalty"], g);
  const v = s(e, [
    "frequencyPenalty"
  ]);
  v != null && u(r, ["frequencyPenalty"], v);
  const E = s(e, ["seed"]);
  E != null && u(r, ["seed"], E);
  const T = s(e, [
    "responseMimeType"
  ]);
  T != null && u(r, ["responseMimeType"], T);
  const C = s(e, [
    "responseSchema"
  ]);
  C != null && u(r, ["responseSchema"], zi(C));
  const w = s(e, [
    "responseJsonSchema"
  ]);
  w != null && u(r, ["responseJsonSchema"], w);
  const D = s(e, [
    "routingConfig"
  ]);
  D != null && u(r, ["routingConfig"], D);
  const _ = s(e, [
    "modelSelectionConfig"
  ]);
  _ != null && u(r, ["modelConfig"], _);
  const y = s(e, [
    "safetySettings"
  ]);
  if (n !== void 0 && y != null) {
    let Z = y;
    Array.isArray(Z) && (Z = Z.map((le) => le)), u(n, ["safetySettings"], Z);
  }
  const S = s(e, ["tools"]);
  if (n !== void 0 && S != null) {
    let Z = _t(S);
    Array.isArray(Z) && (Z = Z.map((le) => Il(yt(le)))), u(n, ["tools"], Z);
  }
  const R = s(e, ["toolConfig"]);
  n !== void 0 && R != null && u(n, ["toolConfig"], R);
  const P = s(e, ["labels"]);
  n !== void 0 && P != null && u(n, ["labels"], P);
  const N = s(e, [
    "cachedContent"
  ]);
  n !== void 0 && N != null && u(n, ["cachedContent"], Ve(t, N));
  const G = s(e, [
    "responseModalities"
  ]);
  G != null && u(r, ["responseModalities"], G);
  const V = s(e, [
    "mediaResolution"
  ]);
  V != null && u(r, ["mediaResolution"], V);
  const q = s(e, ["speechConfig"]);
  q != null && u(r, ["speechConfig"], Xi(q));
  const J = s(e, [
    "audioTimestamp"
  ]);
  J != null && u(r, ["audioTimestamp"], J);
  const W = s(e, [
    "thinkingConfig"
  ]);
  W != null && u(r, ["thinkingConfig"], W);
  const $ = s(e, ["imageConfig"]);
  if ($ != null && u(r, ["imageConfig"], Vp($)), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const X = s(e, [
    "modelArmorConfig"
  ]);
  return n !== void 0 && X != null && u(n, ["modelArmorConfig"], X), r;
}
function aa(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((f) => un(f))), u(i, ["contents"], l);
  }
  const a = s(e, ["config"]);
  return a != null && u(i, ["generationConfig"], mp(t, a, i)), i;
}
function la(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((f) => f)), u(i, ["contents"], l);
  }
  const a = s(e, ["config"]);
  return a != null && u(i, ["generationConfig"], gp(t, a, i)), i;
}
function ca(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["candidates"]);
  if (r != null) {
    let c = r;
    Array.isArray(c) && (c = c.map((d) => Fh(d))), u(n, ["candidates"], c);
  }
  const o = s(t, ["modelVersion"]);
  o != null && u(n, ["modelVersion"], o);
  const a = s(t, [
    "promptFeedback"
  ]);
  a != null && u(n, ["promptFeedback"], a);
  const l = s(t, ["responseId"]);
  l != null && u(n, ["responseId"], l);
  const f = s(t, [
    "usageMetadata"
  ]);
  return f != null && u(n, ["usageMetadata"], f), n;
}
function ua(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["candidates"]);
  if (r != null) {
    let d = r;
    Array.isArray(d) && (d = d.map((p) => p)), u(n, ["candidates"], d);
  }
  const o = s(t, ["createTime"]);
  o != null && u(n, ["createTime"], o);
  const a = s(t, ["modelVersion"]);
  a != null && u(n, ["modelVersion"], a);
  const l = s(t, [
    "promptFeedback"
  ]);
  l != null && u(n, ["promptFeedback"], l);
  const f = s(t, ["responseId"]);
  f != null && u(n, ["responseId"], f);
  const c = s(t, [
    "usageMetadata"
  ]);
  return c != null && u(n, ["usageMetadata"], c), n;
}
function yp(t, e, n) {
  const i = {};
  if (s(t, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(t, ["negativePrompt"]) !== void 0)
    throw new Error("negativePrompt parameter is not supported in Gemini API.");
  const r = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && r != null && u(e, ["parameters", "sampleCount"], r);
  const o = s(t, ["aspectRatio"]);
  e !== void 0 && o != null && u(e, ["parameters", "aspectRatio"], o);
  const a = s(t, [
    "guidanceScale"
  ]);
  if (e !== void 0 && a != null && u(e, ["parameters", "guidanceScale"], a), s(t, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const l = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && l != null && u(e, ["parameters", "safetySetting"], l);
  const f = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "personGeneration"], f);
  const c = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && c != null && u(e, ["parameters", "includeSafetyAttributes"], c);
  const d = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && d != null && u(e, ["parameters", "includeRaiReason"], d);
  const p = s(t, ["language"]);
  e !== void 0 && p != null && u(e, ["parameters", "language"], p);
  const h = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && h != null && u(e, ["parameters", "outputOptions", "mimeType"], h);
  const m = s(t, [
    "outputCompressionQuality"
  ]);
  if (e !== void 0 && m != null && u(e, ["parameters", "outputOptions", "compressionQuality"], m), s(t, ["addWatermark"]) !== void 0)
    throw new Error("addWatermark parameter is not supported in Gemini API.");
  if (s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const g = s(t, ["imageSize"]);
  if (e !== void 0 && g != null && u(e, ["parameters", "sampleImageSize"], g), s(t, ["enhancePrompt"]) !== void 0)
    throw new Error("enhancePrompt parameter is not supported in Gemini API.");
  return i;
}
function _p(t, e, n) {
  const i = {}, r = s(t, ["outputGcsUri"]);
  e !== void 0 && r != null && u(e, ["parameters", "storageUri"], r);
  const o = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && o != null && u(e, ["parameters", "negativePrompt"], o);
  const a = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && a != null && u(e, ["parameters", "sampleCount"], a);
  const l = s(t, ["aspectRatio"]);
  e !== void 0 && l != null && u(e, ["parameters", "aspectRatio"], l);
  const f = s(t, [
    "guidanceScale"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "guidanceScale"], f);
  const c = s(t, ["seed"]);
  e !== void 0 && c != null && u(e, ["parameters", "seed"], c);
  const d = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && d != null && u(e, ["parameters", "safetySetting"], d);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && u(e, ["parameters", "personGeneration"], p);
  const h = s(t, [
    "includeSafetyAttributes"
  ]);
  e !== void 0 && h != null && u(e, ["parameters", "includeSafetyAttributes"], h);
  const m = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && m != null && u(e, ["parameters", "includeRaiReason"], m);
  const g = s(t, ["language"]);
  e !== void 0 && g != null && u(e, ["parameters", "language"], g);
  const v = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && v != null && u(e, ["parameters", "outputOptions", "mimeType"], v);
  const E = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && E != null && u(e, ["parameters", "outputOptions", "compressionQuality"], E);
  const T = s(t, ["addWatermark"]);
  e !== void 0 && T != null && u(e, ["parameters", "addWatermark"], T);
  const C = s(t, ["labels"]);
  e !== void 0 && C != null && u(e, ["labels"], C);
  const w = s(t, ["imageSize"]);
  e !== void 0 && w != null && u(e, ["parameters", "sampleImageSize"], w);
  const D = s(t, [
    "enhancePrompt"
  ]);
  return e !== void 0 && D != null && u(e, ["parameters", "enhancePrompt"], D), i;
}
function vp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["prompt"]);
  o != null && u(i, ["instances[0]", "prompt"], o);
  const a = s(e, ["config"]);
  return a != null && yp(a, i), i;
}
function Ep(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["prompt"]);
  o != null && u(i, ["instances[0]", "prompt"], o);
  const a = s(e, ["config"]);
  return a != null && _p(a, i), i;
}
function Tp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "predictions"
  ]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => Dp(l))), u(n, ["generatedImages"], a);
  }
  const o = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return o != null && u(n, ["positivePromptSafetyAttributes"], Al(o)), n;
}
function Sp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "predictions"
  ]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => On(l))), u(n, ["generatedImages"], a);
  }
  const o = s(t, [
    "positivePromptSafetyAttributes"
  ]);
  return o != null && u(n, ["positivePromptSafetyAttributes"], wl(o)), n;
}
function Cp(t, e, n) {
  const i = {}, r = s(t, [
    "numberOfVideos"
  ]);
  if (e !== void 0 && r != null && u(e, ["parameters", "sampleCount"], r), s(t, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(t, ["fps"]) !== void 0)
    throw new Error("fps parameter is not supported in Gemini API.");
  const o = s(t, [
    "durationSeconds"
  ]);
  if (e !== void 0 && o != null && u(e, ["parameters", "durationSeconds"], o), s(t, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const a = s(t, ["aspectRatio"]);
  e !== void 0 && a != null && u(e, ["parameters", "aspectRatio"], a);
  const l = s(t, ["resolution"]);
  e !== void 0 && l != null && u(e, ["parameters", "resolution"], l);
  const f = s(t, [
    "personGeneration"
  ]);
  if (e !== void 0 && f != null && u(e, ["parameters", "personGeneration"], f), s(t, ["pubsubTopic"]) !== void 0)
    throw new Error("pubsubTopic parameter is not supported in Gemini API.");
  const c = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && c != null && u(e, ["parameters", "negativePrompt"], c);
  const d = s(t, [
    "enhancePrompt"
  ]);
  if (e !== void 0 && d != null && u(e, ["parameters", "enhancePrompt"], d), s(t, ["generateAudio"]) !== void 0)
    throw new Error("generateAudio parameter is not supported in Gemini API.");
  const p = s(t, ["lastFrame"]);
  e !== void 0 && p != null && u(e, ["instances[0]", "lastFrame"], Fn(p));
  const h = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && h != null) {
    let m = h;
    Array.isArray(m) && (m = m.map((g) => wm(g))), u(e, ["instances[0]", "referenceImages"], m);
  }
  if (s(t, ["mask"]) !== void 0)
    throw new Error("mask parameter is not supported in Gemini API.");
  if (s(t, ["compressionQuality"]) !== void 0)
    throw new Error("compressionQuality parameter is not supported in Gemini API.");
  return i;
}
function Ap(t, e, n) {
  const i = {}, r = s(t, [
    "numberOfVideos"
  ]);
  e !== void 0 && r != null && u(e, ["parameters", "sampleCount"], r);
  const o = s(t, ["outputGcsUri"]);
  e !== void 0 && o != null && u(e, ["parameters", "storageUri"], o);
  const a = s(t, ["fps"]);
  e !== void 0 && a != null && u(e, ["parameters", "fps"], a);
  const l = s(t, [
    "durationSeconds"
  ]);
  e !== void 0 && l != null && u(e, ["parameters", "durationSeconds"], l);
  const f = s(t, ["seed"]);
  e !== void 0 && f != null && u(e, ["parameters", "seed"], f);
  const c = s(t, ["aspectRatio"]);
  e !== void 0 && c != null && u(e, ["parameters", "aspectRatio"], c);
  const d = s(t, ["resolution"]);
  e !== void 0 && d != null && u(e, ["parameters", "resolution"], d);
  const p = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && p != null && u(e, ["parameters", "personGeneration"], p);
  const h = s(t, ["pubsubTopic"]);
  e !== void 0 && h != null && u(e, ["parameters", "pubsubTopic"], h);
  const m = s(t, [
    "negativePrompt"
  ]);
  e !== void 0 && m != null && u(e, ["parameters", "negativePrompt"], m);
  const g = s(t, [
    "enhancePrompt"
  ]);
  e !== void 0 && g != null && u(e, ["parameters", "enhancePrompt"], g);
  const v = s(t, [
    "generateAudio"
  ]);
  e !== void 0 && v != null && u(e, ["parameters", "generateAudio"], v);
  const E = s(t, ["lastFrame"]);
  e !== void 0 && E != null && u(e, ["instances[0]", "lastFrame"], Ue(E));
  const T = s(t, [
    "referenceImages"
  ]);
  if (e !== void 0 && T != null) {
    let D = T;
    Array.isArray(D) && (D = D.map((_) => Im(_))), u(e, ["instances[0]", "referenceImages"], D);
  }
  const C = s(t, ["mask"]);
  e !== void 0 && C != null && u(e, ["instances[0]", "mask"], Am(C));
  const w = s(t, [
    "compressionQuality"
  ]);
  return e !== void 0 && w != null && u(e, ["parameters", "compressionQuality"], w), i;
}
function wp(t, e) {
  const n = {}, i = s(t, ["name"]);
  i != null && u(n, ["name"], i);
  const r = s(t, ["metadata"]);
  r != null && u(n, ["metadata"], r);
  const o = s(t, ["done"]);
  o != null && u(n, ["done"], o);
  const a = s(t, ["error"]);
  a != null && u(n, ["error"], a);
  const l = s(t, [
    "response",
    "generateVideoResponse"
  ]);
  return l != null && u(n, ["response"], Np(l)), n;
}
function Ip(t, e) {
  const n = {}, i = s(t, ["name"]);
  i != null && u(n, ["name"], i);
  const r = s(t, ["metadata"]);
  r != null && u(n, ["metadata"], r);
  const o = s(t, ["done"]);
  o != null && u(n, ["done"], o);
  const a = s(t, ["error"]);
  a != null && u(n, ["error"], a);
  const l = s(t, ["response"]);
  return l != null && u(n, ["response"], kp(l)), n;
}
function Rp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["prompt"]);
  o != null && u(i, ["instances[0]", "prompt"], o);
  const a = s(e, ["image"]);
  a != null && u(i, ["instances[0]", "image"], Fn(a));
  const l = s(e, ["video"]);
  l != null && u(i, ["instances[0]", "video"], Rl(l));
  const f = s(e, ["source"]);
  f != null && Mp(f, i);
  const c = s(e, ["config"]);
  return c != null && Cp(c, i), i;
}
function Pp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["prompt"]);
  o != null && u(i, ["instances[0]", "prompt"], o);
  const a = s(e, ["image"]);
  a != null && u(i, ["instances[0]", "image"], Ue(a));
  const l = s(e, ["video"]);
  l != null && u(i, ["instances[0]", "video"], Pl(l));
  const f = s(e, ["source"]);
  f != null && xp(f, i);
  const c = s(e, ["config"]);
  return c != null && Ap(c, i), i;
}
function Np(t, e) {
  const n = {}, i = s(t, [
    "generatedSamples"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => bp(l))), u(n, ["generatedVideos"], a);
  }
  const r = s(t, [
    "raiMediaFilteredCount"
  ]);
  r != null && u(n, ["raiMediaFilteredCount"], r);
  const o = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return o != null && u(n, ["raiMediaFilteredReasons"], o), n;
}
function kp(t, e) {
  const n = {}, i = s(t, ["videos"]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => Lp(l))), u(n, ["generatedVideos"], a);
  }
  const r = s(t, [
    "raiMediaFilteredCount"
  ]);
  r != null && u(n, ["raiMediaFilteredCount"], r);
  const o = s(t, [
    "raiMediaFilteredReasons"
  ]);
  return o != null && u(n, ["raiMediaFilteredReasons"], o), n;
}
function Mp(t, e, n) {
  const i = {}, r = s(t, ["prompt"]);
  e !== void 0 && r != null && u(e, ["instances[0]", "prompt"], r);
  const o = s(t, ["image"]);
  e !== void 0 && o != null && u(e, ["instances[0]", "image"], Fn(o));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && u(e, ["instances[0]", "video"], Rl(a)), i;
}
function xp(t, e, n) {
  const i = {}, r = s(t, ["prompt"]);
  e !== void 0 && r != null && u(e, ["instances[0]", "prompt"], r);
  const o = s(t, ["image"]);
  e !== void 0 && o != null && u(e, ["instances[0]", "image"], Ue(o));
  const a = s(t, ["video"]);
  return e !== void 0 && a != null && u(e, ["instances[0]", "video"], Pl(a)), i;
}
function Dp(t, e) {
  const n = {}, i = s(t, ["_self"]);
  i != null && u(n, ["image"], Jp(i));
  const r = s(t, [
    "raiFilteredReason"
  ]);
  r != null && u(n, ["raiFilteredReason"], r);
  const o = s(t, ["_self"]);
  return o != null && u(n, ["safetyAttributes"], Al(o)), n;
}
function On(t, e) {
  const n = {}, i = s(t, ["_self"]);
  i != null && u(n, ["image"], Cl(i));
  const r = s(t, [
    "raiFilteredReason"
  ]);
  r != null && u(n, ["raiFilteredReason"], r);
  const o = s(t, ["_self"]);
  o != null && u(n, ["safetyAttributes"], wl(o));
  const a = s(t, ["prompt"]);
  return a != null && u(n, ["enhancedPrompt"], a), n;
}
function Up(t, e) {
  const n = {}, i = s(t, ["_self"]);
  i != null && u(n, ["mask"], Cl(i));
  const r = s(t, ["labels"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["labels"], o);
  }
  return n;
}
function bp(t, e) {
  const n = {}, i = s(t, ["video"]);
  return i != null && u(n, ["video"], Sm(i)), n;
}
function Lp(t, e) {
  const n = {}, i = s(t, ["_self"]);
  return i != null && u(n, ["video"], Cm(i)), n;
}
function Op(t, e) {
  const n = {}, i = s(t, [
    "modelSelectionConfig"
  ]);
  i != null && u(n, ["modelConfig"], i);
  const r = s(t, [
    "responseJsonSchema"
  ]);
  r != null && u(n, ["responseJsonSchema"], r);
  const o = s(t, [
    "audioTimestamp"
  ]);
  o != null && u(n, ["audioTimestamp"], o);
  const a = s(t, [
    "candidateCount"
  ]);
  a != null && u(n, ["candidateCount"], a);
  const l = s(t, [
    "enableAffectiveDialog"
  ]);
  l != null && u(n, ["enableAffectiveDialog"], l);
  const f = s(t, [
    "frequencyPenalty"
  ]);
  f != null && u(n, ["frequencyPenalty"], f);
  const c = s(t, ["logprobs"]);
  c != null && u(n, ["logprobs"], c);
  const d = s(t, [
    "maxOutputTokens"
  ]);
  d != null && u(n, ["maxOutputTokens"], d);
  const p = s(t, [
    "mediaResolution"
  ]);
  p != null && u(n, ["mediaResolution"], p);
  const h = s(t, [
    "presencePenalty"
  ]);
  h != null && u(n, ["presencePenalty"], h);
  const m = s(t, [
    "responseLogprobs"
  ]);
  m != null && u(n, ["responseLogprobs"], m);
  const g = s(t, [
    "responseMimeType"
  ]);
  g != null && u(n, ["responseMimeType"], g);
  const v = s(t, [
    "responseModalities"
  ]);
  v != null && u(n, ["responseModalities"], v);
  const E = s(t, [
    "responseSchema"
  ]);
  E != null && u(n, ["responseSchema"], E);
  const T = s(t, [
    "routingConfig"
  ]);
  T != null && u(n, ["routingConfig"], T);
  const C = s(t, ["seed"]);
  C != null && u(n, ["seed"], C);
  const w = s(t, ["speechConfig"]);
  w != null && u(n, ["speechConfig"], w);
  const D = s(t, [
    "stopSequences"
  ]);
  D != null && u(n, ["stopSequences"], D);
  const _ = s(t, ["temperature"]);
  _ != null && u(n, ["temperature"], _);
  const y = s(t, [
    "thinkingConfig"
  ]);
  y != null && u(n, ["thinkingConfig"], y);
  const S = s(t, ["topK"]);
  S != null && u(n, ["topK"], S);
  const R = s(t, ["topP"]);
  if (R != null && u(n, ["topP"], R), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return n;
}
function Fp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  return r != null && u(i, ["_url", "name"], ie(t, r)), i;
}
function Gp(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  return r != null && u(i, ["_url", "name"], ie(t, r)), i;
}
function qp(t, e) {
  const n = {}, i = s(t, ["authConfig"]);
  i != null && u(n, ["authConfig"], Lh(i));
  const r = s(t, ["enableWidget"]);
  return r != null && u(n, ["enableWidget"], r), n;
}
function Bp(t, e) {
  const n = {}, i = s(t, ["searchTypes"]);
  if (i != null && u(n, ["searchTypes"], i), s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const r = s(t, [
    "timeRangeFilter"
  ]);
  return r != null && u(n, ["timeRangeFilter"], r), n;
}
function Hp(t, e) {
  const n = {}, i = s(t, ["aspectRatio"]);
  i != null && u(n, ["aspectRatio"], i);
  const r = s(t, ["imageSize"]);
  if (r != null && u(n, ["imageSize"], r), s(t, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(t, ["prominentPeople"]) !== void 0)
    throw new Error("prominentPeople parameter is not supported in Gemini API.");
  if (s(t, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(t, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  if (s(t, ["imageOutputOptions"]) !== void 0)
    throw new Error("imageOutputOptions parameter is not supported in Gemini API.");
  return n;
}
function Vp(t, e) {
  const n = {}, i = s(t, ["aspectRatio"]);
  i != null && u(n, ["aspectRatio"], i);
  const r = s(t, ["imageSize"]);
  r != null && u(n, ["imageSize"], r);
  const o = s(t, [
    "personGeneration"
  ]);
  o != null && u(n, ["personGeneration"], o);
  const a = s(t, [
    "prominentPeople"
  ]);
  a != null && u(n, ["prominentPeople"], a);
  const l = s(t, [
    "outputMimeType"
  ]);
  l != null && u(n, ["imageOutputOptions", "mimeType"], l);
  const f = s(t, [
    "outputCompressionQuality"
  ]);
  f != null && u(n, ["imageOutputOptions", "compressionQuality"], f);
  const c = s(t, [
    "imageOutputOptions"
  ]);
  return c != null && u(n, ["imageOutputOptions"], c), n;
}
function Jp(t, e) {
  const n = {}, i = s(t, [
    "bytesBase64Encoded"
  ]);
  i != null && u(n, ["imageBytes"], Ke(i));
  const r = s(t, ["mimeType"]);
  return r != null && u(n, ["mimeType"], r), n;
}
function Cl(t, e) {
  const n = {}, i = s(t, ["gcsUri"]);
  i != null && u(n, ["gcsUri"], i);
  const r = s(t, [
    "bytesBase64Encoded"
  ]);
  r != null && u(n, ["imageBytes"], Ke(r));
  const o = s(t, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Fn(t, e) {
  const n = {};
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  const i = s(t, ["imageBytes"]);
  i != null && u(n, ["bytesBase64Encoded"], Ke(i));
  const r = s(t, ["mimeType"]);
  return r != null && u(n, ["mimeType"], r), n;
}
function Ue(t, e) {
  const n = {}, i = s(t, ["gcsUri"]);
  i != null && u(n, ["gcsUri"], i);
  const r = s(t, ["imageBytes"]);
  r != null && u(n, ["bytesBase64Encoded"], Ke(r));
  const o = s(t, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function $p(t, e, n, i) {
  const r = {}, o = s(e, ["pageSize"]);
  n !== void 0 && o != null && u(n, ["_query", "pageSize"], o);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && u(n, ["_query", "pageToken"], a);
  const l = s(e, ["filter"]);
  n !== void 0 && l != null && u(n, ["_query", "filter"], l);
  const f = s(e, ["queryBase"]);
  return n !== void 0 && f != null && u(n, ["_url", "models_url"], gl(t, f)), r;
}
function Wp(t, e, n, i) {
  const r = {}, o = s(e, ["pageSize"]);
  n !== void 0 && o != null && u(n, ["_query", "pageSize"], o);
  const a = s(e, ["pageToken"]);
  n !== void 0 && a != null && u(n, ["_query", "pageToken"], a);
  const l = s(e, ["filter"]);
  n !== void 0 && l != null && u(n, ["_query", "filter"], l);
  const f = s(e, ["queryBase"]);
  return n !== void 0 && f != null && u(n, ["_url", "models_url"], gl(t, f)), r;
}
function Kp(t, e, n) {
  const i = {}, r = s(e, ["config"]);
  return r != null && $p(t, r, i), i;
}
function Yp(t, e, n) {
  const i = {}, r = s(e, ["config"]);
  return r != null && Wp(t, r, i), i;
}
function zp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "nextPageToken"
  ]);
  r != null && u(n, ["nextPageToken"], r);
  const o = s(t, ["_self"]);
  if (o != null) {
    let a = yl(o);
    Array.isArray(a) && (a = a.map((l) => Mi(l))), u(n, ["models"], a);
  }
  return n;
}
function Xp(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "nextPageToken"
  ]);
  r != null && u(n, ["nextPageToken"], r);
  const o = s(t, ["_self"]);
  if (o != null) {
    let a = yl(o);
    Array.isArray(a) && (a = a.map((l) => xi(l))), u(n, ["models"], a);
  }
  return n;
}
function Qp(t, e) {
  const n = {}, i = s(t, ["maskMode"]);
  i != null && u(n, ["maskMode"], i);
  const r = s(t, [
    "segmentationClasses"
  ]);
  r != null && u(n, ["maskClasses"], r);
  const o = s(t, ["maskDilation"]);
  return o != null && u(n, ["dilation"], o), n;
}
function Mi(t, e) {
  const n = {}, i = s(t, ["name"]);
  i != null && u(n, ["name"], i);
  const r = s(t, ["displayName"]);
  r != null && u(n, ["displayName"], r);
  const o = s(t, ["description"]);
  o != null && u(n, ["description"], o);
  const a = s(t, ["version"]);
  a != null && u(n, ["version"], a);
  const l = s(t, ["_self"]);
  l != null && u(n, ["tunedModelInfo"], hm(l));
  const f = s(t, [
    "inputTokenLimit"
  ]);
  f != null && u(n, ["inputTokenLimit"], f);
  const c = s(t, [
    "outputTokenLimit"
  ]);
  c != null && u(n, ["outputTokenLimit"], c);
  const d = s(t, [
    "supportedGenerationMethods"
  ]);
  d != null && u(n, ["supportedActions"], d);
  const p = s(t, ["temperature"]);
  p != null && u(n, ["temperature"], p);
  const h = s(t, [
    "maxTemperature"
  ]);
  h != null && u(n, ["maxTemperature"], h);
  const m = s(t, ["topP"]);
  m != null && u(n, ["topP"], m);
  const g = s(t, ["topK"]);
  g != null && u(n, ["topK"], g);
  const v = s(t, ["thinking"]);
  return v != null && u(n, ["thinking"], v), n;
}
function xi(t, e) {
  const n = {}, i = s(t, ["name"]);
  i != null && u(n, ["name"], i);
  const r = s(t, ["displayName"]);
  r != null && u(n, ["displayName"], r);
  const o = s(t, ["description"]);
  o != null && u(n, ["description"], o);
  const a = s(t, ["versionId"]);
  a != null && u(n, ["version"], a);
  const l = s(t, ["deployedModels"]);
  if (l != null) {
    let h = l;
    Array.isArray(h) && (h = h.map((m) => up(m))), u(n, ["endpoints"], h);
  }
  const f = s(t, ["labels"]);
  f != null && u(n, ["labels"], f);
  const c = s(t, ["_self"]);
  c != null && u(n, ["tunedModelInfo"], pm(c));
  const d = s(t, [
    "defaultCheckpointId"
  ]);
  d != null && u(n, ["defaultCheckpointId"], d);
  const p = s(t, ["checkpoints"]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((m) => m)), u(n, ["checkpoints"], h);
  }
  return n;
}
function Zp(t, e) {
  const n = {}, i = s(t, [
    "mediaResolution"
  ]);
  i != null && u(n, ["mediaResolution"], i);
  const r = s(t, [
    "codeExecutionResult"
  ]);
  r != null && u(n, ["codeExecutionResult"], r);
  const o = s(t, [
    "executableCode"
  ]);
  o != null && u(n, ["executableCode"], o);
  const a = s(t, ["fileData"]);
  a != null && u(n, ["fileData"], fp(a));
  const l = s(t, ["functionCall"]);
  l != null && u(n, ["functionCall"], dp(l));
  const f = s(t, [
    "functionResponse"
  ]);
  f != null && u(n, ["functionResponse"], f);
  const c = s(t, ["inlineData"]);
  c != null && u(n, ["inlineData"], Oh(c));
  const d = s(t, ["text"]);
  d != null && u(n, ["text"], d);
  const p = s(t, ["thought"]);
  p != null && u(n, ["thought"], p);
  const h = s(t, [
    "thoughtSignature"
  ]);
  h != null && u(n, ["thoughtSignature"], h);
  const m = s(t, [
    "videoMetadata"
  ]);
  return m != null && u(n, ["videoMetadata"], m), n;
}
function jp(t, e) {
  const n = {}, i = s(t, ["productImage"]);
  return i != null && u(n, ["image"], Ue(i)), n;
}
function em(t, e, n) {
  const i = {}, r = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && r != null && u(e, ["parameters", "sampleCount"], r);
  const o = s(t, ["baseSteps"]);
  e !== void 0 && o != null && u(e, ["parameters", "baseSteps"], o);
  const a = s(t, ["outputGcsUri"]);
  e !== void 0 && a != null && u(e, ["parameters", "storageUri"], a);
  const l = s(t, ["seed"]);
  e !== void 0 && l != null && u(e, ["parameters", "seed"], l);
  const f = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "safetySetting"], f);
  const c = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && c != null && u(e, ["parameters", "personGeneration"], c);
  const d = s(t, ["addWatermark"]);
  e !== void 0 && d != null && u(e, ["parameters", "addWatermark"], d);
  const p = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && p != null && u(e, ["parameters", "outputOptions", "mimeType"], p);
  const h = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && h != null && u(e, ["parameters", "outputOptions", "compressionQuality"], h);
  const m = s(t, [
    "enhancePrompt"
  ]);
  e !== void 0 && m != null && u(e, ["parameters", "enhancePrompt"], m);
  const g = s(t, ["labels"]);
  return e !== void 0 && g != null && u(e, ["labels"], g), i;
}
function tm(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["source"]);
  o != null && im(o, i);
  const a = s(e, ["config"]);
  return a != null && em(a, i), i;
}
function nm(t, e) {
  const n = {}, i = s(t, [
    "predictions"
  ]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((o) => On(o))), u(n, ["generatedImages"], r);
  }
  return n;
}
function im(t, e, n) {
  const i = {}, r = s(t, ["prompt"]);
  e !== void 0 && r != null && u(e, ["instances[0]", "prompt"], r);
  const o = s(t, ["personImage"]);
  e !== void 0 && o != null && u(e, ["instances[0]", "personImage", "image"], Ue(o));
  const a = s(t, [
    "productImages"
  ]);
  if (e !== void 0 && a != null) {
    let l = a;
    Array.isArray(l) && (l = l.map((f) => jp(f))), u(e, ["instances[0]", "productImages"], l);
  }
  return i;
}
function rm(t, e) {
  const n = {}, i = s(t, [
    "referenceImage"
  ]);
  i != null && u(n, ["referenceImage"], Ue(i));
  const r = s(t, ["referenceId"]);
  r != null && u(n, ["referenceId"], r);
  const o = s(t, [
    "referenceType"
  ]);
  o != null && u(n, ["referenceType"], o);
  const a = s(t, [
    "maskImageConfig"
  ]);
  a != null && u(n, ["maskImageConfig"], Qp(a));
  const l = s(t, [
    "controlImageConfig"
  ]);
  l != null && u(n, ["controlImageConfig"], Jh(l));
  const f = s(t, [
    "styleImageConfig"
  ]);
  f != null && u(n, ["styleImageConfig"], f);
  const c = s(t, [
    "subjectImageConfig"
  ]);
  return c != null && u(n, ["subjectImageConfig"], c), n;
}
function Al(t, e) {
  const n = {}, i = s(t, [
    "safetyAttributes",
    "categories"
  ]);
  i != null && u(n, ["categories"], i);
  const r = s(t, [
    "safetyAttributes",
    "scores"
  ]);
  r != null && u(n, ["scores"], r);
  const o = s(t, ["contentType"]);
  return o != null && u(n, ["contentType"], o), n;
}
function wl(t, e) {
  const n = {}, i = s(t, [
    "safetyAttributes",
    "categories"
  ]);
  i != null && u(n, ["categories"], i);
  const r = s(t, [
    "safetyAttributes",
    "scores"
  ]);
  r != null && u(n, ["scores"], r);
  const o = s(t, ["contentType"]);
  return o != null && u(n, ["contentType"], o), n;
}
function om(t, e) {
  const n = {}, i = s(t, ["category"]);
  if (i != null && u(n, ["category"], i), s(t, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const r = s(t, ["threshold"]);
  return r != null && u(n, ["threshold"], r), n;
}
function sm(t, e) {
  const n = {}, i = s(t, ["image"]);
  return i != null && u(n, ["image"], Ue(i)), n;
}
function am(t, e, n) {
  const i = {}, r = s(t, ["mode"]);
  e !== void 0 && r != null && u(e, ["parameters", "mode"], r);
  const o = s(t, [
    "maxPredictions"
  ]);
  e !== void 0 && o != null && u(e, ["parameters", "maxPredictions"], o);
  const a = s(t, [
    "confidenceThreshold"
  ]);
  e !== void 0 && a != null && u(e, ["parameters", "confidenceThreshold"], a);
  const l = s(t, ["maskDilation"]);
  e !== void 0 && l != null && u(e, ["parameters", "maskDilation"], l);
  const f = s(t, [
    "binaryColorThreshold"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "binaryColorThreshold"], f);
  const c = s(t, ["labels"]);
  return e !== void 0 && c != null && u(e, ["labels"], c), i;
}
function lm(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["source"]);
  o != null && um(o, i);
  const a = s(e, ["config"]);
  return a != null && am(a, i), i;
}
function cm(t, e) {
  const n = {}, i = s(t, ["predictions"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((o) => Up(o))), u(n, ["generatedMasks"], r);
  }
  return n;
}
function um(t, e, n) {
  const i = {}, r = s(t, ["prompt"]);
  e !== void 0 && r != null && u(e, ["instances[0]", "prompt"], r);
  const o = s(t, ["image"]);
  e !== void 0 && o != null && u(e, ["instances[0]", "image"], Ue(o));
  const a = s(t, [
    "scribbleImage"
  ]);
  return e !== void 0 && a != null && u(e, ["instances[0]", "scribble"], sm(a)), i;
}
function fm(t, e) {
  const n = {}, i = s(t, [
    "retrievalConfig"
  ]);
  i != null && u(n, ["retrievalConfig"], i);
  const r = s(t, [
    "functionCallingConfig"
  ]);
  return r != null && u(n, ["functionCallingConfig"], hp(r)), n;
}
function dm(t, e) {
  const n = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const i = s(t, ["computerUse"]);
  i != null && u(n, ["computerUse"], i);
  const r = s(t, ["fileSearch"]);
  r != null && u(n, ["fileSearch"], r);
  const o = s(t, ["googleSearch"]);
  o != null && u(n, ["googleSearch"], Bp(o));
  const a = s(t, ["googleMaps"]);
  a != null && u(n, ["googleMaps"], qp(a));
  const l = s(t, [
    "codeExecution"
  ]);
  if (l != null && u(n, ["codeExecution"], l), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const f = s(t, [
    "functionDeclarations"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((m) => m)), u(n, ["functionDeclarations"], h);
  }
  const c = s(t, [
    "googleSearchRetrieval"
  ]);
  if (c != null && u(n, ["googleSearchRetrieval"], c), s(t, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const d = s(t, ["urlContext"]);
  d != null && u(n, ["urlContext"], d);
  const p = s(t, ["mcpServers"]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((m) => m)), u(n, ["mcpServers"], h);
  }
  return n;
}
function Il(t, e) {
  const n = {}, i = s(t, ["retrieval"]);
  i != null && u(n, ["retrieval"], i);
  const r = s(t, ["computerUse"]);
  if (r != null && u(n, ["computerUse"], r), s(t, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const o = s(t, ["googleSearch"]);
  o != null && u(n, ["googleSearch"], o);
  const a = s(t, ["googleMaps"]);
  a != null && u(n, ["googleMaps"], a);
  const l = s(t, [
    "codeExecution"
  ]);
  l != null && u(n, ["codeExecution"], l);
  const f = s(t, [
    "enterpriseWebSearch"
  ]);
  f != null && u(n, ["enterpriseWebSearch"], f);
  const c = s(t, [
    "functionDeclarations"
  ]);
  if (c != null) {
    let m = c;
    Array.isArray(m) && (m = m.map((g) => pp(g))), u(n, ["functionDeclarations"], m);
  }
  const d = s(t, [
    "googleSearchRetrieval"
  ]);
  d != null && u(n, ["googleSearchRetrieval"], d);
  const p = s(t, [
    "parallelAiSearch"
  ]);
  p != null && u(n, ["parallelAiSearch"], p);
  const h = s(t, ["urlContext"]);
  if (h != null && u(n, ["urlContext"], h), s(t, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return n;
}
function hm(t, e) {
  const n = {}, i = s(t, ["baseModel"]);
  i != null && u(n, ["baseModel"], i);
  const r = s(t, ["createTime"]);
  r != null && u(n, ["createTime"], r);
  const o = s(t, ["updateTime"]);
  return o != null && u(n, ["updateTime"], o), n;
}
function pm(t, e) {
  const n = {}, i = s(t, [
    "labels",
    "google-vertex-llm-tuning-base-model-id"
  ]);
  i != null && u(n, ["baseModel"], i);
  const r = s(t, ["createTime"]);
  r != null && u(n, ["createTime"], r);
  const o = s(t, ["updateTime"]);
  return o != null && u(n, ["updateTime"], o), n;
}
function mm(t, e, n) {
  const i = {}, r = s(t, ["displayName"]);
  e !== void 0 && r != null && u(e, ["displayName"], r);
  const o = s(t, ["description"]);
  e !== void 0 && o != null && u(e, ["description"], o);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && u(e, ["defaultCheckpointId"], a), i;
}
function gm(t, e, n) {
  const i = {}, r = s(t, ["displayName"]);
  e !== void 0 && r != null && u(e, ["displayName"], r);
  const o = s(t, ["description"]);
  e !== void 0 && o != null && u(e, ["description"], o);
  const a = s(t, [
    "defaultCheckpointId"
  ]);
  return e !== void 0 && a != null && u(e, ["defaultCheckpointId"], a), i;
}
function ym(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "name"], ie(t, r));
  const o = s(e, ["config"]);
  return o != null && mm(o, i), i;
}
function _m(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["config"]);
  return o != null && gm(o, i), i;
}
function vm(t, e, n) {
  const i = {}, r = s(t, ["outputGcsUri"]);
  e !== void 0 && r != null && u(e, ["parameters", "storageUri"], r);
  const o = s(t, [
    "safetyFilterLevel"
  ]);
  e !== void 0 && o != null && u(e, ["parameters", "safetySetting"], o);
  const a = s(t, [
    "personGeneration"
  ]);
  e !== void 0 && a != null && u(e, ["parameters", "personGeneration"], a);
  const l = s(t, [
    "includeRaiReason"
  ]);
  e !== void 0 && l != null && u(e, ["parameters", "includeRaiReason"], l);
  const f = s(t, [
    "outputMimeType"
  ]);
  e !== void 0 && f != null && u(e, ["parameters", "outputOptions", "mimeType"], f);
  const c = s(t, [
    "outputCompressionQuality"
  ]);
  e !== void 0 && c != null && u(e, ["parameters", "outputOptions", "compressionQuality"], c);
  const d = s(t, [
    "enhanceInputImage"
  ]);
  e !== void 0 && d != null && u(e, ["parameters", "upscaleConfig", "enhanceInputImage"], d);
  const p = s(t, [
    "imagePreservationFactor"
  ]);
  e !== void 0 && p != null && u(e, ["parameters", "upscaleConfig", "imagePreservationFactor"], p);
  const h = s(t, ["labels"]);
  e !== void 0 && h != null && u(e, ["labels"], h);
  const m = s(t, [
    "numberOfImages"
  ]);
  e !== void 0 && m != null && u(e, ["parameters", "sampleCount"], m);
  const g = s(t, ["mode"]);
  return e !== void 0 && g != null && u(e, ["parameters", "mode"], g), i;
}
function Em(t, e, n) {
  const i = {}, r = s(e, ["model"]);
  r != null && u(i, ["_url", "model"], ie(t, r));
  const o = s(e, ["image"]);
  o != null && u(i, ["instances[0]", "image"], Ue(o));
  const a = s(e, [
    "upscaleFactor"
  ]);
  a != null && u(i, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const l = s(e, ["config"]);
  return l != null && vm(l, i), i;
}
function Tm(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "predictions"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => On(a))), u(n, ["generatedImages"], o);
  }
  return n;
}
function Sm(t, e) {
  const n = {}, i = s(t, ["uri"]);
  i != null && u(n, ["uri"], i);
  const r = s(t, ["encodedVideo"]);
  r != null && u(n, ["videoBytes"], Ke(r));
  const o = s(t, ["encoding"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Cm(t, e) {
  const n = {}, i = s(t, ["gcsUri"]);
  i != null && u(n, ["uri"], i);
  const r = s(t, [
    "bytesBase64Encoded"
  ]);
  r != null && u(n, ["videoBytes"], Ke(r));
  const o = s(t, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Am(t, e) {
  const n = {}, i = s(t, ["image"]);
  i != null && u(n, ["_self"], Ue(i));
  const r = s(t, ["maskMode"]);
  return r != null && u(n, ["maskMode"], r), n;
}
function wm(t, e) {
  const n = {}, i = s(t, ["image"]);
  i != null && u(n, ["image"], Fn(i));
  const r = s(t, [
    "referenceType"
  ]);
  return r != null && u(n, ["referenceType"], r), n;
}
function Im(t, e) {
  const n = {}, i = s(t, ["image"]);
  i != null && u(n, ["image"], Ue(i));
  const r = s(t, [
    "referenceType"
  ]);
  return r != null && u(n, ["referenceType"], r), n;
}
function Rl(t, e) {
  const n = {}, i = s(t, ["uri"]);
  i != null && u(n, ["uri"], i);
  const r = s(t, ["videoBytes"]);
  r != null && u(n, ["encodedVideo"], Ke(r));
  const o = s(t, ["mimeType"]);
  return o != null && u(n, ["encoding"], o), n;
}
function Pl(t, e) {
  const n = {}, i = s(t, ["uri"]);
  i != null && u(n, ["gcsUri"], i);
  const r = s(t, ["videoBytes"]);
  r != null && u(n, ["bytesBase64Encoded"], Ke(r));
  const o = s(t, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Rm(t, e) {
  const n = {}, i = s(t, ["displayName"]);
  return e !== void 0 && i != null && u(e, ["displayName"], i), n;
}
function Pm(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Rm(n, e), e;
}
function Nm(t, e) {
  const n = {}, i = s(t, ["force"]);
  return e !== void 0 && i != null && u(e, ["_query", "force"], i), n;
}
function km(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["_url", "name"], n);
  const i = s(t, ["config"]);
  return i != null && Nm(i, e), e;
}
function Mm(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && u(e, ["_url", "name"], n), e;
}
function xm(t, e) {
  const n = {}, i = s(t, [
    "customMetadata"
  ]);
  if (e !== void 0 && i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["customMetadata"], o);
  }
  const r = s(t, [
    "chunkingConfig"
  ]);
  return e !== void 0 && r != null && u(e, ["chunkingConfig"], r), n;
}
function Dm(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["name"], n);
  const i = s(t, ["metadata"]);
  i != null && u(e, ["metadata"], i);
  const r = s(t, ["done"]);
  r != null && u(e, ["done"], r);
  const o = s(t, ["error"]);
  o != null && u(e, ["error"], o);
  const a = s(t, ["response"]);
  return a != null && u(e, ["response"], bm(a)), e;
}
function Um(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && u(e, ["_url", "file_search_store_name"], n);
  const i = s(t, ["fileName"]);
  i != null && u(e, ["fileName"], i);
  const r = s(t, ["config"]);
  return r != null && xm(r, e), e;
}
function bm(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, ["parent"]);
  i != null && u(e, ["parent"], i);
  const r = s(t, ["documentName"]);
  return r != null && u(e, ["documentName"], r), e;
}
function Lm(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  return e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), n;
}
function Om(t) {
  const e = {}, n = s(t, ["config"]);
  return n != null && Lm(n, e), e;
}
function Fm(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, [
    "fileSearchStores"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["fileSearchStores"], o);
  }
  return e;
}
function Nl(t, e) {
  const n = {}, i = s(t, ["mimeType"]);
  e !== void 0 && i != null && u(e, ["mimeType"], i);
  const r = s(t, ["displayName"]);
  e !== void 0 && r != null && u(e, ["displayName"], r);
  const o = s(t, [
    "customMetadata"
  ]);
  if (e !== void 0 && o != null) {
    let l = o;
    Array.isArray(l) && (l = l.map((f) => f)), u(e, ["customMetadata"], l);
  }
  const a = s(t, [
    "chunkingConfig"
  ]);
  return e !== void 0 && a != null && u(e, ["chunkingConfig"], a), n;
}
function Gm(t) {
  const e = {}, n = s(t, [
    "fileSearchStoreName"
  ]);
  n != null && u(e, ["_url", "file_search_store_name"], n);
  const i = s(t, ["config"]);
  return i != null && Nl(i, e), e;
}
function qm(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  return n != null && u(e, ["sdkHttpResponse"], n), e;
}
const Bm = "Content-Type", Hm = "X-Server-Timeout", Vm = "User-Agent", Di = "x-goog-api-client", Jm = "1.44.0", $m = `google-genai-sdk/${Jm}`, Wm = "v1beta1", Km = "v1beta", Ym = 5, zm = [
  408,
  // Request timeout
  429,
  // Too many requests
  500,
  // Internal server error
  502,
  // Bad gateway
  503,
  // Service unavailable
  504
  // Gateway timeout
];
class Xm {
  constructor(e) {
    var n, i, r;
    this.clientOptions = Object.assign({}, e), this.customBaseUrl = (n = e.httpOptions) === null || n === void 0 ? void 0 : n.baseUrl, this.clientOptions.vertexai && (this.clientOptions.project && this.clientOptions.location ? this.clientOptions.apiKey = void 0 : this.clientOptions.apiKey && (this.clientOptions.project = void 0, this.clientOptions.location = void 0));
    const o = {};
    if (this.clientOptions.vertexai) {
      if (!this.clientOptions.location && !this.clientOptions.apiKey && !this.customBaseUrl && (this.clientOptions.location = "global"), !(this.clientOptions.project && this.clientOptions.location || this.clientOptions.apiKey) && !this.customBaseUrl)
        throw new Error("Authentication is not set up. Please provide either a project and location, or an API key, or a custom base URL.");
      const l = e.project && e.location || !!e.apiKey;
      this.customBaseUrl && !l ? (o.baseUrl = this.customBaseUrl, this.clientOptions.project = void 0, this.clientOptions.location = void 0) : this.clientOptions.apiKey || this.clientOptions.location === "global" ? o.baseUrl = "https://aiplatform.googleapis.com/" : this.clientOptions.project && this.clientOptions.location && (o.baseUrl = `https://${this.clientOptions.location}-aiplatform.googleapis.com/`), o.apiVersion = (i = this.clientOptions.apiVersion) !== null && i !== void 0 ? i : Wm;
    } else
      this.clientOptions.apiKey || console.warn("API key should be set when using the Gemini API."), o.apiVersion = (r = this.clientOptions.apiVersion) !== null && r !== void 0 ? r : Km, o.baseUrl = "https://generativelanguage.googleapis.com/";
    o.headers = this.getDefaultHeaders(), this.clientOptions.httpOptions = o, e.httpOptions && (this.clientOptions.httpOptions = this.patchHttpOptions(o, e.httpOptions));
  }
  isVertexAI() {
    var e;
    return (e = this.clientOptions.vertexai) !== null && e !== void 0 ? e : !1;
  }
  getProject() {
    return this.clientOptions.project;
  }
  getLocation() {
    return this.clientOptions.location;
  }
  getCustomBaseUrl() {
    return this.customBaseUrl;
  }
  async getAuthHeaders() {
    const e = new Headers();
    return await this.clientOptions.auth.addAuthHeaders(e), e;
  }
  getApiVersion() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.apiVersion !== void 0)
      return this.clientOptions.httpOptions.apiVersion;
    throw new Error("API version is not set.");
  }
  getBaseUrl() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.baseUrl !== void 0)
      return this.clientOptions.httpOptions.baseUrl;
    throw new Error("Base URL is not set.");
  }
  getRequestUrl() {
    return this.getRequestUrlInternal(this.clientOptions.httpOptions);
  }
  getHeaders() {
    if (this.clientOptions.httpOptions && this.clientOptions.httpOptions.headers !== void 0)
      return this.clientOptions.httpOptions.headers;
    throw new Error("Headers are not set.");
  }
  getRequestUrlInternal(e) {
    if (!e || e.baseUrl === void 0 || e.apiVersion === void 0)
      throw new Error("HTTP options are not correctly set.");
    const i = [e.baseUrl.endsWith("/") ? e.baseUrl.slice(0, -1) : e.baseUrl];
    return e.apiVersion && e.apiVersion !== "" && i.push(e.apiVersion), i.join("/");
  }
  getBaseResourcePath() {
    return `projects/${this.clientOptions.project}/locations/${this.clientOptions.location}`;
  }
  getApiKey() {
    return this.clientOptions.apiKey;
  }
  getWebsocketBaseUrl() {
    const e = this.getBaseUrl(), n = new URL(e);
    return n.protocol = n.protocol == "http:" ? "ws" : "wss", n.toString();
  }
  setBaseUrl(e) {
    if (this.clientOptions.httpOptions)
      this.clientOptions.httpOptions.baseUrl = e;
    else
      throw new Error("HTTP options are not correctly set.");
  }
  constructUrl(e, n, i) {
    const r = [this.getRequestUrlInternal(n)];
    return i && r.push(this.getBaseResourcePath()), e !== "" && r.push(e), new URL(`${r.join("/")}`);
  }
  shouldPrependVertexProjectPath(e, n) {
    return !(n.baseUrl && n.baseUrlResourceScope === Pi.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || e.path.startsWith("projects/") || e.httpMethod === "GET" && e.path.startsWith("publishers/google/models"));
  }
  async request(e) {
    let n = this.clientOptions.httpOptions;
    e.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const i = this.shouldPrependVertexProjectPath(e, n), r = this.constructUrl(e.path, n, i);
    if (e.queryParams)
      for (const [a, l] of Object.entries(e.queryParams))
        r.searchParams.append(a, String(l));
    let o = {};
    if (e.httpMethod === "GET") {
      if (e.body && e.body !== "{}")
        throw new Error("Request body should be empty for GET request, but got non empty request body");
    } else
      o.body = e.body;
    return o = await this.includeExtraHttpOptionsToRequestInit(o, n, r.toString(), e.abortSignal), this.unaryApiCall(r, o, e.httpMethod);
  }
  patchHttpOptions(e, n) {
    const i = JSON.parse(JSON.stringify(e));
    for (const [r, o] of Object.entries(n))
      typeof o == "object" ? i[r] = Object.assign(Object.assign({}, i[r]), o) : o !== void 0 && (i[r] = o);
    return i;
  }
  async requestStream(e) {
    let n = this.clientOptions.httpOptions;
    e.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, e.httpOptions));
    const i = this.shouldPrependVertexProjectPath(e, n), r = this.constructUrl(e.path, n, i);
    (!r.searchParams.has("alt") || r.searchParams.get("alt") !== "sse") && r.searchParams.set("alt", "sse");
    let o = {};
    return o.body = e.body, o = await this.includeExtraHttpOptionsToRequestInit(o, n, r.toString(), e.abortSignal), this.streamApiCall(r, o, e.httpMethod);
  }
  async includeExtraHttpOptionsToRequestInit(e, n, i, r) {
    if (n && n.timeout || r) {
      const o = new AbortController(), a = o.signal;
      if (n.timeout && n?.timeout > 0) {
        const l = setTimeout(() => o.abort(), n.timeout);
        l && typeof l.unref == "function" && l.unref();
      }
      r && r.addEventListener("abort", () => {
        o.abort();
      }), e.signal = a;
    }
    return n && n.extraBody !== null && Qm(e, n.extraBody), e.headers = await this.getHeadersInternal(n, i), e;
  }
  async unaryApiCall(e, n, i) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: i })).then(async (r) => (await fa(r), new sn(r))).catch((r) => {
      throw r instanceof Error ? r : new Error(JSON.stringify(r));
    });
  }
  async streamApiCall(e, n, i) {
    return this.apiCall(e.toString(), Object.assign(Object.assign({}, n), { method: i })).then(async (r) => (await fa(r), this.processStreamResponse(r))).catch((r) => {
      throw r instanceof Error ? r : new Error(JSON.stringify(r));
    });
  }
  processStreamResponse(e) {
    return xe(this, arguments, function* () {
      var i;
      const r = (i = e?.body) === null || i === void 0 ? void 0 : i.getReader(), o = new TextDecoder("utf-8");
      if (!r)
        throw new Error("Response body is empty");
      try {
        let a = "";
        const l = "data:", f = [`

`, "\r\r", `\r
\r
`];
        for (; ; ) {
          const { done: c, value: d } = yield j(r.read());
          if (c) {
            if (a.trim().length > 0)
              throw new Error("Incomplete JSON segment at the end");
            break;
          }
          const p = o.decode(d, { stream: !0 });
          try {
            const g = JSON.parse(p);
            if ("error" in g) {
              const v = JSON.parse(JSON.stringify(g.error)), E = v.status, T = v.code, C = `got status: ${E}. ${JSON.stringify(g)}`;
              if (T >= 400 && T < 600)
                throw new Ln({
                  message: C,
                  status: T
                });
            }
          } catch (g) {
            if (g.name === "ApiError")
              throw g;
          }
          a += p;
          let h = -1, m = 0;
          for (; ; ) {
            h = -1, m = 0;
            for (const E of f) {
              const T = a.indexOf(E);
              T !== -1 && (h === -1 || T < h) && (h = T, m = E.length);
            }
            if (h === -1)
              break;
            const g = a.substring(0, h);
            a = a.substring(h + m);
            const v = g.trim();
            if (v.startsWith(l)) {
              const E = v.substring(l.length).trim();
              try {
                const T = new Response(E, {
                  headers: e?.headers,
                  status: e?.status,
                  statusText: e?.statusText
                });
                yield yield j(new sn(T));
              } catch (T) {
                throw new Error(`exception parsing stream chunk ${E}. ${T}`);
              }
            }
          }
        }
      } finally {
        r.releaseLock();
      }
    });
  }
  async apiCall(e, n) {
    var i;
    if (!this.clientOptions.httpOptions || !this.clientOptions.httpOptions.retryOptions)
      return fetch(e, n);
    const r = this.clientOptions.httpOptions.retryOptions;
    return Sc(async () => {
      const a = await fetch(e, n);
      if (a.ok)
        return a;
      throw zm.includes(a.status) ? new Error(`Retryable HTTP Error: ${a.statusText}`) : new wa.AbortError(`Non-retryable exception ${a.statusText} sending request`);
    }, {
      // Retry attempts is one less than the number of total attempts.
      retries: ((i = r.attempts) !== null && i !== void 0 ? i : Ym) - 1
    });
  }
  getDefaultHeaders() {
    const e = {}, n = $m + " " + this.clientOptions.userAgentExtra;
    return e[Vm] = n, e[Di] = n, e[Bm] = "application/json", e;
  }
  async getHeadersInternal(e, n) {
    const i = new Headers();
    if (e && e.headers) {
      for (const [r, o] of Object.entries(e.headers))
        i.append(r, o);
      e.timeout && e.timeout > 0 && i.append(Hm, String(Math.ceil(e.timeout / 1e3)));
    }
    return await this.clientOptions.auth.addAuthHeaders(i, n), i;
  }
  getFileName(e) {
    var n;
    let i = "";
    return typeof e == "string" && (i = e.replace(/[/\\]+$/, ""), i = (n = i.split(/[/\\]/).pop()) !== null && n !== void 0 ? n : ""), i;
  }
  /**
   * Uploads a file asynchronously using Gemini API only, this is not supported
   * in Vertex AI.
   *
   * @param file The string path to the file to be uploaded or a Blob object.
   * @param config Optional parameters specified in the `UploadFileConfig`
   *     interface. @see {@link types.UploadFileConfig}
   * @return A promise that resolves to a `File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   */
  async uploadFile(e, n) {
    var i;
    const r = {};
    n != null && (r.mimeType = n.mimeType, r.name = n.name, r.displayName = n.displayName), r.name && !r.name.startsWith("files/") && (r.name = `files/${r.name}`);
    const o = this.clientOptions.uploader, a = await o.stat(e);
    r.sizeBytes = String(a.size);
    const l = (i = n?.mimeType) !== null && i !== void 0 ? i : a.type;
    if (l === void 0 || l === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    r.mimeType = l;
    const f = {
      file: r
    }, c = this.getFileName(e), d = z("upload/v1beta/files", f._url), p = await this.fetchUploadUrl(d, r.sizeBytes, r.mimeType, c, f, n?.httpOptions);
    return o.upload(e, p, this);
  }
  /**
   * Uploads a file to a given file search store asynchronously using Gemini API only, this is not supported
   * in Vertex AI.
   *
   * @param fileSearchStoreName The name of the file search store to upload the file to.
   * @param file The string path to the file to be uploaded or a Blob object.
   * @param config Optional parameters specified in the `UploadFileConfig`
   *     interface. @see {@link UploadFileConfig}
   * @return A promise that resolves to a `File` object.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   */
  async uploadFileToFileSearchStore(e, n, i) {
    var r;
    const o = this.clientOptions.uploader, a = await o.stat(n), l = String(a.size), f = (r = i?.mimeType) !== null && r !== void 0 ? r : a.type;
    if (f === void 0 || f === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    const c = `upload/v1beta/${e}:uploadToFileSearchStore`, d = this.getFileName(n), p = {};
    i != null && Nl(i, p);
    const h = await this.fetchUploadUrl(c, l, f, d, p, i?.httpOptions);
    return o.uploadToFileSearchStore(n, h, this);
  }
  /**
   * Downloads a file asynchronously to the specified path.
   *
   * @params params - The parameters for the download request, see {@link
   * types.DownloadFileParameters}
   */
  async downloadFile(e) {
    await this.clientOptions.downloader.download(e, this);
  }
  async fetchUploadUrl(e, n, i, r, o, a) {
    var l;
    let f = {};
    a ? f = a : f = {
      apiVersion: "",
      // api-version is set in the path.
      headers: Object.assign({ "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": `${n}`, "X-Goog-Upload-Header-Content-Type": `${i}` }, r ? { "X-Goog-Upload-File-Name": r } : {})
    };
    const c = await this.request({
      path: e,
      body: JSON.stringify(o),
      httpMethod: "POST",
      httpOptions: f
    });
    if (!c || !c?.headers)
      throw new Error("Server did not return an HttpResponse or the returned HttpResponse did not have headers.");
    const d = (l = c?.headers) === null || l === void 0 ? void 0 : l["x-goog-upload-url"];
    if (d === void 0)
      throw new Error("Failed to get upload url. Server did not return the x-google-upload-url in the headers");
    return d;
  }
}
async function fa(t) {
  var e;
  if (t === void 0)
    throw new Error("response is undefined");
  if (!t.ok) {
    const n = t.status;
    let i;
    !((e = t.headers.get("content-type")) === null || e === void 0) && e.includes("application/json") ? i = await t.json() : i = {
      error: {
        message: await t.text(),
        code: t.status,
        status: t.statusText
      }
    };
    const r = JSON.stringify(i);
    throw n >= 400 && n < 600 ? new Ln({
      message: r,
      status: n
    }) : new Error(r);
  }
}
function Qm(t, e) {
  if (!e || Object.keys(e).length === 0)
    return;
  if (t.body instanceof Blob) {
    console.warn("includeExtraBodyToRequestInit: extraBody provided but current request body is a Blob. extraBody will be ignored as merging is not supported for Blob bodies.");
    return;
  }
  let n = {};
  if (typeof t.body == "string" && t.body.length > 0)
    try {
      const o = JSON.parse(t.body);
      if (typeof o == "object" && o !== null && !Array.isArray(o))
        n = o;
      else {
        console.warn("includeExtraBodyToRequestInit: Original request body is valid JSON but not a non-array object. Skip applying extraBody to the request body.");
        return;
      }
    } catch {
      console.warn("includeExtraBodyToRequestInit: Original request body is not valid JSON. Skip applying extraBody to the request body.");
      return;
    }
  function i(o, a) {
    const l = Object.assign({}, o);
    for (const f in a)
      if (Object.prototype.hasOwnProperty.call(a, f)) {
        const c = a[f], d = l[f];
        c && typeof c == "object" && !Array.isArray(c) && d && typeof d == "object" && !Array.isArray(d) ? l[f] = i(d, c) : (d && c && typeof d != typeof c && console.warn(`includeExtraBodyToRequestInit:deepMerge: Type mismatch for key "${f}". Original type: ${typeof d}, New type: ${typeof c}. Overwriting.`), l[f] = c);
      }
    return l;
  }
  const r = i(n, e);
  t.body = JSON.stringify(r);
}
const Zm = "mcp_used/unknown";
let kl = !1;
function Ml(t) {
  for (const e of t)
    if (jm(e) || typeof e == "object" && "inputSchema" in e)
      return !0;
  return kl;
}
function xl(t) {
  var e;
  const n = (e = t[Di]) !== null && e !== void 0 ? e : "";
  t[Di] = (n + ` ${Zm}`).trimStart();
}
function jm(t) {
  return t !== null && typeof t == "object" && t instanceof an;
}
function eg(t) {
  return xe(this, arguments, function* (n, i = 100) {
    let r, o = 0;
    for (; o < i; ) {
      const a = yield j(n.listTools({ cursor: r }));
      for (const l of a.tools)
        yield yield j(l), o++;
      if (!a.nextCursor)
        break;
      r = a.nextCursor;
    }
  });
}
class an {
  constructor(e = [], n) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = e, this.config = n;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(e, n) {
    return new an(e, n);
  }
  /**
   * Validates the function names are not duplicate and initialize the function
   * name to MCP client mapping.
   *
   * @throws {Error} if the MCP tools from the MCP clients have duplicate tool
   *     names.
   */
  async initialize() {
    var e, n, i, r;
    if (this.mcpTools.length > 0)
      return;
    const o = {}, a = [];
    for (const d of this.mcpClients)
      try {
        for (var l = !0, f = (n = void 0, De(eg(d))), c; c = await f.next(), e = c.done, !e; l = !0) {
          r = c.value, l = !1;
          const p = r;
          a.push(p);
          const h = p.name;
          if (o[h])
            throw new Error(`Duplicate function name ${h} found in MCP tools. Please ensure function names are unique.`);
          o[h] = d;
        }
      } catch (p) {
        n = { error: p };
      } finally {
        try {
          !l && !e && (i = f.return) && await i.call(f);
        } finally {
          if (n) throw n.error;
        }
      }
    this.mcpTools = a, this.functionNameToMcpClient = o;
  }
  async tool() {
    return await this.initialize(), Cf(this.mcpTools, this.config);
  }
  async callTool(e) {
    await this.initialize();
    const n = [];
    for (const i of e)
      if (i.name in this.functionNameToMcpClient) {
        const r = this.functionNameToMcpClient[i.name];
        let o;
        this.config.timeout && (o = {
          timeout: this.config.timeout
        });
        const a = await r.callTool(
          {
            name: i.name,
            arguments: i.args
          },
          // Set the result schema to undefined to allow MCP to rely on the
          // default schema.
          void 0,
          o
        );
        n.push({
          functionResponse: {
            name: i.name,
            response: a.isError ? { error: a } : a
          }
        });
      }
    return n;
  }
}
function tg(t) {
  return t !== null && typeof t == "object" && "listTools" in t && typeof t.listTools == "function";
}
function tv(...t) {
  if (kl = !0, t.length === 0)
    throw new Error("No MCP clients provided");
  const e = t[t.length - 1];
  return tg(e) ? an.create(t, {}) : an.create(t.slice(0, t.length - 1), e);
}
async function ng(t, e, n) {
  const i = new yf();
  let r;
  n.data instanceof Blob ? r = JSON.parse(await n.data.text()) : r = JSON.parse(n.data), Object.assign(i, r), e(i);
}
class ig {
  constructor(e, n, i) {
    this.apiClient = e, this.auth = n, this.webSocketFactory = i;
  }
  /**
       Establishes a connection to the specified model and returns a
       LiveMusicSession object representing that connection.
  
       @experimental
  
       @remarks
  
       @param params - The parameters for establishing a connection to the model.
       @return A live session.
  
       @example
       ```ts
       let model = 'models/lyria-realtime-exp';
       const session = await ai.live.music.connect({
         model: model,
         callbacks: {
           onmessage: (e: MessageEvent) => {
             console.log('Received message from the server: %s\n', debug(e.data));
           },
           onerror: (e: ErrorEvent) => {
             console.log('Error occurred: %s\n', debug(e.error));
           },
           onclose: (e: CloseEvent) => {
             console.log('Connection closed.');
           },
         },
       });
       ```
      */
  async connect(e) {
    var n, i;
    if (this.apiClient.isVertexAI())
      throw new Error("Live music is not supported for Vertex AI.");
    console.warn("Live music generation is experimental and may change in future versions.");
    const r = this.apiClient.getWebsocketBaseUrl(), o = this.apiClient.getApiVersion(), a = sg(this.apiClient.getDefaultHeaders()), l = this.apiClient.getApiKey(), f = `${r}/ws/google.ai.generativelanguage.${o}.GenerativeService.BidiGenerateMusic?key=${l}`;
    let c = () => {
    };
    const d = new Promise((w) => {
      c = w;
    }), p = e.callbacks, h = function() {
      c({});
    }, m = this.apiClient, g = {
      onopen: h,
      onmessage: (w) => {
        ng(m, p.onmessage, w);
      },
      onerror: (n = p?.onerror) !== null && n !== void 0 ? n : function(w) {
      },
      onclose: (i = p?.onclose) !== null && i !== void 0 ? i : function(w) {
      }
    }, v = this.webSocketFactory.create(f, og(a), g);
    v.connect(), await d;
    const C = { setup: { model: ie(this.apiClient, e.model) } };
    return v.send(JSON.stringify(C)), new rg(v, this.apiClient);
  }
}
class rg {
  constructor(e, n) {
    this.conn = e, this.apiClient = n;
  }
  /**
      Sets inputs to steer music generation. Updates the session's current
      weighted prompts.
  
      @param params - Contains one property, `weightedPrompts`.
  
        - `weightedPrompts` to send to the model; weights are normalized to
          sum to 1.0.
  
      @experimental
     */
  async setWeightedPrompts(e) {
    if (!e.weightedPrompts || Object.keys(e.weightedPrompts).length === 0)
      throw new Error("Weighted prompts must be set and contain at least one entry.");
    const n = Ih(e);
    this.conn.send(JSON.stringify({ clientContent: n }));
  }
  /**
      Sets a configuration to the model. Updates the session's current
      music generation config.
  
      @param params - Contains one property, `musicGenerationConfig`.
  
        - `musicGenerationConfig` to set in the model. Passing an empty or
      undefined config to the model will reset the config to defaults.
  
      @experimental
     */
  async setMusicGenerationConfig(e) {
    e.musicGenerationConfig || (e.musicGenerationConfig = {});
    const n = wh(e);
    this.conn.send(JSON.stringify(n));
  }
  sendPlaybackControl(e) {
    const n = { playbackControl: e };
    this.conn.send(JSON.stringify(n));
  }
  /**
   * Start the music stream.
   *
   * @experimental
   */
  play() {
    this.sendPlaybackControl(ft.PLAY);
  }
  /**
   * Temporarily halt the music stream. Use `play` to resume from the current
   * position.
   *
   * @experimental
   */
  pause() {
    this.sendPlaybackControl(ft.PAUSE);
  }
  /**
   * Stop the music stream and reset the state. Retains the current prompts
   * and config.
   *
   * @experimental
   */
  stop() {
    this.sendPlaybackControl(ft.STOP);
  }
  /**
   * Resets the context of the music generation without stopping it.
   * Retains the current prompts and config.
   *
   * @experimental
   */
  resetContext() {
    this.sendPlaybackControl(ft.RESET_CONTEXT);
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
     */
  close() {
    this.conn.close();
  }
}
function og(t) {
  const e = {};
  return t.forEach((n, i) => {
    e[i] = n;
  }), e;
}
function sg(t) {
  const e = new Headers();
  for (const [n, i] of Object.entries(t))
    e.append(n, i);
  return e;
}
const ag = "FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls in Google AI.";
async function lg(t, e, n) {
  const i = new gf();
  let r;
  n.data instanceof Blob ? r = await n.data.text() : n.data instanceof ArrayBuffer ? r = new TextDecoder().decode(n.data) : r = n.data;
  const o = JSON.parse(r);
  if (t.isVertexAI()) {
    const a = Nh(o);
    Object.assign(i, a);
  } else
    Object.assign(i, o);
  e(i);
}
class cg {
  constructor(e, n, i) {
    this.apiClient = e, this.auth = n, this.webSocketFactory = i, this.music = new ig(this.apiClient, this.auth, this.webSocketFactory);
  }
  /**
       Establishes a connection to the specified model with the given
       configuration and returns a Session object representing that connection.
  
       @experimental Built-in MCP support is an experimental feature, may change in
       future versions.
  
       @remarks
  
       @param params - The parameters for establishing a connection to the model.
       @return A live session.
  
       @example
       ```ts
       let model: string;
       if (GOOGLE_GENAI_USE_VERTEXAI) {
         model = 'gemini-2.0-flash-live-preview-04-09';
       } else {
         model = 'gemini-live-2.5-flash-preview';
       }
       const session = await ai.live.connect({
         model: model,
         config: {
           responseModalities: [Modality.AUDIO],
         },
         callbacks: {
           onopen: () => {
             console.log('Connected to the socket.');
           },
           onmessage: (e: MessageEvent) => {
             console.log('Received message from the server: %s\n', debug(e.data));
           },
           onerror: (e: ErrorEvent) => {
             console.log('Error occurred: %s\n', debug(e.error));
           },
           onclose: (e: CloseEvent) => {
             console.log('Connection closed.');
           },
         },
       });
       ```
      */
  async connect(e) {
    var n, i, r, o, a, l;
    if (e.config && e.config.httpOptions)
      throw new Error("The Live module does not support httpOptions at request-level in LiveConnectConfig yet. Please use the client-level httpOptions configuration instead.");
    const f = this.apiClient.getWebsocketBaseUrl(), c = this.apiClient.getApiVersion();
    let d;
    const p = this.apiClient.getHeaders();
    e.config && e.config.tools && Ml(e.config.tools) && xl(p);
    const h = hg(p);
    if (this.apiClient.isVertexAI()) {
      const P = this.apiClient.getProject(), N = this.apiClient.getLocation(), G = this.apiClient.getApiKey(), V = !!P && !!N || !!G;
      this.apiClient.getCustomBaseUrl() && !V ? d = f : (d = `${f}/ws/google.cloud.aiplatform.${c}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(h, d));
    } else {
      const P = this.apiClient.getApiKey();
      let N = "BidiGenerateContent", G = "key";
      P?.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), c !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), N = "BidiGenerateContentConstrained", G = "access_token"), d = `${f}/ws/google.ai.generativelanguage.${c}.GenerativeService.${N}?${G}=${P}`;
    }
    let m = () => {
    };
    const g = new Promise((P) => {
      m = P;
    }), v = e.callbacks, E = function() {
      var P;
      (P = v?.onopen) === null || P === void 0 || P.call(v), m({});
    }, T = this.apiClient, C = {
      onopen: E,
      onmessage: (P) => {
        lg(T, v.onmessage, P);
      },
      onerror: (n = v?.onerror) !== null && n !== void 0 ? n : function(P) {
      },
      onclose: (i = v?.onclose) !== null && i !== void 0 ? i : function(P) {
      }
    }, w = this.webSocketFactory.create(d, dg(h), C);
    w.connect(), await g;
    let D = ie(this.apiClient, e.model);
    if (this.apiClient.isVertexAI() && D.startsWith("publishers/")) {
      const P = this.apiClient.getProject(), N = this.apiClient.getLocation();
      P && N && (D = `projects/${P}/locations/${N}/` + D);
    }
    let _ = {};
    this.apiClient.isVertexAI() && ((r = e.config) === null || r === void 0 ? void 0 : r.responseModalities) === void 0 && (e.config === void 0 ? e.config = { responseModalities: [An.AUDIO] } : e.config.responseModalities = [An.AUDIO]), !((o = e.config) === null || o === void 0) && o.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const y = (l = (a = e.config) === null || a === void 0 ? void 0 : a.tools) !== null && l !== void 0 ? l : [], S = [];
    for (const P of y)
      if (this.isCallableTool(P)) {
        const N = P;
        S.push(await N.tool());
      } else
        S.push(P);
    S.length > 0 && (e.config.tools = S);
    const R = {
      model: D,
      config: e.config,
      callbacks: e.callbacks
    };
    return this.apiClient.isVertexAI() ? _ = Ah(this.apiClient, R) : _ = Ch(this.apiClient, R), delete _.config, w.send(JSON.stringify(_)), new fg(w, this.apiClient);
  }
  // TODO: b/416041229 - Abstract this method to a common place.
  isCallableTool(e) {
    return "callTool" in e && typeof e.callTool == "function";
  }
}
const ug = {
  turnComplete: !0
};
class fg {
  constructor(e, n) {
    this.conn = e, this.apiClient = n;
  }
  tLiveClientContent(e, n) {
    if (n.turns !== null && n.turns !== void 0) {
      let i = [];
      try {
        i = Ae(n.turns), e.isVertexAI() || (i = i.map((r) => un(r)));
      } catch {
        throw new Error(`Failed to parse client content "turns", type: '${typeof n.turns}'`);
      }
      return {
        clientContent: { turns: i, turnComplete: n.turnComplete }
      };
    }
    return {
      clientContent: { turnComplete: n.turnComplete }
    };
  }
  tLiveClienttToolResponse(e, n) {
    let i = [];
    if (n.functionResponses == null)
      throw new Error("functionResponses is required.");
    if (Array.isArray(n.functionResponses) ? i = n.functionResponses : i = [n.functionResponses], i.length === 0)
      throw new Error("functionResponses is required.");
    for (const o of i) {
      if (typeof o != "object" || o === null || !("name" in o) || !("response" in o))
        throw new Error(`Could not parse function response, type '${typeof o}'.`);
      if (!e.isVertexAI() && !("id" in o))
        throw new Error(ag);
    }
    return {
      toolResponse: { functionResponses: i }
    };
  }
  /**
      Send a message over the established connection.
  
      @param params - Contains two **optional** properties, `turns` and
          `turnComplete`.
  
        - `turns` will be converted to a `Content[]`
        - `turnComplete: true` [default] indicates that you are done sending
          content and expect a response. If `turnComplete: false`, the server
          will wait for additional messages before starting generation.
  
      @experimental
  
      @remarks
      There are two ways to send messages to the live API:
      `sendClientContent` and `sendRealtimeInput`.
  
      `sendClientContent` messages are added to the model context **in order**.
      Having a conversation using `sendClientContent` messages is roughly
      equivalent to using the `Chat.sendMessageStream`, except that the state of
      the `chat` history is stored on the API server instead of locally.
  
      Because of `sendClientContent`'s order guarantee, the model cannot respons
      as quickly to `sendClientContent` messages as to `sendRealtimeInput`
      messages. This makes the biggest difference when sending objects that have
      significant preprocessing time (typically images).
  
      The `sendClientContent` message sends a `Content[]`
      which has more options than the `Blob` sent by `sendRealtimeInput`.
  
      So the main use-cases for `sendClientContent` over `sendRealtimeInput` are:
  
      - Sending anything that can't be represented as a `Blob` (text,
      `sendClientContent({turns="Hello?"}`)).
      - Managing turns when not using audio input and voice activity detection.
        (`sendClientContent({turnComplete:true})` or the short form
      `sendClientContent()`)
      - Prefilling a conversation context
        ```
        sendClientContent({
            turns: [
              Content({role:user, parts:...}),
              Content({role:user, parts:...}),
              ...
            ]
        })
        ```
      @experimental
     */
  sendClientContent(e) {
    e = Object.assign(Object.assign({}, ug), e);
    const n = this.tLiveClientContent(this.apiClient, e);
    this.conn.send(JSON.stringify(n));
  }
  /**
      Send a realtime message over the established connection.
  
      @param params - Contains one property, `media`.
  
        - `media` will be converted to a `Blob`
  
      @experimental
  
      @remarks
      Use `sendRealtimeInput` for realtime audio chunks and video frames (images).
  
      With `sendRealtimeInput` the api will respond to audio automatically
      based on voice activity detection (VAD).
  
      `sendRealtimeInput` is optimized for responsivness at the expense of
      deterministic ordering guarantees. Audio and video tokens are to the
      context when they become available.
  
      Note: The Call signature expects a `Blob` object, but only a subset
      of audio and image mimetypes are allowed.
     */
  sendRealtimeInput(e) {
    let n = {};
    this.apiClient.isVertexAI() ? n = {
      realtimeInput: Ph(e)
    } : n = {
      realtimeInput: Rh(e)
    }, this.conn.send(JSON.stringify(n));
  }
  /**
      Send a function response message over the established connection.
  
      @param params - Contains property `functionResponses`.
  
        - `functionResponses` will be converted to a `functionResponses[]`
  
      @remarks
      Use `sendFunctionResponse` to reply to `LiveServerToolCall` from the server.
  
      Use {@link types.LiveConnectConfig#tools} to configure the callable functions.
  
      @experimental
     */
  sendToolResponse(e) {
    if (e.functionResponses == null)
      throw new Error("Tool response parameters are required.");
    const n = this.tLiveClienttToolResponse(this.apiClient, e);
    this.conn.send(JSON.stringify(n));
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
  
       @example
       ```ts
       let model: string;
       if (GOOGLE_GENAI_USE_VERTEXAI) {
         model = 'gemini-2.0-flash-live-preview-04-09';
       } else {
         model = 'gemini-live-2.5-flash-preview';
       }
       const session = await ai.live.connect({
         model: model,
         config: {
           responseModalities: [Modality.AUDIO],
         }
       });
  
       session.close();
       ```
     */
  close() {
    this.conn.close();
  }
}
function dg(t) {
  const e = {};
  return t.forEach((n, i) => {
    e[i] = n;
  }), e;
}
function hg(t) {
  const e = new Headers();
  for (const [n, i] of Object.entries(t))
    e.append(n, i);
  return e;
}
const da = 10;
function ha(t) {
  var e, n, i;
  if (!((e = t?.automaticFunctionCalling) === null || e === void 0) && e.disable)
    return !0;
  let r = !1;
  for (const a of (n = t?.tools) !== null && n !== void 0 ? n : [])
    if (pt(a)) {
      r = !0;
      break;
    }
  if (!r)
    return !0;
  const o = (i = t?.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls;
  return o && (o < 0 || !Number.isInteger(o)) || o == 0 ? (console.warn("Invalid maximumRemoteCalls value provided for automatic function calling. Disabled automatic function calling. Please provide a valid integer value greater than 0. maximumRemoteCalls provided:", o), !0) : !1;
}
function pt(t) {
  return "callTool" in t && typeof t.callTool == "function";
}
function pg(t) {
  var e, n, i;
  return (i = (n = (e = t.config) === null || e === void 0 ? void 0 : e.tools) === null || n === void 0 ? void 0 : n.some((r) => pt(r))) !== null && i !== void 0 ? i : !1;
}
function pa(t) {
  var e;
  const n = [];
  return !((e = t?.config) === null || e === void 0) && e.tools && t.config.tools.forEach((i, r) => {
    if (pt(i))
      return;
    const o = i;
    o.functionDeclarations && o.functionDeclarations.length > 0 && n.push(r);
  }), n;
}
function ma(t) {
  var e;
  return !(!((e = t?.automaticFunctionCalling) === null || e === void 0) && e.ignoreCallHistory);
}
class mg extends He {
  constructor(e) {
    super(), this.apiClient = e, this.embedContent = async (n) => {
      if (!this.apiClient.isVertexAI())
        return await this.embedContentInternal(n);
      if (n.model.includes("gemini") && n.model !== "gemini-embedding-001" || n.model.includes("maas")) {
        const r = Ae(n.contents);
        if (r.length > 1)
          throw new Error("The embedContent API for this model only supports one content at a time.");
        const o = Object.assign(Object.assign({}, n), { content: r[0], embeddingApiType: wn.EMBED_CONTENT });
        return await this.embedContentInternal(o);
      } else {
        const r = Object.assign(Object.assign({}, n), { embeddingApiType: wn.PREDICT });
        return await this.embedContentInternal(r);
      }
    }, this.generateContent = async (n) => {
      var i, r, o, a, l;
      const f = await this.processParamsMaybeAddMcpUsage(n);
      if (this.maybeMoveToResponseJsonSchem(n), !pg(n) || ha(n.config))
        return await this.generateContentInternal(f);
      const c = pa(n);
      if (c.length > 0) {
        const v = c.map((E) => `tools[${E}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${v}.`);
      }
      let d, p;
      const h = Ae(f.contents), m = (o = (r = (i = f.config) === null || i === void 0 ? void 0 : i.automaticFunctionCalling) === null || r === void 0 ? void 0 : r.maximumRemoteCalls) !== null && o !== void 0 ? o : da;
      let g = 0;
      for (; g < m && (d = await this.generateContentInternal(f), !(!d.functionCalls || d.functionCalls.length === 0)); ) {
        const v = d.candidates[0].content, E = [];
        for (const T of (l = (a = n.config) === null || a === void 0 ? void 0 : a.tools) !== null && l !== void 0 ? l : [])
          if (pt(T)) {
            const w = await T.callTool(d.functionCalls);
            E.push(...w);
          }
        g++, p = {
          role: "user",
          parts: E
        }, f.contents = Ae(f.contents), f.contents.push(v), f.contents.push(p), ma(f.config) && (h.push(v), h.push(p));
      }
      return ma(f.config) && (d.automaticFunctionCallingHistory = h), d;
    }, this.generateContentStream = async (n) => {
      var i, r, o, a, l;
      if (this.maybeMoveToResponseJsonSchem(n), ha(n.config)) {
        const p = await this.processParamsMaybeAddMcpUsage(n);
        return await this.generateContentStreamInternal(p);
      }
      const f = pa(n);
      if (f.length > 0) {
        const p = f.map((h) => `tools[${h}]`).join(", ");
        throw new Error(`Incompatible tools found at ${p}. Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations" is not yet supported.`);
      }
      const c = (o = (r = (i = n?.config) === null || i === void 0 ? void 0 : i.toolConfig) === null || r === void 0 ? void 0 : r.functionCallingConfig) === null || o === void 0 ? void 0 : o.streamFunctionCallArguments, d = (l = (a = n?.config) === null || a === void 0 ? void 0 : a.automaticFunctionCalling) === null || l === void 0 ? void 0 : l.disable;
      if (c && !d)
        throw new Error("Running in streaming mode with 'streamFunctionCallArguments' enabled, this feature is not compatible with automatic function calling (AFC). Please set 'config.automaticFunctionCalling.disable' to true to disable AFC or leave 'config.toolConfig.functionCallingConfig.streamFunctionCallArguments' to be undefined or set to false to disable streaming function call arguments feature.");
      return await this.processAfcStream(n);
    }, this.generateImages = async (n) => await this.generateImagesInternal(n).then((i) => {
      var r;
      let o;
      const a = [];
      if (i?.generatedImages)
        for (const f of i.generatedImages)
          f && f?.safetyAttributes && ((r = f?.safetyAttributes) === null || r === void 0 ? void 0 : r.contentType) === "Positive Prompt" ? o = f?.safetyAttributes : a.push(f);
      let l;
      return o ? l = {
        generatedImages: a,
        positivePromptSafetyAttributes: o,
        sdkHttpResponse: i.sdkHttpResponse
      } : l = {
        generatedImages: a,
        sdkHttpResponse: i.sdkHttpResponse
      }, l;
    }), this.list = async (n) => {
      var i;
      const a = {
        config: Object.assign(Object.assign({}, {
          queryBase: !0
        }), n?.config)
      };
      if (this.apiClient.isVertexAI() && !a.config.queryBase) {
        if (!((i = a.config) === null || i === void 0) && i.filter)
          throw new Error("Filtering tuned models list for Vertex AI is not currently supported");
        a.config.filter = "labels.tune-type:*";
      }
      return new ct(Be.PAGED_ITEM_MODELS, (l) => this.listInternal(l), await this.listInternal(a), a);
    }, this.editImage = async (n) => {
      const i = {
        model: n.model,
        prompt: n.prompt,
        referenceImages: [],
        config: n.config
      };
      return n.referenceImages && n.referenceImages && (i.referenceImages = n.referenceImages.map((r) => r.toReferenceImageAPI())), await this.editImageInternal(i);
    }, this.upscaleImage = async (n) => {
      let i = {
        numberOfImages: 1,
        mode: "upscale"
      };
      n.config && (i = Object.assign(Object.assign({}, i), n.config));
      const r = {
        model: n.model,
        image: n.image,
        upscaleFactor: n.upscaleFactor,
        config: i
      };
      return await this.upscaleImageInternal(r);
    }, this.generateVideos = async (n) => {
      var i, r, o, a, l, f;
      if ((n.prompt || n.image || n.video) && n.source)
        throw new Error("Source and prompt/image/video are mutually exclusive. Please only use source.");
      return this.apiClient.isVertexAI() || (!((i = n.video) === null || i === void 0) && i.uri && (!((r = n.video) === null || r === void 0) && r.videoBytes) ? n.video = {
        uri: n.video.uri,
        mimeType: n.video.mimeType
      } : !((a = (o = n.source) === null || o === void 0 ? void 0 : o.video) === null || a === void 0) && a.uri && (!((f = (l = n.source) === null || l === void 0 ? void 0 : l.video) === null || f === void 0) && f.videoBytes) && (n.source.video = {
        uri: n.source.video.uri,
        mimeType: n.source.video.mimeType
      })), await this.generateVideosInternal(n);
    };
  }
  /**
   * This logic is needed for GenerateContentConfig only.
   * Previously we made GenerateContentConfig.responseSchema field to accept
   * unknown. Since v1.9.0, we switch to use backend JSON schema support.
   * To maintain backward compatibility, we move the data that was treated as
   * JSON schema from the responseSchema field to the responseJsonSchema field.
   */
  maybeMoveToResponseJsonSchem(e) {
    e.config && e.config.responseSchema && (e.config.responseJsonSchema || Object.keys(e.config.responseSchema).includes("$schema") && (e.config.responseJsonSchema = e.config.responseSchema, delete e.config.responseSchema));
  }
  /**
   * Transforms the CallableTools in the parameters to be simply Tools, it
   * copies the params into a new object and replaces the tools, it does not
   * modify the original params. Also sets the MCP usage header if there are
   * MCP tools in the parameters.
   */
  async processParamsMaybeAddMcpUsage(e) {
    var n, i, r;
    const o = (n = e.config) === null || n === void 0 ? void 0 : n.tools;
    if (!o)
      return e;
    const a = await Promise.all(o.map(async (f) => pt(f) ? await f.tool() : f)), l = {
      model: e.model,
      contents: e.contents,
      config: Object.assign(Object.assign({}, e.config), { tools: a })
    };
    if (l.config.tools = a, e.config && e.config.tools && Ml(e.config.tools)) {
      const f = (r = (i = e.config.httpOptions) === null || i === void 0 ? void 0 : i.headers) !== null && r !== void 0 ? r : {};
      let c = Object.assign({}, f);
      Object.keys(c).length === 0 && (c = this.apiClient.getDefaultHeaders()), xl(c), l.config.httpOptions = Object.assign(Object.assign({}, e.config.httpOptions), { headers: c });
    }
    return l;
  }
  async initAfcToolsMap(e) {
    var n, i, r;
    const o = /* @__PURE__ */ new Map();
    for (const a of (i = (n = e.config) === null || n === void 0 ? void 0 : n.tools) !== null && i !== void 0 ? i : [])
      if (pt(a)) {
        const l = a, f = await l.tool();
        for (const c of (r = f.functionDeclarations) !== null && r !== void 0 ? r : []) {
          if (!c.name)
            throw new Error("Function declaration name is required.");
          if (o.has(c.name))
            throw new Error(`Duplicate tool declaration name: ${c.name}`);
          o.set(c.name, l);
        }
      }
    return o;
  }
  async processAfcStream(e) {
    var n, i, r;
    const o = (r = (i = (n = e.config) === null || n === void 0 ? void 0 : n.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && r !== void 0 ? r : da;
    let a = !1, l = 0;
    const f = await this.initAfcToolsMap(e);
    return (function(c, d, p) {
      return xe(this, arguments, function* () {
        for (var h, m, g, v, E, T; l < o; ) {
          a && (l++, a = !1);
          const _ = yield j(c.processParamsMaybeAddMcpUsage(p)), y = yield j(c.generateContentStreamInternal(_)), S = [], R = [];
          try {
            for (var C = !0, w = (m = void 0, De(y)), D; D = yield j(w.next()), h = D.done, !h; C = !0) {
              v = D.value, C = !1;
              const P = v;
              if (yield yield j(P), P.candidates && (!((E = P.candidates[0]) === null || E === void 0) && E.content)) {
                R.push(P.candidates[0].content);
                for (const N of (T = P.candidates[0].content.parts) !== null && T !== void 0 ? T : [])
                  if (l < o && N.functionCall) {
                    if (!N.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (d.has(N.functionCall.name)) {
                      const G = yield j(d.get(N.functionCall.name).callTool([N.functionCall]));
                      S.push(...G);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${d.keys()}, mising tool: ${N.functionCall.name}`);
                  }
              }
            }
          } catch (P) {
            m = { error: P };
          } finally {
            try {
              !C && !h && (g = w.return) && (yield j(g.call(w)));
            } finally {
              if (m) throw m.error;
            }
          }
          if (S.length > 0) {
            a = !0;
            const P = new en();
            P.candidates = [
              {
                content: {
                  role: "user",
                  parts: S
                }
              }
            ], yield yield j(P);
            const N = [];
            N.push(...R), N.push({
              role: "user",
              parts: S
            });
            const G = Ae(p.contents).concat(N);
            p.contents = G;
          } else
            break;
        }
      });
    })(this, f, e);
  }
  async generateContentInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = la(this.apiClient, e);
      return l = z("{model}:generateContent", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = ua(d), h = new en();
        return Object.assign(h, p), h;
      });
    } else {
      const c = aa(this.apiClient, e);
      return l = z("{model}:generateContent", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = ca(d), h = new en();
        return Object.assign(h, p), h;
      });
    }
  }
  async generateContentStreamInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = la(this.apiClient, e);
      return l = z("{model}:streamGenerateContent?alt=sse", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }), a.then(function(p) {
        return xe(this, arguments, function* () {
          var h, m, g, v;
          try {
            for (var E = !0, T = De(p), C; C = yield j(T.next()), h = C.done, !h; E = !0) {
              v = C.value, E = !1;
              const w = v, D = ua(yield j(w.json()), e);
              D.sdkHttpResponse = {
                headers: w.headers
              };
              const _ = new en();
              Object.assign(_, D), yield yield j(_);
            }
          } catch (w) {
            m = { error: w };
          } finally {
            try {
              !E && !h && (g = T.return) && (yield j(g.call(T)));
            } finally {
              if (m) throw m.error;
            }
          }
        });
      });
    } else {
      const c = aa(this.apiClient, e);
      return l = z("{model}:streamGenerateContent?alt=sse", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(p) {
        return xe(this, arguments, function* () {
          var h, m, g, v;
          try {
            for (var E = !0, T = De(p), C; C = yield j(T.next()), h = C.done, !h; E = !0) {
              v = C.value, E = !1;
              const w = v, D = ca(yield j(w.json()), e);
              D.sdkHttpResponse = {
                headers: w.headers
              };
              const _ = new en();
              Object.assign(_, D), yield yield j(_);
            }
          } catch (w) {
            m = { error: w };
          } finally {
            try {
              !E && !h && (g = T.return) && (yield j(g.call(T)));
            } finally {
              if (m) throw m.error;
            }
          }
        });
      });
    }
  }
  /**
   * Calculates embeddings for the given contents. Only text is supported.
   *
   * @param params - The parameters for embedding contents.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.embedContent({
   *  model: 'text-embedding-004',
   *  contents: [
   *    'What is your name?',
   *    'What is your favorite color?',
   *  ],
   *  config: {
   *    outputDimensionality: 64,
   *  },
   * });
   * console.log(response);
   * ```
   */
  async embedContentInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = ap(this.apiClient, e, e), d = wf(e.model) ? "{model}:embedContent" : "{model}:predict";
      return l = z(d, c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((p) => p.json().then((h) => {
        const m = h;
        return m.sdkHttpResponse = {
          headers: p.headers
        }, m;
      })), a.then((p) => {
        const h = cp(p, e), m = new Js();
        return Object.assign(m, h), m;
      });
    } else {
      const c = sp(this.apiClient, e);
      return l = z("{model}:batchEmbedContents", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = lp(d), h = new Js();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Private method for generating images.
   */
  async generateImagesInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ep(this.apiClient, e);
      return l = z("{model}:predict", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Sp(d), h = new $s();
        return Object.assign(h, p), h;
      });
    } else {
      const c = vp(this.apiClient, e);
      return l = z("{model}:predict", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Tp(d), h = new $s();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Private method for editing an image.
   */
  async editImageInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = np(this.apiClient, e);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => {
        const c = ip(f), d = new rf();
        return Object.assign(d, c), d;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for upscaling an image.
   */
  async upscaleImageInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = Em(this.apiClient, e);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => {
        const c = Tm(f), d = new of();
        return Object.assign(d, c), d;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Recontextualizes an image.
   *
   * There are two types of recontextualization currently supported:
   * 1) Imagen Product Recontext - Generate images of products in new scenes
   *    and contexts.
   * 2) Virtual Try-On: Generate images of persons modeling fashion products.
   *
   * @param params - The parameters for recontextualizing an image.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response1 = await ai.models.recontextImage({
   *  model: 'imagen-product-recontext-preview-06-30',
   *  source: {
   *    prompt: 'In a modern kitchen setting.',
   *    productImages: [productImage],
   *  },
   *  config: {
   *    numberOfImages: 1,
   *  },
   * });
   * console.log(response1?.generatedImages?.[0]?.image?.imageBytes);
   *
   * const response2 = await ai.models.recontextImage({
   *  model: 'virtual-try-on-001',
   *  source: {
   *    personImage: personImage,
   *    productImages: [productImage],
   *  },
   *  config: {
   *    numberOfImages: 1,
   *  },
   * });
   * console.log(response2?.generatedImages?.[0]?.image?.imageBytes);
   * ```
   */
  async recontextImage(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = tm(this.apiClient, e);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = nm(f), d = new sf();
        return Object.assign(d, c), d;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Segments an image, creating a mask of a specified area.
   *
   * @param params - The parameters for segmenting an image.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.segmentImage({
   *  model: 'image-segmentation-001',
   *  source: {
   *    image: image,
   *  },
   *  config: {
   *    mode: 'foreground',
   *  },
   * });
   * console.log(response?.generatedMasks?.[0]?.mask?.imageBytes);
   * ```
   */
  async segmentImage(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = lm(this.apiClient, e);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = cm(f), d = new af();
        return Object.assign(d, c), d;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Fetches information about a model by name.
   *
   * @example
   * ```ts
   * const modelInfo = await ai.models.get({model: 'gemini-2.0-flash'});
   * ```
   */
  async get(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Gp(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => xi(d));
    } else {
      const c = Fp(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => Mi(d));
    }
  }
  async listInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Yp(this.apiClient, e);
      return l = z("{models_url}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Xp(d), h = new Ws();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Kp(this.apiClient, e);
      return l = z("{models_url}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = zp(d), h = new Ws();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Updates a tuned model by its name.
   *
   * @param params - The parameters for updating the model.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.update({
   *   model: 'tuned-model-name',
   *   config: {
   *     displayName: 'New display name',
   *     description: 'New description',
   *   },
   * });
   * ```
   */
  async update(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = _m(this.apiClient, e);
      return l = z("{model}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => xi(d));
    } else {
      const c = ym(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => Mi(d));
    }
  }
  /**
   * Deletes a tuned model by its name.
   *
   * @param params - The parameters for deleting the model.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.delete({model: 'tuned-model-name'});
   * ```
   */
  async delete(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Zh(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = ep(d), h = new Ks();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Qh(this.apiClient, e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = jh(d), h = new Ks();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Counts the number of tokens in the given contents. Multimodal input is
   * supported for Gemini models.
   *
   * @param params - The parameters for counting tokens.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.countTokens({
   *  model: 'gemini-2.0-flash',
   *  contents: 'The quick brown fox jumps over the lazy dog.'
   * });
   * console.log(response);
   * ```
   */
  async countTokens(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Yh(this.apiClient, e);
      return l = z("{model}:countTokens", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Xh(d), h = new Ys();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Kh(this.apiClient, e);
      return l = z("{model}:countTokens", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = zh(d), h = new Ys();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Given a list of contents, returns a corresponding TokensInfo containing
   * the list of tokens and list of token ids.
   *
   * This method is not supported by the Gemini Developer API.
   *
   * @param params - The parameters for computing tokens.
   * @return The response from the API.
   *
   * @example
   * ```ts
   * const response = await ai.models.computeTokens({
   *  model: 'gemini-2.0-flash',
   *  contents: 'What is your name?'
   * });
   * console.log(response);
   * ```
   */
  async computeTokens(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = qh(this.apiClient, e);
      return o = z("{model}:computeTokens", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => {
        const c = Bh(f), d = new lf();
        return Object.assign(d, c), d;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for generating videos.
   */
  async generateVideosInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Pp(this.apiClient, e);
      return l = z("{model}:predictLongRunning", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a.then((d) => {
        const p = Ip(d), h = new In();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Rp(this.apiClient, e);
      return l = z("{model}:predictLongRunning", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a.then((d) => {
        const p = wp(d), h = new In();
        return Object.assign(h, p), h;
      });
    }
  }
}
class gg extends He {
  constructor(e) {
    super(), this.apiClient = e;
  }
  /**
   * Gets the status of a long-running operation.
   *
   * @param parameters The parameters for the get operation request.
   * @return The updated Operation object, with the latest status or result.
   */
  async getVideosOperation(e) {
    const n = e.operation, i = e.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const r = n.name.split("/operations/")[0];
      let o;
      i && "httpOptions" in i && (o = i.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: r,
        config: { httpOptions: o }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const r = await this.getVideosOperationInternal({
        operationName: n.name,
        config: i
      });
      return n._fromAPIResponse({
        apiResponse: r,
        _isVertexAI: !1
      });
    }
  }
  /**
   * Gets the status of a long-running operation.
   *
   * @param parameters The parameters for the get operation request.
   * @return The updated Operation object, with the latest status or result.
   */
  async get(e) {
    const n = e.operation, i = e.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const r = n.name.split("/operations/")[0];
      let o;
      i && "httpOptions" in i && (o = i.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: r,
        config: { httpOptions: o }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const r = await this.getVideosOperationInternal({
        operationName: n.name,
        config: i
      });
      return n._fromAPIResponse({
        apiResponse: r,
        _isVertexAI: !1
      });
    }
  }
  async getVideosOperationInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Qu(e);
      return l = z("{operationName}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json()), a;
    } else {
      const c = Xu(e);
      return l = z("{operationName}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json()), a;
    }
  }
  async fetchPredictVideosOperationInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = Vu(e);
      return o = z("{resourceName}:fetchPredictOperation", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r;
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
}
function yg(t) {
  const e = {}, n = s(t, ["apiKey"]);
  if (n != null && u(e, ["apiKey"], n), s(t, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(t, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(t, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(t, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(t, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return e;
}
function _g(t) {
  const e = {}, n = s(t, ["data"]);
  if (n != null && u(e, ["data"], n), s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function vg(t) {
  const e = {}, n = s(t, ["parts"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((o) => Pg(o))), u(e, ["parts"], r);
  }
  const i = s(t, ["role"]);
  return i != null && u(e, ["role"], i), e;
}
function Eg(t, e, n) {
  const i = {}, r = s(e, ["expireTime"]);
  n !== void 0 && r != null && u(n, ["expireTime"], r);
  const o = s(e, [
    "newSessionExpireTime"
  ]);
  n !== void 0 && o != null && u(n, ["newSessionExpireTime"], o);
  const a = s(e, ["uses"]);
  n !== void 0 && a != null && u(n, ["uses"], a);
  const l = s(e, [
    "liveConnectConstraints"
  ]);
  n !== void 0 && l != null && u(n, ["bidiGenerateContentSetup"], Rg(t, l));
  const f = s(e, [
    "lockAdditionalFields"
  ]);
  return n !== void 0 && f != null && u(n, ["fieldMask"], f), i;
}
function Tg(t, e) {
  const n = {}, i = s(e, ["config"]);
  return i != null && u(n, ["config"], Eg(t, i, n)), n;
}
function Sg(t) {
  const e = {};
  if (s(t, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(t, ["fileUri"]);
  n != null && u(e, ["fileUri"], n);
  const i = s(t, ["mimeType"]);
  return i != null && u(e, ["mimeType"], i), e;
}
function Cg(t) {
  const e = {}, n = s(t, ["id"]);
  n != null && u(e, ["id"], n);
  const i = s(t, ["args"]);
  i != null && u(e, ["args"], i);
  const r = s(t, ["name"]);
  if (r != null && u(e, ["name"], r), s(t, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(t, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return e;
}
function Ag(t) {
  const e = {}, n = s(t, ["authConfig"]);
  n != null && u(e, ["authConfig"], yg(n));
  const i = s(t, ["enableWidget"]);
  return i != null && u(e, ["enableWidget"], i), e;
}
function wg(t) {
  const e = {}, n = s(t, ["searchTypes"]);
  if (n != null && u(e, ["searchTypes"], n), s(t, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(t, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const i = s(t, [
    "timeRangeFilter"
  ]);
  return i != null && u(e, ["timeRangeFilter"], i), e;
}
function Ig(t, e) {
  const n = {}, i = s(t, [
    "generationConfig"
  ]);
  e !== void 0 && i != null && u(e, ["setup", "generationConfig"], i);
  const r = s(t, [
    "responseModalities"
  ]);
  e !== void 0 && r != null && u(e, ["setup", "generationConfig", "responseModalities"], r);
  const o = s(t, ["temperature"]);
  e !== void 0 && o != null && u(e, ["setup", "generationConfig", "temperature"], o);
  const a = s(t, ["topP"]);
  e !== void 0 && a != null && u(e, ["setup", "generationConfig", "topP"], a);
  const l = s(t, ["topK"]);
  e !== void 0 && l != null && u(e, ["setup", "generationConfig", "topK"], l);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  e !== void 0 && f != null && u(e, ["setup", "generationConfig", "maxOutputTokens"], f);
  const c = s(t, [
    "mediaResolution"
  ]);
  e !== void 0 && c != null && u(e, ["setup", "generationConfig", "mediaResolution"], c);
  const d = s(t, ["seed"]);
  e !== void 0 && d != null && u(e, ["setup", "generationConfig", "seed"], d);
  const p = s(t, ["speechConfig"]);
  e !== void 0 && p != null && u(e, ["setup", "generationConfig", "speechConfig"], Qi(p));
  const h = s(t, [
    "thinkingConfig"
  ]);
  e !== void 0 && h != null && u(e, ["setup", "generationConfig", "thinkingConfig"], h);
  const m = s(t, [
    "enableAffectiveDialog"
  ]);
  e !== void 0 && m != null && u(e, ["setup", "generationConfig", "enableAffectiveDialog"], m);
  const g = s(t, [
    "systemInstruction"
  ]);
  e !== void 0 && g != null && u(e, ["setup", "systemInstruction"], vg(ye(g)));
  const v = s(t, ["tools"]);
  if (e !== void 0 && v != null) {
    let y = _t(v);
    Array.isArray(y) && (y = y.map((S) => kg(yt(S)))), u(e, ["setup", "tools"], y);
  }
  const E = s(t, [
    "sessionResumption"
  ]);
  e !== void 0 && E != null && u(e, ["setup", "sessionResumption"], Ng(E));
  const T = s(t, [
    "inputAudioTranscription"
  ]);
  e !== void 0 && T != null && u(e, ["setup", "inputAudioTranscription"], T);
  const C = s(t, [
    "outputAudioTranscription"
  ]);
  e !== void 0 && C != null && u(e, ["setup", "outputAudioTranscription"], C);
  const w = s(t, [
    "realtimeInputConfig"
  ]);
  e !== void 0 && w != null && u(e, ["setup", "realtimeInputConfig"], w);
  const D = s(t, [
    "contextWindowCompression"
  ]);
  e !== void 0 && D != null && u(e, ["setup", "contextWindowCompression"], D);
  const _ = s(t, ["proactivity"]);
  if (e !== void 0 && _ != null && u(e, ["setup", "proactivity"], _), s(t, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function Rg(t, e) {
  const n = {}, i = s(e, ["model"]);
  i != null && u(n, ["setup", "model"], ie(t, i));
  const r = s(e, ["config"]);
  return r != null && u(n, ["config"], Ig(r, n)), n;
}
function Pg(t) {
  const e = {}, n = s(t, [
    "mediaResolution"
  ]);
  n != null && u(e, ["mediaResolution"], n);
  const i = s(t, [
    "codeExecutionResult"
  ]);
  i != null && u(e, ["codeExecutionResult"], i);
  const r = s(t, [
    "executableCode"
  ]);
  r != null && u(e, ["executableCode"], r);
  const o = s(t, ["fileData"]);
  o != null && u(e, ["fileData"], Sg(o));
  const a = s(t, ["functionCall"]);
  a != null && u(e, ["functionCall"], Cg(a));
  const l = s(t, [
    "functionResponse"
  ]);
  l != null && u(e, ["functionResponse"], l);
  const f = s(t, ["inlineData"]);
  f != null && u(e, ["inlineData"], _g(f));
  const c = s(t, ["text"]);
  c != null && u(e, ["text"], c);
  const d = s(t, ["thought"]);
  d != null && u(e, ["thought"], d);
  const p = s(t, [
    "thoughtSignature"
  ]);
  p != null && u(e, ["thoughtSignature"], p);
  const h = s(t, [
    "videoMetadata"
  ]);
  return h != null && u(e, ["videoMetadata"], h), e;
}
function Ng(t) {
  const e = {}, n = s(t, ["handle"]);
  if (n != null && u(e, ["handle"], n), s(t, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return e;
}
function kg(t) {
  const e = {};
  if (s(t, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(t, ["computerUse"]);
  n != null && u(e, ["computerUse"], n);
  const i = s(t, ["fileSearch"]);
  i != null && u(e, ["fileSearch"], i);
  const r = s(t, ["googleSearch"]);
  r != null && u(e, ["googleSearch"], wg(r));
  const o = s(t, ["googleMaps"]);
  o != null && u(e, ["googleMaps"], Ag(o));
  const a = s(t, [
    "codeExecution"
  ]);
  if (a != null && u(e, ["codeExecution"], a), s(t, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(t, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["functionDeclarations"], p);
  }
  const f = s(t, [
    "googleSearchRetrieval"
  ]);
  if (f != null && u(e, ["googleSearchRetrieval"], f), s(t, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(t, ["urlContext"]);
  c != null && u(e, ["urlContext"], c);
  const d = s(t, ["mcpServers"]);
  if (d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => h)), u(e, ["mcpServers"], p);
  }
  return e;
}
function Mg(t) {
  const e = [];
  for (const n in t)
    if (Object.prototype.hasOwnProperty.call(t, n)) {
      const i = t[n];
      if (typeof i == "object" && i != null && Object.keys(i).length > 0) {
        const r = Object.keys(i).map((o) => `${n}.${o}`);
        e.push(...r);
      } else
        e.push(n);
    }
  return e.join(",");
}
function xg(t, e) {
  let n = null;
  const i = t.bidiGenerateContentSetup;
  if (typeof i == "object" && i !== null && "setup" in i) {
    const o = i.setup;
    typeof o == "object" && o !== null ? (t.bidiGenerateContentSetup = o, n = o) : delete t.bidiGenerateContentSetup;
  } else i !== void 0 && delete t.bidiGenerateContentSetup;
  const r = t.fieldMask;
  if (n) {
    const o = Mg(n);
    if (Array.isArray(e?.lockAdditionalFields) && e?.lockAdditionalFields.length === 0)
      o ? t.fieldMask = o : delete t.fieldMask;
    else if (e?.lockAdditionalFields && e.lockAdditionalFields.length > 0 && r !== null && Array.isArray(r) && r.length > 0) {
      const a = [
        "temperature",
        "topK",
        "topP",
        "maxOutputTokens",
        "responseModalities",
        "seed",
        "speechConfig"
      ];
      let l = [];
      r.length > 0 && (l = r.map((c) => a.includes(c) ? `generationConfig.${c}` : c));
      const f = [];
      o && f.push(o), l.length > 0 && f.push(...l), f.length > 0 ? t.fieldMask = f.join(",") : delete t.fieldMask;
    } else
      delete t.fieldMask;
  } else
    r !== null && Array.isArray(r) && r.length > 0 ? t.fieldMask = r.join(",") : delete t.fieldMask;
  return t;
}
class Dg extends He {
  constructor(e) {
    super(), this.apiClient = e;
  }
  /**
   * Creates an ephemeral auth token resource.
   *
   * @experimental
   *
   * @remarks
   * Ephemeral auth tokens is only supported in the Gemini Developer API.
   * It can be used for the session connection to the Live constrained API.
   * Support in v1alpha only.
   *
   * @param params - The parameters for the create request.
   * @return The created auth token.
   *
   * @example
   * ```ts
   * const ai = new GoogleGenAI({
   *     apiKey: token.name,
   *     httpOptions: { apiVersion: 'v1alpha' }  // Support in v1alpha only.
   * });
   *
   * // Case 1: If LiveEphemeralParameters is unset, unlock LiveConnectConfig
   * // when using the token in Live API sessions. Each session connection can
   * // use a different configuration.
   * const config: CreateAuthTokenConfig = {
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 2: If LiveEphemeralParameters is set, lock all fields in
   * // LiveConnectConfig when using the token in Live API sessions. For
   * // example, changing `outputAudioTranscription` in the Live API
   * // connection will be ignored by the API.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     }
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 3: If LiveEphemeralParameters is set and lockAdditionalFields is
   * // set, lock LiveConnectConfig with set and additional fields (e.g.
   * // responseModalities, systemInstruction, temperature in this example) when
   * // using the token in Live API sessions.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     },
   *     lockAdditionalFields: ['temperature'],
   * }
   * const token = await ai.tokens.create(config);
   *
   * // Case 4: If LiveEphemeralParameters is set and lockAdditionalFields is
   * // empty array, lock LiveConnectConfig with set fields (e.g.
   * // responseModalities, systemInstruction in this example) when using the
   * // token in Live API sessions.
   * const config: CreateAuthTokenConfig =
   *     uses: 3,
   *     expireTime: '2025-05-01T00:00:00Z',
   *     LiveEphemeralParameters: {
   *        model: 'gemini-2.0-flash-001',
   *        config: {
   *           'responseModalities': ['AUDIO'],
   *           'systemInstruction': 'Always answer in English.',
   *        }
   *     },
   *     lockAdditionalFields: [],
   * }
   * const token = await ai.tokens.create(config);
   * ```
   */
  async create(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("The client.tokens.create method is only supported by the Gemini Developer API.");
    {
      const l = Tg(this.apiClient, e);
      o = z("auth_tokens", l._url), a = l._query, delete l.config, delete l._url, delete l._query;
      const f = xg(l, e.config);
      return r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(f),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((c) => c.json()), r.then((c) => c);
    }
  }
}
function Ug(t, e) {
  const n = {}, i = s(t, ["force"]);
  return e !== void 0 && i != null && u(e, ["_query", "force"], i), n;
}
function bg(t) {
  const e = {}, n = s(t, ["name"]);
  n != null && u(e, ["_url", "name"], n);
  const i = s(t, ["config"]);
  return i != null && Ug(i, e), e;
}
function Lg(t) {
  const e = {}, n = s(t, ["name"]);
  return n != null && u(e, ["_url", "name"], n), e;
}
function Og(t, e) {
  const n = {}, i = s(t, ["pageSize"]);
  e !== void 0 && i != null && u(e, ["_query", "pageSize"], i);
  const r = s(t, ["pageToken"]);
  return e !== void 0 && r != null && u(e, ["_query", "pageToken"], r), n;
}
function Fg(t) {
  const e = {}, n = s(t, ["parent"]);
  n != null && u(e, ["_url", "parent"], n);
  const i = s(t, ["config"]);
  return i != null && Og(i, e), e;
}
function Gg(t) {
  const e = {}, n = s(t, [
    "sdkHttpResponse"
  ]);
  n != null && u(e, ["sdkHttpResponse"], n);
  const i = s(t, [
    "nextPageToken"
  ]);
  i != null && u(e, ["nextPageToken"], i);
  const r = s(t, ["documents"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(e, ["documents"], o);
  }
  return e;
}
class qg extends He {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n) => new ct(Be.PAGED_ITEM_DOCUMENTS, (i) => this.listInternal({ parent: n.parent, config: i.config }), await this.listInternal(n), n);
  }
  /**
   * Gets a Document.
   *
   * @param params - The parameters for getting a document.
   * @return Document.
   */
  async get(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Lg(e);
      return o = z("{name}", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => f);
    }
  }
  /**
   * Deletes a Document.
   *
   * @param params - The parameters for deleting a document.
   */
  async delete(e) {
    var n, i;
    let r = "", o = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = bg(e);
      r = z("{name}", a._url), o = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: r,
        queryParams: o,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Fg(e);
      return o = z("{parent}/documents", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = Gg(f), d = new cf();
        return Object.assign(d, c), d;
      });
    }
  }
}
class Bg extends He {
  constructor(e, n = new qg(e)) {
    super(), this.apiClient = e, this.documents = n, this.list = async (i = {}) => new ct(Be.PAGED_ITEM_FILE_SEARCH_STORES, (r) => this.listInternal(r), await this.listInternal(i), i);
  }
  /**
   * Uploads a file asynchronously to a given File Search Store.
   * This method is not available in Vertex AI.
   * Supported upload sources:
   * - Node.js: File path (string) or Blob object.
   * - Browser: Blob object (e.g., File).
   *
   * @remarks
   * The `mimeType` can be specified in the `config` parameter. If omitted:
   *  - For file path (string) inputs, the `mimeType` will be inferred from the
   *     file extension.
   *  - For Blob object inputs, the `mimeType` will be set to the Blob's `type`
   *     property.
   *
   * This section can contain multiple paragraphs and code examples.
   *
   * @param params - Optional parameters specified in the
   *        `types.UploadToFileSearchStoreParameters` interface.
   *         @see {@link types.UploadToFileSearchStoreParameters#config} for the optional
   *         config in the parameters.
   * @return A promise that resolves to a long running operation.
   * @throws An error if called on a Vertex AI client.
   * @throws An error if the `mimeType` is not provided and can not be inferred,
   * the `mimeType` can be provided in the `params.config` parameter.
   * @throws An error occurs if a suitable upload location cannot be established.
   *
   * @example
   * The following code uploads a file to a given file search store.
   *
   * ```ts
   * const operation = await ai.fileSearchStores.upload({fileSearchStoreName: 'fileSearchStores/foo-bar', file: 'file.txt', config: {
   *   mimeType: 'text/plain',
   * }});
   * console.log(operation.name);
   * ```
   */
  async uploadToFileSearchStore(e) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files to a file search store.");
    return this.apiClient.uploadFileToFileSearchStore(e.fileSearchStoreName, e.file, e.config);
  }
  /**
   * Creates a File Search Store.
   *
   * @param params - The parameters for creating a File Search Store.
   * @return FileSearchStore.
   */
  async create(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Pm(e);
      return o = z("fileSearchStores", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => f);
    }
  }
  /**
   * Gets a File Search Store.
   *
   * @param params - The parameters for getting a File Search Store.
   * @return FileSearchStore.
   */
  async get(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Mm(e);
      return o = z("{name}", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => f);
    }
  }
  /**
   * Deletes a File Search Store.
   *
   * @param params - The parameters for deleting a File Search Store.
   */
  async delete(e) {
    var n, i;
    let r = "", o = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = km(e);
      r = z("{name}", a._url), o = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: r,
        queryParams: o,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      });
    }
  }
  async listInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Om(e);
      return o = z("fileSearchStores", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = Fm(f), d = new uf();
        return Object.assign(d, c), d;
      });
    }
  }
  async uploadToFileSearchStoreInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Gm(e);
      return o = z("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = qm(f), d = new ff();
        return Object.assign(d, c), d;
      });
    }
  }
  /**
   * Imports a File from File Service to a FileSearchStore.
   *
   * This is a long-running operation, see aip.dev/151
   *
   * @param params - The parameters for importing a file to a file search store.
   * @return ImportFileOperation.
   */
  async importFile(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Um(e);
      return o = z("{file_search_store_name}:importFile", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json()), r.then((f) => {
        const c = Dm(f), d = new Ki();
        return Object.assign(d, c), d;
      });
    }
  }
}
let Dl = function() {
  const { crypto: t } = globalThis;
  if (t?.randomUUID)
    return Dl = t.randomUUID.bind(t), t.randomUUID();
  const e = new Uint8Array(1), n = t ? () => t.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (i) => (+i ^ n() & 15 >> +i / 4).toString(16));
};
const Hg = () => Dl();
function Ui(t) {
  return typeof t == "object" && t !== null && // Spec-compliant fetch implementations
  ("name" in t && t.name === "AbortError" || // Expo fetch
  "message" in t && String(t.message).includes("FetchRequestCanceledException"));
}
const bi = (t) => {
  if (t instanceof Error)
    return t;
  if (typeof t == "object" && t !== null) {
    try {
      if (Object.prototype.toString.call(t) === "[object Error]") {
        const e = new Error(t.message, t.cause ? { cause: t.cause } : {});
        return t.stack && (e.stack = t.stack), t.cause && !e.cause && (e.cause = t.cause), t.name && (e.name = t.name), e;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(t));
    } catch {
    }
  }
  return new Error(t);
};
class Re extends Error {
}
class Te extends Re {
  constructor(e, n, i, r) {
    super(`${Te.makeMessage(e, n, i)}`), this.status = e, this.headers = r, this.error = n;
  }
  static makeMessage(e, n, i) {
    const r = n?.message ? typeof n.message == "string" ? n.message : JSON.stringify(n.message) : n ? JSON.stringify(n) : i;
    return e && r ? `${e} ${r}` : e ? `${e} status code (no body)` : r || "(no status code or body)";
  }
  static generate(e, n, i, r) {
    if (!e || !r)
      return new Gn({ message: i, cause: bi(n) });
    const o = n;
    return e === 400 ? new bl(e, o, i, r) : e === 401 ? new Ll(e, o, i, r) : e === 403 ? new Ol(e, o, i, r) : e === 404 ? new Fl(e, o, i, r) : e === 409 ? new Gl(e, o, i, r) : e === 422 ? new ql(e, o, i, r) : e === 429 ? new Bl(e, o, i, r) : e >= 500 ? new Hl(e, o, i, r) : new Te(e, o, i, r);
  }
}
class Li extends Te {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class Gn extends Te {
  constructor({ message: e, cause: n }) {
    super(void 0, void 0, e || "Connection error.", void 0), n && (this.cause = n);
  }
}
class Ul extends Gn {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class bl extends Te {
}
class Ll extends Te {
}
class Ol extends Te {
}
class Fl extends Te {
}
class Gl extends Te {
}
class ql extends Te {
}
class Bl extends Te {
}
class Hl extends Te {
}
const Vg = /^[a-z][a-z0-9+.-]*:/i, Jg = (t) => Vg.test(t);
let Oi = (t) => (Oi = Array.isArray, Oi(t));
const $g = Oi;
let Wg = $g;
const ga = Wg;
function Kg(t) {
  if (!t)
    return !0;
  for (const e in t)
    return !1;
  return !0;
}
function Yg(t, e) {
  return Object.prototype.hasOwnProperty.call(t, e);
}
const zg = (t, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new Re(`${t} must be an integer`);
  if (e < 0)
    throw new Re(`${t} must be a positive integer`);
  return e;
}, Xg = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return;
  }
};
const Qg = (t) => new Promise((e) => setTimeout(e, t));
function Zg() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new GeminiNextGenAPIClient({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function Vl(...t) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...t);
}
function jg(t) {
  let e = Symbol.asyncIterator in t ? t[Symbol.asyncIterator]() : t[Symbol.iterator]();
  return Vl({
    start() {
    },
    async pull(n) {
      const { done: i, value: r } = await e.next();
      i ? n.close() : n.enqueue(r);
    },
    async cancel() {
      var n;
      await ((n = e.return) === null || n === void 0 ? void 0 : n.call(e));
    }
  });
}
function Jl(t) {
  if (t[Symbol.asyncIterator])
    return t;
  const e = t.getReader();
  return {
    async next() {
      try {
        const n = await e.read();
        return n?.done && e.releaseLock(), n;
      } catch (n) {
        throw e.releaseLock(), n;
      }
    },
    async return() {
      const n = e.cancel();
      return e.releaseLock(), await n, { done: !0, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function ey(t) {
  var e, n;
  if (t === null || typeof t != "object")
    return;
  if (t[Symbol.asyncIterator]) {
    await ((n = (e = t[Symbol.asyncIterator]()).return) === null || n === void 0 ? void 0 : n.call(e));
    return;
  }
  const i = t.getReader(), r = i.cancel();
  i.releaseLock(), await r;
}
const ty = ({ headers: t, body: e }) => ({
  bodyHeaders: {
    "content-type": "application/json"
  },
  body: JSON.stringify(e)
});
const ny = "0.0.1";
const $l = () => {
  var t;
  if (typeof File > "u") {
    const { process: e } = globalThis, n = typeof ((t = e?.versions) === null || t === void 0 ? void 0 : t.node) == "string" && parseInt(e.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (n ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function Ci(t, e, n) {
  return $l(), new File(t, e ?? "unknown_file", n);
}
function iy(t) {
  return (typeof t == "object" && t !== null && ("name" in t && t.name && String(t.name) || "url" in t && t.url && String(t.url) || "filename" in t && t.filename && String(t.filename) || "path" in t && t.path && String(t.path)) || "").split(/[\\/]/).pop() || void 0;
}
const ry = (t) => t != null && typeof t == "object" && typeof t[Symbol.asyncIterator] == "function";
const Wl = (t) => t != null && typeof t == "object" && typeof t.size == "number" && typeof t.type == "string" && typeof t.text == "function" && typeof t.slice == "function" && typeof t.arrayBuffer == "function", oy = (t) => t != null && typeof t == "object" && typeof t.name == "string" && typeof t.lastModified == "number" && Wl(t), sy = (t) => t != null && typeof t == "object" && typeof t.url == "string" && typeof t.blob == "function";
async function ay(t, e, n) {
  if ($l(), t = await t, oy(t))
    return t instanceof File ? t : Ci([await t.arrayBuffer()], t.name);
  if (sy(t)) {
    const r = await t.blob();
    return e || (e = new URL(t.url).pathname.split(/[\\/]/).pop()), Ci(await Fi(r), e, n);
  }
  const i = await Fi(t);
  if (e || (e = iy(t)), !n?.type) {
    const r = i.find((o) => typeof o == "object" && "type" in o && o.type);
    typeof r == "string" && (n = Object.assign(Object.assign({}, n), { type: r }));
  }
  return Ci(i, e, n);
}
async function Fi(t) {
  var e, n, i, r, o;
  let a = [];
  if (typeof t == "string" || ArrayBuffer.isView(t) || // includes Uint8Array, Buffer, etc.
  t instanceof ArrayBuffer)
    a.push(t);
  else if (Wl(t))
    a.push(t instanceof Blob ? t : await t.arrayBuffer());
  else if (ry(t))
    try {
      for (var l = !0, f = De(t), c; c = await f.next(), e = c.done, !e; l = !0) {
        r = c.value, l = !1;
        const d = r;
        a.push(...await Fi(d));
      }
    } catch (d) {
      n = { error: d };
    } finally {
      try {
        !l && !e && (i = f.return) && await i.call(f);
      } finally {
        if (n) throw n.error;
      }
    }
  else {
    const d = (o = t?.constructor) === null || o === void 0 ? void 0 : o.name;
    throw new Error(`Unexpected data type: ${typeof t}${d ? `; constructor: ${d}` : ""}${ly(t)}`);
  }
  return a;
}
function ly(t) {
  return typeof t != "object" || t === null ? "" : `; props: [${Object.getOwnPropertyNames(t).map((n) => `"${n}"`).join(", ")}]`;
}
class Kl {
  constructor(e) {
    this._client = e;
  }
}
Kl._key = [];
function Yl(t) {
  return t.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const ya = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), cy = (t = Yl) => (function(n, ...i) {
  if (n.length === 1)
    return n[0];
  let r = !1;
  const o = [], a = n.reduce((d, p, h) => {
    var m, g, v;
    /[?#]/.test(p) && (r = !0);
    const E = i[h];
    let T = (r ? encodeURIComponent : t)("" + E);
    return h !== i.length && (E == null || typeof E == "object" && // handle values from other realms
    E.toString === ((v = Object.getPrototypeOf((g = Object.getPrototypeOf((m = E.hasOwnProperty) !== null && m !== void 0 ? m : ya)) !== null && g !== void 0 ? g : ya)) === null || v === void 0 ? void 0 : v.toString)) && (T = E + "", o.push({
      start: d.length + p.length,
      length: T.length,
      error: `Value of type ${Object.prototype.toString.call(E).slice(8, -1)} is not a valid path parameter`
    })), d + p + (h === i.length ? "" : T);
  }, ""), l = a.split(/[?#]/, 1)[0], f = /(^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let c;
  for (; (c = f.exec(l)) !== null; ) {
    const d = c[0].startsWith("/"), p = d ? 1 : 0, h = d ? c[0].slice(1) : c[0];
    o.push({
      start: c.index + p,
      length: h.length,
      error: `Value "${h}" can't be safely passed as a path parameter`
    });
  }
  if (o.sort((d, p) => d.start - p.start), o.length > 0) {
    let d = 0;
    const p = o.reduce((h, m) => {
      const g = " ".repeat(m.start - d), v = "^".repeat(m.length);
      return d = m.start + m.length, h + g + v;
    }, "");
    throw new Re(`Path parameters result in path with invalid segments:
${o.map((h) => h.error).join(`
`)}
${a}
${p}`);
  }
  return a;
}), yn = /* @__PURE__ */ cy(Yl);
class zl extends Kl {
  create(e, n) {
    var i;
    const { api_version: r = this._client.apiVersion } = e, o = Pn(e, ["api_version"]);
    if ("model" in o && "agent_config" in o)
      throw new Re("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in o && "generation_config" in o)
      throw new Re("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(yn`/${r}/interactions`, Object.assign(Object.assign({ body: o }, n), { stream: (i = e.stream) !== null && i !== void 0 ? i : !1 }));
  }
  /**
   * Deletes the interaction by id.
   *
   * @example
   * ```ts
   * const interaction = await client.interactions.delete('id', {
   *   api_version: 'api_version',
   * });
   * ```
   */
  delete(e, n = {}, i) {
    const { api_version: r = this._client.apiVersion } = n ?? {};
    return this._client.delete(yn`/${r}/interactions/${e}`, i);
  }
  /**
   * Cancels an interaction by id. This only applies to background interactions that are still running.
   *
   * @example
   * ```ts
   * const interaction = await client.interactions.cancel('id', {
   *   api_version: 'api_version',
   * });
   * ```
   */
  cancel(e, n = {}, i) {
    const { api_version: r = this._client.apiVersion } = n ?? {};
    return this._client.post(yn`/${r}/interactions/${e}/cancel`, i);
  }
  get(e, n = {}, i) {
    var r;
    const o = n ?? {}, { api_version: a = this._client.apiVersion } = o, l = Pn(o, ["api_version"]);
    return this._client.get(yn`/${a}/interactions/${e}`, Object.assign(Object.assign({ query: l }, i), { stream: (r = n?.stream) !== null && r !== void 0 ? r : !1 }));
  }
}
zl._key = Object.freeze(["interactions"]);
class Xl extends zl {
}
function uy(t) {
  let e = 0;
  for (const r of t)
    e += r.length;
  const n = new Uint8Array(e);
  let i = 0;
  for (const r of t)
    n.set(r, i), i += r.length;
  return n;
}
let _n;
function ji(t) {
  let e;
  return (_n ?? (e = new globalThis.TextEncoder(), _n = e.encode.bind(e)))(t);
}
let vn;
function _a(t) {
  let e;
  return (vn ?? (e = new globalThis.TextDecoder(), vn = e.decode.bind(e)))(t);
}
class qn {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null, this.searchIndex = 0;
  }
  decode(e) {
    var n;
    if (e == null)
      return [];
    const i = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? ji(e) : e;
    this.buffer = uy([this.buffer, i]);
    const r = [];
    let o;
    for (; (o = fy(this.buffer, (n = this.carriageReturnIndex) !== null && n !== void 0 ? n : this.searchIndex)) != null; ) {
      if (o.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = o.index;
        continue;
      }
      if (this.carriageReturnIndex != null && (o.index !== this.carriageReturnIndex + 1 || o.carriage)) {
        r.push(_a(this.buffer.subarray(0, this.carriageReturnIndex - 1))), this.buffer = this.buffer.subarray(this.carriageReturnIndex), this.carriageReturnIndex = null, this.searchIndex = 0;
        continue;
      }
      const a = this.carriageReturnIndex !== null ? o.preceding - 1 : o.preceding, l = _a(this.buffer.subarray(0, a));
      r.push(l), this.buffer = this.buffer.subarray(o.index), this.carriageReturnIndex = null, this.searchIndex = 0;
    }
    return this.searchIndex = Math.max(0, this.buffer.length - 1), r;
  }
  flush() {
    return this.buffer.length ? this.decode(`
`) : [];
  }
}
qn.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
qn.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function fy(t, e) {
  const r = e ?? 0, o = t.indexOf(10, r), a = t.indexOf(13, r);
  if (o === -1 && a === -1)
    return null;
  let l;
  return o !== -1 && a !== -1 ? l = Math.min(o, a) : l = o !== -1 ? o : a, t[l] === 10 ? { preceding: l, index: l + 1, carriage: !1 } : { preceding: l, index: l + 1, carriage: !0 };
}
const Nn = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, va = (t, e, n) => {
  if (t) {
    if (Yg(Nn, t))
      return t;
    Ee(n).warn(`${e} was set to ${JSON.stringify(t)}, expected one of ${JSON.stringify(Object.keys(Nn))}`);
  }
};
function rn() {
}
function En(t, e, n) {
  return !e || Nn[t] > Nn[n] ? rn : e[t].bind(e);
}
const dy = {
  error: rn,
  warn: rn,
  info: rn,
  debug: rn
};
let Ea = /* @__PURE__ */ new WeakMap();
function Ee(t) {
  var e;
  const n = t.logger, i = (e = t.logLevel) !== null && e !== void 0 ? e : "off";
  if (!n)
    return dy;
  const r = Ea.get(n);
  if (r && r[0] === i)
    return r[1];
  const o = {
    error: En("error", n, i),
    warn: En("warn", n, i),
    info: En("info", n, i),
    debug: En("debug", n, i)
  };
  return Ea.set(n, [i, o]), o;
}
const rt = (t) => (t.options && (t.options = Object.assign({}, t.options), delete t.options.headers), t.headers && (t.headers = Object.fromEntries((t.headers instanceof Headers ? [...t.headers] : Object.entries(t.headers)).map(([e, n]) => [
  e,
  e.toLowerCase() === "x-goog-api-key" || e.toLowerCase() === "authorization" || e.toLowerCase() === "cookie" || e.toLowerCase() === "set-cookie" ? "***" : n
]))), "retryOfRequestLogID" in t && (t.retryOfRequestLogID && (t.retryOf = t.retryOfRequestLogID), delete t.retryOfRequestLogID), t);
class dt {
  constructor(e, n, i) {
    this.iterator = e, this.controller = n, this.client = i;
  }
  static fromSSEResponse(e, n, i) {
    let r = !1;
    const o = i ? Ee(i) : console;
    function a() {
      return xe(this, arguments, function* () {
        var f, c, d, p;
        if (r)
          throw new Re("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        r = !0;
        let h = !1;
        try {
          try {
            for (var m = !0, g = De(hy(e, n)), v; v = yield j(g.next()), f = v.done, !f; m = !0) {
              p = v.value, m = !1;
              const E = p;
              if (!h)
                if (E.data.startsWith("[DONE]")) {
                  h = !0;
                  continue;
                } else
                  try {
                    yield yield j(JSON.parse(E.data));
                  } catch (T) {
                    throw o.error("Could not parse message into JSON:", E.data), o.error("From chunk:", E.raw), T;
                  }
            }
          } catch (E) {
            c = { error: E };
          } finally {
            try {
              !m && !f && (d = g.return) && (yield j(d.call(g)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (E) {
          if (Ui(E))
            return yield j(void 0);
          throw E;
        } finally {
          h || n.abort();
        }
      });
    }
    return new dt(a, n, i);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(e, n, i) {
    let r = !1;
    function o() {
      return xe(this, arguments, function* () {
        var f, c, d, p;
        const h = new qn(), m = Jl(e);
        try {
          for (var g = !0, v = De(m), E; E = yield j(v.next()), f = E.done, !f; g = !0) {
            p = E.value, g = !1;
            const T = p;
            for (const C of h.decode(T))
              yield yield j(C);
          }
        } catch (T) {
          c = { error: T };
        } finally {
          try {
            !g && !f && (d = v.return) && (yield j(d.call(v)));
          } finally {
            if (c) throw c.error;
          }
        }
        for (const T of h.flush())
          yield yield j(T);
      });
    }
    function a() {
      return xe(this, arguments, function* () {
        var f, c, d, p;
        if (r)
          throw new Re("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        r = !0;
        let h = !1;
        try {
          try {
            for (var m = !0, g = De(o()), v; v = yield j(g.next()), f = v.done, !f; m = !0) {
              p = v.value, m = !1;
              const E = p;
              h || E && (yield yield j(JSON.parse(E)));
            }
          } catch (E) {
            c = { error: E };
          } finally {
            try {
              !m && !f && (d = g.return) && (yield j(d.call(g)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (E) {
          if (Ui(E))
            return yield j(void 0);
          throw E;
        } finally {
          h || n.abort();
        }
      });
    }
    return new dt(a, n, i);
  }
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const e = [], n = [], i = this.iterator(), r = (o) => ({
      next: () => {
        if (o.length === 0) {
          const a = i.next();
          e.push(a), n.push(a);
        }
        return o.shift();
      }
    });
    return [
      new dt(() => r(e), this.controller, this.client),
      new dt(() => r(n), this.controller, this.client)
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const e = this;
    let n;
    return Vl({
      async start() {
        n = e[Symbol.asyncIterator]();
      },
      async pull(i) {
        try {
          const { value: r, done: o } = await n.next();
          if (o)
            return i.close();
          const a = ji(JSON.stringify(r) + `
`);
          i.enqueue(a);
        } catch (r) {
          i.error(r);
        }
      },
      async cancel() {
        var i;
        await ((i = n.return) === null || i === void 0 ? void 0 : i.call(n));
      }
    });
  }
}
function hy(t, e) {
  return xe(this, arguments, function* () {
    var i, r, o, a;
    if (!t.body)
      throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new Re("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new Re("Attempted to iterate over a response with no body");
    const l = new my(), f = new qn(), c = Jl(t.body);
    try {
      for (var d = !0, p = De(py(c)), h; h = yield j(p.next()), i = h.done, !i; d = !0) {
        a = h.value, d = !1;
        const m = a;
        for (const g of f.decode(m)) {
          const v = l.decode(g);
          v && (yield yield j(v));
        }
      }
    } catch (m) {
      r = { error: m };
    } finally {
      try {
        !d && !i && (o = p.return) && (yield j(o.call(p)));
      } finally {
        if (r) throw r.error;
      }
    }
    for (const m of f.flush()) {
      const g = l.decode(m);
      g && (yield yield j(g));
    }
  });
}
function py(t) {
  return xe(this, arguments, function* () {
    var n, i, r, o;
    try {
      for (var a = !0, l = De(t), f; f = yield j(l.next()), n = f.done, !n; a = !0) {
        o = f.value, a = !1;
        const c = o;
        if (c == null)
          continue;
        const d = c instanceof ArrayBuffer ? new Uint8Array(c) : typeof c == "string" ? ji(c) : c;
        yield yield j(d);
      }
    } catch (c) {
      i = { error: c };
    } finally {
      try {
        !a && !n && (r = l.return) && (yield j(r.call(l)));
      } finally {
        if (i) throw i.error;
      }
    }
  });
}
class my {
  constructor() {
    this.event = null, this.data = [], this.chunks = [];
  }
  decode(e) {
    if (e.endsWith("\r") && (e = e.substring(0, e.length - 1)), !e) {
      if (!this.event && !this.data.length)
        return null;
      const o = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks
      };
      return this.event = null, this.data = [], this.chunks = [], o;
    }
    if (this.chunks.push(e), e.startsWith(":"))
      return null;
    let [n, i, r] = gy(e, ":");
    return r.startsWith(" ") && (r = r.substring(1)), n === "event" ? this.event = r : n === "data" && this.data.push(r), null;
  }
}
function gy(t, e) {
  const n = t.indexOf(e);
  return n !== -1 ? [t.substring(0, n), e, t.substring(n + e.length)] : [t, "", ""];
}
async function yy(t, e) {
  const { response: n, requestLogID: i, retryOfRequestLogID: r, startTime: o } = e, a = await (async () => {
    var l;
    if (e.options.stream)
      return Ee(t).debug("response", n.status, n.url, n.headers, n.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(n, e.controller, t) : dt.fromSSEResponse(n, e.controller, t);
    if (n.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return n;
    const f = n.headers.get("content-type"), c = (l = f?.split(";")[0]) === null || l === void 0 ? void 0 : l.trim();
    return c?.includes("application/json") || c?.endsWith("+json") ? n.headers.get("content-length") === "0" ? void 0 : await n.json() : await n.text();
  })();
  return Ee(t).debug(`[${i}] response parsed`, rt({
    retryOfRequestLogID: r,
    url: n.url,
    status: n.status,
    body: a,
    durationMs: Date.now() - o
  })), a;
}
class er extends Promise {
  constructor(e, n, i = yy) {
    super((r) => {
      r(null);
    }), this.responsePromise = n, this.parseResponse = i, this.client = e;
  }
  _thenUnwrap(e) {
    return new er(this.client, this.responsePromise, async (n, i) => e(await this.parseResponse(n, i), i));
  }
  /**
   * Gets the raw `Response` instance instead of parsing the response
   * data.
   *
   * If you want to parse the response body but still get the `Response`
   * instance, you can use {@link withResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  asResponse() {
    return this.responsePromise.then((e) => e.response);
  }
  /**
   * Gets the parsed response data and the raw `Response` instance.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [e, n] = await Promise.all([this.parse(), this.asResponse()]);
    return { data: e, response: n };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((e) => this.parseResponse(this.client, e))), this.parsedPromise;
  }
  then(e, n) {
    return this.parse().then(e, n);
  }
  catch(e) {
    return this.parse().catch(e);
  }
  finally(e) {
    return this.parse().finally(e);
  }
}
const Ql = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* _y(t) {
  if (!t)
    return;
  if (Ql in t) {
    const { values: i, nulls: r } = t;
    yield* i.entries();
    for (const o of r)
      yield [o, null];
    return;
  }
  let e = !1, n;
  t instanceof Headers ? n = t.entries() : ga(t) ? n = t : (e = !0, n = Object.entries(t ?? {}));
  for (let i of n) {
    const r = i[0];
    if (typeof r != "string")
      throw new TypeError("expected header name to be a string");
    const o = ga(i[1]) ? i[1] : [i[1]];
    let a = !1;
    for (const l of o)
      l !== void 0 && (e && !a && (a = !0, yield [r, null]), yield [r, l]);
  }
}
const tn = (t) => {
  const e = new Headers(), n = /* @__PURE__ */ new Set();
  for (const i of t) {
    const r = /* @__PURE__ */ new Set();
    for (const [o, a] of _y(i)) {
      const l = o.toLowerCase();
      r.has(l) || (e.delete(o), r.add(l)), a === null ? (e.delete(o), n.add(l)) : (e.append(o, a), n.delete(l));
    }
  }
  return { [Ql]: !0, values: e, nulls: n };
};
const Ai = (t) => {
  var e, n, i, r, o, a;
  if (typeof globalThis.process < "u")
    return (i = (n = (e = globalThis.process.env) === null || e === void 0 ? void 0 : e[t]) === null || n === void 0 ? void 0 : n.trim()) !== null && i !== void 0 ? i : void 0;
  if (typeof globalThis.Deno < "u")
    return (a = (o = (r = globalThis.Deno.env) === null || r === void 0 ? void 0 : r.get) === null || o === void 0 ? void 0 : o.call(r, t)) === null || a === void 0 ? void 0 : a.trim();
};
var Zl;
class Bn {
  /**
   * API Client for interfacing with the Gemini Next Gen API API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['GEMINI_API_KEY'] ?? null]
   * @param {string | undefined} [opts.apiVersion=v1beta]
   * @param {string} [opts.baseURL=process.env['GEMINI_NEXT_GEN_API_BASE_URL'] ?? https://generativelanguage.googleapis.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=1 minute] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   */
  constructor(e) {
    var n, i, r, o, a, l, f, { baseURL: c = Ai("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: d = (n = Ai("GEMINI_API_KEY")) !== null && n !== void 0 ? n : null, apiVersion: p = "v1beta" } = e, h = Pn(e, ["baseURL", "apiKey", "apiVersion"]);
    const m = Object.assign(Object.assign({
      apiKey: d,
      apiVersion: p
    }, h), { baseURL: c || "https://generativelanguage.googleapis.com" });
    this.baseURL = m.baseURL, this.timeout = (i = m.timeout) !== null && i !== void 0 ? i : Bn.DEFAULT_TIMEOUT, this.logger = (r = m.logger) !== null && r !== void 0 ? r : console;
    const g = "warn";
    this.logLevel = g, this.logLevel = (a = (o = va(m.logLevel, "ClientOptions.logLevel", this)) !== null && o !== void 0 ? o : va(Ai("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : g, this.fetchOptions = m.fetchOptions, this.maxRetries = (l = m.maxRetries) !== null && l !== void 0 ? l : 2, this.fetch = (f = m.fetch) !== null && f !== void 0 ? f : Zg(), this.encoder = ty, this._options = m, this.apiKey = d, this.apiVersion = p, this.clientAdapter = m.clientAdapter;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(e) {
    return new this.constructor(Object.assign(Object.assign(Object.assign({}, this._options), { baseURL: this.baseURL, maxRetries: this.maxRetries, timeout: this.timeout, logger: this.logger, logLevel: this.logLevel, fetch: this.fetch, fetchOptions: this.fetchOptions, apiKey: this.apiKey, apiVersion: this.apiVersion }), e));
  }
  /**
   * Check whether the base URL is set to its default.
   */
  baseURLOverridden() {
    return this.baseURL !== "https://generativelanguage.googleapis.com";
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values: e, nulls: n }) {
    if (!(e.has("authorization") || e.has("x-goog-api-key")) && !(this.apiKey && e.get("x-goog-api-key")) && !n.has("x-goog-api-key"))
      throw new Error('Could not resolve authentication method. Expected the apiKey to be set. Or for the "x-goog-api-key" headers to be explicitly omitted');
  }
  async authHeaders(e) {
    const n = tn([e.headers]);
    if (!(n.values.has("authorization") || n.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return tn([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return tn([await this.clientAdapter.getAuthHeaders()]);
    }
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(e) {
    return Object.entries(e).filter(([n, i]) => typeof i < "u").map(([n, i]) => {
      if (typeof i == "string" || typeof i == "number" || typeof i == "boolean")
        return `${encodeURIComponent(n)}=${encodeURIComponent(i)}`;
      if (i === null)
        return `${encodeURIComponent(n)}=`;
      throw new Re(`Cannot stringify type ${typeof i}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${ny}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${Hg()}`;
  }
  makeStatusError(e, n, i, r) {
    return Te.generate(e, n, i, r);
  }
  buildURL(e, n, i) {
    const r = !this.baseURLOverridden() && i || this.baseURL, o = Jg(e) ? new URL(e) : new URL(r + (r.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), a = this.defaultQuery();
    return Kg(a) || (n = Object.assign(Object.assign({}, a), n)), typeof n == "object" && n && !Array.isArray(n) && (o.search = this.stringifyQuery(n)), o.toString();
  }
  /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
  
     */
  async prepareOptions(e) {
    if (this.clientAdapter && this.clientAdapter.isVertexAI() && !e.path.startsWith(`/${this.apiVersion}/projects/`)) {
      const n = e.path.slice(this.apiVersion.length + 1);
      e.path = `/${this.apiVersion}/projects/${this.clientAdapter.getProject()}/locations/${this.clientAdapter.getLocation()}${n}`;
    }
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(e, { url: n, options: i }) {
  }
  get(e, n) {
    return this.methodRequest("get", e, n);
  }
  post(e, n) {
    return this.methodRequest("post", e, n);
  }
  patch(e, n) {
    return this.methodRequest("patch", e, n);
  }
  put(e, n) {
    return this.methodRequest("put", e, n);
  }
  delete(e, n) {
    return this.methodRequest("delete", e, n);
  }
  methodRequest(e, n, i) {
    return this.request(Promise.resolve(i).then((r) => Object.assign({ method: e, path: n }, r)));
  }
  request(e, n = null) {
    return new er(this, this.makeRequest(e, n, void 0));
  }
  async makeRequest(e, n, i) {
    var r, o, a;
    const l = await e, f = (r = l.maxRetries) !== null && r !== void 0 ? r : this.maxRetries;
    n == null && (n = f), await this.prepareOptions(l);
    const { req: c, url: d, timeout: p } = await this.buildRequest(l, {
      retryCount: f - n
    });
    await this.prepareRequest(c, { url: d, options: l });
    const h = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), m = i === void 0 ? "" : `, retryOf: ${i}`, g = Date.now();
    if (Ee(this).debug(`[${h}] sending request`, rt({
      retryOfRequestLogID: i,
      method: l.method,
      url: d,
      options: l,
      headers: c.headers
    })), !((o = l.signal) === null || o === void 0) && o.aborted)
      throw new Li();
    const v = new AbortController(), E = await this.fetchWithTimeout(d, c, p, v).catch(bi), T = Date.now();
    if (E instanceof globalThis.Error) {
      const w = `retrying, ${n} attempts remaining`;
      if (!((a = l.signal) === null || a === void 0) && a.aborted)
        throw new Li();
      const D = Ui(E) || /timed? ?out/i.test(String(E) + ("cause" in E ? String(E.cause) : ""));
      if (n)
        return Ee(this).info(`[${h}] connection ${D ? "timed out" : "failed"} - ${w}`), Ee(this).debug(`[${h}] connection ${D ? "timed out" : "failed"} (${w})`, rt({
          retryOfRequestLogID: i,
          url: d,
          durationMs: T - g,
          message: E.message
        })), this.retryRequest(l, n, i ?? h);
      throw Ee(this).info(`[${h}] connection ${D ? "timed out" : "failed"} - error; no more retries left`), Ee(this).debug(`[${h}] connection ${D ? "timed out" : "failed"} (error; no more retries left)`, rt({
        retryOfRequestLogID: i,
        url: d,
        durationMs: T - g,
        message: E.message
      })), D ? new Ul() : new Gn({ cause: E });
    }
    const C = `[${h}${m}] ${c.method} ${d} ${E.ok ? "succeeded" : "failed"} with status ${E.status} in ${T - g}ms`;
    if (!E.ok) {
      const w = await this.shouldRetry(E);
      if (n && w) {
        const P = `retrying, ${n} attempts remaining`;
        return await ey(E.body), Ee(this).info(`${C} - ${P}`), Ee(this).debug(`[${h}] response error (${P})`, rt({
          retryOfRequestLogID: i,
          url: E.url,
          status: E.status,
          headers: E.headers,
          durationMs: T - g
        })), this.retryRequest(l, n, i ?? h, E.headers);
      }
      const D = w ? "error; no more retries left" : "error; not retryable";
      Ee(this).info(`${C} - ${D}`);
      const _ = await E.text().catch((P) => bi(P).message), y = Xg(_), S = y ? void 0 : _;
      throw Ee(this).debug(`[${h}] response error (${D})`, rt({
        retryOfRequestLogID: i,
        url: E.url,
        status: E.status,
        headers: E.headers,
        message: S,
        durationMs: Date.now() - g
      })), this.makeStatusError(E.status, y, S, E.headers);
    }
    return Ee(this).info(C), Ee(this).debug(`[${h}] response start`, rt({
      retryOfRequestLogID: i,
      url: E.url,
      status: E.status,
      headers: E.headers,
      durationMs: T - g
    })), { response: E, options: l, controller: v, requestLogID: h, retryOfRequestLogID: i, startTime: g };
  }
  async fetchWithTimeout(e, n, i, r) {
    const o = n || {}, { signal: a, method: l } = o, f = Pn(o, ["signal", "method"]), c = this._makeAbort(r);
    a && a.addEventListener("abort", c, { once: !0 });
    const d = setTimeout(c, i), p = globalThis.ReadableStream && f.body instanceof globalThis.ReadableStream || typeof f.body == "object" && f.body !== null && Symbol.asyncIterator in f.body, h = Object.assign(Object.assign(Object.assign({ signal: r.signal }, p ? { duplex: "half" } : {}), { method: "GET" }), f);
    l && (h.method = l.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, h);
    } finally {
      clearTimeout(d);
    }
  }
  async shouldRetry(e) {
    const n = e.headers.get("x-should-retry");
    return n === "true" ? !0 : n === "false" ? !1 : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  }
  async retryRequest(e, n, i, r) {
    var o;
    let a;
    const l = r?.get("retry-after-ms");
    if (l) {
      const c = parseFloat(l);
      Number.isNaN(c) || (a = c);
    }
    const f = r?.get("retry-after");
    if (f && !a) {
      const c = parseFloat(f);
      Number.isNaN(c) ? a = Date.parse(f) - Date.now() : a = c * 1e3;
    }
    if (!(a && 0 <= a && a < 60 * 1e3)) {
      const c = (o = e.maxRetries) !== null && o !== void 0 ? o : this.maxRetries;
      a = this.calculateDefaultRetryTimeoutMillis(n, c);
    }
    return await Qg(a), this.makeRequest(e, n - 1, i);
  }
  calculateDefaultRetryTimeoutMillis(e, n) {
    const o = n - e, a = Math.min(0.5 * Math.pow(2, o), 8), l = 1 - Math.random() * 0.25;
    return a * l * 1e3;
  }
  async buildRequest(e, { retryCount: n = 0 } = {}) {
    var i, r, o;
    const a = Object.assign({}, e), { method: l, path: f, query: c, defaultBaseURL: d } = a, p = this.buildURL(f, c, d);
    "timeout" in a && zg("timeout", a.timeout), a.timeout = (i = a.timeout) !== null && i !== void 0 ? i : this.timeout;
    const { bodyHeaders: h, body: m } = this.buildBody({ options: a }), g = await this.buildHeaders({ options: e, method: l, bodyHeaders: h, retryCount: n });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: l, headers: g }, a.signal && { signal: a.signal }), globalThis.ReadableStream && m instanceof globalThis.ReadableStream && { duplex: "half" }), m && { body: m }), (r = this.fetchOptions) !== null && r !== void 0 ? r : {}), (o = a.fetchOptions) !== null && o !== void 0 ? o : {}), url: p, timeout: a.timeout };
  }
  async buildHeaders({ options: e, method: n, bodyHeaders: i, retryCount: r }) {
    let o = {};
    this.idempotencyHeader && n !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), o[this.idempotencyHeader] = e.idempotencyKey);
    const a = await this.authHeaders(e);
    let l = tn([
      o,
      { Accept: "application/json", "User-Agent": this.getUserAgent() },
      this._options.defaultHeaders,
      i,
      e.headers,
      a
    ]);
    return this.validateHeaders(l), l.values;
  }
  _makeAbort(e) {
    return () => e.abort();
  }
  buildBody({ options: { body: e, headers: n } }) {
    if (!e)
      return { bodyHeaders: void 0, body: void 0 };
    const i = tn([n]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      i.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: jg(e) } : typeof e == "object" && i.values.get("content-type") === "application/x-www-form-urlencoded" ? {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(e)
      } : this.encoder({ body: e, headers: i })
    );
  }
}
Bn.DEFAULT_TIMEOUT = 6e4;
class _e extends Bn {
  constructor() {
    super(...arguments), this.interactions = new Xl(this);
  }
}
Zl = _e;
_e.GeminiNextGenAPIClient = Zl;
_e.GeminiNextGenAPIClientError = Re;
_e.APIError = Te;
_e.APIConnectionError = Gn;
_e.APIConnectionTimeoutError = Ul;
_e.APIUserAbortError = Li;
_e.NotFoundError = Fl;
_e.ConflictError = Gl;
_e.RateLimitError = Bl;
_e.BadRequestError = bl;
_e.AuthenticationError = Ll;
_e.InternalServerError = Hl;
_e.PermissionDeniedError = Ol;
_e.UnprocessableEntityError = ql;
_e.toFile = ay;
_e.Interactions = Xl;
const Ta = "x-goog-api-key", nn = "https://www.googleapis.com/auth/cloud-platform";
class vy {
  constructor(e) {
    if (e.apiKey !== void 0) {
      this.apiKey = e.apiKey;
      return;
    }
    const n = Ey(e.googleAuthOptions);
    this.googleAuth = new xu.GoogleAuth(n);
  }
  async addAuthHeaders(e, n) {
    if (this.apiKey !== void 0) {
      if (this.apiKey.startsWith("auth_tokens/"))
        throw new Error("Ephemeral tokens are only supported by the live API.");
      this.addKeyHeader(e);
      return;
    }
    return this.addGoogleAuthHeaders(e, n);
  }
  addKeyHeader(e) {
    if (e.get(Ta) === null) {
      if (this.apiKey === void 0)
        throw new Error("Trying to set API key header but apiKey is not set");
      e.append(Ta, this.apiKey);
    }
  }
  async addGoogleAuthHeaders(e, n) {
    if (this.googleAuth === void 0)
      throw new Error("Trying to set google-auth headers but googleAuth is unset");
    const i = await this.googleAuth.getRequestHeaders(n);
    for (const [r, o] of i)
      e.get(r) === null && e.append(r, o);
  }
}
function Ey(t) {
  let e;
  if (t) {
    if (e = t, e.scopes) {
      if (typeof e.scopes == "string" && e.scopes !== nn || Array.isArray(e.scopes) && e.scopes.indexOf(nn) < 0)
        throw new Error(`Invalid auth scopes. Scopes must include: ${nn}`);
    } else return e.scopes = [nn], e;
    return e;
  } else
    return e = {
      scopes: [nn]
    }, e;
}
class Ty {
  async download(e, n) {
    if (e.downloadPath) {
      const i = await Sy(e, n);
      if (i instanceof sn) {
        const r = ac(e.downloadPath);
        dc.fromWeb(i.responseInternal.body).pipe(r), await hc(r);
      } else
        try {
          await fc(e.downloadPath, i, {
            encoding: "base64"
          });
        } catch (r) {
          throw new Error(`Failed to write file to ${e.downloadPath}: ${r}`);
        }
    }
  }
}
async function Sy(t, e) {
  var n, i, r;
  const o = Zi(t.file);
  if (o !== void 0)
    return await e.request({
      path: `files/${o}:download`,
      httpMethod: "GET",
      queryParams: {
        alt: "media"
      },
      httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
      abortSignal: (i = t.config) === null || i === void 0 ? void 0 : i.abortSignal
    });
  if (pl(t.file)) {
    const a = (r = t.file.video) === null || r === void 0 ? void 0 : r.videoBytes;
    if (typeof a == "string")
      return a;
    throw new Error("Failed to download generated video, Uri or videoBytes not found.");
  } else if (ml(t.file)) {
    const a = t.file.videoBytes;
    if (typeof a == "string")
      return a;
    throw new Error("Failed to download video, Uri or videoBytes not found.");
  } else
    throw new Error("Unsupported file type");
}
class Cy {
  create(e, n, i) {
    return new Ay(e, n, i);
  }
}
class Ay {
  constructor(e, n, i) {
    this.url = e, this.headers = n, this.callbacks = i;
  }
  connect() {
    this.ws = new Ou(this.url, { headers: this.headers }), this.ws.onopen = this.callbacks.onopen, this.ws.onerror = this.callbacks.onerror, this.ws.onclose = this.callbacks.onclose, this.ws.onmessage = this.callbacks.onmessage;
  }
  send(e) {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.send(e);
  }
  close() {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.close();
  }
}
function wy(t, e) {
  const n = {}, i = s(t, ["name"]);
  return i != null && u(n, ["_url", "name"], i), n;
}
function Iy(t, e) {
  const n = {}, i = s(t, ["name"]);
  return i != null && u(n, ["_url", "name"], i), n;
}
function Ry(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  return i != null && u(n, ["sdkHttpResponse"], i), n;
}
function Py(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  return i != null && u(n, ["sdkHttpResponse"], i), n;
}
function Ny(t, e, n) {
  const i = {};
  if (s(t, ["validationDataset"]) !== void 0)
    throw new Error("validationDataset parameter is not supported in Gemini API.");
  const r = s(t, [
    "tunedModelDisplayName"
  ]);
  if (e !== void 0 && r != null && u(e, ["displayName"], r), s(t, ["description"]) !== void 0)
    throw new Error("description parameter is not supported in Gemini API.");
  const o = s(t, ["epochCount"]);
  e !== void 0 && o != null && u(e, ["tuningTask", "hyperparameters", "epochCount"], o);
  const a = s(t, [
    "learningRateMultiplier"
  ]);
  if (a != null && u(i, ["tuningTask", "hyperparameters", "learningRateMultiplier"], a), s(t, ["exportLastCheckpointOnly"]) !== void 0)
    throw new Error("exportLastCheckpointOnly parameter is not supported in Gemini API.");
  if (s(t, ["preTunedModelCheckpointId"]) !== void 0)
    throw new Error("preTunedModelCheckpointId parameter is not supported in Gemini API.");
  if (s(t, ["adapterSize"]) !== void 0)
    throw new Error("adapterSize parameter is not supported in Gemini API.");
  if (s(t, ["tuningMode"]) !== void 0)
    throw new Error("tuningMode parameter is not supported in Gemini API.");
  if (s(t, ["customBaseModel"]) !== void 0)
    throw new Error("customBaseModel parameter is not supported in Gemini API.");
  const l = s(t, ["batchSize"]);
  e !== void 0 && l != null && u(e, ["tuningTask", "hyperparameters", "batchSize"], l);
  const f = s(t, ["learningRate"]);
  if (e !== void 0 && f != null && u(e, ["tuningTask", "hyperparameters", "learningRate"], f), s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  if (s(t, ["beta"]) !== void 0)
    throw new Error("beta parameter is not supported in Gemini API.");
  if (s(t, ["baseTeacherModel"]) !== void 0)
    throw new Error("baseTeacherModel parameter is not supported in Gemini API.");
  if (s(t, ["tunedTeacherModelSource"]) !== void 0)
    throw new Error("tunedTeacherModelSource parameter is not supported in Gemini API.");
  if (s(t, ["sftLossWeightMultiplier"]) !== void 0)
    throw new Error("sftLossWeightMultiplier parameter is not supported in Gemini API.");
  if (s(t, ["outputUri"]) !== void 0)
    throw new Error("outputUri parameter is not supported in Gemini API.");
  if (s(t, ["encryptionSpec"]) !== void 0)
    throw new Error("encryptionSpec parameter is not supported in Gemini API.");
  return i;
}
function ky(t, e, n) {
  const i = {};
  let r = s(n, [
    "config",
    "method"
  ]);
  if (r === void 0 && (r = "SUPERVISED_FINE_TUNING"), r === "SUPERVISED_FINE_TUNING") {
    const y = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec"], wi(y));
  } else if (r === "PREFERENCE_TUNING") {
    const y = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && u(e, ["preferenceOptimizationSpec"], wi(y));
  } else if (r === "DISTILLATION") {
    const y = s(t, [
      "validationDataset"
    ]);
    e !== void 0 && y != null && u(e, ["distillationSpec"], wi(y));
  }
  const o = s(t, [
    "tunedModelDisplayName"
  ]);
  e !== void 0 && o != null && u(e, ["tunedModelDisplayName"], o);
  const a = s(t, ["description"]);
  e !== void 0 && a != null && u(e, ["description"], a);
  let l = s(n, [
    "config",
    "method"
  ]);
  if (l === void 0 && (l = "SUPERVISED_FINE_TUNING"), l === "SUPERVISED_FINE_TUNING") {
    const y = s(t, ["epochCount"]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "hyperParameters", "epochCount"], y);
  } else if (l === "PREFERENCE_TUNING") {
    const y = s(t, ["epochCount"]);
    e !== void 0 && y != null && u(e, ["preferenceOptimizationSpec", "hyperParameters", "epochCount"], y);
  } else if (l === "DISTILLATION") {
    const y = s(t, ["epochCount"]);
    e !== void 0 && y != null && u(e, ["distillationSpec", "hyperParameters", "epochCount"], y);
  }
  let f = s(n, [
    "config",
    "method"
  ]);
  if (f === void 0 && (f = "SUPERVISED_FINE_TUNING"), f === "SUPERVISED_FINE_TUNING") {
    const y = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], y);
  } else if (f === "PREFERENCE_TUNING") {
    const y = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && u(e, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], y);
  } else if (f === "DISTILLATION") {
    const y = s(t, [
      "learningRateMultiplier"
    ]);
    e !== void 0 && y != null && u(e, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], y);
  }
  let c = s(n, ["config", "method"]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const y = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "exportLastCheckpointOnly"], y);
  } else if (c === "PREFERENCE_TUNING") {
    const y = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && u(e, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], y);
  } else if (c === "DISTILLATION") {
    const y = s(t, [
      "exportLastCheckpointOnly"
    ]);
    e !== void 0 && y != null && u(e, ["distillationSpec", "exportLastCheckpointOnly"], y);
  }
  let d = s(n, [
    "config",
    "method"
  ]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const y = s(t, ["adapterSize"]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "hyperParameters", "adapterSize"], y);
  } else if (d === "PREFERENCE_TUNING") {
    const y = s(t, ["adapterSize"]);
    e !== void 0 && y != null && u(e, ["preferenceOptimizationSpec", "hyperParameters", "adapterSize"], y);
  } else if (d === "DISTILLATION") {
    const y = s(t, ["adapterSize"]);
    e !== void 0 && y != null && u(e, ["distillationSpec", "hyperParameters", "adapterSize"], y);
  }
  let p = s(n, [
    "config",
    "method"
  ]);
  if (p === void 0 && (p = "SUPERVISED_FINE_TUNING"), p === "SUPERVISED_FINE_TUNING") {
    const y = s(t, ["tuningMode"]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "tuningMode"], y);
  }
  const h = s(t, [
    "customBaseModel"
  ]);
  e !== void 0 && h != null && u(e, ["customBaseModel"], h);
  let m = s(n, [
    "config",
    "method"
  ]);
  if (m === void 0 && (m = "SUPERVISED_FINE_TUNING"), m === "SUPERVISED_FINE_TUNING") {
    const y = s(t, ["batchSize"]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "hyperParameters", "batchSize"], y);
  }
  let g = s(n, [
    "config",
    "method"
  ]);
  if (g === void 0 && (g = "SUPERVISED_FINE_TUNING"), g === "SUPERVISED_FINE_TUNING") {
    const y = s(t, [
      "learningRate"
    ]);
    e !== void 0 && y != null && u(e, ["supervisedTuningSpec", "hyperParameters", "learningRate"], y);
  }
  const v = s(t, ["labels"]);
  e !== void 0 && v != null && u(e, ["labels"], v);
  const E = s(t, ["beta"]);
  e !== void 0 && E != null && u(e, ["preferenceOptimizationSpec", "hyperParameters", "beta"], E);
  const T = s(t, [
    "baseTeacherModel"
  ]);
  e !== void 0 && T != null && u(e, ["distillationSpec", "baseTeacherModel"], T);
  const C = s(t, [
    "tunedTeacherModelSource"
  ]);
  e !== void 0 && C != null && u(e, ["distillationSpec", "tunedTeacherModelSource"], C);
  const w = s(t, [
    "sftLossWeightMultiplier"
  ]);
  e !== void 0 && w != null && u(e, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], w);
  const D = s(t, ["outputUri"]);
  e !== void 0 && D != null && u(e, ["outputUri"], D);
  const _ = s(t, [
    "encryptionSpec"
  ]);
  return e !== void 0 && _ != null && u(e, ["encryptionSpec"], _), i;
}
function My(t, e) {
  const n = {}, i = s(t, ["baseModel"]);
  i != null && u(n, ["baseModel"], i);
  const r = s(t, [
    "preTunedModel"
  ]);
  r != null && u(n, ["preTunedModel"], r);
  const o = s(t, [
    "trainingDataset"
  ]);
  o != null && Hy(o);
  const a = s(t, ["config"]);
  return a != null && Ny(a, n), n;
}
function xy(t, e) {
  const n = {}, i = s(t, ["baseModel"]);
  i != null && u(n, ["baseModel"], i);
  const r = s(t, [
    "preTunedModel"
  ]);
  r != null && u(n, ["preTunedModel"], r);
  const o = s(t, [
    "trainingDataset"
  ]);
  o != null && Vy(o, n, e);
  const a = s(t, ["config"]);
  return a != null && ky(a, n, e), n;
}
function Dy(t, e) {
  const n = {}, i = s(t, ["name"]);
  return i != null && u(n, ["_url", "name"], i), n;
}
function Uy(t, e) {
  const n = {}, i = s(t, ["name"]);
  return i != null && u(n, ["_url", "name"], i), n;
}
function by(t, e, n) {
  const i = {}, r = s(t, ["pageSize"]);
  e !== void 0 && r != null && u(e, ["_query", "pageSize"], r);
  const o = s(t, ["pageToken"]);
  e !== void 0 && o != null && u(e, ["_query", "pageToken"], o);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && u(e, ["_query", "filter"], a), i;
}
function Ly(t, e, n) {
  const i = {}, r = s(t, ["pageSize"]);
  e !== void 0 && r != null && u(e, ["_query", "pageSize"], r);
  const o = s(t, ["pageToken"]);
  e !== void 0 && o != null && u(e, ["_query", "pageToken"], o);
  const a = s(t, ["filter"]);
  return e !== void 0 && a != null && u(e, ["_query", "filter"], a), i;
}
function Oy(t, e) {
  const n = {}, i = s(t, ["config"]);
  return i != null && by(i, n), n;
}
function Fy(t, e) {
  const n = {}, i = s(t, ["config"]);
  return i != null && Ly(i, n), n;
}
function Gy(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "nextPageToken"
  ]);
  r != null && u(n, ["nextPageToken"], r);
  const o = s(t, ["tunedModels"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((l) => jl(l))), u(n, ["tuningJobs"], a);
  }
  return n;
}
function qy(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, [
    "nextPageToken"
  ]);
  r != null && u(n, ["nextPageToken"], r);
  const o = s(t, ["tuningJobs"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((l) => Gi(l))), u(n, ["tuningJobs"], a);
  }
  return n;
}
function By(t, e) {
  const n = {}, i = s(t, ["name"]);
  i != null && u(n, ["model"], i);
  const r = s(t, ["name"]);
  return r != null && u(n, ["endpoint"], r), n;
}
function Hy(t, e) {
  const n = {};
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(t, ["vertexDatasetResource"]) !== void 0)
    throw new Error("vertexDatasetResource parameter is not supported in Gemini API.");
  const i = s(t, ["examples"]);
  if (i != null) {
    let r = i;
    Array.isArray(r) && (r = r.map((o) => o)), u(n, ["examples", "examples"], r);
  }
  return n;
}
function Vy(t, e, n) {
  const i = {};
  let r = s(n, [
    "config",
    "method"
  ]);
  if (r === void 0 && (r = "SUPERVISED_FINE_TUNING"), r === "SUPERVISED_FINE_TUNING") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && u(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (r === "PREFERENCE_TUNING") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && u(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (r === "DISTILLATION") {
    const a = s(t, ["gcsUri"]);
    e !== void 0 && a != null && u(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  let o = s(n, [
    "config",
    "method"
  ]);
  if (o === void 0 && (o = "SUPERVISED_FINE_TUNING"), o === "SUPERVISED_FINE_TUNING") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && u(e, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (o === "PREFERENCE_TUNING") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && u(e, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (o === "DISTILLATION") {
    const a = s(t, [
      "vertexDatasetResource"
    ]);
    e !== void 0 && a != null && u(e, ["distillationSpec", "promptDatasetUri"], a);
  }
  if (s(t, ["examples"]) !== void 0)
    throw new Error("examples parameter is not supported in Vertex AI.");
  return i;
}
function jl(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["name"]);
  r != null && u(n, ["name"], r);
  const o = s(t, ["state"]);
  o != null && u(n, ["state"], hl(o));
  const a = s(t, ["createTime"]);
  a != null && u(n, ["createTime"], a);
  const l = s(t, [
    "tuningTask",
    "startTime"
  ]);
  l != null && u(n, ["startTime"], l);
  const f = s(t, [
    "tuningTask",
    "completeTime"
  ]);
  f != null && u(n, ["endTime"], f);
  const c = s(t, ["updateTime"]);
  c != null && u(n, ["updateTime"], c);
  const d = s(t, ["description"]);
  d != null && u(n, ["description"], d);
  const p = s(t, ["baseModel"]);
  p != null && u(n, ["baseModel"], p);
  const h = s(t, ["_self"]);
  return h != null && u(n, ["tunedModel"], By(h)), n;
}
function Gi(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["name"]);
  r != null && u(n, ["name"], r);
  const o = s(t, ["state"]);
  o != null && u(n, ["state"], hl(o));
  const a = s(t, ["createTime"]);
  a != null && u(n, ["createTime"], a);
  const l = s(t, ["startTime"]);
  l != null && u(n, ["startTime"], l);
  const f = s(t, ["endTime"]);
  f != null && u(n, ["endTime"], f);
  const c = s(t, ["updateTime"]);
  c != null && u(n, ["updateTime"], c);
  const d = s(t, ["error"]);
  d != null && u(n, ["error"], d);
  const p = s(t, ["description"]);
  p != null && u(n, ["description"], p);
  const h = s(t, ["baseModel"]);
  h != null && u(n, ["baseModel"], h);
  const m = s(t, ["tunedModel"]);
  m != null && u(n, ["tunedModel"], m);
  const g = s(t, [
    "preTunedModel"
  ]);
  g != null && u(n, ["preTunedModel"], g);
  const v = s(t, [
    "supervisedTuningSpec"
  ]);
  v != null && u(n, ["supervisedTuningSpec"], v);
  const E = s(t, [
    "preferenceOptimizationSpec"
  ]);
  E != null && u(n, ["preferenceOptimizationSpec"], E);
  const T = s(t, [
    "distillationSpec"
  ]);
  T != null && u(n, ["distillationSpec"], T);
  const C = s(t, [
    "tuningDataStats"
  ]);
  C != null && u(n, ["tuningDataStats"], C);
  const w = s(t, [
    "encryptionSpec"
  ]);
  w != null && u(n, ["encryptionSpec"], w);
  const D = s(t, [
    "partnerModelTuningSpec"
  ]);
  D != null && u(n, ["partnerModelTuningSpec"], D);
  const _ = s(t, [
    "customBaseModel"
  ]);
  _ != null && u(n, ["customBaseModel"], _);
  const y = s(t, [
    "evaluateDatasetRuns"
  ]);
  if (y != null) {
    let $ = y;
    Array.isArray($) && ($ = $.map((X) => X)), u(n, ["evaluateDatasetRuns"], $);
  }
  const S = s(t, ["experiment"]);
  S != null && u(n, ["experiment"], S);
  const R = s(t, [
    "fullFineTuningSpec"
  ]);
  R != null && u(n, ["fullFineTuningSpec"], R);
  const P = s(t, ["labels"]);
  P != null && u(n, ["labels"], P);
  const N = s(t, ["outputUri"]);
  N != null && u(n, ["outputUri"], N);
  const G = s(t, ["pipelineJob"]);
  G != null && u(n, ["pipelineJob"], G);
  const V = s(t, [
    "serviceAccount"
  ]);
  V != null && u(n, ["serviceAccount"], V);
  const q = s(t, [
    "tunedModelDisplayName"
  ]);
  q != null && u(n, ["tunedModelDisplayName"], q);
  const J = s(t, [
    "tuningJobState"
  ]);
  J != null && u(n, ["tuningJobState"], J);
  const W = s(t, [
    "veoTuningSpec"
  ]);
  return W != null && u(n, ["veoTuningSpec"], W), n;
}
function Jy(t, e) {
  const n = {}, i = s(t, [
    "sdkHttpResponse"
  ]);
  i != null && u(n, ["sdkHttpResponse"], i);
  const r = s(t, ["name"]);
  r != null && u(n, ["name"], r);
  const o = s(t, ["metadata"]);
  o != null && u(n, ["metadata"], o);
  const a = s(t, ["done"]);
  a != null && u(n, ["done"], a);
  const l = s(t, ["error"]);
  return l != null && u(n, ["error"], l), n;
}
function wi(t, e) {
  const n = {}, i = s(t, ["gcsUri"]);
  i != null && u(n, ["validationDatasetUri"], i);
  const r = s(t, [
    "vertexDatasetResource"
  ]);
  return r != null && u(n, ["validationDatasetUri"], r), n;
}
class $y extends He {
  constructor(e) {
    super(), this.apiClient = e, this.list = async (n = {}) => new ct(Be.PAGED_ITEM_TUNING_JOBS, (i) => this.listInternal(i), await this.listInternal(n), n), this.get = async (n) => await this.getInternal(n), this.tune = async (n) => {
      var i;
      if (this.apiClient.isVertexAI())
        if (n.baseModel.startsWith("projects/")) {
          const r = {
            tunedModelName: n.baseModel
          };
          !((i = n.config) === null || i === void 0) && i.preTunedModelCheckpointId && (r.checkpointId = n.config.preTunedModelCheckpointId);
          const o = Object.assign(Object.assign({}, n), { preTunedModel: r });
          return o.baseModel = void 0, await this.tuneInternal(o);
        } else {
          const r = Object.assign({}, n);
          return await this.tuneInternal(r);
        }
      else {
        const r = Object.assign({}, n), o = await this.tuneMldevInternal(r);
        let a = "";
        return o.metadata !== void 0 && o.metadata.tunedModel !== void 0 ? a = o.metadata.tunedModel : o.name !== void 0 && o.name.includes("/operations/") && (a = o.name.split("/operations/")[0]), {
          name: a,
          state: Ri.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Uy(e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => Gi(d));
    } else {
      const c = Dy(e);
      return l = z("{name}", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => jl(d));
    }
  }
  async listInternal(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Fy(e);
      return l = z("tuningJobs", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = qy(d), h = new zs();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Oy(e);
      return l = z("tunedModels", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Gy(d), h = new zs();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Cancels a tuning job.
   *
   * @param params - The parameters for the cancel request.
   * @return The empty response returned by the API.
   *
   * @example
   * ```ts
   * await ai.tunings.cancel({name: '...'}); // The server-generated resource name.
   * ```
   */
  async cancel(e) {
    var n, i, r, o;
    let a, l = "", f = {};
    if (this.apiClient.isVertexAI()) {
      const c = Iy(e);
      return l = z("{name}:cancel", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Py(d), h = new Xs();
        return Object.assign(h, p), h;
      });
    } else {
      const c = wy(e);
      return l = z("{name}:cancel", c._url), f = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: f,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (r = e.config) === null || r === void 0 ? void 0 : r.httpOptions,
        abortSignal: (o = e.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((d) => d.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: d.headers
        }, h;
      })), a.then((d) => {
        const p = Ry(d), h = new Xs();
        return Object.assign(h, p), h;
      });
    }
  }
  async tuneInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = xy(e, e);
      return o = z("tuningJobs", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => Gi(f));
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  async tuneMldevInternal(e) {
    var n, i;
    let r, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = My(e);
      return o = z("tunedModels", l._url), a = l._query, delete l._url, delete l._query, r = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (i = e.config) === null || i === void 0 ? void 0 : i.abortSignal
      }).then((f) => f.json().then((c) => {
        const d = c;
        return d.sdkHttpResponse = {
          headers: f.headers
        }, d;
      })), r.then((f) => Jy(f));
    }
  }
}
const ec = 1024 * 1024 * 8, tc = 3, nc = 1e3, ic = 2, $e = "x-goog-upload-status";
async function Wy(t, e, n) {
  var i;
  const r = await rc(t, e, n), o = await r?.json();
  if (((i = r?.headers) === null || i === void 0 ? void 0 : i[$e]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return o.file;
}
async function Ky(t, e, n) {
  var i;
  const r = await rc(t, e, n), o = await r?.json();
  if (((i = r?.headers) === null || i === void 0 ? void 0 : i[$e]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = Wi(o), l = new bn();
  return Object.assign(l, a), l;
}
async function rc(t, e, n) {
  var i, r;
  let o = 0, a = 0, l = new sn(new Response()), f = "upload";
  for (o = t.size; a < o; ) {
    const c = Math.min(ec, o - a), d = t.slice(a, a + c);
    a + c >= o && (f += ", finalize");
    let p = 0, h = nc;
    for (; p < tc && (l = await n.request({
      path: "",
      body: d,
      httpMethod: "POST",
      httpOptions: {
        apiVersion: "",
        baseUrl: e,
        headers: {
          "X-Goog-Upload-Command": f,
          "X-Goog-Upload-Offset": String(a),
          "Content-Length": String(c)
        }
      }
    }), !(!((i = l?.headers) === null || i === void 0) && i[$e])); )
      p++, await oc(h), h = h * ic;
    if (a += c, ((r = l?.headers) === null || r === void 0 ? void 0 : r[$e]) !== "active")
      break;
    if (o <= a)
      throw new Error("All content has been uploaded, but the upload status is not finalized.");
  }
  return l;
}
async function Yy(t) {
  return { size: t.size, type: t.type };
}
function oc(t) {
  return new Promise((e) => setTimeout(e, t));
}
class zy {
  async stat(e) {
    const n = { size: 0, type: void 0 };
    if (typeof e == "string") {
      const i = await ir.stat(e);
      return n.size = i.size, n.type = this.inferMimeType(e), n;
    } else
      return await Yy(e);
  }
  async upload(e, n, i) {
    return typeof e == "string" ? await this.uploadFileFromPath(e, n, i) : Wy(e, n, i);
  }
  async uploadToFileSearchStore(e, n, i) {
    return typeof e == "string" ? await this.uploadFileToFileSearchStoreFromPath(e, n, i) : Ky(e, n, i);
  }
  /**
   * Infers the MIME type of a file based on its extension.
   *
   * @param filePath The path to the file.
   * @returns The MIME type of the file, or undefined if it cannot be inferred.
   */
  inferMimeType(e) {
    const n = e.slice(e.lastIndexOf(".") + 1);
    return {
      aac: "audio/aac",
      abw: "application/x-abiword",
      arc: "application/x-freearc",
      avi: "video/x-msvideo",
      azw: "application/vnd.amazon.ebook",
      bin: "application/octet-stream",
      bmp: "image/bmp",
      bz: "application/x-bzip",
      bz2: "application/x-bzip2",
      csh: "application/x-csh",
      css: "text/css",
      csv: "text/csv",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      eot: "application/vnd.ms-fontobject",
      epub: "application/epub+zip",
      gz: "application/gzip",
      gif: "image/gif",
      htm: "text/html",
      html: "text/html",
      ico: "image/vnd.microsoft.icon",
      ics: "text/calendar",
      jar: "application/java-archive",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      js: "text/javascript",
      json: "application/json",
      jsonld: "application/ld+json",
      kml: "application/vnd.google-earth.kml+xml",
      kmz: "application/vnd.google-earth.kmz+xml",
      mjs: "text/javascript",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      mpeg: "video/mpeg",
      mpkg: "application/vnd.apple.installer+xml",
      odt: "application/vnd.oasis.opendocument.text",
      oga: "audio/ogg",
      ogv: "video/ogg",
      ogx: "application/ogg",
      opus: "audio/opus",
      otf: "font/otf",
      png: "image/png",
      pdf: "application/pdf",
      php: "application/x-httpd-php",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      rar: "application/vnd.rar",
      rtf: "application/rtf",
      sh: "application/x-sh",
      svg: "image/svg+xml",
      swf: "application/x-shockwave-flash",
      tar: "application/x-tar",
      tif: "image/tiff",
      tiff: "image/tiff",
      ts: "video/mp2t",
      ttf: "font/ttf",
      txt: "text/plain",
      vsd: "application/vnd.visio",
      wav: "audio/wav",
      weba: "audio/webm",
      webm: "video/webm",
      webp: "image/webp",
      woff: "font/woff",
      woff2: "font/woff2",
      xhtml: "application/xhtml+xml",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xml: "application/xml",
      xul: "application/vnd.mozilla.xul+xml",
      zip: "application/zip",
      "3gp": "video/3gpp",
      "3g2": "video/3gpp2",
      "7z": "application/x-7z-compressed"
    }[n.toLowerCase()];
  }
  async uploadFileFromPath(e, n, i) {
    var r;
    const o = await this.uploadFileFromPathInternal(e, n, i), a = await o?.json();
    if (((r = o?.headers) === null || r === void 0 ? void 0 : r[$e]) !== "final")
      throw new Error("Failed to upload file: Upload status is not finalized.");
    return a.file;
  }
  async uploadFileToFileSearchStoreFromPath(e, n, i) {
    var r;
    const o = await this.uploadFileFromPathInternal(e, n, i), a = await o?.json();
    if (((r = o?.headers) === null || r === void 0 ? void 0 : r[$e]) !== "final")
      throw new Error("Failed to upload file: Upload status is not finalized.");
    const l = Wi(a), f = new bn();
    return Object.assign(f, l), f;
  }
  async uploadFileFromPathInternal(e, n, i) {
    var r, o;
    let a = 0, l = 0, f = new sn(new Response()), c = "upload", d;
    const p = cc.basename(e);
    try {
      if (d = await ir.open(e, "r"), !d)
        throw new Error("Failed to open file");
      for (a = (await d.stat()).size; l < a; ) {
        const h = Math.min(ec, a - l);
        l + h >= a && (c += ", finalize");
        const m = new Uint8Array(h), { bytesRead: g } = await d.read(m, 0, h, l);
        if (g !== h)
          throw new Error(`Failed to read ${h} bytes from file at offset ${l}. bytes actually read: ${g}`);
        const v = new Blob([m]);
        let E = 0, T = nc;
        for (; E < tc && (f = await i.request({
          path: "",
          body: v,
          httpMethod: "POST",
          httpOptions: {
            apiVersion: "",
            baseUrl: n,
            headers: {
              "X-Goog-Upload-Command": c,
              "X-Goog-Upload-Offset": String(l),
              "Content-Length": String(g),
              "X-Goog-Upload-File-Name": p
            }
          }
        }), !(!((r = f?.headers) === null || r === void 0) && r[$e])); )
          E++, await oc(T), T = T * ic;
        if (l += g, ((o = f?.headers) === null || o === void 0 ? void 0 : o[$e]) !== "active")
          break;
        if (a <= l)
          throw new Error("All content has been uploaded, but the upload status is not finalized.");
      }
      return f;
    } finally {
      d && await d.close();
    }
  }
}
class Xy extends dh {
  /**
   * Registers Google Cloud Storage files for use with the API.
   * This method is only available in Node.js environments.
   */
  async registerFiles(e) {
    if (typeof process > "u" || !process.versions || !process.versions.node)
      throw new Error("registerFiles is only supported in Node.js environments.");
    const i = await e.auth.getRequestHeaders(), r = e.config || {}, o = r.httpOptions || {}, a = Object.assign({}, o.headers || {});
    if (i)
      if (typeof i[Symbol.iterator] == "function")
        for (const [l, f] of i)
          a[l] = f;
      else
        for (const [l, f] of Object.entries(i))
          a[l] = f;
    return this._registerFiles({
      uris: e.uris,
      config: Object.assign(Object.assign({}, r), { httpOptions: Object.assign(Object.assign({}, o), { headers: a }) })
    });
  }
}
const Qy = "gl-node/";
class nv {
  get interactions() {
    var e;
    if (this._interactions !== void 0)
      return this._interactions;
    console.warn("GoogleGenAI.interactions: Interactions usage is experimental and may change in future versions.");
    const n = this.httpOptions;
    n?.extraBody && console.warn("GoogleGenAI.interactions: Client level httpOptions.extraBody is not supported by the interactions client and will be ignored.");
    const i = new _e({
      baseURL: this.apiClient.getBaseUrl(),
      apiKey: this.apiKey,
      apiVersion: this.apiClient.getApiVersion(),
      clientAdapter: this.apiClient,
      defaultHeaders: this.apiClient.getDefaultHeaders(),
      timeout: n?.timeout,
      maxRetries: (e = n?.retryOptions) === null || e === void 0 ? void 0 : e.attempts
    });
    return this._interactions = i.interactions, this._interactions;
  }
  constructor(e) {
    var n, i, r, o, a, l;
    if ((e.project || e.location) && e.apiKey)
      throw new Error("Project/location and API key are mutually exclusive in the client initializer.");
    this.vertexai = (i = (n = e.vertexai) !== null && n !== void 0 ? n : Zy("GOOGLE_GENAI_USE_VERTEXAI")) !== null && i !== void 0 ? i : !1;
    const f = e_(), c = ot("GOOGLE_CLOUD_PROJECT"), d = ot("GOOGLE_CLOUD_LOCATION");
    this.apiKey = (r = e.apiKey) !== null && r !== void 0 ? r : f, this.project = (o = e.project) !== null && o !== void 0 ? o : c, this.location = (a = e.location) !== null && a !== void 0 ? a : d, !this.vertexai && !this.apiKey && console.warn("API key should be set when using the Gemini API."), e.vertexai && (!((l = e.googleAuthOptions) === null || l === void 0) && l.credentials && (console.debug("The user provided Google Cloud credentials will take precedence over the API key from the environment variable."), this.apiKey = void 0), (c || d) && e.apiKey ? (console.debug("The user provided Vertex AI API key will take precedence over the project/location from the environment variables."), this.project = void 0, this.location = void 0) : (e.project || e.location) && f ? (console.debug("The user provided project/location will take precedence over the API key from the environment variables."), this.apiKey = void 0) : (c || d) && f && (console.debug("The project/location from the environment variables will take precedence over the API key from the environment variables."), this.apiKey = void 0), !this.location && !this.apiKey && (this.location = "global"));
    const p = Bu(e.httpOptions, e.vertexai, ot("GOOGLE_VERTEX_BASE_URL"), ot("GOOGLE_GEMINI_BASE_URL"));
    p && (e.httpOptions ? e.httpOptions.baseUrl = p : e.httpOptions = { baseUrl: p }), this.apiVersion = e.apiVersion, this.httpOptions = e.httpOptions;
    const h = new vy({
      apiKey: this.apiKey,
      googleAuthOptions: e.googleAuthOptions
    });
    this.apiClient = new Xm({
      auth: h,
      project: this.project,
      location: this.location,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: this.httpOptions,
      userAgentExtra: Qy + process.version,
      uploader: new zy(),
      downloader: new Ty()
    }), this.models = new mg(this.apiClient), this.live = new cg(this.apiClient, h, new Cy()), this.batches = new _d(this.apiClient), this.chats = new eh(this.models, this.apiClient), this.caches = new Qd(this.apiClient), this.files = new Xy(this.apiClient), this.operations = new gg(this.apiClient), this.authTokens = new Dg(this.apiClient), this.tunings = new $y(this.apiClient), this.fileSearchStores = new Bg(this.apiClient);
  }
}
function ot(t) {
  var e, n, i;
  return (i = (n = (e = process == null ? void 0 : process.env) === null || e === void 0 ? void 0 : e[t]) === null || n === void 0 ? void 0 : n.trim()) !== null && i !== void 0 ? i : void 0;
}
function Zy(t) {
  return jy(ot(t));
}
function jy(t) {
  return t === void 0 ? !1 : t.toLowerCase() === "true";
}
function e_() {
  const t = ot("GOOGLE_API_KEY"), e = ot("GEMINI_API_KEY");
  return t && e && console.warn("Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY."), t || e || void 0;
}
export {
  Fs as ActivityHandling,
  cs as AdapterSize,
  fs as AggregationMetric,
  Ln as ApiError,
  Wo as ApiSpec,
  Jo as AuthType,
  _d as Batches,
  Ko as Behavior,
  os as BlockedReason,
  Qd as Caches,
  Xs as CancelTuningJobResponse,
  th as Chat,
  eh as Chats,
  lf as ComputeTokensResponse,
  Q_ as ContentReferenceImage,
  Y_ as ControlReferenceImage,
  Ts as ControlReferenceType,
  Ys as CountTokensResponse,
  hf as CreateFileResponse,
  Qs as DeleteCachedContentResponse,
  pf as DeleteFileResponse,
  Ks as DeleteModelResponse,
  Ns as DocumentState,
  Yo as DynamicRetrievalConfigMode,
  rf as EditImageResponse,
  Cs as EditMode,
  Js as EmbedContentResponse,
  wn as EmbeddingApiType,
  Os as EndSensitivity,
  gs as Environment,
  q_ as EvaluateDatasetResponse,
  ms as FeatureSelectionPreference,
  Ms as FileSource,
  ks as FileState,
  dh as Files,
  ts as FinishReason,
  zo as FunctionCallingConfigMode,
  P_ as FunctionResponse,
  C_ as FunctionResponseBlob,
  A_ as FunctionResponseFileData,
  w_ as FunctionResponsePart,
  Ho as FunctionResponseScheduling,
  en as GenerateContentResponse,
  O_ as GenerateContentResponsePromptFeedback,
  F_ as GenerateContentResponseUsageMetadata,
  $s as GenerateImagesResponse,
  In as GenerateVideosOperation,
  G_ as GenerateVideosResponse,
  nv as GoogleGenAI,
  jo as HarmBlockMethod,
  es as HarmBlockThreshold,
  Zo as HarmCategory,
  ns as HarmProbability,
  is as HarmSeverity,
  $o as HttpElementLocation,
  sn as HttpResponse,
  vs as ImagePromptLanguage,
  Ki as ImportFileOperation,
  B_ as ImportFileResponse,
  J_ as InlinedEmbedContentResponse,
  H_ as InlinedResponse,
  Ri as JobState,
  Bo as Language,
  js as ListBatchJobsResponse,
  Zs as ListCachedContentsResponse,
  cf as ListDocumentsResponse,
  uf as ListFileSearchStoresResponse,
  df as ListFilesResponse,
  Ws as ListModelsResponse,
  zs as ListTuningJobsResponse,
  cg as Live,
  Z_ as LiveClientToolResponse,
  ft as LiveMusicPlaybackControl,
  yf as LiveMusicServerMessage,
  j_ as LiveSendToolResponseParameters,
  gf as LiveServerMessage,
  K_ as MaskReferenceImage,
  Es as MaskReferenceMode,
  Ds as MediaModality,
  as as MediaResolution,
  An as Modality,
  mg as Models,
  Bs as MusicGenerationMode,
  gg as Operations,
  qo as Outcome,
  Be as PagedItem,
  ct as Pager,
  ds as PairwiseChoice,
  ps as PartMediaResolutionLevel,
  Qo as PersonGeneration,
  Vo as PhishBlockThreshold,
  ys as ProminentPeople,
  W_ as RawReferenceImage,
  sf as RecontextImageResponse,
  mf as RegisterFilesResponse,
  $_ as ReplayResponse,
  Pi as ResourceScope,
  _s as SafetyFilterLevel,
  qs as Scale,
  af as SegmentImageResponse,
  As as SegmentMode,
  fg as Session,
  V_ as SingleEmbedContentResponse,
  Ls as StartSensitivity,
  z_ as StyleReferenceImage,
  X_ as SubjectReferenceImage,
  Ss as SubjectReferenceType,
  Xo as ThinkingLevel,
  Dg as Tokens,
  ss as TrafficType,
  us as TuningJobState,
  Ps as TuningMethod,
  ls as TuningMode,
  hs as TuningTask,
  xs as TurnCompleteReason,
  Gs as TurnCoverage,
  Je as Type,
  bn as UploadToFileSearchStoreOperation,
  ev as UploadToFileSearchStoreResponse,
  ff as UploadToFileSearchStoreResumableResponse,
  of as UpscaleImageResponse,
  rs as UrlRetrievalStatus,
  Us as VadSignalType,
  Rs as VideoCompressionQuality,
  Is as VideoGenerationMaskMode,
  ws as VideoGenerationReferenceType,
  bs as VoiceActivityType,
  I_ as createFunctionResponsePartFromBase64,
  R_ as createFunctionResponsePartFromUri,
  L_ as createModelContent,
  x_ as createPartFromBase64,
  D_ as createPartFromCodeExecutionResult,
  U_ as createPartFromExecutableCode,
  k_ as createPartFromFunctionCall,
  M_ as createPartFromFunctionResponse,
  Hs as createPartFromText,
  N_ as createPartFromUri,
  b_ as createUserContent,
  tv as mcpToTool,
  S_ as setDefaultBaseUrls
};
