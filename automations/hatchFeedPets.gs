/**
 * hatchFeedPets - Auto Hatch/Feed Pets Automation
 *
 * This file contains both hatching/feeding strategies:
 * - hatchFeedPets(): Conservative strategy - only hatches/feeds when you have enough for ALL
 * - hatchFeedPetsPriority(): Priority strategy - hatches/feeds immediately using priority order
 *
 * The active strategy is determined by the HATCH_FEED_MODE setting in setup.gs.
 */

/*************************************\
 *           CONSTANTS               *
\*************************************/

/**
 * Food points gained per feeding:
 * FOOD_POINTS_FAVORITE: Points when feeding a basic color pet its favorite food (+5)
 * FOOD_POINTS_NON_FAVORITE: Points when feeding a basic color pet non-favorite food (+2)
 * FOOD_POINTS_MAGIC_POTION_PET: Points when feeding magic potion pets any food (+5, no preferences)
 */
const FOOD_POINTS_FAVORITE = 5;
const FOOD_POINTS_NON_FAVORITE = 2;
const FOOD_POINTS_MAGIC_POTION_PET = 5;

/**
 * Pet evolution thresholds:
 * MOUNT_THRESHOLD: Total food points needed for a pet to become a mount
 * NEWLY_HATCHED_FED: Starting fed amount when a pet is first hatched
 * HUNGER_AFTER_HATCH: Hunger remaining after hatching (MOUNT_THRESHOLD - NEWLY_HATCHED_FED)
 */
const MOUNT_THRESHOLD = 50;
const NEWLY_HATCHED_FED = 5;
const HUNGER_AFTER_HATCH = MOUNT_THRESHOLD - NEWLY_HATCHED_FED; // 45

/**
 * Feeding calculations:
 * FEEDINGS_TO_MOUNT_FAVORITE: Number of favorite food feedings to raise a pet to mount
 * FEEDINGS_TO_MOUNT_NON_FAVORITE: Number of non-favorite food feedings needed
 * NON_FAVORITE_TO_FAVORITE_RATIO: Multiplier to convert favorite feeding counts to non-favorite
 */
const FEEDINGS_TO_MOUNT_FAVORITE = Math.ceil(HUNGER_AFTER_HATCH / FOOD_POINTS_FAVORITE); // 9
const FEEDINGS_TO_MOUNT_NON_FAVORITE = Math.ceil(HUNGER_AFTER_HATCH / FOOD_POINTS_NON_FAVORITE); // 23
const NON_FAVORITE_TO_FAVORITE_RATIO = FEEDINGS_TO_MOUNT_NON_FAVORITE / FEEDINGS_TO_MOUNT_FAVORITE;

/**
 * Resource requirements per pet type:
 * RESOURCES_PER_NON_WACKY: Eggs/potions needed per non-wacky pet (1 for pet + 1 for mount = 2)
 * RESOURCES_PER_WACKY: Eggs/potions needed per wacky pet (1 for pet only, can't become mount)
 */
const RESOURCES_PER_NON_WACKY = 2;
const RESOURCES_PER_WACKY = 1;

/**
 * Hatching priority groups for priority strategy (lower = higher priority):
 * Used to determine which pets to hatch first when resources are limited.
 */
const HATCH_PRIORITY = {
  STANDARD_BASIC: 1,    // Standard pets with basic colors (Base, Red, etc.)
  STANDARD_MAGIC: 2,    // Standard pets with magic potion colors (Royal Purple, etc.)
  QUEST: 3,             // Quest reward pets
  WACKY: 4,             // Wacky potion pets
  PREMIUM: 5,           // Premium pets (rare edge case)
};

/**
 * Feeding priority groups for priority strategy (lower = higher priority):
 * Used to determine which pets to feed first.
 */
const FEED_PRIORITY = {
  BASIC_COLOR: 1,       // Basic color pets - fed with favorite foods (+5 per feeding)
  MAGIC_POTION: 2,      // Magic potion pets - fed with any food (+5 per feeding)
};

/*************************************\
 *     CONSERVATIVE STRATEGY         *
\*************************************/

