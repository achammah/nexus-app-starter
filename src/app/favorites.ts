/* Favorites — a personal pin shelf. Device-local (localStorage) on purpose: it
   works with or without accounts and never leaks across users on shared servers.
   Writers dispatch "nx-favs" so the sidebar updates in the same tab. */

export interface Fav {
  obj: string;
  id: string;
  label: string;
}

const KEY = "nx-favs";

export function favList(): Fav[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as Fav[]) : [];
  } catch {
    return [];
  }
}

export function favHas(obj: string, id: string): boolean {
  return favList().some((f) => f.obj === obj && f.id === id);
}

export function favToggle(obj: string, id: string, label: string): boolean {
  const list = favList();
  const on = !list.some((f) => f.obj === obj && f.id === id);
  const next = on ? [...list, { obj, id, label }] : list.filter((f) => !(f.obj === obj && f.id === id));
  localStorage.setItem(KEY, JSON.stringify(next.slice(0, 50)));
  window.dispatchEvent(new Event("nx-favs"));
  return on;
}
