/* eslint-disable node/no-unsupported-features/es-syntax */
// eslint-disable-next-line strict
import Homey from "homey";
import { DiscoveryResultMAC } from "homey/lib/DiscoveryStrategy";

class ThermostatDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log("ThermostatDriver has been initialized");
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const discoveryStrategy = this.getDiscoveryStrategy();

    const discoveryResults = discoveryStrategy.getDiscoveryResults();

    const devices = Object.values(discoveryResults).map((discoveryResult: DiscoveryResultMAC) => {
      return {
        name: "Computherm Wifi Thermostat",
        data: {
          id: discoveryResult.id,
          mac: discoveryResult.mac,
          address: discoveryResult.address,
          lastSeen: discoveryResult.lastSeen,
        },
      };
    });

    return devices;
  }

}

module.exports = ThermostatDriver;
