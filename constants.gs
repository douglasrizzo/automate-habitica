// GLOBAL CONSTANTS

/** Number of milliseconds in one second */
const MS_PER_SECOND = 1000;

/** Number of milliseconds in one minute */
const MS_PER_MINUTE = MS_PER_SECOND * 60;

/** Milliseconds per hour for time calculations */
const MS_PER_HOUR = MS_PER_MINUTE * 60;

/** Milliseconds per day for time calculations */
const MS_PER_DAY = MS_PER_HOUR * 24;

/** Maximum health points for any player. @see https://habitica.fandom.com/wiki/Health_Points */
const MAX_HP = 50;

/** Base mana points all players start with (before INT bonus). @see https://habitica.fandom.com/wiki/Mana_Points */
const BASE_MANA = 30;

/** Maximum stat bonus from level (caps at level 100). @see https://habitica.fandom.com/wiki/Stats */
const MAX_LEVEL_STAT_BONUS = 50;

/** Level at which stat point allocation becomes available. @see https://habitica.fandom.com/wiki/Stats#Allocating_Stat_Points */
const STAT_ALLOCATION_MIN_LEVEL = 10;

/** Level at which first class skill is unlocked (all classes). @see https://habitica.fandom.com/wiki/Class_System#Skills */
const SKILL_1_LEVEL = 11;

/** Level at which second class skill is unlocked (all classes). @see https://habitica.fandom.com/wiki/Class_System#Skills */
const SKILL_2_LEVEL = 12;

/** Level at which third class skill is unlocked (all classes). @see https://habitica.fandom.com/wiki/Class_System#Skills */
const SKILL_3_LEVEL = 13;

/** Level at which fourth class skill is unlocked (all classes). @see https://habitica.fandom.com/wiki/Class_System#Skills */
const SKILL_4_LEVEL = 14;

/** Level at which perfect day buff and CON scaling max out. @see https://habitica.fandom.com/wiki/Perfect_Day */
const LEVEL_CAP_FOR_BONUSES = 100;

/** Gold cost to purchase one gem (subscribers only). @see https://habitica.fandom.com/wiki/Gems#Subscribers */
const GOLD_PER_GEM = 20;

/** Gold cost to purchase one Enchanted Armoire. @see https://habitica.fandom.com/wiki/Enchanted_Armoire */
const ARMOIRE_COST = 100;

/** Mana percentage retained after cron (90%). @see https://habitica.fandom.com/wiki/Mana_Points#Restoring_Mana */
const MANA_RETENTION_RATE = 0.9;

/** GAS script execution timeout threshold in ms (4.5 minutes to leave buffer before 6 min limit) */
const SCRIPT_TIMEOUT_MS = 270000;

/** Lock timeout for installation in ms (6 minutes) */
const INSTALL_LOCK_TIMEOUT_MS = 360000;

/** Delay for retry when server address is unavailable in ms */
const SERVER_RETRY_DELAY_MS = 5000;

/** HTTP status code for rate limiting */
const HTTP_RATE_LIMITED = 429;

/** HTTP status code threshold for success responses */
const HTTP_SUCCESS_MAX = 300;

/** HTTP status code threshold for server errors */
const HTTP_SERVER_ERROR_MIN = 500;

/** Minimum delay before quest invite trigger in ms (5 minutes) */
const QUEST_INVITE_MIN_DELAY_MS = 300000;

/** Maximum additional random delay for quest invite trigger in ms (10 minutes) */
const QUEST_INVITE_RANDOM_DELAY_MS = 600000;

/** Number of eggs needed per species to have all basic color pets/mounts. @see https://habitica.fandom.com/wiki/Pets */
const EGGS_FOR_COMPLETE_SPECIES = 20;

/** Number of potions needed per premium/magic potion color to have all standard pets/mounts. @see https://habitica.fandom.com/wiki/Hatching_Potions#Magic_Hatching_Potions */
const POTIONS_FOR_COMPLETE_PREMIUM = 18;

/** Number of potions needed per wacky potion color (no mounts for wacky). @see https://habitica.fandom.com/wiki/Hatching_Potions#Wacky_Hatching_Potions */
const POTIONS_FOR_COMPLETE_WACKY = 9;

/** Default boss HP estimate when no boss data is available. @see https://habitica.fandom.com/wiki/Quests */
const DEFAULT_BOSS_HP = 3000;


