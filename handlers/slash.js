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
            const delayMs = interaction.options.getInteger('delai_ms') ?? 1200;
            const max = interaction.options.getInteger('max') ?? 200;

            if (!targetCh?.isTextBased() || targetCh.isDMBased()) {
                return interaction.reply({ content: 'Salon cible invalide.', ephemeral: true });
            }

            if (!/\.json$/i.test(file.name || '') && !(file.contentType || '').includes('json')) {
                return interaction.reply({ content: 'Merci de fournir un fichier JSON.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({
                content: `Import JSON lancé vers ${targetCh} (délai ${delayMs}ms, max ${max}).`,
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
