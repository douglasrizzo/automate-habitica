/**
 * Casts Protective Aura until excess mana is used up.
 * Reserves mana for party healing. If beforeCron is true, dumps mana before cron.
 * 
 * @see https://habitica.fandom.com/wiki/Mana_Points#Restoring_Mana
 * @param {boolean} beforeCron - If true, ensure mana is dumped before cron resets it
 * @returns {void}
 */
function castProtectiveAura(beforeCron) {

  // if time limit or lvl < SKILL_3_LEVEL, return
  if (webhook || installing) {
    return;
  } else if (getUser(true).stats.lvl < SKILL_3_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", cannot cast Protective Aura");
    return;
  }

  console.log("Mana: " + user.stats.mp);

  // calculate number of protective auras to cast
  let int = getTotalStat("int");
  let con = getTotalStat("con");
  let healPartyMana = (Math.ceil(MAX_HP / ((con + int + BLESSING_STAT_BONUS) * BLESSING_HEAL_MULTIPLIER)) * MANA_COST_BLESSING) * HEALING_RESERVE_HOURS;
  let reserveMessage = "Reserving " + healPartyMana + " mana for healing the party";
  let numAuras = Math.max(Math.floor((user.stats.mp - healPartyMana) / MANA_COST_PROTECTIVE_AURA), 0);
  if (beforeCron) {
    let maxManaAfterCron = ((int - user.stats.buffs.int + Math.min(Math.ceil(user.stats.lvl / 2), MAX_LEVEL_STAT_BONUS)) * 2 + BASE_MANA) * MANA_RETENTION_RATE;
    if (maxManaAfterCron < healPartyMana) {
      numAuras = Math.max(Math.ceil((user.stats.mp - maxManaAfterCron) / MANA_COST_PROTECTIVE_AURA), 0);
      reserveMessage = "Reserving no more than " + maxManaAfterCron + " mana for after cron";
    }
  }

  console.log(reserveMessage);
  console.log("Casting Protective Aura " + numAuras + " time(s)");

  // cast protective aura
  for (let i = 0; i < numAuras; i++) {
    fetch("https://habitica.com/api/v3/user/class/cast/protectAura", POST_PARAMS);
    if (interruptLoop()) {
      break;
    }
  }

  // if player is asleep, pause or resume damage
  if (AUTO_PAUSE_RESUME_DAMAGE === true && user.preferences.sleep) {
    scriptProperties.setProperty("pauseResumeDamage", "true");
  }
}

/**
 * Casts Blessing to heal party members, then Healing Light for self.
 * Run every 10 mins.
 * 
 * @returns {void}
 */
function healParty() {

  // if lvl < SKILL_1_LEVEL, return
  if (getUser(true).stats.lvl < SKILL_1_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", cannot cast healing skills");
    return;
  }

  let con = getTotalStat("con");
  let int = getTotalStat("int");

  // if lvl >= SKILL_4_LEVEL & in a party with other players
  let numBlessings = 0;
  if (user.stats.lvl >= SKILL_4_LEVEL && typeof getMembers() !== "undefined" && members.length > 1) {

    // get lowest party member health (excluding player)
    let lowestMemberHealth = MAX_HP;
    for (let member of members) {
      if (member._id !== USER_ID && member.stats.hp < lowestMemberHealth) {
        lowestMemberHealth = member.stats.hp;
      }
    }

    // calculate number of blessings to cast
    let healthPerBlessing = (con + int + BLESSING_STAT_BONUS) * BLESSING_HEAL_MULTIPLIER;
    numBlessings = Math.min(Math.ceil((MAX_HP - lowestMemberHealth) / healthPerBlessing), Math.floor(user.stats.mp / MANA_COST_BLESSING));

    // cast blessing
    if (numBlessings > 0) {

      console.log("Mana: " + user.stats.mp);
      console.log("Lowest party member health: " + lowestMemberHealth);
      console.log("Casting Blessing " + numBlessings + " time(s)");

      for (let i = 0; i < numBlessings; i++) {
        fetch("https://habitica.com/api/v3/user/class/cast/healAll", POST_PARAMS);
        user.stats.mp -= MANA_COST_BLESSING;
        user.stats.hp += healthPerBlessing;
      }
      user.stats.hp = Math.min(user.stats.hp, MAX_HP);
    }

    // if lvl < SKILL_4_LEVEL or not in a party, nothing to cast
  } else if (user.stats.lvl < SKILL_4_LEVEL) {
    console.log("Player level " + user.stats.lvl + ", cannot cast Blessing");
  }

  // calculate number of healing lights to cast
  let numLights = Math.min(Math.max(Math.ceil((MAX_HP - user.stats.hp) / ((con + int + BLESSING_STAT_BONUS) * HEALING_LIGHT_MULTIPLIER)), 0), Math.floor(user.stats.mp / MANA_COST_HEALING_LIGHT));

  // cast healing light
  if (numLights > 0) {

    console.log("Mana: " + user.stats.mp);
    console.log("Player health: " + user.stats.hp);
    console.log("Casting Healing Light " + numLights + " time(s)");

    for (let i = 0; i < numLights; i++) {
      try {
        fetch("https://habitica.com/api/v3/user/class/cast/heal", POST_PARAMS);
      } catch (e) {
        if (!e.stack.includes("You already have maximum health")) {
          throw e
        }
      }
    }
  }

  // if sleeping & healed, pause or resume damage
  if (AUTO_PAUSE_RESUME_DAMAGE === true && user.preferences.sleep && (numBlessings > 0 || numLights > 0)) {
    scriptProperties.setProperty("pauseResumeDamage", "true");
  }
}