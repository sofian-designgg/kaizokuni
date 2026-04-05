const { getOrCreateGuildConfig } = require('./db');

const MAX_WORDS = 50;
const MAX_WORD_LEN = 40;

/** @type {Map<string, number>} clé guildId:userId → timestamp ms */
const cooldownUntil = new Map();

function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeWord(w) {
    return String(w || '')
        .trim()
        .toLowerCase()
        .slice(0, MAX_WORD_LEN);
}

function messageMatchesWord(content, word) {
    const w = normalizeWord(word);
    if (!w) return false;
    try {
        const re = new RegExp(`\\b${escapeRegex(w)}\\b`, 'i');
        return re.test(content);
    } catch {
        return content.toLowerCase().includes(w);
    }
}

function applyAutmsgTemplate(str, message) {
    const ch = message.channel;
    return String(str || '')
        .replaceAll('{user}', `${message.author}`)
        .replaceAll('{mention}', `<@${message.author.id}>`)
        .replaceAll('{username}', message.author.username)
        .replaceAll('{channel}', ch.isTextBased() ? `${ch}` : '');
}

/**
 * @param {import('discord.js').Message} message
 */
async function handleAutmsg(message) {
    if (message.author.bot || !message.guild || !message.content) return;

    const cfg = await getOrCreateGuildConfig(message.guild.id);
    if (!cfg.autmsgEnabled) return;

    const words = Array.isArray(cfg.autmsgWords) ? cfg.autmsgWords : [];
    if (!words.length || !cfg.autmsgResponse?.trim()) return;

    const hit = words.find((w) => messageMatchesWord(message.content, w));
    if (!hit) return;

    const cdSec = Math.min(600, Math.max(5, Number(cfg.autmsgCooldownSec) || 45));
    const cdKey = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const until = cooldownUntil.get(cdKey) || 0;
    if (now < until) return;
    cooldownUntil.set(cdKey, now + cdSec * 1000);

    const text = applyAutmsgTemplate(cfg.autmsgResponse, message).slice(0, 2000);
    if (!text.trim()) return;

    await message.reply({
        content: text,
        allowedMentions: { users: [message.author.id], roles: [], repliedUser: true },
    }).catch(() => {});
}

module.exports = { handleAutmsg, normalizeWord, MAX_WORDS, MAX_WORD_LEN };
