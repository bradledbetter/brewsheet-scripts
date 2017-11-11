var nonRecipeSheets = ['Water Volume', 'Mash Strike Calculator', 'Grains', 'Hops', 'Yeast', 'Settings', 'ThaiMashCalc', 'ThaiWaterVol'];

/**
 * Totals up ingredients on our summary sheet. We hope.
 * @param {Array} range - the range sent in from sheet. It's an array of rows, where each row is an array of columns.
 * @return {Array} first column is ingredients, second column is amount
 * @totalIngredients
 */
function totalIngredients(range) {
  var ingredientMap = [];
  var rows = [];

  range.forEach(function (iRow) {
      for (var iCol = 0; iCol < iRow.length; iCol += 2) {
          if (iRow[iCol] != "") {
              var idx = ingredientMap.indexOf(iRow[iCol]);
              if (idx >= 0) {
                rows[idx][1] += !iRow[iCol + 1]?0:parseFloat(iRow[iCol + 1]);
              } else {
                  ingredientMap.push(iRow[iCol]);
                  rows.push([iRow[iCol], !iRow[iCol + 1]?0:parseFloat(iRow[iCol + 1])]);
              }
          }
      }
  });
  
  return rows;
}

var Utils = {};
/**
 * Converts decimal in string to hex in string
 * http://brew-engine.com/engines/beer_color_calculator.html
 * @param {number} num
 * @returns {string}
 */
Utils.doubleToHex = function (num) {
    var hexText = num.toString(16);
    var point = hexText.indexOf(".");
    if (point != -1) {
        hexText = hexText.substring(0, point);
    }
    while (hexText.length < 2) {
        hexText = "0" + hexText;
    }
    return hexText;
};

/**
 * A function to check whether a value is numeric - a literal number or string of a number. Similar to PHP is_numeric.
 * This implementation is basically stolen from jQuery
 * @see http://stackoverflow.com/a/1830844/1738808
 * @see http://dl.getdropbox.com/u/35146/js/tests/isNumber.html (unit tests)
 * @param {*} obj a value to check for numericity
 * @returns {boolean} true if the parameter is numeric, false if it's not
 */
Utils.isNumeric = function (obj) {
    return !Utils.isArray(obj) && (obj - parseFloat(obj) + 1) >= 0;
};

/**
 * Utility function to check if a value is empty
 * @param {*} value
 * @returns {*|boolean}
 */
Utils.isEmpty = function (value) {
    return (typeof value === 'undefined') || value === '' || value === null || value !== value;
};

/**
 * Array.isArray polyfill
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray
 * @param {*} arg
 * @returns {boolean}
 */
Utils.isArray = function (arg) {
    return Object.prototype.toString.call(arg) === '[object Array]';
};

/**
 * Converts a floating point number to a percent. E.g. 0.82 -> "81%'
 * @param {number} num
 * @param {number?} decimalPlaces
 * @returns {string}
 */
Utils.toPercent = function (num, decimalPlaces) {
    if (typeof decimalPlaces !== 'number') {
        decimalPlaces = 0;
    }
    num = parseFloat(num) * 100;
    return num.toFixed(decimalPlaces) + '%';
};


var brewcalc = {},
    moment = Moment.load();

/**
 * Initialize member variables
 */
function bcInit() {
    // get handles to various objecs
    if (typeof brewcalc.workbook === 'undefined') {
        brewcalc.workbook = SpreadsheetApp.getActiveSpreadsheet();
        if (typeof brewcalc.workbook === 'undefined') {
            throw 'Could not get handle to workbook';
        }
    }

    if (typeof brewcalc.volumeSheet === 'undefined') {
        brewcalc.volumeSheet = brewcalc.workbook.getSheetByName('Water Volume');
        if (typeof brewcalc.volumeSheet === 'undefined') {
            throw 'Could not get handle to water volume sheet';
        }
    }

    if (typeof brewcalc.recipeSheet === 'undefined') {
        brewcalc.recipeSheet = brewcalc.workbook.getSheetByName('Recipe');
        if (typeof brewcalc.recipeSheet === 'undefined') {
            throw 'Could not get handle to recipe sheet';
        }
    }

    if (typeof brewcalc.settingsSheet === 'undefined') {
        brewcalc.settingsSheet = brewcalc.workbook.getSheetByName('Settings');
        if (typeof brewcalc.settingsSheet === 'undefined') {
            throw 'Could not get handle to settings sheet';
        }
    }

    // load up settings
    brewcalc.settings = {
        decimalPlaces: brewcalc.settingsSheet.getRange('B1').getValue(),
        hopUtilizationFactor: brewcalc.settingsSheet.getRange('B2').getValue(),
        tinsethUtilizationFactor: brewcalc.settingsSheet.getRange('B3').getValue(),
        brewSheetTemplateId: brewcalc.settingsSheet.getRange('B4').getValue()
    };
}

