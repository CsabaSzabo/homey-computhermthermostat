/* eslint-disable node/no-unsupported-features/es-syntax */
// eslint-disable-next-line strict
import Homey from "homey";
import { DiscoveryResultMAC } from "homey/lib/DiscoveryStrategy";
import { Hysen } from "node-broadlink";

interface DayModel {
  startHour: number;
  startMinute: number;
  temp: number;
}

export interface HysenClimateStatus {
  remoteLock: number;
  power: number;
  active: number;
  tempManual: number;
  roomTemp: number;
  thermostatTemp: number;
  autoMode: number;
  loopMode: number;
  sensor: number;
  osv: number;
  dif: number;
  svh: number;
  svl: number;
  roomTempAdj: number;
  fre: number;
  poweron: number;
  unknown: number;
  externalTemp: number;
  hour: number;
  min: number;
  sec: number;
  dayofweek: number;
  weekDay: DayModel[];
  weekEnd: DayModel[];
}

function convertMacToDecimal(mac: string): number[] {
  return mac.split(":").map((part) => parseInt(part, 16));
}

class ThermostatDevice extends Homey.Device {

  /**
   * Instance of Device
   *
   * @private
   */
  _hysenDevice: Hysen | null = null;

  /**
   * Status timer
   */
  // TODO: fix node Timer type
  _statusTimer: any | null = null;

  /**
   * Mark the device as offline in Homey
   *
   * @private
   */
  _markOffline() {
    this.log("[offline] mark device offline");
    this.setUnavailable(this.homey.__("error.offline"));
  }

  onDiscoveryResult(discoveryResult: DiscoveryResultMAC) {
    // Return a truthy value here if the discovery result matches your device.
    return discoveryResult.id === this.getData().id;
  }

  /**
   * // This method will be executed once when the device has been found (onDiscoveryResult returned true)
   *
   * @param {DiscoveryResultMAC} discoveryResult result of the MAC discovery action
   */
  async onDiscoveryAvailable(discoveryResult: DiscoveryResultMAC) {
    this.log("ThermostatDevice is available");
    this.log(`Device ID=${discoveryResult.id} MAC=${discoveryResult.mac} address=${discoveryResult.address}`);

    const covertedMac: number[] = convertMacToDecimal(discoveryResult.mac);

    this.log(" convertedMac", covertedMac);

    this._hysenDevice = new Hysen(
      {
        address: discoveryResult.address,
        family: "IPv4",
        port: 80,
        // Size copied from "node-broadlink" test data
        size: 128,
      },
      covertedMac,
      // 0x4ead: [Hysen, 'HY02/HY03', 'Hysen'],
      // https://github.com/ThomasTavernier/node-broadlink/blob/main/src/index.ts#L151C1
      20141,
    );

    await this._hysenDevice.auth();
    this.log(" authed");

    // Make it available
    this.setAvailable().catch(this.error);

    // Process data
    const status: HysenClimateStatus = await this._hysenDevice.getFullStatus();
    this.log(" status =   ", status);

    // Set initial data
    this._setCapabilities(status);

    // Set initial settings
    if (status.remoteLock != null) {
      await this.setSettings({
        remove_lock: status.remoteLock === 1,
      });
    }
    this.log(" settings (after init) =   ", this.getSettings());

    // Capability listeners
    this._setCapabilityListeners();

    // Start a timer which checks the device status every 1 minute
    this._startStatusTimer();
  }

  async onDiscoveryAddressChanged(discoveryResult: DiscoveryResultMAC) {
    // Update your connection details here, reconnect when the device is offline

    const covertedMac: number[] = convertMacToDecimal(discoveryResult.mac);

    this.log(" convertedMac", covertedMac);

    this._hysenDevice = new Hysen(
      {
        address: discoveryResult.address,
        family: "IPv4",
        port: 80,
        // Size copied from "node-broadlink" test data
        size: 128,
      },
      covertedMac,
      // 0x4ead: [Hysen, 'HY02/HY03', 'Hysen'],
      // https://github.com/ThomasTavernier/node-broadlink/blob/main/src/index.ts#L151C1
      20141,
    );

    await this._hysenDevice.auth();
    this.log(" authed");

    // this.api.address = discoveryResult.address;
    // this.api.reconnect().catch(this.error);
  }

  onDiscoveryLastSeenChanged(discoveryResult: any) {
    // When the device is offline, try to reconnect here
    // this.api.reconnect().catch(this.error);
  }

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log("ThermostatDevice has been initialized");

    const settings = this.getSettings();
    console.log("settings = ", settings.username);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log("ThermostatDevice has been added");
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log("ThermostatDevice settings where changed");

    const { poweron } = await this._hysenDevice.getFullStatus();

    for (const key of changedKeys) {
      this.log(` - ${key} changed from ${oldSettings[key]} to ${newSettings[key]}`);
      if (key === "remove_lock") {
        const removeLockValue = newSettings[key] ? 1 : 0;
        await this._hysenDevice?.setPower(poweron, removeLockValue);
      }
    }

    const settingsAfterUpdate = this.getSettings();
    this.log(" settings (after update) =   ", settingsAfterUpdate);
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log("ThermostatDevice was renamed");
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log("ThermostatDevice has been deleted");
  }

  // Custom actions
  private _startStatusTimer() {
    this._statusTimer = setInterval(async () => {
      try {
        const settings = this.getSettings();
        const status: HysenClimateStatus = await this._hysenDevice.getFullStatus();
        this.log(" (timer) status =   ", status);

        this._setCapabilities(status);

        const isChangedRemoteLock = settings.remove_lock !== (status.remoteLock === 1);
        if (status.remoteLock != null && isChangedRemoteLock) {
          await this.setSettings({
            remove_lock: status.remoteLock === 1,
          });
        }
      } catch (error) {
        this.error("Failed to get status", error);
      }
    }, 60 * 1000);
  }

  private _setCapabilities(status: HysenClimateStatus) {
    if (this.hasCapability("measure_temperature") && status.roomTemp != null) {
      this.setCapabilityValue("measure_temperature", status.roomTemp);
    }
    if (this.hasCapability("target_temperature") && status.thermostatTemp != null) {
      this.setCapabilityValue("target_temperature", status.thermostatTemp);
    }

    if (this.hasCapability("onoff") && status.power != null) {
      this.setCapabilityValue("onoff", status.power === 1);
    }

    const capabilities = this.getCapabilities();
    this.log("capabilities=", capabilities);

    // if (this.hasCapability("thermostat_mode")) {
    //   this.setCapabilityValue("thermostat_mode", "heat");
    // }
  }

  private _setCapabilityListeners() {
    this.registerCapabilityListener("target_temperature", async (value) => {
      this.log(" SET (TRY) target_temperature =   ", value);
      await this._hysenDevice.setTemp(value);
      this.log(" SET (DONE) target_temperature =   ", value);
    });

    this.registerCapabilityListener("onoff", async (value) => {
      this.log(" SET (TRY) onoff =   ", value);
      await this._hysenDevice.setPower(value ? 1 : 0);
      this.log(" SET (DONE) onoff =   ", value);
    });

    // if (this.hasCapability("thermostat_mode")) {
    //   this.registerCapabilityListener("thermostat_mode", async (value) => {
    //     this.log(" SET (TRY) thermostat_mode =   ", value);
    //     // await this._hysenDevice.setPower(value === "heat" ? 1 : 0);
    //     // this.log(" SET (DONE) thermostat_mode =   ", value);
    //   });
    // }
  }

}

module.exports = ThermostatDevice;
