const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const MemberProfile = require('../models/MemberProfile');

function canUseCustomProfile(member, cfg) {
    if (!cfg.profileEnabled) return { ok: false, reason: 'Le profil personnalisable est **désactivé** sur ce serveur.' };
    if (!cfg.profileVipRoleId) {
        return { ok: false, reason: 'Aucun rôle VIP n’est configuré. Un admin doit faire `/setprofil role`.' };
    }
    if (!member.roles.cache.has(cfg.profileVipRoleId)) {
        return {
            ok: false,
            reason: 'Réservé aux membres avec le **rôle acheteur / VIP** de ce serveur.',
        };
    }
    return { ok: true };
}

async function getOrCreateProfileDoc(guildId, userId) {
    return MemberProfile.findOneAndUpdate(
        { guildId, userId },
        { $setOnInsert: { guildId, userId } },
        { upsert: true, new: true }
    );
}

/**
 * @param {import('discord.js').GuildMember} targetMember
 * @param {import('mongoose').Document} cfg
 */
function buildProfileEmbed(targetMember, cfg, profileDoc) {
    const g = targetMember.guild;
    const bio = (profileDoc?.bio || '').trim() || '*Aucune bio pour l’instant.*';
    const colorRaw = profileDoc?.profileColor;
    const color =
        colorRaw != null && colorRaw !== '' && Number.isFinite(Number(colorRaw))
            ? Number(colorRaw)
            : 0x5865f2;

    const ctx = {
        userStr: `${targetMember}`,
        mention: `<@${targetMember.id}>`,
        username: targetMember.user.username,
        displayName: targetMember.displayName,
        serverName: g.name,
        count: String(g.memberCount),
    };

    return new EmbedBuilder()
        .setColor(color)
        .setTitle(`Profil — ${targetMember.displayName}`)
        .setDescription(bio.slice(0, 4096))
        .setThumbnail(targetMember.user.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: 'Compte', value: targetMember.user.tag, inline: true },
            {
                name: 'Membre depuis',
                value: targetMember.joinedTimestamp
                    ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`
                    : '—',
                inline: true,
            }
        )
        .setFooter({ text: `Sur ${g.name}`, iconURL: g.iconURL({ size: 64 }) || undefined })
        .setTimestamp();
}

function sanitizeNickname(raw) {
    const s = String(raw || '')
        .replace(/[\n\r\t]/g, ' ')
        .trim()
        .slice(0, 32);
    return s;
}

function botCanSetNickname(guild, targetMember) {
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) return false;
    if (targetMember.id === guild.ownerId) return false;
    if (me.roles.highest.position <= targetMember.roles.highest.position) return false;
    return true;
}

module.exports = {
    canUseCustomProfile,
    getOrCreateProfileDoc,
    buildProfileEmbed,
    sanitizeNickname,
    botCanSetNickname,
};
