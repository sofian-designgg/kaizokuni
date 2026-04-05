const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/** customId = kz_paypal_paid:<guildId> */
const PAYPAL_BUTTON_PREFIX = 'kz_paypal_paid:';

function buildPaypalFicheEmbed(cfg, guild) {
    const lines = [];
    lines.push(`**Montant :** ${cfg.paypalPrice || '—'}`);
    lines.push(`**Envoyer à (PayPal) :** \`${cfg.paypalEmail || '—'}\``);
    if (cfg.paypalMeLink) {
        lines.push(`**Lien rapide :** ${cfg.paypalMeLink}`);
    }
    if (cfg.paypalNotes) {
        lines.push('');
        lines.push(cfg.paypalNotes.slice(0, 1500));
    }
    lines.push('');
    lines.push(
        '*Choisis **Amis et famille** si possible. Une fois le paiement envoyé, clique sur le bouton ci-dessous.*'
    );

    return new EmbedBuilder()
        .setTitle((cfg.paypalEmbedTitle || 'Paiement VIP — PayPal').slice(0, 256))
        .setDescription(lines.join('\n').slice(0, 4096))
        .setColor(Number.isFinite(cfg.paypalEmbedColor) ? cfg.paypalEmbedColor : 0x003087)
        .setFooter({ text: guild.name, iconURL: guild.iconURL({ size: 64 }) || undefined })
        .setTimestamp();
}

function buildPaypalButtonRow(cfg, guildId) {
    const label = (cfg.paypalButtonLabel || 'J’ai envoyé le paiement').slice(0, 80);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`${PAYPAL_BUTTON_PREFIX}${guildId}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Success)
    );
    return row;
}

function parsePaypalButtonCustomId(customId) {
    if (!customId || !customId.startsWith(PAYPAL_BUTTON_PREFIX)) return null;
    const guildId = customId.slice(PAYPAL_BUTTON_PREFIX.length);
    if (!/^\d{17,20}$/.test(guildId)) return null;
    return guildId;
}

function applyAfterPayTemplate(str, { mention, proofChannelMention }) {
    return String(str || '')
        .replaceAll('{mention}', mention)
        .replaceAll('{proof_channel}', proofChannelMention);
}

module.exports = {
    PAYPAL_BUTTON_PREFIX,
    buildPaypalFicheEmbed,
    buildPaypalButtonRow,
    parsePaypalButtonCustomId,
    applyAfterPayTemplate,
};
