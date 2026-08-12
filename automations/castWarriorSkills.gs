/**
 * Casts Valorous Presence until mana is used up.
 * If saveMana is true, reserves mana to finish off an active boss with Brutal Smash.
 *
 * @param {boolean} saveMana - If true, reserve mana for finishing the current boss
 * @returns {void}
 */
function castValorousPresence(saveMana) {

  // if time limit, return
  if (webhook || installing) {
    return;
  }

  // if lvl >= SKILL_2_LEVEL (Defensive Stance)
  if (getUser(true).stats.lvl >= SKILL_2_LEVEL) {

    console.log("Mana: " + user.stats.mp);

    // calculate number of valorous presences to cast
    let numPresences = 0;
    let numStances = 0;
    if (saveMana) {
      let reserve = 0;
      if (hasActiveBossQuest()) {
        let str = getTotalStat("str");
        let bossHP = getParty(true).quest.progress.hp || DEFAULT_BOSS_HP;
        reserve = Math.max(Math.ceil((bossHP - user.party.quest.progress.up) / (BRUTAL_SMASH_BASE_DAMAGE * str / (str + BRUTAL_SMASH_STR_DIVISOR))) * MANA_COST_BRUTAL_SMASH, 0);
      }

      console.log("Reserving " + reserve + " mana (finishBossMana)");

      numPresences = Math.max(Math.floor((user.stats.mp - reserve) / MANA_COST_VALOROUS_PRESENCE), 0);
      numStances = Math.max(Math.floor((user.stats.mp - reserve) / MANA_COST_DEFENSIVE_STANCE), 0);
    } else {
      numPresences = Math.floor(user.stats.mp / MANA_COST_VALOROUS_PRESENCE);
      numStances = Math.floor(user.stats.mp / MANA_COST_DEFENSIVE_STANCE);
    }

    // if lvl > SKILL_2_LEVEL, cast valorous presence
    if (user.stats.lvl > SKILL_2_LEVEL) {

      console.log("Casting Valorous Presence " + numPresences + " time(s)");

      for (let i = 0; i < numPresences; i++) {
        fetch("https://habitica.com/api/v3/user/class/cast/valorousPresence", POST_PARAMS);
        if (interruptLoop()) {
          break;
        }
      }

      // if lvl SKILL_2_LEVEL, cast defensive stance
    } else {

      console.log("Player level " + SKILL_2_LEVEL + ", casting Defensive Stance " + numStances + " time(s)");

      for (let i = 0; i < numStances; i++) {
        fetch("https://habitica.com/api/v3/user/class/cast/defensiveStance", POST_PARAMS);
        if (interruptLoop()) {
          break;
        }
      }
    }

    // if lvl < SKILL_2_LEVEL, nothing to cast
  } else {
    console.log("Player level " + user.stats.lvl + ", cannot cast buffs");
  }
}

/**
 * Casts Brutal Smash to finish off an active boss.
 * Run just before cron.
 *
 * @returns {void}
 */
function smashBossAndDumpMana() {

  // if lvl < SKILL_1_LEVEL, nothing to cast
  if (getUser(true).stats.lvl < SKILL_1_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", no skills to cast");
    return;
  }

  console.log("Mana: " + user.stats.mp);

  // if in a party
  if (typeof user.party._id !== "undefined") {

    // if there's an active boss quest and user has non-challenge tasks
    if (hasActiveBossQuest() && getTasks().length > 0) {

      let bossHP = getParty(true).quest.progress.hp || DEFAULT_BOSS_HP;
      console.log("Boss HP: " + bossHP);
      console.log("Pending damage: " + user.party.quest.progress.up);

      // calculate number of brutal smashes to cast
      let str = getTotalStat("str");
      let numSmashes = Math.min(Math.max(Math.ceil((bossHP - user.party.quest.progress.up) / (BRUTAL_SMASH_BASE_DAMAGE * str / (str + BRUTAL_SMASH_STR_DIVISOR))), 0), Math.floor(user.stats.mp / MANA_COST_BRUTAL_SMASH));

      // if casting at least 1 brutal smash
      if (numSmashes > 0) {

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

        console.log("Casting Brutal Smash " + numSmashes + " time(s) on bluest task \"" + bluestTask.text + "\"");

        // cast brutal smash on bluest task
        for (let i = 0; i < numSmashes; i++) {
          fetch("https://habitica.com/api/v3/user/class/cast/smash?targetId=" + bluestTask.id, POST_PARAMS);
          user.stats.mp -= MANA_COST_BRUTAL_SMASH;
        }

        console.log("Mana remaining: " + user.stats.mp);
      }

    // if no boss or no non-challenge tasks
    } else {
      console.log("No boss fight or user has no non-challenge tasks");
    }

    // if not in a party
  } else {
    console.log("Player not in a party, cannot cast Brutal Smash");
  }
}