const axios = require('axios');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { parseDiscordChannelLink } = require('./discordLinkParse');

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function messageToEmbed(msg) {
    const e = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
            name: `${msg.author.tag}`,
            iconURL: msg.author.displayAvatarURL({ size: 64 }),
        })
        .setDescription((msg.content || '‎').slice(0, 4096))
        .setTimestamp(msg.createdAt);

    if (msg.reference?.messageId) {
        e.addFields({
            name: 'Réponse à',
            value: `Message ID: \`${msg.reference.messageId}\``,
            inline: false,
        });
    }
    return e;
}

async function downloadAsAttachment(url, maxBytes, index) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        timeout: 60000,
        headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
        validateStatus: (s) => s >= 200 && s < 400,
    });
    const buf = Buffer.from(res.data);
    let name = `file_${index + 1}`;
    try {
        const u = new URL(url);
        const base = u.pathname.split('/').pop();
        if (base) name = base.split('?')[0] || name;
    } catch {
        /* ignore */
    }
    return new AttachmentBuilder(buf, { name });
}

/**
 * Copie les derniers messages d'un salon source vers un salon cible.
 * Ne peut pas "copier exactement" (Discord interdit l'usurpation d'auteur) :
 * on republie en embed avec auteur/date + pièces jointes re-upload.
 */
async function mirrorChannel({
    client,
    sourceChannel,
    targetChannel,
    limit = 50,
    includeAttachments = true,
    delayMs = 1200,
    maxFileMB = 8,
    statusChannel,
}) {
    const maxBytes = Math.min(25, Math.max(1, maxFileMB)) * 1024 * 1024;
    const lim = Math.min(200, Math.max(1, Number(limit) || 50));

    if (!sourceChannel?.isTextBased?.() || !targetChannel?.isTextBased?.()) {
        throw new Error('Salons invalides');
    }

    // fetch last messages
    const fetched = await sourceChannel.messages.fetch({ limit: Math.min(100, lim) });
    const msgs = [...fetched.values()].filter((m) => !m.system).slice(0, lim).reverse(); // oldest -> newest

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send(
            `🪞 Mirror: **${msgs.length}** message(s) depuis ${sourceChannel} → ${targetChannel} (délai ${delayMs}ms)`
        );
    }

    for (let i = 0; i < msgs.length; i++) {
        const m = msgs[i];
        const embed = messageToEmbed(m);

        let files = [];
        if (includeAttachments && m.attachments?.size) {
            const att = [...m.attachments.values()];
            const safe = att.slice(0, 10); // limite Discord
            const downloaded = [];
            for (let a = 0; a < safe.length; a++) {
                try {
                    downloaded.push(await downloadAsAttachment(safe[a].url, maxBytes, a));
                } catch {
                    embed.addFields({
                        name: 'Pièce jointe ignorée',
                        value: safe[a].url,
                        inline: false,
                    });
                }
            }
            files = downloaded;
        }

        // Si message vide et pas de fichiers, met un caractère invisible
        if (!m.content && (!files || !files.length)) {
            embed.setDescription('‎');
        }

        await targetChannel.send({ embeds: [embed], files });
        await sleep(delayMs);
    }

    if (statusChannel?.isTextBased?.()) {
        await statusChannel.send('✅ Mirror terminé.');
    }
}

async function resolveSourceChannelFromLink(client, linkOrId) {
    const parsed = parseDiscordChannelLink(linkOrId);
    if (parsed?.channelId) {
        return client.channels.fetch(parsed.channelId).catch(() => null);
    }
    if (/^\d{17,20}$/.test(String(linkOrId).trim())) {
        return client.channels.fetch(String(linkOrId).trim()).catch(() => null);
    }
    return null;
}

module.exports = { mirrorChannel, resolveSourceChannelFromLink };

