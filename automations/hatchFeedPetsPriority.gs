/**
 * hatchFeedPetsPriority()
 *
 * Priority-based pet hatching and feeding strategy.
 *
 * Hatching priority (in order):
 * 1. Standard pets (basic colors)
 * 2. Standard pets (magic/premium potions)
 * 3. Quest pets (basic colors)
 * 4. Wacky pets
 * Within each group, sorted alphabetically by species.
 *
 * Feeding priority (in order):
 * 1. Basic color pets (standard + quest) - favorite food only (+5 per feeding)
 * 2. Magic potion pets (premium colors) - any leftover food (+5 per feeding)
 * Wacky pets are skipped (cannot become mounts).
 * Within each group, prioritizes pets closest to becoming mounts.
 *
 * Run this function whenever the player gets eggs, hatching potions,
 * or food: whenever a task is scored, and whenever a quest is completed.
 */
function hatchFeedPetsPriority() {
  // if time limit, return
  if (webhook || installing) {
    return;
  }

  // get pet data using shared functions
  let petLists = getPetLists();
  let basicColors = getBasicColors();
  let { standardPetSet, questPetSet, premiumPetSet } = getPetCategorySets();

  // get user data
  let userData = getUser(true);

  // get owned eggs and potions (local copies for tracking)
  let eggsOwned = Object.assign({}, userData.items.eggs);
  let potionsOwned = Object.assign({}, userData.items.hatchingPotions);

  // get owned pets and mounts using shared functions
  let petsOwned = getOwnedPets(petLists.allNonSpecialPets);
  let mountsOwned = getOwnedMounts(petLists.allNonSpecialPets);

  // get owned food using shared function
  let foodOwned = getUsableFood();

  // ==================== HATCHING ====================

  // build list of pets that can be hatched
  let petsToHatch = [];

  for (let pet of petLists.allNonSpecialPets) {
    // skip if already have the pet
    if (petsOwned.hasOwnProperty(pet)) {
      continue;
    }

    let [species, color] = pet.split("-");

    // check if we have egg and potion
    if ((eggsOwned[species] || 0) > 0 && (potionsOwned[color] || 0) > 0) {
      let isWacky = petLists.wackyPets.includes(pet);
      let isStandard = standardPetSet.has(pet);
      let isQuest = questPetSet.has(pet);
      let isBasicColor = basicColors.includes(color);

      // determine hatching priority group (lower = higher priority)
      let priorityGroup;
      if (isStandard && isBasicColor) {
        priorityGroup = 1; // Standard pets, basic colors
      } else if (isStandard && !isBasicColor) {
        priorityGroup = 2; // Standard pets, magic potions
      } else if (isQuest) {
        priorityGroup = 3; // Quest pets
      } else if (isWacky) {
        priorityGroup = 4; // Wacky pets
      } else {
        priorityGroup = 5; // Premium pets (shouldn't happen often)
      }

      petsToHatch.push({ pet, species, color, priorityGroup });
    }
  }

  // sort by priority group, then alphabetically by species
  petsToHatch.sort((a, b) => {
    if (a.priorityGroup !== b.priorityGroup) {
      return a.priorityGroup - b.priorityGroup;
    }
    // alphabetically by species within the same group
    return a.species.localeCompare(b.species);
  });

  // hatch pets in priority order
  let currentPriorityGroup = 0;
  let priorityGroupNames = {
    1: "standard pets (basic colors)",
    2: "standard pets (magic potions)",
    3: "quest pets",
    4: "wacky pets",
    5: "premium pets",
  };

  for (let { pet, species, color, priorityGroup } of petsToHatch) {
    if ((eggsOwned[species] || 0) <= 0 || (potionsOwned[color] || 0) <= 0) {
      continue;
    }

    // log when entering a new priority group
    if (priorityGroup !== currentPriorityGroup) {
      currentPriorityGroup = priorityGroup;
      console.log("Hatching " + priorityGroupNames[priorityGroup] + "...");
    }

    hatchPet(species, color);
    eggsOwned[species]--;
    potionsOwned[color]--;
    petsOwned[pet] = 5;

    if (interruptLoop()) return;
  }

  // ==================== FEEDING ====================

  // build list of feedable pets with their priority
  // Priority 1 = basic color pets (use favorite food), Priority 2 = magic potion pets (use any food)
  let petsToFeed = [];

  for (let [pet, fedAmount] of Object.entries(petsOwned)) {
    // wacky pets can't become mounts - skip
    if (petLists.wackyPets.includes(pet)) continue;
    // already have mount - skip
    if (mountsOwned.hasOwnProperty(pet)) continue;

    let [species, color] = pet.split("-");
    let hunger = 50 - fedAmount; // how much more food needed to become mount

    if (hunger <= 0) continue;

    let isBasicColor = basicColors.includes(color);

    // determine feeding priority: 1 = basic color, 2 = magic potion
    let feedPriority;
    if (standardPetSet.has(pet)) {
      feedPriority = isBasicColor ? 1 : 2;
    } else if (questPetSet.has(pet)) {
      feedPriority = 1; // quest pets have basic colors
    } else if (premiumPetSet.has(pet)) {
      feedPriority = 2; // premium pets use any food
    } else {
      continue; // unknown pet type
    }

    petsToFeed.push({ pet, species, color, hunger, feedPriority, isBasicColor });
  }

  // sort by feed priority first, then by hunger (closest to mount first)
  petsToFeed.sort((a, b) => {
    if (a.feedPriority !== b.feedPriority) {
      return a.feedPriority - b.feedPriority;
    }
    return a.hunger - b.hunger;
  });

  // feed all pets in priority order
  console.log("Feeding pets...");

  for (let { pet, species, color, hunger, isBasicColor } of petsToFeed) {
    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);

    // get foods this pet can eat
    let foods = isBasicColor
      ? getFavoriteFoods(color)
      : Object.keys(foodOwned).sort((a, b) => (foodOwned[b] || 0) - (foodOwned[a] || 0));

    for (let food of foods) {
      let amount = foodOwned[food] || 0;
      if (amount <= 0 || hunger <= 0) continue;

      let feedings = Math.min(Math.ceil(hunger / FOOD_POINTS_FAVORITE), amount);
      feedPet(pet, food, feedings, speciesReadable, colorReadable);

      foodOwned[food] -= feedings;
      if (foodOwned[food] <= 0) delete foodOwned[food];
      hunger -= feedings * FOOD_POINTS_FAVORITE;

      if (interruptLoop()) return;
    }

    // hatch replacement if pet became a mount
    if (hunger <= 0) {
      tryHatchReplacement(species, color, eggsOwned, potionsOwned);
    }
    if (interruptLoop()) return;
  }
}

/**
 * tryHatchReplacement(species, color, eggsOwned, potionsOwned)
 *
 * Hatches a replacement pet if resources are available.
 */
function tryHatchReplacement(species, color, eggsOwned, potionsOwned) {
  if ((eggsOwned[species] || 0) > 0 && (potionsOwned[color] || 0) > 0) {
    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);
    console.log("Hatching replacement " + colorReadable + " " + speciesReadable);
    hatchPet(species, color);
    eggsOwned[species]--;
    potionsOwned[color]--;
  }
}
