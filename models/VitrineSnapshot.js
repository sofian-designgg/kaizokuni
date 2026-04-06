const { Schema, model } = require('mongoose');

// Schema.Types utilisé pour `channels` (compat ancien / nouveau format)

const vitrineSnapshotSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        vitrineActive: { type: Boolean, default: false },
        publicChannelId: { type: String, default: null },
        snapshotAt: { type: Date, default: null },
        /** Rôles (en plus de @everyone) concernés par vitrine / snapshot */
        targetRoleIds: { type: [String], default: [] },
        /** Objet par salon : { channelId, everyone, roles[] } ou ancien format plat */
        channels: { type: [Schema.Types.Mixed], default: [] },
    },
    { timestamps: true }
);

module.exports = model('VitrineSnapshot', vitrineSnapshotSchema);
