import st from "node:http";
import hi from "node:https";
import He from "node:zlib";
import ne, { PassThrough as Ut, pipeline as Qe } from "node:stream";
import { Buffer as L } from "node:buffer";
import { types as Nt, deprecate as Vt, promisify as mi } from "node:util";
import { c as lo } from "./index-DxKz1Ylh.js";
import { format as bi } from "node:url";
import { isIP as pi } from "node:net";
import { promises as yi } from "node:fs";
import "node:path";
function _i(s) {
  if (!/^data:/i.test(s))
    throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');
  s = s.replace(/\r?\n/g, "");
  const n = s.indexOf(",");
  if (n === -1 || n <= 4)
    throw new TypeError("malformed data: URI");
  const a = s.substring(5, n).split(";");
  let u = "", l = !1;
  const h = a[0] || "text/plain";
  let c = h;
  for (let E = 1; E < a.length; E++)
    a[E] === "base64" ? l = !0 : a[E] && (c += `;${a[E]}`, a[E].indexOf("charset=") === 0 && (u = a[E].substring(8)));
  !a[0] && !u.length && (c += ";charset=US-ASCII", u = "US-ASCII");
  const P = l ? "base64" : "ascii", v = unescape(s.substring(n + 1)), S = Buffer.from(v, P);
  return S.type = h, S.typeFull = c, S.charset = u, S;
}
var uo = {}, at = { exports: {} };
var gi = at.exports, fo;
function Si() {
  return fo || (fo = 1, (function(s, n) {
    (function(a, u) {
      u(n);
    })(gi, (function(a) {
      function u() {
      }
      function l(e) {
        return typeof e == "object" && e !== null || typeof e == "function";
      }
      const h = u;
      function c(e, t) {
        try {
          Object.defineProperty(e, "name", {
            value: t,
            configurable: !0
          });
        } catch {
        }
      }
      const P = Promise, v = Promise.prototype.then, S = Promise.reject.bind(P);
      function E(e) {
        return new P(e);
      }
      function w(e) {
        return E((t) => t(e));
      }
      function m(e) {
        return S(e);
      }
      function W(e, t, r) {
        return v.call(e, t, r);
      }
      function y(e, t, r) {
        W(W(e, t, r), void 0, h);
      }
      function N(e, t) {
        y(e, t);
      }
      function k(e, t) {
        y(e, void 0, t);
      }
      function O(e, t, r) {
        return W(e, t, r);
      }
      function x(e) {
        W(e, void 0, h);
      }
      let oe = (e) => {
        if (typeof queueMicrotask == "function")
          oe = queueMicrotask;
        else {
          const t = w(void 0);
          oe = (r) => W(t, r);
        }
        return oe(e);
      };
      function q(e, t, r) {
        if (typeof e != "function")
          throw new TypeError("Argument is not a function");
        return Function.prototype.apply.call(e, t, r);
      }
      function I(e, t, r) {
        try {
          return w(q(e, t, r));
        } catch (o) {
          return m(o);
        }
      }
      const D = 16384;
      class j {
        constructor() {
          this._cursor = 0, this._size = 0, this._front = {
            _elements: [],
            _next: void 0
          }, this._back = this._front, this._cursor = 0, this._size = 0;
        }
        get length() {
          return this._size;
        }
        // For exception safety, this method is structured in order:
        // 1. Read state
        // 2. Calculate required state mutations
        // 3. Perform state mutations
        push(t) {
          const r = this._back;
          let o = r;
          r._elements.length === D - 1 && (o = {
            _elements: [],
            _next: void 0
          }), r._elements.push(t), o !== r && (this._back = o, r._next = o), ++this._size;
        }
        // Like push(), shift() follows the read -> calculate -> mutate pattern for
        // exception safety.
        shift() {
          const t = this._front;
          let r = t;
          const o = this._cursor;
          let i = o + 1;
          const f = t._elements, d = f[o];
          return i === D && (r = t._next, i = 0), --this._size, this._cursor = i, t !== r && (this._front = r), f[o] = void 0, d;
        }
        // The tricky thing about forEach() is that it can be called
        // re-entrantly. The queue may be mutated inside the callback. It is easy to
        // see that push() within the callback has no negative effects since the end
        // of the queue is checked for on every iteration. If shift() is called
        // repeatedly within the callback then the next iteration may return an
        // element that has been removed. In this case the callback will be called
        // with undefined values until we either "catch up" with elements that still
        // exist or reach the back of the queue.
        forEach(t) {
          let r = this._cursor, o = this._front, i = o._elements;
          for (; (r !== i.length || o._next !== void 0) && !(r === i.length && (o = o._next, i = o._elements, r = 0, i.length === 0)); )
            t(i[r]), ++r;
        }
        // Return the element that would be returned if shift() was called now,
        // without modifying the queue.
        peek() {
          const t = this._front, r = this._cursor;
          return t._elements[r];
        }
      }
      const ft = /* @__PURE__ */ Symbol("[[AbortSteps]]"), xr = /* @__PURE__ */ Symbol("[[ErrorSteps]]"), Gt = /* @__PURE__ */ Symbol("[[CancelSteps]]"), Zt = /* @__PURE__ */ Symbol("[[PullSteps]]"), Kt = /* @__PURE__ */ Symbol("[[ReleaseSteps]]");
      function Hr(e, t) {
        e._ownerReadableStream = t, t._reader = e, t._state === "readable" ? Xt(e) : t._state === "closed" ? Co(e) : Qr(e, t._storedError);
      }
      function Jt(e, t) {
        const r = e._ownerReadableStream;
        return K(r, t);
      }
      function ae(e) {
        const t = e._ownerReadableStream;
        t._state === "readable" ? er(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : To(e, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")), t._readableStreamController[Kt](), t._reader = void 0, e._ownerReadableStream = void 0;
      }
      function dt(e) {
        return new TypeError("Cannot " + e + " a stream using a released reader");
      }
      function Xt(e) {
        e._closedPromise = E((t, r) => {
          e._closedPromise_resolve = t, e._closedPromise_reject = r;
        });
      }
      function Qr(e, t) {
        Xt(e), er(e, t);
      }
      function Co(e) {
        Xt(e), Vr(e);
      }
      function er(e, t) {
        e._closedPromise_reject !== void 0 && (x(e._closedPromise), e._closedPromise_reject(t), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0);
      }
      function To(e, t) {
        Qr(e, t);
      }
      function Vr(e) {
        e._closedPromise_resolve !== void 0 && (e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0);
      }
      const Yr = Number.isFinite || function(e) {
        return typeof e == "number" && isFinite(e);
      }, Po = Math.trunc || function(e) {
        return e < 0 ? Math.ceil(e) : Math.floor(e);
      };
      function Eo(e) {
        return typeof e == "object" || typeof e == "function";
      }
      function ee(e, t) {
        if (e !== void 0 && !Eo(e))
          throw new TypeError(`${t} is not an object.`);
      }
      function V(e, t) {
        if (typeof e != "function")
          throw new TypeError(`${t} is not a function.`);
      }
      function vo(e) {
        return typeof e == "object" && e !== null || typeof e == "function";
      }
      function Gr(e, t) {
        if (!vo(e))
          throw new TypeError(`${t} is not an object.`);
      }
      function ie(e, t, r) {
        if (e === void 0)
          throw new TypeError(`Parameter ${t} is required in '${r}'.`);
      }
      function tr(e, t, r) {
        if (e === void 0)
          throw new TypeError(`${t} is required in '${r}'.`);
      }
      function rr(e) {
        return Number(e);
      }
      function Zr(e) {
        return e === 0 ? 0 : e;
      }
      function Ao(e) {
        return Zr(Po(e));
      }
      function nr(e, t) {
        const o = Number.MAX_SAFE_INTEGER;
        let i = Number(e);
        if (i = Zr(i), !Yr(i))
          throw new TypeError(`${t} is not a finite number`);
        if (i = Ao(i), i < 0 || i > o)
          throw new TypeError(`${t} is outside the accepted range of 0 to ${o}, inclusive`);
        return !Yr(i) || i === 0 ? 0 : i;
      }
      function or(e, t) {
        if (!Se(e))
          throw new TypeError(`${t} is not a ReadableStream.`);
      }
      function Oe(e) {
        return new me(e);
      }
      function Kr(e, t) {
        e._reader._readRequests.push(t);
      }
      function ar(e, t, r) {
        const i = e._reader._readRequests.shift();
        r ? i._closeSteps() : i._chunkSteps(t);
      }
      function ct(e) {
        return e._reader._readRequests.length;
      }
      function Jr(e) {
        const t = e._reader;
        return !(t === void 0 || !be(t));
      }
      class me {
        constructor(t) {
          if (ie(t, 1, "ReadableStreamDefaultReader"), or(t, "First parameter"), we(t))
            throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          Hr(this, t), this._readRequests = new j();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed,
         * or rejected if the stream ever errors or the reader's lock is released before the stream finishes closing.
         */
        get closed() {
          return be(this) ? this._closedPromise : m(ht("closed"));
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */
        cancel(t = void 0) {
          return be(this) ? this._ownerReadableStream === void 0 ? m(dt("cancel")) : Jt(this, t) : m(ht("cancel"));
        }
        /**
         * Returns a promise that allows access to the next chunk from the stream's internal queue, if available.
         *
         * If reading a chunk causes the queue to become empty, more data will be pulled from the underlying source.
         */
        read() {
          if (!be(this))
            return m(ht("read"));
          if (this._ownerReadableStream === void 0)
            return m(dt("read from"));
          let t, r;
          const o = E((f, d) => {
            t = f, r = d;
          });
          return Ye(this, {
            _chunkSteps: (f) => t({ value: f, done: !1 }),
            _closeSteps: () => t({ value: void 0, done: !0 }),
            _errorSteps: (f) => r(f)
          }), o;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamDefaultReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */
        releaseLock() {
          if (!be(this))
            throw ht("releaseLock");
          this._ownerReadableStream !== void 0 && Bo(this);
        }
      }
      Object.defineProperties(me.prototype, {
        cancel: { enumerable: !0 },
        read: { enumerable: !0 },
        releaseLock: { enumerable: !0 },
        closed: { enumerable: !0 }
      }), c(me.prototype.cancel, "cancel"), c(me.prototype.read, "read"), c(me.prototype.releaseLock, "releaseLock"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(me.prototype, Symbol.toStringTag, {
        value: "ReadableStreamDefaultReader",
        configurable: !0
      });
      function be(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_readRequests") ? !1 : e instanceof me;
      }
      function Ye(e, t) {
        const r = e._ownerReadableStream;
        r._disturbed = !0, r._state === "closed" ? t._closeSteps() : r._state === "errored" ? t._errorSteps(r._storedError) : r._readableStreamController[Zt](t);
      }
      function Bo(e) {
        ae(e);
        const t = new TypeError("Reader was released");
        Xr(e, t);
      }
      function Xr(e, t) {
        const r = e._readRequests;
        e._readRequests = new j(), r.forEach((o) => {
          o._errorSteps(t);
        });
      }
      function ht(e) {
        return new TypeError(`ReadableStreamDefaultReader.prototype.${e} can only be used on a ReadableStreamDefaultReader`);
      }
      const Wo = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {
      }).prototype);
      class en {
        constructor(t, r) {
          this._ongoingPromise = void 0, this._isFinished = !1, this._reader = t, this._preventCancel = r;
        }
        next() {
          const t = () => this._nextSteps();
          return this._ongoingPromise = this._ongoingPromise ? O(this._ongoingPromise, t, t) : t(), this._ongoingPromise;
        }
        return(t) {
          const r = () => this._returnSteps(t);
          return this._ongoingPromise ? O(this._ongoingPromise, r, r) : r();
        }
        _nextSteps() {
          if (this._isFinished)
            return Promise.resolve({ value: void 0, done: !0 });
          const t = this._reader;
          let r, o;
          const i = E((d, b) => {
            r = d, o = b;
          });
          return Ye(t, {
            _chunkSteps: (d) => {
              this._ongoingPromise = void 0, oe(() => r({ value: d, done: !1 }));
            },
            _closeSteps: () => {
              this._ongoingPromise = void 0, this._isFinished = !0, ae(t), r({ value: void 0, done: !0 });
            },
            _errorSteps: (d) => {
              this._ongoingPromise = void 0, this._isFinished = !0, ae(t), o(d);
            }
          }), i;
        }
        _returnSteps(t) {
          if (this._isFinished)
            return Promise.resolve({ value: t, done: !0 });
          this._isFinished = !0;
          const r = this._reader;
          if (!this._preventCancel) {
            const o = Jt(r, t);
            return ae(r), O(o, () => ({ value: t, done: !0 }));
          }
          return ae(r), w({ value: t, done: !0 });
        }
      }
      const tn = {
        next() {
          return rn(this) ? this._asyncIteratorImpl.next() : m(nn("next"));
        },
        return(e) {
          return rn(this) ? this._asyncIteratorImpl.return(e) : m(nn("return"));
        }
      };
      Object.setPrototypeOf(tn, Wo);
      function qo(e, t) {
        const r = Oe(e), o = new en(r, t), i = Object.create(tn);
        return i._asyncIteratorImpl = o, i;
      }
      function rn(e) {
        if (!l(e) || !Object.prototype.hasOwnProperty.call(e, "_asyncIteratorImpl"))
          return !1;
        try {
          return e._asyncIteratorImpl instanceof en;
        } catch {
          return !1;
        }
      }
      function nn(e) {
        return new TypeError(`ReadableStreamAsyncIterator.${e} can only be used on a ReadableSteamAsyncIterator`);
      }
      const on = Number.isNaN || function(e) {
        return e !== e;
      };
      var ir, sr, lr;
      function Ge(e) {
        return e.slice();
      }
      function an(e, t, r, o, i) {
        new Uint8Array(e).set(new Uint8Array(r, o, i), t);
      }
      let se = (e) => (typeof e.transfer == "function" ? se = (t) => t.transfer() : typeof structuredClone == "function" ? se = (t) => structuredClone(t, { transfer: [t] }) : se = (t) => t, se(e)), pe = (e) => (typeof e.detached == "boolean" ? pe = (t) => t.detached : pe = (t) => t.byteLength === 0, pe(e));
      function sn(e, t, r) {
        if (e.slice)
          return e.slice(t, r);
        const o = r - t, i = new ArrayBuffer(o);
        return an(i, 0, e, t, o), i;
      }
      function mt(e, t) {
        const r = e[t];
        if (r != null) {
          if (typeof r != "function")
            throw new TypeError(`${String(t)} is not a function`);
          return r;
        }
      }
      function ko(e) {
        const t = {
          [Symbol.iterator]: () => e.iterator
        }, r = (async function* () {
          return yield* t;
        })(), o = r.next;
        return { iterator: r, nextMethod: o, done: !1 };
      }
      const ur = (lr = (ir = Symbol.asyncIterator) !== null && ir !== void 0 ? ir : (sr = Symbol.for) === null || sr === void 0 ? void 0 : sr.call(Symbol, "Symbol.asyncIterator")) !== null && lr !== void 0 ? lr : "@@asyncIterator";
      function ln(e, t = "sync", r) {
        if (r === void 0)
          if (t === "async") {
            if (r = mt(e, ur), r === void 0) {
              const f = mt(e, Symbol.iterator), d = ln(e, "sync", f);
              return ko(d);
            }
          } else
            r = mt(e, Symbol.iterator);
        if (r === void 0)
          throw new TypeError("The object is not iterable");
        const o = q(r, e, []);
        if (!l(o))
          throw new TypeError("The iterator method must return an object");
        const i = o.next;
        return { iterator: o, nextMethod: i, done: !1 };
      }
      function Oo(e) {
        const t = q(e.nextMethod, e.iterator, []);
        if (!l(t))
          throw new TypeError("The iterator.next() method must return an object");
        return t;
      }
      function Io(e) {
        return !!e.done;
      }
      function zo(e) {
        return e.value;
      }
      function Fo(e) {
        return !(typeof e != "number" || on(e) || e < 0);
      }
      function un(e) {
        const t = sn(e.buffer, e.byteOffset, e.byteOffset + e.byteLength);
        return new Uint8Array(t);
      }
      function fr(e) {
        const t = e._queue.shift();
        return e._queueTotalSize -= t.size, e._queueTotalSize < 0 && (e._queueTotalSize = 0), t.value;
      }
      function dr(e, t, r) {
        if (!Fo(r) || r === 1 / 0)
          throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
        e._queue.push({ value: t, size: r }), e._queueTotalSize += r;
      }
      function Lo(e) {
        return e._queue.peek().value;
      }
      function ye(e) {
        e._queue = new j(), e._queueTotalSize = 0;
      }
      function fn(e) {
        return e === DataView;
      }
      function Do(e) {
        return fn(e.constructor);
      }
      function jo(e) {
        return fn(e) ? 1 : e.BYTES_PER_ELEMENT;
      }
      class Te {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        /**
         * Returns the view for writing in to, or `null` if the BYOB request has already been responded to.
         */
        get view() {
          if (!cr(this))
            throw yr("view");
          return this._view;
        }
        respond(t) {
          if (!cr(this))
            throw yr("respond");
          if (ie(t, 1, "respond"), t = nr(t, "First parameter"), this._associatedReadableByteStreamController === void 0)
            throw new TypeError("This BYOB request has been invalidated");
          if (pe(this._view.buffer))
            throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");
          _t(this._associatedReadableByteStreamController, t);
        }
        respondWithNewView(t) {
          if (!cr(this))
            throw yr("respondWithNewView");
          if (ie(t, 1, "respondWithNewView"), !ArrayBuffer.isView(t))
            throw new TypeError("You can only respond with array buffer views");
          if (this._associatedReadableByteStreamController === void 0)
            throw new TypeError("This BYOB request has been invalidated");
          if (pe(t.buffer))
            throw new TypeError("The given view's buffer has been detached and so cannot be used as a response");
          gt(this._associatedReadableByteStreamController, t);
        }
      }
      Object.defineProperties(Te.prototype, {
        respond: { enumerable: !0 },
        respondWithNewView: { enumerable: !0 },
        view: { enumerable: !0 }
      }), c(Te.prototype.respond, "respond"), c(Te.prototype.respondWithNewView, "respondWithNewView"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(Te.prototype, Symbol.toStringTag, {
        value: "ReadableStreamBYOBRequest",
        configurable: !0
      });
      class le {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        /**
         * Returns the current BYOB pull request, or `null` if there isn't one.
         */
        get byobRequest() {
          if (!Pe(this))
            throw Ke("byobRequest");
          return pr(this);
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying byte source ought to use this information to determine when and how to apply backpressure.
         */
        get desiredSize() {
          if (!Pe(this))
            throw Ke("desiredSize");
          return Sn(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */
        close() {
          if (!Pe(this))
            throw Ke("close");
          if (this._closeRequested)
            throw new TypeError("The stream has already been closed; do not close it again!");
          const t = this._controlledReadableByteStream._state;
          if (t !== "readable")
            throw new TypeError(`The stream (in ${t} state) is not in the readable state and cannot be closed`);
          Ze(this);
        }
        enqueue(t) {
          if (!Pe(this))
            throw Ke("enqueue");
          if (ie(t, 1, "enqueue"), !ArrayBuffer.isView(t))
            throw new TypeError("chunk must be an array buffer view");
          if (t.byteLength === 0)
            throw new TypeError("chunk must have non-zero byteLength");
          if (t.buffer.byteLength === 0)
            throw new TypeError("chunk's buffer must have non-zero byteLength");
          if (this._closeRequested)
            throw new TypeError("stream is closed or draining");
          const r = this._controlledReadableByteStream._state;
          if (r !== "readable")
            throw new TypeError(`The stream (in ${r} state) is not in the readable state and cannot be enqueued to`);
          yt(this, t);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */
        error(t = void 0) {
          if (!Pe(this))
            throw Ke("error");
          Y(this, t);
        }
        /** @internal */
        [Gt](t) {
          dn(this), ye(this);
          const r = this._cancelAlgorithm(t);
          return pt(this), r;
        }
        /** @internal */
        [Zt](t) {
          const r = this._controlledReadableByteStream;
          if (this._queueTotalSize > 0) {
            gn(this, t);
            return;
          }
          const o = this._autoAllocateChunkSize;
          if (o !== void 0) {
            let i;
            try {
              i = new ArrayBuffer(o);
            } catch (d) {
              t._errorSteps(d);
              return;
            }
            const f = {
              buffer: i,
              bufferByteLength: o,
              byteOffset: 0,
              byteLength: o,
              bytesFilled: 0,
              minimumFill: 1,
              elementSize: 1,
              viewConstructor: Uint8Array,
              readerType: "default"
            };
            this._pendingPullIntos.push(f);
          }
          Kr(r, t), Ee(this);
        }
        /** @internal */
        [Kt]() {
          if (this._pendingPullIntos.length > 0) {
            const t = this._pendingPullIntos.peek();
            t.readerType = "none", this._pendingPullIntos = new j(), this._pendingPullIntos.push(t);
          }
        }
      }
      Object.defineProperties(le.prototype, {
        close: { enumerable: !0 },
        enqueue: { enumerable: !0 },
        error: { enumerable: !0 },
        byobRequest: { enumerable: !0 },
        desiredSize: { enumerable: !0 }
      }), c(le.prototype.close, "close"), c(le.prototype.enqueue, "enqueue"), c(le.prototype.error, "error"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(le.prototype, Symbol.toStringTag, {
        value: "ReadableByteStreamController",
        configurable: !0
      });
      function Pe(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_controlledReadableByteStream") ? !1 : e instanceof le;
      }
      function cr(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_associatedReadableByteStreamController") ? !1 : e instanceof Te;
      }
      function Ee(e) {
        if (!xo(e))
          return;
        if (e._pulling) {
          e._pullAgain = !0;
          return;
        }
        e._pulling = !0;
        const r = e._pullAlgorithm();
        y(r, () => (e._pulling = !1, e._pullAgain && (e._pullAgain = !1, Ee(e)), null), (o) => (Y(e, o), null));
      }
      function dn(e) {
        mr(e), e._pendingPullIntos = new j();
      }
      function hr(e, t) {
        let r = !1;
        e._state === "closed" && (r = !0);
        const o = cn(t);
        t.readerType === "default" ? ar(e, o, r) : Zo(e, o, r);
      }
      function cn(e) {
        const t = e.bytesFilled, r = e.elementSize;
        return new e.viewConstructor(e.buffer, e.byteOffset, t / r);
      }
      function bt(e, t, r, o) {
        e._queue.push({ buffer: t, byteOffset: r, byteLength: o }), e._queueTotalSize += o;
      }
      function hn(e, t, r, o) {
        let i;
        try {
          i = sn(t, r, r + o);
        } catch (f) {
          throw Y(e, f), f;
        }
        bt(e, i, 0, o);
      }
      function mn(e, t) {
        t.bytesFilled > 0 && hn(e, t.buffer, t.byteOffset, t.bytesFilled), Ie(e);
      }
      function bn(e, t) {
        const r = Math.min(e._queueTotalSize, t.byteLength - t.bytesFilled), o = t.bytesFilled + r;
        let i = r, f = !1;
        const d = o % t.elementSize, b = o - d;
        b >= t.minimumFill && (i = b - t.bytesFilled, f = !0);
        const g = e._queue;
        for (; i > 0; ) {
          const p = g.peek(), R = Math.min(i, p.byteLength), C = t.byteOffset + t.bytesFilled;
          an(t.buffer, C, p.buffer, p.byteOffset, R), p.byteLength === R ? g.shift() : (p.byteOffset += R, p.byteLength -= R), e._queueTotalSize -= R, pn(e, R, t), i -= R;
        }
        return f;
      }
      function pn(e, t, r) {
        r.bytesFilled += t;
      }
      function yn(e) {
        e._queueTotalSize === 0 && e._closeRequested ? (pt(e), nt(e._controlledReadableByteStream)) : Ee(e);
      }
      function mr(e) {
        e._byobRequest !== null && (e._byobRequest._associatedReadableByteStreamController = void 0, e._byobRequest._view = null, e._byobRequest = null);
      }
      function br(e) {
        for (; e._pendingPullIntos.length > 0; ) {
          if (e._queueTotalSize === 0)
            return;
          const t = e._pendingPullIntos.peek();
          bn(e, t) && (Ie(e), hr(e._controlledReadableByteStream, t));
        }
      }
      function $o(e) {
        const t = e._controlledReadableByteStream._reader;
        for (; t._readRequests.length > 0; ) {
          if (e._queueTotalSize === 0)
            return;
          const r = t._readRequests.shift();
          gn(e, r);
        }
      }
      function Mo(e, t, r, o) {
        const i = e._controlledReadableByteStream, f = t.constructor, d = jo(f), { byteOffset: b, byteLength: g } = t, p = r * d;
        let R;
        try {
          R = se(t.buffer);
        } catch (A) {
          o._errorSteps(A);
          return;
        }
        const C = {
          buffer: R,
          bufferByteLength: R.byteLength,
          byteOffset: b,
          byteLength: g,
          bytesFilled: 0,
          minimumFill: p,
          elementSize: d,
          viewConstructor: f,
          readerType: "byob"
        };
        if (e._pendingPullIntos.length > 0) {
          e._pendingPullIntos.push(C), Cn(i, o);
          return;
        }
        if (i._state === "closed") {
          const A = new f(C.buffer, C.byteOffset, 0);
          o._closeSteps(A);
          return;
        }
        if (e._queueTotalSize > 0) {
          if (bn(e, C)) {
            const A = cn(C);
            yn(e), o._chunkSteps(A);
            return;
          }
          if (e._closeRequested) {
            const A = new TypeError("Insufficient bytes to fill elements in the given buffer");
            Y(e, A), o._errorSteps(A);
            return;
          }
        }
        e._pendingPullIntos.push(C), Cn(i, o), Ee(e);
      }
      function Uo(e, t) {
        t.readerType === "none" && Ie(e);
        const r = e._controlledReadableByteStream;
        if (_r(r))
          for (; Tn(r) > 0; ) {
            const o = Ie(e);
            hr(r, o);
          }
      }
      function No(e, t, r) {
        if (pn(e, t, r), r.readerType === "none") {
          mn(e, r), br(e);
          return;
        }
        if (r.bytesFilled < r.minimumFill)
          return;
        Ie(e);
        const o = r.bytesFilled % r.elementSize;
        if (o > 0) {
          const i = r.byteOffset + r.bytesFilled;
          hn(e, r.buffer, i - o, o);
        }
        r.bytesFilled -= o, hr(e._controlledReadableByteStream, r), br(e);
      }
      function _n(e, t) {
        const r = e._pendingPullIntos.peek();
        mr(e), e._controlledReadableByteStream._state === "closed" ? Uo(e, r) : No(e, t, r), Ee(e);
      }
      function Ie(e) {
        return e._pendingPullIntos.shift();
      }
      function xo(e) {
        const t = e._controlledReadableByteStream;
        return t._state !== "readable" || e._closeRequested || !e._started ? !1 : !!(Jr(t) && ct(t) > 0 || _r(t) && Tn(t) > 0 || Sn(e) > 0);
      }
      function pt(e) {
        e._pullAlgorithm = void 0, e._cancelAlgorithm = void 0;
      }
      function Ze(e) {
        const t = e._controlledReadableByteStream;
        if (!(e._closeRequested || t._state !== "readable")) {
          if (e._queueTotalSize > 0) {
            e._closeRequested = !0;
            return;
          }
          if (e._pendingPullIntos.length > 0) {
            const r = e._pendingPullIntos.peek();
            if (r.bytesFilled % r.elementSize !== 0) {
              const o = new TypeError("Insufficient bytes to fill elements in the given buffer");
              throw Y(e, o), o;
            }
          }
          pt(e), nt(t);
        }
      }
      function yt(e, t) {
        const r = e._controlledReadableByteStream;
        if (e._closeRequested || r._state !== "readable")
          return;
        const { buffer: o, byteOffset: i, byteLength: f } = t;
        if (pe(o))
          throw new TypeError("chunk's buffer is detached and so cannot be enqueued");
        const d = se(o);
        if (e._pendingPullIntos.length > 0) {
          const b = e._pendingPullIntos.peek();
          if (pe(b.buffer))
            throw new TypeError("The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk");
          mr(e), b.buffer = se(b.buffer), b.readerType === "none" && mn(e, b);
        }
        if (Jr(r))
          if ($o(e), ct(r) === 0)
            bt(e, d, i, f);
          else {
            e._pendingPullIntos.length > 0 && Ie(e);
            const b = new Uint8Array(d, i, f);
            ar(r, b, !1);
          }
        else _r(r) ? (bt(e, d, i, f), br(e)) : bt(e, d, i, f);
        Ee(e);
      }
      function Y(e, t) {
        const r = e._controlledReadableByteStream;
        r._state === "readable" && (dn(e), ye(e), pt(e), Yn(r, t));
      }
      function gn(e, t) {
        const r = e._queue.shift();
        e._queueTotalSize -= r.byteLength, yn(e);
        const o = new Uint8Array(r.buffer, r.byteOffset, r.byteLength);
        t._chunkSteps(o);
      }
      function pr(e) {
        if (e._byobRequest === null && e._pendingPullIntos.length > 0) {
          const t = e._pendingPullIntos.peek(), r = new Uint8Array(t.buffer, t.byteOffset + t.bytesFilled, t.byteLength - t.bytesFilled), o = Object.create(Te.prototype);
          Qo(o, e, r), e._byobRequest = o;
        }
        return e._byobRequest;
      }
      function Sn(e) {
        const t = e._controlledReadableByteStream._state;
        return t === "errored" ? null : t === "closed" ? 0 : e._strategyHWM - e._queueTotalSize;
      }
      function _t(e, t) {
        const r = e._pendingPullIntos.peek();
        if (e._controlledReadableByteStream._state === "closed") {
          if (t !== 0)
            throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
        } else {
          if (t === 0)
            throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
          if (r.bytesFilled + t > r.byteLength)
            throw new RangeError("bytesWritten out of range");
        }
        r.buffer = se(r.buffer), _n(e, t);
      }
      function gt(e, t) {
        const r = e._pendingPullIntos.peek();
        if (e._controlledReadableByteStream._state === "closed") {
          if (t.byteLength !== 0)
            throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
        } else if (t.byteLength === 0)
          throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
        if (r.byteOffset + r.bytesFilled !== t.byteOffset)
          throw new RangeError("The region specified by view does not match byobRequest");
        if (r.bufferByteLength !== t.buffer.byteLength)
          throw new RangeError("The buffer of view has different capacity than byobRequest");
        if (r.bytesFilled + t.byteLength > r.byteLength)
          throw new RangeError("The region specified by view is larger than byobRequest");
        const i = t.byteLength;
        r.buffer = se(t.buffer), _n(e, i);
      }
      function wn(e, t, r, o, i, f, d) {
        t._controlledReadableByteStream = e, t._pullAgain = !1, t._pulling = !1, t._byobRequest = null, t._queue = t._queueTotalSize = void 0, ye(t), t._closeRequested = !1, t._started = !1, t._strategyHWM = f, t._pullAlgorithm = o, t._cancelAlgorithm = i, t._autoAllocateChunkSize = d, t._pendingPullIntos = new j(), e._readableStreamController = t;
        const b = r();
        y(w(b), () => (t._started = !0, Ee(t), null), (g) => (Y(t, g), null));
      }
      function Ho(e, t, r) {
        const o = Object.create(le.prototype);
        let i, f, d;
        t.start !== void 0 ? i = () => t.start(o) : i = () => {
        }, t.pull !== void 0 ? f = () => t.pull(o) : f = () => w(void 0), t.cancel !== void 0 ? d = (g) => t.cancel(g) : d = () => w(void 0);
        const b = t.autoAllocateChunkSize;
        if (b === 0)
          throw new TypeError("autoAllocateChunkSize must be greater than 0");
        wn(e, o, i, f, d, r, b);
      }
      function Qo(e, t, r) {
        e._associatedReadableByteStreamController = t, e._view = r;
      }
      function yr(e) {
        return new TypeError(`ReadableStreamBYOBRequest.prototype.${e} can only be used on a ReadableStreamBYOBRequest`);
      }
      function Ke(e) {
        return new TypeError(`ReadableByteStreamController.prototype.${e} can only be used on a ReadableByteStreamController`);
      }
      function Vo(e, t) {
        ee(e, t);
        const r = e?.mode;
        return {
          mode: r === void 0 ? void 0 : Yo(r, `${t} has member 'mode' that`)
        };
      }
      function Yo(e, t) {
        if (e = `${e}`, e !== "byob")
          throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamReaderMode`);
        return e;
      }
      function Go(e, t) {
        var r;
        ee(e, t);
        const o = (r = e?.min) !== null && r !== void 0 ? r : 1;
        return {
          min: nr(o, `${t} has member 'min' that`)
        };
      }
      function Rn(e) {
        return new _e(e);
      }
      function Cn(e, t) {
        e._reader._readIntoRequests.push(t);
      }
      function Zo(e, t, r) {
        const i = e._reader._readIntoRequests.shift();
        r ? i._closeSteps(t) : i._chunkSteps(t);
      }
      function Tn(e) {
        return e._reader._readIntoRequests.length;
      }
      function _r(e) {
        const t = e._reader;
        return !(t === void 0 || !ve(t));
      }
      class _e {
        constructor(t) {
          if (ie(t, 1, "ReadableStreamBYOBReader"), or(t, "First parameter"), we(t))
            throw new TypeError("This stream has already been locked for exclusive reading by another reader");
          if (!Pe(t._readableStreamController))
            throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
          Hr(this, t), this._readIntoRequests = new j();
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the reader's lock is released before the stream finishes closing.
         */
        get closed() {
          return ve(this) ? this._closedPromise : m(St("closed"));
        }
        /**
         * If the reader is active, behaves the same as {@link ReadableStream.cancel | stream.cancel(reason)}.
         */
        cancel(t = void 0) {
          return ve(this) ? this._ownerReadableStream === void 0 ? m(dt("cancel")) : Jt(this, t) : m(St("cancel"));
        }
        read(t, r = {}) {
          if (!ve(this))
            return m(St("read"));
          if (!ArrayBuffer.isView(t))
            return m(new TypeError("view must be an array buffer view"));
          if (t.byteLength === 0)
            return m(new TypeError("view must have non-zero byteLength"));
          if (t.buffer.byteLength === 0)
            return m(new TypeError("view's buffer must have non-zero byteLength"));
          if (pe(t.buffer))
            return m(new TypeError("view's buffer has been detached"));
          let o;
          try {
            o = Go(r, "options");
          } catch (p) {
            return m(p);
          }
          const i = o.min;
          if (i === 0)
            return m(new TypeError("options.min must be greater than 0"));
          if (Do(t)) {
            if (i > t.byteLength)
              return m(new RangeError("options.min must be less than or equal to view's byteLength"));
          } else if (i > t.length)
            return m(new RangeError("options.min must be less than or equal to view's length"));
          if (this._ownerReadableStream === void 0)
            return m(dt("read from"));
          let f, d;
          const b = E((p, R) => {
            f = p, d = R;
          });
          return Pn(this, t, i, {
            _chunkSteps: (p) => f({ value: p, done: !1 }),
            _closeSteps: (p) => f({ value: p, done: !0 }),
            _errorSteps: (p) => d(p)
          }), b;
        }
        /**
         * Releases the reader's lock on the corresponding stream. After the lock is released, the reader is no longer active.
         * If the associated stream is errored when the lock is released, the reader will appear errored in the same way
         * from now on; otherwise, the reader will appear closed.
         *
         * A reader's lock cannot be released while it still has a pending read request, i.e., if a promise returned by
         * the reader's {@link ReadableStreamBYOBReader.read | read()} method has not yet been settled. Attempting to
         * do so will throw a `TypeError` and leave the reader locked to the stream.
         */
        releaseLock() {
          if (!ve(this))
            throw St("releaseLock");
          this._ownerReadableStream !== void 0 && Ko(this);
        }
      }
      Object.defineProperties(_e.prototype, {
        cancel: { enumerable: !0 },
        read: { enumerable: !0 },
        releaseLock: { enumerable: !0 },
        closed: { enumerable: !0 }
      }), c(_e.prototype.cancel, "cancel"), c(_e.prototype.read, "read"), c(_e.prototype.releaseLock, "releaseLock"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(_e.prototype, Symbol.toStringTag, {
        value: "ReadableStreamBYOBReader",
        configurable: !0
      });
      function ve(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_readIntoRequests") ? !1 : e instanceof _e;
      }
      function Pn(e, t, r, o) {
        const i = e._ownerReadableStream;
        i._disturbed = !0, i._state === "errored" ? o._errorSteps(i._storedError) : Mo(i._readableStreamController, t, r, o);
      }
      function Ko(e) {
        ae(e);
        const t = new TypeError("Reader was released");
        En(e, t);
      }
      function En(e, t) {
        const r = e._readIntoRequests;
        e._readIntoRequests = new j(), r.forEach((o) => {
          o._errorSteps(t);
        });
      }
      function St(e) {
        return new TypeError(`ReadableStreamBYOBReader.prototype.${e} can only be used on a ReadableStreamBYOBReader`);
      }
      function Je(e, t) {
        const { highWaterMark: r } = e;
        if (r === void 0)
          return t;
        if (on(r) || r < 0)
          throw new RangeError("Invalid highWaterMark");
        return r;
      }
      function wt(e) {
        const { size: t } = e;
        return t || (() => 1);
      }
      function Rt(e, t) {
        ee(e, t);
        const r = e?.highWaterMark, o = e?.size;
        return {
          highWaterMark: r === void 0 ? void 0 : rr(r),
          size: o === void 0 ? void 0 : Jo(o, `${t} has member 'size' that`)
        };
      }
      function Jo(e, t) {
        return V(e, t), (r) => rr(e(r));
      }
      function Xo(e, t) {
        ee(e, t);
        const r = e?.abort, o = e?.close, i = e?.start, f = e?.type, d = e?.write;
        return {
          abort: r === void 0 ? void 0 : ea(r, e, `${t} has member 'abort' that`),
          close: o === void 0 ? void 0 : ta(o, e, `${t} has member 'close' that`),
          start: i === void 0 ? void 0 : ra(i, e, `${t} has member 'start' that`),
          write: d === void 0 ? void 0 : na(d, e, `${t} has member 'write' that`),
          type: f
        };
      }
      function ea(e, t, r) {
        return V(e, r), (o) => I(e, t, [o]);
      }
      function ta(e, t, r) {
        return V(e, r), () => I(e, t, []);
      }
      function ra(e, t, r) {
        return V(e, r), (o) => q(e, t, [o]);
      }
      function na(e, t, r) {
        return V(e, r), (o, i) => I(e, t, [o, i]);
      }
      function vn(e, t) {
        if (!ze(e))
          throw new TypeError(`${t} is not a WritableStream.`);
      }
      function oa(e) {
        if (typeof e != "object" || e === null)
          return !1;
        try {
          return typeof e.aborted == "boolean";
        } catch {
          return !1;
        }
      }
      const aa = typeof AbortController == "function";
      function ia() {
        if (aa)
          return new AbortController();
      }
      class ge {
        constructor(t = {}, r = {}) {
          t === void 0 ? t = null : Gr(t, "First parameter");
          const o = Rt(r, "Second parameter"), i = Xo(t, "First parameter");
          if (Bn(this), i.type !== void 0)
            throw new RangeError("Invalid type is specified");
          const d = wt(o), b = Je(o, 1);
          Sa(this, i, b, d);
        }
        /**
         * Returns whether or not the writable stream is locked to a writer.
         */
        get locked() {
          if (!ze(this))
            throw vt("locked");
          return Fe(this);
        }
        /**
         * Aborts the stream, signaling that the producer can no longer successfully write to the stream and it is to be
         * immediately moved to an errored state, with any queued-up writes discarded. This will also execute any abort
         * mechanism of the underlying sink.
         *
         * The returned promise will fulfill if the stream shuts down successfully, or reject if the underlying sink signaled
         * that there was an error doing so. Additionally, it will reject with a `TypeError` (without attempting to cancel
         * the stream) if the stream is currently locked.
         */
        abort(t = void 0) {
          return ze(this) ? Fe(this) ? m(new TypeError("Cannot abort a stream that already has a writer")) : Ct(this, t) : m(vt("abort"));
        }
        /**
         * Closes the stream. The underlying sink will finish processing any previously-written chunks, before invoking its
         * close behavior. During this time any further attempts to write will fail (without erroring the stream).
         *
         * The method returns a promise that will fulfill if all remaining chunks are successfully written and the stream
         * successfully closes, or rejects if an error is encountered during this process. Additionally, it will reject with
         * a `TypeError` (without attempting to cancel the stream) if the stream is currently locked.
         */
        close() {
          return ze(this) ? Fe(this) ? m(new TypeError("Cannot close a stream that already has a writer")) : te(this) ? m(new TypeError("Cannot close an already-closing stream")) : Wn(this) : m(vt("close"));
        }
        /**
         * Creates a {@link WritableStreamDefaultWriter | writer} and locks the stream to the new writer. While the stream
         * is locked, no other writer can be acquired until this one is released.
         *
         * This functionality is especially useful for creating abstractions that desire the ability to write to a stream
         * without interruption or interleaving. By getting a writer for the stream, you can ensure nobody else can write at
         * the same time, which would cause the resulting written data to be unpredictable and probably useless.
         */
        getWriter() {
          if (!ze(this))
            throw vt("getWriter");
          return An(this);
        }
      }
      Object.defineProperties(ge.prototype, {
        abort: { enumerable: !0 },
        close: { enumerable: !0 },
        getWriter: { enumerable: !0 },
        locked: { enumerable: !0 }
      }), c(ge.prototype.abort, "abort"), c(ge.prototype.close, "close"), c(ge.prototype.getWriter, "getWriter"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(ge.prototype, Symbol.toStringTag, {
        value: "WritableStream",
        configurable: !0
      });
      function An(e) {
        return new ue(e);
      }
      function sa(e, t, r, o, i = 1, f = () => 1) {
        const d = Object.create(ge.prototype);
        Bn(d);
        const b = Object.create(Le.prototype);
        return Fn(d, b, e, t, r, o, i, f), d;
      }
      function Bn(e) {
        e._state = "writable", e._storedError = void 0, e._writer = void 0, e._writableStreamController = void 0, e._writeRequests = new j(), e._inFlightWriteRequest = void 0, e._closeRequest = void 0, e._inFlightCloseRequest = void 0, e._pendingAbortRequest = void 0, e._backpressure = !1;
      }
      function ze(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_writableStreamController") ? !1 : e instanceof ge;
      }
      function Fe(e) {
        return e._writer !== void 0;
      }
      function Ct(e, t) {
        var r;
        if (e._state === "closed" || e._state === "errored")
          return w(void 0);
        e._writableStreamController._abortReason = t, (r = e._writableStreamController._abortController) === null || r === void 0 || r.abort(t);
        const o = e._state;
        if (o === "closed" || o === "errored")
          return w(void 0);
        if (e._pendingAbortRequest !== void 0)
          return e._pendingAbortRequest._promise;
        let i = !1;
        o === "erroring" && (i = !0, t = void 0);
        const f = E((d, b) => {
          e._pendingAbortRequest = {
            _promise: void 0,
            _resolve: d,
            _reject: b,
            _reason: t,
            _wasAlreadyErroring: i
          };
        });
        return e._pendingAbortRequest._promise = f, i || Sr(e, t), f;
      }
      function Wn(e) {
        const t = e._state;
        if (t === "closed" || t === "errored")
          return m(new TypeError(`The stream (in ${t} state) is not in the writable state and cannot be closed`));
        const r = E((i, f) => {
          const d = {
            _resolve: i,
            _reject: f
          };
          e._closeRequest = d;
        }), o = e._writer;
        return o !== void 0 && e._backpressure && t === "writable" && Ar(o), wa(e._writableStreamController), r;
      }
      function la(e) {
        return E((r, o) => {
          const i = {
            _resolve: r,
            _reject: o
          };
          e._writeRequests.push(i);
        });
      }
      function gr(e, t) {
        if (e._state === "writable") {
          Sr(e, t);
          return;
        }
        wr(e);
      }
      function Sr(e, t) {
        const r = e._writableStreamController;
        e._state = "erroring", e._storedError = t;
        const o = e._writer;
        o !== void 0 && kn(o, t), !ha(e) && r._started && wr(e);
      }
      function wr(e) {
        e._state = "errored", e._writableStreamController[xr]();
        const t = e._storedError;
        if (e._writeRequests.forEach((i) => {
          i._reject(t);
        }), e._writeRequests = new j(), e._pendingAbortRequest === void 0) {
          Tt(e);
          return;
        }
        const r = e._pendingAbortRequest;
        if (e._pendingAbortRequest = void 0, r._wasAlreadyErroring) {
          r._reject(t), Tt(e);
          return;
        }
        const o = e._writableStreamController[ft](r._reason);
        y(o, () => (r._resolve(), Tt(e), null), (i) => (r._reject(i), Tt(e), null));
      }
      function ua(e) {
        e._inFlightWriteRequest._resolve(void 0), e._inFlightWriteRequest = void 0;
      }
      function fa(e, t) {
        e._inFlightWriteRequest._reject(t), e._inFlightWriteRequest = void 0, gr(e, t);
      }
      function da(e) {
        e._inFlightCloseRequest._resolve(void 0), e._inFlightCloseRequest = void 0, e._state === "erroring" && (e._storedError = void 0, e._pendingAbortRequest !== void 0 && (e._pendingAbortRequest._resolve(), e._pendingAbortRequest = void 0)), e._state = "closed";
        const r = e._writer;
        r !== void 0 && $n(r);
      }
      function ca(e, t) {
        e._inFlightCloseRequest._reject(t), e._inFlightCloseRequest = void 0, e._pendingAbortRequest !== void 0 && (e._pendingAbortRequest._reject(t), e._pendingAbortRequest = void 0), gr(e, t);
      }
      function te(e) {
        return !(e._closeRequest === void 0 && e._inFlightCloseRequest === void 0);
      }
      function ha(e) {
        return !(e._inFlightWriteRequest === void 0 && e._inFlightCloseRequest === void 0);
      }
      function ma(e) {
        e._inFlightCloseRequest = e._closeRequest, e._closeRequest = void 0;
      }
      function ba(e) {
        e._inFlightWriteRequest = e._writeRequests.shift();
      }
      function Tt(e) {
        e._closeRequest !== void 0 && (e._closeRequest._reject(e._storedError), e._closeRequest = void 0);
        const t = e._writer;
        t !== void 0 && Er(t, e._storedError);
      }
      function Rr(e, t) {
        const r = e._writer;
        r !== void 0 && t !== e._backpressure && (t ? Aa(r) : Ar(r)), e._backpressure = t;
      }
      class ue {
        constructor(t) {
          if (ie(t, 1, "WritableStreamDefaultWriter"), vn(t, "First parameter"), Fe(t))
            throw new TypeError("This stream has already been locked for exclusive writing by another writer");
          this._ownerWritableStream = t, t._writer = this;
          const r = t._state;
          if (r === "writable")
            !te(t) && t._backpressure ? Bt(this) : Mn(this), At(this);
          else if (r === "erroring")
            vr(this, t._storedError), At(this);
          else if (r === "closed")
            Mn(this), Ea(this);
          else {
            const o = t._storedError;
            vr(this, o), jn(this, o);
          }
        }
        /**
         * Returns a promise that will be fulfilled when the stream becomes closed, or rejected if the stream ever errors or
         * the writer’s lock is released before the stream finishes closing.
         */
        get closed() {
          return Ae(this) ? this._closedPromise : m(Be("closed"));
        }
        /**
         * Returns the desired size to fill the stream’s internal queue. It can be negative, if the queue is over-full.
         * A producer can use this information to determine the right amount of data to write.
         *
         * It will be `null` if the stream cannot be successfully written to (due to either being errored, or having an abort
         * queued up). It will return zero if the stream is closed. And the getter will throw an exception if invoked when
         * the writer’s lock is released.
         */
        get desiredSize() {
          if (!Ae(this))
            throw Be("desiredSize");
          if (this._ownerWritableStream === void 0)
            throw et("desiredSize");
          return ga(this);
        }
        /**
         * Returns a promise that will be fulfilled when the desired size to fill the stream’s internal queue transitions
         * from non-positive to positive, signaling that it is no longer applying backpressure. Once the desired size dips
         * back to zero or below, the getter will return a new promise that stays pending until the next transition.
         *
         * If the stream becomes errored or aborted, or the writer’s lock is released, the returned promise will become
         * rejected.
         */
        get ready() {
          return Ae(this) ? this._readyPromise : m(Be("ready"));
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.abort | stream.abort(reason)}.
         */
        abort(t = void 0) {
          return Ae(this) ? this._ownerWritableStream === void 0 ? m(et("abort")) : pa(this, t) : m(Be("abort"));
        }
        /**
         * If the reader is active, behaves the same as {@link WritableStream.close | stream.close()}.
         */
        close() {
          if (!Ae(this))
            return m(Be("close"));
          const t = this._ownerWritableStream;
          return t === void 0 ? m(et("close")) : te(t) ? m(new TypeError("Cannot close an already-closing stream")) : qn(this);
        }
        /**
         * Releases the writer’s lock on the corresponding stream. After the lock is released, the writer is no longer active.
         * If the associated stream is errored when the lock is released, the writer will appear errored in the same way from
         * now on; otherwise, the writer will appear closed.
         *
         * Note that the lock can still be released even if some ongoing writes have not yet finished (i.e. even if the
         * promises returned from previous calls to {@link WritableStreamDefaultWriter.write | write()} have not yet settled).
         * It’s not necessary to hold the lock on the writer for the duration of the write; the lock instead simply prevents
         * other producers from writing in an interleaved manner.
         */
        releaseLock() {
          if (!Ae(this))
            throw Be("releaseLock");
          this._ownerWritableStream !== void 0 && On(this);
        }
        write(t = void 0) {
          return Ae(this) ? this._ownerWritableStream === void 0 ? m(et("write to")) : In(this, t) : m(Be("write"));
        }
      }
      Object.defineProperties(ue.prototype, {
        abort: { enumerable: !0 },
        close: { enumerable: !0 },
        releaseLock: { enumerable: !0 },
        write: { enumerable: !0 },
        closed: { enumerable: !0 },
        desiredSize: { enumerable: !0 },
        ready: { enumerable: !0 }
      }), c(ue.prototype.abort, "abort"), c(ue.prototype.close, "close"), c(ue.prototype.releaseLock, "releaseLock"), c(ue.prototype.write, "write"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(ue.prototype, Symbol.toStringTag, {
        value: "WritableStreamDefaultWriter",
        configurable: !0
      });
      function Ae(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_ownerWritableStream") ? !1 : e instanceof ue;
      }
      function pa(e, t) {
        const r = e._ownerWritableStream;
        return Ct(r, t);
      }
      function qn(e) {
        const t = e._ownerWritableStream;
        return Wn(t);
      }
      function ya(e) {
        const t = e._ownerWritableStream, r = t._state;
        return te(t) || r === "closed" ? w(void 0) : r === "errored" ? m(t._storedError) : qn(e);
      }
      function _a(e, t) {
        e._closedPromiseState === "pending" ? Er(e, t) : va(e, t);
      }
      function kn(e, t) {
        e._readyPromiseState === "pending" ? Un(e, t) : Ba(e, t);
      }
      function ga(e) {
        const t = e._ownerWritableStream, r = t._state;
        return r === "errored" || r === "erroring" ? null : r === "closed" ? 0 : Ln(t._writableStreamController);
      }
      function On(e) {
        const t = e._ownerWritableStream, r = new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
        kn(e, r), _a(e, r), t._writer = void 0, e._ownerWritableStream = void 0;
      }
      function In(e, t) {
        const r = e._ownerWritableStream, o = r._writableStreamController, i = Ra(o, t);
        if (r !== e._ownerWritableStream)
          return m(et("write to"));
        const f = r._state;
        if (f === "errored")
          return m(r._storedError);
        if (te(r) || f === "closed")
          return m(new TypeError("The stream is closing or closed and cannot be written to"));
        if (f === "erroring")
          return m(r._storedError);
        const d = la(r);
        return Ca(o, t, i), d;
      }
      const zn = {};
      class Le {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        /**
         * The reason which was passed to `WritableStream.abort(reason)` when the stream was aborted.
         *
         * @deprecated
         *  This property has been removed from the specification, see https://github.com/whatwg/streams/pull/1177.
         *  Use {@link WritableStreamDefaultController.signal}'s `reason` instead.
         */
        get abortReason() {
          if (!Cr(this))
            throw Pr("abortReason");
          return this._abortReason;
        }
        /**
         * An `AbortSignal` that can be used to abort the pending write or close operation when the stream is aborted.
         */
        get signal() {
          if (!Cr(this))
            throw Pr("signal");
          if (this._abortController === void 0)
            throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
          return this._abortController.signal;
        }
        /**
         * Closes the controlled writable stream, making all future interactions with it fail with the given error `e`.
         *
         * This method is rarely used, since usually it suffices to return a rejected promise from one of the underlying
         * sink's methods. However, it can be useful for suddenly shutting down a stream in response to an event outside the
         * normal lifecycle of interactions with the underlying sink.
         */
        error(t = void 0) {
          if (!Cr(this))
            throw Pr("error");
          this._controlledWritableStream._state === "writable" && Dn(this, t);
        }
        /** @internal */
        [ft](t) {
          const r = this._abortAlgorithm(t);
          return Pt(this), r;
        }
        /** @internal */
        [xr]() {
          ye(this);
        }
      }
      Object.defineProperties(Le.prototype, {
        abortReason: { enumerable: !0 },
        signal: { enumerable: !0 },
        error: { enumerable: !0 }
      }), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(Le.prototype, Symbol.toStringTag, {
        value: "WritableStreamDefaultController",
        configurable: !0
      });
      function Cr(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_controlledWritableStream") ? !1 : e instanceof Le;
      }
      function Fn(e, t, r, o, i, f, d, b) {
        t._controlledWritableStream = e, e._writableStreamController = t, t._queue = void 0, t._queueTotalSize = void 0, ye(t), t._abortReason = void 0, t._abortController = ia(), t._started = !1, t._strategySizeAlgorithm = b, t._strategyHWM = d, t._writeAlgorithm = o, t._closeAlgorithm = i, t._abortAlgorithm = f;
        const g = Tr(t);
        Rr(e, g);
        const p = r(), R = w(p);
        y(R, () => (t._started = !0, Et(t), null), (C) => (t._started = !0, gr(e, C), null));
      }
      function Sa(e, t, r, o) {
        const i = Object.create(Le.prototype);
        let f, d, b, g;
        t.start !== void 0 ? f = () => t.start(i) : f = () => {
        }, t.write !== void 0 ? d = (p) => t.write(p, i) : d = () => w(void 0), t.close !== void 0 ? b = () => t.close() : b = () => w(void 0), t.abort !== void 0 ? g = (p) => t.abort(p) : g = () => w(void 0), Fn(e, i, f, d, b, g, r, o);
      }
      function Pt(e) {
        e._writeAlgorithm = void 0, e._closeAlgorithm = void 0, e._abortAlgorithm = void 0, e._strategySizeAlgorithm = void 0;
      }
      function wa(e) {
        dr(e, zn, 0), Et(e);
      }
      function Ra(e, t) {
        try {
          return e._strategySizeAlgorithm(t);
        } catch (r) {
          return Xe(e, r), 1;
        }
      }
      function Ln(e) {
        return e._strategyHWM - e._queueTotalSize;
      }
      function Ca(e, t, r) {
        try {
          dr(e, t, r);
        } catch (i) {
          Xe(e, i);
          return;
        }
        const o = e._controlledWritableStream;
        if (!te(o) && o._state === "writable") {
          const i = Tr(e);
          Rr(o, i);
        }
        Et(e);
      }
      function Et(e) {
        const t = e._controlledWritableStream;
        if (!e._started || t._inFlightWriteRequest !== void 0)
          return;
        if (t._state === "erroring") {
          wr(t);
          return;
        }
        if (e._queue.length === 0)
          return;
        const o = Lo(e);
        o === zn ? Ta(e) : Pa(e, o);
      }
      function Xe(e, t) {
        e._controlledWritableStream._state === "writable" && Dn(e, t);
      }
      function Ta(e) {
        const t = e._controlledWritableStream;
        ma(t), fr(e);
        const r = e._closeAlgorithm();
        Pt(e), y(r, () => (da(t), null), (o) => (ca(t, o), null));
      }
      function Pa(e, t) {
        const r = e._controlledWritableStream;
        ba(r);
        const o = e._writeAlgorithm(t);
        y(o, () => {
          ua(r);
          const i = r._state;
          if (fr(e), !te(r) && i === "writable") {
            const f = Tr(e);
            Rr(r, f);
          }
          return Et(e), null;
        }, (i) => (r._state === "writable" && Pt(e), fa(r, i), null));
      }
      function Tr(e) {
        return Ln(e) <= 0;
      }
      function Dn(e, t) {
        const r = e._controlledWritableStream;
        Pt(e), Sr(r, t);
      }
      function vt(e) {
        return new TypeError(`WritableStream.prototype.${e} can only be used on a WritableStream`);
      }
      function Pr(e) {
        return new TypeError(`WritableStreamDefaultController.prototype.${e} can only be used on a WritableStreamDefaultController`);
      }
      function Be(e) {
        return new TypeError(`WritableStreamDefaultWriter.prototype.${e} can only be used on a WritableStreamDefaultWriter`);
      }
      function et(e) {
        return new TypeError("Cannot " + e + " a stream using a released writer");
      }
      function At(e) {
        e._closedPromise = E((t, r) => {
          e._closedPromise_resolve = t, e._closedPromise_reject = r, e._closedPromiseState = "pending";
        });
      }
      function jn(e, t) {
        At(e), Er(e, t);
      }
      function Ea(e) {
        At(e), $n(e);
      }
      function Er(e, t) {
        e._closedPromise_reject !== void 0 && (x(e._closedPromise), e._closedPromise_reject(t), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "rejected");
      }
      function va(e, t) {
        jn(e, t);
      }
      function $n(e) {
        e._closedPromise_resolve !== void 0 && (e._closedPromise_resolve(void 0), e._closedPromise_resolve = void 0, e._closedPromise_reject = void 0, e._closedPromiseState = "resolved");
      }
      function Bt(e) {
        e._readyPromise = E((t, r) => {
          e._readyPromise_resolve = t, e._readyPromise_reject = r;
        }), e._readyPromiseState = "pending";
      }
      function vr(e, t) {
        Bt(e), Un(e, t);
      }
      function Mn(e) {
        Bt(e), Ar(e);
      }
      function Un(e, t) {
        e._readyPromise_reject !== void 0 && (x(e._readyPromise), e._readyPromise_reject(t), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "rejected");
      }
      function Aa(e) {
        Bt(e);
      }
      function Ba(e, t) {
        vr(e, t);
      }
      function Ar(e) {
        e._readyPromise_resolve !== void 0 && (e._readyPromise_resolve(void 0), e._readyPromise_resolve = void 0, e._readyPromise_reject = void 0, e._readyPromiseState = "fulfilled");
      }
      function Wa() {
        if (typeof globalThis < "u")
          return globalThis;
        if (typeof self < "u")
          return self;
        if (typeof lo < "u")
          return lo;
      }
      const Br = Wa();
      function qa(e) {
        if (!(typeof e == "function" || typeof e == "object") || e.name !== "DOMException")
          return !1;
        try {
          return new e(), !0;
        } catch {
          return !1;
        }
      }
      function ka() {
        const e = Br?.DOMException;
        return qa(e) ? e : void 0;
      }
      function Oa() {
        const e = function(r, o) {
          this.message = r || "", this.name = o || "Error", Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
        };
        return c(e, "DOMException"), e.prototype = Object.create(Error.prototype), Object.defineProperty(e.prototype, "constructor", { value: e, writable: !0, configurable: !0 }), e;
      }
      const Ia = ka() || Oa();
      function Nn(e, t, r, o, i, f) {
        const d = Oe(e), b = An(t);
        e._disturbed = !0;
        let g = !1, p = w(void 0);
        return E((R, C) => {
          let A;
          if (f !== void 0) {
            if (A = () => {
              const _ = f.reason !== void 0 ? f.reason : new Ia("Aborted", "AbortError"), T = [];
              o || T.push(() => t._state === "writable" ? Ct(t, _) : w(void 0)), i || T.push(() => e._state === "readable" ? K(e, _) : w(void 0)), M(() => Promise.all(T.map((B) => B())), !0, _);
            }, f.aborted) {
              A();
              return;
            }
            f.addEventListener("abort", A);
          }
          function J() {
            return E((_, T) => {
              function B(H) {
                H ? _() : W(Me(), B, T);
              }
              B(!1);
            });
          }
          function Me() {
            return g ? w(!0) : W(b._readyPromise, () => E((_, T) => {
              Ye(d, {
                _chunkSteps: (B) => {
                  p = W(In(b, B), void 0, u), _(!1);
                },
                _closeSteps: () => _(!0),
                _errorSteps: T
              });
            }));
          }
          if (de(e, d._closedPromise, (_) => (o ? G(!0, _) : M(() => Ct(t, _), !0, _), null)), de(t, b._closedPromise, (_) => (i ? G(!0, _) : M(() => K(e, _), !0, _), null)), $(e, d._closedPromise, () => (r ? G() : M(() => ya(b)), null)), te(t) || t._state === "closed") {
            const _ = new TypeError("the destination writable stream closed before all data could be piped to it");
            i ? G(!0, _) : M(() => K(e, _), !0, _);
          }
          x(J());
          function Ce() {
            const _ = p;
            return W(p, () => _ !== p ? Ce() : void 0);
          }
          function de(_, T, B) {
            _._state === "errored" ? B(_._storedError) : k(T, B);
          }
          function $(_, T, B) {
            _._state === "closed" ? B() : N(T, B);
          }
          function M(_, T, B) {
            if (g)
              return;
            g = !0, t._state === "writable" && !te(t) ? N(Ce(), H) : H();
            function H() {
              return y(_(), () => ce(T, B), (Ue) => ce(!0, Ue)), null;
            }
          }
          function G(_, T) {
            g || (g = !0, t._state === "writable" && !te(t) ? N(Ce(), () => ce(_, T)) : ce(_, T));
          }
          function ce(_, T) {
            return On(b), ae(d), f !== void 0 && f.removeEventListener("abort", A), _ ? C(T) : R(void 0), null;
          }
        });
      }
      class fe {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        /**
         * Returns the desired size to fill the controlled stream's internal queue. It can be negative, if the queue is
         * over-full. An underlying source ought to use this information to determine when and how to apply backpressure.
         */
        get desiredSize() {
          if (!Wt(this))
            throw kt("desiredSize");
          return Wr(this);
        }
        /**
         * Closes the controlled readable stream. Consumers will still be able to read any previously-enqueued chunks from
         * the stream, but once those are read, the stream will become closed.
         */
        close() {
          if (!Wt(this))
            throw kt("close");
          if (!je(this))
            throw new TypeError("The stream is not in a state that permits close");
          We(this);
        }
        enqueue(t = void 0) {
          if (!Wt(this))
            throw kt("enqueue");
          if (!je(this))
            throw new TypeError("The stream is not in a state that permits enqueue");
          return De(this, t);
        }
        /**
         * Errors the controlled readable stream, making all future interactions with it fail with the given error `e`.
         */
        error(t = void 0) {
          if (!Wt(this))
            throw kt("error");
          Z(this, t);
        }
        /** @internal */
        [Gt](t) {
          ye(this);
          const r = this._cancelAlgorithm(t);
          return qt(this), r;
        }
        /** @internal */
        [Zt](t) {
          const r = this._controlledReadableStream;
          if (this._queue.length > 0) {
            const o = fr(this);
            this._closeRequested && this._queue.length === 0 ? (qt(this), nt(r)) : tt(this), t._chunkSteps(o);
          } else
            Kr(r, t), tt(this);
        }
        /** @internal */
        [Kt]() {
        }
      }
      Object.defineProperties(fe.prototype, {
        close: { enumerable: !0 },
        enqueue: { enumerable: !0 },
        error: { enumerable: !0 },
        desiredSize: { enumerable: !0 }
      }), c(fe.prototype.close, "close"), c(fe.prototype.enqueue, "enqueue"), c(fe.prototype.error, "error"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(fe.prototype, Symbol.toStringTag, {
        value: "ReadableStreamDefaultController",
        configurable: !0
      });
      function Wt(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_controlledReadableStream") ? !1 : e instanceof fe;
      }
      function tt(e) {
        if (!xn(e))
          return;
        if (e._pulling) {
          e._pullAgain = !0;
          return;
        }
        e._pulling = !0;
        const r = e._pullAlgorithm();
        y(r, () => (e._pulling = !1, e._pullAgain && (e._pullAgain = !1, tt(e)), null), (o) => (Z(e, o), null));
      }
      function xn(e) {
        const t = e._controlledReadableStream;
        return !je(e) || !e._started ? !1 : !!(we(t) && ct(t) > 0 || Wr(e) > 0);
      }
      function qt(e) {
        e._pullAlgorithm = void 0, e._cancelAlgorithm = void 0, e._strategySizeAlgorithm = void 0;
      }
      function We(e) {
        if (!je(e))
          return;
        const t = e._controlledReadableStream;
        e._closeRequested = !0, e._queue.length === 0 && (qt(e), nt(t));
      }
      function De(e, t) {
        if (!je(e))
          return;
        const r = e._controlledReadableStream;
        if (we(r) && ct(r) > 0)
          ar(r, t, !1);
        else {
          let o;
          try {
            o = e._strategySizeAlgorithm(t);
          } catch (i) {
            throw Z(e, i), i;
          }
          try {
            dr(e, t, o);
          } catch (i) {
            throw Z(e, i), i;
          }
        }
        tt(e);
      }
      function Z(e, t) {
        const r = e._controlledReadableStream;
        r._state === "readable" && (ye(e), qt(e), Yn(r, t));
      }
      function Wr(e) {
        const t = e._controlledReadableStream._state;
        return t === "errored" ? null : t === "closed" ? 0 : e._strategyHWM - e._queueTotalSize;
      }
      function za(e) {
        return !xn(e);
      }
      function je(e) {
        const t = e._controlledReadableStream._state;
        return !e._closeRequested && t === "readable";
      }
      function Hn(e, t, r, o, i, f, d) {
        t._controlledReadableStream = e, t._queue = void 0, t._queueTotalSize = void 0, ye(t), t._started = !1, t._closeRequested = !1, t._pullAgain = !1, t._pulling = !1, t._strategySizeAlgorithm = d, t._strategyHWM = f, t._pullAlgorithm = o, t._cancelAlgorithm = i, e._readableStreamController = t;
        const b = r();
        y(w(b), () => (t._started = !0, tt(t), null), (g) => (Z(t, g), null));
      }
      function Fa(e, t, r, o) {
        const i = Object.create(fe.prototype);
        let f, d, b;
        t.start !== void 0 ? f = () => t.start(i) : f = () => {
        }, t.pull !== void 0 ? d = () => t.pull(i) : d = () => w(void 0), t.cancel !== void 0 ? b = (g) => t.cancel(g) : b = () => w(void 0), Hn(e, i, f, d, b, r, o);
      }
      function kt(e) {
        return new TypeError(`ReadableStreamDefaultController.prototype.${e} can only be used on a ReadableStreamDefaultController`);
      }
      function La(e, t) {
        return Pe(e._readableStreamController) ? ja(e) : Da(e);
      }
      function Da(e, t) {
        const r = Oe(e);
        let o = !1, i = !1, f = !1, d = !1, b, g, p, R, C;
        const A = E(($) => {
          C = $;
        });
        function J() {
          return o ? (i = !0, w(void 0)) : (o = !0, Ye(r, {
            _chunkSteps: (M) => {
              oe(() => {
                i = !1;
                const G = M, ce = M;
                f || De(p._readableStreamController, G), d || De(R._readableStreamController, ce), o = !1, i && J();
              });
            },
            _closeSteps: () => {
              o = !1, f || We(p._readableStreamController), d || We(R._readableStreamController), (!f || !d) && C(void 0);
            },
            _errorSteps: () => {
              o = !1;
            }
          }), w(void 0));
        }
        function Me($) {
          if (f = !0, b = $, d) {
            const M = Ge([b, g]), G = K(e, M);
            C(G);
          }
          return A;
        }
        function Ce($) {
          if (d = !0, g = $, f) {
            const M = Ge([b, g]), G = K(e, M);
            C(G);
          }
          return A;
        }
        function de() {
        }
        return p = rt(de, J, Me), R = rt(de, J, Ce), k(r._closedPromise, ($) => (Z(p._readableStreamController, $), Z(R._readableStreamController, $), (!f || !d) && C(void 0), null)), [p, R];
      }
      function ja(e) {
        let t = Oe(e), r = !1, o = !1, i = !1, f = !1, d = !1, b, g, p, R, C;
        const A = E((_) => {
          C = _;
        });
        function J(_) {
          k(_._closedPromise, (T) => (_ !== t || (Y(p._readableStreamController, T), Y(R._readableStreamController, T), (!f || !d) && C(void 0)), null));
        }
        function Me() {
          ve(t) && (ae(t), t = Oe(e), J(t)), Ye(t, {
            _chunkSteps: (T) => {
              oe(() => {
                o = !1, i = !1;
                const B = T;
                let H = T;
                if (!f && !d)
                  try {
                    H = un(T);
                  } catch (Ue) {
                    Y(p._readableStreamController, Ue), Y(R._readableStreamController, Ue), C(K(e, Ue));
                    return;
                  }
                f || yt(p._readableStreamController, B), d || yt(R._readableStreamController, H), r = !1, o ? de() : i && $();
              });
            },
            _closeSteps: () => {
              r = !1, f || Ze(p._readableStreamController), d || Ze(R._readableStreamController), p._readableStreamController._pendingPullIntos.length > 0 && _t(p._readableStreamController, 0), R._readableStreamController._pendingPullIntos.length > 0 && _t(R._readableStreamController, 0), (!f || !d) && C(void 0);
            },
            _errorSteps: () => {
              r = !1;
            }
          });
        }
        function Ce(_, T) {
          be(t) && (ae(t), t = Rn(e), J(t));
          const B = T ? R : p, H = T ? p : R;
          Pn(t, _, 1, {
            _chunkSteps: (Ne) => {
              oe(() => {
                o = !1, i = !1;
                const xe = T ? d : f;
                if (T ? f : d)
                  xe || gt(B._readableStreamController, Ne);
                else {
                  let so;
                  try {
                    so = un(Ne);
                  } catch (zr) {
                    Y(B._readableStreamController, zr), Y(H._readableStreamController, zr), C(K(e, zr));
                    return;
                  }
                  xe || gt(B._readableStreamController, Ne), yt(H._readableStreamController, so);
                }
                r = !1, o ? de() : i && $();
              });
            },
            _closeSteps: (Ne) => {
              r = !1;
              const xe = T ? d : f, $t = T ? f : d;
              xe || Ze(B._readableStreamController), $t || Ze(H._readableStreamController), Ne !== void 0 && (xe || gt(B._readableStreamController, Ne), !$t && H._readableStreamController._pendingPullIntos.length > 0 && _t(H._readableStreamController, 0)), (!xe || !$t) && C(void 0);
            },
            _errorSteps: () => {
              r = !1;
            }
          });
        }
        function de() {
          if (r)
            return o = !0, w(void 0);
          r = !0;
          const _ = pr(p._readableStreamController);
          return _ === null ? Me() : Ce(_._view, !1), w(void 0);
        }
        function $() {
          if (r)
            return i = !0, w(void 0);
          r = !0;
          const _ = pr(R._readableStreamController);
          return _ === null ? Me() : Ce(_._view, !0), w(void 0);
        }
        function M(_) {
          if (f = !0, b = _, d) {
            const T = Ge([b, g]), B = K(e, T);
            C(B);
          }
          return A;
        }
        function G(_) {
          if (d = !0, g = _, f) {
            const T = Ge([b, g]), B = K(e, T);
            C(B);
          }
          return A;
        }
        function ce() {
        }
        return p = Vn(ce, de, M), R = Vn(ce, $, G), J(t), [p, R];
      }
      function $a(e) {
        return l(e) && typeof e.getReader < "u";
      }
      function Ma(e) {
        return $a(e) ? Na(e.getReader()) : Ua(e);
      }
      function Ua(e) {
        let t;
        const r = ln(e, "async"), o = u;
        function i() {
          let d;
          try {
            d = Oo(r);
          } catch (g) {
            return m(g);
          }
          const b = w(d);
          return O(b, (g) => {
            if (!l(g))
              throw new TypeError("The promise returned by the iterator.next() method must fulfill with an object");
            if (Io(g))
              We(t._readableStreamController);
            else {
              const R = zo(g);
              De(t._readableStreamController, R);
            }
          });
        }
        function f(d) {
          const b = r.iterator;
          let g;
          try {
            g = mt(b, "return");
          } catch (C) {
            return m(C);
          }
          if (g === void 0)
            return w(void 0);
          let p;
          try {
            p = q(g, b, [d]);
          } catch (C) {
            return m(C);
          }
          const R = w(p);
          return O(R, (C) => {
            if (!l(C))
              throw new TypeError("The promise returned by the iterator.return() method must fulfill with an object");
          });
        }
        return t = rt(o, i, f, 0), t;
      }
      function Na(e) {
        let t;
        const r = u;
        function o() {
          let f;
          try {
            f = e.read();
          } catch (d) {
            return m(d);
          }
          return O(f, (d) => {
            if (!l(d))
              throw new TypeError("The promise returned by the reader.read() method must fulfill with an object");
            if (d.done)
              We(t._readableStreamController);
            else {
              const b = d.value;
              De(t._readableStreamController, b);
            }
          });
        }
        function i(f) {
          try {
            return w(e.cancel(f));
          } catch (d) {
            return m(d);
          }
        }
        return t = rt(r, o, i, 0), t;
      }
      function xa(e, t) {
        ee(e, t);
        const r = e, o = r?.autoAllocateChunkSize, i = r?.cancel, f = r?.pull, d = r?.start, b = r?.type;
        return {
          autoAllocateChunkSize: o === void 0 ? void 0 : nr(o, `${t} has member 'autoAllocateChunkSize' that`),
          cancel: i === void 0 ? void 0 : Ha(i, r, `${t} has member 'cancel' that`),
          pull: f === void 0 ? void 0 : Qa(f, r, `${t} has member 'pull' that`),
          start: d === void 0 ? void 0 : Va(d, r, `${t} has member 'start' that`),
          type: b === void 0 ? void 0 : Ya(b, `${t} has member 'type' that`)
        };
      }
      function Ha(e, t, r) {
        return V(e, r), (o) => I(e, t, [o]);
      }
      function Qa(e, t, r) {
        return V(e, r), (o) => I(e, t, [o]);
      }
      function Va(e, t, r) {
        return V(e, r), (o) => q(e, t, [o]);
      }
      function Ya(e, t) {
        if (e = `${e}`, e !== "bytes")
          throw new TypeError(`${t} '${e}' is not a valid enumeration value for ReadableStreamType`);
        return e;
      }
      function Ga(e, t) {
        return ee(e, t), { preventCancel: !!e?.preventCancel };
      }
      function Qn(e, t) {
        ee(e, t);
        const r = e?.preventAbort, o = e?.preventCancel, i = e?.preventClose, f = e?.signal;
        return f !== void 0 && Za(f, `${t} has member 'signal' that`), {
          preventAbort: !!r,
          preventCancel: !!o,
          preventClose: !!i,
          signal: f
        };
      }
      function Za(e, t) {
        if (!oa(e))
          throw new TypeError(`${t} is not an AbortSignal.`);
      }
      function Ka(e, t) {
        ee(e, t);
        const r = e?.readable;
        tr(r, "readable", "ReadableWritablePair"), or(r, `${t} has member 'readable' that`);
        const o = e?.writable;
        return tr(o, "writable", "ReadableWritablePair"), vn(o, `${t} has member 'writable' that`), { readable: r, writable: o };
      }
      class F {
        constructor(t = {}, r = {}) {
          t === void 0 ? t = null : Gr(t, "First parameter");
          const o = Rt(r, "Second parameter"), i = xa(t, "First parameter");
          if (qr(this), i.type === "bytes") {
            if (o.size !== void 0)
              throw new RangeError("The strategy for a byte stream cannot have a size function");
            const f = Je(o, 0);
            Ho(this, i, f);
          } else {
            const f = wt(o), d = Je(o, 1);
            Fa(this, i, d, f);
          }
        }
        /**
         * Whether or not the readable stream is locked to a {@link ReadableStreamDefaultReader | reader}.
         */
        get locked() {
          if (!Se(this))
            throw qe("locked");
          return we(this);
        }
        /**
         * Cancels the stream, signaling a loss of interest in the stream by a consumer.
         *
         * The supplied `reason` argument will be given to the underlying source's {@link UnderlyingSource.cancel | cancel()}
         * method, which might or might not use it.
         */
        cancel(t = void 0) {
          return Se(this) ? we(this) ? m(new TypeError("Cannot cancel a stream that already has a reader")) : K(this, t) : m(qe("cancel"));
        }
        getReader(t = void 0) {
          if (!Se(this))
            throw qe("getReader");
          return Vo(t, "First parameter").mode === void 0 ? Oe(this) : Rn(this);
        }
        pipeThrough(t, r = {}) {
          if (!Se(this))
            throw qe("pipeThrough");
          ie(t, 1, "pipeThrough");
          const o = Ka(t, "First parameter"), i = Qn(r, "Second parameter");
          if (we(this))
            throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
          if (Fe(o.writable))
            throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
          const f = Nn(this, o.writable, i.preventClose, i.preventAbort, i.preventCancel, i.signal);
          return x(f), o.readable;
        }
        pipeTo(t, r = {}) {
          if (!Se(this))
            return m(qe("pipeTo"));
          if (t === void 0)
            return m("Parameter 1 is required in 'pipeTo'.");
          if (!ze(t))
            return m(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
          let o;
          try {
            o = Qn(r, "Second parameter");
          } catch (i) {
            return m(i);
          }
          return we(this) ? m(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")) : Fe(t) ? m(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")) : Nn(this, t, o.preventClose, o.preventAbort, o.preventCancel, o.signal);
        }
        /**
         * Tees this readable stream, returning a two-element array containing the two resulting branches as
         * new {@link ReadableStream} instances.
         *
         * Teeing a stream will lock it, preventing any other consumer from acquiring a reader.
         * To cancel the stream, cancel both of the resulting branches; a composite cancellation reason will then be
         * propagated to the stream's underlying source.
         *
         * Note that the chunks seen in each branch will be the same object. If the chunks are not immutable,
         * this could allow interference between the two branches.
         */
        tee() {
          if (!Se(this))
            throw qe("tee");
          const t = La(this);
          return Ge(t);
        }
        values(t = void 0) {
          if (!Se(this))
            throw qe("values");
          const r = Ga(t, "First parameter");
          return qo(this, r.preventCancel);
        }
        [ur](t) {
          return this.values(t);
        }
        /**
         * Creates a new ReadableStream wrapping the provided iterable or async iterable.
         *
         * This can be used to adapt various kinds of objects into a readable stream,
         * such as an array, an async generator, or a Node.js readable stream.
         */
        static from(t) {
          return Ma(t);
        }
      }
      Object.defineProperties(F, {
        from: { enumerable: !0 }
      }), Object.defineProperties(F.prototype, {
        cancel: { enumerable: !0 },
        getReader: { enumerable: !0 },
        pipeThrough: { enumerable: !0 },
        pipeTo: { enumerable: !0 },
        tee: { enumerable: !0 },
        values: { enumerable: !0 },
        locked: { enumerable: !0 }
      }), c(F.from, "from"), c(F.prototype.cancel, "cancel"), c(F.prototype.getReader, "getReader"), c(F.prototype.pipeThrough, "pipeThrough"), c(F.prototype.pipeTo, "pipeTo"), c(F.prototype.tee, "tee"), c(F.prototype.values, "values"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(F.prototype, Symbol.toStringTag, {
        value: "ReadableStream",
        configurable: !0
      }), Object.defineProperty(F.prototype, ur, {
        value: F.prototype.values,
        writable: !0,
        configurable: !0
      });
      function rt(e, t, r, o = 1, i = () => 1) {
        const f = Object.create(F.prototype);
        qr(f);
        const d = Object.create(fe.prototype);
        return Hn(f, d, e, t, r, o, i), f;
      }
      function Vn(e, t, r) {
        const o = Object.create(F.prototype);
        qr(o);
        const i = Object.create(le.prototype);
        return wn(o, i, e, t, r, 0, void 0), o;
      }
      function qr(e) {
        e._state = "readable", e._reader = void 0, e._storedError = void 0, e._disturbed = !1;
      }
      function Se(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_readableStreamController") ? !1 : e instanceof F;
      }
      function we(e) {
        return e._reader !== void 0;
      }
      function K(e, t) {
        if (e._disturbed = !0, e._state === "closed")
          return w(void 0);
        if (e._state === "errored")
          return m(e._storedError);
        nt(e);
        const r = e._reader;
        if (r !== void 0 && ve(r)) {
          const i = r._readIntoRequests;
          r._readIntoRequests = new j(), i.forEach((f) => {
            f._closeSteps(void 0);
          });
        }
        const o = e._readableStreamController[Gt](t);
        return O(o, u);
      }
      function nt(e) {
        e._state = "closed";
        const t = e._reader;
        if (t !== void 0 && (Vr(t), be(t))) {
          const r = t._readRequests;
          t._readRequests = new j(), r.forEach((o) => {
            o._closeSteps();
          });
        }
      }
      function Yn(e, t) {
        e._state = "errored", e._storedError = t;
        const r = e._reader;
        r !== void 0 && (er(r, t), be(r) ? Xr(r, t) : En(r, t));
      }
      function qe(e) {
        return new TypeError(`ReadableStream.prototype.${e} can only be used on a ReadableStream`);
      }
      function Gn(e, t) {
        ee(e, t);
        const r = e?.highWaterMark;
        return tr(r, "highWaterMark", "QueuingStrategyInit"), {
          highWaterMark: rr(r)
        };
      }
      const Zn = (e) => e.byteLength;
      c(Zn, "size");
      class Ot {
        constructor(t) {
          ie(t, 1, "ByteLengthQueuingStrategy"), t = Gn(t, "First parameter"), this._byteLengthQueuingStrategyHighWaterMark = t.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */
        get highWaterMark() {
          if (!Jn(this))
            throw Kn("highWaterMark");
          return this._byteLengthQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by returning the value of its `byteLength` property.
         */
        get size() {
          if (!Jn(this))
            throw Kn("size");
          return Zn;
        }
      }
      Object.defineProperties(Ot.prototype, {
        highWaterMark: { enumerable: !0 },
        size: { enumerable: !0 }
      }), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(Ot.prototype, Symbol.toStringTag, {
        value: "ByteLengthQueuingStrategy",
        configurable: !0
      });
      function Kn(e) {
        return new TypeError(`ByteLengthQueuingStrategy.prototype.${e} can only be used on a ByteLengthQueuingStrategy`);
      }
      function Jn(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_byteLengthQueuingStrategyHighWaterMark") ? !1 : e instanceof Ot;
      }
      const Xn = () => 1;
      c(Xn, "size");
      class It {
        constructor(t) {
          ie(t, 1, "CountQueuingStrategy"), t = Gn(t, "First parameter"), this._countQueuingStrategyHighWaterMark = t.highWaterMark;
        }
        /**
         * Returns the high water mark provided to the constructor.
         */
        get highWaterMark() {
          if (!to(this))
            throw eo("highWaterMark");
          return this._countQueuingStrategyHighWaterMark;
        }
        /**
         * Measures the size of `chunk` by always returning 1.
         * This ensures that the total queue size is a count of the number of chunks in the queue.
         */
        get size() {
          if (!to(this))
            throw eo("size");
          return Xn;
        }
      }
      Object.defineProperties(It.prototype, {
        highWaterMark: { enumerable: !0 },
        size: { enumerable: !0 }
      }), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(It.prototype, Symbol.toStringTag, {
        value: "CountQueuingStrategy",
        configurable: !0
      });
      function eo(e) {
        return new TypeError(`CountQueuingStrategy.prototype.${e} can only be used on a CountQueuingStrategy`);
      }
      function to(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_countQueuingStrategyHighWaterMark") ? !1 : e instanceof It;
      }
      function Ja(e, t) {
        ee(e, t);
        const r = e?.cancel, o = e?.flush, i = e?.readableType, f = e?.start, d = e?.transform, b = e?.writableType;
        return {
          cancel: r === void 0 ? void 0 : ri(r, e, `${t} has member 'cancel' that`),
          flush: o === void 0 ? void 0 : Xa(o, e, `${t} has member 'flush' that`),
          readableType: i,
          start: f === void 0 ? void 0 : ei(f, e, `${t} has member 'start' that`),
          transform: d === void 0 ? void 0 : ti(d, e, `${t} has member 'transform' that`),
          writableType: b
        };
      }
      function Xa(e, t, r) {
        return V(e, r), (o) => I(e, t, [o]);
      }
      function ei(e, t, r) {
        return V(e, r), (o) => q(e, t, [o]);
      }
      function ti(e, t, r) {
        return V(e, r), (o, i) => I(e, t, [o, i]);
      }
      function ri(e, t, r) {
        return V(e, r), (o) => I(e, t, [o]);
      }
      class zt {
        constructor(t = {}, r = {}, o = {}) {
          t === void 0 && (t = null);
          const i = Rt(r, "Second parameter"), f = Rt(o, "Third parameter"), d = Ja(t, "First parameter");
          if (d.readableType !== void 0)
            throw new RangeError("Invalid readableType specified");
          if (d.writableType !== void 0)
            throw new RangeError("Invalid writableType specified");
          const b = Je(f, 0), g = wt(f), p = Je(i, 1), R = wt(i);
          let C;
          const A = E((J) => {
            C = J;
          });
          ni(this, A, p, R, b, g), ai(this, d), d.start !== void 0 ? C(d.start(this._transformStreamController)) : C(void 0);
        }
        /**
         * The readable side of the transform stream.
         */
        get readable() {
          if (!ro(this))
            throw io("readable");
          return this._readable;
        }
        /**
         * The writable side of the transform stream.
         */
        get writable() {
          if (!ro(this))
            throw io("writable");
          return this._writable;
        }
      }
      Object.defineProperties(zt.prototype, {
        readable: { enumerable: !0 },
        writable: { enumerable: !0 }
      }), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(zt.prototype, Symbol.toStringTag, {
        value: "TransformStream",
        configurable: !0
      });
      function ni(e, t, r, o, i, f) {
        function d() {
          return t;
        }
        function b(A) {
          return li(e, A);
        }
        function g(A) {
          return ui(e, A);
        }
        function p() {
          return fi(e);
        }
        e._writable = sa(d, b, p, g, r, o);
        function R() {
          return di(e);
        }
        function C(A) {
          return ci(e, A);
        }
        e._readable = rt(d, R, C, i, f), e._backpressure = void 0, e._backpressureChangePromise = void 0, e._backpressureChangePromise_resolve = void 0, Ft(e, !0), e._transformStreamController = void 0;
      }
      function ro(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_transformStreamController") ? !1 : e instanceof zt;
      }
      function no(e, t) {
        Z(e._readable._readableStreamController, t), kr(e, t);
      }
      function kr(e, t) {
        Dt(e._transformStreamController), Xe(e._writable._writableStreamController, t), Or(e);
      }
      function Or(e) {
        e._backpressure && Ft(e, !1);
      }
      function Ft(e, t) {
        e._backpressureChangePromise !== void 0 && e._backpressureChangePromise_resolve(), e._backpressureChangePromise = E((r) => {
          e._backpressureChangePromise_resolve = r;
        }), e._backpressure = t;
      }
      class Re {
        constructor() {
          throw new TypeError("Illegal constructor");
        }
        /**
         * Returns the desired size to fill the readable side’s internal queue. It can be negative, if the queue is over-full.
         */
        get desiredSize() {
          if (!Lt(this))
            throw jt("desiredSize");
          const t = this._controlledTransformStream._readable._readableStreamController;
          return Wr(t);
        }
        enqueue(t = void 0) {
          if (!Lt(this))
            throw jt("enqueue");
          oo(this, t);
        }
        /**
         * Errors both the readable side and the writable side of the controlled transform stream, making all future
         * interactions with it fail with the given error `e`. Any chunks queued for transformation will be discarded.
         */
        error(t = void 0) {
          if (!Lt(this))
            throw jt("error");
          ii(this, t);
        }
        /**
         * Closes the readable side and errors the writable side of the controlled transform stream. This is useful when the
         * transformer only needs to consume a portion of the chunks written to the writable side.
         */
        terminate() {
          if (!Lt(this))
            throw jt("terminate");
          si(this);
        }
      }
      Object.defineProperties(Re.prototype, {
        enqueue: { enumerable: !0 },
        error: { enumerable: !0 },
        terminate: { enumerable: !0 },
        desiredSize: { enumerable: !0 }
      }), c(Re.prototype.enqueue, "enqueue"), c(Re.prototype.error, "error"), c(Re.prototype.terminate, "terminate"), typeof Symbol.toStringTag == "symbol" && Object.defineProperty(Re.prototype, Symbol.toStringTag, {
        value: "TransformStreamDefaultController",
        configurable: !0
      });
      function Lt(e) {
        return !l(e) || !Object.prototype.hasOwnProperty.call(e, "_controlledTransformStream") ? !1 : e instanceof Re;
      }
      function oi(e, t, r, o, i) {
        t._controlledTransformStream = e, e._transformStreamController = t, t._transformAlgorithm = r, t._flushAlgorithm = o, t._cancelAlgorithm = i, t._finishPromise = void 0, t._finishPromise_resolve = void 0, t._finishPromise_reject = void 0;
      }
      function ai(e, t) {
        const r = Object.create(Re.prototype);
        let o, i, f;
        t.transform !== void 0 ? o = (d) => t.transform(d, r) : o = (d) => {
          try {
            return oo(r, d), w(void 0);
          } catch (b) {
            return m(b);
          }
        }, t.flush !== void 0 ? i = () => t.flush(r) : i = () => w(void 0), t.cancel !== void 0 ? f = (d) => t.cancel(d) : f = () => w(void 0), oi(e, r, o, i, f);
      }
      function Dt(e) {
        e._transformAlgorithm = void 0, e._flushAlgorithm = void 0, e._cancelAlgorithm = void 0;
      }
      function oo(e, t) {
        const r = e._controlledTransformStream, o = r._readable._readableStreamController;
        if (!je(o))
          throw new TypeError("Readable side is not in a state that permits enqueue");
        try {
          De(o, t);
        } catch (f) {
          throw kr(r, f), r._readable._storedError;
        }
        za(o) !== r._backpressure && Ft(r, !0);
      }
      function ii(e, t) {
        no(e._controlledTransformStream, t);
      }
      function ao(e, t) {
        const r = e._transformAlgorithm(t);
        return O(r, void 0, (o) => {
          throw no(e._controlledTransformStream, o), o;
        });
      }
      function si(e) {
        const t = e._controlledTransformStream, r = t._readable._readableStreamController;
        We(r);
        const o = new TypeError("TransformStream terminated");
        kr(t, o);
      }
      function li(e, t) {
        const r = e._transformStreamController;
        if (e._backpressure) {
          const o = e._backpressureChangePromise;
          return O(o, () => {
            const i = e._writable;
            if (i._state === "erroring")
              throw i._storedError;
            return ao(r, t);
          });
        }
        return ao(r, t);
      }
      function ui(e, t) {
        const r = e._transformStreamController;
        if (r._finishPromise !== void 0)
          return r._finishPromise;
        const o = e._readable;
        r._finishPromise = E((f, d) => {
          r._finishPromise_resolve = f, r._finishPromise_reject = d;
        });
        const i = r._cancelAlgorithm(t);
        return Dt(r), y(i, () => (o._state === "errored" ? $e(r, o._storedError) : (Z(o._readableStreamController, t), Ir(r)), null), (f) => (Z(o._readableStreamController, f), $e(r, f), null)), r._finishPromise;
      }
      function fi(e) {
        const t = e._transformStreamController;
        if (t._finishPromise !== void 0)
          return t._finishPromise;
        const r = e._readable;
        t._finishPromise = E((i, f) => {
          t._finishPromise_resolve = i, t._finishPromise_reject = f;
        });
        const o = t._flushAlgorithm();
        return Dt(t), y(o, () => (r._state === "errored" ? $e(t, r._storedError) : (We(r._readableStreamController), Ir(t)), null), (i) => (Z(r._readableStreamController, i), $e(t, i), null)), t._finishPromise;
      }
      function di(e) {
        return Ft(e, !1), e._backpressureChangePromise;
      }
      function ci(e, t) {
        const r = e._transformStreamController;
        if (r._finishPromise !== void 0)
          return r._finishPromise;
        const o = e._writable;
        r._finishPromise = E((f, d) => {
          r._finishPromise_resolve = f, r._finishPromise_reject = d;
        });
        const i = r._cancelAlgorithm(t);
        return Dt(r), y(i, () => (o._state === "errored" ? $e(r, o._storedError) : (Xe(o._writableStreamController, t), Or(e), Ir(r)), null), (f) => (Xe(o._writableStreamController, f), Or(e), $e(r, f), null)), r._finishPromise;
      }
      function jt(e) {
        return new TypeError(`TransformStreamDefaultController.prototype.${e} can only be used on a TransformStreamDefaultController`);
      }
      function Ir(e) {
        e._finishPromise_resolve !== void 0 && (e._finishPromise_resolve(), e._finishPromise_resolve = void 0, e._finishPromise_reject = void 0);
      }
      function $e(e, t) {
        e._finishPromise_reject !== void 0 && (x(e._finishPromise), e._finishPromise_reject(t), e._finishPromise_resolve = void 0, e._finishPromise_reject = void 0);
      }
      function io(e) {
        return new TypeError(`TransformStream.prototype.${e} can only be used on a TransformStream`);
      }
      a.ByteLengthQueuingStrategy = Ot, a.CountQueuingStrategy = It, a.ReadableByteStreamController = le, a.ReadableStream = F, a.ReadableStreamBYOBReader = _e, a.ReadableStreamBYOBRequest = Te, a.ReadableStreamDefaultController = fe, a.ReadableStreamDefaultReader = me, a.TransformStream = zt, a.TransformStreamDefaultController = Re, a.WritableStream = ge, a.WritableStreamDefaultController = Le, a.WritableStreamDefaultWriter = ue;
    }));
  })(at, at.exports)), at.exports;
}
var co;
function wi() {
  if (co) return uo;
  co = 1;
  const s = 65536;
  if (!globalThis.ReadableStream)
    try {
      const n = require("node:process"), { emitWarning: a } = n;
      try {
        n.emitWarning = () => {
        }, Object.assign(globalThis, require("node:stream/web")), n.emitWarning = a;
      } catch (u) {
        throw n.emitWarning = a, u;
      }
    } catch {
      Object.assign(globalThis, Si());
    }
  try {
    const { Blob: n } = require("buffer");
    n && !n.prototype.stream && (n.prototype.stream = function(u) {
      let l = 0;
      const h = this;
      return new ReadableStream({
        type: "bytes",
        async pull(c) {
          const v = await h.slice(l, Math.min(h.size, l + s)).arrayBuffer();
          l += v.byteLength, c.enqueue(new Uint8Array(v)), l === h.size && c.close();
        }
      });
    });
  } catch {
  }
  return uo;
}
wi();
const ho = 65536;
async function* Fr(s, n = !0) {
  for (const a of s)
    if ("stream" in a)
      yield* (
        /** @type {AsyncIterableIterator<Uint8Array>} */
        a.stream()
      );
    else if (ArrayBuffer.isView(a))
      if (n) {
        let u = a.byteOffset;
        const l = a.byteOffset + a.byteLength;
        for (; u !== l; ) {
          const h = Math.min(l - u, ho), c = a.buffer.slice(u, u + h);
          u += c.byteLength, yield new Uint8Array(c);
        }
      } else
        yield a;
    else {
      let u = 0, l = (
        /** @type {Blob} */
        a
      );
      for (; u !== l.size; ) {
        const c = await l.slice(u, Math.min(l.size, u + ho)).arrayBuffer();
        u += c.byteLength, yield new Uint8Array(c);
      }
    }
}
const _o = class $r {
  /** @type {Array.<(Blob|Uint8Array)>} */
  #e = [];
  #t = "";
  #r = 0;
  #n = "transparent";
  /**
   * The Blob() constructor returns a new Blob object. The content
   * of the blob consists of the concatenation of the values given
   * in the parameter array.
   *
   * @param {*} blobParts
   * @param {{ type?: string, endings?: string }} [options]
   */
  constructor(n = [], a = {}) {
    if (typeof n != "object" || n === null)
      throw new TypeError("Failed to construct 'Blob': The provided value cannot be converted to a sequence.");
    if (typeof n[Symbol.iterator] != "function")
      throw new TypeError("Failed to construct 'Blob': The object must have a callable @@iterator property.");
    if (typeof a != "object" && typeof a != "function")
      throw new TypeError("Failed to construct 'Blob': parameter 2 cannot convert to dictionary.");
    a === null && (a = {});
    const u = new TextEncoder();
    for (const h of n) {
      let c;
      ArrayBuffer.isView(h) ? c = new Uint8Array(h.buffer.slice(h.byteOffset, h.byteOffset + h.byteLength)) : h instanceof ArrayBuffer ? c = new Uint8Array(h.slice(0)) : h instanceof $r ? c = h : c = u.encode(`${h}`), this.#r += ArrayBuffer.isView(c) ? c.byteLength : c.size, this.#e.push(c);
    }
    this.#n = `${a.endings === void 0 ? "transparent" : a.endings}`;
    const l = a.type === void 0 ? "" : String(a.type);
    this.#t = /^[\x20-\x7E]*$/.test(l) ? l : "";
  }
  /**
   * The Blob interface's size property returns the
   * size of the Blob in bytes.
   */
  get size() {
    return this.#r;
  }
  /**
   * The type property of a Blob object returns the MIME type of the file.
   */
  get type() {
    return this.#t;
  }
  /**
   * The text() method in the Blob interface returns a Promise
   * that resolves with a string containing the contents of
   * the blob, interpreted as UTF-8.
   *
   * @return {Promise<string>}
   */
  async text() {
    const n = new TextDecoder();
    let a = "";
    for await (const u of Fr(this.#e, !1))
      a += n.decode(u, { stream: !0 });
    return a += n.decode(), a;
  }
  /**
   * The arrayBuffer() method in the Blob interface returns a
   * Promise that resolves with the contents of the blob as
   * binary data contained in an ArrayBuffer.
   *
   * @return {Promise<ArrayBuffer>}
   */
  async arrayBuffer() {
    const n = new Uint8Array(this.size);
    let a = 0;
    for await (const u of Fr(this.#e, !1))
      n.set(u, a), a += u.length;
    return n.buffer;
  }
  stream() {
    const n = Fr(this.#e, !0);
    return new globalThis.ReadableStream({
      // @ts-ignore
      type: "bytes",
      async pull(a) {
        const u = await n.next();
        u.done ? a.close() : a.enqueue(u.value);
      },
      async cancel() {
        await n.return();
      }
    });
  }
  /**
   * The Blob interface's slice() method creates and returns a
   * new Blob object which contains data from a subset of the
   * blob on which it's called.
   *
   * @param {number} [start]
   * @param {number} [end]
   * @param {string} [type]
   */
  slice(n = 0, a = this.size, u = "") {
    const { size: l } = this;
    let h = n < 0 ? Math.max(l + n, 0) : Math.min(n, l), c = a < 0 ? Math.max(l + a, 0) : Math.min(a, l);
    const P = Math.max(c - h, 0), v = this.#e, S = [];
    let E = 0;
    for (const m of v) {
      if (E >= P)
        break;
      const W = ArrayBuffer.isView(m) ? m.byteLength : m.size;
      if (h && W <= h)
        h -= W, c -= W;
      else {
        let y;
        ArrayBuffer.isView(m) ? (y = m.subarray(h, Math.min(W, c)), E += y.byteLength) : (y = m.slice(h, Math.min(W, c)), E += y.size), c -= W, S.push(y), h = 0;
      }
    }
    const w = new $r([], { type: String(u).toLowerCase() });
    return w.#r = P, w.#e = S, w;
  }
  get [Symbol.toStringTag]() {
    return "Blob";
  }
  static [Symbol.hasInstance](n) {
    return n && typeof n == "object" && typeof n.constructor == "function" && (typeof n.stream == "function" || typeof n.arrayBuffer == "function") && /^(Blob|File)$/.test(n[Symbol.toStringTag]);
  }
};
Object.defineProperties(_o.prototype, {
  size: { enumerable: !0 },
  type: { enumerable: !0 },
  slice: { enumerable: !0 }
});
const xt = _o, Ri = class extends xt {
  #e = 0;
  #t = "";
  /**
   * @param {*[]} fileBits
   * @param {string} fileName
   * @param {{lastModified?: number, type?: string}} options
   */
  // @ts-ignore
  constructor(n, a, u = {}) {
    if (arguments.length < 2)
      throw new TypeError(`Failed to construct 'File': 2 arguments required, but only ${arguments.length} present.`);
    super(n, u), u === null && (u = {});
    const l = u.lastModified === void 0 ? Date.now() : Number(u.lastModified);
    Number.isNaN(l) || (this.#e = l), this.#t = String(a);
  }
  get name() {
    return this.#t;
  }
  get lastModified() {
    return this.#e;
  }
  get [Symbol.toStringTag]() {
    return "File";
  }
  static [Symbol.hasInstance](n) {
    return !!n && n instanceof xt && /^(File)$/.test(n[Symbol.toStringTag]);
  }
}, Ci = Ri;
var { toStringTag: it, iterator: Ti, hasInstance: Pi } = Symbol, mo = Math.random, Ei = "append,set,get,getAll,delete,keys,values,entries,forEach,constructor".split(","), bo = (s, n, a) => (s += "", /^(Blob|File)$/.test(n && n[it]) ? [(a = a !== void 0 ? a + "" : n[it] == "File" ? n.name : "blob", s), n.name !== a || n[it] == "blob" ? new Ci([n], a, n) : n] : [s, n + ""]), Lr = (s, n) => (n ? s : s.replace(/\r?\n|\r/g, `\r
`)).replace(/\n/g, "%0A").replace(/\r/g, "%0D").replace(/"/g, "%22"), ke = (s, n, a) => {
  if (n.length < a)
    throw new TypeError(`Failed to execute '${s}' on 'FormData': ${a} arguments required, but only ${n.length} present.`);
};
const Mr = class {
  #e = [];
  constructor(...n) {
    if (n.length) throw new TypeError("Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.");
  }
  get [it]() {
    return "FormData";
  }
  [Ti]() {
    return this.entries();
  }
  static [Pi](n) {
    return n && typeof n == "object" && n[it] === "FormData" && !Ei.some((a) => typeof n[a] != "function");
  }
  append(...n) {
    ke("append", arguments, 2), this.#e.push(bo(...n));
  }
  delete(n) {
    ke("delete", arguments, 1), n += "", this.#e = this.#e.filter(([a]) => a !== n);
  }
  get(n) {
    ke("get", arguments, 1), n += "";
    for (var a = this.#e, u = a.length, l = 0; l < u; l++) if (a[l][0] === n) return a[l][1];
    return null;
  }
  getAll(n, a) {
    return ke("getAll", arguments, 1), a = [], n += "", this.#e.forEach((u) => u[0] === n && a.push(u[1])), a;
  }
  has(n) {
    return ke("has", arguments, 1), n += "", this.#e.some((a) => a[0] === n);
  }
  forEach(n, a) {
    ke("forEach", arguments, 1);
    for (var [u, l] of this) n.call(a, l, u, this);
  }
  set(...n) {
    ke("set", arguments, 2);
    var a = [], u = !0;
    n = bo(...n), this.#e.forEach((l) => {
      l[0] === n[0] ? u && (u = !a.push(n)) : a.push(l);
    }), u && a.push(n), this.#e = a;
  }
  *entries() {
    yield* this.#e;
  }
  *keys() {
    for (var [n] of this) yield n;
  }
  *values() {
    for (var [, n] of this) yield n;
  }
};
function vi(s, n = xt) {
  var a = `${mo()}${mo()}`.replace(/\./g, "").slice(-28).padStart(32, "-"), u = [], l = `--${a}\r
Content-Disposition: form-data; name="`;
  return s.forEach((h, c) => typeof h == "string" ? u.push(l + Lr(c) + `"\r
\r
${h.replace(new RegExp("\\r(?!\\n)|(?<!\\r)\\n", "g"), `\r
`)}\r
`) : u.push(l + Lr(c) + `"; filename="${Lr(h.name, 1)}"\r
Content-Type: ${h.type || "application/octet-stream"}\r
\r
`, h, `\r
`)), u.push(`--${a}--`), new n(u, { type: "multipart/form-data; boundary=" + a });
}
class Yt extends Error {
  constructor(n, a) {
    super(n), Error.captureStackTrace(this, this.constructor), this.type = a;
  }
  get name() {
    return this.constructor.name;
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
}
class re extends Yt {
  /**
   * @param  {string} message -      Error message for human
   * @param  {string} [type] -        Error type for machine
   * @param  {SystemError} [systemError] - For Node.js system error
   */
  constructor(n, a, u) {
    super(n, a), u && (this.code = this.errno = u.code, this.erroredSysCall = u.syscall);
  }
}
const Ht = Symbol.toStringTag, go = (s) => typeof s == "object" && typeof s.append == "function" && typeof s.delete == "function" && typeof s.get == "function" && typeof s.getAll == "function" && typeof s.has == "function" && typeof s.set == "function" && typeof s.sort == "function" && s[Ht] === "URLSearchParams", Qt = (s) => s && typeof s == "object" && typeof s.arrayBuffer == "function" && typeof s.type == "string" && typeof s.stream == "function" && typeof s.constructor == "function" && /^(Blob|File)$/.test(s[Ht]), Ai = (s) => typeof s == "object" && (s[Ht] === "AbortSignal" || s[Ht] === "EventTarget"), Bi = (s, n) => {
  const a = new URL(n).hostname, u = new URL(s).hostname;
  return a === u || a.endsWith(`.${u}`);
}, Wi = (s, n) => {
  const a = new URL(n).protocol, u = new URL(s).protocol;
  return a === u;
}, qi = mi(ne.pipeline), U = /* @__PURE__ */ Symbol("Body internals");
class lt {
  constructor(n, {
    size: a = 0
  } = {}) {
    let u = null;
    n === null ? n = null : go(n) ? n = L.from(n.toString()) : Qt(n) || L.isBuffer(n) || (Nt.isAnyArrayBuffer(n) ? n = L.from(n) : ArrayBuffer.isView(n) ? n = L.from(n.buffer, n.byteOffset, n.byteLength) : n instanceof ne || (n instanceof Mr ? (n = vi(n), u = n.type.split("=")[1]) : n = L.from(String(n))));
    let l = n;
    L.isBuffer(n) ? l = ne.Readable.from(n) : Qt(n) && (l = ne.Readable.from(n.stream())), this[U] = {
      body: n,
      stream: l,
      boundary: u,
      disturbed: !1,
      error: null
    }, this.size = a, n instanceof ne && n.on("error", (h) => {
      const c = h instanceof Yt ? h : new re(`Invalid response body while trying to fetch ${this.url}: ${h.message}`, "system", h);
      this[U].error = c;
    });
  }
  get body() {
    return this[U].stream;
  }
  get bodyUsed() {
    return this[U].disturbed;
  }
  /**
   * Decode response as ArrayBuffer
   *
   * @return  Promise
   */
  async arrayBuffer() {
    const { buffer: n, byteOffset: a, byteLength: u } = await Dr(this);
    return n.slice(a, a + u);
  }
  async formData() {
    const n = this.headers.get("content-type");
    if (n.startsWith("application/x-www-form-urlencoded")) {
      const u = new Mr(), l = new URLSearchParams(await this.text());
      for (const [h, c] of l)
        u.append(h, c);
      return u;
    }
    const { toFormData: a } = await import("./multipart-parser-C39c6GFX.js");
    return a(this.body, n);
  }
  /**
   * Return raw response as Blob
   *
   * @return Promise
   */
  async blob() {
    const n = this.headers && this.headers.get("content-type") || this[U].body && this[U].body.type || "", a = await this.arrayBuffer();
    return new xt([a], {
      type: n
    });
  }
  /**
   * Decode response as json
   *
   * @return  Promise
   */
  async json() {
    const n = await this.text();
    return JSON.parse(n);
  }
  /**
   * Decode response as text
   *
   * @return  Promise
   */
  async text() {
    const n = await Dr(this);
    return new TextDecoder().decode(n);
  }
  /**
   * Decode response as buffer (non-spec api)
   *
   * @return  Promise
   */
  buffer() {
    return Dr(this);
  }
}
lt.prototype.buffer = Vt(lt.prototype.buffer, "Please use 'response.arrayBuffer()' instead of 'response.buffer()'", "node-fetch#buffer");
Object.defineProperties(lt.prototype, {
  body: { enumerable: !0 },
  bodyUsed: { enumerable: !0 },
  arrayBuffer: { enumerable: !0 },
  blob: { enumerable: !0 },
  json: { enumerable: !0 },
  text: { enumerable: !0 },
  data: { get: Vt(
    () => {
    },
    "data doesn't exist, use json(), text(), arrayBuffer(), or body instead",
    "https://github.com/node-fetch/node-fetch/issues/1000 (response)"
  ) }
});
async function Dr(s) {
  if (s[U].disturbed)
    throw new TypeError(`body used already for: ${s.url}`);
  if (s[U].disturbed = !0, s[U].error)
    throw s[U].error;
  const { body: n } = s;
  if (n === null)
    return L.alloc(0);
  if (!(n instanceof ne))
    return L.alloc(0);
  const a = [];
  let u = 0;
  try {
    for await (const l of n) {
      if (s.size > 0 && u + l.length > s.size) {
        const h = new re(`content size at ${s.url} over limit: ${s.size}`, "max-size");
        throw n.destroy(h), h;
      }
      u += l.length, a.push(l);
    }
  } catch (l) {
    throw l instanceof Yt ? l : new re(`Invalid response body while trying to fetch ${s.url}: ${l.message}`, "system", l);
  }
  if (n.readableEnded === !0 || n._readableState.ended === !0)
    try {
      return a.every((l) => typeof l == "string") ? L.from(a.join("")) : L.concat(a, u);
    } catch (l) {
      throw new re(`Could not create Buffer from response body for ${s.url}: ${l.message}`, "system", l);
    }
  else
    throw new re(`Premature close of server response while trying to fetch ${s.url}`);
}
const Nr = (s, n) => {
  let a, u, { body: l } = s[U];
  if (s.bodyUsed)
    throw new Error("cannot clone body after it is used");
  return l instanceof ne && typeof l.getBoundary != "function" && (a = new Ut({ highWaterMark: n }), u = new Ut({ highWaterMark: n }), l.pipe(a), l.pipe(u), s[U].stream = a, l = u), l;
}, ki = Vt(
  (s) => s.getBoundary(),
  "form-data doesn't follow the spec and requires special treatment. Use alternative package",
  "https://github.com/node-fetch/node-fetch/issues/1167"
), So = (s, n) => s === null ? null : typeof s == "string" ? "text/plain;charset=UTF-8" : go(s) ? "application/x-www-form-urlencoded;charset=UTF-8" : Qt(s) ? s.type || null : L.isBuffer(s) || Nt.isAnyArrayBuffer(s) || ArrayBuffer.isView(s) ? null : s instanceof Mr ? `multipart/form-data; boundary=${n[U].boundary}` : s && typeof s.getBoundary == "function" ? `multipart/form-data;boundary=${ki(s)}` : s instanceof ne ? null : "text/plain;charset=UTF-8", Oi = (s) => {
  const { body: n } = s[U];
  return n === null ? 0 : Qt(n) ? n.size : L.isBuffer(n) ? n.length : n && typeof n.getLengthSync == "function" && n.hasKnownLength && n.hasKnownLength() ? n.getLengthSync() : null;
}, Ii = async (s, { body: n }) => {
  n === null ? s.end() : await qi(n, s);
}, Mt = typeof st.validateHeaderName == "function" ? st.validateHeaderName : (s) => {
  if (!/^[\^`\-\w!#$%&'*+.|~]+$/.test(s)) {
    const n = new TypeError(`Header name must be a valid HTTP token [${s}]`);
    throw Object.defineProperty(n, "code", { value: "ERR_INVALID_HTTP_TOKEN" }), n;
  }
}, Ur = typeof st.validateHeaderValue == "function" ? st.validateHeaderValue : (s, n) => {
  if (/[^\t\u0020-\u007E\u0080-\u00FF]/.test(n)) {
    const a = new TypeError(`Invalid character in header content ["${s}"]`);
    throw Object.defineProperty(a, "code", { value: "ERR_INVALID_CHAR" }), a;
  }
};
class he extends URLSearchParams {
  /**
   * Headers class
   *
   * @constructor
   * @param {HeadersInit} [init] - Response headers
   */
  constructor(n) {
    let a = [];
    if (n instanceof he) {
      const u = n.raw();
      for (const [l, h] of Object.entries(u))
        a.push(...h.map((c) => [l, c]));
    } else if (n != null) if (typeof n == "object" && !Nt.isBoxedPrimitive(n)) {
      const u = n[Symbol.iterator];
      if (u == null)
        a.push(...Object.entries(n));
      else {
        if (typeof u != "function")
          throw new TypeError("Header pairs must be iterable");
        a = [...n].map((l) => {
          if (typeof l != "object" || Nt.isBoxedPrimitive(l))
            throw new TypeError("Each header pair must be an iterable object");
          return [...l];
        }).map((l) => {
          if (l.length !== 2)
            throw new TypeError("Each header pair must be a name/value tuple");
          return [...l];
        });
      }
    } else
      throw new TypeError("Failed to construct 'Headers': The provided value is not of type '(sequence<sequence<ByteString>> or record<ByteString, ByteString>)");
    return a = a.length > 0 ? a.map(([u, l]) => (Mt(u), Ur(u, String(l)), [String(u).toLowerCase(), String(l)])) : void 0, super(a), new Proxy(this, {
      get(u, l, h) {
        switch (l) {
          case "append":
          case "set":
            return (c, P) => (Mt(c), Ur(c, String(P)), URLSearchParams.prototype[l].call(
              u,
              String(c).toLowerCase(),
              String(P)
            ));
          case "delete":
          case "has":
          case "getAll":
            return (c) => (Mt(c), URLSearchParams.prototype[l].call(
              u,
              String(c).toLowerCase()
            ));
          case "keys":
            return () => (u.sort(), new Set(URLSearchParams.prototype.keys.call(u)).keys());
          default:
            return Reflect.get(u, l, h);
        }
      }
    });
  }
  get [Symbol.toStringTag]() {
    return this.constructor.name;
  }
  toString() {
    return Object.prototype.toString.call(this);
  }
  get(n) {
    const a = this.getAll(n);
    if (a.length === 0)
      return null;
    let u = a.join(", ");
    return /^content-encoding$/i.test(n) && (u = u.toLowerCase()), u;
  }
  forEach(n, a = void 0) {
    for (const u of this.keys())
      Reflect.apply(n, a, [this.get(u), u, this]);
  }
  *values() {
    for (const n of this.keys())
      yield this.get(n);
  }
  /**
   * @type {() => IterableIterator<[string, string]>}
   */
  *entries() {
    for (const n of this.keys())
      yield [n, this.get(n)];
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  /**
   * Node-fetch non-spec method
   * returning all headers and their values as array
   * @returns {Record<string, string[]>}
   */
  raw() {
    return [...this.keys()].reduce((n, a) => (n[a] = this.getAll(a), n), {});
  }
  /**
   * For better console.log(headers) and also to convert Headers into Node.js Request compatible format
   */
  [/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")]() {
    return [...this.keys()].reduce((n, a) => {
      const u = this.getAll(a);
      return a === "host" ? n[a] = u[0] : n[a] = u.length > 1 ? u : u[0], n;
    }, {});
  }
}
Object.defineProperties(
  he.prototype,
  ["get", "entries", "forEach", "values"].reduce((s, n) => (s[n] = { enumerable: !0 }, s), {})
);
function zi(s = []) {
  return new he(
    s.reduce((n, a, u, l) => (u % 2 === 0 && n.push(l.slice(u, u + 2)), n), []).filter(([n, a]) => {
      try {
        return Mt(n), Ur(n, String(a)), !0;
      } catch {
        return !1;
      }
    })
  );
}
const Fi = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]), wo = (s) => Fi.has(s), X = /* @__PURE__ */ Symbol("Response internals");
class Q extends lt {
  constructor(n = null, a = {}) {
    super(n, a);
    const u = a.status != null ? a.status : 200, l = new he(a.headers);
    if (n !== null && !l.has("Content-Type")) {
      const h = So(n, this);
      h && l.append("Content-Type", h);
    }
    this[X] = {
      type: "default",
      url: a.url,
      status: u,
      statusText: a.statusText || "",
      headers: l,
      counter: a.counter,
      highWaterMark: a.highWaterMark
    };
  }
  get type() {
    return this[X].type;
  }
  get url() {
    return this[X].url || "";
  }
  get status() {
    return this[X].status;
  }
  /**
   * Convenience property representing if the request ended normally
   */
  get ok() {
    return this[X].status >= 200 && this[X].status < 300;
  }
  get redirected() {
    return this[X].counter > 0;
  }
  get statusText() {
    return this[X].statusText;
  }
  get headers() {
    return this[X].headers;
  }
  get highWaterMark() {
    return this[X].highWaterMark;
  }
  /**
   * Clone this response
   *
   * @return  Response
   */
  clone() {
    return new Q(Nr(this, this.highWaterMark), {
      type: this.type,
      url: this.url,
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
      ok: this.ok,
      redirected: this.redirected,
      size: this.size,
      highWaterMark: this.highWaterMark
    });
  }
  /**
   * @param {string} url    The URL that the new response is to originate from.
   * @param {number} status An optional status code for the response (e.g., 302.)
   * @returns {Response}    A Response object.
   */
  static redirect(n, a = 302) {
    if (!wo(a))
      throw new RangeError('Failed to execute "redirect" on "response": Invalid status code');
    return new Q(null, {
      headers: {
        location: new URL(n).toString()
      },
      status: a
    });
  }
  static error() {
    const n = new Q(null, { status: 0, statusText: "" });
    return n[X].type = "error", n;
  }
  static json(n = void 0, a = {}) {
    const u = JSON.stringify(n);
    if (u === void 0)
      throw new TypeError("data is not JSON serializable");
    const l = new he(a && a.headers);
    return l.has("content-type") || l.set("content-type", "application/json"), new Q(u, {
      ...a,
      headers: l
    });
  }
  get [Symbol.toStringTag]() {
    return "Response";
  }
}
Object.defineProperties(Q.prototype, {
  type: { enumerable: !0 },
  url: { enumerable: !0 },
  status: { enumerable: !0 },
  ok: { enumerable: !0 },
  redirected: { enumerable: !0 },
  statusText: { enumerable: !0 },
  headers: { enumerable: !0 },
  clone: { enumerable: !0 }
});
const Li = (s) => {
  if (s.search)
    return s.search;
  const n = s.href.length - 1, a = s.hash || (s.href[n] === "#" ? "#" : "");
  return s.href[n - a.length] === "?" ? "?" : "";
};
function po(s, n = !1) {
  return s == null || (s = new URL(s), /^(about|blob|data):$/.test(s.protocol)) ? "no-referrer" : (s.username = "", s.password = "", s.hash = "", n && (s.pathname = "", s.search = ""), s);
}
const Ro = /* @__PURE__ */ new Set([
  "",
  "no-referrer",
  "no-referrer-when-downgrade",
  "same-origin",
  "origin",
  "strict-origin",
  "origin-when-cross-origin",
  "strict-origin-when-cross-origin",
  "unsafe-url"
]), Di = "strict-origin-when-cross-origin";
function ji(s) {
  if (!Ro.has(s))
    throw new TypeError(`Invalid referrerPolicy: ${s}`);
  return s;
}
function $i(s) {
  if (/^(http|ws)s:$/.test(s.protocol))
    return !0;
  const n = s.host.replace(/(^\[)|(]$)/g, ""), a = pi(n);
  return a === 4 && /^127\./.test(n) || a === 6 && /^(((0+:){7})|(::(0+:){0,6}))0*1$/.test(n) ? !0 : s.host === "localhost" || s.host.endsWith(".localhost") ? !1 : s.protocol === "file:";
}
function Ve(s) {
  return /^about:(blank|srcdoc)$/.test(s) || s.protocol === "data:" || /^(blob|filesystem):$/.test(s.protocol) ? !0 : $i(s);
}
function Mi(s, { referrerURLCallback: n, referrerOriginCallback: a } = {}) {
  if (s.referrer === "no-referrer" || s.referrerPolicy === "")
    return null;
  const u = s.referrerPolicy;
  if (s.referrer === "about:client")
    return "no-referrer";
  const l = s.referrer;
  let h = po(l), c = po(l, !0);
  h.toString().length > 4096 && (h = c), n && (h = n(h)), a && (c = a(c));
  const P = new URL(s.url);
  switch (u) {
    case "no-referrer":
      return "no-referrer";
    case "origin":
      return c;
    case "unsafe-url":
      return h;
    case "strict-origin":
      return Ve(h) && !Ve(P) ? "no-referrer" : c.toString();
    case "strict-origin-when-cross-origin":
      return h.origin === P.origin ? h : Ve(h) && !Ve(P) ? "no-referrer" : c;
    case "same-origin":
      return h.origin === P.origin ? h : "no-referrer";
    case "origin-when-cross-origin":
      return h.origin === P.origin ? h : c;
    case "no-referrer-when-downgrade":
      return Ve(h) && !Ve(P) ? "no-referrer" : h;
    default:
      throw new TypeError(`Invalid referrerPolicy: ${u}`);
  }
}
function Ui(s) {
  const n = (s.get("referrer-policy") || "").split(/[,\s]+/);
  let a = "";
  for (const u of n)
    u && Ro.has(u) && (a = u);
  return a;
}
const z = /* @__PURE__ */ Symbol("Request internals"), ot = (s) => typeof s == "object" && typeof s[z] == "object", Ni = Vt(
  () => {
  },
  ".data is not a valid RequestInit property, use .body instead",
  "https://github.com/node-fetch/node-fetch/issues/1000 (request)"
);
class ut extends lt {
  constructor(n, a = {}) {
    let u;
    if (ot(n) ? u = new URL(n.url) : (u = new URL(n), n = {}), u.username !== "" || u.password !== "")
      throw new TypeError(`${u} is an url with embedded credentials.`);
    let l = a.method || n.method || "GET";
    if (/^(delete|get|head|options|post|put)$/i.test(l) && (l = l.toUpperCase()), !ot(a) && "data" in a && Ni(), (a.body != null || ot(n) && n.body !== null) && (l === "GET" || l === "HEAD"))
      throw new TypeError("Request with GET/HEAD method cannot have body");
    const h = a.body ? a.body : ot(n) && n.body !== null ? Nr(n) : null;
    super(h, {
      size: a.size || n.size || 0
    });
    const c = new he(a.headers || n.headers || {});
    if (h !== null && !c.has("Content-Type")) {
      const S = So(h, this);
      S && c.set("Content-Type", S);
    }
    let P = ot(n) ? n.signal : null;
    if ("signal" in a && (P = a.signal), P != null && !Ai(P))
      throw new TypeError("Expected signal to be an instanceof AbortSignal or EventTarget");
    let v = a.referrer == null ? n.referrer : a.referrer;
    if (v === "")
      v = "no-referrer";
    else if (v) {
      const S = new URL(v);
      v = /^about:(\/\/)?client$/.test(S) ? "client" : S;
    } else
      v = void 0;
    this[z] = {
      method: l,
      redirect: a.redirect || n.redirect || "follow",
      headers: c,
      parsedURL: u,
      signal: P,
      referrer: v
    }, this.follow = a.follow === void 0 ? n.follow === void 0 ? 20 : n.follow : a.follow, this.compress = a.compress === void 0 ? n.compress === void 0 ? !0 : n.compress : a.compress, this.counter = a.counter || n.counter || 0, this.agent = a.agent || n.agent, this.highWaterMark = a.highWaterMark || n.highWaterMark || 16384, this.insecureHTTPParser = a.insecureHTTPParser || n.insecureHTTPParser || !1, this.referrerPolicy = a.referrerPolicy || n.referrerPolicy || "";
  }
  /** @returns {string} */
  get method() {
    return this[z].method;
  }
  /** @returns {string} */
  get url() {
    return bi(this[z].parsedURL);
  }
  /** @returns {Headers} */
  get headers() {
    return this[z].headers;
  }
  get redirect() {
    return this[z].redirect;
  }
  /** @returns {AbortSignal} */
  get signal() {
    return this[z].signal;
  }
  // https://fetch.spec.whatwg.org/#dom-request-referrer
  get referrer() {
    if (this[z].referrer === "no-referrer")
      return "";
    if (this[z].referrer === "client")
      return "about:client";
    if (this[z].referrer)
      return this[z].referrer.toString();
  }
  get referrerPolicy() {
    return this[z].referrerPolicy;
  }
  set referrerPolicy(n) {
    this[z].referrerPolicy = ji(n);
  }
  /**
   * Clone this request
   *
   * @return  Request
   */
  clone() {
    return new ut(this);
  }
  get [Symbol.toStringTag]() {
    return "Request";
  }
}
Object.defineProperties(ut.prototype, {
  method: { enumerable: !0 },
  url: { enumerable: !0 },
  headers: { enumerable: !0 },
  redirect: { enumerable: !0 },
  clone: { enumerable: !0 },
  signal: { enumerable: !0 },
  referrer: { enumerable: !0 },
  referrerPolicy: { enumerable: !0 }
});
const xi = (s) => {
  const { parsedURL: n } = s[z], a = new he(s[z].headers);
  a.has("Accept") || a.set("Accept", "*/*");
  let u = null;
  if (s.body === null && /^(post|put)$/i.test(s.method) && (u = "0"), s.body !== null) {
    const P = Oi(s);
    typeof P == "number" && !Number.isNaN(P) && (u = String(P));
  }
  u && a.set("Content-Length", u), s.referrerPolicy === "" && (s.referrerPolicy = Di), s.referrer && s.referrer !== "no-referrer" ? s[z].referrer = Mi(s) : s[z].referrer = "no-referrer", s[z].referrer instanceof URL && a.set("Referer", s.referrer), a.has("User-Agent") || a.set("User-Agent", "node-fetch"), s.compress && !a.has("Accept-Encoding") && a.set("Accept-Encoding", "gzip, deflate, br");
  let { agent: l } = s;
  typeof l == "function" && (l = l(n));
  const h = Li(n), c = {
    // Overwrite search to retain trailing ? (issue #776)
    path: n.pathname + h,
    // The following options are not expressed in the URL
    method: s.method,
    headers: a[/* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom")](),
    insecureHTTPParser: s.insecureHTTPParser,
    agent: l
  };
  return {
    /** @type {URL} */
    parsedURL: n,
    options: c
  };
};
class Hi extends Yt {
  constructor(n, a = "aborted") {
    super(n, a);
  }
}
var jr, yo;
function Qi() {
  if (yo) return jr;
  if (yo = 1, !globalThis.DOMException)
    try {
      const { MessageChannel: s } = require("worker_threads"), n = new s().port1, a = new ArrayBuffer();
      n.postMessage(a, [a, a]);
    } catch (s) {
      s.constructor.name === "DOMException" && (globalThis.DOMException = s.constructor);
    }
  return jr = globalThis.DOMException, jr;
}
Qi();
const { stat: us } = yi, Vi = /* @__PURE__ */ new Set(["data:", "http:", "https:"]);
async function Yi(s, n) {
  return new Promise((a, u) => {
    const l = new ut(s, n), { parsedURL: h, options: c } = xi(l);
    if (!Vi.has(h.protocol))
      throw new TypeError(`node-fetch cannot load ${s}. URL scheme "${h.protocol.replace(/:$/, "")}" is not supported.`);
    if (h.protocol === "data:") {
      const y = _i(l.url), N = new Q(y, { headers: { "Content-Type": y.typeFull } });
      a(N);
      return;
    }
    const P = (h.protocol === "https:" ? hi : st).request, { signal: v } = l;
    let S = null;
    const E = () => {
      const y = new Hi("The operation was aborted.");
      u(y), l.body && l.body instanceof ne.Readable && l.body.destroy(y), !(!S || !S.body) && S.body.emit("error", y);
    };
    if (v && v.aborted) {
      E();
      return;
    }
    const w = () => {
      E(), W();
    }, m = P(h.toString(), c);
    v && v.addEventListener("abort", w);
    const W = () => {
      m.abort(), v && v.removeEventListener("abort", w);
    };
    m.on("error", (y) => {
      u(new re(`request to ${l.url} failed, reason: ${y.message}`, "system", y)), W();
    }), Gi(m, (y) => {
      S && S.body && S.body.destroy(y);
    }), process.version < "v14" && m.on("socket", (y) => {
      let N;
      y.prependListener("end", () => {
        N = y._eventsCount;
      }), y.prependListener("close", (k) => {
        if (S && N < y._eventsCount && !k) {
          const O = new Error("Premature close");
          O.code = "ERR_STREAM_PREMATURE_CLOSE", S.body.emit("error", O);
        }
      });
    }), m.on("response", (y) => {
      m.setTimeout(0);
      const N = zi(y.rawHeaders);
      if (wo(y.statusCode)) {
        const q = N.get("Location");
        let I = null;
        try {
          I = q === null ? null : new URL(q, l.url);
        } catch {
          if (l.redirect !== "manual") {
            u(new re(`uri requested responds with an invalid redirect URL: ${q}`, "invalid-redirect")), W();
            return;
          }
        }
        switch (l.redirect) {
          case "error":
            u(new re(`uri requested responds with a redirect, redirect mode is set to error: ${l.url}`, "no-redirect")), W();
            return;
          case "manual":
            break;
          case "follow": {
            if (I === null)
              break;
            if (l.counter >= l.follow) {
              u(new re(`maximum redirect reached at: ${l.url}`, "max-redirect")), W();
              return;
            }
            const D = {
              headers: new he(l.headers),
              follow: l.follow,
              counter: l.counter + 1,
              agent: l.agent,
              compress: l.compress,
              method: l.method,
              body: Nr(l),
              signal: l.signal,
              size: l.size,
              referrer: l.referrer,
              referrerPolicy: l.referrerPolicy
            };
            if (!Bi(l.url, I) || !Wi(l.url, I))
              for (const ft of ["authorization", "www-authenticate", "cookie", "cookie2"])
                D.headers.delete(ft);
            if (y.statusCode !== 303 && l.body && n.body instanceof ne.Readable) {
              u(new re("Cannot follow redirect with body being a readable stream", "unsupported-redirect")), W();
              return;
            }
            (y.statusCode === 303 || (y.statusCode === 301 || y.statusCode === 302) && l.method === "POST") && (D.method = "GET", D.body = void 0, D.headers.delete("content-length"));
            const j = Ui(N);
            j && (D.referrerPolicy = j), a(Yi(new ut(I, D))), W();
            return;
          }
          default:
            return u(new TypeError(`Redirect option '${l.redirect}' is not a valid value of RequestRedirect`));
        }
      }
      v && y.once("end", () => {
        v.removeEventListener("abort", w);
      });
      let k = Qe(y, new Ut(), (q) => {
        q && u(q);
      });
      process.version < "v12.10" && y.on("aborted", w);
      const O = {
        url: l.url,
        status: y.statusCode,
        statusText: y.statusMessage,
        headers: N,
        size: l.size,
        counter: l.counter,
        highWaterMark: l.highWaterMark
      }, x = N.get("Content-Encoding");
      if (!l.compress || l.method === "HEAD" || x === null || y.statusCode === 204 || y.statusCode === 304) {
        S = new Q(k, O), a(S);
        return;
      }
      const oe = {
        flush: He.Z_SYNC_FLUSH,
        finishFlush: He.Z_SYNC_FLUSH
      };
      if (x === "gzip" || x === "x-gzip") {
        k = Qe(k, He.createGunzip(oe), (q) => {
          q && u(q);
        }), S = new Q(k, O), a(S);
        return;
      }
      if (x === "deflate" || x === "x-deflate") {
        const q = Qe(y, new Ut(), (I) => {
          I && u(I);
        });
        q.once("data", (I) => {
          (I[0] & 15) === 8 ? k = Qe(k, He.createInflate(), (D) => {
            D && u(D);
          }) : k = Qe(k, He.createInflateRaw(), (D) => {
            D && u(D);
          }), S = new Q(k, O), a(S);
        }), q.once("end", () => {
          S || (S = new Q(k, O), a(S));
        });
        return;
      }
      if (x === "br") {
        k = Qe(k, He.createBrotliDecompress(), (q) => {
          q && u(q);
        }), S = new Q(k, O), a(S);
        return;
      }
      S = new Q(k, O), a(S);
    }), Ii(m, l).catch(u);
  });
}
function Gi(s, n) {
  const a = L.from(`0\r
\r
`);
  let u = !1, l = !1, h;
  s.on("response", (c) => {
    const { headers: P } = c;
    u = P["transfer-encoding"] === "chunked" && !P["content-length"];
  }), s.on("socket", (c) => {
    const P = () => {
      if (u && !l) {
        const S = new Error("Premature close");
        S.code = "ERR_STREAM_PREMATURE_CLOSE", n(S);
      }
    }, v = (S) => {
      l = L.compare(S.slice(-5), a) === 0, !l && h && (l = L.compare(h.slice(-3), a.slice(0, 3)) === 0 && L.compare(S.slice(-2), a.slice(3)) === 0), h = S;
    };
    c.prependListener("close", P), c.on("data", v), s.on("close", () => {
      c.removeListener("close", P), c.removeListener("data", v);
    });
  });
}
export {
  Hi as AbortError,
  xt as Blob,
  re as FetchError,
  Ci as File,
  Mr as FormData,
  he as Headers,
  ut as Request,
  Q as Response,
  Yi as default,
  wo as isRedirect
};
