import { TW_ATTR } from './patches'

export const OVERLAY_CSS_ID = '__tw_overlay_css'

const OVERLAY_CSS = `
#__tw_hover,#__tw_select,#__tw_margin,#__tw_padding{position:fixed;pointer-events:none;z-index:2147483647;box-sizing:border-box;display:none;top:0;left:0;margin:0;padding:0}
#__tw_hover{outline:1px solid #0d99ff}
#__tw_select{outline:2px solid #0d99ff}
#__tw_margin{border-style:solid;border-color:rgba(246,153,63,.35)}
#__tw_padding{border-style:solid;border-color:rgba(147,196,125,.45)}
#__tw_label{position:fixed;top:0;left:0;margin:0;pointer-events:none;z-index:2147483647;display:none;background:#0d99ff;color:#fff;font:500 11px/16px Inter,system-ui,sans-serif;padding:0 5px;border-radius:2px;white-space:nowrap;letter-spacing:0;text-transform:none}
#__tw_label span{opacity:.75;margin-left:6px}
#__tw_select i{position:absolute;width:6px;height:6px;background:#fff;border:1px solid #0d99ff;box-sizing:border-box}
html.__tw_editing,html.__tw_editing *{cursor:default!important}
html.__tw_editing [contenteditable=true]{cursor:text!important;outline:2px dashed #0d99ff!important;outline-offset:2px}
`

export const SHIM_ID = '__tw_shim'

/**
 * Runs before the page's own scripts (preview only, stripped on export).
 * In an about:srcdoc iframe, relative URLs resolve against the editor's URL, so
 * history.pushState/replaceState('#/route') throws a SecurityError and hash-routed
 * prototypes crash. Keep only the hash and rewrite it against the iframe's own URL.
 */
const SHIM_JS = `(function(){
  var H = window.history;
  function fix(url){
    if (url == null) return url;
    var s = String(url), i = s.indexOf('#');
    var base = location.href.split('#')[0];
    return i === -1 ? base : base + s.slice(i);
  }
  ['pushState','replaceState'].forEach(function(m){
    var orig = H[m];
    H[m] = function(state, title, url){
      try { return orig.call(H, state, title, url); }
      catch (e) { return orig.call(H, state, title, fix(url)); }
    };
  });
})();`

export interface PreparedDoc {
  preparedHtml: string
  isFragment: boolean
}

const looksLikeDocument = (html: string) => /<(!doctype|html[\s>]|head[\s>]|body[\s>])/i.test(html)

/** Parse → tag every element inside <body> (and <body> itself) with data-tw-id → inject overlay CSS → serialize. */
export function prepareHtml(source: string): PreparedDoc {
  const isFragment = !looksLikeDocument(source)
  const html = isFragment ? `<!DOCTYPE html><html><head></head><body>${source}</body></html>` : source
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.body.setAttribute(TW_ATTR, 'tw-0')
  let n = 1
  for (const el of Array.from(doc.body.querySelectorAll('*'))) el.setAttribute(TW_ATTR, `tw-${n++}`)

  const style = doc.createElement('style')
  style.id = OVERLAY_CSS_ID
  style.textContent = OVERLAY_CSS
  doc.head.appendChild(style)

  const shim = doc.createElement('script')
  shim.id = SHIM_ID
  shim.textContent = SHIM_JS
  doc.head.insertBefore(shim, doc.head.firstChild)

  return { preparedHtml: serialize(doc), isFragment }
}

export function serialize(doc: Document): string {
  const dt = doc.doctype
  const doctype = dt ? `<!DOCTYPE ${dt.name}${dt.publicId ? ` PUBLIC "${dt.publicId}"` : ''}${dt.systemId ? ` "${dt.systemId}"` : ''}>` : '<!DOCTYPE html>'
  return `${doctype}\n${doc.documentElement.outerHTML}`
}
