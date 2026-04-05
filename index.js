require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Partials,
    REST,
    Routes,
    PermissionFlagsBits,
} = require('discord.js');
const { connectMongo, getOrCreateGuildConfig } = require('./lib/db');
const { resolveApplicationId } = require('./lib/resolveApplicationId');
const { startHealthServer } = require('./lib/httpServer');
const { buildSlashCommands } = require('./lib/slashCommands');
const { handleSlash } = require('./handlers/slash');
const { handlePaypalButton } = require('./handlers/paypalButton');
const { handleMessage } = require('./handlers/message');
const { buildWelcomeEmbed } = require('./lib/welcomeEmbed');
const { buildJoinDmEmbed } = require('./lib/joinDmEmbed');
const { handleVipProofMessage, startVipSweep } = require('./lib/vipProof');
const { handleAutmsg } = require('./lib/autmsg');

startHealthServer();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Channel],
});

client.once('clientReady', async () => {
    console.log(`Kaizokuni connecté : ${client.user.tag}`);

    try {
        await connectMongo();
        console.log('MongoDB connecté (MONGO_URL).');
    } catch (e) {
        console.error('Échec MongoDB :', e.message);
        process.exit(1);
    }

    startVipSweep(client);

    const token = process.env.TOKEN;
    const clientId = resolveApplicationId(token, process.env.DISCORD_CLIENT_ID);
    if (!clientId) {
        console.warn(
            'Impossible d’enregistrer les slash : TOKEN invalide ou ajoute DISCORD_CLIENT_ID dans les variables Railway.'
        );
        return;
    }
    if (!process.env.DISCORD_CLIENT_ID) {
        console.log(`Slash : ID application déduit du TOKEN (${clientId}).`);
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const body = buildSlashCommands();
    try {
        if (process.env.GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), {
                body,
            });
            console.log(`Slash enregistrés (serveur ${process.env.GUILD_ID}).`);
        } else {
            await rest.put(Routes.applicationCommands(clientId), { body });
            console.log('Slash enregistrés (globaux — propagation jusqu’à 1 h).');
        }
    } catch (e) {
        console.error('Erreur enregistrement slash :', e);
    }
});

client.on('interactionCreate', (interaction) => {
    if (interaction.isChatInputCommand()) return handleSlash(interaction);
    if (interaction.isButton()) return handlePaypalButton(interaction);
});

client.on('messageCreate', async (m) => {
    await handleVipProofMessage(m);
    await handleAutmsg(m);
    await handleMessage(m);
});

client.on('guildMemberAdd', async (member) => {
    try {
        const cfg = await getOrCreateGuildConfig(member.guild.id);

        if (cfg.welcomeRoleId) {
            const role = member.guild.roles.cache.get(cfg.welcomeRoleId);
            const me = member.guild.members.me;
            if (
                role &&
                me?.permissions.has(PermissionFlagsBits.ManageRoles) &&
                me.roles.highest.position > role.position
            ) {
                await member.roles.add(role, 'Kaizokuni — rôle de bienvenue').catch(() => {});
            }
        }

        if (cfg.joinDmEnabled) {
            try {
                const dmEmbed = buildJoinDmEmbed(member, cfg);
                await member.send({ embeds: [dmEmbed] });
            } catch {
                /* MP fermés ou utilisateur introuvable */
            }
        }

        if (!cfg.welcomeChannelId) return;
        const ch = member.guild.channels.cache.get(cfg.welcomeChannelId);
        if (!ch?.isTextBased()) return;
        const embed = buildWelcomeEmbed(member, cfg);
        await ch.send({
            content: `${member}`,
            embeds: [embed],
            allowedMentions: { users: [member.id] },
        });
    } catch (e) {
        console.error('guildMemberAdd', e);
    }
});

const token = process.env.TOKEN;
if (!token) {
    console.error('TOKEN manquant dans l’environnement.');
    process.exit(1);
}

client.login(token);
