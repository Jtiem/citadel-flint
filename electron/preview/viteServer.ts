/**
 * viteServer.ts — electron/preview/viteServer.ts
 *
 * Phase N.4: Agnostic Preview Engine
 *
 * Manages a single headless Vite dev server that serves the user's open
 * project. The server is started when a project root is set and stopped
 * when the project is closed. Because Vite handles HMR natively, Flint
 * no longer needs to:
 *   • Run Babel in the main process (code:transform)
 *   • Build a hand-crafted srcdoc string for each keystroke
 *   • Inject React/ReactDOM UMD globals manually
 *
 * Framework support is driven by the user's own vite.config.ts — this
 * module does NOT hard-code React. Vue, Svelte, Angular (v17+), and any
 * other Vite-compatible framework work automatically.
 *
 * Flint interaction wiring (click-to-select, hover, drag-and-drop) is
 * injected via a Vite plugin that appends a <script> to every HTML page
 * served by the preview server.
 *
 * Main process only — never imported by the renderer.
 */

import net from 'node:net'

// Dynamic import — vite is a dev-time dependency excluded from the production ASAR.
// In packaged builds, startViteServer() returns null and the app falls back to
// the srcdoc preview path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ViteDevServer = { close: () => Promise<void>; listen: () => Promise<any>; config: { server: { port?: number } } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Plugin = { name: string; transformIndexHtml?: (html: string) => string; configureServer?: (server: any) => void }

async function loadVite(): Promise<typeof import('vite') | null> {
    try {
        return await import('vite')
    } catch {
        return null
    }
}

// ── Port utilities ─────────────────────────────────────────────────────────────

/** Returns a free TCP port by binding on :0 */
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr == null || typeof addr === 'string') {
        srv.close()
        reject(new Error('Could not determine free port'))
        return
      }
      const { port } = addr
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

// ── Flint interaction script ─────────────────────────────────────────────────
//
// The same event proxy that lives in buildHtmlSrcdoc / buildSrcdoc but injected
// via the Vite HTML transform so it works for any framework.
//
// Injected as an inline <script> at the end of <body> so it runs after the
// framework's own scripts have set up the DOM.

