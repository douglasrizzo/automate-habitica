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
 * 1. Standard pets (basic colors) - favorite food only (+5 per feeding)
 * 2. Quest pets (basic colors) - favorite food only (+5 per feeding)
 * 3. Magic potion pets (premium colors) - any leftover food (+2 per feeding)
 * 4. Wacky pets - skipped (cannot become mounts)
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

  // get content and pet data using shared functions
  let contentData = getContent();
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

      petsToHatch.push({
        pet: pet,
        species: species,
        color: color,
        priorityGroup: priorityGroup,
      });
    }
  }

  // sort by priority group, then alphabetically by species within each group
  petsToHatch.sort((a, b) => {
    // sort by priority group first
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

  for (let hatchInfo of petsToHatch) {
    let { pet, species, color, priorityGroup } = hatchInfo;

    // double-check we still have resources (they get consumed as we hatch)
    if ((eggsOwned[species] || 0) <= 0 || (potionsOwned[color] || 0) <= 0) {
      continue;
    }

    // log when entering a new priority group
    if (priorityGroup !== currentPriorityGroup) {
      currentPriorityGroup = priorityGroup;
      console.log("Hatching " + priorityGroupNames[priorityGroup] + "...");
    }

    hatchPet(species, color);

    // update local tracking
    eggsOwned[species] = (eggsOwned[species] || 0) - 1;
    potionsOwned[color] = (potionsOwned[color] || 0) - 1;
    petsOwned[pet] = 5; // newly hatched pet starts at 5

    // check for interrupt
    if (interruptLoop()) {
      return;
    }
  }

  // ==================== FEEDING ====================

  // categorize pets into feeding priority groups
  let standardBasicPets = []; // Priority 1: standard pets with basic colors
  let questPets = []; // Priority 2: quest pets (always basic colors)
  let magicPotionPets = []; // Priority 3: magic potion pets (premium colors)

  for (let [pet, fedAmount] of Object.entries(petsOwned)) {
    // wacky pets can't become mounts - skip
    if (petLists.wackyPets.includes(pet)) {
      continue;
    }

    // skip if already have the mount
    if (mountsOwned.hasOwnProperty(pet)) {
      continue;
    }

    let [species, color] = pet.split("-");
    let hunger = 50 - fedAmount; // how much more food needed to become mount

    if (hunger <= 0) {
      continue;
    }

    let petInfo = {
      pet: pet,
      species: species,
      color: color,
      hunger: hunger,
    };

    let isBasicColor = basicColors.includes(color);

    // categorize by pet type and color
    if (standardPetSet.has(pet)) {
      if (isBasicColor) {
        standardBasicPets.push(petInfo);
      } else {
        magicPotionPets.push(petInfo);
      }
    } else if (questPetSet.has(pet)) {
      // quest pets are always basic colors
      questPets.push(petInfo);
    } else if (premiumPetSet.has(pet)) {
      // premium pets are always premium/magic potion colors
      magicPotionPets.push(petInfo);
    }
  }

  // sort each group by hunger (lowest first = closest to mount)
  standardBasicPets.sort((a, b) => a.hunger - b.hunger);
  questPets.sort((a, b) => a.hunger - b.hunger);
  magicPotionPets.sort((a, b) => a.hunger - b.hunger);

  // combine basic color pets (standard + quest) for tracking food needs
  let allBasicColorPets = standardBasicPets.concat(questPets);

  // track which basic colors still have pets that need feeding
  let colorsStillNeedingFood = new Set();
  for (let petInfo of allBasicColorPets) {
    colorsStillNeedingFood.add(petInfo.color);
  }

  // ==================== PRIORITY 1: STANDARD PETS (BASIC COLORS) ====================
  console.log("Feeding standard pets (basic colors)...");

  for (let feedInfo of standardBasicPets) {
    feedBasicColorPet(
      feedInfo,
      foodOwned,
      eggsOwned,
      potionsOwned,
      colorsStillNeedingFood,
      allBasicColorPets
    );
    if (interruptLoop()) return;
  }

  // ==================== PRIORITY 2: QUEST PETS ====================
  console.log("Feeding quest pets...");

  for (let feedInfo of questPets) {
    feedBasicColorPet(
      feedInfo,
      foodOwned,
      eggsOwned,
      potionsOwned,
      colorsStillNeedingFood,
      allBasicColorPets
    );
    if (interruptLoop()) return;
  }

  // ==================== PRIORITY 3: MAGIC POTION PETS ====================
  console.log("Feeding magic potion pets...");

  for (let feedInfo of magicPotionPets) {
    let { pet, species, color, hunger } = feedInfo;

    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);

    // sort food by amount owned (use most abundant first)
    let sortedFood = Object.entries(foodOwned).sort((a, b) => b[1] - a[1]);

    for (let [food, amount] of sortedFood) {
      if (amount <= 0 || hunger <= 0) {
        continue;
      }

      // check if this food's favorite color still has pets that need it
      let foodTarget = getContent().food[food].target;
      if (colorsStillNeedingFood.has(foodTarget)) {
        // skip this food - it's needed by basic color pets
        continue;
      }

      // this food is "extra" - use it for magic potion pet (+2 per feeding)
      // use floor to avoid overshooting the 50-point cap with bulk feeding
      let bulkFeedings = Math.floor(hunger / 2);
      let feedings = Math.min(bulkFeedings, amount);

      if (feedings > 0) {
        feedPet(pet, food, feedings, speciesReadable, colorReadable);

        foodOwned[food] -= feedings;
        amount -= feedings; // update local amount for the final feeding check
        hunger -= feedings * 2;

        if (interruptLoop()) {
          return;
        }
      }

      // if there's remaining hunger (1 point) and we still have this food, feed 1 more
      // single feedings are allowed to push the pet over 50 to become a mount
      if (hunger > 0 && amount > 0) {
        feedPet(pet, food, 1, speciesReadable, colorReadable);

        foodOwned[food] -= 1;
        if (foodOwned[food] <= 0) {
          delete foodOwned[food];
        }
        hunger -= 2;

        if (interruptLoop()) {
          return;
        }
      }
    }

    // if pet became a mount, hatch a replacement if we have resources
    if (hunger <= 0) {
      if ((eggsOwned[species] || 0) > 0 && (potionsOwned[color] || 0) > 0) {
        console.log(
          "Hatching replacement " + colorReadable + " " + speciesReadable
        );
        hatchPet(species, color);

        eggsOwned[species] = (eggsOwned[species] || 0) - 1;
        potionsOwned[color] = (potionsOwned[color] || 0) - 1;

        if (interruptLoop()) {
          return;
        }
      }
    }
  }
}

