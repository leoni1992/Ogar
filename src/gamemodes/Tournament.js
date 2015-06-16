var Mode = require('./Mode');

function Tournament() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 10;
    this.name = "Tournament";
    this.packetLB = 48;

    // Config (1 tick = 2000 ms)
    this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    this.autoFill = false;
    this.autoFillPlayers = 1;

    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
    this.contenders = [];
    this.maxContenders = 12;

    this.winner;
    this.timer;
}

module.exports = Tournament;
Tournament.prototype = new Mode();

// Gamemode Specific Functions

Tournament.prototype.startGamePrep = function(gameServer) {
    this.gamePhase = 1;
    this.timer = this.prepTime; // 10 seconds
};

Tournament.prototype.startGame = function(gameServer) {
    gameServer.run = true;
    this.gamePhase = 2;
    this.getSpectate(); // Gets a random person to spectate
};

Tournament.prototype.endGame = function(gameServer) {
    this.winner = this.contenders[0];
    this.gamePhase = 3;
    this.timer = this.endTime; // 30 Seconds
};

Tournament.prototype.fillBots = function(gameServer) {
    // Fills the server with bots if there arent enough players
    var fill = this.maxContenders - this.contenders.length;
    for (var i = 0;i < fill;i++) {
        gameServer.bots.addBot();
    }
};

Tournament.prototype.getSpectate = function() {
    // Finds a random person to spectate
    var index = Math.floor(Math.random() * this.contenders.length);
    this.rankOne = this.contenders[index];
};

// Override

Tournament.prototype.onServerInit = function(gameServer) {
    // Remove all cells
    var len = gameServer.nodes.length;
    for (var i = 0; i < len; i++) {
        var node = gameServer.nodes[0];

        if (!node) {
            continue;
        }

        gameServer.removeNode(node);
    }

    // Pauses the server
    gameServer.run = false;
    this.gamePhase = 0;

    // Get config values
    if (gameServer.config.tourneyAutoFill > 0) {
        this.timer = gameServer.config.tourneyAutoFill;
        this.autoFill = true;
        this.autoFillPlayers = gameServer.config.tourneyAutoFillPlayers;
    }
    this.prepTime = gameServer.config.tourneyPrepTime;
    this.endTime = gameServer.config.tourneyEndTime;
    this.maxContenders = gameServer.config.tourneyMaxPlayers;
};

Tournament.prototype.onPlayerSpawn = function(gameServer,player) {
    // Only spawn players if the game hasnt started yet
    if ((this.gamePhase == 0) && (this.contenders.length < this.maxContenders)) {
        player.color = gameServer.getRandomColor(); // Random color
        this.contenders.push(player); // Add to contenders list
        gameServer.spawnPlayer(player);

        if (this.contenders.length == this.maxContenders) {
            // Start the game once there is enough players
            this.startGamePrep(gameServer);
        }
    }
};

Tournament.prototype.onCellRemove = function(cell) {
    var owner = cell.owner;
    if (owner.cells.length <= 0) {
        // Remove from contenders list
        var index = this.contenders.indexOf(owner);
        if (index != -1) {
            this.contenders.splice(index,1);
        }

        // Victory conditions
        var bots = 0;
        for (var i = 0; i < this.contenders.length; i++) {
            if (!('_socket' in this.contenders[i].socket)) {
                bots++;
            }
        }
        if ((this.contenders.length-bots == 1) && (this.gamePhase == 2)){
            this.endGame(cell.owner.gameServer);
        }
    }
};

Tournament.prototype.updateLB = function(gameServer) {
    var lb = gameServer.leaderboard;

    switch (this.gamePhase) {
        case 0:
            lb[0] = "Waiting for";
            lb[1] = "players: ";
            lb[2] = this.contenders.length+"/"+this.maxContenders;
            if (this.autoFill) {
                if (this.timer <= 0) {
                    this.fillBots(gameServer);
                } else if (this.contenders.length >= this.autoFillPlayers) {
                    this.timer--;
                }
            }
            break;
        case 1:
            lb[0] = "Game starting in";
            lb[1] = this.timer.toString();
            lb[2] = "Good luck!";
            if (this.timer <= 0) {
                // Reset the game
                this.startGame(gameServer);
            } else {
                this.timer--;
            }
            break;
        case 2:
            lb[0] = "Players Remaining";
            lb[1] = this.contenders.length+"/"+this.maxContenders;
            break;
        case 3:
            lb[0] = "Congratulations";
            lb[1] = this.winner.getName();
            lb[2] = "for winning!";
            if (this.timer <= 0) {
                // Reset the game
                this.onServerInit(gameServer);
                // Respawn starting food
                gameServer.startingFood();
            } else {
                this.timer--;
            }
            break;
        default:
            break;
    }
};

