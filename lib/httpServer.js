const http = require('http');

function startHealthServer() {
    const port = Number(process.env.PORT) || 3000;
    const server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('kaizokuni ok');
    });
    server.listen(port, () => {
        console.log(`Healthcheck HTTP sur le port ${port}`);
    });
    return server;
}

module.exports = { startHealthServer };
