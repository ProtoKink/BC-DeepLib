import { SettingElement } from '../../base/elements_typings';

export const domUtil = {
  /**
   * Automatically sets the position of the element based on the given position.
   * The position can be either a [x, y] tuple or a function returning such a tuple.
   * If both x and y are defined, the element's position is updated accordingly.
   */
  autoSetPosition: autoSetPosition,

  /**
   * Automatically sets the size of the element based on the given size.
   * The size can be either a [width, height] tuple or a function returning such a tuple.
   * If both width and height are defined, the element's size is updated accordingly.
   */
  autoSetSize: autoSetSize,

  /**
   * Hides the element by setting its CSS display property to 'none'.
   * If the element cannot be found, the function does nothing.
   */
  hide: hide,

  /**
   * Unhides the element by clearing its CSS display property (sets it to '').
   * If the element cannot be found, the function does nothing.
   */
  unhide: unhide,

  /**
   * Checks if the element has overflow content.
   * Returns an object indicating if there is any overflow,
   * and specifically if there is vertical or horizontal overflow.
   * Returns null if the element is not found.
   */
  hasOverflow: hasOverflow,

  /**
   * Checks if two rectangles overlap.
   * Returns true if the rectangles overlap, false otherwise.
   */
  doRectsOverlap: doRectsOverlap
};

function autoSetPosition(_: ElementHelp.ElementOrId, position: SettingElement['position']) {
  let xPos = undefined;
  let yPos = undefined;
  let anchor = undefined;

  if (Array.isArray(position)) {
    xPos = position[0];
    yPos = position[1];
    anchor = position[2];
  } else if (typeof position === 'function') {
    const result = position();
    xPos = result[0];
    yPos = result[1];
    anchor = result[2];
  }

  if (xPos !== undefined && yPos !== undefined) ElementSetPosition(_, xPos, yPos, anchor);
}

function autoSetSize(_: ElementHelp.ElementOrId, size: SettingElement['size']) {
  let width = undefined;
  let height = undefined;
  
  if (Array.isArray(size)) {
    width = size[0];
    height = size[1];
  } else if (typeof size === 'function') {
    const result = size();
    width = result[0];
    height = result[1];
  }
        
  if (width !== undefined && height !== undefined) ElementSetSize(_, width, height);
}

function hide(_: ElementHelp.ElementOrId) {
  const element = ElementWrap(_);
  if (!element) return;

  element.style.display = 'none';
};

function unhide(_: ElementHelp.ElementOrId) {
  const element = ElementWrap(_);
  if (!element) return;

  element.style.display = '';
};

function hasOverflow(el: ElementHelp.ElementOrId): { any: boolean, vertical: boolean, horizontal: boolean } | null {
  const element = ElementWrap(el);
  if (!element) return null;

  const vertical = element.scrollHeight > element.clientHeight;
  const horizontal = element.scrollWidth > element.clientWidth;

  return {
    any: vertical || horizontal,
    vertical,
    horizontal,
  };
}

function doRectsOverlap(rect1: DOMRect, rect2: DOMRect): boolean {
  return !(
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  );
}