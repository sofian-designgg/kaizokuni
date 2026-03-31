const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const Warn = require('../models/Warn');
const { getOrCreateGuildConfig } = require('../lib/db');
const { sendModLog, baseModEmbed } = require('../lib/modLog');
const wallQueue = require('../lib/wallQueue');
const { runWallpaperJob } = require('../lib/wallpaperJob');
const { parseChannelIdLoose } = require('../lib/discordLinkParse');
const { mirrorChannel, resolveSourceChannelFromLink } = require('../lib/channelMirror');
const { importFromJsonAttachment } = require('../lib/jsonImport');

function parseHexColor(raw) {
    if (!raw) return 0x5865f2;
    const s = String(raw).replace(/^#/, '');
    const n = parseInt(s, 16);
    return Number.isFinite(n) && s.length === 6 ? n : 0x5865f2;
}

function parseChannelIdFromMention(s) {
    const m = /^<#(\d+)>$/.exec(String(s).trim());
    return m ? m[1] : null;
}

function parseRoleIdFromMention(s) {
    const m = /^<@&(\d+)>$/.exec(String(s).trim());
    return m ? m[1] : null;
}

async function handleMessage(message) {
    if (message.author.bot || !message.guild) return;

    const cfg = await getOrCreateGuildConfig(message.guild.id);
    const p = cfg.prefix || '+';
    if (!message.content.startsWith(p)) return;

    const raw = message.content.slice(p.length).trim();
    if (!raw) return;

    const args = raw.split(/\s+/);
    const cmd = args.shift().toLowerCase();
    const guild = message.guild;
    const member = message.member;

    try {
        if (cmd === 'help') {
            const e = new EmbedBuilder()
                .setTitle('Kaizokuni - panneau de configuration')
                .setColor(0x00d4aa)
                .setDescription(
                    `Prefixe actuel : \`${p}\`\n**Setup rapide (telephone)**\n1) \`${p}setwelcomechannel #salon\`\n2) \`${p}setwelcomerole @role\` (ou \`off\`)\n3) \`${p}config welcometext Bienvenue {user} sur {server}\`\n4) \`${p}config view\``
                )
                .addFields(
                    {
                        name: 'Variables bienvenue',
                        value: '`{user}` `{mention}` `{username}` `{displayname}` `{server}` `{count}`',
                    },
                    {
                        name: 'Bienvenue (admin)',
                        value: `\`${p}setwelcomechannel #salon\` (alias: \`${p}setwelcomechaannel\`) · \`${p}setwelcomerole @role\` · \`${p}setwelcomerole off\``,
                    },
                    {
                        name: 'Config (admin)',
                        value: `\`${p}config view\` · \`${p}config prefix <x>\` · \`${p}config modlog #salon\` · \`${p}config welcome #salon\` · \`${p}config welcometext <texte>\` · \`${p}config welcomerole @role|off\` · \`${p}config wallpaper #salon\` · \`${p}config wallpaperdelay <1-60>\` · \`${p}config wallpaperlimit <1-40>\``,
                    },
                    {
                        name: 'Moderation',
                        value: `\`${p}ban @user [raison]\` · \`${p}kick @user [raison]\` · \`${p}timeout @user <minutes> [raison]\` · \`${p}untimeout @user\` · \`${p}clear <1-100>\` · \`${p}warn @user [raison]\` · \`${p}warnings @user\` · \`${p}clearwarns @user\``,
                    },
                    {
                        name: 'Contenu',
                        value: `\`${p}embed titre | description | couleur | footer\` · \`${p}poll Question | A | B [| C] [| D]\` · \`${p}say texte\``,
                    },
                    {
                        name: 'Wallpapers',
                        value: `\`${p}wallpaper <url>\` · \`${p}wallpaper stop\` (conseille: definir \`${p}config wallpaper #salon\`)`,
                    }
                )
                .setFooter({ text: 'Astuce: /help et /config sont plus simples sur mobile.' });
            return message.reply({ embeds: [e], allowedMentions: { repliedUser: false } });
        }

        if (cmd === 'ping') {
            const t = Date.now();
            const m = await message.reply({ content: 'Ping…', allowedMentions: { repliedUser: false } });
            return m.edit(`Pong ! **${Date.now() - t}** ms · WS **${message.client.ws.ping}** ms`);
        }

        if (cmd === 'serverinfo') {
            const e = new EmbedBuilder()
                .setTitle(guild.name)
                .setThumbnail(guild.iconURL({ size: 256 }))
                .addFields(
                    { name: 'Membres', value: String(guild.memberCount), inline: true },
                    { name: 'ID', value: guild.id, inline: true }
                )
                .setColor(0x5865f2);
            return message.reply({ embeds: [e], allowedMentions: { repliedUser: false } });
        }

        if (cmd === 'mirror') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('Réservé aux administrateurs.');
            }
            // Usage:
            // +mirror <lien_salon_source|#salon|id> <#salon_cible|id> [limit]
            const sourceArg = args[0];
            const targetArg = args[1];
            const limit = parseInt(args[2] || '50', 10);
            if (!sourceArg || !targetArg) {
                return message.reply(`Usage : \`${p}mirror <lien/#source> <#cible> [1-100]\``);
            }

            const targetId =
                parseChannelIdLoose(targetArg) || message.mentions.channels.at(0)?.id;
            const targetCh = targetId ? guild.channels.cache.get(targetId) : null;
            if (!targetCh?.isTextBased()) {
                return message.reply('Salon cible invalide.');
            }

            // Résout la source via lien discord.com/channels/... ou mention/id
            let sourceCh = null;
            const srcId = parseChannelIdLoose(sourceArg);
            if (srcId) {
                sourceCh = guild.channels.cache.get(srcId) || (await message.client.channels.fetch(srcId).catch(() => null));
            } else {
                sourceCh = await resolveSourceChannelFromLink(message.client, sourceArg);
            }

            if (!sourceCh?.isTextBased()) {
                return message.reply('Salon source invalide (ou bot sans accès).');
            }

            await message.reply(
                `Mirror en cours : ${sourceCh} → ${targetCh} (limit ${Math.min(100, Math.max(1, limit || 50))}).`
            );

            mirrorChannel({
                client: message.client,
                sourceChannel: sourceCh,
                targetChannel: targetCh,
                limit: Math.min(100, Math.max(1, limit || 50)),
                includeAttachments: true,
                statusChannel: message.channel,
            }).catch((e) => console.error('mirror', e));
            return;
        }

        if (cmd === 'importjson') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('Réservé aux administrateurs.');
            }
            // Usage: +importjson <#cible|id> [limit]
            // Fichier .json à joindre au message
            const targetArg = args[0];
            const limit = parseInt(args[1] || '200', 10);
            const file = message.attachments.first();

            if (!targetArg) {
                return message.reply(`Usage : \`${p}importjson <#cible> [1-500]\` + joindre le fichier .json`);
            }
            if (!file) {
                return message.reply('Ajoute un fichier `.json` en pièce jointe du message de commande.');
            }
            if (!String(file.name || '').toLowerCase().endsWith('.json')) {
                return message.reply('Le fichier joint doit être un `.json`.');
            }

            const targetId =
                parseChannelIdLoose(targetArg) || message.mentions.channels.first()?.id;
            const targetCh = targetId ? guild.channels.cache.get(targetId) : null;
            if (!targetCh?.isTextBased()) {
                return message.reply('Salon cible invalide.');
            }

            await message.reply(
                `Import JSON en cours vers ${targetCh} (max ${Math.min(500, Math.max(1, limit || 200))}).`
            );

            importFromJsonAttachment({
                attachmentUrl: file.url,
                targetChannel: targetCh,
                statusChannel: message.channel,
                limit: Math.min(500, Math.max(1, limit || 200)),
                includeAttachments: true,
            }).catch((e) => {
                console.error('importjson', e);
                message.channel.send(`❌ Import JSON échoué: ${e.message || 'erreur inconnue'}`).catch(() => {});
            });
            return;
        }

        if (cmd === 'config') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("Réservé aux administrateurs.");
            }
            const sub = (args.shift() || '').toLowerCase();
            const argline = raw.slice(raw.toLowerCase().indexOf(sub) + sub.length).trim();

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
                        { name: 'Texte bienvenue', value: (cfg.welcomeMessage || '—').slice(0, 900) },
                        {
                            name: 'Rôle bienvenue',
                            value: cfg.welcomeRoleId ? `<@&${cfg.welcomeRoleId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Wallpapers',
                            value: cfg.wallpaperChannelId ? `<#${cfg.wallpaperChannelId}>` : '—',
                            inline: true,
                        },
                        {
                            name: 'Délai / max',
                            value: `${(cfg.wallpaperDelayMs || 2500) / 1000}s · ${cfg.wallpaperMaxBatch ?? 15}`,
                            inline: true,
                        }
                    );
                return message.reply({ embeds: [e], allowedMentions: { repliedUser: false } });
            }

            if (sub === 'prefix') {
                const v = (args[0] || '').slice(0, 5);
                if (!v) return message.reply('Usage : `prefix <caractères>`');
                cfg.prefix = v;
                await cfg.save();
                return message.reply(`Préfixe : \`${cfg.prefix}\``);
            }

            if (sub === 'modlog' || sub === 'welcome' || sub === 'wallpaper') {
                const id =
                    parseChannelIdFromMention(args[0]) ||
                    message.mentions.channels.first()?.id ||
                    args[0];
                const ch = guild.channels.cache.get(id);
                if (!ch?.isTextBased()) return message.reply('Mentionne un salon texte valide.');
                if (sub === 'modlog') cfg.modLogChannelId = ch.id;
                if (sub === 'welcome') cfg.welcomeChannelId = ch.id;
                if (sub === 'wallpaper') cfg.wallpaperChannelId = ch.id;
                await cfg.save();
                return message.reply(`OK → ${ch}`);
            }

            if (sub === 'welcometext') {
                if (!argline) return message.reply('Usage : `welcometext <message>`');
                cfg.welcomeMessage = argline.slice(0, 1800);
                await cfg.save();
                return message.reply('Message de bienvenue enregistré.');
            }

            if (sub === 'wallpaperdelay') {
                const s = parseInt(args[0], 10);
                if (!Number.isFinite(s) || s < 1 || s > 60) {
                    return message.reply('Usage : `wallpaperdelay <1-60>` (secondes)');
                }
                cfg.wallpaperDelayMs = s * 1000;
                await cfg.save();
                return message.reply(`Délai : **${s}** s`);
            }

            if (sub === 'wallpaperlimit') {
                const n = parseInt(args[0], 10);
                if (!Number.isFinite(n) || n < 1 || n > 40) {
                    return message.reply('Usage : `wallpaperlimit <1-40>`');
                }
                cfg.wallpaperMaxBatch = n;
                await cfg.save();
                return message.reply(`Max **${n}** par commande.`);
            }

            if (sub === 'welcomerole') {
                const tok = (args[0] || '').toLowerCase();
                if (!args[0] || tok === 'off' || tok === 'aucun' || tok === 'reset') {
                    cfg.welcomeRoleId = null;
                    await cfg.save();
                    return message.reply('Rôle auto de bienvenue **désactivé**.');
                }
                const rid =
                    parseRoleIdFromMention(args[0]) || message.mentions.roles.first()?.id;
                const role = rid ? guild.roles.cache.get(rid) : null;
                if (!role) return message.reply('Mentionne un rôle ou `off`.');
                if (role.managed) {
                    return message.reply('Ce rôle est géré par une intégration — choisis un autre rôle.');
                }
                cfg.welcomeRoleId = role.id;
                await cfg.save();
                return message.reply(
                    `Rôle auto : ${role}\nPlace le **rôle du bot** au-dessus dans la liste des rôles + permission **Gérer les rôles**.`
                );
            }

            if (sub === 'muterole') {
                const rid =
                    parseRoleIdFromMention(args[0]) || message.mentions.roles.first()?.id;
                const role = rid ? guild.roles.cache.get(rid) : null;
                if (!role) return message.reply('Mentionne un rôle.');
                cfg.muteRoleId = role.id;
                await cfg.save();
                return message.reply(`Rôle mute : ${role}`);
            }

            return message.reply(
                'Sous-commande inconnue. Voir `' + p + 'help`.'
            );
        }

        if (cmd === 'setwelcomechannel' || cmd === 'setwelcomechaannel') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("Réservé aux administrateurs.");
            }
            const id =
                parseChannelIdFromMention(args[0]) ||
                message.mentions.channels.first()?.id ||
                args[0];
            const ch = guild.channels.cache.get(id);
            if (!ch?.isTextBased()) {
                return message.reply(`Usage : \`${p}setwelcomechannel #salon\``);
            }
            cfg.welcomeChannelId = ch.id;
            await cfg.save();
            return message.reply(`Salon de bienvenue → ${ch}\nLe message sera un **embed** + ping. Texte : \`${p}config welcometext ...\``);
        }

        if (cmd === 'setwelcomerole') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("Réservé aux administrateurs.");
            }
            const tok = (args[0] || '').toLowerCase();
            if (!args[0] || tok === 'off' || tok === 'aucun' || tok === 'reset') {
                cfg.welcomeRoleId = null;
                await cfg.save();
                return message.reply('Rôle auto de bienvenue **désactivé**.');
            }
            const rid =
                parseRoleIdFromMention(args[0]) || message.mentions.roles.first()?.id;
            const role = rid ? guild.roles.cache.get(rid) : null;
            if (!role) return message.reply(`Usage : \`${p}setwelcomerole @role\` ou \`${p}setwelcomerole off\``);
            if (role.managed) {
                return message.reply('Rôle d’intégration — choisis un rôle classique.');
            }
            cfg.welcomeRoleId = role.id;
            await cfg.save();
            return message.reply(
                `Nouveaux membres recevront : ${role}\n_Vérifie la **hiérarchie des rôles** et la permission **Gérer les rôles**._`
            );
        }

        if (cmd === 'ban') {
            if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `ban @user [raison]`');
            const reason = args.slice(1).join(' ') || 'Aucune raison';
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return message.reply('Membre introuvable.');
            await m.ban({ reason: `${message.author.tag}: ${reason}` });
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Ban',
                    moderator: message.author,
                    target,
                    color: 0xed4245,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return message.reply(`${target.tag} banni.`);
        }

        if (cmd === 'kick') {
            if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `kick @user [raison]`');
            const reason = args.slice(1).join(' ') || 'Aucune raison';
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return message.reply('Membre introuvable.');
            await m.kick(`${message.author.tag}: ${reason}`);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Kick',
                    moderator: message.author,
                    target,
                    color: 0xf0b232,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return message.reply(`${target.tag} expulsé.`);
        }

        if (cmd === 'timeout') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            const restAfterMention = args.filter((a) => !a.includes(target?.id || ''));
            const minutes = parseInt(restAfterMention[0], 10);
            const reason = restAfterMention.slice(1).join(' ') || 'Aucune raison';
            if (!target || !Number.isFinite(minutes)) {
                return message.reply('Usage : `timeout @user <minutes> [raison]`');
            }
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return message.reply('Membre introuvable.');
            await m.timeout(minutes * 60 * 1000, `${message.author.tag}: ${reason}`);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Timeout',
                    moderator: message.author,
                    target,
                    color: 0xfee75c,
                }).addFields(
                    { name: 'Durée', value: `${minutes} min`, inline: true },
                    { name: 'Raison', value: reason.slice(0, 1000) }
                )
            );
            return message.reply(`Timeout → ${target.tag}`);
        }

        if (cmd === 'untimeout') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `untimeout @user`');
            const m = await guild.members.fetch(target.id).catch(() => null);
            if (!m) return message.reply('Membre introuvable.');
            await m.timeout(null);
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Timeout retiré',
                    moderator: message.author,
                    target,
                    color: 0x57f287,
                })
            );
            return message.reply(`Timeout retiré pour ${target.tag}`);
        }

        if (cmd === 'clear') {
            if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('Permission manquante.');
            }
            const n = parseInt(args[0], 10);
            if (!Number.isFinite(n) || n < 1 || n > 100) {
                return message.reply('Usage : `clear <1-100>`');
            }
            const ch = message.channel;
            if (!ch.isTextBased() || ch.isDMBased()) return;
            const deleted = await ch.bulkDelete(n, true).catch(() => null);
            const count = deleted?.size ?? 0;
            await sendModLog(
                guild,
                cfg,
                new EmbedBuilder()
                    .setTitle('Clear')
                    .setColor(0x5865f2)
                    .setDescription(`${message.author} a supprimé **${count}** message(s) dans ${ch}.`)
                    .setTimestamp()
            );
            const reply = await message.reply(`**${count}** message(s) supprimés.`);
            setTimeout(() => reply.delete().catch(() => {}), 4000);
            return;
        }

        if (cmd === 'warn') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `warn @user [raison]`');
            const reason = args.filter((a) => !a.includes(target.id)).join(' ') || 'Aucune raison';
            await Warn.create({
                guildId: guild.id,
                userId: target.id,
                moderatorId: message.author.id,
                reason,
            });
            await sendModLog(
                guild,
                cfg,
                baseModEmbed({
                    title: 'Warn',
                    moderator: message.author,
                    target,
                    color: 0xfee75c,
                }).addFields({ name: 'Raison', value: reason.slice(0, 1000) })
            );
            return message.reply(`${target.tag} averti.`);
        }

        if (cmd === 'warnings') {
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `warnings @user`');
            const list = await Warn.find({ guildId: guild.id, userId: target.id })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean();
            if (!list.length) return message.reply('Aucun warn.');
            const lines = list.map(
                (w, i) =>
                    `**${i + 1}.** ${w.reason} — <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`
            );
            const e = new EmbedBuilder()
                .setTitle(`Warns — ${target.tag}`)
                .setDescription(lines.join('\n').slice(0, 3900))
                .setColor(0x5865f2);
            return message.reply({ embeds: [e], allowedMentions: { repliedUser: false } });
        }

        if (cmd === 'clearwarns') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return message.reply('Permission manquante.');
            }
            const target = message.mentions.users.first();
            if (!target) return message.reply('Usage : `clearwarns @user`');
            const r = await Warn.deleteMany({ guildId: guild.id, userId: target.id });
            return message.reply(`**${r.deletedCount}** warn(s) supprimés.`);
        }

        if (cmd === 'embed') {
            if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('Permission manquante.');
            }
            const parts = raw.slice('embed'.length).trim().split('|').map((s) => s.trim());
            const [title, description, color, footer] = parts;
            if (!title || !description) {
                return message.reply('Usage : `embed titre | description | couleur(hex) | footer`');
            }
            const e = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(parseHexColor(color));
            if (footer) e.setFooter({ text: footer.slice(0, 2048) });
            return message.channel.send({ embeds: [e] });
        }

        if (cmd === 'poll') {
            const line = raw.slice('poll'.length).trim();
            const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
            if (parts.length < 3) {
                return message.reply('Usage : `poll question | choix A | choix B [| C] [| D]`');
            }
            const [q, a, b, c, d] = parts;
            const e = new EmbedBuilder()
                .setTitle('📊 Sondage')
                .setDescription(`**${q}**\n\n🇦 ${a}\n🇧 ${b}${c ? `\n🇨 ${c}` : ''}${d ? `\n🇩 ${d}` : ''}`)
                .setColor(0x5865f2)
                .setFooter({ text: `Par ${message.author.tag}` });
            const msg = await message.channel.send({ embeds: [e] });
            await msg.react('🇦');
            await msg.react('🇧');
            if (c) await msg.react('🇨');
            if (d) await msg.react('🇩');
            return;
        }

        if (cmd === 'say') {
            if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('Permission manquante.');
            }
            const text = raw.slice('say'.length).trim();
            if (!text) return message.reply('Usage : `say <texte>`');
            return message.channel.send({ content: text });
        }

        if (cmd === 'wallpaper') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply('Réservé aux administrateurs.');
            }
            const rest = raw.slice('wallpaper'.length).trim();
            if (!rest || rest.toLowerCase() === 'stop') {
                wallQueue.requestCancel(guild.id);
                return message.reply('Annulation demandée (si une file tourne).');
            }
            const url = rest.split(/\s+/)[0];
            const targetCh = cfg.wallpaperChannelId
                ? guild.channels.cache.get(cfg.wallpaperChannelId)
                : message.channel;
            if (!targetCh?.isTextBased()) {
                return message.reply('Définis un salon avec `config wallpaper` ou utilise un salon texte.');
            }
            await message.reply({
                content: 'File wallpaper démarrée (voir le salon cible + messages d’état ici).',
                allowedMentions: { repliedUser: false },
            });
            runWallpaperJob({
                guildId: guild.id,
                statusChannel: message.channel,
                targetChannel: targetCh,
                url,
            }).catch((e) => console.error('wallpaperJob', e));
            return;
        }
    } catch (err) {
        console.error(err);
        return message.reply('Erreur pendant la commande.').catch(() => {});
    }
}

module.exports = { handleMessage };
