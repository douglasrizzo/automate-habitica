/**
 * Sends a party report to chat with recommended quests sorted by completion %.
 * Shows up to PARTY_REPORT_QUEST_COUNT quests with up to 3 members who have scrolls.
 * Respects PARTY_REPORT_INTERVAL_DAYS between reports.
 * 
 * @returns {void}
 */
function partyReport() {
  // check if enough time has passed since last report
  let lastReportTime = scriptProperties.getProperty("LAST_PARTY_REPORT");
  if (lastReportTime) {
    let daysSinceLastReport =
      (new Date().getTime() - new Date(lastReportTime).getTime()) /
      MS_PER_DAY;
    if (daysSinceLastReport < PARTY_REPORT_INTERVAL_DAYS) {
      console.log(
        "Party report sent " +
        daysSinceLastReport.toFixed(1) +
        " days ago, skipping (interval: " +
        PARTY_REPORT_INTERVAL_DAYS +
        " days)"
      );
      return;
    }
  }

  console.log("Generating party report...");

  // get party members
  let partyMembers = getMembers(true);
  if (typeof partyMembers === "undefined" || partyMembers.length === 0) {
    console.log("No party found or no members.");
    return;
  }

  // check if user is in a party
  let partyId = scriptProperties.getProperty("PARTY_ID");
  if (!partyId) {
    console.log("No party ID found.");
    return;
  }

  let contentData = getContent();

  // generate the message
  let message = generateQuestRecommendationsMessage(partyMembers, contentData);

  // send to party chat
  console.log("Sending party report to chat (" + message.length + " chars)...");
  let params = Object.assign(
    {
      contentType: "application/json",
      payload: JSON.stringify({ message: message }),
    },
    POST_PARAMS
  );
  fetch("https://habitica.com/api/v3/groups/party/chat", params);

  // save the time of this report
  scriptProperties.setProperty("LAST_PARTY_REPORT", new Date().toISOString());

  console.log("Party report sent successfully!");
}

/**
 * Generates the quest recommendations message with members who have scrolls.
 * 
 * @param {Object[]} partyMembers - Array of party member data from API
 * @param {Object} contentData - Habitica content data from API
 * @returns {string} Formatted message for party chat
 */
function generateQuestRecommendationsMessage(partyMembers, contentData) {
  let questCompletionData = getQuestCompletionData();

  // filter out world bosses and sort by completion percentage
  let recommendedQuests = questCompletionData
    .filter((q) => contentData.quests[q.questKey].category !== "world")
    .sort((a, b) => a.completionPercentage - b.completionPercentage)
    .slice(0, PARTY_REPORT_QUEST_COUNT);

  // build a map of quest -> members who have scrolls
  let questScrollOwners = {};
  for (let quest of recommendedQuests) {
    questScrollOwners[quest.questKey] = [];
  }

  for (let member of partyMembers) {
    let displayName =
      member.profile.name || member.auth.local.username || "Unknown";
    if (member.items && member.items.quests) {
      for (let [questKey, count] of Object.entries(member.items.quests)) {
        if (count > 0 && questScrollOwners.hasOwnProperty(questKey)) {
          questScrollOwners[questKey].push(displayName);
        }
      }
    }
  }

  // build bullet list
  let randomEmoji = REPORT_EMOJIS[Math.floor(Math.random() * REPORT_EMOJIS.length)];

  let lines = [];
  lines.push(
    "## " + randomEmoji + " **Automate Habitica+ - Quests with Lowest Completion %**"
  );
  lines.push("");
  lines.push(
    "[How completion % is calculated](https://github.com/douglasrizzo/automate-habitica#quest-completion-percentage)"
  );
  lines.push("");
  lines.push("Player names = up to " + MAX_SCROLL_OWNERS_DISPLAY + " random party members with a scroll.");
  lines.push("");

  for (let quest of recommendedQuests) {
    let percentage = Math.floor(quest.completionPercentage) + "%";
    let owners = questScrollOwners[quest.questKey];

    // randomly select up to MAX_SCROLL_OWNERS_DISPLAY owners (no bold)
    let displayOwners = [];
    if (owners.length > 0) {
      let shuffled = owners.slice().sort(() => Math.random() - 0.5);
      displayOwners = shuffled.slice(0, MAX_SCROLL_OWNERS_DISPLAY);
    }
    let ownersPart =
      displayOwners.length > 0 ? " (" + displayOwners.join(", ") + ")" : "";

    lines.push("- **" + percentage + "** - " + quest.questName + ownersPart);
  }

  return lines.join("\n");
}
