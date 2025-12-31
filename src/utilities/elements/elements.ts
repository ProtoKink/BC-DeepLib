import { Button, Checkbox, Custom, Dropdown, Input, Label } from '../../base/elements_typings';
import { BaseSubscreen, domUtil } from '../../deeplib';
import { deepMerge } from '../common';

/**
 * Collection of element creation utilities.
 * Provides convenience wrappers for generating commonly used UI elements.
 */
export const advElement = {
  createButton: elementCreateButton,
  createCheckbox: elementCreateCheckbox,
  createInput: elementCreateInput,
  createLabel: elementCreateLabel,
  createCustom: elementCreateCustom,
  createDropdown: elementCreateDropdown,

  createTooltip: elementCreateTooltip,
  getTooltip: elementGetTooltip,
  setTooltip: elementSetTooltip,

  createBackNext: elementPrevNext,
};

function elementCreateButton(options: Omit<Button, 'type'>): HTMLButtonElement {
  options.id ??= ElementGenerateID();
  const elem = document.getElementById(options.id) as HTMLButtonElement;

  if (elem) return elem;

  (options as Button).type = 'button';
  let image = undefined;

  if (options.options?.image) {
    image = options.options.image;
    options.options.image = undefined;
  }

  const disabled = typeof options?.disabled === 'function' ? options?.disabled() : options?.disabled;

  const button = ElementButton.Create(
    options.id,
    options?.onClick ?? (() => { }),
    deepMerge({
      labelPosition: 'center',
    }, options.options),
    deepMerge({
      button: {
        classList: ['deeplib-button'],
        attributes: {
          disabled: disabled,
        },
        children: [
          image ? deepMerge({
            tag: 'img',
            attributes: {
              id: `${options.id}-image`,
              alt: '',
              decoding: 'async',
              loading: 'lazy',
              src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // 1x1 transparent image to get rid of broken image
            },
            style: {
              '--image': `url("${image}")`,
            },
          }, options.htmlOptions?.img) : undefined,
        ],
      },
    }, options.htmlOptions ?? {}));

  BaseSubscreen.currentElements.push([button, options as Button]);

  return button;
};

function elementCreateCheckbox(options: Omit<Checkbox, 'type'>): HTMLLabelElement {
  const elem = document.getElementById(options.id) as HTMLLabelElement;

  if (elem) return elem;

  (options as Checkbox).type = 'checkbox';

  const disabled = typeof options?.disabled === 'function' ? options?.disabled() : options?.disabled;

  const retElem = ElementCreate(deepMerge({
    tag: 'label',
    classList: ['deeplib-checkbox-container', options?.options?.direction ?? 'rowReverse'],
    attributes: {
      id: `${options.id}-container`,
      for: options.id,
    },
    children: [
      deepMerge({
        tag: 'span',
        classList: ['deeplib-text'],
        attributes: {
          id: `${options.id}-label`,
        },
        children: [options.label]
      } as HTMLOptions<'span'>, options.htmlOptions?.label),
      deepMerge({
        tag: 'input',
        classList: ['checkbox', 'deeplib-input'],
        attributes: {
          type: 'checkbox',
          id: options.id,
          disabled: disabled,
          checked: options?.setElementValue?.() || undefined,
        },
        eventListeners: {
          change: function () {
            options?.setSettingValue?.(this.checked);
          }
        }
      } as HTMLOptions<'input'>, options.htmlOptions?.checkbox),
    ],
  } as HTMLOptions<'label'>, options.htmlOptions?.container));

  if (options.description) {
    retElem.addEventListener('mouseover', function (ev) {
      tooltipMouseOver.call(this, ev, options.description || null);
    });

    retElem.addEventListener('mouseout', function (ev) {
      tooltipMouseOut.call(this, ev);
    });
  }

  BaseSubscreen.currentElements.push([retElem, options as Checkbox]);

  return retElem;
}

function elementCreateCustom(options: Omit<Custom, 'type'>) {
  options.id ??= ElementGenerateID();
  options.htmlOptions.attributes ??= {};
  options.htmlOptions.attributes.id ??= options.id;
  const elem = document.getElementById(options.htmlOptions.attributes.id as string);

  if (elem) return elem;

  (options as Custom).type = 'custom';

  const retElem = ElementCreate(options.htmlOptions);

  BaseSubscreen.currentElements.push([retElem, options as Custom]);

  return retElem;
}

