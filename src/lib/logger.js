const bunyan    = require('bunyan'),
      bunyantcp = require('bunyan-logstash-tcp');

const logstashHost = process.env.LOGSTASH_HOST || "localhost",
      logstashPort = process.env.LOGSTASH_PORT || 5000,
      logstashRetryInterval = process.env.LOGSTASH_RETRY_INTERVAL || 100, // 100ms is the default
      logstashMaxConnectRetriesString = process.env.LOGSTASH_MAX_CONNECT_RETRIES || 'Infinity',
      logstashMaxConnectRetries = logstashMaxConnectRetriesString === 'Infinity' ? Infinity : parseInt(logstashMaxConnectRetriesString);

if (isNaN(logstashMaxConnectRetries)) {
    throw new Error('LOGSTASH_MAX_CONNECT_RETRIES should be a number or Infinity');
}

const logger = bunyan.createLogger({
    name: 'bridge',
    streams: [
        {
            level: 'debug',
            stream: process.stdout
        }
    ]
});

if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production') {
    let initialConnection = true,
        debugStream = bunyantcp.createStream({
            host: logstashHost,
            port: logstashPort,
            retry_interval: logstashRetryInterval,
            max_connect_retries: logstashMaxConnectRetries,
        });

    function onConnect() {
        initialConnection = false;
        logger.emit('connect');
    }

    function onTimeout() {
        console.warn('Logstash timeout');
        if (initialConnection) {
            logger.emit('timeout');
        }
    }

    function onError(err) {
        console.error(err);
        if (initialConnection) {
            logger.emit('error', err);
        }
    }

    debugStream.on('connect', onConnect);
    debugStream.on('timeout', onTimeout);
    debugStream.on('error', onError);

    logger.addStream({
        type: 'raw',
        level: 'debug',
        stream: debugStream,
    });
}

module.exports = logger;