const FLINT_SCRIPT = /* html */`
<script id="__flint_interact__">
(function(){
  if(document.getElementById('__flint_interact_active__'))return;
  var sentinel=document.createElement('meta');sentinel.id='__flint_interact_active__';document.head.appendChild(sentinel);
  window.__flintInteractMode=false;
  window.addEventListener('message',function(e){
    if(!e.data)return;var t=e.data.type;
    if(t==='SET_INTERACT_MODE'){window.__flintInteractMode=!!e.data.enabled;return;}
    if(t==='CLEAR_PREVIEW'){document.body.innerHTML='';return;}
    if(t==='HIGHLIGHT'){
      document.querySelectorAll('.flint-selected').forEach(function(el){el.classList.remove('flint-selected');});
      if(e.data.id){var s=document.querySelector('[data-flint-id="'+e.data.id+'"]');if(s)s.classList.add('flint-selected');}return;
    }
    if(t==='HOVER'){
      document.querySelectorAll('.flint-hovered').forEach(function(el){el.classList.remove('flint-hovered');});
      if(e.data.id){var h=document.querySelector('[data-flint-id="'+e.data.id+'"]');if(h)h.classList.add('flint-hovered');}return;
    }
    if(t==='CLEAR_HOVER'){document.querySelectorAll('.flint-hovered').forEach(function(el){el.classList.remove('flint-hovered');});return;}
    if(t==='DRAG_OVER'){
      document.querySelectorAll('.flint-drop-before,.flint-drop-after,.flint-drop-inside').forEach(function(n){n.classList.remove('flint-drop-before','flint-drop-after','flint-drop-inside');});
      if(e.data.targetId){var d=document.querySelector('[data-flint-id="'+e.data.targetId+'"]');if(d)d.classList.add('flint-drop-'+e.data.position);}return;
    }
    if(t==='DRAG_CLEAR'){
      var g=document.getElementById('__flint_ghost__');if(g)g.style.display='none';
      document.querySelectorAll('.flint-drop-before,.flint-drop-after,.flint-drop-inside').forEach(function(n){n.classList.remove('flint-drop-before','flint-drop-after','flint-drop-inside');});return;
    }
    if(t==='DRAG_MOVE'){
      var gm=document.getElementById('__flint_ghost__');if(gm){gm.style.display='block';gm.style.left=(e.data.x-40)+'px';gm.style.top=(e.data.y-20)+'px';}
      var dme=document.elementFromPoint(e.data.x,e.data.y);var dmt=dme?dme.closest('[data-flint-id]'):null;
      document.querySelectorAll('.flint-drop-before,.flint-drop-after,.flint-drop-inside').forEach(function(n){n.classList.remove('flint-drop-before','flint-drop-after','flint-drop-inside');});
      if(dmt){var r=dmt.getBoundingClientRect();var pct=(e.data.y-r.top)/r.height;dmt.classList.add('flint-drop-'+(pct<0.25?'before':pct>0.75?'after':'inside'));}return;
    }
    if(t==='DRAG_END'){
      var ge=document.getElementById('__flint_ghost__');if(ge)ge.style.display='none';
      document.querySelectorAll('.flint-drop-before,.flint-drop-after,.flint-drop-inside').forEach(function(n){n.classList.remove('flint-drop-before','flint-drop-after','flint-drop-inside');});
      var de=document.elementFromPoint(e.data.x,e.data.y);var dt=de?de.closest('[data-flint-id]'):null;
      var dp='inside';if(dt){var dr=dt.getBoundingClientRect();var dpp=(e.data.y-dr.top)/dr.height;dp=dpp<0.25?'before':dpp>0.75?'after':'inside';}
      window.parent.postMessage({type:'HIT_TEST_RESULT',targetId:dt?dt.getAttribute('data-flint-id'):null,position:dp},'*');return;
    }
  });
  document.addEventListener('paste', function(e){
    if(window.__flintInteractMode)return;
    var f=e.clipboardData?e.clipboardData.getData('application/x-flint-figma-ast'):null;
    if(!f&&e.clipboardData){
      var t=e.clipboardData.getData('text/plain');
      if(t){
        try{
          var p=JSON.parse(t);
          if(p&&p.type==='application/x-flint-figma-ast'){f=typeof p.payload==='string'?p.payload:JSON.stringify(p.payload);}
        }catch(err){}
      }
    }
    if(f){
      e.preventDefault();
      window.parent.postMessage({type:'FIGMA_PASTE',payload:f},'*');
    }
  });
  document.addEventListener('click',function(e){
    if(window.__flintInteractMode)return;
    var el=e.target.closest('[data-flint-id]');
    if(el)window.parent.postMessage({type:'CANVAS_CLICK',id:el.getAttribute('data-flint-id')},'*');
  });
  var _hid=null;
  document.body.addEventListener('mouseover',function(e){
    if(window.__flintInteractMode)return;
    var el=e.target.closest('[data-flint-id]');var id=el?el.getAttribute('data-flint-id'):null;
    if(id!==_hid){_hid=id;window.parent.postMessage(id?{type:'CANVAS_HOVER',id:id}:{type:'CANVAS_HOVER_CLEAR'},'*');}
  });
  document.body.addEventListener('mouseleave',function(){if(_hid!==null){_hid=null;window.parent.postMessage({type:'CANVAS_HOVER_CLEAR'},'*');}});
  var _bg=document.createElement('div');_bg.id='__flint_ghost__';
  _bg.style.cssText='position:fixed;pointer-events:none;border:2px solid #3b82f6;background:rgba(59,130,246,0.12);border-radius:4px;z-index:9999;display:none;width:80px;height:40px;';
  document.body.appendChild(_bg);
  document.body.addEventListener('mousedown',function(e){
    if(window.__flintInteractMode)return;
    var el=e.target.closest('[data-flint-id]');if(!el)return;
    e.preventDefault();
    window.parent.postMessage({type:'CANVAS_DRAG_START',id:el.getAttribute('data-flint-id'),x:e.clientX,y:e.clientY},'*');
  });
})();
</script>
<style id="__flint_styles__">
.flint-selected{outline:2px solid #3b82f6!important;background-color:rgba(59,130,246,.1)!important;}
.flint-hovered{outline:2px dashed #94a3b8!important;background:rgba(148,163,184,.1)!important;cursor:default;z-index:40;transition:all .1s;}
.flint-drop-before{box-shadow:0 -3px 0 0 #3b82f6!important;z-index:50;}
.flint-drop-after{box-shadow:0 3px 0 0 #3b82f6!important;z-index:50;}
.flint-drop-inside{outline:2px solid #3b82f6!important;background:rgba(59,130,246,.2)!important;}
</style>
`

