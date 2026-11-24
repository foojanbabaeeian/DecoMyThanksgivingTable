import { defineConfig } from 'vite';

// Relative asset paths so the built site works at any URL, including
// GitHub Pages project sites like https://<user>.github.io/DecoMyThanksgivingTable/
export default defineConfig({
  base: './'
});
