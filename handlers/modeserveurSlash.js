const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const {
    getOrCreateDoc,
    captureVitrineSnapshot,
    applyVitrineLock,
    restoreVitrineFromSnapshot,
    botCanManageChannelPermissions,
    MAX_TARGET_ROLES,
} = require('../lib/modeserveur');

function roleListMentions(ids) {
    const arr = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!arr.length) return '— (aucun — seulement **@everyone**)';
    return arr.map((id) => `<@&${id}>`).join(', ').slice(0, 900);
}

async function blockIfVitrineActive(doc, interaction) {
    if (!doc.vitrineActive) return false;
    await interaction.reply({
        content:
            'Le mode vitrine est **actif**. Fais d’abord **`/modeserveur restaurer`** avant de modifier la liste des rôles.',
        ephemeral: true,
    });
    return true;
}

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
    const everyoneId = guild.id;

    if (sub === 'statut') {
        const e = new EmbedBuilder()
            .setTitle('Mode serveur — vitrine / vente')
            .setColor(doc.vitrineActive ? 0xed4245 : 0x57f287)
            .addFields(
                {
                    name: 'Mode vitrine',
                    value: doc.vitrineActive
                        ? '**ACTIF** (salons masqués pour @everyone + rôles cibles)'
                        : 'Inactif',
                    inline: false,
                },
                {
                    name: 'Rôles en plus de @everyone',
                    value: roleListMentions(doc.targetRoleIds),
                    inline: false,
                },
                {
                    name: 'Salon public',
                    value: doc.publicChannelId ? `<#${doc.publicChannelId}>` : '— (`/modeserveur salon_public`)',
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
                `**Rôles :** \`role_ajouter\` / \`role_retirer\` / \`roles_reset\` (max **${MAX_TARGET_ROLES}**).\n` +
                    '**Ordre :** `sauvegarder` → `salon_public` → `activer`. Retour : `restaurer` / `desactiver`.'
            );
        await interaction.reply({
            embeds: [e],
            ephemeral: true,
            allowedMentions: { roles: doc.targetRoleIds || [] },
        });
        return true;
    }

    if (sub === 'role_ajouter') {
        if (await blockIfVitrineActive(doc, interaction)) return true;
        const role = interaction.options.getRole('role', true);
        if (role.id === everyoneId) {
            await interaction.reply({ content: '**@everyone** est déjà toujours inclus.', ephemeral: true });
            return true;
        }
        const list = Array.isArray(doc.targetRoleIds) ? [...doc.targetRoleIds] : [];
        if (list.includes(role.id)) {
            await interaction.reply({ content: 'Ce rôle est **déjà** dans la liste.', ephemeral: true });
            return true;
        }
        if (list.length >= MAX_TARGET_ROLES) {
            await interaction.reply({
                content: `Maximum **${MAX_TARGET_ROLES}** rôles. Retire-en avec \`role_retirer\` ou \`roles_reset\`.`,
                ephemeral: true,
            });
            return true;
        }
        list.push(role.id);
        doc.targetRoleIds = list;
        await doc.save();
        await interaction.reply({
            content: `Rôle ajouté : ${role}\nInstantané : refais \`/modeserveur sauvegarder\` avant \`activer\` si tu avais déjà sauvegardé.`,
            ephemeral: true,
        });
        return true;
    }

    if (sub === 'role_retirer') {
        if (await blockIfVitrineActive(doc, interaction)) return true;
        const role = interaction.options.getRole('role', true);
        const list = (doc.targetRoleIds || []).filter((id) => id !== role.id);
        doc.targetRoleIds = list;
        await doc.save();
        await interaction.reply({
            content: `Rôle retiré : ${role}\nRefais \`/modeserveur sauvegarder\` avant la prochaine activation.`,
            ephemeral: true,
        });
        return true;
    }

    if (sub === 'roles_reset') {
        if (await blockIfVitrineActive(doc, interaction)) return true;
        doc.targetRoleIds = [];
        await doc.save();
        await interaction.reply({
            content: 'Liste des rôles **vidée** : seul **@everyone** sera concerné. Refais **`/modeserveur sauvegarder`**.',
            ephemeral: true,
        });
        return true;
    }

    if (sub === 'sauvegarder') {
        if (doc.vitrineActive) {
            await interaction.reply({
                content:
                    'Le mode vitrine est **actif**. Fais d’abord **`/modeserveur restaurer`** avant une nouvelle sauvegarde.',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const channels = await captureVitrineSnapshot(guild, doc.targetRoleIds || []);
        doc.channels = channels;
        doc.snapshotAt = new Date();
        await doc.save();
        const extra = (doc.targetRoleIds || []).length;
        await interaction.editReply({
            content:
                `Instantané : **${channels.length}** salon(s) — **@everyone**` +
                (extra ? ` + **${extra}** rôle(s)` : '') +
                `. Salon public puis \`/modeserveur activer\`.`,
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
        const extra = doc.targetRoleIds?.length
            ? ` Même visibilité pour : ${roleListMentions(doc.targetRoleIds)}.`
            : '';
        await interaction.reply({
            content: `Salon public (visible en vitrine pour **@everyone**${doc.targetRoleIds?.length ? ' et les rôles cibles' : ''}) : ${ch}.${extra}`,
            ephemeral: true,
            allowedMentions: { roles: doc.targetRoleIds || [] },
        });
        return true;
    }

    if (sub === 'activer') {
        if (!doc.publicChannelId) {
            await interaction.reply({
                content: 'Définis d’abord **`/modeserveur salon_public`**.',
                ephemeral: true,
            });
            return true;
        }
        const pub =
            guild.channels.cache.get(doc.publicChannelId) ||
            (await guild.channels.fetch(doc.publicChannelId).catch(() => null));
        if (!pub?.isTextBased()) {
            await interaction.reply({
                content: 'Salon public introuvable. Reconfigure **`/modeserveur salon_public`**.',
                ephemeral: true,
            });
            return true;
        }
        if (!doc.channels?.length) {
            await interaction.reply({
                content: 'Aucun instantané. Fais **`/modeserveur sauvegarder`** d’abord.',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const n = await applyVitrineLock(guild, doc.publicChannelId, doc.targetRoleIds || [], null);
        doc.vitrineActive = true;
        await doc.save();
        const roleHint = (doc.targetRoleIds || []).length
            ? ` Rôles cibles : ${roleListMentions(doc.targetRoleIds)}.`
            : '';
        await interaction.editReply({
            content:
                `Vitrine **activée**. **${n}** mises à jour de permissions. ${pub} reste visible pour **@everyone**` +
                ((doc.targetRoleIds || []).length ? ' et les **rôles cibles**' : '') +
                `.` +
                roleHint +
                ` \`/modeserveur restaurer\` pour revenir en arrière.`,
            allowedMentions: { roles: doc.targetRoleIds || [] },
        });
        return true;
    }

    if (sub === 'restaurer' || sub === 'desactiver') {
        if (!doc.channels?.length) {
            await interaction.reply({
                content: 'Aucun instantané. Utilise **`/modeserveur sauvegarder`** en état normal.',
                ephemeral: true,
            });
            return true;
        }
        await interaction.deferReply({ ephemeral: true });
        const n = await restoreVitrineFromSnapshot(guild, doc.channels, () => {});
        doc.vitrineActive = false;
        await doc.save();
        await interaction.editReply({
            content: `Permissions restaurées depuis l’instantané (**${n}** mises à jour : @everyone + rôles sauvegardés). Vitrine **désactivée**.`,
        });
        return true;
    }

    await interaction.reply({ content: 'Sous-commande inconnue.', ephemeral: true });
    return true;
}

module.exports = { runModeserveurSlash };