bcInit();


/**
 * Return a list of recipe sheet names
 * @returns {Array}
 */
function bcRecipeSheetNames() { // Usage as custom function: =SheetNames( GoogleClock() )
    try {
        var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
        var out = [];
        for (var i = 3; i < sheets.length; i++) {
            var name = sheets[i - 1].getName();
            if (nonRecipeSheets.indexOf(name) < 0) {
                out.push(name);
            }
        }
    } catch (err) {
        Logger.log('Something went wrong getting sheet names: ' + err.toString());
    }
    return out.sort();
}

/**
 * Return the grain bill
 * @returns {Array} of objects in the form:
 * {
 *   name: {string} grain name,
 *   percent: {number} percentage by gravity,
 *   pounds: {number} weight in pounds,
 *   srm: {number} base color of grain
 * }
 */
function bcGetGrainBill() {
    var grainBill = [],
        idx = 0,
        name = '',
        grainRange = brewcalc.recipeSheet.getRange('A10:H18').getValues(),
        len = grainRange.length;

    for (; idx < len; idx++) {
        name = grainRange[idx][0];
        if (name === '') {
            break;
        }
        grainBill.push({
            name: name,
            percent: grainRange[idx][3],
            pounds: grainRange[idx][4],
            color: grainRange[idx][7]
        });
    }

    return grainBill;
}

/**
 * Return the mash steps, in order
 * @returns {Array} of objects in the form:
 * {
 *   temp: {number} temperature in fahrenheit
 *   time: {number} time in minutes
 * }
 */
function bcGetMashProfile() {
    var mashSteps = [],
        idx = 0,
        temp = '',
        mashRange = brewcalc.recipeSheet.getRange('K11:L14').getValues(),
        len = mashRange.length;

    for (; idx < len; idx++) {
        temp = mashRange[idx][0];
        if (temp === '') {
            break;
        }
        mashSteps.push({
            temp: temp,
            time: mashRange[idx][1]
        });
    }

    return mashSteps;
}

/**
 * Return the hop schedule, in order
 * @returns {Array} of objects in the form:
 * {
 *   name: {string}
 *   amount: {number} in ounces
 *   alpha: {number} percent
 *   time: {number} time in minutes
 * }
 */
function bcGetHopSchedule() {
    var hopSchedule = [],
        idx = 0,
        name = '',
        hopRange = brewcalc.recipeSheet.getRange('E23:J31').getValues(),
        len = hopRange.length;

    for (; idx < len; idx++) {
        name = hopRange[idx][0];
        if (name === '') {
            break;
        }
        hopSchedule.push({
            name: name,
            alpha: hopRange[idx][1],
            amount: hopRange[idx][3], // grams
            time: hopRange[idx][4]
        });
    }

    return hopSchedule;
}

/**
 * Return the fermentation steps, in order
 * @returns {Array} of objects in the form:
 * {
 *   temp: {number} temperature in fahrenheit
 *   time: {number} time in minutes
 * }
 */
function bcGetFermentationProfile() {
    var fermSteps = [],
        idx = 0,
        temp = '',
        fermRange = brewcalc.recipeSheet.getRange('K19:L21').getValues(),
        len = fermRange.length;

    for (; idx < len; idx++) {
        temp = fermRange[idx][0];
        if (temp === '') {
            break;
        }
        fermSteps.push({
            temp: temp,
            time: fermRange[idx][1]
        });
    }

    return fermSteps;
}

