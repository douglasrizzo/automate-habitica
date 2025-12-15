/**
 * Allocates all unallocated stat points to STAT_TO_ALLOCATE.
 * Run on leveledUp webhook and when player's class changes.
 * 
 * @see https://habitica.fandom.com/wiki/Character_Stats
 * @param {number} [unusedStatPoints] - Number of points to allocate (fetched from API if not provided)
 * @param {number} [lvl] - Player level (fetched from API if not provided)
 * @returns {void}
 */
function allocateStatPoints(unusedStatPoints, lvl) {

  // get user data
  if (typeof unusedStatPoints === "undefined") {
    unusedStatPoints = getUser(true).stats.points;
    lvl = user.stats.lvl;
  }

  // if unused stat points & user at least lvl 10
  if (unusedStatPoints > 0 && lvl >= 10 && !getUser().preferences.disableClasses && getUser().flags.classSelected) {

    console.log("Allocating " + unusedStatPoints + " unused stat points to " + STAT_TO_ALLOCATE);

    // allocate unused stat points to STAT_TO_ALLOCATE
    let params = Object.assign({
      "contentType": "application/json",
      "payload": JSON.stringify({
        "stats": {
          [STAT_TO_ALLOCATE]: unusedStatPoints
        }
      })
    }, POST_PARAMS);
    fetch("https://habitica.com/api/v3/user/allocate-bulk", params);

    // if allocated to str or con and player is asleep, pause or resume damage
    if (AUTO_PAUSE_RESUME_DAMAGE === true && user.preferences.sleep && STAT_TO_ALLOCATE == "con") {
      scriptProperties.setProperty("pauseResumeDamage", "true");
    }
  }
}
