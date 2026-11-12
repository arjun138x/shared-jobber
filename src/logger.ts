import apm from 'elastic-apm-node';
import winston, { Logger } from 'winston';
import { ElasticsearchTransport, LogData } from 'winston-elasticsearch';

type TransformedData = {
  '@timestamp': string;
  message: unknown;
  severity: string;
  fields: Record<string, unknown>;
  transaction?: { id: unknown };
  trace?: { id: unknown };
  span?: { id: unknown };
};

const esTransformer = (logData: LogData): TransformedData => {
  const meta = logData.meta ?? {};

  const transformed: TransformedData = {
    '@timestamp': logData.timestamp ?? new Date().toISOString(),
    message: logData.message,
    severity: logData.level,
    fields: meta,
  };

  if (meta['transaction.id']) {
    transformed.transaction = { id: meta['transaction.id'] };
  }
  if (meta['trace.id']) {
    transformed.trace = { id: meta['trace.id'] };
  }
  if (meta['span.id']) {
    transformed.span = { id: meta['span.id'] };
  }

  return transformed;
};

export const winstonLogger = (
  elasticsearchNode: string,
  name: string,
  level: string
): Logger => {
  const options = {
    console: {
      level,
      handleExceptions: true,
      json: false,
      colorize: true,
    },
    elasticsearch: {
      apm,
      level,
      transformer: esTransformer,
      clientOpts: {
        node: elasticsearchNode,
        log: level,
        maxRetries: 2,
        requestTimeout: 10000,
        sniffOnStart: false,
      },
    },
  };
  const esTransport: ElasticsearchTransport = new ElasticsearchTransport(
    options.elasticsearch
  );

  esTransport.on('warning', (error) =>
    console.error('Elasticsearch warning:', error)
  );
  esTransport.on('error', (error) =>
    console.error('Elasticsearch transport error:', error)
  );

  const logger: Logger = winston.createLogger({
    exitOnError: false,
    defaultMeta: { service: name },
    transports: [new winston.transports.Console(options.console), esTransport],
  });
  return logger;
};
