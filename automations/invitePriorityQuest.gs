/**
 * Chooses the quest scroll with lowest party completion percentage and invites party.
 * Respects AUTO_INVITE_* settings and BANNED_SCROLLS list.
 * Run via a delayed trigger after quest completion (see QUEST_INVITE_BASE_DELAY_MS/QUEST_INVITE_RIVAL_INCREMENT_MS).
 * 
 * @returns {void}
 * @throws {Error} Sends email notification and rethrows on failure
 */
function invitePriorityQuest() {
  try {
    // delete temporary trigger
    for (let trigger of ScriptApp.getProjectTriggers()) {
      if (trigger.getHandlerFunction() === "invitePriorityQuest") {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // if not in a party or party is on a quest, return
    if (
      typeof getParty(true) === "undefined" ||
      typeof party.quest.key !== "undefined"
    ) {
      return;
    }

    let selectedQuest = selectPriorityQuest();
    if (selectedQuest !== null) {
      console.log(
        "Selected: " +
        selectedQuest.questName +
        " (completion: " +
        Math.floor(selectedQuest.completionPercentage) +
        "%)"
      );

      // invite party to the selected quest
      fetch(
        "https://habitica.com/api/v3/groups/party/quests/invite/" +
        selectedQuest.questKey,
        POST_PARAMS
      );

      scriptProperties.deleteProperty("QUEST_SCROLL_PM_SENT");
    }

    // send player a PM if they are out of usable quest scrolls
    if (
      PM_WHEN_OUT_OF_QUEST_SCROLLS === true &&
      selectedQuest === null &&
      scriptProperties.getProperty("QUEST_SCROLL_PM_SENT") === null
    ) {
      console.log("No more usable quest scrolls, sending PM to player");

      let params = Object.assign(
        {
          contentType: "application/json",
          payload: JSON.stringify({
            message: "You have no more usable quest scrolls!",
            toUserId: USER_ID,
          }),
        },
        POST_PARAMS
      );
      fetch("https://habitica.com/api/v3/members/send-private-message", params);

      scriptProperties.setProperty("QUEST_SCROLL_PM_SENT", "true");
    }
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
 * Determines whether a quest scroll would be eligible for auto-invite selection under
 * the current AUTO_INVITE_* settings and BANNED_SCROLLS list -- regardless of who owns it.
 * Used both to filter the player's own scrolls and to check other party members' scrolls
 * when counting rivals, so "eligible" always means "this script would actually invite it."
 *
 * @param {string} questKey - Quest content key
 * @param {Object[]} questCompletionData - Precomputed party quest completion data (from getQuestCompletionData())
 * @returns {boolean} True if a scroll for this quest could be auto-invited
 */
function isQuestScrollEligible(questKey, questCompletionData) {
  let questContent = getContent().quests[questKey];
  if (!questContent) {
    // guards stale/removed quest keys that may appear in another member's inventory
    return false;
  }
  let category = questContent.category;

  let canInvite = !BANNED_SCROLLS.includes(questContent.text) &&
    ((AUTO_INVITE_HOURGLASS_QUESTS === true && category === "timeTravelers") ||
      (category != "timeTravelers" && (
        (AUTO_INVITE_GOLD_QUESTS === true && typeof questContent.goldValue !== "undefined") ||
        (AUTO_INVITE_UNLOCKABLE_QUESTS === true && category === "unlockable") ||
        (AUTO_INVITE_PET_QUESTS === true && ["pet", "hatchingPotion"].includes(category)))));

  if (canInvite && !AUTO_INVITE_FULLY_COMPLETED_QUESTS) {
    let questCompletion = questCompletionData.find((q) => q.questKey === questKey);
    // world bosses and special quests are omitted from completion data, so treat missing as eligible
    canInvite = canInvite && (!questCompletion || questCompletion.completionPercentage < 100);
  }

  return canInvite;
}

/**
 * Counts other party members who own at least one auto-invite-eligible quest scroll
 * for a quest with a strictly lower completion percentage than the selected quest.
 * Counts members, not scrolls: a member with several qualifying scrolls counts once.
 *
 * @param {Object} selectedQuest - The quest chosen by selectPriorityQuest() (needs .completionPercentage)
 * @param {Object[]} questCompletionData - Precomputed party quest completion data
 * @returns {number} Number of rival party members
 */
function countQuestRivals(selectedQuest, questCompletionData) {
  let partyMembers = getMembers(); // already cached via getQuestCompletionData(), no extra fetch
  if (typeof partyMembers === "undefined") {
    return 0;
  }

  let rivals = 0;
  for (let member of partyMembers) {
    if (member._id === USER_ID) {
      continue;
    }
    let quests = member.items && member.items.quests;
    if (!quests) {
      continue;
    }

    let isRival = Object.entries(quests).some(([questKey, numScrolls]) => {
      if (numScrolls <= 0 || !isQuestScrollEligible(questKey, questCompletionData)) {
        return false;
      }
      let questCompletion = questCompletionData.find((q) => q.questKey === questKey);
      let completionPercentage = questCompletion ? questCompletion.completionPercentage : 0;
      return completionPercentage < selectedQuest.completionPercentage;
    });

    if (isRival) {
      rivals++;
    }
  }

  return rivals;
}

/**
 * Selects the quest with the lowest party completion percentage, and counts how many
 * other party members hold an eligible scroll for a strictly more urgent quest.
 *
 * @returns {Object} The selected quest (with a `rivals` count) or null if no quest is available
 */
function selectPriorityQuest() {
  // get quest completion data for the party
  let questCompletionData = getQuestCompletionData();

  // for each quest scroll the player owns
  let availableQuests = [];
  for (let [questKey, numScrolls] of Object.entries(getUser().items.quests)) {
    if (numScrolls > 0 && isQuestScrollEligible(questKey, questCompletionData)) {
      let questCompletion = questCompletionData.find((q) => q.questKey === questKey);
      availableQuests.push({
        questKey: questKey,
        numScrolls: numScrolls,
        // world bosses and special quests are omitted from completion data, treat missing as 0%
        completionPercentage: questCompletion ? questCompletion.completionPercentage : 0,
        questName: getContent().quests[questKey].text,
      });
    }
  }

  // if list contains scrolls
  if (availableQuests.length > 0) {
    // sort by completion percentage (lowest first)
    availableQuests.sort(
      (a, b) => a.completionPercentage - b.completionPercentage
    );

    // select the quest with the lowest completion percentage
    let selectedQuest = availableQuests[0];
    selectedQuest.rivals = countQuestRivals(selectedQuest, questCompletionData);

    return selectedQuest;
  }

  return null;
}