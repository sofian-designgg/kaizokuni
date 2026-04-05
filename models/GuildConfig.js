const { Schema, model } = require('mongoose');

const guildConfigSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        prefix: { type: String, default: '+' },
        modLogChannelId: { type: String, default: null },
        welcomeChannelId: { type: String, default: null },
        welcomeMessage: {
            type: String,
            default:
                'Bienvenue {user} sur **{server}** ! Nous sommes maintenant **{count}** membres — amuse-toi bien.',
        },
        /** Rôle attribué automatiquement à l’arrivée (bot doit être au-dessus + permission Rôles) */
        welcomeRoleId: { type: String, default: null },
        wallpaperChannelId: { type: String, default: null },
        wallpaperDelayMs: { type: Number, default: 2500 },
        wallpaperMaxBatch: { type: Number, default: 15 },
        wallpaperMaxFileMB: { type: Number, default: 8 },
        muteRoleId: { type: String, default: null },

        /** VIP preuve : message avec N pièces jointes dans un salon → rôle temporaire */
        vipProofEnabled: { type: Boolean, default: false },
        vipProofChannelId: { type: String, default: null },
        vipProofRoleId: { type: String, default: null },
        vipProofEmbedTitle: {
            type: String,
            default: 'VIP validé',
        },
        vipProofEmbedDescription: {
            type: String,
            default:
                'Bravo {mention} ! Ta preuve est acceptée.\nTu as le rôle {role} jusqu’au **<t:{expires}:F>** (<t:{expires}:R>).\n**{nb_fichiers}** fichier(s) reçu(s).',
        },
        vipProofEmbedColor: { type: Number, default: 0xf1c40f },
        vipProofDurationDays: { type: Number, default: 7 },
        vipProofMinAttachments: { type: Number, default: 3 },
        vipProofMaxAttachments: { type: Number, default: 10 },
    },
    { timestamps: true }
);

module.exports = model('GuildConfig', guildConfigSchema);
