const PARAMS = {
  headers: {
    "x-api-user": USER_ID,
    "x-api-key": API_TOKEN,
    "x-client": "c4de46a5-e9ba-4d8c-a28f-7f5a3d3d218b-AutomateHabitica+",
  },
  muteHttpExceptions: true,
};
const GET_PARAMS = Object.assign({ method: "get" }, PARAMS);
const POST_PARAMS = Object.assign({ method: "post" }, PARAMS);
const PUT_PARAMS = Object.assign({ method: "put" }, PARAMS);
const DELETE_PARAMS = Object.assign({ method: "delete" }, PARAMS);

const scriptProperties = PropertiesService.getScriptProperties();

const scriptStart = new Date().getTime();

/**
 * Main trigger handler called every 10 minutes.
 * Re-enables disabled webhooks and processes the trigger and queue.
 * 
 * @returns {void}
 * @throws {Error} Sends email notification and rethrows on failure
 */
function onTrigger() {
  try {
    // re-enable disabled webhooks
    reenableWebhooks();

    // process trigger & queue
    processTrigger();
    processQueue();
  } catch (e) {
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      PROJECT_NAME + " failed!",
      e.stack
    );
    console.error(e.stack);
    throw e;
  }
}

/**
 * Webhook handler called by Habitica webhooks.
 * Processes the webhook data and adds appropriate tasks to the queue.
 * 
 * @param {Object} e - Google Apps Script event object
 * @param {Object} e.postData - POST data from the webhook
 * @param {string} e.postData.contents - JSON string of webhook payload
 * @returns {void}
 * @throws {Error} Sends email notification and rethrows on failure (except Address unavailable)
 */
let webhook;
function doPost(e) {
  try {
    webhook = true;

    // get relevant data from webhook
    let postData = JSON.parse(e.postData.contents);
    let webhookData = {
      webhookType: postData.type || postData.webhookType,
    };
    if (webhookData.webhookType == "scored") {
      if (typeof postData.user._tmp.leveledUp !== "undefined") {
        processWebhook({
          webhookType: "leveledUp",
          statPoints: postData.user.stats.points,
          lvl: postData.user._tmp.leveledUp.newLvl,
        });
      }
      Object.assign(webhookData, {
        taskType: postData.task.type,
        isDue: postData.task.isDue,
        gp: postData.user.stats.gp,
        dropType: postData.user._tmp?.drop?.type || null,
      });
    } else if (webhookData.webhookType == "leveledUp") {
      Object.assign(webhookData, {
        lvl: postData.finalLvl,
      });
    } else if (
      webhookData.webhookType == "questInvited" ||
      webhookData.webhookType == "questFinished"
    ) {
      Object.assign(webhookData, {
        questKey: postData.quest.key,
      });
    } else if (webhookData.webhookType == "groupChatReceived") {
      Object.assign(webhookData, {
        groupId: postData.group.id,
      });
    }

    // process webhook
    processWebhook(webhookData);

    // process queue
    processQueue();
  } catch (e) {
    if (!e.stack.includes("Address unavailable")) {
      MailApp.sendEmail(
        Session.getEffectiveUser().getEmail(),
        PROJECT_NAME + " failed!",
        e.stack
      );
      console.error(e.stack);
      throw e;
    }
  }
}

/**
 * Adds functions to the queue based on timing and settings.
 * Handles scheduling for: before cron, after cron, and periodic tasks.
 * 
 * @returns {void}
 */
function processTrigger() {
  // get times
  let now = new Date();
  let properties = scriptProperties.getProperties();
  let timezoneOffset =
    now.getTimezoneOffset() * MS_PER_MINUTE -
    getUser().preferences.timezoneOffset * MS_PER_MINUTE;
  let nowAdjusted = new Date(now.getTime() + timezoneOffset);
  let dayStart = user.preferences.dayStart;
  let dayStartAdjusted = dayStart === 0 ? 24 : dayStart;
  let needsCron = user.needsCron;
  let lastCron = new Date(user.auth.timestamps.loggedin);
  let lastAfterCron = new Date(properties["LAST_AFTER_CRON"] || null);

  // if auto cron and just before day start OR no auto cron and just before hour start and needs cron
  if (
    AUTO_CAST_SKILLS === true &&
    ((nowAdjusted.getHours() == dayStartAdjusted - 1 &&
      39 <= nowAdjusted.getMinutes() &&
      nowAdjusted.getMinutes() < 54) ||
      (AUTO_CRON === false && needsCron === true))
  ) {
    scriptProperties.setProperty("beforeCronSkills", "true");

    // if auto cron and player hasn't cronned today
  } else if (AUTO_CRON === true && needsCron === true) {
    scriptProperties.setProperty("runCron", "true");
    if (AUTO_CAST_SKILLS === true) {
      scriptProperties.deleteProperty("beforeCronSkills");
      scriptProperties.setProperty("afterCronSkills", "true");
    }
    if (AUTO_PURCHASE_GEMS === true) {
      scriptProperties.setProperty("purchaseGems", "true");
    }

    // if player has cronned today and after cron hasn't run since cron
  } else if (
    (AUTO_CAST_SKILLS === true || AUTO_PURCHASE_GEMS === true) &&
    needsCron === false &&
    lastCron.getTime() - lastAfterCron.getTime() > 0
  ) {
    if (AUTO_CAST_SKILLS === true) {
      scriptProperties.deleteProperty("beforeCronSkills");
      scriptProperties.setProperty("afterCronSkills", "true");
    }
    if (AUTO_PURCHASE_GEMS === true) {
      scriptProperties.setProperty("purchaseGems", "true");
    }
    scriptProperties.setProperty("LAST_AFTER_CRON", now);

    // in case GAS execution time limit was reached
  } else if (AUTO_CAST_SKILLS === true) {
    scriptProperties.setProperty("useExcessMana", "true");
  }

  if (
    !installing &&
    ((HIDE_PARTY_NOTIFICATIONS === true &&
      user.party._id !== properties["HIDE_NOTIFICATIONS_PARTY"]) ||
      (HIDE_ALL_GUILD_NOTIFICATIONS === true &&
        user.guilds.join() !== properties["HIDE_NOTIFICATIONS_GUILDS"]))
  ) {
    deleteWebhooks(true);
    createWebhooks(true);
  }
  if (AUTO_CAST_SKILLS === true && user.stats.class == "healer") {
    scriptProperties.setProperty("healParty", "true");
  }
  if (AUTO_PAUSE_RESUME_DAMAGE === true) {
    scriptProperties.setProperty("pauseResumeDamage", "true");
  }
  if (AUTO_ACCEPT_QUEST_INVITES === true) {
    scriptProperties.setProperty("acceptQuestInvite", "true");
  }
  if (FORCE_START_QUESTS === true) {
    scriptProperties.setProperty("forceStartQuest", "true");
  }
  if (AUTO_PARTY_REPORT === true) {
    scriptProperties.setProperty("partyReport", "true");
  }

  // in case GAS execution time limit was reached
  if (AUTO_PURCHASE_ARMOIRES === true) {
    scriptProperties.setProperty("purchaseArmoires", "true");
  }
}

