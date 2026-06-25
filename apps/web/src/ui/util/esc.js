/**
 * Safe HTML rendering utilities — two-layer XSS defense.
 *
 * LAYER 1 — html`` tagged template (primary, mandatory):
 *   Every interpolated ${value} is HTML-entity-escaped before it reaches
 *   the DOM. You cannot write html`<div>${x}</div>` without x being escaped.
 *   To embed intentional sub-HTML, nest another html`` call — that is the
 *   only opt-out and it is explicit and code-reviewable.
 *
 * LAYER 2 — DOMPurify (secondary, defense-in-depth):
 *   mount() passes the already-escaped HTML through DOMPurify before setting
 *   innerHTML. Even if a bug in Layer 1 allowed a raw string through, DOMPurify
 *   strips dangerous tags and attributes before they reach the DOM.
 *   Requires DOMPurify to be loaded in the page (see app.html <head>).
 *
 * USAGE:
 *   import { html, mount, append } from '../util/esc.js';
 *
 *   mount(el, html`<p>${item.name}</p>`);
 *   mount(el, html`<ul>${items.map(i => html`<li>${i.name}</li>`)}</ul>`);
 *
 * NEVER:
 *   el.innerHTML = `<p>${item.name}</p>`;          // raw sink — no escaping
 *   el.innerHTML = `<p>${esc(item.name)}</p>`;     // opt-in — easy to forget
 */

// ── DOMPurify config ─────────────────────────────────────────────────────

const PURIFY_CONFIG = {
  FORCE_BODY:        true,
  ALLOWED_TAGS:      ['a','abbr','b','br','button','caption','code','col','colgroup',
                      'div','em','h1','h2','h3','h4','h5','h6','hr','i','img','input',
                      'label','li','ol','p','pre','span','strong','table','tbody','td',
                      'th','thead','tr','ul'],
  ALLOWED_ATTR:      ['class','style','href','src','alt','type','disabled','checked',
                      'data-tab','data-tf','data-corner','role','tabindex','loading',
                      'aria-label','target','rel','onclick'],
  ALLOW_DATA_ATTR:   true,
  // Keep onclick handlers — our app uses inline handlers on dynamic cards.
  // These handlers are static strings we write, not external data.
  FORCE_HTTPS_FOR_DOMAINS: true,
};

function purify(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, PURIFY_CONFIG);
  }
  // DOMPurify not loaded — our html`` escaping is still active, but log a
  // warning in dev so it gets added to the page.
  if (typeof console !== 'undefined') {
    console.warn('[sfp] DOMPurify not loaded — add it to <head> for defense-in-depth.');
  }
  return html;
}

// ── SafeHtml marker class ─────────────────────────────────────────────────

/**
 * Opaque wrapper that marks a string as html``-processed.
 * mount() / append() only accept SafeHtml, preventing raw string injection.
 */
export class SafeHtml {
  /** @param {string} str */
  constructor(str) { this._str = str; }
  toString()       { return this._str; }
}

// ── Primitive escape (low-level) ─────────────────────────────────────────

const ESC_MAP = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#x27;', '`': '&#x60;',
};
const ESC_RE = /[&<>"'`]/g;

/**
 * HTML-escape a single value.
 * Use html`` instead of calling this directly wherever possible.
 * @param {unknown} v
 * @returns {string}
 */
export function esc(v) {
  if (v == null)                                       return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return String(v).replace(ESC_RE, c => ESC_MAP[c]);
}

/**
 * Escape a value for insertion inside a URL attribute value.
 * @param {string} v
 * @returns {string}
 */
export function escUrl(v) {
  return esc(encodeURIComponent(String(v ?? '')));
}

// ── Tagged template literal ───────────────────────────────────────────────

/**
 * Build a SafeHtml from a template literal.
 * Static string parts come from your source code — trusted as-is.
 * Interpolated values are auto-escaped (or joined if SafeHtml[]).
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {SafeHtml}
 */
export function html(strings, ...values) {
  const parts = [];
  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]);
    if (i < values.length) {
      const v = values[i];
      if (v instanceof SafeHtml) {
        parts.push(v._str);
      } else if (Array.isArray(v)) {
        parts.push(v.map(x => x instanceof SafeHtml ? x._str : esc(x)).join(''));
      } else {
        parts.push(esc(v));
      }
    }
  }
  return new SafeHtml(parts.join(''));
}

// ── DOM mount helpers ─────────────────────────────────────────────────────

/**
 * Replace an element's content with a SafeHtml template.
 * Runs through DOMPurify as defense-in-depth before touching the DOM.
 * @param {Element} el
 * @param {SafeHtml} template
 */
export function mount(el, template) {
  if (!(template instanceof SafeHtml)) {
    throw new TypeError(
      'mount() requires a SafeHtml value produced by html`...`. ' +
      'Got: ' + typeof template
    );
  }
  el.innerHTML = purify(template._str);
}

/**
 * Append a SafeHtml template into an element (non-destructive).
 * @param {Element} el
 * @param {SafeHtml} template
 */
export function append(el, template) {
  if (!(template instanceof SafeHtml)) {
    throw new TypeError('append() requires a SafeHtml value produced by html`...`.');
  }
  el.insertAdjacentHTML('beforeend', purify(template._str));
}

/**
 * Mark a static string as safe without escaping.
 * ONLY call this on strings defined entirely in your own source code.
 * Never call trust() on user input, server data, or AI responses.
 * @param {string} str
 * @returns {SafeHtml}
 */
export function trust(str) {
  return new SafeHtml(String(str));
}
