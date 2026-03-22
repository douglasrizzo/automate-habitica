/**
 * Buys gems with gold (subscribers only).
 * Purchases up to monthly limit or amount player can afford.
 * 
 * @see https://habitica.fandom.com/wiki/Gold_Points
 * @returns {void}
 */
function purchaseGems() {

  let plan = getUser(true).purchased.plan;

  // if still subscribed
  if ((plan.dateTerminated && new Date(plan.dateTerminated).getTime() > new Date().getTime()) || plan.dateTerminated === null) {

    // calculate number of gems to buy
    let gemsToBuy = Math.min(BASE_GEM_CAP + plan.consecutive.gemCapExtra - plan.gemsBought, Math.floor(user.stats.gp / GOLD_PER_GEM));

    // buy gems
    if (gemsToBuy > 0) {

      console.log("Buying " + gemsToBuy + " gems");

      let params = Object.assign({
        "contentType": "application/json",
        "payload": JSON.stringify({
          "quantity": gemsToBuy
        })
      }, POST_PARAMS);
      fetch("https://habitica.com/api/v3/user/purchase/gems/gem", params);
    }
  }
}