/**
 * Adds functions to the queue based on webhook type and data.
 * 
 * @param {Object} webhookData - Parsed webhook data
 * @param {string} webhookData.webhookType - Type of webhook (scored, leveledUp, questInvited, etc.)
 * @param {string} [webhookData.taskType] - Type of task scored
 * @param {boolean} [webhookData.isDue] - Whether the daily was due
 * @param {number} [webhookData.gp] - Current gold
 * @param {string} [webhookData.dropType] - Type of drop received
 * @param {number} [webhookData.lvl] - New level (for leveledUp)
 * @param {string} [webhookData.questKey] - Quest key (for quest events)
 * @param {string} [webhookData.groupId] - Group ID (for chat events)
 * @returns {void}
 */
function processWebhook(webhookData) {
  // log webhook type
  if (!installing && !reenabling) {
    console.log("Webhook type: " + webhookData.webhookType);
  }

  // when a task is scored
  if (webhookData.webhookType == "scored") {
    if (
      AUTO_PAUSE_RESUME_DAMAGE === true &&
      (typeof webhookData.taskType === "undefined" ||
        (webhookData.taskType == "daily" && webhookData.isDue === true))
    ) {
      scriptProperties.setProperty("pauseResumeDamage", "true");
    }
    if (
      AUTO_PURCHASE_GEMS === true &&
      (typeof webhookData.gp === "undefined" || webhookData.gp >= GOLD_PER_GEM)
    ) {
      scriptProperties.setProperty("purchaseGems", "true");
    }
    if (AUTO_CAST_SKILLS === true) {
      scriptProperties.setProperty("useExcessMana", "true");
    }
    if (
      AUTO_PURCHASE_ARMOIRES === true &&
      (typeof webhookData.gp === "undefined" ||
        webhookData.gp >= RESERVE_GOLD + ARMOIRE_COST)
    ) {
      scriptProperties.setProperty(
        "purchaseArmoires",
        webhookData.gp || "true"
      );
    }
    if (
      AUTO_SELL_EGGS === true &&
      (typeof webhookData.dropType === "undefined" ||
        webhookData.dropType === "Egg" ||
        webhookData.dropType === "All")
    ) {
      scriptProperties.setProperty("sellExtraEggs", "true");
    }
    if (
      AUTO_SELL_HATCHING_POTIONS === true &&
      (typeof webhookData.dropType === "undefined" ||
        webhookData.dropType === "HatchingPotion" ||
        webhookData.dropType === "All")
    ) {
      scriptProperties.setProperty("sellExtraHatchingPotions", "true");
    }
    if (
      AUTO_SELL_FOOD === true &&
      (typeof webhookData.dropType === "undefined" ||
        webhookData.dropType === "Food" ||
        webhookData.dropType === "All")
    ) {
      scriptProperties.setProperty("sellExtraFood", "true");
    }
    if (
      AUTO_HATCH_FEED_PETS === true &&
      (typeof webhookData.dropType === "undefined" ||
        ["Egg", "HatchingPotion", "Food", "All"].includes(webhookData.dropType))
    ) {
      scriptProperties.setProperty("hatchFeedPets", "true");
    }

    // when player levels up
  } else if (webhookData.webhookType == "leveledUp") {
    if (
      AUTO_ALLOCATE_STAT_POINTS === true &&
      (typeof webhookData.lvl === "undefined" ||
        ((typeof webhookData.statPoints === "undefined" ||
          webhookData.statPoints > 0) &&
          webhookData.lvl >= STAT_ALLOCATION_MIN_LEVEL))
    ) {
      scriptProperties.setProperty(
        "allocateStatPoints",
        JSON.stringify(webhookData)
      );
    }
    if (
      AUTO_PAUSE_RESUME_DAMAGE === true &&
      (typeof webhookData.lvl === "undefined" || webhookData.lvl <= LEVEL_CAP_FOR_BONUSES)
    ) {
      scriptProperties.setProperty("pauseResumeDamage", "true");
    }

    // when player is invited to a quest
  } else if (webhookData.webhookType == "questInvited") {
    if (AUTO_PAUSE_RESUME_DAMAGE === true) {
      scriptProperties.setProperty(
        "pauseResumeDamage",
        webhookData.questKey || "true"
      );
    }
    if (AUTO_ACCEPT_QUEST_INVITES === true) {
      scriptProperties.setProperty("acceptQuestInvite", "true");
    }
    if (FORCE_START_QUESTS === true) {
      scriptProperties.setProperty("forceStartQuest", "true");
    }

    // when a quest is started
  } else if (webhookData.webhookType == "questStarted") {
    scriptProperties.setProperty("forceStartQuest", "true");

    // when a quest is finished
  } else if (webhookData.webhookType == "questFinished") {
    if (AUTO_PAUSE_RESUME_DAMAGE === true) {
      scriptProperties.setProperty("pauseResumeDamage", "true");
    }
    if (AUTO_PURCHASE_GEMS === true) {
      scriptProperties.setProperty("purchaseGems", "true");
    }
    if (
      NOTIFY_ON_QUEST_END === true &&
      typeof webhookData.questKey !== "undefined"
    ) {
      scriptProperties.setProperty("notifyQuestEnded", webhookData.questKey);
    }
    if (
      AUTO_INVITE_GOLD_QUESTS === true ||
      AUTO_INVITE_UNLOCKABLE_QUESTS === true ||
      AUTO_INVITE_PET_QUESTS === true ||
      AUTO_INVITE_HOURGLASS_QUESTS === true
    ) {
      let inviteFunction =
        QUEST_INVITE_MODE === "priority"
          ? "invitePriorityQuest"
          : "inviteRandomQuest";
      for (let trigger of ScriptApp.getProjectTriggers()) {
        if (
          trigger.getHandlerFunction() === "inviteRandomQuest" ||
          trigger.getHandlerFunction() === "invitePriorityQuest"
        ) {
          ScriptApp.deleteTrigger(trigger);
        }
      }

      // in priority mode, quests with higher priority will have invites sent sooner
      let waitTime = 0;
      if (QUEST_INVITE_MODE === "priority" && PRIORITY_DELAY_MODE === true) {
        let selectedQuest = selectPriorityQuest();
        if (selectedQuest !== null) {
          waitTime = selectedQuest.completionPercentage / 100;
          console.log("Quest scroll with lowest completion: " + selectedQuest.questName + " (" + selectedQuest.completionPercentage.toFixed(2) + "%%)");
        } else {
          console.log("No priority quest found");
        }
      }
      if (waitTime === 0) {
        waitTime = Math.random();
      }
      let afterMs = waitTime * QUEST_INVITE_RANDOM_DELAY_MS + QUEST_INVITE_MIN_DELAY_MS;
      console.log("Waiting " + (afterMs / 1000 / 60).toFixed(3) + " minutes before inviting quest");
      ScriptApp.newTrigger(inviteFunction).timeBased().after(afterMs).create();
    }
    if (AUTO_PURCHASE_ARMOIRES === true) {
      scriptProperties.setProperty("purchaseArmoires", "true");
    }
    if (AUTO_SELL_EGGS === true) {
      scriptProperties.setProperty("sellExtraEggs", "true");
    }
    if (AUTO_SELL_HATCHING_POTIONS === true) {
      scriptProperties.setProperty("sellExtraHatchingPotions", "true");
    }
    if (AUTO_SELL_FOOD === true) {
      scriptProperties.setProperty("sellExtraFood", "true");
    }
    if (AUTO_HATCH_FEED_PETS === true) {
      scriptProperties.setProperty("hatchFeedPets", "true");
    }
  }
  // when a chat notification is received
  else if (webhookData.webhookType == "groupChatReceived") {
    if (webhookData.groupId === scriptProperties.getProperty("PARTY_ID")) {
      if (HIDE_PARTY_NOTIFICATIONS === true) {
        let triggerNeeded = true;
        for (let trigger of ScriptApp.getProjectTriggers()) {
          if (trigger.getHandlerFunction() === "hidePartyNotification") {
            triggerNeeded = false;
            break;
          }
        }
        if (triggerNeeded) {
          ScriptApp.newTrigger("hidePartyNotification")
            .timeBased()
            .after(1)
            .create();
        }
      }
    } else {
      scriptProperties.setProperty("hideAllNotifications", "true");
    }
  }
}

