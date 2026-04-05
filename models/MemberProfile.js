const { Schema, model } = require('mongoose');

const memberProfileSchema = new Schema(
    {
        guildId: { type: String, required: true },
        userId: { type: String, required: true },
        bio: { type: String, default: '' },
        /** Couleur de l’embed profil (null = défaut bot) */
        profileColor: { type: Number, default: null },
    },
    { timestamps: true }
);

memberProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('MemberProfile', memberProfileSchema);
