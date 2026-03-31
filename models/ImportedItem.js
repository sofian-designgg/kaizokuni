const { Schema, model } = require('mongoose');

const importedItemSchema = new Schema(
    {
        guildId: { type: String, required: true, index: true },
        targetChannelId: { type: String, required: true, index: true },
        itemKey: { type: String, required: true },
    },
    { timestamps: true }
);

importedItemSchema.index(
    { guildId: 1, targetChannelId: 1, itemKey: 1 },
    { unique: true, name: 'unique_imported_item_per_channel' }
);

module.exports = model('ImportedItem', importedItemSchema);

