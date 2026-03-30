const { Schema, model } = require('mongoose');

const warnSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        moderatorId: { type: String, required: true },
        reason: { type: String, default: 'Aucune raison' },
    },
    { timestamps: true }
);

module.exports = model('Warn', warnSchema);
