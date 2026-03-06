import { e as R, a as kn, l as Su, L as V, b as Pu, d as Rn, f as Bt, g as be, U as Al, h as Ms, i as Iu, E as Re, w as ft, j as Nu, k as $u, m as xn, n as wu, o as _t, p as Cu, q as Br, s as vu, t as ku, u as Ru, v as Du, x as Ou, y as Lu, z as Mu, A as Tu, B as Bu, C as _u, D as Fu, F as Kn, T as zu, G as Vu, H as Uu, I as gs, J as xl, K as ju, M as fr, N as Hu, O as Gu, P as Wu, Q as Ku, R as _r, S as Fr, V as qu, W as Xu, X as Dt, Y as Sl, Z as Ju, _ as Yu, $ as Qu, a0 as qn, a1 as De, a2 as Sn, a3 as He, a4 as Zu, a5 as eh, a6 as th, a7 as sh, a8 as nh, a9 as Dn, aa as Oe, ab as ih, ac as rh, ad as ah, ae as ja, af as oh, ag as lh, ah as Ze, ai as zr, aj as ch, ak as Pl, al as uh, am as hh, an as Vr, ao as Il, ap as Nl, aq as dh, ar as Ur, as as xt, at as $l, au as js, av as On, aw as ph, ax as fh, ay as mh, az as gh, aA as yh, aB as Eh, aC as bh, aD as wl, aE as Cl, aF as Ah, aG as vl, aH as ss, aI as xh, aJ as Sh, aK as Ph, aL as Ih, aM as Nh, aN as $h, aO as wh, aP as Ch, aQ as vh, aR as kh, aS as kl, aT as Rh, aU as Dh, aV as Oh, aW as Rl, aX as Ln, aY as Lh, aZ as Dl, a_ as Mh, a$ as Th, b0 as mr, b1 as Ha, b2 as Ga, b3 as Bh, b4 as _h, b5 as Fh, b6 as zh, b7 as Vh, b8 as Uh, b9 as Xt, ba as yt, bb as jh, bc as Hh, bd as Gh, be as Wa, bf as Ka, bg as Wh, bh as Kh, bi as qh, bj as Xh, bk as Jh, bl as Yh, bm as Qh, bn as Zh, bo as ed, bp as Ol, bq as td, br as Ll, bs as sd, bt as nd, bu as id, bv as rd, bw as qa, bx as ad, by as od, bz as ld, bA as Ml, bB as cd, bC as Xa } from "./main-CEfjB-ow.js";
import { basename as os, extname as ns, resolve as We, dirname as St, relative as jr } from "node:path";
import { posix as Tl, isAbsolute as ud, resolve as hd, win32 as dd } from "path";
import ls, { env as Ja } from "node:process";
import { performance as Bl } from "node:perf_hooks";
import * as pd from "node:fs/promises";
function fd(i, e) {
  for (var t = 0; t < e.length; t++) {
    const s = e[t];
    if (typeof s != "string" && !Array.isArray(s))
      for (const n in s)
        n !== "default" && !(n in i) && (i[n] = s[n]);
  }
  return Object.defineProperty(i, Symbol.toStringTag, { value: "Module" });
}
var Xn = "4.58.0", _l = 44, md = 59, Ya = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", Fl = new Uint8Array(64), zl = new Uint8Array(128);
for (let i = 0; i < Ya.length; i++) {
  const e = Ya.charCodeAt(i);
  Fl[i] = e, zl[e] = i;
}
function Is(i, e) {
  let t = 0, s = 0, n = 0;
  do {
    const a = i.next();
    n = zl[a], t |= (n & 31) << s, s += 5;
  } while (n & 32);
  const r = t & 1;
  return t >>>= 1, r && (t = -2147483648 | -t), e + t;
}
function Ns(i, e, t) {
  let s = e - t;
  s = s < 0 ? -s << 1 | 1 : s << 1;
  do {
    let n = s & 31;
    s >>>= 5, s > 0 && (n |= 32), i.write(Fl[n]);
  } while (s > 0);
  return e;
}
function Qa(i, e) {
  return i.pos >= e ? !1 : i.peek() !== _l;
}
var Za = 1024 * 16, eo = typeof TextDecoder < "u" ? /* @__PURE__ */ new TextDecoder() : typeof Buffer < "u" ? {
  decode(i) {
    return Buffer.from(i.buffer, i.byteOffset, i.byteLength).toString();
  }
} : {
  decode(i) {
    let e = "";
    for (let t = 0; t < i.length; t++)
      e += String.fromCharCode(i[t]);
    return e;
  }
}, gd = class {
  constructor() {
    this.pos = 0, this.out = "", this.buffer = new Uint8Array(Za);
  }
  write(i) {
    const { buffer: e } = this;
    e[this.pos++] = i, this.pos === Za && (this.out += eo.decode(e), this.pos = 0);
  }
  flush() {
    const { buffer: i, out: e, pos: t } = this;
    return t > 0 ? e + eo.decode(i.subarray(0, t)) : e;
  }
}, yd = class {
  constructor(i) {
    this.pos = 0, this.buffer = i;
  }
  next() {
    return this.buffer.charCodeAt(this.pos++);
  }
  peek() {
    return this.buffer.charCodeAt(this.pos);
  }
  indexOf(i) {
    const { buffer: e, pos: t } = this, s = e.indexOf(i, t);
    return s === -1 ? e.length : s;
  }
};
function Ed(i) {
  const { length: e } = i, t = new yd(i), s = [];
  let n = 0, r = 0, a = 0, o = 0, l = 0;
  do {
    const c = t.indexOf(";"), h = [];
    let p = !0, d = 0;
    for (n = 0; t.pos < c; ) {
      let m;
      n = Is(t, n), n < d && (p = !1), d = n, Qa(t, c) ? (r = Is(t, r), a = Is(t, a), o = Is(t, o), Qa(t, c) ? (l = Is(t, l), m = [n, r, a, o, l]) : m = [n, r, a, o]) : m = [n], h.push(m), t.pos++;
    }
    p || bd(h), s.push(h), t.pos = c + 1;
  } while (t.pos <= e);
  return s;
}
function bd(i) {
  i.sort(Ad);
}
function Ad(i, e) {
  return i[0] - e[0];
}
function Vl(i) {
  const e = new gd();
  let t = 0, s = 0, n = 0, r = 0;
  for (let a = 0; a < i.length; a++) {
    const o = i[a];
    if (a > 0 && e.write(md), o.length === 0) continue;
    let l = 0;
    for (let c = 0; c < o.length; c++) {
      const h = o[c];
      c > 0 && e.write(_l), l = Ns(e, h[0], l), h.length !== 1 && (t = Ns(e, h[1], t), s = Ns(e, h[2], s), n = Ns(e, h[3], n), h.length !== 4 && (r = Ns(e, h[4], r)));
    }
  }
  return e.flush();
}
class Mn {
  constructor(e) {
    this.bits = e instanceof Mn ? e.bits.slice() : [];
  }
  add(e) {
    this.bits[e >> 5] |= 1 << (e & 31);
  }
  has(e) {
    return !!(this.bits[e >> 5] & 1 << (e & 31));
  }
}
let to = class gr {
  constructor(e, t, s) {
    this.start = e, this.end = t, this.original = s, this.intro = "", this.outro = "", this.content = s, this.storeName = !1, this.edited = !1, this.previous = null, this.next = null;
  }
  appendLeft(e) {
    this.outro += e;
  }
  appendRight(e) {
    this.intro = this.intro + e;
  }
  clone() {
    const e = new gr(this.start, this.end, this.original);
    return e.intro = this.intro, e.outro = this.outro, e.content = this.content, e.storeName = this.storeName, e.edited = this.edited, e;
  }
  contains(e) {
    return this.start < e && e < this.end;
  }
  eachNext(e) {
    let t = this;
    for (; t; )
      e(t), t = t.next;
  }
  eachPrevious(e) {
    let t = this;
    for (; t; )
      e(t), t = t.previous;
  }
  edit(e, t, s) {
    return this.content = e, s || (this.intro = "", this.outro = ""), this.storeName = t, this.edited = !0, this;
  }
  prependLeft(e) {
    this.outro = e + this.outro;
  }
  prependRight(e) {
    this.intro = e + this.intro;
  }
  reset() {
    this.intro = "", this.outro = "", this.edited && (this.content = this.original, this.storeName = !1, this.edited = !1);
  }
  split(e) {
    const t = e - this.start, s = this.original.slice(0, t), n = this.original.slice(t);
    this.original = s;
    const r = new gr(e, this.end, n);
    return r.outro = this.outro, this.outro = "", this.end = e, this.edited ? (r.edit("", !1), this.content = "") : this.content = s, r.next = this.next, r.next && (r.next.previous = r), r.previous = this, this.next = r, r;
  }
  toString() {
    return this.intro + this.content + this.outro;
  }
  trimEnd(e) {
    if (this.outro = this.outro.replace(e, ""), this.outro.length) return !0;
    const t = this.content.replace(e, "");
    if (t.length)
      return t !== this.content && (this.split(this.start + t.length).edit("", void 0, !0), this.edited && this.edit(t, this.storeName, !0)), !0;
    if (this.edit("", void 0, !0), this.intro = this.intro.replace(e, ""), this.intro.length) return !0;
  }
  trimStart(e) {
    if (this.intro = this.intro.replace(e, ""), this.intro.length) return !0;
    const t = this.content.replace(e, "");
    if (t.length) {
      if (t !== this.content) {
        const s = this.split(this.end - t.length);
        this.edited && s.edit(t, this.storeName, !0), this.edit("", void 0, !0);
      }
      return !0;
    } else if (this.edit("", void 0, !0), this.outro = this.outro.replace(e, ""), this.outro.length) return !0;
  }
};
function xd() {
  return typeof globalThis < "u" && typeof globalThis.btoa == "function" ? (i) => globalThis.btoa(unescape(encodeURIComponent(i))) : typeof Buffer == "function" ? (i) => Buffer.from(i, "utf-8").toString("base64") : () => {
    throw new Error("Unsupported environment: `window.btoa` or `Buffer` should be supported.");
  };
}
const Sd = /* @__PURE__ */ xd();
class Jn {
  constructor(e) {
    this.version = 3, this.file = e.file, this.sources = e.sources, this.sourcesContent = e.sourcesContent, this.names = e.names, this.mappings = Vl(e.mappings), typeof e.x_google_ignoreList < "u" && (this.x_google_ignoreList = e.x_google_ignoreList), typeof e.debugId < "u" && (this.debugId = e.debugId);
  }
  toString() {
    return JSON.stringify(this);
  }
  toUrl() {
    return "data:application/json;charset=utf-8;base64," + Sd(this.toString());
  }
}
function Pd(i) {
  const e = i.split(`
`), t = e.filter((r) => /^\t+/.test(r)), s = e.filter((r) => /^ {2,}/.test(r));
  if (t.length === 0 && s.length === 0)
    return null;
  if (t.length >= s.length)
    return "	";
  const n = s.reduce((r, a) => {
    const o = /^ +/.exec(a)[0].length;
    return Math.min(o, r);
  }, 1 / 0);
  return new Array(n + 1).join(" ");
}
function Ul(i, e) {
  const t = i.split(/[/\\]/), s = e.split(/[/\\]/);
  for (t.pop(); t[0] === s[0]; )
    t.shift(), s.shift();
  if (t.length) {
    let n = t.length;
    for (; n--; ) t[n] = "..";
  }
  return t.concat(s).join("/");
}
const Id = Object.prototype.toString;
function jl(i) {
  return Id.call(i) === "[object Object]";
}
function yr(i) {
  const e = i.split(`
`), t = [];
  for (let s = 0, n = 0; s < e.length; s++)
    t.push(n), n += e[s].length + 1;
  return function(n) {
    let r = 0, a = t.length;
    for (; r < a; ) {
      const c = r + a >> 1;
      n < t[c] ? a = c : r = c + 1;
    }
    const o = r - 1, l = n - t[o];
    return { line: o, column: l };
  };
}
const Nd = /\w/;
class Hl {
  constructor(e) {
    this.hires = e, this.generatedCodeLine = 0, this.generatedCodeColumn = 0, this.raw = [], this.rawSegments = this.raw[this.generatedCodeLine] = [], this.pending = null;
  }
  addEdit(e, t, s, n) {
    if (t.length) {
      const r = t.length - 1;
      let a = t.indexOf(`
`, 0), o = -1;
      for (; a >= 0 && r > a; ) {
        const c = [this.generatedCodeColumn, e, s.line, s.column];
        n >= 0 && c.push(n), this.rawSegments.push(c), this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, o = a, a = t.indexOf(`
`, a + 1);
      }
      const l = [this.generatedCodeColumn, e, s.line, s.column];
      n >= 0 && l.push(n), this.rawSegments.push(l), this.advance(t.slice(o + 1));
    } else this.pending && (this.rawSegments.push(this.pending), this.advance(t));
    this.pending = null;
  }
  addUneditedChunk(e, t, s, n, r) {
    let a = t.start, o = !0, l = !1;
    for (; a < t.end; ) {
      if (s[a] === `
`)
        n.line += 1, n.column = 0, this.generatedCodeLine += 1, this.raw[this.generatedCodeLine] = this.rawSegments = [], this.generatedCodeColumn = 0, o = !0, l = !1;
      else {
        if (this.hires || o || r.has(a)) {
          const c = [this.generatedCodeColumn, e, n.line, n.column];
          this.hires === "boundary" ? Nd.test(s[a]) ? l || (this.rawSegments.push(c), l = !0) : (this.rawSegments.push(c), l = !1) : this.rawSegments.push(c);
        }
        n.column += 1, this.generatedCodeColumn += 1, o = !1;
      }
      a += 1;
    }
    this.pending = null;
  }
  advance(e) {
    if (!e) return;
    const t = e.split(`
`);
    if (t.length > 1) {
      for (let s = 0; s < t.length - 1; s++)
        this.generatedCodeLine++, this.raw[this.generatedCodeLine] = this.rawSegments = [];
      this.generatedCodeColumn = 0;
    }
    this.generatedCodeColumn += t[t.length - 1].length;
  }
}
const $s = `
`, Jt = {
  insertLeft: !1,
  insertRight: !1,
  storeName: !1
};
class Ft {
  constructor(e, t = {}) {
    const s = new to(0, e.length, e);
    Object.defineProperties(this, {
      original: { writable: !0, value: e },
      outro: { writable: !0, value: "" },
      intro: { writable: !0, value: "" },
      firstChunk: { writable: !0, value: s },
      lastChunk: { writable: !0, value: s },
      lastSearchedChunk: { writable: !0, value: s },
      byStart: { writable: !0, value: {} },
      byEnd: { writable: !0, value: {} },
      filename: { writable: !0, value: t.filename },
      indentExclusionRanges: { writable: !0, value: t.indentExclusionRanges },
      sourcemapLocations: { writable: !0, value: new Mn() },
      storedNames: { writable: !0, value: {} },
      indentStr: { writable: !0, value: void 0 },
      ignoreList: { writable: !0, value: t.ignoreList },
      offset: { writable: !0, value: t.offset || 0 }
    }), this.byStart[0] = s, this.byEnd[e.length] = s;
  }
  addSourcemapLocation(e) {
    this.sourcemapLocations.add(e);
  }
  append(e) {
    if (typeof e != "string") throw new TypeError("outro content must be a string");
    return this.outro += e, this;
  }
  appendLeft(e, t) {
    if (e = e + this.offset, typeof t != "string") throw new TypeError("inserted content must be a string");
    this._split(e);
    const s = this.byEnd[e];
    return s ? s.appendLeft(t) : this.intro += t, this;
  }
  appendRight(e, t) {
    if (e = e + this.offset, typeof t != "string") throw new TypeError("inserted content must be a string");
    this._split(e);
    const s = this.byStart[e];
    return s ? s.appendRight(t) : this.outro += t, this;
  }
  clone() {
    const e = new Ft(this.original, { filename: this.filename, offset: this.offset });
    let t = this.firstChunk, s = e.firstChunk = e.lastSearchedChunk = t.clone();
    for (; t; ) {
      e.byStart[s.start] = s, e.byEnd[s.end] = s;
      const n = t.next, r = n && n.clone();
      r && (s.next = r, r.previous = s, s = r), t = n;
    }
    return e.lastChunk = s, this.indentExclusionRanges && (e.indentExclusionRanges = this.indentExclusionRanges.slice()), e.sourcemapLocations = new Mn(this.sourcemapLocations), e.intro = this.intro, e.outro = this.outro, e;
  }
  generateDecodedMap(e) {
    e = e || {};
    const t = 0, s = Object.keys(this.storedNames), n = new Hl(e.hires), r = yr(this.original);
    return this.intro && n.advance(this.intro), this.firstChunk.eachNext((a) => {
      const o = r(a.start);
      a.intro.length && n.advance(a.intro), a.edited ? n.addEdit(
        t,
        a.content,
        o,
        a.storeName ? s.indexOf(a.original) : -1
      ) : n.addUneditedChunk(t, a, this.original, o, this.sourcemapLocations), a.outro.length && n.advance(a.outro);
    }), this.outro && n.advance(this.outro), {
      file: e.file ? e.file.split(/[/\\]/).pop() : void 0,
      sources: [
        e.source ? Ul(e.file || "", e.source) : e.file || ""
      ],
      sourcesContent: e.includeContent ? [this.original] : void 0,
      names: s,
      mappings: n.raw,
      x_google_ignoreList: this.ignoreList ? [t] : void 0
    };
  }
  generateMap(e) {
    return new Jn(this.generateDecodedMap(e));
  }
  _ensureindentStr() {
    this.indentStr === void 0 && (this.indentStr = Pd(this.original));
  }
  _getRawIndentString() {
    return this._ensureindentStr(), this.indentStr;
  }
  getIndentString() {
    return this._ensureindentStr(), this.indentStr === null ? "	" : this.indentStr;
  }
  indent(e, t) {
    const s = /^[^\r\n]/gm;
    if (jl(e) && (t = e, e = void 0), e === void 0 && (this._ensureindentStr(), e = this.indentStr || "	"), e === "") return this;
    t = t || {};
    const n = {};
    t.exclude && (typeof t.exclude[0] == "number" ? [t.exclude] : t.exclude).forEach((h) => {
      for (let p = h[0]; p < h[1]; p += 1)
        n[p] = !0;
    });
    let r = t.indentStart !== !1;
    const a = (c) => r ? `${e}${c}` : (r = !0, c);
    this.intro = this.intro.replace(s, a);
    let o = 0, l = this.firstChunk;
    for (; l; ) {
      const c = l.end;
      if (l.edited)
        n[o] || (l.content = l.content.replace(s, a), l.content.length && (r = l.content[l.content.length - 1] === `
`));
      else
        for (o = l.start; o < c; ) {
          if (!n[o]) {
            const h = this.original[o];
            h === `
` ? r = !0 : h !== "\r" && r && (r = !1, o === l.start || (this._splitChunk(l, o), l = l.next), l.prependRight(e));
          }
          o += 1;
        }
      o = l.end, l = l.next;
    }
    return this.outro = this.outro.replace(s, a), this;
  }
  insert() {
    throw new Error(
      "magicString.insert(...) is deprecated. Use prependRight(...) or appendLeft(...)"
    );
  }
  insertLeft(e, t) {
    return Jt.insertLeft || (console.warn(
      "magicString.insertLeft(...) is deprecated. Use magicString.appendLeft(...) instead"
    ), Jt.insertLeft = !0), this.appendLeft(e, t);
  }
  insertRight(e, t) {
    return Jt.insertRight || (console.warn(
      "magicString.insertRight(...) is deprecated. Use magicString.prependRight(...) instead"
    ), Jt.insertRight = !0), this.prependRight(e, t);
  }
  move(e, t, s) {
    if (e = e + this.offset, t = t + this.offset, s = s + this.offset, s >= e && s <= t) throw new Error("Cannot move a selection inside itself");
    this._split(e), this._split(t), this._split(s);
    const n = this.byStart[e], r = this.byEnd[t], a = n.previous, o = r.next, l = this.byStart[s];
    if (!l && r === this.lastChunk) return this;
    const c = l ? l.previous : this.lastChunk;
    return a && (a.next = o), o && (o.previous = a), c && (c.next = n), l && (l.previous = r), n.previous || (this.firstChunk = r.next), r.next || (this.lastChunk = n.previous, this.lastChunk.next = null), n.previous = c, r.next = l || null, c || (this.firstChunk = n), l || (this.lastChunk = r), this;
  }
  overwrite(e, t, s, n) {
    return n = n || {}, this.update(e, t, s, { ...n, overwrite: !n.contentOnly });
  }
  update(e, t, s, n) {
    if (e = e + this.offset, t = t + this.offset, typeof s != "string") throw new TypeError("replacement content must be a string");
    if (this.original.length !== 0) {
      for (; e < 0; ) e += this.original.length;
      for (; t < 0; ) t += this.original.length;
    }
    if (t > this.original.length) throw new Error("end is out of bounds");
    if (e === t)
      throw new Error(
        "Cannot overwrite a zero-length range – use appendLeft or prependRight instead"
      );
    this._split(e), this._split(t), n === !0 && (Jt.storeName || (console.warn(
      "The final argument to magicString.overwrite(...) should be an options object. See https://github.com/rich-harris/magic-string"
    ), Jt.storeName = !0), n = { storeName: !0 });
    const r = n !== void 0 ? n.storeName : !1, a = n !== void 0 ? n.overwrite : !1;
    if (r) {
      const c = this.original.slice(e, t);
      Object.defineProperty(this.storedNames, c, {
        writable: !0,
        value: !0,
        enumerable: !0
      });
    }
    const o = this.byStart[e], l = this.byEnd[t];
    if (o) {
      let c = o;
      for (; c !== l; ) {
        if (c.next !== this.byStart[c.end])
          throw new Error("Cannot overwrite across a split point");
        c = c.next, c.edit("", !1);
      }
      o.edit(s, r, !a);
    } else {
      const c = new to(e, t, "").edit(s, r);
      l.next = c, c.previous = l;
    }
    return this;
  }
  prepend(e) {
    if (typeof e != "string") throw new TypeError("outro content must be a string");
    return this.intro = e + this.intro, this;
  }
  prependLeft(e, t) {
    if (e = e + this.offset, typeof t != "string") throw new TypeError("inserted content must be a string");
    this._split(e);
    const s = this.byEnd[e];
    return s ? s.prependLeft(t) : this.intro = t + this.intro, this;
  }
  prependRight(e, t) {
    if (e = e + this.offset, typeof t != "string") throw new TypeError("inserted content must be a string");
    this._split(e);
    const s = this.byStart[e];
    return s ? s.prependRight(t) : this.outro = t + this.outro, this;
  }
  remove(e, t) {
    if (e = e + this.offset, t = t + this.offset, this.original.length !== 0) {
      for (; e < 0; ) e += this.original.length;
      for (; t < 0; ) t += this.original.length;
    }
    if (e === t) return this;
    if (e < 0 || t > this.original.length) throw new Error("Character is out of bounds");
    if (e > t) throw new Error("end must be greater than start");
    this._split(e), this._split(t);
    let s = this.byStart[e];
    for (; s; )
      s.intro = "", s.outro = "", s.edit(""), s = t > s.end ? this.byStart[s.end] : null;
    return this;
  }
  reset(e, t) {
    if (e = e + this.offset, t = t + this.offset, this.original.length !== 0) {
      for (; e < 0; ) e += this.original.length;
      for (; t < 0; ) t += this.original.length;
    }
    if (e === t) return this;
    if (e < 0 || t > this.original.length) throw new Error("Character is out of bounds");
    if (e > t) throw new Error("end must be greater than start");
    this._split(e), this._split(t);
    let s = this.byStart[e];
    for (; s; )
      s.reset(), s = t > s.end ? this.byStart[s.end] : null;
    return this;
  }
  lastChar() {
    if (this.outro.length) return this.outro[this.outro.length - 1];
    let e = this.lastChunk;
    do {
      if (e.outro.length) return e.outro[e.outro.length - 1];
      if (e.content.length) return e.content[e.content.length - 1];
      if (e.intro.length) return e.intro[e.intro.length - 1];
    } while (e = e.previous);
    return this.intro.length ? this.intro[this.intro.length - 1] : "";
  }
  lastLine() {
    let e = this.outro.lastIndexOf($s);
    if (e !== -1) return this.outro.substr(e + 1);
    let t = this.outro, s = this.lastChunk;
    do {
      if (s.outro.length > 0) {
        if (e = s.outro.lastIndexOf($s), e !== -1) return s.outro.substr(e + 1) + t;
        t = s.outro + t;
      }
      if (s.content.length > 0) {
        if (e = s.content.lastIndexOf($s), e !== -1) return s.content.substr(e + 1) + t;
        t = s.content + t;
      }
      if (s.intro.length > 0) {
        if (e = s.intro.lastIndexOf($s), e !== -1) return s.intro.substr(e + 1) + t;
        t = s.intro + t;
      }
    } while (s = s.previous);
    return e = this.intro.lastIndexOf($s), e !== -1 ? this.intro.substr(e + 1) + t : this.intro + t;
  }
  slice(e = 0, t = this.original.length - this.offset) {
    if (e = e + this.offset, t = t + this.offset, this.original.length !== 0) {
      for (; e < 0; ) e += this.original.length;
      for (; t < 0; ) t += this.original.length;
    }
    let s = "", n = this.firstChunk;
    for (; n && (n.start > e || n.end <= e); ) {
      if (n.start < t && n.end >= t)
        return s;
      n = n.next;
    }
    if (n && n.edited && n.start !== e)
      throw new Error(`Cannot use replaced character ${e} as slice start anchor.`);
    const r = n;
    for (; n; ) {
      n.intro && (r !== n || n.start === e) && (s += n.intro);
      const a = n.start < t && n.end >= t;
      if (a && n.edited && n.end !== t)
        throw new Error(`Cannot use replaced character ${t} as slice end anchor.`);
      const o = r === n ? e - n.start : 0, l = a ? n.content.length + t - n.end : n.content.length;
      if (s += n.content.slice(o, l), n.outro && (!a || n.end === t) && (s += n.outro), a)
        break;
      n = n.next;
    }
    return s;
  }
  // TODO deprecate this? not really very useful
  snip(e, t) {
    const s = this.clone();
    return s.remove(0, e), s.remove(t, s.original.length), s;
  }
  _split(e) {
    if (this.byStart[e] || this.byEnd[e]) return;
    let t = this.lastSearchedChunk, s = t;
    const n = e > t.end;
    for (; t; ) {
      if (t.contains(e)) return this._splitChunk(t, e);
      if (t = n ? this.byStart[t.end] : this.byEnd[t.start], t === s) return;
      s = t;
    }
  }
  _splitChunk(e, t) {
    if (e.edited && e.content.length) {
      const n = yr(this.original)(t);
      throw new Error(
        `Cannot split a chunk that has already been edited (${n.line}:${n.column} – "${e.original}")`
      );
    }
    const s = e.split(t);
    return this.byEnd[t] = e, this.byStart[t] = s, this.byEnd[s.end] = s, e === this.lastChunk && (this.lastChunk = s), this.lastSearchedChunk = e, !0;
  }
  toString() {
    let e = this.intro, t = this.firstChunk;
    for (; t; )
      e += t.toString(), t = t.next;
    return e + this.outro;
  }
  isEmpty() {
    let e = this.firstChunk;
    do
      if (e.intro.length && e.intro.trim() || e.content.length && e.content.trim() || e.outro.length && e.outro.trim())
        return !1;
    while (e = e.next);
    return !0;
  }
  length() {
    let e = this.firstChunk, t = 0;
    do
      t += e.intro.length + e.content.length + e.outro.length;
    while (e = e.next);
    return t;
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(e) {
    return this.trimStart(e).trimEnd(e);
  }
  trimEndAborted(e) {
    const t = new RegExp((e || "\\s") + "+$");
    if (this.outro = this.outro.replace(t, ""), this.outro.length) return !0;
    let s = this.lastChunk;
    do {
      const n = s.end, r = s.trimEnd(t);
      if (s.end !== n && (this.lastChunk === s && (this.lastChunk = s.next), this.byEnd[s.end] = s, this.byStart[s.next.start] = s.next, this.byEnd[s.next.end] = s.next), r) return !0;
      s = s.previous;
    } while (s);
    return !1;
  }
  trimEnd(e) {
    return this.trimEndAborted(e), this;
  }
  trimStartAborted(e) {
    const t = new RegExp("^" + (e || "\\s") + "+");
    if (this.intro = this.intro.replace(t, ""), this.intro.length) return !0;
    let s = this.firstChunk;
    do {
      const n = s.end, r = s.trimStart(t);
      if (s.end !== n && (s === this.lastChunk && (this.lastChunk = s.next), this.byEnd[s.end] = s, this.byStart[s.next.start] = s.next, this.byEnd[s.next.end] = s.next), r) return !0;
      s = s.next;
    } while (s);
    return !1;
  }
  trimStart(e) {
    return this.trimStartAborted(e), this;
  }
  hasChanged() {
    return this.original !== this.toString();
  }
  _replaceRegexp(e, t) {
    function s(r, a) {
      return typeof t == "string" ? t.replace(/\$(\$|&|\d+)/g, (o, l) => l === "$" ? "$" : l === "&" ? r[0] : +l < r.length ? r[+l] : `$${l}`) : t(...r, r.index, a, r.groups);
    }
    function n(r, a) {
      let o;
      const l = [];
      for (; o = r.exec(a); )
        l.push(o);
      return l;
    }
    if (e.global)
      n(e, this.original).forEach((a) => {
        if (a.index != null) {
          const o = s(a, this.original);
          o !== a[0] && this.overwrite(a.index, a.index + a[0].length, o);
        }
      });
    else {
      const r = this.original.match(e);
      if (r && r.index != null) {
        const a = s(r, this.original);
        a !== r[0] && this.overwrite(r.index, r.index + r[0].length, a);
      }
    }
    return this;
  }
  _replaceString(e, t) {
    const { original: s } = this, n = s.indexOf(e);
    return n !== -1 && (typeof t == "function" && (t = t(e, n, s)), e !== t && this.overwrite(n, n + e.length, t)), this;
  }
  replace(e, t) {
    return typeof e == "string" ? this._replaceString(e, t) : this._replaceRegexp(e, t);
  }
  _replaceAllString(e, t) {
    const { original: s } = this, n = e.length;
    for (let r = s.indexOf(e); r !== -1; r = s.indexOf(e, r + n)) {
      const a = s.slice(r, r + n);
      let o = t;
      typeof t == "function" && (o = t(a, r, s)), a !== o && this.overwrite(r, r + n, o);
    }
    return this;
  }
  replaceAll(e, t) {
    if (typeof e == "string")
      return this._replaceAllString(e, t);
    if (!e.global)
      throw new TypeError(
        "MagicString.prototype.replaceAll called with a non-global RegExp argument"
      );
    return this._replaceRegexp(e, t);
  }
}
const so = Object.prototype.hasOwnProperty;
let $d = class Gl {
  constructor(e = {}) {
    this.intro = e.intro || "", this.separator = e.separator !== void 0 ? e.separator : `
`, this.sources = [], this.uniqueSources = [], this.uniqueSourceIndexByFilename = {};
  }
  addSource(e) {
    if (e instanceof Ft)
      return this.addSource({
        content: e,
        filename: e.filename,
        separator: this.separator
      });
    if (!jl(e) || !e.content)
      throw new Error(
        "bundle.addSource() takes an object with a `content` property, which should be an instance of MagicString, and an optional `filename`"
      );
    if (["filename", "ignoreList", "indentExclusionRanges", "separator"].forEach((t) => {
      so.call(e, t) || (e[t] = e.content[t]);
    }), e.separator === void 0 && (e.separator = this.separator), e.filename)
      if (!so.call(this.uniqueSourceIndexByFilename, e.filename))
        this.uniqueSourceIndexByFilename[e.filename] = this.uniqueSources.length, this.uniqueSources.push({ filename: e.filename, content: e.content.original });
      else {
        const t = this.uniqueSources[this.uniqueSourceIndexByFilename[e.filename]];
        if (e.content.original !== t.content)
          throw new Error(`Illegal source: same filename (${e.filename}), different contents`);
      }
    return this.sources.push(e), this;
  }
  append(e, t) {
    return this.addSource({
      content: new Ft(e),
      separator: t && t.separator || ""
    }), this;
  }
  clone() {
    const e = new Gl({
      intro: this.intro,
      separator: this.separator
    });
    return this.sources.forEach((t) => {
      e.addSource({
        filename: t.filename,
        content: t.content.clone(),
        separator: t.separator
      });
    }), e;
  }
  generateDecodedMap(e = {}) {
    const t = [];
    let s;
    this.sources.forEach((r) => {
      Object.keys(r.content.storedNames).forEach((a) => {
        ~t.indexOf(a) || t.push(a);
      });
    });
    const n = new Hl(e.hires);
    return this.intro && n.advance(this.intro), this.sources.forEach((r, a) => {
      a > 0 && n.advance(this.separator);
      const o = r.filename ? this.uniqueSourceIndexByFilename[r.filename] : -1, l = r.content, c = yr(l.original);
      l.intro && n.advance(l.intro), l.firstChunk.eachNext((h) => {
        const p = c(h.start);
        h.intro.length && n.advance(h.intro), r.filename ? h.edited ? n.addEdit(
          o,
          h.content,
          p,
          h.storeName ? t.indexOf(h.original) : -1
        ) : n.addUneditedChunk(
          o,
          h,
          l.original,
          p,
          l.sourcemapLocations
        ) : n.advance(h.content), h.outro.length && n.advance(h.outro);
      }), l.outro && n.advance(l.outro), r.ignoreList && o !== -1 && (s === void 0 && (s = []), s.push(o));
    }), {
      file: e.file ? e.file.split(/[/\\]/).pop() : void 0,
      sources: this.uniqueSources.map((r) => e.file ? Ul(e.file, r.filename) : r.filename),
      sourcesContent: this.uniqueSources.map((r) => e.includeContent ? r.content : null),
      names: t,
      mappings: n.raw,
      x_google_ignoreList: s
    };
  }
  generateMap(e) {
    return new Jn(this.generateDecodedMap(e));
  }
  getIndentString() {
    const e = {};
    return this.sources.forEach((t) => {
      const s = t.content._getRawIndentString();
      s !== null && (e[s] || (e[s] = 0), e[s] += 1);
    }), Object.keys(e).sort((t, s) => e[t] - e[s])[0] || "	";
  }
  indent(e) {
    if (arguments.length || (e = this.getIndentString()), e === "") return this;
    let t = !this.intro || this.intro.slice(-1) === `
`;
    return this.sources.forEach((s, n) => {
      const r = s.separator !== void 0 ? s.separator : this.separator, a = t || n > 0 && /\r?\n$/.test(r);
      s.content.indent(e, {
        exclude: s.indentExclusionRanges,
        indentStart: a
        //: trailingNewline || /\r?\n$/.test( separator )  //true///\r?\n/.test( separator )
      }), t = s.content.lastChar() === `
`;
    }), this.intro && (this.intro = e + this.intro.replace(/^[^\n]/gm, (s, n) => n > 0 ? e + s : s)), this;
  }
  prepend(e) {
    return this.intro = e + this.intro, this;
  }
  toString() {
    const e = this.sources.map((t, s) => {
      const n = t.separator !== void 0 ? t.separator : this.separator;
      return (s > 0 ? n : "") + t.content.toString();
    }).join("");
    return this.intro + e;
  }
  isEmpty() {
    return !(this.intro.length && this.intro.trim() || this.sources.some((e) => !e.content.isEmpty()));
  }
  length() {
    return this.sources.reduce(
      (e, t) => e + t.content.length(),
      this.intro.length
    );
  }
  trimLines() {
    return this.trim("[\\r\\n]");
  }
  trim(e) {
    return this.trimStart(e).trimEnd(e);
  }
  trimStart(e) {
    const t = new RegExp("^" + (e || "\\s") + "+");
    if (this.intro = this.intro.replace(t, ""), !this.intro) {
      let s, n = 0;
      do
        if (s = this.sources[n++], !s)
          break;
      while (!s.content.trimStartAborted(e));
    }
    return this;
  }
  trimEnd(e) {
    const t = new RegExp((e || "\\s") + "+$");
    let s, n = this.sources.length - 1;
    do
      if (s = this.sources[n--], !s) {
        this.intro = this.intro.replace(t, "");
        break;
      }
    while (!s.content.trimEndAborted(e));
    return this;
  }
};
function ys(i, e, t, s) {
  e.remove(t, s), i.removeAnnotations(e);
}
const Ot = { isNoStatement: !0 };
function we(i, e, t = 0) {
  let s, n;
  for (s = i.indexOf(e, t); ; ) {
    if (t = i.indexOf("/", t), t === -1 || t >= s)
      return s;
    n = i.charCodeAt(++t), ++t, t = n === 47 ? i.indexOf(`
`, t) + 1 : i.indexOf("*/", t) + 2, t > s && (s = i.indexOf(e, t));
  }
}
const no = /\S/g;
function Pt(i, e) {
  return no.lastIndex = e, no.exec(i).index;
}
const wd = /\s/;
function Cd(i, e, t) {
  for (; ; ) {
    if (e >= t)
      return t;
    if (wd.test(i[t - 1]))
      t--;
    else
      return t;
  }
}
function Ts(i) {
  let e, t, s = 0;
  for (e = i.indexOf(`
`, s); ; ) {
    if (s = i.indexOf("/", s), s === -1 || s > e)
      return [e, e + 1];
    if (t = i.charCodeAt(s + 1), t === 47)
      return [s, e + 1];
    s = i.indexOf("*/", s + 2) + 2, s > e && (e = i.indexOf(`
`, s));
  }
}
function Hs(i, e, t, s, n) {
  let r, a, o, l, c = i[0], h = !c.included || c.needsBoundaries;
  h && (l = t + Ts(e.original.slice(t, c.start))[1]);
  for (let p = 1; p <= i.length; p++)
    r = c, a = l, o = h, c = i[p], h = c === void 0 ? !1 : !c.included || c.needsBoundaries, o || h ? (l = r.end + Ts(e.original.slice(r.end, c === void 0 ? s : c.start))[1], r.included ? o ? r.render(e, n, {
      end: l,
      start: a
    }) : r.render(e, n) : ys(r, e, a, l)) : r.render(e, n);
}
function Yn(i, e, t, s) {
  const n = [];
  let r, a, o, l, c = t - 1;
  for (const h of i) {
    for (r !== void 0 && (c = r.end + we(e.original.slice(r.end, h.start), ",")), a = o = c + 1 + Ts(e.original.slice(c + 1, h.start))[1]; l = e.original.charCodeAt(a), l === 32 || l === 9 || l === 10 || l === 13; )
      a++;
    r !== void 0 && n.push({
      contentEnd: o,
      end: a,
      node: r,
      separator: c,
      start: t
    }), r = h, t = a;
  }
  return n.push({
    contentEnd: s,
    end: s,
    node: r,
    separator: null,
    start: t
  }), n;
}
function Qn(i, e, t) {
  for (; ; ) {
    const [s, n] = Ts(i.original.slice(e, t));
    if (s === -1)
      break;
    i.remove(e + s, e += n);
  }
}
function Ht(i, { exportNamesByVariable: e, snippets: { _: t, getObject: s, getPropertyAccess: n } }, r = "") {
  if (i.length === 1 && e.get(i[0]).length === 1) {
    const a = i[0];
    return `exports(${JSON.stringify(e.get(a)[0])},${t}${a.getName(n)}${r})`;
  } else {
    const a = [];
    for (const o of i)
      for (const l of e.get(o))
        a.push([l, o.getName(n) + r]);
    return `exports(${s(a, { lineBreakIndent: null })})`;
  }
}
function Hr(i, e, t, s, { exportNamesByVariable: n, snippets: { _: r } }) {
  s.prependRight(e, `exports(${JSON.stringify(n.get(i)[0])},${r}`), s.appendLeft(t, ")");
}
function vd(i, e, t, s, n, r) {
  const { _: a, getDirectReturnIifeLeft: o } = r.snippets;
  n.prependRight(e, o(["v"], `${Ht(i, r)},${a}v`, { needsArrowReturnParens: !0, needsWrappedFunction: s })), n.appendLeft(t, ")");
}
function Wl(i, e, t, s, n, r) {
  const { _: a, getPropertyAccess: o } = r.snippets;
  n.appendLeft(t, `,${a}${Ht([i], r)},${a}${i.getName(o)}`), s && (n.prependRight(e, "("), n.appendLeft(t, ")"));
}
function kd(i, e, t, s, n, r, a) {
  const { _: o } = r.snippets;
  n.prependRight(e, `${Ht([i], r, a)},${o}`), s && (n.prependRight(e, "("), n.appendLeft(t, ")"));
}
function _e(i, e, t) {
  const s = i.get(e);
  if (s !== void 0)
    return s;
  const n = t();
  return i.set(e, n), n;
}
function It() {
  return /* @__PURE__ */ new Set();
}
function Er() {
  return [];
}
const W = /* @__PURE__ */ Symbol("Unknown Key"), Tn = /* @__PURE__ */ Symbol("Unknown Non-Accessor Key"), cs = /* @__PURE__ */ Symbol("Unknown Integer"), Gr = /* @__PURE__ */ Symbol("Unknown Well-Known"), Wr = /* @__PURE__ */ Symbol("Symbol.toStringTag"), Zn = /* @__PURE__ */ Symbol("Symbol.asyncDispose"), ei = /* @__PURE__ */ Symbol("Symbol.dispose"), ti = /* @__PURE__ */ Symbol("Symbol.hasInstance"), Rd = [
  Wr,
  Zn,
  ei,
  ti
], Kr = new Set(Rd), qr = (i) => Kr.has(i) || i === Gr, Dd = [ti, Zn, ei], Od = new Set(Dd), Qe = (i) => typeof i == "string" || Kr.has(i), D = [], O = [W], Ld = [Tn], br = [cs], Md = [ti], is = /* @__PURE__ */ Symbol("Entities");
class us {
  constructor() {
    this.entityPaths = Object.create(null, {
      [is]: { value: /* @__PURE__ */ new Set() }
    });
  }
  trackEntityAtPathAndGetIfTracked(e, t) {
    const s = this.getEntities(e);
    return s.has(t) ? !0 : (s.add(t), !1);
  }
  withTrackedEntityAtPath(e, t, s, n) {
    const r = this.getEntities(e);
    if (r.has(t))
      return n;
    r.add(t);
    const a = s();
    return r.delete(t), a;
  }
  getEntities(e) {
    let t = this.entityPaths;
    for (const s of e)
      t = t[s] ||= Object.create(null, {
        [is]: { value: /* @__PURE__ */ new Set() }
      });
    return t[is];
  }
}
const de = new us();
class io {
  constructor() {
    this.entityPaths = Object.create(null, {
      [is]: { value: /* @__PURE__ */ new Map() }
    });
  }
  trackEntityAtPathAndGetIfTracked(e, t, s) {
    let n = this.entityPaths;
    for (const a of e)
      n = n[a] ||= Object.create(null, {
        [is]: { value: /* @__PURE__ */ new Map() }
      });
    const r = _e(n[is], t, It);
    return r.has(s) ? !0 : (r.add(s), !1);
  }
}
const Td = Object.freeze({ [W]: Re });
class Bd {
  constructor() {
    this.includedPaths = null;
  }
  includePathAndGetIfIncluded(e) {
    let t = !0, s = this, n = "includedPaths", r = this.includedPaths ||= (t = !1, /* @__PURE__ */ Object.create(null));
    for (const a of e) {
      if (r[W])
        return !0;
      if (!Qe(a))
        return s[n] = Td, !1;
      s = r, n = a, r = r[a] ||= (t = !1, /* @__PURE__ */ Object.create(null));
    }
    return t;
  }
}
const _d = Object.freeze({
  [W]: !0
});
class Fd {
  constructor() {
    this.includedPaths = null;
  }
  includePathAndGetIfIncluded(e) {
    let t = !0;
    const s = this.includedPaths ||= (t = !1, /* @__PURE__ */ Object.create(null));
    if (s[W])
      return !0;
    const [n, r] = e;
    return n ? Qe(n) ? r ? s[n] === W ? !0 : (s[n] = W, !1) : s[n] ? !0 : (s[n] = !0, !1) : (this.includedPaths = _d, !1) : t;
  }
  includeAllPaths(e, t, s) {
    const { includedPaths: n } = this;
    if (n)
      if (n[W])
        e.includePath([...s, W], t);
      else {
        const r = Object.entries(n);
        if (r.length === 0)
          e.includePath(s, t);
        else
          for (const [a, o] of r)
            e.includePath(o === W ? [...s, a, W] : [...s, a], t);
      }
  }
}
function Kl(i, e) {
  if (i.type === "MemberExpression")
    return !i.computed && Kl(i.object, i);
  if (i.type !== "Identifier") return !1;
  switch (e?.type) {
    // disregard `bar` in `foo.bar`
    case "MemberExpression":
      return e.computed || i === e.object;
    // disregard the `foo` in `class {foo(){}}` but keep it in `class {[foo](){}}`
    case "MethodDefinition":
      return e.computed;
    // disregard the `meta` in `import.meta`
    case "MetaProperty":
      return e.meta === i;
    // disregard the `foo` in `class {foo=bar}` but keep it in `class {[foo]=bar}` and `class {bar=foo}`
    case "PropertyDefinition":
      return e.computed || i === e.value;
    // disregard the `bar` in `{ bar: foo }`, but keep it in `{ [bar]: foo }`
    case "Property":
      return e.computed || i === e.value;
    // disregard the `bar` in `export { foo as bar }` or
    // the foo in `import { foo as bar }`
    case "ExportSpecifier":
    case "ImportSpecifier":
      return i === e.local;
    // disregard the `foo` in `foo: while (...) { ... break foo; ... continue foo;}`
    case "LabeledStatement":
    case "BreakStatement":
    case "ContinueStatement":
      return !1;
    default:
      return !0;
  }
}
function it() {
  return {
    brokenFlow: !1,
    hasBreak: !1,
    hasContinue: !1,
    includedCallArguments: /* @__PURE__ */ new Set(),
    includedLabels: /* @__PURE__ */ new Set()
  };
}
function Es() {
  return {
    accessed: new us(),
    assigned: new us(),
    brokenFlow: !1,
    called: new io(),
    hasBreak: !1,
    hasContinue: !1,
    ignore: {
      breaks: !1,
      continues: !1,
      labels: /* @__PURE__ */ new Set(),
      returnYield: !1,
      this: !1
    },
    includedLabels: /* @__PURE__ */ new Set(),
    instantiated: new io(),
    replacedVariableInits: /* @__PURE__ */ new Map()
  };
}
function Z(i, e) {
  return (i & e) !== 0;
}
function ee(i, e, t) {
  return i & ~e | -t & e;
}
const K = /* @__PURE__ */ Symbol("Unknown Value"), si = /* @__PURE__ */ Symbol("Unknown Truthy Value"), ni = /* @__PURE__ */ Symbol("Unknown Falsy Value");
class qe {
  constructor() {
    this.flags = 0;
  }
  get included() {
    return Z(
      this.flags,
      1
      /* Flag.included */
    );
  }
  set included(e) {
    this.flags = ee(this.flags, 1, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    ot(e);
  }
  deoptimizePath(e) {
  }
  /**
   * If possible it returns a stringifyable literal value for this node that
   * can be used for inlining or comparing values. Otherwise, it should return
   * UnknownValue.
   */
  getLiteralValueAtPath(e, t, s) {
    return K;
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return Se;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return !0;
  }
  include(e, t, s) {
    this.included || this.includeNode(e);
  }
  includeNode(e) {
    this.included = !0;
  }
  includePath(e, t) {
    this.included || this.includeNode(t);
  }
  /* We are both including and including an unknown path here as the former
   * ensures that nested nodes are included while the latter ensures that all
   * paths of the expression are included.
   * */
  includeCallArguments(e, t) {
    Xr(e, t);
  }
  shouldBeIncluded(e) {
    return !0;
  }
}
const G = new class extends qe {
}(), Se = [
  G,
  !1
], ot = (i) => {
  for (const e of i.args)
    e?.deoptimizePath(O);
}, Xr = (i, e) => {
  i.args[0]?.includePath(O, e), Jr(i, e);
}, Jr = ({ args: i }, e) => {
  for (let t = 1; t < i.length; t++) {
    const s = i[t];
    s && (s.includePath(O, e), s.include(e, !1));
  }
}, ge = 0, Ue = 1, X = 2, zt = {
  args: [null],
  type: ge
}, Yr = {
  args: [null, G],
  type: Ue
}, Gs = {
  args: [null],
  type: X,
  withNew: !1
}, Ar = /* @__PURE__ */ Symbol("PureFunction"), zd = ({ treeshake: i }) => {
  const e = /* @__PURE__ */ Object.create(null);
  for (const t of i ? i.manualPureFunctions : []) {
    let s = e;
    for (const n of t.split("."))
      s = s[n] ||= /* @__PURE__ */ Object.create(null);
    s[Ar] = !0;
  }
  return e;
};
class Gt extends qe {
  markReassigned() {
    this.isReassigned = !0;
  }
  constructor(e) {
    super(), this.name = e, this.alwaysRendered = !1, this.forbiddenNames = null, this.globalName = null, this.initReached = !1, this.isId = !1, this.kind = null, this.renderBaseName = null, this.renderName = null, this.isReassigned = !1, this.onlyFunctionCallUsed = !0;
  }
  /**
   * Binds identifiers that reference this variable to this variable.
   * Necessary to be able to change variable names.
   */
  addReference(e) {
  }
  /**
   * Check if the identifier variable is only used as function call
   * @returns true if the variable is only used as function call
   */
  getOnlyFunctionCallUsed() {
    return this.onlyFunctionCallUsed;
  }
  /**
   * Collect the places where the identifier variable is used
   * @param usedPlace Where the variable is used
   */
  addUsedPlace(e) {
    !(e.parent.type === js && e.parent.callee === e) && e.parent.type !== vl && (this.onlyFunctionCallUsed = !1);
  }
  /**
   * Prevent this variable from being renamed to this name to avoid name
   * collisions
   */
  forbidName(e) {
    (this.forbiddenNames ||= /* @__PURE__ */ new Set()).add(e);
  }
  getBaseVariableName() {
    return this.renderedLikeHoisted?.getBaseVariableName() || this.renderBaseName || this.renderName || this.name;
  }
  getName(e, t) {
    if (this.globalName)
      return this.globalName;
    if (t?.(this))
      return this.name;
    if (this.renderedLikeHoisted)
      return this.renderedLikeHoisted.getName(e, t);
    const s = this.renderName || this.name;
    return this.renderBaseName ? `${this.renderBaseName}${e(s)}` : s;
  }
  hasEffectsOnInteractionAtPath(e, { type: t }, s) {
    return t !== ge || e.length > 0;
  }
  /**
   * Marks this variable as being part of the bundle, which is usually the case
   * when one of its identifiers becomes part of the bundle. Returns true if it
   * has not been included previously. Once a variable is included, it should
   * take care all its declarations are included.
   */
  includePath(e, t) {
    this.included = !0, this.renderedLikeHoisted?.includePath(e, t);
  }
  /**
   * Links the rendered name of this variable to another variable and includes
   * this variable if the other variable is included.
   */
  renderLikeHoisted(e) {
    this.renderedLikeHoisted = e;
  }
  markCalledFromTryStatement() {
  }
  setRenderNames(e, t) {
    this.renderBaseName = e, this.renderName = t;
  }
}
class Bs extends Gt {
  constructor(e, t) {
    super(t), this.referenced = !1, this.module = e, this.isNamespace = t === "*";
  }
  addReference(e) {
    this.referenced = !0, (this.name === "default" || this.name === "*") && this.module.suggestName(e.name);
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return t !== ge || e.length > (this.isNamespace ? 1 : 0);
  }
  includePath(e, t) {
    super.includePath(e, t), this.module.used = !0;
  }
}
function ql(i, e) {
  for (const t of e) {
    const s = Object.getOwnPropertyDescriptor(i, t).get;
    Object.defineProperty(i, t, {
      get() {
        const n = s.call(i);
        return Object.defineProperty(i, t, { value: n }), n;
      }
    });
  }
}
const ii = /* @__PURE__ */ new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "exports",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "NaN",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield"
]), Xl = /[^\w$]/g, Vd = (i) => /\d/.test(i[0]), Jl = (i) => Vd(i) || ii.has(i) || i === "arguments";
function Ud(i) {
  return Jl(i) ? !1 : !Xl.test(i);
}
function ri(i) {
  return i = i.replace(/-(\w)/g, (e, t) => t.toUpperCase()).replace(Xl, "_"), Jl(i) && (i = `_${i}`), i || "_";
}
const Bn = /^[$_\p{ID_Start}][$\u200C\u200D\p{ID_Continue}]*$/u, jd = /^(?:0|[1-9]\d*)$/;
function ai(i) {
  return Bn.test(i) ? i === "__proto__" ? '["__proto__"]' : i : jd.test(i) && +i <= Number.MAX_SAFE_INTEGER ? i : JSON.stringify(i);
}
function Zt(i) {
  return Bn.test(i) ? i : JSON.stringify(i);
}
class Ee {
  constructor(e, t, s, n, r, a) {
    this.options = e, this.id = t, this.renormalizeRenderPath = r, this.dynamicImporters = [], this.execIndex = 1 / 0, this.exportedVariables = /* @__PURE__ */ new Map(), this.importers = [], this.reexported = !1, this.used = !1, this.declarations = /* @__PURE__ */ new Map(), this.importersByExportedName = /* @__PURE__ */ new Map(), this.mostCommonSuggestion = 0, this.nameSuggestions = /* @__PURE__ */ new Map(), this.suggestedVariableName = ri(t.split(/[/\\]/).pop());
    const { importers: o, dynamicImporters: l } = this;
    this.info = {
      ast: null,
      attributes: a,
      code: null,
      dynamicallyImportedIdResolutions: De,
      dynamicallyImportedIds: De,
      get dynamicImporters() {
        return l.sort();
      },
      exportedBindings: null,
      exports: null,
      hasDefaultExport: null,
      id: t,
      implicitlyLoadedAfterOneOf: De,
      implicitlyLoadedBefore: De,
      importedIdResolutions: De,
      importedIds: De,
      get importers() {
        return o.sort();
      },
      isEntry: !1,
      isExternal: !0,
      isIncluded: null,
      meta: n,
      moduleSideEffects: s,
      safeVariableNames: null,
      syntheticNamedExports: !1
    };
  }
  cacheInfoGetters() {
    ql(this.info, ["dynamicImporters", "importers"]);
  }
  getVariableForExportName(e, { importChain: t }) {
    const s = this.declarations.get(e);
    for (const r of t)
      _e(this.importersByExportedName, e, It).add(r);
    if (s)
      return [s];
    const n = new Bs(this, e);
    return this.declarations.set(e, n), this.exportedVariables.set(n, e), [n];
  }
  suggestName(e) {
    const t = (this.nameSuggestions.get(e) ?? 0) + 1;
    this.nameSuggestions.set(e, t), t > this.mostCommonSuggestion && (this.mostCommonSuggestion = t, this.suggestedVariableName = e);
  }
  warnUnusedImports() {
    const e = [...this.declarations].filter(([n, r]) => n !== "*" && !r.included && !this.reexported && !r.referenced).map(([n]) => n);
    if (e.length === 0)
      return;
    const t = /* @__PURE__ */ new Set();
    for (const n of e) {
      const r = this.importersByExportedName.get(n);
      for (const a of this.importers)
        r?.has(a) && t.add(a);
    }
    const s = [...t];
    this.options.onLog(V, ah(this.id, e, s));
  }
}
function Qr(i) {
  i.isExecuted = !0;
  const e = [i], t = /* @__PURE__ */ new Set();
  for (const s of e)
    for (const n of [...s.dependencies, ...s.implicitlyLoadedBefore])
      !(n instanceof Ee) && !n.isExecuted && (n.info.moduleSideEffects || s.implicitlyLoadedBefore.has(n)) && !t.has(n.id) && (n.isExecuted = !0, t.add(n.id), e.push(n));
}
const Je = () => {
}, wt = {
  ArrayExpression: ["elements"],
  ArrayPattern: ["elements"],
  ArrowFunctionExpression: ["params", "body"],
  AssignmentExpression: ["left", "right"],
  AssignmentPattern: ["left", "right"],
  AwaitExpression: ["argument"],
  BinaryExpression: ["left", "right"],
  BlockStatement: ["body"],
  BreakStatement: ["label"],
  CallExpression: ["callee", "arguments"],
  CatchClause: ["param", "body"],
  ChainExpression: ["expression"],
  ClassBody: ["body"],
  ClassDeclaration: ["decorators", "id", "superClass", "body"],
  ClassExpression: ["decorators", "id", "superClass", "body"],
  ConditionalExpression: ["test", "consequent", "alternate"],
  ContinueStatement: ["label"],
  DebuggerStatement: [],
  Decorator: ["expression"],
  DoWhileStatement: ["body", "test"],
  EmptyStatement: [],
  ExportAllDeclaration: ["exported", "source", "attributes"],
  ExportDefaultDeclaration: ["declaration"],
  ExportNamedDeclaration: ["specifiers", "source", "attributes", "declaration"],
  ExportSpecifier: ["local", "exported"],
  ExpressionStatement: ["expression"],
  ForInStatement: ["left", "right", "body"],
  ForOfStatement: ["left", "right", "body"],
  ForStatement: ["init", "test", "update", "body"],
  FunctionDeclaration: ["id", "params", "body"],
  FunctionExpression: ["id", "params", "body"],
  Identifier: [],
  IfStatement: ["test", "consequent", "alternate"],
  ImportAttribute: ["key", "value"],
  ImportDeclaration: ["specifiers", "source", "attributes"],
  ImportDefaultSpecifier: ["local"],
  ImportExpression: ["source", "options"],
  ImportNamespaceSpecifier: ["local"],
  ImportSpecifier: ["imported", "local"],
  JSXAttribute: ["name", "value"],
  JSXClosingElement: ["name"],
  JSXClosingFragment: [],
  JSXElement: ["openingElement", "children", "closingElement"],
  JSXEmptyExpression: [],
  JSXExpressionContainer: ["expression"],
  JSXFragment: ["openingFragment", "children", "closingFragment"],
  JSXIdentifier: [],
  JSXMemberExpression: ["object", "property"],
  JSXNamespacedName: ["namespace", "name"],
  JSXOpeningElement: ["name", "attributes"],
  JSXOpeningFragment: [],
  JSXSpreadAttribute: ["argument"],
  JSXSpreadChild: ["expression"],
  JSXText: [],
  LabeledStatement: ["label", "body"],
  Literal: [],
  LogicalExpression: ["left", "right"],
  MemberExpression: ["object", "property"],
  MetaProperty: ["meta", "property"],
  MethodDefinition: ["decorators", "key", "value"],
  NewExpression: ["callee", "arguments"],
  ObjectExpression: ["properties"],
  ObjectPattern: ["properties"],
  PanicError: [],
  ParseError: [],
  PrivateIdentifier: [],
  Program: ["body"],
  Property: ["key", "value"],
  PropertyDefinition: ["decorators", "key", "value"],
  RestElement: ["argument"],
  ReturnStatement: ["argument"],
  SequenceExpression: ["expressions"],
  SpreadElement: ["argument"],
  StaticBlock: ["body"],
  Super: [],
  SwitchCase: ["test", "consequent"],
  SwitchStatement: ["discriminant", "cases"],
  TaggedTemplateExpression: ["tag", "quasi"],
  TemplateElement: [],
  TemplateLiteral: ["quasis", "expressions"],
  ThisExpression: [],
  ThrowStatement: ["argument"],
  TryStatement: ["block", "handler", "finalizer"],
  UnaryExpression: ["argument"],
  UpdateExpression: ["argument"],
  VariableDeclaration: ["declarations"],
  VariableDeclarator: ["id", "init"],
  WhileStatement: ["test", "body"],
  YieldExpression: ["argument"]
}, Yl = "variables", at = /* @__PURE__ */ Symbol("IS_SKIPPED_CHAIN");
class v extends qe {
  /**
   * Nodes can apply custom deoptimizations once they become part of the
   * executed code. To do this, they must initialize this as false, implement
   * applyDeoptimizations and call this from include and hasEffects if they have
   * custom handlers
   */
  get deoptimized() {
    return Z(
      this.flags,
      2
      /* Flag.deoptimized */
    );
  }
  set deoptimized(e) {
    this.flags = ee(this.flags, 2, e);
  }
  constructor(e, t) {
    super(), this.parent = e, this.scope = t, this.createScope(t);
  }
  addExportedVariables(e, t) {
  }
  /**
   * Override this to bind assignments to variables and do any initialisations
   * that require the scopes to be populated with variables.
   */
  bind() {
    for (const e of wt[this.type]) {
      const t = this[e];
      if (Array.isArray(t))
        for (const s of t)
          s?.bind();
      else t && t.bind();
    }
  }
  /**
   * Override if this node should receive a different scope than the parent
   * scope.
   */
  createScope(e) {
    this.scope = e;
  }
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t of wt[this.type]) {
      const s = this[t];
      if (s !== null) {
        if (Array.isArray(s)) {
          for (const n of s)
            if (n?.hasEffects(e))
              return !0;
        } else if (s.hasEffects(e))
          return !0;
      }
    }
    return !1;
  }
  hasEffectsAsAssignmentTarget(e, t) {
    return this.hasEffects(e) || this.hasEffectsOnInteractionAtPath(D, this.assignmentInteraction, e);
  }
  include(e, t, s) {
    this.included || this.includeNode(e);
    for (const n of wt[this.type]) {
      const r = this[n];
      if (r !== null)
        if (Array.isArray(r))
          for (const a of r)
            a?.include(e, t);
        else
          r.include(e, t);
    }
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations();
    for (const t of wt[this.type]) {
      const s = this[t];
      if (s !== null)
        if (Array.isArray(s))
          for (const n of s)
            n?.includePath(O, e);
        else
          s.includePath(O, e);
    }
  }
  includeAsAssignmentTarget(e, t, s) {
    this.include(e, t);
  }
  /**
   * Override to perform special initialisation steps after the scope is
   * initialised
   */
  initialise() {
    this.scope.context.magicString.addSourcemapLocation(this.start), this.scope.context.magicString.addSourcemapLocation(this.end);
  }
  parseNode(e) {
    for (const [t, s] of Object.entries(e))
      if (!this.hasOwnProperty(t))
        if (t.charCodeAt(0) === 95)
          t === $h ? this.annotations = s : t === wh && (this.invalidAnnotations = s);
        else if (typeof s != "object" || s === null)
          this[t] = s;
        else if (Array.isArray(s)) {
          this[t] = new Array(s.length);
          let n = 0;
          for (const r of s)
            this[t][n++] = r === null ? null : new (this.scope.context.getNodeConstructor(r.type))(this, this.scope).parseNode(r);
        } else
          this[t] = new (this.scope.context.getNodeConstructor(s.type))(this, this.scope).parseNode(s);
    return wt[e.type] ||= Hd(e), this.initialise(), this;
  }
  removeAnnotations(e) {
    if (this.annotations)
      for (const t of this.annotations)
        e.remove(t.start, t.end);
  }
  render(e, t) {
    for (const s of wt[this.type]) {
      const n = this[s];
      if (n !== null)
        if (Array.isArray(n))
          for (const r of n)
            r?.render(e, t);
        else
          n.render(e, t);
    }
  }
  setAssignedValue(e) {
    this.assignmentInteraction = { args: [null, e], type: Ue };
  }
  shouldBeIncluded(e) {
    return this.included || !e.brokenFlow && this.hasEffects(Es());
  }
  /**
   * Just deoptimize everything by default so that when e.g. we do not track
   * something properly, it is deoptimized.
   * @protected
   */
  applyDeoptimizations() {
    this.deoptimized = !0;
    for (const e of wt[this.type]) {
      const t = this[e];
      if (t !== null)
        if (Array.isArray(t))
          for (const s of t)
            s?.deoptimizePath(O);
        else
          t.deoptimizePath(O);
    }
    this.scope.context.requestTreeshakingPass();
  }
}
function Hd(i) {
  return Object.keys(i).filter(
    (e) => typeof i[e] == "object" && e.charCodeAt(0) !== 95
    /* _ */
  );
}
function Ce() {
  this.included = !0, this.deoptimized || this.applyDeoptimizations();
}
function oe() {
  this.included = !0;
}
function Y() {
  this.deoptimized = !0;
}
function Gd(i) {
  return i instanceof v && i.type === Qh;
}
function Wd(i) {
  return i instanceof v && i.type === Nl;
}
function xr(i) {
  return i instanceof v && i.type === Ur;
}
function Sr(i) {
  return i instanceof v && i.type === kh;
}
function Kd(i) {
  return i instanceof v && i.type === js;
}
function ro(i) {
  return i instanceof v && i.type === vh;
}
function qd(i) {
  return i instanceof v && i.type === Ch;
}
function Xd(i) {
  return i instanceof v && i.type === zr;
}
function ao(i) {
  return i instanceof v && i.type === Ze;
}
function Ws(i, e = null) {
  return Object.create(e, i);
}
const mt = new class extends qe {
  getLiteralValueAtPath(e) {
    return e.length > 0 ? K : void 0;
  }
}(), kt = {
  value: {
    hasEffectsWhenCalled: null,
    returns: G
  }
}, Zr = new class extends qe {
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length === 1 ? qs(Pr, e[0]) : Se;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === ge ? e.length > 1 : t.type === X && e.length === 1 ? Ks(Pr, e[0], t, s) : !0;
  }
}(), Et = {
  value: {
    hasEffectsWhenCalled: null,
    returns: Zr
  }
}, bs = new class extends qe {
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length === 1 ? qs(Ir, e[0]) : Se;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === ge ? e.length > 1 : t.type === X && e.length === 1 ? Ks(Ir, e[0], t, s) : !0;
  }
}(), es = {
  value: {
    hasEffectsWhenCalled: null,
    returns: bs
  }
}, ea = new class extends qe {
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length === 1 ? qs(_s, e[0]) : Se;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === ge ? e.length > 1 : t.type === X && e.length === 1 ? Ks(_s, e[0], t, s) : !0;
  }
}(), J = {
  value: {
    hasEffectsWhenCalled: null,
    returns: ea
  }
}, oo = {
  value: {
    hasEffectsWhenCalled({ args: i }, e) {
      const t = i[2];
      return i.length < 3 || typeof t.getLiteralValueAtPath(D, de, {
        deoptimizeCache() {
        }
      }) == "symbol" && t.hasEffectsOnInteractionAtPath(D, Gs, e);
    },
    returns: ea
  }
}, oi = Ws({
  hasOwnProperty: Et,
  isPrototypeOf: Et,
  propertyIsEnumerable: Et,
  toLocaleString: J,
  toString: J,
  valueOf: kt
}), Pr = Ws({
  valueOf: Et
}, oi), Ir = Ws({
  toExponential: J,
  toFixed: J,
  toLocaleString: J,
  toPrecision: J,
  valueOf: es
}, oi), Jd = Ws({
  exec: kt,
  test: Et
}, oi), _s = Ws({
  anchor: J,
  at: kt,
  big: J,
  blink: J,
  bold: J,
  charAt: J,
  charCodeAt: es,
  codePointAt: kt,
  concat: J,
  endsWith: Et,
  fixed: J,
  fontcolor: J,
  fontsize: J,
  includes: Et,
  indexOf: es,
  italics: J,
  lastIndexOf: es,
  link: J,
  localeCompare: es,
  match: kt,
  matchAll: kt,
  normalize: J,
  padEnd: J,
  padStart: J,
  repeat: J,
  replace: oo,
  replaceAll: oo,
  search: es,
  slice: J,
  small: J,
  split: kt,
  startsWith: Et,
  strike: J,
  sub: J,
  substr: J,
  substring: J,
  sup: J,
  toLocaleLowerCase: J,
  toLocaleUpperCase: J,
  toLowerCase: J,
  toString: J,
  // overrides the toString() method of the Object object; it does not inherit Object.prototype.toString()
  toUpperCase: J,
  trim: J,
  trimEnd: J,
  trimLeft: J,
  trimRight: J,
  trimStart: J,
  valueOf: J
}, oi);
function Yd(i) {
  if (i instanceof RegExp)
    return Jd;
  switch (typeof i) {
    case "boolean":
      return Pr;
    case "number":
      return Ir;
    case "string":
      return _s;
  }
  return /* @__PURE__ */ Object.create(null);
}
function Ks(i, e, t, s) {
  return typeof e != "string" || !i[e] ? !0 : i[e].hasEffectsWhenCalled?.(t, s) || !1;
}
function qs(i, e) {
  return typeof e != "string" || !i[e] ? Se : [i[e].returns, !1];
}
class je extends qe {
  constructor(e) {
    super(), this.description = e;
  }
  deoptimizeArgumentsOnInteractionAtPath({ args: e, type: t }, s) {
    if (t === X && s.length === 0 && (this.description.mutatesSelfAsArray && e[0]?.deoptimizePath(br), this.description.mutatesArgs))
      for (let n = 1; n < e.length; n++)
        e[n].deoptimizePath(O);
  }
  getReturnExpressionWhenCalledAtPath(e, { args: t }) {
    return e.length > 0 ? Se : [
      this.description.returnsPrimitive || (this.description.returns === "self" ? t[0] || G : this.description.returns()),
      !1
    ];
  }
  hasEffectsOnInteractionAtPath(e, { args: t, type: s }, n) {
    if (e.length > (s === ge ? 1 : 0))
      return !0;
    if (s === X) {
      if (this.description.mutatesSelfAsArray === !0 && t[0]?.hasEffectsOnInteractionAtPath(br, Yr, n))
        return !0;
      if (this.description.callsArgs) {
        for (const r of this.description.callsArgs)
          if (t[r + 1]?.hasEffectsOnInteractionAtPath(D, Gs, n))
            return !0;
      }
    }
    return !1;
  }
}
const Pn = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !1,
    returns: null,
    returnsPrimitive: Zr
  })
], Ds = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !1,
    returns: null,
    returnsPrimitive: ea
  })
], lo = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !1,
    returns: null,
    returnsPrimitive: bs
  })
], Ql = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !1,
    returns: null,
    returnsPrimitive: G
  })
], ws = /^\d+$/;
class Ke extends qe {
  get hasLostTrack() {
    return Z(
      this.flags,
      2048
      /* Flag.hasLostTrack */
    );
  }
  set hasLostTrack(e) {
    this.flags = ee(this.flags, 2048, e);
  }
  get hasUnknownDeoptimizedInteger() {
    return Z(
      this.flags,
      4096
      /* Flag.hasUnknownDeoptimizedInteger */
    );
  }
  set hasUnknownDeoptimizedInteger(e) {
    this.flags = ee(this.flags, 4096, e);
  }
  get hasUnknownDeoptimizedProperty() {
    return Z(
      this.flags,
      8192
      /* Flag.hasUnknownDeoptimizedProperty */
    );
  }
  set hasUnknownDeoptimizedProperty(e) {
    this.flags = ee(this.flags, 8192, e);
  }
  // If a PropertyMap is used, this will be taken as propertiesAndGettersByKey
  // and we assume there are no setters or getters
  constructor(e, t, s = !1) {
    if (super(), this.prototypeExpression = t, this.immutable = s, this.additionalExpressionsToBeDeoptimized = /* @__PURE__ */ new Set(), this.allProperties = [], this.alwaysIncludedProperties = /* @__PURE__ */ new Set(), this.deoptimizedPaths = /* @__PURE__ */ new Map(), this.expressionsToBeDeoptimizedByKey = /* @__PURE__ */ new Map(), this.gettersByKey = /* @__PURE__ */ new Map(), this.propertiesAndGettersByKey = /* @__PURE__ */ new Map(), this.propertiesAndSettersByKey = /* @__PURE__ */ new Map(), this.settersByKey = /* @__PURE__ */ new Map(), this.unknownIntegerProps = [], this.unmatchableGetters = [], this.unmatchablePropertiesAndGetters = [], this.unmatchablePropertiesAndSetters = [], this.unmatchableSetters = [], Array.isArray(e))
      this.buildPropertyMaps(e);
    else {
      this.propertiesAndGettersByKey = this.propertiesAndSettersByKey = e;
      for (const n of e.values())
        this.allProperties.push(...n);
    }
  }
  deoptimizeAllProperties(e) {
    const t = this.hasLostTrack || this.hasUnknownDeoptimizedProperty;
    if (e ? this.hasUnknownDeoptimizedProperty = !0 : this.hasLostTrack = !0, !t) {
      for (const s of [
        ...this.propertiesAndGettersByKey.values(),
        ...this.settersByKey.values()
      ])
        for (const n of s)
          n.deoptimizePath(O);
      this.prototypeExpression?.deoptimizePath([W, W]), this.deoptimizeCachedEntities();
    }
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    const [n, ...r] = t, { args: a, type: o } = e;
    if (this.hasLostTrack || // single paths that are deoptimized will not become getters or setters
    (o === X || t.length > 1) && (this.hasUnknownDeoptimizedProperty || Qe(n) && this.deoptimizedPaths.get(n))) {
      ot(e);
      return;
    }
    const [l, c, h] = o === X || t.length > 1 ? [
      this.propertiesAndGettersByKey,
      this.propertiesAndGettersByKey,
      this.unmatchablePropertiesAndGetters
    ] : o === ge ? [this.propertiesAndGettersByKey, this.gettersByKey, this.unmatchableGetters] : [this.propertiesAndSettersByKey, this.settersByKey, this.unmatchableSetters];
    if (Qe(n)) {
      if (l.get(n)) {
        const p = c.get(n);
        if (p)
          for (const d of p)
            d.deoptimizeArgumentsOnInteractionAtPath(e, r, s);
        if (!this.immutable)
          for (const d of a)
            d && this.additionalExpressionsToBeDeoptimized.add(d);
        return;
      }
      for (const p of h)
        p.deoptimizeArgumentsOnInteractionAtPath(e, r, s);
      if (typeof n == "string" && ws.test(n))
        for (const p of this.unknownIntegerProps)
          p.deoptimizeArgumentsOnInteractionAtPath(e, r, s);
    } else {
      for (const p of [
        ...c.values(),
        h
      ])
        for (const d of p)
          d.deoptimizeArgumentsOnInteractionAtPath(e, r, s);
      for (const p of this.unknownIntegerProps)
        p.deoptimizeArgumentsOnInteractionAtPath(e, r, s);
    }
    if (!this.immutable)
      for (const p of a)
        p && this.additionalExpressionsToBeDeoptimized.add(p);
    this.prototypeExpression?.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizeIntegerProperties() {
    if (!(this.hasLostTrack || this.hasUnknownDeoptimizedProperty || this.hasUnknownDeoptimizedInteger)) {
      this.hasUnknownDeoptimizedInteger = !0;
      for (const [e, t] of this.propertiesAndGettersByKey.entries())
        if (typeof e == "string" && ws.test(e))
          for (const s of t)
            s.deoptimizePath(O);
      this.deoptimizeCachedIntegerEntities();
    }
  }
  // Assumption: If only a specific path is deoptimized, no accessors are created
  deoptimizePath(e) {
    if (this.hasLostTrack || this.immutable)
      return;
    const t = e[0];
    if (e.length === 1) {
      if (t === cs)
        return this.deoptimizeIntegerProperties();
      if (!Qe(t))
        return this.deoptimizeAllProperties(t === Tn);
      if (!this.deoptimizedPaths.get(t)) {
        this.deoptimizedPaths.set(t, !0);
        const n = this.expressionsToBeDeoptimizedByKey.get(t);
        if (n)
          for (const r of n)
            r.deoptimizeCache();
      }
    }
    const s = e.length === 1 ? O : e.slice(1);
    for (const n of Qe(t) ? [
      ...this.propertiesAndGettersByKey.get(t) || this.unmatchablePropertiesAndGetters,
      ...this.settersByKey.get(t) || this.unmatchableSetters
    ] : this.allProperties)
      n.deoptimizePath(s);
    this.prototypeExpression?.deoptimizePath(e.length === 1 ? [e[0], W] : e);
  }
  getLiteralValueAtPath(e, t, s) {
    if (e.length === 0)
      return K;
    const n = e[0], r = this.getMemberExpressionAndTrackDeopt(n, s);
    if (r)
      return r.getLiteralValueAtPath(e.slice(1), t, s);
    if (this.prototypeExpression)
      return this.prototypeExpression.getLiteralValueAtPath(e, t, s);
    if (e.length !== 1)
      return K;
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    if (e.length === 0)
      return Se;
    const [r, ...a] = e, o = this.getMemberExpressionAndTrackDeopt(r, n);
    return o ? o.getReturnExpressionWhenCalledAtPath(a, t, s, n) : this.prototypeExpression ? this.prototypeExpression.getReturnExpressionWhenCalledAtPath(e, t, s, n) : Se;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const [n, ...r] = e;
    if (r.length > 0 || t.type === X) {
      const c = this.getMemberExpression(n);
      return c ? c.hasEffectsOnInteractionAtPath(r, t, s) : this.prototypeExpression ? this.prototypeExpression.hasEffectsOnInteractionAtPath(e, t, s) : !0;
    }
    if (n === Tn)
      return !1;
    if (this.hasLostTrack)
      return !0;
    const [a, o, l] = t.type === ge ? [this.propertiesAndGettersByKey, this.gettersByKey, this.unmatchableGetters] : [this.propertiesAndSettersByKey, this.settersByKey, this.unmatchableSetters];
    if (Qe(n)) {
      if (a.get(n)) {
        const c = o.get(n);
        if (c) {
          for (const h of c)
            if (h.hasEffectsOnInteractionAtPath(r, t, s))
              return !0;
        }
        return !1;
      }
      for (const c of l)
        if (c.hasEffectsOnInteractionAtPath(r, t, s))
          return !0;
    } else
      for (const c of [...o.values(), l])
        for (const h of c)
          if (h.hasEffectsOnInteractionAtPath(r, t, s))
            return !0;
    return this.prototypeExpression ? this.prototypeExpression.hasEffectsOnInteractionAtPath(e, t, s) : !1;
  }
  include(e, t) {
    this.included = !0;
    for (const s of this.allProperties)
      (t || s.shouldBeIncluded(e) || this.alwaysIncludedProperties.has(s)) && s.include(e, t);
    this.prototypeExpression?.include(e, t);
  }
  includePath(e, t) {
    this.included = !0;
    for (const o of this.alwaysIncludedProperties)
      o.includePath(O, t);
    if (e.length === 0)
      return;
    const [s, ...n] = e, [r, a] = Qe(s) ? [
      /* @__PURE__ */ new Set([
        ...this.propertiesAndGettersByKey.get(s) || this.unmatchablePropertiesAndGetters,
        ...this.propertiesAndSettersByKey.get(s) || this.unmatchablePropertiesAndSetters
      ]),
      n
    ] : [this.allProperties, O];
    for (const o of r)
      o.includePath(a, t);
    this.prototypeExpression?.includePath(e, t);
  }
  buildPropertyMaps(e) {
    const { allProperties: t, alwaysIncludedProperties: s, propertiesAndGettersByKey: n, propertiesAndSettersByKey: r, settersByKey: a, gettersByKey: o, unknownIntegerProps: l, unmatchablePropertiesAndGetters: c, unmatchablePropertiesAndSetters: h, unmatchableGetters: p, unmatchableSetters: d } = this;
    for (let m = e.length - 1; m >= 0; m--) {
      const { key: f, kind: g, property: y } = e[m];
      if (t.push(y), !(qr(f) && !Od.has(f) && (s.add(y), f === Gr)))
        if (Qe(f))
          g === "set" ? r.has(f) || (r.set(f, [y, ...h]), a.set(f, [y, ...d])) : g === "get" ? n.has(f) || (n.set(f, [y, ...c]), o.set(f, [y, ...p])) : (r.has(f) || r.set(f, [y, ...h]), n.has(f) || n.set(f, [y, ...c]));
        else {
          if (f === cs) {
            l.push(y);
            continue;
          }
          g === "set" && d.push(y), g === "get" && p.push(y), g !== "get" && h.push(y), g !== "set" && c.push(y);
        }
    }
  }
  deoptimizeCachedEntities() {
    for (const e of this.expressionsToBeDeoptimizedByKey.values())
      for (const t of e)
        t.deoptimizeCache();
    for (const e of this.additionalExpressionsToBeDeoptimized)
      e.deoptimizePath(O);
  }
  deoptimizeCachedIntegerEntities() {
    for (const [e, t] of this.expressionsToBeDeoptimizedByKey.entries())
      if (typeof e == "string" && ws.test(e))
        for (const s of t)
          s.deoptimizeCache();
    for (const e of this.additionalExpressionsToBeDeoptimized)
      e.deoptimizePath(br);
  }
  getMemberExpression(e) {
    if (this.hasLostTrack || this.hasUnknownDeoptimizedProperty || !Qe(e) || this.hasUnknownDeoptimizedInteger && typeof e == "string" && ws.test(e) || this.deoptimizedPaths.get(e))
      return G;
    const t = this.propertiesAndGettersByKey.get(e);
    return t?.length === 1 ? t[0] : t || this.unmatchablePropertiesAndGetters.length > 0 || this.unknownIntegerProps.length > 0 && typeof e == "string" && ws.test(e) ? G : null;
  }
  getMemberExpressionAndTrackDeopt(e, t) {
    if (!Qe(e))
      return G;
    const s = this.getMemberExpression(e);
    if (!(s === G || this.immutable)) {
      let n = this.expressionsToBeDeoptimizedByKey.get(e);
      n || this.expressionsToBeDeoptimizedByKey.set(e, n = []), n.push(t);
    }
    return s;
  }
}
const co = (i) => typeof i == "string" && /^\d+$/.test(i), Qd = new class extends qe {
  deoptimizeArgumentsOnInteractionAtPath(e, t) {
    e.type === X && t.length === 1 && !co(t[0]) && ot(e);
  }
  getLiteralValueAtPath(e) {
    return e.length === 1 && co(e[0]) ? void 0 : K;
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return e.length > 1 || t === X;
  }
}(), bt = new Ke(/* @__PURE__ */ new Map([
  ["hasOwnProperty", Pn],
  ["isPrototypeOf", Pn],
  ["propertyIsEnumerable", Pn],
  ["toLocaleString", Ds],
  ["toString", Ds],
  ["valueOf", Ql]
]), Qd, !0), ta = [
  { key: cs, kind: "init", property: G },
  { key: "length", kind: "init", property: bs }
], uo = [
  new je({
    callsArgs: [0],
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: null,
    returnsPrimitive: Zr
  })
], ho = [
  new je({
    callsArgs: [0],
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: null,
    returnsPrimitive: bs
  })
], Zd = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !0,
    returns: () => new Ke(ta, li),
    returnsPrimitive: null
  })
], un = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: () => new Ke(ta, li),
    returnsPrimitive: null
  })
], Hi = [
  new je({
    callsArgs: [0],
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: () => new Ke(ta, li),
    returnsPrimitive: null
  })
], po = [
  new je({
    callsArgs: null,
    mutatesArgs: !0,
    mutatesSelfAsArray: !0,
    returns: null,
    returnsPrimitive: bs
  })
], fo = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !0,
    returns: null,
    returnsPrimitive: G
  })
], mo = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: null,
    returnsPrimitive: G
  })
], Cs = [
  new je({
    callsArgs: [0],
    mutatesArgs: !1,
    mutatesSelfAsArray: "deopt-only",
    returns: null,
    returnsPrimitive: G
  })
], Gi = [
  new je({
    callsArgs: null,
    mutatesArgs: !1,
    mutatesSelfAsArray: !0,
    returns: "self",
    returnsPrimitive: null
  })
], ep = [
  new je({
    callsArgs: [0],
    mutatesArgs: !1,
    mutatesSelfAsArray: !0,
    returns: "self",
    returnsPrimitive: null
  })
], li = new Ke(/* @__PURE__ */ new Map([
  // We assume that accessors have effects as we do not track the accessed value afterwards
  ["at", mo],
  ["concat", un],
  ["copyWithin", Gi],
  ["entries", un],
  ["every", uo],
  ["fill", Gi],
  ["filter", Hi],
  ["find", Cs],
  ["findIndex", ho],
  ["findLast", Cs],
  ["findLastIndex", ho],
  ["flat", un],
  ["flatMap", Hi],
  ["forEach", Cs],
  ["includes", Pn],
  ["indexOf", lo],
  ["join", Ds],
  ["keys", Ql],
  ["lastIndexOf", lo],
  ["map", Hi],
  ["pop", fo],
  ["push", po],
  ["reduce", Cs],
  ["reduceRight", Cs],
  ["reverse", Gi],
  ["shift", fo],
  ["slice", un],
  ["some", uo],
  ["sort", ep],
  ["splice", Zd],
  ["toLocaleString", Ds],
  ["toString", Ds],
  ["unshift", po],
  ["values", mo]
]), bt, !0);
class Vt extends v {
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    t.length > 0 && this.argument.deoptimizeArgumentsOnInteractionAtPath(e, O, s);
  }
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    const { propertyReadSideEffects: t } = this.scope.context.options.treeshake;
    return this.argument.hasEffects(e) || t && (t === "always" || this.argument.hasEffectsOnInteractionAtPath(O, zt, e));
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.argument.includePath(O, e);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.argument.deoptimizePath([W, W]), this.scope.context.requestTreeshakingPass();
  }
}
class sa extends v {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.getObjectEntity().deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getObjectEntity().getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e, t, s, n);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.getObjectEntity().hasEffectsOnInteractionAtPath(e, t, s);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations();
    for (const t of this.elements)
      t && t?.includePath(O, e);
  }
  applyDeoptimizations() {
    this.deoptimized = !0;
    let e = !1;
    for (let t = 0; t < this.elements.length; t++) {
      const s = this.elements[t];
      s && (e || s instanceof Vt) && (e = !0, s.deoptimizePath(O));
    }
    this.scope.context.requestTreeshakingPass();
  }
  getObjectEntity() {
    if (this.objectEntity !== null)
      return this.objectEntity;
    const e = [
      { key: "length", kind: "init", property: bs }
    ];
    let t = !1;
    for (let s = 0; s < this.elements.length; s++) {
      const n = this.elements[s];
      t || n instanceof Vt ? n && (t = !0, e.unshift({ key: cs, kind: "init", property: n })) : n ? e.push({ key: String(s), kind: "init", property: n }) : e.push({ key: String(s), kind: "init", property: mt });
    }
    return this.objectEntity = new Ke(e, li);
  }
}
const me = /* @__PURE__ */ Symbol("Value Properties"), Ut = () => K, Zl = () => !1, ci = () => !0, hn = (i) => ({
  __proto__: null,
  [me]: {
    deoptimizeArgumentsOnCall: Je,
    getLiteralValue: () => i,
    hasEffectsWhenCalled: ci
  }
}), nt = {
  deoptimizeArgumentsOnCall: Je,
  getLiteralValue: Ut,
  hasEffectsWhenCalled: Zl
}, dt = {
  deoptimizeArgumentsOnCall: Je,
  getLiteralValue: Ut,
  hasEffectsWhenCalled: ci
}, tp = {
  deoptimizeArgumentsOnCall: Je,
  getLiteralValue: Ut,
  hasEffectsWhenCalled({ args: i }) {
    return i.length > 1 && !(i[1] instanceof sa);
  }
}, sp = {
  deoptimizeArgumentsOnCall: Je,
  getLiteralValue: Ut,
  hasEffectsWhenCalled({ args: i }, e) {
    const [t, s] = i;
    return !(s instanceof qe) || s.hasEffectsOnInteractionAtPath(O, zt, e);
  }
}, P = {
  __proto__: null,
  [me]: dt
}, L = {
  __proto__: null,
  [me]: nt
}, go = {
  __proto__: null,
  [me]: sp
}, Wi = {
  __proto__: null,
  [me]: {
    deoptimizeArgumentsOnCall({ args: [, i] }) {
      i?.deoptimizePath(O);
    },
    getLiteralValue: Ut,
    hasEffectsWhenCalled({ args: i }, e) {
      return i.length <= 1 || i[1].hasEffectsOnInteractionAtPath(Ld, Yr, e);
    }
  }
}, u = {
  __proto__: null,
  [me]: dt,
  prototype: P
}, Ye = {
  __proto__: null,
  [me]: nt,
  prototype: P
}, vs = {
  __proto__: null,
  [me]: tp,
  prototype: P
}, ut = {
  __proto__: null,
  [me]: nt,
  from: P,
  of: L,
  prototype: P
}, ht = {
  __proto__: null,
  [me]: nt,
  supportedLocalesOf: Ye
}, np = {
  deoptimizeArgumentsOnCall: Je,
  getLiteralValue: () => Gr,
  hasEffectsWhenCalled: ci
}, Nr = {
  // Placeholders for global objects to avoid shape mutations
  global: P,
  globalThis: P,
  self: P,
  window: P,
  // Common globals
  __proto__: null,
  [me]: dt,
  Array: {
    __proto__: null,
    [me]: dt,
    from: P,
    isArray: L,
    of: L,
    prototype: P
  },
  ArrayBuffer: {
    __proto__: null,
    [me]: nt,
    isView: L,
    prototype: P
  },
  AggregateError: vs,
  Atomics: P,
  BigInt: u,
  BigInt64Array: u,
  BigUint64Array: u,
  Boolean: Ye,
  constructor: u,
  DataView: Ye,
  Date: {
    __proto__: null,
    [me]: nt,
    now: L,
    parse: L,
    prototype: P,
    UTC: L
  },
  decodeURI: L,
  decodeURIComponent: L,
  encodeURI: L,
  encodeURIComponent: L,
  Error: Ye,
  escape: L,
  eval: P,
  EvalError: Ye,
  FinalizationRegistry: u,
  Float32Array: ut,
  Float64Array: ut,
  Function: u,
  hasOwnProperty: P,
  Infinity: P,
  Int16Array: ut,
  Int32Array: ut,
  Int8Array: ut,
  isFinite: L,
  isNaN: L,
  isPrototypeOf: P,
  JSON: P,
  Map: vs,
  Math: {
    __proto__: null,
    [me]: dt,
    abs: L,
    acos: L,
    acosh: L,
    asin: L,
    asinh: L,
    atan: L,
    atan2: L,
    atanh: L,
    cbrt: L,
    ceil: L,
    clz32: L,
    cos: L,
    cosh: L,
    exp: L,
    expm1: L,
    floor: L,
    fround: L,
    hypot: L,
    imul: L,
    log: L,
    log10: L,
    log1p: L,
    log2: L,
    max: L,
    min: L,
    pow: L,
    random: L,
    round: L,
    sign: L,
    sin: L,
    sinh: L,
    sqrt: L,
    tan: L,
    tanh: L,
    trunc: L
  },
  NaN: P,
  Number: {
    __proto__: null,
    [me]: nt,
    isFinite: L,
    isInteger: L,
    isNaN: L,
    isSafeInteger: L,
    parseFloat: L,
    parseInt: L,
    prototype: P
  },
  Object: {
    __proto__: null,
    [me]: nt,
    create: L,
    // Technically those can throw in certain situations, but we ignore this as
    // code that relies on this will hopefully wrap this in a try-catch, which
    // deoptimizes everything anyway
    defineProperty: Wi,
    defineProperties: Wi,
    freeze: Wi,
    getOwnPropertyDescriptor: L,
    getOwnPropertyDescriptors: L,
    getOwnPropertyNames: L,
    getOwnPropertySymbols: L,
    getPrototypeOf: L,
    hasOwn: L,
    is: L,
    isExtensible: L,
    isFrozen: L,
    isSealed: L,
    keys: L,
    fromEntries: P,
    entries: go,
    values: go,
    prototype: P
  },
  parseFloat: L,
  parseInt: L,
  Promise: {
    __proto__: null,
    [me]: dt,
    all: P,
    allSettled: P,
    any: P,
    prototype: P,
    race: P,
    reject: P,
    resolve: P
  },
  propertyIsEnumerable: P,
  Proxy: {
    __proto__: null,
    [me]: {
      deoptimizeArgumentsOnCall: ({ args: [, i, e] }) => {
        if (Gd(e) && !e.properties.some((s) => !Wd(s))) {
          for (const s of e.properties)
            s.deoptimizeArgumentsOnInteractionAtPath({
              args: [null, i],
              type: X,
              withNew: !1
            }, D, de);
          return;
        }
        i.deoptimizePath(O);
      },
      getLiteralValue: Ut,
      hasEffectsWhenCalled: ci
    }
  },
  RangeError: Ye,
  ReferenceError: Ye,
  Reflect: P,
  RegExp: Ye,
  Set: vs,
  SharedArrayBuffer: u,
  String: {
    __proto__: null,
    [me]: nt,
    fromCharCode: L,
    fromCodePoint: L,
    prototype: P,
    raw: L
  },
  Symbol: {
    __proto__: null,
    [me]: nt,
    for: L,
    keyFor: L,
    prototype: P,
    asyncDispose: hn(ei),
    dispose: hn(Zn),
    hasInstance: hn(ti),
    toStringTag: hn(Wr)
  },
  SyntaxError: Ye,
  toLocaleString: P,
  toString: P,
  TypeError: Ye,
  Uint16Array: ut,
  Uint32Array: ut,
  Uint8Array: ut,
  Uint8ClampedArray: ut,
  // Technically, this is a global, but it needs special handling
  // undefined: ?,
  unescape: L,
  URIError: Ye,
  valueOf: P,
  WeakMap: vs,
  WeakRef: u,
  WeakSet: vs,
  // Additional globals shared by Node and Browser that are not strictly part of the language
  clearInterval: u,
  clearTimeout: u,
  console: {
    __proto__: null,
    [me]: dt,
    assert: u,
    clear: u,
    count: u,
    countReset: u,
    debug: u,
    dir: u,
    dirxml: u,
    error: u,
    exception: u,
    group: u,
    groupCollapsed: u,
    groupEnd: u,
    info: u,
    log: u,
    table: u,
    time: u,
    timeEnd: u,
    timeLog: u,
    trace: u,
    warn: u
  },
  Intl: {
    __proto__: null,
    [me]: dt,
    Collator: ht,
    DateTimeFormat: ht,
    DisplayNames: ht,
    ListFormat: ht,
    Locale: ht,
    NumberFormat: ht,
    PluralRules: ht,
    RelativeTimeFormat: ht,
    Segmenter: ht
  },
  setInterval: u,
  setTimeout: u,
  TextDecoder: u,
  TextEncoder: u,
  URL: {
    __proto__: null,
    [me]: dt,
    prototype: P,
    canParse: L
  },
  URLSearchParams: u,
  // Browser specific globals
  AbortController: u,
  AbortSignal: u,
  addEventListener: P,
  alert: P,
  AnalyserNode: u,
  Animation: u,
  AnimationEvent: u,
  applicationCache: P,
  ApplicationCache: u,
  ApplicationCacheErrorEvent: u,
  atob: P,
  Attr: u,
  Audio: u,
  AudioBuffer: u,
  AudioBufferSourceNode: u,
  AudioContext: u,
  AudioDestinationNode: u,
  AudioListener: u,
  AudioNode: u,
  AudioParam: u,
  AudioProcessingEvent: u,
  AudioScheduledSourceNode: u,
  AudioWorkletNode: u,
  BarProp: u,
  BaseAudioContext: u,
  BatteryManager: u,
  BeforeUnloadEvent: u,
  BiquadFilterNode: u,
  Blob: u,
  BlobEvent: u,
  blur: P,
  BroadcastChannel: u,
  btoa: P,
  ByteLengthQueuingStrategy: u,
  Cache: u,
  caches: P,
  CacheStorage: u,
  cancelAnimationFrame: P,
  cancelIdleCallback: P,
  CanvasCaptureMediaStreamTrack: u,
  CanvasGradient: u,
  CanvasPattern: u,
  CanvasRenderingContext2D: u,
  ChannelMergerNode: u,
  ChannelSplitterNode: u,
  CharacterData: u,
  clientInformation: P,
  ClipboardEvent: u,
  close: P,
  closed: P,
  CloseEvent: u,
  Comment: u,
  CompositionEvent: u,
  confirm: P,
  ConstantSourceNode: u,
  ConvolverNode: u,
  CountQueuingStrategy: u,
  createImageBitmap: P,
  Credential: u,
  CredentialsContainer: u,
  crypto: P,
  Crypto: u,
  CryptoKey: u,
  CSS: u,
  CSSConditionRule: u,
  CSSFontFaceRule: u,
  CSSGroupingRule: u,
  CSSImportRule: u,
  CSSKeyframeRule: u,
  CSSKeyframesRule: u,
  CSSMediaRule: u,
  CSSNamespaceRule: u,
  CSSPageRule: u,
  CSSRule: u,
  CSSRuleList: u,
  CSSStyleDeclaration: u,
  CSSStyleRule: u,
  CSSStyleSheet: u,
  CSSSupportsRule: u,
  CustomElementRegistry: u,
  customElements: P,
  CustomEvent: {
    __proto__: null,
    [me]: {
      deoptimizeArgumentsOnCall({ args: i }) {
        i[2]?.deoptimizePath(["detail"]);
      },
      getLiteralValue: Ut,
      hasEffectsWhenCalled: Zl
    },
    prototype: P
  },
  DataTransfer: u,
  DataTransferItem: u,
  DataTransferItemList: u,
  defaultstatus: P,
  defaultStatus: P,
  DelayNode: u,
  DeviceMotionEvent: u,
  DeviceOrientationEvent: u,
  devicePixelRatio: P,
  dispatchEvent: P,
  document: P,
  Document: u,
  DocumentFragment: u,
  DocumentType: u,
  DOMError: u,
  DOMException: u,
  DOMImplementation: u,
  DOMMatrix: u,
  DOMMatrixReadOnly: u,
  DOMParser: u,
  DOMPoint: u,
  DOMPointReadOnly: u,
  DOMQuad: u,
  DOMRect: u,
  DOMRectReadOnly: u,
  DOMStringList: u,
  DOMStringMap: u,
  DOMTokenList: u,
  DragEvent: u,
  DynamicsCompressorNode: u,
  Element: u,
  ErrorEvent: u,
  Event: u,
  EventSource: u,
  EventTarget: u,
  external: P,
  fetch: P,
  File: u,
  FileList: u,
  FileReader: u,
  find: P,
  focus: P,
  FocusEvent: u,
  FontFace: u,
  FontFaceSetLoadEvent: u,
  FormData: u,
  frames: P,
  GainNode: u,
  Gamepad: u,
  GamepadButton: u,
  GamepadEvent: u,
  getComputedStyle: P,
  getSelection: P,
  HashChangeEvent: u,
  Headers: u,
  history: P,
  History: u,
  HTMLAllCollection: u,
  HTMLAnchorElement: u,
  HTMLAreaElement: u,
  HTMLAudioElement: u,
  HTMLBaseElement: u,
  HTMLBodyElement: u,
  HTMLBRElement: u,
  HTMLButtonElement: u,
  HTMLCanvasElement: u,
  HTMLCollection: u,
  HTMLContentElement: u,
  HTMLDataElement: u,
  HTMLDataListElement: u,
  HTMLDetailsElement: u,
  HTMLDialogElement: u,
  HTMLDirectoryElement: u,
  HTMLDivElement: u,
  HTMLDListElement: u,
  HTMLDocument: u,
  HTMLElement: u,
  HTMLEmbedElement: u,
  HTMLFieldSetElement: u,
  HTMLFontElement: u,
  HTMLFormControlsCollection: u,
  HTMLFormElement: u,
  HTMLFrameElement: u,
  HTMLFrameSetElement: u,
  HTMLHeadElement: u,
  HTMLHeadingElement: u,
  HTMLHRElement: u,
  HTMLHtmlElement: u,
  HTMLIFrameElement: u,
  HTMLImageElement: u,
  HTMLInputElement: u,
  HTMLLabelElement: u,
  HTMLLegendElement: u,
  HTMLLIElement: u,
  HTMLLinkElement: u,
  HTMLMapElement: u,
  HTMLMarqueeElement: u,
  HTMLMediaElement: u,
  HTMLMenuElement: u,
  HTMLMetaElement: u,
  HTMLMeterElement: u,
  HTMLModElement: u,
  HTMLObjectElement: u,
  HTMLOListElement: u,
  HTMLOptGroupElement: u,
  HTMLOptionElement: u,
  HTMLOptionsCollection: u,
  HTMLOutputElement: u,
  HTMLParagraphElement: u,
  HTMLParamElement: u,
  HTMLPictureElement: u,
  HTMLPreElement: u,
  HTMLProgressElement: u,
  HTMLQuoteElement: u,
  HTMLScriptElement: u,
  HTMLSelectElement: u,
  HTMLShadowElement: u,
  HTMLSlotElement: u,
  HTMLSourceElement: u,
  HTMLSpanElement: u,
  HTMLStyleElement: u,
  HTMLTableCaptionElement: u,
  HTMLTableCellElement: u,
  HTMLTableColElement: u,
  HTMLTableElement: u,
  HTMLTableRowElement: u,
  HTMLTableSectionElement: u,
  HTMLTemplateElement: u,
  HTMLTextAreaElement: u,
  HTMLTimeElement: u,
  HTMLTitleElement: u,
  HTMLTrackElement: u,
  HTMLUListElement: u,
  HTMLUnknownElement: u,
  HTMLVideoElement: u,
  IDBCursor: u,
  IDBCursorWithValue: u,
  IDBDatabase: u,
  IDBFactory: u,
  IDBIndex: u,
  IDBKeyRange: u,
  IDBObjectStore: u,
  IDBOpenDBRequest: u,
  IDBRequest: u,
  IDBTransaction: u,
  IDBVersionChangeEvent: u,
  IdleDeadline: u,
  IIRFilterNode: u,
  Image: u,
  ImageBitmap: u,
  ImageBitmapRenderingContext: u,
  ImageCapture: u,
  ImageData: u,
  indexedDB: P,
  innerHeight: P,
  innerWidth: P,
  InputEvent: u,
  IntersectionObserver: u,
  IntersectionObserverEntry: u,
  isSecureContext: P,
  KeyboardEvent: u,
  KeyframeEffect: u,
  length: P,
  localStorage: P,
  location: P,
  Location: u,
  locationbar: P,
  matchMedia: P,
  MediaDeviceInfo: u,
  MediaDevices: u,
  MediaElementAudioSourceNode: u,
  MediaEncryptedEvent: u,
  MediaError: u,
  MediaKeyMessageEvent: u,
  MediaKeySession: u,
  MediaKeyStatusMap: u,
  MediaKeySystemAccess: u,
  MediaList: u,
  MediaQueryList: u,
  MediaQueryListEvent: u,
  MediaRecorder: u,
  MediaSettingsRange: u,
  MediaSource: u,
  MediaStream: u,
  MediaStreamAudioDestinationNode: u,
  MediaStreamAudioSourceNode: u,
  MediaStreamEvent: u,
  MediaStreamTrack: u,
  MediaStreamTrackEvent: u,
  menubar: P,
  MessageChannel: u,
  MessageEvent: u,
  MessagePort: u,
  MIDIAccess: u,
  MIDIConnectionEvent: u,
  MIDIInput: u,
  MIDIInputMap: u,
  MIDIMessageEvent: u,
  MIDIOutput: u,
  MIDIOutputMap: u,
  MIDIPort: u,
  MimeType: u,
  MimeTypeArray: u,
  MouseEvent: u,
  moveBy: P,
  moveTo: P,
  MutationEvent: u,
  MutationObserver: u,
  MutationRecord: u,
  name: P,
  NamedNodeMap: u,
  NavigationPreloadManager: u,
  navigator: P,
  Navigator: u,
  NetworkInformation: u,
  Node: u,
  NodeFilter: P,
  NodeIterator: u,
  NodeList: u,
  Notification: u,
  OfflineAudioCompletionEvent: u,
  OfflineAudioContext: u,
  offscreenBuffering: P,
  OffscreenCanvas: u,
  open: P,
  openDatabase: P,
  Option: u,
  origin: P,
  OscillatorNode: u,
  outerHeight: P,
  outerWidth: P,
  PageTransitionEvent: u,
  pageXOffset: P,
  pageYOffset: P,
  PannerNode: u,
  parent: P,
  Path2D: u,
  PaymentAddress: u,
  PaymentRequest: u,
  PaymentRequestUpdateEvent: u,
  PaymentResponse: u,
  performance: P,
  Performance: u,
  PerformanceEntry: u,
  PerformanceLongTaskTiming: u,
  PerformanceMark: u,
  PerformanceMeasure: u,
  PerformanceNavigation: u,
  PerformanceNavigationTiming: u,
  PerformanceObserver: u,
  PerformanceObserverEntryList: u,
  PerformancePaintTiming: u,
  PerformanceResourceTiming: u,
  PerformanceTiming: u,
  PeriodicWave: u,
  Permissions: u,
  PermissionStatus: u,
  personalbar: P,
  PhotoCapabilities: u,
  Plugin: u,
  PluginArray: u,
  PointerEvent: u,
  PopStateEvent: u,
  postMessage: P,
  Presentation: u,
  PresentationAvailability: u,
  PresentationConnection: u,
  PresentationConnectionAvailableEvent: u,
  PresentationConnectionCloseEvent: u,
  PresentationConnectionList: u,
  PresentationReceiver: u,
  PresentationRequest: u,
  print: P,
  ProcessingInstruction: u,
  ProgressEvent: u,
  PromiseRejectionEvent: u,
  prompt: P,
  PushManager: u,
  PushSubscription: u,
  PushSubscriptionOptions: u,
  queueMicrotask: P,
  RadioNodeList: u,
  Range: u,
  ReadableStream: u,
  RemotePlayback: u,
  removeEventListener: P,
  Request: u,
  requestAnimationFrame: P,
  requestIdleCallback: P,
  resizeBy: P,
  ResizeObserver: u,
  ResizeObserverEntry: u,
  resizeTo: P,
  Response: u,
  RTCCertificate: u,
  RTCDataChannel: u,
  RTCDataChannelEvent: u,
  RTCDtlsTransport: u,
  RTCIceCandidate: u,
  RTCIceTransport: u,
  RTCPeerConnection: u,
  RTCPeerConnectionIceEvent: u,
  RTCRtpReceiver: u,
  RTCRtpSender: u,
  RTCSctpTransport: u,
  RTCSessionDescription: u,
  RTCStatsReport: u,
  RTCTrackEvent: u,
  screen: P,
  Screen: u,
  screenLeft: P,
  ScreenOrientation: u,
  screenTop: P,
  screenX: P,
  screenY: P,
  ScriptProcessorNode: u,
  scroll: P,
  scrollbars: P,
  scrollBy: P,
  scrollTo: P,
  scrollX: P,
  scrollY: P,
  SecurityPolicyViolationEvent: u,
  Selection: u,
  ServiceWorker: u,
  ServiceWorkerContainer: u,
  ServiceWorkerRegistration: u,
  sessionStorage: P,
  ShadowRoot: u,
  SharedWorker: u,
  SourceBuffer: u,
  SourceBufferList: u,
  speechSynthesis: P,
  SpeechSynthesisEvent: u,
  SpeechSynthesisUtterance: u,
  StaticRange: u,
  status: P,
  statusbar: P,
  StereoPannerNode: u,
  stop: P,
  Storage: u,
  StorageEvent: u,
  StorageManager: u,
  styleMedia: P,
  StyleSheet: u,
  StyleSheetList: u,
  SubtleCrypto: u,
  SVGAElement: u,
  SVGAngle: u,
  SVGAnimatedAngle: u,
  SVGAnimatedBoolean: u,
  SVGAnimatedEnumeration: u,
  SVGAnimatedInteger: u,
  SVGAnimatedLength: u,
  SVGAnimatedLengthList: u,
  SVGAnimatedNumber: u,
  SVGAnimatedNumberList: u,
  SVGAnimatedPreserveAspectRatio: u,
  SVGAnimatedRect: u,
  SVGAnimatedString: u,
  SVGAnimatedTransformList: u,
  SVGAnimateElement: u,
  SVGAnimateMotionElement: u,
  SVGAnimateTransformElement: u,
  SVGAnimationElement: u,
  SVGCircleElement: u,
  SVGClipPathElement: u,
  SVGComponentTransferFunctionElement: u,
  SVGDefsElement: u,
  SVGDescElement: u,
  SVGDiscardElement: u,
  SVGElement: u,
  SVGEllipseElement: u,
  SVGFEBlendElement: u,
  SVGFEColorMatrixElement: u,
  SVGFEComponentTransferElement: u,
  SVGFECompositeElement: u,
  SVGFEConvolveMatrixElement: u,
  SVGFEDiffuseLightingElement: u,
  SVGFEDisplacementMapElement: u,
  SVGFEDistantLightElement: u,
  SVGFEDropShadowElement: u,
  SVGFEFloodElement: u,
  SVGFEFuncAElement: u,
  SVGFEFuncBElement: u,
  SVGFEFuncGElement: u,
  SVGFEFuncRElement: u,
  SVGFEGaussianBlurElement: u,
  SVGFEImageElement: u,
  SVGFEMergeElement: u,
  SVGFEMergeNodeElement: u,
  SVGFEMorphologyElement: u,
  SVGFEOffsetElement: u,
  SVGFEPointLightElement: u,
  SVGFESpecularLightingElement: u,
  SVGFESpotLightElement: u,
  SVGFETileElement: u,
  SVGFETurbulenceElement: u,
  SVGFilterElement: u,
  SVGForeignObjectElement: u,
  SVGGElement: u,
  SVGGeometryElement: u,
  SVGGradientElement: u,
  SVGGraphicsElement: u,
  SVGImageElement: u,
  SVGLength: u,
  SVGLengthList: u,
  SVGLinearGradientElement: u,
  SVGLineElement: u,
  SVGMarkerElement: u,
  SVGMaskElement: u,
  SVGMatrix: u,
  SVGMetadataElement: u,
  SVGMPathElement: u,
  SVGNumber: u,
  SVGNumberList: u,
  SVGPathElement: u,
  SVGPatternElement: u,
  SVGPoint: u,
  SVGPointList: u,
  SVGPolygonElement: u,
  SVGPolylineElement: u,
  SVGPreserveAspectRatio: u,
  SVGRadialGradientElement: u,
  SVGRect: u,
  SVGRectElement: u,
  SVGScriptElement: u,
  SVGSetElement: u,
  SVGStopElement: u,
  SVGStringList: u,
  SVGStyleElement: u,
  SVGSVGElement: u,
  SVGSwitchElement: u,
  SVGSymbolElement: u,
  SVGTextContentElement: u,
  SVGTextElement: u,
  SVGTextPathElement: u,
  SVGTextPositioningElement: u,
  SVGTitleElement: u,
  SVGTransform: u,
  SVGTransformList: u,
  SVGTSpanElement: u,
  SVGUnitTypes: u,
  SVGUseElement: u,
  SVGViewElement: u,
  TaskAttributionTiming: u,
  Text: u,
  TextEvent: u,
  TextMetrics: u,
  TextTrack: u,
  TextTrackCue: u,
  TextTrackCueList: u,
  TextTrackList: u,
  TimeRanges: u,
  toolbar: P,
  top: P,
  Touch: u,
  TouchEvent: u,
  TouchList: u,
  TrackEvent: u,
  TransitionEvent: u,
  TreeWalker: u,
  UIEvent: u,
  ValidityState: u,
  visualViewport: P,
  VisualViewport: u,
  VTTCue: u,
  WaveShaperNode: u,
  WebAssembly: P,
  WebGL2RenderingContext: u,
  WebGLActiveInfo: u,
  WebGLBuffer: u,
  WebGLContextEvent: u,
  WebGLFramebuffer: u,
  WebGLProgram: u,
  WebGLQuery: u,
  WebGLRenderbuffer: u,
  WebGLRenderingContext: u,
  WebGLSampler: u,
  WebGLShader: u,
  WebGLShaderPrecisionFormat: u,
  WebGLSync: u,
  WebGLTexture: u,
  WebGLTransformFeedback: u,
  WebGLUniformLocation: u,
  WebGLVertexArrayObject: u,
  WebSocket: u,
  WheelEvent: u,
  Window: u,
  Worker: u,
  WritableStream: u,
  XMLDocument: u,
  XMLHttpRequest: u,
  XMLHttpRequestEventTarget: u,
  XMLHttpRequestUpload: u,
  XMLSerializer: u,
  XPathEvaluator: u,
  XPathExpression: u,
  XPathResult: u,
  XSLTProcessor: u
};
for (const i of ["window", "global", "self", "globalThis"])
  Nr[i] = Nr;
function Yt(i) {
  let e = Nr;
  for (const t of i) {
    if (typeof t != "string")
      return null;
    if (e = e[t], !e)
      return i[0] === "Symbol" && i.length === 2 ? np : null;
  }
  return e[me];
}
class na extends Gt {
  constructor(e) {
    super(e), this.markReassigned();
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    switch (e.type) {
      // While there is no point in testing these cases as at the moment, they
      // are also covered via other means, we keep them for completeness
      case ge:
      case Ue: {
        Yt([this.name, ...t].slice(0, -1)) || super.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
        return;
      }
      case X: {
        const n = Yt([this.name, ...t]);
        n ? n.deoptimizeArgumentsOnCall(e) : super.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
        return;
      }
    }
  }
  getLiteralValueAtPath(e, t, s) {
    const n = Yt([this.name, ...e]);
    return n ? n.getLiteralValue() : K;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    switch (t.type) {
      case ge:
        return e.length === 0 ? this.name !== "undefined" && !Yt([this.name]) : !Yt([this.name, ...e].slice(0, -1));
      case Ue:
        return !0;
      case X: {
        const n = Yt([this.name, ...e]);
        return !n || n.hasEffectsWhenCalled(t, s);
      }
    }
  }
}
const Te = 6, yo = (i, e) => {
  const { length: t } = i, { length: s } = e;
  return t === 0 ? e : s === 0 ? i : t + s > Te ? [...i, ...e.slice(0, Te - 1 - i.length), "UnknownKey"] : [...i, ...e];
};
class et extends Gt {
  constructor(e, t, s, n, r, a) {
    super(e), this.init = s, this.initPath = n, this.kind = a, this.calledFromTryStatement = !1, this.additionalInitializers = null, this.includedPathTracker = new Bd(), this.expressionsToBeDeoptimized = [], this.declarations = t ? [t] : [], this.deoptimizationTracker = r.deoptimizationTracker, this.module = r.module;
  }
  addDeclaration(e, t) {
    this.declarations.push(e), this.markInitializersForDeoptimization().push(t);
  }
  consolidateInitializers() {
    if (this.additionalInitializers)
      for (const e of this.additionalInitializers)
        e.deoptimizePath(O);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    if (this.isReassigned || t.length + this.initPath.length > Te) {
      ot(e);
      return;
    }
    s.withTrackedEntityAtPath(t, this.init, () => {
      this.init.deoptimizeArgumentsOnInteractionAtPath(e, [...this.initPath, ...t], s);
    }, void 0);
  }
  deoptimizePath(e) {
    if (!(this.isReassigned || this.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(e, this)))
      if (e.length === 0) {
        this.markReassigned();
        const t = this.expressionsToBeDeoptimized;
        this.expressionsToBeDeoptimized = De;
        for (const s of t)
          s.deoptimizeCache();
        this.init.deoptimizePath([...this.initPath, W]);
      } else
        this.init.deoptimizePath(yo(this.initPath, e));
  }
  getLiteralValueAtPath(e, t, s) {
    return this.isReassigned || e.length + this.initPath.length > Te ? K : t.withTrackedEntityAtPath(e, this.init, () => (this.expressionsToBeDeoptimized.push(s), this.init.getLiteralValueAtPath([...this.initPath, ...e], t, s)), K);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.isReassigned || e.length + this.initPath.length > Te ? Se : s.withTrackedEntityAtPath(e, this.init, () => (this.expressionsToBeDeoptimized.push(n), this.init.getReturnExpressionWhenCalledAtPath([...this.initPath, ...e], t, s, n)), Se);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    if (e.length + this.initPath.length > Te)
      return !0;
    switch (t.type) {
      case ge:
        return this.isReassigned ? !0 : !s.accessed.trackEntityAtPathAndGetIfTracked(e, this) && this.init.hasEffectsOnInteractionAtPath([...this.initPath, ...e], t, s);
      case Ue:
        return this.included ? !0 : e.length === 0 ? !1 : this.isReassigned ? !0 : !s.assigned.trackEntityAtPathAndGetIfTracked(e, this) && this.init.hasEffectsOnInteractionAtPath([...this.initPath, ...e], t, s);
      case X:
        return this.isReassigned ? !0 : !(t.withNew ? s.instantiated : s.called).trackEntityAtPathAndGetIfTracked(e, t.args, this) && this.init.hasEffectsOnInteractionAtPath([...this.initPath, ...e], t, s);
    }
  }
  includePath(e, t) {
    if (!this.includedPathTracker.includePathAndGetIfIncluded(e)) {
      this.module.scope.context.requestTreeshakingPass(), this.included || this.module.scope.context.newlyIncludedVariableInits.add(this.init), super.includePath(e, t);
      for (const s of this.declarations) {
        s.included || s.include(t, !1);
        let n = s.parent;
        for (; !n.included && (n.includeNode(t), n.type !== On); )
          n = n.parent;
      }
      e.length > 0 && (this.init.includePath(yo(this.initPath, e), t), this.additionalInitializers?.forEach((s) => s.includePath(O, t)));
    }
  }
  includeCallArguments(e, t) {
    this.isReassigned || t.includedCallArguments.has(this.init) || // This can be removed again once we can include arguments when called at
    // a specific path
    this.initPath.length > 0 ? Xr(e, t) : (t.includedCallArguments.add(this.init), this.init.includeCallArguments(e, t), t.includedCallArguments.delete(this.init));
  }
  markCalledFromTryStatement() {
    this.calledFromTryStatement = !0;
  }
  markInitializersForDeoptimization() {
    return this.additionalInitializers === null && (this.additionalInitializers = [this.init], this.init = G, this.markReassigned()), this.additionalInitializers;
  }
}
const ip = /* @__PURE__ */ new Set(["class", "const", "let", "var", "using", "await using"]);
class ec extends v {
  constructor() {
    super(...arguments), this.variable = null, this.isVariableReference = !1;
  }
  get isTDZAccess() {
    return Z(
      this.flags,
      4
      /* Flag.tdzAccessDefined */
    ) ? Z(
      this.flags,
      8
      /* Flag.tdzAccess */
    ) : null;
  }
  set isTDZAccess(e) {
    this.flags = ee(this.flags, 4, !0), this.flags = ee(this.flags, 8, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    e.length === 0 && !this.scope.contains(this.name) && this.disallowImportReassignment(), this.variable?.deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getVariableRespectingTDZ().getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    const [r, a] = this.getVariableRespectingTDZ().getReturnExpressionWhenCalledAtPath(e, t, s, n);
    return [r, a || this.isPureFunction(e)];
  }
  hasEffects(e) {
    return this.deoptimized || this.applyDeoptimizations(), this.isPossibleTDZ() && this.variable.kind !== "var" ? !0 : this.scope.context.options.treeshake.unknownGlobalSideEffects && this.variable instanceof na && !this.isPureFunction(D) && this.variable.hasEffectsOnInteractionAtPath(D, zt, e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    switch (t.type) {
      case ge:
        return this.variable !== null && !this.isPureFunction(e) && this.getVariableRespectingTDZ().hasEffectsOnInteractionAtPath(e, t, s);
      case Ue:
        return (e.length > 0 ? this.getVariableRespectingTDZ() : this.variable).hasEffectsOnInteractionAtPath(e, t, s);
      case X:
        return !this.isPureFunction(e) && this.getVariableRespectingTDZ().hasEffectsOnInteractionAtPath(e, t, s);
    }
  }
  include(e, t) {
    this.included || this.includeNode(e), t && this.variable?.includePath(O, e);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.variable !== null && this.scope.context.includeVariableInModule(this.variable, D, e);
  }
  includePath(e, t) {
    this.included ? e.length > 0 && this.variable?.includePath(e, t) : (this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.variable !== null && this.scope.context.includeVariableInModule(this.variable, e, t));
  }
  includeCallArguments(e, t) {
    this.variable.includeCallArguments(e, t);
  }
  isPossibleTDZ() {
    const e = this.isTDZAccess;
    if (e !== null)
      return e;
    if (!(this.variable instanceof et && this.variable.kind && ip.has(this.variable.kind) && // We ignore modules that did not receive a treeshaking pass yet as that
    // causes many false positives due to circular dependencies or disabled
    // moduleSideEffects.
    this.variable.module.hasTreeShakingPassStarted))
      return this.isTDZAccess = !1;
    let t;
    return this.variable.declarations && this.variable.declarations.length === 1 && (t = this.variable.declarations[0]) && this.start < t.start && Eo(this) === Eo(t) ? this.isTDZAccess = !0 : this.variable.initReached ? this.isTDZAccess = !1 : this.isTDZAccess = !0;
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.variable instanceof et && (this.variable.module.isExecuted || Qr(this.variable.module), this.variable.consolidateInitializers(), this.scope.context.requestTreeshakingPass()), this.isVariableReference && (this.variable.addUsedPlace(this), this.scope.context.requestTreeshakingPass());
  }
  disallowImportReassignment() {
    return this.scope.context.error($l(this.name, this.scope.context.module.id), this.start);
  }
  getVariableRespectingTDZ() {
    return this.isPossibleTDZ() ? G : this.variable;
  }
  isPureFunction(e) {
    let t = this.scope.context.manualPureFunctions[this.name];
    for (const s of e)
      if (t) {
        if (t[Ar])
          return !0;
        t = t[s];
      } else
        return !1;
    return t?.[Ar];
  }
}
function Eo(i) {
  for (; i && !/^Program|Function/.test(i.type); )
    i = i.parent;
  return i;
}
class tc extends qe {
  constructor(e, t) {
    super(), this.object = e, this.path = t;
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.object.deoptimizeArgumentsOnInteractionAtPath(e, [...this.path, ...t], s);
  }
  deoptimizePath(e) {
    this.object.deoptimizePath([...this.path, ...e]);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.object.getLiteralValueAtPath([...this.path, ...e], t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.object.getReturnExpressionWhenCalledAtPath([...this.path, ...e], t, s, n);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.object.hasEffectsOnInteractionAtPath([...this.path, ...e], t, s);
  }
}
class ae extends ec {
  constructor() {
    super(...arguments), this.variable = null;
  }
  get isDestructuringDeoptimized() {
    return Z(
      this.flags,
      16777216
      /* Flag.destructuringDeoptimized */
    );
  }
  set isDestructuringDeoptimized(e) {
    this.flags = ee(this.flags, 16777216, e);
  }
  addExportedVariables(e, t) {
    t.has(this.variable) && e.push(this.variable);
  }
  bind() {
    !this.variable && Kl(this, this.parent) && (this.variable = this.scope.findVariable(this.name), this.variable.addReference(this), this.isVariableReference = !0);
  }
  declare(e, t, s) {
    let n;
    const { treeshake: r } = this.scope.context.options;
    return e === "parameter" ? n = this.scope.addParameterDeclaration(this, t) : (n = this.scope.addDeclaration(this, this.scope.context, s, t, e), e === "var" && r && r.correctVarValueBeforeDeclaration && n.markInitializersForDeoptimization()), [this.variable = n];
  }
  deoptimizeAssignment(e, t) {
    this.deoptimizePath(D), t.deoptimizePath([...e, W]);
  }
  hasEffectsWhenDestructuring(e, t, s) {
    return t.length > 0 && s.hasEffectsOnInteractionAtPath(t, zt, e);
  }
  includeDestructuredIfNecessary(e, t, s) {
    t.length > 0 && !this.isDestructuringDeoptimized && (this.isDestructuringDeoptimized = !0, s.deoptimizeArgumentsOnInteractionAtPath({
      args: [new tc(s, t.slice(0, -1))],
      type: ge
    }, t, de));
    const { propertyReadSideEffects: n } = this.scope.context.options.treeshake;
    let r = this.included;
    return (r ||= t.length > 0 && !e.brokenFlow && n && (n === "always" || s.hasEffectsOnInteractionAtPath(t, zt, Es()))) && (this.variable && !this.variable.included && this.scope.context.includeVariableInModule(this.variable, D, e), s.includePath(t, e)), !this.included && r && this.includeNode(e), this.included;
  }
  markDeclarationReached() {
    this.variable.initReached = !0;
  }
  render(e, { snippets: { getPropertyAccess: t }, useOriginalName: s }, { renderedParentType: n, isCalleeOfRenderedParent: r, isShorthandProperty: a } = Oe) {
    if (this.variable) {
      const o = this.variable.getName(t, s);
      o !== this.name && (e.overwrite(this.start, this.end, o, {
        contentOnly: !0,
        storeName: !0
      }), a && e.prependRight(this.start, `${this.name}: `)), o === "eval" && n === js && r && e.appendRight(this.start, "0, ");
    }
  }
}
const rp = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$", bo = 64;
function _n(i) {
  let e = "";
  do {
    const t = i % bo;
    i = i / bo | 0, e = rp[t] + e;
  } while (i !== 0);
  return e;
}
function rt(i, e, t) {
  let s = i, n = 1;
  for (; e.has(s) || ii.has(s) || t?.has(s); )
    s = `${i}$${_n(n++)}`;
  return e.add(s), s;
}
class sc {
  constructor() {
    this.children = [], this.variables = /* @__PURE__ */ new Map();
  }
  /*
  Redeclaration rules:
  - var can redeclare var
  - in function scopes, function and var can redeclare function and var
  - var is hoisted across scopes, function remains in the scope it is declared
  - var and function can redeclare function parameters, but parameters cannot redeclare parameters
  - function cannot redeclare catch scope parameters
  - var can redeclare catch scope parameters in a way
      - if the parameter is an identifier and not a pattern
      - then the variable is still declared in the hoisted outer scope, but the initializer is assigned to the parameter
  - const, let, class, and function except in the cases above cannot redeclare anything
   */
  addDeclaration(e, t, s, n, r) {
    const a = e.name, o = this.hoistedVariables?.get(a) || this.variables.get(a);
    if (o) {
      if (r === "var" && o.kind === "var")
        return o.addDeclaration(e, s), o;
      t.error(gs(a), e.start);
    }
    const l = new et(e.name, e, s, n, t, r);
    return this.variables.set(a, l), l;
  }
  addHoistedVariable(e, t) {
    (this.hoistedVariables ||= /* @__PURE__ */ new Map()).set(e, t);
  }
  contains(e) {
    return this.variables.has(e);
  }
  findVariable(e) {
    throw new Error("Internal Error: findVariable needs to be implemented by a subclass");
  }
}
class Ge extends sc {
  constructor(e, t) {
    super(), this.parent = e, this.context = t, this.accessedOutsideVariables = /* @__PURE__ */ new Map(), e.children.push(this);
  }
  addAccessedDynamicImport(e) {
    (this.accessedDynamicImports || (this.accessedDynamicImports = /* @__PURE__ */ new Set())).add(e), this.parent instanceof Ge && this.parent.addAccessedDynamicImport(e);
  }
  addAccessedGlobals(e, t) {
    const s = t.get(this) || /* @__PURE__ */ new Set();
    for (const n of e)
      s.add(n);
    t.set(this, s), this.parent instanceof Ge && this.parent.addAccessedGlobals(e, t);
  }
  addNamespaceMemberAccess(e, t) {
    this.accessedOutsideVariables.set(e, t), this.parent.addNamespaceMemberAccess(e, t);
  }
  addReturnExpression(e) {
    this.parent instanceof Ge && this.parent.addReturnExpression(e);
  }
  addUsedOutsideNames(e, t) {
    for (const n of this.accessedOutsideVariables.values())
      n.included && e.add(n.getBaseVariableName());
    const s = t.get(this);
    if (s)
      for (const n of s)
        e.add(n);
  }
  contains(e) {
    return this.variables.has(e) || this.parent.contains(e);
  }
  deconflict(e, t, s) {
    const n = /* @__PURE__ */ new Set();
    if (this.addUsedOutsideNames(n, s), this.accessedDynamicImports)
      for (const r of this.accessedDynamicImports)
        r.inlineNamespace && n.add(r.inlineNamespace.getBaseVariableName());
    for (const [r, a] of this.variables)
      (a.included || a.alwaysRendered) && a.setRenderNames(null, rt(r, n, a.forbiddenNames));
    for (const r of this.children)
      r.deconflict(e, t, s);
  }
  findLexicalBoundary() {
    return this.parent.findLexicalBoundary();
  }
  findGlobal(e) {
    const t = this.parent.findVariable(e);
    return this.accessedOutsideVariables.set(e, t), t;
  }
  findVariable(e) {
    const t = this.variables.get(e) || this.accessedOutsideVariables.get(e);
    if (t)
      return t;
    const s = this.parent.findVariable(e);
    return this.accessedOutsideVariables.set(e, s), s;
  }
}
function ia(i, e) {
  for (const t of i)
    if (t.hasEffects(e))
      return !0;
  return !1;
}
class ui extends v {
  constructor() {
    super(...arguments), this.accessedValue = null;
  }
  get computed() {
    return Z(
      this.flags,
      1024
      /* Flag.computed */
    );
  }
  set computed(e) {
    this.flags = ee(this.flags, 1024, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    if (e.type === ge && this.kind === "get" && t.length === 0)
      return this.value.deoptimizeArgumentsOnInteractionAtPath({
        args: e.args,
        type: X,
        withNew: !1
      }, D, s);
    if (e.type === Ue && this.kind === "set" && t.length === 0)
      return this.value.deoptimizeArgumentsOnInteractionAtPath({
        args: e.args,
        type: X,
        withNew: !1
      }, D, s);
    this.getAccessedValue()[0].deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  // As getter properties directly receive their values from fixed function
  // expressions, there is no known situation where a getter is deoptimized.
  deoptimizeCache() {
  }
  deoptimizePath(e) {
    this.getAccessedValue()[0].deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getAccessedValue()[0].getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.getAccessedValue()[0].getReturnExpressionWhenCalledAtPath(e, t, s, n);
  }
  hasEffects(e) {
    return this.key.hasEffects(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.kind === "get" && t.type === ge && e.length === 0 ? this.value.hasEffectsOnInteractionAtPath(D, {
      args: t.args,
      type: X,
      withNew: !1
    }, s) : this.kind === "set" && t.type === Ue ? this.value.hasEffectsOnInteractionAtPath(D, {
      args: t.args,
      type: X,
      withNew: !1
    }, s) : this.getAccessedValue()[0].hasEffectsOnInteractionAtPath(e, t, s);
  }
  getAccessedValue() {
    return this.accessedValue === null ? this.kind === "get" ? (this.accessedValue = Se, this.accessedValue = this.value.getReturnExpressionWhenCalledAtPath(D, Gs, de, this)) : this.accessedValue = [this.value, !1] : this.accessedValue;
  }
}
ui.prototype.includeNode = oe;
ui.prototype.applyDeoptimizations = Y;
class Fn extends ui {
  hasEffects(e) {
    return super.hasEffects(e) || ia(this.decorators, e);
  }
}
class Wt extends Ge {
  constructor(e) {
    super(e, e.context);
  }
  addDeclaration(e, t, s, n, r) {
    if (r === "var") {
      const a = e.name, o = this.hoistedVariables?.get(a) || this.variables.get(a);
      if (o)
        return o.kind === "var" || r === "var" && o.kind === "parameter" ? (o.addDeclaration(e, s), o) : t.error(gs(a), e.start);
      const l = this.parent.addDeclaration(e, t, s, n, r);
      return l.markInitializersForDeoptimization(), this.addHoistedVariable(a, l), l;
    }
    return super.addDeclaration(e, t, s, n, r);
  }
}
class hi extends v {
  createScope(e) {
    this.scope = new Wt(e);
  }
  hasEffects(e) {
    for (const t of this.body)
      if (t.hasEffects(e))
        return !0;
    return !1;
  }
  include(e, t) {
    this.included = !0;
    for (const s of this.body)
      (t || s.shouldBeIncluded(e)) && s.include(e, t);
  }
  render(e, t) {
    if (this.body.length > 0) {
      const s = we(e.original.slice(this.start, this.end), "{") + 1;
      Hs(this.body, e, this.start + s, this.end - 1, t);
    } else
      super.render(e, t);
  }
}
hi.prototype.includeNode = oe;
hi.prototype.applyDeoptimizations = Y;
function Ao(i) {
  return i.type === Vh;
}
class ra extends v {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  createScope(e) {
    this.scope = new Ge(e, e.context);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizeCache() {
    this.getObjectEntity().deoptimizeAllProperties();
  }
  deoptimizePath(e) {
    this.getObjectEntity().deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getObjectEntity().getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e, t, s, n);
  }
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    const t = this.superClass?.hasEffects(e) || this.body.hasEffects(e);
    return this.id?.markDeclarationReached(), t || super.hasEffects(e) || ia(this.decorators, e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === X && e.length === 0 ? !t.withNew || (this.classConstructor === null ? this.superClass?.hasEffectsOnInteractionAtPath(e, t, s) : this.classConstructor.hasEffectsOnInteractionAtPath(e, t, s)) || !1 : this.getObjectEntity().hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    this.included || this.includeNode(e), this.superClass?.include(e, t), this.body.include(e, t);
    for (const s of this.decorators)
      s.include(e, t);
    this.id && (this.id.markDeclarationReached(), this.id.include(e, t));
  }
  initialise() {
    super.initialise(), this.id?.declare("class", D, this);
    for (const e of this.body.body)
      if (e instanceof Fn && e.kind === "constructor") {
        this.classConstructor = e;
        return;
      }
    this.classConstructor = null;
  }
  applyDeoptimizations() {
    this.deoptimized = !0;
    for (const e of this.body.body)
      !Ao(e) && !(e.static || e instanceof Fn && e.kind === "constructor") && e.deoptimizePath(O);
    this.scope.context.requestTreeshakingPass();
  }
  getObjectEntity() {
    if (this.objectEntity !== null)
      return this.objectEntity;
    const e = [], t = [];
    for (const s of this.body.body) {
      if (Ao(s))
        continue;
      const n = s.static ? e : t, r = s.kind;
      if (n === t && !r)
        continue;
      const a = r === "set" || r === "get" ? r : "init";
      let o;
      if (s.computed) {
        const l = s.key.getLiteralValueAtPath(D, de, this);
        if (typeof l == "symbol") {
          n.push({
            key: qr(l) ? l : W,
            kind: a,
            property: s
          });
          continue;
        } else
          o = String(l);
      } else
        o = s.key instanceof ae ? s.key.name : String(s.key.value);
      n.push({ key: o, kind: a, property: s });
    }
    return e.unshift({
      key: "prototype",
      kind: "init",
      property: new Ke(t, this.superClass ? new tc(this.superClass, ["prototype"]) : bt)
    }), this.objectEntity = new Ke(e, this.superClass || bt);
  }
}
ra.prototype.includeNode = Ce;
class hs extends ra {
  initialise() {
    super.initialise(), this.id !== null && (this.id.variable.isId = !0);
  }
  parseNode(e) {
    return e.id !== null && (this.id = new ae(this, this.scope.parent).parseNode(e.id)), super.parseNode(e);
  }
  render(e, t) {
    const { exportNamesByVariable: s, format: n, snippets: { _: r, getPropertyAccess: a } } = t;
    if (this.id) {
      const { variable: o, name: l } = this.id;
      n === "system" && s.has(o) && e.appendLeft(this.end, `${r}${Ht([o], t)};`);
      const c = o.getName(a);
      if (c !== l) {
        this.decorators.map((h) => h.render(e, t)), this.superClass?.render(e, t), this.body.render(e, {
          ...t,
          useOriginalName: (h) => h === o
        }), e.prependRight(this.start, `let ${c}${r}=${r}`), e.prependLeft(this.end, ";");
        return;
      }
    }
    super.render(e, t);
  }
  applyDeoptimizations() {
    super.applyDeoptimizations();
    const { id: e, scope: t } = this;
    if (e) {
      const { name: s, variable: n } = e;
      for (const r of t.accessedOutsideVariables.values())
        r !== n && r.forbidName(s);
    }
  }
}
class ap extends et {
  constructor(e) {
    super("arguments", null, G, D, e, "other");
  }
  addArgumentToBeDeoptimized(e) {
  }
  // Only If there is at least one reference, then we need to track all
  // arguments in order to be able to deoptimize them.
  addReference() {
    this.deoptimizedArguments = [], this.addArgumentToBeDeoptimized = op;
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return t !== ge || e.length > 1;
  }
  includePath(e, t) {
    super.includePath(e, t);
    for (const s of this.deoptimizedArguments)
      s.deoptimizePath(O);
    this.deoptimizedArguments.length = 0;
  }
}
function op(i) {
  this.included ? i.deoptimizePath(O) : this.deoptimizedArguments?.push(i);
}
const lp = 20, xo = De, cp = /* @__PURE__ */ new Set([W]), up = new us(), hp = /* @__PURE__ */ new Set([G]);
class nc extends et {
  constructor(e, t, s, n) {
    super(e, t, G, s, n, "parameter"), this.includedPathTracker = new Fd(), this.argumentsToBeDeoptimized = /* @__PURE__ */ new Set(), this.deoptimizationInteractions = [], this.deoptimizations = new us(), this.deoptimizedFields = /* @__PURE__ */ new Set(), this.expressionsDependingOnKnownValue = [], this.knownValue = null, this.knownValueLiteral = K;
  }
  addArgumentForDeoptimization(e) {
    if (this.updateKnownValue(e), e === G) {
      if (!this.argumentsToBeDeoptimized.has(G)) {
        this.argumentsToBeDeoptimized.add(G);
        for (const { interaction: t } of this.deoptimizationInteractions)
          ot(t);
        this.deoptimizationInteractions = xo;
      }
    } else if (this.deoptimizedFields.has(W))
      e.deoptimizePath([...this.initPath, W]);
    else if (!this.argumentsToBeDeoptimized.has(e)) {
      this.argumentsToBeDeoptimized.add(e);
      for (const t of this.deoptimizedFields)
        e.deoptimizePath([...this.initPath, t]);
      for (const { interaction: t, path: s } of this.deoptimizationInteractions)
        e.deoptimizeArgumentsOnInteractionAtPath(t, [...this.initPath, ...s], de);
    }
  }
  /** This says we should not make assumptions about the value of the parameter.
   *  This is different from deoptimization that will also cause argument values
   *  to be deoptimized. */
  markReassigned() {
    if (!this.isReassigned) {
      super.markReassigned();
      for (const e of this.expressionsDependingOnKnownValue)
        e.deoptimizeCache();
      this.expressionsDependingOnKnownValue = De;
    }
  }
  deoptimizeCache() {
    this.markReassigned();
  }
  /**
   * Update the known value of the parameter variable.
   * Must be called for every function call, so it can track all the arguments,
   * and deoptimizeCache itself to mark reassigned if the argument is changed.
   * @param argument The argument of the function call
   */
  updateKnownValue(e) {
    if (this.isReassigned)
      return;
    if (this.knownValue === null) {
      this.knownValue = e, this.knownValueLiteral = e.getLiteralValueAtPath(this.initPath, de, this);
      return;
    }
    if (this.knownValue === e || this.knownValue instanceof ae && e instanceof ae && this.knownValue.variable === e.variable)
      return;
    const { knownValueLiteral: t } = this;
    (typeof t == "symbol" || e.getLiteralValueAtPath(this.initPath, de, this) !== t) && this.markReassigned();
  }
  /**
   * This function freezes the known value of the parameter variable,
   * so the optimization starts with a certain ExpressionEntity.
   * The optimization can be undone by calling `markReassigned`.
   * @returns the frozen value
   */
  getKnownValue() {
    return this.knownValue || G;
  }
  getLiteralValueAtPath(e, t, s) {
    if (this.isReassigned || e.length + this.initPath.length > Te)
      return K;
    const n = this.getKnownValue();
    return this.expressionsDependingOnKnownValue.push(s), t.withTrackedEntityAtPath(e, n, () => n.getLiteralValueAtPath([...this.initPath, ...e], t, s), K);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const { type: n } = t;
    return this.isReassigned || n === Ue || e.length + this.initPath.length > Te ? super.hasEffectsOnInteractionAtPath(e, t, s) : !(n === X ? (t.withNew ? s.instantiated : s.called).trackEntityAtPathAndGetIfTracked(e, t.args, this) : s.accessed.trackEntityAtPathAndGetIfTracked(e, this)) && this.getKnownValue().hasEffectsOnInteractionAtPath([...this.initPath, ...e], t, s);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t) {
    if (t.length >= 2 || this.argumentsToBeDeoptimized.has(G) || this.deoptimizationInteractions.length >= lp || t.length === 1 && (this.deoptimizedFields.has(W) || e.type === X && this.deoptimizedFields.has(t[0])) || this.initPath.length + t.length > Te) {
      ot(e);
      return;
    }
    if (!this.deoptimizations.trackEntityAtPathAndGetIfTracked(t, e.args)) {
      for (const s of this.argumentsToBeDeoptimized)
        s.deoptimizeArgumentsOnInteractionAtPath(e, [...this.initPath, ...t], de);
      this.argumentsToBeDeoptimized.has(G) || this.deoptimizationInteractions.push({
        interaction: e,
        path: t
      });
    }
  }
  deoptimizePath(e) {
    if (e.length === 0) {
      this.markReassigned();
      return;
    }
    if (this.deoptimizedFields.has(W))
      return;
    const t = e[0];
    if (!this.deoptimizedFields.has(t)) {
      this.deoptimizedFields.add(t);
      for (const s of this.argumentsToBeDeoptimized)
        s.deoptimizePath([...this.initPath, t]);
      t === W && (this.deoptimizationInteractions = xo, this.deoptimizations = up, this.deoptimizedFields = cp, this.argumentsToBeDeoptimized = hp);
    }
  }
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length === 0 ? this.deoptimizePath(O) : this.deoptimizedFields.has(e[0]) || this.deoptimizePath([e[0]]), Se;
  }
  includeArgumentPaths(e, t) {
    this.includedPathTracker.includeAllPaths(e, t, this.initPath);
  }
}
class ic extends nc {
  constructor(e) {
    super("this", null, D, e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return (s.replacedVariableInits.get(this) || G).hasEffectsOnInteractionAtPath(e, t, s);
  }
}
class dp extends Ge {
  constructor(e) {
    super(e, e.context), this.parent = e;
  }
  addDeclaration(e, t, s, n, r) {
    if (r === "var") {
      const a = e.name, o = this.hoistedVariables?.get(a) || this.variables.get(a);
      if (o) {
        const c = o.kind;
        if (c === "parameter" && // If this is a destructured parameter, it is forbidden to redeclare
        o.declarations[0].parent.type === Uh) {
          const h = this.parent.parent.addDeclaration(e, t, mt, n, r);
          return o.renderLikeHoisted(h), this.addHoistedVariable(a, h), h;
        }
        return c === "var" ? (o.addDeclaration(e, s), o) : t.error(gs(a), e.start);
      }
      const l = this.parent.parent.addDeclaration(e, t, s, n, r);
      return l.markInitializersForDeoptimization(), this.addHoistedVariable(a, l), l;
    }
    return super.addDeclaration(e, t, s, n, r);
  }
}
class pp extends Ge {
  constructor(e) {
    super(e, e.context);
  }
  // There is stuff that is only allowed in function scopes, i.e. functions can
  // be redeclared, functions and var can redeclare each other
  addDeclaration(e, t, s, n, r) {
    const a = e.name, o = this.hoistedVariables?.get(a) || this.variables.get(a);
    if (o) {
      const c = o.kind;
      if ((r === "var" || r === "function") && (c === "var" || c === "function" || c === "parameter"))
        return o.addDeclaration(e, s), o;
      t.error(gs(a), e.start);
    }
    const l = new et(e.name, e, s, n, t, r);
    return this.variables.set(a, l), l;
  }
}
class rc extends Ge {
  constructor(e, t) {
    super(e, e.context), this.hasRest = !1, this.parameters = [], this.bodyScope = t ? new dp(this) : new pp(this);
  }
  /**
   * Adds a parameter to this scope. Parameters must be added in the correct
   * order, i.e. from left to right.
   */
  addParameterDeclaration(e, t) {
    const { name: s, start: n } = e;
    if (this.variables.get(s))
      return this.context.error(Dh(s), n);
    const a = new nc(s, e, t, this.context);
    return this.variables.set(s, a), this.bodyScope.addHoistedVariable(s, a), a;
  }
  addParameterVariables(e, t) {
    this.parameters = e;
    for (const s of e)
      for (const n of s)
        n.alwaysRendered = !0;
    this.hasRest = t;
  }
  includeCallArguments({ args: e }, t) {
    let s = !1, n = !1;
    const r = this.hasRest && this.parameters[this.parameters.length - 1];
    let a = e.length - 1;
    for (let o = 1; o < e.length; o++) {
      const l = e[o];
      l instanceof Vt && !n && (n = !0, a = o - 1), n && (l.includePath(O, t), l.include(t, !1));
    }
    for (let o = a; o >= 1; o--) {
      const l = this.parameters[o - 1] || r, c = e[o];
      if (l)
        if (s = !1, l.length === 0)
          n = !0;
        else
          for (const h of l)
            h.calledFromTryStatement && (s = !0), h.included && (n = !0, s ? c.include(t, !0) : (h.includeArgumentPaths(c, t), c.include(t, !1)));
      (n || c.shouldBeIncluded(t)) && (n = !0, c.include(t, s));
    }
  }
}
class ac extends rc {
  constructor() {
    super(...arguments), this.returnExpression = null, this.returnExpressions = [];
  }
  addReturnExpression(e) {
    this.returnExpressions.push(e);
  }
  deoptimizeArgumentsOnCall({ args: e }) {
    const { parameters: t } = this;
    let s = 0;
    for (; s < e.length - 1; s++) {
      const r = e[s + 1];
      if (r instanceof Vt) {
        for (; s < t.length; s++) {
          e[s + 1]?.deoptimizePath(O);
          for (const a of t[s])
            a.markReassigned();
        }
        break;
      }
      if (this.hasRest && s >= t.length - 1)
        r.deoptimizePath(O);
      else {
        const a = t[s];
        if (a)
          for (const o of a)
            o.addArgumentForDeoptimization(r);
        this.addArgumentToBeDeoptimized(r);
      }
    }
    const n = this.hasRest ? t.length - 1 : t.length;
    for (; s < n; s++)
      for (const r of t[s])
        r.addArgumentForDeoptimization(mt);
  }
  getReturnExpression() {
    return this.returnExpression === null && this.updateReturnExpression(), this.returnExpression;
  }
  deoptimizeAllParameters() {
    for (const e of this.parameters)
      for (const t of e)
        t.deoptimizePath(O), t.markReassigned();
  }
  reassignAllParameters() {
    for (const e of this.parameters)
      for (const t of e)
        t.markReassigned();
  }
  addArgumentToBeDeoptimized(e) {
  }
  updateReturnExpression() {
    if (this.returnExpressions.length === 1)
      this.returnExpression = this.returnExpressions[0];
    else {
      this.returnExpression = G;
      for (const e of this.returnExpressions)
        e.deoptimizePath(O);
    }
  }
}
class oc extends ac {
  constructor(e, t) {
    super(e, !1), this.functionNode = t;
    const { context: s } = e;
    this.variables.set("arguments", this.argumentsVariable = new ap(s)), this.variables.set("this", this.thisVariable = new ic(s));
  }
  findLexicalBoundary() {
    return this;
  }
  includeCallArguments(e, t) {
    if (super.includeCallArguments(e, t), this.argumentsVariable.included) {
      const { args: s } = e;
      for (let n = 1; n < s.length; n++) {
        const r = s[n];
        r && (r.includePath(O, t), r.include(t, !1));
      }
    }
  }
  addArgumentToBeDeoptimized(e) {
    this.argumentsVariable.addArgumentToBeDeoptimized(e);
  }
}
class Nt extends v {
  initialise() {
    super.initialise(), this.directive && this.directive !== "use strict" && this.parent.type === On && this.scope.context.log(
      V,
      // This is necessary, because either way (deleting or not) can lead to errors.
      ph(this.directive, this.scope.context.module.id),
      this.start
    );
  }
  removeAnnotations(e) {
    this.expression.removeAnnotations(e);
  }
  render(e, t) {
    super.render(e, t), e.original[this.end - 1] !== ";" && e.appendLeft(this.end, ";");
  }
  shouldBeIncluded(e) {
    return this.directive && this.directive !== "use strict" ? this.parent.type !== On : super.shouldBeIncluded(e);
  }
}
Nt.prototype.includeNode = oe;
Nt.prototype.applyDeoptimizations = Y;
class Kt extends v {
  get deoptimizeBody() {
    return Z(
      this.flags,
      32768
      /* Flag.deoptimizeBody */
    );
  }
  set deoptimizeBody(e) {
    this.flags = ee(this.flags, 32768, e);
  }
  get directlyIncluded() {
    return Z(
      this.flags,
      16384
      /* Flag.directlyIncluded */
    );
  }
  set directlyIncluded(e) {
    this.flags = ee(this.flags, 16384, e);
  }
  addImplicitReturnExpressionToScope() {
    const e = this.body[this.body.length - 1];
    (!e || e.type !== mh) && this.scope.addReturnExpression(G);
  }
  createScope(e) {
    this.scope = this.parent.preventChildBlockScope ? e : new Wt(e);
  }
  hasEffects(e) {
    if (this.deoptimizeBody)
      return !0;
    for (const t of this.body) {
      if (e.brokenFlow)
        break;
      if (t.hasEffects(e))
        return !0;
    }
    return !1;
  }
  include(e, t) {
    if (!(this.deoptimizeBody && this.directlyIncluded)) {
      this.included = !0, this.directlyIncluded = !0, this.deoptimizeBody && (t = !0);
      for (const s of this.body)
        (t || s.shouldBeIncluded(e)) && s.include(e, t);
    }
  }
  initialise() {
    super.initialise(), this.scope.context.magicString.addSourcemapLocation(this.end - 1);
    const e = this.body[0];
    this.deoptimizeBody = e instanceof Nt && e.directive === "use asm";
  }
  render(e, t) {
    this.body.length > 0 ? Hs(this.body, e, this.start + 1, this.end - 1, t) : super.render(e, t);
  }
}
Kt.prototype.includeNode = oe;
Kt.prototype.applyDeoptimizations = Y;
class Lt extends v {
  constructor() {
    super(...arguments), this.declarationInit = null;
  }
  addExportedVariables(e, t) {
    this.argument.addExportedVariables(e, t);
  }
  declare(e, t, s) {
    return this.declarationInit = s, this.argument.declare(e, dn(t), s);
  }
  deoptimizeAssignment(e, t) {
    this.argument.deoptimizeAssignment(dn(e), t);
  }
  deoptimizePath(e) {
    e.length === 0 && this.argument.deoptimizePath(D);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return e.length > 0 || this.argument.hasEffectsOnInteractionAtPath(D, t, s);
  }
  hasEffectsWhenDestructuring(e, t, s) {
    return this.argument.hasEffectsWhenDestructuring(e, dn(t), s);
  }
  includeDestructuredIfNecessary(e, t, s) {
    const n = this.argument.includeDestructuredIfNecessary(e, dn(t), s);
    return !this.included && n && this.includeNode(e), this.included;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.argument.include(e, t);
  }
  markDeclarationReached() {
    this.argument.markDeclarationReached();
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.declarationInit !== null && (this.declarationInit.deoptimizePath([W, W]), this.scope.context.requestTreeshakingPass());
  }
}
Lt.prototype.includeNode = Ce;
const dn = (i) => i.at(-1) === W ? i : [...i, W];
class Xs extends v {
  constructor() {
    super(...arguments), this.parameterVariableValuesDeoptimized = !1, this.includeCallArguments = this.scope.includeCallArguments.bind(this.scope);
  }
  get async() {
    return Z(
      this.flags,
      256
      /* Flag.async */
    );
  }
  set async(e) {
    this.flags = ee(this.flags, 256, e);
  }
  get deoptimizedReturn() {
    return Z(
      this.flags,
      512
      /* Flag.deoptimizedReturn */
    );
  }
  set deoptimizedReturn(e) {
    this.flags = ee(this.flags, 512, e);
  }
  get generator() {
    return Z(
      this.flags,
      4194304
      /* Flag.generator */
    );
  }
  set generator(e) {
    this.flags = ee(this.flags, 4194304, e);
  }
  get hasCachedEffects() {
    return Z(
      this.flags,
      67108864
      /* Flag.hasEffects */
    );
  }
  set hasCachedEffects(e) {
    this.flags = ee(this.flags, 67108864, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    e.type === X && t.length === 0 ? this.scope.deoptimizeArgumentsOnCall(e) : this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.getObjectEntity().deoptimizePath(e), e.length === 1 && e[0] === W && (this.scope.getReturnExpression().deoptimizePath(O), this.scope.deoptimizeAllParameters());
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getObjectEntity().getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return e.length > 0 ? this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e, t, s, n) : this.async ? (this.deoptimizedReturn || (this.deoptimizedReturn = !0, this.scope.getReturnExpression().deoptimizePath(O), this.scope.context.requestTreeshakingPass()), Se) : [this.scope.getReturnExpression(), !1];
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    if (e.length > 0 || t.type !== X)
      return this.getObjectEntity().hasEffectsOnInteractionAtPath(e, t, s);
    if (this.hasCachedEffects)
      return !0;
    if (this.async) {
      const { propertyReadSideEffects: r } = this.scope.context.options.treeshake, a = this.scope.getReturnExpression();
      if (a.hasEffectsOnInteractionAtPath(["then"], Gs, s) || r && (r === "always" || a.hasEffectsOnInteractionAtPath(["then"], zt, s)))
        return this.hasCachedEffects = !0, !0;
    }
    const { propertyReadSideEffects: n } = this.scope.context.options.treeshake;
    for (let r = 0; r < this.params.length; r++) {
      const a = this.params[r];
      if (a.hasEffects(s) || n && a.hasEffectsWhenDestructuring(s, D, t.args[r + 1] || mt))
        return this.hasCachedEffects = !0, !0;
    }
    return !1;
  }
  /**
   * If the function (expression or declaration) is only used as function calls
   */
  onlyFunctionCallUsed() {
    let e = null;
    return this.parent.type === Oh && (e = this.parent.id.variable ?? null), this.parent.type === vl && (e = this.parent.variable), e?.getOnlyFunctionCallUsed() ?? !1;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.parameterVariableValuesDeoptimized || this.onlyFunctionCallUsed() || (this.parameterVariableValuesDeoptimized = !0, this.scope.reassignAllParameters());
    const { brokenFlow: s } = e;
    e.brokenFlow = !1, this.body.include(e, t), e.brokenFlow = s;
  }
  initialise() {
    super.initialise(), this.body instanceof Kt ? this.body.addImplicitReturnExpressionToScope() : this.scope.addReturnExpression(this.body), this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationNoSideEffects = this.annotations.some((e) => e.type === "noSideEffects"));
  }
  parseNode(e) {
    const { body: t, params: s } = e, { scope: n } = this, { bodyScope: r, context: a } = n, o = this.params = s.map((l) => new (a.getNodeConstructor(l.type))(this, n).parseNode(l));
    return n.addParameterVariables(o.map((l) => l.declare("parameter", D, G)), o[o.length - 1] instanceof Lt), this.body = new (a.getNodeConstructor(t.type))(this, r).parseNode(t), super.parseNode(e);
  }
}
Xs.prototype.preventChildBlockScope = !0;
Xs.prototype.includeNode = oe;
Xs.prototype.applyDeoptimizations = Y;
class aa extends Xs {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  createScope(e) {
    this.scope = new oc(e, this), this.constructedEntity = new Ke(/* @__PURE__ */ new Map(), bt), this.scope.thisVariable.addArgumentForDeoptimization(this.constructedEntity);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    super.deoptimizeArgumentsOnInteractionAtPath(e, t, s), e.type === X && t.length === 0 && e.args[0] && this.scope.thisVariable.addArgumentForDeoptimization(e.args[0]);
  }
  hasEffects(e) {
    return this.annotationNoSideEffects ? !1 : !!this.id?.hasEffects(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    if (this.annotationNoSideEffects && e.length === 0 && t.type === X)
      return !1;
    if (super.hasEffectsOnInteractionAtPath(e, t, s))
      return !0;
    if (e.length === 0 && t.type === X) {
      const n = s.replacedVariableInits.get(this.scope.thisVariable);
      s.replacedVariableInits.set(this.scope.thisVariable, t.withNew ? this.constructedEntity : G);
      const { brokenFlow: r, ignore: a, replacedVariableInits: o } = s;
      if (s.ignore = {
        breaks: !1,
        continues: !1,
        labels: /* @__PURE__ */ new Set(),
        returnYield: !0,
        this: t.withNew
      }, this.body.hasEffects(s))
        return this.hasCachedEffects = !0, !0;
      s.brokenFlow = r, n ? o.set(this.scope.thisVariable, n) : o.delete(this.scope.thisVariable), s.ignore = a;
    }
    return !1;
  }
  include(e, t) {
    super.include(e, t), this.id?.include(e, t);
    const s = this.scope.argumentsVariable.included;
    for (const n of this.params)
      (!(n instanceof ae) || s) && n.include(e, t);
  }
  includeNode(e) {
    this.included = !0;
    const t = this.scope.argumentsVariable.included;
    for (const s of this.params)
      (!(s instanceof ae) || t) && s.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.id?.declare("function", D, this);
  }
  getObjectEntity() {
    return this.objectEntity !== null ? this.objectEntity : this.objectEntity = new Ke([
      {
        key: "prototype",
        kind: "init",
        property: new Ke([], bt)
      }
    ], bt);
  }
}
class ds extends aa {
  initialise() {
    super.initialise(), this.id !== null && (this.id.variable.isId = !0);
  }
  onlyFunctionCallUsed() {
    return this.id?.variable.getOnlyFunctionCallUsed() ?? super.onlyFunctionCallUsed();
  }
  parseNode(e) {
    return e.id !== null && (this.id = new ae(this, this.scope.parent).parseNode(e.id)), super.parseNode(e);
  }
}
function fp(i, e) {
  return Pt(i, we(i, "default", e) + 7);
}
function mp(i, e) {
  const t = we(i, "function", e) + 8;
  i = i.slice(t, we(i, "(", t));
  const s = we(i, "*");
  return s === -1 ? t : t + s + 1;
}
class qt extends v {
  bind() {
    super.bind();
    const e = this.declarationName || this.scope.context.getModuleName();
    this.variable.name = this.scope.variables.get(e) ? `${e}_default` : e;
  }
  include(e, t) {
    this.included = !0, this.declaration.include(e, t), t && this.scope.context.includeVariableInModule(this.variable, O, e);
  }
  includePath(e, t) {
    this.included = !0, this.declaration.includePath(e, t);
  }
  initialise() {
    super.initialise();
    const e = this.declaration;
    this.declarationName = e.id && e.id.name || this.declaration.name, this.variable = this.scope.addExportDefaultDeclaration(this, this.scope.context), this.scope.context.addExport(this);
  }
  removeAnnotations(e) {
    this.declaration.removeAnnotations(e);
  }
  render(e, t, s) {
    const { start: n, end: r } = s, a = fp(e.original, this.start);
    if (this.declaration instanceof ds)
      this.renderNamedDeclaration(e, a, this.declaration.id === null ? mp(e.original, a) : null, t);
    else if (this.declaration instanceof hs)
      this.renderNamedDeclaration(e, a, this.declaration.id === null ? we(e.original, "class", n) + 5 : null, t);
    else if (this.variable.getOriginalVariable() !== this.variable) {
      ys(this, e, n, r);
      return;
    } else if (this.variable.included)
      this.renderVariableDeclaration(e, a, t);
    else {
      e.remove(this.start, a), this.declaration.render(e, t, {
        renderedSurroundingElement: Ze
      }), e.original[this.end - 1] !== ";" && e.appendLeft(this.end, ";");
      return;
    }
    this.declaration.render(e, t);
  }
  renderNamedDeclaration(e, t, s, n) {
    const { exportNamesByVariable: r, format: a, snippets: { getPropertyAccess: o } } = n, l = this.variable.getName(o);
    e.remove(this.start, t), s !== null && e.appendLeft(s, ` ${l}`), a === "system" && this.declaration instanceof hs && r.has(this.variable) && e.appendLeft(this.end, ` ${Ht([this.variable], n)};`);
  }
  renderVariableDeclaration(e, t, { format: s, exportNamesByVariable: n, snippets: { cnst: r, getPropertyAccess: a } }) {
    const o = e.original.charCodeAt(this.end - 1) === 59, l = s === "system" && n.get(this.variable);
    l ? (e.overwrite(this.start, t, `${r} ${this.variable.getName(a)} = exports(${JSON.stringify(l[0])}, `), e.appendRight(o ? this.end - 1 : this.end, ")" + (o ? "" : ";"))) : (e.overwrite(this.start, t, `${r} ${this.variable.getName(a)} = `), o || e.appendLeft(this.end, ";"));
  }
}
qt.prototype.needsBoundaries = !0;
qt.prototype.includeNode = oe;
qt.prototype.applyDeoptimizations = Y;
const gp = /[\n\r'\\\u2028\u2029]/, yp = /([\n\r'\u2028\u2029])/g, Ep = /\\/g;
function At(i) {
  return gp.test(i) ? i.replace(Ep, "\\\\").replace(yp, "\\$1") : i;
}
const $r = "_interopDefault", wr = "_interopDefaultCompat", In = "_interopNamespace", Nn = "_interopNamespaceCompat", Ct = "_interopNamespaceDefault", Fs = "_interopNamespaceDefaultOnly", zn = "_mergeNamespaces", gt = "_documentCurrentScript", di = {
  auto: $r,
  compat: wr,
  default: null,
  defaultOnly: null,
  esModule: null
}, pi = (i, e) => i === "esModule" || e && (i === "auto" || i === "compat"), Js = {
  auto: In,
  compat: Nn,
  default: Ct,
  defaultOnly: Fs,
  esModule: null
}, bp = (i, e) => i !== "esModule" && pi(i, e), oa = (i, e, t, s, n, r, a) => {
  const o = new Set(i);
  for (const l of vr)
    e.has(l) && o.add(l);
  return vr.map((l) => o.has(l) ? lc[l](t, s, n, r, a, o) : "").join("");
}, lc = {
  [gt](i, { _: e, n: t }) {
    return `var ${gt}${e}=${e}typeof document${e}!==${e}'undefined'${e}?${e}document.currentScript${e}:${e}null;${t}`;
  },
  [wr](i, e, t) {
    const { _: s, getDirectReturnFunction: n, n: r } = e, [a, o] = n(["e"], {
      functionReturn: !0,
      lineBreakIndent: null,
      name: wr
    });
    return `${a}${Ki(e)}${s}?${s}${t ? So(e) : Po(e)}${o}${r}${r}`;
  },
  [$r](i, e, t) {
    const { _: s, getDirectReturnFunction: n, n: r } = e, [a, o] = n(["e"], {
      functionReturn: !0,
      lineBreakIndent: null,
      name: $r
    });
    return `${a}e${s}&&${s}e.__esModule${s}?${s}${t ? So(e) : Po(e)}${o}${r}${r}`;
  },
  [Nn](i, e, t, s, n, r) {
    const { _: a, getDirectReturnFunction: o, n: l } = e;
    if (r.has(Ct)) {
      const [c, h] = o(["e"], {
        functionReturn: !0,
        lineBreakIndent: null,
        name: Nn
      });
      return `${c}${Ki(e)}${a}?${a}e${a}:${a}${Ct}(e)${h}${l}${l}`;
    }
    return `function ${Nn}(e)${a}{${l}${i}if${a}(${Ki(e)})${a}return e;${l}` + qi(i, i, e, t, s, n) + `}${l}${l}`;
  },
  [Fs](i, e, t, s, n) {
    const { getDirectReturnFunction: r, getObject: a, n: o, _: l } = e, [c, h] = r(["e"], {
      functionReturn: !0,
      lineBreakIndent: null,
      name: Fs
    });
    return `${c}${Cr(s, Io(n, a([
      [null, `__proto__:${l}null`],
      ["default", "e"]
    ], { lineBreakIndent: null }), e))}${h}${o}${o}`;
  },
  [Ct](i, e, t, s, n) {
    const { _: r, n: a } = e;
    return `function ${Ct}(e)${r}{${a}` + qi(i, i, e, t, s, n) + `}${a}${a}`;
  },
  [In](i, e, t, s, n, r) {
    const { _: a, getDirectReturnFunction: o, n: l } = e;
    if (r.has(Ct)) {
      const [c, h] = o(["e"], {
        functionReturn: !0,
        lineBreakIndent: null,
        name: In
      });
      return `${c}e${a}&&${a}e.__esModule${a}?${a}e${a}:${a}${Ct}(e)${h}${l}${l}`;
    }
    return `function ${In}(e)${a}{${l}${i}if${a}(e${a}&&${a}e.__esModule)${a}return e;${l}` + qi(i, i, e, t, s, n) + `}${l}${l}`;
  },
  [zn](i, e, t, s, n) {
    const { _: r, cnst: a, n: o } = e, l = a === "var" && t;
    return `function ${zn}(n, m)${r}{${o}${i}${xp(`{${o}${i}${i}${i}if${r}(k${r}!==${r}'default'${r}&&${r}!(k in n))${r}{${o}` + (t ? l ? cc : Pp : uc)(i, i + i + i + i, e) + `${i}${i}${i}}${o}${i}${i}}`, l, i, e)}${o}${i}return ${Cr(s, Io(n, "n", e))};${o}}${o}${o}`;
  }
}, So = ({ _: i, getObject: e }) => `e${i}:${i}${e([["default", "e"]], { lineBreakIndent: null })}`, Po = ({ _: i, getPropertyAccess: e }) => `e${e("default")}${i}:${i}e`, Ki = ({ _: i }) => `e${i}&&${i}typeof e${i}===${i}'object'${i}&&${i}'default'${i}in e`, qi = (i, e, t, s, n, r) => {
  const { _: a, cnst: o, getObject: l, getPropertyAccess: c, n: h, s: p } = t, d = `{${h}` + (s ? Sp : uc)(i, e + i + i, t) + `${e}${i}}`;
  return `${e}${o} n${a}=${a}Object.create(null${r ? `,${a}{${a}[Symbol.toStringTag]:${a}${zs(l)}${a}}` : ""});${h}${e}if${a}(e)${a}{${h}${e}${i}${Ap(d, !s, t)}${h}${e}}${h}${e}n${c("default")}${a}=${a}e;${h}${e}return ${Cr(n, "n")}${p}${h}`;
}, Ap = (i, e, { _: t, cnst: s, getFunctionIntro: n, s: r }) => s !== "var" || e ? `for${t}(${s} k in e)${t}${i}` : `Object.keys(e).forEach(${n(["k"], {
  isAsync: !1,
  name: null
})}${i})${r}`, xp = (i, e, t, { _: s, cnst: n, getDirectReturnFunction: r, getFunctionIntro: a, n: o }) => {
  if (e) {
    const [l, c] = r(["e"], {
      functionReturn: !1,
      lineBreakIndent: { base: t, t },
      name: null
    });
    return `m.forEach(${l}e${s}&&${s}typeof e${s}!==${s}'string'${s}&&${s}!Array.isArray(e)${s}&&${s}Object.keys(e).forEach(${a(["k"], {
      isAsync: !1,
      name: null
    })}${i})${c});`;
  }
  return `for${s}(var i${s}=${s}0;${s}i${s}<${s}m.length;${s}i++)${s}{${o}${t}${t}${n} e${s}=${s}m[i];${o}${t}${t}if${s}(typeof e${s}!==${s}'string'${s}&&${s}!Array.isArray(e))${s}{${s}for${s}(${n} k in e)${s}${i}${s}}${o}${t}}`;
}, Sp = (i, e, t) => {
  const { _: s, n } = t;
  return `${e}if${s}(k${s}!==${s}'default')${s}{${n}` + cc(i, e + i, t) + `${e}}${n}`;
}, cc = (i, e, { _: t, cnst: s, getDirectReturnFunction: n, n: r }) => {
  const [a, o] = n([], {
    functionReturn: !0,
    lineBreakIndent: null,
    name: null
  });
  return `${e}${s} d${t}=${t}Object.getOwnPropertyDescriptor(e,${t}k);${r}${e}Object.defineProperty(n,${t}k,${t}d.get${t}?${t}d${t}:${t}{${r}${e}${i}enumerable:${t}true,${r}${e}${i}get:${t}${a}e[k]${o}${r}${e}});${r}`;
}, Pp = (i, e, { _: t, cnst: s, getDirectReturnFunction: n, n: r }) => {
  const [a, o] = n([], {
    functionReturn: !0,
    lineBreakIndent: null,
    name: null
  });
  return `${e}${s} d${t}=${t}Object.getOwnPropertyDescriptor(e,${t}k);${r}${e}if${t}(d)${t}{${r}${e}${i}Object.defineProperty(n,${t}k,${t}d.get${t}?${t}d${t}:${t}{${r}${e}${i}${i}enumerable:${t}true,${r}${e}${i}${i}get:${t}${a}e[k]${o}${r}${e}${i}});${r}${e}}${r}`;
}, uc = (i, e, { _: t, n: s }) => `${e}n[k]${t}=${t}e[k];${s}`, Cr = (i, e) => i ? `Object.freeze(${e})` : e, Io = (i, e, { _: t, getObject: s }) => i ? `Object.defineProperty(${e},${t}Symbol.toStringTag,${t}${zs(s)})` : e, vr = Object.keys(lc);
function zs(i) {
  return i([["value", "'Module'"]], {
    lineBreakIndent: null
  });
}
class Ve extends v {
  deoptimizeArgumentsOnInteractionAtPath() {
  }
  getLiteralValueAtPath(e) {
    return e.length > 0 || // unknown literals can also be null but do not start with an "n"
    this.value === null && this.scope.context.code.charCodeAt(this.start) !== 110 || typeof this.value == "bigint" || // to support shims for regular expressions
    this.scope.context.code.charCodeAt(this.start) === 47 ? K : this.value;
  }
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length !== 1 ? Se : qs(this.members, e[0]);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    switch (t.type) {
      case ge:
        return e.length > (this.value === null ? 0 : 1);
      case Ue:
        return !0;
      case X:
        return this.included && this.value instanceof RegExp && (this.value.global || this.value.sticky) ? !0 : e.length !== 1 || Ks(this.members, e[0], t, s);
    }
  }
  initialise() {
    super.initialise(), this.members = Yd(this.value);
  }
  parseNode(e) {
    return this.value = e.value, this.regex = e.regex, super.parseNode(e);
  }
  render(e) {
    typeof this.value == "string" && e.indentExclusionRanges.push([this.start + 1, this.end - 1]);
  }
}
Ve.prototype.includeNode = Ce;
function hc(i, e, t, s, n) {
  if ("getLiteralValueAtPathAsChainElement" in e) {
    const r = e.getLiteralValueAtPathAsChainElement(D, de, n);
    if (r === at || i.optional && r == null)
      return at;
  } else if (i.optional && e.getLiteralValueAtPath(D, de, n) == null)
    return at;
  return i.getLiteralValueAtPath(t, s, n);
}
function Ip(i) {
  return i.computed ? Np(i.property) : i.property.name;
}
function Np(i) {
  return i instanceof Ve ? String(i.value) : null;
}
function dc(i) {
  const e = i.propertyKey, t = i.object;
  if (typeof e == "string") {
    if (t instanceof ae)
      return [
        { key: t.name, pos: t.start },
        { key: e, pos: i.property.start }
      ];
    if (t instanceof jt) {
      const s = dc(t);
      return s && [...s, { key: e, pos: i.property.start }];
    }
  }
  return null;
}
function $p(i) {
  let e = i[0].key;
  for (let t = 1; t < i.length; t++)
    e += "." + i[t].key;
  return e;
}
class jt extends v {
  constructor() {
    super(...arguments), this.promiseHandler = null, this.variable = null, this.expressionsToBeDeoptimized = [];
  }
  get computed() {
    return Z(
      this.flags,
      1024
      /* Flag.computed */
    );
  }
  set computed(e) {
    this.flags = ee(this.flags, 1024, e);
  }
  get optional() {
    return Z(
      this.flags,
      128
      /* Flag.optional */
    );
  }
  set optional(e) {
    this.flags = ee(this.flags, 128, e);
  }
  get assignmentDeoptimized() {
    return Z(
      this.flags,
      16
      /* Flag.assignmentDeoptimized */
    );
  }
  set assignmentDeoptimized(e) {
    this.flags = ee(this.flags, 16, e);
  }
  get bound() {
    return Z(
      this.flags,
      32
      /* Flag.bound */
    );
  }
  set bound(e) {
    this.flags = ee(this.flags, 32, e);
  }
  get isUndefined() {
    return Z(
      this.flags,
      64
      /* Flag.isUndefined */
    );
  }
  set isUndefined(e) {
    this.flags = ee(this.flags, 64, e);
  }
  bind() {
    this.bound = !0;
    const e = dc(this), t = e && this.scope.findVariable(e[0].key);
    if (t?.isNamespace) {
      const s = pc(t, e.slice(1), this.scope.context);
      s ? s === "undefined" ? this.isUndefined = !0 : (this.variable = s, this.scope.addNamespaceMemberAccess($p(e), s)) : super.bind();
    } else
      super.bind();
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.promiseHandler ? this.promiseHandler.deoptimizeArgumentsOnInteractionAtPath(e, t, s) : this.variable ? this.variable.deoptimizeArgumentsOnInteractionAtPath(e, t, s) : this.isUndefined || (t.length < Te ? this.object.deoptimizeArgumentsOnInteractionAtPath(e, this.propertyKey === W ? O : [this.propertyKey, ...t], s) : ot(e));
  }
  deoptimizeAssignment(e, t) {
    this.deoptimizePath(D), t.deoptimizePath([...e, W]);
  }
  deoptimizeCache() {
    if (this.propertyKey === this.dynamicPropertyKey)
      return;
    const { expressionsToBeDeoptimized: e, object: t } = this;
    this.expressionsToBeDeoptimized = De, this.dynamicPropertyKey = this.propertyKey, t.deoptimizePath(O), this.included && t.includePath(O, it());
    for (const s of e)
      s.deoptimizeCache();
  }
  deoptimizePath(e) {
    if (e.length === 0 && this.disallowNamespaceReassignment(), this.variable)
      this.variable.deoptimizePath(e);
    else if (!this.isUndefined) {
      const { propertyKey: t } = this;
      this.object.deoptimizePath([
        t === W ? Tn : t,
        ...e.length < Te ? e : [...e.slice(0, Te), W]
      ]);
    }
  }
  getLiteralValueAtPath(e, t, s) {
    if (this.variable)
      return this.variable.getLiteralValueAtPath(e, t, s);
    if (this.isUndefined)
      return;
    const n = this.getDynamicPropertyKey();
    return n !== W && e.length < Te ? (n !== this.propertyKey && this.expressionsToBeDeoptimized.push(s), this.object.getLiteralValueAtPath([n, ...e], t, s)) : K;
  }
  getLiteralValueAtPathAsChainElement(e, t, s) {
    if (this.variable)
      return this.variable.getLiteralValueAtPath(e, t, s);
    if (!this.isUndefined)
      return hc(this, this.object, e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    if (this.variable)
      return this.variable.getReturnExpressionWhenCalledAtPath(e, t, s, n);
    if (this.isUndefined)
      return [mt, !1];
    const r = this.getDynamicPropertyKey();
    return r !== W && e.length < Te ? (r !== this.propertyKey && this.expressionsToBeDeoptimized.push(n), this.object.getReturnExpressionWhenCalledAtPath([r, ...e], t, s, n)) : Se;
  }
  hasEffects(e) {
    return this.deoptimized || this.applyDeoptimizations(), this.property.hasEffects(e) || this.object.hasEffects(e) || this.hasAccessEffect(e);
  }
  hasEffectsAsChainElement(e) {
    if (this.variable || this.isUndefined)
      return this.hasEffects(e);
    const t = "hasEffectsAsChainElement" in this.object ? this.object.hasEffectsAsChainElement(e) : this.object.hasEffects(e);
    return t === at ? at : this.optional && this.object.getLiteralValueAtPath(D, de, this) == null ? t || at : (this.deoptimized || this.applyDeoptimizations(), t || this.property.hasEffects(e) || this.hasAccessEffect(e));
  }
  hasEffectsAsAssignmentTarget(e, t) {
    return t && !this.deoptimized && this.applyDeoptimizations(), this.assignmentDeoptimized || this.applyAssignmentDeoptimization(), this.property.hasEffects(e) || this.object.hasEffects(e) || t && this.hasAccessEffect(e) || this.hasEffectsOnInteractionAtPath(D, this.assignmentInteraction, e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.variable ? this.variable.hasEffectsOnInteractionAtPath(e, t, s) : this.isUndefined ? !0 : e.length < Te ? this.object.hasEffectsOnInteractionAtPath([this.getDynamicPropertyKey(), ...e], t, s) : !0;
  }
  hasEffectsWhenDestructuring(e, t, s) {
    return t.length > 0 && s.hasEffectsOnInteractionAtPath(t, zt, e);
  }
  include(e, t) {
    this.included || this.includeNode(e), this.object.include(e, t), this.property.include(e, t), t && this.variable?.includePath(O, e);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.variable ? this.scope.context.includeVariableInModule(this.variable, D, e) : this.isUndefined || this.object.includePath([this.propertyKey], e);
  }
  includeNodeAsAssignmentTarget(e) {
    this.included = !0, this.assignmentDeoptimized || this.applyAssignmentDeoptimization(), this.variable ? this.scope.context.includeVariableInModule(this.variable, D, e) : this.isUndefined || this.object.includePath([this.propertyKey], e);
  }
  includePath(e, t) {
    this.included || this.includeNode(t), this.variable ? this.variable?.includePath(e, t) : this.isUndefined || this.object.includePath([
      this.propertyKey,
      ...e.length < Te ? e : [...e.slice(0, Te), W]
    ], t);
  }
  includeAsAssignmentTarget(e, t, s) {
    this.included || this.includeNodeAsAssignmentTarget(e), s && !this.deoptimized && this.applyDeoptimizations(), this.object.include(e, t), this.property.include(e, t);
  }
  includeCallArguments(e, t) {
    this.promiseHandler ? this.promiseHandler.includeCallArguments(e, t) : this.variable ? this.variable.includeCallArguments(e, t) : Xr(e, t);
  }
  includeDestructuredIfNecessary() {
    this.scope.context.error({
      message: "includeDestructuredIfNecessary is currently not supported for MemberExpressions"
    }, this.start);
  }
  initialise() {
    super.initialise(), this.dynamicPropertyKey = Ip(this), this.propertyKey = this.dynamicPropertyKey === null ? W : this.dynamicPropertyKey, this.accessInteraction = { args: [this.object], type: ge };
  }
  render(e, t, { renderedParentType: s, isCalleeOfRenderedParent: n, renderedSurroundingElement: r } = Oe) {
    if (this.variable || this.isUndefined) {
      const { snippets: { getPropertyAccess: a } } = t;
      let o = this.variable ? this.variable.getName(a) : "undefined";
      s && n && (o = "0, " + o), e.overwrite(this.start, this.end, o, {
        contentOnly: !0,
        storeName: !0
      });
    } else
      s && n && e.appendRight(this.start, "0, "), this.object.render(e, t, { renderedSurroundingElement: r }), this.property.render(e, t);
  }
  setAssignedValue(e) {
    this.assignmentInteraction = {
      args: [this.object, e],
      type: Ue
    };
  }
  applyDeoptimizations() {
    this.deoptimized = !0;
    const { propertyReadSideEffects: e } = this.scope.context.options.treeshake;
    // Namespaces are not bound and should not be deoptimized
    this.bound && e && !(this.variable || this.isUndefined || this.promiseHandler) && (this.object.deoptimizeArgumentsOnInteractionAtPath(this.accessInteraction, [this.propertyKey], de), this.scope.context.requestTreeshakingPass()), this.variable && (this.variable.addUsedPlace(this), this.scope.context.requestTreeshakingPass());
  }
  applyAssignmentDeoptimization() {
    this.assignmentDeoptimized = !0;
    const { propertyReadSideEffects: e } = this.scope.context.options.treeshake;
    // Namespaces are not bound and should not be deoptimized
    this.bound && e && !(this.variable || this.isUndefined) && (this.object.deoptimizeArgumentsOnInteractionAtPath(this.assignmentInteraction, [this.propertyKey], de), this.scope.context.requestTreeshakingPass());
  }
  disallowNamespaceReassignment() {
    this.object instanceof ae && this.scope.findVariable(this.object.name).isNamespace && (this.variable && this.scope.context.includeVariableInModule(this.variable, O, it()), this.scope.context.log(V, $l(this.object.name, this.scope.context.module.id), this.start));
  }
  getDynamicPropertyKey() {
    if (this.dynamicPropertyKey === null) {
      this.dynamicPropertyKey = this.propertyKey;
      const e = this.property.getLiteralValueAtPath(D, de, this);
      return this.dynamicPropertyKey = typeof e == "symbol" ? Kr.has(e) ? e : W : String(e);
    }
    return this.dynamicPropertyKey;
  }
  hasAccessEffect(e) {
    const { propertyReadSideEffects: t } = this.scope.context.options.treeshake;
    return !(this.variable || this.isUndefined) && t && (t === "always" || this.object.hasEffectsOnInteractionAtPath([this.getDynamicPropertyKey()], this.accessInteraction, e));
  }
}
function pc(i, e, t) {
  if (e.length === 0)
    return i;
  if (!i.isNamespace || i instanceof Bs)
    return null;
  const s = e[0].key, [n, r] = i.context.traceExport(s);
  if (!n) {
    if (e.length === 1) {
      const a = i.context.fileName;
      return t.log(V, Rn(s, t.module.id, a, !!r?.missingButExportExists), e[0].pos), "undefined";
    }
    return null;
  }
  return pc(n, e.slice(1), t);
}
const ks = "ROLLUP_FILE_URL_", Qt = "ROLLUP_FILE_URL_OBJ_", Xi = "import";
class fc extends v {
  constructor() {
    super(...arguments), this.metaProperty = null, this.preliminaryChunkId = null, this.referenceId = null;
  }
  getReferencedFileName(e) {
    const { meta: { name: t }, metaProperty: s } = this;
    if (t === Xi) {
      if (s?.startsWith(Qt))
        return e.getFileName(s.slice(Qt.length));
      if (s?.startsWith(ks))
        return e.getFileName(s.slice(ks.length));
    }
    return null;
  }
  hasEffects() {
    return !1;
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return e.length > 1 || t !== ge;
  }
  include() {
    this.included || this.includeNode();
  }
  includeNode() {
    if (this.included = !0, this.meta.name === Xi) {
      this.scope.context.addImportMeta(this);
      const e = this.parent, t = this.metaProperty = e instanceof jt && typeof e.propertyKey == "string" ? e.propertyKey : null;
      t?.startsWith(Qt) ? this.referenceId = t.slice(Qt.length) : t?.startsWith(ks) && (this.referenceId = t.slice(ks.length));
    }
  }
  render(e, t) {
    const { format: s, pluginDriver: n, snippets: r } = t, { scope: { context: { module: a } }, meta: { name: o }, metaProperty: l, parent: c, preliminaryChunkId: h, referenceId: p, start: d, end: m } = this, { id: f, info: { attributes: g } } = a;
    if (o !== Xi)
      return;
    const y = h;
    if (p) {
      const E = n.getFileName(p), A = xt(jr(St(y), E)), x = !!l?.startsWith(Qt), k = n.hookFirstSync("resolveFileUrl", [
        { attributes: g, chunkId: y, fileName: E, format: s, moduleId: f, referenceId: p, relativePath: A }
      ]) || vp[s](A, x);
      e.overwrite(c.start, c.end, k, { contentOnly: !0 });
      return;
    }
    let b = n.hookFirstSync("resolveImportMeta", [
      l,
      { attributes: g, chunkId: y, format: s, moduleId: f }
    ]);
    b || (b = kp[s]?.(l, { chunkId: y, snippets: r }), t.accessedDocumentCurrentScript ||= mc.includes(s) && b !== "undefined"), typeof b == "string" && (c instanceof jt ? e.overwrite(c.start, c.end, b, { contentOnly: !0 }) : e.overwrite(d, m, b, { contentOnly: !0 }));
  }
  setResolution(e, t, s) {
    this.preliminaryChunkId = s;
    const n = (this.metaProperty?.startsWith(ks) || this.metaProperty?.startsWith(Qt) ? Cp : wp)[e];
    n.length > 0 && this.scope.addAccessedGlobals(n, t);
  }
}
const mc = ["cjs", "iife", "umd"], wp = {
  amd: ["document", "module", "URL"],
  cjs: ["document", "require", "URL", gt],
  es: [],
  iife: ["document", "URL", gt],
  system: ["module"],
  umd: ["document", "require", "URL", gt]
}, Cp = {
  amd: ["document", "require", "URL"],
  cjs: ["document", "require", "URL"],
  es: [],
  iife: ["document", "URL"],
  system: ["module", "URL"],
  umd: ["document", "require", "URL"]
}, Os = (i, e, t = "URL") => `new ${t}(${i})${e ? "" : ".href"}`, Ji = (i, e, t = !1) => Os(`'${At(i)}', ${t ? "typeof document === 'undefined' ? location.href : " : ""}document.currentScript && document.currentScript.tagName.toUpperCase() === 'SCRIPT' && document.currentScript.src || document.baseURI`, e), pn = (i) => (e, { chunkId: t }) => {
  const s = i(t);
  return e === null ? `({ url: ${s} })` : e === "url" ? s : "undefined";
}, kr = (i, e) => `require('u' + 'rl').pathToFileURL(${i})${e ? "" : ".href"}`, No = (i, e) => kr(`__dirname + '/${At(i)}'`, e), Yi = (i, e = !1) => `${e ? "typeof document === 'undefined' ? location.href : " : ""}(${gt} && ${gt}.tagName.toUpperCase() === 'SCRIPT' && ${gt}.src || new URL('${At(i)}', document.baseURI).href)`, vp = {
  amd: (i, e) => (i[0] !== "." && (i = "./" + i), Os(`require.toUrl('${At(i)}'), document.baseURI`, e)),
  cjs: (i, e) => `(typeof document === 'undefined' ? ${No(i, e)} : ${Ji(i, e)})`,
  es: (i, e) => Os(`'${At(i)}', import.meta.url`, e),
  iife: (i, e) => Ji(i, e),
  system: (i, e) => Os(`'${At(i)}', module.meta.url`, e),
  umd: (i, e) => `(typeof document === 'undefined' && typeof location === 'undefined' ? ${No(i, e)} : ${Ji(i, e, !0)})`
}, kp = {
  amd: pn(() => Os("module.uri, document.baseURI", !1)),
  cjs: pn((i) => `(typeof document === 'undefined' ? ${kr("__filename", !1)} : ${Yi(i)})`),
  iife: pn((i) => Yi(i)),
  system: (i, { snippets: { getPropertyAccess: e } }) => i === null ? "module.meta" : `module.meta${e(i)}`,
  umd: pn((i) => `(typeof document === 'undefined' && typeof location === 'undefined' ? ${kr("__filename", !1)} : ${Yi(i, !0)})`)
};
class gc extends Gt {
  constructor() {
    super("undefined");
  }
  getLiteralValueAtPath() {
  }
}
class lt extends et {
  constructor(e, t) {
    super("default", e, e.declaration, D, t, "other"), this.hasId = !1, this.originalId = null, this.originalVariable = null;
    const s = e.declaration;
    (s instanceof ds || s instanceof hs) && s.id ? (this.hasId = !0, this.originalId = s.id) : s instanceof ae && (this.originalId = s);
  }
  addReference(e) {
    this.hasId || (this.name = e.name);
  }
  addUsedPlace(e) {
    const t = this.getOriginalVariable();
    t === this ? super.addUsedPlace(e) : t.addUsedPlace(e);
  }
  forbidName(e) {
    const t = this.getOriginalVariable();
    t === this ? super.forbidName(e) : t.forbidName(e);
  }
  getAssignedVariableName() {
    return this.originalId && this.originalId.name || null;
  }
  getBaseVariableName() {
    const e = this.getOriginalVariable();
    return e === this ? super.getBaseVariableName() : e.getBaseVariableName();
  }
  getDirectOriginalVariable() {
    return this.originalId && (this.hasId || !(this.originalId.isPossibleTDZ() || this.originalId.variable.isReassigned || this.originalId.variable instanceof gc || // this avoids a circular dependency
    "syntheticNamespace" in this.originalId.variable)) ? this.originalId.variable : null;
  }
  getName(e) {
    const t = this.getOriginalVariable();
    return t === this ? super.getName(e) : t.getName(e);
  }
  getOriginalVariable() {
    if (this.originalVariable)
      return this.originalVariable;
    let e = this, t;
    const s = /* @__PURE__ */ new Set();
    do
      s.add(e), t = e, e = t.getDirectOriginalVariable();
    while (e instanceof lt && !s.has(e));
    return this.originalVariable = e || t;
  }
}
class Mt extends Gt {
  constructor(e) {
    super(e.getModuleName()), this.areAllMembersDeoptimized = !1, this.mergedNamespaces = [], this.nonExplicitNamespacesIncluded = !1, this.referencedEarly = !1, this.references = [], this.context = e, this.module = e.module;
  }
  addReference(e) {
    this.references.push(e), this.name = e.name;
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    if (t.length > 1 || t.length === 1 && e.type === X) {
      const n = t[0];
      typeof n == "string" ? this.module.getExportedVariablesByName().get(n)?.deoptimizeArgumentsOnInteractionAtPath(e, t.slice(1), s) : ot(e);
    }
  }
  deoptimizePath(e) {
    if (e.length > 1) {
      const t = e[0];
      if (typeof t == "string")
        this.module.getExportedVariablesByName().get(t)?.deoptimizePath(e.slice(1));
      else if (!this.areAllMembersDeoptimized) {
        this.areAllMembersDeoptimized = !0;
        for (const s of this.module.getExportedVariablesByName().values())
          s.deoptimizePath(O);
      }
    }
  }
  getLiteralValueAtPath(e) {
    return e[0] === Wr ? "Module" : K;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const { type: n } = t;
    if (e.length === 0)
      return !0;
    if (e.length === 1 && n !== X)
      return n === Ue;
    const r = e[0];
    if (typeof r != "string")
      return !0;
    const a = this.module.getExportedVariablesByName().get(r);
    return !a || a.hasEffectsOnInteractionAtPath(e.slice(1), t, s);
  }
  includePath(e, t) {
    super.includePath(e, t), this.includeMemberPath(e, t);
  }
  includeMemberPath(e, t) {
    if (e.length > 0) {
      const [s, ...n] = e;
      if (typeof s == "string") {
        const r = this.module.getExportedVariablesByName().get(s);
        r ? this.context.includeVariableInModule(r, n, t) : this.includeNonExplicitNamespaces();
      } else s && (this.module.includeAllExports(), this.includeNonExplicitNamespaces());
    }
  }
  prepare(e) {
    this.mergedNamespaces.length > 0 && this.module.scope.addAccessedGlobals([zn], e);
  }
  renderBlock(e) {
    const { exportNamesByVariable: t, format: s, freeze: n, indent: r, symbols: a, snippets: { _: o, cnst: l, getObject: c, getPropertyAccess: h, n: p, s: d } } = e, f = [...this.module.getExportedVariablesByName().entries()].filter(([b, E]) => !b.startsWith("*") && E.included).map(([b, E]) => this.referencedEarly || E.isReassigned || E === this ? [
      null,
      `get ${ai(b)}${o}()${o}{${o}return ${E.getName(h)}${d}${o}}`
    ] : [b, E.getName(h)]);
    f.unshift([null, `__proto__:${o}null`]);
    let g = c(f, { lineBreakIndent: { base: "", t: r } });
    if (this.mergedNamespaces.length > 0) {
      const b = this.mergedNamespaces.map((E) => E.getName(h));
      g = `/*#__PURE__*/${zn}(${g},${o}[${b.join(`,${o}`)}])`;
    } else
      a && (g = `/*#__PURE__*/Object.defineProperty(${g},${o}Symbol.toStringTag,${o}${zs(c)})`), n && (g = `/*#__PURE__*/Object.freeze(${g})`);
    const y = this.getName(h);
    return g = `${l} ${y}${o}=${o}${g};`, s === "system" && t.has(this) && (g += `${p}${Ht([this], e)};`), g;
  }
  renderFirst() {
    return this.referencedEarly;
  }
  setMergedNamespaces(e) {
    this.mergedNamespaces = e;
    const t = this.context.getModuleExecIndex();
    for (const s of this.references) {
      const { context: n } = s.scope;
      if (n.getModuleExecIndex() <= t) {
        this.referencedEarly = !0;
        break;
      }
    }
  }
  includeNonExplicitNamespaces() {
    this.nonExplicitNamespacesIncluded || (this.nonExplicitNamespacesIncluded = !0, this.setMergedNamespaces(this.module.includeAndGetAdditionalMergedNamespaces()));
  }
}
Mt.prototype.isNamespace = !0;
const Rp = (i) => Object.create(i, {
  includePath: {
    value(e, t) {
      i.includeMemberPath(e, t);
    }
  }
});
class ze extends Gt {
  constructor(e, t, s) {
    super(t), this.baseVariable = null, this.context = e, this.module = e.module, this.syntheticNamespace = s;
  }
  getBaseVariable() {
    if (this.baseVariable)
      return this.baseVariable;
    let e = this.syntheticNamespace;
    for (; e instanceof lt || e instanceof ze; ) {
      if (e instanceof lt) {
        const t = e.getOriginalVariable();
        if (t === e)
          break;
        e = t;
      }
      e instanceof ze && (e = e.syntheticNamespace);
    }
    return this.baseVariable = e;
  }
  getBaseVariableName() {
    return this.syntheticNamespace.getBaseVariableName();
  }
  getName(e) {
    return `${this.syntheticNamespace.getName(e)}${e(this.name)}`;
  }
  includePath(e, t) {
    super.includePath(e, t), this.context.includeVariableInModule(this.syntheticNamespace, [this.name, ...e], t);
  }
  setRenderNames(e, t) {
    super.setRenderNames(e, t);
  }
}
class Rt {
  constructor(e, t, s) {
    this.options = t, this.inputBase = s, this.defaultVariableName = "", this.namespaceVariableName = "", this.variableName = "", this.fileName = null, this.importAttributes = null, this.id = e.id, this.moduleInfo = e.info, this.renormalizeRenderPath = e.renormalizeRenderPath, this.suggestedVariableName = e.suggestedVariableName;
  }
  getFileName() {
    if (this.fileName)
      return this.fileName;
    const { paths: e } = this.options;
    return this.fileName = (typeof e == "function" ? e(this.id) : e[this.id]) || (this.renormalizeRenderPath ? xt(jr(this.inputBase, this.id)) : this.id);
  }
  getImportAttributes(e) {
    return this.importAttributes ||= yc(["es", "cjs"].includes(this.options.format) && this.options.externalImportAttributes && this.moduleInfo.attributes, e);
  }
  getImportPath(e) {
    return At(this.renormalizeRenderPath ? kl(e, this.getFileName(), this.options.format === "amd", !1) : this.getFileName());
  }
}
function yc(i, { getObject: e }) {
  if (!i)
    return null;
  const t = Object.entries(i).map(([s, n]) => [s, `'${n}'`]);
  return t.length > 0 ? e(t, { lineBreakIndent: null }) : null;
}
function Ec(i) {
  return i.endsWith(".js") ? i.slice(0, -3) : i;
}
function bc(i, e) {
  return i.autoId ? `${i.basePath ? i.basePath + "/" : ""}${Ec(e)}` : i.id ?? "";
}
function fi(i, e, t, s, n, r, a, o, l = "return ") {
  const { _: c, getDirectReturnFunction: h, getFunctionIntro: p, getPropertyAccess: d, n: m, s: f } = n;
  if (!t)
    return `${m}${m}${l}${Dp(i, e, s, a, d)};`;
  let g = "";
  if (t) {
    for (const { defaultVariableName: y, importPath: b, isChunk: E, name: A, namedExportsMode: x, namespaceVariableName: k, reexports: F } of e)
      if (F) {
        for (const T of F)
          if (T.reexported !== "*") {
            const U = Ac(A, T.imported, x, E, y, k, s, b, a, d);
            if (g && (g += m), T.imported !== "*" && T.needsLiveBinding) {
              const [B, w] = h([], {
                functionReturn: !0,
                lineBreakIndent: null,
                name: null
              });
              g += `Object.defineProperty(exports,${c}${JSON.stringify(T.reexported)},${c}{${m}${r}enumerable:${c}true,${m}${r}get:${c}${B}${U}${w}${m}});`;
            } else T.reexported === "__proto__" ? g += `Object.defineProperty(exports,${c}"__proto__",${c}{${m}${r}enumerable:${c}true,${m}${r}value:${c}${U}${m}});` : g += `exports${d(T.reexported)}${c}=${c}${U};`;
          }
      }
  }
  for (const { exported: y, local: b } of i) {
    const E = `exports${d(y)}`, A = b;
    E !== A && (g && (g += m), g += y === "__proto__" ? `Object.defineProperty(exports,${c}"__proto__",${c}{${m}${r}enumerable:${c}true,${m}${r}value:${c}${A}${m}});` : `${E}${c}=${c}${A};`);
  }
  if (t) {
    for (const { name: y, reexports: b } of e)
      if (b) {
        for (const E of b)
          if (E.reexported === "*") {
            if (g && (g += m), !E.needsLiveBinding && o) {
              const x = "'__proto__'";
              g += `Object.prototype.hasOwnProperty.call(${y},${c}${x})${c}&&${m}${r}!Object.prototype.hasOwnProperty.call(exports,${c}${x})${c}&&${m}${r}Object.defineProperty(exports,${c}${x},${c}{${m}${r}${r}enumerable:${c}true,${m}${r}${r}value:${c}${y}[${x}]${m}${r}});${m}${m}`;
            }
            const A = `{${m}${r}if${c}(k${c}!==${c}'default'${c}&&${c}!Object.prototype.hasOwnProperty.call(exports,${c}k))${c}${Op(y, E.needsLiveBinding, r, n)}${f}${m}}`;
            g += `Object.keys(${y}).forEach(${p(["k"], {
              isAsync: !1,
              name: null
            })}${A});`;
          }
      }
  }
  return g ? `${m}${m}${g}` : "";
}
function Dp(i, e, t, s, n) {
  if (i.length > 0)
    return i[0].local;
  for (const { defaultVariableName: r, importPath: a, isChunk: o, name: l, namedExportsMode: c, namespaceVariableName: h, reexports: p } of e)
    if (p)
      return Ac(l, p[0].imported, c, o, r, h, t, a, s, n);
}
function Ac(i, e, t, s, n, r, a, o, l, c) {
  if (e === "default") {
    if (!s) {
      const h = a(o), p = di[h] ? n : i;
      return pi(h, l) ? `${p}${c("default")}` : p;
    }
    return t ? `${i}${c("default")}` : i;
  }
  return e === "*" ? (s ? !t : Js[a(o)]) ? r : i : `${i}${c(e)}`;
}
function $o(i) {
  return i([["value", "true"]], {
    lineBreakIndent: null
  });
}
function mi(i, e, t, { _: s, getObject: n }) {
  if (i) {
    if (e)
      return t ? `Object.defineProperties(exports,${s}${n([
        ["__esModule", $o(n)],
        [null, `[Symbol.toStringTag]:${s}${zs(n)}`]
      ], {
        lineBreakIndent: null
      })});` : `Object.defineProperty(exports,${s}'__esModule',${s}${$o(n)});`;
    if (t)
      return `Object.defineProperty(exports,${s}Symbol.toStringTag,${s}${zs(n)});`;
  }
  return "";
}
const Op = (i, e, t, { _: s, getDirectReturnFunction: n, n: r }) => {
  if (e) {
    const [a, o] = n([], {
      functionReturn: !0,
      lineBreakIndent: null,
      name: null
    });
    return `Object.defineProperty(exports,${s}k,${s}{${r}${t}${t}enumerable:${s}true,${r}${t}${t}get:${s}${a}${i}[k]${o}${r}${t}})`;
  }
  return `exports[k]${s}=${s}${i}[k]`;
};
function gi(i, e, t, s, n, r, a, o) {
  const { _: l, cnst: c, n: h } = o, p = /* @__PURE__ */ new Set(), d = [], m = (f, g, y) => {
    p.add(g), d.push(`${c} ${f}${l}=${l}/*#__PURE__*/${g}(${y});`);
  };
  for (const { defaultVariableName: f, imports: g, importPath: y, isChunk: b, name: E, namedExportsMode: A, namespaceVariableName: x, reexports: k } of i)
    if (b) {
      for (const { imported: F, reexported: T } of [
        ...g || [],
        ...k || []
      ])
        if (F === "*" && T !== "*") {
          A || m(x, Fs, E);
          break;
        }
    } else {
      const F = e(y);
      let T = !1, U = !1;
      for (const { imported: B, reexported: w } of [
        ...g || [],
        ...k || []
      ]) {
        let j, z;
        B === "default" ? T || (T = !0, f !== x && (z = f, j = di[F])) : B === "*" && w !== "*" && !U && (U = !0, j = Js[F], z = x), j && m(z, j, E);
      }
    }
  return `${oa(p, r, a, o, t, s, n)}${d.length > 0 ? `${d.join(h)}${h}${h}` : ""}`;
}
function Lp(i) {
  return i.endsWith(".js") ? i : i + ".js";
}
function xc(i, e) {
  return i[0] !== "." ? i : e ? Lp(i) : Ec(i);
}
const Mp = [
  "node:assert",
  "assert",
  "node:assert/strict",
  "assert/strict",
  "node:async_hooks",
  "async_hooks",
  "node:buffer",
  "buffer",
  "node:child_process",
  "child_process",
  "node:cluster",
  "cluster",
  "node:console",
  "console",
  "node:constants",
  "constants",
  "node:crypto",
  "crypto",
  "node:dgram",
  "dgram",
  "node:diagnostics_channel",
  "diagnostics_channel",
  "node:dns",
  "dns",
  "node:dns/promises",
  "dns/promises",
  "node:domain",
  "domain",
  "node:events",
  "events",
  "node:fs",
  "fs",
  "node:fs/promises",
  "fs/promises",
  "node:http",
  "http",
  "node:http2",
  "http2",
  "node:https",
  "https",
  "node:inspector",
  "inspector",
  "node:inspector/promises",
  "inspector/promises",
  "node:module",
  "module",
  "node:net",
  "net",
  "node:os",
  "os",
  "node:path",
  "path",
  "node:path/posix",
  "path/posix",
  "node:path/win32",
  "path/win32",
  "node:perf_hooks",
  "perf_hooks",
  "node:process",
  "process",
  "node:querystring",
  "querystring",
  "node:quic",
  "node:readline",
  "readline",
  "node:readline/promises",
  "readline/promises",
  "node:repl",
  "repl",
  "node:sea",
  "node:sqlite",
  "node:stream",
  "stream",
  "node:stream/consumers",
  "stream/consumers",
  "node:stream/promises",
  "stream/promises",
  "node:stream/web",
  "stream/web",
  "node:string_decoder",
  "string_decoder",
  "node:test",
  "node:test/reporters",
  "node:timers",
  "timers",
  "node:timers/promises",
  "timers/promises",
  "node:tls",
  "tls",
  "node:trace_events",
  "trace_events",
  "node:tty",
  "tty",
  "node:url",
  "url",
  "node:util",
  "util",
  "node:util/types",
  "util/types",
  "node:v8",
  "v8",
  "node:vm",
  "vm",
  "node:wasi",
  "wasi",
  "node:worker_threads",
  "worker_threads",
  "node:zlib",
  "zlib"
], Tp = new Set(Mp);
function la(i, e) {
  const t = e.map(({ importPath: s }) => s).filter((s) => Tp.has(s) || s.startsWith("node:"));
  t.length !== 0 && i(V, ld(t));
}
function Bp(i, { accessedGlobals: e, dependencies: t, exports: s, hasDefaultExport: n, hasExports: r, id: a, indent: o, intro: l, isEntryFacade: c, isModuleFacade: h, namedExportsMode: p, log: d, outro: m, snippets: f }, { amd: g, esModule: y, externalLiveBindings: b, freeze: E, generatedCode: { symbols: A }, interop: x, reexportProtoFromExternal: k, strict: F }) {
  la(d, t);
  const T = t.map((Q) => `'${xc(Q.importPath, g.forceJsExtensionForImports)}'`), U = t.map((Q) => Q.name), { n: B, getNonArrowFunctionIntro: w, _: j } = f;
  r && (p || s[0]?.local === "exports.default") && (U.unshift("exports"), T.unshift("'exports'")), e.has("require") && (U.unshift("require"), T.unshift("'require'")), e.has("module") && (U.unshift("module"), T.unshift("'module'"));
  const z = bc(g, a), le = (z ? `'${z}',${j}` : "") + (T.length > 0 ? `[${T.join(`,${j}`)}],${j}` : ""), ne = F ? `${j}'use strict';` : "";
  i.prepend(`${l}${gi(t, x, b, E, A, e, o, f)}`);
  const te = fi(s, t, p, x, f, o, b, k);
  let re = mi(p && r, c && (y === !0 || y === "if-default-prop" && n), h && A, f);
  re && (re = B + B + re), i.append(`${te}${re}${m}`).indent(o).prepend(`${g.define}(${le}(${w(U, {
    isAsync: !1,
    name: null
  })}{${ne}${B}${B}`).append(`${B}${B}}));`);
}
function _p(i, { accessedGlobals: e, dependencies: t, exports: s, hasDefaultExport: n, hasExports: r, indent: a, intro: o, isEntryFacade: l, isModuleFacade: c, namedExportsMode: h, outro: p, snippets: d }, { compact: m, esModule: f, externalLiveBindings: g, freeze: y, interop: b, generatedCode: { symbols: E }, reexportProtoFromExternal: A, strict: x }) {
  const { _: k, n: F } = d, T = x ? `'use strict';${F}${F}` : "";
  let U = mi(h && r, l && (f === !0 || f === "if-default-prop" && n), c && E, d);
  U && (U += F + F);
  const B = Fp(t, d, m), w = gi(t, b, g, y, E, e, a, d);
  i.prepend(`${T}${o}${U}${B}${w}`);
  const j = fi(s, t, h, b, d, a, g, A, `module.exports${k}=${k}`);
  i.append(`${j}${p}`);
}
function Fp(i, { _: e, cnst: t, n: s }, n) {
  let r = "", a = !1;
  for (const { importPath: o, name: l, reexports: c, imports: h } of i)
    !c && !h ? (r && (r += n && !a ? "," : `;${s}`), a = !1, r += `require('${o}')`) : (r += n && a ? "," : `${r ? `;${s}` : ""}${t} `, a = !0, r += `${l}${e}=${e}require('${o}')`);
  return r ? `${r};${s}${s}` : "";
}
function zp(i, { accessedGlobals: e, indent: t, intro: s, outro: n, dependencies: r, exports: a, snippets: o }, { externalLiveBindings: l, freeze: c, generatedCode: { symbols: h }, importAttributesKey: p }) {
  const { n: d } = o, m = Vp(r, p, o);
  m.length > 0 && (s += m.join(d) + d + d), s += oa(null, e, t, o, l, c, h), s && i.prepend(s);
  const f = Up(a, o);
  f.length > 0 && i.append(d + d + f.join(d).trim()), n && i.append(n), i.trim();
}
function Vp(i, e, { _: t }) {
  const s = [];
  for (const { importPath: n, reexports: r, imports: a, name: o, attributes: l } of i) {
    const c = l ? `${t}${e}${t}${l}` : "", h = `'${n}'${c};`;
    if (!r && !a) {
      s.push(`import${t}${h}`);
      continue;
    }
    if (a) {
      let p = null, d = null;
      const m = [];
      for (const f of a)
        f.imported === "default" ? p = f : f.imported === "*" ? d = f : m.push(f);
      d && s.push(`import${t}*${t}as ${d.local} from${t}${h}`), p && m.length === 0 ? s.push(`import ${p.local} from${t}${h}`) : m.length > 0 && s.push(`import ${p ? `${p.local},${t}` : ""}{${t}${m.map((f) => f.imported === f.local ? f.imported : `${Zt(f.imported)} as ${f.local}`).join(`,${t}`)}${t}}${t}from${t}${h}`);
    }
    if (r) {
      let p = null;
      const d = [], m = [];
      for (const f of r)
        f.reexported === "*" ? p = f : f.imported === "*" ? d.push(f) : m.push(f);
      if (p && s.push(`export${t}*${t}from${t}${h}`), d.length > 0) {
        (!a || !a.some((f) => f.imported === "*" && f.local === o)) && s.push(`import${t}*${t}as ${o} from${t}${h}`);
        for (const f of d)
          s.push(`export${t}{${t}${o === f.reexported ? o : `${o} as ${Zt(f.reexported)}`} };`);
      }
      m.length > 0 && s.push(`export${t}{${t}${m.map((f) => f.imported === f.reexported ? Zt(f.imported) : `${Zt(f.imported)} as ${Zt(f.reexported)}`).join(`,${t}`)}${t}}${t}from${t}${h}`);
    }
  }
  return s;
}
function Up(i, { _: e, cnst: t }) {
  const s = [], n = new Array(i.length);
  let r = 0;
  for (const a of i)
    a.expression && s.push(`${t} ${a.local}${e}=${e}${a.expression};`), n[r++] = a.exported === a.local ? a.local : `${a.local} as ${Zt(a.exported)}`;
  return n.length > 0 && s.push(`export${e}{${e}${n.join(`,${e}`)}${e}};`), s;
}
const $n = (i, e) => i.split(".").map(e).join("");
function jp(i, e, t, { _: s, getPropertyAccess: n, s: r }, a, o) {
  const l = i.split("."), c = l[0] in Object.prototype;
  o && c && o(V, Ml(l[0])), l[0] = (typeof t == "function" ? t(l[0]) : c ? l[0] : t[l[0]]) || l[0], l.pop();
  let h = e;
  return l.map((p) => (h += n(p), `${h}${s}=${s}${h}${s}||${s}{}${r}`)).join(a ? "," : `
`) + (a && l.length > 0 ? ";" : `
`);
}
function Qi(i, e, t, s, { _: n, getPropertyAccess: r }, a) {
  const o = i.split("."), l = o[0] in Object.prototype;
  a && l && a(V, Ml(o[0])), o[0] = (typeof t == "function" ? t(o[0]) : l ? o[0] : t[o[0]]) || o[0];
  const c = o.pop();
  let h = e, p = [
    ...o.map((d) => (h += r(d), `${h}${n}=${n}${h}${n}||${n}{}`)),
    `${h}${r(c)}`
  ].join(`,${n}`) + `${n}=${n}${s}`;
  return o.length > 0 && (p = `(${p})`), p;
}
function Sc(i) {
  let e = i.length;
  for (; e--; ) {
    const { imports: t, reexports: s } = i[e];
    if (t || s)
      return i.slice(0, e + 1);
  }
  return [];
}
function Hp(i, { accessedGlobals: e, dependencies: t, exports: s, hasDefaultExport: n, hasExports: r, indent: a, intro: o, namedExportsMode: l, log: c, outro: h, snippets: p }, { compact: d, esModule: m, extend: f, freeze: g, externalLiveBindings: y, reexportProtoFromExternal: b, globals: E, interop: A, name: x, generatedCode: { symbols: k }, strict: F }) {
  const { _: T, getNonArrowFunctionIntro: U, getPropertyAccess: B, n: w } = p, j = x && x.includes("."), z = !f && !j;
  if (x && z && !Ud(x))
    return R(Xh(x));
  la(c, t);
  const le = Sc(t), ne = le.map((pe) => pe.globalName || "null"), te = le.map((pe) => pe.name);
  r && !x && c(V, Jh()), r && (l || s[0]?.local === "exports.default") && (f ? (ne.unshift(`this${$n(x, B)}${T}=${T}this${$n(x, B)}${T}||${T}{}`), te.unshift("exports")) : (ne.unshift("{}"), te.unshift("exports")));
  const re = F ? `${a}'use strict';${w}` : "", Q = gi(t, A, y, g, k, e, a, p);
  i.prepend(`${o}${Q}`);
  let he = `(${U(te, {
    isAsync: !1,
    name: null
  })}{${w}${re}${w}`;
  r && (x && !(f && l) && (he = (z ? `var ${x}` : `this${$n(x, B)}`) + `${T}=${T}${he}`), j && (he = jp(x, "this", E, p, d, c) + he));
  let fe = `${w}${w}})(${ne.join(`,${T}`)});`;
  r && !f && l && (fe = `${w}${w}${a}return exports;${fe}`);
  const I = fi(s, t, l, A, p, a, y, b);
  let ce = mi(l && r, m === !0 || m === "if-default-prop" && n, k, p);
  ce && (ce = w + w + ce), i.append(`${I}${ce}${h}`).indent(a).prepend(he).append(fe);
}
const ps = "_missingExportShim";
function Gp(i, { accessedGlobals: e, dependencies: t, exports: s, hasExports: n, indent: r, intro: a, snippets: o, outro: l, usesTopLevelAwait: c }, { externalLiveBindings: h, freeze: p, name: d, generatedCode: { symbols: m }, strict: f, systemNullSetters: g }) {
  const { _: y, getFunctionIntro: b, getNonArrowFunctionIntro: E, n: A, s: x } = o, { importBindings: k, setters: F, starExcludes: T } = Wp(t, s, r, o), U = d ? `'${d}',${y}` : "", B = e.has("module") ? ["exports", "module"] : n ? ["exports"] : [];
  let w = `System.register(${U}[` + t.map(({ importPath: z }) => `'${z}'`).join(`,${y}`) + `],${y}(${E(B, {
    isAsync: !1,
    name: null
  })}{${A}${r}${f ? "'use strict';" : ""}` + qp(T, r, o) + Xp(k, r, o) + `${A}${r}return${y}{${F.length > 0 ? `${A}${r}${r}setters:${y}[${F.map((z) => z ? `${b(["module"], {
    isAsync: !1,
    name: null
  })}{${A}${r}${r}${r}${z}${A}${r}${r}}` : g ? "null" : `${b([], { isAsync: !1, name: null })}{}`).join(`,${y}`)}],` : ""}${A}`;
  w += `${r}${r}execute:${y}(${E([], {
    isAsync: c,
    name: null
  })}{${A}${A}`;
  const j = `${r}${r}})${A}${r}}${x}${A}}));`;
  i.prepend(a + oa(null, e, r, o, h, p, m) + Jp(s, r, o)).append(`${l}${A}${A}` + Yp(s, r, o) + Qp(s, r, o)).indent(`${r}${r}${r}`).append(j).prepend(w);
}
function Wp(i, e, t, { _: s, cnst: n, getObject: r, getPropertyAccess: a, n: o }) {
  const l = [], c = [];
  let h = null;
  for (const { imports: p, reexports: d } of i) {
    const m = [];
    if (p)
      for (const f of p)
        l.push(f.local), f.imported === "*" ? m.push(`${f.local}${s}=${s}module;`) : m.push(`${f.local}${s}=${s}module${a(f.imported)};`);
    if (d) {
      const f = [];
      let g = !1;
      for (const { imported: y, reexported: b } of d)
        b === "*" ? g = !0 : f.push([
          b,
          y === "*" ? "module" : `module${a(y)}`
        ]);
      if (f.length > 1 || g)
        if (g) {
          h || (h = Kp({ dependencies: i, exports: e })), f.unshift([null, `__proto__:${s}null`]);
          const y = r(f, { lineBreakIndent: null });
          m.push(`${n} setter${s}=${s}${y};`, `for${s}(${n} name in module)${s}{`, `${t}if${s}(!_starExcludes[name])${s}setter[name]${s}=${s}module[name];`, "}", "exports(setter);");
        } else {
          const y = r(f, { lineBreakIndent: null });
          m.push(`exports(${y});`);
        }
      else {
        const [y, b] = f[0];
        m.push(`exports(${JSON.stringify(y)},${s}${b});`);
      }
    }
    c.push(m.join(`${o}${t}${t}${t}`));
  }
  return { importBindings: l, setters: c, starExcludes: h };
}
const Kp = ({ dependencies: i, exports: e }) => {
  const t = new Set(e.map((s) => s.exported));
  t.add("default");
  for (const { reexports: s } of i)
    if (s)
      for (const n of s)
        n.reexported !== "*" && t.add(n.reexported);
  return t;
}, qp = (i, e, { _: t, cnst: s, getObject: n, n: r }) => {
  if (i) {
    const a = [...i].map((o) => [
      o,
      "1"
    ]);
    return a.unshift([null, `__proto__:${t}null`]), `${r}${e}${s} _starExcludes${t}=${t}${n(a, {
      lineBreakIndent: { base: e, t: e }
    })};`;
  }
  return "";
}, Xp = (i, e, { _: t, n: s }) => i.length > 0 ? `${s}${e}var ${i.join(`,${t}`)};` : "", Jp = (i, e, t) => ca(i.filter((s) => s.hoisted).map((s) => ({ name: s.exported, value: s.local })), e, t);
function ca(i, e, { _: t, n: s }) {
  return i.length === 0 ? "" : i.length === 1 ? `exports(${JSON.stringify(i[0].name)},${t}${i[0].value});${s}${s}` : `exports({${s}` + i.map(({ name: n, value: r }) => `${e}${ai(n)}:${t}${r}`).join(`,${s}`) + `${s}});${s}${s}`;
}
const Yp = (i, e, t) => ca(i.filter((s) => s.expression).map((s) => ({ name: s.exported, value: s.local })), e, t), Qp = (i, e, t) => ca(i.filter((s) => s.local === ps).map((s) => ({ name: s.exported, value: ps })), e, t);
function Zi(i, e, t) {
  return i ? `${e}${$n(i, t)}` : "null";
}
function Zp(i, e, { _: t, getPropertyAccess: s }) {
  let n = e;
  return i.split(".").map((r) => n += s(r)).join(`${t}&&${t}`);
}
function ef(i, { accessedGlobals: e, dependencies: t, exports: s, hasDefaultExport: n, hasExports: r, id: a, indent: o, intro: l, namedExportsMode: c, log: h, outro: p, snippets: d }, { amd: m, compact: f, esModule: g, extend: y, externalLiveBindings: b, freeze: E, interop: A, name: x, generatedCode: { symbols: k }, globals: F, noConflict: T, reexportProtoFromExternal: U, strict: B }) {
  const { _: w, cnst: j, getFunctionIntro: z, getNonArrowFunctionIntro: le, getPropertyAccess: ne, n: te, s: re } = d, Q = f ? "f" : "factory", he = f ? "g" : "global";
  if (r && !x)
    return R(qh());
  la(h, t);
  const fe = t.map((C) => `'${xc(C.importPath, m.forceJsExtensionForImports)}'`), I = t.map((C) => `require('${C.importPath}')`), ce = Sc(t), pe = ce.map((C) => Zi(C.globalName, he, ne)), tt = ce.map((C) => C.name);
  (r || T) && (c || r && s[0]?.local === "exports.default") && (fe.unshift("'exports'"), I.unshift("exports"), pe.unshift(Qi(x, he, F, `${y ? `${Zi(x, he, ne)}${w}||${w}` : ""}{}`, d, h)), tt.unshift("exports"));
  const S = bc(m, a), N = (S ? `'${S}',${w}` : "") + (fe.length > 0 ? `[${fe.join(`,${w}`)}],${w}` : ""), Xe = m.define, _ = !c && r ? `module.exports${w}=${w}` : "", se = B ? `${w}'use strict';${te}` : "";
  let ve;
  if (T) {
    const C = f ? "e" : "exports";
    let q;
    if (!c && r)
      q = `${j} ${C}${w}=${w}${Qi(x, he, F, `${Q}(${pe.join(`,${w}`)})`, d, h)};`;
    else {
      const ye = pe.shift();
      q = `${j} ${C}${w}=${w}${ye};${te}${o}${o}${Q}(${[C, ...pe].join(`,${w}`)});`;
    }
    ve = `(${z([], { isAsync: !1, name: null })}{${te}${o}${o}${j} current${w}=${w}${Zp(x, he, d)};${te}${o}${o}${q}${te}${o}${o}${C}.noConflict${w}=${w}${z([], {
      isAsync: !1,
      name: null
    })}{${w}${Zi(x, he, ne)}${w}=${w}current;${w}return ${C}${re}${w}};${te}${o}})()`;
  } else
    ve = `${Q}(${pe.join(`,${w}`)})`, !c && r && (ve = Qi(x, he, F, ve, d, h));
  const Le = r || T && c || pe.length > 0, Ne = [Q];
  Le && Ne.unshift(he);
  const Pe = Le ? `this,${w}` : "", st = Le ? `(${he}${w}=${w}typeof globalThis${w}!==${w}'undefined'${w}?${w}globalThis${w}:${w}${he}${w}||${w}self,${w}` : "", Be = Le ? ")" : "", H = Le ? `${o}typeof exports${w}===${w}'object'${w}&&${w}typeof module${w}!==${w}'undefined'${w}?${w}${_}${Q}(${I.join(`,${w}`)})${w}:${te}` : "", Me = `(${le(Ne, { isAsync: !1, name: null })}{${te}` + H + `${o}typeof ${Xe}${w}===${w}'function'${w}&&${w}${Xe}.amd${w}?${w}${Xe}(${N}${Q})${w}:${te}${o}${st}${ve}${Be};${te}})(${Pe}(${le(tt, {
    isAsync: !1,
    name: null
  })}{${se}${te}`, ke = te + te + "}));";
  i.prepend(`${l}${gi(t, A, b, E, k, e, o, d)}`);
  const M = fi(s, t, c, A, d, o, b, U);
  let ie = mi(c && r, g === !0 || g === "if-default-prop" && n, k, d);
  ie && (ie = te + te + ie), i.append(`${M}${ie}${p}`).trim().indent(o).append(ke).prepend(Me);
}
const tf = { amd: Bp, cjs: _p, es: zp, iife: Hp, system: Gp, umd: ef };
function Pc(i) {
  return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
}
function Yy(i) {
  if (Object.prototype.hasOwnProperty.call(i, "__esModule")) return i;
  var e = i.default;
  if (typeof e == "function") {
    var t = function s() {
      var n = !1;
      try {
        n = this instanceof s;
      } catch {
      }
      return n ? Reflect.construct(e, arguments, this.constructor) : e.apply(this, arguments);
    };
    t.prototype = e.prototype;
  } else t = {};
  return Object.defineProperty(t, "__esModule", { value: !0 }), Object.keys(i).forEach(function(s) {
    var n = Object.getOwnPropertyDescriptor(i, s);
    Object.defineProperty(t, s, n.get ? n : {
      enumerable: !0,
      get: function() {
        return i[s];
      }
    });
  }), t;
}
var er = {}, tr, wo;
function yi() {
  if (wo) return tr;
  wo = 1;
  const i = "\\\\/", e = `[^${i}]`, t = "\\.", s = "\\+", n = "\\?", r = "\\/", a = "(?=.)", o = "[^/]", l = `(?:${r}|$)`, c = `(?:^|${r})`, h = `${t}{1,2}${l}`, p = `(?!${t})`, d = `(?!${c}${h})`, m = `(?!${t}{0,1}${l})`, f = `(?!${h})`, g = `[^.${r}]`, y = `${o}*?`, E = {
    DOT_LITERAL: t,
    PLUS_LITERAL: s,
    QMARK_LITERAL: n,
    SLASH_LITERAL: r,
    ONE_CHAR: a,
    QMARK: o,
    END_ANCHOR: l,
    DOTS_SLASH: h,
    NO_DOT: p,
    NO_DOTS: d,
    NO_DOT_SLASH: m,
    NO_DOTS_SLASH: f,
    QMARK_NO_DOT: g,
    STAR: y,
    START_ANCHOR: c,
    SEP: "/"
  }, A = {
    ...E,
    SLASH_LITERAL: `[${i}]`,
    QMARK: e,
    STAR: `${e}*?`,
    DOTS_SLASH: `${t}{1,2}(?:[${i}]|$)`,
    NO_DOT: `(?!${t})`,
    NO_DOTS: `(?!(?:^|[${i}])${t}{1,2}(?:[${i}]|$))`,
    NO_DOT_SLASH: `(?!${t}{0,1}(?:[${i}]|$))`,
    NO_DOTS_SLASH: `(?!${t}{1,2}(?:[${i}]|$))`,
    QMARK_NO_DOT: `[^.${i}]`,
    START_ANCHOR: `(?:^|[${i}])`,
    END_ANCHOR: `(?:[${i}]|$)`,
    SEP: "\\"
  }, x = {
    alnum: "a-zA-Z0-9",
    alpha: "a-zA-Z",
    ascii: "\\x00-\\x7F",
    blank: " \\t",
    cntrl: "\\x00-\\x1F\\x7F",
    digit: "0-9",
    graph: "\\x21-\\x7E",
    lower: "a-z",
    print: "\\x20-\\x7E ",
    punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
    space: " \\t\\r\\n\\v\\f",
    upper: "A-Z",
    word: "A-Za-z0-9_",
    xdigit: "A-Fa-f0-9"
  };
  return tr = {
    MAX_LENGTH: 1024 * 64,
    POSIX_REGEX_SOURCE: x,
    // regular expressions
    REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
    REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
    REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
    REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
    REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
    REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
    // Replace globs with equivalent patterns to reduce parsing time.
    REPLACEMENTS: {
      __proto__: null,
      "***": "*",
      "**/**": "**",
      "**/**/**": "**"
    },
    // Digits
    CHAR_0: 48,
    /* 0 */
    CHAR_9: 57,
    /* 9 */
    // Alphabet chars.
    CHAR_UPPERCASE_A: 65,
    /* A */
    CHAR_LOWERCASE_A: 97,
    /* a */
    CHAR_UPPERCASE_Z: 90,
    /* Z */
    CHAR_LOWERCASE_Z: 122,
    /* z */
    CHAR_LEFT_PARENTHESES: 40,
    /* ( */
    CHAR_RIGHT_PARENTHESES: 41,
    /* ) */
    CHAR_ASTERISK: 42,
    /* * */
    // Non-alphabetic chars.
    CHAR_AMPERSAND: 38,
    /* & */
    CHAR_AT: 64,
    /* @ */
    CHAR_BACKWARD_SLASH: 92,
    /* \ */
    CHAR_CARRIAGE_RETURN: 13,
    /* \r */
    CHAR_CIRCUMFLEX_ACCENT: 94,
    /* ^ */
    CHAR_COLON: 58,
    /* : */
    CHAR_COMMA: 44,
    /* , */
    CHAR_DOT: 46,
    /* . */
    CHAR_DOUBLE_QUOTE: 34,
    /* " */
    CHAR_EQUAL: 61,
    /* = */
    CHAR_EXCLAMATION_MARK: 33,
    /* ! */
    CHAR_FORM_FEED: 12,
    /* \f */
    CHAR_FORWARD_SLASH: 47,
    /* / */
    CHAR_GRAVE_ACCENT: 96,
    /* ` */
    CHAR_HASH: 35,
    /* # */
    CHAR_HYPHEN_MINUS: 45,
    /* - */
    CHAR_LEFT_ANGLE_BRACKET: 60,
    /* < */
    CHAR_LEFT_CURLY_BRACE: 123,
    /* { */
    CHAR_LEFT_SQUARE_BRACKET: 91,
    /* [ */
    CHAR_LINE_FEED: 10,
    /* \n */
    CHAR_NO_BREAK_SPACE: 160,
    /* \u00A0 */
    CHAR_PERCENT: 37,
    /* % */
    CHAR_PLUS: 43,
    /* + */
    CHAR_QUESTION_MARK: 63,
    /* ? */
    CHAR_RIGHT_ANGLE_BRACKET: 62,
    /* > */
    CHAR_RIGHT_CURLY_BRACE: 125,
    /* } */
    CHAR_RIGHT_SQUARE_BRACKET: 93,
    /* ] */
    CHAR_SEMICOLON: 59,
    /* ; */
    CHAR_SINGLE_QUOTE: 39,
    /* ' */
    CHAR_SPACE: 32,
    /*   */
    CHAR_TAB: 9,
    /* \t */
    CHAR_UNDERSCORE: 95,
    /* _ */
    CHAR_VERTICAL_LINE: 124,
    /* | */
    CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
    /* \uFEFF */
    /**
     * Create EXTGLOB_CHARS
     */
    extglobChars(k) {
      return {
        "!": { type: "negate", open: "(?:(?!(?:", close: `))${k.STAR})` },
        "?": { type: "qmark", open: "(?:", close: ")?" },
        "+": { type: "plus", open: "(?:", close: ")+" },
        "*": { type: "star", open: "(?:", close: ")*" },
        "@": { type: "at", open: "(?:", close: ")" }
      };
    },
    /**
     * Create GLOB_CHARS
     */
    globChars(k) {
      return k === !0 ? A : E;
    }
  }, tr;
}
var Co;
function Ei() {
  return Co || (Co = 1, (function(i) {
    const {
      REGEX_BACKSLASH: e,
      REGEX_REMOVE_BACKSLASH: t,
      REGEX_SPECIAL_CHARS: s,
      REGEX_SPECIAL_CHARS_GLOBAL: n
    } = /* @__PURE__ */ yi();
    i.isObject = (r) => r !== null && typeof r == "object" && !Array.isArray(r), i.hasRegexChars = (r) => s.test(r), i.isRegexChar = (r) => r.length === 1 && i.hasRegexChars(r), i.escapeRegex = (r) => r.replace(n, "\\$1"), i.toPosixSlashes = (r) => r.replace(e, "/"), i.isWindows = () => {
      if (typeof navigator < "u" && navigator.platform) {
        const r = navigator.platform.toLowerCase();
        return r === "win32" || r === "windows";
      }
      return typeof process < "u" && process.platform ? process.platform === "win32" : !1;
    }, i.removeBackslashes = (r) => r.replace(t, (a) => a === "\\" ? "" : a), i.escapeLast = (r, a, o) => {
      const l = r.lastIndexOf(a, o);
      return l === -1 ? r : r[l - 1] === "\\" ? i.escapeLast(r, a, l - 1) : `${r.slice(0, l)}\\${r.slice(l)}`;
    }, i.removePrefix = (r, a = {}) => {
      let o = r;
      return o.startsWith("./") && (o = o.slice(2), a.prefix = "./"), o;
    }, i.wrapOutput = (r, a = {}, o = {}) => {
      const l = o.contains ? "" : "^", c = o.contains ? "" : "$";
      let h = `${l}(?:${r})${c}`;
      return a.negated === !0 && (h = `(?:^(?!${h}).*$)`), h;
    }, i.basename = (r, { windows: a } = {}) => {
      const o = r.split(a ? /[\\/]/ : "/"), l = o[o.length - 1];
      return l === "" ? o[o.length - 2] : l;
    };
  })(er)), er;
}
var sr, vo;
function sf() {
  if (vo) return sr;
  vo = 1;
  const i = /* @__PURE__ */ Ei(), {
    CHAR_ASTERISK: e,
    /* * */
    CHAR_AT: t,
    /* @ */
    CHAR_BACKWARD_SLASH: s,
    /* \ */
    CHAR_COMMA: n,
    /* , */
    CHAR_DOT: r,
    /* . */
    CHAR_EXCLAMATION_MARK: a,
    /* ! */
    CHAR_FORWARD_SLASH: o,
    /* / */
    CHAR_LEFT_CURLY_BRACE: l,
    /* { */
    CHAR_LEFT_PARENTHESES: c,
    /* ( */
    CHAR_LEFT_SQUARE_BRACKET: h,
    /* [ */
    CHAR_PLUS: p,
    /* + */
    CHAR_QUESTION_MARK: d,
    /* ? */
    CHAR_RIGHT_CURLY_BRACE: m,
    /* } */
    CHAR_RIGHT_PARENTHESES: f,
    /* ) */
    CHAR_RIGHT_SQUARE_BRACKET: g
    /* ] */
  } = /* @__PURE__ */ yi(), y = (A) => A === o || A === s, b = (A) => {
    A.isPrefix !== !0 && (A.depth = A.isGlobstar ? 1 / 0 : 1);
  };
  return sr = (A, x) => {
    const k = x || {}, F = A.length - 1, T = k.parts === !0 || k.scanToEnd === !0, U = [], B = [], w = [];
    let j = A, z = -1, le = 0, ne = 0, te = !1, re = !1, Q = !1, he = !1, fe = !1, I = !1, ce = !1, pe = !1, tt = !1, S = !1, N = 0, Xe, _, se = { value: "", depth: 0, isGlob: !1 };
    const ve = () => z >= F, Le = () => j.charCodeAt(z + 1), Ne = () => (Xe = _, j.charCodeAt(++z));
    for (; z < F; ) {
      _ = Ne();
      let Me;
      if (_ === s) {
        ce = se.backslashes = !0, _ = Ne(), _ === l && (I = !0);
        continue;
      }
      if (I === !0 || _ === l) {
        for (N++; ve() !== !0 && (_ = Ne()); ) {
          if (_ === s) {
            ce = se.backslashes = !0, Ne();
            continue;
          }
          if (_ === l) {
            N++;
            continue;
          }
          if (I !== !0 && _ === r && (_ = Ne()) === r) {
            if (te = se.isBrace = !0, Q = se.isGlob = !0, S = !0, T === !0)
              continue;
            break;
          }
          if (I !== !0 && _ === n) {
            if (te = se.isBrace = !0, Q = se.isGlob = !0, S = !0, T === !0)
              continue;
            break;
          }
          if (_ === m && (N--, N === 0)) {
            I = !1, te = se.isBrace = !0, S = !0;
            break;
          }
        }
        if (T === !0)
          continue;
        break;
      }
      if (_ === o) {
        if (U.push(z), B.push(se), se = { value: "", depth: 0, isGlob: !1 }, S === !0) continue;
        if (Xe === r && z === le + 1) {
          le += 2;
          continue;
        }
        ne = z + 1;
        continue;
      }
      if (k.noext !== !0 && (_ === p || _ === t || _ === e || _ === d || _ === a) === !0 && Le() === c) {
        if (Q = se.isGlob = !0, he = se.isExtglob = !0, S = !0, _ === a && z === le && (tt = !0), T === !0) {
          for (; ve() !== !0 && (_ = Ne()); ) {
            if (_ === s) {
              ce = se.backslashes = !0, _ = Ne();
              continue;
            }
            if (_ === f) {
              Q = se.isGlob = !0, S = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (_ === e) {
        if (Xe === e && (fe = se.isGlobstar = !0), Q = se.isGlob = !0, S = !0, T === !0)
          continue;
        break;
      }
      if (_ === d) {
        if (Q = se.isGlob = !0, S = !0, T === !0)
          continue;
        break;
      }
      if (_ === h) {
        for (; ve() !== !0 && (Me = Ne()); ) {
          if (Me === s) {
            ce = se.backslashes = !0, Ne();
            continue;
          }
          if (Me === g) {
            re = se.isBracket = !0, Q = se.isGlob = !0, S = !0;
            break;
          }
        }
        if (T === !0)
          continue;
        break;
      }
      if (k.nonegate !== !0 && _ === a && z === le) {
        pe = se.negated = !0, le++;
        continue;
      }
      if (k.noparen !== !0 && _ === c) {
        if (Q = se.isGlob = !0, T === !0) {
          for (; ve() !== !0 && (_ = Ne()); ) {
            if (_ === c) {
              ce = se.backslashes = !0, _ = Ne();
              continue;
            }
            if (_ === f) {
              S = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (Q === !0) {
        if (S = !0, T === !0)
          continue;
        break;
      }
    }
    k.noext === !0 && (he = !1, Q = !1);
    let Pe = j, st = "", Be = "";
    le > 0 && (st = j.slice(0, le), j = j.slice(le), ne -= le), Pe && Q === !0 && ne > 0 ? (Pe = j.slice(0, ne), Be = j.slice(ne)) : Q === !0 ? (Pe = "", Be = j) : Pe = j, Pe && Pe !== "" && Pe !== "/" && Pe !== j && y(Pe.charCodeAt(Pe.length - 1)) && (Pe = Pe.slice(0, -1)), k.unescape === !0 && (Be && (Be = i.removeBackslashes(Be)), Pe && ce === !0 && (Pe = i.removeBackslashes(Pe)));
    const H = {
      prefix: st,
      input: A,
      start: le,
      base: Pe,
      glob: Be,
      isBrace: te,
      isBracket: re,
      isGlob: Q,
      isExtglob: he,
      isGlobstar: fe,
      negated: pe,
      negatedExtglob: tt
    };
    if (k.tokens === !0 && (H.maxDepth = 0, y(_) || B.push(se), H.tokens = B), k.parts === !0 || k.tokens === !0) {
      let Me;
      for (let ke = 0; ke < U.length; ke++) {
        const M = Me ? Me + 1 : le, ie = U[ke], C = A.slice(M, ie);
        k.tokens && (ke === 0 && le !== 0 ? (B[ke].isPrefix = !0, B[ke].value = st) : B[ke].value = C, b(B[ke]), H.maxDepth += B[ke].depth), (ke !== 0 || C !== "") && w.push(C), Me = ie;
      }
      if (Me && Me + 1 < A.length) {
        const ke = A.slice(Me + 1);
        w.push(ke), k.tokens && (B[B.length - 1].value = ke, b(B[B.length - 1]), H.maxDepth += B[B.length - 1].depth);
      }
      H.slashes = U, H.parts = w;
    }
    return H;
  }, sr;
}
var nr, ko;
function nf() {
  if (ko) return nr;
  ko = 1;
  const i = /* @__PURE__ */ yi(), e = /* @__PURE__ */ Ei(), {
    MAX_LENGTH: t,
    POSIX_REGEX_SOURCE: s,
    REGEX_NON_SPECIAL_CHARS: n,
    REGEX_SPECIAL_CHARS_BACKREF: r,
    REPLACEMENTS: a
  } = i, o = (h, p) => typeof p.expandRange == "function" ? p.expandRange(...h, p) : (h.sort(), `[${h.join("-")}]`), l = (h, p) => `Missing ${h}: "${p}" - use "\\\\${p}" to match literal characters`, c = (h, p) => {
    if (typeof h != "string")
      throw new TypeError("Expected a string");
    h = a[h] || h;
    const d = { ...p }, m = typeof d.maxLength == "number" ? Math.min(t, d.maxLength) : t;
    let f = h.length;
    if (f > m)
      throw new SyntaxError(`Input length: ${f}, exceeds maximum allowed length: ${m}`);
    const g = { type: "bos", value: "", output: d.prepend || "" }, y = [g], b = d.capture ? "" : "?:", E = i.globChars(d.windows), A = i.extglobChars(E), {
      DOT_LITERAL: x,
      PLUS_LITERAL: k,
      SLASH_LITERAL: F,
      ONE_CHAR: T,
      DOTS_SLASH: U,
      NO_DOT: B,
      NO_DOT_SLASH: w,
      NO_DOTS_SLASH: j,
      QMARK: z,
      QMARK_NO_DOT: le,
      STAR: ne,
      START_ANCHOR: te
    } = E, re = (M) => `(${b}(?:(?!${te}${M.dot ? U : x}).)*?)`, Q = d.dot ? "" : B, he = d.dot ? z : le;
    let fe = d.bash === !0 ? re(d) : ne;
    d.capture && (fe = `(${fe})`), typeof d.noext == "boolean" && (d.noextglob = d.noext);
    const I = {
      input: h,
      index: -1,
      start: 0,
      dot: d.dot === !0,
      consumed: "",
      output: "",
      prefix: "",
      backtrack: !1,
      negated: !1,
      brackets: 0,
      braces: 0,
      parens: 0,
      quotes: 0,
      globstar: !1,
      tokens: y
    };
    h = e.removePrefix(h, I), f = h.length;
    const ce = [], pe = [], tt = [];
    let S = g, N;
    const Xe = () => I.index === f - 1, _ = I.peek = (M = 1) => h[I.index + M], se = I.advance = () => h[++I.index] || "", ve = () => h.slice(I.index + 1), Le = (M = "", ie = 0) => {
      I.consumed += M, I.index += ie;
    }, Ne = (M) => {
      I.output += M.output != null ? M.output : M.value, Le(M.value);
    }, Pe = () => {
      let M = 1;
      for (; _() === "!" && (_(2) !== "(" || _(3) === "?"); )
        se(), I.start++, M++;
      return M % 2 === 0 ? !1 : (I.negated = !0, I.start++, !0);
    }, st = (M) => {
      I[M]++, tt.push(M);
    }, Be = (M) => {
      I[M]--, tt.pop();
    }, H = (M) => {
      if (S.type === "globstar") {
        const ie = I.braces > 0 && (M.type === "comma" || M.type === "brace"), C = M.extglob === !0 || ce.length && (M.type === "pipe" || M.type === "paren");
        M.type !== "slash" && M.type !== "paren" && !ie && !C && (I.output = I.output.slice(0, -S.output.length), S.type = "star", S.value = "*", S.output = fe, I.output += S.output);
      }
      if (ce.length && M.type !== "paren" && (ce[ce.length - 1].inner += M.value), (M.value || M.output) && Ne(M), S && S.type === "text" && M.type === "text") {
        S.output = (S.output || S.value) + M.value, S.value += M.value;
        return;
      }
      M.prev = S, y.push(M), S = M;
    }, Me = (M, ie) => {
      const C = { ...A[ie], conditions: 1, inner: "" };
      C.prev = S, C.parens = I.parens, C.output = I.output;
      const q = (d.capture ? "(" : "") + C.open;
      st("parens"), H({ type: M, value: ie, output: I.output ? "" : T }), H({ type: "paren", extglob: !0, value: se(), output: q }), ce.push(C);
    }, ke = (M) => {
      let ie = M.close + (d.capture ? ")" : ""), C;
      if (M.type === "negate") {
        let q = fe;
        if (M.inner && M.inner.length > 1 && M.inner.includes("/") && (q = re(d)), (q !== fe || Xe() || /^\)+$/.test(ve())) && (ie = M.close = `)$))${q}`), M.inner.includes("*") && (C = ve()) && /^\.[^\\/.]+$/.test(C)) {
          const ye = c(C, { ...p, fastpaths: !1 }).output;
          ie = M.close = `)${ye})${q})`;
        }
        M.prev.type === "bos" && (I.negatedExtglob = !0);
      }
      H({ type: "paren", extglob: !0, value: N, output: ie }), Be("parens");
    };
    if (d.fastpaths !== !1 && !/(^[*!]|[/()[\]{}"])/.test(h)) {
      let M = !1, ie = h.replace(r, (C, q, ye, Fe, $e, ji) => Fe === "\\" ? (M = !0, C) : Fe === "?" ? q ? q + Fe + ($e ? z.repeat($e.length) : "") : ji === 0 ? he + ($e ? z.repeat($e.length) : "") : z.repeat(ye.length) : Fe === "." ? x.repeat(ye.length) : Fe === "*" ? q ? q + Fe + ($e ? fe : "") : fe : q ? C : `\\${C}`);
      return M === !0 && (d.unescape === !0 ? ie = ie.replace(/\\/g, "") : ie = ie.replace(/\\+/g, (C) => C.length % 2 === 0 ? "\\\\" : C ? "\\" : "")), ie === h && d.contains === !0 ? (I.output = h, I) : (I.output = e.wrapOutput(ie, I, p), I);
    }
    for (; !Xe(); ) {
      if (N = se(), N === "\0")
        continue;
      if (N === "\\") {
        const C = _();
        if (C === "/" && d.bash !== !0 || C === "." || C === ";")
          continue;
        if (!C) {
          N += "\\", H({ type: "text", value: N });
          continue;
        }
        const q = /^\\+/.exec(ve());
        let ye = 0;
        if (q && q[0].length > 2 && (ye = q[0].length, I.index += ye, ye % 2 !== 0 && (N += "\\")), d.unescape === !0 ? N = se() : N += se(), I.brackets === 0) {
          H({ type: "text", value: N });
          continue;
        }
      }
      if (I.brackets > 0 && (N !== "]" || S.value === "[" || S.value === "[^")) {
        if (d.posix !== !1 && N === ":") {
          const C = S.value.slice(1);
          if (C.includes("[") && (S.posix = !0, C.includes(":"))) {
            const q = S.value.lastIndexOf("["), ye = S.value.slice(0, q), Fe = S.value.slice(q + 2), $e = s[Fe];
            if ($e) {
              S.value = ye + $e, I.backtrack = !0, se(), !g.output && y.indexOf(S) === 1 && (g.output = T);
              continue;
            }
          }
        }
        (N === "[" && _() !== ":" || N === "-" && _() === "]") && (N = `\\${N}`), N === "]" && (S.value === "[" || S.value === "[^") && (N = `\\${N}`), d.posix === !0 && N === "!" && S.value === "[" && (N = "^"), S.value += N, Ne({ value: N });
        continue;
      }
      if (I.quotes === 1 && N !== '"') {
        N = e.escapeRegex(N), S.value += N, Ne({ value: N });
        continue;
      }
      if (N === '"') {
        I.quotes = I.quotes === 1 ? 0 : 1, d.keepQuotes === !0 && H({ type: "text", value: N });
        continue;
      }
      if (N === "(") {
        st("parens"), H({ type: "paren", value: N });
        continue;
      }
      if (N === ")") {
        if (I.parens === 0 && d.strictBrackets === !0)
          throw new SyntaxError(l("opening", "("));
        const C = ce[ce.length - 1];
        if (C && I.parens === C.parens + 1) {
          ke(ce.pop());
          continue;
        }
        H({ type: "paren", value: N, output: I.parens ? ")" : "\\)" }), Be("parens");
        continue;
      }
      if (N === "[") {
        if (d.nobracket === !0 || !ve().includes("]")) {
          if (d.nobracket !== !0 && d.strictBrackets === !0)
            throw new SyntaxError(l("closing", "]"));
          N = `\\${N}`;
        } else
          st("brackets");
        H({ type: "bracket", value: N });
        continue;
      }
      if (N === "]") {
        if (d.nobracket === !0 || S && S.type === "bracket" && S.value.length === 1) {
          H({ type: "text", value: N, output: `\\${N}` });
          continue;
        }
        if (I.brackets === 0) {
          if (d.strictBrackets === !0)
            throw new SyntaxError(l("opening", "["));
          H({ type: "text", value: N, output: `\\${N}` });
          continue;
        }
        Be("brackets");
        const C = S.value.slice(1);
        if (S.posix !== !0 && C[0] === "^" && !C.includes("/") && (N = `/${N}`), S.value += N, Ne({ value: N }), d.literalBrackets === !1 || e.hasRegexChars(C))
          continue;
        const q = e.escapeRegex(S.value);
        if (I.output = I.output.slice(0, -S.value.length), d.literalBrackets === !0) {
          I.output += q, S.value = q;
          continue;
        }
        S.value = `(${b}${q}|${S.value})`, I.output += S.value;
        continue;
      }
      if (N === "{" && d.nobrace !== !0) {
        st("braces");
        const C = {
          type: "brace",
          value: N,
          output: "(",
          outputIndex: I.output.length,
          tokensIndex: I.tokens.length
        };
        pe.push(C), H(C);
        continue;
      }
      if (N === "}") {
        const C = pe[pe.length - 1];
        if (d.nobrace === !0 || !C) {
          H({ type: "text", value: N, output: N });
          continue;
        }
        let q = ")";
        if (C.dots === !0) {
          const ye = y.slice(), Fe = [];
          for (let $e = ye.length - 1; $e >= 0 && (y.pop(), ye[$e].type !== "brace"); $e--)
            ye[$e].type !== "dots" && Fe.unshift(ye[$e].value);
          q = o(Fe, d), I.backtrack = !0;
        }
        if (C.comma !== !0 && C.dots !== !0) {
          const ye = I.output.slice(0, C.outputIndex), Fe = I.tokens.slice(C.tokensIndex);
          C.value = C.output = "\\{", N = q = "\\}", I.output = ye;
          for (const $e of Fe)
            I.output += $e.output || $e.value;
        }
        H({ type: "brace", value: N, output: q }), Be("braces"), pe.pop();
        continue;
      }
      if (N === "|") {
        ce.length > 0 && ce[ce.length - 1].conditions++, H({ type: "text", value: N });
        continue;
      }
      if (N === ",") {
        let C = N;
        const q = pe[pe.length - 1];
        q && tt[tt.length - 1] === "braces" && (q.comma = !0, C = "|"), H({ type: "comma", value: N, output: C });
        continue;
      }
      if (N === "/") {
        if (S.type === "dot" && I.index === I.start + 1) {
          I.start = I.index + 1, I.consumed = "", I.output = "", y.pop(), S = g;
          continue;
        }
        H({ type: "slash", value: N, output: F });
        continue;
      }
      if (N === ".") {
        if (I.braces > 0 && S.type === "dot") {
          S.value === "." && (S.output = x);
          const C = pe[pe.length - 1];
          S.type = "dots", S.output += N, S.value += N, C.dots = !0;
          continue;
        }
        if (I.braces + I.parens === 0 && S.type !== "bos" && S.type !== "slash") {
          H({ type: "text", value: N, output: x });
          continue;
        }
        H({ type: "dot", value: N, output: x });
        continue;
      }
      if (N === "?") {
        if (!(S && S.value === "(") && d.noextglob !== !0 && _() === "(" && _(2) !== "?") {
          Me("qmark", N);
          continue;
        }
        if (S && S.type === "paren") {
          const q = _();
          let ye = N;
          (S.value === "(" && !/[!=<:]/.test(q) || q === "<" && !/<([!=]|\w+>)/.test(ve())) && (ye = `\\${N}`), H({ type: "text", value: N, output: ye });
          continue;
        }
        if (d.dot !== !0 && (S.type === "slash" || S.type === "bos")) {
          H({ type: "qmark", value: N, output: le });
          continue;
        }
        H({ type: "qmark", value: N, output: z });
        continue;
      }
      if (N === "!") {
        if (d.noextglob !== !0 && _() === "(" && (_(2) !== "?" || !/[!=<:]/.test(_(3)))) {
          Me("negate", N);
          continue;
        }
        if (d.nonegate !== !0 && I.index === 0) {
          Pe();
          continue;
        }
      }
      if (N === "+") {
        if (d.noextglob !== !0 && _() === "(" && _(2) !== "?") {
          Me("plus", N);
          continue;
        }
        if (S && S.value === "(" || d.regex === !1) {
          H({ type: "plus", value: N, output: k });
          continue;
        }
        if (S && (S.type === "bracket" || S.type === "paren" || S.type === "brace") || I.parens > 0) {
          H({ type: "plus", value: N });
          continue;
        }
        H({ type: "plus", value: k });
        continue;
      }
      if (N === "@") {
        if (d.noextglob !== !0 && _() === "(" && _(2) !== "?") {
          H({ type: "at", extglob: !0, value: N, output: "" });
          continue;
        }
        H({ type: "text", value: N });
        continue;
      }
      if (N !== "*") {
        (N === "$" || N === "^") && (N = `\\${N}`);
        const C = n.exec(ve());
        C && (N += C[0], I.index += C[0].length), H({ type: "text", value: N });
        continue;
      }
      if (S && (S.type === "globstar" || S.star === !0)) {
        S.type = "star", S.star = !0, S.value += N, S.output = fe, I.backtrack = !0, I.globstar = !0, Le(N);
        continue;
      }
      let M = ve();
      if (d.noextglob !== !0 && /^\([^?]/.test(M)) {
        Me("star", N);
        continue;
      }
      if (S.type === "star") {
        if (d.noglobstar === !0) {
          Le(N);
          continue;
        }
        const C = S.prev, q = C.prev, ye = C.type === "slash" || C.type === "bos", Fe = q && (q.type === "star" || q.type === "globstar");
        if (d.bash === !0 && (!ye || M[0] && M[0] !== "/")) {
          H({ type: "star", value: N, output: "" });
          continue;
        }
        const $e = I.braces > 0 && (C.type === "comma" || C.type === "brace"), ji = ce.length && (C.type === "pipe" || C.type === "paren");
        if (!ye && C.type !== "paren" && !$e && !ji) {
          H({ type: "star", value: N, output: "" });
          continue;
        }
        for (; M.slice(0, 3) === "/**"; ) {
          const cn = h[I.index + 4];
          if (cn && cn !== "/")
            break;
          M = M.slice(3), Le("/**", 3);
        }
        if (C.type === "bos" && Xe()) {
          S.type = "globstar", S.value += N, S.output = re(d), I.output = S.output, I.globstar = !0, Le(N);
          continue;
        }
        if (C.type === "slash" && C.prev.type !== "bos" && !Fe && Xe()) {
          I.output = I.output.slice(0, -(C.output + S.output).length), C.output = `(?:${C.output}`, S.type = "globstar", S.output = re(d) + (d.strictSlashes ? ")" : "|$)"), S.value += N, I.globstar = !0, I.output += C.output + S.output, Le(N);
          continue;
        }
        if (C.type === "slash" && C.prev.type !== "bos" && M[0] === "/") {
          const cn = M[1] !== void 0 ? "|$" : "";
          I.output = I.output.slice(0, -(C.output + S.output).length), C.output = `(?:${C.output}`, S.type = "globstar", S.output = `${re(d)}${F}|${F}${cn})`, S.value += N, I.output += C.output + S.output, I.globstar = !0, Le(N + se()), H({ type: "slash", value: "/", output: "" });
          continue;
        }
        if (C.type === "bos" && M[0] === "/") {
          S.type = "globstar", S.value += N, S.output = `(?:^|${F}|${re(d)}${F})`, I.output = S.output, I.globstar = !0, Le(N + se()), H({ type: "slash", value: "/", output: "" });
          continue;
        }
        I.output = I.output.slice(0, -S.output.length), S.type = "globstar", S.output = re(d), S.value += N, I.output += S.output, I.globstar = !0, Le(N);
        continue;
      }
      const ie = { type: "star", value: N, output: fe };
      if (d.bash === !0) {
        ie.output = ".*?", (S.type === "bos" || S.type === "slash") && (ie.output = Q + ie.output), H(ie);
        continue;
      }
      if (S && (S.type === "bracket" || S.type === "paren") && d.regex === !0) {
        ie.output = N, H(ie);
        continue;
      }
      (I.index === I.start || S.type === "slash" || S.type === "dot") && (S.type === "dot" ? (I.output += w, S.output += w) : d.dot === !0 ? (I.output += j, S.output += j) : (I.output += Q, S.output += Q), _() !== "*" && (I.output += T, S.output += T)), H(ie);
    }
    for (; I.brackets > 0; ) {
      if (d.strictBrackets === !0) throw new SyntaxError(l("closing", "]"));
      I.output = e.escapeLast(I.output, "["), Be("brackets");
    }
    for (; I.parens > 0; ) {
      if (d.strictBrackets === !0) throw new SyntaxError(l("closing", ")"));
      I.output = e.escapeLast(I.output, "("), Be("parens");
    }
    for (; I.braces > 0; ) {
      if (d.strictBrackets === !0) throw new SyntaxError(l("closing", "}"));
      I.output = e.escapeLast(I.output, "{"), Be("braces");
    }
    if (d.strictSlashes !== !0 && (S.type === "star" || S.type === "bracket") && H({ type: "maybe_slash", value: "", output: `${F}?` }), I.backtrack === !0) {
      I.output = "";
      for (const M of I.tokens)
        I.output += M.output != null ? M.output : M.value, M.suffix && (I.output += M.suffix);
    }
    return I;
  };
  return c.fastpaths = (h, p) => {
    const d = { ...p }, m = typeof d.maxLength == "number" ? Math.min(t, d.maxLength) : t, f = h.length;
    if (f > m)
      throw new SyntaxError(`Input length: ${f}, exceeds maximum allowed length: ${m}`);
    h = a[h] || h;
    const {
      DOT_LITERAL: g,
      SLASH_LITERAL: y,
      ONE_CHAR: b,
      DOTS_SLASH: E,
      NO_DOT: A,
      NO_DOTS: x,
      NO_DOTS_SLASH: k,
      STAR: F,
      START_ANCHOR: T
    } = i.globChars(d.windows), U = d.dot ? x : A, B = d.dot ? k : A, w = d.capture ? "" : "?:", j = { negated: !1, prefix: "" };
    let z = d.bash === !0 ? ".*?" : F;
    d.capture && (z = `(${z})`);
    const le = (Q) => Q.noglobstar === !0 ? z : `(${w}(?:(?!${T}${Q.dot ? E : g}).)*?)`, ne = (Q) => {
      switch (Q) {
        case "*":
          return `${U}${b}${z}`;
        case ".*":
          return `${g}${b}${z}`;
        case "*.*":
          return `${U}${z}${g}${b}${z}`;
        case "*/*":
          return `${U}${z}${y}${b}${B}${z}`;
        case "**":
          return U + le(d);
        case "**/*":
          return `(?:${U}${le(d)}${y})?${B}${b}${z}`;
        case "**/*.*":
          return `(?:${U}${le(d)}${y})?${B}${z}${g}${b}${z}`;
        case "**/.*":
          return `(?:${U}${le(d)}${y})?${g}${b}${z}`;
        default: {
          const he = /^(.*?)\.(\w+)$/.exec(Q);
          if (!he) return;
          const fe = ne(he[1]);
          return fe ? fe + g + he[2] : void 0;
        }
      }
    }, te = e.removePrefix(h, j);
    let re = ne(te);
    return re && d.strictSlashes !== !0 && (re += `${y}?`), re;
  }, nr = c, nr;
}
var ir, Ro;
function rf() {
  if (Ro) return ir;
  Ro = 1;
  const i = /* @__PURE__ */ sf(), e = /* @__PURE__ */ nf(), t = /* @__PURE__ */ Ei(), s = /* @__PURE__ */ yi(), n = (a) => a && typeof a == "object" && !Array.isArray(a), r = (a, o, l = !1) => {
    if (Array.isArray(a)) {
      const y = a.map((E) => r(E, o, l));
      return (E) => {
        for (const A of y) {
          const x = A(E);
          if (x) return x;
        }
        return !1;
      };
    }
    const c = n(a) && a.tokens && a.input;
    if (a === "" || typeof a != "string" && !c)
      throw new TypeError("Expected pattern to be a non-empty string");
    const h = o || {}, p = h.windows, d = c ? r.compileRe(a, o) : r.makeRe(a, o, !1, !0), m = d.state;
    delete d.state;
    let f = () => !1;
    if (h.ignore) {
      const y = { ...o, ignore: null, onMatch: null, onResult: null };
      f = r(h.ignore, y, l);
    }
    const g = (y, b = !1) => {
      const { isMatch: E, match: A, output: x } = r.test(y, d, o, { glob: a, posix: p }), k = { glob: a, state: m, regex: d, posix: p, input: y, output: x, match: A, isMatch: E };
      return typeof h.onResult == "function" && h.onResult(k), E === !1 ? (k.isMatch = !1, b ? k : !1) : f(y) ? (typeof h.onIgnore == "function" && h.onIgnore(k), k.isMatch = !1, b ? k : !1) : (typeof h.onMatch == "function" && h.onMatch(k), b ? k : !0);
    };
    return l && (g.state = m), g;
  };
  return r.test = (a, o, l, { glob: c, posix: h } = {}) => {
    if (typeof a != "string")
      throw new TypeError("Expected input to be a string");
    if (a === "")
      return { isMatch: !1, output: "" };
    const p = l || {}, d = p.format || (h ? t.toPosixSlashes : null);
    let m = a === c, f = m && d ? d(a) : a;
    return m === !1 && (f = d ? d(a) : a, m = f === c), (m === !1 || p.capture === !0) && (p.matchBase === !0 || p.basename === !0 ? m = r.matchBase(a, o, l, h) : m = o.exec(f)), { isMatch: !!m, match: m, output: f };
  }, r.matchBase = (a, o, l) => (o instanceof RegExp ? o : r.makeRe(o, l)).test(t.basename(a)), r.isMatch = (a, o, l) => r(o, l)(a), r.parse = (a, o) => Array.isArray(a) ? a.map((l) => r.parse(l, o)) : e(a, { ...o, fastpaths: !1 }), r.scan = (a, o) => i(a, o), r.compileRe = (a, o, l = !1, c = !1) => {
    if (l === !0)
      return a.output;
    const h = o || {}, p = h.contains ? "" : "^", d = h.contains ? "" : "$";
    let m = `${p}(?:${a.output})${d}`;
    a && a.negated === !0 && (m = `^(?!${m}).*$`);
    const f = r.toRegex(m, o);
    return c === !0 && (f.state = a), f;
  }, r.makeRe = (a, o = {}, l = !1, c = !1) => {
    if (!a || typeof a != "string")
      throw new TypeError("Expected a non-empty string");
    let h = { negated: !1, fastpaths: !0 };
    return o.fastpaths !== !1 && (a[0] === "." || a[0] === "*") && (h.output = e.fastpaths(a, o)), h.output || (h = e(a, o)), r.compileRe(h, o, l, c);
  }, r.toRegex = (a, o) => {
    try {
      const l = o || {};
      return new RegExp(a, l.flags || (l.nocase ? "i" : ""));
    } catch (l) {
      if (o && o.debug === !0) throw l;
      return /$^/;
    }
  }, r.constants = s, ir = r, ir;
}
var rr, Do;
function af() {
  if (Do) return rr;
  Do = 1;
  const i = /* @__PURE__ */ rf(), e = /* @__PURE__ */ Ei();
  function t(s, n, r = !1) {
    return n && (n.windows === null || n.windows === void 0) && (n = { ...n, windows: e.isWindows() }), i(s, n, r);
  }
  return Object.assign(t, i), rr = t, rr;
}
var of = /* @__PURE__ */ af();
const Ic = /* @__PURE__ */ Pc(of), ts = {
  ArrayPattern(i, e) {
    for (const t of e.elements)
      t && ts[t.type](i, t);
  },
  AssignmentPattern(i, e) {
    ts[e.left.type](i, e.left);
  },
  Identifier(i, e) {
    i.push(e.name);
  },
  MemberExpression() {
  },
  ObjectPattern(i, e) {
    for (const t of e.properties)
      t.type === "RestElement" ? ts.RestElement(i, t) : ts[t.value.type](i, t.value);
  },
  RestElement(i, e) {
    ts[e.argument.type](i, e.argument);
  }
}, lf = function(e) {
  const t = [];
  return ts[e.type](t, e), t;
};
function cf(i) {
  return Array.isArray(i);
}
function Oo(i) {
  return cf(i) ? i : i == null ? [] : [i];
}
const uf = new RegExp(`\\${dd.sep}`, "g"), wn = function(e) {
  return e.replace(uf, Tl.sep);
};
function hf(i, e) {
  if (ud(i) || i.startsWith("**"))
    return wn(i);
  const t = wn(hd("")).replace(/[-^$*+?.()|[\]{}]/g, "\\$&");
  return Tl.join(t, wn(i));
}
const Qy = function(e, t, s) {
  const n = (o) => o instanceof RegExp ? o : {
    test: (l) => {
      const c = hf(o);
      return Ic(c, { dot: !0 })(l);
    }
  }, r = Oo(e).map(n), a = Oo(t).map(n);
  return !r.length && !a.length ? (o) => typeof o == "string" && !o.includes("\0") : function(l) {
    if (typeof l != "string" || l.includes("\0"))
      return !1;
    const c = wn(l);
    for (let h = 0; h < a.length; ++h) {
      const p = a[h];
      if (p instanceof RegExp && (p.lastIndex = 0), p.test(c))
        return !1;
    }
    for (let h = 0; h < r.length; ++h) {
      const p = r[h];
      if (p instanceof RegExp && (p.lastIndex = 0), p.test(c))
        return !0;
    }
    return !r.length;
  };
}, df = "break case class catch const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield enum await implements package protected static interface private public", pf = "arguments Infinity NaN undefined null true false eval uneval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape Object Function Boolean Symbol Error EvalError InternalError RangeError ReferenceError SyntaxError TypeError URIError Number Math Date String RegExp Array Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array Float32Array Float64Array Map Set WeakMap WeakSet SIMD ArrayBuffer DataView JSON Promise Generator GeneratorFunction Reflect Proxy Intl", ff = new Set(`${df} ${pf}`.split(" "));
ff.add("");
class bi extends v {
  addExportedVariables(e, t) {
    for (const s of this.elements)
      s?.addExportedVariables(e, t);
  }
  declare(e, t, s) {
    const n = [], r = fn(t);
    for (const a of this.elements)
      a !== null && n.push(...a.declare(e, r, s));
    return n;
  }
  deoptimizeAssignment(e, t) {
    const s = fn(e);
    for (const n of this.elements)
      n?.deoptimizeAssignment(s, t);
  }
  // Patterns can only be deoptimized at the empty path at the moment
  deoptimizePath() {
    for (const e of this.elements)
      e?.deoptimizePath(D);
  }
  hasEffectsWhenDestructuring(e, t, s) {
    const n = fn(t);
    for (const r of this.elements)
      if (r?.hasEffectsWhenDestructuring(e, n, s))
        return !0;
    return !1;
  }
  // Patterns are only checked at the empty path at the moment
  hasEffectsOnInteractionAtPath(e, t, s) {
    for (const n of this.elements)
      if (n?.hasEffectsOnInteractionAtPath(D, t, s))
        return !0;
    return !1;
  }
  includeDestructuredIfNecessary(e, t, s) {
    let n = !1;
    const r = fn(t);
    for (const a of [...this.elements].reverse())
      a && (n && !a.included && a.includeNode(e), n = a.includeDestructuredIfNecessary(e, r, s) || n);
    return !this.included && n && this.includeNode(e), this.included;
  }
  render(e, t) {
    let s = this.start + 1;
    for (const n of this.elements)
      if (n)
        if (n.included)
          n.render(e, t), s = n.end;
        else {
          e.remove(s, this.end - 1);
          break;
        }
  }
  markDeclarationReached() {
    for (const e of this.elements)
      e?.markDeclarationReached();
  }
}
bi.prototype.includeNode = Ce;
const fn = (i) => i.at(-1) === W ? i : [...i, cs];
class ua extends Xs {
  constructor() {
    super(...arguments), this.objectEntity = null;
  }
  get expression() {
    return Z(
      this.flags,
      8388608
      /* Flag.expression */
    );
  }
  set expression(e) {
    this.flags = ee(this.flags, 8388608, e);
  }
  createScope(e) {
    this.scope = new ac(e, !1);
  }
  hasEffects() {
    return !1;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    if (this.annotationNoSideEffects && e.length === 0 && t.type === X)
      return !1;
    if (super.hasEffectsOnInteractionAtPath(e, t, s))
      return !0;
    if (t.type === X) {
      const { ignore: n, brokenFlow: r } = s;
      if (s.ignore = {
        breaks: !1,
        continues: !1,
        labels: /* @__PURE__ */ new Set(),
        returnYield: !0,
        this: !1
      }, this.body.hasEffects(s))
        return !0;
      s.ignore = n, s.brokenFlow = r;
    }
    return !1;
  }
  onlyFunctionCallUsed() {
    return this.parent.type === js && this.parent.callee === this || super.onlyFunctionCallUsed();
  }
  include(e, t) {
    super.include(e, t);
    for (const s of this.params)
      s instanceof ae || s.include(e, t);
  }
  includeNode(e) {
    this.included = !0, this.body.includePath(O, e);
    for (const t of this.params)
      t instanceof ae || t.includePath(O, e);
  }
  getObjectEntity() {
    return this.objectEntity !== null ? this.objectEntity : this.objectEntity = new Ke([], bt);
  }
}
class As extends v {
  addExportedVariables(e, t) {
    for (const s of this.properties)
      s.type === Nl ? s.value.addExportedVariables(e, t) : s.argument.addExportedVariables(e, t);
  }
  declare(e, t, s) {
    const n = [];
    for (const r of this.properties)
      n.push(...r.declare(e, t, s));
    return n;
  }
  deoptimizeAssignment(e, t) {
    for (const s of this.properties)
      s.deoptimizeAssignment(e, t);
  }
  deoptimizePath(e) {
    if (e.length === 0)
      for (const t of this.properties)
        t.deoptimizePath(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    for (const n of this.properties)
      if (n.hasEffectsOnInteractionAtPath(D, t, s))
        return !0;
    return !1;
  }
  hasEffectsWhenDestructuring(e, t, s) {
    for (const n of this.properties)
      if (n.hasEffectsWhenDestructuring(e, t, s))
        return !0;
    return !1;
  }
  includeDestructuredIfNecessary(e, t, s) {
    if (!this.properties.length)
      return this.included;
    const n = this.properties.at(-1);
    let r = n.includeDestructuredIfNecessary(e, t, s);
    const a = n.type === dh;
    for (const o of this.properties.slice(0, -1))
      a && r && !o.included && o.includeNode(e), r = o.includeDestructuredIfNecessary(e, t, s) || r;
    return !this.included && r && this.includeNode(e), this.included;
  }
  markDeclarationReached() {
    for (const e of this.properties)
      e.markDeclarationReached();
  }
  render(e, t) {
    if (this.properties.length > 0) {
      const s = Yn(this.properties, e, this.start + 1, this.end - 1);
      let n = null;
      for (const { node: r, separator: a, start: o, end: l } of s) {
        if (!r.included) {
          ys(r, e, o, l);
          continue;
        }
        n = a, r.render(e, t);
      }
      n && e.remove(n, this.end - 1);
    }
  }
}
As.prototype.includeNode = oe;
As.prototype.applyDeoptimizations = Y;
class Nc extends v {
  constructor() {
    super(...arguments), this.isConstReassignment = !1;
  }
  hasEffects(e) {
    const { deoptimized: t, isConstReassignment: s, left: n, operator: r, right: a } = this;
    return t || this.applyDeoptimizations(), s || a.hasEffects(e) || n.hasEffectsAsAssignmentTarget(e, r !== "=") || this.left.hasEffectsWhenDestructuring?.(e, D, a);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === Ue && this.left.included || this.right.hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    const { deoptimized: s, isConstReassignment: n, left: r, right: a, operator: o } = this;
    s || this.applyDeoptimizations(), this.included || this.includeNode(e);
    const l = Es();
    (t || n || o !== "=" || r.included || r.hasEffectsAsAssignmentTarget(l, !1) || r.hasEffectsWhenDestructuring?.(l, D, a)) && r.includeAsAssignmentTarget(e, t, o !== "="), a.include(e, t);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.right.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.left instanceof ae && this.scope.variables.get(this.left.name)?.kind === "const" && (this.isConstReassignment = !0, this.scope.context.log(V, gh(), this.left.start)), this.left.setAssignedValue(this.right);
  }
  render(e, t, { preventASI: s, renderedParentType: n, renderedSurroundingElement: r } = Oe) {
    const { left: a, right: o, start: l, end: c, parent: h } = this;
    if (a.included)
      a.render(e, t), o.render(e, t);
    else {
      const p = Pt(e.original, we(e.original, "=", a.end) + 1);
      e.remove(l, p), s && Qn(e, p, o.start), o.render(e, t, {
        renderedParentType: n || h.type,
        renderedSurroundingElement: r || h.type
      });
    }
    if (t.format === "system")
      if (a instanceof ae) {
        const p = a.variable, d = t.exportNamesByVariable.get(p);
        if (d) {
          d.length === 1 ? Hr(p, l, c, e, t) : Wl(p, l, c, h.type !== Ze, e, t);
          return;
        }
      } else {
        const p = [];
        if (a.addExportedVariables(p, t.exportNamesByVariable), p.length > 0) {
          vd(p, l, c, r === Ze, e, t);
          return;
        }
      }
    a.included && a instanceof As && (r === Ze || r === Ur) && (e.appendRight(l, "("), e.prependLeft(c, ")"));
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.left.deoptimizeAssignment(D, this.right), this.scope.context.requestTreeshakingPass();
  }
}
class $c extends v {
  addExportedVariables(e, t) {
    this.left.addExportedVariables(e, t);
  }
  declare(e, t, s) {
    return this.left.declare(e, t, s);
  }
  deoptimizeAssignment(e, t) {
    this.left.deoptimizeAssignment(e, t);
  }
  deoptimizePath(e) {
    e.length === 0 && this.left.deoptimizePath(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return e.length > 0 || this.left.hasEffectsOnInteractionAtPath(D, t, s);
  }
  hasEffectsWhenDestructuring(e, t, s) {
    return this.left.hasEffectsWhenDestructuring(e, t, s);
  }
  includeDestructuredIfNecessary(e, t, s) {
    let n = this.left.includeDestructuredIfNecessary(e, t, s) || this.included;
    return (n ||= this.right.shouldBeIncluded(e)) && (this.right.include(e, !1), this.left.included || (this.left.includeNode(e), this.left.includeDestructuredIfNecessary(e, t, s))), !this.included && n && this.includeNode(e), this.included;
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.right.includePath(O, e);
  }
  markDeclarationReached() {
    this.left.markDeclarationReached();
  }
  render(e, t, { isShorthandProperty: s } = Oe) {
    this.left.render(e, t, { isShorthandProperty: s }), this.right.render(e, t);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.left.deoptimizePath(D), this.right.deoptimizePath(O), this.scope.context.requestTreeshakingPass();
  }
}
class wc extends v {
  deoptimizePath(e) {
    this.argument.deoptimizePath(e);
  }
  hasEffects() {
    return this.deoptimized || this.applyDeoptimizations(), !0;
  }
  initialise() {
    super.initialise();
    let e = this.parent;
    do
      if (e instanceof aa || e instanceof ua)
        return;
    while (e = e.parent);
    this.scope.context.usesTopLevelAwait = !0;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.argument.include(e, t);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.argument.includePath(mf, e);
  }
  includePath(e, t) {
    this.deoptimized || this.applyDeoptimizations(), this.included || this.includeNode(t), this.argument.includePath(e, t);
  }
}
const mf = ["then"];
function Cc(i) {
  return i === void 0 ? "void 0" : typeof i == "boolean" ? String(i) : typeof i == "string" ? JSON.stringify(i) : typeof i == "number" ? gf(i) : K;
}
function gf(i) {
  if (Object.is(-0, i))
    return "-0";
  const e = i.toExponential(), [t, s] = e.split("e"), n = t.split(".")[1]?.length || 0, r = `${t.replace(".", "")}e${parseInt(s) - n}`, a = String(i).replace("+", "");
  return r.length < a.length ? r : a;
}
const yf = {
  "!=": (i, e) => i != e,
  "!==": (i, e) => i !== e,
  "%": (i, e) => i % e,
  "&": (i, e) => i & e,
  "*": (i, e) => i * e,
  // At the moment, "**" will be transpiled to Math.pow
  "**": (i, e) => i ** e,
  "+": (i, e) => i + e,
  "-": (i, e) => i - e,
  "/": (i, e) => i / e,
  "<": (i, e) => i < e,
  "<<": (i, e) => i << e,
  "<=": (i, e) => i <= e,
  "==": (i, e) => i == e,
  "===": (i, e) => i === e,
  ">": (i, e) => i > e,
  ">=": (i, e) => i >= e,
  ">>": (i, e) => i >> e,
  ">>>": (i, e) => i >>> e,
  "^": (i, e) => i ^ e,
  "|": (i, e) => i | e
  // We use the fallback for cases where we return something unknown
  // in: () => UnknownValue,
  // instanceof: () => UnknownValue,
}, Lo = /* @__PURE__ */ Symbol("Unassigned");
class ha extends v {
  constructor() {
    super(...arguments), this.renderedLiteralValue = Lo;
  }
  deoptimizeCache() {
    this.renderedLiteralValue = K;
  }
  getLiteralValueAtPath(e, t, s) {
    if (e.length > 0)
      return K;
    const n = this.left.getLiteralValueAtPath(D, t, s);
    if (typeof n == "symbol")
      return K;
    if (this.operator === "in" && this.right.variable instanceof Mt) {
      const [o] = this.right.variable.context.traceExport(String(n));
      return o instanceof Bs || o instanceof ze ? K : !!o;
    }
    const r = this.right.getLiteralValueAtPath(D, t, s);
    if (typeof r == "symbol")
      return K;
    const a = yf[this.operator];
    return a ? a(n, r) : K;
  }
  getRenderedLiteralValue() {
    return this.operator !== "in" || !(this.right.variable instanceof Mt) ? K : this.renderedLiteralValue !== Lo ? this.renderedLiteralValue : this.renderedLiteralValue = Cc(this.getLiteralValueAtPath(D, de, this));
  }
  hasEffects(e) {
    return this.operator === "+" && this.parent instanceof Nt && this.left.getLiteralValueAtPath(D, de, this) === "" ? !0 : super.hasEffects(e);
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return t !== ge || e.length > 1;
  }
  include(e, t, s) {
    this.included || this.includeNode(e), typeof this.getRenderedLiteralValue() == "symbol" && (this.left.include(e, t, s), this.right.include(e, t, s), this.operator === "instanceof" && this.right.includePath(Md, e));
  }
  includeNode(e) {
    this.included = !0, this.operator === "in" && typeof this.getRenderedLiteralValue() == "symbol" && this.right.includePath(O, e);
  }
  removeAnnotations(e) {
    this.left.removeAnnotations(e);
  }
  render(e, t, { renderedSurroundingElement: s } = Oe) {
    const n = this.getRenderedLiteralValue();
    typeof n != "symbol" ? e.overwrite(this.start, this.end, n) : (this.left.render(e, t, { renderedSurroundingElement: s }), this.right.render(e, t));
  }
}
ha.prototype.applyDeoptimizations = Y;
class Ai extends v {
  hasEffects(e) {
    if (this.label) {
      if (!e.ignore.labels.has(this.label.name))
        return !0;
      e.includedLabels.add(this.label.name);
    } else {
      if (!e.ignore.breaks)
        return !0;
      e.hasBreak = !0;
    }
    return e.brokenFlow = !0, !1;
  }
  include(e, t) {
    this.included = !0, this.label ? (this.label.include(e, t), e.includedLabels.add(this.label.name)) : e.hasBreak = !0, e.brokenFlow = !0;
  }
}
Ai.prototype.includeNode = oe;
Ai.prototype.applyDeoptimizations = Y;
function vc(i, e, t) {
  if (t.arguments.length > 0)
    if (t.arguments[t.arguments.length - 1].included)
      for (const s of t.arguments)
        s.render(i, e);
    else {
      let s = t.arguments.length - 2;
      for (; s >= 0 && !t.arguments[s].included; )
        s--;
      if (s >= 0) {
        for (let n = 0; n <= s; n++)
          t.arguments[n].render(i, e);
        i.remove(we(i.original, ",", t.arguments[s].end), t.end - 1);
      } else
        i.remove(we(i.original, "(", t.callee.end) + 1, t.end - 1);
    }
}
class kc extends v {
  constructor() {
    super(...arguments), this.returnExpression = null, this.deoptimizableDependentExpressions = [], this.expressionsToBeDeoptimized = /* @__PURE__ */ new Set();
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    const { args: n } = e, [r, a] = this.getReturnExpression(s);
    if (a)
      return;
    const o = n.filter((l) => !!l && l !== G);
    if (o.length !== 0)
      if (r === G)
        for (const l of o)
          l.deoptimizePath(O);
      else
        s.withTrackedEntityAtPath(t, r, () => {
          for (const l of o)
            this.expressionsToBeDeoptimized.add(l);
          r.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
        }, null);
  }
  deoptimizeCache() {
    if (this.returnExpression?.[0] !== G) {
      this.returnExpression = Se;
      const { deoptimizableDependentExpressions: e, expressionsToBeDeoptimized: t } = this;
      this.expressionsToBeDeoptimized = Sl, this.deoptimizableDependentExpressions = De;
      for (const s of e)
        s.deoptimizeCache();
      for (const s of t)
        s.deoptimizePath(O);
    }
  }
  deoptimizePath(e) {
    if (e.length === 0 || this.scope.context.deoptimizationTracker.trackEntityAtPathAndGetIfTracked(e, this))
      return;
    const [t] = this.getReturnExpression();
    t !== G && t.deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    const [n] = this.getReturnExpression(t);
    return n === G ? K : t.withTrackedEntityAtPath(e, n, () => (this.deoptimizableDependentExpressions.push(s), n.getLiteralValueAtPath(e, t, s)), K);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    const r = this.getReturnExpression(s);
    return r[0] === G ? r : s.withTrackedEntityAtPath(e, r, () => {
      this.deoptimizableDependentExpressions.push(n);
      const [a, o] = r[0].getReturnExpressionWhenCalledAtPath(e, t, s, n);
      return [a, o || r[1]];
    }, Se);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const { type: n } = t;
    if (n === X) {
      const { args: o, withNew: l } = t;
      if ((l ? s.instantiated : s.called).trackEntityAtPathAndGetIfTracked(e, o, this))
        return !1;
    } else if ((n === Ue ? s.assigned : s.accessed).trackEntityAtPathAndGetIfTracked(e, this))
      return !1;
    const [r, a] = this.getReturnExpression();
    return (n === Ue || !a) && r.hasEffectsOnInteractionAtPath(e, t, s);
  }
}
class Rc extends kc {
  get hasCheckedForWarnings() {
    return Z(
      this.flags,
      134217728
      /* Flag.checkedForWarnings */
    );
  }
  set hasCheckedForWarnings(e) {
    this.flags = ee(this.flags, 134217728, e);
  }
  get optional() {
    return Z(
      this.flags,
      128
      /* Flag.optional */
    );
  }
  set optional(e) {
    this.flags = ee(this.flags, 128, e);
  }
  bind() {
    super.bind(), this.interaction = {
      args: [
        this.callee instanceof jt && !this.callee.variable ? this.callee.object : null,
        ...this.arguments
      ],
      type: X,
      withNew: !1
    };
  }
  getLiteralValueAtPathAsChainElement(e, t, s) {
    return hc(this, this.callee, e, t, s);
  }
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t of this.arguments)
      if (t.hasEffects(e))
        return !0;
    return this.annotationPure ? !1 : this.callee.hasEffects(e) || this.callee.hasEffectsOnInteractionAtPath(D, this.interaction, e);
  }
  hasEffectsAsChainElement(e) {
    const t = "hasEffectsAsChainElement" in this.callee ? this.callee.hasEffectsAsChainElement(e) : this.callee.hasEffects(e);
    if (t === at)
      return at;
    if (this.optional && this.callee.getLiteralValueAtPath(D, de, this) == null)
      return !this.annotationPure && t || at;
    this.deoptimized || this.applyDeoptimizations();
    for (const s of this.arguments)
      if (s.hasEffects(e))
        return !0;
    return !this.annotationPure && (t || this.callee.hasEffectsOnInteractionAtPath(D, this.interaction, e));
  }
  include(e, t) {
    this.included || this.includeNode(e), t ? (super.include(e, !0), t === Yl && this.callee instanceof ae && this.callee.variable && this.callee.variable.markCalledFromTryStatement()) : (this.callee.include(e, !1), this.callee.includeCallArguments(this.interaction, e));
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations();
  }
  initialise() {
    super.initialise(), this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationPure = this.annotations.some((e) => e.type === "pure"));
  }
  render(e, t, { renderedSurroundingElement: s } = Oe) {
    this.callee.render(e, t, {
      isCalleeOfRenderedParent: !0,
      renderedSurroundingElement: s
    }), vc(e, t, this), this.callee instanceof ae && !this.hasCheckedForWarnings && (this.hasCheckedForWarnings = !0, this.scope.findVariable(this.callee.name).isNamespace && this.scope.context.log(V, Pl(this.callee.name), this.start), this.callee.name === "eval" && this.scope.context.log(V, fh(this.scope.context.module.id), this.start));
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.callee.deoptimizeArgumentsOnInteractionAtPath(this.interaction, D, de), this.scope.context.requestTreeshakingPass();
  }
  getReturnExpression(e = de) {
    return this.returnExpression === null ? (this.returnExpression = Se, this.returnExpression = this.callee.getReturnExpressionWhenCalledAtPath(D, this.interaction, e, this)) : this.returnExpression;
  }
}
class xi extends v {
  createScope(e) {
    this.scope = new rc(e, !0);
  }
  parseNode(e) {
    const { body: t, param: s, type: n } = e;
    return this.type = n, s && (this.param = new (this.scope.context.getNodeConstructor(s.type))(this, this.scope).parseNode(s), this.param.declare("parameter", D, G)), this.body = new Kt(this, this.scope.bodyScope).parseNode(t), super.parseNode(e);
  }
}
xi.prototype.preventChildBlockScope = !0;
xi.prototype.includeNode = Ce;
class Si extends v {
  // deoptimizations are not relevant as we are not caching values
  deoptimizeCache() {
  }
  getLiteralValueAtPath(e, t, s) {
    const n = this.expression.getLiteralValueAtPathAsChainElement(e, t, s);
    return n === at ? void 0 : n;
  }
  hasEffects(e) {
    return this.expression.hasEffectsAsChainElement(e) === !0;
  }
  includePath(e, t) {
    this.included = !0, this.expression.includePath(e, t);
  }
  removeAnnotations(e) {
    this.expression.removeAnnotations(e);
  }
}
Si.prototype.includeNode = oe;
Si.prototype.applyDeoptimizations = Y;
class Ef extends Ge {
  constructor(e, t) {
    const { context: s } = e;
    super(e, s), this.variables.set("this", this.thisVariable = new et("this", null, t, D, s, "other")), this.instanceScope = new Ge(this, s), this.instanceScope.variables.set("this", new ic(s));
  }
  findLexicalBoundary() {
    return this;
  }
}
class Pi extends v {
  createScope(e) {
    this.scope = new Ef(e, this.parent);
  }
  include(e, t) {
    this.included = !0, this.scope.context.includeVariableInModule(this.scope.thisVariable, O, e);
    for (const s of this.body)
      s.include(e, t);
  }
  parseNode(e) {
    const t = this.body = new Array(e.body.length);
    let s = 0;
    for (const n of e.body)
      t[s++] = new (this.scope.context.getNodeConstructor(n.type))(this, n.static ? this.scope : this.scope.instanceScope).parseNode(n);
    return super.parseNode(e);
  }
}
Pi.prototype.includeNode = oe;
Pi.prototype.applyDeoptimizations = Y;
class Vn extends ra {
  render(e, t, { renderedSurroundingElement: s } = Oe) {
    super.render(e, t), s === Ze && (e.appendRight(this.start, "("), e.prependLeft(this.end, ")"));
  }
}
function rs(i) {
  return typeof i == "symbol" ? i === ni ? !1 : i === si ? !0 : K : !!i;
}
class Ii extends qe {
  constructor(e) {
    super(), this.expressions = e;
  }
  deoptimizePath(e) {
    for (const t of this.expressions)
      t.deoptimizePath(e);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return [
      new Ii(this.expressions.map((r) => r.getReturnExpressionWhenCalledAtPath(e, t, s, n)[0])),
      !1
    ];
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    for (const n of this.expressions)
      if (n.hasEffectsOnInteractionAtPath(e, t, s))
        return !0;
    return !1;
  }
}
class Ni extends v {
  constructor() {
    super(...arguments), this.expressionsToBeDeoptimized = [], this.usedBranch = null;
  }
  get isBranchResolutionAnalysed() {
    return Z(
      this.flags,
      65536
      /* Flag.isBranchResolutionAnalysed */
    );
  }
  set isBranchResolutionAnalysed(e) {
    this.flags = ee(this.flags, 65536, e);
  }
  get hasDeoptimizedCache() {
    return Z(
      this.flags,
      33554432
      /* Flag.hasDeoptimizedCache */
    );
  }
  set hasDeoptimizedCache(e) {
    this.flags = ee(this.flags, 33554432, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.consequent.deoptimizeArgumentsOnInteractionAtPath(e, t, s), this.alternate.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizeCache() {
    if (!this.hasDeoptimizedCache && (this.hasDeoptimizedCache = !0, this.usedBranch !== null)) {
      const e = this.usedBranch === this.consequent ? this.alternate : this.consequent;
      this.usedBranch = null, e.deoptimizePath(O), this.included && e.includePath(O, it());
      const { expressionsToBeDeoptimized: t } = this;
      this.expressionsToBeDeoptimized = De;
      for (const s of t)
        s.deoptimizeCache();
    }
  }
  deoptimizePath(e) {
    const t = this.getUsedBranch();
    t ? t.deoptimizePath(e) : (this.consequent.deoptimizePath(e), this.alternate.deoptimizePath(e));
  }
  getLiteralValueAtPath(e, t, s) {
    const n = this.getUsedBranch();
    if (!n) {
      if (this.hasDeoptimizedCache)
        return K;
      const r = this.consequent.getLiteralValueAtPath(e, t, s), a = rs(r);
      if (a === K)
        return K;
      const o = this.alternate.getLiteralValueAtPath(e, t, s), l = rs(o);
      return a !== l ? K : (this.expressionsToBeDeoptimized.push(s), r !== o ? a ? si : ni : r);
    }
    return this.expressionsToBeDeoptimized.push(s), n.getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    const r = this.getUsedBranch();
    return r ? (this.expressionsToBeDeoptimized.push(n), r.getReturnExpressionWhenCalledAtPath(e, t, s, n)) : [
      new Ii([
        this.consequent.getReturnExpressionWhenCalledAtPath(e, t, s, n)[0],
        this.alternate.getReturnExpressionWhenCalledAtPath(e, t, s, n)[0]
      ]),
      !1
    ];
  }
  hasEffects(e) {
    if (this.test.hasEffects(e))
      return !0;
    const t = this.getUsedBranch();
    return t ? t.hasEffects(e) : this.consequent.hasEffects(e) || this.alternate.hasEffects(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const n = this.getUsedBranch();
    return n ? n.hasEffectsOnInteractionAtPath(e, t, s) : this.consequent.hasEffectsOnInteractionAtPath(e, t, s) || this.alternate.hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    this.included = !0;
    const s = this.getUsedBranch();
    s === null || t || this.test.shouldBeIncluded(e) ? (this.test.include(e, t), this.consequent.include(e, t), this.alternate.include(e, t)) : s.include(e, t);
  }
  includePath(e, t) {
    this.included = !0;
    const s = this.getUsedBranch();
    s === null || this.test.shouldBeIncluded(t) ? (this.consequent.includePath(e, t), this.alternate.includePath(e, t)) : s.includePath(e, t);
  }
  includeCallArguments(e, t) {
    const s = this.getUsedBranch();
    s ? s.includeCallArguments(e, t) : (this.consequent.includeCallArguments(e, t), this.alternate.includeCallArguments(e, t));
  }
  removeAnnotations(e) {
    this.test.removeAnnotations(e);
  }
  render(e, t, { isCalleeOfRenderedParent: s, preventASI: n, renderedParentType: r, renderedSurroundingElement: a } = Oe) {
    if (this.test.included)
      this.test.render(e, t, { renderedSurroundingElement: a }), this.consequent.render(e, t), this.alternate.render(e, t);
    else {
      const o = this.getUsedBranch(), l = we(e.original, ":", this.consequent.end), c = Pt(e.original, (this.consequent.included ? we(e.original, "?", this.test.end) : l) + 1);
      n && Qn(e, c, o.start), e.remove(this.start, c), this.consequent.included && e.remove(l, this.end), this.test.removeAnnotations(e), o.render(e, t, {
        isCalleeOfRenderedParent: s,
        preventASI: !0,
        renderedParentType: r || this.parent.type,
        renderedSurroundingElement: a || this.parent.type
      });
    }
  }
  getUsedBranch() {
    if (this.isBranchResolutionAnalysed)
      return this.usedBranch;
    this.isBranchResolutionAnalysed = !0;
    const e = rs(this.test.getLiteralValueAtPath(D, de, this));
    return typeof e == "symbol" ? null : this.usedBranch = e ? this.consequent : this.alternate;
  }
}
Ni.prototype.includeNode = oe;
Ni.prototype.applyDeoptimizations = Y;
class $i extends v {
  hasEffects(e) {
    if (this.label) {
      if (!e.ignore.labels.has(this.label.name))
        return !0;
      e.includedLabels.add(this.label.name);
    } else {
      if (!e.ignore.continues)
        return !0;
      e.hasContinue = !0;
    }
    return e.brokenFlow = !0, !1;
  }
  include(e, t) {
    this.included = !0, this.label ? (this.label.include(e, t), e.includedLabels.add(this.label.name)) : e.hasContinue = !0, e.brokenFlow = !0;
  }
}
$i.prototype.includeNode = oe;
$i.prototype.applyDeoptimizations = Y;
class da extends v {
  hasEffects() {
    return !0;
  }
}
da.prototype.includeNode = Ce;
class pa extends v {
  hasEffects(e) {
    return this.expression.hasEffects(e) || this.expression.hasEffectsOnInteractionAtPath(D, Gs, e);
  }
}
pa.prototype.includeNode = Ce;
function wi(i, e) {
  const { brokenFlow: t, hasBreak: s, hasContinue: n, ignore: r } = i, { breaks: a, continues: o } = r;
  return r.breaks = !0, r.continues = !0, i.hasBreak = !1, i.hasContinue = !1, e.hasEffects(i) ? !0 : (r.breaks = a, r.continues = o, i.hasBreak = s, i.hasContinue = n, i.brokenFlow = t, !1);
}
function Ys(i, e, t) {
  const { brokenFlow: s, hasBreak: n, hasContinue: r } = i;
  i.hasBreak = !1, i.hasContinue = !1, e.include(i, t, { asSingleStatement: !0 }), i.hasBreak = n, i.hasContinue = r, i.brokenFlow = s;
}
class Ci extends v {
  hasEffects(e) {
    return this.test.hasEffects(e) ? !0 : wi(e, this.body);
  }
  include(e, t) {
    this.included = !0, this.test.include(e, t), Ys(e, this.body, t);
  }
}
Ci.prototype.includeNode = oe;
Ci.prototype.applyDeoptimizations = Y;
class fa extends v {
  hasEffects() {
    return !1;
  }
}
fa.prototype.includeNode = Ce;
class xs extends v {
  hasEffects() {
    return !1;
  }
  initialise() {
    super.initialise(), this.scope.context.addExport(this);
  }
  render(e, t, s) {
    e.remove(s.start, s.end);
  }
}
xs.prototype.needsBoundaries = !0;
xs.prototype.includeNode = oe;
xs.prototype.applyDeoptimizations = Y;
class Qs extends v {
  bind() {
    this.declaration?.bind();
  }
  hasEffects(e) {
    return !!this.declaration?.hasEffects(e);
  }
  initialise() {
    super.initialise(), this.scope.context.addExport(this);
  }
  removeAnnotations(e) {
    this.declaration?.removeAnnotations(e);
  }
  render(e, t, s) {
    const { start: n, end: r } = s;
    if (this.declaration === null)
      e.remove(n, r);
    else {
      let a = this.declaration.start;
      if (this.declaration instanceof hs) {
        const o = this.declaration.decorators;
        for (const l of o)
          a = Math.min(a, l.start);
        a <= this.start && (a = this.declaration.start);
      }
      e.remove(this.start, a), this.declaration.render(e, t, { end: r, start: n });
    }
  }
}
Qs.prototype.needsBoundaries = !0;
Qs.prototype.includeNode = oe;
Qs.prototype.applyDeoptimizations = Y;
class vi extends v {
}
vi.prototype.includeNode = oe;
vi.prototype.applyDeoptimizations = Y;
class Dc extends v {
  createScope(e) {
    this.scope = new Wt(e);
  }
  hasEffects(e) {
    const { body: t, deoptimized: s, left: n, right: r } = this;
    return s || this.applyDeoptimizations(), n.hasEffectsAsAssignmentTarget(e, !1) || r.hasEffects(e) ? !0 : wi(e, t);
  }
  include(e, t) {
    const { body: s, deoptimized: n, left: r, right: a } = this;
    n || this.applyDeoptimizations(), this.included || this.includeNode(e), r.includeAsAssignmentTarget(e, t || !0, !1), a.include(e, t), Ys(e, s, t);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.right.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.left.setAssignedValue(G);
  }
  render(e, t) {
    this.left.render(e, t, Ot), this.right.render(e, t, Ot), e.original.charCodeAt(this.right.start - 1) === 110 && e.prependLeft(this.right.start, " "), this.body.render(e, t);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.left.deoptimizePath(D), this.scope.context.requestTreeshakingPass();
  }
}
class Oc extends v {
  get await() {
    return Z(
      this.flags,
      131072
      /* Flag.await */
    );
  }
  set await(e) {
    this.flags = ee(this.flags, 131072, e);
  }
  createScope(e) {
    this.scope = new Wt(e);
  }
  hasEffects() {
    return this.deoptimized || this.applyDeoptimizations(), !0;
  }
  include(e, t) {
    const { body: s, deoptimized: n, left: r, right: a } = this;
    n || this.applyDeoptimizations(), this.included || this.includeNode(e), r.includeAsAssignmentTarget(e, t || !0, !1), a.include(e, t), Ys(e, s, t);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.right.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.left.setAssignedValue(G);
  }
  render(e, t) {
    this.left.render(e, t, Ot), this.right.render(e, t, Ot), e.original.charCodeAt(this.right.start - 1) === 102 && e.prependLeft(this.right.start, " "), this.body.render(e, t);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.left.deoptimizePath(D), this.right.deoptimizePath(O), this.scope.context.requestTreeshakingPass();
  }
}
class ki extends v {
  createScope(e) {
    this.scope = new Wt(e);
  }
  hasEffects(e) {
    return this.init?.hasEffects(e) || this.test?.hasEffects(e) || this.update?.hasEffects(e) ? !0 : wi(e, this.body);
  }
  include(e, t) {
    this.included = !0, this.init?.include(e, t, {
      asSingleStatement: !0
    }), this.test?.include(e, t), this.update?.include(e, t), Ys(e, this.body, t);
  }
  render(e, t) {
    this.init?.render(e, t, Ot), this.test?.render(e, t, Ot), this.update?.render(e, t, Ot), this.body.render(e, t);
  }
}
ki.prototype.includeNode = oe;
ki.prototype.applyDeoptimizations = Y;
class Lc extends aa {
  createScope(e) {
    super.createScope(this.idScope = new Ge(e, e.context));
  }
  parseNode(e) {
    return e.id !== null && (this.id = new ae(this, this.idScope).parseNode(e.id)), super.parseNode(e);
  }
  onlyFunctionCallUsed() {
    return this.parent.type === js && this.parent.callee === this && (this.id === null || this.id.variable.getOnlyFunctionCallUsed()) || super.onlyFunctionCallUsed();
  }
  render(e, t, { renderedSurroundingElement: s } = Oe) {
    super.render(e, t), s === Ze && (e.appendRight(this.start, "("), e.prependLeft(this.end, ")"));
  }
}
class Un extends Wt {
  constructor() {
    super(...arguments), this.hoistedDeclarations = [];
  }
  addDeclaration(e, t, s, n, r) {
    return this.hoistedDeclarations.push(e), super.addDeclaration(e, t, s, n, r);
  }
}
const Mo = /* @__PURE__ */ Symbol("unset");
class Ss extends v {
  constructor() {
    super(...arguments), this.testValue = Mo;
  }
  deoptimizeCache() {
    this.testValue = K;
  }
  hasEffects(e) {
    if (this.test.hasEffects(e))
      return !0;
    const t = this.getTestValue();
    if (typeof t == "symbol") {
      const { brokenFlow: s } = e;
      if (this.consequent.hasEffects(e))
        return !0;
      const n = e.brokenFlow;
      return e.brokenFlow = s, this.alternate === null ? !1 : this.alternate.hasEffects(e) ? !0 : (e.brokenFlow = e.brokenFlow && n, !1);
    }
    return t ? this.consequent.hasEffects(e) : !!this.alternate?.hasEffects(e);
  }
  include(e, t) {
    if (this.included = !0, t)
      this.includeRecursively(t, e);
    else {
      const s = this.getTestValue();
      typeof s == "symbol" ? this.includeUnknownTest(e) : this.includeKnownTest(e, s);
    }
  }
  parseNode(e) {
    return this.consequent = new (this.scope.context.getNodeConstructor(e.consequent.type))(this, this.consequentScope = new Un(this.scope)).parseNode(e.consequent), e.alternate && (this.alternate = new (this.scope.context.getNodeConstructor(e.alternate.type))(this, this.alternateScope = new Un(this.scope)).parseNode(e.alternate)), super.parseNode(e);
  }
  render(e, t) {
    const { snippets: { getPropertyAccess: s } } = t, n = this.getTestValue(), r = [], a = this.test.included, o = !this.scope.context.options.treeshake;
    a ? this.test.render(e, t) : e.remove(this.start, this.consequent.start), this.consequent.included && (o || typeof n == "symbol" || n) ? this.consequent.render(e, t) : (e.overwrite(this.consequent.start, this.consequent.end, a ? ";" : ""), r.push(...this.consequentScope.hoistedDeclarations)), this.alternate && (this.alternate.included && (o || typeof n == "symbol" || !n) ? (a ? e.original.charCodeAt(this.alternate.start - 1) === 101 && e.prependLeft(this.alternate.start, " ") : e.remove(this.consequent.end, this.alternate.start), this.alternate.render(e, t)) : (a && this.shouldKeepAlternateBranch() ? e.overwrite(this.alternate.start, this.end, ";") : e.remove(this.consequent.end, this.end), r.push(...this.alternateScope.hoistedDeclarations))), this.renderHoistedDeclarations(r, e, s);
  }
  getTestValue() {
    return this.testValue === Mo ? this.testValue = rs(this.test.getLiteralValueAtPath(D, de, this)) : this.testValue;
  }
  includeKnownTest(e, t) {
    this.test.shouldBeIncluded(e) && this.test.include(e, !1), t && this.consequent.shouldBeIncluded(e) && this.consequent.include(e, !1, { asSingleStatement: !0 }), !t && this.alternate?.shouldBeIncluded(e) && this.alternate.include(e, !1, { asSingleStatement: !0 });
  }
  includeRecursively(e, t) {
    this.test.include(t, e), this.consequent.include(t, e), this.alternate?.include(t, e);
  }
  includeUnknownTest(e) {
    this.test.include(e, !1);
    const { brokenFlow: t } = e;
    let s = !1;
    this.consequent.shouldBeIncluded(e) && (this.consequent.include(e, !1, { asSingleStatement: !0 }), s = e.brokenFlow, e.brokenFlow = t), this.alternate?.shouldBeIncluded(e) && (this.alternate.include(e, !1, { asSingleStatement: !0 }), e.brokenFlow = e.brokenFlow && s);
  }
  renderHoistedDeclarations(e, t, s) {
    const n = [
      ...new Set(e.map((r) => {
        const a = r.variable;
        return a.included ? a.getName(s) : "";
      }))
    ].filter(Boolean).join(", ");
    if (n) {
      const r = this.parent.type, a = r !== On && r !== Rh;
      t.prependRight(this.start, `${a ? "{ " : ""}var ${n}; `), a && t.appendLeft(this.end, " }");
    }
  }
  shouldKeepAlternateBranch() {
    let e = this.parent;
    do {
      if (e instanceof Ss && e.alternate)
        return !0;
      if (e instanceof Kt)
        return !1;
      e = e.parent;
    } while (e);
    return !1;
  }
}
Ss.prototype.includeNode = oe;
Ss.prototype.applyDeoptimizations = Y;
class Mc extends v {
}
class Zs extends v {
  // Do not bind specifiers or attributes
  bind() {
  }
  hasEffects() {
    return !1;
  }
  initialise() {
    super.initialise(), this.scope.context.addImport(this);
  }
  render(e, t, s) {
    e.remove(s.start, s.end);
  }
}
Zs.prototype.needsBoundaries = !0;
Zs.prototype.includeNode = oe;
Zs.prototype.applyDeoptimizations = Y;
class en extends v {
}
en.prototype.includeNode = oe;
en.prototype.applyDeoptimizations = Y;
class bf {
  constructor(e) {
    this.interaction = {
      args: [null, e],
      type: X,
      withNew: !1
    };
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    ot(e), e.type === X && t.length === 0 && (Sr(e.args[1]) || xr(e.args[1])) && e.args[1].deoptimizeArgumentsOnInteractionAtPath(this.interaction, [], s);
  }
  includeCallArguments(e, t) {
    Jr(e, t), e.type === X && (Sr(e.args[1]) || xr(e.args[1])) && e.args[1].includeCallArguments(this.interaction, t);
  }
}
class To {
  deoptimizeArgumentsOnInteractionAtPath(e) {
    ot(e);
  }
  includeCallArguments(e, t) {
    Jr(e, t);
  }
}
function Bo(i) {
  return { fileName: i.getFileName(), ...i.getPreRenderedChunkInfo() };
}
class ma extends v {
  constructor() {
    super(...arguments), this.inlineNamespace = null, this.resolution = null, this.attributes = null, this.mechanism = null, this.namespaceExportName = void 0, this.localResolution = null, this.resolutionString = null;
  }
  get shouldIncludeDynamicAttributes() {
    return Z(
      this.flags,
      268435456
      /* Flag.shouldIncludeDynamicAttributes */
    );
  }
  set shouldIncludeDynamicAttributes(e) {
    this.flags = ee(this.flags, 268435456, e);
  }
  bind() {
    const { options: e, parent: t, resolution: s, source: n } = this;
    if (n.bind(), e?.bind(), typeof s != "object" || !s || !("namespace" in s))
      return;
    if (ao(t) || qd(t)) {
      this.localResolution = { resolution: s, tracked: !0 };
      return;
    }
    if (!ro(t)) {
      this.localResolution = { resolution: s, tracked: !1 };
      return;
    }
    let r = t, a = this;
    for (; !(r.computed || r.object !== a || !Xd(r.property) || !Kd(r.parent)); ) {
      const o = r.property.name;
      if (a = r.parent, o === "then") {
        const l = a.arguments[0];
        if (l === void 0 || Sr(l) || xr(l)) {
          r.promiseHandler = new bf(Rp(s.namespace)), this.localResolution = { resolution: s, tracked: !0 };
          return;
        }
      } else if (o === "catch" || o === "finally") {
        if (ro(a.parent)) {
          r.promiseHandler = new To(), r = a.parent;
          continue;
        }
        if (ao(a.parent)) {
          r.promiseHandler = new To(), this.localResolution = { resolution: s, tracked: !0 };
          return;
        }
      }
      break;
    }
    this.localResolution = { resolution: s, tracked: !1 };
  }
  deoptimizePath(e) {
    this.localResolution?.resolution?.namespace.deoptimizePath(e);
  }
  hasEffects() {
    return !0;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.source.include(e, t), this.shouldIncludeDynamicAttributes && this.options?.include(e, t), t && this.localResolution?.resolution.includeAllExports();
  }
  includeNode(e) {
    this.included = !0;
    const { localResolution: t, scope: s, shouldIncludeDynamicAttributes: n } = this;
    n && this.options?.includePath(O, e), s.context.includeDynamicImport(this), s.addAccessedDynamicImport(this), t && (t.tracked ? t.resolution.includeModuleInExecution() : t.resolution.includeAllExports());
  }
  includePath(e, t) {
    this.included || this.includeNode(t), this.localResolution?.resolution?.namespace.includeMemberPath(e, t);
  }
  initialise() {
    super.initialise(), this.scope.context.addDynamicImport(this);
  }
  parseNode(e) {
    return this.sourceAstNode = e.source, super.parseNode(e);
  }
  render(e, t) {
    const { snippets: { _: s, getDirectReturnFunction: n, getObject: r, getPropertyAccess: a }, importAttributesKey: o } = t;
    if (this.inlineNamespace) {
      const [l, c] = n([], {
        functionReturn: !0,
        lineBreakIndent: null,
        name: null
      });
      e.overwrite(this.start, this.end, `Promise.resolve().then(${l}${this.inlineNamespace.getName(a)}${c})`);
      return;
    }
    if (this.mechanism && (e.overwrite(this.start, we(e.original, "(", this.start + 6) + 1, this.mechanism.left), e.overwrite(this.end - 1, this.end, this.mechanism.right)), this.resolutionString) {
      if (e.overwrite(this.source.start, this.source.end, this.resolutionString), this.namespaceExportName) {
        const [l, c] = n(["n"], {
          functionReturn: !0,
          lineBreakIndent: null,
          name: null
        });
        e.prependLeft(this.end, `.then(${l}n.${this.namespaceExportName}${c})`);
      }
    } else
      this.source.render(e, t);
    this.attributes !== !0 && (this.options && e.overwrite(this.source.end, this.end - 1, "", { contentOnly: !0 }), this.attributes && e.appendLeft(this.end - 1, `,${s}${r([[o, this.attributes]], {
      lineBreakIndent: null
    })}`));
  }
  setExternalResolution(e, t, s, n, r, a, o, l, c, h) {
    const { format: p } = t;
    this.inlineNamespace = null, this.resolutionString = a, this.namespaceExportName = o, this.attributes = l;
    const d = [...Af[p] || []];
    let m;
    ({ helper: m, mechanism: this.mechanism } = this.getDynamicImportMechanismAndHelper(e, t, s, n, c, h)), m && d.push(m), d.length > 0 && this.scope.addAccessedGlobals(d, r);
  }
  setInternalResolution(e) {
    this.inlineNamespace = e;
  }
  getDynamicImportMechanismAndHelper(e, { compact: t, dynamicImportInCjs: s, format: n, generatedCode: { arrowFunctions: r }, interop: a }, { _: o, getDirectReturnFunction: l, getDirectReturnIifeLeft: c }, h, p, d) {
    const { resolution: m, scope: f } = this, g = h.hookFirstSync("renderDynamicImport", [
      {
        chunk: Bo(p),
        customResolution: typeof m == "string" ? m : null,
        format: n,
        getTargetChunkImports() {
          if (d === null)
            return null;
          const b = [], E = p.getFileName();
          for (const A of d.dependencies) {
            const x = `'${A.getImportPath(E)}'`;
            A instanceof Rt ? b.push({
              fileName: A.getFileName(),
              resolvedImportPath: x,
              type: "external"
            }) : b.push({
              chunk: A.getPreRenderedChunkInfo(),
              fileName: A.getFileName(),
              resolvedImportPath: x,
              type: "internal"
            });
          }
          return b;
        },
        moduleId: f.context.module.id,
        targetChunk: d ? Bo(d) : null,
        targetModuleAttributes: m && typeof m != "string" ? m.info.attributes : {},
        targetModuleId: m && typeof m != "string" ? m.id : null
      }
    ]);
    if (g)
      return { helper: null, mechanism: g };
    const y = !m || typeof m == "string";
    switch (n) {
      case "cjs": {
        if (s && (!m || typeof m == "string" || m instanceof Ee))
          return { helper: null, mechanism: null };
        const b = _o(m, e, a);
        let E = "require(", A = ")";
        b && (E = `/*#__PURE__*/${b}(${E}`, A += ")");
        const [x, k] = l([], {
          functionReturn: !0,
          lineBreakIndent: null,
          name: null
        });
        return E = `Promise.resolve().then(${x}${E}`, A += `${k})`, !r && y && (E = c(["t"], `${E}t${A}`, {
          needsArrowReturnParens: !1,
          needsWrappedFunction: !0
        }), A = ")"), {
          helper: b,
          mechanism: { left: E, right: A }
        };
      }
      case "amd": {
        const b = t ? "c" : "resolve", E = t ? "e" : "reject", A = _o(m, e, a), [x, k] = l(["m"], {
          functionReturn: !1,
          lineBreakIndent: null,
          name: null
        }), F = A ? `${x}${b}(/*#__PURE__*/${A}(m))${k}` : b, [T, U] = l([b, E], {
          functionReturn: !1,
          lineBreakIndent: null,
          name: null
        });
        let B = `new Promise(${T}require([`, w = `],${o}${F},${o}${E})${U})`;
        return !r && y && (B = c(["t"], `${B}t${w}`, {
          needsArrowReturnParens: !1,
          needsWrappedFunction: !0
        }), w = ")"), {
          helper: A,
          mechanism: { left: B, right: w }
        };
      }
      case "system":
        return {
          helper: null,
          mechanism: {
            left: "module.import(",
            right: ")"
          }
        };
    }
    return { helper: null, mechanism: null };
  }
}
ma.prototype.applyDeoptimizations = Y;
function _o(i, e, t) {
  return e === "external" ? Js[t(i instanceof Ee ? i.id : null)] : e === "default" ? Fs : null;
}
const Af = {
  amd: ["require"],
  cjs: ["require"],
  system: ["module"]
};
class tn extends v {
}
tn.prototype.includeNode = oe;
tn.prototype.applyDeoptimizations = Y;
class Ri extends v {
}
Ri.prototype.includeNode = oe;
Ri.prototype.applyDeoptimizations = Y;
class ga extends ec {
  constructor() {
    super(...arguments), this.isNativeElement = !1;
  }
  bind() {
    const e = this.getType();
    e === 0 ? (this.variable = this.scope.findVariable(this.name), this.variable.addReference(this)) : e === 1 && (this.isNativeElement = !0);
  }
  include(e) {
    this.included || this.includeNode(e);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.variable !== null && this.scope.context.includeVariableInModule(this.variable, D, e);
  }
  includePath(e, t) {
    this.included ? e.length > 0 && this.variable?.includePath(e, t) : (this.included = !0, this.variable !== null && this.scope.context.includeVariableInModule(this.variable, e, t));
  }
  render(e, { snippets: { getPropertyAccess: t }, useOriginalName: s }) {
    if (this.variable) {
      const n = this.variable.getName(t, s);
      n !== this.name && e.overwrite(this.start, this.end, n, {
        contentOnly: !0,
        storeName: !0
      });
    } else this.isNativeElement && this.scope.context.options.jsx.mode !== "preserve" && e.update(this.start, this.end, JSON.stringify(this.name));
  }
  getType() {
    switch (this.parent.type) {
      case "JSXOpeningElement":
      case "JSXClosingElement":
        return this.name.startsWith(this.name.charAt(0).toUpperCase()) ? 0 : 1;
      case "JSXMemberExpression":
        return this.parent.object === this ? 0 : 2;
      case "JSXAttribute":
      case "JSXNamespacedName":
        return 2;
      default:
        throw new Error(`Unexpected parent node type for JSXIdentifier: ${this.parent.type}`);
    }
  }
}
class Di extends v {
  render(e, t, { jsxMode: s } = Oe) {
    if (super.render(e, t), ["classic", "automatic"].includes(s)) {
      const { name: n, value: r } = this, a = n instanceof ga ? n.name : `${n.namespace.name}:${n.name.name}`;
      if (!(s === "automatic" && a === "key")) {
        const o = ai(a);
        a !== o && e.overwrite(n.start, n.end, o, { contentOnly: !0 }), r ? (e.overwrite(n.end, r.start, ": ", { contentOnly: !0 }), r instanceof Ve && typeof r.value == "string" && r.value.includes(`
`) && e.overwrite(r.start, r.end, JSON.stringify(r.value), {
          contentOnly: !0
        })) : e.appendLeft(n.end, ": true");
      }
    }
  }
}
Di.prototype.includeNode = Ce;
class ya extends v {
  render(e, t) {
    const { mode: s } = this.scope.context.options.jsx;
    s !== "preserve" ? e.overwrite(this.start, this.end, ")", { contentOnly: !0 }) : super.render(e, t);
  }
}
ya.prototype.includeNode = Ce;
class Tc extends ya {
}
class Bc extends ya {
}
class jn extends v {
  render(e, t) {
    this.argument.render(e, t);
    const { mode: s } = this.scope.context.options.jsx;
    s !== "preserve" && (e.overwrite(this.start, this.argument.start, "", { contentOnly: !0 }), e.overwrite(this.argument.end, this.end, "", { contentOnly: !0 }));
  }
}
class sn extends v {
}
sn.prototype.includeNode = Ce;
class Oi extends v {
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.expression.includePath(O, e);
  }
  render(e, t) {
    const { mode: s } = this.scope.context.options.jsx;
    s !== "preserve" && (e.remove(this.start, this.expression.start), e.remove(this.expression.end, this.end)), this.expression.render(e, t);
  }
}
const xf = /^[ \t]*\r?\n[ \t\r\n]*|[ \t]*\r?\n[ \t\r\n]*$/g, Sf = /[ \t]*\r?\n[ \t\r\n]*/g;
class nn extends v {
  shouldRender() {
    return !!this.getRenderedText();
  }
  render(e) {
    const { mode: t } = this.scope.context.options.jsx;
    t !== "preserve" && e.overwrite(this.start, this.end, JSON.stringify(this.getRenderedText()), {
      contentOnly: !0
    });
  }
  getRenderedText() {
    return this.renderedText === void 0 && (this.renderedText = this.value.replace(xf, "").replace(Sf, " ")), this.renderedText;
  }
}
nn.prototype.includeNode = Ce;
function Pf(i) {
  let e = 0;
  for (const t of i)
    !(t instanceof Oi && t.expression instanceof sn) && (!(t instanceof nn) || t.shouldRender()) && e++;
  return e;
}
function Rr(i, e, t, s, n) {
  const [r, a] = i.split(".");
  let o;
  return t ? (o = s.scope.context.getImportedJsxFactoryVariable(a ? "default" : r, s.start, t), e && (s.scope.findGlobal(r).includePath(O, n), o.globalName = r)) : o = s.scope.findGlobal(r), s.scope.context.includeVariableInModule(o, O, n), o instanceof et && (o.consolidateInitializers(), o.addUsedPlace(s), s.scope.context.requestTreeshakingPass()), o;
}
class Ea extends v {
  constructor() {
    super(...arguments), this.factoryVariable = null, this.factory = null;
  }
  initialise() {
    super.initialise();
    const { importSource: e } = this.jsxMode = this.getRenderingMode();
    e && this.scope.context.addImportSource(e);
  }
  include(e, t) {
    this.included || this.includeNode(e);
    for (const s of this.children)
      s.include(e, t);
  }
  includeNode(e) {
    this.included = !0;
    const { factory: t, importSource: s, mode: n } = this.jsxMode;
    t && (this.factory = t, this.factoryVariable = Rr(t, n === "preserve", s, this, e));
  }
  getRenderingMode() {
    const e = this.scope.context.options.jsx, { mode: t, factory: s, importSource: n } = e;
    return t === "automatic" ? {
      factory: Pf(this.children) > 1 ? "jsxs" : "jsx",
      importSource: e.jsxImportSource,
      mode: t
    } : { factory: s, importSource: n, mode: t };
  }
  renderChildren(e, t, s) {
    const { children: n } = this;
    let r = !1, a = s, o = null;
    for (const l of n)
      l instanceof Oi && l.expression instanceof sn || l instanceof nn && !l.shouldRender() ? e.remove(a, l.end) : (e.appendLeft(a, ", "), l.render(e, t), o ? r = !0 : o = l), a = l.end;
    return { childrenEnd: a, firstChild: o, hasMultipleChildren: r };
  }
}
Ea.prototype.applyDeoptimizations = Y;
class _c extends Ea {
  include(e, t) {
    super.include(e, t), this.openingElement.include(e, t), this.closingElement?.include(e, t);
  }
  render(e, t) {
    switch (this.jsxMode.mode) {
      case "classic": {
        this.renderClassicMode(e, t);
        break;
      }
      case "automatic": {
        this.renderAutomaticMode(e, t);
        break;
      }
      default:
        super.render(e, t);
    }
  }
  getRenderingMode() {
    const e = this.scope.context.options.jsx, { mode: t, factory: s, importSource: n } = e;
    if (t === "automatic") {
      let r = !1;
      for (const a of this.openingElement.attributes)
        if (a instanceof jn)
          r = !0;
        else if (r && a.name.name === "key")
          return { factory: s, importSource: n, mode: "classic" };
    }
    return super.getRenderingMode();
  }
  renderClassicMode(e, t) {
    const { snippets: { getPropertyAccess: s }, useOriginalName: n } = t, { closingElement: r, end: a, factory: o, factoryVariable: l, openingElement: { end: c, selfClosing: h } } = this, [, ...p] = o.split("."), { firstAttribute: d, hasAttributes: m, hasSpread: f, inObject: g, previousEnd: y } = this.renderAttributes(e, t, [l.getName(s, n), ...p].join("."), !1);
    this.wrapAttributes(e, g, m, f, d, "null", y), this.renderChildren(e, t, c), h ? e.appendLeft(a, ")") : r.render(e, t);
  }
  renderAutomaticMode(e, t) {
    const { snippets: { getPropertyAccess: s }, useOriginalName: n } = t, { closingElement: r, end: a, factoryVariable: o, openingElement: { end: l, selfClosing: c } } = this;
    let { firstAttribute: h, hasAttributes: p, hasSpread: d, inObject: m, keyAttribute: f, previousEnd: g } = this.renderAttributes(e, t, o.getName(s, n), !0);
    const { firstChild: y, hasMultipleChildren: b, childrenEnd: E } = this.renderChildren(e, t, l);
    y && (e.prependRight(y.start, `children: ${b ? "[" : ""}`), m || (e.prependRight(y.start, "{ "), m = !0), g = r.start, b && e.appendLeft(g, "]"));
    const A = y ? E : g;
    if (this.wrapAttributes(e, m, p || !!y, d, h || y, "{}", A), f) {
      const { value: x } = f;
      e.appendLeft(A, ", "), x ? e.move(x.start, x.end, A) : e.appendLeft(A, "true");
    }
    c ? e.appendLeft(f?.value?.end || a, ")") : r.render(e, t);
  }
  renderAttributes(e, t, s, n) {
    const { jsxMode: { mode: r }, openingElement: a } = this, { attributes: o, end: l, start: c, name: { start: h, end: p } } = a;
    e.update(c, h, `/*#__PURE__*/${s}(`), a.render(e, t, { jsxMode: r });
    let d = null, m = !1, f = !1, g = p, y = !1, b = null;
    for (const E of o) {
      if (E instanceof Di) {
        if (n && E.name.name === "key") {
          d = E, e.remove(g, E.value?.start || E.end);
          continue;
        }
        e.appendLeft(g, ","), f || (e.prependRight(E.start, "{ "), f = !0), y = !0;
      } else
        f ? (y && e.appendLeft(g, " "), e.appendLeft(g, "},"), f = !1) : e.appendLeft(g, ","), m = !0;
      g = E.end, b ??= E;
    }
    return e.remove(o.at(-1)?.end || g, l), { firstAttribute: b, hasAttributes: y, hasSpread: m, inObject: f, keyAttribute: d, previousEnd: g };
  }
  wrapAttributes(e, t, s, n, r, a, o) {
    if (t && e.appendLeft(o, " }"), n) {
      if (s) {
        const { start: l } = r;
        r instanceof jn && e.prependRight(l, "{}, "), e.prependRight(l, "Object.assign("), e.appendLeft(o, ")");
      }
    } else s || e.appendLeft(o, `, ${a}`);
  }
}
class Fc extends Ea {
  include(e, t) {
    super.include(e, t), this.openingFragment.include(e, t), this.closingFragment.include(e, t);
  }
  render(e, t) {
    switch (this.jsxMode.mode) {
      case "classic": {
        this.renderClassicMode(e, t);
        break;
      }
      case "automatic": {
        this.renderAutomaticMode(e, t);
        break;
      }
      default:
        super.render(e, t);
    }
  }
  renderClassicMode(e, t) {
    const { snippets: { getPropertyAccess: s }, useOriginalName: n } = t, { closingFragment: r, factory: a, factoryVariable: o, openingFragment: l, start: c } = this, [, ...h] = a.split(".");
    l.render(e, t), e.prependRight(c, `/*#__PURE__*/${[
      o.getName(s, n),
      ...h
    ].join(".")}(`), e.appendLeft(l.end, ", null"), this.renderChildren(e, t, l.end), r.render(e, t);
  }
  renderAutomaticMode(e, t) {
    const { snippets: { getPropertyAccess: s }, useOriginalName: n } = t, { closingFragment: r, factoryVariable: a, openingFragment: o, start: l } = this;
    o.render(e, t), e.prependRight(l, `/*#__PURE__*/${a.getName(s, n)}(`);
    const { firstChild: c, hasMultipleChildren: h, childrenEnd: p } = this.renderChildren(e, t, o.end);
    c ? (e.prependRight(c.start, `{ children: ${h ? "[" : ""}`), h && e.appendLeft(r.start, "]"), e.appendLeft(p, " }")) : e.appendLeft(o.end, ", {}"), r.render(e, t);
  }
}
class zc extends v {
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.object.includePath([this.property.name], e);
  }
  includePath(e, t) {
    this.included || this.includeNode(t), this.object.includePath([this.property.name, ...e], t);
  }
}
class ba extends v {
}
ba.prototype.includeNode = Ce;
class Aa extends v {
  render(e, t, { jsxMode: s = this.scope.context.options.jsx.mode } = {}) {
    this.name.render(e, t);
    for (const n of this.attributes)
      n.render(e, t, { jsxMode: s });
  }
}
Aa.prototype.includeNode = Ce;
class Vc extends v {
  constructor() {
    super(...arguments), this.fragment = null, this.fragmentVariable = null;
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations();
    const t = this.scope.context.options.jsx;
    if (t.mode === "automatic")
      this.fragment = "Fragment", this.fragmentVariable = Rr("Fragment", !1, t.jsxImportSource, this, e);
    else {
      const { fragment: s, importSource: n, mode: r } = t;
      s != null && (this.fragment = s, this.fragmentVariable = Rr(s, r === "preserve", n, this, e));
    }
  }
  render(e, t) {
    const { mode: s } = this.scope.context.options.jsx;
    if (s !== "preserve") {
      const { snippets: { getPropertyAccess: n }, useOriginalName: r } = t, [, ...a] = this.fragment.split("."), o = [
        this.fragmentVariable.getName(n, r),
        ...a
      ].join(".");
      e.update(this.start, this.end, o);
    }
  }
}
class Uc extends v {
  render(e, t) {
    super.render(e, t);
    const { mode: s } = this.scope.context.options.jsx;
    s !== "preserve" && (e.overwrite(this.start, this.expression.start, "...", { contentOnly: !0 }), e.overwrite(this.expression.end, this.end, "", { contentOnly: !0 }));
  }
}
class xa extends v {
  hasEffects(e) {
    const { brokenFlow: t, includedLabels: s } = e;
    e.ignore.labels.add(this.label.name), e.includedLabels = /* @__PURE__ */ new Set();
    let n = !1;
    return this.body.hasEffects(e) ? n = !0 : (e.ignore.labels.delete(this.label.name), e.includedLabels.has(this.label.name) && (e.includedLabels.delete(this.label.name), e.brokenFlow = t)), e.includedLabels = /* @__PURE__ */ new Set([...s, ...e.includedLabels]), n;
  }
  include(e, t) {
    this.included || this.includeNode(e);
    const { brokenFlow: s, includedLabels: n } = e;
    e.includedLabels = /* @__PURE__ */ new Set(), this.body.include(e, t), (t || e.includedLabels.has(this.label.name)) && (this.label.include(e, t), e.includedLabels.delete(this.label.name), e.brokenFlow = s), e.includedLabels = /* @__PURE__ */ new Set([...n, ...e.includedLabels]);
  }
  includeNode(e) {
    this.included = !0, this.body.includePath(O, e);
  }
  render(e, t) {
    this.label.included ? this.label.render(e, t) : e.remove(this.start, Pt(e.original, we(e.original, ":", this.label.end) + 1)), this.body.render(e, t);
  }
}
xa.prototype.applyDeoptimizations = Y;
class Li extends v {
  constructor() {
    super(...arguments), this.expressionsToBeDeoptimized = [], this.usedBranch = null;
  }
  //private isBranchResolutionAnalysed = false;
  get isBranchResolutionAnalysed() {
    return Z(
      this.flags,
      65536
      /* Flag.isBranchResolutionAnalysed */
    );
  }
  set isBranchResolutionAnalysed(e) {
    this.flags = ee(this.flags, 65536, e);
  }
  get hasDeoptimizedCache() {
    return Z(
      this.flags,
      33554432
      /* Flag.hasDeoptimizedCache */
    );
  }
  set hasDeoptimizedCache(e) {
    this.flags = ee(this.flags, 33554432, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.left.deoptimizeArgumentsOnInteractionAtPath(e, t, s), this.right.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizeCache() {
    if (this.hasDeoptimizedCache)
      return;
    if (this.hasDeoptimizedCache = !0, this.usedBranch) {
      const s = this.usedBranch === this.left ? this.right : this.left;
      this.usedBranch = null, s.deoptimizePath(O), this.included && s.includePath(O, it());
    }
    const { scope: { context: e }, expressionsToBeDeoptimized: t } = this;
    this.expressionsToBeDeoptimized = De;
    for (const s of t)
      s.deoptimizeCache();
    e.requestTreeshakingPass();
  }
  deoptimizePath(e) {
    const t = this.getUsedBranch();
    t ? t.deoptimizePath(e) : (this.left.deoptimizePath(e), this.right.deoptimizePath(e));
  }
  getLiteralValueAtPath(e, t, s) {
    if (s === this)
      return K;
    const n = this.getUsedBranch();
    if (n)
      return this.expressionsToBeDeoptimized.push(s), n.getLiteralValueAtPath(e, t, s);
    if (!this.hasDeoptimizedCache && !e.length) {
      const r = this.right.getLiteralValueAtPath(e, t, s), a = rs(r);
      if (typeof a != "symbol") {
        if (!a && this.operator === "&&")
          return this.expressionsToBeDeoptimized.push(s), ni;
        if (a && this.operator === "||")
          return this.expressionsToBeDeoptimized.push(s), si;
      }
    }
    return K;
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    const r = this.getUsedBranch();
    return r ? (this.expressionsToBeDeoptimized.push(n), r.getReturnExpressionWhenCalledAtPath(e, t, s, n)) : [
      new Ii([
        this.left.getReturnExpressionWhenCalledAtPath(e, t, s, n)[0],
        this.right.getReturnExpressionWhenCalledAtPath(e, t, s, n)[0]
      ]),
      !1
    ];
  }
  hasEffects(e) {
    return this.left.hasEffects(e) ? !0 : this.getUsedBranch() !== this.left ? this.right.hasEffects(e) : !1;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    const n = this.getUsedBranch();
    return n ? n.hasEffectsOnInteractionAtPath(e, t, s) : this.left.hasEffectsOnInteractionAtPath(e, t, s) || this.right.hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    this.included = !0;
    const s = this.getUsedBranch();
    t || !s || s === this.right && this.left.shouldBeIncluded(e) ? (this.left.include(e, t), this.right.include(e, t)) : s.include(e, t);
  }
  includePath(e, t) {
    this.included = !0;
    const s = this.getUsedBranch();
    !s || s === this.right && this.left.shouldBeIncluded(t) ? (this.left.includePath(e, t), this.right.includePath(e, t)) : s.includePath(e, t);
  }
  removeAnnotations(e) {
    this.left.removeAnnotations(e);
  }
  render(e, t, { isCalleeOfRenderedParent: s, preventASI: n, renderedParentType: r, renderedSurroundingElement: a } = Oe) {
    if (!this.left.included || !this.right.included) {
      const o = we(e.original, this.operator, this.left.end);
      if (this.right.included) {
        const l = Pt(e.original, o + 2);
        e.remove(this.start, l), n && Qn(e, l, this.right.start), this.left.removeAnnotations(e);
      } else
        e.remove(Cd(e.original, this.left.end, o), this.end);
      this.getUsedBranch().render(e, t, {
        isCalleeOfRenderedParent: s,
        preventASI: n,
        renderedParentType: r || this.parent.type,
        renderedSurroundingElement: a || this.parent.type
      });
    } else
      this.left.render(e, t, {
        preventASI: n,
        renderedSurroundingElement: a
      }), this.right.render(e, t);
  }
  getUsedBranch() {
    if (!this.isBranchResolutionAnalysed) {
      this.isBranchResolutionAnalysed = !0;
      const e = this.left.getLiteralValueAtPath(D, de, this), t = rs(e);
      if (typeof t == "symbol" || this.operator === "??" && typeof e == "symbol")
        return null;
      this.usedBranch = this.operator === "||" && t || this.operator === "&&" && !t || this.operator === "??" && e != null ? this.left : this.right;
    }
    return this.usedBranch;
  }
}
Li.prototype.includeNode = oe;
Li.prototype.applyDeoptimizations = Y;
class jc extends v {
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t of this.arguments)
      if (t.hasEffects(e))
        return !0;
    return this.annotationPure ? !1 : this.callee.hasEffects(e) || this.callee.hasEffectsOnInteractionAtPath(D, this.interaction, e);
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return e.length > 0 || t !== ge;
  }
  include(e, t) {
    this.included || this.includeNode(e), t ? super.include(e, !0) : (this.callee.include(e, !1), this.callee.includeCallArguments(this.interaction, e));
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.callee.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.interaction = {
      args: [null, ...this.arguments],
      type: X,
      withNew: !0
    }, this.annotations && this.scope.context.options.treeshake.annotations && (this.annotationPure = this.annotations.some((e) => e.type === "pure"));
  }
  render(e, t) {
    this.callee.render(e, t), vc(e, t, this);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.callee.deoptimizeArgumentsOnInteractionAtPath(this.interaction, D, de), this.scope.context.requestTreeshakingPass();
  }
}
class fs extends v {
  constructor() {
    super(...arguments), this.objectEntity = null, this.protoProp = null;
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.getObjectEntity().deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizeCache() {
    this.getObjectEntity().deoptimizeAllProperties();
  }
  deoptimizePath(e) {
    this.getObjectEntity().deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.getObjectEntity().getLiteralValueAtPath(e, t, s);
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.getObjectEntity().getReturnExpressionWhenCalledAtPath(e, t, s, n);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.getObjectEntity().hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    this.included || this.includeNode(e), this.getObjectEntity().include(e, t), this.protoProp?.include(e, t);
  }
  includeNode(e) {
    this.included = !0, this.protoProp?.includePath(O, e);
  }
  includePath(e, t) {
    this.included || this.includeNode(t), this.getObjectEntity().includePath(e, t);
  }
  render(e, t, { renderedSurroundingElement: s } = Oe) {
    if ((s === Ze || s === Ur) && (e.appendRight(this.start, "("), e.prependLeft(this.end, ")")), this.properties.length > 0) {
      const n = Yn(this.properties, e, this.start + 1, this.end - 1);
      let r = null;
      for (const { node: a, separator: o, start: l, end: c } of n) {
        if (!a.included) {
          ys(a, e, l, c);
          continue;
        }
        r = o, a.render(e, t);
      }
      r && e.remove(r, this.end - 1);
    }
  }
  getObjectEntity() {
    if (this.objectEntity !== null)
      return this.objectEntity;
    let e = bt;
    const t = [];
    for (const s of this.properties) {
      if (s instanceof Vt) {
        t.push({ key: W, kind: "init", property: s });
        continue;
      }
      let n;
      if (s.computed) {
        const r = s.key.getLiteralValueAtPath(D, de, this);
        if (typeof r == "symbol") {
          t.push({
            key: qr(r) ? r : W,
            kind: s.kind,
            property: s
          });
          continue;
        } else
          n = String(r);
      } else if (n = s.key instanceof ae ? s.key.name : String(s.key.value), n === "__proto__" && s.kind === "init") {
        this.protoProp = s, e = s.value instanceof Ve && s.value.value === null ? null : s.value;
        continue;
      }
      t.push({ key: n, kind: s.kind, property: s });
    }
    return this.objectEntity = new Ke(t, e);
  }
}
fs.prototype.applyDeoptimizations = Y;
class Hc extends v {
  initialise() {
    const { id: e } = this.scope.context.module, t = Vr(Il(this.message)), s = Fr(t, e);
    return R(s);
  }
}
class Gc extends v {
  initialise() {
    const e = this.start, { id: t } = this.scope.context.module, s = Vr(Il(this.message, e)), n = Fr(s, t);
    this.scope.context.error(n, e);
  }
}
class Sa extends v {
}
Sa.prototype.includeNode = Ce;
class Mi extends v {
  constructor() {
    super(...arguments), this.hasCachedEffect = null, this.hasLoggedEffect = !1;
  }
  hasCachedEffects() {
    return this.included ? this.hasCachedEffect === null ? this.hasCachedEffect = this.hasEffects(Es()) : this.hasCachedEffect : !1;
  }
  hasEffects(e) {
    for (const t of this.body)
      if (t.hasEffects(e)) {
        if (this.scope.context.options.experimentalLogSideEffects && !this.hasLoggedEffect) {
          this.hasLoggedEffect = !0;
          const { code: s, log: n, module: r } = this.scope.context;
          n(Bt, uh(s, r.id, xl(s, t.start, { offsetLine: 1 })), t.start);
        }
        return this.hasCachedEffect = !0;
      }
    return !1;
  }
  include(e, t) {
    this.included = !0;
    for (const s of this.body)
      (t || s.shouldBeIncluded(e)) && s.include(e, t);
  }
  initialise() {
    if (super.initialise(), this.invalidAnnotations)
      for (const { start: e, end: t, type: s } of this.invalidAnnotations)
        this.scope.context.magicString.remove(e, t), (s === "pure" || s === "noSideEffects") && this.scope.context.log(V, hh(this.scope.context.code.slice(e, t), this.scope.context.module.id, s), e);
  }
  render(e, t) {
    let s = this.start;
    if (e.original.startsWith("#!") && (s = Math.min(e.original.indexOf(`
`) + 1, this.end), e.remove(0, s)), this.body.length > 0) {
      for (; e.original[s] === "/" && /[*/]/.test(e.original[s + 1]); ) {
        const n = Ts(e.original.slice(s, this.body[0].start));
        if (n[0] === -1)
          break;
        s += n[1];
      }
      Hs(this.body, e, s, this.end, t);
    } else
      super.render(e, t);
  }
}
Mi.prototype.includeNode = oe;
Mi.prototype.applyDeoptimizations = Y;
class rn extends ui {
  //declare method: boolean;
  get method() {
    return Z(
      this.flags,
      262144
      /* Flag.method */
    );
  }
  set method(e) {
    this.flags = ee(this.flags, 262144, e);
  }
  //declare shorthand: boolean;
  get shorthand() {
    return Z(
      this.flags,
      524288
      /* Flag.shorthand */
    );
  }
  set shorthand(e) {
    this.flags = ee(this.flags, 524288, e);
  }
  declare(e, t, s) {
    return this.value.declare(e, this.getPathInProperty(t), s);
  }
  deoptimizeAssignment(e, t) {
    this.value.deoptimizeAssignment?.(this.getPathInProperty(e), t);
  }
  hasEffects(e) {
    return this.key.hasEffects(e) || this.value.hasEffects(e);
  }
  hasEffectsWhenDestructuring(e, t, s) {
    return this.value.hasEffectsWhenDestructuring?.(e, this.getPathInProperty(t), s);
  }
  includeDestructuredIfNecessary(e, t, s) {
    const n = this.getPathInProperty(t);
    let r = this.value.includeDestructuredIfNecessary(e, n, s) || this.included;
    return (r ||= this.key.hasEffects(Es())) && (this.key.include(e, !1), this.value.included || (this.value.includeNode(e), this.value.includeDestructuredIfNecessary(e, n, s))), !this.included && r && this.includeNode(e), this.included;
  }
  include(e, t) {
    this.included = !0, this.key.include(e, t), this.value.include(e, t);
  }
  includePath(e, t) {
    this.included = !0, this.value.includePath(e, t);
  }
  markDeclarationReached() {
    this.value.markDeclarationReached();
  }
  render(e, t) {
    this.shorthand || this.key.render(e, t), this.value.render(e, t, { isShorthandProperty: this.shorthand });
  }
  getPathInProperty(e) {
    return e.at(-1) === W ? e : (
      // For now, we only consider static paths as we do not know how to
      // deoptimize the path in the dynamic case.
      this.computed ? [...e, W] : this.key instanceof ae ? [...e, this.key.name] : [...e, String(this.key.value)]
    );
  }
}
rn.prototype.includeNode = oe;
rn.prototype.applyDeoptimizations = Y;
class Pa extends v {
  get computed() {
    return Z(
      this.flags,
      1024
      /* Flag.computed */
    );
  }
  set computed(e) {
    this.flags = ee(this.flags, 1024, e);
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.value?.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.value?.deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.value ? this.value.getLiteralValueAtPath(e, t, s) : K;
  }
  getReturnExpressionWhenCalledAtPath(e, t, s, n) {
    return this.value ? this.value.getReturnExpressionWhenCalledAtPath(e, t, s, n) : Se;
  }
  hasEffects(e) {
    return this.key.hasEffects(e) || this.static && !!this.value?.hasEffects(e) || ia(this.decorators, e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return !this.value || this.value.hasEffectsOnInteractionAtPath(e, t, s);
  }
  includeNode(e) {
    this.included = !0, this.value?.includePath(O, e);
    for (const t of this.decorators)
      t.includePath(O, e);
  }
}
Pa.prototype.applyDeoptimizations = Y;
class Ia extends v {
  hasEffects(e) {
    return !e.ignore.returnYield || this.argument?.hasEffects(e) ? !0 : (e.brokenFlow = !0, !1);
  }
  include(e, t) {
    this.included || this.includeNode(e), this.argument?.include(e, t), e.brokenFlow = !0;
  }
  includeNode(e) {
    this.included = !0, this.argument?.includePath(O, e);
  }
  initialise() {
    super.initialise(), this.scope.addReturnExpression(this.argument || G);
  }
  render(e, t) {
    this.argument && (this.argument.render(e, t, { preventASI: !0 }), this.argument.start === this.start + 6 && e.prependLeft(this.start + 6, " "));
  }
}
Ia.prototype.applyDeoptimizations = Y;
class Ti extends v {
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.expressions[this.expressions.length - 1].deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.expressions[this.expressions.length - 1].deoptimizePath(e);
  }
  getLiteralValueAtPath(e, t, s) {
    return this.expressions[this.expressions.length - 1].getLiteralValueAtPath(e, t, s);
  }
  hasEffects(e) {
    for (const t of this.expressions)
      if (t.hasEffects(e))
        return !0;
    return !1;
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return this.expressions[this.expressions.length - 1].hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e, t) {
    this.included = !0;
    const s = this.expressions[this.expressions.length - 1];
    for (const n of this.expressions)
      (t || n === s && !(this.parent instanceof Nt) || n.shouldBeIncluded(e)) && n.include(e, t);
  }
  includePath(e, t) {
    this.included = !0, this.expressions[this.expressions.length - 1].includePath(e, t);
  }
  removeAnnotations(e) {
    this.expressions[0].removeAnnotations(e);
  }
  render(e, t, { renderedParentType: s, isCalleeOfRenderedParent: n, preventASI: r } = Oe) {
    let a = 0, o = null;
    const l = this.expressions[this.expressions.length - 1];
    for (const { node: c, separator: h, start: p, end: d } of Yn(this.expressions, e, this.start, this.end)) {
      if (!c.included) {
        ys(c, e, p, d);
        continue;
      }
      if (a++, o = h, a === 1 && r && Qn(e, p, c.start), a === 1) {
        const m = s || this.parent.type;
        c.render(e, t, {
          isCalleeOfRenderedParent: n && c === l,
          renderedParentType: m,
          renderedSurroundingElement: m
        });
      } else
        c.render(e, t);
    }
    o && e.remove(o, this.end);
  }
}
Ti.prototype.includeNode = oe;
Ti.prototype.applyDeoptimizations = Y;
class Wc extends v {
  bind() {
    this.variable = this.scope.findVariable("this");
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.variable.deoptimizePath(e);
  }
  include(e) {
    this.included || this.includeNode(e);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.scope.context.includeVariableInModule(this.variable, D, e);
  }
}
class an extends v {
  hasEffects(e) {
    if (this.test?.hasEffects(e))
      return !0;
    for (const t of this.consequent) {
      if (e.brokenFlow)
        break;
      if (t.hasEffects(e))
        return !0;
    }
    return !1;
  }
  include(e, t) {
    this.included = !0, this.test?.include(e, t);
    for (const s of this.consequent)
      (t || s.shouldBeIncluded(e)) && s.include(e, t);
  }
  render(e, t, s) {
    if (this.test && (this.test.render(e, t), this.test.start === this.start + 4 && e.prependLeft(this.test.start, " ")), this.consequent.length > 0) {
      const n = this.test ? this.test.end : we(e.original, "default", this.start) + 7, r = we(e.original, ":", n) + 1;
      Hs(this.consequent, e, r, s.end, t);
    }
  }
}
an.prototype.needsBoundaries = !0;
an.prototype.includeNode = oe;
an.prototype.applyDeoptimizations = Y;
class Bi extends v {
  createScope(e) {
    this.parentScope = e, this.scope = new Wt(e);
  }
  hasEffects(e) {
    if (this.discriminant.hasEffects(e))
      return !0;
    const { brokenFlow: t, hasBreak: s, ignore: n } = e, { breaks: r } = n;
    n.breaks = !0, e.hasBreak = !1;
    let a = !0;
    for (const o of this.cases) {
      if (o.hasEffects(e))
        return !0;
      a &&= e.brokenFlow && !e.hasBreak, e.hasBreak = !1, e.brokenFlow = t;
    }
    return this.defaultCase !== null && (e.brokenFlow = a), n.breaks = r, e.hasBreak = s, !1;
  }
  include(e, t) {
    this.included = !0, this.discriminant.include(e, t);
    const { brokenFlow: s, hasBreak: n } = e;
    e.hasBreak = !1;
    let r = !0, a = t || this.defaultCase !== null && this.defaultCase < this.cases.length - 1;
    for (let o = this.cases.length - 1; o >= 0; o--) {
      const l = this.cases[o];
      if (l.included && (a = !0), !a) {
        const c = Es();
        c.ignore.breaks = !0, a = l.hasEffects(c);
      }
      a ? (l.include(e, t), r &&= e.brokenFlow && !e.hasBreak, e.hasBreak = !1, e.brokenFlow = s) : r = s;
    }
    a && this.defaultCase !== null && (e.brokenFlow = r), e.hasBreak = n;
  }
  initialise() {
    super.initialise();
    for (let e = 0; e < this.cases.length; e++)
      if (this.cases[e].test === null) {
        this.defaultCase = e;
        return;
      }
    this.defaultCase = null;
  }
  parseNode(e) {
    return this.discriminant = new (this.scope.context.getNodeConstructor(e.discriminant.type))(this, this.parentScope).parseNode(e.discriminant), super.parseNode(e);
  }
  render(e, t) {
    this.discriminant.render(e, t), this.cases.length > 0 && Hs(this.cases, e, this.cases[0].start, this.end - 1, t);
  }
}
Bi.prototype.includeNode = oe;
Bi.prototype.applyDeoptimizations = Y;
class Na extends kc {
  get hasCheckedForWarnings() {
    return Z(
      this.flags,
      134217728
      /* Flag.checkedForWarnings */
    );
  }
  set hasCheckedForWarnings(e) {
    this.flags = ee(this.flags, 134217728, e);
  }
  hasEffects(e) {
    this.deoptimized || this.applyDeoptimizations();
    for (const t of this.quasi.expressions)
      if (t.hasEffects(e))
        return !0;
    return this.tag.hasEffects(e) || this.tag.hasEffectsOnInteractionAtPath(D, this.interaction, e);
  }
  include(e, t) {
    this.included || this.includeNode(e), t ? super.include(e, !0) : (this.quasi.include(e, !1), this.tag.include(e, !1), this.tag.includeCallArguments(this.interaction, e));
  }
  initialise() {
    super.initialise(), this.args = [G, ...this.quasi.expressions], this.interaction = {
      args: [
        this.tag instanceof jt && !this.tag.variable ? this.tag.object : null,
        ...this.args
      ],
      type: X,
      withNew: !1
    };
  }
  render(e, t) {
    if (this.tag.render(e, t, { isCalleeOfRenderedParent: !0 }), this.quasi.render(e, t), !this.hasCheckedForWarnings && this.tag.type === zr) {
      this.hasCheckedForWarnings = !0;
      const s = this.tag.name;
      this.scope.findVariable(s).isNamespace && this.scope.context.log(V, Pl(s), this.start);
    }
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.tag.deoptimizeArgumentsOnInteractionAtPath(this.interaction, D, de), this.scope.context.requestTreeshakingPass();
  }
  getReturnExpression(e = de) {
    return this.returnExpression === null ? (this.returnExpression = Se, this.returnExpression = this.tag.getReturnExpressionWhenCalledAtPath(D, this.interaction, e, this)) : this.returnExpression;
  }
}
Na.prototype.includeNode = Ce;
class $a extends v {
  get tail() {
    return Z(
      this.flags,
      1048576
      /* Flag.tail */
    );
  }
  set tail(e) {
    this.flags = ee(this.flags, 1048576, e);
  }
  // Do not try to bind value
  bind() {
  }
  hasEffects() {
    return !1;
  }
  parseNode(e) {
    return this.value = e.value, super.parseNode(e);
  }
  render() {
  }
}
$a.prototype.includeNode = Ce;
class Kc extends v {
  deoptimizeArgumentsOnInteractionAtPath() {
  }
  getLiteralValueAtPath(e) {
    return e.length > 0 || this.quasis.length !== 1 ? K : this.quasis[0].value.cooked;
  }
  getReturnExpressionWhenCalledAtPath(e) {
    return e.length !== 1 ? Se : qs(_s, e[0]);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return t.type === ge ? e.length > 1 : t.type === X && e.length === 1 ? Ks(_s, e[0], t, s) : !0;
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations();
    for (const t of this.expressions)
      t.includePath(O, e);
  }
  render(e, t) {
    e.indentExclusionRanges.push([this.start, this.end]), super.render(e, t);
  }
}
class qc extends Ge {
  constructor(e, t, s) {
    super(e, t), this.importDescriptions = s, this.variables.set("this", new et("this", null, mt, D, t, "other"));
  }
  addDeclaration(e, t, s, n, r) {
    return this.importDescriptions.has(e.name) && t.error(gs(e.name), e.start), super.addDeclaration(e, t, s, n, r);
  }
  addExportDefaultDeclaration(e, t) {
    const s = new lt(e, t);
    return this.variables.set("default", s), s;
  }
  addNamespaceMemberAccess() {
  }
  deconflict(e, t, s) {
    for (const n of this.children)
      n.deconflict(e, t, s);
  }
  findLexicalBoundary() {
    return this;
  }
  findVariable(e) {
    const t = this.variables.get(e) || this.accessedOutsideVariables.get(e);
    if (t)
      return t;
    const s = this.context.traceVariable(e) || this.parent.findVariable(e);
    return s instanceof na && this.accessedOutsideVariables.set(e, s), s;
  }
}
class Xc extends v {
  bind() {
    this.variable = this.scope.findVariable("this");
  }
  deoptimizeArgumentsOnInteractionAtPath(e, t, s) {
    this.variable.deoptimizeArgumentsOnInteractionAtPath(e, t, s);
  }
  deoptimizePath(e) {
    this.variable.deoptimizePath(e);
  }
  hasEffectsOnInteractionAtPath(e, t, s) {
    return e.length === 0 ? t.type !== ge : this.variable.hasEffectsOnInteractionAtPath(e, t, s);
  }
  include(e) {
    this.included || this.includeNode(e);
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.scope.context.includeVariableInModule(this.variable, D, e);
  }
  includePath(e, t) {
    this.included ? e.length > 0 && this.variable.includePath(e, t) : (this.included = !0, this.scope.context.includeVariableInModule(this.variable, e, t));
    const s = If(this.scope, this.variable);
    s && s.functionNode.parent instanceof rn && s.functionNode.parent.parent instanceof fs && s.functionNode.parent.parent.includePath(e, t);
  }
  initialise() {
    super.initialise(), this.alias = this.scope.findLexicalBoundary() instanceof qc ? this.scope.context.moduleContext : null, this.alias === "undefined" && this.scope.context.log(V, ch(), this.start);
  }
  render(e) {
    this.alias !== null && e.overwrite(this.start, this.end, this.alias, {
      contentOnly: !1,
      storeName: !0
    });
  }
}
function If(i, e) {
  for (; !(i instanceof oc && i.thisVariable === e); ) {
    if (!(i instanceof Ge))
      return null;
    i = i.parent;
  }
  return i;
}
class Jc extends v {
  hasEffects() {
    return !0;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.argument.include(e, t), e.brokenFlow = !0;
  }
  includeNode(e) {
    this.included || (this.included = !0, this.argument.includePath(O, e));
  }
  render(e, t) {
    this.argument.render(e, t, { preventASI: !0 }), this.argument.start === this.start + 5 && e.prependLeft(this.start + 5, " ");
  }
}
class _i extends v {
  constructor() {
    super(...arguments), this.directlyIncluded = !1, this.includedLabelsAfterBlock = null;
  }
  hasEffects(e) {
    return (this.scope.context.options.treeshake.tryCatchDeoptimization ? this.block.body.length > 0 : this.block.hasEffects(e)) || !!this.finalizer?.hasEffects(e);
  }
  include(e, t) {
    const s = this.scope.context.options.treeshake?.tryCatchDeoptimization, { brokenFlow: n, includedLabels: r } = e;
    if (!this.directlyIncluded || !s)
      this.included = !0, this.directlyIncluded = !0, this.block.include(e, s ? Yl : t), r.size > 0 && (this.includedLabelsAfterBlock = [...r]), e.brokenFlow = n;
    else if (this.includedLabelsAfterBlock)
      for (const a of this.includedLabelsAfterBlock)
        r.add(a);
    this.handler !== null && (this.handler.include(e, t), e.brokenFlow = n), this.finalizer?.include(e, t);
  }
}
_i.prototype.includeNode = oe;
_i.prototype.applyDeoptimizations = Y;
const Nf = {
  "!": (i) => !i,
  "+": (i) => +i,
  "-": (i) => -i,
  delete: () => K,
  typeof: (i) => typeof i,
  void: () => {
  },
  "~": (i) => ~i
}, Fo = /* @__PURE__ */ Symbol("Unassigned");
class wa extends v {
  constructor() {
    super(...arguments), this.renderedLiteralValue = Fo;
  }
  get prefix() {
    return Z(
      this.flags,
      2097152
      /* Flag.prefix */
    );
  }
  set prefix(e) {
    this.flags = ee(this.flags, 2097152, e);
  }
  deoptimizeCache() {
    this.renderedLiteralValue = K;
  }
  getLiteralValueAtPath(e, t, s) {
    if (e.length > 0)
      return K;
    const n = this.argument.getLiteralValueAtPath(D, t, s);
    if (typeof n == "symbol") {
      if (this.operator === "void")
        return;
      if (this.operator === "!") {
        if (n === ni)
          return !0;
        if (n === si)
          return !1;
      }
      return K;
    }
    return Nf[this.operator](n);
  }
  hasEffects(e) {
    return this.deoptimized || this.applyDeoptimizations(), this.operator === "typeof" && this.argument instanceof ae ? !1 : this.argument.hasEffects(e) || this.operator === "delete" && this.argument.hasEffectsOnInteractionAtPath(D, Yr, e);
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return t !== ge || e.length > (this.operator === "void" ? 0 : 1);
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.operator === "delete" && (this.argument.deoptimizePath(D), this.scope.context.requestTreeshakingPass());
  }
  getRenderedLiteralValue(e) {
    return this.renderedLiteralValue !== Fo ? this.renderedLiteralValue : this.renderedLiteralValue = e ? K : Cc(this.getLiteralValueAtPath(D, de, this));
  }
  include(e, t, s) {
    this.deoptimized || this.applyDeoptimizations(), this.included = !0;
    const n = this.argument instanceof ae && this.argument.variable?.included;
    (typeof this.getRenderedLiteralValue(t) == "symbol" || this.argument.shouldBeIncluded(e) || n) && (this.argument.include(e, t), this.renderedLiteralValue = K);
  }
  render(e, t) {
    if (typeof this.renderedLiteralValue == "symbol")
      super.render(e, t);
    else {
      let s = this.renderedLiteralValue;
      $f.test(e.original[this.start - 1]) || (s = ` ${s}`), e.overwrite(this.start, this.end, s);
    }
  }
}
const $f = /[\s([=%&*+-/<>^|,?:;]/;
wa.prototype.includeNode = Ce;
class Ca extends v {
  hasEffects(e) {
    return this.deoptimized || this.applyDeoptimizations(), this.argument.hasEffectsAsAssignmentTarget(e, !0);
  }
  hasEffectsOnInteractionAtPath(e, { type: t }) {
    return e.length > 1 || t !== ge;
  }
  include(e, t) {
    this.included || this.includeNode(e), this.argument.includeAsAssignmentTarget(e, t, !0);
  }
  initialise() {
    super.initialise(), this.argument.setAssignedValue(G);
  }
  render(e, t) {
    const { exportNamesByVariable: s, format: n, snippets: { _: r } } = t;
    if (this.argument.render(e, t), n === "system") {
      const a = this.argument.variable, o = s.get(a);
      if (o)
        if (this.prefix)
          o.length === 1 ? Hr(a, this.start, this.end, e, t) : Wl(a, this.start, this.end, this.parent.type !== Ze, e, t);
        else {
          const l = this.operator[0];
          kd(a, this.start, this.end, this.parent.type !== Ze, e, t, `${r}${l}${r}1`);
        }
    }
  }
  applyDeoptimizations() {
    this.deoptimized = !0, this.argument.deoptimizePath(D), this.argument instanceof ae && this.scope.findVariable(this.argument.name).markReassigned(), this.scope.context.requestTreeshakingPass();
  }
}
Ca.prototype.includeNode = Ce;
function Yc(i, e) {
  return i.renderBaseName !== null && e.has(i) && i.isReassigned;
}
class on extends v {
  deoptimizePath() {
    for (const e of this.declarations)
      e.deoptimizePath(D);
  }
  hasEffectsOnInteractionAtPath() {
    return !1;
  }
  include(e, t, { asSingleStatement: s } = Oe) {
    this.included = !0;
    for (const n of this.declarations) {
      (t || n.shouldBeIncluded(e)) && n.include(e, t);
      const { id: r, init: a } = n;
      s && r.include(e, t), a && r.included && !a.included && (r instanceof As || r instanceof bi) && a.include(e, t);
    }
  }
  initialise() {
    super.initialise();
    for (const e of this.declarations)
      e.declareDeclarator(this.kind);
  }
  removeAnnotations(e) {
    this.declarations[0].removeAnnotations(e);
  }
  render(e, t, s = Oe) {
    if (this.areAllDeclarationsIncludedAndNotExported(t.exportNamesByVariable)) {
      for (const n of this.declarations)
        n.render(e, t);
      !s.isNoStatement && e.original.charCodeAt(this.end - 1) !== 59 && e.appendLeft(this.end, ";");
    } else
      this.renderReplacedDeclarations(e, t);
  }
  renderDeclarationEnd(e, t, s, n, r, a, o) {
    e.original.charCodeAt(this.end - 1) === 59 && e.remove(this.end - 1, this.end), t += ";", s === null ? e.appendLeft(r, t) : (e.original.charCodeAt(n - 1) === 10 && (e.original.charCodeAt(this.end) === 10 || e.original.charCodeAt(this.end) === 13) && (n--, e.original.charCodeAt(n) === 13 && n--), n === s + 1 ? e.overwrite(s, r, t) : (e.overwrite(s, s + 1, t), e.remove(n, r))), a.length > 0 && e.appendLeft(r, ` ${Ht(a, o)};`);
  }
  renderReplacedDeclarations(e, t) {
    const s = Yn(this.declarations, e, this.start + this.kind.length, this.end - (e.original.charCodeAt(this.end - 1) === 59 ? 1 : 0));
    let n, r;
    r = Pt(e.original, this.start + this.kind.length);
    let a = r - 1;
    e.remove(this.start, a);
    let o = !1, l = !1, c = "", h, p;
    const d = [], m = wf(s, t, d);
    for (const { node: f, start: g, separator: y, contentEnd: b, end: E } of s) {
      if (!f.included) {
        ys(f, e, g, E);
        continue;
      }
      if (f.render(e, t), h = "", p = "", !f.id.included || f.id instanceof ae && Yc(f.id.variable, t.exportNamesByVariable))
        l && (c += ";"), o = !1;
      else {
        if (m && m === f.id.variable) {
          const A = we(e.original, "=", f.id.end);
          Hr(m, Pt(e.original, A + 1), y === null ? b : y, e, t);
        }
        o ? c += "," : (l && (c += ";"), h += `${this.kind} `, o = !0);
      }
      r === a + 1 ? e.overwrite(a, r, c + h) : (e.overwrite(a, a + 1, c), e.appendLeft(r, h)), n = b, r = E, l = !0, a = y, c = p;
    }
    this.renderDeclarationEnd(e, c, a, n, r, d, t);
  }
  areAllDeclarationsIncludedAndNotExported(e) {
    if (this.kind === "await using" || this.kind === "using")
      return !0;
    for (const t of this.declarations) {
      if (!t.id.included)
        return !1;
      if (t.id.type === zr) {
        if (e.has(t.id.variable))
          return !1;
      } else {
        const s = [];
        if (t.id.addExportedVariables(s, e), s.length > 0)
          return !1;
      }
    }
    return !0;
  }
}
function wf(i, e, t) {
  let s = null;
  if (e.format === "system") {
    for (const { node: n } of i)
      n.id instanceof ae && n.init && t.length === 0 && e.exportNamesByVariable.get(n.id.variable)?.length === 1 ? (s = n.id.variable, t.push(s)) : n.id.addExportedVariables(t, e.exportNamesByVariable);
    t.length > 1 ? s = null : s && (t.length = 0);
  }
  return s;
}
on.prototype.includeNode = oe;
on.prototype.applyDeoptimizations = Y;
class va extends v {
  declareDeclarator(e) {
    this.isUsingDeclaration = e === "using", this.isAsyncUsingDeclaration = e === "await using", this.id.declare(e, D, this.init || mt);
  }
  deoptimizePath(e) {
    this.id.deoptimizePath(e);
  }
  hasEffects(e) {
    const t = this.init?.hasEffects(e);
    return this.id.markDeclarationReached(), t || this.isUsingDeclaration || this.isAsyncUsingDeclaration || this.id.hasEffects(e) || this.scope.context.options.treeshake.propertyReadSideEffects && this.id.hasEffectsWhenDestructuring(e, D, this.init || mt);
  }
  include(e, t) {
    const { id: s, init: n } = this;
    this.included || this.includeNode(e), n?.include(e, t), s.markDeclarationReached(), t ? s.include(e, t) : s.includeDestructuredIfNecessary(e, D, n || mt);
  }
  removeAnnotations(e) {
    this.init?.removeAnnotations(e);
  }
  render(e, t) {
    const { exportNamesByVariable: s, snippets: { _: n, getPropertyAccess: r } } = t, { end: a, id: o, init: l, start: c } = this, h = o.included || this.isUsingDeclaration || this.isAsyncUsingDeclaration;
    if (h)
      o.render(e, t);
    else {
      const p = we(e.original, "=", o.end);
      e.remove(c, Pt(e.original, p + 1));
    }
    l ? (o instanceof ae && l instanceof Vn && !l.id && o.variable.getName(r) !== o.name && e.appendLeft(l.start + 5, ` ${o.name}`), l.render(e, t, h ? Oe : { renderedSurroundingElement: Ze })) : o instanceof ae && Yc(o.variable, s) && e.appendLeft(a, `${n}=${n}void 0`);
  }
  includeNode(e) {
    this.included = !0;
    const { id: t, init: s } = this;
    if (s && (this.isUsingDeclaration ? s.includePath(Cf, e) : this.isAsyncUsingDeclaration && s.includePath(vf, e), t instanceof ae && s instanceof Vn && !s.id)) {
      const { name: n, variable: r } = t;
      for (const a of s.scope.accessedOutsideVariables.values())
        a !== r && a.forbidName(n);
    }
  }
}
va.prototype.applyDeoptimizations = Y;
const Cf = [Zn], vf = [ei];
class Fi extends v {
  hasEffects(e) {
    return this.test.hasEffects(e) ? !0 : wi(e, this.body);
  }
  include(e, t) {
    this.included = !0, this.test.include(e, t), Ys(e, this.body, t);
  }
}
Fi.prototype.includeNode = oe;
Fi.prototype.applyDeoptimizations = Y;
class Qc extends v {
  applyDeoptimizations() {
    this.deoptimized = !0, this.argument?.deoptimizePath(O);
  }
  hasEffects(e) {
    return this.deoptimized || this.applyDeoptimizations(), !(e.ignore.returnYield && !this.argument?.hasEffects(e));
  }
  includeNode(e) {
    this.included = !0, this.deoptimized || this.applyDeoptimizations(), this.argument?.includePath(O, e);
  }
  render(e, t) {
    this.argument && (this.argument.render(e, t, { preventASI: !0 }), this.argument.start === this.start + 5 && e.prependLeft(this.start + 5, " "));
  }
}
function kf(i, e, t) {
  return $(e, t, 0, yh(i));
}
const Rf = [
  "PanicError",
  "ParseError",
  "ArrayExpression",
  "ArrayPattern",
  "ArrowFunctionExpression",
  "AssignmentExpression",
  "AssignmentPattern",
  "AwaitExpression",
  "BinaryExpression",
  "BlockStatement",
  "BreakStatement",
  "CallExpression",
  "CatchClause",
  "ChainExpression",
  "ClassBody",
  "ClassDeclaration",
  "ClassExpression",
  "ConditionalExpression",
  "ContinueStatement",
  "DebuggerStatement",
  "Decorator",
  "ExpressionStatement",
  "DoWhileStatement",
  "EmptyStatement",
  "ExportAllDeclaration",
  "ExportDefaultDeclaration",
  "ExportNamedDeclaration",
  "ExportSpecifier",
  "ExpressionStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "FunctionDeclaration",
  "FunctionExpression",
  "Identifier",
  "IfStatement",
  "ImportAttribute",
  "ImportDeclaration",
  "ImportDefaultSpecifier",
  "ImportExpression",
  "ImportNamespaceSpecifier",
  "ImportSpecifier",
  "JSXAttribute",
  "JSXClosingElement",
  "JSXClosingFragment",
  "JSXElement",
  "JSXEmptyExpression",
  "JSXExpressionContainer",
  "JSXFragment",
  "JSXIdentifier",
  "JSXMemberExpression",
  "JSXNamespacedName",
  "JSXOpeningElement",
  "JSXOpeningFragment",
  "JSXSpreadAttribute",
  "JSXSpreadChild",
  "JSXText",
  "LabeledStatement",
  "Literal",
  "Literal",
  "Literal",
  "Literal",
  "Literal",
  "Literal",
  "LogicalExpression",
  "MemberExpression",
  "MetaProperty",
  "MethodDefinition",
  "NewExpression",
  "ObjectExpression",
  "ObjectPattern",
  "PrivateIdentifier",
  "Program",
  "Property",
  "PropertyDefinition",
  "RestElement",
  "ReturnStatement",
  "SequenceExpression",
  "SpreadElement",
  "StaticBlock",
  "Super",
  "SwitchCase",
  "SwitchStatement",
  "TaggedTemplateExpression",
  "TemplateElement",
  "TemplateLiteral",
  "ThisExpression",
  "ThrowStatement",
  "TryStatement",
  "UnaryExpression",
  "UpdateExpression",
  "VariableDeclaration",
  "VariableDeclarator",
  "WhileStatement",
  "YieldExpression"
], Df = [
  Hc,
  Gc,
  sa,
  bi,
  ua,
  Nc,
  $c,
  wc,
  ha,
  Kt,
  Ai,
  Rc,
  xi,
  Si,
  Pi,
  hs,
  Vn,
  Ni,
  $i,
  da,
  pa,
  Nt,
  Ci,
  fa,
  xs,
  qt,
  Qs,
  vi,
  Nt,
  Dc,
  Oc,
  ki,
  ds,
  Lc,
  ae,
  Ss,
  Mc,
  Zs,
  en,
  ma,
  tn,
  Ri,
  Di,
  Tc,
  Bc,
  _c,
  sn,
  Oi,
  Fc,
  ga,
  zc,
  ba,
  Aa,
  Vc,
  jn,
  Uc,
  nn,
  xa,
  Ve,
  Ve,
  Ve,
  Ve,
  Ve,
  Ve,
  Li,
  jt,
  fc,
  Fn,
  jc,
  fs,
  As,
  Sa,
  Mi,
  rn,
  Pa,
  Lt,
  Ia,
  Ti,
  Vt,
  hi,
  Wc,
  an,
  Bi,
  Na,
  $a,
  Kc,
  Xc,
  Jc,
  _i,
  wa,
  Ca,
  on,
  va,
  Fi,
  Qc
], Of = [
  function(e, t, s) {
    e.message = s.convertString(s[t]);
  },
  function(e, t, s) {
    e.message = s.convertString(s[t]);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.elements = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.elements = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.async = (r & 1) === 1, e.expression = (r & 2) === 2, e.generator = (r & 4) === 4;
    const a = e.annotations = Xt(s[t + 1], s);
    e.annotationNoSideEffects = a.some((l) => l.type === "noSideEffects");
    const o = e.params = ue(e, n, s[t + 2], s);
    n.addParameterVariables(o.map((l) => l.declare("parameter", D, G)), o[o.length - 1] instanceof Lt), e.body = $(e, n.bodyScope, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.operator = yt[s[t]], e.left = $(e, n, s[t + 1], s), e.right = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.left = $(e, n, s[t], s), e.right = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.argument = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.operator = yt[s[t]], e.left = $(e, n, s[t + 1], s), e.right = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.body = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.label = r === 0 ? null : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.optional = (r & 1) === 1, e.annotations = Xt(s[t + 1], s), e.callee = $(e, n, s[t + 2], s), e.arguments = ue(e, n, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    (e.param = r === 0 ? null : $(e, n, r, s))?.declare("parameter", D, G), e.body = $(e, n.bodyScope, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expression = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    if (r) {
      const a = s[r], o = e.body = new Array(a);
      for (let l = 0; l < a; l++) {
        const c = s[r + 1 + l];
        o[l] = $(e, s[c] !== 79 && (s[c + 3] & /* the static flag is always first */
        1) === 0 ? n.instanceScope : n, c, s);
      }
    } else
      e.body = [];
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.decorators = ue(e, n, s[t], s);
    const r = s[t + 1];
    e.id = r === 0 ? null : $(e, n.parent, r, s);
    const a = s[t + 2];
    e.superClass = a === 0 ? null : $(e, n, a, s), e.body = $(e, n, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.decorators = ue(e, n, s[t], s);
    const r = s[t + 1];
    e.id = r === 0 ? null : $(e, n, r, s);
    const a = s[t + 2];
    e.superClass = a === 0 ? null : $(e, n, a, s), e.body = $(e, n, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.test = $(e, n, s[t], s), e.consequent = $(e, n, s[t + 1], s), e.alternate = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.label = r === 0 ? null : $(e, n, r, s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expression = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.directive = s.convertString(s[t]), e.expression = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.body = $(e, n, s[t], s), e.test = $(e, n, s[t + 1], s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.exported = r === 0 ? null : $(e, n, r, s), e.source = $(e, n, s[t + 1], s), e.attributes = ue(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.declaration = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.specifiers = ue(e, n, s[t], s);
    const r = s[t + 1];
    e.source = r === 0 ? null : $(e, n, r, s), e.attributes = ue(e, n, s[t + 2], s);
    const a = s[t + 3];
    e.declaration = a === 0 ? null : $(e, n, a, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.local = $(e, n, s[t], s);
    const r = s[t + 1];
    e.exported = r === 0 ? e.local : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expression = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.left = $(e, n, s[t], s), e.right = $(e, n, s[t + 1], s), e.body = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.await = (r & 1) === 1, e.left = $(e, n, s[t + 1], s), e.right = $(e, n, s[t + 2], s), e.body = $(e, n, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.init = r === 0 ? null : $(e, n, r, s);
    const a = s[t + 1];
    e.test = a === 0 ? null : $(e, n, a, s);
    const o = s[t + 2];
    e.update = o === 0 ? null : $(e, n, o, s), e.body = $(e, n, s[t + 3], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.async = (r & 1) === 1, e.generator = (r & 2) === 2;
    const a = e.annotations = Xt(s[t + 1], s);
    e.annotationNoSideEffects = a.some((c) => c.type === "noSideEffects");
    const o = s[t + 2];
    e.id = o === 0 ? null : $(e, n.parent, o, s);
    const l = e.params = ue(e, n, s[t + 3], s);
    n.addParameterVariables(l.map((c) => c.declare("parameter", D, G)), l[l.length - 1] instanceof Lt), e.body = $(e, n.bodyScope, s[t + 4], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.async = (r & 1) === 1, e.generator = (r & 2) === 2;
    const a = e.annotations = Xt(s[t + 1], s);
    e.annotationNoSideEffects = a.some((c) => c.type === "noSideEffects");
    const o = s[t + 2];
    e.id = o === 0 ? null : $(e, e.idScope, o, s);
    const l = e.params = ue(e, n, s[t + 3], s);
    n.addParameterVariables(l.map((c) => c.declare("parameter", D, G)), l[l.length - 1] instanceof Lt), e.body = $(e, n.bodyScope, s[t + 4], s);
  },
  function(e, t, s) {
    e.name = s.convertString(s[t]);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.test = $(e, n, s[t], s), e.consequent = $(e, e.consequentScope = new Un(n), s[t + 1], s);
    const r = s[t + 2];
    e.alternate = r === 0 ? null : $(e, e.alternateScope = new Un(n), r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.key = $(e, n, s[t], s), e.value = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.specifiers = ue(e, n, s[t], s), e.source = $(e, n, s[t + 1], s), e.attributes = ue(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.local = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.source = $(e, n, s[t], s), e.sourceAstNode = jh(s[t], s);
    const r = s[t + 1];
    e.options = r === 0 ? null : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.local = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.local = $(e, n, s[t + 1], s), e.imported = r === 0 ? e.local : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.name = $(e, n, s[t], s);
    const r = s[t + 1];
    e.value = r === 0 ? null : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.name = $(e, n, s[t], s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.openingElement = $(e, n, s[t], s), e.children = ue(e, n, s[t + 1], s);
    const r = s[t + 2];
    e.closingElement = r === 0 ? null : $(e, n, r, s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expression = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.openingFragment = $(e, n, s[t], s), e.children = ue(e, n, s[t + 1], s), e.closingFragment = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    e.name = s.convertString(s[t]);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.object = $(e, n, s[t], s), e.property = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.namespace = $(e, n, s[t], s), e.name = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.selfClosing = (r & 1) === 1, e.name = $(e, n, s[t + 1], s), e.attributes = ue(e, n, s[t + 2], s);
  },
  function(e) {
    e.attributes = [], e.selfClosing = !1;
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.argument = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expression = $(e, n, s[t], s);
  },
  function(e, t, s) {
    e.value = s.convertString(s[t]), e.raw = s.convertString(s[t + 1]);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.label = $(e, n, s[t], s), e.body = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const n = e.bigint = s.convertString(s[t]);
    e.raw = s.convertString(s[t + 1]), e.value = BigInt(n);
  },
  function(e, t, s) {
    const n = s[t], r = e.value = (n & 1) === 1;
    e.raw = r ? "true" : "false";
  },
  function(e) {
    e.value = null;
  },
  function(e, t, s) {
    const n = s[t];
    e.raw = n === 0 ? void 0 : s.convertString(n), e.value = new DataView(s.buffer).getFloat64(t + 1 << 2, !0);
  },
  function(e, t, s) {
    const n = s.convertString(s[t]), r = s.convertString(s[t + 1]);
    e.raw = `/${r}/${n}`, e.regex = { flags: n, pattern: r }, e.value = new RegExp(r, n);
  },
  function(e, t, s) {
    e.value = s.convertString(s[t]);
    const n = s[t + 1];
    e.raw = n === 0 ? void 0 : s.convertString(n);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.operator = yt[s[t]], e.left = $(e, n, s[t + 1], s), e.right = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.computed = (r & 1) === 1, e.optional = (r & 2) === 2, e.object = $(e, n, s[t + 1], s), e.property = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.meta = $(e, n, s[t], s), e.property = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.static = (r & 1) === 1, e.computed = (r & 2) === 2, e.decorators = ue(e, n, s[t + 1], s), e.key = $(e, n, s[t + 2], s), e.value = $(e, n, s[t + 3], s), e.kind = yt[s[t + 4]];
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.annotations = Xt(s[t], s), e.callee = $(e, n, s[t + 1], s), e.arguments = ue(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.properties = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.properties = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    e.name = s.convertString(s[t]);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.body = ue(e, n, s[t], s), e.invalidAnnotations = Xt(s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.method = (r & 1) === 1, e.shorthand = (r & 2) === 2, e.computed = (r & 4) === 4;
    const a = s[t + 1];
    e.value = $(e, n, s[t + 2], s), e.kind = yt[s[t + 3]], e.key = a === 0 ? e.value : $(e, n, a, s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.static = (r & 1) === 1, e.computed = (r & 2) === 2, e.decorators = ue(e, n, s[t + 1], s), e.key = $(e, n, s[t + 2], s);
    const a = s[t + 3];
    e.value = a === 0 ? null : $(e, n, a, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.argument = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.argument = r === 0 ? null : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.expressions = ue(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.argument = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.body = ue(e, n, s[t], s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.test = r === 0 ? null : $(e, n, r, s), e.consequent = ue(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.discriminant = $(e, e.parentScope, s[t], s), e.cases = ue(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.tag = $(e, n, s[t], s), e.quasi = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const n = s[t];
    e.tail = (n & 1) === 1;
    const r = s[t + 1], a = r === 0 ? null : s.convertString(r), o = s.convertString(s[t + 2]);
    e.value = { cooked: a, raw: o };
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.quasis = ue(e, n, s[t], s), e.expressions = ue(e, n, s[t + 1], s);
  },
  function() {
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.argument = $(e, n, s[t], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.block = $(e, n, s[t], s);
    const r = s[t + 1];
    e.handler = r === 0 ? null : $(e, n, r, s);
    const a = s[t + 2];
    e.finalizer = a === 0 ? null : $(e, n, a, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.operator = yt[s[t]], e.argument = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.prefix = (r & 1) === 1, e.operator = yt[s[t + 1]], e.argument = $(e, n, s[t + 2], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.kind = yt[s[t]], e.declarations = ue(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.id = $(e, n, s[t], s);
    const r = s[t + 1];
    e.init = r === 0 ? null : $(e, n, r, s);
  },
  function(e, t, s) {
    const { scope: n } = e;
    e.test = $(e, n, s[t], s), e.body = $(e, n, s[t + 1], s);
  },
  function(e, t, s) {
    const { scope: n } = e, r = s[t];
    e.delegate = (r & 1) === 1;
    const a = s[t + 1];
    e.argument = a === 0 ? null : $(e, n, a, s);
  }
];
function $(i, e, t, s) {
  const n = s[t], r = Df[n];
  if (!r)
    throw console.trace(), new Error(`Unknown node type: ${n}`);
  const a = new r(i, e);
  return a.type = Rf[n], a.start = s[t + 1], a.end = s[t + 2], Of[n](a, t + 3, s), a.initialise(), a;
}
function ue(i, e, t, s) {
  if (t === 0)
    return De;
  const n = s[t++], r = new Array(n);
  for (let a = 0; a < n; a++) {
    const o = s[t++];
    r[a] = o ? $(i, e, o, s) : null;
  }
  return r;
}
class Lf extends v {
  hasEffects() {
    return !0;
  }
  include(e) {
    super.include(e, !0);
  }
}
const ar = {
  ArrayExpression: sa,
  ArrayPattern: bi,
  ArrowFunctionExpression: ua,
  AssignmentExpression: Nc,
  AssignmentPattern: $c,
  AwaitExpression: wc,
  BinaryExpression: ha,
  BlockStatement: Kt,
  BreakStatement: Ai,
  CallExpression: Rc,
  CatchClause: xi,
  ChainExpression: Si,
  ClassBody: Pi,
  ClassDeclaration: hs,
  ClassExpression: Vn,
  ConditionalExpression: Ni,
  ContinueStatement: $i,
  DebuggerStatement: da,
  Decorator: pa,
  DoWhileStatement: Ci,
  EmptyStatement: fa,
  ExportAllDeclaration: xs,
  ExportDefaultDeclaration: qt,
  ExportNamedDeclaration: Qs,
  ExportSpecifier: vi,
  ExpressionStatement: Nt,
  ForInStatement: Dc,
  ForOfStatement: Oc,
  ForStatement: ki,
  FunctionDeclaration: ds,
  FunctionExpression: Lc,
  Identifier: ae,
  IfStatement: Ss,
  ImportAttribute: Mc,
  ImportDeclaration: Zs,
  ImportDefaultSpecifier: en,
  ImportExpression: ma,
  ImportNamespaceSpecifier: tn,
  ImportSpecifier: Ri,
  JSXAttribute: Di,
  JSXClosingElement: Tc,
  JSXClosingFragment: Bc,
  JSXElement: _c,
  JSXEmptyExpression: sn,
  JSXExpressionContainer: Oi,
  JSXFragment: Fc,
  JSXIdentifier: ga,
  JSXMemberExpression: zc,
  JSXNamespacedName: ba,
  JSXOpeningElement: Aa,
  JSXOpeningFragment: Vc,
  JSXSpreadAttribute: jn,
  JSXSpreadChild: Uc,
  JSXText: nn,
  LabeledStatement: xa,
  Literal: Ve,
  LogicalExpression: Li,
  MemberExpression: jt,
  MetaProperty: fc,
  MethodDefinition: Fn,
  NewExpression: jc,
  ObjectExpression: fs,
  ObjectPattern: As,
  PanicError: Hc,
  ParseError: Gc,
  PrivateIdentifier: Sa,
  Program: Mi,
  Property: rn,
  PropertyDefinition: Pa,
  RestElement: Lt,
  ReturnStatement: Ia,
  SequenceExpression: Ti,
  SpreadElement: Vt,
  StaticBlock: hi,
  Super: Wc,
  SwitchCase: an,
  SwitchStatement: Bi,
  TaggedTemplateExpression: Na,
  TemplateElement: $a,
  TemplateLiteral: Kc,
  ThisExpression: Xc,
  ThrowStatement: Jc,
  TryStatement: _i,
  UnaryExpression: wa,
  UnknownNode: Lf,
  UpdateExpression: Ca,
  VariableDeclaration: on,
  VariableDeclarator: va,
  WhileStatement: Fi,
  YieldExpression: Qc
};
class Mf extends Gt {
  constructor(e) {
    super(ps), this.module = e;
  }
  includePath(e, t) {
    super.includePath(e, t), this.module.needsExportShim = !0;
  }
}
var Tt;
(function(i) {
  i[i.LOAD_AND_PARSE = 0] = "LOAD_AND_PARSE", i[i.ANALYSE = 1] = "ANALYSE", i[i.GENERATE = 2] = "GENERATE";
})(Tt || (Tt = {}));
const Zc = /* @__PURE__ */ new WeakMap();
function Tf(i) {
  i.encodedMappings === void 0 && i.decodedMappings && (i.encodedMappings = Vl(i.decodedMappings)), i.decodedMappings = void 0;
}
function ka(i, e) {
  if (i) {
    const t = Zc.get(i);
    t && Tf(t);
  }
  if (e)
    for (const t of e)
      t.missing || ka(t);
}
function ms(i) {
  if (!i)
    return null;
  if (typeof i == "string" && (i = JSON.parse(i)), !i.mappings)
    return {
      mappings: [],
      names: [],
      sources: [],
      version: 3
    };
  const e = i.mappings, t = Array.isArray(e), s = {
    decodedMappings: t ? e : void 0,
    encodedMappings: t ? void 0 : e
  }, n = {
    ...i,
    // By moving mappings behind an accessor, we can avoid unneeded computation for cases
    // where the mappings field is never actually accessed. This appears to greatly reduce
    // the overhead of sourcemap decoding in terms of both compute time and memory usage.
    get mappings() {
      return s.decodedMappings || (s.decodedMappings = s.encodedMappings ? Ed(s.encodedMappings) : [], s.encodedMappings = void 0), s.decodedMappings;
    }
  };
  return Zc.set(n, s), n;
}
function or(i) {
  return i.id;
}
function Bf(i, e) {
  const t = i.filter((s) => !s.missing);
  e: for (; t.length > 0; ) {
    const n = t.pop().mappings[e.line - 1];
    if (n) {
      const r = n.filter((l) => l.length > 1), a = r[r.length - 1];
      let o = r[0];
      for (let l of r) {
        if (l[0] >= e.column || l === a) {
          l = l[0] !== e.column ? o : l, e = {
            column: l[3],
            line: l[2] + 1
          };
          continue e;
        }
        o = l;
      }
    }
    throw new Error("Can't resolve original location of error.");
  }
  return e;
}
const _f = /* @__PURE__ */ new Set(["assert", "with"]);
function eu(i) {
  const { scope: { context: e }, options: t, start: s } = i;
  if (!(t instanceof fs))
    return t && e.module.log(V, ja(e.module.id), s), Re;
  const n = t.properties.find((a) => _f.has(Dr(a)))?.value;
  if (!n)
    return Re;
  if (!(n instanceof fs))
    return e.module.log(V, oh(e.module.id), s), Re;
  const r = n.properties.map((a) => {
    const o = Dr(a);
    return typeof o == "string" && typeof a.value.value == "string" ? [o, a.value.value] : (e.module.log(V, ja(e.module.id), a.start), null);
  }).filter((a) => !!a);
  return r.length > 0 ? Object.fromEntries(r) : Re;
}
const Dr = (i) => {
  const e = i.key;
  return e && !i.computed && (e.name || e.value);
};
function Ff(i) {
  return i?.length ? Object.fromEntries(i.map((e) => [Dr(e), e.value.value])) : Re;
}
function Cn(i, e) {
  const t = Object.keys(i);
  return t.length !== Object.keys(e).length || t.some((s) => i[s] !== e[s]);
}
let Vs = /* @__PURE__ */ new Map();
function tu(i, e) {
  switch (e) {
    case 1:
      return `# ${i}`;
    case 2:
      return `## ${i}`;
    case 3:
      return i;
    default:
      return `- ${i}`;
  }
}
function zf(i, e = 3) {
  i = tu(i, e);
  const t = ls.memoryUsage().heapUsed, s = Bl.now(), n = Vs.get(i);
  n === void 0 ? Vs.set(i, {
    memory: 0,
    startMemory: t,
    startTime: s,
    time: 0,
    totalMemory: 0
  }) : (n.startMemory = t, n.startTime = s);
}
function Vf(i, e = 3) {
  i = tu(i, e);
  const t = Vs.get(i);
  if (t !== void 0) {
    const s = ls.memoryUsage().heapUsed;
    t.memory += s - t.startMemory, t.time += Bl.now() - t.startTime, t.totalMemory = Math.max(t.totalMemory, s);
  }
}
function Uf() {
  const i = {};
  for (const [e, { memory: t, time: s, totalMemory: n }] of Vs)
    i[e] = [s, t, n];
  return i;
}
let Ie = Je, xe = Je;
const jf = [
  "augmentChunkHash",
  "buildEnd",
  "buildStart",
  "generateBundle",
  "load",
  "moduleParsed",
  "options",
  "outputOptions",
  "renderChunk",
  "renderDynamicImport",
  "renderStart",
  "resolveDynamicImport",
  "resolveFileUrl",
  "resolveId",
  "resolveImportMeta",
  "shouldTransformCachedModule",
  "transform",
  "writeBundle"
];
function Hf(i, e) {
  if (i._hasTimer)
    return i;
  i._hasTimer = !0;
  for (const t of jf)
    if (t in i) {
      let s = `plugin ${e}`;
      i.name && (s += ` (${i.name})`), s += ` - ${t}`;
      const n = function(...a) {
        Ie(s, 4);
        const o = r.apply(this, a);
        return xe(s, 4), o;
      };
      let r;
      typeof i[t].handler == "function" ? (r = i[t].handler, i[t].handler = n) : (r = i[t], i[t] = n);
    }
  return i;
}
function Gf(i) {
  i.perf ? (Vs = /* @__PURE__ */ new Map(), Ie = zf, xe = Vf, i.plugins = i.plugins.map(Hf)) : (Ie = Je, xe = Je);
}
const zo = {
  identifier: null,
  localName: ps
};
function lr(i, e, t, s, n = /* @__PURE__ */ new Map(), r) {
  const a = n.get(e);
  if (a) {
    if (a.has(i))
      return s ? [null] : R(lh(e, i.id));
    a.add(i);
  } else
    n.set(e, /* @__PURE__ */ new Set([i]));
  return i.getVariableForExportName(e, {
    importChain: r,
    importerForSideEffects: t,
    isExportAllSearch: s,
    searchedNamesAndModules: n
  });
}
function Vo(i, e) {
  const t = _e(e.sideEffectDependenciesByVariable, i, It);
  let s = i;
  const n = /* @__PURE__ */ new Set([s]);
  for (; ; ) {
    const r = s.module;
    if (s = s instanceof lt ? s.getDirectOriginalVariable() : s instanceof ze ? s.syntheticNamespace : null, !s || n.has(s))
      break;
    n.add(s), t.add(r);
    const a = r.sideEffectDependenciesByVariable.get(s);
    if (a)
      for (const o of a)
        t.add(o);
  }
  return t;
}
class Ae {
  constructor(e, t, s, n, r, a, o, l) {
    this.graph = e, this.id = t, this.options = s, this.alternativeReexportModules = /* @__PURE__ */ new Map(), this.chunkFileNames = /* @__PURE__ */ new Set(), this.chunkNames = [], this.cycles = /* @__PURE__ */ new Set(), this.dependencies = /* @__PURE__ */ new Set(), this.dynamicDependencies = /* @__PURE__ */ new Set(), this.dynamicImporters = [], this.dynamicImports = [], this.execIndex = 1 / 0, this.hasTreeShakingPassStarted = !1, this.implicitlyLoadedAfter = /* @__PURE__ */ new Set(), this.implicitlyLoadedBefore = /* @__PURE__ */ new Set(), this.importDescriptions = /* @__PURE__ */ new Map(), this.importMetas = [], this.importedFromNotTreeshaken = !1, this.importers = [], this.includedDynamicImporters = [], this.includedTopLevelAwaitingDynamicImporters = /* @__PURE__ */ new Set(), this.includedImports = /* @__PURE__ */ new Set(), this.isExecuted = !1, this.isUserDefinedEntryPoint = !1, this.needsExportShim = !1, this.sideEffectDependenciesByVariable = /* @__PURE__ */ new Map(), this.sourcesWithAttributes = /* @__PURE__ */ new Map(), this.allExportsIncluded = !1, this.ast = null, this.exportAllModules = [], this.exportAllSources = /* @__PURE__ */ new Set(), this.exportDescriptions = /* @__PURE__ */ new Map(), this.exportedVariablesByName = null, this.exportNamesByVariable = null, this.exportShimVariable = new Mf(this), this.namespaceReexportsByName = /* @__PURE__ */ new Map(), this.reexportDescriptions = /* @__PURE__ */ new Map(), this.relevantDependencies = null, this.syntheticExports = /* @__PURE__ */ new Map(), this.syntheticNamespace = null, this.transformDependencies = [], this.excludeFromSourcemap = /\0/.test(t), this.context = s.moduleContext(t), this.preserveSignature = this.options.preserveEntrySignatures;
    const c = this, { dynamicImports: h, dynamicImporters: p, exportAllSources: d, exportDescriptions: m, implicitlyLoadedAfter: f, implicitlyLoadedBefore: g, importers: y, reexportDescriptions: b, sourcesWithAttributes: E } = this;
    this.info = {
      ast: null,
      attributes: l,
      code: null,
      get dynamicallyImportedIdResolutions() {
        return h.map(({ argument: A }) => typeof A == "string" && c.resolvedIds[A]).filter(Boolean);
      },
      get dynamicallyImportedIds() {
        return h.map(({ id: A }) => A).filter((A) => A != null);
      },
      get dynamicImporters() {
        return p.sort();
      },
      get exportedBindings() {
        const A = { ".": [...m.keys()] };
        for (const [x, { source: k }] of b)
          (A[k] ??= []).push(x);
        for (const x of d)
          (A[x] ??= []).push("*");
        return A;
      },
      get exports() {
        return [
          ...m.keys(),
          ...b.keys(),
          ...[...d].map(() => "*")
        ];
      },
      get hasDefaultExport() {
        return c.ast ? c.exportDescriptions.has("default") || b.has("default") : null;
      },
      id: t,
      get implicitlyLoadedAfterOneOf() {
        return Array.from(f, or).sort();
      },
      get implicitlyLoadedBefore() {
        return Array.from(g, or).sort();
      },
      get importedIdResolutions() {
        return Array.from(E.keys(), (A) => c.resolvedIds[A]).filter(Boolean);
      },
      get importedIds() {
        return Array.from(E.keys(), (A) => c.resolvedIds[A]?.id).filter(Boolean);
      },
      get importers() {
        return y.sort();
      },
      isEntry: n,
      isExternal: !1,
      get isIncluded() {
        return e.phase !== Tt.GENERATE ? null : c.isIncluded();
      },
      meta: { ...o },
      moduleSideEffects: r,
      safeVariableNames: null,
      syntheticNamedExports: a
    };
  }
  basename() {
    const e = os(this.id), t = ns(this.id);
    return ri(t ? e.slice(0, -t.length) : e);
  }
  bindReferences() {
    this.ast.bind();
  }
  cacheInfoGetters() {
    ql(this.info, [
      "dynamicallyImportedIdResolutions",
      "dynamicallyImportedIds",
      "dynamicImporters",
      "exportedBindings",
      "exports",
      "hasDefaultExport",
      "implicitlyLoadedAfterOneOf",
      "implicitlyLoadedBefore",
      "importedIdResolutions",
      "importedIds",
      "importers"
    ]);
  }
  error(e, t) {
    return t !== void 0 && this.addLocationToLogProps(e, t), R(e);
  }
  // sum up the length of all ast nodes that are included
  estimateSize() {
    let e = 0;
    for (const t of this.ast.body)
      t.included && (e += t.end - t.start);
    return e;
  }
  getDependenciesToBeIncluded() {
    if (this.relevantDependencies)
      return this.relevantDependencies;
    this.relevantDependencies = /* @__PURE__ */ new Set();
    const e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set(), s = new Set(this.includedImports);
    if (this.info.isEntry || this.includedDynamicImporters.length > 0 || this.namespace.included || this.implicitlyLoadedAfter.size > 0)
      for (const n of this.getExportedVariablesByName().values())
        n.included && s.add(n);
    for (let n of s) {
      const r = this.sideEffectDependenciesByVariable.get(n);
      if (r)
        for (const a of r)
          t.add(a);
      n instanceof ze ? n = n.getBaseVariable() : n instanceof lt && (n = n.getOriginalVariable()), e.add(n.module);
    }
    if (!this.options.treeshake || this.info.moduleSideEffects === "no-treeshake")
      for (const n of this.dependencies)
        this.relevantDependencies.add(n);
    else
      this.addRelevantSideEffectDependencies(this.relevantDependencies, e, t);
    for (const n of e)
      this.relevantDependencies.add(n);
    return this.relevantDependencies;
  }
  getExportedVariablesByName() {
    if (this.exportedVariablesByName)
      return this.exportedVariablesByName;
    const e = this.exportedVariablesByName = /* @__PURE__ */ new Map();
    for (const t of this.exportDescriptions.keys())
      if (t !== this.info.syntheticNamedExports) {
        const [s] = this.getVariableForExportName(t);
        if (s)
          e.set(t, s);
        else
          return R(Bu(t, this.id));
      }
    for (const t of this.reexportDescriptions.keys()) {
      const [s] = this.getVariableForExportName(t);
      s && e.set(t, s);
    }
    for (const t of this.exportAllModules) {
      if (t instanceof Ee) {
        e.set(`*${t.id}`, t.getVariableForExportName("*", {
          importChain: [this.id]
        })[0]);
        continue;
      }
      for (const s of t.getExportedVariablesByName().keys())
        if (s !== "default" && !e.has(s)) {
          const [n] = this.getVariableForExportName(s);
          n && e.set(s, n);
        }
    }
    return this.exportedVariablesByName = new Map([...e].sort(Kf));
  }
  getExportNamesByVariable() {
    if (this.exportNamesByVariable)
      return this.exportNamesByVariable;
    const e = /* @__PURE__ */ new Map();
    for (const [t, s] of this.getExportedVariablesByName().entries()) {
      const n = s instanceof lt ? s.getOriginalVariable() : s;
      if (!s || !(s.included || s instanceof Bs))
        continue;
      const r = e.get(n);
      r ? r.push(t) : e.set(n, [t]);
    }
    return this.exportNamesByVariable = e;
  }
  getRenderedExports() {
    const e = [], t = [];
    for (const s of this.exportDescriptions.keys())
      (this.getExportedVariablesByName().get(s)?.included ? e : t).push(s);
    return { removedExports: t, renderedExports: e };
  }
  getSyntheticNamespace() {
    return this.syntheticNamespace === null && (this.syntheticNamespace = void 0, [this.syntheticNamespace] = this.getVariableForExportName(typeof this.info.syntheticNamedExports == "string" ? this.info.syntheticNamedExports : "default", { onlyExplicit: !0 })), this.syntheticNamespace ? this.syntheticNamespace : R(_u(this.id, this.info.syntheticNamedExports));
  }
  getVariableForExportName(e, { importerForSideEffects: t, importChain: s = [], isExportAllSearch: n, onlyExplicit: r, searchedNamesAndModules: a } = Re) {
    if (e[0] === "*")
      return e.length === 1 ? [this.namespace] : this.graph.modulesById.get(e.slice(1)).getVariableForExportName("*", {
        importChain: [...s, this.id]
      });
    const o = this.reexportDescriptions.get(e);
    if (o) {
      const [c, h] = lr(o.module, o.localName, t, !1, a, [...s, this.id]);
      return c ? (t && (Uo(c, t, this), this.info.moduleSideEffects && _e(t.sideEffectDependenciesByVariable, c, It).add(this)), [c]) : this.error(Rn(o.localName, this.id, o.module.id, !!h?.missingButExportExists), o.start);
    }
    const l = this.exportDescriptions.get(e);
    if (l) {
      if (l === zo)
        return [this.exportShimVariable];
      const c = l.localName, h = this.traceVariable(c, {
        importerForSideEffects: t,
        searchedNamesAndModules: a
      });
      return h ? (t && (Uo(h, t, this), _e(t.sideEffectDependenciesByVariable, h, It).add(this)), [h]) : [null, { missingButExportExists: !0 }];
    }
    if (r)
      return [null];
    if (e !== "default") {
      const c = this.namespaceReexportsByName.get(e) ?? this.getVariableFromNamespaceReexports(e, t, a, [...s, this.id]);
      if (this.namespaceReexportsByName.set(e, c), c[0])
        return c;
    }
    return this.info.syntheticNamedExports ? [
      _e(this.syntheticExports, e, () => new ze(this.astContext, e, this.getSyntheticNamespace()))
    ] : !n && this.options.shimMissingExports ? (this.shimMissingExport(e), [this.exportShimVariable]) : [null];
  }
  hasEffects() {
    return this.info.moduleSideEffects === "no-treeshake" || this.ast.hasCachedEffects();
  }
  include() {
    const e = it();
    this.ast.shouldBeIncluded(e) && this.ast.include(e, !1);
  }
  includeAllExports() {
    if (this.allExportsIncluded)
      return;
    this.allExportsIncluded = !0, this.includeModuleInExecution();
    const e = it();
    for (const t of this.getExportedVariablesByName().values())
      this.includeVariable(t, O, e), t.deoptimizePath(O), t instanceof Bs && (t.module.reexported = !0);
  }
  includeAllInBundle() {
    this.ast.include(it(), !0), this.includeAllExports();
  }
  includeModuleInExecution() {
    this.isExecuted || (Qr(this), this.graph.needsTreeshakingPass = !0);
  }
  isIncluded() {
    return this.ast && (this.ast.included || this.namespace.included || this.importedFromNotTreeshaken || this.exportShimVariable.included);
  }
  linkImports() {
    this.addModulesToImportDescriptions(this.importDescriptions), this.addModulesToImportDescriptions(this.reexportDescriptions);
    const e = [];
    for (const t of this.exportAllSources) {
      const s = this.graph.modulesById.get(this.resolvedIds[t].id);
      if (s instanceof Ee) {
        e.push(s);
        continue;
      }
      this.exportAllModules.push(s);
    }
    this.exportAllModules.push(...e);
  }
  log(e, t, s) {
    this.addLocationToLogProps(t, s), this.options.onLog(e, t);
  }
  render(e) {
    const t = this.magicString.clone();
    this.ast.render(t, e), t.trim();
    const { usesTopLevelAwait: s } = this.astContext;
    return s && e.format !== "es" && e.format !== "system" ? R(Fu(this.id, e.format)) : { source: t, usesTopLevelAwait: s };
  }
  async setSource({ ast: e, code: t, customTransformCache: s, originalCode: n, originalSourcemap: r, resolvedIds: a, sourcemapChain: o, transformDependencies: l, transformFiles: c, safeVariableNames: h, ...p }) {
    if (Ie("generate ast", 3), t.startsWith("#!")) {
      const f = t.indexOf(`
`);
      this.shebang = t.slice(2, f);
    }
    this.info.code = t, this.info.safeVariableNames = h, this.originalCode = n, this.originalSourcemap = ms(r), this.sourcemapChain = o.map((f) => f.missing ? f : ms(f)), ka(this.originalSourcemap, this.sourcemapChain), c && (this.transformFiles = c), this.transformDependencies = l, this.customTransformCache = s, this.updateOptions(p), this.resolvedIds = a ?? /* @__PURE__ */ Object.create(null);
    const d = this.id;
    this.magicString = new Ft(t, {
      filename: this.excludeFromSourcemap ? null : d,
      // don't include plugin helpers in sourcemap
      indentExclusionRanges: []
    }), this.astContext = {
      addDynamicImport: this.addDynamicImport.bind(this),
      addExport: this.addExport.bind(this),
      addImport: this.addImport.bind(this),
      addImportMeta: this.addImportMeta.bind(this),
      addImportSource: this.addImportSource.bind(this),
      code: t,
      // Only needed for debugging
      deoptimizationTracker: this.graph.deoptimizationTracker,
      error: this.error.bind(this),
      fileName: d,
      // Needed for warnings
      getImportedJsxFactoryVariable: this.getImportedJsxFactoryVariable.bind(this),
      getModuleExecIndex: () => this.execIndex,
      getModuleName: this.basename.bind(this),
      getNodeConstructor: (f) => ar[f] || ar.UnknownNode,
      importDescriptions: this.importDescriptions,
      includeDynamicImport: this.includeDynamicImport.bind(this),
      includeVariableInModule: this.includeVariableInModule.bind(this),
      log: this.log.bind(this),
      magicString: this.magicString,
      manualPureFunctions: this.graph.pureFunctions,
      module: this,
      moduleContext: this.context,
      newlyIncludedVariableInits: this.graph.newlyIncludedVariableInits,
      options: this.options,
      requestTreeshakingPass: () => this.graph.needsTreeshakingPass = !0,
      traceExport: (f) => this.getVariableForExportName(f),
      traceVariable: this.traceVariable.bind(this),
      usesTopLevelAwait: !1
    }, this.scope = new qc(this.graph.scope, this.astContext, this.importDescriptions), this.namespace = new Mt(this.astContext);
    const m = { context: this.astContext, type: "Module" };
    if (e)
      this.ast = new ar[e.type](m, this.scope).parseNode(e), this.info.ast = e;
    else {
      xe("generate ast", 3);
      const f = await Kn.parseAsync(t, !1, this.options.jsx !== !1);
      Ie("generate ast", 3), this.ast = kf(f, m, this.scope), Object.defineProperty(this.info, "ast", {
        get: () => {
          if (this.graph.astLru.has(d))
            return this.graph.astLru.get(d);
          {
            const g = this.tryParse();
            return this.options.cache !== !1 ? (Object.defineProperty(this.info, "ast", {
              value: g
            }), g) : (this.graph.astLru.set(d, g), g);
          }
        }
      });
    }
    xe("generate ast", 3);
  }
  toJSON() {
    return {
      ast: this.info.ast,
      attributes: this.info.attributes,
      code: this.info.code,
      customTransformCache: this.customTransformCache,
      dependencies: Array.from(this.dependencies, or),
      id: this.id,
      meta: this.info.meta,
      moduleSideEffects: this.info.moduleSideEffects,
      originalCode: this.originalCode,
      originalSourcemap: this.originalSourcemap,
      resolvedIds: this.resolvedIds,
      safeVariableNames: this.info.safeVariableNames,
      sourcemapChain: this.sourcemapChain,
      syntheticNamedExports: this.info.syntheticNamedExports,
      transformDependencies: this.transformDependencies,
      transformFiles: this.transformFiles
    };
  }
  traceVariable(e, { importerForSideEffects: t, isExportAllSearch: s, searchedNamesAndModules: n } = Re) {
    const r = this.scope.variables.get(e);
    if (r)
      return r;
    const a = this.importDescriptions.get(e);
    if (a) {
      const o = a.module;
      if (o instanceof Ae && a.name === "*")
        return o.namespace;
      const [l, c] = lr(o, a.name, t || this, s, n, [this.id]);
      return l || this.error(Rn(a.name, this.id, o.id, !!c?.missingButExportExists), a.start);
    }
    return null;
  }
  updateOptions({ meta: e, moduleSideEffects: t, syntheticNamedExports: s }) {
    t != null && (this.info.moduleSideEffects = t), s != null && (this.info.syntheticNamedExports = s), e != null && Object.assign(this.info.meta, e);
  }
  addDynamicImport(e) {
    let t = e.sourceAstNode;
    t.type === zu ? t.quasis.length === 1 && typeof t.quasis[0].value.cooked == "string" && (t = t.quasis[0].value.cooked) : t.type === Vu && typeof t.value == "string" && (t = t.value), this.dynamicImports.push({ argument: t, id: null, node: e });
  }
  assertUniqueExportName(e, t) {
    (this.exportDescriptions.has(e) || this.reexportDescriptions.has(e)) && this.error(Uu(e), t);
  }
  addExport(e) {
    if (e instanceof qt)
      this.assertUniqueExportName("default", e.start), this.exportDescriptions.set("default", {
        identifier: e.variable.getAssignedVariableName(),
        localName: "default"
      });
    else if (e instanceof xs) {
      const t = e.source.value;
      if (this.addSource(t, e), e.exported) {
        const s = e.exported instanceof Ve ? e.exported.value : e.exported.name;
        this.assertUniqueExportName(s, e.exported.start), this.reexportDescriptions.set(s, {
          localName: "*",
          module: null,
          // filled in later,
          source: t,
          start: e.start
        });
      } else
        this.exportAllSources.add(t);
    } else if (e.source instanceof Ve) {
      const t = e.source.value;
      this.addSource(t, e);
      for (const { exported: s, local: n, start: r } of e.specifiers) {
        const a = s instanceof Ve ? s.value : s.name;
        this.assertUniqueExportName(a, r), this.reexportDescriptions.set(a, {
          localName: n instanceof Ve ? n.value : n.name,
          module: null,
          // filled in later,
          source: t,
          start: r
        });
      }
    } else if (e.declaration) {
      const t = e.declaration;
      if (t instanceof on)
        for (const s of t.declarations)
          for (const n of lf(s.id))
            this.assertUniqueExportName(n, s.id.start), this.exportDescriptions.set(n, { identifier: null, localName: n });
      else {
        const s = t.id.name;
        this.assertUniqueExportName(s, t.id.start), this.exportDescriptions.set(s, { identifier: null, localName: s });
      }
    } else
      for (const { local: t, exported: s } of e.specifiers) {
        const n = t.name, r = s instanceof ae ? s.name : s.value;
        this.assertUniqueExportName(r, s.start), this.exportDescriptions.set(r, { identifier: null, localName: n });
      }
  }
  addImport(e) {
    const t = e.source.value;
    this.addSource(t, e);
    for (const s of e.specifiers) {
      const n = s.local.name;
      (this.scope.variables.has(n) || this.importDescriptions.has(n)) && this.error(gs(n), s.local.start);
      const r = s instanceof en ? "default" : s instanceof tn ? "*" : s.imported instanceof ae ? s.imported.name : s.imported.value;
      this.importDescriptions.set(n, {
        module: null,
        // filled in later
        name: r,
        source: t,
        start: s.start
      });
    }
  }
  addImportSource(e) {
    e && !this.sourcesWithAttributes.has(e) && this.sourcesWithAttributes.set(e, Re);
  }
  addImportMeta(e) {
    this.importMetas.push(e);
  }
  addLocationToLogProps(e, t) {
    e.id = this.id, e.pos = t;
    let s = this.info.code;
    const n = xl(s, t, { offsetLine: 1 });
    if (n) {
      let { column: r, line: a } = n;
      try {
        ({ column: r, line: a } = Bf(this.sourcemapChain, { column: r, line: a })), s = this.originalCode;
      } catch (o) {
        this.options.onLog(V, ju(o, this.id, r, a, t));
      }
      fr(e, { column: r, line: a }, s, this.id);
    }
  }
  addModulesToImportDescriptions(e) {
    for (const t of e.values()) {
      const { id: s } = this.resolvedIds[t.source];
      t.module = this.graph.modulesById.get(s);
    }
  }
  addRelevantSideEffectDependencies(e, t, s) {
    const n = /* @__PURE__ */ new Set(), r = (a) => {
      for (const o of a)
        if (!n.has(o)) {
          if (n.add(o), t.has(o)) {
            e.add(o);
            continue;
          }
          if (o.info.moduleSideEffects || s.has(o)) {
            if (o instanceof Ee || o.hasEffects()) {
              e.add(o);
              continue;
            }
            r(o.dependencies);
          }
        }
    };
    r(this.dependencies), r(s);
  }
  addSource(e, t) {
    const s = Ff(t.attributes), n = this.sourcesWithAttributes.get(e);
    n ? Cn(n, s) && this.log(V, xn(n, s, e, this.id), t.start) : this.sourcesWithAttributes.set(e, s);
  }
  getImportedJsxFactoryVariable(e, t, s) {
    const { id: n } = this.resolvedIds[s], r = this.graph.modulesById.get(n), [a] = r.getVariableForExportName(e, { importChain: [this.id] });
    return a || this.error(Hu(e, n, this.id), t);
  }
  getVariableFromNamespaceReexports(e, t, s, n) {
    let r = null;
    const a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set();
    for (const l of this.exportAllModules) {
      if (l.info.syntheticNamedExports === e)
        continue;
      const [c, h] = lr(
        l,
        e,
        t,
        !0,
        // We are creating a copy to handle the case where the same binding is
        // imported through different namespace reexports gracefully
        Wf(s),
        n
      );
      l instanceof Ee || h?.indirectExternal ? o.add(c) : c instanceof ze ? r || (r = c) : c && a.set(c, l);
    }
    if (a.size > 0) {
      const l = [...a], c = l[0][0];
      return l.length === 1 ? [c] : (this.options.onLog(V, Gu(e, this.id, l.map(([, h]) => h.id))), [null]);
    }
    if (o.size > 0) {
      const l = [...o], c = l[0];
      return l.length > 1 && this.options.onLog(V, Wu(e, this.id, c.module.id, l.map((h) => h.module.id))), [c, { indirectExternal: !0 }];
    }
    return r ? [r] : [null];
  }
  includeAndGetAdditionalMergedNamespaces() {
    const e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set();
    for (const s of [this, ...this.exportAllModules])
      if (s instanceof Ee) {
        const [n] = s.getVariableForExportName("*", {
          importChain: [this.id]
        });
        n.includePath(O, it()), this.includedImports.add(n), e.add(n);
      } else if (s.info.syntheticNamedExports) {
        const n = s.getSyntheticNamespace();
        n.includePath(O, it()), this.includedImports.add(n), t.add(n);
      }
    return [...t, ...e];
  }
  includeDynamicImport(e) {
    const { resolution: t } = e;
    t instanceof Ae && (t.includedDynamicImporters.includes(this) || (t.includedDynamicImporters.push(this), this.astContext.usesTopLevelAwait && t.includedTopLevelAwaitingDynamicImporters.add(this)));
  }
  includeVariable(e, t, s) {
    const { included: n, module: r } = e;
    if (e.includePath(t, s), n) {
      r instanceof Ae && r !== this && Vo(e, this);
      return;
    }
    if (this.graph.needsTreeshakingPass = !0, r instanceof Ae && (r.includeModuleInExecution(), r !== this)) {
      const a = Vo(e, this);
      for (const o of a)
        o.includeModuleInExecution();
    }
  }
  includeVariableInModule(e, t, s) {
    this.includeVariable(e, t, s);
    const n = e.module;
    n && n !== this && this.includedImports.add(e);
  }
  shimMissingExport(e) {
    this.options.onLog(V, Ku(this.id, e)), this.exportDescriptions.set(e, zo);
  }
  tryParse() {
    try {
      return _r(this.info.code, { jsx: this.options.jsx !== !1 });
    } catch (e) {
      return this.error(Fr(e, this.id), e.pos);
    }
  }
}
function Uo(i, e, t) {
  if (i.module instanceof Ae && i.module !== t) {
    const s = i.module.cycles;
    if (s.size > 0) {
      const n = t.cycles;
      for (const r of n)
        if (s.has(r)) {
          e.alternativeReexportModules.set(i, t);
          break;
        }
    }
  }
}
const Wf = (i) => i && new Map(Array.from(i, ([e, t]) => [e, new Set(t)])), Kf = ([i], [e]) => i < e ? -1 : i > e ? 1 : 0, jo = (i, e) => e ? `${i}
${e}` : i, Ho = (i, e) => e ? `${i}

${e}` : i;
async function qf(i, e, t) {
  try {
    let [s, n, r, a] = await Promise.all([
      e.hookReduceValue("banner", i.banner(t), [t], jo),
      e.hookReduceValue("footer", i.footer(t), [t], jo),
      e.hookReduceValue("intro", i.intro(t), [t], Ho),
      e.hookReduceValue("outro", i.outro(t), [t], Ho)
    ]);
    return r && (r += `

`), a && (a = `

${a}`), s && (s += `
`), n && (n = `
` + n), { banner: s, footer: n, intro: r, outro: a };
  } catch (s) {
    return R(Kh(s.message, s.hook, s.plugin));
  }
}
const Xf = {
  amd: mn,
  cjs: mn,
  es: Go,
  iife: mn,
  system: Go,
  umd: mn
};
function Jf(i, e, t, s, n, r, a, o, l, c, h, p, d, m) {
  const f = [...i].reverse();
  for (const g of f)
    g.scope.addUsedOutsideNames(s, d);
  Yf(s, f, m), Xf[n](s, t, e, r, a, o, l, c, h);
  for (const g of f)
    g.scope.deconflict(n, p, d);
}
function Go(i, e, t, s, n, r, a, o, l) {
  for (const c of t.dependencies)
    (n || c instanceof Rt) && (c.variableName = rt(c.suggestedVariableName, i, null));
  for (const c of e) {
    const h = c.module, p = c.name;
    c.isNamespace && (n || h instanceof Ee) ? c.setRenderNames(null, (h instanceof Ee ? o.get(h) : a.get(h)).variableName) : h instanceof Ee && p === "default" ? c.setRenderNames(null, rt([...h.exportedVariables].some(([d, m]) => m === "*" && d.included) ? h.suggestedVariableName + "__default" : h.suggestedVariableName, i, c.forbiddenNames)) : c.setRenderNames(null, rt(ri(p), i, c.forbiddenNames));
  }
  for (const c of l)
    c.setRenderNames(null, rt(c.name, i, c.forbiddenNames));
}
function mn(i, e, { deconflictedDefault: t, deconflictedNamespace: s, dependencies: n }, r, a, o, l, c) {
  for (const h of n)
    h.variableName = rt(h.suggestedVariableName, i, null);
  for (const h of s)
    h.namespaceVariableName = rt(`${h.suggestedVariableName}__namespace`, i, null);
  for (const h of t)
    h.defaultVariableName = s.has(h) && bp(r(h.id), o) ? h.namespaceVariableName : rt(`${h.suggestedVariableName}__default`, i, null);
  for (const h of e) {
    const p = h.module;
    if (p instanceof Ee) {
      const d = c.get(p), m = h.name;
      if (m === "default") {
        const f = r(p.id), g = di[f] ? d.defaultVariableName : d.variableName;
        pi(f, o) ? h.setRenderNames(g, "default") : h.setRenderNames(null, g);
      } else m === "*" ? h.setRenderNames(null, Js[r(p.id)] ? d.namespaceVariableName : d.variableName) : h.setRenderNames(d.variableName, null);
    } else {
      const d = l.get(p);
      a && h.isNamespace ? h.setRenderNames(null, d.exportMode === "default" ? d.namespaceVariableName : d.variableName) : d.exportMode === "default" ? h.setRenderNames(null, d.variableName) : h.setRenderNames(d.variableName, d.getVariableExportName(h));
    }
  }
}
function Yf(i, e, t) {
  for (const s of e) {
    s.info.safeVariableNames ||= {};
    for (const n of s.scope.variables.values())
      if (n.included && // this will only happen for exports in some formats
      !(n.renderBaseName || n instanceof lt && n.getOriginalVariable() !== n)) {
        const r = Object.getOwnPropertyDescriptor(s.info.safeVariableNames, n.name)?.value;
        if (r && !i.has(r)) {
          i.add(r), n.setRenderNames(null, r);
          continue;
        }
        n.setRenderNames(null, rt(n.name, i, n.forbiddenNames)), s.info.safeVariableNames[n.name] = n.renderName;
      }
    if (t.has(s)) {
      const n = s.namespace;
      n.setRenderNames(null, rt(n.name, i, n.forbiddenNames));
    }
  }
}
function Qf(i, e, t) {
  let s = 0;
  for (const n of i) {
    let [r] = n.name;
    if (e.has(r))
      do
        r = _n(++s), r.charCodeAt(0) === 49 && (s += 9 * 64 ** (r.length - 1), r = _n(s));
      while (ii.has(r) || e.has(r));
    e.set(r, n), t.set(n, [r]);
  }
}
function Zf(i, e, t) {
  for (const s of i) {
    let n = 0, r = s.name;
    for (; e.has(r); )
      r = s.name + "$" + ++n;
    e.set(r, s), t.set(s, [r]);
  }
}
function em(i, { exports: e, name: t, format: s }, n, r) {
  const a = i.getExportNames();
  if (e === "default") {
    if (a.length !== 1 || a[0] !== "default")
      return R(Ka("default", a, n));
  } else if (e === "none" && a.length > 0)
    return R(Ka("none", a, n));
  return e === "auto" && (a.length === 0 ? e = "none" : a.length === 1 && a[0] === "default" ? e = "default" : (s !== "es" && s !== "system" && a.includes("default") && r(V, Wh(n, t)), e = "named")), e;
}
function tm(i) {
  const e = i.split(`
`), t = e.filter((r) => /^\t+/.test(r)), s = e.filter((r) => /^ {2,}/.test(r));
  if (t.length === 0 && s.length === 0)
    return null;
  if (t.length >= s.length)
    return "	";
  const n = s.reduce((r, a) => {
    const o = /^ +/.exec(a)[0].length;
    return Math.min(o, r);
  }, 1 / 0);
  return " ".repeat(n);
}
function sm(i, e) {
  if (e.indent !== !0)
    return e.indent;
  for (const t of i) {
    const s = tm(t.originalCode);
    if (s !== null)
      return s;
  }
  return "	";
}
function nm(i, e, t, s) {
  const n = [], r = /* @__PURE__ */ new Set();
  for (let o = e.length - 1; o >= 0; o--) {
    const l = e[o];
    if (!r.has(l)) {
      const c = [];
      su(l, c, r, i, t, s), n.unshift(c);
    }
  }
  const a = /* @__PURE__ */ new Set();
  for (const o of n)
    for (const l of o)
      a.add(l);
  return a;
}
function su(i, e, t, s, n, r) {
  const a = i.getDependenciesToBeIncluded();
  for (const o of a) {
    if (o instanceof Ee) {
      e.push(r.get(o));
      continue;
    }
    const l = n.get(o);
    if (l !== s) {
      e.push(l);
      continue;
    }
    t.has(o) || (t.add(o), su(o, e, t, s, n, r));
  }
}
const zi = "!~{", Vi = "}~", Ra = zi.length + Vi.length, Hn = 21, Or = 8, im = () => {
  let i = 0;
  return (e, t) => {
    if (t > Hn)
      return R(He(`Hashes cannot be longer than ${Hn} characters, received ${t}. Check the "${e}" option.`));
    const s = `${zi}${_n(++i).padStart(t - Ra, "0")}${Vi}`;
    return s.length > t ? R(He(`To generate hashes for this number of chunks (currently ${i}), you need a minimum hash size of ${s.length}, received ${t}. Check the "${e}" option.`)) : s;
  };
}, Da = new RegExp(`${zi}[0-9a-zA-Z_$]{1,${Hn - Ra}}${Vi}`, "g"), vt = (i, e) => i.replace(Da, (t) => e.get(t) || t), rm = (i, e, t) => i.replace(Da, (s) => s === e ? t : s), am = (i, e) => {
  const t = /* @__PURE__ */ new Set(), s = i.replace(Da, (n) => e.has(n) ? (t.add(n), `${zi}${"0".repeat(n.length - Ra)}${Vi}`) : n);
  return { containedPlaceholders: t, transformedCode: s };
}, Ui = /* @__PURE__ */ Symbol("bundleKeys"), Oa = {
  type: "placeholder"
}, om = (i) => {
  const e = /* @__PURE__ */ new Set();
  return new Proxy(i, {
    deleteProperty(t, s) {
      return typeof s == "string" && e.delete(s.toLowerCase()), Reflect.deleteProperty(t, s);
    },
    get(t, s) {
      return s === Ui ? e : Reflect.get(t, s);
    },
    set(t, s, n) {
      return typeof s == "string" && e.add(s.toLowerCase()), Reflect.set(t, s, n);
    }
  });
}, lm = (i) => {
  const e = /* @__PURE__ */ new Set(), t = Object.values(i);
  for (const s of t)
    s.type === "asset" && s.needsCodeReference && e.add(s.fileName);
  for (const s of t)
    if (s.type === "chunk")
      for (const n of s.referencedFiles)
        e.has(n) && e.delete(n);
  for (const s of e)
    delete i[s];
};
function Lr(i, e, t) {
  return Dn(i) ? R(He(`Invalid pattern "${i}" for "${e}", patterns can be neither absolute nor relative paths. If you want your files to be stored in a subdirectory, write its name without a leading slash like this: subdirectory/pattern.`)) : i.replace(/\[(\w+)(:\d+)?]/g, (s, n, r) => {
    if (!t.hasOwnProperty(n) || r && n !== "hash")
      return R(He(`"[${n}${r || ""}]" is not a valid placeholder in the "${e}" pattern.`));
    const a = t[n](r && Number.parseInt(r.slice(1)));
    return Dn(a) ? R(He(`Invalid substitution "${a}" for placeholder "[${n}]" in "${e}" pattern, can be neither absolute nor relative path.`)) : a;
  });
}
function Mr(i, { [Ui]: e }) {
  if (!e.has(i.toLowerCase()))
    return i;
  const t = ns(i);
  i = i.slice(0, Math.max(0, i.length - t.length));
  let s, n = 1;
  for (; e.has((s = i + ++n + t).toLowerCase()); )
    ;
  return s;
}
const cm = [
  "Object",
  "Promise",
  "module",
  "exports",
  "require",
  "__filename",
  "__dirname",
  ...vr
], um = /* @__PURE__ */ new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".mts",
  ".cjs",
  ".cts"
]);
function hm(i, e, t, s) {
  const n = typeof e == "function" ? e(i.id) : e[i.id];
  if (n)
    return n;
  if (t)
    return s(V, Yh(i.id, i.variableName)), i.variableName;
}
class pt {
  constructor(e, t, s, n, r, a, o, l, c, h, p, d, m, f, g) {
    this.orderedModules = e, this.inputOptions = t, this.outputOptions = s, this.unsetOptions = n, this.pluginDriver = r, this.modulesById = a, this.chunkByModule = o, this.externalChunkByModule = l, this.facadeChunkByModule = c, this.includedNamespaces = h, this.manualChunkAlias = p, this.getPlaceholder = d, this.bundle = m, this.inputBase = f, this.snippets = g, this.dependencies = /* @__PURE__ */ new Set(), this.entryModules = [], this.exportMode = "named", this.facadeModule = null, this.namespaceVariableName = "", this.variableName = "", this.isManualChunk = !1, this.accessedGlobalsByScope = /* @__PURE__ */ new Map(), this.dynamicEntryModules = [], this.dynamicName = null, this.exportNamesByVariable = /* @__PURE__ */ new Map(), this.exports = /* @__PURE__ */ new Set(), this.exportsByName = /* @__PURE__ */ new Map(), this.fileName = null, this.implicitEntryModules = [], this.implicitlyLoadedBefore = /* @__PURE__ */ new Set(), this.imports = /* @__PURE__ */ new Set(), this.includedDynamicImports = null, this.includedReexportsByModule = /* @__PURE__ */ new Map(), this.isEmpty = !0, this.name = null, this.needsExportsShim = !1, this.preRenderedChunkInfo = null, this.preliminaryFileName = null, this.preliminarySourcemapFileName = null, this.renderedChunkInfo = null, this.renderedDependencies = null, this.renderedModules = /* @__PURE__ */ Object.create(null), this.sortedExportNames = null, this.strictFacade = !1, this.allowExtensionModules = /* @__PURE__ */ new Set(), this.execIndex = e.length > 0 ? e[0].execIndex : 1 / 0;
    const y = new Set(e);
    for (const b of e) {
      o.set(b, this), b.namespace.included && !s.preserveModules && h.add(b), this.isEmpty && b.isIncluded() && (this.isEmpty = !1), (b.info.isEntry || s.preserveModules) && this.entryModules.push(b);
      for (const E of b.includedDynamicImporters)
        if (!y.has(E)) {
          this.dynamicEntryModules.push(b), b.info.syntheticNamedExports && (h.add(b), this.exports.add(b.namespace));
          break;
        }
      b.implicitlyLoadedAfter.size > 0 && this.implicitEntryModules.push(b);
    }
    this.suggestedVariableName = ri(this.generateVariableName()), this.isManualChunk = p !== null;
  }
  static generateFacade(e, t, s, n, r, a, o, l, c, h, p, d, m, f, g) {
    const y = new pt([], e, t, s, n, r, a, o, l, c, null, d, m, f, g);
    y.assignFacadeName(p, h), l.has(h) || l.set(h, y);
    for (const b of h.getDependenciesToBeIncluded())
      y.dependencies.add(b instanceof Ae ? a.get(b) : o.get(b));
    return !y.dependencies.has(a.get(h)) && h.info.moduleSideEffects && h.hasEffects() && y.dependencies.add(a.get(h)), y.ensureReexportsAreAvailableForModule(h), y.facadeModule = h, y.strictFacade = !0, y;
  }
  canModuleBeFacade(e, t) {
    const s = e.getExportNamesByVariable();
    for (const n of this.exports)
      if (!s.has(n))
        return !1;
    for (const n of t)
      if (!(n.module === e || s.has(n) || n instanceof ze && s.has(n.getBaseVariable())))
        return !1;
    return !0;
  }
  finalizeChunk(e, t, s, n) {
    const r = this.getRenderedChunkInfo(), a = (c) => vt(c, n), o = r.fileName, l = this.fileName = a(o);
    return {
      ...r,
      code: e,
      dynamicImports: r.dynamicImports.map(a),
      fileName: l,
      implicitlyLoadedBefore: r.implicitlyLoadedBefore.map(a),
      importedBindings: Object.fromEntries(Object.entries(r.importedBindings).map(([c, h]) => [
        a(c),
        h
      ])),
      imports: r.imports.map(a),
      map: t,
      preliminaryFileName: o,
      referencedFiles: r.referencedFiles.map(a),
      sourcemapFileName: s
    };
  }
  generateExports() {
    this.sortedExportNames = null;
    const e = new Set(this.exports);
    if (this.facadeModule !== null && (this.facadeModule.preserveSignature !== !1 || this.strictFacade)) {
      const t = this.facadeModule.getExportNamesByVariable();
      for (const [s, n] of t) {
        this.exportNamesByVariable.set(s, [...n]);
        for (const r of n)
          this.exportsByName.set(r, s);
        e.delete(s);
      }
    }
    for (const t of this.allowExtensionModules) {
      const s = t.getExportNamesByVariable();
      for (const [n, r] of s) {
        this.exportNamesByVariable.set(n, [...r]);
        for (const a of r)
          this.exportsByName.set(a, n);
        e.delete(n);
      }
    }
    this.outputOptions.minifyInternalExports ? Qf(e, this.exportsByName, this.exportNamesByVariable) : Zf(e, this.exportsByName, this.exportNamesByVariable), (this.outputOptions.preserveModules || this.facadeModule && this.facadeModule.info.isEntry) && (this.exportMode = em(this, this.outputOptions, this.facadeModule.id, this.inputOptions.onLog));
  }
  generateFacades() {
    const e = [], t = /* @__PURE__ */ new Set([...this.entryModules, ...this.implicitEntryModules]), s = new Set(this.dynamicEntryModules.map(({ namespace: n }) => n));
    for (const n of t) {
      if (n.preserveSignature === "allow-extension" && this.canPreserveModuleExports(n) && !n.chunkFileNames.size && n.chunkNames.every(({ isUserDefined: o }) => !o)) {
        this.allowExtensionModules.add(n), this.facadeModule || (this.facadeModule = n, this.strictFacade = !1, this.assignFacadeName({}, n, this.outputOptions.preserveModules)), this.facadeChunkByModule.set(n, this);
        continue;
      }
      const r = Array.from(
        new Set(n.chunkNames.filter(({ isUserDefined: a }) => a).map(({ name: a }) => a)),
        // mapping must run after Set 'name' dedupe
        (a) => ({
          name: a
        })
      );
      if (r.length === 0 && n.isUserDefinedEntryPoint && r.push({}), r.push(...Array.from(n.chunkFileNames, (a) => ({ fileName: a }))), r.length === 0 && r.push({}), !this.facadeModule) {
        const a = !this.outputOptions.preserveModules && (n.preserveSignature === "strict" || n.preserveSignature === "exports-only" && n.getExportNamesByVariable().size > 0);
        (!a || this.canModuleBeFacade(n, s)) && (this.facadeModule = n, this.facadeChunkByModule.set(n, this), n.preserveSignature && (this.strictFacade = a), this.assignFacadeName(r.shift(), n, this.outputOptions.preserveModules));
      }
      for (const a of r)
        e.push(pt.generateFacade(this.inputOptions, this.outputOptions, this.unsetOptions, this.pluginDriver, this.modulesById, this.chunkByModule, this.externalChunkByModule, this.facadeChunkByModule, this.includedNamespaces, n, a, this.getPlaceholder, this.bundle, this.inputBase, this.snippets));
    }
    for (const n of this.dynamicEntryModules)
      n.info.syntheticNamedExports || (!this.facadeModule && this.canModuleBeFacade(n, s) ? (this.facadeModule = n, this.facadeChunkByModule.set(n, this), this.strictFacade = !0, this.dynamicName = cr(n)) : this.facadeModule === n && !this.strictFacade && this.canModuleBeFacade(n, s) ? this.strictFacade = !0 : this.facadeChunkByModule.get(n)?.strictFacade || (this.includedNamespaces.add(n), this.exports.add(n.namespace)));
    return this.outputOptions.preserveModules || this.addNecessaryImportsForFacades(), e;
  }
  canPreserveModuleExports(e) {
    const t = e.getExportNamesByVariable();
    for (const [s, n] of t)
      for (const r of n) {
        const a = this.exportsByName.get(r);
        if (a && a !== s)
          return !1;
      }
    for (const [s, n] of t)
      for (const r of n)
        this.exportsByName.set(r, s);
    return !0;
  }
  getChunkName() {
    return this.name ??= this.outputOptions.sanitizeFileName(this.getFallbackChunkName());
  }
  getExportNames() {
    return this.sortedExportNames ??= [...this.exportsByName.keys()].sort();
  }
  getFileName() {
    return this.fileName || this.getPreliminaryFileName().fileName;
  }
  getImportPath(e) {
    return At(kl(e, this.getFileName(), this.outputOptions.format === "amd" && !this.outputOptions.amd.forceJsExtensionForImports, !0));
  }
  getPreliminaryFileName() {
    if (this.preliminaryFileName)
      return this.preliminaryFileName;
    let e, t = null;
    const { chunkFileNames: s, entryFileNames: n, file: r, format: a, preserveModules: o } = this.outputOptions;
    if (r)
      e = os(r);
    else if (this.fileName === null) {
      const [l, c] = o || this.facadeModule?.isUserDefinedEntryPoint ? [n, "output.entryFileNames"] : [s, "output.chunkFileNames"];
      e = Lr(typeof l == "function" ? l(this.getPreRenderedChunkInfo()) : l, c, {
        format: () => a,
        hash: (h) => t || (t = this.getPlaceholder(c, h || Or)),
        name: () => this.getChunkName()
      }), t || (e = Mr(e, this.bundle));
    } else
      e = this.fileName;
    return t || (this.bundle[e] = Oa), this.preliminaryFileName = { fileName: e, hashPlaceholder: t };
  }
  getPreliminarySourcemapFileName() {
    if (this.preliminarySourcemapFileName)
      return this.preliminarySourcemapFileName;
    const { sourcemapFileNames: e, format: t } = this.outputOptions;
    if (!e)
      return null;
    let s = null;
    const [n, r] = [e, "output.sourcemapFileNames"];
    let a = Lr(typeof n == "function" ? n(this.getPreRenderedChunkInfo()) : n, r, {
      chunkhash: () => this.getPreliminaryFileName().hashPlaceholder || "",
      format: () => t,
      hash: (o) => s || (s = this.getPlaceholder(r, o || Or)),
      name: () => this.getChunkName()
    });
    return s || (a = Mr(a, this.bundle)), this.preliminarySourcemapFileName = {
      fileName: a,
      hashPlaceholder: s
    };
  }
  getRenderedChunkInfo() {
    return this.renderedChunkInfo ? this.renderedChunkInfo : this.renderedChunkInfo = {
      ...this.getPreRenderedChunkInfo(),
      dynamicImports: this.getDynamicDependencies().map(gn),
      fileName: this.getFileName(),
      implicitlyLoadedBefore: Array.from(this.implicitlyLoadedBefore, gn),
      importedBindings: dm(this.getRenderedDependencies(), gn),
      imports: Array.from(this.dependencies, gn),
      modules: this.renderedModules,
      referencedFiles: this.getReferencedFiles()
    };
  }
  getVariableExportName(e) {
    return this.outputOptions.preserveModules && e instanceof Mt ? "*" : this.exportNamesByVariable.get(e)[0];
  }
  link() {
    this.dependencies = nm(this, this.orderedModules, this.chunkByModule, this.externalChunkByModule);
    for (const e of this.orderedModules)
      this.addImplicitlyLoadedBeforeFromModule(e), this.setUpChunkImportsAndExportsForModule(e);
  }
  inlineTransitiveImports() {
    const { facadeModule: e, dependencies: t, outputOptions: s } = this, { hoistTransitiveImports: n, preserveModules: r } = s;
    if (n && !r && e !== null)
      for (const a of t)
        a instanceof pt && this.inlineChunkDependencies(a);
  }
  async render() {
    const { exportMode: e, facadeModule: t, inputOptions: { onLog: s }, outputOptions: n, pluginDriver: r, snippets: a } = this, { format: o, preserveModules: l } = n, c = this.getPreliminaryFileName(), h = this.getPreliminarySourcemapFileName(), { accessedGlobals: p, indent: d, magicString: m, renderedSource: f, usedModules: g, usesTopLevelAwait: y } = this.renderModules(c.fileName), b = [...this.getRenderedDependencies().values()], E = e === "none" ? [] : this.getChunkExportDeclarations(o);
    let A = E.length > 0, x = !1;
    for (const B of b) {
      const { reexports: w } = B;
      w?.length && (A = !0, !x && w.some((j) => j.reexported === "default") && (x = !0), o === "es" && (B.reexports = w.filter(({ reexported: j }) => !E.find(({ exported: z }) => z === j))));
    }
    if (!x) {
      for (const { exported: B } of E)
        if (B === "default") {
          x = !0;
          break;
        }
    }
    const { intro: k, outro: F, banner: T, footer: U } = await qf(n, r, this.getRenderedChunkInfo());
    if (tf[o](f, {
      accessedGlobals: p,
      dependencies: b,
      exports: E,
      hasDefaultExport: x,
      hasExports: A,
      id: c.fileName,
      indent: d,
      intro: k,
      isEntryFacade: l || t !== null && t.info.isEntry,
      isModuleFacade: t !== null,
      log: s,
      namedExportsMode: e !== "default",
      outro: F,
      snippets: a,
      usesTopLevelAwait: y
    }, n), T && m.prepend(T), o === "es" || o === "cjs") {
      const B = t !== null && t.info.isEntry && t.shebang;
      B && m.prepend(`#!${B}
`);
    }
    return U && m.append(U), {
      chunk: this,
      magicString: m,
      preliminaryFileName: c,
      preliminarySourcemapFileName: h,
      usedModules: g
    };
  }
  addImplicitlyLoadedBeforeFromModule(e) {
    const { chunkByModule: t, implicitlyLoadedBefore: s } = this;
    for (const n of e.implicitlyLoadedBefore) {
      const r = t.get(n);
      r && r !== this && s.add(r);
    }
  }
  addNecessaryImportsForFacades() {
    for (const [e, t] of this.includedReexportsByModule)
      if (this.includedNamespaces.has(e))
        for (const s of t)
          this.imports.add(s);
  }
  assignFacadeName({ fileName: e, name: t }, s, n) {
    e ? this.fileName = e : this.name = this.outputOptions.sanitizeFileName(t || (n ? this.getPreserveModulesChunkNameFromModule(s) : cr(s)));
  }
  checkCircularDependencyImport(e, t) {
    const s = e.module;
    if (s instanceof Ae) {
      const n = this.chunkByModule.get(s);
      let r;
      do
        r = t.alternativeReexportModules.get(e), r && (this.chunkByModule.get(r) !== n && this.inputOptions.onLog(V, Th(
          // Namespaces do not have an export name
          s.getExportNamesByVariable().get(e)?.[0] || "*",
          s.id,
          r.id,
          t.id,
          this.outputOptions.preserveModules
        )), t = r);
      while (r);
    }
  }
  ensureReexportsAreAvailableForModule(e) {
    const t = [], s = e.getExportNamesByVariable();
    for (const n of s.keys()) {
      const r = n instanceof ze, a = r ? n.getBaseVariable() : n;
      if (this.checkCircularDependencyImport(a, e), !(a instanceof Mt && this.outputOptions.preserveModules)) {
        const o = a.module;
        if (o instanceof Ae) {
          const l = this.chunkByModule.get(o);
          l && l !== this && (l.exports.add(a), t.push(a), r && this.imports.add(a));
        }
      }
    }
    t.length > 0 && this.includedReexportsByModule.set(e, t);
  }
  generateVariableName() {
    if (this.manualChunkAlias)
      return this.manualChunkAlias;
    const e = this.entryModules[0] || this.implicitEntryModules[0] || this.dynamicEntryModules[0] || this.orderedModules[this.orderedModules.length - 1];
    return e ? cr(e) : "chunk";
  }
  getChunkExportDeclarations(e) {
    const t = [];
    for (const s of this.getExportNames()) {
      if (s[0] === "*")
        continue;
      const n = this.exportsByName.get(s);
      if (!(n instanceof ze)) {
        const l = n.module;
        if (l) {
          const c = this.chunkByModule.get(l);
          if (c !== this) {
            if (!c || e !== "es")
              continue;
            const h = this.renderedDependencies.get(c);
            if (!h)
              continue;
            const { imports: p, reexports: d } = h, m = d?.find(({ reexported: g }) => g === s);
            if (!p?.find(({ imported: g }) => g === m?.imported))
              continue;
          }
        }
      }
      let r = null, a = !1, o = n.getName(this.snippets.getPropertyAccess);
      if (n instanceof et) {
        for (const l of n.declarations)
          if (l.parent instanceof ds || l instanceof qt && l.declaration instanceof ds) {
            a = !0;
            break;
          }
      } else n instanceof ze && (r = o, e === "es" && (o = n.renderName));
      t.push({
        exported: s,
        expression: r,
        hoisted: a,
        local: o
      });
    }
    return t;
  }
  getDependenciesToBeDeconflicted(e, t, s) {
    const n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Set(), a = /* @__PURE__ */ new Set();
    for (const o of [...this.exportNamesByVariable.keys(), ...this.imports])
      if (e || o.isNamespace) {
        const l = o.module;
        if (l instanceof Ee) {
          const c = this.externalChunkByModule.get(l);
          n.add(c), e && (o.name === "default" ? di[s(l.id)] && r.add(c) : o.isNamespace && Js[s(l.id)] && (this.imports.has(o) || !this.exportNamesByVariable.get(o)?.every((h) => h[0] === "*")) && a.add(c));
        } else {
          const c = this.chunkByModule.get(l);
          c !== this && (n.add(c), e && c.exportMode === "default" && o.isNamespace && a.add(c));
        }
      }
    if (t)
      for (const o of this.dependencies)
        n.add(o);
    return { deconflictedDefault: r, deconflictedNamespace: a, dependencies: n };
  }
  getDynamicDependencies() {
    return this.getIncludedDynamicImports().map((e) => e.facadeChunk || e.chunk || e.externalChunk || e.resolution).filter((e) => e !== this && (e instanceof pt || e instanceof Rt));
  }
  getDynamicImportStringAndAttributes(e, t, s) {
    const { externalImportAttributes: n } = this.outputOptions, r = ["es", "cjs"].includes(this.outputOptions.format) && n;
    if (e instanceof Ee) {
      const o = this.externalChunkByModule.get(e), l = o.getImportAttributes(this.snippets);
      return [
        `'${o.getImportPath(t)}'`,
        l || (r ? !0 : null)
      ];
    }
    let a = null;
    if (r) {
      const o = eu(s);
      a = o === Re ? !0 : yc(o, this.snippets);
    }
    return [e || "", a];
  }
  getFallbackChunkName() {
    return this.manualChunkAlias ? this.manualChunkAlias : this.dynamicName ? this.dynamicName : this.fileName ? mr(this.fileName) : mr(this.orderedModules[this.orderedModules.length - 1].id);
  }
  getImportSpecifiers() {
    const { interop: e } = this.outputOptions, t = /* @__PURE__ */ new Map();
    for (const s of this.imports) {
      const n = s.module;
      let r, a;
      if (n instanceof Ee) {
        if (r = this.externalChunkByModule.get(n), a = s.name, a !== "default" && a !== "*" && e(n.id) === "defaultOnly")
          return R(Ha(n.id, a, !1));
      } else
        r = this.chunkByModule.get(n), a = r.getVariableExportName(s);
      _e(t, r, Er).push({
        imported: a,
        local: s.getName(this.snippets.getPropertyAccess)
      });
    }
    return t;
  }
  getIncludedDynamicImports() {
    if (this.includedDynamicImports)
      return this.includedDynamicImports;
    const e = [];
    for (const t of this.orderedModules)
      for (const { node: s } of t.dynamicImports) {
        if (!s.included)
          continue;
        const { resolution: n } = s;
        e.push(n instanceof Ae ? {
          chunk: this.chunkByModule.get(n),
          externalChunk: null,
          facadeChunk: this.facadeChunkByModule.get(n),
          node: s,
          resolution: n
        } : n instanceof Ee ? {
          chunk: null,
          externalChunk: this.externalChunkByModule.get(n),
          facadeChunk: null,
          node: s,
          resolution: n
        } : { chunk: null, externalChunk: null, facadeChunk: null, node: s, resolution: n });
      }
    return this.includedDynamicImports = e;
  }
  getPreRenderedChunkInfo() {
    if (this.preRenderedChunkInfo)
      return this.preRenderedChunkInfo;
    const { dynamicEntryModules: e, facadeModule: t, implicitEntryModules: s, orderedModules: n } = this;
    return this.preRenderedChunkInfo = {
      exports: this.getExportNames(),
      facadeModuleId: t && t.id,
      isDynamicEntry: e.length > 0,
      isEntry: !!t?.info.isEntry,
      isImplicitEntry: s.length > 0,
      moduleIds: n.map(({ id: r }) => r),
      name: this.getChunkName(),
      type: "chunk"
    };
  }
  getPreserveModulesChunkNameFromModule(e) {
    const t = nu(e);
    if (t)
      return t;
    const { preserveModulesRoot: s, sanitizeFileName: n } = this.outputOptions, r = n(xt(e.id.split(pm, 1)[0])), a = ns(r), o = um.has(a) ? r.slice(0, -a.length) : r;
    return _t(o) ? s && We(o).startsWith(s) ? o.slice(s.length).replace(/^[/\\]/, "") : this.inputBase === "/" && o[0] !== "/" ? Ga(this.inputBase, o.replace(/^[a-zA-Z]:[/\\]/, "/")) : Ga(this.inputBase, o) : this.outputOptions.virtualDirname.replace(/\/$/, "") + "/" + os(o);
  }
  getReexportSpecifiers() {
    const { externalLiveBindings: e, interop: t } = this.outputOptions, s = /* @__PURE__ */ new Map();
    for (let n of this.getExportNames()) {
      let r, a, o;
      if (n[0] === "*") {
        const l = n.slice(1);
        t(l) === "defaultOnly" && this.inputOptions.onLog(V, Bh(l)), o = e, r = this.externalChunkByModule.get(this.modulesById.get(l)), a = n = "*";
      } else {
        const l = this.exportsByName.get(n);
        if (l instanceof ze)
          continue;
        const c = l.module;
        if (c instanceof Ae) {
          if (r = this.chunkByModule.get(c), r === this)
            continue;
          a = r.getVariableExportName(l), o = l.isReassigned;
        } else {
          if (r = this.externalChunkByModule.get(c), a = l.name, a !== "default" && a !== "*" && t(c.id) === "defaultOnly")
            return R(Ha(c.id, a, !0));
          o = e && (a !== "default" || pi(t(c.id), !0));
        }
      }
      _e(s, r, Er).push({
        imported: a,
        needsLiveBinding: o,
        reexported: n
      });
    }
    return s;
  }
  getReferencedFiles() {
    const e = /* @__PURE__ */ new Set();
    for (const t of this.orderedModules)
      for (const s of t.importMetas) {
        const n = s.getReferencedFileName(this.pluginDriver);
        n && e.add(n);
      }
    return [...e];
  }
  getRenderedDependencies() {
    if (this.renderedDependencies)
      return this.renderedDependencies;
    const e = this.getImportSpecifiers(), t = this.getReexportSpecifiers(), s = /* @__PURE__ */ new Map(), n = this.getFileName();
    for (const r of this.dependencies) {
      const a = e.get(r) || null, o = t.get(r) || null, l = r instanceof Rt || r.exportMode !== "default", c = r.getImportPath(n);
      s.set(r, {
        attributes: r instanceof Rt ? r.getImportAttributes(this.snippets) : null,
        defaultVariableName: r.defaultVariableName,
        globalName: r instanceof Rt && (this.outputOptions.format === "umd" || this.outputOptions.format === "iife") && hm(r, this.outputOptions.globals, (a || o) !== null, this.inputOptions.onLog),
        importPath: c,
        imports: a,
        isChunk: r instanceof pt,
        name: r.variableName,
        namedExportsMode: l,
        namespaceVariableName: r.namespaceVariableName,
        reexports: o
      });
    }
    return this.renderedDependencies = s;
  }
  inlineChunkDependencies(e) {
    for (const t of e.dependencies)
      this.dependencies.has(t) || (this.dependencies.add(t), t instanceof pt && this.inlineChunkDependencies(t));
  }
  // This method changes properties on the AST before rendering and must not be async
  renderModules(e) {
    const { accessedGlobalsByScope: t, dependencies: s, exportNamesByVariable: n, includedNamespaces: r, inputOptions: { onLog: a }, isEmpty: o, orderedModules: l, outputOptions: c, pluginDriver: h, renderedModules: p, snippets: d } = this, { compact: m, format: f, freeze: g, generatedCode: { symbols: y }, importAttributesKey: b } = c, { _: E, cnst: A, n: x } = d;
    this.setDynamicImportResolutions(e), this.setImportMetaResolutions(e), this.setIdentifierRenderResolutions();
    const k = new $d({ separator: `${x}${x}` }), F = sm(l, c), T = [];
    let U = "";
    const B = /* @__PURE__ */ new Set(), w = /* @__PURE__ */ new Map(), j = {
      accessedDocumentCurrentScript: !1,
      exportNamesByVariable: n,
      format: f,
      freeze: g,
      importAttributesKey: b,
      indent: F,
      pluginDriver: h,
      snippets: d,
      symbols: y,
      useOriginalName: null
    };
    let z = !1;
    for (const ne of l) {
      let te = 0, re;
      if (ne.isIncluded() || r.has(ne)) {
        const fe = ne.render(j);
        !j.accessedDocumentCurrentScript && mc.includes(f) && this.accessedGlobalsByScope.get(ne.scope)?.delete(gt), j.accessedDocumentCurrentScript = !1, { source: re } = fe, z ||= fe.usesTopLevelAwait, te = re.length(), te && (m && re.lastLine().includes("//") && re.append(`
`), w.set(ne, re), k.addSource(re), T.push(ne));
        const I = ne.namespace;
        if (r.has(ne)) {
          const pe = I.renderBlock(j);
          I.renderFirst() ? U += x + pe : k.addSource(new Ft(pe));
        }
        const ce = t.get(ne.scope);
        if (ce)
          for (const pe of ce)
            B.add(pe);
      }
      const { renderedExports: Q, removedExports: he } = ne.getRenderedExports();
      p[ne.id] = {
        get code() {
          return re?.toString() ?? null;
        },
        originalLength: ne.originalCode.length,
        removedExports: he,
        renderedExports: Q,
        renderedLength: te
      };
    }
    U && k.prepend(U + x + x), this.needsExportsShim && k.prepend(`${x}${A} ${ps}${E}=${E}void 0;${x}${x}`);
    const le = m ? k : k.trim();
    return o && this.getExportNames().length === 0 && s.size === 0 && a(V, _h(this.getChunkName())), { accessedGlobals: B, indent: F, magicString: k, renderedSource: le, usedModules: T, usesTopLevelAwait: z };
  }
  setDynamicImportResolutions(e) {
    const { accessedGlobalsByScope: t, outputOptions: s, pluginDriver: n, snippets: r } = this;
    for (const a of this.getIncludedDynamicImports())
      if (a.chunk) {
        const { chunk: o, facadeChunk: l, node: c, resolution: h } = a;
        o === this ? c.setInternalResolution(h.namespace) : c.setExternalResolution((l || o).exportMode, s, r, n, t, `'${(l || o).getImportPath(e)}'`, !l?.strictFacade && o.exportNamesByVariable.get(h.namespace)[0], null, this, l || o);
      } else {
        const { node: o, resolution: l } = a, [c, h] = this.getDynamicImportStringAndAttributes(l, e, o);
        o.setExternalResolution("external", s, r, n, t, c, !1, h, this, null);
      }
  }
  setIdentifierRenderResolutions() {
    const { format: e, generatedCode: { symbols: t }, interop: s, preserveModules: n, externalLiveBindings: r } = this.outputOptions, a = /* @__PURE__ */ new Set();
    for (const l of this.getExportNames()) {
      const c = this.exportsByName.get(l);
      e !== "es" && e !== "system" && c.isReassigned && !c.isId ? c.setRenderNames("exports", l) : c instanceof ze ? a.add(c) : c.setRenderNames(null, null);
    }
    for (const l of this.orderedModules)
      if (l.needsExportShim) {
        this.needsExportsShim = !0;
        break;
      }
    const o = new Set(cm);
    this.needsExportsShim && o.add(ps), t && o.add("Symbol"), Jf(this.orderedModules, this.getDependenciesToBeDeconflicted(e !== "es" && e !== "system", e === "amd" || e === "umd" || e === "iife", s), this.imports, o, e, s, n, r, this.chunkByModule, this.externalChunkByModule, a, this.exportNamesByVariable, this.accessedGlobalsByScope, this.includedNamespaces);
  }
  setImportMetaResolutions(e) {
    const { accessedGlobalsByScope: t, includedNamespaces: s, orderedModules: n, outputOptions: { format: r } } = this;
    for (const a of n) {
      for (const o of a.importMetas)
        o.setResolution(r, t, e);
      s.has(a) && a.namespace.prepare(t);
    }
  }
  setUpChunkImportsAndExportsForModule(e) {
    const t = new Set(e.includedImports);
    if (!this.outputOptions.preserveModules && this.includedNamespaces.has(e))
      for (const s of e.getExportedVariablesByName().values())
        s.included && t.add(s);
    for (let s of t) {
      s instanceof lt && (s = s.getOriginalVariable()), s instanceof ze && (s = s.getBaseVariable());
      const n = this.chunkByModule.get(s.module);
      n !== this && (this.imports.add(s), s.module instanceof Ae && (this.checkCircularDependencyImport(s, e), s instanceof Mt && this.outputOptions.preserveModules || n.exports.add(s)));
    }
    (this.includedNamespaces.has(e) || e.info.isEntry && e.preserveSignature !== !1 || e.includedDynamicImporters.some((s) => this.chunkByModule.get(s) !== this)) && this.ensureReexportsAreAvailableForModule(e);
    for (const { node: { included: s, resolution: n } } of e.dynamicImports)
      s && n instanceof Ae && this.chunkByModule.get(n) === this && !this.includedNamespaces.has(n) && (this.includedNamespaces.add(n), this.ensureReexportsAreAvailableForModule(n));
  }
}
function cr(i) {
  return nu(i) ?? mr(i.id);
}
function nu(i) {
  return i.chunkNames.find(({ isUserDefined: e }) => e)?.name ?? i.chunkNames[0]?.name;
}
function dm(i, e) {
  const t = {};
  for (const [s, n] of i) {
    const r = /* @__PURE__ */ new Set();
    if (n.imports)
      for (const { imported: a } of n.imports)
        r.add(a);
    if (n.reexports)
      for (const { imported: a } of n.reexports)
        r.add(a);
    t[e(s)] = [...r];
  }
  return t;
}
const pm = /[#?]/, gn = (i) => i.getFileName();
function* iu(i) {
  for (const e of i)
    yield* e;
}
function fm(i, e, t, s, n, r) {
  const { chunkDefinitions: a, modulesInManualChunks: o } = mm(e, n, r), { allEntries: l, dependentEntriesByModule: c, dynamicallyDependentEntriesByDynamicEntry: h, dynamicImportsByEntry: p, dynamicallyDependentEntriesByAwaitedDynamicEntry: d, awaitedDynamicImportsByEntry: m } = ym(i), f = bm(Am(c, o, a)), g = xm(l, f), y = qo(g, h, p, l), b = qo(g, d, m, l);
  Sm(f, y, b);
  const { chunks: E, sideEffectAtoms: A, sizeByAtom: x } = Pm(f, g, y, t);
  return a.push(...Nm(E, t, A, x, s).map(({ modules: k }) => ({
    alias: null,
    modules: k
  }))), a;
}
function mm(i, e, t) {
  const s = new Set(i.keys()), n = /* @__PURE__ */ Object.create(null), r = [...i].sort(([c], [h]) => c.execIndex - h.execIndex);
  for (const [c, h] of r)
    e && t ? (n[h] ||= []).push(c) : gm(c, n[h] ||= [], s);
  const a = Object.entries(n), o = new Array(a.length);
  let l = 0;
  for (const [c, h] of a)
    o[l++] = { alias: c, modules: h };
  return { chunkDefinitions: o, modulesInManualChunks: s };
}
function gm(i, e, t) {
  const s = /* @__PURE__ */ new Set([i]);
  for (const n of s) {
    t.add(n), e.push(n);
    for (const r of n.dependencies)
      r instanceof Ee || t.has(r) || s.add(r);
  }
}
function ym(i) {
  const e = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map(), n = new Set(i), r = new Array(n.size), a = new Array(n.size);
  let o = 0;
  for (const m of n) {
    const f = /* @__PURE__ */ new Set(), g = /* @__PURE__ */ new Set();
    r[o] = f, a[o] = g;
    const y = /* @__PURE__ */ new Set([m]);
    for (const b of y) {
      _e(s, b, It).add(o);
      for (const E of b.getDependenciesToBeIncluded())
        E instanceof Ee || y.add(E);
      for (const { node: { resolution: E } } of b.dynamicImports)
        if (E instanceof Ae && E.includedDynamicImporters.length > 0 && !n.has(E)) {
          e.add(E), n.add(E), f.add(E);
          for (const A of E.includedTopLevelAwaitingDynamicImporters)
            if (y.has(A)) {
              t.add(E), g.add(E);
              break;
            }
        }
      for (const E of b.implicitlyLoadedBefore)
        n.has(E) || (e.add(E), n.add(E));
    }
    o++;
  }
  const l = [...n], { awaitedDynamicEntries: c, awaitedDynamicImportsByEntry: h, dynamicEntries: p, dynamicImportsByEntry: d } = Em(l, e, r, t, a);
  return {
    allEntries: l,
    awaitedDynamicImportsByEntry: h,
    dependentEntriesByModule: s,
    dynamicallyDependentEntriesByAwaitedDynamicEntry: Ko(s, c, l, (m) => m.includedTopLevelAwaitingDynamicImporters),
    dynamicallyDependentEntriesByDynamicEntry: Ko(s, p, l, (m) => m.includedDynamicImporters),
    dynamicImportsByEntry: d
  };
}
function Em(i, e, t, s, n) {
  const r = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set(), o = /* @__PURE__ */ new Set();
  for (const [h, p] of i.entries())
    r.set(p, h), e.has(p) && a.add(h), s.has(p) && o.add(h);
  const l = Wo(t, r), c = Wo(n, r);
  return {
    awaitedDynamicEntries: o,
    awaitedDynamicImportsByEntry: c,
    dynamicEntries: a,
    dynamicImportsByEntry: l
  };
}
function Wo(i, e) {
  const t = new Array(i.length);
  let s = 0;
  for (const n of i) {
    const r = /* @__PURE__ */ new Set();
    for (const a of n)
      r.add(e.get(a));
    t[s++] = r;
  }
  return t;
}
function Ko(i, e, t, s) {
  const n = /* @__PURE__ */ new Map();
  for (const r of e) {
    const a = _e(n, r, It), o = t[r];
    for (const l of iu([
      s(o),
      o.implicitlyLoadedAfter
    ]))
      for (const c of i.get(l))
        a.add(c);
  }
  return n;
}
function bm(i) {
  const e = /* @__PURE__ */ Object.create(null);
  for (const { dependentEntries: t, modules: s } of i) {
    let n = 0n;
    for (const r of t)
      n |= 1n << BigInt(r);
    (e[String(n)] ||= {
      dependentEntries: new Set(t),
      modules: []
    }).modules.push(...s);
  }
  return Object.values(e);
}
function* Am(i, e, t) {
  for (const [s, n] of i)
    if (!e.has(s)) {
      if (s.cycles.size > 0 && s.includedTopLevelAwaitingDynamicImporters.size > 0) {
        t.push({
          alias: null,
          modules: [s]
        });
        continue;
      }
      yield { dependentEntries: n, modules: [s] };
    }
}
function xm(i, e) {
  const t = i.map(() => 0n);
  let s = 1n;
  for (const { dependentEntries: n } of e) {
    for (const r of n)
      t[r] |= s;
    s <<= 1n;
  }
  return t;
}
function qo(i, e, t, s) {
  const n = s.map((r, a) => e.has(a) ? -1n : 0n);
  for (const [r, a] of e) {
    e.delete(r);
    const o = n[r];
    let l = o;
    for (const c of a)
      l &= i[c] | n[c];
    if (l !== o) {
      n[r] = l;
      for (const c of t[r])
        _e(e, c, It).add(r);
    }
  }
  return n;
}
function Sm(i, e, t) {
  let s = 1n;
  for (const { dependentEntries: n } of i) {
    for (const r of n)
      (e[r] & s) === s && (t[r] & s) === 0n && n.delete(r);
    s <<= 1n;
  }
}
function Pm(i, e, t, s) {
  const n = /* @__PURE__ */ Object.create(null), r = /* @__PURE__ */ new Map(), a = new Array(i.length);
  let o = 0n, l = 1n, c = 0;
  for (const { dependentEntries: p, modules: d } of i) {
    let m = 0n, f = -1n;
    for (const E of p)
      m |= 1n << BigInt(E), f &= e[E] | t[E];
    const g = n[String(m)] ||= {
      containedAtoms: 0n,
      correlatedAtoms: f,
      dependencies: /* @__PURE__ */ new Set(),
      dependentChunks: /* @__PURE__ */ new Set(),
      dependentEntries: new Set(p),
      modules: [],
      pure: !0,
      size: 0
    };
    let y = 0, b = !0;
    for (const E of d)
      r.set(E, g), E.isIncluded() && (b &&= !E.hasEffects(), y += s > 1 ? E.estimateSize() : 1);
    b || (o |= l), a[c++] = y, g.containedAtoms |= l, g.modules.push(...d), g.pure &&= b, g.size += y, l <<= 1n;
  }
  const h = Object.values(n);
  return o |= Im(h, r, l), { chunks: h, sideEffectAtoms: o, sizeByAtom: a };
}
function Im(i, e, t) {
  const s = /* @__PURE__ */ new Map();
  let n = 0n;
  for (const r of i) {
    const { dependencies: a, modules: o } = r;
    for (const l of o)
      for (const c of l.getDependenciesToBeIncluded())
        if (c instanceof Ee) {
          if (c.info.moduleSideEffects) {
            const h = _e(s, c, () => {
              const p = t;
              return t <<= 1n, n |= p, p;
            });
            r.containedAtoms |= h, r.correlatedAtoms |= h;
          }
        } else {
          const h = e.get(c);
          h && h !== r && (a.add(h), h.dependentChunks.add(r));
        }
  }
  return n;
}
function Nm(i, e, t, s, n) {
  Ie("optimize chunks", 3);
  const r = $m(i, e);
  return r ? (e > 1 && n("info", Wa(i.length, r.small.size, "Initially")), wm(r, e, t, s), e > 1 && n("info", Wa(r.small.size + r.big.size, r.small.size, "After merging chunks")), xe("optimize chunks", 3), [...r.small, ...r.big]) : (xe("optimize chunks", 3), i);
}
function $m(i, e) {
  const t = [], s = [];
  for (const n of i)
    (n.size < e ? t : s).push(n);
  return t.length === 0 ? null : (t.sort(Xo), s.sort(Xo), {
    big: new Set(s),
    small: new Set(t)
  });
}
function Xo({ size: i }, { size: e }) {
  return i - e;
}
function wm(i, e, t, s) {
  const { small: n } = i;
  for (const r of n) {
    const a = Cm(
      r,
      i,
      t,
      s,
      // In the default case, we do not accept size increases
      e <= 1 ? 1 : 1 / 0
    );
    if (a) {
      const { containedAtoms: o, correlatedAtoms: l, modules: c, pure: h, size: p } = r;
      n.delete(r), Yo(a, e, i).delete(a), a.modules.push(...c), a.size += p, a.pure &&= h;
      const { dependencies: d, dependentChunks: m, dependentEntries: f } = a;
      a.correlatedAtoms &= l, a.containedAtoms |= o;
      for (const g of r.dependentEntries)
        f.add(g);
      for (const g of r.dependencies)
        d.add(g), g.dependentChunks.delete(r), g.dependentChunks.add(a);
      for (const g of r.dependentChunks)
        m.add(g), g.dependencies.delete(r), g.dependencies.add(a);
      d.delete(a), m.delete(a), Yo(a, e, i).add(a);
    }
  }
}
function Cm(i, { big: e, small: t }, s, n, r) {
  let a = null;
  for (const o of iu([t, e])) {
    if (i === o)
      continue;
    const l = vm(i, o, r, s, n);
    if (l < r) {
      if (a = o, l === 0)
        break;
      r = l;
    }
  }
  return a;
}
function vm(i, e, t, s, n) {
  const r = Jo(i, e, t, s, n);
  return r < t ? r + Jo(e, i, t - r, s, n) : 1 / 0;
}
function Jo(i, e, t, s, n) {
  const { correlatedAtoms: r } = e;
  let a = i.containedAtoms;
  const o = a & s;
  if ((r & o) !== o)
    return 1 / 0;
  const l = new Set(i.dependencies);
  for (const { dependencies: c, containedAtoms: h } of l) {
    a |= h;
    const p = h & s;
    if ((r & p) !== p)
      return 1 / 0;
    for (const d of c) {
      if (d === e)
        return 1 / 0;
      l.add(d);
    }
  }
  return km(a & ~r, t, n);
}
function km(i, e, t) {
  let s = 0, n = 0, r = 1n;
  const { length: a } = t;
  for (; n < a; n++)
    if ((i & r) === r && (s += t[n]), r <<= 1n, s >= e)
      return 1 / 0;
  return s;
}
function Yo(i, e, t) {
  return i.size < e ? t.small : t.big;
}
function Rm(i) {
  if (i.length === 0)
    return "/";
  if (i.length === 1)
    return St(i[0]);
  const e = i.slice(1).reduce((t, s) => {
    const n = s.split(/\/+|\\+/);
    let r;
    for (r = 0; t[r] === n[r] && r < Math.min(t.length, n.length); r++)
      ;
    return t.slice(0, r);
  }, i[0].split(/\/+|\\+/));
  return e.length > 1 ? e.join("/") : "/";
}
const Dm = (i, e) => i.execIndex > e.execIndex ? 1 : -1;
function Om(i) {
  i.sort(Dm);
}
function Lm(i) {
  let e = 0;
  const t = [], s = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = /* @__PURE__ */ new Map(), a = [], o = (c, h) => {
    if (r.has(c)) {
      s.has(c) || t.push(Mm(c, h, r));
      return;
    }
    r.set(c, h), l(c);
  }, l = (c) => {
    if (c instanceof Ae) {
      for (const h of c.dependencies)
        o(h, c);
      for (const h of c.implicitlyLoadedBefore)
        n.add(h);
      for (const { node: { resolution: h, scope: p } } of c.dynamicImports)
        h instanceof Ae && (p.context.usesTopLevelAwait ? o(h, c) : n.add(h));
      a.push(c);
    }
    c.execIndex = e++, s.add(c);
  };
  for (const c of i)
    r.has(c) || (r.set(c, null), l(c));
  for (const c of n)
    r.has(c) || (r.set(c, null), l(c));
  return { cyclePaths: t, orderedModules: a };
}
function Mm(i, e, t) {
  const s = Symbol(i.id), n = [i.id];
  let r = e;
  for (i.cycles.add(s); r !== i; )
    r.cycles.add(s), n.push(r.id), r = t.get(r);
  return n.push(n[0]), n.reverse(), n;
}
function Tm({ compact: i, generatedCode: { arrowFunctions: e, constBindings: t, objectShorthand: s, reservedNamesAsProps: n } }) {
  const { _: r, n: a, s: o } = i ? { _: "", n: "", s: "" } : { _: " ", n: `
`, s: ";" }, l = t ? "const" : "var", c = (m, { isAsync: f, name: g }) => `${f ? "async " : ""}function${g ? ` ${g}` : ""}${r}(${m.join(`,${r}`)})${r}`, h = e ? (m, { isAsync: f, name: g }) => {
    const y = m.length === 1, b = f ? `async${y ? " " : r}` : "";
    return `${g ? `${l} ${g}${r}=${r}` : ""}${b}${y ? m[0] : `(${m.join(`,${r}`)})`}${r}=>${r}`;
  } : c, p = (m, { functionReturn: f, lineBreakIndent: g, name: y }) => [
    `${h(m, {
      isAsync: !1,
      name: y
    })}${e ? g ? `${a}${g.base}${g.t}` : "" : `{${g ? `${a}${g.base}${g.t}` : r}${f ? "return " : ""}`}`,
    e ? `${y ? ";" : ""}${g ? `${a}${g.base}` : ""}` : `${o}${g ? `${a}${g.base}` : r}}`
  ], d = n ? (m) => Bn.test(m) : (m) => !ii.has(m) && Bn.test(m);
  return {
    _: r,
    cnst: l,
    getDirectReturnFunction: p,
    getDirectReturnIifeLeft: (m, f, { needsArrowReturnParens: g, needsWrappedFunction: y }) => {
      const [b, E] = p(m, {
        functionReturn: !0,
        lineBreakIndent: null,
        name: null
      });
      return `${Qo(`${b}${Qo(f, e && g)}${E}`, e || y)}(`;
    },
    getFunctionIntro: h,
    getNonArrowFunctionIntro: c,
    getObject(m, { lineBreakIndent: f }) {
      const g = f ? `${a}${f.base}${f.t}` : r;
      return `{${m.map(([y, b]) => {
        if (y === null)
          return `${g}${b}`;
        const E = ai(y);
        return y === b && s && y === E ? g + y : `${g}${E}:${r}${b}`;
      }).join(",")}${m.length === 0 ? "" : f ? `${a}${f.base}` : r}}`;
    },
    getPropertyAccess: (m) => d(m) ? `.${m}` : `[${JSON.stringify(m)}]`,
    n: a,
    s: o
  };
}
const Qo = (i, e) => e ? `(${i})` : i;
class Zo {
  constructor(e, t) {
    this.isOriginal = !0, this.filename = e, this.content = t;
  }
  traceSegment(e, t, s) {
    return { column: t, line: e, name: s, source: this };
  }
}
class Gn {
  constructor(e, t) {
    this.sources = t, this.names = e.names, this.mappings = e.mappings;
  }
  traceMappings() {
    const e = [], t = /* @__PURE__ */ new Map(), s = [], n = [], r = /* @__PURE__ */ new Map(), a = [];
    for (const o of this.mappings) {
      const l = [];
      for (const c of o) {
        if (c.length === 1)
          continue;
        const h = this.sources[c[1]];
        if (!h)
          continue;
        const p = h.traceSegment(c[2], c[3], c.length === 5 ? this.names[c[4]] : "");
        if (p) {
          const { column: d, line: m, name: f, source: { content: g, filename: y } } = p;
          let b = t.get(y);
          if (b === void 0)
            b = e.length, e.push(y), t.set(y, b), s[b] = g;
          else if (s[b] == null)
            s[b] = g;
          else if (g != null && s[b] !== g)
            return R(Zh(y));
          const E = [c[0], b, m, d];
          if (f) {
            let A = r.get(f);
            A === void 0 && (A = n.length, n.push(f), r.set(f, A)), E[4] = A;
          }
          l.push(E);
        }
      }
      a.push(l);
    }
    return { mappings: a, names: n, sources: e, sourcesContent: s };
  }
  traceSegment(e, t, s) {
    const n = this.mappings[e];
    if (!n)
      return null;
    let r = 0, o = n.length - 1;
    for (; r <= o; ) {
      const l = r + o >> 1;
      let c = n[l];
      if (c[0] !== t && r === o) {
        const h = n[r][0] > t ? Math.max(0, r - 1) : r;
        c = n[h];
      }
      if (c[0] === t || r === o) {
        if (c.length == 1)
          return null;
        const h = this.sources[c[1]];
        return h ? h.traceSegment(c[2], c[3], c.length === 5 ? this.names[c[4]] : s) : null;
      }
      c[0] > t ? o = l - 1 : r = l + 1;
    }
    return null;
  }
}
function ru(i) {
  return function(t, s) {
    return s.missing ? (i(V, ed(s.plugin)), new Gn({
      mappings: [],
      names: []
    }, [t])) : new Gn(s, [t]);
  };
}
function au(i, e, t, s, n) {
  let r;
  if (t) {
    const a = t.sources, o = t.sourcesContent || [], l = St(i) || ".", c = t.sourceRoot || ".", h = a.map((p, d) => new Zo(We(l, c, p), o[d]));
    r = new Gn(t, h);
  } else
    r = new Zo(i, e);
  return s.reduce(n, r);
}
function Bm(i, e, t, s, n, r) {
  const a = ru(r), o = t.filter((f) => !f.excludeFromSourcemap).map((f) => au(f.id, f.originalCode, f.originalSourcemap, f.sourcemapChain, a)), l = new Gn(e, o), c = s.reduce(a, l);
  let { sources: h, sourcesContent: p, names: d, mappings: m } = c.traceMappings();
  if (i) {
    const f = St(i);
    h = h.map((g) => jr(f, g)), i = os(i);
  }
  for (const f of t)
    ka(f.originalSourcemap, f.sourcemapChain);
  return new Jn({
    file: i,
    mappings: m,
    names: d,
    sources: h,
    sourcesContent: n ? void 0 : p
  });
}
function _m(i, e, t, s, n) {
  if (s.length === 0)
    return t;
  const a = au(i, e, t, s, ru(n)).traceMappings();
  return ms({ version: 3, ...a });
}
let el;
const ou = (i) => Kn.xxhashBase64Url(Ma(i)), Fm = (i) => Kn.xxhashBase36(Ma(i)), zm = (i) => Kn.xxhashBase16(Ma(i)), La = {
  base36: Fm,
  base64: ou,
  hex: zm
};
function Ma(i) {
  return typeof i == "string" ? typeof Buffer > "u" ? (el ??= new TextEncoder(), el.encode(i)) : Buffer.from(i) : i;
}
let lu = "sourceMa";
lu += "ppingURL";
async function Vm(i, e, t, s, n) {
  Ie("render chunks", 2), Um(i);
  const r = await Promise.all(i.map((f) => f.render()));
  xe("render chunks", 2), Ie("transform chunks", 2);
  const a = La[s.hashCharacters], o = jm(i), { hashDependenciesByPlaceholder: l, initialHashesByPlaceholder: c, nonHashedChunksWithPlaceholders: h, placeholders: p, renderedChunksByPlaceholder: d } = await Gm(r, o, s, t, a, n), m = Wm(d, l, c, p, e, a);
  Km(d, m, e, h, t, s), xe("transform chunks", 2);
}
function Um(i) {
  for (const e of i)
    e.facadeModule && e.facadeModule.isUserDefinedEntryPoint && e.getPreliminaryFileName();
}
function jm(i) {
  return Object.fromEntries(i.map((e) => {
    const t = e.getRenderedChunkInfo();
    return [t.fileName, t];
  }));
}
async function Hm(i, e, t, s, n, r, a) {
  let o = null;
  const l = [];
  let c = await r.hookReduceArg0("renderChunk", [i.toString(), s[e], n, { chunks: s }], (E, A, x) => {
    if (A == null)
      return E;
    if (typeof A == "string" && (A = {
      code: A,
      map: void 0
    }), A.map !== null) {
      const k = ms(A.map);
      l.push(k || { missing: !0, plugin: x.name });
    }
    return A.code;
  });
  const { compact: h, dir: p, file: d, sourcemap: m, sourcemapExcludeSources: f, sourcemapFile: g, sourcemapPathTransform: y, sourcemapIgnoreList: b } = n;
  if (!h && c[c.length - 1] !== `
` && (c += `
`), m) {
    Ie("sourcemaps", 3);
    let E;
    d ? E = We(g || d) : p ? E = We(p, e) : E = We(e);
    const A = i.generateDecodedMap({});
    o = Bm(E, A, t, l, f, a);
    for (let x = 0; x < o.sources.length; ++x) {
      let k = o.sources[x];
      const F = `${E}.map`, T = b(k, F);
      typeof T != "boolean" && R(He("sourcemapIgnoreList function must return a boolean.")), T && (o.x_google_ignoreList === void 0 && (o.x_google_ignoreList = []), o.x_google_ignoreList.includes(x) || o.x_google_ignoreList.push(x)), y && (k = y(k, F), typeof k != "string" && R(He("sourcemapPathTransform function must return a string."))), o.sources[x] = xt(k);
    }
    xe("sourcemaps", 3);
  }
  return {
    code: c,
    map: o
  };
}
async function Gm(i, e, t, s, n, r) {
  const a = [], o = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Set();
  for (const { preliminaryFileName: { hashPlaceholder: p } } of i)
    p && h.add(p);
  return await Promise.all(i.map(async ({ chunk: p, preliminaryFileName: { fileName: d, hashPlaceholder: m }, preliminarySourcemapFileName: f, magicString: g, usedModules: y }) => {
    const b = {
      chunk: p,
      fileName: d,
      sourcemapFileName: f?.fileName ?? null,
      ...await Hm(g, d, y, e, t, s, r)
    }, { code: E, map: A } = b;
    if (m) {
      const { containedPlaceholders: k, transformedCode: F } = am(E, h);
      let T = F;
      const U = s.hookReduceValueSync("augmentChunkHash", "", [p.getRenderedChunkInfo()], (B, w) => (w && (B += w), B));
      U && (T += U), o.set(m, b), l.set(m, {
        containedPlaceholders: k,
        contentHash: n(T)
      });
    } else
      a.push(b);
    const x = f?.hashPlaceholder;
    A && x && c.set(f.hashPlaceholder, n(A.toString()).slice(0, f.hashPlaceholder.length));
  })), {
    hashDependenciesByPlaceholder: l,
    initialHashesByPlaceholder: c,
    nonHashedChunksWithPlaceholders: a,
    placeholders: h,
    renderedChunksByPlaceholder: o
  };
}
function Wm(i, e, t, s, n, r) {
  const a = new Map(t);
  for (const o of s) {
    const { fileName: l } = i.get(o);
    let c = "";
    const h = /* @__PURE__ */ new Set([o]);
    for (const m of h) {
      const { containedPlaceholders: f, contentHash: g } = e.get(m);
      c += g;
      for (const y of f)
        h.add(y);
    }
    let p, d;
    do
      d && (c = d), d = r(c).slice(0, o.length), p = rm(l, o, d);
    while (n[Ui].has(p.toLowerCase()));
    n[p] = Oa, a.set(o, d);
  }
  return a;
}
function Km(i, e, t, s, n, r) {
  for (const { chunk: a, code: o, fileName: l, sourcemapFileName: c, map: h } of i.values()) {
    let p = vt(o, e);
    const d = vt(l, e);
    let m = null;
    h && (r.sourcemapDebugIds && (p += sl(p, h)), m = c ? vt(c, e) : `${d}.map`, h.file = vt(h.file, e), p += tl(m, h, n, r)), t[d] = a.finalizeChunk(p, h, m, e);
  }
  for (const { chunk: a, code: o, fileName: l, sourcemapFileName: c, map: h } of s) {
    let p = e.size > 0 ? vt(o, e) : o, d = null;
    h && (r.sourcemapDebugIds && (p += sl(p, h)), d = c ? vt(c, e) : `${l}.map`, p += tl(d, h, n, r)), t[l] = a.finalizeChunk(p, h, d, e);
  }
}
function tl(i, e, t, { sourcemap: s, sourcemapBaseUrl: n }) {
  let r;
  if (s === "inline")
    r = e.toUrl();
  else {
    const a = os(i);
    r = n ? new URL(a, n).toString() : a, t.emitFile({
      fileName: i,
      originalFileName: null,
      source: e.toString(),
      type: "asset"
    });
  }
  return s === "hidden" ? "" : `//# ${lu}=${r}
`;
}
function sl(i, e) {
  const t = La.hex(i), s = [
    t.slice(0, 8),
    t.slice(8, 12),
    "4" + t.slice(12, 15),
    (parseInt(t.slice(15, 16), 16) & 3 | 8).toString(16) + t.slice(17, 20),
    t.slice(20, 32)
  ].join("-");
  return e.debugId = s, "//# debugId=" + s + `
`;
}
class qm {
  constructor(e, t, s, n, r) {
    this.outputOptions = e, this.unsetOptions = t, this.inputOptions = s, this.pluginDriver = n, this.graph = r, this.facadeChunkByModule = /* @__PURE__ */ new Map(), this.includedNamespaces = /* @__PURE__ */ new Set();
  }
  async generate(e) {
    Ie("GENERATE", 1);
    const t = /* @__PURE__ */ Object.create(null), s = om(t);
    this.pluginDriver.setOutputBundle(s, this.outputOptions);
    try {
      Ie("initialize render", 2), await this.pluginDriver.hookParallel("renderStart", [this.outputOptions, this.inputOptions]), xe("initialize render", 2), Ie("generate chunks", 2);
      const n = im(), r = await this.generateChunks(s, n);
      r.length > 1 && Xm(this.outputOptions, this.inputOptions.onLog), this.pluginDriver.setChunkInformation(this.facadeChunkByModule);
      for (const a of r)
        a.generateExports(), a.inlineTransitiveImports();
      xe("generate chunks", 2), await Vm(r, s, this.pluginDriver, this.outputOptions, this.inputOptions.onLog);
    } catch (n) {
      throw await this.pluginDriver.hookParallel("renderError", [n]), n;
    }
    return lm(s), Ie("generate bundle", 2), await this.pluginDriver.hookSeq("generateBundle", [
      this.outputOptions,
      s,
      e
    ]), this.finaliseAssets(s), xe("generate bundle", 2), xe("GENERATE", 1), t;
  }
  async addManualChunks(e) {
    const t = /* @__PURE__ */ new Map(), s = await Promise.all(Object.entries(e).map(async ([n, r]) => ({
      alias: n,
      entries: await this.graph.moduleLoader.addAdditionalModules(r, !0)
    })));
    for (const { alias: n, entries: r } of s)
      for (const a of r)
        nl(n, a, t);
    return t;
  }
  assignManualChunks(e) {
    const t = /* @__PURE__ */ new Map(), s = {
      getModuleIds: () => this.graph.modulesById.keys(),
      getModuleInfo: this.graph.getModuleInfo
    };
    for (const n of this.graph.modulesById.values())
      if (n instanceof Ae) {
        const r = e(n.id, s);
        typeof r == "string" && nl(r, n, t);
      }
    return t;
  }
  finaliseAssets(e) {
    if (this.outputOptions.validate) {
      for (const t of Object.values(e))
        if ("code" in t)
          try {
            _r(t.code, { jsx: this.inputOptions.jsx !== !1 });
          } catch (s) {
            this.inputOptions.onLog(V, Eh(t, s));
          }
    }
    this.pluginDriver.finaliseAssets();
  }
  async generateChunks(e, t) {
    const { experimentalMinChunkSize: s, inlineDynamicImports: n, manualChunks: r, preserveModules: a, onlyExplicitManualChunks: o } = this.outputOptions, l = typeof r == "object" ? await this.addManualChunks(r) : this.assignManualChunks(r), c = Tm(this.outputOptions), h = Jm(this.graph.modulesById), p = Rm(Ym(h, a)), d = Qm(this.graph.modulesById, this.outputOptions, p), m = n ? [{ alias: null, modules: h }] : a ? h.map((E) => ({ alias: null, modules: [E] })) : fm(this.graph.entryModules, l, s, this.inputOptions.onLog, typeof r == "function", o), f = new Array(m.length), g = /* @__PURE__ */ new Map();
    let y = 0;
    for (const { alias: E, modules: A } of m) {
      Om(A);
      const x = new pt(A, this.inputOptions, this.outputOptions, this.unsetOptions, this.pluginDriver, this.graph.modulesById, g, d, this.facadeChunkByModule, this.includedNamespaces, E, t, e, p, c);
      f[y++] = x;
    }
    for (const E of f)
      E.link();
    !n && !a && this.checkCircularChunks(f);
    const b = [];
    for (const E of f)
      b.push(...E.generateFacades());
    return [...f, ...b];
  }
  checkCircularChunks(e) {
    const t = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map(), n = (a, o) => {
      if (s.has(a)) {
        if (!t.has(a)) {
          const l = [a.getChunkName()];
          let c = a.isManualChunk, h = o;
          for (; h !== a && h; )
            l.push(h.getChunkName()), c &&= h.isManualChunk, h = s.get(h);
          l.push(l[0]), l.reverse(), this.inputOptions.onLog(V, Gh(l, c));
        }
        return;
      }
      s.set(a, o), r(a);
    }, r = (a) => {
      for (const o of a.dependencies)
        o instanceof pt && n(o, a);
      t.add(a);
    };
    for (const a of e)
      s.has(a) || r(a);
  }
}
function Xm(i, e) {
  if (i.format === "umd" || i.format === "iife")
    return R(be("output.format", Rl, "UMD and IIFE output formats are not supported for code-splitting builds", i.format));
  if (typeof i.file == "string")
    return R(be("output.file", Ln, 'when building multiple chunks, the "output.dir" option must be used, not "output.file". To inline dynamic imports, set the "inlineDynamicImports" option'));
  if (i.sourcemapFile)
    return R(be("output.sourcemapFile", Lh, '"output.sourcemapFile" is only supported for single-file builds'));
  !i.amd.autoId && i.amd.id && e(V, be("output.amd.id", Dl, 'this option is only properly supported for single-file builds. Use "output.amd.autoId" and "output.amd.basePath" instead'));
}
function Jm(i) {
  const e = [];
  for (const t of i.values())
    t instanceof Ae && (t.isIncluded() || t.info.isEntry || t.includedDynamicImporters.length > 0) && e.push(t);
  return e;
}
function Ym(i, e) {
  const t = [];
  for (const s of i)
    (s.info.isEntry || e) && _t(s.id) && t.push(s.id);
  return t;
}
function Qm(i, e, t) {
  const s = /* @__PURE__ */ new Map();
  for (const n of i.values())
    n instanceof Ee && s.set(n, new Rt(n, e, t));
  return s;
}
function nl(i, e, t) {
  const s = t.get(e);
  if (typeof s == "string" && s !== i)
    return R(Mh(e.id, i, s));
  t.set(e, i);
}
function Zm(i) {
  var e, t, s, n = i;
  function r(o, l) {
    ++e > n && (s = t, a(1), ++e), t[o] = l;
  }
  function a(o) {
    e = 0, t = /* @__PURE__ */ Object.create(null), o || (s = /* @__PURE__ */ Object.create(null));
  }
  return a(), {
    clear: a,
    has: function(o) {
      return t[o] !== void 0 || s[o] !== void 0;
    },
    get: function(o) {
      var l = t[o];
      if (l !== void 0) return l;
      if ((l = s[o]) !== void 0)
        return r(o, l), l;
    },
    set: function(o, l) {
      t[o] !== void 0 ? t[o] = l : r(o, l);
    }
  };
}
class eg extends sc {
  constructor() {
    super(), this.parent = null, this.variables.set("undefined", new gc());
  }
  findVariable(e) {
    let t = this.variables.get(e);
    return t || (t = new na(e), this.variables.set(e, t)), t;
  }
}
function tg(i, e, t, s, n, r, a, o, l) {
  let c = null, h = null;
  if (n) {
    c = /* @__PURE__ */ new Set();
    for (const p of n)
      i === p.source && e === p.importer && c.add(p.plugin);
    h = (p, d) => ({
      ...p,
      resolve: (m, f, { attributes: g, custom: y, isEntry: b, skipSelf: E, importerAttributes: A } = Oe) => (E ??= !0, E && n.findIndex((x) => x.plugin === d && x.source === m && x.importer === f) !== -1 ? Promise.resolve(null) : s(m, f, y, b, g || Re, A, E ? [...n, { importer: f, plugin: d, source: m }] : n))
    });
  }
  return t.hookFirstAndGetPlugin("resolveId", [i, e, { attributes: o, custom: r, importerAttributes: l, isEntry: a }], h, c);
}
async function il(i, e, t, s, n, r, a, o, l, c, h) {
  const p = await tg(i, e, s, n, r, a, o, l, c);
  if (p != null) {
    const [d, m] = p;
    return typeof d == "object" && !d.resolvedBy ? {
      ...d,
      resolvedBy: m.name
    } : typeof d == "string" ? {
      id: d,
      resolvedBy: m.name
    } : d;
  }
  return e !== void 0 && !_t(i) && i[0] !== "." ? null : sg(e ? We(St(e), i) : We(i), t, h);
}
async function sg(i, e, t) {
  return await vn(i, e, t) ?? await vn(i + ".mjs", e, t) ?? await vn(i + ".js", e, t);
}
async function vn(i, e, t) {
  try {
    const s = await t.lstat(i);
    if (!e && s.isSymbolicLink())
      return await vn(await t.realpath(i), e, t);
    if (e && s.isSymbolicLink() || s.isFile()) {
      const n = os(i);
      if ((await t.readdir(St(i))).includes(n))
        return i;
    }
  } catch {
  }
}
function cu(i) {
  return i.charCodeAt(0) === 65279 ? cu(i.slice(1)) : i;
}
async function ng(i) {
  do
    i = (await Promise.all(i)).flat(1 / 0);
  while (i.some((e) => e?.then));
  return i;
}
const Ta = (i, e, t = rg) => {
  const { onwarn: s, onLog: n } = i, r = ig(t, s);
  if (n) {
    const a = Dt[e];
    return (o, l) => n(o, uu(l), (c, h) => {
      if (c === Xu)
        return R(ct(h));
      Dt[c] >= a && r(c, ct(h));
    });
  }
  return r;
}, ig = (i, e) => e ? (t, s) => {
  t === V ? e(uu(s), (n) => i(V, ct(n))) : i(t, s);
} : i, uu = (i) => (Object.defineProperty(i, "toString", {
  value: () => i.message,
  writable: !0
}), i), ct = (i) => typeof i == "string" ? { message: i } : typeof i == "function" ? ct(i()) : i, rg = (i, { message: e }) => {
  switch (i) {
    case V:
      return console.warn(e);
    case qn:
      return console.debug(e);
    default:
      return console.info(e);
  }
};
function ln(i, e, t, s, n = /$./) {
  const r = new Set(e), a = Object.keys(i).filter((o) => !(r.has(o) || n.test(o)));
  a.length > 0 && s(V, Ju(t, a, [...r].sort()));
}
const hu = {
  recommended: {
    annotations: !0,
    correctVarValueBeforeDeclaration: !1,
    manualPureFunctions: De,
    moduleSideEffects: () => !0,
    propertyReadSideEffects: !0,
    tryCatchDeoptimization: !0,
    unknownGlobalSideEffects: !1
  },
  safest: {
    annotations: !0,
    correctVarValueBeforeDeclaration: !0,
    manualPureFunctions: De,
    moduleSideEffects: () => !0,
    propertyReadSideEffects: !0,
    tryCatchDeoptimization: !0,
    unknownGlobalSideEffects: !0
  },
  smallest: {
    annotations: !0,
    correctVarValueBeforeDeclaration: !1,
    manualPureFunctions: De,
    moduleSideEffects: () => !1,
    propertyReadSideEffects: !1,
    tryCatchDeoptimization: !1,
    unknownGlobalSideEffects: !1
  }
}, du = {
  preserve: {
    factory: null,
    fragment: null,
    importSource: null,
    mode: "preserve"
  },
  "preserve-react": {
    factory: "React.createElement",
    fragment: "React.Fragment",
    importSource: "react",
    mode: "preserve"
  },
  react: {
    factory: "React.createElement",
    fragment: "React.Fragment",
    importSource: "react",
    mode: "classic"
  },
  "react-jsx": {
    factory: "React.createElement",
    importSource: "react",
    jsxImportSource: "react/jsx-runtime",
    mode: "automatic"
  }
}, pu = {
  es2015: {
    arrowFunctions: !0,
    constBindings: !0,
    objectShorthand: !0,
    reservedNamesAsProps: !0,
    symbols: !0
  },
  es5: {
    arrowFunctions: !1,
    constBindings: !1,
    objectShorthand: !1,
    reservedNamesAsProps: !0,
    symbols: !1
  }
}, fu = (i) => i && typeof i == "object" ? i : {}, Wn = (i, e, t, s) => (n) => {
  if (typeof n == "string") {
    const r = i[n];
    if (r)
      return r;
    R(be(e, t, `valid values are ${s}${wl(Object.keys(i))}. You can also supply an object for more fine-grained control`, n));
  }
  return fu(n);
}, Ba = (i, e, t, s, n) => {
  const r = i?.preset;
  if (r) {
    const a = e[r];
    if (a)
      return { ...a, ...i };
    R(be(`${t}.preset`, s, `valid values are ${wl(Object.keys(e))}`, r));
  }
  return Wn(e, t, s, n)(i);
}, Ps = async (i) => (await ng([i])).filter(Boolean), _a = "at position ", Fa = "at output position ";
function ag(i) {
  return {
    delete(e) {
      return delete i[e];
    },
    get(e) {
      const t = i[e];
      if (t)
        return t[0] = 0, t[1];
    },
    has(e) {
      const t = i[e];
      return t ? (t[0] = 0, !0) : !1;
    },
    set(e, t) {
      i[e] = [0, t];
    }
  };
}
function og(i, e) {
  return {
    delete(t) {
      return e(), i.delete(t);
    },
    get(t) {
      return e(), i.get(t);
    },
    has(t) {
      return e(), i.has(t);
    },
    set(t, s) {
      return e(), i.set(t, s);
    }
  };
}
const lg = {
  delete() {
    return !1;
  },
  get() {
  },
  has() {
    return !1;
  },
  set() {
  }
};
function yn(i) {
  return i.startsWith(_a) || i.startsWith(Fa) ? R(Fh()) : R(zh(i));
}
function cg(i) {
  return {
    delete() {
      return yn(i);
    },
    get() {
      return yn(i);
    },
    has() {
      return yn(i);
    },
    set() {
      return yn(i);
    }
  };
}
async function ug(i, e, t, s) {
  const n = e.id, r = [];
  let a = i.map === null ? null : ms(i.map);
  const o = i.code;
  let l = i.ast;
  const c = [], h = [];
  let p = !1;
  const d = () => p = !0;
  let m = "", f = i.code;
  function g(E, A, x) {
    let k, F;
    if (typeof A == "string")
      k = A;
    else if (A && typeof A == "object") {
      if (e.updateOptions(A), A.code == null)
        return (A.map || A.ast) && s.onLog(V, Ih(x.name)), E;
      A.attributes && ft('Returning attributes from the "transform" hook is forbidden.', Nh, !1, s), { code: k, map: F, ast: l } = A;
    } else
      return E;
    return F !== null && r.push(ms(typeof F == "string" ? JSON.parse(F) : F) || {
      missing: !0,
      plugin: x.name
    }), f = k, k;
  }
  const y = (E) => (A, x) => {
    A = ct(A), x && fr(A, x, f, n), A.id = n, A.hook = "transform", E(A);
  };
  let b;
  try {
    b = await t.hookReduceArg0("transform", [
      f,
      n,
      {
        attributes: e.info.attributes
      }
    ], g, (E, A) => (m = A.name, {
      ...E,
      addWatchFile(x) {
        c.push(x), E.addWatchFile(x);
      },
      cache: p ? E.cache : og(E.cache, d),
      debug: y(E.debug),
      emitFile(x) {
        return h.push(x), t.emitFile(x);
      },
      error(x, k) {
        return typeof x == "string" && (x = { message: x }), k && fr(x, k, f, n), x.id = n, x.hook = "transform", E.error(x);
      },
      getCombinedSourcemap() {
        const x = _m(n, o, a, r, s.onLog);
        return x ? (a !== x && (a = x, r.length = 0), new Jn({
          ...x,
          file: null,
          sourcesContent: x.sourcesContent
        })) : new Ft(o).generateMap({ hires: !0, includeContent: !0, source: n });
      },
      info: y(E.info),
      setAssetSource() {
        return this.error(rh());
      },
      warn: y(E.warn)
    }));
  } catch (E) {
    return R(Ms(E, m, { hook: "transform", id: n }));
  }
  return !p && // files emitted by a transform hook need to be emitted again if the hook is skipped
  h.length > 0 && (e.transformFiles = h), {
    ast: l,
    code: b,
    customTransformCache: p,
    originalCode: o,
    originalSourcemap: a,
    safeVariableNames: null,
    sourcemapChain: r,
    transformDependencies: c
  };
}
const ur = "resolveDependencies";
class hg {
  constructor(e, t, s, n) {
    this.graph = e, this.modulesById = t, this.options = s, this.pluginDriver = n, this.implicitEntryModules = /* @__PURE__ */ new Set(), this.indexedEntryModules = [], this.latestLoadModulesPromise = Promise.resolve(), this.moduleLoadPromises = /* @__PURE__ */ new Map(), this.modulesWithLoadedDependencies = /* @__PURE__ */ new Set(), this.nextChunkNamePriority = 0, this.nextEntryModuleIndex = 0, this.resolveId = async (r, a, o, l, c, h, p = null) => this.getResolvedIdWithDefaults(this.getNormalizedResolvedIdWithoutDefaults(this.options.external(r, a, !1) ? !1 : await il(r, a, this.options.preserveSymlinks, this.pluginDriver, this.resolveId, p, o, typeof l == "boolean" ? l : !a, c, h, this.options.fs), a, r), c), this.hasModuleSideEffects = s.treeshake ? s.treeshake.moduleSideEffects : () => !0;
  }
  async addAdditionalModules(e, t) {
    const s = this.extendLoadModulesPromise(Promise.all(e.map((n) => this.loadEntryModule(n, !1, void 0, null, t, void 0))));
    return await this.awaitLoadModulesPromise(), s;
  }
  async addEntryModules(e, t) {
    const s = this.nextEntryModuleIndex;
    this.nextEntryModuleIndex += e.length;
    const n = this.nextChunkNamePriority;
    this.nextChunkNamePriority += e.length;
    const r = await this.extendLoadModulesPromise(Promise.all(e.map(({ id: a, importer: o }) => this.loadEntryModule(a, !0, o, null, void 0, void 0))).then((a) => {
      for (const [o, l] of a.entries()) {
        l.isUserDefinedEntryPoint = l.isUserDefinedEntryPoint || t, al(l, e[o], t, n + o);
        const c = this.indexedEntryModules.find((h) => h.module === l);
        c ? c.index = Math.min(c.index, s + o) : this.indexedEntryModules.push({
          index: s + o,
          module: l
        });
      }
      return this.indexedEntryModules.sort(({ index: o }, { index: l }) => o > l ? 1 : -1), a;
    }));
    return await this.awaitLoadModulesPromise(), {
      entryModules: this.indexedEntryModules.map(({ module: a }) => a),
      implicitEntryModules: [...this.implicitEntryModules],
      newEntryModules: r
    };
  }
  async emitChunk({ fileName: e, id: t, importer: s, name: n, implicitlyLoadedAfterOneOf: r, preserveSignature: a }) {
    const o = {
      fileName: e || null,
      id: t,
      importer: s,
      name: n || null
    }, l = r ? await this.addEntryWithImplicitDependants(o, r) : (await this.addEntryModules([o], !1)).newEntryModules[0];
    return a != null && (l.preserveSignature = a), l;
  }
  async preloadModule(e) {
    return (await this.fetchModule(this.getResolvedIdWithDefaults(e, Re), void 0, !1, e.resolveDependencies ? ur : !0)).info;
  }
  addEntryWithImplicitDependants(e, t) {
    const s = this.nextChunkNamePriority++;
    return this.extendLoadModulesPromise(this.loadEntryModule(e.id, !1, e.importer, null, void 0, void 0).then(async (n) => {
      if (al(n, e, !1, s), !n.info.isEntry) {
        const r = await Promise.all(t.map((a) => this.loadEntryModule(a, !1, e.importer, n.id, void 0, void 0)));
        if (!n.info.isEntry) {
          this.implicitEntryModules.add(n);
          for (const a of r)
            n.implicitlyLoadedAfter.add(a);
          for (const a of n.implicitlyLoadedAfter)
            a.implicitlyLoadedBefore.add(n);
        }
      }
      return n;
    }));
  }
  async addModuleSource(e, t, s) {
    let n;
    try {
      n = await this.graph.fileOperationQueue.run(async () => {
        const o = await this.pluginDriver.hookFirst("load", [
          e,
          { attributes: s.info.attributes }
        ]);
        return o !== null ? (typeof o == "object" && o.attributes && ft('Returning attributes from the "load" hook is forbidden.', Nu, !1, this.options), o) : (this.graph.watchFiles[e] = !0, await this.options.fs.readFile(e, { encoding: "utf8" }));
      });
    } catch (o) {
      let l = `Could not load ${e}`;
      throw t && (l += ` (imported by ${kn(t)})`), l += `: ${o.message}`, o.message = l, o;
    }
    const r = typeof n == "string" ? { code: n } : n != null && typeof n == "object" && typeof n.code == "string" ? n : R($u(e));
    r.code = cu(r.code);
    const a = this.graph.cachedModules.get(e);
    if (a && !a.customTransformCache && a.originalCode === r.code && !await this.pluginDriver.hookFirst("shouldTransformCachedModule", [
      {
        ast: a.ast,
        attributes: a.attributes,
        code: a.code,
        id: a.id,
        meta: a.meta,
        moduleSideEffects: a.moduleSideEffects,
        resolvedSources: a.resolvedIds,
        syntheticNamedExports: a.syntheticNamedExports
      }
    ])) {
      if (a.transformFiles)
        for (const o of a.transformFiles)
          this.pluginDriver.emitFile(o);
      await s.setSource(a);
    } else
      s.updateOptions(r), await s.setSource(await ug(r, s, this.pluginDriver, this.options));
  }
  async awaitLoadModulesPromise() {
    let e;
    do
      e = this.latestLoadModulesPromise, await e;
    while (e !== this.latestLoadModulesPromise);
  }
  extendLoadModulesPromise(e) {
    return this.latestLoadModulesPromise = Promise.all([
      e,
      this.latestLoadModulesPromise
    ]), this.latestLoadModulesPromise.catch(() => {
    }), e;
  }
  async fetchDynamicDependencies(e, t) {
    const s = await Promise.all(t.map((n) => n.then(async ([{ node: r }, a]) => a === null ? null : typeof a == "string" ? (r.resolution = a, null) : r.resolution = await this.fetchResolvedDependency(kn(a.id), e.id, a))));
    for (const n of s)
      n && (e.dynamicDependencies.add(n), n.dynamicImporters.push(e.id));
  }
  // If this is a preload, then this method always waits for the dependencies of
  // the module to be resolved.
  // Otherwise, if the module does not exist, it waits for the module and all
  // its dependencies to be loaded.
  // Otherwise, it returns immediately.
  async fetchModule({ attributes: e, id: t, meta: s, moduleSideEffects: n, syntheticNamedExports: r }, a, o, l) {
    const c = this.modulesById.get(t);
    if (c instanceof Ae)
      return a && Cn(e, c.info.attributes) && this.options.onLog(V, xn(c.info.attributes, e, t, a)), await this.handleExistingModule(c, o, l), c;
    if (c instanceof Ee)
      return R(wu(c.id));
    const h = new Ae(this.graph, t, this.options, o, n, r, s, e);
    this.modulesById.set(t, h);
    const p = this.addModuleSource(t, a, h).then(() => [
      this.getResolveStaticDependencyPromises(h),
      this.getResolveDynamicImportPromises(h),
      d
    ]), d = ol(p).then(() => this.pluginDriver.hookParallel("moduleParsed", [h.info]));
    d.catch(() => {
    }), this.moduleLoadPromises.set(h, p);
    const m = await p;
    return l ? l === ur && await d : await this.fetchModuleDependencies(h, ...m), h;
  }
  async fetchModuleDependencies(e, t, s, n) {
    this.modulesWithLoadedDependencies.has(e) || (this.modulesWithLoadedDependencies.add(e), await Promise.all([
      this.fetchStaticDependencies(e, t),
      this.fetchDynamicDependencies(e, s)
    ]), e.linkImports(), await n);
  }
  fetchResolvedDependency(e, t, s) {
    if (s.external) {
      const { attributes: n, external: r, id: a, moduleSideEffects: o, meta: l } = s;
      let c = this.modulesById.get(a);
      if (!c)
        c = new Ee(this.options, a, o, l, r !== "absolute" && _t(a), n), this.modulesById.set(a, c);
      else if (c instanceof Ee)
        Cn(c.info.attributes, n) && this.options.onLog(V, xn(c.info.attributes, n, e, t));
      else return R(Cu(e, t));
      return Promise.resolve(c);
    }
    return this.fetchModule(s, t, !1, !1);
  }
  async fetchStaticDependencies(e, t) {
    for (const s of await Promise.all(t.map((n) => n.then(([r, a]) => this.fetchResolvedDependency(r, e.id, a)))))
      e.dependencies.add(s), s.importers.push(e.id);
    if (!this.options.treeshake || e.info.moduleSideEffects === "no-treeshake")
      for (const s of e.dependencies)
        s instanceof Ae && (s.importedFromNotTreeshaken = !0);
  }
  getNormalizedResolvedIdWithoutDefaults(e, t, s) {
    const { makeAbsoluteExternalsRelative: n } = this.options;
    if (e) {
      if (typeof e == "object") {
        const o = e.external || this.options.external(e.id, t, !0);
        return {
          ...e,
          external: o && (o === "relative" || !_t(e.id) || o === !0 && hr(e.id, s, n) || "absolute")
        };
      }
      const a = this.options.external(e, t, !0);
      return {
        external: a && (hr(e, s, n) || "absolute"),
        id: a && n ? rl(e, t) : e
      };
    }
    const r = n ? rl(s, t) : s;
    return e !== !1 && !this.options.external(r, t, !0) ? null : {
      external: hr(r, s, n) || "absolute",
      id: r
    };
  }
  getResolveDynamicImportPromises(e) {
    return e.dynamicImports.map(async (t) => {
      const s = await this.resolveDynamicImport(e, t.argument, e.id, eu(t.node));
      return !s || typeof s == "string" ? t.node.shouldIncludeDynamicAttributes = !0 : (t.node.shouldIncludeDynamicAttributes = !!s.external, t.id = s.id), [t, s];
    });
  }
  getResolveStaticDependencyPromises(e) {
    return Array.from(e.sourcesWithAttributes, async ([t, s]) => [
      t,
      e.resolvedIds[t] = e.resolvedIds[t] || this.handleInvalidResolvedId(await this.resolveId(t, e.id, Re, !1, s, e.info.attributes), t, e.id, s)
    ]);
  }
  getResolvedIdWithDefaults(e, t) {
    if (!e)
      return null;
    const s = e.external || !1;
    return {
      attributes: e.attributes || t,
      external: s,
      id: e.id,
      meta: e.meta || {},
      moduleSideEffects: e.moduleSideEffects ?? this.hasModuleSideEffects(e.id, !!s),
      resolvedBy: e.resolvedBy ?? "rollup",
      syntheticNamedExports: e.syntheticNamedExports ?? !1
    };
  }
  async handleExistingModule(e, t, s) {
    const n = this.moduleLoadPromises.get(e);
    if (s)
      return s === ur ? ol(n) : n;
    if (t) {
      e.info.isEntry = !0, this.implicitEntryModules.delete(e);
      for (const r of e.implicitlyLoadedAfter)
        r.implicitlyLoadedBefore.delete(e);
      e.implicitlyLoadedAfter.clear();
    }
    return this.fetchModuleDependencies(e, ...await n);
  }
  handleInvalidResolvedId(e, t, s, n) {
    return e === null ? Br(t) ? R(vu(t, s)) : (this.options.onLog(V, ku(t, s)), {
      attributes: n,
      external: !0,
      id: t,
      meta: {},
      moduleSideEffects: this.hasModuleSideEffects(t, !0),
      resolvedBy: "rollup",
      syntheticNamedExports: !1
    }) : (e.external && e.syntheticNamedExports && this.options.onLog(V, Ru(t, s)), e);
  }
  async loadEntryModule(e, t, s, n, r = !1, a) {
    const o = await il(e, s, this.options.preserveSymlinks, this.pluginDriver, this.resolveId, null, Re, !0, Re, a, this.options.fs);
    if (o == null)
      return R(n === null ? Du(e) : Ou(e, n));
    const l = typeof o == "object" && o.external;
    return o === !1 || l ? R(n === null ? l && r ? Lu(e) : Mu(e) : Tu(e, n)) : this.fetchModule(this.getResolvedIdWithDefaults(typeof o == "object" ? o : { id: o }, Re), void 0, t, !1);
  }
  async resolveDynamicImport(e, t, s, n) {
    const r = await this.pluginDriver.hookFirst("resolveDynamicImport", [
      t,
      s,
      { attributes: n, importerAttributes: e.info.attributes }
    ]);
    if (typeof t != "string")
      return typeof r == "string" ? r : r ? this.getResolvedIdWithDefaults(r, n) : null;
    if (r == null) {
      const a = e.resolvedIds[t];
      return a ? (Cn(a.attributes, n) && this.options.onLog(V, xn(a.attributes, n, t, s)), a) : e.resolvedIds[t] = this.handleInvalidResolvedId(await this.resolveId(t, e.id, Re, !1, n, e.info.attributes), t, e.id, n);
    }
    return this.handleInvalidResolvedId(this.getResolvedIdWithDefaults(this.getNormalizedResolvedIdWithoutDefaults(r, s, t), n), t, s, n);
  }
}
function rl(i, e) {
  return Br(i) ? e ? We(e, "..", i) : We(i) : i;
}
function al(i, { fileName: e, name: t }, s, n) {
  if (e !== null)
    i.chunkFileNames.add(e);
  else if (t !== null) {
    let r = 0;
    for (; i.chunkNames[r]?.priority < n; )
      r++;
    i.chunkNames.splice(r, 0, { isUserDefined: s, name: t, priority: n });
  }
}
function hr(i, e, t) {
  return t === !0 || t === "ifRelativeSource" && Br(e) || !_t(i);
}
async function ol(i) {
  const [e, t] = await i;
  return Promise.all([...e, ...t]);
}
function ll(i, e, t, s, n, r, a, o, l) {
  const c = a.sanitizeFileName(i || "asset");
  return Mr(Lr(typeof a.assetFileNames == "function" ? a.assetFileNames({
    // Additionally, this should be non-enumerable in the next major
    get name() {
      return ft('Accessing the "name" property of emitted assets when generating the file name is deprecated. Use the "names" property instead.', ss, !1, l), i;
    },
    names: e,
    // Additionally, this should be non-enumerable in the next major
    get originalFileName() {
      return ft('Accessing the "originalFileName" property of emitted assets when generating the file name is deprecated. Use the "originalFileNames" property instead.', ss, !1, l), s;
    },
    originalFileNames: n,
    source: t,
    type: "asset"
  }) : a.assetFileNames, "output.assetFileNames", {
    ext: () => ns(c).slice(1),
    extname: () => ns(c),
    hash: (h) => r.slice(0, Math.min(Math.max(0, h || Or), Hn)),
    name: () => c.slice(0, Math.max(0, c.length - ns(c).length))
  }), o);
}
function cl(i, { bundle: e }, t) {
  e[Ui].has(i.toLowerCase()) ? t(V, Ph(i)) : e[i] = Oa;
}
const dg = /* @__PURE__ */ new Set(["chunk", "asset", "prebuilt-chunk"]);
function pg(i) {
  return !!(i && dg.has(i.type));
}
function fg(i) {
  const e = i.fileName || i.name;
  return !e || typeof e == "string" && !Dn(e);
}
function ul(i, e, t) {
  if (!(typeof i == "string" || i instanceof Uint8Array)) {
    const s = e.fileName || e.name || t;
    return R(He(`Could not set source for ${typeof s == "string" ? `asset "${s}"` : "unnamed asset"}, asset source needs to be a string, Uint8Array or Buffer.`));
  }
  return i;
}
function mg(i, e) {
  return typeof i.fileName != "string" ? R(Sh(i.name || e)) : i.fileName;
}
function gg(i, e) {
  return i.fileName ? i.fileName : e ? e.get(i.module).getFileName() : R(xh(i.fileName || i.name));
}
class yg {
  constructor(e, t, s) {
    this.graph = e, this.options = t, this.facadeChunkByModule = null, this.nextIdBase = 1, this.output = null, this.outputFileEmitters = [], this.emitFile = (n) => pg(n) ? n.type === "prebuilt-chunk" ? this.emitPrebuiltChunk(n) : fg(n) ? n.type === "chunk" ? this.emitChunk(n) : this.emitAsset(n) : R(He(`The "fileName" or "name" properties of emitted chunks and assets must be strings that are neither absolute nor relative paths, received "${n.fileName || n.name}".`)) : R(He(`Emitted files must be of type "asset", "chunk" or "prebuilt-chunk", received "${n && n.type}".`)), this.finaliseAssets = () => {
      for (const [n, r] of this.filesByReferenceId)
        if (r.type === "asset" && typeof r.fileName != "string")
          return R(Zu(r.name || n));
    }, this.getFileName = (n) => {
      const r = this.filesByReferenceId.get(n);
      return r ? r.type === "chunk" ? gg(r, this.facadeChunkByModule) : r.type === "prebuilt-chunk" ? r.fileName : mg(r, n) : R(eh(n));
    }, this.setAssetSource = (n, r) => {
      const a = this.filesByReferenceId.get(n);
      if (!a)
        return R(th(n));
      if (a.type !== "asset")
        return R(He(`Asset sources can only be set for emitted assets but "${n}" is an emitted chunk.`));
      if (a.source !== void 0)
        return R(sh(a.name || n));
      const o = ul(r, a, n);
      if (this.output)
        this.finalizeAdditionalAsset(a, o, this.output);
      else {
        a.source = o;
        for (const l of this.outputFileEmitters)
          l.finalizeAdditionalAsset(a, o, l.output);
      }
    }, this.setChunkInformation = (n) => {
      this.facadeChunkByModule = n;
    }, this.setOutputBundle = (n, r) => {
      const a = La[r.hashCharacters], o = this.output = {
        bundle: n,
        fileNamesBySourceHash: /* @__PURE__ */ new Map(),
        getHash: a,
        outputOptions: r
      };
      for (const c of this.filesByReferenceId.values())
        c.fileName && cl(c.fileName, o, this.options.onLog);
      const l = /* @__PURE__ */ new Map();
      for (const c of this.filesByReferenceId.values())
        if (c.type === "asset" && c.source !== void 0)
          if (c.fileName)
            this.finalizeAdditionalAsset(c, c.source, o);
          else {
            const h = a(c.source);
            _e(l, h, Er).push(c);
          }
        else c.type === "prebuilt-chunk" && (this.output.bundle[c.fileName] = this.createPrebuiltChunk(c));
      for (const [c, h] of l)
        this.finalizeAssetsWithSameSource(h, c, o);
    }, this.filesByReferenceId = s ? new Map(s.filesByReferenceId) : /* @__PURE__ */ new Map(), s?.addOutputFileEmitter(this);
  }
  addOutputFileEmitter(e) {
    this.outputFileEmitters.push(e);
  }
  assignReferenceId(e, t) {
    let s = t;
    do
      s = ou(s).slice(0, 8).replaceAll("-", "$");
    while (this.filesByReferenceId.has(s) || this.outputFileEmitters.some(({ filesByReferenceId: n }) => n.has(s)));
    e.referenceId = s, this.filesByReferenceId.set(s, e);
    for (const { filesByReferenceId: n } of this.outputFileEmitters)
      n.set(s, e);
    return s;
  }
  createPrebuiltChunk(e) {
    return {
      code: e.code,
      dynamicImports: [],
      exports: e.exports || [],
      facadeModuleId: null,
      fileName: e.fileName,
      implicitlyLoadedBefore: [],
      importedBindings: {},
      imports: [],
      isDynamicEntry: !1,
      isEntry: !1,
      isImplicitEntry: !1,
      map: e.map || null,
      moduleIds: [],
      modules: {},
      name: e.fileName,
      preliminaryFileName: e.fileName,
      referencedFiles: [],
      sourcemapFileName: e.sourcemapFileName || null,
      type: "chunk"
    };
  }
  emitAsset(e) {
    const t = e.source === void 0 ? void 0 : ul(e.source, e, null), s = e.originalFileName || null;
    typeof s == "string" && (this.graph.watchFiles[s] = !0);
    const n = {
      fileName: e.fileName,
      name: e.name,
      needsCodeReference: !!e.needsCodeReference,
      originalFileName: s,
      referenceId: "",
      source: t,
      type: "asset"
    }, r = this.assignReferenceId(n, e.fileName || e.name || String(this.nextIdBase++));
    if (this.output)
      this.emitAssetWithReferenceId(n, this.output);
    else
      for (const a of this.outputFileEmitters)
        a.emitAssetWithReferenceId(n, a.output);
    return r;
  }
  emitAssetWithReferenceId(e, t) {
    const { fileName: s, source: n } = e;
    s && cl(s, t, this.options.onLog), n !== void 0 && this.finalizeAdditionalAsset(e, n, t);
  }
  emitChunk(e) {
    if (this.graph.phase > Tt.LOAD_AND_PARSE)
      return R(nh());
    if (typeof e.id != "string")
      return R(He(`Emitted chunks need to have a valid string id, received "${e.id}"`));
    const t = {
      fileName: e.fileName,
      module: null,
      name: e.name || e.id,
      referenceId: "",
      type: "chunk"
    };
    return this.graph.moduleLoader.emitChunk(e).then((s) => t.module = s).catch(() => {
    }), this.assignReferenceId(t, e.id);
  }
  emitPrebuiltChunk(e) {
    if (typeof e.code != "string")
      return R(He(`Emitted prebuilt chunks need to have a valid string code, received "${e.code}".`));
    if (typeof e.fileName != "string" || Dn(e.fileName))
      return R(He(`The "fileName" property of emitted prebuilt chunks must be strings that are neither absolute nor relative paths, received "${e.fileName}".`));
    const t = {
      code: e.code,
      exports: e.exports,
      fileName: e.fileName,
      map: e.map,
      referenceId: "",
      type: "prebuilt-chunk"
    }, s = this.assignReferenceId(t, t.fileName);
    return this.output && (this.output.bundle[t.fileName] = this.createPrebuiltChunk(t)), s;
  }
  finalizeAdditionalAsset(e, t, { bundle: s, fileNamesBySourceHash: n, getHash: r, outputOptions: a }) {
    let { fileName: o, name: l, needsCodeReference: c, originalFileName: h, referenceId: p } = e;
    if (!o) {
      const f = r(t);
      o = n.get(f), o || (o = ll(l, l ? [l] : [], t, h, h ? [h] : [], f, a, s, this.options), n.set(f, o));
    }
    const d = { ...e, fileName: o, source: t };
    this.filesByReferenceId.set(p, d);
    const m = s[o];
    if (m?.type === "asset")
      m.needsCodeReference &&= c, l && m.names.push(l), h && m.originalFileNames.push(h);
    else {
      const { options: f } = this;
      s[o] = {
        fileName: o,
        get name() {
          return ft('Accessing the "name" property of emitted assets in the bundle is deprecated. Use the "names" property instead.', ss, !1, f), l;
        },
        names: l ? [l] : [],
        needsCodeReference: c,
        get originalFileName() {
          return ft('Accessing the "originalFileName" property of emitted assets in the bundle is deprecated. Use the "originalFileNames" property instead.', ss, !1, f), h;
        },
        originalFileNames: h ? [h] : [],
        source: t,
        type: "asset"
      };
    }
  }
  finalizeAssetsWithSameSource(e, t, { bundle: s, fileNamesBySourceHash: n, outputOptions: r }) {
    const { names: a, originalFileNames: o } = Eg(e);
    let l = "", c, h = !0;
    for (const d of e) {
      h &&= d.needsCodeReference;
      const m = ll(d.name, a, d.source, d.originalFileName, o, t, r, s, this.options);
      (!l || m.length < l.length || m.length === l.length && m < l) && (l = m, c = d);
    }
    n.set(t, l);
    for (const d of e) {
      const m = { ...d, fileName: l };
      this.filesByReferenceId.set(d.referenceId, m);
    }
    const { options: p } = this;
    s[l] = {
      fileName: l,
      get name() {
        return ft('Accessing the "name" property of emitted assets in the bundle is deprecated. Use the "names" property instead.', ss, !1, p), c.name;
      },
      names: a,
      needsCodeReference: h,
      get originalFileName() {
        return ft('Accessing the "originalFileName" property of emitted assets in the bundle is deprecated. Use the "originalFileNames" property instead.', ss, !1, p), c.originalFileName;
      },
      originalFileNames: o,
      source: c.source,
      type: "asset"
    };
  }
}
function Eg(i) {
  const e = [], t = [];
  for (const { name: s, originalFileName: n } of i)
    typeof s == "string" && e.push(s), n && t.push(n);
  return t.sort(), e.sort((s, n) => s.length - n.length || (s > n ? 1 : s === n ? 0 : -1)), { names: e, originalFileNames: t };
}
function as(i, e, t, s, n) {
  return Dt[i] < Dt[n] ? Je : (r, a) => {
    a != null && t(V, Qu(s)), r = ct(r), r.code && !r.pluginCode && (r.pluginCode = r.code), r.code = e, r.plugin = s, t(i, r);
  };
}
function bg(i, e, t, s, n, r) {
  const { logLevel: a, onLog: o } = s;
  let l = !0;
  typeof i.cacheKey != "string" && (i.name.startsWith(_a) || i.name.startsWith(Fa) || r.has(i.name) ? l = !1 : r.add(i.name));
  let c;
  if (!e)
    c = lg;
  else if (l) {
    const h = i.cacheKey || i.name;
    c = ag(e[h] || (e[h] = /* @__PURE__ */ Object.create(null)));
  } else
    c = cg(i.name);
  return {
    addWatchFile(h) {
      t.watchFiles[h] = !0;
    },
    cache: c,
    debug: as(qn, "PLUGIN_LOG", o, i.name, a),
    emitFile: n.emitFile.bind(n),
    error(h) {
      return R(Ms(ct(h), i.name));
    },
    fs: s.fs,
    getFileName: n.getFileName,
    getModuleIds: () => t.modulesById.keys(),
    getModuleInfo: t.getModuleInfo,
    getWatchFiles: () => Object.keys(t.watchFiles),
    info: as(Bt, "PLUGIN_LOG", o, i.name, a),
    load(h) {
      return t.moduleLoader.preloadModule(h);
    },
    meta: {
      rollupVersion: Xn,
      watchMode: t.watchMode
    },
    parse: _r,
    resolve(h, p, { attributes: d, custom: m, isEntry: f, skipSelf: g, importerAttributes: y } = Oe) {
      return g ??= !0, t.moduleLoader.resolveId(h, p, m, f, d || Re, y, g ? [{ importer: p, plugin: i, source: h }] : null);
    },
    setAssetSource: n.setAssetSource,
    warn: as(V, "PLUGIN_WARNING", o, i.name, a)
  };
}
function $t(i) {
  return Array.isArray(i) ? i.filter(Boolean) : i ? [i] : [];
}
function Ag(i, e) {
  if (i.startsWith("**") || _t(i))
    return xt(i);
  const t = We(e, i);
  return xt(t);
}
function hl(i) {
  if (i instanceof RegExp)
    return (n) => {
      const r = xt(n), a = i.test(r);
      return i.lastIndex = 0, a;
    };
  const e = process.cwd(), t = Ag(i, e), s = Ic(t, { dot: !0 });
  return (n) => {
    const r = xt(n);
    return s(r);
  };
}
function dl(i) {
  return i instanceof RegExp ? (e) => {
    const t = i.test(e);
    return i.lastIndex = 0, t;
  } : (e) => e.includes(i);
}
function mu(i, e) {
  if (!(!i && !e))
    return (t) => i?.some((s) => s(t)) ? !1 : e?.some((s) => s(t)) ? !0 : !(e && e.length > 0);
}
function gu(i) {
  return typeof i == "string" || i instanceof RegExp ? {
    include: [i]
  } : Array.isArray(i) ? {
    include: i
  } : {
    exclude: i.exclude ? $t(i.exclude) : void 0,
    include: i.include ? $t(i.include) : void 0
  };
}
function yu(i) {
  if (!i)
    return;
  const { exclude: e, include: t } = gu(i), s = e?.map(hl), n = t?.map(hl);
  return mu(s, n);
}
function xg(i) {
  if (!i)
    return;
  const { exclude: e, include: t } = gu(i), s = e?.map(dl), n = t?.map(dl);
  return mu(s, n);
}
function Sg(i) {
  const e = yu(i);
  return e ? (t) => !!e(t) : void 0;
}
function Pg(i, e) {
  if (!i && !e)
    return;
  const t = yu(i), s = xg(e);
  return (n, r) => {
    let a = !0;
    return t && (a &&= t(n)), a ? (s && (a &&= s(r)), a) : !1;
  };
}
const Ig = {
  buildEnd: 1,
  buildStart: 1,
  closeBundle: 1,
  closeWatcher: 1,
  load: 1,
  moduleParsed: 1,
  onLog: 1,
  options: 1,
  resolveDynamicImport: 1,
  resolveId: 1,
  shouldTransformCachedModule: 1,
  transform: 1,
  watchChange: 1
}, Ng = Object.keys(Ig);
class za {
  constructor(e, t, s, n, r) {
    this.graph = e, this.options = t, this.pluginCache = n, this.sortedPlugins = /* @__PURE__ */ new Map(), this.unfulfilledActions = /* @__PURE__ */ new Set(), this.compiledPluginFilters = {
      idOnlyFilter: /* @__PURE__ */ new WeakMap(),
      transformFilter: /* @__PURE__ */ new WeakMap()
    }, this.fileEmitter = new yg(e, t, r && r.fileEmitter), this.emitFile = this.fileEmitter.emitFile.bind(this.fileEmitter), this.getFileName = this.fileEmitter.getFileName.bind(this.fileEmitter), this.finaliseAssets = this.fileEmitter.finaliseAssets.bind(this.fileEmitter), this.setChunkInformation = this.fileEmitter.setChunkInformation.bind(this.fileEmitter), this.setOutputBundle = this.fileEmitter.setOutputBundle.bind(this.fileEmitter), this.plugins = [...r ? r.plugins : [], ...s];
    const a = /* @__PURE__ */ new Set();
    if (this.pluginContexts = new Map(this.plugins.map((o) => [
      o,
      bg(o, n, e, t, this.fileEmitter, a)
    ])), r)
      for (const o of s)
        for (const l of Ng)
          l in o && t.onLog(V, Iu(o.name, l));
  }
  createOutputPluginDriver(e) {
    return new za(this.graph, this.options, e, this.pluginCache, this);
  }
  getUnfulfilledHookActions() {
    return this.unfulfilledActions;
  }
  // chains, first non-null result stops and returns
  hookFirst(e, t, s, n) {
    return this.hookFirstAndGetPlugin(e, t, s, n).then((r) => r && r[0]);
  }
  // chains, first non-null result stops and returns result and last plugin
  async hookFirstAndGetPlugin(e, t, s, n) {
    for (const r of this.getSortedPlugins(e)) {
      if (n?.has(r))
        continue;
      const a = await this.runHook(e, t, r, s);
      if (a != null)
        return [a, r];
    }
    return null;
  }
  // chains synchronously, first non-null result stops and returns
  hookFirstSync(e, t, s) {
    for (const n of this.getSortedPlugins(e)) {
      const r = this.runHookSync(e, t, n, s);
      if (r != null)
        return r;
    }
    return null;
  }
  // parallel, ignores returns
  async hookParallel(e, t, s) {
    const n = [];
    for (const r of this.getSortedPlugins(e))
      r[e].sequential ? (await Promise.all(n), n.length = 0, await this.runHook(e, t, r, s)) : n.push(this.runHook(e, t, r, s));
    await Promise.all(n);
  }
  // chains, reduces returned value, handling the reduced value as the first hook argument
  hookReduceArg0(e, [t, ...s], n, r) {
    let a = Promise.resolve(t);
    for (const o of this.getSortedPlugins(e))
      a = a.then((l) => this.runHook(e, [l, ...s], o, r).then((c) => n.call(this.pluginContexts.get(o), l, c, o)));
    return a;
  }
  // chains synchronously, reduces returned value, handling the reduced value as the first hook argument
  hookReduceArg0Sync(e, [t, ...s], n, r) {
    for (const a of this.getSortedPlugins(e)) {
      const o = [t, ...s], l = this.runHookSync(e, o, a, r);
      t = n.call(this.pluginContexts.get(a), t, l, a);
    }
    return t;
  }
  // chains, reduces returned value to type string, handling the reduced value separately. permits hooks as values.
  async hookReduceValue(e, t, s, n) {
    const r = [], a = [];
    for (const o of this.getSortedPlugins(e, wg))
      o[e].sequential ? (r.push(...await Promise.all(a)), a.length = 0, r.push(await this.runHook(e, s, o))) : a.push(this.runHook(e, s, o));
    return r.push(...await Promise.all(a)), r.reduce(n, await t);
  }
  // chains synchronously, reduces returned value to type T, handling the reduced value separately. permits hooks as values.
  hookReduceValueSync(e, t, s, n, r) {
    let a = t;
    for (const o of this.getSortedPlugins(e)) {
      const l = this.runHookSync(e, s, o, r);
      a = n.call(this.pluginContexts.get(o), a, l, o);
    }
    return a;
  }
  // chains, ignores returns
  hookSeq(e, t, s) {
    let n = Promise.resolve();
    for (const r of this.getSortedPlugins(e))
      n = n.then(() => this.runHook(e, t, r, s));
    return n.then(Cg);
  }
  getSortedPlugins(e, t) {
    return _e(this.sortedPlugins, e, () => Va(e, this.plugins, t));
  }
  // Implementation signature
  runHook(e, t, s, n) {
    const r = s[e], a = typeof r == "object" ? r.handler : r;
    if (typeof r == "object" && "filter" in r && r.filter) {
      if (e === "transform") {
        const c = r.filter, h = t, p = _e(this.compiledPluginFilters.transformFilter, c, () => Pg(c.id, c.code));
        if (p && !p(h[1], h[0]))
          return Promise.resolve();
      } else if (e === "resolveId" || e === "load") {
        const c = r.filter, h = t, p = _e(this.compiledPluginFilters.idOnlyFilter, c, () => Sg(c.id));
        if (p && !p(h[0]))
          return Promise.resolve();
      }
    }
    let o = this.pluginContexts.get(s);
    n && (o = n(o, s));
    let l = null;
    return Promise.resolve().then(() => {
      if (typeof a != "function")
        return a;
      const c = a.apply(o, t);
      return c?.then ? (l = [s.name, e, t], this.unfulfilledActions.add(l), Promise.resolve(c).then((h) => (this.unfulfilledActions.delete(l), h))) : c;
    }).catch((c) => (l !== null && this.unfulfilledActions.delete(l), R(Ms(c, s.name, { hook: e }))));
  }
  /**
   * Run a sync plugin hook and return the result.
   * @param hookName Name of the plugin hook. Must be in `PluginHooks`.
   * @param args Arguments passed to the plugin hook.
   * @param plugin The acutal plugin
   * @param replaceContext When passed, the plugin context can be overridden.
   */
  runHookSync(e, t, s, n) {
    const r = s[e], a = typeof r == "object" ? r.handler : r;
    let o = this.pluginContexts.get(s);
    n && (o = n(o, s));
    try {
      return a.apply(o, t);
    } catch (l) {
      return R(Ms(l, s.name, { hook: e }));
    }
  }
}
function Va(i, e, t = $g) {
  const s = [], n = [], r = [];
  for (const a of e) {
    const o = a[i];
    if (o) {
      if (typeof o == "object") {
        if (t(o.handler, i, a), o.order === "pre") {
          s.push(a);
          continue;
        }
        if (o.order === "post") {
          r.push(a);
          continue;
        }
      } else
        t(o, i, a);
      n.push(a);
    }
  }
  return [...s, ...n, ...r];
}
function $g(i, e, t) {
  typeof i != "function" && R(Yu(e, t.name));
}
function wg(i, e, t) {
  if (typeof i != "string" && typeof i != "function")
    return R(ih(e, t.name));
}
function Cg() {
}
class vg {
  constructor(e) {
    this.maxParallel = e, this.queue = [], this.workerCount = 0;
  }
  run(e) {
    return new Promise((t, s) => {
      this.queue.push({ reject: s, resolve: t, task: e }), this.work();
    });
  }
  async work() {
    if (this.workerCount >= this.maxParallel)
      return;
    this.workerCount++;
    let e;
    for (; e = this.queue.shift(); ) {
      const { reject: t, resolve: s, task: n } = e;
      try {
        const r = await n();
        s(r);
      } catch (r) {
        t(r);
      }
    }
    this.workerCount--;
  }
}
function kg(i) {
  return Array.isArray(i) ? i.map((e) => ({
    fileName: null,
    id: e,
    implicitlyLoadedAfter: [],
    importer: void 0,
    name: null
  })) : Object.entries(i).map(([e, t]) => ({
    fileName: null,
    id: t,
    implicitlyLoadedAfter: [],
    importer: void 0,
    name: e
  }));
}
class Rg {
  constructor(e, t) {
    if (this.options = e, this.astLru = Zm(5), this.cachedModules = /* @__PURE__ */ new Map(), this.deoptimizationTracker = new us(), this.entryModules = [], this.modulesById = /* @__PURE__ */ new Map(), this.needsTreeshakingPass = !1, this.newlyIncludedVariableInits = /* @__PURE__ */ new Set(), this.phase = Tt.LOAD_AND_PARSE, this.scope = new eg(), this.watchFiles = /* @__PURE__ */ Object.create(null), this.watchMode = !1, this.externalModules = [], this.implicitEntryModules = [], this.modules = [], this.getModuleInfo = (s) => {
      const n = this.modulesById.get(s);
      return n ? n.info : null;
    }, e.cache !== !1) {
      if (e.cache?.modules)
        for (const s of e.cache.modules)
          this.cachedModules.set(s.id, s);
      this.pluginCache = e.cache?.plugins || /* @__PURE__ */ Object.create(null);
      for (const s in this.pluginCache) {
        const n = this.pluginCache[s];
        for (const r of Object.values(n))
          r[0]++;
      }
    }
    if (t) {
      this.watchMode = !0;
      const s = (...r) => this.pluginDriver.hookParallel("watchChange", r), n = () => this.pluginDriver.hookParallel("closeWatcher", []);
      t.onCurrentRun("change", s), t.onCurrentRun("close", n);
    }
    this.pluginDriver = new za(this, e, e.plugins, this.pluginCache), this.moduleLoader = new hg(this, this.modulesById, this.options, this.pluginDriver), this.fileOperationQueue = new vg(e.maxParallelFileOps), this.pureFunctions = zd(e);
  }
  async build() {
    Ie("generate module graph", 2), await this.generateModuleGraph(), xe("generate module graph", 2), Ie("sort and bind modules", 2), this.phase = Tt.ANALYSE, this.sortAndBindModules(), xe("sort and bind modules", 2), Ie("mark included statements", 2), this.includeStatements(), xe("mark included statements", 2), this.phase = Tt.GENERATE;
  }
  getCache() {
    for (const e in this.pluginCache) {
      const t = this.pluginCache[e];
      let s = !0;
      for (const [n, r] of Object.entries(t))
        r[0] >= this.options.experimentalCacheExpiry ? delete t[n] : s = !1;
      s && delete this.pluginCache[e];
    }
    return {
      modules: this.modules.map((e) => e.toJSON()),
      plugins: this.pluginCache
    };
  }
  async generateModuleGraph() {
    if ({ entryModules: this.entryModules, implicitEntryModules: this.implicitEntryModules } = await this.moduleLoader.addEntryModules(kg(this.options.input), !0), this.entryModules.length === 0)
      throw new Error("You must supply options.input to rollup");
    for (const e of this.modulesById.values())
      e.cacheInfoGetters(), e instanceof Ae ? this.modules.push(e) : this.externalModules.push(e);
  }
  includeStatements() {
    const e = [...this.entryModules, ...this.implicitEntryModules];
    for (const t of e)
      Qr(t);
    if (this.options.treeshake) {
      let t = 1;
      this.newlyIncludedVariableInits.clear();
      do {
        Ie(`treeshaking pass ${t}`, 3), this.needsTreeshakingPass = !1;
        for (const s of this.modules)
          if (s.isExecuted) {
            s.hasTreeShakingPassStarted = !0, s.info.moduleSideEffects === "no-treeshake" ? s.includeAllInBundle() : s.include();
            for (const n of this.newlyIncludedVariableInits)
              this.newlyIncludedVariableInits.delete(n), n.include(it(), !1);
          }
        if (t === 1)
          for (const s of e)
            s.preserveSignature !== !1 && (s.includeAllExports(), this.needsTreeshakingPass = !0);
        xe(`treeshaking pass ${t++}`, 3);
      } while (this.needsTreeshakingPass);
    } else
      for (const t of this.modules)
        t.includeAllInBundle();
    for (const t of this.externalModules)
      t.warnUnusedImports();
    for (const t of this.implicitEntryModules)
      for (const s of t.implicitlyLoadedAfter)
        s.info.isEntry || s.isIncluded() || R(Su(s));
  }
  sortAndBindModules() {
    const { orderedModules: e, cyclePaths: t } = Lm(this.entryModules);
    for (const s of t)
      this.options.onLog(V, Pu(s));
    this.modules = e;
    for (const s of this.modules)
      s.bindReferences();
    this.warnForMissingExports();
  }
  warnForMissingExports() {
    for (const e of this.modules)
      for (const t of e.importDescriptions.values())
        if (t.name !== "*") {
          const [s, n] = t.module.getVariableForExportName(t.name, { importChain: [e.id] });
          s || e.log(V, Rn(t.name, e.id, t.module.id, !!n?.missingButExportExists), t.start);
        }
  }
}
function Dg([i, e, t]) {
  const s = `(${i}) ${e}`, n = JSON.stringify;
  switch (e) {
    case "resolveId":
      return `${s} ${n(t[0])} ${n(t[1])}`;
    case "load":
      return `${s} ${n(t[0])}`;
    case "transform":
      return `${s} ${n(t[1])}`;
    case "shouldTransformCachedModule":
      return `${s} ${n(t[0].id)}`;
    case "moduleParsed":
      return `${s} ${n(t[0].id)}`;
  }
  return s;
}
let Rs = null;
const En = /* @__PURE__ */ new Map();
async function Eu(i, e) {
  const t = new Promise((s, n) => {
    En.set(i, n), Rs || (Rs = () => {
      for (const [r, a] of En) {
        const o = r.getUnfulfilledHookActions();
        a(new Error(`Unexpected early exit. This happens when Promises returned by plugins cannot resolve. Unfinished hook action(s) on exit:
` + [...o].map(Dg).join(`
`)));
      }
    }, ls.once("beforeExit", Rs));
  });
  try {
    return await Promise.race([e(), t]);
  } finally {
    En.delete(i), En.size === 0 && (ls.off("beforeExit", Rs), Rs = null);
  }
}
async function Og() {
}
function Ua(i, e, t, s) {
  i = Va("onLog", i);
  const n = Dt[s], r = (a, o, l = Sl) => {
    if (bh(o), !(Dt[a] < n)) {
      for (const h of i) {
        if (l.has(h))
          continue;
        const { onLog: p } = h, d = (f) => Dt[f] < n ? Je : (g) => r(f, ct(g), new Set(l).add(h));
        if (("handler" in p ? p.handler : p).call({
          debug: d(qn),
          error: (f) => R(ct(f)),
          info: d(Bt),
          meta: { rollupVersion: Xn, watchMode: t },
          warn: d(V)
        }, a, o) === !1)
          return;
      }
      e(a, o);
    }
  };
  return r;
}
const Lg = /* @__PURE__ */ fd({
  __proto__: null
}, [pd]);
async function Mg(i, e) {
  const t = /* @__PURE__ */ new Set(), s = i.context ?? "undefined", n = await Ps(i.plugins), r = i.logLevel || Bt, a = Ua(n, Ta(i, r), e, r), o = i.strictDeprecations || !1, l = zg(i), c = {
    cache: Tg(i),
    context: s,
    experimentalCacheExpiry: i.experimentalCacheExpiry ?? 10,
    experimentalLogSideEffects: i.experimentalLogSideEffects || !1,
    external: Bg(i.external),
    fs: i.fs ?? Lg,
    input: _g(i),
    jsx: Fg(i),
    logLevel: r,
    makeAbsoluteExternalsRelative: i.makeAbsoluteExternalsRelative ?? "ifRelativeSource",
    maxParallelFileOps: l,
    moduleContext: Vg(i, s),
    onLog: a,
    perf: i.perf || !1,
    plugins: n,
    preserveEntrySignatures: i.preserveEntrySignatures ?? "exports-only",
    preserveSymlinks: i.preserveSymlinks || !1,
    shimMissingExports: i.shimMissingExports || !1,
    strictDeprecations: o,
    treeshake: Ug(i)
  };
  return ln(i, [...Object.keys(c), "onwarn", "watch"], "input options", a, /^(output)$/), { options: c, unsetOptions: t };
}
const Tg = (i) => i.cache === !0 ? void 0 : i.cache?.cache || i.cache, Bg = (i) => {
  if (i === !0)
    return () => !0;
  if (typeof i == "function")
    return (e, ...t) => e[0] !== "\0" && i(e, ...t) || !1;
  if (i) {
    const e = /* @__PURE__ */ new Set(), t = [];
    for (const s of $t(i))
      s instanceof RegExp ? t.push(s) : e.add(s);
    return (s, ...n) => e.has(s) || t.some((r) => r.test(s));
  }
  return () => !1;
}, _g = (i) => {
  const e = i.input;
  return e == null ? [] : typeof e == "string" ? [e] : e;
}, Fg = (i) => {
  const e = i.jsx;
  if (!e)
    return !1;
  const t = Ba(e, du, "jsx", Sn, "false, "), { factory: s, importSource: n, mode: r } = t;
  switch (r) {
    case "automatic":
      return {
        factory: s || "React.createElement",
        importSource: n || "react",
        jsxImportSource: t.jsxImportSource || "react/jsx-runtime",
        mode: "automatic"
      };
    case "preserve":
      return n && !(s || t.fragment) && R(be("jsx", Sn, "when preserving JSX and specifying an importSource, you also need to specify a factory or fragment")), {
        factory: s || null,
        fragment: t.fragment || null,
        importSource: n || null,
        mode: "preserve"
      };
    // case 'classic':
    default:
      return r && r !== "classic" && R(be("jsx.mode", Sn, 'mode must be "automatic", "classic" or "preserve"', r)), {
        factory: s || "React.createElement",
        fragment: t.fragment || "React.Fragment",
        importSource: n || null,
        mode: "classic"
      };
  }
}, zg = (i) => {
  const e = i.maxParallelFileOps;
  return typeof e == "number" ? e <= 0 ? 1 / 0 : e : 1e3;
}, Vg = (i, e) => {
  const t = i.moduleContext;
  if (typeof t == "function")
    return (s) => t(s) ?? e;
  if (t) {
    const s = /* @__PURE__ */ Object.create(null);
    for (const [n, r] of Object.entries(t))
      s[We(n)] = r;
    return (n) => s[n] ?? e;
  }
  return () => e;
}, Ug = (i) => {
  if (i.treeshake === !1)
    return !1;
  const t = Ba(i.treeshake, hu, "treeshake", Cl, "false, true, ");
  return {
    annotations: t.annotations !== !1,
    correctVarValueBeforeDeclaration: t.correctVarValueBeforeDeclaration === !0,
    manualPureFunctions: t.manualPureFunctions ?? De,
    moduleSideEffects: jg(t.moduleSideEffects),
    propertyReadSideEffects: t.propertyReadSideEffects === "always" ? "always" : t.propertyReadSideEffects !== !1,
    tryCatchDeoptimization: t.tryCatchDeoptimization !== !1,
    unknownGlobalSideEffects: t.unknownGlobalSideEffects !== !1
  };
}, jg = (i) => {
  if (typeof i == "boolean")
    return () => i;
  if (i === "no-external")
    return (e, t) => !t;
  if (typeof i == "function")
    return (e, t) => e[0] === "\0" ? !0 : i(e, t) !== !1;
  if (Array.isArray(i)) {
    const e = new Set(i);
    return (t) => e.has(t);
  }
  return i && R(be("treeshake.moduleSideEffects", Ah, 'please use one of false, "no-external", a function or an array')), () => !0;
}, Hg = /[\u0000-\u001F"#$%&*+,:;<=>?[\]^`{|}\u007F]/g, Gg = /^[a-z]:/i;
function Wg(i) {
  const e = Gg.exec(i), t = e ? e[0] : "";
  return t + i.slice(t.length).replace(Hg, "_");
}
async function Kg(i, e, t) {
  const s = new Set(t), n = i.compact || !1, r = Xg(i), a = Jg(i, e), o = Yg(i, a, e), l = qg(i, o, e), c = iy(i), h = ny(i, e), p = {
    amd: Zg(i),
    assetFileNames: i.assetFileNames ?? "assets/[name]-[hash][extname]",
    banner: bn(i, "banner"),
    chunkFileNames: i.chunkFileNames ?? "[name]-[hash].js",
    compact: n,
    dir: ey(i, l),
    dynamicImportInCjs: i.dynamicImportInCjs ?? !0,
    entryFileNames: ty(i, s),
    esModule: i.esModule ?? "if-default-prop",
    experimentalMinChunkSize: i.experimentalMinChunkSize ?? 1,
    exports: sy(i, s),
    extend: i.extend || !1,
    externalImportAssertions: h,
    externalImportAttributes: h,
    externalLiveBindings: i.externalLiveBindings ?? !0,
    file: l,
    footer: bn(i, "footer"),
    format: r,
    freeze: i.freeze ?? !0,
    generatedCode: c,
    globals: i.globals || {},
    hashCharacters: i.hashCharacters ?? "base64",
    hoistTransitiveImports: i.hoistTransitiveImports ?? !0,
    importAttributesKey: i.importAttributesKey ?? "assert",
    indent: ry(i, n),
    inlineDynamicImports: a,
    interop: ay(i),
    intro: bn(i, "intro"),
    manualChunks: oy(i, a, o),
    minifyInternalExports: ly(i, r, n),
    name: i.name,
    noConflict: i.noConflict || !1,
    onlyExplicitManualChunks: i.onlyExplicitManualChunks || !1,
    outro: bn(i, "outro"),
    paths: i.paths || {},
    plugins: await Ps(i.plugins),
    preserveModules: o,
    preserveModulesRoot: Qg(i),
    reexportProtoFromExternal: i.reexportProtoFromExternal ?? !0,
    sanitizeFileName: typeof i.sanitizeFileName == "function" ? i.sanitizeFileName : i.sanitizeFileName === !1 ? (d) => d : Wg,
    sourcemap: i.sourcemap || !1,
    sourcemapBaseUrl: uy(i),
    sourcemapDebugIds: i.sourcemapDebugIds || !1,
    sourcemapExcludeSources: i.sourcemapExcludeSources || !1,
    sourcemapFile: i.sourcemapFile,
    sourcemapFileNames: cy(i, s),
    sourcemapIgnoreList: typeof i.sourcemapIgnoreList == "function" ? i.sourcemapIgnoreList : i.sourcemapIgnoreList === !1 ? () => !1 : (d) => d.includes("node_modules"),
    sourcemapPathTransform: i.sourcemapPathTransform,
    strict: i.strict ?? !0,
    systemNullSetters: i.systemNullSetters ?? !0,
    validate: i.validate || !1,
    virtualDirname: i.virtualDirname || "_virtual"
  };
  return ln(i, Object.keys(p), "output options", e.onLog), { options: p, unsetOptions: s };
}
const qg = (i, e, t) => {
  const { file: s } = i;
  if (typeof s == "string") {
    if (e)
      return R(be("output.file", Ln, 'you must set "output.dir" instead of "output.file" when using the "output.preserveModules" option'));
    if (!Array.isArray(t.input))
      return R(be("output.file", Ln, 'you must set "output.dir" instead of "output.file" when providing named inputs'));
  }
  return s;
}, Xg = (i) => {
  const e = i.format;
  switch (e) {
    case void 0:
    case "es":
    case "esm":
    case "module":
      return "es";
    case "cjs":
    case "commonjs":
      return "cjs";
    case "system":
    case "systemjs":
      return "system";
    case "amd":
    case "iife":
    case "umd":
      return e;
    default:
      return R(be("output.format", Rl, 'Valid values are "amd", "cjs", "system", "es", "iife" or "umd"', e));
  }
}, Jg = (i, e) => {
  const t = i.inlineDynamicImports || !1, { input: s } = e;
  return t && (Array.isArray(s) ? s : Object.keys(s)).length > 1 ? R(be("output.inlineDynamicImports", Ol, 'multiple inputs are not supported when "output.inlineDynamicImports" is true')) : t;
}, Yg = (i, e, t) => {
  const s = i.preserveModules || !1;
  if (s) {
    if (e)
      return R(be("output.inlineDynamicImports", Ol, 'this option is not supported for "output.preserveModules"'));
    if (t.preserveEntrySignatures === !1)
      return R(be("preserveEntrySignatures", td, 'setting this option to false is not supported for "output.preserveModules"'));
  }
  return s;
}, Qg = (i) => {
  const { preserveModulesRoot: e } = i;
  if (e != null)
    return We(e);
}, Zg = (i) => {
  const e = {
    autoId: !1,
    basePath: "",
    define: "define",
    forceJsExtensionForImports: !1,
    ...i.amd
  };
  return (e.autoId || e.basePath) && e.id ? R(be("output.amd.id", Dl, 'this option cannot be used together with "output.amd.autoId"/"output.amd.basePath"')) : e.basePath && !e.autoId ? R(be("output.amd.basePath", od, 'this option only works with "output.amd.autoId"')) : e.autoId ? {
    autoId: !0,
    basePath: e.basePath,
    define: e.define,
    forceJsExtensionForImports: e.forceJsExtensionForImports
  } : {
    autoId: !1,
    define: e.define,
    forceJsExtensionForImports: e.forceJsExtensionForImports,
    id: e.id
  };
}, bn = (i, e) => {
  const t = i[e];
  return typeof t == "function" ? t : () => t || "";
}, ey = (i, e) => {
  const { dir: t } = i;
  return typeof t == "string" && typeof e == "string" ? R(be("output.dir", Ln, 'you must set either "output.file" for a single-file build or "output.dir" when generating multiple chunks')) : t;
}, ty = (i, e) => {
  const t = i.entryFileNames;
  return t == null && e.add("entryFileNames"), t ?? "[name].js";
};
function sy(i, e) {
  const t = i.exports;
  if (t == null)
    e.add("exports");
  else if (!["default", "named", "none", "auto"].includes(t))
    return R(ad(t));
  return t || "auto";
}
const ny = (i, e) => (i.externalImportAssertions != null && ft('The "output.externalImportAssertions" option is deprecated. Use the "output.externalImportAttributes" option instead.', sd, !0, e), i.externalImportAttributes ?? i.externalImportAssertions ?? !0), iy = (i) => {
  const e = Ba(i.generatedCode, pu, "output.generatedCode", Ll, "");
  return {
    arrowFunctions: e.arrowFunctions === !0,
    constBindings: e.constBindings === !0,
    objectShorthand: e.objectShorthand === !0,
    reservedNamesAsProps: e.reservedNamesAsProps !== !1,
    symbols: e.symbols === !0
  };
}, ry = (i, e) => {
  if (e)
    return "";
  const t = i.indent;
  return t === !1 ? "" : t ?? !0;
}, pl = /* @__PURE__ */ new Set([
  "compat",
  "auto",
  "esModule",
  "default",
  "defaultOnly"
]), ay = (i) => {
  const e = i.interop;
  if (typeof e == "function") {
    const t = /* @__PURE__ */ Object.create(null);
    let s = null;
    return (n) => n === null ? s || dr(s = e(n)) : n in t ? t[n] : dr(t[n] = e(n));
  }
  return e === void 0 ? () => "default" : () => dr(e);
}, dr = (i) => pl.has(i) ? i : R(be("output.interop", cd, `use one of ${Array.from(pl, (e) => JSON.stringify(e)).join(", ")}`, i)), oy = (i, e, t) => {
  const s = i.manualChunks;
  if (s) {
    if (e)
      return R(be("output.manualChunks", qa, 'this option is not supported for "output.inlineDynamicImports"'));
    if (t)
      return R(be("output.manualChunks", qa, 'this option is not supported for "output.preserveModules"'));
  }
  return s || {};
}, ly = (i, e, t) => i.minifyInternalExports ?? (t || e === "es" || e === "system"), cy = (i, e) => {
  const t = i.sourcemapFileNames;
  return t == null && e.add("sourcemapFileNames"), t;
}, uy = (i) => {
  const { sourcemapBaseUrl: e } = i;
  if (e)
    return nd(e) ? id(e) : R(be("output.sourcemapBaseUrl", rd, `must be a valid URL, received ${JSON.stringify(e)}`));
};
Symbol.asyncDispose ??= /* @__PURE__ */ Symbol("Symbol.asyncDispose");
function hy(i) {
  return dy(i, null);
}
async function dy(i, e) {
  const { options: t, unsetOptions: s } = await py(i, e !== null);
  Gf(t), await Og();
  const n = new Rg(t, e), r = i.cache !== !1;
  i.cache && (t.cache = void 0, i.cache = void 0), Ie("BUILD", 1), await Eu(n.pluginDriver, async () => {
    try {
      Ie("initialize", 2), await n.pluginDriver.hookParallel("buildStart", [t]), xe("initialize", 2), await n.build();
    } catch (o) {
      const l = Object.keys(n.watchFiles);
      l.length > 0 && (o.watchFiles = l);
      try {
        await n.pluginDriver.hookParallel("buildEnd", [o]);
      } catch (c) {
        const h = Vr({
          ...o,
          message: `There was an error during the build:
  ${o.message}
Additionally, handling the error in the 'buildEnd' hook caused the following error:
  ${c.message}`
        });
        throw await n.pluginDriver.hookParallel("closeBundle", [h]), h;
      }
      throw await n.pluginDriver.hookParallel("closeBundle", [o]), o;
    }
    try {
      await n.pluginDriver.hookParallel("buildEnd", []);
    } catch (o) {
      throw await n.pluginDriver.hookParallel("closeBundle", [o]), o;
    }
  }), xe("BUILD", 1);
  const a = {
    get cache() {
      return r ? n.getCache() : void 0;
    },
    async close() {
      a.closed || (a.closed = !0, await n.pluginDriver.hookParallel("closeBundle", []));
    },
    closed: !1,
    async [Symbol.asyncDispose]() {
      await this.close();
    },
    async generate(o) {
      return a.closed ? R(Xa()) : fl(!1, t, s, o, n);
    },
    get watchFiles() {
      return Object.keys(n.watchFiles);
    },
    async write(o) {
      return a.closed ? R(Xa()) : fl(!0, t, s, o, n);
    }
  };
  return t.perf && (a.getTimings = Uf), a;
}
async function py(i, e) {
  if (!i)
    throw new Error("You must supply an options object to rollup");
  const t = await fy(i, e), { options: s, unsetOptions: n } = await Mg(t, e);
  return bu(s.plugins, _a), { options: s, unsetOptions: n };
}
async function fy(i, e) {
  const t = Va("options", await Ps(i.plugins)), s = i.logLevel || Bt, n = Ua(t, Ta(i, s), e, s);
  for (const r of t) {
    const { name: a, options: o } = r, c = await ("handler" in o ? o.handler : o).call({
      debug: as(qn, "PLUGIN_LOG", n, a, s),
      error: (h) => R(Ms(ct(h), a, { hook: "onLog" })),
      info: as(Bt, "PLUGIN_LOG", n, a, s),
      meta: { rollupVersion: Xn, watchMode: e },
      warn: as(V, "PLUGIN_WARNING", n, a, s)
    }, i);
    c && (i = c);
  }
  return i;
}
function bu(i, e) {
  for (const [t, s] of i.entries())
    s.name || (s.name = `${e}${t + 1}`);
}
async function fl(i, e, t, s, n) {
  const { options: r, outputPluginDriver: a, unsetOptions: o } = await my(s, n.pluginDriver, e, t);
  return Eu(a, async () => {
    const c = await new qm(r, o, e, a, n).generate(i);
    if (i) {
      if (Ie("WRITE", 1), !r.dir && !r.file)
        return R(qu());
      await Promise.all(Object.values(c).map((h) => n.fileOperationQueue.run(() => Ey(h, r, e)))), await a.hookParallel("writeBundle", [r, c]), xe("WRITE", 1);
    }
    return yy(c);
  });
}
async function my(i, e, t, s) {
  if (!i)
    throw new Error("You must supply an options object");
  const n = await Ps(i.plugins);
  bu(n, Fa);
  const r = e.createOutputPluginDriver(n);
  return {
    ...await gy(t, s, i, r),
    outputPluginDriver: r
  };
}
function gy(i, e, t, s) {
  return Kg(s.hookReduceArg0Sync("outputOptions", [t], (n, r) => r || n, (n) => {
    const r = () => n.error(Hh());
    return {
      ...n,
      emitFile: r,
      setAssetSource: r
    };
  }), i, e);
}
function yy(i) {
  return {
    output: Object.values(i).filter((e) => Object.keys(e).length > 0).sort((e, t) => ml(e) - ml(t))
  };
}
var Ls;
(function(i) {
  i[i.ENTRY_CHUNK = 0] = "ENTRY_CHUNK", i[i.SECONDARY_CHUNK = 1] = "SECONDARY_CHUNK", i[i.ASSET = 2] = "ASSET";
})(Ls || (Ls = {}));
function ml(i) {
  return i.type === "asset" ? Ls.ASSET : i.isEntry ? Ls.ENTRY_CHUNK : Ls.SECONDARY_CHUNK;
}
async function Ey(i, e, { fs: { mkdir: t, writeFile: s } }) {
  const n = We(e.dir || St(e.file), i.fileName);
  return await t(St(n), { recursive: !0 }), s(n, i.type === "asset" ? i.source : i.code);
}
function by(i) {
  return i;
}
var An = { exports: {} }, gl;
function Ay() {
  if (gl) return An.exports;
  gl = 1;
  let i = process || {}, e = i.argv || [], t = i.env || {}, s = !(t.NO_COLOR || e.includes("--no-color")) && (!!t.FORCE_COLOR || e.includes("--color") || i.platform === "win32" || (i.stdout || {}).isTTY && t.TERM !== "dumb" || !!t.CI), n = (o, l, c = o) => (h) => {
    let p = "" + h, d = p.indexOf(l, o.length);
    return ~d ? o + r(p, l, c, d) + l : o + p + l;
  }, r = (o, l, c, h) => {
    let p = "", d = 0;
    do
      p += o.substring(d, h) + c, d = h + l.length, h = o.indexOf(l, d);
    while (~h);
    return p + o.substring(d);
  }, a = (o = s) => {
    let l = o ? n : () => String;
    return {
      isColorSupported: o,
      reset: l("\x1B[0m", "\x1B[0m"),
      bold: l("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: l("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: l("\x1B[3m", "\x1B[23m"),
      underline: l("\x1B[4m", "\x1B[24m"),
      inverse: l("\x1B[7m", "\x1B[27m"),
      hidden: l("\x1B[8m", "\x1B[28m"),
      strikethrough: l("\x1B[9m", "\x1B[29m"),
      black: l("\x1B[30m", "\x1B[39m"),
      red: l("\x1B[31m", "\x1B[39m"),
      green: l("\x1B[32m", "\x1B[39m"),
      yellow: l("\x1B[33m", "\x1B[39m"),
      blue: l("\x1B[34m", "\x1B[39m"),
      magenta: l("\x1B[35m", "\x1B[39m"),
      cyan: l("\x1B[36m", "\x1B[39m"),
      white: l("\x1B[37m", "\x1B[39m"),
      gray: l("\x1B[90m", "\x1B[39m"),
      bgBlack: l("\x1B[40m", "\x1B[49m"),
      bgRed: l("\x1B[41m", "\x1B[49m"),
      bgGreen: l("\x1B[42m", "\x1B[49m"),
      bgYellow: l("\x1B[43m", "\x1B[49m"),
      bgBlue: l("\x1B[44m", "\x1B[49m"),
      bgMagenta: l("\x1B[45m", "\x1B[49m"),
      bgCyan: l("\x1B[46m", "\x1B[49m"),
      bgWhite: l("\x1B[47m", "\x1B[49m"),
      blackBright: l("\x1B[90m", "\x1B[39m"),
      redBright: l("\x1B[91m", "\x1B[39m"),
      greenBright: l("\x1B[92m", "\x1B[39m"),
      yellowBright: l("\x1B[93m", "\x1B[39m"),
      blueBright: l("\x1B[94m", "\x1B[39m"),
      magentaBright: l("\x1B[95m", "\x1B[39m"),
      cyanBright: l("\x1B[96m", "\x1B[39m"),
      whiteBright: l("\x1B[97m", "\x1B[39m"),
      bgBlackBright: l("\x1B[100m", "\x1B[49m"),
      bgRedBright: l("\x1B[101m", "\x1B[49m"),
      bgGreenBright: l("\x1B[102m", "\x1B[49m"),
      bgYellowBright: l("\x1B[103m", "\x1B[49m"),
      bgBlueBright: l("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: l("\x1B[105m", "\x1B[49m"),
      bgCyanBright: l("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: l("\x1B[107m", "\x1B[49m")
    };
  };
  return An.exports = a(), An.exports.createColors = a, An.exports;
}
var xy = /* @__PURE__ */ Ay();
const Sy = /* @__PURE__ */ Pc(xy), { bold: yl, cyan: Py, dim: pr, red: Iy } = Sy.createColors(Ja.FORCE_COLOR !== "0" && !Ja.NO_COLOR), Ny = (...i) => ls.stderr.write(`${i.join("")}
`);
function $y(i, e = !1) {
  const t = i.name || i.cause?.name, s = t ? `${t}: ` : "", r = `${i.plugin ? `(plugin ${i.plugin}) ` : ""}${s}${i.message}`, a = [yl(Iy(`[!] ${yl(r.toString())}`))];
  if (i.url && a.push(Py(i.url)), i.loc ? a.push(`${kn(i.loc.file || i.id)} (${i.loc.line}:${i.loc.column})`) : i.id && a.push(kn(i.id)), i.frame && a.push(pr(i.frame)), i.stack && a.push(pr(i.stack?.replace(`${s}${i.message}
`, ""))), i.cause) {
    let o = i.cause;
    const l = [];
    let c = "";
    for (; o; ) {
      c += "  ";
      const h = o.stack || o;
      l.push(...`[cause] ${h}`.split(`
`).map((p) => c + p)), o = o.cause;
    }
    a.push(pr(l.join(`
`)));
  }
  a.push("", ""), Ny(a.join(`
`)), e || ls.exit(1);
}
const wy = {
  c: "config",
  d: "dir",
  e: "external",
  f: "format",
  g: "globals",
  h: "help",
  i: "input",
  m: "sourcemap",
  n: "name",
  o: "file",
  p: "plugin",
  v: "version",
  w: "watch"
}, Cy = { external: [], globals: void 0 };
async function vy(i, e, t = Cy, s) {
  const n = ky(t), r = await Ps(i.plugins), a = i.logLevel || Bt, o = Ta(i, a, s), l = Ua(r, o, e, a), c = Ry(i, n, r, l, o);
  n.output && Object.assign(n, n.output);
  const h = $t(i.output);
  h.length === 0 && h.push({});
  const p = await Promise.all(h.map((d) => Ly(d, n, l)));
  return ln(n, [
    ...Object.keys(c).filter((d) => d !== "fs"),
    ...Object.keys(p[0]).filter((d) => d !== "sourcemapIgnoreList" && d !== "sourcemapPathTransform"),
    ...Object.keys(wy),
    "bundleConfigAsCjs",
    "config",
    "configImportAttributesKey",
    "configPlugin",
    "environment",
    "failAfterWarnings",
    "filterLogs",
    "forceExit",
    "plugin",
    "silent",
    "stdin",
    "waitForBundleInput"
  ], "CLI flags", l, /^_$|output$|config/), c.output = p, c;
}
function ky(i) {
  const e = i.external && typeof i.external == "string" ? i.external.split(",") : [];
  return {
    ...i,
    external: e,
    globals: typeof i.globals == "string" ? i.globals.split(",").reduce((t, s) => {
      const [n, r] = s.split(":");
      return t[n] = r, e.includes(n) || e.push(n), t;
    }, /* @__PURE__ */ Object.create(null)) : void 0
  };
}
function Ry(i, e, t, s, n) {
  const r = (o) => e[o] ?? i[o], a = {
    cache: i.cache,
    context: r("context"),
    experimentalCacheExpiry: r("experimentalCacheExpiry"),
    experimentalLogSideEffects: r("experimentalLogSideEffects"),
    external: Dy(i, e),
    fs: r("fs"),
    input: r("input") || [],
    jsx: Us(i, e, "jsx", Wn(du, "jsx", Sn, "false, ")),
    logLevel: r("logLevel"),
    makeAbsoluteExternalsRelative: r("makeAbsoluteExternalsRelative"),
    maxParallelFileOps: r("maxParallelFileOps"),
    moduleContext: r("moduleContext"),
    onLog: n,
    onwarn: void 0,
    perf: r("perf"),
    plugins: t,
    preserveEntrySignatures: r("preserveEntrySignatures"),
    preserveSymlinks: r("preserveSymlinks"),
    shimMissingExports: r("shimMissingExports"),
    strictDeprecations: r("strictDeprecations"),
    treeshake: Us(i, e, "treeshake", Wn(hu, "treeshake", Cl, "false, true, ")),
    watch: Oy(i, e)
  };
  return ln(i, Object.keys(a), "input options", s, /^output$/), a;
}
const Dy = (i, e) => {
  const t = i.external;
  return typeof t == "function" ? (s, n, r) => t(s, n, r) || e.external.includes(s) : [...$t(t), ...e.external];
}, Us = (i, e, t, s = fu) => {
  const n = El(e[t], s), r = El(i[t], s);
  return n !== void 0 ? n && { ...r, ...n } : r;
}, Oy = (i, e) => i.watch !== !1 && Us(i, e, "watch"), El = (i, e) => i && (Array.isArray(i) ? i.reduce((t, s) => s && t && { ...t, ...e(s) }, {}) : e(i));
async function Ly(i, e, t) {
  const s = (r) => e[r] ?? i[r], n = {
    amd: Us(i, e, "amd"),
    assetFileNames: s("assetFileNames"),
    banner: s("banner"),
    chunkFileNames: s("chunkFileNames"),
    compact: s("compact"),
    dir: s("dir"),
    dynamicImportInCjs: s("dynamicImportInCjs"),
    entryFileNames: s("entryFileNames"),
    esModule: s("esModule"),
    experimentalMinChunkSize: s("experimentalMinChunkSize"),
    exports: s("exports"),
    extend: s("extend"),
    externalImportAssertions: s("externalImportAssertions"),
    externalImportAttributes: s("externalImportAttributes"),
    externalLiveBindings: s("externalLiveBindings"),
    file: s("file"),
    footer: s("footer"),
    format: s("format"),
    freeze: s("freeze"),
    generatedCode: Us(i, e, "generatedCode", Wn(pu, "output.generatedCode", Ll, "")),
    globals: s("globals"),
    hashCharacters: s("hashCharacters"),
    hoistTransitiveImports: s("hoistTransitiveImports"),
    importAttributesKey: s("importAttributesKey"),
    indent: s("indent"),
    inlineDynamicImports: s("inlineDynamicImports"),
    interop: s("interop"),
    intro: s("intro"),
    manualChunks: s("manualChunks"),
    minifyInternalExports: s("minifyInternalExports"),
    name: s("name"),
    noConflict: s("noConflict"),
    onlyExplicitManualChunks: s("onlyExplicitManualChunks"),
    outro: s("outro"),
    paths: s("paths"),
    plugins: await Ps(i.plugins),
    preserveModules: s("preserveModules"),
    preserveModulesRoot: s("preserveModulesRoot"),
    reexportProtoFromExternal: s("reexportProtoFromExternal"),
    sanitizeFileName: s("sanitizeFileName"),
    sourcemap: s("sourcemap"),
    sourcemapBaseUrl: s("sourcemapBaseUrl"),
    sourcemapDebugIds: s("sourcemapDebugIds"),
    sourcemapExcludeSources: s("sourcemapExcludeSources"),
    sourcemapFile: s("sourcemapFile"),
    sourcemapFileNames: s("sourcemapFileNames"),
    sourcemapIgnoreList: s("sourcemapIgnoreList"),
    sourcemapPathTransform: s("sourcemapPathTransform"),
    strict: s("strict"),
    systemNullSetters: s("systemNullSetters"),
    validate: s("validate"),
    virtualDirname: s("virtualDirname")
  };
  return ln(i, Object.keys(n), "output options", t), n;
}
let Au, Tr;
async function xu() {
  try {
    ({ default: Au } = await import("fsevents"));
  } catch (i) {
    Tr = i;
  }
}
function My() {
  if (Tr)
    throw Tr;
  return Au;
}
const Zy = /* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getFsEvents: My,
  loadFsEvents: xu
}, Symbol.toStringTag, { value: "Module" });
class Ty {
  constructor() {
    this.currentHandlers = /* @__PURE__ */ Object.create(null), this.persistentHandlers = /* @__PURE__ */ Object.create(null);
  }
  // Will be overwritten by Rollup
  async close() {
  }
  emit(e, ...t) {
    return Promise.all([...this.getCurrentHandlers(e), ...this.getPersistentHandlers(e)].map((s) => s(...t)));
  }
  off(e, t) {
    const s = this.persistentHandlers[e];
    return s && s.splice(s.indexOf(t) >>> 0, 1), this;
  }
  on(e, t) {
    return this.getPersistentHandlers(e).push(t), this;
  }
  onCurrentRun(e, t) {
    return this.getCurrentHandlers(e).push(t), this;
  }
  once(e, t) {
    const s = (...n) => (this.off(e, s), t(...n));
    return this.on(e, s), this;
  }
  removeAllListeners() {
    return this.removeListenersForCurrentRun(), this.persistentHandlers = /* @__PURE__ */ Object.create(null), this;
  }
  removeListenersForCurrentRun() {
    return this.currentHandlers = /* @__PURE__ */ Object.create(null), this;
  }
  getCurrentHandlers(e) {
    return this.currentHandlers[e] || (this.currentHandlers[e] = []);
  }
  getPersistentHandlers(e) {
    return this.persistentHandlers[e] || (this.persistentHandlers[e] = []);
  }
}
function By(i) {
  const e = new Ty();
  return Fy(i, e).catch((t) => {
    $y(t);
  }), e;
}
function bl(i) {
  return i[i.length - 1] !== "/" ? `${i}/` : i;
}
function _y(i) {
  for (const e of i) {
    if (typeof e.watch != "boolean" && e.watch?.allowInputInsideOutputPath)
      break;
    if (e.input && e.output) {
      const t = typeof e.input == "string" ? $t(e.input) : e.input, s = $t(e.output);
      for (const n in t) {
        const r = t[n];
        if (typeof r != "string")
          continue;
        const a = s.find(({ dir: o }) => o && bl(r).startsWith(bl(o)));
        a && R(be("watch", Al, `the input "${r}" is a subpath of the output "${a.dir}"`));
      }
    }
  }
}
async function Fy(i, e) {
  const s = (await Promise.all($t(i).map((r) => vy(r, !0)))).filter((r) => r.watch !== !1);
  if (s.length === 0)
    return R(be("watch", Al, 'there must be at least one config where "watch" is not set to "false"'));
  _y(s), await xu();
  const { Watcher: n } = await import("./watch-BfeKedJ8.js");
  new n(s, e);
}
const eE = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  VERSION: Xn,
  defineConfig: by,
  rollup: hy,
  watch: By
}, Symbol.toStringTag, { value: "Module" }));
export {
  Yy as a,
  eE as b,
  Qy as c,
  Zy as f,
  Pc as g,
  dy as r
};
