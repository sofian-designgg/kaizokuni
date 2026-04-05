const { Schema, model } = require('mongoose');

const vipGrantSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        roleId: { type: String, required: true },
        expiresAt: { type: Date, required: true, index: true },
    },
    { timestamps: true }
);

vipGrantSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model('VipGrant', vipGrantSchema);
