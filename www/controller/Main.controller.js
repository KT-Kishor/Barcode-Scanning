sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/base/Log"
], function (Controller, MessageToast, Log) {
    "use strict";

    var LOG_SOURCE = "com.example.scanditscanner.Main";

    return Controller.extend("com.example.scanditscanner.controller.Main", {

        // Scandit SDK instances — non-serializable, kept off the UI5 model
        _context: null,
        _camera: null,
        _barcodeCapture: null,
        _captureView: null,
        _scanditReady: false,

        // ----------------------------------------------------------------
        // UI5 lifecycle
        // ----------------------------------------------------------------

        onInit: function () {
            var oComponent = this.getOwnerComponent();
            var that = this;

            if (oComponent.isDeviceReady()) {
                // deviceready already fired before the controller was created
                that._initScandit();
            } else {
                oComponent.attachEvent("scanditReady", function () {
                    that._initScandit();
                });
            }
        },

        onExit: function () {
            this._teardownScandit();
        },

        // ----------------------------------------------------------------
        // Scandit initialization — runs once after deviceready
        // ----------------------------------------------------------------

        _initScandit: function () {
            if (this._scanditReady) {
                return; // Guard against double-init
            }

            var licenseKey = this.getOwnerComponent().getScanditKey();

            try {
                // 1. Create the DataCaptureContext (all other SDK objects derive from this)
                this._context = Scandit.DataCaptureContext.initialize(licenseKey);

                // 2. Configure the default (rear-facing) camera
                this._camera = Scandit.Camera.default;
                this._context.setFrameSource(this._camera);

                // 3. Configure barcode symbologies
                var settings = new Scandit.BarcodeCaptureSettings();
                settings.enableSymbologies([
                    Scandit.Symbology.EAN13UPCA,
                    Scandit.Symbology.EAN8,
                    Scandit.Symbology.UPCE,
                    Scandit.Symbology.QR,
                    Scandit.Symbology.DataMatrix,
                    Scandit.Symbology.Code39,
                    Scandit.Symbology.Code128,
                    Scandit.Symbology.InterleavedTwoOfFive
                ]);

                // Extend active symbol count range for Code39
                var code39Settings = settings.settingsForSymbology(Scandit.Symbology.Code39);
                code39Settings.activeSymbolCounts = [7,8,9,10,11,12,13,14,15,16,17,18,19,20];

                // 4. Create BarcodeCapture mode (disabled until user taps Scan)
                this._barcodeCapture = new Scandit.BarcodeCapture(settings);
                this._barcodeCapture.isEnabled = false;
                this._context.setMode(this._barcodeCapture);

                // 5. Attach scan result listener
                var that = this;
                this._barcodeCapture.addListener({
                    didScan: function (barcodeCapture, session) {
                        var barcode = session.newlyRecognizedBarcode;
                        if (!barcode) { return; }
                        that._onBarcodeScanned(barcode);
                    }
                });

                // 6. Connect the DataCaptureView to the DOM anchor in index.html
                this._captureView = Scandit.DataCaptureView.forContext(this._context);
                this._captureView.connectToElement(
                    document.getElementById("data-capture-view")
                );

                // 7. Add rectangular viewfinder overlay
                var overlay = new Scandit.BarcodeCaptureOverlay(this._barcodeCapture);
                overlay.viewfinder = new Scandit.RectangularViewfinder(
                    Scandit.RectangularViewfinderStyle.Square,
                    Scandit.RectangularViewfinderLineStyle.Light
                );
                this._captureView.addOverlay(overlay);

                this._scanditReady = true;
                Log.info("Scandit DataCapture initialized successfully", LOG_SOURCE);

            } catch (err) {
                Log.error("Failed to initialize Scandit: " + err.message, LOG_SOURCE);
                MessageToast.show("Scanner initialization failed. Check license key.");
            }
        },

        _teardownScandit: function () {
            if (this._camera) {
                this._camera.switchToDesiredState(Scandit.FrameSourceState.Off);
            }
            if (this._barcodeCapture) {
                this._barcodeCapture.isEnabled = false;
            }
        },

        // ----------------------------------------------------------------
        // Scan result handler
        // ----------------------------------------------------------------

        _onBarcodeScanned: function (barcode) {
            // Pause immediately after a successful scan
            this._barcodeCapture.isEnabled = false;
            this._camera.switchToDesiredState(Scandit.FrameSourceState.Off);

            var oModel = this.getView().getModel("scanResults");
            var aResults = oModel.getProperty("/results");

            var symbologyDescription = new Scandit.SymbologyDescription(barcode.symbology);
            var timestamp = new Date().toLocaleTimeString();

            // Prepend so newest appears at top
            aResults.unshift({
                data: barcode.data,
                symbology: symbologyDescription.readableName,
                timestamp: timestamp
            });

            oModel.setProperty("/results", aResults);
            oModel.setProperty("/scanning", false);
            oModel.setProperty("/lastScanned", barcode.data);

            // Restore opaque UI
            this._setPageTransparent(false);

            // Haptic feedback (Android)
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }

            MessageToast.show("Scanned: " + barcode.data);
        },

        // ----------------------------------------------------------------
        // Button handlers
        // ----------------------------------------------------------------

        onToggleScan: function () {
            if (!this._scanditReady) {
                MessageToast.show("Scanner not ready. Please wait.");
                return;
            }

            var oModel = this.getView().getModel("scanResults");
            var bScanning = oModel.getProperty("/scanning");

            if (bScanning) {
                this._stopScanning(oModel);
            } else {
                this._startScanning(oModel);
            }
        },

        _startScanning: function (oModel) {
            // Transparent background so camera feed shows through
            this._setPageTransparent(true);
            this._camera.switchToDesiredState(Scandit.FrameSourceState.On);
            this._barcodeCapture.isEnabled = true;
            oModel.setProperty("/scanning", true);
        },

        _stopScanning: function (oModel) {
            this._barcodeCapture.isEnabled = false;
            this._camera.switchToDesiredState(Scandit.FrameSourceState.Off);
            this._setPageTransparent(false);
            oModel.setProperty("/scanning", false);
        },

        onClearResults: function () {
            var oModel = this.getView().getModel("scanResults");
            oModel.setProperty("/results", []);
            oModel.setProperty("/lastScanned", "");
        },

        // ----------------------------------------------------------------
        // Helper: toggle transparent Page background for camera passthrough
        // ----------------------------------------------------------------

        _setPageTransparent: function (bTransparent) {
            var oPage = this.byId("mainPage");
            var oApp  = this.byId("mainApp");

            [oPage, oApp].forEach(function (oControl) {
                if (oControl && oControl.getDomRef()) {
                    oControl.getDomRef().style.backgroundColor = bTransparent ? "transparent" : "";
                    oControl.getDomRef().style.backgroundImage = bTransparent ? "none" : "";
                }
            });
        }

    });
});
