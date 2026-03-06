import { bD as _, bE as C } from "./main-CEfjB-ow.js";
import { r as F } from "./lib-mgL1y9zx.js";
var E = /* @__PURE__ */ _(((I, w) => {
  w.exports = function(d, p, u) {
    const c = [];
    if (typeof d < "u") {
      let t = "layer";
      d && (t = `layer(${d})`), c.push(t);
    }
    return typeof u < "u" && c.push(`supports(${u})`), typeof p < "u" && c.push(p), c.join(" ");
  };
})), L = /* @__PURE__ */ _(((I, w) => {
  const m = E();
  w.exports = function(p, u) {
    if (!u?.length) return p;
    u.reverse();
    const c = u.pop();
    let t = `${p} ${m(c.layer, c.media, c.supports)}`;
    for (const e of u) t = `'data:text/css;base64,${Buffer.from(`@import ${t}`).toString("base64")}' ${m(e.layer, e.media, e.supports)}`;
    return t;
  };
})), D = /* @__PURE__ */ _(((I, w) => {
  const m = L();
  w.exports = function(p, u) {
    const c = p.findIndex((e) => e.type === "import"), t = p.findLastIndex((e) => e.type === "import");
    p.forEach((e, h) => {
      if (e.type === "charset" || e.type === "warning") return;
      if (e.type === "layer" && (h < t && e.conditions?.length || h > c && h < t)) {
        e.type = "import", e.node = e.node.clone({
          name: "import",
          params: m(`'data:text/css;base64,${Buffer.from(e.node.toString()).toString("base64")}'`, e.conditions)
        });
        return;
      }
      if (!e.conditions?.length) return;
      if (e.type === "import") {
        e.node.params = m(e.fullUri, e.conditions);
        return;
      }
      let r, o;
      e.type === "layer" ? (r = [e.node], o = e.node.parent) : (r = e.nodes, o = r[0].parent);
      const a = [];
      for (const i of e.conditions) {
        if (typeof i.media < "u") {
          const s = u({
            name: "media",
            params: i.media,
            source: o.source
          });
          a.push(s);
        }
        if (typeof i.supports < "u") {
          const s = u({
            name: "supports",
            params: `(${i.supports})`,
            source: o.source
          });
          a.push(s);
        }
        if (typeof i.layer < "u") {
          const s = u({
            name: "layer",
            params: i.layer,
            source: o.source
          });
          a.push(s);
        }
      }
      const n = a.shift(), f = a.reduce((i, s) => (i.append(s), s), n);
      o.insertBefore(r[0], n), r.forEach((i) => {
        i.parent = void 0;
      }), r[0].raws.before = r[0].raws.before || `
`, f.append(r), e.type = "nodes", e.nodes = [n], delete e.node;
    });
  };
})), P = /* @__PURE__ */ _(((I, w) => {
  w.exports = function(d) {
    d.forEach((p, u) => {
      if (u !== 0)
        if (p.parent) {
          const { before: c } = p.parent.node.raws;
          p.type === "nodes" ? p.nodes[0].raws.before = c : p.node.raws.before = c;
        } else p.type === "nodes" && (p.nodes[0].raws.before = p.nodes[0].raws.before || `
`);
    });
  };
})), k = /* @__PURE__ */ _(((I, w) => {
  w.exports = function(d, p) {
    p.nodes = [], d.forEach((u) => {
      [
        "charset",
        "import",
        "layer"
      ].includes(u.type) ? (u.node.parent = void 0, p.append(u.node)) : u.type === "nodes" && u.nodes.forEach((c) => {
        c.parent = void 0, p.append(c);
      });
    });
  };
})), A = /* @__PURE__ */ _(((I, w) => {
  const m = /^data:text\/css(?:;(base64|plain))?,/i, d = /^data:text\/css;base64,/i, p = /^data:text\/css;plain,/i;
  function u(t) {
    return m.test(t);
  }
  function c(t) {
    return d.test(t) ? Buffer.from(t.slice(21), "base64").toString() : p.test(t) ? decodeURIComponent(t.slice(20)) : decodeURIComponent(t.slice(14));
  }
  w.exports = {
    isValid: u,
    contents: c
  };
})), M = /* @__PURE__ */ _(((I, w) => {
  const m = F(), { stringify: d } = m;
  w.exports = function(e, h, r, o) {
    const a = [];
    let n = [], f = !1;
    return h.each((i) => {
      let s;
      i.type === "atrule" ? i.name === "import" ? s = u(e, i, r, o) : i.name === "charset" ? s = p(e, i, r, o) : i.name === "layer" && !f && !i.nodes && (s = c(e, i, r, o)) : i.type !== "comment" && (f = !0), s ? (n.length && (a.push({
        type: "nodes",
        nodes: n,
        conditions: [...r],
        from: o
      }), n = []), a.push(s)) : n.push(i);
    }), n.length && a.push({
      type: "nodes",
      nodes: n,
      conditions: [...r],
      from: o
    }), a;
  };
  function p(t, e, h, r) {
    return e.prev() ? t.warn("@charset must precede all other statements", { node: e }) : {
      type: "charset",
      node: e,
      conditions: [...h],
      from: r
    };
  }
  function u(t, e, h, r) {
    let o = e.prev();
    if (o) do {
      if (o.type === "comment" || o.type === "atrule" && o.name === "import") {
        o = o.prev();
        continue;
      }
      break;
    } while (o);
    if (o) do {
      if (o.type === "comment" || o.type === "atrule" && (o.name === "charset" || o.name === "layer" && !o.nodes)) {
        o = o.prev();
        continue;
      }
      return t.warn("@import must precede all other statements (besides @charset or empty @layer)", { node: e });
    } while (o);
    if (e.nodes) return t.warn("It looks like you didn't end your @import statement correctly. Child nodes are attached to it.", { node: e });
    const a = m(e.params).nodes, n = {
      type: "import",
      uri: "",
      fullUri: "",
      node: e,
      conditions: [...h],
      from: r
    };
    let f, i, s;
    for (let b = 0; b < a.length; b++) {
      const l = a[b];
      if (!(l.type === "space" || l.type === "comment")) {
        if (l.type === "string") {
          if (n.uri) return t.warn(`Multiple url's in '${e.toString()}'`, { node: e });
          if (!l.value) return t.warn(`Unable to find uri in '${e.toString()}'`, { node: e });
          n.uri = l.value, n.fullUri = d(l);
          continue;
        }
        if (l.type === "function" && /^url$/i.test(l.value)) {
          if (n.uri) return t.warn(`Multiple url's in '${e.toString()}'`, { node: e });
          if (!l.nodes?.[0]?.value) return t.warn(`Unable to find uri in '${e.toString()}'`, { node: e });
          n.uri = l.nodes[0].value, n.fullUri = d(l);
          continue;
        }
        if (!n.uri) return t.warn(`Unable to find uri in '${e.toString()}'`, { node: e });
        if ((l.type === "word" || l.type === "function") && /^layer$/i.test(l.value)) {
          if (typeof f < "u") return t.warn(`Multiple layers in '${e.toString()}'`, { node: e });
          if (typeof s < "u") return t.warn(`layers must be defined before support conditions in '${e.toString()}'`, { node: e });
          l.nodes ? f = d(l.nodes) : f = "";
          continue;
        }
        if (l.type === "function" && /^supports$/i.test(l.value)) {
          if (typeof s < "u") return t.warn(`Multiple support conditions in '${e.toString()}'`, { node: e });
          s = d(l.nodes);
          continue;
        }
        i = d(a.slice(b));
        break;
      }
    }
    return n.uri ? ((typeof i < "u" || typeof f < "u" || typeof s < "u") && n.conditions.push({
      layer: f,
      media: i,
      supports: s
    }), n) : t.warn(`Unable to find uri in '${e.toString()}'`, { node: e });
  }
  function c(t, e, h, r) {
    return {
      type: "layer",
      node: e,
      conditions: [...h],
      from: r
    };
  }
})), B = /* @__PURE__ */ _(((I, w) => {
  const m = C("path");
  let d;
  w.exports = function(c, t, e, h, r) {
    const { plugins: o } = h, a = m.extname(e), n = [];
    if (a === ".sss") {
      if (!d)
        try {
          d = C("sugarss");
        } catch {
        }
      if (d) return p(r, t, e, o, [d]);
    }
    return c.opts.syntax?.parse && n.push(c.opts.syntax.parse), c.opts.parser && n.push(c.opts.parser), n.push(null), p(r, t, e, o, n);
  };
  function p(u, c, t, e, h, r) {
    return r || (r = 0), u(e).process(c, {
      from: t,
      parser: h[r]
    }).catch((o) => {
      if (r++, r === h.length) throw o;
      return p(u, c, t, e, h, r);
    });
  }
})), N = /* @__PURE__ */ _(((I, w) => {
  const m = C("path"), d = A(), p = M(), u = B(), c = (a) => a, t = E();
  async function e(a, n, f, i, s, b, l) {
    const S = p(a, n, s, b);
    for (const y of S)
      y.type !== "import" || !o(y.uri) || f.filter && !f.filter(y.uri) || await h(a, y, f, i, l);
    let x;
    const v = [], $ = [];
    function U(y) {
      if (!x) x = y;
      else if (y.node.params.toLowerCase() !== x.node.params.toLowerCase()) throw y.node.error(`Incompatible @charset statements:
  ${y.node.params} specified in ${y.node.source.input.file}
  ${x.node.params} specified in ${x.node.source.input.file}`);
    }
    return S.forEach((y) => {
      y.type === "charset" ? U(y) : y.type === "import" ? y.children ? y.children.forEach((g, q) => {
        g.type === "import" || g.type === "layer" ? v.push(g) : g.type === "charset" ? U(g) : $.push(g), q === 0 && (g.parent = y);
      }) : v.push(y) : y.type === "layer" ? v.push(y) : y.type === "nodes" && $.push(y);
    }), x ? [x, ...v.concat($)] : v.concat($);
  }
  async function h(a, n, f, i, s) {
    if (d.isValid(n.uri)) {
      n.children = await r(a, n, n.uri, f, i, s);
      return;
    } else if (d.isValid(n.from.slice(-1))) throw n.node.error(`Unable to import '${n.uri}' from a stylesheet that is embedded in a data url`);
    const b = n.node;
    let l;
    b.source?.input?.file && (l = b.source.input.file);
    const S = l ? m.dirname(b.source.input.file) : f.root, x = [await f.resolve(n.uri, S, f, b)].flat(), v = await Promise.all(x.map(($) => m.isAbsolute($) ? $ : c($)));
    v.forEach(($) => {
      a.messages.push({
        type: "dependency",
        plugin: "postcss-import",
        file: $,
        parent: l
      });
    }), n.children = (await Promise.all(v.map(($) => r(a, n, $, f, i, s)))).flat().filter(($) => !!$);
  }
  async function r(a, n, f, i, s, b) {
    const l = n.node, { conditions: S, from: x } = n, v = S.map((g) => t(g.layer, g.media, g.supports)).join(":");
    if (i.skipDuplicates) {
      if (s.importedFiles[f]?.[v]) return;
      s.importedFiles[f] || (s.importedFiles[f] = {}), s.importedFiles[f][v] = !0;
    }
    if (x.includes(f)) return;
    const $ = await i.load(f, i);
    if ($.trim() === "" && i.warnOnEmpty) {
      a.warn(`${f} is empty`, { node: l });
      return;
    }
    if (i.skipDuplicates && s.hashFiles[$]?.[v]) return;
    const U = await u(a, $, f, i, b), y = U.root;
    return a.messages = a.messages.concat(U.messages), i.skipDuplicates && (y.some((g) => g.type === "atrule" && g.name === "import") || (s.hashFiles[$] || (s.hashFiles[$] = {}), s.hashFiles[$][v] = !0)), e(a, y, i, s, S, [...x, f], b);
  }
  function o(a) {
    if (/^(?:[a-z]+:)?\/\//i.test(a)) return !1;
    try {
      if (new URL(a, "https://example.com").search) return !1;
    } catch {
    }
    return !0;
  }
  w.exports = e;
})), O = /* @__PURE__ */ _(((I, w) => {
  const m = C("path"), d = D(), p = P(), u = k(), c = () => "", t = N(), e = (r) => r;
  function h(r) {
    return r = {
      root: process.cwd(),
      path: [],
      skipDuplicates: !0,
      resolve: e,
      load: c,
      plugins: [],
      addModulesDirectories: [],
      warnOnEmpty: !0,
      ...r
    }, r.root = m.resolve(r.root), typeof r.path == "string" && (r.path = [r.path]), Array.isArray(r.path) || (r.path = []), r.path = r.path.map((o) => m.resolve(r.root, o)), {
      postcssPlugin: "postcss-import",
      async Once(o, { result: a, atRule: n, postcss: f }) {
        const i = {
          importedFiles: {},
          hashFiles: {}
        };
        if (o.source?.input?.file && (i.importedFiles[o.source.input.file] = {}), r.plugins && !Array.isArray(r.plugins)) throw new Error("plugins option must be an array");
        const s = await t(a, o, r, i, [], [], f);
        p(s), d(s, n), u(s, o);
      }
    };
  }
  h.postcss = !0, w.exports = h;
}));
const z = O();
export {
  z as default
};
