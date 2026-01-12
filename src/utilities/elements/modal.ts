import { getText } from '../translation';
import { advElement } from './elements';

export type ModalButton<T extends string = string> = {
  /** Button label text. */
  text: string
  /** Action identifier returned when the button is clicked. */
  action: T | (() => void)
  /** Whether the button is disabled. */
  disabled?: boolean
};

export type ModalInputOptions = {
  /** Default input value. */
  defaultValue?: string
  /** Makes the input read-only if true. */
  readOnly?: boolean
  /** Placeholder text. */
  placeholder?: string
  /** Input type. */
  type: 'input' | 'textarea'
  /** Validation callback to check if the input value is valid. */
  validate?: (value: string) => string | null
};

export type ModalOptions<T extends string = string> = {
  /** Content or DOM node displayed in the modal header. */
  prompt: ElementButton.StaticNode
  /** Optional input configuration. */
  input?: ModalInputOptions
  /** Buttons to display in the modal. */
  buttons?: ModalButton<T>[]
  /** Whether clicking backdrop closes the modal (default: true). */
  closeOnBackdrop?: boolean
  /** Auto-close timeout in milliseconds. */
  timeoutMs?: number
  /** Action sent when Escape key is pressed. */
  escapeAction?: T
  /** Action sent when Enter key is pressed. */
  enterAction?: T
  /** Modal ID. */
  modalId?: string
  /** Modal class list. */
  modalClassList?: string[]
  /** Callback function to be called when the modal is shown. */
  onShow?: (this: HTMLDialogElement) => void
};

export interface AlertOptions<T extends string = string> {
  /** Auto-close timeout in milliseconds. */
  timeoutMs?: number
  /** Modal ID. */
  modalId?: string
  /** Modal class list. */
  modalClassList?: string[]
  /** Additional buttons to display in the modal. */
  buttons?: ModalButton<T>[]
  /** Callback function to be called when the modal is shown. */
  onShow?: (this: HTMLDialogElement) => void
}

export interface ConfirmOptions<T extends string = string> {
  /** Modal ID. */
  modalId?: string
  /** Modal class list. */
  modalClassList?: string[]
  /** Additional buttons to display in the modal. */
  buttons?: ModalButton<T>[]
  /** Callback function to be called when the modal is shown. */
  onShow?: (this: HTMLDialogElement) => void
}

export interface PromptOptions<T extends string = string> {
  defaultValue?: string
  /** Modal ID. */
  modalId?: string
  /** Modal class list. */
  modalClassList?: string[]
  /** Additional buttons to display in the modal. */
  buttons?: ModalButton<T>[]
  /** Callback function to be called when the modal is shown. */
  onShow?: (this: HTMLDialogElement) => void
}

/**
 * Modal dialog implementation with queuing, buttons, optional input, and focus trapping.
 * Multiple modals are queued to ensure only one is visible at a time.
 */
export class Modal<T extends string = string> {
  private dialog: HTMLDialogElement;
  private blocker: HTMLDivElement;
  private inputEl?: HTMLInputElement | HTMLTextAreaElement;
  private timeoutId?: number;
  private updateIntervalId?: number;

  /** Static modal queue. */
  private static queue: Modal<any>[] = [];
  /** Flag to indicate if a modal is currently being shown. */
  private static processing = false;

  constructor(private opts: ModalOptions<T>) {
    opts ??= {} as ModalOptions<T>;
    opts.closeOnBackdrop ??= true;
    opts.modalClassList ??= [];

    const promptId = `modal-prompt-${Date.now()}`;

    const prompt = (CommonIsArray(opts.prompt) ? opts.prompt : [opts.prompt]).filter(i => i !== null) ?? [''];

    this.dialog = ElementCreate({
      tag: 'dialog',
      classList: ['deeplib-modal', ...opts.modalClassList],
      attributes: {
        id: this.opts.modalId ?? `modal-${Date.now()}`,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': promptId
      },
      children: [
        {
          tag: 'div',
          classList: ['deeplib-modal-prompt-container'],
          children: [
            ...prompt,
          ]
        },
        {
          tag: 'div',
          classList: ['deeplib-modal-prompt'],
          attributes: {
            id: promptId
          },
          children: [
            opts.input ? this.renderInput(opts.input) : undefined,
          ]
        },
        this.renderButtons()
      ]
    });
    ElementSetFontSize(this.dialog, 'auto');

    this.blocker = this.createBlocker();

    this.renderButtons();
    document.body.append(this.createBlocker(), this.dialog);
    this.setupFocusTrap();
    if (opts.timeoutMs) {
      this.timeoutId = window.setTimeout(() => this.close('timeout' as T), opts.timeoutMs);
    }
    if (opts.onShow) opts.onShow.call(this.dialog);
  
    this.updateIntervalId = window.setInterval(() => {
      ElementSetFontSize(this.dialog, 'auto');
    }, 1000);
  }

  /**
   * Displays the modal and resolves with the chosen action and input value.
   */
  show(): Promise<[T, string | null]> {
    return Modal.enqueue(this);
  }

