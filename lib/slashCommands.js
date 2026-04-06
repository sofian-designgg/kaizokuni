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
            .setName('messagemp')
            .setDescription('MP automatique à l’arrivée (embed : VIP pas obligatoire, etc.)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la config du MP d’arrivée'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer l’envoi du MP aux nouveaux'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver le MP d’arrivée'))
            .addSubcommand((s) =>
                s
                    .setName('titre')
                    .setDescription('Titre de l’embed (ou « - » pour aucun titre)')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('Variables: {user} {mention} {server} …').setRequired(true).setMaxLength(256)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('description')
                    .setDescription('Corps du MP (ou « - » pour le texte par défaut du bot)')
                    .addStringOption((o) =>
                        o
                            .setName('texte')
                            .setDescription('Variables: {user} {mention} {username} {displayname} {server} {count}')
                            .setRequired(true)
                            .setMaxLength(4000)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('couleur')
                    .setDescription('Couleur de l’embed (hex sans #)')
                    .addStringOption((o) =>
                        o.setName('hex').setDescription('ex: 3498db').setRequired(true).setMaxLength(6)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('pied')
                    .setDescription('Pied de page (ou « - » pour seulement le nom du serveur)')
                    .addStringOption((o) =>
                        o
                            .setName('texte')
                            .setDescription('Variables bienvenue · max ~2000 car.')
                            .setRequired(true)
                            .setMaxLength(2048)
                    )
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
                    .setDescription('Texte du message de réponse sous la preuve (pas d’embed)')
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
                    .setName('couleur')
                    .setDescription('Réserve (non utilisée : la réponse VIP est un message texte)')
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
            .setName('paypal')
            .setDescription('Afficher la fiche de paiement PayPal (VIP)'),

        new SlashCommandBuilder()
            .setName('setpaypal')
            .setDescription('Configurer la fiche PayPal + bouton preuve (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la config PayPal'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver'))
            .addSubcommand((s) =>
                s
                    .setName('email')
                    .setDescription('Email PayPal qui reçoit les paiements')
                    .addStringOption((o) =>
                        o.setName('adresse').setDescription('email@exemple.com').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('prix')
                    .setDescription('Montant affiché (texte libre)')
                    .addStringOption((o) =>
                        o.setName('montant').setDescription('ex: 9,99 € ou 10 USD').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('salon_preuve')
                    .setDescription('Salon où envoyer la capture après le bouton')
                    .addChannelOption((o) =>
                        o.setName('channel').setDescription('Salon').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('apres_paiement')
                    .setDescription('Message privé après clic bouton (variables ci-dessous)')
                    .addStringOption((o) =>
                        o
                            .setName('texte')
                            .setDescription('{mention} {proof_channel}')
                            .setRequired(true)
                            .setMaxLength(2000)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('titre')
                    .setDescription('Titre de la fiche embed')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('Titre').setRequired(true).setMaxLength(256)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('notes')
                    .setDescription('Texte additionnel sur la fiche (consignes, délais…)')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('Notes').setRequired(true).setMaxLength(1500)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('bouton')
                    .setDescription('Libellé du bouton vert')
                    .addStringOption((o) =>
                        o.setName('texte').setDescription('max 80 car.').setRequired(true).setMaxLength(80)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('lien')
                    .setDescription('Lien PayPal.me ou lien de paiement')
                    .addStringOption((o) =>
                        o.setName('url').setDescription('https://...').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('couleur')
                    .setDescription('Couleur de l’embed (hex sans #)')
                    .addStringOption((o) =>
                        o.setName('hex').setDescription('ex: 003087').setRequired(true).setMaxLength(6)
                    )
            ),

        new SlashCommandBuilder()
            .setName('setpaypalemail')
            .setDescription('Raccourci : définir l’email PayPal (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption((o) =>
                o.setName('email').setDescription('email@exemple.com').setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('setpaypalprix')
            .setDescription('Raccourci : définir le prix affiché (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption((o) =>
                o.setName('montant').setDescription('ex: 9,99 €').setRequired(true)
            ),

        new SlashCommandBuilder()
            .setName('autmsg')
            .setDescription('Mots déclencheurs → message auto (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la config autmsg'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver'))
            .addSubcommand((s) =>
                s
                    .setName('message')
                    .setDescription('Texte envoyé quand un mot est détecté')
                    .addStringOption((o) =>
                        o
                            .setName('texte')
                            .setDescription('{mention} {user} {username} {channel}')
                            .setRequired(true)
                            .setMaxLength(2000)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('ajouter')
                    .setDescription('Ajouter un mot déclencheur')
                    .addStringOption((o) =>
                        o.setName('mot').setDescription('ex: canette, leyna').setRequired(true).setMaxLength(40)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('retirer')
                    .setDescription('Retirer un mot')
                    .addStringOption((o) =>
                        o.setName('mot').setDescription('mot exact').setRequired(true).setMaxLength(40)
                    )
            )
            .addSubcommand((s) => s.setName('liste').setDescription('Lister les mots'))
            .addSubcommand((s) =>
                s
                    .setName('vider')
                    .setDescription('Supprimer tous les mots déclencheurs')
            )
            .addSubcommand((s) =>
                s
                    .setName('cooldown')
                    .setDescription('Délai minimum entre 2 réponses (par membre)')
                    .addIntegerOption((o) =>
                        o
                            .setName('secondes')
                            .setDescription('5 à 600')
                            .setMinValue(5)
                            .setMaxValue(600)
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
            .setDescription('Créer et envoyer un embed (salon optionnel)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addSubcommand((s) =>
                s
                    .setName('envoyer')
                    .setDescription('Embed complet : texte, couleur, images, champs')
                    .addStringOption((o) => o.setName('description').setDescription('Texte principal').setRequired(true).setMaxLength(4000))
                    .addStringOption((o) => o.setName('titre').setDescription('Titre (optionnel)').setMaxLength(256))
                    .addStringOption((o) => o.setName('couleur').setDescription('Hex sans # (défaut: 5865f2)').setMaxLength(6))
                    .addStringOption((o) => o.setName('pied').setDescription('Footer').setMaxLength(2048))
                    .addStringOption((o) => o.setName('image').setDescription('URL image grande').setMaxLength(500))
                    .addStringOption((o) => o.setName('miniature').setDescription('URL miniature').setMaxLength(500))
                    .addChannelOption((o) => o.setName('salon').setDescription('Salon cible (défaut: ici)'))
                    .addStringOption((o) => o.setName('champ1_nom').setDescription('Nom du 1er champ').setMaxLength(256))
                    .addStringOption((o) => o.setName('champ1_texte').setDescription('Valeur du 1er champ').setMaxLength(1024))
                    .addStringOption((o) => o.setName('champ2_nom').setDescription('Nom du 2e champ').setMaxLength(256))
                    .addStringOption((o) => o.setName('champ2_texte').setDescription('Valeur du 2e champ').setMaxLength(1024))
            ),

        new SlashCommandBuilder()
            .setName('setticket')
            .setDescription('Configurer le système de tickets (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la configuration tickets'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer les tickets'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver les tickets'))
            .addSubcommand((s) =>
                s
                    .setName('categorie')
                    .setDescription('Catégorie où créer les salons ticket')
                    .addChannelOption((o) =>
                        o.setName('dossier').setDescription('Glisser la catégorie Discord ici').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('staff')
                    .setDescription('Rôle staff (voir + fermer les tickets)')
                    .addRoleOption((o) => o.setName('role').setDescription('Rôle').setRequired(true))
            )
            .addSubcommand((s) =>
                s
                    .setName('salon_logs')
                    .setDescription('Salon des logs à la fermeture')
                    .addChannelOption((o) => o.setName('salon').setDescription('Salon texte').setRequired(true))
            )
            .addSubcommand((s) =>
                s
                    .setName('max')
                    .setDescription('Tickets ouverts max par membre (1-5)')
                    .addIntegerOption((o) =>
                        o.setName('nombre').setDescription('1 à 5').setMinValue(1).setMaxValue(5).setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('bouton')
                    .setDescription('Texte du bouton sur le panneau')
                    .addStringOption((o) => o.setName('texte').setDescription('Libellé').setRequired(true).setMaxLength(80))
            )
            .addSubcommand((s) =>
                s
                    .setName('panel_titre')
                    .setDescription('Titre de l’embed du panneau')
                    .addStringOption((o) => o.setName('texte').setDescription('Titre').setRequired(true).setMaxLength(256))
            )
            .addSubcommand((s) =>
                s
                    .setName('panel_desc')
                    .setDescription('Description de l’embed du panneau')
                    .addStringOption((o) => o.setName('texte').setDescription('Texte').setRequired(true).setMaxLength(4000))
            )
            .addSubcommand((s) =>
                s
                    .setName('panel_couleur')
                    .setDescription('Couleur embed panneau (hex)')
                    .addStringOption((o) => o.setName('hex').setDescription('ex: 5865f2').setRequired(true).setMaxLength(6))
            )
            .addSubcommand((s) =>
                s
                    .setName('panel_pied')
                    .setDescription('Footer panneau (« - » pour vide)')
                    .addStringOption((o) => o.setName('texte').setDescription('Texte').setRequired(true).setMaxLength(2048))
            )
            .addSubcommand((s) =>
                s
                    .setName('accueil_titre')
                    .setDescription('Titre dans le salon ticket (variables: {mention} {staff_role} …)')
                    .addStringOption((o) => o.setName('texte').setDescription('Titre').setRequired(true).setMaxLength(256))
            )
            .addSubcommand((s) =>
                s
                    .setName('accueil_desc')
                    .setDescription('Texte d’accueil dans le ticket')
                    .addStringOption((o) => o.setName('texte').setDescription('Description').setRequired(true).setMaxLength(4000))
            )
            .addSubcommand((s) =>
                s
                    .setName('accueil_couleur')
                    .setDescription('Couleur embed d’accueil (hex)')
                    .addStringOption((o) => o.setName('hex').setDescription('ex: 57f287').setRequired(true).setMaxLength(6))
            ),

        new SlashCommandBuilder()
            .setName('ticketpanel')
            .setDescription('Publier le panneau « ouvrir un ticket » dans ce salon (admin)'),

        new SlashCommandBuilder()
            .setName('modeserveur')
            .setDescription('Mode vitrine : masquer les salons sans les supprimer (vente)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('statut').setDescription('État vitrine, rôles cibles, sauvegarde'))
            .addSubcommand((s) =>
                s
                    .setName('role_ajouter')
                    .setDescription('Ajouter un rôle (avec @everyone) pour vitrine + instantané')
                    .addRoleOption((o) => o.setName('role').setDescription('Rôle membre / invité').setRequired(true))
            )
            .addSubcommand((s) =>
                s
                    .setName('role_retirer')
                    .setDescription('Retirer un rôle de la liste cible')
                    .addRoleOption((o) => o.setName('role').setDescription('Rôle').setRequired(true))
            )
            .addSubcommand((s) =>
                s.setName('roles_reset').setDescription('Vider la liste (seul @everyone reste ciblé)')
            )
            .addSubcommand((s) =>
                s
                    .setName('sauvegarder')
                    .setDescription('Sauver perms @everyone + rôles cibles (avant activer)')
            )
            .addSubcommand((s) =>
                s
                    .setName('salon_public')
                    .setDescription('Salon visible pour @everyone et les rôles cibles en vitrine')
                    .addChannelOption((o) =>
                        o.setName('salon').setDescription('Texte ou annonces').setRequired(true)
                    )
            )
            .addSubcommand((s) =>
                s
                    .setName('activer')
                    .setDescription('Masquer les autres salons pour @everyone + rôles cibles')
            )
            .addSubcommand((s) =>
                s
                    .setName('restaurer')
                    .setDescription('Restaurer l’instantané et quitter la vitrine')
            )
            .addSubcommand((s) =>
                s.setName('desactiver').setDescription('Identique à restaurer')
            )
            .addSubcommand((s) =>
                s
                    .setName('tout_debloquer')
                    .setDescription(
                        'Urgence : remettre « Voir le salon » en héritage (@everyone + rôles cibles)'
                    )
            ),

        new SlashCommandBuilder()
            .setName('profil')
            .setDescription('Profil personnalisable sur ce serveur (rôle VIP)')
            .addSubcommand((s) =>
                s
                    .setName('voir')
                    .setDescription('Afficher un profil')
                    .addUserOption((o) => o.setName('membre').setDescription('Membre (toi par défaut)'))
            )
            .addSubcommand((s) =>
                s
                    .setName('bio')
                    .setDescription('Définir ta bio (max 500)')
                    .addStringOption((o) => o.setName('texte').setDescription('Ta bio').setRequired(true).setMaxLength(500))
            )
            .addSubcommand((s) =>
                s
                    .setName('couleur')
                    .setDescription('Couleur de ton embed profil')
                    .addStringOption((o) => o.setName('hex').setDescription('Hex sans #').setRequired(true).setMaxLength(6))
            )
            .addSubcommand((s) => s.setName('effacer').setDescription('Réinitialiser ton profil sur ce serveur')),

        new SlashCommandBuilder()
            .setName('pseudo')
            .setDescription('Changer ton pseudo sur ce serveur (rôle VIP)')
            .addStringOption((o) =>
                o.setName('nom').setDescription('Nouveau pseudo (max 32)').setRequired(true).setMaxLength(32)
            ),

        new SlashCommandBuilder()
            .setName('setprofil')
            .setDescription('Activer le profil / pseudo VIP et choisir le rôle (admin)')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addSubcommand((s) => s.setName('view').setDescription('Voir la config profil VIP'))
            .addSubcommand((s) => s.setName('on').setDescription('Activer'))
            .addSubcommand((s) => s.setName('off').setDescription('Désactiver'))
            .addSubcommand((s) =>
                s
                    .setName('role')
                    .setDescription('Rôle « acheteur / VIP » pour /profil et /pseudo')
                    .addRoleOption((o) => o.setName('role').setDescription('Rôle').setRequired(true))
            ),

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
