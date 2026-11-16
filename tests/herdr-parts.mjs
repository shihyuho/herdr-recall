// Reading the site's text about Herdr versions as a visitor would. describe()
// gives each piece as a list of parts: plain strings, and { b }, { code } or
// { a, href } for bold, code and links.

// A piece's text, without the markup.
export const text = (parts) => parts.map((p) => (typeof p === "string" ? p : p.b ?? p.code ?? p.a)).join("");

// A piece's links, as [text, href].
export const links = (parts) => parts.filter((p) => p.href).map((p) => [p.a, p.href]);

const VERSION = /\d+\.\d+\.\d+/g;

// The version numbers a string names, in order.
export const versionsIn = (s) => s.match(VERSION) ?? [];

// Numbers in words, by the docs' languages: the oracle for how a doc spells
// COUNT, written here rather than read from the module.
export const IN_WORDS = {
  en: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
  "zh-TW": ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
};
