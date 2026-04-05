const { getOrCreateGuildConfig } = require('../lib/db');
const { applyAfterPayTemplate } = require('../lib/paypalUi');

async function handlePaypalButton(interaction) {
    if (!interaction.isButton()) return;
    const { customId, guild, user } = interaction;
    if (!customId.startsWith('kz_paypal_paid:')) return;

    if (!guild) {
        return interaction.reply({ content: 'Utilisable seulement sur un serveur.', ephemeral: true });
    }

    const cfg = await getOrCreateGuildConfig(guild.id);
    if (!cfg.paypalEnabled) {
        return interaction.reply({ content: 'Paiement PayPal désactivé sur ce serveur.', ephemeral: true });
    }

    const proofMention = cfg.paypalProofChannelId
        ? `<#${cfg.paypalProofChannelId}>`
        : 'le salon indiqué par le staff';

    const text = applyAfterPayTemplate(cfg.paypalAfterPayMessage, {
        mention: `<@${user.id}>`,
        proofChannelMention: proofMention,
    }).slice(0, 2000);

    return interaction.reply({
        content: text,
        ephemeral: true,
        allowedMentions: { users: [user.id] },
    });
}

module.exports = { handlePaypalButton };
