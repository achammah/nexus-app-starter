/* Vite's ?raw suffix imports a file's text at build time (used by the Gallery
   to compare the committed inventory snapshot against the live src/ui copy). */
declare module "*?raw" {
  const text: string;
  export default text;
}
