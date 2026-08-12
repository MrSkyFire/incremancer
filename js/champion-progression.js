/* Skeleton Champion kill progression prototype.
 * Loaded after the main bundle. Keeps the experiment isolated from compiled game code.
 */
(function () {
  "use strict";

  function install() {
    var body = angular.element(document.body);
    var controller = body.controller && body.controller();
    if (!controller || !controller.model || !controller.model.skeleton) {
      setTimeout(install, 250);
      return;
    }

    var champion = controller.model.skeleton;
    if (champion._killProgressionInstalled) return;
    champion._killProgressionInstalled = true;

    var p = champion.persistent;

    // This fork is built around the Champion, so recruit him immediately on every save.
    // Existing Champion saves are left intact; fresh/older saves with no Champion are promoted to one.
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
        { id: 1, name: "Time Warp", unlocked: level >= 5, chance: Math.min(0.50, 0.01 + level * 0.005) },
        { id: 2, name: "Energy Charge", unlocked: level >= 10, chance: Math.min(0.45, 0.005 + level * 0.0045) },
        { id: 5, name: "Gigazombies", unlocked: level >= 15, chance: Math.min(0.35, 0.005 + level * 0.003) }
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

      // A personal kill can trigger one progression spell. Dark Orb kills count too.
      this.tryProgressionSpells();
    };

    // Equipment keeps its ordinary stats, but equipped spell rolls no longer cast spells.
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

    // The original UI hides the Champion button until allTimeHighestLevel >= 50.
    // Add our own immediately instead of faking level-50 progression and unlocking unrelated systems.
    function ensureChampionButton() {
      var spells = document.querySelector(".resources .spells");
      if (!spells) return;
      var original = spells.querySelector(".skeleton:not([data-early-champion])");
      var early = spells.querySelector("[data-early-champion]");
      if (original) {
        if (early) early.remove();
        return;
      }
      if (!early) {
        early = document.createElement("div");
        early.className = "skeleton";
        early.setAttribute("data-early-champion", "1");
        early.innerHTML = '<div class="bg" id="skeleton-early"></div><div class="xp"><span></span></div><div class="lvl"></div>';
        early.addEventListener("click", function () { controller.skeletonMenu.show(); });
        spells.appendChild(early);
      }
      var bar = early.querySelector(".xp span");
      var lvl = early.querySelector(".lvl");
      if (bar) bar.style.height = controller.skeletonMenu.xpPercent() + "%";
      if (lvl) {
        if (controller.skeletonMenu.isAlive()) {
          lvl.className = "lvl";
          lvl.textContent = "lvl " + champion.persistent.level;
        } else {
          lvl.className = "lvl dead";
          lvl.textContent = "DEAD: " + controller.skeletonMenu.timer();
        }
      }
    }

    ensureChampionButton();
    setInterval(ensureChampionButton, 250);

    console.log("[Incremancer] Champion kill progression installed");
  }

  window.addEventListener("load", function () {
    setTimeout(install, 0);
  });
})();
