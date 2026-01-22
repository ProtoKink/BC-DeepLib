import { BaseMigrator, BaseModule, MOD_NAME, getText, modLogger, modStorage } from '../deeplib';

export type VersionModuleOptions = {
  /**
   * List of data migration handlers to register with the `VersionModule`.
   * Each `BaseMigrator` handles upgrading data from one version to another.
   */
  migrators?: BaseMigrator[];
  /** Message to display when a new version is detected */
  newVersionMessage?: string;
  /** Optional lifecycle hook. Runs before each migration */
  beforeEach?: () => void;
  /** Optional lifecycle hook. Runs after each migration */
  afterEach?: () => void;
  /** Optional lifecycle hook. Runs before all migrations */
  beforeAll?: () => void;
  /** Optional lifecycle hook. Runs after all migrations */
  afterAll?: () => void;
};

/**
 * Handles version tracking, new version detection, and version-based migrations
 * for the mod. Also manages displaying a "new version" message to players and
 * executing registered migration routines when an update occurs.
 * 
 * **Key Responsibilities:**
 * - Track and store the current mod version in persistent player storage.
 * - Detect if the mod has been updated since the last session.
 * - Run version-specific migrations via registered `BaseMigrator` instances.
 * - Optionally display a message to the user upon detecting a new version.
 */
export class VersionModule extends BaseModule {
  /** Whether the current session is running a new version compared to stored data */
  private static isItNewVersion: boolean = false;

  /** The current mod version (retrieved from `ModSdkManager.ModInfo.version`) */
  private static version: string;

  private static newVersionMessage?: string = '';

  /** List of registered migration handlers, sorted by version */
  private static migrators: BaseMigrator[] = [];

  private static beforeEach?: () => void;
  private static afterEach?: () => void;
  private static beforeAll?: () => void;
  private static afterAll?: () => void;

  constructor(options?: VersionModuleOptions) {
    super();

    options ??= {};

    VersionModule.newVersionMessage = options.newVersionMessage;

    if (options.migrators) {
      VersionModule.migrators = options.migrators;
      VersionModule.migrators.sort((a, b) => a.migrationVersion.localeCompare(b.migrationVersion));
    }

    VersionModule.beforeEach = options.beforeEach;
    VersionModule.afterEach = options.afterEach;
    VersionModule.beforeAll = options.beforeAll;
    VersionModule.afterAll = options.afterAll;
  }

  /**
   * Initializes the module on load:
   * - Stores the current mod version.
   * - Hooks into `ChatRoomSync` to show a "new version" message when applicable.
   */
  load(): void {
    VersionModule.version = MOD_VERSION;

    VersionModule.checkVersionUpdate();

    if (modStorage.playerStorage.GlobalModule.doShowNewVersionMessage && VersionModule.isItNewVersion) {
      VersionModule.sendNewVersionMessage();
    }
  }

  /**
   * Checks if the stored version differs from the current version.
   * If a new version is detected:
   * - Flags the session as updated.
   * - Runs applicable migrations.
   * - Updates stored version in player data.
   * - Saves `modStorage`.
   */
  private static checkVersionUpdate() {
    const previousVersion = VersionModule.loadVersion();
    const currentVersion = VersionModule.version;

    if (VersionModule.isNewVersion(previousVersion, currentVersion)) {
      VersionModule.isItNewVersion = true;
      VersionModule.checkVersionMigration();
      VersionModule.saveVersion();
    }

    modStorage.save();
  }

  /**
   * Executes migrations for all registered migrators whose `MigrationVersion`
   * is newer than the previously stored version.
   */
  private static checkVersionMigration() {
    const previousVersion = VersionModule.loadVersion();
    const toMigrate = VersionModule.migrators.filter(m =>
      VersionModule.isNewVersion(previousVersion, m.migrationVersion)
    );

    if (!toMigrate.length) return;

    VersionModule.beforeAll?.();

    for (const migrator of toMigrate) {
      VersionModule.beforeEach?.();

      migrator.migrate();
      modLogger.info(
        `Migrating from ${previousVersion} to ${migrator.migrationVersion} with ${migrator.constructor.name}`
      );

      VersionModule.afterEach?.();
    }

    VersionModule.afterAll?.();
  }

  /** Sends the currently configured "new version" message to the local player. */
  static sendNewVersionMessage() {
    if (!VersionModule.newVersionMessage) return;
    
    const beepLogLength = FriendListBeepLog.push({
      MemberNumber: Player.MemberNumber,
      MemberName: MOD_NAME,
      ChatRoomName: getText('module.version.version_update'),
      ChatRoomSpace: 'X',
      Private: false,
      Sent: false,
      Time: new Date(),
      Message: VersionModule.newVersionMessage
    });

    const beepIdx = beepLogLength - 1;
    const title = getText('module.version.new_version_toast_title', {
      $modName$: MOD_NAME,
      $modVersion$: VersionModule.version
    });
    const data = FriendListBeepLog[beepIdx];

    ServerShowBeep(VersionModule.newVersionMessage, 10000, {
      memberNumber: data.MemberNumber,
      memberName: data.MemberName,
      chatRoomName: data.ChatRoomName,
      ...(data.Message && {
        onClick: () => {
          FriendListShowBeep(beepIdx);
        }
      })
    }, title);
  }

  /**
   * Determines if a given `candidate` version is newer than the `current` version.
   * 
   * Version strings are expected in `MAJOR.MINOR.PATCH` format.
   */
  private static isNewVersion(current: string | undefined, candidate: string) {
    if (current !== undefined) {
      const CURRENT_ = current.split('.'),
        CANDIDATE_ = candidate.split('.');
      for (let i = 0; i < 3; i++) {
        if (CURRENT_[i] === CANDIDATE_[i]) {
          continue;
        }
        return CANDIDATE_[i] > CURRENT_[i];
      }
    }
    if (current === undefined || current === '' || !current) {
      return true;
    }
    return false;
  }

  /** Saves the current mod version into persistent player storage. */
  private static saveVersion() {
    if (modStorage.playerStorage) {
      modStorage.playerStorage.Version = VersionModule.version;
    }
  }

  /** Loads the stored mod version from persistent player storage. */
  private static loadVersion() {
    return modStorage.playerStorage?.Version;
  }
}