function elementCreateInput(options: Input): HTMLLabelElement {
  const elem = document.getElementById(options.id) as HTMLLabelElement;

  if (elem) return elem;

  const disabled = typeof options?.disabled === 'function' ? options?.disabled() : options?.disabled;

  const retElem = ElementCreate(deepMerge({
    tag: 'label',
    classList: ['deeplib-input-container', options?.options?.direction ?? undefined],
    attributes: {
      id: `${options.id}-container`,
      for: options.id,
    },
    children: [
      options.label ? deepMerge({
        tag: 'span',
        classList: ['deeplib-text'],
        attributes: {
          id: `${options.id}-label`,
        },
        children: [options.label]
      } as HTMLOptions<'span'>, options.htmlOptions?.label) : undefined,
      deepMerge({
        tag: 'input',
        classList: ['deeplib-input'],
        attributes: {
          type: options.type,
          id: options.id,
          placeholder: ' ',
          disabled: disabled,
          value: options?.setElementValue?.() || undefined,
        },
        eventListeners: {
          input: function () {
            options?.setSettingValue?.(this.value);
          }
        }
      } as HTMLOptions<'input'>, options.htmlOptions?.input),
    ],
  } as HTMLOptions<'label'>, options.htmlOptions?.container));

  if (options.description) {
    retElem.addEventListener('mouseover', function (ev) {
      tooltipMouseOver.call(this, ev, options.description || null);
    });

    retElem.addEventListener('mouseout', function (ev) {
      tooltipMouseOut.call(this, ev);
    });
  }

  BaseSubscreen.currentElements.push([retElem, options]);

  return retElem;
}

function elementCreateLabel(options: Omit<Label, 'type'>): HTMLLabelElement {
  const elem = document.getElementById(options.id) as HTMLLabelElement;

  if (elem) return elem;

  (options as Label).type = 'label';

  const retElem = ElementCreate(deepMerge({
    tag: 'label',
    classList: ['deeplib-label', 'deeplib-text'],
    attributes: {
      id: options.id
    },
    children: [
      options.label,
    ],
  } as HTMLOptions<'label'>, options.htmlOptions));

  if (options.description) {
    retElem.addEventListener('mouseover', function (ev) {
      tooltipMouseOver.call(this, ev, options.description || null);
    });

    retElem.addEventListener('mouseout', function (ev) {
      tooltipMouseOut.call(this, ev);
    });
  }

  BaseSubscreen.currentElements.push([retElem, options as Label]);

  return retElem;
}

function elementCreateDropdown(options: Omit<Dropdown, 'type'>): HTMLLabelElement {
  options.id ??= ElementGenerateID();
  const elem = document.getElementById(`${options.id}-container`) as HTMLLabelElement;

  if (elem) return elem;

  (options as Dropdown).type = 'dropdown';

  const retElem = ElementCreate(deepMerge({
    tag: 'label',
    classList: ['deeplib-dropdown-container', options?.options?.direction ?? undefined],
    attributes: {
      id: `${options.id}-container`,
      for: options.id,
    },
    children: [
      options.label ? deepMerge({
        tag: 'span',
        classList: ['deeplib-text'],
        attributes: {
          id: `${options.id}-label`,
        },
        children: [options.label]
      } as HTMLOptions<'span'>, options.htmlOptions?.label) : undefined,
      ElementCreateDropdown(
        options.id,
        options.optionsList,
        function () { return options.setSettingValue?.(this.value); },
        options.options,
        options.htmlOptions?.select
      ),
    ],
    eventListeners: {
      mouseover: function (ev) {
        tooltipMouseOver.call(this, ev, options.description || null);
      },
      mouseout: function (ev) {
        tooltipMouseOut.call(this, ev);
      }
    }
  } as HTMLOptions<'label'>, options.htmlOptions?.container));

  BaseSubscreen.currentElements.push([retElem, options as Dropdown]);

  return retElem;
}

function elementCreateTooltip() {
  const element = ElementCreate({
    tag: 'div',
    classList: ['deeplib-tooltip', 'anchor-bottom'],
    attributes: {
      id: 'deeplib-tooltip'
    },
    style: {
      display: 'none'
    },
  });

  return element;
}

function elementGetTooltip() {
  return document.getElementById('deeplib-tooltip') ?? undefined;
}