/**
 * Calculate brew timer steps from boil time, mash profile, and hop schedule.
 * For now: assume 1 tab whirlfloc and 1/2tsp yeast energizer at 15 minutes TODO: add to recipe sheet
 * Assume 15 minute vorlauf at temp of last mash step (assumes last mash step is mash out)
 * @param {number} boilTime
 * @param {Array} mashSteps
 * @param {Array} hopSteps
 * @returns {Array} of objects in the form:
 * {
 *   time: {string} number to set timer to
 *   action: {string} action to perform
 * }
 */
function bcGenerateBrewSteps(boilTime, mashSteps, hopSteps) {
    if (!boilTime) {
        throw 'Boil time must be a number greater than 0';
    }

    var len = mashSteps.length,
        idx = 0,
        brewSteps = [];
    for (; idx < len; idx++) {
        brewSteps.push({
            time: mashSteps[idx].time.toFixed(0),
            action: 'Mash Step ' + (idx + 1) + ': ' + mashSteps[idx].temp.toFixed(0) + '°F'
        })
    }

    brewSteps.push({
        time: '15',
        action: 'Vorlauf ' + mashSteps[len - 1].temp + '°F'
    });

    brewSteps.push({
        time: ' ',
        action: ' '
    });

    var miscAdded = false;
    len = hopSteps.length;
    idx = 0;
    for (; idx < len; idx++) {
        if (!miscAdded && hopSteps[idx].time < 15) {
            brewSteps.push({
                time: (boilTime - 15) + ' (15)',
                action: '1 tab Whirlfloc'
            });
            boilTime -= boilTime - 15;
            miscAdded = true;
        }

        brewSteps.push({
            time: (boilTime - hopSteps[idx].time) + ' (' + hopSteps[idx].time + ')',
            action: hopSteps[idx].name + ', ' + hopSteps[idx].amount.toFixed(brewcalc.settings.decimalPlaces) + 'g'

        });
        boilTime -= (boilTime - hopSteps[idx].time);

        if (boilTime < 0) {
            throw 'Your hop additions don\'t add up with your boil time';
        }

        if (!miscAdded && boilTime === 15) {
            brewSteps.push({
                time: ' (15)',
                action: '1 tab Whirlfloc'
            });
            miscAdded = true;
        }
    }

    if (boilTime > 0) {
        if (!miscAdded) {
            brewSteps.push({
                time: Number(boilTime - 15).toFixed(0) + ' (15)',
                action: '1 tab Whirlfloc'
            });
            boilTime -= (boilTime - 15);
        }
        brewSteps.push({
            time: boilTime.toFixed(0),
            action: 'Flameout'
        });
    } else if (boilTime === 0) {
        brewSteps.push({
            time: ' ',
            action: 'Flameout'
        });
    } else {
        throw 'You have too many brew day timing steps';
    }

    return brewSteps;
}

/**
 * Calculate the estimated ABV based on OG and estimated FG
 * @param {number?} inOG
 * @param {number?} inFG
 * @returns {number} percent alcohol by volume
 * http://www.brewersfriend.com/2011/06/16/alcohol-by-volume-calculator-updated/
 */
function bcCalculateABV(inOG, inFG) {
    var OG = inOG || brewcalc.recipeSheet.getRange('B4').getValue(),
        FG = inFG || bcCalculateFG(OG),
        sgOG = platoToSG(OG),
        sgFG = platoToSG(FG);

    return (76.08 * (sgOG - sgFG) / (1.775 - sgOG)) * (sgFG / 0.794);
}

/**
 * Calculate the estimated FG based on OG and yeast
 * @param {number?} inOG
 * @param {string?} inYeastName
 * @returns {number} estimated final gravity in brix/plato
 */
