/**
 * Calculates pending damage and auto-pauses/resumes damage.
 * Checks player into inn if damage exceeds MAX_PLAYER_DAMAGE or MAX_PARTY_DAMAGE.
 * Checks player out of inn when damage is safe.
 * 
 * @param {string} [questKey] - Quest key to use for damage calculation (defaults to current quest)
 * @returns {void}
 */
function pauseResumeDamage(questKey) {

  let damageToPlayer = 0;
  let damageToParty = 0;
  let stealth = getUser(true).stats.buffs.stealth;
  let quest = questKey || user.party.quest.key;
  let boss;
  if (quest) {
    boss = getContent().quests[quest].boss;
  }
  let bossStr = 4;
  if (typeof boss !== "undefined") {
    bossStr = boss.str;
  }
  let con = getTotalStat("con");

  // for each daily
  for (let daily of getDailies()) {

    // if due & incomplete
    if (daily.isDue && !daily.completed) {

      // if stealth remaining, skip daily
      if (stealth > 0) {
        stealth--;
        continue;
      }

      // calculate value
      let taskValue = Math.min(Math.max(daily.value, -47.27), 21.27);

      // calculate damage value
      let delta = Math.abs(Math.pow(0.9747, taskValue));
      if (daily.checklist.length > 0) {
        let subtasksDone = 0;
        for (let subtask of daily.checklist) {
          if (subtask.completed) {
            subtasksDone++;
          }
        }
        delta *= (1 - subtasksDone / daily.checklist.length);
      }

      // if in a party and fighting a boss or not on a quest
      if (typeof user.party._id !== "undefined" && (typeof boss !== "undefined" || !quest)) {

        // calculate damage to party
        let bossDelta = delta;
        if (daily.priority < 1) {
            bossDelta *= daily.priority;
        }
        damageToParty += bossDelta * bossStr;
      }

      // calculate damage to player
      damageToPlayer += Math.round(delta * daily.priority * 2 * Math.max(0.1, 1 - (con / 250)) * 10) / 10;
    }
  }

  // add up & round damage values
  let damageTotal = Math.ceil((damageToPlayer + damageToParty) * 10) / 10;
  damageToPlayer = Math.ceil(damageToPlayer  * 10) / 10;
  if (typeof getMembers(true) !== "undefined" && members.length > 1) {
    damageToParty = Math.ceil(damageToParty * 10) / 10;
  } else {
    damageToParty = 0;
  }

  console.log("Pending damage to player: " + damageTotal);
  console.log("Pending damage to party: " + damageToParty);

  // if fighting a boss
  let hp = user.stats.hp;
  if (typeof boss !== "undefined") {

    // get lowest party member health
    let lowestHealth = 50;
    for (let member of members || []) {
      if (member.stats.hp < lowestHealth) {
        lowestHealth = member.stats.hp;
      }
    }

    // if damage to party greater than threshold or lowest hp, or total damage greater than threshold or hp, sleep, otherwise wake up
    if (damageToParty > MAX_PARTY_DAMAGE || damageToParty >= lowestHealth || damageTotal > MAX_PLAYER_DAMAGE || damageTotal >= hp) {
      sleep();
    } else {
      wakeUp();
    }

  // if on a collection quest or not on a quest
  } else {

    // if damage to player greater than threshold or hp, sleep, otherwise wake up
    if (damageToPlayer > Math.min(MAX_PLAYER_DAMAGE, hp)) {
      sleep();
    } else {
      wakeUp();
    }
  }

  /**
   * Checks player into the inn (pauses damage).
   * @returns {void}
   */
  function sleep() {
    if (!user.preferences.sleep) {

      console.log("Going to sleep");

      fetch("https://habitica.com/api/v3/user/sleep", POST_PARAMS);

      // update user data
      user.preferences.sleep = false;

    } else {

      console.log("Staying asleep");

    }
  }

  /**
   * Checks player out of the inn (resumes damage).
   * @returns {void}
   */
  function wakeUp() {
    if (user.preferences.sleep) {

      console.log("Waking up");

      fetch("https://habitica.com/api/v3/user/sleep", POST_PARAMS);

      // update user data
      user.preferences.sleep = true;

    } else {

      console.log("Staying awake");

    }
  }
}