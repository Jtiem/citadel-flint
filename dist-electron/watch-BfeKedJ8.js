import { c as Yt, r as Xt, g as Qt, a as Zt, f as Jt } from "./rollup-BqfOgOVx.js";
import es from "node:path";
import ts from "node:process";
import ge from "path";
import Se from "fs";
import me from "util";
import ss from "stream";
import Kt from "os";
import rs from "events";
import { platform as ct } from "node:os";
import "./main-CEfjB-ow.js";
import "node:perf_hooks";
import "node:fs/promises";
var ye = {}, Te = {}, xe, lt;
function ve() {
  if (lt) return xe;
  lt = 1;
  const a = ge, r = "\\\\/", p = `[^${r}]`, A = "\\.", S = "\\+", y = "\\?", l = "\\/", s = "(?=.)", c = "[^/]", h = `(?:${l}|$)`, f = `(?:^|${l})`, T = `${A}{1,2}${h}`, n = `(?!${A})`, V = `(?!${f}${T})`, M = `(?!${A}{0,1}${h})`, j = `(?!${T})`, C = `[^.${l}]`, O = `${c}*?`, W = {
    DOT_LITERAL: A,
    PLUS_LITERAL: S,
    QMARK_LITERAL: y,
    SLASH_LITERAL: l,
    ONE_CHAR: s,
    QMARK: c,
    END_ANCHOR: h,
    DOTS_SLASH: T,
    NO_DOT: n,
    NO_DOTS: V,
    NO_DOT_SLASH: M,
    NO_DOTS_SLASH: j,
    QMARK_NO_DOT: C,
    STAR: O,
    START_ANCHOR: f
  }, u = {
    ...W,
    SLASH_LITERAL: `[${r}]`,
    QMARK: p,
    STAR: `${p}*?`,
    DOTS_SLASH: `${A}{1,2}(?:[${r}]|$)`,
    NO_DOT: `(?!${A})`,
    NO_DOTS: `(?!(?:^|[${r}])${A}{1,2}(?:[${r}]|$))`,
    NO_DOT_SLASH: `(?!${A}{0,1}(?:[${r}]|$))`,
    NO_DOTS_SLASH: `(?!${A}{1,2}(?:[${r}]|$))`,
    QMARK_NO_DOT: `[^.${r}]`,
    START_ANCHOR: `(?:^|[${r}])`,
    END_ANCHOR: `(?:[${r}]|$)`
  }, N = {
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
  return xe = {
    MAX_LENGTH: 1024 * 64,
    POSIX_REGEX_SOURCE: N,
    // regular expressions
    REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
    REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
    REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
    REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
    REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
    REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
    // Replace globs with equivalent patterns to reduce parsing time.
    REPLACEMENTS: {
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
    SEP: a.sep,
    /**
     * Create EXTGLOB_CHARS
     */
    extglobChars(b) {
      return {
        "!": { type: "negate", open: "(?:(?!(?:", close: `))${b.STAR})` },
        "?": { type: "qmark", open: "(?:", close: ")?" },
        "+": { type: "plus", open: "(?:", close: ")+" },
        "*": { type: "star", open: "(?:", close: ")*" },
        "@": { type: "at", open: "(?:", close: ")" }
      };
    },
    /**
     * Create GLOB_CHARS
     */
    globChars(b) {
      return b === !0 ? u : W;
    }
  }, xe;
}
var ft;
function it() {
  return ft || (ft = 1, (function(a) {
    const r = ge, p = process.platform === "win32", {
      REGEX_BACKSLASH: A,
      REGEX_REMOVE_BACKSLASH: S,
      REGEX_SPECIAL_CHARS: y,
      REGEX_SPECIAL_CHARS_GLOBAL: l
    } = /* @__PURE__ */ ve();
    a.isObject = (s) => s !== null && typeof s == "object" && !Array.isArray(s), a.hasRegexChars = (s) => y.test(s), a.isRegexChar = (s) => s.length === 1 && a.hasRegexChars(s), a.escapeRegex = (s) => s.replace(l, "\\$1"), a.toPosixSlashes = (s) => s.replace(A, "/"), a.removeBackslashes = (s) => s.replace(S, (c) => c === "\\" ? "" : c), a.supportsLookbehinds = () => {
      const s = process.version.slice(1).split(".").map(Number);
      return s.length === 3 && s[0] >= 9 || s[0] === 8 && s[1] >= 10;
    }, a.isWindows = (s) => s && typeof s.windows == "boolean" ? s.windows : p === !0 || r.sep === "\\", a.escapeLast = (s, c, h) => {
      const f = s.lastIndexOf(c, h);
      return f === -1 ? s : s[f - 1] === "\\" ? a.escapeLast(s, c, f - 1) : `${s.slice(0, f)}\\${s.slice(f)}`;
    }, a.removePrefix = (s, c = {}) => {
      let h = s;
      return h.startsWith("./") && (h = h.slice(2), c.prefix = "./"), h;
    }, a.wrapOutput = (s, c = {}, h = {}) => {
      const f = h.contains ? "" : "^", T = h.contains ? "" : "$";
      let n = `${f}(?:${s})${T}`;
      return c.negated === !0 && (n = `(?:^(?!${n}).*$)`), n;
    };
  })(Te)), Te;
}
var He, ht;
function is() {
  if (ht) return He;
  ht = 1;
  const a = /* @__PURE__ */ it(), {
    CHAR_ASTERISK: r,
    /* * */
    CHAR_AT: p,
    /* @ */
    CHAR_BACKWARD_SLASH: A,
    /* \ */
    CHAR_COMMA: S,
    /* , */
    CHAR_DOT: y,
    /* . */
    CHAR_EXCLAMATION_MARK: l,
    /* ! */
    CHAR_FORWARD_SLASH: s,
    /* / */
    CHAR_LEFT_CURLY_BRACE: c,
    /* { */
    CHAR_LEFT_PARENTHESES: h,
    /* ( */
    CHAR_LEFT_SQUARE_BRACKET: f,
    /* [ */
    CHAR_PLUS: T,
    /* + */
    CHAR_QUESTION_MARK: n,
    /* ? */
    CHAR_RIGHT_CURLY_BRACE: V,
    /* } */
    CHAR_RIGHT_PARENTHESES: M,
    /* ) */
    CHAR_RIGHT_SQUARE_BRACKET: j
    /* ] */
  } = /* @__PURE__ */ ve(), C = (u) => u === s || u === A, O = (u) => {
    u.isPrefix !== !0 && (u.depth = u.isGlobstar ? 1 / 0 : 1);
  };
  return He = (u, N) => {
    const b = N || {}, D = u.length - 1, v = b.parts === !0 || b.scanToEnd === !0, K = [], I = [], F = [];
    let k = u, B = -1, g = 0, Y = 0, z = !1, re = !1, X = !1, oe = !1, he = !1, ne = !1, i = !1, ue = !1, se = !1, L = !1, t = 0, e, _, R = { value: "", depth: 0, isGlob: !1 };
    const P = () => B >= D, x = () => k.charCodeAt(B + 1), H = () => (e = _, k.charCodeAt(++B));
    for (; B < D; ) {
      _ = H();
      let w;
      if (_ === A) {
        i = R.backslashes = !0, _ = H(), _ === c && (ne = !0);
        continue;
      }
      if (ne === !0 || _ === c) {
        for (t++; P() !== !0 && (_ = H()); ) {
          if (_ === A) {
            i = R.backslashes = !0, H();
            continue;
          }
          if (_ === c) {
            t++;
            continue;
          }
          if (ne !== !0 && _ === y && (_ = H()) === y) {
            if (z = R.isBrace = !0, X = R.isGlob = !0, L = !0, v === !0)
              continue;
            break;
          }
          if (ne !== !0 && _ === S) {
            if (z = R.isBrace = !0, X = R.isGlob = !0, L = !0, v === !0)
              continue;
            break;
          }
          if (_ === V && (t--, t === 0)) {
            ne = !1, z = R.isBrace = !0, L = !0;
            break;
          }
        }
        if (v === !0)
          continue;
        break;
      }
      if (_ === s) {
        if (K.push(B), I.push(R), R = { value: "", depth: 0, isGlob: !1 }, L === !0) continue;
        if (e === y && B === g + 1) {
          g += 2;
          continue;
        }
        Y = B + 1;
        continue;
      }
      if (b.noext !== !0 && (_ === T || _ === p || _ === r || _ === n || _ === l) === !0 && x() === h) {
        if (X = R.isGlob = !0, oe = R.isExtglob = !0, L = !0, _ === l && B === g && (se = !0), v === !0) {
          for (; P() !== !0 && (_ = H()); ) {
            if (_ === A) {
              i = R.backslashes = !0, _ = H();
              continue;
            }
            if (_ === M) {
              X = R.isGlob = !0, L = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (_ === r) {
        if (e === r && (he = R.isGlobstar = !0), X = R.isGlob = !0, L = !0, v === !0)
          continue;
        break;
      }
      if (_ === n) {
        if (X = R.isGlob = !0, L = !0, v === !0)
          continue;
        break;
      }
      if (_ === f) {
        for (; P() !== !0 && (w = H()); ) {
          if (w === A) {
            i = R.backslashes = !0, H();
            continue;
          }
          if (w === j) {
            re = R.isBracket = !0, X = R.isGlob = !0, L = !0;
            break;
          }
        }
        if (v === !0)
          continue;
        break;
      }
      if (b.nonegate !== !0 && _ === l && B === g) {
        ue = R.negated = !0, g++;
        continue;
      }
      if (b.noparen !== !0 && _ === h) {
        if (X = R.isGlob = !0, v === !0) {
          for (; P() !== !0 && (_ = H()); ) {
            if (_ === h) {
              i = R.backslashes = !0, _ = H();
              continue;
            }
            if (_ === M) {
              L = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (X === !0) {
        if (L = !0, v === !0)
          continue;
        break;
      }
    }
    b.noext === !0 && (oe = !1, X = !1);
    let $ = k, Q = "", G = "";
    g > 0 && (Q = k.slice(0, g), k = k.slice(g), Y -= g), $ && X === !0 && Y > 0 ? ($ = k.slice(0, Y), G = k.slice(Y)) : X === !0 ? ($ = "", G = k) : $ = k, $ && $ !== "" && $ !== "/" && $ !== k && C($.charCodeAt($.length - 1)) && ($ = $.slice(0, -1)), b.unescape === !0 && (G && (G = a.removeBackslashes(G)), $ && i === !0 && ($ = a.removeBackslashes($)));
    const U = {
      prefix: Q,
      input: u,
      start: g,
      base: $,
      glob: G,
      isBrace: z,
      isBracket: re,
      isGlob: X,
      isExtglob: oe,
      isGlobstar: he,
      negated: ue,
      negatedExtglob: se
    };
    if (b.tokens === !0 && (U.maxDepth = 0, C(_) || I.push(R), U.tokens = I), b.parts === !0 || b.tokens === !0) {
      let w;
      for (let Z = 0; Z < K.length; Z++) {
        const de = w ? w + 1 : g, m = K[Z], te = u.slice(de, m);
        b.tokens && (Z === 0 && g !== 0 ? (I[Z].isPrefix = !0, I[Z].value = Q) : I[Z].value = te, O(I[Z]), U.maxDepth += I[Z].depth), (Z !== 0 || te !== "") && F.push(te), w = m;
      }
      if (w && w + 1 < u.length) {
        const Z = u.slice(w + 1);
        F.push(Z), b.tokens && (I[I.length - 1].value = Z, O(I[I.length - 1]), U.maxDepth += I[I.length - 1].depth);
      }
      U.slashes = K, U.parts = F;
    }
    return U;
  }, He;
}
var Oe, pt;
function ns() {
  if (pt) return Oe;
  pt = 1;
  const a = /* @__PURE__ */ ve(), r = /* @__PURE__ */ it(), {
    MAX_LENGTH: p,
    POSIX_REGEX_SOURCE: A,
    REGEX_NON_SPECIAL_CHARS: S,
    REGEX_SPECIAL_CHARS_BACKREF: y,
    REPLACEMENTS: l
  } = a, s = (f, T) => typeof T.expandRange == "function" ? T.expandRange(...f, T) : (f.sort(), `[${f.join("-")}]`), c = (f, T) => `Missing ${f}: "${T}" - use "\\\\${T}" to match literal characters`, h = (f, T) => {
    if (typeof f != "string")
      throw new TypeError("Expected a string");
    f = l[f] || f;
    const n = { ...T }, V = typeof n.maxLength == "number" ? Math.min(p, n.maxLength) : p;
    let M = f.length;
    if (M > V)
      throw new SyntaxError(`Input length: ${M}, exceeds maximum allowed length: ${V}`);
    const j = { type: "bos", value: "", output: n.prepend || "" }, C = [j], O = n.capture ? "" : "?:", W = r.isWindows(T), u = a.globChars(W), N = a.extglobChars(u), {
      DOT_LITERAL: b,
      PLUS_LITERAL: D,
      SLASH_LITERAL: v,
      ONE_CHAR: K,
      DOTS_SLASH: I,
      NO_DOT: F,
      NO_DOT_SLASH: k,
      NO_DOTS_SLASH: B,
      QMARK: g,
      QMARK_NO_DOT: Y,
      STAR: z,
      START_ANCHOR: re
    } = u, X = (m) => `(${O}(?:(?!${re}${m.dot ? I : b}).)*?)`, oe = n.dot ? "" : F, he = n.dot ? g : Y;
    let ne = n.bash === !0 ? X(n) : z;
    n.capture && (ne = `(${ne})`), typeof n.noext == "boolean" && (n.noextglob = n.noext);
    const i = {
      input: f,
      index: -1,
      start: 0,
      dot: n.dot === !0,
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
      tokens: C
    };
    f = r.removePrefix(f, i), M = f.length;
    const ue = [], se = [], L = [];
    let t = j, e;
    const _ = () => i.index === M - 1, R = i.peek = (m = 1) => f[i.index + m], P = i.advance = () => f[++i.index] || "", x = () => f.slice(i.index + 1), H = (m = "", te = 0) => {
      i.consumed += m, i.index += te;
    }, $ = (m) => {
      i.output += m.output != null ? m.output : m.value, H(m.value);
    }, Q = () => {
      let m = 1;
      for (; R() === "!" && (R(2) !== "(" || R(3) === "?"); )
        P(), i.start++, m++;
      return m % 2 === 0 ? !1 : (i.negated = !0, i.start++, !0);
    }, G = (m) => {
      i[m]++, L.push(m);
    }, U = (m) => {
      i[m]--, L.pop();
    }, w = (m) => {
      if (t.type === "globstar") {
        const te = i.braces > 0 && (m.type === "comma" || m.type === "brace"), E = m.extglob === !0 || ue.length && (m.type === "pipe" || m.type === "paren");
        m.type !== "slash" && m.type !== "paren" && !te && !E && (i.output = i.output.slice(0, -t.output.length), t.type = "star", t.value = "*", t.output = ne, i.output += t.output);
      }
      if (ue.length && m.type !== "paren" && (ue[ue.length - 1].inner += m.value), (m.value || m.output) && $(m), t && t.type === "text" && m.type === "text") {
        t.value += m.value, t.output = (t.output || "") + m.value;
        return;
      }
      m.prev = t, C.push(m), t = m;
    }, Z = (m, te) => {
      const E = { ...N[te], conditions: 1, inner: "" };
      E.prev = t, E.parens = i.parens, E.output = i.output;
      const q = (n.capture ? "(" : "") + E.open;
      G("parens"), w({ type: m, value: te, output: i.output ? "" : K }), w({ type: "paren", extglob: !0, value: P(), output: q }), ue.push(E);
    }, de = (m) => {
      let te = m.close + (n.capture ? ")" : ""), E;
      if (m.type === "negate") {
        let q = ne;
        if (m.inner && m.inner.length > 1 && m.inner.includes("/") && (q = X(n)), (q !== ne || _() || /^\)+$/.test(x())) && (te = m.close = `)$))${q}`), m.inner.includes("*") && (E = x()) && /^\.[^\\/.]+$/.test(E)) {
          const ae = h(E, { ...T, fastpaths: !1 }).output;
          te = m.close = `)${ae})${q})`;
        }
        m.prev.type === "bos" && (i.negatedExtglob = !0);
      }
      w({ type: "paren", extglob: !0, value: e, output: te }), U("parens");
    };
    if (n.fastpaths !== !1 && !/(^[*!]|[/()[\]{}"])/.test(f)) {
      let m = !1, te = f.replace(y, (E, q, ae, ie, o, d) => ie === "\\" ? (m = !0, E) : ie === "?" ? q ? q + ie + (o ? g.repeat(o.length) : "") : d === 0 ? he + (o ? g.repeat(o.length) : "") : g.repeat(ae.length) : ie === "." ? b.repeat(ae.length) : ie === "*" ? q ? q + ie + (o ? ne : "") : ne : q ? E : `\\${E}`);
      return m === !0 && (n.unescape === !0 ? te = te.replace(/\\/g, "") : te = te.replace(/\\+/g, (E) => E.length % 2 === 0 ? "\\\\" : E ? "\\" : "")), te === f && n.contains === !0 ? (i.output = f, i) : (i.output = r.wrapOutput(te, i, T), i);
    }
    for (; !_(); ) {
      if (e = P(), e === "\0")
        continue;
      if (e === "\\") {
        const E = R();
        if (E === "/" && n.bash !== !0 || E === "." || E === ";")
          continue;
        if (!E) {
          e += "\\", w({ type: "text", value: e });
          continue;
        }
        const q = /^\\+/.exec(x());
        let ae = 0;
        if (q && q[0].length > 2 && (ae = q[0].length, i.index += ae, ae % 2 !== 0 && (e += "\\")), n.unescape === !0 ? e = P() : e += P(), i.brackets === 0) {
          w({ type: "text", value: e });
          continue;
        }
      }
      if (i.brackets > 0 && (e !== "]" || t.value === "[" || t.value === "[^")) {
        if (n.posix !== !1 && e === ":") {
          const E = t.value.slice(1);
          if (E.includes("[") && (t.posix = !0, E.includes(":"))) {
            const q = t.value.lastIndexOf("["), ae = t.value.slice(0, q), ie = t.value.slice(q + 2), o = A[ie];
            if (o) {
              t.value = ae + o, i.backtrack = !0, P(), !j.output && C.indexOf(t) === 1 && (j.output = K);
              continue;
            }
          }
        }
        (e === "[" && R() !== ":" || e === "-" && R() === "]") && (e = `\\${e}`), e === "]" && (t.value === "[" || t.value === "[^") && (e = `\\${e}`), n.posix === !0 && e === "!" && t.value === "[" && (e = "^"), t.value += e, $({ value: e });
        continue;
      }
      if (i.quotes === 1 && e !== '"') {
        e = r.escapeRegex(e), t.value += e, $({ value: e });
        continue;
      }
      if (e === '"') {
        i.quotes = i.quotes === 1 ? 0 : 1, n.keepQuotes === !0 && w({ type: "text", value: e });
        continue;
      }
      if (e === "(") {
        G("parens"), w({ type: "paren", value: e });
        continue;
      }
      if (e === ")") {
        if (i.parens === 0 && n.strictBrackets === !0)
          throw new SyntaxError(c("opening", "("));
        const E = ue[ue.length - 1];
        if (E && i.parens === E.parens + 1) {
          de(ue.pop());
          continue;
        }
        w({ type: "paren", value: e, output: i.parens ? ")" : "\\)" }), U("parens");
        continue;
      }
      if (e === "[") {
        if (n.nobracket === !0 || !x().includes("]")) {
          if (n.nobracket !== !0 && n.strictBrackets === !0)
            throw new SyntaxError(c("closing", "]"));
          e = `\\${e}`;
        } else
          G("brackets");
        w({ type: "bracket", value: e });
        continue;
      }
      if (e === "]") {
        if (n.nobracket === !0 || t && t.type === "bracket" && t.value.length === 1) {
          w({ type: "text", value: e, output: `\\${e}` });
          continue;
        }
        if (i.brackets === 0) {
          if (n.strictBrackets === !0)
            throw new SyntaxError(c("opening", "["));
          w({ type: "text", value: e, output: `\\${e}` });
          continue;
        }
        U("brackets");
        const E = t.value.slice(1);
        if (t.posix !== !0 && E[0] === "^" && !E.includes("/") && (e = `/${e}`), t.value += e, $({ value: e }), n.literalBrackets === !1 || r.hasRegexChars(E))
          continue;
        const q = r.escapeRegex(t.value);
        if (i.output = i.output.slice(0, -t.value.length), n.literalBrackets === !0) {
          i.output += q, t.value = q;
          continue;
        }
        t.value = `(${O}${q}|${t.value})`, i.output += t.value;
        continue;
      }
      if (e === "{" && n.nobrace !== !0) {
        G("braces");
        const E = {
          type: "brace",
          value: e,
          output: "(",
          outputIndex: i.output.length,
          tokensIndex: i.tokens.length
        };
        se.push(E), w(E);
        continue;
      }
      if (e === "}") {
        const E = se[se.length - 1];
        if (n.nobrace === !0 || !E) {
          w({ type: "text", value: e, output: e });
          continue;
        }
        let q = ")";
        if (E.dots === !0) {
          const ae = C.slice(), ie = [];
          for (let o = ae.length - 1; o >= 0 && (C.pop(), ae[o].type !== "brace"); o--)
            ae[o].type !== "dots" && ie.unshift(ae[o].value);
          q = s(ie, n), i.backtrack = !0;
        }
        if (E.comma !== !0 && E.dots !== !0) {
          const ae = i.output.slice(0, E.outputIndex), ie = i.tokens.slice(E.tokensIndex);
          E.value = E.output = "\\{", e = q = "\\}", i.output = ae;
          for (const o of ie)
            i.output += o.output || o.value;
        }
        w({ type: "brace", value: e, output: q }), U("braces"), se.pop();
        continue;
      }
      if (e === "|") {
        ue.length > 0 && ue[ue.length - 1].conditions++, w({ type: "text", value: e });
        continue;
      }
      if (e === ",") {
        let E = e;
        const q = se[se.length - 1];
        q && L[L.length - 1] === "braces" && (q.comma = !0, E = "|"), w({ type: "comma", value: e, output: E });
        continue;
      }
      if (e === "/") {
        if (t.type === "dot" && i.index === i.start + 1) {
          i.start = i.index + 1, i.consumed = "", i.output = "", C.pop(), t = j;
          continue;
        }
        w({ type: "slash", value: e, output: v });
        continue;
      }
      if (e === ".") {
        if (i.braces > 0 && t.type === "dot") {
          t.value === "." && (t.output = b);
          const E = se[se.length - 1];
          t.type = "dots", t.output += e, t.value += e, E.dots = !0;
          continue;
        }
        if (i.braces + i.parens === 0 && t.type !== "bos" && t.type !== "slash") {
          w({ type: "text", value: e, output: b });
          continue;
        }
        w({ type: "dot", value: e, output: b });
        continue;
      }
      if (e === "?") {
        if (!(t && t.value === "(") && n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          Z("qmark", e);
          continue;
        }
        if (t && t.type === "paren") {
          const q = R();
          let ae = e;
          if (q === "<" && !r.supportsLookbehinds())
            throw new Error("Node.js v10 or higher is required for regex lookbehinds");
          (t.value === "(" && !/[!=<:]/.test(q) || q === "<" && !/<([!=]|\w+>)/.test(x())) && (ae = `\\${e}`), w({ type: "text", value: e, output: ae });
          continue;
        }
        if (n.dot !== !0 && (t.type === "slash" || t.type === "bos")) {
          w({ type: "qmark", value: e, output: Y });
          continue;
        }
        w({ type: "qmark", value: e, output: g });
        continue;
      }
      if (e === "!") {
        if (n.noextglob !== !0 && R() === "(" && (R(2) !== "?" || !/[!=<:]/.test(R(3)))) {
          Z("negate", e);
          continue;
        }
        if (n.nonegate !== !0 && i.index === 0) {
          Q();
          continue;
        }
      }
      if (e === "+") {
        if (n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          Z("plus", e);
          continue;
        }
        if (t && t.value === "(" || n.regex === !1) {
          w({ type: "plus", value: e, output: D });
          continue;
        }
        if (t && (t.type === "bracket" || t.type === "paren" || t.type === "brace") || i.parens > 0) {
          w({ type: "plus", value: e });
          continue;
        }
        w({ type: "plus", value: D });
        continue;
      }
      if (e === "@") {
        if (n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          w({ type: "at", extglob: !0, value: e, output: "" });
          continue;
        }
        w({ type: "text", value: e });
        continue;
      }
      if (e !== "*") {
        (e === "$" || e === "^") && (e = `\\${e}`);
        const E = S.exec(x());
        E && (e += E[0], i.index += E[0].length), w({ type: "text", value: e });
        continue;
      }
      if (t && (t.type === "globstar" || t.star === !0)) {
        t.type = "star", t.star = !0, t.value += e, t.output = ne, i.backtrack = !0, i.globstar = !0, H(e);
        continue;
      }
      let m = x();
      if (n.noextglob !== !0 && /^\([^?]/.test(m)) {
        Z("star", e);
        continue;
      }
      if (t.type === "star") {
        if (n.noglobstar === !0) {
          H(e);
          continue;
        }
        const E = t.prev, q = E.prev, ae = E.type === "slash" || E.type === "bos", ie = q && (q.type === "star" || q.type === "globstar");
        if (n.bash === !0 && (!ae || m[0] && m[0] !== "/")) {
          w({ type: "star", value: e, output: "" });
          continue;
        }
        const o = i.braces > 0 && (E.type === "comma" || E.type === "brace"), d = ue.length && (E.type === "pipe" || E.type === "paren");
        if (!ae && E.type !== "paren" && !o && !d) {
          w({ type: "star", value: e, output: "" });
          continue;
        }
        for (; m.slice(0, 3) === "/**"; ) {
          const ee = f[i.index + 4];
          if (ee && ee !== "/")
            break;
          m = m.slice(3), H("/**", 3);
        }
        if (E.type === "bos" && _()) {
          t.type = "globstar", t.value += e, t.output = X(n), i.output = t.output, i.globstar = !0, H(e);
          continue;
        }
        if (E.type === "slash" && E.prev.type !== "bos" && !ie && _()) {
          i.output = i.output.slice(0, -(E.output + t.output).length), E.output = `(?:${E.output}`, t.type = "globstar", t.output = X(n) + (n.strictSlashes ? ")" : "|$)"), t.value += e, i.globstar = !0, i.output += E.output + t.output, H(e);
          continue;
        }
        if (E.type === "slash" && E.prev.type !== "bos" && m[0] === "/") {
          const ee = m[1] !== void 0 ? "|$" : "";
          i.output = i.output.slice(0, -(E.output + t.output).length), E.output = `(?:${E.output}`, t.type = "globstar", t.output = `${X(n)}${v}|${v}${ee})`, t.value += e, i.output += E.output + t.output, i.globstar = !0, H(e + P()), w({ type: "slash", value: "/", output: "" });
          continue;
        }
        if (E.type === "bos" && m[0] === "/") {
          t.type = "globstar", t.value += e, t.output = `(?:^|${v}|${X(n)}${v})`, i.output = t.output, i.globstar = !0, H(e + P()), w({ type: "slash", value: "/", output: "" });
          continue;
        }
        i.output = i.output.slice(0, -t.output.length), t.type = "globstar", t.output = X(n), t.value += e, i.output += t.output, i.globstar = !0, H(e);
        continue;
      }
      const te = { type: "star", value: e, output: ne };
      if (n.bash === !0) {
        te.output = ".*?", (t.type === "bos" || t.type === "slash") && (te.output = oe + te.output), w(te);
        continue;
      }
      if (t && (t.type === "bracket" || t.type === "paren") && n.regex === !0) {
        te.output = e, w(te);
        continue;
      }
      (i.index === i.start || t.type === "slash" || t.type === "dot") && (t.type === "dot" ? (i.output += k, t.output += k) : n.dot === !0 ? (i.output += B, t.output += B) : (i.output += oe, t.output += oe), R() !== "*" && (i.output += K, t.output += K)), w(te);
    }
    for (; i.brackets > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", "]"));
      i.output = r.escapeLast(i.output, "["), U("brackets");
    }
    for (; i.parens > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", ")"));
      i.output = r.escapeLast(i.output, "("), U("parens");
    }
    for (; i.braces > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", "}"));
      i.output = r.escapeLast(i.output, "{"), U("braces");
    }
    if (n.strictSlashes !== !0 && (t.type === "star" || t.type === "bracket") && w({ type: "maybe_slash", value: "", output: `${v}?` }), i.backtrack === !0) {
      i.output = "";
      for (const m of i.tokens)
        i.output += m.output != null ? m.output : m.value, m.suffix && (i.output += m.suffix);
    }
    return i;
  };
  return h.fastpaths = (f, T) => {
    const n = { ...T }, V = typeof n.maxLength == "number" ? Math.min(p, n.maxLength) : p, M = f.length;
    if (M > V)
      throw new SyntaxError(`Input length: ${M}, exceeds maximum allowed length: ${V}`);
    f = l[f] || f;
    const j = r.isWindows(T), {
      DOT_LITERAL: C,
      SLASH_LITERAL: O,
      ONE_CHAR: W,
      DOTS_SLASH: u,
      NO_DOT: N,
      NO_DOTS: b,
      NO_DOTS_SLASH: D,
      STAR: v,
      START_ANCHOR: K
    } = a.globChars(j), I = n.dot ? b : N, F = n.dot ? D : N, k = n.capture ? "" : "?:", B = { negated: !1, prefix: "" };
    let g = n.bash === !0 ? ".*?" : v;
    n.capture && (g = `(${g})`);
    const Y = (oe) => oe.noglobstar === !0 ? g : `(${k}(?:(?!${K}${oe.dot ? u : C}).)*?)`, z = (oe) => {
      switch (oe) {
        case "*":
          return `${I}${W}${g}`;
        case ".*":
          return `${C}${W}${g}`;
        case "*.*":
          return `${I}${g}${C}${W}${g}`;
        case "*/*":
          return `${I}${g}${O}${W}${F}${g}`;
        case "**":
          return I + Y(n);
        case "**/*":
          return `(?:${I}${Y(n)}${O})?${F}${W}${g}`;
        case "**/*.*":
          return `(?:${I}${Y(n)}${O})?${F}${g}${C}${W}${g}`;
        case "**/.*":
          return `(?:${I}${Y(n)}${O})?${C}${W}${g}`;
        default: {
          const he = /^(.*?)\.(\w+)$/.exec(oe);
          if (!he) return;
          const ne = z(he[1]);
          return ne ? ne + C + he[2] : void 0;
        }
      }
    }, re = r.removePrefix(f, B);
    let X = z(re);
    return X && n.strictSlashes !== !0 && (X += `${O}?`), X;
  }, Oe = h, Oe;
}
var Le, dt;
function as() {
  if (dt) return Le;
  dt = 1;
  const a = ge, r = /* @__PURE__ */ is(), p = /* @__PURE__ */ ns(), A = /* @__PURE__ */ it(), S = /* @__PURE__ */ ve(), y = (s) => s && typeof s == "object" && !Array.isArray(s), l = (s, c, h = !1) => {
    if (Array.isArray(s)) {
      const O = s.map((u) => l(u, c, h));
      return (u) => {
        for (const N of O) {
          const b = N(u);
          if (b) return b;
        }
        return !1;
      };
    }
    const f = y(s) && s.tokens && s.input;
    if (s === "" || typeof s != "string" && !f)
      throw new TypeError("Expected pattern to be a non-empty string");
    const T = c || {}, n = A.isWindows(c), V = f ? l.compileRe(s, c) : l.makeRe(s, c, !1, !0), M = V.state;
    delete V.state;
    let j = () => !1;
    if (T.ignore) {
      const O = { ...c, ignore: null, onMatch: null, onResult: null };
      j = l(T.ignore, O, h);
    }
    const C = (O, W = !1) => {
      const { isMatch: u, match: N, output: b } = l.test(O, V, c, { glob: s, posix: n }), D = { glob: s, state: M, regex: V, posix: n, input: O, output: b, match: N, isMatch: u };
      return typeof T.onResult == "function" && T.onResult(D), u === !1 ? (D.isMatch = !1, W ? D : !1) : j(O) ? (typeof T.onIgnore == "function" && T.onIgnore(D), D.isMatch = !1, W ? D : !1) : (typeof T.onMatch == "function" && T.onMatch(D), W ? D : !0);
    };
    return h && (C.state = M), C;
  };
  return l.test = (s, c, h, { glob: f, posix: T } = {}) => {
    if (typeof s != "string")
      throw new TypeError("Expected input to be a string");
    if (s === "")
      return { isMatch: !1, output: "" };
    const n = h || {}, V = n.format || (T ? A.toPosixSlashes : null);
    let M = s === f, j = M && V ? V(s) : s;
    return M === !1 && (j = V ? V(s) : s, M = j === f), (M === !1 || n.capture === !0) && (n.matchBase === !0 || n.basename === !0 ? M = l.matchBase(s, c, h, T) : M = c.exec(j)), { isMatch: !!M, match: M, output: j };
  }, l.matchBase = (s, c, h, f = A.isWindows(h)) => (c instanceof RegExp ? c : l.makeRe(c, h)).test(a.basename(s)), l.isMatch = (s, c, h) => l(c, h)(s), l.parse = (s, c) => Array.isArray(s) ? s.map((h) => l.parse(h, c)) : p(s, { ...c, fastpaths: !1 }), l.scan = (s, c) => r(s, c), l.compileRe = (s, c, h = !1, f = !1) => {
    if (h === !0)
      return s.output;
    const T = c || {}, n = T.contains ? "" : "^", V = T.contains ? "" : "$";
    let M = `${n}(?:${s.output})${V}`;
    s && s.negated === !0 && (M = `^(?!${M}).*$`);
    const j = l.toRegex(M, c);
    return f === !0 && (j.state = s), j;
  }, l.makeRe = (s, c = {}, h = !1, f = !1) => {
    if (!s || typeof s != "string")
      throw new TypeError("Expected a non-empty string");
    let T = { negated: !1, fastpaths: !0 };
    return c.fastpaths !== !1 && (s[0] === "." || s[0] === "*") && (T.output = p.fastpaths(s, c)), T.output || (T = p(s, c)), l.compileRe(T, c, h, f);
  }, l.toRegex = (s, c) => {
    try {
      const h = c || {};
      return new RegExp(s, h.flags || (h.nocase ? "i" : ""));
    } catch (h) {
      if (c && c.debug === !0) throw h;
      return /$^/;
    }
  }, l.constants = S, Le = l, Le;
}
var Ne, _t;
function os() {
  return _t || (_t = 1, Ne = /* @__PURE__ */ as()), Ne;
}
var Ie, Et;
function us() {
  if (Et) return Ie;
  Et = 1;
  const a = Se, { Readable: r } = ss, p = ge, { promisify: A } = me, S = /* @__PURE__ */ os(), y = A(a.readdir), l = A(a.stat), s = A(a.lstat), c = A(a.realpath), h = "!", f = "READDIRP_RECURSIVE_ERROR", T = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", f]), n = "files", V = "directories", M = "files_directories", j = "all", C = [n, V, M, j], O = (I) => T.has(I.code), [W, u] = process.versions.node.split(".").slice(0, 2).map((I) => Number.parseInt(I, 10)), N = process.platform === "win32" && (W > 10 || W === 10 && u >= 5), b = (I) => {
    if (I !== void 0) {
      if (typeof I == "function") return I;
      if (typeof I == "string") {
        const F = S(I.trim());
        return (k) => F(k.basename);
      }
      if (Array.isArray(I)) {
        const F = [], k = [];
        for (const B of I) {
          const g = B.trim();
          g.charAt(0) === h ? k.push(S(g.slice(1))) : F.push(S(g));
        }
        return k.length > 0 ? F.length > 0 ? (B) => F.some((g) => g(B.basename)) && !k.some((g) => g(B.basename)) : (B) => !k.some((g) => g(B.basename)) : (B) => F.some((g) => g(B.basename));
      }
    }
  };
  class D extends r {
    static get defaultOptions() {
      return {
        root: ".",
        /* eslint-disable no-unused-vars */
        fileFilter: (F) => !0,
        directoryFilter: (F) => !0,
        /* eslint-enable no-unused-vars */
        type: n,
        lstat: !1,
        depth: 2147483648,
        alwaysStat: !1
      };
    }
    constructor(F = {}) {
      super({
        objectMode: !0,
        autoDestroy: !0,
        highWaterMark: F.highWaterMark || 4096
      });
      const k = { ...D.defaultOptions, ...F }, { root: B, type: g } = k;
      this._fileFilter = b(k.fileFilter), this._directoryFilter = b(k.directoryFilter);
      const Y = k.lstat ? s : l;
      N ? this._stat = (z) => Y(z, { bigint: !0 }) : this._stat = Y, this._maxDepth = k.depth, this._wantsDir = [V, M, j].includes(g), this._wantsFile = [n, M, j].includes(g), this._wantsEverything = g === j, this._root = p.resolve(B), this._isDirent = "Dirent" in a && !k.alwaysStat, this._statsProp = this._isDirent ? "dirent" : "stats", this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent }, this.parents = [this._exploreDir(B, 1)], this.reading = !1, this.parent = void 0;
    }
    async _read(F) {
      if (!this.reading) {
        this.reading = !0;
        try {
          for (; !this.destroyed && F > 0; ) {
            const { path: k, depth: B, files: g = [] } = this.parent || {};
            if (g.length > 0) {
              const Y = g.splice(0, F).map((z) => this._formatEntry(z, k));
              for (const z of await Promise.all(Y)) {
                if (this.destroyed) return;
                const re = await this._getEntryType(z);
                re === "directory" && this._directoryFilter(z) ? (B <= this._maxDepth && this.parents.push(this._exploreDir(z.fullPath, B + 1)), this._wantsDir && (this.push(z), F--)) : (re === "file" || this._includeAsFile(z)) && this._fileFilter(z) && this._wantsFile && (this.push(z), F--);
              }
            } else {
              const Y = this.parents.pop();
              if (!Y) {
                this.push(null);
                break;
              }
              if (this.parent = await Y, this.destroyed) return;
            }
          }
        } catch (k) {
          this.destroy(k);
        } finally {
          this.reading = !1;
        }
      }
    }
    async _exploreDir(F, k) {
      let B;
      try {
        B = await y(F, this._rdOptions);
      } catch (g) {
        this._onError(g);
      }
      return { files: B, depth: k, path: F };
    }
    async _formatEntry(F, k) {
      let B;
      try {
        const g = this._isDirent ? F.name : F, Y = p.resolve(p.join(k, g));
        B = { path: p.relative(this._root, Y), fullPath: Y, basename: g }, B[this._statsProp] = this._isDirent ? F : await this._stat(Y);
      } catch (g) {
        this._onError(g);
      }
      return B;
    }
    _onError(F) {
      O(F) && !this.destroyed ? this.emit("warn", F) : this.destroy(F);
    }
    async _getEntryType(F) {
      const k = F && F[this._statsProp];
      if (k) {
        if (k.isFile())
          return "file";
        if (k.isDirectory())
          return "directory";
        if (k && k.isSymbolicLink()) {
          const B = F.fullPath;
          try {
            const g = await c(B), Y = await s(g);
            if (Y.isFile())
              return "file";
            if (Y.isDirectory()) {
              const z = g.length;
              if (B.startsWith(g) && B.substr(z, 1) === p.sep) {
                const re = new Error(
                  `Circular symlink detected: "${B}" points to "${g}"`
                );
                return re.code = f, this._onError(re);
              }
              return "directory";
            }
          } catch (g) {
            this._onError(g);
          }
        }
      }
    }
    _includeAsFile(F) {
      const k = F && F[this._statsProp];
      return k && this._wantsEverything && !k.isDirectory();
    }
  }
  const v = (I, F = {}) => {
    let k = F.entryType || F.type;
    if (k === "both" && (k = M), k && (F.type = k), I) {
      if (typeof I != "string")
        throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
      if (k && !C.includes(k))
        throw new Error(`readdirp: Invalid type passed. Use one of ${C.join(", ")}`);
    } else throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
    return F.root = I, new D(F);
  }, K = (I, F = {}) => new Promise((k, B) => {
    const g = [];
    v(I, F).on("data", (Y) => g.push(Y)).on("end", () => k(g)).on("error", (Y) => B(Y));
  });
  return v.promise = K, v.ReaddirpStream = D, v.default = v, Ie = v, Ie;
}
var be = { exports: {} }, $e = {}, Pe, gt;
function Ce() {
  if (gt) return Pe;
  gt = 1;
  const a = ge, r = "\\\\/", p = `[^${r}]`, A = "\\.", S = "\\+", y = "\\?", l = "\\/", s = "(?=.)", c = "[^/]", h = `(?:${l}|$)`, f = `(?:^|${l})`, T = `${A}{1,2}${h}`, n = `(?!${A})`, V = `(?!${f}${T})`, M = `(?!${A}{0,1}${h})`, j = `(?!${T})`, C = `[^.${l}]`, O = `${c}*?`, W = {
    DOT_LITERAL: A,
    PLUS_LITERAL: S,
    QMARK_LITERAL: y,
    SLASH_LITERAL: l,
    ONE_CHAR: s,
    QMARK: c,
    END_ANCHOR: h,
    DOTS_SLASH: T,
    NO_DOT: n,
    NO_DOTS: V,
    NO_DOT_SLASH: M,
    NO_DOTS_SLASH: j,
    QMARK_NO_DOT: C,
    STAR: O,
    START_ANCHOR: f
  }, u = {
    ...W,
    SLASH_LITERAL: `[${r}]`,
    QMARK: p,
    STAR: `${p}*?`,
    DOTS_SLASH: `${A}{1,2}(?:[${r}]|$)`,
    NO_DOT: `(?!${A})`,
    NO_DOTS: `(?!(?:^|[${r}])${A}{1,2}(?:[${r}]|$))`,
    NO_DOT_SLASH: `(?!${A}{0,1}(?:[${r}]|$))`,
    NO_DOTS_SLASH: `(?!${A}{1,2}(?:[${r}]|$))`,
    QMARK_NO_DOT: `[^.${r}]`,
    START_ANCHOR: `(?:^|[${r}])`,
    END_ANCHOR: `(?:[${r}]|$)`
  }, N = {
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
  return Pe = {
    MAX_LENGTH: 1024 * 64,
    POSIX_REGEX_SOURCE: N,
    // regular expressions
    REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
    REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
    REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
    REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
    REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
    REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
    // Replace globs with equivalent patterns to reduce parsing time.
    REPLACEMENTS: {
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
    SEP: a.sep,
    /**
     * Create EXTGLOB_CHARS
     */
    extglobChars(b) {
      return {
        "!": { type: "negate", open: "(?:(?!(?:", close: `))${b.STAR})` },
        "?": { type: "qmark", open: "(?:", close: ")?" },
        "+": { type: "plus", open: "(?:", close: ")+" },
        "*": { type: "star", open: "(?:", close: ")*" },
        "@": { type: "at", open: "(?:", close: ")" }
      };
    },
    /**
     * Create GLOB_CHARS
     */
    globChars(b) {
      return b === !0 ? u : W;
    }
  }, Pe;
}
var Rt;
function nt() {
  return Rt || (Rt = 1, (function(a) {
    const r = ge, p = process.platform === "win32", {
      REGEX_BACKSLASH: A,
      REGEX_REMOVE_BACKSLASH: S,
      REGEX_SPECIAL_CHARS: y,
      REGEX_SPECIAL_CHARS_GLOBAL: l
    } = /* @__PURE__ */ Ce();
    a.isObject = (s) => s !== null && typeof s == "object" && !Array.isArray(s), a.hasRegexChars = (s) => y.test(s), a.isRegexChar = (s) => s.length === 1 && a.hasRegexChars(s), a.escapeRegex = (s) => s.replace(l, "\\$1"), a.toPosixSlashes = (s) => s.replace(A, "/"), a.removeBackslashes = (s) => s.replace(S, (c) => c === "\\" ? "" : c), a.supportsLookbehinds = () => {
      const s = process.version.slice(1).split(".").map(Number);
      return s.length === 3 && s[0] >= 9 || s[0] === 8 && s[1] >= 10;
    }, a.isWindows = (s) => s && typeof s.windows == "boolean" ? s.windows : p === !0 || r.sep === "\\", a.escapeLast = (s, c, h) => {
      const f = s.lastIndexOf(c, h);
      return f === -1 ? s : s[f - 1] === "\\" ? a.escapeLast(s, c, f - 1) : `${s.slice(0, f)}\\${s.slice(f)}`;
    }, a.removePrefix = (s, c = {}) => {
      let h = s;
      return h.startsWith("./") && (h = h.slice(2), c.prefix = "./"), h;
    }, a.wrapOutput = (s, c = {}, h = {}) => {
      const f = h.contains ? "" : "^", T = h.contains ? "" : "$";
      let n = `${f}(?:${s})${T}`;
      return c.negated === !0 && (n = `(?:^(?!${n}).*$)`), n;
    };
  })($e)), $e;
}
var De, At;
function cs() {
  if (At) return De;
  At = 1;
  const a = /* @__PURE__ */ nt(), {
    CHAR_ASTERISK: r,
    /* * */
    CHAR_AT: p,
    /* @ */
    CHAR_BACKWARD_SLASH: A,
    /* \ */
    CHAR_COMMA: S,
    /* , */
    CHAR_DOT: y,
    /* . */
    CHAR_EXCLAMATION_MARK: l,
    /* ! */
    CHAR_FORWARD_SLASH: s,
    /* / */
    CHAR_LEFT_CURLY_BRACE: c,
    /* { */
    CHAR_LEFT_PARENTHESES: h,
    /* ( */
    CHAR_LEFT_SQUARE_BRACKET: f,
    /* [ */
    CHAR_PLUS: T,
    /* + */
    CHAR_QUESTION_MARK: n,
    /* ? */
    CHAR_RIGHT_CURLY_BRACE: V,
    /* } */
    CHAR_RIGHT_PARENTHESES: M,
    /* ) */
    CHAR_RIGHT_SQUARE_BRACKET: j
    /* ] */
  } = /* @__PURE__ */ Ce(), C = (u) => u === s || u === A, O = (u) => {
    u.isPrefix !== !0 && (u.depth = u.isGlobstar ? 1 / 0 : 1);
  };
  return De = (u, N) => {
    const b = N || {}, D = u.length - 1, v = b.parts === !0 || b.scanToEnd === !0, K = [], I = [], F = [];
    let k = u, B = -1, g = 0, Y = 0, z = !1, re = !1, X = !1, oe = !1, he = !1, ne = !1, i = !1, ue = !1, se = !1, L = !1, t = 0, e, _, R = { value: "", depth: 0, isGlob: !1 };
    const P = () => B >= D, x = () => k.charCodeAt(B + 1), H = () => (e = _, k.charCodeAt(++B));
    for (; B < D; ) {
      _ = H();
      let w;
      if (_ === A) {
        i = R.backslashes = !0, _ = H(), _ === c && (ne = !0);
        continue;
      }
      if (ne === !0 || _ === c) {
        for (t++; P() !== !0 && (_ = H()); ) {
          if (_ === A) {
            i = R.backslashes = !0, H();
            continue;
          }
          if (_ === c) {
            t++;
            continue;
          }
          if (ne !== !0 && _ === y && (_ = H()) === y) {
            if (z = R.isBrace = !0, X = R.isGlob = !0, L = !0, v === !0)
              continue;
            break;
          }
          if (ne !== !0 && _ === S) {
            if (z = R.isBrace = !0, X = R.isGlob = !0, L = !0, v === !0)
              continue;
            break;
          }
          if (_ === V && (t--, t === 0)) {
            ne = !1, z = R.isBrace = !0, L = !0;
            break;
          }
        }
        if (v === !0)
          continue;
        break;
      }
      if (_ === s) {
        if (K.push(B), I.push(R), R = { value: "", depth: 0, isGlob: !1 }, L === !0) continue;
        if (e === y && B === g + 1) {
          g += 2;
          continue;
        }
        Y = B + 1;
        continue;
      }
      if (b.noext !== !0 && (_ === T || _ === p || _ === r || _ === n || _ === l) === !0 && x() === h) {
        if (X = R.isGlob = !0, oe = R.isExtglob = !0, L = !0, _ === l && B === g && (se = !0), v === !0) {
          for (; P() !== !0 && (_ = H()); ) {
            if (_ === A) {
              i = R.backslashes = !0, _ = H();
              continue;
            }
            if (_ === M) {
              X = R.isGlob = !0, L = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (_ === r) {
        if (e === r && (he = R.isGlobstar = !0), X = R.isGlob = !0, L = !0, v === !0)
          continue;
        break;
      }
      if (_ === n) {
        if (X = R.isGlob = !0, L = !0, v === !0)
          continue;
        break;
      }
      if (_ === f) {
        for (; P() !== !0 && (w = H()); ) {
          if (w === A) {
            i = R.backslashes = !0, H();
            continue;
          }
          if (w === j) {
            re = R.isBracket = !0, X = R.isGlob = !0, L = !0;
            break;
          }
        }
        if (v === !0)
          continue;
        break;
      }
      if (b.nonegate !== !0 && _ === l && B === g) {
        ue = R.negated = !0, g++;
        continue;
      }
      if (b.noparen !== !0 && _ === h) {
        if (X = R.isGlob = !0, v === !0) {
          for (; P() !== !0 && (_ = H()); ) {
            if (_ === h) {
              i = R.backslashes = !0, _ = H();
              continue;
            }
            if (_ === M) {
              L = !0;
              break;
            }
          }
          continue;
        }
        break;
      }
      if (X === !0) {
        if (L = !0, v === !0)
          continue;
        break;
      }
    }
    b.noext === !0 && (oe = !1, X = !1);
    let $ = k, Q = "", G = "";
    g > 0 && (Q = k.slice(0, g), k = k.slice(g), Y -= g), $ && X === !0 && Y > 0 ? ($ = k.slice(0, Y), G = k.slice(Y)) : X === !0 ? ($ = "", G = k) : $ = k, $ && $ !== "" && $ !== "/" && $ !== k && C($.charCodeAt($.length - 1)) && ($ = $.slice(0, -1)), b.unescape === !0 && (G && (G = a.removeBackslashes(G)), $ && i === !0 && ($ = a.removeBackslashes($)));
    const U = {
      prefix: Q,
      input: u,
      start: g,
      base: $,
      glob: G,
      isBrace: z,
      isBracket: re,
      isGlob: X,
      isExtglob: oe,
      isGlobstar: he,
      negated: ue,
      negatedExtglob: se
    };
    if (b.tokens === !0 && (U.maxDepth = 0, C(_) || I.push(R), U.tokens = I), b.parts === !0 || b.tokens === !0) {
      let w;
      for (let Z = 0; Z < K.length; Z++) {
        const de = w ? w + 1 : g, m = K[Z], te = u.slice(de, m);
        b.tokens && (Z === 0 && g !== 0 ? (I[Z].isPrefix = !0, I[Z].value = Q) : I[Z].value = te, O(I[Z]), U.maxDepth += I[Z].depth), (Z !== 0 || te !== "") && F.push(te), w = m;
      }
      if (w && w + 1 < u.length) {
        const Z = u.slice(w + 1);
        F.push(Z), b.tokens && (I[I.length - 1].value = Z, O(I[I.length - 1]), U.maxDepth += I[I.length - 1].depth);
      }
      U.slashes = K, U.parts = F;
    }
    return U;
  }, De;
}
var ke, mt;
function ls() {
  if (mt) return ke;
  mt = 1;
  const a = /* @__PURE__ */ Ce(), r = /* @__PURE__ */ nt(), {
    MAX_LENGTH: p,
    POSIX_REGEX_SOURCE: A,
    REGEX_NON_SPECIAL_CHARS: S,
    REGEX_SPECIAL_CHARS_BACKREF: y,
    REPLACEMENTS: l
  } = a, s = (f, T) => typeof T.expandRange == "function" ? T.expandRange(...f, T) : (f.sort(), `[${f.join("-")}]`), c = (f, T) => `Missing ${f}: "${T}" - use "\\\\${T}" to match literal characters`, h = (f, T) => {
    if (typeof f != "string")
      throw new TypeError("Expected a string");
    f = l[f] || f;
    const n = { ...T }, V = typeof n.maxLength == "number" ? Math.min(p, n.maxLength) : p;
    let M = f.length;
    if (M > V)
      throw new SyntaxError(`Input length: ${M}, exceeds maximum allowed length: ${V}`);
    const j = { type: "bos", value: "", output: n.prepend || "" }, C = [j], O = n.capture ? "" : "?:", W = r.isWindows(T), u = a.globChars(W), N = a.extglobChars(u), {
      DOT_LITERAL: b,
      PLUS_LITERAL: D,
      SLASH_LITERAL: v,
      ONE_CHAR: K,
      DOTS_SLASH: I,
      NO_DOT: F,
      NO_DOT_SLASH: k,
      NO_DOTS_SLASH: B,
      QMARK: g,
      QMARK_NO_DOT: Y,
      STAR: z,
      START_ANCHOR: re
    } = u, X = (m) => `(${O}(?:(?!${re}${m.dot ? I : b}).)*?)`, oe = n.dot ? "" : F, he = n.dot ? g : Y;
    let ne = n.bash === !0 ? X(n) : z;
    n.capture && (ne = `(${ne})`), typeof n.noext == "boolean" && (n.noextglob = n.noext);
    const i = {
      input: f,
      index: -1,
      start: 0,
      dot: n.dot === !0,
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
      tokens: C
    };
    f = r.removePrefix(f, i), M = f.length;
    const ue = [], se = [], L = [];
    let t = j, e;
    const _ = () => i.index === M - 1, R = i.peek = (m = 1) => f[i.index + m], P = i.advance = () => f[++i.index] || "", x = () => f.slice(i.index + 1), H = (m = "", te = 0) => {
      i.consumed += m, i.index += te;
    }, $ = (m) => {
      i.output += m.output != null ? m.output : m.value, H(m.value);
    }, Q = () => {
      let m = 1;
      for (; R() === "!" && (R(2) !== "(" || R(3) === "?"); )
        P(), i.start++, m++;
      return m % 2 === 0 ? !1 : (i.negated = !0, i.start++, !0);
    }, G = (m) => {
      i[m]++, L.push(m);
    }, U = (m) => {
      i[m]--, L.pop();
    }, w = (m) => {
      if (t.type === "globstar") {
        const te = i.braces > 0 && (m.type === "comma" || m.type === "brace"), E = m.extglob === !0 || ue.length && (m.type === "pipe" || m.type === "paren");
        m.type !== "slash" && m.type !== "paren" && !te && !E && (i.output = i.output.slice(0, -t.output.length), t.type = "star", t.value = "*", t.output = ne, i.output += t.output);
      }
      if (ue.length && m.type !== "paren" && (ue[ue.length - 1].inner += m.value), (m.value || m.output) && $(m), t && t.type === "text" && m.type === "text") {
        t.value += m.value, t.output = (t.output || "") + m.value;
        return;
      }
      m.prev = t, C.push(m), t = m;
    }, Z = (m, te) => {
      const E = { ...N[te], conditions: 1, inner: "" };
      E.prev = t, E.parens = i.parens, E.output = i.output;
      const q = (n.capture ? "(" : "") + E.open;
      G("parens"), w({ type: m, value: te, output: i.output ? "" : K }), w({ type: "paren", extglob: !0, value: P(), output: q }), ue.push(E);
    }, de = (m) => {
      let te = m.close + (n.capture ? ")" : ""), E;
      if (m.type === "negate") {
        let q = ne;
        if (m.inner && m.inner.length > 1 && m.inner.includes("/") && (q = X(n)), (q !== ne || _() || /^\)+$/.test(x())) && (te = m.close = `)$))${q}`), m.inner.includes("*") && (E = x()) && /^\.[^\\/.]+$/.test(E)) {
          const ae = h(E, { ...T, fastpaths: !1 }).output;
          te = m.close = `)${ae})${q})`;
        }
        m.prev.type === "bos" && (i.negatedExtglob = !0);
      }
      w({ type: "paren", extglob: !0, value: e, output: te }), U("parens");
    };
    if (n.fastpaths !== !1 && !/(^[*!]|[/()[\]{}"])/.test(f)) {
      let m = !1, te = f.replace(y, (E, q, ae, ie, o, d) => ie === "\\" ? (m = !0, E) : ie === "?" ? q ? q + ie + (o ? g.repeat(o.length) : "") : d === 0 ? he + (o ? g.repeat(o.length) : "") : g.repeat(ae.length) : ie === "." ? b.repeat(ae.length) : ie === "*" ? q ? q + ie + (o ? ne : "") : ne : q ? E : `\\${E}`);
      return m === !0 && (n.unescape === !0 ? te = te.replace(/\\/g, "") : te = te.replace(/\\+/g, (E) => E.length % 2 === 0 ? "\\\\" : E ? "\\" : "")), te === f && n.contains === !0 ? (i.output = f, i) : (i.output = r.wrapOutput(te, i, T), i);
    }
    for (; !_(); ) {
      if (e = P(), e === "\0")
        continue;
      if (e === "\\") {
        const E = R();
        if (E === "/" && n.bash !== !0 || E === "." || E === ";")
          continue;
        if (!E) {
          e += "\\", w({ type: "text", value: e });
          continue;
        }
        const q = /^\\+/.exec(x());
        let ae = 0;
        if (q && q[0].length > 2 && (ae = q[0].length, i.index += ae, ae % 2 !== 0 && (e += "\\")), n.unescape === !0 ? e = P() : e += P(), i.brackets === 0) {
          w({ type: "text", value: e });
          continue;
        }
      }
      if (i.brackets > 0 && (e !== "]" || t.value === "[" || t.value === "[^")) {
        if (n.posix !== !1 && e === ":") {
          const E = t.value.slice(1);
          if (E.includes("[") && (t.posix = !0, E.includes(":"))) {
            const q = t.value.lastIndexOf("["), ae = t.value.slice(0, q), ie = t.value.slice(q + 2), o = A[ie];
            if (o) {
              t.value = ae + o, i.backtrack = !0, P(), !j.output && C.indexOf(t) === 1 && (j.output = K);
              continue;
            }
          }
        }
        (e === "[" && R() !== ":" || e === "-" && R() === "]") && (e = `\\${e}`), e === "]" && (t.value === "[" || t.value === "[^") && (e = `\\${e}`), n.posix === !0 && e === "!" && t.value === "[" && (e = "^"), t.value += e, $({ value: e });
        continue;
      }
      if (i.quotes === 1 && e !== '"') {
        e = r.escapeRegex(e), t.value += e, $({ value: e });
        continue;
      }
      if (e === '"') {
        i.quotes = i.quotes === 1 ? 0 : 1, n.keepQuotes === !0 && w({ type: "text", value: e });
        continue;
      }
      if (e === "(") {
        G("parens"), w({ type: "paren", value: e });
        continue;
      }
      if (e === ")") {
        if (i.parens === 0 && n.strictBrackets === !0)
          throw new SyntaxError(c("opening", "("));
        const E = ue[ue.length - 1];
        if (E && i.parens === E.parens + 1) {
          de(ue.pop());
          continue;
        }
        w({ type: "paren", value: e, output: i.parens ? ")" : "\\)" }), U("parens");
        continue;
      }
      if (e === "[") {
        if (n.nobracket === !0 || !x().includes("]")) {
          if (n.nobracket !== !0 && n.strictBrackets === !0)
            throw new SyntaxError(c("closing", "]"));
          e = `\\${e}`;
        } else
          G("brackets");
        w({ type: "bracket", value: e });
        continue;
      }
      if (e === "]") {
        if (n.nobracket === !0 || t && t.type === "bracket" && t.value.length === 1) {
          w({ type: "text", value: e, output: `\\${e}` });
          continue;
        }
        if (i.brackets === 0) {
          if (n.strictBrackets === !0)
            throw new SyntaxError(c("opening", "["));
          w({ type: "text", value: e, output: `\\${e}` });
          continue;
        }
        U("brackets");
        const E = t.value.slice(1);
        if (t.posix !== !0 && E[0] === "^" && !E.includes("/") && (e = `/${e}`), t.value += e, $({ value: e }), n.literalBrackets === !1 || r.hasRegexChars(E))
          continue;
        const q = r.escapeRegex(t.value);
        if (i.output = i.output.slice(0, -t.value.length), n.literalBrackets === !0) {
          i.output += q, t.value = q;
          continue;
        }
        t.value = `(${O}${q}|${t.value})`, i.output += t.value;
        continue;
      }
      if (e === "{" && n.nobrace !== !0) {
        G("braces");
        const E = {
          type: "brace",
          value: e,
          output: "(",
          outputIndex: i.output.length,
          tokensIndex: i.tokens.length
        };
        se.push(E), w(E);
        continue;
      }
      if (e === "}") {
        const E = se[se.length - 1];
        if (n.nobrace === !0 || !E) {
          w({ type: "text", value: e, output: e });
          continue;
        }
        let q = ")";
        if (E.dots === !0) {
          const ae = C.slice(), ie = [];
          for (let o = ae.length - 1; o >= 0 && (C.pop(), ae[o].type !== "brace"); o--)
            ae[o].type !== "dots" && ie.unshift(ae[o].value);
          q = s(ie, n), i.backtrack = !0;
        }
        if (E.comma !== !0 && E.dots !== !0) {
          const ae = i.output.slice(0, E.outputIndex), ie = i.tokens.slice(E.tokensIndex);
          E.value = E.output = "\\{", e = q = "\\}", i.output = ae;
          for (const o of ie)
            i.output += o.output || o.value;
        }
        w({ type: "brace", value: e, output: q }), U("braces"), se.pop();
        continue;
      }
      if (e === "|") {
        ue.length > 0 && ue[ue.length - 1].conditions++, w({ type: "text", value: e });
        continue;
      }
      if (e === ",") {
        let E = e;
        const q = se[se.length - 1];
        q && L[L.length - 1] === "braces" && (q.comma = !0, E = "|"), w({ type: "comma", value: e, output: E });
        continue;
      }
      if (e === "/") {
        if (t.type === "dot" && i.index === i.start + 1) {
          i.start = i.index + 1, i.consumed = "", i.output = "", C.pop(), t = j;
          continue;
        }
        w({ type: "slash", value: e, output: v });
        continue;
      }
      if (e === ".") {
        if (i.braces > 0 && t.type === "dot") {
          t.value === "." && (t.output = b);
          const E = se[se.length - 1];
          t.type = "dots", t.output += e, t.value += e, E.dots = !0;
          continue;
        }
        if (i.braces + i.parens === 0 && t.type !== "bos" && t.type !== "slash") {
          w({ type: "text", value: e, output: b });
          continue;
        }
        w({ type: "dot", value: e, output: b });
        continue;
      }
      if (e === "?") {
        if (!(t && t.value === "(") && n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          Z("qmark", e);
          continue;
        }
        if (t && t.type === "paren") {
          const q = R();
          let ae = e;
          if (q === "<" && !r.supportsLookbehinds())
            throw new Error("Node.js v10 or higher is required for regex lookbehinds");
          (t.value === "(" && !/[!=<:]/.test(q) || q === "<" && !/<([!=]|\w+>)/.test(x())) && (ae = `\\${e}`), w({ type: "text", value: e, output: ae });
          continue;
        }
        if (n.dot !== !0 && (t.type === "slash" || t.type === "bos")) {
          w({ type: "qmark", value: e, output: Y });
          continue;
        }
        w({ type: "qmark", value: e, output: g });
        continue;
      }
      if (e === "!") {
        if (n.noextglob !== !0 && R() === "(" && (R(2) !== "?" || !/[!=<:]/.test(R(3)))) {
          Z("negate", e);
          continue;
        }
        if (n.nonegate !== !0 && i.index === 0) {
          Q();
          continue;
        }
      }
      if (e === "+") {
        if (n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          Z("plus", e);
          continue;
        }
        if (t && t.value === "(" || n.regex === !1) {
          w({ type: "plus", value: e, output: D });
          continue;
        }
        if (t && (t.type === "bracket" || t.type === "paren" || t.type === "brace") || i.parens > 0) {
          w({ type: "plus", value: e });
          continue;
        }
        w({ type: "plus", value: D });
        continue;
      }
      if (e === "@") {
        if (n.noextglob !== !0 && R() === "(" && R(2) !== "?") {
          w({ type: "at", extglob: !0, value: e, output: "" });
          continue;
        }
        w({ type: "text", value: e });
        continue;
      }
      if (e !== "*") {
        (e === "$" || e === "^") && (e = `\\${e}`);
        const E = S.exec(x());
        E && (e += E[0], i.index += E[0].length), w({ type: "text", value: e });
        continue;
      }
      if (t && (t.type === "globstar" || t.star === !0)) {
        t.type = "star", t.star = !0, t.value += e, t.output = ne, i.backtrack = !0, i.globstar = !0, H(e);
        continue;
      }
      let m = x();
      if (n.noextglob !== !0 && /^\([^?]/.test(m)) {
        Z("star", e);
        continue;
      }
      if (t.type === "star") {
        if (n.noglobstar === !0) {
          H(e);
          continue;
        }
        const E = t.prev, q = E.prev, ae = E.type === "slash" || E.type === "bos", ie = q && (q.type === "star" || q.type === "globstar");
        if (n.bash === !0 && (!ae || m[0] && m[0] !== "/")) {
          w({ type: "star", value: e, output: "" });
          continue;
        }
        const o = i.braces > 0 && (E.type === "comma" || E.type === "brace"), d = ue.length && (E.type === "pipe" || E.type === "paren");
        if (!ae && E.type !== "paren" && !o && !d) {
          w({ type: "star", value: e, output: "" });
          continue;
        }
        for (; m.slice(0, 3) === "/**"; ) {
          const ee = f[i.index + 4];
          if (ee && ee !== "/")
            break;
          m = m.slice(3), H("/**", 3);
        }
        if (E.type === "bos" && _()) {
          t.type = "globstar", t.value += e, t.output = X(n), i.output = t.output, i.globstar = !0, H(e);
          continue;
        }
        if (E.type === "slash" && E.prev.type !== "bos" && !ie && _()) {
          i.output = i.output.slice(0, -(E.output + t.output).length), E.output = `(?:${E.output}`, t.type = "globstar", t.output = X(n) + (n.strictSlashes ? ")" : "|$)"), t.value += e, i.globstar = !0, i.output += E.output + t.output, H(e);
          continue;
        }
        if (E.type === "slash" && E.prev.type !== "bos" && m[0] === "/") {
          const ee = m[1] !== void 0 ? "|$" : "";
          i.output = i.output.slice(0, -(E.output + t.output).length), E.output = `(?:${E.output}`, t.type = "globstar", t.output = `${X(n)}${v}|${v}${ee})`, t.value += e, i.output += E.output + t.output, i.globstar = !0, H(e + P()), w({ type: "slash", value: "/", output: "" });
          continue;
        }
        if (E.type === "bos" && m[0] === "/") {
          t.type = "globstar", t.value += e, t.output = `(?:^|${v}|${X(n)}${v})`, i.output = t.output, i.globstar = !0, H(e + P()), w({ type: "slash", value: "/", output: "" });
          continue;
        }
        i.output = i.output.slice(0, -t.output.length), t.type = "globstar", t.output = X(n), t.value += e, i.output += t.output, i.globstar = !0, H(e);
        continue;
      }
      const te = { type: "star", value: e, output: ne };
      if (n.bash === !0) {
        te.output = ".*?", (t.type === "bos" || t.type === "slash") && (te.output = oe + te.output), w(te);
        continue;
      }
      if (t && (t.type === "bracket" || t.type === "paren") && n.regex === !0) {
        te.output = e, w(te);
        continue;
      }
      (i.index === i.start || t.type === "slash" || t.type === "dot") && (t.type === "dot" ? (i.output += k, t.output += k) : n.dot === !0 ? (i.output += B, t.output += B) : (i.output += oe, t.output += oe), R() !== "*" && (i.output += K, t.output += K)), w(te);
    }
    for (; i.brackets > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", "]"));
      i.output = r.escapeLast(i.output, "["), U("brackets");
    }
    for (; i.parens > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", ")"));
      i.output = r.escapeLast(i.output, "("), U("parens");
    }
    for (; i.braces > 0; ) {
      if (n.strictBrackets === !0) throw new SyntaxError(c("closing", "}"));
      i.output = r.escapeLast(i.output, "{"), U("braces");
    }
    if (n.strictSlashes !== !0 && (t.type === "star" || t.type === "bracket") && w({ type: "maybe_slash", value: "", output: `${v}?` }), i.backtrack === !0) {
      i.output = "";
      for (const m of i.tokens)
        i.output += m.output != null ? m.output : m.value, m.suffix && (i.output += m.suffix);
    }
    return i;
  };
  return h.fastpaths = (f, T) => {
    const n = { ...T }, V = typeof n.maxLength == "number" ? Math.min(p, n.maxLength) : p, M = f.length;
    if (M > V)
      throw new SyntaxError(`Input length: ${M}, exceeds maximum allowed length: ${V}`);
    f = l[f] || f;
    const j = r.isWindows(T), {
      DOT_LITERAL: C,
      SLASH_LITERAL: O,
      ONE_CHAR: W,
      DOTS_SLASH: u,
      NO_DOT: N,
      NO_DOTS: b,
      NO_DOTS_SLASH: D,
      STAR: v,
      START_ANCHOR: K
    } = a.globChars(j), I = n.dot ? b : N, F = n.dot ? D : N, k = n.capture ? "" : "?:", B = { negated: !1, prefix: "" };
    let g = n.bash === !0 ? ".*?" : v;
    n.capture && (g = `(${g})`);
    const Y = (oe) => oe.noglobstar === !0 ? g : `(${k}(?:(?!${K}${oe.dot ? u : C}).)*?)`, z = (oe) => {
      switch (oe) {
        case "*":
          return `${I}${W}${g}`;
        case ".*":
          return `${C}${W}${g}`;
        case "*.*":
          return `${I}${g}${C}${W}${g}`;
        case "*/*":
          return `${I}${g}${O}${W}${F}${g}`;
        case "**":
          return I + Y(n);
        case "**/*":
          return `(?:${I}${Y(n)}${O})?${F}${W}${g}`;
        case "**/*.*":
          return `(?:${I}${Y(n)}${O})?${F}${g}${C}${W}${g}`;
        case "**/.*":
          return `(?:${I}${Y(n)}${O})?${C}${W}${g}`;
        default: {
          const he = /^(.*?)\.(\w+)$/.exec(oe);
          if (!he) return;
          const ne = z(he[1]);
          return ne ? ne + C + he[2] : void 0;
        }
      }
    }, re = r.removePrefix(f, B);
    let X = z(re);
    return X && n.strictSlashes !== !0 && (X += `${O}?`), X;
  }, ke = h, ke;
}
var Fe, yt;
function fs() {
  if (yt) return Fe;
  yt = 1;
  const a = ge, r = /* @__PURE__ */ cs(), p = /* @__PURE__ */ ls(), A = /* @__PURE__ */ nt(), S = /* @__PURE__ */ Ce(), y = (s) => s && typeof s == "object" && !Array.isArray(s), l = (s, c, h = !1) => {
    if (Array.isArray(s)) {
      const O = s.map((u) => l(u, c, h));
      return (u) => {
        for (const N of O) {
          const b = N(u);
          if (b) return b;
        }
        return !1;
      };
    }
    const f = y(s) && s.tokens && s.input;
    if (s === "" || typeof s != "string" && !f)
      throw new TypeError("Expected pattern to be a non-empty string");
    const T = c || {}, n = A.isWindows(c), V = f ? l.compileRe(s, c) : l.makeRe(s, c, !1, !0), M = V.state;
    delete V.state;
    let j = () => !1;
    if (T.ignore) {
      const O = { ...c, ignore: null, onMatch: null, onResult: null };
      j = l(T.ignore, O, h);
    }
    const C = (O, W = !1) => {
      const { isMatch: u, match: N, output: b } = l.test(O, V, c, { glob: s, posix: n }), D = { glob: s, state: M, regex: V, posix: n, input: O, output: b, match: N, isMatch: u };
      return typeof T.onResult == "function" && T.onResult(D), u === !1 ? (D.isMatch = !1, W ? D : !1) : j(O) ? (typeof T.onIgnore == "function" && T.onIgnore(D), D.isMatch = !1, W ? D : !1) : (typeof T.onMatch == "function" && T.onMatch(D), W ? D : !0);
    };
    return h && (C.state = M), C;
  };
  return l.test = (s, c, h, { glob: f, posix: T } = {}) => {
    if (typeof s != "string")
      throw new TypeError("Expected input to be a string");
    if (s === "")
      return { isMatch: !1, output: "" };
    const n = h || {}, V = n.format || (T ? A.toPosixSlashes : null);
    let M = s === f, j = M && V ? V(s) : s;
    return M === !1 && (j = V ? V(s) : s, M = j === f), (M === !1 || n.capture === !0) && (n.matchBase === !0 || n.basename === !0 ? M = l.matchBase(s, c, h, T) : M = c.exec(j)), { isMatch: !!M, match: M, output: j };
  }, l.matchBase = (s, c, h, f = A.isWindows(h)) => (c instanceof RegExp ? c : l.makeRe(c, h)).test(a.basename(s)), l.isMatch = (s, c, h) => l(c, h)(s), l.parse = (s, c) => Array.isArray(s) ? s.map((h) => l.parse(h, c)) : p(s, { ...c, fastpaths: !1 }), l.scan = (s, c) => r(s, c), l.compileRe = (s, c, h = !1, f = !1) => {
    if (h === !0)
      return s.output;
    const T = c || {}, n = T.contains ? "" : "^", V = T.contains ? "" : "$";
    let M = `${n}(?:${s.output})${V}`;
    s && s.negated === !0 && (M = `^(?!${M}).*$`);
    const j = l.toRegex(M, c);
    return f === !0 && (j.state = s), j;
  }, l.makeRe = (s, c = {}, h = !1, f = !1) => {
    if (!s || typeof s != "string")
      throw new TypeError("Expected a non-empty string");
    let T = { negated: !1, fastpaths: !0 };
    return c.fastpaths !== !1 && (s[0] === "." || s[0] === "*") && (T.output = p.fastpaths(s, c)), T.output || (T = p(s, c)), l.compileRe(T, c, h, f);
  }, l.toRegex = (s, c) => {
    try {
      const h = c || {};
      return new RegExp(s, h.flags || (h.nocase ? "i" : ""));
    } catch (h) {
      if (c && c.debug === !0) throw h;
      return /$^/;
    }
  }, l.constants = S, Fe = l, Fe;
}
var Me, wt;
function hs() {
  return wt || (wt = 1, Me = /* @__PURE__ */ fs()), Me;
}
var Be, bt;
function qt() {
  return bt || (bt = 1, Be = function(a, r) {
    if (typeof a != "string")
      throw new TypeError("expected path to be a string");
    if (a === "\\" || a === "/") return "/";
    var p = a.length;
    if (p <= 1) return a;
    var A = "";
    if (p > 4 && a[3] === "\\") {
      var S = a[2];
      (S === "?" || S === ".") && a.slice(0, 2) === "\\\\" && (a = a.slice(2), A = "//");
    }
    var y = a.split(/[/\\]+/);
    return r !== !1 && y[y.length - 1] === "" && y.pop(), A + y.join("/");
  }), Be;
}
var ps = be.exports, St;
function ds() {
  if (St) return be.exports;
  St = 1, Object.defineProperty(ps, "__esModule", { value: !0 });
  const a = /* @__PURE__ */ hs(), r = /* @__PURE__ */ qt(), p = "!", A = { returnIndex: !1 }, S = (c) => Array.isArray(c) ? c : [c], y = (c, h) => {
    if (typeof c == "function")
      return c;
    if (typeof c == "string") {
      const f = a(c, h);
      return (T) => c === T || f(T);
    }
    return c instanceof RegExp ? (f) => c.test(f) : (f) => !1;
  }, l = (c, h, f, T) => {
    const n = Array.isArray(f), V = n ? f[0] : f;
    if (!n && typeof V != "string")
      throw new TypeError("anymatch: second argument must be a string: got " + Object.prototype.toString.call(V));
    const M = r(V, !1);
    for (let C = 0; C < h.length; C++) {
      const O = h[C];
      if (O(M))
        return T ? -1 : !1;
    }
    const j = n && [M].concat(f.slice(1));
    for (let C = 0; C < c.length; C++) {
      const O = c[C];
      if (n ? O(...j) : O(M))
        return T ? C : !0;
    }
    return T ? -1 : !1;
  }, s = (c, h, f = A) => {
    if (c == null)
      throw new TypeError("anymatch: specify first argument");
    const T = typeof f == "boolean" ? { returnIndex: f } : f, n = T.returnIndex || !1, V = S(c), M = V.filter((C) => typeof C == "string" && C.charAt(0) === p).map((C) => C.slice(1)).map((C) => a(C, T)), j = V.filter((C) => typeof C != "string" || typeof C == "string" && C.charAt(0) !== p).map((C) => y(C, T));
    return h == null ? (C, O = !1) => l(j, M, C, typeof O == "boolean" ? O : !1) : l(j, M, h, n);
  };
  return s.default = s, be.exports = s, be.exports;
}
var Ge, vt;
function _s() {
  return vt || (vt = 1, Ge = function(r) {
    if (typeof r != "string" || r === "")
      return !1;
    for (var p; p = /(\\).|([@?!+*]\(.*\))/g.exec(r); ) {
      if (p[2]) return !0;
      r = r.slice(p.index + p[0].length);
    }
    return !1;
  }), Ge;
}
var We, Ct;
function Vt() {
  if (Ct) return We;
  Ct = 1;
  var a = /* @__PURE__ */ _s(), r = { "{": "}", "(": ")", "[": "]" }, p = function(S) {
    if (S[0] === "!")
      return !0;
    for (var y = 0, l = -2, s = -2, c = -2, h = -2, f = -2; y < S.length; ) {
      if (S[y] === "*" || S[y + 1] === "?" && /[\].+)]/.test(S[y]) || s !== -1 && S[y] === "[" && S[y + 1] !== "]" && (s < y && (s = S.indexOf("]", y)), s > y && (f === -1 || f > s || (f = S.indexOf("\\", y), f === -1 || f > s))) || c !== -1 && S[y] === "{" && S[y + 1] !== "}" && (c = S.indexOf("}", y), c > y && (f = S.indexOf("\\", y), f === -1 || f > c)) || h !== -1 && S[y] === "(" && S[y + 1] === "?" && /[:!=]/.test(S[y + 2]) && S[y + 3] !== ")" && (h = S.indexOf(")", y), h > y && (f = S.indexOf("\\", y), f === -1 || f > h)) || l !== -1 && S[y] === "(" && S[y + 1] !== "|" && (l < y && (l = S.indexOf("|", y)), l !== -1 && S[l + 1] !== ")" && (h = S.indexOf(")", l), h > l && (f = S.indexOf("\\", l), f === -1 || f > h))))
        return !0;
      if (S[y] === "\\") {
        var T = S[y + 1];
        y += 2;
        var n = r[T];
        if (n) {
          var V = S.indexOf(n, y);
          V !== -1 && (y = V + 1);
        }
        if (S[y] === "!")
          return !0;
      } else
        y++;
    }
    return !1;
  }, A = function(S) {
    if (S[0] === "!")
      return !0;
    for (var y = 0; y < S.length; ) {
      if (/[*?{}()[\]]/.test(S[y]))
        return !0;
      if (S[y] === "\\") {
        var l = S[y + 1];
        y += 2;
        var s = r[l];
        if (s) {
          var c = S.indexOf(s, y);
          c !== -1 && (y = c + 1);
        }
        if (S[y] === "!")
          return !0;
      } else
        y++;
    }
    return !1;
  };
  return We = function(y, l) {
    if (typeof y != "string" || y === "")
      return !1;
    if (a(y))
      return !0;
    var s = p;
    return l && l.strict === !1 && (s = A), s(y);
  }, We;
}
var Ue, Tt;
function Es() {
  if (Tt) return Ue;
  Tt = 1;
  var a = /* @__PURE__ */ Vt(), r = ge.posix.dirname, p = Kt.platform() === "win32", A = "/", S = /\\/g, y = /[\{\[].*[\}\]]$/, l = /(^|[^\\])([\{\[]|\([^\)]+$)/, s = /\\([\!\*\?\|\[\]\(\)\{\}])/g;
  return Ue = function(h, f) {
    var T = Object.assign({ flipBackslashes: !0 }, f);
    T.flipBackslashes && p && h.indexOf(A) < 0 && (h = h.replace(S, A)), y.test(h) && (h += A), h += "a";
    do
      h = r(h);
    while (a(h) || l.test(h));
    return h.replace(s, "$1");
  }, Ue;
}
var Ke = {}, xt;
function at() {
  return xt || (xt = 1, (function(a) {
    a.isInteger = (r) => typeof r == "number" ? Number.isInteger(r) : typeof r == "string" && r.trim() !== "" ? Number.isInteger(Number(r)) : !1, a.find = (r, p) => r.nodes.find((A) => A.type === p), a.exceedsLimit = (r, p, A = 1, S) => S === !1 || !a.isInteger(r) || !a.isInteger(p) ? !1 : (Number(p) - Number(r)) / Number(A) >= S, a.escapeNode = (r, p = 0, A) => {
      const S = r.nodes[p];
      S && (A && S.type === A || S.type === "open" || S.type === "close") && S.escaped !== !0 && (S.value = "\\" + S.value, S.escaped = !0);
    }, a.encloseBrace = (r) => r.type !== "brace" ? !1 : r.commas >> 0 + r.ranges >> 0 === 0 ? (r.invalid = !0, !0) : !1, a.isInvalidBrace = (r) => r.type !== "brace" ? !1 : r.invalid === !0 || r.dollar ? !0 : r.commas >> 0 + r.ranges >> 0 === 0 || r.open !== !0 || r.close !== !0 ? (r.invalid = !0, !0) : !1, a.isOpenOrClose = (r) => r.type === "open" || r.type === "close" ? !0 : r.open === !0 || r.close === !0, a.reduce = (r) => r.reduce((p, A) => (A.type === "text" && p.push(A.value), A.type === "range" && (A.type = "text"), p), []), a.flatten = (...r) => {
      const p = [], A = (S) => {
        for (let y = 0; y < S.length; y++) {
          const l = S[y];
          if (Array.isArray(l)) {
            A(l);
            continue;
          }
          l !== void 0 && p.push(l);
        }
        return p;
      };
      return A(r), p;
    };
  })(Ke)), Ke;
}
var qe, Ht;
function ot() {
  if (Ht) return qe;
  Ht = 1;
  const a = /* @__PURE__ */ at();
  return qe = (r, p = {}) => {
    const A = (S, y = {}) => {
      const l = p.escapeInvalid && a.isInvalidBrace(y), s = S.invalid === !0 && p.escapeInvalid === !0;
      let c = "";
      if (S.value)
        return (l || s) && a.isOpenOrClose(S) ? "\\" + S.value : S.value;
      if (S.value)
        return S.value;
      if (S.nodes)
        for (const h of S.nodes)
          c += A(h);
      return c;
    };
    return A(r);
  }, qe;
}
var Ve, Ot;
function gs() {
  return Ot || (Ot = 1, Ve = function(a) {
    return typeof a == "number" ? a - a === 0 : typeof a == "string" && a.trim() !== "" ? Number.isFinite ? Number.isFinite(+a) : isFinite(+a) : !1;
  }), Ve;
}
var je, Lt;
function Rs() {
  if (Lt) return je;
  Lt = 1;
  const a = /* @__PURE__ */ gs(), r = (C, O, W) => {
    if (a(C) === !1)
      throw new TypeError("toRegexRange: expected the first argument to be a number");
    if (O === void 0 || C === O)
      return String(C);
    if (a(O) === !1)
      throw new TypeError("toRegexRange: expected the second argument to be a number.");
    let u = { relaxZeros: !0, ...W };
    typeof u.strictZeros == "boolean" && (u.relaxZeros = u.strictZeros === !1);
    let N = String(u.relaxZeros), b = String(u.shorthand), D = String(u.capture), v = String(u.wrap), K = C + ":" + O + "=" + N + b + D + v;
    if (r.cache.hasOwnProperty(K))
      return r.cache[K].result;
    let I = Math.min(C, O), F = Math.max(C, O);
    if (Math.abs(I - F) === 1) {
      let z = C + "|" + O;
      return u.capture ? `(${z})` : u.wrap === !1 ? z : `(?:${z})`;
    }
    let k = M(C) || M(O), B = { min: C, max: O, a: I, b: F }, g = [], Y = [];
    if (k && (B.isPadded = k, B.maxLen = String(B.max).length), I < 0) {
      let z = F < 0 ? Math.abs(F) : 1;
      Y = y(z, Math.abs(I), B, u), I = B.a = 0;
    }
    return F >= 0 && (g = y(I, F, B, u)), B.negatives = Y, B.positives = g, B.result = p(Y, g), u.capture === !0 ? B.result = `(${B.result})` : u.wrap !== !1 && g.length + Y.length > 1 && (B.result = `(?:${B.result})`), r.cache[K] = B, B.result;
  };
  function p(C, O, W) {
    let u = l(C, O, "-", !1) || [], N = l(O, C, "", !1) || [], b = l(C, O, "-?", !0) || [];
    return u.concat(b).concat(N).join("|");
  }
  function A(C, O) {
    let W = 1, u = 1, N = f(C, W), b = /* @__PURE__ */ new Set([O]);
    for (; C <= N && N <= O; )
      b.add(N), W += 1, N = f(C, W);
    for (N = T(O + 1, u) - 1; C < N && N <= O; )
      b.add(N), u += 1, N = T(O + 1, u) - 1;
    return b = [...b], b.sort(c), b;
  }
  function S(C, O, W) {
    if (C === O)
      return { pattern: C, count: [], digits: 0 };
    let u = s(C, O), N = u.length, b = "", D = 0;
    for (let v = 0; v < N; v++) {
      let [K, I] = u[v];
      K === I ? b += K : K !== "0" || I !== "9" ? b += V(K, I) : D++;
    }
    return D && (b += W.shorthand === !0 ? "\\d" : "[0-9]"), { pattern: b, count: [D], digits: N };
  }
  function y(C, O, W, u) {
    let N = A(C, O), b = [], D = C, v;
    for (let K = 0; K < N.length; K++) {
      let I = N[K], F = S(String(D), String(I), u), k = "";
      if (!W.isPadded && v && v.pattern === F.pattern) {
        v.count.length > 1 && v.count.pop(), v.count.push(F.count[0]), v.string = v.pattern + n(v.count), D = I + 1;
        continue;
      }
      W.isPadded && (k = j(I, W, u)), F.string = k + F.pattern + n(F.count), b.push(F), D = I + 1, v = F;
    }
    return b;
  }
  function l(C, O, W, u, N) {
    let b = [];
    for (let D of C) {
      let { string: v } = D;
      !u && !h(O, "string", v) && b.push(W + v), u && h(O, "string", v) && b.push(W + v);
    }
    return b;
  }
  function s(C, O) {
    let W = [];
    for (let u = 0; u < C.length; u++) W.push([C[u], O[u]]);
    return W;
  }
  function c(C, O) {
    return C > O ? 1 : O > C ? -1 : 0;
  }
  function h(C, O, W) {
    return C.some((u) => u[O] === W);
  }
  function f(C, O) {
    return Number(String(C).slice(0, -O) + "9".repeat(O));
  }
  function T(C, O) {
    return C - C % Math.pow(10, O);
  }
  function n(C) {
    let [O = 0, W = ""] = C;
    return W || O > 1 ? `{${O + (W ? "," + W : "")}}` : "";
  }
  function V(C, O, W) {
    return `[${C}${O - C === 1 ? "" : "-"}${O}]`;
  }
  function M(C) {
    return /^-?(0+)\d/.test(C);
  }
  function j(C, O, W) {
    if (!O.isPadded)
      return C;
    let u = Math.abs(O.maxLen - String(C).length), N = W.relaxZeros !== !1;
    switch (u) {
      case 0:
        return "";
      case 1:
        return N ? "0?" : "0";
      case 2:
        return N ? "0{0,2}" : "00";
      default:
        return N ? `0{0,${u}}` : `0{${u}}`;
    }
  }
  return r.cache = {}, r.clearCache = () => r.cache = {}, je = r, je;
}
var ze, Nt;
function jt() {
  if (Nt) return ze;
  Nt = 1;
  const a = me, r = /* @__PURE__ */ Rs(), p = (u) => u !== null && typeof u == "object" && !Array.isArray(u), A = (u) => (N) => u === !0 ? Number(N) : String(N), S = (u) => typeof u == "number" || typeof u == "string" && u !== "", y = (u) => Number.isInteger(+u), l = (u) => {
    let N = `${u}`, b = -1;
    if (N[0] === "-" && (N = N.slice(1)), N === "0") return !1;
    for (; N[++b] === "0"; ) ;
    return b > 0;
  }, s = (u, N, b) => typeof u == "string" || typeof N == "string" ? !0 : b.stringify === !0, c = (u, N, b) => {
    if (N > 0) {
      let D = u[0] === "-" ? "-" : "";
      D && (u = u.slice(1)), u = D + u.padStart(D ? N - 1 : N, "0");
    }
    return b === !1 ? String(u) : u;
  }, h = (u, N) => {
    let b = u[0] === "-" ? "-" : "";
    for (b && (u = u.slice(1), N--); u.length < N; ) u = "0" + u;
    return b ? "-" + u : u;
  }, f = (u, N, b) => {
    u.negatives.sort((F, k) => F < k ? -1 : F > k ? 1 : 0), u.positives.sort((F, k) => F < k ? -1 : F > k ? 1 : 0);
    let D = N.capture ? "" : "?:", v = "", K = "", I;
    return u.positives.length && (v = u.positives.map((F) => h(String(F), b)).join("|")), u.negatives.length && (K = `-(${D}${u.negatives.map((F) => h(String(F), b)).join("|")})`), v && K ? I = `${v}|${K}` : I = v || K, N.wrap ? `(${D}${I})` : I;
  }, T = (u, N, b, D) => {
    if (b)
      return r(u, N, { wrap: !1, ...D });
    let v = String.fromCharCode(u);
    if (u === N) return v;
    let K = String.fromCharCode(N);
    return `[${v}-${K}]`;
  }, n = (u, N, b) => {
    if (Array.isArray(u)) {
      let D = b.wrap === !0, v = b.capture ? "" : "?:";
      return D ? `(${v}${u.join("|")})` : u.join("|");
    }
    return r(u, N, b);
  }, V = (...u) => new RangeError("Invalid range arguments: " + a.inspect(...u)), M = (u, N, b) => {
    if (b.strictRanges === !0) throw V([u, N]);
    return [];
  }, j = (u, N) => {
    if (N.strictRanges === !0)
      throw new TypeError(`Expected step "${u}" to be a number`);
    return [];
  }, C = (u, N, b = 1, D = {}) => {
    let v = Number(u), K = Number(N);
    if (!Number.isInteger(v) || !Number.isInteger(K)) {
      if (D.strictRanges === !0) throw V([u, N]);
      return [];
    }
    v === 0 && (v = 0), K === 0 && (K = 0);
    let I = v > K, F = String(u), k = String(N), B = String(b);
    b = Math.max(Math.abs(b), 1);
    let g = l(F) || l(k) || l(B), Y = g ? Math.max(F.length, k.length, B.length) : 0, z = g === !1 && s(u, N, D) === !1, re = D.transform || A(z);
    if (D.toRegex && b === 1)
      return T(h(u, Y), h(N, Y), !0, D);
    let X = { negatives: [], positives: [] }, oe = (i) => X[i < 0 ? "negatives" : "positives"].push(Math.abs(i)), he = [], ne = 0;
    for (; I ? v >= K : v <= K; )
      D.toRegex === !0 && b > 1 ? oe(v) : he.push(c(re(v, ne), Y, z)), v = I ? v - b : v + b, ne++;
    return D.toRegex === !0 ? b > 1 ? f(X, D, Y) : n(he, null, { wrap: !1, ...D }) : he;
  }, O = (u, N, b = 1, D = {}) => {
    if (!y(u) && u.length > 1 || !y(N) && N.length > 1)
      return M(u, N, D);
    let v = D.transform || ((z) => String.fromCharCode(z)), K = `${u}`.charCodeAt(0), I = `${N}`.charCodeAt(0), F = K > I, k = Math.min(K, I), B = Math.max(K, I);
    if (D.toRegex && b === 1)
      return T(k, B, !1, D);
    let g = [], Y = 0;
    for (; F ? K >= I : K <= I; )
      g.push(v(K, Y)), K = F ? K - b : K + b, Y++;
    return D.toRegex === !0 ? n(g, null, { wrap: !1, options: D }) : g;
  }, W = (u, N, b, D = {}) => {
    if (N == null && S(u))
      return [u];
    if (!S(u) || !S(N))
      return M(u, N, D);
    if (typeof b == "function")
      return W(u, N, 1, { transform: b });
    if (p(b))
      return W(u, N, 0, b);
    let v = { ...D };
    return v.capture === !0 && (v.wrap = !0), b = b || v.step || 1, y(b) ? y(u) && y(N) ? C(u, N, b, v) : O(u, N, Math.max(Math.abs(b), 1), v) : b != null && !p(b) ? j(b, v) : W(u, N, 1, b);
  };
  return ze = W, ze;
}
var Ye, It;
function As() {
  if (It) return Ye;
  It = 1;
  const a = /* @__PURE__ */ jt(), r = /* @__PURE__ */ at();
  return Ye = (A, S = {}) => {
    const y = (l, s = {}) => {
      const c = r.isInvalidBrace(s), h = l.invalid === !0 && S.escapeInvalid === !0, f = c === !0 || h === !0, T = S.escapeInvalid === !0 ? "\\" : "";
      let n = "";
      if (l.isOpen === !0)
        return T + l.value;
      if (l.isClose === !0)
        return console.log("node.isClose", T, l.value), T + l.value;
      if (l.type === "open")
        return f ? T + l.value : "(";
      if (l.type === "close")
        return f ? T + l.value : ")";
      if (l.type === "comma")
        return l.prev.type === "comma" ? "" : f ? l.value : "|";
      if (l.value)
        return l.value;
      if (l.nodes && l.ranges > 0) {
        const V = r.reduce(l.nodes), M = a(...V, { ...S, wrap: !1, toRegex: !0, strictZeros: !0 });
        if (M.length !== 0)
          return V.length > 1 && M.length > 1 ? `(${M})` : M;
      }
      if (l.nodes)
        for (const V of l.nodes)
          n += y(V, l);
      return n;
    };
    return y(A);
  }, Ye;
}
var Xe, $t;
function ms() {
  if ($t) return Xe;
  $t = 1;
  const a = /* @__PURE__ */ jt(), r = /* @__PURE__ */ ot(), p = /* @__PURE__ */ at(), A = (y = "", l = "", s = !1) => {
    const c = [];
    if (y = [].concat(y), l = [].concat(l), !l.length) return y;
    if (!y.length)
      return s ? p.flatten(l).map((h) => `{${h}}`) : l;
    for (const h of y)
      if (Array.isArray(h))
        for (const f of h)
          c.push(A(f, l, s));
      else
        for (let f of l)
          s === !0 && typeof f == "string" && (f = `{${f}}`), c.push(Array.isArray(f) ? A(h, f, s) : h + f);
    return p.flatten(c);
  };
  return Xe = (y, l = {}) => {
    const s = l.rangeLimit === void 0 ? 1e3 : l.rangeLimit, c = (h, f = {}) => {
      h.queue = [];
      let T = f, n = f.queue;
      for (; T.type !== "brace" && T.type !== "root" && T.parent; )
        T = T.parent, n = T.queue;
      if (h.invalid || h.dollar) {
        n.push(A(n.pop(), r(h, l)));
        return;
      }
      if (h.type === "brace" && h.invalid !== !0 && h.nodes.length === 2) {
        n.push(A(n.pop(), ["{}"]));
        return;
      }
      if (h.nodes && h.ranges > 0) {
        const C = p.reduce(h.nodes);
        if (p.exceedsLimit(...C, l.step, s))
          throw new RangeError("expanded array length exceeds range limit. Use options.rangeLimit to increase or disable the limit.");
        let O = a(...C, l);
        O.length === 0 && (O = r(h, l)), n.push(A(n.pop(), O)), h.nodes = [];
        return;
      }
      const V = p.encloseBrace(h);
      let M = h.queue, j = h;
      for (; j.type !== "brace" && j.type !== "root" && j.parent; )
        j = j.parent, M = j.queue;
      for (let C = 0; C < h.nodes.length; C++) {
        const O = h.nodes[C];
        if (O.type === "comma" && h.type === "brace") {
          C === 1 && M.push(""), M.push("");
          continue;
        }
        if (O.type === "close") {
          n.push(A(n.pop(), M, V));
          continue;
        }
        if (O.value && O.type !== "open") {
          M.push(A(M.pop(), O.value));
          continue;
        }
        O.nodes && c(O, h);
      }
      return M;
    };
    return p.flatten(c(y));
  }, Xe;
}
var Qe, Pt;
function ys() {
  return Pt || (Pt = 1, Qe = {
    MAX_LENGTH: 1e4,
    // Digits
    CHAR_0: "0",
    /* 0 */
    CHAR_9: "9",
    /* 9 */
    // Alphabet chars.
    CHAR_UPPERCASE_A: "A",
    /* A */
    CHAR_LOWERCASE_A: "a",
    /* a */
    CHAR_UPPERCASE_Z: "Z",
    /* Z */
    CHAR_LOWERCASE_Z: "z",
    /* z */
    CHAR_LEFT_PARENTHESES: "(",
    /* ( */
    CHAR_RIGHT_PARENTHESES: ")",
    /* ) */
    CHAR_ASTERISK: "*",
    /* * */
    // Non-alphabetic chars.
    CHAR_AMPERSAND: "&",
    /* & */
    CHAR_AT: "@",
    /* @ */
    CHAR_BACKSLASH: "\\",
    /* \ */
    CHAR_BACKTICK: "`",
    /* ` */
    CHAR_CARRIAGE_RETURN: "\r",
    /* \r */
    CHAR_CIRCUMFLEX_ACCENT: "^",
    /* ^ */
    CHAR_COLON: ":",
    /* : */
    CHAR_COMMA: ",",
    /* , */
    CHAR_DOLLAR: "$",
    /* . */
    CHAR_DOT: ".",
    /* . */
    CHAR_DOUBLE_QUOTE: '"',
    /* " */
    CHAR_EQUAL: "=",
    /* = */
    CHAR_EXCLAMATION_MARK: "!",
    /* ! */
    CHAR_FORM_FEED: "\f",
    /* \f */
    CHAR_FORWARD_SLASH: "/",
    /* / */
    CHAR_HASH: "#",
    /* # */
    CHAR_HYPHEN_MINUS: "-",
    /* - */
    CHAR_LEFT_ANGLE_BRACKET: "<",
    /* < */
    CHAR_LEFT_CURLY_BRACE: "{",
    /* { */
    CHAR_LEFT_SQUARE_BRACKET: "[",
    /* [ */
    CHAR_LINE_FEED: `
`,
    /* \n */
    CHAR_NO_BREAK_SPACE: " ",
    /* \u00A0 */
    CHAR_PERCENT: "%",
    /* % */
    CHAR_PLUS: "+",
    /* + */
    CHAR_QUESTION_MARK: "?",
    /* ? */
    CHAR_RIGHT_ANGLE_BRACKET: ">",
    /* > */
    CHAR_RIGHT_CURLY_BRACE: "}",
    /* } */
    CHAR_RIGHT_SQUARE_BRACKET: "]",
    /* ] */
    CHAR_SEMICOLON: ";",
    /* ; */
    CHAR_SINGLE_QUOTE: "'",
    /* ' */
    CHAR_SPACE: " ",
    /*   */
    CHAR_TAB: "	",
    /* \t */
    CHAR_UNDERSCORE: "_",
    /* _ */
    CHAR_VERTICAL_LINE: "|",
    /* | */
    CHAR_ZERO_WIDTH_NOBREAK_SPACE: "\uFEFF"
    /* \uFEFF */
  }), Qe;
}
var Ze, Dt;
function ws() {
  if (Dt) return Ze;
  Dt = 1;
  const a = /* @__PURE__ */ ot(), {
    MAX_LENGTH: r,
    CHAR_BACKSLASH: p,
    /* \ */
    CHAR_BACKTICK: A,
    /* ` */
    CHAR_COMMA: S,
    /* , */
    CHAR_DOT: y,
    /* . */
    CHAR_LEFT_PARENTHESES: l,
    /* ( */
    CHAR_RIGHT_PARENTHESES: s,
    /* ) */
    CHAR_LEFT_CURLY_BRACE: c,
    /* { */
    CHAR_RIGHT_CURLY_BRACE: h,
    /* } */
    CHAR_LEFT_SQUARE_BRACKET: f,
    /* [ */
    CHAR_RIGHT_SQUARE_BRACKET: T,
    /* ] */
    CHAR_DOUBLE_QUOTE: n,
    /* " */
    CHAR_SINGLE_QUOTE: V,
    /* ' */
    CHAR_NO_BREAK_SPACE: M,
    CHAR_ZERO_WIDTH_NOBREAK_SPACE: j
  } = /* @__PURE__ */ ys();
  return Ze = (O, W = {}) => {
    if (typeof O != "string")
      throw new TypeError("Expected a string");
    const u = W || {}, N = typeof u.maxLength == "number" ? Math.min(r, u.maxLength) : r;
    if (O.length > N)
      throw new SyntaxError(`Input length (${O.length}), exceeds max characters (${N})`);
    const b = { type: "root", input: O, nodes: [] }, D = [b];
    let v = b, K = b, I = 0;
    const F = O.length;
    let k = 0, B = 0, g;
    const Y = () => O[k++], z = (re) => {
      if (re.type === "text" && K.type === "dot" && (K.type = "text"), K && K.type === "text" && re.type === "text") {
        K.value += re.value;
        return;
      }
      return v.nodes.push(re), re.parent = v, re.prev = K, K = re, re;
    };
    for (z({ type: "bos" }); k < F; )
      if (v = D[D.length - 1], g = Y(), !(g === j || g === M)) {
        if (g === p) {
          z({ type: "text", value: (W.keepEscaping ? g : "") + Y() });
          continue;
        }
        if (g === T) {
          z({ type: "text", value: "\\" + g });
          continue;
        }
        if (g === f) {
          I++;
          let re;
          for (; k < F && (re = Y()); ) {
            if (g += re, re === f) {
              I++;
              continue;
            }
            if (re === p) {
              g += Y();
              continue;
            }
            if (re === T && (I--, I === 0))
              break;
          }
          z({ type: "text", value: g });
          continue;
        }
        if (g === l) {
          v = z({ type: "paren", nodes: [] }), D.push(v), z({ type: "text", value: g });
          continue;
        }
        if (g === s) {
          if (v.type !== "paren") {
            z({ type: "text", value: g });
            continue;
          }
          v = D.pop(), z({ type: "text", value: g }), v = D[D.length - 1];
          continue;
        }
        if (g === n || g === V || g === A) {
          const re = g;
          let X;
          for (W.keepQuotes !== !0 && (g = ""); k < F && (X = Y()); ) {
            if (X === p) {
              g += X + Y();
              continue;
            }
            if (X === re) {
              W.keepQuotes === !0 && (g += X);
              break;
            }
            g += X;
          }
          z({ type: "text", value: g });
          continue;
        }
        if (g === c) {
          B++;
          const X = {
            type: "brace",
            open: !0,
            close: !1,
            dollar: K.value && K.value.slice(-1) === "$" || v.dollar === !0,
            depth: B,
            commas: 0,
            ranges: 0,
            nodes: []
          };
          v = z(X), D.push(v), z({ type: "open", value: g });
          continue;
        }
        if (g === h) {
          if (v.type !== "brace") {
            z({ type: "text", value: g });
            continue;
          }
          const re = "close";
          v = D.pop(), v.close = !0, z({ type: re, value: g }), B--, v = D[D.length - 1];
          continue;
        }
        if (g === S && B > 0) {
          if (v.ranges > 0) {
            v.ranges = 0;
            const re = v.nodes.shift();
            v.nodes = [re, { type: "text", value: a(v) }];
          }
          z({ type: "comma", value: g }), v.commas++;
          continue;
        }
        if (g === y && B > 0 && v.commas === 0) {
          const re = v.nodes;
          if (B === 0 || re.length === 0) {
            z({ type: "text", value: g });
            continue;
          }
          if (K.type === "dot") {
            if (v.range = [], K.value += g, K.type = "range", v.nodes.length !== 3 && v.nodes.length !== 5) {
              v.invalid = !0, v.ranges = 0, K.type = "text";
              continue;
            }
            v.ranges++, v.args = [];
            continue;
          }
          if (K.type === "range") {
            re.pop();
            const X = re[re.length - 1];
            X.value += K.value + g, K = X, v.ranges--;
            continue;
          }
          z({ type: "dot", value: g });
          continue;
        }
        z({ type: "text", value: g });
      }
    do
      if (v = D.pop(), v.type !== "root") {
        v.nodes.forEach((oe) => {
          oe.nodes || (oe.type === "open" && (oe.isOpen = !0), oe.type === "close" && (oe.isClose = !0), oe.nodes || (oe.type = "text"), oe.invalid = !0);
        });
        const re = D[D.length - 1], X = re.nodes.indexOf(v);
        re.nodes.splice(X, 1, ...v.nodes);
      }
    while (D.length > 0);
    return z({ type: "eos" }), b;
  }, Ze;
}
var Je, kt;
function bs() {
  if (kt) return Je;
  kt = 1;
  const a = /* @__PURE__ */ ot(), r = /* @__PURE__ */ As(), p = /* @__PURE__ */ ms(), A = /* @__PURE__ */ ws(), S = (y, l = {}) => {
    let s = [];
    if (Array.isArray(y))
      for (const c of y) {
        const h = S.create(c, l);
        Array.isArray(h) ? s.push(...h) : s.push(h);
      }
    else
      s = [].concat(S.create(y, l));
    return l && l.expand === !0 && l.nodupes === !0 && (s = [...new Set(s)]), s;
  };
  return S.parse = (y, l = {}) => A(y, l), S.stringify = (y, l = {}) => a(typeof y == "string" ? S.parse(y, l) : y, l), S.compile = (y, l = {}) => (typeof y == "string" && (y = S.parse(y, l)), r(y, l)), S.expand = (y, l = {}) => {
    typeof y == "string" && (y = S.parse(y, l));
    let s = p(y, l);
    return l.noempty === !0 && (s = s.filter(Boolean)), l.nodupes === !0 && (s = [...new Set(s)]), s;
  }, S.create = (y, l = {}) => y === "" || y.length < 3 ? [y] : l.expand !== !0 ? S.compile(y, l) : S.expand(y, l), Je = S, Je;
}
const Ss = [
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
];
var et, Ft;
function vs() {
  return Ft || (Ft = 1, et = Ss), et;
}
var tt, Mt;
function Cs() {
  if (Mt) return tt;
  Mt = 1;
  const a = ge, r = /* @__PURE__ */ vs(), p = new Set(r);
  return tt = (A) => p.has(a.extname(A).slice(1).toLowerCase()), tt;
}
var st = {}, Bt;
function ut() {
  return Bt || (Bt = 1, (function(a) {
    const { sep: r } = ge, { platform: p } = process, A = Kt;
    a.EV_ALL = "all", a.EV_READY = "ready", a.EV_ADD = "add", a.EV_CHANGE = "change", a.EV_ADD_DIR = "addDir", a.EV_UNLINK = "unlink", a.EV_UNLINK_DIR = "unlinkDir", a.EV_RAW = "raw", a.EV_ERROR = "error", a.STR_DATA = "data", a.STR_END = "end", a.STR_CLOSE = "close", a.FSEVENT_CREATED = "created", a.FSEVENT_MODIFIED = "modified", a.FSEVENT_DELETED = "deleted", a.FSEVENT_MOVED = "moved", a.FSEVENT_CLONED = "cloned", a.FSEVENT_UNKNOWN = "unknown", a.FSEVENT_FLAG_MUST_SCAN_SUBDIRS = 1, a.FSEVENT_TYPE_FILE = "file", a.FSEVENT_TYPE_DIRECTORY = "directory", a.FSEVENT_TYPE_SYMLINK = "symlink", a.KEY_LISTENERS = "listeners", a.KEY_ERR = "errHandlers", a.KEY_RAW = "rawEmitters", a.HANDLER_KEYS = [a.KEY_LISTENERS, a.KEY_ERR, a.KEY_RAW], a.DOT_SLASH = `.${r}`, a.BACK_SLASH_RE = /\\/g, a.DOUBLE_SLASH_RE = /\/\//, a.SLASH_OR_BACK_SLASH_RE = /[/\\]/, a.DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/, a.REPLACER_RE = /^\.[/\\]/, a.SLASH = "/", a.SLASH_SLASH = "//", a.BRACE_START = "{", a.BANG = "!", a.ONE_DOT = ".", a.TWO_DOTS = "..", a.STAR = "*", a.GLOBSTAR = "**", a.ROOT_GLOBSTAR = "/**/*", a.SLASH_GLOBSTAR = "/**", a.DIR_SUFFIX = "Dir", a.ANYMATCH_OPTS = { dot: !0 }, a.STRING_TYPE = "string", a.FUNCTION_TYPE = "function", a.EMPTY_STR = "", a.EMPTY_FN = () => {
    }, a.IDENTITY_FN = (S) => S, a.isWindows = p === "win32", a.isMacos = p === "darwin", a.isLinux = p === "linux", a.isIBMi = A.type() === "OS400";
  })(st)), st;
}
var rt, Gt;
function Ts() {
  if (Gt) return rt;
  Gt = 1;
  const a = Se, r = ge, { promisify: p } = me, A = /* @__PURE__ */ Cs(), {
    isWindows: S,
    isLinux: y,
    EMPTY_FN: l,
    EMPTY_STR: s,
    KEY_LISTENERS: c,
    KEY_ERR: h,
    KEY_RAW: f,
    HANDLER_KEYS: T,
    EV_CHANGE: n,
    EV_ADD: V,
    EV_ADD_DIR: M,
    EV_ERROR: j,
    STR_DATA: C,
    STR_END: O,
    BRACE_START: W,
    STAR: u
  } = /* @__PURE__ */ ut(), N = "watch", b = p(a.open), D = p(a.stat), v = p(a.lstat), K = p(a.close), I = p(a.realpath), F = { lstat: v, stat: D }, k = (se, L) => {
    se instanceof Set ? se.forEach(L) : L(se);
  }, B = (se, L, t) => {
    let e = se[L];
    e instanceof Set || (se[L] = e = /* @__PURE__ */ new Set([e])), e.add(t);
  }, g = (se) => (L) => {
    const t = se[L];
    t instanceof Set ? t.clear() : delete se[L];
  }, Y = (se, L, t) => {
    const e = se[L];
    e instanceof Set ? e.delete(t) : e === t && delete se[L];
  }, z = (se) => se instanceof Set ? se.size === 0 : !se, re = /* @__PURE__ */ new Map();
  function X(se, L, t, e, _) {
    const R = (P, x) => {
      t(se), _(P, x, { watchedPath: se }), x && se !== x && oe(
        r.resolve(se, x),
        c,
        r.join(se, x)
      );
    };
    try {
      return a.watch(se, L, R);
    } catch (P) {
      e(P);
    }
  }
  const oe = (se, L, t, e, _) => {
    const R = re.get(se);
    R && k(R[L], (P) => {
      P(t, e, _);
    });
  }, he = (se, L, t, e) => {
    const { listener: _, errHandler: R, rawEmitter: P } = e;
    let x = re.get(L), H;
    if (!t.persistent)
      return H = X(
        se,
        t,
        _,
        R,
        P
      ), H.close.bind(H);
    if (x)
      B(x, c, _), B(x, h, R), B(x, f, P);
    else {
      if (H = X(
        se,
        t,
        oe.bind(null, L, c),
        R,
        // no need to use broadcast here
        oe.bind(null, L, f)
      ), !H) return;
      H.on(j, async ($) => {
        const Q = oe.bind(null, L, h);
        if (x.watcherUnusable = !0, S && $.code === "EPERM")
          try {
            const G = await b(se, "r");
            await K(G), Q($);
          } catch {
          }
        else
          Q($);
      }), x = {
        listeners: _,
        errHandlers: R,
        rawEmitters: P,
        watcher: H
      }, re.set(L, x);
    }
    return () => {
      Y(x, c, _), Y(x, h, R), Y(x, f, P), z(x.listeners) && (x.watcher.close(), re.delete(L), T.forEach(g(x)), x.watcher = void 0, Object.freeze(x));
    };
  }, ne = /* @__PURE__ */ new Map(), i = (se, L, t, e) => {
    const { listener: _, rawEmitter: R } = e;
    let P = ne.get(L);
    const x = P && P.options;
    return x && (x.persistent < t.persistent || x.interval > t.interval) && (a.unwatchFile(L), P = void 0), P ? (B(P, c, _), B(P, f, R)) : (P = {
      listeners: _,
      rawEmitters: R,
      options: t,
      watcher: a.watchFile(L, t, (H, $) => {
        k(P.rawEmitters, (G) => {
          G(n, L, { curr: H, prev: $ });
        });
        const Q = H.mtimeMs;
        (H.size !== $.size || Q > $.mtimeMs || Q === 0) && k(P.listeners, (G) => G(se, H));
      })
    }, ne.set(L, P)), () => {
      Y(P, c, _), Y(P, f, R), z(P.listeners) && (ne.delete(L), a.unwatchFile(L), P.options = P.watcher = void 0, Object.freeze(P));
    };
  };
  class ue {
    /**
     * @param {import("../index").FSWatcher} fsW
     */
    constructor(L) {
      this.fsw = L, this._boundHandleError = (t) => L._handleError(t);
    }
    /**
     * Watch file for changes with fs_watchFile or fs_watch.
     * @param {String} path to file or dir
     * @param {Function} listener on fs change
     * @returns {Function} closer for the watcher instance
     */
    _watchWithNodeFs(L, t) {
      const e = this.fsw.options, _ = r.dirname(L), R = r.basename(L);
      this.fsw._getWatchedDir(_).add(R);
      const x = r.resolve(L), H = { persistent: e.persistent };
      t || (t = l);
      let $;
      return e.usePolling ? (H.interval = e.enableBinaryInterval && A(R) ? e.binaryInterval : e.interval, $ = i(L, x, H, {
        listener: t,
        rawEmitter: this.fsw._emitRaw
      })) : $ = he(L, x, H, {
        listener: t,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      }), $;
    }
    /**
     * Watch a file and emit add event if warranted.
     * @param {Path} file Path
     * @param {fs.Stats} stats result of fs_stat
     * @param {Boolean} initialAdd was the file added at watch instantiation?
     * @returns {Function} closer for the watcher instance
     */
    _handleFile(L, t, e) {
      if (this.fsw.closed)
        return;
      const _ = r.dirname(L), R = r.basename(L), P = this.fsw._getWatchedDir(_);
      let x = t;
      if (P.has(R)) return;
      const H = async (Q, G) => {
        if (this.fsw._throttle(N, L, 5)) {
          if (!G || G.mtimeMs === 0)
            try {
              const U = await D(L);
              if (this.fsw.closed) return;
              const w = U.atimeMs, Z = U.mtimeMs;
              (!w || w <= Z || Z !== x.mtimeMs) && this.fsw._emit(n, L, U), y && x.ino !== U.ino ? (this.fsw._closeFile(Q), x = U, this.fsw._addPathCloser(Q, this._watchWithNodeFs(L, H))) : x = U;
            } catch {
              this.fsw._remove(_, R);
            }
          else if (P.has(R)) {
            const U = G.atimeMs, w = G.mtimeMs;
            (!U || U <= w || w !== x.mtimeMs) && this.fsw._emit(n, L, G), x = G;
          }
        }
      }, $ = this._watchWithNodeFs(L, H);
      if (!(e && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(L)) {
        if (!this.fsw._throttle(V, L, 0)) return;
        this.fsw._emit(V, L, t);
      }
      return $;
    }
    /**
     * Handle symlinks encountered while reading a dir.
     * @param {Object} entry returned by readdirp
     * @param {String} directory path of dir being read
     * @param {String} path of this item
     * @param {String} item basename of this item
     * @returns {Promise<Boolean>} true if no more processing is needed for this entry.
     */
    async _handleSymlink(L, t, e, _) {
      if (this.fsw.closed)
        return;
      const R = L.fullPath, P = this.fsw._getWatchedDir(t);
      if (!this.fsw.options.followSymlinks) {
        this.fsw._incrReadyCount();
        let x;
        try {
          x = await I(e);
        } catch {
          return this.fsw._emitReady(), !0;
        }
        return this.fsw.closed ? void 0 : (P.has(_) ? this.fsw._symlinkPaths.get(R) !== x && (this.fsw._symlinkPaths.set(R, x), this.fsw._emit(n, e, L.stats)) : (P.add(_), this.fsw._symlinkPaths.set(R, x), this.fsw._emit(V, e, L.stats)), this.fsw._emitReady(), !0);
      }
      if (this.fsw._symlinkPaths.has(R))
        return !0;
      this.fsw._symlinkPaths.set(R, !0);
    }
    _handleRead(L, t, e, _, R, P, x) {
      if (L = r.join(L, s), !e.hasGlob && (x = this.fsw._throttle("readdir", L, 1e3), !x))
        return;
      const H = this.fsw._getWatchedDir(e.path), $ = /* @__PURE__ */ new Set();
      let Q = this.fsw._readdirp(L, {
        fileFilter: (G) => e.filterPath(G),
        directoryFilter: (G) => e.filterDir(G),
        depth: 0
      }).on(C, async (G) => {
        if (this.fsw.closed) {
          Q = void 0;
          return;
        }
        const U = G.path;
        let w = r.join(L, U);
        if ($.add(U), !(G.stats.isSymbolicLink() && await this._handleSymlink(G, L, w, U))) {
          if (this.fsw.closed) {
            Q = void 0;
            return;
          }
          (U === _ || !_ && !H.has(U)) && (this.fsw._incrReadyCount(), w = r.join(R, r.relative(R, w)), this._addToNodeFs(w, t, e, P + 1));
        }
      }).on(j, this._boundHandleError);
      return new Promise(
        (G) => Q.once(O, () => {
          if (this.fsw.closed) {
            Q = void 0;
            return;
          }
          const U = x ? x.clear() : !1;
          G(), H.getChildren().filter((w) => w !== L && !$.has(w) && // in case of intersecting globs;
          // a path may have been filtered out of this readdir, but
          // shouldn't be removed because it matches a different glob
          (!e.hasGlob || e.filterPath({
            fullPath: r.resolve(L, w)
          }))).forEach((w) => {
            this.fsw._remove(L, w);
          }), Q = void 0, U && this._handleRead(L, !1, e, _, R, P, x);
        })
      );
    }
    /**
     * Read directory to add / remove files from `@watched` list and re-read it on change.
     * @param {String} dir fs path
     * @param {fs.Stats} stats
     * @param {Boolean} initialAdd
     * @param {Number} depth relative to user-supplied path
     * @param {String} target child path targeted for watch
     * @param {Object} wh Common watch helpers for this path
     * @param {String} realpath
     * @returns {Promise<Function>} closer for the watcher instance.
     */
    async _handleDir(L, t, e, _, R, P, x) {
      const H = this.fsw._getWatchedDir(r.dirname(L)), $ = H.has(r.basename(L));
      !(e && this.fsw.options.ignoreInitial) && !R && !$ && (!P.hasGlob || P.globFilter(L)) && this.fsw._emit(M, L, t), H.add(r.basename(L)), this.fsw._getWatchedDir(L);
      let Q, G;
      const U = this.fsw.options.depth;
      if ((U == null || _ <= U) && !this.fsw._symlinkPaths.has(x)) {
        if (!R && (await this._handleRead(L, e, P, R, L, _, Q), this.fsw.closed))
          return;
        G = this._watchWithNodeFs(L, (w, Z) => {
          Z && Z.mtimeMs === 0 || this._handleRead(w, !1, P, R, L, _, Q);
        });
      }
      return G;
    }
    /**
     * Handle added file, directory, or glob pattern.
     * Delegates call to _handleFile / _handleDir after checks.
     * @param {String} path to file or ir
     * @param {Boolean} initialAdd was the file added at watch instantiation?
     * @param {Object} priorWh depth relative to user-supplied path
     * @param {Number} depth Child path actually targeted for watch
     * @param {String=} target Child path actually targeted for watch
     * @returns {Promise}
     */
    async _addToNodeFs(L, t, e, _, R) {
      const P = this.fsw._emitReady;
      if (this.fsw._isIgnored(L) || this.fsw.closed)
        return P(), !1;
      const x = this.fsw._getWatchHelpers(L, _);
      !x.hasGlob && e && (x.hasGlob = e.hasGlob, x.globFilter = e.globFilter, x.filterPath = (H) => e.filterPath(H), x.filterDir = (H) => e.filterDir(H));
      try {
        const H = await F[x.statMethod](x.watchPath);
        if (this.fsw.closed) return;
        if (this.fsw._isIgnored(x.watchPath, H))
          return P(), !1;
        const $ = this.fsw.options.followSymlinks && !L.includes(u) && !L.includes(W);
        let Q;
        if (H.isDirectory()) {
          const G = r.resolve(L), U = $ ? await I(L) : L;
          if (this.fsw.closed || (Q = await this._handleDir(x.watchPath, H, t, _, R, x, U), this.fsw.closed)) return;
          G !== U && U !== void 0 && this.fsw._symlinkPaths.set(G, U);
        } else if (H.isSymbolicLink()) {
          const G = $ ? await I(L) : L;
          if (this.fsw.closed) return;
          const U = r.dirname(x.watchPath);
          if (this.fsw._getWatchedDir(U).add(x.watchPath), this.fsw._emit(V, x.watchPath, H), Q = await this._handleDir(U, H, t, _, L, x, G), this.fsw.closed) return;
          G !== void 0 && this.fsw._symlinkPaths.set(r.resolve(L), G);
        } else
          Q = this._handleFile(x.watchPath, H, t);
        return P(), this.fsw._addPathCloser(L, Q), !1;
      } catch (H) {
        if (this.fsw._handleError(H))
          return P(), L;
      }
    }
  }
  return rt = ue, rt;
}
var we = { exports: {} };
const xs = /* @__PURE__ */ Zt(Jt);
var Wt;
function Hs() {
  if (Wt) return we.exports;
  Wt = 1;
  const a = Se, r = ge, { promisify: p } = me;
  let A;
  try {
    A = xs.getFsEvents();
  } catch (t) {
    process.env.CHOKIDAR_PRINT_FSEVENTS_REQUIRE_ERROR && console.error(t);
  }
  if (A) {
    const t = process.version.match(/v(\d+)\.(\d+)/);
    if (t && t[1] && t[2]) {
      const e = Number.parseInt(t[1], 10), _ = Number.parseInt(t[2], 10);
      e === 8 && _ < 16 && (A = void 0);
    }
  }
  const {
    EV_ADD: S,
    EV_CHANGE: y,
    EV_ADD_DIR: l,
    EV_UNLINK: s,
    EV_ERROR: c,
    STR_DATA: h,
    STR_END: f,
    FSEVENT_CREATED: T,
    FSEVENT_MODIFIED: n,
    FSEVENT_DELETED: V,
    FSEVENT_MOVED: M,
    // FSEVENT_CLONED,
    FSEVENT_UNKNOWN: j,
    FSEVENT_FLAG_MUST_SCAN_SUBDIRS: C,
    FSEVENT_TYPE_FILE: O,
    FSEVENT_TYPE_DIRECTORY: W,
    FSEVENT_TYPE_SYMLINK: u,
    ROOT_GLOBSTAR: N,
    DIR_SUFFIX: b,
    DOT_SLASH: D,
    FUNCTION_TYPE: v,
    EMPTY_FN: K,
    IDENTITY_FN: I
  } = /* @__PURE__ */ ut(), F = (t) => isNaN(t) ? {} : { depth: t }, k = p(a.stat), B = p(a.lstat), g = p(a.realpath), Y = { stat: k, lstat: B }, z = /* @__PURE__ */ new Map(), re = 10, X = /* @__PURE__ */ new Set([
    69888,
    70400,
    71424,
    72704,
    73472,
    131328,
    131840,
    262912
  ]), oe = (t, e) => ({ stop: A.watch(t, e) });
  function he(t, e, _, R) {
    let P = r.extname(e) ? r.dirname(e) : e;
    const x = r.dirname(P);
    let H = z.get(P);
    ne(x) && (P = x);
    const $ = r.resolve(t), Q = $ !== e, G = (w, Z, de) => {
      Q && (w = w.replace(e, $)), (w === $ || !w.indexOf($ + r.sep)) && _(w, Z, de);
    };
    let U = !1;
    for (const w of z.keys())
      if (e.indexOf(r.resolve(w) + r.sep) === 0) {
        P = w, H = z.get(P), U = !0;
        break;
      }
    return H || U ? H.listeners.add(G) : (H = {
      listeners: /* @__PURE__ */ new Set([G]),
      rawEmitter: R,
      watcher: oe(P, (w, Z) => {
        if (!H.listeners.size || Z & C) return;
        const de = A.getInfo(w, Z);
        H.listeners.forEach((m) => {
          m(w, Z, de);
        }), H.rawEmitter(de.event, w, de);
      })
    }, z.set(P, H)), () => {
      const w = H.listeners;
      if (w.delete(G), !w.size && (z.delete(P), H.watcher))
        return H.watcher.stop().then(() => {
          H.rawEmitter = H.watcher = void 0, Object.freeze(H);
        });
    };
  }
  const ne = (t) => {
    let e = 0;
    for (const _ of z.keys())
      if (_.indexOf(t) === 0 && (e++, e >= re))
        return !0;
    return !1;
  }, i = () => A && z.size < 128, ue = (t, e) => {
    let _ = 0;
    for (; !t.indexOf(e) && (t = r.dirname(t)) !== e; ) _++;
    return _;
  }, se = (t, e) => t.type === W && e.isDirectory() || t.type === u && e.isSymbolicLink() || t.type === O && e.isFile();
  class L {
    /**
     * @param {import('../index').FSWatcher} fsw
     */
    constructor(e) {
      this.fsw = e;
    }
    checkIgnored(e, _) {
      const R = this.fsw._ignoredPaths;
      if (this.fsw._isIgnored(e, _))
        return R.add(e), _ && _.isDirectory() && R.add(e + N), !0;
      R.delete(e), R.delete(e + N);
    }
    addOrChange(e, _, R, P, x, H, $, Q) {
      const G = x.has(H) ? y : S;
      this.handleEvent(G, e, _, R, P, x, H, $, Q);
    }
    async checkExists(e, _, R, P, x, H, $, Q) {
      try {
        const G = await k(e);
        if (this.fsw.closed) return;
        se($, G) ? this.addOrChange(e, _, R, P, x, H, $, Q) : this.handleEvent(s, e, _, R, P, x, H, $, Q);
      } catch (G) {
        G.code === "EACCES" ? this.addOrChange(e, _, R, P, x, H, $, Q) : this.handleEvent(s, e, _, R, P, x, H, $, Q);
      }
    }
    handleEvent(e, _, R, P, x, H, $, Q, G) {
      if (!(this.fsw.closed || this.checkIgnored(_)))
        if (e === s) {
          const U = Q.type === W;
          (U || H.has($)) && this.fsw._remove(x, $, U);
        } else {
          if (e === S) {
            if (Q.type === W && this.fsw._getWatchedDir(_), Q.type === u && G.followSymlinks) {
              const w = G.depth === void 0 ? void 0 : ue(R, P) + 1;
              return this._addToFsEvents(_, !1, !0, w);
            }
            this.fsw._getWatchedDir(x).add($);
          }
          const U = Q.type === W ? e + b : e;
          this.fsw._emit(U, _), U === l && this._addToFsEvents(_, !1, !0);
        }
    }
    /**
     * Handle symlinks encountered during directory scan
     * @param {String} watchPath  - file/dir path to be watched with fsevents
     * @param {String} realPath   - real path (in case of symlinks)
     * @param {Function} transform  - path transformer
     * @param {Function} globFilter - path filter in case a glob pattern was provided
     * @returns {Function} closer for the watcher instance
    */
    _watchWithFsEvents(e, _, R, P) {
      if (this.fsw.closed || this.fsw._isIgnored(e)) return;
      const x = this.fsw.options, $ = he(
        e,
        _,
        async (Q, G, U) => {
          if (this.fsw.closed || x.depth !== void 0 && ue(Q, _) > x.depth) return;
          const w = R(r.join(
            e,
            r.relative(e, Q)
          ));
          if (P && !P(w)) return;
          const Z = r.dirname(w), de = r.basename(w), m = this.fsw._getWatchedDir(
            U.type === W ? w : Z
          );
          if (X.has(G) || U.event === j)
            if (typeof x.ignored === v) {
              let te;
              try {
                te = await k(w);
              } catch {
              }
              if (this.fsw.closed || this.checkIgnored(w, te)) return;
              se(U, te) ? this.addOrChange(w, Q, _, Z, m, de, U, x) : this.handleEvent(s, w, Q, _, Z, m, de, U, x);
            } else
              this.checkExists(w, Q, _, Z, m, de, U, x);
          else
            switch (U.event) {
              case T:
              case n:
                return this.addOrChange(w, Q, _, Z, m, de, U, x);
              case V:
              case M:
                return this.checkExists(w, Q, _, Z, m, de, U, x);
            }
        },
        this.fsw._emitRaw
      );
      return this.fsw._emitReady(), $;
    }
    /**
     * Handle symlinks encountered during directory scan
     * @param {String} linkPath path to symlink
     * @param {String} fullPath absolute path to the symlink
     * @param {Function} transform pre-existing path transformer
     * @param {Number} curDepth level of subdirectories traversed to where symlink is
     * @returns {Promise<void>}
     */
    async _handleFsEventsSymlink(e, _, R, P) {
      if (!(this.fsw.closed || this.fsw._symlinkPaths.has(_))) {
        this.fsw._symlinkPaths.set(_, !0), this.fsw._incrReadyCount();
        try {
          const x = await g(e);
          if (this.fsw.closed) return;
          if (this.fsw._isIgnored(x))
            return this.fsw._emitReady();
          this.fsw._incrReadyCount(), this._addToFsEvents(x || e, (H) => {
            let $ = e;
            return x && x !== D ? $ = H.replace(x, e) : H !== D && ($ = r.join(e, H)), R($);
          }, !1, P);
        } catch (x) {
          if (this.fsw._handleError(x))
            return this.fsw._emitReady();
        }
      }
    }
    /**
     *
     * @param {Path} newPath
     * @param {fs.Stats} stats
     */
    emitAdd(e, _, R, P, x) {
      const H = R(e), $ = _.isDirectory(), Q = this.fsw._getWatchedDir(r.dirname(H)), G = r.basename(H);
      $ && this.fsw._getWatchedDir(H), !Q.has(G) && (Q.add(G), (!P.ignoreInitial || x === !0) && this.fsw._emit($ ? l : S, H, _));
    }
    initWatch(e, _, R, P) {
      if (this.fsw.closed) return;
      const x = this._watchWithFsEvents(
        R.watchPath,
        r.resolve(e || R.watchPath),
        P,
        R.globFilter
      );
      this.fsw._addPathCloser(_, x);
    }
    /**
     * Handle added path with fsevents
     * @param {String} path file/dir path or glob pattern
     * @param {Function|Boolean=} transform converts working path to what the user expects
     * @param {Boolean=} forceAdd ensure add is emitted
     * @param {Number=} priorDepth Level of subdirectories already traversed.
     * @returns {Promise<void>}
     */
    async _addToFsEvents(e, _, R, P) {
      if (this.fsw.closed)
        return;
      const x = this.fsw.options, H = typeof _ === v ? _ : I, $ = this.fsw._getWatchHelpers(e);
      try {
        const Q = await Y[$.statMethod]($.watchPath);
        if (this.fsw.closed) return;
        if (this.fsw._isIgnored($.watchPath, Q))
          throw null;
        if (Q.isDirectory()) {
          if ($.globFilter || this.emitAdd(H(e), Q, H, x, R), P && P > x.depth) return;
          this.fsw._readdirp($.watchPath, {
            fileFilter: (G) => $.filterPath(G),
            directoryFilter: (G) => $.filterDir(G),
            ...F(x.depth - (P || 0))
          }).on(h, (G) => {
            if (this.fsw.closed || G.stats.isDirectory() && !$.filterPath(G)) return;
            const U = r.join($.watchPath, G.path), { fullPath: w } = G;
            if ($.followSymlinks && G.stats.isSymbolicLink()) {
              const Z = x.depth === void 0 ? void 0 : ue(U, r.resolve($.watchPath)) + 1;
              this._handleFsEventsSymlink(U, w, H, Z);
            } else
              this.emitAdd(U, G.stats, H, x, R);
          }).on(c, K).on(f, () => {
            this.fsw._emitReady();
          });
        } else
          this.emitAdd($.watchPath, Q, H, x, R), this.fsw._emitReady();
      } catch (Q) {
        (!Q || this.fsw._handleError(Q)) && (this.fsw._emitReady(), this.fsw._emitReady());
      }
      if (x.persistent && R !== !0)
        if (typeof _ === v)
          this.initWatch(void 0, e, $, H);
        else {
          let Q;
          try {
            Q = await g($.watchPath);
          } catch {
          }
          this.initWatch(Q, e, $, H);
        }
    }
  }
  return we.exports = L, we.exports.canUse = i, we.exports;
}
var Ut;
function Os() {
  if (Ut) return ye;
  Ut = 1;
  const { EventEmitter: a } = rs, r = Se, p = ge, { promisify: A } = me, S = /* @__PURE__ */ us(), y = ds().default, l = /* @__PURE__ */ Es(), s = /* @__PURE__ */ Vt(), c = /* @__PURE__ */ bs(), h = /* @__PURE__ */ qt(), f = /* @__PURE__ */ Ts(), T = /* @__PURE__ */ Hs(), {
    EV_ALL: n,
    EV_READY: V,
    EV_ADD: M,
    EV_CHANGE: j,
    EV_UNLINK: C,
    EV_ADD_DIR: O,
    EV_UNLINK_DIR: W,
    EV_RAW: u,
    EV_ERROR: N,
    STR_CLOSE: b,
    STR_END: D,
    BACK_SLASH_RE: v,
    DOUBLE_SLASH_RE: K,
    SLASH_OR_BACK_SLASH_RE: I,
    DOT_RE: F,
    REPLACER_RE: k,
    SLASH: B,
    SLASH_SLASH: g,
    BRACE_START: Y,
    BANG: z,
    ONE_DOT: re,
    TWO_DOTS: X,
    GLOBSTAR: oe,
    SLASH_GLOBSTAR: he,
    ANYMATCH_OPTS: ne,
    STRING_TYPE: i,
    FUNCTION_TYPE: ue,
    EMPTY_STR: se,
    EMPTY_FN: L,
    isWindows: t,
    isMacos: e,
    isIBMi: _
  } = /* @__PURE__ */ ut(), R = A(r.stat), P = A(r.readdir), x = (ie = []) => Array.isArray(ie) ? ie : [ie], H = (ie, o = []) => (ie.forEach((d) => {
    Array.isArray(d) ? H(d, o) : o.push(d);
  }), o), $ = (ie) => {
    const o = H(x(ie));
    if (!o.every((d) => typeof d === i))
      throw new TypeError(`Non-string provided as watch path: ${o}`);
    return o.map(G);
  }, Q = (ie) => {
    let o = ie.replace(v, B), d = !1;
    for (o.startsWith(g) && (d = !0); o.match(K); )
      o = o.replace(K, B);
    return d && (o = B + o), o;
  }, G = (ie) => Q(p.normalize(Q(ie))), U = (ie = se) => (o) => typeof o !== i ? o : G(p.isAbsolute(o) ? o : p.join(ie, o)), w = (ie, o) => p.isAbsolute(ie) ? ie : ie.startsWith(z) ? z + p.join(o, ie.slice(1)) : p.join(o, ie), Z = (ie, o) => ie[o] === void 0;
  class de {
    /**
     * @param {Path} dir
     * @param {Function} removeWatcher
     */
    constructor(o, d) {
      this.path = o, this._removeWatcher = d, this.items = /* @__PURE__ */ new Set();
    }
    add(o) {
      const { items: d } = this;
      d && o !== re && o !== X && d.add(o);
    }
    async remove(o) {
      const { items: d } = this;
      if (!d || (d.delete(o), d.size > 0)) return;
      const ee = this.path;
      try {
        await P(ee);
      } catch {
        this._removeWatcher && this._removeWatcher(p.dirname(ee), p.basename(ee));
      }
    }
    has(o) {
      const { items: d } = this;
      if (d)
        return d.has(o);
    }
    /**
     * @returns {Array<String>}
     */
    getChildren() {
      const { items: o } = this;
      if (o)
        return [...o.values()];
    }
    dispose() {
      this.items.clear(), delete this.path, delete this._removeWatcher, delete this.items, Object.freeze(this);
    }
  }
  const m = "stat", te = "lstat";
  class E {
    constructor(o, d, ee, J) {
      this.fsw = J, this.path = o = o.replace(k, se), this.watchPath = d, this.fullWatchPath = p.resolve(d), this.hasGlob = d !== o, o === se && (this.hasGlob = !1), this.globSymlink = this.hasGlob && ee ? void 0 : !1, this.globFilter = this.hasGlob ? y(o, void 0, ne) : !1, this.dirParts = this.getDirParts(o), this.dirParts.forEach((pe) => {
        pe.length > 1 && pe.pop();
      }), this.followSymlinks = ee, this.statMethod = ee ? m : te;
    }
    checkGlobSymlink(o) {
      return this.globSymlink === void 0 && (this.globSymlink = o.fullParentDir === this.fullWatchPath ? !1 : { realPath: o.fullParentDir, linkPath: this.fullWatchPath }), this.globSymlink ? o.fullPath.replace(this.globSymlink.realPath, this.globSymlink.linkPath) : o.fullPath;
    }
    entryPath(o) {
      return p.join(
        this.watchPath,
        p.relative(this.watchPath, this.checkGlobSymlink(o))
      );
    }
    filterPath(o) {
      const { stats: d } = o;
      if (d && d.isSymbolicLink()) return this.filterDir(o);
      const ee = this.entryPath(o);
      return (this.hasGlob && typeof this.globFilter === ue ? this.globFilter(ee) : !0) && this.fsw._isntIgnored(ee, d) && this.fsw._hasReadPermissions(d);
    }
    getDirParts(o) {
      if (!this.hasGlob) return [];
      const d = [];
      return (o.includes(Y) ? c.expand(o) : [o]).forEach((J) => {
        d.push(p.relative(this.watchPath, J).split(I));
      }), d;
    }
    filterDir(o) {
      if (this.hasGlob) {
        const d = this.getDirParts(this.checkGlobSymlink(o));
        let ee = !1;
        this.unmatchedGlob = !this.dirParts.some((J) => J.every((pe, le) => (pe === oe && (ee = !0), ee || !d[0][le] || y(pe, d[0][le], ne))));
      }
      return !this.unmatchedGlob && this.fsw._isntIgnored(this.entryPath(o), o.stats);
    }
  }
  class q extends a {
    // Not indenting methods for history sake; for now.
    constructor(o) {
      super();
      const d = {};
      o && Object.assign(d, o), this._watched = /* @__PURE__ */ new Map(), this._closers = /* @__PURE__ */ new Map(), this._ignoredPaths = /* @__PURE__ */ new Set(), this._throttled = /* @__PURE__ */ new Map(), this._symlinkPaths = /* @__PURE__ */ new Map(), this._streams = /* @__PURE__ */ new Set(), this.closed = !1, Z(d, "persistent") && (d.persistent = !0), Z(d, "ignoreInitial") && (d.ignoreInitial = !1), Z(d, "ignorePermissionErrors") && (d.ignorePermissionErrors = !1), Z(d, "interval") && (d.interval = 100), Z(d, "binaryInterval") && (d.binaryInterval = 300), Z(d, "disableGlobbing") && (d.disableGlobbing = !1), d.enableBinaryInterval = d.binaryInterval !== d.interval, Z(d, "useFsEvents") && (d.useFsEvents = !d.usePolling), T.canUse() || (d.useFsEvents = !1), Z(d, "usePolling") && !d.useFsEvents && (d.usePolling = e), _ && (d.usePolling = !0);
      const J = process.env.CHOKIDAR_USEPOLLING;
      if (J !== void 0) {
        const fe = J.toLowerCase();
        fe === "false" || fe === "0" ? d.usePolling = !1 : fe === "true" || fe === "1" ? d.usePolling = !0 : d.usePolling = !!fe;
      }
      const pe = process.env.CHOKIDAR_INTERVAL;
      pe && (d.interval = Number.parseInt(pe, 10)), Z(d, "atomic") && (d.atomic = !d.usePolling && !d.useFsEvents), d.atomic && (this._pendingUnlinks = /* @__PURE__ */ new Map()), Z(d, "followSymlinks") && (d.followSymlinks = !0), Z(d, "awaitWriteFinish") && (d.awaitWriteFinish = !1), d.awaitWriteFinish === !0 && (d.awaitWriteFinish = {});
      const le = d.awaitWriteFinish;
      le && (le.stabilityThreshold || (le.stabilityThreshold = 2e3), le.pollInterval || (le.pollInterval = 100), this._pendingWrites = /* @__PURE__ */ new Map()), d.ignored && (d.ignored = x(d.ignored));
      let ce = 0;
      this._emitReady = () => {
        ce++, ce >= this._readyCount && (this._emitReady = L, this._readyEmitted = !0, process.nextTick(() => this.emit(V)));
      }, this._emitRaw = (...fe) => this.emit(u, ...fe), this._readyEmitted = !1, this.options = d, d.useFsEvents ? this._fsEventsHandler = new T(this) : this._nodeFsHandler = new f(this), Object.freeze(d);
    }
    // Public methods
    /**
     * Adds paths to be watched on an existing FSWatcher instance
     * @param {Path|Array<Path>} paths_
     * @param {String=} _origAdd private; for handling non-existent paths to be watched
     * @param {Boolean=} _internal private; indicates a non-user add
     * @returns {FSWatcher} for chaining
     */
    add(o, d, ee) {
      const { cwd: J, disableGlobbing: pe } = this.options;
      this.closed = !1;
      let le = $(o);
      return J && (le = le.map((ce) => {
        const fe = w(ce, J);
        return pe || !s(ce) ? fe : h(fe);
      })), le = le.filter((ce) => ce.startsWith(z) ? (this._ignoredPaths.add(ce.slice(1)), !1) : (this._ignoredPaths.delete(ce), this._ignoredPaths.delete(ce + he), this._userIgnored = void 0, !0)), this.options.useFsEvents && this._fsEventsHandler ? (this._readyCount || (this._readyCount = le.length), this.options.persistent && (this._readyCount += le.length), le.forEach((ce) => this._fsEventsHandler._addToFsEvents(ce))) : (this._readyCount || (this._readyCount = 0), this._readyCount += le.length, Promise.all(
        le.map(async (ce) => {
          const fe = await this._nodeFsHandler._addToNodeFs(ce, !ee, 0, 0, d);
          return fe && this._emitReady(), fe;
        })
      ).then((ce) => {
        this.closed || ce.filter((fe) => fe).forEach((fe) => {
          this.add(p.dirname(fe), p.basename(d || fe));
        });
      })), this;
    }
    /**
     * Close watchers or start ignoring events from specified paths.
     * @param {Path|Array<Path>} paths_ - string or array of strings, file/directory paths and/or globs
     * @returns {FSWatcher} for chaining
    */
    unwatch(o) {
      if (this.closed) return this;
      const d = $(o), { cwd: ee } = this.options;
      return d.forEach((J) => {
        !p.isAbsolute(J) && !this._closers.has(J) && (ee && (J = p.join(ee, J)), J = p.resolve(J)), this._closePath(J), this._ignoredPaths.add(J), this._watched.has(J) && this._ignoredPaths.add(J + he), this._userIgnored = void 0;
      }), this;
    }
    /**
     * Close watchers and remove all listeners from watched paths.
     * @returns {Promise<void>}.
    */
    close() {
      if (this.closed) return this._closePromise;
      this.closed = !0, this.removeAllListeners();
      const o = [];
      return this._closers.forEach((d) => d.forEach((ee) => {
        const J = ee();
        J instanceof Promise && o.push(J);
      })), this._streams.forEach((d) => d.destroy()), this._userIgnored = void 0, this._readyCount = 0, this._readyEmitted = !1, this._watched.forEach((d) => d.dispose()), ["closers", "watched", "streams", "symlinkPaths", "throttled"].forEach((d) => {
        this[`_${d}`].clear();
      }), this._closePromise = o.length ? Promise.all(o).then(() => {
      }) : Promise.resolve(), this._closePromise;
    }
    /**
     * Expose list of watched paths
     * @returns {Object} for chaining
    */
    getWatched() {
      const o = {};
      return this._watched.forEach((d, ee) => {
        const J = this.options.cwd ? p.relative(this.options.cwd, ee) : ee;
        o[J || re] = d.getChildren().sort();
      }), o;
    }
    emitWithAll(o, d) {
      this.emit(...d), o !== N && this.emit(n, ...d);
    }
    // Common helpers
    // --------------
    /**
     * Normalize and emit events.
     * Calling _emit DOES NOT MEAN emit() would be called!
     * @param {EventName} event Type of event
     * @param {Path} path File or directory path
     * @param {*=} val1 arguments to be passed with event
     * @param {*=} val2
     * @param {*=} val3
     * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
     */
    async _emit(o, d, ee, J, pe) {
      if (this.closed) return;
      const le = this.options;
      t && (d = p.normalize(d)), le.cwd && (d = p.relative(le.cwd, d));
      const ce = [o, d];
      pe !== void 0 ? ce.push(ee, J, pe) : J !== void 0 ? ce.push(ee, J) : ee !== void 0 && ce.push(ee);
      const fe = le.awaitWriteFinish;
      let Re;
      if (fe && (Re = this._pendingWrites.get(d)))
        return Re.lastChange = /* @__PURE__ */ new Date(), this;
      if (le.atomic) {
        if (o === C)
          return this._pendingUnlinks.set(d, ce), setTimeout(() => {
            this._pendingUnlinks.forEach((_e, Ee) => {
              this.emit(..._e), this.emit(n, ..._e), this._pendingUnlinks.delete(Ee);
            });
          }, typeof le.atomic == "number" ? le.atomic : 100), this;
        o === M && this._pendingUnlinks.has(d) && (o = ce[0] = j, this._pendingUnlinks.delete(d));
      }
      if (fe && (o === M || o === j) && this._readyEmitted) {
        const _e = (Ee, Ae) => {
          Ee ? (o = ce[0] = N, ce[1] = Ee, this.emitWithAll(o, ce)) : Ae && (ce.length > 2 ? ce[2] = Ae : ce.push(Ae), this.emitWithAll(o, ce));
        };
        return this._awaitWriteFinish(d, fe.stabilityThreshold, o, _e), this;
      }
      if (o === j && !this._throttle(j, d, 50))
        return this;
      if (le.alwaysStat && ee === void 0 && (o === M || o === O || o === j)) {
        const _e = le.cwd ? p.join(le.cwd, d) : d;
        let Ee;
        try {
          Ee = await R(_e);
        } catch {
        }
        if (!Ee || this.closed) return;
        ce.push(Ee);
      }
      return this.emitWithAll(o, ce), this;
    }
    /**
     * Common handler for errors
     * @param {Error} error
     * @returns {Error|Boolean} The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
     */
    _handleError(o) {
      const d = o && o.code;
      return o && d !== "ENOENT" && d !== "ENOTDIR" && (!this.options.ignorePermissionErrors || d !== "EPERM" && d !== "EACCES") && this.emit(N, o), o || this.closed;
    }
    /**
     * Helper utility for throttling
     * @param {ThrottleType} actionType type being throttled
     * @param {Path} path being acted upon
     * @param {Number} timeout duration of time to suppress duplicate actions
     * @returns {Object|false} tracking object or false if action should be suppressed
     */
    _throttle(o, d, ee) {
      this._throttled.has(o) || this._throttled.set(o, /* @__PURE__ */ new Map());
      const J = this._throttled.get(o), pe = J.get(d);
      if (pe)
        return pe.count++, !1;
      let le;
      const ce = () => {
        const Re = J.get(d), _e = Re ? Re.count : 0;
        return J.delete(d), clearTimeout(le), Re && clearTimeout(Re.timeoutObject), _e;
      };
      le = setTimeout(ce, ee);
      const fe = { timeoutObject: le, clear: ce, count: 0 };
      return J.set(d, fe), fe;
    }
    _incrReadyCount() {
      return this._readyCount++;
    }
    /**
     * Awaits write operation to finish.
     * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
     * @param {Path} path being acted upon
     * @param {Number} threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
     * @param {EventName} event
     * @param {Function} awfEmit Callback to be called when ready for event to be emitted.
     */
    _awaitWriteFinish(o, d, ee, J) {
      let pe, le = o;
      this.options.cwd && !p.isAbsolute(o) && (le = p.join(this.options.cwd, o));
      const ce = /* @__PURE__ */ new Date(), fe = (Re) => {
        r.stat(le, (_e, Ee) => {
          if (_e || !this._pendingWrites.has(o)) {
            _e && _e.code !== "ENOENT" && J(_e);
            return;
          }
          const Ae = Number(/* @__PURE__ */ new Date());
          Re && Ee.size !== Re.size && (this._pendingWrites.get(o).lastChange = Ae);
          const zt = this._pendingWrites.get(o);
          Ae - zt.lastChange >= d ? (this._pendingWrites.delete(o), J(void 0, Ee)) : pe = setTimeout(
            fe,
            this.options.awaitWriteFinish.pollInterval,
            Ee
          );
        });
      };
      this._pendingWrites.has(o) || (this._pendingWrites.set(o, {
        lastChange: ce,
        cancelWait: () => (this._pendingWrites.delete(o), clearTimeout(pe), ee)
      }), pe = setTimeout(
        fe,
        this.options.awaitWriteFinish.pollInterval
      ));
    }
    _getGlobIgnored() {
      return [...this._ignoredPaths.values()];
    }
    /**
     * Determines whether user has asked to ignore this path.
     * @param {Path} path filepath or dir
     * @param {fs.Stats=} stats result of fs.stat
     * @returns {Boolean}
     */
    _isIgnored(o, d) {
      if (this.options.atomic && F.test(o)) return !0;
      if (!this._userIgnored) {
        const { cwd: ee } = this.options, J = this.options.ignored, pe = J && J.map(U(ee)), le = x(pe).filter((fe) => typeof fe === i && !s(fe)).map((fe) => fe + he), ce = this._getGlobIgnored().map(U(ee)).concat(pe, le);
        this._userIgnored = y(ce, void 0, ne);
      }
      return this._userIgnored([o, d]);
    }
    _isntIgnored(o, d) {
      return !this._isIgnored(o, d);
    }
    /**
     * Provides a set of common helpers and properties relating to symlink and glob handling.
     * @param {Path} path file, directory, or glob pattern being watched
     * @param {Number=} depth at any depth > 0, this isn't a glob
     * @returns {WatchHelper} object containing helpers for this path
     */
    _getWatchHelpers(o, d) {
      const ee = d || this.options.disableGlobbing || !s(o) ? o : l(o), J = this.options.followSymlinks;
      return new E(o, ee, J, this);
    }
    // Directory helpers
    // -----------------
    /**
     * Provides directory tracking objects
     * @param {String} directory path of the directory
     * @returns {DirEntry} the directory's tracking object
     */
    _getWatchedDir(o) {
      this._boundRemove || (this._boundRemove = this._remove.bind(this));
      const d = p.resolve(o);
      return this._watched.has(d) || this._watched.set(d, new de(d, this._boundRemove)), this._watched.get(d);
    }
    // File helpers
    // ------------
    /**
     * Check for read permissions.
     * Based on this answer on SO: https://stackoverflow.com/a/11781404/1358405
     * @param {fs.Stats} stats - object, result of fs_stat
     * @returns {Boolean} indicates whether the file can be read
    */
    _hasReadPermissions(o) {
      if (this.options.ignorePermissionErrors) return !0;
      const ee = (o && Number.parseInt(o.mode, 10)) & 511;
      return !!(4 & Number.parseInt(ee.toString(8)[0], 10));
    }
    /**
     * Handles emitting unlink events for
     * files and directories, and via recursion, for
     * files and directories within directories that are unlinked
     * @param {String} directory within which the following item is located
     * @param {String} item      base path of item/directory
     * @returns {void}
    */
    _remove(o, d, ee) {
      const J = p.join(o, d), pe = p.resolve(J);
      if (ee = ee ?? (this._watched.has(J) || this._watched.has(pe)), !this._throttle("remove", J, 100)) return;
      !ee && !this.options.useFsEvents && this._watched.size === 1 && this.add(o, d, !0), this._getWatchedDir(J).getChildren().forEach((Ae) => this._remove(J, Ae));
      const fe = this._getWatchedDir(o), Re = fe.has(d);
      fe.remove(d), this._symlinkPaths.has(pe) && this._symlinkPaths.delete(pe);
      let _e = J;
      if (this.options.cwd && (_e = p.relative(this.options.cwd, J)), this.options.awaitWriteFinish && this._pendingWrites.has(_e) && this._pendingWrites.get(_e).cancelWait() === M)
        return;
      this._watched.delete(J), this._watched.delete(pe);
      const Ee = ee ? W : C;
      Re && !this._isIgnored(J) && this._emit(Ee, J), this.options.useFsEvents || this._closePath(J);
    }
    /**
     * Closes all watchers for a path
     * @param {Path} path
     */
    _closePath(o) {
      this._closeFile(o);
      const d = p.dirname(o);
      this._getWatchedDir(d).remove(p.basename(o));
    }
    /**
     * Closes only file-specific watchers
     * @param {Path} path
     */
    _closeFile(o) {
      const d = this._closers.get(o);
      d && (d.forEach((ee) => ee()), this._closers.delete(o));
    }
    /**
     *
     * @param {Path} path
     * @param {Function} closer
     */
    _addPathCloser(o, d) {
      if (!d) return;
      let ee = this._closers.get(o);
      ee || (ee = [], this._closers.set(o, ee)), ee.push(d);
    }
    _readdirp(o, d) {
      if (this.closed) return;
      const ee = { type: n, alwaysStat: !0, lstat: !0, ...d };
      let J = S(o, ee);
      return this._streams.add(J), J.once(b, () => {
        J = void 0;
      }), J.once(D, () => {
        J && (this._streams.delete(J), J = void 0);
      }), J;
    }
  }
  ye.FSWatcher = q;
  const ae = (ie, o) => {
    const d = new q(o);
    return d.add(ie), d;
  };
  return ye.watch = ae, ye;
}
var Ls = /* @__PURE__ */ Os();
const Ns = /* @__PURE__ */ Qt(Ls);
class Is {
  constructor(r, p) {
    this.transformWatchers = /* @__PURE__ */ new Map(), this.chokidarOptions = p, this.task = r, this.watcher = this.createWatcher(null);
  }
  close() {
    this.watcher.close();
    for (const r of this.transformWatchers.values())
      r.close();
  }
  unwatch(r) {
    this.watcher.unwatch(r);
    const p = this.transformWatchers.get(r);
    p && (this.transformWatchers.delete(r), p.close());
  }
  watch(r, p) {
    if (p) {
      const A = this.transformWatchers.get(r) ?? this.createWatcher(r);
      A.add(r), this.transformWatchers.set(r, A);
    } else
      this.watcher.add(r);
  }
  createWatcher(r) {
    const p = this.task, A = ct() === "linux", S = ct() === "freebsd", y = r !== null, l = (c, h) => {
      const f = r || c;
      (A || S) && (s.unwatch(f), s.add(f)), p.invalidate(f, { event: h, isTransformDependency: y });
    }, s = Ns.watch([], this.chokidarOptions).on("add", (c) => l(c, "create")).on("change", (c) => l(c, "update")).on("unlink", (c) => l(c, "delete"));
    return s;
  }
}
const $s = {
  create: {
    create: "buggy",
    delete: null,
    //delete file from map
    update: "create"
  },
  delete: {
    create: "update",
    delete: "buggy",
    update: "buggy"
  },
  update: {
    create: "buggy",
    delete: "delete",
    update: "update"
  }
};
class Xs {
  constructor(r, p) {
    this.buildDelay = 0, this.buildTimeout = null, this.closed = !1, this.invalidatedIds = /* @__PURE__ */ new Map(), this.rerun = !1, this.running = !0, this.emitter = p, p.close = this.close.bind(this), this.tasks = r.map((A) => new Ps(this, A));
    for (const { watch: A } of r)
      A && typeof A.buildDelay == "number" && (this.buildDelay = Math.max(this.buildDelay, A.buildDelay));
    ts.nextTick(() => this.run());
  }
  async close() {
    if (!this.closed) {
      this.closed = !0, this.buildTimeout && clearTimeout(this.buildTimeout);
      for (const r of this.tasks)
        r.close();
      await this.emitter.emit("close"), this.emitter.removeAllListeners();
    }
  }
  invalidate(r) {
    if (r) {
      const p = this.invalidatedIds.get(r.id), A = p ? $s[p][r.event] : r.event;
      A === "buggy" ? this.invalidatedIds.set(r.id, r.event) : A === null ? this.invalidatedIds.delete(r.id) : this.invalidatedIds.set(r.id, A);
    }
    if (this.running) {
      this.rerun = !0;
      return;
    }
    this.buildTimeout && clearTimeout(this.buildTimeout), this.buildTimeout = setTimeout(async () => {
      this.buildTimeout = null;
      try {
        await Promise.all([...this.invalidatedIds].map(([p, A]) => this.emitter.emit("change", p, { event: A }))), this.invalidatedIds.clear(), await this.emitter.emit("restart"), this.emitter.removeListenersForCurrentRun(), this.run();
      } catch (p) {
        this.invalidatedIds.clear(), await this.emitter.emit("event", {
          code: "ERROR",
          error: p,
          result: null
        }), await this.emitter.emit("event", {
          code: "END"
        });
      }
    }, this.buildDelay);
  }
  async run() {
    this.running = !0, await this.emitter.emit("event", {
      code: "START"
    });
    for (const r of this.tasks)
      await r.run();
    this.running = !1, await this.emitter.emit("event", {
      code: "END"
    }), this.rerun && (this.rerun = !1, this.invalidate());
  }
}
class Ps {
  constructor(r, p) {
    this.cache = { modules: [] }, this.watchFiles = [], this.closed = !1, this.invalidated = !0, this.watched = /* @__PURE__ */ new Set(), this.watcher = r, this.options = p, this.skipWrite = !!(p.watch && p.watch.skipWrite), this.outputs = this.options.output, this.outputFiles = this.outputs.map((A) => {
      if (A.file || A.dir)
        return es.resolve(A.file || A.dir);
    }), this.watchOptions = this.options.watch || {}, this.filter = Yt(this.watchOptions.include, this.watchOptions.exclude), this.fileWatcher = new Is(this, {
      ...this.watchOptions.chokidar,
      disableGlobbing: !0,
      ignoreInitial: !0
    });
  }
  close() {
    this.closed = !0, this.fileWatcher.close();
  }
  invalidate(r, p) {
    if (this.invalidated = !0, p.isTransformDependency)
      for (const A of this.cache.modules)
        A.transformDependencies.includes(r) && (A.originalCode = null);
    this.watcher.invalidate({ event: p.event, id: r }), this.watchOptions.onInvalidate?.(r);
  }
  async run() {
    if (!this.invalidated)
      return;
    this.invalidated = !1;
    const r = {
      ...this.options,
      cache: this.cache
    }, p = Date.now();
    await this.watcher.emitter.emit("event", {
      code: "BUNDLE_START",
      input: this.options.input,
      output: this.outputFiles
    });
    let A = null;
    try {
      if (A = await Xt(r, this.watcher.emitter), this.closed)
        return;
      if (this.updateWatchedFiles(A), !this.skipWrite) {
        if (await Promise.all(this.outputs.map((S) => A.write(S))), this.closed)
          return;
        this.updateWatchedFiles(A);
      }
      await this.watcher.emitter.emit("event", {
        code: "BUNDLE_END",
        duration: Date.now() - p,
        input: this.options.input,
        output: this.outputFiles,
        result: A
      });
    } catch (S) {
      if (!this.closed) {
        if (Array.isArray(S.watchFiles))
          for (const y of S.watchFiles)
            this.watchFile(y);
        S.id && (this.cache.modules = this.cache.modules.filter((y) => y.id !== S.id));
      }
      await this.watcher.emitter.emit("event", {
        code: "ERROR",
        error: S,
        result: A
      });
    }
  }
  updateWatchedFiles(r) {
    const p = this.watched;
    this.watched = /* @__PURE__ */ new Set(), this.watchFiles = r.watchFiles, this.cache = r.cache;
    for (const A of this.watchFiles)
      this.watchFile(A);
    for (const A of this.cache.modules)
      for (const S of A.transformDependencies)
        this.watchFile(S, !0);
    for (const A of p)
      this.watched.has(A) || this.fileWatcher.unwatch(A);
  }
  watchFile(r, p = !1) {
    if (this.filter(r)) {
      if (this.watched.add(r), this.outputFiles.includes(r))
        throw new Error("Cannot import the generated bundle");
      this.fileWatcher.watch(r, p);
    }
  }
}
export {
  Ps as Task,
  Xs as Watcher
};
