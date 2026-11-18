export function sendLocalMessage(id: string | null, message: string, timeoutInSeconds?: number) {
  const element = ElementCreate({
    tag: 'div',
    classList: ['ChatMessage', 'deeplib-message', 'ChatMessageNonDialogue'],
    attributes: {
      id: id ?? `DEEPLIB_LOCAL_MESSAGE_${Date.now()}`,
      'data-time': ChatRoomCurrentTime(),
      'data-sender': Player.MemberNumber?.toString(),
    },
    children: [
      {
        tag: 'span',
        classList: ['deeplib-text'],
        innerHTML: message.replaceAll('\n\t', ''),
      },
      {
        tag: 'br',
      },
      {
        tag: 'a',
        classList: ['deeplib-text'],
        attributes: {
          href: '#',
        },
        innerHTML: '<b>Close (Click)</b>',
        eventListeners: {
          click: () => {
            element.remove();
          },
        },
      }
    ]
  });

  ChatRoomAppendChat(element);
  if (!timeoutInSeconds) return;
  setTimeout(() => element.remove(), timeoutInSeconds * 1000);
}

export function sendActionMessage(msg: string, target: undefined | number = undefined, dictionary: ChatMessageDictionaryEntry[] = []) {
  if (!msg) return;
  ServerSend('ChatRoomChat' as const, {
    Content: 'DEEPLIB_CUSTOM_ACTION',
    Type: 'Action',
    Target: target ?? undefined,
    Dictionary: [
      { Tag: 'MISSING TEXT IN "Interface.csv": DEEPLIB_CUSTOM_ACTION', Text: msg },
      ...dictionary,
    ],
  });
}
