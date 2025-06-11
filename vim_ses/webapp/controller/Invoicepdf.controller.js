sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("com.vimses.vimses.controller.Invoicepdf", {

        onInit: function () {
            const oViewModel = new JSONModel({
                showPdf: false,
                isLoading: false,
                pdfSource: "",
                isLocalFile: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Invoicepdf").attachPatternMatched(this._onPdfMatched, this);
        },

        _onPdfMatched: function (oEvent) {
            const args = oEvent.getParameter("arguments");
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isLoading", true);
            oViewModel.setProperty("/showPdf", false);
            this._clearIframe();

            try {
                if (args.file) {
                    this._handleLocalFile(args.file);
                } else if (args.imageUrl) {
                    this._handleRemoteSource(decodeURIComponent(args.imageUrl));
                } else if (args.pdfData) {
                    this._handlePdfData(
                        decodeURIComponent(args.pdfData),
                        args.sourceType
                    );
                } else {
                    MessageToast.show("No PDF data provided");
                    oViewModel.setProperty("/isLoading", false);
                }
            } catch (error) {
                console.error("PDF preview error:", error);
                MessageToast.show("Error loading PDF");
                oViewModel.setProperty("/isLoading", false);
            }
        },

        _handleLocalFile: function(file) {
            const oViewModel = this.getView().getModel("viewModel");
            
            if (file.type !== "application/pdf") {
                MessageToast.show("Only PDF files are supported");
                oViewModel.setProperty("/isLoading", false);
                return;
            }

            this._readFileAsDataURL(file).then(
                (dataUrl) => {
                    oViewModel.setProperty("/pdfSource", dataUrl);
                    oViewModel.setProperty("/isLocalFile", true);
                    this._displayPdf(dataUrl);
                },
                (error) => {
                    console.error("File reading error:", error);
                    MessageToast.show("Error reading file");
                }
            ).finally(() => {
                oViewModel.setProperty("/isLoading", false);
            });
        },

        _handleRemoteSource: function(source) {
            const oViewModel = this.getView().getModel("viewModel");
            
            if (source.startsWith("blob:")) {
                this._displayPdf(source);
            } 
            else if (source.startsWith("http")) {
                this._displayPdf(source);
            }
            else if (source.startsWith("data:application/pdf")) {
                this._displayPdf(source);
            }
            else if (/^[A-Za-z0-9+/]+={0,2}$/.test(source)) {
                this._displayPdf("data:application/pdf;base64," + source);
            }
            else {
                MessageToast.show("Unsupported PDF format");
            }
            
            oViewModel.setProperty("/isLoading", false);
            oViewModel.setProperty("/showPdf", true);
        },

        _handlePdfData: function(data, sourceType) {
            const oViewModel = this.getView().getModel("viewModel");
            
            try {
                let pdfUrl;
                switch(sourceType) {
                    case "blob":
                        pdfUrl = data;
                        break;
                    case "base64":
                        case "base64url":
                        case "dataurl":
                        case "base64Data":
                        case "base64Stream":
                        case "base64String":
                        case "base64Encoded":
                        case "base64EncodedString":
                        case "base64EncodedData":
                            pdfUrl = "data:application/pdf;base64," + data;
                            break;
                    case "url":
                        pdfUrl = data;
                        break;
                    default:
                        throw new Error("Unknown source type");
                }
                
                this._displayPdf(pdfUrl);
                oViewModel.setProperty("/showPdf", true);
            } catch (error) {
                console.error("PDF handling error:", error);
                MessageToast.show("Error processing PDF");
            } finally {
                oViewModel.setProperty("/isLoading", false);
            }
        },

        _displayPdf: function(pdfSource) {
            const oViewModel = this.getView().getModel("viewModel");
            setTimeout(() => {
                const iframe = document.getElementById("pdfView01");
                if (iframe) {
                    try {
                        iframe.src = "";
                        iframe.src = pdfSource + "#toolbar=0&navpanes=0";
                        console.log("PDF source set:", pdfSource);
                        oViewModel.setProperty("/showPdf", true);
                    } catch (error) {
                        console.error("Iframe error:", error);
                        MessageToast.show("Error displaying PDF");
                    }
                } else {
                    console.error("PDF iframe not found");
                }
            }, 100);
        },

        _clearIframe: function() {
            const iframe = document.getElementById("pdfView01");
            if (iframe) {
                iframe.src = "";
            }
        },

        onIframeRendered: function() {
            const pdfSource = this.getView().getModel("viewModel").getProperty("/pdfSource");
            if (pdfSource) {
                this._displayPdf(pdfSource);
            }
        },

        _readFileAsDataURL: function(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
        },

        onClosePreview: function() {
            this._clearIframe();
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "OneColumn");
            history.go(-1);
        }
    });
});