function S(n, e, t, s, r) {
  if (typeof e == "function" ? n !== e || !0 : !e.has(n))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return e.set(n, t), t;
}
function o(n, e, t, s) {
  if (t === "a" && !s)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? n !== e || !s : !e.has(n))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return t === "m" ? s : t === "a" ? s.call(n) : s ? s.value : e.get(n);
}
let Bs = function() {
  const { crypto: n } = globalThis;
  if (n?.randomUUID)
    return Bs = n.randomUUID.bind(n), n.randomUUID();
  const e = new Uint8Array(1), t = n ? () => n.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (s) => (+s ^ t() & 15 >> +s / 4).toString(16));
};
function Rt(n) {
  return typeof n == "object" && n !== null && // Spec-compliant fetch implementations
  ("name" in n && n.name === "AbortError" || // Expo fetch
  "message" in n && String(n.message).includes("FetchRequestCanceledException"));
}
const $t = (n) => {
  if (n instanceof Error)
    return n;
  if (typeof n == "object" && n !== null) {
    try {
      if (Object.prototype.toString.call(n) === "[object Error]") {
        const e = new Error(n.message, n.cause ? { cause: n.cause } : {});
        return n.stack && (e.stack = n.stack), n.cause && !e.cause && (e.cause = n.cause), n.name && (e.name = n.name), e;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(n));
    } catch {
    }
  }
  return new Error(n);
};
class g extends Error {
}
class D extends g {
  constructor(e, t, s, r) {
    super(`${D.makeMessage(e, t, s)}`), this.status = e, this.headers = r, this.requestID = r?.get("x-request-id"), this.error = t;
    const i = t;
    this.code = i?.code, this.param = i?.param, this.type = i?.type;
  }
  static makeMessage(e, t, s) {
    const r = t?.message ? typeof t.message == "string" ? t.message : JSON.stringify(t.message) : t ? JSON.stringify(t) : s;
    return e && r ? `${e} ${r}` : e ? `${e} status code (no body)` : r || "(no status code or body)";
  }
  static generate(e, t, s, r) {
    if (!e || !r)
      return new at({ message: s, cause: $t(t) });
    const i = t?.error;
    return e === 400 ? new Ds(e, i, s, r) : e === 401 ? new Us(e, i, s, r) : e === 403 ? new Ws(e, i, s, r) : e === 404 ? new qs(e, i, s, r) : e === 409 ? new js(e, i, s, r) : e === 422 ? new Hs(e, i, s, r) : e === 429 ? new Js(e, i, s, r) : e >= 500 ? new Xs(e, i, s, r) : new D(e, i, s, r);
  }
}
class K extends D {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class at extends D {
  constructor({ message: e, cause: t }) {
    super(void 0, void 0, e || "Connection error.", void 0), t && (this.cause = t);
  }
}
class Dt extends at {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class Ds extends D {
}
class Us extends D {
}
class Ws extends D {
}
class qs extends D {
}
class js extends D {
}
class Hs extends D {
}
class Js extends D {
}
class Xs extends D {
}
class Ks extends g {
  constructor() {
    super("Could not parse response content as the length limit was reached");
  }
}
class Vs extends g {
  constructor() {
    super("Could not parse response content as the request was rejected by the content filter");
  }
}
class ge extends Error {
  constructor(e) {
    super(e);
  }
}
const br = /^[a-z][a-z0-9+.-]*:/i, Sr = (n) => br.test(n);
let q = (n) => (q = Array.isArray, q(n)), hs = q;
function zs(n) {
  return typeof n != "object" ? {} : n ?? {};
}
function xr(n) {
  if (!n)
    return !0;
  for (const e in n)
    return !1;
  return !0;
}
function Ar(n, e) {
  return Object.prototype.hasOwnProperty.call(n, e);
}
function We(n) {
  return n != null && typeof n == "object" && !Array.isArray(n);
}
const vr = (n, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new g(`${n} must be an integer`);
  if (e < 0)
    throw new g(`${n} must be a positive integer`);
  return e;
}, Rr = (n) => {
  try {
    return JSON.parse(n);
  } catch {
    return;
  }
}, Oe = (n) => new Promise((e) => setTimeout(e, n)), ce = "6.25.0", $r = () => (
  // @ts-ignore
  typeof window < "u" && // @ts-ignore
  typeof window.document < "u" && // @ts-ignore
  typeof navigator < "u"
);
function Cr() {
  return typeof Deno < "u" && Deno.build != null ? "deno" : typeof EdgeRuntime < "u" ? "edge" : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) === "[object process]" ? "node" : "unknown";
}
const Ir = () => {
  const n = Cr();
  if (n === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ce,
      "X-Stainless-OS": fs(Deno.build.os),
      "X-Stainless-Arch": ds(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version == "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ce,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  if (n === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": ce,
      "X-Stainless-OS": fs(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": ds(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  const e = kr();
  return e ? {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": ce,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": `browser:${e.browser}`,
    "X-Stainless-Runtime-Version": e.version
  } : {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": ce,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function kr() {
  if (typeof navigator > "u" || !navigator)
    return null;
  const n = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key: e, pattern: t } of n) {
    const s = t.exec(navigator.userAgent);
    if (s) {
      const r = s[1] || 0, i = s[2] || 0, a = s[3] || 0;
      return { browser: e, version: `${r}.${i}.${a}` };
    }
  }
  return null;
}
const ds = (n) => n === "x32" ? "x32" : n === "x86_64" || n === "x64" ? "x64" : n === "arm" ? "arm" : n === "aarch64" || n === "arm64" ? "arm64" : n ? `other:${n}` : "unknown", fs = (n) => (n = n.toLowerCase(), n.includes("ios") ? "iOS" : n === "android" ? "Android" : n === "darwin" ? "MacOS" : n === "win32" ? "Windows" : n === "freebsd" ? "FreeBSD" : n === "openbsd" ? "OpenBSD" : n === "linux" ? "Linux" : n ? `Other:${n}` : "Unknown");
let ps;
const Er = () => ps ?? (ps = Ir());
function Or() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new OpenAI({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function Qs(...n) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...n);
}
function Gs(n) {
  let e = Symbol.asyncIterator in n ? n[Symbol.asyncIterator]() : n[Symbol.iterator]();
  return Qs({
    start() {
    },
    async pull(t) {
      const { done: s, value: r } = await e.next();
      s ? t.close() : t.enqueue(r);
    },
    async cancel() {
      await e.return?.();
    }
  });
}
function Ys(n) {
  if (n[Symbol.asyncIterator])
    return n;
  const e = n.getReader();
  return {
    async next() {
      try {
        const t = await e.read();
        return t?.done && e.releaseLock(), t;
      } catch (t) {
        throw e.releaseLock(), t;
      }
    },
    async return() {
      const t = e.cancel();
      return e.releaseLock(), await t, { done: !0, value: void 0 };
    },
    [Symbol.asyncIterator]() {
      return this;
    }
  };
}
async function Pr(n) {
  if (n === null || typeof n != "object")
    return;
  if (n[Symbol.asyncIterator]) {
    await n[Symbol.asyncIterator]().return?.();
    return;
  }
  const e = n.getReader(), t = e.cancel();
  e.releaseLock(), await t;
}
const Tr = ({ headers: n, body: e }) => ({
  bodyHeaders: {
    "content-type": "application/json"
  },
  body: JSON.stringify(e)
}), Zs = "RFC3986", en = (n) => String(n), ms = {
  RFC1738: (n) => String(n).replace(/%20/g, "+"),
  RFC3986: en
}, Nr = "RFC1738";
let Ct = (n, e) => (Ct = Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty), Ct(n, e));
const z = /* @__PURE__ */ (() => {
  const n = [];
  for (let e = 0; e < 256; ++e)
    n.push("%" + ((e < 16 ? "0" : "") + e.toString(16)).toUpperCase());
  return n;
})(), yt = 1024, Mr = (n, e, t, s, r) => {
  if (n.length === 0)
    return n;
  let i = n;
  if (typeof n == "symbol" ? i = Symbol.prototype.toString.call(n) : typeof n != "string" && (i = String(n)), t === "iso-8859-1")
    return escape(i).replace(/%u[0-9a-f]{4}/gi, function(l) {
      return "%26%23" + parseInt(l.slice(2), 16) + "%3B";
    });
  let a = "";
  for (let l = 0; l < i.length; l += yt) {
    const h = i.length >= yt ? i.slice(l, l + yt) : i, f = [];
    for (let m = 0; m < h.length; ++m) {
      let d = h.charCodeAt(m);
      if (d === 45 || // -
      d === 46 || // .
      d === 95 || // _
      d === 126 || // ~
      d >= 48 && d <= 57 || // 0-9
      d >= 65 && d <= 90 || // a-z
      d >= 97 && d <= 122 || // A-Z
      r === Nr && (d === 40 || d === 41)) {
        f[f.length] = h.charAt(m);
        continue;
      }
      if (d < 128) {
        f[f.length] = z[d];
        continue;
      }
      if (d < 2048) {
        f[f.length] = z[192 | d >> 6] + z[128 | d & 63];
        continue;
      }
      if (d < 55296 || d >= 57344) {
        f[f.length] = z[224 | d >> 12] + z[128 | d >> 6 & 63] + z[128 | d & 63];
        continue;
      }
      m += 1, d = 65536 + ((d & 1023) << 10 | h.charCodeAt(m) & 1023), f[f.length] = z[240 | d >> 18] + z[128 | d >> 12 & 63] + z[128 | d >> 6 & 63] + z[128 | d & 63];
    }
    a += f.join("");
  }
  return a;
};
function Fr(n) {
  return !n || typeof n != "object" ? !1 : !!(n.constructor && n.constructor.isBuffer && n.constructor.isBuffer(n));
}
function _s(n, e) {
  if (q(n)) {
    const t = [];
    for (let s = 0; s < n.length; s += 1)
      t.push(e(n[s]));
    return t;
  }
  return e(n);
}
const tn = {
  brackets(n) {
    return String(n) + "[]";
  },
  comma: "comma",
  indices(n, e) {
    return String(n) + "[" + e + "]";
  },
  repeat(n) {
    return String(n);
  }
}, sn = function(n, e) {
  Array.prototype.push.apply(n, q(e) ? e : [e]);
};
let gs;
const P = {
  addQueryPrefix: !1,
  allowDots: !1,
  allowEmptyArrays: !1,
  arrayFormat: "indices",
  charset: "utf-8",
  charsetSentinel: !1,
  delimiter: "&",
  encode: !0,
  encodeDotInKeys: !1,
  encoder: Mr,
  encodeValuesOnly: !1,
  format: Zs,
  formatter: en,
  /** @deprecated */
  indices: !1,
  serializeDate(n) {
    return (gs ?? (gs = Function.prototype.call.bind(Date.prototype.toISOString)))(n);
  },
  skipNulls: !1,
  strictNullHandling: !1
};
function Lr(n) {
  return typeof n == "string" || typeof n == "number" || typeof n == "boolean" || typeof n == "symbol" || typeof n == "bigint";
}
const wt = {};
function nn(n, e, t, s, r, i, a, l, h, f, m, d, y, u, A, b, I, v) {
  let w = n, T = v, R = 0, X = !1;
  for (; (T = T.get(wt)) !== void 0 && !X; ) {
    const k = T.get(n);
    if (R += 1, typeof k < "u") {
      if (k === R)
        throw new RangeError("Cyclic object value");
      X = !0;
    }
    typeof T.get(wt) > "u" && (R = 0);
  }
  if (typeof f == "function" ? w = f(e, w) : w instanceof Date ? w = y?.(w) : t === "comma" && q(w) && (w = _s(w, function(k) {
    return k instanceof Date ? y?.(k) : k;
  })), w === null) {
    if (i)
      return h && !b ? (
        // @ts-expect-error
        h(e, P.encoder, I, "key", u)
      ) : e;
    w = "";
  }
  if (Lr(w) || Fr(w)) {
    if (h) {
      const k = b ? e : h(e, P.encoder, I, "key", u);
      return [
        A?.(k) + "=" + // @ts-expect-error
        A?.(h(w, P.encoder, I, "value", u))
      ];
    }
    return [A?.(e) + "=" + A?.(String(w))];
  }
  const U = [];
  if (typeof w > "u")
    return U;
  let C;
  if (t === "comma" && q(w))
    b && h && (w = _s(w, h)), C = [{ value: w.length > 0 ? w.join(",") || null : void 0 }];
  else if (q(f))
    C = f;
  else {
    const k = Object.keys(w);
    C = m ? k.sort(m) : k;
  }
  const F = l ? String(e).replace(/\./g, "%2E") : String(e), N = s && q(w) && w.length === 1 ? F + "[]" : F;
  if (r && q(w) && w.length === 0)
    return N + "[]";
  for (let k = 0; k < C.length; ++k) {
    const E = C[k], cs = (
      // @ts-ignore
      typeof E == "object" && typeof E.value < "u" ? E.value : w[E]
    );
    if (a && cs === null)
      continue;
    const gt = d && l ? E.replace(/\./g, "%2E") : E, wr = q(w) ? typeof t == "function" ? t(N, gt) : N : N + (d ? "." + gt : "[" + gt + "]");
    v.set(n, R);
    const us = /* @__PURE__ */ new WeakMap();
    us.set(wt, v), sn(U, nn(
      cs,
      wr,
      t,
      s,
      r,
      i,
      a,
      l,
      // @ts-ignore
      t === "comma" && b && q(w) ? null : h,
      f,
      m,
      d,
      y,
      u,
      A,
      b,
      I,
      us
    ));
  }
  return U;
}
function Br(n = P) {
  if (typeof n.allowEmptyArrays < "u" && typeof n.allowEmptyArrays != "boolean")
    throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
  if (typeof n.encodeDotInKeys < "u" && typeof n.encodeDotInKeys != "boolean")
    throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
  if (n.encoder !== null && typeof n.encoder < "u" && typeof n.encoder != "function")
    throw new TypeError("Encoder has to be a function.");
  const e = n.charset || P.charset;
  if (typeof n.charset < "u" && n.charset !== "utf-8" && n.charset !== "iso-8859-1")
    throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
  let t = Zs;
  if (typeof n.format < "u") {
    if (!Ct(ms, n.format))
      throw new TypeError("Unknown format option provided.");
    t = n.format;
  }
  const s = ms[t];
  let r = P.filter;
  (typeof n.filter == "function" || q(n.filter)) && (r = n.filter);
  let i;
  if (n.arrayFormat && n.arrayFormat in tn ? i = n.arrayFormat : "indices" in n ? i = n.indices ? "indices" : "repeat" : i = P.arrayFormat, "commaRoundTrip" in n && typeof n.commaRoundTrip != "boolean")
    throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
  const a = typeof n.allowDots > "u" ? n.encodeDotInKeys ? !0 : P.allowDots : !!n.allowDots;
  return {
    addQueryPrefix: typeof n.addQueryPrefix == "boolean" ? n.addQueryPrefix : P.addQueryPrefix,
    // @ts-ignore
    allowDots: a,
    allowEmptyArrays: typeof n.allowEmptyArrays == "boolean" ? !!n.allowEmptyArrays : P.allowEmptyArrays,
    arrayFormat: i,
    charset: e,
    charsetSentinel: typeof n.charsetSentinel == "boolean" ? n.charsetSentinel : P.charsetSentinel,
    commaRoundTrip: !!n.commaRoundTrip,
    delimiter: typeof n.delimiter > "u" ? P.delimiter : n.delimiter,
    encode: typeof n.encode == "boolean" ? n.encode : P.encode,
    encodeDotInKeys: typeof n.encodeDotInKeys == "boolean" ? n.encodeDotInKeys : P.encodeDotInKeys,
    encoder: typeof n.encoder == "function" ? n.encoder : P.encoder,
    encodeValuesOnly: typeof n.encodeValuesOnly == "boolean" ? n.encodeValuesOnly : P.encodeValuesOnly,
    filter: r,
    format: t,
    formatter: s,
    serializeDate: typeof n.serializeDate == "function" ? n.serializeDate : P.serializeDate,
    skipNulls: typeof n.skipNulls == "boolean" ? n.skipNulls : P.skipNulls,
    // @ts-ignore
    sort: typeof n.sort == "function" ? n.sort : null,
    strictNullHandling: typeof n.strictNullHandling == "boolean" ? n.strictNullHandling : P.strictNullHandling
  };
}
function Dr(n, e = {}) {
  let t = n;
  const s = Br(e);
  let r, i;
  typeof s.filter == "function" ? (i = s.filter, t = i("", t)) : q(s.filter) && (i = s.filter, r = i);
  const a = [];
  if (typeof t != "object" || t === null)
    return "";
  const l = tn[s.arrayFormat], h = l === "comma" && s.commaRoundTrip;
  r || (r = Object.keys(t)), s.sort && r.sort(s.sort);
  const f = /* @__PURE__ */ new WeakMap();
  for (let y = 0; y < r.length; ++y) {
    const u = r[y];
    s.skipNulls && t[u] === null || sn(a, nn(
      t[u],
      u,
      // @ts-expect-error
      l,
      h,
      s.allowEmptyArrays,
      s.strictNullHandling,
      s.skipNulls,
      s.encodeDotInKeys,
      s.encode ? s.encoder : null,
      s.filter,
      s.sort,
      s.allowDots,
      s.serializeDate,
      s.format,
      s.formatter,
      s.encodeValuesOnly,
      s.charset,
      f
    ));
  }
  const m = a.join(s.delimiter);
  let d = s.addQueryPrefix === !0 ? "?" : "";
  return s.charsetSentinel && (s.charset === "iso-8859-1" ? d += "utf8=%26%2310003%3B&" : d += "utf8=%E2%9C%93&"), m.length > 0 ? d + m : "";
}
function Ur(n) {
  let e = 0;
  for (const r of n)
    e += r.length;
  const t = new Uint8Array(e);
  let s = 0;
  for (const r of n)
    t.set(r, s), s += r.length;
  return t;
}
let ys;
function Ut(n) {
  let e;
  return (ys ?? (e = new globalThis.TextEncoder(), ys = e.encode.bind(e)))(n);
}
let ws;
function bs(n) {
  let e;
  return (ws ?? (e = new globalThis.TextDecoder(), ws = e.decode.bind(e)))(n);
}
var j, H;
class ot {
  constructor() {
    j.set(this, void 0), H.set(this, void 0), S(this, j, new Uint8Array()), S(this, H, null);
  }
  decode(e) {
    if (e == null)
      return [];
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? Ut(e) : e;
    S(this, j, Ur([o(this, j, "f"), t]));
    const s = [];
    let r;
    for (; (r = Wr(o(this, j, "f"), o(this, H, "f"))) != null; ) {
      if (r.carriage && o(this, H, "f") == null) {
        S(this, H, r.index);
        continue;
      }
      if (o(this, H, "f") != null && (r.index !== o(this, H, "f") + 1 || r.carriage)) {
        s.push(bs(o(this, j, "f").subarray(0, o(this, H, "f") - 1))), S(this, j, o(this, j, "f").subarray(o(this, H, "f"))), S(this, H, null);
        continue;
      }
      const i = o(this, H, "f") !== null ? r.preceding - 1 : r.preceding, a = bs(o(this, j, "f").subarray(0, i));
      s.push(a), S(this, j, o(this, j, "f").subarray(r.index)), S(this, H, null);
    }
    return s;
  }
  flush() {
    return o(this, j, "f").length ? this.decode(`
`) : [];
  }
}
j = /* @__PURE__ */ new WeakMap(), H = /* @__PURE__ */ new WeakMap();
ot.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
ot.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function Wr(n, e) {
  for (let r = e ?? 0; r < n.length; r++) {
    if (n[r] === 10)
      return { preceding: r, index: r + 1, carriage: !1 };
    if (n[r] === 13)
      return { preceding: r, index: r + 1, carriage: !0 };
  }
  return null;
}
function qr(n) {
  for (let s = 0; s < n.length - 1; s++) {
    if (n[s] === 10 && n[s + 1] === 10 || n[s] === 13 && n[s + 1] === 13)
      return s + 2;
    if (n[s] === 13 && n[s + 1] === 10 && s + 3 < n.length && n[s + 2] === 13 && n[s + 3] === 10)
      return s + 4;
  }
  return -1;
}
const Ge = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, Ss = (n, e, t) => {
  if (n) {
    if (Ar(Ge, n))
      return n;
    L(t).warn(`${e} was set to ${JSON.stringify(n)}, expected one of ${JSON.stringify(Object.keys(Ge))}`);
  }
};
function ye() {
}
function Ne(n, e, t) {
  return !e || Ge[n] > Ge[t] ? ye : e[n].bind(e);
}
const jr = {
  error: ye,
  warn: ye,
  info: ye,
  debug: ye
};
let xs = /* @__PURE__ */ new WeakMap();
function L(n) {
  const e = n.logger, t = n.logLevel ?? "off";
  if (!e)
    return jr;
  const s = xs.get(e);
  if (s && s[0] === t)
    return s[1];
  const r = {
    error: Ne("error", e, t),
    warn: Ne("warn", e, t),
    info: Ne("info", e, t),
    debug: Ne("debug", e, t)
  };
  return xs.set(e, [t, r]), r;
}
const ne = (n) => (n.options && (n.options = { ...n.options }, delete n.options.headers), n.headers && (n.headers = Object.fromEntries((n.headers instanceof Headers ? [...n.headers] : Object.entries(n.headers)).map(([e, t]) => [
  e,
  e.toLowerCase() === "authorization" || e.toLowerCase() === "cookie" || e.toLowerCase() === "set-cookie" ? "***" : t
]))), "retryOfRequestLogID" in n && (n.retryOfRequestLogID && (n.retryOf = n.retryOfRequestLogID), delete n.retryOfRequestLogID), n);
var _e;
class G {
  constructor(e, t, s) {
    this.iterator = e, _e.set(this, void 0), this.controller = t, S(this, _e, s);
  }
  static fromSSEResponse(e, t, s, r) {
    let i = !1;
    const a = s ? L(s) : console;
    async function* l() {
      if (i)
        throw new g("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      i = !0;
      let h = !1;
      try {
        for await (const f of Hr(e, t))
          if (!h) {
            if (f.data.startsWith("[DONE]")) {
              h = !0;
              continue;
            }
            if (f.event === null || !f.event.startsWith("thread.")) {
              let m;
              try {
                m = JSON.parse(f.data);
              } catch (d) {
                throw a.error("Could not parse message into JSON:", f.data), a.error("From chunk:", f.raw), d;
              }
              if (m && m.error)
                throw new D(void 0, m.error, void 0, e.headers);
              yield r ? { event: f.event, data: m } : m;
            } else {
              let m;
              try {
                m = JSON.parse(f.data);
              } catch (d) {
                throw console.error("Could not parse message into JSON:", f.data), console.error("From chunk:", f.raw), d;
              }
              if (f.event == "error")
                throw new D(void 0, m.error, m.message, void 0);
              yield { event: f.event, data: m };
            }
          }
        h = !0;
      } catch (f) {
        if (Rt(f))
          return;
        throw f;
      } finally {
        h || t.abort();
      }
    }
    return new G(l, t, s);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(e, t, s) {
    let r = !1;
    async function* i() {
      const l = new ot(), h = Ys(e);
      for await (const f of h)
        for (const m of l.decode(f))
          yield m;
      for (const f of l.flush())
        yield f;
    }
    async function* a() {
      if (r)
        throw new g("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      r = !0;
      let l = !1;
      try {
        for await (const h of i())
          l || h && (yield JSON.parse(h));
        l = !0;
      } catch (h) {
        if (Rt(h))
          return;
        throw h;
      } finally {
        l || t.abort();
      }
    }
    return new G(a, t, s);
  }
  [(_e = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const e = [], t = [], s = this.iterator(), r = (i) => ({
      next: () => {
        if (i.length === 0) {
          const a = s.next();
          e.push(a), t.push(a);
        }
        return i.shift();
      }
    });
    return [
      new G(() => r(e), this.controller, o(this, _e, "f")),
      new G(() => r(t), this.controller, o(this, _e, "f"))
    ];
  }
  /**
   * Converts this stream to a newline-separated ReadableStream of
   * JSON stringified values in the stream
   * which can be turned back into a Stream with `Stream.fromReadableStream()`.
   */
  toReadableStream() {
    const e = this;
    let t;
    return Qs({
      async start() {
        t = e[Symbol.asyncIterator]();
      },
      async pull(s) {
        try {
          const { value: r, done: i } = await t.next();
          if (i)
            return s.close();
          const a = Ut(JSON.stringify(r) + `
`);
          s.enqueue(a);
        } catch (r) {
          s.error(r);
        }
      },
      async cancel() {
        await t.return?.();
      }
    });
  }
}
async function* Hr(n, e) {
  if (!n.body)
    throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new g("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new g("Attempted to iterate over a response with no body");
  const t = new Xr(), s = new ot(), r = Ys(n.body);
  for await (const i of Jr(r))
    for (const a of s.decode(i)) {
      const l = t.decode(a);
      l && (yield l);
    }
  for (const i of s.flush()) {
    const a = t.decode(i);
    a && (yield a);
  }
}
async function* Jr(n) {
  let e = new Uint8Array();
  for await (const t of n) {
    if (t == null)
      continue;
    const s = t instanceof ArrayBuffer ? new Uint8Array(t) : typeof t == "string" ? Ut(t) : t;
    let r = new Uint8Array(e.length + s.length);
    r.set(e), r.set(s, e.length), e = r;
    let i;
    for (; (i = qr(e)) !== -1; )
      yield e.slice(0, i), e = e.slice(i);
  }
  e.length > 0 && (yield e);
}
class Xr {
  constructor() {
    this.event = null, this.data = [], this.chunks = [];
  }
  decode(e) {
    if (e.endsWith("\r") && (e = e.substring(0, e.length - 1)), !e) {
      if (!this.event && !this.data.length)
        return null;
      const i = {
        event: this.event,
        data: this.data.join(`
`),
        raw: this.chunks
      };
      return this.event = null, this.data = [], this.chunks = [], i;
    }
    if (this.chunks.push(e), e.startsWith(":"))
      return null;
    let [t, s, r] = Kr(e, ":");
    return r.startsWith(" ") && (r = r.substring(1)), t === "event" ? this.event = r : t === "data" && this.data.push(r), null;
  }
}
function Kr(n, e) {
  const t = n.indexOf(e);
  return t !== -1 ? [n.substring(0, t), e, n.substring(t + e.length)] : [n, "", ""];
}
async function rn(n, e) {
  const { response: t, requestLogID: s, retryOfRequestLogID: r, startTime: i } = e, a = await (async () => {
    if (e.options.stream)
      return L(n).debug("response", t.status, t.url, t.headers, t.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(t, e.controller, n, e.options.__synthesizeEventData) : G.fromSSEResponse(t, e.controller, n, e.options.__synthesizeEventData);
    if (t.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return t;
    const h = t.headers.get("content-type")?.split(";")[0]?.trim();
    if (h?.includes("application/json") || h?.endsWith("+json")) {
      if (t.headers.get("content-length") === "0")
        return;
      const y = await t.json();
      return an(y, t);
    }
    return await t.text();
  })();
  return L(n).debug(`[${s}] response parsed`, ne({
    retryOfRequestLogID: r,
    url: t.url,
    status: t.status,
    body: a,
    durationMs: Date.now() - i
  })), a;
}
function an(n, e) {
  return !n || typeof n != "object" || Array.isArray(n) ? n : Object.defineProperty(n, "_request_id", {
    value: e.headers.get("x-request-id"),
    enumerable: !1
  });
}
var we;
class lt extends Promise {
  constructor(e, t, s = rn) {
    super((r) => {
      r(null);
    }), this.responsePromise = t, this.parseResponse = s, we.set(this, void 0), S(this, we, e);
  }
  _thenUnwrap(e) {
    return new lt(o(this, we, "f"), this.responsePromise, async (t, s) => an(e(await this.parseResponse(t, s), s), s.response));
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
   * Gets the parsed response data, the raw `Response` instance and the ID of the request,
   * returned via the X-Request-ID header which is useful for debugging requests and reporting
   * issues to OpenAI.
   *
   * If you just want to get the raw `Response` instance without parsing it,
   * you can use {@link asResponse()}.
   *
   * 👋 Getting the wrong TypeScript type for `Response`?
   * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
   * to your `tsconfig.json`.
   */
  async withResponse() {
    const [e, t] = await Promise.all([this.parse(), this.asResponse()]);
    return { data: e, response: t, request_id: t.headers.get("x-request-id") };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((e) => this.parseResponse(o(this, we, "f"), e))), this.parsedPromise;
  }
  then(e, t) {
    return this.parse().then(e, t);
  }
  catch(e) {
    return this.parse().catch(e);
  }
  finally(e) {
    return this.parse().finally(e);
  }
}
we = /* @__PURE__ */ new WeakMap();
var Me;
class Wt {
  constructor(e, t, s, r) {
    Me.set(this, void 0), S(this, Me, e), this.options = r, this.response = t, this.body = s;
  }
  hasNextPage() {
    return this.getPaginatedItems().length ? this.nextPageRequestOptions() != null : !1;
  }
  async getNextPage() {
    const e = this.nextPageRequestOptions();
    if (!e)
      throw new g("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    return await o(this, Me, "f").requestAPIList(this.constructor, e);
  }
  async *iterPages() {
    let e = this;
    for (yield e; e.hasNextPage(); )
      e = await e.getNextPage(), yield e;
  }
  async *[(Me = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    for await (const e of this.iterPages())
      for (const t of e.getPaginatedItems())
        yield t;
  }
}
class Vr extends lt {
  constructor(e, t, s) {
    super(e, t, async (r, i) => new s(r, i.response, await rn(r, i), i.options));
  }
  /**
   * Allow auto-paginating iteration on an unawaited list call, eg:
   *
   *    for await (const item of client.items.list()) {
   *      console.log(item)
   *    }
   */
  async *[Symbol.asyncIterator]() {
    const e = await this;
    for await (const t of e)
      yield t;
  }
}
class ct extends Wt {
  constructor(e, t, s, r) {
    super(e, t, s, r), this.data = s.data || [], this.object = s.object;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  nextPageRequestOptions() {
    return null;
  }
}
class $ extends Wt {
  constructor(e, t, s, r) {
    super(e, t, s, r), this.data = s.data || [], this.has_more = s.has_more || !1;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    return this.has_more === !1 ? !1 : super.hasNextPage();
  }
  nextPageRequestOptions() {
    const e = this.getPaginatedItems(), t = e[e.length - 1]?.id;
    return t ? {
      ...this.options,
      query: {
        ...zs(this.options.query),
        after: t
      }
    } : null;
  }
}
class Ye extends Wt {
  constructor(e, t, s, r) {
    super(e, t, s, r), this.data = s.data || [], this.has_more = s.has_more || !1, this.last_id = s.last_id || "";
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    return this.has_more === !1 ? !1 : super.hasNextPage();
  }
  nextPageRequestOptions() {
    const e = this.last_id;
    return e ? {
      ...this.options,
      query: {
        ...zs(this.options.query),
        after: e
      }
    } : null;
  }
}
const on = () => {
  if (typeof File > "u") {
    const { process: n } = globalThis, e = typeof n?.versions?.node == "string" && parseInt(n.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (e ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function $e(n, e, t) {
  return on(), new File(n, e ?? "unknown_file", t);
}
function qe(n) {
  return (typeof n == "object" && n !== null && ("name" in n && n.name && String(n.name) || "url" in n && n.url && String(n.url) || "filename" in n && n.filename && String(n.filename) || "path" in n && n.path && String(n.path)) || "").split(/[\\/]/).pop() || void 0;
}
const qt = (n) => n != null && typeof n == "object" && typeof n[Symbol.asyncIterator] == "function", ke = async (n, e) => It(n.body) ? { ...n, body: await ln(n.body, e) } : n, fe = async (n, e) => ({ ...n, body: await ln(n.body, e) }), As = /* @__PURE__ */ new WeakMap();
function zr(n) {
  const e = typeof n == "function" ? n : n.fetch, t = As.get(e);
  if (t)
    return t;
  const s = (async () => {
    try {
      const r = "Response" in e ? e.Response : (await e("data:,")).constructor, i = new FormData();
      return i.toString() !== await new r(i).text();
    } catch {
      return !0;
    }
  })();
  return As.set(e, s), s;
}
const ln = async (n, e) => {
  if (!await zr(e))
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  const t = new FormData();
  return await Promise.all(Object.entries(n || {}).map(([s, r]) => kt(t, s, r))), t;
}, cn = (n) => n instanceof Blob && "name" in n, Qr = (n) => typeof n == "object" && n !== null && (n instanceof Response || qt(n) || cn(n)), It = (n) => {
  if (Qr(n))
    return !0;
  if (Array.isArray(n))
    return n.some(It);
  if (n && typeof n == "object") {
    for (const e in n)
      if (It(n[e]))
        return !0;
  }
  return !1;
}, kt = async (n, e, t) => {
  if (t !== void 0) {
    if (t == null)
      throw new TypeError(`Received null for "${e}"; to pass null in FormData, you must use the string 'null'`);
    if (typeof t == "string" || typeof t == "number" || typeof t == "boolean")
      n.append(e, String(t));
    else if (t instanceof Response)
      n.append(e, $e([await t.blob()], qe(t)));
    else if (qt(t))
      n.append(e, $e([await new Response(Gs(t)).blob()], qe(t)));
    else if (cn(t))
      n.append(e, t, qe(t));
    else if (Array.isArray(t))
      await Promise.all(t.map((s) => kt(n, e + "[]", s)));
    else if (typeof t == "object")
      await Promise.all(Object.entries(t).map(([s, r]) => kt(n, `${e}[${s}]`, r)));
    else
      throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${t} instead`);
  }
}, un = (n) => n != null && typeof n == "object" && typeof n.size == "number" && typeof n.type == "string" && typeof n.text == "function" && typeof n.slice == "function" && typeof n.arrayBuffer == "function", Gr = (n) => n != null && typeof n == "object" && typeof n.name == "string" && typeof n.lastModified == "number" && un(n), Yr = (n) => n != null && typeof n == "object" && typeof n.url == "string" && typeof n.blob == "function";
async function Zr(n, e, t) {
  if (on(), n = await n, Gr(n))
    return n instanceof File ? n : $e([await n.arrayBuffer()], n.name);
  if (Yr(n)) {
    const r = await n.blob();
    return e || (e = new URL(n.url).pathname.split(/[\\/]/).pop()), $e(await Et(r), e, t);
  }
  const s = await Et(n);
  if (e || (e = qe(n)), !t?.type) {
    const r = s.find((i) => typeof i == "object" && "type" in i && i.type);
    typeof r == "string" && (t = { ...t, type: r });
  }
  return $e(s, e, t);
}
async function Et(n) {
  let e = [];
  if (typeof n == "string" || ArrayBuffer.isView(n) || // includes Uint8Array, Buffer, etc.
  n instanceof ArrayBuffer)
    e.push(n);
  else if (un(n))
    e.push(n instanceof Blob ? n : await n.arrayBuffer());
  else if (qt(n))
    for await (const t of n)
      e.push(...await Et(t));
  else {
    const t = n?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof n}${t ? `; constructor: ${t}` : ""}${ei(n)}`);
  }
  return e;
}
function ei(n) {
  return typeof n != "object" || n === null ? "" : `; props: [${Object.getOwnPropertyNames(n).map((t) => `"${t}"`).join(", ")}]`;
}
class _ {
  constructor(e) {
    this._client = e;
  }
}
function hn(n) {
  return n.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const vs = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), ti = (n = hn) => function(t, ...s) {
  if (t.length === 1)
    return t[0];
  let r = !1;
  const i = [], a = t.reduce((m, d, y) => {
    /[?#]/.test(d) && (r = !0);
    const u = s[y];
    let A = (r ? encodeURIComponent : n)("" + u);
    return y !== s.length && (u == null || typeof u == "object" && // handle values from other realms
    u.toString === Object.getPrototypeOf(Object.getPrototypeOf(u.hasOwnProperty ?? vs) ?? vs)?.toString) && (A = u + "", i.push({
      start: m.length + d.length,
      length: A.length,
      error: `Value of type ${Object.prototype.toString.call(u).slice(8, -1)} is not a valid path parameter`
    })), m + d + (y === s.length ? "" : A);
  }, ""), l = a.split(/[?#]/, 1)[0], h = new RegExp("(?<=^|\\/)(?:\\.|%2e){1,2}(?=\\/|$)", "gi");
  let f;
  for (; (f = h.exec(l)) !== null; )
    i.push({
      start: f.index,
      length: f[0].length,
      error: `Value "${f[0]}" can't be safely passed as a path parameter`
    });
  if (i.sort((m, d) => m.start - d.start), i.length > 0) {
    let m = 0;
    const d = i.reduce((y, u) => {
      const A = " ".repeat(u.start - m), b = "^".repeat(u.length);
      return m = u.start + u.length, y + A + b;
    }, "");
    throw new g(`Path parameters result in path with invalid segments:
${i.map((y) => y.error).join(`
`)}
${a}
${d}`);
  }
  return a;
}, c = /* @__PURE__ */ ti(hn);
let dn = class extends _ {
  /**
   * Get the messages in a stored chat completion. Only Chat Completions that have
   * been created with the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletionStoreMessage of client.chat.completions.messages.list(
   *   'completion_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/chat/completions/${e}/messages`, $, { query: t, ...s });
  }
};
function Ze(n) {
  return n !== void 0 && "function" in n && n.function !== void 0;
}
function jt(n) {
  return n?.$brand === "auto-parseable-response-format";
}
function Pe(n) {
  return n?.$brand === "auto-parseable-tool";
}
function si(n, e) {
  return !e || !fn(e) ? {
    ...n,
    choices: n.choices.map((t) => (pn(t.message.tool_calls), {
      ...t,
      message: {
        ...t.message,
        parsed: null,
        ...t.message.tool_calls ? {
          tool_calls: t.message.tool_calls
        } : void 0
      }
    }))
  } : Ht(n, e);
}
function Ht(n, e) {
  const t = n.choices.map((s) => {
    if (s.finish_reason === "length")
      throw new Ks();
    if (s.finish_reason === "content_filter")
      throw new Vs();
    return pn(s.message.tool_calls), {
      ...s,
      message: {
        ...s.message,
        ...s.message.tool_calls ? {
          tool_calls: s.message.tool_calls?.map((r) => ri(e, r)) ?? void 0
        } : void 0,
        parsed: s.message.content && !s.message.refusal ? ni(e, s.message.content) : null
      }
    };
  });
  return { ...n, choices: t };
}
function ni(n, e) {
  return n.response_format?.type !== "json_schema" ? null : n.response_format?.type === "json_schema" ? "$parseRaw" in n.response_format ? n.response_format.$parseRaw(e) : JSON.parse(e) : null;
}
function ri(n, e) {
  const t = n.tools?.find((s) => Ze(s) && s.function?.name === e.function.name);
  return {
    ...e,
    function: {
      ...e.function,
      parsed_arguments: Pe(t) ? t.$parseRaw(e.function.arguments) : t?.function.strict ? JSON.parse(e.function.arguments) : null
    }
  };
}
function ii(n, e) {
  if (!n || !("tools" in n) || !n.tools)
    return !1;
  const t = n.tools?.find((s) => Ze(s) && s.function?.name === e.function.name);
  return Ze(t) && (Pe(t) || t?.function.strict || !1);
}
function fn(n) {
  return jt(n.response_format) ? !0 : n.tools?.some((e) => Pe(e) || e.type === "function" && e.function.strict === !0) ?? !1;
}
function pn(n) {
  for (const e of n || [])
    if (e.type !== "function")
      throw new g(`Currently only \`function\` tool calls are supported; Received \`${e.type}\``);
}
function ai(n) {
  for (const e of n ?? []) {
    if (e.type !== "function")
      throw new g(`Currently only \`function\` tool types support auto-parsing; Received \`${e.type}\``);
    if (e.function.strict !== !0)
      throw new g(`The \`${e.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
  }
}
const et = (n) => n?.role === "assistant", mn = (n) => n?.role === "tool";
var Ot, je, He, be, Se, Je, xe, Z, Ae, tt, st, ue, _n;
class Jt {
  constructor() {
    Ot.add(this), this.controller = new AbortController(), je.set(this, void 0), He.set(this, () => {
    }), be.set(this, () => {
    }), Se.set(this, void 0), Je.set(this, () => {
    }), xe.set(this, () => {
    }), Z.set(this, {}), Ae.set(this, !1), tt.set(this, !1), st.set(this, !1), ue.set(this, !1), S(this, je, new Promise((e, t) => {
      S(this, He, e, "f"), S(this, be, t, "f");
    })), S(this, Se, new Promise((e, t) => {
      S(this, Je, e, "f"), S(this, xe, t, "f");
    })), o(this, je, "f").catch(() => {
    }), o(this, Se, "f").catch(() => {
    });
  }
  _run(e) {
    setTimeout(() => {
      e().then(() => {
        this._emitFinal(), this._emit("end");
      }, o(this, Ot, "m", _n).bind(this));
    }, 0);
  }
  _connected() {
    this.ended || (o(this, He, "f").call(this), this._emit("connect"));
  }
  get ended() {
    return o(this, Ae, "f");
  }
  get errored() {
    return o(this, tt, "f");
  }
  get aborted() {
    return o(this, st, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  on(e, t) {
    return (o(this, Z, "f")[e] || (o(this, Z, "f")[e] = [])).push({ listener: t }), this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  off(e, t) {
    const s = o(this, Z, "f")[e];
    if (!s)
      return this;
    const r = s.findIndex((i) => i.listener === t);
    return r >= 0 && s.splice(r, 1), this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this ChatCompletionStream, so that calls can be chained
   */
  once(e, t) {
    return (o(this, Z, "f")[e] || (o(this, Z, "f")[e] = [])).push({ listener: t, once: !0 }), this;
  }
  /**
   * This is similar to `.once()`, but returns a Promise that resolves the next time
   * the event is triggered, instead of calling a listener callback.
   * @returns a Promise that resolves the next time given event is triggered,
   * or rejects if an error is emitted.  (If you request the 'error' event,
   * returns a promise that resolves with the error).
   *
   * Example:
   *
   *   const message = await stream.emitted('message') // rejects if the stream errors
   */
  emitted(e) {
    return new Promise((t, s) => {
      S(this, ue, !0), e !== "error" && this.once("error", s), this.once(e, t);
    });
  }
  async done() {
    S(this, ue, !0), await o(this, Se, "f");
  }
  _emit(e, ...t) {
    if (o(this, Ae, "f"))
      return;
    e === "end" && (S(this, Ae, !0), o(this, Je, "f").call(this));
    const s = o(this, Z, "f")[e];
    if (s && (o(this, Z, "f")[e] = s.filter((r) => !r.once), s.forEach(({ listener: r }) => r(...t))), e === "abort") {
      const r = t[0];
      !o(this, ue, "f") && !s?.length && Promise.reject(r), o(this, be, "f").call(this, r), o(this, xe, "f").call(this, r), this._emit("end");
      return;
    }
    if (e === "error") {
      const r = t[0];
      !o(this, ue, "f") && !s?.length && Promise.reject(r), o(this, be, "f").call(this, r), o(this, xe, "f").call(this, r), this._emit("end");
    }
  }
  _emitFinal() {
  }
}
je = /* @__PURE__ */ new WeakMap(), He = /* @__PURE__ */ new WeakMap(), be = /* @__PURE__ */ new WeakMap(), Se = /* @__PURE__ */ new WeakMap(), Je = /* @__PURE__ */ new WeakMap(), xe = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), Ae = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ new WeakMap(), st = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakMap(), Ot = /* @__PURE__ */ new WeakSet(), _n = function(e) {
  if (S(this, tt, !0), e instanceof Error && e.name === "AbortError" && (e = new K()), e instanceof K)
    return S(this, st, !0), this._emit("abort", e);
  if (e instanceof g)
    return this._emit("error", e);
  if (e instanceof Error) {
    const t = new g(e.message);
    return t.cause = e, this._emit("error", t);
  }
  return this._emit("error", new g(String(e)));
};
function oi(n) {
  return typeof n.parse == "function";
}
var W, Pt, nt, Tt, Nt, Mt, gn, yn;
const li = 10;
class wn extends Jt {
  constructor() {
    super(...arguments), W.add(this), this._chatCompletions = [], this.messages = [];
  }
  _addChatCompletion(e) {
    this._chatCompletions.push(e), this._emit("chatCompletion", e);
    const t = e.choices[0]?.message;
    return t && this._addMessage(t), e;
  }
  _addMessage(e, t = !0) {
    if ("content" in e || (e.content = null), this.messages.push(e), t) {
      if (this._emit("message", e), mn(e) && e.content)
        this._emit("functionToolCallResult", e.content);
      else if (et(e) && e.tool_calls)
        for (const s of e.tool_calls)
          s.type === "function" && this._emit("functionToolCall", s.function);
    }
  }
  /**
   * @returns a promise that resolves with the final ChatCompletion, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
   */
  async finalChatCompletion() {
    await this.done();
    const e = this._chatCompletions[this._chatCompletions.length - 1];
    if (!e)
      throw new g("stream ended without producing a ChatCompletion");
    return e;
  }
  /**
   * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalContent() {
    return await this.done(), o(this, W, "m", Pt).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
   * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalMessage() {
    return await this.done(), o(this, W, "m", nt).call(this);
  }
  /**
   * @returns a promise that resolves with the content of the final FunctionCall, or rejects
   * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
   */
  async finalFunctionToolCall() {
    return await this.done(), o(this, W, "m", Tt).call(this);
  }
  async finalFunctionToolCallResult() {
    return await this.done(), o(this, W, "m", Nt).call(this);
  }
  async totalUsage() {
    return await this.done(), o(this, W, "m", Mt).call(this);
  }
  allChatCompletions() {
    return [...this._chatCompletions];
  }
  _emitFinal() {
    const e = this._chatCompletions[this._chatCompletions.length - 1];
    e && this._emit("finalChatCompletion", e);
    const t = o(this, W, "m", nt).call(this);
    t && this._emit("finalMessage", t);
    const s = o(this, W, "m", Pt).call(this);
    s && this._emit("finalContent", s);
    const r = o(this, W, "m", Tt).call(this);
    r && this._emit("finalFunctionToolCall", r);
    const i = o(this, W, "m", Nt).call(this);
    i != null && this._emit("finalFunctionToolCallResult", i), this._chatCompletions.some((a) => a.usage) && this._emit("totalUsage", o(this, W, "m", Mt).call(this));
  }
  async _createChatCompletion(e, t, s) {
    const r = s?.signal;
    r && (r.aborted && this.controller.abort(), r.addEventListener("abort", () => this.controller.abort())), o(this, W, "m", gn).call(this, t);
    const i = await e.chat.completions.create({ ...t, stream: !1 }, { ...s, signal: this.controller.signal });
    return this._connected(), this._addChatCompletion(Ht(i, t));
  }
  async _runChatCompletion(e, t, s) {
    for (const r of t.messages)
      this._addMessage(r, !1);
    return await this._createChatCompletion(e, t, s);
  }
  async _runTools(e, t, s) {
    const r = "tool", { tool_choice: i = "auto", stream: a, ...l } = t, h = typeof i != "string" && i.type === "function" && i?.function?.name, { maxChatCompletions: f = li } = s || {}, m = t.tools.map((u) => {
      if (Pe(u)) {
        if (!u.$callback)
          throw new g("Tool given to `.runTools()` that does not have an associated function");
        return {
          type: "function",
          function: {
            function: u.$callback,
            name: u.function.name,
            description: u.function.description || "",
            parameters: u.function.parameters,
            parse: u.$parseRaw,
            strict: !0
          }
        };
      }
      return u;
    }), d = {};
    for (const u of m)
      u.type === "function" && (d[u.function.name || u.function.function.name] = u.function);
    const y = "tools" in t ? m.map((u) => u.type === "function" ? {
      type: "function",
      function: {
        name: u.function.name || u.function.function.name,
        parameters: u.function.parameters,
        description: u.function.description,
        strict: u.function.strict
      }
    } : u) : void 0;
    for (const u of t.messages)
      this._addMessage(u, !1);
    for (let u = 0; u < f; ++u) {
      const b = (await this._createChatCompletion(e, {
        ...l,
        tool_choice: i,
        tools: y,
        messages: [...this.messages]
      }, s)).choices[0]?.message;
      if (!b)
        throw new g("missing message in ChatCompletion response");
      if (!b.tool_calls?.length)
        return;
      for (const I of b.tool_calls) {
        if (I.type !== "function")
          continue;
        const v = I.id, { name: w, arguments: T } = I.function, R = d[w];
        if (R) {
          if (h && h !== w) {
            const F = `Invalid tool_call: ${JSON.stringify(w)}. ${JSON.stringify(h)} requested. Please try again`;
            this._addMessage({ role: r, tool_call_id: v, content: F });
            continue;
          }
        } else {
          const F = `Invalid tool_call: ${JSON.stringify(w)}. Available options are: ${Object.keys(d).map((N) => JSON.stringify(N)).join(", ")}. Please try again`;
          this._addMessage({ role: r, tool_call_id: v, content: F });
          continue;
        }
        let X;
        try {
          X = oi(R) ? await R.parse(T) : T;
        } catch (F) {
          const N = F instanceof Error ? F.message : String(F);
          this._addMessage({ role: r, tool_call_id: v, content: N });
          continue;
        }
        const U = await R.function(X, this), C = o(this, W, "m", yn).call(this, U);
        if (this._addMessage({ role: r, tool_call_id: v, content: C }), h)
          return;
      }
    }
  }
}
W = /* @__PURE__ */ new WeakSet(), Pt = function() {
  return o(this, W, "m", nt).call(this).content ?? null;
}, nt = function() {
  let e = this.messages.length;
  for (; e-- > 0; ) {
    const t = this.messages[e];
    if (et(t))
      return {
        ...t,
        content: t.content ?? null,
        refusal: t.refusal ?? null
      };
  }
  throw new g("stream ended without producing a ChatCompletionMessage with role=assistant");
}, Tt = function() {
  for (let e = this.messages.length - 1; e >= 0; e--) {
    const t = this.messages[e];
    if (et(t) && t?.tool_calls?.length)
      return t.tool_calls.filter((s) => s.type === "function").at(-1)?.function;
  }
}, Nt = function() {
  for (let e = this.messages.length - 1; e >= 0; e--) {
    const t = this.messages[e];
    if (mn(t) && t.content != null && typeof t.content == "string" && this.messages.some((s) => s.role === "assistant" && s.tool_calls?.some((r) => r.type === "function" && r.id === t.tool_call_id)))
      return t.content;
  }
}, Mt = function() {
  const e = {
    completion_tokens: 0,
    prompt_tokens: 0,
    total_tokens: 0
  };
  for (const { usage: t } of this._chatCompletions)
    t && (e.completion_tokens += t.completion_tokens, e.prompt_tokens += t.prompt_tokens, e.total_tokens += t.total_tokens);
  return e;
}, gn = function(e) {
  if (e.n != null && e.n > 1)
    throw new g("ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.");
}, yn = function(e) {
  return typeof e == "string" ? e : e === void 0 ? "undefined" : JSON.stringify(e);
};
class Xt extends wn {
  static runTools(e, t, s) {
    const r = new Xt(), i = {
      ...s,
      headers: { ...s?.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    return r._run(() => r._runTools(e, t, i)), r;
  }
  _addMessage(e, t = !0) {
    super._addMessage(e, t), et(e) && e.content && this._emit("content", e.content);
  }
}
const bn = 1, Sn = 2, xn = 4, An = 8, vn = 16, Rn = 32, $n = 64, Cn = 128, In = 256, kn = Cn | In, En = vn | Rn | kn | $n, On = bn | Sn | En, Pn = xn | An, ci = On | Pn, M = {
  STR: bn,
  NUM: Sn,
  ARR: xn,
  OBJ: An,
  NULL: vn,
  BOOL: Rn,
  NAN: $n,
  INFINITY: Cn,
  MINUS_INFINITY: In,
  INF: kn,
  SPECIAL: En,
  ATOM: On,
  COLLECTION: Pn,
  ALL: ci
};
class ui extends Error {
}
class hi extends Error {
}
function di(n, e = M.ALL) {
  if (typeof n != "string")
    throw new TypeError(`expecting str, got ${typeof n}`);
  if (!n.trim())
    throw new Error(`${n} is empty`);
  return fi(n.trim(), e);
}
const fi = (n, e) => {
  const t = n.length;
  let s = 0;
  const r = (y) => {
    throw new ui(`${y} at position ${s}`);
  }, i = (y) => {
    throw new hi(`${y} at position ${s}`);
  }, a = () => (d(), s >= t && r("Unexpected end of input"), n[s] === '"' ? l() : n[s] === "{" ? h() : n[s] === "[" ? f() : n.substring(s, s + 4) === "null" || M.NULL & e && t - s < 4 && "null".startsWith(n.substring(s)) ? (s += 4, null) : n.substring(s, s + 4) === "true" || M.BOOL & e && t - s < 4 && "true".startsWith(n.substring(s)) ? (s += 4, !0) : n.substring(s, s + 5) === "false" || M.BOOL & e && t - s < 5 && "false".startsWith(n.substring(s)) ? (s += 5, !1) : n.substring(s, s + 8) === "Infinity" || M.INFINITY & e && t - s < 8 && "Infinity".startsWith(n.substring(s)) ? (s += 8, 1 / 0) : n.substring(s, s + 9) === "-Infinity" || M.MINUS_INFINITY & e && 1 < t - s && t - s < 9 && "-Infinity".startsWith(n.substring(s)) ? (s += 9, -1 / 0) : n.substring(s, s + 3) === "NaN" || M.NAN & e && t - s < 3 && "NaN".startsWith(n.substring(s)) ? (s += 3, NaN) : m()), l = () => {
    const y = s;
    let u = !1;
    for (s++; s < t && (n[s] !== '"' || u && n[s - 1] === "\\"); )
      u = n[s] === "\\" ? !u : !1, s++;
    if (n.charAt(s) == '"')
      try {
        return JSON.parse(n.substring(y, ++s - Number(u)));
      } catch (A) {
        i(String(A));
      }
    else if (M.STR & e)
      try {
        return JSON.parse(n.substring(y, s - Number(u)) + '"');
      } catch {
        return JSON.parse(n.substring(y, n.lastIndexOf("\\")) + '"');
      }
    r("Unterminated string literal");
  }, h = () => {
    s++, d();
    const y = {};
    try {
      for (; n[s] !== "}"; ) {
        if (d(), s >= t && M.OBJ & e)
          return y;
        const u = l();
        d(), s++;
        try {
          const A = a();
          Object.defineProperty(y, u, { value: A, writable: !0, enumerable: !0, configurable: !0 });
        } catch (A) {
          if (M.OBJ & e)
            return y;
          throw A;
        }
        d(), n[s] === "," && s++;
      }
    } catch {
      if (M.OBJ & e)
        return y;
      r("Expected '}' at end of object");
    }
    return s++, y;
  }, f = () => {
    s++;
    const y = [];
    try {
      for (; n[s] !== "]"; )
        y.push(a()), d(), n[s] === "," && s++;
    } catch {
      if (M.ARR & e)
        return y;
      r("Expected ']' at end of array");
    }
    return s++, y;
  }, m = () => {
    if (s === 0) {
      n === "-" && M.NUM & e && r("Not sure what '-' is");
      try {
        return JSON.parse(n);
      } catch (u) {
        if (M.NUM & e)
          try {
            return n[n.length - 1] === "." ? JSON.parse(n.substring(0, n.lastIndexOf("."))) : JSON.parse(n.substring(0, n.lastIndexOf("e")));
          } catch {
          }
        i(String(u));
      }
    }
    const y = s;
    for (n[s] === "-" && s++; n[s] && !",]}".includes(n[s]); )
      s++;
    s == t && !(M.NUM & e) && r("Unterminated number literal");
    try {
      return JSON.parse(n.substring(y, s));
    } catch {
      n.substring(y, s) === "-" && M.NUM & e && r("Not sure what '-' is");
      try {
        return JSON.parse(n.substring(y, n.lastIndexOf("e")));
      } catch (A) {
        i(String(A));
      }
    }
  }, d = () => {
    for (; s < t && ` 
\r	`.includes(n[s]); )
      s++;
  };
  return a();
}, Rs = (n) => di(n, M.ALL ^ M.NUM);
var O, Y, oe, te, bt, Fe, St, xt, At, Le, vt, $s;
class Ee extends wn {
  constructor(e) {
    super(), O.add(this), Y.set(this, void 0), oe.set(this, void 0), te.set(this, void 0), S(this, Y, e), S(this, oe, []);
  }
  get currentChatCompletionSnapshot() {
    return o(this, te, "f");
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(e) {
    const t = new Ee(null);
    return t._run(() => t._fromReadableStream(e)), t;
  }
  static createChatCompletion(e, t, s) {
    const r = new Ee(t);
    return r._run(() => r._runChatCompletion(e, { ...t, stream: !0 }, { ...s, headers: { ...s?.headers, "X-Stainless-Helper-Method": "stream" } })), r;
  }
  async _createChatCompletion(e, t, s) {
    super._createChatCompletion;
    const r = s?.signal;
    r && (r.aborted && this.controller.abort(), r.addEventListener("abort", () => this.controller.abort())), o(this, O, "m", bt).call(this);
    const i = await e.chat.completions.create({ ...t, stream: !0 }, { ...s, signal: this.controller.signal });
    this._connected();
    for await (const a of i)
      o(this, O, "m", St).call(this, a);
    if (i.controller.signal?.aborted)
      throw new K();
    return this._addChatCompletion(o(this, O, "m", Le).call(this));
  }
  async _fromReadableStream(e, t) {
    const s = t?.signal;
    s && (s.aborted && this.controller.abort(), s.addEventListener("abort", () => this.controller.abort())), o(this, O, "m", bt).call(this), this._connected();
    const r = G.fromReadableStream(e, this.controller);
    let i;
    for await (const a of r)
      i && i !== a.id && this._addChatCompletion(o(this, O, "m", Le).call(this)), o(this, O, "m", St).call(this, a), i = a.id;
    if (r.controller.signal?.aborted)
      throw new K();
    return this._addChatCompletion(o(this, O, "m", Le).call(this));
  }
  [(Y = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakSet(), bt = function() {
    this.ended || S(this, te, void 0);
  }, Fe = function(t) {
    let s = o(this, oe, "f")[t.index];
    return s || (s = {
      content_done: !1,
      refusal_done: !1,
      logprobs_content_done: !1,
      logprobs_refusal_done: !1,
      done_tool_calls: /* @__PURE__ */ new Set(),
      current_tool_call_index: null
    }, o(this, oe, "f")[t.index] = s, s);
  }, St = function(t) {
    if (this.ended)
      return;
    const s = o(this, O, "m", $s).call(this, t);
    this._emit("chunk", t, s);
    for (const r of t.choices) {
      const i = s.choices[r.index];
      r.delta.content != null && i.message?.role === "assistant" && i.message?.content && (this._emit("content", r.delta.content, i.message.content), this._emit("content.delta", {
        delta: r.delta.content,
        snapshot: i.message.content,
        parsed: i.message.parsed
      })), r.delta.refusal != null && i.message?.role === "assistant" && i.message?.refusal && this._emit("refusal.delta", {
        delta: r.delta.refusal,
        snapshot: i.message.refusal
      }), r.logprobs?.content != null && i.message?.role === "assistant" && this._emit("logprobs.content.delta", {
        content: r.logprobs?.content,
        snapshot: i.logprobs?.content ?? []
      }), r.logprobs?.refusal != null && i.message?.role === "assistant" && this._emit("logprobs.refusal.delta", {
        refusal: r.logprobs?.refusal,
        snapshot: i.logprobs?.refusal ?? []
      });
      const a = o(this, O, "m", Fe).call(this, i);
      i.finish_reason && (o(this, O, "m", At).call(this, i), a.current_tool_call_index != null && o(this, O, "m", xt).call(this, i, a.current_tool_call_index));
      for (const l of r.delta.tool_calls ?? [])
        a.current_tool_call_index !== l.index && (o(this, O, "m", At).call(this, i), a.current_tool_call_index != null && o(this, O, "m", xt).call(this, i, a.current_tool_call_index)), a.current_tool_call_index = l.index;
      for (const l of r.delta.tool_calls ?? []) {
        const h = i.message.tool_calls?.[l.index];
        h?.type && (h?.type === "function" ? this._emit("tool_calls.function.arguments.delta", {
          name: h.function?.name,
          index: l.index,
          arguments: h.function.arguments,
          parsed_arguments: h.function.parsed_arguments,
          arguments_delta: l.function?.arguments ?? ""
        }) : (h?.type, void 0));
      }
    }
  }, xt = function(t, s) {
    if (o(this, O, "m", Fe).call(this, t).done_tool_calls.has(s))
      return;
    const i = t.message.tool_calls?.[s];
    if (!i)
      throw new Error("no tool call snapshot");
    if (!i.type)
      throw new Error("tool call snapshot missing `type`");
    if (i.type === "function") {
      const a = o(this, Y, "f")?.tools?.find((l) => Ze(l) && l.function.name === i.function.name);
      this._emit("tool_calls.function.arguments.done", {
        name: i.function.name,
        index: s,
        arguments: i.function.arguments,
        parsed_arguments: Pe(a) ? a.$parseRaw(i.function.arguments) : a?.function.strict ? JSON.parse(i.function.arguments) : null
      });
    } else
      i.type;
  }, At = function(t) {
    const s = o(this, O, "m", Fe).call(this, t);
    if (t.message.content && !s.content_done) {
      s.content_done = !0;
      const r = o(this, O, "m", vt).call(this);
      this._emit("content.done", {
        content: t.message.content,
        parsed: r ? r.$parseRaw(t.message.content) : null
      });
    }
    t.message.refusal && !s.refusal_done && (s.refusal_done = !0, this._emit("refusal.done", { refusal: t.message.refusal })), t.logprobs?.content && !s.logprobs_content_done && (s.logprobs_content_done = !0, this._emit("logprobs.content.done", { content: t.logprobs.content })), t.logprobs?.refusal && !s.logprobs_refusal_done && (s.logprobs_refusal_done = !0, this._emit("logprobs.refusal.done", { refusal: t.logprobs.refusal }));
  }, Le = function() {
    if (this.ended)
      throw new g("stream has ended, this shouldn't happen");
    const t = o(this, te, "f");
    if (!t)
      throw new g("request ended without sending any chunks");
    return S(this, te, void 0), S(this, oe, []), pi(t, o(this, Y, "f"));
  }, vt = function() {
    const t = o(this, Y, "f")?.response_format;
    return jt(t) ? t : null;
  }, $s = function(t) {
    var s, r, i, a;
    let l = o(this, te, "f");
    const { choices: h, ...f } = t;
    l ? Object.assign(l, f) : l = S(this, te, {
      ...f,
      choices: []
    });
    for (const { delta: m, finish_reason: d, index: y, logprobs: u = null, ...A } of t.choices) {
      let b = l.choices[y];
      if (b || (b = l.choices[y] = { finish_reason: d, index: y, message: {}, logprobs: u, ...A }), u)
        if (!b.logprobs)
          b.logprobs = Object.assign({}, u);
        else {
          const { content: U, refusal: C, ...F } = u;
          Object.assign(b.logprobs, F), U && ((s = b.logprobs).content ?? (s.content = []), b.logprobs.content.push(...U)), C && ((r = b.logprobs).refusal ?? (r.refusal = []), b.logprobs.refusal.push(...C));
        }
      if (d && (b.finish_reason = d, o(this, Y, "f") && fn(o(this, Y, "f")))) {
        if (d === "length")
          throw new Ks();
        if (d === "content_filter")
          throw new Vs();
      }
      if (Object.assign(b, A), !m)
        continue;
      const { content: I, refusal: v, function_call: w, role: T, tool_calls: R, ...X } = m;
      if (Object.assign(b.message, X), v && (b.message.refusal = (b.message.refusal || "") + v), T && (b.message.role = T), w && (b.message.function_call ? (w.name && (b.message.function_call.name = w.name), w.arguments && ((i = b.message.function_call).arguments ?? (i.arguments = ""), b.message.function_call.arguments += w.arguments)) : b.message.function_call = w), I && (b.message.content = (b.message.content || "") + I, !b.message.refusal && o(this, O, "m", vt).call(this) && (b.message.parsed = Rs(b.message.content))), R) {
        b.message.tool_calls || (b.message.tool_calls = []);
        for (const { index: U, id: C, type: F, function: N, ...k } of R) {
          const E = (a = b.message.tool_calls)[U] ?? (a[U] = {});
          Object.assign(E, k), C && (E.id = C), F && (E.type = F), N && (E.function ?? (E.function = { name: N.name ?? "", arguments: "" })), N?.name && (E.function.name = N.name), N?.arguments && (E.function.arguments += N.arguments, ii(o(this, Y, "f"), E) && (E.function.parsed_arguments = Rs(E.function.arguments)));
        }
      }
    }
    return l;
  }, Symbol.asyncIterator)]() {
    const e = [], t = [];
    let s = !1;
    return this.on("chunk", (r) => {
      const i = t.shift();
      i ? i.resolve(r) : e.push(r);
    }), this.on("end", () => {
      s = !0;
      for (const r of t)
        r.resolve(void 0);
      t.length = 0;
    }), this.on("abort", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), this.on("error", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), {
      next: async () => e.length ? { value: e.shift(), done: !1 } : s ? { value: void 0, done: !0 } : new Promise((i, a) => t.push({ resolve: i, reject: a })).then((i) => i ? { value: i, done: !1 } : { value: void 0, done: !0 }),
      return: async () => (this.abort(), { value: void 0, done: !0 })
    };
  }
  toReadableStream() {
    return new G(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
}
function pi(n, e) {
  const { id: t, choices: s, created: r, model: i, system_fingerprint: a, ...l } = n, h = {
    ...l,
    id: t,
    choices: s.map(({ message: f, finish_reason: m, index: d, logprobs: y, ...u }) => {
      if (!m)
        throw new g(`missing finish_reason for choice ${d}`);
      const { content: A = null, function_call: b, tool_calls: I, ...v } = f, w = f.role;
      if (!w)
        throw new g(`missing role for choice ${d}`);
      if (b) {
        const { arguments: T, name: R } = b;
        if (T == null)
          throw new g(`missing function_call.arguments for choice ${d}`);
        if (!R)
          throw new g(`missing function_call.name for choice ${d}`);
        return {
          ...u,
          message: {
            content: A,
            function_call: { arguments: T, name: R },
            role: w,
            refusal: f.refusal ?? null
          },
          finish_reason: m,
          index: d,
          logprobs: y
        };
      }
      return I ? {
        ...u,
        index: d,
        finish_reason: m,
        logprobs: y,
        message: {
          ...v,
          role: w,
          content: A,
          refusal: f.refusal ?? null,
          tool_calls: I.map((T, R) => {
            const { function: X, type: U, id: C, ...F } = T, { arguments: N, name: k, ...E } = X || {};
            if (C == null)
              throw new g(`missing choices[${d}].tool_calls[${R}].id
${Be(n)}`);
            if (U == null)
              throw new g(`missing choices[${d}].tool_calls[${R}].type
${Be(n)}`);
            if (k == null)
              throw new g(`missing choices[${d}].tool_calls[${R}].function.name
${Be(n)}`);
            if (N == null)
              throw new g(`missing choices[${d}].tool_calls[${R}].function.arguments
${Be(n)}`);
            return { ...F, id: C, type: U, function: { ...E, name: k, arguments: N } };
          })
        }
      } : {
        ...u,
        message: { ...v, content: A, role: w, refusal: f.refusal ?? null },
        finish_reason: m,
        index: d,
        logprobs: y
      };
    }),
    created: r,
    model: i,
    object: "chat.completion",
    ...a ? { system_fingerprint: a } : {}
  };
  return si(h, e);
}
function Be(n) {
  return JSON.stringify(n);
}
class rt extends Ee {
  static fromReadableStream(e) {
    const t = new rt(null);
    return t._run(() => t._fromReadableStream(e)), t;
  }
  static runTools(e, t, s) {
    const r = new rt(
      // @ts-expect-error TODO these types are incompatible
      t
    ), i = {
      ...s,
      headers: { ...s?.headers, "X-Stainless-Helper-Method": "runTools" }
    };
    return r._run(() => r._runTools(e, t, i)), r;
  }
}
let Kt = class extends _ {
  constructor() {
    super(...arguments), this.messages = new dn(this._client);
  }
  create(e, t) {
    return this._client.post("/chat/completions", { body: e, ...t, stream: e.stream ?? !1 });
  }
  /**
   * Get a stored chat completion. Only Chat Completions that have been created with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * const chatCompletion =
   *   await client.chat.completions.retrieve('completion_id');
   * ```
   */
  retrieve(e, t) {
    return this._client.get(c`/chat/completions/${e}`, t);
  }
  /**
   * Modify a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be modified. Currently, the only
   * supported modification is to update the `metadata` field.
   *
   * @example
   * ```ts
   * const chatCompletion = await client.chat.completions.update(
   *   'completion_id',
   *   { metadata: { foo: 'string' } },
   * );
   * ```
   */
  update(e, t, s) {
    return this._client.post(c`/chat/completions/${e}`, { body: t, ...s });
  }
  /**
   * List stored Chat Completions. Only Chat Completions that have been stored with
   * the `store` parameter set to `true` will be returned.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatCompletion of client.chat.completions.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    return this._client.getAPIList("/chat/completions", $, { query: e, ...t });
  }
  /**
   * Delete a stored chat completion. Only Chat Completions that have been created
   * with the `store` parameter set to `true` can be deleted.
   *
   * @example
   * ```ts
   * const chatCompletionDeleted =
   *   await client.chat.completions.delete('completion_id');
   * ```
   */
  delete(e, t) {
    return this._client.delete(c`/chat/completions/${e}`, t);
  }
  parse(e, t) {
    return ai(e.tools), this._client.chat.completions.create(e, {
      ...t,
      headers: {
        ...t?.headers,
        "X-Stainless-Helper-Method": "chat.completions.parse"
      }
    })._thenUnwrap((s) => Ht(s, e));
  }
  runTools(e, t) {
    return e.stream ? rt.runTools(this._client, e, t) : Xt.runTools(this._client, e, t);
  }
  /**
   * Creates a chat completion stream
   */
  stream(e, t) {
    return Ee.createChatCompletion(this._client, e, t);
  }
};
Kt.Messages = dn;
class Vt extends _ {
  constructor() {
    super(...arguments), this.completions = new Kt(this._client);
  }
}
Vt.Completions = Kt;
const Tn = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* mi(n) {
  if (!n)
    return;
  if (Tn in n) {
    const { values: s, nulls: r } = n;
    yield* s.entries();
    for (const i of r)
      yield [i, null];
    return;
  }
  let e = !1, t;
  n instanceof Headers ? t = n.entries() : hs(n) ? t = n : (e = !0, t = Object.entries(n ?? {}));
  for (let s of t) {
    const r = s[0];
    if (typeof r != "string")
      throw new TypeError("expected header name to be a string");
    const i = hs(s[1]) ? s[1] : [s[1]];
    let a = !1;
    for (const l of i)
      l !== void 0 && (e && !a && (a = !0, yield [r, null]), yield [r, l]);
  }
}
const p = (n) => {
  const e = new Headers(), t = /* @__PURE__ */ new Set();
  for (const s of n) {
    const r = /* @__PURE__ */ new Set();
    for (const [i, a] of mi(s)) {
      const l = i.toLowerCase();
      r.has(l) || (e.delete(i), r.add(l)), a === null ? (e.delete(i), t.add(l)) : (e.append(i, a), t.delete(l));
    }
  }
  return { [Tn]: !0, values: e, nulls: t };
};
class Nn extends _ {
  /**
   * Generates audio from the input text.
   *
   * Returns the audio file content, or a stream of audio events.
   *
   * @example
   * ```ts
   * const speech = await client.audio.speech.create({
   *   input: 'input',
   *   model: 'string',
   *   voice: 'ash',
   * });
   *
   * const content = await speech.blob();
   * console.log(content);
   * ```
   */
  create(e, t) {
    return this._client.post("/audio/speech", {
      body: e,
      ...t,
      headers: p([{ Accept: "application/octet-stream" }, t?.headers]),
      __binaryResponse: !0
    });
  }
}
class Mn extends _ {
  create(e, t) {
    return this._client.post("/audio/transcriptions", fe({
      body: e,
      ...t,
      stream: e.stream ?? !1,
      __metadata: { model: e.model }
    }, this._client));
  }
}
class Fn extends _ {
  create(e, t) {
    return this._client.post("/audio/translations", fe({ body: e, ...t, __metadata: { model: e.model } }, this._client));
  }
}
class Te extends _ {
  constructor() {
    super(...arguments), this.transcriptions = new Mn(this._client), this.translations = new Fn(this._client), this.speech = new Nn(this._client);
  }
}
Te.Transcriptions = Mn;
Te.Translations = Fn;
Te.Speech = Nn;
class Ln extends _ {
  /**
   * Creates and executes a batch from an uploaded file of requests
   */
  create(e, t) {
    return this._client.post("/batches", { body: e, ...t });
  }
  /**
   * Retrieves a batch.
   */
  retrieve(e, t) {
    return this._client.get(c`/batches/${e}`, t);
  }
  /**
   * List your organization's batches.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/batches", $, { query: e, ...t });
  }
  /**
   * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
   * 10 minutes, before changing to `cancelled`, where it will have partial results
   * (if any) available in the output file.
   */
  cancel(e, t) {
    return this._client.post(c`/batches/${e}/cancel`, t);
  }
}
class Bn extends _ {
  /**
   * Create an assistant with a model and instructions.
   *
   * @deprecated
   */
  create(e, t) {
    return this._client.post("/assistants", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Retrieves an assistant.
   *
   * @deprecated
   */
  retrieve(e, t) {
    return this._client.get(c`/assistants/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Modifies an assistant.
   *
   * @deprecated
   */
  update(e, t, s) {
    return this._client.post(c`/assistants/${e}`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of assistants.
   *
   * @deprecated
   */
  list(e = {}, t) {
    return this._client.getAPIList("/assistants", $, {
      query: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Delete an assistant.
   *
   * @deprecated
   */
  delete(e, t) {
    return this._client.delete(c`/assistants/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
}
let Dn = class extends _ {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API. Can be configured with the same session parameters as the
   * `session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const session =
   *   await client.beta.realtime.sessions.create();
   * ```
   */
  create(e, t) {
    return this._client.post("/realtime/sessions", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
};
class Un extends _ {
  /**
   * Create an ephemeral API token for use in client-side applications with the
   * Realtime API specifically for realtime transcriptions. Can be configured with
   * the same session parameters as the `transcription_session.update` client event.
   *
   * It responds with a session object, plus a `client_secret` key which contains a
   * usable ephemeral API token that can be used to authenticate browser clients for
   * the Realtime API.
   *
   * @example
   * ```ts
   * const transcriptionSession =
   *   await client.beta.realtime.transcriptionSessions.create();
   * ```
   */
  create(e, t) {
    return this._client.post("/realtime/transcription_sessions", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
}
let ut = class extends _ {
  constructor() {
    super(...arguments), this.sessions = new Dn(this._client), this.transcriptionSessions = new Un(this._client);
  }
};
ut.Sessions = Dn;
ut.TranscriptionSessions = Un;
class Wn extends _ {
  /**
   * Create a ChatKit session.
   *
   * @example
   * ```ts
   * const chatSession =
   *   await client.beta.chatkit.sessions.create({
   *     user: 'x',
   *     workflow: { id: 'id' },
   *   });
   * ```
   */
  create(e, t) {
    return this._client.post("/chatkit/sessions", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, t?.headers])
    });
  }
  /**
   * Cancel an active ChatKit session and return its most recent metadata.
   *
   * Cancelling prevents new requests from using the issued client secret.
   *
   * @example
   * ```ts
   * const chatSession =
   *   await client.beta.chatkit.sessions.cancel('cksess_123');
   * ```
   */
  cancel(e, t) {
    return this._client.post(c`/chatkit/sessions/${e}/cancel`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, t?.headers])
    });
  }
}
let qn = class extends _ {
  /**
   * Retrieve a ChatKit thread by its identifier.
   *
   * @example
   * ```ts
   * const chatkitThread =
   *   await client.beta.chatkit.threads.retrieve('cthr_123');
   * ```
   */
  retrieve(e, t) {
    return this._client.get(c`/chatkit/threads/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, t?.headers])
    });
  }
  /**
   * List ChatKit threads with optional pagination and user filters.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const chatkitThread of client.beta.chatkit.threads.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    return this._client.getAPIList("/chatkit/threads", Ye, {
      query: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, t?.headers])
    });
  }
  /**
   * Delete a ChatKit thread along with its items and stored attachments.
   *
   * @example
   * ```ts
   * const thread = await client.beta.chatkit.threads.delete(
   *   'cthr_123',
   * );
   * ```
   */
  delete(e, t) {
    return this._client.delete(c`/chatkit/threads/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, t?.headers])
    });
  }
  /**
   * List items that belong to a ChatKit thread.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const thread of client.beta.chatkit.threads.listItems(
   *   'cthr_123',
   * )) {
   *   // ...
   * }
   * ```
   */
  listItems(e, t = {}, s) {
    return this._client.getAPIList(c`/chatkit/threads/${e}/items`, Ye, { query: t, ...s, headers: p([{ "OpenAI-Beta": "chatkit_beta=v1" }, s?.headers]) });
  }
};
class ht extends _ {
  constructor() {
    super(...arguments), this.sessions = new Wn(this._client), this.threads = new qn(this._client);
  }
}
ht.Sessions = Wn;
ht.Threads = qn;
class jn extends _ {
  /**
   * Create a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(e, t, s) {
    return this._client.post(c`/threads/${e}/messages`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Retrieve a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(e, t, s) {
    const { thread_id: r } = t;
    return this._client.get(c`/threads/${r}/messages/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Modifies a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(e, t, s) {
    const { thread_id: r, ...i } = t;
    return this._client.post(c`/threads/${r}/messages/${e}`, {
      body: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of messages for a given thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/threads/${e}/messages`, $, {
      query: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Deletes a message.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(e, t, s) {
    const { thread_id: r } = t;
    return this._client.delete(c`/threads/${r}/messages/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
}
class Hn extends _ {
  /**
   * Retrieves a run step.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(e, t, s) {
    const { thread_id: r, run_id: i, ...a } = t;
    return this._client.get(c`/threads/${r}/runs/${i}/steps/${e}`, {
      query: a,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of run steps belonging to a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(e, t, s) {
    const { thread_id: r, ...i } = t;
    return this._client.getAPIList(c`/threads/${r}/runs/${e}/steps`, $, {
      query: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
}
const _i = (n) => {
  if (typeof Buffer < "u") {
    const e = Buffer.from(n, "base64");
    return Array.from(new Float32Array(e.buffer, e.byteOffset, e.length / Float32Array.BYTES_PER_ELEMENT));
  } else {
    const e = atob(n), t = e.length, s = new Uint8Array(t);
    for (let r = 0; r < t; r++)
      s[r] = e.charCodeAt(r);
    return Array.from(new Float32Array(s.buffer));
  }
}, ee = (n) => {
  if (typeof globalThis.process < "u")
    return globalThis.process.env?.[n]?.trim() ?? void 0;
  if (typeof globalThis.Deno < "u")
    return globalThis.Deno.env?.get?.(n)?.trim();
};
var B, ie, Ft, Q, Xe, V, ae, de, re, it, J, Ke, Ve, Ce, ve, Re, Cs, Is, ks, Es, Os, Ps, Ts;
class Ie extends Jt {
  constructor() {
    super(...arguments), B.add(this), Ft.set(this, []), Q.set(this, {}), Xe.set(this, {}), V.set(this, void 0), ae.set(this, void 0), de.set(this, void 0), re.set(this, void 0), it.set(this, void 0), J.set(this, void 0), Ke.set(this, void 0), Ve.set(this, void 0), Ce.set(this, void 0);
  }
  [(Ft = /* @__PURE__ */ new WeakMap(), Q = /* @__PURE__ */ new WeakMap(), Xe = /* @__PURE__ */ new WeakMap(), V = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), it = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), Ke = /* @__PURE__ */ new WeakMap(), Ve = /* @__PURE__ */ new WeakMap(), Ce = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakSet(), Symbol.asyncIterator)]() {
    const e = [], t = [];
    let s = !1;
    return this.on("event", (r) => {
      const i = t.shift();
      i ? i.resolve(r) : e.push(r);
    }), this.on("end", () => {
      s = !0;
      for (const r of t)
        r.resolve(void 0);
      t.length = 0;
    }), this.on("abort", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), this.on("error", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), {
      next: async () => e.length ? { value: e.shift(), done: !1 } : s ? { value: void 0, done: !0 } : new Promise((i, a) => t.push({ resolve: i, reject: a })).then((i) => i ? { value: i, done: !1 } : { value: void 0, done: !0 }),
      return: async () => (this.abort(), { value: void 0, done: !0 })
    };
  }
  static fromReadableStream(e) {
    const t = new ie();
    return t._run(() => t._fromReadableStream(e)), t;
  }
  async _fromReadableStream(e, t) {
    const s = t?.signal;
    s && (s.aborted && this.controller.abort(), s.addEventListener("abort", () => this.controller.abort())), this._connected();
    const r = G.fromReadableStream(e, this.controller);
    for await (const i of r)
      o(this, B, "m", ve).call(this, i);
    if (r.controller.signal?.aborted)
      throw new K();
    return this._addRun(o(this, B, "m", Re).call(this));
  }
  toReadableStream() {
    return new G(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
  static createToolAssistantStream(e, t, s, r) {
    const i = new ie();
    return i._run(() => i._runToolAssistantStream(e, t, s, {
      ...r,
      headers: { ...r?.headers, "X-Stainless-Helper-Method": "stream" }
    })), i;
  }
  async _createToolAssistantStream(e, t, s, r) {
    const i = r?.signal;
    i && (i.aborted && this.controller.abort(), i.addEventListener("abort", () => this.controller.abort()));
    const a = { ...s, stream: !0 }, l = await e.submitToolOutputs(t, a, {
      ...r,
      signal: this.controller.signal
    });
    this._connected();
    for await (const h of l)
      o(this, B, "m", ve).call(this, h);
    if (l.controller.signal?.aborted)
      throw new K();
    return this._addRun(o(this, B, "m", Re).call(this));
  }
  static createThreadAssistantStream(e, t, s) {
    const r = new ie();
    return r._run(() => r._threadAssistantStream(e, t, {
      ...s,
      headers: { ...s?.headers, "X-Stainless-Helper-Method": "stream" }
    })), r;
  }
  static createAssistantStream(e, t, s, r) {
    const i = new ie();
    return i._run(() => i._runAssistantStream(e, t, s, {
      ...r,
      headers: { ...r?.headers, "X-Stainless-Helper-Method": "stream" }
    })), i;
  }
  currentEvent() {
    return o(this, Ke, "f");
  }
  currentRun() {
    return o(this, Ve, "f");
  }
  currentMessageSnapshot() {
    return o(this, V, "f");
  }
  currentRunStepSnapshot() {
    return o(this, Ce, "f");
  }
  async finalRunSteps() {
    return await this.done(), Object.values(o(this, Q, "f"));
  }
  async finalMessages() {
    return await this.done(), Object.values(o(this, Xe, "f"));
  }
  async finalRun() {
    if (await this.done(), !o(this, ae, "f"))
      throw Error("Final run was not received.");
    return o(this, ae, "f");
  }
  async _createThreadAssistantStream(e, t, s) {
    const r = s?.signal;
    r && (r.aborted && this.controller.abort(), r.addEventListener("abort", () => this.controller.abort()));
    const i = { ...t, stream: !0 }, a = await e.createAndRun(i, { ...s, signal: this.controller.signal });
    this._connected();
    for await (const l of a)
      o(this, B, "m", ve).call(this, l);
    if (a.controller.signal?.aborted)
      throw new K();
    return this._addRun(o(this, B, "m", Re).call(this));
  }
  async _createAssistantStream(e, t, s, r) {
    const i = r?.signal;
    i && (i.aborted && this.controller.abort(), i.addEventListener("abort", () => this.controller.abort()));
    const a = { ...s, stream: !0 }, l = await e.create(t, a, { ...r, signal: this.controller.signal });
    this._connected();
    for await (const h of l)
      o(this, B, "m", ve).call(this, h);
    if (l.controller.signal?.aborted)
      throw new K();
    return this._addRun(o(this, B, "m", Re).call(this));
  }
  static accumulateDelta(e, t) {
    for (const [s, r] of Object.entries(t)) {
      if (!e.hasOwnProperty(s)) {
        e[s] = r;
        continue;
      }
      let i = e[s];
      if (i == null) {
        e[s] = r;
        continue;
      }
      if (s === "index" || s === "type") {
        e[s] = r;
        continue;
      }
      if (typeof i == "string" && typeof r == "string")
        i += r;
      else if (typeof i == "number" && typeof r == "number")
        i += r;
      else if (We(i) && We(r))
        i = this.accumulateDelta(i, r);
      else if (Array.isArray(i) && Array.isArray(r)) {
        if (i.every((a) => typeof a == "string" || typeof a == "number")) {
          i.push(...r);
          continue;
        }
        for (const a of r) {
          if (!We(a))
            throw new Error(`Expected array delta entry to be an object but got: ${a}`);
          const l = a.index;
          if (l == null)
            throw console.error(a), new Error("Expected array delta entry to have an `index` property");
          if (typeof l != "number")
            throw new Error(`Expected array delta entry \`index\` property to be a number but got ${l}`);
          const h = i[l];
          h == null ? i.push(a) : i[l] = this.accumulateDelta(h, a);
        }
        continue;
      } else
        throw Error(`Unhandled record type: ${s}, deltaValue: ${r}, accValue: ${i}`);
      e[s] = i;
    }
    return e;
  }
  _addRun(e) {
    return e;
  }
  async _threadAssistantStream(e, t, s) {
    return await this._createThreadAssistantStream(t, e, s);
  }
  async _runAssistantStream(e, t, s, r) {
    return await this._createAssistantStream(t, e, s, r);
  }
  async _runToolAssistantStream(e, t, s, r) {
    return await this._createToolAssistantStream(t, e, s, r);
  }
}
ie = Ie, ve = function(e) {
  if (!this.ended)
    switch (S(this, Ke, e), o(this, B, "m", ks).call(this, e), e.event) {
      case "thread.created":
        break;
      case "thread.run.created":
      case "thread.run.queued":
      case "thread.run.in_progress":
      case "thread.run.requires_action":
      case "thread.run.completed":
      case "thread.run.incomplete":
      case "thread.run.failed":
      case "thread.run.cancelling":
      case "thread.run.cancelled":
      case "thread.run.expired":
        o(this, B, "m", Ts).call(this, e);
        break;
      case "thread.run.step.created":
      case "thread.run.step.in_progress":
      case "thread.run.step.delta":
      case "thread.run.step.completed":
      case "thread.run.step.failed":
      case "thread.run.step.cancelled":
      case "thread.run.step.expired":
        o(this, B, "m", Is).call(this, e);
        break;
      case "thread.message.created":
      case "thread.message.in_progress":
      case "thread.message.delta":
      case "thread.message.completed":
      case "thread.message.incomplete":
        o(this, B, "m", Cs).call(this, e);
        break;
      case "error":
        throw new Error("Encountered an error event in event processing - errors should be processed earlier");
    }
}, Re = function() {
  if (this.ended)
    throw new g("stream has ended, this shouldn't happen");
  if (!o(this, ae, "f"))
    throw Error("Final run has not been received");
  return o(this, ae, "f");
}, Cs = function(e) {
  const [t, s] = o(this, B, "m", Os).call(this, e, o(this, V, "f"));
  S(this, V, t), o(this, Xe, "f")[t.id] = t;
  for (const r of s) {
    const i = t.content[r.index];
    i?.type == "text" && this._emit("textCreated", i.text);
  }
  switch (e.event) {
    case "thread.message.created":
      this._emit("messageCreated", e.data);
      break;
    case "thread.message.in_progress":
      break;
    case "thread.message.delta":
      if (this._emit("messageDelta", e.data.delta, t), e.data.delta.content)
        for (const r of e.data.delta.content) {
          if (r.type == "text" && r.text) {
            let i = r.text, a = t.content[r.index];
            if (a && a.type == "text")
              this._emit("textDelta", i, a.text);
            else
              throw Error("The snapshot associated with this text delta is not text or missing");
          }
          if (r.index != o(this, de, "f")) {
            if (o(this, re, "f"))
              switch (o(this, re, "f").type) {
                case "text":
                  this._emit("textDone", o(this, re, "f").text, o(this, V, "f"));
                  break;
                case "image_file":
                  this._emit("imageFileDone", o(this, re, "f").image_file, o(this, V, "f"));
                  break;
              }
            S(this, de, r.index);
          }
          S(this, re, t.content[r.index]);
        }
      break;
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (o(this, de, "f") !== void 0) {
        const r = e.data.content[o(this, de, "f")];
        if (r)
          switch (r.type) {
            case "image_file":
              this._emit("imageFileDone", r.image_file, o(this, V, "f"));
              break;
            case "text":
              this._emit("textDone", r.text, o(this, V, "f"));
              break;
          }
      }
      o(this, V, "f") && this._emit("messageDone", e.data), S(this, V, void 0);
  }
}, Is = function(e) {
  const t = o(this, B, "m", Es).call(this, e);
  switch (S(this, Ce, t), e.event) {
    case "thread.run.step.created":
      this._emit("runStepCreated", e.data);
      break;
    case "thread.run.step.delta":
      const s = e.data.delta;
      if (s.step_details && s.step_details.type == "tool_calls" && s.step_details.tool_calls && t.step_details.type == "tool_calls")
        for (const i of s.step_details.tool_calls)
          i.index == o(this, it, "f") ? this._emit("toolCallDelta", i, t.step_details.tool_calls[i.index]) : (o(this, J, "f") && this._emit("toolCallDone", o(this, J, "f")), S(this, it, i.index), S(this, J, t.step_details.tool_calls[i.index]), o(this, J, "f") && this._emit("toolCallCreated", o(this, J, "f")));
      this._emit("runStepDelta", e.data.delta, t);
      break;
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
      S(this, Ce, void 0), e.data.step_details.type == "tool_calls" && o(this, J, "f") && (this._emit("toolCallDone", o(this, J, "f")), S(this, J, void 0)), this._emit("runStepDone", e.data, t);
      break;
  }
}, ks = function(e) {
  o(this, Ft, "f").push(e), this._emit("event", e);
}, Es = function(e) {
  switch (e.event) {
    case "thread.run.step.created":
      return o(this, Q, "f")[e.data.id] = e.data, e.data;
    case "thread.run.step.delta":
      let t = o(this, Q, "f")[e.data.id];
      if (!t)
        throw Error("Received a RunStepDelta before creation of a snapshot");
      let s = e.data;
      if (s.delta) {
        const r = ie.accumulateDelta(t, s.delta);
        o(this, Q, "f")[e.data.id] = r;
      }
      return o(this, Q, "f")[e.data.id];
    case "thread.run.step.completed":
    case "thread.run.step.failed":
    case "thread.run.step.cancelled":
    case "thread.run.step.expired":
    case "thread.run.step.in_progress":
      o(this, Q, "f")[e.data.id] = e.data;
      break;
  }
  if (o(this, Q, "f")[e.data.id])
    return o(this, Q, "f")[e.data.id];
  throw new Error("No snapshot available");
}, Os = function(e, t) {
  let s = [];
  switch (e.event) {
    case "thread.message.created":
      return [e.data, s];
    case "thread.message.delta":
      if (!t)
        throw Error("Received a delta with no existing snapshot (there should be one from message creation)");
      let r = e.data;
      if (r.delta.content)
        for (const i of r.delta.content)
          if (i.index in t.content) {
            let a = t.content[i.index];
            t.content[i.index] = o(this, B, "m", Ps).call(this, i, a);
          } else
            t.content[i.index] = i, s.push(i);
      return [t, s];
    case "thread.message.in_progress":
    case "thread.message.completed":
    case "thread.message.incomplete":
      if (t)
        return [t, s];
      throw Error("Received thread message event with no existing snapshot");
  }
  throw Error("Tried to accumulate a non-message event");
}, Ps = function(e, t) {
  return ie.accumulateDelta(t, e);
}, Ts = function(e) {
  switch (S(this, Ve, e.data), e.event) {
    case "thread.run.created":
      break;
    case "thread.run.queued":
      break;
    case "thread.run.in_progress":
      break;
    case "thread.run.requires_action":
    case "thread.run.cancelled":
    case "thread.run.failed":
    case "thread.run.completed":
    case "thread.run.expired":
    case "thread.run.incomplete":
      S(this, ae, e.data), o(this, J, "f") && (this._emit("toolCallDone", o(this, J, "f")), S(this, J, void 0));
      break;
  }
};
let zt = class extends _ {
  constructor() {
    super(...arguments), this.steps = new Hn(this._client);
  }
  create(e, t, s) {
    const { include: r, ...i } = t;
    return this._client.post(c`/threads/${e}/runs`, {
      query: { include: r },
      body: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers]),
      stream: t.stream ?? !1,
      __synthesizeEventData: !0
    });
  }
  /**
   * Retrieves a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(e, t, s) {
    const { thread_id: r } = t;
    return this._client.get(c`/threads/${r}/runs/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Modifies a run.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(e, t, s) {
    const { thread_id: r, ...i } = t;
    return this._client.post(c`/threads/${r}/runs/${e}`, {
      body: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of runs belonging to a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/threads/${e}/runs`, $, {
      query: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Cancels a run that is `in_progress`.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  cancel(e, t, s) {
    const { thread_id: r } = t;
    return this._client.post(c`/threads/${r}/runs/${e}/cancel`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * A helper to create a run an poll for a terminal state. More information on Run
   * lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndPoll(e, t, s) {
    const r = await this.create(e, t, s);
    return await this.poll(r.id, { thread_id: e }, s);
  }
  /**
   * Create a Run stream
   *
   * @deprecated use `stream` instead
   */
  createAndStream(e, t, s) {
    return Ie.createAssistantStream(e, this._client.beta.threads.runs, t, s);
  }
  /**
   * A helper to poll a run status until it reaches a terminal state. More
   * information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async poll(e, t, s) {
    const r = p([
      s?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": s?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    for (; ; ) {
      const { data: i, response: a } = await this.retrieve(e, t, {
        ...s,
        headers: { ...s?.headers, ...r }
      }).withResponse();
      switch (i.status) {
        //If we are in any sort of intermediate state we poll
        case "queued":
        case "in_progress":
        case "cancelling":
          let l = 5e3;
          if (s?.pollIntervalMs)
            l = s.pollIntervalMs;
          else {
            const h = a.headers.get("openai-poll-after-ms");
            if (h) {
              const f = parseInt(h);
              isNaN(f) || (l = f);
            }
          }
          await Oe(l);
          break;
        //We return the run in any terminal state.
        case "requires_action":
        case "incomplete":
        case "cancelled":
        case "completed":
        case "failed":
        case "expired":
          return i;
      }
    }
  }
  /**
   * Create a Run stream
   */
  stream(e, t, s) {
    return Ie.createAssistantStream(e, this._client.beta.threads.runs, t, s);
  }
  submitToolOutputs(e, t, s) {
    const { thread_id: r, ...i } = t;
    return this._client.post(c`/threads/${r}/runs/${e}/submit_tool_outputs`, {
      body: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers]),
      stream: t.stream ?? !1,
      __synthesizeEventData: !0
    });
  }
  /**
   * A helper to submit a tool output to a run and poll for a terminal run state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async submitToolOutputsAndPoll(e, t, s) {
    const r = await this.submitToolOutputs(e, t, s);
    return await this.poll(r.id, t, s);
  }
  /**
   * Submit the tool outputs from a previous run and stream the run to a terminal
   * state. More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  submitToolOutputsStream(e, t, s) {
    return Ie.createToolAssistantStream(e, this._client.beta.threads.runs, t, s);
  }
};
zt.Steps = Hn;
class dt extends _ {
  constructor() {
    super(...arguments), this.runs = new zt(this._client), this.messages = new jn(this._client);
  }
  /**
   * Create a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  create(e = {}, t) {
    return this._client.post("/threads", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Retrieves a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  retrieve(e, t) {
    return this._client.get(c`/threads/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Modifies a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  update(e, t, s) {
    return this._client.post(c`/threads/${e}`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Delete a thread.
   *
   * @deprecated The Assistants API is deprecated in favor of the Responses API
   */
  delete(e, t) {
    return this._client.delete(c`/threads/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  createAndRun(e, t) {
    return this._client.post("/threads/runs", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers]),
      stream: e.stream ?? !1,
      __synthesizeEventData: !0
    });
  }
  /**
   * A helper to create a thread, start a run and then poll for a terminal state.
   * More information on Run lifecycles can be found here:
   * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
   */
  async createAndRunPoll(e, t) {
    const s = await this.createAndRun(e, t);
    return await this.runs.poll(s.id, { thread_id: s.thread_id }, t);
  }
  /**
   * Create a thread and stream the run back
   */
  createAndRunStream(e, t) {
    return Ie.createThreadAssistantStream(e, this._client.beta.threads, t);
  }
}
dt.Runs = zt;
dt.Messages = jn;
class pe extends _ {
  constructor() {
    super(...arguments), this.realtime = new ut(this._client), this.chatkit = new ht(this._client), this.assistants = new Bn(this._client), this.threads = new dt(this._client);
  }
}
pe.Realtime = ut;
pe.ChatKit = ht;
pe.Assistants = Bn;
pe.Threads = dt;
class Jn extends _ {
  create(e, t) {
    return this._client.post("/completions", { body: e, ...t, stream: e.stream ?? !1 });
  }
}
let Xn = class extends _ {
  /**
   * Retrieve Container File Content
   */
  retrieve(e, t, s) {
    const { container_id: r } = t;
    return this._client.get(c`/containers/${r}/files/${e}/content`, {
      ...s,
      headers: p([{ Accept: "application/binary" }, s?.headers]),
      __binaryResponse: !0
    });
  }
}, Qt = class extends _ {
  constructor() {
    super(...arguments), this.content = new Xn(this._client);
  }
  /**
   * Create a Container File
   *
   * You can send either a multipart/form-data request with the raw file content, or
   * a JSON request with a file ID.
   */
  create(e, t, s) {
    return this._client.post(c`/containers/${e}/files`, ke({ body: t, ...s }, this._client));
  }
  /**
   * Retrieve Container File
   */
  retrieve(e, t, s) {
    const { container_id: r } = t;
    return this._client.get(c`/containers/${r}/files/${e}`, s);
  }
  /**
   * List Container files
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/containers/${e}/files`, $, {
      query: t,
      ...s
    });
  }
  /**
   * Delete Container File
   */
  delete(e, t, s) {
    const { container_id: r } = t;
    return this._client.delete(c`/containers/${r}/files/${e}`, {
      ...s,
      headers: p([{ Accept: "*/*" }, s?.headers])
    });
  }
};
Qt.Content = Xn;
class Gt extends _ {
  constructor() {
    super(...arguments), this.files = new Qt(this._client);
  }
  /**
   * Create Container
   */
  create(e, t) {
    return this._client.post("/containers", { body: e, ...t });
  }
  /**
   * Retrieve Container
   */
  retrieve(e, t) {
    return this._client.get(c`/containers/${e}`, t);
  }
  /**
   * List Containers
   */
  list(e = {}, t) {
    return this._client.getAPIList("/containers", $, { query: e, ...t });
  }
  /**
   * Delete Container
   */
  delete(e, t) {
    return this._client.delete(c`/containers/${e}`, {
      ...t,
      headers: p([{ Accept: "*/*" }, t?.headers])
    });
  }
}
Gt.Files = Qt;
class Kn extends _ {
  /**
   * Create items in a conversation with the given ID.
   */
  create(e, t, s) {
    const { include: r, ...i } = t;
    return this._client.post(c`/conversations/${e}/items`, {
      query: { include: r },
      body: i,
      ...s
    });
  }
  /**
   * Get a single item from a conversation with the given IDs.
   */
  retrieve(e, t, s) {
    const { conversation_id: r, ...i } = t;
    return this._client.get(c`/conversations/${r}/items/${e}`, { query: i, ...s });
  }
  /**
   * List all items for a conversation with the given ID.
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/conversations/${e}/items`, Ye, { query: t, ...s });
  }
  /**
   * Delete an item from a conversation with the given IDs.
   */
  delete(e, t, s) {
    const { conversation_id: r } = t;
    return this._client.delete(c`/conversations/${r}/items/${e}`, s);
  }
}
class Yt extends _ {
  constructor() {
    super(...arguments), this.items = new Kn(this._client);
  }
  /**
   * Create a conversation.
   */
  create(e = {}, t) {
    return this._client.post("/conversations", { body: e, ...t });
  }
  /**
   * Get a conversation
   */
  retrieve(e, t) {
    return this._client.get(c`/conversations/${e}`, t);
  }
  /**
   * Update a conversation
   */
  update(e, t, s) {
    return this._client.post(c`/conversations/${e}`, { body: t, ...s });
  }
  /**
   * Delete a conversation. Items in the conversation will not be deleted.
   */
  delete(e, t) {
    return this._client.delete(c`/conversations/${e}`, t);
  }
}
Yt.Items = Kn;
class Vn extends _ {
  /**
   * Creates an embedding vector representing the input text.
   *
   * @example
   * ```ts
   * const createEmbeddingResponse =
   *   await client.embeddings.create({
   *     input: 'The quick brown fox jumped over the lazy dog',
   *     model: 'text-embedding-3-small',
   *   });
   * ```
   */
  create(e, t) {
    const s = !!e.encoding_format;
    let r = s ? e.encoding_format : "base64";
    s && L(this._client).debug("embeddings/user defined encoding_format:", e.encoding_format);
    const i = this._client.post("/embeddings", {
      body: {
        ...e,
        encoding_format: r
      },
      ...t
    });
    return s ? i : (L(this._client).debug("embeddings/decoding base64 embeddings from base64"), i._thenUnwrap((a) => (a && a.data && a.data.forEach((l) => {
      const h = l.embedding;
      l.embedding = _i(h);
    }), a)));
  }
}
class zn extends _ {
  /**
   * Get an evaluation run output item by ID.
   */
  retrieve(e, t, s) {
    const { eval_id: r, run_id: i } = t;
    return this._client.get(c`/evals/${r}/runs/${i}/output_items/${e}`, s);
  }
  /**
   * Get a list of output items for an evaluation run.
   */
  list(e, t, s) {
    const { eval_id: r, ...i } = t;
    return this._client.getAPIList(c`/evals/${r}/runs/${e}/output_items`, $, { query: i, ...s });
  }
}
class Zt extends _ {
  constructor() {
    super(...arguments), this.outputItems = new zn(this._client);
  }
  /**
   * Kicks off a new run for a given evaluation, specifying the data source, and what
   * model configuration to use to test. The datasource will be validated against the
   * schema specified in the config of the evaluation.
   */
  create(e, t, s) {
    return this._client.post(c`/evals/${e}/runs`, { body: t, ...s });
  }
  /**
   * Get an evaluation run by ID.
   */
  retrieve(e, t, s) {
    const { eval_id: r } = t;
    return this._client.get(c`/evals/${r}/runs/${e}`, s);
  }
  /**
   * Get a list of runs for an evaluation.
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/evals/${e}/runs`, $, {
      query: t,
      ...s
    });
  }
  /**
   * Delete an eval run.
   */
  delete(e, t, s) {
    const { eval_id: r } = t;
    return this._client.delete(c`/evals/${r}/runs/${e}`, s);
  }
  /**
   * Cancel an ongoing evaluation run.
   */
  cancel(e, t, s) {
    const { eval_id: r } = t;
    return this._client.post(c`/evals/${r}/runs/${e}`, s);
  }
}
Zt.OutputItems = zn;
class es extends _ {
  constructor() {
    super(...arguments), this.runs = new Zt(this._client);
  }
  /**
   * Create the structure of an evaluation that can be used to test a model's
   * performance. An evaluation is a set of testing criteria and the config for a
   * data source, which dictates the schema of the data used in the evaluation. After
   * creating an evaluation, you can run it on different models and model parameters.
   * We support several types of graders and datasources. For more information, see
   * the [Evals guide](https://platform.openai.com/docs/guides/evals).
   */
  create(e, t) {
    return this._client.post("/evals", { body: e, ...t });
  }
  /**
   * Get an evaluation by ID.
   */
  retrieve(e, t) {
    return this._client.get(c`/evals/${e}`, t);
  }
  /**
   * Update certain properties of an evaluation.
   */
  update(e, t, s) {
    return this._client.post(c`/evals/${e}`, { body: t, ...s });
  }
  /**
   * List evaluations for a project.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/evals", $, { query: e, ...t });
  }
  /**
   * Delete an evaluation.
   */
  delete(e, t) {
    return this._client.delete(c`/evals/${e}`, t);
  }
}
es.Runs = Zt;
let Qn = class extends _ {
  /**
   * Upload a file that can be used across various endpoints. Individual files can be
   * up to 512 MB, and each project can store up to 2.5 TB of files in total. There
   * is no organization-wide storage limit.
   *
   * - The Assistants API supports files up to 2 million tokens and of specific file
   *   types. See the
   *   [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools)
   *   for details.
   * - The Fine-tuning API only supports `.jsonl` files. The input also has certain
   *   required formats for fine-tuning
   *   [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input)
   *   or
   *   [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
   *   models.
   * - The Batch API only supports `.jsonl` files up to 200 MB in size. The input
   *   also has a specific required
   *   [format](https://platform.openai.com/docs/api-reference/batch/request-input).
   *
   * Please [contact us](https://help.openai.com/) if you need to increase these
   * storage limits.
   */
  create(e, t) {
    return this._client.post("/files", fe({ body: e, ...t }, this._client));
  }
  /**
   * Returns information about a specific file.
   */
  retrieve(e, t) {
    return this._client.get(c`/files/${e}`, t);
  }
  /**
   * Returns a list of files.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/files", $, { query: e, ...t });
  }
  /**
   * Delete a file and remove it from all vector stores.
   */
  delete(e, t) {
    return this._client.delete(c`/files/${e}`, t);
  }
  /**
   * Returns the contents of the specified file.
   */
  content(e, t) {
    return this._client.get(c`/files/${e}/content`, {
      ...t,
      headers: p([{ Accept: "application/binary" }, t?.headers]),
      __binaryResponse: !0
    });
  }
  /**
   * Waits for the given file to be processed, default timeout is 30 mins.
   */
  async waitForProcessing(e, { pollInterval: t = 5e3, maxWait: s = 1800 * 1e3 } = {}) {
    const r = /* @__PURE__ */ new Set(["processed", "error", "deleted"]), i = Date.now();
    let a = await this.retrieve(e);
    for (; !a.status || !r.has(a.status); )
      if (await Oe(t), a = await this.retrieve(e), Date.now() - i > s)
        throw new Dt({
          message: `Giving up on waiting for file ${e} to finish processing after ${s} milliseconds.`
        });
    return a;
  }
};
class Gn extends _ {
}
let Yn = class extends _ {
  /**
   * Run a grader.
   *
   * @example
   * ```ts
   * const response = await client.fineTuning.alpha.graders.run({
   *   grader: {
   *     input: 'input',
   *     name: 'name',
   *     operation: 'eq',
   *     reference: 'reference',
   *     type: 'string_check',
   *   },
   *   model_sample: 'model_sample',
   * });
   * ```
   */
  run(e, t) {
    return this._client.post("/fine_tuning/alpha/graders/run", { body: e, ...t });
  }
  /**
   * Validate a grader.
   *
   * @example
   * ```ts
   * const response =
   *   await client.fineTuning.alpha.graders.validate({
   *     grader: {
   *       input: 'input',
   *       name: 'name',
   *       operation: 'eq',
   *       reference: 'reference',
   *       type: 'string_check',
   *     },
   *   });
   * ```
   */
  validate(e, t) {
    return this._client.post("/fine_tuning/alpha/graders/validate", { body: e, ...t });
  }
};
class ts extends _ {
  constructor() {
    super(...arguments), this.graders = new Yn(this._client);
  }
}
ts.Graders = Yn;
class Zn extends _ {
  /**
   * **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys).
   *
   * This enables organization owners to share fine-tuned models with other projects
   * in their organization.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const permissionCreateResponse of client.fineTuning.checkpoints.permissions.create(
   *   'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *   { project_ids: ['string'] },
   * )) {
   *   // ...
   * }
   * ```
   */
  create(e, t, s) {
    return this._client.getAPIList(c`/fine_tuning/checkpoints/${e}/permissions`, ct, { body: t, method: "post", ...s });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to view all permissions for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * const permission =
   *   await client.fineTuning.checkpoints.permissions.retrieve(
   *     'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   *   );
   * ```
   */
  retrieve(e, t = {}, s) {
    return this._client.get(c`/fine_tuning/checkpoints/${e}/permissions`, {
      query: t,
      ...s
    });
  }
  /**
   * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
   *
   * Organization owners can use this endpoint to delete a permission for a
   * fine-tuned model checkpoint.
   *
   * @example
   * ```ts
   * const permission =
   *   await client.fineTuning.checkpoints.permissions.delete(
   *     'cp_zc4Q7MP6XxulcVzj4MZdwsAB',
   *     {
   *       fine_tuned_model_checkpoint:
   *         'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
   *     },
   *   );
   * ```
   */
  delete(e, t, s) {
    const { fine_tuned_model_checkpoint: r } = t;
    return this._client.delete(c`/fine_tuning/checkpoints/${r}/permissions/${e}`, s);
  }
}
let ss = class extends _ {
  constructor() {
    super(...arguments), this.permissions = new Zn(this._client);
  }
};
ss.Permissions = Zn;
class er extends _ {
  /**
   * List checkpoints for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobCheckpoint of client.fineTuning.jobs.checkpoints.list(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/fine_tuning/jobs/${e}/checkpoints`, $, { query: t, ...s });
  }
}
class ns extends _ {
  constructor() {
    super(...arguments), this.checkpoints = new er(this._client);
  }
  /**
   * Creates a fine-tuning job which begins the process of creating a new model from
   * a given dataset.
   *
   * Response includes details of the enqueued job including job status and the name
   * of the fine-tuned models once complete.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.create({
   *   model: 'gpt-4o-mini',
   *   training_file: 'file-abc123',
   * });
   * ```
   */
  create(e, t) {
    return this._client.post("/fine_tuning/jobs", { body: e, ...t });
  }
  /**
   * Get info about a fine-tuning job.
   *
   * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/model-optimization)
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.retrieve(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  retrieve(e, t) {
    return this._client.get(c`/fine_tuning/jobs/${e}`, t);
  }
  /**
   * List your organization's fine-tuning jobs
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJob of client.fineTuning.jobs.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    return this._client.getAPIList("/fine_tuning/jobs", $, { query: e, ...t });
  }
  /**
   * Immediately cancel a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.cancel(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  cancel(e, t) {
    return this._client.post(c`/fine_tuning/jobs/${e}/cancel`, t);
  }
  /**
   * Get status updates for a fine-tuning job.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fineTuningJobEvent of client.fineTuning.jobs.listEvents(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * )) {
   *   // ...
   * }
   * ```
   */
  listEvents(e, t = {}, s) {
    return this._client.getAPIList(c`/fine_tuning/jobs/${e}/events`, $, { query: t, ...s });
  }
  /**
   * Pause a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.pause(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  pause(e, t) {
    return this._client.post(c`/fine_tuning/jobs/${e}/pause`, t);
  }
  /**
   * Resume a fine-tune job.
   *
   * @example
   * ```ts
   * const fineTuningJob = await client.fineTuning.jobs.resume(
   *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
   * );
   * ```
   */
  resume(e, t) {
    return this._client.post(c`/fine_tuning/jobs/${e}/resume`, t);
  }
}
ns.Checkpoints = er;
class me extends _ {
  constructor() {
    super(...arguments), this.methods = new Gn(this._client), this.jobs = new ns(this._client), this.checkpoints = new ss(this._client), this.alpha = new ts(this._client);
  }
}
me.Methods = Gn;
me.Jobs = ns;
me.Checkpoints = ss;
me.Alpha = ts;
class tr extends _ {
}
class rs extends _ {
  constructor() {
    super(...arguments), this.graderModels = new tr(this._client);
  }
}
rs.GraderModels = tr;
class sr extends _ {
  /**
   * Creates a variation of a given image. This endpoint only supports `dall-e-2`.
   *
   * @example
   * ```ts
   * const imagesResponse = await client.images.createVariation({
   *   image: fs.createReadStream('otter.png'),
   * });
   * ```
   */
  createVariation(e, t) {
    return this._client.post("/images/variations", fe({ body: e, ...t }, this._client));
  }
  edit(e, t) {
    return this._client.post("/images/edits", fe({ body: e, ...t, stream: e.stream ?? !1 }, this._client));
  }
  generate(e, t) {
    return this._client.post("/images/generations", { body: e, ...t, stream: e.stream ?? !1 });
  }
}
class nr extends _ {
  /**
   * Retrieves a model instance, providing basic information about the model such as
   * the owner and permissioning.
   */
  retrieve(e, t) {
    return this._client.get(c`/models/${e}`, t);
  }
  /**
   * Lists the currently available models, and provides basic information about each
   * one such as the owner and availability.
   */
  list(e) {
    return this._client.getAPIList("/models", ct, e);
  }
  /**
   * Delete a fine-tuned model. You must have the Owner role in your organization to
   * delete a model.
   */
  delete(e, t) {
    return this._client.delete(c`/models/${e}`, t);
  }
}
class rr extends _ {
  /**
   * Classifies if text and/or image inputs are potentially harmful. Learn more in
   * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
   */
  create(e, t) {
    return this._client.post("/moderations", { body: e, ...t });
  }
}
class ir extends _ {
  /**
   * Accept an incoming SIP call and configure the realtime session that will handle
   * it.
   *
   * @example
   * ```ts
   * await client.realtime.calls.accept('call_id', {
   *   type: 'realtime',
   * });
   * ```
   */
  accept(e, t, s) {
    return this._client.post(c`/realtime/calls/${e}/accept`, {
      body: t,
      ...s,
      headers: p([{ Accept: "*/*" }, s?.headers])
    });
  }
  /**
   * End an active Realtime API call, whether it was initiated over SIP or WebRTC.
   *
   * @example
   * ```ts
   * await client.realtime.calls.hangup('call_id');
   * ```
   */
  hangup(e, t) {
    return this._client.post(c`/realtime/calls/${e}/hangup`, {
      ...t,
      headers: p([{ Accept: "*/*" }, t?.headers])
    });
  }
  /**
   * Transfer an active SIP call to a new destination using the SIP REFER verb.
   *
   * @example
   * ```ts
   * await client.realtime.calls.refer('call_id', {
   *   target_uri: 'tel:+14155550123',
   * });
   * ```
   */
  refer(e, t, s) {
    return this._client.post(c`/realtime/calls/${e}/refer`, {
      body: t,
      ...s,
      headers: p([{ Accept: "*/*" }, s?.headers])
    });
  }
  /**
   * Decline an incoming SIP call by returning a SIP status code to the caller.
   *
   * @example
   * ```ts
   * await client.realtime.calls.reject('call_id');
   * ```
   */
  reject(e, t = {}, s) {
    return this._client.post(c`/realtime/calls/${e}/reject`, {
      body: t,
      ...s,
      headers: p([{ Accept: "*/*" }, s?.headers])
    });
  }
}
class ar extends _ {
  /**
   * Create a Realtime client secret with an associated session configuration.
   *
   * Client secrets are short-lived tokens that can be passed to a client app, such
   * as a web frontend or mobile client, which grants access to the Realtime API
   * without leaking your main API key. You can configure a custom TTL for each
   * client secret.
   *
   * You can also attach session configuration options to the client secret, which
   * will be applied to any sessions created using that client secret, but these can
   * also be overridden by the client connection.
   *
   * [Learn more about authentication with client secrets over WebRTC](https://platform.openai.com/docs/guides/realtime-webrtc).
   *
   * Returns the created client secret and the effective session object. The client
   * secret is a string that looks like `ek_1234`.
   *
   * @example
   * ```ts
   * const clientSecret =
   *   await client.realtime.clientSecrets.create();
   * ```
   */
  create(e, t) {
    return this._client.post("/realtime/client_secrets", { body: e, ...t });
  }
}
class ft extends _ {
  constructor() {
    super(...arguments), this.clientSecrets = new ar(this._client), this.calls = new ir(this._client);
  }
}
ft.ClientSecrets = ar;
ft.Calls = ir;
function gi(n, e) {
  return !e || !wi(e) ? {
    ...n,
    output_parsed: null,
    output: n.output.map((t) => t.type === "function_call" ? {
      ...t,
      parsed_arguments: null
    } : t.type === "message" ? {
      ...t,
      content: t.content.map((s) => ({
        ...s,
        parsed: null
      }))
    } : t)
  } : or(n, e);
}
function or(n, e) {
  const t = n.output.map((r) => {
    if (r.type === "function_call")
      return {
        ...r,
        parsed_arguments: xi(e, r)
      };
    if (r.type === "message") {
      const i = r.content.map((a) => a.type === "output_text" ? {
        ...a,
        parsed: yi(e, a.text)
      } : a);
      return {
        ...r,
        content: i
      };
    }
    return r;
  }), s = Object.assign({}, n, { output: t });
  return Object.getOwnPropertyDescriptor(n, "output_text") || Lt(s), Object.defineProperty(s, "output_parsed", {
    enumerable: !0,
    get() {
      for (const r of s.output)
        if (r.type === "message") {
          for (const i of r.content)
            if (i.type === "output_text" && i.parsed !== null)
              return i.parsed;
        }
      return null;
    }
  }), s;
}
function yi(n, e) {
  return n.text?.format?.type !== "json_schema" ? null : "$parseRaw" in n.text?.format ? (n.text?.format).$parseRaw(e) : JSON.parse(e);
}
function wi(n) {
  return !!jt(n.text?.format);
}
function bi(n) {
  return n?.$brand === "auto-parseable-tool";
}
function Si(n, e) {
  return n.find((t) => t.type === "function" && t.name === e);
}
function xi(n, e) {
  const t = Si(n.tools ?? [], e.name);
  return {
    ...e,
    ...e,
    parsed_arguments: bi(t) ? t.$parseRaw(e.arguments) : t?.strict ? JSON.parse(e.arguments) : null
  };
}
function Lt(n) {
  const e = [];
  for (const t of n.output)
    if (t.type === "message")
      for (const s of t.content)
        s.type === "output_text" && e.push(s.text);
  n.output_text = e.join("");
}
var le, De, se, Ue, Ns, Ms, Fs, Ls;
class is extends Jt {
  constructor(e) {
    super(), le.add(this), De.set(this, void 0), se.set(this, void 0), Ue.set(this, void 0), S(this, De, e);
  }
  static createResponse(e, t, s) {
    const r = new is(t);
    return r._run(() => r._createOrRetrieveResponse(e, t, {
      ...s,
      headers: { ...s?.headers, "X-Stainless-Helper-Method": "stream" }
    })), r;
  }
  async _createOrRetrieveResponse(e, t, s) {
    const r = s?.signal;
    r && (r.aborted && this.controller.abort(), r.addEventListener("abort", () => this.controller.abort())), o(this, le, "m", Ns).call(this);
    let i, a = null;
    "response_id" in t ? (i = await e.responses.retrieve(t.response_id, { stream: !0 }, { ...s, signal: this.controller.signal, stream: !0 }), a = t.starting_after ?? null) : i = await e.responses.create({ ...t, stream: !0 }, { ...s, signal: this.controller.signal }), this._connected();
    for await (const l of i)
      o(this, le, "m", Ms).call(this, l, a);
    if (i.controller.signal?.aborted)
      throw new K();
    return o(this, le, "m", Fs).call(this);
  }
  [(De = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), Ue = /* @__PURE__ */ new WeakMap(), le = /* @__PURE__ */ new WeakSet(), Ns = function() {
    this.ended || S(this, se, void 0);
  }, Ms = function(t, s) {
    if (this.ended)
      return;
    const r = (a, l) => {
      (s == null || l.sequence_number > s) && this._emit(a, l);
    }, i = o(this, le, "m", Ls).call(this, t);
    switch (r("event", t), t.type) {
      case "response.output_text.delta": {
        const a = i.output[t.output_index];
        if (!a)
          throw new g(`missing output at index ${t.output_index}`);
        if (a.type === "message") {
          const l = a.content[t.content_index];
          if (!l)
            throw new g(`missing content at index ${t.content_index}`);
          if (l.type !== "output_text")
            throw new g(`expected content to be 'output_text', got ${l.type}`);
          r("response.output_text.delta", {
            ...t,
            snapshot: l.text
          });
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const a = i.output[t.output_index];
        if (!a)
          throw new g(`missing output at index ${t.output_index}`);
        a.type === "function_call" && r("response.function_call_arguments.delta", {
          ...t,
          snapshot: a.arguments
        });
        break;
      }
      default:
        r(t.type, t);
        break;
    }
  }, Fs = function() {
    if (this.ended)
      throw new g("stream has ended, this shouldn't happen");
    const t = o(this, se, "f");
    if (!t)
      throw new g("request ended without sending any events");
    S(this, se, void 0);
    const s = Ai(t, o(this, De, "f"));
    return S(this, Ue, s), s;
  }, Ls = function(t) {
    let s = o(this, se, "f");
    if (!s) {
      if (t.type !== "response.created")
        throw new g(`When snapshot hasn't been set yet, expected 'response.created' event, got ${t.type}`);
      return s = S(this, se, t.response), s;
    }
    switch (t.type) {
      case "response.output_item.added": {
        s.output.push(t.item);
        break;
      }
      case "response.content_part.added": {
        const r = s.output[t.output_index];
        if (!r)
          throw new g(`missing output at index ${t.output_index}`);
        const i = r.type, a = t.part;
        i === "message" && a.type !== "reasoning_text" ? r.content.push(a) : i === "reasoning" && a.type === "reasoning_text" && (r.content || (r.content = []), r.content.push(a));
        break;
      }
      case "response.output_text.delta": {
        const r = s.output[t.output_index];
        if (!r)
          throw new g(`missing output at index ${t.output_index}`);
        if (r.type === "message") {
          const i = r.content[t.content_index];
          if (!i)
            throw new g(`missing content at index ${t.content_index}`);
          if (i.type !== "output_text")
            throw new g(`expected content to be 'output_text', got ${i.type}`);
          i.text += t.delta;
        }
        break;
      }
      case "response.function_call_arguments.delta": {
        const r = s.output[t.output_index];
        if (!r)
          throw new g(`missing output at index ${t.output_index}`);
        r.type === "function_call" && (r.arguments += t.delta);
        break;
      }
      case "response.reasoning_text.delta": {
        const r = s.output[t.output_index];
        if (!r)
          throw new g(`missing output at index ${t.output_index}`);
        if (r.type === "reasoning") {
          const i = r.content?.[t.content_index];
          if (!i)
            throw new g(`missing content at index ${t.content_index}`);
          if (i.type !== "reasoning_text")
            throw new g(`expected content to be 'reasoning_text', got ${i.type}`);
          i.text += t.delta;
        }
        break;
      }
      case "response.completed": {
        S(this, se, t.response);
        break;
      }
    }
    return s;
  }, Symbol.asyncIterator)]() {
    const e = [], t = [];
    let s = !1;
    return this.on("event", (r) => {
      const i = t.shift();
      i ? i.resolve(r) : e.push(r);
    }), this.on("end", () => {
      s = !0;
      for (const r of t)
        r.resolve(void 0);
      t.length = 0;
    }), this.on("abort", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), this.on("error", (r) => {
      s = !0;
      for (const i of t)
        i.reject(r);
      t.length = 0;
    }), {
      next: async () => e.length ? { value: e.shift(), done: !1 } : s ? { value: void 0, done: !0 } : new Promise((i, a) => t.push({ resolve: i, reject: a })).then((i) => i ? { value: i, done: !1 } : { value: void 0, done: !0 }),
      return: async () => (this.abort(), { value: void 0, done: !0 })
    };
  }
  /**
   * @returns a promise that resolves with the final Response, or rejects
   * if an error occurred or the stream ended prematurely without producing a REsponse.
   */
  async finalResponse() {
    await this.done();
    const e = o(this, Ue, "f");
    if (!e)
      throw new g("stream ended without producing a ChatCompletion");
    return e;
  }
}
function Ai(n, e) {
  return gi(n, e);
}
class lr extends _ {
  /**
   * Returns a list of input items for a given response.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const responseItem of client.responses.inputItems.list(
   *   'response_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/responses/${e}/input_items`, $, { query: t, ...s });
  }
}
class cr extends _ {
  /**
   * Returns input token counts of the request.
   *
   * Returns an object with `object` set to `response.input_tokens` and an
   * `input_tokens` count.
   *
   * @example
   * ```ts
   * const response = await client.responses.inputTokens.count();
   * ```
   */
  count(e = {}, t) {
    return this._client.post("/responses/input_tokens", { body: e, ...t });
  }
}
class pt extends _ {
  constructor() {
    super(...arguments), this.inputItems = new lr(this._client), this.inputTokens = new cr(this._client);
  }
  create(e, t) {
    return this._client.post("/responses", { body: e, ...t, stream: e.stream ?? !1 })._thenUnwrap((s) => ("object" in s && s.object === "response" && Lt(s), s));
  }
  retrieve(e, t = {}, s) {
    return this._client.get(c`/responses/${e}`, {
      query: t,
      ...s,
      stream: t?.stream ?? !1
    })._thenUnwrap((r) => ("object" in r && r.object === "response" && Lt(r), r));
  }
  /**
   * Deletes a model response with the given ID.
   *
   * @example
   * ```ts
   * await client.responses.delete(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  delete(e, t) {
    return this._client.delete(c`/responses/${e}`, {
      ...t,
      headers: p([{ Accept: "*/*" }, t?.headers])
    });
  }
  parse(e, t) {
    return this._client.responses.create(e, t)._thenUnwrap((s) => or(s, e));
  }
  /**
   * Creates a model response stream
   */
  stream(e, t) {
    return is.createResponse(this._client, e, t);
  }
  /**
   * Cancels a model response with the given ID. Only responses created with the
   * `background` parameter set to `true` can be cancelled.
   * [Learn more](https://platform.openai.com/docs/guides/background).
   *
   * @example
   * ```ts
   * const response = await client.responses.cancel(
   *   'resp_677efb5139a88190b512bc3fef8e535d',
   * );
   * ```
   */
  cancel(e, t) {
    return this._client.post(c`/responses/${e}/cancel`, t);
  }
  /**
   * Compact a conversation. Returns a compacted response object.
   *
   * Learn when and how to compact long-running conversations in the
   * [conversation state guide](https://platform.openai.com/docs/guides/conversation-state#managing-the-context-window).
   * For ZDR-compatible compaction details, see
   * [Compaction (advanced)](https://platform.openai.com/docs/guides/conversation-state#compaction-advanced).
   *
   * @example
   * ```ts
   * const compactedResponse = await client.responses.compact({
   *   model: 'gpt-5.2',
   * });
   * ```
   */
  compact(e, t) {
    return this._client.post("/responses/compact", { body: e, ...t });
  }
}
pt.InputItems = lr;
pt.InputTokens = cr;
let ur = class extends _ {
  /**
   * Download a skill zip bundle by its ID.
   */
  retrieve(e, t) {
    return this._client.get(c`/skills/${e}/content`, {
      ...t,
      headers: p([{ Accept: "application/binary" }, t?.headers]),
      __binaryResponse: !0
    });
  }
};
class hr extends _ {
  /**
   * Download a skill version zip bundle.
   */
  retrieve(e, t, s) {
    const { skill_id: r } = t;
    return this._client.get(c`/skills/${r}/versions/${e}/content`, {
      ...s,
      headers: p([{ Accept: "application/binary" }, s?.headers]),
      __binaryResponse: !0
    });
  }
}
class as extends _ {
  constructor() {
    super(...arguments), this.content = new hr(this._client);
  }
  /**
   * Create a new immutable skill version.
   */
  create(e, t = {}, s) {
    return this._client.post(c`/skills/${e}/versions`, ke({ body: t, ...s }, this._client));
  }
  /**
   * Get a specific skill version.
   */
  retrieve(e, t, s) {
    const { skill_id: r } = t;
    return this._client.get(c`/skills/${r}/versions/${e}`, s);
  }
  /**
   * List skill versions for a skill.
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/skills/${e}/versions`, $, {
      query: t,
      ...s
    });
  }
  /**
   * Delete a skill version.
   */
  delete(e, t, s) {
    const { skill_id: r } = t;
    return this._client.delete(c`/skills/${r}/versions/${e}`, s);
  }
}
as.Content = hr;
class mt extends _ {
  constructor() {
    super(...arguments), this.content = new ur(this._client), this.versions = new as(this._client);
  }
  /**
   * Create a new skill.
   */
  create(e = {}, t) {
    return this._client.post("/skills", ke({ body: e, ...t }, this._client));
  }
  /**
   * Get a skill by its ID.
   */
  retrieve(e, t) {
    return this._client.get(c`/skills/${e}`, t);
  }
  /**
   * Update the default version pointer for a skill.
   */
  update(e, t, s) {
    return this._client.post(c`/skills/${e}`, { body: t, ...s });
  }
  /**
   * List all skills for the current project.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/skills", $, { query: e, ...t });
  }
  /**
   * Delete a skill by its ID.
   */
  delete(e, t) {
    return this._client.delete(c`/skills/${e}`, t);
  }
}
mt.Content = ur;
mt.Versions = as;
class dr extends _ {
  /**
   * Adds a
   * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
   * A Part represents a chunk of bytes from the file you are trying to upload.
   *
   * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
   * maximum of 8 GB.
   *
   * It is possible to add multiple Parts in parallel. You can decide the intended
   * order of the Parts when you
   * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
   */
  create(e, t, s) {
    return this._client.post(c`/uploads/${e}/parts`, fe({ body: t, ...s }, this._client));
  }
}
class os extends _ {
  constructor() {
    super(...arguments), this.parts = new dr(this._client);
  }
  /**
   * Creates an intermediate
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
   * that you can add
   * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
   * Currently, an Upload can accept at most 8 GB in total and expires after an hour
   * after you create it.
   *
   * Once you complete the Upload, we will create a
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * contains all the parts you uploaded. This File is usable in the rest of our
   * platform as a regular File object.
   *
   * For certain `purpose` values, the correct `mime_type` must be specified. Please
   * refer to documentation for the
   * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
   *
   * For guidance on the proper filename extensions for each purpose, please follow
   * the documentation on
   * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
   *
   * Returns the Upload object with status `pending`.
   */
  create(e, t) {
    return this._client.post("/uploads", { body: e, ...t });
  }
  /**
   * Cancels the Upload. No Parts may be added after an Upload is cancelled.
   *
   * Returns the Upload object with status `cancelled`.
   */
  cancel(e, t) {
    return this._client.post(c`/uploads/${e}/cancel`, t);
  }
  /**
   * Completes the
   * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
   *
   * Within the returned Upload object, there is a nested
   * [File](https://platform.openai.com/docs/api-reference/files/object) object that
   * is ready to use in the rest of the platform.
   *
   * You can specify the order of the Parts by passing in an ordered list of the Part
   * IDs.
   *
   * The number of bytes uploaded upon completion must match the number of bytes
   * initially specified when creating the Upload object. No Parts may be added after
   * an Upload is completed. Returns the Upload object with status `completed`,
   * including an additional `file` property containing the created usable File
   * object.
   */
  complete(e, t, s) {
    return this._client.post(c`/uploads/${e}/complete`, { body: t, ...s });
  }
}
os.Parts = dr;
const vi = async (n) => {
  const e = await Promise.allSettled(n), t = e.filter((r) => r.status === "rejected");
  if (t.length) {
    for (const r of t)
      console.error(r.reason);
    throw new Error(`${t.length} promise(s) failed - see the above errors`);
  }
  const s = [];
  for (const r of e)
    r.status === "fulfilled" && s.push(r.value);
  return s;
};
class fr extends _ {
  /**
   * Create a vector store file batch.
   */
  create(e, t, s) {
    return this._client.post(c`/vector_stores/${e}/file_batches`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Retrieves a vector store file batch.
   */
  retrieve(e, t, s) {
    const { vector_store_id: r } = t;
    return this._client.get(c`/vector_stores/${r}/file_batches/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Cancel a vector store file batch. This attempts to cancel the processing of
   * files in this batch as soon as possible.
   */
  cancel(e, t, s) {
    const { vector_store_id: r } = t;
    return this._client.post(c`/vector_stores/${r}/file_batches/${e}/cancel`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Create a vector store batch and poll until all files have been processed.
   */
  async createAndPoll(e, t, s) {
    const r = await this.create(e, t);
    return await this.poll(e, r.id, s);
  }
  /**
   * Returns a list of vector store files in a batch.
   */
  listFiles(e, t, s) {
    const { vector_store_id: r, ...i } = t;
    return this._client.getAPIList(c`/vector_stores/${r}/file_batches/${e}/files`, $, { query: i, ...s, headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers]) });
  }
  /**
   * Wait for the given file batch to be processed.
   *
   * Note: this will return even if one of the files failed to process, you need to
   * check batch.file_counts.failed_count to handle this case.
   */
  async poll(e, t, s) {
    const r = p([
      s?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": s?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    for (; ; ) {
      const { data: i, response: a } = await this.retrieve(t, { vector_store_id: e }, {
        ...s,
        headers: r
      }).withResponse();
      switch (i.status) {
        case "in_progress":
          let l = 5e3;
          if (s?.pollIntervalMs)
            l = s.pollIntervalMs;
          else {
            const h = a.headers.get("openai-poll-after-ms");
            if (h) {
              const f = parseInt(h);
              isNaN(f) || (l = f);
            }
          }
          await Oe(l);
          break;
        case "failed":
        case "cancelled":
        case "completed":
          return i;
      }
    }
  }
  /**
   * Uploads the given files concurrently and then creates a vector store file batch.
   *
   * The concurrency limit is configurable using the `maxConcurrency` parameter.
   */
  async uploadAndPoll(e, { files: t, fileIds: s = [] }, r) {
    if (t == null || t.length == 0)
      throw new Error("No `files` provided to process. If you've already uploaded files you should use `.createAndPoll()` instead");
    const i = r?.maxConcurrency ?? 5, a = Math.min(i, t.length), l = this._client, h = t.values(), f = [...s];
    async function m(y) {
      for (let u of y) {
        const A = await l.files.create({ file: u, purpose: "assistants" }, r);
        f.push(A.id);
      }
    }
    const d = Array(a).fill(h).map(m);
    return await vi(d), await this.createAndPoll(e, {
      file_ids: f
    });
  }
}
class pr extends _ {
  /**
   * Create a vector store file by attaching a
   * [File](https://platform.openai.com/docs/api-reference/files) to a
   * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
   */
  create(e, t, s) {
    return this._client.post(c`/vector_stores/${e}/files`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Retrieves a vector store file.
   */
  retrieve(e, t, s) {
    const { vector_store_id: r } = t;
    return this._client.get(c`/vector_stores/${r}/files/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Update attributes on a vector store file.
   */
  update(e, t, s) {
    const { vector_store_id: r, ...i } = t;
    return this._client.post(c`/vector_stores/${r}/files/${e}`, {
      body: i,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of vector store files.
   */
  list(e, t = {}, s) {
    return this._client.getAPIList(c`/vector_stores/${e}/files`, $, {
      query: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Delete a vector store file. This will remove the file from the vector store but
   * the file itself will not be deleted. To delete the file, use the
   * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
   * endpoint.
   */
  delete(e, t, s) {
    const { vector_store_id: r } = t;
    return this._client.delete(c`/vector_stores/${r}/files/${e}`, {
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Attach a file to the given vector store and wait for it to be processed.
   */
  async createAndPoll(e, t, s) {
    const r = await this.create(e, t, s);
    return await this.poll(e, r.id, s);
  }
  /**
   * Wait for the vector store file to finish processing.
   *
   * Note: this will return even if the file failed to process, you need to check
   * file.last_error and file.status to handle these cases
   */
  async poll(e, t, s) {
    const r = p([
      s?.headers,
      {
        "X-Stainless-Poll-Helper": "true",
        "X-Stainless-Custom-Poll-Interval": s?.pollIntervalMs?.toString() ?? void 0
      }
    ]);
    for (; ; ) {
      const i = await this.retrieve(t, {
        vector_store_id: e
      }, { ...s, headers: r }).withResponse(), a = i.data;
      switch (a.status) {
        case "in_progress":
          let l = 5e3;
          if (s?.pollIntervalMs)
            l = s.pollIntervalMs;
          else {
            const h = i.response.headers.get("openai-poll-after-ms");
            if (h) {
              const f = parseInt(h);
              isNaN(f) || (l = f);
            }
          }
          await Oe(l);
          break;
        case "failed":
        case "completed":
          return a;
      }
    }
  }
  /**
   * Upload a file to the `files` API and then attach it to the given vector store.
   *
   * Note the file will be asynchronously processed (you can use the alternative
   * polling helper method to wait for processing to complete).
   */
  async upload(e, t, s) {
    const r = await this._client.files.create({ file: t, purpose: "assistants" }, s);
    return this.create(e, { file_id: r.id }, s);
  }
  /**
   * Add a file to a vector store and poll until processing is complete.
   */
  async uploadAndPoll(e, t, s) {
    const r = await this.upload(e, t, s);
    return await this.poll(e, r.id, s);
  }
  /**
   * Retrieve the parsed contents of a vector store file.
   */
  content(e, t, s) {
    const { vector_store_id: r } = t;
    return this._client.getAPIList(c`/vector_stores/${r}/files/${e}/content`, ct, { ...s, headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers]) });
  }
}
class _t extends _ {
  constructor() {
    super(...arguments), this.files = new pr(this._client), this.fileBatches = new fr(this._client);
  }
  /**
   * Create a vector store.
   */
  create(e, t) {
    return this._client.post("/vector_stores", {
      body: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Retrieves a vector store.
   */
  retrieve(e, t) {
    return this._client.get(c`/vector_stores/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Modifies a vector store.
   */
  update(e, t, s) {
    return this._client.post(c`/vector_stores/${e}`, {
      body: t,
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
  /**
   * Returns a list of vector stores.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/vector_stores", $, {
      query: e,
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Delete a vector store.
   */
  delete(e, t) {
    return this._client.delete(c`/vector_stores/${e}`, {
      ...t,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, t?.headers])
    });
  }
  /**
   * Search a vector store for relevant chunks based on a query and file attributes
   * filter.
   */
  search(e, t, s) {
    return this._client.getAPIList(c`/vector_stores/${e}/search`, ct, {
      body: t,
      method: "post",
      ...s,
      headers: p([{ "OpenAI-Beta": "assistants=v2" }, s?.headers])
    });
  }
}
_t.Files = pr;
_t.FileBatches = fr;
class mr extends _ {
  /**
   * Create a new video generation job from a prompt and optional reference assets.
   */
  create(e, t) {
    return this._client.post("/videos", ke({ body: e, ...t }, this._client));
  }
  /**
   * Fetch the latest metadata for a generated video.
   */
  retrieve(e, t) {
    return this._client.get(c`/videos/${e}`, t);
  }
  /**
   * List recently generated videos for the current project.
   */
  list(e = {}, t) {
    return this._client.getAPIList("/videos", Ye, { query: e, ...t });
  }
  /**
   * Permanently delete a completed or failed video and its stored assets.
   */
  delete(e, t) {
    return this._client.delete(c`/videos/${e}`, t);
  }
  /**
   * Download the generated video bytes or a derived preview asset.
   *
   * Streams the rendered video content for the specified video job.
   */
  downloadContent(e, t = {}, s) {
    return this._client.get(c`/videos/${e}/content`, {
      query: t,
      ...s,
      headers: p([{ Accept: "application/binary" }, s?.headers]),
      __binaryResponse: !0
    });
  }
  /**
   * Create a remix of a completed video using a refreshed prompt.
   */
  remix(e, t, s) {
    return this._client.post(c`/videos/${e}/remix`, ke({ body: t, ...s }, this._client));
  }
}
var he, _r, ze;
class gr extends _ {
  constructor() {
    super(...arguments), he.add(this);
  }
  /**
   * Validates that the given payload was sent by OpenAI and parses the payload.
   */
  async unwrap(e, t, s = this._client.webhookSecret, r = 300) {
    return await this.verifySignature(e, t, s, r), JSON.parse(e);
  }
  /**
   * Validates whether or not the webhook payload was sent by OpenAI.
   *
   * An error will be raised if the webhook payload was not sent by OpenAI.
   *
   * @param payload - The webhook payload
   * @param headers - The webhook headers
   * @param secret - The webhook secret (optional, will use client secret if not provided)
   * @param tolerance - Maximum age of the webhook in seconds (default: 300 = 5 minutes)
   */
  async verifySignature(e, t, s = this._client.webhookSecret, r = 300) {
    if (typeof crypto > "u" || typeof crypto.subtle.importKey != "function" || typeof crypto.subtle.verify != "function")
      throw new Error("Webhook signature verification is only supported when the `crypto` global is defined");
    o(this, he, "m", _r).call(this, s);
    const i = p([t]).values, a = o(this, he, "m", ze).call(this, i, "webhook-signature"), l = o(this, he, "m", ze).call(this, i, "webhook-timestamp"), h = o(this, he, "m", ze).call(this, i, "webhook-id"), f = parseInt(l, 10);
    if (isNaN(f))
      throw new ge("Invalid webhook timestamp format");
    const m = Math.floor(Date.now() / 1e3);
    if (m - f > r)
      throw new ge("Webhook timestamp is too old");
    if (f > m + r)
      throw new ge("Webhook timestamp is too new");
    const d = a.split(" ").map((b) => b.startsWith("v1,") ? b.substring(3) : b), y = s.startsWith("whsec_") ? Buffer.from(s.replace("whsec_", ""), "base64") : Buffer.from(s, "utf-8"), u = h ? `${h}.${l}.${e}` : `${l}.${e}`, A = await crypto.subtle.importKey("raw", y, { name: "HMAC", hash: "SHA-256" }, !1, ["verify"]);
    for (const b of d)
      try {
        const I = Buffer.from(b, "base64");
        if (await crypto.subtle.verify("HMAC", A, I, new TextEncoder().encode(u)))
          return;
      } catch {
        continue;
      }
    throw new ge("The given webhook signature does not match the expected signature");
  }
}
he = /* @__PURE__ */ new WeakSet(), _r = function(e) {
  if (typeof e != "string" || e.length === 0)
    throw new Error("The webhook secret must either be set using the env var, OPENAI_WEBHOOK_SECRET, on the client class, OpenAI({ webhookSecret: '123' }), or passed to this function");
}, ze = function(e, t) {
  if (!e)
    throw new Error("Headers are required");
  const s = e.get(t);
  if (s == null)
    throw new Error(`Missing required header: ${t}`);
  return s;
};
var Bt, ls, Qe, yr;
class x {
  /**
   * API Client for interfacing with the OpenAI API.
   *
   * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
   * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
   * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
   * @param {string | null | undefined} [opts.webhookSecret=process.env['OPENAI_WEBHOOK_SECRET'] ?? null]
   * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL: e = ee("OPENAI_BASE_URL"), apiKey: t = ee("OPENAI_API_KEY"), organization: s = ee("OPENAI_ORG_ID") ?? null, project: r = ee("OPENAI_PROJECT_ID") ?? null, webhookSecret: i = ee("OPENAI_WEBHOOK_SECRET") ?? null, ...a } = {}) {
    if (Bt.add(this), Qe.set(this, void 0), this.completions = new Jn(this), this.chat = new Vt(this), this.embeddings = new Vn(this), this.files = new Qn(this), this.images = new sr(this), this.audio = new Te(this), this.moderations = new rr(this), this.models = new nr(this), this.fineTuning = new me(this), this.graders = new rs(this), this.vectorStores = new _t(this), this.webhooks = new gr(this), this.beta = new pe(this), this.batches = new Ln(this), this.uploads = new os(this), this.responses = new pt(this), this.realtime = new ft(this), this.conversations = new Yt(this), this.evals = new es(this), this.containers = new Gt(this), this.skills = new mt(this), this.videos = new mr(this), t === void 0)
      throw new g("Missing credentials. Please pass an `apiKey`, or set the `OPENAI_API_KEY` environment variable.");
    const l = {
      apiKey: t,
      organization: s,
      project: r,
      webhookSecret: i,
      ...a,
      baseURL: e || "https://api.openai.com/v1"
    };
    if (!l.dangerouslyAllowBrowser && $r())
      throw new g(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety
`);
    this.baseURL = l.baseURL, this.timeout = l.timeout ?? ls.DEFAULT_TIMEOUT, this.logger = l.logger ?? console;
    const h = "warn";
    this.logLevel = h, this.logLevel = Ss(l.logLevel, "ClientOptions.logLevel", this) ?? Ss(ee("OPENAI_LOG"), "process.env['OPENAI_LOG']", this) ?? h, this.fetchOptions = l.fetchOptions, this.maxRetries = l.maxRetries ?? 2, this.fetch = l.fetch ?? Or(), S(this, Qe, Tr), this._options = l, this.apiKey = typeof t == "string" ? t : "Missing Key", this.organization = s, this.project = r, this.webhookSecret = i;
  }
  /**
   * Create a new client instance re-using the same options given to the current client with optional overriding.
   */
  withOptions(e) {
    return new this.constructor({
      ...this._options,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
      logger: this.logger,
      logLevel: this.logLevel,
      fetch: this.fetch,
      fetchOptions: this.fetchOptions,
      apiKey: this.apiKey,
      organization: this.organization,
      project: this.project,
      webhookSecret: this.webhookSecret,
      ...e
    });
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values: e, nulls: t }) {
  }
  async authHeaders(e) {
    return p([{ Authorization: `Bearer ${this.apiKey}` }]);
  }
  stringifyQuery(e) {
    return Dr(e, { arrayFormat: "brackets" });
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${ce}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${Bs()}`;
  }
  makeStatusError(e, t, s, r) {
    return D.generate(e, t, s, r);
  }
  async _callApiKey() {
    const e = this._options.apiKey;
    if (typeof e != "function")
      return !1;
    let t;
    try {
      t = await e();
    } catch (s) {
      throw s instanceof g ? s : new g(
        `Failed to get token from 'apiKey' function: ${s.message}`,
        // @ts-ignore
        { cause: s }
      );
    }
    if (typeof t != "string" || !t)
      throw new g(`Expected 'apiKey' function argument to return a string but it returned ${t}`);
    return this.apiKey = t, !0;
  }
  buildURL(e, t, s) {
    const r = !o(this, Bt, "m", yr).call(this) && s || this.baseURL, i = Sr(e) ? new URL(e) : new URL(r + (r.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), a = this.defaultQuery();
    return xr(a) || (t = { ...a, ...t }), typeof t == "object" && t && !Array.isArray(t) && (i.search = this.stringifyQuery(t)), i.toString();
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(e) {
    await this._callApiKey();
  }
  /**
   * Used as a callback for mutating the given `RequestInit` object.
   *
   * This is useful for cases where you want to add certain headers based off of
   * the request properties, e.g. `method` or `url`.
   */
  async prepareRequest(e, { url: t, options: s }) {
  }
  get(e, t) {
    return this.methodRequest("get", e, t);
  }
  post(e, t) {
    return this.methodRequest("post", e, t);
  }
  patch(e, t) {
    return this.methodRequest("patch", e, t);
  }
  put(e, t) {
    return this.methodRequest("put", e, t);
  }
  delete(e, t) {
    return this.methodRequest("delete", e, t);
  }
  methodRequest(e, t, s) {
    return this.request(Promise.resolve(s).then((r) => ({ method: e, path: t, ...r })));
  }
  request(e, t = null) {
    return new lt(this, this.makeRequest(e, t, void 0));
  }
  async makeRequest(e, t, s) {
    const r = await e, i = r.maxRetries ?? this.maxRetries;
    t == null && (t = i), await this.prepareOptions(r);
    const { req: a, url: l, timeout: h } = await this.buildRequest(r, {
      retryCount: i - t
    });
    await this.prepareRequest(a, { url: l, options: r });
    const f = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), m = s === void 0 ? "" : `, retryOf: ${s}`, d = Date.now();
    if (L(this).debug(`[${f}] sending request`, ne({
      retryOfRequestLogID: s,
      method: r.method,
      url: l,
      options: r,
      headers: a.headers
    })), r.signal?.aborted)
      throw new K();
    const y = new AbortController(), u = await this.fetchWithTimeout(l, a, h, y).catch($t), A = Date.now();
    if (u instanceof globalThis.Error) {
      const v = `retrying, ${t} attempts remaining`;
      if (r.signal?.aborted)
        throw new K();
      const w = Rt(u) || /timed? ?out/i.test(String(u) + ("cause" in u ? String(u.cause) : ""));
      if (t)
        return L(this).info(`[${f}] connection ${w ? "timed out" : "failed"} - ${v}`), L(this).debug(`[${f}] connection ${w ? "timed out" : "failed"} (${v})`, ne({
          retryOfRequestLogID: s,
          url: l,
          durationMs: A - d,
          message: u.message
        })), this.retryRequest(r, t, s ?? f);
      throw L(this).info(`[${f}] connection ${w ? "timed out" : "failed"} - error; no more retries left`), L(this).debug(`[${f}] connection ${w ? "timed out" : "failed"} (error; no more retries left)`, ne({
        retryOfRequestLogID: s,
        url: l,
        durationMs: A - d,
        message: u.message
      })), w ? new Dt() : new at({ cause: u });
    }
    const b = [...u.headers.entries()].filter(([v]) => v === "x-request-id").map(([v, w]) => ", " + v + ": " + JSON.stringify(w)).join(""), I = `[${f}${m}${b}] ${a.method} ${l} ${u.ok ? "succeeded" : "failed"} with status ${u.status} in ${A - d}ms`;
    if (!u.ok) {
      const v = await this.shouldRetry(u);
      if (t && v) {
        const C = `retrying, ${t} attempts remaining`;
        return await Pr(u.body), L(this).info(`${I} - ${C}`), L(this).debug(`[${f}] response error (${C})`, ne({
          retryOfRequestLogID: s,
          url: u.url,
          status: u.status,
          headers: u.headers,
          durationMs: A - d
        })), this.retryRequest(r, t, s ?? f, u.headers);
      }
      const w = v ? "error; no more retries left" : "error; not retryable";
      L(this).info(`${I} - ${w}`);
      const T = await u.text().catch((C) => $t(C).message), R = Rr(T), X = R ? void 0 : T;
      throw L(this).debug(`[${f}] response error (${w})`, ne({
        retryOfRequestLogID: s,
        url: u.url,
        status: u.status,
        headers: u.headers,
        message: X,
        durationMs: Date.now() - d
      })), this.makeStatusError(u.status, R, X, u.headers);
    }
    return L(this).info(I), L(this).debug(`[${f}] response start`, ne({
      retryOfRequestLogID: s,
      url: u.url,
      status: u.status,
      headers: u.headers,
      durationMs: A - d
    })), { response: u, options: r, controller: y, requestLogID: f, retryOfRequestLogID: s, startTime: d };
  }
  getAPIList(e, t, s) {
    return this.requestAPIList(t, s && "then" in s ? s.then((r) => ({ method: "get", path: e, ...r })) : { method: "get", path: e, ...s });
  }
  requestAPIList(e, t) {
    const s = this.makeRequest(t, null, void 0);
    return new Vr(this, s, e);
  }
  async fetchWithTimeout(e, t, s, r) {
    const { signal: i, method: a, ...l } = t || {}, h = this._makeAbort(r);
    i && i.addEventListener("abort", h, { once: !0 });
    const f = setTimeout(h, s), m = globalThis.ReadableStream && l.body instanceof globalThis.ReadableStream || typeof l.body == "object" && l.body !== null && Symbol.asyncIterator in l.body, d = {
      signal: r.signal,
      ...m ? { duplex: "half" } : {},
      method: "GET",
      ...l
    };
    a && (d.method = a.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, d);
    } finally {
      clearTimeout(f);
    }
  }
  async shouldRetry(e) {
    const t = e.headers.get("x-should-retry");
    return t === "true" ? !0 : t === "false" ? !1 : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  }
  async retryRequest(e, t, s, r) {
    let i;
    const a = r?.get("retry-after-ms");
    if (a) {
      const h = parseFloat(a);
      Number.isNaN(h) || (i = h);
    }
    const l = r?.get("retry-after");
    if (l && !i) {
      const h = parseFloat(l);
      Number.isNaN(h) ? i = Date.parse(l) - Date.now() : i = h * 1e3;
    }
    if (!(i && 0 <= i && i < 60 * 1e3)) {
      const h = e.maxRetries ?? this.maxRetries;
      i = this.calculateDefaultRetryTimeoutMillis(t, h);
    }
    return await Oe(i), this.makeRequest(e, t - 1, s);
  }
  calculateDefaultRetryTimeoutMillis(e, t) {
    const i = t - e, a = Math.min(0.5 * Math.pow(2, i), 8), l = 1 - Math.random() * 0.25;
    return a * l * 1e3;
  }
  async buildRequest(e, { retryCount: t = 0 } = {}) {
    const s = { ...e }, { method: r, path: i, query: a, defaultBaseURL: l } = s, h = this.buildURL(i, a, l);
    "timeout" in s && vr("timeout", s.timeout), s.timeout = s.timeout ?? this.timeout;
    const { bodyHeaders: f, body: m } = this.buildBody({ options: s }), d = await this.buildHeaders({ options: e, method: r, bodyHeaders: f, retryCount: t });
    return { req: {
      method: r,
      headers: d,
      ...s.signal && { signal: s.signal },
      ...globalThis.ReadableStream && m instanceof globalThis.ReadableStream && { duplex: "half" },
      ...m && { body: m },
      ...this.fetchOptions ?? {},
      ...s.fetchOptions ?? {}
    }, url: h, timeout: s.timeout };
  }
  async buildHeaders({ options: e, method: t, bodyHeaders: s, retryCount: r }) {
    let i = {};
    this.idempotencyHeader && t !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), i[this.idempotencyHeader] = e.idempotencyKey);
    const a = p([
      i,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(r),
        ...e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {},
        ...Er(),
        "OpenAI-Organization": this.organization,
        "OpenAI-Project": this.project
      },
      await this.authHeaders(e),
      this._options.defaultHeaders,
      s,
      e.headers
    ]);
    return this.validateHeaders(a), a.values;
  }
  _makeAbort(e) {
    return () => e.abort();
  }
  buildBody({ options: { body: e, headers: t } }) {
    if (!e)
      return { bodyHeaders: void 0, body: void 0 };
    const s = p([t]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      s.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: Gs(e) } : typeof e == "object" && s.values.get("content-type") === "application/x-www-form-urlencoded" ? {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(e)
      } : o(this, Qe, "f").call(this, { body: e, headers: s })
    );
  }
}
ls = x, Qe = /* @__PURE__ */ new WeakMap(), Bt = /* @__PURE__ */ new WeakSet(), yr = function() {
  return this.baseURL !== "https://api.openai.com/v1";
};
x.OpenAI = ls;
x.DEFAULT_TIMEOUT = 6e5;
x.OpenAIError = g;
x.APIError = D;
x.APIConnectionError = at;
x.APIConnectionTimeoutError = Dt;
x.APIUserAbortError = K;
x.NotFoundError = qs;
x.ConflictError = js;
x.RateLimitError = Js;
x.BadRequestError = Ds;
x.AuthenticationError = Us;
x.InternalServerError = Xs;
x.PermissionDeniedError = Ws;
x.UnprocessableEntityError = Hs;
x.InvalidWebhookSignatureError = ge;
x.toFile = Zr;
x.Completions = Jn;
x.Chat = Vt;
x.Embeddings = Vn;
x.Files = Qn;
x.Images = sr;
x.Audio = Te;
x.Moderations = rr;
x.Models = nr;
x.FineTuning = me;
x.Graders = rs;
x.VectorStores = _t;
x.Webhooks = gr;
x.Beta = pe;
x.Batches = Ln;
x.Uploads = os;
x.Responses = pt;
x.Realtime = ft;
x.Conversations = Yt;
x.Evals = es;
x.Containers = Gt;
x.Skills = mt;
x.Videos = mr;
class Bi extends x {
  /**
   * API Client for interfacing with the Azure OpenAI API.
   *
   * @param {string | undefined} [opts.apiVersion=process.env['OPENAI_API_VERSION'] ?? undefined]
   * @param {string | undefined} [opts.endpoint=process.env['AZURE_OPENAI_ENDPOINT'] ?? undefined] - Your Azure endpoint, including the resource, e.g. `https://example-resource.azure.openai.com/`
   * @param {string | undefined} [opts.apiKey=process.env['AZURE_OPENAI_API_KEY'] ?? undefined]
   * @param {string | undefined} opts.deployment - A model deployment, if given, sets the base client URL to include `/deployments/{deployment}`.
   * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
   * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL']] - Sets the base URL for the API, e.g. `https://example-resource.azure.openai.com/openai/`.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL: e = ee("OPENAI_BASE_URL"), apiKey: t = ee("AZURE_OPENAI_API_KEY"), apiVersion: s = ee("OPENAI_API_VERSION"), endpoint: r, deployment: i, azureADTokenProvider: a, dangerouslyAllowBrowser: l, ...h } = {}) {
    if (!s)
      throw new g("The OPENAI_API_VERSION environment variable is missing or empty; either provide it, or instantiate the AzureOpenAI client with an apiVersion option, like new AzureOpenAI({ apiVersion: 'My API Version' }).");
    if (typeof a == "function" && (l = !0), !a && !t)
      throw new g("Missing credentials. Please pass one of `apiKey` and `azureADTokenProvider`, or set the `AZURE_OPENAI_API_KEY` environment variable.");
    if (a && t)
      throw new g("The `apiKey` and `azureADTokenProvider` arguments are mutually exclusive; only one can be passed at a time.");
    if (h.defaultQuery = { ...h.defaultQuery, "api-version": s }, e) {
      if (r)
        throw new g("baseURL and endpoint are mutually exclusive");
    } else {
      if (r || (r = process.env.AZURE_OPENAI_ENDPOINT), !r)
        throw new g("Must provide one of the `baseURL` or `endpoint` arguments, or the `AZURE_OPENAI_ENDPOINT` environment variable");
      e = `${r}/openai`;
    }
    super({
      apiKey: a ?? t,
      baseURL: e,
      ...h,
      ...l !== void 0 ? { dangerouslyAllowBrowser: l } : {}
    }), this.apiVersion = "", this.apiVersion = s, this.deploymentName = i;
  }
  async buildRequest(e, t = {}) {
    if (Ri.has(e.path) && e.method === "post" && e.body !== void 0) {
      if (!We(e.body))
        throw new Error("Expected request body to be an object");
      const s = this.deploymentName || e.body.model || e.__metadata?.model;
      s !== void 0 && !this.baseURL.includes("/deployments") && (e.path = `/deployments/${s}${e.path}`);
    }
    return super.buildRequest(e, t);
  }
  async authHeaders(e) {
    return typeof this._options.apiKey == "string" ? p([{ "api-key": this.apiKey }]) : super.authHeaders(e);
  }
}
const Ri = /* @__PURE__ */ new Set([
  "/completions",
  "/chat/completions",
  "/embeddings",
  "/audio/transcriptions",
  "/audio/translations",
  "/audio/speech",
  "/images/generations",
  "/batches",
  "/images/edits"
]);
export {
  at as APIConnectionError,
  Dt as APIConnectionTimeoutError,
  D as APIError,
  lt as APIPromise,
  K as APIUserAbortError,
  Us as AuthenticationError,
  Bi as AzureOpenAI,
  Ds as BadRequestError,
  js as ConflictError,
  Xs as InternalServerError,
  ge as InvalidWebhookSignatureError,
  qs as NotFoundError,
  x as OpenAI,
  g as OpenAIError,
  Vr as PagePromise,
  Ws as PermissionDeniedError,
  Js as RateLimitError,
  Hs as UnprocessableEntityError,
  x as default,
  Zr as toFile
};
