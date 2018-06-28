
/**
 * Reasonably precise rounding of n to digits
 * @param {number} n number to round
 * @param {number} digits precision to round to
 * @returns {number}
 * @rountTo
 */
function roundTo(n, digits) {
    if (digits === undefined) {
        digits = 0;
    }

    var multiplicator = Math.pow(10, digits);
    n = parseFloat((n * multiplicator).toFixed(11));
    var test = (Math.round(n) / multiplicator);
    return +(test.toFixed(digits));
}

/**
 * Plato -> SG
 * (Source: http://en.wikipedia.org/wiki/Brix
 * Note this equation is only accurate if we accept that Brix is so close to Plato as to be interchangeable at the
 * temperatures and concentrations we'd encounter in brewing. Which is apparently the case according to the Wikipedia
 * entry cited.)
 * SG = (Brix / (258.6-((Brix / 258.2)*227.1))) + 1
 * @param inPlato
 * @returns {number}
 * @platoToSG
 */
function platoToSG(inPlato) {
    // inPlato = parseInt(inPlato);
    inPlato = parseFloat(inPlato); // 09-01-2017 MBW from ParseInt
    if (typeof inPlato != "number") {  // check to make sure input is a number
        throw "input must be a number";  // throw an exception with the error message
    }
    return (inPlato / (258.6 - (inPlato / 258.2 * 227.1))) + 1;
}

/**
 * SG -> Plato
 * (Source: http://en.wikipedia.org/wiki/Brix)
 * Plato = (((135.997 * SG - 630.272) * SG + 1111.14) * SG - 616.868)
 * @param inSG
 * @returns {number}
 * @sgToPlato
 */
function sgToPlato(inSG) {
    if (typeof inSG != "number") {
        throw "input must be a number";
    }
    return (((135.997 * inSG - 630.272) * inSG + 1111.14) * inSG - 616.868);
}

/**
 * Convert Brix -> SG
 * (Source: Brew Your Own Magazine)
 * Equation: SG = (Brix / (258.6-((Brix / 258.2)*227.1))) + 1
 * @param inBrix
 * @returns {number}
 * @brixToSG
 */
function brixToSG(inBrix) {
    if (typeof inBrix != "number") {
        throw "input must be a number";
    }
    return (inBrix / (258.6 - ((inBrix / 258.2) * 227.1))) + 1;
}

/**
 * Convert SG -> Brix
 * (Source: http://en.wikipedia.org/wiki/Brix)
 * Equation: Brix = (((182.4601 * SG - 775.6821) * SG + 1262.7794) * SG - 669.5622)
 * @param inSG
 * @returns {number}
 * @sgToBrix
 */
function sgToBrix(inSG) {
    if (typeof inSG != "number") {
        throw "input must be a number";
    }
    return (((182.4601 * inSG - 775.6821) * inSG + 1262.7794) * inSG - 669.5622);
}

/**
 * Convert ounces (mass) to grams
 * @param {number} inOunces
 * @returns {number}
 * @ouncesToGrams
 */
function ouncesToGrams(inOunces) {
    if (typeof inOunces != "number") {
        throw "input must be a number";
    }
    return (inOunces * 28.3495);
}

/**
* Convert grams to ounces (mass)
* @param {number} inGrams
* @returns {number}
* @gramsToOunces
*/
function gramsToOunces(inGrams) {
    if (typeof inGrams != "number") {
        throw "input must be a number";
    }
    return (inGrams * 0.035274);
}

/**
 * Convert pounds to kilograms
 * @param {number} inPounds
 * @returns {number}
 * @poundsToKilograms
 */
function poundsToKilograms(inPounds) {
    var factor = 0.453592;
    if (typeof inPounds != "number") {
        throw "input must be a number";
    }
    return inPounds * factor;
}

/**
 * Convert kilograms to pounds
 * @param {number} inKg
 * @returns {number}
 * @kilogramsToPounds
 */
function kilogramsToPounds(inKg) {
    var factor = 2.20462;
    if (typeof inKg != "number") {
        throw "input must be a number";
    }
    return inKg * factor;
}

/**
 * Convert qt/lb to l/kg
 * @param {number} inQtLb
 * @returns {number}
 * @strikeQtLbToLKg
 */
function strikeQtLbToLKg(inQtLb) {
    var factor = 2.09;
    if (typeof inQtLb != "number") {
        throw "input must be a number";
    }
    return inQtLb * factor;
}

/**
 * Convert l/kg to qt/lb
 * @param {number} inLKg
 * @returns {number}
 * @strikeLKgToQtLb
 */
function strikeLKgToQtLb(inLKg) {
    var factor = 2.09;
    if (typeof inLKg != "number") {
        throw "input must be a number";
    }
    return inLKg / factor;
}

/**
 * Convert gallons to liters
 * @param {number} inGal
 * @returns {number}
 * @gallonsToLiters
 */
function gallonsToLiters(inGal) {
    var factor = 3.78541;
    if (typeof inGal != "number") {
        throw "input must be a number";
    }
    return inGal * factor;
}

/**
 * Convert liters to gallons
 * @param inLiters
 * @returns {number}
 * @litersToGallons
 */
function litersToGallons(inLiters) {
    var factor = 0.264172;
    if (typeof inLiters != "number") {
        throw "input must be a number";
    }
    return inLiters * factor;
}
