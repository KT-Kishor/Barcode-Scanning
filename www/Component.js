sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, JSONModel) {
    "use strict";

    // Replace with a real key from https://ssl.scandit.com/dashboard/sign-up
    var SCANDIT_LICENSE_KEY = "YOUR_SCANDIT_LICENSE_KEY_HERE";

    return UIComponent.extend("com.example.scanditscanner.Component", {

        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this._scanditLicenseKey = SCANDIT_LICENSE_KEY;
            this._deviceReady = false;

            this.getRouter().initialize();

            var that = this;
            if (window.cordova) {
                // Cordova bridge already available (unlikely but defensive)
                that._onDeviceReady();
            } else {
                document.addEventListener("deviceready", function () {
                    that._onDeviceReady();
                }, false);
            }
        },

        _onDeviceReady: function () {
            this._deviceReady = true;
            this.fireEvent("scanditReady");
        },

        isDeviceReady: function () {
            return !!this._deviceReady;
        },

        getScanditKey: function () {
            return this._scanditLicenseKey;
        }
    });
});
