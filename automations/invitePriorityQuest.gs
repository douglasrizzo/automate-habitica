/**
 * Chooses the quest scroll with lowest party completion percentage and invites party.
 * Respects AUTO_INVITE_* settings and BANNED_SCROLLS list.
 * Run 5-15 mins after quest completion via delayed trigger.
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
 * Selects the quest with the lowest party completion percentage.
 * 
 * @returns {Object} The selected quest or null if no quest is available
 */
function selectPriorityQuest() {
  // get quest completion data for the party
  let questCompletionData = getQuestCompletionData();

  // for each quest scroll the player owns
  let availableQuests = [];
  for (let [questKey, numScrolls] of Object.entries(getUser().items.quests)) {
    if (numScrolls > 0) {
      let category = getContent().quests[questKey].category;

      // if not excluded by settings
      let canInvite = !BANNED_SCROLLS.includes(content.quests[questKey].text) &&
        ((AUTO_INVITE_HOURGLASS_QUESTS === true && category === "timeTravelers") ||
          (category != "timeTravelers" && (
            (AUTO_INVITE_GOLD_QUESTS === true && typeof content.quests[questKey].goldValue !== "undefined") ||
            (AUTO_INVITE_UNLOCKABLE_QUESTS === true && category === "unlockable") ||
            (AUTO_INVITE_PET_QUESTS === true && ["pet", "hatchingPotion"].includes(category)))));
      if (canInvite && !AUTO_INVITE_FULLY_COMPLETED_QUESTS) {
        let questCompletion = questCompletionData.find((q) => q.questKey === questKey);
        canInvite = canInvite && questCompletion.completionPercentage < 100;
      }

      if (canInvite) {
        // find the quest in completion data
        let questCompletion = questCompletionData.find(
          (q) => q.questKey === questKey
        );

        if (questCompletion) {
          availableQuests.push({
            questKey: questKey,
            numScrolls: numScrolls,
            completionPercentage: questCompletion.completionPercentage,
            questName: content.quests[questKey].text,
          });
        } else {
          // quest not found in completion data (e.g., world boss), add with 0% completion
          availableQuests.push({
            questKey: questKey,
            numScrolls: numScrolls,
            completionPercentage: 0,
            questName: content.quests[questKey].text,
          });
        }
      }
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

    return selectedQuest;
  }

  return null;
}