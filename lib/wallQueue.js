/** État global des files wallpaper par serveur */
const state = {
    /** @type {Set<string>} */
    running: new Set(),
    /** @type {Map<string, boolean>} */
    cancelRequested: new Map(),
};

function requestCancel(guildId) {
    state.cancelRequested.set(guildId, true);
}

function isCancelRequested(guildId) {
    return state.cancelRequested.get(guildId) === true;
}

function clearCancel(guildId) {
    state.cancelRequested.delete(guildId);
}

function startRun(guildId) {
    if (state.running.has(guildId)) return false;
    state.running.add(guildId);
    clearCancel(guildId);
    return true;
}

function endRun(guildId) {
    state.running.delete(guildId);
    clearCancel(guildId);
}

module.exports = {
    state,
    requestCancel,
    isCancelRequested,
    startRun,
    endRun,
};
