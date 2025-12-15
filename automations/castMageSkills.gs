/**
 * Casts Earthquake until mana is used up.
 * If saveMana is true, reserves mana for cron, Chilling Frost, and Burst of Flames.
 * 
 * @see https://habitica.fandom.com/wiki/Mana_Points#Restoring_Mana
 * @param {boolean} saveMana - If true, reserve mana for cron and other skills
 * @returns {void}
 */
function castEarthquake(saveMana) {

  // if time limit or lvl < SKILL_2_LEVEL or lvl SKILL_2_LEVEL & not in party with other players, return
  if (webhook || installing) {
    return;
  } else if (getUser(true).stats.lvl < SKILL_2_LEVEL || (user.stats.lvl === SKILL_2_LEVEL && (typeof getParty() === "undefined" || getParty().memberCount <= 1))) {
    console.log("Player level " + user.stats.lvl + ", cannot cast buffs");
    return;
  }

  console.log("Mana: " + user.stats.mp);

  // calculate number of earthquakes to cast
  let numEarthquakes = 0;
  let numSurges = 0;
  if (saveMana) {
    let int = getTotalStat("int");
    let maxManaAfterCron = ((int - user.stats.buffs.int + Math.min(Math.ceil(user.stats.lvl / 2), MAX_LEVEL_STAT_BONUS)) * 2 + BASE_MANA) * MANA_RETENTION_RATE;
    let chillingFrostMana = user.stats.lvl >= SKILL_4_LEVEL && calculatePerfectDayBuff() === 0 ? MANA_COST_CHILLING_FROST : 0;
    let finishBossMana = Math.max(Math.ceil((DEFAULT_BOSS_HP - user.party.quest.progress.up) / Math.ceil(int / BURST_OF_FLAMES_INT_DIVISOR)) * MANA_COST_BURST_OF_FLAMES, 0);
    let reserve = maxManaAfterCron + chillingFrostMana + finishBossMana;

    console.log("Reserving no more than " + maxManaAfterCron + " (maxManaAfterCron) + " + chillingFrostMana + " (chillingFrostMana) + " + finishBossMana + " (finishBossMana) = " + reserve + " mana");

    numEarthquakes = Math.max(Math.ceil((user.stats.mp - reserve) / MANA_COST_EARTHQUAKE), 0);
    numSurges = Math.max(Math.ceil((user.stats.mp - reserve) / MANA_COST_ETHEREAL_SURGE), 0);
  } else {
    numEarthquakes = Math.floor(user.stats.mp / MANA_COST_EARTHQUAKE);
    numSurges = Math.floor(user.stats.mp / MANA_COST_ETHEREAL_SURGE);
  }

  // if lvl > SKILL_2_LEVEL, cast earthquake
  if (user.stats.lvl > SKILL_2_LEVEL) {

    console.log("Casting Earthquake " + numEarthquakes + " time(s)");

    for (let i = 0; i < numEarthquakes; i++) {
      fetch("https://habitica.com/api/v3/user/class/cast/earth", POST_PARAMS);
      if (interruptLoop()) {
        break;
      }
    }

    // if lvl SKILL_2_LEVEL & in a party with other players, cast ethereal surge
  } else {

    console.log("Player level " + SKILL_2_LEVEL + ", casting Ethereal Surge " + numSurges + " time(s)");

    for (let i = 0; i < numSurges; i++) {
      fetch("https://habitica.com/api/v3/user/class/cast/mpheal", POST_PARAMS);
      if (interruptLoop()) {
        break;
      }
    }
  }
}

/**
 * Casts Chilling Frost, Burst of Flames to finish boss, then dumps remaining mana.
 * Run just before cron.
 * 
 * @returns {void}
 */