/**
 * Processes the task queue in priority order.
 * Uses script lock to prevent concurrent execution.
 * All API calls are made within this locked section to prevent collisions.
 * 
 * @returns {void}
 */
function processQueue() {
  try {
    // prevent multiple instances from running at once
    let lock = LockService.getScriptLock();
    if (lock.tryLock(0) || (installing && lock.tryLock(INSTALL_LOCK_TIMEOUT_MS))) {
      while (true) {
        let properties = scriptProperties.getProperties();
        if (properties.hasOwnProperty("hideAllNotifications")) {
          scriptProperties.setProperty("hideAllNotifications", "pending");
          hideAllNotifications();
          if (
            scriptProperties.getProperty("hideAllNotifications") === "pending"
          ) {
            scriptProperties.deleteProperty("hideAllNotifications");
          } else {
            continue;
          }
        }
        let webhookData = properties["allocateStatPoints"];
        if (typeof webhookData !== "undefined") {
          allocateStatPoints(webhookData.points, webhookData.lvl);
          scriptProperties.deleteProperty("allocateStatPoints");
          continue;
        }
        let questKey = properties["pauseResumeDamage"];
        if (typeof questKey !== "undefined") {
          if (questKey === "true") {
            pauseResumeDamage();
          } else {
            pauseResumeDamage(questKey);
          }
          scriptProperties.deleteProperty("pauseResumeDamage");
          continue;
        }
        if (properties.hasOwnProperty("acceptQuestInvite")) {
          acceptQuestInvite();
          scriptProperties.deleteProperty("acceptQuestInvite");
          continue;
        }
        questKey = properties["notifyQuestEnded"];
        if (typeof questKey !== "undefined") {
          notifyQuestEnded(questKey);
          scriptProperties.deleteProperty("notifyQuestEnded");
          continue;
        }
        if (properties.hasOwnProperty("healParty")) {
          healParty();
          scriptProperties.deleteProperty("healParty");
          continue;
        }
        if (properties.hasOwnProperty("runCron")) {
          runCron();
          scriptProperties.deleteProperty("runCron");
          continue;
        }
        if (properties.hasOwnProperty("beforeCronSkills") && !webhook) {
          beforeCronSkills();
          scriptProperties.deleteProperty("beforeCronSkills");
          continue;
        }
        if (properties.hasOwnProperty("afterCronSkills") && !webhook) {
          afterCronSkills();
          scriptProperties.deleteProperty("afterCronSkills");
          continue;
        }
        if (properties.hasOwnProperty("purchaseGems")) {
          purchaseGems();
          scriptProperties.deleteProperty("purchaseGems");
          continue;
        }
        if (properties.hasOwnProperty("forceStartQuest")) {
          forceStartQuest();
          scriptProperties.deleteProperty("forceStartQuest");
          continue;
        }
        if (
          properties.hasOwnProperty("useExcessMana") &&
          !webhook &&
          !installing
        ) {
          useExcessMana();
          scriptProperties.deleteProperty("useExcessMana");
          continue;
        }
        if (properties.hasOwnProperty("sellExtraFood") && !webhook) {
          sellExtraFood();
          scriptProperties.deleteProperty("sellExtraFood");
          continue;
        }
        if (properties.hasOwnProperty("sellExtraHatchingPotions") && !webhook) {
          sellExtraHatchingPotions();
          scriptProperties.deleteProperty("sellExtraHatchingPotions");
          continue;
        }
        if (properties.hasOwnProperty("sellExtraEggs") && !webhook) {
          sellExtraEggs();
          scriptProperties.deleteProperty("sellExtraEggs");
          continue;
        }
        if (
          properties.hasOwnProperty("hatchFeedPets") &&
          !webhook &&
          !installing
        ) {
          if (HATCH_FEED_MODE === "priority") {
            hatchFeedPetsPriority();
          } else {
            hatchFeedPets();
          }
          scriptProperties.deleteProperty("hatchFeedPets");
          continue;
        }
        let gold = properties["purchaseArmoires"];
        if (typeof gold !== "undefined" && !webhook && !installing) {
          if (gold === "true") {
            purchaseArmoires();
          } else {
            purchaseArmoires(Number(gold));
          }
          scriptProperties.deleteProperty("purchaseArmoires");
          continue;
        }
        if (properties.hasOwnProperty("partyReport") && !webhook && !installing) {
          partyReport();
          scriptProperties.deleteProperty("partyReport");
          continue;
        }
        break;
      }

      lock.releaseLock();
    }
  } catch (e) {
    if (
      !e.stack.includes(
        "There are too many LockService operations against the same script"
      ) &&
      !e.stack.includes(
        "We're sorry, a server error occurred. Please wait a bit and try again."
      )
    ) {
      throw e;
    }
  }
}

