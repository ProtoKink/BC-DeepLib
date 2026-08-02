import { BaseModule, getModule, HookPriority, modLogger, modStorage, sdk } from '../deeplib';

interface DebugSettings {
  showRawTranslations: boolean;
  showFileNames: boolean;
  showIncomingServerTransactions: boolean;
  incomingMessageFilterMode: 'include' | 'exclude';
  incomingMessageTypes: string;
  showOutcomingServerTransactions: boolean;
  outcomingMessageFilterMode: 'include' | 'exclude';
  outcomingMessageTypes: string;
  showRawActivityNames: boolean;
  showRawAssetNames: boolean;
};

export class DebugModule extends BaseModule {

  debugSettings: DebugSettings = {
    showRawTranslations: false,
    showFileNames: false,
    showIncomingServerTransactions: false,
    incomingMessageFilterMode: 'exclude',
    incomingMessageTypes: '',
    showOutcomingServerTransactions: false,
    outcomingMessageFilterMode: 'exclude',
    outcomingMessageTypes: '',
    showRawActivityNames: false,
    showRawAssetNames: false
  };

  load(): void {
    const options = modStorage.getLocalStorage('debugOptions') as DebugSettings | null;
    if (options) {
      this.debugSettings = Object.assign(this.debugSettings, options);
    }

    loadServerTransactions();

    sdk.hookFunction('TextGet', HookPriority.ModifyBehavior, (args, next) => {
      if (!this.debugSettings.showRawTranslations) return next(args);

      const [textTag] = args;
      const fileName = TextScreenCache?.fileName() ?? '[unknown]';

      return this.debugSettings.showFileNames ? `${fileName}::${textTag}` : textTag;
    });

    sdk.hookFunction('TextGetInScope', HookPriority.ModifyBehavior, (args, next) => {
      if (!this.debugSettings.showRawTranslations) return next(args);

      const [filePath, textTag] = args;

      let lastSlash = filePath.lastIndexOf('/');
      if (lastSlash === -1) {
        lastSlash = 0;
      } else {
        lastSlash = lastSlash + 1;
      }
      const fileName = filePath.substring(lastSlash);

      return this.debugSettings.showFileNames ? `${fileName}::${textTag}` : textTag;
    });

    sdk.hookFunction('InterfaceTextGet', HookPriority.ModifyBehavior, (args, next) => {
      if (!this.debugSettings.showRawTranslations) return next(args);

      const [textTag] = args;

      let lastSlash = InterfaceStringsPath.lastIndexOf('/');
      if (lastSlash === -1) {
        lastSlash = 0;
      } else {
        lastSlash = lastSlash + 1;
      }
      const fileName = InterfaceStringsPath.substring(lastSlash);

      return this.debugSettings.showFileNames ? `${fileName}::${textTag}` : textTag;
    });

    sdk.hookFunction('ActivityDictionaryText', HookPriority.ModifyBehavior, (args, next) => {
      if (!this.debugSettings.showRawActivityNames) return next(args);

      const [keyword] = args;

      return keyword;
    });

    sdk.hookFunction('ElementButton.CreateForAsset', HookPriority.ModifyBehavior, (args, next) => {
      if (!this.debugSettings.showRawAssetNames) return next(args);

      let [, asset, , , options] = args;
      const item = 'Asset' in asset ? asset : { Asset: asset };
      asset = item.Asset;

      options ??= {};
      options.label = asset.Name;
      args[4] = options;

      return next(args);
    });
  }

  unload(): void {
    unloadServerTransactions();
  }

  saveDebugSettings() {
    modStorage.setLocalStorage('debugOptions', this.debugSettings);
  }
}

let originalSocketReceiveFunc: undefined | ((...args: any[]) => any);
function processIncomingTransaction(this: any, ...args: any[]) {
  const message = Array.isArray(args[0]) && typeof args[0][0] === 'string' ? args[0][0] : '[unknown]';

  const parameters = Array.isArray(args[0]) ? args[0].slice(1) : [];
  const debugModule = getModule('DebugModule');
  
  if (debugModule.debugSettings.showIncomingServerTransactions) {
    const shouldLog = shouldLogMessage(
      message,
      debugModule.debugSettings.incomingMessageTypes,
      debugModule.debugSettings.incomingMessageFilterMode
    );
    
    if (shouldLog) {
      modLogger.debug('\u25BC Receive', message, ...parameters);
    }
  }

  const res = originalSocketReceiveFunc?.apply(this, args);
  return res;
}

let originalSocketSendFunc: undefined | ((...args: any[]) => any);
function processOutcomingTransaction(this: any, ...args: unknown[]) {
  const message = typeof args[0] === 'string' ? args[0] : '[unknown]';

  const parameters = Array.isArray(args[1]) ? args[1] : [args[1]];
  const debugModule = getModule('DebugModule');
  
  if (debugModule.debugSettings.showOutcomingServerTransactions) {
    const shouldLog = shouldLogMessage(
      message,
      debugModule.debugSettings.outcomingMessageTypes,
      debugModule.debugSettings.outcomingMessageFilterMode
    );
    
    if (shouldLog) {
      modLogger.debug('\u25B2 Send', message, ...parameters);
    }
  }
  return originalSocketSendFunc?.apply(this, args);
}

function shouldLogMessage(message: string, messageTypes: string, filterMode: 'include' | 'exclude'): boolean {
  if (!messageTypes.trim()) {
    return true;
  }

  const types = messageTypes.split(',').map(t => t.trim()).filter(t => t.length > 0);
  const matches = types.some(type => message === type);

  if (filterMode === 'include') {
    return matches;
  } else {
    return !matches;
  }
}

function loadServerTransactions() {
  if (originalSocketReceiveFunc === undefined && typeof (ServerSocket as any)?.__proto__?.emitEvent === 'function') {
    originalSocketReceiveFunc = (ServerSocket as any).__proto__.emitEvent;
    (ServerSocket as any).__proto__.emitEvent = processIncomingTransaction;
  }

  if (originalSocketSendFunc === undefined && typeof (ServerSocket as any)?.__proto__?.emit === 'function') {
    originalSocketSendFunc = (ServerSocket as any).__proto__.emit;
    (ServerSocket as any).__proto__.emit = processOutcomingTransaction;
  }
}

function unloadServerTransactions() {
  if (originalSocketReceiveFunc && (ServerSocket as any).__proto__.emitEvent === processIncomingTransaction) {
    (ServerSocket as any).__proto__.emitEvent = originalSocketReceiveFunc;
    originalSocketReceiveFunc = undefined;
  }

  if (originalSocketSendFunc && (ServerSocket as any).__proto__.emit === processOutcomingTransaction) {
    (ServerSocket as any).__proto__.emit = originalSocketSendFunc;
    originalSocketSendFunc = undefined;
  }
}