// HEALER SKILL CONSTANTS

/** Mana cost for Healing Light skill. @see https://habitica.fandom.com/wiki/Healing_Light */
const MANA_COST_HEALING_LIGHT = 15;

/** Mana cost for Blessing skill. @see https://habitica.fandom.com/wiki/Blessing */
const MANA_COST_BLESSING = 25;

/** Mana cost for Protective Aura skill. @see https://habitica.fandom.com/wiki/Protective_Aura */
const MANA_COST_PROTECTIVE_AURA = 30;

/** Hours of healing mana to reserve for party healing */
const HEALING_RESERVE_HOURS = 16;

/** Multiplier for Blessing healing: health = (con + int + statBonus) * multiplier. @see https://habitica.fandom.com/wiki/Blessing */
const BLESSING_HEAL_MULTIPLIER = 0.04;

/** Stat bonus added in Blessing formula. @see https://habitica.fandom.com/wiki/Blessing */
const BLESSING_STAT_BONUS = 5;

/** Multiplier for Healing Light healing: health = (con + int + statBonus) * multiplier. @see https://habitica.fandom.com/wiki/Healing_Light */
const HEALING_LIGHT_MULTIPLIER = 0.075;


// ROGUE SKILL CONSTANTS

/** Mana cost for Pickpocket skill. @see https://habitica.fandom.com/wiki/Pickpocket */
const MANA_COST_PICKPOCKET = 10;

/** Mana cost for Backstab skill. @see https://habitica.fandom.com/wiki/Backstab */
const MANA_COST_BACKSTAB = 15;

/** Mana cost for Tools of the Trade skill. @see https://habitica.fandom.com/wiki/Tools_of_the_Trade */
const MANA_COST_TOOLS_OF_TRADE = 25;

/** Mana cost for Stealth skill. @see https://habitica.fandom.com/wiki/Stealth */
const MANA_COST_STEALTH = 45;

/** Base rate for Stealth dodge formula: numDodged = baseRate * totalDailies * per / (per + perDivisor). @see https://habitica.fandom.com/wiki/Stealth */
const STEALTH_BASE_RATE = 0.64;

/** PER divisor for Stealth dodge formula. @see https://habitica.fandom.com/wiki/Stealth */
const STEALTH_PER_DIVISOR = 55;


// WARRIOR SKILL CONSTANTS

/** Mana cost for Brutal Smash skill. @see https://habitica.fandom.com/wiki/Brutal_Smash */
const MANA_COST_BRUTAL_SMASH = 10;

/** Mana cost for Defensive Stance skill. @see https://habitica.fandom.com/wiki/Defensive_Stance */
const MANA_COST_DEFENSIVE_STANCE = 25;

/** Mana cost for Valorous Presence skill. @see https://habitica.fandom.com/wiki/Valorous_Presence */
const MANA_COST_VALOROUS_PRESENCE = 20;

/** Base damage for Brutal Smash formula: damage = baseDamage * str / (str + strDivisor). @see https://habitica.fandom.com/wiki/Brutal_Smash */
const BRUTAL_SMASH_BASE_DAMAGE = 55;

/** STR divisor for Brutal Smash formula. @see https://habitica.fandom.com/wiki/Brutal_Smash */
const BRUTAL_SMASH_STR_DIVISOR = 70;


// MAGE SKILL CONSTANTS

/** Mana cost for Burst of Flames skill. @see https://habitica.fandom.com/wiki/Burst_of_Flames */
const MANA_COST_BURST_OF_FLAMES = 10;

/** Mana cost for Ethereal Surge skill. @see https://habitica.fandom.com/wiki/Ethereal_Surge */
const MANA_COST_ETHEREAL_SURGE = 30;

/** Mana cost for Earthquake skill. @see https://habitica.fandom.com/wiki/Earthquake */
const MANA_COST_EARTHQUAKE = 35;

/** Mana cost for Chilling Frost skill. @see https://habitica.fandom.com/wiki/Chilling_Frost */
const MANA_COST_CHILLING_FROST = 40;

/** Divisor for Burst of Flames damage calculation: damage = int / intDivisor. @see https://habitica.fandom.com/wiki/Burst_of_Flames */
const BURST_OF_FLAMES_INT_DIVISOR = 10;


// PARTY REPORT CONSTANTS

