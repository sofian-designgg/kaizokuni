const axios = require('axios');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function normalizeMessages(payload) {
    // Formats supportés:
    // - [{ content, author, timestamp, attachments: [url|string|{url}] }]
    // - { messages: [...] }
    // - DiscordChatExporter-like { messages: [...] }
    const arr = Array.isArray(payload) ? payload : payload?.messages;
    if (!Array.isArray(arr)) return [];
    return arr.map((m) => ({
        content: String(m.content || m.message || ''),
        author:
            m.author?.tag ||
            m.author?.name ||
            m.authorName ||
            m.username ||
            'Auteur inconnu',
        timestamp:
            m.createdTimestamp ||
            m.timestamp ||
            m.date ||
            m.createdAt ||
            new Date().toISOString(),
        attachments: Array.isArray(m.attachments)
            ? m.attachments
            : Array.isArray(m.files)
              ? m.files
              : [],
    }));
}

function attachmentUrl(item) {
    if (!item) return null;
    if (typeof item === 'string') return item;
    if (typeof item.url === 'string') return item.url;
    if (typeof item.proxy_url === 'string') return item.proxy_url;
    return null;
}

async function downloadAttachment(url, maxBytes, idx) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        timeout: 60000,
        headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
        validateStatus: (s) => s >= 200 && s < 400,
    });
    const buf = Buffer.from(res.data);
    let name = `file_${idx + 1}`;
    try {
        const u = new URL(url);
        const last = u.pathname.split('/').pop();
        if (last) name = last;
    } catch {
        /* ignore */
    }
    return new AttachmentBuilder(buf, { name });
}

async function importFromJsonAttachment({
    attachmentUrl: jsonUrl,
    targetChannel,
    statusChannel,
    limit = 200,
    delayMs = 1000,
    includeAttachments = true,
    maxFileMB = 8,
}) {
    if (!targetChannel?.isTextBased?.()) throw new Error('Salon cible invalide');
    const maxBytes = Math.min(25, Math.max(1, maxFileMB)) * 1024 * 1024;

    const { data } = await axios.get(jsonUrl, {
        timeout: 60000,
        responseType: 'text',
        headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
        validateStatus: (s) => s >= 200 && s < 400,
        transformResponse: [(body) => body],
    });

    let parsed;
    try {
        parsed = JSON.parse(String(data));
    } catch {
        throw new Error('JSON invalide');
    }

    const messages = normalizeMessages(parsed)
        .slice(0, Math.min(500, Math.max(1, Number(limit) || 200)));

    if (!messages.length) throw new Error('Aucun message trouvé dans le JSON');

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send(
            `📥 Import JSON: **${messages.length}** message(s) vers ${targetChannel} (délai ${delayMs}ms)`
        );
    }

    for (let i = 0; i < messages.length; i++) {
        const m = messages[i];
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setAuthor({ name: String(m.author || 'Auteur inconnu').slice(0, 256) })
            .setDescription((m.content || '‎').slice(0, 4096))
            .setTimestamp(new Date(m.timestamp || Date.now()));

        const files = [];
        if (includeAttachments && Array.isArray(m.attachments)) {
            const urls = m.attachments.map(attachmentUrl).filter(Boolean).slice(0, 10);
            for (let j = 0; j < urls.length; j++) {
                try {
                    files.push(await downloadAttachment(urls[j], maxBytes, j));
                } catch {
                    embed.addFields({
                        name: 'Pièce jointe ignorée',
                        value: String(urls[j]).slice(0, 1000),
                        inline: false,
                    });
                }
            }
        }

        await targetChannel.send({ embeds: [embed], files });
        await sleep(delayMs);
    }

    if (statusChannel?.isTextBased?.()) await statusChannel.send('✅ Import JSON terminé.');
}

module.exports = { importFromJsonAttachment };

