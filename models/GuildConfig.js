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
    },
    { timestamps: true }
);

module.exports = model('GuildConfig', guildConfigSchema);