/** Maximum number of random scroll owners to display per quest */
const MAX_SCROLL_OWNERS_DISPLAY = 3;

/** Emoji options for random selection in report header */
const REPORT_EMOJIS = ["🎯", "⚔️", "🗡️", "🐉", "🏰", "🧙", "🦄", "🔮", "✨", "🌟", "💎", "🏆", "📜", "🎲", "🧭"];


// PAUSE/RESUME DAMAGE CONSTANTS

/** Default boss strength when no boss data is available. @see https://habitica.fandom.com/wiki/Quests */
const DEFAULT_BOSS_STR = 4;

/** Minimum task value used in damage calculation formula. @see https://habitica.fandom.com/wiki/Task_Value */
const TASK_VALUE_MIN = -47.27;

/** Maximum task value used in damage calculation formula. @see https://habitica.fandom.com/wiki/Task_Value */
const TASK_VALUE_MAX = 21.27;

/** Base exponent for damage calculation: Math.pow(this, taskValue). @see https://habitica.fandom.com/wiki/Resting_in_the_Inn#Pending_Damage */
const DAMAGE_CALC_EXPONENT = 0.9747;

/** Multiplier for player damage calculation. @see https://habitica.fandom.com/wiki/Resting_in_the_Inn#Pending_Damage */
const PLAYER_DAMAGE_MULTIPLIER = 2;

/** Minimum CON reduction factor (10% of damage at max CON). @see https://habitica.fandom.com/wiki/Constitution */
const MIN_CON_REDUCTION = 0.1;

/** CON divisor for damage reduction calculation. @see https://habitica.fandom.com/wiki/Constitution */
const CON_DAMAGE_DIVISOR = 250;

/** Factor for rounding damage to one decimal place */
const DAMAGE_ROUNDING_PRECISION = 10;


// PURCHASE GEMS CONSTANTS

/** Base gem cap for subscribers per month. @see https://habitica.fandom.com/wiki/Gems#Subscribers */
const BASE_GEM_CAP = 24;


// HATCH/FEED PETS CONSTANTS

/** Points when feeding a basic color pet its favorite food. @see https://habitica.fandom.com/wiki/Food#Feeding */
const FOOD_POINTS_FAVORITE = 5;

/** Points when feeding a basic color pet non-favorite food. @see https://habitica.fandom.com/wiki/Food#Feeding */
const FOOD_POINTS_NON_FAVORITE = 2;

/** Points when feeding magic potion pets any food (no preferences). @see https://habitica.fandom.com/wiki/Food#Feeding */
const FOOD_POINTS_MAGIC_POTION_PET = 5;

/** Total food points needed for a pet to become a mount. @see https://habitica.fandom.com/wiki/Mounts */
const MOUNT_THRESHOLD = 50;

/** Starting fed amount when a pet is first hatched. @see https://habitica.fandom.com/wiki/Pets */
const NEWLY_HATCHED_FED = 5;

/** Hunger remaining after hatching (MOUNT_THRESHOLD - NEWLY_HATCHED_FED) */
const HUNGER_AFTER_HATCH = MOUNT_THRESHOLD - NEWLY_HATCHED_FED;

/** Number of favorite food feedings to raise a pet to mount */
const FEEDINGS_TO_MOUNT_FAVORITE = Math.ceil(HUNGER_AFTER_HATCH / FOOD_POINTS_FAVORITE);

/** Number of non-favorite food feedings needed */
const FEEDINGS_TO_MOUNT_NON_FAVORITE = Math.ceil(HUNGER_AFTER_HATCH / FOOD_POINTS_NON_FAVORITE);

/** Multiplier to convert favorite feeding counts to non-favorite */
const NON_FAVORITE_TO_FAVORITE_RATIO = FEEDINGS_TO_MOUNT_NON_FAVORITE / FEEDINGS_TO_MOUNT_FAVORITE;

/** Eggs/potions needed per non-wacky pet (1 for pet + 1 for mount = 2). @see https://habitica.fandom.com/wiki/Pets */
const RESOURCES_PER_NON_WACKY = 2;

/** Eggs/potions needed per wacky pet (1 for pet only, can't become mount). @see https://habitica.fandom.com/wiki/Hatching_Potions#Wacky_Hatching_Potions */
const RESOURCES_PER_WACKY = 1;