/**
 * feedBasicColorPet(feedInfo, foodOwned, eggsOwned, potionsOwned, colorsStillNeedingFood, allBasicColorPets)
 *
 * Feeds a basic color pet with its favorite foods only.
 * Updates tracking variables and hatches replacement if pet becomes mount.
 */
function feedBasicColorPet(
  feedInfo,
  foodOwned,
  eggsOwned,
  potionsOwned,
  colorsStillNeedingFood,
  allBasicColorPets
) {
  let { pet, species, color, hunger } = feedInfo;

  let speciesReadable = makeReadable(species);
  let colorReadable = makeReadable(color);

  // get favorite foods for this color
  let favoriteFood = getFavoriteFoods(color);

  // feed ONLY with favorite foods (+5 per feeding)
  for (let food of favoriteFood) {
    let amount = foodOwned[food] || 0;
    if (amount > 0 && hunger > 0) {
      // use floor to avoid overshooting the 50-point cap with bulk feeding
      let bulkFeedings = Math.floor(hunger / 5);
      let feedings = Math.min(bulkFeedings, amount);

      if (feedings > 0) {
        feedPet(pet, food, feedings, speciesReadable, colorReadable);

        foodOwned[food] -= feedings;
        amount -= feedings; // update local amount for the final feeding check
        hunger -= feedings * 5;

        if (interruptLoop()) {
          return;
        }
      }

      // if there's remaining hunger (1-4 points) and we still have this food, feed 1 more
      // single feedings are allowed to push the pet over 50 to become a mount
      if (hunger > 0 && amount > 0) {
        feedPet(pet, food, 1, speciesReadable, colorReadable);

        foodOwned[food] -= 1;
        if (foodOwned[food] <= 0) {
          delete foodOwned[food];
        }
        hunger -= 5;

        if (interruptLoop()) {
          return;
        }
      }
    }
  }

  // if pet became a mount, hatch a replacement if we have resources
  if (hunger <= 0) {
    // check if any other pets of this color still need food
    let otherPetsOfSameColorNeedFood = allBasicColorPets.some(
      (p) => p.color === color && p.pet !== pet && p.hunger > 0
    );
    if (!otherPetsOfSameColorNeedFood) {
      colorsStillNeedingFood.delete(color);
    }

    // check if we can hatch a replacement pet
    if ((eggsOwned[species] || 0) > 0 && (potionsOwned[color] || 0) > 0) {
      console.log(
        "Hatching replacement " + colorReadable + " " + speciesReadable
      );
      hatchPet(species, color);

      eggsOwned[species] = (eggsOwned[species] || 0) - 1;
      potionsOwned[color] = (potionsOwned[color] || 0) - 1;
    }
  }

  // update hunger in the feedInfo for tracking
  feedInfo.hunger = hunger;
}
