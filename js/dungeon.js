// ─── DUNGEON GENERATOR ───────────────────────────────────────────────────────
// Produces a grid of connected rooms similar to Binding of Isaac layout.

class DungeonGenerator {
    static generate(targetRooms = 12) {
        const grid = new Map();   // "gx,gy" -> RoomData
        const DIRS = [
            { dx: 1, dy: 0, door: 'east',  opp: 'west'  },
            { dx:-1, dy: 0, door: 'west',  opp: 'east'  },
            { dx: 0, dy: 1, door: 'south', opp: 'north' },
            { dx: 0, dy:-1, door: 'north', opp: 'south' },
        ];

        const addRoom = (gx, gy, type) => {
            const key = `${gx},${gy}`;
            if (grid.has(key)) return false;
            grid.set(key, {
                gx, gy, type,
                cleared: (type === 'start'),
                visited:  (type === 'start'),
                doors: { north: false, south: false, east: false, west: false },
                enemies: [],
            });
            return true;
        };

        // Start at origin
        addRoom(0, 0, 'start');
        const frontier = [{ gx: 0, gy: 0 }];
        let roomCount = 1;

        // Random walk / BFS hybrid
        while (roomCount < targetRooms && frontier.length) {
            const idx   = Math.floor(Math.random() * frontier.length);
            const cur   = frontier[idx];
            const dirs  = Phaser.Utils.Array.Shuffle([...DIRS]);

            let expanded = false;
            for (const d of dirs) {
                const nx = cur.gx + d.dx;
                const ny = cur.gy + d.dy;
                const key = `${nx},${ny}`;

                // Prevent rooms with > 1 existing neighbour (keeps layout sparse)
                const neighbourCount = DIRS.filter(dd =>
                    grid.has(`${nx + dd.dx},${ny + dd.dy}`)
                ).length;

                if (!grid.has(key) && neighbourCount <= 1) {
                    addRoom(nx, ny, 'normal');
                    roomCount++;
                    frontier.push({ gx: nx, gy: ny });
                    expanded = true;
                    break;
                }
            }

            if (!expanded) frontier.splice(idx, 1);
        }

        // Wire up doors based on adjacency
        grid.forEach((room, key) => {
            DIRS.forEach(d => {
                const nkey = `${room.gx + d.dx},${room.gy + d.dy}`;
                if (grid.has(nkey)) room.doors[d.door] = true;
            });
        });

        // Classify special rooms
        // Boss room  = room furthest from start (BFS)
        // Treasure   = dead-end (1 door) that isn't start / boss
        const dist = DungeonGenerator._bfsDist(grid, '0,0');
        let bossKey = '0,0';
        let bossD   = -1;
        dist.forEach((d, k) => {
            if (d > bossD && k !== '0,0') { bossD = d; bossKey = k; }
        });
        grid.get(bossKey).type = 'boss';

        // Treasure rooms: dead-ends excluding start and boss
        grid.forEach((room, key) => {
            if (key === '0,0' || key === bossKey) return;
            const openDoors = Object.values(room.doors).filter(Boolean).length;
            if (openDoors === 1) room.type = 'treasure';
        });

        // Assign enemy counts
        grid.forEach((room, key) => {
            if (room.type === 'start' || room.type === 'treasure') return;
            const count = room.type === 'boss' ? 1 : Phaser.Math.Between(2, 4);
            room.enemyCount = count;
        });

        return { grid, startKey: '0,0', bossKey };
    }

    static _bfsDist(grid, startKey) {
        const DIRS = [
            { dx: 1, dy: 0 }, { dx:-1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy:-1 },
        ];
        const dist = new Map();
        dist.set(startKey, 0);
        const queue = [startKey];
        while (queue.length) {
            const key = queue.shift();
            const room = grid.get(key);
            DIRS.forEach(d => {
                const nk = `${room.gx + d.dx},${room.gy + d.dy}`;
                if (grid.has(nk) && !dist.has(nk)) {
                    dist.set(nk, dist.get(key) + 1);
                    queue.push(nk);
                }
            });
        }
        return dist;
    }
}
