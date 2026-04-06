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

const MAX_TARGET_ROLES = 15;

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function getOrCreateDoc(guildId) {
    let doc = await VitrineSnapshot.findOne({ guildId });
    if (!doc) {
        doc = await VitrineSnapshot.create({ guildId });
    }
    if (!Array.isArray(doc.targetRoleIds)) {
        doc.targetRoleIds = [];
    }
    return doc;
}

/**
 * Ancien format { channelId, hasOverwrite, allow, deny } → nouveau
 */
function normalizeChannelEntry(entry) {
    if (entry && entry.everyone) {
        return {
            channelId: entry.channelId,
            everyone: entry.everyone,
            roles: Array.isArray(entry.roles) ? entry.roles : [],
        };
    }
    if (entry && Object.prototype.hasOwnProperty.call(entry, 'hasOverwrite')) {
        return {
            channelId: entry.channelId,
            everyone: {
                hasOverwrite: entry.hasOverwrite,
                allow: entry.allow ?? '0',
                deny: entry.deny ?? '0',
            },
            roles: [],
        };
    }
    return null;
}

function captureOverwriteForId(ch, overwriteId) {
    const ow = ch.permissionOverwrites.cache.get(overwriteId);
    if (ow) {
        return {
            hasOverwrite: true,
            allow: ow.allow.bitfield.toString(),
            deny: ow.deny.bitfield.toString(),
        };
    }
    return { hasOverwrite: false, allow: '0', deny: '0' };
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string[]} roleIds — sans doublon, sans @everyone
 */
async function captureVitrineSnapshot(guild, roleIds) {
    const everyoneId = guild.id;
    const uniqueRoleIds = [...new Set((roleIds || []).filter((id) => id && id !== everyoneId))].slice(
        0,
        MAX_TARGET_ROLES
    );

    await guild.channels.fetch().catch(() => {});
    const channels = [];
    for (const ch of guild.channels.cache.values()) {
        if (ch.isThread()) continue;
        if (!VITRINE_CHANNEL_TYPES.has(ch.type)) continue;

        const everyone = captureOverwriteForId(ch, everyoneId);
        const roles = [];
        for (const rid of uniqueRoleIds) {
            roles.push({
                roleId: rid,
                ...captureOverwriteForId(ch, rid),
            });
        }
        channels.push({ channelId: ch.id, everyone, roles });
    }
    return channels;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string} publicChannelId
 * @param {string[]} extraRoleIds
 */
async function applyVitrineLock(guild, publicChannelId, extraRoleIds, onProgress) {
    const everyoneId = guild.id;
    const roleIds = [...new Set((extraRoleIds || []).filter((id) => id && id !== everyoneId))].slice(
        0,
        MAX_TARGET_ROLES
    );
    const targetIds = [everyoneId, ...roleIds];

    await guild.channels.fetch().catch(() => {});
    let n = 0;
    for (const ch of guild.channels.cache.values()) {
        if (ch.isThread()) continue;
        if (!VITRINE_CHANNEL_TYPES.has(ch.type)) continue;
        for (const oid of targetIds) {
            if (oid !== everyoneId && !guild.roles.cache.has(oid)) continue;
            try {
                if (ch.id === publicChannelId) {
                    await ch.permissionOverwrites.edit(oid, { ViewChannel: true });
                } else {
                    await ch.permissionOverwrites.edit(oid, { ViewChannel: false });
                }
                n += 1;
                if (n % 8 === 0) onProgress?.(`${n} mises à jour…`);
            } catch {
                /* ignore */
            }
            await sleep(120);
        }
    }
    return n;
}

/**
 * Remet « Voir le salon » en héritage (utile si delete échoue ou vitrine sans snapshot rôle).
 */
async function clearViewChannelToInherit(ch, subjectId) {
    try {
        await ch.permissionOverwrites.edit(subjectId, { ViewChannel: null });
        return true;
    } catch {
        return false;
    }
}

async function restoreOverwriteForSubject(ch, subjectId, data) {
    try {
        if (data.hasOverwrite) {
            let a;
            let d;
            try {
                a = new PermissionsBitField(BigInt(data.allow));
                d = new PermissionsBitField(BigInt(data.deny));
            } catch {
                return false;
            }
            await ch.permissionOverwrites.edit(subjectId, { allow: a, deny: d });
        } else {
            await ch.permissionOverwrites.delete(subjectId);
        }
        return true;
    } catch {
        if (!data.hasOverwrite) {
            return clearViewChannelToInherit(ch, subjectId);
        }
        return false;
    }
}

function sortedVitrineChannels(guild) {
    const list = [...guild.channels.cache.values()].filter(
        (ch) => !ch.isThread() && VITRINE_CHANNEL_TYPES.has(ch.type)
    );
    list.sort((a, b) => {
        const ac = a.type === ChannelType.GuildCategory ? 0 : 1;
        const bc = b.type === ChannelType.GuildCategory ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return (a.rawPosition ?? 0) - (b.rawPosition ?? 0);
    });
    return list;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {Array} rawEntries
 * @param {string[]} targetRoleIds — rôles cibles actuels (instantanés anciens sans `roles[]`)
 */
async function restoreVitrineFromSnapshot(guild, rawEntries, targetRoleIds, onProgress) {
    const everyoneId = guild.id;
    const roleTargets = [...new Set((targetRoleIds || []).filter((id) => id && id !== everyoneId))];

    await guild.channels.fetch().catch(() => {});

    const entryMap = new Map();
    for (const raw of rawEntries) {
        const e = normalizeChannelEntry(raw);
        if (e) entryMap.set(e.channelId, e);
    }

    let n = 0;
    for (const ch of sortedVitrineChannels(guild)) {
        const entry = entryMap.get(ch.id);

        if (entry) {
            await restoreOverwriteForSubject(ch, everyoneId, entry.everyone);
            n += 1;
            if (n % 8 === 0) onProgress?.(`${n}…`);
            await sleep(120);

            const restoredRoleIds = new Set((entry.roles || []).map((r) => r.roleId).filter(Boolean));
            for (const r of entry.roles || []) {
                if (!r.roleId || !guild.roles.cache.has(r.roleId)) continue;
                await restoreOverwriteForSubject(ch, r.roleId, {
                    hasOverwrite: r.hasOverwrite,
                    allow: r.allow,
                    deny: r.deny,
                });
                n += 1;
                if (n % 8 === 0) onProgress?.(`${n}…`);
                await sleep(120);
            }

            for (const rid of roleTargets) {
                if (!guild.roles.cache.has(rid)) continue;
                if (restoredRoleIds.has(rid)) continue;
                if (await clearViewChannelToInherit(ch, rid)) n += 1;
                await sleep(80);
            }
        } else {
            /** Salon absent de l’instantané (créé après sauvegarde) mais peut encore avoir la vitrine */
            if (await clearViewChannelToInherit(ch, everyoneId)) n += 1;
            await sleep(80);
            for (const rid of roleTargets) {
                if (!guild.roles.cache.has(rid)) continue;
                if (await clearViewChannelToInherit(ch, rid)) n += 1;
                await sleep(80);
            }
        }
    }

    return n;
}

function botCanManageChannelPermissions(guild) {
    const me = guild.members.me;
    return me?.permissions?.has(PermissionFlagsBits.ManageChannels) ?? false;
}

module.exports = {
    getOrCreateDoc,
    normalizeChannelEntry,
    captureVitrineSnapshot,
    applyVitrineLock,
    restoreVitrineFromSnapshot,
    botCanManageChannelPermissions,
    VITRINE_CHANNEL_TYPES,
    MAX_TARGET_ROLES,
};
