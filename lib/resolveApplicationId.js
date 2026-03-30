/**
 * ID d’application = même snowflake que l’utilisateur « bot ».
 * Discord encode ce snowflake en base64 dans la 1re partie du TOKEN (avant le premier '.').
 */
function resolveApplicationId(token, explicitEnv) {
    const fromEnv = String(explicitEnv || '').trim();
    if (/^\d{17,20}$/.test(fromEnv)) return fromEnv;

    if (!token || typeof token !== 'string') return null;
    const idPart = token.split('.')[0];
    if (!idPart) return null;

    try {
        let b64 = idPart.replace(/-/g, '+').replace(/_/g, '/');
        const pad = b64.length % 4;
        if (pad) b64 += '='.repeat(4 - pad);
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        if (/^\d{17,20}$/.test(decoded)) return decoded;
    } catch {
        /* ignore */
    }
    return null;
}

module.exports = { resolveApplicationId };
