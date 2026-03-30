function parseDiscordChannelLink(input) {
    const s = String(input || '').trim();
    // Formats:
    // - https://discord.com/channels/<guildId>/<channelId>
    // - https://discord.com/channels/<guildId>/<channelId>/<messageId>
    const m = /^https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)(?:\/(\d+))?\/?$/.exec(
        s
    );
    if (!m) return null;
    return { guildId: m[1], channelId: m[2], messageId: m[3] || null };
}

function parseChannelIdLoose(input) {
    const s = String(input || '').trim();
    const mention = /^<#(\d+)>$/.exec(s);
    if (mention) return mention[1];
    if (/^\d{17,20}$/.test(s)) return s;
    const link = parseDiscordChannelLink(s);
    return link?.channelId || null;
}

module.exports = { parseDiscordChannelLink, parseChannelIdLoose };