function bcCalculateFG(inOG, inYeastName) {
    var OG = inOG || brewcalc.recipeSheet.getRange('B4').getValue(),
        yeastName = inYeastName || brewcalc.recipeSheet.getRange('K4').getValue(),
        yeastSheet = brewcalc.workbook.getSheetByName('Yeast'),
        idx = 2,
        found = false,
        name;
    for (; idx < 106; idx++) {
        name = yeastSheet.getRange('A' + idx).getValue();
        if (name === '') {
            break;
        }
        if (name === yeastName) {
            found = true;
            break;
        }
    }
    if (!found) {
        throw 'Could not find the selected yeast in the Yeast sheet';
    }

    var maxAttenuation = yeastSheet.getRange('C' + idx).getValue();

    // TODO: figure out a way to adjust yeast attenuation by viability (culture date, etc)
    // TODO: figure out a way to adjust yeast attenuation by fermentation profile.
    // TODO: add a general yeast adjustment setting -1..2 to alter yeast attenuation

    return (OG * (1 - maxAttenuation));
}

/**
 * Calculate IBUs for a selected hop addition
 * Using Glenn Tinseth's calculations: http://www.realbeer.com/hops/research.html
 * Other reference
 *  http://www.realbeer.com/hops/bcalc_js.html
 *  http://rhbc.co/wiki/calculating-ibus
 *  http://www.howtobrew.com/section1/chapter5-5.html
 *
 * @param {number} alpha percent alpha acid, 0..1
 * @param {number} mass hop mass in grams
 * @param {number} time in minutes hops will be boiled
 * @return {number} calculated IBUs (mg/l isomerized alpha acids)
 */
function bcCalculateIBU(alpha, mass, time) {
    if (Utils.isEmpty(alpha) || Utils.isEmpty(mass) || Utils.isEmpty(time)) {
        return 0;
    }

    if (typeof alpha !== 'number') {
        throw 'Alpha must be a number';
    }

    if (typeof mass !== 'number') {
        throw 'Amount must be a number';
    }

    if (typeof time !== 'number') {
        throw 'Time must be a number';
    }

    var volume = brewcalc.recipeSheet.getRange('B3').getValue(),
        gravity = brewcalc.recipeSheet.getRange('B4').getValue(),
        utilizationFactor = 1.10;

    volume = gallonsToLiters(volume);
    gravity = platoToSG(gravity);

    var milligramsPerLiter = alpha * mass * 1000 / volume,
        utilization = ((1.65 * Math.pow(0.000125, gravity - 1) * (1 - Math.exp(-0.04 * time)) / 4.15) * utilizationFactor);

    return (milligramsPerLiter * utilization);
}

/**
 * Calculates SRM from grain bill using the Dan Morey equations as referenced here:
 * http://beersmith.com/blog/2008/04/29/beer-color-understanding-srm-lovibond-and-ebc/
 * Basically,
 * MCU_grain1 = (Grain1 Color * Grain1 Weight lbs.)/Volume in Gallons
 * ...
 * MCU_grainN = (GrainN Color * GrainN Weight lbs.)/Volume in Gallons
 * MCU = SUM MCU_grain1..MCU_grainN
 * SRM = 1.4922 * (MCU ^ 0.6859)
 *
 * @params {array?} grainBill grain bill
 * @returns {number} calculated SRM
 */
function bcCalculateSRM(grainBill) {

    if (typeof grainBill == 'undefined' || !grainBill.length) {
        grainBill = bcGetGrainBill();
    }

    var batchVolume = brewcalc.recipeSheet.getRange('B3').getValue(),
        idx = grainBill.length,
        MCU = 0;

    for (; idx--;) {
        MCU += (grainBill[idx].pounds * grainBill[idx].color) / batchVolume;
    }

    return Math.pow(MCU, 0.6859) * 1.4922;
}


/**
 * Gets called from picker to store template's file id
 * @param {string} fileId template's id
 */
function bcStoreBrewSheetTemplateId(fileId) {
    brewcalc.settingsSheet.getRange('B4').setValue(fileId);
    brewcalc.settings.brewSheetTemplateId = fileId;
    //Logger.log('storeBrewSheetTemplateId '+fileId);
    return 1;
}


/**
 * Replace keywords in a paragraph with text
 * @param {object} paragraph
 * @param {object} keyValueMap
 * @returns {object} paragraph.
 */
