const axios = require('axios');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function toArrayPayload(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.messages)) return parsed.messages;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
}

function readContent(item) {
    if (!item || typeof item !== 'object') return '';
    return String(item.content ?? item.text ?? item.message ?? '').slice(0, 2000);
}

function readEmbed(item) {
    if (!item || typeof item !== 'object') return null;
    const title = item.title || item.embedTitle;
    const description = item.description || item.embedDescription;
    if (!title && !description) return null;
    const e = new EmbedBuilder().setColor(0x5865f2);
    if (title) e.setTitle(String(title).slice(0, 256));
    if (description) e.setDescription(String(description).slice(0, 4096));
    if (item.footer) e.setFooter({ text: String(item.footer).slice(0, 2048) });
    return e;
}

function readAttachmentUrls(item) {
    if (!item || typeof item !== 'object') return [];
    const out = [];
    if (typeof item.attachment === 'string') out.push(item.attachment);
    if (typeof item.file === 'string') out.push(item.file);
    if (typeof item.image === 'string') out.push(item.image);
    if (Array.isArray(item.attachments)) {
        for (const a of item.attachments) {
            if (typeof a === 'string') out.push(a);
            else if (a && typeof a.url === 'string') out.push(a.url);
        }
    }
    return out.filter((u) => /^https?:\/\//i.test(String(u)));
}

async function downloadAttachment(url, index) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: 8 * 1024 * 1024,
        maxBodyLength: 8 * 1024 * 1024,
        headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
        validateStatus: (s) => s >= 200 && s < 400,
    });
    const buf = Buffer.from(res.data);
    let name = `file_${index + 1}`;
    try {
        const pathname = new URL(url).pathname;
        const base = pathname.split('/').pop();
        if (base) name = base;
    } catch {
        /* noop */
    }
    return new AttachmentBuilder(buf, { name });
}

async function runJsonImport({ jsonText, targetChannel, statusChannel, delayMs = 1200, maxItems = 200 }) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error('JSON invalide');
    }
    const items = toArrayPayload(parsed).slice(0, Math.min(1000, Math.max(1, maxItems)));
    if (!items.length) throw new Error('Aucun message trouvé dans le JSON');

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send(
            `📥 Import JSON: **${items.length}** message(s) vers ${targetChannel} (délai ${delayMs}ms).`
        );
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const content = readContent(item);
        const embed = readEmbed(item);
        const urls = readAttachmentUrls(item).slice(0, 10);
        const files = [];

        for (let j = 0; j < urls.length; j++) {
            try {
                files.push(await downloadAttachment(urls[j], j));
            } catch {
                /* ignore file errors and continue */
            }
        }

        if (!content && !embed && !files.length) continue;

        await targetChannel.send({
            content: content || undefined,
            embeds: embed ? [embed] : undefined,
            files: files.length ? files : undefined,
        });

        await sleep(delayMs);
    }

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send('✅ Import JSON terminé.');
    }
}

module.exports = { runJsonImport };

