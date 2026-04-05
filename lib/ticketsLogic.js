const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const Ticket = require('../models/Ticket');

const BTN_OPEN = 'kz_ticket_open';
const BTN_CLOSE = 'kz_ticket_close';

function applyTicketTemplate(str, ctx) {
    return String(str || '')
        .replaceAll('{user}', ctx.userStr)
        .replaceAll('{mention}', ctx.mention)
        .replaceAll('{username}', ctx.username)
        .replaceAll('{displayname}', ctx.displayName)
        .replaceAll('{server}', ctx.serverName)
        .replaceAll('{staff_role}', ctx.staffRoleMention);
}

function sanitizeChannelSlug(name) {
    return String(name || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'ticket';
}

function buildTicketPanelEmbed(cfg, guild) {
    const color = Number(cfg.ticketPanelColor);
    const e = new EmbedBuilder()
        .setColor(Number.isFinite(color) ? color : 0x5865f2)
        .setTitle((cfg.ticketPanelTitle || 'Tickets').slice(0, 256))
        .setDescription((cfg.ticketPanelDescription || '—').slice(0, 4096));
    const foot = (cfg.ticketPanelFooter || '').trim();
    if (foot) {
        e.setFooter({ text: foot.slice(0, 2048), iconURL: guild.iconURL({ size: 64 }) || undefined });
    }
    return e;
}

function ticketPanelRow(cfg) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(BTN_OPEN)
            .setLabel((cfg.ticketPanelButtonLabel || 'Ouvrir un ticket').slice(0, 80))
            .setStyle(ButtonStyle.Primary)
    );
}

function ticketCloseRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(BTN_CLOSE).setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger)
    );
}

async function countOpenTicketsForUser(guildId, userId) {
    return Ticket.countDocuments({ guildId, openerId: userId, status: 'open' });
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').GuildMember} opener
 * @param {import('mongoose').Document} cfg
 */
async function createTicketChannel(guild, opener, cfg) {
    const category = cfg.ticketCategoryId ? guild.channels.cache.get(cfg.ticketCategoryId) : null;
    if (!category || category.type !== ChannelType.GuildCategory) {
        return { error: 'Catégorie tickets invalide ou manquante. Admin : `/setticket categorie`.' };
    }

    const staffMention = cfg.ticketStaffRoleId ? `<@&${cfg.ticketStaffRoleId}>` : '@Staff';

    const ctx = {
        userStr: `${opener}`,
        mention: `<@${opener.id}>`,
        username: opener.user.username,
        displayName: opener.displayName,
        serverName: guild.name,
        staffRoleMention: staffMention,
    };

    const base = sanitizeChannelSlug(opener.user.username);
    let name = `ticket-${base}`;
    let n = 1;
    while (guild.channels.cache.find((c) => c.name === name && c.parentId === category.id)) {
        n += 1;
        name = `ticket-${base}-${n}`.slice(0, 100);
    }

    const me = guild.members.me;
    const overwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: opener.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
        {
            id: me.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        },
    ];

    if (cfg.ticketStaffRoleId) {
        overwrites.push({
            id: cfg.ticketStaffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
            ],
        });
    }

    const channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: `Ticket ${opener.user.tag} · ${opener.id}`,
        permissionOverwrites: overwrites,
        reason: `Kaizokuni — ticket ouvert par ${opener.user.tag}`,
    });

    await Ticket.create({
        guildId: guild.id,
        channelId: channel.id,
        openerId: opener.id,
        status: 'open',
    });

    const title = applyTicketTemplate(cfg.ticketOpenTitle || '🎫 Ticket', ctx).slice(0, 256);
    const desc = applyTicketTemplate(cfg.ticketOpenDescription || '{mention}', ctx).slice(0, 4096);
    const c = Number(cfg.ticketOpenColor);
    const welcome = new EmbedBuilder()
        .setColor(Number.isFinite(c) ? c : 0x57f287)
        .setTitle(title)
        .setDescription(desc);

    await channel.send({
        content: staffMention ? `${staffMention} — nouveau ticket de ${opener}.` : undefined,
        embeds: [welcome],
        components: [ticketCloseRow()],
        allowedMentions: {
            roles: cfg.ticketStaffRoleId ? [cfg.ticketStaffRoleId] : [],
            users: [opener.id],
        },
    });

    return { channel };
}

function memberCanCloseTicket(member, cfg, ticketDoc) {
    if (ticketDoc?.openerId === member.id) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
    if (cfg.ticketStaffRoleId && member.roles.cache.has(cfg.ticketStaffRoleId)) return true;
    return false;
}

module.exports = {
    BTN_OPEN,
    BTN_CLOSE,
    buildTicketPanelEmbed,
    ticketPanelRow,
    ticketCloseRow,
    applyTicketTemplate,
    countOpenTicketsForUser,
    createTicketChannel,
    memberCanCloseTicket,
};
