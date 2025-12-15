/**
 * Casts Tools of the Trade until mana is used up.
 * If saveMana is true, reserves mana for after cron and Stealth casts.
 * 
 * @see https://habitica.fandom.com/wiki/Mana_Points#Restoring_Mana
 * @param {boolean} saveMana - If true, reserve mana for cron and Stealth
 * @param {number} [stealthsNeeded] - Number of Stealth casts needed (calculated if not provided)
 * @returns {void}
 */
function castToolsOfTheTrade(saveMana, stealthsNeeded) {

  // if time limit or lvl < SKILL_1_LEVEL, return
  if (webhook || installing) {
    return;
  } else if (getUser(true).stats.lvl < SKILL_1_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", nothing to cast");
    return;
  }

  let numTools = 0;
  let numPickpockets = 0;
  let numBackstabs = 0;

  console.log("Mana: " + user.stats.mp);

  // if saving mana
  if (saveMana) {

    // calculate number of stealths needed
    if (typeof stealthsNeeded === "undefined") {
      stealthsNeeded = numStealthsNeeded();
    }
    let stealthMana = stealthsNeeded * MANA_COST_STEALTH;

    // calculate mana reserve
    let int = getTotalStat("int");
    let maxManaAfterCron = ((int - user.stats.buffs.int + Math.min(Math.ceil(user.stats.lvl / 2), MAX_LEVEL_STAT_BONUS)) * 2 + BASE_MANA) * MANA_RETENTION_RATE;
    let reserve = maxManaAfterCron + stealthMana;

    console.log("Reserving no more than " + maxManaAfterCron + " (maxManaAfterCron) + " + stealthMana + " (stealthMana) = " + reserve + " mana");

    // calculate number of casts
    numTools = Math.max(Math.ceil((user.stats.mp - reserve) / MANA_COST_TOOLS_OF_TRADE), 0);
    numBackstabs = Math.max(Math.ceil((user.stats.mp - reserve) / MANA_COST_BACKSTAB), 0);
    numPickpockets = Math.max(Math.ceil((user.stats.mp - reserve) / MANA_COST_PICKPOCKET), 0);
  } else {
    numTools = Math.floor(user.stats.mp / MANA_COST_TOOLS_OF_TRADE);
    numBackstabs = Math.floor(user.stats.mp / MANA_COST_BACKSTAB);
    numPickpockets = Math.floor(user.stats.mp / MANA_COST_PICKPOCKET);
  }

  // if lvl >= SKILL_3_LEVEL, cast tools of the trade
  if (user.stats.lvl >= SKILL_3_LEVEL) {

    console.log("Casting Tools of the Trade " + numTools + " time(s)");

    for (let i = 0; i < numTools; i++) {
      fetch("https://habitica.com/api/v3/user/class/cast/toolsOfTrade", POST_PARAMS);
      if (interruptLoop()) {
        break;
      }
    }

    // if lvl SKILL_2_LEVEL, cast backstab
  } else if (user.stats.lvl == SKILL_2_LEVEL) {

    // if player has non-challenge tasks
    if (getTasks().length > 0) {

      // get bluest non-challenge task
      let bluestTask = {
        id: tasks[0]._id,
        value: tasks[0].value,
        text: tasks[0].text
      };
      for (let i = 1; i < tasks.length; i++) {
        if (tasks[i].value > bluestTask.value) {
          bluestTask.id = tasks[i]._id;
          bluestTask.value = tasks[i].value;
          bluestTask.text = tasks[i].text;
        }
      }

      console.log("Player level " + SKILL_2_LEVEL + ", casting Backstab " + numBackstabs + " time(s) on bluest task \"" + bluestTask.text + "\"");

      // cast backstabs
      for (let i = 0; i < numBackstabs; i++) {
        fetch("https://habitica.com/api/v3/user/class/cast/backStab?targetId=" + bluestTask.id, POST_PARAMS);
        if (interruptLoop()) {
          break;
        }
      }

      // if player has no non-challenge tasks
    } else {
      console.log("Player level " + SKILL_2_LEVEL + " and player has no non-challenge tasks, no skills to cast");
    }

    // if lvl SKILL_1_LEVEL, cast pickpocket
  } else {

    // if player has non-challenge tasks
    if (getTasks().length > 0) {

      // get bluest non-challenge task
      let bluestTask = {
        id: tasks[0]._id,
        value: tasks[0].value,
        text: tasks[0].text
      };
      for (let i = 1; i < tasks.length; i++) {
        if (tasks[i].value > bluestTask.value) {
          bluestTask.id = tasks[i]._id;
          bluestTask.value = tasks[i].value;
          bluestTask.text = tasks[i].text;
        }
      }

      console.log("Player level " + SKILL_1_LEVEL + ", casting Pickpocket " + numPickpockets + " time(s) on bluest task \"" + bluestTask.text + "\"");

      // cast pickpockets
      for (let i = 0; i < numPickpockets; i++) {
        fetch("https://habitica.com/api/v3/user/class/cast/pickPocket?targetId=" + bluestTask.id, POST_PARAMS);
        if (interruptLoop()) {
          break;
        }
      }

      // if player has no non-challenge tasks
    } else {
      console.log("Player level " + SKILL_1_LEVEL + " and player has no non-challenge tasks, no skills to cast");
    }
  }
}