/**
 * hatchFeedPets()
 *
 * Automatically hatches pets, but only if the player has enough
 * eggs for all pets/mounts of that species, and enough hatching
 * potions for all pets/mounts of that color.
 *
 * Automatically feeds pets, but only if the player has enough
 * of the pet's favorite food(s) to feed all pets with the same
 * favorite food(s).
 *
 * Run this function whenever the player gets eggs, hatching
 * potions, or food: whenever a task is scored, and whenever a
 * quest is completed.
 */
function hatchFeedPets() {
  // if time limit, return
  if (webhook || installing) {
    return;
  }

  // get pet lists using shared function
  let petLists = getPetLists();
  let basicColors = getBasicColors();
  let contentData = getContent();

  // get # each egg & hatching potion needed
  let numEachEggNeededTotal = {};
  let numEachPotionNeededTotal = {};
  for (let pet of petLists.nonWackyNonSpecialPets) {
    let [species, color] = pet.split("-");
    numEachEggNeededTotal[species] = (numEachEggNeededTotal[species] || 0) + RESOURCES_PER_NON_WACKY;
    numEachPotionNeededTotal[color] = (numEachPotionNeededTotal[color] || 0) + RESOURCES_PER_NON_WACKY;
  }
  for (let pet of petLists.wackyPets) {
    let [species, color] = pet.split("-");
    numEachEggNeededTotal[species] = (numEachEggNeededTotal[species] || 0) + RESOURCES_PER_WACKY;
    numEachPotionNeededTotal[color] = (numEachPotionNeededTotal[color] || 0) + RESOURCES_PER_WACKY;
  }

  // get # each egg & hatching potion owned/used, pets & mounts owned, # each food type needed, # extra food needed
  let numEachEggOwnedUsed = JSON.parse(JSON.stringify(contentData.eggs));
  let numEachPotionOwnedUsed = JSON.parse(JSON.stringify(contentData.hatchingPotions));

  // add owned eggs and potions to counts
  let userData = getUser(true);
  for (let egg of Object.keys(numEachEggOwnedUsed)) {
    numEachEggOwnedUsed[egg] = userData.items.eggs[egg] || 0;
  }
  for (let potion of Object.keys(numEachPotionOwnedUsed)) {
    numEachPotionOwnedUsed[potion] = userData.items.hatchingPotions[potion] || 0;
  }

  // get owned pets and add to egg/potion "used" counts
  let petsOwned = getOwnedPets(petLists.allNonSpecialPets);
  for (let pet of Object.keys(petsOwned)) {
    let [species, color] = pet.split("-");
    numEachEggOwnedUsed[species] = (numEachEggOwnedUsed[species] || 0) + 1;
    numEachPotionOwnedUsed[color] = (numEachPotionOwnedUsed[color] || 0) + 1;
  }

  // get owned mounts and add to egg/potion "used" counts
  let mountsOwned = getOwnedMounts(petLists.allNonSpecialPets);

  // calculate food needs per color type
  let numEachFoodTypeNeededTotal = Object.keys(numEachEggNeededTotal).length * FEEDINGS_TO_MOUNT_FAVORITE;
  let numEachFoodTypeNeeded = {};
  for (let color of basicColors) {
    numEachFoodTypeNeeded[color] = numEachFoodTypeNeededTotal;
  }
  // Food needed for magic potion pets (they eat any food, so use "surplus" after basic pets get favorites)
  let foodNeededForMagicPets =
    Object.keys(contentData.premiumHatchingPotions).length *
    Object.keys(contentData.dropEggs).length *
    FEEDINGS_TO_MOUNT_FAVORITE;

  // process owned mounts: add to counts and reduce food needs
  for (let mount of Object.keys(mountsOwned)) {
    let [species, color] = mount.split("-");
    numEachEggOwnedUsed[species] = (numEachEggOwnedUsed[species] || 0) + 1;
    numEachPotionOwnedUsed[color] = (numEachPotionOwnedUsed[color] || 0) + 1;
    if (basicColors.includes(color)) {
      numEachFoodTypeNeeded[color] -= FEEDINGS_TO_MOUNT_FAVORITE;
    } else {
      foodNeededForMagicPets -= FEEDINGS_TO_MOUNT_FAVORITE;
    }
  }

  // get usable food and group by target color
  let { foodOwned, foodByType } = getUsableFoodWithTypes();

  // Calculate surplus food (food beyond what basic pets need for their favorites)
  // This surplus can be used for: 1) magic potion pets, 2) fallback for basic pets with non-favorite food
  let surplusFoodAvailable = 0;
  let favoriteFoodDeficit = 0; // how much favorite food we're short for basic pets
  for (let [color, amount] of Object.entries(foodByType)) {
    let surplus = amount - numEachFoodTypeNeeded[color];
    if (surplus > 0) {
      surplusFoodAvailable += surplus;
    } else if (surplus < 0) {
      favoriteFoodDeficit += Math.abs(surplus);
    }
  }
  // Convert deficit to non-favorite feedings (takes more food since +2 instead of +5)
  let fallbackFoodNeeded = favoriteFoodDeficit * NON_FAVORITE_TO_FAVORITE_RATIO;
  // Food available after reserving for magic potion pets
  let fallbackFoodAvailable = Math.max(0, surplusFoodAvailable - foodNeededForMagicPets);

  // for each non-special pet in content
  for (let pet of petLists.allNonSpecialPets) {
    let [species, color] = pet.split("-");
    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);
    let hunger = MOUNT_THRESHOLD;

    // if player has all needed eggs & potions for that species & color
    if (
      numEachEggOwnedUsed[species] - numEachEggNeededTotal[species] >= 0 &&
      numEachPotionOwnedUsed[color] - numEachPotionNeededTotal[color] >= 0
    ) {
      // if player doesn't have pet
      if (!petsOwned.hasOwnProperty(pet)) {
        // hatch pet
        hatchPet(species, color);
        hunger = HUNGER_AFTER_HATCH;
      }

      // if non-wacky & player doesn't have mount
      if (!petLists.wackyPets.includes(pet) && !mountsOwned.hasOwnProperty(pet)) {
        // get pet hunger
        if (hunger == MOUNT_THRESHOLD) {
          let fed = petsOwned[pet];
          if (typeof fed !== "undefined" && fed > 0) {
            hunger -= fed;
          }
        }

        // if basic color pet
        let grewToMount = false;
        if (basicColors.includes(color)) {
          // if player has enough preferred food for all basic pets of this color
          if (foodByType[color] >= numEachFoodTypeNeeded[color]) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / FOOD_POINTS_FAVORITE);

            // feed with favorite foods
            let favoriteFoods = getFavoriteFoods(color);
            for (let food of favoriteFoods) {
              let amount = foodOwned[food] || 0;
              if (amount <= 0) continue;

              // calculate feedings
              let feedings = Math.min(feedingsNeeded, amount);

              // feed this food
              feedPet(pet, food, feedings, speciesReadable, colorReadable);

              // update data
              feedingsNeeded -= feedings;
              foodOwned[food] -= feedings;
              if (foodOwned[food] <= 0) {
                delete foodOwned[food];
              }
              foodByType[color] -= feedings;
              numEachFoodTypeNeeded[color] -= feedings;

              // stop feeding if full
              if (feedingsNeeded <= 0) {
                grewToMount = true;
                break;
              }
            }

            // fallback: use non-favorite food if enough surplus available
          } else if (fallbackFoodAvailable >= fallbackFoodNeeded) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / FOOD_POINTS_NON_FAVORITE);

            // feed until mount
            grewToMount = feedExtraFoodConservative(
              pet,
              feedingsNeeded,
              speciesReadable,
              colorReadable,
              foodOwned,
              foodByType,
              numEachFoodTypeNeeded,
              contentData
            );

            // not enough food to feed basic mount
          } else {
            console.log(
              "Cannot feed " +
              colorReadable +
              " " +
              speciesReadable +
              ": not enough preferred food (need " +
              numEachFoodTypeNeeded[color] +
              ", have " +
              foodByType[color] +
              ")"
            );
          }

          // if magic potion color pet (premium colors)
        } else {
          // if player has enough surplus food for magic potion pets
          if (surplusFoodAvailable >= foodNeededForMagicPets) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / FOOD_POINTS_MAGIC_POTION_PET);

            // feed until mount
            grewToMount = feedExtraFoodConservative(
              pet,
              feedingsNeeded,
              speciesReadable,
              colorReadable,
              foodOwned,
              foodByType,
              numEachFoodTypeNeeded,
              contentData
            );

            // not enough surplus food for magic potion pet
          } else {
            console.log(
              "Cannot feed " +
              colorReadable +
              " " +
              speciesReadable +
              ": not enough surplus food (need " +
              foodNeededForMagicPets +
              " surplus food after basic pets get favorites; have " +
              surplusFoodAvailable +
              ")"
            );
          }
        }

        // if grew to mount, hatch another pet
        if (grewToMount) {
          hatchPet(species, color);
        }
      }

      // if not enough eggs and/or not enough hatching potions
    } else if (
      !petsOwned.hasOwnProperty(pet) ||
      (!petLists.wackyPets.includes(pet) && !mountsOwned.hasOwnProperty(pet))
    ) {
      let message =
        "Cannot hatch or feed " +
        colorReadable +
        " " +
        speciesReadable +
        ": not enough ";
      if (numEachEggOwnedUsed[species] - numEachEggNeededTotal[species] < 0) {
        message +=
          speciesReadable +
          " eggs (need " +
          (numEachEggNeededTotal[species] -
            numEachEggOwnedUsed[species] +
            (userData.items.eggs[species] || 0)) +
          ", have " +
          (userData.items.eggs[species] || 0) +
          ")";
      }
      if (numEachPotionOwnedUsed[color] - numEachPotionNeededTotal[color] < 0) {
        if (message.endsWith(")")) {
          message += " or ";
        }
        message +=
          colorReadable +
          " hatching potions (need " +
          (numEachPotionNeededTotal[color] -
            numEachPotionOwnedUsed[color] +
            (userData.items.hatchingPotions[color] || 0)) +
          ", have " +
          (userData.items.hatchingPotions[color] || 0) +
          ")";
      }
      console.log(message);
    }
  }
}

