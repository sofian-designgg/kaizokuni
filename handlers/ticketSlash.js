const {
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const { getOrCreateGuildConfig } = require('../lib/db');
const Ticket = require('../models/Ticket');
const {
    BTN_OPEN,
    BTN_CLOSE,
    buildTicketPanelEmbed,
    ticketPanelRow,
    countOpenTicketsForUser,
    createTicketChannel,
    memberCanCloseTicket,
} = require('../lib/ticketsLogic');

function parseHexColor(raw) {
    if (!raw) return 0x5865f2;
    const s = String(raw).replace(/^#/, '');
    const n = parseInt(s, 16);
    return Number.isFinite(n) && s.length === 6 ? n : 0x5865f2;
}

/**
 * @returns {Promise<boolean>} true si la commande a été traitée
 */
async function runTicketSlash(interaction) {
    const { commandName, guild, member } = interaction;
    if (commandName !== 'setticket' && commandName !== 'ticketpanel') return false;
    if (!guild || !member) {
        await interaction.reply({ content: 'Utilisable seulement sur un serveur.', ephemeral: true });
        return true;
    }

    const cfg = await getOrCreateGuildConfig(guild.id);

    if (commandName === 'ticketpanel') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            return true;
        }
        if (!cfg.ticketEnabled) {
            await interaction.reply({
                content: 'Système ticket **désactivé**. Active avec `/setticket on` puis configure catégorie + staff.',
                ephemeral: true,
            });
            return true;
        }
        const ch = interaction.channel;
        if (!ch?.isTextBased() || ch.isDMBased()) {
            await interaction.reply({ content: 'Utilise cette commande dans un salon texte.', ephemeral: true });
            return true;
        }
        const embed = buildTicketPanelEmbed(cfg, guild);
        const row = ticketPanelRow(cfg);
        await ch.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Panneau ticket envoyé.', ephemeral: true });
        return true;
    }

    if (commandName === 'setticket') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            return true;
        }
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
            const e = new EmbedBuilder()
                .setTitle('Tickets — configuration')
                .setColor(0x5865f2)
                .addFields(
                    { name: 'Actif', value: cfg.ticketEnabled ? 'Oui' : 'Non', inline: true },
                    {
                        name: 'Catégorie',
                        value: cfg.ticketCategoryId ? `<#${cfg.ticketCategoryId}>` : '—',
                        inline: true,
                    },
                    {
                        name: 'Rôle staff',
                        value: cfg.ticketStaffRoleId ? `<@&${cfg.ticketStaffRoleId}>` : '—',
                        inline: true,
                    },
                    {
                        name: 'Salon logs',
                        value: cfg.ticketLogChannelId ? `<#${cfg.ticketLogChannelId}>` : '—',
                        inline: true,
                    },
                    {
                        name: 'Max tickets / membre',
                        value: String(cfg.ticketMaxOpenPerUser ?? 1),
                        inline: true,
                    },
                    { name: 'Bouton panel', value: (cfg.ticketPanelButtonLabel || '—').slice(0, 80) },
                    { name: 'Panel — titre', value: (cfg.ticketPanelTitle || '—').slice(0, 256) },
                    { name: 'Panel — description', value: (cfg.ticketPanelDescription || '—').slice(0, 900) },
                    {
                        name: 'Accueil ticket — titre',
                        value: (cfg.ticketOpenTitle || '—').slice(0, 256),
                    },
                    {
                        name: 'Accueil ticket — description',
                        value: (cfg.ticketOpenDescription || '—').slice(0, 700),
                    }
                );
            await interaction.reply({ embeds: [e], ephemeral: true });
            return true;
        }

        if (sub === 'on') {
            cfg.ticketEnabled = true;
            await cfg.save();
            await interaction.reply({ content: 'Tickets **activés**. Définis la **catégorie** et le **rôle staff**, puis `/ticketpanel`.', ephemeral: true });
            return true;
        }

        if (sub === 'off') {
            cfg.ticketEnabled = false;
            await cfg.save();
            await interaction.reply({ content: 'Tickets **désactivés**.', ephemeral: true });
            return true;
        }

        if (sub === 'categorie') {
            const cat = interaction.options.getChannel('dossier', true);
            if (cat.type !== ChannelType.GuildCategory) {
                await interaction.reply({ content: 'Choisis une **catégorie**.', ephemeral: true });
                return true;
            }
            cfg.ticketCategoryId = cat.id;
            await cfg.save();
            await interaction.reply({ content: `Catégorie : **${cat.name}**`, ephemeral: true });
            return true;
        }

        if (sub === 'staff') {
            const role = interaction.options.getRole('role', true);
            if (role.managed) {
                await interaction.reply({ content: 'Choisis un rôle classique (pas une intégration).', ephemeral: true });
                return true;
            }
            cfg.ticketStaffRoleId = role.id;
            await cfg.save();
            await interaction.reply({ content: `Rôle staff ticket : ${role}`, ephemeral: true });
            return true;
        }

        if (sub === 'salon_logs') {
            const ch = interaction.options.getChannel('salon', true);
            if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                await interaction.reply({ content: 'Salon texte requis.', ephemeral: true });
                return true;
            }
            cfg.ticketLogChannelId = ch.id;
            await cfg.save();
            await interaction.reply({ content: `Logs fermeture → ${ch}`, ephemeral: true });
            return true;
        }

        if (sub === 'max') {
            const n = interaction.options.getInteger('nombre', true);
            cfg.ticketMaxOpenPerUser = Math.min(5, Math.max(1, n));
            await cfg.save();
            await interaction.reply({ content: `Max **${cfg.ticketMaxOpenPerUser}** ticket(s) ouvert(s) par membre.`, ephemeral: true });
            return true;
        }

        if (sub === 'bouton') {
            cfg.ticketPanelButtonLabel = interaction.options.getString('texte', true).slice(0, 80);
            await cfg.save();
            await interaction.reply({ content: 'Libellé du bouton enregistré.', ephemeral: true });
            return true;
        }

        if (sub === 'panel_titre') {
            cfg.ticketPanelTitle = interaction.options.getString('texte', true).slice(0, 256);
            await cfg.save();
            await interaction.reply({ content: 'Titre du panneau enregistré.', ephemeral: true });
            return true;
        }

        if (sub === 'panel_desc') {
            cfg.ticketPanelDescription = interaction.options.getString('texte', true).slice(0, 4000);
            await cfg.save();
            await interaction.reply({ content: 'Description du panneau enregistrée.', ephemeral: true });
            return true;
        }

        if (sub === 'panel_couleur') {
            cfg.ticketPanelColor = parseHexColor(interaction.options.getString('hex', true));
            await cfg.save();
            await interaction.reply({ content: 'Couleur du panneau enregistrée.', ephemeral: true });
            return true;
        }

        if (sub === 'panel_pied') {
            const t = interaction.options.getString('texte', true).trim();
            cfg.ticketPanelFooter = t === '-' ? '' : t.slice(0, 2048);
            await cfg.save();
            await interaction.reply({ content: 'Pied du panneau enregistré.', ephemeral: true });
            return true;
        }

        if (sub === 'accueil_titre') {
            cfg.ticketOpenTitle = interaction.options.getString('texte', true).slice(0, 256);
            await cfg.save();
            await interaction.reply({ content: 'Titre du message d’accueil (dans le ticket) enregistré.', ephemeral: true });
            return true;
        }

        if (sub === 'accueil_desc') {
            cfg.ticketOpenDescription = interaction.options.getString('texte', true).slice(0, 4000);
            await cfg.save();
            await interaction.reply({ content: 'Description d’accueil enregistrée.', ephemeral: true });
            return true;
        }

        if (sub === 'accueil_couleur') {
            cfg.ticketOpenColor = parseHexColor(interaction.options.getString('hex', true));
            await cfg.save();
            await interaction.reply({ content: 'Couleur d’accueil enregistrée.', ephemeral: true });
            return true;
        }

        await interaction.reply({ content: 'Sous-commande inconnue.', ephemeral: true });
        return true;
    }

    return false;
}