/**
 * Checks for urgent tasks that should interrupt a long-running loop.
 * Call after each iteration of an indefinite loop.
 * 
 * @returns {boolean|undefined} True if loop should stop early to avoid timeout, undefined otherwise
 */
function interruptLoop() {
  while (true) {
    let properties = scriptProperties.getProperties();
    if (properties.hasOwnProperty("hideAllNotifications")) {
      scriptProperties.setProperty("hideAllNotifications", "pending");
      hideAllNotifications();
      if (scriptProperties.getProperty("hideAllNotifications") === "pending") {
        scriptProperties.deleteProperty("hideAllNotifications");
      } else {
        continue;
      }
    }
    let questKey = properties["pauseResumeDamage"];
    if (typeof questKey !== "undefined") {
      if (questKey === "true") {
        pauseResumeDamage();
      } else {
        pauseResumeDamage(questKey);
      }
      scriptProperties.deleteProperty("pauseResumeDamage");
    }
    if (properties.hasOwnProperty("acceptQuestInvite")) {
      acceptQuestInvite();
      scriptProperties.deleteProperty("acceptQuestInvite");
    }
    questKey = properties["notifyQuestEnded"];
    if (typeof questKey !== "undefined") {
      notifyQuestEnded(questKey);
      scriptProperties.deleteProperty("notifyQuestEnded");
    }
    break;
  }
  if (new Date().getTime() - scriptStart > SCRIPT_TIMEOUT_MS) {
    return true;
  }
}

