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
    if (numEachEggNeededTotal.hasOwnProperty(species)) {
      numEachEggNeededTotal[species] = numEachEggNeededTotal[species] + 2;
    } else {
      numEachEggNeededTotal[species] = 2;
    }
    if (numEachPotionNeededTotal.hasOwnProperty(color)) {
      numEachPotionNeededTotal[color] = numEachPotionNeededTotal[color] + 2;
    } else {
      numEachPotionNeededTotal[color] = 2;
    }
  }
  for (let pet of petLists.wackyPets) {
    let [species, color] = pet.split("-");
    if (numEachEggNeededTotal.hasOwnProperty(species)) {
      numEachEggNeededTotal[species] = numEachEggNeededTotal[species] + 1;
    } else {
      numEachEggNeededTotal[species] = 1;
    }
    if (numEachPotionNeededTotal.hasOwnProperty(color)) {
      numEachPotionNeededTotal[color] = numEachPotionNeededTotal[color] + 1;
    } else {
      numEachPotionNeededTotal[color] = 1;
    }
  }

  // get # each egg & hatching potion owned/used, pets & mounts owned, # each food type needed, # extra food needed
  let numEachEggOwnedUsed = JSON.parse(JSON.stringify(contentData.eggs));
  let eggsOwned = getUser(true).items.eggs;
  for (let egg of Object.keys(numEachEggOwnedUsed)) {
    numEachEggOwnedUsed[egg] = eggsOwned[egg] ? eggsOwned[egg] : 0;
  }
  let numEachPotionOwnedUsed = JSON.parse(
    JSON.stringify(contentData.hatchingPotions)
  );
  let potionsOwned = user.items.hatchingPotions;
  for (let potion of Object.keys(numEachPotionOwnedUsed)) {
    numEachPotionOwnedUsed[potion] = potionsOwned[potion]
      ? potionsOwned[potion]
      : 0;
  }
  let nonSpecialPetsOwned = [];
  for (let [pet, amount] of Object.entries(user.items.pets)) {
    if (amount > 0 && petLists.allNonSpecialPets.includes(pet)) {
      // 0 = released pet, 5 = newly hatched pet, >5 = fed pet, -1 = mount but no pet
      nonSpecialPetsOwned.push(pet);
      let [species, color] = pet.split("-");
      if (numEachEggOwnedUsed.hasOwnProperty(species)) {
        numEachEggOwnedUsed[species] = numEachEggOwnedUsed[species] + 1;
      } else {
        numEachEggOwnedUsed[species] = 1;
      }
      if (numEachPotionOwnedUsed.hasOwnProperty(color)) {
        numEachPotionOwnedUsed[color] = numEachPotionOwnedUsed[color] + 1;
      } else {
        numEachPotionOwnedUsed[color] = 1;
      }
    }
  }
  let nonSpecialMountsOwned = [];
  for (let [mount, owned] of Object.entries(user.items.mounts)) {
    if (owned && petLists.allNonSpecialPets.includes(mount)) {
      nonSpecialMountsOwned.push(mount);
    }
  }
  let numEachFoodTypeNeededTotal =
    Object.keys(numEachEggNeededTotal).length * 9;
  let numEachFoodTypeNeeded = {};
  for (let color of basicColors) {
    numEachFoodTypeNeeded[color] = numEachFoodTypeNeededTotal;
  }
  let numExtraFoodNeeded =
    Object.keys(contentData.premiumHatchingPotions).length *
    Object.keys(contentData.dropEggs).length *
    9;
  for (let mount of nonSpecialMountsOwned) {
    let [species, color] = mount.split("-");
    if (numEachEggOwnedUsed.hasOwnProperty(species)) {
      numEachEggOwnedUsed[species] = numEachEggOwnedUsed[species] + 1;
    } else {
      numEachEggOwnedUsed[species] = 1;
    }
    if (numEachPotionOwnedUsed.hasOwnProperty(color)) {
      numEachPotionOwnedUsed[color] = numEachPotionOwnedUsed[color] + 1;
    } else {
      numEachPotionOwnedUsed[color] = 1;
    }
    if (basicColors.includes(color)) {
      numEachFoodTypeNeeded[color] = numEachFoodTypeNeeded[color] - 9;
    } else {
      numExtraFoodNeeded -= 9;
    }
  }

  // get # each usable food owned & # each usable food type owned
  let numEachUsableFoodOwned = {};
  let numEachFoodTypeOwned = {};
  for (let [food, amount] of Object.entries(user.items.food)) {
    if (
      food != "Saddle" &&
      (ONLY_USE_DROP_FOOD !== true || contentData.food[food].canDrop)
    ) {
      if (amount > 0) {
        numEachUsableFoodOwned[food] = amount;
      }
      let target = contentData.food[food].target;
      if (numEachFoodTypeOwned.hasOwnProperty(target)) {
        numEachFoodTypeOwned[target] = numEachFoodTypeOwned[target] + amount;
      } else {
        numEachFoodTypeOwned[target] = amount;
      }
    }
  }

  // get # extra food owned, # extra extra food needed/owned
  let numExtraFoodOwned = 0;
  let numExtraExtraFoodNeeded = 0;
  for (let [food, amount] of Object.entries(numEachFoodTypeOwned)) {
    let extra = amount - numEachFoodTypeNeeded[food];
    if (extra > 0) {
      numExtraFoodOwned += extra;
    } else if (extra < 0) {
      numExtraExtraFoodNeeded += Math.abs(extra);
    }
  }
  numExtraExtraFoodNeeded *= 23 / 9;
  let numExtraExtraFoodOwned = Math.max(
    0,
    numExtraFoodOwned - numExtraFoodNeeded
  );

  // for each non-special pet in content
  for (let pet of petLists.allNonSpecialPets) {
    let [species, color] = pet.split("-");
    let speciesReadable = makeReadable(species);
    let colorReadable = makeReadable(color);
    let hunger = 50;

    // if player has all needed eggs & potions for that species & color
    if (
      numEachEggOwnedUsed[species] - numEachEggNeededTotal[species] >= 0 &&
      numEachPotionOwnedUsed[color] - numEachPotionNeededTotal[color] >= 0
    ) {
      // if player doesn't have pet
      if (!nonSpecialPetsOwned.includes(pet)) {
        // hatch pet
        hatchPet(species, color);
        hunger = 45;
      }

      // if non-wacky & player doesn't have mount
      if (
        !petLists.wackyPets.includes(pet) &&
        !nonSpecialMountsOwned.includes(pet)
      ) {
        // get pet hunger
        if (hunger == 50) {
          let fed = user.items.pets[pet];
          if (typeof fed !== "undefined" && fed > 0) {
            hunger -= fed;
          }
        }

        // if basic color pet
        let grewToMount = false;
        if (basicColors.includes(color)) {
          // if player has enough preferred food for all basic pets of this color
          if (numEachFoodTypeOwned[color] >= numEachFoodTypeNeeded[color]) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / 5);

            // for each usable food owned
            for (let [food, amount] of Object.entries(numEachUsableFoodOwned)) {
              // if correct food type
              if (contentData.food[food].target == color) {
                // calculate feedings
                let feedings = Math.min(feedingsNeeded, amount);

                // feed this food
                feedPet(pet, food, feedings, speciesReadable, colorReadable);

                // update data
                feedingsNeeded -= feedings;
                numEachUsableFoodOwned[food] -= feedings;
                if (numEachUsableFoodOwned[food] <= 0) {
                  delete numEachUsableFoodOwned[food];
                }
                let target = contentData.food[food].target;
                numEachFoodTypeOwned[target] -= feedings;
                numEachFoodTypeNeeded[target] -= feedings;

                // stop feeding if full
                if (feedingsNeeded <= 0) {
                  grewToMount = true;
                  break;
                }
              }
            }

            // if player has enough extra extra food
          } else if (numExtraExtraFoodOwned >= numExtraExtraFoodNeeded) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / 2);

            // feed until mount
            grewToMount = feedExtraFoodConservative(
              pet,
              feedingsNeeded,
              speciesReadable,
              colorReadable,
              numEachUsableFoodOwned,
              numEachFoodTypeOwned,
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
                numEachFoodTypeOwned[color] +
                ")"
            );
          }

          // if premium color mount
        } else {
          // if player has enough extra food
          if (numExtraFoodOwned >= numExtraFoodNeeded) {
            // calculate feedings needed
            let feedingsNeeded = Math.ceil(hunger / 5);

            // feed until mount
            grewToMount = feedExtraFoodConservative(
              pet,
              feedingsNeeded,
              speciesReadable,
              colorReadable,
              numEachUsableFoodOwned,
              numEachFoodTypeOwned,
              numEachFoodTypeNeeded,
              contentData
            );

            // not enough food to feed premium color mount
          } else {
            console.log(
              "Cannot feed " +
                colorReadable +
                " " +
                speciesReadable +
                ": not enough extra food (need " +
                numExtraFoodNeeded +
                " extra food, ie. food that would be left over when all unowned basic color mounts are fed their favorite foods; have " +
                numExtraFoodOwned +
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
      !nonSpecialPetsOwned.includes(pet) ||
      (!petLists.wackyPets.includes(pet) &&
        !nonSpecialMountsOwned.includes(pet))
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
            (user.items.eggs[species] || 0)) +
          ", have " +
          (user.items.eggs[species] || 0) +
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
            (user.items.hatchingPotions[color] || 0)) +
          ", have " +
          (user.items.hatchingPotions[color] || 0) +
          ")";
      }
      console.log(message);
    }
  }
}

