/**
 * Spends excess gold on Enchanted Armoires, reserving RESERVE_GOLD.
 * 
 * @see https://habitica.fandom.com/wiki/Gold_Points
 * @param {number} [gold] - Current gold (fetched from API if not provided)
 * @returns {void}
 */
function purchaseArmoires(gold) {

  // if time limit, return
  if (webhook || installing) {
    return;
  }

  // calculate number of armoires to buy
  if (typeof gold === "undefined") {
    gold = getUser(true).stats.gp;
  }
  let numArmoires = Math.max(Math.floor((gold - RESERVE_GOLD) / ARMOIRE_COST), 0);

  console.log("Player gold: " + gold);
  console.log("Gold reserve: " + RESERVE_GOLD);
  console.log("Buying " + numArmoires + " armoire(s)");

  // if buying at least one armoire
  if (numArmoires > 0) {

    // buy armoires
    for (let i = 0; i < numArmoires; i++) {
      fetch("https://habitica.com/api/v3/user/buy-armoire", POST_PARAMS);
      if (interruptLoop()) {
        break;
      }
    }

    // sell extra food
    if (AUTO_SELL_FOOD === true) {
      scriptProperties.setProperty("sellExtraFood", "true");
    }
  }
}