async function runTicketButton(interaction) {
    if (!interaction.isButton()) return false;
    const id = interaction.customId;
    if (id !== BTN_OPEN && id !== BTN_CLOSE) return false;

    const { guild, member, user } = interaction;
    if (!guild || !member) {
        await interaction.reply({ content: 'Erreur serveur.', ephemeral: true });
        return true;
    }

    const cfg = await getOrCreateGuildConfig(guild.id);

    if (id === BTN_OPEN) {
        if (!cfg.ticketEnabled) {
            await interaction.reply({ content: 'Les tickets sont désactivés.', ephemeral: true });
            return true;
        }
        const max = Math.min(5, Math.max(1, Number(cfg.ticketMaxOpenPerUser) || 1));
        const openCount = await countOpenTicketsForUser(guild.id, user.id);
        if (openCount >= max) {
            await interaction.reply({
                content: `Tu as déjà **${max}** ticket(s) ouvert(s). Ferme-en un avant d’en rouvrir.`,
                ephemeral: true,
            });
            return true;
        }

        await interaction.deferReply({ ephemeral: true });
        const opener = await guild.members.fetch(user.id).catch(() => null);
        if (!opener) {
            await interaction.editReply({ content: 'Impossible de te charger comme membre.' });
            return true;
        }

        const result = await createTicketChannel(guild, opener, cfg);
        if (result.error) {
            await interaction.editReply({ content: result.error });
            return true;
        }
        await interaction.editReply({
            content: `Ticket créé : ${result.channel}\nExplique ta demande dans ce salon.`,
        });
        return true;
    }

    if (id === BTN_CLOSE) {
        const doc = await Ticket.findOne({ channelId: interaction.channelId, status: 'open' });
        if (!doc) {
            await interaction.reply({ content: 'Ce salon n’est pas un ticket actif.', ephemeral: true });
            return true;
        }
        if (!memberCanCloseTicket(member, cfg, doc)) {
            await interaction.reply({ content: 'Tu ne peux pas fermer ce ticket.', ephemeral: true });
            return true;
        }

        const logCh = cfg.ticketLogChannelId ? guild.channels.cache.get(cfg.ticketLogChannelId) : null;
        if (logCh?.isTextBased()) {
            const opener = await guild.members.fetch(doc.openerId).catch(() => null);
            const le = new EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('Ticket fermé')
                .setDescription(
                    `Salon : \`${interaction.channel.name}\`\nAuteur : ${opener ? `${opener}` : `<@${doc.openerId}>`}\nFermé par : ${member}`
                )
                .setTimestamp();
            await logCh.send({ embeds: [le] }).catch(() => {});
        }

        await Ticket.updateOne({ _id: doc._id }, { $set: { status: 'closed' } });
        await interaction.reply({ content: '**Ticket fermé.** Ce salon va être supprimé.', ephemeral: true });
        await interaction.channel.delete('Kaizokuni — ticket fermé').catch(() => {});
        return true;
    }

    return false;
}

module.exports = { runTicketSlash, runTicketButton };
