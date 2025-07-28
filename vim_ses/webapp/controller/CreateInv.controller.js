sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (Controller, JSONModel, Filter, FilterOperator, MessageBox, Fragment) => {
    "use strict";

    return Controller.extend("com.vimses.vimses.controller.SESItems", {
        onInit: function () {
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            this.getView().setModel(new JSONModel({
                editMode: false
            }), "viewModel");
            const oDatePicker = this.byId("idInvoiceDate");
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            this.getView().setModel(new JSONModel({
                today: today
            }), "appView");
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteItemsReqId").attachPatternMatched(this._onObjectMatchedReq, this);
            oRouter.getRoute("RouteCreateInvoive").attachPatternMatched(this._onObjectMatched, this);
            const oData = oGlobalModel.getData();
            var oAttachmentsModel = new JSONModel({
                attachments: []
            });
            this.getView().setModel(oAttachmentsModel, "attachmentsModel");
            const hasGlobalData = oData && oData.header && Object.keys(oData.header).length > 0;
            if (hasGlobalData) {
                console.log("Using existing global model data.");
                return; // Stop here — data already available
            }
            const stored = localStorage.getItem("invoiceContextData");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    oGlobalModel.setData(parsed);
                } catch (e) {
                    console.error("Failed to parse invoiceContextData from localStorage");
                }
            } else {
                // Step 3: No data found at all — show warning or redirect
                sap.m.MessageToast.show("No invoice context found. Please go back and select SES items.");
            }
        },

        _onObjectMatched: function () {
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "OneColumn");
            const oView = this.getView();
            oView.byId("idEditBtn").setVisible(false)
            oView.byId("idCreateBtn").setVisible(true)
            oView.byId("idCreateBtn").setText("Create")
            oView.byId("fileUploader").setVisible(true)
            oView.byId("idInvoiceDate").setEnabled(true)
            oView.byId("idInvoiceNum").setEnabled(true)
        },


        _onObjectMatchedReq: function (oEvent) {
            debugger;
            this.editResub = true;
            var deleteModel = this.getView().getModel("viewModel");
            deleteModel.setProperty("/editMode", false);
            const reqId = oEvent.getParameter("arguments").reqId;
            const oView = this.getView();
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            const oAttachmentsModel = oView.getModel("attachmentsModel");
            const oModel = oView.getModel(); // External model for SESVimHead

            oView.setBusy(true);

            // Build filter for REQUEST_NO
            const aFilters = [
                new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, reqId)
            ];

            oModel.read("/SESVimHead", {
                filters: aFilters,
                success: function (oData) {
                    const result = oData?.results?.[0];
                    if (!result) {
                        sap.m.MessageBox.error("No data found for REQUEST_NO: " + reqId);
                        oView.setBusy(false);
                        return;
                    }
                    oView.byId("fileUploader").setVisible(false)
                    oView.byId("idInvoiceDate").setEnabled(false)
                    oView.byId("idInvoiceNum").setEnabled(false)
                    if (result.STATUS === 3) {
                        oView.byId("idEditBtn").setVisible(true)
                        oView.byId("idEditBtn").setText("Edit")
                        oView.byId("idCreateBtn").setVisible(false)
                        oView.byId("idCreateBtn").setText("Submit")
                    } else {
                        oView.byId("idEditBtn").setVisible(false)
                        oView.byId("idCreateBtn").setVisible(false)
                        oView.byId("idCreateBtn").setText("Create")
                    }

                    // ✅ Set header to global model
                    const header = {
                        Ebeln: result.PO_NUMBER,
                        InvoiceNo: result.INVOICE_NUMBER,
                        InvoiceDate: result.INVOICE_DATE,
                        Bukrs: result.COMPANY_CODE,
                        Ernam: result.CREATED_BY,
                        Bedat: result.ORDER_DATE,
                        Waers: "INR",
                        Ekorg: result.PURCHASE_ORG,
                        Amount: result.TOTAL_AMOUNT,
                        Dpamt: result.DOWNPAYMENT_AMOUNT,
                        Dppct: result.DOWNPAYMENT_PERCENTAGE,
                        Bankacc: result.BANK_ACCOUNT,
                        Bankname: result.BANK_NAME,
                        Lifnr: result.VENDOR_CODE,
                        Vendoraddress: result.VENDOR_ADDRESS,
                        REQUEST_NO: result.REQUEST_NO,
                        Status: result.VENDOR_STATUS,
                        STATUS_DESC: result.STATUS_DESC,
                        REJECTED_COMMENT: result.REJECTED_COMMENT,
                        APPROVED_COMMENT: result.APPROVED_COMMENT,
                        SAP_INVOICE_NUMBER: result.SAP_INVOICE_NUMBER,
                        name1:result.SUPPLIER_ORG_NAME,
                        
                    };
                    oGlobalModel.setProperty("/header", header);

                    // ✅ Set SES items
                    const sesItems = (result.TO_SES_VIM_ITEMS?.results || []).map(item => ({
                        Lblni: item.SES_NO,
                        Budat: item.SES_DATE,
                        Lzvon: item.SES_PERIOD_FROM_DATE,
                        Lzbis: item.SES_PERIOD_TO_DATE,
                        Netwr: item.SES_AMOUNT,
                        SubPackno: item.SUBPACK_NO,
                        Status: item.STATUS,
                        REQUEST_NO: item.REQUEST_NO,
                        Ebeln: item.PO_NUMBER
                    }));
                    oGlobalModel.setProperty("/selectedSESItems", sesItems);

                    // After setting SES items
                    const sesItemsRaw = result.TO_SES_VIM_ITEMS?.results || [];

                    // Build request array for SES details
                    const aDetailFilters = sesItemsRaw.map(item => {
                        return new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, item.REQUEST_NO),
                                new sap.ui.model.Filter("SUBPACK_NO", sap.ui.model.FilterOperator.EQ, item.SUBPACK_NO)
                            ],
                            and: true
                        });
                    });

                    // Create a new binding OR loop to make parallel requests
                    const aDetailPromises = aDetailFilters.map(filter => {
                        return new Promise((resolve, reject) => {
                            oModel.read("/SESDetails", {
                                filters: [filter],
                                success: function (oData) {
                                    resolve(oData.results);
                                },
                                error: function (err) {
                                    let errorMessage = "Failed to fetch SES detail.";
                                    console.error("❌ SES Detail Fetch Error:", err);

                                    try {
                                        const response = JSON.parse(err.responseText);
                                        if (Array.isArray(response) && response[0]?.message) {
                                            errorMessage = response[0].message;
                                        } else if (response.error?.message?.value) {
                                            errorMessage = response.error.message.value;
                                        }
                                    } catch (e) {
                                        // leave errorMessage as default
                                    }

                                    // Optional: show to user if needed
                                    sap.m.MessageToast.show(errorMessage);

                                    resolve([]); // Continue with empty result
                                }
                            });
                        });
                    });

                    // Aggregate and set in model
                    // Promise.all(aDetailPromises).then(allDetails => {
                    //     const flattenedDetails = allDetails.flat();
                    //     oGlobalModel.setProperty("/selectedSESDetails", flattenedDetails);
                    // });
                    Promise.all(aDetailPromises).then(allDetails => {
                        const flattenedDetails = allDetails.flat();
                        const cleanedDetails = flattenedDetails.map(item => {
                            const { _id, __metadata, ...cleanedItem } = item;
                            return cleanedItem;
                        });
                        oGlobalModel.setProperty("/selectedSESDetails", cleanedDetails);
                    });


                    // ✅ Set attachments
                    const attachments = result.TO_SES_VIM_ATTACHMENTS?.results || [];
                    oAttachmentsModel.setProperty("/attachments", attachments);

                    oView.setBusy(false);
                },
                error: function (err) {
                    console.error("❌ Failed to fetch SESVimHead:");

                    let errorMessage = "Failed to load invoice data.";
                    try {
                        const response = JSON.parse(err.responseText);
                        if (Array.isArray(response) && response[0]?.message) {
                            errorMessage = response[0].message;
                        } else if (response.error?.message?.value) {
                            errorMessage = response.error.message.value;
                        }
                    } catch (e) {
                        // Fallback to default error message
                    }

                    sap.m.MessageBox.error(errorMessage);
                    oView.setBusy(false);
                }
            });


        },

        // onEditPo: function() {
        //     const oView = this.getView();
        //     const oCreateBtn = oView.byId("idCreateBtn");
        //     const oEditBtn = oView.byId("idEditBtn");
        //     const oFileUploader = oView.byId("fileUploader");
        //     const oInvoiceDate = oView.byId("idInvoiceDate");
        //     const oInvoiceNum = oView.byId("idInvoiceNum");
        //     const isCreateMode = oCreateBtn.getVisible();
        //     const obutton = oView.byId("deleteAttachment");

        //     // Show delete button only in edit mode (not create mode)
        //     obutton.setVisible(!isCreateMode);

        //     // Toggle other controls
        //     oFileUploader.setVisible(!isCreateMode);
        //     oInvoiceDate.setEnabled(!isCreateMode);
        //     oInvoiceNum.setEnabled(!isCreateMode);
        //     oCreateBtn.setVisible(!isCreateMode);
        //     oEditBtn.setText(isCreateMode ? "Edit" : "Cancel");
        // },
        onEditPo: function () {
            const oView = this.getView();
            const oCreateBtn = oView.byId("idCreateBtn");
            const oEditBtn = oView.byId("idEditBtn");
            const oFileUploader = oView.byId("fileUploader");
            const oInvoiceDate = oView.byId("idInvoiceDate");
            const oInvoiceNum = oView.byId("idInvoiceNum");
            const isCreateMode = oCreateBtn.getVisible();
            var oModel = this.getView().getModel("viewModel");
            oModel.setProperty("/editMode", !oModel.getProperty("/editMode"));

            // 2. Toggle other controls
            oFileUploader.setVisible(!isCreateMode);
            oInvoiceDate.setEnabled(!isCreateMode);
            oInvoiceNum.setEnabled(!isCreateMode);
            oCreateBtn.setVisible(!isCreateMode);
            oEditBtn.setText(isCreateMode ? "Edit" : "Cancel");
        },
        onExit: function () {
            const oView = this.getView();
            oView.byId("idCreateBtn").setVisible(true);
            oView.byId("idEditBtn").setVisible(false)
            oView.byId("idCreateBtn").setText("Create")

        },

        formatODataDate: function (dateValue) {
            // If it's a string like "2-09-2025" or "02-09-2025", normalize to DD-MM-YYYY
            if (typeof dateValue === "string" && /^\d{1,2}-\d{1,2}-\d{4}$/.test(dateValue)) {
                const [d, m, y] = dateValue.split("-");
                const day = d.padStart(2, '0');
                const month = m.padStart(2, '0');
                return `${day}-${month}-${y}`;
            }

            // If it's a Date object
            if (dateValue instanceof Date) {
                const day = String(dateValue.getDate()).padStart(2, '0');
                const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                const year = dateValue.getFullYear();
                return `${day}-${month}-${year}`;
            }

            // Unknown or invalid format
            return "";
        },



        getTotalServiceAmount: function (aItems) {
            if (!Array.isArray(aItems)) return "0.00 INR";

            const total = aItems.reduce((sum, item) => {
                const amount = parseFloat(item.Itemtotalprice ?? item.TOTAL_PRICE ?? 0);
                return sum + amount;
            }, 0);

            return total.toLocaleString("en-IN", {
                minimumFractionDigits: 2
            }) + " INR";
        },


        formatServicePeriod: function (fromDate, toDate) {
            const format = this.formatODataDate || this.formatODataDate; // depends where you define
            return `${format(fromDate)} - ${format(toDate)}`;
        },

        onClickServiceNum: async function (oEvent) {
            const packno = oEvent.getSource().getBindingContext("invoiceContext").getProperty("SubPackno");
            const reqNum = oEvent.getSource().getBindingContext("invoiceContext").getProperty("REQUEST_NO");
            const serNo = oEvent.getSource().getBindingContext("invoiceContext").getProperty("Lblni");
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            let sPath;
            let aFilters;
            let fragName;
            if (reqNum) {
                sPath = "/SESDetails";
                fragName = "com.vimses.vimses.fragments.SESItemsReq";
                aFilters = [
                    new sap.ui.model.Filter("SUBPACK_NO", sap.ui.model.FilterOperator.EQ, packno),
                    new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, reqNum),
                ];

            } else {
                sPath = "/SES_VIM_DETAILS_API";
                fragName = "com.vimses.vimses.fragments.SESItemDetails";
                aFilters = [
                    new sap.ui.model.Filter("Packno", sap.ui.model.FilterOperator.EQ, packno)
                ];
            }
            oModel.read(sPath, {
                filters: aFilters,
                success: async function (oData) {
                    if (oData.results && oData.results.length) {
                        // Store both list and packno in model
                        const detailPayload = {
                            Packno: serNo,
                            items: oData.results
                        };
                        const detailModel = new sap.ui.model.json.JSONModel(detailPayload);
                        oView.setModel(detailModel, "serviceDetails");

                        if (!this._oSesDetailsDialog) {
                            this._oSesDetailsDialog = await Fragment.load({
                                id: oView.getId(),
                                name: fragName,
                                controller: this
                            });
                            oView.addDependent(this._oSesDetailsDialog);
                        }

                        this._oSesDetailsDialog.open();
                    } else {
                        sap.m.MessageToast.show("No service details found.");
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("OData Read Error:", oError);
                    sap.m.MessageBox.error("Failed to fetch service item data.");
                }
            });
        },

        onCloseSesDetailsDialog: function () {
            this._oSesDetailsDialog.close();
        },

        handleCloseCreatInv: function () {
            debugger;
            this.getView().getModel("attachmentsModel").setProperty("/attachments", []);
            history.go(-1);
            this.getOwnerComponent().getRouter().navTo("");
        },

        onPreviewAttachment: function (oEvent) {
            const oData = oEvent.getSource().getBindingContext("attachmentsModel").getObject();
            const fileUrl = oData?.IMAGEURL; // This  blob URL or base64
            const file = oData?.file; // File object for local files

            if (!fileUrl && !file) {
                sap.m.MessageToast.show("No file available for preview.");
                return;
            }

            // Set layout and route
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "TwoColumnsBeginExpanded");

            if (file instanceof File) {
                // Handle local PDF file
                if (file.type === "application/pdf") {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Content = e.target.result.split(',')[1];
                        this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                            pdfData: encodeURIComponent(base64Content),
                            sourceType: "base64"
                        });
                    };
                    reader.readAsDataURL(file);
                } else {
                    sap.m.MessageToast.show("Only PDF files are supported for preview.");
                }
            } else if (fileUrl) {
                // Handle URL or existing base64
                if (fileUrl.startsWith("blob:")) {
                    // Handle blob URL from backend
                    this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                        pdfData: encodeURIComponent(fileUrl),
                        sourceType: "blob"
                    });
                } else if (fileUrl.startsWith("data:application/pdf")) {
                    // Handle base64 PDF data URL
                    const base64Content = fileUrl.split(',')[1];
                    this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                        pdfData: encodeURIComponent(base64Content),
                        sourceType: "base64"
                    });
                } else if (/^[A-Za-z0-9+/]+={0,2}$/.test(fileUrl)) {
                    // Handle raw base64 string
                    this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                        pdfData: encodeURIComponent(fileUrl),
                        sourceType: "base64"
                    });
                } else {
                    // Assume it's a regular URL
                    this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                        pdfData: encodeURIComponent(fileUrl),
                        sourceType: "url"
                    });
                }
            }
        },

        onFileSelected: function (oEvent) {
            debugger;
            var aFiles = oEvent.getParameter("files");
            if (!aFiles || aFiles.length === 0) {
                sap.m.MessageBox.show("No file selected!");
                return;
            }

            var oFile = aFiles[0];

            // ✅ File size check (1MB = 1048576 bytes)
            if (oFile.size > 1048576) {
                sap.m.MessageBox.warning(
                    "File size must be less than or equal to 1MB.", {
                    title: "File Too Large"
                }
                );
                this.byId("fileUploader").clear();
                
                return;
            }

            var oReader = new FileReader();
            oReader.onload = function (e) {
                var sBase64DataUrl = e.target.result.split(",")[1];

                var oNewAttachment = {
                    VendorCode: this.Lifnr,
                    DESCRIPTION: oFile.name,
                    IMAGEURL: sBase64DataUrl,
                    IMAGE_FILE_NAME: oFile.name,
                    FILE_SIZE: oFile.size,
                    UPLOADED_BY: "Current User",
                    uploadedOn: new Date().toLocaleDateString(),
                    version: "1",
                    fileObject: oFile
                };

                var oAttachmentsModel = this.getView().getModel("attachmentsModel");
                oAttachmentsModel.setProperty("/attachments", [oNewAttachment]);

                this.byId("attachmentsCountTitle").setText("Attachments");
                this.getView().getModel("invoiceContext").setProperty("/header/REJECTED_COMMENT", "");
                this.byId("fileUploader").clear();

            }.bind(this);

            oReader.onerror = function () {
                sap.m.MessageToast.show("Error reading file");
            };

            oReader.readAsDataURL(oFile);
        },


        onDeleteAttachmentPress: function (oEvent) {
            var oBindingContext = oEvent.getSource().getBindingContext("attachmentsModel");
            if (!oBindingContext) {
                return;
            }


            var sPath = oBindingContext.getPath();
            var aPathParts = sPath.split("/");
            var iIndex = parseInt(aPathParts[aPathParts.length - 1], 10);
            var oAttachmentsModel = this.getView().getModel("attachmentsModel");
            var aAttachments = oAttachmentsModel.getProperty("/attachments") || [];
            if (iIndex > -1 && iIndex < aAttachments.length) {
                aAttachments.splice(iIndex, 1);
                oAttachmentsModel.setProperty("/attachments", aAttachments);
            }
            this.byId("attachmentsCountTitle").setText("Attachments (" + aAttachments.length + ")");
            if (aAttachments.length === 0) {
                this.byId("fileUploader").setEnabled(true);
            }
        },

        onSubmitPoSES: function () {
            debugger;
            const oView = this.getView();
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            const oAttachmentsModel = oView.getModel("attachmentsModel");
            const oDataModel = oView.getModel();
            const oRouter = this.getOwnerComponent().getRouter();

            const header = oGlobalModel.getProperty("/header") || {};
            const sesItems = oGlobalModel.getProperty("/selectedSESItems") || [];
            const selectedSESDetails = oGlobalModel.getProperty("/selectedSESDetails") || [];
            const attachments = oAttachmentsModel.getProperty("/attachments") || [];

            // 🔍 Step 1: Validate Invoice Number
            if (!header.InvoiceNo || header.InvoiceNo.trim() === "") {
                sap.m.MessageToast.show("Invoice Number is required.");
                return;
            }

            // 🔍 Step 2: Validate Invoice Date
            if (!header.InvoiceDate || header.InvoiceDate.trim() === "") {
                sap.m.MessageToast.show("Invoice Date is required.");
                return;
            }

            // 🔍 Step 3: Validate attachments
            if (!attachments.length) {
                sap.m.MessageToast.show("At least one attachment must be uploaded.");
                return;
            }

            // ✅ Construct payload
            const SESHead = [
                {
                    PO_NUMBER: header.Ebeln,
                    INVOICE_NUMBER: header.InvoiceNo,
                    INVOICE_DATE: this.formatDateToDDMMYYYY(header.InvoiceDate),
                    COMPANY_CODE: header.Bukrs || "1000",
                    VENDOR_CODE: header.COMPANY_CODE || "100000",
                    CREATED_BY: header.Ernam || "",
                    ORDER_DATE: this.formatDateToDDMMYYYY(header.Bedat) || "",
                    PURCHASE_ORG: header.Ekorg || "",
                    TOTAL_AMOUNT: header.Amount,
                    DOWNPAYMENT_AMOUNT: header.Dpamt || "0",
                    DOWNPAYMENT_PERCENTAGE: header.Dppct || "0",
                    BANK_ACCOUNT: header.Bankacc || "",
                    BANK_NAME: header.Bankname || "",
                    VENDOR_ADDRESS: header.Vendoraddress || "",
                    SUPPLIER_ORG_NAME: header.name1 || ""
                }
            ];
                debugger;
            const SESItems = sesItems.map(item => ({
                PO_NUMBER: item.Ebeln,
                SES_NO: item.Lblni,
                SES_DATE: this.formatDateToDDMMYYYY(item.Budat) || "",
                SES_PERIOD_FROM_DATE: this.formatDateToDDMMYYYY(item.Lzvon) || "",
                SES_PERIOD_TO_DATE: this.formatDateToDDMMYYYY(item.Lzbis) || "",
                SES_AMOUNT: item.Netwr || "0",
                SUBPACK_NO: item.SubPackno || "",
                STATUS: item.Status,
                
            }));

            let SESDetails = [];

            if (this.editResub === true) {
                // Directly use selectedSESDetails as-is
                SESDetails = selectedSESDetails;
            } else {
                // Loop and transform each detail
                SESDetails = selectedSESDetails.map(detail => ({
                    SUBPACK_NO: detail.Packno,
                    ITEM_NO: detail.Extrow,
                    SERVICE_NO: detail.Srvpos,
                    SERVICE_DESCRIPTION: detail.Ktext1,
                    UNIT_OF_MEASURE: detail.Meins,
                    UNIT_PRICE: detail.Unitprice,
                    SERVICED_QUANTITY: detail.Menge,
                    TOTAL_PRICE: detail.Itemtotalprice || detail.TOTAL_PRICE
                }));
            }


            const SESAttachments = attachments.map(att => ({
                VendorCode: "100000",
                DESCRIPTION: att.DESCRIPTION || "Attachment",
                IMAGEURL: att.IMAGEURL,
                IMAGE_FILE_NAME: att.IMAGE_FILE_NAME
            }));

            const payload = {
                action: this.editResub === true ? "EDIT_RESUBMIT" : "CREATE",
                ...(this.editResub === true && { REQUEST_NO: header.REQUEST_NO }),
                SESHead,
                SESItems,
                SESDetails,
                SESAttachments
            };


            // ✅ Step 4: Ask for confirmation
            sap.m.MessageBox.confirm("Are you sure you want to proceed?", {
                title: "Confirm Submission",
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                onClose: function (oAction) {
                    if (oAction === sap.m.MessageBox.Action.YES) {
                        oView.setBusy(true);

                        oDataModel.create("/PostSESData", payload, {
                            success: function (res) {
                                oView.setBusy(false);
                                sap.m.MessageBox.success(res.PostSESData, {
                                    onClose: function () {
                                        oRouter.navTo("RouteSESPOList");
                                        //window.history.go(-1);
                                    }
                                });
                            },
                            error: function (err) {
                                oView.setBusy(false);
                                console.error("❌ Submit failed:", err);

                                let errorMessage = "Failed to submit invoice. Please try again.";

                                try {
                                    const response = JSON.parse(err.responseText);
                                    if (Array.isArray(response) && response[0]?.message) {
                                        errorMessage = response[0].message;
                                    } else if (response.error?.message?.value) {
                                        errorMessage = response.error.message.value;
                                    }
                                } catch (e) {
                                    // Keep default message
                                }

                                sap.m.MessageBox.error(errorMessage);
                            }
                        });
                    }
                }
            });
        },

        formatDateToDDMMYYYY: function (rawDate) {
            if (!rawDate) return "";

            let oDate;

            // If date is already a string like "5/11/25"
            if (typeof rawDate === "string" && !isNaN(Date.parse(rawDate))) {
                oDate = new Date(rawDate);
            } else if (Object.prototype.toString.call(rawDate) === "[object Date]") {
                oDate = rawDate;
            } else {
                try {
                    oDate = new Date(rawDate);
                } catch (e) {
                    return "";
                }
            }

            const day = String(oDate.getDate()).padStart(2, "0");
            const month = String(oDate.getMonth() + 1).padStart(2, "0");
            const year = oDate.getFullYear();

            return `${month}-${day}-${year}`;
        },


        handleRoutePO: function () {
            debugger;
            this.getOwnerComponent().getRouter().navTo("RouteSESPOList")
        }
    });
});