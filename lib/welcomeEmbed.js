const { EmbedBuilder } = require('discord.js');

function applyWelcomeTemplate(template, member) {
    const g = member.guild;
    return String(template || '')
        .replaceAll('{user}', `${member}`)
        .replaceAll('{username}', member.user.username)
        .replaceAll('{displayname}', member.displayName)
        .replaceAll('{mention}', `<@${member.id}>`)
        .replaceAll('{server}', g.name)
        .replaceAll('{count}', String(g.memberCount));
}

/**
 * Message de bienvenue visuel (embed) + variables dans le texte configuré.
 */
function buildWelcomeEmbed(member, cfg) {
    const desc = applyWelcomeTemplate(cfg.welcomeMessage, member);
    return new EmbedBuilder()
        .setColor(0xe91e8c)
        .setTitle('🎉 Bienvenue')
        .setDescription(desc.slice(0, 4096))
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
            {
                name: '📅 Compte Discord',
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
            {
                name: '👥 Membres',
                value: `**${member.guild.memberCount}**`,
                inline: true,
            }
        )
        .setTimestamp()
        .setFooter({
            text: `Kaizokuni · ${member.guild.name}`,
            iconURL: member.guild.iconURL({ size: 64 }) || undefined,
        });
}

module.exports = { buildWelcomeEmbed, applyWelcomeTemplate };
