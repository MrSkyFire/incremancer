/* NecroMage kill, level, and spell progression. Visuals live in SkeletonChampion. */
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
    var persistent = necro.persistent;

    if (!persistent.skeletons || persistent.skeletons < 1) {
      persistent.skeletons = 1;
      persistent.xpRate = Math.max(1, persistent.xpRate || 0);
      necro.model.sendMessage("NecroMage joins the fight!", "chat-levelup");
      necro.upgrades.applyUpgrades();
      necro.model.saveData();
    }

    persistent.killProgress = persistent.killProgress || 0;
    persistent.totalKills = persistent.totalKills || 0;
    necro.killsForNextLevel = function () {
      return Math.max(10, Math.round(10 * Math.pow(this.persistent.level, 1.35)));
    };
    necro.spellProgression = function () {
      var level = this.persistent.level;
      return [
        { id: 1, name: "Time Warp", unlockLevel: 1, unlocked: level >= 1, chance: Math.min(.25, .01 + (level - 1) * .0025), cap: .25 },
        { id: 2, name: "Energy Charge", unlockLevel: 3, unlocked: level >= 3, chance: Math.min(.20, .005 + Math.max(0, level - 3) * .002), cap: .20 },
        { id: 5, name: "Gigazombies", unlockLevel: 7, unlocked: level >= 7, chance: Math.min(.15, .005 + Math.max(0, level - 7) * .0015), cap: .15 }
      ];
    };
    necro.manualDurationBonus = function () {
      return Math.floor(Math.max(0, this.persistent.level - 1) / 2);
    };
    necro.syncSpellUnlocks = function () {
      var spells = this.spellProgression();
      for (var i = 0; i < spells.length; i++) {
        var spell = this.spells.getSpell ? this.spells.getSpell(spells[i].id) : this.spells.spellMap.get(spells[i].id);
        if (spell && spells[i].unlocked) spell.unlocked = true;
      }
    };
    necro.tryProgressionSpells = function () {
      if (this.spellTimer >= 0) return;
      var spells = this.spellProgression();
      for (var i = 0; i < spells.length; i++) {
        if (spells[i].unlocked && Math.random() < spells[i].chance) {
          this.spells.castSpellNoMana(spells[i].id);
          this.spellTimer = 3;
          return;
        }
      }
    };
    necro.gainKill = function () {
      this.persistent.totalKills++;
      this.persistent.killProgress++;
      while (this.persistent.killProgress >= this.killsForNextLevel()) {
        var required = this.killsForNextLevel();
        this.persistent.killProgress -= required;
        this.persistent.level++;
        this.upgrades.applyUpgrades();
        this.syncSpellUnlocks();
        this.model.sendMessage("NecroMage reached level " + this.persistent.level + "!", "chat-levelup");
      }
      this.tryProgressionSpells();
    };
    necro.addXp = function () { this.gainKill(); };

    var applyItems = necro.applyItemUpgrades.bind(necro);
    necro.applyItemUpgrades = function () { applyItems(); this.randomSpells = []; };
    necro.randomSpells = [];

    if (!necro.spells._necroManualDurationInstalled) {
      necro.spells._necroManualDurationInstalled = true;
      var castSpell = necro.spells.castSpell.bind(necro.spells);
      necro.spells.castSpell = function (spell) {
        var original = this.timeExtension;
        this.timeExtension = original + necro.manualDurationBonus();
        try { return castSpell(spell); } finally { this.timeExtension = original; }
      };
    }

    necro.syncSpellUnlocks();
    controller.skeletonMenu.killsForNextLevel = function () { return necro.killsForNextLevel(); };
    controller.skeletonMenu.spellProgression = function () { return necro.spellProgression(); };
    controller.skeletonMenu.manualDurationBonus = function () { return necro.manualDurationBonus(); };
    controller.skeletonMenu.xpPercent = function () {
      return Math.min(100, Math.round(100 * necro.persistent.killProgress / necro.killsForNextLevel()));
    };
    console.log("[Incremancer] NecroMage progression installed");
  }

  angular.module("zombieApp").run(["$rootScope", "$timeout", function (root, timeout) {
    var attempts = 0;
    function boot() {
      var controller = findController(root);
      if (controller) return install(controller);
      if (++attempts < 80) timeout(boot, 100, false);
      else console.error("[Incremancer] NecroMage could not find ZombieController");
    }
    timeout(boot, 0, false);
  }]);
}());
