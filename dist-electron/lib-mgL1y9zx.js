import { bD as q } from "./main-CEfjB-ow.js";
var S = /* @__PURE__ */ q(((P, y) => {
  var v = 40, h = 41, c = 39, d = 34, i = 92, u = 47, a = 44, o = 58, f = 42, l = 117, C = 85, m = 43, Q = /^[a-f0-9?-]+$/i;
  y.exports = function(R) {
    for (var A = [], s = R, e, _, k, r, I, w, x, U, t = 0, n = s.charCodeAt(t), N = s.length, g = [{ nodes: A }], E = 0, p, $ = "", b = "", O = ""; t < N; ) if (n <= 32) {
      e = t;
      do
        e += 1, n = s.charCodeAt(e);
      while (n <= 32);
      r = s.slice(t, e), k = A[A.length - 1], n === h && E ? O = r : k && k.type === "div" ? (k.after = r, k.sourceEndIndex += r.length) : n === a || n === o || n === u && s.charCodeAt(e + 1) !== f && (!p || p && p.type === "function" && p.value !== "calc") ? b = r : A.push({
        type: "space",
        sourceIndex: t,
        sourceEndIndex: e,
        value: r
      }), t = e;
    } else if (n === c || n === d) {
      e = t, _ = n === c ? "'" : '"', r = {
        type: "string",
        sourceIndex: t,
        quote: _
      };
      do
        if (I = !1, e = s.indexOf(_, e + 1), ~e)
          for (w = e; s.charCodeAt(w - 1) === i; )
            w -= 1, I = !I;
        else
          s += _, e = s.length - 1, r.unclosed = !0;
      while (I);
      r.value = s.slice(t + 1, e), r.sourceEndIndex = r.unclosed ? e : e + 1, A.push(r), t = e + 1, n = s.charCodeAt(t);
    } else if (n === u && s.charCodeAt(t + 1) === f)
      e = s.indexOf("*/", t), r = {
        type: "comment",
        sourceIndex: t,
        sourceEndIndex: e + 2
      }, e === -1 && (r.unclosed = !0, e = s.length, r.sourceEndIndex = e), r.value = s.slice(t + 2, e), A.push(r), t = e + 2, n = s.charCodeAt(t);
    else if ((n === u || n === f) && p && p.type === "function" && p.value === "calc")
      r = s[t], A.push({
        type: "word",
        sourceIndex: t - b.length,
        sourceEndIndex: t + r.length,
        value: r
      }), t += 1, n = s.charCodeAt(t);
    else if (n === u || n === a || n === o)
      r = s[t], A.push({
        type: "div",
        sourceIndex: t - b.length,
        sourceEndIndex: t + r.length,
        value: r,
        before: b,
        after: ""
      }), b = "", t += 1, n = s.charCodeAt(t);
    else if (v === n) {
      e = t;
      do
        e += 1, n = s.charCodeAt(e);
      while (n <= 32);
      if (U = t, r = {
        type: "function",
        sourceIndex: t - $.length,
        value: $,
        before: s.slice(U + 1, e)
      }, t = e, $ === "url" && n !== c && n !== d) {
        e -= 1;
        do
          if (I = !1, e = s.indexOf(")", e + 1), ~e)
            for (w = e; s.charCodeAt(w - 1) === i; )
              w -= 1, I = !I;
          else
            s += ")", e = s.length - 1, r.unclosed = !0;
        while (I);
        x = e;
        do
          x -= 1, n = s.charCodeAt(x);
        while (n <= 32);
        U < x ? (t !== x + 1 ? r.nodes = [{
          type: "word",
          sourceIndex: t,
          sourceEndIndex: x + 1,
          value: s.slice(t, x + 1)
        }] : r.nodes = [], r.unclosed && x + 1 !== e ? (r.after = "", r.nodes.push({
          type: "space",
          sourceIndex: x + 1,
          sourceEndIndex: e,
          value: s.slice(x + 1, e)
        })) : (r.after = s.slice(x + 1, e), r.sourceEndIndex = e)) : (r.after = "", r.nodes = []), t = e + 1, r.sourceEndIndex = r.unclosed ? e : t, n = s.charCodeAt(t), A.push(r);
      } else
        E += 1, r.after = "", r.sourceEndIndex = t + 1, A.push(r), g.push(r), A = r.nodes = [], p = r;
      $ = "";
    } else if (h === n && E)
      t += 1, n = s.charCodeAt(t), p.after = O, p.sourceEndIndex += O.length, O = "", E -= 1, g[g.length - 1].sourceEndIndex = t, g.pop(), p = g[E], A = p.nodes;
    else {
      e = t;
      do
        n === i && (e += 1), e += 1, n = s.charCodeAt(e);
      while (e < N && !(n <= 32 || n === c || n === d || n === a || n === o || n === u || n === v || n === f && p && p.type === "function" && p.value === "calc" || n === u && p.type === "function" && p.value === "calc" || n === h && E));
      r = s.slice(t, e), v === n ? $ = r : (l === r.charCodeAt(0) || C === r.charCodeAt(0)) && m === r.charCodeAt(1) && Q.test(r.slice(2)) ? A.push({
        type: "unicode-range",
        sourceIndex: t,
        sourceEndIndex: e,
        value: r
      }) : A.push({
        type: "word",
        sourceIndex: t,
        sourceEndIndex: e,
        value: r
      }), t = e;
    }
    for (t = g.length - 1; t; t -= 1)
      g[t].unclosed = !0, g[t].sourceEndIndex = s.length;
    return g[0].nodes;
  };
})), D = /* @__PURE__ */ q(((P, y) => {
  y.exports = function v(h, c, d) {
    var i, u, a, o;
    for (i = 0, u = h.length; i < u; i += 1)
      a = h[i], d || (o = c(a, i, h)), o !== !1 && a.type === "function" && Array.isArray(a.nodes) && v(a.nodes, c, d), d && c(a, i, h);
  };
})), J = /* @__PURE__ */ q(((P, y) => {
  function v(c, d) {
    var i = c.type, u = c.value, a, o;
    return d && (o = d(c)) !== void 0 ? o : i === "word" || i === "space" ? u : i === "string" ? (a = c.quote || "", a + u + (c.unclosed ? "" : a)) : i === "comment" ? "/*" + u + (c.unclosed ? "" : "*/") : i === "div" ? (c.before || "") + u + (c.after || "") : Array.isArray(c.nodes) ? (a = h(c.nodes, d), i !== "function" ? a : u + "(" + (c.before || "") + a + (c.after || "") + (c.unclosed ? "" : ")")) : u;
  }
  function h(c, d) {
    var i, u;
    if (Array.isArray(c)) {
      for (i = "", u = c.length - 1; ~u; u -= 1) i = v(c[u], d) + i;
      return i;
    }
    return v(c, d);
  }
  y.exports = h;
})), L = /* @__PURE__ */ q(((P, y) => {
  var v = 45, h = 43, c = 46, d = 101, i = 69;
  function u(a) {
    var o = a.charCodeAt(0), f;
    if (o === h || o === v) {
      if (f = a.charCodeAt(1), f >= 48 && f <= 57) return !0;
      var l = a.charCodeAt(2);
      return f === c && l >= 48 && l <= 57;
    }
    return o === c ? (f = a.charCodeAt(1), f >= 48 && f <= 57) : o >= 48 && o <= 57;
  }
  y.exports = function(a) {
    var o = 0, f = a.length, l, C, m;
    if (f === 0 || !u(a)) return !1;
    for (l = a.charCodeAt(o), (l === h || l === v) && o++; o < f && (l = a.charCodeAt(o), !(l < 48 || l > 57)); )
      o += 1;
    if (l = a.charCodeAt(o), C = a.charCodeAt(o + 1), l === c && C >= 48 && C <= 57)
      for (o += 2; o < f && (l = a.charCodeAt(o), !(l < 48 || l > 57)); )
        o += 1;
    if (l = a.charCodeAt(o), C = a.charCodeAt(o + 1), m = a.charCodeAt(o + 2), (l === d || l === i) && (C >= 48 && C <= 57 || (C === h || C === v) && m >= 48 && m <= 57))
      for (o += C === h || C === v ? 3 : 2; o < f && (l = a.charCodeAt(o), !(l < 48 || l > 57)); )
        o += 1;
    return {
      number: a.slice(0, o),
      unit: a.slice(o)
    };
  };
})), V = /* @__PURE__ */ q(((P, y) => {
  var v = S(), h = D(), c = J();
  function d(i) {
    return this instanceof d ? (this.nodes = v(i), this) : new d(i);
  }
  d.prototype.toString = function() {
    return Array.isArray(this.nodes) ? c(this.nodes) : "";
  }, d.prototype.walk = function(i, u) {
    return h(this.nodes, i, u), this;
  }, d.unit = L(), d.walk = h, d.stringify = c, y.exports = d;
}));
export {
  V as r
};
