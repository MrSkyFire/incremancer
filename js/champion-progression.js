/* NecroMage progression + animation layer. */
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

  function installAnimations(necro) {
    if (necro._necroAnimationInstalled) return;
    necro._necroAnimationInstalled = true;

    var sequences = {
      idle:   { frames: [0], speed: 0.08, loop: true },
      walk:   { frames: [1, 2], speed: 0.13, loop: true },
      attack: { frames: [3], speed: 0.20, loop: false },
      cast:   { frames: [4], speed: 0.16, loop: false },
      hurt:   { frames: [5], speed: 0.22, loop: false },
      death:  { frames: [6], speed: 0.12, loop: false }
    };
    var textureCache = {};

    function texturesFor(state) {
      if (textureCache[state]) return textureCache[state];
      var seq = sequences[state];
      if (!PIXI.utils.TextureCache["necro" + seq.frames[0] + ".png"]) return null;
      textureCache[state] = seq.frames.map(function (i) {
        return PIXI.Texture.from("necro" + i + ".png");
      });
      return textureCache[state];
    }

    function setState(sprite, state) {
      var seq = sequences[state];
      var textures = texturesFor(state);
      if (!textures) return;
      if (sprite._necroAnimState === state && sprite.textures === textures) return;
      sprite._necroAnimState = state;
      sprite.textures = textures;
      sprite.animationSpeed = seq.speed;
      sprite.loop = seq.loop;
      sprite.gotoAndPlay(0);
    }

    function faceSprite(sprite) {
      var dir = sprite.scale.x < 0 ? -1 : 1;
      if (sprite.target && ((sprite._necroAttackTimer || 0) > 0 || (sprite._necroCastTimer || 0) > 0)) {
        dir = sprite.target.x < sprite.x ? -1 : 1;
      } else if (Math.abs(sprite.xSpeed || 0) > 0.5) {
        dir = sprite.xSpeed < 0 ? -1 : 1;
      }
      var base = Math.abs(sprite.scaling || 1) * 0.5;
      sprite.scale.x = dir * base;
      sprite.scale.y = base;
    }

    function animate(sprite, dt, previousAttack) {
      if (!sprite) return;
      if (sprite._necroPrevHealth === undefined) sprite._necroPrevHealth = sprite.health;
      if (sprite.health < sprite._necroPrevHealth && !sprite.flags.dead) sprite._necroHurtTimer = 0.35;
      sprite._necroPrevHealth = sprite.health;

      if (previousAttack !== undefined && sprite.timer && sprite.timer.attack > previousAttack + 0.5) {
        sprite._necroAttackTimer = 0.55;
      }
      sprite._necroAttackTimer = Math.max(0, (sprite._necroAttackTimer || 0) - dt);
      sprite._necroCastTimer = Math.max(0, (sprite._necroCastTimer || 0) - dt);
      sprite._necroHurtTimer = Math.max(0, (sprite._necroHurtTimer || 0) - dt);

      faceSprite(sprite);
      if (sprite.flags.dead) return setState(sprite, "death");
      if (sprite._necroHurtTimer > 0) return setState(sprite, "hurt");
      if (sprite._necroCastTimer > 0) return setState(sprite, "cast");
      if (sprite._necroAttackTimer > 0) return setState(sprite, "attack");
      var moving = Math.abs(sprite.xSpeed || 0) > 0.5 || Math.abs(sprite.ySpeed || 0) > 0.5;
      setState(sprite, moving ? "walk" : "idle");
    }

    var oldUpdateCreature = necro.updateCreature.bind(necro);
    necro.updateCreature = function (sprite, dt) {
      var previousAttack = sprite && sprite.timer ? sprite.timer.attack : undefined;
      var result = oldUpdateCreature(sprite, dt);
      animate(sprite, dt, previousAttack);
      return result;
    };

    function markCast() {
      for (var i = 0; i < necro.skeletons.length; i++) {
        var s = necro.skeletons[i];
        if (s && !s.flags.dead) s._necroCastTimer = 0.8;
      }
    }

    if (!necro.spells._necroVisualCastInstalled) {
      necro.spells._necroVisualCastInstalled = true;
      var currentManual = necro.spells.castSpell.bind(necro.spells);
      necro.spells.castSpell = function (spell) {
        markCast();
        return currentManual(spell);
      };
      var currentFree = necro.spells.castSpellNoMana.bind(necro.spells);
      necro.spells.castSpellNoMana = function (spellId) {
        markCast();
        return currentFree(spellId);
      };
    }

    var portraitAttempts = 0;
    function installPortrait() {
      var portrait = document.getElementById("skeleton");
      if (portrait) {
        portrait.style.backgroundImage = "url('sprites/necromage.png')";
        portrait.style.backgroundRepeat = "no-repeat";
        portrait.style.backgroundSize = "700% 100%";
        portrait.style.backgroundPosition = "0 0";
        portrait.style.imageRendering = "pixelated";
        return;
      }
      if (++portraitAttempts < 40) setTimeout(installPortrait, 100);
    }
    installPortrait();
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

    necro.addXp = function () { this.gainKill(); };

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
        try { return oldManualCast(spell); }
        finally { this.timeExtension = oldExtension; }
      };
    }

    installAnimations(necro);
    necro.syncSpellUnlocks();

    controller.skeletonMenu.killsForNextLevel = function () { return necro.killsForNextLevel(); };
    controller.skeletonMenu.spellProgression = function () { return necro.spellProgression(); };
    controller.skeletonMenu.manualDurationBonus = function () { return necro.manualDurationBonus(); };
    controller.skeletonMenu.xpPercent = function () {
      return Math.min(100, Math.round(100 * necro.persistent.killProgress / necro.killsForNextLevel()));
    };

    console.log("[Incremancer] NecroMage progression + animations installed");
  }

  angular.module("zombieApp").run(["$rootScope", "$timeout", function ($rootScope, $timeout) {
    var attempts = 0;
    function boot() {
      var controller = findController($rootScope);
      if (controller) { install(controller); return; }
      if (++attempts < 80) $timeout(boot, 100, false);
      else console.error("[Incremancer] NecroMage progression could not find ZombieController");
    }
    $timeout(boot, 0, false);
  }]);
})();