function bcReplaceKeywords(paragraph, keyValueMap) {
    var text = paragraph.getText(),
        tmp;
    if (text.length === 0) {
        return paragraph;
    }

    for (var prop in keyValueMap) {
        if (keyValueMap.hasOwnProperty(prop)) {
            if (Utils.isNumeric(keyValueMap[prop]) && typeof keyValueMap[prop].toFixed === 'function') {
                tmp = keyValueMap[prop];
                text = text.replace(new RegExp('%' + prop + '%', 'g'), tmp.toFixed(brewcalc.settings.decimalPlaces));
            } else if (!Utils.isArray(keyValueMap[prop])) {
                text = text.replace(new RegExp('%' + prop + '%', 'g'), keyValueMap[prop]);
            }
        }
    }

    if (typeof text === 'string' && text.length > 0) {
        paragraph.setText(text);
    }

    return paragraph;
}

/**
 * Make a copy of the template that we'll use for replacing data into
 * @param {string} name
 * @returns {object} a reference to the new document
 */
function bcDuplicateTemplate(name) {
    if (typeof name === 'undefined') {
        throw 'Could not copy to template - name was not provided.';
    }

    var newFile = brewcalc.brewSheetTemplate.makeCopy(name, brewcalc.brewSheetFolder);
    return DocumentApp.openById(newFile.getId());
}


/**
 * Export the calculator worksheet to a google doc template
 */
