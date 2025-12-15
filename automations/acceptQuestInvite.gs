/**
 * Accepts a pending quest invite if there is one.
 * Run on questInvited webhook and every 10 mins as backup.
 * 
 * @returns {void}
 */
function acceptQuestInvite() {

  // if pending quest & unaccepted invite
  if (typeof getParty(true) !== "undefined" && typeof party.quest.key !== "undefined" && !party.quest.active && party.quest.members[USER_ID] === null) {

    console.log("Accepting invite to pending quest \"" + getContent().quests[party.quest.key].text + "\"");

    // accept quest invite
    fetch("https://habitica.com/api/v3/groups/party/quests/accept", POST_PARAMS);

  } else {
    console.log("No quest invite to accept");
  }
}