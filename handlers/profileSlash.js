const { PermissionFlagsBits } = require('discord.js');
const MemberProfile = require('../models/MemberProfile');
const {
    canUseCustomProfile,
    getOrCreateProfileDoc,
    buildProfileEmbed,
    sanitizeNickname,
    botCanSetNickname,
} = require('../lib/profiles');

function parseHexColor(raw) {
    if (!raw) return 0x5865f2;
    const s = String(raw).replace(/^#/, '');
    const n = parseInt(s, 16);
    return Number.isFinite(n) && s.length === 6 ? n : 0x5865f2;
}

/**
 * @returns {Promise<boolean>}
 */
async function runProfileSlash(interaction, cfg) {
    const { commandName, guild, member, user } = interaction;
    if (commandName !== 'profil' && commandName !== 'pseudo' && commandName !== 'setprofil') return false;
    if (!guild || !member) {
        await interaction.reply({ content: 'Utilisable seulement sur un serveur.', ephemeral: true });
        return true;
    }

    if (commandName === 'setprofil') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            return true;
        }
        const sub = interaction.options.getSubcommand();
        if (sub === 'view') {
            await interaction.reply({
                content:
                    `**Profil personnalisable**\n` +
                    `Actif : **${cfg.profileEnabled ? 'oui' : 'non'}**\n` +
                    `Rôle requis : ${cfg.profileVipRoleId ? `<@&${cfg.profileVipRoleId}>` : '— (non défini)'}\n\n` +
                    `Membres avec ce rôle : \`/profil\` (bio, couleur) et \`/pseudo\`.`,
                ephemeral: true,
                allowedMentions: { roles: cfg.profileVipRoleId ? [cfg.profileVipRoleId] : [] },
            });
            return true;
        }
        if (sub === 'on') {
            cfg.profileEnabled = true;
            await cfg.save();
            await interaction.reply({
                content: 'Profil **activé**. Définis le **rôle VIP** avec `/setprofil role` pour limiter aux acheteurs.',
                ephemeral: true,
            });
            return true;
        }
        if (sub === 'off') {
            cfg.profileEnabled = false;
            await cfg.save();
            await interaction.reply({ content: 'Profil **désactivé**.', ephemeral: true });
            return true;
        }
        if (sub === 'role') {
            const role = interaction.options.getRole('role', true);
            if (role.managed) {
                await interaction.reply({ content: 'Choisis un rôle classique.', ephemeral: true });
                return true;
            }
            cfg.profileVipRoleId = role.id;
            await cfg.save();
            await interaction.reply({
                content: `Rôle VIP / acheteur : ${role}\nSeuls ces membres pourront utiliser \`/profil\` et \`/pseudo\`.`,
                ephemeral: true,
            });
            return true;
        }
        await interaction.reply({ content: 'Sous-commande inconnue.', ephemeral: true });
        return true;
    }

    if (commandName === 'profil') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'voir') {
            const cible = interaction.options.getUser('membre') || user;
            const targetMember = await guild.members.fetch(cible.id).catch(() => null);
            if (!targetMember) {
                await interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
                return true;
            }
            const doc = await MemberProfile.findOne({ guildId: guild.id, userId: cible.id });
            const embed = buildProfileEmbed(targetMember, cfg, doc);
            await interaction.reply({ embeds: [embed], ephemeral: cible.id === user.id });
            return true;
        }

        const gate = canUseCustomProfile(member, cfg);
        if (!gate.ok) {
            await interaction.reply({ content: gate.reason, ephemeral: true });
            return true;
        }

        if (sub === 'bio') {
            const texte = interaction.options.getString('texte', true).slice(0, 500);
            const doc = await getOrCreateProfileDoc(guild.id, user.id);
            doc.bio = texte;
            await doc.save();
            await interaction.reply({ content: 'Bio mise à jour.', ephemeral: true });
            return true;
        }

        if (sub === 'couleur') {
            const hex = interaction.options.getString('hex', true);
            const doc = await getOrCreateProfileDoc(guild.id, user.id);
            doc.profileColor = parseHexColor(hex);
            await doc.save();
            await interaction.reply({ content: `Couleur du profil : **#${hex.replace(/^#/, '')}**`, ephemeral: true });
            return true;
        }

        if (sub === 'effacer') {
            await MemberProfile.deleteOne({ guildId: guild.id, userId: user.id });
            await interaction.reply({ content: 'Ton profil sur ce serveur a été réinitialisé.', ephemeral: true });
            return true;
        }

        await interaction.reply({ content: 'Sous-commande inconnue.', ephemeral: true });
        return true;
    }

    if (commandName === 'pseudo') {
        const gate = canUseCustomProfile(member, cfg);
        if (!gate.ok) {
            await interaction.reply({ content: gate.reason, ephemeral: true });
            return true;
        }
        const nom = sanitizeNickname(interaction.options.getString('nom', true));
        if (!nom) {
            await interaction.reply({ content: 'Pseudo invalide ou vide (max 32 car.).', ephemeral: true });
            return true;
        }
        if (!botCanSetNickname(guild, member)) {
            await interaction.reply({
                content:
                    'Je ne peux pas modifier ton pseudo ici (permission **Gérer les pseudos**, rôle du bot au-dessus du tien, ou tu es propriétaire du serveur).',
                ephemeral: true,
            });
            return true;
        }
        try {
            await member.setNickname(nom, 'Kaizokuni — /pseudo (membre VIP)');
            await interaction.reply({ content: `Pseudo serveur défini : **${nom}**`, ephemeral: true });
        } catch {
            await interaction.reply({
                content:
                    'Impossible d’appliquer ce pseudo (hiérarchie des rôles, permissions). Vérifie que mon rôle est **au-dessus** du tien.',
                ephemeral: true,
            });
        }
        return true;
    }

    return false;
}

module.exports = { runProfileSlash };