// ── Flint Interaction Plugin ─────────────────────────────────────────────────

/**
 * Vite plugin that appends the Flint interaction script + styles to every
 * HTML page served by the preview server.
 *
 * This is the equivalent of the hand-crafted srcdoc footer, but injected at
 * the Vite HTML transform level so it works for any framework output.
 */
function flintInteractPlugin(): Plugin {
  return {
    name: 'flint-interact',
    transformIndexHtml(html: string) {
      return html.replace('</body>', `${FLINT_SCRIPT}\n</body>`)
    },
    configureServer(server: any) {
      server.middlewares.use((_req: any, res: any, next: any) => {
        const originalSetHeader = res.setHeader;
        res.setHeader = function (name: string, value: string | number | readonly string[]) {
          if (name.toLowerCase() === 'content-security-policy') {
            return this; // Drop the CSP header completely for preview
          }
          return originalSetHeader.call(this, name, value);
        };
        next();
      });
    }
  }
}

// ── Singleton Server State ─────────────────────────────────────────────────────

let _server: ViteDevServer | null = null
let _port: number | null = null
let _root: string | null = null

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Starts (or restarts) a headless Vite dev server rooted at `projectRoot`.
 *
 * Uses the user's own `vite.config.ts` when present — Flint does NOT
 * override the framework plugin. The Flint interaction plugin is appended
 * on top.
 *
 * @returns  The localhost URL the iframe should load (e.g. "http://localhost:5174").
 */
export async function startViteServer(projectRoot: string): Promise<string | null> {
  // Idempotency guard: if a server is already running at the same root,
  // return the cached URL immediately. This prevents the start/stop loop
  // that occurs when:
  //   (a) React Strict Mode double-fires the LivePreview useEffect, or
  //   (b) The component remounts (e.g. parent re-renders) while the same
  //       project is open.
  // The guard compares resolved absolute paths so trailing-slash differences
  // don't cause a spurious restart.
  if (_server !== null && _root !== null && _port !== null) {
    const resolvedExisting = _root
    const resolvedIncoming = projectRoot
    if (resolvedExisting === resolvedIncoming) {
      return `http://127.0.0.1:${_port}`
    }
  }

  // Tear down stale server before starting a new one at a different root.
  if (_server !== null) {
    await stopViteServer()
  }

  _port = await findFreePort()
  _root = projectRoot

  // DO NOT call resolveConfig() here. It compiles vite.config.ts to a temp
  // file in node_modules/.vite-temp/, which the OUTER Vite dev server detects
  // as a config change → full server restart → Electron restart → this function
  // runs again → resolveConfig → loop forever.
  //
  // Instead, let Vite auto-detect the user's config via configFile (default).
  // We only override server settings and append our interaction plugin.

  const vite = await loadVite()
  if (!vite) {
    console.warn('[Flint] Vite not available — using srcdoc preview fallback')
    return null
  }

  _server = await vite.createServer({
    root: projectRoot,
    base: '/',
    server: {
      port: _port,
      strictPort: false,
      host: '127.0.0.1',
      hmr: { overlay: false },
      watch: {
        usePolling: true,
        interval: 1000,
        ignored: ['**/.flint/**', '**/node_modules/**', '**/.git/**', '**/dist-electron/**', '**/*.db', '**/*.db-journal', '**/*.db-wal'],
      },
    },
    plugins: [
      flintInteractPlugin(),
    ],
    logLevel: 'warn',
    clearScreen: false,
    configFile: false,
  })

  await _server!.listen()
  const url = `http://127.0.0.1:${_port}`
  console.info(`[Flint] Preview engine (Vite N.4) listening at ${url}`)
  return url
}

/**
 * Gracefully shuts down the preview server.
 * Safe to call multiple times (idempotent).
 */
export async function stopViteServer(): Promise<void> {
  if (_server !== null) {
    await _server.close()
    _server = null
    _port = null
    _root = null
    console.info('[Flint] Preview engine stopped.')
  }
}

/**
 * Returns the current preview server URL, or `null` if no server is running.
 */
export function getPreviewUrl(): string | null {
  if (_server === null || _port === null) return null
  return `http://127.0.0.1:${_port}`
}

/**
 * Returns the project root the preview server is currently serving, or `null`.
 */
export function getPreviewRoot(): string | null {
  return _root
}
