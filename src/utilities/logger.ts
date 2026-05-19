import Logger, { ILogLevel } from 'js-logger';

function colorizeLog(logLevel: ILogLevel): string {
  const name = logLevel.name;
  const colors: Record<typeof name, string> = {
    INFO: 'color: #32CCCC',
    TRACE: 'color: #CCCC32',
    WARN: 'color: #eec355',
    ERROR: 'color: #750b0b',
    DEBUG: 'color: #9E4BCF',
    TIME: 'color: #CCCC32',
  };

  return colors[name];
}

export const deepLibLogger = Logger.get('DeepLib');

Logger.useDefaults({
  defaultLevel: Logger.DEBUG,
  formatter: function(messages, context) {
    const name = context.name || 'DeepLib';
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('chrome') || userAgent.includes('firefox')) {
      const color = colorizeLog(context.level);
      messages.unshift(`%c${name}:`, color);
    } else {
      messages.unshift(`${name}:`);
    }
  }
});