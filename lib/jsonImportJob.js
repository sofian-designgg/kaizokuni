const axios = require('axios');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const crypto = require('crypto');
const ImportedItem = require('../models/ImportedItem');
const MIN_IMPORT_DELAY_MS = 60_000;
const guildImportQueues = new Map();

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function toArrayPayload(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.messages)) return parsed.messages;
    if (parsed && Array.isArray(parsed.items)) return parsed.items;
    return [];
}

function normalizeUrl(u) {
    try {
        const url = new URL(String(u));
        url.hash = '';
        return url.toString();
    } catch {
        return String(u || '');
    }
}

function readContent(item) {
    if (!item || typeof item !== 'object') return '';
    const base = item.content ?? item.text ?? item.message;
    const fwd = item.forwardedMessage?.content;
    return String(base ?? fwd ?? '').slice(0, 2000);
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

function readEmbeds(item) {
    if (!item || typeof item !== 'object') return [];

    const out = [];
    const single = readEmbed(item);
    if (single) out.push(single);

    const exporterEmbeds = Array.isArray(item.embeds) ? item.embeds : [];
    for (const em of exporterEmbeds) {
        if (!em || typeof em !== 'object') continue;
        const e = new EmbedBuilder().setColor(0x5865f2);
        if (em.title) e.setTitle(String(em.title).slice(0, 256));
        if (em.description) e.setDescription(String(em.description).slice(0, 4096));
        if (em.url) e.setURL(String(em.url));
        if (em.footer?.text) e.setFooter({ text: String(em.footer.text).slice(0, 2048) });
        out.push(e);
    }

    const forwardedEmbeds = Array.isArray(item.forwardedMessage?.embeds)
        ? item.forwardedMessage.embeds
        : [];
    for (const em of forwardedEmbeds) {
        if (!em || typeof em !== 'object') continue;
        const e = new EmbedBuilder().setColor(0x5865f2);
        if (em.title) e.setTitle(String(em.title).slice(0, 256));
        if (em.description) e.setDescription(String(em.description).slice(0, 4096));
        if (em.url) e.setURL(String(em.url));
        if (em.footer?.text) e.setFooter({ text: String(em.footer.text).slice(0, 2048) });
        out.push(e);
    }

    return out.slice(0, 10);
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
    if (item.forwardedMessage && Array.isArray(item.forwardedMessage.attachments)) {
        for (const a of item.forwardedMessage.attachments) {
            if (typeof a === 'string') out.push(a);
            else if (a && typeof a.url === 'string') out.push(a.url);
        }
    }
    return out.filter((u) => /^https?:\/\//i.test(String(u)));
}

function buildItemKey(item) {
    const directId = item?.id;
    if (directId) return `msg:${directId}`;

    const content = readContent(item);
    const urls = readAttachmentUrls(item).map(normalizeUrl).sort();
    const payload = JSON.stringify({
        c: content,
        u: urls,
        t: item?.timestamp ?? null,
    });
    const h = crypto.createHash('sha256').update(payload).digest('hex');
    return `hash:${h}`;
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

function queueGuildImport(guildId, task) {
    const queueKey = guildId || 'global';
    const previous = guildImportQueues.get(queueKey) || Promise.resolve();
    const current = previous.then(task, task);
    guildImportQueues.set(
        queueKey,
        current.finally(() => {
            if (guildImportQueues.get(queueKey) === current) guildImportQueues.delete(queueKey);
        })
    );
    return current;
}

async function runJsonImport({ jsonText, targetChannel, statusChannel, delayMs = 1200, maxItems = 200 }) {
    let parsed;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error('JSON invalide');
    }
    const guildId = targetChannel.guild?.id;
    const safeDelayMs = Math.max(MIN_IMPORT_DELAY_MS, Number(delayMs) || MIN_IMPORT_DELAY_MS);

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send(
            `🕒 Import JSON ajouté à la file serveur (traitement salon par salon, délai min ${safeDelayMs}ms).`
        );
    }

    return queueGuildImport(guildId, async () => {
        const items = toArrayPayload(parsed).slice(0, Math.min(1000, Math.max(1, maxItems)));
        if (!items.length) throw new Error('Aucun message trouvé dans le JSON');

        const targetChannelId = targetChannel.id;
        const keyToItem = new Map();
        for (const item of items) {
            keyToItem.set(buildItemKey(item), item);
        }

        const itemKeys = [...keyToItem.keys()];
        const existing = await ImportedItem.find({
            guildId,
            targetChannelId,
            itemKey: { $in: itemKeys },
        })
            .select({ itemKey: 1, _id: 0 })
            .lean();
        const existingSet = new Set(existing.map((d) => d.itemKey));

        const toSend = itemKeys
            .filter((k) => !existingSet.has(k))
            .map((k) => ({ key: k, item: keyToItem.get(k) }));

        if (statusChannel?.isTextBased?.()) {
            await statusChannel.send(
                `📥 Import JSON démarré: ${items.length} trouvé(s) · ${toSend.length} nouveau(x) vers ${targetChannel} (délai ${safeDelayMs}ms).`
            );
        }

        let sentCount = 0;
        let skippedEmpty = 0;
        for (let i = 0; i < toSend.length; i++) {
            const { key, item } = toSend[i];
            const content = readContent(item);
            const embeds = readEmbeds(item);
            const urls = readAttachmentUrls(item).slice(0, 10);
            const files = [];

            for (let j = 0; j < urls.length; j++) {
                try {
                    files.push(await downloadAttachment(urls[j], j));
                } catch {
                    /* ignore file errors and continue */
                }
            }

            if (!content && !embeds.length && !files.length) {
                skippedEmpty += 1;
                continue;
            }

            await targetChannel.send({
                content: content || undefined,
                embeds: embeds.length ? embeds : undefined,
                files: files.length ? files : undefined,
            });

            await ImportedItem.updateOne(
                { guildId, targetChannelId, itemKey: key },
                { $setOnInsert: { guildId, targetChannelId, itemKey: key } },
                { upsert: true }
            );
            sentCount += 1;
            await sleep(safeDelayMs);
        }

        if (statusChannel?.isTextBased?.()) {
            await statusChannel.send(
                `✅ Import JSON terminé. Envoyés: **${sentCount}** · Déjà importés ignorés: **${existingSet.size}** · Vides ignorés: **${skippedEmpty}**.`
            );
        }
    });
}

module.exports = { runJsonImport };

