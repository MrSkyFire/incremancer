/* NecroMage progression + independent 8-way PIXI.Graphics renderer. */
(function () {
  "use strict";

  function findController(root) {
    var q = [root], s, c;
    while (q.length) {
      s = q.shift();
      if (s && s.zm && s.zm.model && s.zm.model.skeleton) return s.zm;
      if (!s) continue;
      c = s.$$childHead;
      while (c) { q.push(c); c = c.$$nextSibling; }
    }
    return null;
  }

  function ready(c) {
    var n = c && c.model && c.model.skeleton;
    return !!(n && n.model && n.upgrades && n.spells && n.spawnCreature && n.populate && n.updateCreature && c.skeletonMenu);
  }

  function installRenderer(n) {
    if (!n || n._necroGraphicsInstalled) return;
    n._necroGraphicsInstalled = true;

    var dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
    var vec = {E:[1,0],SE:[.7,.7],S:[0,1],SW:[-.7,.7],W:[-1,0],NW:[-.7,-.7],N:[0,-1],NE:[.7,-.7]};
    var counts = {idle:3, walk:4, attack:3, cast:4, hurt:2, death:4};
    var frameTime = {idle:.22, walk:.12, attack:.14, cast:.12, hurt:.16, death:.16};
    var EMPTY = PIXI.Texture.EMPTY;

    function direction(dx, dy, old) {
      if (Math.abs(dx) + Math.abs(dy) < .2) return old || "S";
      var a = Math.atan2(dy, dx), i = Math.round(a / (Math.PI / 4));
      if (i < 0) i += 8;
      return dirs[i % 8];
    }

    function hideHost(s) {
      if (!s) return;
      if (s.stop) s.stop();
      s.textures = [EMPTY];
      s.texture = EMPTY;
      s._necroHostHidden = true;
    }

    function attach(s) {
      if (!s) return null;
      if (!s._necroVisual) {
        var g = new PIXI.Graphics();
        g.position.set(0, 0);
        g.scale.set(1.15, 1.15);
        s.addChild(g);
        s._necroVisual = g;
        s._necroFacing = "S";
        s._necroState = "idle";
        s._necroFrame = 0;
        s._necroClock = 0;
        s._necroLastDraw = "";
      }
      s._necroVisual.visible = true;
      hideHost(s);
      return s._necroVisual;
    }

    function rect(g, x, y, w, h, color, alpha) {
      g.beginFill(color, alpha === undefined ? 1 : alpha);
      g.drawRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
      g.endFill();
    }

    function poly(g, pts, color, alpha) {
      g.beginFill(color, alpha === undefined ? 1 : alpha);
      g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.lineTo(pts[0][0], pts[0][1]);
      g.endFill();
    }

    function magic(g, x, y, frame, big) {
      var r = big ? 7 : 5;
      rect(g, x-r, y-r, r*2, r*2, 0x20ff92, .12);
      rect(g, x-4, y-4, 8, 8, 0x35ffa6, .35);
      rect(g, x-2, y-2, 4, 4, 0xc8ffe5, .9);
      rect(g, x-1, y-1, 2, 2, 0xffffff, 1);
      if (frame & 1) { rect(g, x, y-7, 1, 3, 0x64ffbd, .9); rect(g, x+5, y, 2, 1, 0x64ffbd, .7); }
    }

    function draw(s) {
      var g = attach(s);
      if (!g) return;
      var st = s._necroState || "idle", f = s._necroFrame || 0, d = s._necroFacing || "S";
      var key = st + ":" + d + ":" + f;
      if (key === s._necroLastDraw) { hideHost(s); return; }
      s._necroLastDraw = key;
      g.clear();

      var v = vec[d], north = v[1] < -.45, side = v[0] < -.1 ? -1 : 1;
      if (Math.abs(v[0]) < .1 && north) side = -1;
      var bob = ((st === "idle" && f === 1) || (st === "walk" && (f & 1))) ? -1 : 0;
      var cx = 16 + Math.round(v[0] * (st === "attack" ? 2 : 1));
      var hy = 8 + bob, by = 14 + bob;

      if (st === "death") {
        rect(g, 7, 28, 20, 2, 0x000000, .28);
        if (f === 0) {
          st = "hurt";
        } else if (f === 1) {
          poly(g, [[8,14],[21,17],[25,28],[6,28]], 0x4d176e, 1);
          rect(g, 12, 17, 8, 5, 0xd8cfb5, 1);
          rect(g, 7, 26, 18, 2, 0xd39232, 1);
          hideHost(s); return;
        } else if (f === 2) {
          rect(g, 4, 23, 24, 5, 0x35104c, 1);
          rect(g, 8, 21, 16, 5, 0x4d176e, 1);
          rect(g, side < 0 ? 6 : 22, 20, 6, 5, 0xd8cfb5, 1);
          hideHost(s); return;
        } else {
          rect(g, 4, 25, 25, 3, 0x35104c, 1);
          rect(g, 9, 23, 14, 3, 0x55196f, 1);
          rect(g, 21, 24, 5, 4, 0xc6bda6, 1);
          rect(g, 10, 20, 2, 2, 0x2cff9a, .5);
          rect(g, 17, 18, 2, 2, 0x2cff9a, .35);
          hideHost(s); return;
        }
      }

      rect(g, 7, 28, 18, 2, 0x000000, .25);
      poly(g, [[cx-6,by],[cx+5,by],[cx+8+v[0],27],[cx-8+v[0],27]], 0x1a0928, 1);
      poly(g, [[cx-5,by+1],[cx+4,by+1],[cx+6+v[0],26],[cx-6+v[0],26]], north ? 0x35104c : 0x4d176e, 1);
      rect(g, cx-6, 25, 12, 2, 0xd39232, 1);
      rect(g, cx-5, by+4, 10, 2, 0xd39232, 1);

      rect(g, cx-6, hy+1, 12, 7, 0x1a0928, 1);
      rect(g, cx-5, hy-3, 10, 8, north ? 0x4c1767 : 0x621e81, 1);
      rect(g, cx-4, hy-4, 8, 2, 0x762c99, 1);
      if (north) {
        rect(g, cx-4, hy-1, 8, 5, 0x2b0d3e, 1);
      } else {
        var sh = v[0] > .2 ? 1 : v[0] < -.2 ? -1 : 0;
        rect(g, cx-4+sh, hy, 8, 6, 0xd8cfb5, 1);
        rect(g, cx-3+sh, hy+5, 6, 2, 0x9f9681, 1);
        rect(g, cx-3+sh, hy+2, 2, 2, 0x101015, 1);
        rect(g, cx+1+sh, hy+2, 2, 2, 0x101015, 1);
        rect(g, cx-2+sh, hy+3, 1, 1, 0x35ff9d, 1);
        rect(g, cx+2+sh, hy+3, 1, 1, 0x35ff9d, 1);
      }

      var step = st === "walk" ? f % 4 : 0, leg = step === 1 ? -2 : step === 3 ? 2 : 0;
      rect(g, cx-6+leg, 27, 6, 3, 0xc78a35, 1);
      rect(g, cx+1-leg, 27, 6, 3, 0xc78a35, 1);

      var sx = cx + side * 8, sy = 7 + bob, bx = cx + side * 5, ey = 28;
      if (st === "attack") { sx = cx + Math.round(v[0] * (f ? 11 : 7)); sy = f ? 15 + Math.round(v[1]*3) : 7; ey = f ? 23 : 28; }
      if (st === "cast") { sx = cx + side * (f < 2 ? 8 : 6); sy = f ? 6 : 8; }
      if (st === "hurt") { sx += side * 2; sy += 2; }
      for (var k = 0; k < 12; k++) {
        var t = k / 11;
        rect(g, sx + (bx-sx)*t - 1, sy + (ey-sy)*t, 2, 2, 0x5b341b, 1);
      }
      rect(g, sx-3, sy-3, 6, 6, 0xd8cfb5, 1);
      rect(g, sx-2, sy-2, 4, 4, 0x29202b, 1);
      magic(g, sx+side, sy-4, f, st === "cast");

      if (st === "cast" && f) {
        var ox = cx + Math.round(v[0] * (7 + f*2)), oy = by + Math.round(v[1]*4);
        magic(g, ox, oy, f, true);
      }
      if (st === "attack" && f === 2) {
        var ax = cx + Math.round(v[0]*13), ay = by + Math.round(v[1]*7);
        magic(g, ax, ay, f, false);
        for (k=0;k<4;k++) rect(g, ax+v[0]*k*2.5, ay+v[1]*k*2.5, 2, 2, 0x39f5a0, .9);
      }
      if (st === "hurt") rect(g, 4, 4, 24, 25, 0xff5a76, f ? .08 : .18);
      hideHost(s);
    }

    function facingFor(s, st) {
      var dx = 0, dy = 0;
      if ((st === "attack" || st === "cast") && s.target && (!s.target.flags || !s.target.flags.dead)) {
        dx = s.target.x - s.x; dy = s.target.y - s.y;
      } else { dx = s.xSpeed || 0; dy = s.ySpeed || 0; }
      s._necroFacing = direction(dx, dy, s._necroFacing);
    }

    function updateVisual(s, dt, prevAttack) {
      if (!s) return;
      attach(s);
      if (s._necroPrevHealth === undefined) s._necroPrevHealth = s.health;
      if (s.health < s._necroPrevHealth && (!s.flags || !s.flags.dead)) s._necroHurt = .34;
      s._necroPrevHealth = s.health;
      if (prevAttack !== undefined && s.timer && s.timer.attack > prevAttack + .25) s._necroAttack = .48;
      s._necroAttack = Math.max(0, (s._necroAttack || 0) - dt);
      s._necroCast = Math.max(0, (s._necroCast || 0) - dt);
      s._necroHurt = Math.max(0, (s._necroHurt || 0) - dt);

      var st = s.flags && s.flags.dead ? "death" :
        s._necroHurt > 0 ? "hurt" :
        s._necroCast > 0 ? "cast" :
        s._necroAttack > 0 ? "attack" :
        (Math.abs(s.xSpeed || 0) > .5 || Math.abs(s.ySpeed || 0) > .5) ? "walk" : "idle";

      facingFor(s, st);
      if (st !== s._necroState) { s._necroState = st; s._necroFrame = 0; s._necroClock = 0; }
      s._necroClock += dt;
      while (s._necroClock >= frameTime[st]) {
        s._necroClock -= frameTime[st];
        if (st === "death") s._necroFrame = Math.min(counts[st]-1, s._necroFrame+1);
        else s._necroFrame = (s._necroFrame + 1) % counts[st];
      }
      draw(s);
    }

    n.changeTextureDirection = function (s) {
      if (!s) return;
      attach(s);
      facingFor(s, "walk");
      hideHost(s);
    };

    var oldSpawn = n.spawnCreature.bind(n);
    n.spawnCreature = function () {
      var s = oldSpawn.apply(n, arguments);
      attach(s); draw(s);
      return s;
    };

    var oldPopulate = n.populate.bind(n);
    n.populate = function () {
      var r = oldPopulate.apply(n, arguments);
      for (var i=0; i<n.skeletons.length; i++) { attach(n.skeletons[i]); draw(n.skeletons[i]); }
      return r;
    };

    var oldUpdate = n.updateCreature.bind(n);
    n.updateCreature = function (s, dt) {
      var prev = s && s.timer ? s.timer.attack : undefined;
      var r = oldUpdate.apply(n, arguments);
      updateVisual(s, dt, prev);
      return r;
    };

    function markCast() {
      for (var i=0; i<n.skeletons.length; i++) {
        var s = n.skeletons[i];
        if (s && (!s.flags || !s.flags.dead)) s._necroCast = .8;
      }
    }

    if (n.spells && !n.spells._necroVisualGraphics) {
      n.spells._necroVisualGraphics = true;
      var mc = n.spells.castSpell.bind(n.spells), fc = n.spells.castSpellNoMana.bind(n.spells);
      n.spells.castSpell = function (x) { markCast(); return mc(x); };
      n.spells.castSpellNoMana = function (x) { markCast(); return fc(x); };
    }

    for (var i=0; i<n.skeletons.length; i++) { attach(n.skeletons[i]); draw(n.skeletons[i]); }
    console.log("[Incremancer] NecroMage 8-way Graphics renderer installed");
  }

  function install(c) {
    var n = c.model.skeleton;
    if (!ready(c)) return false;
    if (n._killProgressionInstalled && n._necroGraphicsInstalled) return true;

    try {
      var p = n.persistent;
      if (!n._killProgressionInstalled) {
        if (!p.skeletons || p.skeletons < 1) {
          p.skeletons = 1;
          p.xpRate = Math.max(1, p.xpRate || 0);
          n.model.sendMessage("NecroMage joins the fight!", "chat-levelup");
          n.upgrades.applyUpgrades();
          n.model.saveData();
        }
        p.killProgress = p.killProgress || 0;
        p.totalKills = p.totalKills || 0;

        n.killsForNextLevel = function () { return Math.max(10, Math.round(10 * Math.pow(this.persistent.level, 1.35))); };
        n.spellProgression = function () {
          var l = this.persistent.level;
          return [
            {id:1,name:"Time Warp",unlockLevel:1,unlocked:l>=1,chance:Math.min(.25,.01+(l-1)*.0025),cap:.25},
            {id:2,name:"Energy Charge",unlockLevel:3,unlocked:l>=3,chance:Math.min(.20,.005+Math.max(0,l-3)*.002),cap:.20},
            {id:5,name:"Gigazombies",unlockLevel:7,unlocked:l>=7,chance:Math.min(.15,.005+Math.max(0,l-7)*.0015),cap:.15}
          ];
        };
        n.manualDurationBonus = function () { return Math.floor(Math.max(0, this.persistent.level - 1) / 2); };
        n.syncSpellUnlocks = function () {
          var a = this.spellProgression();
          for (var i=0;i<a.length;i++) {
            var x = this.spells.getSpell ? this.spells.getSpell(a[i].id) : this.spells.spellMap.get(a[i].id);
            if (x && a[i].unlocked) x.unlocked = true;
          }
        };
        n.tryProgressionSpells = function () {
          if (this.spellTimer >= 0) return;
          var a = this.spellProgression();
          for (var i=0;i<a.length;i++) if (a[i].unlocked && Math.random() < a[i].chance) {
            this.spells.castSpellNoMana(a[i].id); this.spellTimer = 3; return;
          }
        };
        n.gainKill = function () {
          this.persistent.totalKills++; this.persistent.killProgress++;
          while (this.persistent.killProgress >= this.killsForNextLevel()) {
            var k = this.killsForNextLevel();
            this.persistent.killProgress -= k; this.persistent.level++;
            this.upgrades.applyUpgrades(); this.syncSpellUnlocks();
            this.model.sendMessage("NecroMage reached level " + this.persistent.level + "!", "chat-levelup");
          }
          this.tryProgressionSpells();
        };
        n.addXp = function () { this.gainKill(); };
        var oldItems = n.applyItemUpgrades.bind(n);
        n.applyItemUpgrades = function () { oldItems(); this.randomSpells = []; };
        n.randomSpells = [];

        if (!n.spells._necroManualDurationInstalled) {
          n.spells._necroManualDurationInstalled = true;
          var oldManual = n.spells.castSpell.bind(n.spells);
          n.spells.castSpell = function (sp) {
            var old = this.timeExtension;
            this.timeExtension = old + n.manualDurationBonus();
            try { return oldManual(sp); } finally { this.timeExtension = old; }
          };
        }
        n.syncSpellUnlocks();
        c.skeletonMenu.killsForNextLevel = function () { return n.killsForNextLevel(); };
        c.skeletonMenu.spellProgression = function () { return n.spellProgression(); };
        c.skeletonMenu.manualDurationBonus = function () { return n.manualDurationBonus(); };
        c.skeletonMenu.xpPercent = function () { return Math.min(100, Math.round(100*n.persistent.killProgress/n.killsForNextLevel())); };
        n._killProgressionInstalled = true;
      }

      installRenderer(n);
      return !!n._necroGraphicsInstalled;
    } catch (err) {
      console.error("[Incremancer] NecroMage install failed; retrying", err);
      n._necroGraphicsInstalled = false;
      return false;
    }
  }

  angular.module("zombieApp").run(["$rootScope", "$timeout", function (root, timeout) {
    var attempts = 0;
    function boot() {
      var c = findController(root);
      if (c && ready(c) && install(c)) return;
      if (++attempts < 300) timeout(boot, 100, false);
      else console.error("[Incremancer] NecroMage installer timed out waiting for battlefield systems");
    }
    timeout(boot, 0, false);
  }]);
})();
