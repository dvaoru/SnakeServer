import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { log } from "console";
import { resolve } from "path";

export class Vector2float extends Schema {
    @type("uint32") id = 0;
    @type("number") x = Math.floor(Math.random() * 256) - 128;
    @type("number") z = Math.floor(Math.random() * 256) - 128;
}

export class Player extends Schema {
    @type("string") login = ""
    @type("number") x = Math.floor(Math.random() * 256) - 128;
    @type("number") z = Math.floor(Math.random() * 256) - 128;
    @type("uint8") d = 0;
    @type("uint16") score = 0;
    @type("uint8") type = 0; //Тип змейки
}

export class State extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type([Vector2float]) apples = new ArraySchema<Vector2float>();

    appleLastId = 0;
    gameOverIDs = [];

    createApple() {
        const apple = new Vector2float();
        apple.id = this.appleLastId;
        this.appleLastId++;
        this.apples.push(apple);
    }

    collectApple(player: Player, data: any) {
        const apple = this.apples.find((value) => value.id === data.id);
        console.log("apple = " + apple);
        if (apple === undefined) return;
        apple.x = Math.floor(Math.random() * 256) - 128;
        apple.z = Math.floor(Math.random() * 256) - 128;

        player.score++;
        player.d = player.score; //Math.round(player.score / 3);
    }

    createPlayer(sessionId: string, snakeType: number, login: string) {
        const player = new Player();
        player.type = snakeType;
        player.login = login;
        this.players.set(sessionId, player);
    }

    removePlayer(sessionId: string) {
        if (this.players.has(sessionId)) {
            this.players.delete(sessionId);
        }
    }

    movePlayer(sessionId: string, movement: any) {
        this.players.get(sessionId).x = movement.x;
        this.players.get(sessionId).z = movement.z;
    }

    gameOver(data: any) {
        const detailsPositions = JSON.parse(data);
        const clientId = detailsPositions.id;

        const gameOverID = this.gameOverIDs.find((value) => value === clientId);
        if (gameOverID !== undefined) return;
        this.gameOverIDs.push(clientId);
        this.delayedCleargameOverIDs(clientId);

        this.removePlayer(clientId);

        for (let i = 0; i < detailsPositions.ds.length; i++) {
            const element = detailsPositions.ds[i];
            const apple = new Vector2float();
            apple.id = this.appleLastId;
            apple.x = element.x;
            apple.z = element.z;
            this.appleLastId++;
            this.apples.push(apple);
        }
    }

    async delayedCleargameOverIDs(clientId) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        const index = this.gameOverIDs.findIndex((value) => value === clientId);
        if (index <= -1) return;
        this.gameOverIDs.splice(index, 1);
    }
}

export class StateHandlerRoom extends Room<State> {
    maxClients = 40;
    startAppleCount = 300;

    onCreate(options) {
        console.log("StateHandlerRoom created!", options);

        this.setState(new State());

        this.onMessage("move", (client, data) => {
            this.state.movePlayer(client.sessionId, data);
        });

        this.onMessage("collect", (client, data) => {
            console.log(
                "Пришло сообщение " + "collect " + data.id + " " + data
            );
            const player = this.state.players.get(client.sessionId);
            this.state.collectApple(player, data);
        });

        this.onMessage("gameOver", (client, data) => {
            this.state.gameOver(data);
        });

        // this.onMessage("skin", (client, data) => {
        //     const player = this.state.players.get(client.sessionId);
        //     player.type = data.t;
        // });

        for (let i = 0; i < this.startAppleCount; i++) {
            this.state.createApple();
        }
    }

    onAuth(client, options, req) {
        return true;
    }

    onJoin(client: Client, data) {
        console.log("Информация при подключении " + data);
        this.state.createPlayer(client.sessionId, data.t, data.login);
    }

    onLeave(client) {
        this.state.removePlayer(client.sessionId);
    }

    onDispose() {
        console.log("Dispose StateHandlerRoom");
    }
}
