/*global QUnit*/

sap.ui.define([
	"com/vimses/vimses/controller/SESPOList.controller"
], function (Controller) {
	"use strict";

	QUnit.module("SESPOList Controller");

	QUnit.test("I should test the SESPOList controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