/**
 * Attacks the boss and uses up mana that will be lost at cron.
 * Run just before day start, at least 6 mins before (max GAS run time).
 * 
 * @param {boolean} [retry] - Whether this is a retry attempt after skill not found error
 * @returns {void}
 */
function beforeCronSkills(retry) {
  try {
    let playerClass = getUser().stats.class;
    if (playerClass == "warrior") {
      smashBossAndDumpMana();
    } else if (playerClass == "wizard") {
      burnBossAndDumpMana();
    } else if (playerClass == "healer") {
      castProtectiveAura(true);
    } else if (playerClass == "rogue") {
      castStealthAndDumpMana();
    }
  } catch (e) {
    if (!retry && e.stack.match(/Skill \\"[A-Za-z]+\\" not found/) !== null) {
      getUser(true);
      beforeCronSkills(true);
    } else {
      throw e;
    }
  }
}

/**
 * Casts buffs until all mana is used up.
 * Run just after the player's cron.
 * 
 * @param {boolean} [retry] - Whether this is a retry attempt after skill not found error
 * @returns {void}
 */
function afterCronSkills(retry) {
  try {
    let playerClass = getUser().stats.class;
    if (playerClass == "warrior") {
      castValorousPresence(false);
    } else if (playerClass == "wizard") {
      castEarthquake(false);
    } else if (playerClass == "healer") {
      castProtectiveAura(false);
    } else if (playerClass == "rogue") {
      castToolsOfTheTrade(false);
    }
  } catch (e) {
    if (!retry && e.stack.match(/Skill \\"[A-Za-z]+\\" not found/) !== null) {
      getUser(true);
      afterCronSkills(true);
    } else {
      throw e;
    }
  }
}

/**
 * Uses excess mana to cast buffs.
 * Reserves mana that will remain after cron, plus enough for 3000 boss damage.
 * 
 * @param {boolean} [retry] - Whether this is a retry attempt after skill not found error
 * @returns {void}
 */
function useExcessMana(retry) {
  try {
    let playerClass = getUser().stats.class;
    if (playerClass == "warrior") {
      castValorousPresence(true);
    } else if (playerClass == "wizard") {
      castEarthquake(true);
    } else if (playerClass == "healer") {
      castProtectiveAura(false);
    } else if (playerClass == "rogue") {
      castToolsOfTheTrade(true);
    }
  } catch (e) {
    if (!retry && e.stack.match(/Skill \\"[A-Za-z]+\\" not found/) !== null) {
      getUser(true);
      useExcessMana(true);
    } else {
      throw e;
    }
  }
}

/**
 * Wrapper for UrlFetchApp.fetch with retry logic and rate limiting.
 * Retries failed API calls up to 2 times, handles server downtime,
 * and respects Habitica's rate limiting.
 * 
 * @see https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app#fetchurl,-params
 * @param {string} url - The URL to fetch
 * @param {Object} params - Fetch parameters (method, headers, etc.)
 * @returns {GoogleAppsScript.URL_Fetch.HTTPResponse} The API response
 * @throws {Error} On 3xx/4xx errors or after 3 failed attempts for 5xx errors
 */
let rateLimitRemaining;
let rateLimitReset;
let apiResponseTime;
function fetch(url, params) {
  // try up to 3 times
  for (let i = 0; i < 3; i++) {
    // get rate limiting data
    let properties = scriptProperties.getProperties();
    let spaceOutAPICalls = true;
    if (
      properties.hasOwnProperty("hideAllNotifications") ||
      properties.hasOwnProperty("acceptQuestInvite") ||
      properties.hasOwnProperty("notifyQuestEnded")
    ) {
      spaceOutAPICalls = false;
    }
    if (
      typeof rateLimitRemaining !== "undefined" &&
      (spaceOutAPICalls || Number(rateLimitRemaining < 1))
    ) {
      // space out API calls
      let waitUntil = new Date(rateLimitReset);
      waitUntil.setSeconds(waitUntil.getSeconds() + 1);
      Utilities.sleep(
        Math.max(
          Math.max(waitUntil.getTime() - new Date().getTime(), 0) /
          (Number(rateLimitRemaining) + 1) -
          apiResponseTime,
          0
        )
      );
    }

    // call API
    let response;
    while (true) {
      try {
        let beforeCalling = new Date();
        response = UrlFetchApp.fetch(url, params);
        apiResponseTime = new Date().getTime() - beforeCalling.getTime();
        break;

        // if address unavailable, wait and try again
      } catch (e) {
        if (!webhook && e.stack.includes("Address unavailable")) {
          Utilities.sleep(SERVER_RETRY_DELAY_MS);
        } else {
          throw e;
        }
      }
    }

    // store rate limiting data
    rateLimitRemaining = response.getHeaders()["x-ratelimit-remaining"];
    rateLimitReset = response.getHeaders()["x-ratelimit-reset"];

    // if success, return response
    if (
      response.getResponseCode() < HTTP_SUCCESS_MAX ||
      (response.getResponseCode() === 404 &&
        (url === "https://habitica.com/api/v3/groups/party" ||
          url.startsWith("https://habitica.com/api/v3/groups/party/members")))
    ) {
      return response;

      // if rate limited due to running multiple scripts, try again
    } else if (response.getResponseCode() === HTTP_RATE_LIMITED) {
      i--;

      // if 3xx or 4xx or failed 3 times, throw exception
    } else if (response.getResponseCode() < HTTP_SERVER_ERROR_MIN || i >= 2) {
      throw new Error(
        "Request failed for https://habitica.com returned code " +
        response.getResponseCode() +
        ". Truncated server response: " +
        response.getContentText()
      );
    }
  }
}