function burnBossAndDumpMana() {

  // if lvl < SKILL_1_LEVEL, return
  if (getUser(true).stats.lvl < SKILL_1_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", no skills to cast");
    return;
  }

  let int = getTotalStat("int");
  let perfectDayBuff = calculatePerfectDayBuff();

  console.log("Mana: " + user.stats.mp);

  // if imperfect day & enough mana & streaks not already frozen & lvl >= SKILL_4_LEVEL, cast chilling frost
  if (perfectDayBuff === 0 && user.stats.mp >= MANA_COST_CHILLING_FROST && !user.stats.buffs.streaks && user.stats.lvl >= SKILL_4_LEVEL) {

    console.log("Imperfect day, casting Chilling Frost");

    fetch("https://habitica.com/api/v3/user/class/cast/frost", POST_PARAMS);
    user.stats.mp -= MANA_COST_CHILLING_FROST;
  }

  // if in a party
  if (typeof user.party._id !== "undefined") {

    // get boss hp
    let bossHP = getParty(true).quest.progress.hp;
    if (!bossHP) {
      bossHP = DEFAULT_BOSS_HP;
    }

    // if boss hp and user has non-challenge tasks
    if (typeof bossHP !== "undefined" && getTasks().length > 0) {

      console.log("Boss HP: " + bossHP);
      console.log("Pending damage: " + user.party.quest.progress.up);

      // calculate number of burst of flames to cast
      let numBursts = Math.min(Math.max(Math.ceil((bossHP - user.party.quest.progress.up) / Math.ceil(int / BURST_OF_FLAMES_INT_DIVISOR)), 0), Math.floor(user.stats.mp / MANA_COST_BURST_OF_FLAMES));

      // if casting at least 1 burst of flames
      if (numBursts > 0) {

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

        console.log("Casting Burst of Flames " + numBursts + " time(s) on bluest task \"" + bluestTask.text + "\"");

        // cast burst of flames on bluest task
        for (let i = 0; i < numBursts; i++) {
          fetch("https://habitica.com/api/v3/user/class/cast/fireball?targetId=" + bluestTask.id, POST_PARAMS);
          user.stats.mp -= MANA_COST_BURST_OF_FLAMES;
        }
      }

    } else {
      console.log("No boss fight or user has no non-challenge tasks");
    }

    // if no time limit & lvl >= SKILL_2_LEVEL & party has other players
    if (!webhook && !installing && user.stats.lvl >= SKILL_2_LEVEL && getParty().memberCount > 1) {

        // calculate number of ethereal surges to cast
      let maxManaAfterCron = ((int - user.stats.buffs.int + perfectDayBuff) * 2 + BASE_MANA) * MANA_RETENTION_RATE;

        console.log("Reserving no more than " + maxManaAfterCron + " (maxManaAfterCron) mana");

      let numSurges = Math.max(Math.ceil((user.stats.mp - maxManaAfterCron) / MANA_COST_ETHEREAL_SURGE), 0);

        console.log("Casting Ethereal Surge " + numSurges + " time(s)");

        // cast ethereal surge
      for (let i = 0; i < numSurges; i++) {
          fetch("https://habitica.com/api/v3/user/class/cast/mpheal", POST_PARAMS);
          if (interruptLoop()) {
            break;
          }
        }

      // if lvl < SKILL_2_LEVEL, cannot cast ethereal surge
    } else if (user.stats.lvl < SKILL_2_LEVEL) {
      console.log("Player level " + user.stats.lvl + ", cannot cast Ethereal Surge");
    }
  }

  // not in a party with other players & no time limit & lvl >= SKILL_3_LEVEL
  if ((typeof getParty() === "undefined" || getParty().memberCount <= 1) && !webhook && !installing && user.stats.lvl >= SKILL_3_LEVEL) {

    // calculate number of earthquakes to cast
    let maxManaAfterCron = ((int - user.stats.buffs.int + perfectDayBuff) * 2 + BASE_MANA) * MANA_RETENTION_RATE;

    console.log("Reserving no more than " + maxManaAfterCron + " (maxManaAfterCron) mana");

    let numEarthquakes = Math.max(Math.ceil((user.stats.mp - maxManaAfterCron) / MANA_COST_EARTHQUAKE), 0);

    console.log("Casting Earthquake " + numEarthquakes + " time(s)");

    // cast earthquake
    for (let i = 0; i < numEarthquakes; i++) {
      fetch("https://habitica.com/api/v3/user/class/cast/mpheal", POST_PARAMS);
      if (interruptLoop()) {
        break;
      }
    }

    // if lvl < SKILL_3_LEVEL, cannot cast earthquake
  } else if (user.stats.lvl < SKILL_3_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", cannot cast Earthquake");
  }
}