/**
 * feedExtraFoodConservative(pet, feedingsNeeded, speciesReadable, colorReadable, foodOwned, foodByType, numEachFoodTypeNeeded, contentData)
 *
 * Feeds a pet with extra food (food not needed for basic color mounts).
 * Used by the conservative strategy. Returns true if pet became a mount.
 */
function feedExtraFoodConservative(
  pet,
  feedingsNeeded,
  speciesReadable,
  colorReadable,
  foodOwned,
  foodByType,
  numEachFoodTypeNeeded,
  contentData
) {
  // sort foods by amount owned (highest first)
  let foodsSorted = Object.entries(foodOwned).sort((a, b) => b[1] - a[1]);

  // for each food in sorted list
  for (let [food, amount] of foodsSorted) {
    // check if this food is "extra" (not needed for basic mounts)
    let target = contentData.food[food].target;
    let extra = foodByType[target] - numEachFoodTypeNeeded[target];
    if (extra > 0) {
      // calculate feedings
      let feedings = Math.min(feedingsNeeded, amount, extra);

      // feed this food
      feedPet(pet, food, feedings, speciesReadable, colorReadable);

      // update data
      feedingsNeeded -= feedings;
      foodOwned[food] -= feedings;
      if (foodOwned[food] <= 0) {
        delete foodOwned[food];
      }
      foodByType[target] -= feedings;

      // stop feeding if full
      if (feedingsNeeded <= 0) {
        return true;
      }
    }
  }
  return false;
}

