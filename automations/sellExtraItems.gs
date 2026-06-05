/**
 * Sells extra eggs beyond the amount needed for all non-special pet and mount
 * combinations. Computes the exact need from the player's inventory, hatched
 * pets, and mounts — no manual reserve configuration required.
 *
 * @see https://habitica.fandom.com/wiki/Eggs
 * @returns {void}
 */
function sellExtraEggs() {

  // do not run if webhook
  if (webhook) {
    return;
  }

  let needs = getEggPotionNeeds();
  let inventory = getUser().items.eggs;
  let logged = false;

  // for each egg in the player's inventory
  for (let [egg, amount] of Object.entries(inventory)) {

    // skip egg types that are not part of any standard/quest pet combo
    if (!(egg in needs.eggsNeeded)) {
      continue;
    }

    let needed = needs.eggsNeeded[egg];
    let ownedUsed = needs.eggsOwnedUsed[egg] || amount;
    let nonInventoryUsed = ownedUsed - amount;
    let stillNeeded = Math.max(0, needed - nonInventoryUsed);
    let sellAmount = amount - stillNeeded;

    if (sellAmount > 0) {

      if (!logged) {
        console.log("Selling extra eggs");
        logged = true;
      }

      // sell extra eggs
      fetch("https://habitica.com/api/v3/user/sell/eggs/" + egg + "?amount=" + sellAmount, POST_PARAMS);

      // if done selling extra items, purchase armoires
      if (AUTO_PURCHASE_ARMOIRES === true && scriptProperties.getProperty("sellExtraHatchingPotions") === null && scriptProperties.getProperty("sellExtraFood") === null) {
        scriptProperties.setProperty("purchaseArmoires", "true");
      }
    }
  }
}

/**
 * Sells extra hatching potions beyond the amount needed for all non-special
 * pet and mount combinations. Computes the exact need from the player's
 * inventory, hatched pets, and mounts — no manual reserve configuration required.
 *
 * @see https://habitica.fandom.com/wiki/Hatching_Potions
 * @returns {void}
 */
function sellExtraHatchingPotions() {

  // do not run if webhook
  if (webhook) {
    return;
  }

  let needs = getEggPotionNeeds();
  let inventory = getUser().items.hatchingPotions;
  let logged = false;

  // for each hatching potion in the player's inventory
  for (let [potion, amount] of Object.entries(inventory)) {

    // skip potion types that are not part of any standard/quest pet combo
    if (!(potion in needs.potionsNeeded)) {
      continue;
    }

    let needed = needs.potionsNeeded[potion];
    let ownedUsed = needs.potionsOwnedUsed[potion] || amount;
    let nonInventoryUsed = ownedUsed - amount;
    let stillNeeded = Math.max(0, needed - nonInventoryUsed);
    let sellAmount = amount - stillNeeded;

    if (sellAmount > 0) {

      if (!logged) {
        console.log("Selling extra hatching potions");
        logged = true;
      }

      // sell extra hatching potions
      fetch("https://habitica.com/api/v3/user/sell/hatchingPotions/" + potion + "?amount=" + sellAmount, POST_PARAMS);

      // if done selling extra items, purchase armoires
      if (AUTO_PURCHASE_ARMOIRES === true && scriptProperties.getProperty("sellExtraEggs") === null && scriptProperties.getProperty("sellExtraFood") === null) {
        scriptProperties.setProperty("purchaseArmoires", "true");
      }
    }
  }
}

/**
 * Sells extra food, reserving RESERVE_FOOD of each type.
 * Triggers armoire purchase if AUTO_PURCHASE_ARMOIRES is enabled.
 * 
 * @see https://habitica.fandom.com/wiki/Food#How_To_Obtain_A_Food_Item
 * @returns {void}
 */
function sellExtraFood() {

  // do not run if webhook
  if (webhook) {
    return;
  }

  let logged = false;

  // for each food in the player's inventory
  for (let [food, amount] of Object.entries(getUser(true).items.food)) {

    // if player has more than RESERVE_FOOD
    if (food != "Saddle" && amount > RESERVE_FOOD) {

      if (!logged) {
        console.log("Selling extra food");
        logged = true;
      }

      // sell extra food
      fetch("https://habitica.com/api/v3/user/sell/food/" + food + "?amount=" + (amount - RESERVE_FOOD), POST_PARAMS);

      // if done selling extra items, purchase armoires
      if (AUTO_PURCHASE_ARMOIRES === true && scriptProperties.getProperty("sellExtraEggs") === null && scriptProperties.getProperty("sellExtraHatchingPotions") === null) {
        scriptProperties.setProperty("purchaseArmoires", "true");
      }
    }
  }
}