  /**
   * Shows a simple alert modal with a single "OK" button.
   */
  static async alert(msg: ElementButton.StaticNode, opts: AlertOptions = {}) {
    await new Modal({
      prompt: msg,
      buttons: [...(opts.buttons ?? []), { action: 'close', text: getText('modal.button.ok') }],
      timeoutMs: opts.timeoutMs,
      escapeAction: 'close',
      modalId: opts.modalId,
      modalClassList: opts.modalClassList,
      onShow: opts.onShow
    }).show();
  }

  /**
   * Shows a confirmation modal with "Cancel" and "OK" buttons.
   * Returns true if "OK" is clicked.
   */
  static async confirm(msg: ElementButton.StaticNode, opts: ConfirmOptions = {}) {
    const [action] = await new Modal({
      prompt: msg,
      buttons: [...(opts.buttons ?? []), { text: getText('modal.button.decline'), action: 'decline' }, { text: getText('modal.button.confirm'), action: 'confirm' }],
      escapeAction: 'decline',
      enterAction: 'confirm',
      modalId: opts.modalId,
      modalClassList: opts.modalClassList,
      onShow: opts.onShow
    }).show();
    return action === 'confirm';
  }

  /**
   * Shows a prompt modal with an input field and "Submit"/"Cancel" buttons.
   * Returns the input value if submitted, otherwise null.
   */
  static async prompt(msg: ElementButton.StaticNode, opts: PromptOptions = {}): Promise<string | null> {
    const [action, value] = await new Modal({
      prompt: msg,
      timeoutMs: 0,
      input: { type: 'input', defaultValue: opts.defaultValue },
      buttons: [...(opts.buttons ?? []), { text: getText('modal.button.cancel'), action: 'cancel' }, { text: getText('modal.button.submit'), action: 'submit' }],
      escapeAction: 'cancel',
      enterAction: 'submit',
      modalId: opts.modalId,
      modalClassList: opts.modalClassList,
      onShow: opts.onShow
    }).show();
    return action === 'submit' ? value : null;
  }

  /** Creates the input element for the modal, applying configuration and validation. */
  private renderInput(cfg: ModalInputOptions) {
    const el = document.createElement(cfg.type);
    el.classList.add('deeplib-modal-input');
    if (cfg.placeholder) el.placeholder = cfg.placeholder;
    if (cfg.readOnly) el.readOnly = true;
    if (cfg.defaultValue) el.value = cfg.defaultValue;
    if (cfg.type === 'textarea') (el as HTMLTextAreaElement).rows = 5;
    el.addEventListener('input', () => {
      const err = cfg.validate?.(el.value);
      el.setCustomValidity(err || '');
    });
    this.inputEl = el;

    return el;
  }

  /** Creates modal action buttons from configuration. */
  private renderButtons() {
    const container = document.createElement('div');
    container.classList.add('deeplib-modal-button-container');

    const btns = this.opts.buttons ? [...this.opts.buttons] : [];

    btns.forEach(b => {
      const btn = advElement.createButton({
        id: `deeplib-modal-${b.action}`,
        onClick: () => typeof b.action === 'function' ? b.action() : this.close(b.action as T),
        options: {
          disabled: b.disabled,
          label: b.text,
        }
      });
      container.append(btn);
    });

    return container;
  }

  /** Creates the modal backdrop blocker with optional click-to-close behavior. */
  private createBlocker() {
    const blocker = document.createElement('div');
    blocker.classList.add('deeplib-modal-blocker');
    blocker.title = 'Click to close';
    if (this.opts.closeOnBackdrop !== false)
      blocker.addEventListener('click', () => this.close('close' as T));

    return blocker;
  }

  /** Implements a focus trap to keep keyboard navigation inside the modal. */
  private setupFocusTrap() {
    const focusable = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const elements = Array.from(this.dialog.querySelectorAll<HTMLElement>(focusable));
    const first = elements[0];
    const last = elements[elements.length - 1];
    this.dialog.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        if (elements.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        this.close((this.opts.escapeAction ?? 'close') as T);
      } else if (e.key === 'Enter') {
        if (elements.some(el => el === document.activeElement) && document.activeElement !== this.inputEl) return;
        e.preventDefault();
        e.stopPropagation();
        this.close((this.opts.enterAction ?? 'submit') as T);
      }
    });
    window.requestAnimationFrame(() => {
      (this.inputEl || first)?.focus();
    });
  }

  /** Closes the modal, cleans up DOM, resolves promise, and shows next queued modal. */
  private close(action: T) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    clearInterval(this.updateIntervalId);
    this.dialog.close();
    this.dialog.remove();
    this.blocker.remove();
    document.body.querySelector('.deeplib-modal-blocker')?.remove();
    const value = this.inputEl?.value ?? '';
    this.resolve([action, value]);
    Modal.dequeue();
  }

  /**
   * An internal function where we will save promise function.
   */
  private resolve: (result: [T, string]) => void = () => { };

  /** A function that adds a modal to the queue and returns a promise */
  private static enqueue(modal: Modal<any>): Promise<[any, string]> {
    Modal.queue.push(modal);
    if (!Modal.processing) Modal.dequeue();
    return new Promise(resolve => (modal.resolve = resolve));
  }

  /** A function that processes the queue, removing the first modal */
  private static dequeue() {
    const modal = Modal.queue.shift();
    if (modal) {
      Modal.processing = true;
      modal.dialog.show();
    } else {
      Modal.processing = false;
    }
  }
}