/*************************************\
 *       PRIORITY STRATEGY           *
\*************************************/

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
    if (hasEnoughResources(species, color, eggsOwned, potionsOwned)) {
      let isWacky = petLists.wackyPets.includes(pet);
      let isStandard = standardPetSet.has(pet);
      let isQuest = questPetSet.has(pet);
      let isBasicColor = basicColors.includes(color);

      // determine hatching priority group (lower = higher priority)
      let priorityGroup;
      if (isStandard && isBasicColor) {
        priorityGroup = HATCH_PRIORITY.STANDARD_BASIC;
      } else if (isStandard && !isBasicColor) {
        priorityGroup = HATCH_PRIORITY.STANDARD_MAGIC;
      } else if (isQuest) {
        priorityGroup = HATCH_PRIORITY.QUEST;
      } else if (isWacky) {
        priorityGroup = HATCH_PRIORITY.WACKY;
      } else {
        priorityGroup = HATCH_PRIORITY.PREMIUM;
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
    [HATCH_PRIORITY.STANDARD_BASIC]: "standard pets (basic colors)",
    [HATCH_PRIORITY.STANDARD_MAGIC]: "standard pets (magic potions)",
    [HATCH_PRIORITY.QUEST]: "quest pets",
    [HATCH_PRIORITY.WACKY]: "wacky pets",
    [HATCH_PRIORITY.PREMIUM]: "premium pets",
  };

  for (let { pet, species, color, priorityGroup } of petsToHatch) {
    // re-check resources (may have been consumed by earlier hatches in this loop)
    if (!hasEnoughResources(species, color, eggsOwned, potionsOwned)) {
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
    petsOwned[pet] = NEWLY_HATCHED_FED;

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
    let hunger = MOUNT_THRESHOLD - fedAmount; // how much more food needed to become mount

    if (hunger <= 0) continue;

    let isBasicColor = basicColors.includes(color);

    // determine feeding priority based on food efficiency
    let feedPriority;
    if (standardPetSet.has(pet)) {
      feedPriority = isBasicColor ? FEED_PRIORITY.BASIC_COLOR : FEED_PRIORITY.MAGIC_POTION;
    } else if (questPetSet.has(pet)) {
      feedPriority = FEED_PRIORITY.BASIC_COLOR; // quest pets have basic colors
    } else if (premiumPetSet.has(pet)) {
      feedPriority = FEED_PRIORITY.MAGIC_POTION; // premium pets use any food
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
  if (hasEnoughResources(species, color, eggsOwned, potionsOwned)) {
    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);
    console.log("Hatching replacement " + colorReadable + " " + speciesReadable);
    hatchPet(species, color);
    eggsOwned[species]--;
    potionsOwned[color]--;
  }
}

/*************************************\
 *        HELPER FUNCTIONS           *
\*************************************/

/**
 * hasEnoughResources(species, color, eggsOwned, potionsOwned)
 *
 * Checks if there are eggs and potions available for a given species/color.
 * Returns true if at least 1 egg and 1 potion are available.
 */
function hasEnoughResources(species, color, eggsOwned, potionsOwned) {
  return (eggsOwned[species] || 0) > 0 && (potionsOwned[color] || 0) > 0;
}

/**
 * getPetLists()
 *
 * Returns categorized lists of all hatchable pets from content data.
 * Used by both hatchFeedPets strategies.
 */
function getPetLists() {
  let contentData = getContent();
  let nonWackyNonSpecialPets = Object.keys(contentData.pets)
    .concat(Object.keys(contentData.premiumPets))
    .concat(Object.keys(contentData.questPets));
  let wackyPets = Object.keys(contentData.wackyPets);
  let allNonSpecialPets = nonWackyNonSpecialPets.concat(wackyPets);

  return {
    nonWackyNonSpecialPets: nonWackyNonSpecialPets,
    wackyPets: wackyPets,
    allNonSpecialPets: allNonSpecialPets,
  };
}

/**
 * getBasicColors()
 *
 * Returns an array of basic/drop hatching potion colors.
 * These colors have favorite foods.
 */
function getBasicColors() {
  return Object.keys(getContent().dropHatchingPotions);
}

/**
 * getPetCategorySets()
 *
 * Returns Sets for classifying pets by category:
 * - standardPetSet: standard/drop pets (can have basic or premium colors)
 * - questPetSet: quest reward pets (basic colors only)
 * - premiumPetSet: premium pets (premium colors only)
 */
function getPetCategorySets() {
  let contentData = getContent();
  return {
    standardPetSet: new Set(Object.keys(contentData.pets)),
    questPetSet: new Set(Object.keys(contentData.questPets)),
    premiumPetSet: new Set(Object.keys(contentData.premiumPets)),
  };
}

/**
 * getOwnedPets(allNonSpecialPets)
 *
 * Returns an object of owned non-special pets with their fed amounts.
 * Pet amount meanings: 5 = newly hatched, >5 = fed, -1 = mount but no pet
 */
function getOwnedPets(allNonSpecialPets) {
  let petsOwned = {};
  for (let [pet, amount] of Object.entries(getUser().items.pets)) {
    if (amount > 0 && allNonSpecialPets.includes(pet)) {
      petsOwned[pet] = amount;
    }
  }
  return petsOwned;
}

/**
 * getOwnedMounts(allNonSpecialPets)
 *
 * Returns an object of owned non-special mounts.
 */
function getOwnedMounts(allNonSpecialPets) {
  let mountsOwned = {};
  for (let [mount, owned] of Object.entries(getUser().items.mounts)) {
    if (owned && allNonSpecialPets.includes(mount)) {
      mountsOwned[mount] = true;
    }
  }
  return mountsOwned;
}

/**
 * getUsableFood()
 *
 * Returns an object of usable food based on ONLY_USE_DROP_FOOD setting.
 * Excludes Saddles and food with 0 quantity.
 */
function getUsableFood() {
  let foodOwned = {};
  let contentData = getContent();
  for (let [food, amount] of Object.entries(getUser().items.food)) {
    if (food !== "Saddle" && amount > 0) {
      if (ONLY_USE_DROP_FOOD !== true || contentData.food[food].canDrop) {
        foodOwned[food] = amount;
      }
    }
  }
  return foodOwned;
}

/**
 * getUsableFoodWithTypes()
 *
 * Returns usable food and also groups it by target color type.
 * Used by conservative strategy which needs food totals per color.
 */
function getUsableFoodWithTypes() {
  let foodOwned = {};
  let foodByType = {};
  let contentData = getContent();

  for (let [food, amount] of Object.entries(getUser().items.food)) {
    if (food !== "Saddle" && (ONLY_USE_DROP_FOOD !== true || contentData.food[food].canDrop)) {
      if (amount > 0) {
        foodOwned[food] = amount;
      }
      let target = contentData.food[food].target;
      foodByType[target] = (foodByType[target] || 0) + amount;
    }
  }

  return { foodOwned, foodByType };
}

/**
 * makeReadable(name)
 *
 * Converts CamelCase names to "Camel Case" format for display.
 */
function makeReadable(name) {
  return name.replaceAll(/(?<!^)([A-Z])/g, " $1");
}

/**
 * hatchPet(species, color)
 *
 * Hatches a pet via the Habitica API.
 * Logs the action and returns the API response.
 */
function hatchPet(species, color) {
  let speciesReadable = makeReadable(species);
  let colorReadable = makeReadable(color);
  console.log("Hatching " + colorReadable + " " + speciesReadable);
  return fetch(
    "https://habitica.com/api/v3/user/hatch/" + species + "/" + color,
    POST_PARAMS
  );
}

/**
 * feedPet(pet, food, amount, speciesReadable, colorReadable)
 *
 * Feeds a pet via the Habitica API.
 * Logs the action and returns the API response.
 */
function feedPet(pet, food, amount, speciesReadable, colorReadable) {
  console.log(
    "Feeding " +
    colorReadable +
    " " +
    speciesReadable +
    " " +
    amount +
    " " +
    food
  );
  return fetch(
    "https://habitica.com/api/v3/user/feed/" +
    pet +
    "/" +
    food +
    "?amount=" +
    amount,
    POST_PARAMS
  );
}

/**
 * getFavoriteFoods(color)
 *
 * Returns an array of food keys that are favorites for the given color.
 */
function getFavoriteFoods(color) {
  let favorites = [];
  let contentData = getContent();
  for (let [foodKey, foodData] of Object.entries(contentData.food)) {
    if (foodKey !== "Saddle" && foodData.target === color) {
      favorites.push(foodKey);
    }
  }
  return favorites;
}
