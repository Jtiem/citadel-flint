import { bD as R, bE as le } from "./main-CEfjB-ow.js";
import { r as ct } from "./lib-mgL1y9zx.js";
var we = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.getFileSystem = g, i.setFileSystem = I;
  let u = {
    readFile: () => {
      throw Error("readFile not implemented");
    },
    writeFile: () => {
      throw Error("writeFile not implemented");
    }
  };
  function I(d) {
    u.readFile = d.readFile, u.writeFile = d.writeFile;
  }
  function g() {
    return u;
  }
})), lt = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.default = I;
  const u = /['"]/;
  function I(g) {
    return g ? (u.test(g.charAt(0)) && (g = g.substr(1)), u.test(g.charAt(g.length - 1)) && (g = g.substr(0, g.length - 1)), g) : "";
  }
})), Le = /* @__PURE__ */ R(((i, u) => {
  const I = /[$]?[\w-]+/g, g = (d, o) => {
    let c;
    for (; c = I.exec(d); ) {
      const f = o[c[0]];
      f && (d = d.slice(0, c.index) + f + d.slice(I.lastIndex), I.lastIndex -= c[0].length - f.length);
    }
    return d;
  };
  u.exports = g;
})), ft = /* @__PURE__ */ R(((i, u) => {
  const I = Le(), g = (d, o) => {
    d.walk((c) => {
      c.type === "decl" && c.value ? c.value = I(c.value.toString(), o) : c.type === "rule" && c.selector ? c.selector = I(c.selector.toString(), o) : c.type === "atrule" && c.params && (c.params = I(c.params.toString(), o));
    });
  };
  u.exports = g;
})), ht = /* @__PURE__ */ R(((i, u) => {
  const I = /^:import\(("[^"]*"|'[^']*'|[^"']+)\)$/, g = /^("[^"]*"|'[^']*'|[^"']+)$/, d = (c) => {
    const f = {};
    return c.walkDecls((t) => {
      const r = t.raws.before ? t.raws.before.trim() : "";
      f[r + t.prop] = t.value;
    }), f;
  }, o = (c, f = !0, t = "auto") => {
    const r = {}, s = {};
    function n(p, b) {
      const e = b.replace(/'|"/g, "");
      r[e] = Object.assign(r[e] || {}, d(p)), f && p.remove();
    }
    function l(p) {
      Object.assign(s, d(p)), f && p.remove();
    }
    return c.each((p) => {
      if (p.type === "rule" && t !== "at-rule") {
        if (p.selector.slice(0, 7) === ":import") {
          const b = I.exec(p.selector);
          b && n(p, b[1]);
        }
        p.selector === ":export" && l(p);
      }
      if (p.type === "atrule" && t !== "rule") {
        if (p.name === "icss-import") {
          const b = g.exec(p.params);
          b && n(p, b[1]);
        }
        p.name === "icss-export" && l(p);
      }
    }), {
      icssImports: r,
      icssExports: s
    };
  };
  u.exports = o;
})), pt = /* @__PURE__ */ R(((i, u) => {
  const I = (o, c, f = "rule") => Object.keys(o).map((t) => {
    const r = o[t], s = Object.keys(r).map((p) => c.decl({
      prop: p,
      value: r[p],
      raws: { before: `
  ` }
    })), n = s.length > 0, l = f === "rule" ? c.rule({
      selector: `:import('${t}')`,
      raws: { after: n ? `
` : "" }
    }) : c.atRule({
      name: "icss-import",
      params: `'${t}'`,
      raws: { after: n ? `
` : "" }
    });
    return n && l.append(s), l;
  }), g = (o, c, f = "rule") => {
    const t = Object.keys(o).map((s) => c.decl({
      prop: s,
      value: o[s],
      raws: { before: `
  ` }
    }));
    if (t.length === 0) return [];
    const r = f === "rule" ? c.rule({
      selector: ":export",
      raws: { after: `
` }
    }) : c.atRule({
      name: "icss-export",
      raws: { after: `
` }
    });
    return r.append(t), [r];
  }, d = (o, c, f, t) => [...I(o, f, t), ...g(c, f, t)];
  u.exports = d;
})), be = /* @__PURE__ */ R(((i, u) => {
  const I = Le(), g = ft(), d = ht(), o = pt();
  u.exports = {
    replaceValueSymbols: I,
    replaceSymbols: g,
    extractICSS: d,
    createICSSRules: o
  };
})), Me = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.default = void 0;
  var u = be();
  const I = /^:import\((.+)\)$/;
  var g = class {
    constructor(d, o) {
      this.pathFetcher = d, this.plugin = this.plugin.bind(this), this.exportTokens = {}, this.translations = {}, this.trace = o;
    }
    plugin() {
      const d = this;
      return {
        postcssPlugin: "css-modules-parser",
        async OnceExit(o) {
          return await Promise.all(d.fetchAllImports(o)), d.linkImportedSymbols(o), d.extractExports(o);
        }
      };
    }
    fetchAllImports(d) {
      let o = [];
      return d.each((c) => {
        c.type == "rule" && c.selector.match(I) && o.push(this.fetchImport(c, d.source.input.from, o.length));
      }), o;
    }
    linkImportedSymbols(d) {
      (0, u.replaceSymbols)(d, this.translations);
    }
    extractExports(d) {
      d.each((o) => {
        o.type == "rule" && o.selector == ":export" && this.handleExport(o);
      });
    }
    handleExport(d) {
      d.each((o) => {
        o.type == "decl" && (Object.keys(this.translations).forEach((c) => {
          o.value = o.value.replace(c, this.translations[c]);
        }), this.exportTokens[o.prop] = o.value);
      }), d.remove();
    }
    async fetchImport(d, o, c) {
      const f = d.selector.match(I)[1], t = this.trace + String.fromCharCode(c), r = await this.pathFetcher(f, o, t);
      try {
        d.each((s) => {
          s.type == "decl" && (this.translations[s.prop] = r[s.value]);
        }), d.remove();
      } catch (s) {
        console.log(s);
      }
    }
  };
  i.default = g;
})), vt = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.default = I;
  var u = we();
  function I(g, d) {
    return new Promise((o, c) => {
      const { writeFile: f } = (0, u.getFileSystem)();
      f(`${g}.json`, JSON.stringify(d), (t) => t ? c(t) : o(d));
    });
  }
})), dt = /* @__PURE__ */ R(((i, u) => {
  var I = 1 / 0, g = "[object Symbol]", d = /[^\x00-\x2f\x3a-\x40\x5b-\x60\x7b-\x7f]+/g, o = /[\xc0-\xd6\xd8-\xf6\xf8-\xff\u0100-\u017f]/g, c = "\\ud800-\\udfff", f = "\\u0300-\\u036f\\ufe20-\\ufe23", t = "\\u20d0-\\u20f0", r = "\\u2700-\\u27bf", s = "a-z\\xdf-\\xf6\\xf8-\\xff", n = "\\xac\\xb1\\xd7\\xf7", l = "\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf", p = "\\u2000-\\u206f", b = " \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000", e = "A-Z\\xc0-\\xd6\\xd8-\\xde", v = "\\ufe0e\\ufe0f", _ = n + l + p + b, m = "['’]", y = "[" + c + "]", O = "[" + _ + "]", a = "[" + f + t + "]", h = "\\d+", E = "[" + r + "]", w = "[" + s + "]", S = "[^" + c + _ + h + r + s + e + "]", A = "\\ud83c[\\udffb-\\udfff]", k = "(?:" + a + "|" + A + ")", C = "[^" + c + "]", L = "(?:\\ud83c[\\udde6-\\uddff]){2}", F = "[\\ud800-\\udbff][\\udc00-\\udfff]", B = "[" + e + "]", G = "\\u200d", H = "(?:" + w + "|" + S + ")", $ = "(?:" + B + "|" + S + ")", te = "(?:" + m + "(?:d|ll|m|re|s|t|ve))?", pe = "(?:" + m + "(?:D|LL|M|RE|S|T|VE))?", N = k + "?", Q = "[" + v + "]?", q = "(?:" + G + "(?:" + [
    C,
    L,
    F
  ].join("|") + ")" + Q + N + ")*", P = Q + N + q, D = "(?:" + [
    E,
    L,
    F
  ].join("|") + ")" + P, U = "(?:" + [
    C + a + "?",
    a,
    L,
    F,
    y
  ].join("|") + ")", T = RegExp(m, "g"), Y = RegExp(a, "g"), j = RegExp(A + "(?=" + A + ")|" + U + P, "g"), J = RegExp([
    B + "?" + w + "+" + te + "(?=" + [
      O,
      B,
      "$"
    ].join("|") + ")",
    $ + "+" + pe + "(?=" + [
      O,
      B + H,
      "$"
    ].join("|") + ")",
    B + "?" + H + "+" + te,
    B + "+" + pe,
    h,
    D
  ].join("|"), "g"), x = RegExp("[" + G + c + f + t + v + "]"), K = /[a-z][A-Z]|[A-Z]{2,}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/, X = {
    À: "A",
    Á: "A",
    Â: "A",
    Ã: "A",
    Ä: "A",
    Å: "A",
    à: "a",
    á: "a",
    â: "a",
    ã: "a",
    ä: "a",
    å: "a",
    Ç: "C",
    ç: "c",
    Ð: "D",
    ð: "d",
    È: "E",
    É: "E",
    Ê: "E",
    Ë: "E",
    è: "e",
    é: "e",
    ê: "e",
    ë: "e",
    Ì: "I",
    Í: "I",
    Î: "I",
    Ï: "I",
    ì: "i",
    í: "i",
    î: "i",
    ï: "i",
    Ñ: "N",
    ñ: "n",
    Ò: "O",
    Ó: "O",
    Ô: "O",
    Õ: "O",
    Ö: "O",
    Ø: "O",
    ò: "o",
    ó: "o",
    ô: "o",
    õ: "o",
    ö: "o",
    ø: "o",
    Ù: "U",
    Ú: "U",
    Û: "U",
    Ü: "U",
    ù: "u",
    ú: "u",
    û: "u",
    ü: "u",
    Ý: "Y",
    ý: "y",
    ÿ: "y",
    Æ: "Ae",
    æ: "ae",
    Þ: "Th",
    þ: "th",
    ß: "ss",
    Ā: "A",
    Ă: "A",
    Ą: "A",
    ā: "a",
    ă: "a",
    ą: "a",
    Ć: "C",
    Ĉ: "C",
    Ċ: "C",
    Č: "C",
    ć: "c",
    ĉ: "c",
    ċ: "c",
    č: "c",
    Ď: "D",
    Đ: "D",
    ď: "d",
    đ: "d",
    Ē: "E",
    Ĕ: "E",
    Ė: "E",
    Ę: "E",
    Ě: "E",
    ē: "e",
    ĕ: "e",
    ė: "e",
    ę: "e",
    ě: "e",
    Ĝ: "G",
    Ğ: "G",
    Ġ: "G",
    Ģ: "G",
    ĝ: "g",
    ğ: "g",
    ġ: "g",
    ģ: "g",
    Ĥ: "H",
    Ħ: "H",
    ĥ: "h",
    ħ: "h",
    Ĩ: "I",
    Ī: "I",
    Ĭ: "I",
    Į: "I",
    İ: "I",
    ĩ: "i",
    ī: "i",
    ĭ: "i",
    į: "i",
    ı: "i",
    Ĵ: "J",
    ĵ: "j",
    Ķ: "K",
    ķ: "k",
    ĸ: "k",
    Ĺ: "L",
    Ļ: "L",
    Ľ: "L",
    Ŀ: "L",
    Ł: "L",
    ĺ: "l",
    ļ: "l",
    ľ: "l",
    ŀ: "l",
    ł: "l",
    Ń: "N",
    Ņ: "N",
    Ň: "N",
    Ŋ: "N",
    ń: "n",
    ņ: "n",
    ň: "n",
    ŋ: "n",
    Ō: "O",
    Ŏ: "O",
    Ő: "O",
    ō: "o",
    ŏ: "o",
    ő: "o",
    Ŕ: "R",
    Ŗ: "R",
    Ř: "R",
    ŕ: "r",
    ŗ: "r",
    ř: "r",
    Ś: "S",
    Ŝ: "S",
    Ş: "S",
    Š: "S",
    ś: "s",
    ŝ: "s",
    ş: "s",
    š: "s",
    Ţ: "T",
    Ť: "T",
    Ŧ: "T",
    ţ: "t",
    ť: "t",
    ŧ: "t",
    Ũ: "U",
    Ū: "U",
    Ŭ: "U",
    Ů: "U",
    Ű: "U",
    Ų: "U",
    ũ: "u",
    ū: "u",
    ŭ: "u",
    ů: "u",
    ű: "u",
    ų: "u",
    Ŵ: "W",
    ŵ: "w",
    Ŷ: "Y",
    ŷ: "y",
    Ÿ: "Y",
    Ź: "Z",
    Ż: "Z",
    Ž: "Z",
    ź: "z",
    ż: "z",
    ž: "z",
    Ĳ: "IJ",
    ĳ: "ij",
    Œ: "Oe",
    œ: "oe",
    ŉ: "'n",
    ſ: "ss"
  }, W = typeof global == "object" && global && global.Object === Object && global, Z = typeof self == "object" && self && self.Object === Object && self, ue = W || Z || Function("return this")();
  function oe(M, z, V, fe) {
    for (var ne = -1, ye = M ? M.length : 0; ++ne < ye; ) V = z(V, M[ne], ne, M);
    return V;
  }
  function re(M) {
    return M.split("");
  }
  function ee(M) {
    return M.match(d) || [];
  }
  function se(M) {
    return function(z) {
      return M?.[z];
    };
  }
  var ae = se(X);
  function ce(M) {
    return x.test(M);
  }
  function ve(M) {
    return K.test(M);
  }
  function ge(M) {
    return ce(M) ? de(M) : re(M);
  }
  function de(M) {
    return M.match(j) || [];
  }
  function Se(M) {
    return M.match(J) || [];
  }
  var Ee = Object.prototype.toString, Ae = ue.Symbol, me = Ae ? Ae.prototype : void 0, Ce = me ? me.toString : void 0;
  function Ze(M, z, V) {
    var fe = -1, ne = M.length;
    z < 0 && (z = -z > ne ? 0 : ne + z), V = V > ne ? ne : V, V < 0 && (V += ne), ne = z > V ? 0 : V - z >>> 0, z >>>= 0;
    for (var ye = Array(ne); ++fe < ne; ) ye[fe] = M[fe + z];
    return ye;
  }
  function Xe(M) {
    if (typeof M == "string") return M;
    if (it(M)) return Ce ? Ce.call(M) : "";
    var z = M + "";
    return z == "0" && 1 / M == -I ? "-0" : z;
  }
  function $e(M, z, V) {
    var fe = M.length;
    return V = V === void 0 ? fe : V, !z && V >= fe ? M : Ze(M, z, V);
  }
  function et(M) {
    return function(z) {
      z = _e(z);
      var V = ce(z) ? ge(z) : void 0, fe = V ? V[0] : z.charAt(0), ne = V ? $e(V, 1).join("") : z.slice(1);
      return fe[M]() + ne;
    };
  }
  function tt(M) {
    return function(z) {
      return oe(ut(at(z).replace(T, "")), M, "");
    };
  }
  function rt(M) {
    return !!M && typeof M == "object";
  }
  function it(M) {
    return typeof M == "symbol" || rt(M) && Ee.call(M) == g;
  }
  function _e(M) {
    return M == null ? "" : Xe(M);
  }
  var st = tt(function(M, z, V) {
    return z = z.toLowerCase(), M + (V ? nt(z) : z);
  });
  function nt(M) {
    return ot(_e(M).toLowerCase());
  }
  function at(M) {
    return M = _e(M), M && M.replace(o, ae).replace(Y, "");
  }
  var ot = et("toUpperCase");
  function ut(M, z, V) {
    return M = _e(M), z = z, z === void 0 ? ve(M) ? Se(M) : ee(M) : M.match(z) || [];
  }
  u.exports = st;
})), gt = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.makeLocalsConventionReducer = d;
  var u = I(dt());
  function I(o) {
    return o && o.__esModule ? o : { default: o };
  }
  function g(o) {
    return o.replace(/-+(\w)/g, (c, f) => f.toUpperCase());
  }
  function d(o, c) {
    const f = typeof o == "function";
    return (t, [r, s]) => {
      if (f) {
        const n = o(r, s, c);
        return t[n] = s, t;
      }
      switch (o) {
        case "camelCase":
          t[r] = s, t[(0, u.default)(r)] = s;
          break;
        case "camelCaseOnly":
          t[(0, u.default)(r)] = s;
          break;
        case "dashes":
          t[r] = s, t[g(r)] = s;
          break;
        case "dashesOnly":
          t[g(r)] = s;
          break;
      }
      return t;
    };
  }
})), At = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.default = void 0;
  var u = o(le("postcss")), I = o(le("path")), g = o(Me()), d = we();
  function o(r) {
    return r && r.__esModule ? r : { default: r };
  }
  var c = class Ne {
    constructor(s) {
      this.plugins = s || Ne.defaultPlugins;
    }
    async load(s, n, l, p) {
      const b = new g.default(p, l), e = this.plugins.concat([b.plugin()]);
      return {
        injectableSource: (await (0, u.default)(e).process(s, { from: n })).css,
        exportTokens: b.exportTokens
      };
    }
  };
  const f = (r, s) => r.length < s.length ? r < s.substring(0, r.length) ? -1 : 1 : r.length > s.length ? r.substring(0, s.length) <= s ? -1 : 1 : r < s ? -1 : 1;
  var t = class {
    constructor(r, s, n) {
      if (r === "/" && process.platform === "win32") {
        const l = process.cwd().slice(0, 3);
        if (!/^[A-Za-z]:\\$/.test(l)) throw new Error(`Failed to obtain root from "${process.cwd()}".`);
        r = l;
      }
      this.root = r, this.fileResolve = n, this.sources = {}, this.traces = {}, this.importNr = 0, this.core = new c(s), this.tokensByFile = {}, this.fs = (0, d.getFileSystem)();
    }
    async fetch(r, s, n) {
      const l = r.replace(/^["']|["']$/g, ""), p = n || String.fromCharCode(this.importNr++), b = typeof this.fileResolve == "function", e = b ? await this.fileResolve(l, s) : await Promise.resolve();
      if (e && !I.default.isAbsolute(e)) throw new Error('The returned path from the "fileResolve" option must be absolute.');
      const v = I.default.dirname(s), _ = e || I.default.resolve(v, l);
      let m = e || I.default.resolve(I.default.resolve(this.root, v), l);
      if (!b && l[0] !== "." && !I.default.isAbsolute(l)) try {
        m = le.resolve(l);
      } catch {
      }
      const y = this.tokensByFile[m];
      return y || new Promise((O, a) => {
        this.fs.readFile(m, "utf-8", async (h, E) => {
          h && a(h);
          const { injectableSource: w, exportTokens: S } = await this.core.load(E, _, p, this.fetch.bind(this));
          this.sources[m] = w, this.traces[p] = m, this.tokensByFile[m] = S, O(S);
        });
      });
    }
    get finalSource() {
      const r = this.traces, s = this.sources;
      let n = /* @__PURE__ */ new Set();
      return Object.keys(r).sort(f).map((l) => {
        const p = r[l];
        return n.has(p) ? null : (n.add(p), s[p]);
      }).join("");
    }
  };
  i.default = t;
})), mt = /* @__PURE__ */ R(((i, u) => {
  function d(f, t) {
    const r = /* @__PURE__ */ new Error("Nondeterministic import's order");
    return r.nodes = [f, t[f].find((s) => t[s].indexOf(f) > -1)], r;
  }
  function o(f, t, r, s, n) {
    if (r[f] === 2) return;
    if (r[f] === 1)
      return n ? d(f, t) : void 0;
    r[f] = 1;
    const l = t[f], p = l.length;
    for (let b = 0; b < p; ++b) {
      const e = o(l[b], t, r, s, n);
      if (e instanceof Error) return e;
    }
    r[f] = 2, s.push(f);
  }
  function c(f, t) {
    const r = [], s = {}, n = Object.keys(f), l = n.length;
    for (let p = 0; p < l; ++p) {
      const b = o(n[p], f, s, r, t);
      if (b instanceof Error) return b;
    }
    return r;
  }
  u.exports = c;
})), _t = /* @__PURE__ */ R(((i, u) => {
  const I = mt(), g = /^(.+?)\s+from\s+(?:"([^"]+)"|'([^']+)'|(global))$/, d = /^:import\((?:"([^"]+)"|'([^']+)')\)/, o = 1;
  function c(f, t, r, s) {
    const n = t + "_siblings", l = t + "_" + f;
    if (s[l] !== o) {
      Array.isArray(s[n]) || (s[n] = []);
      const p = s[n];
      Array.isArray(r[f]) ? r[f] = r[f].concat(p) : r[f] = p.slice(), s[l] = o, p.push(f);
    }
  }
  u.exports = (f = {}) => {
    let t = 0;
    const r = typeof f.createImportedName != "function" ? (n) => `i__imported_${n.replace(/\W/g, "_")}_${t++}` : f.createImportedName, s = f.failOnWrongOrder;
    return {
      postcssPlugin: "postcss-modules-extract-imports",
      prepare() {
        const n = {}, l = {}, p = {}, b = {}, e = {};
        return { Once(v, _) {
          v.walkRules((O) => {
            const a = d.exec(O.selector);
            if (a) {
              const [, h, E] = a, w = h || E;
              c(w, "root", n, l), p[w] = O;
            }
          }), v.walkDecls(/^composes$/, (O) => {
            const a = O.value.split(","), h = [];
            a.forEach((E) => {
              const w = E.trim().match(g);
              if (!w) {
                h.push(E);
                return;
              }
              let S, [, A, k, C, L] = w;
              if (L) S = A.split(/\s+/).map((F) => `global(${F})`);
              else {
                const F = k || C;
                let B = O.parent, G = "";
                for (; B.type !== "root"; )
                  G = B.parent.index(B) + "_" + G, B = B.parent;
                const { selector: H } = O.parent;
                c(F, `_${G}${H}`, n, l), b[F] = O, e[F] = e[F] || {}, S = A.split(/\s+/).map(($) => (e[F][$] || (e[F][$] = r($, F)), e[F][$]));
              }
              h.push(S.join(" "));
            }), O.value = h.join(", ");
          });
          const m = I(n, s);
          if (m instanceof Error) throw b[m.nodes.find((O) => b.hasOwnProperty(O))].error("Failed to resolve order of composed modules " + m.nodes.map((O) => "`" + O + "`").join(", ") + ".", {
            plugin: "postcss-modules-extract-imports",
            word: "composes"
          });
          let y;
          m.forEach((O) => {
            const a = e[O];
            let h = p[O];
            !h && a && (h = _.rule({
              selector: `:import("${O}")`,
              raws: { after: `
` }
            }), y ? v.insertAfter(y, h) : v.prepend(h)), y = h, a && Object.keys(a).forEach((E) => {
              h.append(_.decl({
                value: E,
                prop: a[E],
                raws: { before: `
  ` }
              }));
            });
          });
        } };
      }
    };
  }, u.exports.postcss = !0;
})), Oe = /* @__PURE__ */ R(((i, u) => {
  const I = Math.floor(16368) & -4;
  var g = class {
    /**
    * @param {WebAssembly.Instance} instance wasm instance
    * @param {WebAssembly.Instance[]} instancesPool pool of instances
    * @param {number} chunkSize size of data chunks passed to wasm
    * @param {number} digestSize size of digest returned by wasm
    */
    constructor(o, c, f, t) {
      const r = o.exports;
      r.init(), this.exports = r, this.mem = Buffer.from(r.memory.buffer, 0, 65536), this.buffered = 0, this.instancesPool = c, this.chunkSize = f, this.digestSize = t;
    }
    reset() {
      this.buffered = 0, this.exports.init();
    }
    /**
    * @param {Buffer | string} data data
    * @param {BufferEncoding=} encoding encoding
    * @returns {this} itself
    */
    update(o, c) {
      if (typeof o == "string") {
        for (; o.length > I; )
          this._updateWithShortString(o.slice(0, I), c), o = o.slice(I);
        return this._updateWithShortString(o, c), this;
      }
      return this._updateWithBuffer(o), this;
    }
    /**
    * @param {string} data data
    * @param {BufferEncoding=} encoding encoding
    * @returns {void}
    */
    _updateWithShortString(o, c) {
      const { exports: f, buffered: t, mem: r, chunkSize: s } = this;
      let n;
      if (o.length < 70) if (!c || c === "utf-8" || c === "utf8") {
        n = t;
        for (let l = 0; l < o.length; l++) {
          const p = o.charCodeAt(l);
          if (p < 128) r[n++] = p;
          else if (p < 2048)
            r[n] = p >> 6 | 192, r[n + 1] = p & 63 | 128, n += 2;
          else {
            n += r.write(o.slice(l), n, c);
            break;
          }
        }
      } else if (c === "latin1") {
        n = t;
        for (let l = 0; l < o.length; l++) {
          const p = o.charCodeAt(l);
          r[n++] = p;
        }
      } else n = t + r.write(o, t, c);
      else n = t + r.write(o, t, c);
      if (n < s) this.buffered = n;
      else {
        const l = n & ~(this.chunkSize - 1);
        f.update(l);
        const p = n - l;
        this.buffered = p, p > 0 && r.copyWithin(0, l, n);
      }
    }
    /**
    * @param {Buffer} data data
    * @returns {void}
    */
    _updateWithBuffer(o) {
      const { exports: c, buffered: f, mem: t } = this, r = o.length;
      if (f + r < this.chunkSize)
        o.copy(t, f, 0, r), this.buffered += r;
      else {
        const s = f + r & ~(this.chunkSize - 1);
        if (s > 65536) {
          let l = 65536 - f;
          o.copy(t, f, 0, l), c.update(65536);
          const p = s - f - 65536;
          for (; l < p; )
            o.copy(t, 0, l, l + 65536), c.update(65536), l += 65536;
          o.copy(t, 0, l, s - f), c.update(s - f - l);
        } else
          o.copy(t, f, 0, s - f), c.update(s);
        const n = r + f - s;
        this.buffered = n, n > 0 && o.copy(t, 0, r - n, r);
      }
    }
    digest(o) {
      const { exports: c, buffered: f, mem: t, digestSize: r } = this;
      c.final(f), this.instancesPool.push(this);
      const s = t.toString("latin1", 0, r);
      return o === "hex" ? s : o === "binary" || !o ? Buffer.from(s, "hex") : Buffer.from(s, "hex").toString(o);
    }
  };
  const d = (o, c, f, t) => {
    if (c.length > 0) {
      const r = c.pop();
      return r.reset(), r;
    } else return new g(new WebAssembly.Instance(o), c, f, t);
  };
  u.exports = d, u.exports.MAX_SHORT_STRING = I;
})), yt = /* @__PURE__ */ R(((i, u) => {
  const I = Oe(), g = new WebAssembly.Module(Buffer.from("AGFzbQEAAAABCAJgAX8AYAAAAwQDAQAABQMBAAEGGgV+AUIAC34BQgALfgFCAAt+AUIAC34BQgALByIEBGluaXQAAAZ1cGRhdGUAAQVmaW5hbAACBm1lbW9yeQIACrUIAzAAQtbrgu7q/Yn14AAkAELP1tO+0ser2UIkAUIAJAJC+erQ0OfJoeThACQDQgAkBAvUAQIBfwR+IABFBEAPCyMEIACtfCQEIwAhAiMBIQMjAiEEIwMhBQNAIAIgASkDAELP1tO+0ser2UJ+fEIfiUKHla+vmLbem55/fiECIAMgASkDCELP1tO+0ser2UJ+fEIfiUKHla+vmLbem55/fiEDIAQgASkDEELP1tO+0ser2UJ+fEIfiUKHla+vmLbem55/fiEEIAUgASkDGELP1tO+0ser2UJ+fEIfiUKHla+vmLbem55/fiEFIAAgAUEgaiIBSw0ACyACJAAgAyQBIAQkAiAFJAMLqwYCAX8EfiMEQgBSBH4jACICQgGJIwEiA0IHiXwjAiIEQgyJfCMDIgVCEol8IAJCz9bTvtLHq9lCfkIfiUKHla+vmLbem55/foVCh5Wvr5i23puef35CnaO16oOxjYr6AH0gA0LP1tO+0ser2UJ+Qh+JQoeVr6+Ytt6bnn9+hUKHla+vmLbem55/fkKdo7Xqg7GNivoAfSAEQs/W077Sx6vZQn5CH4lCh5Wvr5i23puef36FQoeVr6+Ytt6bnn9+Qp2jteqDsY2K+gB9IAVCz9bTvtLHq9lCfkIfiUKHla+vmLbem55/foVCh5Wvr5i23puef35CnaO16oOxjYr6AH0FQsXP2bLx5brqJwsjBCAArXx8IQIDQCABQQhqIABNBEAgAiABKQMAQs/W077Sx6vZQn5CH4lCh5Wvr5i23puef36FQhuJQoeVr6+Ytt6bnn9+Qp2jteqDsY2K+gB9IQIgAUEIaiEBDAELCyABQQRqIABNBEACfyACIAE1AgBCh5Wvr5i23puef36FQheJQs/W077Sx6vZQn5C+fPd8Zn2masWfCECIAFBBGoLIQELA0AgACABRwRAIAIgATEAAELFz9my8eW66id+hUILiUKHla+vmLbem55/fiECIAFBAWohAQwBCwtBACACIAJCIYiFQs/W077Sx6vZQn4iAiACQh2IhUL5893xmfaZqxZ+IgIgAkIgiIUiAkIgiCIDQv//A4NCIIYgA0KAgPz/D4NCEIiEIgNC/4GAgPAfg0IQhiADQoD+g4CA4D+DQgiIhCIDQo+AvIDwgcAHg0IIhiADQvCBwIeAnoD4AINCBIiEIgNChoyYsODAgYMGfEIEiEKBgoSIkKDAgAGDQid+IANCsODAgYOGjJgwhHw3AwBBCCACQv////8PgyICQv//A4NCIIYgAkKAgPz/D4NCEIiEIgJC/4GAgPAfg0IQhiACQoD+g4CA4D+DQgiIhCICQo+AvIDwgcAHg0IIhiACQvCBwIeAnoD4AINCBIiEIgJChoyYsODAgYMGfEIEiEKBgoSIkKDAgAGDQid+IAJCsODAgYOGjJgwhHw3AwAL", "base64"));
  u.exports = I.bind(null, g, [], 32, 16);
})), De = /* @__PURE__ */ R(((i, u) => {
  const I = Oe().MAX_SHORT_STRING;
  var g = class {
    constructor(d) {
      this.string = void 0, this.encoding = void 0, this.hash = d;
    }
    /**
    * Update hash {@link https://nodejs.org/api/crypto.html#crypto_hash_update_data_inputencoding}
    * @param {string|Buffer} data data
    * @param {string=} inputEncoding data encoding
    * @returns {this} updated hash
    */
    update(d, o) {
      if (this.string !== void 0) {
        if (typeof d == "string" && o === this.encoding && this.string.length + d.length < I)
          return this.string += d, this;
        this.hash.update(this.string, this.encoding), this.string = void 0;
      }
      return typeof d == "string" ? d.length < I && (!o || !o.startsWith("ba")) ? (this.string = d, this.encoding = o) : this.hash.update(d, o) : this.hash.update(d), this;
    }
    /**
    * Calculates the digest {@link https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding}
    * @param {string=} encoding encoding of the return value
    * @returns {string|Buffer} digest
    */
    digest(d) {
      return this.string !== void 0 && this.hash.update(this.string, this.encoding), this.hash.digest(d);
    }
  };
  u.exports = g;
})), It = /* @__PURE__ */ R(((i, u) => {
  const I = Oe(), g = new WebAssembly.Module(Buffer.from("AGFzbQEAAAABCAJgAX8AYAAAAwUEAQAAAAUDAQABBhoFfwFBAAt/AUEAC38BQQALfwFBAAt/AUEACwciBARpbml0AAAGdXBkYXRlAAIFZmluYWwAAwZtZW1vcnkCAAqFEAQmAEGBxpS6BiQBQYnXtv5+JAJB/rnrxXkkA0H2qMmBASQEQQAkAAvMCgEYfyMBIQojAiEGIwMhByMEIQgDQCAAIAVLBEAgBSgCCCINIAcgBiAFKAIEIgsgCCAHIAUoAgAiDCAKIAggBiAHIAhzcXNqakEDdyIDIAYgB3Nxc2pqQQd3IgEgAyAGc3FzampBC3chAiAFKAIUIg8gASACIAUoAhAiCSADIAEgBSgCDCIOIAYgAyACIAEgA3Nxc2pqQRN3IgQgASACc3FzampBA3ciAyACIARzcXNqakEHdyEBIAUoAiAiEiADIAEgBSgCHCIRIAQgAyAFKAIYIhAgAiAEIAEgAyAEc3FzampBC3ciAiABIANzcXNqakETdyIEIAEgAnNxc2pqQQN3IQMgBSgCLCIVIAQgAyAFKAIoIhQgAiAEIAUoAiQiEyABIAIgAyACIARzcXNqakEHdyIBIAMgBHNxc2pqQQt3IgIgASADc3FzampBE3chBCAPIBAgCSAVIBQgEyAFKAI4IhYgAiAEIAUoAjQiFyABIAIgBSgCMCIYIAMgASAEIAEgAnNxc2pqQQN3IgEgAiAEc3FzampBB3ciAiABIARzcXNqakELdyIDIAkgAiAMIAEgBSgCPCIJIAQgASADIAEgAnNxc2pqQRN3IgEgAiADcnEgAiADcXJqakGZ84nUBWpBA3ciAiABIANycSABIANxcmpqQZnzidQFakEFdyIEIAEgAnJxIAEgAnFyaiASakGZ84nUBWpBCXciAyAPIAQgCyACIBggASADIAIgBHJxIAIgBHFyampBmfOJ1AVqQQ13IgEgAyAEcnEgAyAEcXJqakGZ84nUBWpBA3ciAiABIANycSABIANxcmpqQZnzidQFakEFdyIEIAEgAnJxIAEgAnFyampBmfOJ1AVqQQl3IgMgECAEIAIgFyABIAMgAiAEcnEgAiAEcXJqakGZ84nUBWpBDXciASADIARycSADIARxcmogDWpBmfOJ1AVqQQN3IgIgASADcnEgASADcXJqakGZ84nUBWpBBXciBCABIAJycSABIAJxcmpqQZnzidQFakEJdyIDIBEgBCAOIAIgFiABIAMgAiAEcnEgAiAEcXJqakGZ84nUBWpBDXciASADIARycSADIARxcmpqQZnzidQFakEDdyICIAEgA3JxIAEgA3FyampBmfOJ1AVqQQV3IgQgASACcnEgASACcXJqakGZ84nUBWpBCXciAyAMIAIgAyAJIAEgAyACIARycSACIARxcmpqQZnzidQFakENdyIBcyAEc2pqQaHX5/YGakEDdyICIAQgASACcyADc2ogEmpBodfn9gZqQQl3IgRzIAFzampBodfn9gZqQQt3IgMgAiADIBggASADIARzIAJzampBodfn9gZqQQ93IgFzIARzaiANakGh1+f2BmpBA3ciAiAUIAQgASACcyADc2pqQaHX5/YGakEJdyIEcyABc2pqQaHX5/YGakELdyIDIAsgAiADIBYgASADIARzIAJzampBodfn9gZqQQ93IgFzIARzampBodfn9gZqQQN3IgIgEyAEIAEgAnMgA3NqakGh1+f2BmpBCXciBHMgAXNqakGh1+f2BmpBC3chAyAKIA4gAiADIBcgASADIARzIAJzampBodfn9gZqQQ93IgFzIARzampBodfn9gZqQQN3IgJqIQogBiAJIAEgESADIAIgFSAEIAEgAnMgA3NqakGh1+f2BmpBCXciBHMgAXNqakGh1+f2BmpBC3ciAyAEcyACc2pqQaHX5/YGakEPd2ohBiADIAdqIQcgBCAIaiEIIAVBQGshBQwBCwsgCiQBIAYkAiAHJAMgCCQECw0AIAAQASMAIABqJAAL/wQCA38BfiMAIABqrUIDhiEEIABByABqQUBxIgJBCGshAyAAIgFBAWohACABQYABOgAAA0AgACACSUEAIABBB3EbBEAgAEEAOgAAIABBAWohAAwBCwsDQCAAIAJJBEAgAEIANwMAIABBCGohAAwBCwsgAyAENwMAIAIQAUEAIwGtIgRC//8DgyAEQoCA/P8Pg0IQhoQiBEL/gYCA8B+DIARCgP6DgIDgP4NCCIaEIgRCj4C8gPCBwAeDQgiGIARC8IHAh4CegPgAg0IEiIQiBEKGjJiw4MCBgwZ8QgSIQoGChIiQoMCAAYNCJ34gBEKw4MCBg4aMmDCEfDcDAEEIIwKtIgRC//8DgyAEQoCA/P8Pg0IQhoQiBEL/gYCA8B+DIARCgP6DgIDgP4NCCIaEIgRCj4C8gPCBwAeDQgiGIARC8IHAh4CegPgAg0IEiIQiBEKGjJiw4MCBgwZ8QgSIQoGChIiQoMCAAYNCJ34gBEKw4MCBg4aMmDCEfDcDAEEQIwOtIgRC//8DgyAEQoCA/P8Pg0IQhoQiBEL/gYCA8B+DIARCgP6DgIDgP4NCCIaEIgRCj4C8gPCBwAeDQgiGIARC8IHAh4CegPgAg0IEiIQiBEKGjJiw4MCBgwZ8QgSIQoGChIiQoMCAAYNCJ34gBEKw4MCBg4aMmDCEfDcDAEEYIwStIgRC//8DgyAEQoCA/P8Pg0IQhoQiBEL/gYCA8B+DIARCgP6DgIDgP4NCCIaEIgRCj4C8gPCBwAeDQgiGIARC8IHAh4CegPgAg0IEiIQiBEKGjJiw4MCBgwZ8QgSIQoGChIiQoMCAAYNCJ34gBEKw4MCBg4aMmDCEfDcDAAs=", "base64"));
  u.exports = I.bind(null, g, [], 64, 32);
})), Be = /* @__PURE__ */ R(((i, u) => {
  const g = {};
  var d = class {
    /**
    * @param {Hash | function(): Hash} hashOrFactory function to create a hash
    * @param {string=} hashKey key for caching
    */
    constructor(o, c) {
      this.hashKey = c, typeof o == "function" ? (this.hashFactory = o, this.hash = void 0) : (this.hashFactory = void 0, this.hash = o), this.buffer = "";
    }
    /**
    * Update hash {@link https://nodejs.org/api/crypto.html#crypto_hash_update_data_inputencoding}
    * @param {string|Buffer} data data
    * @param {string=} inputEncoding data encoding
    * @returns {this} updated hash
    */
    update(o, c) {
      return c !== void 0 || typeof o != "string" || o.length > 2e3 ? (this.hash === void 0 && (this.hash = this.hashFactory()), this.buffer.length > 0 && (this.hash.update(this.buffer), this.buffer = ""), this.hash.update(o, c)) : (this.buffer += o, this.buffer.length > 2e3 && (this.hash === void 0 && (this.hash = this.hashFactory()), this.hash.update(this.buffer), this.buffer = "")), this;
    }
    /**
    * Calculates the digest {@link https://nodejs.org/api/crypto.html#crypto_hash_digest_encoding}
    * @param {string=} encoding encoding of the return value
    * @returns {string|Buffer} digest
    */
    digest(o) {
      let c;
      const f = this.buffer;
      if (this.hash === void 0) {
        const r = `${this.hashKey}-${o}`;
        c = g[r], c === void 0 && (c = g[r] = /* @__PURE__ */ new Map());
        const s = c.get(f);
        if (s !== void 0) return s;
        this.hash = this.hashFactory();
      }
      f.length > 0 && this.hash.update(f);
      const t = this.hash.digest(o);
      return c !== void 0 && c.set(f, t), t;
    }
  };
  u.exports = d;
})), St = /* @__PURE__ */ R(((i, u) => {
  const I = {
    26: "abcdefghijklmnopqrstuvwxyz",
    32: "123456789abcdefghjkmnpqrstuvwxyz",
    36: "0123456789abcdefghijklmnopqrstuvwxyz",
    49: "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
    52: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    58: "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
    62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    64: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
  };
  function g(n, l) {
    let p = 0;
    for (let b = n.length - 1; b >= 0; b--) {
      const e = p * 4294967296 + n[b];
      p = e % l, n[b] = Math.floor(e / l);
    }
    return p;
  }
  function d(n, l, p) {
    const b = I[l];
    if (!b) throw new Error("Unknown encoding base" + l);
    const e = Math.ceil(n.length * 8 / Math.log2(l));
    p = Math.min(p, e);
    const v = new Uint32Array(Math.ceil(n.length / 4));
    n.copy(Buffer.from(v.buffer));
    let _ = "";
    for (let m = 0; m < p; m++) _ = b[g(v, l)] + _;
    return _;
  }
  let o, c, f, t, r;
  function s(n, l, p, b) {
    l = l || "xxhash64", b = b || 9999;
    let e;
    return l === "xxhash64" ? (c === void 0 && (c = yt(), t === void 0 && (t = De())), e = new t(c())) : l === "md4" ? (f === void 0 && (f = It(), t === void 0 && (t = De())), e = new t(f())) : l === "native-md4" ? (typeof o > "u" && (o = le("crypto"), r === void 0 && (r = Be())), e = new r(() => o.createHash("md4"), "md4")) : (typeof o > "u" && (o = le("crypto"), r === void 0 && (r = Be())), e = new r(() => o.createHash(l), l)), e.update(n), p === "base26" || p === "base32" || p === "base36" || p === "base49" || p === "base52" || p === "base58" || p === "base62" || p === "base64safe" ? d(e.digest(), p === "base64safe" ? 64 : p.substr(4), b) : e.digest(p || "hex").substr(0, b);
  }
  u.exports = s;
})), Et = /* @__PURE__ */ R(((i, u) => {
  const I = le("path"), g = St();
  function d(o, c, f = {}) {
    let t;
    const r = o.resourceQuery && o.resourceQuery.length > 1;
    typeof c == "function" ? t = c(o.resourcePath, r ? o.resourceQuery : void 0) : t = c || "[hash].[ext]";
    const s = f.context, n = f.content, l = f.regExp;
    let p = "bin", b = "file", e = "", v = "", _ = "";
    if (o.resourcePath) {
      const y = I.parse(o.resourcePath);
      let O = o.resourcePath;
      y.ext && (p = y.ext.substr(1)), y.dir && (b = y.name, O = y.dir + I.sep), typeof s < "u" ? (e = I.relative(s, O + "_").replace(/\\/g, "/").replace(/\.\.(\/)?/g, "_$1"), e = e.substr(0, e.length - 1)) : e = O.replace(/\\/g, "/").replace(/\.\.(\/)?/g, "_$1"), e.length <= 1 ? e = "" : v = I.basename(e);
    }
    if (o.resourceQuery && o.resourceQuery.length > 1) {
      _ = o.resourceQuery;
      const y = _.indexOf("#");
      y >= 0 && (_ = _.substr(0, y));
    }
    let m = t;
    if (n && (m = m.replace(/\[(?:([^[:\]]+):)?(?:hash|contenthash)(?::([a-z]+\d*(?:safe)?))?(?::(\d+))?\]/gi, (y, O, a, h) => g(n, O, a, parseInt(h, 10)))), m = m.replace(/\[ext\]/gi, () => p).replace(/\[name\]/gi, () => b).replace(/\[path\]/gi, () => e).replace(/\[folder\]/gi, () => v).replace(/\[query\]/gi, () => _), l && o.resourcePath) {
      const y = o.resourcePath.match(new RegExp(l));
      y && y.forEach((O, a) => {
        m = m.replace(new RegExp("\\[" + a + "\\]", "ig"), O);
      });
    }
    return typeof o.options == "object" && typeof o.options.customInterpolateName == "function" && (m = o.options.customInterpolateName.call(o, m, c, f)), m;
  }
  u.exports = d;
})), wt = /* @__PURE__ */ R(((i, u) => {
  var I = Et(), g = le("path");
  u.exports = function(o, c) {
    c = c || {};
    var f = c && typeof c.context == "string" ? c.context : process.cwd(), t = c && typeof c.hashPrefix == "string" ? c.hashPrefix : "";
    return function(s, n) {
      var l = o.replace(/\[local\]/gi, s);
      return I({ resourcePath: n }, l, {
        content: t + g.relative(f, n).replace(/\\/g, "/") + "\0" + s,
        context: f
      }).replace(new RegExp("[^a-zA-Z0-9\\-_ -￿]", "g"), "-").replace(/^((-?[0-9])|--)/, "_$1");
    };
  };
})), qe = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = d;
  function I(o) {
    for (var c = o.toLowerCase(), f = "", t = !1, r = 0; r < 6 && c[r] !== void 0; r++) {
      var s = c.charCodeAt(r), n = s >= 97 && s <= 102 || s >= 48 && s <= 57;
      if (t = s === 32, !n) break;
      f += c[r];
    }
    if (f.length !== 0) {
      var l = parseInt(f, 16);
      return l >= 55296 && l <= 57343 || l === 0 || l > 1114111 ? ["�", f.length + (t ? 1 : 0)] : [String.fromCodePoint(l), f.length + (t ? 1 : 0)];
    }
  }
  var g = /\\/;
  function d(o) {
    if (!g.test(o)) return o;
    for (var c = "", f = 0; f < o.length; f++) {
      if (o[f] === "\\") {
        var t = I(o.slice(f + 1, f + 7));
        if (t !== void 0) {
          c += t[0], f += t[1];
          continue;
        }
        if (o[f + 1] === "\\") {
          c += "\\", f++;
          continue;
        }
        o.length === f + 1 && (c += o[f]);
        continue;
      }
      c += o[f];
    }
    return c;
  }
  u.exports = i.default;
})), bt = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = I;
  function I(g) {
    for (var d = arguments.length, o = new Array(d > 1 ? d - 1 : 0), c = 1; c < d; c++) o[c - 1] = arguments[c];
    for (; o.length > 0; ) {
      var f = o.shift();
      if (!g[f]) return;
      g = g[f];
    }
    return g;
  }
  u.exports = i.default;
})), Ot = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = I;
  function I(g) {
    for (var d = arguments.length, o = new Array(d > 1 ? d - 1 : 0), c = 1; c < d; c++) o[c - 1] = arguments[c];
    for (; o.length > 0; ) {
      var f = o.shift();
      g[f] || (g[f] = {}), g = g[f];
    }
  }
  u.exports = i.default;
})), Pt = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = I;
  function I(g) {
    for (var d = "", o = g.indexOf("/*"), c = 0; o >= 0; ) {
      d = d + g.slice(c, o);
      var f = g.indexOf("*/", o + 2);
      if (f < 0) return d;
      c = f + 2, o = g.indexOf("/*", c);
    }
    return d = d + g.slice(c), d;
  }
  u.exports = i.default;
})), Ie = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.unesc = i.stripComments = i.getProp = i.ensureObject = void 0;
  var u = o(qe());
  i.unesc = u.default;
  var I = o(bt());
  i.getProp = I.default;
  var g = o(Ot());
  i.ensureObject = g.default;
  var d = o(Pt());
  i.stripComments = d.default;
  function o(c) {
    return c && c.__esModule ? c : { default: c };
  }
})), he = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = Ie();
  function g(f, t) {
    for (var r = 0; r < t.length; r++) {
      var s = t[r];
      s.enumerable = s.enumerable || !1, s.configurable = !0, "value" in s && (s.writable = !0), Object.defineProperty(f, s.key, s);
    }
  }
  function d(f, t, r) {
    return t && g(f.prototype, t), Object.defineProperty(f, "prototype", { writable: !1 }), f;
  }
  var o = function f(t, r) {
    if (typeof t != "object" || t === null) return t;
    var s = new t.constructor();
    for (var n in t)
      if (t.hasOwnProperty(n)) {
        var l = t[n];
        n === "parent" && typeof l == "object" ? r && (s[n] = r) : l instanceof Array ? s[n] = l.map(function(p) {
          return f(p, s);
        }) : s[n] = f(l, s);
      }
    return s;
  }, c = /* @__PURE__ */ (function() {
    function f(r) {
      r === void 0 && (r = {}), Object.assign(this, r), this.spaces = this.spaces || {}, this.spaces.before = this.spaces.before || "", this.spaces.after = this.spaces.after || "";
    }
    var t = f.prototype;
    return t.remove = function() {
      return this.parent && this.parent.removeChild(this), this.parent = void 0, this;
    }, t.replaceWith = function() {
      if (this.parent) {
        for (var s in arguments) this.parent.insertBefore(this, arguments[s]);
        this.remove();
      }
      return this;
    }, t.next = function() {
      return this.parent.at(this.parent.index(this) + 1);
    }, t.prev = function() {
      return this.parent.at(this.parent.index(this) - 1);
    }, t.clone = function(s) {
      s === void 0 && (s = {});
      var n = o(this);
      for (var l in s) n[l] = s[l];
      return n;
    }, t.appendToPropertyAndEscape = function(s, n, l) {
      this.raws || (this.raws = {});
      var p = this[s], b = this.raws[s];
      this[s] = p + n, b || l !== n ? this.raws[s] = (b || p) + l : delete this.raws[s];
    }, t.setPropertyAndEscape = function(s, n, l) {
      this.raws || (this.raws = {}), this[s] = n, this.raws[s] = l;
    }, t.setPropertyWithoutEscape = function(s, n) {
      this[s] = n, this.raws && delete this.raws[s];
    }, t.isAtPosition = function(s, n) {
      if (this.source && this.source.start && this.source.end)
        return !(this.source.start.line > s || this.source.end.line < s || this.source.start.line === s && this.source.start.column > n || this.source.end.line === s && this.source.end.column < n);
    }, t.stringifyProperty = function(s) {
      return this.raws && this.raws[s] || this[s];
    }, t.valueToString = function() {
      return String(this.stringifyProperty("value"));
    }, t.toString = function() {
      return [
        this.rawSpaceBefore,
        this.valueToString(),
        this.rawSpaceAfter
      ].join("");
    }, d(f, [{
      key: "rawSpaceBefore",
      get: function() {
        var s = this.raws && this.raws.spaces && this.raws.spaces.before;
        return s === void 0 && (s = this.spaces && this.spaces.before), s || "";
      },
      set: function(s) {
        (0, I.ensureObject)(this, "raws", "spaces"), this.raws.spaces.before = s;
      }
    }, {
      key: "rawSpaceAfter",
      get: function() {
        var s = this.raws && this.raws.spaces && this.raws.spaces.after;
        return s === void 0 && (s = this.spaces.after), s || "";
      },
      set: function(s) {
        (0, I.ensureObject)(this, "raws", "spaces"), this.raws.spaces.after = s;
      }
    }]), f;
  })();
  i.default = c, u.exports = i.default;
})), ie = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.UNIVERSAL = i.TAG = i.STRING = i.SELECTOR = i.ROOT = i.PSEUDO = i.NESTING = i.ID = i.COMMENT = i.COMBINATOR = i.CLASS = i.ATTRIBUTE = void 0;
  var u = "tag";
  i.TAG = u;
  var I = "string";
  i.STRING = I;
  var g = "selector";
  i.SELECTOR = g;
  var d = "root";
  i.ROOT = d;
  var o = "pseudo";
  i.PSEUDO = o;
  var c = "nesting";
  i.NESTING = c;
  var f = "id";
  i.ID = f;
  var t = "comment";
  i.COMMENT = t;
  var r = "combinator";
  i.COMBINATOR = r;
  var s = "class";
  i.CLASS = s;
  var n = "attribute";
  i.ATTRIBUTE = n;
  var l = "universal";
  i.UNIVERSAL = l;
})), Pe = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = c(he()), g = o(ie());
  function d(e) {
    if (typeof WeakMap != "function") return null;
    var v = /* @__PURE__ */ new WeakMap(), _ = /* @__PURE__ */ new WeakMap();
    return (d = function(y) {
      return y ? _ : v;
    })(e);
  }
  function o(e, v) {
    if (e && e.__esModule) return e;
    if (e === null || typeof e != "object" && typeof e != "function") return { default: e };
    var _ = d(v);
    if (_ && _.has(e)) return _.get(e);
    var m = {}, y = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var O in e) if (O !== "default" && Object.prototype.hasOwnProperty.call(e, O)) {
      var a = y ? Object.getOwnPropertyDescriptor(e, O) : null;
      a && (a.get || a.set) ? Object.defineProperty(m, O, a) : m[O] = e[O];
    }
    return m.default = e, _ && _.set(e, m), m;
  }
  function c(e) {
    return e && e.__esModule ? e : { default: e };
  }
  function f(e, v) {
    var _ = typeof Symbol < "u" && e[Symbol.iterator] || e["@@iterator"];
    if (_) return (_ = _.call(e)).next.bind(_);
    if (Array.isArray(e) || (_ = t(e)) || v) {
      _ && (e = _);
      var m = 0;
      return function() {
        return m >= e.length ? { done: !0 } : {
          done: !1,
          value: e[m++]
        };
      };
    }
    throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
  }
  function t(e, v) {
    if (e) {
      if (typeof e == "string") return r(e, v);
      var _ = Object.prototype.toString.call(e).slice(8, -1);
      if (_ === "Object" && e.constructor && (_ = e.constructor.name), _ === "Map" || _ === "Set") return Array.from(e);
      if (_ === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(_)) return r(e, v);
    }
  }
  function r(e, v) {
    (v == null || v > e.length) && (v = e.length);
    for (var _ = 0, m = new Array(v); _ < v; _++) m[_] = e[_];
    return m;
  }
  function s(e, v) {
    for (var _ = 0; _ < v.length; _++) {
      var m = v[_];
      m.enumerable = m.enumerable || !1, m.configurable = !0, "value" in m && (m.writable = !0), Object.defineProperty(e, m.key, m);
    }
  }
  function n(e, v, _) {
    return v && s(e.prototype, v), Object.defineProperty(e, "prototype", { writable: !1 }), e;
  }
  function l(e, v) {
    e.prototype = Object.create(v.prototype), e.prototype.constructor = e, p(e, v);
  }
  function p(e, v) {
    return p = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(m, y) {
      return m.__proto__ = y, m;
    }, p(e, v);
  }
  var b = /* @__PURE__ */ (function(e) {
    l(v, e);
    function v(m) {
      var y = e.call(this, m) || this;
      return y.nodes || (y.nodes = []), y;
    }
    var _ = v.prototype;
    return _.append = function(y) {
      return y.parent = this, this.nodes.push(y), this;
    }, _.prepend = function(y) {
      y.parent = this, this.nodes.unshift(y);
      for (var O in this.indexes) this.indexes[O]++;
      return this;
    }, _.at = function(y) {
      return this.nodes[y];
    }, _.index = function(y) {
      return typeof y == "number" ? y : this.nodes.indexOf(y);
    }, _.removeChild = function(y) {
      y = this.index(y), this.at(y).parent = void 0, this.nodes.splice(y, 1);
      var O;
      for (var a in this.indexes)
        O = this.indexes[a], O >= y && (this.indexes[a] = O - 1);
      return this;
    }, _.removeAll = function() {
      for (var y = f(this.nodes), O; !(O = y()).done; ) {
        var a = O.value;
        a.parent = void 0;
      }
      return this.nodes = [], this;
    }, _.empty = function() {
      return this.removeAll();
    }, _.insertAfter = function(y, O) {
      var a;
      O.parent = this;
      for (var h = this.index(y), E = [], w = 2; w < arguments.length; w++) E.push(arguments[w]);
      (a = this.nodes).splice.apply(a, [
        h + 1,
        0,
        O
      ].concat(E)), O.parent = this;
      var S;
      for (var A in this.indexes)
        S = this.indexes[A], h < S && (this.indexes[A] = S + arguments.length - 1);
      return this;
    }, _.insertBefore = function(y, O) {
      var a;
      O.parent = this;
      for (var h = this.index(y), E = [], w = 2; w < arguments.length; w++) E.push(arguments[w]);
      (a = this.nodes).splice.apply(a, [
        h,
        0,
        O
      ].concat(E)), O.parent = this;
      var S;
      for (var A in this.indexes)
        S = this.indexes[A], S >= h && (this.indexes[A] = S + arguments.length - 1);
      return this;
    }, _._findChildAtPosition = function(y, O) {
      var a = void 0;
      return this.each(function(h) {
        if (h.atPosition) {
          var E = h.atPosition(y, O);
          if (E)
            return a = E, !1;
        } else if (h.isAtPosition(y, O))
          return a = h, !1;
      }), a;
    }, _.atPosition = function(y, O) {
      if (this.isAtPosition(y, O)) return this._findChildAtPosition(y, O) || this;
    }, _._inferEndPosition = function() {
      this.last && this.last.source && this.last.source.end && (this.source = this.source || {}, this.source.end = this.source.end || {}, Object.assign(this.source.end, this.last.source.end));
    }, _.each = function(y) {
      this.lastEach || (this.lastEach = 0), this.indexes || (this.indexes = {}), this.lastEach++;
      var O = this.lastEach;
      if (this.indexes[O] = 0, !!this.length) {
        for (var a, h; this.indexes[O] < this.length && (a = this.indexes[O], h = y(this.at(a), a), h !== !1); )
          this.indexes[O] += 1;
        if (delete this.indexes[O], h === !1) return !1;
      }
    }, _.walk = function(y) {
      return this.each(function(O, a) {
        var h = y(O, a);
        if (h !== !1 && O.length && (h = O.walk(y)), h === !1) return !1;
      });
    }, _.walkAttributes = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.ATTRIBUTE) return y.call(O, a);
      });
    }, _.walkClasses = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.CLASS) return y.call(O, a);
      });
    }, _.walkCombinators = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.COMBINATOR) return y.call(O, a);
      });
    }, _.walkComments = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.COMMENT) return y.call(O, a);
      });
    }, _.walkIds = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.ID) return y.call(O, a);
      });
    }, _.walkNesting = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.NESTING) return y.call(O, a);
      });
    }, _.walkPseudos = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.PSEUDO) return y.call(O, a);
      });
    }, _.walkTags = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.TAG) return y.call(O, a);
      });
    }, _.walkUniversals = function(y) {
      var O = this;
      return this.walk(function(a) {
        if (a.type === g.UNIVERSAL) return y.call(O, a);
      });
    }, _.split = function(y) {
      var O = this, a = [];
      return this.reduce(function(h, E, w) {
        var S = y.call(O, E);
        return a.push(E), S ? (h.push(a), a = []) : w === O.length - 1 && h.push(a), h;
      }, []);
    }, _.map = function(y) {
      return this.nodes.map(y);
    }, _.reduce = function(y, O) {
      return this.nodes.reduce(y, O);
    }, _.every = function(y) {
      return this.nodes.every(y);
    }, _.some = function(y) {
      return this.nodes.some(y);
    }, _.filter = function(y) {
      return this.nodes.filter(y);
    }, _.sort = function(y) {
      return this.nodes.sort(y);
    }, _.toString = function() {
      return this.map(String).join("");
    }, n(v, [
      {
        key: "first",
        get: function() {
          return this.at(0);
        }
      },
      {
        key: "last",
        get: function() {
          return this.at(this.length - 1);
        }
      },
      {
        key: "length",
        get: function() {
          return this.nodes.length;
        }
      }
    ]), v;
  })(I.default);
  i.default = b, u.exports = i.default;
})), Qe = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(Pe()), g = ie();
  function d(s) {
    return s && s.__esModule ? s : { default: s };
  }
  function o(s, n) {
    for (var l = 0; l < n.length; l++) {
      var p = n[l];
      p.enumerable = p.enumerable || !1, p.configurable = !0, "value" in p && (p.writable = !0), Object.defineProperty(s, p.key, p);
    }
  }
  function c(s, n, l) {
    return n && o(s.prototype, n), Object.defineProperty(s, "prototype", { writable: !1 }), s;
  }
  function f(s, n) {
    s.prototype = Object.create(n.prototype), s.prototype.constructor = s, t(s, n);
  }
  function t(s, n) {
    return t = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(p, b) {
      return p.__proto__ = b, p;
    }, t(s, n);
  }
  var r = /* @__PURE__ */ (function(s) {
    f(n, s);
    function n(p) {
      var b = s.call(this, p) || this;
      return b.type = g.ROOT, b;
    }
    var l = n.prototype;
    return l.toString = function() {
      var b = this.reduce(function(e, v) {
        return e.push(String(v)), e;
      }, []).join(",");
      return this.trailingComma ? b + "," : b;
    }, l.error = function(b, e) {
      return this._error ? this._error(b, e) : new Error(b);
    }, c(n, [{
      key: "errorGenerator",
      set: function(b) {
        this._error = b;
      }
    }]), n;
  })(I.default);
  i.default = r, u.exports = i.default;
})), Re = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(Pe()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.SELECTOR, n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
}));
var Te = /* @__PURE__ */ R(((i, u) => {
  var I = {}.hasOwnProperty, g = function(r, s) {
    if (!r) return s;
    var n = {};
    for (var l in s) n[l] = I.call(r, l) ? r[l] : s[l];
    return n;
  }, d = /[ -,\.\/:-@\[-\^`\{-~]/, o = /[ -,\.\/:-@\[\]\^`\{-~]/, c = /(^|\\+)?(\\[A-F0-9]{1,6})\x20(?![a-fA-F0-9\x20])/g, f = function t(r, s) {
    s = g(s, t.options), s.quotes != "single" && s.quotes != "double" && (s.quotes = "single");
    for (var n = s.quotes == "double" ? '"' : "'", l = s.isIdentifier, p = r.charAt(0), b = "", e = 0, v = r.length; e < v; ) {
      var _ = r.charAt(e++), m = _.charCodeAt(), y = void 0;
      if (m < 32 || m > 126) {
        if (m >= 55296 && m <= 56319 && e < v) {
          var O = r.charCodeAt(e++);
          (O & 64512) == 56320 ? m = ((m & 1023) << 10) + (O & 1023) + 65536 : e--;
        }
        y = "\\" + m.toString(16).toUpperCase() + " ";
      } else s.escapeEverything ? d.test(_) ? y = "\\" + _ : y = "\\" + m.toString(16).toUpperCase() + " " : /[\t\n\f\r\x0B]/.test(_) ? y = "\\" + m.toString(16).toUpperCase() + " " : _ == "\\" || !l && (_ == '"' && n == _ || _ == "'" && n == _) || l && o.test(_) ? y = "\\" + _ : y = _;
      b += y;
    }
    return l && (/^-[-\d]/.test(b) ? b = "\\-" + b.slice(1) : /\d/.test(p) && (b = "\\3" + p + " " + b.slice(1))), b = b.replace(c, function(a, h, E) {
      return h && h.length % 2 ? a : (h || "") + E;
    }), !l && s.wrap ? n + b + n : b;
  };
  f.options = {
    escapeEverything: !1,
    isIdentifier: !1,
    quotes: "single",
    wrap: !1
  }, f.version = "3.0.0", u.exports = f;
})), Fe = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = c(Te()), g = Ie(), d = c(he()), o = ie();
  function c(l) {
    return l && l.__esModule ? l : { default: l };
  }
  function f(l, p) {
    for (var b = 0; b < p.length; b++) {
      var e = p[b];
      e.enumerable = e.enumerable || !1, e.configurable = !0, "value" in e && (e.writable = !0), Object.defineProperty(l, e.key, e);
    }
  }
  function t(l, p, b) {
    return p && f(l.prototype, p), Object.defineProperty(l, "prototype", { writable: !1 }), l;
  }
  function r(l, p) {
    l.prototype = Object.create(p.prototype), l.prototype.constructor = l, s(l, p);
  }
  function s(l, p) {
    return s = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(e, v) {
      return e.__proto__ = v, e;
    }, s(l, p);
  }
  var n = /* @__PURE__ */ (function(l) {
    r(p, l);
    function p(e) {
      var v = l.call(this, e) || this;
      return v.type = o.CLASS, v._constructed = !0, v;
    }
    var b = p.prototype;
    return b.valueToString = function() {
      return "." + l.prototype.valueToString.call(this);
    }, t(p, [{
      key: "value",
      get: function() {
        return this._value;
      },
      set: function(v) {
        if (this._constructed) {
          var _ = (0, I.default)(v, { isIdentifier: !0 });
          _ !== v ? ((0, g.ensureObject)(this, "raws"), this.raws.value = _) : this.raws && delete this.raws.value;
        }
        this._value = v;
      }
    }]), p;
  })(d.default);
  i.default = n, u.exports = i.default;
})), Ue = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(he()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.COMMENT, n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), xe = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(he()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(n) {
      var l = t.call(this, n) || this;
      return l.type = g.ID, l;
    }
    var s = r.prototype;
    return s.valueToString = function() {
      return "#" + t.prototype.valueToString.call(this);
    }, r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), ke = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = o(Te()), g = Ie(), d = o(he());
  function o(n) {
    return n && n.__esModule ? n : { default: n };
  }
  function c(n, l) {
    for (var p = 0; p < l.length; p++) {
      var b = l[p];
      b.enumerable = b.enumerable || !1, b.configurable = !0, "value" in b && (b.writable = !0), Object.defineProperty(n, b.key, b);
    }
  }
  function f(n, l, p) {
    return l && c(n.prototype, l), Object.defineProperty(n, "prototype", { writable: !1 }), n;
  }
  function t(n, l) {
    n.prototype = Object.create(l.prototype), n.prototype.constructor = n, r(n, l);
  }
  function r(n, l) {
    return r = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(b, e) {
      return b.__proto__ = e, b;
    }, r(n, l);
  }
  var s = /* @__PURE__ */ (function(n) {
    t(l, n);
    function l() {
      return n.apply(this, arguments) || this;
    }
    var p = l.prototype;
    return p.qualifiedName = function(e) {
      return this.namespace ? this.namespaceString + "|" + e : e;
    }, p.valueToString = function() {
      return this.qualifiedName(n.prototype.valueToString.call(this));
    }, f(l, [
      {
        key: "namespace",
        get: function() {
          return this._namespace;
        },
        set: function(e) {
          if (e === !0 || e === "*" || e === "&") {
            this._namespace = e, this.raws && delete this.raws.namespace;
            return;
          }
          var v = (0, I.default)(e, { isIdentifier: !0 });
          this._namespace = e, v !== e ? ((0, g.ensureObject)(this, "raws"), this.raws.namespace = v) : this.raws && delete this.raws.namespace;
        }
      },
      {
        key: "ns",
        get: function() {
          return this._namespace;
        },
        set: function(e) {
          this.namespace = e;
        }
      },
      {
        key: "namespaceString",
        get: function() {
          if (this.namespace) {
            var e = this.stringifyProperty("namespace");
            return e === !0 ? "" : e;
          } else return "";
        }
      }
    ]), l;
  })(d.default);
  i.default = s, u.exports = i.default;
})), Ge = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(ke()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.TAG, n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), We = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(he()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.STRING, n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), Ye = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(Pe()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(n) {
      var l = t.call(this, n) || this;
      return l.type = g.PSEUDO, l;
    }
    var s = r.prototype;
    return s.toString = function() {
      var l = this.length ? "(" + this.map(String).join(",") + ")" : "";
      return [
        this.rawSpaceBefore,
        this.stringifyProperty("value"),
        l,
        this.rawSpaceAfter
      ].join("");
    }, r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), Tt = /* @__PURE__ */ R(((i, u) => {
  u.exports = le("util").deprecate;
})), ze = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.default = void 0, i.unescapeValue = v;
  var u = c(Te()), I = c(qe()), g = c(ke()), d = ie(), o;
  function c(a) {
    return a && a.__esModule ? a : { default: a };
  }
  function f(a, h) {
    for (var E = 0; E < h.length; E++) {
      var w = h[E];
      w.enumerable = w.enumerable || !1, w.configurable = !0, "value" in w && (w.writable = !0), Object.defineProperty(a, w.key, w);
    }
  }
  function t(a, h, E) {
    return h && f(a.prototype, h), Object.defineProperty(a, "prototype", { writable: !1 }), a;
  }
  function r(a, h) {
    a.prototype = Object.create(h.prototype), a.prototype.constructor = a, s(a, h);
  }
  function s(a, h) {
    return s = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(w, S) {
      return w.__proto__ = S, w;
    }, s(a, h);
  }
  var n = Tt(), l = /^('|")([^]*)\1$/, p = n(function() {
  }, "Assigning an attribute a value containing characters that might need to be escaped is deprecated. Call attribute.setValue() instead."), b = n(function() {
  }, "Assigning attr.quoted is deprecated and has no effect. Assign to attr.quoteMark instead."), e = n(function() {
  }, "Constructing an Attribute selector with a value without specifying quoteMark is deprecated. Note: The value should be unescaped now.");
  function v(a) {
    var h = !1, E = null, w = a, S = w.match(l);
    return S && (E = S[1], w = S[2]), w = (0, I.default)(w), w !== a && (h = !0), {
      deprecatedUsage: h,
      unescaped: w,
      quoteMark: E
    };
  }
  function _(a) {
    if (a.quoteMark !== void 0 || a.value === void 0) return a;
    e();
    var h = v(a.value), E = h.quoteMark, w = h.unescaped;
    return a.raws || (a.raws = {}), a.raws.value === void 0 && (a.raws.value = a.value), a.value = w, a.quoteMark = E, a;
  }
  var m = /* @__PURE__ */ (function(a) {
    r(h, a);
    function h(w) {
      var S;
      return w === void 0 && (w = {}), S = a.call(this, _(w)) || this, S.type = d.ATTRIBUTE, S.raws = S.raws || {}, Object.defineProperty(S.raws, "unquoted", {
        get: n(function() {
          return S.value;
        }, "attr.raws.unquoted is deprecated. Call attr.value instead."),
        set: n(function() {
          return S.value;
        }, "Setting attr.raws.unquoted is deprecated and has no effect. attr.value is unescaped by default now.")
      }), S._constructed = !0, S;
    }
    var E = h.prototype;
    return E.getQuotedValue = function(S) {
      S === void 0 && (S = {});
      var A = y[this._determineQuoteMark(S)];
      return (0, u.default)(this._value, A);
    }, E._determineQuoteMark = function(S) {
      return S.smart ? this.smartQuoteMark(S) : this.preferredQuoteMark(S);
    }, E.setValue = function(S, A) {
      A === void 0 && (A = {}), this._value = S, this._quoteMark = this._determineQuoteMark(A), this._syncRawValue();
    }, E.smartQuoteMark = function(S) {
      var A = this.value, k = A.replace(/[^']/g, "").length, C = A.replace(/[^"]/g, "").length;
      if (k + C === 0) {
        var L = (0, u.default)(A, { isIdentifier: !0 });
        if (L === A) return h.NO_QUOTE;
        var F = this.preferredQuoteMark(S);
        if (F === h.NO_QUOTE) {
          var B = this.quoteMark || S.quoteMark || h.DOUBLE_QUOTE, G = y[B];
          if ((0, u.default)(A, G).length < L.length) return B;
        }
        return F;
      } else return C === k ? this.preferredQuoteMark(S) : C < k ? h.DOUBLE_QUOTE : h.SINGLE_QUOTE;
    }, E.preferredQuoteMark = function(S) {
      var A = S.preferCurrentQuoteMark ? this.quoteMark : S.quoteMark;
      return A === void 0 && (A = S.preferCurrentQuoteMark ? S.quoteMark : this.quoteMark), A === void 0 && (A = h.DOUBLE_QUOTE), A;
    }, E._syncRawValue = function() {
      var S = (0, u.default)(this._value, y[this.quoteMark]);
      S === this._value ? this.raws && delete this.raws.value : this.raws.value = S;
    }, E._handleEscapes = function(S, A) {
      if (this._constructed) {
        var k = (0, u.default)(A, { isIdentifier: !0 });
        k !== A ? this.raws[S] = k : delete this.raws[S];
      }
    }, E._spacesFor = function(S) {
      var A = {
        before: "",
        after: ""
      }, k = this.spaces[S] || {}, C = this.raws.spaces && this.raws.spaces[S] || {};
      return Object.assign(A, k, C);
    }, E._stringFor = function(S, A, k) {
      A === void 0 && (A = S), k === void 0 && (k = O);
      var C = this._spacesFor(A);
      return k(this.stringifyProperty(S), C);
    }, E.offsetOf = function(S) {
      var A = 1, k = this._spacesFor("attribute");
      if (A += k.before.length, S === "namespace" || S === "ns") return this.namespace ? A : -1;
      if (S === "attributeNS" || (A += this.namespaceString.length, this.namespace && (A += 1), S === "attribute")) return A;
      A += this.stringifyProperty("attribute").length, A += k.after.length;
      var C = this._spacesFor("operator");
      A += C.before.length;
      var L = this.stringifyProperty("operator");
      if (S === "operator") return L ? A : -1;
      A += L.length, A += C.after.length;
      var F = this._spacesFor("value");
      A += F.before.length;
      var B = this.stringifyProperty("value");
      if (S === "value") return B ? A : -1;
      A += B.length, A += F.after.length;
      var G = this._spacesFor("insensitive");
      return A += G.before.length, S === "insensitive" && this.insensitive ? A : -1;
    }, E.toString = function() {
      var S = this, A = [this.rawSpaceBefore, "["];
      return A.push(this._stringFor("qualifiedAttribute", "attribute")), this.operator && (this.value || this.value === "") && (A.push(this._stringFor("operator")), A.push(this._stringFor("value")), A.push(this._stringFor("insensitiveFlag", "insensitive", function(k, C) {
        return k.length > 0 && !S.quoted && C.before.length === 0 && !(S.spaces.value && S.spaces.value.after) && (C.before = " "), O(k, C);
      }))), A.push("]"), A.push(this.rawSpaceAfter), A.join("");
    }, t(h, [
      {
        key: "quoted",
        get: function() {
          var S = this.quoteMark;
          return S === "'" || S === '"';
        },
        set: function(S) {
          b();
        }
      },
      {
        key: "quoteMark",
        get: function() {
          return this._quoteMark;
        },
        set: function(S) {
          if (!this._constructed) {
            this._quoteMark = S;
            return;
          }
          this._quoteMark !== S && (this._quoteMark = S, this._syncRawValue());
        }
      },
      {
        key: "qualifiedAttribute",
        get: function() {
          return this.qualifiedName(this.raws.attribute || this.attribute);
        }
      },
      {
        key: "insensitiveFlag",
        get: function() {
          return this.insensitive ? "i" : "";
        }
      },
      {
        key: "value",
        get: function() {
          return this._value;
        },
        set: function(S) {
          if (this._constructed) {
            var A = v(S), k = A.deprecatedUsage, C = A.unescaped, L = A.quoteMark;
            if (k && p(), C === this._value && L === this._quoteMark) return;
            this._value = C, this._quoteMark = L, this._syncRawValue();
          } else this._value = S;
        }
      },
      {
        key: "insensitive",
        get: function() {
          return this._insensitive;
        },
        set: function(S) {
          S || (this._insensitive = !1, this.raws && (this.raws.insensitiveFlag === "I" || this.raws.insensitiveFlag === "i") && (this.raws.insensitiveFlag = void 0)), this._insensitive = S;
        }
      },
      {
        key: "attribute",
        get: function() {
          return this._attribute;
        },
        set: function(S) {
          this._handleEscapes("attribute", S), this._attribute = S;
        }
      }
    ]), h;
  })(g.default);
  i.default = m, m.NO_QUOTE = null, m.SINGLE_QUOTE = "'", m.DOUBLE_QUOTE = '"';
  var y = (o = {
    "'": {
      quotes: "single",
      wrap: !0
    },
    '"': {
      quotes: "double",
      wrap: !0
    }
  }, o[null] = { isIdentifier: !0 }, o);
  function O(a, h) {
    return "" + h.before + a + h.after;
  }
})), je = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(ke()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.UNIVERSAL, n.value = "*", n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), Je = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(he()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.COMBINATOR, n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), He = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = d(he()), g = ie();
  function d(t) {
    return t && t.__esModule ? t : { default: t };
  }
  function o(t, r) {
    t.prototype = Object.create(r.prototype), t.prototype.constructor = t, c(t, r);
  }
  function c(t, r) {
    return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(n, l) {
      return n.__proto__ = l, n;
    }, c(t, r);
  }
  var f = /* @__PURE__ */ (function(t) {
    o(r, t);
    function r(s) {
      var n = t.call(this, s) || this;
      return n.type = g.NESTING, n.value = "&", n;
    }
    return r;
  })(I.default);
  i.default = f, u.exports = i.default;
})), kt = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = I;
  function I(g) {
    return g.sort(function(d, o) {
      return d - o;
    });
  }
  u.exports = i.default;
})), Ke = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.word = i.tilde = i.tab = i.str = i.space = i.slash = i.singleQuote = i.semicolon = i.plus = i.pipe = i.openSquare = i.openParenthesis = i.newline = i.greaterThan = i.feed = i.equals = i.doubleQuote = i.dollar = i.cr = i.comment = i.comma = i.combinator = i.colon = i.closeSquare = i.closeParenthesis = i.caret = i.bang = i.backslash = i.at = i.asterisk = i.ampersand = void 0;
  var u = 38;
  i.ampersand = u;
  var I = 42;
  i.asterisk = I;
  var g = 64;
  i.at = g;
  var d = 44;
  i.comma = d;
  var o = 58;
  i.colon = o;
  var c = 59;
  i.semicolon = c;
  var f = 40;
  i.openParenthesis = f;
  var t = 41;
  i.closeParenthesis = t;
  var r = 91;
  i.openSquare = r;
  var s = 93;
  i.closeSquare = s;
  var n = 36;
  i.dollar = n;
  var l = 126;
  i.tilde = l;
  var p = 94;
  i.caret = p;
  var b = 43;
  i.plus = b;
  var e = 61;
  i.equals = e;
  var v = 124;
  i.pipe = v;
  var _ = 62;
  i.greaterThan = _;
  var m = 32;
  i.space = m;
  var y = 39;
  i.singleQuote = y;
  var O = 34;
  i.doubleQuote = O;
  var a = 47;
  i.slash = a;
  var h = 33;
  i.bang = h;
  var E = 92;
  i.backslash = E;
  var w = 13;
  i.cr = w;
  var S = 12;
  i.feed = S;
  var A = 10;
  i.newline = A;
  var k = 9;
  i.tab = k;
  var C = y;
  i.str = C;
  var L = -1;
  i.comment = L;
  var F = -2;
  i.word = F;
  var B = -3;
  i.combinator = B;
})), Ct = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.FIELDS = void 0, i.default = b;
  var u = o(Ke()), I, g;
  function d(e) {
    if (typeof WeakMap != "function") return null;
    var v = /* @__PURE__ */ new WeakMap(), _ = /* @__PURE__ */ new WeakMap();
    return (d = function(y) {
      return y ? _ : v;
    })(e);
  }
  function o(e, v) {
    if (e && e.__esModule) return e;
    if (e === null || typeof e != "object" && typeof e != "function") return { default: e };
    var _ = d(v);
    if (_ && _.has(e)) return _.get(e);
    var m = {}, y = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var O in e) if (O !== "default" && Object.prototype.hasOwnProperty.call(e, O)) {
      var a = y ? Object.getOwnPropertyDescriptor(e, O) : null;
      a && (a.get || a.set) ? Object.defineProperty(m, O, a) : m[O] = e[O];
    }
    return m.default = e, _ && _.set(e, m), m;
  }
  for (var c = (I = {}, I[u.tab] = !0, I[u.newline] = !0, I[u.cr] = !0, I[u.feed] = !0, I), f = (g = {}, g[u.space] = !0, g[u.tab] = !0, g[u.newline] = !0, g[u.cr] = !0, g[u.feed] = !0, g[u.ampersand] = !0, g[u.asterisk] = !0, g[u.bang] = !0, g[u.comma] = !0, g[u.colon] = !0, g[u.semicolon] = !0, g[u.openParenthesis] = !0, g[u.closeParenthesis] = !0, g[u.openSquare] = !0, g[u.closeSquare] = !0, g[u.singleQuote] = !0, g[u.doubleQuote] = !0, g[u.plus] = !0, g[u.pipe] = !0, g[u.tilde] = !0, g[u.greaterThan] = !0, g[u.equals] = !0, g[u.dollar] = !0, g[u.caret] = !0, g[u.slash] = !0, g), t = {}, r = "0123456789abcdefABCDEF", s = 0; s < r.length; s++) t[r.charCodeAt(s)] = !0;
  function n(e, v) {
    var _ = v, m;
    do {
      if (m = e.charCodeAt(_), f[m]) return _ - 1;
      m === u.backslash ? _ = l(e, _) + 1 : _++;
    } while (_ < e.length);
    return _ - 1;
  }
  function l(e, v) {
    var _ = v, m = e.charCodeAt(_ + 1);
    if (!c[m]) if (t[m]) {
      var y = 0;
      do
        _++, y++, m = e.charCodeAt(_ + 1);
      while (t[m] && y < 6);
      y < 6 && m === u.space && _++;
    } else _++;
    return _;
  }
  var p = {
    TYPE: 0,
    START_LINE: 1,
    START_COL: 2,
    END_LINE: 3,
    END_COL: 4,
    START_POS: 5,
    END_POS: 6
  };
  i.FIELDS = p;
  function b(e) {
    var v = [], _ = e.css.valueOf(), m = _.length, y = -1, O = 1, a = 0, h = 0, E, w, S, A, k, C, L, F, B, G, H, $, te;
    function pe(N, Q) {
      if (e.safe)
        _ += Q, B = _.length - 1;
      else throw e.error("Unclosed " + N, O, a - y, a);
    }
    for (; a < m; ) {
      switch (E = _.charCodeAt(a), E === u.newline && (y = a, O += 1), E) {
        case u.space:
        case u.tab:
        case u.newline:
        case u.cr:
        case u.feed:
          B = a;
          do
            B += 1, E = _.charCodeAt(B), E === u.newline && (y = B, O += 1);
          while (E === u.space || E === u.newline || E === u.tab || E === u.cr || E === u.feed);
          te = u.space, A = O, S = B - y - 1, h = B;
          break;
        case u.plus:
        case u.greaterThan:
        case u.tilde:
        case u.pipe:
          B = a;
          do
            B += 1, E = _.charCodeAt(B);
          while (E === u.plus || E === u.greaterThan || E === u.tilde || E === u.pipe);
          te = u.combinator, A = O, S = a - y, h = B;
          break;
        case u.asterisk:
        case u.ampersand:
        case u.bang:
        case u.comma:
        case u.equals:
        case u.dollar:
        case u.caret:
        case u.openSquare:
        case u.closeSquare:
        case u.colon:
        case u.semicolon:
        case u.openParenthesis:
        case u.closeParenthesis:
          B = a, te = E, A = O, S = a - y, h = B + 1;
          break;
        case u.singleQuote:
        case u.doubleQuote:
          $ = E === u.singleQuote ? "'" : '"', B = a;
          do
            for (k = !1, B = _.indexOf($, B + 1), B === -1 && pe("quote", $), C = B; _.charCodeAt(C - 1) === u.backslash; )
              C -= 1, k = !k;
          while (k);
          te = u.str, A = O, S = a - y, h = B + 1;
          break;
        default:
          E === u.slash && _.charCodeAt(a + 1) === u.asterisk ? (B = _.indexOf("*/", a + 2) + 1, B === 0 && pe("comment", "*/"), w = _.slice(a, B + 1), F = w.split(`
`), L = F.length - 1, L > 0 ? (G = O + L, H = B - F[L].length) : (G = O, H = y), te = u.comment, O = G, A = G, S = B - H) : E === u.slash ? (B = a, te = E, A = O, S = a - y, h = B + 1) : (B = n(_, a), te = u.word, A = O, S = B - y), h = B + 1;
          break;
      }
      v.push([
        te,
        O,
        a - y,
        A,
        S,
        a,
        h
      ]), H && (y = H, H = null), a = h;
    }
    return v;
  }
})), Dt = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = E(Qe()), g = E(Re()), d = E(Fe()), o = E(Ue()), c = E(xe()), f = E(Ge()), t = E(We()), r = E(Ye()), s = h(ze()), n = E(je()), l = E(Je()), p = E(He()), b = E(kt()), e = h(Ct()), v = h(Ke()), _ = h(ie()), m = Ie(), y, O;
  function a(N) {
    if (typeof WeakMap != "function") return null;
    var Q = /* @__PURE__ */ new WeakMap(), q = /* @__PURE__ */ new WeakMap();
    return (a = function(D) {
      return D ? q : Q;
    })(N);
  }
  function h(N, Q) {
    if (N && N.__esModule) return N;
    if (N === null || typeof N != "object" && typeof N != "function") return { default: N };
    var q = a(Q);
    if (q && q.has(N)) return q.get(N);
    var P = {}, D = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var U in N) if (U !== "default" && Object.prototype.hasOwnProperty.call(N, U)) {
      var T = D ? Object.getOwnPropertyDescriptor(N, U) : null;
      T && (T.get || T.set) ? Object.defineProperty(P, U, T) : P[U] = N[U];
    }
    return P.default = N, q && q.set(N, P), P;
  }
  function E(N) {
    return N && N.__esModule ? N : { default: N };
  }
  function w(N, Q) {
    for (var q = 0; q < Q.length; q++) {
      var P = Q[q];
      P.enumerable = P.enumerable || !1, P.configurable = !0, "value" in P && (P.writable = !0), Object.defineProperty(N, P.key, P);
    }
  }
  function S(N, Q, q) {
    return Q && w(N.prototype, Q), Object.defineProperty(N, "prototype", { writable: !1 }), N;
  }
  var A = (y = {}, y[v.space] = !0, y[v.cr] = !0, y[v.feed] = !0, y[v.newline] = !0, y[v.tab] = !0, y), k = Object.assign({}, A, (O = {}, O[v.comment] = !0, O));
  function C(N) {
    return {
      line: N[e.FIELDS.START_LINE],
      column: N[e.FIELDS.START_COL]
    };
  }
  function L(N) {
    return {
      line: N[e.FIELDS.END_LINE],
      column: N[e.FIELDS.END_COL]
    };
  }
  function F(N, Q, q, P) {
    return {
      start: {
        line: N,
        column: Q
      },
      end: {
        line: q,
        column: P
      }
    };
  }
  function B(N) {
    return F(N[e.FIELDS.START_LINE], N[e.FIELDS.START_COL], N[e.FIELDS.END_LINE], N[e.FIELDS.END_COL]);
  }
  function G(N, Q) {
    if (N)
      return F(N[e.FIELDS.START_LINE], N[e.FIELDS.START_COL], Q[e.FIELDS.END_LINE], Q[e.FIELDS.END_COL]);
  }
  function H(N, Q) {
    var q = N[Q];
    if (typeof q == "string")
      return q.indexOf("\\") !== -1 && ((0, m.ensureObject)(N, "raws"), N[Q] = (0, m.unesc)(q), N.raws[Q] === void 0 && (N.raws[Q] = q)), N;
  }
  function $(N, Q) {
    for (var q = -1, P = []; (q = N.indexOf(Q, q + 1)) !== -1; ) P.push(q);
    return P;
  }
  function te() {
    var N = Array.prototype.concat.apply([], arguments);
    return N.filter(function(Q, q) {
      return q === N.indexOf(Q);
    });
  }
  var pe = /* @__PURE__ */ (function() {
    function N(q, P) {
      P === void 0 && (P = {}), this.rule = q, this.options = Object.assign({
        lossy: !1,
        safe: !1
      }, P), this.position = 0, this.css = typeof this.rule == "string" ? this.rule : this.rule.selector, this.tokens = (0, e.default)({
        css: this.css,
        error: this._errorGenerator(),
        safe: this.options.safe
      });
      var D = G(this.tokens[0], this.tokens[this.tokens.length - 1]);
      this.root = new I.default({ source: D }), this.root.errorGenerator = this._errorGenerator();
      var U = new g.default({
        source: { start: {
          line: 1,
          column: 1
        } },
        sourceIndex: 0
      });
      this.root.append(U), this.current = U, this.loop();
    }
    var Q = N.prototype;
    return Q._errorGenerator = function() {
      var P = this;
      return function(D, U) {
        return typeof P.rule == "string" ? new Error(D) : P.rule.error(D, U);
      };
    }, Q.attribute = function() {
      var P = [], D = this.currToken;
      for (this.position++; this.position < this.tokens.length && this.currToken[e.FIELDS.TYPE] !== v.closeSquare; )
        P.push(this.currToken), this.position++;
      if (this.currToken[e.FIELDS.TYPE] !== v.closeSquare) return this.expected("closing square bracket", this.currToken[e.FIELDS.START_POS]);
      var U = P.length, T = {
        source: F(D[1], D[2], this.currToken[3], this.currToken[4]),
        sourceIndex: D[e.FIELDS.START_POS]
      };
      if (U === 1 && !~[v.word].indexOf(P[0][e.FIELDS.TYPE])) return this.expected("attribute", P[0][e.FIELDS.START_POS]);
      for (var Y = 0, j = "", J = "", x = null, K = !1; Y < U; ) {
        var X = P[Y], W = this.content(X), Z = P[Y + 1];
        switch (X[e.FIELDS.TYPE]) {
          case v.space:
            if (K = !0, this.options.lossy) break;
            if (x) {
              (0, m.ensureObject)(T, "spaces", x);
              var ue = T.spaces[x].after || "";
              T.spaces[x].after = ue + W;
              var oe = (0, m.getProp)(T, "raws", "spaces", x, "after") || null;
              oe && (T.raws.spaces[x].after = oe + W);
            } else
              j = j + W, J = J + W;
            break;
          case v.asterisk:
            Z[e.FIELDS.TYPE] === v.equals ? (T.operator = W, x = "operator") : (!T.namespace || x === "namespace" && !K) && Z && (j && ((0, m.ensureObject)(T, "spaces", "attribute"), T.spaces.attribute.before = j, j = ""), J && ((0, m.ensureObject)(T, "raws", "spaces", "attribute"), T.raws.spaces.attribute.before = j, J = ""), T.namespace = (T.namespace || "") + W, (0, m.getProp)(T, "raws", "namespace") && (T.raws.namespace += W), x = "namespace"), K = !1;
            break;
          case v.dollar:
            if (x === "value") {
              var re = (0, m.getProp)(T, "raws", "value");
              T.value += "$", re && (T.raws.value = re + "$");
              break;
            }
          case v.caret:
            Z[e.FIELDS.TYPE] === v.equals && (T.operator = W, x = "operator"), K = !1;
            break;
          case v.combinator:
            if (W === "~" && Z[e.FIELDS.TYPE] === v.equals && (T.operator = W, x = "operator"), W !== "|") {
              K = !1;
              break;
            }
            Z[e.FIELDS.TYPE] === v.equals ? (T.operator = W, x = "operator") : !T.namespace && !T.attribute && (T.namespace = !0), K = !1;
            break;
          case v.word:
            if (Z && this.content(Z) === "|" && P[Y + 2] && P[Y + 2][e.FIELDS.TYPE] !== v.equals && !T.operator && !T.namespace)
              T.namespace = W, x = "namespace";
            else if (!T.attribute || x === "attribute" && !K)
              j && ((0, m.ensureObject)(T, "spaces", "attribute"), T.spaces.attribute.before = j, j = ""), J && ((0, m.ensureObject)(T, "raws", "spaces", "attribute"), T.raws.spaces.attribute.before = J, J = ""), T.attribute = (T.attribute || "") + W, (0, m.getProp)(T, "raws", "attribute") && (T.raws.attribute += W), x = "attribute";
            else if (!T.value && T.value !== "" || x === "value" && !(K || T.quoteMark)) {
              var ee = (0, m.unesc)(W), se = (0, m.getProp)(T, "raws", "value") || "", ae = T.value || "";
              T.value = ae + ee, T.quoteMark = null, (ee !== W || se) && ((0, m.ensureObject)(T, "raws"), T.raws.value = (se || ae) + W), x = "value";
            } else {
              var ce = W === "i" || W === "I";
              (T.value || T.value === "") && (T.quoteMark || K) ? (T.insensitive = ce, (!ce || W === "I") && ((0, m.ensureObject)(T, "raws"), T.raws.insensitiveFlag = W), x = "insensitive", j && ((0, m.ensureObject)(T, "spaces", "insensitive"), T.spaces.insensitive.before = j, j = ""), J && ((0, m.ensureObject)(T, "raws", "spaces", "insensitive"), T.raws.spaces.insensitive.before = J, J = "")) : (T.value || T.value === "") && (x = "value", T.value += W, T.raws.value && (T.raws.value += W));
            }
            K = !1;
            break;
          case v.str:
            if (!T.attribute || !T.operator) return this.error("Expected an attribute followed by an operator preceding the string.", { index: X[e.FIELDS.START_POS] });
            var ve = (0, s.unescapeValue)(W), ge = ve.unescaped, de = ve.quoteMark;
            T.value = ge, T.quoteMark = de, x = "value", (0, m.ensureObject)(T, "raws"), T.raws.value = W, K = !1;
            break;
          case v.equals:
            if (!T.attribute) return this.expected("attribute", X[e.FIELDS.START_POS], W);
            if (T.value) return this.error('Unexpected "=" found; an operator was already defined.', { index: X[e.FIELDS.START_POS] });
            T.operator = T.operator ? T.operator + W : W, x = "operator", K = !1;
            break;
          case v.comment:
            if (x) if (K || Z && Z[e.FIELDS.TYPE] === v.space || x === "insensitive") {
              var Se = (0, m.getProp)(T, "spaces", x, "after") || "", Ee = (0, m.getProp)(T, "raws", "spaces", x, "after") || Se;
              (0, m.ensureObject)(T, "raws", "spaces", x), T.raws.spaces[x].after = Ee + W;
            } else {
              var Ae = T[x] || "", me = (0, m.getProp)(T, "raws", x) || Ae;
              (0, m.ensureObject)(T, "raws"), T.raws[x] = me + W;
            }
            else J = J + W;
            break;
          default:
            return this.error('Unexpected "' + W + '" found.', { index: X[e.FIELDS.START_POS] });
        }
        Y++;
      }
      H(T, "attribute"), H(T, "namespace"), this.newNode(new s.default(T)), this.position++;
    }, Q.parseWhitespaceEquivalentTokens = function(P) {
      P < 0 && (P = this.tokens.length);
      var D = this.position, U = [], T = "", Y = void 0;
      do
        if (A[this.currToken[e.FIELDS.TYPE]])
          this.options.lossy || (T += this.content());
        else if (this.currToken[e.FIELDS.TYPE] === v.comment) {
          var j = {};
          T && (j.before = T, T = ""), Y = new o.default({
            value: this.content(),
            source: B(this.currToken),
            sourceIndex: this.currToken[e.FIELDS.START_POS],
            spaces: j
          }), U.push(Y);
        }
      while (++this.position < P);
      if (T) {
        if (Y) Y.spaces.after = T;
        else if (!this.options.lossy) {
          var J = this.tokens[D], x = this.tokens[this.position - 1];
          U.push(new t.default({
            value: "",
            source: F(J[e.FIELDS.START_LINE], J[e.FIELDS.START_COL], x[e.FIELDS.END_LINE], x[e.FIELDS.END_COL]),
            sourceIndex: J[e.FIELDS.START_POS],
            spaces: {
              before: T,
              after: ""
            }
          }));
        }
      }
      return U;
    }, Q.convertWhitespaceNodesToSpace = function(P, D) {
      var U = this;
      D === void 0 && (D = !1);
      var T = "", Y = "";
      return P.forEach(function(j) {
        var J = U.lossySpace(j.spaces.before, D), x = U.lossySpace(j.rawSpaceBefore, D);
        T += J + U.lossySpace(j.spaces.after, D && J.length === 0), Y += J + j.value + U.lossySpace(j.rawSpaceAfter, D && x.length === 0);
      }), Y === T && (Y = void 0), {
        space: T,
        rawSpace: Y
      };
    }, Q.isNamedCombinator = function(P) {
      return P === void 0 && (P = this.position), this.tokens[P + 0] && this.tokens[P + 0][e.FIELDS.TYPE] === v.slash && this.tokens[P + 1] && this.tokens[P + 1][e.FIELDS.TYPE] === v.word && this.tokens[P + 2] && this.tokens[P + 2][e.FIELDS.TYPE] === v.slash;
    }, Q.namedCombinator = function() {
      if (this.isNamedCombinator()) {
        var P = this.content(this.tokens[this.position + 1]), D = (0, m.unesc)(P).toLowerCase(), U = {};
        D !== P && (U.value = "/" + P + "/");
        var T = new l.default({
          value: "/" + D + "/",
          source: F(this.currToken[e.FIELDS.START_LINE], this.currToken[e.FIELDS.START_COL], this.tokens[this.position + 2][e.FIELDS.END_LINE], this.tokens[this.position + 2][e.FIELDS.END_COL]),
          sourceIndex: this.currToken[e.FIELDS.START_POS],
          raws: U
        });
        return this.position = this.position + 3, T;
      } else this.unexpected();
    }, Q.combinator = function() {
      var P = this;
      if (this.content() === "|") return this.namespace();
      var D = this.locateNextMeaningfulToken(this.position);
      if (D < 0 || this.tokens[D][e.FIELDS.TYPE] === v.comma || this.tokens[D][e.FIELDS.TYPE] === v.closeParenthesis) {
        var U = this.parseWhitespaceEquivalentTokens(D);
        if (U.length > 0) {
          var T = this.current.last;
          if (T) {
            var Y = this.convertWhitespaceNodesToSpace(U), j = Y.space, J = Y.rawSpace;
            J !== void 0 && (T.rawSpaceAfter += J), T.spaces.after += j;
          } else U.forEach(function(ce) {
            return P.newNode(ce);
          });
        }
        return;
      }
      var x = this.currToken, K = void 0;
      D > this.position && (K = this.parseWhitespaceEquivalentTokens(D));
      var X;
      if (this.isNamedCombinator() ? X = this.namedCombinator() : this.currToken[e.FIELDS.TYPE] === v.combinator ? (X = new l.default({
        value: this.content(),
        source: B(this.currToken),
        sourceIndex: this.currToken[e.FIELDS.START_POS]
      }), this.position++) : A[this.currToken[e.FIELDS.TYPE]] || K || this.unexpected(), X) {
        if (K) {
          var W = this.convertWhitespaceNodesToSpace(K), Z = W.space, ue = W.rawSpace;
          X.spaces.before = Z, X.rawSpaceBefore = ue;
        }
      } else {
        var oe = this.convertWhitespaceNodesToSpace(K, !0), re = oe.space, ee = oe.rawSpace;
        ee || (ee = re);
        var se = {}, ae = { spaces: {} };
        re.endsWith(" ") && ee.endsWith(" ") ? (se.before = re.slice(0, re.length - 1), ae.spaces.before = ee.slice(0, ee.length - 1)) : re.startsWith(" ") && ee.startsWith(" ") ? (se.after = re.slice(1), ae.spaces.after = ee.slice(1)) : ae.value = ee, X = new l.default({
          value: " ",
          source: G(x, this.tokens[this.position - 1]),
          sourceIndex: x[e.FIELDS.START_POS],
          spaces: se,
          raws: ae
        });
      }
      return this.currToken && this.currToken[e.FIELDS.TYPE] === v.space && (X.spaces.after = this.optionalSpace(this.content()), this.position++), this.newNode(X);
    }, Q.comma = function() {
      if (this.position === this.tokens.length - 1) {
        this.root.trailingComma = !0, this.position++;
        return;
      }
      this.current._inferEndPosition();
      var P = new g.default({
        source: { start: C(this.tokens[this.position + 1]) },
        sourceIndex: this.tokens[this.position + 1][e.FIELDS.START_POS]
      });
      this.current.parent.append(P), this.current = P, this.position++;
    }, Q.comment = function() {
      var P = this.currToken;
      this.newNode(new o.default({
        value: this.content(),
        source: B(P),
        sourceIndex: P[e.FIELDS.START_POS]
      })), this.position++;
    }, Q.error = function(P, D) {
      throw this.root.error(P, D);
    }, Q.missingBackslash = function() {
      return this.error("Expected a backslash preceding the semicolon.", { index: this.currToken[e.FIELDS.START_POS] });
    }, Q.missingParenthesis = function() {
      return this.expected("opening parenthesis", this.currToken[e.FIELDS.START_POS]);
    }, Q.missingSquareBracket = function() {
      return this.expected("opening square bracket", this.currToken[e.FIELDS.START_POS]);
    }, Q.unexpected = function() {
      return this.error("Unexpected '" + this.content() + "'. Escaping special characters with \\ may help.", this.currToken[e.FIELDS.START_POS]);
    }, Q.unexpectedPipe = function() {
      return this.error("Unexpected '|'.", this.currToken[e.FIELDS.START_POS]);
    }, Q.namespace = function() {
      var P = this.prevToken && this.content(this.prevToken) || !0;
      if (this.nextToken[e.FIELDS.TYPE] === v.word)
        return this.position++, this.word(P);
      if (this.nextToken[e.FIELDS.TYPE] === v.asterisk)
        return this.position++, this.universal(P);
      this.unexpectedPipe();
    }, Q.nesting = function() {
      if (this.nextToken && this.content(this.nextToken) === "|") {
        this.position++;
        return;
      }
      var P = this.currToken;
      this.newNode(new p.default({
        value: this.content(),
        source: B(P),
        sourceIndex: P[e.FIELDS.START_POS]
      })), this.position++;
    }, Q.parentheses = function() {
      var P = this.current.last, D = 1;
      if (this.position++, P && P.type === _.PSEUDO) {
        var U = new g.default({
          source: { start: C(this.tokens[this.position]) },
          sourceIndex: this.tokens[this.position][e.FIELDS.START_POS]
        }), T = this.current;
        for (P.append(U), this.current = U; this.position < this.tokens.length && D; )
          this.currToken[e.FIELDS.TYPE] === v.openParenthesis && D++, this.currToken[e.FIELDS.TYPE] === v.closeParenthesis && D--, D ? this.parse() : (this.current.source.end = L(this.currToken), this.current.parent.source.end = L(this.currToken), this.position++);
        this.current = T;
      } else {
        for (var Y = this.currToken, j = "(", J; this.position < this.tokens.length && D; )
          this.currToken[e.FIELDS.TYPE] === v.openParenthesis && D++, this.currToken[e.FIELDS.TYPE] === v.closeParenthesis && D--, J = this.currToken, j += this.parseParenthesisToken(this.currToken), this.position++;
        P ? P.appendToPropertyAndEscape("value", j, j) : this.newNode(new t.default({
          value: j,
          source: F(Y[e.FIELDS.START_LINE], Y[e.FIELDS.START_COL], J[e.FIELDS.END_LINE], J[e.FIELDS.END_COL]),
          sourceIndex: Y[e.FIELDS.START_POS]
        }));
      }
      if (D) return this.expected("closing parenthesis", this.currToken[e.FIELDS.START_POS]);
    }, Q.pseudo = function() {
      for (var P = this, D = "", U = this.currToken; this.currToken && this.currToken[e.FIELDS.TYPE] === v.colon; )
        D += this.content(), this.position++;
      if (!this.currToken) return this.expected(["pseudo-class", "pseudo-element"], this.position - 1);
      if (this.currToken[e.FIELDS.TYPE] === v.word) this.splitWord(!1, function(T, Y) {
        D += T, P.newNode(new r.default({
          value: D,
          source: G(U, P.currToken),
          sourceIndex: U[e.FIELDS.START_POS]
        })), Y > 1 && P.nextToken && P.nextToken[e.FIELDS.TYPE] === v.openParenthesis && P.error("Misplaced parenthesis.", { index: P.nextToken[e.FIELDS.START_POS] });
      });
      else return this.expected(["pseudo-class", "pseudo-element"], this.currToken[e.FIELDS.START_POS]);
    }, Q.space = function() {
      var P = this.content();
      this.position === 0 || this.prevToken[e.FIELDS.TYPE] === v.comma || this.prevToken[e.FIELDS.TYPE] === v.openParenthesis || this.current.nodes.every(function(D) {
        return D.type === "comment";
      }) ? (this.spaces = this.optionalSpace(P), this.position++) : this.position === this.tokens.length - 1 || this.nextToken[e.FIELDS.TYPE] === v.comma || this.nextToken[e.FIELDS.TYPE] === v.closeParenthesis ? (this.current.last.spaces.after = this.optionalSpace(P), this.position++) : this.combinator();
    }, Q.string = function() {
      var P = this.currToken;
      this.newNode(new t.default({
        value: this.content(),
        source: B(P),
        sourceIndex: P[e.FIELDS.START_POS]
      })), this.position++;
    }, Q.universal = function(P) {
      var D = this.nextToken;
      if (D && this.content(D) === "|")
        return this.position++, this.namespace();
      var U = this.currToken;
      this.newNode(new n.default({
        value: this.content(),
        source: B(U),
        sourceIndex: U[e.FIELDS.START_POS]
      }), P), this.position++;
    }, Q.splitWord = function(P, D) {
      for (var U = this, T = this.nextToken, Y = this.content(); T && ~[
        v.dollar,
        v.caret,
        v.equals,
        v.word
      ].indexOf(T[e.FIELDS.TYPE]); ) {
        this.position++;
        var j = this.content();
        if (Y += j, j.lastIndexOf("\\") === j.length - 1) {
          var J = this.nextToken;
          J && J[e.FIELDS.TYPE] === v.space && (Y += this.requiredSpace(this.content(J)), this.position++);
        }
        T = this.nextToken;
      }
      var x = $(Y, ".").filter(function(Z) {
        var ue = Y[Z - 1] === "\\", oe = /^\d+\.\d+%$/.test(Y);
        return !ue && !oe;
      }), K = $(Y, "#").filter(function(Z) {
        return Y[Z - 1] !== "\\";
      }), X = $(Y, "#{");
      X.length && (K = K.filter(function(Z) {
        return !~X.indexOf(Z);
      }));
      var W = (0, b.default)(te([0].concat(x, K)));
      W.forEach(function(Z, ue) {
        var oe = W[ue + 1] || Y.length, re = Y.slice(Z, oe);
        if (ue === 0 && D) return D.call(U, re, W.length);
        var ee, se = U.currToken, ae = se[e.FIELDS.START_POS] + W[ue], ce = F(se[1], se[2] + Z, se[3], se[2] + (oe - 1));
        if (~x.indexOf(Z)) {
          var ve = {
            value: re.slice(1),
            source: ce,
            sourceIndex: ae
          };
          ee = new d.default(H(ve, "value"));
        } else if (~K.indexOf(Z)) {
          var ge = {
            value: re.slice(1),
            source: ce,
            sourceIndex: ae
          };
          ee = new c.default(H(ge, "value"));
        } else {
          var de = {
            value: re,
            source: ce,
            sourceIndex: ae
          };
          H(de, "value"), ee = new f.default(de);
        }
        U.newNode(ee, P), P = null;
      }), this.position++;
    }, Q.word = function(P) {
      var D = this.nextToken;
      return D && this.content(D) === "|" ? (this.position++, this.namespace()) : this.splitWord(P);
    }, Q.loop = function() {
      for (; this.position < this.tokens.length; ) this.parse(!0);
      return this.current._inferEndPosition(), this.root;
    }, Q.parse = function(P) {
      switch (this.currToken[e.FIELDS.TYPE]) {
        case v.space:
          this.space();
          break;
        case v.comment:
          this.comment();
          break;
        case v.openParenthesis:
          this.parentheses();
          break;
        case v.closeParenthesis:
          P && this.missingParenthesis();
          break;
        case v.openSquare:
          this.attribute();
          break;
        case v.dollar:
        case v.caret:
        case v.equals:
        case v.word:
          this.word();
          break;
        case v.colon:
          this.pseudo();
          break;
        case v.comma:
          this.comma();
          break;
        case v.asterisk:
          this.universal();
          break;
        case v.ampersand:
          this.nesting();
          break;
        case v.slash:
        case v.combinator:
          this.combinator();
          break;
        case v.str:
          this.string();
          break;
        case v.closeSquare:
          this.missingSquareBracket();
        case v.semicolon:
          this.missingBackslash();
        default:
          this.unexpected();
      }
    }, Q.expected = function(P, D, U) {
      if (Array.isArray(P)) {
        var T = P.pop();
        P = P.join(", ") + " or " + T;
      }
      var Y = /^[aeiou]/.test(P[0]) ? "an" : "a";
      return U ? this.error("Expected " + Y + " " + P + ', found "' + U + '" instead.', { index: D }) : this.error("Expected " + Y + " " + P + ".", { index: D });
    }, Q.requiredSpace = function(P) {
      return this.options.lossy ? " " : P;
    }, Q.optionalSpace = function(P) {
      return this.options.lossy ? "" : P;
    }, Q.lossySpace = function(P, D) {
      return this.options.lossy ? D ? " " : "" : P;
    }, Q.parseParenthesisToken = function(P) {
      var D = this.content(P);
      return P[e.FIELDS.TYPE] === v.space ? this.requiredSpace(D) : D;
    }, Q.newNode = function(P, D) {
      return D && (/^ +$/.test(D) && (this.options.lossy || (this.spaces = (this.spaces || "") + D), D = !0), P.namespace = D, H(P, "namespace")), this.spaces && (P.spaces.before = this.spaces, this.spaces = ""), this.current.append(P);
    }, Q.content = function(P) {
      return P === void 0 && (P = this.currToken), this.css.slice(P[e.FIELDS.START_POS], P[e.FIELDS.END_POS]);
    }, Q.locateNextMeaningfulToken = function(P) {
      P === void 0 && (P = this.position + 1);
      for (var D = P; D < this.tokens.length; ) if (k[this.tokens[D][e.FIELDS.TYPE]]) {
        D++;
        continue;
      } else return D;
      return -1;
    }, S(N, [
      {
        key: "currToken",
        get: function() {
          return this.tokens[this.position];
        }
      },
      {
        key: "nextToken",
        get: function() {
          return this.tokens[this.position + 1];
        }
      },
      {
        key: "prevToken",
        get: function() {
          return this.tokens[this.position - 1];
        }
      }
    ]), N;
  })();
  i.default = pe, u.exports = i.default;
})), Bt = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = g(Dt());
  function g(o) {
    return o && o.__esModule ? o : { default: o };
  }
  var d = /* @__PURE__ */ (function() {
    function o(f, t) {
      this.func = f || function() {
      }, this.funcRes = null, this.options = t;
    }
    var c = o.prototype;
    return c._shouldUpdateSelector = function(t, r) {
      return r === void 0 && (r = {}), Object.assign({}, this.options, r).updateSelector === !1 ? !1 : typeof t != "string";
    }, c._isLossy = function(t) {
      return t === void 0 && (t = {}), Object.assign({}, this.options, t).lossless === !1;
    }, c._root = function(t, r) {
      return r === void 0 && (r = {}), new I.default(t, this._parseOptions(r)).root;
    }, c._parseOptions = function(t) {
      return { lossy: this._isLossy(t) };
    }, c._run = function(t, r) {
      var s = this;
      return r === void 0 && (r = {}), new Promise(function(n, l) {
        try {
          var p = s._root(t, r);
          Promise.resolve(s.func(p)).then(function(b) {
            var e = void 0;
            return s._shouldUpdateSelector(t, r) && (e = p.toString(), t.selector = e), {
              transform: b,
              root: p,
              string: e
            };
          }).then(n, l);
        } catch (b) {
          l(b);
          return;
        }
      });
    }, c._runSync = function(t, r) {
      r === void 0 && (r = {});
      var s = this._root(t, r), n = this.func(s);
      if (n && typeof n.then == "function") throw new Error("Selector processor returned a promise to a synchronous call.");
      var l = void 0;
      return r.updateSelector && typeof t != "string" && (l = s.toString(), t.selector = l), {
        transform: n,
        root: s,
        string: l
      };
    }, c.ast = function(t, r) {
      return this._run(t, r).then(function(s) {
        return s.root;
      });
    }, c.astSync = function(t, r) {
      return this._runSync(t, r).root;
    }, c.transform = function(t, r) {
      return this._run(t, r).then(function(s) {
        return s.transform;
      });
    }, c.transformSync = function(t, r) {
      return this._runSync(t, r).transform;
    }, c.process = function(t, r) {
      return this._run(t, r).then(function(s) {
        return s.string || s.root.toString();
      });
    }, c.processSync = function(t, r) {
      var s = this._runSync(t, r);
      return s.string || s.root.toString();
    }, o;
  })();
  i.default = d, u.exports = i.default;
})), Lt = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.universal = i.tag = i.string = i.selector = i.root = i.pseudo = i.nesting = i.id = i.comment = i.combinator = i.className = i.attribute = void 0;
  var u = p(ze()), I = p(Fe()), g = p(Je()), d = p(Ue()), o = p(xe()), c = p(He()), f = p(Ye()), t = p(Qe()), r = p(Re()), s = p(We()), n = p(Ge()), l = p(je());
  function p(A) {
    return A && A.__esModule ? A : { default: A };
  }
  var b = function(k) {
    return new u.default(k);
  };
  i.attribute = b;
  var e = function(k) {
    return new I.default(k);
  };
  i.className = e;
  var v = function(k) {
    return new g.default(k);
  };
  i.combinator = v;
  var _ = function(k) {
    return new d.default(k);
  };
  i.comment = _;
  var m = function(k) {
    return new o.default(k);
  };
  i.id = m;
  var y = function(k) {
    return new c.default(k);
  };
  i.nesting = y;
  var O = function(k) {
    return new f.default(k);
  };
  i.pseudo = O;
  var a = function(k) {
    return new t.default(k);
  };
  i.root = a;
  var h = function(k) {
    return new r.default(k);
  };
  i.selector = h;
  var E = function(k) {
    return new s.default(k);
  };
  i.string = E;
  var w = function(k) {
    return new n.default(k);
  };
  i.tag = w;
  var S = function(k) {
    return new l.default(k);
  };
  i.universal = S;
})), Mt = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0, i.isComment = i.isCombinator = i.isClassName = i.isAttribute = void 0, i.isContainer = O, i.isIdentifier = void 0, i.isNamespace = a, i.isNesting = void 0, i.isNode = d, i.isPseudo = void 0, i.isPseudoClass = y, i.isPseudoElement = m, i.isUniversal = i.isTag = i.isString = i.isSelector = i.isRoot = void 0;
  var u = ie(), I, g = (I = {}, I[u.ATTRIBUTE] = !0, I[u.CLASS] = !0, I[u.COMBINATOR] = !0, I[u.COMMENT] = !0, I[u.ID] = !0, I[u.NESTING] = !0, I[u.PSEUDO] = !0, I[u.ROOT] = !0, I[u.SELECTOR] = !0, I[u.STRING] = !0, I[u.TAG] = !0, I[u.UNIVERSAL] = !0, I);
  function d(h) {
    return typeof h == "object" && g[h.type];
  }
  function o(h, E) {
    return d(E) && E.type === h;
  }
  var c = o.bind(null, u.ATTRIBUTE);
  i.isAttribute = c;
  var f = o.bind(null, u.CLASS);
  i.isClassName = f;
  var t = o.bind(null, u.COMBINATOR);
  i.isCombinator = t;
  var r = o.bind(null, u.COMMENT);
  i.isComment = r;
  var s = o.bind(null, u.ID);
  i.isIdentifier = s;
  var n = o.bind(null, u.NESTING);
  i.isNesting = n;
  var l = o.bind(null, u.PSEUDO);
  i.isPseudo = l;
  var p = o.bind(null, u.ROOT);
  i.isRoot = p;
  var b = o.bind(null, u.SELECTOR);
  i.isSelector = b;
  var e = o.bind(null, u.STRING);
  i.isString = e;
  var v = o.bind(null, u.TAG);
  i.isTag = v;
  var _ = o.bind(null, u.UNIVERSAL);
  i.isUniversal = _;
  function m(h) {
    return l(h) && h.value && (h.value.startsWith("::") || h.value.toLowerCase() === ":before" || h.value.toLowerCase() === ":after" || h.value.toLowerCase() === ":first-letter" || h.value.toLowerCase() === ":first-line");
  }
  function y(h) {
    return l(h) && !m(h);
  }
  function O(h) {
    return !!(d(h) && h.walk);
  }
  function a(h) {
    return c(h) || v(h);
  }
})), Nt = /* @__PURE__ */ R(((i) => {
  i.__esModule = !0;
  var u = ie();
  Object.keys(u).forEach(function(d) {
    d === "default" || d === "__esModule" || d in i && i[d] === u[d] || (i[d] = u[d]);
  });
  var I = Lt();
  Object.keys(I).forEach(function(d) {
    d === "default" || d === "__esModule" || d in i && i[d] === I[d] || (i[d] = I[d]);
  });
  var g = Mt();
  Object.keys(g).forEach(function(d) {
    d === "default" || d === "__esModule" || d in i && i[d] === g[d] || (i[d] = g[d]);
  });
})), Ve = /* @__PURE__ */ R(((i, u) => {
  i.__esModule = !0, i.default = void 0;
  var I = c(Bt()), g = o(Nt());
  function d(r) {
    if (typeof WeakMap != "function") return null;
    var s = /* @__PURE__ */ new WeakMap(), n = /* @__PURE__ */ new WeakMap();
    return (d = function(p) {
      return p ? n : s;
    })(r);
  }
  function o(r, s) {
    if (r && r.__esModule) return r;
    if (r === null || typeof r != "object" && typeof r != "function") return { default: r };
    var n = d(s);
    if (n && n.has(r)) return n.get(r);
    var l = {}, p = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for (var b in r) if (b !== "default" && Object.prototype.hasOwnProperty.call(r, b)) {
      var e = p ? Object.getOwnPropertyDescriptor(r, b) : null;
      e && (e.get || e.set) ? Object.defineProperty(l, b, e) : l[b] = r[b];
    }
    return l.default = r, n && n.set(r, l), l;
  }
  function c(r) {
    return r && r.__esModule ? r : { default: r };
  }
  var f = function(s) {
    return new I.default(s);
  };
  Object.assign(f, g);
  var t = f;
  i.default = t, u.exports = i.default;
})), qt = /* @__PURE__ */ R(((i, u) => {
  const I = Ve(), g = ct(), { extractICSS: d } = be(), o = "cssmodules-pure-no-check", c = "cssmodules-pure-ignore", f = (a) => a.type === "combinator" && a.value === " ", t = (a) => {
    for (const h of a.nodes) {
      if (h.type !== "comment") return !1;
      if (h.text.trim().startsWith(o)) return !0;
    }
    return !1;
  };
  function r(a) {
    if (!a.parent) return;
    const h = a.parent.index(a);
    for (let E = h - 1; E >= 0; E--) {
      const w = a.parent.nodes[E];
      if (w.type === "comment") {
        if (w.text.trimStart().startsWith(c)) return w;
      } else break;
    }
  }
  function s(a) {
    const h = [];
    return a.forEach((E) => {
      Array.isArray(E) ? s(E).forEach((w) => {
        h.push(w);
      }) : E && h.push(E);
    }), h.length > 0 && f(h[h.length - 1]) && h.pop(), h;
  }
  const n = /* @__PURE__ */ Symbol("is-pure-selector");
  function l(a, h, E) {
    const w = (A, k) => {
      if (k.ignoreNextSpacing && !f(A)) throw new Error("Missing whitespace after " + k.ignoreNextSpacing);
      if (k.enforceNoSpacing && f(A)) throw new Error("Missing whitespace before " + k.enforceNoSpacing);
      let C;
      switch (A.type) {
        case "root": {
          let L;
          k.hasPureGlobals = !1, C = A.nodes.map((F) => {
            const B = {
              global: k.global,
              lastWasSpacing: !0,
              hasLocals: !1,
              explicit: !1
            };
            if (F = w(F, B), typeof L > "u") L = B.global;
            else if (L !== B.global) throw new Error('Inconsistent rule global/local result in rule "' + A + '" (multiple selectors must result in the same mode for the rule)');
            return B.hasLocals || (k.hasPureGlobals = !0), F;
          }), k.global = L, A.nodes = s(C);
          break;
        }
        case "selector":
          C = A.map((L) => w(L, k)), A = A.clone(), A.nodes = s(C);
          break;
        case "combinator":
          if (f(A))
            return k.ignoreNextSpacing ? (k.ignoreNextSpacing = !1, k.lastWasSpacing = !1, k.enforceNoSpacing = !1, null) : (k.lastWasSpacing = !0, A);
          break;
        case "pseudo": {
          let L;
          const F = !!A.length, B = A.value === ":local" || A.value === ":global";
          if (A.value === ":import" || A.value === ":export") k.hasLocals = !0;
          else if (F) {
            if (B) {
              if (A.nodes.length === 0) throw new Error(`${A.value}() can't be empty`);
              if (k.inside) throw new Error(`A ${A.value} is not allowed inside of a ${k.inside}(...)`);
              if (L = {
                global: A.value === ":global",
                inside: A.value,
                hasLocals: !1,
                explicit: !0
              }, C = A.map((G) => w(G, L)).reduce((G, H) => G.concat(H.nodes), []), C.length) {
                const { before: G, after: H } = A.spaces, $ = C[0], te = C[C.length - 1];
                $.spaces = {
                  before: G,
                  after: $.spaces.after
                }, te.spaces = {
                  before: te.spaces.before,
                  after: H
                };
              }
              A = C;
              break;
            } else
              L = {
                global: k.global,
                inside: k.inside,
                lastWasSpacing: !0,
                hasLocals: !1,
                explicit: k.explicit
              }, C = A.map((G) => {
                const H = {
                  ...L,
                  enforceNoSpacing: !1
                }, $ = w(G, H);
                return L.global = H.global, L.hasLocals = H.hasLocals, $;
              }), A = A.clone(), A.nodes = s(C), L.hasLocals && (k.hasLocals = !0);
            break;
          } else if (B) {
            if (k.inside) throw new Error(`A ${A.value} is not allowed inside of a ${k.inside}(...)`);
            const G = !!A.spaces.before;
            return k.ignoreNextSpacing = k.lastWasSpacing ? A.value : !1, k.enforceNoSpacing = k.lastWasSpacing ? !1 : A.value, k.global = A.value === ":global", k.explicit = !0, G ? I.combinator({ value: " " }) : null;
          }
          break;
        }
        case "id":
        case "class": {
          if (!A.value) throw new Error("Invalid class or id selector syntax");
          if (k.global) break;
          const L = E.has(A.value);
          if (!L || L && k.explicit) {
            const F = A.clone();
            F.spaces = {
              before: "",
              after: ""
            }, A = I.pseudo({
              value: ":local",
              nodes: [F],
              spaces: A.spaces
            }), k.hasLocals = !0;
          }
          break;
        }
        case "nesting":
          A.value === "&" && (k.hasLocals = a.parent[n]);
      }
      return k.lastWasSpacing = !1, k.ignoreNextSpacing = !1, k.enforceNoSpacing = !1, A;
    }, S = {
      global: h === "global",
      hasPureGlobals: !1
    };
    return S.selector = I((A) => {
      w(A, S);
    }).processSync(a, {
      updateSelector: !1,
      lossless: !0
    }), S;
  }
  function p(a, h) {
    switch (a.type) {
      case "word":
        h.localizeNextItem && (h.localAliasMap.has(a.value) || (a.value = ":local(" + a.value + ")", h.localizeNextItem = !1));
        break;
      case "function":
        h.options && h.options.rewriteUrl && a.value.toLowerCase() === "url" && a.nodes.map((E) => {
          if (E.type !== "string" && E.type !== "word") return;
          let w = h.options.rewriteUrl(h.global, E.value);
          switch (E.type) {
            case "string":
              E.quote === "'" && (w = w.replace(/(\\)/g, "\\$1").replace(/'/g, "\\'")), E.quote === '"' && (w = w.replace(/(\\)/g, "\\$1").replace(/"/g, '\\"'));
              break;
            case "word":
              w = w.replace(/("|'|\)|\\)/g, "\\$1");
              break;
          }
          E.value = w;
        });
        break;
    }
    return a;
  }
  const b = [
    "none",
    "inherit",
    "initial",
    "revert",
    "revert-layer",
    "unset"
  ];
  function e(a, h, E) {
    const w = g(h.value);
    w.walk((S, A, k) => {
      if (S.type === "function" && (S.value.toLowerCase() === "var" || S.value.toLowerCase() === "env")) return !1;
      S.type === "word" && b.includes(S.value.toLowerCase()) || (k[A] = p(S, {
        options: E.options,
        global: E.global,
        localizeNextItem: a,
        localAliasMap: E.localAliasMap
      }));
    }), h.value = w.toString();
  }
  const v = /^-?([a-z\u0080-\uFFFF_]|(\\[^\r\n\f])|-(?![0-9]))((\\[^\r\n\f])|[a-z\u0080-\uFFFF_0-9-])*$/i, _ = {
    $normal: 1,
    $reverse: 1,
    $alternate: 1,
    "$alternate-reverse": 1,
    $forwards: 1,
    $backwards: 1,
    $both: 1,
    $infinite: 1,
    $paused: 1,
    $running: 1,
    $ease: 1,
    "$ease-in": 1,
    "$ease-out": 1,
    "$ease-in-out": 1,
    $linear: 1,
    "$step-end": 1,
    "$step-start": 1,
    $none: 1 / 0,
    $initial: 1 / 0,
    $inherit: 1 / 0,
    $unset: 1 / 0,
    $revert: 1 / 0,
    "$revert-layer": 1 / 0
  };
  function m(a, h) {
    if (/animation(-name)?$/i.test(a.prop)) {
      let E = {};
      a.value = g(a.value).walk((w) => {
        if (w.type === "div") {
          E = {};
          return;
        } else {
          if (w.type === "function" && w.value.toLowerCase() === "local" && w.nodes.length === 1)
            return w.type = "word", w.value = w.nodes[0].value, p(w, {
              options: h.options,
              global: h.global,
              localizeNextItem: !0,
              localAliasMap: h.localAliasMap
            });
          if (w.type === "function")
            return w.value.toLowerCase() === "global" && w.nodes.length === 1 && (w.type = "word", w.value = w.nodes[0].value), !1;
          if (w.type !== "word") return;
        }
        const S = w.type === "word" ? w.value.toLowerCase() : null;
        let A = !1;
        return S && v.test(S) && ("$" + S in _ ? (E["$" + S] = "$" + S in E ? E["$" + S] + 1 : 0, A = E["$" + S] >= _["$" + S]) : A = !0), p(w, {
          options: h.options,
          global: h.global,
          localizeNextItem: A && !h.global,
          localAliasMap: h.localAliasMap
        });
      }).toString();
      return;
    }
    if (/url\(/i.test(a.value)) return e(!1, a, h);
  }
  const y = (a, h) => !h.parent || h.type === "root" ? !a.hasPureGlobals : h.type === "rule" && h[n] ? h[n] || y(a, h.parent) : !a.hasPureGlobals || y(a, h.parent), O = (a) => a.nodes.length > 0 ? !a.nodes.every((h) => h.type === "rule" || h.type === "atrule" && !O(h)) : !0;
  u.exports = (a = {}) => {
    if (a && a.mode && a.mode !== "global" && a.mode !== "local" && a.mode !== "pure") throw new Error('options.mode must be either "global", "local" or "pure" (default "local")');
    const h = a && a.mode === "pure", E = a && a.mode === "global";
    return {
      postcssPlugin: "postcss-modules-local-by-default",
      prepare() {
        const w = /* @__PURE__ */ new Map();
        return { Once(S) {
          const { icssImports: A } = d(S, !1), k = h && !t(S);
          Object.keys(A).forEach((C) => {
            Object.keys(A[C]).forEach((L) => {
              w.set(L, A[C][L]);
            });
          }), S.walkAtRules((C) => {
            if (/keyframes$/i.test(C.name)) {
              const L = /^\s*:global\s*\((.+)\)\s*$/.exec(C.params), F = /^\s*:local\s*\((.+)\)\s*$/.exec(C.params);
              let B = E;
              if (L) {
                if (k) {
                  const G = r(C);
                  if (G) G.remove();
                  else throw C.error("@keyframes :global(...) is not allowed in pure mode");
                }
                C.params = L[1], B = !0;
              } else F ? (C.params = F[0], B = !1) : C.params && !E && !w.has(C.params) && (C.params = ":local(" + C.params + ")");
              C.walkDecls((G) => {
                m(G, {
                  localAliasMap: w,
                  options: a,
                  global: B
                });
              });
            } else if (/scope$/i.test(C.name)) {
              if (C.params) {
                const L = h ? r(C) : void 0;
                L && L.remove(), C.params = C.params.split("to").map((F) => {
                  const B = F.trim().slice(1, -1).trim(), G = l(B, a.mode, w);
                  if (G.options = a, G.localAliasMap = w, k && G.hasPureGlobals && !L) throw C.error('Selector in at-rule"' + B + '" is not pure (pure selectors must contain at least one local class or id)');
                  return `(${G.selector})`;
                }).join(" to ");
              }
              C.nodes.forEach((L) => {
                L.type === "decl" && m(L, {
                  localAliasMap: w,
                  options: a,
                  global: E
                });
              });
            } else C.nodes && C.nodes.forEach((L) => {
              L.type === "decl" && m(L, {
                localAliasMap: w,
                options: a,
                global: E
              });
            });
          }), S.walkRules((C) => {
            if (C.parent && C.parent.type === "atrule" && /keyframes$/i.test(C.parent.name)) return;
            const L = l(C, a.mode, w);
            L.options = a, L.localAliasMap = w;
            const F = k ? r(C) : void 0, B = k && !y(L, C);
            if (B && O(C) && !F) throw C.error('Selector "' + C.selector + '" is not pure (pure selectors must contain at least one local class or id)');
            F && F.remove(), h && (C[n] = !B), C.selector = L.selector, C.nodes && C.nodes.forEach((G) => m(G, L));
          });
        } };
      }
    };
  }, u.exports.postcss = !0;
})), Qt = /* @__PURE__ */ R(((i, u) => {
  const I = Ve(), g = Object.prototype.hasOwnProperty;
  function d(r) {
    return !r.parent || r.parent.type === "root" ? !1 : r.parent.type === "rule" ? !0 : d(r.parent);
  }
  function o(r, s) {
    if (d(s)) throw new Error(`composition is not allowed in nested rule 

${s}`);
    return r.nodes.map((n) => {
      if (n.type !== "selector" || n.nodes.length !== 1) throw new Error(`composition is only allowed when selector is single :local class name not in "${r}"`);
      if (n = n.nodes[0], n.type !== "pseudo" || n.value !== ":local" || n.nodes.length !== 1) throw new Error('composition is only allowed when selector is single :local class name not in "' + r + '", "' + n + '" is weird');
      if (n = n.first, n.type !== "selector" || n.length !== 1) throw new Error('composition is only allowed when selector is single :local class name not in "' + r + '", "' + n + '" is weird');
      if (n = n.first, n.type !== "class") throw new Error('composition is only allowed when selector is single :local class name not in "' + r + '", "' + n + '" is weird');
      return n.value;
    });
  }
  const c = new RegExp("\\\\([\\da-f]{1,6}[\\x20\\t\\r\\n\\f]?|([\\x20\\t\\r\\n\\f])|.)", "ig");
  function f(r) {
    return r.replace(c, (s, n, l) => {
      const p = "0x" + n - 65536;
      return p !== p || l ? n : p < 0 ? String.fromCharCode(p + 65536) : String.fromCharCode(p >> 10 | 55296, p & 1023 | 56320);
    });
  }
  const t = (r = {}) => {
    const s = r && r.generateScopedName || t.generateScopedName, n = r && r.generateExportEntry || t.generateExportEntry, l = r && r.exportGlobals;
    return {
      postcssPlugin: "postcss-modules-scope",
      Once(p, { rule: b }) {
        const e = /* @__PURE__ */ Object.create(null);
        function v(a, h, E) {
          const w = s(h || a, p.source.input.from, p.source.input.css, E), { key: S, value: A } = n(h || a, w, p.source.input.from, p.source.input.css, E);
          return e[S] = e[S] || [], e[S].indexOf(A) < 0 && e[S].push(A), w;
        }
        function _(a) {
          switch (a.type) {
            case "selector":
              return a.nodes = a.map((h) => _(h)), a;
            case "class":
              return I.className({ value: v(a.value, a.raws && a.raws.value ? a.raws.value : null, a) });
            case "id":
              return I.id({ value: v(a.value, a.raws && a.raws.value ? a.raws.value : null, a) });
            case "attribute":
              if (a.attribute === "class" && a.operator === "=") return I.attribute({
                attribute: a.attribute,
                operator: a.operator,
                quoteMark: "'",
                value: v(a.value, null, null)
              });
          }
          throw new Error(`${a.type} ("${a}") is not allowed in a :local block`);
        }
        function m(a) {
          switch (a.type) {
            case "pseudo":
              if (a.value === ":local") {
                if (a.nodes.length !== 1) throw new Error('Unexpected comma (",") in :local block');
                const h = _(a.first);
                h.first.spaces = a.spaces;
                const E = a.next();
                E && E.type === "combinator" && E.value === " " && /\\[A-F0-9]{1,6}$/.test(h.last.value) && (h.last.spaces.after = " "), a.replaceWith(h);
                return;
              }
            case "root":
            case "selector":
              a.each((h) => m(h));
              break;
            case "id":
            case "class":
              l && (e[a.value] = [a.value]);
              break;
          }
          return a;
        }
        const y = {};
        p.walkRules(/^:import\(.+\)$/, (a) => {
          a.walkDecls((h) => {
            y[h.prop] = !0;
          });
        }), p.walkRules((a) => {
          let h = I().astSync(a);
          a.selector = m(h.clone()).toString(), a.walkDecls(/^(composes|compose-with)$/i, (E) => {
            const w = o(h, E.parent);
            E.value.split(",").forEach((S) => {
              S.trim().split(/\s+/).forEach((A) => {
                const k = /^global\(([^)]+)\)$/.exec(A);
                if (k) w.forEach((C) => {
                  e[C].push(k[1]);
                });
                else if (g.call(y, A)) w.forEach((C) => {
                  e[C].push(A);
                });
                else if (g.call(e, A)) w.forEach((C) => {
                  e[A].forEach((L) => {
                    e[C].push(L);
                  });
                });
                else throw E.error(`referenced class name "${A}" in ${E.prop} not found`);
              });
            }), E.remove();
          }), a.walkDecls((E) => {
            if (!/:local\s*\((.+?)\)/.test(E.value)) return;
            let w = E.value.split(/(,|'[^']*'|"[^"]*")/);
            w = w.map((S, A) => {
              if (A === 0 || w[A - 1] === ",") {
                let k = S;
                const C = /:local\s*\((.+?)\)/.exec(S);
                if (C) {
                  const L = C.input, F = C[0], B = C[1], G = v(B);
                  k = L.replace(F, G);
                } else return S;
                return k;
              } else return S;
            }), E.value = w.join("");
          });
        }), p.walkAtRules(/keyframes$/i, (a) => {
          const h = /^\s*:local\s*\((.+?)\)\s*$/.exec(a.params);
          h && (a.params = v(h[1]));
        }), p.walkAtRules(/scope$/i, (a) => {
          a.params && (a.params = a.params.split("to").map((h) => {
            const E = h.trim().slice(1, -1).trim();
            return /^\s*:local\s*\((.+?)\)\s*$/.exec(E) ? `(${m(I().astSync(E)).toString()})` : `(${E})`;
          }).join(" to "));
        });
        const O = Object.keys(e);
        if (O.length > 0) {
          const a = b({ selector: ":export" });
          O.forEach((h) => a.append({
            prop: h,
            value: e[h].join(" "),
            raws: { before: `
  ` }
          })), p.append(a);
        }
      }
    };
  };
  t.postcss = !0, t.generateScopedName = function(r, s) {
    return `_${s.replace(/\.[^./\\]+$/, "").replace(/[\W_]+/g, "_").replace(/^_|_$/g, "")}__${r}`.trim();
  }, t.generateExportEntry = function(r, s) {
    return {
      key: f(r),
      value: f(s)
    };
  }, u.exports = t;
})), Rt = /* @__PURE__ */ R(((i, u) => {
  function I(g) {
    for (var d = 5381, o = g.length; o; ) d = d * 33 ^ g.charCodeAt(--o);
    return d >>> 0;
  }
  u.exports = I;
})), Ft = /* @__PURE__ */ R(((i, u) => {
  const I = be(), g = /^(.+?|\([\s\S]+?\))\s+from\s+("[^"]*"|'[^']*'|[\w-]+)$/, d = /(?:\s+|^)([\w-]+):?(.*?)$/, o = /^([\w-]+)(?:\s+as\s+([\w-]+))?/;
  u.exports = (c) => {
    let f = 0;
    const t = c && c.createImportedName || ((r) => `i__const_${r.replace(/\W/g, "_")}_${f++}`);
    return {
      postcssPlugin: "postcss-modules-values",
      prepare(r) {
        const s = [], n = {};
        return { Once(l, p) {
          if (l.walkAtRules(/value/i, (e) => {
            const v = e.params.match(g);
            if (v) {
              let [, O, a] = v;
              n[a] && (a = n[a]);
              const h = O.replace(/^\(\s*([\s\S]+)\s*\)$/, "$1").split(/\s*,\s*/).map((E) => {
                const w = o.exec(E);
                if (w) {
                  const [, S, A = S] = w, k = t(A);
                  return n[A] = k, {
                    theirName: S,
                    importedName: k
                  };
                } else throw new Error(`@import statement "${E}" is invalid!`);
              });
              s.push({
                path: a,
                imports: h
              }), e.remove();
              return;
            }
            e.params.indexOf("@value") !== -1 && r.warn("Invalid value definition: " + e.params);
            let [, _, m] = `${e.params}${e.raws.between}`.match(d);
            const y = m.replace(/\/\*((?!\*\/).*?)\*\//g, "");
            if (y.length === 0) {
              r.warn("Invalid value definition: " + e.params), e.remove();
              return;
            }
            /^\s+$/.test(y) || (m = m.trim()), n[_] = I.replaceValueSymbols(m, n), e.remove();
          }), !Object.keys(n).length) return;
          I.replaceSymbols(l, n);
          const b = Object.keys(n).map((e) => p.decl({
            value: n[e],
            prop: e,
            raws: { before: `
  ` }
          }));
          if (b.length > 0) {
            const e = p.rule({
              selector: ":export",
              raws: { after: `
` }
            });
            e.append(b), l.prepend(e);
          }
          s.reverse().forEach(({ path: e, imports: v }) => {
            const _ = p.rule({
              selector: `:import(${e})`,
              raws: { after: `
` }
            });
            v.forEach(({ theirName: m, importedName: y }) => {
              _.append({
                value: m,
                prop: y,
                raws: { before: `
  ` }
              });
            }), l.prepend(_);
          });
        } };
      }
    };
  }, u.exports.postcss = !0;
})), Ut = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.behaviours = void 0, i.getDefaultPlugins = r, i.getDefaultScopeBehaviour = n, i.getScopedNameGenerator = p;
  var u = f(_t()), I = f(wt()), g = f(qt()), d = f(Qt()), o = f(Rt()), c = f(Ft());
  function f(b) {
    return b && b.__esModule ? b : { default: b };
  }
  const t = {
    LOCAL: "local",
    GLOBAL: "global"
  };
  i.behaviours = t;
  function r({ behaviour: b, generateScopedName: e, exportGlobals: v }) {
    const _ = (0, d.default)({
      generateScopedName: e,
      exportGlobals: v
    });
    return {
      [t.LOCAL]: [
        c.default,
        (0, g.default)({ mode: "local" }),
        u.default,
        _
      ],
      [t.GLOBAL]: [
        c.default,
        (0, g.default)({ mode: "global" }),
        u.default,
        _
      ]
    }[b];
  }
  function s(b) {
    return Object.keys(t).map((e) => t[e]).indexOf(b) > -1;
  }
  function n(b) {
    return b && s(b) ? b : t.LOCAL;
  }
  function l(b, e, v) {
    const _ = v.indexOf(`.${b}`), m = v.substr(0, _).split(/[\r\n]/).length;
    return `_${b}_${(0, o.default)(v).toString(36).substr(0, 5)}_${m}`;
  }
  function p(b, e) {
    const v = b || l;
    return typeof v == "function" ? v : (0, I.default)(v, {
      context: process.cwd(),
      hashPrefix: e
    });
  }
})), xt = /* @__PURE__ */ R(((i) => {
  Object.defineProperty(i, "__esModule", { value: !0 }), i.makePlugin = b;
  var u = t(le("postcss")), I = t(lt()), g = t(Me()), d = t(vt()), o = gt(), c = t(At()), f = Ut();
  function t(e) {
    return e && e.__esModule ? e : { default: e };
  }
  const r = "postcss-modules";
  function s(e, v) {
    return e.some((_) => v.match(_));
  }
  function n(e, v) {
    const _ = e.globalModulePaths || null, m = e.exportGlobals || !1, y = (0, f.getDefaultScopeBehaviour)(e.scopeBehaviour), O = (0, f.getScopedNameGenerator)(e.generateScopedName, e.hashPrefix);
    return _ && s(_, v) ? (0, f.getDefaultPlugins)({
      behaviour: f.behaviours.GLOBAL,
      generateScopedName: O,
      exportGlobals: m
    }) : (0, f.getDefaultPlugins)({
      behaviour: y,
      generateScopedName: O,
      exportGlobals: m
    });
  }
  function l(e, v) {
    const _ = typeof e.root > "u" ? "/" : e.root;
    return typeof e.Loader == "function" ? new e.Loader(_, v, e.resolve) : new c.default(_, v, e.resolve);
  }
  function p(e) {
    return e.postcssPlugin === r;
  }
  function b(e) {
    return {
      postcssPlugin: r,
      async OnceExit(v, { result: _ }) {
        const m = e.getJSON || d.default, y = v.source.input.file, O = n(e, y), a = _.processor.plugins.findIndex((A) => p(A));
        if (a === -1) throw new Error("Plugin missing from options.");
        const h = l(e, [..._.processor.plugins.slice(0, a), ...O]), E = async (A, k, C) => {
          const L = (0, I.default)(A);
          return h.fetch.call(h, L, k, C);
        }, w = new g.default(E);
        await (0, u.default)([...O, w.plugin()]).process(v, { from: y });
        const S = h.finalSource;
        if (S && v.prepend(S), e.localsConvention) {
          const A = (0, o.makeLocalsConventionReducer)(e.localsConvention, y);
          w.exportTokens = Object.entries(w.exportTokens).reduce(A, {});
        }
        return _.messages.push({
          type: "export",
          plugin: "postcss-modules",
          exportTokens: w.exportTokens
        }), m(v.source.input.file, w.exportTokens, _.opts.to);
      }
    };
  }
})), Gt = /* @__PURE__ */ R(((i, u) => {
  var I = le("fs"), g = we(), d = xt();
  (0, g.setFileSystem)({
    readFile: I.readFile,
    writeFile: I.writeFile
  }), u.exports = (o = {}) => (0, d.makePlugin)(o), u.exports.postcss = !0;
}));
const zt = Gt();
export {
  zt as default
};