/**
 * feedExtraFoodConservative(pet, feedingsNeeded, speciesReadable, colorReadable, numEachUsableFoodOwned, numEachFoodTypeOwned, numEachFoodTypeNeeded, contentData)
 *
 * Feeds a pet with extra food (food not needed for basic color mounts).
 * Used by the conservative strategy. Returns true if pet became a mount.
 */
function feedExtraFoodConservative(
  pet,
  feedingsNeeded,
  speciesReadable,
  colorReadable,
  numEachUsableFoodOwned,
  numEachFoodTypeOwned,
  numEachFoodTypeNeeded,
  contentData
) {
  // for each usable food owned, sort by amount (highest first)
  let foodsOwnedSorted = [];
  for (let [food, amount] of Object.entries(numEachUsableFoodOwned)) {
    // add to sorted food list (binary insertion)
    let low = 0;
    let high = foodsOwnedSorted.length;
    while (low < high) {
      let mid = Math.floor((low + high) / 2);
      if (foodsOwnedSorted[mid][1] > amount) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    foodsOwnedSorted.splice(low, 0, [food, amount]);
  }

  // for each food in sorted list
  for (let [food, amount] of foodsOwnedSorted) {
    // if extra
    let target = contentData.food[food].target;
    let extra = numEachFoodTypeOwned[target] - numEachFoodTypeNeeded[target];
    if (extra > 0) {
      // calculate feedings
      let feedings = Math.min(feedingsNeeded, amount, extra);

      // feed this food
      feedPet(pet, food, feedings, speciesReadable, colorReadable);

      // update data
      feedingsNeeded -= feedings;
      numEachUsableFoodOwned[food] -= feedings;
      if (numEachUsableFoodOwned[food] <= 0) {
        delete numEachUsableFoodOwned[food];
      }
      numEachFoodTypeOwned[target] -= feedings;

      // stop feeding if full
      if (feedingsNeeded <= 0) {
        return true;
      }
    }
  }
  return false;
}
