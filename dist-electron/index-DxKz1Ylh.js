import Sa from "child_process";
import lt, { createWriteStream as Mc } from "fs";
import eo from "https";
import we from "stream";
import to from "os";
import Un from "events";
import xc from "process";
import ct from "util";
import * as Dc from "path";
import no from "path";
import yt from "crypto";
import Uc from "querystring";
import sn from "buffer";
import * as yo from "fs/promises";
import { writeFile as bc } from "fs/promises";
import { Readable as Lc } from "node:stream";
import { finished as Oc } from "node:stream/promises";
import Ca from "http";
import Fc from "net";
import Gc from "tls";
import qc from "url";
import Bc from "zlib";
var nv = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function Aa(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Rt = { exports: {} }, Kn = {}, Yn, _o;
function Hc() {
  if (_o) return Yn;
  _o = 1;
  function e(t, n) {
    typeof n == "boolean" && (n = { forever: n }), this._originalTimeouts = JSON.parse(JSON.stringify(t)), this._timeouts = t, this._options = n || {}, this._maxRetryTime = n && n.maxRetryTime || 1 / 0, this._fn = null, this._errors = [], this._attempts = 1, this._operationTimeout = null, this._operationTimeoutCb = null, this._timeout = null, this._operationStart = null, this._timer = null, this._options.forever && (this._cachedTimeouts = this._timeouts.slice(0));
  }
  return Yn = e, e.prototype.reset = function() {
    this._attempts = 1, this._timeouts = this._originalTimeouts.slice(0);
  }, e.prototype.stop = function() {
    this._timeout && clearTimeout(this._timeout), this._timer && clearTimeout(this._timer), this._timeouts = [], this._cachedTimeouts = null;
  }, e.prototype.retry = function(t) {
    if (this._timeout && clearTimeout(this._timeout), !t)
      return !1;
    var n = (/* @__PURE__ */ new Date()).getTime();
    if (t && n - this._operationStart >= this._maxRetryTime)
      return this._errors.push(t), this._errors.unshift(new Error("RetryOperation timeout occurred")), !1;
    this._errors.push(t);
    var r = this._timeouts.shift();
    if (r === void 0)
      if (this._cachedTimeouts)
        this._errors.splice(0, this._errors.length - 1), r = this._cachedTimeouts.slice(-1);
      else
        return !1;
    var i = this;
    return this._timer = setTimeout(function() {
      i._attempts++, i._operationTimeoutCb && (i._timeout = setTimeout(function() {
        i._operationTimeoutCb(i._attempts);
      }, i._operationTimeout), i._options.unref && i._timeout.unref()), i._fn(i._attempts);
    }, r), this._options.unref && this._timer.unref(), !0;
  }, e.prototype.attempt = function(t, n) {
    this._fn = t, n && (n.timeout && (this._operationTimeout = n.timeout), n.cb && (this._operationTimeoutCb = n.cb));
    var r = this;
    this._operationTimeoutCb && (this._timeout = setTimeout(function() {
      r._operationTimeoutCb();
    }, r._operationTimeout)), this._operationStart = (/* @__PURE__ */ new Date()).getTime(), this._fn(this._attempts);
  }, e.prototype.try = function(t) {
    console.log("Using RetryOperation.try() is deprecated"), this.attempt(t);
  }, e.prototype.start = function(t) {
    console.log("Using RetryOperation.start() is deprecated"), this.attempt(t);
  }, e.prototype.start = e.prototype.try, e.prototype.errors = function() {
    return this._errors;
  }, e.prototype.attempts = function() {
    return this._attempts;
  }, e.prototype.mainError = function() {
    if (this._errors.length === 0)
      return null;
    for (var t = {}, n = null, r = 0, i = 0; i < this._errors.length; i++) {
      var o = this._errors[i], a = o.message, l = (t[a] || 0) + 1;
      t[a] = l, l >= r && (n = o, r = l);
    }
    return n;
  }, Yn;
}
var vo;
function Vc() {
  return vo || (vo = 1, (function(e) {
    var t = Hc();
    e.operation = function(n) {
      var r = e.timeouts(n);
      return new t(r, {
        forever: n && (n.forever || n.retries === 1 / 0),
        unref: n && n.unref,
        maxRetryTime: n && n.maxRetryTime
      });
    }, e.timeouts = function(n) {
      if (n instanceof Array)
        return [].concat(n);
      var r = {
        retries: 10,
        factor: 2,
        minTimeout: 1 * 1e3,
        maxTimeout: 1 / 0,
        randomize: !1
      };
      for (var i in n)
        r[i] = n[i];
      if (r.minTimeout > r.maxTimeout)
        throw new Error("minTimeout is greater than maxTimeout");
      for (var o = [], a = 0; a < r.retries; a++)
        o.push(this.createTimeout(a, r));
      return n && n.forever && !o.length && o.push(this.createTimeout(a, r)), o.sort(function(l, d) {
        return l - d;
      }), o;
    }, e.createTimeout = function(n, r) {
      var i = r.randomize ? Math.random() + 1 : 1, o = Math.round(i * Math.max(r.minTimeout, 1) * Math.pow(r.factor, n));
      return o = Math.min(o, r.maxTimeout), o;
    }, e.wrap = function(n, r, i) {
      if (r instanceof Array && (i = r, r = null), !i) {
        i = [];
        for (var o in n)
          typeof n[o] == "function" && i.push(o);
      }
      for (var a = 0; a < i.length; a++) {
        var l = i[a], d = n[l];
        n[l] = (function(f) {
          var p = e.operation(r), h = Array.prototype.slice.call(arguments, 1), g = h.pop();
          h.push(function(m) {
            p.retry(m) || (m && (arguments[0] = p.mainError()), g.apply(this, arguments));
          }), p.attempt(function() {
            f.apply(n, h);
          });
        }).bind(n, d), n[l].options = r;
      }
    };
  })(Kn)), Kn;
}
var zn, Eo;
function Jc() {
  return Eo || (Eo = 1, zn = Vc()), zn;
}
var To;
function $c() {
  if (To) return Rt.exports;
  To = 1;
  const e = Jc(), t = [
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
  const r = (a, l, d) => {
    const c = d.retries - (l - 1);
    return a.attemptNumber = l, a.retriesLeft = c, a;
  }, i = (a) => t.includes(a), o = (a, l) => new Promise((d, c) => {
    l = {
      onFailedAttempt: () => {
      },
      retries: 10,
      ...l
    };
    const f = e.operation(l);
    f.attempt(async (p) => {
      try {
        d(await a(p));
      } catch (h) {
        if (!(h instanceof Error)) {
          c(new TypeError(`Non-error was thrown: "${h}". You should only throw errors.`));
          return;
        }
        if (h instanceof n)
          f.stop(), c(h.originalError);
        else if (h instanceof TypeError && !i(h.message))
          f.stop(), c(h);
        else {
          r(h, p, l);
          try {
            await l.onFailedAttempt(h);
          } catch (g) {
            c(g);
            return;
          }
          f.retry(h) || c(f.mainError());
        }
      }
    });
  });
  return Rt.exports = o, Rt.exports.default = o, Rt.exports.AbortError = n, Rt.exports;
}
var wa = $c();
const Wc = /* @__PURE__ */ Aa(wa);
var ze = {}, Xn = {}, Xe = {}, Qe = {}, Qn, So;
function Ia() {
  if (So) return Qn;
  So = 1;
  var e = Object.prototype.hasOwnProperty, t = Object.prototype.toString, n = Object.defineProperty, r = Object.getOwnPropertyDescriptor, i = function(c) {
    return typeof Array.isArray == "function" ? Array.isArray(c) : t.call(c) === "[object Array]";
  }, o = function(c) {
    if (!c || t.call(c) !== "[object Object]")
      return !1;
    var f = e.call(c, "constructor"), p = c.constructor && c.constructor.prototype && e.call(c.constructor.prototype, "isPrototypeOf");
    if (c.constructor && !f && !p)
      return !1;
    var h;
    for (h in c)
      ;
    return typeof h > "u" || e.call(c, h);
  }, a = function(c, f) {
    n && f.name === "__proto__" ? n(c, f.name, {
      enumerable: !0,
      configurable: !0,
      value: f.newValue,
      writable: !0
    }) : c[f.name] = f.newValue;
  }, l = function(c, f) {
    if (f === "__proto__")
      if (e.call(c, f)) {
        if (r)
          return r(c, f).value;
      } else return;
    return c[f];
  };
  return Qn = function d() {
    var c, f, p, h, g, m, v = arguments[0], E = 1, T = arguments.length, C = !1;
    for (typeof v == "boolean" && (C = v, v = arguments[1] || {}, E = 2), (v == null || typeof v != "object" && typeof v != "function") && (v = {}); E < T; ++E)
      if (c = arguments[E], c != null)
        for (f in c)
          p = l(v, f), h = l(c, f), v !== h && (C && h && (o(h) || (g = i(h))) ? (g ? (g = !1, m = p && i(p) ? p : []) : m = p && o(p) ? p : {}, a(v, { name: f, newValue: d(C, m, h) })) : typeof h < "u" && a(v, { name: f, newValue: h }));
    return v;
  }, Qn;
}
var Pt = {};
const Kc = "gaxios", Yc = "7.1.3", zc = "A simple common HTTP client specifically for Google APIs and services.", Xc = "build/cjs/src/index.js", Qc = "build/cjs/src/index.d.ts", Zc = ["build/"], jc = { ".": { import: { types: "./build/esm/src/index.d.ts", default: "./build/esm/src/index.js" }, require: { types: "./build/cjs/src/index.d.ts", default: "./build/cjs/src/index.js" } } }, eu = { lint: "gts check --no-inline-config", test: "c8 mocha build/esm/test", "presystem-test": "npm run compile", "system-test": "mocha build/esm/system-test --timeout 80000", compile: "tsc -b ./tsconfig.json ./tsconfig.cjs.json && node utils/enable-esm.mjs", fix: "gts fix", prepare: "npm run compile", pretest: "npm run compile", webpack: "webpack", "prebrowser-test": "npm run compile", "browser-test": "node build/browser-test/browser-test-runner.js", docs: "jsdoc -c .jsdoc.js", "docs-test": "linkinator docs", "predocs-test": "npm run docs", "samples-test": "cd samples/ && npm link ../ && npm test && cd ../", prelint: "cd samples; npm link ../; npm install", clean: "gts clean" }, tu = { type: "git", directory: "packages/gaxios", url: "https://github.com/googleapis/google-cloud-node-core.git" }, nu = ["google"], ru = { node: ">=18" }, iu = "Google, LLC", ou = "Apache-2.0", su = { "@babel/plugin-proposal-private-methods": "^7.18.6", "@types/cors": "^2.8.6", "@types/express": "^5.0.0", "@types/extend": "^3.0.1", "@types/mocha": "^10.0.10", "@types/multiparty": "4.2.1", "@types/mv": "^2.1.0", "@types/ncp": "^2.0.1", "@types/node": "^22.0.0", "@types/sinon": "^17.0.0", "@types/tmp": "0.2.6", assert: "^2.0.0", browserify: "^17.0.0", c8: "^10.0.0", cors: "^2.8.5", express: "^5.0.0", gts: "^6.0.0", "is-docker": "^3.0.0", jsdoc: "^4.0.0", "jsdoc-fresh": "^5.0.0", "jsdoc-region-tag": "^4.0.0", karma: "^6.0.0", "karma-chrome-launcher": "^3.0.0", "karma-coverage": "^2.0.0", "karma-firefox-launcher": "^2.0.0", "karma-mocha": "^2.0.0", "karma-remap-coverage": "^0.1.5", "karma-sourcemap-loader": "^0.4.0", "karma-webpack": "^5.0.1", linkinator: "^6.1.2", mocha: "^11.1.0", multiparty: "^4.2.1", mv: "^2.1.1", ncp: "^2.0.0", nock: "^14.0.0-beta.13", "null-loader": "^4.0.0", "pack-n-play": "^4.0.0", puppeteer: "^24.0.0", sinon: "^21.0.0", "stream-browserify": "^3.0.0", tmp: "0.2.5", "ts-loader": "^9.5.2", typescript: "^5.8.3", webpack: "^5.35.0", "webpack-cli": "^6.0.1" }, au = { extend: "^3.0.2", "https-proxy-agent": "^7.0.1", "node-fetch": "^3.3.2", rimraf: "^5.0.1" }, lu = "https://github.com/googleapis/google-cloud-node-core/tree/main/packages/gaxios", cu = {
  name: Kc,
  version: Yc,
  description: zc,
  main: Xc,
  types: Qc,
  files: Zc,
  exports: jc,
  scripts: eu,
  repository: tu,
  keywords: nu,
  engines: ru,
  author: iu,
  license: ou,
  devDependencies: su,
  dependencies: au,
  homepage: lu
};
var Zn, Co;
function uu() {
  return Co || (Co = 1, Zn = { pkg: cu }), Zn;
}
var Ao;
function Ra() {
  return Ao || (Ao = 1, (function(e) {
    var t = Pt && Pt.__importDefault || function(d) {
      return d && d.__esModule ? d : { default: d };
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.GaxiosError = e.GAXIOS_ERROR_SYMBOL = void 0, e.defaultErrorRedactor = l;
    const n = t(Ia()), i = t(uu()).default.pkg;
    e.GAXIOS_ERROR_SYMBOL = /* @__PURE__ */ Symbol.for(`${i.name}-gaxios-error`);
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
      [e.GAXIOS_ERROR_SYMBOL] = i.version;
      /**
       * Support `instanceof` operator for `GaxiosError` across builds/duplicated files.
       *
       * @see {@link GAXIOS_ERROR_SYMBOL}
       * @see {@link GaxiosError[GAXIOS_ERROR_SYMBOL]}
       */
      static [Symbol.hasInstance](c) {
        return c && typeof c == "object" && e.GAXIOS_ERROR_SYMBOL in c && c[e.GAXIOS_ERROR_SYMBOL] === i.version ? !0 : Function.prototype[Symbol.hasInstance].call(o, c);
      }
      constructor(c, f, p, h) {
        if (super(c, { cause: h }), this.config = f, this.response = p, this.error = h instanceof Error ? h : void 0, this.config = (0, n.default)(!0, {}, f), this.response && (this.response.config = (0, n.default)(!0, {}, this.response.config)), this.response) {
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
      static extractAPIErrorFromResponse(c, f = "The request failed") {
        let p = f;
        if (typeof c.data == "string" && (p = c.data), c.data && typeof c.data == "object" && "error" in c.data && c.data.error && !c.ok) {
          if (typeof c.data.error == "string")
            return {
              message: c.data.error,
              code: c.status,
              status: c.statusText
            };
          if (typeof c.data.error == "object") {
            p = "message" in c.data.error && typeof c.data.error.message == "string" ? c.data.error.message : p;
            const h = "status" in c.data.error && typeof c.data.error.status == "string" ? c.data.error.status : c.statusText, g = "code" in c.data.error && typeof c.data.error.code == "number" ? c.data.error.code : c.status;
            if ("errors" in c.data.error && Array.isArray(c.data.error.errors)) {
              const m = [];
              for (const v of c.data.error.errors)
                typeof v == "object" && "message" in v && typeof v.message == "string" && m.push(v.message);
              return Object.assign({
                message: m.join(`
`) || p,
                code: g,
                status: h
              }, c.data.error);
            }
            return Object.assign({
              message: p,
              code: g,
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
    e.GaxiosError = o;
    function a(d, c) {
      switch (d) {
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
    function l(d) {
      const c = "<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.";
      function f(g) {
        g && g.forEach((m, v) => {
          (/^authentication$/i.test(v) || /^authorization$/i.test(v) || /secret/i.test(v)) && g.set(v, c);
        });
      }
      function p(g, m) {
        if (typeof g == "object" && g !== null && typeof g[m] == "string") {
          const v = g[m];
          (/grant_type=/i.test(v) || /assertion=/i.test(v) || /secret/i.test(v)) && (g[m] = c);
        }
      }
      function h(g) {
        !g || typeof g != "object" || (g instanceof FormData || g instanceof URLSearchParams || // support `node-fetch` FormData/URLSearchParams
        "forEach" in g && "set" in g ? g.forEach((m, v) => {
          (["grant_type", "assertion"].includes(v) || /secret/.test(v)) && g.set(v, c);
        }) : ("grant_type" in g && (g.grant_type = c), "assertion" in g && (g.assertion = c), "client_secret" in g && (g.client_secret = c)));
      }
      return d.config && (f(d.config.headers), p(d.config, "data"), h(d.config.data), p(d.config, "body"), h(d.config.body), d.config.url.searchParams.has("token") && d.config.url.searchParams.set("token", c), d.config.url.searchParams.has("client_secret") && d.config.url.searchParams.set("client_secret", c)), d.response && (l({ config: d.response.config }), f(d.response.headers), d.response.bodyUsed && (p(d.response, "data"), h(d.response.data))), d;
    }
  })(Pt)), Pt;
}
var mn = {}, wo;
function du() {
  if (wo) return mn;
  wo = 1, Object.defineProperty(mn, "__esModule", { value: !0 }), mn.getRetryConfig = e;
  async function e(i) {
    let o = n(i);
    if (!i || !i.config || !o && !i.config.retry)
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
    if (o.statusCodesToRetry = o.statusCodesToRetry || a, i.config.retryConfig = o, !await (o.shouldRetry || t)(i))
      return { shouldRetry: !1, config: i.config };
    const d = r(o);
    i.config.retryConfig.currentRetryAttempt += 1;
    const c = o.retryBackoff ? o.retryBackoff(i, d) : new Promise((f) => {
      setTimeout(f, d);
    });
    return o.onRetryAttempt && await o.onRetryAttempt(i), await c, { shouldRetry: !0, config: i.config };
  }
  function t(i) {
    const o = n(i);
    if (i.config.signal?.aborted && i.code !== "TimeoutError" || i.code === "AbortError" || !o || o.retry === 0 || !i.response && (o.currentRetryAttempt || 0) >= o.noResponseRetries || !o.httpMethodsToRetry || !o.httpMethodsToRetry.includes(i.config.method?.toUpperCase() || "GET"))
      return !1;
    if (i.response && i.response.status) {
      let a = !1;
      for (const [l, d] of o.statusCodesToRetry) {
        const c = i.response.status;
        if (c >= l && c <= d) {
          a = !0;
          break;
        }
      }
      if (!a)
        return !1;
    }
    return o.currentRetryAttempt = o.currentRetryAttempt || 0, !(o.currentRetryAttempt >= o.retry);
  }
  function n(i) {
    if (i && i.config && i.config.retryConfig)
      return i.config.retryConfig;
  }
  function r(i) {
    const a = (i.currentRetryAttempt ? 0 : i.retryDelay ?? 100) + (Math.pow(i.retryDelayMultiplier, i.currentRetryAttempt) - 1) / 2 * 1e3, l = i.totalTimeout - (Date.now() - i.timeOfFirstRequest);
    return Math.min(a, l, i.maxRetryDelay);
  }
  return mn;
}
var Nt = {}, Io;
function Pa() {
  if (Io) return Nt;
  Io = 1, Object.defineProperty(Nt, "__esModule", { value: !0 }), Nt.GaxiosInterceptorManager = void 0;
  class e extends Set {
  }
  return Nt.GaxiosInterceptorManager = e, Nt;
}
var Ro;
function fu() {
  if (Ro) return Qe;
  Ro = 1;
  var e = Qe && Qe.__importDefault || function(p) {
    return p && p.__esModule ? p : { default: p };
  }, t;
  Object.defineProperty(Qe, "__esModule", { value: !0 }), Qe.Gaxios = void 0;
  const n = e(Ia()), r = eo, i = Ra(), o = du(), a = we, l = Pa(), d = async () => globalThis.crypto?.randomUUID() || (await import("crypto")).randomUUID(), c = 204;
  class f {
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
      const g = h[0], m = h[1];
      let v;
      const E = new Headers();
      return typeof g == "string" ? v = new URL(g) : g instanceof URL ? v = g : g && g.url && (v = new URL(g.url)), g && typeof g == "object" && "headers" in g && t.mergeHeaders(E, g.headers), m && t.mergeHeaders(E, new Headers(m.headers)), typeof g == "object" && !(g instanceof URL) ? this.request({ ...m, ...g, headers: E, url: v }) : this.request({ ...m, headers: E, url: v });
    }
    /**
     * Perform an HTTP request with the given options.
     * @param opts Set of HTTP options that will be used for this HTTP request.
     */
    async request(h = {}) {
      let g = await this.#r(h);
      return g = await this.#t(g), this.#n(this._request(g));
    }
    async _defaultAdapter(h) {
      const g = h.fetchImplementation || this.defaults.fetchImplementation || await t.#l(), m = { ...h };
      delete m.data;
      const v = await g(h.url, m), E = await this.getResponseData(h, v);
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
        let g;
        if (h.adapter ? g = await h.adapter(h, this._defaultAdapter.bind(this)) : g = await this._defaultAdapter(h), !h.validateStatus(g.status)) {
          if (h.responseType === "stream") {
            const v = [];
            for await (const E of g.data)
              v.push(E);
            g.data = v.toString();
          }
          const m = i.GaxiosError.extractAPIErrorFromResponse(g, `Request failed with status code ${g.status}`);
          throw new i.GaxiosError(m?.message, h, g, m);
        }
        return g;
      } catch (g) {
        let m;
        g instanceof i.GaxiosError ? m = g : g instanceof Error ? m = new i.GaxiosError(g.message, h, void 0, g) : m = new i.GaxiosError("Unexpected Gaxios Error", h, void 0, g);
        const { shouldRetry: v, config: E } = await (0, o.getRetryConfig)(m);
        if (v && E)
          return m.config.retryConfig.currentRetryAttempt = E.retryConfig.currentRetryAttempt, h.retryConfig = m.config?.retryConfig, this.#i(h), this._request(h);
        throw h.errorRedactor && h.errorRedactor(m), m;
      }
    }
    async getResponseData(h, g) {
      if (g.status === c)
        return "";
      if (h.maxContentLength && g.headers.has("content-length") && h.maxContentLength < Number.parseInt(g.headers?.get("content-length") || ""))
        throw new i.GaxiosError("Response's `Content-Length` is over the limit.", h, Object.assign(g, { config: h }));
      switch (h.responseType) {
        case "stream":
          return g.body;
        case "json": {
          const m = await g.text();
          try {
            return JSON.parse(m);
          } catch {
            return m;
          }
        }
        case "arraybuffer":
          return g.arrayBuffer();
        case "blob":
          return g.blob();
        case "text":
          return g.text();
        default:
          return this.getResponseDataFromContentType(g);
      }
    }
    #e(h, g = []) {
      const m = new URL(h), v = [...g], E = (process.env.NO_PROXY ?? process.env.no_proxy)?.split(",") || [];
      for (const T of E)
        v.push(T.trim());
      for (const T of v)
        if (T instanceof RegExp) {
          if (T.test(m.toString()))
            return !1;
        } else if (T instanceof URL) {
          if (T.origin === m.origin)
            return !1;
        } else if (T.startsWith("*.") || T.startsWith(".")) {
          const C = T.replace(/^\*\./, ".");
          if (m.hostname.endsWith(C))
            return !1;
        } else if (T === m.origin || T === m.hostname || T === m.href)
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
      let g = Promise.resolve(h);
      for (const m of this.interceptors.request.values())
        m && (g = g.then(m.resolved, m.rejected));
      return g;
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
      let g = Promise.resolve(h);
      for (const m of this.interceptors.response.values())
        m && (g = g.then(m.resolved, m.rejected));
      return g;
    }
    /**
     * Validates the options, merges them with defaults, and prepare request.
     *
     * @param options The original options passed from the client.
     * @returns Prepared options, ready to make a request
     */
    async #r(h) {
      const g = new Headers(this.defaults.headers);
      t.mergeHeaders(g, h.headers);
      const m = (0, n.default)(!0, {}, this.defaults, h);
      if (!m.url)
        throw new Error("URL is required.");
      if (m.baseURL && (m.url = new URL(m.url, m.baseURL)), m.url = new URL(m.url), m.params)
        if (m.paramsSerializer) {
          let T = m.paramsSerializer(m.params);
          T.startsWith("?") && (T = T.slice(1));
          const C = m.url.toString().includes("?") ? "&" : "?";
          m.url = m.url + C + T;
        } else {
          const T = m.url instanceof URL ? m.url : new URL(m.url);
          for (const [C, w] of new URLSearchParams(m.params))
            T.searchParams.append(C, w);
          m.url = T;
        }
      typeof h.maxContentLength == "number" && (m.size = h.maxContentLength), typeof h.maxRedirects == "number" && (m.follow = h.maxRedirects);
      const v = typeof m.data == "string" || m.data instanceof ArrayBuffer || m.data instanceof Blob || // Node 18 does not have a global `File` object
      globalThis.File && m.data instanceof File || m.data instanceof FormData || m.data instanceof a.Readable || m.data instanceof ReadableStream || m.data instanceof String || m.data instanceof URLSearchParams || ArrayBuffer.isView(m.data) || // `Buffer` (Node.js), `DataView`, `TypedArray`
      /**
       * @deprecated `node-fetch` or another third-party's request types
       */
      ["Blob", "File", "FormData"].includes(m.data?.constructor?.name || "");
      if (m.multipart?.length) {
        const T = await d();
        g.set("content-type", `multipart/related; boundary=${T}`), m.body = a.Readable.from(this.getMultipartRequest(m.multipart, T));
      } else v ? m.body = m.data : typeof m.data == "object" ? g.get("Content-Type") === "application/x-www-form-urlencoded" ? m.body = m.paramsSerializer ? m.paramsSerializer(m.data) : new URLSearchParams(m.data) : (g.has("content-type") || g.set("content-type", "application/json"), m.body = JSON.stringify(m.data)) : m.data && (m.body = m.data);
      m.validateStatus = m.validateStatus || this.validateStatus, m.responseType = m.responseType || "unknown", !g.has("accept") && m.responseType === "json" && g.set("accept", "application/json");
      const E = m.proxy || process.env?.HTTPS_PROXY || process.env?.https_proxy || process.env?.HTTP_PROXY || process.env?.http_proxy;
      if (!m.agent) if (E && this.#e(m.url, m.noProxy)) {
        const T = await t.#a();
        this.agentCache.has(E) ? m.agent = this.agentCache.get(E) : (m.agent = new T(E, {
          cert: m.cert,
          key: m.key
        }), this.agentCache.set(E, m.agent));
      } else m.cert && m.key && (this.agentCache.has(m.key) ? m.agent = this.agentCache.get(m.key) : (m.agent = new r.Agent({
        cert: m.cert,
        key: m.key
      }), this.agentCache.set(m.key, m.agent)));
      return typeof m.errorRedactor != "function" && m.errorRedactor !== !1 && (m.errorRedactor = i.defaultErrorRedactor), m.body && !("duplex" in m) && (m.duplex = "half"), this.#i(m), Object.assign(m, {
        headers: g,
        url: m.url instanceof URL ? m.url : new URL(m.url)
      });
    }
    #i(h) {
      if (h.timeout) {
        const g = AbortSignal.timeout(h.timeout);
        h.signal && !h.signal.aborted ? h.signal = AbortSignal.any([h.signal, g]) : h.signal = g;
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
      let g = h.headers.get("Content-Type");
      if (g === null)
        return h.text();
      if (g = g.toLowerCase(), g.includes("application/json")) {
        let m = await h.text();
        try {
          m = JSON.parse(m);
        } catch {
        }
        return m;
      } else return g.match(/^text\//) ? h.text() : h.blob();
    }
    /**
     * Creates an async generator that yields the pieces of a multipart/related request body.
     * This implementation follows the spec: https://www.ietf.org/rfc/rfc2387.txt. However, recursive
     * multipart/related requests are not currently supported.
     *
     * @param {GaxiosMultipartOptions[]} multipartOptions the pieces to turn into a multipart/related body.
     * @param {string} boundary the boundary string to be placed between each part.
     */
    async *getMultipartRequest(h, g) {
      const m = `--${g}--`;
      for (const v of h) {
        const E = v.headers.get("Content-Type") || "application/octet-stream";
        yield `--${g}\r
Content-Type: ${E}\r
\r
`, typeof v.content == "string" ? yield v.content : yield* v.content, yield `\r
`;
      }
      yield m;
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
      return this.#o ||= (await import("./index-CzOT6j3a.js").then((h) => h.i)).HttpsProxyAgent, this.#o;
    }
    static async #l() {
      const h = typeof window < "u" && !!window;
      return this.#s ||= h ? window.fetch : (await import("./index-eX6Zr2f5.js")).default, this.#s;
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
    static mergeHeaders(h, ...g) {
      h = h instanceof Headers ? h : new Headers(h);
      for (const m of g)
        (m instanceof Headers ? m : new Headers(m)).forEach((E, T) => {
          T === "set-cookie" ? h.append(T, E) : h.set(T, E);
        });
      return h;
    }
  }
  return Qe.Gaxios = f, t = f, Qe;
}
var Po;
function ve() {
  return Po || (Po = 1, (function(e) {
    var t = Xe && Xe.__createBinding || (Object.create ? (function(a, l, d, c) {
      c === void 0 && (c = d);
      var f = Object.getOwnPropertyDescriptor(l, d);
      (!f || ("get" in f ? !l.__esModule : f.writable || f.configurable)) && (f = { enumerable: !0, get: function() {
        return l[d];
      } }), Object.defineProperty(a, c, f);
    }) : (function(a, l, d, c) {
      c === void 0 && (c = d), a[c] = l[d];
    })), n = Xe && Xe.__exportStar || function(a, l) {
      for (var d in a) d !== "default" && !Object.prototype.hasOwnProperty.call(l, d) && t(l, a, d);
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.instance = e.Gaxios = e.GaxiosError = void 0, e.request = o;
    const r = fu();
    Object.defineProperty(e, "Gaxios", { enumerable: !0, get: function() {
      return r.Gaxios;
    } });
    var i = Ra();
    Object.defineProperty(e, "GaxiosError", { enumerable: !0, get: function() {
      return i.GaxiosError;
    } }), n(Pa(), e), e.instance = new r.Gaxios();
    async function o(a) {
      return e.instance.request(a);
    }
  })(Xe)), Xe;
}
var ke = {}, kt = { exports: {} }, jn = { exports: {} }, In = { exports: {} }, hu = In.exports, No;
function Na() {
  return No || (No = 1, (function(e) {
    (function(t) {
      var n, r = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i, i = Math.ceil, o = Math.floor, a = "[BigNumber Error] ", l = a + "Number primitive has more than 15 significant digits: ", d = 1e14, c = 14, f = 9007199254740991, p = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13], h = 1e7, g = 1e9;
      function m(y) {
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
        }, Ce = "0123456789abcdefghijklmnopqrstuvwxyz", St = !0;
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
              if (!r.test(U = String(I))) return P(b, U, A);
              b.s = U.charCodeAt(0) == 45 ? (U = U.slice(1), -1) : 1;
            }
            (F = U.indexOf(".")) > -1 && (U = U.replace(".", "")), (H = U.search(/e/i)) > 0 ? (F < 0 && (F = H), F += +U.slice(H + 1), U = U.substring(0, H)) : F < 0 && (F = U.length);
          } else {
            if (C(M, 2, Ce.length, "Base"), M == 10 && St)
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
            if (k -= H, A && K.DEBUG && k > 15 && (I > f || I !== o(I)))
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
        K.clone = m, K.ROUND_UP = 0, K.ROUND_DOWN = 1, K.ROUND_CEIL = 2, K.ROUND_FLOOR = 3, K.ROUND_HALF_UP = 4, K.ROUND_HALF_DOWN = 5, K.ROUND_HALF_EVEN = 6, K.ROUND_HALF_CEIL = 7, K.ROUND_HALF_FLOOR = 8, K.EUCLID = 9, K.config = K.set = function(I) {
          var M, x;
          if (I != null)
            if (typeof I == "object") {
              if (I.hasOwnProperty(M = "DECIMAL_PLACES") && (x = I[M], C(x, 0, g, M), V = x), I.hasOwnProperty(M = "ROUNDING_MODE") && (x = I[M], C(x, 0, 8, M), q = x), I.hasOwnProperty(M = "EXPONENTIAL_AT") && (x = I[M], x && x.pop ? (C(x[0], -g, 0, M), C(x[1], 0, g, M), J = x[0], W = x[1]) : (C(x, -g, g, M), J = -(W = x < 0 ? -x : x))), I.hasOwnProperty(M = "RANGE"))
                if (x = I[M], x && x.pop)
                  C(x[0], -g, -1, M), C(x[1], 1, g, M), $ = x[0], X = x[1];
                else if (C(x, -g, g, M), x)
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
              if (I.hasOwnProperty(M = "MODULO_MODE") && (x = I[M], C(x, 0, 9, M), le = x), I.hasOwnProperty(M = "POW_PRECISION") && (x = I[M], C(x, 0, g, M), pe = x), I.hasOwnProperty(M = "FORMAT"))
                if (x = I[M], typeof x == "object") ce = x;
                else throw Error(a + M + " not an object: " + x);
              if (I.hasOwnProperty(M = "ALPHABET"))
                if (x = I[M], typeof x == "string" && !/^.?$|[+\-.\s]|(.).*\1/.test(x))
                  St = x.slice(0, 10) == "0123456789", Ce = x;
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
            if ((F === 1 || F === -1) && L >= -g && L <= g && L === o(L)) {
              if (B[0] === 0) {
                if (L === 0 && B.length === 1) return !0;
                break e;
              }
              if (M = (L + 1) % c, M < 1 && (M += c), String(B[0]).length == M) {
                for (M = 0; M < B.length; M++)
                  if (x = B[M], x < 0 || x >= d || x !== o(x)) break e;
                if (x !== 0) return !0;
              }
            }
          } else if (B === null && L === null && (F === null || F === 1 || F === -1))
            return !0;
          throw Error(a + "Invalid BigNumber: " + I);
        }, K.maximum = K.max = function() {
          return At(arguments, -1);
        }, K.minimum = K.min = function() {
          return At(arguments, 1);
        }, K.random = (function() {
          var I = 9007199254740992, M = Math.random() * I & 2097151 ? function() {
            return o(Math.random() * I);
          } : function() {
            return (Math.random() * 1073741824 | 0) * 8388608 + (Math.random() * 8388608 | 0);
          };
          return function(x) {
            var B, L, F, H, A, k = 0, U = [], b = new K(G);
            if (x == null ? x = V : C(x, 0, g), H = i(x / c), Z)
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
            var k, U, b, O, Y, Q, ee, se, ue, te, ie, de, be, fe, ne, ae, Ie, ge = B.s == L.s ? 1 : -1, me = B.c, oe = L.c;
            if (!me || !me[0] || !oe || !oe[0])
              return new K(
                // Return NaN if either NaN, or both Infinity or 0.
                !B.s || !L.s || (me ? oe && me[0] == oe[0] : !oe) ? NaN : (
                  // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
                  me && me[0] == 0 || !oe ? ge * 0 : ge / 0
                )
              );
            for (se = new K(ge), ue = se.c = [], U = B.e - L.e, ge = F + U + 1, A || (A = d, U = v(B.e / c) - v(L.e / c), ge = ge / c | 0), b = 0; oe[b] == (me[b] || 0); b++) ;
            if (oe[b] > (me[b] || 0) && U--, ge < 0)
              ue.push(1), O = !0;
            else {
              for (fe = me.length, ae = oe.length, b = 0, ge += 2, Y = o(A / (oe[0] + 1)), Y > 1 && (oe = I(oe, Y, A), me = I(me, Y, A), ae = oe.length, fe = me.length), be = ae, te = me.slice(0, ae), ie = te.length; ie < ae; te[ie++] = 0) ;
              Ie = oe.slice(), Ie = [0].concat(Ie), ne = oe[0], oe[1] >= A / 2 && ne++;
              do {
                if (Y = 0, k = M(oe, te, ae, ie), k < 0) {
                  if (de = te[0], ae != ie && (de = de * A + (te[1] || 0)), Y = o(de / ne), Y > 1)
                    for (Y >= A && (Y = A - 1), Q = I(oe, Y, A), ee = Q.length, ie = te.length; M(Q, te, ee, ie) == 1; )
                      Y--, x(Q, ae < ee ? Ie : oe, ee, A), ee = Q.length, k = 1;
                  else
                    Y == 0 && (k = Y = 1), Q = oe.slice(), ee = Q.length;
                  if (ee < ie && (Q = [0].concat(Q)), x(te, Q, ie, A), ie = te.length, k == -1)
                    for (; M(oe, te, ae, ie) < 1; )
                      Y++, x(te, ae < ie ? Ie : oe, ie, A), ie = te.length;
                } else k === 0 && (Y++, te = [0]);
                ue[b++] = Y, te[0] ? te[ie++] = me[be] || 0 : (te = [me[be]], ie = 1);
              } while ((be++ < fe || te[0] != null) && ge--);
              O = te[0] != null, ue[0] || ue.splice(0, 1);
            }
            if (A == d) {
              for (b = 1, ge = ue[0]; ge >= 10; ge /= 10, b++) ;
              Se(se, F + (se.e = b + U * c - 1) + 1, H, O);
            } else
              se.e = U, se.r = +O;
            return se;
          };
        })();
        function Ct(I, M, x, B) {
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
        function At(I, M) {
          for (var x, B, L = 1, F = new K(I[0]); L < I.length; L++)
            B = new K(I[L]), (!B.s || (x = T(F, B)) === M || x === 0 && F.s === M) && (F = B);
          return F;
        }
        function wt(I, M, x) {
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
              else if (U = i((F + 1) / c), U >= O.length)
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
                    F != A && (I.e++, O[0] == d && (O[0] = 1));
                    break;
                  } else {
                    if (O[U] += A, O[U] != d) break;
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
            return C(I, 0, g), M == null ? M = q : C(M, 0, 8), Se(new K(F), I + F.e + 1, M);
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
            pe && (F = i(pe / c + 2));
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
          for (M = d - 1; B > A; ) {
            if (b[--B] < O[B]) {
              for (x = B; x && !b[--x]; b[x] = M) ;
              --b[x], b[B] += d;
            }
            b[B] -= O[B];
          }
          for (; b[0] == 0; b.splice(0, 1), --U) ;
          return b[0] ? wt(I, b, U) : (I.s = q == 3 ? -1 : 1, I.c = [I.e = 0], I);
        }, N.modulo = N.mod = function(I, M) {
          var x, B, L = this;
          return I = new K(I, M), !L.c || !I.s || I.c && !I.c[0] ? new K(NaN) : !I.c || L.c && !L.c[0] ? new K(L) : (le == 9 ? (B = I.s, I.s = 1, x = S(L, I, 0, 3), I.s = B, x.s *= B) : x = S(L, I, 0, le), I = L.minus(x.times(I)), !I.c[0] && le == 1 && (I.s = L.s), I);
        }, N.multipliedBy = N.times = function(I, M) {
          var x, B, L, F, H, A, k, U, b, O, Y, Q, ee, se, ue, te = this, ie = te.c, de = (I = new K(I, M)).c;
          if (!ie || !de || !ie[0] || !de[0])
            return !te.s || !I.s || ie && !ie[0] && !de || de && !de[0] && !ie ? I.c = I.e = I.s = null : (I.s *= te.s, !ie || !de ? I.c = I.e = null : (I.c = [0], I.e = 0)), I;
          for (B = v(te.e / c) + v(I.e / c), I.s *= te.s, k = ie.length, O = de.length, k < O && (ee = ie, ie = de, de = ee, L = k, k = O, O = L), L = k + O, ee = []; L--; ee.push(0)) ;
          for (se = d, ue = h, L = O; --L >= 0; ) {
            for (x = 0, Y = de[L] % ue, Q = de[L] / ue | 0, H = k, F = L + H; F > L; )
              U = ie[--H] % ue, b = ie[H] / ue | 0, A = Q * U + b * Y, U = Y * U + A % ue * ue + ee[F] + x, x = (U / se | 0) + (A / ue | 0) + Q * b, ee[F--] = U % se;
            ee[F] = x;
          }
          return x ? ++B : ee.splice(0, 1), wt(I, ee, B);
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
            L = (A[--M] = A[M] + k[M] + L) / d | 0, A[M] = d === A[M] ? 0 : A[M] % d;
          return L && (A = [L].concat(A), ++H), wt(I, A, H);
        }, N.precision = N.sd = function(I, M) {
          var x, B, L, F = this;
          if (I != null && I !== !!I)
            return C(I, 1, g), M == null ? M = q : C(M, 0, 8), Se(new K(F), I, M);
          if (!(x = F.c)) return null;
          if (L = x.length - 1, B = L * c + 1, L = x[L]) {
            for (; L % 10 == 0; L /= 10, B--) ;
            for (L = x[0]; L >= 10; L /= 10, B++) ;
          }
          return I && F.e + 1 > B && (B = F.e + 1), B;
        }, N.shiftedBy = function(I) {
          return C(I, -f, f), this.times("1e" + I);
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
          return I != null && (C(I, 0, g), I++), Ct(this, I, M, 1);
        }, N.toFixed = function(I, M) {
          return I != null && (C(I, 0, g), I = I + this.e + 1), Ct(this, I, M);
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
          return I != null && C(I, 1, g), Ct(this, I, M, 2);
        }, N.toString = function(I) {
          var M, x = this, B = x.s, L = x.e;
          return L === null ? B ? (M = "Infinity", B < 0 && (M = "-" + M)) : M = "NaN" : (I == null ? M = L <= J || L >= W ? D(E(x.c), L) : _(E(x.c), L, "0") : I === 10 && St ? (x = Se(new K(x), V + L + 1, q), M = _(E(x.c), x.e, "0")) : (C(I, 2, Ce.length, "Base"), M = R(_(E(x.c), L, "0"), 10, I, B, !0)), B < 0 && x.c[0] && (M = "-" + M)), M;
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
      n = m(), n.default = n.BigNumber = n, e.exports ? e.exports = n : (t || (t = typeof self < "u" && self ? self : window), t.BigNumber = n);
    })(hu);
  })(In)), In.exports;
}
var ko;
function pu() {
  return ko || (ko = 1, (function(e) {
    var t = Na(), n = e.exports;
    (function() {
      var r = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g, i, o, a = {
        // table of character substitutions
        "\b": "\\b",
        "	": "\\t",
        "\n": "\\n",
        "\f": "\\f",
        "\r": "\\r",
        '"': '\\"',
        "\\": "\\\\"
      }, l;
      function d(f) {
        return r.lastIndex = 0, r.test(f) ? '"' + f.replace(r, function(p) {
          var h = a[p];
          return typeof h == "string" ? h : "\\u" + ("0000" + p.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + f + '"';
      }
      function c(f, p) {
        var h, g, m, v, E = i, T, C = p[f], w = C != null && (C instanceof t || t.isBigNumber(C));
        switch (C && typeof C == "object" && typeof C.toJSON == "function" && (C = C.toJSON(f)), typeof l == "function" && (C = l.call(p, f, C)), typeof C) {
          case "string":
            return w ? C : d(C);
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
            if (i += o, T = [], Object.prototype.toString.apply(C) === "[object Array]") {
              for (v = C.length, h = 0; h < v; h += 1)
                T[h] = c(h, C) || "null";
              return m = T.length === 0 ? "[]" : i ? `[
` + i + T.join(`,
` + i) + `
` + E + "]" : "[" + T.join(",") + "]", i = E, m;
            }
            if (l && typeof l == "object")
              for (v = l.length, h = 0; h < v; h += 1)
                typeof l[h] == "string" && (g = l[h], m = c(g, C), m && T.push(d(g) + (i ? ": " : ":") + m));
            else
              Object.keys(C).forEach(function(D) {
                var _ = c(D, C);
                _ && T.push(d(D) + (i ? ": " : ":") + _);
              });
            return m = T.length === 0 ? "{}" : i ? `{
` + i + T.join(`,
` + i) + `
` + E + "}" : "{" + T.join(",") + "}", i = E, m;
        }
      }
      typeof n.stringify != "function" && (n.stringify = function(f, p, h) {
        var g;
        if (i = "", o = "", typeof h == "number")
          for (g = 0; g < h; g += 1)
            o += " ";
        else typeof h == "string" && (o = h);
        if (l = p, p && typeof p != "function" && (typeof p != "object" || typeof p.length != "number"))
          throw new Error("JSON.stringify");
        return c("", { "": f });
      });
    })();
  })(jn)), jn.exports;
}
var er, Mo;
function gu() {
  if (Mo) return er;
  Mo = 1;
  var e = null;
  const t = /(?:_|\\u005[Ff])(?:_|\\u005[Ff])(?:p|\\u0070)(?:r|\\u0072)(?:o|\\u006[Ff])(?:t|\\u0074)(?:o|\\u006[Ff])(?:_|\\u005[Ff])(?:_|\\u005[Ff])/, n = /(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)/;
  var r = function(i) {
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
    if (i != null) {
      if (i.strict === !0 && (o.strict = !0), i.storeAsString === !0 && (o.storeAsString = !0), o.alwaysParseAsBig = i.alwaysParseAsBig === !0 ? i.alwaysParseAsBig : !1, o.useNativeBigInt = i.useNativeBigInt === !0 ? i.useNativeBigInt : !1, typeof i.constructorAction < "u")
        if (i.constructorAction === "error" || i.constructorAction === "ignore" || i.constructorAction === "preserve")
          o.constructorAction = i.constructorAction;
        else
          throw new Error(
            `Incorrect value for constructorAction option, must be "error", "ignore" or undefined but passed ${i.constructorAction}`
          );
      if (typeof i.protoAction < "u")
        if (i.protoAction === "error" || i.protoAction === "ignore" || i.protoAction === "preserve")
          o.protoAction = i.protoAction;
        else
          throw new Error(
            `Incorrect value for protoAction option, must be "error", "ignore" or undefined but passed ${i.protoAction}`
          );
    }
    var a, l, d = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: `
`,
      r: "\r",
      t: "	"
    }, c, f = function(w) {
      throw {
        name: "SyntaxError",
        message: w,
        at: a,
        text: c
      };
    }, p = function(w) {
      return w && w !== l && f("Expected '" + w + "' instead of '" + l + "'"), l = c.charAt(a), a += 1, l;
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
        f("Bad number");
      else
        return e == null && (e = Na()), D.length > 15 ? o.storeAsString ? D : o.useNativeBigInt ? BigInt(D) : new e(D) : o.alwaysParseAsBig ? o.useNativeBigInt ? BigInt(w) : new e(w) : w;
    }, g = function() {
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
            } else if (typeof d[l] == "string")
              _ += d[l];
            else
              break;
            S = a;
          }
        }
      f("Bad string");
    }, m = function() {
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
      f("Unexpected '" + l + "'");
    }, E, T = function() {
      var w = [];
      if (l === "[") {
        if (p("["), m(), l === "]")
          return p("]"), w;
        for (; l; ) {
          if (w.push(E()), m(), l === "]")
            return p("]"), w;
          p(","), m();
        }
      }
      f("Bad array");
    }, C = function() {
      var w, D = /* @__PURE__ */ Object.create(null);
      if (l === "{") {
        if (p("{"), m(), l === "}")
          return p("}"), D;
        for (; l; ) {
          if (w = g(), m(), p(":"), o.strict === !0 && Object.hasOwnProperty.call(D, w) && f('Duplicate key "' + w + '"'), t.test(w) === !0 ? o.protoAction === "error" ? f("Object contains forbidden prototype property") : o.protoAction === "ignore" ? E() : D[w] = E() : n.test(w) === !0 ? o.constructorAction === "error" ? f("Object contains forbidden constructor property") : o.constructorAction === "ignore" ? E() : D[w] = E() : D[w] = E(), m(), l === "}")
            return p("}"), D;
          p(","), m();
        }
      }
      f("Bad object");
    };
    return E = function() {
      switch (m(), l) {
        case "{":
          return C();
        case "[":
          return T();
        case '"':
          return g();
        case "-":
          return h();
        default:
          return l >= "0" && l <= "9" ? h() : v();
      }
    }, function(w, D) {
      var _;
      return c = w + "", a = 0, l = " ", _ = E(), m(), l && f("Syntax error"), typeof D == "function" ? (function y(S, R) {
        var P, N = S[R];
        return N && typeof N == "object" && Object.keys(N).forEach(function(G) {
          P = y(N, G), P !== void 0 ? N[G] = P : delete N[G];
        }), D.call(S, R, N);
      })({ "": _ }, "") : _;
    };
  };
  return er = r, er;
}
var xo;
function mu() {
  if (xo) return kt.exports;
  xo = 1;
  var e = pu().stringify, t = gu();
  return kt.exports = function(n) {
    return {
      parse: t(n),
      stringify: e
    };
  }, kt.exports.parse = t(), kt.exports.stringify = e, kt.exports;
}
var tr = {}, Do;
function Uo() {
  return Do || (Do = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.GCE_LINUX_BIOS_PATHS = void 0, e.isGoogleCloudServerless = i, e.isGoogleComputeEngineLinux = o, e.isGoogleComputeEngineMACAddress = a, e.isGoogleComputeEngine = l, e.detectGCPResidency = d;
    const t = lt, n = to;
    e.GCE_LINUX_BIOS_PATHS = {
      BIOS_DATE: "/sys/class/dmi/id/bios_date",
      BIOS_VENDOR: "/sys/class/dmi/id/bios_vendor"
    };
    const r = /^42:01/;
    function i() {
      return !!(process.env.CLOUD_RUN_JOB || process.env.FUNCTION_NAME || process.env.K_SERVICE);
    }
    function o() {
      if ((0, n.platform)() !== "linux")
        return !1;
      try {
        (0, t.statSync)(e.GCE_LINUX_BIOS_PATHS.BIOS_DATE);
        const c = (0, t.readFileSync)(e.GCE_LINUX_BIOS_PATHS.BIOS_VENDOR, "utf8");
        return /Google/.test(c);
      } catch {
        return !1;
      }
    }
    function a() {
      const c = (0, n.networkInterfaces)();
      for (const f of Object.values(c))
        if (f) {
          for (const { mac: p } of f)
            if (r.test(p))
              return !0;
        }
      return !1;
    }
    function l() {
      return o() || a();
    }
    function d() {
      return i() || l();
    }
  })(tr)), tr;
}
var Ze = {}, Ge = {}, Mt = {}, bo;
function yu() {
  if (bo) return Mt;
  bo = 1, Object.defineProperty(Mt, "__esModule", { value: !0 }), Mt.Colours = void 0;
  class e {
    /**
     * @param stream The stream (e.g. process.stderr)
     * @returns true if the stream should have colourization enabled
     */
    static isEnabled(n) {
      return n && // May happen in browsers.
      n.isTTY && (typeof n.getColorDepth == "function" ? n.getColorDepth() > 2 : !0);
    }
    static refresh() {
      e.enabled = e.isEnabled(process == null ? void 0 : process.stderr), this.enabled ? (e.reset = "\x1B[0m", e.bright = "\x1B[1m", e.dim = "\x1B[2m", e.red = "\x1B[31m", e.green = "\x1B[32m", e.yellow = "\x1B[33m", e.blue = "\x1B[34m", e.magenta = "\x1B[35m", e.cyan = "\x1B[36m", e.white = "\x1B[37m", e.grey = "\x1B[90m") : (e.reset = "", e.bright = "", e.dim = "", e.red = "", e.green = "", e.yellow = "", e.blue = "", e.magenta = "", e.cyan = "", e.white = "", e.grey = "");
    }
  }
  return Mt.Colours = e, e.enabled = !1, e.reset = "", e.bright = "", e.dim = "", e.red = "", e.green = "", e.yellow = "", e.blue = "", e.magenta = "", e.cyan = "", e.white = "", e.grey = "", e.refresh(), Mt;
}
var Lo;
function _u() {
  return Lo || (Lo = 1, (function(e) {
    var t = Ge && Ge.__createBinding || (Object.create ? (function(_, y, S, R) {
      R === void 0 && (R = S);
      var P = Object.getOwnPropertyDescriptor(y, S);
      (!P || ("get" in P ? !y.__esModule : P.writable || P.configurable)) && (P = { enumerable: !0, get: function() {
        return y[S];
      } }), Object.defineProperty(_, R, P);
    }) : (function(_, y, S, R) {
      R === void 0 && (R = S), _[R] = y[S];
    })), n = Ge && Ge.__setModuleDefault || (Object.create ? (function(_, y) {
      Object.defineProperty(_, "default", { enumerable: !0, value: y });
    }) : function(_, y) {
      _.default = y;
    }), r = Ge && Ge.__importStar || /* @__PURE__ */ (function() {
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
          for (var R = _(y), P = 0; P < R.length; P++) R[P] !== "default" && t(S, y, R[P]);
        return n(S, y), S;
      };
    })();
    Object.defineProperty(e, "__esModule", { value: !0 }), e.env = e.DebugLogBackendBase = e.placeholder = e.AdhocDebugLogger = e.LogSeverity = void 0, e.getNodeBackend = h, e.getDebugBackend = m, e.getStructuredBackend = E, e.setBackend = w, e.log = D;
    const i = Un, o = r(xc), a = r(ct), l = yu();
    var d;
    (function(_) {
      _.DEFAULT = "DEFAULT", _.DEBUG = "DEBUG", _.INFO = "INFO", _.WARNING = "WARNING", _.ERROR = "ERROR";
    })(d || (e.LogSeverity = d = {}));
    class c extends i.EventEmitter {
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
        }), this.func.debug = (...R) => this.invokeSeverity(d.DEBUG, ...R), this.func.info = (...R) => this.invokeSeverity(d.INFO, ...R), this.func.warn = (...R) => this.invokeSeverity(d.WARNING, ...R), this.func.error = (...R) => this.invokeSeverity(d.ERROR, ...R), this.func.sublog = (R) => D(R, this.func);
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
    e.AdhocDebugLogger = c, e.placeholder = new c("", () => {
    }).func;
    class f {
      constructor() {
        var y;
        this.cached = /* @__PURE__ */ new Map(), this.filters = [], this.filtersSet = !1;
        let S = (y = o.env[e.env.nodeEnables]) !== null && y !== void 0 ? y : "*";
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
    e.DebugLogBackendBase = f;
    class p extends f {
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
            case d.ERROR:
              V = `${l.Colours.red}${S.severity}${l.Colours.reset}`;
              break;
            case d.INFO:
              V = `${l.Colours.magenta}${S.severity}${l.Colours.reset}`;
              break;
            case d.WARNING:
              V = `${l.Colours.yellow}${S.severity}${l.Colours.reset}`;
              break;
            default:
              V = (P = S.severity) !== null && P !== void 0 ? P : d.DEFAULT;
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
    class g extends f {
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
    function m(_) {
      return new g(_);
    }
    class v extends f {
      constructor(y) {
        var S;
        super(), this.upstream = (S = y) !== null && S !== void 0 ? S : void 0;
      }
      makeLogger(y) {
        var S;
        const R = (S = this.upstream) === null || S === void 0 ? void 0 : S.makeLogger(y);
        return (P, ...N) => {
          var G;
          const V = (G = P.severity) !== null && G !== void 0 ? G : d.INFO, q = Object.assign({
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
    e.env = {
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
      if (!C && !o.env[e.env.nodeEnables] || !_)
        return e.placeholder;
      y && (_ = `${y.instance.namespace}:${_}`);
      const S = T.get(_);
      if (S)
        return S.func;
      if (C === null)
        return e.placeholder;
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
  })(Ge)), Ge;
}
var Oo;
function ka() {
  return Oo || (Oo = 1, (function(e) {
    var t = Ze && Ze.__createBinding || (Object.create ? (function(r, i, o, a) {
      a === void 0 && (a = o);
      var l = Object.getOwnPropertyDescriptor(i, o);
      (!l || ("get" in l ? !i.__esModule : l.writable || l.configurable)) && (l = { enumerable: !0, get: function() {
        return i[o];
      } }), Object.defineProperty(r, a, l);
    }) : (function(r, i, o, a) {
      a === void 0 && (a = o), r[a] = i[o];
    })), n = Ze && Ze.__exportStar || function(r, i) {
      for (var o in r) o !== "default" && !Object.prototype.hasOwnProperty.call(i, o) && t(i, r, o);
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), n(_u(), e);
  })(Ze)), Ze;
}
var Fo;
function bn() {
  return Fo || (Fo = 1, (function(e) {
    var t = ke && ke.__createBinding || (Object.create ? (function(P, N, G, V) {
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
    }), r = ke && ke.__importStar || /* @__PURE__ */ (function() {
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
          for (var V = P(N), q = 0; q < V.length; q++) V[q] !== "default" && t(G, N, V[q]);
        return n(G, N), G;
      };
    })(), i = ke && ke.__exportStar || function(P, N) {
      for (var G in P) G !== "default" && !Object.prototype.hasOwnProperty.call(N, G) && t(N, P, G);
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.gcpResidencyCache = e.METADATA_SERVER_DETECTION = e.HEADERS = e.HEADER_VALUE = e.HEADER_NAME = e.SECONDARY_HOST_ADDRESS = e.HOST_ADDRESS = e.BASE_PATH = void 0, e.instance = m, e.project = v, e.universe = E, e.bulk = T, e.isAvailable = D, e.resetIsAvailableCache = _, e.getGCPResidency = y, e.setGCPResidency = S, e.requestTimeout = R;
    const o = ve(), a = mu(), l = Uo(), d = r(ka());
    e.BASE_PATH = "/computeMetadata/v1", e.HOST_ADDRESS = "http://169.254.169.254", e.SECONDARY_HOST_ADDRESS = "http://metadata.google.internal.", e.HEADER_NAME = "Metadata-Flavor", e.HEADER_VALUE = "Google", e.HEADERS = Object.freeze({ [e.HEADER_NAME]: e.HEADER_VALUE });
    const c = d.log("gcp-metadata");
    e.METADATA_SERVER_DETECTION = Object.freeze({
      "assume-present": "don't try to ping the metadata server, but assume it's present",
      none: "don't try to ping the metadata server, but don't try to use it either",
      "bios-only": "treat the result of a BIOS probe as canonical (don't fall back to pinging)",
      "ping-only": "skip the BIOS probe, and go straight to pinging"
    });
    function f(P) {
      return P || (P = process.env.GCE_METADATA_IP || process.env.GCE_METADATA_HOST || e.HOST_ADDRESS), /^https?:\/\//.test(P) || (P = `http://${P}`), new URL(e.BASE_PATH, P).href;
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
      const q = new Headers(e.HEADERS);
      let J = "", W = {};
      if (typeof P == "object") {
        const pe = P;
        new Headers(pe.headers).forEach((ce, Ce) => q.set(Ce, ce)), J = pe.metadataKey, W = pe.params || W, G = pe.noResponseRetries || G, V = pe.fastFail || V;
      } else
        J = P;
      typeof N == "string" ? J += `/${N}` : (p(N), N.property && (J += `/${N.property}`), new Headers(N.headers).forEach((pe, ce) => q.set(ce, pe)), W = N.params || W);
      const $ = V ? g : o.request, X = {
        url: `${f()}/${J}`,
        headers: q,
        retryConfig: { noResponseRetries: G },
        params: W,
        responseType: "text",
        timeout: R()
      };
      c.info("instance request %j", X);
      const Z = await $(X);
      c.info("instance metadata is %s", Z.data);
      const le = Z.headers.get(e.HEADER_NAME);
      if (le !== e.HEADER_VALUE)
        throw new RangeError(`Invalid response from metadata service: incorrect ${e.HEADER_NAME} header. Expected '${e.HEADER_VALUE}', got ${le ? `'${le}'` : "no header"}`);
      if (typeof Z.data == "string")
        try {
          return a.parse(Z.data);
        } catch {
        }
      return Z.data;
    }
    async function g(P) {
      const N = {
        ...P,
        url: P.url?.toString().replace(f(), f(e.SECONDARY_HOST_ADDRESS))
      }, G = (0, o.request)(P), V = (0, o.request)(N);
      return Promise.any([G, V]);
    }
    function m(P) {
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
        if (!(P in e.METADATA_SERVER_DETECTION))
          throw new RangeError(`Unknown \`METADATA_SERVER_DETECTION\` env variable. Got \`${P}\`, but it should be \`${Object.keys(e.METADATA_SERVER_DETECTION).join("`, `")}\`, or unset`);
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
    e.gcpResidencyCache = null;
    function y() {
      return e.gcpResidencyCache === null && S(), e.gcpResidencyCache;
    }
    function S(P = null) {
      e.gcpResidencyCache = P !== null ? P : (0, l.detectGCPResidency)();
    }
    function R() {
      return y() ? 0 : 3e3;
    }
    i(Uo(), e);
  })(ke)), ke;
}
var je = {}, xt = {}, Dt = {}, Go;
function vu() {
  if (Go) return Dt;
  Go = 1, Dt.byteLength = l, Dt.toByteArray = c, Dt.fromByteArray = h;
  for (var e = [], t = [], n = typeof Uint8Array < "u" ? Uint8Array : Array, r = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", i = 0, o = r.length; i < o; ++i)
    e[i] = r[i], t[r.charCodeAt(i)] = i;
  t[45] = 62, t[95] = 63;
  function a(g) {
    var m = g.length;
    if (m % 4 > 0)
      throw new Error("Invalid string. Length must be a multiple of 4");
    var v = g.indexOf("=");
    v === -1 && (v = m);
    var E = v === m ? 0 : 4 - v % 4;
    return [v, E];
  }
  function l(g) {
    var m = a(g), v = m[0], E = m[1];
    return (v + E) * 3 / 4 - E;
  }
  function d(g, m, v) {
    return (m + v) * 3 / 4 - v;
  }
  function c(g) {
    var m, v = a(g), E = v[0], T = v[1], C = new n(d(g, E, T)), w = 0, D = T > 0 ? E - 4 : E, _;
    for (_ = 0; _ < D; _ += 4)
      m = t[g.charCodeAt(_)] << 18 | t[g.charCodeAt(_ + 1)] << 12 | t[g.charCodeAt(_ + 2)] << 6 | t[g.charCodeAt(_ + 3)], C[w++] = m >> 16 & 255, C[w++] = m >> 8 & 255, C[w++] = m & 255;
    return T === 2 && (m = t[g.charCodeAt(_)] << 2 | t[g.charCodeAt(_ + 1)] >> 4, C[w++] = m & 255), T === 1 && (m = t[g.charCodeAt(_)] << 10 | t[g.charCodeAt(_ + 1)] << 4 | t[g.charCodeAt(_ + 2)] >> 2, C[w++] = m >> 8 & 255, C[w++] = m & 255), C;
  }
  function f(g) {
    return e[g >> 18 & 63] + e[g >> 12 & 63] + e[g >> 6 & 63] + e[g & 63];
  }
  function p(g, m, v) {
    for (var E, T = [], C = m; C < v; C += 3)
      E = (g[C] << 16 & 16711680) + (g[C + 1] << 8 & 65280) + (g[C + 2] & 255), T.push(f(E));
    return T.join("");
  }
  function h(g) {
    for (var m, v = g.length, E = v % 3, T = [], C = 16383, w = 0, D = v - E; w < D; w += C)
      T.push(p(g, w, w + C > D ? D : w + C));
    return E === 1 ? (m = g[v - 1], T.push(
      e[m >> 2] + e[m << 4 & 63] + "=="
    )) : E === 2 && (m = (g[v - 2] << 8) + g[v - 1], T.push(
      e[m >> 10] + e[m >> 4 & 63] + e[m << 2 & 63] + "="
    )), T.join("");
  }
  return Dt;
}
var yn = {}, qo;
function Ma() {
  if (qo) return yn;
  qo = 1, Object.defineProperty(yn, "__esModule", { value: !0 }), yn.fromArrayBufferToHex = e;
  function e(t) {
    return Array.from(new Uint8Array(t)).map((r) => r.toString(16).padStart(2, "0")).join("");
  }
  return yn;
}
var Bo;
function Eu() {
  if (Bo) return xt;
  Bo = 1, Object.defineProperty(xt, "__esModule", { value: !0 }), xt.BrowserCrypto = void 0;
  const e = vu(), t = Ma();
  class n {
    constructor() {
      if (typeof window > "u" || window.crypto === void 0 || window.crypto.subtle === void 0)
        throw new Error("SubtleCrypto not found. Make sure it's an https:// website.");
    }
    async sha256DigestBase64(i) {
      const o = new TextEncoder().encode(i), a = await window.crypto.subtle.digest("SHA-256", o);
      return e.fromByteArray(new Uint8Array(a));
    }
    randomBytesBase64(i) {
      const o = new Uint8Array(i);
      return window.crypto.getRandomValues(o), e.fromByteArray(o);
    }
    static padBase64(i) {
      for (; i.length % 4 !== 0; )
        i += "=";
      return i;
    }
    async verify(i, o, a) {
      const l = {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      }, d = new TextEncoder().encode(o), c = e.toByteArray(n.padBase64(a)), f = await window.crypto.subtle.importKey("jwk", i, l, !0, ["verify"]);
      return await window.crypto.subtle.verify(l, f, Buffer.from(c), d);
    }
    async sign(i, o) {
      const a = {
        name: "RSASSA-PKCS1-v1_5",
        hash: { name: "SHA-256" }
      }, l = new TextEncoder().encode(o), d = await window.crypto.subtle.importKey("jwk", i, a, !0, ["sign"]), c = await window.crypto.subtle.sign(a, d, l);
      return e.fromByteArray(new Uint8Array(c));
    }
    decodeBase64StringUtf8(i) {
      const o = e.toByteArray(n.padBase64(i));
      return new TextDecoder().decode(o);
    }
    encodeBase64StringUtf8(i) {
      const o = new TextEncoder().encode(i);
      return e.fromByteArray(o);
    }
    /**
     * Computes the SHA-256 hash of the provided string.
     * @param str The plain text string to hash.
     * @return A promise that resolves with the SHA-256 hash of the provided
     *   string in hexadecimal encoding.
     */
    async sha256DigestHex(i) {
      const o = new TextEncoder().encode(i), a = await window.crypto.subtle.digest("SHA-256", o);
      return (0, t.fromArrayBufferToHex)(a);
    }
    /**
     * Computes the HMAC hash of a message using the provided crypto key and the
     * SHA-256 algorithm.
     * @param key The secret crypto key in utf-8 or ArrayBuffer format.
     * @param msg The plain text message.
     * @return A promise that resolves with the HMAC-SHA256 hash in ArrayBuffer
     *   format.
     */
    async signWithHmacSha256(i, o) {
      const a = typeof i == "string" ? i : String.fromCharCode(...new Uint16Array(i)), l = new TextEncoder(), d = await window.crypto.subtle.importKey("raw", l.encode(a), {
        name: "HMAC",
        hash: {
          name: "SHA-256"
        }
      }, !1, ["sign"]);
      return window.crypto.subtle.sign("HMAC", d, l.encode(o));
    }
  }
  return xt.BrowserCrypto = n, xt;
}
var Ut = {}, Ho;
function Tu() {
  if (Ho) return Ut;
  Ho = 1, Object.defineProperty(Ut, "__esModule", { value: !0 }), Ut.NodeCrypto = void 0;
  const e = yt;
  class t {
    async sha256DigestBase64(o) {
      return e.createHash("sha256").update(o).digest("base64");
    }
    randomBytesBase64(o) {
      return e.randomBytes(o).toString("base64");
    }
    async verify(o, a, l) {
      const d = e.createVerify("RSA-SHA256");
      return d.update(a), d.end(), d.verify(o, l, "base64");
    }
    async sign(o, a) {
      const l = e.createSign("RSA-SHA256");
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
      return e.createHash("sha256").update(o).digest("hex");
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
      const l = typeof o == "string" ? o : r(o);
      return n(e.createHmac("sha256", l).update(a).digest());
    }
  }
  Ut.NodeCrypto = t;
  function n(i) {
    const o = new ArrayBuffer(i.length), a = new Uint8Array(o);
    for (let l = 0; l < i.length; ++l)
      a[l] = i[l];
    return o;
  }
  function r(i) {
    return Buffer.from(i);
  }
  return Ut;
}
var Vo;
function Ln() {
  return Vo || (Vo = 1, (function(e) {
    var t = je && je.__createBinding || (Object.create ? (function(l, d, c, f) {
      f === void 0 && (f = c);
      var p = Object.getOwnPropertyDescriptor(d, c);
      (!p || ("get" in p ? !d.__esModule : p.writable || p.configurable)) && (p = { enumerable: !0, get: function() {
        return d[c];
      } }), Object.defineProperty(l, f, p);
    }) : (function(l, d, c, f) {
      f === void 0 && (f = c), l[f] = d[c];
    })), n = je && je.__exportStar || function(l, d) {
      for (var c in l) c !== "default" && !Object.prototype.hasOwnProperty.call(d, c) && t(d, l, c);
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.createCrypto = o, e.hasBrowserCrypto = a;
    const r = Eu(), i = Tu();
    n(Ma(), e);
    function o() {
      return a() ? new r.BrowserCrypto() : new i.NodeCrypto();
    }
    function a() {
      return typeof window < "u" && typeof window.crypto < "u" && typeof window.crypto.subtle < "u";
    }
  })(je)), je;
}
var bt = {}, Me = {}, _n = { exports: {} };
var Jo;
function dn() {
  return Jo || (Jo = 1, (function(e, t) {
    var n = sn, r = n.Buffer;
    function i(a, l) {
      for (var d in a)
        l[d] = a[d];
    }
    r.from && r.alloc && r.allocUnsafe && r.allocUnsafeSlow ? e.exports = n : (i(n, t), t.Buffer = o);
    function o(a, l, d) {
      return r(a, l, d);
    }
    o.prototype = Object.create(r.prototype), i(r, o), o.from = function(a, l, d) {
      if (typeof a == "number")
        throw new TypeError("Argument must not be a number");
      return r(a, l, d);
    }, o.alloc = function(a, l, d) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      var c = r(a);
      return l !== void 0 ? typeof d == "string" ? c.fill(l, d) : c.fill(l) : c.fill(0), c;
    }, o.allocUnsafe = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return r(a);
    }, o.allocUnsafeSlow = function(a) {
      if (typeof a != "number")
        throw new TypeError("Argument must be a number");
      return n.SlowBuffer(a);
    };
  })(_n, _n.exports)), _n.exports;
}
var nr, $o;
function Su() {
  if ($o) return nr;
  $o = 1;
  function e(r) {
    var i = (r / 8 | 0) + (r % 8 === 0 ? 0 : 1);
    return i;
  }
  var t = {
    ES256: e(256),
    ES384: e(384),
    ES512: e(521)
  };
  function n(r) {
    var i = t[r];
    if (i)
      return i;
    throw new Error('Unknown algorithm "' + r + '"');
  }
  return nr = n, nr;
}
var rr, Wo;
function xa() {
  if (Wo) return rr;
  Wo = 1;
  var e = dn().Buffer, t = Su(), n = 128, r = 0, i = 32, o = 16, a = 2, l = o | i | r << 6, d = a | r << 6;
  function c(m) {
    return m.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function f(m) {
    if (e.isBuffer(m))
      return m;
    if (typeof m == "string")
      return e.from(m, "base64");
    throw new TypeError("ECDSA signature must be a Base64 string or a Buffer");
  }
  function p(m, v) {
    m = f(m);
    var E = t(v), T = E + 1, C = m.length, w = 0;
    if (m[w++] !== l)
      throw new Error('Could not find expected "seq"');
    var D = m[w++];
    if (D === (n | 1) && (D = m[w++]), C - w < D)
      throw new Error('"seq" specified length of "' + D + '", only "' + (C - w) + '" remaining');
    if (m[w++] !== d)
      throw new Error('Could not find expected "int" for "r"');
    var _ = m[w++];
    if (C - w - 2 < _)
      throw new Error('"r" specified length of "' + _ + '", only "' + (C - w - 2) + '" available');
    if (T < _)
      throw new Error('"r" specified length of "' + _ + '", max of "' + T + '" is acceptable');
    var y = w;
    if (w += _, m[w++] !== d)
      throw new Error('Could not find expected "int" for "s"');
    var S = m[w++];
    if (C - w !== S)
      throw new Error('"s" specified length of "' + S + '", expected "' + (C - w) + '"');
    if (T < S)
      throw new Error('"s" specified length of "' + S + '", max of "' + T + '" is acceptable');
    var R = w;
    if (w += S, w !== C)
      throw new Error('Expected to consume entire buffer, but "' + (C - w) + '" bytes remain');
    var P = E - _, N = E - S, G = e.allocUnsafe(P + _ + N + S);
    for (w = 0; w < P; ++w)
      G[w] = 0;
    m.copy(G, w, y + Math.max(-P, 0), y + _), w = E;
    for (var V = w; w < V + N; ++w)
      G[w] = 0;
    return m.copy(G, w, R + Math.max(-N, 0), R + S), G = G.toString("base64"), G = c(G), G;
  }
  function h(m, v, E) {
    for (var T = 0; v + T < E && m[v + T] === 0; )
      ++T;
    var C = m[v + T] >= n;
    return C && --T, T;
  }
  function g(m, v) {
    m = f(m);
    var E = t(v), T = m.length;
    if (T !== E * 2)
      throw new TypeError('"' + v + '" signatures must be "' + E * 2 + '" bytes, saw "' + T + '"');
    var C = h(m, 0, E), w = h(m, E, m.length), D = E - C, _ = E - w, y = 2 + D + 1 + 1 + _, S = y < n, R = e.allocUnsafe((S ? 2 : 3) + y), P = 0;
    return R[P++] = l, S ? R[P++] = y : (R[P++] = n | 1, R[P++] = y & 255), R[P++] = d, R[P++] = D, C < 0 ? (R[P++] = 0, P += m.copy(R, P, 0, E)) : P += m.copy(R, P, C, E), R[P++] = d, R[P++] = _, w < 0 ? (R[P++] = 0, m.copy(R, P, E)) : m.copy(R, P, E + w), R;
  }
  return rr = {
    derToJose: p,
    joseToDer: g
  }, rr;
}
var Le = {}, Ko;
function Fe() {
  if (Ko) return Le;
  Ko = 1, Object.defineProperty(Le, "__esModule", { value: !0 }), Le.LRUCache = void 0, Le.snakeToCamel = o, Le.originalOrCamelOptions = a, Le.removeUndefinedValuesInObject = d, Le.isValidFile = c, Le.getWellKnownCertificateConfigFileLocation = f;
  const e = lt, t = to, n = no, r = "certificate_config.json", i = "gcloud";
  function o(h) {
    return h.replace(/([_][^_])/g, (g) => g.slice(1).toUpperCase());
  }
  function a(h) {
    function g(m) {
      const v = h || {};
      return v[m] ?? v[o(m)];
    }
    return { get: g };
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
    constructor(g) {
      this.capacity = g.capacity, this.maxAge = g.maxAge;
    }
    /**
     * Moves the key to the end of the cache.
     *
     * @param key the key to move
     * @param value the value of the key
     */
    #t(g, m) {
      this.#e.delete(g), this.#e.set(g, {
        value: m,
        lastAccessed: Date.now()
      });
    }
    /**
     * Add an item to the cache.
     *
     * @param key the key to upsert
     * @param value the value of the key
     */
    set(g, m) {
      this.#t(g, m), this.#n();
    }
    /**
     * Get an item from the cache.
     *
     * @param key the key to retrieve
     */
    get(g) {
      const m = this.#e.get(g);
      if (m)
        return this.#t(g, m.value), this.#n(), m.value;
    }
    /**
     * Maintain the cache based on capacity and TTL.
     */
    #n() {
      const g = this.maxAge ? Date.now() - this.maxAge : 0;
      let m = this.#e.entries().next();
      for (; !m.done && (this.#e.size > this.capacity || // too many
      m.value[1].lastAccessed < g); )
        this.#e.delete(m.value[0]), m = this.#e.entries().next();
    }
  }
  Le.LRUCache = l;
  function d(h) {
    return Object.entries(h).forEach(([g, m]) => {
      (m === void 0 || m === "undefined") && delete h[g];
    }), h;
  }
  async function c(h) {
    try {
      return (await e.promises.lstat(h)).isFile();
    } catch {
      return !1;
    }
  }
  function f() {
    const h = process.env.CLOUDSDK_CONFIG || (p() ? n.join(process.env.APPDATA || "", i) : n.join(process.env.HOME || "", ".config", i));
    return n.join(h, r);
  }
  function p() {
    return t.platform().startsWith("win");
  }
  return Le;
}
var ir = {}, qe = {};
const Cu = "google-auth-library", Au = "10.6.1", wu = "Google Inc.", Iu = "Google APIs Authentication Client Library for Node.js", Ru = { node: ">=18" }, Pu = "./build/src/index.js", Nu = "./build/src/index.d.ts", ku = { type: "git", directory: "packages/google-auth-library-nodejs", url: "https://github.com/googleapis/google-cloud-node-core.git" }, Mu = ["google", "api", "google apis", "client", "client library"], xu = { "base64-js": "^1.3.0", "ecdsa-sig-formatter": "^1.0.11", gaxios: "7.1.3", "gcp-metadata": "8.1.2", "google-logging-utils": "1.1.3", jws: "^4.0.0" }, Du = { "@types/base64-js": "^1.2.5", "@types/jws": "^3.1.0", "@types/mocha": "^10.0.10", "@types/mv": "^2.1.0", "@types/ncp": "^2.0.8", "@types/node": "^24.0.0", "@types/sinon": "^21.0.0", "assert-rejects": "^1.0.0", c8: "^10.1.3", codecov: "^3.8.3", gts: "^6.0.2", "is-docker": "^3.0.0", jsdoc: "^4.0.4", "jsdoc-fresh": "^5.0.0", "jsdoc-region-tag": "^4.0.0", karma: "^6.0.0", "karma-chrome-launcher": "^3.0.0", "karma-coverage": "^2.0.0", "karma-firefox-launcher": "^2.0.0", "karma-mocha": "^2.0.0", "karma-sourcemap-loader": "^0.4.0", "karma-webpack": "^5.0.1", keypair: "^1.0.4", mocha: "^11.1.0", mv: "^2.1.1", ncp: "^2.0.0", nock: "^14.0.5", "null-loader": "^4.0.1", puppeteer: "^24.0.0", sinon: "^21.0.0", "ts-loader": "^9.5.2", typescript: "5.8.3", webpack: "^5.97.1", "webpack-cli": "^6.0.1" }, Uu = ["build/src", "!build/src/**/*.map"], bu = { test: "c8 mocha build/test", clean: "gts clean", prepare: "npm run compile", lint: "gts check --no-inline-config", compile: "tsc -p .", fix: "gts fix", pretest: "npm run compile -- --sourceMap", docs: "jsdoc -c .jsdoc.js", "samples-setup": "cd samples/ && npm link ../ && npm run setup && cd ../", "samples-test": "cd samples/ && npm link ../ && npm test && cd ../", "system-test": "mocha build/system-test --timeout 60000", "presystem-test": "npm run compile -- --sourceMap", webpack: "webpack", "browser-test": "karma start", "docs-test": "echo 'disabled until linkinator is fixed'", "predocs-test": "npm run docs", prelint: "cd samples; npm link ../; npm install" }, Lu = "Apache-2.0", Ou = "https://github.com/googleapis/google-cloud-node-core/tree/main/packages/google-auth-library-nodejs", Fu = {
  name: Cu,
  version: Au,
  author: wu,
  description: Iu,
  engines: Ru,
  main: Pu,
  types: Nu,
  repository: ku,
  keywords: Mu,
  dependencies: xu,
  devDependencies: Du,
  files: Uu,
  scripts: bu,
  license: Lu,
  homepage: Ou
};
var Yo;
function Da() {
  if (Yo) return qe;
  Yo = 1, Object.defineProperty(qe, "__esModule", { value: !0 }), qe.USER_AGENT = qe.PRODUCT_NAME = qe.pkg = void 0;
  const e = Fu;
  qe.pkg = e;
  const t = "google-api-nodejs-client";
  qe.PRODUCT_NAME = t;
  const n = `${t}/${e.version}`;
  return qe.USER_AGENT = n, qe;
}
var zo;
function Pe() {
  return zo || (zo = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.AuthClient = e.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = e.DEFAULT_UNIVERSE = void 0;
    const t = Un, n = ve(), r = Fe(), i = ka(), o = Da();
    e.DEFAULT_UNIVERSE = "googleapis.com", e.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS = 300 * 1e3;
    class a extends t.EventEmitter {
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
      eagerRefreshThresholdMillis = e.DEFAULT_EAGER_REFRESH_THRESHOLD_MILLIS;
      forceRefreshOnFailure = !1;
      universeDomain = e.DEFAULT_UNIVERSE;
      /**
       * Symbols that can be added to GaxiosOptions to specify the method name that is
       * making an RPC call, for logging purposes, as well as a string ID that can be
       * used to correlate calls and responses.
       */
      static RequestMethodNameSymbol = /* @__PURE__ */ Symbol("request method name");
      static RequestLogIdSymbol = /* @__PURE__ */ Symbol("request log id");
      constructor(d = {}) {
        super();
        const c = (0, r.originalOrCamelOptions)(d);
        this.apiKey = d.apiKey, this.projectId = c.get("project_id") ?? null, this.quotaProjectId = c.get("quota_project_id"), this.credentials = c.get("credentials") ?? {}, this.universeDomain = c.get("universe_domain") ?? e.DEFAULT_UNIVERSE, this.transporter = d.transporter ?? new n.Gaxios(d.transporterOptions), c.get("useAuthRequestParameters") !== !1 && (this.transporter.interceptors.request.add(a.DEFAULT_REQUEST_INTERCEPTOR), this.transporter.interceptors.response.add(a.DEFAULT_RESPONSE_INTERCEPTOR)), d.eagerRefreshThresholdMillis && (this.eagerRefreshThresholdMillis = d.eagerRefreshThresholdMillis), this.forceRefreshOnFailure = d.forceRefreshOnFailure ?? !1;
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
      fetch(...d) {
        const c = d[0], f = d[1];
        let p;
        const h = new Headers();
        return typeof c == "string" ? p = new URL(c) : c instanceof URL ? p = c : c && c.url && (p = new URL(c.url)), c && typeof c == "object" && "headers" in c && n.Gaxios.mergeHeaders(h, c.headers), f && n.Gaxios.mergeHeaders(h, new Headers(f.headers)), typeof c == "object" && !(c instanceof URL) ? this.request({ ...f, ...c, headers: h, url: p }) : this.request({ ...f, headers: h, url: p });
      }
      /**
       * Sets the auth credentials.
       */
      setCredentials(d) {
        this.credentials = d;
      }
      /**
       * Append additional headers, e.g., x-goog-user-project, shared across the
       * classes inheriting AuthClient. This method should be used by any method
       * that overrides getRequestMetadataAsync(), which is a shared helper for
       * setting request information in both gRPC and HTTP API calls.
       *
       * @param headers object to append additional headers to.
       */
      addSharedMetadataHeaders(d) {
        return !d.has("x-goog-user-project") && // don't override a value the user sets.
        this.quotaProjectId && d.set("x-goog-user-project", this.quotaProjectId), d;
      }
      /**
       * Adds the `x-goog-user-project` and `authorization` headers to the target Headers
       * object, if they exist on the source.
       *
       * @param target the headers to target
       * @param source the headers to source from
       * @returns the target headers
       */
      addUserProjectAndAuthHeaders(d, c) {
        const f = c.get("x-goog-user-project"), p = c.get("authorization");
        return f && d.set("x-goog-user-project", f), p && d.set("authorization", p), d;
      }
      static log = (0, i.log)("auth");
      static DEFAULT_REQUEST_INTERCEPTOR = {
        resolved: async (d) => {
          if (!d.headers.has("x-goog-api-client")) {
            const f = process.version.replace(/^v/, "");
            d.headers.set("x-goog-api-client", `gl-node/${f}`);
          }
          const c = d.headers.get("User-Agent");
          c ? c.includes(`${o.PRODUCT_NAME}/`) || d.headers.set("User-Agent", `${c} ${o.USER_AGENT}`) : d.headers.set("User-Agent", o.USER_AGENT);
          try {
            const f = d, p = f[a.RequestMethodNameSymbol], h = `${Math.floor(Math.random() * 1e3)}`;
            f[a.RequestLogIdSymbol] = h;
            const g = {
              url: d.url,
              headers: d.headers
            };
            p ? a.log.info("%s [%s] request %j", p, h, g) : a.log.info("[%s] request %j", h, g);
          } catch {
          }
          return d;
        }
      };
      static DEFAULT_RESPONSE_INTERCEPTOR = {
        resolved: async (d) => {
          try {
            const c = d.config, f = c[a.RequestMethodNameSymbol], p = c[a.RequestLogIdSymbol];
            f ? a.log.info("%s [%s] response %j", f, p, d.data) : a.log.info("[%s] response %j", p, d.data);
          } catch {
          }
          return d;
        },
        rejected: async (d) => {
          try {
            const c = d.config, f = c[a.RequestMethodNameSymbol], p = c[a.RequestLogIdSymbol];
            f ? a.log.info("%s [%s] error %j", f, p, d.response?.data) : a.log.error("[%s] error %j", p, d.response?.data);
          } catch {
          }
          throw d;
        }
      };
      /**
       * Sets the method name that is making a Gaxios request, so that logging may tag
       * log lines with the operation.
       * @param config A Gaxios request config
       * @param methodName The method name making the call
       */
      static setMethodName(d, c) {
        try {
          const f = d;
          f[a.RequestMethodNameSymbol] = c;
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
    e.AuthClient = a;
  })(ir)), ir;
}
var Lt = {}, Xo;
function Ua() {
  if (Xo) return Lt;
  Xo = 1, Object.defineProperty(Lt, "__esModule", { value: !0 }), Lt.LoginTicket = void 0;
  class e {
    envelope;
    payload;
    /**
     * Create a simple class to extract user ID from an ID Token
     *
     * @param {string} env Envelope of the jwt
     * @param {TokenPayload} pay Payload of the jwt
     * @constructor
     */
    constructor(n, r) {
      this.envelope = n, this.payload = r;
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
  return Lt.LoginTicket = e, Lt;
}
var Qo;
function _t() {
  if (Qo) return Me;
  Qo = 1, Object.defineProperty(Me, "__esModule", { value: !0 }), Me.OAuth2Client = Me.ClientAuthentication = Me.CertificateFormat = Me.CodeChallengeMethod = void 0;
  const e = ve(), t = Uc, n = we, r = xa(), i = Fe(), o = Ln(), a = Pe(), l = Ua();
  var d;
  (function(h) {
    h.Plain = "plain", h.S256 = "S256";
  })(d || (Me.CodeChallengeMethod = d = {}));
  var c;
  (function(h) {
    h.PEM = "PEM", h.JWK = "JWK";
  })(c || (Me.CertificateFormat = c = {}));
  var f;
  (function(h) {
    h.ClientSecretPost = "ClientSecretPost", h.ClientSecretBasic = "ClientSecretBasic", h.None = "None";
  })(f || (Me.ClientAuthentication = f = {}));
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
    constructor(g = {}, m, v) {
      super(typeof g == "object" ? g : {}), typeof g != "object" && (g = {
        clientId: g,
        clientSecret: m,
        redirectUri: v
      }), this._clientId = g.clientId || g.client_id, this._clientSecret = g.clientSecret || g.client_secret, this.redirectUri = g.redirectUri || g.redirect_uris?.[0], this.endpoints = {
        tokenInfoUrl: "https://oauth2.googleapis.com/tokeninfo",
        oauth2AuthBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        oauth2TokenUrl: "https://oauth2.googleapis.com/token",
        oauth2RevokeUrl: "https://oauth2.googleapis.com/revoke",
        oauth2FederatedSignonPemCertsUrl: "https://www.googleapis.com/oauth2/v1/certs",
        oauth2FederatedSignonJwkCertsUrl: "https://www.googleapis.com/oauth2/v3/certs",
        oauth2IapPublicKeyUrl: "https://www.gstatic.com/iap/verify/public_key",
        ...g.endpoints
      }, this.clientAuthentication = g.clientAuthentication || f.ClientSecretPost, this.issuers = g.issuers || [
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
    generateAuthUrl(g = {}) {
      if (g.code_challenge_method && !g.code_challenge)
        throw new Error("If a code_challenge_method is provided, code_challenge must be included.");
      return g.response_type = g.response_type || "code", g.client_id = g.client_id || this._clientId, g.redirect_uri = g.redirect_uri || this.redirectUri, Array.isArray(g.scope) && (g.scope = g.scope.join(" ")), this.endpoints.oauth2AuthBaseUrl.toString() + "?" + t.stringify(g);
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
      const g = (0, o.createCrypto)(), v = g.randomBytesBase64(96).replace(/\+/g, "~").replace(/=/g, "_").replace(/\//g, "-"), T = (await g.sha256DigestBase64(v)).split("=")[0].replace(/\+/g, "-").replace(/\//g, "_");
      return { codeVerifier: v, codeChallenge: T };
    }
    getToken(g, m) {
      const v = typeof g == "string" ? { code: g } : g;
      if (m)
        this.getTokenAsync(v).then((E) => m(null, E.tokens, E.res), (E) => m(E, null, E.response));
      else
        return this.getTokenAsync(v);
    }
    async getTokenAsync(g) {
      const m = this.endpoints.oauth2TokenUrl.toString(), v = new Headers(), E = {
        client_id: g.client_id || this._clientId,
        code_verifier: g.codeVerifier,
        code: g.code,
        grant_type: "authorization_code",
        redirect_uri: g.redirect_uri || this.redirectUri
      };
      if (this.clientAuthentication === f.ClientSecretBasic) {
        const D = Buffer.from(`${this._clientId}:${this._clientSecret}`);
        v.set("authorization", `Basic ${D.toString("base64")}`);
      }
      this.clientAuthentication === f.ClientSecretPost && (E.client_secret = this._clientSecret);
      const T = {
        ...p.RETRY_CONFIG,
        method: "POST",
        url: m,
        data: new URLSearchParams((0, i.removeUndefinedValuesInObject)(E)),
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
    async refreshToken(g) {
      if (!g)
        return this.refreshTokenNoCache(g);
      if (this.refreshTokenPromises.has(g))
        return this.refreshTokenPromises.get(g);
      const m = this.refreshTokenNoCache(g).then((v) => (this.refreshTokenPromises.delete(g), v), (v) => {
        throw this.refreshTokenPromises.delete(g), v;
      });
      return this.refreshTokenPromises.set(g, m), m;
    }
    async refreshTokenNoCache(g) {
      if (!g)
        throw new Error("No refresh token is set.");
      const m = this.endpoints.oauth2TokenUrl.toString(), v = {
        refresh_token: g,
        client_id: this._clientId,
        client_secret: this._clientSecret,
        grant_type: "refresh_token"
      };
      let E;
      try {
        const C = {
          ...p.RETRY_CONFIG,
          method: "POST",
          url: m,
          data: new URLSearchParams((0, i.removeUndefinedValuesInObject)(v))
        };
        a.AuthClient.setMethodName(C, "refreshTokenNoCache"), E = await this.transporter.request(C);
      } catch (C) {
        throw C instanceof e.GaxiosError && C.message === "invalid_grant" && C.response?.data && /ReAuth/i.test(C.response.data.error_description) && (C.message = JSON.stringify(C.response.data)), C;
      }
      const T = E.data;
      return E.data && E.data.expires_in && (T.expiry_date = (/* @__PURE__ */ new Date()).getTime() + E.data.expires_in * 1e3, delete T.expires_in), this.emit("tokens", T), { tokens: T, res: E };
    }
    refreshAccessToken(g) {
      if (g)
        this.refreshAccessTokenAsync().then((m) => g(null, m.credentials, m.res), g);
      else
        return this.refreshAccessTokenAsync();
    }
    async refreshAccessTokenAsync() {
      const g = await this.refreshToken(this.credentials.refresh_token), m = g.tokens;
      return m.refresh_token = this.credentials.refresh_token, this.credentials = m, { credentials: this.credentials, res: g.res };
    }
    getAccessToken(g) {
      if (g)
        this.getAccessTokenAsync().then((m) => g(null, m.token, m.res), g);
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
        const m = await this.refreshAccessTokenAsync();
        if (!m.credentials || m.credentials && !m.credentials.access_token)
          throw new Error("Could not refresh access token.");
        return { token: m.credentials.access_token, res: m.res };
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
    async getRequestHeaders(g) {
      return (await this.getRequestMetadataAsync(g)).headers;
    }
    async getRequestMetadataAsync(g) {
      const m = this.credentials;
      if (!m.access_token && !m.refresh_token && !this.apiKey && !this.refreshHandler)
        throw new Error("No access, refresh token, API key or refresh handler callback is set.");
      if (m.access_token && !this.isTokenExpiring()) {
        m.token_type = m.token_type || "Bearer";
        const w = new Headers({
          authorization: m.token_type + " " + m.access_token
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
        v = await this.refreshToken(m.refresh_token), E = v.tokens;
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
    static getRevokeTokenUrl(g) {
      return new p().getRevokeTokenURL(g).toString();
    }
    /**
     * Generates a URL to revoke the given token.
     *
     * @param token The existing token to be revoked.
     */
    getRevokeTokenURL(g) {
      const m = new URL(this.endpoints.oauth2RevokeUrl);
      return m.searchParams.append("token", g), m;
    }
    revokeToken(g, m) {
      const v = {
        ...p.RETRY_CONFIG,
        url: this.getRevokeTokenURL(g).toString(),
        method: "POST"
      };
      if (a.AuthClient.setMethodName(v, "revokeToken"), m)
        this.transporter.request(v).then((E) => m(null, E), m);
      else
        return this.transporter.request(v);
    }
    revokeCredentials(g) {
      if (g)
        this.revokeCredentialsAsync().then((m) => g(null, m), g);
      else
        return this.revokeCredentialsAsync();
    }
    async revokeCredentialsAsync() {
      const g = this.credentials.access_token;
      if (this.credentials = {}, g)
        return this.revokeToken(g);
      throw new Error("No access token to revoke.");
    }
    request(g, m) {
      if (m)
        this.requestAsync(g).then((v) => m(null, v), (v) => m(v, v.response));
      else
        return this.requestAsync(g);
    }
    async requestAsync(g, m = !1) {
      try {
        const v = await this.getRequestMetadataAsync();
        return g.headers = e.Gaxios.mergeHeaders(g.headers), this.addUserProjectAndAuthHeaders(g.headers, v.headers), this.apiKey && g.headers.set("X-Goog-Api-Key", this.apiKey), await this.transporter.request(g);
      } catch (v) {
        const E = v.response;
        if (E) {
          const T = E.status, C = this.credentials && this.credentials.access_token && this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure), w = this.credentials && this.credentials.access_token && !this.credentials.refresh_token && (!this.credentials.expiry_date || this.forceRefreshOnFailure) && this.refreshHandler, D = E.config.data instanceof n.Readable, _ = T === 401 || T === 403;
          if (!m && _ && !D && C)
            return await this.refreshAccessTokenAsync(), this.requestAsync(g, !0);
          if (!m && _ && !D && w) {
            const y = await this.processAndValidateRefreshHandler();
            return y?.access_token && this.setCredentials(y), this.requestAsync(g, !0);
          }
        }
        throw v;
      }
    }
    verifyIdToken(g, m) {
      if (m && typeof m != "function")
        throw new Error("This method accepts an options object as the first parameter, which includes the idToken, audience, and maxExpiry.");
      if (m)
        this.verifyIdTokenAsync(g).then((v) => m(null, v), m);
      else
        return this.verifyIdTokenAsync(g);
    }
    async verifyIdTokenAsync(g) {
      if (!g.idToken)
        throw new Error("The verifyIdToken method requires an ID Token");
      const m = await this.getFederatedSignonCertsAsync();
      return await this.verifySignedJwtWithCertsAsync(g.idToken, m.certs, g.audience, this.issuers, g.maxExpiry);
    }
    /**
     * Obtains information about the provisioned access token.  Especially useful
     * if you want to check the scopes that were provisioned to a given token.
     *
     * @param accessToken Required.  The Access Token for which you want to get
     * user info.
     */
    async getTokenInfo(g) {
      const { data: m } = await this.transporter.request({
        ...p.RETRY_CONFIG,
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          authorization: `Bearer ${g}`
        },
        url: this.endpoints.tokenInfoUrl.toString()
      }), v = Object.assign({
        expiry_date: (/* @__PURE__ */ new Date()).getTime() + m.expires_in * 1e3,
        scopes: m.scope.split(" ")
      }, m);
      return delete v.expires_in, delete v.scope, v;
    }
    getFederatedSignonCerts(g) {
      if (g)
        this.getFederatedSignonCertsAsync().then((m) => g(null, m.certs, m.res), g);
      else
        return this.getFederatedSignonCertsAsync();
    }
    async getFederatedSignonCertsAsync() {
      const g = (/* @__PURE__ */ new Date()).getTime(), m = (0, o.hasBrowserCrypto)() ? c.JWK : c.PEM;
      if (this.certificateExpiry && g < this.certificateExpiry.getTime() && this.certificateCacheFormat === m)
        return { certs: this.certificateCache, format: m };
      let v, E;
      switch (m) {
        case c.PEM:
          E = this.endpoints.oauth2FederatedSignonPemCertsUrl.toString();
          break;
        case c.JWK:
          E = this.endpoints.oauth2FederatedSignonJwkCertsUrl.toString();
          break;
        default:
          throw new Error(`Unsupported certificate format ${m}`);
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
      switch (m) {
        case c.PEM:
          w = v.data;
          break;
        case c.JWK:
          for (const _ of v.data.keys)
            w[_.kid] = _;
          break;
        default:
          throw new Error(`Unsupported certificate format ${m}`);
      }
      const D = /* @__PURE__ */ new Date();
      return this.certificateExpiry = C === -1 ? null : new Date(D.getTime() + C), this.certificateCache = w, this.certificateCacheFormat = m, { certs: w, format: m, res: v };
    }
    getIapPublicKeys(g) {
      if (g)
        this.getIapPublicKeysAsync().then((m) => g(null, m.pubkeys, m.res), g);
      else
        return this.getIapPublicKeysAsync();
    }
    async getIapPublicKeysAsync() {
      let g;
      const m = this.endpoints.oauth2IapPublicKeyUrl.toString();
      try {
        const v = {
          ...p.RETRY_CONFIG,
          url: m
        };
        a.AuthClient.setMethodName(v, "getIapPublicKeysAsync"), g = await this.transporter.request(v);
      } catch (v) {
        throw v instanceof Error && (v.message = `Failed to retrieve verification certificates: ${v.message}`), v;
      }
      return { pubkeys: g.data, res: g };
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
    async verifySignedJwtWithCertsAsync(g, m, v, E, T) {
      const C = (0, o.createCrypto)();
      T || (T = p.DEFAULT_MAX_TOKEN_LIFETIME_SECS_);
      const w = g.split(".");
      if (w.length !== 3)
        throw new Error("Wrong number of segments in token: " + g);
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
      if (!Object.prototype.hasOwnProperty.call(m, y.kid))
        throw new Error("No pem found for envelope: " + JSON.stringify(y));
      const R = m[y.kid];
      if (y.alg === "ES256" && (_ = r.joseToDer(_, "ES256").toString("base64")), !await C.verify(R, D, _))
        throw new Error("Invalid token signature: " + g);
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
        const g = await this.refreshHandler();
        if (!g.access_token)
          throw new Error("No access token is returned by the refreshHandler callback.");
        return g;
      }
    }
    /**
     * Returns true if a token is expired or will expire within
     * eagerRefreshThresholdMillismilliseconds.
     * If there is no expiry time, assumes the token is not expired or expiring.
     */
    isTokenExpiring() {
      const g = this.credentials.expiry_date;
      return g ? g <= (/* @__PURE__ */ new Date()).getTime() + this.eagerRefreshThresholdMillis : !1;
    }
  }
  return Me.OAuth2Client = p, Me;
}
var Zo;
function ba() {
  if (Zo) return bt;
  Zo = 1, Object.defineProperty(bt, "__esModule", { value: !0 }), bt.Compute = void 0;
  const e = ve(), t = bn(), n = _t();
  class r extends n.OAuth2Client {
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
        const d = {
          property: o
        };
        this.scopes.length > 0 && (d.params = {
          scopes: this.scopes.join(",")
        }), a = await t.instance(d);
      } catch (d) {
        throw d instanceof e.GaxiosError && (d.message = `Could not refresh access token: ${d.message}`, this.wrapError(d)), d;
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
        const d = {
          property: a
        };
        l = await t.instance(d);
      } catch (d) {
        throw d instanceof Error && (d.message = `Could not fetch ID token: ${d.message}`), d;
      }
      return l;
    }
    wrapError(o) {
      const a = o.response;
      a && a.status && (o.status = a.status, a.status === 403 ? o.message = "A Forbidden error was returned while attempting to retrieve an access token for the Compute Engine built-in service account. This may be because the Compute Engine instance does not have the correct permission scopes specified: " + o.message : a.status === 404 && (o.message = "A Not Found error was returned while attempting to retrieve an accesstoken for the Compute Engine built-in service account. This may be because the Compute Engine instance does not have any permission scopes specified: " + o.message));
    }
  }
  return bt.Compute = r, bt;
}
var Ot = {}, jo;
function La() {
  if (jo) return Ot;
  jo = 1, Object.defineProperty(Ot, "__esModule", { value: !0 }), Ot.IdTokenClient = void 0;
  const e = _t();
  class t extends e.OAuth2Client {
    targetAudience;
    idTokenProvider;
    /**
     * Google ID Token client
     *
     * Retrieve ID token from the metadata server.
     * See: https://cloud.google.com/docs/authentication/get-id-token#metadata-server
     */
    constructor(r) {
      super(r), this.targetAudience = r.targetAudience, this.idTokenProvider = r.idTokenProvider;
    }
    async getRequestMetadataAsync() {
      if (!this.credentials.id_token || !this.credentials.expiry_date || this.isTokenExpiring()) {
        const i = await this.idTokenProvider.fetchIdToken(this.targetAudience);
        this.credentials = {
          id_token: i,
          expiry_date: this.getIdTokenExpiryDate(i)
        };
      }
      return { headers: new Headers({
        authorization: "Bearer " + this.credentials.id_token
      }) };
    }
    getIdTokenExpiryDate(r) {
      const i = r.split(".")[1];
      if (i)
        return JSON.parse(Buffer.from(i, "base64").toString("ascii")).exp * 1e3;
    }
  }
  return Ot.IdTokenClient = t, Ot;
}
var et = {}, es;
function Oa() {
  if (es) return et;
  es = 1, Object.defineProperty(et, "__esModule", { value: !0 }), et.GCPEnv = void 0, et.clear = r, et.getEnv = i;
  const e = bn();
  var t;
  (function(h) {
    h.APP_ENGINE = "APP_ENGINE", h.KUBERNETES_ENGINE = "KUBERNETES_ENGINE", h.CLOUD_FUNCTIONS = "CLOUD_FUNCTIONS", h.COMPUTE_ENGINE = "COMPUTE_ENGINE", h.CLOUD_RUN = "CLOUD_RUN", h.CLOUD_RUN_JOBS = "CLOUD_RUN_JOBS", h.NONE = "NONE";
  })(t || (et.GCPEnv = t = {}));
  let n;
  function r() {
    n = void 0;
  }
  async function i() {
    return n || (n = o(), n);
  }
  async function o() {
    let h = t.NONE;
    return a() ? h = t.APP_ENGINE : l() ? h = t.CLOUD_FUNCTIONS : await p() ? await f() ? h = t.KUBERNETES_ENGINE : d() ? h = t.CLOUD_RUN : c() ? h = t.CLOUD_RUN_JOBS : h = t.COMPUTE_ENGINE : h = t.NONE, h;
  }
  function a() {
    return !!(process.env.GAE_SERVICE || process.env.GAE_MODULE_NAME);
  }
  function l() {
    return !!(process.env.FUNCTION_NAME || process.env.FUNCTION_TARGET);
  }
  function d() {
    return !!process.env.K_CONFIGURATION;
  }
  function c() {
    return !!process.env.CLOUD_RUN_JOB;
  }
  async function f() {
    try {
      return await e.instance("attributes/cluster-name"), !0;
    } catch {
      return !1;
    }
  }
  async function p() {
    return e.isAvailable();
  }
  return et;
}
var Ft = {}, Gt = {}, qt = {}, vn = {}, Bt = {}, Be = {}, or, ts;
function Fa() {
  if (ts) return or;
  ts = 1;
  var e = dn().Buffer, t = we, n = ct;
  function r(i) {
    if (this.buffer = null, this.writable = !0, this.readable = !0, !i)
      return this.buffer = e.alloc(0), this;
    if (typeof i.pipe == "function")
      return this.buffer = e.alloc(0), i.pipe(this), this;
    if (i.length || typeof i == "object")
      return this.buffer = i, this.writable = !1, process.nextTick((function() {
        this.emit("end", i), this.readable = !1, this.emit("close");
      }).bind(this)), this;
    throw new TypeError("Unexpected data type (" + typeof i + ")");
  }
  return n.inherits(r, t), r.prototype.write = function(o) {
    this.buffer = e.concat([this.buffer, e.from(o)]), this.emit("data", o);
  }, r.prototype.end = function(o) {
    o && this.write(o), this.emit("end", o), this.emit("close"), this.writable = !1, this.readable = !1;
  }, or = r, or;
}
var sr, ns;
function Gu() {
  if (ns) return sr;
  ns = 1;
  var e = sn.Buffer, t = sn.SlowBuffer;
  sr = n;
  function n(o, a) {
    if (!e.isBuffer(o) || !e.isBuffer(a) || o.length !== a.length)
      return !1;
    for (var l = 0, d = 0; d < o.length; d++)
      l |= o[d] ^ a[d];
    return l === 0;
  }
  n.install = function() {
    e.prototype.equal = t.prototype.equal = function(a) {
      return n(this, a);
    };
  };
  var r = e.prototype.equal, i = t.prototype.equal;
  return n.restore = function() {
    e.prototype.equal = r, t.prototype.equal = i;
  }, sr;
}
var ar, rs;
function Ga() {
  if (rs) return ar;
  rs = 1;
  var e = dn().Buffer, t = yt, n = xa(), r = ct, i = `"%s" is not a valid algorithm.
  Supported algorithms are:
  "HS256", "HS384", "HS512", "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512" and "none".`, o = "secret must be a string or buffer", a = "key must be a string or a buffer", l = "key must be a string, a buffer or an object", d = typeof t.createPublicKey == "function";
  d && (a += " or a KeyObject", o += "or a KeyObject");
  function c(q) {
    if (!e.isBuffer(q) && typeof q != "string" && (!d || typeof q != "object" || typeof q.type != "string" || typeof q.asymmetricKeyType != "string" || typeof q.export != "function"))
      throw m(a);
  }
  function f(q) {
    if (!e.isBuffer(q) && typeof q != "string" && typeof q != "object")
      throw m(l);
  }
  function p(q) {
    if (!e.isBuffer(q)) {
      if (typeof q == "string")
        return q;
      if (!d || typeof q != "object" || q.type !== "secret" || typeof q.export != "function")
        throw m(o);
    }
  }
  function h(q) {
    return q.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function g(q) {
    q = q.toString();
    var J = 4 - q.length % 4;
    if (J !== 4)
      for (var W = 0; W < J; ++W)
        q += "=";
    return q.replace(/\-/g, "+").replace(/_/g, "/");
  }
  function m(q) {
    var J = [].slice.call(arguments, 1), W = r.format.bind(r, q).apply(null, J);
    return new TypeError(W);
  }
  function v(q) {
    return e.isBuffer(q) || typeof q == "string";
  }
  function E(q) {
    return v(q) || (q = JSON.stringify(q)), q;
  }
  function T(q) {
    return function(W, $) {
      p($), W = E(W);
      var X = t.createHmac("sha" + q, $), Z = (X.update(W), X.digest("base64"));
      return h(Z);
    };
  }
  var C, w = "timingSafeEqual" in t ? function(J, W) {
    return J.byteLength !== W.byteLength ? !1 : t.timingSafeEqual(J, W);
  } : function(J, W) {
    return C || (C = Gu()), C(J, W);
  };
  function D(q) {
    return function(W, $, X) {
      var Z = T(q)(W, X);
      return w(e.from($), e.from(Z));
    };
  }
  function _(q) {
    return function(W, $) {
      f($), W = E(W);
      var X = t.createSign("RSA-SHA" + q), Z = (X.update(W), X.sign($, "base64"));
      return h(Z);
    };
  }
  function y(q) {
    return function(W, $, X) {
      c(X), W = E(W), $ = g($);
      var Z = t.createVerify("RSA-SHA" + q);
      return Z.update(W), Z.verify(X, $, "base64");
    };
  }
  function S(q) {
    return function(W, $) {
      f($), W = E(W);
      var X = t.createSign("RSA-SHA" + q), Z = (X.update(W), X.sign({
        key: $,
        padding: t.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: t.constants.RSA_PSS_SALTLEN_DIGEST
      }, "base64"));
      return h(Z);
    };
  }
  function R(q) {
    return function(W, $, X) {
      c(X), W = E(W), $ = g($);
      var Z = t.createVerify("RSA-SHA" + q);
      return Z.update(W), Z.verify({
        key: X,
        padding: t.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: t.constants.RSA_PSS_SALTLEN_DIGEST
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
  return ar = function(J) {
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
      throw m(i, J);
    var Z = (X[1] || X[3]).toLowerCase(), le = X[2];
    return {
      sign: W[Z](le),
      verify: $[Z](le)
    };
  }, ar;
}
var lr, is;
function qa() {
  if (is) return lr;
  is = 1;
  var e = sn.Buffer;
  return lr = function(n) {
    return typeof n == "string" ? n : typeof n == "number" || e.isBuffer(n) ? n.toString() : JSON.stringify(n);
  }, lr;
}
var cr, os;
function qu() {
  if (os) return cr;
  os = 1;
  var e = dn().Buffer, t = Fa(), n = Ga(), r = we, i = qa(), o = ct;
  function a(f, p) {
    return e.from(f, p).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }
  function l(f, p, h) {
    h = h || "utf8";
    var g = a(i(f), "binary"), m = a(i(p), h);
    return o.format("%s.%s", g, m);
  }
  function d(f) {
    var p = f.header, h = f.payload, g = f.secret || f.privateKey, m = f.encoding, v = n(p.alg), E = l(p, h, m), T = v.sign(E, g);
    return o.format("%s.%s", E, T);
  }
  function c(f) {
    var p = f.secret;
    if (p = p ?? f.privateKey, p = p ?? f.key, /^hs/i.test(f.header.alg) === !0 && p == null)
      throw new TypeError("secret must be a string or buffer or a KeyObject");
    var h = new t(p);
    this.readable = !0, this.header = f.header, this.encoding = f.encoding, this.secret = this.privateKey = this.key = h, this.payload = new t(f.payload), this.secret.once("close", (function() {
      !this.payload.writable && this.readable && this.sign();
    }).bind(this)), this.payload.once("close", (function() {
      !this.secret.writable && this.readable && this.sign();
    }).bind(this));
  }
  return o.inherits(c, r), c.prototype.sign = function() {
    try {
      var p = d({
        header: this.header,
        payload: this.payload.buffer,
        secret: this.secret.buffer,
        encoding: this.encoding
      });
      return this.emit("done", p), this.emit("data", p), this.emit("end"), this.readable = !1, p;
    } catch (h) {
      this.readable = !1, this.emit("error", h), this.emit("close");
    }
  }, c.sign = d, cr = c, cr;
}
var ur, ss;
function Bu() {
  if (ss) return ur;
  ss = 1;
  var e = dn().Buffer, t = Fa(), n = Ga(), r = we, i = qa(), o = ct, a = /^[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)?$/;
  function l(T) {
    return Object.prototype.toString.call(T) === "[object Object]";
  }
  function d(T) {
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
    return d(e.from(C, "base64").toString("binary"));
  }
  function f(T) {
    return T.split(".", 2).join(".");
  }
  function p(T) {
    return T.split(".")[2];
  }
  function h(T, C) {
    C = C || "utf8";
    var w = T.split(".")[1];
    return e.from(w, "base64").toString(C);
  }
  function g(T) {
    return a.test(T) && !!c(T);
  }
  function m(T, C, w) {
    if (!C) {
      var D = new Error("Missing algorithm parameter for jws.verify");
      throw D.code = "MISSING_ALGORITHM", D;
    }
    T = i(T);
    var _ = p(T), y = f(T), S = n(C);
    return S.verify(y, _, w);
  }
  function v(T, C) {
    if (C = C || {}, T = i(T), !g(T))
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
    var w = new t(C);
    this.readable = !0, this.algorithm = T.algorithm, this.encoding = T.encoding, this.secret = this.publicKey = this.key = w, this.signature = new t(T.signature), this.secret.once("close", (function() {
      !this.signature.writable && this.readable && this.verify();
    }).bind(this)), this.signature.once("close", (function() {
      !this.secret.writable && this.readable && this.verify();
    }).bind(this));
  }
  return o.inherits(E, r), E.prototype.verify = function() {
    try {
      var C = m(this.signature.buffer, this.algorithm, this.key.buffer), w = v(this.signature.buffer, this.encoding);
      return this.emit("done", C, w), this.emit("data", C), this.emit("end"), this.readable = !1, C;
    } catch (D) {
      this.readable = !1, this.emit("error", D), this.emit("close");
    }
  }, E.decode = v, E.isValid = g, E.verify = m, ur = E, ur;
}
var as;
function Ba() {
  if (as) return Be;
  as = 1;
  var e = qu(), t = Bu(), n = [
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
  return Be.ALGORITHMS = n, Be.sign = e.sign, Be.verify = t.verify, Be.decode = t.decode, Be.isValid = t.isValid, Be.createSign = function(i) {
    return new e(i);
  }, Be.createVerify = function(i) {
    return new t(i);
  }, Be;
}
var ls;
function Hu() {
  if (ls) return Bt;
  ls = 1, Object.defineProperty(Bt, "__esModule", { value: !0 }), Bt.buildPayloadForJwsSign = r, Bt.getJwsSign = i;
  const e = Ba(), t = "RS256", n = "https://oauth2.googleapis.com/token";
  function r(o) {
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
  function i(o) {
    const a = r(o);
    return (0, e.sign)({
      header: { alg: t },
      payload: a,
      secret: o.key
    });
  }
  return Bt;
}
var cs;
function Vu() {
  if (cs) return vn;
  cs = 1, Object.defineProperty(vn, "__esModule", { value: !0 }), vn.getToken = i;
  const e = Hu(), t = "https://oauth2.googleapis.com/token", n = "urn:ietf:params:oauth:grant-type:jwt-bearer", r = (o) => ({
    method: "POST",
    url: t,
    data: new URLSearchParams({
      grant_type: n,
      // Grant type for JWT
      assertion: (0, e.getJwsSign)(o)
    }),
    responseType: "json",
    retryConfig: {
      httpMethodsToRetry: ["POST"]
    }
  });
  async function i(o) {
    if (!o.transporter)
      throw new Error("No transporter set.");
    try {
      const a = r(o);
      return (await o.transporter.request(a)).data;
    } catch (a) {
      const l = a, d = l.response?.data;
      throw d?.error && (l.message = `${d.error}: ${d.error_description}`), l;
    }
  }
  return vn;
}
var En = {}, Ht = {}, us;
function Ju() {
  if (us) return Ht;
  us = 1, Object.defineProperty(Ht, "__esModule", { value: !0 }), Ht.ErrorWithCode = void 0;
  class e extends Error {
    code;
    constructor(n, r) {
      super(n), this.code = r;
    }
  }
  return Ht.ErrorWithCode = e, Ht;
}
var ds;
function Ha() {
  if (ds) return En;
  ds = 1, Object.defineProperty(En, "__esModule", { value: !0 }), En.getCredentials = f;
  const e = no, t = lt, n = ct, r = Ju(), i = t.readFile ? (0, n.promisify)(t.readFile) : async () => {
    throw new r.ErrorWithCode("use key rather than keyFile.", "MISSING_CREDENTIALS");
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
      const h = await i(this.keyFilePath, "utf8");
      let g;
      try {
        g = JSON.parse(h);
      } catch (E) {
        const T = E;
        throw new Error(`Invalid JSON key file: ${T.message}`);
      }
      const m = g.private_key, v = g.client_email;
      if (!m || !v)
        throw new r.ErrorWithCode("private_key and client_email are required.", "MISSING_CREDENTIALS");
      return { privateKey: m, clientEmail: v };
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
      return { privateKey: await i(this.keyFilePath, "utf8") };
    }
  }
  class d {
    /**
     * Throws an error as P12/PFX certificates are not supported.
     * @returns A promise that rejects with an error.
     */
    async getCredentials() {
      throw new r.ErrorWithCode("*.p12 certificates are not supported after v6.1.2. Consider utilizing *.json format or converting *.p12 to *.pem using the OpenSSL CLI.", "UNKNOWN_CERTIFICATE_TYPE");
    }
  }
  class c {
    /**
     * Creates a credential provider based on the key file extension.
     * @param keyFilePath The path to the key file.
     * @returns An instance of a class that implements ICredentialsProvider.
     */
    static create(h) {
      switch (e.extname(h)) {
        case o.JSON:
          return new a(h);
        case o.DER:
        case o.CRT:
        case o.PEM:
          return new l(h);
        case o.P12:
        case o.PFX:
          return new d();
        default:
          throw new r.ErrorWithCode("Unknown certificate type. Type is determined based on file extension. Current supported extensions are *.json, and *.pem.", "UNKNOWN_CERTIFICATE_TYPE");
      }
    }
  }
  async function f(p) {
    return c.create(p).getCredentials();
  }
  return En;
}
var fs;
function $u() {
  if (fs) return qt;
  fs = 1, Object.defineProperty(qt, "__esModule", { value: !0 }), qt.TokenHandler = void 0;
  const e = Vu(), t = Ha();
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
    constructor(i) {
      this.tokenOptions = i;
    }
    /**
     * Processes the credentials, loading them from a key file if necessary.
     * This method is called before any token request.
     */
    async processCredentials() {
      if (!this.tokenOptions.key && !this.tokenOptions.keyFile)
        throw new Error("No key or keyFile set.");
      if (!this.tokenOptions.key && this.tokenOptions.keyFile) {
        const i = await (0, t.getCredentials)(this.tokenOptions.keyFile);
        this.tokenOptions.key = i.privateKey, this.tokenOptions.email = i.clientEmail;
      }
    }
    /**
     * Checks if the cached token is expired or close to expiring.
     * @returns True if the token is expiring, false otherwise.
     */
    isTokenExpiring() {
      if (!this.token || !this.tokenExpiresAt)
        return !0;
      const i = (/* @__PURE__ */ new Date()).getTime(), o = this.tokenOptions.eagerRefreshThresholdMillis ?? 0;
      return this.tokenExpiresAt <= i + o;
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
    async getToken(i) {
      if (await this.processCredentials(), this.inFlightRequest && !i)
        return this.inFlightRequest;
      if (this.token && !this.isTokenExpiring() && !i)
        return this.token;
      try {
        this.inFlightRequest = (0, e.getToken)(this.tokenOptions);
        const o = await this.inFlightRequest;
        return this.token = o, this.tokenExpiresAt = (/* @__PURE__ */ new Date()).getTime() + (o.expires_in ?? 0) * 1e3, o;
      } finally {
        this.inFlightRequest = void 0;
      }
    }
  }
  return qt.TokenHandler = n, qt;
}
var Tn = {}, hs;
function Wu() {
  if (hs) return Tn;
  hs = 1, Object.defineProperty(Tn, "__esModule", { value: !0 }), Tn.revokeToken = n;
  const e = "https://oauth2.googleapis.com/revoke?token=", t = !0;
  async function n(r, i) {
    const o = e + r;
    return await i.request({
      url: o,
      retry: t
    });
  }
  return Tn;
}
var ps;
function Va() {
  if (ps) return Gt;
  ps = 1, Object.defineProperty(Gt, "__esModule", { value: !0 }), Gt.GoogleToken = void 0;
  const e = ve(), t = $u(), n = Wu();
  class r {
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
        request: (a) => (0, e.request)(a)
      }, this.tokenOptions.iss || (this.tokenOptions.iss = this.tokenOptions.email), typeof this.tokenOptions.scope == "object" && (this.tokenOptions.scope = this.tokenOptions.scope.join(" ")), this.tokenHandler = new t.TokenHandler(this.tokenOptions);
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
      const d = this.tokenHandler.getToken(a.forceRefresh ?? !1);
      return l && d.then((c) => l(null, c), l), d;
    }
    revokeToken(o) {
      if (!this.accessToken)
        return Promise.reject(new Error("No token to revoke."));
      const a = (0, n.revokeToken)(this.accessToken, this.tokenOptions.transporter);
      o && a.then(() => o(), o), this.tokenHandler = new t.TokenHandler(this.tokenOptions);
    }
    /**
     * Returns the configuration options for this token instance.
     */
    get googleTokenOptions() {
      return this.tokenOptions;
    }
  }
  return Gt.GoogleToken = r, Gt;
}
var Vt = {}, gs;
function Ja() {
  if (gs) return Vt;
  gs = 1, Object.defineProperty(Vt, "__esModule", { value: !0 }), Vt.JWTAccess = void 0;
  const e = Ba(), t = Fe(), n = {
    alg: "RS256",
    typ: "JWT"
  };
  class r {
    email;
    key;
    keyId;
    projectId;
    eagerRefreshThresholdMillis;
    cache = new t.LRUCache({
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
    constructor(o, a, l, d) {
      this.email = o, this.key = a, this.keyId = l, this.eagerRefreshThresholdMillis = d ?? 300 * 1e3;
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
      const d = this.getCachedKey(o, l), c = this.cache.get(d), f = Date.now();
      if (c && c.expiration - f > this.eagerRefreshThresholdMillis)
        return new Headers(c.headers);
      const p = Math.floor(Date.now() / 1e3), h = r.getExpirationTime(p);
      let g;
      if (Array.isArray(l) && (l = l.join(" ")), l ? g = {
        iss: this.email,
        sub: this.email,
        scope: l,
        exp: h,
        iat: p
      } : g = {
        iss: this.email,
        sub: this.email,
        aud: o,
        exp: h,
        iat: p
      }, a) {
        for (const C in g)
          if (a[C])
            throw new Error(`The '${C}' property is not allowed when passing additionalClaims. This claim is included in the JWT by default.`);
      }
      const m = this.keyId ? { ...n, kid: this.keyId } : n, v = Object.assign(g, a), E = e.sign({ header: m, payload: v, secret: this.key }), T = new Headers({ authorization: `Bearer ${E}` });
      return this.cache.set(d, {
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
        let d = "";
        o.setEncoding("utf8").on("data", (c) => d += c).on("error", l).on("end", () => {
          try {
            const c = JSON.parse(d);
            this.fromJSON(c), a();
          } catch (c) {
            l(c);
          }
        });
      });
    }
  }
  return Vt.JWTAccess = r, Vt;
}
var ms;
function $a() {
  if (ms) return Ft;
  ms = 1, Object.defineProperty(Ft, "__esModule", { value: !0 }), Ft.JWT = void 0;
  const e = Va(), t = Ha(), n = Ja(), r = _t(), i = Pe();
  class o extends r.OAuth2Client {
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
      const d = new o(this);
      return d.scopes = l, d;
    }
    /**
     * Obtains the metadata to be sent with the request.
     *
     * @param url the URI being authorized.
     */
    async getRequestMetadataAsync(l) {
      l = this.defaultServicePath ? `https://${this.defaultServicePath}/` : l;
      const d = !this.hasUserScopes() && l || this.useJWTAccessWithScope && this.hasAnyScopes() || this.universeDomain !== i.DEFAULT_UNIVERSE;
      if (this.subject && this.universeDomain !== i.DEFAULT_UNIVERSE)
        throw new RangeError(`Service Account user is configured for the credential. Domain-wide delegation is not supported in universes other than ${i.DEFAULT_UNIVERSE}`);
      if (!this.apiKey && d)
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
          const f = this.useJWTAccessWithScope || this.universeDomain !== i.DEFAULT_UNIVERSE, p = await this.access.getRequestHeaders(
            l ?? void 0,
            this.additionalClaims,
            // Scopes take precedent over audience for signing,
            // so we only provide them if `useJWTAccessWithScope` is on or
            // if we are in a non-default universe
            f ? c : void 0
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
      const d = new e.GoogleToken({
        iss: this.email,
        sub: this.subject,
        scope: this.scopes || this.defaultScopes,
        keyFile: this.keyFile,
        key: this.key,
        additionalClaims: { target_audience: l },
        transporter: this.transporter
      });
      if (await d.getToken({
        forceRefresh: !0
      }), !d.idToken)
        throw new Error("Unknown error: Failed to fetch ID token");
      return d.idToken;
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
        this.authorizeAsync().then((d) => l(null, d), l);
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
      return this.gtoken || (this.gtoken = new e.GoogleToken({
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
    fromStream(l, d) {
      if (d)
        this.fromStreamAsync(l).then(() => d(), d);
      else
        return this.fromStreamAsync(l);
    }
    fromStreamAsync(l) {
      return new Promise((d, c) => {
        if (!l)
          throw new Error("Must pass in a stream containing the service account auth settings.");
        let f = "";
        l.setEncoding("utf8").on("error", c).on("data", (p) => f += p).on("end", () => {
          try {
            const p = JSON.parse(f);
            this.fromJSON(p), d();
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
        const l = await (0, t.getCredentials)(this.keyFile);
        return { private_key: l.privateKey, client_email: l.clientEmail };
      }
      throw new Error("A key or a keyFile must be provided to getCredentials.");
    }
  }
  return Ft.JWT = o, Ft;
}
var tt = {}, ys;
function Wa() {
  if (ys) return tt;
  ys = 1, Object.defineProperty(tt, "__esModule", { value: !0 }), tt.UserRefreshClient = tt.USER_REFRESH_ACCOUNT_TYPE = void 0;
  const e = _t(), t = Pe();
  tt.USER_REFRESH_ACCOUNT_TYPE = "authorized_user";
  class n extends e.OAuth2Client {
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
    constructor(i, o, a, l, d) {
      const c = i && typeof i == "object" ? i : {
        clientId: i,
        clientSecret: o,
        refreshToken: a,
        eagerRefreshThresholdMillis: l,
        forceRefreshOnFailure: d
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
    async fetchIdToken(i) {
      const o = {
        ...n.RETRY_CONFIG,
        url: this.endpoints.oauth2TokenUrl,
        method: "POST",
        data: new URLSearchParams({
          client_id: this._clientId,
          client_secret: this._clientSecret,
          grant_type: "refresh_token",
          refresh_token: this._refreshToken,
          target_audience: i
        }),
        responseType: "json"
      };
      return t.AuthClient.setMethodName(o, "fetchIdToken"), (await this.transporter.request(o)).data.id_token;
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */
    fromJSON(i) {
      if (!i)
        throw new Error("Must pass in a JSON object containing the user refresh token");
      if (i.type !== "authorized_user")
        throw new Error('The incoming JSON object does not have the "authorized_user" type');
      if (!i.client_id)
        throw new Error("The incoming JSON object does not contain a client_id field");
      if (!i.client_secret)
        throw new Error("The incoming JSON object does not contain a client_secret field");
      if (!i.refresh_token)
        throw new Error("The incoming JSON object does not contain a refresh_token field");
      this._clientId = i.client_id, this._clientSecret = i.client_secret, this._refreshToken = i.refresh_token, this.credentials.refresh_token = i.refresh_token, this.quotaProjectId = i.quota_project_id, this.universeDomain = i.universe_domain || this.universeDomain;
    }
    fromStream(i, o) {
      if (o)
        this.fromStreamAsync(i).then(() => o(), o);
      else
        return this.fromStreamAsync(i);
    }
    async fromStreamAsync(i) {
      return new Promise((o, a) => {
        if (!i)
          return a(new Error("Must pass in a stream containing the user refresh token."));
        let l = "";
        i.setEncoding("utf8").on("error", a).on("data", (d) => l += d).on("end", () => {
          try {
            const d = JSON.parse(l);
            return this.fromJSON(d), o();
          } catch (d) {
            return a(d);
          }
        });
      });
    }
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param json The input object.
     */
    static fromJSON(i) {
      const o = new n();
      return o.fromJSON(i), o;
    }
  }
  return tt.UserRefreshClient = n, tt;
}
var nt = {}, _s;
function Ka() {
  if (_s) return nt;
  _s = 1, Object.defineProperty(nt, "__esModule", { value: !0 }), nt.Impersonated = nt.IMPERSONATED_ACCOUNT_TYPE = void 0;
  const e = _t(), t = ve(), n = Fe();
  nt.IMPERSONATED_ACCOUNT_TYPE = "impersonated_service_account";
  class r extends e.OAuth2Client {
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
      }, this.sourceClient = o.sourceClient ?? new e.OAuth2Client(), this.targetPrincipal = o.targetPrincipal ?? "", this.delegates = o.delegates ?? [], this.targetScopes = o.targetScopes ?? [], this.lifetime = o.lifetime ?? 3600, !!!(0, n.originalOrCamelOptions)(o).get("universe_domain"))
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
      const a = `projects/-/serviceAccounts/${this.targetPrincipal}`, l = `${this.endpoint}/v1/${a}:signBlob`, d = {
        delegates: this.delegates,
        payload: Buffer.from(o).toString("base64")
      };
      return (await this.sourceClient.request({
        ...r.RETRY_CONFIG,
        url: l,
        data: d,
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
        }, d = await this.sourceClient.request({
          ...r.RETRY_CONFIG,
          url: a,
          data: l,
          method: "POST"
        }), c = d.data;
        return this.credentials.access_token = c.accessToken, this.credentials.expiry_date = Date.parse(c.expireTime), {
          tokens: this.credentials,
          res: d
        };
      } catch (o) {
        if (!(o instanceof Error))
          throw o;
        let a = 0, l = "";
        throw o instanceof t.GaxiosError && (a = o?.response?.data?.error?.status, l = o?.response?.data?.error?.message), a && l ? (o.message = `${a}: unable to impersonate: ${l}`, o) : (o.message = `unable to impersonate: ${o}`, o);
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
      const l = `projects/-/serviceAccounts/${this.targetPrincipal}`, d = `${this.endpoint}/v1/${l}:generateIdToken`, c = {
        delegates: this.delegates,
        audience: o,
        includeEmail: a?.includeEmail ?? !0,
        useEmailAzp: a?.includeEmail ?? !0
      };
      return (await this.sourceClient.request({
        ...r.RETRY_CONFIG,
        url: d,
        data: c,
        method: "POST"
      })).data.token;
    }
  }
  return nt.Impersonated = r, nt;
}
var Jt = {}, dr = {}, $t = {}, dt = {}, vs;
function Ya() {
  if (vs) return dt;
  vs = 1, Object.defineProperty(dt, "__esModule", { value: !0 }), dt.OAuthClientAuthHandler = void 0, dt.getErrorFromOAuthErrorResponse = i;
  const e = ve(), t = Ln(), n = ["PUT", "POST", "PATCH"];
  class r {
    #e = (0, t.createCrypto)();
    #t;
    transporter;
    /**
     * Instantiates an OAuth client authentication handler.
     * @param options The OAuth Client Auth Handler instance options. Passing an `ClientAuthentication` directly is **@DEPRECATED**.
     */
    constructor(a) {
      a && "clientId" in a ? (this.#t = a, this.transporter = new e.Gaxios()) : (this.#t = a?.clientAuthentication, this.transporter = a?.transporter || new e.Gaxios());
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
      a.headers = e.Gaxios.mergeHeaders(a.headers), this.injectAuthenticatedHeaders(a, l), l || this.injectAuthenticatedRequestBody(a);
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
        a.headers = e.Gaxios.mergeHeaders(a.headers, {
          authorization: `Bearer ${l}`
        });
      else if (this.#t?.confidentialClientType === "basic") {
        a.headers = e.Gaxios.mergeHeaders(a.headers);
        const d = this.#t.clientId, c = this.#t.clientSecret || "", f = this.#e.encodeBase64StringUtf8(`${d}:${c}`);
        e.Gaxios.mergeHeaders(a.headers, {
          authorization: `Basic ${f}`
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
          const f = new URLSearchParams(a.data ?? "");
          f.append("client_id", this.#t.clientId), f.append("client_secret", this.#t.clientSecret || ""), a.data = f;
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
  dt.OAuthClientAuthHandler = r;
  function i(o, a) {
    const l = o.error, d = o.error_description, c = o.error_uri;
    let f = `Error code ${l}`;
    typeof d < "u" && (f += `: ${d}`), typeof c < "u" && (f += ` - ${c}`);
    const p = new Error(f);
    if (a) {
      const h = Object.keys(a);
      a.stack && h.push("stack"), h.forEach((g) => {
        g !== "message" && Object.defineProperty(p, g, {
          value: a[g],
          writable: !1,
          enumerable: !0
        });
      });
    }
    return p;
  }
  return dt;
}
var Es;
function ro() {
  if (Es) return $t;
  Es = 1, Object.defineProperty($t, "__esModule", { value: !0 }), $t.StsCredentials = void 0;
  const e = ve(), t = Pe(), n = Ya(), r = Fe();
  class i extends n.OAuthClientAuthHandler {
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
    async exchangeToken(a, l, d) {
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
        options: d && JSON.stringify(d)
      }, f = {
        ...i.RETRY_CONFIG,
        url: this.#e.toString(),
        method: "POST",
        headers: l,
        data: new URLSearchParams((0, r.removeUndefinedValuesInObject)(c)),
        responseType: "json"
      };
      t.AuthClient.setMethodName(f, "exchangeToken"), this.applyClientAuthenticationOptions(f);
      try {
        const p = await this.transporter.request(f), h = p.data;
        return h.res = p, h;
      } catch (p) {
        throw p instanceof e.GaxiosError && p.response ? (0, n.getErrorFromOAuthErrorResponse)(
          p.response.data,
          // Preserve other fields from the original error.
          p
        ) : p;
      }
    }
  }
  return $t.StsCredentials = i, $t;
}
var Ts;
function ut() {
  return Ts || (Ts = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.BaseExternalAccountClient = e.CLOUD_RESOURCE_MANAGER = e.EXTERNAL_ACCOUNT_TYPE = e.EXPIRATION_TIME_OFFSET = void 0;
    const t = ve(), n = we, r = Pe(), i = ro(), o = Fe(), a = Da(), l = "urn:ietf:params:oauth:grant-type:token-exchange", d = "urn:ietf:params:oauth:token-type:access_token", c = "https://www.googleapis.com/auth/cloud-platform", f = 3600;
    e.EXPIRATION_TIME_OFFSET = 300 * 1e3, e.EXTERNAL_ACCOUNT_TYPE = "external_account", e.CLOUD_RESOURCE_MANAGER = "https://cloudresourcemanager.googleapis.com/v1/projects/";
    const p = "//iam\\.googleapis\\.com/locations/[^/]+/workforcePools/[^/]+/providers/.+", h = "https://sts.{universeDomain}/v1/token";
    class g extends r.AuthClient {
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
        if (T && T !== e.EXTERNAL_ACCOUNT_TYPE)
          throw new Error(`Expected "${e.EXTERNAL_ACCOUNT_TYPE}" type but received "${v.type}"`);
        const C = E.get("client_id"), w = E.get("client_secret");
        this.tokenUrl = E.get("token_url") ?? h.replace("{universeDomain}", this.universeDomain);
        const D = E.get("subject_token_type"), _ = E.get("workforce_pool_user_project"), y = E.get("service_account_impersonation_url"), S = E.get("service_account_impersonation"), R = (0, o.originalOrCamelOptions)(S).get("token_lifetime_seconds");
        this.cloudResourceManagerURL = new URL(E.get("cloud_resource_manager_url") || `https://cloudresourcemanager.${this.universeDomain}/v1/projects/`), C && (this.clientAuth = {
          confidentialClientType: "basic",
          clientId: C,
          clientSecret: w
        }), this.stsCredential = new i.StsCredentials({
          tokenExchangeEndpoint: this.tokenUrl,
          clientAuthentication: this.clientAuth
        }), this.scopes = E.get("scopes") || [c], this.cachedAccessToken = null, this.audience = E.get("audience"), this.subjectTokenType = D, this.workforcePoolUserProject = _;
        const P = new RegExp(p);
        if (this.workforcePoolUserProject && !this.audience.match(P))
          throw new Error("workforcePoolUserProject should not be set for non-workforce pool credentials.");
        this.serviceAccountImpersonationUrl = y, this.serviceAccountImpersonationLifetime = R, this.serviceAccountImpersonationLifetime ? this.configLifetimeRequested = !0 : (this.configLifetimeRequested = !1, this.serviceAccountImpersonationLifetime = f), this.projectNumber = this.getProjectNumber(this.audience), this.supplierContext = {
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
            ...g.RETRY_CONFIG,
            headers: E,
            url: `${this.cloudResourceManagerURL.toString()}${v}`,
            responseType: "json"
          };
          r.AuthClient.setMethodName(T, "getProjectId");
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
          v.headers = t.Gaxios.mergeHeaders(v.headers), this.addUserProjectAndAuthHeaders(v.headers, C), T = await this.transporter.request(v);
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
          requestedTokenType: d,
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
          ...g.RETRY_CONFIG,
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
        r.AuthClient.setMethodName(E, "getImpersonatedAccessToken");
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
    e.BaseExternalAccountClient = g;
  })(dr)), dr;
}
var Wt = {}, Kt = {}, Ss;
function Ku() {
  if (Ss) return Kt;
  Ss = 1, Object.defineProperty(Kt, "__esModule", { value: !0 }), Kt.FileSubjectTokenSupplier = void 0;
  const e = ct, t = lt, n = (0, e.promisify)(t.readFile ?? (() => {
  })), r = (0, e.promisify)(t.realpath ?? (() => {
  })), i = (0, e.promisify)(t.lstat ?? (() => {
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
        if (l = await r(l), !(await i(l)).isFile())
          throw new Error();
      } catch (f) {
        throw f instanceof Error && (f.message = `The file at ${l} does not exist, or it is not a file. ${f.message}`), f;
      }
      let d;
      const c = await n(l, { encoding: "utf8" });
      if (this.formatType === "text" ? d = c : this.formatType === "json" && this.subjectTokenFieldName && (d = JSON.parse(c)[this.subjectTokenFieldName]), !d)
        throw new Error("Unable to parse the subject_token from the credential_source file");
      return d;
    }
  }
  return Kt.FileSubjectTokenSupplier = o, Kt;
}
var Yt = {}, Cs;
function Yu() {
  if (Cs) return Yt;
  Cs = 1, Object.defineProperty(Yt, "__esModule", { value: !0 }), Yt.UrlSubjectTokenSupplier = void 0;
  const e = Pe();
  class t {
    url;
    headers;
    formatType;
    subjectTokenFieldName;
    additionalGaxiosOptions;
    /**
     * Instantiates a URL subject token supplier.
     * @param opts The URL subject token supplier options to build the supplier with.
     */
    constructor(r) {
      this.url = r.url, this.formatType = r.formatType, this.subjectTokenFieldName = r.subjectTokenFieldName, this.headers = r.headers, this.additionalGaxiosOptions = r.additionalGaxiosOptions;
    }
    /**
     * Sends a GET request to the URL provided in the constructor and resolves
     * with the returned external subject token.
     * @param context {@link ExternalAccountSupplierContext} from the calling
     *   {@link IdentityPoolClient}, contains the requested audience and subject
     *   token type for the external account identity. Not used.
     */
    async getSubjectToken(r) {
      const i = {
        ...this.additionalGaxiosOptions,
        url: this.url,
        method: "GET",
        headers: this.headers,
        responseType: this.formatType
      };
      e.AuthClient.setMethodName(i, "getSubjectToken");
      let o;
      if (this.formatType === "text" ? o = (await r.transporter.request(i)).data : this.formatType === "json" && this.subjectTokenFieldName && (o = (await r.transporter.request(i)).data[this.subjectTokenFieldName]), !o)
        throw new Error("Unable to parse the subject_token from the credential_source URL");
      return o;
    }
  }
  return Yt.UrlSubjectTokenSupplier = t, Yt;
}
var fr = {}, As;
function zu() {
  return As || (As = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.CertificateSubjectTokenSupplier = e.InvalidConfigurationError = e.CertificateSourceUnavailableError = e.CERTIFICATE_CONFIGURATION_ENV_VARIABLE = void 0;
    const t = Fe(), n = lt, r = yt, i = eo;
    e.CERTIFICATE_CONFIGURATION_ENV_VARIABLE = "GOOGLE_API_CERTIFICATE_CONFIG";
    class o extends Error {
      constructor(c) {
        super(c), this.name = "CertificateSourceUnavailableError";
      }
    }
    e.CertificateSourceUnavailableError = o;
    class a extends Error {
      constructor(c) {
        super(c), this.name = "InvalidConfigurationError";
      }
    }
    e.InvalidConfigurationError = a;
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
        return new i.Agent({ key: this.key, cert: this.cert });
      }
      /**
       * Constructs the subject token, which is the base64-encoded certificate chain.
       * @returns A promise that resolves with the subject token.
       */
      async getSubjectToken() {
        this.certificateConfigPath = await this.#e();
        const { certPath: c, keyPath: f } = await this.#t();
        return { cert: this.cert, key: this.key } = await this.#n(c, f), await this.#r(this.cert);
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
          if (await (0, t.isValidFile)(c))
            return c;
          throw new o(`Provided certificate config path is invalid: ${c}`);
        }
        const f = process.env[e.CERTIFICATE_CONFIGURATION_ENV_VARIABLE];
        if (f) {
          if (await (0, t.isValidFile)(f))
            return f;
          throw new o(`Path from environment variable "${e.CERTIFICATE_CONFIGURATION_ENV_VARIABLE}" is invalid: ${f}`);
        }
        const p = (0, t.getWellKnownCertificateConfigFileLocation)();
        if (await (0, t.isValidFile)(p))
          return p;
        throw new o(`Could not find certificate configuration file. Searched override path, the "${e.CERTIFICATE_CONFIGURATION_ENV_VARIABLE}" env var, and the gcloud path (${p}).`);
      }
      /**
       * Reads and parses the certificate config JSON file to extract the certificate and key paths.
       * @returns An object containing the certificate and key paths.
       */
      async #t() {
        const c = this.certificateConfigPath;
        let f;
        try {
          f = await n.promises.readFile(c, "utf8");
        } catch {
          throw new o(`Failed to read certificate config file at: ${c}`);
        }
        try {
          const p = JSON.parse(f), h = p?.cert_configs?.workload?.cert_path, g = p?.cert_configs?.workload?.key_path;
          if (!h || !g)
            throw new a(`Certificate config file (${c}) is missing required "cert_path" or "key_path" in the workload config.`);
          return { certPath: h, keyPath: g };
        } catch (p) {
          throw p instanceof a ? p : new a(`Failed to parse certificate config from ${c}: ${p.message}`);
        }
      }
      /**
       * Reads and parses the cert and key files get their content and check valid format.
       * @returns An object containing the cert content and key content in buffer format.
       */
      async #n(c, f) {
        let p, h;
        try {
          p = await n.promises.readFile(c), new r.X509Certificate(p);
        } catch (g) {
          const m = g instanceof Error ? g.message : String(g);
          throw new o(`Failed to read certificate file at ${c}: ${m}`);
        }
        try {
          h = await n.promises.readFile(f), (0, r.createPrivateKey)(h);
        } catch (g) {
          const m = g instanceof Error ? g.message : String(g);
          throw new o(`Failed to read private key file at ${f}: ${m}`);
        }
        return { cert: p, key: h };
      }
      /**
       * Reads the leaf certificate and trust chain, combines them,
       * and returns a JSON array of base64-encoded certificates.
       * @returns A stringified JSON array of the certificate chain.
       */
      async #r(c) {
        const f = new r.X509Certificate(c);
        if (!this.trustChainPath)
          return JSON.stringify([f.raw.toString("base64")]);
        try {
          const g = ((await n.promises.readFile(this.trustChainPath, "utf8")).match(/-----BEGIN CERTIFICATE-----[^-]+-----END CERTIFICATE-----/g) ?? []).map((E, T) => {
            try {
              return new r.X509Certificate(E);
            } catch (C) {
              const w = C instanceof Error ? C.message : String(C);
              throw new a(`Failed to parse certificate at index ${T} in trust chain file ${this.trustChainPath}: ${w}`);
            }
          }), m = g.findIndex((E) => f.raw.equals(E.raw));
          let v;
          if (m === -1)
            v = [f, ...g];
          else if (m === 0)
            v = g;
          else
            throw new a(`Leaf certificate exists in the trust chain but is not the first entry (found at index ${m}).`);
          return JSON.stringify(v.map((E) => E.raw.toString("base64")));
        } catch (p) {
          if (p instanceof a)
            throw p;
          const h = p instanceof Error ? p.message : String(p);
          throw new o(`Failed to process certificate chain from ${this.trustChainPath}: ${h}`);
        }
      }
    }
    e.CertificateSubjectTokenSupplier = l;
  })(fr)), fr;
}
var ws;
function za() {
  if (ws) return Wt;
  ws = 1, Object.defineProperty(Wt, "__esModule", { value: !0 }), Wt.IdentityPoolClient = void 0;
  const e = ut(), t = Fe(), n = Ku(), r = Yu(), i = zu(), o = ro(), a = ve();
  class l extends e.BaseExternalAccountClient {
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
      const f = (0, t.originalOrCamelOptions)(c), p = f.get("credential_source"), h = f.get("subject_token_supplier");
      if (!p && !h)
        throw new Error("A credential source or subject token supplier must be specified.");
      if (p && h)
        throw new Error("Only one of credential source or subject token supplier can be specified.");
      if (h)
        this.subjectTokenSupplier = h, this.credentialSourceType = "programmatic";
      else {
        const g = (0, t.originalOrCamelOptions)(p), m = (0, t.originalOrCamelOptions)(g.get("format")), v = m.get("type") || "text", E = m.get("subject_token_field_name");
        if (v !== "json" && v !== "text")
          throw new Error(`Invalid credential_source format "${v}"`);
        if (v === "json" && !E)
          throw new Error("Missing subject_token_field_name for JSON credential_source format");
        const T = g.get("file"), C = g.get("url"), w = g.get("certificate"), D = g.get("headers");
        if (T && C || C && w || T && w)
          throw new Error('No valid Identity Pool "credential_source" provided, must be either file, url, or certificate.');
        if (T)
          this.credentialSourceType = "file", this.subjectTokenSupplier = new n.FileSubjectTokenSupplier({
            filePath: T,
            formatType: v,
            subjectTokenFieldName: E
          });
        else if (C)
          this.credentialSourceType = "url", this.subjectTokenSupplier = new r.UrlSubjectTokenSupplier({
            url: C,
            formatType: v,
            subjectTokenFieldName: E,
            headers: D,
            additionalGaxiosOptions: l.RETRY_CONFIG
          });
        else if (w) {
          this.credentialSourceType = "certificate";
          const _ = new i.CertificateSubjectTokenSupplier({
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
      if (this.subjectTokenSupplier instanceof i.CertificateSubjectTokenSupplier) {
        const f = await this.subjectTokenSupplier.createMtlsHttpsAgent();
        this.stsCredential = new o.StsCredentials({
          tokenExchangeEndpoint: this.getTokenUrl(),
          clientAuthentication: this.clientAuth,
          transporter: new a.Gaxios({ agent: f })
        }), this.transporter = new a.Gaxios({
          ...this.transporter.defaults || {},
          agent: f
        });
      }
      return c;
    }
  }
  return Wt.IdentityPoolClient = l, Wt;
}
var zt = {}, Xt = {}, Is;
function Xa() {
  if (Is) return Xt;
  Is = 1, Object.defineProperty(Xt, "__esModule", { value: !0 }), Xt.AwsRequestSigner = void 0;
  const e = ve(), t = Ln(), n = "AWS4-HMAC-SHA256", r = "aws4_request";
  class i {
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
    constructor(c, f) {
      this.getCredentials = c, this.region = f, this.crypto = (0, t.createCrypto)();
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
      const f = typeof c.data == "object" ? JSON.stringify(c.data) : c.data, p = c.url, h = c.method || "GET", g = c.body || f, m = c.headers, v = await this.getCredentials(), E = new URL(p);
      if (typeof g != "string" && g !== void 0)
        throw new TypeError(`'requestPayload' is expected to be a string if provided. Got: ${g}`);
      const T = await l({
        crypto: this.crypto,
        host: E.host,
        canonicalUri: E.pathname,
        canonicalQuerystring: E.search.slice(1),
        method: h,
        region: this.region,
        securityCredentials: v,
        requestPayload: g,
        additionalAmzHeaders: m
      }), C = e.Gaxios.mergeHeaders(
        // Add x-amz-date if available.
        T.amzDate ? { "x-amz-date": T.amzDate } : {},
        {
          authorization: T.authorizationHeader,
          host: E.host
        },
        m || {}
      );
      v.token && e.Gaxios.mergeHeaders(C, {
        "x-amz-security-token": v.token
      });
      const w = {
        url: p,
        method: h,
        headers: C
      };
      return g !== void 0 && (w.body = g), w;
    }
  }
  Xt.AwsRequestSigner = i;
  async function o(d, c, f) {
    return await d.signWithHmacSha256(c, f);
  }
  async function a(d, c, f, p, h) {
    const g = await o(d, `AWS4${c}`, f), m = await o(d, g, p), v = await o(d, m, h);
    return await o(d, v, "aws4_request");
  }
  async function l(d) {
    const c = e.Gaxios.mergeHeaders(d.additionalAmzHeaders), f = d.requestPayload || "", p = d.host.split(".")[0], h = /* @__PURE__ */ new Date(), g = h.toISOString().replace(/[-:]/g, "").replace(/\.[0-9]+/, ""), m = h.toISOString().replace(/[-]/g, "").replace(/T.*/, "");
    d.securityCredentials.token && c.set("x-amz-security-token", d.securityCredentials.token);
    const v = e.Gaxios.mergeHeaders(
      {
        host: d.host
      },
      // Previously the date was not fixed with x-amz- and could be provided manually.
      // https://github.com/boto/botocore/blob/879f8440a4e9ace5d3cf145ce8b3d5e5ffb892ef/tests/unit/auth/aws4_testsuite/get-header-value-trim.req
      c.has("date") ? {} : { "x-amz-date": g },
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
    const C = T.join(";"), w = await d.crypto.sha256DigestHex(f), D = `${d.method.toUpperCase()}
${d.canonicalUri}
${d.canonicalQuerystring}
${E}
${C}
${w}`, _ = `${m}/${d.region}/${p}/${r}`, y = `${n}
${g}
${_}
` + await d.crypto.sha256DigestHex(D), S = await a(d.crypto, d.securityCredentials.secretAccessKey, m, d.region, p), R = await o(d.crypto, S, y), P = `${n} Credential=${d.securityCredentials.accessKeyId}/${_}, SignedHeaders=${C}, Signature=${(0, t.fromArrayBufferToHex)(R)}`;
    return {
      // Do not return x-amz-date if date is available.
      amzDate: c.has("date") ? void 0 : g,
      authorizationHeader: P,
      canonicalQuerystring: d.canonicalQuerystring
    };
  }
  return Xt;
}
var Qt = {}, Rs;
function Xu() {
  if (Rs) return Qt;
  Rs = 1, Object.defineProperty(Qt, "__esModule", { value: !0 }), Qt.DefaultAwsSecurityCredentialsSupplier = void 0;
  const e = Pe();
  class t {
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
    constructor(r) {
      this.regionUrl = r.regionUrl, this.securityCredentialsUrl = r.securityCredentialsUrl, this.imdsV2SessionTokenUrl = r.imdsV2SessionTokenUrl, this.additionalGaxiosOptions = r.additionalGaxiosOptions;
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
    async getAwsRegion(r) {
      if (this.#r)
        return this.#r;
      const i = new Headers();
      if (!this.#r && this.imdsV2SessionTokenUrl && i.set("x-aws-ec2-metadata-token", await this.#e(r.transporter)), !this.regionUrl)
        throw new RangeError('Unable to determine AWS region due to missing "options.credential_source.region_url"');
      const o = {
        ...this.additionalGaxiosOptions,
        url: this.regionUrl,
        method: "GET",
        responseType: "text",
        headers: i
      };
      e.AuthClient.setMethodName(o, "getAwsRegion");
      const a = await r.transporter.request(o);
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
    async getAwsSecurityCredentials(r) {
      if (this.#i)
        return this.#i;
      const i = new Headers();
      this.imdsV2SessionTokenUrl && i.set("x-aws-ec2-metadata-token", await this.#e(r.transporter));
      const o = await this.#t(i, r.transporter), a = await this.#n(o, i, r.transporter);
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
    async #e(r) {
      const i = {
        ...this.additionalGaxiosOptions,
        url: this.imdsV2SessionTokenUrl,
        method: "PUT",
        responseType: "text",
        headers: { "x-aws-ec2-metadata-token-ttl-seconds": "300" }
      };
      return e.AuthClient.setMethodName(i, "#getImdsV2SessionToken"), (await r.request(i)).data;
    }
    /**
     * @param headers The headers to be used in the metadata request.
     * @param transporter The transporter to use for requests.
     * @return A promise that resolves with the assigned role to the current
     *   AWS VM. This is needed for calling the security-credentials endpoint.
     */
    async #t(r, i) {
      if (!this.securityCredentialsUrl)
        throw new Error('Unable to determine AWS role name due to missing "options.credential_source.url"');
      const o = {
        ...this.additionalGaxiosOptions,
        url: this.securityCredentialsUrl,
        method: "GET",
        responseType: "text",
        headers: r
      };
      return e.AuthClient.setMethodName(o, "#getAwsRoleName"), (await i.request(o)).data;
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
    async #n(r, i, o) {
      const a = {
        ...this.additionalGaxiosOptions,
        url: `${this.securityCredentialsUrl}/${r}`,
        headers: i,
        responseType: "json"
      };
      return e.AuthClient.setMethodName(a, "#retrieveAwsSecurityCredentials"), (await o.request(a)).data;
    }
    get #r() {
      return process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null;
    }
    get #i() {
      return process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        token: process.env.AWS_SESSION_TOKEN
      } : null;
    }
  }
  return Qt.DefaultAwsSecurityCredentialsSupplier = t, Qt;
}
var Ps;
function Qa() {
  if (Ps) return zt;
  Ps = 1, Object.defineProperty(zt, "__esModule", { value: !0 }), zt.AwsClient = void 0;
  const e = Xa(), t = ut(), n = Xu(), r = Fe(), i = ve();
  class o extends t.BaseExternalAccountClient {
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
      const d = (0, r.originalOrCamelOptions)(l), c = d.get("credential_source"), f = d.get("aws_security_credentials_supplier");
      if (!c && !f)
        throw new Error("A credential source or AWS security credentials supplier must be specified.");
      if (c && f)
        throw new Error("Only one of credential source or AWS security credentials supplier can be specified.");
      if (f)
        this.awsSecurityCredentialsSupplier = f, this.regionalCredVerificationUrl = o.#e, this.credentialSourceType = "programmatic";
      else {
        const p = (0, r.originalOrCamelOptions)(c);
        this.environmentId = p.get("environment_id");
        const h = p.get("region_url"), g = p.get("url"), m = p.get("imdsv2_session_token_url");
        this.awsSecurityCredentialsSupplier = new n.DefaultAwsSecurityCredentialsSupplier({
          regionUrl: h,
          securityCredentialsUrl: g,
          imdsV2SessionTokenUrl: m
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
      this.awsRequestSigner || (this.region = await this.awsSecurityCredentialsSupplier.getAwsRegion(this.supplierContext), this.awsRequestSigner = new e.AwsRequestSigner(async () => this.awsSecurityCredentialsSupplier.getAwsSecurityCredentials(this.supplierContext), this.region));
      const l = await this.awsRequestSigner.getRequestOptions({
        ...o.RETRY_CONFIG,
        url: this.regionalCredVerificationUrl.replace("{region}", this.region),
        method: "POST"
      }), d = [];
      return i.Gaxios.mergeHeaders({
        // The full, canonical resource name of the workload identity pool
        // provider, with or without the HTTPS prefix.
        // Including this header as part of the signature is recommended to
        // ensure data integrity.
        "x-goog-cloud-target-resource": this.audience
      }, l.headers).forEach((f, p) => d.push({ key: p, value: f })), encodeURIComponent(JSON.stringify({
        url: l.url,
        method: l.method,
        headers: d
      }));
    }
  }
  return zt.AwsClient = o, zt;
}
var hr = {}, he = {}, Ns;
function Za() {
  if (Ns) return he;
  Ns = 1, Object.defineProperty(he, "__esModule", { value: !0 }), he.InvalidSubjectTokenError = he.InvalidMessageFieldError = he.InvalidCodeFieldError = he.InvalidTokenTypeFieldError = he.InvalidExpirationTimeFieldError = he.InvalidSuccessFieldError = he.InvalidVersionFieldError = he.ExecutableResponseError = he.ExecutableResponse = void 0;
  const e = "urn:ietf:params:oauth:token-type:saml2", t = "urn:ietf:params:oauth:token-type:id_token", n = "urn:ietf:params:oauth:token-type:jwt";
  class r {
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
    constructor(g) {
      if (!g.version)
        throw new o("Executable response must contain a 'version' field.");
      if (g.success === void 0)
        throw new a("Executable response must contain a 'success' field.");
      if (this.version = g.version, this.success = g.success, this.success) {
        if (this.expirationTime = g.expiration_time, this.tokenType = g.token_type, this.tokenType !== e && this.tokenType !== t && this.tokenType !== n)
          throw new d(`Executable response must contain a 'token_type' field when successful and it must be one of ${t}, ${n}, or ${e}.`);
        if (this.tokenType === e) {
          if (!g.saml_response)
            throw new p(`Executable response must contain a 'saml_response' field when token_type=${e}.`);
          this.subjectToken = g.saml_response;
        } else {
          if (!g.id_token)
            throw new p(`Executable response must contain a 'id_token' field when token_type=${t} or ${n}.`);
          this.subjectToken = g.id_token;
        }
      } else {
        if (!g.code)
          throw new c("Executable response must contain a 'code' field when unsuccessful.");
        if (!g.message)
          throw new f("Executable response must contain a 'message' field when unsuccessful.");
        this.errorCode = g.code, this.errorMessage = g.message;
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
  he.ExecutableResponse = r;
  class i extends Error {
    constructor(g) {
      super(g), Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  he.ExecutableResponseError = i;
  class o extends i {
  }
  he.InvalidVersionFieldError = o;
  class a extends i {
  }
  he.InvalidSuccessFieldError = a;
  class l extends i {
  }
  he.InvalidExpirationTimeFieldError = l;
  class d extends i {
  }
  he.InvalidTokenTypeFieldError = d;
  class c extends i {
  }
  he.InvalidCodeFieldError = c;
  class f extends i {
  }
  he.InvalidMessageFieldError = f;
  class p extends i {
  }
  return he.InvalidSubjectTokenError = p, he;
}
var rt = {}, ks;
function Ms() {
  if (ks) return rt;
  ks = 1, Object.defineProperty(rt, "__esModule", { value: !0 }), rt.PluggableAuthHandler = rt.ExecutableError = void 0;
  const e = Za(), t = Sa, n = lt;
  class r extends Error {
    /**
     * The exit code returned by the executable.
     */
    code;
    constructor(a, l) {
      super(`The executable failed with exit code: ${l} and error message: ${a}.`), this.code = l, Object.setPrototypeOf(this, new.target.prototype);
    }
  }
  rt.ExecutableError = r;
  class i {
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
      if (this.commandComponents = i.parseCommand(a.command), this.timeoutMillis = a.timeoutMillis, !this.timeoutMillis)
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
      return new Promise((l, d) => {
        const c = t.spawn(this.commandComponents[0], this.commandComponents.slice(1), {
          env: { ...process.env, ...Object.fromEntries(a) }
        });
        let f = "";
        c.stdout.on("data", (h) => {
          f += h;
        }), c.stderr.on("data", (h) => {
          f += h;
        });
        const p = setTimeout(() => (c.removeAllListeners(), c.kill(), d(new Error("The executable failed to finish within the timeout specified."))), this.timeoutMillis);
        c.on("close", (h) => {
          if (clearTimeout(p), h === 0)
            try {
              const g = JSON.parse(f), m = new e.ExecutableResponse(g);
              return l(m);
            } catch (g) {
              return g instanceof e.ExecutableResponseError ? d(g) : d(new e.ExecutableResponseError(`The executable returned an invalid response: ${f}`));
            }
          else
            return d(new r(f, h.toString()));
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
          const d = JSON.parse(l);
          return new e.ExecutableResponse(d).isValid() ? new e.ExecutableResponse(d) : void 0;
        } catch (d) {
          throw d instanceof e.ExecutableResponseError ? d : new e.ExecutableResponseError(`The output file contained an invalid response: ${l}`);
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
      for (let d = 0; d < l.length; d++)
        l[d][0] === '"' && l[d].slice(-1) === '"' && (l[d] = l[d].slice(1, -1));
      return l;
    }
  }
  return rt.PluggableAuthHandler = i, rt;
}
var xs;
function ja() {
  return xs || (xs = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.PluggableAuthClient = e.ExecutableError = void 0;
    const t = ut(), n = Za(), r = Ms();
    var i = Ms();
    Object.defineProperty(e, "ExecutableError", { enumerable: !0, get: function() {
      return i.ExecutableError;
    } });
    const o = 30 * 1e3, a = 5 * 1e3, l = 120 * 1e3, d = "GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES", c = 1;
    class f extends t.BaseExternalAccountClient {
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
        this.outputFile = h.credential_source.executable.output_file, this.handler = new r.PluggableAuthHandler({
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
        if (process.env[d] !== "1")
          throw new Error("Pluggable Auth executables need to be explicitly allowed to run by setting the GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES environment Variable to 1.");
        let h;
        if (this.outputFile && (h = await this.handler.retrieveCachedResponse()), !h) {
          const g = /* @__PURE__ */ new Map();
          g.set("GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE", this.audience), g.set("GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE", this.subjectTokenType), g.set("GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE", "0"), this.outputFile && g.set("GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE", this.outputFile);
          const m = this.getServiceAccountEmail();
          m && g.set("GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL", m), h = await this.handler.retrieveResponseFromExecutable(g);
        }
        if (h.version > c)
          throw new Error(`Version of executable is not currently supported, maximum supported version is ${c}.`);
        if (!h.success)
          throw new r.ExecutableError(h.errorMessage, h.errorCode);
        if (this.outputFile && !h.expirationTime)
          throw new n.InvalidExpirationTimeFieldError("The executable response must contain the `expiration_time` field for successful responses when an output_file has been specified in the configuration.");
        if (h.isExpired())
          throw new Error("Executable response is expired.");
        return h.subjectToken;
      }
    }
    e.PluggableAuthClient = f;
  })(hr)), hr;
}
var Ds;
function el() {
  if (Ds) return Jt;
  Ds = 1, Object.defineProperty(Jt, "__esModule", { value: !0 }), Jt.ExternalAccountClient = void 0;
  const e = ut(), t = za(), n = Qa(), r = ja();
  class i {
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
      return a && a.type === e.EXTERNAL_ACCOUNT_TYPE ? a.credential_source?.environment_id ? new n.AwsClient(a) : a.credential_source?.executable ? new r.PluggableAuthClient(a) : new t.IdentityPoolClient(a) : null;
    }
  }
  return Jt.ExternalAccountClient = i, Jt;
}
var it = {}, Us;
function tl() {
  if (Us) return it;
  Us = 1, Object.defineProperty(it, "__esModule", { value: !0 }), it.ExternalAccountAuthorizedUserClient = it.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = void 0;
  const e = Pe(), t = Ya(), n = ve(), r = we, i = ut();
  it.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = "external_account_authorized_user";
  const o = "https://sts.{universeDomain}/v1/oauthtoken";
  class a extends t.OAuthClientAuthHandler {
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
    async refreshToken(c, f) {
      const p = {
        ...a.RETRY_CONFIG,
        url: this.#e,
        method: "POST",
        headers: f,
        data: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: c
        }),
        responseType: "json"
      };
      e.AuthClient.setMethodName(p, "refreshToken"), this.applyClientAuthenticationOptions(p);
      try {
        const h = await this.transporter.request(p), g = h.data;
        return g.res = h, g;
      } catch (h) {
        throw h instanceof n.GaxiosError && h.response ? (0, t.getErrorFromOAuthErrorResponse)(
          h.response.data,
          // Preserve other fields from the original error.
          h
        ) : h;
      }
    }
  }
  class l extends e.AuthClient {
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
      const f = {
        confidentialClientType: "basic",
        clientId: c.client_id,
        clientSecret: c.client_secret
      };
      this.externalAccountAuthorizedUserHandler = new a({
        tokenRefreshEndpoint: c.token_url ?? o.replace("{universeDomain}", this.universeDomain),
        transporter: this.transporter,
        clientAuthentication: f
      }), this.cachedAccessToken = null, this.quotaProjectId = c.quota_project_id, typeof c?.eagerRefreshThresholdMillis != "number" ? this.eagerRefreshThresholdMillis = i.EXPIRATION_TIME_OFFSET : this.eagerRefreshThresholdMillis = c.eagerRefreshThresholdMillis, this.forceRefreshOnFailure = !!c?.forceRefreshOnFailure;
    }
    async getAccessToken() {
      return (!this.cachedAccessToken || this.isExpired(this.cachedAccessToken)) && await this.refreshAccessTokenAsync(), {
        token: this.cachedAccessToken.access_token,
        res: this.cachedAccessToken.res
      };
    }
    async getRequestHeaders() {
      const c = await this.getAccessToken(), f = new Headers({
        authorization: `Bearer ${c.token}`
      });
      return this.addSharedMetadataHeaders(f);
    }
    request(c, f) {
      if (f)
        this.requestAsync(c).then((p) => f(null, p), (p) => f(p, p.response));
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
    async requestAsync(c, f = !1) {
      let p;
      try {
        const h = await this.getRequestHeaders();
        c.headers = n.Gaxios.mergeHeaders(c.headers), this.addUserProjectAndAuthHeaders(c.headers, h), p = await this.transporter.request(c);
      } catch (h) {
        const g = h.response;
        if (g) {
          const m = g.status, v = g.config.data instanceof r.Readable;
          if (!f && (m === 401 || m === 403) && !v && this.forceRefreshOnFailure)
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
      const f = (/* @__PURE__ */ new Date()).getTime();
      return c.expiry_date ? f >= c.expiry_date - this.eagerRefreshThresholdMillis : !1;
    }
  }
  return it.ExternalAccountAuthorizedUserClient = l, it;
}
var bs;
function Qu() {
  return bs || (bs = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.GoogleAuth = e.GoogleAuthExceptionMessages = void 0;
    const t = Sa, n = lt, r = ve(), i = bn(), o = to, a = no, l = Ln(), d = ba(), c = La(), f = Oa(), p = $a(), h = Wa(), g = Ka(), m = el(), v = ut(), E = Pe(), T = tl(), C = Fe();
    e.GoogleAuthExceptionMessages = {
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
          throw new RangeError(e.GoogleAuthExceptionMessages.API_KEY_WITH_CREDENTIALS);
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
          if (_ instanceof Error && _.message === e.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND)
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
        throw new Error(e.GoogleAuthExceptionMessages.NO_PROJECT_ID_FOUND);
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
          _ = await i.universe("universe-domain"), _ ||= E.DEFAULT_UNIVERSE;
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
          return _.scopes = this.getAnyScopes(), await this.#t(new d.Compute(_));
        throw new Error(e.GoogleAuthExceptionMessages.NO_ADC_FOUND);
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
        return this.checkIsGCE === void 0 && (this.checkIsGCE = i.getGCPResidency() || await i.isAvailable()), this.checkIsGCE;
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
        if (_.type !== g.IMPERSONATED_ACCOUNT_TYPE)
          throw new Error(`The incoming JSON object does not have the "${g.IMPERSONATED_ACCOUNT_TYPE}" type`);
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
        return new g.Impersonated({
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
        return _.type === h.USER_REFRESH_ACCOUNT_TYPE ? (S = new h.UserRefreshClient(y), S.fromJSON(_)) : _.type === g.IMPERSONATED_ACCOUNT_TYPE ? S = this.fromImpersonatedJSON(_) : _.type === v.EXTERNAL_ACCOUNT_TYPE ? (S = m.ExternalAccountClient.fromJSON({
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
          (0, t.exec)("gcloud config config-helper --format json", (y, S) => {
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
          return await i.project("project-id");
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
        if (_ instanceof g.Impersonated)
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
            i.instance("service-accounts/default/email"),
            this.getUniverseDomain()
          ]);
          return { client_email: y, universe_domain: S };
        }
        throw new Error(e.GoogleAuthExceptionMessages.NO_CREDENTIALS_FOUND);
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
        return _.headers = r.Gaxios.mergeHeaders(_.headers, R), _;
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
        return (0, f.getEnv)();
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
        if (y = y || `https://iamcredentials.${R}/v1/projects/-/serviceAccounts/`, S instanceof g.Impersonated)
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
    e.GoogleAuth = w;
  })(Xn)), Xn;
}
var Zt = {}, Ls;
function Zu() {
  if (Ls) return Zt;
  Ls = 1, Object.defineProperty(Zt, "__esModule", { value: !0 }), Zt.IAMAuth = void 0;
  class e {
    selector;
    token;
    /**
     * IAM credentials.
     *
     * @param selector the iam authority selector
     * @param token the token
     * @constructor
     */
    constructor(n, r) {
      this.selector = n, this.token = r, this.selector = n, this.token = r;
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
  return Zt.IAMAuth = e, Zt;
}
var pr = {}, Os;
function ju() {
  return Os || (Os = 1, (function(e) {
    Object.defineProperty(e, "__esModule", { value: !0 }), e.DownscopedClient = e.EXPIRATION_TIME_OFFSET = e.MAX_ACCESS_BOUNDARY_RULES_COUNT = void 0;
    const t = ve(), n = we, r = Pe(), i = ro(), o = "urn:ietf:params:oauth:grant-type:token-exchange", a = "urn:ietf:params:oauth:token-type:access_token", l = "urn:ietf:params:oauth:token-type:access_token";
    e.MAX_ACCESS_BOUNDARY_RULES_COUNT = 10, e.EXPIRATION_TIME_OFFSET = 300 * 1e3;
    class d extends r.AuthClient {
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
      constructor(f, p = {
        accessBoundary: {
          accessBoundaryRules: []
        }
      }) {
        if (super(f instanceof r.AuthClient ? {} : f), f instanceof r.AuthClient ? (this.authClient = f, this.credentialAccessBoundary = p) : (this.authClient = f.authClient, this.credentialAccessBoundary = f.credentialAccessBoundary), this.credentialAccessBoundary.accessBoundary.accessBoundaryRules.length === 0)
          throw new Error("At least one access boundary rule needs to be defined.");
        if (this.credentialAccessBoundary.accessBoundary.accessBoundaryRules.length > e.MAX_ACCESS_BOUNDARY_RULES_COUNT)
          throw new Error(`The provided access boundary has more than ${e.MAX_ACCESS_BOUNDARY_RULES_COUNT} access boundary rules.`);
        for (const h of this.credentialAccessBoundary.accessBoundary.accessBoundaryRules)
          if (h.availablePermissions.length === 0)
            throw new Error("At least one permission should be defined in access boundary rules.");
        this.stsCredential = new i.StsCredentials({
          tokenExchangeEndpoint: `https://sts.${this.universeDomain}/v1/token`
        }), this.cachedDownscopedAccessToken = null;
      }
      /**
       * Provides a mechanism to inject Downscoped access tokens directly.
       * The expiry_date field is required to facilitate determination of the token
       * expiration which would make it easier for the token consumer to handle.
       * @param credentials The Credentials object to set on the current client.
       */
      setCredentials(f) {
        if (!f.expiry_date)
          throw new Error("The access token expiry_date field is missing in the provided credentials.");
        super.setCredentials(f), this.cachedDownscopedAccessToken = f;
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
        const f = await this.getAccessToken(), p = new Headers({
          authorization: `Bearer ${f.token}`
        });
        return this.addSharedMetadataHeaders(p);
      }
      request(f, p) {
        if (p)
          this.requestAsync(f).then((h) => p(null, h), (h) => p(h, h.response));
        else
          return this.requestAsync(f);
      }
      /**
       * Authenticates the provided HTTP request, processes it and resolves with the
       * returned response.
       * @param opts The HTTP request options.
       * @param reAuthRetried Whether the current attempt is a retry after a failed attempt due to an auth failure
       * @return A promise that resolves with the successful response.
       */
      async requestAsync(f, p = !1) {
        let h;
        try {
          const g = await this.getRequestHeaders();
          f.headers = t.Gaxios.mergeHeaders(f.headers), this.addUserProjectAndAuthHeaders(f.headers, g), h = await this.transporter.request(f);
        } catch (g) {
          const m = g.response;
          if (m) {
            const v = m.status, E = m.config.data instanceof n.Readable;
            if (!p && (v === 401 || v === 403) && !E && this.forceRefreshOnFailure)
              return await this.refreshAccessTokenAsync(), await this.requestAsync(f, !0);
          }
          throw g;
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
        const f = (await this.authClient.getAccessToken()).token, p = {
          grantType: o,
          requestedTokenType: a,
          subjectToken: f,
          subjectTokenType: l
        }, h = await this.stsCredential.exchangeToken(p, void 0, this.credentialAccessBoundary), g = this.authClient.credentials?.expiry_date || null, m = h.expires_in ? (/* @__PURE__ */ new Date()).getTime() + h.expires_in * 1e3 : g;
        return this.cachedDownscopedAccessToken = {
          access_token: h.access_token,
          expiry_date: m,
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
      isExpired(f) {
        const p = (/* @__PURE__ */ new Date()).getTime();
        return f.expiry_date ? p >= f.expiry_date - this.eagerRefreshThresholdMillis : !1;
      }
    }
    e.DownscopedClient = d;
  })(pr)), pr;
}
var jt = {}, Fs;
function ed() {
  if (Fs) return jt;
  Fs = 1, Object.defineProperty(jt, "__esModule", { value: !0 }), jt.PassThroughClient = void 0;
  const e = Pe();
  class t extends e.AuthClient {
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
    async request(r) {
      return this.transporter.request(r);
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
  return jt.PassThroughClient = t, jt;
}
var Gs;
function td() {
  return Gs || (Gs = 1, (function(e) {
    var t = ze && ze.__createBinding || (Object.create ? (function(P, N, G, V) {
      V === void 0 && (V = G);
      var q = Object.getOwnPropertyDescriptor(N, G);
      (!q || ("get" in q ? !N.__esModule : q.writable || q.configurable)) && (q = { enumerable: !0, get: function() {
        return N[G];
      } }), Object.defineProperty(P, V, q);
    }) : (function(P, N, G, V) {
      V === void 0 && (V = G), P[V] = N[G];
    })), n = ze && ze.__exportStar || function(P, N) {
      for (var G in P) G !== "default" && !Object.prototype.hasOwnProperty.call(N, G) && t(N, P, G);
    };
    Object.defineProperty(e, "__esModule", { value: !0 }), e.GoogleAuth = e.auth = e.PassThroughClient = e.ExternalAccountAuthorizedUserClient = e.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE = e.ExecutableError = e.PluggableAuthClient = e.DownscopedClient = e.BaseExternalAccountClient = e.ExternalAccountClient = e.IdentityPoolClient = e.AwsRequestSigner = e.AwsClient = e.UserRefreshClient = e.LoginTicket = e.ClientAuthentication = e.OAuth2Client = e.CodeChallengeMethod = e.Impersonated = e.JWT = e.JWTAccess = e.IdTokenClient = e.IAMAuth = e.GCPEnv = e.Compute = e.DEFAULT_UNIVERSE = e.AuthClient = e.gaxios = e.gcpMetadata = void 0;
    const r = Qu();
    Object.defineProperty(e, "GoogleAuth", { enumerable: !0, get: function() {
      return r.GoogleAuth;
    } }), e.gcpMetadata = bn(), e.gaxios = ve();
    var i = Pe();
    Object.defineProperty(e, "AuthClient", { enumerable: !0, get: function() {
      return i.AuthClient;
    } }), Object.defineProperty(e, "DEFAULT_UNIVERSE", { enumerable: !0, get: function() {
      return i.DEFAULT_UNIVERSE;
    } });
    var o = ba();
    Object.defineProperty(e, "Compute", { enumerable: !0, get: function() {
      return o.Compute;
    } });
    var a = Oa();
    Object.defineProperty(e, "GCPEnv", { enumerable: !0, get: function() {
      return a.GCPEnv;
    } });
    var l = Zu();
    Object.defineProperty(e, "IAMAuth", { enumerable: !0, get: function() {
      return l.IAMAuth;
    } });
    var d = La();
    Object.defineProperty(e, "IdTokenClient", { enumerable: !0, get: function() {
      return d.IdTokenClient;
    } });
    var c = Ja();
    Object.defineProperty(e, "JWTAccess", { enumerable: !0, get: function() {
      return c.JWTAccess;
    } });
    var f = $a();
    Object.defineProperty(e, "JWT", { enumerable: !0, get: function() {
      return f.JWT;
    } });
    var p = Ka();
    Object.defineProperty(e, "Impersonated", { enumerable: !0, get: function() {
      return p.Impersonated;
    } });
    var h = _t();
    Object.defineProperty(e, "CodeChallengeMethod", { enumerable: !0, get: function() {
      return h.CodeChallengeMethod;
    } }), Object.defineProperty(e, "OAuth2Client", { enumerable: !0, get: function() {
      return h.OAuth2Client;
    } }), Object.defineProperty(e, "ClientAuthentication", { enumerable: !0, get: function() {
      return h.ClientAuthentication;
    } });
    var g = Ua();
    Object.defineProperty(e, "LoginTicket", { enumerable: !0, get: function() {
      return g.LoginTicket;
    } });
    var m = Wa();
    Object.defineProperty(e, "UserRefreshClient", { enumerable: !0, get: function() {
      return m.UserRefreshClient;
    } });
    var v = Qa();
    Object.defineProperty(e, "AwsClient", { enumerable: !0, get: function() {
      return v.AwsClient;
    } });
    var E = Xa();
    Object.defineProperty(e, "AwsRequestSigner", { enumerable: !0, get: function() {
      return E.AwsRequestSigner;
    } });
    var T = za();
    Object.defineProperty(e, "IdentityPoolClient", { enumerable: !0, get: function() {
      return T.IdentityPoolClient;
    } });
    var C = el();
    Object.defineProperty(e, "ExternalAccountClient", { enumerable: !0, get: function() {
      return C.ExternalAccountClient;
    } });
    var w = ut();
    Object.defineProperty(e, "BaseExternalAccountClient", { enumerable: !0, get: function() {
      return w.BaseExternalAccountClient;
    } });
    var D = ju();
    Object.defineProperty(e, "DownscopedClient", { enumerable: !0, get: function() {
      return D.DownscopedClient;
    } });
    var _ = ja();
    Object.defineProperty(e, "PluggableAuthClient", { enumerable: !0, get: function() {
      return _.PluggableAuthClient;
    } }), Object.defineProperty(e, "ExecutableError", { enumerable: !0, get: function() {
      return _.ExecutableError;
    } });
    var y = tl();
    Object.defineProperty(e, "EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE", { enumerable: !0, get: function() {
      return y.EXTERNAL_ACCOUNT_AUTHORIZED_USER_TYPE;
    } }), Object.defineProperty(e, "ExternalAccountAuthorizedUserClient", { enumerable: !0, get: function() {
      return y.ExternalAccountAuthorizedUserClient;
    } });
    var S = ed();
    Object.defineProperty(e, "PassThroughClient", { enumerable: !0, get: function() {
      return S.PassThroughClient;
    } }), n(Va(), e);
    const R = new r.GoogleAuth();
    e.auth = R;
  })(ze)), ze;
}
var nd = td(), en = { exports: {} }, gr, qs;
function We() {
  if (qs) return gr;
  qs = 1;
  const e = ["nodebuffer", "arraybuffer", "fragments"], t = typeof Blob < "u";
  return t && e.push("blob"), gr = {
    BINARY_TYPES: e,
    CLOSE_TIMEOUT: 3e4,
    EMPTY_BUFFER: Buffer.alloc(0),
    GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
    hasBlob: t,
    kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
    kListener: /* @__PURE__ */ Symbol("kListener"),
    kStatusCode: /* @__PURE__ */ Symbol("status-code"),
    kWebSocket: /* @__PURE__ */ Symbol("websocket"),
    NOOP: () => {
    }
  }, gr;
}
var Bs;
function On() {
  if (Bs) return en.exports;
  Bs = 1;
  const { EMPTY_BUFFER: e } = We(), t = Buffer[Symbol.species];
  function n(l, d) {
    if (l.length === 0) return e;
    if (l.length === 1) return l[0];
    const c = Buffer.allocUnsafe(d);
    let f = 0;
    for (let p = 0; p < l.length; p++) {
      const h = l[p];
      c.set(h, f), f += h.length;
    }
    return f < d ? new t(c.buffer, c.byteOffset, f) : c;
  }
  function r(l, d, c, f, p) {
    for (let h = 0; h < p; h++)
      c[f + h] = l[h] ^ d[h & 3];
  }
  function i(l, d) {
    for (let c = 0; c < l.length; c++)
      l[c] ^= d[c & 3];
  }
  function o(l) {
    return l.length === l.buffer.byteLength ? l.buffer : l.buffer.slice(l.byteOffset, l.byteOffset + l.length);
  }
  function a(l) {
    if (a.readOnly = !0, Buffer.isBuffer(l)) return l;
    let d;
    return l instanceof ArrayBuffer ? d = new t(l) : ArrayBuffer.isView(l) ? d = new t(l.buffer, l.byteOffset, l.byteLength) : (d = Buffer.from(l), a.readOnly = !1), d;
  }
  if (en.exports = {
    concat: n,
    mask: r,
    toArrayBuffer: o,
    toBuffer: a,
    unmask: i
  }, !process.env.WS_NO_BUFFER_UTIL)
    try {
      const l = require("bufferutil");
      en.exports.mask = function(d, c, f, p, h) {
        h < 48 ? r(d, c, f, p, h) : l.mask(d, c, f, p, h);
      }, en.exports.unmask = function(d, c) {
        d.length < 32 ? i(d, c) : l.unmask(d, c);
      };
    } catch {
    }
  return en.exports;
}
var mr, Hs;
function rd() {
  if (Hs) return mr;
  Hs = 1;
  const e = /* @__PURE__ */ Symbol("kDone"), t = /* @__PURE__ */ Symbol("kRun");
  class n {
    /**
     * Creates a new `Limiter`.
     *
     * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
     *     to run concurrently
     */
    constructor(i) {
      this[e] = () => {
        this.pending--, this[t]();
      }, this.concurrency = i || 1 / 0, this.jobs = [], this.pending = 0;
    }
    /**
     * Adds a job to the queue.
     *
     * @param {Function} job The job to run
     * @public
     */
    add(i) {
      this.jobs.push(i), this[t]();
    }
    /**
     * Removes a job from the queue and runs it if possible.
     *
     * @private
     */
    [t]() {
      if (this.pending !== this.concurrency && this.jobs.length) {
        const i = this.jobs.shift();
        this.pending++, i(this[e]);
      }
    }
  }
  return mr = n, mr;
}
var yr, Vs;
function Fn() {
  if (Vs) return yr;
  Vs = 1;
  const e = Bc, t = On(), n = rd(), { kStatusCode: r } = We(), i = Buffer[Symbol.species], o = Buffer.from([0, 0, 255, 255]), a = /* @__PURE__ */ Symbol("permessage-deflate"), l = /* @__PURE__ */ Symbol("total-length"), d = /* @__PURE__ */ Symbol("callback"), c = /* @__PURE__ */ Symbol("buffers"), f = /* @__PURE__ */ Symbol("error");
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
        const T = this._deflate[d];
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
        const _ = `${D}_max_window_bits`, y = typeof this.params[_] != "number" ? e.Z_DEFAULT_WINDOWBITS : this.params[_];
        this._inflate = e.createInflateRaw({
          ...this._options.zlibInflateOptions,
          windowBits: y
        }), this._inflate[a] = this, this._inflate[l] = 0, this._inflate[c] = [], this._inflate.on("error", v), this._inflate.on("data", m);
      }
      this._inflate[d] = w, this._inflate.write(T), C && this._inflate.write(o), this._inflate.flush(() => {
        const _ = this._inflate[f];
        if (_) {
          this._inflate.close(), this._inflate = null, w(_);
          return;
        }
        const y = t.concat(
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
        const _ = `${D}_max_window_bits`, y = typeof this.params[_] != "number" ? e.Z_DEFAULT_WINDOWBITS : this.params[_];
        this._deflate = e.createDeflateRaw({
          ...this._options.zlibDeflateOptions,
          windowBits: y
        }), this._deflate[l] = 0, this._deflate[c] = [], this._deflate.on("data", g);
      }
      this._deflate[d] = w, this._deflate.write(T), this._deflate.flush(e.Z_SYNC_FLUSH, () => {
        if (!this._deflate)
          return;
        let _ = t.concat(
          this._deflate[c],
          this._deflate[l]
        );
        C && (_ = new i(_.buffer, _.byteOffset, _.length - 4)), this._deflate[d] = null, this._deflate[l] = 0, this._deflate[c] = [], C && this.params[`${D}_no_context_takeover`] && this._deflate.reset(), w(null, _);
      });
    }
  }
  yr = h;
  function g(E) {
    this[c].push(E), this[l] += E.length;
  }
  function m(E) {
    if (this[l] += E.length, this[a]._maxPayload < 1 || this[l] <= this[a]._maxPayload) {
      this[c].push(E);
      return;
    }
    this[f] = new RangeError("Max payload size exceeded"), this[f].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH", this[f][r] = 1009, this.removeListener("data", m), this.reset();
  }
  function v(E) {
    if (this[a]._inflate = null, this[f]) {
      this[d](this[f]);
      return;
    }
    E[r] = 1007, this[d](E);
  }
  return yr;
}
var tn = { exports: {} }, Js;
function fn() {
  if (Js) return tn.exports;
  Js = 1;
  const { isUtf8: e } = sn, { hasBlob: t } = We(), n = [
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
  function r(a) {
    return a >= 1e3 && a <= 1014 && a !== 1004 && a !== 1005 && a !== 1006 || a >= 3e3 && a <= 4999;
  }
  function i(a) {
    const l = a.length;
    let d = 0;
    for (; d < l; )
      if ((a[d] & 128) === 0)
        d++;
      else if ((a[d] & 224) === 192) {
        if (d + 1 === l || (a[d + 1] & 192) !== 128 || (a[d] & 254) === 192)
          return !1;
        d += 2;
      } else if ((a[d] & 240) === 224) {
        if (d + 2 >= l || (a[d + 1] & 192) !== 128 || (a[d + 2] & 192) !== 128 || a[d] === 224 && (a[d + 1] & 224) === 128 || // Overlong
        a[d] === 237 && (a[d + 1] & 224) === 160)
          return !1;
        d += 3;
      } else if ((a[d] & 248) === 240) {
        if (d + 3 >= l || (a[d + 1] & 192) !== 128 || (a[d + 2] & 192) !== 128 || (a[d + 3] & 192) !== 128 || a[d] === 240 && (a[d + 1] & 240) === 128 || // Overlong
        a[d] === 244 && a[d + 1] > 143 || a[d] > 244)
          return !1;
        d += 4;
      } else
        return !1;
    return !0;
  }
  function o(a) {
    return t && typeof a == "object" && typeof a.arrayBuffer == "function" && typeof a.type == "string" && typeof a.stream == "function" && (a[Symbol.toStringTag] === "Blob" || a[Symbol.toStringTag] === "File");
  }
  if (tn.exports = {
    isBlob: o,
    isValidStatusCode: r,
    isValidUTF8: i,
    tokenChars: n
  }, e)
    tn.exports.isValidUTF8 = function(a) {
      return a.length < 24 ? i(a) : e(a);
    };
  else if (!process.env.WS_NO_UTF_8_VALIDATE)
    try {
      const a = require("utf-8-validate");
      tn.exports.isValidUTF8 = function(l) {
        return l.length < 32 ? i(l) : a(l);
      };
    } catch {
    }
  return tn.exports;
}
var _r, $s;
function nl() {
  if ($s) return _r;
  $s = 1;
  const { Writable: e } = we, t = Fn(), {
    BINARY_TYPES: n,
    EMPTY_BUFFER: r,
    kStatusCode: i,
    kWebSocket: o
  } = We(), { concat: a, toArrayBuffer: l, unmask: d } = On(), { isValidStatusCode: c, isValidUTF8: f } = fn(), p = Buffer[Symbol.species], h = 0, g = 1, m = 2, v = 3, E = 4, T = 5, C = 6;
  class w extends e {
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
          case g:
            this.getPayloadLength16(_);
            break;
          case m:
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
      if (S && !this._extensions[t.extensionName]) {
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
      this._payloadLength === 126 ? this._state = g : this._payloadLength === 127 ? this._state = m : this.haveLength(_);
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
      let y = r;
      if (this._payloadLength) {
        if (this._bufferedBytes < this._payloadLength) {
          this._loop = !1;
          return;
        }
        y = this.consume(this._payloadLength), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0 && d(y, this._mask);
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
      this._extensions[t.extensionName].decompress(_, this._fin, (R, P) => {
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
        if (!this._skipUTF8Validation && !f(R)) {
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
          this._loop = !1, this.emit("conclude", 1005, r), this.end();
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
          if (!this._skipUTF8Validation && !f(R)) {
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
      return Error.captureStackTrace(N, this.createError), N.code = P, N[i] = R, N;
    }
  }
  return _r = w, _r;
}
var vr, Ws;
function rl() {
  if (Ws) return vr;
  Ws = 1;
  const { Duplex: e } = we, { randomFillSync: t } = yt, n = Fn(), { EMPTY_BUFFER: r, kWebSocket: i, NOOP: o } = We(), { isBlob: a, isValidStatusCode: l } = fn(), { mask: d, toBuffer: c } = On(), f = /* @__PURE__ */ Symbol("kByteLength"), p = Buffer.alloc(4), h = 8 * 1024;
  let g, m = h;
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
      this._extensions = S || {}, R && (this._generateMask = R, this._maskBuffer = Buffer.alloc(4)), this._socket = y, this._firstFragment = !0, this._compress = !1, this._bufferedBytes = 0, this._queue = [], this._state = v, this.onerror = o, this[i] = void 0;
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
      S.mask && (R = S.maskBuffer || p, S.generateMask ? S.generateMask(R) : (m === h && (g === void 0 && (g = Buffer.alloc(h)), t(g, 0, h), m = 0), R[0] = g[m++], R[1] = g[m++], R[2] = g[m++], R[3] = g[m++]), G = (R[0] | R[1] | R[2] | R[3]) === 0, N = 6);
      let V;
      typeof y == "string" ? (!S.mask || G) && S[f] !== void 0 ? V = S[f] : (y = Buffer.from(y), V = y.length) : (V = y.length, P = S.mask && S.readOnly && !G);
      let q = V;
      V >= 65536 ? (N += 8, q = 127) : V > 125 && (N += 2, q = 126);
      const J = Buffer.allocUnsafe(P ? V + N : N);
      return J[0] = S.fin ? S.opcode | 128 : S.opcode, S.rsv1 && (J[0] |= 64), J[1] = q, q === 126 ? J.writeUInt16BE(V, 2) : q === 127 && (J[2] = J[3] = 0, J.writeUIntBE(V, 4, 6)), S.mask ? (J[1] |= 128, J[N - 4] = R[0], J[N - 3] = R[1], J[N - 2] = R[2], J[N - 1] = R[3], G ? [J, y] : P ? (d(y, R, J, N, V), [J]) : (d(y, R, y, 0, V), [J, y])) : [J, y];
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
        N = r;
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
        [f]: N.length,
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
        [f]: P,
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
        [f]: P,
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
        [f]: V,
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
      this._bufferedBytes += R[f], this._state = T, y.arrayBuffer().then((N) => {
        if (this._socket.destroyed) {
          const V = new Error(
            "The socket was closed while the blob was being read"
          );
          process.nextTick(w, this, V, P);
          return;
        }
        this._bufferedBytes -= R[f];
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
      this._bufferedBytes += R[f], this._state = E, N.compress(y, R.fin, (G, V) => {
        if (this._socket.destroyed) {
          const q = new Error(
            "The socket was closed while data was being compressed"
          );
          w(this, q, P);
          return;
        }
        this._bufferedBytes -= R[f], this._state = v, R.readOnly = !1, this.sendFrame(C.frame(V, R), P), this.dequeue();
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
        this._bufferedBytes -= y[3][f], Reflect.apply(y[0], this, y.slice(1));
      }
    }
    /**
     * Enqueues a send operation.
     *
     * @param {Array} params Send operation parameters.
     * @private
     */
    enqueue(y) {
      this._bufferedBytes += y[3][f], this._queue.push(y);
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
  vr = C;
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
  return vr;
}
var Er, Ks;
function id() {
  if (Ks) return Er;
  Ks = 1;
  const { kForOnEventAttribute: e, kListener: t } = We(), n = /* @__PURE__ */ Symbol("kCode"), r = /* @__PURE__ */ Symbol("kData"), i = /* @__PURE__ */ Symbol("kError"), o = /* @__PURE__ */ Symbol("kMessage"), a = /* @__PURE__ */ Symbol("kReason"), l = /* @__PURE__ */ Symbol("kTarget"), d = /* @__PURE__ */ Symbol("kType"), c = /* @__PURE__ */ Symbol("kWasClean");
  class f {
    /**
     * Create a new `Event`.
     *
     * @param {String} type The name of the event
     * @throws {TypeError} If the `type` argument is not specified
     */
    constructor(T) {
      this[l] = null, this[d] = T;
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
      return this[d];
    }
  }
  Object.defineProperty(f.prototype, "target", { enumerable: !0 }), Object.defineProperty(f.prototype, "type", { enumerable: !0 });
  class p extends f {
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
  class h extends f {
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
      super(T), this[i] = C.error === void 0 ? null : C.error, this[o] = C.message === void 0 ? "" : C.message;
    }
    /**
     * @type {*}
     */
    get error() {
      return this[i];
    }
    /**
     * @type {String}
     */
    get message() {
      return this[o];
    }
  }
  Object.defineProperty(h.prototype, "error", { enumerable: !0 }), Object.defineProperty(h.prototype, "message", { enumerable: !0 });
  class g extends f {
    /**
     * Create a new `MessageEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {*} [options.data=null] The message content
     */
    constructor(T, C = {}) {
      super(T), this[r] = C.data === void 0 ? null : C.data;
    }
    /**
     * @type {*}
     */
    get data() {
      return this[r];
    }
  }
  Object.defineProperty(g.prototype, "data", { enumerable: !0 }), Er = {
    CloseEvent: p,
    ErrorEvent: h,
    Event: f,
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
          if (!C[e] && D[t] === T && !D[e])
            return;
        let w;
        if (E === "message")
          w = function(_, y) {
            const S = new g("message", {
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
            const _ = new f("open");
            _[l] = this, v(T, this, _);
          };
        else
          return;
        w[e] = !!C[e], w[t] = T, C.once ? this.once(E, w) : this.on(E, w);
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
          if (C[t] === T && !C[e]) {
            this.removeListener(E, C);
            break;
          }
      }
    },
    MessageEvent: g
  };
  function v(E, T, C) {
    typeof E == "object" && E.handleEvent ? E.handleEvent.call(E, C) : E.call(T, C);
  }
  return Er;
}
var Tr, Ys;
function il() {
  if (Ys) return Tr;
  Ys = 1;
  const { tokenChars: e } = fn();
  function t(i, o, a) {
    i[o] === void 0 ? i[o] = [a] : i[o].push(a);
  }
  function n(i) {
    const o = /* @__PURE__ */ Object.create(null);
    let a = /* @__PURE__ */ Object.create(null), l = !1, d = !1, c = !1, f, p, h = -1, g = -1, m = -1, v = 0;
    for (; v < i.length; v++)
      if (g = i.charCodeAt(v), f === void 0)
        if (m === -1 && e[g] === 1)
          h === -1 && (h = v);
        else if (v !== 0 && (g === 32 || g === 9))
          m === -1 && h !== -1 && (m = v);
        else if (g === 59 || g === 44) {
          if (h === -1)
            throw new SyntaxError(`Unexpected character at index ${v}`);
          m === -1 && (m = v);
          const T = i.slice(h, m);
          g === 44 ? (t(o, T, a), a = /* @__PURE__ */ Object.create(null)) : f = T, h = m = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (p === void 0)
        if (m === -1 && e[g] === 1)
          h === -1 && (h = v);
        else if (g === 32 || g === 9)
          m === -1 && h !== -1 && (m = v);
        else if (g === 59 || g === 44) {
          if (h === -1)
            throw new SyntaxError(`Unexpected character at index ${v}`);
          m === -1 && (m = v), t(a, i.slice(h, m), !0), g === 44 && (t(o, f, a), a = /* @__PURE__ */ Object.create(null), f = void 0), h = m = -1;
        } else if (g === 61 && h !== -1 && m === -1)
          p = i.slice(h, v), h = m = -1;
        else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (d) {
        if (e[g] !== 1)
          throw new SyntaxError(`Unexpected character at index ${v}`);
        h === -1 ? h = v : l || (l = !0), d = !1;
      } else if (c)
        if (e[g] === 1)
          h === -1 && (h = v);
        else if (g === 34 && h !== -1)
          c = !1, m = v;
        else if (g === 92)
          d = !0;
        else
          throw new SyntaxError(`Unexpected character at index ${v}`);
      else if (g === 34 && i.charCodeAt(v - 1) === 61)
        c = !0;
      else if (m === -1 && e[g] === 1)
        h === -1 && (h = v);
      else if (h !== -1 && (g === 32 || g === 9))
        m === -1 && (m = v);
      else if (g === 59 || g === 44) {
        if (h === -1)
          throw new SyntaxError(`Unexpected character at index ${v}`);
        m === -1 && (m = v);
        let T = i.slice(h, m);
        l && (T = T.replace(/\\/g, ""), l = !1), t(a, p, T), g === 44 && (t(o, f, a), a = /* @__PURE__ */ Object.create(null), f = void 0), p = void 0, h = m = -1;
      } else
        throw new SyntaxError(`Unexpected character at index ${v}`);
    if (h === -1 || c || g === 32 || g === 9)
      throw new SyntaxError("Unexpected end of input");
    m === -1 && (m = v);
    const E = i.slice(h, m);
    return f === void 0 ? t(o, E, a) : (p === void 0 ? t(a, E, !0) : l ? t(a, p, E.replace(/\\/g, "")) : t(a, p, E), t(o, f, a)), o;
  }
  function r(i) {
    return Object.keys(i).map((o) => {
      let a = i[o];
      return Array.isArray(a) || (a = [a]), a.map((l) => [o].concat(
        Object.keys(l).map((d) => {
          let c = l[d];
          return Array.isArray(c) || (c = [c]), c.map((f) => f === !0 ? d : `${d}=${f}`).join("; ");
        })
      ).join("; ")).join(", ");
    }).join(", ");
  }
  return Tr = { format: r, parse: n }, Tr;
}
var Sr, zs;
function io() {
  if (zs) return Sr;
  zs = 1;
  const e = Un, t = eo, n = Ca, r = Fc, i = Gc, { randomBytes: o, createHash: a } = yt, { Duplex: l, Readable: d } = we, { URL: c } = qc, f = Fn(), p = nl(), h = rl(), { isBlob: g } = fn(), {
    BINARY_TYPES: m,
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
  } = id(), { format: P, parse: N } = il(), { toBuffer: G } = On(), V = /* @__PURE__ */ Symbol("kAborted"), q = [8, 13], J = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"], W = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
  class $ extends e {
    /**
     * Create a new `WebSocket`.
     *
     * @param {(String|URL)} address The URL to which to connect
     * @param {(String|String[])} [protocols] The subprotocols
     * @param {Object} [options] Connection options
     */
    constructor(k, U, b) {
      super(), this._binaryType = m[0], this._closeCode = 1006, this._closeFrameReceived = !1, this._closeFrameSent = !1, this._closeMessage = E, this._closeTimer = null, this._errorEmitted = !1, this._extensions = {}, this._paused = !1, this._protocol = "", this._readyState = $.CONNECTING, this._receiver = null, this._sender = null, this._socket = null, k !== null ? (this._bufferedAmount = 0, this._isServer = !1, this._redirects = 0, U === void 0 ? U = [] : Array.isArray(U) || (typeof U == "object" && U !== null ? (b = U, U = []) : U = [U]), X(this, k, U, b)) : (this._autoPong = b.autoPong, this._closeTimeout = b.closeTimeout, this._isServer = !0);
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
      m.includes(k) && (this._binaryType = k, this._receiver && (this._receiver._binaryType = k));
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
      this._receiver = O, this._sender = Y, this._socket = k, O[_] = this, Y[_] = this, k[_] = this, O.on("conclude", St), O.on("drain", K), O.on("error", Ct), O.on("message", wt), O.on("ping", Se), O.on("pong", Ne), Y.onerror = M, k.setTimeout && k.setTimeout(0), k.setNoDelay && k.setNoDelay(), U.length > 0 && k.unshift(U), k.on("close", B), k.on("data", L), k.on("end", F), k.on("error", H), this._readyState = $.OPEN, this.emit("open");
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
      this._extensions[f.extensionName] && this._extensions[f.extensionName].cleanup(), this._receiver.removeAllListeners(), this._readyState = $.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
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
      this._extensions[f.extensionName] || (O.compress = !1), this._sender.send(k || E, O, b);
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
  }), $.prototype.addEventListener = S, $.prototype.removeEventListener = R, Sr = $;
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
    const ue = Q ? 443 : 80, te = o(16).toString("base64"), ie = Q ? t.request : n.request, de = /* @__PURE__ */ new Set();
    let be;
    if (O.createConnection = O.createConnection || (Q ? pe : le), O.defaultPort = O.defaultPort || ue, O.port = Y.port || ue, O.host = Y.hostname.startsWith("[") ? Y.hostname.slice(1, -1) : Y.hostname, O.headers = {
      ...O.headers,
      "Sec-WebSocket-Version": O.protocolVersion,
      "Sec-WebSocket-Key": te,
      Connection: "Upgrade",
      Upgrade: "websocket"
    }, O.path = Y.pathname + Y.search, O.timeout = O.handshakeTimeout, O.perMessageDeflate && (be = new f(
      O.perMessageDeflate !== !0 ? O.perMessageDeflate : {},
      !1,
      O.maxPayload
    ), O.headers["Sec-WebSocket-Extensions"] = P({
      [f.extensionName]: be.offer()
    })), U.length) {
      for (const ne of U) {
        if (typeof ne != "string" || !W.test(ne) || de.has(ne))
          throw new SyntaxError(
            "An invalid or duplicated subprotocol was specified"
          );
        de.add(ne);
      }
      O.headers["Sec-WebSocket-Protocol"] = U.join(",");
    }
    if (O.origin && (O.protocolVersion < 13 ? O.headers["Sec-WebSocket-Origin"] = O.origin : O.headers.Origin = O.origin), (Y.username || Y.password) && (O.auth = `${Y.username}:${Y.password}`), ee) {
      const ne = O.path.split(":");
      O.socketPath = ne[0], O.path = ne[1];
    }
    let fe;
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
      O.auth && !b.headers.authorization && (b.headers.authorization = "Basic " + Buffer.from(O.auth).toString("base64")), fe = A._req = ie(O), A._redirects && A.emit("redirect", A.url, fe);
    } else
      fe = A._req = ie(O);
    O.timeout && fe.on("timeout", () => {
      ce(A, fe, "Opening handshake has timed out");
    }), fe.on("error", (ne) => {
      fe === null || fe[V] || (fe = A._req = null, Z(A, ne));
    }), fe.on("response", (ne) => {
      const ae = ne.headers.location, Ie = ne.statusCode;
      if (ae && O.followRedirects && Ie >= 300 && Ie < 400) {
        if (++A._redirects > O.maxRedirects) {
          ce(A, fe, "Maximum redirects exceeded");
          return;
        }
        fe.abort();
        let ge;
        try {
          ge = new c(ae, k);
        } catch {
          const oe = new SyntaxError(`Invalid URL: ${ae}`);
          Z(A, oe);
          return;
        }
        X(A, ge, U, b);
      } else A.emit("unexpected-response", fe, ne) || ce(
        A,
        fe,
        `Unexpected server response: ${ne.statusCode}`
      );
    }), fe.on("upgrade", (ne, ae, Ie) => {
      if (A.emit("upgrade", ne), A.readyState !== $.CONNECTING) return;
      fe = A._req = null;
      const ge = ne.headers.upgrade;
      if (ge === void 0 || ge.toLowerCase() !== "websocket") {
        ce(A, ae, "Invalid Upgrade header");
        return;
      }
      const me = a("sha1").update(te + T).digest("base64");
      if (ne.headers["sec-websocket-accept"] !== me) {
        ce(A, ae, "Invalid Sec-WebSocket-Accept header");
        return;
      }
      const oe = ne.headers["sec-websocket-protocol"];
      let It;
      if (oe !== void 0 ? de.size ? de.has(oe) || (It = "Server sent an invalid subprotocol") : It = "Server sent a subprotocol but none was requested" : de.size && (It = "Server sent no subprotocol"), It) {
        ce(A, ae, It);
        return;
      }
      oe && (A._protocol = oe);
      const go = ne.headers["sec-websocket-extensions"];
      if (go !== void 0) {
        if (!be) {
          ce(A, ae, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
          return;
        }
        let $n;
        try {
          $n = N(go);
        } catch {
          ce(A, ae, "Invalid Sec-WebSocket-Extensions header");
          return;
        }
        const mo = Object.keys($n);
        if (mo.length !== 1 || mo[0] !== f.extensionName) {
          ce(A, ae, "Server indicated an extension that was not requested");
          return;
        }
        try {
          be.accept($n[f.extensionName]);
        } catch {
          ce(A, ae, "Invalid Sec-WebSocket-Extensions header");
          return;
        }
        A._extensions[f.extensionName] = be;
      }
      A.setSocket(ae, Ie, {
        allowSynchronousEvents: O.allowSynchronousEvents,
        generateMask: O.generateMask,
        maxPayload: O.maxPayload,
        skipUTF8Validation: O.skipUTF8Validation
      });
    }), O.finishRequest ? O.finishRequest(fe, A) : fe.end();
  }
  function Z(A, k) {
    A._readyState = $.CLOSING, A._errorEmitted = !0, A.emit("error", k), A.emitClose();
  }
  function le(A) {
    return A.path = A.socketPath, r.connect(A);
  }
  function pe(A) {
    return A.path = void 0, !A.servername && A.servername !== "" && (A.servername = r.isIP(A.host) ? "" : A.host), i.connect(A);
  }
  function ce(A, k, U) {
    A._readyState = $.CLOSING;
    const b = new Error(U);
    Error.captureStackTrace(b, ce), k.setHeader ? (k[V] = !0, k.abort(), k.socket && !k.socket.destroyed && k.socket.destroy(), process.nextTick(Z, A, b)) : (k.destroy(b), k.once("error", A.emit.bind(A, "error")), k.once("close", A.emitClose.bind(A)));
  }
  function Ce(A, k, U) {
    if (k) {
      const b = g(k) ? k.size : G(k).length;
      A._socket ? A._sender._bufferedBytes += b : A._bufferedAmount += b;
    }
    if (U) {
      const b = new Error(
        `WebSocket is not open: readyState ${A.readyState} (${J[A.readyState]})`
      );
      process.nextTick(U, b);
    }
  }
  function St(A, k) {
    const U = this[_];
    U._closeFrameReceived = !0, U._closeMessage = k, U._closeCode = A, U._socket[_] !== void 0 && (U._socket.removeListener("data", L), process.nextTick(I, U._socket), A === 1005 ? U.close() : U.close(A, k));
  }
  function K() {
    const A = this[_];
    A.isPaused || A._socket.resume();
  }
  function Ct(A) {
    const k = this[_];
    k._socket[_] !== void 0 && (k._socket.removeListener("data", L), process.nextTick(I, k._socket), k.close(A[D])), k._errorEmitted || (k._errorEmitted = !0, k.emit("error", A));
  }
  function At() {
    this[_].emitClose();
  }
  function wt(A, k) {
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
    A._receiver.end(), this[_] = void 0, clearTimeout(A._closeTimer), A._receiver._writableState.finished || A._receiver._writableState.errorEmitted ? A.emitClose() : (A._receiver.on("error", At), A._receiver.on("finish", At));
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
  return Sr;
}
var Cr, Xs;
function od() {
  if (Xs) return Cr;
  Xs = 1, io();
  const { Duplex: e } = we;
  function t(o) {
    o.emit("close");
  }
  function n() {
    !this.destroyed && this._writableState.finished && this.destroy();
  }
  function r(o) {
    this.removeListener("error", r), this.destroy(), this.listenerCount("error") === 0 && this.emit("error", o);
  }
  function i(o, a) {
    let l = !0;
    const d = new e({
      ...a,
      autoDestroy: !1,
      emitClose: !1,
      objectMode: !1,
      writableObjectMode: !1
    });
    return o.on("message", function(f, p) {
      const h = !p && d._readableState.objectMode ? f.toString() : f;
      d.push(h) || o.pause();
    }), o.once("error", function(f) {
      d.destroyed || (l = !1, d.destroy(f));
    }), o.once("close", function() {
      d.destroyed || d.push(null);
    }), d._destroy = function(c, f) {
      if (o.readyState === o.CLOSED) {
        f(c), process.nextTick(t, d);
        return;
      }
      let p = !1;
      o.once("error", function(g) {
        p = !0, f(g);
      }), o.once("close", function() {
        p || f(c), process.nextTick(t, d);
      }), l && o.terminate();
    }, d._final = function(c) {
      if (o.readyState === o.CONNECTING) {
        o.once("open", function() {
          d._final(c);
        });
        return;
      }
      o._socket !== null && (o._socket._writableState.finished ? (c(), d._readableState.endEmitted && d.destroy()) : (o._socket.once("finish", function() {
        c();
      }), o.close()));
    }, d._read = function() {
      o.isPaused && o.resume();
    }, d._write = function(c, f, p) {
      if (o.readyState === o.CONNECTING) {
        o.once("open", function() {
          d._write(c, f, p);
        });
        return;
      }
      o.send(c, p);
    }, d.on("end", n), d.on("error", r), d;
  }
  return Cr = i, Cr;
}
od();
nl();
rl();
var sd = io();
const ad = /* @__PURE__ */ Aa(sd);
var Ar, Qs;
function ld() {
  if (Qs) return Ar;
  Qs = 1;
  const { tokenChars: e } = fn();
  function t(n) {
    const r = /* @__PURE__ */ new Set();
    let i = -1, o = -1, a = 0;
    for (a; a < n.length; a++) {
      const d = n.charCodeAt(a);
      if (o === -1 && e[d] === 1)
        i === -1 && (i = a);
      else if (a !== 0 && (d === 32 || d === 9))
        o === -1 && i !== -1 && (o = a);
      else if (d === 44) {
        if (i === -1)
          throw new SyntaxError(`Unexpected character at index ${a}`);
        o === -1 && (o = a);
        const c = n.slice(i, o);
        if (r.has(c))
          throw new SyntaxError(`The "${c}" subprotocol is duplicated`);
        r.add(c), i = o = -1;
      } else
        throw new SyntaxError(`Unexpected character at index ${a}`);
    }
    if (i === -1 || o !== -1)
      throw new SyntaxError("Unexpected end of input");
    const l = n.slice(i, a);
    if (r.has(l))
      throw new SyntaxError(`The "${l}" subprotocol is duplicated`);
    return r.add(l), r;
  }
  return Ar = { parse: t }, Ar;
}
var wr, Zs;
function cd() {
  if (Zs) return wr;
  Zs = 1;
  const e = Un, t = Ca, { Duplex: n } = we, { createHash: r } = yt, i = il(), o = Fn(), a = ld(), l = io(), { CLOSE_TIMEOUT: d, GUID: c, kWebSocket: f } = We(), p = /^[+/0-9A-Za-z]{22}==$/, h = 0, g = 1, m = 2;
  class v extends e {
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
        closeTimeout: d,
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
      if (y.port != null ? (this._server = t.createServer((R, P) => {
        const N = t.STATUS_CODES[426];
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
      if (this._state === m) {
        y && this.once("close", () => {
          y(new Error("The server is not running"));
        }), process.nextTick(T, this);
        return;
      }
      if (y && this.once("close", y), this._state !== g)
        if (this._state = g, this.options.noServer || this.options.server)
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
          const Z = i.parse(W);
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
      if (N[f])
        throw new Error(
          "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
        );
      if (this._state > h) return w(N, 503);
      const J = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${r("sha1").update(S + c).digest("base64")}`
      ], W = new this.options.WebSocket(null, void 0, this.options);
      if (R.size) {
        const $ = this.options.handleProtocols ? this.options.handleProtocols(R, P) : R.values().next().value;
        $ && (J.push(`Sec-WebSocket-Protocol: ${$}`), W._protocol = $);
      }
      if (y[o.extensionName]) {
        const $ = y[o.extensionName].params, X = i.format({
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
  wr = v;
  function E(_, y) {
    for (const S of Object.keys(y)) _.on(S, y[S]);
    return function() {
      for (const R of Object.keys(y))
        _.removeListener(R, y[R]);
    };
  }
  function T(_) {
    _._state = m, _.emit("close");
  }
  function C() {
    this.destroy();
  }
  function w(_, y, S, R) {
    S = S || t.STATUS_CODES[y], R = {
      Connection: "close",
      "Content-Type": "text/html",
      "Content-Length": Buffer.byteLength(S),
      ...R
    }, _.once("finish", _.destroy), _.end(
      `HTTP/1.1 ${y} ${t.STATUS_CODES[y]}\r
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
  return wr;
}
cd();
let ol, sl;
function ud(e) {
  ol = e.geminiUrl, sl = e.vertexUrl;
}
function dd() {
  return {
    geminiUrl: ol,
    vertexUrl: sl
  };
}
function fd(e, t, n, r) {
  var i, o;
  if (!e?.baseUrl) {
    const a = dd();
    return t ? (i = a.vertexUrl) !== null && i !== void 0 ? i : n : (o = a.geminiUrl) !== null && o !== void 0 ? o : r;
  }
  return e.baseUrl;
}
class Ve {
}
function z(e, t) {
  const n = /\{([^}]+)\}/g;
  return e.replace(n, (r, i) => {
    if (Object.prototype.hasOwnProperty.call(t, i)) {
      const o = t[i];
      return o != null ? String(o) : "";
    } else
      throw new Error(`Key '${i}' not found in valueMap.`);
  });
}
function u(e, t, n) {
  for (let o = 0; o < t.length - 1; o++) {
    const a = t[o];
    if (a.endsWith("[]")) {
      const l = a.slice(0, -2);
      if (!(l in e))
        if (Array.isArray(n))
          e[l] = Array.from({ length: n.length }, () => ({}));
        else
          throw new Error(`Value must be a list given an array path ${a}`);
      if (Array.isArray(e[l])) {
        const d = e[l];
        if (Array.isArray(n))
          for (let c = 0; c < d.length; c++) {
            const f = d[c];
            u(f, t.slice(o + 1), n[c]);
          }
        else
          for (const c of d)
            u(c, t.slice(o + 1), n);
      }
      return;
    } else if (a.endsWith("[0]")) {
      const l = a.slice(0, -3);
      l in e || (e[l] = [{}]);
      const d = e[l];
      u(d[0], t.slice(o + 1), n);
      return;
    }
    (!e[a] || typeof e[a] != "object") && (e[a] = {}), e = e[a];
  }
  const r = t[t.length - 1], i = e[r];
  if (i !== void 0) {
    if (!n || typeof n == "object" && Object.keys(n).length === 0 || n === i)
      return;
    if (typeof i == "object" && typeof n == "object" && i !== null && n !== null)
      Object.assign(i, n);
    else
      throw new Error(`Cannot set value for an existing key. Key: ${r}`);
  } else
    r === "_self" && typeof n == "object" && n !== null && !Array.isArray(n) ? Object.assign(e, n) : e[r] = n;
}
function s(e, t, n = void 0) {
  try {
    if (t.length === 1 && t[0] === "_self")
      return e;
    for (let r = 0; r < t.length; r++) {
      if (typeof e != "object" || e === null)
        return n;
      const i = t[r];
      if (i.endsWith("[]")) {
        const o = i.slice(0, -2);
        if (o in e) {
          const a = e[o];
          return Array.isArray(a) ? a.map((l) => s(l, t.slice(r + 1), n)) : n;
        } else
          return n;
      } else
        e = e[i];
    }
    return e;
  } catch (r) {
    if (r instanceof TypeError)
      return n;
    throw r;
  }
}
function hd(e, t) {
  for (const [n, r] of Object.entries(t)) {
    const i = n.split("."), o = r.split("."), a = /* @__PURE__ */ new Set();
    let l = -1;
    for (let d = 0; d < i.length; d++)
      if (i[d] === "*") {
        l = d;
        break;
      }
    if (l !== -1 && o.length > l)
      for (let d = l; d < o.length; d++) {
        const c = o[d];
        c !== "*" && !c.endsWith("[]") && !c.endsWith("[0]") && a.add(c);
      }
    Nr(e, i, o, 0, a);
  }
}
function Nr(e, t, n, r, i) {
  if (r >= t.length || typeof e != "object" || e === null)
    return;
  const o = t[r];
  if (o.endsWith("[]")) {
    const a = o.slice(0, -2), l = e;
    if (a in l && Array.isArray(l[a]))
      for (const d of l[a])
        Nr(d, t, n, r + 1, i);
  } else if (o === "*") {
    if (typeof e == "object" && e !== null && !Array.isArray(e)) {
      const a = e, l = Object.keys(a).filter((c) => !c.startsWith("_") && !i.has(c)), d = {};
      for (const c of l)
        d[c] = a[c];
      for (const [c, f] of Object.entries(d)) {
        const p = [];
        for (const h of n.slice(r))
          h === "*" ? p.push(c) : p.push(h);
        u(a, p, f);
      }
      for (const c of l)
        delete a[c];
    }
  } else {
    const a = e;
    o in a && Nr(a[o], t, n, r + 1, i);
  }
}
function oo(e) {
  if (typeof e != "string")
    throw new Error("fromImageBytes must be a string");
  return e;
}
function pd(e) {
  const t = {}, n = s(e, [
    "operationName"
  ]);
  n != null && u(t, ["operationName"], n);
  const r = s(e, ["resourceName"]);
  return r != null && u(t, ["_url", "resourceName"], r), t;
}
function gd(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, [
    "response",
    "generateVideoResponse"
  ]);
  return a != null && u(t, ["response"], yd(a)), t;
}
function md(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, ["response"]);
  return a != null && u(t, ["response"], _d(a)), t;
}
function yd(e) {
  const t = {}, n = s(e, [
    "generatedSamples"
  ]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((a) => vd(a))), u(t, ["generatedVideos"], o);
  }
  const r = s(e, [
    "raiMediaFilteredCount"
  ]);
  r != null && u(t, ["raiMediaFilteredCount"], r);
  const i = s(e, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && u(t, ["raiMediaFilteredReasons"], i), t;
}
function _d(e) {
  const t = {}, n = s(e, ["videos"]);
  if (n != null) {
    let o = n;
    Array.isArray(o) && (o = o.map((a) => Ed(a))), u(t, ["generatedVideos"], o);
  }
  const r = s(e, [
    "raiMediaFilteredCount"
  ]);
  r != null && u(t, ["raiMediaFilteredCount"], r);
  const i = s(e, [
    "raiMediaFilteredReasons"
  ]);
  return i != null && u(t, ["raiMediaFilteredReasons"], i), t;
}
function vd(e) {
  const t = {}, n = s(e, ["video"]);
  return n != null && u(t, ["video"], Id(n)), t;
}
function Ed(e) {
  const t = {}, n = s(e, ["_self"]);
  return n != null && u(t, ["video"], Rd(n)), t;
}
function Td(e) {
  const t = {}, n = s(e, [
    "operationName"
  ]);
  return n != null && u(t, ["_url", "operationName"], n), t;
}
function Sd(e) {
  const t = {}, n = s(e, [
    "operationName"
  ]);
  return n != null && u(t, ["_url", "operationName"], n), t;
}
function Cd(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, ["response"]);
  return a != null && u(t, ["response"], Ad(a)), t;
}
function Ad(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["parent"]);
  r != null && u(t, ["parent"], r);
  const i = s(e, ["documentName"]);
  return i != null && u(t, ["documentName"], i), t;
}
function so(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, ["response"]);
  return a != null && u(t, ["response"], wd(a)), t;
}
function wd(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["parent"]);
  r != null && u(t, ["parent"], r);
  const i = s(e, ["documentName"]);
  return i != null && u(t, ["documentName"], i), t;
}
function Id(e) {
  const t = {}, n = s(e, ["uri"]);
  n != null && u(t, ["uri"], n);
  const r = s(e, ["encodedVideo"]);
  r != null && u(t, ["videoBytes"], oo(r));
  const i = s(e, ["encoding"]);
  return i != null && u(t, ["mimeType"], i), t;
}
function Rd(e) {
  const t = {}, n = s(e, ["gcsUri"]);
  n != null && u(t, ["uri"], n);
  const r = s(e, [
    "bytesBase64Encoded"
  ]);
  r != null && u(t, ["videoBytes"], oo(r));
  const i = s(e, ["mimeType"]);
  return i != null && u(t, ["mimeType"], i), t;
}
var kr;
(function(e) {
  e.OUTCOME_UNSPECIFIED = "OUTCOME_UNSPECIFIED", e.OUTCOME_OK = "OUTCOME_OK", e.OUTCOME_FAILED = "OUTCOME_FAILED", e.OUTCOME_DEADLINE_EXCEEDED = "OUTCOME_DEADLINE_EXCEEDED";
})(kr || (kr = {}));
var Mr;
(function(e) {
  e.LANGUAGE_UNSPECIFIED = "LANGUAGE_UNSPECIFIED", e.PYTHON = "PYTHON";
})(Mr || (Mr = {}));
var xr;
(function(e) {
  e.SCHEDULING_UNSPECIFIED = "SCHEDULING_UNSPECIFIED", e.SILENT = "SILENT", e.WHEN_IDLE = "WHEN_IDLE", e.INTERRUPT = "INTERRUPT";
})(xr || (xr = {}));
var He;
(function(e) {
  e.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", e.STRING = "STRING", e.NUMBER = "NUMBER", e.INTEGER = "INTEGER", e.BOOLEAN = "BOOLEAN", e.ARRAY = "ARRAY", e.OBJECT = "OBJECT", e.NULL = "NULL";
})(He || (He = {}));
var Dr;
(function(e) {
  e.PHISH_BLOCK_THRESHOLD_UNSPECIFIED = "PHISH_BLOCK_THRESHOLD_UNSPECIFIED", e.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", e.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", e.BLOCK_HIGH_AND_ABOVE = "BLOCK_HIGH_AND_ABOVE", e.BLOCK_HIGHER_AND_ABOVE = "BLOCK_HIGHER_AND_ABOVE", e.BLOCK_VERY_HIGH_AND_ABOVE = "BLOCK_VERY_HIGH_AND_ABOVE", e.BLOCK_ONLY_EXTREMELY_HIGH = "BLOCK_ONLY_EXTREMELY_HIGH";
})(Dr || (Dr = {}));
var Ur;
(function(e) {
  e.AUTH_TYPE_UNSPECIFIED = "AUTH_TYPE_UNSPECIFIED", e.NO_AUTH = "NO_AUTH", e.API_KEY_AUTH = "API_KEY_AUTH", e.HTTP_BASIC_AUTH = "HTTP_BASIC_AUTH", e.GOOGLE_SERVICE_ACCOUNT_AUTH = "GOOGLE_SERVICE_ACCOUNT_AUTH", e.OAUTH = "OAUTH", e.OIDC_AUTH = "OIDC_AUTH";
})(Ur || (Ur = {}));
var br;
(function(e) {
  e.HTTP_IN_UNSPECIFIED = "HTTP_IN_UNSPECIFIED", e.HTTP_IN_QUERY = "HTTP_IN_QUERY", e.HTTP_IN_HEADER = "HTTP_IN_HEADER", e.HTTP_IN_PATH = "HTTP_IN_PATH", e.HTTP_IN_BODY = "HTTP_IN_BODY", e.HTTP_IN_COOKIE = "HTTP_IN_COOKIE";
})(br || (br = {}));
var Lr;
(function(e) {
  e.API_SPEC_UNSPECIFIED = "API_SPEC_UNSPECIFIED", e.SIMPLE_SEARCH = "SIMPLE_SEARCH", e.ELASTIC_SEARCH = "ELASTIC_SEARCH";
})(Lr || (Lr = {}));
var Or;
(function(e) {
  e.UNSPECIFIED = "UNSPECIFIED", e.BLOCKING = "BLOCKING", e.NON_BLOCKING = "NON_BLOCKING";
})(Or || (Or = {}));
var Fr;
(function(e) {
  e.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", e.MODE_DYNAMIC = "MODE_DYNAMIC";
})(Fr || (Fr = {}));
var Gr;
(function(e) {
  e.MODE_UNSPECIFIED = "MODE_UNSPECIFIED", e.AUTO = "AUTO", e.ANY = "ANY", e.NONE = "NONE", e.VALIDATED = "VALIDATED";
})(Gr || (Gr = {}));
var qr;
(function(e) {
  e.THINKING_LEVEL_UNSPECIFIED = "THINKING_LEVEL_UNSPECIFIED", e.LOW = "LOW", e.MEDIUM = "MEDIUM", e.HIGH = "HIGH", e.MINIMAL = "MINIMAL";
})(qr || (qr = {}));
var Br;
(function(e) {
  e.DONT_ALLOW = "DONT_ALLOW", e.ALLOW_ADULT = "ALLOW_ADULT", e.ALLOW_ALL = "ALLOW_ALL";
})(Br || (Br = {}));
var Hr;
(function(e) {
  e.HARM_CATEGORY_UNSPECIFIED = "HARM_CATEGORY_UNSPECIFIED", e.HARM_CATEGORY_HARASSMENT = "HARM_CATEGORY_HARASSMENT", e.HARM_CATEGORY_HATE_SPEECH = "HARM_CATEGORY_HATE_SPEECH", e.HARM_CATEGORY_SEXUALLY_EXPLICIT = "HARM_CATEGORY_SEXUALLY_EXPLICIT", e.HARM_CATEGORY_DANGEROUS_CONTENT = "HARM_CATEGORY_DANGEROUS_CONTENT", e.HARM_CATEGORY_CIVIC_INTEGRITY = "HARM_CATEGORY_CIVIC_INTEGRITY", e.HARM_CATEGORY_IMAGE_HATE = "HARM_CATEGORY_IMAGE_HATE", e.HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT = "HARM_CATEGORY_IMAGE_DANGEROUS_CONTENT", e.HARM_CATEGORY_IMAGE_HARASSMENT = "HARM_CATEGORY_IMAGE_HARASSMENT", e.HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT = "HARM_CATEGORY_IMAGE_SEXUALLY_EXPLICIT", e.HARM_CATEGORY_JAILBREAK = "HARM_CATEGORY_JAILBREAK";
})(Hr || (Hr = {}));
var Vr;
(function(e) {
  e.HARM_BLOCK_METHOD_UNSPECIFIED = "HARM_BLOCK_METHOD_UNSPECIFIED", e.SEVERITY = "SEVERITY", e.PROBABILITY = "PROBABILITY";
})(Vr || (Vr = {}));
var Jr;
(function(e) {
  e.HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED", e.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", e.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", e.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", e.BLOCK_NONE = "BLOCK_NONE", e.OFF = "OFF";
})(Jr || (Jr = {}));
var $r;
(function(e) {
  e.FINISH_REASON_UNSPECIFIED = "FINISH_REASON_UNSPECIFIED", e.STOP = "STOP", e.MAX_TOKENS = "MAX_TOKENS", e.SAFETY = "SAFETY", e.RECITATION = "RECITATION", e.LANGUAGE = "LANGUAGE", e.OTHER = "OTHER", e.BLOCKLIST = "BLOCKLIST", e.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", e.SPII = "SPII", e.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", e.IMAGE_SAFETY = "IMAGE_SAFETY", e.UNEXPECTED_TOOL_CALL = "UNEXPECTED_TOOL_CALL", e.IMAGE_PROHIBITED_CONTENT = "IMAGE_PROHIBITED_CONTENT", e.NO_IMAGE = "NO_IMAGE", e.IMAGE_RECITATION = "IMAGE_RECITATION", e.IMAGE_OTHER = "IMAGE_OTHER";
})($r || ($r = {}));
var Wr;
(function(e) {
  e.HARM_PROBABILITY_UNSPECIFIED = "HARM_PROBABILITY_UNSPECIFIED", e.NEGLIGIBLE = "NEGLIGIBLE", e.LOW = "LOW", e.MEDIUM = "MEDIUM", e.HIGH = "HIGH";
})(Wr || (Wr = {}));
var Kr;
(function(e) {
  e.HARM_SEVERITY_UNSPECIFIED = "HARM_SEVERITY_UNSPECIFIED", e.HARM_SEVERITY_NEGLIGIBLE = "HARM_SEVERITY_NEGLIGIBLE", e.HARM_SEVERITY_LOW = "HARM_SEVERITY_LOW", e.HARM_SEVERITY_MEDIUM = "HARM_SEVERITY_MEDIUM", e.HARM_SEVERITY_HIGH = "HARM_SEVERITY_HIGH";
})(Kr || (Kr = {}));
var Yr;
(function(e) {
  e.URL_RETRIEVAL_STATUS_UNSPECIFIED = "URL_RETRIEVAL_STATUS_UNSPECIFIED", e.URL_RETRIEVAL_STATUS_SUCCESS = "URL_RETRIEVAL_STATUS_SUCCESS", e.URL_RETRIEVAL_STATUS_ERROR = "URL_RETRIEVAL_STATUS_ERROR", e.URL_RETRIEVAL_STATUS_PAYWALL = "URL_RETRIEVAL_STATUS_PAYWALL", e.URL_RETRIEVAL_STATUS_UNSAFE = "URL_RETRIEVAL_STATUS_UNSAFE";
})(Yr || (Yr = {}));
var zr;
(function(e) {
  e.BLOCKED_REASON_UNSPECIFIED = "BLOCKED_REASON_UNSPECIFIED", e.SAFETY = "SAFETY", e.OTHER = "OTHER", e.BLOCKLIST = "BLOCKLIST", e.PROHIBITED_CONTENT = "PROHIBITED_CONTENT", e.IMAGE_SAFETY = "IMAGE_SAFETY", e.MODEL_ARMOR = "MODEL_ARMOR", e.JAILBREAK = "JAILBREAK";
})(zr || (zr = {}));
var Xr;
(function(e) {
  e.TRAFFIC_TYPE_UNSPECIFIED = "TRAFFIC_TYPE_UNSPECIFIED", e.ON_DEMAND = "ON_DEMAND", e.ON_DEMAND_PRIORITY = "ON_DEMAND_PRIORITY", e.ON_DEMAND_FLEX = "ON_DEMAND_FLEX", e.PROVISIONED_THROUGHPUT = "PROVISIONED_THROUGHPUT";
})(Xr || (Xr = {}));
var an;
(function(e) {
  e.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", e.TEXT = "TEXT", e.IMAGE = "IMAGE", e.AUDIO = "AUDIO";
})(an || (an = {}));
var Qr;
(function(e) {
  e.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", e.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", e.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", e.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH";
})(Qr || (Qr = {}));
var Zr;
(function(e) {
  e.TUNING_MODE_UNSPECIFIED = "TUNING_MODE_UNSPECIFIED", e.TUNING_MODE_FULL = "TUNING_MODE_FULL", e.TUNING_MODE_PEFT_ADAPTER = "TUNING_MODE_PEFT_ADAPTER";
})(Zr || (Zr = {}));
var jr;
(function(e) {
  e.ADAPTER_SIZE_UNSPECIFIED = "ADAPTER_SIZE_UNSPECIFIED", e.ADAPTER_SIZE_ONE = "ADAPTER_SIZE_ONE", e.ADAPTER_SIZE_TWO = "ADAPTER_SIZE_TWO", e.ADAPTER_SIZE_FOUR = "ADAPTER_SIZE_FOUR", e.ADAPTER_SIZE_EIGHT = "ADAPTER_SIZE_EIGHT", e.ADAPTER_SIZE_SIXTEEN = "ADAPTER_SIZE_SIXTEEN", e.ADAPTER_SIZE_THIRTY_TWO = "ADAPTER_SIZE_THIRTY_TWO";
})(jr || (jr = {}));
var Nn;
(function(e) {
  e.JOB_STATE_UNSPECIFIED = "JOB_STATE_UNSPECIFIED", e.JOB_STATE_QUEUED = "JOB_STATE_QUEUED", e.JOB_STATE_PENDING = "JOB_STATE_PENDING", e.JOB_STATE_RUNNING = "JOB_STATE_RUNNING", e.JOB_STATE_SUCCEEDED = "JOB_STATE_SUCCEEDED", e.JOB_STATE_FAILED = "JOB_STATE_FAILED", e.JOB_STATE_CANCELLING = "JOB_STATE_CANCELLING", e.JOB_STATE_CANCELLED = "JOB_STATE_CANCELLED", e.JOB_STATE_PAUSED = "JOB_STATE_PAUSED", e.JOB_STATE_EXPIRED = "JOB_STATE_EXPIRED", e.JOB_STATE_UPDATING = "JOB_STATE_UPDATING", e.JOB_STATE_PARTIALLY_SUCCEEDED = "JOB_STATE_PARTIALLY_SUCCEEDED";
})(Nn || (Nn = {}));
var ei;
(function(e) {
  e.TUNING_JOB_STATE_UNSPECIFIED = "TUNING_JOB_STATE_UNSPECIFIED", e.TUNING_JOB_STATE_WAITING_FOR_QUOTA = "TUNING_JOB_STATE_WAITING_FOR_QUOTA", e.TUNING_JOB_STATE_PROCESSING_DATASET = "TUNING_JOB_STATE_PROCESSING_DATASET", e.TUNING_JOB_STATE_WAITING_FOR_CAPACITY = "TUNING_JOB_STATE_WAITING_FOR_CAPACITY", e.TUNING_JOB_STATE_TUNING = "TUNING_JOB_STATE_TUNING", e.TUNING_JOB_STATE_POST_PROCESSING = "TUNING_JOB_STATE_POST_PROCESSING";
})(ei || (ei = {}));
var ti;
(function(e) {
  e.AGGREGATION_METRIC_UNSPECIFIED = "AGGREGATION_METRIC_UNSPECIFIED", e.AVERAGE = "AVERAGE", e.MODE = "MODE", e.STANDARD_DEVIATION = "STANDARD_DEVIATION", e.VARIANCE = "VARIANCE", e.MINIMUM = "MINIMUM", e.MAXIMUM = "MAXIMUM", e.MEDIAN = "MEDIAN", e.PERCENTILE_P90 = "PERCENTILE_P90", e.PERCENTILE_P95 = "PERCENTILE_P95", e.PERCENTILE_P99 = "PERCENTILE_P99";
})(ti || (ti = {}));
var ni;
(function(e) {
  e.PAIRWISE_CHOICE_UNSPECIFIED = "PAIRWISE_CHOICE_UNSPECIFIED", e.BASELINE = "BASELINE", e.CANDIDATE = "CANDIDATE", e.TIE = "TIE";
})(ni || (ni = {}));
var ri;
(function(e) {
  e.TUNING_TASK_UNSPECIFIED = "TUNING_TASK_UNSPECIFIED", e.TUNING_TASK_I2V = "TUNING_TASK_I2V", e.TUNING_TASK_T2V = "TUNING_TASK_T2V", e.TUNING_TASK_R2V = "TUNING_TASK_R2V";
})(ri || (ri = {}));
var ii;
(function(e) {
  e.MEDIA_RESOLUTION_UNSPECIFIED = "MEDIA_RESOLUTION_UNSPECIFIED", e.MEDIA_RESOLUTION_LOW = "MEDIA_RESOLUTION_LOW", e.MEDIA_RESOLUTION_MEDIUM = "MEDIA_RESOLUTION_MEDIUM", e.MEDIA_RESOLUTION_HIGH = "MEDIA_RESOLUTION_HIGH", e.MEDIA_RESOLUTION_ULTRA_HIGH = "MEDIA_RESOLUTION_ULTRA_HIGH";
})(ii || (ii = {}));
var kn;
(function(e) {
  e.COLLECTION = "COLLECTION";
})(kn || (kn = {}));
var oi;
(function(e) {
  e.FEATURE_SELECTION_PREFERENCE_UNSPECIFIED = "FEATURE_SELECTION_PREFERENCE_UNSPECIFIED", e.PRIORITIZE_QUALITY = "PRIORITIZE_QUALITY", e.BALANCED = "BALANCED", e.PRIORITIZE_COST = "PRIORITIZE_COST";
})(oi || (oi = {}));
var si;
(function(e) {
  e.ENVIRONMENT_UNSPECIFIED = "ENVIRONMENT_UNSPECIFIED", e.ENVIRONMENT_BROWSER = "ENVIRONMENT_BROWSER";
})(si || (si = {}));
var ai;
(function(e) {
  e.PROMINENT_PEOPLE_UNSPECIFIED = "PROMINENT_PEOPLE_UNSPECIFIED", e.ALLOW_PROMINENT_PEOPLE = "ALLOW_PROMINENT_PEOPLE", e.BLOCK_PROMINENT_PEOPLE = "BLOCK_PROMINENT_PEOPLE";
})(ai || (ai = {}));
var ln;
(function(e) {
  e.PREDICT = "PREDICT", e.EMBED_CONTENT = "EMBED_CONTENT";
})(ln || (ln = {}));
var li;
(function(e) {
  e.BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE", e.BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE", e.BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH", e.BLOCK_NONE = "BLOCK_NONE";
})(li || (li = {}));
var ci;
(function(e) {
  e.auto = "auto", e.en = "en", e.ja = "ja", e.ko = "ko", e.hi = "hi", e.zh = "zh", e.pt = "pt", e.es = "es";
})(ci || (ci = {}));
var ui;
(function(e) {
  e.MASK_MODE_DEFAULT = "MASK_MODE_DEFAULT", e.MASK_MODE_USER_PROVIDED = "MASK_MODE_USER_PROVIDED", e.MASK_MODE_BACKGROUND = "MASK_MODE_BACKGROUND", e.MASK_MODE_FOREGROUND = "MASK_MODE_FOREGROUND", e.MASK_MODE_SEMANTIC = "MASK_MODE_SEMANTIC";
})(ui || (ui = {}));
var di;
(function(e) {
  e.CONTROL_TYPE_DEFAULT = "CONTROL_TYPE_DEFAULT", e.CONTROL_TYPE_CANNY = "CONTROL_TYPE_CANNY", e.CONTROL_TYPE_SCRIBBLE = "CONTROL_TYPE_SCRIBBLE", e.CONTROL_TYPE_FACE_MESH = "CONTROL_TYPE_FACE_MESH";
})(di || (di = {}));
var fi;
(function(e) {
  e.SUBJECT_TYPE_DEFAULT = "SUBJECT_TYPE_DEFAULT", e.SUBJECT_TYPE_PERSON = "SUBJECT_TYPE_PERSON", e.SUBJECT_TYPE_ANIMAL = "SUBJECT_TYPE_ANIMAL", e.SUBJECT_TYPE_PRODUCT = "SUBJECT_TYPE_PRODUCT";
})(fi || (fi = {}));
var hi;
(function(e) {
  e.EDIT_MODE_DEFAULT = "EDIT_MODE_DEFAULT", e.EDIT_MODE_INPAINT_REMOVAL = "EDIT_MODE_INPAINT_REMOVAL", e.EDIT_MODE_INPAINT_INSERTION = "EDIT_MODE_INPAINT_INSERTION", e.EDIT_MODE_OUTPAINT = "EDIT_MODE_OUTPAINT", e.EDIT_MODE_CONTROLLED_EDITING = "EDIT_MODE_CONTROLLED_EDITING", e.EDIT_MODE_STYLE = "EDIT_MODE_STYLE", e.EDIT_MODE_BGSWAP = "EDIT_MODE_BGSWAP", e.EDIT_MODE_PRODUCT_IMAGE = "EDIT_MODE_PRODUCT_IMAGE";
})(hi || (hi = {}));
var pi;
(function(e) {
  e.FOREGROUND = "FOREGROUND", e.BACKGROUND = "BACKGROUND", e.PROMPT = "PROMPT", e.SEMANTIC = "SEMANTIC", e.INTERACTIVE = "INTERACTIVE";
})(pi || (pi = {}));
var gi;
(function(e) {
  e.ASSET = "ASSET", e.STYLE = "STYLE";
})(gi || (gi = {}));
var mi;
(function(e) {
  e.INSERT = "INSERT", e.REMOVE = "REMOVE", e.REMOVE_STATIC = "REMOVE_STATIC", e.OUTPAINT = "OUTPAINT";
})(mi || (mi = {}));
var yi;
(function(e) {
  e.OPTIMIZED = "OPTIMIZED", e.LOSSLESS = "LOSSLESS";
})(yi || (yi = {}));
var _i;
(function(e) {
  e.SUPERVISED_FINE_TUNING = "SUPERVISED_FINE_TUNING", e.PREFERENCE_TUNING = "PREFERENCE_TUNING", e.DISTILLATION = "DISTILLATION";
})(_i || (_i = {}));
var vi;
(function(e) {
  e.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", e.STATE_PENDING = "STATE_PENDING", e.STATE_ACTIVE = "STATE_ACTIVE", e.STATE_FAILED = "STATE_FAILED";
})(vi || (vi = {}));
var Ei;
(function(e) {
  e.STATE_UNSPECIFIED = "STATE_UNSPECIFIED", e.PROCESSING = "PROCESSING", e.ACTIVE = "ACTIVE", e.FAILED = "FAILED";
})(Ei || (Ei = {}));
var Ti;
(function(e) {
  e.SOURCE_UNSPECIFIED = "SOURCE_UNSPECIFIED", e.UPLOADED = "UPLOADED", e.GENERATED = "GENERATED", e.REGISTERED = "REGISTERED";
})(Ti || (Ti = {}));
var Si;
(function(e) {
  e.TURN_COMPLETE_REASON_UNSPECIFIED = "TURN_COMPLETE_REASON_UNSPECIFIED", e.MALFORMED_FUNCTION_CALL = "MALFORMED_FUNCTION_CALL", e.RESPONSE_REJECTED = "RESPONSE_REJECTED", e.NEED_MORE_INPUT = "NEED_MORE_INPUT";
})(Si || (Si = {}));
var Ci;
(function(e) {
  e.MODALITY_UNSPECIFIED = "MODALITY_UNSPECIFIED", e.TEXT = "TEXT", e.IMAGE = "IMAGE", e.VIDEO = "VIDEO", e.AUDIO = "AUDIO", e.DOCUMENT = "DOCUMENT";
})(Ci || (Ci = {}));
var Ai;
(function(e) {
  e.VAD_SIGNAL_TYPE_UNSPECIFIED = "VAD_SIGNAL_TYPE_UNSPECIFIED", e.VAD_SIGNAL_TYPE_SOS = "VAD_SIGNAL_TYPE_SOS", e.VAD_SIGNAL_TYPE_EOS = "VAD_SIGNAL_TYPE_EOS";
})(Ai || (Ai = {}));
var wi;
(function(e) {
  e.TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED", e.ACTIVITY_START = "ACTIVITY_START", e.ACTIVITY_END = "ACTIVITY_END";
})(wi || (wi = {}));
var Ii;
(function(e) {
  e.START_SENSITIVITY_UNSPECIFIED = "START_SENSITIVITY_UNSPECIFIED", e.START_SENSITIVITY_HIGH = "START_SENSITIVITY_HIGH", e.START_SENSITIVITY_LOW = "START_SENSITIVITY_LOW";
})(Ii || (Ii = {}));
var Ri;
(function(e) {
  e.END_SENSITIVITY_UNSPECIFIED = "END_SENSITIVITY_UNSPECIFIED", e.END_SENSITIVITY_HIGH = "END_SENSITIVITY_HIGH", e.END_SENSITIVITY_LOW = "END_SENSITIVITY_LOW";
})(Ri || (Ri = {}));
var Pi;
(function(e) {
  e.ACTIVITY_HANDLING_UNSPECIFIED = "ACTIVITY_HANDLING_UNSPECIFIED", e.START_OF_ACTIVITY_INTERRUPTS = "START_OF_ACTIVITY_INTERRUPTS", e.NO_INTERRUPTION = "NO_INTERRUPTION";
})(Pi || (Pi = {}));
var Ni;
(function(e) {
  e.TURN_COVERAGE_UNSPECIFIED = "TURN_COVERAGE_UNSPECIFIED", e.TURN_INCLUDES_ONLY_ACTIVITY = "TURN_INCLUDES_ONLY_ACTIVITY", e.TURN_INCLUDES_ALL_INPUT = "TURN_INCLUDES_ALL_INPUT";
})(Ni || (Ni = {}));
var ki;
(function(e) {
  e.SCALE_UNSPECIFIED = "SCALE_UNSPECIFIED", e.C_MAJOR_A_MINOR = "C_MAJOR_A_MINOR", e.D_FLAT_MAJOR_B_FLAT_MINOR = "D_FLAT_MAJOR_B_FLAT_MINOR", e.D_MAJOR_B_MINOR = "D_MAJOR_B_MINOR", e.E_FLAT_MAJOR_C_MINOR = "E_FLAT_MAJOR_C_MINOR", e.E_MAJOR_D_FLAT_MINOR = "E_MAJOR_D_FLAT_MINOR", e.F_MAJOR_D_MINOR = "F_MAJOR_D_MINOR", e.G_FLAT_MAJOR_E_FLAT_MINOR = "G_FLAT_MAJOR_E_FLAT_MINOR", e.G_MAJOR_E_MINOR = "G_MAJOR_E_MINOR", e.A_FLAT_MAJOR_F_MINOR = "A_FLAT_MAJOR_F_MINOR", e.A_MAJOR_G_FLAT_MINOR = "A_MAJOR_G_FLAT_MINOR", e.B_FLAT_MAJOR_G_MINOR = "B_FLAT_MAJOR_G_MINOR", e.B_MAJOR_A_FLAT_MINOR = "B_MAJOR_A_FLAT_MINOR";
})(ki || (ki = {}));
var Mi;
(function(e) {
  e.MUSIC_GENERATION_MODE_UNSPECIFIED = "MUSIC_GENERATION_MODE_UNSPECIFIED", e.QUALITY = "QUALITY", e.DIVERSITY = "DIVERSITY", e.VOCALIZATION = "VOCALIZATION";
})(Mi || (Mi = {}));
var st;
(function(e) {
  e.PLAYBACK_CONTROL_UNSPECIFIED = "PLAYBACK_CONTROL_UNSPECIFIED", e.PLAY = "PLAY", e.PAUSE = "PAUSE", e.STOP = "STOP", e.RESET_CONTEXT = "RESET_CONTEXT";
})(st || (st = {}));
class Pd {
}
class Nd {
}
class kd {
}
function Md(e, t) {
  return {
    inlineData: {
      data: e,
      mimeType: t
    }
  };
}
function xd(e, t) {
  return {
    fileData: {
      fileUri: e,
      mimeType: t
    }
  };
}
class Dd {
}
function Ud(e, t, n) {
  return Object.assign({ fileData: {
    fileUri: e,
    mimeType: t
  } }, n && { mediaResolution: { level: n } });
}
function xi(e) {
  return {
    text: e
  };
}
function bd(e, t) {
  return {
    functionCall: {
      name: e,
      args: t
    }
  };
}
function Ld(e, t, n, r = []) {
  return {
    functionResponse: Object.assign({ id: e, name: t, response: n }, r.length > 0 && { parts: r })
  };
}
function Od(e, t, n) {
  return Object.assign({ inlineData: {
    data: e,
    mimeType: t
  } }, n && { mediaResolution: { level: n } });
}
function Fd(e, t) {
  return {
    codeExecutionResult: {
      outcome: e,
      output: t
    }
  };
}
function Gd(e, t) {
  return {
    executableCode: {
      code: e,
      language: t
    }
  };
}
function js(e) {
  return typeof e == "object" && e !== null ? "fileData" in e || "text" in e || "functionCall" in e || "functionResponse" in e || "inlineData" in e || "videoMetadata" in e || "codeExecutionResult" in e || "executableCode" in e : !1;
}
function al(e) {
  const t = [];
  if (typeof e == "string")
    t.push(xi(e));
  else if (js(e))
    t.push(e);
  else if (Array.isArray(e)) {
    if (e.length === 0)
      throw new Error("partOrString cannot be an empty array");
    for (const n of e)
      if (typeof n == "string")
        t.push(xi(n));
      else if (js(n))
        t.push(n);
      else
        throw new Error("element in PartUnion must be a Part object or string");
  } else
    throw new Error("partOrString must be a Part object, string, or array");
  return t;
}
function qd(e) {
  return {
    role: "user",
    parts: al(e)
  };
}
function Bd(e) {
  return {
    role: "model",
    parts: al(e)
  };
}
class mt {
  constructor(t) {
    const n = {};
    for (const r of t.headers.entries())
      n[r[0]] = r[1];
    this.headers = n, this.responseInternal = t;
  }
  json() {
    return this.responseInternal.json();
  }
}
class Hd {
}
class Vd {
}
class ft {
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
    var t, n, r, i, o, a, l, d;
    if (((i = (r = (n = (t = this.candidates) === null || t === void 0 ? void 0 : t[0]) === null || n === void 0 ? void 0 : n.content) === null || r === void 0 ? void 0 : r.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning text from the first one.");
    let c = "", f = !1;
    const p = [];
    for (const h of (d = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) !== null && d !== void 0 ? d : []) {
      for (const [g, m] of Object.entries(h))
        g !== "text" && g !== "thought" && g !== "thoughtSignature" && (m !== null || m !== void 0) && p.push(g);
      if (typeof h.text == "string") {
        if (typeof h.thought == "boolean" && h.thought)
          continue;
        f = !0, c += h.text;
      }
    }
    return p.length > 0 && console.warn(`there are non-text parts ${p} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), f ? c : void 0;
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
    var t, n, r, i, o, a, l, d;
    if (((i = (r = (n = (t = this.candidates) === null || t === void 0 ? void 0 : t[0]) === null || n === void 0 ? void 0 : n.content) === null || r === void 0 ? void 0 : r.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning data from the first one.");
    let c = "";
    const f = [];
    for (const p of (d = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) !== null && d !== void 0 ? d : []) {
      for (const [h, g] of Object.entries(p))
        h !== "inlineData" && (g !== null || g !== void 0) && f.push(h);
      p.inlineData && typeof p.inlineData.data == "string" && (c += atob(p.inlineData.data));
    }
    return f.length > 0 && console.warn(`there are non-data parts ${f} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), c.length > 0 ? btoa(c) : void 0;
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
    var t, n, r, i, o, a, l, d;
    if (((i = (r = (n = (t = this.candidates) === null || t === void 0 ? void 0 : t[0]) === null || n === void 0 ? void 0 : n.content) === null || r === void 0 ? void 0 : r.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning function calls from the first one.");
    const c = (d = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || d === void 0 ? void 0 : d.filter((f) => f.functionCall).map((f) => f.functionCall).filter((f) => f !== void 0);
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
    var t, n, r, i, o, a, l, d, c;
    if (((i = (r = (n = (t = this.candidates) === null || t === void 0 ? void 0 : t[0]) === null || n === void 0 ? void 0 : n.content) === null || r === void 0 ? void 0 : r.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning executable code from the first one.");
    const f = (d = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || d === void 0 ? void 0 : d.filter((p) => p.executableCode).map((p) => p.executableCode).filter((p) => p !== void 0);
    if (f?.length !== 0)
      return (c = f?.[0]) === null || c === void 0 ? void 0 : c.code;
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
    var t, n, r, i, o, a, l, d, c;
    if (((i = (r = (n = (t = this.candidates) === null || t === void 0 ? void 0 : t[0]) === null || n === void 0 ? void 0 : n.content) === null || r === void 0 ? void 0 : r.parts) === null || i === void 0 ? void 0 : i.length) === 0)
      return;
    this.candidates && this.candidates.length > 1 && console.warn("there are multiple candidates in the response, returning code execution result from the first one.");
    const f = (d = (l = (a = (o = this.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content) === null || l === void 0 ? void 0 : l.parts) === null || d === void 0 ? void 0 : d.filter((p) => p.codeExecutionResult).map((p) => p.codeExecutionResult).filter((p) => p !== void 0);
    if (f?.length !== 0)
      return (c = f?.[0]) === null || c === void 0 ? void 0 : c.output;
  }
}
class Di {
}
class Ui {
}
class ll {
}
class cl {
}
class ul {
}
class dl {
}
class bi {
}
class Li {
}
class Oi {
}
class fl {
}
class Jd {
}
class cn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: t, _isVertexAI: n }) {
    const r = new cn();
    let i;
    const o = t;
    return n ? i = md(o) : i = gd(o), Object.assign(r, i), r;
  }
}
class $d {
}
class Fi {
}
class Gi {
}
class qi {
}
class Bi {
}
class hl {
}
class pl {
}
class gl {
}
class Wd {
}
class Gn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: t, _isVertexAI: n }) {
    const r = new Gn(), o = Cd(t);
    return Object.assign(r, o), r;
  }
}
class ml {
}
class yl {
}
class _l {
}
class vl {
}
class Kd {
}
class Yd {
}
class zd {
}
class Hi {
}
class Xd {
}
class Qd {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_RAW",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId
    };
  }
}
class Zd {
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
class jd {
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
class ef {
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
class tf {
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
class nf {
  /** Internal method to convert to ReferenceImageAPIInternal. */
  toReferenceImageAPI() {
    return {
      referenceType: "REFERENCE_TYPE_CONTENT",
      referenceImage: this.referenceImage,
      referenceId: this.referenceId
    };
  }
}
class El {
  /**
   * Returns the concatenation of all text parts from the server content if present.
   *
   * @remarks
   * If there are non-text parts in the response, the concatenation of all text
   * parts will be returned, and a warning will be logged.
   */
  get text() {
    var t, n, r;
    let i = "", o = !1;
    const a = [];
    for (const l of (r = (n = (t = this.serverContent) === null || t === void 0 ? void 0 : t.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && r !== void 0 ? r : []) {
      for (const [d, c] of Object.entries(l))
        d !== "text" && d !== "thought" && c !== null && a.push(d);
      if (typeof l.text == "string") {
        if (typeof l.thought == "boolean" && l.thought)
          continue;
        o = !0, i += l.text;
      }
    }
    return a.length > 0 && console.warn(`there are non-text parts ${a} in the response, returning concatenation of all text parts. Please refer to the non text parts for a full response from model.`), o ? i : void 0;
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
    var t, n, r;
    let i = "";
    const o = [];
    for (const a of (r = (n = (t = this.serverContent) === null || t === void 0 ? void 0 : t.modelTurn) === null || n === void 0 ? void 0 : n.parts) !== null && r !== void 0 ? r : []) {
      for (const [l, d] of Object.entries(a))
        l !== "inlineData" && d !== null && o.push(l);
      a.inlineData && typeof a.inlineData.data == "string" && (i += atob(a.inlineData.data));
    }
    return o.length > 0 && console.warn(`there are non-data parts ${o} in the response, returning concatenation of all data parts. Please refer to the non data parts for a full response from model.`), i.length > 0 ? btoa(i) : void 0;
  }
}
class rf {
}
class of {
  constructor() {
    this.functionResponses = [];
  }
}
class Tl {
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
class sf {
}
class hn {
  /**
   * Instantiates an Operation of the same type as the one being called with the fields set from the API response.
   * @internal
   */
  _fromAPIResponse({ apiResponse: t, _isVertexAI: n }) {
    const r = new hn(), o = so(t);
    return Object.assign(r, o), r;
  }
}
function re(e, t) {
  if (!t || typeof t != "string")
    throw new Error("model is required and must be a string");
  if (t.includes("..") || t.includes("?") || t.includes("&"))
    throw new Error("invalid model parameter");
  if (e.isVertexAI()) {
    if (t.startsWith("publishers/") || t.startsWith("projects/") || t.startsWith("models/"))
      return t;
    if (t.indexOf("/") >= 0) {
      const n = t.split("/", 2);
      return `publishers/${n[0]}/models/${n[1]}`;
    } else
      return `publishers/google/models/${t}`;
  } else
    return t.startsWith("models/") || t.startsWith("tunedModels/") ? t : `models/${t}`;
}
function Sl(e, t) {
  const n = re(e, t);
  return n ? n.startsWith("publishers/") && e.isVertexAI() ? `projects/${e.getProject()}/locations/${e.getLocation()}/${n}` : n.startsWith("models/") && e.isVertexAI() ? `projects/${e.getProject()}/locations/${e.getLocation()}/publishers/google/${n}` : n : "";
}
function Cl(e) {
  return Array.isArray(e) ? e.map((t) => Mn(t)) : [Mn(e)];
}
function Mn(e) {
  if (typeof e == "object" && e !== null)
    return e;
  throw new Error(`Could not parse input as Blob. Unsupported blob type: ${typeof e}`);
}
function Al(e) {
  const t = Mn(e);
  if (t.mimeType && t.mimeType.startsWith("image/"))
    return t;
  throw new Error(`Unsupported mime type: ${t.mimeType}`);
}
function wl(e) {
  const t = Mn(e);
  if (t.mimeType && t.mimeType.startsWith("audio/"))
    return t;
  throw new Error(`Unsupported mime type: ${t.mimeType}`);
}
function ea(e) {
  if (e == null)
    throw new Error("PartUnion is required");
  if (typeof e == "object")
    return e;
  if (typeof e == "string")
    return { text: e };
  throw new Error(`Unsupported part type: ${typeof e}`);
}
function Il(e) {
  if (e == null || Array.isArray(e) && e.length === 0)
    throw new Error("PartListUnion is required");
  return Array.isArray(e) ? e.map((t) => ea(t)) : [ea(e)];
}
function Vi(e) {
  return e != null && typeof e == "object" && "parts" in e && Array.isArray(e.parts);
}
function ta(e) {
  return e != null && typeof e == "object" && "functionCall" in e;
}
function na(e) {
  return e != null && typeof e == "object" && "functionResponse" in e;
}
function ye(e) {
  if (e == null)
    throw new Error("ContentUnion is required");
  return Vi(e) ? e : {
    role: "user",
    parts: Il(e)
  };
}
function ao(e, t) {
  if (!t)
    return [];
  if (e.isVertexAI() && Array.isArray(t))
    return t.flatMap((n) => {
      const r = ye(n);
      return r.parts && r.parts.length > 0 && r.parts[0].text !== void 0 ? [r.parts[0].text] : [];
    });
  if (e.isVertexAI()) {
    const n = ye(t);
    return n.parts && n.parts.length > 0 && n.parts[0].text !== void 0 ? [n.parts[0].text] : [];
  }
  return Array.isArray(t) ? t.map((n) => ye(n)) : [ye(t)];
}
function Ae(e) {
  if (e == null || Array.isArray(e) && e.length === 0)
    throw new Error("contents are required");
  if (!Array.isArray(e)) {
    if (ta(e) || na(e))
      throw new Error("To specify functionCall or functionResponse parts, please wrap them in a Content object, specifying the role for them");
    return [ye(e)];
  }
  const t = [], n = [], r = Vi(e[0]);
  for (const i of e) {
    const o = Vi(i);
    if (o != r)
      throw new Error("Mixing Content and Parts is not supported, please group the parts into a the appropriate Content objects and specify the roles for them");
    if (o)
      t.push(i);
    else {
      if (ta(i) || na(i))
        throw new Error("To specify functionCall or functionResponse parts, please wrap them, and any other parts, in Content objects as appropriate, specifying the role for them");
      n.push(i);
    }
  }
  return r || t.push({ role: "user", parts: Il(n) }), t;
}
function af(e, t) {
  e.includes("null") && (t.nullable = !0);
  const n = e.filter((r) => r !== "null");
  if (n.length === 1)
    t.type = Object.values(He).includes(n[0].toUpperCase()) ? n[0].toUpperCase() : He.TYPE_UNSPECIFIED;
  else {
    t.anyOf = [];
    for (const r of n)
      t.anyOf.push({
        type: Object.values(He).includes(r.toUpperCase()) ? r.toUpperCase() : He.TYPE_UNSPECIFIED
      });
  }
}
function pt(e) {
  const t = {}, n = ["items"], r = ["anyOf"], i = ["properties"];
  if (e.type && e.anyOf)
    throw new Error("type and anyOf cannot be both populated.");
  const o = e.anyOf;
  o != null && o.length == 2 && (o[0].type === "null" ? (t.nullable = !0, e = o[1]) : o[1].type === "null" && (t.nullable = !0, e = o[0])), e.type instanceof Array && af(e.type, t);
  for (const [a, l] of Object.entries(e))
    if (l != null)
      if (a == "type") {
        if (l === "null")
          throw new Error("type: null can not be the only possible type for the field.");
        if (l instanceof Array)
          continue;
        t.type = Object.values(He).includes(l.toUpperCase()) ? l.toUpperCase() : He.TYPE_UNSPECIFIED;
      } else if (n.includes(a))
        t[a] = pt(l);
      else if (r.includes(a)) {
        const d = [];
        for (const c of l) {
          if (c.type == "null") {
            t.nullable = !0;
            continue;
          }
          d.push(pt(c));
        }
        t[a] = d;
      } else if (i.includes(a)) {
        const d = {};
        for (const [c, f] of Object.entries(l))
          d[c] = pt(f);
        t[a] = d;
      } else {
        if (a === "additionalProperties")
          continue;
        t[a] = l;
      }
  return t;
}
function lo(e) {
  return pt(e);
}
function co(e) {
  if (typeof e == "object")
    return e;
  if (typeof e == "string")
    return {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: e
        }
      }
    };
  throw new Error(`Unsupported speechConfig type: ${typeof e}`);
}
function uo(e) {
  if ("multiSpeakerVoiceConfig" in e)
    throw new Error("multiSpeakerVoiceConfig is not supported in the live API.");
  return e;
}
function vt(e) {
  if (e.functionDeclarations)
    for (const t of e.functionDeclarations)
      t.parameters && (Object.keys(t.parameters).includes("$schema") ? t.parametersJsonSchema || (t.parametersJsonSchema = t.parameters, delete t.parameters) : t.parameters = pt(t.parameters)), t.response && (Object.keys(t.response).includes("$schema") ? t.responseJsonSchema || (t.responseJsonSchema = t.response, delete t.response) : t.response = pt(t.response));
  return e;
}
function Et(e) {
  if (e == null)
    throw new Error("tools is required");
  if (!Array.isArray(e))
    throw new Error("tools is required and must be an array of Tools");
  const t = [];
  for (const n of e)
    t.push(n);
  return t;
}
function lf(e, t, n, r = 1) {
  const i = !t.startsWith(`${n}/`) && t.split("/").length === r;
  return e.isVertexAI() ? t.startsWith("projects/") ? t : t.startsWith("locations/") ? `projects/${e.getProject()}/${t}` : t.startsWith(`${n}/`) ? `projects/${e.getProject()}/locations/${e.getLocation()}/${t}` : i ? `projects/${e.getProject()}/locations/${e.getLocation()}/${n}/${t}` : t : i ? `${n}/${t}` : t;
}
function Je(e, t) {
  if (typeof t != "string")
    throw new Error("name must be a string");
  return lf(e, t, "cachedContents");
}
function Rl(e) {
  switch (e) {
    case "STATE_UNSPECIFIED":
      return "JOB_STATE_UNSPECIFIED";
    case "CREATING":
      return "JOB_STATE_RUNNING";
    case "ACTIVE":
      return "JOB_STATE_SUCCEEDED";
    case "FAILED":
      return "JOB_STATE_FAILED";
    default:
      return e;
  }
}
function Ke(e) {
  return oo(e);
}
function cf(e) {
  return e != null && typeof e == "object" && "name" in e;
}
function Pl(e) {
  return e != null && typeof e == "object" && "video" in e;
}
function Nl(e) {
  return e != null && typeof e == "object" && "uri" in e;
}
function fo(e) {
  var t;
  let n;
  if (cf(e) && (n = e.name), !(Nl(e) && (n = e.uri, n === void 0)) && !(Pl(e) && (n = (t = e.video) === null || t === void 0 ? void 0 : t.uri, n === void 0))) {
    if (typeof e == "string" && (n = e), n === void 0)
      throw new Error("Could not extract file name from the provided input.");
    if (n.startsWith("https://")) {
      const i = n.split("files/")[1].match(/[a-z0-9]+/);
      if (i === null)
        throw new Error(`Could not extract file name from URI ${n}`);
      n = i[0];
    } else n.startsWith("files/") && (n = n.split("files/")[1]);
    return n;
  }
}
function kl(e, t) {
  let n;
  return e.isVertexAI() ? n = t ? "publishers/google/models" : "models" : n = t ? "models" : "tunedModels", n;
}
function Ml(e) {
  for (const t of ["models", "tunedModels", "publisherModels"])
    if (uf(e, t))
      return e[t];
  return [];
}
function uf(e, t) {
  return e !== null && typeof e == "object" && t in e;
}
function df(e, t = {}) {
  const n = e, r = {
    name: n.name,
    description: n.description,
    parametersJsonSchema: n.inputSchema
  };
  return n.outputSchema && (r.responseJsonSchema = n.outputSchema), t.behavior && (r.behavior = t.behavior), {
    functionDeclarations: [
      r
    ]
  };
}
function ff(e, t = {}) {
  const n = [], r = /* @__PURE__ */ new Set();
  for (const i of e) {
    const o = i.name;
    if (r.has(o))
      throw new Error(`Duplicate function name ${o} found in MCP tools. Please ensure function names are unique.`);
    r.add(o);
    const a = df(i, t);
    a.functionDeclarations && n.push(...a.functionDeclarations);
  }
  return { functionDeclarations: n };
}
function xl(e, t) {
  let n;
  if (typeof t == "string")
    if (e.isVertexAI())
      if (t.startsWith("gs://"))
        n = { format: "jsonl", gcsUri: [t] };
      else if (t.startsWith("bq://"))
        n = { format: "bigquery", bigqueryUri: t };
      else
        throw new Error(`Unsupported string source for Vertex AI: ${t}`);
    else if (t.startsWith("files/"))
      n = { fileName: t };
    else
      throw new Error(`Unsupported string source for Gemini API: ${t}`);
  else if (Array.isArray(t)) {
    if (e.isVertexAI())
      throw new Error("InlinedRequest[] is not supported in Vertex AI.");
    n = { inlinedRequests: t };
  } else
    n = t;
  const r = [n.gcsUri, n.bigqueryUri].filter(Boolean).length, i = [
    n.inlinedRequests,
    n.fileName
  ].filter(Boolean).length;
  if (e.isVertexAI()) {
    if (i > 0 || r !== 1)
      throw new Error("Exactly one of `gcsUri` or `bigqueryUri` must be set for Vertex AI.");
  } else if (r > 0 || i !== 1)
    throw new Error("Exactly one of `inlinedRequests`, `fileName`, must be set for Gemini API.");
  return n;
}
function hf(e) {
  if (typeof e != "string")
    return e;
  const t = e;
  if (t.startsWith("gs://"))
    return {
      format: "jsonl",
      gcsUri: t
    };
  if (t.startsWith("bq://"))
    return {
      format: "bigquery",
      bigqueryUri: t
    };
  throw new Error(`Unsupported destination: ${t}`);
}
function Dl(e) {
  if (typeof e != "object" || e === null)
    return {};
  const t = e, n = t.inlinedResponses;
  if (typeof n != "object" || n === null)
    return e;
  const i = n.inlinedResponses;
  if (!Array.isArray(i) || i.length === 0)
    return e;
  let o = !1;
  for (const a of i) {
    if (typeof a != "object" || a === null)
      continue;
    const d = a.response;
    if (typeof d != "object" || d === null)
      continue;
    if (d.embedding !== void 0) {
      o = !0;
      break;
    }
  }
  return o && (t.inlinedEmbedContentResponses = t.inlinedResponses, delete t.inlinedResponses), e;
}
function Tt(e, t) {
  const n = t;
  if (!e.isVertexAI()) {
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
function Ul(e) {
  const t = e;
  return t === "BATCH_STATE_UNSPECIFIED" ? "JOB_STATE_UNSPECIFIED" : t === "BATCH_STATE_PENDING" ? "JOB_STATE_PENDING" : t === "BATCH_STATE_RUNNING" ? "JOB_STATE_RUNNING" : t === "BATCH_STATE_SUCCEEDED" ? "JOB_STATE_SUCCEEDED" : t === "BATCH_STATE_FAILED" ? "JOB_STATE_FAILED" : t === "BATCH_STATE_CANCELLED" ? "JOB_STATE_CANCELLED" : t === "BATCH_STATE_EXPIRED" ? "JOB_STATE_EXPIRED" : t;
}
function pf(e) {
  return e.includes("gemini") && e !== "gemini-embedding-001" || e.includes("maas");
}
function gf(e) {
  const t = {}, n = s(e, ["apiKey"]);
  if (n != null && u(t, ["apiKey"], n), s(e, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(e, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(e, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(e, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return t;
}
function mf(e) {
  const t = {}, n = s(e, ["responsesFile"]);
  n != null && u(t, ["fileName"], n);
  const r = s(e, [
    "inlinedResponses",
    "inlinedResponses"
  ]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => Xf(a))), u(t, ["inlinedResponses"], o);
  }
  const i = s(e, [
    "inlinedEmbedContentResponses",
    "inlinedResponses"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["inlinedEmbedContentResponses"], o);
  }
  return t;
}
function yf(e) {
  const t = {}, n = s(e, ["predictionsFormat"]);
  n != null && u(t, ["format"], n);
  const r = s(e, [
    "gcsDestination",
    "outputUriPrefix"
  ]);
  r != null && u(t, ["gcsUri"], r);
  const i = s(e, [
    "bigqueryDestination",
    "outputUri"
  ]);
  return i != null && u(t, ["bigqueryUri"], i), t;
}
function _f(e) {
  const t = {}, n = s(e, ["format"]);
  n != null && u(t, ["predictionsFormat"], n);
  const r = s(e, ["gcsUri"]);
  r != null && u(t, ["gcsDestination", "outputUriPrefix"], r);
  const i = s(e, ["bigqueryUri"]);
  if (i != null && u(t, ["bigqueryDestination", "outputUri"], i), s(e, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(e, ["inlinedResponses"]) !== void 0)
    throw new Error("inlinedResponses parameter is not supported in Vertex AI.");
  if (s(e, ["inlinedEmbedContentResponses"]) !== void 0)
    throw new Error("inlinedEmbedContentResponses parameter is not supported in Vertex AI.");
  return t;
}
function Rn(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, [
    "metadata",
    "displayName"
  ]);
  r != null && u(t, ["displayName"], r);
  const i = s(e, ["metadata", "state"]);
  i != null && u(t, ["state"], Ul(i));
  const o = s(e, [
    "metadata",
    "createTime"
  ]);
  o != null && u(t, ["createTime"], o);
  const a = s(e, [
    "metadata",
    "endTime"
  ]);
  a != null && u(t, ["endTime"], a);
  const l = s(e, [
    "metadata",
    "updateTime"
  ]);
  l != null && u(t, ["updateTime"], l);
  const d = s(e, ["metadata", "model"]);
  d != null && u(t, ["model"], d);
  const c = s(e, ["metadata", "output"]);
  return c != null && u(t, ["dest"], mf(Dl(c))), t;
}
function Ji(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["displayName"]);
  r != null && u(t, ["displayName"], r);
  const i = s(e, ["state"]);
  i != null && u(t, ["state"], Ul(i));
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, ["createTime"]);
  a != null && u(t, ["createTime"], a);
  const l = s(e, ["startTime"]);
  l != null && u(t, ["startTime"], l);
  const d = s(e, ["endTime"]);
  d != null && u(t, ["endTime"], d);
  const c = s(e, ["updateTime"]);
  c != null && u(t, ["updateTime"], c);
  const f = s(e, ["model"]);
  f != null && u(t, ["model"], f);
  const p = s(e, ["inputConfig"]);
  p != null && u(t, ["src"], vf(p));
  const h = s(e, ["outputConfig"]);
  h != null && u(t, ["dest"], yf(Dl(h)));
  const g = s(e, [
    "completionStats"
  ]);
  return g != null && u(t, ["completionStats"], g), t;
}
function vf(e) {
  const t = {}, n = s(e, ["instancesFormat"]);
  n != null && u(t, ["format"], n);
  const r = s(e, ["gcsSource", "uris"]);
  r != null && u(t, ["gcsUri"], r);
  const i = s(e, [
    "bigquerySource",
    "inputUri"
  ]);
  return i != null && u(t, ["bigqueryUri"], i), t;
}
function Ef(e, t) {
  const n = {};
  if (s(t, ["format"]) !== void 0)
    throw new Error("format parameter is not supported in Gemini API.");
  if (s(t, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(t, ["bigqueryUri"]) !== void 0)
    throw new Error("bigqueryUri parameter is not supported in Gemini API.");
  const r = s(t, ["fileName"]);
  r != null && u(n, ["fileName"], r);
  const i = s(t, [
    "inlinedRequests"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => zf(e, a))), u(n, ["requests", "requests"], o);
  }
  return n;
}
function Tf(e) {
  const t = {}, n = s(e, ["format"]);
  n != null && u(t, ["instancesFormat"], n);
  const r = s(e, ["gcsUri"]);
  r != null && u(t, ["gcsSource", "uris"], r);
  const i = s(e, ["bigqueryUri"]);
  if (i != null && u(t, ["bigquerySource", "inputUri"], i), s(e, ["fileName"]) !== void 0)
    throw new Error("fileName parameter is not supported in Vertex AI.");
  if (s(e, ["inlinedRequests"]) !== void 0)
    throw new Error("inlinedRequests parameter is not supported in Vertex AI.");
  return t;
}
function Sf(e) {
  const t = {}, n = s(e, ["data"]);
  if (n != null && u(t, ["data"], n), s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function Cf(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function Af(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function wf(e) {
  const t = {}, n = s(e, ["content"]);
  n != null && u(t, ["content"], n);
  const r = s(e, [
    "citationMetadata"
  ]);
  r != null && u(t, ["citationMetadata"], If(r));
  const i = s(e, ["tokenCount"]);
  i != null && u(t, ["tokenCount"], i);
  const o = s(e, ["finishReason"]);
  o != null && u(t, ["finishReason"], o);
  const a = s(e, [
    "groundingMetadata"
  ]);
  a != null && u(t, ["groundingMetadata"], a);
  const l = s(e, ["avgLogprobs"]);
  l != null && u(t, ["avgLogprobs"], l);
  const d = s(e, ["index"]);
  d != null && u(t, ["index"], d);
  const c = s(e, [
    "logprobsResult"
  ]);
  c != null && u(t, ["logprobsResult"], c);
  const f = s(e, [
    "safetyRatings"
  ]);
  if (f != null) {
    let h = f;
    Array.isArray(h) && (h = h.map((g) => g)), u(t, ["safetyRatings"], h);
  }
  const p = s(e, [
    "urlContextMetadata"
  ]);
  return p != null && u(t, ["urlContextMetadata"], p), t;
}
function If(e) {
  const t = {}, n = s(e, ["citationSources"]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((i) => i)), u(t, ["citations"], r);
  }
  return t;
}
function bl(e) {
  const t = {}, n = s(e, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((o) => rh(o))), u(t, ["parts"], i);
  }
  const r = s(e, ["role"]);
  return r != null && u(t, ["role"], r), t;
}
function Rf(e, t) {
  const n = {}, r = s(e, ["displayName"]);
  if (t !== void 0 && r != null && u(t, ["batch", "displayName"], r), s(e, ["dest"]) !== void 0)
    throw new Error("dest parameter is not supported in Gemini API.");
  return n;
}
function Pf(e, t) {
  const n = {}, r = s(e, ["displayName"]);
  t !== void 0 && r != null && u(t, ["displayName"], r);
  const i = s(e, ["dest"]);
  return t !== void 0 && i != null && u(t, ["outputConfig"], _f(hf(i))), n;
}
function ra(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["_url", "model"], re(e, r));
  const i = s(t, ["src"]);
  i != null && u(n, ["batch", "inputConfig"], Ef(e, xl(e, i)));
  const o = s(t, ["config"]);
  return o != null && Rf(o, n), n;
}
function Nf(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["model"], re(e, r));
  const i = s(t, ["src"]);
  i != null && u(n, ["inputConfig"], Tf(xl(e, i)));
  const o = s(t, ["config"]);
  return o != null && Pf(o, n), n;
}
function kf(e, t) {
  const n = {}, r = s(e, ["displayName"]);
  return t !== void 0 && r != null && u(t, ["batch", "displayName"], r), n;
}
function Mf(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["_url", "model"], re(e, r));
  const i = s(t, ["src"]);
  i != null && u(n, ["batch", "inputConfig"], Ff(e, i));
  const o = s(t, ["config"]);
  return o != null && kf(o, n), n;
}
function xf(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function Df(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function Uf(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["name"]);
  r != null && u(t, ["name"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  return o != null && u(t, ["error"], o), t;
}
function bf(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["name"]);
  r != null && u(t, ["name"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  return o != null && u(t, ["error"], o), t;
}
function Lf(e, t) {
  const n = {}, r = s(t, ["contents"]);
  if (r != null) {
    let o = ao(e, r);
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["requests[]", "request", "content"], o);
  }
  const i = s(t, ["config"]);
  return i != null && (u(n, ["_self"], Of(i, n)), hd(n, { "requests[].*": "requests[].request.*" })), n;
}
function Of(e, t) {
  const n = {}, r = s(e, ["taskType"]);
  t !== void 0 && r != null && u(t, ["requests[]", "taskType"], r);
  const i = s(e, ["title"]);
  t !== void 0 && i != null && u(t, ["requests[]", "title"], i);
  const o = s(e, [
    "outputDimensionality"
  ]);
  if (t !== void 0 && o != null && u(t, ["requests[]", "outputDimensionality"], o), s(e, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(e, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return n;
}
function Ff(e, t) {
  const n = {}, r = s(t, ["fileName"]);
  r != null && u(n, ["file_name"], r);
  const i = s(t, [
    "inlinedRequests"
  ]);
  return i != null && u(n, ["requests"], Lf(e, i)), n;
}
function Gf(e) {
  const t = {};
  if (s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(e, ["fileUri"]);
  n != null && u(t, ["fileUri"], n);
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function qf(e) {
  const t = {}, n = s(e, ["id"]);
  n != null && u(t, ["id"], n);
  const r = s(e, ["args"]);
  r != null && u(t, ["args"], r);
  const i = s(e, ["name"]);
  if (i != null && u(t, ["name"], i), s(e, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(e, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return t;
}
function Bf(e) {
  const t = {}, n = s(e, [
    "allowedFunctionNames"
  ]);
  n != null && u(t, ["allowedFunctionNames"], n);
  const r = s(e, ["mode"]);
  if (r != null && u(t, ["mode"], r), s(e, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return t;
}
function Hf(e, t, n) {
  const r = {}, i = s(t, [
    "systemInstruction"
  ]);
  n !== void 0 && i != null && u(n, ["systemInstruction"], bl(ye(i)));
  const o = s(t, ["temperature"]);
  o != null && u(r, ["temperature"], o);
  const a = s(t, ["topP"]);
  a != null && u(r, ["topP"], a);
  const l = s(t, ["topK"]);
  l != null && u(r, ["topK"], l);
  const d = s(t, [
    "candidateCount"
  ]);
  d != null && u(r, ["candidateCount"], d);
  const c = s(t, [
    "maxOutputTokens"
  ]);
  c != null && u(r, ["maxOutputTokens"], c);
  const f = s(t, [
    "stopSequences"
  ]);
  f != null && u(r, ["stopSequences"], f);
  const p = s(t, [
    "responseLogprobs"
  ]);
  p != null && u(r, ["responseLogprobs"], p);
  const h = s(t, ["logprobs"]);
  h != null && u(r, ["logprobs"], h);
  const g = s(t, [
    "presencePenalty"
  ]);
  g != null && u(r, ["presencePenalty"], g);
  const m = s(t, [
    "frequencyPenalty"
  ]);
  m != null && u(r, ["frequencyPenalty"], m);
  const v = s(t, ["seed"]);
  v != null && u(r, ["seed"], v);
  const E = s(t, [
    "responseMimeType"
  ]);
  E != null && u(r, ["responseMimeType"], E);
  const T = s(t, [
    "responseSchema"
  ]);
  T != null && u(r, ["responseSchema"], lo(T));
  const C = s(t, [
    "responseJsonSchema"
  ]);
  if (C != null && u(r, ["responseJsonSchema"], C), s(t, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(t, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const w = s(t, [
    "safetySettings"
  ]);
  if (n !== void 0 && w != null) {
    let q = w;
    Array.isArray(q) && (q = q.map((J) => ih(J))), u(n, ["safetySettings"], q);
  }
  const D = s(t, ["tools"]);
  if (n !== void 0 && D != null) {
    let q = Et(D);
    Array.isArray(q) && (q = q.map((J) => sh(vt(J)))), u(n, ["tools"], q);
  }
  const _ = s(t, ["toolConfig"]);
  if (n !== void 0 && _ != null && u(n, ["toolConfig"], oh(_)), s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const y = s(t, [
    "cachedContent"
  ]);
  n !== void 0 && y != null && u(n, ["cachedContent"], Je(e, y));
  const S = s(t, [
    "responseModalities"
  ]);
  S != null && u(r, ["responseModalities"], S);
  const R = s(t, [
    "mediaResolution"
  ]);
  R != null && u(r, ["mediaResolution"], R);
  const P = s(t, ["speechConfig"]);
  if (P != null && u(r, ["speechConfig"], co(P)), s(t, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const N = s(t, [
    "thinkingConfig"
  ]);
  N != null && u(r, ["thinkingConfig"], N);
  const G = s(t, ["imageConfig"]);
  G != null && u(r, ["imageConfig"], Yf(G));
  const V = s(t, [
    "enableEnhancedCivicAnswers"
  ]);
  if (V != null && u(r, ["enableEnhancedCivicAnswers"], V), s(t, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return r;
}
function Vf(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["candidates"]);
  if (r != null) {
    let d = r;
    Array.isArray(d) && (d = d.map((c) => wf(c))), u(t, ["candidates"], d);
  }
  const i = s(e, ["modelVersion"]);
  i != null && u(t, ["modelVersion"], i);
  const o = s(e, [
    "promptFeedback"
  ]);
  o != null && u(t, ["promptFeedback"], o);
  const a = s(e, ["responseId"]);
  a != null && u(t, ["responseId"], a);
  const l = s(e, [
    "usageMetadata"
  ]);
  return l != null && u(t, ["usageMetadata"], l), t;
}
function Jf(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function $f(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Tt(e, r)), n;
}
function Wf(e) {
  const t = {}, n = s(e, ["authConfig"]);
  n != null && u(t, ["authConfig"], gf(n));
  const r = s(e, ["enableWidget"]);
  return r != null && u(t, ["enableWidget"], r), t;
}
function Kf(e) {
  const t = {}, n = s(e, ["searchTypes"]);
  if (n != null && u(t, ["searchTypes"], n), s(e, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(e, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const r = s(e, [
    "timeRangeFilter"
  ]);
  return r != null && u(t, ["timeRangeFilter"], r), t;
}
function Yf(e) {
  const t = {}, n = s(e, ["aspectRatio"]);
  n != null && u(t, ["aspectRatio"], n);
  const r = s(e, ["imageSize"]);
  if (r != null && u(t, ["imageSize"], r), s(e, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(e, ["prominentPeople"]) !== void 0)
    throw new Error("prominentPeople parameter is not supported in Gemini API.");
  if (s(e, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(e, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  if (s(e, ["imageOutputOptions"]) !== void 0)
    throw new Error("imageOutputOptions parameter is not supported in Gemini API.");
  return t;
}
function zf(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["request", "model"], re(e, r));
  const i = s(t, ["contents"]);
  if (i != null) {
    let l = Ae(i);
    Array.isArray(l) && (l = l.map((d) => bl(d))), u(n, ["request", "contents"], l);
  }
  const o = s(t, ["metadata"]);
  o != null && u(n, ["metadata"], o);
  const a = s(t, ["config"]);
  return a != null && u(n, ["request", "generationConfig"], Hf(e, a, s(n, ["request"], {}))), n;
}
function Xf(e) {
  const t = {}, n = s(e, ["response"]);
  n != null && u(t, ["response"], Vf(n));
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["error"]);
  return i != null && u(t, ["error"], i), t;
}
function Qf(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  if (t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), s(e, ["filter"]) !== void 0)
    throw new Error("filter parameter is not supported in Gemini API.");
  return n;
}
function Zf(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  t !== void 0 && i != null && u(t, ["_query", "pageToken"], i);
  const o = s(e, ["filter"]);
  return t !== void 0 && o != null && u(t, ["_query", "filter"], o), n;
}
function jf(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && Qf(n, t), t;
}
function eh(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && Zf(n, t), t;
}
function th(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, ["operations"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => Rn(a))), u(t, ["batchJobs"], o);
  }
  return t;
}
function nh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, [
    "batchPredictionJobs"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => Ji(a))), u(t, ["batchJobs"], o);
  }
  return t;
}
function rh(e) {
  const t = {}, n = s(e, [
    "mediaResolution"
  ]);
  n != null && u(t, ["mediaResolution"], n);
  const r = s(e, [
    "codeExecutionResult"
  ]);
  r != null && u(t, ["codeExecutionResult"], r);
  const i = s(e, [
    "executableCode"
  ]);
  i != null && u(t, ["executableCode"], i);
  const o = s(e, ["fileData"]);
  o != null && u(t, ["fileData"], Gf(o));
  const a = s(e, ["functionCall"]);
  a != null && u(t, ["functionCall"], qf(a));
  const l = s(e, [
    "functionResponse"
  ]);
  l != null && u(t, ["functionResponse"], l);
  const d = s(e, ["inlineData"]);
  d != null && u(t, ["inlineData"], Sf(d));
  const c = s(e, ["text"]);
  c != null && u(t, ["text"], c);
  const f = s(e, ["thought"]);
  f != null && u(t, ["thought"], f);
  const p = s(e, [
    "thoughtSignature"
  ]);
  p != null && u(t, ["thoughtSignature"], p);
  const h = s(e, [
    "videoMetadata"
  ]);
  return h != null && u(t, ["videoMetadata"], h), t;
}
function ih(e) {
  const t = {}, n = s(e, ["category"]);
  if (n != null && u(t, ["category"], n), s(e, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const r = s(e, ["threshold"]);
  return r != null && u(t, ["threshold"], r), t;
}
function oh(e) {
  const t = {}, n = s(e, [
    "retrievalConfig"
  ]);
  n != null && u(t, ["retrievalConfig"], n);
  const r = s(e, [
    "functionCallingConfig"
  ]);
  return r != null && u(t, ["functionCallingConfig"], Bf(r)), t;
}
function sh(e) {
  const t = {};
  if (s(e, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(e, ["computerUse"]);
  n != null && u(t, ["computerUse"], n);
  const r = s(e, ["fileSearch"]);
  r != null && u(t, ["fileSearch"], r);
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], Kf(i));
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], Wf(o));
  const a = s(e, [
    "codeExecution"
  ]);
  if (a != null && u(t, ["codeExecution"], a), s(e, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(e, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["functionDeclarations"], p);
  }
  const d = s(e, [
    "googleSearchRetrieval"
  ]);
  if (d != null && u(t, ["googleSearchRetrieval"], d), s(e, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(e, ["urlContext"]);
  c != null && u(t, ["urlContext"], c);
  const f = s(e, ["mcpServers"]);
  if (f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["mcpServers"], p);
  }
  return t;
}
var Oe;
(function(e) {
  e.PAGED_ITEM_BATCH_JOBS = "batchJobs", e.PAGED_ITEM_MODELS = "models", e.PAGED_ITEM_TUNING_JOBS = "tuningJobs", e.PAGED_ITEM_FILES = "files", e.PAGED_ITEM_CACHED_CONTENTS = "cachedContents", e.PAGED_ITEM_FILE_SEARCH_STORES = "fileSearchStores", e.PAGED_ITEM_DOCUMENTS = "documents";
})(Oe || (Oe = {}));
class Ye {
  constructor(t, n, r, i) {
    this.pageInternal = [], this.paramsInternal = {}, this.requestInternal = n, this.init(t, r, i);
  }
  init(t, n, r) {
    var i, o;
    this.nameInternal = t, this.pageInternal = n[this.nameInternal] || [], this.sdkHttpResponseInternal = n?.sdkHttpResponse, this.idxInternal = 0;
    let a = { config: {} };
    !r || Object.keys(r).length === 0 ? a = { config: {} } : typeof r == "object" ? a = Object.assign({}, r) : a = r, a.config && (a.config.pageToken = n.nextPageToken), this.paramsInternal = a, this.pageInternalSize = (o = (i = a.config) === null || i === void 0 ? void 0 : i.pageSize) !== null && o !== void 0 ? o : this.pageInternal.length;
  }
  initNextPage(t) {
    this.init(this.nameInternal, t, this.paramsInternal);
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
  getItem(t) {
    return this.pageInternal[t];
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
        const t = this.getItem(this.idxInternal);
        return this.idxInternal += 1, { value: t, done: !1 };
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
    const t = await this.requestInternal(this.params);
    return this.initNextPage(t), this.page;
  }
  /**
   * Returns true if there are more pages to fetch from the API.
   */
  hasNextPage() {
    var t;
    return ((t = this.params.config) === null || t === void 0 ? void 0 : t.pageToken) !== void 0;
  }
}
class Ll extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.list = async (n = {}) => new Ye(Oe.PAGED_ITEM_BATCH_JOBS, (r) => this.listInternal(r), await this.listInternal(n), n), this.create = async (n) => (this.apiClient.isVertexAI() && (n.config = this.formatDestination(n.src, n.config)), this.createInternal(n)), this.createEmbeddings = async (n) => {
      if (console.warn("batches.createEmbeddings() is experimental and may change without notice."), this.apiClient.isVertexAI())
        throw new Error("Vertex AI does not support batches.createEmbeddings.");
      return this.createEmbeddingsInternal(n);
    };
  }
  // Helper function to handle inlined generate content requests
  createInlinedGenerateContentRequest(t) {
    const n = ra(
      this.apiClient,
      // Use instance apiClient
      t
    ), r = n._url, i = z("{model}:batchGenerateContent", r), l = n.batch.inputConfig.requests, d = l.requests, c = [];
    for (const f of d) {
      const p = Object.assign({}, f);
      if (p.systemInstruction) {
        const h = p.systemInstruction;
        delete p.systemInstruction;
        const g = p.request;
        g.systemInstruction = h, p.request = g;
      }
      c.push(p);
    }
    return l.requests = c, delete n.config, delete n._url, delete n._query, { path: i, body: n };
  }
  // Helper function to get the first GCS URI
  getGcsUri(t) {
    if (typeof t == "string")
      return t.startsWith("gs://") ? t : void 0;
    if (!Array.isArray(t) && t.gcsUri && t.gcsUri.length > 0)
      return t.gcsUri[0];
  }
  // Helper function to get the BigQuery URI
  getBigqueryUri(t) {
    if (typeof t == "string")
      return t.startsWith("bq://") ? t : void 0;
    if (!Array.isArray(t))
      return t.bigqueryUri;
  }
  // Function to format the destination configuration for Vertex AI
  formatDestination(t, n) {
    const r = n ? Object.assign({}, n) : {}, i = Date.now().toString();
    if (r.displayName || (r.displayName = `genaiBatchJob_${i}`), r.dest === void 0) {
      const o = this.getGcsUri(t), a = this.getBigqueryUri(t);
      if (o)
        o.endsWith(".jsonl") ? r.dest = `${o.slice(0, -6)}/dest` : r.dest = `${o}_dest_${i}`;
      else if (a)
        r.dest = `${a}_dest_${i}`;
      else
        throw new Error("Unsupported source for Vertex AI: No GCS or BigQuery URI found.");
    }
    return r;
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Nf(this.apiClient, t);
      return l = z("batchPredictionJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ji(f));
    } else {
      const c = ra(this.apiClient, t);
      return l = z("{model}:batchGenerateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Rn(f));
    }
  }
  /**
   * Internal method to create batch job.
   *
   * @param params - The parameters for create batch job request.
   * @return The created batch job.
   *
   */
  async createEmbeddingsInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Mf(this.apiClient, t);
      return o = z("{model}:asyncBatchEmbedContent", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => Rn(d));
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
  async get(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = $f(this.apiClient, t);
      return l = z("batchPredictionJobs/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Ji(f));
    } else {
      const c = Jf(this.apiClient, t);
      return l = z("batches/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => Rn(f));
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
  async cancel(t) {
    var n, r, i, o;
    let a = "", l = {};
    if (this.apiClient.isVertexAI()) {
      const d = Af(this.apiClient, t);
      a = z("batchPredictionJobs/{name}:cancel", d._url), l = d._query, delete d._url, delete d._query, await this.apiClient.request({
        path: a,
        queryParams: l,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      });
    } else {
      const d = Cf(this.apiClient, t);
      a = z("batches/{name}:cancel", d._url), l = d._query, delete d._url, delete d._query, await this.apiClient.request({
        path: a,
        queryParams: l,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      });
    }
  }
  async listInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = eh(t);
      return l = z("batchPredictionJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = nh(f), h = new Hi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = jf(t);
      return l = z("batches", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = th(f), h = new Hi();
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
  async delete(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Df(this.apiClient, t);
      return l = z("batchPredictionJobs/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => bf(f));
    } else {
      const c = xf(this.apiClient, t);
      return l = z("batches/{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => Uf(f));
    }
  }
}
function ah(e) {
  const t = {}, n = s(e, ["apiKey"]);
  if (n != null && u(t, ["apiKey"], n), s(e, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(e, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(e, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(e, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return t;
}
function lh(e) {
  const t = {}, n = s(e, ["data"]);
  if (n != null && u(t, ["data"], n), s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function ia(e) {
  const t = {}, n = s(e, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((o) => Mh(o))), u(t, ["parts"], i);
  }
  const r = s(e, ["role"]);
  return r != null && u(t, ["role"], r), t;
}
function ch(e, t) {
  const n = {}, r = s(e, ["ttl"]);
  t !== void 0 && r != null && u(t, ["ttl"], r);
  const i = s(e, ["expireTime"]);
  t !== void 0 && i != null && u(t, ["expireTime"], i);
  const o = s(e, ["displayName"]);
  t !== void 0 && o != null && u(t, ["displayName"], o);
  const a = s(e, ["contents"]);
  if (t !== void 0 && a != null) {
    let f = Ae(a);
    Array.isArray(f) && (f = f.map((p) => ia(p))), u(t, ["contents"], f);
  }
  const l = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && l != null && u(t, ["systemInstruction"], ia(ye(l)));
  const d = s(e, ["tools"]);
  if (t !== void 0 && d != null) {
    let f = d;
    Array.isArray(f) && (f = f.map((p) => Dh(p))), u(t, ["tools"], f);
  }
  const c = s(e, ["toolConfig"]);
  if (t !== void 0 && c != null && u(t, ["toolConfig"], xh(c)), s(e, ["kmsKeyName"]) !== void 0)
    throw new Error("kmsKeyName parameter is not supported in Gemini API.");
  return n;
}
function uh(e, t) {
  const n = {}, r = s(e, ["ttl"]);
  t !== void 0 && r != null && u(t, ["ttl"], r);
  const i = s(e, ["expireTime"]);
  t !== void 0 && i != null && u(t, ["expireTime"], i);
  const o = s(e, ["displayName"]);
  t !== void 0 && o != null && u(t, ["displayName"], o);
  const a = s(e, ["contents"]);
  if (t !== void 0 && a != null) {
    let p = Ae(a);
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["contents"], p);
  }
  const l = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && l != null && u(t, ["systemInstruction"], ye(l));
  const d = s(e, ["tools"]);
  if (t !== void 0 && d != null) {
    let p = d;
    Array.isArray(p) && (p = p.map((h) => Uh(h))), u(t, ["tools"], p);
  }
  const c = s(e, ["toolConfig"]);
  t !== void 0 && c != null && u(t, ["toolConfig"], c);
  const f = s(e, ["kmsKeyName"]);
  return t !== void 0 && f != null && u(t, ["encryption_spec", "kmsKeyName"], f), n;
}
function dh(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["model"], Sl(e, r));
  const i = s(t, ["config"]);
  return i != null && ch(i, n), n;
}
function fh(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["model"], Sl(e, r));
  const i = s(t, ["config"]);
  return i != null && uh(i, n), n;
}
function hh(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Je(e, r)), n;
}
function ph(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Je(e, r)), n;
}
function gh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  return n != null && u(t, ["sdkHttpResponse"], n), t;
}
function mh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  return n != null && u(t, ["sdkHttpResponse"], n), t;
}
function yh(e) {
  const t = {};
  if (s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(e, ["fileUri"]);
  n != null && u(t, ["fileUri"], n);
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function _h(e) {
  const t = {}, n = s(e, ["id"]);
  n != null && u(t, ["id"], n);
  const r = s(e, ["args"]);
  r != null && u(t, ["args"], r);
  const i = s(e, ["name"]);
  if (i != null && u(t, ["name"], i), s(e, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(e, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return t;
}
function vh(e) {
  const t = {}, n = s(e, [
    "allowedFunctionNames"
  ]);
  n != null && u(t, ["allowedFunctionNames"], n);
  const r = s(e, ["mode"]);
  if (r != null && u(t, ["mode"], r), s(e, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return t;
}
function Eh(e) {
  const t = {}, n = s(e, ["description"]);
  n != null && u(t, ["description"], n);
  const r = s(e, ["name"]);
  r != null && u(t, ["name"], r);
  const i = s(e, ["parameters"]);
  i != null && u(t, ["parameters"], i);
  const o = s(e, [
    "parametersJsonSchema"
  ]);
  o != null && u(t, ["parametersJsonSchema"], o);
  const a = s(e, ["response"]);
  a != null && u(t, ["response"], a);
  const l = s(e, [
    "responseJsonSchema"
  ]);
  if (l != null && u(t, ["responseJsonSchema"], l), s(e, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return t;
}
function Th(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Je(e, r)), n;
}
function Sh(e, t) {
  const n = {}, r = s(t, ["name"]);
  return r != null && u(n, ["_url", "name"], Je(e, r)), n;
}
function Ch(e) {
  const t = {}, n = s(e, ["authConfig"]);
  n != null && u(t, ["authConfig"], ah(n));
  const r = s(e, ["enableWidget"]);
  return r != null && u(t, ["enableWidget"], r), t;
}
function Ah(e) {
  const t = {}, n = s(e, ["searchTypes"]);
  if (n != null && u(t, ["searchTypes"], n), s(e, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(e, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const r = s(e, [
    "timeRangeFilter"
  ]);
  return r != null && u(t, ["timeRangeFilter"], r), t;
}
function wh(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  return t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), n;
}
function Ih(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  return t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), n;
}
function Rh(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && wh(n, t), t;
}
function Ph(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && Ih(n, t), t;
}
function Nh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, [
    "cachedContents"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["cachedContents"], o);
  }
  return t;
}
function kh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, [
    "cachedContents"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["cachedContents"], o);
  }
  return t;
}
function Mh(e) {
  const t = {}, n = s(e, [
    "mediaResolution"
  ]);
  n != null && u(t, ["mediaResolution"], n);
  const r = s(e, [
    "codeExecutionResult"
  ]);
  r != null && u(t, ["codeExecutionResult"], r);
  const i = s(e, [
    "executableCode"
  ]);
  i != null && u(t, ["executableCode"], i);
  const o = s(e, ["fileData"]);
  o != null && u(t, ["fileData"], yh(o));
  const a = s(e, ["functionCall"]);
  a != null && u(t, ["functionCall"], _h(a));
  const l = s(e, [
    "functionResponse"
  ]);
  l != null && u(t, ["functionResponse"], l);
  const d = s(e, ["inlineData"]);
  d != null && u(t, ["inlineData"], lh(d));
  const c = s(e, ["text"]);
  c != null && u(t, ["text"], c);
  const f = s(e, ["thought"]);
  f != null && u(t, ["thought"], f);
  const p = s(e, [
    "thoughtSignature"
  ]);
  p != null && u(t, ["thoughtSignature"], p);
  const h = s(e, [
    "videoMetadata"
  ]);
  return h != null && u(t, ["videoMetadata"], h), t;
}
function xh(e) {
  const t = {}, n = s(e, [
    "retrievalConfig"
  ]);
  n != null && u(t, ["retrievalConfig"], n);
  const r = s(e, [
    "functionCallingConfig"
  ]);
  return r != null && u(t, ["functionCallingConfig"], vh(r)), t;
}
function Dh(e) {
  const t = {};
  if (s(e, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(e, ["computerUse"]);
  n != null && u(t, ["computerUse"], n);
  const r = s(e, ["fileSearch"]);
  r != null && u(t, ["fileSearch"], r);
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], Ah(i));
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], Ch(o));
  const a = s(e, [
    "codeExecution"
  ]);
  if (a != null && u(t, ["codeExecution"], a), s(e, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(e, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["functionDeclarations"], p);
  }
  const d = s(e, [
    "googleSearchRetrieval"
  ]);
  if (d != null && u(t, ["googleSearchRetrieval"], d), s(e, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(e, ["urlContext"]);
  c != null && u(t, ["urlContext"], c);
  const f = s(e, ["mcpServers"]);
  if (f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["mcpServers"], p);
  }
  return t;
}
function Uh(e) {
  const t = {}, n = s(e, ["retrieval"]);
  n != null && u(t, ["retrieval"], n);
  const r = s(e, ["computerUse"]);
  if (r != null && u(t, ["computerUse"], r), s(e, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], i);
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], o);
  const a = s(e, [
    "codeExecution"
  ]);
  a != null && u(t, ["codeExecution"], a);
  const l = s(e, [
    "enterpriseWebSearch"
  ]);
  l != null && u(t, ["enterpriseWebSearch"], l);
  const d = s(e, [
    "functionDeclarations"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((g) => Eh(g))), u(t, ["functionDeclarations"], h);
  }
  const c = s(e, [
    "googleSearchRetrieval"
  ]);
  c != null && u(t, ["googleSearchRetrieval"], c);
  const f = s(e, [
    "parallelAiSearch"
  ]);
  f != null && u(t, ["parallelAiSearch"], f);
  const p = s(e, ["urlContext"]);
  if (p != null && u(t, ["urlContext"], p), s(e, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return t;
}
function bh(e, t) {
  const n = {}, r = s(e, ["ttl"]);
  t !== void 0 && r != null && u(t, ["ttl"], r);
  const i = s(e, ["expireTime"]);
  return t !== void 0 && i != null && u(t, ["expireTime"], i), n;
}
function Lh(e, t) {
  const n = {}, r = s(e, ["ttl"]);
  t !== void 0 && r != null && u(t, ["ttl"], r);
  const i = s(e, ["expireTime"]);
  return t !== void 0 && i != null && u(t, ["expireTime"], i), n;
}
function Oh(e, t) {
  const n = {}, r = s(t, ["name"]);
  r != null && u(n, ["_url", "name"], Je(e, r));
  const i = s(t, ["config"]);
  return i != null && bh(i, n), n;
}
function Fh(e, t) {
  const n = {}, r = s(t, ["name"]);
  r != null && u(n, ["_url", "name"], Je(e, r));
  const i = s(t, ["config"]);
  return i != null && Lh(i, n), n;
}
class Ol extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.list = async (n = {}) => new Ye(Oe.PAGED_ITEM_CACHED_CONTENTS, (r) => this.listInternal(r), await this.listInternal(n), n);
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
  async create(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = fh(this.apiClient, t);
      return l = z("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = dh(this.apiClient, t);
      return l = z("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
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
  async get(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Sh(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = Th(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
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
  async delete(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = ph(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = mh(f), h = new qi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = hh(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = gh(f), h = new qi();
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
  async update(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Fh(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    } else {
      const c = Oh(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => f);
    }
  }
  async listInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Ph(t);
      return l = z("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = kh(f), h = new Bi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Rh(t);
      return l = z("cachedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Nh(f), h = new Bi();
        return Object.assign(h, p), h;
      });
    }
  }
}
function xn(e, t) {
  var n = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == "function")
    for (var i = 0, r = Object.getOwnPropertySymbols(e); i < r.length; i++)
      t.indexOf(r[i]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[i]) && (n[r[i]] = e[r[i]]);
  return n;
}
function oa(e) {
  var t = typeof Symbol == "function" && Symbol.iterator, n = t && e[t], r = 0;
  if (n) return n.call(e);
  if (e && typeof e.length == "number") return {
    next: function() {
      return e && r >= e.length && (e = void 0), { value: e && e[r++], done: !e };
    }
  };
  throw new TypeError(t ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function j(e) {
  return this instanceof j ? (this.v = e, this) : new j(e);
}
function xe(e, t, n) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var r = n.apply(e, t || []), i, o = [];
  return i = Object.create((typeof AsyncIterator == "function" ? AsyncIterator : Object).prototype), l("next"), l("throw"), l("return", a), i[Symbol.asyncIterator] = function() {
    return this;
  }, i;
  function a(g) {
    return function(m) {
      return Promise.resolve(m).then(g, p);
    };
  }
  function l(g, m) {
    r[g] && (i[g] = function(v) {
      return new Promise(function(E, T) {
        o.push([g, v, E, T]) > 1 || d(g, v);
      });
    }, m && (i[g] = m(i[g])));
  }
  function d(g, m) {
    try {
      c(r[g](m));
    } catch (v) {
      h(o[0][3], v);
    }
  }
  function c(g) {
    g.value instanceof j ? Promise.resolve(g.value.v).then(f, p) : h(o[0][2], g);
  }
  function f(g) {
    d("next", g);
  }
  function p(g) {
    d("throw", g);
  }
  function h(g, m) {
    g(m), o.shift(), o.length && d(o[0][0], o[0][1]);
  }
}
function De(e) {
  if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
  var t = e[Symbol.asyncIterator], n;
  return t ? t.call(e) : (e = typeof oa == "function" ? oa(e) : e[Symbol.iterator](), n = {}, r("next"), r("throw"), r("return"), n[Symbol.asyncIterator] = function() {
    return this;
  }, n);
  function r(o) {
    n[o] = e[o] && function(a) {
      return new Promise(function(l, d) {
        a = e[o](a), i(l, d, a.done, a.value);
      });
    };
  }
  function i(o, a, l, d) {
    Promise.resolve(d).then(function(c) {
      o({ value: c, done: l });
    }, a);
  }
}
function Gh(e) {
  var t;
  if (e.candidates == null || e.candidates.length === 0)
    return !1;
  const n = (t = e.candidates[0]) === null || t === void 0 ? void 0 : t.content;
  return n === void 0 ? !1 : Fl(n);
}
function Fl(e) {
  if (e.parts === void 0 || e.parts.length === 0)
    return !1;
  for (const t of e.parts)
    if (t === void 0 || Object.keys(t).length === 0)
      return !1;
  return !0;
}
function qh(e) {
  if (e.length !== 0) {
    for (const t of e)
      if (t.role !== "user" && t.role !== "model")
        throw new Error(`Role must be user or model, but got ${t.role}.`);
  }
}
function sa(e) {
  if (e === void 0 || e.length === 0)
    return [];
  const t = [], n = e.length;
  let r = 0;
  for (; r < n; )
    if (e[r].role === "user")
      t.push(e[r]), r++;
    else {
      const i = [];
      let o = !0;
      for (; r < n && e[r].role === "model"; )
        i.push(e[r]), o && !Fl(e[r]) && (o = !1), r++;
      o ? t.push(...i) : t.pop();
    }
  return t;
}
class Gl {
  constructor(t, n) {
    this.modelsModule = t, this.apiClient = n;
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
  create(t) {
    return new ql(
      this.apiClient,
      this.modelsModule,
      t.model,
      t.config,
      // Deep copy the history to avoid mutating the history outside of the
      // chat session.
      structuredClone(t.history)
    );
  }
}
class ql {
  constructor(t, n, r, i = {}, o = []) {
    this.apiClient = t, this.modelsModule = n, this.model = r, this.config = i, this.history = o, this.sendPromise = Promise.resolve(), qh(o);
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
  async sendMessage(t) {
    var n;
    await this.sendPromise;
    const r = ye(t.message), i = this.modelsModule.generateContent({
      model: this.model,
      contents: this.getHistory(!0).concat(r),
      config: (n = t.config) !== null && n !== void 0 ? n : this.config
    });
    return this.sendPromise = (async () => {
      var o, a, l;
      const d = await i, c = (a = (o = d.candidates) === null || o === void 0 ? void 0 : o[0]) === null || a === void 0 ? void 0 : a.content, f = d.automaticFunctionCallingHistory, p = this.getHistory(!0).length;
      let h = [];
      f != null && (h = (l = f.slice(p)) !== null && l !== void 0 ? l : []);
      const g = c ? [c] : [];
      this.recordHistory(r, g, h);
    })(), await this.sendPromise.catch(() => {
      this.sendPromise = Promise.resolve();
    }), i;
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
  async sendMessageStream(t) {
    var n;
    await this.sendPromise;
    const r = ye(t.message), i = this.modelsModule.generateContentStream({
      model: this.model,
      contents: this.getHistory(!0).concat(r),
      config: (n = t.config) !== null && n !== void 0 ? n : this.config
    });
    this.sendPromise = i.then(() => {
    }).catch(() => {
    });
    const o = await i;
    return this.processStreamResponse(o, r);
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
  getHistory(t = !1) {
    const n = t ? sa(this.history) : this.history;
    return structuredClone(n);
  }
  processStreamResponse(t, n) {
    return xe(this, arguments, function* () {
      var i, o, a, l, d, c;
      const f = [];
      try {
        for (var p = !0, h = De(t), g; g = yield j(h.next()), i = g.done, !i; p = !0) {
          l = g.value, p = !1;
          const m = l;
          if (Gh(m)) {
            const v = (c = (d = m.candidates) === null || d === void 0 ? void 0 : d[0]) === null || c === void 0 ? void 0 : c.content;
            v !== void 0 && f.push(v);
          }
          yield yield j(m);
        }
      } catch (m) {
        o = { error: m };
      } finally {
        try {
          !p && !i && (a = h.return) && (yield j(a.call(h)));
        } finally {
          if (o) throw o.error;
        }
      }
      this.recordHistory(n, f);
    });
  }
  recordHistory(t, n, r) {
    let i = [];
    n.length > 0 && n.every((o) => o.role !== void 0) ? i = n : i.push({
      role: "model",
      parts: []
    }), r && r.length > 0 ? this.history.push(...sa(r)) : this.history.push(t), this.history.push(...i);
  }
}
class pn extends Error {
  constructor(t) {
    super(t.message), this.name = "ApiError", this.status = t.status, Object.setPrototypeOf(this, pn.prototype);
  }
}
function Bh(e) {
  const t = {}, n = s(e, ["file"]);
  return n != null && u(t, ["file"], n), t;
}
function Hh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  return n != null && u(t, ["sdkHttpResponse"], n), t;
}
function Vh(e) {
  const t = {}, n = s(e, ["name"]);
  return n != null && u(t, ["_url", "file"], fo(n)), t;
}
function Jh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  return n != null && u(t, ["sdkHttpResponse"], n), t;
}
function $h(e) {
  const t = {}, n = s(e, ["name"]);
  return n != null && u(t, ["_url", "file"], fo(n)), t;
}
function Wh(e) {
  const t = {}, n = s(e, ["uris"]);
  return n != null && u(t, ["uris"], n), t;
}
function Kh(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  return t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), n;
}
function Yh(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && Kh(n, t), t;
}
function zh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, ["files"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["files"], o);
  }
  return t;
}
function Xh(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["files"]);
  if (r != null) {
    let i = r;
    Array.isArray(i) && (i = i.map((o) => o)), u(t, ["files"], i);
  }
  return t;
}
class Bl extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.list = async (n = {}) => new Ye(Oe.PAGED_ITEM_FILES, (r) => this.listInternal(r), await this.listInternal(n), n);
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
  async upload(t) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files. You can share files through a GCS bucket.");
    return this.apiClient.uploadFile(t.file, t.config).then((n) => n);
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
  async download(t) {
    await this.apiClient.downloadFile(t);
  }
  /**
   * Registers Google Cloud Storage files for use with the API.
   * This method is only available in Node.js environments.
   */
  async registerFiles(t) {
    throw new Error("registerFiles is only supported in Node.js environments.");
  }
  async _registerFiles(t) {
    return this.registerFilesInternal(t);
  }
  async listInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Yh(t);
      return o = z("files", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = zh(d), f = new ml();
        return Object.assign(f, c), f;
      });
    }
  }
  async createInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Bh(t);
      return o = z("upload/v1beta/files", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Hh(d), f = new yl();
        return Object.assign(f, c), f;
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
  async get(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = $h(t);
      return o = z("files/{file}", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
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
  async delete(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Vh(t);
      return o = z("files/{file}", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = Jh(d), f = new _l();
        return Object.assign(f, c), f;
      });
    }
  }
  async registerFilesInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Wh(t);
      return o = z("files:register", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Xh(d), f = new vl();
        return Object.assign(f, c), f;
      });
    }
  }
}
function Qh(e) {
  const t = {}, n = s(e, ["apiKey"]);
  if (n != null && u(t, ["apiKey"], n), s(e, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(e, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(e, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(e, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return t;
}
function Pn(e) {
  const t = {}, n = s(e, ["data"]);
  if (n != null && u(t, ["data"], n), s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function Zh(e) {
  const t = {}, n = s(e, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((o) => pp(o))), u(t, ["parts"], i);
  }
  const r = s(e, ["role"]);
  return r != null && u(t, ["role"], r), t;
}
function jh(e) {
  const t = {};
  if (s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(e, ["fileUri"]);
  n != null && u(t, ["fileUri"], n);
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function ep(e) {
  const t = {}, n = s(e, ["id"]);
  n != null && u(t, ["id"], n);
  const r = s(e, ["args"]);
  r != null && u(t, ["args"], r);
  const i = s(e, ["name"]);
  if (i != null && u(t, ["name"], i), s(e, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(e, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return t;
}
function tp(e) {
  const t = {}, n = s(e, ["description"]);
  n != null && u(t, ["description"], n);
  const r = s(e, ["name"]);
  r != null && u(t, ["name"], r);
  const i = s(e, ["parameters"]);
  i != null && u(t, ["parameters"], i);
  const o = s(e, [
    "parametersJsonSchema"
  ]);
  o != null && u(t, ["parametersJsonSchema"], o);
  const a = s(e, ["response"]);
  a != null && u(t, ["response"], a);
  const l = s(e, [
    "responseJsonSchema"
  ]);
  if (l != null && u(t, ["responseJsonSchema"], l), s(e, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return t;
}
function np(e) {
  const t = {}, n = s(e, [
    "modelSelectionConfig"
  ]);
  n != null && u(t, ["modelConfig"], n);
  const r = s(e, [
    "responseJsonSchema"
  ]);
  r != null && u(t, ["responseJsonSchema"], r);
  const i = s(e, [
    "audioTimestamp"
  ]);
  i != null && u(t, ["audioTimestamp"], i);
  const o = s(e, [
    "candidateCount"
  ]);
  o != null && u(t, ["candidateCount"], o);
  const a = s(e, [
    "enableAffectiveDialog"
  ]);
  a != null && u(t, ["enableAffectiveDialog"], a);
  const l = s(e, [
    "frequencyPenalty"
  ]);
  l != null && u(t, ["frequencyPenalty"], l);
  const d = s(e, ["logprobs"]);
  d != null && u(t, ["logprobs"], d);
  const c = s(e, [
    "maxOutputTokens"
  ]);
  c != null && u(t, ["maxOutputTokens"], c);
  const f = s(e, [
    "mediaResolution"
  ]);
  f != null && u(t, ["mediaResolution"], f);
  const p = s(e, [
    "presencePenalty"
  ]);
  p != null && u(t, ["presencePenalty"], p);
  const h = s(e, [
    "responseLogprobs"
  ]);
  h != null && u(t, ["responseLogprobs"], h);
  const g = s(e, [
    "responseMimeType"
  ]);
  g != null && u(t, ["responseMimeType"], g);
  const m = s(e, [
    "responseModalities"
  ]);
  m != null && u(t, ["responseModalities"], m);
  const v = s(e, [
    "responseSchema"
  ]);
  v != null && u(t, ["responseSchema"], v);
  const E = s(e, [
    "routingConfig"
  ]);
  E != null && u(t, ["routingConfig"], E);
  const T = s(e, ["seed"]);
  T != null && u(t, ["seed"], T);
  const C = s(e, ["speechConfig"]);
  C != null && u(t, ["speechConfig"], C);
  const w = s(e, [
    "stopSequences"
  ]);
  w != null && u(t, ["stopSequences"], w);
  const D = s(e, ["temperature"]);
  D != null && u(t, ["temperature"], D);
  const _ = s(e, [
    "thinkingConfig"
  ]);
  _ != null && u(t, ["thinkingConfig"], _);
  const y = s(e, ["topK"]);
  y != null && u(t, ["topK"], y);
  const S = s(e, ["topP"]);
  if (S != null && u(t, ["topP"], S), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return t;
}
function rp(e) {
  const t = {}, n = s(e, ["authConfig"]);
  n != null && u(t, ["authConfig"], Qh(n));
  const r = s(e, ["enableWidget"]);
  return r != null && u(t, ["enableWidget"], r), t;
}
function ip(e) {
  const t = {}, n = s(e, ["searchTypes"]);
  if (n != null && u(t, ["searchTypes"], n), s(e, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(e, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const r = s(e, [
    "timeRangeFilter"
  ]);
  return r != null && u(t, ["timeRangeFilter"], r), t;
}
function op(e, t) {
  const n = {}, r = s(e, [
    "generationConfig"
  ]);
  t !== void 0 && r != null && u(t, ["setup", "generationConfig"], r);
  const i = s(e, [
    "responseModalities"
  ]);
  t !== void 0 && i != null && u(t, ["setup", "generationConfig", "responseModalities"], i);
  const o = s(e, ["temperature"]);
  t !== void 0 && o != null && u(t, ["setup", "generationConfig", "temperature"], o);
  const a = s(e, ["topP"]);
  t !== void 0 && a != null && u(t, ["setup", "generationConfig", "topP"], a);
  const l = s(e, ["topK"]);
  t !== void 0 && l != null && u(t, ["setup", "generationConfig", "topK"], l);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  t !== void 0 && d != null && u(t, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(e, [
    "mediaResolution"
  ]);
  t !== void 0 && c != null && u(t, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(e, ["seed"]);
  t !== void 0 && f != null && u(t, ["setup", "generationConfig", "seed"], f);
  const p = s(e, ["speechConfig"]);
  t !== void 0 && p != null && u(t, ["setup", "generationConfig", "speechConfig"], uo(p));
  const h = s(e, [
    "thinkingConfig"
  ]);
  t !== void 0 && h != null && u(t, ["setup", "generationConfig", "thinkingConfig"], h);
  const g = s(e, [
    "enableAffectiveDialog"
  ]);
  t !== void 0 && g != null && u(t, ["setup", "generationConfig", "enableAffectiveDialog"], g);
  const m = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && m != null && u(t, ["setup", "systemInstruction"], Zh(ye(m)));
  const v = s(e, ["tools"]);
  if (t !== void 0 && v != null) {
    let y = Et(v);
    Array.isArray(y) && (y = y.map((S) => mp(vt(S)))), u(t, ["setup", "tools"], y);
  }
  const E = s(e, [
    "sessionResumption"
  ]);
  t !== void 0 && E != null && u(t, ["setup", "sessionResumption"], gp(E));
  const T = s(e, [
    "inputAudioTranscription"
  ]);
  t !== void 0 && T != null && u(t, ["setup", "inputAudioTranscription"], T);
  const C = s(e, [
    "outputAudioTranscription"
  ]);
  t !== void 0 && C != null && u(t, ["setup", "outputAudioTranscription"], C);
  const w = s(e, [
    "realtimeInputConfig"
  ]);
  t !== void 0 && w != null && u(t, ["setup", "realtimeInputConfig"], w);
  const D = s(e, [
    "contextWindowCompression"
  ]);
  t !== void 0 && D != null && u(t, ["setup", "contextWindowCompression"], D);
  const _ = s(e, ["proactivity"]);
  if (t !== void 0 && _ != null && u(t, ["setup", "proactivity"], _), s(e, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function sp(e, t) {
  const n = {}, r = s(e, [
    "generationConfig"
  ]);
  t !== void 0 && r != null && u(t, ["setup", "generationConfig"], np(r));
  const i = s(e, [
    "responseModalities"
  ]);
  t !== void 0 && i != null && u(t, ["setup", "generationConfig", "responseModalities"], i);
  const o = s(e, ["temperature"]);
  t !== void 0 && o != null && u(t, ["setup", "generationConfig", "temperature"], o);
  const a = s(e, ["topP"]);
  t !== void 0 && a != null && u(t, ["setup", "generationConfig", "topP"], a);
  const l = s(e, ["topK"]);
  t !== void 0 && l != null && u(t, ["setup", "generationConfig", "topK"], l);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  t !== void 0 && d != null && u(t, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(e, [
    "mediaResolution"
  ]);
  t !== void 0 && c != null && u(t, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(e, ["seed"]);
  t !== void 0 && f != null && u(t, ["setup", "generationConfig", "seed"], f);
  const p = s(e, ["speechConfig"]);
  t !== void 0 && p != null && u(t, ["setup", "generationConfig", "speechConfig"], uo(p));
  const h = s(e, [
    "thinkingConfig"
  ]);
  t !== void 0 && h != null && u(t, ["setup", "generationConfig", "thinkingConfig"], h);
  const g = s(e, [
    "enableAffectiveDialog"
  ]);
  t !== void 0 && g != null && u(t, ["setup", "generationConfig", "enableAffectiveDialog"], g);
  const m = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && m != null && u(t, ["setup", "systemInstruction"], ye(m));
  const v = s(e, ["tools"]);
  if (t !== void 0 && v != null) {
    let S = Et(v);
    Array.isArray(S) && (S = S.map((R) => yp(vt(R)))), u(t, ["setup", "tools"], S);
  }
  const E = s(e, [
    "sessionResumption"
  ]);
  t !== void 0 && E != null && u(t, ["setup", "sessionResumption"], E);
  const T = s(e, [
    "inputAudioTranscription"
  ]);
  t !== void 0 && T != null && u(t, ["setup", "inputAudioTranscription"], T);
  const C = s(e, [
    "outputAudioTranscription"
  ]);
  t !== void 0 && C != null && u(t, ["setup", "outputAudioTranscription"], C);
  const w = s(e, [
    "realtimeInputConfig"
  ]);
  t !== void 0 && w != null && u(t, ["setup", "realtimeInputConfig"], w);
  const D = s(e, [
    "contextWindowCompression"
  ]);
  t !== void 0 && D != null && u(t, ["setup", "contextWindowCompression"], D);
  const _ = s(e, ["proactivity"]);
  t !== void 0 && _ != null && u(t, ["setup", "proactivity"], _);
  const y = s(e, [
    "explicitVadSignal"
  ]);
  return t !== void 0 && y != null && u(t, ["setup", "explicitVadSignal"], y), n;
}
function ap(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["setup", "model"], re(e, r));
  const i = s(t, ["config"]);
  return i != null && u(n, ["config"], op(i, n)), n;
}
function lp(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["setup", "model"], re(e, r));
  const i = s(t, ["config"]);
  return i != null && u(n, ["config"], sp(i, n)), n;
}
function cp(e) {
  const t = {}, n = s(e, [
    "musicGenerationConfig"
  ]);
  return n != null && u(t, ["musicGenerationConfig"], n), t;
}
function up(e) {
  const t = {}, n = s(e, [
    "weightedPrompts"
  ]);
  if (n != null) {
    let r = n;
    Array.isArray(r) && (r = r.map((i) => i)), u(t, ["weightedPrompts"], r);
  }
  return t;
}
function dp(e) {
  const t = {}, n = s(e, ["media"]);
  if (n != null) {
    let c = Cl(n);
    Array.isArray(c) && (c = c.map((f) => Pn(f))), u(t, ["mediaChunks"], c);
  }
  const r = s(e, ["audio"]);
  r != null && u(t, ["audio"], Pn(wl(r)));
  const i = s(e, [
    "audioStreamEnd"
  ]);
  i != null && u(t, ["audioStreamEnd"], i);
  const o = s(e, ["video"]);
  o != null && u(t, ["video"], Pn(Al(o)));
  const a = s(e, ["text"]);
  a != null && u(t, ["text"], a);
  const l = s(e, [
    "activityStart"
  ]);
  l != null && u(t, ["activityStart"], l);
  const d = s(e, ["activityEnd"]);
  return d != null && u(t, ["activityEnd"], d), t;
}
function fp(e) {
  const t = {}, n = s(e, ["media"]);
  if (n != null) {
    let c = Cl(n);
    Array.isArray(c) && (c = c.map((f) => f)), u(t, ["mediaChunks"], c);
  }
  const r = s(e, ["audio"]);
  r != null && u(t, ["audio"], wl(r));
  const i = s(e, [
    "audioStreamEnd"
  ]);
  i != null && u(t, ["audioStreamEnd"], i);
  const o = s(e, ["video"]);
  o != null && u(t, ["video"], Al(o));
  const a = s(e, ["text"]);
  a != null && u(t, ["text"], a);
  const l = s(e, [
    "activityStart"
  ]);
  l != null && u(t, ["activityStart"], l);
  const d = s(e, ["activityEnd"]);
  return d != null && u(t, ["activityEnd"], d), t;
}
function hp(e) {
  const t = {}, n = s(e, [
    "setupComplete"
  ]);
  n != null && u(t, ["setupComplete"], n);
  const r = s(e, [
    "serverContent"
  ]);
  r != null && u(t, ["serverContent"], r);
  const i = s(e, ["toolCall"]);
  i != null && u(t, ["toolCall"], i);
  const o = s(e, [
    "toolCallCancellation"
  ]);
  o != null && u(t, ["toolCallCancellation"], o);
  const a = s(e, [
    "usageMetadata"
  ]);
  a != null && u(t, ["usageMetadata"], _p(a));
  const l = s(e, ["goAway"]);
  l != null && u(t, ["goAway"], l);
  const d = s(e, [
    "sessionResumptionUpdate"
  ]);
  d != null && u(t, ["sessionResumptionUpdate"], d);
  const c = s(e, [
    "voiceActivityDetectionSignal"
  ]);
  c != null && u(t, ["voiceActivityDetectionSignal"], c);
  const f = s(e, [
    "voiceActivity"
  ]);
  return f != null && u(t, ["voiceActivity"], vp(f)), t;
}
function pp(e) {
  const t = {}, n = s(e, [
    "mediaResolution"
  ]);
  n != null && u(t, ["mediaResolution"], n);
  const r = s(e, [
    "codeExecutionResult"
  ]);
  r != null && u(t, ["codeExecutionResult"], r);
  const i = s(e, [
    "executableCode"
  ]);
  i != null && u(t, ["executableCode"], i);
  const o = s(e, ["fileData"]);
  o != null && u(t, ["fileData"], jh(o));
  const a = s(e, ["functionCall"]);
  a != null && u(t, ["functionCall"], ep(a));
  const l = s(e, [
    "functionResponse"
  ]);
  l != null && u(t, ["functionResponse"], l);
  const d = s(e, ["inlineData"]);
  d != null && u(t, ["inlineData"], Pn(d));
  const c = s(e, ["text"]);
  c != null && u(t, ["text"], c);
  const f = s(e, ["thought"]);
  f != null && u(t, ["thought"], f);
  const p = s(e, [
    "thoughtSignature"
  ]);
  p != null && u(t, ["thoughtSignature"], p);
  const h = s(e, [
    "videoMetadata"
  ]);
  return h != null && u(t, ["videoMetadata"], h), t;
}
function gp(e) {
  const t = {}, n = s(e, ["handle"]);
  if (n != null && u(t, ["handle"], n), s(e, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return t;
}
function mp(e) {
  const t = {};
  if (s(e, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(e, ["computerUse"]);
  n != null && u(t, ["computerUse"], n);
  const r = s(e, ["fileSearch"]);
  r != null && u(t, ["fileSearch"], r);
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], ip(i));
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], rp(o));
  const a = s(e, [
    "codeExecution"
  ]);
  if (a != null && u(t, ["codeExecution"], a), s(e, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(e, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["functionDeclarations"], p);
  }
  const d = s(e, [
    "googleSearchRetrieval"
  ]);
  if (d != null && u(t, ["googleSearchRetrieval"], d), s(e, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(e, ["urlContext"]);
  c != null && u(t, ["urlContext"], c);
  const f = s(e, ["mcpServers"]);
  if (f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["mcpServers"], p);
  }
  return t;
}
function yp(e) {
  const t = {}, n = s(e, ["retrieval"]);
  n != null && u(t, ["retrieval"], n);
  const r = s(e, ["computerUse"]);
  if (r != null && u(t, ["computerUse"], r), s(e, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], i);
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], o);
  const a = s(e, [
    "codeExecution"
  ]);
  a != null && u(t, ["codeExecution"], a);
  const l = s(e, [
    "enterpriseWebSearch"
  ]);
  l != null && u(t, ["enterpriseWebSearch"], l);
  const d = s(e, [
    "functionDeclarations"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((g) => tp(g))), u(t, ["functionDeclarations"], h);
  }
  const c = s(e, [
    "googleSearchRetrieval"
  ]);
  c != null && u(t, ["googleSearchRetrieval"], c);
  const f = s(e, [
    "parallelAiSearch"
  ]);
  f != null && u(t, ["parallelAiSearch"], f);
  const p = s(e, ["urlContext"]);
  if (p != null && u(t, ["urlContext"], p), s(e, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return t;
}
function _p(e) {
  const t = {}, n = s(e, [
    "promptTokenCount"
  ]);
  n != null && u(t, ["promptTokenCount"], n);
  const r = s(e, [
    "cachedContentTokenCount"
  ]);
  r != null && u(t, ["cachedContentTokenCount"], r);
  const i = s(e, [
    "candidatesTokenCount"
  ]);
  i != null && u(t, ["responseTokenCount"], i);
  const o = s(e, [
    "toolUsePromptTokenCount"
  ]);
  o != null && u(t, ["toolUsePromptTokenCount"], o);
  const a = s(e, [
    "thoughtsTokenCount"
  ]);
  a != null && u(t, ["thoughtsTokenCount"], a);
  const l = s(e, [
    "totalTokenCount"
  ]);
  l != null && u(t, ["totalTokenCount"], l);
  const d = s(e, [
    "promptTokensDetails"
  ]);
  if (d != null) {
    let g = d;
    Array.isArray(g) && (g = g.map((m) => m)), u(t, ["promptTokensDetails"], g);
  }
  const c = s(e, [
    "cacheTokensDetails"
  ]);
  if (c != null) {
    let g = c;
    Array.isArray(g) && (g = g.map((m) => m)), u(t, ["cacheTokensDetails"], g);
  }
  const f = s(e, [
    "candidatesTokensDetails"
  ]);
  if (f != null) {
    let g = f;
    Array.isArray(g) && (g = g.map((m) => m)), u(t, ["responseTokensDetails"], g);
  }
  const p = s(e, [
    "toolUsePromptTokensDetails"
  ]);
  if (p != null) {
    let g = p;
    Array.isArray(g) && (g = g.map((m) => m)), u(t, ["toolUsePromptTokensDetails"], g);
  }
  const h = s(e, ["trafficType"]);
  return h != null && u(t, ["trafficType"], h), t;
}
function vp(e) {
  const t = {}, n = s(e, ["type"]);
  return n != null && u(t, ["voiceActivityType"], n), t;
}
function Ep(e, t) {
  const n = {}, r = s(e, ["apiKey"]);
  if (r != null && u(n, ["apiKey"], r), s(e, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(e, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(e, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(e, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return n;
}
function Tp(e, t) {
  const n = {}, r = s(e, ["data"]);
  if (r != null && u(n, ["data"], r), s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const i = s(e, ["mimeType"]);
  return i != null && u(n, ["mimeType"], i), n;
}
function Sp(e, t) {
  const n = {}, r = s(e, ["content"]);
  r != null && u(n, ["content"], r);
  const i = s(e, [
    "citationMetadata"
  ]);
  i != null && u(n, ["citationMetadata"], Cp(i));
  const o = s(e, ["tokenCount"]);
  o != null && u(n, ["tokenCount"], o);
  const a = s(e, ["finishReason"]);
  a != null && u(n, ["finishReason"], a);
  const l = s(e, [
    "groundingMetadata"
  ]);
  l != null && u(n, ["groundingMetadata"], l);
  const d = s(e, ["avgLogprobs"]);
  d != null && u(n, ["avgLogprobs"], d);
  const c = s(e, ["index"]);
  c != null && u(n, ["index"], c);
  const f = s(e, [
    "logprobsResult"
  ]);
  f != null && u(n, ["logprobsResult"], f);
  const p = s(e, [
    "safetyRatings"
  ]);
  if (p != null) {
    let g = p;
    Array.isArray(g) && (g = g.map((m) => m)), u(n, ["safetyRatings"], g);
  }
  const h = s(e, [
    "urlContextMetadata"
  ]);
  return h != null && u(n, ["urlContextMetadata"], h), n;
}
function Cp(e, t) {
  const n = {}, r = s(e, ["citationSources"]);
  if (r != null) {
    let i = r;
    Array.isArray(i) && (i = i.map((o) => o)), u(n, ["citations"], i);
  }
  return n;
}
function Ap(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let a = Ae(o);
    Array.isArray(a) && (a = a.map((l) => l)), u(r, ["contents"], a);
  }
  return r;
}
function wp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["tokensInfo"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["tokensInfo"], o);
  }
  return n;
}
function Ip(e, t) {
  const n = {}, r = s(e, ["values"]);
  r != null && u(n, ["values"], r);
  const i = s(e, ["statistics"]);
  return i != null && u(n, ["statistics"], Rp(i)), n;
}
function Rp(e, t) {
  const n = {}, r = s(e, ["truncated"]);
  r != null && u(n, ["truncated"], r);
  const i = s(e, ["token_count"]);
  return i != null && u(n, ["tokenCount"], i), n;
}
function gn(e, t) {
  const n = {}, r = s(e, ["parts"]);
  if (r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => Lg(a))), u(n, ["parts"], o);
  }
  const i = s(e, ["role"]);
  return i != null && u(n, ["role"], i), n;
}
function Pp(e, t) {
  const n = {}, r = s(e, ["controlType"]);
  r != null && u(n, ["controlType"], r);
  const i = s(e, [
    "enableControlImageComputation"
  ]);
  return i != null && u(n, ["computeControl"], i), n;
}
function Np(e, t) {
  const n = {};
  if (s(e, ["systemInstruction"]) !== void 0)
    throw new Error("systemInstruction parameter is not supported in Gemini API.");
  if (s(e, ["tools"]) !== void 0)
    throw new Error("tools parameter is not supported in Gemini API.");
  if (s(e, ["generationConfig"]) !== void 0)
    throw new Error("generationConfig parameter is not supported in Gemini API.");
  return n;
}
function kp(e, t, n) {
  const r = {}, i = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && i != null && u(t, ["systemInstruction"], ye(i));
  const o = s(e, ["tools"]);
  if (t !== void 0 && o != null) {
    let l = o;
    Array.isArray(l) && (l = l.map((d) => $l(d))), u(t, ["tools"], l);
  }
  const a = s(e, [
    "generationConfig"
  ]);
  return t !== void 0 && a != null && u(t, ["generationConfig"], Tg(a)), r;
}
function Mp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((d) => gn(d))), u(r, ["contents"], l);
  }
  const a = s(t, ["config"]);
  return a != null && Np(a), r;
}
function xp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((d) => d)), u(r, ["contents"], l);
  }
  const a = s(t, ["config"]);
  return a != null && kp(a, r), r;
}
function Dp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["totalTokens"]);
  i != null && u(n, ["totalTokens"], i);
  const o = s(e, [
    "cachedContentTokenCount"
  ]);
  return o != null && u(n, ["cachedContentTokenCount"], o), n;
}
function Up(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["totalTokens"]);
  return i != null && u(n, ["totalTokens"], i), n;
}
function bp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  return i != null && u(r, ["_url", "name"], re(e, i)), r;
}
function Lp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  return i != null && u(r, ["_url", "name"], re(e, i)), r;
}
function Op(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  return r != null && u(n, ["sdkHttpResponse"], r), n;
}
function Fp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  return r != null && u(n, ["sdkHttpResponse"], r), n;
}
function Gp(e, t, n) {
  const r = {}, i = s(e, ["outputGcsUri"]);
  t !== void 0 && i != null && u(t, ["parameters", "storageUri"], i);
  const o = s(e, [
    "negativePrompt"
  ]);
  t !== void 0 && o != null && u(t, ["parameters", "negativePrompt"], o);
  const a = s(e, [
    "numberOfImages"
  ]);
  t !== void 0 && a != null && u(t, ["parameters", "sampleCount"], a);
  const l = s(e, ["aspectRatio"]);
  t !== void 0 && l != null && u(t, ["parameters", "aspectRatio"], l);
  const d = s(e, [
    "guidanceScale"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "guidanceScale"], d);
  const c = s(e, ["seed"]);
  t !== void 0 && c != null && u(t, ["parameters", "seed"], c);
  const f = s(e, [
    "safetyFilterLevel"
  ]);
  t !== void 0 && f != null && u(t, ["parameters", "safetySetting"], f);
  const p = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && p != null && u(t, ["parameters", "personGeneration"], p);
  const h = s(e, [
    "includeSafetyAttributes"
  ]);
  t !== void 0 && h != null && u(t, ["parameters", "includeSafetyAttributes"], h);
  const g = s(e, [
    "includeRaiReason"
  ]);
  t !== void 0 && g != null && u(t, ["parameters", "includeRaiReason"], g);
  const m = s(e, ["language"]);
  t !== void 0 && m != null && u(t, ["parameters", "language"], m);
  const v = s(e, [
    "outputMimeType"
  ]);
  t !== void 0 && v != null && u(t, ["parameters", "outputOptions", "mimeType"], v);
  const E = s(e, [
    "outputCompressionQuality"
  ]);
  t !== void 0 && E != null && u(t, ["parameters", "outputOptions", "compressionQuality"], E);
  const T = s(e, ["addWatermark"]);
  t !== void 0 && T != null && u(t, ["parameters", "addWatermark"], T);
  const C = s(e, ["labels"]);
  t !== void 0 && C != null && u(t, ["labels"], C);
  const w = s(e, ["editMode"]);
  t !== void 0 && w != null && u(t, ["parameters", "editMode"], w);
  const D = s(e, ["baseSteps"]);
  return t !== void 0 && D != null && u(t, ["parameters", "editConfig", "baseSteps"], D), r;
}
function qp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["prompt"]);
  o != null && u(r, ["instances[0]", "prompt"], o);
  const a = s(t, [
    "referenceImages"
  ]);
  if (a != null) {
    let d = a;
    Array.isArray(d) && (d = d.map((c) => Hg(c))), u(r, ["instances[0]", "referenceImages"], d);
  }
  const l = s(t, ["config"]);
  return l != null && Gp(l, r), r;
}
function Bp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "predictions"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => qn(a))), u(n, ["generatedImages"], o);
  }
  return n;
}
function Hp(e, t, n) {
  const r = {}, i = s(e, ["taskType"]);
  t !== void 0 && i != null && u(t, ["requests[]", "taskType"], i);
  const o = s(e, ["title"]);
  t !== void 0 && o != null && u(t, ["requests[]", "title"], o);
  const a = s(e, [
    "outputDimensionality"
  ]);
  if (t !== void 0 && a != null && u(t, ["requests[]", "outputDimensionality"], a), s(e, ["mimeType"]) !== void 0)
    throw new Error("mimeType parameter is not supported in Gemini API.");
  if (s(e, ["autoTruncate"]) !== void 0)
    throw new Error("autoTruncate parameter is not supported in Gemini API.");
  return r;
}
function Vp(e, t, n) {
  const r = {};
  let i = s(n, [
    "embeddingApiType"
  ]);
  if (i === void 0 && (i = "PREDICT"), i === "PREDICT") {
    const c = s(e, ["taskType"]);
    t !== void 0 && c != null && u(t, ["instances[]", "task_type"], c);
  } else if (i === "EMBED_CONTENT") {
    const c = s(e, ["taskType"]);
    t !== void 0 && c != null && u(t, ["taskType"], c);
  }
  let o = s(n, [
    "embeddingApiType"
  ]);
  if (o === void 0 && (o = "PREDICT"), o === "PREDICT") {
    const c = s(e, ["title"]);
    t !== void 0 && c != null && u(t, ["instances[]", "title"], c);
  } else if (o === "EMBED_CONTENT") {
    const c = s(e, ["title"]);
    t !== void 0 && c != null && u(t, ["title"], c);
  }
  let a = s(n, [
    "embeddingApiType"
  ]);
  if (a === void 0 && (a = "PREDICT"), a === "PREDICT") {
    const c = s(e, [
      "outputDimensionality"
    ]);
    t !== void 0 && c != null && u(t, ["parameters", "outputDimensionality"], c);
  } else if (a === "EMBED_CONTENT") {
    const c = s(e, [
      "outputDimensionality"
    ]);
    t !== void 0 && c != null && u(t, ["outputDimensionality"], c);
  }
  let l = s(n, [
    "embeddingApiType"
  ]);
  if (l === void 0 && (l = "PREDICT"), l === "PREDICT") {
    const c = s(e, ["mimeType"]);
    t !== void 0 && c != null && u(t, ["instances[]", "mimeType"], c);
  }
  let d = s(n, [
    "embeddingApiType"
  ]);
  if (d === void 0 && (d = "PREDICT"), d === "PREDICT") {
    const c = s(e, [
      "autoTruncate"
    ]);
    t !== void 0 && c != null && u(t, ["parameters", "autoTruncate"], c);
  } else if (d === "EMBED_CONTENT") {
    const c = s(e, [
      "autoTruncate"
    ]);
    t !== void 0 && c != null && u(t, ["autoTruncate"], c);
  }
  return r;
}
function Jp(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let c = ao(e, o);
    Array.isArray(c) && (c = c.map((f) => f)), u(r, ["requests[]", "content"], c);
  }
  const a = s(t, ["content"]);
  a != null && gn(ye(a));
  const l = s(t, ["config"]);
  l != null && Hp(l, r);
  const d = s(t, ["model"]);
  return d !== void 0 && u(r, ["requests[]", "model"], re(e, d)), r;
}
function $p(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  let o = s(n, [
    "embeddingApiType"
  ]);
  if (o === void 0 && (o = "PREDICT"), o === "PREDICT") {
    const d = s(t, ["contents"]);
    if (d != null) {
      let c = ao(e, d);
      Array.isArray(c) && (c = c.map((f) => f)), u(r, ["instances[]", "content"], c);
    }
  }
  let a = s(n, [
    "embeddingApiType"
  ]);
  if (a === void 0 && (a = "PREDICT"), a === "EMBED_CONTENT") {
    const d = s(t, ["content"]);
    d != null && u(r, ["content"], ye(d));
  }
  const l = s(t, ["config"]);
  return l != null && Vp(l, r, n), r;
}
function Wp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["embeddings"]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => l)), u(n, ["embeddings"], a);
  }
  const o = s(e, ["metadata"]);
  return o != null && u(n, ["metadata"], o), n;
}
function Kp(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "predictions[]",
    "embeddings"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => Ip(l))), u(n, ["embeddings"], a);
  }
  const o = s(e, ["metadata"]);
  if (o != null && u(n, ["metadata"], o), t && s(t, ["embeddingApiType"]) === "EMBED_CONTENT") {
    const a = s(e, ["embedding"]), l = s(e, ["usageMetadata"]), d = s(e, ["truncated"]);
    if (a) {
      const c = {};
      l && l.promptTokenCount && (c.tokenCount = l.promptTokenCount), d && (c.truncated = d), a.statistics = c, u(n, ["embeddings"], [a]);
    }
  }
  return n;
}
function Yp(e, t) {
  const n = {}, r = s(e, ["endpoint"]);
  r != null && u(n, ["name"], r);
  const i = s(e, [
    "deployedModelId"
  ]);
  return i != null && u(n, ["deployedModelId"], i), n;
}
function zp(e, t) {
  const n = {};
  if (s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(e, ["fileUri"]);
  r != null && u(n, ["fileUri"], r);
  const i = s(e, ["mimeType"]);
  return i != null && u(n, ["mimeType"], i), n;
}
function Xp(e, t) {
  const n = {}, r = s(e, ["id"]);
  r != null && u(n, ["id"], r);
  const i = s(e, ["args"]);
  i != null && u(n, ["args"], i);
  const o = s(e, ["name"]);
  if (o != null && u(n, ["name"], o), s(e, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(e, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return n;
}
function Qp(e, t) {
  const n = {}, r = s(e, [
    "allowedFunctionNames"
  ]);
  r != null && u(n, ["allowedFunctionNames"], r);
  const i = s(e, ["mode"]);
  if (i != null && u(n, ["mode"], i), s(e, ["streamFunctionCallArguments"]) !== void 0)
    throw new Error("streamFunctionCallArguments parameter is not supported in Gemini API.");
  return n;
}
function Zp(e, t) {
  const n = {}, r = s(e, ["description"]);
  r != null && u(n, ["description"], r);
  const i = s(e, ["name"]);
  i != null && u(n, ["name"], i);
  const o = s(e, ["parameters"]);
  o != null && u(n, ["parameters"], o);
  const a = s(e, [
    "parametersJsonSchema"
  ]);
  a != null && u(n, ["parametersJsonSchema"], a);
  const l = s(e, ["response"]);
  l != null && u(n, ["response"], l);
  const d = s(e, [
    "responseJsonSchema"
  ]);
  if (d != null && u(n, ["responseJsonSchema"], d), s(e, ["behavior"]) !== void 0)
    throw new Error("behavior parameter is not supported in Vertex AI.");
  return n;
}
function jp(e, t, n, r) {
  const i = {}, o = s(t, [
    "systemInstruction"
  ]);
  n !== void 0 && o != null && u(n, ["systemInstruction"], gn(ye(o)));
  const a = s(t, ["temperature"]);
  a != null && u(i, ["temperature"], a);
  const l = s(t, ["topP"]);
  l != null && u(i, ["topP"], l);
  const d = s(t, ["topK"]);
  d != null && u(i, ["topK"], d);
  const c = s(t, [
    "candidateCount"
  ]);
  c != null && u(i, ["candidateCount"], c);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  f != null && u(i, ["maxOutputTokens"], f);
  const p = s(t, [
    "stopSequences"
  ]);
  p != null && u(i, ["stopSequences"], p);
  const h = s(t, [
    "responseLogprobs"
  ]);
  h != null && u(i, ["responseLogprobs"], h);
  const g = s(t, ["logprobs"]);
  g != null && u(i, ["logprobs"], g);
  const m = s(t, [
    "presencePenalty"
  ]);
  m != null && u(i, ["presencePenalty"], m);
  const v = s(t, [
    "frequencyPenalty"
  ]);
  v != null && u(i, ["frequencyPenalty"], v);
  const E = s(t, ["seed"]);
  E != null && u(i, ["seed"], E);
  const T = s(t, [
    "responseMimeType"
  ]);
  T != null && u(i, ["responseMimeType"], T);
  const C = s(t, [
    "responseSchema"
  ]);
  C != null && u(i, ["responseSchema"], lo(C));
  const w = s(t, [
    "responseJsonSchema"
  ]);
  if (w != null && u(i, ["responseJsonSchema"], w), s(t, ["routingConfig"]) !== void 0)
    throw new Error("routingConfig parameter is not supported in Gemini API.");
  if (s(t, ["modelSelectionConfig"]) !== void 0)
    throw new Error("modelSelectionConfig parameter is not supported in Gemini API.");
  const D = s(t, [
    "safetySettings"
  ]);
  if (n !== void 0 && D != null) {
    let J = D;
    Array.isArray(J) && (J = J.map((W) => Vg(W))), u(n, ["safetySettings"], J);
  }
  const _ = s(t, ["tools"]);
  if (n !== void 0 && _ != null) {
    let J = Et(_);
    Array.isArray(J) && (J = J.map((W) => Xg(vt(W)))), u(n, ["tools"], J);
  }
  const y = s(t, ["toolConfig"]);
  if (n !== void 0 && y != null && u(n, ["toolConfig"], zg(y)), s(t, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const S = s(t, [
    "cachedContent"
  ]);
  n !== void 0 && S != null && u(n, ["cachedContent"], Je(e, S));
  const R = s(t, [
    "responseModalities"
  ]);
  R != null && u(i, ["responseModalities"], R);
  const P = s(t, [
    "mediaResolution"
  ]);
  P != null && u(i, ["mediaResolution"], P);
  const N = s(t, ["speechConfig"]);
  if (N != null && u(i, ["speechConfig"], co(N)), s(t, ["audioTimestamp"]) !== void 0)
    throw new Error("audioTimestamp parameter is not supported in Gemini API.");
  const G = s(t, [
    "thinkingConfig"
  ]);
  G != null && u(i, ["thinkingConfig"], G);
  const V = s(t, ["imageConfig"]);
  V != null && u(i, ["imageConfig"], Ig(V));
  const q = s(t, [
    "enableEnhancedCivicAnswers"
  ]);
  if (q != null && u(i, ["enableEnhancedCivicAnswers"], q), s(t, ["modelArmorConfig"]) !== void 0)
    throw new Error("modelArmorConfig parameter is not supported in Gemini API.");
  return i;
}
function eg(e, t, n, r) {
  const i = {}, o = s(t, [
    "systemInstruction"
  ]);
  n !== void 0 && o != null && u(n, ["systemInstruction"], ye(o));
  const a = s(t, ["temperature"]);
  a != null && u(i, ["temperature"], a);
  const l = s(t, ["topP"]);
  l != null && u(i, ["topP"], l);
  const d = s(t, ["topK"]);
  d != null && u(i, ["topK"], d);
  const c = s(t, [
    "candidateCount"
  ]);
  c != null && u(i, ["candidateCount"], c);
  const f = s(t, [
    "maxOutputTokens"
  ]);
  f != null && u(i, ["maxOutputTokens"], f);
  const p = s(t, [
    "stopSequences"
  ]);
  p != null && u(i, ["stopSequences"], p);
  const h = s(t, [
    "responseLogprobs"
  ]);
  h != null && u(i, ["responseLogprobs"], h);
  const g = s(t, ["logprobs"]);
  g != null && u(i, ["logprobs"], g);
  const m = s(t, [
    "presencePenalty"
  ]);
  m != null && u(i, ["presencePenalty"], m);
  const v = s(t, [
    "frequencyPenalty"
  ]);
  v != null && u(i, ["frequencyPenalty"], v);
  const E = s(t, ["seed"]);
  E != null && u(i, ["seed"], E);
  const T = s(t, [
    "responseMimeType"
  ]);
  T != null && u(i, ["responseMimeType"], T);
  const C = s(t, [
    "responseSchema"
  ]);
  C != null && u(i, ["responseSchema"], lo(C));
  const w = s(t, [
    "responseJsonSchema"
  ]);
  w != null && u(i, ["responseJsonSchema"], w);
  const D = s(t, [
    "routingConfig"
  ]);
  D != null && u(i, ["routingConfig"], D);
  const _ = s(t, [
    "modelSelectionConfig"
  ]);
  _ != null && u(i, ["modelConfig"], _);
  const y = s(t, [
    "safetySettings"
  ]);
  if (n !== void 0 && y != null) {
    let Z = y;
    Array.isArray(Z) && (Z = Z.map((le) => le)), u(n, ["safetySettings"], Z);
  }
  const S = s(t, ["tools"]);
  if (n !== void 0 && S != null) {
    let Z = Et(S);
    Array.isArray(Z) && (Z = Z.map((le) => $l(vt(le)))), u(n, ["tools"], Z);
  }
  const R = s(t, ["toolConfig"]);
  n !== void 0 && R != null && u(n, ["toolConfig"], R);
  const P = s(t, ["labels"]);
  n !== void 0 && P != null && u(n, ["labels"], P);
  const N = s(t, [
    "cachedContent"
  ]);
  n !== void 0 && N != null && u(n, ["cachedContent"], Je(e, N));
  const G = s(t, [
    "responseModalities"
  ]);
  G != null && u(i, ["responseModalities"], G);
  const V = s(t, [
    "mediaResolution"
  ]);
  V != null && u(i, ["mediaResolution"], V);
  const q = s(t, ["speechConfig"]);
  q != null && u(i, ["speechConfig"], co(q));
  const J = s(t, [
    "audioTimestamp"
  ]);
  J != null && u(i, ["audioTimestamp"], J);
  const W = s(t, [
    "thinkingConfig"
  ]);
  W != null && u(i, ["thinkingConfig"], W);
  const $ = s(t, ["imageConfig"]);
  if ($ != null && u(i, ["imageConfig"], Rg($)), s(t, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  const X = s(t, [
    "modelArmorConfig"
  ]);
  return n !== void 0 && X != null && u(n, ["modelArmorConfig"], X), i;
}
function aa(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((d) => gn(d))), u(r, ["contents"], l);
  }
  const a = s(t, ["config"]);
  return a != null && u(r, ["generationConfig"], jp(e, a, r)), r;
}
function la(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["contents"]);
  if (o != null) {
    let l = Ae(o);
    Array.isArray(l) && (l = l.map((d) => d)), u(r, ["contents"], l);
  }
  const a = s(t, ["config"]);
  return a != null && u(r, ["generationConfig"], eg(e, a, r)), r;
}
function ca(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["candidates"]);
  if (i != null) {
    let c = i;
    Array.isArray(c) && (c = c.map((f) => Sp(f))), u(n, ["candidates"], c);
  }
  const o = s(e, ["modelVersion"]);
  o != null && u(n, ["modelVersion"], o);
  const a = s(e, [
    "promptFeedback"
  ]);
  a != null && u(n, ["promptFeedback"], a);
  const l = s(e, ["responseId"]);
  l != null && u(n, ["responseId"], l);
  const d = s(e, [
    "usageMetadata"
  ]);
  return d != null && u(n, ["usageMetadata"], d), n;
}
function ua(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["candidates"]);
  if (i != null) {
    let f = i;
    Array.isArray(f) && (f = f.map((p) => p)), u(n, ["candidates"], f);
  }
  const o = s(e, ["createTime"]);
  o != null && u(n, ["createTime"], o);
  const a = s(e, ["modelVersion"]);
  a != null && u(n, ["modelVersion"], a);
  const l = s(e, [
    "promptFeedback"
  ]);
  l != null && u(n, ["promptFeedback"], l);
  const d = s(e, ["responseId"]);
  d != null && u(n, ["responseId"], d);
  const c = s(e, [
    "usageMetadata"
  ]);
  return c != null && u(n, ["usageMetadata"], c), n;
}
function tg(e, t, n) {
  const r = {};
  if (s(e, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(e, ["negativePrompt"]) !== void 0)
    throw new Error("negativePrompt parameter is not supported in Gemini API.");
  const i = s(e, [
    "numberOfImages"
  ]);
  t !== void 0 && i != null && u(t, ["parameters", "sampleCount"], i);
  const o = s(e, ["aspectRatio"]);
  t !== void 0 && o != null && u(t, ["parameters", "aspectRatio"], o);
  const a = s(e, [
    "guidanceScale"
  ]);
  if (t !== void 0 && a != null && u(t, ["parameters", "guidanceScale"], a), s(e, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const l = s(e, [
    "safetyFilterLevel"
  ]);
  t !== void 0 && l != null && u(t, ["parameters", "safetySetting"], l);
  const d = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "personGeneration"], d);
  const c = s(e, [
    "includeSafetyAttributes"
  ]);
  t !== void 0 && c != null && u(t, ["parameters", "includeSafetyAttributes"], c);
  const f = s(e, [
    "includeRaiReason"
  ]);
  t !== void 0 && f != null && u(t, ["parameters", "includeRaiReason"], f);
  const p = s(e, ["language"]);
  t !== void 0 && p != null && u(t, ["parameters", "language"], p);
  const h = s(e, [
    "outputMimeType"
  ]);
  t !== void 0 && h != null && u(t, ["parameters", "outputOptions", "mimeType"], h);
  const g = s(e, [
    "outputCompressionQuality"
  ]);
  if (t !== void 0 && g != null && u(t, ["parameters", "outputOptions", "compressionQuality"], g), s(e, ["addWatermark"]) !== void 0)
    throw new Error("addWatermark parameter is not supported in Gemini API.");
  if (s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  const m = s(e, ["imageSize"]);
  if (t !== void 0 && m != null && u(t, ["parameters", "sampleImageSize"], m), s(e, ["enhancePrompt"]) !== void 0)
    throw new Error("enhancePrompt parameter is not supported in Gemini API.");
  return r;
}
function ng(e, t, n) {
  const r = {}, i = s(e, ["outputGcsUri"]);
  t !== void 0 && i != null && u(t, ["parameters", "storageUri"], i);
  const o = s(e, [
    "negativePrompt"
  ]);
  t !== void 0 && o != null && u(t, ["parameters", "negativePrompt"], o);
  const a = s(e, [
    "numberOfImages"
  ]);
  t !== void 0 && a != null && u(t, ["parameters", "sampleCount"], a);
  const l = s(e, ["aspectRatio"]);
  t !== void 0 && l != null && u(t, ["parameters", "aspectRatio"], l);
  const d = s(e, [
    "guidanceScale"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "guidanceScale"], d);
  const c = s(e, ["seed"]);
  t !== void 0 && c != null && u(t, ["parameters", "seed"], c);
  const f = s(e, [
    "safetyFilterLevel"
  ]);
  t !== void 0 && f != null && u(t, ["parameters", "safetySetting"], f);
  const p = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && p != null && u(t, ["parameters", "personGeneration"], p);
  const h = s(e, [
    "includeSafetyAttributes"
  ]);
  t !== void 0 && h != null && u(t, ["parameters", "includeSafetyAttributes"], h);
  const g = s(e, [
    "includeRaiReason"
  ]);
  t !== void 0 && g != null && u(t, ["parameters", "includeRaiReason"], g);
  const m = s(e, ["language"]);
  t !== void 0 && m != null && u(t, ["parameters", "language"], m);
  const v = s(e, [
    "outputMimeType"
  ]);
  t !== void 0 && v != null && u(t, ["parameters", "outputOptions", "mimeType"], v);
  const E = s(e, [
    "outputCompressionQuality"
  ]);
  t !== void 0 && E != null && u(t, ["parameters", "outputOptions", "compressionQuality"], E);
  const T = s(e, ["addWatermark"]);
  t !== void 0 && T != null && u(t, ["parameters", "addWatermark"], T);
  const C = s(e, ["labels"]);
  t !== void 0 && C != null && u(t, ["labels"], C);
  const w = s(e, ["imageSize"]);
  t !== void 0 && w != null && u(t, ["parameters", "sampleImageSize"], w);
  const D = s(e, [
    "enhancePrompt"
  ]);
  return t !== void 0 && D != null && u(t, ["parameters", "enhancePrompt"], D), r;
}
function rg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["prompt"]);
  o != null && u(r, ["instances[0]", "prompt"], o);
  const a = s(t, ["config"]);
  return a != null && tg(a, r), r;
}
function ig(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["prompt"]);
  o != null && u(r, ["instances[0]", "prompt"], o);
  const a = s(t, ["config"]);
  return a != null && ng(a, r), r;
}
function og(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => yg(l))), u(n, ["generatedImages"], a);
  }
  const o = s(e, [
    "positivePromptSafetyAttributes"
  ]);
  return o != null && u(n, ["positivePromptSafetyAttributes"], Vl(o)), n;
}
function sg(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "predictions"
  ]);
  if (i != null) {
    let a = i;
    Array.isArray(a) && (a = a.map((l) => qn(l))), u(n, ["generatedImages"], a);
  }
  const o = s(e, [
    "positivePromptSafetyAttributes"
  ]);
  return o != null && u(n, ["positivePromptSafetyAttributes"], Jl(o)), n;
}
function ag(e, t, n) {
  const r = {}, i = s(e, [
    "numberOfVideos"
  ]);
  if (t !== void 0 && i != null && u(t, ["parameters", "sampleCount"], i), s(e, ["outputGcsUri"]) !== void 0)
    throw new Error("outputGcsUri parameter is not supported in Gemini API.");
  if (s(e, ["fps"]) !== void 0)
    throw new Error("fps parameter is not supported in Gemini API.");
  const o = s(e, [
    "durationSeconds"
  ]);
  if (t !== void 0 && o != null && u(t, ["parameters", "durationSeconds"], o), s(e, ["seed"]) !== void 0)
    throw new Error("seed parameter is not supported in Gemini API.");
  const a = s(e, ["aspectRatio"]);
  t !== void 0 && a != null && u(t, ["parameters", "aspectRatio"], a);
  const l = s(e, ["resolution"]);
  t !== void 0 && l != null && u(t, ["parameters", "resolution"], l);
  const d = s(e, [
    "personGeneration"
  ]);
  if (t !== void 0 && d != null && u(t, ["parameters", "personGeneration"], d), s(e, ["pubsubTopic"]) !== void 0)
    throw new Error("pubsubTopic parameter is not supported in Gemini API.");
  const c = s(e, [
    "negativePrompt"
  ]);
  t !== void 0 && c != null && u(t, ["parameters", "negativePrompt"], c);
  const f = s(e, [
    "enhancePrompt"
  ]);
  if (t !== void 0 && f != null && u(t, ["parameters", "enhancePrompt"], f), s(e, ["generateAudio"]) !== void 0)
    throw new Error("generateAudio parameter is not supported in Gemini API.");
  const p = s(e, ["lastFrame"]);
  t !== void 0 && p != null && u(t, ["instances[0]", "lastFrame"], Bn(p));
  const h = s(e, [
    "referenceImages"
  ]);
  if (t !== void 0 && h != null) {
    let g = h;
    Array.isArray(g) && (g = g.map((m) => cm(m))), u(t, ["instances[0]", "referenceImages"], g);
  }
  if (s(e, ["mask"]) !== void 0)
    throw new Error("mask parameter is not supported in Gemini API.");
  if (s(e, ["compressionQuality"]) !== void 0)
    throw new Error("compressionQuality parameter is not supported in Gemini API.");
  return r;
}
function lg(e, t, n) {
  const r = {}, i = s(e, [
    "numberOfVideos"
  ]);
  t !== void 0 && i != null && u(t, ["parameters", "sampleCount"], i);
  const o = s(e, ["outputGcsUri"]);
  t !== void 0 && o != null && u(t, ["parameters", "storageUri"], o);
  const a = s(e, ["fps"]);
  t !== void 0 && a != null && u(t, ["parameters", "fps"], a);
  const l = s(e, [
    "durationSeconds"
  ]);
  t !== void 0 && l != null && u(t, ["parameters", "durationSeconds"], l);
  const d = s(e, ["seed"]);
  t !== void 0 && d != null && u(t, ["parameters", "seed"], d);
  const c = s(e, ["aspectRatio"]);
  t !== void 0 && c != null && u(t, ["parameters", "aspectRatio"], c);
  const f = s(e, ["resolution"]);
  t !== void 0 && f != null && u(t, ["parameters", "resolution"], f);
  const p = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && p != null && u(t, ["parameters", "personGeneration"], p);
  const h = s(e, ["pubsubTopic"]);
  t !== void 0 && h != null && u(t, ["parameters", "pubsubTopic"], h);
  const g = s(e, [
    "negativePrompt"
  ]);
  t !== void 0 && g != null && u(t, ["parameters", "negativePrompt"], g);
  const m = s(e, [
    "enhancePrompt"
  ]);
  t !== void 0 && m != null && u(t, ["parameters", "enhancePrompt"], m);
  const v = s(e, [
    "generateAudio"
  ]);
  t !== void 0 && v != null && u(t, ["parameters", "generateAudio"], v);
  const E = s(e, ["lastFrame"]);
  t !== void 0 && E != null && u(t, ["instances[0]", "lastFrame"], Ue(E));
  const T = s(e, [
    "referenceImages"
  ]);
  if (t !== void 0 && T != null) {
    let D = T;
    Array.isArray(D) && (D = D.map((_) => um(_))), u(t, ["instances[0]", "referenceImages"], D);
  }
  const C = s(e, ["mask"]);
  t !== void 0 && C != null && u(t, ["instances[0]", "mask"], lm(C));
  const w = s(e, [
    "compressionQuality"
  ]);
  return t !== void 0 && w != null && u(t, ["parameters", "compressionQuality"], w), r;
}
function cg(e, t) {
  const n = {}, r = s(e, ["name"]);
  r != null && u(n, ["name"], r);
  const i = s(e, ["metadata"]);
  i != null && u(n, ["metadata"], i);
  const o = s(e, ["done"]);
  o != null && u(n, ["done"], o);
  const a = s(e, ["error"]);
  a != null && u(n, ["error"], a);
  const l = s(e, [
    "response",
    "generateVideoResponse"
  ]);
  return l != null && u(n, ["response"], hg(l)), n;
}
function ug(e, t) {
  const n = {}, r = s(e, ["name"]);
  r != null && u(n, ["name"], r);
  const i = s(e, ["metadata"]);
  i != null && u(n, ["metadata"], i);
  const o = s(e, ["done"]);
  o != null && u(n, ["done"], o);
  const a = s(e, ["error"]);
  a != null && u(n, ["error"], a);
  const l = s(e, ["response"]);
  return l != null && u(n, ["response"], pg(l)), n;
}
function dg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["prompt"]);
  o != null && u(r, ["instances[0]", "prompt"], o);
  const a = s(t, ["image"]);
  a != null && u(r, ["instances[0]", "image"], Bn(a));
  const l = s(t, ["video"]);
  l != null && u(r, ["instances[0]", "video"], Wl(l));
  const d = s(t, ["source"]);
  d != null && gg(d, r);
  const c = s(t, ["config"]);
  return c != null && ag(c, r), r;
}
function fg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["prompt"]);
  o != null && u(r, ["instances[0]", "prompt"], o);
  const a = s(t, ["image"]);
  a != null && u(r, ["instances[0]", "image"], Ue(a));
  const l = s(t, ["video"]);
  l != null && u(r, ["instances[0]", "video"], Kl(l));
  const d = s(t, ["source"]);
  d != null && mg(d, r);
  const c = s(t, ["config"]);
  return c != null && lg(c, r), r;
}
function hg(e, t) {
  const n = {}, r = s(e, [
    "generatedSamples"
  ]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => vg(l))), u(n, ["generatedVideos"], a);
  }
  const i = s(e, [
    "raiMediaFilteredCount"
  ]);
  i != null && u(n, ["raiMediaFilteredCount"], i);
  const o = s(e, [
    "raiMediaFilteredReasons"
  ]);
  return o != null && u(n, ["raiMediaFilteredReasons"], o), n;
}
function pg(e, t) {
  const n = {}, r = s(e, ["videos"]);
  if (r != null) {
    let a = r;
    Array.isArray(a) && (a = a.map((l) => Eg(l))), u(n, ["generatedVideos"], a);
  }
  const i = s(e, [
    "raiMediaFilteredCount"
  ]);
  i != null && u(n, ["raiMediaFilteredCount"], i);
  const o = s(e, [
    "raiMediaFilteredReasons"
  ]);
  return o != null && u(n, ["raiMediaFilteredReasons"], o), n;
}
function gg(e, t, n) {
  const r = {}, i = s(e, ["prompt"]);
  t !== void 0 && i != null && u(t, ["instances[0]", "prompt"], i);
  const o = s(e, ["image"]);
  t !== void 0 && o != null && u(t, ["instances[0]", "image"], Bn(o));
  const a = s(e, ["video"]);
  return t !== void 0 && a != null && u(t, ["instances[0]", "video"], Wl(a)), r;
}
function mg(e, t, n) {
  const r = {}, i = s(e, ["prompt"]);
  t !== void 0 && i != null && u(t, ["instances[0]", "prompt"], i);
  const o = s(e, ["image"]);
  t !== void 0 && o != null && u(t, ["instances[0]", "image"], Ue(o));
  const a = s(e, ["video"]);
  return t !== void 0 && a != null && u(t, ["instances[0]", "video"], Kl(a)), r;
}
function yg(e, t) {
  const n = {}, r = s(e, ["_self"]);
  r != null && u(n, ["image"], Pg(r));
  const i = s(e, [
    "raiFilteredReason"
  ]);
  i != null && u(n, ["raiFilteredReason"], i);
  const o = s(e, ["_self"]);
  return o != null && u(n, ["safetyAttributes"], Vl(o)), n;
}
function qn(e, t) {
  const n = {}, r = s(e, ["_self"]);
  r != null && u(n, ["image"], Hl(r));
  const i = s(e, [
    "raiFilteredReason"
  ]);
  i != null && u(n, ["raiFilteredReason"], i);
  const o = s(e, ["_self"]);
  o != null && u(n, ["safetyAttributes"], Jl(o));
  const a = s(e, ["prompt"]);
  return a != null && u(n, ["enhancedPrompt"], a), n;
}
function _g(e, t) {
  const n = {}, r = s(e, ["_self"]);
  r != null && u(n, ["mask"], Hl(r));
  const i = s(e, ["labels"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(n, ["labels"], o);
  }
  return n;
}
function vg(e, t) {
  const n = {}, r = s(e, ["video"]);
  return r != null && u(n, ["video"], sm(r)), n;
}
function Eg(e, t) {
  const n = {}, r = s(e, ["_self"]);
  return r != null && u(n, ["video"], am(r)), n;
}
function Tg(e, t) {
  const n = {}, r = s(e, [
    "modelSelectionConfig"
  ]);
  r != null && u(n, ["modelConfig"], r);
  const i = s(e, [
    "responseJsonSchema"
  ]);
  i != null && u(n, ["responseJsonSchema"], i);
  const o = s(e, [
    "audioTimestamp"
  ]);
  o != null && u(n, ["audioTimestamp"], o);
  const a = s(e, [
    "candidateCount"
  ]);
  a != null && u(n, ["candidateCount"], a);
  const l = s(e, [
    "enableAffectiveDialog"
  ]);
  l != null && u(n, ["enableAffectiveDialog"], l);
  const d = s(e, [
    "frequencyPenalty"
  ]);
  d != null && u(n, ["frequencyPenalty"], d);
  const c = s(e, ["logprobs"]);
  c != null && u(n, ["logprobs"], c);
  const f = s(e, [
    "maxOutputTokens"
  ]);
  f != null && u(n, ["maxOutputTokens"], f);
  const p = s(e, [
    "mediaResolution"
  ]);
  p != null && u(n, ["mediaResolution"], p);
  const h = s(e, [
    "presencePenalty"
  ]);
  h != null && u(n, ["presencePenalty"], h);
  const g = s(e, [
    "responseLogprobs"
  ]);
  g != null && u(n, ["responseLogprobs"], g);
  const m = s(e, [
    "responseMimeType"
  ]);
  m != null && u(n, ["responseMimeType"], m);
  const v = s(e, [
    "responseModalities"
  ]);
  v != null && u(n, ["responseModalities"], v);
  const E = s(e, [
    "responseSchema"
  ]);
  E != null && u(n, ["responseSchema"], E);
  const T = s(e, [
    "routingConfig"
  ]);
  T != null && u(n, ["routingConfig"], T);
  const C = s(e, ["seed"]);
  C != null && u(n, ["seed"], C);
  const w = s(e, ["speechConfig"]);
  w != null && u(n, ["speechConfig"], w);
  const D = s(e, [
    "stopSequences"
  ]);
  D != null && u(n, ["stopSequences"], D);
  const _ = s(e, ["temperature"]);
  _ != null && u(n, ["temperature"], _);
  const y = s(e, [
    "thinkingConfig"
  ]);
  y != null && u(n, ["thinkingConfig"], y);
  const S = s(e, ["topK"]);
  S != null && u(n, ["topK"], S);
  const R = s(e, ["topP"]);
  if (R != null && u(n, ["topP"], R), s(e, ["enableEnhancedCivicAnswers"]) !== void 0)
    throw new Error("enableEnhancedCivicAnswers parameter is not supported in Vertex AI.");
  return n;
}
function Sg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  return i != null && u(r, ["_url", "name"], re(e, i)), r;
}
function Cg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  return i != null && u(r, ["_url", "name"], re(e, i)), r;
}
function Ag(e, t) {
  const n = {}, r = s(e, ["authConfig"]);
  r != null && u(n, ["authConfig"], Ep(r));
  const i = s(e, ["enableWidget"]);
  return i != null && u(n, ["enableWidget"], i), n;
}
function wg(e, t) {
  const n = {}, r = s(e, ["searchTypes"]);
  if (r != null && u(n, ["searchTypes"], r), s(e, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(e, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const i = s(e, [
    "timeRangeFilter"
  ]);
  return i != null && u(n, ["timeRangeFilter"], i), n;
}
function Ig(e, t) {
  const n = {}, r = s(e, ["aspectRatio"]);
  r != null && u(n, ["aspectRatio"], r);
  const i = s(e, ["imageSize"]);
  if (i != null && u(n, ["imageSize"], i), s(e, ["personGeneration"]) !== void 0)
    throw new Error("personGeneration parameter is not supported in Gemini API.");
  if (s(e, ["prominentPeople"]) !== void 0)
    throw new Error("prominentPeople parameter is not supported in Gemini API.");
  if (s(e, ["outputMimeType"]) !== void 0)
    throw new Error("outputMimeType parameter is not supported in Gemini API.");
  if (s(e, ["outputCompressionQuality"]) !== void 0)
    throw new Error("outputCompressionQuality parameter is not supported in Gemini API.");
  if (s(e, ["imageOutputOptions"]) !== void 0)
    throw new Error("imageOutputOptions parameter is not supported in Gemini API.");
  return n;
}
function Rg(e, t) {
  const n = {}, r = s(e, ["aspectRatio"]);
  r != null && u(n, ["aspectRatio"], r);
  const i = s(e, ["imageSize"]);
  i != null && u(n, ["imageSize"], i);
  const o = s(e, [
    "personGeneration"
  ]);
  o != null && u(n, ["personGeneration"], o);
  const a = s(e, [
    "prominentPeople"
  ]);
  a != null && u(n, ["prominentPeople"], a);
  const l = s(e, [
    "outputMimeType"
  ]);
  l != null && u(n, ["imageOutputOptions", "mimeType"], l);
  const d = s(e, [
    "outputCompressionQuality"
  ]);
  d != null && u(n, ["imageOutputOptions", "compressionQuality"], d);
  const c = s(e, [
    "imageOutputOptions"
  ]);
  return c != null && u(n, ["imageOutputOptions"], c), n;
}
function Pg(e, t) {
  const n = {}, r = s(e, [
    "bytesBase64Encoded"
  ]);
  r != null && u(n, ["imageBytes"], Ke(r));
  const i = s(e, ["mimeType"]);
  return i != null && u(n, ["mimeType"], i), n;
}
function Hl(e, t) {
  const n = {}, r = s(e, ["gcsUri"]);
  r != null && u(n, ["gcsUri"], r);
  const i = s(e, [
    "bytesBase64Encoded"
  ]);
  i != null && u(n, ["imageBytes"], Ke(i));
  const o = s(e, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Bn(e, t) {
  const n = {};
  if (s(e, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  const r = s(e, ["imageBytes"]);
  r != null && u(n, ["bytesBase64Encoded"], Ke(r));
  const i = s(e, ["mimeType"]);
  return i != null && u(n, ["mimeType"], i), n;
}
function Ue(e, t) {
  const n = {}, r = s(e, ["gcsUri"]);
  r != null && u(n, ["gcsUri"], r);
  const i = s(e, ["imageBytes"]);
  i != null && u(n, ["bytesBase64Encoded"], Ke(i));
  const o = s(e, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function Ng(e, t, n, r) {
  const i = {}, o = s(t, ["pageSize"]);
  n !== void 0 && o != null && u(n, ["_query", "pageSize"], o);
  const a = s(t, ["pageToken"]);
  n !== void 0 && a != null && u(n, ["_query", "pageToken"], a);
  const l = s(t, ["filter"]);
  n !== void 0 && l != null && u(n, ["_query", "filter"], l);
  const d = s(t, ["queryBase"]);
  return n !== void 0 && d != null && u(n, ["_url", "models_url"], kl(e, d)), i;
}
function kg(e, t, n, r) {
  const i = {}, o = s(t, ["pageSize"]);
  n !== void 0 && o != null && u(n, ["_query", "pageSize"], o);
  const a = s(t, ["pageToken"]);
  n !== void 0 && a != null && u(n, ["_query", "pageToken"], a);
  const l = s(t, ["filter"]);
  n !== void 0 && l != null && u(n, ["_query", "filter"], l);
  const d = s(t, ["queryBase"]);
  return n !== void 0 && d != null && u(n, ["_url", "models_url"], kl(e, d)), i;
}
function Mg(e, t, n) {
  const r = {}, i = s(t, ["config"]);
  return i != null && Ng(e, i, r), r;
}
function xg(e, t, n) {
  const r = {}, i = s(t, ["config"]);
  return i != null && kg(e, i, r), r;
}
function Dg(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "nextPageToken"
  ]);
  i != null && u(n, ["nextPageToken"], i);
  const o = s(e, ["_self"]);
  if (o != null) {
    let a = Ml(o);
    Array.isArray(a) && (a = a.map((l) => $i(l))), u(n, ["models"], a);
  }
  return n;
}
function Ug(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "nextPageToken"
  ]);
  i != null && u(n, ["nextPageToken"], i);
  const o = s(e, ["_self"]);
  if (o != null) {
    let a = Ml(o);
    Array.isArray(a) && (a = a.map((l) => Wi(l))), u(n, ["models"], a);
  }
  return n;
}
function bg(e, t) {
  const n = {}, r = s(e, ["maskMode"]);
  r != null && u(n, ["maskMode"], r);
  const i = s(e, [
    "segmentationClasses"
  ]);
  i != null && u(n, ["maskClasses"], i);
  const o = s(e, ["maskDilation"]);
  return o != null && u(n, ["dilation"], o), n;
}
function $i(e, t) {
  const n = {}, r = s(e, ["name"]);
  r != null && u(n, ["name"], r);
  const i = s(e, ["displayName"]);
  i != null && u(n, ["displayName"], i);
  const o = s(e, ["description"]);
  o != null && u(n, ["description"], o);
  const a = s(e, ["version"]);
  a != null && u(n, ["version"], a);
  const l = s(e, ["_self"]);
  l != null && u(n, ["tunedModelInfo"], Qg(l));
  const d = s(e, [
    "inputTokenLimit"
  ]);
  d != null && u(n, ["inputTokenLimit"], d);
  const c = s(e, [
    "outputTokenLimit"
  ]);
  c != null && u(n, ["outputTokenLimit"], c);
  const f = s(e, [
    "supportedGenerationMethods"
  ]);
  f != null && u(n, ["supportedActions"], f);
  const p = s(e, ["temperature"]);
  p != null && u(n, ["temperature"], p);
  const h = s(e, [
    "maxTemperature"
  ]);
  h != null && u(n, ["maxTemperature"], h);
  const g = s(e, ["topP"]);
  g != null && u(n, ["topP"], g);
  const m = s(e, ["topK"]);
  m != null && u(n, ["topK"], m);
  const v = s(e, ["thinking"]);
  return v != null && u(n, ["thinking"], v), n;
}
function Wi(e, t) {
  const n = {}, r = s(e, ["name"]);
  r != null && u(n, ["name"], r);
  const i = s(e, ["displayName"]);
  i != null && u(n, ["displayName"], i);
  const o = s(e, ["description"]);
  o != null && u(n, ["description"], o);
  const a = s(e, ["versionId"]);
  a != null && u(n, ["version"], a);
  const l = s(e, ["deployedModels"]);
  if (l != null) {
    let h = l;
    Array.isArray(h) && (h = h.map((g) => Yp(g))), u(n, ["endpoints"], h);
  }
  const d = s(e, ["labels"]);
  d != null && u(n, ["labels"], d);
  const c = s(e, ["_self"]);
  c != null && u(n, ["tunedModelInfo"], Zg(c));
  const f = s(e, [
    "defaultCheckpointId"
  ]);
  f != null && u(n, ["defaultCheckpointId"], f);
  const p = s(e, ["checkpoints"]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((g) => g)), u(n, ["checkpoints"], h);
  }
  return n;
}
function Lg(e, t) {
  const n = {}, r = s(e, [
    "mediaResolution"
  ]);
  r != null && u(n, ["mediaResolution"], r);
  const i = s(e, [
    "codeExecutionResult"
  ]);
  i != null && u(n, ["codeExecutionResult"], i);
  const o = s(e, [
    "executableCode"
  ]);
  o != null && u(n, ["executableCode"], o);
  const a = s(e, ["fileData"]);
  a != null && u(n, ["fileData"], zp(a));
  const l = s(e, ["functionCall"]);
  l != null && u(n, ["functionCall"], Xp(l));
  const d = s(e, [
    "functionResponse"
  ]);
  d != null && u(n, ["functionResponse"], d);
  const c = s(e, ["inlineData"]);
  c != null && u(n, ["inlineData"], Tp(c));
  const f = s(e, ["text"]);
  f != null && u(n, ["text"], f);
  const p = s(e, ["thought"]);
  p != null && u(n, ["thought"], p);
  const h = s(e, [
    "thoughtSignature"
  ]);
  h != null && u(n, ["thoughtSignature"], h);
  const g = s(e, [
    "videoMetadata"
  ]);
  return g != null && u(n, ["videoMetadata"], g), n;
}
function Og(e, t) {
  const n = {}, r = s(e, ["productImage"]);
  return r != null && u(n, ["image"], Ue(r)), n;
}
function Fg(e, t, n) {
  const r = {}, i = s(e, [
    "numberOfImages"
  ]);
  t !== void 0 && i != null && u(t, ["parameters", "sampleCount"], i);
  const o = s(e, ["baseSteps"]);
  t !== void 0 && o != null && u(t, ["parameters", "baseSteps"], o);
  const a = s(e, ["outputGcsUri"]);
  t !== void 0 && a != null && u(t, ["parameters", "storageUri"], a);
  const l = s(e, ["seed"]);
  t !== void 0 && l != null && u(t, ["parameters", "seed"], l);
  const d = s(e, [
    "safetyFilterLevel"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "safetySetting"], d);
  const c = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && c != null && u(t, ["parameters", "personGeneration"], c);
  const f = s(e, ["addWatermark"]);
  t !== void 0 && f != null && u(t, ["parameters", "addWatermark"], f);
  const p = s(e, [
    "outputMimeType"
  ]);
  t !== void 0 && p != null && u(t, ["parameters", "outputOptions", "mimeType"], p);
  const h = s(e, [
    "outputCompressionQuality"
  ]);
  t !== void 0 && h != null && u(t, ["parameters", "outputOptions", "compressionQuality"], h);
  const g = s(e, [
    "enhancePrompt"
  ]);
  t !== void 0 && g != null && u(t, ["parameters", "enhancePrompt"], g);
  const m = s(e, ["labels"]);
  return t !== void 0 && m != null && u(t, ["labels"], m), r;
}
function Gg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["source"]);
  o != null && Bg(o, r);
  const a = s(t, ["config"]);
  return a != null && Fg(a, r), r;
}
function qg(e, t) {
  const n = {}, r = s(e, [
    "predictions"
  ]);
  if (r != null) {
    let i = r;
    Array.isArray(i) && (i = i.map((o) => qn(o))), u(n, ["generatedImages"], i);
  }
  return n;
}
function Bg(e, t, n) {
  const r = {}, i = s(e, ["prompt"]);
  t !== void 0 && i != null && u(t, ["instances[0]", "prompt"], i);
  const o = s(e, ["personImage"]);
  t !== void 0 && o != null && u(t, ["instances[0]", "personImage", "image"], Ue(o));
  const a = s(e, [
    "productImages"
  ]);
  if (t !== void 0 && a != null) {
    let l = a;
    Array.isArray(l) && (l = l.map((d) => Og(d))), u(t, ["instances[0]", "productImages"], l);
  }
  return r;
}
function Hg(e, t) {
  const n = {}, r = s(e, [
    "referenceImage"
  ]);
  r != null && u(n, ["referenceImage"], Ue(r));
  const i = s(e, ["referenceId"]);
  i != null && u(n, ["referenceId"], i);
  const o = s(e, [
    "referenceType"
  ]);
  o != null && u(n, ["referenceType"], o);
  const a = s(e, [
    "maskImageConfig"
  ]);
  a != null && u(n, ["maskImageConfig"], bg(a));
  const l = s(e, [
    "controlImageConfig"
  ]);
  l != null && u(n, ["controlImageConfig"], Pp(l));
  const d = s(e, [
    "styleImageConfig"
  ]);
  d != null && u(n, ["styleImageConfig"], d);
  const c = s(e, [
    "subjectImageConfig"
  ]);
  return c != null && u(n, ["subjectImageConfig"], c), n;
}
function Vl(e, t) {
  const n = {}, r = s(e, [
    "safetyAttributes",
    "categories"
  ]);
  r != null && u(n, ["categories"], r);
  const i = s(e, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && u(n, ["scores"], i);
  const o = s(e, ["contentType"]);
  return o != null && u(n, ["contentType"], o), n;
}
function Jl(e, t) {
  const n = {}, r = s(e, [
    "safetyAttributes",
    "categories"
  ]);
  r != null && u(n, ["categories"], r);
  const i = s(e, [
    "safetyAttributes",
    "scores"
  ]);
  i != null && u(n, ["scores"], i);
  const o = s(e, ["contentType"]);
  return o != null && u(n, ["contentType"], o), n;
}
function Vg(e, t) {
  const n = {}, r = s(e, ["category"]);
  if (r != null && u(n, ["category"], r), s(e, ["method"]) !== void 0)
    throw new Error("method parameter is not supported in Gemini API.");
  const i = s(e, ["threshold"]);
  return i != null && u(n, ["threshold"], i), n;
}
function Jg(e, t) {
  const n = {}, r = s(e, ["image"]);
  return r != null && u(n, ["image"], Ue(r)), n;
}
function $g(e, t, n) {
  const r = {}, i = s(e, ["mode"]);
  t !== void 0 && i != null && u(t, ["parameters", "mode"], i);
  const o = s(e, [
    "maxPredictions"
  ]);
  t !== void 0 && o != null && u(t, ["parameters", "maxPredictions"], o);
  const a = s(e, [
    "confidenceThreshold"
  ]);
  t !== void 0 && a != null && u(t, ["parameters", "confidenceThreshold"], a);
  const l = s(e, ["maskDilation"]);
  t !== void 0 && l != null && u(t, ["parameters", "maskDilation"], l);
  const d = s(e, [
    "binaryColorThreshold"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "binaryColorThreshold"], d);
  const c = s(e, ["labels"]);
  return t !== void 0 && c != null && u(t, ["labels"], c), r;
}
function Wg(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["source"]);
  o != null && Yg(o, r);
  const a = s(t, ["config"]);
  return a != null && $g(a, r), r;
}
function Kg(e, t) {
  const n = {}, r = s(e, ["predictions"]);
  if (r != null) {
    let i = r;
    Array.isArray(i) && (i = i.map((o) => _g(o))), u(n, ["generatedMasks"], i);
  }
  return n;
}
function Yg(e, t, n) {
  const r = {}, i = s(e, ["prompt"]);
  t !== void 0 && i != null && u(t, ["instances[0]", "prompt"], i);
  const o = s(e, ["image"]);
  t !== void 0 && o != null && u(t, ["instances[0]", "image"], Ue(o));
  const a = s(e, [
    "scribbleImage"
  ]);
  return t !== void 0 && a != null && u(t, ["instances[0]", "scribble"], Jg(a)), r;
}
function zg(e, t) {
  const n = {}, r = s(e, [
    "retrievalConfig"
  ]);
  r != null && u(n, ["retrievalConfig"], r);
  const i = s(e, [
    "functionCallingConfig"
  ]);
  return i != null && u(n, ["functionCallingConfig"], Qp(i)), n;
}
function Xg(e, t) {
  const n = {};
  if (s(e, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const r = s(e, ["computerUse"]);
  r != null && u(n, ["computerUse"], r);
  const i = s(e, ["fileSearch"]);
  i != null && u(n, ["fileSearch"], i);
  const o = s(e, ["googleSearch"]);
  o != null && u(n, ["googleSearch"], wg(o));
  const a = s(e, ["googleMaps"]);
  a != null && u(n, ["googleMaps"], Ag(a));
  const l = s(e, [
    "codeExecution"
  ]);
  if (l != null && u(n, ["codeExecution"], l), s(e, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const d = s(e, [
    "functionDeclarations"
  ]);
  if (d != null) {
    let h = d;
    Array.isArray(h) && (h = h.map((g) => g)), u(n, ["functionDeclarations"], h);
  }
  const c = s(e, [
    "googleSearchRetrieval"
  ]);
  if (c != null && u(n, ["googleSearchRetrieval"], c), s(e, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const f = s(e, ["urlContext"]);
  f != null && u(n, ["urlContext"], f);
  const p = s(e, ["mcpServers"]);
  if (p != null) {
    let h = p;
    Array.isArray(h) && (h = h.map((g) => g)), u(n, ["mcpServers"], h);
  }
  return n;
}
function $l(e, t) {
  const n = {}, r = s(e, ["retrieval"]);
  r != null && u(n, ["retrieval"], r);
  const i = s(e, ["computerUse"]);
  if (i != null && u(n, ["computerUse"], i), s(e, ["fileSearch"]) !== void 0)
    throw new Error("fileSearch parameter is not supported in Vertex AI.");
  const o = s(e, ["googleSearch"]);
  o != null && u(n, ["googleSearch"], o);
  const a = s(e, ["googleMaps"]);
  a != null && u(n, ["googleMaps"], a);
  const l = s(e, [
    "codeExecution"
  ]);
  l != null && u(n, ["codeExecution"], l);
  const d = s(e, [
    "enterpriseWebSearch"
  ]);
  d != null && u(n, ["enterpriseWebSearch"], d);
  const c = s(e, [
    "functionDeclarations"
  ]);
  if (c != null) {
    let g = c;
    Array.isArray(g) && (g = g.map((m) => Zp(m))), u(n, ["functionDeclarations"], g);
  }
  const f = s(e, [
    "googleSearchRetrieval"
  ]);
  f != null && u(n, ["googleSearchRetrieval"], f);
  const p = s(e, [
    "parallelAiSearch"
  ]);
  p != null && u(n, ["parallelAiSearch"], p);
  const h = s(e, ["urlContext"]);
  if (h != null && u(n, ["urlContext"], h), s(e, ["mcpServers"]) !== void 0)
    throw new Error("mcpServers parameter is not supported in Vertex AI.");
  return n;
}
function Qg(e, t) {
  const n = {}, r = s(e, ["baseModel"]);
  r != null && u(n, ["baseModel"], r);
  const i = s(e, ["createTime"]);
  i != null && u(n, ["createTime"], i);
  const o = s(e, ["updateTime"]);
  return o != null && u(n, ["updateTime"], o), n;
}
function Zg(e, t) {
  const n = {}, r = s(e, [
    "labels",
    "google-vertex-llm-tuning-base-model-id"
  ]);
  r != null && u(n, ["baseModel"], r);
  const i = s(e, ["createTime"]);
  i != null && u(n, ["createTime"], i);
  const o = s(e, ["updateTime"]);
  return o != null && u(n, ["updateTime"], o), n;
}
function jg(e, t, n) {
  const r = {}, i = s(e, ["displayName"]);
  t !== void 0 && i != null && u(t, ["displayName"], i);
  const o = s(e, ["description"]);
  t !== void 0 && o != null && u(t, ["description"], o);
  const a = s(e, [
    "defaultCheckpointId"
  ]);
  return t !== void 0 && a != null && u(t, ["defaultCheckpointId"], a), r;
}
function em(e, t, n) {
  const r = {}, i = s(e, ["displayName"]);
  t !== void 0 && i != null && u(t, ["displayName"], i);
  const o = s(e, ["description"]);
  t !== void 0 && o != null && u(t, ["description"], o);
  const a = s(e, [
    "defaultCheckpointId"
  ]);
  return t !== void 0 && a != null && u(t, ["defaultCheckpointId"], a), r;
}
function tm(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "name"], re(e, i));
  const o = s(t, ["config"]);
  return o != null && jg(o, r), r;
}
function nm(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["config"]);
  return o != null && em(o, r), r;
}
function rm(e, t, n) {
  const r = {}, i = s(e, ["outputGcsUri"]);
  t !== void 0 && i != null && u(t, ["parameters", "storageUri"], i);
  const o = s(e, [
    "safetyFilterLevel"
  ]);
  t !== void 0 && o != null && u(t, ["parameters", "safetySetting"], o);
  const a = s(e, [
    "personGeneration"
  ]);
  t !== void 0 && a != null && u(t, ["parameters", "personGeneration"], a);
  const l = s(e, [
    "includeRaiReason"
  ]);
  t !== void 0 && l != null && u(t, ["parameters", "includeRaiReason"], l);
  const d = s(e, [
    "outputMimeType"
  ]);
  t !== void 0 && d != null && u(t, ["parameters", "outputOptions", "mimeType"], d);
  const c = s(e, [
    "outputCompressionQuality"
  ]);
  t !== void 0 && c != null && u(t, ["parameters", "outputOptions", "compressionQuality"], c);
  const f = s(e, [
    "enhanceInputImage"
  ]);
  t !== void 0 && f != null && u(t, ["parameters", "upscaleConfig", "enhanceInputImage"], f);
  const p = s(e, [
    "imagePreservationFactor"
  ]);
  t !== void 0 && p != null && u(t, ["parameters", "upscaleConfig", "imagePreservationFactor"], p);
  const h = s(e, ["labels"]);
  t !== void 0 && h != null && u(t, ["labels"], h);
  const g = s(e, [
    "numberOfImages"
  ]);
  t !== void 0 && g != null && u(t, ["parameters", "sampleCount"], g);
  const m = s(e, ["mode"]);
  return t !== void 0 && m != null && u(t, ["parameters", "mode"], m), r;
}
function im(e, t, n) {
  const r = {}, i = s(t, ["model"]);
  i != null && u(r, ["_url", "model"], re(e, i));
  const o = s(t, ["image"]);
  o != null && u(r, ["instances[0]", "image"], Ue(o));
  const a = s(t, [
    "upscaleFactor"
  ]);
  a != null && u(r, ["parameters", "upscaleConfig", "upscaleFactor"], a);
  const l = s(t, ["config"]);
  return l != null && rm(l, r), r;
}
function om(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "predictions"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => qn(a))), u(n, ["generatedImages"], o);
  }
  return n;
}
function sm(e, t) {
  const n = {}, r = s(e, ["uri"]);
  r != null && u(n, ["uri"], r);
  const i = s(e, ["encodedVideo"]);
  i != null && u(n, ["videoBytes"], Ke(i));
  const o = s(e, ["encoding"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function am(e, t) {
  const n = {}, r = s(e, ["gcsUri"]);
  r != null && u(n, ["uri"], r);
  const i = s(e, [
    "bytesBase64Encoded"
  ]);
  i != null && u(n, ["videoBytes"], Ke(i));
  const o = s(e, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function lm(e, t) {
  const n = {}, r = s(e, ["image"]);
  r != null && u(n, ["_self"], Ue(r));
  const i = s(e, ["maskMode"]);
  return i != null && u(n, ["maskMode"], i), n;
}
function cm(e, t) {
  const n = {}, r = s(e, ["image"]);
  r != null && u(n, ["image"], Bn(r));
  const i = s(e, [
    "referenceType"
  ]);
  return i != null && u(n, ["referenceType"], i), n;
}
function um(e, t) {
  const n = {}, r = s(e, ["image"]);
  r != null && u(n, ["image"], Ue(r));
  const i = s(e, [
    "referenceType"
  ]);
  return i != null && u(n, ["referenceType"], i), n;
}
function Wl(e, t) {
  const n = {}, r = s(e, ["uri"]);
  r != null && u(n, ["uri"], r);
  const i = s(e, ["videoBytes"]);
  i != null && u(n, ["encodedVideo"], Ke(i));
  const o = s(e, ["mimeType"]);
  return o != null && u(n, ["encoding"], o), n;
}
function Kl(e, t) {
  const n = {}, r = s(e, ["uri"]);
  r != null && u(n, ["gcsUri"], r);
  const i = s(e, ["videoBytes"]);
  i != null && u(n, ["bytesBase64Encoded"], Ke(i));
  const o = s(e, ["mimeType"]);
  return o != null && u(n, ["mimeType"], o), n;
}
function dm(e, t) {
  const n = {}, r = s(e, ["displayName"]);
  return t !== void 0 && r != null && u(t, ["displayName"], r), n;
}
function fm(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && dm(n, t), t;
}
function hm(e, t) {
  const n = {}, r = s(e, ["force"]);
  return t !== void 0 && r != null && u(t, ["_query", "force"], r), n;
}
function pm(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["_url", "name"], n);
  const r = s(e, ["config"]);
  return r != null && hm(r, t), t;
}
function gm(e) {
  const t = {}, n = s(e, ["name"]);
  return n != null && u(t, ["_url", "name"], n), t;
}
function mm(e, t) {
  const n = {}, r = s(e, [
    "customMetadata"
  ]);
  if (t !== void 0 && r != null) {
    let o = r;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["customMetadata"], o);
  }
  const i = s(e, [
    "chunkingConfig"
  ]);
  return t !== void 0 && i != null && u(t, ["chunkingConfig"], i), n;
}
function ym(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["name"], n);
  const r = s(e, ["metadata"]);
  r != null && u(t, ["metadata"], r);
  const i = s(e, ["done"]);
  i != null && u(t, ["done"], i);
  const o = s(e, ["error"]);
  o != null && u(t, ["error"], o);
  const a = s(e, ["response"]);
  return a != null && u(t, ["response"], vm(a)), t;
}
function _m(e) {
  const t = {}, n = s(e, [
    "fileSearchStoreName"
  ]);
  n != null && u(t, ["_url", "file_search_store_name"], n);
  const r = s(e, ["fileName"]);
  r != null && u(t, ["fileName"], r);
  const i = s(e, ["config"]);
  return i != null && mm(i, t), t;
}
function vm(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, ["parent"]);
  r != null && u(t, ["parent"], r);
  const i = s(e, ["documentName"]);
  return i != null && u(t, ["documentName"], i), t;
}
function Em(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  return t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), n;
}
function Tm(e) {
  const t = {}, n = s(e, ["config"]);
  return n != null && Em(n, t), t;
}
function Sm(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, [
    "fileSearchStores"
  ]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["fileSearchStores"], o);
  }
  return t;
}
function Yl(e, t) {
  const n = {}, r = s(e, ["mimeType"]);
  t !== void 0 && r != null && u(t, ["mimeType"], r);
  const i = s(e, ["displayName"]);
  t !== void 0 && i != null && u(t, ["displayName"], i);
  const o = s(e, [
    "customMetadata"
  ]);
  if (t !== void 0 && o != null) {
    let l = o;
    Array.isArray(l) && (l = l.map((d) => d)), u(t, ["customMetadata"], l);
  }
  const a = s(e, [
    "chunkingConfig"
  ]);
  return t !== void 0 && a != null && u(t, ["chunkingConfig"], a), n;
}
function Cm(e) {
  const t = {}, n = s(e, [
    "fileSearchStoreName"
  ]);
  n != null && u(t, ["_url", "file_search_store_name"], n);
  const r = s(e, ["config"]);
  return r != null && Yl(r, t), t;
}
function Am(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  return n != null && u(t, ["sdkHttpResponse"], n), t;
}
const wm = "Content-Type", Im = "X-Server-Timeout", Rm = "User-Agent", Ki = "x-goog-api-client", Pm = "1.44.0", Nm = `google-genai-sdk/${Pm}`, km = "v1beta1", Mm = "v1beta", xm = 5, Dm = [
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
class Um {
  constructor(t) {
    var n, r, i;
    this.clientOptions = Object.assign({}, t), this.customBaseUrl = (n = t.httpOptions) === null || n === void 0 ? void 0 : n.baseUrl, this.clientOptions.vertexai && (this.clientOptions.project && this.clientOptions.location ? this.clientOptions.apiKey = void 0 : this.clientOptions.apiKey && (this.clientOptions.project = void 0, this.clientOptions.location = void 0));
    const o = {};
    if (this.clientOptions.vertexai) {
      if (!this.clientOptions.location && !this.clientOptions.apiKey && !this.customBaseUrl && (this.clientOptions.location = "global"), !(this.clientOptions.project && this.clientOptions.location || this.clientOptions.apiKey) && !this.customBaseUrl)
        throw new Error("Authentication is not set up. Please provide either a project and location, or an API key, or a custom base URL.");
      const l = t.project && t.location || !!t.apiKey;
      this.customBaseUrl && !l ? (o.baseUrl = this.customBaseUrl, this.clientOptions.project = void 0, this.clientOptions.location = void 0) : this.clientOptions.apiKey || this.clientOptions.location === "global" ? o.baseUrl = "https://aiplatform.googleapis.com/" : this.clientOptions.project && this.clientOptions.location && (o.baseUrl = `https://${this.clientOptions.location}-aiplatform.googleapis.com/`), o.apiVersion = (r = this.clientOptions.apiVersion) !== null && r !== void 0 ? r : km;
    } else
      this.clientOptions.apiKey || console.warn("API key should be set when using the Gemini API."), o.apiVersion = (i = this.clientOptions.apiVersion) !== null && i !== void 0 ? i : Mm, o.baseUrl = "https://generativelanguage.googleapis.com/";
    o.headers = this.getDefaultHeaders(), this.clientOptions.httpOptions = o, t.httpOptions && (this.clientOptions.httpOptions = this.patchHttpOptions(o, t.httpOptions));
  }
  isVertexAI() {
    var t;
    return (t = this.clientOptions.vertexai) !== null && t !== void 0 ? t : !1;
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
    const t = new Headers();
    return await this.clientOptions.auth.addAuthHeaders(t), t;
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
  getRequestUrlInternal(t) {
    if (!t || t.baseUrl === void 0 || t.apiVersion === void 0)
      throw new Error("HTTP options are not correctly set.");
    const r = [t.baseUrl.endsWith("/") ? t.baseUrl.slice(0, -1) : t.baseUrl];
    return t.apiVersion && t.apiVersion !== "" && r.push(t.apiVersion), r.join("/");
  }
  getBaseResourcePath() {
    return `projects/${this.clientOptions.project}/locations/${this.clientOptions.location}`;
  }
  getApiKey() {
    return this.clientOptions.apiKey;
  }
  getWebsocketBaseUrl() {
    const t = this.getBaseUrl(), n = new URL(t);
    return n.protocol = n.protocol == "http:" ? "ws" : "wss", n.toString();
  }
  setBaseUrl(t) {
    if (this.clientOptions.httpOptions)
      this.clientOptions.httpOptions.baseUrl = t;
    else
      throw new Error("HTTP options are not correctly set.");
  }
  constructUrl(t, n, r) {
    const i = [this.getRequestUrlInternal(n)];
    return r && i.push(this.getBaseResourcePath()), t !== "" && i.push(t), new URL(`${i.join("/")}`);
  }
  shouldPrependVertexProjectPath(t, n) {
    return !(n.baseUrl && n.baseUrlResourceScope === kn.COLLECTION || this.clientOptions.apiKey || !this.clientOptions.vertexai || t.path.startsWith("projects/") || t.httpMethod === "GET" && t.path.startsWith("publishers/google/models"));
  }
  async request(t) {
    let n = this.clientOptions.httpOptions;
    t.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, t.httpOptions));
    const r = this.shouldPrependVertexProjectPath(t, n), i = this.constructUrl(t.path, n, r);
    if (t.queryParams)
      for (const [a, l] of Object.entries(t.queryParams))
        i.searchParams.append(a, String(l));
    let o = {};
    if (t.httpMethod === "GET") {
      if (t.body && t.body !== "{}")
        throw new Error("Request body should be empty for GET request, but got non empty request body");
    } else
      o.body = t.body;
    return o = await this.includeExtraHttpOptionsToRequestInit(o, n, i.toString(), t.abortSignal), this.unaryApiCall(i, o, t.httpMethod);
  }
  patchHttpOptions(t, n) {
    const r = JSON.parse(JSON.stringify(t));
    for (const [i, o] of Object.entries(n))
      typeof o == "object" ? r[i] = Object.assign(Object.assign({}, r[i]), o) : o !== void 0 && (r[i] = o);
    return r;
  }
  async requestStream(t) {
    let n = this.clientOptions.httpOptions;
    t.httpOptions && (n = this.patchHttpOptions(this.clientOptions.httpOptions, t.httpOptions));
    const r = this.shouldPrependVertexProjectPath(t, n), i = this.constructUrl(t.path, n, r);
    (!i.searchParams.has("alt") || i.searchParams.get("alt") !== "sse") && i.searchParams.set("alt", "sse");
    let o = {};
    return o.body = t.body, o = await this.includeExtraHttpOptionsToRequestInit(o, n, i.toString(), t.abortSignal), this.streamApiCall(i, o, t.httpMethod);
  }
  async includeExtraHttpOptionsToRequestInit(t, n, r, i) {
    if (n && n.timeout || i) {
      const o = new AbortController(), a = o.signal;
      if (n.timeout && n?.timeout > 0) {
        const l = setTimeout(() => o.abort(), n.timeout);
        l && typeof l.unref == "function" && l.unref();
      }
      i && i.addEventListener("abort", () => {
        o.abort();
      }), t.signal = a;
    }
    return n && n.extraBody !== null && bm(t, n.extraBody), t.headers = await this.getHeadersInternal(n, r), t;
  }
  async unaryApiCall(t, n, r) {
    return this.apiCall(t.toString(), Object.assign(Object.assign({}, n), { method: r })).then(async (i) => (await da(i), new mt(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  async streamApiCall(t, n, r) {
    return this.apiCall(t.toString(), Object.assign(Object.assign({}, n), { method: r })).then(async (i) => (await da(i), this.processStreamResponse(i))).catch((i) => {
      throw i instanceof Error ? i : new Error(JSON.stringify(i));
    });
  }
  processStreamResponse(t) {
    return xe(this, arguments, function* () {
      var r;
      const i = (r = t?.body) === null || r === void 0 ? void 0 : r.getReader(), o = new TextDecoder("utf-8");
      if (!i)
        throw new Error("Response body is empty");
      try {
        let a = "";
        const l = "data:", d = [`

`, "\r\r", `\r
\r
`];
        for (; ; ) {
          const { done: c, value: f } = yield j(i.read());
          if (c) {
            if (a.trim().length > 0)
              throw new Error("Incomplete JSON segment at the end");
            break;
          }
          const p = o.decode(f, { stream: !0 });
          try {
            const m = JSON.parse(p);
            if ("error" in m) {
              const v = JSON.parse(JSON.stringify(m.error)), E = v.status, T = v.code, C = `got status: ${E}. ${JSON.stringify(m)}`;
              if (T >= 400 && T < 600)
                throw new pn({
                  message: C,
                  status: T
                });
            }
          } catch (m) {
            if (m.name === "ApiError")
              throw m;
          }
          a += p;
          let h = -1, g = 0;
          for (; ; ) {
            h = -1, g = 0;
            for (const E of d) {
              const T = a.indexOf(E);
              T !== -1 && (h === -1 || T < h) && (h = T, g = E.length);
            }
            if (h === -1)
              break;
            const m = a.substring(0, h);
            a = a.substring(h + g);
            const v = m.trim();
            if (v.startsWith(l)) {
              const E = v.substring(l.length).trim();
              try {
                const T = new Response(E, {
                  headers: t?.headers,
                  status: t?.status,
                  statusText: t?.statusText
                });
                yield yield j(new mt(T));
              } catch (T) {
                throw new Error(`exception parsing stream chunk ${E}. ${T}`);
              }
            }
          }
        }
      } finally {
        i.releaseLock();
      }
    });
  }
  async apiCall(t, n) {
    var r;
    if (!this.clientOptions.httpOptions || !this.clientOptions.httpOptions.retryOptions)
      return fetch(t, n);
    const i = this.clientOptions.httpOptions.retryOptions;
    return Wc(async () => {
      const a = await fetch(t, n);
      if (a.ok)
        return a;
      throw Dm.includes(a.status) ? new Error(`Retryable HTTP Error: ${a.statusText}`) : new wa.AbortError(`Non-retryable exception ${a.statusText} sending request`);
    }, {
      // Retry attempts is one less than the number of total attempts.
      retries: ((r = i.attempts) !== null && r !== void 0 ? r : xm) - 1
    });
  }
  getDefaultHeaders() {
    const t = {}, n = Nm + " " + this.clientOptions.userAgentExtra;
    return t[Rm] = n, t[Ki] = n, t[wm] = "application/json", t;
  }
  async getHeadersInternal(t, n) {
    const r = new Headers();
    if (t && t.headers) {
      for (const [i, o] of Object.entries(t.headers))
        r.append(i, o);
      t.timeout && t.timeout > 0 && r.append(Im, String(Math.ceil(t.timeout / 1e3)));
    }
    return await this.clientOptions.auth.addAuthHeaders(r, n), r;
  }
  getFileName(t) {
    var n;
    let r = "";
    return typeof t == "string" && (r = t.replace(/[/\\]+$/, ""), r = (n = r.split(/[/\\]/).pop()) !== null && n !== void 0 ? n : ""), r;
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
  async uploadFile(t, n) {
    var r;
    const i = {};
    n != null && (i.mimeType = n.mimeType, i.name = n.name, i.displayName = n.displayName), i.name && !i.name.startsWith("files/") && (i.name = `files/${i.name}`);
    const o = this.clientOptions.uploader, a = await o.stat(t);
    i.sizeBytes = String(a.size);
    const l = (r = n?.mimeType) !== null && r !== void 0 ? r : a.type;
    if (l === void 0 || l === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    i.mimeType = l;
    const d = {
      file: i
    }, c = this.getFileName(t), f = z("upload/v1beta/files", d._url), p = await this.fetchUploadUrl(f, i.sizeBytes, i.mimeType, c, d, n?.httpOptions);
    return o.upload(t, p, this);
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
  async uploadFileToFileSearchStore(t, n, r) {
    var i;
    const o = this.clientOptions.uploader, a = await o.stat(n), l = String(a.size), d = (i = r?.mimeType) !== null && i !== void 0 ? i : a.type;
    if (d === void 0 || d === "")
      throw new Error("Can not determine mimeType. Please provide mimeType in the config.");
    const c = `upload/v1beta/${t}:uploadToFileSearchStore`, f = this.getFileName(n), p = {};
    r != null && Yl(r, p);
    const h = await this.fetchUploadUrl(c, l, d, f, p, r?.httpOptions);
    return o.uploadToFileSearchStore(n, h, this);
  }
  /**
   * Downloads a file asynchronously to the specified path.
   *
   * @params params - The parameters for the download request, see {@link
   * types.DownloadFileParameters}
   */
  async downloadFile(t) {
    await this.clientOptions.downloader.download(t, this);
  }
  async fetchUploadUrl(t, n, r, i, o, a) {
    var l;
    let d = {};
    a ? d = a : d = {
      apiVersion: "",
      // api-version is set in the path.
      headers: Object.assign({ "Content-Type": "application/json", "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": `${n}`, "X-Goog-Upload-Header-Content-Type": `${r}` }, i ? { "X-Goog-Upload-File-Name": i } : {})
    };
    const c = await this.request({
      path: t,
      body: JSON.stringify(o),
      httpMethod: "POST",
      httpOptions: d
    });
    if (!c || !c?.headers)
      throw new Error("Server did not return an HttpResponse or the returned HttpResponse did not have headers.");
    const f = (l = c?.headers) === null || l === void 0 ? void 0 : l["x-goog-upload-url"];
    if (f === void 0)
      throw new Error("Failed to get upload url. Server did not return the x-google-upload-url in the headers");
    return f;
  }
}
async function da(e) {
  var t;
  if (e === void 0)
    throw new Error("response is undefined");
  if (!e.ok) {
    const n = e.status;
    let r;
    !((t = e.headers.get("content-type")) === null || t === void 0) && t.includes("application/json") ? r = await e.json() : r = {
      error: {
        message: await e.text(),
        code: e.status,
        status: e.statusText
      }
    };
    const i = JSON.stringify(r);
    throw n >= 400 && n < 600 ? new pn({
      message: i,
      status: n
    }) : new Error(i);
  }
}
function bm(e, t) {
  if (!t || Object.keys(t).length === 0)
    return;
  if (e.body instanceof Blob) {
    console.warn("includeExtraBodyToRequestInit: extraBody provided but current request body is a Blob. extraBody will be ignored as merging is not supported for Blob bodies.");
    return;
  }
  let n = {};
  if (typeof e.body == "string" && e.body.length > 0)
    try {
      const o = JSON.parse(e.body);
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
  function r(o, a) {
    const l = Object.assign({}, o);
    for (const d in a)
      if (Object.prototype.hasOwnProperty.call(a, d)) {
        const c = a[d], f = l[d];
        c && typeof c == "object" && !Array.isArray(c) && f && typeof f == "object" && !Array.isArray(f) ? l[d] = r(f, c) : (f && c && typeof f != typeof c && console.warn(`includeExtraBodyToRequestInit:deepMerge: Type mismatch for key "${d}". Original type: ${typeof f}, New type: ${typeof c}. Overwriting.`), l[d] = c);
      }
    return l;
  }
  const i = r(n, t);
  e.body = JSON.stringify(i);
}
const Lm = "mcp_used/unknown";
let zl = !1;
function Xl(e) {
  for (const t of e)
    if (Om(t) || typeof t == "object" && "inputSchema" in t)
      return !0;
  return zl;
}
function Ql(e) {
  var t;
  const n = (t = e[Ki]) !== null && t !== void 0 ? t : "";
  e[Ki] = (n + ` ${Lm}`).trimStart();
}
function Om(e) {
  return e !== null && typeof e == "object" && e instanceof un;
}
function Fm(e) {
  return xe(this, arguments, function* (n, r = 100) {
    let i, o = 0;
    for (; o < r; ) {
      const a = yield j(n.listTools({ cursor: i }));
      for (const l of a.tools)
        yield yield j(l), o++;
      if (!a.nextCursor)
        break;
      i = a.nextCursor;
    }
  });
}
class un {
  constructor(t = [], n) {
    this.mcpTools = [], this.functionNameToMcpClient = {}, this.mcpClients = t, this.config = n;
  }
  /**
   * Creates a McpCallableTool.
   */
  static create(t, n) {
    return new un(t, n);
  }
  /**
   * Validates the function names are not duplicate and initialize the function
   * name to MCP client mapping.
   *
   * @throws {Error} if the MCP tools from the MCP clients have duplicate tool
   *     names.
   */
  async initialize() {
    var t, n, r, i;
    if (this.mcpTools.length > 0)
      return;
    const o = {}, a = [];
    for (const f of this.mcpClients)
      try {
        for (var l = !0, d = (n = void 0, De(Fm(f))), c; c = await d.next(), t = c.done, !t; l = !0) {
          i = c.value, l = !1;
          const p = i;
          a.push(p);
          const h = p.name;
          if (o[h])
            throw new Error(`Duplicate function name ${h} found in MCP tools. Please ensure function names are unique.`);
          o[h] = f;
        }
      } catch (p) {
        n = { error: p };
      } finally {
        try {
          !l && !t && (r = d.return) && await r.call(d);
        } finally {
          if (n) throw n.error;
        }
      }
    this.mcpTools = a, this.functionNameToMcpClient = o;
  }
  async tool() {
    return await this.initialize(), ff(this.mcpTools, this.config);
  }
  async callTool(t) {
    await this.initialize();
    const n = [];
    for (const r of t)
      if (r.name in this.functionNameToMcpClient) {
        const i = this.functionNameToMcpClient[r.name];
        let o;
        this.config.timeout && (o = {
          timeout: this.config.timeout
        });
        const a = await i.callTool(
          {
            name: r.name,
            arguments: r.args
          },
          // Set the result schema to undefined to allow MCP to rely on the
          // default schema.
          void 0,
          o
        );
        n.push({
          functionResponse: {
            name: r.name,
            response: a.isError ? { error: a } : a
          }
        });
      }
    return n;
  }
}
function Gm(e) {
  return e !== null && typeof e == "object" && "listTools" in e && typeof e.listTools == "function";
}
function qm(...e) {
  if (zl = !0, e.length === 0)
    throw new Error("No MCP clients provided");
  const t = e[e.length - 1];
  return Gm(t) ? un.create(e, {}) : un.create(e.slice(0, e.length - 1), t);
}
async function Bm(e, t, n) {
  const r = new Tl();
  let i;
  n.data instanceof Blob ? i = JSON.parse(await n.data.text()) : i = JSON.parse(n.data), Object.assign(r, i), t(r);
}
class Hm {
  constructor(t, n, r) {
    this.apiClient = t, this.auth = n, this.webSocketFactory = r;
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
  async connect(t) {
    var n, r;
    if (this.apiClient.isVertexAI())
      throw new Error("Live music is not supported for Vertex AI.");
    console.warn("Live music generation is experimental and may change in future versions.");
    const i = this.apiClient.getWebsocketBaseUrl(), o = this.apiClient.getApiVersion(), a = $m(this.apiClient.getDefaultHeaders()), l = this.apiClient.getApiKey(), d = `${i}/ws/google.ai.generativelanguage.${o}.GenerativeService.BidiGenerateMusic?key=${l}`;
    let c = () => {
    };
    const f = new Promise((w) => {
      c = w;
    }), p = t.callbacks, h = function() {
      c({});
    }, g = this.apiClient, m = {
      onopen: h,
      onmessage: (w) => {
        Bm(g, p.onmessage, w);
      },
      onerror: (n = p?.onerror) !== null && n !== void 0 ? n : function(w) {
      },
      onclose: (r = p?.onclose) !== null && r !== void 0 ? r : function(w) {
      }
    }, v = this.webSocketFactory.create(d, Jm(a), m);
    v.connect(), await f;
    const C = { setup: { model: re(this.apiClient, t.model) } };
    return v.send(JSON.stringify(C)), new Vm(v, this.apiClient);
  }
}
class Vm {
  constructor(t, n) {
    this.conn = t, this.apiClient = n;
  }
  /**
      Sets inputs to steer music generation. Updates the session's current
      weighted prompts.
  
      @param params - Contains one property, `weightedPrompts`.
  
        - `weightedPrompts` to send to the model; weights are normalized to
          sum to 1.0.
  
      @experimental
     */
  async setWeightedPrompts(t) {
    if (!t.weightedPrompts || Object.keys(t.weightedPrompts).length === 0)
      throw new Error("Weighted prompts must be set and contain at least one entry.");
    const n = up(t);
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
  async setMusicGenerationConfig(t) {
    t.musicGenerationConfig || (t.musicGenerationConfig = {});
    const n = cp(t);
    this.conn.send(JSON.stringify(n));
  }
  sendPlaybackControl(t) {
    const n = { playbackControl: t };
    this.conn.send(JSON.stringify(n));
  }
  /**
   * Start the music stream.
   *
   * @experimental
   */
  play() {
    this.sendPlaybackControl(st.PLAY);
  }
  /**
   * Temporarily halt the music stream. Use `play` to resume from the current
   * position.
   *
   * @experimental
   */
  pause() {
    this.sendPlaybackControl(st.PAUSE);
  }
  /**
   * Stop the music stream and reset the state. Retains the current prompts
   * and config.
   *
   * @experimental
   */
  stop() {
    this.sendPlaybackControl(st.STOP);
  }
  /**
   * Resets the context of the music generation without stopping it.
   * Retains the current prompts and config.
   *
   * @experimental
   */
  resetContext() {
    this.sendPlaybackControl(st.RESET_CONTEXT);
  }
  /**
       Terminates the WebSocket connection.
  
       @experimental
     */
  close() {
    this.conn.close();
  }
}
function Jm(e) {
  const t = {};
  return e.forEach((n, r) => {
    t[r] = n;
  }), t;
}
function $m(e) {
  const t = new Headers();
  for (const [n, r] of Object.entries(e))
    t.append(n, r);
  return t;
}
const Wm = "FunctionResponse request must have an `id` field from the response of a ToolCall.FunctionalCalls in Google AI.";
async function Km(e, t, n) {
  const r = new El();
  let i;
  n.data instanceof Blob ? i = await n.data.text() : n.data instanceof ArrayBuffer ? i = new TextDecoder().decode(n.data) : i = n.data;
  const o = JSON.parse(i);
  if (e.isVertexAI()) {
    const a = hp(o);
    Object.assign(r, a);
  } else
    Object.assign(r, o);
  t(r);
}
class Zl {
  constructor(t, n, r) {
    this.apiClient = t, this.auth = n, this.webSocketFactory = r, this.music = new Hm(this.apiClient, this.auth, this.webSocketFactory);
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
  async connect(t) {
    var n, r, i, o, a, l;
    if (t.config && t.config.httpOptions)
      throw new Error("The Live module does not support httpOptions at request-level in LiveConnectConfig yet. Please use the client-level httpOptions configuration instead.");
    const d = this.apiClient.getWebsocketBaseUrl(), c = this.apiClient.getApiVersion();
    let f;
    const p = this.apiClient.getHeaders();
    t.config && t.config.tools && Xl(t.config.tools) && Ql(p);
    const h = Xm(p);
    if (this.apiClient.isVertexAI()) {
      const P = this.apiClient.getProject(), N = this.apiClient.getLocation(), G = this.apiClient.getApiKey(), V = !!P && !!N || !!G;
      this.apiClient.getCustomBaseUrl() && !V ? f = d : (f = `${d}/ws/google.cloud.aiplatform.${c}.LlmBidiService/BidiGenerateContent`, await this.auth.addAuthHeaders(h, f));
    } else {
      const P = this.apiClient.getApiKey();
      let N = "BidiGenerateContent", G = "key";
      P?.startsWith("auth_tokens/") && (console.warn("Warning: Ephemeral token support is experimental and may change in future versions."), c !== "v1alpha" && console.warn("Warning: The SDK's ephemeral token support is in v1alpha only. Please use const ai = new GoogleGenAI({apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' }}); before session connection."), N = "BidiGenerateContentConstrained", G = "access_token"), f = `${d}/ws/google.ai.generativelanguage.${c}.GenerativeService.${N}?${G}=${P}`;
    }
    let g = () => {
    };
    const m = new Promise((P) => {
      g = P;
    }), v = t.callbacks, E = function() {
      var P;
      (P = v?.onopen) === null || P === void 0 || P.call(v), g({});
    }, T = this.apiClient, C = {
      onopen: E,
      onmessage: (P) => {
        Km(T, v.onmessage, P);
      },
      onerror: (n = v?.onerror) !== null && n !== void 0 ? n : function(P) {
      },
      onclose: (r = v?.onclose) !== null && r !== void 0 ? r : function(P) {
      }
    }, w = this.webSocketFactory.create(f, zm(h), C);
    w.connect(), await m;
    let D = re(this.apiClient, t.model);
    if (this.apiClient.isVertexAI() && D.startsWith("publishers/")) {
      const P = this.apiClient.getProject(), N = this.apiClient.getLocation();
      P && N && (D = `projects/${P}/locations/${N}/` + D);
    }
    let _ = {};
    this.apiClient.isVertexAI() && ((i = t.config) === null || i === void 0 ? void 0 : i.responseModalities) === void 0 && (t.config === void 0 ? t.config = { responseModalities: [an.AUDIO] } : t.config.responseModalities = [an.AUDIO]), !((o = t.config) === null || o === void 0) && o.generationConfig && console.warn("Setting `LiveConnectConfig.generation_config` is deprecated, please set the fields on `LiveConnectConfig` directly. This will become an error in a future version (not before Q3 2025).");
    const y = (l = (a = t.config) === null || a === void 0 ? void 0 : a.tools) !== null && l !== void 0 ? l : [], S = [];
    for (const P of y)
      if (this.isCallableTool(P)) {
        const N = P;
        S.push(await N.tool());
      } else
        S.push(P);
    S.length > 0 && (t.config.tools = S);
    const R = {
      model: D,
      config: t.config,
      callbacks: t.callbacks
    };
    return this.apiClient.isVertexAI() ? _ = lp(this.apiClient, R) : _ = ap(this.apiClient, R), delete _.config, w.send(JSON.stringify(_)), new jl(w, this.apiClient);
  }
  // TODO: b/416041229 - Abstract this method to a common place.
  isCallableTool(t) {
    return "callTool" in t && typeof t.callTool == "function";
  }
}
const Ym = {
  turnComplete: !0
};
class jl {
  constructor(t, n) {
    this.conn = t, this.apiClient = n;
  }
  tLiveClientContent(t, n) {
    if (n.turns !== null && n.turns !== void 0) {
      let r = [];
      try {
        r = Ae(n.turns), t.isVertexAI() || (r = r.map((i) => gn(i)));
      } catch {
        throw new Error(`Failed to parse client content "turns", type: '${typeof n.turns}'`);
      }
      return {
        clientContent: { turns: r, turnComplete: n.turnComplete }
      };
    }
    return {
      clientContent: { turnComplete: n.turnComplete }
    };
  }
  tLiveClienttToolResponse(t, n) {
    let r = [];
    if (n.functionResponses == null)
      throw new Error("functionResponses is required.");
    if (Array.isArray(n.functionResponses) ? r = n.functionResponses : r = [n.functionResponses], r.length === 0)
      throw new Error("functionResponses is required.");
    for (const o of r) {
      if (typeof o != "object" || o === null || !("name" in o) || !("response" in o))
        throw new Error(`Could not parse function response, type '${typeof o}'.`);
      if (!t.isVertexAI() && !("id" in o))
        throw new Error(Wm);
    }
    return {
      toolResponse: { functionResponses: r }
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
  sendClientContent(t) {
    t = Object.assign(Object.assign({}, Ym), t);
    const n = this.tLiveClientContent(this.apiClient, t);
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
  sendRealtimeInput(t) {
    let n = {};
    this.apiClient.isVertexAI() ? n = {
      realtimeInput: fp(t)
    } : n = {
      realtimeInput: dp(t)
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
  sendToolResponse(t) {
    if (t.functionResponses == null)
      throw new Error("Tool response parameters are required.");
    const n = this.tLiveClienttToolResponse(this.apiClient, t);
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
function zm(e) {
  const t = {};
  return e.forEach((n, r) => {
    t[r] = n;
  }), t;
}
function Xm(e) {
  const t = new Headers();
  for (const [n, r] of Object.entries(e))
    t.append(n, r);
  return t;
}
const fa = 10;
function ha(e) {
  var t, n, r;
  if (!((t = e?.automaticFunctionCalling) === null || t === void 0) && t.disable)
    return !0;
  let i = !1;
  for (const a of (n = e?.tools) !== null && n !== void 0 ? n : [])
    if (gt(a)) {
      i = !0;
      break;
    }
  if (!i)
    return !0;
  const o = (r = e?.automaticFunctionCalling) === null || r === void 0 ? void 0 : r.maximumRemoteCalls;
  return o && (o < 0 || !Number.isInteger(o)) || o == 0 ? (console.warn("Invalid maximumRemoteCalls value provided for automatic function calling. Disabled automatic function calling. Please provide a valid integer value greater than 0. maximumRemoteCalls provided:", o), !0) : !1;
}
function gt(e) {
  return "callTool" in e && typeof e.callTool == "function";
}
function Qm(e) {
  var t, n, r;
  return (r = (n = (t = e.config) === null || t === void 0 ? void 0 : t.tools) === null || n === void 0 ? void 0 : n.some((i) => gt(i))) !== null && r !== void 0 ? r : !1;
}
function pa(e) {
  var t;
  const n = [];
  return !((t = e?.config) === null || t === void 0) && t.tools && e.config.tools.forEach((r, i) => {
    if (gt(r))
      return;
    const o = r;
    o.functionDeclarations && o.functionDeclarations.length > 0 && n.push(i);
  }), n;
}
function ga(e) {
  var t;
  return !(!((t = e?.automaticFunctionCalling) === null || t === void 0) && t.ignoreCallHistory);
}
class ec extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.embedContent = async (n) => {
      if (!this.apiClient.isVertexAI())
        return await this.embedContentInternal(n);
      if (n.model.includes("gemini") && n.model !== "gemini-embedding-001" || n.model.includes("maas")) {
        const i = Ae(n.contents);
        if (i.length > 1)
          throw new Error("The embedContent API for this model only supports one content at a time.");
        const o = Object.assign(Object.assign({}, n), { content: i[0], embeddingApiType: ln.EMBED_CONTENT });
        return await this.embedContentInternal(o);
      } else {
        const i = Object.assign(Object.assign({}, n), { embeddingApiType: ln.PREDICT });
        return await this.embedContentInternal(i);
      }
    }, this.generateContent = async (n) => {
      var r, i, o, a, l;
      const d = await this.processParamsMaybeAddMcpUsage(n);
      if (this.maybeMoveToResponseJsonSchem(n), !Qm(n) || ha(n.config))
        return await this.generateContentInternal(d);
      const c = pa(n);
      if (c.length > 0) {
        const v = c.map((E) => `tools[${E}]`).join(", ");
        throw new Error(`Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations is not yet supported. Incompatible tools found at ${v}.`);
      }
      let f, p;
      const h = Ae(d.contents), g = (o = (i = (r = d.config) === null || r === void 0 ? void 0 : r.automaticFunctionCalling) === null || i === void 0 ? void 0 : i.maximumRemoteCalls) !== null && o !== void 0 ? o : fa;
      let m = 0;
      for (; m < g && (f = await this.generateContentInternal(d), !(!f.functionCalls || f.functionCalls.length === 0)); ) {
        const v = f.candidates[0].content, E = [];
        for (const T of (l = (a = n.config) === null || a === void 0 ? void 0 : a.tools) !== null && l !== void 0 ? l : [])
          if (gt(T)) {
            const w = await T.callTool(f.functionCalls);
            E.push(...w);
          }
        m++, p = {
          role: "user",
          parts: E
        }, d.contents = Ae(d.contents), d.contents.push(v), d.contents.push(p), ga(d.config) && (h.push(v), h.push(p));
      }
      return ga(d.config) && (f.automaticFunctionCallingHistory = h), f;
    }, this.generateContentStream = async (n) => {
      var r, i, o, a, l;
      if (this.maybeMoveToResponseJsonSchem(n), ha(n.config)) {
        const p = await this.processParamsMaybeAddMcpUsage(n);
        return await this.generateContentStreamInternal(p);
      }
      const d = pa(n);
      if (d.length > 0) {
        const p = d.map((h) => `tools[${h}]`).join(", ");
        throw new Error(`Incompatible tools found at ${p}. Automatic function calling with CallableTools (or MCP objects) and basic FunctionDeclarations" is not yet supported.`);
      }
      const c = (o = (i = (r = n?.config) === null || r === void 0 ? void 0 : r.toolConfig) === null || i === void 0 ? void 0 : i.functionCallingConfig) === null || o === void 0 ? void 0 : o.streamFunctionCallArguments, f = (l = (a = n?.config) === null || a === void 0 ? void 0 : a.automaticFunctionCalling) === null || l === void 0 ? void 0 : l.disable;
      if (c && !f)
        throw new Error("Running in streaming mode with 'streamFunctionCallArguments' enabled, this feature is not compatible with automatic function calling (AFC). Please set 'config.automaticFunctionCalling.disable' to true to disable AFC or leave 'config.toolConfig.functionCallingConfig.streamFunctionCallArguments' to be undefined or set to false to disable streaming function call arguments feature.");
      return await this.processAfcStream(n);
    }, this.generateImages = async (n) => await this.generateImagesInternal(n).then((r) => {
      var i;
      let o;
      const a = [];
      if (r?.generatedImages)
        for (const d of r.generatedImages)
          d && d?.safetyAttributes && ((i = d?.safetyAttributes) === null || i === void 0 ? void 0 : i.contentType) === "Positive Prompt" ? o = d?.safetyAttributes : a.push(d);
      let l;
      return o ? l = {
        generatedImages: a,
        positivePromptSafetyAttributes: o,
        sdkHttpResponse: r.sdkHttpResponse
      } : l = {
        generatedImages: a,
        sdkHttpResponse: r.sdkHttpResponse
      }, l;
    }), this.list = async (n) => {
      var r;
      const a = {
        config: Object.assign(Object.assign({}, {
          queryBase: !0
        }), n?.config)
      };
      if (this.apiClient.isVertexAI() && !a.config.queryBase) {
        if (!((r = a.config) === null || r === void 0) && r.filter)
          throw new Error("Filtering tuned models list for Vertex AI is not currently supported");
        a.config.filter = "labels.tune-type:*";
      }
      return new Ye(Oe.PAGED_ITEM_MODELS, (l) => this.listInternal(l), await this.listInternal(a), a);
    }, this.editImage = async (n) => {
      const r = {
        model: n.model,
        prompt: n.prompt,
        referenceImages: [],
        config: n.config
      };
      return n.referenceImages && n.referenceImages && (r.referenceImages = n.referenceImages.map((i) => i.toReferenceImageAPI())), await this.editImageInternal(r);
    }, this.upscaleImage = async (n) => {
      let r = {
        numberOfImages: 1,
        mode: "upscale"
      };
      n.config && (r = Object.assign(Object.assign({}, r), n.config));
      const i = {
        model: n.model,
        image: n.image,
        upscaleFactor: n.upscaleFactor,
        config: r
      };
      return await this.upscaleImageInternal(i);
    }, this.generateVideos = async (n) => {
      var r, i, o, a, l, d;
      if ((n.prompt || n.image || n.video) && n.source)
        throw new Error("Source and prompt/image/video are mutually exclusive. Please only use source.");
      return this.apiClient.isVertexAI() || (!((r = n.video) === null || r === void 0) && r.uri && (!((i = n.video) === null || i === void 0) && i.videoBytes) ? n.video = {
        uri: n.video.uri,
        mimeType: n.video.mimeType
      } : !((a = (o = n.source) === null || o === void 0 ? void 0 : o.video) === null || a === void 0) && a.uri && (!((d = (l = n.source) === null || l === void 0 ? void 0 : l.video) === null || d === void 0) && d.videoBytes) && (n.source.video = {
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
  maybeMoveToResponseJsonSchem(t) {
    t.config && t.config.responseSchema && (t.config.responseJsonSchema || Object.keys(t.config.responseSchema).includes("$schema") && (t.config.responseJsonSchema = t.config.responseSchema, delete t.config.responseSchema));
  }
  /**
   * Transforms the CallableTools in the parameters to be simply Tools, it
   * copies the params into a new object and replaces the tools, it does not
   * modify the original params. Also sets the MCP usage header if there are
   * MCP tools in the parameters.
   */
  async processParamsMaybeAddMcpUsage(t) {
    var n, r, i;
    const o = (n = t.config) === null || n === void 0 ? void 0 : n.tools;
    if (!o)
      return t;
    const a = await Promise.all(o.map(async (d) => gt(d) ? await d.tool() : d)), l = {
      model: t.model,
      contents: t.contents,
      config: Object.assign(Object.assign({}, t.config), { tools: a })
    };
    if (l.config.tools = a, t.config && t.config.tools && Xl(t.config.tools)) {
      const d = (i = (r = t.config.httpOptions) === null || r === void 0 ? void 0 : r.headers) !== null && i !== void 0 ? i : {};
      let c = Object.assign({}, d);
      Object.keys(c).length === 0 && (c = this.apiClient.getDefaultHeaders()), Ql(c), l.config.httpOptions = Object.assign(Object.assign({}, t.config.httpOptions), { headers: c });
    }
    return l;
  }
  async initAfcToolsMap(t) {
    var n, r, i;
    const o = /* @__PURE__ */ new Map();
    for (const a of (r = (n = t.config) === null || n === void 0 ? void 0 : n.tools) !== null && r !== void 0 ? r : [])
      if (gt(a)) {
        const l = a, d = await l.tool();
        for (const c of (i = d.functionDeclarations) !== null && i !== void 0 ? i : []) {
          if (!c.name)
            throw new Error("Function declaration name is required.");
          if (o.has(c.name))
            throw new Error(`Duplicate tool declaration name: ${c.name}`);
          o.set(c.name, l);
        }
      }
    return o;
  }
  async processAfcStream(t) {
    var n, r, i;
    const o = (i = (r = (n = t.config) === null || n === void 0 ? void 0 : n.automaticFunctionCalling) === null || r === void 0 ? void 0 : r.maximumRemoteCalls) !== null && i !== void 0 ? i : fa;
    let a = !1, l = 0;
    const d = await this.initAfcToolsMap(t);
    return (function(c, f, p) {
      return xe(this, arguments, function* () {
        for (var h, g, m, v, E, T; l < o; ) {
          a && (l++, a = !1);
          const _ = yield j(c.processParamsMaybeAddMcpUsage(p)), y = yield j(c.generateContentStreamInternal(_)), S = [], R = [];
          try {
            for (var C = !0, w = (g = void 0, De(y)), D; D = yield j(w.next()), h = D.done, !h; C = !0) {
              v = D.value, C = !1;
              const P = v;
              if (yield yield j(P), P.candidates && (!((E = P.candidates[0]) === null || E === void 0) && E.content)) {
                R.push(P.candidates[0].content);
                for (const N of (T = P.candidates[0].content.parts) !== null && T !== void 0 ? T : [])
                  if (l < o && N.functionCall) {
                    if (!N.functionCall.name)
                      throw new Error("Function call name was not returned by the model.");
                    if (f.has(N.functionCall.name)) {
                      const G = yield j(f.get(N.functionCall.name).callTool([N.functionCall]));
                      S.push(...G);
                    } else
                      throw new Error(`Automatic function calling was requested, but not all the tools the model used implement the CallableTool interface. Available tools: ${f.keys()}, mising tool: ${N.functionCall.name}`);
                  }
              }
            }
          } catch (P) {
            g = { error: P };
          } finally {
            try {
              !C && !h && (m = w.return) && (yield j(m.call(w)));
            } finally {
              if (g) throw g.error;
            }
          }
          if (S.length > 0) {
            a = !0;
            const P = new ft();
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
    })(this, d, t);
  }
  async generateContentInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = la(this.apiClient, t);
      return l = z("{model}:generateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ua(f), h = new ft();
        return Object.assign(h, p), h;
      });
    } else {
      const c = aa(this.apiClient, t);
      return l = z("{model}:generateContent", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = ca(f), h = new ft();
        return Object.assign(h, p), h;
      });
    }
  }
  async generateContentStreamInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = la(this.apiClient, t);
      return l = z("{model}:streamGenerateContent?alt=sse", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }), a.then(function(p) {
        return xe(this, arguments, function* () {
          var h, g, m, v;
          try {
            for (var E = !0, T = De(p), C; C = yield j(T.next()), h = C.done, !h; E = !0) {
              v = C.value, E = !1;
              const w = v, D = ua(yield j(w.json()), t);
              D.sdkHttpResponse = {
                headers: w.headers
              };
              const _ = new ft();
              Object.assign(_, D), yield yield j(_);
            }
          } catch (w) {
            g = { error: w };
          } finally {
            try {
              !E && !h && (m = T.return) && (yield j(m.call(T)));
            } finally {
              if (g) throw g.error;
            }
          }
        });
      });
    } else {
      const c = aa(this.apiClient, t);
      return l = z("{model}:streamGenerateContent?alt=sse", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.requestStream({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }), a.then(function(p) {
        return xe(this, arguments, function* () {
          var h, g, m, v;
          try {
            for (var E = !0, T = De(p), C; C = yield j(T.next()), h = C.done, !h; E = !0) {
              v = C.value, E = !1;
              const w = v, D = ca(yield j(w.json()), t);
              D.sdkHttpResponse = {
                headers: w.headers
              };
              const _ = new ft();
              Object.assign(_, D), yield yield j(_);
            }
          } catch (w) {
            g = { error: w };
          } finally {
            try {
              !E && !h && (m = T.return) && (yield j(m.call(T)));
            } finally {
              if (g) throw g.error;
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
  async embedContentInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = $p(this.apiClient, t, t), f = pf(t.model) ? "{model}:embedContent" : "{model}:predict";
      return l = z(f, c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((p) => p.json().then((h) => {
        const g = h;
        return g.sdkHttpResponse = {
          headers: p.headers
        }, g;
      })), a.then((p) => {
        const h = Kp(p, t), g = new Di();
        return Object.assign(g, h), g;
      });
    } else {
      const c = Jp(this.apiClient, t);
      return l = z("{model}:batchEmbedContents", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Wp(f), h = new Di();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Private method for generating images.
   */
  async generateImagesInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = ig(this.apiClient, t);
      return l = z("{model}:predict", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = sg(f), h = new Ui();
        return Object.assign(h, p), h;
      });
    } else {
      const c = rg(this.apiClient, t);
      return l = z("{model}:predict", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = og(f), h = new Ui();
        return Object.assign(h, p), h;
      });
    }
  }
  /**
   * Private method for editing an image.
   */
  async editImageInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = qp(this.apiClient, t);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = Bp(d), f = new ll();
        return Object.assign(f, c), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for upscaling an image.
   */
  async upscaleImageInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = im(this.apiClient, t);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = om(d), f = new cl();
        return Object.assign(f, c), f;
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
  async recontextImage(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = Gg(this.apiClient, t);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = qg(d), f = new ul();
        return Object.assign(f, c), f;
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
  async segmentImage(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = Wg(this.apiClient, t);
      return o = z("{model}:predict", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Kg(d), f = new dl();
        return Object.assign(f, c), f;
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
  async get(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Cg(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Wi(f));
    } else {
      const c = Sg(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => $i(f));
    }
  }
  async listInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = xg(this.apiClient, t);
      return l = z("{models_url}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Ug(f), h = new bi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Mg(this.apiClient, t);
      return l = z("{models_url}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Dg(f), h = new bi();
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
  async update(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = nm(this.apiClient, t);
      return l = z("{model}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => Wi(f));
    } else {
      const c = tm(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "PATCH",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => $i(f));
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
  async delete(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Lp(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Fp(f), h = new Li();
        return Object.assign(h, p), h;
      });
    } else {
      const c = bp(this.apiClient, t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "DELETE",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Op(f), h = new Li();
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
  async countTokens(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = xp(this.apiClient, t);
      return l = z("{model}:countTokens", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Up(f), h = new Oi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = Mp(this.apiClient, t);
      return l = z("{model}:countTokens", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = Dp(f), h = new Oi();
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
  async computeTokens(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = Ap(this.apiClient, t);
      return o = z("{model}:computeTokens", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => {
        const c = wp(d), f = new fl();
        return Object.assign(f, c), f;
      });
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  /**
   * Private method for generating videos.
   */
  async generateVideosInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = fg(this.apiClient, t);
      return l = z("{model}:predictLongRunning", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = ug(f), h = new cn();
        return Object.assign(h, p), h;
      });
    } else {
      const c = dg(this.apiClient, t);
      return l = z("{model}:predictLongRunning", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a.then((f) => {
        const p = cg(f), h = new cn();
        return Object.assign(h, p), h;
      });
    }
  }
}
class tc extends Ve {
  constructor(t) {
    super(), this.apiClient = t;
  }
  /**
   * Gets the status of a long-running operation.
   *
   * @param parameters The parameters for the get operation request.
   * @return The updated Operation object, with the latest status or result.
   */
  async getVideosOperation(t) {
    const n = t.operation, r = t.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = n.name.split("/operations/")[0];
      let o;
      r && "httpOptions" in r && (o = r.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: i,
        config: { httpOptions: o }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: n.name,
        config: r
      });
      return n._fromAPIResponse({
        apiResponse: i,
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
  async get(t) {
    const n = t.operation, r = t.config;
    if (n.name === void 0 || n.name === "")
      throw new Error("Operation name is required.");
    if (this.apiClient.isVertexAI()) {
      const i = n.name.split("/operations/")[0];
      let o;
      r && "httpOptions" in r && (o = r.httpOptions);
      const a = await this.fetchPredictVideosOperationInternal({
        operationName: n.name,
        resourceName: i,
        config: { httpOptions: o }
      });
      return n._fromAPIResponse({
        apiResponse: a,
        _isVertexAI: !0
      });
    } else {
      const i = await this.getVideosOperationInternal({
        operationName: n.name,
        config: r
      });
      return n._fromAPIResponse({
        apiResponse: i,
        _isVertexAI: !1
      });
    }
  }
  async getVideosOperationInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = Sd(t);
      return l = z("{operationName}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json()), a;
    } else {
      const c = Td(t);
      return l = z("{operationName}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json()), a;
    }
  }
  async fetchPredictVideosOperationInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = pd(t);
      return o = z("{resourceName}:fetchPredictOperation", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i;
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
}
function Zm(e) {
  const t = {}, n = s(e, ["apiKey"]);
  if (n != null && u(t, ["apiKey"], n), s(e, ["apiKeyConfig"]) !== void 0)
    throw new Error("apiKeyConfig parameter is not supported in Gemini API.");
  if (s(e, ["authType"]) !== void 0)
    throw new Error("authType parameter is not supported in Gemini API.");
  if (s(e, ["googleServiceAccountConfig"]) !== void 0)
    throw new Error("googleServiceAccountConfig parameter is not supported in Gemini API.");
  if (s(e, ["httpBasicAuthConfig"]) !== void 0)
    throw new Error("httpBasicAuthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oauthConfig"]) !== void 0)
    throw new Error("oauthConfig parameter is not supported in Gemini API.");
  if (s(e, ["oidcConfig"]) !== void 0)
    throw new Error("oidcConfig parameter is not supported in Gemini API.");
  return t;
}
function jm(e) {
  const t = {}, n = s(e, ["data"]);
  if (n != null && u(t, ["data"], n), s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function ey(e) {
  const t = {}, n = s(e, ["parts"]);
  if (n != null) {
    let i = n;
    Array.isArray(i) && (i = i.map((o) => cy(o))), u(t, ["parts"], i);
  }
  const r = s(e, ["role"]);
  return r != null && u(t, ["role"], r), t;
}
function ty(e, t, n) {
  const r = {}, i = s(t, ["expireTime"]);
  n !== void 0 && i != null && u(n, ["expireTime"], i);
  const o = s(t, [
    "newSessionExpireTime"
  ]);
  n !== void 0 && o != null && u(n, ["newSessionExpireTime"], o);
  const a = s(t, ["uses"]);
  n !== void 0 && a != null && u(n, ["uses"], a);
  const l = s(t, [
    "liveConnectConstraints"
  ]);
  n !== void 0 && l != null && u(n, ["bidiGenerateContentSetup"], ly(e, l));
  const d = s(t, [
    "lockAdditionalFields"
  ]);
  return n !== void 0 && d != null && u(n, ["fieldMask"], d), r;
}
function ny(e, t) {
  const n = {}, r = s(t, ["config"]);
  return r != null && u(n, ["config"], ty(e, r, n)), n;
}
function ry(e) {
  const t = {};
  if (s(e, ["displayName"]) !== void 0)
    throw new Error("displayName parameter is not supported in Gemini API.");
  const n = s(e, ["fileUri"]);
  n != null && u(t, ["fileUri"], n);
  const r = s(e, ["mimeType"]);
  return r != null && u(t, ["mimeType"], r), t;
}
function iy(e) {
  const t = {}, n = s(e, ["id"]);
  n != null && u(t, ["id"], n);
  const r = s(e, ["args"]);
  r != null && u(t, ["args"], r);
  const i = s(e, ["name"]);
  if (i != null && u(t, ["name"], i), s(e, ["partialArgs"]) !== void 0)
    throw new Error("partialArgs parameter is not supported in Gemini API.");
  if (s(e, ["willContinue"]) !== void 0)
    throw new Error("willContinue parameter is not supported in Gemini API.");
  return t;
}
function oy(e) {
  const t = {}, n = s(e, ["authConfig"]);
  n != null && u(t, ["authConfig"], Zm(n));
  const r = s(e, ["enableWidget"]);
  return r != null && u(t, ["enableWidget"], r), t;
}
function sy(e) {
  const t = {}, n = s(e, ["searchTypes"]);
  if (n != null && u(t, ["searchTypes"], n), s(e, ["blockingConfidence"]) !== void 0)
    throw new Error("blockingConfidence parameter is not supported in Gemini API.");
  if (s(e, ["excludeDomains"]) !== void 0)
    throw new Error("excludeDomains parameter is not supported in Gemini API.");
  const r = s(e, [
    "timeRangeFilter"
  ]);
  return r != null && u(t, ["timeRangeFilter"], r), t;
}
function ay(e, t) {
  const n = {}, r = s(e, [
    "generationConfig"
  ]);
  t !== void 0 && r != null && u(t, ["setup", "generationConfig"], r);
  const i = s(e, [
    "responseModalities"
  ]);
  t !== void 0 && i != null && u(t, ["setup", "generationConfig", "responseModalities"], i);
  const o = s(e, ["temperature"]);
  t !== void 0 && o != null && u(t, ["setup", "generationConfig", "temperature"], o);
  const a = s(e, ["topP"]);
  t !== void 0 && a != null && u(t, ["setup", "generationConfig", "topP"], a);
  const l = s(e, ["topK"]);
  t !== void 0 && l != null && u(t, ["setup", "generationConfig", "topK"], l);
  const d = s(e, [
    "maxOutputTokens"
  ]);
  t !== void 0 && d != null && u(t, ["setup", "generationConfig", "maxOutputTokens"], d);
  const c = s(e, [
    "mediaResolution"
  ]);
  t !== void 0 && c != null && u(t, ["setup", "generationConfig", "mediaResolution"], c);
  const f = s(e, ["seed"]);
  t !== void 0 && f != null && u(t, ["setup", "generationConfig", "seed"], f);
  const p = s(e, ["speechConfig"]);
  t !== void 0 && p != null && u(t, ["setup", "generationConfig", "speechConfig"], uo(p));
  const h = s(e, [
    "thinkingConfig"
  ]);
  t !== void 0 && h != null && u(t, ["setup", "generationConfig", "thinkingConfig"], h);
  const g = s(e, [
    "enableAffectiveDialog"
  ]);
  t !== void 0 && g != null && u(t, ["setup", "generationConfig", "enableAffectiveDialog"], g);
  const m = s(e, [
    "systemInstruction"
  ]);
  t !== void 0 && m != null && u(t, ["setup", "systemInstruction"], ey(ye(m)));
  const v = s(e, ["tools"]);
  if (t !== void 0 && v != null) {
    let y = Et(v);
    Array.isArray(y) && (y = y.map((S) => dy(vt(S)))), u(t, ["setup", "tools"], y);
  }
  const E = s(e, [
    "sessionResumption"
  ]);
  t !== void 0 && E != null && u(t, ["setup", "sessionResumption"], uy(E));
  const T = s(e, [
    "inputAudioTranscription"
  ]);
  t !== void 0 && T != null && u(t, ["setup", "inputAudioTranscription"], T);
  const C = s(e, [
    "outputAudioTranscription"
  ]);
  t !== void 0 && C != null && u(t, ["setup", "outputAudioTranscription"], C);
  const w = s(e, [
    "realtimeInputConfig"
  ]);
  t !== void 0 && w != null && u(t, ["setup", "realtimeInputConfig"], w);
  const D = s(e, [
    "contextWindowCompression"
  ]);
  t !== void 0 && D != null && u(t, ["setup", "contextWindowCompression"], D);
  const _ = s(e, ["proactivity"]);
  if (t !== void 0 && _ != null && u(t, ["setup", "proactivity"], _), s(e, ["explicitVadSignal"]) !== void 0)
    throw new Error("explicitVadSignal parameter is not supported in Gemini API.");
  return n;
}
function ly(e, t) {
  const n = {}, r = s(t, ["model"]);
  r != null && u(n, ["setup", "model"], re(e, r));
  const i = s(t, ["config"]);
  return i != null && u(n, ["config"], ay(i, n)), n;
}
function cy(e) {
  const t = {}, n = s(e, [
    "mediaResolution"
  ]);
  n != null && u(t, ["mediaResolution"], n);
  const r = s(e, [
    "codeExecutionResult"
  ]);
  r != null && u(t, ["codeExecutionResult"], r);
  const i = s(e, [
    "executableCode"
  ]);
  i != null && u(t, ["executableCode"], i);
  const o = s(e, ["fileData"]);
  o != null && u(t, ["fileData"], ry(o));
  const a = s(e, ["functionCall"]);
  a != null && u(t, ["functionCall"], iy(a));
  const l = s(e, [
    "functionResponse"
  ]);
  l != null && u(t, ["functionResponse"], l);
  const d = s(e, ["inlineData"]);
  d != null && u(t, ["inlineData"], jm(d));
  const c = s(e, ["text"]);
  c != null && u(t, ["text"], c);
  const f = s(e, ["thought"]);
  f != null && u(t, ["thought"], f);
  const p = s(e, [
    "thoughtSignature"
  ]);
  p != null && u(t, ["thoughtSignature"], p);
  const h = s(e, [
    "videoMetadata"
  ]);
  return h != null && u(t, ["videoMetadata"], h), t;
}
function uy(e) {
  const t = {}, n = s(e, ["handle"]);
  if (n != null && u(t, ["handle"], n), s(e, ["transparent"]) !== void 0)
    throw new Error("transparent parameter is not supported in Gemini API.");
  return t;
}
function dy(e) {
  const t = {};
  if (s(e, ["retrieval"]) !== void 0)
    throw new Error("retrieval parameter is not supported in Gemini API.");
  const n = s(e, ["computerUse"]);
  n != null && u(t, ["computerUse"], n);
  const r = s(e, ["fileSearch"]);
  r != null && u(t, ["fileSearch"], r);
  const i = s(e, ["googleSearch"]);
  i != null && u(t, ["googleSearch"], sy(i));
  const o = s(e, ["googleMaps"]);
  o != null && u(t, ["googleMaps"], oy(o));
  const a = s(e, [
    "codeExecution"
  ]);
  if (a != null && u(t, ["codeExecution"], a), s(e, ["enterpriseWebSearch"]) !== void 0)
    throw new Error("enterpriseWebSearch parameter is not supported in Gemini API.");
  const l = s(e, [
    "functionDeclarations"
  ]);
  if (l != null) {
    let p = l;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["functionDeclarations"], p);
  }
  const d = s(e, [
    "googleSearchRetrieval"
  ]);
  if (d != null && u(t, ["googleSearchRetrieval"], d), s(e, ["parallelAiSearch"]) !== void 0)
    throw new Error("parallelAiSearch parameter is not supported in Gemini API.");
  const c = s(e, ["urlContext"]);
  c != null && u(t, ["urlContext"], c);
  const f = s(e, ["mcpServers"]);
  if (f != null) {
    let p = f;
    Array.isArray(p) && (p = p.map((h) => h)), u(t, ["mcpServers"], p);
  }
  return t;
}
function fy(e) {
  const t = [];
  for (const n in e)
    if (Object.prototype.hasOwnProperty.call(e, n)) {
      const r = e[n];
      if (typeof r == "object" && r != null && Object.keys(r).length > 0) {
        const i = Object.keys(r).map((o) => `${n}.${o}`);
        t.push(...i);
      } else
        t.push(n);
    }
  return t.join(",");
}
function hy(e, t) {
  let n = null;
  const r = e.bidiGenerateContentSetup;
  if (typeof r == "object" && r !== null && "setup" in r) {
    const o = r.setup;
    typeof o == "object" && o !== null ? (e.bidiGenerateContentSetup = o, n = o) : delete e.bidiGenerateContentSetup;
  } else r !== void 0 && delete e.bidiGenerateContentSetup;
  const i = e.fieldMask;
  if (n) {
    const o = fy(n);
    if (Array.isArray(t?.lockAdditionalFields) && t?.lockAdditionalFields.length === 0)
      o ? e.fieldMask = o : delete e.fieldMask;
    else if (t?.lockAdditionalFields && t.lockAdditionalFields.length > 0 && i !== null && Array.isArray(i) && i.length > 0) {
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
      i.length > 0 && (l = i.map((c) => a.includes(c) ? `generationConfig.${c}` : c));
      const d = [];
      o && d.push(o), l.length > 0 && d.push(...l), d.length > 0 ? e.fieldMask = d.join(",") : delete e.fieldMask;
    } else
      delete e.fieldMask;
  } else
    i !== null && Array.isArray(i) && i.length > 0 ? e.fieldMask = i.join(",") : delete e.fieldMask;
  return e;
}
class nc extends Ve {
  constructor(t) {
    super(), this.apiClient = t;
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
  async create(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("The client.tokens.create method is only supported by the Gemini Developer API.");
    {
      const l = ny(this.apiClient, t);
      o = z("auth_tokens", l._url), a = l._query, delete l.config, delete l._url, delete l._query;
      const d = hy(l, t.config);
      return i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(d),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((c) => c.json()), i.then((c) => c);
    }
  }
}
function py(e, t) {
  const n = {}, r = s(e, ["force"]);
  return t !== void 0 && r != null && u(t, ["_query", "force"], r), n;
}
function gy(e) {
  const t = {}, n = s(e, ["name"]);
  n != null && u(t, ["_url", "name"], n);
  const r = s(e, ["config"]);
  return r != null && py(r, t), t;
}
function my(e) {
  const t = {}, n = s(e, ["name"]);
  return n != null && u(t, ["_url", "name"], n), t;
}
function yy(e, t) {
  const n = {}, r = s(e, ["pageSize"]);
  t !== void 0 && r != null && u(t, ["_query", "pageSize"], r);
  const i = s(e, ["pageToken"]);
  return t !== void 0 && i != null && u(t, ["_query", "pageToken"], i), n;
}
function _y(e) {
  const t = {}, n = s(e, ["parent"]);
  n != null && u(t, ["_url", "parent"], n);
  const r = s(e, ["config"]);
  return r != null && yy(r, t), t;
}
function vy(e) {
  const t = {}, n = s(e, [
    "sdkHttpResponse"
  ]);
  n != null && u(t, ["sdkHttpResponse"], n);
  const r = s(e, [
    "nextPageToken"
  ]);
  r != null && u(t, ["nextPageToken"], r);
  const i = s(e, ["documents"]);
  if (i != null) {
    let o = i;
    Array.isArray(o) && (o = o.map((a) => a)), u(t, ["documents"], o);
  }
  return t;
}
class Ey extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.list = async (n) => new Ye(Oe.PAGED_ITEM_DOCUMENTS, (r) => this.listInternal({ parent: n.parent, config: r.config }), await this.listInternal(n), n);
  }
  /**
   * Gets a Document.
   *
   * @param params - The parameters for getting a document.
   * @return Document.
   */
  async get(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = my(t);
      return o = z("{name}", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
    }
  }
  /**
   * Deletes a Document.
   *
   * @param params - The parameters for deleting a document.
   */
  async delete(t) {
    var n, r;
    let i = "", o = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = gy(t);
      i = z("{name}", a._url), o = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: o,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      });
    }
  }
  async listInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = _y(t);
      return o = z("{parent}/documents", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = vy(d), f = new hl();
        return Object.assign(f, c), f;
      });
    }
  }
}
class Ty extends Ve {
  constructor(t, n = new Ey(t)) {
    super(), this.apiClient = t, this.documents = n, this.list = async (r = {}) => new Ye(Oe.PAGED_ITEM_FILE_SEARCH_STORES, (i) => this.listInternal(i), await this.listInternal(r), r);
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
  async uploadToFileSearchStore(t) {
    if (this.apiClient.isVertexAI())
      throw new Error("Vertex AI does not support uploading files to a file search store.");
    return this.apiClient.uploadFileToFileSearchStore(t.fileSearchStoreName, t.file, t.config);
  }
  /**
   * Creates a File Search Store.
   *
   * @param params - The parameters for creating a File Search Store.
   * @return FileSearchStore.
   */
  async create(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = fm(t);
      return o = z("fileSearchStores", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
    }
  }
  /**
   * Gets a File Search Store.
   *
   * @param params - The parameters for getting a File Search Store.
   * @return FileSearchStore.
   */
  async get(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = gm(t);
      return o = z("{name}", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => d);
    }
  }
  /**
   * Deletes a File Search Store.
   *
   * @param params - The parameters for deleting a File Search Store.
   */
  async delete(t) {
    var n, r;
    let i = "", o = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const a = pm(t);
      i = z("{name}", a._url), o = a._query, delete a._url, delete a._query, await this.apiClient.request({
        path: i,
        queryParams: o,
        body: JSON.stringify(a),
        httpMethod: "DELETE",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      });
    }
  }
  async listInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Tm(t);
      return o = z("fileSearchStores", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Sm(d), f = new pl();
        return Object.assign(f, c), f;
      });
    }
  }
  async uploadToFileSearchStoreInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = Cm(t);
      return o = z("upload/v1beta/{file_search_store_name}:uploadToFileSearchStore", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = Am(d), f = new gl();
        return Object.assign(f, c), f;
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
  async importFile(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = _m(t);
      return o = z("{file_search_store_name}:importFile", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json()), i.then((d) => {
        const c = ym(d), f = new Gn();
        return Object.assign(f, c), f;
      });
    }
  }
}
let rc = function() {
  const { crypto: e } = globalThis;
  if (e?.randomUUID)
    return rc = e.randomUUID.bind(e), e.randomUUID();
  const t = new Uint8Array(1), n = e ? () => e.getRandomValues(t)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (r) => (+r ^ n() & 15 >> +r / 4).toString(16));
};
const Sy = () => rc();
function Yi(e) {
  return typeof e == "object" && e !== null && // Spec-compliant fetch implementations
  ("name" in e && e.name === "AbortError" || // Expo fetch
  "message" in e && String(e.message).includes("FetchRequestCanceledException"));
}
const zi = (e) => {
  if (e instanceof Error)
    return e;
  if (typeof e == "object" && e !== null) {
    try {
      if (Object.prototype.toString.call(e) === "[object Error]") {
        const t = new Error(e.message, e.cause ? { cause: e.cause } : {});
        return e.stack && (t.stack = e.stack), e.cause && !t.cause && (t.cause = e.cause), e.name && (t.name = e.name), t;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(e));
    } catch {
    }
  }
  return new Error(e);
};
class Re extends Error {
}
class Te extends Re {
  constructor(t, n, r, i) {
    super(`${Te.makeMessage(t, n, r)}`), this.status = t, this.headers = i, this.error = n;
  }
  static makeMessage(t, n, r) {
    const i = n?.message ? typeof n.message == "string" ? n.message : JSON.stringify(n.message) : n ? JSON.stringify(n) : r;
    return t && i ? `${t} ${i}` : t ? `${t} status code (no body)` : i || "(no status code or body)";
  }
  static generate(t, n, r, i) {
    if (!t || !i)
      return new Hn({ message: r, cause: zi(n) });
    const o = n;
    return t === 400 ? new oc(t, o, r, i) : t === 401 ? new sc(t, o, r, i) : t === 403 ? new ac(t, o, r, i) : t === 404 ? new lc(t, o, r, i) : t === 409 ? new cc(t, o, r, i) : t === 422 ? new uc(t, o, r, i) : t === 429 ? new dc(t, o, r, i) : t >= 500 ? new fc(t, o, r, i) : new Te(t, o, r, i);
  }
}
class Xi extends Te {
  constructor({ message: t } = {}) {
    super(void 0, void 0, t || "Request was aborted.", void 0);
  }
}
class Hn extends Te {
  constructor({ message: t, cause: n }) {
    super(void 0, void 0, t || "Connection error.", void 0), n && (this.cause = n);
  }
}
class ic extends Hn {
  constructor({ message: t } = {}) {
    super({ message: t ?? "Request timed out." });
  }
}
class oc extends Te {
}
class sc extends Te {
}
class ac extends Te {
}
class lc extends Te {
}
class cc extends Te {
}
class uc extends Te {
}
class dc extends Te {
}
class fc extends Te {
}
const Cy = /^[a-z][a-z0-9+.-]*:/i, Ay = (e) => Cy.test(e);
let Qi = (e) => (Qi = Array.isArray, Qi(e));
const wy = Qi;
let Iy = wy;
const ma = Iy;
function Ry(e) {
  if (!e)
    return !0;
  for (const t in e)
    return !1;
  return !0;
}
function Py(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
const Ny = (e, t) => {
  if (typeof t != "number" || !Number.isInteger(t))
    throw new Re(`${e} must be an integer`);
  if (t < 0)
    throw new Re(`${e} must be a positive integer`);
  return t;
}, ky = (e) => {
  try {
    return JSON.parse(e);
  } catch {
    return;
  }
};
const My = (e) => new Promise((t) => setTimeout(t, e));
function xy() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new GeminiNextGenAPIClient({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function hc(...e) {
  const t = globalThis.ReadableStream;
  if (typeof t > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new t(...e);
}
function Dy(e) {
  let t = Symbol.asyncIterator in e ? e[Symbol.asyncIterator]() : e[Symbol.iterator]();
  return hc({
    start() {
    },
    async pull(n) {
      const { done: r, value: i } = await t.next();
      r ? n.close() : n.enqueue(i);
    },
    async cancel() {
      var n;
      await ((n = t.return) === null || n === void 0 ? void 0 : n.call(t));
    }
  });
}
function pc(e) {
  if (e[Symbol.asyncIterator])
    return e;
  const t = e.getReader();
  return {
    async next() {
      try {
        const n = await t.read();
        return n?.done && t.releaseLock(), n;
      } catch (n) {
        throw t.releaseLock(), n;
      }
    },
    async return() {
      const n = t.cancel();
      return t.releaseLock(), await n, { done: !0, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function Uy(e) {
  var t, n;
  if (e === null || typeof e != "object")
    return;
  if (e[Symbol.asyncIterator]) {
    await ((n = (t = e[Symbol.asyncIterator]()).return) === null || n === void 0 ? void 0 : n.call(t));
    return;
  }
  const r = e.getReader(), i = r.cancel();
  r.releaseLock(), await i;
}
const by = ({ headers: e, body: t }) => ({
  bodyHeaders: {
    "content-type": "application/json"
  },
  body: JSON.stringify(t)
});
const Ly = "0.0.1";
const gc = () => {
  var e;
  if (typeof File > "u") {
    const { process: t } = globalThis, n = typeof ((e = t?.versions) === null || e === void 0 ? void 0 : e.node) == "string" && parseInt(t.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (n ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function Ir(e, t, n) {
  return gc(), new File(e, t ?? "unknown_file", n);
}
function Oy(e) {
  return (typeof e == "object" && e !== null && ("name" in e && e.name && String(e.name) || "url" in e && e.url && String(e.url) || "filename" in e && e.filename && String(e.filename) || "path" in e && e.path && String(e.path)) || "").split(/[\\/]/).pop() || void 0;
}
const Fy = (e) => e != null && typeof e == "object" && typeof e[Symbol.asyncIterator] == "function";
const mc = (e) => e != null && typeof e == "object" && typeof e.size == "number" && typeof e.type == "string" && typeof e.text == "function" && typeof e.slice == "function" && typeof e.arrayBuffer == "function", Gy = (e) => e != null && typeof e == "object" && typeof e.name == "string" && typeof e.lastModified == "number" && mc(e), qy = (e) => e != null && typeof e == "object" && typeof e.url == "string" && typeof e.blob == "function";
async function By(e, t, n) {
  if (gc(), e = await e, Gy(e))
    return e instanceof File ? e : Ir([await e.arrayBuffer()], e.name);
  if (qy(e)) {
    const i = await e.blob();
    return t || (t = new URL(e.url).pathname.split(/[\\/]/).pop()), Ir(await Zi(i), t, n);
  }
  const r = await Zi(e);
  if (t || (t = Oy(e)), !n?.type) {
    const i = r.find((o) => typeof o == "object" && "type" in o && o.type);
    typeof i == "string" && (n = Object.assign(Object.assign({}, n), { type: i }));
  }
  return Ir(r, t, n);
}
async function Zi(e) {
  var t, n, r, i, o;
  let a = [];
  if (typeof e == "string" || ArrayBuffer.isView(e) || // includes Uint8Array, Buffer, etc.
  e instanceof ArrayBuffer)
    a.push(e);
  else if (mc(e))
    a.push(e instanceof Blob ? e : await e.arrayBuffer());
  else if (Fy(e))
    try {
      for (var l = !0, d = De(e), c; c = await d.next(), t = c.done, !t; l = !0) {
        i = c.value, l = !1;
        const f = i;
        a.push(...await Zi(f));
      }
    } catch (f) {
      n = { error: f };
    } finally {
      try {
        !l && !t && (r = d.return) && await r.call(d);
      } finally {
        if (n) throw n.error;
      }
    }
  else {
    const f = (o = e?.constructor) === null || o === void 0 ? void 0 : o.name;
    throw new Error(`Unexpected data type: ${typeof e}${f ? `; constructor: ${f}` : ""}${Hy(e)}`);
  }
  return a;
}
function Hy(e) {
  return typeof e != "object" || e === null ? "" : `; props: [${Object.getOwnPropertyNames(e).map((n) => `"${n}"`).join(", ")}]`;
}
class yc {
  constructor(t) {
    this._client = t;
  }
}
yc._key = [];
function _c(e) {
  return e.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const ya = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Vy = (e = _c) => (function(n, ...r) {
  if (n.length === 1)
    return n[0];
  let i = !1;
  const o = [], a = n.reduce((f, p, h) => {
    var g, m, v;
    /[?#]/.test(p) && (i = !0);
    const E = r[h];
    let T = (i ? encodeURIComponent : e)("" + E);
    return h !== r.length && (E == null || typeof E == "object" && // handle values from other realms
    E.toString === ((v = Object.getPrototypeOf((m = Object.getPrototypeOf((g = E.hasOwnProperty) !== null && g !== void 0 ? g : ya)) !== null && m !== void 0 ? m : ya)) === null || v === void 0 ? void 0 : v.toString)) && (T = E + "", o.push({
      start: f.length + p.length,
      length: T.length,
      error: `Value of type ${Object.prototype.toString.call(E).slice(8, -1)} is not a valid path parameter`
    })), f + p + (h === r.length ? "" : T);
  }, ""), l = a.split(/[?#]/, 1)[0], d = /(^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
  let c;
  for (; (c = d.exec(l)) !== null; ) {
    const f = c[0].startsWith("/"), p = f ? 1 : 0, h = f ? c[0].slice(1) : c[0];
    o.push({
      start: c.index + p,
      length: h.length,
      error: `Value "${h}" can't be safely passed as a path parameter`
    });
  }
  if (o.sort((f, p) => f.start - p.start), o.length > 0) {
    let f = 0;
    const p = o.reduce((h, g) => {
      const m = " ".repeat(g.start - f), v = "^".repeat(g.length);
      return f = g.start + g.length, h + m + v;
    }, "");
    throw new Re(`Path parameters result in path with invalid segments:
${o.map((h) => h.error).join(`
`)}
${a}
${p}`);
  }
  return a;
}), Sn = /* @__PURE__ */ Vy(_c);
class vc extends yc {
  create(t, n) {
    var r;
    const { api_version: i = this._client.apiVersion } = t, o = xn(t, ["api_version"]);
    if ("model" in o && "agent_config" in o)
      throw new Re("Invalid request: specified `model` and `agent_config`. If specifying `model`, use `generation_config`.");
    if ("agent" in o && "generation_config" in o)
      throw new Re("Invalid request: specified `agent` and `generation_config`. If specifying `agent`, use `agent_config`.");
    return this._client.post(Sn`/${i}/interactions`, Object.assign(Object.assign({ body: o }, n), { stream: (r = t.stream) !== null && r !== void 0 ? r : !1 }));
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
  delete(t, n = {}, r) {
    const { api_version: i = this._client.apiVersion } = n ?? {};
    return this._client.delete(Sn`/${i}/interactions/${t}`, r);
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
  cancel(t, n = {}, r) {
    const { api_version: i = this._client.apiVersion } = n ?? {};
    return this._client.post(Sn`/${i}/interactions/${t}/cancel`, r);
  }
  get(t, n = {}, r) {
    var i;
    const o = n ?? {}, { api_version: a = this._client.apiVersion } = o, l = xn(o, ["api_version"]);
    return this._client.get(Sn`/${a}/interactions/${t}`, Object.assign(Object.assign({ query: l }, r), { stream: (i = n?.stream) !== null && i !== void 0 ? i : !1 }));
  }
}
vc._key = Object.freeze(["interactions"]);
class Ec extends vc {
}
function Jy(e) {
  let t = 0;
  for (const i of e)
    t += i.length;
  const n = new Uint8Array(t);
  let r = 0;
  for (const i of e)
    n.set(i, r), r += i.length;
  return n;
}
let Cn;
function ho(e) {
  let t;
  return (Cn ?? (t = new globalThis.TextEncoder(), Cn = t.encode.bind(t)))(e);
}
let An;
function _a(e) {
  let t;
  return (An ?? (t = new globalThis.TextDecoder(), An = t.decode.bind(t)))(e);
}
class Vn {
  constructor() {
    this.buffer = new Uint8Array(), this.carriageReturnIndex = null, this.searchIndex = 0;
  }
  decode(t) {
    var n;
    if (t == null)
      return [];
    const r = t instanceof ArrayBuffer ? new Uint8Array(t) : typeof t == "string" ? ho(t) : t;
    this.buffer = Jy([this.buffer, r]);
    const i = [];
    let o;
    for (; (o = $y(this.buffer, (n = this.carriageReturnIndex) !== null && n !== void 0 ? n : this.searchIndex)) != null; ) {
      if (o.carriage && this.carriageReturnIndex == null) {
        this.carriageReturnIndex = o.index;
        continue;
      }
      if (this.carriageReturnIndex != null && (o.index !== this.carriageReturnIndex + 1 || o.carriage)) {
        i.push(_a(this.buffer.subarray(0, this.carriageReturnIndex - 1))), this.buffer = this.buffer.subarray(this.carriageReturnIndex), this.carriageReturnIndex = null, this.searchIndex = 0;
        continue;
      }
      const a = this.carriageReturnIndex !== null ? o.preceding - 1 : o.preceding, l = _a(this.buffer.subarray(0, a));
      i.push(l), this.buffer = this.buffer.subarray(o.index), this.carriageReturnIndex = null, this.searchIndex = 0;
    }
    return this.searchIndex = Math.max(0, this.buffer.length - 1), i;
  }
  flush() {
    return this.buffer.length ? this.decode(`
`) : [];
  }
}
Vn.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
Vn.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function $y(e, t) {
  const i = t ?? 0, o = e.indexOf(10, i), a = e.indexOf(13, i);
  if (o === -1 && a === -1)
    return null;
  let l;
  return o !== -1 && a !== -1 ? l = Math.min(o, a) : l = o !== -1 ? o : a, e[l] === 10 ? { preceding: l, index: l + 1, carriage: !1 } : { preceding: l, index: l + 1, carriage: !0 };
}
const Dn = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, va = (e, t, n) => {
  if (e) {
    if (Py(Dn, e))
      return e;
    Ee(n).warn(`${t} was set to ${JSON.stringify(e)}, expected one of ${JSON.stringify(Object.keys(Dn))}`);
  }
};
function on() {
}
function wn(e, t, n) {
  return !t || Dn[e] > Dn[n] ? on : t[e].bind(t);
}
const Wy = {
  error: on,
  warn: on,
  info: on,
  debug: on
};
let Ea = /* @__PURE__ */ new WeakMap();
function Ee(e) {
  var t;
  const n = e.logger, r = (t = e.logLevel) !== null && t !== void 0 ? t : "off";
  if (!n)
    return Wy;
  const i = Ea.get(n);
  if (i && i[0] === r)
    return i[1];
  const o = {
    error: wn("error", n, r),
    warn: wn("warn", n, r),
    info: wn("info", n, r),
    debug: wn("debug", n, r)
  };
  return Ea.set(n, [r, o]), o;
}
const ot = (e) => (e.options && (e.options = Object.assign({}, e.options), delete e.options.headers), e.headers && (e.headers = Object.fromEntries((e.headers instanceof Headers ? [...e.headers] : Object.entries(e.headers)).map(([t, n]) => [
  t,
  t.toLowerCase() === "x-goog-api-key" || t.toLowerCase() === "authorization" || t.toLowerCase() === "cookie" || t.toLowerCase() === "set-cookie" ? "***" : n
]))), "retryOfRequestLogID" in e && (e.retryOfRequestLogID && (e.retryOf = e.retryOfRequestLogID), delete e.retryOfRequestLogID), e);
class ht {
  constructor(t, n, r) {
    this.iterator = t, this.controller = n, this.client = r;
  }
  static fromSSEResponse(t, n, r) {
    let i = !1;
    const o = r ? Ee(r) : console;
    function a() {
      return xe(this, arguments, function* () {
        var d, c, f, p;
        if (i)
          throw new Re("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let h = !1;
        try {
          try {
            for (var g = !0, m = De(Ky(t, n)), v; v = yield j(m.next()), d = v.done, !d; g = !0) {
              p = v.value, g = !1;
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
              !g && !d && (f = m.return) && (yield j(f.call(m)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (E) {
          if (Yi(E))
            return yield j(void 0);
          throw E;
        } finally {
          h || n.abort();
        }
      });
    }
    return new ht(a, n, r);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(t, n, r) {
    let i = !1;
    function o() {
      return xe(this, arguments, function* () {
        var d, c, f, p;
        const h = new Vn(), g = pc(t);
        try {
          for (var m = !0, v = De(g), E; E = yield j(v.next()), d = E.done, !d; m = !0) {
            p = E.value, m = !1;
            const T = p;
            for (const C of h.decode(T))
              yield yield j(C);
          }
        } catch (T) {
          c = { error: T };
        } finally {
          try {
            !m && !d && (f = v.return) && (yield j(f.call(v)));
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
        var d, c, f, p;
        if (i)
          throw new Re("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
        i = !0;
        let h = !1;
        try {
          try {
            for (var g = !0, m = De(o()), v; v = yield j(m.next()), d = v.done, !d; g = !0) {
              p = v.value, g = !1;
              const E = p;
              h || E && (yield yield j(JSON.parse(E)));
            }
          } catch (E) {
            c = { error: E };
          } finally {
            try {
              !g && !d && (f = m.return) && (yield j(f.call(m)));
            } finally {
              if (c) throw c.error;
            }
          }
          h = !0;
        } catch (E) {
          if (Yi(E))
            return yield j(void 0);
          throw E;
        } finally {
          h || n.abort();
        }
      });
    }
    return new ht(a, n, r);
  }
  [Symbol.asyncIterator]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const t = [], n = [], r = this.iterator(), i = (o) => ({
      next: () => {
        if (o.length === 0) {
          const a = r.next();
          t.push(a), n.push(a);
        }
        return o.shift();
      }
    });
    return [
      new ht(() => i(t), this.controller, this.client),
      new ht(() => i(n), this.controller, this.client)
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const t = this;
    let n;
    return hc({
      async start() {
        n = t[Symbol.asyncIterator]();
      },
      async pull(r) {
        try {
          const { value: i, done: o } = await n.next();
          if (o)
            return r.close();
          const a = ho(JSON.stringify(i) + `
`);
          r.enqueue(a);
        } catch (i) {
          r.error(i);
        }
      },
      async cancel() {
        var r;
        await ((r = n.return) === null || r === void 0 ? void 0 : r.call(n));
      }
    });
  }
}
function Ky(e, t) {
  return xe(this, arguments, function* () {
    var r, i, o, a;
    if (!e.body)
      throw t.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new Re("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new Re("Attempted to iterate over a response with no body");
    const l = new zy(), d = new Vn(), c = pc(e.body);
    try {
      for (var f = !0, p = De(Yy(c)), h; h = yield j(p.next()), r = h.done, !r; f = !0) {
        a = h.value, f = !1;
        const g = a;
        for (const m of d.decode(g)) {
          const v = l.decode(m);
          v && (yield yield j(v));
        }
      }
    } catch (g) {
      i = { error: g };
    } finally {
      try {
        !f && !r && (o = p.return) && (yield j(o.call(p)));
      } finally {
        if (i) throw i.error;
      }
    }
    for (const g of d.flush()) {
      const m = l.decode(g);
      m && (yield yield j(m));
    }
  });
}
function Yy(e) {
  return xe(this, arguments, function* () {
    var n, r, i, o;
    try {
      for (var a = !0, l = De(e), d; d = yield j(l.next()), n = d.done, !n; a = !0) {
        o = d.value, a = !1;
        const c = o;
        if (c == null)
          continue;
        const f = c instanceof ArrayBuffer ? new Uint8Array(c) : typeof c == "string" ? ho(c) : c;
        yield yield j(f);
      }
    } catch (c) {
      r = { error: c };
    } finally {
      try {
        !a && !n && (i = l.return) && (yield j(i.call(l)));
      } finally {
        if (r) throw r.error;
      }
    }
  });
}
class zy {
  constructor() {
    this.event = null, this.data = [], this.chunks = [];
  }
  decode(t) {
    if (t.endsWith("\r") && (t = t.substring(0, t.length - 1)), !t) {
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
    if (this.chunks.push(t), t.startsWith(":"))
      return null;
    let [n, r, i] = Xy(t, ":");
    return i.startsWith(" ") && (i = i.substring(1)), n === "event" ? this.event = i : n === "data" && this.data.push(i), null;
  }
}
function Xy(e, t) {
  const n = e.indexOf(t);
  return n !== -1 ? [e.substring(0, n), t, e.substring(n + t.length)] : [e, "", ""];
}
async function Qy(e, t) {
  const { response: n, requestLogID: r, retryOfRequestLogID: i, startTime: o } = t, a = await (async () => {
    var l;
    if (t.options.stream)
      return Ee(e).debug("response", n.status, n.url, n.headers, n.body), t.options.__streamClass ? t.options.__streamClass.fromSSEResponse(n, t.controller, e) : ht.fromSSEResponse(n, t.controller, e);
    if (n.status === 204)
      return null;
    if (t.options.__binaryResponse)
      return n;
    const d = n.headers.get("content-type"), c = (l = d?.split(";")[0]) === null || l === void 0 ? void 0 : l.trim();
    return c?.includes("application/json") || c?.endsWith("+json") ? n.headers.get("content-length") === "0" ? void 0 : await n.json() : await n.text();
  })();
  return Ee(e).debug(`[${r}] response parsed`, ot({
    retryOfRequestLogID: i,
    url: n.url,
    status: n.status,
    body: a,
    durationMs: Date.now() - o
  })), a;
}
class po extends Promise {
  constructor(t, n, r = Qy) {
    super((i) => {
      i(null);
    }), this.responsePromise = n, this.parseResponse = r, this.client = t;
  }
  _thenUnwrap(t) {
    return new po(this.client, this.responsePromise, async (n, r) => t(await this.parseResponse(n, r), r));
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
    return this.responsePromise.then((t) => t.response);
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
    const [t, n] = await Promise.all([this.parse(), this.asResponse()]);
    return { data: t, response: n };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((t) => this.parseResponse(this.client, t))), this.parsedPromise;
  }
  then(t, n) {
    return this.parse().then(t, n);
  }
  catch(t) {
    return this.parse().catch(t);
  }
  finally(t) {
    return this.parse().finally(t);
  }
}
const Tc = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* Zy(e) {
  if (!e)
    return;
  if (Tc in e) {
    const { values: r, nulls: i } = e;
    yield* r.entries();
    for (const o of i)
      yield [o, null];
    return;
  }
  let t = !1, n;
  e instanceof Headers ? n = e.entries() : ma(e) ? n = e : (t = !0, n = Object.entries(e ?? {}));
  for (let r of n) {
    const i = r[0];
    if (typeof i != "string")
      throw new TypeError("expected header name to be a string");
    const o = ma(r[1]) ? r[1] : [r[1]];
    let a = !1;
    for (const l of o)
      l !== void 0 && (t && !a && (a = !0, yield [i, null]), yield [i, l]);
  }
}
const nn = (e) => {
  const t = new Headers(), n = /* @__PURE__ */ new Set();
  for (const r of e) {
    const i = /* @__PURE__ */ new Set();
    for (const [o, a] of Zy(r)) {
      const l = o.toLowerCase();
      i.has(l) || (t.delete(o), i.add(l)), a === null ? (t.delete(o), n.add(l)) : (t.append(o, a), n.delete(l));
    }
  }
  return { [Tc]: !0, values: t, nulls: n };
};
const Rr = (e) => {
  var t, n, r, i, o, a;
  if (typeof globalThis.process < "u")
    return (r = (n = (t = globalThis.process.env) === null || t === void 0 ? void 0 : t[e]) === null || n === void 0 ? void 0 : n.trim()) !== null && r !== void 0 ? r : void 0;
  if (typeof globalThis.Deno < "u")
    return (a = (o = (i = globalThis.Deno.env) === null || i === void 0 ? void 0 : i.get) === null || o === void 0 ? void 0 : o.call(i, e)) === null || a === void 0 ? void 0 : a.trim();
};
var Sc;
class Jn {
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
  constructor(t) {
    var n, r, i, o, a, l, d, { baseURL: c = Rr("GEMINI_NEXT_GEN_API_BASE_URL"), apiKey: f = (n = Rr("GEMINI_API_KEY")) !== null && n !== void 0 ? n : null, apiVersion: p = "v1beta" } = t, h = xn(t, ["baseURL", "apiKey", "apiVersion"]);
    const g = Object.assign(Object.assign({
      apiKey: f,
      apiVersion: p
    }, h), { baseURL: c || "https://generativelanguage.googleapis.com" });
    this.baseURL = g.baseURL, this.timeout = (r = g.timeout) !== null && r !== void 0 ? r : Jn.DEFAULT_TIMEOUT, this.logger = (i = g.logger) !== null && i !== void 0 ? i : console;
    const m = "warn";
    this.logLevel = m, this.logLevel = (a = (o = va(g.logLevel, "ClientOptions.logLevel", this)) !== null && o !== void 0 ? o : va(Rr("GEMINI_NEXT_GEN_API_LOG"), "process.env['GEMINI_NEXT_GEN_API_LOG']", this)) !== null && a !== void 0 ? a : m, this.fetchOptions = g.fetchOptions, this.maxRetries = (l = g.maxRetries) !== null && l !== void 0 ? l : 2, this.fetch = (d = g.fetch) !== null && d !== void 0 ? d : xy(), this.encoder = by, this._options = g, this.apiKey = f, this.apiVersion = p, this.clientAdapter = g.clientAdapter;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(t) {
    return new this.constructor(Object.assign(Object.assign(Object.assign({}, this._options), { baseURL: this.baseURL, maxRetries: this.maxRetries, timeout: this.timeout, logger: this.logger, logLevel: this.logLevel, fetch: this.fetch, fetchOptions: this.fetchOptions, apiKey: this.apiKey, apiVersion: this.apiVersion }), t));
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
  validateHeaders({ values: t, nulls: n }) {
    if (!(t.has("authorization") || t.has("x-goog-api-key")) && !(this.apiKey && t.get("x-goog-api-key")) && !n.has("x-goog-api-key"))
      throw new Error('Could not resolve authentication method. Expected the apiKey to be set. Or for the "x-goog-api-key" headers to be explicitly omitted');
  }
  async authHeaders(t) {
    const n = nn([t.headers]);
    if (!(n.values.has("authorization") || n.values.has("x-goog-api-key"))) {
      if (this.apiKey)
        return nn([{ "x-goog-api-key": this.apiKey }]);
      if (this.clientAdapter.isVertexAI())
        return nn([await this.clientAdapter.getAuthHeaders()]);
    }
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(t) {
    return Object.entries(t).filter(([n, r]) => typeof r < "u").map(([n, r]) => {
      if (typeof r == "string" || typeof r == "number" || typeof r == "boolean")
        return `${encodeURIComponent(n)}=${encodeURIComponent(r)}`;
      if (r === null)
        return `${encodeURIComponent(n)}=`;
      throw new Re(`Cannot stringify type ${typeof r}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${Ly}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${Sy()}`;
  }
  makeStatusError(t, n, r, i) {
    return Te.generate(t, n, r, i);
  }
  buildURL(t, n, r) {
    const i = !this.baseURLOverridden() && r || this.baseURL, o = Ay(t) ? new URL(t) : new URL(i + (i.endsWith("/") && t.startsWith("/") ? t.slice(1) : t)), a = this.defaultQuery();
    return Ry(a) || (n = Object.assign(Object.assign({}, a), n)), typeof n == "object" && n && !Array.isArray(n) && (o.search = this.stringifyQuery(n)), o.toString();
  }
  /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
  
     */
  async prepareOptions(t) {
    if (this.clientAdapter && this.clientAdapter.isVertexAI() && !t.path.startsWith(`/${this.apiVersion}/projects/`)) {
      const n = t.path.slice(this.apiVersion.length + 1);
      t.path = `/${this.apiVersion}/projects/${this.clientAdapter.getProject()}/locations/${this.clientAdapter.getLocation()}${n}`;
    }
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(t, { url: n, options: r }) {
  }
  get(t, n) {
    return this.methodRequest("get", t, n);
  }
  post(t, n) {
    return this.methodRequest("post", t, n);
  }
  patch(t, n) {
    return this.methodRequest("patch", t, n);
  }
  put(t, n) {
    return this.methodRequest("put", t, n);
  }
  delete(t, n) {
    return this.methodRequest("delete", t, n);
  }
  methodRequest(t, n, r) {
    return this.request(Promise.resolve(r).then((i) => Object.assign({ method: t, path: n }, i)));
  }
  request(t, n = null) {
    return new po(this, this.makeRequest(t, n, void 0));
  }
  async makeRequest(t, n, r) {
    var i, o, a;
    const l = await t, d = (i = l.maxRetries) !== null && i !== void 0 ? i : this.maxRetries;
    n == null && (n = d), await this.prepareOptions(l);
    const { req: c, url: f, timeout: p } = await this.buildRequest(l, {
      retryCount: d - n
    });
    await this.prepareRequest(c, { url: f, options: l });
    const h = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), g = r === void 0 ? "" : `, retryOf: ${r}`, m = Date.now();
    if (Ee(this).debug(`[${h}] sending request`, ot({
      retryOfRequestLogID: r,
      method: l.method,
      url: f,
      options: l,
      headers: c.headers
    })), !((o = l.signal) === null || o === void 0) && o.aborted)
      throw new Xi();
    const v = new AbortController(), E = await this.fetchWithTimeout(f, c, p, v).catch(zi), T = Date.now();
    if (E instanceof globalThis.Error) {
      const w = `retrying, ${n} attempts remaining`;
      if (!((a = l.signal) === null || a === void 0) && a.aborted)
        throw new Xi();
      const D = Yi(E) || /timed? ?out/i.test(String(E) + ("cause" in E ? String(E.cause) : ""));
      if (n)
        return Ee(this).info(`[${h}] connection ${D ? "timed out" : "failed"} - ${w}`), Ee(this).debug(`[${h}] connection ${D ? "timed out" : "failed"} (${w})`, ot({
          retryOfRequestLogID: r,
          url: f,
          durationMs: T - m,
          message: E.message
        })), this.retryRequest(l, n, r ?? h);
      throw Ee(this).info(`[${h}] connection ${D ? "timed out" : "failed"} - error; no more retries left`), Ee(this).debug(`[${h}] connection ${D ? "timed out" : "failed"} (error; no more retries left)`, ot({
        retryOfRequestLogID: r,
        url: f,
        durationMs: T - m,
        message: E.message
      })), D ? new ic() : new Hn({ cause: E });
    }
    const C = `[${h}${g}] ${c.method} ${f} ${E.ok ? "succeeded" : "failed"} with status ${E.status} in ${T - m}ms`;
    if (!E.ok) {
      const w = await this.shouldRetry(E);
      if (n && w) {
        const P = `retrying, ${n} attempts remaining`;
        return await Uy(E.body), Ee(this).info(`${C} - ${P}`), Ee(this).debug(`[${h}] response error (${P})`, ot({
          retryOfRequestLogID: r,
          url: E.url,
          status: E.status,
          headers: E.headers,
          durationMs: T - m
        })), this.retryRequest(l, n, r ?? h, E.headers);
      }
      const D = w ? "error; no more retries left" : "error; not retryable";
      Ee(this).info(`${C} - ${D}`);
      const _ = await E.text().catch((P) => zi(P).message), y = ky(_), S = y ? void 0 : _;
      throw Ee(this).debug(`[${h}] response error (${D})`, ot({
        retryOfRequestLogID: r,
        url: E.url,
        status: E.status,
        headers: E.headers,
        message: S,
        durationMs: Date.now() - m
      })), this.makeStatusError(E.status, y, S, E.headers);
    }
    return Ee(this).info(C), Ee(this).debug(`[${h}] response start`, ot({
      retryOfRequestLogID: r,
      url: E.url,
      status: E.status,
      headers: E.headers,
      durationMs: T - m
    })), { response: E, options: l, controller: v, requestLogID: h, retryOfRequestLogID: r, startTime: m };
  }
  async fetchWithTimeout(t, n, r, i) {
    const o = n || {}, { signal: a, method: l } = o, d = xn(o, ["signal", "method"]), c = this._makeAbort(i);
    a && a.addEventListener("abort", c, { once: !0 });
    const f = setTimeout(c, r), p = globalThis.ReadableStream && d.body instanceof globalThis.ReadableStream || typeof d.body == "object" && d.body !== null && Symbol.asyncIterator in d.body, h = Object.assign(Object.assign(Object.assign({ signal: i.signal }, p ? { duplex: "half" } : {}), { method: "GET" }), d);
    l && (h.method = l.toUpperCase());
    try {
      return await this.fetch.call(void 0, t, h);
    } finally {
      clearTimeout(f);
    }
  }
  async shouldRetry(t) {
    const n = t.headers.get("x-should-retry");
    return n === "true" ? !0 : n === "false" ? !1 : t.status === 408 || t.status === 409 || t.status === 429 || t.status >= 500;
  }
  async retryRequest(t, n, r, i) {
    var o;
    let a;
    const l = i?.get("retry-after-ms");
    if (l) {
      const c = parseFloat(l);
      Number.isNaN(c) || (a = c);
    }
    const d = i?.get("retry-after");
    if (d && !a) {
      const c = parseFloat(d);
      Number.isNaN(c) ? a = Date.parse(d) - Date.now() : a = c * 1e3;
    }
    if (!(a && 0 <= a && a < 60 * 1e3)) {
      const c = (o = t.maxRetries) !== null && o !== void 0 ? o : this.maxRetries;
      a = this.calculateDefaultRetryTimeoutMillis(n, c);
    }
    return await My(a), this.makeRequest(t, n - 1, r);
  }
  calculateDefaultRetryTimeoutMillis(t, n) {
    const o = n - t, a = Math.min(0.5 * Math.pow(2, o), 8), l = 1 - Math.random() * 0.25;
    return a * l * 1e3;
  }
  async buildRequest(t, { retryCount: n = 0 } = {}) {
    var r, i, o;
    const a = Object.assign({}, t), { method: l, path: d, query: c, defaultBaseURL: f } = a, p = this.buildURL(d, c, f);
    "timeout" in a && Ny("timeout", a.timeout), a.timeout = (r = a.timeout) !== null && r !== void 0 ? r : this.timeout;
    const { bodyHeaders: h, body: g } = this.buildBody({ options: a }), m = await this.buildHeaders({ options: t, method: l, bodyHeaders: h, retryCount: n });
    return { req: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ method: l, headers: m }, a.signal && { signal: a.signal }), globalThis.ReadableStream && g instanceof globalThis.ReadableStream && { duplex: "half" }), g && { body: g }), (i = this.fetchOptions) !== null && i !== void 0 ? i : {}), (o = a.fetchOptions) !== null && o !== void 0 ? o : {}), url: p, timeout: a.timeout };
  }
  async buildHeaders({ options: t, method: n, bodyHeaders: r, retryCount: i }) {
    let o = {};
    this.idempotencyHeader && n !== "get" && (t.idempotencyKey || (t.idempotencyKey = this.defaultIdempotencyKey()), o[this.idempotencyHeader] = t.idempotencyKey);
    const a = await this.authHeaders(t);
    let l = nn([
      o,
      { Accept: "application/json", "User-Agent": this.getUserAgent() },
      this._options.defaultHeaders,
      r,
      t.headers,
      a
    ]);
    return this.validateHeaders(l), l.values;
  }
  _makeAbort(t) {
    return () => t.abort();
  }
  buildBody({ options: { body: t, headers: n } }) {
    if (!t)
      return { bodyHeaders: void 0, body: void 0 };
    const r = nn([n]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(t) || t instanceof ArrayBuffer || t instanceof DataView || typeof t == "string" && // Preserve legacy string encoding behavior for now
      r.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && t instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      t instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      t instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && t instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: t } : typeof t == "object" && (Symbol.asyncIterator in t || Symbol.iterator in t && "next" in t && typeof t.next == "function") ? { bodyHeaders: void 0, body: Dy(t) } : typeof t == "object" && r.values.get("content-type") === "application/x-www-form-urlencoded" ? {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(t)
      } : this.encoder({ body: t, headers: r })
    );
  }
}
Jn.DEFAULT_TIMEOUT = 6e4;
class _e extends Jn {
  constructor() {
    super(...arguments), this.interactions = new Ec(this);
  }
}
Sc = _e;
_e.GeminiNextGenAPIClient = Sc;
_e.GeminiNextGenAPIClientError = Re;
_e.APIError = Te;
_e.APIConnectionError = Hn;
_e.APIConnectionTimeoutError = ic;
_e.APIUserAbortError = Xi;
_e.NotFoundError = lc;
_e.ConflictError = cc;
_e.RateLimitError = dc;
_e.BadRequestError = oc;
_e.AuthenticationError = sc;
_e.InternalServerError = fc;
_e.PermissionDeniedError = ac;
_e.UnprocessableEntityError = uc;
_e.toFile = By;
_e.Interactions = Ec;
const Ta = "x-goog-api-key", rn = "https://www.googleapis.com/auth/cloud-platform";
class jy {
  constructor(t) {
    if (t.apiKey !== void 0) {
      this.apiKey = t.apiKey;
      return;
    }
    const n = e_(t.googleAuthOptions);
    this.googleAuth = new nd.GoogleAuth(n);
  }
  async addAuthHeaders(t, n) {
    if (this.apiKey !== void 0) {
      if (this.apiKey.startsWith("auth_tokens/"))
        throw new Error("Ephemeral tokens are only supported by the live API.");
      this.addKeyHeader(t);
      return;
    }
    return this.addGoogleAuthHeaders(t, n);
  }
  addKeyHeader(t) {
    if (t.get(Ta) === null) {
      if (this.apiKey === void 0)
        throw new Error("Trying to set API key header but apiKey is not set");
      t.append(Ta, this.apiKey);
    }
  }
  async addGoogleAuthHeaders(t, n) {
    if (this.googleAuth === void 0)
      throw new Error("Trying to set google-auth headers but googleAuth is unset");
    const r = await this.googleAuth.getRequestHeaders(n);
    for (const [i, o] of r)
      t.get(i) === null && t.append(i, o);
  }
}
function e_(e) {
  let t;
  if (e) {
    if (t = e, t.scopes) {
      if (typeof t.scopes == "string" && t.scopes !== rn || Array.isArray(t.scopes) && t.scopes.indexOf(rn) < 0)
        throw new Error(`Invalid auth scopes. Scopes must include: ${rn}`);
    } else return t.scopes = [rn], t;
    return t;
  } else
    return t = {
      scopes: [rn]
    }, t;
}
class t_ {
  async download(t, n) {
    if (t.downloadPath) {
      const r = await n_(t, n);
      if (r instanceof mt) {
        const i = Mc(t.downloadPath);
        Lc.fromWeb(r.responseInternal.body).pipe(i), await Oc(i);
      } else
        try {
          await bc(t.downloadPath, r, {
            encoding: "base64"
          });
        } catch (i) {
          throw new Error(`Failed to write file to ${t.downloadPath}: ${i}`);
        }
    }
  }
}
async function n_(e, t) {
  var n, r, i;
  const o = fo(e.file);
  if (o !== void 0)
    return await t.request({
      path: `files/${o}:download`,
      httpMethod: "GET",
      queryParams: {
        alt: "media"
      },
      httpOptions: (n = e.config) === null || n === void 0 ? void 0 : n.httpOptions,
      abortSignal: (r = e.config) === null || r === void 0 ? void 0 : r.abortSignal
    });
  if (Pl(e.file)) {
    const a = (i = e.file.video) === null || i === void 0 ? void 0 : i.videoBytes;
    if (typeof a == "string")
      return a;
    throw new Error("Failed to download generated video, Uri or videoBytes not found.");
  } else if (Nl(e.file)) {
    const a = e.file.videoBytes;
    if (typeof a == "string")
      return a;
    throw new Error("Failed to download video, Uri or videoBytes not found.");
  } else
    throw new Error("Unsupported file type");
}
class r_ {
  create(t, n, r) {
    return new i_(t, n, r);
  }
}
class i_ {
  constructor(t, n, r) {
    this.url = t, this.headers = n, this.callbacks = r;
  }
  connect() {
    this.ws = new ad(this.url, { headers: this.headers }), this.ws.onopen = this.callbacks.onopen, this.ws.onerror = this.callbacks.onerror, this.ws.onclose = this.callbacks.onclose, this.ws.onmessage = this.callbacks.onmessage;
  }
  send(t) {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.send(t);
  }
  close() {
    if (this.ws === void 0)
      throw new Error("WebSocket is not connected");
    this.ws.close();
  }
}
function o_(e, t) {
  const n = {}, r = s(e, ["name"]);
  return r != null && u(n, ["_url", "name"], r), n;
}
function s_(e, t) {
  const n = {}, r = s(e, ["name"]);
  return r != null && u(n, ["_url", "name"], r), n;
}
function a_(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  return r != null && u(n, ["sdkHttpResponse"], r), n;
}
function l_(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  return r != null && u(n, ["sdkHttpResponse"], r), n;
}
function c_(e, t, n) {
  const r = {};
  if (s(e, ["validationDataset"]) !== void 0)
    throw new Error("validationDataset parameter is not supported in Gemini API.");
  const i = s(e, [
    "tunedModelDisplayName"
  ]);
  if (t !== void 0 && i != null && u(t, ["displayName"], i), s(e, ["description"]) !== void 0)
    throw new Error("description parameter is not supported in Gemini API.");
  const o = s(e, ["epochCount"]);
  t !== void 0 && o != null && u(t, ["tuningTask", "hyperparameters", "epochCount"], o);
  const a = s(e, [
    "learningRateMultiplier"
  ]);
  if (a != null && u(r, ["tuningTask", "hyperparameters", "learningRateMultiplier"], a), s(e, ["exportLastCheckpointOnly"]) !== void 0)
    throw new Error("exportLastCheckpointOnly parameter is not supported in Gemini API.");
  if (s(e, ["preTunedModelCheckpointId"]) !== void 0)
    throw new Error("preTunedModelCheckpointId parameter is not supported in Gemini API.");
  if (s(e, ["adapterSize"]) !== void 0)
    throw new Error("adapterSize parameter is not supported in Gemini API.");
  if (s(e, ["tuningMode"]) !== void 0)
    throw new Error("tuningMode parameter is not supported in Gemini API.");
  if (s(e, ["customBaseModel"]) !== void 0)
    throw new Error("customBaseModel parameter is not supported in Gemini API.");
  const l = s(e, ["batchSize"]);
  t !== void 0 && l != null && u(t, ["tuningTask", "hyperparameters", "batchSize"], l);
  const d = s(e, ["learningRate"]);
  if (t !== void 0 && d != null && u(t, ["tuningTask", "hyperparameters", "learningRate"], d), s(e, ["labels"]) !== void 0)
    throw new Error("labels parameter is not supported in Gemini API.");
  if (s(e, ["beta"]) !== void 0)
    throw new Error("beta parameter is not supported in Gemini API.");
  if (s(e, ["baseTeacherModel"]) !== void 0)
    throw new Error("baseTeacherModel parameter is not supported in Gemini API.");
  if (s(e, ["tunedTeacherModelSource"]) !== void 0)
    throw new Error("tunedTeacherModelSource parameter is not supported in Gemini API.");
  if (s(e, ["sftLossWeightMultiplier"]) !== void 0)
    throw new Error("sftLossWeightMultiplier parameter is not supported in Gemini API.");
  if (s(e, ["outputUri"]) !== void 0)
    throw new Error("outputUri parameter is not supported in Gemini API.");
  if (s(e, ["encryptionSpec"]) !== void 0)
    throw new Error("encryptionSpec parameter is not supported in Gemini API.");
  return r;
}
function u_(e, t, n) {
  const r = {};
  let i = s(n, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const y = s(e, [
      "validationDataset"
    ]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec"], Pr(y));
  } else if (i === "PREFERENCE_TUNING") {
    const y = s(e, [
      "validationDataset"
    ]);
    t !== void 0 && y != null && u(t, ["preferenceOptimizationSpec"], Pr(y));
  } else if (i === "DISTILLATION") {
    const y = s(e, [
      "validationDataset"
    ]);
    t !== void 0 && y != null && u(t, ["distillationSpec"], Pr(y));
  }
  const o = s(e, [
    "tunedModelDisplayName"
  ]);
  t !== void 0 && o != null && u(t, ["tunedModelDisplayName"], o);
  const a = s(e, ["description"]);
  t !== void 0 && a != null && u(t, ["description"], a);
  let l = s(n, [
    "config",
    "method"
  ]);
  if (l === void 0 && (l = "SUPERVISED_FINE_TUNING"), l === "SUPERVISED_FINE_TUNING") {
    const y = s(e, ["epochCount"]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "hyperParameters", "epochCount"], y);
  } else if (l === "PREFERENCE_TUNING") {
    const y = s(e, ["epochCount"]);
    t !== void 0 && y != null && u(t, ["preferenceOptimizationSpec", "hyperParameters", "epochCount"], y);
  } else if (l === "DISTILLATION") {
    const y = s(e, ["epochCount"]);
    t !== void 0 && y != null && u(t, ["distillationSpec", "hyperParameters", "epochCount"], y);
  }
  let d = s(n, [
    "config",
    "method"
  ]);
  if (d === void 0 && (d = "SUPERVISED_FINE_TUNING"), d === "SUPERVISED_FINE_TUNING") {
    const y = s(e, [
      "learningRateMultiplier"
    ]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "hyperParameters", "learningRateMultiplier"], y);
  } else if (d === "PREFERENCE_TUNING") {
    const y = s(e, [
      "learningRateMultiplier"
    ]);
    t !== void 0 && y != null && u(t, [
      "preferenceOptimizationSpec",
      "hyperParameters",
      "learningRateMultiplier"
    ], y);
  } else if (d === "DISTILLATION") {
    const y = s(e, [
      "learningRateMultiplier"
    ]);
    t !== void 0 && y != null && u(t, ["distillationSpec", "hyperParameters", "learningRateMultiplier"], y);
  }
  let c = s(n, ["config", "method"]);
  if (c === void 0 && (c = "SUPERVISED_FINE_TUNING"), c === "SUPERVISED_FINE_TUNING") {
    const y = s(e, [
      "exportLastCheckpointOnly"
    ]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "exportLastCheckpointOnly"], y);
  } else if (c === "PREFERENCE_TUNING") {
    const y = s(e, [
      "exportLastCheckpointOnly"
    ]);
    t !== void 0 && y != null && u(t, ["preferenceOptimizationSpec", "exportLastCheckpointOnly"], y);
  } else if (c === "DISTILLATION") {
    const y = s(e, [
      "exportLastCheckpointOnly"
    ]);
    t !== void 0 && y != null && u(t, ["distillationSpec", "exportLastCheckpointOnly"], y);
  }
  let f = s(n, [
    "config",
    "method"
  ]);
  if (f === void 0 && (f = "SUPERVISED_FINE_TUNING"), f === "SUPERVISED_FINE_TUNING") {
    const y = s(e, ["adapterSize"]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "hyperParameters", "adapterSize"], y);
  } else if (f === "PREFERENCE_TUNING") {
    const y = s(e, ["adapterSize"]);
    t !== void 0 && y != null && u(t, ["preferenceOptimizationSpec", "hyperParameters", "adapterSize"], y);
  } else if (f === "DISTILLATION") {
    const y = s(e, ["adapterSize"]);
    t !== void 0 && y != null && u(t, ["distillationSpec", "hyperParameters", "adapterSize"], y);
  }
  let p = s(n, [
    "config",
    "method"
  ]);
  if (p === void 0 && (p = "SUPERVISED_FINE_TUNING"), p === "SUPERVISED_FINE_TUNING") {
    const y = s(e, ["tuningMode"]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "tuningMode"], y);
  }
  const h = s(e, [
    "customBaseModel"
  ]);
  t !== void 0 && h != null && u(t, ["customBaseModel"], h);
  let g = s(n, [
    "config",
    "method"
  ]);
  if (g === void 0 && (g = "SUPERVISED_FINE_TUNING"), g === "SUPERVISED_FINE_TUNING") {
    const y = s(e, ["batchSize"]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "hyperParameters", "batchSize"], y);
  }
  let m = s(n, [
    "config",
    "method"
  ]);
  if (m === void 0 && (m = "SUPERVISED_FINE_TUNING"), m === "SUPERVISED_FINE_TUNING") {
    const y = s(e, [
      "learningRate"
    ]);
    t !== void 0 && y != null && u(t, ["supervisedTuningSpec", "hyperParameters", "learningRate"], y);
  }
  const v = s(e, ["labels"]);
  t !== void 0 && v != null && u(t, ["labels"], v);
  const E = s(e, ["beta"]);
  t !== void 0 && E != null && u(t, ["preferenceOptimizationSpec", "hyperParameters", "beta"], E);
  const T = s(e, [
    "baseTeacherModel"
  ]);
  t !== void 0 && T != null && u(t, ["distillationSpec", "baseTeacherModel"], T);
  const C = s(e, [
    "tunedTeacherModelSource"
  ]);
  t !== void 0 && C != null && u(t, ["distillationSpec", "tunedTeacherModelSource"], C);
  const w = s(e, [
    "sftLossWeightMultiplier"
  ]);
  t !== void 0 && w != null && u(t, ["distillationSpec", "hyperParameters", "sftLossWeightMultiplier"], w);
  const D = s(e, ["outputUri"]);
  t !== void 0 && D != null && u(t, ["outputUri"], D);
  const _ = s(e, [
    "encryptionSpec"
  ]);
  return t !== void 0 && _ != null && u(t, ["encryptionSpec"], _), r;
}
function d_(e, t) {
  const n = {}, r = s(e, ["baseModel"]);
  r != null && u(n, ["baseModel"], r);
  const i = s(e, [
    "preTunedModel"
  ]);
  i != null && u(n, ["preTunedModel"], i);
  const o = s(e, [
    "trainingDataset"
  ]);
  o != null && S_(o);
  const a = s(e, ["config"]);
  return a != null && c_(a, n), n;
}
function f_(e, t) {
  const n = {}, r = s(e, ["baseModel"]);
  r != null && u(n, ["baseModel"], r);
  const i = s(e, [
    "preTunedModel"
  ]);
  i != null && u(n, ["preTunedModel"], i);
  const o = s(e, [
    "trainingDataset"
  ]);
  o != null && C_(o, n, t);
  const a = s(e, ["config"]);
  return a != null && u_(a, n, t), n;
}
function h_(e, t) {
  const n = {}, r = s(e, ["name"]);
  return r != null && u(n, ["_url", "name"], r), n;
}
function p_(e, t) {
  const n = {}, r = s(e, ["name"]);
  return r != null && u(n, ["_url", "name"], r), n;
}
function g_(e, t, n) {
  const r = {}, i = s(e, ["pageSize"]);
  t !== void 0 && i != null && u(t, ["_query", "pageSize"], i);
  const o = s(e, ["pageToken"]);
  t !== void 0 && o != null && u(t, ["_query", "pageToken"], o);
  const a = s(e, ["filter"]);
  return t !== void 0 && a != null && u(t, ["_query", "filter"], a), r;
}
function m_(e, t, n) {
  const r = {}, i = s(e, ["pageSize"]);
  t !== void 0 && i != null && u(t, ["_query", "pageSize"], i);
  const o = s(e, ["pageToken"]);
  t !== void 0 && o != null && u(t, ["_query", "pageToken"], o);
  const a = s(e, ["filter"]);
  return t !== void 0 && a != null && u(t, ["_query", "filter"], a), r;
}
function y_(e, t) {
  const n = {}, r = s(e, ["config"]);
  return r != null && g_(r, n), n;
}
function __(e, t) {
  const n = {}, r = s(e, ["config"]);
  return r != null && m_(r, n), n;
}
function v_(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "nextPageToken"
  ]);
  i != null && u(n, ["nextPageToken"], i);
  const o = s(e, ["tunedModels"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((l) => Cc(l))), u(n, ["tuningJobs"], a);
  }
  return n;
}
function E_(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, [
    "nextPageToken"
  ]);
  i != null && u(n, ["nextPageToken"], i);
  const o = s(e, ["tuningJobs"]);
  if (o != null) {
    let a = o;
    Array.isArray(a) && (a = a.map((l) => ji(l))), u(n, ["tuningJobs"], a);
  }
  return n;
}
function T_(e, t) {
  const n = {}, r = s(e, ["name"]);
  r != null && u(n, ["model"], r);
  const i = s(e, ["name"]);
  return i != null && u(n, ["endpoint"], i), n;
}
function S_(e, t) {
  const n = {};
  if (s(e, ["gcsUri"]) !== void 0)
    throw new Error("gcsUri parameter is not supported in Gemini API.");
  if (s(e, ["vertexDatasetResource"]) !== void 0)
    throw new Error("vertexDatasetResource parameter is not supported in Gemini API.");
  const r = s(e, ["examples"]);
  if (r != null) {
    let i = r;
    Array.isArray(i) && (i = i.map((o) => o)), u(n, ["examples", "examples"], i);
  }
  return n;
}
function C_(e, t, n) {
  const r = {};
  let i = s(n, [
    "config",
    "method"
  ]);
  if (i === void 0 && (i = "SUPERVISED_FINE_TUNING"), i === "SUPERVISED_FINE_TUNING") {
    const a = s(e, ["gcsUri"]);
    t !== void 0 && a != null && u(t, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (i === "PREFERENCE_TUNING") {
    const a = s(e, ["gcsUri"]);
    t !== void 0 && a != null && u(t, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (i === "DISTILLATION") {
    const a = s(e, ["gcsUri"]);
    t !== void 0 && a != null && u(t, ["distillationSpec", "promptDatasetUri"], a);
  }
  let o = s(n, [
    "config",
    "method"
  ]);
  if (o === void 0 && (o = "SUPERVISED_FINE_TUNING"), o === "SUPERVISED_FINE_TUNING") {
    const a = s(e, [
      "vertexDatasetResource"
    ]);
    t !== void 0 && a != null && u(t, ["supervisedTuningSpec", "trainingDatasetUri"], a);
  } else if (o === "PREFERENCE_TUNING") {
    const a = s(e, [
      "vertexDatasetResource"
    ]);
    t !== void 0 && a != null && u(t, ["preferenceOptimizationSpec", "trainingDatasetUri"], a);
  } else if (o === "DISTILLATION") {
    const a = s(e, [
      "vertexDatasetResource"
    ]);
    t !== void 0 && a != null && u(t, ["distillationSpec", "promptDatasetUri"], a);
  }
  if (s(e, ["examples"]) !== void 0)
    throw new Error("examples parameter is not supported in Vertex AI.");
  return r;
}
function Cc(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["name"]);
  i != null && u(n, ["name"], i);
  const o = s(e, ["state"]);
  o != null && u(n, ["state"], Rl(o));
  const a = s(e, ["createTime"]);
  a != null && u(n, ["createTime"], a);
  const l = s(e, [
    "tuningTask",
    "startTime"
  ]);
  l != null && u(n, ["startTime"], l);
  const d = s(e, [
    "tuningTask",
    "completeTime"
  ]);
  d != null && u(n, ["endTime"], d);
  const c = s(e, ["updateTime"]);
  c != null && u(n, ["updateTime"], c);
  const f = s(e, ["description"]);
  f != null && u(n, ["description"], f);
  const p = s(e, ["baseModel"]);
  p != null && u(n, ["baseModel"], p);
  const h = s(e, ["_self"]);
  return h != null && u(n, ["tunedModel"], T_(h)), n;
}
function ji(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["name"]);
  i != null && u(n, ["name"], i);
  const o = s(e, ["state"]);
  o != null && u(n, ["state"], Rl(o));
  const a = s(e, ["createTime"]);
  a != null && u(n, ["createTime"], a);
  const l = s(e, ["startTime"]);
  l != null && u(n, ["startTime"], l);
  const d = s(e, ["endTime"]);
  d != null && u(n, ["endTime"], d);
  const c = s(e, ["updateTime"]);
  c != null && u(n, ["updateTime"], c);
  const f = s(e, ["error"]);
  f != null && u(n, ["error"], f);
  const p = s(e, ["description"]);
  p != null && u(n, ["description"], p);
  const h = s(e, ["baseModel"]);
  h != null && u(n, ["baseModel"], h);
  const g = s(e, ["tunedModel"]);
  g != null && u(n, ["tunedModel"], g);
  const m = s(e, [
    "preTunedModel"
  ]);
  m != null && u(n, ["preTunedModel"], m);
  const v = s(e, [
    "supervisedTuningSpec"
  ]);
  v != null && u(n, ["supervisedTuningSpec"], v);
  const E = s(e, [
    "preferenceOptimizationSpec"
  ]);
  E != null && u(n, ["preferenceOptimizationSpec"], E);
  const T = s(e, [
    "distillationSpec"
  ]);
  T != null && u(n, ["distillationSpec"], T);
  const C = s(e, [
    "tuningDataStats"
  ]);
  C != null && u(n, ["tuningDataStats"], C);
  const w = s(e, [
    "encryptionSpec"
  ]);
  w != null && u(n, ["encryptionSpec"], w);
  const D = s(e, [
    "partnerModelTuningSpec"
  ]);
  D != null && u(n, ["partnerModelTuningSpec"], D);
  const _ = s(e, [
    "customBaseModel"
  ]);
  _ != null && u(n, ["customBaseModel"], _);
  const y = s(e, [
    "evaluateDatasetRuns"
  ]);
  if (y != null) {
    let $ = y;
    Array.isArray($) && ($ = $.map((X) => X)), u(n, ["evaluateDatasetRuns"], $);
  }
  const S = s(e, ["experiment"]);
  S != null && u(n, ["experiment"], S);
  const R = s(e, [
    "fullFineTuningSpec"
  ]);
  R != null && u(n, ["fullFineTuningSpec"], R);
  const P = s(e, ["labels"]);
  P != null && u(n, ["labels"], P);
  const N = s(e, ["outputUri"]);
  N != null && u(n, ["outputUri"], N);
  const G = s(e, ["pipelineJob"]);
  G != null && u(n, ["pipelineJob"], G);
  const V = s(e, [
    "serviceAccount"
  ]);
  V != null && u(n, ["serviceAccount"], V);
  const q = s(e, [
    "tunedModelDisplayName"
  ]);
  q != null && u(n, ["tunedModelDisplayName"], q);
  const J = s(e, [
    "tuningJobState"
  ]);
  J != null && u(n, ["tuningJobState"], J);
  const W = s(e, [
    "veoTuningSpec"
  ]);
  return W != null && u(n, ["veoTuningSpec"], W), n;
}
function A_(e, t) {
  const n = {}, r = s(e, [
    "sdkHttpResponse"
  ]);
  r != null && u(n, ["sdkHttpResponse"], r);
  const i = s(e, ["name"]);
  i != null && u(n, ["name"], i);
  const o = s(e, ["metadata"]);
  o != null && u(n, ["metadata"], o);
  const a = s(e, ["done"]);
  a != null && u(n, ["done"], a);
  const l = s(e, ["error"]);
  return l != null && u(n, ["error"], l), n;
}
function Pr(e, t) {
  const n = {}, r = s(e, ["gcsUri"]);
  r != null && u(n, ["validationDatasetUri"], r);
  const i = s(e, [
    "vertexDatasetResource"
  ]);
  return i != null && u(n, ["validationDatasetUri"], i), n;
}
class w_ extends Ve {
  constructor(t) {
    super(), this.apiClient = t, this.list = async (n = {}) => new Ye(Oe.PAGED_ITEM_TUNING_JOBS, (r) => this.listInternal(r), await this.listInternal(n), n), this.get = async (n) => await this.getInternal(n), this.tune = async (n) => {
      var r;
      if (this.apiClient.isVertexAI())
        if (n.baseModel.startsWith("projects/")) {
          const i = {
            tunedModelName: n.baseModel
          };
          !((r = n.config) === null || r === void 0) && r.preTunedModelCheckpointId && (i.checkpointId = n.config.preTunedModelCheckpointId);
          const o = Object.assign(Object.assign({}, n), { preTunedModel: i });
          return o.baseModel = void 0, await this.tuneInternal(o);
        } else {
          const i = Object.assign({}, n);
          return await this.tuneInternal(i);
        }
      else {
        const i = Object.assign({}, n), o = await this.tuneMldevInternal(i);
        let a = "";
        return o.metadata !== void 0 && o.metadata.tunedModel !== void 0 ? a = o.metadata.tunedModel : o.name !== void 0 && o.name.includes("/operations/") && (a = o.name.split("/operations/")[0]), {
          name: a,
          state: Nn.JOB_STATE_QUEUED
        };
      }
    };
  }
  async getInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = p_(t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => ji(f));
    } else {
      const c = h_(t);
      return l = z("{name}", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => Cc(f));
    }
  }
  async listInternal(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = __(t);
      return l = z("tuningJobs", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = E_(f), h = new Fi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = y_(t);
      return l = z("tunedModels", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "GET",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = v_(f), h = new Fi();
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
  async cancel(t) {
    var n, r, i, o;
    let a, l = "", d = {};
    if (this.apiClient.isVertexAI()) {
      const c = s_(t);
      return l = z("{name}:cancel", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = l_(f), h = new Gi();
        return Object.assign(h, p), h;
      });
    } else {
      const c = o_(t);
      return l = z("{name}:cancel", c._url), d = c._query, delete c._url, delete c._query, a = this.apiClient.request({
        path: l,
        queryParams: d,
        body: JSON.stringify(c),
        httpMethod: "POST",
        httpOptions: (i = t.config) === null || i === void 0 ? void 0 : i.httpOptions,
        abortSignal: (o = t.config) === null || o === void 0 ? void 0 : o.abortSignal
      }).then((f) => f.json().then((p) => {
        const h = p;
        return h.sdkHttpResponse = {
          headers: f.headers
        }, h;
      })), a.then((f) => {
        const p = a_(f), h = new Gi();
        return Object.assign(h, p), h;
      });
    }
  }
  async tuneInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI()) {
      const l = f_(t, t);
      return o = z("tuningJobs", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => ji(d));
    } else
      throw new Error("This method is only supported by the Vertex AI.");
  }
  async tuneMldevInternal(t) {
    var n, r;
    let i, o = "", a = {};
    if (this.apiClient.isVertexAI())
      throw new Error("This method is only supported by the Gemini Developer API.");
    {
      const l = d_(t);
      return o = z("tunedModels", l._url), a = l._query, delete l._url, delete l._query, i = this.apiClient.request({
        path: o,
        queryParams: a,
        body: JSON.stringify(l),
        httpMethod: "POST",
        httpOptions: (n = t.config) === null || n === void 0 ? void 0 : n.httpOptions,
        abortSignal: (r = t.config) === null || r === void 0 ? void 0 : r.abortSignal
      }).then((d) => d.json().then((c) => {
        const f = c;
        return f.sdkHttpResponse = {
          headers: d.headers
        }, f;
      })), i.then((d) => A_(d));
    }
  }
}
const Ac = 1024 * 1024 * 8, wc = 3, Ic = 1e3, Rc = 2, $e = "x-goog-upload-status";
async function I_(e, t, n) {
  var r;
  const i = await Pc(e, t, n), o = await i?.json();
  if (((r = i?.headers) === null || r === void 0 ? void 0 : r[$e]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  return o.file;
}
async function R_(e, t, n) {
  var r;
  const i = await Pc(e, t, n), o = await i?.json();
  if (((r = i?.headers) === null || r === void 0 ? void 0 : r[$e]) !== "final")
    throw new Error("Failed to upload file: Upload status is not finalized.");
  const a = so(o), l = new hn();
  return Object.assign(l, a), l;
}
async function Pc(e, t, n) {
  var r, i;
  let o = 0, a = 0, l = new mt(new Response()), d = "upload";
  for (o = e.size; a < o; ) {
    const c = Math.min(Ac, o - a), f = e.slice(a, a + c);
    a + c >= o && (d += ", finalize");
    let p = 0, h = Ic;
    for (; p < wc && (l = await n.request({
      path: "",
      body: f,
      httpMethod: "POST",
      httpOptions: {
        apiVersion: "",
        baseUrl: t,
        headers: {
          "X-Goog-Upload-Command": d,
          "X-Goog-Upload-Offset": String(a),
          "Content-Length": String(c)
        }
      }
    }), !(!((r = l?.headers) === null || r === void 0) && r[$e])); )
      p++, await Nc(h), h = h * Rc;
    if (a += c, ((i = l?.headers) === null || i === void 0 ? void 0 : i[$e]) !== "active")
      break;
    if (o <= a)
      throw new Error("All content has been uploaded, but the upload status is not finalized.");
  }
  return l;
}
async function P_(e) {
  return { size: e.size, type: e.type };
}
function Nc(e) {
  return new Promise((t) => setTimeout(t, e));
}
class N_ {
  async stat(t) {
    const n = { size: 0, type: void 0 };
    if (typeof t == "string") {
      const r = await yo.stat(t);
      return n.size = r.size, n.type = this.inferMimeType(t), n;
    } else
      return await P_(t);
  }
  async upload(t, n, r) {
    return typeof t == "string" ? await this.uploadFileFromPath(t, n, r) : I_(t, n, r);
  }
  async uploadToFileSearchStore(t, n, r) {
    return typeof t == "string" ? await this.uploadFileToFileSearchStoreFromPath(t, n, r) : R_(t, n, r);
  }
  /**
   * Infers the MIME type of a file based on its extension.
   *
   * @param filePath The path to the file.
   * @returns The MIME type of the file, or undefined if it cannot be inferred.
   */
  inferMimeType(t) {
    const n = t.slice(t.lastIndexOf(".") + 1);
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
  async uploadFileFromPath(t, n, r) {
    var i;
    const o = await this.uploadFileFromPathInternal(t, n, r), a = await o?.json();
    if (((i = o?.headers) === null || i === void 0 ? void 0 : i[$e]) !== "final")
      throw new Error("Failed to upload file: Upload status is not finalized.");
    return a.file;
  }
  async uploadFileToFileSearchStoreFromPath(t, n, r) {
    var i;
    const o = await this.uploadFileFromPathInternal(t, n, r), a = await o?.json();
    if (((i = o?.headers) === null || i === void 0 ? void 0 : i[$e]) !== "final")
      throw new Error("Failed to upload file: Upload status is not finalized.");
    const l = so(a), d = new hn();
    return Object.assign(d, l), d;
  }
  async uploadFileFromPathInternal(t, n, r) {
    var i, o;
    let a = 0, l = 0, d = new mt(new Response()), c = "upload", f;
    const p = Dc.basename(t);
    try {
      if (f = await yo.open(t, "r"), !f)
        throw new Error("Failed to open file");
      for (a = (await f.stat()).size; l < a; ) {
        const h = Math.min(Ac, a - l);
        l + h >= a && (c += ", finalize");
        const g = new Uint8Array(h), { bytesRead: m } = await f.read(g, 0, h, l);
        if (m !== h)
          throw new Error(`Failed to read ${h} bytes from file at offset ${l}. bytes actually read: ${m}`);
        const v = new Blob([g]);
        let E = 0, T = Ic;
        for (; E < wc && (d = await r.request({
          path: "",
          body: v,
          httpMethod: "POST",
          httpOptions: {
            apiVersion: "",
            baseUrl: n,
            headers: {
              "X-Goog-Upload-Command": c,
              "X-Goog-Upload-Offset": String(l),
              "Content-Length": String(m),
              "X-Goog-Upload-File-Name": p
            }
          }
        }), !(!((i = d?.headers) === null || i === void 0) && i[$e])); )
          E++, await Nc(T), T = T * Rc;
        if (l += m, ((o = d?.headers) === null || o === void 0 ? void 0 : o[$e]) !== "active")
          break;
        if (a <= l)
          throw new Error("All content has been uploaded, but the upload status is not finalized.");
      }
      return d;
    } finally {
      f && await f.close();
    }
  }
}
class k_ extends Bl {
  /**
   * Registers Google Cloud Storage files for use with the API.
   * This method is only available in Node.js environments.
   */
  async registerFiles(t) {
    if (typeof process > "u" || !process.versions || !process.versions.node)
      throw new Error("registerFiles is only supported in Node.js environments.");
    const r = await t.auth.getRequestHeaders(), i = t.config || {}, o = i.httpOptions || {}, a = Object.assign({}, o.headers || {});
    if (r)
      if (typeof r[Symbol.iterator] == "function")
        for (const [l, d] of r)
          a[l] = d;
      else
        for (const [l, d] of Object.entries(r))
          a[l] = d;
    return this._registerFiles({
      uris: t.uris,
      config: Object.assign(Object.assign({}, i), { httpOptions: Object.assign(Object.assign({}, o), { headers: a }) })
    });
  }
}
const M_ = "gl-node/";
class x_ {
  get interactions() {
    var t;
    if (this._interactions !== void 0)
      return this._interactions;
    console.warn("GoogleGenAI.interactions: Interactions usage is experimental and may change in future versions.");
    const n = this.httpOptions;
    n?.extraBody && console.warn("GoogleGenAI.interactions: Client level httpOptions.extraBody is not supported by the interactions client and will be ignored.");
    const r = new _e({
      baseURL: this.apiClient.getBaseUrl(),
      apiKey: this.apiKey,
      apiVersion: this.apiClient.getApiVersion(),
      clientAdapter: this.apiClient,
      defaultHeaders: this.apiClient.getDefaultHeaders(),
      timeout: n?.timeout,
      maxRetries: (t = n?.retryOptions) === null || t === void 0 ? void 0 : t.attempts
    });
    return this._interactions = r.interactions, this._interactions;
  }
  constructor(t) {
    var n, r, i, o, a, l;
    if ((t.project || t.location) && t.apiKey)
      throw new Error("Project/location and API key are mutually exclusive in the client initializer.");
    this.vertexai = (r = (n = t.vertexai) !== null && n !== void 0 ? n : D_("GOOGLE_GENAI_USE_VERTEXAI")) !== null && r !== void 0 ? r : !1;
    const d = b_(), c = at("GOOGLE_CLOUD_PROJECT"), f = at("GOOGLE_CLOUD_LOCATION");
    this.apiKey = (i = t.apiKey) !== null && i !== void 0 ? i : d, this.project = (o = t.project) !== null && o !== void 0 ? o : c, this.location = (a = t.location) !== null && a !== void 0 ? a : f, !this.vertexai && !this.apiKey && console.warn("API key should be set when using the Gemini API."), t.vertexai && (!((l = t.googleAuthOptions) === null || l === void 0) && l.credentials && (console.debug("The user provided Google Cloud credentials will take precedence over the API key from the environment variable."), this.apiKey = void 0), (c || f) && t.apiKey ? (console.debug("The user provided Vertex AI API key will take precedence over the project/location from the environment variables."), this.project = void 0, this.location = void 0) : (t.project || t.location) && d ? (console.debug("The user provided project/location will take precedence over the API key from the environment variables."), this.apiKey = void 0) : (c || f) && d && (console.debug("The project/location from the environment variables will take precedence over the API key from the environment variables."), this.apiKey = void 0), !this.location && !this.apiKey && (this.location = "global"));
    const p = fd(t.httpOptions, t.vertexai, at("GOOGLE_VERTEX_BASE_URL"), at("GOOGLE_GEMINI_BASE_URL"));
    p && (t.httpOptions ? t.httpOptions.baseUrl = p : t.httpOptions = { baseUrl: p }), this.apiVersion = t.apiVersion, this.httpOptions = t.httpOptions;
    const h = new jy({
      apiKey: this.apiKey,
      googleAuthOptions: t.googleAuthOptions
    });
    this.apiClient = new Um({
      auth: h,
      project: this.project,
      location: this.location,
      apiVersion: this.apiVersion,
      apiKey: this.apiKey,
      vertexai: this.vertexai,
      httpOptions: this.httpOptions,
      userAgentExtra: M_ + process.version,
      uploader: new N_(),
      downloader: new t_()
    }), this.models = new ec(this.apiClient), this.live = new Zl(this.apiClient, h, new r_()), this.batches = new Ll(this.apiClient), this.chats = new Gl(this.models, this.apiClient), this.caches = new Ol(this.apiClient), this.files = new k_(this.apiClient), this.operations = new tc(this.apiClient), this.authTokens = new nc(this.apiClient), this.tunings = new w_(this.apiClient), this.fileSearchStores = new Ty(this.apiClient);
  }
}
function at(e) {
  var t, n, r;
  return (r = (n = (t = process == null ? void 0 : process.env) === null || t === void 0 ? void 0 : t[e]) === null || n === void 0 ? void 0 : n.trim()) !== null && r !== void 0 ? r : void 0;
}
function D_(e) {
  return U_(at(e));
}
function U_(e) {
  return e === void 0 ? !1 : e.toLowerCase() === "true";
}
function b_() {
  const e = at("GOOGLE_API_KEY"), t = at("GEMINI_API_KEY");
  return e && t && console.warn("Both GOOGLE_API_KEY and GEMINI_API_KEY are set. Using GOOGLE_API_KEY."), e || t || void 0;
}
const rv = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  get ActivityHandling() {
    return Pi;
  },
  get AdapterSize() {
    return jr;
  },
  get AggregationMetric() {
    return ti;
  },
  ApiError: pn,
  get ApiSpec() {
    return Lr;
  },
  get AuthType() {
    return Ur;
  },
  Batches: Ll,
  get Behavior() {
    return Or;
  },
  get BlockedReason() {
    return zr;
  },
  Caches: Ol,
  CancelTuningJobResponse: Gi,
  Chat: ql,
  Chats: Gl,
  ComputeTokensResponse: fl,
  ContentReferenceImage: nf,
  ControlReferenceImage: jd,
  get ControlReferenceType() {
    return di;
  },
  CountTokensResponse: Oi,
  CreateFileResponse: yl,
  DeleteCachedContentResponse: qi,
  DeleteFileResponse: _l,
  DeleteModelResponse: Li,
  get DocumentState() {
    return vi;
  },
  get DynamicRetrievalConfigMode() {
    return Fr;
  },
  EditImageResponse: ll,
  get EditMode() {
    return hi;
  },
  EmbedContentResponse: Di,
  get EmbeddingApiType() {
    return ln;
  },
  get EndSensitivity() {
    return Ri;
  },
  get Environment() {
    return si;
  },
  EvaluateDatasetResponse: $d,
  get FeatureSelectionPreference() {
    return oi;
  },
  get FileSource() {
    return Ti;
  },
  get FileState() {
    return Ei;
  },
  Files: Bl,
  get FinishReason() {
    return $r;
  },
  get FunctionCallingConfigMode() {
    return Gr;
  },
  FunctionResponse: Dd,
  FunctionResponseBlob: Pd,
  FunctionResponseFileData: Nd,
  FunctionResponsePart: kd,
  get FunctionResponseScheduling() {
    return xr;
  },
  GenerateContentResponse: ft,
  GenerateContentResponsePromptFeedback: Hd,
  GenerateContentResponseUsageMetadata: Vd,
  GenerateImagesResponse: Ui,
  GenerateVideosOperation: cn,
  GenerateVideosResponse: Jd,
  GoogleGenAI: x_,
  get HarmBlockMethod() {
    return Vr;
  },
  get HarmBlockThreshold() {
    return Jr;
  },
  get HarmCategory() {
    return Hr;
  },
  get HarmProbability() {
    return Wr;
  },
  get HarmSeverity() {
    return Kr;
  },
  get HttpElementLocation() {
    return br;
  },
  HttpResponse: mt,
  get ImagePromptLanguage() {
    return ci;
  },
  ImportFileOperation: Gn,
  ImportFileResponse: Wd,
  InlinedEmbedContentResponse: zd,
  InlinedResponse: Kd,
  get JobState() {
    return Nn;
  },
  get Language() {
    return Mr;
  },
  ListBatchJobsResponse: Hi,
  ListCachedContentsResponse: Bi,
  ListDocumentsResponse: hl,
  ListFileSearchStoresResponse: pl,
  ListFilesResponse: ml,
  ListModelsResponse: bi,
  ListTuningJobsResponse: Fi,
  Live: Zl,
  LiveClientToolResponse: rf,
  get LiveMusicPlaybackControl() {
    return st;
  },
  LiveMusicServerMessage: Tl,
  LiveSendToolResponseParameters: of,
  LiveServerMessage: El,
  MaskReferenceImage: Zd,
  get MaskReferenceMode() {
    return ui;
  },
  get MediaModality() {
    return Ci;
  },
  get MediaResolution() {
    return Qr;
  },
  get Modality() {
    return an;
  },
  Models: ec,
  get MusicGenerationMode() {
    return Mi;
  },
  Operations: tc,
  get Outcome() {
    return kr;
  },
  get PagedItem() {
    return Oe;
  },
  Pager: Ye,
  get PairwiseChoice() {
    return ni;
  },
  get PartMediaResolutionLevel() {
    return ii;
  },
  get PersonGeneration() {
    return Br;
  },
  get PhishBlockThreshold() {
    return Dr;
  },
  get ProminentPeople() {
    return ai;
  },
  RawReferenceImage: Qd,
  RecontextImageResponse: ul,
  RegisterFilesResponse: vl,
  ReplayResponse: Xd,
  get ResourceScope() {
    return kn;
  },
  get SafetyFilterLevel() {
    return li;
  },
  get Scale() {
    return ki;
  },
  SegmentImageResponse: dl,
  get SegmentMode() {
    return pi;
  },
  Session: jl,
  SingleEmbedContentResponse: Yd,
  get StartSensitivity() {
    return Ii;
  },
  StyleReferenceImage: ef,
  SubjectReferenceImage: tf,
  get SubjectReferenceType() {
    return fi;
  },
  get ThinkingLevel() {
    return qr;
  },
  Tokens: nc,
  get TrafficType() {
    return Xr;
  },
  get TuningJobState() {
    return ei;
  },
  get TuningMethod() {
    return _i;
  },
  get TuningMode() {
    return Zr;
  },
  get TuningTask() {
    return ri;
  },
  get TurnCompleteReason() {
    return Si;
  },
  get TurnCoverage() {
    return Ni;
  },
  get Type() {
    return He;
  },
  UploadToFileSearchStoreOperation: hn,
  UploadToFileSearchStoreResponse: sf,
  UploadToFileSearchStoreResumableResponse: gl,
  UpscaleImageResponse: cl,
  get UrlRetrievalStatus() {
    return Yr;
  },
  get VadSignalType() {
    return Ai;
  },
  get VideoCompressionQuality() {
    return yi;
  },
  get VideoGenerationMaskMode() {
    return mi;
  },
  get VideoGenerationReferenceType() {
    return gi;
  },
  get VoiceActivityType() {
    return wi;
  },
  createFunctionResponsePartFromBase64: Md,
  createFunctionResponsePartFromUri: xd,
  createModelContent: Bd,
  createPartFromBase64: Od,
  createPartFromCodeExecutionResult: Fd,
  createPartFromExecutableCode: Gd,
  createPartFromFunctionCall: bd,
  createPartFromFunctionResponse: Ld,
  createPartFromText: xi,
  createPartFromUri: Ud,
  createUserContent: qd,
  mcpToTool: qm,
  setDefaultBaseUrls: ud
}, Symbol.toStringTag, { value: "Module" }));
export {
  nv as c,
  rv as i
};