function tooltipMouseOver(this: HTMLElement, _ev: MouseEvent, description: ElementButton.StaticNode) {
  const elementRect = this.getBoundingClientRect();
  
  elementSetTooltip(description, 'bottom');
  
  const tooltipElement = elementGetTooltip();
  if (tooltipElement) {
    // Force a reflow to ensure tooltip is rendered and positioned
    void tooltipElement.offsetHeight;
    
    const tooltipRect = tooltipElement.getBoundingClientRect();
    
    const overlaps = domUtil.doRectsOverlap(elementRect, tooltipRect);
    
    // If tooltip covers the element, move it to top
    const position = overlaps ? 'top' : 'bottom';
    if (position === 'top') {
      elementSetTooltipPosition('top');
    }
  }
}

function tooltipMouseOut(this: HTMLElement, _ev: MouseEvent) {
  elementSetTooltip(null);
}

function elementSetTooltip(text: ElementButton.StaticNode, position: 'top' | 'bottom' = 'bottom') {
  const element = document.getElementById('deeplib-tooltip');

  if (!element) return false;

  elementSetTooltipPosition(position);

  const nodes = (() => {
    if (text === null || text === undefined) return null;
    else if (CommonIsObject(text) && 'tag' in text) return [ElementCreate(text)] as HTMLElement[];
    else if (CommonIsArray(text)) return text.map(i => {
      if (CommonIsObject(i) && 'tag' in i) return ElementCreate(i) as HTMLElement;
      else if (typeof i === 'string' || (CommonIsObject(text) && 'tag' in text) || i instanceof HTMLElement) return i;
      else return null;
    }).filter(i => i !== null) as (HTMLElement | string)[];
    else if (typeof text === 'string') return [text];
    else return null;
  })();

  if (nodes === null) {
    element.childNodes.forEach(i => i.remove());
    element.style.display = 'none';
    return true;
  }

  element.replaceChildren(...nodes);
  element.style.display = '';

  return true;
}

function elementSetTooltipPosition(position: 'top' | 'bottom') {
  const element = document.getElementById('deeplib-tooltip');
  if (!element) return false;
  element.classList.toggle('anchor-bottom', position === 'bottom');
  element.classList.toggle('anchor-top', position === 'top');
}

interface PrevNext {
  id: string,
  initialLabel?: string
  back: (arg0: PrevNextCallbacks) => void,
  initialPrevTooltip?: string,
  next: (arg0: PrevNextCallbacks) => void,
  initialNextTooltip?: string
};

interface PrevNextCallbacks {
  setLabel: (label: string) => void,
  setBackTooltip: (tooltip: string) => void,
  setNextTooltip: (tooltip: string) => void
}

function elementPrevNext(options: PrevNext) {
  const elem = document.getElementById(options.id);

  if (elem) return elem;

  const setLabel = (label: string) => {
    const elem = document.getElementById(`${options.id}-label`);
    if (!elem) return false;
    elem.textContent = label;
  };

  const setPrevTooltip = (tooltip: string) => {
    const elem = document.getElementById(`deeplib-prev-next-${options.id}-prev-button-tooltip`);
    if (!elem) return false;
    elem.textContent = tooltip;
  };

  const setNextTooltip = (tooltip: string) => {
    const elem = document.getElementById(`deeplib-prev-next-${options.id}-next-button-tooltip`);
    if (!elem) return false;
    elem.textContent = tooltip;
  };

  const retElem = ElementCreate({
    tag: 'div',
    classList: ['deeplib-prev-next'],
    attributes: {
      id: options.id
    },
    children: [
      advElement.createButton({
        id: `deeplib-prev-next-${options.id}-prev-button`,
        onClick: () => {
          options.back({
            setLabel: setLabel,
            setBackTooltip: setPrevTooltip,
            setNextTooltip: setNextTooltip,
          });
        },
        htmlOptions: {
          button: {
            classList: ['deeplib-prev-next-button']
          }
        },
        options: {
          noStyling: true,
          image: `${PUBLIC_URL}/dl_images/arrow_left.svg`,
          tooltip: options.initialPrevTooltip,
        }
      }),
      advElement.createLabel({
        id: `${options.id}-label`,
        label: options.initialLabel,
        htmlOptions: {
          classList: ['deeplib-prev-next-label']
        }
      }),
      advElement.createButton({
        id: `deeplib-prev-next-${options.id}-next-button`,
        onClick: () => {
          options.next({
            setLabel: setLabel,
            setBackTooltip: setPrevTooltip,
            setNextTooltip: setNextTooltip,
          });
        },
        htmlOptions: {
          button: {
            classList: ['deeplib-prev-next-button']
          }
        },
        options: {
          noStyling: true,
          image: `${PUBLIC_URL}/dl_images/arrow_right.svg`,
          tooltip: options.initialNextTooltip,
        }
      }),
    ]
  });

  return retElem;
}