function bcExport() {
    var keyValueMap = {};
    try {
        brewcalc.brewSheetTemplate = DriveApp.getFileById(brewcalc.settings.brewSheetTemplateId);
        if (typeof brewcalc.brewSheetTemplate === 'undefined') {
            throw 'Could not get handle to settings sheet';
        }

        var folders = brewcalc.brewSheetTemplate.getParents();
        if (folders.hasNext()) {
            brewcalc.brewSheetFolder = folders.next();
        }

        if (typeof brewcalc.brewSheetFolder === 'undefined') {
            throw 'Could not get handle to brew sheet folder';
        }

        // get the active sheet so I don't have to rely on the recipe sheet
        var recipeSheetName = brewcalc.volumeSheet.getRange('B2').getValue();
        var currentRecipeSheet = brewcalc.workbook.getSheetByName(recipeSheetName);
        if (typeof currentRecipeSheet !== 'undefined') {
            if (nonRecipeSheets.indexOf(currentRecipeSheet.getName()) >= 0) {
                throw 'Please select a recipe sheet before exporting';
            }

            brewcalc.recipeSheet = currentRecipeSheet;
        } else {
            throw 'I couldn\'t find a sheet named "' + recipeSheetName + '"';
        }

        keyValueMap.recipeName = brewcalc.recipeSheet.getRange('K1').getValue();
        keyValueMap.version = brewcalc.recipeSheet.getRange('K3').getValue();
        var brewDateObj = brewcalc.recipeSheet.getRange('M3').getValue(),
            brewMoment;
        if (!brewDateObj || brewDateObj === '') {
            brewMoment = moment().local().add(1, 'days').startOf('day');
        } else {
            brewMoment = moment(brewDateObj).local();
        }
        var stamp = brewMoment.format('YYYY-MM-DD');

        var targetDoc = bcDuplicateTemplate(stamp + ' ' + keyValueMap.recipeName + ' v' + keyValueMap.version),
            body = targetDoc.getBody(),
            paragraphs = body.getParagraphs(),
            tables = body.getTables(),
            idx;

        // read all the relevant cells in the sheet into JS arrays
        keyValueMap.brewDate = brewMoment.format('MM/DD/YYYY');
        var volumeRange = brewcalc.volumeSheet.getRange('B4:C38').getValues(),
            recipeRange = brewcalc.recipeSheet.getRange('B2:K44').getValues();

        var boilTime = brewcalc.recipeSheet.getRange('B1').getValue();
        keyValueMap.boilTime = boilTime;
        keyValueMap.batchVolume = volumeRange[5][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[5][1];// volume to fermenter
        keyValueMap.firstRunnings = volumeRange[29][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[29][1];
        keyValueMap.preBoilVolume = volumeRange[9][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[9][1];
        keyValueMap.mashThickness = volumeRange[16][0] + volumeRange[16][1];
        keyValueMap.strikeWater = volumeRange[18][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[18][1];
        keyValueMap.strikeTemp = volumeRange[19][0].toFixed(0) + volumeRange[19][1];
        keyValueMap.firstRunningsGallons = volumeRange[29][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[29][1];
        keyValueMap.batchSpargeQuarts = volumeRange[31][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[31][1];
        keyValueMap.totalWaterGallons = volumeRange[34][0].toFixed(brewcalc.settings.decimalPlaces) + volumeRange[34][1];

        // export to template
        for (idx = paragraphs.length; idx--;) {
            paragraphs[idx] = bcReplaceKeywords(paragraphs[idx], keyValueMap);
        }

        // collect data from efficiencies sheet
        keyValueMap = {};
        keyValueMap.style = recipeRange[0][9];
        keyValueMap.targetOG = recipeRange[2][0];
        keyValueMap.yeast = recipeRange[2][9];
        keyValueMap.starter = recipeRange[3][9];
        keyValueMap.estFWG = recipeRange[25][0];
        keyValueMap.estFWP = Utils.toPercent(recipeRange[21][0]);
        keyValueMap.estPBG = recipeRange[31][0];
        keyValueMap.estPBP = Utils.toPercent(recipeRange[33][0]);
        keyValueMap.estOP = Utils.toPercent(recipeRange[40][0]);
        keyValueMap.estFG = recipeRange[4][9];
        keyValueMap.estABV = recipeRange[5][9];
        keyValueMap.IBU = recipeRange[31][8];
        keyValueMap.BUGU = recipeRange[32][8];
        keyValueMap.color = bcCalculateSRM(keyValueMap.grainBill);

        // export to template
        for (idx = paragraphs.length; idx--;) {
            paragraphs[idx] = bcReplaceKeywords(paragraphs[idx], keyValueMap);
        }

        // get ingredients
        keyValueMap = {};
        keyValueMap.grainBill = bcGetGrainBill();
        keyValueMap.mashSteps = bcGetMashProfile();
        keyValueMap.hopSchedule = bcGetHopSchedule();
        keyValueMap.fermSteps = bcGetFermentationProfile();
        keyValueMap.brewSteps = bcGenerateBrewSteps(boilTime, keyValueMap.mashSteps, keyValueMap.hopSchedule);

        // set data in the tables
        idx = tables.length;
        var stepIdx,
            stepLen,
            step;
        for (; idx--;) {
            var table = tables[idx],
                cell = table.getCell(0, 0),
                numRows = table.getNumRows(),
                cellText = cell.getText();
            if (cellText.indexOf("Fermentables & Other Ingredients") === 0) {
                stepLen = keyValueMap.grainBill.length;
                if (stepLen > numRows - 2) {
                    throw 'Your grain bill is larger than the brew sheet can handle';
                }
                for (stepIdx = 0; stepIdx < stepLen; stepIdx++) {
                    step = keyValueMap.grainBill[stepIdx];
                    table.getCell(stepIdx + 2, 0)
                        .setText(step.pounds.toFixed(brewcalc.settings.decimalPlaces) + ' lb');
                    table.getCell(stepIdx + 2, 1).setText(Utils.toPercent(step.percent));
                    table.getCell(stepIdx + 2, 2).setText(step.name);
                }
                table.getCell(stepIdx + 2, 0)
                    .setText(brewcalc.recipeSheet.getRange('E20')
                        .getValue()
                        .toFixed(brewcalc.settings.decimalPlaces) + ' lb');
                table.getCell(stepIdx + 2, 1)
                    .setText('x' + Utils.toPercent(brewcalc.recipeSheet.getRange('D20').getValue()));
                table.getCell(stepIdx + 2, 2).setText(brewcalc.recipeSheet.getRange('C20').getValue());
            } else if (cellText.indexOf("Mash Schedule") === 0) {
                stepLen = keyValueMap.mashSteps.length;
                if (stepLen > numRows - 2) {
                    throw 'Your mash schedule is larger than the brew sheet can handle';
                }
                for (stepIdx = 0; stepIdx < stepLen; stepIdx++) {
                    step = keyValueMap.mashSteps[stepIdx];
                    table.getCell(stepIdx + 2, 0).setText(step.temp.toFixed(0) + '°F');
                    table.getCell(stepIdx + 2, 1).setText(step.time.toFixed(0));
                }
            } else if (cellText.indexOf("Hops") === 0) {
                stepLen = keyValueMap.hopSchedule.length;
                if (stepLen > numRows - 2) {
                    throw 'Your hop schedule is larger than the brew sheet can handle';
                }
                for (stepIdx = 0; stepIdx < stepLen; stepIdx++) {
                    step = keyValueMap.hopSchedule[stepIdx];
                    table.getCell(stepIdx + 2, 0).setText(step.amount.toFixed(brewcalc.settings.decimalPlaces));
                    table.getCell(stepIdx + 2, 1).setText(step.name);
                    table.getCell(stepIdx + 2, 2)
                        .setText(Utils.toPercent(step.alpha, brewcalc.settings.decimalPlaces));
                    if (step.time.length == 0) {
                        table.getCell(stepIdx + 2, 3).setText('Dry hop');
                    } else {
                        table.getCell(stepIdx + 2, 3).setText(step.time.toFixed(0));
                    }
                }
            } else if (cellText.indexOf("Fermentation") === 0) {
                stepLen = keyValueMap.fermSteps.length;
                if (stepLen > numRows - 2) {
                    throw 'Your fermentation schedule is larger than the brew sheet can handle';
                }
                for (stepIdx = 0; stepIdx < stepLen; stepIdx++) {
                    step = keyValueMap.fermSteps[stepIdx];
                    table.getCell(stepIdx + 2, 0).setText(step.temp.toFixed(0) + '°F');
                    table.getCell(stepIdx + 2, 1).setText(step.time.toFixed(0) + ' days');
                }
            } else if (cellText.indexOf("Brew Day Timing") === 0) {
                stepLen = keyValueMap.brewSteps.length;
                if (stepLen > numRows - 2) {
                    throw 'Your brew day timing is larger than the brew sheet can handle';
                }
                for (stepIdx = 0; stepIdx < stepLen; stepIdx++) {
                    step = keyValueMap.brewSteps[stepIdx];
                    table.getCell(stepIdx + 2, 0).setText(step.time);
                    table.getCell(stepIdx + 2, 1).setText(step.action);
                }
            }
        }
        SpreadsheetApp.getUi().alert('Export complete!');
    } catch (ex) {
        SpreadsheetApp.getUi().alert(ex);
    }
}


function onOpen() {
    // Add a custom menu to the spreadsheet.
    SpreadsheetApp.getUi()
        .createMenu('Brew')
        .addItem('Export to Brew Sheet', 'bcExport')
        .addItem('Remove items from inventory', 'bcRemoveInventory')
        .addItem('Select Brew Sheet Template', 'bcTemplate')
        .addToUi();
}

/**
 * Gets the user's OAuth 2.0 access token so that it can be passed to Picker.
 * This technique keeps Picker from needing to show its own authorization
 * dialog, but is only possible if the OAuth scope that Picker needs is
 * available in Apps Script. In this case, the function includes an unused call
 * to a DriveApp method to ensure that Apps Script requests access to all files
 * in the user's Drive.
 *
 * @return {string} The user's OAuth 2.0 access token.
 */
function getOAuthToken() {
    DriveApp.getRootFolder();
    return ScriptApp.getOAuthToken();
}

/**
 * Displays an HTML-service dialog in Google Sheets that contains client-side
 * JavaScript code for the Google Picker API.
 */
function bcTemplate() {
    var html = HtmlService.createHtmlOutputFromFile('Picker.html')
        .setWidth(600)
        .setHeight(425)
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
    SpreadsheetApp.getUi().showModalDialog(html, 'Select a file');
}