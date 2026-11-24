import { defineConfig } from 'vite';

// Relative asset paths so the built site works at any URL, including
// GitHub Pages project sites like https://<user>.github.io/DecoMyThanksgivingTable/
//
// Link previews (og:image) need an absolute URL. The deploy workflow passes
// SITE_URL (the Pages address); locally it falls back to a relative path.
export default defineConfig({
  base: './',
  plugins: [{
    name: 'site-url',
    transformIndexHtml(html) {
      const site = (process.env.SITE_URL || './').replace(/\/?$/, '/');
      return html.replaceAll('%SITE_URL%', site);
    }
  }]
});
