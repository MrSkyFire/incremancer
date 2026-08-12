/* Skeleton Champion kill progression prototype.
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
    var champion = controller.model.skeleton;
    if (!champion || champion._killProgressionInstalled) return;
    champion._killProgressionInstalled = true;

    var p = champion.persistent;

    // This fork is built around the Champion, so recruit him immediately on every save.
    if (!p.skeletons || p.skeletons < 1) {
      p.skeletons = 1;
      p.xpRate = Math.max(1, p.xpRate || 0);
      champion.model.sendMessage("Skeleton Champion joins the fight!", "chat-levelup");
      champion.upgrades.applyUpgrades();
      champion.model.saveData();
    }

    p.killProgress = p.killProgress || 0;
    p.totalKills = p.totalKills || 0;

    champion.killsForNextLevel = function () {
      return Math.max(10, Math.round(10 * Math.pow(this.persistent.level, 1.35)));
    };

    champion.spellProgression = function () {
      var level = this.persistent.level;
      return [
        { id: 1, name: "Time Warp", unlockLevel: 5, unlocked: level >= 5, chance: Math.min(0.50, 0.01 + level * 0.005), cap: 0.50 },
        { id: 2, name: "Energy Charge", unlockLevel: 10, unlocked: level >= 10, chance: Math.min(0.45, 0.005 + level * 0.0045), cap: 0.45 },
        { id: 5, name: "Gigazombies", unlockLevel: 15, unlocked: level >= 15, chance: Math.min(0.35, 0.005 + level * 0.003), cap: 0.35 }
      ];
    };

    champion.tryProgressionSpells = function () {
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

    // Personal Champion kills are now the only source of Champion levels.
    champion.addXp = function () {};

    var oldKillingBlow = champion.killingBlow.bind(champion);
    champion.killingBlow = function (target) {
      oldKillingBlow(target);
      this.persistent.totalKills++;
      this.persistent.killProgress++;

      while (this.persistent.killProgress >= this.killsForNextLevel()) {
        this.persistent.killProgress -= this.killsForNextLevel();
        this.persistent.level++;
        this.upgrades.applyUpgrades();
        this.model.sendMessage("Skeleton Champion reached level " + this.persistent.level + "!", "chat-levelup");
      }

      this.tryProgressionSpells();
    };

    // Equipment keeps its normal stats, but no longer supplies automatic spell rolls.
    var oldApplyItems = champion.applyItemUpgrades.bind(champion);
    champion.applyItemUpgrades = function () {
      oldApplyItems();
      this.randomSpells = [];
    };
    champion.randomSpells = [];

    controller.skeletonMenu.killsForNextLevel = function () {
      return champion.killsForNextLevel();
    };
    controller.skeletonMenu.spellProgression = function () {
      return champion.spellProgression();
    };
    controller.skeletonMenu.xpPercent = function () {
      return Math.min(100, Math.round(100 * champion.persistent.killProgress / champion.killsForNextLevel()));
    };

    // Add a visible Progression tab to the Champion menu without rebuilding the bundled Angular template.
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
        button.addEventListener("click", function () {
          controller.skeletonMenu.tab = "progression";
          $rootScope.$applyAsync();
        });
        title.appendChild(button);
      }
      button.className = controller.skeletonMenu.tab === "progression" ? "active" : "";

      var panel = hold.querySelector("[data-champion-progression-panel]");
      if (!panel) {
        panel = document.createElement("div");
        panel.setAttribute("data-champion-progression-panel", "1");
        panel.className = "ranges";
        hold.appendChild(panel);
      }

      if (controller.skeletonMenu.tab !== "progression") {
        panel.style.display = "none";
        return;
      }

      panel.style.display = "block";
      var needed = champion.killsForNextLevel();
      var progress = champion.persistent.killProgress || 0;
      var total = champion.persistent.totalKills || 0;
      var spells = champion.spellProgression();
      var html = "<h3>Champion Progression</h3>";
      html += "<p><strong>Level " + champion.persistent.level + "</strong><br>" + progress + " / " + needed + " personal kills to next level<br>Lifetime Champion kills: " + total + "</p>";
      html += "<p>Only kills landed by the Skeleton Champion count toward levels. Dark Orb finishing blows count too.</p>";
      html += "<h4>Spell Proc Progression</h4><ul>";
      for (var i = 0; i < spells.length; i++) {
        var s = spells[i];
        if (s.unlocked) {
          html += "<li><strong>" + s.name + "</strong>: " + (s.chance * 100).toFixed(1) + "% proc chance (cap " + (s.cap * 100).toFixed(0) + "%)</li>";
        } else {
          html += "<li><strong>" + s.name + "</strong>: unlocks at Champion level " + s.unlockLevel + "</li>";
        }
      }
      html += "</ul><p>Armor no longer grants automatic spell procs; these chances now come from Champion level.</p>";
      panel.innerHTML = html;
    }

    ensureProgressionUI();
    setInterval(ensureProgressionUI, 250);
    console.log("[Incremancer] Champion kill progression installed");
  }

  // debugInfoEnabled(false) prevents angular.element(...).controller() from working.
  // Register before bootstrap and use Angular's own root scope to locate controllerAs `zm`.
  angular.module("zombieApp").run(["$rootScope", "$timeout", function ($rootScope, $timeout) {
    var attempts = 0;
    function boot() {
      var controller = findController($rootScope);
      if (controller) {
        install(controller, $rootScope);
        return;
      }
      if (++attempts < 80) $timeout(boot, 100, false);
      else console.error("[Incremancer] Champion progression could not find ZombieController");
    }
    $timeout(boot, 0, false);
  }]);
})();
