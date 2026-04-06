const { ChannelType, PermissionFlagsBits, PermissionsBitField } = require('discord.js');
const VitrineSnapshot = require('../models/VitrineSnapshot');

const VITRINE_CHANNEL_TYPES = new Set([
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildCategory,
]);

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function getOrCreateDoc(guildId) {
    let doc = await VitrineSnapshot.findOne({ guildId });
    if (!doc) {
        doc = await VitrineSnapshot.create({ guildId });
    }
    return doc;
}

/**
 * @param {import('discord.js').Guild} guild
 */
async function captureEveryoneSnapshot(guild) {
    await guild.channels.fetch().catch(() => {});
    const channels = [];
    for (const ch of guild.channels.cache.values()) {
        if (ch.isThread()) continue;
        if (!VITRINE_CHANNEL_TYPES.has(ch.type)) continue;
        const ow = ch.permissionOverwrites.cache.get(guild.id);
        if (ow) {
            channels.push({
                channelId: ch.id,
                hasOverwrite: true,
                allow: ow.allow.bitfield.toString(),
                deny: ow.deny.bitfield.toString(),
            });
        } else {
            channels.push({
                channelId: ch.id,
                hasOverwrite: false,
                allow: '0',
                deny: '0',
            });
        }
    }
    return channels;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {(msg: string) => void} onProgress
 */
async function applyVitrineLock(guild, publicChannelId, onProgress) {
    await guild.channels.fetch().catch(() => {});
    const everyoneId = guild.id;
    let n = 0;
    for (const ch of guild.channels.cache.values()) {
        if (ch.isThread()) continue;
        if (!VITRINE_CHANNEL_TYPES.has(ch.type)) continue;
        try {
            if (ch.id === publicChannelId) {
                await ch.permissionOverwrites.edit(everyoneId, { ViewChannel: true });
            } else {
                await ch.permissionOverwrites.edit(everyoneId, { ViewChannel: false });
            }
            n += 1;
            if (n % 5 === 0) onProgress?.(`${n} salons…`);
        } catch {
            /* ignore missing access */
        }
        await sleep(120);
    }
    return n;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {Array<{ channelId: string, hasOverwrite: boolean, allow: string, deny: string }>} entries
 */
async function restoreEveryoneFromSnapshot(guild, entries, onProgress) {
    const everyoneId = guild.id;
    let n = 0;
    for (const entry of entries) {
        const ch = guild.channels.cache.get(entry.channelId) || (await guild.channels.fetch(entry.channelId).catch(() => null));
        if (!ch || ch.isThread()) continue;
        try {
            if (entry.hasOverwrite) {
                let a;
                let d;
                try {
                    a = new PermissionsBitField(BigInt(entry.allow));
                    d = new PermissionsBitField(BigInt(entry.deny));
                } catch {
                    continue;
                }
                await ch.permissionOverwrites.edit(everyoneId, { allow: a, deny: d });
            } else {
                await ch.permissionOverwrites.delete(everyoneId);
            }
            n += 1;
            if (n % 5 === 0) onProgress?.(`${n} salons…`);
        } catch {
            /* salon supprimé ou pas les perms */
        }
        await sleep(120);
    }
    return n;
}

function botCanManageChannelPermissions(guild) {
    const me = guild.members.me;
    return me?.permissions.has(PermissionFlagsBits.ManageChannels) ?? false;
}

module.exports = {
    getOrCreateDoc,
    captureEveryoneSnapshot,
    applyVitrineLock,
    restoreEveryoneFromSnapshot,
    botCanManageChannelPermissions,
    VITRINE_CHANNEL_TYPES,
};
