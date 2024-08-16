import { json } from '@sveltejs/kit';

class Duck {
	constructor(public name: string) {
		this.name = name;
	}
}

// just make a class. it might be useful later
class Badling {
	ducks: Duck[];

	constructor(public name: string) {
		this.name = name;
		this.ducks = [];
	}
}

export function GET() {
	let badlings: Badling[] = [];

    let badling = new Badling("Projects");
    badling.ducks.push(new Duck("rubber-ducky"));
    badling.ducks.push(new Duck("coca"));
    badling.ducks.push(new Duck("quake"));
    badlings.push(badling);

	badling = new Badling("Games");
	badling.ducks.push(new Duck("dota"));
	badling.ducks.push(new Duck("csgo"));
	badling.ducks.push(new Duck("valorant"));
	badlings.push(badling);

	return json({ badlings });
}
