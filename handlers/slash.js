const {
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
} = require('discord.js');
const Warn = require('../models/Warn');
const { getOrCreateGuildConfig } = require('../lib/db');
const { sendModLog, baseModEmbed } = require('../lib/modLog');
const wallQueue = require('../lib/wallQueue');
const { runWallpaperJob } = require('../lib/wallpaperJob');
const { mirrorChannel } = require('../lib/channelMirror');
const { runJsonImport } = require('../lib/jsonImportJob');
const { buildPaypalFicheEmbed, buildPaypalButtonRow } = require('../lib/paypalUi');
const { normalizeWord, MAX_WORDS } = require('../lib/autmsg');
const axios = require('axios');

function parseHexColor(raw) {
    if (!raw) return 0x5865f2;
    const s = String(raw).replace(/^#/, '');
    const n = parseInt(s, 16);
    return Number.isFinite(n) && s.length === 6 ? n : 0x5865f2;
}

async function handleSlash(interaction) {
    const { commandName, guild, member, user } = interaction;
    if (!guild || !member) {
        return interaction.reply({ content: 'Utilisable seulement sur un serveur.', ephemeral: true });
    }

    const cfg = await getOrCreateGuildConfig(guild.id);

    try {
        if (commandName === 'help') {
            const e = new EmbedBuilder()
                .setTitle('Kaizokuni - panneau mobile')
                .setColor(0x00d4aa)
                .setDescription(
                    'Tout est configurable depuis le telephone avec les **commandes slash**.\nPrefixe texte : `' +
                        cfg.prefix +
                        '`\n\n**Setup rapide**\n1) `/setwelcomechannel`\n2) `/setwelcomerole`\n3) `/config welcometext`\n4) `/config view`'
                )
                .addFields(
                    {
                        name: '⚙️ Config (admin)',
                        value:
                            '`/setwelcomechannel` · `/setwelcomerole` · `/config view` · `/config prefix` · `/config modlog` · `/config welcome` · `/config welcometext` · `/config welcomerole` · `/config wallpaper` · `/config wallpaperdelay` · `/config wallpaperlimit`',
                    },
                    {
                        name: '🧩 Variables bienvenue',
                        value: '`{user}` `{mention}` `{username}` `{displayname}` `{server}` `{count}`',
                    },
                    {
                        name: '🛡️ Modération',
                        value: '`/ban` `/kick` `/timeout` `/untimeout` `/clear` `/warn` `/warnings` `/clearwarns`',
                    },
                    {
                        name: '📣 Contenu',
                        value: '`/embed` `/poll` `/say` `/importjson`',
                    },
                    {
                        name: '⭐ VIP preuve',
                        value: '`/setautorole` (salon PJ, rôle, message, durée, min/max) — réponse en message texte',
                    },
                    {
                        name: '💳 PayPal VIP',
                        value: '`/paypal` · `/setpaypal` (`email`, `prix`, `salon_preuve`, …) · `/setpaypalemail` · `/setpaypalprix`',
                    },
                    {
                        name: '💬 Auto-message',
                        value: '`/autmsg` (`message`, `ajouter`, `retirer`, `liste`, `cooldown`, …)',
                    },
                    {
                        name: '🖼️ Wallpapers',
                        value: '`/wallpaper queue` (URL page ou direct) · `/wallpaper stop`\nÉquivalent : `' +
                            cfg.prefix +
                            'wallpaper <url>` · `' +
                            cfg.prefix +
                            'wallpaper stop`',
                    },
                    {
                        name: '🔧 Divers',
                        value: '`/ping` `/serverinfo`',
                    }
                )
                .setFooter({ text: 'Railway + MONGO_URL' });
            return interaction.reply({ embeds: [e], ephemeral: true });
        }

        if (commandName === 'ping') {
            const sent = await interaction.reply({ content: 'Ping…', fetchReply: true, ephemeral: true });
            const ws = interaction.client.ws.ping;
            return interaction.editReply({
                content: `Pong ! WS **${ws}** ms · aller-retour **${sent.createdTimestamp - interaction.createdTimestamp}** ms`,
            });
        }

        if (commandName === 'serverinfo') {
            const e = new EmbedBuilder()
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ size: 256 }))
                .addFields(
                    { name: 'ID', value: guild.id, inline: true },
                    { name: 'Membres', value: String(guild.memberCount), inline: true },
                    { name: 'Salons', value: String(guild.channels.cache.size), inline: true },
                    { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
                )
                .setColor(0x5865f2);
            return interaction.reply({ embeds: [e], ephemeral: true });
        }

        if (commandName === 'mirror') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const source = interaction.options.getChannel('source', true);
            const cible = interaction.options.getChannel('cible', true);
            const limit = interaction.options.getInteger('limit') ?? 50;
            const pj = interaction.options.getBoolean('pieces_jointes');

            if (!source?.isTextBased() || !cible?.isTextBased()) {
                return interaction.reply({ content: 'Choisis des salons texte.', ephemeral: true });
            }
            if (source.isDMBased() || cible.isDMBased()) {
                return interaction.reply({ content: 'Salons DM non supportés.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({ content: `Mirror en cours : ${source} → ${cible}…` });

            mirrorChannel({
                client: interaction.client,
                sourceChannel: source,
                targetChannel: cible,
                limit,
                includeAttachments: pj === null ? true : pj,
                statusChannel: interaction.channel,
            }).catch((e) => console.error('mirror', e));

            return;
        }

        if (commandName === 'setwelcomechannel') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const ch = interaction.options.getChannel('salon', true);
            if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
            }
            cfg.welcomeChannelId = ch.id;
            await cfg.save();
            return interaction.reply({
                content: `Salon de bienvenue défini : ${ch}`,
                ephemeral: true,
            });
        }

        if (commandName === 'setwelcomerole') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const role = interaction.options.getRole('role');
            if (!role) {
                cfg.welcomeRoleId = null;
                await cfg.save();
                return interaction.reply({
                    content: 'Rôle automatique de bienvenue **désactivé**.',
                    ephemeral: true,
                });
            }
            if (role.managed) {
                return interaction.reply({
                    content: 'Ce rôle est géré par une intégration — choisis un rôle classique.',
                    ephemeral: true,
                });
            }
            cfg.welcomeRoleId = role.id;
            await cfg.save();
            return interaction.reply({
                content: `Les nouveaux membres recevront : ${role}\n_Vérifie que le bot est **au-dessus** de ce rôle et a la permission **Gérer les rôles**._`,
                ephemeral: true,
            });
        }

        if (commandName === 'setautorole') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();

            if (sub === 'view') {
                const e = new EmbedBuilder()
                    .setTitle('VIP preuve — configuration')
                    .setColor(0xf1c40f)
                    .addFields(
                        {
                            name: 'Actif',
                            value: cfg.vipProofEnabled ? 'Oui' : 'Non',
                            inline: true,
                        },
                        {
                            name: 'Salon preuve',
                            value: cfg.vipProofChannelId ? `<#${cfg.vipProofChannelId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Rôle',
                            value: cfg.vipProofRoleId ? `<@&${cfg.vipProofRoleId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'PJ min / max',
                            value: `${cfg.vipProofMinAttachments ?? 3} — ${cfg.vipProofMaxAttachments ?? 10}`,
                            inline: true,
                        },
                        {
                            name: 'Durée',
                            value: `${cfg.vipProofDurationDays ?? 7} jour(s)`,
                            inline: true,
                        },
                        {
                            name: 'Couleur (réserve)',
                            value: `#${(Number(cfg.vipProofEmbedColor) || 0xf1c40f).toString(16).padStart(6, '0')} — non utilisée`,
                            inline: true,
                        },
                        {
                            name: 'Titre optionnel',
                            value: (cfg.vipProofEmbedTitle || '').trim() ? (cfg.vipProofEmbedTitle || '').slice(0, 256) : '— (aucun)',
                        },
                        {
                            name: 'Corps du message',
                            value: (cfg.vipProofEmbedDescription || '—').slice(0, 900),
                        }
                    );
                return interaction.reply({ embeds: [e], ephemeral: true });
            }

            if (sub === 'on') {
                cfg.vipProofEnabled = true;
                await cfg.save();
                return interaction.reply({ content: 'Système VIP preuve **activé**.', ephemeral: true });
            }

            if (sub === 'off') {
                cfg.vipProofEnabled = false;
                await cfg.save();
                return interaction.reply({ content: 'Système VIP preuve **désactivé**.', ephemeral: true });
            }

            if (sub === 'salon') {
                const ch = interaction.options.getChannel('channel', true);
                if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                    return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
                }
                cfg.vipProofChannelId = ch.id;
                await cfg.save();
                return interaction.reply({ content: `Salon preuve : ${ch}`, ephemeral: true });
            }

            if (sub === 'role') {
                const role = interaction.options.getRole('role', true);
                if (role.managed) {
                    return interaction.reply({ content: 'Rôle d’intégration — impossible.', ephemeral: true });
                }
                cfg.vipProofRoleId = role.id;
                await cfg.save();
                return interaction.reply({
                    content: `Rôle VIP : ${role}\nPlace le **rôle du bot** au-dessus + permission **Gérer les rôles**.`,
                    ephemeral: true,
                });
            }

            if (sub === 'message') {
                cfg.vipProofEmbedDescription = interaction.options.getString('texte', true).slice(0, 2000);
                await cfg.save();
                return interaction.reply({ content: 'Message de réponse enregistré.', ephemeral: true });
            }

            if (sub === 'titre') {
                const raw = interaction.options.getString('texte', true).trim();
                const lower = raw.toLowerCase();
                cfg.vipProofEmbedTitle =
                    raw === '' || raw === '-' || lower === 'aucun' ? '' : raw.slice(0, 256);
                await cfg.save();
                return interaction.reply({
                    content: cfg.vipProofEmbedTitle
                        ? 'Titre enregistré (ligne en gras au-dessus du message).'
                        : 'Titre retiré : seul le corps du message sera envoyé.',
                    ephemeral: true,
                });
            }

            if (sub === 'couleur') {
                const hex = interaction.options.getString('hex', true);
                cfg.vipProofEmbedColor = parseHexColor(hex);
                await cfg.save();
                return interaction.reply({ content: `Couleur : **#${hex.replace(/^#/, '')}**`, ephemeral: true });
            }

            if (sub === 'duree') {
                cfg.vipProofDurationDays = interaction.options.getInteger('jours', true);
                await cfg.save();
                return interaction.reply({
                    content: `Durée : **${cfg.vipProofDurationDays}** jour(s).`,
                    ephemeral: true,
                });
            }

            if (sub === 'min') {
                const n = interaction.options.getInteger('nombre', true);
                const currentMax = Number(cfg.vipProofMaxAttachments) || 10;
                if (n > currentMax) {
                    return interaction.reply({
                        content: `Ton max est **${currentMax}**. Mets d’abord \`/setautorole max\` plus haut.`,
                        ephemeral: true,
                    });
                }
                cfg.vipProofMinAttachments = n;
                await cfg.save();
                return interaction.reply({ content: `Minimum PJ : **${n}**.`, ephemeral: true });
            }

            if (sub === 'max') {
                const n = interaction.options.getInteger('nombre', true);
                const currentMin = Number(cfg.vipProofMinAttachments) || 3;
                if (n < currentMin) {
                    return interaction.reply({
                        content: `Ton min est **${currentMin}**. Mets d’abord \`/setautorole min\` plus bas.`,
                        ephemeral: true,
                    });
                }
                cfg.vipProofMaxAttachments = n;
                await cfg.save();
                return interaction.reply({ content: `Maximum PJ : **${n}**.`, ephemeral: true });
            }
        }

        if (commandName === 'paypal') {
            if (!cfg.paypalEnabled) {
                return interaction.reply({
                    content: 'Paiement PayPal non activé. Un admin doit faire `/setpaypal on` après configuration.',
                    ephemeral: true,
                });
            }
            if (!cfg.paypalEmail || !cfg.paypalPrice) {
                return interaction.reply({
                    content:
                        'Fiche incomplète : il manque **email** ou **prix**. Demande à un admin de faire `/setpaypal email` et `/setpaypal prix`.',
                    ephemeral: true,
                });
            }
            const embed = buildPaypalFicheEmbed(cfg, guild);
            const row = buildPaypalButtonRow(cfg, guild.id);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        if (commandName === 'setpaypal') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();

            if (sub === 'view') {
                const e = new EmbedBuilder()
                    .setTitle('PayPal — configuration')
                    .setColor(0x003087)
                    .addFields(
                        { name: 'Actif', value: cfg.paypalEnabled ? 'Oui' : 'Non', inline: true },
                        { name: 'Email', value: cfg.paypalEmail || '—', inline: true },
                        { name: 'Prix', value: cfg.paypalPrice || '—', inline: true },
                        {
                            name: 'Salon preuve',
                            value: cfg.paypalProofChannelId ? `<#${cfg.paypalProofChannelId}>` : '—',
                            inline: true,
                        },
                        { name: 'Lien', value: cfg.paypalMeLink || '—', inline: true },
                        { name: 'Bouton', value: cfg.paypalButtonLabel || '—', inline: true },
                        { name: 'Titre fiche', value: (cfg.paypalEmbedTitle || '—').slice(0, 256) },
                        { name: 'Notes fiche', value: (cfg.paypalNotes || '—').slice(0, 900) },
                        {
                            name: 'Message après bouton',
                            value: (cfg.paypalAfterPayMessage || '—').slice(0, 900),
                        }
                    );
                return interaction.reply({ embeds: [e], ephemeral: true });
            }

            if (sub === 'on') {
                cfg.paypalEnabled = true;
                await cfg.save();
                return interaction.reply({ content: 'PayPal **activé**.', ephemeral: true });
            }

            if (sub === 'off') {
                cfg.paypalEnabled = false;
                await cfg.save();
                return interaction.reply({ content: 'PayPal **désactivé**.', ephemeral: true });
            }

            if (sub === 'email') {
                cfg.paypalEmail = interaction.options.getString('adresse', true).trim().slice(0, 320);
                await cfg.save();
                return interaction.reply({ content: `Email PayPal : **${cfg.paypalEmail}**`, ephemeral: true });
            }

            if (sub === 'prix') {
                cfg.paypalPrice = interaction.options.getString('montant', true).trim().slice(0, 120);
                await cfg.save();
                return interaction.reply({ content: `Prix affiché : **${cfg.paypalPrice}**`, ephemeral: true });
            }

            if (sub === 'salon_preuve') {
                const ch = interaction.options.getChannel('channel', true);
                if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                    return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
                }
                cfg.paypalProofChannelId = ch.id;
                await cfg.save();
                return interaction.reply({ content: `Salon preuve : ${ch}`, ephemeral: true });
            }

            if (sub === 'apres_paiement') {
                cfg.paypalAfterPayMessage = interaction.options.getString('texte', true).slice(0, 2000);
                await cfg.save();
                return interaction.reply({ content: 'Message après clic enregistré.', ephemeral: true });
            }

            if (sub === 'titre') {
                cfg.paypalEmbedTitle = interaction.options.getString('texte', true).slice(0, 256);
                await cfg.save();
                return interaction.reply({ content: 'Titre fiche enregistré.', ephemeral: true });
            }

            if (sub === 'notes') {
                cfg.paypalNotes = interaction.options.getString('texte', true).slice(0, 1500);
                await cfg.save();
                return interaction.reply({ content: 'Notes enregistrées.', ephemeral: true });
            }

            if (sub === 'bouton') {
                cfg.paypalButtonLabel = interaction.options.getString('texte', true).slice(0, 80);
                await cfg.save();
                return interaction.reply({ content: `Libellé bouton : **${cfg.paypalButtonLabel}**`, ephemeral: true });
            }

            if (sub === 'lien') {
                cfg.paypalMeLink = interaction.options.getString('url', true).trim().slice(0, 500);
                await cfg.save();
                return interaction.reply({ content: 'Lien enregistré.', ephemeral: true });
            }

            if (sub === 'couleur') {
                const hex = interaction.options.getString('hex', true);
                cfg.paypalEmbedColor = parseHexColor(hex);
                await cfg.save();
                return interaction.reply({ content: `Couleur fiche : **#${hex.replace(/^#/, '')}**`, ephemeral: true });
            }
        }

        if (commandName === 'setpaypalemail') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            cfg.paypalEmail = interaction.options.getString('email', true).trim().slice(0, 320);
            await cfg.save();
            return interaction.reply({ content: `Email PayPal : **${cfg.paypalEmail}**`, ephemeral: true });
        }

        if (commandName === 'setpaypalprix') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            cfg.paypalPrice = interaction.options.getString('montant', true).trim().slice(0, 120);
            await cfg.save();
            return interaction.reply({ content: `Prix affiché : **${cfg.paypalPrice}**`, ephemeral: true });
        }

        if (commandName === 'autmsg') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();
            const words = Array.isArray(cfg.autmsgWords) ? [...cfg.autmsgWords] : [];

            if (sub === 'view') {
                const e = new EmbedBuilder()
                    .setTitle('Auto-message (/autmsg)')
                    .setColor(0x9b59b6)
                    .addFields(
                        { name: 'Actif', value: cfg.autmsgEnabled ? 'Oui' : 'Non', inline: true },
                        {
                            name: 'Cooldown',
                            value: `${cfg.autmsgCooldownSec ?? 45} s / membre`,
                            inline: true,
                        },
                        {
                            name: 'Mots',
                            value: words.length ? words.map((w) => `\`${w}\``).join(', ').slice(0, 900) : '—',
                        },
                        { name: 'Message', value: (cfg.autmsgResponse || '—').slice(0, 900) }
                    );
                return interaction.reply({ embeds: [e], ephemeral: true });
            }

            if (sub === 'on') {
                cfg.autmsgEnabled = true;
                await cfg.save();
                return interaction.reply({ content: 'Auto-message **activé**.', ephemeral: true });
            }

            if (sub === 'off') {
                cfg.autmsgEnabled = false;
                await cfg.save();
                return interaction.reply({ content: 'Auto-message **désactivé**.', ephemeral: true });
            }

            if (sub === 'message') {
                cfg.autmsgResponse = interaction.options.getString('texte', true).slice(0, 2000);
                await cfg.save();
                return interaction.reply({ content: 'Message enregistré.', ephemeral: true });
            }

            if (sub === 'ajouter') {
                const raw = interaction.options.getString('mot', true);
                const w = normalizeWord(raw);
                if (!w) {
                    return interaction.reply({ content: 'Mot invalide.', ephemeral: true });
                }
                if (words.includes(w)) {
                    return interaction.reply({ content: `Le mot \`${w}\` est déjà dans la liste.`, ephemeral: true });
                }
                if (words.length >= MAX_WORDS) {
                    return interaction.reply({
                        content: `Limite **${MAX_WORDS}** mots. Retire-en avec \`/autmsg retirer\` ou \`/autmsg vider\`.`,
                        ephemeral: true,
                    });
                }
                words.push(w);
                cfg.autmsgWords = words;
                await cfg.save();
                return interaction.reply({ content: `Mot ajouté : \`${w}\` (${words.length}/${MAX_WORDS})`, ephemeral: true });
            }

            if (sub === 'retirer') {
                const w = normalizeWord(interaction.options.getString('mot', true));
                const idx = words.indexOf(w);
                if (idx === -1) {
                    return interaction.reply({ content: `Mot \`${w}\` introuvable.`, ephemeral: true });
                }
                words.splice(idx, 1);
                cfg.autmsgWords = words;
                await cfg.save();
                return interaction.reply({ content: `Mot retiré : \`${w}\``, ephemeral: true });
            }

            if (sub === 'liste') {
                if (!words.length) {
                    return interaction.reply({ content: 'Aucun mot. Utilise `/autmsg ajouter`.', ephemeral: true });
                }
                return interaction.reply({
                    content: `**${words.length}** mot(s) : ${words.map((x) => `\`${x}\``).join(', ')}`.slice(0, 2000),
                    ephemeral: true,
                });
            }

            if (sub === 'vider') {
                cfg.autmsgWords = [];
                await cfg.save();
                return interaction.reply({ content: 'Liste des mots **vidée**.', ephemeral: true });
            }

            if (sub === 'cooldown') {
                cfg.autmsgCooldownSec = interaction.options.getInteger('secondes', true);
                await cfg.save();
                return interaction.reply({
                    content: `Cooldown : **${cfg.autmsgCooldownSec}** s par membre.`,
                    ephemeral: true,
                });
            }
        }

        if (commandName === 'config') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();

            if (sub === 'view') {
                const e = new EmbedBuilder()
                    .setTitle('Configuration')
                    .setColor(0x5865f2)
                    .addFields(
                        { name: 'Préfixe', value: `\`${cfg.prefix}\``, inline: true },
                        {
                            name: 'Modlog',
                            value: cfg.modLogChannelId ? `<#${cfg.modLogChannelId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Bienvenue',
                            value: cfg.welcomeChannelId ? `<#${cfg.welcomeChannelId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Texte bienvenue',
                            value: cfg.welcomeMessage?.slice(0, 900) || '—',
                        },
                        {
                            name: 'Rôle bienvenue (auto)',
                            value: cfg.welcomeRoleId ? `<@&${cfg.welcomeRoleId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Salon wallpapers',
                            value: cfg.wallpaperChannelId ? `<#${cfg.wallpaperChannelId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Délai / max batch',
                            value: `${(cfg.wallpaperDelayMs || 2500) / 1000}s · ${cfg.wallpaperMaxBatch ?? 15}`,
                            inline: true,
                        },
                        {
                            name: 'Rôle mute',
                            value: cfg.muteRoleId ? `<@&${cfg.muteRoleId}>` : '—',
                            inline: true,
                        }
                    );
                return interaction.reply({ embeds: [e], ephemeral: true });
            }

            if (sub === 'prefix') {
                const v = interaction.options.getString('valeur', true).slice(0, 5);
                if (!v.trim()) return interaction.reply({ content: 'Préfixe invalide.', ephemeral: true });
                cfg.prefix = v;
                await cfg.save();
                return interaction.reply({ content: `Préfixe défini sur \`${cfg.prefix}\``, ephemeral: true });
            }

            if (sub === 'modlog') {
                const ch = interaction.options.getChannel('salon', true);
                if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                    return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
                }
                cfg.modLogChannelId = ch.id;
                await cfg.save();
                return interaction.reply({ content: `Modlog → ${ch}`, ephemeral: true });
            }

            if (sub === 'welcome') {
                const ch = interaction.options.getChannel('salon', true);
                if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                    return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
                }
                cfg.welcomeChannelId = ch.id;
                await cfg.save();
                return interaction.reply({ content: `Bienvenue → ${ch}`, ephemeral: true });
            }

            if (sub === 'welcometext') {
                cfg.welcomeMessage = interaction.options.getString('texte', true).slice(0, 1800);
                await cfg.save();
                return interaction.reply({ content: 'Message de bienvenue enregistré.', ephemeral: true });
            }

            if (sub === 'wallpaper') {
                const ch = interaction.options.getChannel('salon', true);
                if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement) {
                    return interaction.reply({ content: 'Choisis un salon texte.', ephemeral: true });
                }
                cfg.wallpaperChannelId = ch.id;
                await cfg.save();
                return interaction.reply({ content: `Wallpapers → ${ch}`, ephemeral: true });
            }

            if (sub === 'wallpaperdelay') {
                const s = interaction.options.getInteger('secondes', true);
                cfg.wallpaperDelayMs = s * 1000;
                await cfg.save();
                return interaction.reply({ content: `Délai : **${s}** s entre chaque envoi.`, ephemeral: true });
            }

            if (sub === 'wallpaperlimit') {
                cfg.wallpaperMaxBatch = interaction.options.getInteger('max', true);
                await cfg.save();
                return interaction.reply({
                    content: `Max **${cfg.wallpaperMaxBatch}** médias par commande.`,
                    ephemeral: true,
                });
            }

            if (sub === 'welcomerole') {
                const role = interaction.options.getRole('role');
                if (!role) {
                    cfg.welcomeRoleId = null;
                    await cfg.save();
                    return interaction.reply({
                        content: 'Rôle automatique de bienvenue **désactivé**.',
                        ephemeral: true,
                    });
                }
                if (role.managed) {
                    return interaction.reply({
                        content: 'Rôle géré par intégration — impossible.',
                        ephemeral: true,
                    });
                }
                cfg.welcomeRoleId = role.id;
                await cfg.save();
                return interaction.reply({
                    content: `Rôle auto : ${role}`,
                    ephemeral: true,
                });
            }

            if (sub === 'muterole') {
                const role = interaction.options.getRole('role', true);
                cfg.muteRoleId = role.id;
                await cfg.save();
                return interaction.reply({ content: `Rôle mute : ${role}`, ephemeral: true });
            }
        }

        if (commandName === 'ban') {
            const target = interaction.options.getUser('membre', true);
            const reason = interaction.options.getString('raison') ?? 'Aucune raison';
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
            await m.ban({ reason: `${user.tag}: ${reason}` });
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Ban',
                    moderator: user,
                    target,
                    color: 0xed4245,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return interaction.reply({ content: `${target.tag} a été banni.`, ephemeral: true });
        }

        if (commandName === 'kick') {
            const target = interaction.options.getUser('membre', true);
            const reason = interaction.options.getString('raison') ?? 'Aucune raison';
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
            await m.kick(`${user.tag}: ${reason}`);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Kick',
                    moderator: user,
                    target,
                    color: 0xf0b232,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return interaction.reply({ content: `${target.tag} a été expulsé.`, ephemeral: true });
        }

        if (commandName === 'timeout') {
            const target = interaction.options.getUser('membre', true);
            const minutes = interaction.options.getInteger('minutes', true);
            const reason = interaction.options.getString('raison') ?? 'Aucune raison';
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
            await m.timeout(minutes * 60 * 1000, `${user.tag}: ${reason}`);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Timeout',
                    moderator: user,
                    target,
                    color: 0xfee75c,
                }).addFields(
                    { name: 'Durée', value: `${minutes} min`, inline: true },
                    { name: 'Raison', value: reason.slice(0, 1000) }
                )
            );
            return interaction.reply({ content: `Timeout appliqué à ${target.tag}.`, ephemeral: true });
        }

        if (commandName === 'untimeout') {
            const target = interaction.options.getUser('membre', true);
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return interaction.reply({ content: 'Membre introuvable.', ephemeral: true });
            await m.timeout(null);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Timeout retiré',
                    moderator: user,
                    target,
                    color: 0x57f287,
                })
            );
            return interaction.reply({ content: `Timeout retiré pour ${target.tag}.`, ephemeral: true });
        }

        if (commandName === 'clear') {
            const n = interaction.options.getInteger('nombre', true);
            const ch = interaction.channel;
            if (!ch?.isTextBased() || ch.isDMBased()) {
                return interaction.reply({ content: 'Salon invalide.', ephemeral: true });
            }
            const deleted = await ch.bulkDelete(n, true).catch(() => null);
            const count = deleted?.size ?? 0;
            await sendModLog(
                guild,
                cfg,
                new EmbedBuilder()
                    .setTitle('Clear')
                    .setColor(0x5865f2)
                    .setDescription(`${user} a supprimé **${count}** message(s) dans ${ch}.`)
                    .setTimestamp()
            );
            return interaction.reply({ content: `**${count}** message(s) supprimés.`, ephemeral: true });
        }

        if (commandName === 'warn') {
            const target = interaction.options.getUser('membre', true);
            const reason = interaction.options.getString('raison') ?? 'Aucune raison';
            await Warn.create({
                guildId: guild.id,
                userId: target.id,
                moderatorId: user.id,
                reason,
            });
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Warn',
                    moderator: user,
                    target,
                    color: 0xfee75c,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return interaction.reply({ content: `${target.tag} a été averti.`, ephemeral: true });
        }

        if (commandName === 'warnings') {
            const target = interaction.options.getUser('membre', true);
            const list = await Warn.find({ guildId: guild.id, userId: target.id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
            if (!list.length) {
                return interaction.reply({ content: 'Aucun warn pour ce membre.', ephemeral: true });
            }
            const lines = list.map(
                (w, i) =>
                    `**${i + 1}.** ${w.reason} — <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`
            );
            const e = new EmbedBuilder()
                .setTitle(`Warns — ${target.tag}`)
                .setDescription(lines.join('\n').slice(0, 3900))
                .setColor(0x5865f2);
            return interaction.reply({ embeds: [e], ephemeral: true });
        }

        if (commandName === 'clearwarns') {
            const target = interaction.options.getUser('membre', true);
            const r = await Warn.deleteMany({ guildId: guild.id, userId: target.id });
            return interaction.reply({
                content: `**${r.deletedCount}** warn(s) supprimés pour ${target.tag}.`,
                ephemeral: true,
            });
        }

        if (commandName === 'embed') {
            const title = interaction.options.getString('titre', true);
            const description = interaction.options.getString('description', true);
            const color = parseHexColor(interaction.options.getString('couleur'));
            const footer = interaction.options.getString('pied');
            const e = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color);
            if (footer) e.setFooter({ text: footer.slice(0, 2048) });
            return interaction.reply({ embeds: [e] });
        }

        if (commandName === 'poll') {
            const q = interaction.options.getString('question', true);
            const a = interaction.options.getString('a', true);
            const b = interaction.options.getString('b', true);
            const c = interaction.options.getString('c');
            const d = interaction.options.getString('d');
            const e = new EmbedBuilder()
                .setTitle('📊 Sondage')
                .setDescription(`**${q}**\n\n🇦 ${a}\n🇧 ${b}${c ? `\n🇨 ${c}` : ''}${d ? `\n🇩 ${d}` : ''}`)
                .setColor(0x5865f2)
                .setFooter({ text: `Par ${user.tag}` });
            const msg = await interaction.reply({ embeds: [e], fetchReply: true });
            await msg.react('🇦');
            await msg.react('🇧');
            if (c) await msg.react('🇨');
            if (d) await msg.react('🇩');
            return;
        }

        if (commandName === 'say') {
            const text = interaction.options.getString('texte', true);
            const chOpt = interaction.options.getChannel('salon');
            const targetCh =
                chOpt && chOpt.type === ChannelType.GuildText ? chOpt : interaction.channel;
            if (!targetCh?.isTextBased()) {
                return interaction.reply({ content: 'Salon invalide.', ephemeral: true });
            }
            await targetCh.send({ content: text });
            return interaction.reply({ content: 'Envoyé.', ephemeral: true });
        }

        if (commandName === 'importjson') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }

            const file = interaction.options.getAttachment('fichier', true);
            const targetCh = interaction.options.getChannel('cible', true);
            const delayMs = Math.max(60_000, interaction.options.getInteger('delai_ms') ?? 60_000);
            const max = interaction.options.getInteger('max') ?? 200;

            if (!targetCh?.isTextBased() || targetCh.isDMBased()) {
                return interaction.reply({ content: 'Salon cible invalide.', ephemeral: true });
            }

            if (!/\.json$/i.test(file.name || '') && !(file.contentType || '').includes('json')) {
                return interaction.reply({ content: 'Merci de fournir un fichier JSON.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({
                content: `Import JSON lancé vers ${targetCh} (délai ${delayMs}ms minimum, max ${max}).`,
            });

            try {
                const { data } = await axios.get(file.url, {
                    responseType: 'text',
                    timeout: 60000,
                    validateStatus: (s) => s >= 200 && s < 400,
                });

                await runJsonImport({
                    jsonText: String(data),
                    targetChannel: targetCh,
                    statusChannel: interaction.channel?.isTextBased() ? interaction.channel : targetCh,
                    delayMs,
                    maxItems: max,
                });
            } catch (e) {
                console.error('importjson', e);
                await (interaction.channel?.isTextBased()
                    ? interaction.channel.send('❌ Import JSON échoué (fichier invalide ou inaccessible).')
                    : Promise.resolve());
            }
            return;
        }

        if (commandName === 'wallpaper') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'Réservé aux administrateurs.', ephemeral: true });
            }
            const sub = interaction.options.getSubcommand();
            if (sub === 'stop') {
                wallQueue.requestCancel(guild.id);
                return interaction.reply({ content: 'Annulation demandée (file en cours).', ephemeral: true });
            }
            if (sub === 'queue') {
                const url = interaction.options.getString('url', true);
                const targetCh = cfg.wallpaperChannelId
                    ? guild.channels.cache.get(cfg.wallpaperChannelId)
                    : interaction.channel;
                if (!targetCh?.isTextBased()) {
                    return interaction.reply({
                        content:
                            'Définis un salon avec `/config wallpaper` ou utilise la commande dans un salon texte.',
                        ephemeral: true,
                    });
                }
                await interaction.deferReply({ ephemeral: true });
                await interaction.editReply({
                    content: 'File wallpaper démarrée. Regarde le salon cible pour les envois.',
                });
                runWallpaperJob({
                    guildId: guild.id,
                    statusChannel: interaction.channel?.isTextBased() ? interaction.channel : targetCh,
                    targetChannel: targetCh,
                    url,
                }).catch((e) => console.error('wallpaperJob', e));
                return;
            }
        }

        return interaction.reply({ content: 'Commande inconnue.', ephemeral: true });
    } catch (err) {
        console.error(err);
        const payload = { content: 'Erreur lors de l’exécution.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            return interaction.followUp(payload).catch(() => interaction.editReply(payload));
        }
        return interaction.reply(payload).catch(() => {});
    }
}

module.exports = { handleSlash };
