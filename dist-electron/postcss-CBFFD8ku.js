import { bF as rr } from "./main-CEfjB-ow.js";
import Be from "path";
import Ut from "url";
import nr from "fs";
var J = { exports: {} }, Ke;
function Bt() {
  if (Ke) return J.exports;
  Ke = 1;
  let p = process || {}, w = p.argv || [], x = p.env || {}, b = !(x.NO_COLOR || w.includes("--no-color")) && (!!x.FORCE_COLOR || w.includes("--color") || p.platform === "win32" || (p.stdout || {}).isTTY && x.TERM !== "dumb" || !!x.CI), f = (u, s, o = u) => (e) => {
    let n = "" + e, t = n.indexOf(s, u.length);
    return ~t ? u + c(n, s, o, t) + s : u + n + s;
  }, c = (u, s, o, e) => {
    let n = "", t = 0;
    do
      n += u.substring(t, e) + o, t = e + s.length, e = u.indexOf(s, t);
    while (~e);
    return n + u.substring(t);
  }, l = (u = b) => {
    let s = u ? f : () => String;
    return {
      isColorSupported: u,
      reset: s("\x1B[0m", "\x1B[0m"),
      bold: s("\x1B[1m", "\x1B[22m", "\x1B[22m\x1B[1m"),
      dim: s("\x1B[2m", "\x1B[22m", "\x1B[22m\x1B[2m"),
      italic: s("\x1B[3m", "\x1B[23m"),
      underline: s("\x1B[4m", "\x1B[24m"),
      inverse: s("\x1B[7m", "\x1B[27m"),
      hidden: s("\x1B[8m", "\x1B[28m"),
      strikethrough: s("\x1B[9m", "\x1B[29m"),
      black: s("\x1B[30m", "\x1B[39m"),
      red: s("\x1B[31m", "\x1B[39m"),
      green: s("\x1B[32m", "\x1B[39m"),
      yellow: s("\x1B[33m", "\x1B[39m"),
      blue: s("\x1B[34m", "\x1B[39m"),
      magenta: s("\x1B[35m", "\x1B[39m"),
      cyan: s("\x1B[36m", "\x1B[39m"),
      white: s("\x1B[37m", "\x1B[39m"),
      gray: s("\x1B[90m", "\x1B[39m"),
      bgBlack: s("\x1B[40m", "\x1B[49m"),
      bgRed: s("\x1B[41m", "\x1B[49m"),
      bgGreen: s("\x1B[42m", "\x1B[49m"),
      bgYellow: s("\x1B[43m", "\x1B[49m"),
      bgBlue: s("\x1B[44m", "\x1B[49m"),
      bgMagenta: s("\x1B[45m", "\x1B[49m"),
      bgCyan: s("\x1B[46m", "\x1B[49m"),
      bgWhite: s("\x1B[47m", "\x1B[49m"),
      blackBright: s("\x1B[90m", "\x1B[39m"),
      redBright: s("\x1B[91m", "\x1B[39m"),
      greenBright: s("\x1B[92m", "\x1B[39m"),
      yellowBright: s("\x1B[93m", "\x1B[39m"),
      blueBright: s("\x1B[94m", "\x1B[39m"),
      magentaBright: s("\x1B[95m", "\x1B[39m"),
      cyanBright: s("\x1B[96m", "\x1B[39m"),
      whiteBright: s("\x1B[97m", "\x1B[39m"),
      bgBlackBright: s("\x1B[100m", "\x1B[49m"),
      bgRedBright: s("\x1B[101m", "\x1B[49m"),
      bgGreenBright: s("\x1B[102m", "\x1B[49m"),
      bgYellowBright: s("\x1B[103m", "\x1B[49m"),
      bgBlueBright: s("\x1B[104m", "\x1B[49m"),
      bgMagentaBright: s("\x1B[105m", "\x1B[49m"),
      bgCyanBright: s("\x1B[106m", "\x1B[49m"),
      bgWhiteBright: s("\x1B[107m", "\x1B[49m")
    };
  };
  return J.exports = l(), J.exports.createColors = l, J.exports;
}
var ie, Xe;
function Ft() {
  if (Xe) return ie;
  Xe = 1;
  const p = 39, w = 34, x = 92, b = 47, f = 10, c = 32, l = 12, u = 9, s = 13, o = 91, e = 93, n = 40, t = 41, r = 123, i = 125, a = 59, h = 42, y = 58, d = 64, _ = /[\t\n\f\r "#'()/;[\\\]{}]/g, A = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g, v = /.[\r\n"'(/\\]/, C = /[\da-f]/i;
  return ie = function(m, g = {}) {
    let S = m.css.valueOf(), O = g.ignoreErrors, L, I, k, E, D, N, q, B, T, $e, Ye = S.length, M = 0, te = [], V = [];
    function Xt() {
      return M;
    }
    function re(F) {
      throw m.error("Unclosed " + F, M);
    }
    function Zt() {
      return V.length === 0 && M >= Ye;
    }
    function er(F) {
      if (V.length) return V.pop();
      if (M >= Ye) return;
      let ne = F ? F.ignoreUnclosed : !1;
      switch (L = S.charCodeAt(M), L) {
        case f:
        case c:
        case u:
        case s:
        case l: {
          E = M;
          do
            E += 1, L = S.charCodeAt(E);
          while (L === c || L === f || L === u || L === s || L === l);
          N = ["space", S.slice(M, E)], M = E - 1;
          break;
        }
        case o:
        case e:
        case r:
        case i:
        case y:
        case a:
        case t: {
          let He = String.fromCharCode(L);
          N = [He, He, M];
          break;
        }
        case n: {
          if ($e = te.length ? te.pop()[1] : "", T = S.charCodeAt(M + 1), $e === "url" && T !== p && T !== w && T !== c && T !== f && T !== u && T !== l && T !== s) {
            E = M;
            do {
              if (q = !1, E = S.indexOf(")", E + 1), E === -1)
                if (O || ne) {
                  E = M;
                  break;
                } else
                  re("bracket");
              for (B = E; S.charCodeAt(B - 1) === x; )
                B -= 1, q = !q;
            } while (q);
            N = ["brackets", S.slice(M, E + 1), M, E], M = E;
          } else
            E = S.indexOf(")", M + 1), I = S.slice(M, E + 1), E === -1 || v.test(I) ? N = ["(", "(", M] : (N = ["brackets", I, M, E], M = E);
          break;
        }
        case p:
        case w: {
          D = L === p ? "'" : '"', E = M;
          do {
            if (q = !1, E = S.indexOf(D, E + 1), E === -1)
              if (O || ne) {
                E = M + 1;
                break;
              } else
                re("string");
            for (B = E; S.charCodeAt(B - 1) === x; )
              B -= 1, q = !q;
          } while (q);
          N = ["string", S.slice(M, E + 1), M, E], M = E;
          break;
        }
        case d: {
          _.lastIndex = M + 1, _.test(S), _.lastIndex === 0 ? E = S.length - 1 : E = _.lastIndex - 2, N = ["at-word", S.slice(M, E + 1), M, E], M = E;
          break;
        }
        case x: {
          for (E = M, k = !0; S.charCodeAt(E + 1) === x; )
            E += 1, k = !k;
          if (L = S.charCodeAt(E + 1), k && L !== b && L !== c && L !== f && L !== u && L !== s && L !== l && (E += 1, C.test(S.charAt(E)))) {
            for (; C.test(S.charAt(E + 1)); )
              E += 1;
            S.charCodeAt(E + 1) === c && (E += 1);
          }
          N = ["word", S.slice(M, E + 1), M, E], M = E;
          break;
        }
        default: {
          L === b && S.charCodeAt(M + 1) === h ? (E = S.indexOf("*/", M + 2) + 1, E === 0 && (O || ne ? E = S.length : re("comment")), N = ["comment", S.slice(M, E + 1), M, E], M = E) : (A.lastIndex = M + 1, A.test(S), A.lastIndex === 0 ? E = S.length - 1 : E = A.lastIndex - 2, N = ["word", S.slice(M, E + 1), M, E], te.push(N), M = E);
          break;
        }
      }
      return M++, N;
    }
    function tr(F) {
      V.push(F);
    }
    return {
      back: tr,
      endOfFile: Zt,
      nextToken: er,
      position: Xt
    };
  }, ie;
}
var se, Ze;
function zt() {
  if (Ze) return se;
  Ze = 1;
  let p = /* @__PURE__ */ Bt(), w = Ft(), x;
  function b(u) {
    x = u;
  }
  const f = {
    ";": p.yellow,
    ":": p.yellow,
    "(": p.cyan,
    ")": p.cyan,
    "[": p.yellow,
    "]": p.yellow,
    "{": p.yellow,
    "}": p.yellow,
    "at-word": p.cyan,
    brackets: p.cyan,
    call: p.cyan,
    class: p.yellow,
    comment: p.gray,
    hash: p.magenta,
    string: p.green
  };
  function c([u, s], o) {
    if (u === "word") {
      if (s[0] === ".")
        return "class";
      if (s[0] === "#")
        return "hash";
    }
    if (!o.endOfFile()) {
      let e = o.nextToken();
      if (o.back(e), e[0] === "brackets" || e[0] === "(") return "call";
    }
    return u;
  }
  function l(u) {
    let s = w(new x(u), { ignoreErrors: !0 }), o = "";
    for (; !s.endOfFile(); ) {
      let e = s.nextToken(), n = f[c(e, s)];
      n ? o += e[1].split(/\r?\n/).map((t) => n(t)).join(`
`) : o += e[1];
    }
    return o;
  }
  return l.registerInput = b, se = l, se;
}
var oe, et;
function Fe() {
  if (et) return oe;
  et = 1;
  let p = /* @__PURE__ */ Bt(), w = zt();
  class x extends Error {
    constructor(f, c, l, u, s, o) {
      super(f), this.name = "CssSyntaxError", this.reason = f, s && (this.file = s), u && (this.source = u), o && (this.plugin = o), typeof c < "u" && typeof l < "u" && (typeof c == "number" ? (this.line = c, this.column = l) : (this.line = c.line, this.column = c.column, this.endLine = l.line, this.endColumn = l.column)), this.setMessage(), Error.captureStackTrace && Error.captureStackTrace(this, x);
    }
    setMessage() {
      this.message = this.plugin ? this.plugin + ": " : "", this.message += this.file ? this.file : "<css input>", typeof this.line < "u" && (this.message += ":" + this.line + ":" + this.column), this.message += ": " + this.reason;
    }
    showSourceCode(f) {
      if (!this.source) return "";
      let c = this.source;
      f == null && (f = p.isColorSupported);
      let l = (r) => r, u = (r) => r, s = (r) => r;
      if (f) {
        let { bold: r, gray: i, red: a } = p.createColors(!0);
        u = (h) => r(a(h)), l = (h) => i(h), w && (s = (h) => w(h));
      }
      let o = c.split(/\r?\n/), e = Math.max(this.line - 3, 0), n = Math.min(this.line + 2, o.length), t = String(n).length;
      return o.slice(e, n).map((r, i) => {
        let a = e + 1 + i, h = " " + (" " + a).slice(-t) + " | ";
        if (a === this.line) {
          if (r.length > 160) {
            let d = 20, _ = Math.max(0, this.column - d), A = Math.max(
              this.column + d,
              this.endColumn + d
            ), v = r.slice(_, A), C = l(h.replace(/\d/g, " ")) + r.slice(0, Math.min(this.column - 1, d - 1)).replace(/[^\t]/g, " ");
            return u(">") + l(h) + s(v) + `
 ` + C + u("^");
          }
          let y = l(h.replace(/\d/g, " ")) + r.slice(0, this.column - 1).replace(/[^\t]/g, " ");
          return u(">") + l(h) + s(r) + `
 ` + y + u("^");
        }
        return " " + l(h) + s(r);
      }).join(`
`);
    }
    toString() {
      let f = this.showSourceCode();
      return f && (f = `

` + f + `
`), this.name + ": " + this.message + f;
    }
  }
  return oe = x, x.default = x, oe;
}
var le, tt;
function Gt() {
  if (tt) return le;
  tt = 1;
  const p = {
    after: `
`,
    beforeClose: `
`,
    beforeComment: `
`,
    beforeDecl: `
`,
    beforeOpen: " ",
    beforeRule: `
`,
    colon: ": ",
    commentLeft: " ",
    commentRight: " ",
    emptyBody: "",
    indent: "    ",
    semicolon: !1
  };
  function w(b) {
    return b[0].toUpperCase() + b.slice(1);
  }
  class x {
    constructor(f) {
      this.builder = f;
    }
    atrule(f, c) {
      let l = "@" + f.name, u = f.params ? this.rawValue(f, "params") : "";
      if (typeof f.raws.afterName < "u" ? l += f.raws.afterName : u && (l += " "), f.nodes)
        this.block(f, l + u);
      else {
        let s = (f.raws.between || "") + (c ? ";" : "");
        this.builder(l + u + s, f);
      }
    }
    beforeAfter(f, c) {
      let l;
      f.type === "decl" ? l = this.raw(f, null, "beforeDecl") : f.type === "comment" ? l = this.raw(f, null, "beforeComment") : c === "before" ? l = this.raw(f, null, "beforeRule") : l = this.raw(f, null, "beforeClose");
      let u = f.parent, s = 0;
      for (; u && u.type !== "root"; )
        s += 1, u = u.parent;
      if (l.includes(`
`)) {
        let o = this.raw(f, null, "indent");
        if (o.length)
          for (let e = 0; e < s; e++) l += o;
      }
      return l;
    }
    block(f, c) {
      let l = this.raw(f, "between", "beforeOpen");
      this.builder(c + l + "{", f, "start");
      let u;
      f.nodes && f.nodes.length ? (this.body(f), u = this.raw(f, "after")) : u = this.raw(f, "after", "emptyBody"), u && this.builder(u), this.builder("}", f, "end");
    }
    body(f) {
      let c = f.nodes.length - 1;
      for (; c > 0 && f.nodes[c].type === "comment"; )
        c -= 1;
      let l = this.raw(f, "semicolon");
      for (let u = 0; u < f.nodes.length; u++) {
        let s = f.nodes[u], o = this.raw(s, "before");
        o && this.builder(o), this.stringify(s, c !== u || l);
      }
    }
    comment(f) {
      let c = this.raw(f, "left", "commentLeft"), l = this.raw(f, "right", "commentRight");
      this.builder("/*" + c + f.text + l + "*/", f);
    }
    decl(f, c) {
      let l = this.raw(f, "between", "colon"), u = f.prop + l + this.rawValue(f, "value");
      f.important && (u += f.raws.important || " !important"), c && (u += ";"), this.builder(u, f);
    }
    document(f) {
      this.body(f);
    }
    raw(f, c, l) {
      let u;
      if (l || (l = c), c && (u = f.raws[c], typeof u < "u"))
        return u;
      let s = f.parent;
      if (l === "before" && (!s || s.type === "root" && s.first === f || s && s.type === "document"))
        return "";
      if (!s) return p[l];
      let o = f.root();
      if (o.rawCache || (o.rawCache = {}), typeof o.rawCache[l] < "u")
        return o.rawCache[l];
      if (l === "before" || l === "after")
        return this.beforeAfter(f, l);
      {
        let e = "raw" + w(l);
        this[e] ? u = this[e](o, f) : o.walk((n) => {
          if (u = n.raws[c], typeof u < "u") return !1;
        });
      }
      return typeof u > "u" && (u = p[l]), o.rawCache[l] = u, u;
    }
    rawBeforeClose(f) {
      let c;
      return f.walk((l) => {
        if (l.nodes && l.nodes.length > 0 && typeof l.raws.after < "u")
          return c = l.raws.after, c.includes(`
`) && (c = c.replace(/[^\n]+$/, "")), !1;
      }), c && (c = c.replace(/\S/g, "")), c;
    }
    rawBeforeComment(f, c) {
      let l;
      return f.walkComments((u) => {
        if (typeof u.raws.before < "u")
          return l = u.raws.before, l.includes(`
`) && (l = l.replace(/[^\n]+$/, "")), !1;
      }), typeof l > "u" ? l = this.raw(c, null, "beforeDecl") : l && (l = l.replace(/\S/g, "")), l;
    }
    rawBeforeDecl(f, c) {
      let l;
      return f.walkDecls((u) => {
        if (typeof u.raws.before < "u")
          return l = u.raws.before, l.includes(`
`) && (l = l.replace(/[^\n]+$/, "")), !1;
      }), typeof l > "u" ? l = this.raw(c, null, "beforeRule") : l && (l = l.replace(/\S/g, "")), l;
    }
    rawBeforeOpen(f) {
      let c;
      return f.walk((l) => {
        if (l.type !== "decl" && (c = l.raws.between, typeof c < "u"))
          return !1;
      }), c;
    }
    rawBeforeRule(f) {
      let c;
      return f.walk((l) => {
        if (l.nodes && (l.parent !== f || f.first !== l) && typeof l.raws.before < "u")
          return c = l.raws.before, c.includes(`
`) && (c = c.replace(/[^\n]+$/, "")), !1;
      }), c && (c = c.replace(/\S/g, "")), c;
    }
    rawColon(f) {
      let c;
      return f.walkDecls((l) => {
        if (typeof l.raws.between < "u")
          return c = l.raws.between.replace(/[^\s:]/g, ""), !1;
      }), c;
    }
    rawEmptyBody(f) {
      let c;
      return f.walk((l) => {
        if (l.nodes && l.nodes.length === 0 && (c = l.raws.after, typeof c < "u"))
          return !1;
      }), c;
    }
    rawIndent(f) {
      if (f.raws.indent) return f.raws.indent;
      let c;
      return f.walk((l) => {
        let u = l.parent;
        if (u && u !== f && u.parent && u.parent === f && typeof l.raws.before < "u") {
          let s = l.raws.before.split(`
`);
          return c = s[s.length - 1], c = c.replace(/\S/g, ""), !1;
        }
      }), c;
    }
    rawSemicolon(f) {
      let c;
      return f.walk((l) => {
        if (l.nodes && l.nodes.length && l.last.type === "decl" && (c = l.raws.semicolon, typeof c < "u"))
          return !1;
      }), c;
    }
    rawValue(f, c) {
      let l = f[c], u = f.raws[c];
      return u && u.value === l ? u.raw : l;
    }
    root(f) {
      this.body(f), f.raws.after && this.builder(f.raws.after);
    }
    rule(f) {
      this.block(f, this.rawValue(f, "selector")), f.raws.ownSemicolon && this.builder(f.raws.ownSemicolon, f, "end");
    }
    stringify(f, c) {
      if (!this[f.type])
        throw new Error(
          "Unknown AST node type " + f.type + ". Maybe you need to change PostCSS stringifier."
        );
      this[f.type](f, c);
    }
  }
  return le = x, x.default = x, le;
}
var ue, rt;
function H() {
  if (rt) return ue;
  rt = 1;
  let p = Gt();
  function w(x, b) {
    new p(b).stringify(x);
  }
  return ue = w, w.default = w, ue;
}
var Q = {}, nt;
function ze() {
  return nt || (nt = 1, Q.isClean = /* @__PURE__ */ Symbol("isClean"), Q.my = /* @__PURE__ */ Symbol("my")), Q;
}
var ae, it;
function K() {
  if (it) return ae;
  it = 1;
  let p = Fe(), w = Gt(), x = H(), { isClean: b, my: f } = ze();
  function c(s, o) {
    let e = new s.constructor();
    for (let n in s) {
      if (!Object.prototype.hasOwnProperty.call(s, n) || n === "proxyCache") continue;
      let t = s[n], r = typeof t;
      n === "parent" && r === "object" ? o && (e[n] = o) : n === "source" ? e[n] = t : Array.isArray(t) ? e[n] = t.map((i) => c(i, e)) : (r === "object" && t !== null && (t = c(t)), e[n] = t);
    }
    return e;
  }
  function l(s, o) {
    if (o && typeof o.offset < "u")
      return o.offset;
    let e = 1, n = 1, t = 0;
    for (let r = 0; r < s.length; r++) {
      if (n === o.line && e === o.column) {
        t = r;
        break;
      }
      s[r] === `
` ? (e = 1, n += 1) : e += 1;
    }
    return t;
  }
  class u {
    get proxyOf() {
      return this;
    }
    constructor(o = {}) {
      this.raws = {}, this[b] = !1, this[f] = !0;
      for (let e in o)
        if (e === "nodes") {
          this.nodes = [];
          for (let n of o[e])
            typeof n.clone == "function" ? this.append(n.clone()) : this.append(n);
        } else
          this[e] = o[e];
    }
    addToError(o) {
      if (o.postcssNode = this, o.stack && this.source && /\n\s{4}at /.test(o.stack)) {
        let e = this.source;
        o.stack = o.stack.replace(
          /\n\s{4}at /,
          `$&${e.input.from}:${e.start.line}:${e.start.column}$&`
        );
      }
      return o;
    }
    after(o) {
      return this.parent.insertAfter(this, o), this;
    }
    assign(o = {}) {
      for (let e in o)
        this[e] = o[e];
      return this;
    }
    before(o) {
      return this.parent.insertBefore(this, o), this;
    }
    cleanRaws(o) {
      delete this.raws.before, delete this.raws.after, o || delete this.raws.between;
    }
    clone(o = {}) {
      let e = c(this);
      for (let n in o)
        e[n] = o[n];
      return e;
    }
    cloneAfter(o = {}) {
      let e = this.clone(o);
      return this.parent.insertAfter(this, e), e;
    }
    cloneBefore(o = {}) {
      let e = this.clone(o);
      return this.parent.insertBefore(this, e), e;
    }
    error(o, e = {}) {
      if (this.source) {
        let { end: n, start: t } = this.rangeBy(e);
        return this.source.input.error(
          o,
          { column: t.column, line: t.line },
          { column: n.column, line: n.line },
          e
        );
      }
      return new p(o);
    }
    getProxyProcessor() {
      return {
        get(o, e) {
          return e === "proxyOf" ? o : e === "root" ? () => o.root().toProxy() : o[e];
        },
        set(o, e, n) {
          return o[e] === n || (o[e] = n, (e === "prop" || e === "value" || e === "name" || e === "params" || e === "important" || /* c8 ignore next */
          e === "text") && o.markDirty()), !0;
        }
      };
    }
    /* c8 ignore next 3 */
    markClean() {
      this[b] = !0;
    }
    markDirty() {
      if (this[b]) {
        this[b] = !1;
        let o = this;
        for (; o = o.parent; )
          o[b] = !1;
      }
    }
    next() {
      if (!this.parent) return;
      let o = this.parent.index(this);
      return this.parent.nodes[o + 1];
    }
    positionBy(o = {}) {
      let e = this.source.start;
      if (o.index)
        e = this.positionInside(o.index);
      else if (o.word) {
        let n = "document" in this.source.input ? this.source.input.document : this.source.input.css, r = n.slice(
          l(n, this.source.start),
          l(n, this.source.end)
        ).indexOf(o.word);
        r !== -1 && (e = this.positionInside(r));
      }
      return e;
    }
    positionInside(o) {
      let e = this.source.start.column, n = this.source.start.line, t = "document" in this.source.input ? this.source.input.document : this.source.input.css, r = l(t, this.source.start), i = r + o;
      for (let a = r; a < i; a++)
        t[a] === `
` ? (e = 1, n += 1) : e += 1;
      return { column: e, line: n, offset: i };
    }
    prev() {
      if (!this.parent) return;
      let o = this.parent.index(this);
      return this.parent.nodes[o - 1];
    }
    rangeBy(o = {}) {
      let e = "document" in this.source.input ? this.source.input.document : this.source.input.css, n = {
        column: this.source.start.column,
        line: this.source.start.line,
        offset: l(e, this.source.start)
      }, t = this.source.end ? {
        column: this.source.end.column + 1,
        line: this.source.end.line,
        offset: typeof this.source.end.offset == "number" ? (
          // `source.end.offset` is exclusive, so we don't need to add 1
          this.source.end.offset
        ) : (
          // Since line/column in this.source.end is inclusive,
          // the `sourceOffset(... , this.source.end)` returns an inclusive offset.
          // So, we add 1 to convert it to exclusive.
          l(e, this.source.end) + 1
        )
      } : {
        column: n.column + 1,
        line: n.line,
        offset: n.offset + 1
      };
      if (o.word) {
        let i = e.slice(
          l(e, this.source.start),
          l(e, this.source.end)
        ).indexOf(o.word);
        i !== -1 && (n = this.positionInside(i), t = this.positionInside(i + o.word.length));
      } else
        o.start ? n = {
          column: o.start.column,
          line: o.start.line,
          offset: l(e, o.start)
        } : o.index && (n = this.positionInside(o.index)), o.end ? t = {
          column: o.end.column,
          line: o.end.line,
          offset: l(e, o.end)
        } : typeof o.endIndex == "number" ? t = this.positionInside(o.endIndex) : o.index && (t = this.positionInside(o.index + 1));
      return (t.line < n.line || t.line === n.line && t.column <= n.column) && (t = {
        column: n.column + 1,
        line: n.line,
        offset: n.offset + 1
      }), { end: t, start: n };
    }
    raw(o, e) {
      return new w().raw(this, o, e);
    }
    remove() {
      return this.parent && this.parent.removeChild(this), this.parent = void 0, this;
    }
    replaceWith(...o) {
      if (this.parent) {
        let e = this, n = !1;
        for (let t of o)
          t === this ? n = !0 : n ? (this.parent.insertAfter(e, t), e = t) : this.parent.insertBefore(e, t);
        n || this.remove();
      }
      return this;
    }
    root() {
      let o = this;
      for (; o.parent && o.parent.type !== "document"; )
        o = o.parent;
      return o;
    }
    toJSON(o, e) {
      let n = {}, t = e == null;
      e = e || /* @__PURE__ */ new Map();
      let r = 0;
      for (let i in this) {
        if (!Object.prototype.hasOwnProperty.call(this, i) || i === "parent" || i === "proxyCache") continue;
        let a = this[i];
        if (Array.isArray(a))
          n[i] = a.map((h) => typeof h == "object" && h.toJSON ? h.toJSON(null, e) : h);
        else if (typeof a == "object" && a.toJSON)
          n[i] = a.toJSON(null, e);
        else if (i === "source") {
          if (a == null) continue;
          let h = e.get(a.input);
          h == null && (h = r, e.set(a.input, r), r++), n[i] = {
            end: a.end,
            inputId: h,
            start: a.start
          };
        } else
          n[i] = a;
      }
      return t && (n.inputs = [...e.keys()].map((i) => i.toJSON())), n;
    }
    toProxy() {
      return this.proxyCache || (this.proxyCache = new Proxy(this, this.getProxyProcessor())), this.proxyCache;
    }
    toString(o = x) {
      o.stringify && (o = o.stringify);
      let e = "";
      return o(this, (n) => {
        e += n;
      }), e;
    }
    warn(o, e, n = {}) {
      let t = { node: this };
      for (let r in n) t[r] = n[r];
      return o.warn(e, t);
    }
  }
  return ae = u, u.default = u, ae;
}
var fe, st;
function X() {
  if (st) return fe;
  st = 1;
  let p = K();
  class w extends p {
    constructor(b) {
      super(b), this.type = "comment";
    }
  }
  return fe = w, w.default = w, fe;
}
var ce, ot;
function Z() {
  if (ot) return ce;
  ot = 1;
  let p = K();
  class w extends p {
    get variable() {
      return this.prop.startsWith("--") || this.prop[0] === "$";
    }
    constructor(b) {
      b && typeof b.value < "u" && typeof b.value != "string" && (b = { ...b, value: String(b.value) }), super(b), this.type = "decl";
    }
  }
  return ce = w, w.default = w, ce;
}
var he, lt;
function U() {
  if (lt) return he;
  lt = 1;
  let p = X(), w = Z(), x = K(), { isClean: b, my: f } = ze(), c, l, u, s;
  function o(t) {
    return t.map((r) => (r.nodes && (r.nodes = o(r.nodes)), delete r.source, r));
  }
  function e(t) {
    if (t[b] = !1, t.proxyOf.nodes)
      for (let r of t.proxyOf.nodes)
        e(r);
  }
  class n extends x {
    get first() {
      if (this.proxyOf.nodes)
        return this.proxyOf.nodes[0];
    }
    get last() {
      if (this.proxyOf.nodes)
        return this.proxyOf.nodes[this.proxyOf.nodes.length - 1];
    }
    append(...r) {
      for (let i of r) {
        let a = this.normalize(i, this.last);
        for (let h of a) this.proxyOf.nodes.push(h);
      }
      return this.markDirty(), this;
    }
    cleanRaws(r) {
      if (super.cleanRaws(r), this.nodes)
        for (let i of this.nodes) i.cleanRaws(r);
    }
    each(r) {
      if (!this.proxyOf.nodes) return;
      let i = this.getIterator(), a, h;
      for (; this.indexes[i] < this.proxyOf.nodes.length && (a = this.indexes[i], h = r(this.proxyOf.nodes[a], a), h !== !1); )
        this.indexes[i] += 1;
      return delete this.indexes[i], h;
    }
    every(r) {
      return this.nodes.every(r);
    }
    getIterator() {
      this.lastEach || (this.lastEach = 0), this.indexes || (this.indexes = {}), this.lastEach += 1;
      let r = this.lastEach;
      return this.indexes[r] = 0, r;
    }
    getProxyProcessor() {
      return {
        get(r, i) {
          return i === "proxyOf" ? r : r[i] ? i === "each" || typeof i == "string" && i.startsWith("walk") ? (...a) => r[i](
            ...a.map((h) => typeof h == "function" ? (y, d) => h(y.toProxy(), d) : h)
          ) : i === "every" || i === "some" ? (a) => r[i](
            (h, ...y) => a(h.toProxy(), ...y)
          ) : i === "root" ? () => r.root().toProxy() : i === "nodes" ? r.nodes.map((a) => a.toProxy()) : i === "first" || i === "last" ? r[i].toProxy() : r[i] : r[i];
        },
        set(r, i, a) {
          return r[i] === a || (r[i] = a, (i === "name" || i === "params" || i === "selector") && r.markDirty()), !0;
        }
      };
    }
    index(r) {
      return typeof r == "number" ? r : (r.proxyOf && (r = r.proxyOf), this.proxyOf.nodes.indexOf(r));
    }
    insertAfter(r, i) {
      let a = this.index(r), h = this.normalize(i, this.proxyOf.nodes[a]).reverse();
      a = this.index(r);
      for (let d of h) this.proxyOf.nodes.splice(a + 1, 0, d);
      let y;
      for (let d in this.indexes)
        y = this.indexes[d], a < y && (this.indexes[d] = y + h.length);
      return this.markDirty(), this;
    }
    insertBefore(r, i) {
      let a = this.index(r), h = a === 0 ? "prepend" : !1, y = this.normalize(
        i,
        this.proxyOf.nodes[a],
        h
      ).reverse();
      a = this.index(r);
      for (let _ of y) this.proxyOf.nodes.splice(a, 0, _);
      let d;
      for (let _ in this.indexes)
        d = this.indexes[_], a <= d && (this.indexes[_] = d + y.length);
      return this.markDirty(), this;
    }
    normalize(r, i) {
      if (typeof r == "string")
        r = o(l(r).nodes);
      else if (typeof r > "u")
        r = [];
      else if (Array.isArray(r)) {
        r = r.slice(0);
        for (let h of r)
          h.parent && h.parent.removeChild(h, "ignore");
      } else if (r.type === "root" && this.type !== "document") {
        r = r.nodes.slice(0);
        for (let h of r)
          h.parent && h.parent.removeChild(h, "ignore");
      } else if (r.type)
        r = [r];
      else if (r.prop) {
        if (typeof r.value > "u")
          throw new Error("Value field is missed in node creation");
        typeof r.value != "string" && (r.value = String(r.value)), r = [new w(r)];
      } else if (r.selector || r.selectors)
        r = [new s(r)];
      else if (r.name)
        r = [new c(r)];
      else if (r.text)
        r = [new p(r)];
      else
        throw new Error("Unknown node type in node creation");
      return r.map((h) => (h[f] || n.rebuild(h), h = h.proxyOf, h.parent && h.parent.removeChild(h), h[b] && e(h), h.raws || (h.raws = {}), typeof h.raws.before > "u" && i && typeof i.raws.before < "u" && (h.raws.before = i.raws.before.replace(/\S/g, "")), h.parent = this.proxyOf, h));
    }
    prepend(...r) {
      r = r.reverse();
      for (let i of r) {
        let a = this.normalize(i, this.first, "prepend").reverse();
        for (let h of a) this.proxyOf.nodes.unshift(h);
        for (let h in this.indexes)
          this.indexes[h] = this.indexes[h] + a.length;
      }
      return this.markDirty(), this;
    }
    push(r) {
      return r.parent = this, this.proxyOf.nodes.push(r), this;
    }
    removeAll() {
      for (let r of this.proxyOf.nodes) r.parent = void 0;
      return this.proxyOf.nodes = [], this.markDirty(), this;
    }
    removeChild(r) {
      r = this.index(r), this.proxyOf.nodes[r].parent = void 0, this.proxyOf.nodes.splice(r, 1);
      let i;
      for (let a in this.indexes)
        i = this.indexes[a], i >= r && (this.indexes[a] = i - 1);
      return this.markDirty(), this;
    }
    replaceValues(r, i, a) {
      return a || (a = i, i = {}), this.walkDecls((h) => {
        i.props && !i.props.includes(h.prop) || i.fast && !h.value.includes(i.fast) || (h.value = h.value.replace(r, a));
      }), this.markDirty(), this;
    }
    some(r) {
      return this.nodes.some(r);
    }
    walk(r) {
      return this.each((i, a) => {
        let h;
        try {
          h = r(i, a);
        } catch (y) {
          throw i.addToError(y);
        }
        return h !== !1 && i.walk && (h = i.walk(r)), h;
      });
    }
    walkAtRules(r, i) {
      return i ? r instanceof RegExp ? this.walk((a, h) => {
        if (a.type === "atrule" && r.test(a.name))
          return i(a, h);
      }) : this.walk((a, h) => {
        if (a.type === "atrule" && a.name === r)
          return i(a, h);
      }) : (i = r, this.walk((a, h) => {
        if (a.type === "atrule")
          return i(a, h);
      }));
    }
    walkComments(r) {
      return this.walk((i, a) => {
        if (i.type === "comment")
          return r(i, a);
      });
    }
    walkDecls(r, i) {
      return i ? r instanceof RegExp ? this.walk((a, h) => {
        if (a.type === "decl" && r.test(a.prop))
          return i(a, h);
      }) : this.walk((a, h) => {
        if (a.type === "decl" && a.prop === r)
          return i(a, h);
      }) : (i = r, this.walk((a, h) => {
        if (a.type === "decl")
          return i(a, h);
      }));
    }
    walkRules(r, i) {
      return i ? r instanceof RegExp ? this.walk((a, h) => {
        if (a.type === "rule" && r.test(a.selector))
          return i(a, h);
      }) : this.walk((a, h) => {
        if (a.type === "rule" && a.selector === r)
          return i(a, h);
      }) : (i = r, this.walk((a, h) => {
        if (a.type === "rule")
          return i(a, h);
      }));
    }
  }
  return n.registerParse = (t) => {
    l = t;
  }, n.registerRule = (t) => {
    s = t;
  }, n.registerAtRule = (t) => {
    c = t;
  }, n.registerRoot = (t) => {
    u = t;
  }, he = n, n.default = n, n.rebuild = (t) => {
    t.type === "atrule" ? Object.setPrototypeOf(t, c.prototype) : t.type === "rule" ? Object.setPrototypeOf(t, s.prototype) : t.type === "decl" ? Object.setPrototypeOf(t, w.prototype) : t.type === "comment" ? Object.setPrototypeOf(t, p.prototype) : t.type === "root" && Object.setPrototypeOf(t, u.prototype), t[f] = !0, t.nodes && t.nodes.forEach((r) => {
      n.rebuild(r);
    });
  }, he;
}
var pe, ut;
function Ge() {
  if (ut) return pe;
  ut = 1;
  let p = U();
  class w extends p {
    constructor(b) {
      super(b), this.type = "atrule";
    }
    append(...b) {
      return this.proxyOf.nodes || (this.nodes = []), super.append(...b);
    }
    prepend(...b) {
      return this.proxyOf.nodes || (this.nodes = []), super.prepend(...b);
    }
  }
  return pe = w, w.default = w, p.registerAtRule(w), pe;
}
var de, at;
function je() {
  if (at) return de;
  at = 1;
  let p = U(), w, x;
  class b extends p {
    constructor(c) {
      super({ type: "document", ...c }), this.nodes || (this.nodes = []);
    }
    toResult(c = {}) {
      return new w(new x(), this, c).stringify();
    }
  }
  return b.registerLazyResult = (f) => {
    w = f;
  }, b.registerProcessor = (f) => {
    x = f;
  }, de = b, b.default = b, de;
}
var me, ft;
function ir() {
  if (ft) return me;
  ft = 1;
  let p = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  return me = { nanoid: (b = 21) => {
    let f = "", c = b | 0;
    for (; c--; )
      f += p[Math.random() * 64 | 0];
    return f;
  }, customAlphabet: (b, f = 21) => (c = f) => {
    let l = "", u = c | 0;
    for (; u--; )
      l += b[Math.random() * b.length | 0];
    return l;
  } }, me;
}
var z = {}, ge = {}, $ = {}, Y = {}, ct;
function sr() {
  if (ct) return Y;
  ct = 1;
  var p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
  return Y.encode = function(w) {
    if (0 <= w && w < p.length)
      return p[w];
    throw new TypeError("Must be between 0 and 63: " + w);
  }, Y.decode = function(w) {
    var x = 65, b = 90, f = 97, c = 122, l = 48, u = 57, s = 43, o = 47, e = 26, n = 52;
    return x <= w && w <= b ? w - x : f <= w && w <= c ? w - f + e : l <= w && w <= u ? w - l + n : w == s ? 62 : w == o ? 63 : -1;
  }, Y;
}
var ht;
function jt() {
  if (ht) return $;
  ht = 1;
  var p = sr(), w = 5, x = 1 << w, b = x - 1, f = x;
  function c(u) {
    return u < 0 ? (-u << 1) + 1 : (u << 1) + 0;
  }
  function l(u) {
    var s = (u & 1) === 1, o = u >> 1;
    return s ? -o : o;
  }
  return $.encode = function(s) {
    var o = "", e, n = c(s);
    do
      e = n & b, n >>>= w, n > 0 && (e |= f), o += p.encode(e);
    while (n > 0);
    return o;
  }, $.decode = function(s, o, e) {
    var n = s.length, t = 0, r = 0, i, a;
    do {
      if (o >= n)
        throw new Error("Expected more digits in base 64 VLQ value.");
      if (a = p.decode(s.charCodeAt(o++)), a === -1)
        throw new Error("Invalid base64 digit: " + s.charAt(o - 1));
      i = !!(a & f), a &= b, t = t + (a << r), r += w;
    } while (i);
    e.value = l(t), e.rest = o;
  }, $;
}
var ye = {}, pt;
function j() {
  return pt || (pt = 1, (function(p) {
    function w(m, g, S) {
      if (g in m)
        return m[g];
      if (arguments.length === 3)
        return S;
      throw new Error('"' + g + '" is a required argument.');
    }
    p.getArg = w;
    var x = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.-]*)(?::(\d+))?(.*)$/, b = /^data:.+\,.+$/;
    function f(m) {
      var g = m.match(x);
      return g ? {
        scheme: g[1],
        auth: g[2],
        host: g[3],
        port: g[4],
        path: g[5]
      } : null;
    }
    p.urlParse = f;
    function c(m) {
      var g = "";
      return m.scheme && (g += m.scheme + ":"), g += "//", m.auth && (g += m.auth + "@"), m.host && (g += m.host), m.port && (g += ":" + m.port), m.path && (g += m.path), g;
    }
    p.urlGenerate = c;
    var l = 32;
    function u(m) {
      var g = [];
      return function(S) {
        for (var O = 0; O < g.length; O++)
          if (g[O].input === S) {
            var L = g[0];
            return g[0] = g[O], g[O] = L, g[0].result;
          }
        var I = m(S);
        return g.unshift({
          input: S,
          result: I
        }), g.length > l && g.pop(), I;
      };
    }
    var s = u(function(g) {
      var S = g, O = f(g);
      if (O) {
        if (!O.path)
          return g;
        S = O.path;
      }
      for (var L = p.isAbsolute(S), I = [], k = 0, E = 0; ; )
        if (k = E, E = S.indexOf("/", k), E === -1) {
          I.push(S.slice(k));
          break;
        } else
          for (I.push(S.slice(k, E)); E < S.length && S[E] === "/"; )
            E++;
      for (var D, N = 0, E = I.length - 1; E >= 0; E--)
        D = I[E], D === "." ? I.splice(E, 1) : D === ".." ? N++ : N > 0 && (D === "" ? (I.splice(E + 1, N), N = 0) : (I.splice(E, 2), N--));
      return S = I.join("/"), S === "" && (S = L ? "/" : "."), O ? (O.path = S, c(O)) : S;
    });
    p.normalize = s;
    function o(m, g) {
      m === "" && (m = "."), g === "" && (g = ".");
      var S = f(g), O = f(m);
      if (O && (m = O.path || "/"), S && !S.scheme)
        return O && (S.scheme = O.scheme), c(S);
      if (S || g.match(b))
        return g;
      if (O && !O.host && !O.path)
        return O.host = g, c(O);
      var L = g.charAt(0) === "/" ? g : s(m.replace(/\/+$/, "") + "/" + g);
      return O ? (O.path = L, c(O)) : L;
    }
    p.join = o, p.isAbsolute = function(m) {
      return m.charAt(0) === "/" || x.test(m);
    };
    function e(m, g) {
      m === "" && (m = "."), m = m.replace(/\/$/, "");
      for (var S = 0; g.indexOf(m + "/") !== 0; ) {
        var O = m.lastIndexOf("/");
        if (O < 0 || (m = m.slice(0, O), m.match(/^([^\/]+:\/)?\/*$/)))
          return g;
        ++S;
      }
      return Array(S + 1).join("../") + g.substr(m.length + 1);
    }
    p.relative = e;
    var n = (function() {
      var m = /* @__PURE__ */ Object.create(null);
      return !("__proto__" in m);
    })();
    function t(m) {
      return m;
    }
    function r(m) {
      return a(m) ? "$" + m : m;
    }
    p.toSetString = n ? t : r;
    function i(m) {
      return a(m) ? m.slice(1) : m;
    }
    p.fromSetString = n ? t : i;
    function a(m) {
      if (!m)
        return !1;
      var g = m.length;
      if (g < 9 || m.charCodeAt(g - 1) !== 95 || m.charCodeAt(g - 2) !== 95 || m.charCodeAt(g - 3) !== 111 || m.charCodeAt(g - 4) !== 116 || m.charCodeAt(g - 5) !== 111 || m.charCodeAt(g - 6) !== 114 || m.charCodeAt(g - 7) !== 112 || m.charCodeAt(g - 8) !== 95 || m.charCodeAt(g - 9) !== 95)
        return !1;
      for (var S = g - 10; S >= 0; S--)
        if (m.charCodeAt(S) !== 36)
          return !1;
      return !0;
    }
    function h(m, g, S) {
      var O = A(m.source, g.source);
      return O !== 0 || (O = m.originalLine - g.originalLine, O !== 0) || (O = m.originalColumn - g.originalColumn, O !== 0 || S) || (O = m.generatedColumn - g.generatedColumn, O !== 0) || (O = m.generatedLine - g.generatedLine, O !== 0) ? O : A(m.name, g.name);
    }
    p.compareByOriginalPositions = h;
    function y(m, g, S) {
      var O;
      return O = m.originalLine - g.originalLine, O !== 0 || (O = m.originalColumn - g.originalColumn, O !== 0 || S) || (O = m.generatedColumn - g.generatedColumn, O !== 0) || (O = m.generatedLine - g.generatedLine, O !== 0) ? O : A(m.name, g.name);
    }
    p.compareByOriginalPositionsNoSource = y;
    function d(m, g, S) {
      var O = m.generatedLine - g.generatedLine;
      return O !== 0 || (O = m.generatedColumn - g.generatedColumn, O !== 0 || S) || (O = A(m.source, g.source), O !== 0) || (O = m.originalLine - g.originalLine, O !== 0) || (O = m.originalColumn - g.originalColumn, O !== 0) ? O : A(m.name, g.name);
    }
    p.compareByGeneratedPositionsDeflated = d;
    function _(m, g, S) {
      var O = m.generatedColumn - g.generatedColumn;
      return O !== 0 || S || (O = A(m.source, g.source), O !== 0) || (O = m.originalLine - g.originalLine, O !== 0) || (O = m.originalColumn - g.originalColumn, O !== 0) ? O : A(m.name, g.name);
    }
    p.compareByGeneratedPositionsDeflatedNoLine = _;
    function A(m, g) {
      return m === g ? 0 : m === null ? 1 : g === null ? -1 : m > g ? 1 : -1;
    }
    function v(m, g) {
      var S = m.generatedLine - g.generatedLine;
      return S !== 0 || (S = m.generatedColumn - g.generatedColumn, S !== 0) || (S = A(m.source, g.source), S !== 0) || (S = m.originalLine - g.originalLine, S !== 0) || (S = m.originalColumn - g.originalColumn, S !== 0) ? S : A(m.name, g.name);
    }
    p.compareByGeneratedPositionsInflated = v;
    function C(m) {
      return JSON.parse(m.replace(/^\)]}'[^\n]*\n/, ""));
    }
    p.parseSourceMapInput = C;
    function R(m, g, S) {
      if (g = g || "", m && (m[m.length - 1] !== "/" && g[0] !== "/" && (m += "/"), g = m + g), S) {
        var O = f(S);
        if (!O)
          throw new Error("sourceMapURL could not be parsed");
        if (O.path) {
          var L = O.path.lastIndexOf("/");
          L >= 0 && (O.path = O.path.substring(0, L + 1));
        }
        g = o(c(O), g);
      }
      return s(g);
    }
    p.computeSourceURL = R;
  })(ye)), ye;
}
var ve = {}, dt;
function Wt() {
  if (dt) return ve;
  dt = 1;
  var p = j(), w = Object.prototype.hasOwnProperty, x = typeof Map < "u";
  function b() {
    this._array = [], this._set = x ? /* @__PURE__ */ new Map() : /* @__PURE__ */ Object.create(null);
  }
  return b.fromArray = function(c, l) {
    for (var u = new b(), s = 0, o = c.length; s < o; s++)
      u.add(c[s], l);
    return u;
  }, b.prototype.size = function() {
    return x ? this._set.size : Object.getOwnPropertyNames(this._set).length;
  }, b.prototype.add = function(c, l) {
    var u = x ? c : p.toSetString(c), s = x ? this.has(c) : w.call(this._set, u), o = this._array.length;
    (!s || l) && this._array.push(c), s || (x ? this._set.set(c, o) : this._set[u] = o);
  }, b.prototype.has = function(c) {
    if (x)
      return this._set.has(c);
    var l = p.toSetString(c);
    return w.call(this._set, l);
  }, b.prototype.indexOf = function(c) {
    if (x) {
      var l = this._set.get(c);
      if (l >= 0)
        return l;
    } else {
      var u = p.toSetString(c);
      if (w.call(this._set, u))
        return this._set[u];
    }
    throw new Error('"' + c + '" is not in the set.');
  }, b.prototype.at = function(c) {
    if (c >= 0 && c < this._array.length)
      return this._array[c];
    throw new Error("No element indexed by " + c);
  }, b.prototype.toArray = function() {
    return this._array.slice();
  }, ve.ArraySet = b, ve;
}
var we = {}, mt;
function or() {
  if (mt) return we;
  mt = 1;
  var p = j();
  function w(b, f) {
    var c = b.generatedLine, l = f.generatedLine, u = b.generatedColumn, s = f.generatedColumn;
    return l > c || l == c && s >= u || p.compareByGeneratedPositionsInflated(b, f) <= 0;
  }
  function x() {
    this._array = [], this._sorted = !0, this._last = { generatedLine: -1, generatedColumn: 0 };
  }
  return x.prototype.unsortedForEach = function(f, c) {
    this._array.forEach(f, c);
  }, x.prototype.add = function(f) {
    w(this._last, f) ? (this._last = f, this._array.push(f)) : (this._sorted = !1, this._array.push(f));
  }, x.prototype.toArray = function() {
    return this._sorted || (this._array.sort(p.compareByGeneratedPositionsInflated), this._sorted = !0), this._array;
  }, we.MappingList = x, we;
}
var gt;
function Vt() {
  if (gt) return ge;
  gt = 1;
  var p = jt(), w = j(), x = Wt().ArraySet, b = or().MappingList;
  function f(c) {
    c || (c = {}), this._file = w.getArg(c, "file", null), this._sourceRoot = w.getArg(c, "sourceRoot", null), this._skipValidation = w.getArg(c, "skipValidation", !1), this._ignoreInvalidMapping = w.getArg(c, "ignoreInvalidMapping", !1), this._sources = new x(), this._names = new x(), this._mappings = new b(), this._sourcesContents = null;
  }
  return f.prototype._version = 3, f.fromSourceMap = function(l, u) {
    var s = l.sourceRoot, o = new f(Object.assign(u || {}, {
      file: l.file,
      sourceRoot: s
    }));
    return l.eachMapping(function(e) {
      var n = {
        generated: {
          line: e.generatedLine,
          column: e.generatedColumn
        }
      };
      e.source != null && (n.source = e.source, s != null && (n.source = w.relative(s, n.source)), n.original = {
        line: e.originalLine,
        column: e.originalColumn
      }, e.name != null && (n.name = e.name)), o.addMapping(n);
    }), l.sources.forEach(function(e) {
      var n = e;
      s !== null && (n = w.relative(s, e)), o._sources.has(n) || o._sources.add(n);
      var t = l.sourceContentFor(e);
      t != null && o.setSourceContent(e, t);
    }), o;
  }, f.prototype.addMapping = function(l) {
    var u = w.getArg(l, "generated"), s = w.getArg(l, "original", null), o = w.getArg(l, "source", null), e = w.getArg(l, "name", null);
    !this._skipValidation && this._validateMapping(u, s, o, e) === !1 || (o != null && (o = String(o), this._sources.has(o) || this._sources.add(o)), e != null && (e = String(e), this._names.has(e) || this._names.add(e)), this._mappings.add({
      generatedLine: u.line,
      generatedColumn: u.column,
      originalLine: s != null && s.line,
      originalColumn: s != null && s.column,
      source: o,
      name: e
    }));
  }, f.prototype.setSourceContent = function(l, u) {
    var s = l;
    this._sourceRoot != null && (s = w.relative(this._sourceRoot, s)), u != null ? (this._sourcesContents || (this._sourcesContents = /* @__PURE__ */ Object.create(null)), this._sourcesContents[w.toSetString(s)] = u) : this._sourcesContents && (delete this._sourcesContents[w.toSetString(s)], Object.keys(this._sourcesContents).length === 0 && (this._sourcesContents = null));
  }, f.prototype.applySourceMap = function(l, u, s) {
    var o = u;
    if (u == null) {
      if (l.file == null)
        throw new Error(
          `SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map's "file" property. Both were omitted.`
        );
      o = l.file;
    }
    var e = this._sourceRoot;
    e != null && (o = w.relative(e, o));
    var n = new x(), t = new x();
    this._mappings.unsortedForEach(function(r) {
      if (r.source === o && r.originalLine != null) {
        var i = l.originalPositionFor({
          line: r.originalLine,
          column: r.originalColumn
        });
        i.source != null && (r.source = i.source, s != null && (r.source = w.join(s, r.source)), e != null && (r.source = w.relative(e, r.source)), r.originalLine = i.line, r.originalColumn = i.column, i.name != null && (r.name = i.name));
      }
      var a = r.source;
      a != null && !n.has(a) && n.add(a);
      var h = r.name;
      h != null && !t.has(h) && t.add(h);
    }, this), this._sources = n, this._names = t, l.sources.forEach(function(r) {
      var i = l.sourceContentFor(r);
      i != null && (s != null && (r = w.join(s, r)), e != null && (r = w.relative(e, r)), this.setSourceContent(r, i));
    }, this);
  }, f.prototype._validateMapping = function(l, u, s, o) {
    if (u && typeof u.line != "number" && typeof u.column != "number") {
      var e = "original.line and original.column are not numbers -- you probably meant to omit the original mapping entirely and only map the generated position. If so, pass null for the original mapping instead of an object with empty or null values.";
      if (this._ignoreInvalidMapping)
        return typeof console < "u" && console.warn && console.warn(e), !1;
      throw new Error(e);
    }
    if (!(l && "line" in l && "column" in l && l.line > 0 && l.column >= 0 && !u && !s && !o)) {
      if (l && "line" in l && "column" in l && u && "line" in u && "column" in u && l.line > 0 && l.column >= 0 && u.line > 0 && u.column >= 0 && s)
        return;
      var e = "Invalid mapping: " + JSON.stringify({
        generated: l,
        source: s,
        original: u,
        name: o
      });
      if (this._ignoreInvalidMapping)
        return typeof console < "u" && console.warn && console.warn(e), !1;
      throw new Error(e);
    }
  }, f.prototype._serializeMappings = function() {
    for (var l = 0, u = 1, s = 0, o = 0, e = 0, n = 0, t = "", r, i, a, h, y = this._mappings.toArray(), d = 0, _ = y.length; d < _; d++) {
      if (i = y[d], r = "", i.generatedLine !== u)
        for (l = 0; i.generatedLine !== u; )
          r += ";", u++;
      else if (d > 0) {
        if (!w.compareByGeneratedPositionsInflated(i, y[d - 1]))
          continue;
        r += ",";
      }
      r += p.encode(i.generatedColumn - l), l = i.generatedColumn, i.source != null && (h = this._sources.indexOf(i.source), r += p.encode(h - n), n = h, r += p.encode(i.originalLine - 1 - o), o = i.originalLine - 1, r += p.encode(i.originalColumn - s), s = i.originalColumn, i.name != null && (a = this._names.indexOf(i.name), r += p.encode(a - e), e = a)), t += r;
    }
    return t;
  }, f.prototype._generateSourcesContent = function(l, u) {
    return l.map(function(s) {
      if (!this._sourcesContents)
        return null;
      u != null && (s = w.relative(u, s));
      var o = w.toSetString(s);
      return Object.prototype.hasOwnProperty.call(this._sourcesContents, o) ? this._sourcesContents[o] : null;
    }, this);
  }, f.prototype.toJSON = function() {
    var l = {
      version: this._version,
      sources: this._sources.toArray(),
      names: this._names.toArray(),
      mappings: this._serializeMappings()
    };
    return this._file != null && (l.file = this._file), this._sourceRoot != null && (l.sourceRoot = this._sourceRoot), this._sourcesContents && (l.sourcesContent = this._generateSourcesContent(l.sources, l.sourceRoot)), l;
  }, f.prototype.toString = function() {
    return JSON.stringify(this.toJSON());
  }, ge.SourceMapGenerator = f, ge;
}
var G = {}, be = {}, yt;
function lr() {
  return yt || (yt = 1, (function(p) {
    p.GREATEST_LOWER_BOUND = 1, p.LEAST_UPPER_BOUND = 2;
    function w(x, b, f, c, l, u) {
      var s = Math.floor((b - x) / 2) + x, o = l(f, c[s], !0);
      return o === 0 ? s : o > 0 ? b - s > 1 ? w(s, b, f, c, l, u) : u == p.LEAST_UPPER_BOUND ? b < c.length ? b : -1 : s : s - x > 1 ? w(x, s, f, c, l, u) : u == p.LEAST_UPPER_BOUND ? s : x < 0 ? -1 : x;
    }
    p.search = function(b, f, c, l) {
      if (f.length === 0)
        return -1;
      var u = w(
        -1,
        f.length,
        b,
        f,
        c,
        l || p.GREATEST_LOWER_BOUND
      );
      if (u < 0)
        return -1;
      for (; u - 1 >= 0 && c(f[u], f[u - 1], !0) === 0; )
        --u;
      return u;
    };
  })(be)), be;
}
var Se = {}, vt;
function ur() {
  if (vt) return Se;
  vt = 1;
  function p(b) {
    function f(u, s, o) {
      var e = u[s];
      u[s] = u[o], u[o] = e;
    }
    function c(u, s) {
      return Math.round(u + Math.random() * (s - u));
    }
    function l(u, s, o, e) {
      if (o < e) {
        var n = c(o, e), t = o - 1;
        f(u, n, e);
        for (var r = u[e], i = o; i < e; i++)
          s(u[i], r, !1) <= 0 && (t += 1, f(u, t, i));
        f(u, t + 1, i);
        var a = t + 1;
        l(u, s, o, a - 1), l(u, s, a + 1, e);
      }
    }
    return l;
  }
  function w(b) {
    let f = p.toString();
    return new Function(`return ${f}`)()(b);
  }
  let x = /* @__PURE__ */ new WeakMap();
  return Se.quickSort = function(b, f, c = 0) {
    let l = x.get(f);
    l === void 0 && (l = w(f), x.set(f, l)), l(b, f, c, b.length - 1);
  }, Se;
}
var wt;
function ar() {
  if (wt) return G;
  wt = 1;
  var p = j(), w = lr(), x = Wt().ArraySet, b = jt(), f = ur().quickSort;
  function c(n, t) {
    var r = n;
    return typeof n == "string" && (r = p.parseSourceMapInput(n)), r.sections != null ? new e(r, t) : new l(r, t);
  }
  c.fromSourceMap = function(n, t) {
    return l.fromSourceMap(n, t);
  }, c.prototype._version = 3, c.prototype.__generatedMappings = null, Object.defineProperty(c.prototype, "_generatedMappings", {
    configurable: !0,
    enumerable: !0,
    get: function() {
      return this.__generatedMappings || this._parseMappings(this._mappings, this.sourceRoot), this.__generatedMappings;
    }
  }), c.prototype.__originalMappings = null, Object.defineProperty(c.prototype, "_originalMappings", {
    configurable: !0,
    enumerable: !0,
    get: function() {
      return this.__originalMappings || this._parseMappings(this._mappings, this.sourceRoot), this.__originalMappings;
    }
  }), c.prototype._charIsMappingSeparator = function(t, r) {
    var i = t.charAt(r);
    return i === ";" || i === ",";
  }, c.prototype._parseMappings = function(t, r) {
    throw new Error("Subclasses must implement _parseMappings");
  }, c.GENERATED_ORDER = 1, c.ORIGINAL_ORDER = 2, c.GREATEST_LOWER_BOUND = 1, c.LEAST_UPPER_BOUND = 2, c.prototype.eachMapping = function(t, r, i) {
    var a = r || null, h = i || c.GENERATED_ORDER, y;
    switch (h) {
      case c.GENERATED_ORDER:
        y = this._generatedMappings;
        break;
      case c.ORIGINAL_ORDER:
        y = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
    }
    for (var d = this.sourceRoot, _ = t.bind(a), A = this._names, v = this._sources, C = this._sourceMapURL, R = 0, m = y.length; R < m; R++) {
      var g = y[R], S = g.source === null ? null : v.at(g.source);
      S !== null && (S = p.computeSourceURL(d, S, C)), _({
        source: S,
        generatedLine: g.generatedLine,
        generatedColumn: g.generatedColumn,
        originalLine: g.originalLine,
        originalColumn: g.originalColumn,
        name: g.name === null ? null : A.at(g.name)
      });
    }
  }, c.prototype.allGeneratedPositionsFor = function(t) {
    var r = p.getArg(t, "line"), i = {
      source: p.getArg(t, "source"),
      originalLine: r,
      originalColumn: p.getArg(t, "column", 0)
    };
    if (i.source = this._findSourceIndex(i.source), i.source < 0)
      return [];
    var a = [], h = this._findMapping(
      i,
      this._originalMappings,
      "originalLine",
      "originalColumn",
      p.compareByOriginalPositions,
      w.LEAST_UPPER_BOUND
    );
    if (h >= 0) {
      var y = this._originalMappings[h];
      if (t.column === void 0)
        for (var d = y.originalLine; y && y.originalLine === d; )
          a.push({
            line: p.getArg(y, "generatedLine", null),
            column: p.getArg(y, "generatedColumn", null),
            lastColumn: p.getArg(y, "lastGeneratedColumn", null)
          }), y = this._originalMappings[++h];
      else
        for (var _ = y.originalColumn; y && y.originalLine === r && y.originalColumn == _; )
          a.push({
            line: p.getArg(y, "generatedLine", null),
            column: p.getArg(y, "generatedColumn", null),
            lastColumn: p.getArg(y, "lastGeneratedColumn", null)
          }), y = this._originalMappings[++h];
    }
    return a;
  }, G.SourceMapConsumer = c;
  function l(n, t) {
    var r = n;
    typeof n == "string" && (r = p.parseSourceMapInput(n));
    var i = p.getArg(r, "version"), a = p.getArg(r, "sources"), h = p.getArg(r, "names", []), y = p.getArg(r, "sourceRoot", null), d = p.getArg(r, "sourcesContent", null), _ = p.getArg(r, "mappings"), A = p.getArg(r, "file", null);
    if (i != this._version)
      throw new Error("Unsupported version: " + i);
    y && (y = p.normalize(y)), a = a.map(String).map(p.normalize).map(function(v) {
      return y && p.isAbsolute(y) && p.isAbsolute(v) ? p.relative(y, v) : v;
    }), this._names = x.fromArray(h.map(String), !0), this._sources = x.fromArray(a, !0), this._absoluteSources = this._sources.toArray().map(function(v) {
      return p.computeSourceURL(y, v, t);
    }), this.sourceRoot = y, this.sourcesContent = d, this._mappings = _, this._sourceMapURL = t, this.file = A;
  }
  l.prototype = Object.create(c.prototype), l.prototype.consumer = c, l.prototype._findSourceIndex = function(n) {
    var t = n;
    if (this.sourceRoot != null && (t = p.relative(this.sourceRoot, t)), this._sources.has(t))
      return this._sources.indexOf(t);
    var r;
    for (r = 0; r < this._absoluteSources.length; ++r)
      if (this._absoluteSources[r] == n)
        return r;
    return -1;
  }, l.fromSourceMap = function(t, r) {
    var i = Object.create(l.prototype), a = i._names = x.fromArray(t._names.toArray(), !0), h = i._sources = x.fromArray(t._sources.toArray(), !0);
    i.sourceRoot = t._sourceRoot, i.sourcesContent = t._generateSourcesContent(
      i._sources.toArray(),
      i.sourceRoot
    ), i.file = t._file, i._sourceMapURL = r, i._absoluteSources = i._sources.toArray().map(function(m) {
      return p.computeSourceURL(i.sourceRoot, m, r);
    });
    for (var y = t._mappings.toArray().slice(), d = i.__generatedMappings = [], _ = i.__originalMappings = [], A = 0, v = y.length; A < v; A++) {
      var C = y[A], R = new u();
      R.generatedLine = C.generatedLine, R.generatedColumn = C.generatedColumn, C.source && (R.source = h.indexOf(C.source), R.originalLine = C.originalLine, R.originalColumn = C.originalColumn, C.name && (R.name = a.indexOf(C.name)), _.push(R)), d.push(R);
    }
    return f(i.__originalMappings, p.compareByOriginalPositions), i;
  }, l.prototype._version = 3, Object.defineProperty(l.prototype, "sources", {
    get: function() {
      return this._absoluteSources.slice();
    }
  });
  function u() {
    this.generatedLine = 0, this.generatedColumn = 0, this.source = null, this.originalLine = null, this.originalColumn = null, this.name = null;
  }
  const s = p.compareByGeneratedPositionsDeflatedNoLine;
  function o(n, t) {
    let r = n.length, i = n.length - t;
    if (!(i <= 1))
      if (i == 2) {
        let a = n[t], h = n[t + 1];
        s(a, h) > 0 && (n[t] = h, n[t + 1] = a);
      } else if (i < 20)
        for (let a = t; a < r; a++)
          for (let h = a; h > t; h--) {
            let y = n[h - 1], d = n[h];
            if (s(y, d) <= 0)
              break;
            n[h - 1] = d, n[h] = y;
          }
      else
        f(n, s, t);
  }
  l.prototype._parseMappings = function(t, r) {
    var i = 1, a = 0, h = 0, y = 0, d = 0, _ = 0, A = t.length, v = 0, C = {}, R = [], m = [], g, S, O, L;
    let I = 0;
    for (; v < A; )
      if (t.charAt(v) === ";")
        i++, v++, a = 0, o(m, I), I = m.length;
      else if (t.charAt(v) === ",")
        v++;
      else {
        for (g = new u(), g.generatedLine = i, O = v; O < A && !this._charIsMappingSeparator(t, O); O++)
          ;
        for (t.slice(v, O), S = []; v < O; )
          b.decode(t, v, C), L = C.value, v = C.rest, S.push(L);
        if (S.length === 2)
          throw new Error("Found a source, but no line and column");
        if (S.length === 3)
          throw new Error("Found a source and line, but no column");
        if (g.generatedColumn = a + S[0], a = g.generatedColumn, S.length > 1 && (g.source = d + S[1], d += S[1], g.originalLine = h + S[2], h = g.originalLine, g.originalLine += 1, g.originalColumn = y + S[3], y = g.originalColumn, S.length > 4 && (g.name = _ + S[4], _ += S[4])), m.push(g), typeof g.originalLine == "number") {
          let E = g.source;
          for (; R.length <= E; )
            R.push(null);
          R[E] === null && (R[E] = []), R[E].push(g);
        }
      }
    o(m, I), this.__generatedMappings = m;
    for (var k = 0; k < R.length; k++)
      R[k] != null && f(R[k], p.compareByOriginalPositionsNoSource);
    this.__originalMappings = [].concat(...R);
  }, l.prototype._findMapping = function(t, r, i, a, h, y) {
    if (t[i] <= 0)
      throw new TypeError("Line must be greater than or equal to 1, got " + t[i]);
    if (t[a] < 0)
      throw new TypeError("Column must be greater than or equal to 0, got " + t[a]);
    return w.search(t, r, h, y);
  }, l.prototype.computeColumnSpans = function() {
    for (var t = 0; t < this._generatedMappings.length; ++t) {
      var r = this._generatedMappings[t];
      if (t + 1 < this._generatedMappings.length) {
        var i = this._generatedMappings[t + 1];
        if (r.generatedLine === i.generatedLine) {
          r.lastGeneratedColumn = i.generatedColumn - 1;
          continue;
        }
      }
      r.lastGeneratedColumn = 1 / 0;
    }
  }, l.prototype.originalPositionFor = function(t) {
    var r = {
      generatedLine: p.getArg(t, "line"),
      generatedColumn: p.getArg(t, "column")
    }, i = this._findMapping(
      r,
      this._generatedMappings,
      "generatedLine",
      "generatedColumn",
      p.compareByGeneratedPositionsDeflated,
      p.getArg(t, "bias", c.GREATEST_LOWER_BOUND)
    );
    if (i >= 0) {
      var a = this._generatedMappings[i];
      if (a.generatedLine === r.generatedLine) {
        var h = p.getArg(a, "source", null);
        h !== null && (h = this._sources.at(h), h = p.computeSourceURL(this.sourceRoot, h, this._sourceMapURL));
        var y = p.getArg(a, "name", null);
        return y !== null && (y = this._names.at(y)), {
          source: h,
          line: p.getArg(a, "originalLine", null),
          column: p.getArg(a, "originalColumn", null),
          name: y
        };
      }
    }
    return {
      source: null,
      line: null,
      column: null,
      name: null
    };
  }, l.prototype.hasContentsOfAllSources = function() {
    return this.sourcesContent ? this.sourcesContent.length >= this._sources.size() && !this.sourcesContent.some(function(t) {
      return t == null;
    }) : !1;
  }, l.prototype.sourceContentFor = function(t, r) {
    if (!this.sourcesContent)
      return null;
    var i = this._findSourceIndex(t);
    if (i >= 0)
      return this.sourcesContent[i];
    var a = t;
    this.sourceRoot != null && (a = p.relative(this.sourceRoot, a));
    var h;
    if (this.sourceRoot != null && (h = p.urlParse(this.sourceRoot))) {
      var y = a.replace(/^file:\/\//, "");
      if (h.scheme == "file" && this._sources.has(y))
        return this.sourcesContent[this._sources.indexOf(y)];
      if ((!h.path || h.path == "/") && this._sources.has("/" + a))
        return this.sourcesContent[this._sources.indexOf("/" + a)];
    }
    if (r)
      return null;
    throw new Error('"' + a + '" is not in the SourceMap.');
  }, l.prototype.generatedPositionFor = function(t) {
    var r = p.getArg(t, "source");
    if (r = this._findSourceIndex(r), r < 0)
      return {
        line: null,
        column: null,
        lastColumn: null
      };
    var i = {
      source: r,
      originalLine: p.getArg(t, "line"),
      originalColumn: p.getArg(t, "column")
    }, a = this._findMapping(
      i,
      this._originalMappings,
      "originalLine",
      "originalColumn",
      p.compareByOriginalPositions,
      p.getArg(t, "bias", c.GREATEST_LOWER_BOUND)
    );
    if (a >= 0) {
      var h = this._originalMappings[a];
      if (h.source === i.source)
        return {
          line: p.getArg(h, "generatedLine", null),
          column: p.getArg(h, "generatedColumn", null),
          lastColumn: p.getArg(h, "lastGeneratedColumn", null)
        };
    }
    return {
      line: null,
      column: null,
      lastColumn: null
    };
  }, G.BasicSourceMapConsumer = l;
  function e(n, t) {
    var r = n;
    typeof n == "string" && (r = p.parseSourceMapInput(n));
    var i = p.getArg(r, "version"), a = p.getArg(r, "sections");
    if (i != this._version)
      throw new Error("Unsupported version: " + i);
    this._sources = new x(), this._names = new x();
    var h = {
      line: -1,
      column: 0
    };
    this._sections = a.map(function(y) {
      if (y.url)
        throw new Error("Support for url field in sections not implemented.");
      var d = p.getArg(y, "offset"), _ = p.getArg(d, "line"), A = p.getArg(d, "column");
      if (_ < h.line || _ === h.line && A < h.column)
        throw new Error("Section offsets must be ordered and non-overlapping.");
      return h = d, {
        generatedOffset: {
          // The offset fields are 0-based, but we use 1-based indices when
          // encoding/decoding from VLQ.
          generatedLine: _ + 1,
          generatedColumn: A + 1
        },
        consumer: new c(p.getArg(y, "map"), t)
      };
    });
  }
  return e.prototype = Object.create(c.prototype), e.prototype.constructor = c, e.prototype._version = 3, Object.defineProperty(e.prototype, "sources", {
    get: function() {
      for (var n = [], t = 0; t < this._sections.length; t++)
        for (var r = 0; r < this._sections[t].consumer.sources.length; r++)
          n.push(this._sections[t].consumer.sources[r]);
      return n;
    }
  }), e.prototype.originalPositionFor = function(t) {
    var r = {
      generatedLine: p.getArg(t, "line"),
      generatedColumn: p.getArg(t, "column")
    }, i = w.search(
      r,
      this._sections,
      function(h, y) {
        var d = h.generatedLine - y.generatedOffset.generatedLine;
        return d || h.generatedColumn - y.generatedOffset.generatedColumn;
      }
    ), a = this._sections[i];
    return a ? a.consumer.originalPositionFor({
      line: r.generatedLine - (a.generatedOffset.generatedLine - 1),
      column: r.generatedColumn - (a.generatedOffset.generatedLine === r.generatedLine ? a.generatedOffset.generatedColumn - 1 : 0),
      bias: t.bias
    }) : {
      source: null,
      line: null,
      column: null,
      name: null
    };
  }, e.prototype.hasContentsOfAllSources = function() {
    return this._sections.every(function(t) {
      return t.consumer.hasContentsOfAllSources();
    });
  }, e.prototype.sourceContentFor = function(t, r) {
    for (var i = 0; i < this._sections.length; i++) {
      var a = this._sections[i], h = a.consumer.sourceContentFor(t, !0);
      if (h || h === "")
        return h;
    }
    if (r)
      return null;
    throw new Error('"' + t + '" is not in the SourceMap.');
  }, e.prototype.generatedPositionFor = function(t) {
    for (var r = 0; r < this._sections.length; r++) {
      var i = this._sections[r];
      if (i.consumer._findSourceIndex(p.getArg(t, "source")) !== -1) {
        var a = i.consumer.generatedPositionFor(t);
        if (a) {
          var h = {
            line: a.line + (i.generatedOffset.generatedLine - 1),
            column: a.column + (i.generatedOffset.generatedLine === a.line ? i.generatedOffset.generatedColumn - 1 : 0)
          };
          return h;
        }
      }
    }
    return {
      line: null,
      column: null
    };
  }, e.prototype._parseMappings = function(t, r) {
    this.__generatedMappings = [], this.__originalMappings = [];
    for (var i = 0; i < this._sections.length; i++)
      for (var a = this._sections[i], h = a.consumer._generatedMappings, y = 0; y < h.length; y++) {
        var d = h[y], _ = a.consumer._sources.at(d.source);
        _ !== null && (_ = p.computeSourceURL(a.consumer.sourceRoot, _, this._sourceMapURL)), this._sources.add(_), _ = this._sources.indexOf(_);
        var A = null;
        d.name && (A = a.consumer._names.at(d.name), this._names.add(A), A = this._names.indexOf(A));
        var v = {
          source: _,
          generatedLine: d.generatedLine + (a.generatedOffset.generatedLine - 1),
          generatedColumn: d.generatedColumn + (a.generatedOffset.generatedLine === d.generatedLine ? a.generatedOffset.generatedColumn - 1 : 0),
          originalLine: d.originalLine,
          originalColumn: d.originalColumn,
          name: A
        };
        this.__generatedMappings.push(v), typeof v.originalLine == "number" && this.__originalMappings.push(v);
      }
    f(this.__generatedMappings, p.compareByGeneratedPositionsDeflated), f(this.__originalMappings, p.compareByOriginalPositions);
  }, G.IndexedSourceMapConsumer = e, G;
}
var Ce = {}, bt;
function fr() {
  if (bt) return Ce;
  bt = 1;
  var p = Vt().SourceMapGenerator, w = j(), x = /(\r?\n)/, b = 10, f = "$$$isSourceNode$$$";
  function c(l, u, s, o, e) {
    this.children = [], this.sourceContents = {}, this.line = l ?? null, this.column = u ?? null, this.source = s ?? null, this.name = e ?? null, this[f] = !0, o != null && this.add(o);
  }
  return c.fromStringWithSourceMap = function(u, s, o) {
    var e = new c(), n = u.split(x), t = 0, r = function() {
      var d = A(), _ = A() || "";
      return d + _;
      function A() {
        return t < n.length ? n[t++] : void 0;
      }
    }, i = 1, a = 0, h = null;
    return s.eachMapping(function(d) {
      if (h !== null)
        if (i < d.generatedLine)
          y(h, r()), i++, a = 0;
        else {
          var _ = n[t] || "", A = _.substr(0, d.generatedColumn - a);
          n[t] = _.substr(d.generatedColumn - a), a = d.generatedColumn, y(h, A), h = d;
          return;
        }
      for (; i < d.generatedLine; )
        e.add(r()), i++;
      if (a < d.generatedColumn) {
        var _ = n[t] || "";
        e.add(_.substr(0, d.generatedColumn)), n[t] = _.substr(d.generatedColumn), a = d.generatedColumn;
      }
      h = d;
    }, this), t < n.length && (h && y(h, r()), e.add(n.splice(t).join(""))), s.sources.forEach(function(d) {
      var _ = s.sourceContentFor(d);
      _ != null && (o != null && (d = w.join(o, d)), e.setSourceContent(d, _));
    }), e;
    function y(d, _) {
      if (d === null || d.source === void 0)
        e.add(_);
      else {
        var A = o ? w.join(o, d.source) : d.source;
        e.add(new c(
          d.originalLine,
          d.originalColumn,
          A,
          _,
          d.name
        ));
      }
    }
  }, c.prototype.add = function(u) {
    if (Array.isArray(u))
      u.forEach(function(s) {
        this.add(s);
      }, this);
    else if (u[f] || typeof u == "string")
      u && this.children.push(u);
    else
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + u
      );
    return this;
  }, c.prototype.prepend = function(u) {
    if (Array.isArray(u))
      for (var s = u.length - 1; s >= 0; s--)
        this.prepend(u[s]);
    else if (u[f] || typeof u == "string")
      this.children.unshift(u);
    else
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + u
      );
    return this;
  }, c.prototype.walk = function(u) {
    for (var s, o = 0, e = this.children.length; o < e; o++)
      s = this.children[o], s[f] ? s.walk(u) : s !== "" && u(s, {
        source: this.source,
        line: this.line,
        column: this.column,
        name: this.name
      });
  }, c.prototype.join = function(u) {
    var s, o, e = this.children.length;
    if (e > 0) {
      for (s = [], o = 0; o < e - 1; o++)
        s.push(this.children[o]), s.push(u);
      s.push(this.children[o]), this.children = s;
    }
    return this;
  }, c.prototype.replaceRight = function(u, s) {
    var o = this.children[this.children.length - 1];
    return o[f] ? o.replaceRight(u, s) : typeof o == "string" ? this.children[this.children.length - 1] = o.replace(u, s) : this.children.push("".replace(u, s)), this;
  }, c.prototype.setSourceContent = function(u, s) {
    this.sourceContents[w.toSetString(u)] = s;
  }, c.prototype.walkSourceContents = function(u) {
    for (var s = 0, o = this.children.length; s < o; s++)
      this.children[s][f] && this.children[s].walkSourceContents(u);
    for (var e = Object.keys(this.sourceContents), s = 0, o = e.length; s < o; s++)
      u(w.fromSetString(e[s]), this.sourceContents[e[s]]);
  }, c.prototype.toString = function() {
    var u = "";
    return this.walk(function(s) {
      u += s;
    }), u;
  }, c.prototype.toStringWithSourceMap = function(u) {
    var s = {
      code: "",
      line: 1,
      column: 0
    }, o = new p(u), e = !1, n = null, t = null, r = null, i = null;
    return this.walk(function(a, h) {
      s.code += a, h.source !== null && h.line !== null && h.column !== null ? ((n !== h.source || t !== h.line || r !== h.column || i !== h.name) && o.addMapping({
        source: h.source,
        original: {
          line: h.line,
          column: h.column
        },
        generated: {
          line: s.line,
          column: s.column
        },
        name: h.name
      }), n = h.source, t = h.line, r = h.column, i = h.name, e = !0) : e && (o.addMapping({
        generated: {
          line: s.line,
          column: s.column
        }
      }), n = null, e = !1);
      for (var y = 0, d = a.length; y < d; y++)
        a.charCodeAt(y) === b ? (s.line++, s.column = 0, y + 1 === d ? (n = null, e = !1) : e && o.addMapping({
          source: h.source,
          original: {
            line: h.line,
            column: h.column
          },
          generated: {
            line: s.line,
            column: s.column
          },
          name: h.name
        })) : s.column++;
    }), this.walkSourceContents(function(a, h) {
      o.setSourceContent(a, h);
    }), { code: s.code, map: o };
  }, Ce.SourceNode = c, Ce;
}
var St;
function We() {
  return St || (St = 1, z.SourceMapGenerator = Vt().SourceMapGenerator, z.SourceMapConsumer = ar().SourceMapConsumer, z.SourceNode = fr().SourceNode), z;
}
var _e, Ct;
function Jt() {
  if (Ct) return _e;
  Ct = 1;
  let { existsSync: p, readFileSync: w } = nr, { dirname: x, join: b } = Be, { SourceMapConsumer: f, SourceMapGenerator: c } = We();
  function l(s) {
    return Buffer ? Buffer.from(s, "base64").toString() : window.atob(s);
  }
  class u {
    constructor(o, e) {
      if (e.map === !1) return;
      this.loadAnnotation(o), this.inline = this.startWith(this.annotation, "data:");
      let n = e.map ? e.map.prev : void 0, t = this.loadMap(e.from, n);
      !this.mapFile && e.from && (this.mapFile = e.from), this.mapFile && (this.root = x(this.mapFile)), t && (this.text = t);
    }
    consumer() {
      return this.consumerCache || (this.consumerCache = new f(this.text)), this.consumerCache;
    }
    decodeInline(o) {
      let e = /^data:application\/json;charset=utf-?8;base64,/, n = /^data:application\/json;base64,/, t = /^data:application\/json;charset=utf-?8,/, r = /^data:application\/json,/, i = o.match(t) || o.match(r);
      if (i)
        return decodeURIComponent(o.substr(i[0].length));
      let a = o.match(e) || o.match(n);
      if (a)
        return l(o.substr(a[0].length));
      let h = o.match(/data:application\/json;([^,]+),/)[1];
      throw new Error("Unsupported source map encoding " + h);
    }
    getAnnotationURL(o) {
      return o.replace(/^\/\*\s*# sourceMappingURL=/, "").trim();
    }
    isMap(o) {
      return typeof o != "object" ? !1 : typeof o.mappings == "string" || typeof o._mappings == "string" || Array.isArray(o.sections);
    }
    loadAnnotation(o) {
      let e = o.match(/\/\*\s*# sourceMappingURL=/g);
      if (!e) return;
      let n = o.lastIndexOf(e.pop()), t = o.indexOf("*/", n);
      n > -1 && t > -1 && (this.annotation = this.getAnnotationURL(o.substring(n, t)));
    }
    loadFile(o) {
      if (this.root = x(o), p(o))
        return this.mapFile = o, w(o, "utf-8").toString().trim();
    }
    loadMap(o, e) {
      if (e === !1) return !1;
      if (e) {
        if (typeof e == "string")
          return e;
        if (typeof e == "function") {
          let n = e(o);
          if (n) {
            let t = this.loadFile(n);
            if (!t)
              throw new Error(
                "Unable to load previous source map: " + n.toString()
              );
            return t;
          }
        } else {
          if (e instanceof f)
            return c.fromSourceMap(e).toString();
          if (e instanceof c)
            return e.toString();
          if (this.isMap(e))
            return JSON.stringify(e);
          throw new Error(
            "Unsupported previous source map format: " + e.toString()
          );
        }
      } else {
        if (this.inline)
          return this.decodeInline(this.annotation);
        if (this.annotation) {
          let n = this.annotation;
          return o && (n = b(x(o), n)), this.loadFile(n);
        }
      }
    }
    startWith(o, e) {
      return o ? o.substr(0, e.length) === e : !1;
    }
    withContent() {
      return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    }
  }
  return _e = u, u.default = u, _e;
}
var xe, _t;
function ee() {
  if (_t) return xe;
  _t = 1;
  let { nanoid: p } = /* @__PURE__ */ ir(), { isAbsolute: w, resolve: x } = Be, { SourceMapConsumer: b, SourceMapGenerator: f } = We(), { fileURLToPath: c, pathToFileURL: l } = Ut, u = Fe(), s = Jt(), o = zt(), e = /* @__PURE__ */ Symbol("lineToIndexCache"), n = !!(b && f), t = !!(x && w);
  function r(a) {
    if (a[e]) return a[e];
    let h = a.css.split(`
`), y = new Array(h.length), d = 0;
    for (let _ = 0, A = h.length; _ < A; _++)
      y[_] = d, d += h[_].length + 1;
    return a[e] = y, y;
  }
  class i {
    get from() {
      return this.file || this.id;
    }
    constructor(h, y = {}) {
      if (h === null || typeof h > "u" || typeof h == "object" && !h.toString)
        throw new Error(`PostCSS received ${h} instead of CSS string`);
      if (this.css = h.toString(), this.css[0] === "\uFEFF" || this.css[0] === "￾" ? (this.hasBOM = !0, this.css = this.css.slice(1)) : this.hasBOM = !1, this.document = this.css, y.document && (this.document = y.document.toString()), y.from && (!t || /^\w+:\/\//.test(y.from) || w(y.from) ? this.file = y.from : this.file = x(y.from)), t && n) {
        let d = new s(this.css, y);
        if (d.text) {
          this.map = d;
          let _ = d.consumer().file;
          !this.file && _ && (this.file = this.mapResolve(_));
        }
      }
      this.file || (this.id = "<input css " + p(6) + ">"), this.map && (this.map.file = this.from);
    }
    error(h, y, d, _ = {}) {
      let A, v, C, R, m;
      if (y && typeof y == "object") {
        let S = y, O = d;
        if (typeof S.offset == "number") {
          R = S.offset;
          let L = this.fromOffset(R);
          y = L.line, d = L.col;
        } else
          y = S.line, d = S.column, R = this.fromLineAndColumn(y, d);
        if (typeof O.offset == "number") {
          C = O.offset;
          let L = this.fromOffset(C);
          v = L.line, A = L.col;
        } else
          v = O.line, A = O.column, C = this.fromLineAndColumn(O.line, O.column);
      } else if (d)
        R = this.fromLineAndColumn(y, d);
      else {
        R = y;
        let S = this.fromOffset(R);
        y = S.line, d = S.col;
      }
      let g = this.origin(y, d, v, A);
      return g ? m = new u(
        h,
        g.endLine === void 0 ? g.line : { column: g.column, line: g.line },
        g.endLine === void 0 ? g.column : { column: g.endColumn, line: g.endLine },
        g.source,
        g.file,
        _.plugin
      ) : m = new u(
        h,
        v === void 0 ? y : { column: d, line: y },
        v === void 0 ? d : { column: A, line: v },
        this.css,
        this.file,
        _.plugin
      ), m.input = { column: d, endColumn: A, endLine: v, endOffset: C, line: y, offset: R, source: this.css }, this.file && (l && (m.input.url = l(this.file).toString()), m.input.file = this.file), m;
    }
    fromLineAndColumn(h, y) {
      return r(this)[h - 1] + y - 1;
    }
    fromOffset(h) {
      let y = r(this), d = y[y.length - 1], _ = 0;
      if (h >= d)
        _ = y.length - 1;
      else {
        let A = y.length - 2, v;
        for (; _ < A; )
          if (v = _ + (A - _ >> 1), h < y[v])
            A = v - 1;
          else if (h >= y[v + 1])
            _ = v + 1;
          else {
            _ = v;
            break;
          }
      }
      return {
        col: h - y[_] + 1,
        line: _ + 1
      };
    }
    mapResolve(h) {
      return /^\w+:\/\//.test(h) ? h : x(this.map.consumer().sourceRoot || this.map.root || ".", h);
    }
    origin(h, y, d, _) {
      if (!this.map) return !1;
      let A = this.map.consumer(), v = A.originalPositionFor({ column: y, line: h });
      if (!v.source) return !1;
      let C;
      typeof d == "number" && (C = A.originalPositionFor({ column: _, line: d }));
      let R;
      w(v.source) ? R = l(v.source) : R = new URL(
        v.source,
        this.map.consumer().sourceRoot || l(this.map.mapFile)
      );
      let m = {
        column: v.column,
        endColumn: C && C.column,
        endLine: C && C.line,
        line: v.line,
        url: R.toString()
      };
      if (R.protocol === "file:")
        if (c)
          m.file = c(R);
        else
          throw new Error("file: protocol is not available in this PostCSS build");
      let g = A.sourceContentFor(v.source);
      return g && (m.source = g), m;
    }
    toJSON() {
      let h = {};
      for (let y of ["hasBOM", "css", "file", "id"])
        this[y] != null && (h[y] = this[y]);
      return this.map && (h.map = { ...this.map }, h.map.consumerCache && (h.map.consumerCache = void 0)), h;
    }
  }
  return xe = i, i.default = i, o && o.registerInput && o.registerInput(i), xe;
}
var Oe, xt;
function W() {
  if (xt) return Oe;
  xt = 1;
  let p = U(), w, x;
  class b extends p {
    constructor(c) {
      super(c), this.type = "root", this.nodes || (this.nodes = []);
    }
    normalize(c, l, u) {
      let s = super.normalize(c);
      if (l) {
        if (u === "prepend")
          this.nodes.length > 1 ? l.raws.before = this.nodes[1].raws.before : delete l.raws.before;
        else if (this.first !== l)
          for (let o of s)
            o.raws.before = l.raws.before;
      }
      return s;
    }
    removeChild(c, l) {
      let u = this.index(c);
      return !l && u === 0 && this.nodes.length > 1 && (this.nodes[1].raws.before = this.nodes[u].raws.before), super.removeChild(c);
    }
    toResult(c = {}) {
      return new w(new x(), this, c).stringify();
    }
  }
  return b.registerLazyResult = (f) => {
    w = f;
  }, b.registerProcessor = (f) => {
    x = f;
  }, Oe = b, b.default = b, p.registerRoot(b), Oe;
}
var Re, Ot;
function Qt() {
  if (Ot) return Re;
  Ot = 1;
  let p = {
    comma(w) {
      return p.split(w, [","], !0);
    },
    space(w) {
      let x = [" ", `
`, "	"];
      return p.split(w, x);
    },
    split(w, x, b) {
      let f = [], c = "", l = !1, u = 0, s = !1, o = "", e = !1;
      for (let n of w)
        e ? e = !1 : n === "\\" ? e = !0 : s ? n === o && (s = !1) : n === '"' || n === "'" ? (s = !0, o = n) : n === "(" ? u += 1 : n === ")" ? u > 0 && (u -= 1) : u === 0 && x.includes(n) && (l = !0), l ? (c !== "" && f.push(c.trim()), c = "", l = !1) : c += n;
      return (b || c !== "") && f.push(c.trim()), f;
    }
  };
  return Re = p, p.default = p, Re;
}
var Ae, Rt;
function Ve() {
  if (Rt) return Ae;
  Rt = 1;
  let p = U(), w = Qt();
  class x extends p {
    get selectors() {
      return w.comma(this.selector);
    }
    set selectors(f) {
      let c = this.selector ? this.selector.match(/,\s*/) : null, l = c ? c[0] : "," + this.raw("between", "beforeOpen");
      this.selector = f.join(l);
    }
    constructor(f) {
      super(f), this.type = "rule", this.nodes || (this.nodes = []);
    }
  }
  return Ae = x, x.default = x, p.registerRule(x), Ae;
}
var Ee, At;
function cr() {
  if (At) return Ee;
  At = 1;
  let p = Ge(), w = X(), x = Z(), b = ee(), f = Jt(), c = W(), l = Ve();
  function u(s, o) {
    if (Array.isArray(s)) return s.map((t) => u(t));
    let { inputs: e, ...n } = s;
    if (e) {
      o = [];
      for (let t of e) {
        let r = { ...t, __proto__: b.prototype };
        r.map && (r.map = {
          ...r.map,
          __proto__: f.prototype
        }), o.push(r);
      }
    }
    if (n.nodes && (n.nodes = s.nodes.map((t) => u(t, o))), n.source) {
      let { inputId: t, ...r } = n.source;
      n.source = r, t != null && (n.source.input = o[t]);
    }
    if (n.type === "root")
      return new c(n);
    if (n.type === "decl")
      return new x(n);
    if (n.type === "rule")
      return new l(n);
    if (n.type === "comment")
      return new w(n);
    if (n.type === "atrule")
      return new p(n);
    throw new Error("Unknown node type: " + s.type);
  }
  return Ee = u, u.default = u, Ee;
}
var Me, Et;
function $t() {
  if (Et) return Me;
  Et = 1;
  let { dirname: p, relative: w, resolve: x, sep: b } = Be, { SourceMapConsumer: f, SourceMapGenerator: c } = We(), { pathToFileURL: l } = Ut, u = ee(), s = !!(f && c), o = !!(p && x && w && b);
  class e {
    constructor(t, r, i, a) {
      this.stringify = t, this.mapOpts = i.map || {}, this.root = r, this.opts = i, this.css = a, this.originalCSS = a, this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute, this.memoizedFileURLs = /* @__PURE__ */ new Map(), this.memoizedPaths = /* @__PURE__ */ new Map(), this.memoizedURLs = /* @__PURE__ */ new Map();
    }
    addAnnotation() {
      let t;
      this.isInline() ? t = "data:application/json;base64," + this.toBase64(this.map.toString()) : typeof this.mapOpts.annotation == "string" ? t = this.mapOpts.annotation : typeof this.mapOpts.annotation == "function" ? t = this.mapOpts.annotation(this.opts.to, this.root) : t = this.outputFile() + ".map";
      let r = `
`;
      this.css.includes(`\r
`) && (r = `\r
`), this.css += r + "/*# sourceMappingURL=" + t + " */";
    }
    applyPrevMaps() {
      for (let t of this.previous()) {
        let r = this.toUrl(this.path(t.file)), i = t.root || p(t.file), a;
        this.mapOpts.sourcesContent === !1 ? (a = new f(t.text), a.sourcesContent && (a.sourcesContent = null)) : a = t.consumer(), this.map.applySourceMap(a, r, this.toUrl(this.path(i)));
      }
    }
    clearAnnotation() {
      if (this.mapOpts.annotation !== !1)
        if (this.root) {
          let t;
          for (let r = this.root.nodes.length - 1; r >= 0; r--)
            t = this.root.nodes[r], t.type === "comment" && t.text.startsWith("# sourceMappingURL=") && this.root.removeChild(r);
        } else this.css && (this.css = this.css.replace(/\n*\/\*#[\S\s]*?\*\/$/gm, ""));
    }
    generate() {
      if (this.clearAnnotation(), o && s && this.isMap())
        return this.generateMap();
      {
        let t = "";
        return this.stringify(this.root, (r) => {
          t += r;
        }), [t];
      }
    }
    generateMap() {
      if (this.root)
        this.generateString();
      else if (this.previous().length === 1) {
        let t = this.previous()[0].consumer();
        t.file = this.outputFile(), this.map = c.fromSourceMap(t, {
          ignoreInvalidMapping: !0
        });
      } else
        this.map = new c({
          file: this.outputFile(),
          ignoreInvalidMapping: !0
        }), this.map.addMapping({
          generated: { column: 0, line: 1 },
          original: { column: 0, line: 1 },
          source: this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>"
        });
      return this.isSourcesContent() && this.setSourcesContent(), this.root && this.previous().length > 0 && this.applyPrevMaps(), this.isAnnotation() && this.addAnnotation(), this.isInline() ? [this.css] : [this.css, this.map];
    }
    generateString() {
      this.css = "", this.map = new c({
        file: this.outputFile(),
        ignoreInvalidMapping: !0
      });
      let t = 1, r = 1, i = "<no source>", a = {
        generated: { column: 0, line: 0 },
        original: { column: 0, line: 0 },
        source: ""
      }, h, y;
      this.stringify(this.root, (d, _, A) => {
        if (this.css += d, _ && A !== "end" && (a.generated.line = t, a.generated.column = r - 1, _.source && _.source.start ? (a.source = this.sourcePath(_), a.original.line = _.source.start.line, a.original.column = _.source.start.column - 1, this.map.addMapping(a)) : (a.source = i, a.original.line = 1, a.original.column = 0, this.map.addMapping(a))), y = d.match(/\n/g), y ? (t += y.length, h = d.lastIndexOf(`
`), r = d.length - h) : r += d.length, _ && A !== "start") {
          let v = _.parent || { raws: {} };
          (!(_.type === "decl" || _.type === "atrule" && !_.nodes) || _ !== v.last || v.raws.semicolon) && (_.source && _.source.end ? (a.source = this.sourcePath(_), a.original.line = _.source.end.line, a.original.column = _.source.end.column - 1, a.generated.line = t, a.generated.column = r - 2, this.map.addMapping(a)) : (a.source = i, a.original.line = 1, a.original.column = 0, a.generated.line = t, a.generated.column = r - 1, this.map.addMapping(a)));
        }
      });
    }
    isAnnotation() {
      return this.isInline() ? !0 : typeof this.mapOpts.annotation < "u" ? this.mapOpts.annotation : this.previous().length ? this.previous().some((t) => t.annotation) : !0;
    }
    isInline() {
      if (typeof this.mapOpts.inline < "u")
        return this.mapOpts.inline;
      let t = this.mapOpts.annotation;
      return typeof t < "u" && t !== !0 ? !1 : this.previous().length ? this.previous().some((r) => r.inline) : !0;
    }
    isMap() {
      return typeof this.opts.map < "u" ? !!this.opts.map : this.previous().length > 0;
    }
    isSourcesContent() {
      return typeof this.mapOpts.sourcesContent < "u" ? this.mapOpts.sourcesContent : this.previous().length ? this.previous().some((t) => t.withContent()) : !0;
    }
    outputFile() {
      return this.opts.to ? this.path(this.opts.to) : this.opts.from ? this.path(this.opts.from) : "to.css";
    }
    path(t) {
      if (this.mapOpts.absolute || t.charCodeAt(0) === 60 || /^\w+:\/\//.test(t)) return t;
      let r = this.memoizedPaths.get(t);
      if (r) return r;
      let i = this.opts.to ? p(this.opts.to) : ".";
      typeof this.mapOpts.annotation == "string" && (i = p(x(i, this.mapOpts.annotation)));
      let a = w(i, t);
      return this.memoizedPaths.set(t, a), a;
    }
    previous() {
      if (!this.previousMaps)
        if (this.previousMaps = [], this.root)
          this.root.walk((t) => {
            if (t.source && t.source.input.map) {
              let r = t.source.input.map;
              this.previousMaps.includes(r) || this.previousMaps.push(r);
            }
          });
        else {
          let t = new u(this.originalCSS, this.opts);
          t.map && this.previousMaps.push(t.map);
        }
      return this.previousMaps;
    }
    setSourcesContent() {
      let t = {};
      if (this.root)
        this.root.walk((r) => {
          if (r.source) {
            let i = r.source.input.from;
            if (i && !t[i]) {
              t[i] = !0;
              let a = this.usesFileUrls ? this.toFileUrl(i) : this.toUrl(this.path(i));
              this.map.setSourceContent(a, r.source.input.css);
            }
          }
        });
      else if (this.css) {
        let r = this.opts.from ? this.toUrl(this.path(this.opts.from)) : "<no source>";
        this.map.setSourceContent(r, this.css);
      }
    }
    sourcePath(t) {
      return this.mapOpts.from ? this.toUrl(this.mapOpts.from) : this.usesFileUrls ? this.toFileUrl(t.source.input.from) : this.toUrl(this.path(t.source.input.from));
    }
    toBase64(t) {
      return Buffer ? Buffer.from(t).toString("base64") : window.btoa(unescape(encodeURIComponent(t)));
    }
    toFileUrl(t) {
      let r = this.memoizedFileURLs.get(t);
      if (r) return r;
      if (l) {
        let i = l(t).toString();
        return this.memoizedFileURLs.set(t, i), i;
      } else
        throw new Error(
          "`map.absolute` option is not available in this PostCSS build"
        );
    }
    toUrl(t) {
      let r = this.memoizedURLs.get(t);
      if (r) return r;
      b === "\\" && (t = t.replace(/\\/g, "/"));
      let i = encodeURI(t).replace(/[#?]/g, encodeURIComponent);
      return this.memoizedURLs.set(t, i), i;
    }
  }
  return Me = e, Me;
}
var Le, Mt;
function hr() {
  if (Mt) return Le;
  Mt = 1;
  let p = Ge(), w = X(), x = Z(), b = W(), f = Ve(), c = Ft();
  const l = {
    empty: !0,
    space: !0
  };
  function u(o) {
    for (let e = o.length - 1; e >= 0; e--) {
      let n = o[e], t = n[3] || n[2];
      if (t) return t;
    }
  }
  class s {
    constructor(e) {
      this.input = e, this.root = new b(), this.current = this.root, this.spaces = "", this.semicolon = !1, this.createTokenizer(), this.root.source = { input: e, start: { column: 1, line: 1, offset: 0 } };
    }
    atrule(e) {
      let n = new p();
      n.name = e[1].slice(1), n.name === "" && this.unnamedAtrule(n, e), this.init(n, e[2]);
      let t, r, i, a = !1, h = !1, y = [], d = [];
      for (; !this.tokenizer.endOfFile(); ) {
        if (e = this.tokenizer.nextToken(), t = e[0], t === "(" || t === "[" ? d.push(t === "(" ? ")" : "]") : t === "{" && d.length > 0 ? d.push("}") : t === d[d.length - 1] && d.pop(), d.length === 0)
          if (t === ";") {
            n.source.end = this.getPosition(e[2]), n.source.end.offset++, this.semicolon = !0;
            break;
          } else if (t === "{") {
            h = !0;
            break;
          } else if (t === "}") {
            if (y.length > 0) {
              for (i = y.length - 1, r = y[i]; r && r[0] === "space"; )
                r = y[--i];
              r && (n.source.end = this.getPosition(r[3] || r[2]), n.source.end.offset++);
            }
            this.end(e);
            break;
          } else
            y.push(e);
        else
          y.push(e);
        if (this.tokenizer.endOfFile()) {
          a = !0;
          break;
        }
      }
      n.raws.between = this.spacesAndCommentsFromEnd(y), y.length ? (n.raws.afterName = this.spacesAndCommentsFromStart(y), this.raw(n, "params", y), a && (e = y[y.length - 1], n.source.end = this.getPosition(e[3] || e[2]), n.source.end.offset++, this.spaces = n.raws.between, n.raws.between = "")) : (n.raws.afterName = "", n.params = ""), h && (n.nodes = [], this.current = n);
    }
    checkMissedSemicolon(e) {
      let n = this.colon(e);
      if (n === !1) return;
      let t = 0, r;
      for (let i = n - 1; i >= 0 && (r = e[i], !(r[0] !== "space" && (t += 1, t === 2))); i--)
        ;
      throw this.input.error(
        "Missed semicolon",
        r[0] === "word" ? r[3] + 1 : r[2]
      );
    }
    colon(e) {
      let n = 0, t, r, i;
      for (let [a, h] of e.entries()) {
        if (r = h, i = r[0], i === "(" && (n += 1), i === ")" && (n -= 1), n === 0 && i === ":")
          if (!t)
            this.doubleColon(r);
          else {
            if (t[0] === "word" && t[1] === "progid")
              continue;
            return a;
          }
        t = r;
      }
      return !1;
    }
    comment(e) {
      let n = new w();
      this.init(n, e[2]), n.source.end = this.getPosition(e[3] || e[2]), n.source.end.offset++;
      let t = e[1].slice(2, -2);
      if (/^\s*$/.test(t))
        n.text = "", n.raws.left = t, n.raws.right = "";
      else {
        let r = t.match(/^(\s*)([^]*\S)(\s*)$/);
        n.text = r[2], n.raws.left = r[1], n.raws.right = r[3];
      }
    }
    createTokenizer() {
      this.tokenizer = c(this.input);
    }
    decl(e, n) {
      let t = new x();
      this.init(t, e[0][2]);
      let r = e[e.length - 1];
      for (r[0] === ";" && (this.semicolon = !0, e.pop()), t.source.end = this.getPosition(
        r[3] || r[2] || u(e)
      ), t.source.end.offset++; e[0][0] !== "word"; )
        e.length === 1 && this.unknownWord(e), t.raws.before += e.shift()[1];
      for (t.source.start = this.getPosition(e[0][2]), t.prop = ""; e.length; ) {
        let d = e[0][0];
        if (d === ":" || d === "space" || d === "comment")
          break;
        t.prop += e.shift()[1];
      }
      t.raws.between = "";
      let i;
      for (; e.length; )
        if (i = e.shift(), i[0] === ":") {
          t.raws.between += i[1];
          break;
        } else
          i[0] === "word" && /\w/.test(i[1]) && this.unknownWord([i]), t.raws.between += i[1];
      (t.prop[0] === "_" || t.prop[0] === "*") && (t.raws.before += t.prop[0], t.prop = t.prop.slice(1));
      let a = [], h;
      for (; e.length && (h = e[0][0], !(h !== "space" && h !== "comment")); )
        a.push(e.shift());
      this.precheckMissedSemicolon(e);
      for (let d = e.length - 1; d >= 0; d--) {
        if (i = e[d], i[1].toLowerCase() === "!important") {
          t.important = !0;
          let _ = this.stringFrom(e, d);
          _ = this.spacesFromEnd(e) + _, _ !== " !important" && (t.raws.important = _);
          break;
        } else if (i[1].toLowerCase() === "important") {
          let _ = e.slice(0), A = "";
          for (let v = d; v > 0; v--) {
            let C = _[v][0];
            if (A.trim().startsWith("!") && C !== "space")
              break;
            A = _.pop()[1] + A;
          }
          A.trim().startsWith("!") && (t.important = !0, t.raws.important = A, e = _);
        }
        if (i[0] !== "space" && i[0] !== "comment")
          break;
      }
      e.some((d) => d[0] !== "space" && d[0] !== "comment") && (t.raws.between += a.map((d) => d[1]).join(""), a = []), this.raw(t, "value", a.concat(e), n), t.value.includes(":") && !n && this.checkMissedSemicolon(e);
    }
    doubleColon(e) {
      throw this.input.error(
        "Double colon",
        { offset: e[2] },
        { offset: e[2] + e[1].length }
      );
    }
    emptyRule(e) {
      let n = new f();
      this.init(n, e[2]), n.selector = "", n.raws.between = "", this.current = n;
    }
    end(e) {
      this.current.nodes && this.current.nodes.length && (this.current.raws.semicolon = this.semicolon), this.semicolon = !1, this.current.raws.after = (this.current.raws.after || "") + this.spaces, this.spaces = "", this.current.parent ? (this.current.source.end = this.getPosition(e[2]), this.current.source.end.offset++, this.current = this.current.parent) : this.unexpectedClose(e);
    }
    endFile() {
      this.current.parent && this.unclosedBlock(), this.current.nodes && this.current.nodes.length && (this.current.raws.semicolon = this.semicolon), this.current.raws.after = (this.current.raws.after || "") + this.spaces, this.root.source.end = this.getPosition(this.tokenizer.position());
    }
    freeSemicolon(e) {
      if (this.spaces += e[1], this.current.nodes) {
        let n = this.current.nodes[this.current.nodes.length - 1];
        n && n.type === "rule" && !n.raws.ownSemicolon && (n.raws.ownSemicolon = this.spaces, this.spaces = "", n.source.end = this.getPosition(e[2]), n.source.end.offset += n.raws.ownSemicolon.length);
      }
    }
    // Helpers
    getPosition(e) {
      let n = this.input.fromOffset(e);
      return {
        column: n.col,
        line: n.line,
        offset: e
      };
    }
    init(e, n) {
      this.current.push(e), e.source = {
        input: this.input,
        start: this.getPosition(n)
      }, e.raws.before = this.spaces, this.spaces = "", e.type !== "comment" && (this.semicolon = !1);
    }
    other(e) {
      let n = !1, t = null, r = !1, i = null, a = [], h = e[1].startsWith("--"), y = [], d = e;
      for (; d; ) {
        if (t = d[0], y.push(d), t === "(" || t === "[")
          i || (i = d), a.push(t === "(" ? ")" : "]");
        else if (h && r && t === "{")
          i || (i = d), a.push("}");
        else if (a.length === 0)
          if (t === ";")
            if (r) {
              this.decl(y, h);
              return;
            } else
              break;
          else if (t === "{") {
            this.rule(y);
            return;
          } else if (t === "}") {
            this.tokenizer.back(y.pop()), n = !0;
            break;
          } else t === ":" && (r = !0);
        else t === a[a.length - 1] && (a.pop(), a.length === 0 && (i = null));
        d = this.tokenizer.nextToken();
      }
      if (this.tokenizer.endOfFile() && (n = !0), a.length > 0 && this.unclosedBracket(i), n && r) {
        if (!h)
          for (; y.length && (d = y[y.length - 1][0], !(d !== "space" && d !== "comment")); )
            this.tokenizer.back(y.pop());
        this.decl(y, h);
      } else
        this.unknownWord(y);
    }
    parse() {
      let e;
      for (; !this.tokenizer.endOfFile(); )
        switch (e = this.tokenizer.nextToken(), e[0]) {
          case "space":
            this.spaces += e[1];
            break;
          case ";":
            this.freeSemicolon(e);
            break;
          case "}":
            this.end(e);
            break;
          case "comment":
            this.comment(e);
            break;
          case "at-word":
            this.atrule(e);
            break;
          case "{":
            this.emptyRule(e);
            break;
          default:
            this.other(e);
            break;
        }
      this.endFile();
    }
    precheckMissedSemicolon() {
    }
    raw(e, n, t, r) {
      let i, a, h = t.length, y = "", d = !0, _, A;
      for (let v = 0; v < h; v += 1)
        i = t[v], a = i[0], a === "space" && v === h - 1 && !r ? d = !1 : a === "comment" ? (A = t[v - 1] ? t[v - 1][0] : "empty", _ = t[v + 1] ? t[v + 1][0] : "empty", !l[A] && !l[_] ? y.slice(-1) === "," ? d = !1 : y += i[1] : d = !1) : y += i[1];
      if (!d) {
        let v = t.reduce((C, R) => C + R[1], "");
        e.raws[n] = { raw: v, value: y };
      }
      e[n] = y;
    }
    rule(e) {
      e.pop();
      let n = new f();
      this.init(n, e[0][2]), n.raws.between = this.spacesAndCommentsFromEnd(e), this.raw(n, "selector", e), this.current = n;
    }
    spacesAndCommentsFromEnd(e) {
      let n, t = "";
      for (; e.length && (n = e[e.length - 1][0], !(n !== "space" && n !== "comment")); )
        t = e.pop()[1] + t;
      return t;
    }
    // Errors
    spacesAndCommentsFromStart(e) {
      let n, t = "";
      for (; e.length && (n = e[0][0], !(n !== "space" && n !== "comment")); )
        t += e.shift()[1];
      return t;
    }
    spacesFromEnd(e) {
      let n, t = "";
      for (; e.length && (n = e[e.length - 1][0], n === "space"); )
        t = e.pop()[1] + t;
      return t;
    }
    stringFrom(e, n) {
      let t = "";
      for (let r = n; r < e.length; r++)
        t += e[r][1];
      return e.splice(n, e.length - n), t;
    }
    unclosedBlock() {
      let e = this.current.source.start;
      throw this.input.error("Unclosed block", e.line, e.column);
    }
    unclosedBracket(e) {
      throw this.input.error(
        "Unclosed bracket",
        { offset: e[2] },
        { offset: e[2] + 1 }
      );
    }
    unexpectedClose(e) {
      throw this.input.error(
        "Unexpected }",
        { offset: e[2] },
        { offset: e[2] + 1 }
      );
    }
    unknownWord(e) {
      throw this.input.error(
        "Unknown word " + e[0][1],
        { offset: e[0][2] },
        { offset: e[0][2] + e[0][1].length }
      );
    }
    unnamedAtrule(e, n) {
      throw this.input.error(
        "At-rule without name",
        { offset: n[2] },
        { offset: n[2] + n[1].length }
      );
    }
  }
  return Le = s, Le;
}
var Pe, Lt;
function Je() {
  if (Lt) return Pe;
  Lt = 1;
  let p = U(), w = ee(), x = hr();
  function b(f, c) {
    let l = new w(f, c), u = new x(l);
    try {
      u.parse();
    } catch (s) {
      throw process.env.NODE_ENV !== "production" && s.name === "CssSyntaxError" && c && c.from && (/\.scss$/i.test(c.from) ? s.message += `
You tried to parse SCSS with the standard CSS parser; try again with the postcss-scss parser` : /\.sass/i.test(c.from) ? s.message += `
You tried to parse Sass with the standard CSS parser; try again with the postcss-sass parser` : /\.less$/i.test(c.from) && (s.message += `
You tried to parse Less with the standard CSS parser; try again with the postcss-less parser`)), s;
    }
    return u.root;
  }
  return Pe = b, b.default = b, p.registerParse(b), Pe;
}
var Ie, Pt;
function Yt() {
  if (Pt) return Ie;
  Pt = 1;
  class p {
    constructor(x, b = {}) {
      if (this.type = "warning", this.text = x, b.node && b.node.source) {
        let f = b.node.rangeBy(b);
        this.line = f.start.line, this.column = f.start.column, this.endLine = f.end.line, this.endColumn = f.end.column;
      }
      for (let f in b) this[f] = b[f];
    }
    toString() {
      return this.node ? this.node.error(this.text, {
        index: this.index,
        plugin: this.plugin,
        word: this.word
      }).message : this.plugin ? this.plugin + ": " + this.text : this.text;
    }
  }
  return Ie = p, p.default = p, Ie;
}
var Ne, It;
function Qe() {
  if (It) return Ne;
  It = 1;
  let p = Yt();
  class w {
    get content() {
      return this.css;
    }
    constructor(b, f, c) {
      this.processor = b, this.messages = [], this.root = f, this.opts = c, this.css = "", this.map = void 0;
    }
    toString() {
      return this.css;
    }
    warn(b, f = {}) {
      f.plugin || this.lastPlugin && this.lastPlugin.postcssPlugin && (f.plugin = this.lastPlugin.postcssPlugin);
      let c = new p(b, f);
      return this.messages.push(c), c;
    }
    warnings() {
      return this.messages.filter((b) => b.type === "warning");
    }
  }
  return Ne = w, w.default = w, Ne;
}
var ke, Nt;
function Ht() {
  if (Nt) return ke;
  Nt = 1;
  let p = {};
  return ke = function(x) {
    p[x] || (p[x] = !0, typeof console < "u" && console.warn && console.warn(x));
  }, ke;
}
var qe, kt;
function Kt() {
  if (kt) return qe;
  kt = 1;
  let p = U(), w = je(), x = $t(), b = Je(), f = Qe(), c = W(), l = H(), { isClean: u, my: s } = ze(), o = Ht();
  const e = {
    atrule: "AtRule",
    comment: "Comment",
    decl: "Declaration",
    document: "Document",
    root: "Root",
    rule: "Rule"
  }, n = {
    AtRule: !0,
    AtRuleExit: !0,
    Comment: !0,
    CommentExit: !0,
    Declaration: !0,
    DeclarationExit: !0,
    Document: !0,
    DocumentExit: !0,
    Once: !0,
    OnceExit: !0,
    postcssPlugin: !0,
    prepare: !0,
    Root: !0,
    RootExit: !0,
    Rule: !0,
    RuleExit: !0
  }, t = {
    Once: !0,
    postcssPlugin: !0,
    prepare: !0
  }, r = 0;
  function i(A) {
    return typeof A == "object" && typeof A.then == "function";
  }
  function a(A) {
    let v = !1, C = e[A.type];
    return A.type === "decl" ? v = A.prop.toLowerCase() : A.type === "atrule" && (v = A.name.toLowerCase()), v && A.append ? [
      C,
      C + "-" + v,
      r,
      C + "Exit",
      C + "Exit-" + v
    ] : v ? [C, C + "-" + v, C + "Exit", C + "Exit-" + v] : A.append ? [C, r, C + "Exit"] : [C, C + "Exit"];
  }
  function h(A) {
    let v;
    return A.type === "document" ? v = ["Document", r, "DocumentExit"] : A.type === "root" ? v = ["Root", r, "RootExit"] : v = a(A), {
      eventIndex: 0,
      events: v,
      iterator: 0,
      node: A,
      visitorIndex: 0,
      visitors: []
    };
  }
  function y(A) {
    return A[u] = !1, A.nodes && A.nodes.forEach((v) => y(v)), A;
  }
  let d = {};
  class _ {
    get content() {
      return this.stringify().content;
    }
    get css() {
      return this.stringify().css;
    }
    get map() {
      return this.stringify().map;
    }
    get messages() {
      return this.sync().messages;
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      return this.sync().root;
    }
    get [Symbol.toStringTag]() {
      return "LazyResult";
    }
    constructor(v, C, R) {
      this.stringified = !1, this.processed = !1;
      let m;
      if (typeof C == "object" && C !== null && (C.type === "root" || C.type === "document"))
        m = y(C);
      else if (C instanceof _ || C instanceof f)
        m = y(C.root), C.map && (typeof R.map > "u" && (R.map = {}), R.map.inline || (R.map.inline = !1), R.map.prev = C.map);
      else {
        let g = b;
        R.syntax && (g = R.syntax.parse), R.parser && (g = R.parser), g.parse && (g = g.parse);
        try {
          m = g(C, R);
        } catch (S) {
          this.processed = !0, this.error = S;
        }
        m && !m[s] && p.rebuild(m);
      }
      this.result = new f(v, m, R), this.helpers = { ...d, postcss: d, result: this.result }, this.plugins = this.processor.plugins.map((g) => typeof g == "object" && g.prepare ? { ...g, ...g.prepare(this.result) } : g);
    }
    async() {
      return this.error ? Promise.reject(this.error) : this.processed ? Promise.resolve(this.result) : (this.processing || (this.processing = this.runAsync()), this.processing);
    }
    catch(v) {
      return this.async().catch(v);
    }
    finally(v) {
      return this.async().then(v, v);
    }
    getAsyncError() {
      throw new Error("Use process(css).then(cb) to work with async plugins");
    }
    handleError(v, C) {
      let R = this.result.lastPlugin;
      try {
        if (C && C.addToError(v), this.error = v, v.name === "CssSyntaxError" && !v.plugin)
          v.plugin = R.postcssPlugin, v.setMessage();
        else if (R.postcssVersion && process.env.NODE_ENV !== "production") {
          let m = R.postcssPlugin, g = R.postcssVersion, S = this.result.processor.version, O = g.split("."), L = S.split(".");
          (O[0] !== L[0] || parseInt(O[1]) > parseInt(L[1])) && console.error(
            "Unknown error from PostCSS plugin. Your current PostCSS version is " + S + ", but " + m + " uses " + g + ". Perhaps this is the source of the error below."
          );
        }
      } catch (m) {
        console && console.error && console.error(m);
      }
      return v;
    }
    prepareVisitors() {
      this.listeners = {};
      let v = (C, R, m) => {
        this.listeners[R] || (this.listeners[R] = []), this.listeners[R].push([C, m]);
      };
      for (let C of this.plugins)
        if (typeof C == "object")
          for (let R in C) {
            if (!n[R] && /^[A-Z]/.test(R))
              throw new Error(
                `Unknown event ${R} in ${C.postcssPlugin}. Try to update PostCSS (${this.processor.version} now).`
              );
            if (!t[R])
              if (typeof C[R] == "object")
                for (let m in C[R])
                  m === "*" ? v(C, R, C[R][m]) : v(
                    C,
                    R + "-" + m.toLowerCase(),
                    C[R][m]
                  );
              else typeof C[R] == "function" && v(C, R, C[R]);
          }
      this.hasListener = Object.keys(this.listeners).length > 0;
    }
    async runAsync() {
      this.plugin = 0;
      for (let v = 0; v < this.plugins.length; v++) {
        let C = this.plugins[v], R = this.runOnRoot(C);
        if (i(R))
          try {
            await R;
          } catch (m) {
            throw this.handleError(m);
          }
      }
      if (this.prepareVisitors(), this.hasListener) {
        let v = this.result.root;
        for (; !v[u]; ) {
          v[u] = !0;
          let C = [h(v)];
          for (; C.length > 0; ) {
            let R = this.visitTick(C);
            if (i(R))
              try {
                await R;
              } catch (m) {
                let g = C[C.length - 1].node;
                throw this.handleError(m, g);
              }
          }
        }
        if (this.listeners.OnceExit)
          for (let [C, R] of this.listeners.OnceExit) {
            this.result.lastPlugin = C;
            try {
              if (v.type === "document") {
                let m = v.nodes.map(
                  (g) => R(g, this.helpers)
                );
                await Promise.all(m);
              } else
                await R(v, this.helpers);
            } catch (m) {
              throw this.handleError(m);
            }
          }
      }
      return this.processed = !0, this.stringify();
    }
    runOnRoot(v) {
      this.result.lastPlugin = v;
      try {
        if (typeof v == "object" && v.Once) {
          if (this.result.root.type === "document") {
            let C = this.result.root.nodes.map(
              (R) => v.Once(R, this.helpers)
            );
            return i(C[0]) ? Promise.all(C) : C;
          }
          return v.Once(this.result.root, this.helpers);
        } else if (typeof v == "function")
          return v(this.result.root, this.result);
      } catch (C) {
        throw this.handleError(C);
      }
    }
    stringify() {
      if (this.error) throw this.error;
      if (this.stringified) return this.result;
      this.stringified = !0, this.sync();
      let v = this.result.opts, C = l;
      v.syntax && (C = v.syntax.stringify), v.stringifier && (C = v.stringifier), C.stringify && (C = C.stringify);
      let m = new x(C, this.result.root, this.result.opts).generate();
      return this.result.css = m[0], this.result.map = m[1], this.result;
    }
    sync() {
      if (this.error) throw this.error;
      if (this.processed) return this.result;
      if (this.processed = !0, this.processing)
        throw this.getAsyncError();
      for (let v of this.plugins) {
        let C = this.runOnRoot(v);
        if (i(C))
          throw this.getAsyncError();
      }
      if (this.prepareVisitors(), this.hasListener) {
        let v = this.result.root;
        for (; !v[u]; )
          v[u] = !0, this.walkSync(v);
        if (this.listeners.OnceExit)
          if (v.type === "document")
            for (let C of v.nodes)
              this.visitSync(this.listeners.OnceExit, C);
          else
            this.visitSync(this.listeners.OnceExit, v);
      }
      return this.result;
    }
    then(v, C) {
      return process.env.NODE_ENV !== "production" && ("from" in this.opts || o(
        "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
      )), this.async().then(v, C);
    }
    toString() {
      return this.css;
    }
    visitSync(v, C) {
      for (let [R, m] of v) {
        this.result.lastPlugin = R;
        let g;
        try {
          g = m(C, this.helpers);
        } catch (S) {
          throw this.handleError(S, C.proxyOf);
        }
        if (C.type !== "root" && C.type !== "document" && !C.parent)
          return !0;
        if (i(g))
          throw this.getAsyncError();
      }
    }
    visitTick(v) {
      let C = v[v.length - 1], { node: R, visitors: m } = C;
      if (R.type !== "root" && R.type !== "document" && !R.parent) {
        v.pop();
        return;
      }
      if (m.length > 0 && C.visitorIndex < m.length) {
        let [S, O] = m[C.visitorIndex];
        C.visitorIndex += 1, C.visitorIndex === m.length && (C.visitors = [], C.visitorIndex = 0), this.result.lastPlugin = S;
        try {
          return O(R.toProxy(), this.helpers);
        } catch (L) {
          throw this.handleError(L, R);
        }
      }
      if (C.iterator !== 0) {
        let S = C.iterator, O;
        for (; O = R.nodes[R.indexes[S]]; )
          if (R.indexes[S] += 1, !O[u]) {
            O[u] = !0, v.push(h(O));
            return;
          }
        C.iterator = 0, delete R.indexes[S];
      }
      let g = C.events;
      for (; C.eventIndex < g.length; ) {
        let S = g[C.eventIndex];
        if (C.eventIndex += 1, S === r) {
          R.nodes && R.nodes.length && (R[u] = !0, C.iterator = R.getIterator());
          return;
        } else if (this.listeners[S]) {
          C.visitors = this.listeners[S];
          return;
        }
      }
      v.pop();
    }
    walkSync(v) {
      v[u] = !0;
      let C = a(v);
      for (let R of C)
        if (R === r)
          v.nodes && v.each((m) => {
            m[u] || this.walkSync(m);
          });
        else {
          let m = this.listeners[R];
          if (m && this.visitSync(m, v.toProxy()))
            return;
        }
    }
    warnings() {
      return this.sync().warnings();
    }
  }
  return _.registerPostcss = (A) => {
    d = A;
  }, qe = _, _.default = _, c.registerLazyResult(_), w.registerLazyResult(_), qe;
}
var Te, qt;
function pr() {
  if (qt) return Te;
  qt = 1;
  let p = $t(), w = Je();
  const x = Qe();
  let b = H(), f = Ht();
  class c {
    get content() {
      return this.result.css;
    }
    get css() {
      return this.result.css;
    }
    get map() {
      return this.result.map;
    }
    get messages() {
      return [];
    }
    get opts() {
      return this.result.opts;
    }
    get processor() {
      return this.result.processor;
    }
    get root() {
      if (this._root)
        return this._root;
      let u, s = w;
      try {
        u = s(this._css, this._opts);
      } catch (o) {
        this.error = o;
      }
      if (this.error)
        throw this.error;
      return this._root = u, u;
    }
    get [Symbol.toStringTag]() {
      return "NoWorkResult";
    }
    constructor(u, s, o) {
      s = s.toString(), this.stringified = !1, this._processor = u, this._css = s, this._opts = o, this._map = void 0;
      let e, n = b;
      this.result = new x(this._processor, e, this._opts), this.result.css = s;
      let t = this;
      Object.defineProperty(this.result, "root", {
        get() {
          return t.root;
        }
      });
      let r = new p(n, e, this._opts, s);
      if (r.isMap()) {
        let [i, a] = r.generate();
        i && (this.result.css = i), a && (this.result.map = a);
      } else
        r.clearAnnotation(), this.result.css = r.css;
    }
    async() {
      return this.error ? Promise.reject(this.error) : Promise.resolve(this.result);
    }
    catch(u) {
      return this.async().catch(u);
    }
    finally(u) {
      return this.async().then(u, u);
    }
    sync() {
      if (this.error) throw this.error;
      return this.result;
    }
    then(u, s) {
      return process.env.NODE_ENV !== "production" && ("from" in this._opts || f(
        "Without `from` option PostCSS could generate wrong source map and will not find Browserslist config. Set it to CSS file path or to `undefined` to prevent this warning."
      )), this.async().then(u, s);
    }
    toString() {
      return this._css;
    }
    warnings() {
      return [];
    }
  }
  return Te = c, c.default = c, Te;
}
var De, Tt;
function dr() {
  if (Tt) return De;
  Tt = 1;
  let p = je(), w = Kt(), x = pr(), b = W();
  class f {
    constructor(l = []) {
      this.version = "8.5.6", this.plugins = this.normalize(l);
    }
    normalize(l) {
      let u = [];
      for (let s of l)
        if (s.postcss === !0 ? s = s() : s.postcss && (s = s.postcss), typeof s == "object" && Array.isArray(s.plugins))
          u = u.concat(s.plugins);
        else if (typeof s == "object" && s.postcssPlugin)
          u.push(s);
        else if (typeof s == "function")
          u.push(s);
        else if (typeof s == "object" && (s.parse || s.stringify)) {
          if (process.env.NODE_ENV !== "production")
            throw new Error(
              "PostCSS syntaxes cannot be used as plugins. Instead, please use one of the syntax/parser/stringifier options as outlined in your PostCSS runner documentation."
            );
        } else
          throw new Error(s + " is not a PostCSS plugin");
      return u;
    }
    process(l, u = {}) {
      return !this.plugins.length && !u.parser && !u.stringifier && !u.syntax ? new x(this, l, u) : new w(this, l, u);
    }
    use(l) {
      return this.plugins = this.plugins.concat(this.normalize([l])), this;
    }
  }
  return De = f, f.default = f, b.registerProcessor(f), p.registerProcessor(f), De;
}
var Ue, Dt;
function mr() {
  if (Dt) return Ue;
  Dt = 1;
  let p = Ge(), w = X(), x = U(), b = Fe(), f = Z(), c = je(), l = cr(), u = ee(), s = Kt(), o = Qt(), e = K(), n = Je(), t = dr(), r = Qe(), i = W(), a = Ve(), h = H(), y = Yt();
  function d(..._) {
    return _.length === 1 && Array.isArray(_[0]) && (_ = _[0]), new t(_);
  }
  return d.plugin = function(A, v) {
    let C = !1;
    function R(...g) {
      console && console.warn && !C && (C = !0, console.warn(
        A + `: postcss.plugin was deprecated. Migration guide:
https://evilmartians.com/chronicles/postcss-8-plugin-migration`
      ), process.env.LANG && process.env.LANG.startsWith("cn") && console.warn(
        A + `: 里面 postcss.plugin 被弃用. 迁移指南:
https://www.w3ctech.com/topic/2226`
      ));
      let S = v(...g);
      return S.postcssPlugin = A, S.postcssVersion = new t().version, S;
    }
    let m;
    return Object.defineProperty(R, "postcss", {
      get() {
        return m || (m = R()), m;
      }
    }), R.process = function(g, S, O) {
      return d([R(O)]).process(g, S);
    }, R;
  }, d.stringify = h, d.parse = n, d.fromJSON = l, d.list = o, d.comment = (_) => new w(_), d.atRule = (_) => new p(_), d.decl = (_) => new f(_), d.rule = (_) => new a(_), d.root = (_) => new i(_), d.document = (_) => new c(_), d.CssSyntaxError = b, d.Declaration = f, d.Container = x, d.Processor = t, d.Document = c, d.Comment = w, d.Warning = y, d.AtRule = p, d.Result = r, d.Input = u, d.Rule = a, d.Root = i, d.Node = e, s.registerPostcss(d), Ue = d, d.default = d, Ue;
}
var gr = mr();
const P = /* @__PURE__ */ rr(gr), Sr = P.stringify, Cr = P.fromJSON, _r = P.plugin, xr = P.parse, Or = P.list, Rr = P.document, Ar = P.comment, Er = P.atRule, Mr = P.rule, Lr = P.decl, Pr = P.root, Ir = P.CssSyntaxError, Nr = P.Declaration, kr = P.Container, qr = P.Processor, Tr = P.Document, Dr = P.Comment, Ur = P.Warning, Br = P.AtRule, Fr = P.Result, zr = P.Input, Gr = P.Rule, jr = P.Root, Wr = P.Node;
export {
  Br as AtRule,
  Dr as Comment,
  kr as Container,
  Ir as CssSyntaxError,
  Nr as Declaration,
  Tr as Document,
  zr as Input,
  Wr as Node,
  qr as Processor,
  Fr as Result,
  jr as Root,
  Gr as Rule,
  Ur as Warning,
  Er as atRule,
  Ar as comment,
  Lr as decl,
  P as default,
  Rr as document,
  Cr as fromJSON,
  Or as list,
  xr as parse,
  _r as plugin,
  Pr as root,
  Mr as rule,
  Sr as stringify
};
