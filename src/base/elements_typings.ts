export type SettingElement = Button | Checkbox | Input | Label | Dropdown | Custom;

type ElementFlexDirection = 'row' | 'column' | 'rowReverse' | 'columnReverse';

export type BaseElementModel = {
  id: string | null;
  size?: Thunk<[width: number | null, height: number | null]>;
  position?: Thunk<[x: number, y: number, anchor?: ElementHelp.AnchorXY]>;
  disabled?: Thunk<boolean>;
};

export type Button = Prettify<{
  id: Parameters<typeof ElementButton.Create>[0];
  type: 'button';
  onClick?: Parameters<typeof ElementButton.Create>[1];
  options?: Parameters<typeof ElementButton.Create>[2];
  htmlOptions?: Parameters<typeof ElementButton.Create>[3];
} & Omit<BaseElementModel, 'id'>>;

export type Checkbox = Prettify<{
  type: 'checkbox';
  label?: string;
  description?: ElementButton.StaticNode;
  setElementValue?: () => boolean;
  setSettingValue?: (val: boolean) => void;
  htmlOptions?: Partial<Record<'container' | 'checkbox' | 'label', Omit<HTMLOptions<any>, 'tag'>>> | null | undefined;
  options?: {
    direction?: ElementFlexDirection;
  }
} & BaseElementModel>;

export type Input = Prettify<{
  type: 'text' | 'number' | 'color';
  label?: string;
  description?: ElementButton.StaticNode;
  setElementValue?: () => string;
  setSettingValue?: (val: string) => void;
  htmlOptions?: Partial<Record<'container' | 'input' | 'label', Omit<HTMLOptions<any>, 'tag'>>> | null | undefined;
  options?: {
    direction?: ElementFlexDirection;
  }
} & BaseElementModel>;

export type Dropdown = Prettify<{
  id: Parameters<typeof ElementDropdown.CreateLabelled>[0];
  type: 'dropdown';
  label?: string;
  optionsList: Parameters<typeof ElementDropdown.CreateLabelled>[1];
  onChange?: Parameters<typeof ElementDropdown.CreateLabelled>[3];
  description?: ElementButton.StaticNode;
  setElementValue?: () => string;
  setSettingValue?: (val: string) => void;
  options?: Parameters<typeof ElementDropdown.CreateLabelled>[4] & {
    direction?: ElementFlexDirection;
  };
  htmlOptions?: Partial<Record<'label' | 'container' | 'select', Omit<HTMLOptions<any>, 'tag'>>> | null | undefined;
} & Omit<BaseElementModel, 'id' | 'disabled'>>;

export type Label = Prettify<{
  type: 'label';
  label?: string;
  description?: ElementButton.StaticNode;
  htmlOptions?: Omit<HTMLOptions<any>, 'tag'>;
} & BaseElementModel>;

export type Custom = Prettify<{
  type: 'custom';
  htmlOptions: HTMLOptions<keyof HTMLElementTagNameMap>;
} & BaseElementModel>;
