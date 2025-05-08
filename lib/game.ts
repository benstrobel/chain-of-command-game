interface Soldier {
    id: number;
    team: "red" | "blue";
    x: number;
    y: number;
    health: number;
}

interface GameState {
    currentCommandRed: string;
    currentCommandBlue: string;
    soldiers: {[id: number]: Soldier};
}

interface OllamaResponse {
    model: string;
    created_at: string;
    response: GameResponse
}

interface GameResponse {
    reasoning: string;
    command: string;
}

type GameCommand = ({action: "move", x: number, y: number} | {action: "attack", x: number, y: number} | {action: "nothing"}) & {reason: string};

const ollamaRequestFormatBase = {
    type: "object",
    properties: {
      reasoning: {
        type: "string"
      },
      command: {
        type: "string",
        enum: ["nothing"]
      }
    },
    required: [
      "reasoning",
      "command"
    ]
  }
  const boardSize = 10;

export async function loop() {
    let state: GameState = {
        currentCommandRed: "Flank and then attack the enemy soldier.",
        currentCommandBlue: "Finish off the wounded soldier.",
        soldiers: {
            1: { id: 1, team: "red", x: 0, y: 0, health: 100 },
            2: { id: 2, team: "red", x: 1, y: 0, health: 25 },
            3: { id: 3, team: "blue", x: 5, y: 5, health: 100 },
        }
    }

    console.log("Starting loop...")
    while(true) {
        for(const soldierId of Object.keys(state.soldiers)) {
            let command = await makeRequestForSoldier(parseInt(soldierId), state);
            console.log(`Turn of soldier: ${soldierId} | Command: ${JSON.stringify(command)}`);
            updateGameState(state, parseInt(soldierId), command);
            // console.log(`New game state: ${JSON.stringify(state)}`);
            printGameState(state);
        }
    }
}

function printGameState(state: GameState) {
    let r = "";
    for(let y = 0; y < boardSize; y++) {
        for(let x = 0; x < boardSize; x++) {
            let soldier = Object.values(state.soldiers).find(s => s.x === x && s.y === y);
            if(soldier) {
                r += soldier.team === "red" ? "R" : "B";
            } else {
                r += " ";
            }
        }
        r += "\n";
    }
    console.log(r);
}

function parseCoordinates(coords: string): {x: number, y: number} {
    let [x, y] = coords.replaceAll("[", "").replaceAll("]", "").split(",").map(Number);
    return {x, y};
}

function updateGameState(state: GameState, soldierId: number, command: GameCommand) {
    if(command.action === "nothing") return;
    if(command.action === "attack") {
        let targetSoldier = Object.values(state.soldiers).find(s => s.x === command.x && s.y === command.y);
        if(targetSoldier) {
            targetSoldier.health -= 50;
            // Have to change soldier loop for this
            /* if(targetSoldier.health <= 0) {
                delete state.soldiers[targetSoldier.id];
            } */
        }
    } else if (command.action === "move") {
        let soldier = state.soldiers[soldierId];
        let blockingSoldier = Object.values(state.soldiers).find(s => s.x === command.x && s.y === command.y);
        if(blockingSoldier) return;
        if(command.x < 0 || command.x > boardSize-1 || command.y < 0 || command.y > boardSize-1) return;
        soldier.x = command.x;
        soldier.y = command.y;
    }
}

async function makeRequestForSoldier(soldierId: number, state: GameState): Promise<GameCommand> {
    let prompt = getPromptForSoldier(soldierId, state);
    let format = getFormatForSoldier(soldierId, state);
    let response = await ollamaRequest("gemma3:1b", prompt, format);
    if (response.command.startsWith("moveto")) {
        let coords = parseCoordinates(response.command.replace("moveto", ""));
        return {action: "move", reason: response.reasoning, x: coords.x, y: coords.y};
    } else if (response.command.startsWith("attack")) {
        let coords = parseCoordinates(response.command.replace("attack", ""));
        return {action: "move", reason: response.reasoning, x: coords.x, y: coords.y};
    } else {
        return {action: "nothing", reason: response.reasoning};
    }
}

function getPromptForSoldier(soldierId: number, state: GameState): string {
    let s = state.soldiers[soldierId];
    // You can only do one action for now, but you will be asked to do another action after all other soldiers have made their turn.
    return `You are a soldier in a game.
    You can do one of the following actions per turn: move to an adjacent field, attack an adjacent field, do nothing.
    If the coordinate you want to move to, is blocked by another soldier, you cannot move there.
    You can attack a field when its directly adjacent to you.
    To move toward a soldier, you should choose the move action that reduces the distance between your coordinates and the coordinates of the other soldier.

    You are soldier ${s.id}.
    This is a list of all soldiers:
    [${Object.values(state.soldiers).map(s => `{id:'${s.id}', team:'${s.team}', coords: [${s.x},${s.y}], health:'${s.health}'}`).join("\n")}]

    This is the command you received from your commander: ${s.team === "red" ? state.currentCommandRed : state.currentCommandBlue}

    What will you do this turn?
    Respond using JSON`;
}

function getFormatForSoldier(soldierId: number, state: GameState): any {
    let format = structuredClone(ollamaRequestFormatBase);
    let s = state.soldiers[soldierId];
    let e = ["nothing"];
    if(Object.values(state.soldiers).find(o => o.x === s.x+1 && o.y === s.y) === undefined) e.push(`moveto[${s.x+1},${s.y}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x-1 && o.y === s.y) === undefined) e.push(`moveto[${s.x-1},${s.y}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x && o.y === s.y+1) === undefined) e.push(`moveto[${s.x},${s.y+1}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x && o.y === s.y-1) === undefined) e.push(`moveto[${s.x},${s.y-1}]`);

    if(Object.values(state.soldiers).find(o => o.x === s.x+1 && o.y === s.y) !== undefined) e.push(`attack[${s.x+1},${s.y}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x-1 && o.y === s.y) !== undefined) e.push(`attack[${s.x-1},${s.y}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x && o.y === s.y+1) !== undefined) e.push(`attack[${s.x},${s.y+1}]`);
    if(Object.values(state.soldiers).find(o => o.x === s.x && o.y === s.y-1) !== undefined) e.push(`attack[${s.x},${s.y-1}]`);
    format.properties.command.enum = e;
    return format;
}

async function ollamaRequest(model: string, prompt: string, format: any): Promise<GameResponse> {
    return fetch("http://localhost:11434/api/generate", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: model,
            prompt: prompt,
            format: format,
            stream: false
        }),
    }).then(async (response) => JSON.parse((await response.json()).response) as GameResponse);
}