/**
 * Returns the total value of a stat including level, buffs, allocated, and equipment.
 * 
 * @param {string} stat - The stat to calculate: "int", "con", "per", or "str"
 * @returns {number} Total stat value
 */
function getTotalStat(stat) {
  // INT is easy to calculate with a simple formula
  if (stat == "int") {
    return (getUser(true).stats.maxMP - BASE_MANA) / 2;
  }

  // calculate stat from level, buffs, allocated
  let levelStat = Math.min(Math.floor(getUser(true).stats.lvl / 2), MAX_LEVEL_STAT_BONUS);
  let equipmentStat = 0;
  let buffsStat = user.stats.buffs[stat];
  let allocatedStat = user.stats[stat];

  // calculate stat from equipment
  for (let equipped of Object.values(user.items.gear.equipped)) {
    let equipment = getContent().gear.flat[equipped];
    if (typeof equipment !== "undefined") {
      equipmentStat += equipment[stat];
      if (
        equipment.klass == user.stats.class ||
        (equipment.klass == "special" &&
          equipment.specialClass == user.stats.class)
      ) {
        equipmentStat += equipment[stat] / 2;
      }
    }
  }

  // add all stat together and return
  return levelStat + equipmentStat + allocatedStat + buffsStat;
}

/**
 * Calculates the player's perfect day buff.
 * 
 * @see https://habitica.fandom.com/wiki/Perfect_Day
 * @returns {number} Perfect day buff value (0 if any daily is incomplete)
 */
function calculatePerfectDayBuff() {
  for (let daily of getDailies()) {
    if (daily.isDue && !daily.completed) {
      return 0;
    }
  }
  return Math.min(Math.ceil(getUser().stats.lvl / 2), MAX_LEVEL_STAT_BONUS);
}

/**
 * Fetches user data from the Habitica API.
 * Caches the result for subsequent calls within the same execution.
 * 
 * @param {boolean} [updated] - Force refresh from API even if cached
 * @returns {Object} User data object from Habitica API
 */
let user;
function getUser(updated) {
  if (updated || typeof user === "undefined") {
    for (let i = 0; i < 3; i++) {
      user = fetch("https://habitica.com/api/v3/user", GET_PARAMS);
      try {
        user = JSON.parse(user).data;
        if (typeof user.party?._id !== "undefined") {
          scriptProperties.setProperty("PARTY_ID", user.party._id);
        }
        break;
      } catch (e) {
        if (
          i < 2 &&
          (e.stack.includes("Unterminated string in JSON") ||
            e.stack.includes(
              "Expected ',' or '}' after property value in JSON at position"
            ) ||
            e.stack.includes(
              "Expected double-quoted property name in JSON at position"
            ))
        ) {
          continue;
        } else {
          throw e;
        }
      }
    }
    let savedPlayerClass = scriptProperties.getProperty("PLAYER_CLASS");
    let playerClass = user.stats.class;
    if (playerClass == "wizard") {
      playerClass = "mage";
    }
    if (playerClass != savedPlayerClass) {
      if (savedPlayerClass !== null) {
        console.log(
          "Player class changed to " + playerClass + ", saving new class"
        );
      }
      scriptProperties.setProperty("PLAYER_CLASS", playerClass);
      if (AUTO_ALLOCATE_STAT_POINTS === true) {
        allocateStatPoints();
      }
    }
  }
  return user;
}

/**
 * Fetches task data from the Habitica API.
 * Removes challenge tasks, group tasks, and rewards from the task list.
 * Caches dailies in a separate object for getDailies().
 * 
 * @returns {Object[]} Array of task objects (excludes rewards, challenge, and group tasks)
 */
let tasks;
function getTasks() {
  if (typeof tasks === "undefined") {
    for (let i = 0; i < 3; i++) {
      tasks = fetch("https://habitica.com/api/v3/tasks/user", GET_PARAMS);
      try {
        tasks = JSON.parse(tasks).data;
        break;
      } catch (e) {
        if (
          i < 2 &&
          (e.stack.includes("Unterminated string in JSON") ||
            e.stack.includes(
              "Expected ',' or '}' after property value in JSON at position"
            ) ||
            e.stack.includes(
              "Expected double-quoted property name in JSON at position"
            ))
        ) {
          continue;
        } else {
          throw e;
        }
      }
    }
    dailies = [];
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].type == "reward") {
        tasks.splice(i, 1);
        i--;
      } else {
        if (tasks[i].type == "daily") {
          dailies.push(tasks[i]);
        }
        if (
          typeof tasks[i].challenge.id !== "undefined" ||
          typeof tasks[i].group.id !== "undefined"
        ) {
          tasks.splice(i, 1);
          i--;
        }
      }
    }
  }
  return tasks;
}

/**
 * Returns daily tasks from cached data.
 * Fetches from API via getTasks() if not already cached.
 * 
 * @returns {Object[]} Array of daily task objects
 */
let dailies;
function getDailies() {
  if (typeof dailies === "undefined") {
    getTasks();
  }
  return dailies;
}

