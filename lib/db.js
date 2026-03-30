const mongoose = require('mongoose');
const GuildConfig = require('../models/GuildConfig');

async function connectMongo() {
    const url = process.env.MONGO_URL;
    if (!url) throw new Error('MONGO_URL manquant');
    await mongoose.connect(url);
}

async function getOrCreateGuildConfig(guildId) {
    let doc = await GuildConfig.findOne({ guildId });
    if (!doc) doc = await GuildConfig.create({ guildId });
    return doc;
}

module.exports = { connectMongo, getOrCreateGuildConfig };
