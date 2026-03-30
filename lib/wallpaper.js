const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov)(\?|#|$)/i;

function looksLikeDirectMedia(pathOrUrl) {
    return IMAGE_EXT.test(pathOrUrl) || VIDEO_EXT.test(pathOrUrl);
}

async function extractMediaUrlsFromPage(pageUrl) {
    const { data } = await axios.get(pageUrl, {
        timeout: 25000,
        maxContentLength: 6 * 1024 * 1024,
        headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
        validateStatus: (s) => s >= 200 && s < 400,
        responseType: 'text',
        transformResponse: [(body) => body],
    });

    const base = new URL(pageUrl);
    const $ = cheerio.load(String(data));
    const found = new Set();

    const add = (href) => {
        if (!href || href.startsWith('data:') || href.startsWith('javascript:')) return;
        try {
            const abs = new URL(href, base).href;
            const clean = abs.split('#')[0];
            if (looksLikeDirectMedia(clean)) found.add(clean);
        } catch {
            /* ignore */
        }
    };

    $('img[src]').each((_, el) => add($(el).attr('src')));
    $('video[src]').each((_, el) => add($(el).attr('src')));
    $('source[src]').each((_, el) => add($(el).attr('src')));
    $('a[href]').each((_, el) => add($(el).attr('href')));

    return [...found];
}

async function resolveMediaUrlsFromUserInput(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed) return [];
    let u;
    try {
        u = new URL(trimmed);
    } catch {
        return [];
    }
    if (looksLikeDirectMedia(u.pathname + u.search)) return [u.href];
    return extractMediaUrlsFromPage(u.href);
}

module.exports = { resolveMediaUrlsFromUserInput, looksLikeDirectMedia };