/**
 * Fetches party data from the Habitica API.
 * Caches the result for subsequent calls within the same execution.
 * 
 * @param {boolean} [updated] - Force refresh from API even if cached
 * @returns {Object} Party data object from Habitica API
 */
let party;
function getParty(updated) {
  if (updated || typeof party === "undefined") {
    party = JSON.parse(
      fetch("https://habitica.com/api/v3/groups/party", GET_PARAMS)
    ).data;
  }
  return party;
}

/**
 * Fetches party member data from the Habitica API.
 * Includes all public fields for each member.
 * Caches the result for subsequent calls within the same execution.
 * 
 * @param {boolean} [updated] - Force refresh from API even if cached
 * @returns {Object[]} Array of party member data objects
 */
let members;
function getMembers(updated) {
  if (updated || typeof members === "undefined") {
    for (let i = 0; i < 3; i++) {
      members = fetch(
        "https://habitica.com/api/v3/groups/party/members?includeAllPublicFields=true",
        GET_PARAMS
      );
      try {
        members = JSON.parse(members).data;
        break;
      } catch (e) {
        if (
          i < 2 &&
          (e.stack.includes("Unterminated string in JSON") ||
            e.stack.includes(
              "Expected ',' or '}' after property value in JSON at position"
            ) ||
            e.stack.includes(
              "Expected double-quoted property name in JSON at position"
            ))
        ) {
          continue;
        } else {
          throw e;
        }
      }
    }
  }
  return members;
}

/**
 * Fetches Habitica game content data from the API.
 * Contains all game items, pets, quests, gear, etc.
 * Caches the result for subsequent calls within the same execution.
 * 
 * @param {boolean} [updated] - Force refresh from API even if cached
 * @returns {Object} Content data object from Habitica API
 */
let content;
function getContent(updated) {
  if (updated || typeof content === "undefined") {
    for (let i = 0; i < 3; i++) {
      content = fetch("https://habitica.com/api/v3/content", GET_PARAMS);
      try {
        content = JSON.parse(content).data;
        break;
      } catch (e) {
        if (
          i < 2 &&
          (e.stack.includes("Unterminated string in JSON") ||
            e.stack.includes(
              "Expected ',' or '}' after property value in JSON at position"
            ) ||
            e.stack.includes(
              "Expected double-quoted property name in JSON at position"
            ))
        ) {
          continue;
        } else {
          throw e;
        }
      }
    }
  }
  return content;
}

/**
 * Calculates quest completion percentages for the party.
 * Adapted from Quest Tracker by @bumbleshoot.
 * 
 * @returns {{questKey: string, questName: string, completionPercentage: number}[]} Array of quest completion data
 */
