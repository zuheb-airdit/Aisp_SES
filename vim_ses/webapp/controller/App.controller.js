sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel"

], (BaseController ,JSONModel) => {
  "use strict";

  return BaseController.extend("com.vimses.vimses.controller.App", {
    onInit() {
      var oViewModel,
      oViewModel = new JSONModel({
        busy: true,
        delay: 0,
        layout: "OneColumn",
        previousLayout: "",
        actionButtonsInfo: {
          midColumn: {
            fullScreen: false
          }
        }
      });
    this.getOwnerComponent().setModel(oViewModel, "appView");
    }
});
});