/**
 * Casts Stealth to dodge incomplete dailies, then dumps remaining mana.
 * Run just before cron.
 * 
 * @returns {void}
 */
function castStealthAndDumpMana() {

  // if lvl >= SKILL_4_LEVEL, cast Stealth
  let stealthsNeeded;
  let numStealths = 0;
  if (getUser(true).stats.lvl >= SKILL_4_LEVEL) {

    // get number of stealth casts
    stealthsNeeded = numStealthsNeeded();
    numStealths = Math.min(stealthsNeeded, Math.floor(getUser(true).stats.mp / MANA_COST_STEALTH));

    console.log("Casting Stealth " + numStealths + " time(s)");

    // cast stealths
    for (let i = 0; i < numStealths; i++) {
      fetch("https://habitica.com/api/v3/user/class/cast/stealth", POST_PARAMS);
      stealthsNeeded--;
    }

    // if lvl < SKILL_4_LEVEL, cannot cast Stealth
  } else {
    console.log("Player lvl " + user.stats.lvl + ", cannot cast Stealth");
  }

  // if sleeping & cast stealth, pause or resume damage
  if (AUTO_PAUSE_RESUME_DAMAGE === true && user.preferences.sleep && numStealths > 0) {
    scriptProperties.setProperty("pauseResumeDamage", "true");
  }

  // cast tools of the trades
  castToolsOfTheTrade(true, stealthsNeeded);
}

/**
 * Calculates how many Stealth casts are needed to dodge all incomplete dailies.
 * 
 * @returns {number} Number of Stealth casts needed
 */
function numStealthsNeeded() {

  // count damaging dailies
  let stealth = user.stats.buffs.stealth;
  let numDamagingDailies = 0;
  for (let daily of getDailies()) {
    if (daily.isDue && !daily.completed) {
      if (stealth > 0) {
        stealth--;
        continue;
      }
      numDamagingDailies++;
    }
  }

  console.log("Damaging dailies: " + numDamagingDailies);

  // if player has damaging dailies
  if (numDamagingDailies > 0) {

    // calculate num dailies dodged per cast
    let totalPer = getTotalStat("per");
    let numDodged = Math.ceil(STEALTH_BASE_RATE * getDailies().length * totalPer / (totalPer + STEALTH_PER_DIVISOR));

    // return num stealths needed
    return Math.ceil(numDamagingDailies / numDodged);

    // if no damaging dailies, no stealth needed
  } else {
    return 0;
  }
}