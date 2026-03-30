const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');

function buildSlashCommands() {
    return [
        new SlashCommandBuilder().setName('help').setDescription('Liste des commandes Kaizokuni'),

        new SlashCommandBuilder()
            .setName('ping')
            .setDescription('Latence du bot'),

        new SlashCommandBuilder()
            .setName('serverinfo')
            .setDescription('Infos sur ce serveur'),

        new SlashCommandBuilder()
            .setName('setwelcomechannel')
            .setDescription('Salon du message de bienvenue (embed)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption((o) =>
                o.setName('salon').setDescription('Salon texte').setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('setwelcomerole')
            .setDescription('Rôle donné automatiquement aux nouveaux membres')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addRoleOption((o) =>
                o
                    .setName('role')
                    .setDescription('Rôle à attribuer — ne rien choisir pour désactiver')
                    .setRequired(false)
            ),

        new SlashCommandBuilder()
            .setName('config')
            .setDescription('Configurer le bot depuis Discord (mobile)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir toute la configuration'))
            .addSubcommand((s) =>
                s
                    .setName('prefix')
                    .setDescription('Préfixe des commandes texte')
                    .addStringOption((o) =>
                        o.setName('valeur').setDescription('Nouveau préfixe (1–5 car.)').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('modlog')
                    .setDescription('Salon des logs modération')
                    .addChannelOption((o) =>
                        o.setName('salon').setDescription('Salon').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('welcome')
                    .setDescription('Salon des messages de bienvenue')
                    .addChannelOption((o) =>
                        o.setName('salon').setDescription('Salon').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('welcometext')
                    .setDescription('Texte de bienvenue ({user} {server} {count})')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('Message').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('wallpaper')
                    .setDescription('Salon cible pour la file wallpapers')
                    .addChannelOption((o) =>
                        o.setName('salon').setDescription('Salon').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('wallpaperdelay')
                    .setDescription('Délai entre chaque envoi (secondes)')
                    .addIntegerOption((o) =>
                        o
                            .setName('secondes')
                            .setDescription('1 à 60')
                            .setMinValue(1)
                            .setMaxValue(60)
                            .setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('wallpaperlimit')
                    .setDescription('Nombre max de médias par commande')
                    .addIntegerOption((o) =>
                        o
                            .setName('max')
                            .setDescription('1 à 40')
                            .setMinValue(1)
                            .setMaxValue(40)
                            .setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('welcomerole')
                    .setDescription('Rôle auto à l’arrivée (comme /setwelcomerole)')
                    .addRoleOption((o) =>
                        o
                            .setName('role')
                            .setDescription('Rôle — omets pour désactiver')
                            .setRequired(false)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('muterole')
                    .setDescription('Rôle utilisé pour les mutes (si tu gères mute par rôle)')
                    .addRoleOption((o) =>
                        o.setName('role').setDescription('Rôle mute').setRequired(true)
                    )
            ),

        new SlashCommandBuilder()
            .setName('ban')
            .setDescription('Bannir un membre')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true))
            .addStringOption((o) => o.setName('raison').setDescription('Raison')),

        new SlashCommandBuilder()
            .setName('kick')
            .setDescription('Expulser un membre')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true))
            .addStringOption((o) => o.setName('raison').setDescription('Raison')),

        new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('Mettre un membre en sourdine Discord')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true))
            .addIntegerOption((o) =>
                o
                    .setName('minutes')
                    .setDescription('Durée en minutes (1–40320)')
                    .setMinValue(1)
                    .setMaxValue(40320)
                    .setRequired(true)
            )
            .addStringOption((o) => o.setName('raison').setDescription('Raison')),

        new SlashCommandBuilder()
            .setName('untimeout')
            .setDescription('Retirer le timeout')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true)),

        new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Supprimer des messages (≤14 jours)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addIntegerOption((o) =>
                o
                    .setName('nombre')
                    .setDescription('1 à 100')
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('Avertir un membre')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true))
            .addStringOption((o) => o.setName('raison').setDescription('Raison')),

        new SlashCommandBuilder()
            .setName('warnings')
            .setDescription('Lister les avertissements')
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true)),

        new SlashCommandBuilder()
            .setName('clearwarns')
            .setDescription('Supprimer tous les warns d’un membre')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption((o) => o.setName('membre').setDescription('Utilisateur').setRequired(true)),

        new SlashCommandBuilder()
            .setName('embed')
            .setDescription('Envoyer un embed')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addStringOption((o) => o.setName('titre').setDescription('Titre').setRequired(true))
            .addStringOption((o) => o.setName('description').setDescription('Texte').setRequired(true))
            .addStringOption((o) => o.setName('couleur').setDescription('Hex sans #, ex: ff5500'))
            .addStringOption((o) => o.setName('pied').setDescription('Texte du footer')),

        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('Sondage avec réactions')
            .addStringOption((o) => o.setName('question').setDescription('Question').setRequired(true))
            .addStringOption((o) => o.setName('a').setDescription('Choix A').setRequired(true))
            .addStringOption((o) => o.setName('b').setDescription('Choix B').setRequired(true))
            .addStringOption((o) => o.setName('c').setDescription('Choix C (optionnel)'))
            .addStringOption((o) => o.setName('d').setDescription('Choix D (optionnel)')),

        new SlashCommandBuilder()
            .setName('say')
            .setDescription('Le bot envoie un message')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addStringOption((o) => o.setName('texte').setDescription('Contenu').setRequired(true))
            .addChannelOption((o) => o.setName('salon').setDescription('Salon (défaut: ici)')),

        new SlashCommandBuilder()
            .setName('wallpaper')
            .setDescription('File d’envoi de wallpapers depuis une page ou URL directe')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) =>
                s
                    .setName('queue')
                    .setDescription('Analyser l’URL et envoyer les médias un par un')
                    .addStringOption((o) =>
                        o.setName('url').setDescription('Page web ou lien direct image/vidéo').setRequired(true)
                    )
            )
            .addSubcommand((s) => s.setName('stop').setDescription('Annuler la file en cours sur ce serveur')),
    ].map((c) => c.toJSON());
}

module.exports = { buildSlashCommands };
