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
            .setName('mirror')
            .setDescription('Copier les derniers messages d’un salon vers un autre (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addChannelOption((o) =>
                o
                    .setName('source')
                    .setDescription('Salon source')
                    .setRequired(true)
            )
            .addChannelOption((o) =>
                o
                    .setName('cible')
                    .setDescription('Salon cible')
                    .setRequired(true)
            )
            .addIntegerOption((o) =>
                o
                    .setName('limit')
                    .setDescription('Nombre de messages (1-100)')
                    .setMinValue(1)
                    .setMaxValue(100)
            )
            .addBooleanOption((o) =>
                o
                    .setName('pieces_jointes')
                    .setDescription('Re-uploader les pièces jointes (défaut: oui)')
            ),

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
            .setName('setautorole')
            .setDescription('VIP preuve : PJ dans un salon → rôle temporaire (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la configuration VIP preuve'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer le système'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver le système'))
            .addSubcommand((s) =>
                s
                    .setName('salon')
                    .setDescription('Salon où les membres envoient leurs preuves')
                    .addChannelOption((o) =>
                        o.setName('channel').setDescription('Salon texte').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('role')
                    .setDescription('Rôle donné quand la preuve est valide')
                    .addRoleOption((o) => o.setName('role').setDescription('Rôle VIP').setRequired(true))
            )
            .addSubcommand((s) =>
                s
                    .setName('message')
                    .setDescription('Texte de l’embed de réponse (description)')
                    .addStringOption((o) =>
                        o
                            .setName('texte')
                            .setDescription(
                                'Variables: {mention} {user} {username} {server} {role} {expires} {nb_fichiers} + <t:{expires}:F>'
                            )
                            .setRequired(true)
                            .setMaxLength(2000)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('titre')
                    .setDescription('Titre de l’embed de réponse')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('Titre').setRequired(true).setMaxLength(256)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('couleur')
                    .setDescription('Couleur de l’embed (hex sans #)')
                    .addStringOption((o) =>
                        o.setName('hex').setDescription('ex: f1c40f').setRequired(true).setMaxLength(6)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('duree')
                    .setDescription('Durée du rôle en jours')
                    .addIntegerOption((o) =>
                        o
                            .setName('jours')
                            .setDescription('1 à 90')
                            .setMinValue(1)
                            .setMaxValue(90)
                            .setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('min')
                    .setDescription('Nombre minimum de pièces jointes')
                    .addIntegerOption((o) =>
                        o
                            .setName('nombre')
                            .setDescription('1 à 20')
                            .setMinValue(1)
                            .setMaxValue(20)
                            .setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('max')
                    .setDescription('Nombre maximum de pièces jointes')
                    .addIntegerOption((o) =>
                        o
                            .setName('nombre')
                            .setDescription('1 à 20')
                            .setMinValue(1)
                            .setMaxValue(20)
                            .setRequired(true)
                    )
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
            .setName('importjson')
            .setDescription('Importer un fichier JSON et republier les messages (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addAttachmentOption((o) =>
                o
                    .setName('fichier')
                    .setDescription('Fichier .json')
                    .setRequired(true)
            )
            .addChannelOption((o) =>
                o
                    .setName('cible')
                    .setDescription('Salon cible')
                    .setRequired(true)
            )
            .addIntegerOption((o) =>
                o
                    .setName('delai_ms')
                    .setDescription('Délai entre envois (minimum 60000ms, défaut 60000)')
                    .setMinValue(60000)
                    .setMaxValue(600000)
            )
            .addIntegerOption((o) =>
                o
                    .setName('max')
                    .setDescription('Max messages à importer (1 à 1000, défaut 200)')
                    .setMinValue(1)
                    .setMaxValue(1000)
            ),

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
