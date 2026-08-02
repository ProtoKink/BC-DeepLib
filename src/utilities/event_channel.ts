import { sdk } from '../deeplib';

type DeepLibMessageDictionaryEntry<Type extends string, Data> = {
  type: Type;
  data: Data;
};

type Listener<Payload> = (data: Payload, sender: Character) => void;

export interface UnverifiedMessage extends ServerChatRoomMessageBase {
  Target?: number;
  Content: ServerChatRoomMessageContentType;
  Type: ServerChatRoomMessageType;
  Dictionary?: {
    type: string;
    data?: any;
  }[];
  Timeout?: number;
}

export interface EventChannelMessage<
  TEvents extends Record<string, unknown> = Record<string, unknown>,
  TEvent extends keyof TEvents & string = keyof TEvents & string
> extends ServerChatRoomMessageBase {
  Target?: number;
  Content: string;
  Type: 'Hidden';
  Dictionary: [
    DeepLibMessageDictionaryEntry<TEvent, TEvents[TEvent]>
  ];
  Timeout?: number;
  Sender: number;
}

export class EventChannel<TEvents extends Record<string, unknown>, TChannelName extends string> {
  private listeners: { [K in keyof TEvents]?: Listener<TEvents[K]>[]; } = {};
  private removeHook: () => void;

  constructor(private channelName: TChannelName) {
    this.removeHook = sdk.hookFunction('ChatRoomMessageProcessHidden', 0, (args, next) => {
      if (!this.isChannelMessage(args[0] as UnverifiedMessage)) {
        return next(args);
      }

      const [message, sender] = args as unknown as [EventChannelMessage<TEvents>, Character];

      const { type, data } = message.Dictionary[0];
      const listeners = this.listeners[type as keyof TEvents];
      if (listeners) {
        (listeners as Listener<unknown>[])
          .forEach(listener => listener(data, sender));
      }

      return next(args);
    }, `EventChannel-${channelName}`);
  }

  public unload() {
    (Object.keys(this.listeners) as (keyof TEvents)[])
      .forEach(key => delete this.listeners[key]);
    this.removeHook();
  }

  public sendEvent<K extends keyof TEvents & string>(type: K, data: TEvents[K], target: number | null = null) {
    const packet = {
      Type: 'Hidden',
      Content: this.channelName,
      Sender: Player.MemberNumber,
      ...(target ? { Target: target } : {}),
      Dictionary: [
        {
          type,
          data
        } as DeepLibMessageDictionaryEntry<K, TEvents[K]>
      ]
    };

    ServerSend('ChatRoomChat', packet);
  }

  public registerListener<K extends keyof TEvents & string>(event: K, listener: Listener<TEvents[K]>): () => void {
    const listeners = this.listeners[event] ?? [];
    listeners.push(listener);
    this.listeners[event] = listeners;

    return () => this.unregisterListener(event, listener);
  }

  public unregisterListener<K extends keyof TEvents & string>(event: K, listener: Listener<TEvents[K]>) {
    const listeners = this.listeners[event];
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private isChannelMessage(message: UnverifiedMessage): message is EventChannelMessage<TEvents> {
    return (
      message &&
      message.Type === 'Hidden' &&
      message.Content === this.channelName &&
      message.Sender &&
      message.Sender !== Player.MemberNumber &&
      message.Dictionary &&
      !!message.Dictionary[0]?.data &&
      !!message.Dictionary[0]?.type
    ) || false;
  }
}
