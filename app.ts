/* eslint-disable strict */
import Homey from "homey";

class MyApp extends Homey.App {
  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log("MyApp has been initialized");

    // const discoveryStrategy = this.homey.discovery.getStrategy("mac");

    // // Use the discovery results that were already found
    // const initialDiscoveryResults = discoveryStrategy.getDiscoveryResults();
    // for (const discoveryResult of Object.values(initialDiscoveryResults)) {
    //   this.handleDiscoveryResult(discoveryResult);
    // }

    // // And listen to new results while the app is running
    // discoveryStrategy.on("result", discoveryResult => {
    //   this.handleDiscoveryResult(discoveryResult);
    // });
  }

  // handleDiscoveryResult(discoveryResult: any) {
  //   this.log("Got result:", discoveryResult);
  // }
}

module.exports = MyApp;
