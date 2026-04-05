const { Schema, model } = require('mongoose');

const ticketSchema = new Schema(
    {
        guildId: { type: String, required: true },
        channelId: { type: String, required: true, index: true },
        openerId: { type: String, required: true },
        status: { type: String, enum: ['open', 'closed'], default: 'open' },
    },
    { timestamps: true }
);

ticketSchema.index({ guildId: 1, openerId: 1, status: 1 });

module.exports = model('Ticket', ticketSchema);
