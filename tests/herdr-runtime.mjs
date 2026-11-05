// A stand-in for the runtime ui.js draws with. "gpui-kit", "gpui-base" and
// "herdr" exist only inside Herdr, so a test that imports this file gets
// them from here, and must load ui.js after it: `await import(".../ui.js")`.
//
// Herdr's elements are builders: each call declares something and returns
// the element. These record what was declared instead of drawing it, so a
// test can read what the dialog asked Herdr for:
//
//   drawnRows(dialog) → one record per row of the dialog's list, as Herdr
//                       asks the list's renderer for them
//   a record          = { styles: { <call>: its argument, or true with none },
//                         hover:  the styles declared for under the pointer,
//                         children }
//
// It accepts any call by any name; `herdr-app check` is what tells a real
// call from a misspelt one.
import { registerHooks } from "node:module";

const RUNTIME = new Set(["gpui-kit", "gpui-base", "herdr"]);
registerHooks({
  resolve: (specifier, context, next) => (RUNTIME.has(specifier)
    ? { url: import.meta.url, shortCircuit: true }
    : next(specifier, context)),
});

const RECORD = Symbol("record");

function element(kind, ...args) {
  const record = { kind, args, styles: {}, hover: {}, children: [] };
  const el = new Proxy({}, {
    get(_target, call) {
      if (call === RECORD) return record;
      if (typeof call !== "string" || call === "then") return undefined;
      return (...given) => {
        if (call === "when") { if (given[0]) given[1](el); }
        else if (call === "child") record.children.push(given[0]);
        else if (call === "children") record.children.push(...given[0]);
        else if (call === "hover") {
          const under = element("hover");
          given[0](under);
          Object.assign(record.hover, under[RECORD].styles);
        } else record.styles[call] = given.length > 1 ? given : given.length ? given[0] : true;
        return el;
      };
    },
  });
  return el;
}

// gpui-kit
export const div = () => element("div");
export const svg = (path) => element("svg", path);
export const image = (path) => element("image", path);

// gpui-base
export const v_flex = () => element("v_flex");
export const h_flex = () => element("h_flex");
export const Input = { new: (state) => element("Input", state) };
export const v_virtual_list = (id, count, sizes, getKey, render) => element("v_virtual_list", id, count, sizes, getKey, render);

// herdr: every theme color is its own name, and nothing is shared.
export const theme = () => new Proxy({}, { get: (_target, color) => (typeof color === "string" ? color : undefined) });
export const shared = () => undefined;

function find(el, kind) {
  const record = el?.[RECORD];
  if (!record) return null;
  if (record.kind === kind) return record;
  for (const child of record.children) {
    const found = find(child, kind);
    if (found) return found;
  }
  return null;
}

/** The rows of the dialog's list, all of them, as records. */
export function drawnRows(dialog) {
  const list = find(dialog, "v_virtual_list");
  if (!list) throw new Error("the dialog drew no list");
  const [, count, , , render] = list.args;
  return render({ start: 0, end: count }).map((row) => row[RECORD]);
}
