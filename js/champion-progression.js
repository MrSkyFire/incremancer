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

  function install(controller, $rootScope) {
    var necro = controller.model.skeleton;
    if (!necro || necro._killProgressionInstalled) return;
    necro._killProgressionInstalled = true;

    var p = necro.persistent;

    // This fork is built around the NecroMage, so recruit him immediately on every save.
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

    // Core spells unlock early. Manual casts gain duration from NecroMage level;
    // automatic casts keep base duration and gain proc chance from NecroMage level.
    necro.spellProgression = function () {
      var level = this.persistent.level;
      return [
        { id: 1, name: "Time Warp", unlockLevel: 1, unlocked: level >= 1, chance: Math.min(0.25, 0.01 + (level - 1) * 0.0025), cap: 0.25 },
        { id: 2, name: "Energy Charge", unlockLevel: 3, unlocked: level >= 3, chance: Math.min(0.20, 0.005 + Math.max(0, level - 3) * 0.002), cap: 0.20 },
        { id: 5, name: "Gigazombies", unlockLevel: 7, unlocked: level >= 7, chance: Math.min(0.15, 0.005 + Math.max(0, level - 7) * 0.0015), cap: 0.15 }
      ];
    };

    necro.manualDurationBonus = function () {
      // +1 second every 2 NecroMage levels. This stacks with the Endurance talent.
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
          // No-mana casts intentionally do NOT receive the manual duration bonus.
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

    // The original Champion XP hook is invoked from the global human-death path.
    // Treat each death notification as one NecroMage kill-credit, regardless of who dealt it.
    necro.addXp = function () {
      this.gainKill();
    };

    // Do not double-count NecroMage personal kills: the global death hook above owns progression.
    // Keep the original killingBlow implementation for its loot/prestige/talent effects.

    // Equipment keeps its normal stats, but no longer supplies automatic spell rolls.
    var oldApplyItems = necro.applyItemUpgrades.bind(necro);
    necro.applyItemUpgrades = function () {
      oldApplyItems();
      this.randomSpells = [];
    };
    necro.randomSpells = [];

    // Add NecroMage level duration only to player/manual casts.
    // Existing Endurance timeExtension is preserved and stacks with this bonus.
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

    function ensureProgressionUI() {
      var hold = document.getElementById("champ-hold");
      if (!hold) return;

      var title = hold.querySelector(".shop-title h2");
      if (!title) return;

      var button = title.querySelector("[data-champion-progression-tab]");
      if (!button) {
        button = document.createElement("button");
        button.setAttribute("data-champion-progression-tab", "1");
        button.textContent = "Progression";
        title.appendChild(button);
      }

      // Always bind our own direct tab switch. This makes the Progression tab work
      // even if the bundled changeTab() method only knows about Inventory/Talents.
      if (!button._necroProgressionBound) {
        button._necroProgressionBound = true;
        button.addEventListener("click", function () {
          controller.skeletonMenu.tab = "progression";
          $rootScope.$applyAsync();
        });
      }
      button.className = controller.skeletonMenu.tab === "progression" ? "active" : "";

      var panel = hold.querySelector("[data-champion-progression-panel]");
      if (!panel) {
        panel = document.createElement("div");
        panel.setAttribute("data-champion-progression-panel", "1");
        panel.className = "ranges";
        hold.appendChild(panel);
      }

      var needed = necro.killsForNextLevel();
      var progress = necro.persistent.killProgress || 0;
      var total = necro.persistent.totalKills || 0;
      var spells = necro.spellProgression();
      var durationBonus = necro.manualDurationBonus();
      var html = "<h3>NecroMage Progression</h3>";
      html += "<p><strong>Level " + necro.persistent.level + "</strong><br>" + progress + " / " + needed + " kills to next level<br>Total kills credited: " + total + "</p>";
      html += "<p>All human kills count toward NecroMage progression, no matter which undead unit lands the finishing blow.</p>";
      html += "<h4>Spell Mastery</h4>";
      html += "<p>Manual casts gain <strong>+" + durationBonus + "s</strong> duration from NecroMage level (plus Endurance). Auto-casts use normal duration and scale their trigger chance with NecroMage level.</p><ul>";
      for (var i = 0; i < spells.length; i++) {
        var s = spells[i];
        if (s.unlocked) {
          html += "<li><strong>" + s.name + "</strong>: unlocked — " + (s.chance * 100).toFixed(1) + "% auto-cast chance (cap " + (s.cap * 100).toFixed(0) + "%)</li>";
        } else {
          html += "<li><strong>" + s.name + "</strong>: unlocks at NecroMage level " + s.unlockLevel + "</li>";
        }
      }
      html += "</ul><p>Armor no longer grants automatic spell procs.</p>";

      // Populate the panel on every pass, even while another tab is active.
      // That prevents an empty panel when Angular swaps visibility before this interval runs.
      panel.innerHTML = html;
      panel.style.display = controller.skeletonMenu.tab === "progression" ? "block" : "none";
    }

    ensureProgressionUI();
    setInterval(ensureProgressionUI, 250);
    console.log("[Incremancer] NecroMage progression installed");
  }

  angular.module("zombieApp").run(["$rootScope", "$timeout", function ($rootScope, $timeout) {
    var attempts = 0;
    function boot() {
      var controller = findController($rootScope);
      if (controller) {
        install(controller, $rootScope);
        return;
      }
      if (++attempts < 80) $timeout(boot, 100, false);
      else console.error("[Incremancer] NecroMage progression could not find ZombieController");
    }
    $timeout(boot, 0, false);
  }]);
})();
