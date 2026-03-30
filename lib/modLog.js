const { EmbedBuilder } = require('discord.js');

async function sendModLog(guild, cfg, embed) {
    if (!cfg?.modLogChannelId) return;
    const ch = guild.channels.cache.get(cfg.modLogChannelId);
    if (!ch?.isTextBased()) return;
    await ch.send({ embeds: [embed] });
}

function baseModEmbed({ title, moderator, target, color }) {
    return new EmbedBuilder()
        .setTitle(title)
        .setColor(color ?? 0x5865f2)
        .addFields(
            { name: 'Modérateur', value: `${moderator} (${moderator.id})`, inline: true },
            { name: 'Cible', value: `${target}`, inline: true }
        )
        .setTimestamp(new Date());
}

module.exports = { sendModLog, baseModEmbed };
