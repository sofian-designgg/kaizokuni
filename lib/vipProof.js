const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getOrCreateGuildConfig } = require('./db');
const VipGrant = require('../models/VipGrant');

function applyVipTemplate(str, ctx) {
    return String(str || '')
        .replaceAll('{user}', ctx.userTag)
        .replaceAll('{mention}', ctx.mention)
        .replaceAll('{username}', ctx.username)
        .replaceAll('{server}', ctx.serverName)
        .replaceAll('{role}', ctx.roleName)
        .replaceAll('{expires}', String(ctx.expiresUnix))
        .replaceAll('{nb_fichiers}', String(ctx.nbFichiers));
}

async function sweepExpiredVips(client) {
    const now = new Date();
    const expired = await VipGrant.find({ expiresAt: { $lte: now } }).lean();
    for (const doc of expired) {
        try {
            const guild = client.guilds.cache.get(doc.guildId) || (await client.guilds.fetch(doc.guildId).catch(() => null));
            if (!guild) {
                await VipGrant.deleteOne({ _id: doc._id });
                continue;
            }
            const member = await guild.members.fetch(doc.userId).catch(() => null);
            const role = guild.roles.cache.get(doc.roleId);
            if (member && role && member.roles.cache.has(role.id)) {
                await member.roles.remove(role, 'Kaizokuni — VIP expiré').catch(() => {});
            }
        } catch {
            /* ignore */
        }
        await VipGrant.deleteOne({ _id: doc._id });
    }
}

function startVipSweep(client) {
    const intervalMs = 10 * 60 * 1000;
    sweepExpiredVips(client).catch(() => {});
    setInterval(() => sweepExpiredVips(client).catch(() => {}), intervalMs);
}

/**
 * @param {import('discord.js').Message} message
 */
async function handleVipProofMessage(message) {
    if (message.author.bot || !message.guild) return;

    const cfg = await getOrCreateGuildConfig(message.guild.id);
    if (!cfg.vipProofEnabled || !cfg.vipProofChannelId) return;
    if (message.channelId !== cfg.vipProofChannelId) return;

    const min = Math.max(1, Number(cfg.vipProofMinAttachments) || 3);
    const max = Math.max(min, Number(cfg.vipProofMaxAttachments) || 10);
    const n = message.attachments.size;

    if (n === 0) return;

    const failEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('Preuve incomplète')
        .setDescription(
            `Il faut envoyer **entre ${min} et ${max}** pièces jointes dans **un seul** message.\nTu en as envoyé **${n}**.`
        );

    if (n < min || n > max) {
        await message.reply({ embeds: [failEmbed], allowedMentions: { repliedUser: true } }).catch(() => {});
        return;
    }

    if (!cfg.vipProofRoleId) return;

    const role = message.guild.roles.cache.get(cfg.vipProofRoleId);
    if (!role) return;

    const me = message.guild.members.me;
    if (
        !me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
        me.roles.highest.position <= role.position
    ) {
        return;
    }
    if (role.managed) return;

    const member = message.member;
    if (!member) return;

    const days = Math.min(90, Math.max(1, Number(cfg.vipProofDurationDays) || 7));
    const expiresAt = new Date(Date.now() + days * 86400000);
    const expiresUnix = Math.floor(expiresAt.getTime() / 1000);

    await member.roles.add(role, 'Kaizokuni — preuve VIP validée').catch(() => {});

    await VipGrant.findOneAndUpdate(
        { guildId: message.guild.id, userId: message.author.id },
        {
            $set: {
                roleId: role.id,
                expiresAt,
            },
        },
        { upsert: true, new: true }
    );

    const ctx = {
        userTag: message.author.tag,
        mention: `<@${message.author.id}>`,
        username: message.author.username,
        serverName: message.guild.name,
        roleName: role.name,
        expiresUnix,
        nbFichiers: n,
    };

    const title = applyVipTemplate(cfg.vipProofEmbedTitle || 'VIP validé', ctx).slice(0, 256);
    const description = applyVipTemplate(cfg.vipProofEmbedDescription, ctx).slice(0, 4096);
    const color = Number.isFinite(cfg.vipProofEmbedColor) ? cfg.vipProofEmbedColor : 0xf1c40f;

    const ok = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(message.author.displayAvatarURL({ size: 256 }))
        .setTimestamp()
        .setFooter({ text: 'Kaizokuni · VIP preuve' });

    await message.reply({ embeds: [ok], allowedMentions: { users: [message.author.id] } }).catch(() => {});
}

module.exports = { handleVipProofMessage, startVipSweep, sweepExpiredVips };
