import { readFile as Ds, mkdir as Ws, writeFile as Hs } from "node:fs/promises";
import { existsSync as Yt } from "node:fs";
import Qt from "node:path";
import { homedir as Js } from "node:os";
import { Worker as Zt, isMainThread as es, parentPort as H } from "node:worker_threads";
import { fileURLToPath as ts } from "node:url";
function d(r, e, t, s, n) {
  if (typeof e == "function" ? r !== e || !0 : !e.has(r))
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return e.set(r, t), t;
}
function a(r, e, t, s) {
  if (t === "a" && !s)
    throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? r !== e || !s : !e.has(r))
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return t === "m" ? s : t === "a" ? s.call(r) : s ? s.value : e.get(r);
}
let ss = function() {
  const { crypto: r } = globalThis;
  if (r?.randomUUID)
    return ss = r.randomUUID.bind(r), r.randomUUID();
  const e = new Uint8Array(1), t = r ? () => r.getRandomValues(e)[0] : () => Math.random() * 255 & 255;
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (s) => (+s ^ t() & 15 >> +s / 4).toString(16));
};
function ye(r) {
  return typeof r == "object" && r !== null && // Spec-compliant fetch implementations
  ("name" in r && r.name === "AbortError" || // Expo fetch
  "message" in r && String(r.message).includes("FetchRequestCanceledException"));
}
const ct = (r) => {
  if (r instanceof Error)
    return r;
  if (typeof r == "object" && r !== null) {
    try {
      if (Object.prototype.toString.call(r) === "[object Error]") {
        const e = new Error(r.message, r.cause ? { cause: r.cause } : {});
        return r.stack && (e.stack = r.stack), r.cause && !e.cause && (e.cause = r.cause), r.name && (e.name = r.name), e;
      }
    } catch {
    }
    try {
      return new Error(JSON.stringify(r));
    } catch {
    }
  }
  return new Error(r);
};
class p extends Error {
}
class S extends p {
  constructor(e, t, s, n) {
    super(`${S.makeMessage(e, t, s)}`), this.status = e, this.headers = n, this.requestID = n?.get("request-id"), this.error = t;
  }
  static makeMessage(e, t, s) {
    const n = t?.message ? typeof t.message == "string" ? t.message : JSON.stringify(t.message) : t ? JSON.stringify(t) : s;
    return e && n ? `${e} ${n}` : e ? `${e} status code (no body)` : n || "(no status code or body)";
  }
  static generate(e, t, s, n) {
    if (!e || !n)
      return new Ke({ message: s, cause: ct(t) });
    const i = t;
    return e === 400 ? new ns(e, i, s, n) : e === 401 ? new is(e, i, s, n) : e === 403 ? new as(e, i, s, n) : e === 404 ? new os(e, i, s, n) : e === 409 ? new cs(e, i, s, n) : e === 422 ? new ls(e, i, s, n) : e === 429 ? new us(e, i, s, n) : e >= 500 ? new ds(e, i, s, n) : new S(e, i, s, n);
  }
}
class E extends S {
  constructor({ message: e } = {}) {
    super(void 0, void 0, e || "Request was aborted.", void 0);
  }
}
class Ke extends S {
  constructor({ message: e, cause: t }) {
    super(void 0, void 0, e || "Connection error.", void 0), t && (this.cause = t);
  }
}
class rs extends Ke {
  constructor({ message: e } = {}) {
    super({ message: e ?? "Request timed out." });
  }
}
class ns extends S {
}
class is extends S {
}
class as extends S {
}
class os extends S {
}
class cs extends S {
}
class ls extends S {
}
class us extends S {
}
class ds extends S {
}
const Xs = /^[a-z][a-z0-9+.-]*:/i, Ks = (r) => Xs.test(r);
let lt = (r) => (lt = Array.isArray, lt(r)), Tt = lt;
function ut(r) {
  return typeof r != "object" ? {} : r ?? {};
}
function Vs(r) {
  if (!r)
    return !0;
  for (const e in r)
    return !1;
  return !0;
}
function zs(r, e) {
  return Object.prototype.hasOwnProperty.call(r, e);
}
const Gs = (r, e) => {
  if (typeof e != "number" || !Number.isInteger(e))
    throw new p(`${r} must be an integer`);
  if (e < 0)
    throw new p(`${r} must be a positive integer`);
  return e;
}, hs = (r) => {
  try {
    return JSON.parse(r);
  } catch {
    return;
  }
}, Ys = (r) => new Promise((e) => setTimeout(e, r)), V = "0.78.0", Qs = () => (
  // @ts-ignore
  typeof window < "u" && // @ts-ignore
  typeof window.document < "u" && // @ts-ignore
  typeof navigator < "u"
);
function Zs() {
  return typeof Deno < "u" && Deno.build != null ? "deno" : typeof EdgeRuntime < "u" ? "edge" : Object.prototype.toString.call(typeof globalThis.process < "u" ? globalThis.process : 0) === "[object process]" ? "node" : "unknown";
}
const er = () => {
  const r = Zs();
  if (r === "deno")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": vt(Deno.build.os),
      "X-Stainless-Arch": Rt(Deno.build.arch),
      "X-Stainless-Runtime": "deno",
      "X-Stainless-Runtime-Version": typeof Deno.version == "string" ? Deno.version : Deno.version?.deno ?? "unknown"
    };
  if (typeof EdgeRuntime < "u")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": "Unknown",
      "X-Stainless-Arch": `other:${EdgeRuntime}`,
      "X-Stainless-Runtime": "edge",
      "X-Stainless-Runtime-Version": globalThis.process.version
    };
  if (r === "node")
    return {
      "X-Stainless-Lang": "js",
      "X-Stainless-Package-Version": V,
      "X-Stainless-OS": vt(globalThis.process.platform ?? "unknown"),
      "X-Stainless-Arch": Rt(globalThis.process.arch ?? "unknown"),
      "X-Stainless-Runtime": "node",
      "X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
    };
  const e = tr();
  return e ? {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": V,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": `browser:${e.browser}`,
    "X-Stainless-Runtime-Version": e.version
  } : {
    "X-Stainless-Lang": "js",
    "X-Stainless-Package-Version": V,
    "X-Stainless-OS": "Unknown",
    "X-Stainless-Arch": "unknown",
    "X-Stainless-Runtime": "unknown",
    "X-Stainless-Runtime-Version": "unknown"
  };
};
function tr() {
  if (typeof navigator > "u" || !navigator)
    return null;
  const r = [
    { key: "edge", pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "ie", pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "chrome", pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "firefox", pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
    { key: "safari", pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ }
  ];
  for (const { key: e, pattern: t } of r) {
    const s = t.exec(navigator.userAgent);
    if (s) {
      const n = s[1] || 0, i = s[2] || 0, o = s[3] || 0;
      return { browser: e, version: `${n}.${i}.${o}` };
    }
  }
  return null;
}
const Rt = (r) => r === "x32" ? "x32" : r === "x86_64" || r === "x64" ? "x64" : r === "arm" ? "arm" : r === "aarch64" || r === "arm64" ? "arm64" : r ? `other:${r}` : "unknown", vt = (r) => (r = r.toLowerCase(), r.includes("ios") ? "iOS" : r === "android" ? "Android" : r === "darwin" ? "MacOS" : r === "win32" ? "Windows" : r === "freebsd" ? "FreeBSD" : r === "openbsd" ? "OpenBSD" : r === "linux" ? "Linux" : r ? `Other:${r}` : "Unknown");
let Pt;
const sr = () => Pt ?? (Pt = er());
function rr() {
  if (typeof fetch < "u")
    return fetch;
  throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new Anthropic({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function fs(...r) {
  const e = globalThis.ReadableStream;
  if (typeof e > "u")
    throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
  return new e(...r);
}
function ps(r) {
  let e = Symbol.asyncIterator in r ? r[Symbol.asyncIterator]() : r[Symbol.iterator]();
  return fs({
    start() {
    },
    async pull(t) {
      const { done: s, value: n } = await e.next();
      s ? t.close() : t.enqueue(n);
    },
    async cancel() {
      await e.return?.();
    }
  });
}
function gt(r) {
  if (r[Symbol.asyncIterator])
    return r;
  const e = r.getReader();
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
async function nr(r) {
  if (r === null || typeof r != "object")
    return;
  if (r[Symbol.asyncIterator]) {
    await r[Symbol.asyncIterator]().return?.();
    return;
  }
  const e = r.getReader(), t = e.cancel();
  e.releaseLock(), await t;
}
const ir = ({ headers: r, body: e }) => ({
  bodyHeaders: {
    "content-type": "application/json"
  },
  body: JSON.stringify(e)
});
function ar(r) {
  let e = 0;
  for (const n of r)
    e += n.length;
  const t = new Uint8Array(e);
  let s = 0;
  for (const n of r)
    t.set(n, s), s += n.length;
  return t;
}
let Et;
function mt(r) {
  let e;
  return (Et ?? (e = new globalThis.TextEncoder(), Et = e.encode.bind(e)))(r);
}
let At;
function It(r) {
  let e;
  return (At ?? (e = new globalThis.TextDecoder(), At = e.decode.bind(e)))(r);
}
var M, T;
class _e {
  constructor() {
    M.set(this, void 0), T.set(this, void 0), d(this, M, new Uint8Array()), d(this, T, null);
  }
  decode(e) {
    if (e == null)
      return [];
    const t = e instanceof ArrayBuffer ? new Uint8Array(e) : typeof e == "string" ? mt(e) : e;
    d(this, M, ar([a(this, M, "f"), t]));
    const s = [];
    let n;
    for (; (n = or(a(this, M, "f"), a(this, T, "f"))) != null; ) {
      if (n.carriage && a(this, T, "f") == null) {
        d(this, T, n.index);
        continue;
      }
      if (a(this, T, "f") != null && (n.index !== a(this, T, "f") + 1 || n.carriage)) {
        s.push(It(a(this, M, "f").subarray(0, a(this, T, "f") - 1))), d(this, M, a(this, M, "f").subarray(a(this, T, "f"))), d(this, T, null);
        continue;
      }
      const i = a(this, T, "f") !== null ? n.preceding - 1 : n.preceding, o = It(a(this, M, "f").subarray(0, i));
      s.push(o), d(this, M, a(this, M, "f").subarray(n.index)), d(this, T, null);
    }
    return s;
  }
  flush() {
    return a(this, M, "f").length ? this.decode(`
`) : [];
  }
}
M = /* @__PURE__ */ new WeakMap(), T = /* @__PURE__ */ new WeakMap();
_e.NEWLINE_CHARS = /* @__PURE__ */ new Set([`
`, "\r"]);
_e.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
function or(r, e) {
  for (let n = e ?? 0; n < r.length; n++) {
    if (r[n] === 10)
      return { preceding: n, index: n + 1, carriage: !1 };
    if (r[n] === 13)
      return { preceding: n, index: n + 1, carriage: !0 };
  }
  return null;
}
function cr(r) {
  for (let s = 0; s < r.length - 1; s++) {
    if (r[s] === 10 && r[s + 1] === 10 || r[s] === 13 && r[s + 1] === 13)
      return s + 2;
    if (r[s] === 13 && r[s + 1] === 10 && s + 3 < r.length && r[s + 2] === 13 && r[s + 3] === 10)
      return s + 4;
  }
  return -1;
}
const We = {
  off: 0,
  error: 200,
  warn: 300,
  info: 400,
  debug: 500
}, Ot = (r, e, t) => {
  if (r) {
    if (zs(We, r))
      return r;
    k(t).warn(`${e} was set to ${JSON.stringify(r)}, expected one of ${JSON.stringify(Object.keys(We))}`);
  }
};
function pe() {
}
function xe(r, e, t) {
  return !e || We[r] > We[t] ? pe : e[r].bind(e);
}
const lr = {
  error: pe,
  warn: pe,
  info: pe,
  debug: pe
};
let Nt = /* @__PURE__ */ new WeakMap();
function k(r) {
  const e = r.logger, t = r.logLevel ?? "off";
  if (!e)
    return lr;
  const s = Nt.get(e);
  if (s && s[0] === t)
    return s[1];
  const n = {
    error: xe("error", e, t),
    warn: xe("warn", e, t),
    info: xe("info", e, t),
    debug: xe("debug", e, t)
  };
  return Nt.set(e, [t, n]), n;
}
const W = (r) => (r.options && (r.options = { ...r.options }, delete r.options.headers), r.headers && (r.headers = Object.fromEntries((r.headers instanceof Headers ? [...r.headers] : Object.entries(r.headers)).map(([e, t]) => [
  e,
  e.toLowerCase() === "x-api-key" || e.toLowerCase() === "authorization" || e.toLowerCase() === "cookie" || e.toLowerCase() === "set-cookie" ? "***" : t
]))), "retryOfRequestLogID" in r && (r.retryOfRequestLogID && (r.retryOf = r.retryOfRequestLogID), delete r.retryOfRequestLogID), r);
var Q;
class O {
  constructor(e, t, s) {
    this.iterator = e, Q.set(this, void 0), this.controller = t, d(this, Q, s);
  }
  static fromSSEResponse(e, t, s) {
    let n = !1;
    const i = s ? k(s) : console;
    async function* o() {
      if (n)
        throw new p("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      n = !0;
      let c = !1;
      try {
        for await (const u of ur(e, t)) {
          if (u.event === "completion")
            try {
              yield JSON.parse(u.data);
            } catch (l) {
              throw i.error("Could not parse message into JSON:", u.data), i.error("From chunk:", u.raw), l;
            }
          if (u.event === "message_start" || u.event === "message_delta" || u.event === "message_stop" || u.event === "content_block_start" || u.event === "content_block_delta" || u.event === "content_block_stop")
            try {
              yield JSON.parse(u.data);
            } catch (l) {
              throw i.error("Could not parse message into JSON:", u.data), i.error("From chunk:", u.raw), l;
            }
          if (u.event !== "ping" && u.event === "error")
            throw new S(void 0, hs(u.data) ?? u.data, void 0, e.headers);
        }
        c = !0;
      } catch (u) {
        if (ye(u))
          return;
        throw u;
      } finally {
        c || t.abort();
      }
    }
    return new O(o, t, s);
  }
  /**
   * Generates a Stream from a newline-separated ReadableStream
   * where each item is a JSON value.
   */
  static fromReadableStream(e, t, s) {
    let n = !1;
    async function* i() {
      const c = new _e(), u = gt(e);
      for await (const l of u)
        for (const h of c.decode(l))
          yield h;
      for (const l of c.flush())
        yield l;
    }
    async function* o() {
      if (n)
        throw new p("Cannot iterate over a consumed stream, use `.tee()` to split the stream.");
      n = !0;
      let c = !1;
      try {
        for await (const u of i())
          c || u && (yield JSON.parse(u));
        c = !0;
      } catch (u) {
        if (ye(u))
          return;
        throw u;
      } finally {
        c || t.abort();
      }
    }
    return new O(o, t, s);
  }
  [(Q = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
    return this.iterator();
  }
  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee() {
    const e = [], t = [], s = this.iterator(), n = (i) => ({
      next: () => {
        if (i.length === 0) {
          const o = s.next();
          e.push(o), t.push(o);
        }
        return i.shift();
      }
    });
    return [
      new O(() => n(e), this.controller, a(this, Q, "f")),
      new O(() => n(t), this.controller, a(this, Q, "f"))
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
    return fs({
      async start() {
        t = e[Symbol.asyncIterator]();
      },
      async pull(s) {
        try {
          const { value: n, done: i } = await t.next();
          if (i)
            return s.close();
          const o = mt(JSON.stringify(n) + `
`);
          s.enqueue(o);
        } catch (n) {
          s.error(n);
        }
      },
      async cancel() {
        await t.return?.();
      }
    });
  }
}
async function* ur(r, e) {
  if (!r.body)
    throw e.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new p("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new p("Attempted to iterate over a response with no body");
  const t = new hr(), s = new _e(), n = gt(r.body);
  for await (const i of dr(n))
    for (const o of s.decode(i)) {
      const c = t.decode(o);
      c && (yield c);
    }
  for (const i of s.flush()) {
    const o = t.decode(i);
    o && (yield o);
  }
}
async function* dr(r) {
  let e = new Uint8Array();
  for await (const t of r) {
    if (t == null)
      continue;
    const s = t instanceof ArrayBuffer ? new Uint8Array(t) : typeof t == "string" ? mt(t) : t;
    let n = new Uint8Array(e.length + s.length);
    n.set(e), n.set(s, e.length), e = n;
    let i;
    for (; (i = cr(e)) !== -1; )
      yield e.slice(0, i), e = e.slice(i);
  }
  e.length > 0 && (yield e);
}
class hr {
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
    let [t, s, n] = fr(e, ":");
    return n.startsWith(" ") && (n = n.substring(1)), t === "event" ? this.event = n : t === "data" && this.data.push(n), null;
  }
}
function fr(r, e) {
  const t = r.indexOf(e);
  return t !== -1 ? [r.substring(0, t), e, r.substring(t + e.length)] : [r, "", ""];
}
async function gs(r, e) {
  const { response: t, requestLogID: s, retryOfRequestLogID: n, startTime: i } = e, o = await (async () => {
    if (e.options.stream)
      return k(r).debug("response", t.status, t.url, t.headers, t.body), e.options.__streamClass ? e.options.__streamClass.fromSSEResponse(t, e.controller) : O.fromSSEResponse(t, e.controller);
    if (t.status === 204)
      return null;
    if (e.options.__binaryResponse)
      return t;
    const u = t.headers.get("content-type")?.split(";")[0]?.trim();
    if (u?.includes("application/json") || u?.endsWith("+json")) {
      if (t.headers.get("content-length") === "0")
        return;
      const w = await t.json();
      return ms(w, t);
    }
    return await t.text();
  })();
  return k(r).debug(`[${s}] response parsed`, W({
    retryOfRequestLogID: n,
    url: t.url,
    status: t.status,
    body: o,
    durationMs: Date.now() - i
  })), o;
}
function ms(r, e) {
  return !r || typeof r != "object" || Array.isArray(r) ? r : Object.defineProperty(r, "_request_id", {
    value: e.headers.get("request-id"),
    enumerable: !1
  });
}
var ge;
class Ve extends Promise {
  constructor(e, t, s = gs) {
    super((n) => {
      n(null);
    }), this.responsePromise = t, this.parseResponse = s, ge.set(this, void 0), d(this, ge, e);
  }
  _thenUnwrap(e) {
    return new Ve(a(this, ge, "f"), this.responsePromise, async (t, s) => ms(e(await this.parseResponse(t, s), s), s.response));
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
   * returned via the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
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
    return { data: e, response: t, request_id: t.headers.get("request-id") };
  }
  parse() {
    return this.parsedPromise || (this.parsedPromise = this.responsePromise.then((e) => this.parseResponse(a(this, ge, "f"), e))), this.parsedPromise;
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
ge = /* @__PURE__ */ new WeakMap();
var Me;
class ys {
  constructor(e, t, s, n) {
    Me.set(this, void 0), d(this, Me, e), this.options = n, this.response = t, this.body = s;
  }
  hasNextPage() {
    return this.getPaginatedItems().length ? this.nextPageRequestOptions() != null : !1;
  }
  async getNextPage() {
    const e = this.nextPageRequestOptions();
    if (!e)
      throw new p("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
    return await a(this, Me, "f").requestAPIList(this.constructor, e);
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
class pr extends Ve {
  constructor(e, t, s) {
    super(e, t, async (n, i) => new s(n, i.response, await gs(n, i), i.options));
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
class be extends ys {
  constructor(e, t, s, n) {
    super(e, t, s, n), this.data = s.data || [], this.has_more = s.has_more || !1, this.first_id = s.first_id || null, this.last_id = s.last_id || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    return this.has_more === !1 ? !1 : super.hasNextPage();
  }
  nextPageRequestOptions() {
    if (this.options.query?.before_id) {
      const t = this.first_id;
      return t ? {
        ...this.options,
        query: {
          ...ut(this.options.query),
          before_id: t
        }
      } : null;
    }
    const e = this.last_id;
    return e ? {
      ...this.options,
      query: {
        ...ut(this.options.query),
        after_id: e
      }
    } : null;
  }
}
class _s extends ys {
  constructor(e, t, s, n) {
    super(e, t, s, n), this.data = s.data || [], this.has_more = s.has_more || !1, this.next_page = s.next_page || null;
  }
  getPaginatedItems() {
    return this.data ?? [];
  }
  hasNextPage() {
    return this.has_more === !1 ? !1 : super.hasNextPage();
  }
  nextPageRequestOptions() {
    const e = this.next_page;
    return e ? {
      ...this.options,
      query: {
        ...ut(this.options.query),
        page: e
      }
    } : null;
  }
}
const bs = () => {
  if (typeof File > "u") {
    const { process: r } = globalThis, e = typeof r?.versions?.node == "string" && parseInt(r.versions.node.split(".")) < 20;
    throw new Error("`File` is not defined as a global, which is required for file uploads." + (e ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
  }
};
function G(r, e, t) {
  return bs(), new File(r, e ?? "unknown_file", t);
}
function qe(r, e) {
  const t = typeof r == "object" && r !== null && ("name" in r && r.name && String(r.name) || "url" in r && r.url && String(r.url) || "filename" in r && r.filename && String(r.filename) || "path" in r && r.path && String(r.path)) || "";
  return e ? t.split(/[\\/]/).pop() || void 0 : t;
}
const ws = (r) => r != null && typeof r == "object" && typeof r[Symbol.asyncIterator] == "function", yt = async (r, e, t = !0) => ({ ...r, body: await mr(r.body, e, t) }), $t = /* @__PURE__ */ new WeakMap();
function gr(r) {
  const e = typeof r == "function" ? r : r.fetch, t = $t.get(e);
  if (t)
    return t;
  const s = (async () => {
    try {
      const n = "Response" in e ? e.Response : (await e("data:,")).constructor, i = new FormData();
      return i.toString() !== await new n(i).text();
    } catch {
      return !0;
    }
  })();
  return $t.set(e, s), s;
}
const mr = async (r, e, t = !0) => {
  if (!await gr(e))
    throw new TypeError("The provided fetch function does not support file uploads with the current global FormData class.");
  const s = new FormData();
  return await Promise.all(Object.entries(r || {}).map(([n, i]) => dt(s, n, i, t))), s;
}, yr = (r) => r instanceof Blob && "name" in r, dt = async (r, e, t, s) => {
  if (t !== void 0) {
    if (t == null)
      throw new TypeError(`Received null for "${e}"; to pass null in FormData, you must use the string 'null'`);
    if (typeof t == "string" || typeof t == "number" || typeof t == "boolean")
      r.append(e, String(t));
    else if (t instanceof Response) {
      let n = {};
      const i = t.headers.get("Content-Type");
      i && (n = { type: i }), r.append(e, G([await t.blob()], qe(t, s), n));
    } else if (ws(t))
      r.append(e, G([await new Response(ps(t)).blob()], qe(t, s)));
    else if (yr(t))
      r.append(e, G([t], qe(t, s), { type: t.type }));
    else if (Array.isArray(t))
      await Promise.all(t.map((n) => dt(r, e + "[]", n, s)));
    else if (typeof t == "object")
      await Promise.all(Object.entries(t).map(([n, i]) => dt(r, `${e}[${n}]`, i, s)));
    else
      throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${t} instead`);
  }
}, Ss = (r) => r != null && typeof r == "object" && typeof r.size == "number" && typeof r.type == "string" && typeof r.text == "function" && typeof r.slice == "function" && typeof r.arrayBuffer == "function", _r = (r) => r != null && typeof r == "object" && typeof r.name == "string" && typeof r.lastModified == "number" && Ss(r), br = (r) => r != null && typeof r == "object" && typeof r.url == "string" && typeof r.blob == "function";
async function wr(r, e, t) {
  if (bs(), r = await r, e || (e = qe(r, !0)), _r(r))
    return r instanceof File && e == null && t == null ? r : G([await r.arrayBuffer()], e ?? r.name, {
      type: r.type,
      lastModified: r.lastModified,
      ...t
    });
  if (br(r)) {
    const n = await r.blob();
    return e || (e = new URL(r.url).pathname.split(/[\\/]/).pop()), G(await ht(n), e, t);
  }
  const s = await ht(r);
  if (!t?.type) {
    const n = s.find((i) => typeof i == "object" && "type" in i && i.type);
    typeof n == "string" && (t = { ...t, type: n });
  }
  return G(s, e, t);
}
async function ht(r) {
  let e = [];
  if (typeof r == "string" || ArrayBuffer.isView(r) || // includes Uint8Array, Buffer, etc.
  r instanceof ArrayBuffer)
    e.push(r);
  else if (Ss(r))
    e.push(r instanceof Blob ? r : await r.arrayBuffer());
  else if (ws(r))
    for await (const t of r)
      e.push(...await ht(t));
  else {
    const t = r?.constructor?.name;
    throw new Error(`Unexpected data type: ${typeof r}${t ? `; constructor: ${t}` : ""}${Sr(r)}`);
  }
  return e;
}
function Sr(r) {
  return typeof r != "object" || r === null ? "" : `; props: [${Object.getOwnPropertyNames(r).map((t) => `"${t}"`).join(", ")}]`;
}
class A {
  constructor(e) {
    this._client = e;
  }
}
const ks = /* @__PURE__ */ Symbol.for("brand.privateNullableHeaders");
function* kr(r) {
  if (!r)
    return;
  if (ks in r) {
    const { values: s, nulls: n } = r;
    yield* s.entries();
    for (const i of n)
      yield [i, null];
    return;
  }
  let e = !1, t;
  r instanceof Headers ? t = r.entries() : Tt(r) ? t = r : (e = !0, t = Object.entries(r ?? {}));
  for (let s of t) {
    const n = s[0];
    if (typeof n != "string")
      throw new TypeError("expected header name to be a string");
    const i = Tt(s[1]) ? s[1] : [s[1]];
    let o = !1;
    for (const c of i)
      c !== void 0 && (e && !o && (o = !0, yield [n, null]), yield [n, c]);
  }
}
const m = (r) => {
  const e = new Headers(), t = /* @__PURE__ */ new Set();
  for (const s of r) {
    const n = /* @__PURE__ */ new Set();
    for (const [i, o] of kr(s)) {
      const c = i.toLowerCase();
      n.has(c) || (e.delete(i), n.add(c)), o === null ? (e.delete(i), t.add(c)) : (e.append(i, o), t.delete(c));
    }
  }
  return { [ks]: !0, values: e, nulls: t };
}, me = /* @__PURE__ */ Symbol("anthropic.sdk.stainlessHelper");
function Ce(r) {
  return typeof r == "object" && r !== null && me in r;
}
function xs(r, e) {
  const t = /* @__PURE__ */ new Set();
  if (r)
    for (const s of r)
      Ce(s) && t.add(s[me]);
  if (e) {
    for (const s of e)
      if (Ce(s) && t.add(s[me]), Array.isArray(s.content))
        for (const n of s.content)
          Ce(n) && t.add(n[me]);
  }
  return Array.from(t);
}
function Ms(r, e) {
  const t = xs(r, e);
  return t.length === 0 ? {} : { "x-stainless-helper": t.join(", ") };
}
function xr(r) {
  return Ce(r) ? { "x-stainless-helper": r[me] } : {};
}
function Ts(r) {
  return r.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const Bt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null)), Mr = (r = Ts) => function(t, ...s) {
  if (t.length === 1)
    return t[0];
  let n = !1;
  const i = [], o = t.reduce((h, g, w) => {
    /[?#]/.test(g) && (n = !0);
    const f = s[w];
    let P = (n ? encodeURIComponent : r)("" + f);
    return w !== s.length && (f == null || typeof f == "object" && // handle values from other realms
    f.toString === Object.getPrototypeOf(Object.getPrototypeOf(f.hasOwnProperty ?? Bt) ?? Bt)?.toString) && (P = f + "", i.push({
      start: h.length + g.length,
      length: P.length,
      error: `Value of type ${Object.prototype.toString.call(f).slice(8, -1)} is not a valid path parameter`
    })), h + g + (w === s.length ? "" : P);
  }, ""), c = o.split(/[?#]/, 1)[0], u = new RegExp("(?<=^|\\/)(?:\\.|%2e){1,2}(?=\\/|$)", "gi");
  let l;
  for (; (l = u.exec(c)) !== null; )
    i.push({
      start: l.index,
      length: l[0].length,
      error: `Value "${l[0]}" can't be safely passed as a path parameter`
    });
  if (i.sort((h, g) => h.start - g.start), i.length > 0) {
    let h = 0;
    const g = i.reduce((w, f) => {
      const P = " ".repeat(f.start - h), Ge = "^".repeat(f.length);
      return h = f.start + f.length, w + P + Ge;
    }, "");
    throw new p(`Path parameters result in path with invalid segments:
${i.map((w) => w.error).join(`
`)}
${o}
${g}`);
  }
  return o;
}, b = /* @__PURE__ */ Mr(Ts);
class Rs extends A {
  /**
   * List Files
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const fileMetadata of client.beta.files.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.getAPIList("/v1/files", be, {
      query: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "files-api-2025-04-14"].toString() },
        t?.headers
      ])
    });
  }
  /**
   * Delete File
   *
   * @example
   * ```ts
   * const deletedFile = await client.beta.files.delete(
   *   'file_id',
   * );
   * ```
   */
  delete(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.delete(b`/v1/files/${e}`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "files-api-2025-04-14"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * Download File
   *
   * @example
   * ```ts
   * const response = await client.beta.files.download(
   *   'file_id',
   * );
   *
   * const content = await response.blob();
   * console.log(content);
   * ```
   */
  download(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/files/${e}/content`, {
      ...s,
      headers: m([
        {
          "anthropic-beta": [...n ?? [], "files-api-2025-04-14"].toString(),
          Accept: "application/binary"
        },
        s?.headers
      ]),
      __binaryResponse: !0
    });
  }
  /**
   * Get File Metadata
   *
   * @example
   * ```ts
   * const fileMetadata =
   *   await client.beta.files.retrieveMetadata('file_id');
   * ```
   */
  retrieveMetadata(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/files/${e}`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "files-api-2025-04-14"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * Upload File
   *
   * @example
   * ```ts
   * const fileMetadata = await client.beta.files.upload({
   *   file: fs.createReadStream('path/to/file'),
   * });
   * ```
   */
  upload(e, t) {
    const { betas: s, ...n } = e;
    return this._client.post("/v1/files", yt({
      body: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "files-api-2025-04-14"].toString() },
        xr(n.file),
        t?.headers
      ])
    }, this._client));
  }
}
let vs = class extends A {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   *
   * @example
   * ```ts
   * const betaModelInfo = await client.beta.models.retrieve(
   *   'model_id',
   * );
   * ```
   */
  retrieve(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/models/${e}?beta=true`, {
      ...s,
      headers: m([
        { ...n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0 },
        s?.headers
      ])
    });
  }
  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaModelInfo of client.beta.models.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.getAPIList("/v1/models?beta=true", be, {
      query: n,
      ...t,
      headers: m([
        { ...s?.toString() != null ? { "anthropic-beta": s?.toString() } : void 0 },
        t?.headers
      ])
    });
  }
};
const Ps = {
  "claude-opus-4-20250514": 8192,
  "claude-opus-4-0": 8192,
  "claude-4-opus-20250514": 8192,
  "anthropic.claude-opus-4-20250514-v1:0": 8192,
  "claude-opus-4@20250514": 8192,
  "claude-opus-4-1-20250805": 8192,
  "anthropic.claude-opus-4-1-20250805-v1:0": 8192,
  "claude-opus-4-1@20250805": 8192
};
function Es(r) {
  return r?.output_format ?? r?.output_config?.format;
}
function Lt(r, e, t) {
  const s = Es(e);
  return !e || !("parse" in (s ?? {})) ? {
    ...r,
    content: r.content.map((n) => {
      if (n.type === "text") {
        const i = Object.defineProperty({ ...n }, "parsed_output", {
          value: null,
          enumerable: !1
        });
        return Object.defineProperty(i, "parsed", {
          get() {
            return t.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead."), null;
          },
          enumerable: !1
        });
      }
      return n;
    }),
    parsed_output: null
  } : As(r, e, t);
}
function As(r, e, t) {
  let s = null;
  const n = r.content.map((i) => {
    if (i.type === "text") {
      const o = Tr(e, i.text);
      s === null && (s = o);
      const c = Object.defineProperty({ ...i }, "parsed_output", {
        value: o,
        enumerable: !1
      });
      return Object.defineProperty(c, "parsed", {
        get() {
          return t.logger.warn("The `parsed` property on `text` blocks is deprecated, please use `parsed_output` instead."), o;
        },
        enumerable: !1
      });
    }
    return i;
  });
  return {
    ...r,
    content: n,
    parsed_output: s
  };
}
function Tr(r, e) {
  const t = Es(r);
  if (t?.type !== "json_schema")
    return null;
  try {
    return "parse" in t ? t.parse(e) : JSON.parse(e);
  } catch (s) {
    throw new p(`Failed to parse structured output: ${s}`);
  }
}
const Rr = (r) => {
  let e = 0, t = [];
  for (; e < r.length; ) {
    let s = r[e];
    if (s === "\\") {
      e++;
      continue;
    }
    if (s === "{") {
      t.push({
        type: "brace",
        value: "{"
      }), e++;
      continue;
    }
    if (s === "}") {
      t.push({
        type: "brace",
        value: "}"
      }), e++;
      continue;
    }
    if (s === "[") {
      t.push({
        type: "paren",
        value: "["
      }), e++;
      continue;
    }
    if (s === "]") {
      t.push({
        type: "paren",
        value: "]"
      }), e++;
      continue;
    }
    if (s === ":") {
      t.push({
        type: "separator",
        value: ":"
      }), e++;
      continue;
    }
    if (s === ",") {
      t.push({
        type: "delimiter",
        value: ","
      }), e++;
      continue;
    }
    if (s === '"') {
      let c = "", u = !1;
      for (s = r[++e]; s !== '"'; ) {
        if (e === r.length) {
          u = !0;
          break;
        }
        if (s === "\\") {
          if (e++, e === r.length) {
            u = !0;
            break;
          }
          c += s + r[e], s = r[++e];
        } else
          c += s, s = r[++e];
      }
      s = r[++e], u || t.push({
        type: "string",
        value: c
      });
      continue;
    }
    if (s && /\s/.test(s)) {
      e++;
      continue;
    }
    let i = /[0-9]/;
    if (s && i.test(s) || s === "-" || s === ".") {
      let c = "";
      for (s === "-" && (c += s, s = r[++e]); s && i.test(s) || s === "."; )
        c += s, s = r[++e];
      t.push({
        type: "number",
        value: c
      });
      continue;
    }
    let o = /[a-z]/i;
    if (s && o.test(s)) {
      let c = "";
      for (; s && o.test(s) && e !== r.length; )
        c += s, s = r[++e];
      if (c == "true" || c == "false" || c === "null")
        t.push({
          type: "name",
          value: c
        });
      else {
        e++;
        continue;
      }
      continue;
    }
    e++;
  }
  return t;
}, z = (r) => {
  if (r.length === 0)
    return r;
  let e = r[r.length - 1];
  switch (e.type) {
    case "separator":
      return r = r.slice(0, r.length - 1), z(r);
    case "number":
      let t = e.value[e.value.length - 1];
      if (t === "." || t === "-")
        return r = r.slice(0, r.length - 1), z(r);
    case "string":
      let s = r[r.length - 2];
      if (s?.type === "delimiter")
        return r = r.slice(0, r.length - 1), z(r);
      if (s?.type === "brace" && s.value === "{")
        return r = r.slice(0, r.length - 1), z(r);
      break;
    case "delimiter":
      return r = r.slice(0, r.length - 1), z(r);
  }
  return r;
}, vr = (r) => {
  let e = [];
  return r.map((t) => {
    t.type === "brace" && (t.value === "{" ? e.push("}") : e.splice(e.lastIndexOf("}"), 1)), t.type === "paren" && (t.value === "[" ? e.push("]") : e.splice(e.lastIndexOf("]"), 1));
  }), e.length > 0 && e.reverse().map((t) => {
    t === "}" ? r.push({
      type: "brace",
      value: "}"
    }) : t === "]" && r.push({
      type: "paren",
      value: "]"
    });
  }), r;
}, Pr = (r) => {
  let e = "";
  return r.map((t) => {
    t.type === "string" ? e += '"' + t.value + '"' : e += t.value;
  }), e;
}, Is = (r) => JSON.parse(Pr(vr(z(Rr(r)))));
var R, j, J, Z, Te, ee, te, Re, se, $, re, ve, Pe, C, Ee, Ae, ne, Qe, jt, Ie, Ze, et, tt, Ut;
const qt = "__json_buf";
function Ct(r) {
  return r.type === "tool_use" || r.type === "server_tool_use" || r.type === "mcp_tool_use";
}
class He {
  constructor(e, t) {
    R.add(this), this.messages = [], this.receivedMessages = [], j.set(this, void 0), J.set(this, null), this.controller = new AbortController(), Z.set(this, void 0), Te.set(this, () => {
    }), ee.set(this, () => {
    }), te.set(this, void 0), Re.set(this, () => {
    }), se.set(this, () => {
    }), $.set(this, {}), re.set(this, !1), ve.set(this, !1), Pe.set(this, !1), C.set(this, !1), Ee.set(this, void 0), Ae.set(this, void 0), ne.set(this, void 0), Ie.set(this, (s) => {
      if (d(this, ve, !0), ye(s) && (s = new E()), s instanceof E)
        return d(this, Pe, !0), this._emit("abort", s);
      if (s instanceof p)
        return this._emit("error", s);
      if (s instanceof Error) {
        const n = new p(s.message);
        return n.cause = s, this._emit("error", n);
      }
      return this._emit("error", new p(String(s)));
    }), d(this, Z, new Promise((s, n) => {
      d(this, Te, s, "f"), d(this, ee, n, "f");
    })), d(this, te, new Promise((s, n) => {
      d(this, Re, s, "f"), d(this, se, n, "f");
    })), a(this, Z, "f").catch(() => {
    }), a(this, te, "f").catch(() => {
    }), d(this, J, e), d(this, ne, t?.logger ?? console);
  }
  get response() {
    return a(this, Ee, "f");
  }
  get request_id() {
    return a(this, Ae, "f");
  }
  /**
   * Returns the `MessageStream` data, the raw `Response` instance and the ID of the request,
   * returned vie the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * This is the same as the `APIPromise.withResponse()` method.
   *
   * This method will raise an error if you created the stream using `MessageStream.fromReadableStream`
   * as no `Response` is available.
   */
  async withResponse() {
    d(this, C, !0);
    const e = await a(this, Z, "f");
    if (!e)
      throw new Error("Could not resolve a `Response` object");
    return {
      data: this,
      response: e,
      request_id: e.headers.get("request-id")
    };
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(e) {
    const t = new He(null);
    return t._run(() => t._fromReadableStream(e)), t;
  }
  static createMessage(e, t, s, { logger: n } = {}) {
    const i = new He(t, { logger: n });
    for (const o of t.messages)
      i._addMessageParam(o);
    return d(i, J, { ...t, stream: !0 }), i._run(() => i._createMessage(e, { ...t, stream: !0 }, { ...s, headers: { ...s?.headers, "X-Stainless-Helper-Method": "stream" } })), i;
  }
  _run(e) {
    e().then(() => {
      this._emitFinal(), this._emit("end");
    }, a(this, Ie, "f"));
  }
  _addMessageParam(e) {
    this.messages.push(e);
  }
  _addMessage(e, t = !0) {
    this.receivedMessages.push(e), t && this._emit("message", e);
  }
  async _createMessage(e, t, s) {
    const n = s?.signal;
    let i;
    n && (n.aborted && this.controller.abort(), i = this.controller.abort.bind(this.controller), n.addEventListener("abort", i));
    try {
      a(this, R, "m", Ze).call(this);
      const { response: o, data: c } = await e.create({ ...t, stream: !0 }, { ...s, signal: this.controller.signal }).withResponse();
      this._connected(o);
      for await (const u of c)
        a(this, R, "m", et).call(this, u);
      if (c.controller.signal?.aborted)
        throw new E();
      a(this, R, "m", tt).call(this);
    } finally {
      n && i && n.removeEventListener("abort", i);
    }
  }
  _connected(e) {
    this.ended || (d(this, Ee, e), d(this, Ae, e?.headers.get("request-id")), a(this, Te, "f").call(this, e), this._emit("connect"));
  }
  get ended() {
    return a(this, re, "f");
  }
  get errored() {
    return a(this, ve, "f");
  }
  get aborted() {
    return a(this, Pe, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this MessageStream, so that calls can be chained
   */
  on(e, t) {
    return (a(this, $, "f")[e] || (a(this, $, "f")[e] = [])).push({ listener: t }), this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this MessageStream, so that calls can be chained
   */
  off(e, t) {
    const s = a(this, $, "f")[e];
    if (!s)
      return this;
    const n = s.findIndex((i) => i.listener === t);
    return n >= 0 && s.splice(n, 1), this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this MessageStream, so that calls can be chained
   */
  once(e, t) {
    return (a(this, $, "f")[e] || (a(this, $, "f")[e] = [])).push({ listener: t, once: !0 }), this;
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
      d(this, C, !0), e !== "error" && this.once("error", s), this.once(e, t);
    });
  }
  async done() {
    d(this, C, !0), await a(this, te, "f");
  }
  get currentMessage() {
    return a(this, j, "f");
  }
  /**
   * @returns a promise that resolves with the the final assistant Message response,
   * or rejects if an error occurred or the stream ended prematurely without producing a Message.
   * If structured outputs were used, this will be a ParsedMessage with a `parsed` field.
   */
  async finalMessage() {
    return await this.done(), a(this, R, "m", Qe).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant Message's text response, concatenated
   * together if there are more than one text blocks.
   * Rejects if an error occurred or the stream ended prematurely without producing a Message.
   */
  async finalText() {
    return await this.done(), a(this, R, "m", jt).call(this);
  }
  _emit(e, ...t) {
    if (a(this, re, "f"))
      return;
    e === "end" && (d(this, re, !0), a(this, Re, "f").call(this));
    const s = a(this, $, "f")[e];
    if (s && (a(this, $, "f")[e] = s.filter((n) => !n.once), s.forEach(({ listener: n }) => n(...t))), e === "abort") {
      const n = t[0];
      !a(this, C, "f") && !s?.length && Promise.reject(n), a(this, ee, "f").call(this, n), a(this, se, "f").call(this, n), this._emit("end");
      return;
    }
    if (e === "error") {
      const n = t[0];
      !a(this, C, "f") && !s?.length && Promise.reject(n), a(this, ee, "f").call(this, n), a(this, se, "f").call(this, n), this._emit("end");
    }
  }
  _emitFinal() {
    this.receivedMessages.at(-1) && this._emit("finalMessage", a(this, R, "m", Qe).call(this));
  }
  async _fromReadableStream(e, t) {
    const s = t?.signal;
    let n;
    s && (s.aborted && this.controller.abort(), n = this.controller.abort.bind(this.controller), s.addEventListener("abort", n));
    try {
      a(this, R, "m", Ze).call(this), this._connected(null);
      const i = O.fromReadableStream(e, this.controller);
      for await (const o of i)
        a(this, R, "m", et).call(this, o);
      if (i.controller.signal?.aborted)
        throw new E();
      a(this, R, "m", tt).call(this);
    } finally {
      s && n && s.removeEventListener("abort", n);
    }
  }
  [(j = /* @__PURE__ */ new WeakMap(), J = /* @__PURE__ */ new WeakMap(), Z = /* @__PURE__ */ new WeakMap(), Te = /* @__PURE__ */ new WeakMap(), ee = /* @__PURE__ */ new WeakMap(), te = /* @__PURE__ */ new WeakMap(), Re = /* @__PURE__ */ new WeakMap(), se = /* @__PURE__ */ new WeakMap(), $ = /* @__PURE__ */ new WeakMap(), re = /* @__PURE__ */ new WeakMap(), ve = /* @__PURE__ */ new WeakMap(), Pe = /* @__PURE__ */ new WeakMap(), C = /* @__PURE__ */ new WeakMap(), Ee = /* @__PURE__ */ new WeakMap(), Ae = /* @__PURE__ */ new WeakMap(), ne = /* @__PURE__ */ new WeakMap(), Ie = /* @__PURE__ */ new WeakMap(), R = /* @__PURE__ */ new WeakSet(), Qe = function() {
    if (this.receivedMessages.length === 0)
      throw new p("stream ended without producing a Message with role=assistant");
    return this.receivedMessages.at(-1);
  }, jt = function() {
    if (this.receivedMessages.length === 0)
      throw new p("stream ended without producing a Message with role=assistant");
    const t = this.receivedMessages.at(-1).content.filter((s) => s.type === "text").map((s) => s.text);
    if (t.length === 0)
      throw new p("stream ended without producing a content block with type=text");
    return t.join(" ");
  }, Ze = function() {
    this.ended || d(this, j, void 0);
  }, et = function(t) {
    if (this.ended)
      return;
    const s = a(this, R, "m", Ut).call(this, t);
    switch (this._emit("streamEvent", t, s), t.type) {
      case "content_block_delta": {
        const n = s.content.at(-1);
        switch (t.delta.type) {
          case "text_delta": {
            n.type === "text" && this._emit("text", t.delta.text, n.text || "");
            break;
          }
          case "citations_delta": {
            n.type === "text" && this._emit("citation", t.delta.citation, n.citations ?? []);
            break;
          }
          case "input_json_delta": {
            Ct(n) && n.input && this._emit("inputJson", t.delta.partial_json, n.input);
            break;
          }
          case "thinking_delta": {
            n.type === "thinking" && this._emit("thinking", t.delta.thinking, n.thinking);
            break;
          }
          case "signature_delta": {
            n.type === "thinking" && this._emit("signature", n.signature);
            break;
          }
          case "compaction_delta": {
            n.type === "compaction" && n.content && this._emit("compaction", n.content);
            break;
          }
          default:
            t.delta;
        }
        break;
      }
      case "message_stop": {
        this._addMessageParam(s), this._addMessage(Lt(s, a(this, J, "f"), { logger: a(this, ne, "f") }), !0);
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", s.content.at(-1));
        break;
      }
      case "message_start": {
        d(this, j, s);
        break;
      }
    }
  }, tt = function() {
    if (this.ended)
      throw new p("stream has ended, this shouldn't happen");
    const t = a(this, j, "f");
    if (!t)
      throw new p("request ended without sending any chunks");
    return d(this, j, void 0), Lt(t, a(this, J, "f"), { logger: a(this, ne, "f") });
  }, Ut = function(t) {
    let s = a(this, j, "f");
    if (t.type === "message_start") {
      if (s)
        throw new p(`Unexpected event order, got ${t.type} before receiving "message_stop"`);
      return t.message;
    }
    if (!s)
      throw new p(`Unexpected event order, got ${t.type} before "message_start"`);
    switch (t.type) {
      case "message_stop":
        return s;
      case "message_delta":
        return s.container = t.delta.container, s.stop_reason = t.delta.stop_reason, s.stop_sequence = t.delta.stop_sequence, s.usage.output_tokens = t.usage.output_tokens, s.context_management = t.context_management, t.usage.input_tokens != null && (s.usage.input_tokens = t.usage.input_tokens), t.usage.cache_creation_input_tokens != null && (s.usage.cache_creation_input_tokens = t.usage.cache_creation_input_tokens), t.usage.cache_read_input_tokens != null && (s.usage.cache_read_input_tokens = t.usage.cache_read_input_tokens), t.usage.server_tool_use != null && (s.usage.server_tool_use = t.usage.server_tool_use), t.usage.iterations != null && (s.usage.iterations = t.usage.iterations), s;
      case "content_block_start":
        return s.content.push(t.content_block), s;
      case "content_block_delta": {
        const n = s.content.at(t.index);
        switch (t.delta.type) {
          case "text_delta": {
            n?.type === "text" && (s.content[t.index] = {
              ...n,
              text: (n.text || "") + t.delta.text
            });
            break;
          }
          case "citations_delta": {
            n?.type === "text" && (s.content[t.index] = {
              ...n,
              citations: [...n.citations ?? [], t.delta.citation]
            });
            break;
          }
          case "input_json_delta": {
            if (n && Ct(n)) {
              let i = n[qt] || "";
              i += t.delta.partial_json;
              const o = { ...n };
              if (Object.defineProperty(o, qt, {
                value: i,
                enumerable: !1,
                writable: !0
              }), i)
                try {
                  o.input = Is(i);
                } catch (c) {
                  const u = new p(`Unable to parse tool parameter JSON from model. Please retry your request or adjust your prompt. Error: ${c}. JSON: ${i}`);
                  a(this, Ie, "f").call(this, u);
                }
              s.content[t.index] = o;
            }
            break;
          }
          case "thinking_delta": {
            n?.type === "thinking" && (s.content[t.index] = {
              ...n,
              thinking: n.thinking + t.delta.thinking
            });
            break;
          }
          case "signature_delta": {
            n?.type === "thinking" && (s.content[t.index] = {
              ...n,
              signature: t.delta.signature
            });
            break;
          }
          case "compaction_delta": {
            n?.type === "compaction" && (s.content[t.index] = {
              ...n,
              content: (n.content || "") + t.delta.content
            });
            break;
          }
          default:
            t.delta;
        }
        return s;
      }
      case "content_block_stop":
        return s;
    }
  }, Symbol.asyncIterator)]() {
    const e = [], t = [];
    let s = !1;
    return this.on("streamEvent", (n) => {
      const i = t.shift();
      i ? i.resolve(n) : e.push(n);
    }), this.on("end", () => {
      s = !0;
      for (const n of t)
        n.resolve(void 0);
      t.length = 0;
    }), this.on("abort", (n) => {
      s = !0;
      for (const i of t)
        i.reject(n);
      t.length = 0;
    }), this.on("error", (n) => {
      s = !0;
      for (const i of t)
        i.reject(n);
      t.length = 0;
    }), {
      next: async () => e.length ? { value: e.shift(), done: !1 } : s ? { value: void 0, done: !0 } : new Promise((i, o) => t.push({ resolve: i, reject: o })).then((i) => i ? { value: i, done: !1 } : { value: void 0, done: !0 }),
      return: async () => (this.abort(), { value: void 0, done: !0 })
    };
  }
  toReadableStream() {
    return new O(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
}
class Os extends Error {
  constructor(e) {
    const t = typeof e == "string" ? e : e.map((s) => s.type === "text" ? s.text : `[${s.type}]`).join(" ");
    super(t), this.name = "ToolError", this.content = e;
  }
}
const Er = 1e5, Ar = `You have been working on the task described above but have not yet completed it. Write a continuation summary that will allow you (or another instance of yourself) to resume work efficiently in a future context window where the conversation history will be replaced with this summary. Your summary should be structured, concise, and actionable. Include:
1. Task Overview
The user's core request and success criteria
Any clarifications or constraints they specified
2. Current State
What has been completed so far
Files created, modified, or analyzed (with paths if relevant)
Key outputs or artifacts produced
3. Important Discoveries
Technical constraints or requirements uncovered
Decisions made and their rationale
Errors encountered and how they were resolved
What approaches were tried that didn't work (and why)
4. Next Steps
Specific actions needed to complete the task
Any blockers or open questions to resolve
Priority order if multiple steps remain
5. Context to Preserve
User preferences or style requirements
Domain-specific details that aren't obvious
Any promises made to the user
Be concise but complete—err on the side of including information that would prevent duplicate work or repeated mistakes. Write in a way that enables immediate resumption of the task.
Wrap your summary in <summary></summary> tags.`;
var ie, X, F, _, ae, x, L, U, oe, Ft, ft;
function Dt() {
  let r, e;
  return { promise: new Promise((s, n) => {
    r = s, e = n;
  }), resolve: r, reject: e };
}
class Ns {
  constructor(e, t, s) {
    ie.add(this), this.client = e, X.set(this, !1), F.set(this, !1), _.set(this, void 0), ae.set(this, void 0), x.set(this, void 0), L.set(this, void 0), U.set(this, void 0), oe.set(this, 0), d(this, _, {
      params: {
        // You can't clone the entire params since there are functions as handlers.
        // You also don't really need to clone params.messages, but it probably will prevent a foot gun
        // somewhere.
        ...t,
        messages: structuredClone(t.messages)
      }
    });
    const i = ["BetaToolRunner", ...xs(t.tools, t.messages)].join(", ");
    d(this, ae, {
      ...s,
      headers: m([{ "x-stainless-helper": i }, s?.headers])
    }), d(this, U, Dt());
  }
  async *[(X = /* @__PURE__ */ new WeakMap(), F = /* @__PURE__ */ new WeakMap(), _ = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), x = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new WeakMap(), oe = /* @__PURE__ */ new WeakMap(), ie = /* @__PURE__ */ new WeakSet(), Ft = async function() {
    const t = a(this, _, "f").params.compactionControl;
    if (!t || !t.enabled)
      return !1;
    let s = 0;
    if (a(this, x, "f") !== void 0)
      try {
        const l = await a(this, x, "f");
        s = l.usage.input_tokens + (l.usage.cache_creation_input_tokens ?? 0) + (l.usage.cache_read_input_tokens ?? 0) + l.usage.output_tokens;
      } catch {
        return !1;
      }
    const n = t.contextTokenThreshold ?? Er;
    if (s < n)
      return !1;
    const i = t.model ?? a(this, _, "f").params.model, o = t.summaryPrompt ?? Ar, c = a(this, _, "f").params.messages;
    if (c[c.length - 1].role === "assistant") {
      const l = c[c.length - 1];
      if (Array.isArray(l.content)) {
        const h = l.content.filter((g) => g.type !== "tool_use");
        h.length === 0 ? c.pop() : l.content = h;
      }
    }
    const u = await this.client.beta.messages.create({
      model: i,
      messages: [
        ...c,
        {
          role: "user",
          content: [
            {
              type: "text",
              text: o
            }
          ]
        }
      ],
      max_tokens: a(this, _, "f").params.max_tokens
    }, {
      headers: { "x-stainless-helper": "compaction" }
    });
    if (u.content[0]?.type !== "text")
      throw new p("Expected text response for compaction");
    return a(this, _, "f").params.messages = [
      {
        role: "user",
        content: u.content
      }
    ], !0;
  }, Symbol.asyncIterator)]() {
    var e;
    if (a(this, X, "f"))
      throw new p("Cannot iterate over a consumed stream");
    d(this, X, !0), d(this, F, !0), d(this, L, void 0);
    try {
      for (; ; ) {
        let t;
        try {
          if (a(this, _, "f").params.max_iterations && a(this, oe, "f") >= a(this, _, "f").params.max_iterations)
            break;
          d(this, F, !1, "f"), d(this, L, void 0, "f"), d(this, oe, (e = a(this, oe, "f"), e++, e), "f"), d(this, x, void 0, "f");
          const { max_iterations: s, compactionControl: n, ...i } = a(this, _, "f").params;
          if (i.stream ? (t = this.client.beta.messages.stream({ ...i }, a(this, ae, "f")), d(this, x, t.finalMessage(), "f"), a(this, x, "f").catch(() => {
          }), yield t) : (d(this, x, this.client.beta.messages.create({ ...i, stream: !1 }, a(this, ae, "f")), "f"), yield a(this, x, "f")), !await a(this, ie, "m", Ft).call(this)) {
            if (!a(this, F, "f")) {
              const { role: u, content: l } = await a(this, x, "f");
              a(this, _, "f").params.messages.push({ role: u, content: l });
            }
            const c = await a(this, ie, "m", ft).call(this, a(this, _, "f").params.messages.at(-1));
            if (c)
              a(this, _, "f").params.messages.push(c);
            else if (!a(this, F, "f"))
              break;
          }
        } finally {
          t && t.abort();
        }
      }
      if (!a(this, x, "f"))
        throw new p("ToolRunner concluded without a message from the server");
      a(this, U, "f").resolve(await a(this, x, "f"));
    } catch (t) {
      throw d(this, X, !1), a(this, U, "f").promise.catch(() => {
      }), a(this, U, "f").reject(t), d(this, U, Dt()), t;
    }
  }
  setMessagesParams(e) {
    typeof e == "function" ? a(this, _, "f").params = e(a(this, _, "f").params) : a(this, _, "f").params = e, d(this, F, !0), d(this, L, void 0);
  }
  /**
   * Get the tool response for the last message from the assistant.
   * Avoids redundant tool executions by caching results.
   *
   * @returns A promise that resolves to a BetaMessageParam containing tool results, or null if no tools need to be executed
   *
   * @example
   * const toolResponse = await runner.generateToolResponse();
   * if (toolResponse) {
   *   console.log('Tool results:', toolResponse.content);
   * }
   */
  async generateToolResponse() {
    const e = await a(this, x, "f") ?? this.params.messages.at(-1);
    return e ? a(this, ie, "m", ft).call(this, e) : null;
  }
  /**
   * Wait for the async iterator to complete. This works even if the async iterator hasn't yet started, and
   * will wait for an instance to start and go to completion.
   *
   * @returns A promise that resolves to the final BetaMessage when the iterator completes
   *
   * @example
   * // Start consuming the iterator
   * for await (const message of runner) {
   *   console.log('Message:', message.content);
   * }
   *
   * // Meanwhile, wait for completion from another part of the code
   * const finalMessage = await runner.done();
   * console.log('Final response:', finalMessage.content);
   */
  done() {
    return a(this, U, "f").promise;
  }
  /**
   * Returns a promise indicating that the stream is done. Unlike .done(), this will eagerly read the stream:
   * * If the iterator has not been consumed, consume the entire iterator and return the final message from the
   * assistant.
   * * If the iterator has been consumed, waits for it to complete and returns the final message.
   *
   * @returns A promise that resolves to the final BetaMessage from the conversation
   * @throws {AnthropicError} If no messages were processed during the conversation
   *
   * @example
   * const finalMessage = await runner.runUntilDone();
   * console.log('Final response:', finalMessage.content);
   */
  async runUntilDone() {
    if (!a(this, X, "f"))
      for await (const e of this)
        ;
    return this.done();
  }
  /**
   * Get the current parameters being used by the ToolRunner.
   *
   * @returns A readonly view of the current ToolRunnerParams
   *
   * @example
   * const currentParams = runner.params;
   * console.log('Current model:', currentParams.model);
   * console.log('Message count:', currentParams.messages.length);
   */
  get params() {
    return a(this, _, "f").params;
  }
  /**
   * Add one or more messages to the conversation history.
   *
   * @param messages - One or more BetaMessageParam objects to add to the conversation
   *
   * @example
   * runner.pushMessages(
   *   { role: 'user', content: 'Also, what about the weather in NYC?' }
   * );
   *
   * @example
   * // Adding multiple messages
   * runner.pushMessages(
   *   { role: 'user', content: 'What about NYC?' },
   *   { role: 'user', content: 'And Boston?' }
   * );
   */
  pushMessages(...e) {
    this.setMessagesParams((t) => ({
      ...t,
      messages: [...t.messages, ...e]
    }));
  }
  /**
   * Makes the ToolRunner directly awaitable, equivalent to calling .runUntilDone()
   * This allows using `await runner` instead of `await runner.runUntilDone()`
   */
  then(e, t) {
    return this.runUntilDone().then(e, t);
  }
}
ft = async function(e) {
  return a(this, L, "f") !== void 0 ? a(this, L, "f") : (d(this, L, Ir(a(this, _, "f").params, e)), a(this, L, "f"));
};
async function Ir(r, e = r.messages.at(-1)) {
  if (!e || e.role !== "assistant" || !e.content || typeof e.content == "string")
    return null;
  const t = e.content.filter((n) => n.type === "tool_use");
  return t.length === 0 ? null : {
    role: "user",
    content: await Promise.all(t.map(async (n) => {
      const i = r.tools.find((o) => ("name" in o ? o.name : o.mcp_server_name) === n.name);
      if (!i || !("run" in i))
        return {
          type: "tool_result",
          tool_use_id: n.id,
          content: `Error: Tool '${n.name}' not found`,
          is_error: !0
        };
      try {
        let o = n.input;
        "parse" in i && i.parse && (o = i.parse(o));
        const c = await i.run(o);
        return {
          type: "tool_result",
          tool_use_id: n.id,
          content: c
        };
      } catch (o) {
        return {
          type: "tool_result",
          tool_use_id: n.id,
          content: o instanceof Os ? o.content : `Error: ${o instanceof Error ? o.message : String(o)}`,
          is_error: !0
        };
      }
    }))
  };
}
class ze {
  constructor(e, t) {
    this.iterator = e, this.controller = t;
  }
  async *decoder() {
    const e = new _e();
    for await (const t of this.iterator)
      for (const s of e.decode(t))
        yield JSON.parse(s);
    for (const t of e.flush())
      yield JSON.parse(t);
  }
  [Symbol.asyncIterator]() {
    return this.decoder();
  }
  static fromResponse(e, t) {
    if (!e.body)
      throw t.abort(), typeof globalThis.navigator < "u" && globalThis.navigator.product === "ReactNative" ? new p("The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api") : new p("Attempted to iterate over a response with no body");
    return new ze(gt(e.body), t);
  }
}
let $s = class extends A {
  /**
   * Send a batch of Message creation requests.
   *
   * The Message Batches API can be used to process multiple Messages API requests at
   * once. Once a Message Batch is created, it begins processing immediately. Batches
   * can take up to 24 hours to complete.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.create({
   *     requests: [
   *       {
   *         custom_id: 'my-custom-id-1',
   *         params: {
   *           max_tokens: 1024,
   *           messages: [
   *             { content: 'Hello, world', role: 'user' },
   *           ],
   *           model: 'claude-opus-4-6',
   *         },
   *       },
   *     ],
   *   });
   * ```
   */
  create(e, t) {
    const { betas: s, ...n } = e;
    return this._client.post("/v1/messages/batches?beta=true", {
      body: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "message-batches-2024-09-24"].toString() },
        t?.headers
      ])
    });
  }
  /**
   * This endpoint is idempotent and can be used to poll for Message Batch
   * completion. To access the results of a Message Batch, make a request to the
   * `results_url` field in the response.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.retrieve(
   *     'message_batch_id',
   *   );
   * ```
   */
  retrieve(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/messages/batches/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "message-batches-2024-09-24"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * List all Message Batches within a Workspace. Most recently created batches are
   * returned first.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const betaMessageBatch of client.beta.messages.batches.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.getAPIList("/v1/messages/batches?beta=true", be, {
      query: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "message-batches-2024-09-24"].toString() },
        t?.headers
      ])
    });
  }
  /**
   * Delete a Message Batch.
   *
   * Message Batches can only be deleted once they've finished processing. If you'd
   * like to delete an in-progress batch, you must first cancel it.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaDeletedMessageBatch =
   *   await client.beta.messages.batches.delete(
   *     'message_batch_id',
   *   );
   * ```
   */
  delete(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.delete(b`/v1/messages/batches/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "message-batches-2024-09-24"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * Batches may be canceled any time before processing ends. Once cancellation is
   * initiated, the batch enters a `canceling` state, at which time the system may
   * complete any in-progress, non-interruptible requests before finalizing
   * cancellation.
   *
   * The number of canceled requests is specified in `request_counts`. To determine
   * which requests were canceled, check the individual results within the batch.
   * Note that cancellation may not result in any canceled requests if they were
   * non-interruptible.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatch =
   *   await client.beta.messages.batches.cancel(
   *     'message_batch_id',
   *   );
   * ```
   */
  cancel(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.post(b`/v1/messages/batches/${e}/cancel?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "message-batches-2024-09-24"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * Streams the results of a Message Batch as a `.jsonl` file.
   *
   * Each line in the file is a JSON object containing the result of a single request
   * in the Message Batch. Results are not guaranteed to be in the same order as
   * requests. Use the `custom_id` field to match results to requests.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const betaMessageBatchIndividualResponse =
   *   await client.beta.messages.batches.results(
   *     'message_batch_id',
   *   );
   * ```
   */
  async results(e, t = {}, s) {
    const n = await this.retrieve(e);
    if (!n.results_url)
      throw new p(`No batch \`results_url\`; Has it finished processing? ${n.processing_status} - ${n.id}`);
    const { betas: i } = t ?? {};
    return this._client.get(n.results_url, {
      ...s,
      headers: m([
        {
          "anthropic-beta": [...i ?? [], "message-batches-2024-09-24"].toString(),
          Accept: "application/binary"
        },
        s?.headers
      ]),
      stream: !0,
      __binaryResponse: !0
    })._thenUnwrap((o, c) => ze.fromResponse(c.response, c.controller));
  }
};
const Wt = {
  "claude-1.3": "November 6th, 2024",
  "claude-1.3-100k": "November 6th, 2024",
  "claude-instant-1.1": "November 6th, 2024",
  "claude-instant-1.1-100k": "November 6th, 2024",
  "claude-instant-1.2": "November 6th, 2024",
  "claude-3-sonnet-20240229": "July 21st, 2025",
  "claude-3-opus-20240229": "January 5th, 2026",
  "claude-2.1": "July 21st, 2025",
  "claude-2.0": "July 21st, 2025",
  "claude-3-7-sonnet-latest": "February 19th, 2026",
  "claude-3-7-sonnet-20250219": "February 19th, 2026"
}, Or = ["claude-opus-4-6"];
let we = class extends A {
  constructor() {
    super(...arguments), this.batches = new $s(this._client);
  }
  create(e, t) {
    const s = Ht(e), { betas: n, ...i } = s;
    i.model in Wt && console.warn(`The model '${i.model}' is deprecated and will reach end-of-life on ${Wt[i.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`), i.model in Or && i.thinking && i.thinking.type === "enabled" && console.warn(`Using Claude with ${i.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
    let o = this._client._options.timeout;
    if (!i.stream && o == null) {
      const u = Ps[i.model] ?? void 0;
      o = this._client.calculateNonstreamingTimeout(i.max_tokens, u);
    }
    const c = Ms(i.tools, i.messages);
    return this._client.post("/v1/messages?beta=true", {
      body: i,
      timeout: o ?? 6e5,
      ...t,
      headers: m([
        { ...n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0 },
        c,
        t?.headers
      ]),
      stream: s.stream ?? !1
    });
  }
  /**
   * Send a structured list of input messages with text and/or image content, along with an expected `output_format` and
   * the response will be automatically parsed and available in the `parsed_output` property of the message.
   *
   * @example
   * ```ts
   * const message = await client.beta.messages.parse({
   *   model: 'claude-3-5-sonnet-20241022',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_format: zodOutputFormat(z.object({ answer: z.number() }), 'math'),
   * });
   *
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  parse(e, t) {
    return t = {
      ...t,
      headers: m([
        { "anthropic-beta": [...e.betas ?? [], "structured-outputs-2025-12-15"].toString() },
        t?.headers
      ])
    }, this.create(e, t).then((s) => As(s, e, { logger: this._client.logger ?? console }));
  }
  /**
   * Create a Message stream
   */
  stream(e, t) {
    return He.createMessage(this, e, t);
  }
  /**
   * Count the number of tokens in a Message.
   *
   * The Token Count API can be used to count the number of tokens in a Message,
   * including tools, images, and documents, without creating it.
   *
   * Learn more about token counting in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/token-counting)
   *
   * @example
   * ```ts
   * const betaMessageTokensCount =
   *   await client.beta.messages.countTokens({
   *     messages: [{ content: 'string', role: 'user' }],
   *     model: 'claude-opus-4-6',
   *   });
   * ```
   */
  countTokens(e, t) {
    const s = Ht(e), { betas: n, ...i } = s;
    return this._client.post("/v1/messages/count_tokens?beta=true", {
      body: i,
      ...t,
      headers: m([
        { "anthropic-beta": [...n ?? [], "token-counting-2024-11-01"].toString() },
        t?.headers
      ])
    });
  }
  toolRunner(e, t) {
    return new Ns(this._client, e, t);
  }
};
function Ht(r) {
  if (!r.output_format)
    return r;
  if (r.output_config?.format)
    throw new p("Both output_format and output_config.format were provided. Please use only output_config.format (output_format is deprecated).");
  const { output_format: e, ...t } = r;
  return {
    ...t,
    output_config: {
      ...r.output_config,
      format: e
    }
  };
}
we.Batches = $s;
we.BetaToolRunner = Ns;
we.ToolError = Os;
class Bs extends A {
  /**
   * Create Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.create(
   *   'skill_id',
   * );
   * ```
   */
  create(e, t = {}, s) {
    const { betas: n, ...i } = t ?? {};
    return this._client.post(b`/v1/skills/${e}/versions?beta=true`, yt({
      body: i,
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    }, this._client));
  }
  /**
   * Get Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.retrieve(
   *   'version',
   *   { skill_id: 'skill_id' },
   * );
   * ```
   */
  retrieve(e, t, s) {
    const { skill_id: n, betas: i } = t;
    return this._client.get(b`/v1/skills/${n}/versions/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...i ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * List Skill Versions
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const versionListResponse of client.beta.skills.versions.list(
   *   'skill_id',
   * )) {
   *   // ...
   * }
   * ```
   */
  list(e, t = {}, s) {
    const { betas: n, ...i } = t ?? {};
    return this._client.getAPIList(b`/v1/skills/${e}/versions?beta=true`, _s, {
      query: i,
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * Delete Skill Version
   *
   * @example
   * ```ts
   * const version = await client.beta.skills.versions.delete(
   *   'version',
   *   { skill_id: 'skill_id' },
   * );
   * ```
   */
  delete(e, t, s) {
    const { skill_id: n, betas: i } = t;
    return this._client.delete(b`/v1/skills/${n}/versions/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...i ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    });
  }
}
class _t extends A {
  constructor() {
    super(...arguments), this.versions = new Bs(this._client);
  }
  /**
   * Create Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.create();
   * ```
   */
  create(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.post("/v1/skills?beta=true", yt({
      body: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "skills-2025-10-02"].toString() },
        t?.headers
      ])
    }, this._client, !1));
  }
  /**
   * Get Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.retrieve('skill_id');
   * ```
   */
  retrieve(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/skills/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    });
  }
  /**
   * List Skills
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const skillListResponse of client.beta.skills.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.getAPIList("/v1/skills?beta=true", _s, {
      query: n,
      ...t,
      headers: m([
        { "anthropic-beta": [...s ?? [], "skills-2025-10-02"].toString() },
        t?.headers
      ])
    });
  }
  /**
   * Delete Skill
   *
   * @example
   * ```ts
   * const skill = await client.beta.skills.delete('skill_id');
   * ```
   */
  delete(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.delete(b`/v1/skills/${e}?beta=true`, {
      ...s,
      headers: m([
        { "anthropic-beta": [...n ?? [], "skills-2025-10-02"].toString() },
        s?.headers
      ])
    });
  }
}
_t.Versions = Bs;
class Y extends A {
  constructor() {
    super(...arguments), this.models = new vs(this._client), this.messages = new we(this._client), this.files = new Rs(this._client), this.skills = new _t(this._client);
  }
}
Y.Models = vs;
Y.Messages = we;
Y.Files = Rs;
Y.Skills = _t;
class Ls extends A {
  create(e, t) {
    const { betas: s, ...n } = e;
    return this._client.post("/v1/complete", {
      body: n,
      timeout: this._client._options.timeout ?? 6e5,
      ...t,
      headers: m([
        { ...s?.toString() != null ? { "anthropic-beta": s?.toString() } : void 0 },
        t?.headers
      ]),
      stream: e.stream ?? !1
    });
  }
}
function js(r) {
  return r?.output_config?.format;
}
function Jt(r, e, t) {
  const s = js(e);
  return !e || !("parse" in (s ?? {})) ? {
    ...r,
    content: r.content.map((n) => n.type === "text" ? Object.defineProperty({ ...n }, "parsed_output", {
      value: null,
      enumerable: !1
    }) : n),
    parsed_output: null
  } : Us(r, e);
}
function Us(r, e, t) {
  let s = null;
  const n = r.content.map((i) => {
    if (i.type === "text") {
      const o = Nr(e, i.text);
      return s === null && (s = o), Object.defineProperty({ ...i }, "parsed_output", {
        value: o,
        enumerable: !1
      });
    }
    return i;
  });
  return {
    ...r,
    content: n,
    parsed_output: s
  };
}
function Nr(r, e) {
  const t = js(r);
  if (t?.type !== "json_schema")
    return null;
  try {
    return "parse" in t ? t.parse(e) : JSON.parse(e);
  } catch (s) {
    throw new p(`Failed to parse structured output: ${s}`);
  }
}
var v, q, K, ce, Oe, le, ue, Ne, de, B, he, $e, Be, D, Le, je, fe, st, Xt, rt, nt, it, at, Kt;
const Vt = "__json_buf";
function zt(r) {
  return r.type === "tool_use" || r.type === "server_tool_use";
}
class Je {
  constructor(e, t) {
    v.add(this), this.messages = [], this.receivedMessages = [], q.set(this, void 0), K.set(this, null), this.controller = new AbortController(), ce.set(this, void 0), Oe.set(this, () => {
    }), le.set(this, () => {
    }), ue.set(this, void 0), Ne.set(this, () => {
    }), de.set(this, () => {
    }), B.set(this, {}), he.set(this, !1), $e.set(this, !1), Be.set(this, !1), D.set(this, !1), Le.set(this, void 0), je.set(this, void 0), fe.set(this, void 0), rt.set(this, (s) => {
      if (d(this, $e, !0), ye(s) && (s = new E()), s instanceof E)
        return d(this, Be, !0), this._emit("abort", s);
      if (s instanceof p)
        return this._emit("error", s);
      if (s instanceof Error) {
        const n = new p(s.message);
        return n.cause = s, this._emit("error", n);
      }
      return this._emit("error", new p(String(s)));
    }), d(this, ce, new Promise((s, n) => {
      d(this, Oe, s, "f"), d(this, le, n, "f");
    })), d(this, ue, new Promise((s, n) => {
      d(this, Ne, s, "f"), d(this, de, n, "f");
    })), a(this, ce, "f").catch(() => {
    }), a(this, ue, "f").catch(() => {
    }), d(this, K, e), d(this, fe, t?.logger ?? console);
  }
  get response() {
    return a(this, Le, "f");
  }
  get request_id() {
    return a(this, je, "f");
  }
  /**
   * Returns the `MessageStream` data, the raw `Response` instance and the ID of the request,
   * returned vie the `request-id` header which is useful for debugging requests and resporting
   * issues to Anthropic.
   *
   * This is the same as the `APIPromise.withResponse()` method.
   *
   * This method will raise an error if you created the stream using `MessageStream.fromReadableStream`
   * as no `Response` is available.
   */
  async withResponse() {
    d(this, D, !0);
    const e = await a(this, ce, "f");
    if (!e)
      throw new Error("Could not resolve a `Response` object");
    return {
      data: this,
      response: e,
      request_id: e.headers.get("request-id")
    };
  }
  /**
   * Intended for use on the frontend, consuming a stream produced with
   * `.toReadableStream()` on the backend.
   *
   * Note that messages sent to the model do not appear in `.on('message')`
   * in this context.
   */
  static fromReadableStream(e) {
    const t = new Je(null);
    return t._run(() => t._fromReadableStream(e)), t;
  }
  static createMessage(e, t, s, { logger: n } = {}) {
    const i = new Je(t, { logger: n });
    for (const o of t.messages)
      i._addMessageParam(o);
    return d(i, K, { ...t, stream: !0 }), i._run(() => i._createMessage(e, { ...t, stream: !0 }, { ...s, headers: { ...s?.headers, "X-Stainless-Helper-Method": "stream" } })), i;
  }
  _run(e) {
    e().then(() => {
      this._emitFinal(), this._emit("end");
    }, a(this, rt, "f"));
  }
  _addMessageParam(e) {
    this.messages.push(e);
  }
  _addMessage(e, t = !0) {
    this.receivedMessages.push(e), t && this._emit("message", e);
  }
  async _createMessage(e, t, s) {
    const n = s?.signal;
    let i;
    n && (n.aborted && this.controller.abort(), i = this.controller.abort.bind(this.controller), n.addEventListener("abort", i));
    try {
      a(this, v, "m", nt).call(this);
      const { response: o, data: c } = await e.create({ ...t, stream: !0 }, { ...s, signal: this.controller.signal }).withResponse();
      this._connected(o);
      for await (const u of c)
        a(this, v, "m", it).call(this, u);
      if (c.controller.signal?.aborted)
        throw new E();
      a(this, v, "m", at).call(this);
    } finally {
      n && i && n.removeEventListener("abort", i);
    }
  }
  _connected(e) {
    this.ended || (d(this, Le, e), d(this, je, e?.headers.get("request-id")), a(this, Oe, "f").call(this, e), this._emit("connect"));
  }
  get ended() {
    return a(this, he, "f");
  }
  get errored() {
    return a(this, $e, "f");
  }
  get aborted() {
    return a(this, Be, "f");
  }
  abort() {
    this.controller.abort();
  }
  /**
   * Adds the listener function to the end of the listeners array for the event.
   * No checks are made to see if the listener has already been added. Multiple calls passing
   * the same combination of event and listener will result in the listener being added, and
   * called, multiple times.
   * @returns this MessageStream, so that calls can be chained
   */
  on(e, t) {
    return (a(this, B, "f")[e] || (a(this, B, "f")[e] = [])).push({ listener: t }), this;
  }
  /**
   * Removes the specified listener from the listener array for the event.
   * off() will remove, at most, one instance of a listener from the listener array. If any single
   * listener has been added multiple times to the listener array for the specified event, then
   * off() must be called multiple times to remove each instance.
   * @returns this MessageStream, so that calls can be chained
   */
  off(e, t) {
    const s = a(this, B, "f")[e];
    if (!s)
      return this;
    const n = s.findIndex((i) => i.listener === t);
    return n >= 0 && s.splice(n, 1), this;
  }
  /**
   * Adds a one-time listener function for the event. The next time the event is triggered,
   * this listener is removed and then invoked.
   * @returns this MessageStream, so that calls can be chained
   */
  once(e, t) {
    return (a(this, B, "f")[e] || (a(this, B, "f")[e] = [])).push({ listener: t, once: !0 }), this;
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
      d(this, D, !0), e !== "error" && this.once("error", s), this.once(e, t);
    });
  }
  async done() {
    d(this, D, !0), await a(this, ue, "f");
  }
  get currentMessage() {
    return a(this, q, "f");
  }
  /**
   * @returns a promise that resolves with the the final assistant Message response,
   * or rejects if an error occurred or the stream ended prematurely without producing a Message.
   * If structured outputs were used, this will be a ParsedMessage with a `parsed_output` field.
   */
  async finalMessage() {
    return await this.done(), a(this, v, "m", st).call(this);
  }
  /**
   * @returns a promise that resolves with the the final assistant Message's text response, concatenated
   * together if there are more than one text blocks.
   * Rejects if an error occurred or the stream ended prematurely without producing a Message.
   */
  async finalText() {
    return await this.done(), a(this, v, "m", Xt).call(this);
  }
  _emit(e, ...t) {
    if (a(this, he, "f"))
      return;
    e === "end" && (d(this, he, !0), a(this, Ne, "f").call(this));
    const s = a(this, B, "f")[e];
    if (s && (a(this, B, "f")[e] = s.filter((n) => !n.once), s.forEach(({ listener: n }) => n(...t))), e === "abort") {
      const n = t[0];
      !a(this, D, "f") && !s?.length && Promise.reject(n), a(this, le, "f").call(this, n), a(this, de, "f").call(this, n), this._emit("end");
      return;
    }
    if (e === "error") {
      const n = t[0];
      !a(this, D, "f") && !s?.length && Promise.reject(n), a(this, le, "f").call(this, n), a(this, de, "f").call(this, n), this._emit("end");
    }
  }
  _emitFinal() {
    this.receivedMessages.at(-1) && this._emit("finalMessage", a(this, v, "m", st).call(this));
  }
  async _fromReadableStream(e, t) {
    const s = t?.signal;
    let n;
    s && (s.aborted && this.controller.abort(), n = this.controller.abort.bind(this.controller), s.addEventListener("abort", n));
    try {
      a(this, v, "m", nt).call(this), this._connected(null);
      const i = O.fromReadableStream(e, this.controller);
      for await (const o of i)
        a(this, v, "m", it).call(this, o);
      if (i.controller.signal?.aborted)
        throw new E();
      a(this, v, "m", at).call(this);
    } finally {
      s && n && s.removeEventListener("abort", n);
    }
  }
  [(q = /* @__PURE__ */ new WeakMap(), K = /* @__PURE__ */ new WeakMap(), ce = /* @__PURE__ */ new WeakMap(), Oe = /* @__PURE__ */ new WeakMap(), le = /* @__PURE__ */ new WeakMap(), ue = /* @__PURE__ */ new WeakMap(), Ne = /* @__PURE__ */ new WeakMap(), de = /* @__PURE__ */ new WeakMap(), B = /* @__PURE__ */ new WeakMap(), he = /* @__PURE__ */ new WeakMap(), $e = /* @__PURE__ */ new WeakMap(), Be = /* @__PURE__ */ new WeakMap(), D = /* @__PURE__ */ new WeakMap(), Le = /* @__PURE__ */ new WeakMap(), je = /* @__PURE__ */ new WeakMap(), fe = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap(), v = /* @__PURE__ */ new WeakSet(), st = function() {
    if (this.receivedMessages.length === 0)
      throw new p("stream ended without producing a Message with role=assistant");
    return this.receivedMessages.at(-1);
  }, Xt = function() {
    if (this.receivedMessages.length === 0)
      throw new p("stream ended without producing a Message with role=assistant");
    const t = this.receivedMessages.at(-1).content.filter((s) => s.type === "text").map((s) => s.text);
    if (t.length === 0)
      throw new p("stream ended without producing a content block with type=text");
    return t.join(" ");
  }, nt = function() {
    this.ended || d(this, q, void 0);
  }, it = function(t) {
    if (this.ended)
      return;
    const s = a(this, v, "m", Kt).call(this, t);
    switch (this._emit("streamEvent", t, s), t.type) {
      case "content_block_delta": {
        const n = s.content.at(-1);
        switch (t.delta.type) {
          case "text_delta": {
            n.type === "text" && this._emit("text", t.delta.text, n.text || "");
            break;
          }
          case "citations_delta": {
            n.type === "text" && this._emit("citation", t.delta.citation, n.citations ?? []);
            break;
          }
          case "input_json_delta": {
            zt(n) && n.input && this._emit("inputJson", t.delta.partial_json, n.input);
            break;
          }
          case "thinking_delta": {
            n.type === "thinking" && this._emit("thinking", t.delta.thinking, n.thinking);
            break;
          }
          case "signature_delta": {
            n.type === "thinking" && this._emit("signature", n.signature);
            break;
          }
          default:
            t.delta;
        }
        break;
      }
      case "message_stop": {
        this._addMessageParam(s), this._addMessage(Jt(s, a(this, K, "f"), { logger: a(this, fe, "f") }), !0);
        break;
      }
      case "content_block_stop": {
        this._emit("contentBlock", s.content.at(-1));
        break;
      }
      case "message_start": {
        d(this, q, s);
        break;
      }
    }
  }, at = function() {
    if (this.ended)
      throw new p("stream has ended, this shouldn't happen");
    const t = a(this, q, "f");
    if (!t)
      throw new p("request ended without sending any chunks");
    return d(this, q, void 0), Jt(t, a(this, K, "f"), { logger: a(this, fe, "f") });
  }, Kt = function(t) {
    let s = a(this, q, "f");
    if (t.type === "message_start") {
      if (s)
        throw new p(`Unexpected event order, got ${t.type} before receiving "message_stop"`);
      return t.message;
    }
    if (!s)
      throw new p(`Unexpected event order, got ${t.type} before "message_start"`);
    switch (t.type) {
      case "message_stop":
        return s;
      case "message_delta":
        return s.stop_reason = t.delta.stop_reason, s.stop_sequence = t.delta.stop_sequence, s.usage.output_tokens = t.usage.output_tokens, t.usage.input_tokens != null && (s.usage.input_tokens = t.usage.input_tokens), t.usage.cache_creation_input_tokens != null && (s.usage.cache_creation_input_tokens = t.usage.cache_creation_input_tokens), t.usage.cache_read_input_tokens != null && (s.usage.cache_read_input_tokens = t.usage.cache_read_input_tokens), t.usage.server_tool_use != null && (s.usage.server_tool_use = t.usage.server_tool_use), s;
      case "content_block_start":
        return s.content.push({ ...t.content_block }), s;
      case "content_block_delta": {
        const n = s.content.at(t.index);
        switch (t.delta.type) {
          case "text_delta": {
            n?.type === "text" && (s.content[t.index] = {
              ...n,
              text: (n.text || "") + t.delta.text
            });
            break;
          }
          case "citations_delta": {
            n?.type === "text" && (s.content[t.index] = {
              ...n,
              citations: [...n.citations ?? [], t.delta.citation]
            });
            break;
          }
          case "input_json_delta": {
            if (n && zt(n)) {
              let i = n[Vt] || "";
              i += t.delta.partial_json;
              const o = { ...n };
              Object.defineProperty(o, Vt, {
                value: i,
                enumerable: !1,
                writable: !0
              }), i && (o.input = Is(i)), s.content[t.index] = o;
            }
            break;
          }
          case "thinking_delta": {
            n?.type === "thinking" && (s.content[t.index] = {
              ...n,
              thinking: n.thinking + t.delta.thinking
            });
            break;
          }
          case "signature_delta": {
            n?.type === "thinking" && (s.content[t.index] = {
              ...n,
              signature: t.delta.signature
            });
            break;
          }
          default:
            t.delta;
        }
        return s;
      }
      case "content_block_stop":
        return s;
    }
  }, Symbol.asyncIterator)]() {
    const e = [], t = [];
    let s = !1;
    return this.on("streamEvent", (n) => {
      const i = t.shift();
      i ? i.resolve(n) : e.push(n);
    }), this.on("end", () => {
      s = !0;
      for (const n of t)
        n.resolve(void 0);
      t.length = 0;
    }), this.on("abort", (n) => {
      s = !0;
      for (const i of t)
        i.reject(n);
      t.length = 0;
    }), this.on("error", (n) => {
      s = !0;
      for (const i of t)
        i.reject(n);
      t.length = 0;
    }), {
      next: async () => e.length ? { value: e.shift(), done: !1 } : s ? { value: void 0, done: !0 } : new Promise((i, o) => t.push({ resolve: i, reject: o })).then((i) => i ? { value: i, done: !1 } : { value: void 0, done: !0 }),
      return: async () => (this.abort(), { value: void 0, done: !0 })
    };
  }
  toReadableStream() {
    return new O(this[Symbol.asyncIterator].bind(this), this.controller).toReadableStream();
  }
}
class qs extends A {
  /**
   * Send a batch of Message creation requests.
   *
   * The Message Batches API can be used to process multiple Messages API requests at
   * once. Once a Message Batch is created, it begins processing immediately. Batches
   * can take up to 24 hours to complete.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.create({
   *   requests: [
   *     {
   *       custom_id: 'my-custom-id-1',
   *       params: {
   *         max_tokens: 1024,
   *         messages: [
   *           { content: 'Hello, world', role: 'user' },
   *         ],
   *         model: 'claude-opus-4-6',
   *       },
   *     },
   *   ],
   * });
   * ```
   */
  create(e, t) {
    return this._client.post("/v1/messages/batches", { body: e, ...t });
  }
  /**
   * This endpoint is idempotent and can be used to poll for Message Batch
   * completion. To access the results of a Message Batch, make a request to the
   * `results_url` field in the response.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.retrieve(
   *   'message_batch_id',
   * );
   * ```
   */
  retrieve(e, t) {
    return this._client.get(b`/v1/messages/batches/${e}`, t);
  }
  /**
   * List all Message Batches within a Workspace. Most recently created batches are
   * returned first.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const messageBatch of client.messages.batches.list()) {
   *   // ...
   * }
   * ```
   */
  list(e = {}, t) {
    return this._client.getAPIList("/v1/messages/batches", be, { query: e, ...t });
  }
  /**
   * Delete a Message Batch.
   *
   * Message Batches can only be deleted once they've finished processing. If you'd
   * like to delete an in-progress batch, you must first cancel it.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const deletedMessageBatch =
   *   await client.messages.batches.delete('message_batch_id');
   * ```
   */
  delete(e, t) {
    return this._client.delete(b`/v1/messages/batches/${e}`, t);
  }
  /**
   * Batches may be canceled any time before processing ends. Once cancellation is
   * initiated, the batch enters a `canceling` state, at which time the system may
   * complete any in-progress, non-interruptible requests before finalizing
   * cancellation.
   *
   * The number of canceled requests is specified in `request_counts`. To determine
   * which requests were canceled, check the individual results within the batch.
   * Note that cancellation may not result in any canceled requests if they were
   * non-interruptible.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatch = await client.messages.batches.cancel(
   *   'message_batch_id',
   * );
   * ```
   */
  cancel(e, t) {
    return this._client.post(b`/v1/messages/batches/${e}/cancel`, t);
  }
  /**
   * Streams the results of a Message Batch as a `.jsonl` file.
   *
   * Each line in the file is a JSON object containing the result of a single request
   * in the Message Batch. Results are not guaranteed to be in the same order as
   * requests. Use the `custom_id` field to match results to requests.
   *
   * Learn more about the Message Batches API in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/batch-processing)
   *
   * @example
   * ```ts
   * const messageBatchIndividualResponse =
   *   await client.messages.batches.results('message_batch_id');
   * ```
   */
  async results(e, t) {
    const s = await this.retrieve(e);
    if (!s.results_url)
      throw new p(`No batch \`results_url\`; Has it finished processing? ${s.processing_status} - ${s.id}`);
    return this._client.get(s.results_url, {
      ...t,
      headers: m([{ Accept: "application/binary" }, t?.headers]),
      stream: !0,
      __binaryResponse: !0
    })._thenUnwrap((n, i) => ze.fromResponse(i.response, i.controller));
  }
}
class bt extends A {
  constructor() {
    super(...arguments), this.batches = new qs(this._client);
  }
  create(e, t) {
    e.model in Gt && console.warn(`The model '${e.model}' is deprecated and will reach end-of-life on ${Gt[e.model]}
Please migrate to a newer model. Visit https://docs.anthropic.com/en/docs/resources/model-deprecations for more information.`), e.model in $r && e.thinking && e.thinking.type === "enabled" && console.warn(`Using Claude with ${e.model} and 'thinking.type=enabled' is deprecated. Use 'thinking.type=adaptive' instead which results in better model performance in our testing: https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking`);
    let s = this._client._options.timeout;
    if (!e.stream && s == null) {
      const i = Ps[e.model] ?? void 0;
      s = this._client.calculateNonstreamingTimeout(e.max_tokens, i);
    }
    const n = Ms(e.tools, e.messages);
    return this._client.post("/v1/messages", {
      body: e,
      timeout: s ?? 6e5,
      ...t,
      headers: m([n, t?.headers]),
      stream: e.stream ?? !1
    });
  }
  /**
   * Send a structured list of input messages with text and/or image content, along with an expected `output_config.format` and
   * the response will be automatically parsed and available in the `parsed_output` property of the message.
   *
   * @example
   * ```ts
   * const message = await client.messages.parse({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  parse(e, t) {
    return this.create(e, t).then((s) => Us(s, e, { logger: this._client.logger ?? console }));
  }
  /**
   * Create a Message stream.
   *
   * If `output_config.format` is provided with a parseable format (like `zodOutputFormat()`),
   * the final message will include a `parsed_output` property with the parsed content.
   *
   * @example
   * ```ts
   * const stream = client.messages.stream({
   *   model: 'claude-sonnet-4-5-20250929',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'What is 2+2?' }],
   *   output_config: {
   *     format: zodOutputFormat(z.object({ answer: z.number() })),
   *   },
   * });
   *
   * const message = await stream.finalMessage();
   * console.log(message.parsed_output?.answer); // 4
   * ```
   */
  stream(e, t) {
    return Je.createMessage(this, e, t, { logger: this._client.logger ?? console });
  }
  /**
   * Count the number of tokens in a Message.
   *
   * The Token Count API can be used to count the number of tokens in a Message,
   * including tools, images, and documents, without creating it.
   *
   * Learn more about token counting in our
   * [user guide](https://docs.claude.com/en/docs/build-with-claude/token-counting)
   *
   * @example
   * ```ts
   * const messageTokensCount =
   *   await client.messages.countTokens({
   *     messages: [{ content: 'string', role: 'user' }],
   *     model: 'claude-opus-4-6',
   *   });
   * ```
   */
  countTokens(e, t) {
    return this._client.post("/v1/messages/count_tokens", { body: e, ...t });
  }
}
const Gt = {
  "claude-1.3": "November 6th, 2024",
  "claude-1.3-100k": "November 6th, 2024",
  "claude-instant-1.1": "November 6th, 2024",
  "claude-instant-1.1-100k": "November 6th, 2024",
  "claude-instant-1.2": "November 6th, 2024",
  "claude-3-sonnet-20240229": "July 21st, 2025",
  "claude-3-opus-20240229": "January 5th, 2026",
  "claude-2.1": "July 21st, 2025",
  "claude-2.0": "July 21st, 2025",
  "claude-3-7-sonnet-latest": "February 19th, 2026",
  "claude-3-7-sonnet-20250219": "February 19th, 2026",
  "claude-3-5-haiku-latest": "February 19th, 2026",
  "claude-3-5-haiku-20241022": "February 19th, 2026"
}, $r = ["claude-opus-4-6"];
bt.Batches = qs;
class Cs extends A {
  /**
   * Get a specific model.
   *
   * The Models API response can be used to determine information about a specific
   * model or resolve a model alias to a model ID.
   */
  retrieve(e, t = {}, s) {
    const { betas: n } = t ?? {};
    return this._client.get(b`/v1/models/${e}`, {
      ...s,
      headers: m([
        { ...n?.toString() != null ? { "anthropic-beta": n?.toString() } : void 0 },
        s?.headers
      ])
    });
  }
  /**
   * List available models.
   *
   * The Models API response can be used to determine which models are available for
   * use in the API. More recently released models are listed first.
   */
  list(e = {}, t) {
    const { betas: s, ...n } = e ?? {};
    return this._client.getAPIList("/v1/models", be, {
      query: n,
      ...t,
      headers: m([
        { ...s?.toString() != null ? { "anthropic-beta": s?.toString() } : void 0 },
        t?.headers
      ])
    });
  }
}
const Ue = (r) => {
  if (typeof globalThis.process < "u")
    return globalThis.process.env?.[r]?.trim() ?? void 0;
  if (typeof globalThis.Deno < "u")
    return globalThis.Deno.env?.get?.(r)?.trim();
};
var pt, wt, Fe, Fs;
const Br = "\\n\\nHuman:", Lr = "\\n\\nAssistant:";
class y {
  /**
   * API Client for interfacing with the Anthropic API.
   *
   * @param {string | null | undefined} [opts.apiKey=process.env['ANTHROPIC_API_KEY'] ?? null]
   * @param {string | null | undefined} [opts.authToken=process.env['ANTHROPIC_AUTH_TOKEN'] ?? null]
   * @param {string} [opts.baseURL=process.env['ANTHROPIC_BASE_URL'] ?? https://api.anthropic.com] - Override the default base URL for the API.
   * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
   * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
   * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
   * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
   * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
   * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
   * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
   */
  constructor({ baseURL: e = Ue("ANTHROPIC_BASE_URL"), apiKey: t = Ue("ANTHROPIC_API_KEY") ?? null, authToken: s = Ue("ANTHROPIC_AUTH_TOKEN") ?? null, ...n } = {}) {
    pt.add(this), Fe.set(this, void 0);
    const i = {
      apiKey: t,
      authToken: s,
      ...n,
      baseURL: e || "https://api.anthropic.com"
    };
    if (!i.dangerouslyAllowBrowser && Qs())
      throw new p(`It looks like you're running in a browser-like environment.

This is disabled by default, as it risks exposing your secret API credentials to attackers.
If you understand the risks and have appropriate mitigations in place,
you can set the \`dangerouslyAllowBrowser\` option to \`true\`, e.g.,

new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
`);
    this.baseURL = i.baseURL, this.timeout = i.timeout ?? wt.DEFAULT_TIMEOUT, this.logger = i.logger ?? console;
    const o = "warn";
    this.logLevel = o, this.logLevel = Ot(i.logLevel, "ClientOptions.logLevel", this) ?? Ot(Ue("ANTHROPIC_LOG"), "process.env['ANTHROPIC_LOG']", this) ?? o, this.fetchOptions = i.fetchOptions, this.maxRetries = i.maxRetries ?? 2, this.fetch = i.fetch ?? rr(), d(this, Fe, ir), this._options = i, this.apiKey = typeof t == "string" ? t : null, this.authToken = s;
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
      authToken: this.authToken,
      ...e
    });
  }
  defaultQuery() {
    return this._options.defaultQuery;
  }
  validateHeaders({ values: e, nulls: t }) {
    if (!(e.get("x-api-key") || e.get("authorization")) && !(this.apiKey && e.get("x-api-key")) && !t.has("x-api-key") && !(this.authToken && e.get("authorization")) && !t.has("authorization"))
      throw new Error('Could not resolve authentication method. Expected either apiKey or authToken to be set. Or for one of the "X-Api-Key" or "Authorization" headers to be explicitly omitted');
  }
  async authHeaders(e) {
    return m([await this.apiKeyAuth(e), await this.bearerAuth(e)]);
  }
  async apiKeyAuth(e) {
    if (this.apiKey != null)
      return m([{ "X-Api-Key": this.apiKey }]);
  }
  async bearerAuth(e) {
    if (this.authToken != null)
      return m([{ Authorization: `Bearer ${this.authToken}` }]);
  }
  /**
   * Basic re-implementation of `qs.stringify` for primitive types.
   */
  stringifyQuery(e) {
    return Object.entries(e).filter(([t, s]) => typeof s < "u").map(([t, s]) => {
      if (typeof s == "string" || typeof s == "number" || typeof s == "boolean")
        return `${encodeURIComponent(t)}=${encodeURIComponent(s)}`;
      if (s === null)
        return `${encodeURIComponent(t)}=`;
      throw new p(`Cannot stringify type ${typeof s}; Expected string, number, boolean, or null. If you need to pass nested query parameters, you can manually encode them, e.g. { query: { 'foo[key1]': value1, 'foo[key2]': value2 } }, and please open a GitHub issue requesting better support for your use case.`);
    }).join("&");
  }
  getUserAgent() {
    return `${this.constructor.name}/JS ${V}`;
  }
  defaultIdempotencyKey() {
    return `stainless-node-retry-${ss()}`;
  }
  makeStatusError(e, t, s, n) {
    return S.generate(e, t, s, n);
  }
  buildURL(e, t, s) {
    const n = !a(this, pt, "m", Fs).call(this) && s || this.baseURL, i = Ks(e) ? new URL(e) : new URL(n + (n.endsWith("/") && e.startsWith("/") ? e.slice(1) : e)), o = this.defaultQuery();
    return Vs(o) || (t = { ...o, ...t }), typeof t == "object" && t && !Array.isArray(t) && (i.search = this.stringifyQuery(t)), i.toString();
  }
  _calculateNonstreamingTimeout(e) {
    if (3600 * e / 128e3 > 600)
      throw new p("Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#streaming-responses for more details");
    return 600 * 1e3;
  }
  /**
   * Used as a callback for mutating the given `FinalRequestOptions` object.
   */
  async prepareOptions(e) {
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
    return this.request(Promise.resolve(s).then((n) => ({ method: e, path: t, ...n })));
  }
  request(e, t = null) {
    return new Ve(this, this.makeRequest(e, t, void 0));
  }
  async makeRequest(e, t, s) {
    const n = await e, i = n.maxRetries ?? this.maxRetries;
    t == null && (t = i), await this.prepareOptions(n);
    const { req: o, url: c, timeout: u } = await this.buildRequest(n, {
      retryCount: i - t
    });
    await this.prepareRequest(o, { url: c, options: n });
    const l = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0"), h = s === void 0 ? "" : `, retryOf: ${s}`, g = Date.now();
    if (k(this).debug(`[${l}] sending request`, W({
      retryOfRequestLogID: s,
      method: n.method,
      url: c,
      options: n,
      headers: o.headers
    })), n.signal?.aborted)
      throw new E();
    const w = new AbortController(), f = await this.fetchWithTimeout(c, o, u, w).catch(ct), P = Date.now();
    if (f instanceof globalThis.Error) {
      const N = `retrying, ${t} attempts remaining`;
      if (n.signal?.aborted)
        throw new E();
      const I = ye(f) || /timed? ?out/i.test(String(f) + ("cause" in f ? String(f.cause) : ""));
      if (t)
        return k(this).info(`[${l}] connection ${I ? "timed out" : "failed"} - ${N}`), k(this).debug(`[${l}] connection ${I ? "timed out" : "failed"} (${N})`, W({
          retryOfRequestLogID: s,
          url: c,
          durationMs: P - g,
          message: f.message
        })), this.retryRequest(n, t, s ?? l);
      throw k(this).info(`[${l}] connection ${I ? "timed out" : "failed"} - error; no more retries left`), k(this).debug(`[${l}] connection ${I ? "timed out" : "failed"} (error; no more retries left)`, W({
        retryOfRequestLogID: s,
        url: c,
        durationMs: P - g,
        message: f.message
      })), I ? new rs() : new Ke({ cause: f });
    }
    const Ge = [...f.headers.entries()].filter(([N]) => N === "request-id").map(([N, I]) => ", " + N + ": " + JSON.stringify(I)).join(""), Ye = `[${l}${h}${Ge}] ${o.method} ${c} ${f.ok ? "succeeded" : "failed"} with status ${f.status} in ${P - g}ms`;
    if (!f.ok) {
      const N = await this.shouldRetry(f);
      if (t && N) {
        const ke = `retrying, ${t} attempts remaining`;
        return await nr(f.body), k(this).info(`${Ye} - ${ke}`), k(this).debug(`[${l}] response error (${ke})`, W({
          retryOfRequestLogID: s,
          url: f.url,
          status: f.status,
          headers: f.headers,
          durationMs: P - g
        })), this.retryRequest(n, t, s ?? l, f.headers);
      }
      const I = N ? "error; no more retries left" : "error; not retryable";
      k(this).info(`${Ye} - ${I}`);
      const kt = await f.text().catch((ke) => ct(ke).message), xt = hs(kt), Mt = xt ? void 0 : kt;
      throw k(this).debug(`[${l}] response error (${I})`, W({
        retryOfRequestLogID: s,
        url: f.url,
        status: f.status,
        headers: f.headers,
        message: Mt,
        durationMs: Date.now() - g
      })), this.makeStatusError(f.status, xt, Mt, f.headers);
    }
    return k(this).info(Ye), k(this).debug(`[${l}] response start`, W({
      retryOfRequestLogID: s,
      url: f.url,
      status: f.status,
      headers: f.headers,
      durationMs: P - g
    })), { response: f, options: n, controller: w, requestLogID: l, retryOfRequestLogID: s, startTime: g };
  }
  getAPIList(e, t, s) {
    return this.requestAPIList(t, s && "then" in s ? s.then((n) => ({ method: "get", path: e, ...n })) : { method: "get", path: e, ...s });
  }
  requestAPIList(e, t) {
    const s = this.makeRequest(t, null, void 0);
    return new pr(this, s, e);
  }
  async fetchWithTimeout(e, t, s, n) {
    const { signal: i, method: o, ...c } = t || {}, u = this._makeAbort(n);
    i && i.addEventListener("abort", u, { once: !0 });
    const l = setTimeout(u, s), h = globalThis.ReadableStream && c.body instanceof globalThis.ReadableStream || typeof c.body == "object" && c.body !== null && Symbol.asyncIterator in c.body, g = {
      signal: n.signal,
      ...h ? { duplex: "half" } : {},
      method: "GET",
      ...c
    };
    o && (g.method = o.toUpperCase());
    try {
      return await this.fetch.call(void 0, e, g);
    } finally {
      clearTimeout(l);
    }
  }
  async shouldRetry(e) {
    const t = e.headers.get("x-should-retry");
    return t === "true" ? !0 : t === "false" ? !1 : e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500;
  }
  async retryRequest(e, t, s, n) {
    let i;
    const o = n?.get("retry-after-ms");
    if (o) {
      const u = parseFloat(o);
      Number.isNaN(u) || (i = u);
    }
    const c = n?.get("retry-after");
    if (c && !i) {
      const u = parseFloat(c);
      Number.isNaN(u) ? i = Date.parse(c) - Date.now() : i = u * 1e3;
    }
    if (!(i && 0 <= i && i < 60 * 1e3)) {
      const u = e.maxRetries ?? this.maxRetries;
      i = this.calculateDefaultRetryTimeoutMillis(t, u);
    }
    return await Ys(i), this.makeRequest(e, t - 1, s);
  }
  calculateDefaultRetryTimeoutMillis(e, t) {
    const i = t - e, o = Math.min(0.5 * Math.pow(2, i), 8), c = 1 - Math.random() * 0.25;
    return o * c * 1e3;
  }
  calculateNonstreamingTimeout(e, t) {
    if (36e5 * e / 128e3 > 6e5 || t != null && e > t)
      throw new p("Streaming is required for operations that may take longer than 10 minutes. See https://github.com/anthropics/anthropic-sdk-typescript#long-requests for more details");
    return 6e5;
  }
  async buildRequest(e, { retryCount: t = 0 } = {}) {
    const s = { ...e }, { method: n, path: i, query: o, defaultBaseURL: c } = s, u = this.buildURL(i, o, c);
    "timeout" in s && Gs("timeout", s.timeout), s.timeout = s.timeout ?? this.timeout;
    const { bodyHeaders: l, body: h } = this.buildBody({ options: s }), g = await this.buildHeaders({ options: e, method: n, bodyHeaders: l, retryCount: t });
    return { req: {
      method: n,
      headers: g,
      ...s.signal && { signal: s.signal },
      ...globalThis.ReadableStream && h instanceof globalThis.ReadableStream && { duplex: "half" },
      ...h && { body: h },
      ...this.fetchOptions ?? {},
      ...s.fetchOptions ?? {}
    }, url: u, timeout: s.timeout };
  }
  async buildHeaders({ options: e, method: t, bodyHeaders: s, retryCount: n }) {
    let i = {};
    this.idempotencyHeader && t !== "get" && (e.idempotencyKey || (e.idempotencyKey = this.defaultIdempotencyKey()), i[this.idempotencyHeader] = e.idempotencyKey);
    const o = m([
      i,
      {
        Accept: "application/json",
        "User-Agent": this.getUserAgent(),
        "X-Stainless-Retry-Count": String(n),
        ...e.timeout ? { "X-Stainless-Timeout": String(Math.trunc(e.timeout / 1e3)) } : {},
        ...sr(),
        ...this._options.dangerouslyAllowBrowser ? { "anthropic-dangerous-direct-browser-access": "true" } : void 0,
        "anthropic-version": "2023-06-01"
      },
      await this.authHeaders(e),
      this._options.defaultHeaders,
      s,
      e.headers
    ]);
    return this.validateHeaders(o), o.values;
  }
  _makeAbort(e) {
    return () => e.abort();
  }
  buildBody({ options: { body: e, headers: t } }) {
    if (!e)
      return { bodyHeaders: void 0, body: void 0 };
    const s = m([t]);
    return (
      // Pass raw type verbatim
      ArrayBuffer.isView(e) || e instanceof ArrayBuffer || e instanceof DataView || typeof e == "string" && // Preserve legacy string encoding behavior for now
      s.values.has("content-type") || // `Blob` is superset of `File`
      globalThis.Blob && e instanceof globalThis.Blob || // `FormData` -> `multipart/form-data`
      e instanceof FormData || // `URLSearchParams` -> `application/x-www-form-urlencoded`
      e instanceof URLSearchParams || // Send chunked stream (each chunk has own `length`)
      globalThis.ReadableStream && e instanceof globalThis.ReadableStream ? { bodyHeaders: void 0, body: e } : typeof e == "object" && (Symbol.asyncIterator in e || Symbol.iterator in e && "next" in e && typeof e.next == "function") ? { bodyHeaders: void 0, body: ps(e) } : typeof e == "object" && s.values.get("content-type") === "application/x-www-form-urlencoded" ? {
        bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
        body: this.stringifyQuery(e)
      } : a(this, Fe, "f").call(this, { body: e, headers: s })
    );
  }
}
wt = y, Fe = /* @__PURE__ */ new WeakMap(), pt = /* @__PURE__ */ new WeakSet(), Fs = function() {
  return this.baseURL !== "https://api.anthropic.com";
};
y.Anthropic = wt;
y.HUMAN_PROMPT = Br;
y.AI_PROMPT = Lr;
y.DEFAULT_TIMEOUT = 6e5;
y.AnthropicError = p;
y.APIError = S;
y.APIConnectionError = Ke;
y.APIConnectionTimeoutError = rs;
y.APIUserAbortError = E;
y.NotFoundError = os;
y.ConflictError = cs;
y.RateLimitError = us;
y.BadRequestError = ns;
y.AuthenticationError = is;
y.InternalServerError = ds;
y.PermissionDeniedError = as;
y.UnprocessableEntityError = ls;
y.toFile = wr;
class Se extends y {
  constructor() {
    super(...arguments), this.completions = new Ls(this), this.messages = new bt(this), this.models = new Cs(this), this.beta = new Y(this);
  }
}
Se.Completions = Ls;
Se.Messages = bt;
Se.Models = Cs;
Se.Beta = Y;
if (!es) {
  let r = function(t) {
    const s = "validate.tsx";
    return {
      getScriptFileNames: () => [s],
      getScriptVersion: () => "0",
      getScriptSnapshot: (i) => {
        if (i === s) return e.ScriptSnapshot.fromString(t);
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => ({
        target: e.ScriptTarget.ESNext,
        module: e.ModuleKind.ESNext,
        jsx: e.JsxEmit.ReactJSX,
        strict: !1,
        noEmit: !0,
        skipLibCheck: !0,
        allowJs: !0,
        isolatedModules: !0
      }),
      getDefaultLibFileName: (i) => e.getDefaultLibFilePath(i),
      fileExists: e.sys.fileExists,
      readFile: e.sys.readFile,
      readDirectory: e.sys.readDirectory
    };
  };
  const e = require("typescript");
  H.on("message", (t) => {
    if (t.type === "validate")
      try {
        const s = r(t.snippet), n = e.createLanguageService(s), o = [
          ...n.getSyntacticDiagnostics("validate.tsx"),
          ...n.getSemanticDiagnostics("validate.tsx")
        ].filter((c) => c.category === e.DiagnosticCategory.Error);
        if (o.length === 0) {
          const c = { type: "result", error: null };
          H.postMessage(c);
        } else {
          const u = { type: "result", error: `TypeScript: ${o.slice(0, 3).map((l) => e.flattenDiagnosticMessageText(l.messageText, " ")).join("; ")}` };
          H.postMessage(u);
        }
      } catch (s) {
        const n = {
          type: "result",
          error: `TS worker error: ${s instanceof Error ? s.message : String(s)}`
        };
        H.postMessage(n);
      }
  });
}
class jr {
  _worker = null;
  async start() {
    if (this._worker !== null) return;
    const e = ts(import.meta.url);
    this._worker = new Zt(e, {
      workerData: null
      // Re-use the same compiled file; the !isMainThread block handles worker logic.
    }), this._worker.on("error", (t) => {
      console.error("[Bridge LSP] TypeScript worker error:", t), this._worker = null;
    });
  }
  async validateSnippet(e) {
    this._worker === null && await this.start();
    const t = this._worker;
    return new Promise((s) => {
      const n = (c) => {
        c.type === "result" && s(c.error);
      };
      t.once("message", n);
      const i = { type: "validate", snippet: e };
      t.postMessage(i);
      const o = setTimeout(() => {
        t.off("message", n), console.warn("[Bridge LSP] TypeScript validation timed out"), s(null);
      }, 5e3);
      t.once("message", () => clearTimeout(o));
    });
  }
  async stop() {
    this._worker !== null && (await this._worker.terminate(), this._worker = null);
  }
}
const De = new jr();
if (!es) {
  const { parse: r, compileTemplate: e, compileScript: t } = require("@vue/compiler-sfc");
  H.on("message", (s) => {
    if (s.type === "validate")
      try {
        const n = `<template>
${s.snippet}
</template>`, { descriptor: i, errors: o } = r(n, {
          filename: "bridge-validate.vue"
        }), c = [];
        for (const l of o)
          c.push(l.message);
        if (i.template) {
          const l = e({
            source: i.template.content,
            filename: "bridge-validate.vue",
            id: "bridge",
            compilerOptions: { mode: "module" }
          });
          for (const h of l.errors ?? [])
            c.push(typeof h == "string" ? h : h.message);
        }
        if (i.scriptSetup || i.script)
          try {
            const l = t(i, {
              id: "bridge",
              isProd: !1
            });
          } catch (l) {
            c.push(l instanceof Error ? l.message : String(l));
          }
        const u = {
          type: "result",
          error: c.length > 0 ? `Vue: ${c.slice(0, 3).join("; ")}` : null
        };
        H.postMessage(u);
      } catch (n) {
        const i = {
          type: "result",
          error: `Vue worker error: ${n instanceof Error ? n.message : String(n)}`
        };
        H.postMessage(i);
      }
  });
}
class Ur {
  _worker = null;
  async start() {
    if (this._worker !== null) return;
    const e = ts(import.meta.url);
    this._worker = new Zt(e, { workerData: null }), this._worker.on("error", (t) => {
      console.error("[Bridge LSP] Vue worker error:", t), this._worker = null;
    });
  }
  async validateSnippet(e) {
    this._worker === null && await this.start();
    const t = this._worker;
    return new Promise((s) => {
      const n = (c) => {
        c.type === "result" && s(c.error);
      };
      t.once("message", n);
      const i = { type: "validate", snippet: e };
      t.postMessage(i);
      const o = setTimeout(() => {
        t.off("message", n), console.warn("[Bridge LSP] Vue validation timed out"), s(null);
      }, 5e3);
      t.once("message", () => clearTimeout(o));
    });
  }
  async stop() {
    this._worker !== null && (await this._worker.terminate(), this._worker = null);
  }
}
const qr = new Ur(), Xe = Qt.join(Js(), ".bridge", "config.json"), Cr = "claude-3-7-sonnet-20250219";
async function St() {
  try {
    if (!Yt(Xe)) return {};
    const r = await Ds(Xe, "utf-8");
    return JSON.parse(r);
  } catch {
    return {};
  }
}
async function tn(r) {
  const e = Qt.dirname(Xe);
  Yt(e) || await Ws(e, { recursive: !0 });
  const t = await St();
  await Hs(Xe, JSON.stringify({ ...t, ...r }, null, 2), "utf-8");
}
async function sn() {
  const r = await St();
  return typeof r.apiKey == "string" && r.apiKey.length > 0;
}
const Fr = [
  {
    name: "bridge_read_code",
    description: "Read the current source code of the active file. Use this FIRST to understand component structure before proposing any changes.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bridge_read_tokens",
    description: "Read all design tokens from the Bridge token store. You MUST call this before proposing any className or style change. Only use token values that appear in this list. Never invent hex colours or pixel values.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bridge_audit_mithril",
    description: "Read all current Mithril Safety violations (color drift ΔE, typography, spacing, shadow, opacity). Use this to understand design system debt before proposing changes.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "bridge_audit_a11y",
    description: "Read all current WCAG 2.1 AA accessibility violations. Verify your proposed changes do not introduce new violations.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  // ── Mutation tools (Phase M — strictly granular, node-targeted) ─────────────
  {
    name: "bridge_update_props",
    description: `Modify one or more JSX attributes on a single target node.

Commandment 15 rules (mandatory):
- targetId MUST be a data-bridge-id value read from bridge_read_code. Never invent IDs.
- Never remove or change a data-bridge-id attribute.
- className values MUST use Tailwind classes mapped to tokens from bridge_read_tokens.
- Only call bridge_read_tokens first if you haven't already in this turn.`,
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the target JSX element." },
        props: {
          type: "object",
          description: 'Key-value pairs of JSX attribute names to new string values. E.g. { "className": "bg-brand-primary", "aria-label": "Submit" }',
          additionalProperties: { type: "string" }
        },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "props", "reasoning"]
    }
  },
  {
    name: "bridge_update_text",
    description: "Modify the visible text content of a single JSX element. Use this for copy changes, label updates, and heading edits.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the target JSX element." },
        text: { type: "string", description: "New text content to set." },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "text", "reasoning"]
    }
  },
  {
    name: "bridge_insert_node",
    description: `Insert a new JSX element relative to an existing target node.
position: 'before' | 'after' | 'firstChild' | 'lastChild'
Only use element types that exist in the design system read from bridge_read_tokens or the source file imports.`,
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the reference node." },
        position: { type: "string", enum: ["before", "after", "firstChild", "lastChild"] },
        nodeType: { type: "string", description: 'JSX element tag name, e.g. "div", "Button", "p".' },
        props: {
          type: "object",
          description: "Optional JSX attributes for the new element.",
          additionalProperties: { type: "string" }
        },
        children: { type: "string", description: "Optional text content or JSX children (must be safe JSX)." },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "position", "nodeType", "reasoning"]
    }
  },
  {
    name: "bridge_wrap_node",
    description: "Wrap an existing JSX element in a new parent element. Use for layout restructuring only.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the node to wrap." },
        wrapperType: { type: "string", description: 'JSX tag for the new wrapper, e.g. "div", "section".' },
        props: {
          type: "object",
          description: "Optional JSX attributes for the wrapper element.",
          additionalProperties: { type: "string" }
        },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "wrapperType", "reasoning"]
    }
  },
  {
    name: "bridge_delete_node",
    description: "Remove a JSX element and all its children from the tree. This also clears any component_overrides rows for the deleted node.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the element to remove." },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "reasoning"]
    }
  },
  {
    name: "bridge_add_class",
    description: "Append one design-token Tailwind class to a node's className. Call bridge_read_tokens first to find valid class names.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the target node." },
        className: { type: "string", description: 'Single Tailwind class to add, e.g. "mt-4" or "bg-brand-primary".' },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "className", "reasoning"]
    }
  },
  {
    name: "bridge_remove_class",
    description: "Remove one specific Tailwind class from a node's className.",
    input_schema: {
      type: "object",
      properties: {
        targetId: { type: "string", description: "data-bridge-id of the target node." },
        className: { type: "string", description: "Exact class string to remove." },
        reasoning: { type: "string", description: "One-sentence explanation shown in the UI diff card." }
      },
      required: ["targetId", "className", "reasoning"]
    }
  },
  // ── Phase M: Design System RAG Search ─────────────────────────────────────
  {
    name: "bridge_search_design_system",
    description: "Search the design system knowledge base for component patterns, usage guidelines, and documentation. Use this when you need context about how components should be structured, which patterns to follow, or to find existing design system conventions before proposing changes.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query describing what you need to know about the design system." }
      },
      required: ["query"]
    }
  }
], ot = `You are the Bridge Auditor, an AI assistant integrated into Bridge IDE — the world's first Agentic UI Operating System. Your role is to make precise, design-system-compliant, accessible component edits using the Bridge tool catalog.

## Non-Negotiable Rules (Commandments 15 & 16)

1. **Granular Tools Only**: You MUST only use the tools provided. You may NEVER generate raw source code strings or full-file replacements. Every edit must target a specific data-bridge-id.

2. **No Hallucinated IDs**: Every targetId you use MUST come from the source code returned by bridge_read_code. Never invent or guess a bridge ID.

3. **No Hallucinated Styling**: Before proposing any className, call bridge_read_tokens. Only use token classes in the result.

4. **Preserve data-bridge-id**: Never remove or change a data-bridge-id attribute in any mutation.

5. **Accessibility First**: If your task touches interactive elements (button, a, input, img), call bridge_audit_a11y first. Fix violations as part of your response.

## Workflow

For every task:
1. bridge_read_code → understand the structure and collect real bridge IDs
2. bridge_read_tokens → get valid token classes (skip only for non-style tasks)
3. Propose the minimum set of granular tool calls needed
4. Always include concise reasoning in every tool call

Always be concise. The user is an engineer; skip preamble.`;
function Dr(r) {
  if (!r) return De;
  const e = r.split(".").pop()?.toLowerCase() ?? "";
  return e === "vue" ? qr : De;
}
const Wr = /* @__PURE__ */ new Set([
  "bridge_update_props",
  "bridge_update_text",
  "bridge_insert_node",
  "bridge_wrap_node",
  "bridge_delete_node",
  "bridge_add_class",
  "bridge_remove_class"
]);
async function Hr(r, e, t = De) {
  if (!Wr.has(r)) return null;
  if (r === "bridge_update_props") {
    const n = e.props ?? {};
    for (const [i, o] of Object.entries(n)) {
      if (i === "data-bridge-id")
        return "Commandment 7 violation: data-bridge-id must never be modified.";
      if (typeof o != "string")
        return `Prop "${i}" value must be a plain string, not a JS expression.`;
    }
    return null;
  }
  if (r === "bridge_add_class" || r === "bridge_remove_class") {
    const n = typeof e.className == "string" ? e.className : "";
    return n.trim().includes(" ") ? `className must be a single class token, not a compound string. Got: "${n}". Call this tool once per class.` : null;
  }
  let s = null;
  if (r === "bridge_insert_node") {
    const n = typeof e.nodeType == "string" ? e.nodeType : "div", i = typeof e.children == "string" ? e.children : "";
    s = `const __v = <${n}>${i}</${n}>;`;
  } else if (r === "bridge_wrap_node") {
    const n = typeof e.wrapperType == "string" ? e.wrapperType : "div";
    s = `const __v = <${n}><div /></${n}>;`;
  }
  return s !== null ? await t.validateSnippet(s) : null;
}
async function rn(r, e, t) {
  const s = Dr(t), n = await St();
  if (!n.apiKey) {
    e({ type: "error", error: "No API key configured. Open AI Settings to set a key." });
    return;
  }
  try {
    if (n.provider === "openai") {
      const i = (await import("./index-CYGJdSd4.js")).default, o = new i({
        apiKey: n.apiKey,
        ...n.baseURL ? { baseURL: n.baseURL } : {}
      }), c = n.model && n.model.length > 0 ? n.model : "gpt-4o", u = await o.chat.completions.create({
        model: c,
        stream: !0,
        messages: [
          { role: "system", content: ot },
          ...r.filter((l) => l.role === "user" || l.role === "assistant").map((l) => ({ role: l.role, content: l.content }))
        ]
      });
      for await (const l of u) {
        const h = l.choices[0]?.delta;
        h?.content && e({ type: "text", text: h.content });
      }
      e({ type: "done" });
    } else if (n.provider === "gemini") {
      const { GoogleGenAI: i } = await import("./index-CCc6wlfB.js"), o = new i({
        apiKey: n.apiKey,
        ...n.baseURL ? { baseUrl: n.baseURL } : {}
      }), c = n.model && n.model.length > 0 ? n.model : "gemini-2.5-flash", u = await o.models.generateContentStream({
        model: c,
        contents: r.filter((l) => l.role === "user" || l.role === "assistant").map((l) => ({ role: l.role === "assistant" ? "model" : "user", parts: [{ text: l.content }] })),
        config: { systemInstruction: ot }
      });
      for await (const l of u)
        l.text && e({ type: "text", text: l.text });
      e({ type: "done" });
    } else {
      const i = new Se({
        apiKey: n.apiKey,
        ...n.baseURL ? { baseURL: n.baseURL } : {}
      }), o = n.model && n.model.length > 0 ? n.model : Cr, c = [];
      for (const l of r)
        if (l.role === "user" || l.role === "assistant") {
          const h = c[c.length - 1];
          h && h.role === l.role ? typeof h.content == "string" ? h.content = [{ type: "text", text: h.content }, { type: "text", text: l.content }] : h.content.push({ type: "text", text: l.content }) : c.push({ role: l.role, content: l.content });
        } else if (l.role === "tool_call") {
          const h = c[c.length - 1], g = {
            type: "tool_use",
            id: l.toolUseId,
            name: l.toolName,
            input: l.toolInput || {}
          };
          h && h.role === "assistant" ? (typeof h.content == "string" && (h.content = [{ type: "text", text: h.content }]), h.content.push(g)) : c.push({
            role: "assistant",
            content: [g]
          });
        } else if (l.role === "tool_result") {
          const h = c[c.length - 1], g = {
            type: "tool_result",
            tool_use_id: l.toolUseId,
            content: l.content
          };
          h && h.role === "user" ? (typeof h.content == "string" && (h.content = [{ type: "text", text: h.content }]), h.content.push(g)) : c.push({
            role: "user",
            content: [g]
          });
        }
      const u = await i.messages.stream({
        model: o,
        max_tokens: 4096,
        system: ot,
        tools: Fr,
        messages: c
      });
      for await (const l of u)
        if (l.type === "content_block_delta")
          l.delta.type === "text_delta" && e({ type: "text", text: l.delta.text });
        else if (l.type === "content_block_start")
          l.content_block.type === "tool_use" && e({
            type: "tool_call",
            toolName: l.content_block.name,
            toolUseId: l.content_block.id,
            toolInput: {}
          });
        else if (l.type === "message_stop") {
          const h = await u.finalMessage();
          for (const g of h.content)
            if (g.type === "tool_use") {
              const w = g.input, f = await Hr(g.name, w, s);
              f ? (console.warn(`[Bridge] Phase M validation blocked tool ${g.name}: ${f}`), e({
                type: "validation_error",
                toolName: g.name,
                toolUseId: g.id,
                error: f
              })) : e({
                type: "tool_call",
                toolName: g.name,
                toolUseId: g.id,
                toolInput: w
              });
            }
          e({ type: "done" });
        }
    }
  } catch (i) {
    const o = i instanceof Error ? i.message : String(i);
    e({ type: "error", error: `API error: ${o}` });
  }
}
export {
  Fr as BRIDGE_TOOLS,
  ot as SYSTEM_PROMPT,
  sn as hasApiKey,
  St as readConfig,
  rn as sendChatMessage,
  tn as writeConfig
};
