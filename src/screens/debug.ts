
import { Button, Checkbox, Dropdown, Input, Label, SettingElement } from '../base/elements_typings';
import { BaseSubscreen, deepLibLogger, SubscreenOptions } from '../deeplib';
import { DebugModule } from '../modules/debug';

export class GuiDebug extends BaseSubscreen {

  protected static override subscreenOptions: SubscreenOptions = {
    name: 'debug',
  };

  declare readonly module: DebugModule;

  get pageStructure(): SettingElement[][] {
    return [
      [
        {
          type: 'checkbox',
          id: 'debug-show-incoming-server-transactions',
          label: 'Show Incoming Server Transactions',
          setElementValue: () => {
            return this.module.debugSettings.showIncomingServerTransactions;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showIncomingServerTransactions = val;
          }
        },
        {
          type: 'dropdown',
          id: 'debug-incoming-filter-mode',
          label: 'Filter Mode',
          description: ['Configure which incoming message types to show or hide.', ElementCreate({tag: 'br'}), 'Include: only show these message types.', ElementCreate({tag: 'br'}), 'Exclude: hide these message types.'],
          optionsList: [{
            attributes: {
              value: 'include',
              label: 'Include',
              selected: this.module.debugSettings.incomingMessageFilterMode === 'include'
            }
          },
          {
            attributes: {
              value: 'exclude',
              label: 'Exclude',
              selected: this.module.debugSettings.incomingMessageFilterMode === 'exclude'
            }
          }],
          setSettingValue: (val: string) => {
            this.module.debugSettings.incomingMessageFilterMode = val as 'include' | 'exclude';
          },
        },
        {
          type: 'text',
          id: 'debug-incoming-message-types',
          label: 'Message Types',
          description: 'Comma-separated list of message types (e.g., "ChatRoomChat, ChatRoomSync")',
          setElementValue: () => {
            return this.module.debugSettings.incomingMessageTypes;
          },
          setSettingValue: (val: string) => {
            this.module.debugSettings.incomingMessageTypes = val;
          },
        },
        {
          type: 'checkbox',
          id: 'debug-show-outcoming-server-transactions',
          label: 'Show Outcoming Server Transactions',
          setElementValue: () => {
            return this.module.debugSettings.showOutcomingServerTransactions;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showOutcomingServerTransactions = val;
          }
        },
        {
          type: 'dropdown',
          id: 'debug-outcoming-filter-mode',
          label: 'Filter Mode',
          description: ['Configure which outcoming message types to show or hide.', ElementCreate({tag: 'br'}), 'Include: only show these message types.', ElementCreate({tag: 'br'}), 'Exclude: hide these message types.'],
          optionsList: [{
            attributes: {
              value: 'include',
              label: 'Include',
              selected: this.module.debugSettings.outcomingMessageFilterMode === 'include'
            }
          },
          {
            attributes: {
              value: 'exclude',
              label: 'Exclude',
              selected: this.module.debugSettings.outcomingMessageFilterMode === 'exclude'
            }
          }],
          setSettingValue: (val: string) => {
            this.module.debugSettings.outcomingMessageFilterMode = val as 'include' | 'exclude';
          },
        },
        {
          type: 'text',
          id: 'debug-outcoming-message-types',
          label: 'Message Types',
          description: 'Comma-separated list of message types (e.g., "ChatRoomMessage, AccountUpdate")',
          setElementValue: () => {
            return this.module.debugSettings.outcomingMessageTypes;
          },
          setSettingValue: (val: string) => {
            this.module.debugSettings.outcomingMessageTypes = val;
          },
        },
        {
          type: 'checkbox',
          id: 'debug-show-raw-translations',
          label: 'Show Raw Translations',
          setElementValue: () => {
            return this.module.debugSettings.showRawTranslations;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showRawTranslations = val;
          }
        },
        {
          type: 'checkbox',
          id: 'debug-show-file-names',
          label: 'Show File Names',
          description: 'Show the file name of the translation in the translation string.',
          setElementValue: () => {
            return this.module.debugSettings.showFileNames;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showFileNames = val;
          }
        },
        {
          type: 'checkbox',
          id: 'debug-show-raw-asset-names',
          label: 'Show Raw Asset Names',
          setElementValue: () => {
            return this.module.debugSettings.showRawAssetNames;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showRawAssetNames = val;
          }
        },
        {
          type: 'checkbox',
          id: 'debug-show-raw-activity-names',
          label: 'Show Raw Activity Names',
          setElementValue: () => {
            return this.module.debugSettings.showRawActivityNames;
          },
          setSettingValue: (val: boolean) => {
            this.module.debugSettings.showRawActivityNames = val;
          }
        }
      ],
      [
        <Button>{
          type: 'button',
          id: 'test-deeplib-big-button',
          options: {
            label: 'Big Button',
            tooltip: 'This is a big button',
            image: 'Icons/Exit.png',
          },
          size: [405, 80],
          onClick() {
            deepLibLogger.info('Big Button Clicked');
          }
        },
        <Button>{
          type: 'button',
          id: 'test-deeplib-small-button',
          options: {
            tooltip: 'This is a small button',
            image: 'Icons/Exit.png',
          },
          size: [90, 90],
          onClick() {
            deepLibLogger.info('Small Button Clicked');
          }
        },
        <Checkbox>{
          type: 'checkbox',
          id: 'test-deeplib-checkbox',
          label: 'Checkbox',
          description: 'This is a checkbox',
          setElementValue() {
            return true;
          },
          setSettingValue(val: boolean) {
            deepLibLogger.info('Checkbox value:', val);
          },
        },
        <Input>{
          type: 'text',
          id: 'test-deeplib-text-input',
          label: 'Input',
          description: 'This is a text input',
          setElementValue() {
            return 'Input Value';
          },
          setSettingValue(val: string) {
            deepLibLogger.info('Input value:', val);
          },
        },
        <Input>{
          type: 'number',
          id: 'test-deeplib-number-input',
          label: 'Input',
          description: 'This is a number input',
          setElementValue() {
            return '123';
          },
          setSettingValue(val: string) {
            deepLibLogger.info('Input value:', val);
          },
        },
        <Label>{
          type: 'label',
          id: 'test-deeplib-label',
          label: 'Label',
          description: 'This is a label',
        }
      ],
      [
        <Button>{
          type: 'button',
          id: 'test-deeplib-big-button2',
          options: {
            label: 'Big Button',
            tooltip: 'This is a big button',
            image: 'Icons/Exit.png',
          },
          size: [405, 80],
          onClick() {
            deepLibLogger.info('Big Button Clicked');
          }
        },
        <Button>{
          type: 'button',
          id: 'test-deeplib-small-button2',
          options: {
            tooltip: 'This is a small button',
            image: 'Icons/Next.png',
          },
          size: [90, 90],
          onClick() {
            deepLibLogger.info('Small Button Clicked');
          }
        },
        <Checkbox>{
          type: 'checkbox',
          id: 'test-deeplib-checkbox2',
          label: 'Checkbox',
          description: 'This is a checkbox',
          setElementValue() {
            return true;
          },
          setSettingValue(val: boolean) {
            deepLibLogger.info('Checkbox value:', val);
          },
        },
        <Input>{
          type: 'text',
          id: 'test-deeplib-text-input2',
          label: 'Input',
          description: 'This is a text input',
          setElementValue() {
            return 'Input Value';
          },
          setSettingValue(val: string) {
            deepLibLogger.info('Input value:', val);
          },
        },
        <Input>{
          type: 'number',
          id: 'test-deeplib-number-input2',
          label: 'Input',
          description: 'This is a number input',
          setElementValue() {
            return '123';
          },
          setSettingValue(val: string) {
            deepLibLogger.info('Input value:', val);
          },
        },
        <Label>{
          type: 'label',
          id: 'test-deeplib-label2',
          label: 'Label',
          description: 'This is a label',
        },
        <Dropdown>{
          type: 'dropdown',
          id: 'test-deeplib-dropdown',
          label: 'Dropdown',
          description: 'This is a dropdown',
          optionsList: ['Option 1', 'Option 2', 'Option 3'],
          setElementValue() {
            return 'Option 2';
          },
          setSettingValue(val: string) {
            deepLibLogger.info('Dropdown value:', val);
          },
          options: {
            width: 200,
          }
        }
      ]];
  }

  exit(): void {
    this.module.saveDebugSettings();
    super.exit();
  }
}
