/* NecroMage progression layer.
 * Loaded after the main bundle. Registers an Angular run hook before bootstrap.
 */
(function () {
  "use strict";

  function findController(root) {
    var queue = [root];
    while (queue.length) {
      var scope = queue.shift();
      if (scope && scope.zm && scope.zm.model && scope.zm.model.skeleton) return scope.zm;
      if (!scope) continue;
      var child = scope.$$childHead;
      while (child) {
        queue.push(child);
        child = child.$$nextSibling;
      }
    }
    return null;
  }

  function install(controller) {
    var necro = controller.model.skeleton;
    if (!necro || necro._killProgressionInstalled) return;
    necro._killProgressionInstalled = true;

    var p = necro.persistent;

    if (!p.skeletons || p.skeletons < 1) {
      p.skeletons = 1;
      p.xpRate = Math.max(1, p.xpRate || 0);
      necro.model.sendMessage("NecroMage joins the fight!", "chat-levelup");
      necro.upgrades.applyUpgrades();
      necro.model.saveData();
    }

    p.killProgress = p.killProgress || 0;
    p.totalKills = p.totalKills || 0;

    necro.killsForNextLevel = function () {
      return Math.max(10, Math.round(10 * Math.pow(this.persistent.level, 1.35)));
    };

    necro.spellProgression = function () {
      var level = this.persistent.level;
      return [
        { id: 1, name: "Time Warp", unlockLevel: 1, unlocked: level >= 1, chance: Math.min(0.25, 0.01 + (level - 1) * 0.0025), cap: 0.25 },
        { id: 2, name: "Energy Charge", unlockLevel: 3, unlocked: level >= 3, chance: Math.min(0.20, 0.005 + Math.max(0, level - 3) * 0.002), cap: 0.20 },
        { id: 5, name: "Gigazombies", unlockLevel: 7, unlocked: level >= 7, chance: Math.min(0.15, 0.005 + Math.max(0, level - 7) * 0.0015), cap: 0.15 }
      ];
    };

    necro.manualDurationBonus = function () {
      return Math.floor(Math.max(0, this.persistent.level - 1) / 2);
    };

    necro.syncSpellUnlocks = function () {
      var spells = this.spellProgression();
      for (var i = 0; i < spells.length; i++) {
        var live = this.spells.getSpell ? this.spells.getSpell(spells[i].id) : this.spells.spellMap.get(spells[i].id);
        if (live && spells[i].unlocked) live.unlocked = true;
      }
    };

    necro.tryProgressionSpells = function () {
      if (this.spellTimer >= 0) return;
      var spells = this.spellProgression();
      for (var x = 0; x < spells.length; x++) {
        var spell = spells[x];
        if (spell.unlocked && Math.random() < spell.chance) {
          this.spells.castSpellNoMana(spell.id);
          this.spellTimer = 3;
          return;
        }
      }
    };

    necro.gainKill = function () {
      this.persistent.totalKills++;
      this.persistent.killProgress++;

      while (this.persistent.killProgress >= this.killsForNextLevel()) {
        var needed = this.killsForNextLevel();
        this.persistent.killProgress -= needed;
        this.persistent.level++;
        this.upgrades.applyUpgrades();
        this.syncSpellUnlocks();
        this.model.sendMessage("NecroMage reached level " + this.persistent.level + "!", "chat-levelup");
      }

      this.tryProgressionSpells();
    };

    necro.addXp = function () {
      this.gainKill();
    };

    var oldApplyItems = necro.applyItemUpgrades.bind(necro);
    necro.applyItemUpgrades = function () {
      oldApplyItems();
      this.randomSpells = [];
    };
    necro.randomSpells = [];

    if (!necro.spells._necroManualDurationInstalled) {
      necro.spells._necroManualDurationInstalled = true;
      var oldManualCast = necro.spells.castSpell.bind(necro.spells);
      necro.spells.castSpell = function (spell) {
        var oldExtension = this.timeExtension;
        this.timeExtension = oldExtension + necro.manualDurationBonus();
        try {
          return oldManualCast(spell);
        } finally {
          this.timeExtension = oldExtension;
        }
      };
    }

    necro.syncSpellUnlocks();

    controller.skeletonMenu.killsForNextLevel = function () {
      return necro.killsForNextLevel();
    };
    controller.skeletonMenu.spellProgression = function () {
      return necro.spellProgression();
    };
    controller.skeletonMenu.manualDurationBonus = function () {
      return necro.manualDurationBonus();
    };
    controller.skeletonMenu.xpPercent = function () {
      return Math.min(100, Math.round(100 * necro.persistent.killProgress / necro.killsForNextLevel()));
    };

    console.log("[Incremancer] NecroMage progression installed");
  }

  angular.module("zombieApp").run(["$rootScope", "$timeout", function ($rootScope, $timeout) {
    var attempts = 0;
    function boot() {
      var controller = findController($rootScope);
      if (controller) {
        install(controller);
        return;
      }
      if (++attempts < 80) $timeout(boot, 100, false);
      else console.error("[Incremancer] NecroMage progression could not find ZombieController");
    }
    $timeout(boot, 0, false);
  }]);
})();
