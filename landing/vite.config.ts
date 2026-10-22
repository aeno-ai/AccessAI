import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import appJson from '../frontend/app.json' with { type: 'json' };
// The app's own Terms (HANDOFF.md §51): the website prints the same words the
// app shows at sign-up, so the two can never disagree.
import { PWD_DECLARATION, TERMS_INTRO, TERMS_SECTIONS, TERMS_VERSION } from '../frontend/src/constants/legal.ts';
import site from './site.config.ts';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Links are relative so the built pages also open straight from the folder
// (double-click dist/index.html). On the home page its sections are plain
// #anchors (no reload).
const NAV = [
  { href: 'index.html#features', label: 'Features', page: 'home-section' },
  { href: 'index.html#download', label: 'Download', page: 'home-section' },
  { href: 'about.html', label: 'About', page: 'about' },
  { href: 'terms.html', label: 'Terms & Privacy', page: 'terms' },
];

function header(page: string) {
  const links = NAV.map((item) => {
    const href = page === '' && item.page === 'home-section' ? item.href.replace('index.html', '') : item.href;
    const current = item.page === page ? ' aria-current="page"' : '';
    return `<li><a href="${href}"${current}>${item.label}</a></li>`;
  }).join('');
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="index.html" aria-label="AccessAI home">
      <img src="/mark.png" alt="" width="40" height="40" />
      <span>AccessAI</span>
    </a>
    <nav aria-label="Main">
      <ul class="nav">${links}</ul>
    </nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap footer-row">
    <div>
      <a class="brand brand-small" href="index.html">
        <img src="/mark.png" alt="" width="28" height="28" />
        <span>AccessAI</span>
      </a>
      <p>A 3rd year project by Group 4, BS Information Technology, PHINMA University of Pangasinan, ${new Date().getFullYear()}.</p>
    </div>
    <nav aria-label="Footer">
      <ul class="footer-links">
        <li><a href="index.html#download">Download</a></li>
        <li><a href="about.html">About the team</a></li>
        <li><a href="terms.html">Terms &amp; Privacy</a></li>
      </ul>
    </nav>
  </div>
</footer>`;
}

// Empty links in site.config.ts stay "#" (a dummy button) until wired.
function androidButton() {
  return `<a class="btn btn-primary btn-big" href="${escape(site.androidApkUrl || '#')}">Download for Android</a>
<p class="fine">Version ${escape(appJson.expo.version)}</p>`;
}

function iosButton() {
  return `<a class="btn btn-primary btn-big" href="${escape(site.iosUrl || '#')}">Download for iPhone</a>
<p class="fine">Version ${escape(appJson.expo.version)}</p>`;
}

function termsUpdated() {
  const [year, month, day] = TERMS_VERSION.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function terms() {
  const sections = TERMS_SECTIONS.map((section) => {
    const blocks = section.blocks
      .map((block) =>
        Array.isArray(block)
          ? `<ul>${block.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`
          : `<p>${escape(block)}</p>`,
      )
      .join('');
    return `<section class="terms-section"><h2>${escape(section.heading)}</h2>${blocks}</section>`;
  }).join('');
  const declaration = `<section class="terms-section declaration" aria-labelledby="pwd-declaration">
  <h2 id="pwd-declaration">${escape(PWD_DECLARATION.title)}</h2>
  <p>${escape(PWD_DECLARATION.intro)}</p>
  <ul>${PWD_DECLARATION.points.map((point) => `<li>${escape(point)}</li>`).join('')}</ul>
  <p><strong>${escape(PWD_DECLARATION.confirmation)}</strong></p>
</section>`;
  return `<p class="lead">${escape(TERMS_INTRO)}</p>${sections}${declaration}`;
}

function accessai(): Plugin {
  return {
    name: 'accessai-pages',
    // 'pre': fill the pieces in before Vite rewrites asset paths, so the
    // header's and footer's images get the relative base too.
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const page = ctx.filename.endsWith('terms.html') ? 'terms' : ctx.filename.endsWith('about.html') ? 'about' : '';
        return html
          .replace('<!--HEADER-->', header(page))
          .replace('<!--FOOTER-->', footer())
          .replace('<!--ANDROID-->', androidButton())
          .replace('<!--IOS-->', iosButton())
          .replace('<!--TERMS-->', terms())
          .replaceAll('<!--TERMS_UPDATED-->', termsUpdated())
          .replaceAll('<!--VERSION-->', escape(appJson.expo.version));
      },
    },
  };
}

export default defineConfig({
  // Relative paths: the built site works on Vercel and opened as plain files.
  base: './',
  plugins: [accessai()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        about: resolve(import.meta.dirname, 'about.html'),
      },
    },
  },
});
