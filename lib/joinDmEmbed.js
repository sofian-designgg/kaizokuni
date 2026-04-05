const { EmbedBuilder } = require('discord.js');
const { applyWelcomeTemplate } = require('./welcomeEmbed');

const DEFAULT_JOIN_DM_DESC =
    '**Le VIP est optionnel** sur ce serveur : ce n’est **pas** un paiement obligatoire pour rejoindre ou rester.\n\n' +
    '{mention} — lis les salons **règles** et **infos** avant de conclure quoi que ce soit. ' +
    'En cas de doute, demande à l’équipe en salon public.';

/**
 * MP automatique à l’arrivée (embed) — mêmes variables que la bienvenue : {user} {mention} …
 * @param {import('discord.js').GuildMember} member
 * @param {import('mongoose').Document} cfg GuildConfig
 */
function buildJoinDmEmbed(member, cfg) {
    const titleRaw = applyWelcomeTemplate(cfg.joinDmTitle || '', member).trim();
    const desc = applyWelcomeTemplate(
        cfg.joinDmDescription && String(cfg.joinDmDescription).trim()
            ? cfg.joinDmDescription
            : DEFAULT_JOIN_DM_DESC,
        member
    ).slice(0, 4096);

    const color = Number(cfg.joinDmColor);
    const embed = new EmbedBuilder()
        .setColor(Number.isFinite(color) ? color : 0x3498db)
        .setDescription(desc)
        .setTimestamp();

    if (titleRaw) {
        embed.setTitle(titleRaw.slice(0, 256));
    }

    const footerRaw = (cfg.joinDmFooter || '').trim();
    const footerText = footerRaw
        ? applyWelcomeTemplate(footerRaw, member).trim().slice(0, 2048)
        : member.guild.name;
    embed.setFooter({
        text: footerText || member.guild.name,
        iconURL: member.guild.iconURL({ size: 64 }) || undefined,
    });

    return embed;
}

module.exports = { buildJoinDmEmbed, DEFAULT_JOIN_DM_DESC };
