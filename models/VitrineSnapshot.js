const { Schema, model } = require('mongoose');

/** Instantané des overwrites @everyone par salon — mode vitrine / vente */
const channelEntrySchema = new Schema(
    {
        channelId: { type: String, required: true },
        hasOverwrite: { type: Boolean, required: true },
        allow: { type: String, default: '0' },
        deny: { type: String, default: '0' },
    },
    { _id: false }
);

const vitrineSnapshotSchema = new Schema(
    {
        guildId: { type: String, required: true, unique: true },
        vitrineActive: { type: Boolean, default: false },
        publicChannelId: { type: String, default: null },
        snapshotAt: { type: Date, default: null },
        channels: { type: [channelEntrySchema], default: [] },
    },
    { timestamps: true }
);

module.exports = model('VitrineSnapshot', vitrineSnapshotSchema);
