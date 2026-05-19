import { modLogger } from '../deeplib';

export const Style = {
  /**
   * Injects a CSS style block directly into the document head using a <style> tag.
   * If a style element with the same `styleId` already exists, it won't inject again.
   */
  injectInline(styleId: string, styleSource: string) {
    const isStyleLoaded = document.getElementById(styleId);

    if (isStyleLoaded) return;

    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.appendChild(document.createTextNode(styleSource));
    document.head.appendChild(styleElement);
  },

  /**
   * Injects a CSS stylesheet link into the document head using a <link> tag.
   * If a link element with the same `styleId` already exists, it won't inject again.
   */
  injectEmbed(styleId: string, styleLink: string) {
    const isStyleLoaded = document.getElementById(styleId);

    if (isStyleLoaded) return;

    const styleElement = document.createElement('link');
    styleElement.id = styleId;
    styleElement.rel = 'stylesheet';
    styleElement.href = styleLink;
    document.head.appendChild(styleElement);
  },

  /**
   * Removes a style element from the document head by its ID.
   * Does nothing if the element is not found.
   */
  eject(id: string) {
    const style = document.getElementById(id);
    if (!style) return;

    style.remove();
  },

  /**
   * Reloads an inline style by removing the existing style element (if any)
   * and injecting the new styles inline again.
   */
  reload(styleId: string, styleSource: string) {
    Style.eject(styleId);
    Style.injectInline(styleId, styleSource);
  },

  /** Fetches the text content of a stylesheet or any resource at the given link. */
  async fetch(link: string) {
    return fetch(link).then((res) => res.text()).catch((err) => {
      modLogger.error('Failed to fetch stylesheet:', err);
      return '';
    });
  }
};
