/**
 * Sends yourself a PM with quest completion data and who has scrolls to invite for each.
 * Respects QUEST_REPORT_FREQUENCY_DAYS between reports.
 *
 * @returns {void}
 */
function sendQuestReport() {
  // check if enough time has passed since last report
  let lastReportTime = scriptProperties.getProperty("LAST_QUEST_REPORT");
  if (lastReportTime) {
    let daysSinceLastReport =
      (new Date().getTime() - new Date(lastReportTime).getTime()) / MS_PER_DAY;
    if (daysSinceLastReport < QUEST_REPORT_FREQUENCY_DAYS) {
      console.log(
        "Quest report sent " +
        daysSinceLastReport.toFixed(1) +
        " days ago, skipping (frequency: " +
        QUEST_REPORT_FREQUENCY_DAYS +
        " days)"
      );
      return;
    }
  }

  if (typeof getParty(true) === "undefined") {
    console.log("No party found, skipping quest report.");
    return;
  }

  console.log("Generating quest report...");

  let message = generateQuestReportMessage();

  console.log("Sending quest report PM (" + message.length + " chars)...");
  let params = Object.assign(
    {
      contentType: "application/json",
      payload: JSON.stringify({ message: message, toUserId: USER_ID }),
    },
    POST_PARAMS
  );
  fetch("https://habitica.com/api/v3/members/send-private-message", params);

  scriptProperties.setProperty("LAST_QUEST_REPORT", new Date().toISOString());

  console.log("Quest report sent successfully!");
}

/**
 * Builds the quest report message: the quests with the lowest completion %,
 * a sample of party members who own a scroll for each, and (if any
 * AUTO_INVITE_* setting is on) which quest would currently be auto-invited next.
 *
 * @returns {string} Formatted message for a private message
 */
function generateQuestReportMessage() {
  let contentData = getContent();
  let partyMembers = getMembers();
  let questCompletionData = getQuestCompletionData();

  let recommendedQuests = questCompletionData
    .filter((q) => contentData.quests[q.questKey].category !== "world")
    .sort((a, b) => a.completionPercentage - b.completionPercentage)
    .slice(0, QUEST_REPORT_COUNT);

  // build a map of quest -> members who have scrolls
  let questScrollOwners = {};
  for (let quest of recommendedQuests) {
    questScrollOwners[quest.questKey] = [];
  }
  for (let member of partyMembers) {
    let displayName =
      member.profile.name || member.auth.local.username || "Unknown";
    let inventory = member.items && member.items.quests;
    if (inventory) {
      for (let [questKey, count] of Object.entries(inventory)) {
        if (count > 0 && questScrollOwners.hasOwnProperty(questKey)) {
          questScrollOwners[questKey].push(displayName);
        }
      }
    }
  }

  let autoInviteEnabled =
    AUTO_INVITE_GOLD_QUESTS === true ||
    AUTO_INVITE_UNLOCKABLE_QUESTS === true ||
    AUTO_INVITE_PET_QUESTS === true ||
    AUTO_INVITE_HOURGLASS_QUESTS === true;
  let nextPick = autoInviteEnabled ? selectPriorityQuest() : null;

  let randomEmoji = REPORT_EMOJIS[Math.floor(Math.random() * REPORT_EMOJIS.length)];
  let lines = [];
  lines.push(randomEmoji + " **Quest Report — Lowest Completion %**");
  lines.push("");

  if (autoInviteEnabled) {
    if (nextPick !== null) {
      lines.push(
        "Next auto-invite pick: **" +
        Math.floor(nextPick.completionPercentage) +
        "%** — " +
        nextPick.questName
      );
    } else {
      lines.push(
        "Next auto-invite pick: none — no eligible quest scrolls in your inventory right now."
      );
    }
    lines.push("");
  }

  lines.push(
    "Names = up to " + MAX_SCROLL_OWNERS_DISPLAY + " random party members who own that scroll."
  );
  lines.push("");

  for (let quest of recommendedQuests) {
    let percentage = Math.floor(quest.completionPercentage) + "%";
    let owners = questScrollOwners[quest.questKey];

    let displayOwners = [];
    if (owners.length > 0) {
      let shuffled = owners.slice().sort(() => Math.random() - 0.5);
      displayOwners = shuffled.slice(0, MAX_SCROLL_OWNERS_DISPLAY);
    }
    let extraCount = owners.length - displayOwners.length;
    let ownersPart =
      displayOwners.length > 0
        ? " (" + displayOwners.join(", ") + (extraCount > 0 ? " +" + extraCount + " more" : "") + ")"
        : "";

    lines.push("- **" + percentage + "** " + quest.questName + ownersPart);
  }

  return lines.join("\n");
}
