const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
    getOrCreateDoc,
    captureEveryoneSnapshot,
    applyVitrineLock,
    restoreEveryoneFromSnapshot,
    botCanManageChannelPermissions,
} = require('../lib/modeserveur');

/**
 * @returns {Promise<boolean>}
 */
async function runModeserveurSlash(interaction) {
    if (interaction.commandName !== 'modeserveur') return false;

    const { guild, member } = interaction;
    if (!guild || !member) {
        await interaction.reply({ content: 'Utilisable seulement sur un serveur.', ephemeral: true });
        return true;
    }

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: 'Réservé aux **administrateurs**.', ephemeral: true });
        return true;
    }

    if (!botCanManageChannelPermissions(guild)) {
        await interaction.reply({
            content:
                'J’ai besoin de la permission **Gérer les salons** (et mon rôle doit être **au-dessus** des rôles cibles quand Discord l’exige).',
            ephemeral: true,
        });
        return true;
    }

    const sub = interaction.options.getSubcommand();
    const doc = await getOrCreateDoc(guild.id);

    if (sub === 'statut') {
        const e = new EmbedBuilder()
            .setTitle('Mode serveur — vitrine / vente')
            .setColor(doc.vitrineActive ? 0xed4245 : 0x57f287)
            .addFields(
                { name: 'Mode vitrine', value: doc.vitrineActive ? '**ACTIF** (la plupart des salons sont masqués pour @everyone)' : 'Inactif', inline: false },
                {
                    name: 'Salon public',
                    value: doc.publicChannelId ? `<#${doc.publicChannelId}>` : '— (non défini — `/modeserveur salon_public`)',
                    inline: true,
                },
                {
                    name: 'Dernière sauvegarde',
                    value: doc.snapshotAt ? `<t:${Math.floor(doc.snapshotAt.getTime() / 1000)}:F>` : '—',
                    inline: true,
                },
                {
                    name: 'Salons dans l’instantané',
                    value: String(doc.channels?.length ?? 0),
                    inline: true,
                }
            )
            .setDescription(
                '**Ordre conseillé :** `sauvegarder` → `salon_public` → `activer`. Pour revenir : `restaurer` ou `desactiver`.'
            );
        await interaction.reply({ embeds: [e], ephemeral: true });
        return true;
    }

    if (sub === 'sauvegarder') {
        if (doc.vitrineActive) {
            await interaction.reply({
                content:
                    'Le mode vitrine est **actif**. Fais d’abord **`/modeserveur restaurer`** avant une nouvelle sauvegarde (sinon tu enregistrerais l’état « tout masqué »).',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const channels = await captureEveryoneSnapshot(guild);
        doc.channels = channels;
        doc.snapshotAt = new Date();
        await doc.save();
        await interaction.editReply({
            content: `Instantané enregistré : **${channels.length}** salon(s) / catégorie(s) (permissions **@everyone** uniquement). Tu peux définir le salon public puis \`/modeserveur activer\`.`,
        });
        return true;
    }

    if (sub === 'salon_public') {
        const ch = interaction.options.getChannel('salon', true);
        if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
            await interaction.reply({ content: 'Choisis un **salon texte** ou **annonces**.', ephemeral: true });
            return true;
        }
        doc.publicChannelId = ch.id;
        await doc.save();
        await interaction.reply({
            content: `Salon visible pour **@everyone** en mode vitrine : ${ch}`,
            ephemeral: true,
        });
        return true;
    }

    if (sub === 'activer') {
        if (!doc.publicChannelId) {
            await interaction.reply({
                content: 'Définis d’abord le salon public : **`/modeserveur salon_public`**.',
                ephemeral: true,
            });
            return true;
        }
        const pub =
            guild.channels.cache.get(doc.publicChannelId) ||
            (await guild.channels.fetch(doc.publicChannelId).catch(() => null));
        if (!pub?.isTextBased()) {
            await interaction.reply({
                content: 'Le salon public enregistré est introuvable. Reconfigure avec **`/modeserveur salon_public`**.',
                ephemeral: true,
            });
            return true;
        }
        if (!doc.channels?.length) {
            await interaction.reply({
                content:
                    'Aucun instantané. Fais d’abord **`/modeserveur sauvegarder`** pour pouvoir **restaurer** l’état actuel plus tard.',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const n = await applyVitrineLock(guild, doc.publicChannelId, null);
        doc.vitrineActive = true;
        await doc.save();
        await interaction.editReply({
            content: `Mode vitrine **activé**. **${n}** salon(s) traités. ${pub} reste visible pour **@everyone**. Les rôles et l’historique ne sont pas supprimés. Pour revenir : \`/modeserveur restaurer\`.`,
        });
        return true;
    }

    if (sub === 'restaurer' || sub === 'desactiver') {
        if (!doc.channels?.length) {
            await interaction.reply({
                content: 'Aucun instantané sauvegardé. Utilise **`/modeserveur sauvegarder`** quand le serveur est dans l’état normal.',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const n = await restoreEveryoneFromSnapshot(guild, doc.channels, () => {});
        doc.vitrineActive = false;
        await doc.save();
        await interaction.editReply({
            content: `Permissions **@everyone** restaurées depuis l’instantané (**${n}** salon(s) mis à jour). Mode vitrine **désactivé**.`,
        });
        return true;
    }

    await interaction.reply({ content: 'Sous-commande inconnue.', ephemeral: true });
    return true;
}

module.exports = { runModeserveurSlash };
