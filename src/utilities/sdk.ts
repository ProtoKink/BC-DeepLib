/**
 * Defines priority levels for hooking functions.
 * Hooks with higher priority are called first in hook chain.
 */
export const HookPriority = {
  Observe: 0,
  AddBehavior: 1,
  ModifyBehavior: 5,
  OverrideBehavior: 10,
  Top: 100
};

/** Tag used to group/remove related hooks */
export type ModuleCategory = number | string;

/**
 * Interface representing data about a patched function,
 * including the function name and all hooks applied to it.
 */
interface IPatchedFunctionData {
  name: string;
  hooks: {
    hook: PatchHook;
    priority: number;
    module: ModuleCategory | null;
    removeCallback: () => void;
  }[];
}

/**
 * Manager class for mod SDK integration,
 * provides methods to register mods, hook functions, and manage patches.
 */
export class ModSdkManager {
  private SDK: ModSDKModAPI;
  private patchedFunctions: Map<string, IPatchedFunctionData> = new Map();

  /** Registers a mod with the SDK and stores mod information. */
  constructor(info: ModSDKModInfo, options?: ModSDKModOptions) {
    this.SDK = bcModSdk.registerMod(info, options);
  }

  /**
   * Hooks a function with a callback at a given priority. 
   * 
   * Prevents duplicate hooks.
   */
  hookFunction<TargetName extends string>(
    target: TargetName,
    priority: number,
    hook: PatchHook<GetDotedPathType<typeof globalThis, TargetName>>,
    module: ModuleCategory | null = null
  ): () => void {
    const data = this.initPatchableFunction(target);

    const existingHook = data.hooks.find((h) => h.hook === hook);
    if (existingHook) {
      console.warn(`Hook already exists for function ${target}:`, hook.toString());
      return existingHook.removeCallback;
    }

    const removeCallback = this.SDK.hookFunction(target, priority, hook);

    data.hooks.push({
      hook,
      priority,
      module,
      removeCallback
    });

    return removeCallback;
  }

  /**
   * Applies patches to a target function.
   * 
   * **This method is DANGEROUS** to use and has high potential to conflict with other mods.
   */
  patchFunction(target: string, patches: Record<string, string>): void {
    this.SDK.patchFunction(target, patches);
  }

  /**
   * Removes all patches from a target function.
   */
  unpatchFunction(target: string): void {
    this.SDK.removePatches(target);
  }

  /**
   * Removes all hooks associated with a specific module from a target function.
   */
  removeHookByModule(target: string, module: ModuleCategory): boolean {
    const data = this.patchedFunctions.get(target);
    if (!data) return false;

    let removed = false;
    for (let i = data.hooks.length - 1; i >= 0; i--) {
      if (data.hooks[i].module === module) {
        data.hooks[i].removeCallback();
        data.hooks.splice(i, 1);
        removed = true;
      }
    }

    if (data.hooks.length === 0) {
      this.patchedFunctions.delete(target);
    }

    return removed;
  }

  /**
   * Removes all hooks associated with a specific module across all patched functions.
   */
  removeAllHooksByModule(module: ModuleCategory): boolean {
    let removed = false;
    for (const data of this.patchedFunctions.values()) {
      for (let i = data.hooks.length - 1; i >= 0; i--) {
        if (data.hooks[i].module === module) {
          data.hooks[i].removeCallback();
          data.hooks.splice(i, 1);
          removed = true;
        }
      }

      if (data.hooks.length === 0) {
        this.patchedFunctions.delete(data.name);
      }
    }

    return removed;
  }

  /**
   * Unloads the mod removing all hooks and patches by it.
   */
  unload() {
    this.SDK.unload();
    this.patchedFunctions.clear();
  }

  /** Retrieves or initializes patch data for a given target function. */
  private initPatchableFunction(target: string): IPatchedFunctionData {
    let result = this.patchedFunctions.get(target);
    if (!result) {
      result = {
        name: target,
        hooks: []
      };
      this.patchedFunctions.set(target, result);
    }
    return result;
  }
}
