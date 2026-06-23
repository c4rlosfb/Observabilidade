/**
 * Logger Estruturado em JSON
 * Escreve logs em formato JSON para stdout (coletados pelo Docker/Promtail).
 * 
 * Campos:
 *   timestamp      — ISO 8601
 *   level          — info | warn | error
 *   message        — descrição legível
 *   correlation_id — UUID único por requisição
 *   service        — "node-app"
 *   method         — GET/POST/PUT/DELETE (opcional)
 *   route          — caminho da rota (opcional)
 *   status_code    — código HTTP (opcional)
 *   duration_ms    — tempo de resposta (opcional)
 *   user_id        — ID do usuário (opcional)
 *   error_stack    — stack trace (apenas nível error)
 *   module         — nome do módulo (catalog, checkout, etc.)
 */

const crypto = require('crypto');

function createLogger(moduleName = 'app') {
    function write(level, message, extra = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: 'node-app',
            module: moduleName,
            ...extra
        };

        // Inclui error_stack apenas para nível error
        if (level === 'error' && extra.error instanceof Error) {
            entry.error_stack = extra.error.stack;
        }

        // Remove campos undefined/null para JSON limpo
        Object.keys(entry).forEach(k => {
            if (entry[k] === undefined || entry[k] === null) {
                delete entry[k];
            }
        });

        // Escreve uma linha JSON por log (NDJSON — fácil de parsear no Loki)
        process.stdout.write(JSON.stringify(entry) + '\n');
    }

    return {
        info(message, extra)  { write('info', message, extra); },
        warn(message, extra)  { write('warn', message, extra); },
        error(message, extra) { write('error', message, extra); }
    };
}

/**
 * Middleware Express que:
 *  - Gera correlation_id via crypto.randomUUID()
 *  - Injeta no req.correlationId e no header X-Correlation-ID da resposta
 *  - Loga entrada e saída da requisição com duração
 */
function requestLoggerMiddleware(logger) {
    return (req, res, next) => {
        // Gera correlation ID único
        const correlationId = crypto.randomUUID();
        req.correlationId = correlationId;
        res.setHeader('X-Correlation-ID', correlationId);

        const startTime = Date.now();

        // Log de entrada
        logger.info(`→ ${req.method} ${req.path}`, {
            correlation_id: correlationId,
            method: req.method,
            route: req.path
        });

        // Log de saída (quando a resposta for enviada)
        res.on('finish', () => {
            const durationMs = Date.now() - startTime;
            const userId = req.userId || req.headers['x-user-id'] || null;

            const extra = {
                correlation_id: correlationId,
                method: req.method,
                route: req.path,
                status_code: res.statusCode,
                duration_ms: durationMs
            };

            if (userId) {
                extra.user_id = parseInt(userId, 10);
            }

            if (res.statusCode >= 500) {
                logger.error(`✗ ${req.method} ${req.path} ${res.statusCode} (${durationMs}ms)`, extra);
            } else if (res.statusCode >= 400) {
                logger.warn(`← ${req.method} ${req.path} ${res.statusCode} (${durationMs}ms)`, extra);
            } else {
                logger.info(`← ${req.method} ${req.path} ${res.statusCode} (${durationMs}ms)`, extra);
            }
        });

        next();
    };
}

module.exports = { createLogger, requestLoggerMiddleware };