function getQuestCompletionData() {
  // if no party, party = user
  let partyMembers;
  if (typeof getMembers() === "undefined") {
    partyMembers = [getUser()];
  } else {
    partyMembers = members;
  }

  // get # each egg & hatching potion owned/used for each member
  for (let member of partyMembers) {
    member.numEachEggOwnedUsed = Object.assign({}, member.items.eggs);
    member.numEachPotionOwnedUsed = Object.assign(
      {},
      member.items.hatchingPotions
    );
    for (let [pet, amount] of Object.entries(member.items.pets)) {
      if (amount > 0) {
        // 5 = newly hatched pet, >5 = fed pet, -1 = mount but no pet
        pet = pet.split("-");
        let species = pet[0];
        let color = pet[1];
        if (member.numEachEggOwnedUsed.hasOwnProperty(species)) {
          member.numEachEggOwnedUsed[species] =
            member.numEachEggOwnedUsed[species] + 1;
        } else {
          member.numEachEggOwnedUsed[species] = 1;
        }
        if (member.numEachPotionOwnedUsed.hasOwnProperty(color)) {
          member.numEachPotionOwnedUsed[color] =
            member.numEachPotionOwnedUsed[color] + 1;
        } else {
          member.numEachPotionOwnedUsed[color] = 1;
        }
      }
    }
    for (let mount of Object.keys(member.items.mounts)) {
      mount = mount.split("-");
      let species = mount[0];
      let color = mount[1];
      if (member.numEachEggOwnedUsed.hasOwnProperty(species)) {
        member.numEachEggOwnedUsed[species] =
          member.numEachEggOwnedUsed[species] + 1;
      } else {
        member.numEachEggOwnedUsed[species] = 1;
      }
      if (member.numEachPotionOwnedUsed.hasOwnProperty(color)) {
        member.numEachPotionOwnedUsed[color] =
          member.numEachPotionOwnedUsed[color] + 1;
      } else {
        member.numEachPotionOwnedUsed[color] = 1;
      }
    }
  }

  // get lists of premium eggs, premium hatching potions & wacky hatching potions
  let premiumEggs = [];
  for (let egg of Object.values(getContent().questEggs)) {
    premiumEggs.push(egg.key);
  }
  let premiumHatchingPotions = [];
  for (let potion of Object.values(content.premiumHatchingPotions)) {
    premiumHatchingPotions.push(potion.key);
  }
  let wackyHatchingPotions = [];
  for (let potion of Object.values(content.wackyHatchingPotions)) {
    wackyHatchingPotions.push(potion.key);
  }

  // calculate completion data for each quest
  let questCompletionData = [];

  for (let quest of Object.values(content.quests)) {
    // if world boss, skip it
    if (quest.category == "world") {
      continue;
    }

    // get rewards
    let rewards = [];
    if (typeof quest.drop.items !== "undefined") {
      for (let drop of quest.drop.items) {
        let rewardName = drop.text;
        let rewardType = "";

        if (drop.type == "eggs" && premiumEggs.includes(drop.key)) {
          rewardName = content.eggs[drop.key].text + " Egg";
          rewardType = "egg";
        } else if (
          drop.type == "hatchingPotions" &&
          premiumHatchingPotions.includes(drop.key)
        ) {
          rewardType = "hatchingPotion";
        } else if (
          drop.type == "hatchingPotions" &&
          wackyHatchingPotions.includes(drop.key)
        ) {
          rewardType = "wackyPotion";
        } else if (drop.type == "mounts") {
          rewardType = "mount";
        } else if (drop.type == "pets") {
          rewardType = "pet";
        } else if (drop.type == "gear") {
          rewardType = "gear";
        }

        if (rewardType != "") {
          let index = rewards.findIndex((reward) => reward.name == rewardName);
          if (index == -1) {
            rewards.push({
              key: drop.key,
              name: rewardName,
              type: rewardType,
              qty: 1,
            });
          } else {
            rewards[index].qty++;
          }
        }
      }
    }

    // get completions needed & completions (individual)
    let neededIndividual;
    let totalCompletions = 0;
    let totalNeeded = 0;

    if (rewards.length > 0 && rewards[0].type == "egg") {
      neededIndividual = EGGS_FOR_COMPLETE_SPECIES / rewards[0].qty;
      for (let member of partyMembers) {
        if (typeof member.numEachEggOwnedUsed[rewards[0].key] === "undefined") {
          member.numEachEggOwnedUsed[rewards[0].key] = 0;
        }
        let timesCompleted = Math.min(
          member.numEachEggOwnedUsed[rewards[0].key] / rewards[0].qty,
          neededIndividual
        );
        let completedCount = Math.floor(
          (Math.ceil(neededIndividual) * timesCompleted) / neededIndividual
        );
        totalCompletions += completedCount;
        totalNeeded += Math.ceil(neededIndividual);
      }
    } else if (
      rewards.length > 0 &&
      (rewards[0].type == "hatchingPotion" || rewards[0].type == "wackyPotion")
    ) {
      if (rewards[0].type == "hatchingPotion") {
        neededIndividual = POTIONS_FOR_COMPLETE_PREMIUM / rewards[0].qty;
      } else {
        neededIndividual = POTIONS_FOR_COMPLETE_WACKY / rewards[0].qty;
      }
      for (let member of partyMembers) {
        if (
          typeof member.numEachPotionOwnedUsed[rewards[0].key] === "undefined"
        ) {
          member.numEachPotionOwnedUsed[rewards[0].key] = 0;
        }
        let timesCompleted = Math.min(
          member.numEachPotionOwnedUsed[rewards[0].key] / rewards[0].qty,
          neededIndividual
        );
        let completedCount = Math.floor(
          (Math.ceil(neededIndividual) * timesCompleted) / neededIndividual
        );
        totalCompletions += completedCount;
        totalNeeded += Math.ceil(neededIndividual);
      }
    } else {
      neededIndividual = 1;
      for (let member of partyMembers) {
        let timesCompleted = 0;
        for (let [questKey, completions] of Object.entries(
          member.achievements.quests
        )) {
          if (questKey == quest.key) {
            timesCompleted = Math.min(completions, neededIndividual);
            break;
          }
        }
        totalCompletions += timesCompleted;
        totalNeeded += Math.ceil(neededIndividual);
      }
    }

    // calculate completion percentage
    let completionPercentage =
      totalNeeded > 0 ? (totalCompletions / totalNeeded) * 100 : 0;

    questCompletionData.push({
      questKey: quest.key,
      questName: quest.text,
      completionPercentage: completionPercentage,
    });
  }

  return questCompletionData;
}

/**
 * Checks and re-enables any disabled webhooks.
 * Adds missed webhook tasks to the queue.
 * Temporary workaround until Google allows manual API responses in GAS.
 * 
 * @returns {void}
 */
let reenabling;
function reenableWebhooks() {
  // for each Automate Habitica webhook
  for (let webhook of JSON.parse(
    fetch("https://habitica.com/api/v3/user/webhook", GET_PARAMS)
  ).data) {
    if (webhook.url === WEB_APP_URL) {
      // if disabled
      if (!webhook.enabled) {
        reenabling = true;

        console.log(webhook.type + " webhook disabled, re-enabling...");

        // re-enable webhook
        let params = Object.assign(
          {
            contentType: "application/json",
            payload: JSON.stringify({
              enabled: true,
            }),
          },
          PUT_PARAMS
        );
        fetch("https://habitica.com/api/v3/user/webhook/" + webhook.id, params);

        // add webhook tasks to the queue
        let enabledTypes = [];
        if (webhook.hasOwnProperty("options")) {
          for (const [option, enabled] of Object.entries(webhook.options)) {
            if (enabled === true) {
              enabledTypes.push(option);
            }
          }
        }
        if (enabledTypes.length === 0) {
          enabledTypes.push(webhook.type);
        }
        if (
          enabledTypes.includes("scored") &&
          !enabledTypes.includes("leveledUp")
        ) {
          enabledTypes.push("leveledUp");
        }
        for (const type of enabledTypes) {
          console.log("Adding " + type + " webhook tasks to the queue...");

          processWebhook({ webhookType: type });
        }
        reenabling = false;
      }
    }
  }
}
