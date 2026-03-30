const path = require('path');
const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');
const { resolveMediaUrlsFromUserInput } = require('./wallpaper');
const wallQueue = require('./wallQueue');
const { getOrCreateGuildConfig } = require('./db');

/**
 * @param {import('discord.js').TextBasedChannel} statusChannel - salon pour les messages d'état
 * @param {import('discord.js').TextBasedChannel} targetChannel - salon d'envoi des fichiers
 */
async function runWallpaperJob({ guildId, statusChannel, targetChannel, url }) {
    const cfg = await getOrCreateGuildConfig(guildId);
    const gid = guildId;

    if (!wallQueue.startRun(gid)) {
        await statusChannel.send(
            '❌ Une file est déjà en cours. Utilise `+wallpaper stop` ou `/wallpaper stop`.'
        );
        return;
    }

    try {
        let urls;
        try {
            urls = await resolveMediaUrlsFromUserInput(url);
        } catch {
            await statusChannel.send('❌ Impossible de lire cette URL.');
            return;
        }

        const max = Math.min(Number(cfg.wallpaperMaxBatch) || 15, 40);
        const delay = Math.max(800, Number(cfg.wallpaperDelayMs) || 2500);
        const maxMB = Math.min(25, Math.max(1, Number(cfg.wallpaperMaxFileMB) || 8));
        const maxBytes = maxMB * 1024 * 1024;

        const slice = urls.slice(0, max);
        if (!slice.length) {
            await statusChannel.send('❌ Aucun média (.png .jpg .gif .webp .mp4 .webm .mov) trouvé.');
            return;
        }

        await statusChannel.send(
            `📎 **${slice.length}** média(x) en file — délai **${delay}** ms — max **${maxMB}** Mo/fichier.`
        );

        for (let i = 0; i < slice.length; i++) {
            if (wallQueue.isCancelRequested(gid)) {
                await statusChannel.send('⏹️ File annulée.');
                break;
            }
            const u = slice[i];
            try {
                const res = await axios.get(u, {
                    responseType: 'arraybuffer',
                    maxContentLength: maxBytes,
                    maxBodyLength: maxBytes,
                    timeout: 60000,
                    headers: { 'User-Agent': 'KaizokuniBot/1.0 (+Discord)' },
                    validateStatus: (s) => s >= 200 && s < 400,
                });
                const buf = Buffer.from(res.data);
                let name = path.basename(new URL(u).pathname.split('?')[0]) || 'media';
                if (!/\.\w{2,4}$/i.test(name)) {
                    const ct = String(res.headers['content-type'] || '');
                    const ext =
                        ct.includes('png') ? '.png'
                        : ct.includes('jpeg') || ct.includes('jpg') ? '.jpg'
                        : ct.includes('gif') ? '.gif'
                        : ct.includes('webp') ? '.webp'
                        : ct.includes('mp4') ? '.mp4'
                        : ct.includes('webm') ? '.webm'
                        : '.bin';
                    name = `wallpaper_${i + 1}${ext}`;
                }
                await targetChannel.send({ files: [new AttachmentBuilder(buf, { name })] });
            } catch {
                await statusChannel.send(`⚠️ Échec envoi **${i + 1}/${slice.length}** (fichier trop lourd ou URL invalide).`);
            }
            await new Promise((r) => setTimeout(r, delay));
        }

        if (!wallQueue.isCancelRequested(gid)) {
            await statusChannel.send('✅ File terminée.');
        }
    } finally {
        wallQueue.endRun(gid);
    }
}

module.exports = { runWallpaperJob };
